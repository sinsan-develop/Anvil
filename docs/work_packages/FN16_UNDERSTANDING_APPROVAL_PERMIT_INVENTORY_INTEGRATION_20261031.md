# FN16 승인 이해검토·permit 이력 — 내부 통합 WI

2026-10-31 / dispatch 전 독립 경계검토.
기준 codex/av3-stage-b c5568bcd72d5347d29e515490a3a1febe69acb2b.
승인된 FN09 이해검토 r1 A 및 WORK_PLAN FN16의 원문/승인/검토 이력 보존에 따른 내부 호환성 보완이다.

## 1. 실제 문제·변경 경계
understanding-permit-inventory.ts의 기존 evidence/이해검토 loop는 request.approvalRef=null을 재구성하고 소비 metadata가 있으면 거절한다.
현재 readUnderstandingHistory 및 실제 이해검토 store는 이미 승인 ref가 있는 원형을 지원한다. 새 공개 요청/응답 계약을 만드는 것이 아니다.
새 수집기는 해당 원승인·후보·소비 증빙을 같은 RR에서 검산하고 기존 동일 snapshot/익명 투영·sourceEvidence에 반영한다.
START/SEND permit loop·실행 허가·기존 프로젝트 차단·전체 coverage412·false/NOT_PERFORMED는 유지한다.

## 2. 단일 writer·정확2경로
기존 Primary 단일 writer, Main 문서·검수·통합, 기존 Reviewer 읽기. Main 같은 코드 수정0.
1. apps/server/modules/backups/understanding-permit-inventory.ts
시작 SHA256 32ACA4735DD465D0DE9A8B4103C8402A3261082F4D378470AE573E7B2DCBC5C5
2. tests/unit/FN16/understanding-approval-permit-inventory.test.ts
신규, 시작 때 부재 확인.
기존 understanding-permit 시험9941A4999AE0B2162102BB15C1EC037EDBB3C76F71460AA529DB978E88D54638와 schema162B6B1BE2B64A81AAB583E495637E7D667C425694DD90984F82DB6E0BB14127, FN09 승인 시험은 수정 없이 회귀한다.
현재 승인 producer·순수 helper·SQL·다른 collector/UI·보호3·Main 현황·Git은 Primary 수정 범위 밖이다.

## 3. 재사용·같은 RR 선택 읽기
- 기존 assertStoredUnderstandingApproval(row,entry)는 실제 SyntheticPgUnderstandingStore.list도 소비하는 순수 역사 검산 접점이다. 이를 재사용하고 현재 본인용 candidate.read/assertCurrent·실권한/현재기한을 과거에 재적용하지 않는다.
- review 원command에 연결된 approval_consumptions→approval_decisions→approval_requests와 understanding_review_approval_candidates, 해당 request/decision command·receipt/audit만 같은 RR/현재 actor에서 유한 선택 조회한다.
- source query의 operation은 reviewUnderstanding/requestApproval/decideApproval의 고정 세 경우와 선택 ID로 닫는다. DB의 임의 operation을 허용 목록으로 신뢰하거나 프로젝트 전체 승인/명령을 스캔하지 않는다.
- 후보는 기존0056의 명시12열 project_id,request_id,request_command_id,candidate_command_id,payload_hash,payload_json,created_by,client_id,control_generation,policy_ref,command_hash,created_at만 읽는다.
- 승인3표/보조 commands·receipt/audit도 실제 기존 DDL·검산 helper에 필요한 명시 열만 읽으며 SELECT *·무관 credential/challenge/파일 읽기0.
- 대상이 없는 AUTO 자료에서는 새 후보/승인표 조회를 강제하지 않는다. 대상이 있으면 missing/duplicate/extra selected row·table 오류·한도/기한을 실패로 닫으며 AUTO로 낮추지 않는다.
- 실제 row_bytes/metadata·keyset/최대200·선택집합·정렬·중복·회수/UNKNOWN·양끝 OWNER/동일 신원 보호를 유지한다. 현재 OWNER를 과거 creator/client로 위장하지 않는다.

## 4. 원명령·승인 검산
- 승인 actionScope는 targetRef=null/expectedVersion=실행 generation이다. 실제 review command는 targetId=executionId/expectedVersion=같은 실행 generation이다. 별도의 controlGeneration과 혼동하지 않는다.
- 후보 payload_json은 approvalRef=null인 원전체command이며 payload_hash=H(original.payload),command_hash=H(original)다. 실제 승인된 s.request는 정확 original+approvalRef이어야 하며 원 s.requestHash/c.request_hash를 그대로 검산한다.
- requestApproval의 payload는 {details,candidatePayload:originalCommand}다. 준비 승인 intent-only 형식으로 전용하거나 {details}만 재구성하지 않는다.
- 순수 helper에 전달하는 source row의 approval metadata는 선택한 실제 command/receipt/audit·승인 원행에서 구성한다. 누락 필드를 성공 값으로 채우거나 helper가 통과하도록 원 snapshot을 재봉인하지 않는다.
- helper만으로 끝내지 않고 collector의 원시각·현재 row/선택집합·request/decision 명령의 receipt/audit·논리 사건순서·정확 request/decision/consumption/candidate cardinality·중복/unused 검산을 유지한다.
- 기존 AUTO는 null 승인·null 소비/관련 row가 맞아야 하며 dangling 승인 metadata/다른 command 소비는 거절한다.
- snapshot.request를 승인 없는 것으로 바꾸거나 hash/익명 projection 의미를 바꾸지 않는다. 기존 raw request·주체 비반출/원hash 구분·미허가 flags와 공개 DTO 필드를 유지한다.
- 이 보완은 연결된 소비 후보의 검산이다. 모든 PENDING 후보/실행권한/전체 자료의 반출·복원을 완료했다고 주장하지 않는다.

## 5. TDD·검수
실제 승인 요청→별도 결정→승인 이해검토 저장 함수가 만든 원 snapshot/receipt를 collector가 거절하는 RED부터 확인한다.
실제 함수 소비와 auth/policy/현재 response·하위 read/DB 대역 범위를 분리해 보고한다.
정상 approved/AUTO 및 당시 정상 소비된 과거 만료·다른 현재 OWNER의 이력 조회를 확인한다.
source scope/target/execution generation/control generation 분리, 후보 payload/command hash·전체 tuple·원request/decision/소비·receipt/audit/시각·순번·누락/중복/unused 손상은 거절한다.
현재 비OWNER·현재 세션/수집기한·유한 한도 실패도 보존하며, 과거 내용에 현재 정책/기한을 다시 적용하지 않는다.
START/SEND permit·grant/command/proof/예약·false 필드의 기존 원형과 loop는 byte상 보존 가능한 범위를 유지한다. 실행/전달은 하지 않는다.
신규 및 기존 inventory/schema·FN09 승인 직접 회귀, typecheck/diff만 선택한다. 완료된35/38/32와 전체회귀·브라우저/실DB를 반복하지 않는다.
정확2지문/최소diff·명령/exit/RED·준비 오류·미검증·writer 반환을 보고한다. 허용 밖 필수 변경은 근거를 먼저 Main에 보고한다.

## 6. 실제 제외·복구
실제 DB/SQL/RLS/권한·키/사용자파일조사·서비스/Agent·실백업/복원·기존 프로젝트 차단 해제0, 새QA0.
합성 검증을 실COMMIT/경합/백업·사용자인수로 승격하지 않는다. 전체 FN16/계획 미완료 유지.
rollback은 해당 source commit 정상 revert. 실제 자료 삭제/down migration·main 병합/배포0.
