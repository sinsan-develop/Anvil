from __future__ import annotations

import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from packages.paths.identity import (
    RepositoryIdentity,
    RepositoryPathMapping,
    RepositoryPathMappingRegistry,
    conflict_scope_key,
)


class ConflictScopeIdentityTests(unittest.TestCase):
    def test_stable_repository_id_is_independent_from_source_path(self):
        identity = RepositoryIdentity("repo-anvil", "C:/Repos/Anvil", "INSENSITIVE", "map-v1")
        assert identity.conflict_key("/mnt/c/Repos/Anvil/Packages/Queue.py") == (
            "repo-anvil", "packages/queue.py", "INSENSITIVE"
        )

    def test_explicit_container_mapping_rejects_ambiguous_and_outside_paths(self):
        identity = RepositoryIdentity("repo-anvil", "C:/Repos/Anvil", "INSENSITIVE", "map-v1")
        mapping = RepositoryPathMapping(
            identity=identity,
            workspace_id="ws-1",
            backend_id="docker",
            workspace_root="C:/owned/ws-1",
            container_root="/workspace",
        )
        assert mapping.container_to_source("/workspace/pkg/a.py") == "c:/repos/anvil/pkg/a.py"
        with self.assertRaises(ValueError):
            mapping.container_to_source("/other/a.py")
        with self.assertRaises(ValueError):
            RepositoryPathMapping(identity, "ws-1", "docker", "C:/owned/ws-1", "/")
        with self.assertRaises(ValueError):
            RepositoryPathMapping(identity, "ws-1", "docker", "C:/Repos/Anvil/nested", "/workspace")

    def test_container_namespace_is_lexical_and_operational_identifiers_are_preserved(self):
        identity = RepositoryIdentity("repo-anvil", "C:/Repos/Anvil", "INSENSITIVE", "map-v1")
        mapping = RepositoryPathMapping(identity, "ws-1", "docker", "C:/owned/ws-1", "/virtual/not-on-host")
        self.assertEqual(mapping.container_to_source("/virtual/not-on-host/pkg/a.py"),
                         "c:/repos/anvil/pkg/a.py")
        path_shaped_identifier = RepositoryIdentity(
            "../repo", "C:/Repos/Anvil", "INSENSITIVE", "map-v1"
        )
        self.assertEqual(path_shaped_identifier.repository_id, "../repo")

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

    def test_mapping_registry_rejects_duplicate_identity_and_nested_physical_roots(self):
        with tempfile.TemporaryDirectory(prefix="anvil-c09-map-") as temporary:
            root = Path(temporary)
            source = root / "source"; source.mkdir()
            identity = RepositoryIdentity("repo-1", str(source), "SENSITIVE", "map-v1")
            registry = RepositoryPathMappingRegistry()
            first = RepositoryPathMapping(identity, "ws-1", "git-worktree", str(root / "managed" / "ws-1"))
            registry.register(first)
            self.assertEqual(registry.require("repo-1", "ws-1", "git-worktree"), first)
            with self.assertRaises(ValueError):
                registry.register(RepositoryPathMapping(identity, "ws-1", "git-worktree", str(root / "other")))
            with self.assertRaises(ValueError):
                registry.register(RepositoryPathMapping(identity, "ws-2", "docker", str(root / "managed" / "ws-1" / "nested"), "/workspace"))


if __name__ == "__main__":
    unittest.main()
