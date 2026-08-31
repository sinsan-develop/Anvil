import unittest
from packages.action_policy import (ActionKind, ActionPolicy, ActionRequest, EgressSnapshot,
                                    FencingTokens, Decision)


def req(**changes):
    base = dict(action_id="a-1", kind=ActionKind.PATCH, path="packages/app/a.py", permission="developer",
                tokens=FencingTokens("exec-1", "write-1"), expected_tokens=FencingTokens("exec-1", "write-1"),
                egress=EgressSnapshot("e-1", "provider.test", ("192.0.2.1",)))
    base.update(changes)
    return ActionRequest(**base)


class PolicyTests(unittest.TestCase):
    def setUp(self): self.policy = ActionPolicy(("packages/app", "tests/app"))

    def test_allow_is_deterministic_and_structured(self):
        first = self.policy.evaluate(req()).to_dict(); second = self.policy.evaluate(req()).to_dict()
        self.assertEqual(first, second); self.assertEqual(first["decision"], Decision.ALLOW.value)
        self.assertTrue(first["receipt_sha256"].startswith("sha256:"))

    def test_required_guards_fail_closed(self):
        for change in (dict(path="../secret"), dict(tokens=FencingTokens("old", "write-1")),
                       dict(path="secrets/key"), dict(secret_read=True), dict(destructive=True),
                       dict(metadata_access=True), dict(egress=EgressSnapshot("e", "h", ("1.1.1.1",), ("h2",)))):
            with self.subTest(change=change):
                try: result = self.policy.evaluate(req(**change))
                except ValueError: continue
                self.assertEqual(result.decision, Decision.DENY)

    def test_execute_requires_safe_command(self):
        self.assertEqual(self.policy.evaluate(req(kind=ActionKind.EXECUTE, command="python -m unittest")).decision, Decision.ALLOW)
        self.assertEqual(self.policy.evaluate(req(kind=ActionKind.EXECUTE, command="rm -rf x")).reason_code, "UNSAFE_COMMAND_DENIED")

    def test_dns_rebinding_and_metadata_addresses_are_denied(self):
        multiple = req(egress=EgressSnapshot("e", "provider.test", ("198.51.100.1", "198.51.100.2")))
        self.assertEqual(self.policy.evaluate(multiple).reason_code, "DNS_REBINDING_DENIED")
        changed = req(approved_resolved_ips=("198.51.100.1",), egress=EgressSnapshot("e", "provider.test", ("198.51.100.2",)))
        self.assertEqual(self.policy.evaluate(changed).reason_code, "DNS_REBINDING_DENIED")
        for host, ips in (("169.254.169.254", ("198.51.100.1",)), ("provider.test", ("127.0.0.1",)), ("localhost", ("198.51.100.1",))):
            with self.subTest(host=host):
                self.assertEqual(self.policy.evaluate(req(egress=EgressSnapshot("e", host, ips))).reason_code, "METADATA_ADDRESS_DENIED")


if __name__ == "__main__": unittest.main()
