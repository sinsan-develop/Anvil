from pathlib import Path
import unittest
ROOT=Path(__file__).parents[2]; DEPLOY=ROOT/'deploy'/'ysna'
class DeploymentContractTests(unittest.TestCase):
 def test_artifacts_and_boundary(self):
  for name in ('Dockerfile.web','compose.internal.yml','.dockerignore','README.md'): self.assertTrue((DEPLOY/name).is_file())
  text=(DEPLOY/'compose.internal.yml').read_text(); self.assertIn('"127.0.0.1:4173:4173"',text); self.assertIn('read_only: true',text); self.assertIn('cap_drop: [ALL]',text); self.assertIn('no-new-privileges:true',text)
 def test_web_not_proxy_and_migrate_profile(self):
  text=(DEPLOY/'compose.internal.yml').read_text(); self.assertNotIn('proxy-network',text.split('  migrate:',1)[0]); self.assertIn('profiles: [tools]',text)
 def test_entrypoint_and_health(self):
  text=(ROOT/'apps/api/anvil_api/asgi.py').read_text(); self.assertIn('create_runtime_app()',text); self.assertIn('/health/live',text); self.assertIn('/health/ready',text)
 def test_sha_and_non_destructive(self):
  deploy=(DEPLOY/'deploy.sh').read_text(); rollback=(DEPLOY/'rollback.sh').read_text(); self.assertIn('^[0-9a-f]{40}$',deploy); self.assertIn('git fetch --prune origin',deploy); self.assertIn('git checkout --detach',deploy); self.assertNotIn('DROP DATABASE',rollback); self.assertNotIn('docker volume rm',rollback)
 def test_bootstrap_least_privilege(self):
  text=(DEPLOY/'bootstrap-db.sh').read_text();
  for value in ('NOSUPERUSER','NOCREATEDB','NOCREATEROLE','NOREPLICATION','NOBYPASSRLS'): self.assertIn(value,text)
