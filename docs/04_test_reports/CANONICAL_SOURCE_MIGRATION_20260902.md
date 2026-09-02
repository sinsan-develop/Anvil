# Canonical Source Migration Report — 2026-09-02

## 판정

`D:\Project\Anvil`을 canonical source로 확정한 승인 범위에서, Desktop 저장소의 local Git refs를 D 저장소의 격리 namespace로 비파괴 import했고, 확인된 3개 후속 C-21 커밋을 격리 migration branch에 fast-forward 반영했다. Desktop 저장소의 파일·ref 삭제와 변경, D root working tree 변경, push 및 main 병합은 수행하지 않았다.

## 기준선과 보호 범위

- D canonical root 시작 HEAD/branch: `ef80f61c1e82ec7a70d319efb5c76061111f9228` / `codex/anvil-public-ui-preview`.
- `git fetch origin` 후 최신 `origin/main`: `13040fef646460e88bf8b47f54459cdce1855e62` (fetch 전 `9f306f87e3090a8501167c9f3469c4a6686806ce`). `--prune` 미사용.
- D root protected dirty/untracked: `M AGENTS.md`, `?? packages/agent_team/`, `?? tests/agent_team/`. 본 작업에서 수정·stage·reset·stash·clean하지 않았다.
- Desktop protected state도 동일하게 `M AGENTS.md`, `?? packages/agent_team/`, `?? tests/agent_team/`로 관측했고, 파일·ref를 변경하거나 삭제하지 않았다.
- D root와 Desktop 모두 Git의 사용자 global ignore 파일 접근 경고가 있었으나, 위 보호 상태는 유지됐다.

## 비파괴 ref import

Desktop local head 32개와 tag 8개(합계 40개)를 `git fetch --no-tags <Desktop>`의 명시 refspec으로 import했다. 모든 대상 ref는 import 전에 absent였고, source object SHA의 D object-store 존재 여부는 아래 `Before` 열이다. `After`는 source SHA와 target ref SHA가 full SHA까지 일치하고 `git cat-file -e <sha>^{object}`가 성공했음을 뜻한다. mismatch 0건.

| Source ref | D target ref | Full SHA | Before object | After |
|---|---|---|---|---|
| `refs/heads/codex/anvil-plan-common-api-menu-order` | `refs/remotes/desktop-migration/codex/anvil-plan-common-api-menu-order` | `8c31ca711d11585f8fd4237ac2179c094321b2a1` | present | present/matched |
| `refs/heads/codex/anvil-public-host-fix` | `refs/remotes/desktop-migration/codex/anvil-public-host-fix` | `23c6233ce68ecd2dd1dc581c482187faa80d5fa9` | absent | present/matched |
| `refs/heads/codex/anvil-public-ui-preview` | `refs/remotes/desktop-migration/codex/anvil-public-ui-preview` | `7cb09c6f7ce90291586f7e245fac82703f401850` | absent | present/matched |
| `refs/heads/codex/anvil-public-ui-preview-impl` | `refs/remotes/desktop-migration/codex/anvil-public-ui-preview-impl` | `d4cb841464c19817afd79ed7127cc3ad5dc9a4b4` | present | present/matched |
| `refs/heads/codex/anvil-web-api-upstream` | `refs/remotes/desktop-migration/codex/anvil-web-api-upstream` | `736e19413e53317137b18a3af36eb6fd2bcd728c` | present | present/matched |
| `refs/heads/codex/anvil-web-api-upstream2` | `refs/remotes/desktop-migration/codex/anvil-web-api-upstream2` | `7f185cb9456eec2c48a6bc69033f012c74559cf9` | present | present/matched |
| `refs/heads/codex/anvil-web-compose-hotfix` | `refs/remotes/desktop-migration/codex/anvil-web-compose-hotfix` | `1a07ab97baec4bc3b1102aca0724fb7286b83999` | present | present/matched |
| `refs/heads/codex/anvil-web-preserve-host` | `refs/remotes/desktop-migration/codex/anvil-web-preserve-host` | `df5ced2cb5d65b89cc6a4efcfff8921f80816e04` | present | present/matched |
| `refs/heads/codex/anvil-web-unified-api` | `refs/remotes/desktop-migration/codex/anvil-web-unified-api` | `d8c989afe16a9d4795e7de97d80b4aff88d4685c` | present | present/matched |
| `refs/heads/codex/anvil-web-unified-api-main` | `refs/remotes/desktop-migration/codex/anvil-web-unified-api-main` | `db62bd22dce191c0f65a25c4d19182372b4b2c79` | present | present/matched |
| `refs/heads/codex/anvil-web-unified-api-retry` | `refs/remotes/desktop-migration/codex/anvil-web-unified-api-retry` | `d8c989afe16a9d4795e7de97d80b4aff88d4685c` | present | present/matched |
| `refs/heads/codex/anvil-web-unified-deploy` | `refs/remotes/desktop-migration/codex/anvil-web-unified-deploy` | `32351bcd25a034551868d5b2890b459f4e71310f` | present | present/matched |
| `refs/heads/codex/c21-deploy-evidence` | `refs/remotes/desktop-migration/codex/c21-deploy-evidence` | `ed82e9300f4afc07a69c693aed604aac59936e22` | present | present/matched |
| `refs/heads/codex/c21-deploy-evidence2` | `refs/remotes/desktop-migration/codex/c21-deploy-evidence2` | `39e6476afe995713a0bb5c68344661ed28d7ad3c` | present | present/matched |
| `refs/heads/codex/c21-deploy-incident-fix` | `refs/remotes/desktop-migration/codex/c21-deploy-incident-fix` | `7d4a15ab62860a38a82c6ef485b035b564f9dde0` | absent | present/matched |
| `refs/heads/codex/c21-host-metadata-impl2` | `refs/remotes/desktop-migration/codex/c21-host-metadata-impl2` | `cde3f181a41eebb7ef8603b410ee8d6ddb471c1a` | absent | present/matched |
| `refs/heads/codex/c21-ops-r2-instruction` | `refs/remotes/desktop-migration/codex/c21-ops-r2-instruction` | `48ac226f685e92d2c9707fe82a2b864fc25938ed` | present | present/matched |
| `refs/heads/codex/c21-ops-r2-wi` | `refs/remotes/desktop-migration/codex/c21-ops-r2-wi` | `e27b554f1bb9ef41ec1e11f20669670df5027795` | absent | present/matched |
| `refs/heads/codex/c21-public-tls-blocker` | `refs/remotes/desktop-migration/codex/c21-public-tls-blocker` | `9d7db1abc22c3345979d0570542f3d473365d289` | present | present/matched |
| `refs/heads/codex/c21-run-event-writer` | `refs/remotes/desktop-migration/codex/c21-run-event-writer` | `80105dba9f8669409c5223833e1e112215bb5f68` | absent | present/matched |
| `refs/heads/codex/fix-alembic-psycopg2-runtime` | `refs/remotes/desktop-migration/codex/fix-alembic-psycopg2-runtime` | `99c9e5dfef674b53cc6835a484e88bd194bc9ca1` | absent | present/matched |
| `refs/heads/codex/fix-public-auth-proxy` | `refs/remotes/desktop-migration/codex/fix-public-auth-proxy` | `9d4110dc77b438e1ab1571168daa8b94f4d6256e` | absent | present/matched |
| `refs/heads/codex/implement-session-auth-sse` | `refs/remotes/desktop-migration/codex/implement-session-auth-sse` | `4151b8615a4c20e70e015784b7006b3e62bdbe19` | absent | present/matched |
| `refs/heads/codex/npm-custom-override-removal` | `refs/remotes/desktop-migration/codex/npm-custom-override-removal` | `0079699e8ca589d983568906b0ccc20910cf4037` | present | present/matched |
| `refs/heads/codex/npm-dns-refresh-design` | `refs/remotes/desktop-migration/codex/npm-dns-refresh-design` | `28caa38ed20594e6110b930e12e876da21dbdc9b` | present | present/matched |
| `refs/heads/codex/unified-public-runtime` | `refs/remotes/desktop-migration/codex/unified-public-runtime` | `a962bdfb6ba0e9c057907be8ee88909793bbf6ce` | present | present/matched |
| `refs/heads/codex/unified-runtime-manifest` | `refs/remotes/desktop-migration/codex/unified-runtime-manifest` | `b7f3429e7dc82ac7485dc9c8169cf8c33c07196c` | present | present/matched |
| `refs/heads/codex/unified-runtime-r2` | `refs/remotes/desktop-migration/codex/unified-runtime-r2` | `54a36509ae3839b77725c4a98ee37d386f77ef3c` | present | present/matched |
| `refs/heads/codex/unified-runtime-r3` | `refs/remotes/desktop-migration/codex/unified-runtime-r3` | `cb3afcdd5971c7497b4c0044d3ee52479c59da59` | present | present/matched |
| `refs/heads/codex/unified-runtime-r4` | `refs/remotes/desktop-migration/codex/unified-runtime-r4` | `22eb0e98eb302b3326be5ed6e66e63ae15349f9e` | present | present/matched |
| `refs/heads/codex/ysna-internal-deploy` | `refs/remotes/desktop-migration/codex/ysna-internal-deploy` | `b36b6e604bf4062bffe316bb09de1fb724e8896c` | present | present/matched |
| `refs/heads/main` | `refs/remotes/desktop-migration/main` | `13040fef646460e88bf8b47f54459cdce1855e62` | present | present/matched |
| `refs/tags/anvil-ui-preview-20260814.1` | `refs/tags/desktop-migration/anvil-ui-preview-20260814.1` | `ae5742e1173e95532f3c2b78b5c6c891e305f015` | present | present/matched |
| `refs/tags/anvil-ui-preview-20260901.1` | `refs/tags/desktop-migration/anvil-ui-preview-20260901.1` | `995411f72ac0115b5afbf9842f18a4bca0512904` | present | present/matched |
| `refs/tags/anvil-ui-preview-20260901.2` | `refs/tags/desktop-migration/anvil-ui-preview-20260901.2` | `c42015fcbd0d0ba71a116e98e6f213bfa806accd` | present | present/matched |
| `refs/tags/anvil-ui-preview-20260901.3` | `refs/tags/desktop-migration/anvil-ui-preview-20260901.3` | `029186aa12c43ae0d132355d56046ba5798c4ee4` | present | present/matched |
| `refs/tags/anvil-ui-preview-20260901.4` | `refs/tags/desktop-migration/anvil-ui-preview-20260901.4` | `df5ced2cb5d65b89cc6a4efcfff8921f80816e04` | present | present/matched |
| `refs/tags/anvil-ui-preview-20260901.5` | `refs/tags/desktop-migration/anvil-ui-preview-20260901.5` | `16552d7468a82b4a8a9e222c35625f0e6f3bc1be` | present | present/matched |
| `refs/tags/anvil-ui-preview-20260902.1` | `refs/tags/desktop-migration/anvil-ui-preview-20260902.1` | `39af02811802e2464bb3f2a7a4a8ff0adc7f06c0` | present | present/matched |
| `refs/tags/anvil-ui-preview-20260902.4` | `refs/tags/desktop-migration/anvil-ui-preview-20260902.4` | `147ea509bfa29e54de0e05f9098f3c38215c3ab7` | present | present/matched |

## 격리 worktree와 통합 이력

- 임시 resource: `D:\tmp\anvil-canonical-migration`; 목적은 canonical migration branch의 격리 검증, lifetime은 이 branch 검토가 끝날 때까지, cleanup은 별도 승인 후 `git worktree remove`로만 수행한다. 이 보고 시점에는 보존한다.
- branch: `codex/canonical-source-migration`, 생성 기준 `origin/main` `13040fef646460e88bf8b47f54459cdce1855e62`.
- `refs/remotes/desktop-migration/codex/c21-deploy-incident-fix` (`7d4a15ab62860a38a82c6ef485b035b564f9dde0`)에 대해 `git merge-base --is-ancestor origin/main <ref>`가 성공했고 `origin/main..<ref>`의 commit 수는 정확히 3개였다.
- `git merge --ff-only` 적용 후 HEAD: `7d4a15ab62860a38a82c6ef485b035b564f9dde0`.
- 통합 commit:
  - `3a35ade16360edb7beaa44e8f75bd7617f252ff6` — `docs(c21): record r3 operational verification`
  - `71d0f6321d9bfba9a721df232d46134b11799bf4` — `fix: harden c21 deployment recovery evidence`
  - `7d4a15ab62860a38a82c6ef485b035b564f9dde0` — `fix: verify public rollback recovery`

## 검증과 증거 등급

| 검증 | 결과 | 증명 범위 |
|---|---|---|
| `git diff --check origin/main..HEAD` 및 working diff check | PASS | 통합 3 commit과 migration 문서의 whitespace 오류 없음 |
| manifest/receipt JSON parse 및 SHA-256 binding | PASS | `C-21_R3_EVIDENCE_MANIFEST.json`의 receipt checksum `d9ace4c2dadf5029ec9fb90b8c6c197a619414fe7ea46978d5042903b3cd770c`가 실제 파일과 일치 |
| `bash -n` (bootstrap/deploy/rollback/remove-NPM scripts) | PASS | shell syntax만 검증 |
| `tests/deploy` | PASS | D tmp 기준 fresh 분할 실행 46건(26 static + 20 pipeline) PASS. 자세한 harness 보정 이력은 아래에 기록했다. |

`C-21_R3_EVIDENCE_MANIFEST.json`의 운영 증거 분류는 기존대로 `PARTIAL`이며, 이번 migration의 Git·정적·fixture 검증은 실제 운영 deploy, DB/NPM/Telegram/Provider, 브라우저 또는 device PASS가 아니다. 해당 외부 범위는 재실행하지 않았다.

### D drive test harness 보정

- 오류 횟수: 1회. D tmp focused RED에서 rollback fixture 2건이 `FileNotFoundError`로 실패했다.
- 원인: `_posix()`는 `D:\...`를 `/d/...`로 올바르게 변환하지만, 두 assertion이 `/c/`만 `C:/`로 역변환해 `Path('/d/...')`를 만들었다. 제품 deploy/rollback script 실행 전의 test harness 오류였다.
- TDD: 기존 2건의 focused RED 후, `/c/tmp/fixture`와 `/d/tmp/fixture` 모두를 검증하는 새 helper contract를 먼저 추가했다. helper 부재 `NameError` RED를 확인한 뒤 `_windows_path_from_posix()`를 최소 구현하고 기존 두 hard-coded `.replace('/c/', ...)` 호출만 교체했다.
- GREEN: helper + affected rollback focused 4 PASS. 이후 `tests/deploy` fresh 46 PASS(26 static + pipeline 7/2/2/2/4/3)로 전체 회귀를 확인했다. C drive도 새 helper contract로 유지한다.

## 미수행과 rollback

- push, main merge, release tag 생성, 배포, 외부 서비스 mutation 및 Desktop 삭제는 미수행이다.
- 이 branch의 rollback은 commit을 사용하지 않은 경우 branch/worktree를 보존하고 검토한다. 승인된 rollback이 필요하면 migration branch만 `origin/main` 기준으로 별도 처리하며, D root·Desktop 원본은 대상이 아니다.

## 이관 후 실제 상태 기록

- 원격 확인: `origin/main`과 `refs/heads/codex/canonical-source-migration`은 모두 `b9f0f44054d4f2574cc8888efa7f627b1d666ca7`이다. migration branch의 b9f0f44 push는 성공했으며, 원격 main은 이 문서 commit으로 fast-forward하지 않았다.
- 이후 작업 기준선은 `origin/main` `b9f0f44054d4f2574cc8888efa7f627b1d666ca7`이다.
- D local `main`은 `c49b7534012d97ad130483c1ff255c0db1e99df4`로 stale 상태다. `git branch -f main`은 `C:\Users\cyhuh\Desktop\D Driver\Project\Anvil\.worktrees\ysna-internal-deploy`가 `main`을 사용하는 stale D worktree registry 때문에 거부됐다.
- Desktop 삭제와 Git metadata 강제 제거는 수행하지 않았다. D root/desktop의 보호 dirty·untracked도 변경하지 않았다.
- 다음 조치: Desktop 폐쇄 후 exact stale worktree entry를 검증하고, 그 다음에만 prune/repair를 수행한 뒤 D local `main`을 `origin/main`으로 fast-forward한다. 이 순서 전의 강제 branch 이동·metadata 제거는 금지한다.
