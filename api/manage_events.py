from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import base64
from datetime import datetime

def _not_expired(ev, now_ts):
    try:
        d = datetime.strptime(ev["date"], "%Y-%m-%d")
        d = d.replace(hour=13, minute=30, second=0, microsecond=0)
        return d.timestamp() > now_ts
    except (KeyError, ValueError, TypeError):
        return True

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        body = json.loads(post_data)

        if body.get("password") != os.environ.get("ADMIN_PASSWORD"):
            self.send_response(401)
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Unauthorized: Incorrect password."}).encode())
            return

        token = os.environ.get("GITHUB_TOKEN")
        repo = os.environ.get("GITHUB_REPO")
        url = f"https://api.github.com/repos/{repo}/contents/data.json"

        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "KTU-Timetable-Admin"
        }

        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as response:
                file_data = json.loads(response.read().decode())

            content_str = base64.b64decode(file_data["content"]).decode('utf-8')
            data = json.loads(content_str)

            if "EVENTS" not in data:
                data["EVENTS"] = []
            if "HOLIDAYS" not in data:
                data["HOLIDAYS"] = []

            # Remove expired events (past 1:30 PM on their date)
            now = datetime.now().timestamp()
            data["EVENTS"] = [ev for ev in data["EVENTS"] if _not_expired(ev, now)]

            action = body.get("action")
            commit_message = "Admin UI: Updated"

            if action == "verify":
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode())
                return

            if action == "add":
                new_events = body.get("events", [])
                data["EVENTS"].extend(new_events)
                commit_message = f"Admin UI: Added {len(new_events)} event(s)"

            elif action == "delete":
                target_title = body.get("targetTitle")
                target_date = body.get("targetDate")
                data["EVENTS"] = [ev for ev in data["EVENTS"] if not (ev.get("title") == target_title and ev.get("date") == target_date)]
                commit_message = f"Admin UI: Deleted event '{target_title}'"

            elif action == "delete_series":
                target_title = body.get("targetTitle")
                data["EVENTS"] = [ev for ev in data["EVENTS"] if ev.get("title") != target_title]
                commit_message = f"Admin UI: Deleted series '{target_title}'"

            elif action == "add_holiday":
                date = body.get("holidayDate")
                if date and date not in data["HOLIDAYS"]:
                    data["HOLIDAYS"].append(date)
                commit_message = f"Admin UI: Added holiday {date}"

            elif action == "remove_holiday":
                date = body.get("holidayDate")
                data["HOLIDAYS"] = [d for d in data["HOLIDAYS"] if d != date]
                commit_message = f"Admin UI: Removed holiday {date}"

            new_content = base64.b64encode(json.dumps(data, indent=2, ensure_ascii=False).encode('utf-8')).decode('utf-8')
            put_data = json.dumps({
                "message": commit_message,
                "content": new_content,
                "sha": file_data["sha"]
            }).encode('utf-8')

            put_req = urllib.request.Request(url, data=put_data, headers=headers, method="PUT")
            with urllib.request.urlopen(put_req) as put_response:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode())

        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Failed to modify repository: {str(e)}"}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
