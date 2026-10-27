"""Session-separated linear SVM training; artifacts use NPZ/JSON, never pickle."""
import hashlib
import json
import threading
from datetime import datetime, timezone
from uuid import uuid4

import numpy as np
import cv2

from .recognition import FaceEngine, read_image


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False), encoding='utf-8')
    temporary.replace(path)


def source_files(root):
    folder = root / 'data/registration'
    return sorted(p for p in folder.glob('*/*') if p.suffix.lower() in {'.jpg', '.jpeg', '.png'} and p.is_file())


def session_for(path):
    parts = path.stem.split('_')
    # Older UUID-per-photo captures cannot prove independent capture sessions.
    return parts[1] if len(parts) == 3 and parts[0] in {'web', 'capture'} else 'legacy'


def fingerprint(root, files=None):
    digest = hashlib.sha256()
    for path in source_files(root) if files is None else files:
        digest.update(str(path.relative_to(root)).encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def predict_model(model, vector, threshold=0.45):
    vector = np.asarray(vector)
    decisions = model['weights'] @ vector + model['bias']
    index = int(decisions[0] > 0) if len(model['classes']) == 2 else int(np.argmax(decisions))
    code = str(model['classes'][index])
    refs = model['vectors'][model['labels'] == code]
    similarity = float(np.max(refs @ vector))
    return (code if similarity >= threshold else 'unknown'), similarity


def fit_model(vectors, labels):
    from sklearn.svm import LinearSVC
    svm = LinearSVC(C=1.0, class_weight='balanced', dual=False, random_state=42, max_iter=10000)
    svm.fit(vectors, labels)
    return {'weights': svm.coef_, 'bias': svm.intercept_, 'classes': svm.classes_,
            'vectors': np.asarray(vectors), 'labels': np.asarray(labels)}


def split_sessions(records):
    train, test = [], []
    classes = sorted({row['code'] for row in records})
    if len(classes) < 2:
        raise ValueError('Can it nhat 2 sinh vien de huan luyen SVM')
    for code in classes:
        rows = [r for r in records if r['code'] == code]
        sessions = sorted({r['session'] for r in rows})
        if len(sessions) < 2:
            raise ValueError(f'{code}: can anh hop le tu it nhat 2 lan chup rieng')
        held_out = sessions[-1]
        training = [r for r in rows if r['session'] != held_out]
        testing = [r for r in rows if r['session'] == held_out]
        if len(training) < 5 or len(testing) < 5:
            raise ValueError(f'{code}: can it nhat 5 anh train va 5 anh test tu cac lan chup khac nhau')
        train.extend(training)
        test.extend(testing)
    return train, test, classes


class TrainingManager:
    def __init__(self, root, engine_factory=FaceEngine):
        self.root = root
        self.folder = root / 'data/training'
        self.engine_factory = engine_factory
        self.lock = threading.RLock()
        self.job = None
        self.active_model = None
        self.active_id = None
        pointer = self.folder / 'active.json'
        if pointer.exists():
            try:
                value = json.loads(pointer.read_text(encoding='utf-8'))
                self._load_active(value['id'])
            except (ValueError, OSError, KeyError):
                pass

    def _load_active(self, version):
        self.validate_id(version)
        summary = json.loads((self.folder / f'{version}.json').read_text(encoding='utf-8'))
        if summary['fingerprint'] != fingerprint(self.root):
            raise ValueError('Active model dataset changed')
        with np.load(self.folder / f'{version}.npz', allow_pickle=False) as data:
            self.active_model = {key: data[key].copy() for key in data.files}
        self.active_id = version

    @staticmethod
    def validate_id(version):
        if not isinstance(version, str) or len(version) != 32 or any(c not in '0123456789abcdef' for c in version):
            raise ValueError('Invalid model version')

    def status(self):
        with self.lock:
            files = source_files(self.root)
            codes = sorted({p.parent.name for p in files})
            dataset = [{'studentCode': code, 'images': sum(p.parent.name == code for p in files),
                        'sessions': len({session_for(p) for p in files if p.parent.name == code})} for code in codes]
            versions = []
            for path in self.folder.glob('*.json'):
                if path.name == 'active.json':
                    continue
                versions.append(json.loads(path.read_text(encoding='utf-8')))
            versions.sort(key=lambda v: v['createdAt'], reverse=True)
            current = fingerprint(self.root, files)
            for version in versions:
                version['stale'] = version['fingerprint'] != current
            return {'dataset': dataset, 'versions': versions, 'activeId': self.active_id,
                    'job': dict(self.job) if self.job else None}

    def start(self):
        with self.lock:
            if self.job and self.job['state'] == 'running':
                raise ValueError('Training is already running')
            files = source_files(self.root)
            if len({p.parent.name for p in files}) < 2:
                raise ValueError('Can it nhat 2 sinh vien; moi sinh vien chup it nhat 2 lan, moi lan 5 anh')
            for code in {p.parent.name for p in files}:
                if len({session_for(p) for p in files if p.parent.name == code}) < 2:
                    raise ValueError(f'{code}: can it nhat 2 lan chup rieng')
            version = uuid4().hex
            self.job = {'id': version, 'state': 'running', 'progress': 0, 'message': 'Trich xuat dac trung'}
            threading.Thread(target=self._train, args=(version, files, fingerprint(self.root, files)), daemon=True).start()
            return dict(self.job)

    def progress(self, progress, message):
        with self.lock:
            self.job.update(progress=progress, message=message)

    def _train(self, version, files, dataset_hash):
        try:
            from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
            engine = self.engine_factory()
            records, rejected, hashes = [], [], set()
            for index, path in enumerate(files):
                try:
                    image_hash = hashlib.sha256(path.read_bytes()).hexdigest()
                    if image_hash in hashes:
                        raise ValueError('Duplicate image')
                    hashes.add(image_hash)
                    image = read_image(path)
                    faces = engine.detect(image)
                    if len(faces) != 1:
                        raise ValueError('Photo must contain exactly one face')
                    records.append({'code': path.parent.name, 'session': session_for(path),
                                    'vector': engine.embedding(image, faces[0])})
                except (ValueError, OSError, cv2.error) as error:
                    rejected.append({'file': str(path.relative_to(self.root / 'data/registration')), 'reason': str(error)})
                self.progress(round(70 * (index + 1) / len(files)), 'Trich xuat dac trung')
            train, test, classes = split_sessions(records)
            self.progress(75, 'Huan luyen SVM')
            model = fit_model(np.stack([r['vector'] for r in train]), [r['code'] for r in train])
            predictions = [predict_model(model, row['vector'])[0] for row in test]
            truth = [row['code'] for row in test]
            self.progress(90, 'Danh gia tren tap test doc lap')
            report = classification_report(truth, predictions, labels=classes, output_dict=True, zero_division=0)
            summary = {'id': version, 'createdAt': datetime.now(timezone.utc).isoformat(),
                       'algorithm': 'SFace + LinearSVC', 'fingerprint': dataset_hash,
                       'classes': classes, 'trainCount': len(train), 'testCount': len(test),
                       'split': 'Hold out one capture session per student; never refit on test images',
                       'threshold': 0.45, 'accuracy': float(accuracy_score(truth, predictions)),
                       'precision': report['macro avg']['precision'], 'recall': report['macro avg']['recall'],
                       'f1': report['macro avg']['f1-score'], 'report': report,
                       'confusionLabels': classes + ['unknown'],
                       'confusionMatrix': confusion_matrix(truth, predictions, labels=classes + ['unknown']).tolist(),
                       'rejected': rejected,
                       'trainSessions': sorted({r['code'] + '/' + r['session'] for r in train}),
                       'testSessions': sorted({r['code'] + '/' + r['session'] for r in test})}
            self.folder.mkdir(parents=True, exist_ok=True)
            temporary = self.folder / f'{version}.tmp'
            with temporary.open('wb') as file:
                np.savez_compressed(file, **model)
            temporary.replace(self.folder / f'{version}.npz')
            atomic_json(self.folder / f'{version}.json', summary)
            with self.lock:
                self.job.update(state='completed', progress=100, message='Huan luyen hoan tat')
        except Exception as error:
            with self.lock:
                self.job.update(state='failed', message=str(error))

    def activate(self, version):
        with self.lock:
            if version is None:
                atomic_json(self.folder / 'active.json', {'id': None})
                self.active_id, self.active_model = None, None
            else:
                self.validate_id(version)
                path = self.folder / f'{version}.json'
                if not path.exists():
                    raise ValueError('Model does not exist')
                summary = json.loads(path.read_text(encoding='utf-8'))
                if summary['fingerprint'] != fingerprint(self.root):
                    raise ValueError('Dataset changed; train a new model before activation')
                self._load_active(version)
                atomic_json(self.folder / 'active.json', {'id': version})
            return {'activeId': self.active_id}

    def match(self, vector):
        with self.lock:
            if self.active_id:
                summary = json.loads((self.folder / f'{self.active_id}.json').read_text(encoding='utf-8'))
                if summary['fingerprint'] != fingerprint(self.root):
                    self.activate(None)
            return predict_model(self.active_model, vector) if self.active_model is not None else None
