import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEPLOY_ROOT = ROOT / "deploy" / "ysna"


class AnvilPublicPreviewScriptTests(unittest.TestCase):
    def read(self, name):
        return (DEPLOY_ROOT / name).read_text(encoding="utf-8")

    def test_deploy_requires_git_sha_tag_clean_checkout_and_alias_outputs(self):
        script = self.read("deploy-public-preview.sh")
        self.assertIn("^[0-9a-f]{40}$", script)
        self.assertIn("git fetch --prune --tags origin", script)
        self.assertIn("git status --porcelain", script)
        self.assertIn('git checkout --detach "$release_commit"', script)
        self.assertIn('git rev-parse "$release_tag^{commit}"', script)
        self.assertIn('deploy_root="$HOME/deploy/anvil"', script)
        self.assertIn('origin_url="git@github.com:cyhuh7950/anvil.git"', script)
        self.assertIn("current-anvil-web-sha", script)
        self.assertIn("current-public-preview-sha", script)
        self.assertIn("anvil-web-deploy.json", script)
        self.assertIn("public-preview-deploy.json", script)

    def test_scripts_manage_only_anvil_preview_resources(self):
        scripts = "\n".join(
            self.read(name)
            for name in (
                "deploy-public-preview.sh",
                "verify-public-preview.sh",
                "rollback-public-preview.sh",
            )
        )
        for forbidden in (
            "docker network rm",
            "docker volume rm",
            "docker system prune",
            "docker rm -f shared-db",
            "docker restart shared-db",
            "scp ",
            "DROP DATABASE",
        ):
            self.assertNotIn(forbidden, scripts)
        self.assertIn("anvil-public-preview", scripts)
        self.assertIn("anvil-web", scripts)
        self.assertIn("proxy-network", scripts)

    def test_verify_checks_unified_runtime_network_public_domain_and_alias_ids(self):
        script = self.read("verify-public-preview.sh")
        for required in (
            "docker inspect anvil-web",
            "proxy-network",
            "http://anvil-web:3770/healthz",
            "http://anvil-web:3770/health/live",
            "http://anvil-web:3770/openapi.json",
            "https://anvil.sinsan.kr",
            "nginx-proxy-manager",
            "shared-db",
            "content-security-policy",
            "docker exec nginx-proxy-manager curl -fsS",
            "curl -fsS -D - -o /dev/null",
            "protected-anvil-web-container-ids",
            "protected-container-ids",
            "anvil-web-verify.json",
            "public-preview-verify.json",
        ):
            self.assertIn(required, script)
        self.assertNotIn("wget", script)
        self.assertNotIn("curl -fsSI", script)

    def test_release_manifest_is_non_secret_and_scope_honest(self):
        manifest = json.loads(self.read("release-manifest.public-preview.json"))
        self.assertEqual("anvil-web-public-preview", manifest["release_id"])
        self.assertEqual("3770", manifest["runtime"]["container_port"])
        self.assertEqual("proxy-network", manifest["runtime"]["network"])
        self.assertEqual("http://anvil-internal-web-1:4173", manifest["runtime"]["api_upstream"])
        self.assertEqual("NOT_CONNECTED", manifest["runtime"]["database"])
        self.assertEqual("NOT_CONNECTED", manifest["runtime"]["llm"])
        self.assertEqual(
            "HISTORICAL_PUBLIC_PREVIEW_ALIAS",
            manifest["compatibility"]["public_preview_alias"],
        )
        serialized = json.dumps(manifest).lower()
        self.assertNotIn("password", serialized)
        self.assertNotIn("token", serialized)


if __name__ == "__main__":
    unittest.main()
