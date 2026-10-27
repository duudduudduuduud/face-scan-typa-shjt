from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]


def read_image(path):
    image = cv2.imdecode(np.fromfile(str(path), dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Cannot read image: {path}")
    return image


class FaceEngine:
    def __init__(self):
        detector = ROOT / "models/face_detection_yunet_2023mar.onnx"
        recognizer = ROOT / "models/face_recognition_sface_2021dec.onnx"
        for path in (detector, recognizer):
            if not path.is_file():
                raise FileNotFoundError(f"Missing model: {path}. Run python -m ai.download_models")
        self.detector = cv2.FaceDetectorYN.create(str(detector), "", (320, 320), 0.6)
        self.recognizer = cv2.FaceRecognizerSF.create(str(recognizer), "")

    def detect(self, image):
        self.detector.setInputSize((image.shape[1], image.shape[0]))
        _, faces = self.detector.detect(image)
        return faces if faces is not None else []

    def embedding(self, image, face):
        crop = self.recognizer.alignCrop(image, face)
        vector = self.recognizer.feature(crop).flatten().copy()
        return vector / max(float(np.linalg.norm(vector)), 1e-12)


class Gallery:
    def __init__(self, path):
        with np.load(path, allow_pickle=False) as data:
            self.ids = data["ids"].copy()
            self.vectors = data["vectors"].copy()
        if not len(self.ids) or len(self.ids) != len(self.vectors):
            raise ValueError("Invalid or empty gallery. Run enroll again.")

    def match(self, vector, threshold):
        scores = self.vectors @ vector
        index = int(np.argmax(scores))
        score = float(scores[index])
        return (str(self.ids[index]) if score >= threshold else "unknown"), score
