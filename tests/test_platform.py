import json
import threading
import unittest
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
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
