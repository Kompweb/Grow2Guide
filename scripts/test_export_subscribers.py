import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "export_subscribers", Path(__file__).with_name("export-subscribers.py")
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class ContactsToRows(unittest.TestCase):
    def test_header_and_rows(self):
        payload = {
            "data": [
                {"email": "a@b.co", "first_name": "Ann", "created_at": "2026-09-25", "unsubscribed": False},
                {"email": "c@d.co", "first_name": None, "created_at": "2026-09-26", "unsubscribed": True},
            ]
        }
        self.assertEqual(
            mod.contacts_to_rows(payload),
            [
                ["email", "first_name", "created_at", "unsubscribed"],
                ["a@b.co", "Ann", "2026-09-25", "false"],
                ["c@d.co", "", "2026-09-26", "true"],
            ],
        )

    def test_empty_or_missing_data(self):
        header = [["email", "first_name", "created_at", "unsubscribed"]]
        self.assertEqual(mod.contacts_to_rows({"data": []}), header)
        self.assertEqual(mod.contacts_to_rows({}), header)


if __name__ == "__main__":
    unittest.main()
