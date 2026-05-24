import asyncio
import sys
import tempfile
import unittest
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS_DIR))

from hashop_hub import ShopStore  # noqa: E402


class AuthGuardrailTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store = ShopStore(Path(self.temp_dir.name) / "hashop-test.sqlite3")
        asyncio.run(self.store.initialize())

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def record_attempt(
        self,
        scope: str,
        contact: str,
        client_key: str = "203.0.113.10",
        contact_limit: int = 2,
        client_limit: int = 10,
        window_seconds: int = 3600,
    ):
        return asyncio.run(
            self.store.record_account_auth_attempt(
                scope=scope,
                contact=contact,
                client_key=client_key,
                contact_limit=contact_limit,
                client_limit=client_limit,
                window_seconds=window_seconds,
            )
        )

    def test_contact_guard_blocks_repeated_signup_attempts(self) -> None:
        self.assertTrue(self.record_attempt("buyer_signup", "buyer@example.com")["ok"])
        self.assertTrue(self.record_attempt("buyer_signup", "BUYER@example.com")["ok"])

        blocked = self.record_attempt("buyer_signup", "buyer@example.com")

        self.assertFalse(blocked["ok"])
        self.assertEqual(blocked["error"], "auth_rate_limited")
        self.assertEqual(blocked["limit"], "contact")
        self.assertGreaterEqual(blocked["retry_after"], 1)

    def test_guard_scopes_are_independent(self) -> None:
        self.assertTrue(self.record_attempt("buyer_signup", "buyer@example.com")["ok"])
        self.assertTrue(self.record_attempt("buyer_signup", "buyer@example.com")["ok"])

        login_attempt = self.record_attempt("buyer_login", "buyer@example.com")

        self.assertTrue(login_attempt["ok"])

    def test_client_guard_blocks_many_contacts_from_same_client(self) -> None:
        self.assertTrue(
            self.record_attempt(
                "buyer_contact_verification",
                "first@example.com",
                client_limit=2,
            )["ok"]
        )
        self.assertTrue(
            self.record_attempt(
                "buyer_contact_verification",
                "second@example.com",
                client_limit=2,
            )["ok"]
        )

        blocked = self.record_attempt(
            "buyer_contact_verification",
            "third@example.com",
            client_limit=2,
        )

        self.assertFalse(blocked["ok"])
        self.assertEqual(blocked["limit"], "client")

    def test_duplicate_buyer_accounts_are_rejected_by_contact_key(self) -> None:
        first = asyncio.run(
            self.store.create_buyer_account(
                display_name="Buyer",
                contact="Buyer@Example.com",
                password="secret1",
                buyer_key="buyer-test",
            )
        )
        duplicate = asyncio.run(
            self.store.create_buyer_account(
                display_name="Buyer Two",
                contact="buyer@example.com",
                password="secret1",
                buyer_key="buyer-test-two",
            )
        )

        self.assertIsNotNone(first)
        self.assertIsNone(duplicate)


if __name__ == "__main__":
    unittest.main()
