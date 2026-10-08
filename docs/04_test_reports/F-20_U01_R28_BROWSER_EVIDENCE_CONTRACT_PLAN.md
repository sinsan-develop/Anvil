# F-20/U-01 R28 브라우저 증거 계약 보정 계획

## 판정과 범위

- R27 동일 SHA `f9ee3a3a721f9abf1794bfe440b540ac4aa395ab`의 WSL-server PG15/OIDC/HTTPS/Chromium 실제 브라우저 흐름은 끝까지 실행됐으나 Python 최종 증거 사전이 신규 R27 필드를 거부해 `R6_BROWSER_EVIDENCE_MISMATCH`로 실패했다. R27·U-01/F-20은 미수락이다.
- 승인된 설계서 §29.2·작업계획서 U-01·R27 수동 새로고침을 검증하기 위한 내부 테스트 계약 보정만 한다. 제품 동작, 공개 API, DB/schema, 인증·권한·Secret, 운영·비용·기능 범위는 변경하지 않는다.
- 기존 `codex/f18-wsl-ops`에서만 순차 수행한다. 새 branch/main/ysna/Production 작업은 없다.
- R27 epoch41 두 lease를 `INCOMPLETE_EVIDENCE_CONTRACT_REWORK`로 회수하고 제품 write scope를 비운 뒤, 새로운 epoch42 dual lease와 R28 WorkInstruction을 발급한다. 동시에 두 writer lease를 활성화하지 않는다.

## Task 1: 신규 R27 증거의 정확 계약

**Developer allowed paths (exact2):** `tests/integration/test_f20_u01_oidc_browser_pg15.py`, `docs/04_test_reports/F-20_U01_R28_BROWSER_EVIDENCE_CONTRACT_RESULT.md`.

1. R27 Node evidence의 새 필드를 먼저 열거하고, 4차 실측 실패를 RED 근거로 보존한다. 비 opt-in 자기검증은 추가된 필드가 누락·왜곡·추가될 때 실패하도록 한다.
2. Python 최종 evidence 검증에서 R27 필드의 키와 값·상호 관계를 엄격히 검사한다. 단순 무시, 삭제, 범용 허용, 기존 R6/R23~R26 검증 약화는 금지한다. 실제 `observed_at`·요청 횟수·403 보호값 제거·503/invalid fail-closed·키보드 재조회와 독립 카드 조건을 검증한다.
3. Python 비 opt-in, Node console/browser 자기검증, typecheck/lint/build, G-05, diff check를 기록한다. Main은 독립 검토 후 기존 branch commit/private push→WSL-server 동일 SHA 신규 격리 PG15/OIDC/HTTPS/Chromium opt-in·PNG/Network 검토·전용 자원 잔여0을 확인한다.

R28 PASS는 이 브라우저 증거 계약 보정에만 해당한다. Product/Environment/기간 필터·전체 7상태·독립 Tester/C30·U-01/F-20 수락은 별도 미충족으로 남긴다. Rollback은 R28 exact2 변경만 정상 Git revert한다.
