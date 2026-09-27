# F-18 R30 OIDC Principal Binding WorkInstruction

- 담당: `developer-primary`; Main은 canonical lease·통제·독립 검토·원격 push와 종료를 소유한다.
- 기준: 승인된 F-18 기본 WorkInstruction 단계3과 `F-18_WSL_OPS_R30_OIDC_PRINCIPAL_PLAN.md`. 설계/계획/매트릭스/테스트계획 SHA-256은 기본 WorkInstruction에 기록된 기준을 유지한다. Main invocation이 canonical seq1581·epoch14 worker/write lease와 시작 HEAD를 고정한다.
- 분류: 승인된 OIDC 신원·역할·승인 scope 검증의 내부 구현 계약이다. 기능 범위·요구사항·중요 위험과 공개 API·권한 의미를 확대하지 않는 `MAIN_RECONFIRMED_NON_SEMANTIC` revision이며 부모는 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`이다.
- 제품 exact3: `packages/api/oidc_principal.py`, `tests/api/test_oidc_principal.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.
- 목표: 검증된 OIDC identity와 별도 신뢰 resolver 반환값을 policy 상한 안에서 교차 검사하고 기존 `SessionPrincipal`을 생성한다. 미등록·불일치·권한 초과·step-up 미충족은 redacted fail-closed다.
- 금지: 이 결과를 OIDC token 검증/실제 login/session/API/WSL issuer PASS로 주장, token role/scope claim 신뢰, local test session 우회, DB schema·migration·Secret·API route·Compose·network 변경, 다른 제품 파일 수정, 새 branch/subagent, WSL/Production 자원, 제품 writer의 원격 push/merge.
- 실행: 계획의 RED→GREEN, 관련 회귀·전체 pytest 시도·diff-check 후 exact3 clean commit. 원격 QA·canonical 종료는 Main이 한다.
- 보고: 기준 hash, 시작 HEAD/branch/status, exact3 diff, 명령/exit/PASS·FAIL·SKIP, 후속 영속 mapping/session/API/issuer/browser/WSL·Production 미검증, rollback, 정식 실패 횟수. progress/HANDOFF는 Main만 갱신한다.
