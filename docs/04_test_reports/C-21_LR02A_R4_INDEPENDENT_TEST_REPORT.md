# C-21/LR-02A Main takeover R4 independent test report

## 판정

`COMPLETED / PASS / READY_FOR_MAIN_ACCEPTANCE`

Fingerprint `LR02A_CANONICAL_DEPLOY_CONTRACT_NONEXECUTABLE_R1`의 세 차단 조건은 최신 R4 코드와 실행형 검증에서 해소됐다. Blocking finding은 0건이다.

## 검토 기준

- `deploy/ysna/deploy.sh`: `EC65B0E3AF00AE532A96E2EB4CC7868091B0340DED6E3B51D1A9DD79CD8CCBD6`
- `deploy/ysna/verify.sh`: `64972279721BB155E2F67D75566B56E200FCD7F3245423B45F8D78C46872F35A`
- `deploy/ysna/rollback.sh`: `58B1C1B77B6B8EEED281D1538907077DD689E38D41B154EA564EC2BBA6DD5FF9`
- `tests/deploy/test_ysna_scripts_contract.py`: `B81008EF744342677BA2EB13C869A34B29118DADD86412F4FD458C0035764F5B`

## 독립 판단 근거

1. Target commit compose/verify asset은 Git blob hash를 검증해 versioned 경로에 원자적으로 보존되고 pointer도 temp+`mv`로 교체된다. 최초 전환 전 실행 image의 OCI revision과 current checkout SHA가 일치해야 하며, full-SHA image tag로 보존한 뒤 rollback은 `--no-build`로 사용한다.
2. Git Bash 격리 harness가 canonical deploy, verify, rollback 본문을 정상 경로로 실행한다. image revision/tag, target asset hash, 0012→0013 migration, auth POST, Telegram POST auth boundary, authenticated SSE, Last-Event-ID 및 rollback no-build 호출을 확인한다.
3. Telegram route probe는 secret header 없는 pre-DB 403과 애플리케이션 고유 `webhook authentication failed` body를 모두 요구한다. Generic proxy 403은 거부된다.
4. SSE Content-Type은 대소문자 독립적으로 검사하며 resume event id가 initial id와 달라야 한다. Last-Event-ID 무시 및 동일 stream 재전송은 거부된다.
5. Runtime test-session 필수 5개 변수(actor/project/environment 포함)를 deploy preflight가 강제한다. `/api/providers` 성공 오판은 제거했고 OpenAPI 계약과 실제 authenticated SSE를 분리해 검증한다.
6. Bootstrap token은 stdout, stderr, evidence와 harness log에 노출되지 않았다.

## 실행 증거

- `bash -n deploy/ysna/deploy.sh deploy/ysna/verify.sh deploy/ysna/rollback.sh`: exit `0`
- `git diff --check -- <R4 관련 6개 경로>`: exit `0`
- 핵심 deploy/auth/SSE 선택 8개 파일: `66 passed in 74.16s`
- PyYAML 의존 파일 1개를 제외한 전체 deploy/API: `132 passed in 85.50s`

## 미검증 및 경계

- `tests/deploy/test_anvil_public_preview_contract.py`는 현재 `.venv`에 `yaml` 모듈이 없어 collection 단계에서 `ModuleNotFoundError: yaml`이다. Canonical `anvil-web:3770` R4 대상이 아닌 legacy preview 계약이며 R4 제품 실패로 산정하지 않는다.
- 실제 Docker, SSH, DB, NPM, DNS, browser, 배포, 정상 서명 Telegram POST, Provider 호출은 `NOT_EXECUTED`다.
- Reviewer는 파일 수정, commit, push 또는 외부 side effect를 수행하지 않았다.
