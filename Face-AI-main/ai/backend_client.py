"""NestJS HTTP contract; credentials come from process environment only."""
import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen


class BackendError(RuntimeError):
    def __init__(self, status, message):
        self.status = status
        super().__init__(f"Backend {status or 'network'}: {message}")


class BackendClient:
    def __init__(self, base_url, username='', password='', token='', timeout=5):
        if urlsplit(base_url).scheme not in ('http', 'https') or not urlsplit(base_url).netloc:
            raise ValueError('BACKEND_URL must be an HTTP(S) URL')
        if not token and not (username and password):
            raise ValueError('Set BACKEND_TOKEN or BACKEND_USERNAME and BACKEND_PASSWORD')
        self.base_url = base_url.rstrip('/')
        self.username, self.password = username, password
        self.token, self.expires_at, self.timeout = token, float('inf'), timeout

    @classmethod
    def from_environment(cls):
        return cls(os.getenv('BACKEND_URL', 'http://localhost:3000'),
                   os.getenv('BACKEND_USERNAME', ''), os.getenv('BACKEND_PASSWORD', ''),
                   os.getenv('BACKEND_TOKEN', ''))

    def _request(self, method, path, body=None, authenticated=True):
        headers = {'Content-Type': 'application/json'}
        if authenticated:
            headers['Authorization'] = f'Bearer {self.token}'
        request = Request(self.base_url + path, method=method, headers=headers,
                          data=json.dumps(body).encode() if body is not None else None)
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return json.load(response)
        except HTTPError as error:
            try:
                message = json.loads(error.read()).get('message', 'Request failed')
            except (ValueError, AttributeError):
                message = 'Request failed'
            raise BackendError(error.code, message) from None
        except (URLError, TimeoutError, OSError):
            raise BackendError(0, 'Cannot reach server') from None
        except ValueError:
            raise BackendError(0, 'Invalid JSON response') from None

    def login(self):
        if not (self.username and self.password):
            raise BackendError(401, 'Set login credentials or replace BACKEND_TOKEN')
        result = self._request('POST', '/auth/login',
                               {'username': self.username, 'password': self.password}, False)
        if not isinstance(result, dict) or not isinstance(result.get('accessToken'), str):
            raise BackendError(0, 'Login response missing accessToken')
        self.token = result['accessToken']
        self.expires_at = time.monotonic() + float(result.get('expiresIn', 3600)) - 30

    def request(self, method, path, body=None):
        if not self.token or time.monotonic() >= self.expires_at:
            self.login()
        try:
            return self._request(method, path, body)
        except BackendError as error:
            if error.status != 401 or not (self.username and self.password):
                raise
            self.login()
            return self._request(method, path, body)

    def student_id(self, code):
        if not code.strip() or code.lower() == 'unknown':
            raise ValueError('Cannot report unknown student')
        result = self.request('GET', '/students/by-code?' + urlencode({'studentCode': code}))
        return positive_id(result['id'])

    def rooms(self):
        return self.request('GET', '/rooms')

    def create_event(self, payload):
        result = self.request('POST', '/room-events', payload)
        if not isinstance(result, dict) or 'event' not in result or type(result.get('duplicate')) is not bool:
            raise BackendError(0, 'Unexpected room-events response; event retained for retry')
        return result


def positive_id(value):
    if type(value) is not int or not 0 < value <= 9007199254740991:
        raise ValueError('Backend ID must be a positive safe integer')
    return value
