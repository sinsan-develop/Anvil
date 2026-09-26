# F-18 R43C WorkInstruction — Worker head 및 QA HTTPS proxy 보정

- 담당 `developer-primary`, Main 어울 관리. 상위 F-18 승인 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`, R43 계획, R43B2 runtime 실패 증거에 종속한다. branch `codex/f18-wsl-ops`; seq1656 이후 새 epoch의 ACTIVE worker/write lease 두 fencing token·G-05 PASS 이전 제품 write 금지.
- 제품 exact5는 `apps/worker/anvil_worker/main.py`, `deploy/wsl/compose.f18.oidc.yml`, `tests/integration/test_f15_local_stack.py`, `tests/deploy/test_f18_oidc_formal_host_contract.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`다. 다른 제품/control/progress 파일 수정 금지. 범위 확대가 필요하면 mutation 전에 Main에 보고한다.
- RED→GREEN: Worker는 기본 F15 head0016을 보존하고 명시 OIDC 모드에서만 head0019를 요구한다. 지원하지 않는 mode 및 잘못된 DB head는 비준비·비밀 비노출로 거부한다. 기동과 주기 점검에 동일 계약을 사용한다.
- QA overlay API `FORWARDED_ALLOW_IPS`는 필수 외부 변수 `ANVIL_F18_WEB_PROXY_IP`의 정확한 단일 Web internal IP만 받는다. wildcard/CIDR/비어 있는 값은 계약에서 거부한다. Worker에 `ANVIL_AUTH_MODE: OIDC`만 추가한다. 기존 HTTP Compose·역방향 프록시·API 코드의 신뢰 범위는 바꾸지 않는다.
- 테스트는 F15 기본 회귀, OIDC head 허용·오류 거부, overlay env/서비스 노출 회귀를 포함한다. 변경 전후 diff, 정확한 명령/exit/result, 미검증, rollback을 F-18 보고서에 기록한다. WSL 접속·Docker up·credential 생성·push·control/progress 수정은 Main 소유이며 Developer는 실행하지 않는다. 로컬 PASS를 R43/F-18 인수로 쓰지 않는다.
