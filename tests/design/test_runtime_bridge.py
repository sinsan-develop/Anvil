import json
import subprocess
import sys
import unittest


def invoke(payload):
    result = subprocess.run([sys.executable, "-m", "packages.api.design_runtime"], input=json.dumps(payload), text=True, capture_output=True)
    return result.returncode, json.loads(result.stdout)


class RuntimeBridgeTests(unittest.TestCase):
    def test_actual_service_blocks_baseline_before_authenticated_decision(self):
        code, body = invoke({"action": "baseline", "intent": "운영 승인 자동화", "proposals": ["안전 우선", "속도 우선"]})
        self.assertEqual(3, code)
        self.assertEqual("BLOCKED", body["state"])
        self.assertEqual("DesignLineageService", body["service"])

    def test_actual_service_rejects_single_proposal_and_unauthenticated_decision(self):
        for payload in (
            {"action": "normal", "intent": "운영 승인 자동화", "proposals": ["하나"], "actor": {"id": "sinsan", "authenticated": True}},
            {"action": "normal", "intent": "운영 승인 자동화", "proposals": ["안전", "속도"], "actor": {"id": "sinsan", "authenticated": False}},
        ):
            with self.subTest(payload=payload):
                code, body = invoke(payload)
                self.assertEqual(2, code)
                self.assertEqual("ERROR", body["state"])

    def test_actual_service_emits_ordered_event_ids_types_utc_and_actor(self):
        code, body = invoke({"action": "normal", "intent": "운영 승인 자동화", "proposals": ["안전", "속도"], "selected": "안전", "actor": {"id": "sinsan", "authenticated": True}})
        self.assertEqual(0, code)
        self.assertEqual("NORMAL", body["state"])
        self.assertEqual([1, 2, 3, 4, 5], [event["sequence"] for event in body["events"]])
        for event in body["events"]:
            self.assertTrue(event["event_id"].startswith("evt-b03-"))
            self.assertTrue(event["type"])
            self.assertTrue(event["occurred_at"].endswith("+00:00"))
            self.assertIn(event["actor"]["type"], ("user", "agent"))
            self.assertTrue(event["actor"]["id"])


if __name__ == "__main__": unittest.main()
