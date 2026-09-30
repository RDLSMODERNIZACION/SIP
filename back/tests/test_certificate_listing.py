"""Regression coverage for certificates hidden beyond the former 500-row cap."""
import os
import sqlite3
import unittest
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "postgresql://unused:unused@localhost/unused")

from app.services import certificate_service as service


class CertificateListingTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
            create table v_certificates_status (
                id integer, certificate_number text, client_id text,
                client_name text, serial_number text, element text,
                visible_status text, created_at integer
            );
            create table client_users (
                user_id text, client_id text, can_view boolean
            );
        """)
        self.db.execute(
            "insert into v_certificates_status values (?, ?, ?, ?, ?, ?, ?, ?)",
            (1, "SIP 26-129", "md", "MD", "129", "Equipo", "vigente", 1),
        )
        self.db.executemany(
            "insert into v_certificates_status values (?, ?, ?, ?, ?, ?, ?, ?)",
            [(i, f"SIP 26-{i + 2000}", "other", "Otra", str(i), "Equipo",
              "vencido", i) for i in range(2, 602)],
        )
        self.db.executemany("insert into client_users values (?, ?, ?)", [
            ("md-user", "md", True), ("md-user", "other", False),
        ])
        # Execute the actual listing SQL against fixtures; adapt only DB syntax.
        def fetch(query, params):
            query = query.replace("%s", "?").replace("ilike", "like")
            return [dict(row) for row in self.db.execute(query, params)]
        patcher = patch.object(service, "fetch_all", side_effect=fetch)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_unfiltered_list_includes_certificate_after_500_newer_records(self):
        rows = service.list_certificates({"role_code": "admin"})
        self.assertEqual(len(rows), 601)
        self.assertEqual(rows[-1]["certificate_number"], "SIP 26-129")
        self.assertEqual(rows[0]["id"], 601)

    def test_filters_find_the_same_certificate_as_the_full_list(self):
        for filters in ({"q": "SIP 26-129"}, {"q": "MD"},
                        {"client_id": "md"}, {"status": "vigente"}):
            with self.subTest(filters=filters):
                rows = service.list_certificates({"role_code": "admin"}, **filters)
                self.assertEqual([r["certificate_number"] for r in rows], ["SIP 26-129"])

    def test_client_scope_is_preserved_with_and_without_filters(self):
        user = {"role_code": "cliente", "id": "md-user"}
        self.assertEqual([r["id"] for r in service.list_certificates(user)], [1])
        self.assertEqual(service.list_certificates(user, client_id="other"), [])
        self.assertEqual(service.list_certificates(user, q="Otra"), [])
        self.assertEqual(service.list_certificates({"role_code": "cliente", "id": "unassigned"}), [])
