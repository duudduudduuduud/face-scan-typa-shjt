"""Download official OpenCV Zoo weights; no inference dependencies required."""
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
MODELS = {
    "face_detection_yunet_2023mar.onnx": "face_detection_yunet",
    "face_recognition_sface_2021dec.onnx": "face_recognition_sface",
}


def main():
    target = ROOT / "models"
    target.mkdir(exist_ok=True)
    for name, folder in MODELS.items():
        path = target / name
        if path.exists():
            print(f"Already exists: {name}")
            continue
        url = f"https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/{folder}/{name}"
        temporary = path.with_suffix(".download")
        try:
            with urlopen(url, timeout=120) as response, temporary.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            if temporary.stat().st_size < 10000:
                raise ValueError(f"Invalid model download: {name}")
            temporary.replace(path)
            print(f"Downloaded: {name}")
        finally:
            temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
