# FN03/UI06 버전별 산출물 항목 귀속 구현 지시서

## 직접 채택과 목표

docs/approvals/FN03_STAGE_ARTIFACT_ITEM_BINDING_SOURCE_20261116.json은 신산님 직접 지시(2026-11-16T12:30:14Z, PMO 원 userMessage01a1e456-2c67-7af1-b2f8-6af5d404ce5c)를 기록한다. 고정 계약 docs/contracts/FN03_STAGE_ARTIFACT_ITEM_BINDING_CANDIDATE_20261116.md SHA5039D14A2D5E2B6BE0E48172FE1FBACF9ECA98B4F18CF618C33AC3FC3C29A75B는 source/RAM·미적용0099 범위로 채택됐다. 제목의 후보/미채택 문구는 그 당시 동결 원문이며 이번 승인 기록이 상태를 갱신한다. 원문 지문을 고쳐 승인 대상을 바꾸지 않는다.

기준 mainc53d8619, 현재 codex/av3-stage-output-binding/승인기록37285fc4. 기존 UI06 로컬 선택(PR153)의 원 buffer·불변 선택·파생 편집·ABA/late/실패 보호를 유지하면서, 명시적으로 선택한 B를 그 저장 버전에 귀속하고 기존 정확 상세 GET으로 검산한다. 본문 hash 정본·섹션 itemId 의미와 과거 문서는 변경하지 않는다.

## 단일 writer와 정확 경로

기존 developer_primary만 제품을 수정한다. Main은 승인·현황·검수·Git/통합, d2_preflight는 별도 승인된 CLI 읽기1회와 그 결과문서1개만 맡는다. 서로의 파일·진행 변경을 되돌리지 않는다.

제품:
1. apps/server/modules/documents/document-stage.ts
2. apps/server/modules/documents/project-documents.ts
3. apps/server/modules/documents/project-proposals.ts
4. apps/web/src/features/design-trace/stage-document-draft.ts
5. apps/web/src/features/design-trace/editor-api.ts
6. apps/web/src/features/design-trace/api.ts
7. apps/web/src/features/design-trace/document-upload-approval.ts
8. apps/web/src/features/design-trace/conflict-api.ts
9. apps/web/src/features/design-trace/proposal-api.ts
10. apps/web/src/features/design-trace/DocumentEditor.tsx
11. apps/web/src/features/design-trace/DocumentsPage.tsx
12. db/migrations/0099_document_stage_output_item.sql.pending

시험: tests/unit/FN03/document-stage.test.ts 및 새 tests/unit/FN03/stage-output-item-binding.test.ts; tests/unit/UI06/stage-document-draft.test.ts, editor-api.test.ts, document-upload-approval.test.ts, conflict-api.test.ts, proposal-api.test.ts, form-document-outline.test.ts, prepared-stage-output-ui.test.ts; tests/integration/FN03/document-stages.test.ts. 결과: docs/04_test_reports/AV3/FN03_STAGE_ARTIFACT_ITEM_BINDING_SOURCE_RESULT_20261116.md.

표준 schema/types 등 승인 의미를 구현하는 데 필수인 추가 경로가 있으면 정확 경로·호출선·이유를 Main에게 반환한다. Main이 내부 배치로 WI를 보완하며 같은 계약에 대해 사용자 재승인을 묻지 않는다. 새로운 의미/권한/키/실제 실행은 임의 추가하지 않는다.

## 구현·검수 계약

고정5039D14A의 표/호환·승인/불명/원요청 역검산/감사·quota·backup 의미를 따른다. stageOutputItem exact {applicationRef,itemId}, 원 stage/form 및 같은 project 고정 snapshot의 node.outputs item/form을 전부 검산한다. 원 version.command_id의 APPLIED/save 영수증·원 request_hash/authorization/audit를 결박하고 키 소실과 구형 미기록을 구분한다. 구형 단일 출력도 추정하지 않는다. 같은 양식 A/B 중 B만 반환하고 섹션 A는 유지한다.

현재 적용본 쓰기와 고정 과거 읽기를 구분한다. B 뒤 적용본 교체는 과거 조회 허용·개정/제안409·입력/원버전 보존·새 버전0이다. CAS·동시 적용 직렬화·개정의 동일 귀속·제안/승인 payloadHash 및 A 승인으로 B 저장0, 동일 명령 replay/불명 reconciliation-first를 유지한다. 새 audit 이유 EXPLICIT_DOCUMENT_DRAFT_STAGE_OUTPUT과 영수증/감사 역검산은 채택 대상에 포함됐다. 기존 업로드 승인으로 save를 허가하지 않는다.

0003 등 적용/기존 SQL을 고치지 않는다. 새 forward guard만 미적용 상태로 작성하고 기존 RLS/불변 보호·권한을 느슨하게 하지 않는다. 서버 명령/버전 INSERT·영수증/audit 정착 순서를 실제 코드와 대조해 같은 거래의 완결성을 검증한다. 아직 없는 원문을 GUC/모의 callback으로 권위 있게 재구성했다고 하지 않는다. 원 영수증 없는 inventory는 UNKNOWN이며 새 전체 백업 포맷을 만들지 않는다. 기존 quota를 임의 확장하지 않는다.

직접 순수/RAM·실제 제품 경로의 정상 저장→정확 재조회와 중요 거절, 기존 로컬 선택/본문·승인·제안 회귀, root 타입·필요 메모리 web 빌드·SQL 정적 검사를 선택한다. 실제 PG/RLS/경쟁/served UI 검증은 이번 실행 범위가 아니다. env/config/public 디렉터리 읽기·파일출력/새서비스 없이 가능한 기존 RAM 검증을 사용한다. 미적용 SQL을 실행하지 않는다.

실제 DB/권한 적용·키·서비스/설치·CLI/SDK/Agent/유료호출·C# 및 사용자 원문/백업 조사·추가 SSH/SDK 조회는 제외한다. 같은 승인 질문 반복0. 결과에 파일별 SHA·정확 명령/exit·실패와 보완·미실행·rollback을 기록하고 동결/쓰기 반환한다. Main은 독립 검수·정확 commit/push/PR·trusted Broker·병합본 영향 검사·정리를 수행한다. source/RAM 통합을 실제 사용·DB 인수/전체 계획 완료로 승격하지 않는다.

## r2 내부 시험 경로 보완 — 의미·실행 범위 불변

원 버전 GET이 정상 구형도 실제 원 command/auth/audit를 검산하므로 원 영수증을 전혀 구성하지 않던 기존 RAM fixture의 영향이 확인됐다. 실제 영향시험에 필요한 경우에만 다음 시험 경로를 추가 허용한다: tests/unit/FN03/document-source-refs.test.ts, tests/unit/FN03/document-proposal-content-sources.test.ts, tests/unit/FN10/node-decision-fixture.ts, tests/unit/IX01/project-read-isolation.test.ts, tests/unit/UI06/document-source-observation.test.ts. 원 command·인증·감사의 실제 관계를 구성하며 일반 SQL 무조건 성공이나 누락 영수증의 legacy 채택으로 기대값을 낮추지 않는다. 제품·공개·권한 계약은 기존 직접 채택5039D14A 그대로이고 추가 실제 실행은 없다. Main 내부 검증 경로 보완이며 동일 승인 재요청 대상이 아니다. 최초 WI1CBC8735는 이전 배정 지문으로 보존한다.

## r3 내부 RAM fixture 배치 보완

동일5시험에 원 command/auth/audit 제작을 반복하지 않도록 tests/unit/FN03/document-stage-receipt-fixture.ts 한 경로를 추가 허용한다. 실제 save의 세 INSERT 인자를 보존하고 원키로 조회하는 RAM 보조함수와 명시 legacy seed만 담당한다. 제품 검산을 대신하거나 임의 SQL에 정상행을 반환하지 않는다. 새 프레임워크·제품·권한·실행 범위는 추가하지 않는다. r2 DCFB1BF5는 당시 내부 배정 지문이다.
