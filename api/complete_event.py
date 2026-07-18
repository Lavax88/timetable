from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import base64

FILE_NAME = "events.json"

# Types that students are allowed to self-delete by completing them.
COMPLETABLE_TYPES = {"deadline", "reminder"}

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)

        try:
            body = json.loads(post_data)
        except (json.JSONDecodeError, ValueError):
            self.send_response(400)
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Invalid JSON."}).encode())
            return

        target_title = body.get("title", "").strip()
        target_date  = body.get("date", "").strip()

        if not target_title or not target_date:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Missing title or date."}).encode())
            return

        token = os.environ.get("GITHUB_TOKEN")
        repo  = os.environ.get("GITHUB_REPO")
        url   = f"https://api.github.com/repos/{repo}/contents/{FILE_NAME}"

        gh_headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "KTU-Timetable-Student"
        }

        try:
            req = urllib.request.Request(url, headers=gh_headers)
            with urllib.request.urlopen(req) as response:
                file_data = json.loads(response.read().decode())

            content_str = base64.b64decode(file_data["content"]).decode("utf-8")
            data = json.loads(content_str)

            if "EVENTS" not in data:
                data["EVENTS"] = []

            # Only remove events that are completable types — safety guard
            before = len(data["EVENTS"])
            data["EVENTS"] = [
                ev for ev in data["EVENTS"]
                if not (
                    ev.get("title") == target_title
                    and ev.get("date") == target_date
                    and ev.get("type", "") in COMPLETABLE_TYPES
                )
            ]
            removed = before - len(data["EVENTS"])

            if removed == 0:
                # Nothing to delete (already gone, or type not completable) — still 200
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "removed": 0}).encode())
                return

            new_content = base64.b64encode(
                json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8")
            ).decode("utf-8")

            put_body = json.dumps({
                "message": f"Student: Completed '{target_title}' on {target_date}",
                "content": new_content,
                "sha": file_data["sha"]
            }).encode("utf-8")

            put_req = urllib.request.Request(url, data=put_body, headers=gh_headers, method="PUT")
            with urllib.request.urlopen(put_req):
                pass

            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "removed": removed}).encode())

        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
