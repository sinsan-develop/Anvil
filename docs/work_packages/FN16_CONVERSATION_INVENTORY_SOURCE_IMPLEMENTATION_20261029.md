# FN16 대화 원문 참조·정정 이력 수집 작업지시서

- 일자: 2026-10-29. 기준: codex/av3-stage-b, 81a509afbc4ca44fa76888dd10bc235342e3a3b2.
- 근거: 설계 §10.4, FUNCTION_WORK FN16 전체 자료 보존, 신산님의 FN16 source·화면·미적용 SQL·합성검증 직접 승인. 실제 키·DB·서비스 변경 제외. 이번 업무는 새 공개 계약이나 schema 없이 내부 대화 자료군 metadata를 완성한다.
- 담당: 기존 fn16_primary 단독 구현; Main 관리·검수·통합; fn16_review 독립 읽기 검수. 완료된 문서/원문 검사 32건 반복하지 않는다.

## 허용 파일 / 완료할 업무
신규 apps/server/modules/backups/conversation-inventory.ts, tests/unit/FN16/conversation-inventory.test.ts, tests/unit/FN16/conversation-inventory-schema.test.ts만 구현한다. 기존 source·SQL·권한·서비스 연결은 변경하지 않는다.
`collectConversationInventory(access, token, value, signal)` 내부 함수를 구현한다. 입력은 기존 readDocumentInventoryInput의 projectId/limits 계약을 재사용한다. 대화 전체 순서와 원문 exact 참조 및 정정 계보를 같은 자료 snapshot에서 수집·대조한다. 실제 원문 bytes 수집·지식/헌법/공유요청·전체 archive/복원은 이번 완료범위가 아니다.

## 명시 자료와 무결성
- conversations: id,project_id,target_role_ref,head_sequence,created_by,last_client_id,last_command_id,created_at,updated_at. project_id 고정, id keyset ASC, LIMIT 200.
- conversation_messages: project_id,conversation_id,sequence,id,author_ref,kind,body_artifact_id,source_refs,reply_to,supersedes_instruction_id,effective_scope,message_json,content_hash,redaction_state,client_id,command_id,recorded_at. project_id 고정, (conversation_id,sequence) keyset ASC, LIMIT 200. OFFSET/SELECT * 금지. SQL 측 명시 열 JSON byte 크기 검사로 큰 payload 반환을 억제한다.
- artifacts: id,project_id,bytes,content_hash,media_type,state,inspection_json. 같은 project의 수집된 exact ID만 최대 200 묶음. storage_key/경로/원문 bytes를 읽거나 반환하지 않는다.
- 기존 readConversationInput 계약으로 USER_MESSAGE/USER_INSTRUCTION, HUMAN, null target, 빈 source/attachment/stage/task 범위를 확인한다. 미지원 AGENT_OUTPUT/TOOL_FACT 등을 지원한 것으로 바꾸지 않는다. parser의 원문 오류는 고정 collector 오류로 변환한다.
- message_json은 정확한 snapshot 필드만 허용하고 canonicalJson/contentHash를 원 content_hash와 대조한다. conversationId/serverSequence/authorRef/message kind/body ID/reply/supersedes/effectiveScope/sourceRefs의 분리 SQL 열과 같아야 한다. project 범위를 모든 행/참조에서 확인한다.
- 각 대화 sequence는 1부터 head_sequence까지 빠짐없이 중복 없이 연결된다. 마지막 message의 client_id/command_id는 head 기록과 일치한다. reply/supersedes는 같은 대화의 더 이른 정확 id/hash를 가리켜야 하며 정정 대상·새 메시지는 USER_INSTRUCTION이어야 한다. 원 지시·정정 이력을 둘 다 남기며 실행 지시로 해석하지 않는다.
- 원문 exact ref의 bytes/hash/mediaType을 artifacts와 대조하고, 같은 ID 충돌/누락/타 project/알 수 없는 state는 실패한다. READY/STAGING/FAILED/QUARANTINED 등 실제 허용 state는 기존 schema를 기준으로 보존한다. 검사 부재는 UNKNOWN; 알려진 NO_KNOWN_MARKER라도 bytes 검증 성공이 아니다. message redaction QUARANTINED를 삭제하거나 NOT_REDACTED로 바꾸지 않고 고정 issue로 남긴다.
- commands/approval/audit 전체 증빙은 수집하지 않는다. 필요한 command ref는 외부 의존으로 명시하고 receipt 검증 완료라고 주장하지 않는다. created_by/userId/clientId/token은 출력하지 않는다. author는 HUMAN 종류만 보존하고 원 source hash와 metadata 투영 hash를 구분한다.

## 수명·한도·오류
- 기존 document collector의 RC 시작/종료 현재 auth·OWNER/nonarchived·동일 actor/client/session/credential 세대 및 최소 세션기한 누적을 유지한다. 별도 RO REPEATABLE READ client 1개만 자료에 사용한다. 시작/종료 실제 isolation/read_only/snapshot을 확인한다. 마지막 auth는 자료 transaction ROLLBACK·반납 뒤 실행한다. 외부 authenticated COMMIT 완료 뒤에도 기한·취소를 검사한다.
- 각 query/page 전후 monotonic 기한·취소와 남은 statement_timeout. 기존 pool/auth lock 대기의 강제 종료를 구현한 것으로 주장하지 않는다. 진행 query 완료 전에 client 정상반납 금지. 실패도 rollback/release, 회수 불명 고정503 우선. 세션기한은 새 auth가 길어져도 이전 최소치를 넘지 않는다.
- metadataBytes는 원 SQL payload 누적과 최종 UTF8 DTO 모두 제한한다. inputBytes/fileCount는 중복 제거한 원문 refs 크기/개수 한도다. keyset 중복·역행·200초과·행 누락은 fail closed. 임의 무한 배열이나 추가 전역 조회 금지.
- 반환 kind CONVERSATION_INVENTORY_V1, scope CONVERSATION_HISTORY_ONLY, projectId, observation, conversations/messages/artifacts, issues, externalDependencies, contentHash, usage. 민감 자유 metadata는 기존 inspectArtifact 알려진 표식 검사하며 실패 원문/SQL/cause를 출력하지 않는다. blobVerification NOT_PERFORMED, fullProjectCoverage false, restorable false. 권한 현재성은 양끝 관측일 뿐 이후 변화를 영구 차단하지 않는다.
- metadataComplete는 수집·관계 정합과 외부 미수집/격리 문제를 정직하게 구분한다. 대화가 없는 실제 빈 결과와 누락/DB 오류를 구분한다.

## 필수 합성 검수 / 전달
TEST_ONLY로 정상 복수 대화·정정·중복 원문·200 초과 pagination, 분리 열/hash/정정 scope·대상 변조, head/행 누락, 격리/UNKNOWN, 권한/세대/만료·취소·rollback 불명·SQL 큰 payload 제한·민감 metadata 비노출을 고정한다. Main RED 확인 뒤 source GO. 기존 SQL 파일을 읽는 schema test는 실제 DB 검증으로 주장하지 않는다. node --test 신규 2파일, npm run typecheck, git diff --check 및 독립 검수. 실제 DB/FS/키/서비스/SQL적용/P03/job/Agent 실행0. 실패·미실행과 다음 지식/헌법 자료군을 결과·WORK_STATUS에 기록한다.
