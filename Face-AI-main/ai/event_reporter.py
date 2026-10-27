"""Persistent outbox: identity lookup and delivery can retry after restart."""
import json
from contextlib import contextmanager
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from .backend_client import BackendError, positive_id


@contextmanager
def database(path):
    connection = sqlite3.connect(path)
    try:
        with connection:
            yield connection
    finally:
        connection.close()


class EventReporter:
    def __init__(self, client, path):
        self.client = client
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        with database(path) as db:
            db.execute('CREATE TABLE IF NOT EXISTS outbox '
                       '(id INTEGER PRIMARY KEY, code TEXT, payload TEXT, error TEXT)')

    def enqueue(self, code, room_id, direction, camera_id):
        if not code.strip() or code.lower() == 'unknown':
            raise ValueError('Cannot report unknown student')
        if direction not in ('in', 'out'):
            raise ValueError('Direction must be in or out')
        if not camera_id.strip() or len(camera_id) > 160:
            raise ValueError('Camera ID must contain 1–160 characters')
        payload = {'roomId': positive_id(room_id), 'direction': direction,
                   'occurredAt': datetime.now(timezone.utc).isoformat(timespec='milliseconds'),
                   'source': 'camera', 'eventKey': f'{camera_id}-{uuid4()}'}
        with database(self.path) as db:
            db.execute('INSERT INTO outbox(code, payload) VALUES (?, ?)', (code, json.dumps(payload)))
        return payload['eventKey']

    def flush(self):
        sent = 0
        with database(self.path) as db:
            rows = db.execute('SELECT id, code, payload FROM outbox WHERE error IS NULL ORDER BY id').fetchall()
        for row_id, code, raw in rows:
            payload = json.loads(raw)
            try:
                if 'studentId' not in payload:
                    payload['studentId'] = self.client.student_id(code)
                    with database(self.path) as db:
                        db.execute('UPDATE outbox SET payload=? WHERE id=?', (json.dumps(payload), row_id))
                self.client.create_event(payload)
            except BackendError as error:
                if error.status in (400, 403, 404, 409):
                    with database(self.path) as db:
                        db.execute('UPDATE outbox SET error=? WHERE id=?', (str(error), row_id))
                    print(f'Event {payload["eventKey"]} blocked: {error}')
                    continue
                print(f'Delivery paused; queued events retained: {error}')
                break
            with database(self.path) as db:
                db.execute('DELETE FROM outbox WHERE id=?', (row_id,))
            sent += 1
        with database(self.path) as db:
            pending, blocked = db.execute('SELECT COUNT(*), COUNT(error) FROM outbox').fetchone()
        return {'sent': sent, 'pending': pending - blocked, 'blocked': blocked}
