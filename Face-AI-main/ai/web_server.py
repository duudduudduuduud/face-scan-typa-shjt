"""Loopback AI service used by NestJS, never directly by browser clients."""
import argparse
import base64
import hmac
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from uuid import uuid4

import cv2
import numpy as np

from .capture import validate_student_id
from .recognition import FaceEngine, Gallery, ROOT
from .training import TrainingManager

MAX_BODY = 12 * 1024 * 1024


def decode_image(value):
    if not isinstance(value, str) or len(value) > 2_000_000:
        raise ValueError('Image must be a JPEG data URL under 2 MB')
    prefix = 'data:image/jpeg;base64,'
    if not value.startswith(prefix):
        raise ValueError('Only JPEG data URLs are supported')
    try:
        raw = base64.b64decode(value[len(prefix):], validate=True)
    except ValueError:
        raise ValueError('Invalid image encoding') from None
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None or max(image.shape[:2]) > 1920:
        raise ValueError('Invalid image or resolution above 1920 pixels')
    return image


class WebEngine:
    def __init__(self):
        self.engine = FaceEngine()
        self.gallery_path = ROOT / 'data/embeddings/gallery.npz'
        self.lock = threading.Lock()
        self.training = TrainingManager(ROOT)

    def handle(self, path, body):
        if path.startswith('/training/'):
            if path == '/training/status':
                with self.lock:
                    return self.training.status()
            if path == '/training/start':
                with self.lock:
                    return self.training.start()
            if path == '/training/activate':
                with self.lock:
                    return self.training.activate(body.get('version'))
            raise ValueError('Unknown training endpoint')
        with self.lock:
            if path == '/recognize':
                image = decode_image(body.get('image'))
                faces = self.engine.detect(image)
                if len(faces) != 1:
                    raise ValueError('Show exactly one face')
                if not self.gallery_path.exists():
                    raise ValueError('Register a face first')
                vector = self.engine.embedding(image, faces[0])
                trained = self.training.match(vector) if hasattr(self, 'training') else None
                code, score = trained if trained is not None else Gallery(self.gallery_path).match(vector, 0.45)
                return {'studentCode': code, 'similarity': round(score, 4)}
            if path == '/enroll':
                code = validate_student_id(body.get('studentCode', ''))
                if code.lower() == 'unknown':
                    raise ValueError('Invalid student code')
                images = body.get('images')
                if not isinstance(images, list) or len(images) != 5:
                    raise ValueError('Exactly five images are required')
                frames, vectors = [], []
                for value in images:
                    image = decode_image(value)
                    faces = self.engine.detect(image)
                    if len(faces) != 1:
                        raise ValueError('Each registration photo must contain exactly one face')
                    frames.append(image)
                    vectors.append(self.engine.embedding(image, faces[0]))
                ids = np.asarray([code] * 5)
                vectors = np.stack(vectors)
                if self.gallery_path.exists():
                    old = Gallery(self.gallery_path)
                    keep = old.ids != code
                    ids = np.concatenate([old.ids[keep], ids])
                    vectors = np.concatenate([old.vectors[keep], vectors])
                self.gallery_path.parent.mkdir(parents=True, exist_ok=True)
                temporary = self.gallery_path.with_suffix('.tmp')
                with temporary.open('wb') as file:
                    np.savez_compressed(file, ids=ids, vectors=vectors)
                temporary.replace(self.gallery_path)
                folder = ROOT / 'data/registration' / code
                folder.mkdir(parents=True, exist_ok=True)
                session_id = uuid4().hex
                for index, frame in enumerate(frames):
                    ok, encoded = cv2.imencode('.jpg', frame)
                    if not ok:
                        raise RuntimeError('Cannot save registration photo')
                    encoded.tofile(str(folder / f'web_{session_id}_{index:03d}.jpg'))
                if hasattr(self, 'training'):
                    self.training.activate(None)
                return {'studentCode': code, 'count': 5}
            raise ValueError('Unknown endpoint')


def make_handler(engine, secret):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_POST(self):
            if not hmac.compare_digest(self.headers.get('X-AI-Key', ''), secret):
                self.reply(401, {'message': 'Invalid AI service key'})
                return
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= MAX_BODY:
                    raise ValueError('Request too large or empty')
                body = json.loads(self.rfile.read(size))
                if not isinstance(body, dict):
                    raise ValueError('JSON object required')
                self.reply(200, engine.handle(self.path, body))
            except (ValueError, TypeError, cv2.error) as error:
                self.reply(400, {'message': str(error)})
            except Exception:
                self.reply(500, {'message': 'AI processing failed'})

        def reply(self, status, body):
            raw = json.dumps(body).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8001)
    args = parser.parse_args()
    env_file = ROOT / '.env'
    if env_file.exists() and not os.getenv('AI_SERVICE_KEY'):
        for line in env_file.read_text(encoding='utf-8-sig').splitlines():
            if line.startswith('AI_SERVICE_KEY='):
                os.environ['AI_SERVICE_KEY'] = line.split('=', 1)[1].strip().strip('\"\'')
    secret = os.getenv('AI_SERVICE_KEY', '')
    if len(secret) < 32:
        parser.error('Set AI_SERVICE_KEY to a shared secret of at least 32 characters')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), make_handler(WebEngine(), secret))
    print(f'AI web service ready at http://127.0.0.1:{args.port}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
