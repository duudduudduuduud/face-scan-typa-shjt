"""Run with python capture_photos.py --student-id SV001."""
import sys

from ai.__main__ import main
import cv2


if __name__ == "__main__":
    sys.argv.insert(1, "capture")
    try:
        main()
    except (ValueError, OSError, RuntimeError, EOFError, cv2.error) as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
