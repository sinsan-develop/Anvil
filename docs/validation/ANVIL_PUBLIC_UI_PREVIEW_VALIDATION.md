# Anvil Public UI Preview Validation

## Scope

- Public target: `https://anvil.sinsan.kr`
- Server root: `~/deploy/anvil`
- Compose service: `anvil-web`
- Internal port: `3770`
- Network: existing external `proxy-network`
- Mode: read-only `UI_PREVIEW`
- API, DB, LLM, Agent, Provider, and business mutations: `NOT_CONNECTED`

The preview does not connect to or mutate `shared-db`. Nginx Proxy Manager and all protected containers, volumes, and networks must remain unchanged.

## Local verification

| Check | Actual result |
| --- | --- |
| Web model, shell, runtime, existing Workbench | 14/14 PASS |
| Existing A-14 browser security runtime | 3/3 PASS |
| Deployment contracts and scripts | 8/8 PASS |
| WSL Compose config | PASS |
| WSL image build | PASS, `sha256:0908ab30122791ad14b0f13b2556fc54b20ff6e40657d1f40102fe3574953444` |
| 1920x1080 in-app browser | 11 menus, 6 Workbench tabs, Eoul drawer, unavailable action, console all PASS |
| Secret-pattern scan in changed runtime/deploy scope | no matches |
| `git diff --check` | PASS |

Full tooling ran 287 tests: 273 PASS and 14 FAIL. The failures are classified as canonical projection/evidence mismatches caused by this isolated feature branch changing the A-14 frozen `apps/web/server.mjs` checksum and not yet being the canonical main progress branch. No focused web, browser-security, or deploy-contract failure was observed. These failures are not represented as PASS.

## Deployment gate

The server preflight found no `anvil-web` container, no `~/deploy/anvil/repo`, and therefore no upstream at `anvil-web:3770`. This is the confirmed cause of the NPM 502 response. Deployment must use the approved Git SHA and annotated release tag; source `scp` and direct server patching are forbidden.

## Rollback

Use `deploy/ysna/rollback-public-preview.sh` with the prior approved SHA recorded in `~/deploy/anvil/evidence/public-preview-deploy.json`. The rollback recreates only the `anvil-web` service and does not mutate `shared-db`, NPM, networks, or volumes.

