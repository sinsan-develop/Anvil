# E-03 R2 Corrective WorkInstruction

## 판정·권위

- ID: WI-E-03-R2-CORRECTIVE-20260917-001.
- Main 내부 corrective revision: MAIN_RECONFIRMED_NON_SEMANTIC_CORRECTIVE_REWORK.
- 원 WI `docs/work_orders/E-03_WORK_INSTRUCTION.md`, SHA256 `AB305CBEC74ABC20A2EF7B21A378F80018470642F673F0409FB6774602E61B03`와 seq1084 start binding을 부모로 한다. 원 WI/invocation/start manifest/digest 및 seq1~1084는 불변이다.
- 상위 계획 E-03와 기존 필수 계약 1~8을 그대로 적용한다. semantic_diff NONE, scope_expansion false. 기능 범위·요구사항·중요위험·제품 exact6·worker/write lease·fencing token 변경 없음. 새 사람 승인 요청 없음.

## 판단 이유

- R1 독립 spec ACCEPT C0/I0/M0, quality REWORK C0/I1/M1. 동일 `E03-SECRET-UNICODE-BYPASS-003` formal failure count2이며 세 번째 동일 실패 시 기존 takeover 규칙을 적용한다.
- NFKC 정규화로 새 percent escape가 드러나고 decode가 다시 fullwidth credential key를 만드는 조합을 기존 1-pass 검사에서 놓쳤다.
- JSON raw 문자열 선검사가 의미상 빈 null/list/map credential 값을 잘못 차단했다. 기존 D03 의미를 유지하는 parse-first 보완이다.

## 조치·제품 exact6

1. packages/agent_team/__init__.py
2. packages/agent_team/external_verifier.py
3. packages/api/external_verification.py
4. tests/agent_team/test_external_verifier_e03.py
5. tests/api/test_external_verification_e03.py
6. docs/04_test_reports/E-03_COMPLETION_REPORT.md

- 정규화/escape decoding의 bounded fixed-point를 요구하고 정해진 횟수 후 새 변환이 남으면 값 비노출 거부한다. stored/exported 원문과 checksum은 바꾸지 않는다.
- export/import/project/resolve 및 API 모두 검사하고 이전 버전이 수락한 artifact도 재검사한다. secret 원문·오류 유출0, 실패 partial import0.
- JSON artifact는 크기 제한·중복 key/비유한 수 거부의 strict parse 후 semantic key/value 검사. 빈 문자열/null/빈 list/map 및 안전한 한국어·전각 일반문구를 보존하고 nonempty nested secret은 거부한다. 비JSON transcript raw 검사는 유지한다.
- R1 source-role provenance와 TOCTOU 최종 fence 회귀를 유지한다. 실제 Provider/Claude/HTTP/DB/network/worker/운영 실행, 자동 승인/acceptance, Git mutation/E04 금지.

## 통제·검증

- 새 additive control은 본 WI, E-03_R2_CORRECTIVE_REVISION_MANIFEST.json, progress-handoff-detached-digest-e03-r2-corrective-revision.json 세 경로뿐이다. 기존 progress/events/HANDOFF/checker/test는 append-only successor projection으로 갱신하며 총 dirty exact18을 검사한다.
- seq1085 PACKAGE_REWORK_REQUESTED →1086 WORK_INSTRUCTION_REVISED. E03 IN_PROGRESS/R2, E04 NOT_READY, 기존 dual lease ACTIVE, pending approvals empty.
- 제품 RED→GREEN 후 focused, tests/agent_team tests/orchestration tests/artifacts tests/api, D03 domain, corrective/start control, canonical checker, compileall, diff-check.
- 보고는 COMPLETED/FAILURE_REPORT/INCOMPLETE/BLOCKED/CANCELLED이며 Developer 완료는 독립 합격이 아니다. 명령·exit·실제 수치·REWORK2·미검증·rollback을 남긴다. commit/push/acceptance는 수행하지 않는다.
