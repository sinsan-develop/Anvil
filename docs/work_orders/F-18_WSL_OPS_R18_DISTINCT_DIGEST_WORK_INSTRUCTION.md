# F-18 R18 Distinct Worker Digest WorkInstruction

- 담당: `developer-primary` 단일 제품 writer. Main은 canonical 통제·독립 검토·push·lease 종료를 소유한다.
- 기준: 승인 설계 v2.8 SHA-256 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 v1.7 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; F-18 기본 WorkInstruction 단계1과 `F-18_WSL_OPS_R18_DISTINCT_DIGEST_PLAN.md`.
- 분류: 승인된 세 역할 image digest requirement를 existing preflight에 반영하는 `MAIN_RECONFIRMED_NON_SEMANTIC`; 부모 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`. 공개 API·Secret·인증/권한·DB schema·운영 배포 변경 없음.
- 제품 exact4: `packages/deployment/promotion_preflight.py`, `tests/deploy/test_f18_promotion_preflight.py`, `tests/deploy/test_f18_wsl_operational.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. 다른 제품·control·progress 경로는 쓰지 않는다. canonical worker/write lease 두 fencing token·시작 HEAD/branch/만료를 확인하기 전 쓰기 금지.
- 실행: Plan Task1 RED→GREEN; 관련 F-16/F-17/F-18 회귀·전체 pytest 시도·diff-check; exact4 clean commit. 기존 reason code와 fail-closed 순서를 지키며 테스트 fixture가 실제 image 관측으로 승격되지 않음을 보고한다.
- 금지: 새 branch, Subagent 원격 push·WSL/Docker/DB 실행, Compose/운영/`ysna-server` 변경, broad refactor. Main이 실제 WSL image/manifest/capability QA를 별도 수행한다.
- 보고: 기준 hash, 시작 HEAD/branch/status, exact4 diff, RED/GREEN 정확한 명령/exit, 관련 PASS/FAIL·미검증, rollback. progress/HANDOFF는 Main만 갱신한다.
