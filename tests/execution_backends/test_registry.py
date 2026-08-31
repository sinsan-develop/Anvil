import unittest

from packages.execution_backends import BackendRegistry, BackendRejected


class RegistryTests(unittest.TestCase):
    def test_allowlisted_observation_is_deterministic_and_read_only(self):
        registry = BackendRegistry()
        first = registry.observe("git-worktree", "observe-status", "repo-1",
                                 inputs={"path": "repo"}, observations={"untracked": ["x"]})
        second = registry.observe("git-worktree", "observe-status", "repo-1",
                                  inputs={"path": "repo"}, observations={"untracked": ["x"]})
        self.assertEqual(first.receipt.receipt_sha256, second.receipt.receipt_sha256)
        self.assertTrue(first.receipt.read_only)
        self.assertFalse(first.receipt.writes_allowed)

    def test_unknown_and_mutating_operations_fail_closed(self):
        registry = BackendRegistry()
        with self.assertRaises(BackendRejected):
            registry.observe("shell", "run", "repo")
        with self.assertRaises(BackendRejected):
            registry.observe("docker", "exec", "repo")


if __name__ == "__main__":
    unittest.main()
