import json
import threading
import unittest
import tempfile
import subprocess
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

    def test_sensitive_local_files_are_not_tracked(self):
        for name in ("js/local-config.js", "data/ai-key-local.txt"):
            out = subprocess.check_output(
                ["git", "ls-files", "--", name], cwd=ROOT, text=True
            ).strip()
            self.assertEqual(out, "", f"{name} must stay untracked")

    def test_tracked_text_files_have_no_obvious_api_keys(self):
        out = subprocess.check_output(
            ["git", "ls-files", "-z"], cwd=ROOT
        ).decode("utf-8")
        extensions = {".js", ".html", ".css", ".json", ".py", ".md", ".yml", ".yaml", ".txt", ".webmanifest"}
        for raw in out.split("\0"):
            if not raw:
                continue
            path = Path(raw)
            if path.suffix.lower() not in extensions:
                continue
            target = ROOT / path
            if not target.is_file() or target.stat().st_size > 2 * 1024 * 1024:
                continue
            text = target.read_text(encoding="utf-8", errors="ignore")
            for pattern in (r"sk-[A-Za-z0-9]{20,}", r"AKIA[0-9A-Z]{16}"):
                self.assertNotRegex(text, pattern, f"suspicious key in {raw}")

    def test_srs_is_wired(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        sw = (ROOT / "sw.js").read_text(encoding="utf-8")
        self.assertIn("js/srs.js", html)
        self.assertIn("./js/srs.js", sw)

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
                # 主应用不需要 AIRI 的 unsafe-eval；该策略只应出现在 /airi/ 路由。
                self.assertNotIn("'unsafe-eval'", response.headers["Content-Security-Policy"])
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=2)

    def test_feedback_endpoint_writes(self):
        feedback_dir = tempfile.TemporaryDirectory()
        self.addCleanup(feedback_dir.cleanup)
        original_feedback_dir = server.FEEDBACK_DIR
        server.FEEDBACK_DIR = feedback_dir.name
        self.addCleanup(setattr, server, "FEEDBACK_DIR", original_feedback_dir)

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
                feedback_file = Path(server.FEEDBACK_DIR) / result["file"]
                self.assertTrue(feedback_file.is_file())
                saved = json.loads(feedback_file.read_text(encoding="utf-8"))
                self.assertEqual(saved["type"], "smoke-test")
        finally:
            if feedback_file and feedback_file.exists():
                feedback_file.unlink()
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=2)

    def test_remote_head_and_sensitive_writes_require_auth(self):
        httpd = server.create_server(0, str(ROOT))
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        original_loopback = server.XingyuHandler._is_loopback_client

        def deny_loopback(handler):
            return False

        server.XingyuHandler._is_loopback_client = deny_loopback
        try:
            port = httpd.server_address[1]
            cases = [
                ("HEAD", "/", None),
                ("HEAD", "/data/ai-key-local.txt", None),
                ("POST", "/api/feedback", b"{}"),
                ("POST", server.BACKUP_PATH, b"{}"),
            ]
            for method, path, data in cases:
                req = urllib.request.Request(
                    f"http://127.0.0.1:{port}{path}",
                    data=data,
                    headers={"Content-Type": "application/json"} if data else {},
                    method=method,
                )
                with self.assertRaises(urllib.error.HTTPError, msg=f"{method} {path}") as ctx:
                    urllib.request.urlopen(req, timeout=2)
                self.assertEqual(ctx.exception.code, 401, f"{method} {path}")
        finally:
            server.XingyuHandler._is_loopback_client = original_loopback
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=2)

    def test_remote_local_config_is_sanitized(self):
        httpd = server.create_server(0, str(ROOT))
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        original_loopback = server.XingyuHandler._is_loopback_client

        def deny_loopback(handler):
            return False

        server.XingyuHandler._is_loopback_client = deny_loopback
        try:
            port = httpd.server_address[1]
            headers = {"X-Xingyu-Access": server.ACCESS_TOKEN}
            req = urllib.request.Request(
                f"http://127.0.0.1:{port}/js/local-config.js",
                headers=headers,
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=2) as response:
                text = response.read().decode("utf-8")
                self.assertEqual(response.status, 200)
            self.assertIn("useLocalAiProxy:true", text)
            self.assertNotIn("sk-", text)

            req = urllib.request.Request(
                f"http://127.0.0.1:{port}/js/local-config.js",
                headers=headers,
                method="HEAD",
            )
            with urllib.request.urlopen(req, timeout=2) as response:
                self.assertEqual(response.status, 200)
        finally:
            server.XingyuHandler._is_loopback_client = original_loopback
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=2)

    def test_backup_endpoint_writes_and_lists(self):
        backup_dir = tempfile.TemporaryDirectory()
        self.addCleanup(backup_dir.cleanup)
        original_backup_dir = server.BACKUP_DIR
        server.BACKUP_DIR = backup_dir.name
        self.addCleanup(setattr, server, "BACKUP_DIR", original_backup_dir)

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
                backup_file = Path(server.BACKUP_DIR) / result["file"]
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
