import json
import threading
import unittest
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

import server


ROOT = Path(__file__).resolve().parents[1]


class IdParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []

    def handle_starttag(self, tag, attrs):
        value = dict(attrs).get("id")
        if value:
            self.ids.append(value)


class PlatformSmokeTests(unittest.TestCase):
    def test_html_has_no_duplicate_ids(self):
        parser = IdParser()
        parser.feed((ROOT / "index.html").read_text(encoding="utf-8"))
        self.assertEqual(len(parser.ids), len(set(parser.ids)))

    def test_json_assets_are_valid(self):
        manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
        json.loads((ROOT / "data" / "news-data.json").read_text(encoding="utf-8"))
        for icon in manifest["icons"]:
            self.assertTrue((ROOT / icon["src"]).is_file(), icon["src"])

    def test_apple_icon_assets_exist(self):
        for name in (
            "assets/xingyu-app-icon-192.png",
            "assets/xingyu-app-icon-256.png",
            "assets/xingyu-app-icon-512.png",
            "xingyu-apple.ico",
        ):
            path = ROOT / name
            self.assertTrue(path.is_file(), name)
            self.assertGreater(path.stat().st_size, 1000, name)

    def test_health_endpoint_and_security_headers(self):
        httpd = server.create_server(0, str(ROOT))
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            port = httpd.server_address[1]
            with urllib.request.urlopen(
                f"http://127.0.0.1:{port}{server.HEALTH_PATH}", timeout=2
            ) as response:
                payload = json.loads(response.read().decode("utf-8"))
                self.assertEqual(payload["service"], "xingyu")
                self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
                self.assertEqual(response.headers["X-Frame-Options"], "SAMEORIGIN")
                self.assertIn("Content-Security-Policy", response.headers)
                self.assertIn("script-src", response.headers["Content-Security-Policy"])
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=2)

    def test_feedback_endpoint_writes(self):
        httpd = server.create_server(0, str(ROOT))
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        feedback_file = None
        thread.start()
        try:
            port = httpd.server_address[1]

            # 非法 payload → 400
            req = urllib.request.Request(
                f"http://127.0.0.1:{port}/api/feedback",
                data=b"not-json",
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with self.assertRaises(urllib.error.HTTPError) as ctx:
                urllib.request.urlopen(req, timeout=2)
            self.assertEqual(ctx.exception.code, 400)

            # 合法 payload → 200 且落盘
            payload = json.dumps({
                "type": "smoke-test",
                "message": "feedback endpoint works",
                "metrics": {"heapMB": 10}
            }).encode("utf-8")
            req = urllib.request.Request(
                f"http://127.0.0.1:{port}/api/feedback",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=2) as response:
                result = json.loads(response.read().decode("utf-8"))
                self.assertTrue(result["ok"])
                self.assertTrue(result["file"].startswith("report-"))
                feedback_file = ROOT / "data" / "feedback" / result["file"]
                self.assertTrue(feedback_file.is_file())
                saved = json.loads(feedback_file.read_text(encoding="utf-8"))
                self.assertEqual(saved["type"], "smoke-test")
        finally:
            if feedback_file and feedback_file.exists():
                feedback_file.unlink()
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=2)

    def test_backup_endpoint_writes_and_lists(self):
        httpd = server.create_server(0, str(ROOT))
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        backup_file = None
        thread.start()
        try:
            port = httpd.server_address[1]

            # 非法 payload → 400
            req = urllib.request.Request(
                f"http://127.0.0.1:{port}{server.BACKUP_PATH}",
                data=b"not-json",
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with self.assertRaises(urllib.error.HTTPError) as ctx:
                urllib.request.urlopen(req, timeout=2)
            self.assertEqual(ctx.exception.code, 400)

            # 合法快照 → 200 且落盘
            payload = json.dumps({
                "data": json.dumps({"schemaVersion": 3, "tasks": []}),
                "at": "2026-08-29T00:00:00Z"
            }).encode("utf-8")
            req = urllib.request.Request(
                f"http://127.0.0.1:{port}{server.BACKUP_PATH}",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=2) as response:
                result = json.loads(response.read().decode("utf-8"))
                self.assertTrue(result["ok"])
                self.assertGreaterEqual(result["count"], 1)
                backup_file = ROOT / "data" / "backups" / result["file"]
                self.assertTrue(backup_file.is_file())

            # 信息端点能看到刚才的备份
            with urllib.request.urlopen(
                f"http://127.0.0.1:{port}{server.BACKUP_INFO_PATH}", timeout=2
            ) as response:
                info = json.loads(response.read().decode("utf-8"))
                self.assertTrue(info["ok"])
                self.assertGreaterEqual(info["count"], 1)
                self.assertIsNotNone(info["lastFile"])
                self.assertTrue(info["lastFile"].startswith("backup-"))
        finally:
            if backup_file and backup_file.exists():
                backup_file.unlink()
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
