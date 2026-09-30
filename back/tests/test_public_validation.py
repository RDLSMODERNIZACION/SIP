import os
import unittest
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "postgresql://unused:unused@localhost/unused")
from fastapi import HTTPException, Request, Response
from app.routers import public
from app.services import pdf_service, qr_service
from app.services.public_validation import public_validation_url


class PublicValidationTests(unittest.TestCase):
    def request(self, accept):
        return Request({"type": "http", "headers": [(b"accept", accept.encode())]})

    def test_old_qr_browser_redirects_without_database_query(self):
        with patch.object(public, "fetch_one") as fetch:
            result = public.validate_certificate("sip-test", self.request("text/html,*/*;q=0.8"), Response())
        self.assertEqual(result.status_code, 307)
        self.assertEqual(result.headers["location"], public_validation_url("sip-test"))
        self.assertEqual(result.headers["vary"], "Accept")
        fetch.assert_not_called()

    def test_api_keeps_json(self):
        cert = dict.fromkeys(["id", "certificate_number", "client_name", "client_cuit",
            "element", "brand", "serial_number", "calibration_date", "expiration_date",
            "trial_result", "approved_result", "pdf_url", "qr_url", "validation_hash"])
        cert.update(status="approved", visible_status="vigente", certificate_number="SIP TEST")
        for accept in ("application/json", "*/*", ""):
            with self.subTest(accept=accept), patch.object(public, "fetch_one", return_value=cert), patch.object(public, "fetch_all", return_value=[]), patch.object(public, "execute"):
                response = Response()
                result = public.validate_certificate("sip-test", self.request(accept), response)
                self.assertTrue(result["valid"])
                self.assertEqual(result["certificate_number"], "SIP TEST")
                self.assertEqual(response.headers["vary"], "Accept")

    def test_unknown_hash_returns_404(self):
        with patch.object(public, "fetch_one", return_value=None):
            with self.assertRaises(HTTPException) as error:
                public.validate_certificate("unknown", self.request("application/json"), Response())
        self.assertEqual(error.exception.status_code, 404)

    def test_regenerated_pdf_replaces_legacy_api_url(self):
        self.assertEqual(pdf_service._validation_payload({
            "validation_hash": "sip-test",
            "public_validation_url": "https://old.example/public/validate/sip-test",
        }), public_validation_url("sip-test"))

    def test_standalone_qr_uses_public_page(self):
        with patch.object(qr_service, "get_certificate_or_404", return_value={"validation_hash": "sip-test"}), patch.object(qr_service.qrcode, "make") as make, patch.object(qr_service, "execute"):
            qr_service.generate_qr("test", {"id": "user-test"})
        make.assert_called_once_with(public_validation_url("sip-test"))
        self.assertIn("/validar/sip-test", public_validation_url("sip-test"))
