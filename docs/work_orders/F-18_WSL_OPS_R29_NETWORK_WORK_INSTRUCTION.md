# F-18 R29 내부망 WorkInstruction

- 기준: 신산님 승인 F-18 local·WSL-server 범위 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`; 설계서 v2.8 §49.11~49.12, 작업계획서 v1.7 F-18, 기본 `F-18_WSL_OPS_WORK_INSTRUCTION.md`, `F-18_WSL_OPS_R29_NETWORK_PLAN.md`.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`.
- `revision_classification=MAIN_RECONFIRMED_NON_SEMANTIC`. 승인된 F-18 network requirement의 내부 파일·검증 방법 확정이며 기능 범위·요구사항·중요 위험 변경이 아니다.
- 단일 writer `developer-primary-f18-wsl-ops-r29-network`. 정식 worker/write lease 두 token이 ACTIVE이고 exact path scope가 일치할 때만 제품을 수정한다. R18 token 재사용 금지.
- 제품 write exact3: `deploy/wsl/compose.f18.yml`, `tests/deploy/test_f18_network_topology.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. 그 밖의 source, test, docs, 통제 파일은 writer가 수정하지 않는다.
- RED→GREEN, 최소권한·내부망·host port 거부 및 F-17 회귀를 수행한다. 제품 구성 정적 PASS와 WSL 실제 Docker/HTTP/network PASS를 구분한다. 실패·미실행·SKIP은 그대로 기록한다.
- `ysna-server`, Production, 기존 WSL 서비스/DB·공개 도메인, OIDC 제품 세션·DB schema·Secret·외부 egress 정책 변경은 범위 밖이다. F-18 accepted=false, F-19 차단을 유지한다.
- Main이 독립 review·동일 SHA WSL 검증·자원 정리를 소유한다. 완료보고는 판정→판단 이유→조치, 정확한 명령·exit·diff·잔여 위험·rollback 포함.
