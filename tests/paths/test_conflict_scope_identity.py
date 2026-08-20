from __future__ import annotations

import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from packages.paths.identity import conflict_scope_key


class ConflictScopeIdentityTests(unittest.TestCase):
    def test_windows_wsl_case_and_short_aliases_share_one_conflict_scope(self):
        repository = "C:/Repos/Anvil"
        canonical = conflict_scope_key(repository, "C:/Repos/Anvil/packages/Queue/Service.py", "INSENSITIVE")
        self.assertEqual(canonical, conflict_scope_key(repository, "/mnt/c/Repos/Anvil/packages/queue/service.py", "INSENSITIVE"))
        self.assertEqual(canonical, conflict_scope_key(repository, "C:/REPOS/ANVIL/PACKAGES/QUEUE/SERVICE.PY", "INSENSITIVE"))
        self.assertEqual(canonical, conflict_scope_key(repository, "C:/Repos/Anvil/PROGRA~1/../packages/queue/service.py", "INSENSITIVE"))

    def test_existing_filesystem_alias_converges_and_external_absolute_path_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix="anvil-b09-path-") as temporary:
            root = Path(temporary)
            repository = root / "canonical-repo"
            target = repository / "packages" / "queue" / "service.py"
            target.parent.mkdir(parents=True)
            target.write_text("queue", encoding="utf-8")
            alias = root / "alias-repo"
            if os.name == "nt":
                created = subprocess.run(
                    ["cmd.exe", "/d", "/c", "mklink", "/J", str(alias), str(repository)],
                    capture_output=True,
                    check=False,
                    text=True,
                )
                if created.returncode != 0:
                    self.skipTest("Windows junction creation unavailable")
            else:
                alias.symlink_to(repository, target_is_directory=True)
            try:
                canonical = conflict_scope_key(str(repository), str(target), "INSENSITIVE")
                junction = conflict_scope_key(
                    str(repository), str(alias / "packages" / "queue" / "service.py"), "INSENSITIVE"
                )
                self.assertEqual(canonical, junction)
            finally:
                if alias.is_symlink():
                    alias.unlink()
                elif alias.exists():
                    os.rmdir(alias)

        external = "D:/Other/file.py" if os.name == "nt" else "/outside/file.py"
        with self.assertRaises(ValueError):
            conflict_scope_key("C:/Repos/Anvil" if os.name == "nt" else "/repos/anvil", external, "INSENSITIVE")


if __name__ == "__main__":
    unittest.main()
