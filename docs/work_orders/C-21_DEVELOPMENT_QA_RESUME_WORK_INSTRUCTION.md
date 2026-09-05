# C-21 Development QA Resume WorkInstruction

- ID: `WI-C-21-DEVELOPMENT-QA-RESUME-20260905-001`
- Parent: `4178ae78db2c48e176e8543364d09787e54bb4ad`
- Worker: `developer-primary`
- Worker lease: `worker-lease-c21-development-qa-resume-20260905-001`
- Write lease: `write-lease-c21-development-qa-resume-20260905-001`

## 실행 권위와 검토 입력

- 이 tracked WorkInstruction이 exact7 실행의 canonical authority다.
- `D:\tmp\anvil-seq499-qa-resume-proposal-20260905.md`는 `SCRATCH_ONLY_MAIN_REVIEW_INPUT_NOT_AUTHORITY`다. 설계 검토 입력일 뿐 승인·실행 권위·human approval binding이 아니다.
- seq498 Git blob 전체 파일은 `882505` bytes / `B9C412B586999C2DCD530B7E6EDD283CE3A124BF4E98B08F8673A3184D641F78`이다. 현재 append-only 파일 안 seq1~498 event object prefix는 별도 범위인 `882302` bytes / `3659A9808E97F6927E983CFCCD617BF5B1740D60CCDFE16D39D8107C8780C955`다. 두 수치를 서로 대체하지 않는다.

## 목표

seq498을 보존하고 Agent가 수행할 수 있는 C-21 개발 QA를 재개한다. Provider adapter/registry/config/MoA test-double, Telegram outbound-free 실제 WSL webhook/DB audit, browser page.evaluate/fetch same-origin SSE를 검증한다.

## 정확한 쓰기 범위

`deploy/wsl/verify-c21-development-boundaries.sh`, `tests/agent_team/test_c21_provider_nonbilling_qa.py`, `tests/api/test_c21_telegram_outbound_free_qa.py`, `tests/browser/c21-network-probe.mjs`, `docs/04_test_reports/C-21_DEVELOPMENT_QA_EXECUTION_REPORT.md`, `docs/evidence/manifests/C-21_DEVELOPMENT_QA_EXECUTION_MANIFEST.json`, `docs/validation/C-21_DEVELOPMENT_QA_EXECUTION_VALIDATION.md`의 exact7만 수정한다.

## 경계

- 제품 UI·runtime Provider API를 임의 구현하지 않는다.
- Provider runtime status/model/capability/drift port는 `NOT_IMPLEMENTED_RUNTIME_PROVIDER_STATUS_PORT`다. test-double PASS로 닫지 않는다.
- browser 증거는 `PAGE_EVALUATE_FETCH_SCOPE_ONLY`이며 UI click 또는 최종 운영 internal-address-zero 증거가 아니다.
- Telegram은 synthetic identity/secret을 사용하며 outbound/setWebhook/real chat를 실행하지 않는다.
- ysna, release, main, 실제 Provider 호출, 운영 Secret 변경은 금지한다.
- WSL은 기존 두 exact Compose project와 두 disposable DB volume만 사용하고 종료 시 residue0을 남긴다.

## 완료

TDD, focused regression, 실제 WSL PG15/PG18RC 경계 검증, normalized browser ledger, Secret 0, cleanup residue0을 증거화한다. 실패와 미구현·미검증을 PASS로 승격하지 않는다.
