from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]

class MigrationContractTests(unittest.TestCase):
    def test_base_migration_has_upgrade_downgrade_utc_and_version(self):
        text = (ROOT / "migrations/versions/0001_base.py").read_text(encoding="utf-8")
        for token in ("def upgrade", "def downgrade", "timezone=True", "version_id", "created_at"):
            self.assertIn(token, text)
    def test_alembic_files_exist(self):
        for rel in ("alembic.ini", "migrations/env.py", "migrations/script.py.mako"):
            self.assertTrue((ROOT / rel).is_file())

if __name__ == "__main__": unittest.main()
