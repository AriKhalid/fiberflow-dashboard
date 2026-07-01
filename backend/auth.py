import os
import time
import logging
from logging.handlers import RotatingFileHandler
from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from fastapi import Request
from fastapi.responses import RedirectResponse, HTMLResponse

_BERLIN = ZoneInfo("Europe/Berlin")

# --- Logger ---
_LOG_PATH = os.path.join(os.path.dirname(__file__), "login.log")
_logger = logging.getLogger("dashboard.auth")
_logger.setLevel(logging.INFO)
_handler = RotatingFileHandler(_LOG_PATH, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
_handler.setFormatter(logging.Formatter("%(message)s"))
_logger.addHandler(_handler)

def _log(event: str, ip: str, country: str, username: str = ""):
    ts = datetime.now(_BERLIN).strftime("%Y-%m-%d %H:%M:%S")
    _logger.info(f"{ts} | {event:<20} | IP: {ip:<18} | Land: {country} | User: {username}")

# --- Konfiguration ---
USERNAME = os.environ["DASHBOARD_USER"]
PASSWORD = os.environ["DASHBOARD_PASS"]
SECRET_KEY = os.environ["DASHBOARD_SECRET"]
SESSION_HOURS = 8

# --- Rate Limiter (max 5 Versuche pro IP / 15 Min) ---
_attempts: dict = defaultdict(list)
MAX_ATTEMPTS = 5
WINDOW_SECONDS = 900  # 15 Minuten

def _is_rate_limited(ip: str) -> bool:
    now = time.time()
    _attempts[ip] = [t for t in _attempts[ip] if now - t < WINDOW_SECONDS]
    if len(_attempts[ip]) >= MAX_ATTEMPTS:
        return True
    _attempts[ip].append(now)
    return False

# --- Session ---
_serializer = URLSafeTimedSerializer(SECRET_KEY)

def create_session_cookie(response):
    token = _serializer.dumps("authenticated")
    response.set_cookie(
        key="gd_session",
        value=token,
        max_age=SESSION_HOURS * 3600,
        httponly=True,
        samesite="lax",
        secure=True,
    )

def is_authenticated(request: Request) -> bool:
    token = request.cookies.get("gd_session")
    if not token:
        return False
    try:
        _serializer.loads(token, max_age=SESSION_HOURS * 3600)
        return True
    except (BadSignature, SignatureExpired):
        return False

# --- IP-Herkunft prüfen (Cloudflare Header) ---
def get_country(request: Request) -> str:
    return request.headers.get("CF-IPCountry", "DE")

def is_allowed_country(request: Request) -> bool:
    return get_country(request) == "DE"

# --- Login-Seite HTML ---
def login_page(error: str = "") -> HTMLResponse:
    error_html = f'<p class="error">{error}</p>' if error else ""
    html = f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FiberFlow – Login</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #0f172a;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }}
  .card {{
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 40px;
    width: 100%;
    max-width: 380px;
    box-shadow: 0 25px 50px rgba(0,0,0,0.4);
  }}
  .logo {{
    text-align: center;
    margin-bottom: 28px;
  }}
  .logo h1 {{
    color: #f1f5f9;
    font-size: 1.4rem;
    font-weight: 600;
  }}
  .logo p {{
    color: #64748b;
    font-size: 0.85rem;
    margin-top: 4px;
  }}
  label {{
    display: block;
    color: #94a3b8;
    font-size: 0.8rem;
    font-weight: 500;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }}
  input {{
    width: 100%;
    padding: 10px 14px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    color: #f1f5f9;
    font-size: 0.95rem;
    margin-bottom: 16px;
    outline: none;
    transition: border-color 0.2s;
  }}
  input:focus {{ border-color: #3b82f6; }}
  button {{
    width: 100%;
    padding: 11px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    margin-top: 4px;
  }}
  button:hover {{ background: #2563eb; }}
  .error {{
    background: #450a0a;
    border: 1px solid #991b1b;
    color: #fca5a5;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 0.85rem;
    margin-bottom: 16px;
    text-align: center;
  }}
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <h1>FiberFlow</h1>
    <p>Dashboard – Bitte anmelden</p>
  </div>
  {error_html}
  <form method="post" action="/login">
    <label>Benutzername</label>
    <input type="text" name="username" autocomplete="username" required autofocus>
    <label>Passwort</label>
    <input type="password" name="password" autocomplete="current-password" required>
    <button type="submit">Anmelden</button>
  </form>
</div>
</body>
</html>"""
    return HTMLResponse(html)
