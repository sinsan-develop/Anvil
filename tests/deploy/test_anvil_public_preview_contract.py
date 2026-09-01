import json
import unittest
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
COMPOSE_PATH = ROOT / "deploy" / "ysna" / "compose.public-preview.yml"
DOCKERFILE_PATH = ROOT / "deploy" / "ysna" / "Dockerfile.web-preview"
DOCKERIGNORE_PATH = ROOT / "deploy" / "ysna" / "Dockerfile.web-preview.dockerignore"
README_PATH = ROOT / "deploy" / "ysna" / "README.public-preview.md"
MANIFEST_PATH = ROOT / "deploy" / "ysna" / "release-manifest.public-preview.json"


class AnvilPublicPreviewContractTests(unittest.TestCase):
    def load_compose(self):
        return yaml.safe_load(COMPOSE_PATH.read_text(encoding="utf-8"))

    def test_public_preview_uses_existing_proxy_network(self):
        compose = self.load_compose()
        web = compose["services"]["anvil-web"]
        self.assertEqual(["proxy-network"], web["networks"])
        self.assertEqual(["3770"], web["expose"])
        self.assertNotIn("ports", web)
        self.assertEqual({"external": True}, compose["networks"]["proxy-network"])

    def test_public_preview_is_hardened_and_has_upstream_proxy_boundary(self):
        compose = self.load_compose()
        web = compose["services"]["anvil-web"]
        self.assertEqual("unless-stopped", web["restart"])
        self.assertIs(True, web["read_only"])
        self.assertEqual(["ALL"], web["cap_drop"])
        self.assertEqual(["no-new-privileges:true"], web["security_opt"])
        self.assertEqual(["/tmp:rw,noexec,nosuid,size=32m"], web["tmpfs"])
        self.assertEqual(
            "${ANVIL_API_UPSTREAM:-http://anvil-internal-web-1:4173}",
            web["environment"]["ANVIL_API_UPSTREAM"],
        )
        rendered = COMPOSE_PATH.read_text(encoding="utf-8")
        self.assertNotIn("shared-db", rendered)
        self.assertNotIn("DATABASE_URL", rendered)

    def test_image_is_pinned_and_runs_as_non_root_preview(self):
        dockerfile = DOCKERFILE_PATH.read_text(encoding="utf-8")
        self.assertIn("node:22-bookworm-slim@sha256:", dockerfile)
        self.assertIn("USER anvil", dockerfile)
        self.assertIn("ANVIL_UI_MODE=preview", dockerfile)
        self.assertIn("ANVIL_HOST=0.0.0.0", dockerfile)
        self.assertIn("ANVIL_PORT=3770", dockerfile)
        self.assertNotIn("npm install", dockerfile)

    def test_image_context_excludes_repository_and_test_state(self):
        ignored = DOCKERIGNORE_PATH.read_text(encoding="utf-8").splitlines()
        self.assertIn(".git", ignored)
        self.assertIn(".worktrees", ignored)
        self.assertIn("tests", ignored)

    def test_historical_readme_and_manifest_point_to_unified_anvil_web(self):
        readme = README_PATH.read_text(encoding="utf-8")
        self.assertIn("historical alias", readme)
        self.assertIn("ANVIL_API_UPSTREAM", readme)
        self.assertIn("anvil-web unified", readme)

        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        self.assertEqual("anvil-web-public-preview", manifest["release_id"])
        self.assertEqual("anvil-web", manifest["runtime"]["service"])
        self.assertEqual(
            "http://anvil-internal-web-1:4173",
            manifest["runtime"]["api_upstream"],
        )
        self.assertEqual(
            "HISTORICAL_PUBLIC_PREVIEW_ALIAS",
            manifest["compatibility"]["public_preview_alias"],
        )


if __name__ == "__main__":
    unittest.main()
