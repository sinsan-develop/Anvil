from pathlib import Path
from pathlib import PurePosixPath
import unittest
ROOT=Path(__file__).parents[2]; DEPLOY=ROOT/'deploy'/'ysna'
class DeploymentContractTests(unittest.TestCase):
 def test_deploy_root_is_parent_of_repo(self):
  deploy=(DEPLOY/'deploy.sh').read_text()
  self.assertIn('SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"', deploy)
  self.assertIn('ROOT="${ANVIL_DEPLOY_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"', deploy)
  self.assertIn('REPO="$ROOT/repo"', deploy)
  # The deployed script is inside <deploy-root>/repo/deploy/ysna.
  script=PurePosixPath('/srv/anvil/repo/deploy/ysna/deploy.sh')
  deploy_root=script.parents[3]
  self.assertEqual(PurePosixPath('/srv/anvil'), deploy_root)

 def test_artifacts_and_boundary(self):
  for name in ('Dockerfile.web','compose.production.yml','.dockerignore','README.md'): self.assertTrue((DEPLOY/name).is_file())
  text=(DEPLOY/'compose.production.yml').read_text(); self.assertIn('"3770"',text); self.assertIn('proxy-network',text); self.assertIn('read_only: true',text); self.assertIn('cap_drop: [ALL]',text); self.assertIn('no-new-privileges:true',text); self.assertNotIn('4173',text)

 def test_tmpfs_mount_spec_is_single_compose_value(self):
  text=(DEPLOY/'compose.production.yml').read_text()
  self.assertIn('/tmp:rw,noexec,nosuid,size=32m', text)
 def test_web_and_migrate_share_database_network(self):
  text=(DEPLOY/'compose.production.yml').read_text()
  self.assertIn('anvil-web:', text)
  self.assertIn('proxy-network:', text)
  self.assertNotIn('anvil-internal', text)
 def test_entrypoint_and_health(self):
  text=(ROOT/'apps/api/anvil_api/asgi.py').read_text(); self.assertIn('create_runtime_app()',text); self.assertIn('/health/live',text); self.assertIn('/health/ready',text)
 def test_sha_and_non_destructive(self):
  deploy=(DEPLOY/'deploy.sh').read_text(); rollback=(DEPLOY/'rollback.sh').read_text(); guard=(DEPLOY/'manifest-guard.sh').read_text(); self.assertIn('^[0-9a-f]{40}$',deploy); self.assertIn('git fetch --prune origin',deploy); self.assertIn('git checkout --detach',deploy); self.assertIn('APPROVED_FOR_DEPLOYMENT',guard); self.assertIn('merge-base --is-ancestor',guard); self.assertIn('successor_binding_sha256',guard); self.assertIn('verify.sh',rollback); self.assertNotIn('DROP DATABASE',rollback); self.assertNotIn('docker volume rm',rollback)
  self.assertIn('docker image tag',deploy); self.assertIn('up -d --no-build anvil-web',rollback); self.assertNotIn('up -d --build anvil-web',rollback)
 def test_runtime_secret_wiring(self):
  deploy=(DEPLOY/'deploy.sh').read_text(); compose=(DEPLOY/'compose.production.yml').read_text(); readme=(DEPLOY/'README.md').read_text(encoding='utf-8'); rollback=(DEPLOY/'rollback.sh').read_text()
  self.assertIn('SOURCE_ENV="$ROOT/.env"',deploy); self.assertNotIn('SOURCE_ENV="$REPO/.env"',deploy); self.assertIn('TARGET_ENV="$RUNTIME/anvil.env"',deploy); self.assertIn('install -m 600',deploy); self.assertIn('ANVIL_RUNTIME_ENV_FILE',deploy); self.assertIn('ANVIL_RUNTIME_ENV_FILE',compose)
  for name in ('ANVIL_DATABASE_URL','TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET','TELEGRAM_INTERNAL_SIGNING_SECRET','TELEGRAM_ALLOWED_IDENTITIES','ANVIL_CONSOLE_BASE_URL'): self.assertIn(name,deploy)
  for name in ('ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN','ANVIL_TEST_SESSION_ACTOR_ID','ANVIL_TEST_SESSION_PROJECT_ID','ANVIL_TEST_SESSION_ENVIRONMENT_ID','ANVIL_TEST_SESSION_RUN_IDS'): self.assertIn(name,deploy)
  self.assertIn('runtime secret retained',rollback); self.assertIn('runtime/anvil.env',readme)
 def test_bootstrap_least_privilege(self):
  text=(DEPLOY/'bootstrap-db.sh').read_text();
  for value in ('NOSUPERUSER','NOCREATEDB','NOCREATEROLE','NOREPLICATION','NOBYPASSRLS'): self.assertIn(value,text)
 def test_failure_and_readiness_guards(self):
  deploy=(DEPLOY/'deploy.sh').read_text(); verify=(DEPLOY/'verify.sh').read_text(); bootstrap=(DEPLOY/'bootstrap-db.sh').read_text()
  self.assertIn('MIGRATION_FAILED', deploy); self.assertIn('START_FAILED', deploy); self.assertIn('/health/ready', verify)
  self.assertNotIn('-v "migrator_password=', bootstrap); self.assertNotIn('-v "app_password=', bootstrap)

 def test_migration_rebuilds_target_image_before_run(self):
  deploy=(DEPLOY/'deploy.sh').read_text()
  self.assertIn('compose build anvil-web', deploy)
  self.assertIn('compose run --rm anvil-web alembic upgrade 0013_task_bootstrap_authority', deploy)

 def test_draft_release_boundary_matches_c21_runtime(self):
  import json
  draft=json.loads((DEPLOY/'ReleaseManifest.C21.DRAFT.json').read_text())
  self.assertEqual('DRAFT_NOT_APPROVED', draft['status'])
  self.assertEqual('UNASSIGNED', draft['source']['commit'])
  self.assertEqual('anvil.sinsan.kr', draft['runtime']['public_domain'])
  self.assertEqual('anvil-web:3770', draft['runtime']['listener'])
  self.assertEqual('0012_run_authority', draft['runtime']['migration_precondition'])
  self.assertEqual('0013_task_bootstrap_authority', draft['runtime']['migration_head'])

 def test_canonical_image_tag_is_bound_to_the_exact_release_commit(self):
  compose=(DEPLOY/'compose.production.yml').read_text()
  self.assertIn('image: "anvil-web:${ANVIL_RELEASE_COMMIT:?', compose)
