import pytest
from importlib import util
from pathlib import Path

from packages.recovery.disaster import check_migration_compatibility, RecoveryMismatch


def test_pg15_and_pg18_require_separate_version_and_extension_evidence():
    assert check_migration_compatibility(150017, {"plpgsql", "vector"}, expected_major=15) == 15
    assert check_migration_compatibility(180004, {"plpgsql", "vector"}, expected_major=18) == 18
    with pytest.raises(RecoveryMismatch):
        check_migration_compatibility(150017, {"plpgsql", "vector"}, expected_major=18)
    with pytest.raises(RecoveryMismatch):
        check_migration_compatibility(180004, {"plpgsql"}, expected_major=18)


def test_migration_downgrade_refuses_to_drop_persisted_audit():
    path = Path(__file__).resolve().parents[2] / "migrations/versions/0016_operations_recovery.py"
    spec = util.spec_from_file_location("f14_migration", path)
    module = util.module_from_spec(spec)
    spec.loader.exec_module(module)
    class Result:
        def scalar_one(self):
            return 1
    class Bind:
        def execute(self, _query):
            return Result()
    class Guard:
        def __init__(self):
            self.drops = []
        def get_bind(self):
            return Bind()
        def drop_table(self, name):
            self.drops.append(name)
    guard = Guard()
    module.op = guard
    with pytest.raises(RuntimeError, match="DEPLOYMENT_ROLLBACK_DECISION_REQUIRED"):
        module.downgrade()
    assert guard.drops == []
