import os
import tempfile
import unittest
import platform_db as db


class DeltaSyncTests(unittest.TestCase):
    def test_changes_include_singletons_and_deletions(self):
        with tempfile.TemporaryDirectory() as folder:
            path = os.path.join(folder, "delta.db")
            db.import_snapshot({
                "profile": {"name": "A"},
                "notes": [{"id": "n1", "content": "one"}, {"id": "n2", "content": "two"}],
            }, db_path=path)
            first = db.state_info(path)["updatedAt"]
            db.set_profile({"name": "B"}, db_path=path)
            db.delete_item("notes", "n1", db_path=path)
            changes = db.changes_since(first, db_path=path)
            self.assertEqual(
                {(x["entity"], x["id"]) for x in changes},
                {("profile", "1"), ("notes", "n1")},
            )
            deleted = next(x for x in changes if x["id"] == "n1")
            self.assertIsNotNone(deleted["deletedAt"])


if __name__ == "__main__":
    unittest.main()
