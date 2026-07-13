import http.server
import json
import os
import urllib.parse
from datetime import datetime

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE, "data.json")
LOCAL_EVENTS_FILE = os.path.join(BASE, "events_local.json")
LOCAL_HOLIDAYS_FILE = os.path.join(BASE, "holidays_local.json")
LOCAL_SETTINGS_FILE = os.path.join(BASE, "settings_local.json")

def load_original_data():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def load_json(path):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

def filter_expired_events(events):
    now = datetime.now()
    cutoff = now.timestamp()
    alive = []
    for ev in events:
        try:
            d = datetime.strptime(ev["date"], "%Y-%m-%d")
            d = d.replace(hour=13, minute=30, second=0, microsecond=0)
            if d.timestamp() > cutoff:
                alive.append(ev)
        except (KeyError, ValueError, TypeError):
            alive.append(ev)
    return alive

class LocalHandler(http.server.SimpleHTTPRequestHandler):
    directory = BASE

    def do_GET(self):
        clean_path = urllib.parse.urlparse(self.path).path
        if clean_path == "/data.json" or clean_path == "/api/data":
            self.serve_merged_data()
        elif clean_path == "/api/events":
            self.serve_events()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == "/api/manage_events":
            self.handle_manage_events()
        else:
            self.send_error(404)

    def serve_merged_data(self):
        data = load_original_data()
        local_events = filter_expired_events(load_json(LOCAL_EVENTS_FILE) or [])
        local_holidays = load_json(LOCAL_HOLIDAYS_FILE) or []
        local_settings = load_json(LOCAL_SETTINGS_FILE) or {}
        data["EVENTS"] = local_events
        data["HOLIDAYS"] = local_holidays
        data["SETTINGS"] = local_settings
        body = json.dumps(data, indent=2, ensure_ascii=False)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode("utf-8"))

    def serve_events(self):
        local_events = filter_expired_events(load_json(LOCAL_EVENTS_FILE) or [])
        local_holidays = load_json(LOCAL_HOLIDAYS_FILE) or []
        local_settings = load_json(LOCAL_SETTINGS_FILE) or {}
        body = json.dumps({"EVENTS": local_events, "HOLIDAYS": local_holidays, "SETTINGS": local_settings}, indent=2, ensure_ascii=False)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode("utf-8"))

    def handle_manage_events(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length))

        password = body.get("password", "")
        admin_pwd = os.environ.get("ADMIN_PASSWORD", "")
        if admin_pwd and password != admin_pwd:
            self.send_json({"error": "Unauthorized"}, 401)
            return

        try:
            action = body.get("action")

            if action == "verify":
                self.send_json({"success": True})
                return

            if action == "add":
                events = filter_expired_events(load_json(LOCAL_EVENTS_FILE) or [])
                events.extend(body.get("events", []))
                save_json(LOCAL_EVENTS_FILE, events)

            elif action == "delete":
                events = filter_expired_events(load_json(LOCAL_EVENTS_FILE) or [])
                target_title = body.get("targetTitle")
                target_date = body.get("targetDate")
                events = [ev for ev in events
                          if not (ev.get("title") == target_title and ev.get("date") == target_date)]
                save_json(LOCAL_EVENTS_FILE, events)

            elif action == "delete_series":
                events = filter_expired_events(load_json(LOCAL_EVENTS_FILE) or [])
                target_title = body.get("targetTitle")
                events = [ev for ev in events if ev.get("title") != target_title]
                save_json(LOCAL_EVENTS_FILE, events)

            elif action == "add_holiday":
                holidays = load_json(LOCAL_HOLIDAYS_FILE) or []
                date = body.get("holidayDate")
                if date and date not in holidays:
                    holidays.append(date)
                save_json(LOCAL_HOLIDAYS_FILE, holidays)

            elif action == "remove_holiday":
                holidays = load_json(LOCAL_HOLIDAYS_FILE) or []
                date = body.get("holidayDate")
                holidays = [d for d in holidays if d != date]
                save_json(LOCAL_HOLIDAYS_FILE, holidays)

            elif action == "update_settings":
                settings = load_json(LOCAL_SETTINGS_FILE) or {}
                settings.update(body.get("settings", {}))
                save_json(LOCAL_SETTINGS_FILE, settings)

            elif action == "clear_all":
                save_json(LOCAL_EVENTS_FILE, [])

            self.send_json({"success": True})
        except Exception as e:
            self.send_json({"error": str(e)}, 500)

    def send_json(self, obj, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(obj).encode())

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    server = http.server.HTTPServer(("0.0.0.0", port), LocalHandler)
    print(f"Server running at http://localhost:{port}", flush=True)
    print("Press Ctrl+C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
