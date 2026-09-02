import json
import unittest
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
COMPOSE_PATH = ROOT / "deploy" / "ysna" / "compose.public-preview.yml"
DOCKERFILE_PATH = ROOT / "deploy" / "ysna" / "Dockerfile.web"
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

    def test_public_runtime_is_hardened_and_has_no_upstream_proxy_boundary(self):
        compose = self.load_compose()
        web = compose["services"]["anvil-web"]
        self.assertEqual("unless-stopped", web["restart"])
        self.assertIs(True, web["read_only"])
        self.assertEqual(["ALL"], web["cap_drop"])
        self.assertEqual(["no-new-privileges:true"], web["security_opt"])
        self.assertEqual(["/tmp:rw,noexec,nosuid,size=32m"], web["tmpfs"])
        self.assertNotIn("ANVIL_API_UPSTREAM", web.get("environment", {}))
        rendered = COMPOSE_PATH.read_text(encoding="utf-8")
        self.assertNotIn("anvil-internal-web-1", rendered)
        self.assertIn("ANVIL_RUNTIME_ENV_FILE", rendered)

    def test_image_is_pinned_and_runs_as_non_root_preview(self):
        dockerfile = DOCKERFILE_PATH.read_text(encoding="utf-8")
        self.assertIn("python:3.12.8-slim-bookworm", dockerfile)
        self.assertIn("USER anvil", dockerfile)
        self.assertIn('"--port", "3770"', dockerfile)
        self.assertIn("COPY apps/web ./apps/web", dockerfile)

    def test_image_context_excludes_repository_and_test_state(self):
        ignored = DOCKERIGNORE_PATH.read_text(encoding="utf-8").splitlines()
        self.assertIn(".git", ignored)
        self.assertIn(".worktrees", ignored)
        self.assertIn("tests", ignored)

    def test_historical_readme_and_manifest_point_to_unified_anvil_web(self):
        readme = README_PATH.read_text(encoding="utf-8")
        self.assertIn("historical alias", readme)
        self.assertIn("unified ASGI", readme)

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
