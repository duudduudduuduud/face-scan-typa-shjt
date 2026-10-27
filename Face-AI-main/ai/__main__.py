import argparse
import json
import sys
import os
from pathlib import Path

from .recognition import FaceEngine, Gallery, ROOT, read_image
from .capture import capture_student, validate_student_id
from .backend_client import BackendClient, positive_id
from .event_reporter import EventReporter
import cv2
import numpy as np


def enroll(engine, source, output):
    ids, vectors = [], []
    if not source.is_dir():
        raise ValueError(f"Create student image folders inside: {source}")
    for student in sorted(source.iterdir()):
        if not student.is_dir():
            continue
        for path in sorted(student.iterdir()):
            if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".bmp"}:
                continue
            image = read_image(path)
            faces = engine.detect(image)
            if len(faces) != 1:
                print(f"Skipped {path}: expected one face, found {len(faces)}", file=sys.stderr)
                continue
            ids.append(student.name)
            vectors.append(engine.embedding(image, faces[0]))
    if not vectors:
        raise ValueError("No valid registration images. Gallery was not changed.")
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("wb") as file:
        np.savez_compressed(file, ids=np.asarray(ids), vectors=np.stack(vectors))
    print(f"Registered {len(set(ids))} students from {len(ids)} images: {output}")


def recognize(engine, gallery, image, threshold):
    results = []
    for face in engine.detect(image):
        student_id, score = gallery.match(engine.embedding(image, face), threshold)
        results.append({"student_id": student_id, "similarity": round(score, 4),
                        "box": [int(v) for v in face[:4]]})
    return results


def main():
    parser = argparse.ArgumentParser(description="Student face recognition demo")
    parser.add_argument("command", choices=["capture", "enroll", "image", "camera", "backend-check", "sync-events"])
    parser.add_argument("--send-events", action="store_true", help="Space confirms one recognized student's event")
    parser.add_argument("--room-id", type=int, default=None)
    parser.add_argument("--direction", choices=['in', 'out'])
    parser.add_argument("--camera-id", default=os.getenv('CAMERA_ID', 'camera-01'))
    parser.add_argument("--outbox", type=Path, default=ROOT / 'data/event-outbox.sqlite3')
    parser.add_argument("--student-id", help="Student ID for capture; prompted if omitted")
    parser.add_argument("--count", type=int, default=5, help="Number of registration photos")
    parser.add_argument("--source", type=Path, default=ROOT / "data/registration")
    parser.add_argument("--gallery", type=Path, default=ROOT / "data/embeddings/gallery.npz")
    parser.add_argument("--image", type=Path)
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--threshold", type=float, default=0.45)
    args = parser.parse_args()
    reporter = None
    if args.command in ('backend-check', 'sync-events') or args.send_events:
        client = BackendClient.from_environment()
        if args.command == 'backend-check':
            print(json.dumps(client.rooms(), ensure_ascii=False, indent=2))
            if args.student_id:
                print(f'Student ID: {client.student_id(args.student_id)}')
            return
        reporter = EventReporter(client, args.outbox)
        if args.command == 'sync-events':
            summary = reporter.flush()
            print(summary)
            if summary['pending'] or summary['blocked']:
                raise RuntimeError('Some events remain pending or blocked in the outbox')
            return
        if args.command != 'camera' or not args.direction:
            parser.error('--send-events requires camera and --direction in|out')
        args.room_id = positive_id(args.room_id if args.room_id is not None else int(os.getenv('ROOM_ID', '0')))
        rooms = client.rooms()
        if not any(room['id'] == args.room_id for room in rooms):
            parser.error('Configured room ID does not exist in backend')
        print('Space: confirm one visible recognized student. R: retry queued events. Q: quit.')
    if not -1 <= args.threshold <= 1:
        parser.error("--threshold must be between -1 and 1")
    if args.command == "image" and args.image is None:
        parser.error("image requires --image PATH")
    if args.command == "capture":
        if args.count < 1:
            parser.error("--count must be positive")
        args.student_id = validate_student_id(args.student_id or input("Student ID: ").strip())
    engine = FaceEngine()
    if args.command == "capture":
        if capture_student(engine, args.source, args.student_id, args.camera, args.count):
            enroll(engine, args.source, args.gallery)
            print("Registration complete. Run python -m ai camera to recognize.")
        return
    if args.command == "enroll":
        enroll(engine, args.source, args.gallery)
        return
    gallery = Gallery(args.gallery)
    if args.command == "image":
        print(json.dumps(recognize(engine, gallery, read_image(args.image), args.threshold), ensure_ascii=False, indent=2))
        return
    capture = cv2.VideoCapture(args.camera)
    try:
        if not capture.isOpened():
            raise RuntimeError("Cannot open camera. Check permission or --camera index.")
        while True:
            ok, frame = capture.read()
            if not ok:
                raise RuntimeError("Cannot read camera frame.")
            results = recognize(engine, gallery, frame, args.threshold)
            for result in results:
                x, y, w, h = result["box"]
                color = (0, 200, 0) if result["student_id"] != "unknown" else (0, 0, 255)
                cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
                label = f'{result["student_id"]} {result["similarity"]:.2f}'
                cv2.putText(frame, label, (x, max(20, y - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
            cv2.imshow("Student recognition - Q to quit", frame)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), 27):
                break
            if reporter and key == 32:
                if len(results) == 1 and results[0]['student_id'].lower() != 'unknown':
                    event_key = reporter.enqueue(results[0]['student_id'], args.room_id, args.direction, args.camera_id)
                    print(f'Queued: {event_key}')
                    print(reporter.flush())
                else:
                    print('Show exactly one recognized student before confirming.')
            if reporter and key == ord('r'):
                print(reporter.flush())
            if cv2.getWindowProperty("Student recognition - Q to quit", cv2.WND_PROP_VISIBLE) < 1:
                break
    finally:
        capture.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    try:
        main()
    except (ValueError, FileNotFoundError, RuntimeError, cv2.error) as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
