import copy
import os
import tempfile
import unittest
import threading
import urllib.request
import urllib.error
import http.client
import json
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

import platform_db as db
import server


class IncrementalSaveTests(unittest.TestCase):
    def test_failed_database_mirror_is_not_acknowledged(self):
        with tempfile.TemporaryDirectory() as folder, \
             patch.object(server, "DATA_DIR", folder), \
             patch.object(server, "STATE_PATH", os.path.join(folder, "state.json")), \
             patch.object(db, "import_snapshot", side_effect=OSError("disk unavailable")), \
             patch.object(server, "_send_json") as send:
            server._save_state(object(), json.dumps({"data": {"notes": []}}).encode())
            self.assertEqual(send.call_args.args[1], 503)
            self.assertFalse(send.call_args.args[2]["ok"])

    def test_bootstrap_uses_one_connection_and_keeps_collections(self):
        with tempfile.TemporaryDirectory() as folder:
            path = os.path.join(folder, "test.db")
            db.import_snapshot({
                "notes": [{"id": "one", "content": "note"}],
                "pomodoros": [{"id": "session", "minutes": 25}],
            }, db_path=path)
            with patch.object(db, "connect", wraps=db.connect) as connect:
                result = db.bootstrap(db_path=path)
                self.assertEqual(connect.call_count, 1)
            self.assertEqual(result["pomodoros"][0]["minutes"], 25)
            self.assertEqual(result["notes"], db.list_items("notes", db_path=path))

    def test_conditional_bootstrap_and_changed_representation(self):
        snapshot = {"schemaVersion": 4, "hasData": True, "notes": [{"id": "n", "content": "before"}]}
        httpd = server.create_server(0)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        conn = http.client.HTTPConnection("127.0.0.1", httpd.server_address[1], timeout=5)
        try:
            with patch.object(server, "_api_data_bootstrap", side_effect=lambda _: snapshot):
                conn.request("GET", "/api/data/bootstrap")
                response = conn.getresponse()
                self.assertEqual(response.status, 200)
                tag = response.getheader("ETag")
                self.assertTrue(tag)
                self.assertTrue(response.read())
                conn.request("GET", "/api/data/bootstrap", headers={"If-None-Match": tag})
                response = conn.getresponse()
                self.assertEqual(response.status, 304)
                self.assertEqual(response.read(), b"")
                # No timestamp change: hash must still change when a record is removed.
                snapshot["notes"] = []
                conn.request("GET", "/api/data/bootstrap", headers={"If-None-Match": tag})
                response = conn.getresponse()
                self.assertEqual(response.status, 200)
                self.assertNotEqual(response.getheader("ETag"), tag)
                response.read()
                with patch.object(server.XingyuHandler, "_authorized", return_value=False):
                    conn.request("GET", "/api/data/bootstrap", headers={"If-None-Match": tag})
                    response = conn.getresponse()
                    self.assertEqual(response.status, 401)
                    response.read()
        finally:
            conn.close()
            httpd.shutdown()
            httpd.server_close()

    def test_only_changed_rows_get_new_versions(self):
        with tempfile.TemporaryDirectory() as folder:
            path = os.path.join(folder, "test.db")
            state = {"profile": {"name": "test"}, "settings": {},
                     "notes": [{"id": str(i), "content": "text"} for i in range(1000)]}
            db.import_snapshot(state, db_path=path, prune_missing=True)
            db.import_snapshot(state, db_path=path, prune_missing=True)
            with db.connect(path) as conn:
                self.assertEqual(conn.execute("SELECT MAX(version) FROM records").fetchone()[0], 1)
                self.assertEqual(conn.execute("SELECT version FROM profile").fetchone()[0], 1)
            changed = copy.deepcopy(state)
            changed["notes"][10]["content"] = "edited"
            db.import_snapshot(changed, db_path=path, prune_missing=True)
            with db.connect(path) as conn:
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM records WHERE version=2").fetchone()[0], 1)
            db.import_snapshot({"notes": []}, db_path=path, prune_missing=True)
            self.assertEqual(db.list_items("notes", db_path=path), [])
            db.import_snapshot(state, db_path=path, prune_missing=True)
            self.assertEqual(len(db.list_items("notes", db_path=path)), 1000)

    def test_voice_startup_is_serialized(self):
        ready = [False]
        def start():
            ready[0] = True
            return True
        with patch.object(server, "_vox_health", side_effect=lambda: ready[0]), \
             patch("runpy.run_path", return_value={"start_vox_services": start}) as load:
            with ThreadPoolExecutor(max_workers=5) as pool:
                self.assertTrue(all(pool.map(lambda _: server._start_voice_on_demand(), range(5))))
            self.assertEqual(load.call_count, 1)

    def test_voice_start_requires_authorization(self):
        httpd = server.create_server(0)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        try:
            with patch.object(server.XingyuHandler, "_authorized", return_value=False), \
                 patch.object(server, "_start_voice_on_demand") as start:
                req = urllib.request.Request(
                    "http://127.0.0.1:%s/api/voice/start" % httpd.server_address[1],
                    data=b"", method="POST")
                with self.assertRaises(urllib.error.HTTPError) as result:
                    urllib.request.urlopen(req, timeout=3)
                self.assertEqual(result.exception.code, 401)
                result.exception.close()
                start.assert_not_called()
        finally:
            httpd.shutdown()
            httpd.server_close()

    def test_voice_start_failure_is_retryable(self):
        with patch.object(server, "_vox_health", return_value=False), \
             patch("runpy.run_path", side_effect=OSError("test failure")):
            self.assertFalse(server._start_voice_on_demand())
        with patch.object(server, "_vox_health", return_value=True):
            self.assertTrue(server._start_voice_on_demand())


if __name__ == "__main__":
    unittest.main()
