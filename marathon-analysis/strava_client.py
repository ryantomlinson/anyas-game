"""
Strava API client for fetching running activity data.

Usage:
    1. Create a Strava API app at https://www.strava.com/settings/api
    2. Set Authorization Callback Domain to "localhost"
    3. Run this script with your Client ID and Client Secret
    4. It will open a browser for OAuth and then fetch your data
"""

import http.server
import json
import os
import sys
import threading
import time
import urllib.parse
import webbrowser

import requests

STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize"
STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token"
STRAVA_API_BASE = "https://www.strava.com/api/v3"
REDIRECT_PORT = 8642
REDIRECT_URI = f"http://localhost:{REDIRECT_PORT}/callback"
TOKEN_FILE = os.path.join(os.path.dirname(__file__), ".strava_token.json")


def save_token(token_data):
    with open(TOKEN_FILE, "w") as f:
        json.dump(token_data, f, indent=2)


def load_token():
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r") as f:
            return json.load(f)
    return None


def refresh_access_token(client_id, client_secret, refresh_token):
    resp = requests.post(STRAVA_TOKEN_URL, data={
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    })
    resp.raise_for_status()
    token_data = resp.json()
    save_token(token_data)
    return token_data["access_token"]


def get_access_token(client_id, client_secret):
    """Get a valid access token, refreshing or re-authorizing as needed."""
    token_data = load_token()

    if token_data:
        if token_data.get("expires_at", 0) > time.time() + 60:
            return token_data["access_token"]
        if token_data.get("refresh_token"):
            print("Refreshing expired token...")
            return refresh_access_token(
                client_id, client_secret, token_data["refresh_token"]
            )

    # Need full OAuth flow
    return authorize_via_browser(client_id, client_secret)


def authorize_via_browser(client_id, client_secret):
    """Run the OAuth browser flow to get initial authorization."""
    auth_code = [None]
    server_ready = threading.Event()

    class CallbackHandler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            if "code" in params:
                auth_code[0] = params["code"][0]
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(
                    b"<html><body><h2>Authorization successful!</h2>"
                    b"<p>You can close this tab and return to the terminal.</p>"
                    b"</body></html>"
                )
            else:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Authorization failed.")

        def log_message(self, format, *args):
            pass  # Suppress request logging

    server = http.server.HTTPServer(("localhost", REDIRECT_PORT), CallbackHandler)

    def run_server():
        server_ready.set()
        server.handle_request()

    thread = threading.Thread(target=run_server, daemon=True)
    thread.start()
    server_ready.wait()

    auth_url = (
        f"{STRAVA_AUTH_URL}?"
        f"client_id={client_id}&"
        f"redirect_uri={urllib.parse.quote(REDIRECT_URI)}&"
        f"response_type=code&"
        f"scope=activity:read_all"
    )

    print(f"\nOpening browser for Strava authorization...")
    print(f"If it doesn't open automatically, visit:\n{auth_url}\n")
    webbrowser.open(auth_url)

    thread.join(timeout=120)
    server.server_close()

    if not auth_code[0]:
        print("ERROR: Did not receive authorization code within 2 minutes.")
        sys.exit(1)

    # Exchange code for token
    resp = requests.post(STRAVA_TOKEN_URL, data={
        "client_id": client_id,
        "client_secret": client_secret,
        "code": auth_code[0],
        "grant_type": "authorization_code",
    })
    resp.raise_for_status()
    token_data = resp.json()
    save_token(token_data)
    print("Authorization successful! Token saved.\n")
    return token_data["access_token"]


def fetch_all_activities(access_token, activity_type="Run"):
    """Fetch all activities of the given type from Strava."""
    headers = {"Authorization": f"Bearer {access_token}"}
    all_activities = []
    page = 1
    per_page = 100

    while True:
        print(f"  Fetching activities page {page}...")
        resp = requests.get(
            f"{STRAVA_API_BASE}/athlete/activities",
            headers=headers,
            params={"page": page, "per_page": per_page},
        )
        resp.raise_for_status()
        activities = resp.json()

        if not activities:
            break

        for act in activities:
            if act.get("type") == activity_type:
                all_activities.append(act)

        if len(activities) < per_page:
            break
        page += 1

    return all_activities


def fetch_athlete_profile(access_token):
    """Fetch the authenticated athlete's profile."""
    headers = {"Authorization": f"Bearer {access_token}"}
    resp = requests.get(f"{STRAVA_API_BASE}/athlete", headers=headers)
    resp.raise_for_status()
    return resp.json()
