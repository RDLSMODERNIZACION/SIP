"""Run with: python -m unittest discover -s tests -v (from back/)."""
import os
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import MagicMock, patch

os.environ.setdefault("DATABASE_URL", "postgresql://unused:unused@localhost/unused")

from app.models import CertificateCreate, CertificateUpdate
from app.services import certificate_service as service
from app.services import pdf_service


CLIENT_ID = "11111111-1111-1111-1111-111111111111"
USER = {"id": CLIENT_ID, "role_code": "admin"}


class CertificateFrequencyTests(unittest.TestCase):
    def test_selected_frequency_survives_client_defaults(self):
        for md in (False, True):
            for requirement in (None, {"frequency_months": 12}, {"frequency_months": 3}):
                for frequency in (1, 6, 12, 24):
                    with self.subTest(md=md, requirement=requirement, frequency=frequency):
                        with patch.object(service, "is_md_client", return_value=md), patch.object(
                            service, "get_client_template_requirement", return_value=requirement
                        ):
                            data = service.apply_client_requirements({
                                "client_id": CLIENT_ID,
                                "test_frequency_months": frequency,
                                "expiration_date": date(2027, 3, 18),
                            })
                        self.assertEqual(data["test_frequency_months"], frequency)
                        self.assertEqual(data["expiration_date"], date(2027, 3, 18))
                        self.assertEqual(data["md_required"], md or requirement is not None)

    def test_missing_frequency_uses_default(self):
        for requirement, expected in ((None, 12), ({"frequency_months": 6}, 6)):
            for supplied in ({}, {"test_frequency_months": None}):
                with self.subTest(requirement=requirement, supplied=supplied):
                    with patch.object(service, "is_md_client", return_value=True), patch.object(
                        service, "get_client_template_requirement", return_value=requirement
                    ):
                        data = service.apply_client_requirements(dict(supplied))
                    self.assertEqual(data["test_frequency_months"], expected)

    def test_create_and_edit_save_selected_frequency_and_expiration(self):
        payload = dict(
            certificate_number="SIP 26-999", client_id=CLIENT_ID,
            template_type="general_pressure", test_frequency_months=6,
            calibration_date=date(2026, 9, 18), expiration_date=date(2027, 3, 18),
            test_rows=[{"row_order": 1, "pressure_label": "Prueba", "range_value": 1.05, "unit": "KG"}],
            metrology_results=[{"row_order": 1, "point_label": "Punto 1", "pattern_pressure": 1.05, "instrument_reading": 1, "unit": "KG"}],
        )
        for operation in ("create", "update"):
            with self.subTest(operation=operation):
                cursor = MagicMock()
                cursor.fetchone.return_value = {"id": CLIENT_ID}
                conn = MagicMock()
                conn.__enter__.return_value.cursor.return_value.__enter__.return_value = cursor
                with patch.object(service, "get_conn", return_value=conn), patch.object(
                    service, "is_md_client", return_value=True
                ), patch.object(service, "get_client_template_requirement", return_value={"frequency_months": 12}), patch.object(
                    service, "certificate_detail", return_value={}
                ), patch.object(service, "ensure_pattern_usage_tx"):
                    if operation == "create":
                        with patch.object(service, "snapshot_client_and_equipment", return_value=({"name": "MD"}, None)), patch.object(
                            service, "fetch_one", side_effect=[None, {"h": "test-hash"}]
                        ):
                            service.create_certificate(CertificateCreate(**payload), USER)
                    else:
                        with patch.object(service, "get_certificate_or_404", return_value={
                            **payload, "status": "draft", "test_frequency_months": 12,
                        }):
                            service.update_certificate(CLIENT_ID, CertificateUpdate(**payload), USER)
                sql, values = cursor.execute.call_args_list[0].args
                if operation == "create":
                    columns = sql.split("(", 1)[1].split(")", 1)[0].split(",")
                else:
                    columns = [item.strip().split("=")[0] for item in sql.split(" set ")[1].split(" where ")[0].split(",")]
                saved = dict(zip(columns, values))
                self.assertEqual(saved["test_frequency_months"], 6)
                self.assertEqual(saved["expiration_date"], date(2027, 3, 18))
                inserts = {call.args[0].split("insert into ")[1].split()[0]: call.args[1]
                           for call in cursor.execute.call_args_list if "insert into " in call.args[0]}
                self.assertEqual(inserts["certificate_test_rows"][3:5], [1.05, "KG"])
                self.assertEqual(inserts["certificate_metrology_results"][4:6], [1.05, 1])

    def test_regenerated_pdf_uses_saved_frequency_and_fresh_url(self):
        cert = {"certificate_number": "SIP 26-999", "test_frequency_months": 6}
        with tempfile.TemporaryDirectory() as directory, patch.object(
            pdf_service, "CERT_DIR", Path(directory)
        ), patch.object(pdf_service, "certificate_detail", return_value={"certificate": cert}), patch.object(
            pdf_service, "execute"
        ), patch.object(pdf_service, "_draw_page_1") as draw_page, patch.object(pdf_service, "_draw_page_2"):
            first = pdf_service.generate_certificate_pdf(CLIENT_ID, USER)
            second = pdf_service.generate_certificate_pdf(CLIENT_ID, USER)
            self.assertNotEqual(first, second)
            self.assertEqual(first.split("?")[0], second.split("?")[0])
            self.assertEqual(draw_page.call_args.args[1]["test_frequency_months"], 6)
            self.assertTrue((Path(directory) / "SIP_26-999.pdf").is_file())


if __name__ == "__main__":
    unittest.main()
