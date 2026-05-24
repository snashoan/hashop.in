import asyncio
import sys
import tempfile
import unittest
from pathlib import Path

from aiohttp import web


TOOLS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS_DIR))

from hashop_hub import HashopHub, ShopStore  # noqa: E402


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
        self.assertTrue(asyncio.run(self.store.buyer_account_exists("buyer@example.com")))

    def test_buyer_contact_validation_rejects_fake_numbers(self) -> None:
        self.assertEqual(self.store._normalize_account_contact_key("123456"), "")
        self.assertEqual(self.store._normalize_account_contact_key("1111111111"), "")
        self.assertEqual(self.store._normalize_account_contact_key("1234567890"), "")
        self.assertEqual(self.store._normalize_account_contact_key("buyer@example"), "")
        self.assertEqual(self.store._normalize_account_contact_key("Buyer@Example.com"), "email:buyer@example.com")
        self.assertEqual(self.store._normalize_account_contact_key("+91 99887 76655"), "phone:9988776655")

        account = asyncio.run(
            self.store.create_buyer_account(
                display_name="Fake",
                contact="123456",
                password="secret1",
                buyer_key="buyer-fake",
            )
        )

        self.assertIsNone(account)

    def test_console_normalization_keeps_payment_qr_and_fulfillment(self) -> None:
        console = self.store._normalize_console(
            "demo-shop",
            "Demo Shop",
            "https://hashop.test/demo-shop",
            {
                "payments": [
                    {
                        "id": "upi-demo",
                        "label": "UPI",
                        "upiId": "demo@upi",
                        "qrFile": "demo-payment-qr.png",
                    }
                ],
                "orders": [
                    {
                        "id": "ord-demo",
                        "title": "Coca-Cola 750 ml",
                        "address": "Walk-in",
                        "paymentLabel": "Walk-in",
                        "items": [
                            {
                                "id": "coke",
                                "title": "Coca-Cola 750 ml",
                                "quantity": 2,
                                "price": "45",
                                "image": "coke.png",
                            }
                        ],
                    }
                ],
            },
        )

        self.assertEqual(console["payments"][0]["qrFile"], "demo-payment-qr.png")
        self.assertEqual(console["orders"][0]["fulfillmentMode"], "pickup")
        self.assertEqual(console["orders"][0]["items"][0]["image"], "coke.png")

    def test_order_email_includes_product_picture_links_and_html_images(self) -> None:
        hub = HashopHub(
            public_base_url="https://hashop.test",
            request_timeout=30,
            site_dir=Path(self.temp_dir.name),
            store=self.store,
            uploads_dir=Path(self.temp_dir.name) / "uploads",
        )
        order = {
            "title": "Coca-Cola 750 ml",
            "total": "90",
            "buyerName": "Buyer90",
            "fulfillmentMode": "delivery",
            "deliveryAddress": "Main Road",
            "items": [
                {
                    "title": "Coca-Cola 750 ml",
                    "quantity": 2,
                    "price": "45",
                    "description": "Cold drink bottle",
                    "image": "coke.png",
                }
            ],
        }

        text_body = hub._order_email_body(order, "seller", "Demo Shop")
        html_body = hub._order_email_html(order, "seller", "Demo Shop")

        self.assertIn("Product pictures:", text_body)
        self.assertIn("https://hashop.test/api/assets/coke.png", text_body)
        self.assertIn('<img src="https://hashop.test/api/assets/coke.png"', html_body)

    def test_discovery_shop_page_serves_owner_sales_history_route(self) -> None:
        class FakeRequest:
            match_info = {
                "shop_id": "demo-shop",
                "tail": "history/sales",
            }

        hub = HashopHub(
            public_base_url="https://hashop.test",
            request_timeout=30,
            site_dir=Path(self.temp_dir.name),
            store=self.store,
            uploads_dir=Path(self.temp_dir.name) / "uploads",
        )

        response = asyncio.run(hub.handle_discovery_shop_page(FakeRequest()))

        self.assertEqual(response.status, 200)

    def test_discovery_shop_page_rejects_unknown_nested_routes(self) -> None:
        class FakeRequest:
            match_info = {
                "shop_id": "demo-shop",
                "tail": "history/sales/deep",
            }

        hub = HashopHub(
            public_base_url="https://hashop.test",
            request_timeout=30,
            site_dir=Path(self.temp_dir.name),
            store=self.store,
            uploads_dir=Path(self.temp_dir.name) / "uploads",
        )

        with self.assertRaises(web.HTTPNotFound):
            asyncio.run(hub.handle_discovery_shop_page(FakeRequest()))


if __name__ == "__main__":
    unittest.main()
