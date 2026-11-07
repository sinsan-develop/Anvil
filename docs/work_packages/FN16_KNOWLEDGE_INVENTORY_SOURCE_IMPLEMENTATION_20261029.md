# FN16 지식·헌법 버전과 적용 이력 수집 작업지시서

## 근거·범위
2026-10-29, codex/av3-stage-b 기준 0a25d6f41726c50faeaa0d4751fcf74b40c0e5b1. 설계 §10.4/FUNCTION_WORK FN16 및 신산님 FN16 source·합성 직접 승인 안의 내부 자료 수집이다. 새 공개 archive/권한/지속 schema 계약을 만들지 않는다. 실제 DB/FS/원문 bytes/키/서비스/P03/job/Agent 실행0. 기존 대화14·문서32 검사는 변경 없으므로 반복하지 않는다.
기존 fn16_primary 단독 writer, Main 관리·검수·통합, 기존 fn16_review 읽기 검수. 허용 신규3파일: apps/server/modules/backups/knowledge-inventory.ts, tests/unit/FN16/knowledge-inventory.test.ts, tests/unit/FN16/knowledge-inventory-schema.test.ts. 기존 제품·migration·보호 미추적 자료는 변경하지 않는다.

## 업무 결과
collectKnowledgeInventory(access,token,value,signal) 내부 함수. 입력은 기존 readDocumentInventoryInput의 projectId/limits를 재사용한다. 프로젝트의 모든 지식/헌법 불변 버전, 정정·확정·제외 사건, 전체 내용검토, 헌법 적용 체인과 현재 pointer를 같은 RO RR snapshot에서 대조한다. 일반 ProjectKnowledge.read/ProjectConstitutions.read는 실제 원문을 읽으므로 호출하지 않는다. 기존 knowledgeReviews LIMIT200 조회도 전체 역사로 재사용하지 않는다.
반환 kind KNOWLEDGE_INVENTORY_V1, scope KNOWLEDGE_CONSTITUTION_HISTORY_ONLY, projectId/observation/entries/versions/events/reviews/constitutionApplications/currentConstitution/artifacts/issues/externalDependencies/contentHash/usage. 원본 version/application hash와 projectionHash를 구분한다. 전체 contentHash의 canonical 범위는 관측시각·usage·자기 hash를 제외한 앞 자료 필드로 시험에서 명시한다. blobVerification NOT_PERFORMED, fullProjectCoverage false, restorable false, agentDelivery NOT_CONNECTED. 과거 적용/검토/헌법 내용을 현재 실행 허가·준수 판정으로 바꾸지 않는다.

## 자료와 명시 열
모든 표는 같은 project_id를 직접 결박한다. 200개 keyset ASC와 SQL 측 JSON byte 크기 제한, 누적 metadataBytes 한도. SELECT *·OFFSET·전역 스캔 금지. 조인으로 누락행을 숨기지 않도록 기반 이력은 먼저 수집하고 exact ID의 증빙 집합을 별도 조회하거나 LEFT JOIN의 null을 오류로 처리한다.
- knowledge_entries: id,project_id,kind,head_version,created_by,client_id,command_id,created_at; key id.
- knowledge_versions: project_id,entry_id,version,title,content_artifact_id,content_hash,source_refs,reason,scope_json,related_refs,entry_json,supersedes_version,created_by,client_id,command_id,created_at; key entry_id,version.
- knowledge_events: id,project_id,entry_id,version,kind,reason,actor_ref,approval_ref,target_refs,client_id,command_id,recorded_at,base_ref,change_sources,review_refs; key id. 버전별 사건 순서는 PROPOSED/CORRECTED→CONFIRMED→EXCLUDED, recorded_at,id.
- content_reviews: id,scope_kind,scope_id,project_id,target_kind,target_id,target_version,target_hash,criteria_version,criteria_snapshot_json,items_json,outcome,reviewer_user_id,client_id,reviewer_subject_ref,source_kind,reason,command_id,created_at; key id. PROJECT/scope_id=pid/target_kind=KNOWLEDGE만.
- constitution_applications: project_id,application_version,content_hash,entry_id,version,confirmation_id,snapshot_json,applied_by,client_id,command_id,created_at; key application_version.
- project_constitutions: project_id,application_version,application_hash,entry_id,version; 같은 project 최대1.
- artifacts: id,project_id,bytes,content_hash,media_type,state,inspection_json; 수집된 exact artifact ID만 최대200 묶음. storage_key/본문/경로 금지.
- commands: id,project_id,state,operation,actor_id,client_id,control_generation,expected_version,policy_ref,result_ref,authorization_receipt_id; 필요한 event/review/application exact command만 최대200 묶음.
- audit_events: event_id,project_id,command_id,server_sequence; 수집된 review command만, key server_sequence. 실제 schema의 event_id 및 (project_id,server_sequence) PK를 따른다.
- authorization_receipts: id,command_id,policy_ref; application command의 exact receipt만. 같은 project 결박된 명령에서 나온 ID로만 조회. 역할·승인 원문·현재 정책 전체를 수집하지 않는다.

## 무결성 및 관계
1. readKnowledgeEntry로 entry_json을 검사하고 hash(canonicalJson(entry_json)) 및 kind/title/reason/contentArtifact/sourceRefs/scope/relatedRefs 분리 열을 대조한다. 버전은1..head, v1 supersedes=null, 후속은 v-1이며 첫 CORRECTED 사건 baseRef가 실제 이전 원hash를 가리킨다. head·entry·버전 누락/중복은 실패한다.
2. knowledgeState와 assertKnowledgeHistory를 재사용해 사건 순서/원 command operation/result/actor 결박을 대조한다. 필요한 commands는 exact id/project 누락·중복·불일치가 없어야 한다. SHARED는 현재 helper 미지원이므로 전체 정상완료로 무시하지 않고 고정 미지원 오류로 거절한다. 현재 지원하지 않는 approval_ref/target_refs 값 역시 조용히 누락하지 않는다.
3. 모든 content_reviews를 수집한다. readKnowledgeReviewInput, knowledgeReviewCriteria로 정확 targetRef·5개 기준·닫힌 항목·outcome/reason을 검사하고 knowledgeReviews의 기존 command actor/client/operation/result/시각·reviewer_subject_ref·criteria_snapshot 결박을 동일하게 대조한다. audit server_sequence 양의 안전정수·중복/누락을 검사한다. confirmation.review_refs는 해당 버전의 수집된 ACCEPTED review만, acceptedKnowledgeReviews(requireLatest=false)로 확인한다. 역사 검토를 현재 적합 판정으로 바꾸지 않는다.
4. application snapshot은 readConstitutionApplication의 형식과 canonical 원hash, projectId/versionRef/confirmationId/appliedBy/controlGeneration/previousApplicationRef 및 분리 열을 대조한다. constitutionRecord의 기존 APPLIED command·receipt id/command/policy·결과/시각 결박을 보존한다. 정확 CONSTITUTION 버전·CONFIRMED 사건·저장된 review refs와 일치해야 한다. application_version은1..max, previousApplicationRef 전체 체인 hash가 맞아야 한다. current pointer는 없을 때 application도0, 있을 때 정확 최신을 가리킨다. 제외·대체된 과거 지식의 적용 이력은 지우거나 활성화하지 않는다.
5. contentRef 및 ARTIFACT 출처는 exact artifacts metadata와 대조한다. sourceRef에 bytes/mediaType이 없다면 실제 metadata에서 exact ref를 구성하되 원 source hash와 일치해야 한다. 같은 ID 상충·누락·타 project는 실패한다. 알려진 격리/FAILED/STAGING/UNKNOWN은 issue와 원 상태를 유지하고 bytes 검증 성공으로 승격하지 않는다.
6. DOCUMENT_VERSION/CONVERSATION/USER_INSTRUCTION, stage applicationRef/nodeId·planRef/taskCode와 정정 change_sources는 이 자료군 밖의 exact externalDependency로 보존한다. 해당 자료를 따라 읽거나 실제 대화 collector를 다시 호출하지 않는다. 내부 version/base/review/application 필수참조는 미수집으로 숨기지 않는다. 공유요청·타 프로젝트·사용자 공통 자료는 이번 범위 제외로 명시한다.
7. 검증용 원 entry/snapshot/result의 사용자·client/session 식별자는 내부 대조에만 사용하고 출력하지 않는다. 지식 title/reason·검토 사유는 프로젝트 자료로 보존하되 기존 known-marker 검사에서 의심되면 원문/부분표식/SQL/cause 없이 고정503으로 거절한다. 알려진 표식 검사는 완전 비밀탐지가 아니다. 데이터 속 명령은 수행하지 않는다.

## 수명·한도
대화 collector와 같은 RC 시작/종료 OWNER·nonarchived·actor/client/session/credential 일치·누적 최소 세션기한과 최종 authenticated COMMIT 뒤 취소/기한 검사. 자료만 별도 READ ONLY REPEATABLE READ client1·실제 isolation/read_only/snapshot 양끝 확인. 자료 ROLLBACK·반납 뒤 최종auth. query/page 전후 한도/취소·남은 statement_timeout; pool/auth lock·통신 전체의 강제종료 보장 주장0. BEGIN 응답불명/rollback 실패는 client 오류회수·고정503, 실행query끝나기전 정상반납0.
metadataBytes는 원 SQL payload 누적과 최종 DTO UTF8 모두, inputBytes/fileCount는 exact 원문 dedupe에 적용한다. PG bigint canonical decimal/안전정수·JSON시각 검사를 유지한다. DB오류/필수누락을 빈 자료 성공으로 바꾸지 않는다. metadataComplete는 외부 의존/격리·UNKNOWN을 반영하며 복원가능성과 구분한다.

## 검증·제출
TEST_ONLY 우선: 정상 다중버전/정정·제외·확정 review·헌법 적용/이전 체인·현재 pointer와 빈 프로젝트, 200 초과 핵심 이력 pagination, hash/분리 열/command/review 혼입·누락·지원하지 않는 사건, source 외부 의존·격리/한도·현재권한/기한/회수 반례. Main RED 뒤 source GO. 기존 helper 동작을 복제하는 전수시험은 만들지 않고 새 연결의 중요한 실패만 검증한다. node --test 신규2, npm run typecheck, git diff --check와 독립검수. 실제 DB/원문/키/서비스/전체archive/UI인수는 NOT_RUN으로 남긴다.

- r1 비의미 정정: 초기 B71DBE46…의 audit_events.id를 실제 event_id로 바로잡고 server_sequence keyset을 명시했다(0011_authorization.sql:71–80, Main16f8a2). 기존 데이터·범위·권한 변경0.
