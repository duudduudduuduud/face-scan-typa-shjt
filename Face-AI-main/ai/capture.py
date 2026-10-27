"""Interactive registration photo capture."""
import re
from uuid import uuid4

import cv2


def validate_student_id(student_id):
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", student_id):
        raise ValueError("Student ID must contain 1-64 letters, numbers, _ or -.")
    if student_id.upper() in {"CON", "PRN", "AUX", "NUL", *[f"COM{i}" for i in range(10)], *[f"LPT{i}" for i in range(10)]}:
        raise ValueError("This student ID is a reserved Windows filename.")
    return student_id


def capture_student(engine, source, student_id, camera_index=0, count=5):
    student_id = validate_student_id(student_id)
    if count < 1:
        raise ValueError("Photo count must be positive.")
    folder = source / student_id
    poses = ["Look straight", "Turn slightly left", "Turn slightly right",
             "Tilt slightly up", "Tilt slightly down"]
    title = "Registration - SPACE: capture, Q: quit"
    camera = cv2.VideoCapture(camera_index)
    saved = 0
    session_id = uuid4().hex
    notice = "SPACE to save when exactly one face is visible"
    try:
        if not camera.isOpened():
            raise RuntimeError("Cannot open camera. Check permission or --camera index.")
        while saved < count:
            ok, frame = camera.read()
            if not ok:
                raise RuntimeError("Cannot read camera frame.")
            faces = engine.detect(frame)
            preview = frame.copy()
            for face in faces:
                x, y, w, h = [int(v) for v in face[:4]]
                cv2.rectangle(preview, (x, y), (x + w, y + h), (0, 200, 0), 2)
            lines = [f"{student_id}: {saved}/{count} saved",
                     poses[saved % len(poses)], notice]
            for index, line in enumerate(lines):
                cv2.putText(preview, line, (10, 25 + 25 * index),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 220, 255), 1)
            cv2.imshow(title, preview)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), 27) or cv2.getWindowProperty(title, cv2.WND_PROP_VISIBLE) < 1:
                break
            if key != ord(" "):
                continue
            if len(faces) != 1:
                notice = f"Not saved: found {len(faces)} faces, need exactly one"
                continue
            success, encoded = cv2.imencode(".jpg", frame)
            if not success:
                raise RuntimeError("Cannot encode photo.")
            folder.mkdir(parents=True, exist_ok=True)
            path = folder / f"capture_{session_id}_{saved:03d}.jpg"
            with path.open("xb") as output:
                output.write(encoded.tobytes())
            saved += 1
            notice = "Saved. Change angle before pressing SPACE again"
            print(f"Saved {saved}/{count}: {path}")
    finally:
        camera.release()
        cv2.destroyAllWindows()
    if saved < count:
        print(f"Stopped early: {saved}/{count} photos saved. Existing photos kept.")
    return saved == count
