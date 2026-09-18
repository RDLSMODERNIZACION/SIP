import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "postgresql://unused:unused@localhost/unused")
from app.services import pdf_service


def sample_detail(template="pressure_gauge", count=3):
    return {
        "certificate": {"certificate_number": "SIP TEST", "template_type": template,
                        "element": "Manometro", "test_frequency_months": 6,
                        "approved_result": True, "final_comments": "Prueba de ambas tablas"},
        "test_rows": [{"pressure_label": f"CONTROL-{i + 1}", "range_value": 1.05,
                       "unit": "KG", "acceptance_criteria": "SIN ERROR",
                       "result": "POSITIVO", "observations": "OK"} for i in range(count)],
        "metrology_results": [{"point_label": f"METRO-{i + 1}", "direction": "ascendente",
                              "pattern_pressure": value, "instrument_reading": reading,
                              "unit": "KG"} for i, (value, reading) in enumerate(
                                  [(1.05, 1), (1.52, 1.55), (2.12, 2), (.55, .5)])],
    }


@unittest.skipUnless(shutil.which("pdftotext"), "Requires Poppler pdftotext")
class CertificateTablesPdfTests(unittest.TestCase):
    def test_both_tables_in_pdf_and_continuation_pages(self):
        for count in (3, 12):
            with self.subTest(count=count), tempfile.TemporaryDirectory() as tmp:
                with patch.object(pdf_service, "CERT_DIR", Path(tmp)), patch.object(
                    pdf_service, "certificate_detail", return_value=sample_detail(count=count)
                ), patch.object(pdf_service, "execute"):
                    pdf_service.generate_certificate_pdf("test", {"id": "test"})
                text = subprocess.check_output(["pdftotext", str(Path(tmp) / "SIP_TEST.pdf"), "-"], text=True)
                for i in range(count):
                    self.assertIn(f"CONTROL-{i + 1}", text)
                for i in range(4):
                    self.assertIn(f"METRO-{i + 1}", text)
                self.assertIn("1.05 KG", text)
                self.assertIn("1.55 KG", text)
                pages = text.split("\f")[:-1]
                self.assertEqual(len(pages), 3 if count == 3 else 4)
                self.assertIn("EMISIÓN Y CONTROL", pages[-1])

    def test_generic_certificate_keeps_two_pages(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(pdf_service, "CERT_DIR", Path(tmp)), patch.object(
            pdf_service, "certificate_detail", return_value=sample_detail("general_pressure")
        ), patch.object(pdf_service, "execute"):
            pdf_service.generate_certificate_pdf("test", {"id": "test"})
            text = subprocess.check_output(["pdftotext", str(Path(tmp) / "SIP_TEST.pdf"), "-"], text=True)
            self.assertEqual(len(text.split("\f")[:-1]), 2)
            self.assertEqual(text.count("CONTROL-1"), 1)
