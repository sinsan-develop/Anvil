from pathlib import Path
import os
import subprocess
import tempfile
import textwrap
import unittest
ROOT=Path(__file__).parents[2]; DEPLOY=ROOT/'deploy'/'ysna'
class ScriptContractTests(unittest.TestCase):
 def test_external_secret_refs(self):
  text=(DEPLOY/'compose.production.yml').read_text(); self.assertIn('ANVIL_RUNTIME_ENV_FILE',text); self.assertNotIn('../../runtime/anvil.env',text); self.assertNotIn('OPENAI_API_KEY=',text)
 def test_redacted_evidence(self):
  text=(DEPLOY/'verify.sh').read_text(); self.assertIn('secret_values',text); self.assertIn('anvil.sinsan.kr',text); self.assertIn('3770',text); self.assertIn('git status --porcelain',text)
 def test_runtime_health_contract(self):
  text=(ROOT/'apps/api/anvil_api/asgi.py').read_text(); self.assertIn('database_unavailable', text); self.assertIn('migration_head_mismatch', text); self.assertIn('runtime_refs_missing', text); self.assertIn('SELECT version_num FROM alembic_version', text); self.assertIn('0013_task_bootstrap_authority', text)

 def test_standard_scripts_do_not_reactivate_internal_or_preview_runtime(self):
  text='\n'.join((DEPLOY/name).read_text() for name in ('bootstrap-deploy.sh','deploy.sh','verify.sh','rollback.sh'))
  self.assertIn('compose.production.yml', text); self.assertIn('anvil-web', text); self.assertIn('0013_task_bootstrap_authority', text)
  self.assertNotIn('4173', text); self.assertNotIn('compose.internal.yml', text); self.assertNotIn('public-preview', text)

 def test_canonical_scripts_execute_in_an_isolated_fail_closed_harness(self):
  bash=Path(os.environ.get('ProgramFiles', r'C:\\Program Files'))/'Git'/'usr'/'bin'/'bash.exe'
  if not bash.is_file(): self.skipTest('Git Bash is required')
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp); env=os.environ|{'ANVIL_DEPLOY_ROOT':str(root).replace('\\','/'),'HOME':str(root).replace('\\','/')}
   deploy=subprocess.run([str(bash),str(DEPLOY/'deploy.sh'), 'bad'],env=env,text=True,capture_output=True)
   verify=subprocess.run([str(bash),str(DEPLOY/'verify.sh'), 'bad'],env=env,text=True,capture_output=True)
   rollback=subprocess.run([str(bash),str(DEPLOY/'rollback.sh')],env=env,text=True,capture_output=True)
  self.assertEqual(2,deploy.returncode); self.assertEqual(4,verify.returncode); self.assertEqual(2,rollback.returncode)

 def test_canonical_scripts_execute_success_paths_in_isolated_harness(self):
  bash=Path(os.environ.get('ProgramFiles', r'C:\\Program Files'))/'Git'/'usr'/'bin'/'bash.exe'
  if not bash.is_file(): self.skipTest('Git Bash is required')
  old_sha='1'*40; target_sha='2'*40
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp); repo=root/'repo'; runtime=root/'runtime'; evidence=root/'evidence'; fakebin=root/'fakebin'
   (repo/'.git').mkdir(parents=True); (repo/'deploy'/'ysna').mkdir(parents=True); runtime.mkdir(); evidence.mkdir(); fakebin.mkdir()
   required={
    'ANVIL_DATABASE_URL':'postgresql://redacted', 'TELEGRAM_BOT_TOKEN':'redacted',
    'TELEGRAM_WEBHOOK_SECRET':'redacted', 'TELEGRAM_INTERNAL_SIGNING_SECRET':'redacted',
    'TELEGRAM_ALLOWED_IDENTITIES':'1:1', 'ANVIL_CONSOLE_BASE_URL':'https://anvil.sinsan.kr',
    'ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN':'test-bootstrap-secret', 'ANVIL_TEST_SESSION_ACTOR_ID':'actor-test',
    'ANVIL_TEST_SESSION_PROJECT_ID':'project-test', 'ANVIL_TEST_SESSION_ENVIRONMENT_ID':'environment-test',
    'ANVIL_TEST_SESSION_RUN_IDS':'run-allowed',
   }
   (root/'.env').write_text(''.join(f'{key}={value}\n' for key,value in required.items()), encoding='utf-8', newline='\n')
   (repo/'deploy'/'ysna'/'manifest-guard.sh').write_text('validate_release_manifest() { return 0; }\n', encoding='utf-8', newline='\n')
   (repo/'deploy'/'ysna'/'compose.production.yml').write_text('services: {}\n', encoding='utf-8', newline='\n')
   (repo/'deploy'/'ysna'/'verify.sh').write_text('#!/bin/bash\necho rollback-verified >> "$ANVIL_DEPLOY_ROOT/verify-invocations.log"\n', encoding='utf-8', newline='\n')
   def executable(name, body):
    content=textwrap.dedent(body).lstrip().replace('#!/usr/bin/env bash', '#!/bin/bash', 1)
    path=fakebin/name; path.write_text(content, encoding='utf-8', newline='\n'); path.chmod(0o755)
   executable('stat', '''
    #!/usr/bin/env bash
    printf '600\n'
   ''')
   executable('git', '''
    #!/usr/bin/env bash
    printf 'git %s\n' "$*" >> "$HARNESS_LOG"
    args="$*"
    case "$args" in
      *"status --porcelain"*) exit 0 ;;
      *"rev-parse HEAD"*) if [[ -s "$GIT_STATE" ]]; then cat "$GIT_STATE"; else printf '%s\n' "$OLD_SHA"; fi ;;
      *"rev-parse "*":deploy/ysna/compose.production.yml") printf 'blob-compose\n' ;;
      *"rev-parse "*":deploy/ysna/verify.sh") printf 'blob-verify\n' ;;
      *"show "*":deploy/ysna/compose.production.yml") printf 'services: {}\n' ;;
      *"show "*":deploy/ysna/verify.sh") printf '#!/bin/bash\necho rollback-verified >> "$ANVIL_DEPLOY_ROOT/verify-invocations.log"\n' ;;
      *"hash-object "*"compose.production.yml"*) printf 'blob-compose\n' ;;
      *"hash-object "*"verify.sh"*) printf 'blob-verify\n' ;;
      *"cat-file -e "*) exit 0 ;;
      *"checkout --detach "*) printf '%s\n' "${args##* }" > "$GIT_STATE" ;;
      *"fetch --prune origin"*) exit 0 ;;
      *) echo "unexpected git invocation: $args" >&2; exit 91 ;;
    esac
   ''')
   executable('docker', '''
    #!/usr/bin/env bash
    printf 'docker %s\n' "$*" >> "$HARNESS_LOG"
    args="$*"
    case "$args" in
      "inspect --format {{.Image}} anvil-web") printf 'sha256:previous-image\n' ;;
      "image inspect --format "*"sha256:previous-image") printf '%s\n' "$OLD_SHA" ;;
      "image inspect --format "*"anvil-web:$TARGET_SHA") printf '%s\n' "$TARGET_SHA" ;;
      "image tag sha256:previous-image anvil-web:$OLD_SHA") exit 0 ;;
      *"alembic current"*) printf '0012_run_authority\n' ;;
      *"alembic upgrade 0013_task_bootstrap_authority"*) exit 0 ;;
      *" build anvil-web"*|*" up -d anvil-web"*|*" stop anvil-web"*|*" up -d --no-build anvil-web"*|*" ps --status running anvil-web"*) exit 0 ;;
      *) echo "unexpected docker invocation: $args" >&2; exit 92 ;;
    esac
   ''')
   executable('curl', '''
    #!/usr/bin/env bash
    header=''; body=''; cookie=''; url=''; last_event=0; previous=''
    for arg in "$@"; do
      if [[ "$previous" == '-D' ]]; then header="$arg"; fi
      if [[ "$previous" == '-o' ]]; then body="$arg"; fi
      if [[ "$previous" == '-c' ]]; then cookie="$arg"; fi
      if [[ "$previous" == '-H' && "$arg" == Last-Event-ID:* ]]; then last_event=1; fi
      if [[ "$arg" == https://* ]]; then url="$arg"; fi
      previous="$arg"
    done
    printf 'curl %s last_event=%s\n' "$url" "$last_event" >> "$HARNESS_LOG"
    [[ -z "$cookie" ]] || printf 'session-cookie\n' > "$cookie"
    if [[ "$url" == */openapi.json ]]; then
      printf '{"paths":{"/api/providers":{"get":{}},"/api/runs/{id}/events":{"get":{}}}}'
    elif [[ "$url" == */health/ready ]]; then printf '{"migration_head":"0013_task_bootstrap_authority"}'
    elif [[ "$url" == */integrations/telegram/webhook ]]; then
      if [[ -n "$body" ]]; then
        if [[ "${FAKE_TELEGRAM_GENERIC_403:-0}" == 1 ]]; then printf 'forbidden' > "$body"; else printf '{"error":"webhook authentication failed"}' > "$body"; fi
      fi
      printf '403'
    elif [[ "$url" == */api/runs/*/events ]]; then
      printf 'HTTP/2 200\r\ncontent-type: text/event-stream; charset=utf-8\r\n\r\n' > "$header"
      if [[ "$last_event" == 1 && "${FAKE_RESUME_REPEATS:-0}" != 1 ]]; then printf 'id: evt-2\ndata: {}\n\n' > "$body"; else printf 'id: evt-1\ndata: {}\n\n' > "$body"; fi
    else printf '{}'; fi
   ''')
   def posix(value):
    value=str(value).replace('\\','/')
    return f'/{value[0].lower()}{value[2:]}' if len(value)>2 and value[1]==':' else value
   log=root/'harness.log'
   env=os.environ|{
    'ANVIL_DEPLOY_ROOT':posix(root), 'ANVIL_RELEASE_MANIFEST_REF':'origin/main',
    'HOME':posix(root), 'PATH':posix(fakebin)+os.pathsep+os.environ.get('PATH',''),
    'HARNESS_LOG':posix(log), 'GIT_STATE':posix(root/'git-head'), 'OLD_SHA':old_sha, 'TARGET_SHA':target_sha,
   }
   deploy=subprocess.run([str(bash),str(DEPLOY/'deploy.sh'),target_sha],env=env,text=True,capture_output=True)
   self.assertEqual(0,deploy.returncode,deploy.stderr)
   self.assertEqual(old_sha,(runtime/'previous.sha').read_text().strip())
   rollback_assets=runtime/'rollback-assets'/target_sha
   self.assertEqual(posix(rollback_assets),(runtime/'rollback-assets.current').read_text().strip())
   self.assertTrue((rollback_assets/'compose.production.yml').is_file()); self.assertTrue((rollback_assets/'verify.sh').is_file())
   self.assertFalse(list(runtime.glob('rollback-assets.current.tmp.*')))
   verify=subprocess.run([str(bash),str(DEPLOY/'verify.sh'),target_sha],env=env,text=True,capture_output=True)
   self.assertEqual(0,verify.returncode,verify.stderr)
   verification=(evidence/'verification.json').read_text(); self.assertIn('"status":"verified"',verification); self.assertNotIn(required['ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN'],verification)
   repeated=subprocess.run([str(bash),str(DEPLOY/'verify.sh'),target_sha],env=env|{'FAKE_RESUME_REPEATS':'1'},text=True,capture_output=True)
   self.assertEqual(7,repeated.returncode); self.assertIn('Last-Event-ID was not advanced',repeated.stderr)
   generic_403=subprocess.run([str(bash),str(DEPLOY/'verify.sh'),target_sha],env=env|{'FAKE_TELEGRAM_GENERIC_403':'1'},text=True,capture_output=True)
   self.assertEqual(6,generic_403.returncode); self.assertIn('Telegram route/auth boundary mismatch',generic_403.stderr)
   rollback=subprocess.run([str(bash),str(DEPLOY/'rollback.sh')],env=env,text=True,capture_output=True)
   self.assertEqual(0,rollback.returncode,rollback.stderr)
   self.assertIn('rollback-verified',(root/'verify-invocations.log').read_text())
   calls=log.read_text()
   self.assertIn('curl https://anvil.sinsan.kr/auth/session',calls)
   self.assertIn('curl https://anvil.sinsan.kr/integrations/telegram/webhook',calls)
   self.assertNotIn('curl https://anvil.sinsan.kr/api/providers',calls)
   self.assertIn('last_event=1',calls)
   self.assertIn(f'image tag sha256:previous-image anvil-web:{old_sha}',calls)
   self.assertIn('up -d --no-build anvil-web',calls)
   self.assertNotIn('/api/ ',calls); self.assertNotIn('/auth/ ',calls); self.assertNotIn('/integrations/ ',calls)
   self.assertNotIn(required['ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN'],calls+verify.stdout+verify.stderr)
