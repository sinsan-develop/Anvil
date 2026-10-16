# P02 데이터 관계·보존 계약 초안

후보41 적용 후 환경 개정 guard의 SELECT alias `old`가 PL/pgSQL OLD와 충돌한42702는 새 forward42 `0006_connection_candidate_guard_alias_fix`에서 `prior_version`으로만 보정했다. 적용41 checksum327af229e0a2f88f1e763e83ddebd3c522cf3cda2d2d43e9355ef2c8bc8b280d와42 checksum b9642ef359ea0ed71bb0d65551feeac9a287930a2ec81ed643f3e327d0204aa0는 고정하며 이미 적용한 SQL을 고치지 않는다. 코드350b2e30의 실제 v1/v2·불변/현재 권한/일회 소비·인접 업로드 검증은 WORK_STATUS를 따른다. 이 후보 테이블을 완성형 connector/환경/실측으로 승격하지 않는다.

FN06 새 forward41 `0006_connection_candidates`는 완성형 연결/환경 테이블을 대신 만들지 않고 connection_candidates(project/id/kind/head_version)와 connection_candidate_versions(project/candidate/version/kind/snapshot/hash/actor/client/command/기한)의 후보 전용 원본·불변 버전을 추가한다. head FK는 지연 검사하고 app의 head 변경은 exact receipt/이전 ref·현재 제어/최근 재인증·현 정책/필요 일회 소비로 보호한다. version UPDATE/DELETE·identity DELETE는 app에 허용하지 않는다. snapshot의 NOT_READY/executionAuthorized=false·6능력 UNVERIFIED는 서버/DB에서 강제한다. 기존 업로드의 승인 guard 조건은 유지한 새 함수 정의로 후보 두 연산의 일회 소비만 추가한다. connector 신뢰/credential/grant/실행 schema를 활성화하지 않는다. 기존40 SQL은 불변이며 적용 여부/체크섬은 WORK_STATUS를 따른다.

FN03 단계 연결(직접 승인 call_1553fd04d9e64a098d20ba83a7e7525c): forward40 `0003_document_stage_bindings`는 기존 nullable stage_ref_json을 `{applicationId,nodeId}` 정확 참조로 보호한다. generated stage_application_id와 (project_id,stage_application_id) 복합 FK로 다른 프로젝트 적용본을 차단하고, 새 불변 버전 INSERT는 현재 명령/receipt·최신 고정 적용 snapshot·노드의 입력/산출 양식 exact ref를 대조한다. 문서 canonical hash에 단계 참조를 포함한다. 과거 조회는 당시 고정 적용본을 읽으며 현재 적용 전환으로 과거 문서를 바꾸지 않는다. 제안 선택도 기준 문서의 단계 참조를 보존한다. checksum5ec9965d55ad7968d5dac7a2cf90f388b6e3bf6e1a1e74913d32bb8d1c4041e1 적용 이후 이 SQL은 불변이다. 실제 검증과 남은 사용자 브라우저 인수는 WORK_STATUS로 구분한다.

실제 FN11 검증: forward34~36은 eb4f1d97 exact actual2 PASS/13084ms에서 원문 업로드의 요청/3종 결정/일회 소비·동시 명령/내용 위장·실제 만료/회수·감사/불변 이력을 확인했다. 기존31종 QA/시험원문 root의 독립 잔여0·migrations36이며 실제 사용자 자료/서비스는 변경하지 않았다. 적용34/35/36을 이후 수정하지 않고 필요하면 새 forward로 보완한다. UI08/다른 연산의 실제 승인 소비와 전체 인수는 후속이다.

FN11 forward36 후보는 기존 소비 표의 미연결 INSERT guard를 현재 명령/정책·기한·APPROVE 결정·주체/기기/세대·정확 후보/hash로 교체하고 요청 UPDATE는 APPROVED/version2→CONSUMED/version3·같은 소비 사건일 때만 허용한다. 기존 request/decision JSON·SQL34/35는 보존한다. commands.approval_consumption_id·payload_ref의 비밀 없는 범위/hash, authorization_receipts.approval_decision_ref, audit.approval_ref를 같은 transaction에서 연결한다. 소비의 command_id는 서버 행 ID이고 후보 commandId는 commands.command_id로 별도 대조한다. 현재 uploadArtifact만 지원하며 파일과 DB의 완전한 분산 원자성을 새로 보장하지 않는다(보호 파일 보존/고아 정리 계약은 별도). exact QA 파일은 기존 전용 root의 finally 정리 대상이다.

FN11 forward35 후보는 기존 approval_decisions에 nullable command_id/content_hash/decision_json을 추가하고 현재 명령/정책·HUMAN/기기/세대·pending exact 요청/서버 기한/범위와 불변 receipt를 결박한다. 기존 요청의 UPDATE guard는 동일 metadata 유지·새 결정 사건과 같은 명령일 때만 status/version1→2를 허용한다. 초기 request_json·옛 SQL34를 수정하지 않는다. 소비 표의 fail-closed guard는 유지하며 승인 결정이 업무 실행이나 범위 확대를 허가하지 않는다.

FN11 forward34 후보: 기존 approval_requests에 nullable client_id/command_id/policy_ref/content_hash/request_json을 추가하고 app 신규 요청만 정확 원자 영수증·현재 OWNER/control·AUTO 요청/REQUIRE_APPROVAL 후보 정책과 결박한다. 기존 행을 자동 검증 완료로 분류하지 않는다. 신규 metadata가 있는 후보는 project/candidate_command_id 유일하다. 요청 payload/현재 기준·원문은 바꾸지 않고 초기 요청 snapshot/version1·확정 해석과 현재 상태/만료/회수를 분리한다. 아직 미연결 결정/소비 표의 app INSERT와 요청 status/version 직접 갱신은 fail-closed guard로 막으며 후속 검증 전 실행 권한으로 쓰지 않는다. 기존33 SQL·실제 사용자 정책/Secret은 보존한다.

후속 실제 적용: 사람 검토v2/v3·출처4종은 df2f81ff exact actual1 PASS/9215ms로 확인했다. forward31은 SQL30의 JSON 포함 비교식 양쪽 괄호만, forward33은 SQL32의 kind 변수명만 교정한다. 적용 SQL30/32를 덮어쓰지 않았고 현재33개 지문을 보존한다. 오류가 있었던 최초 실행은 별도 FAIL 이력으로 남긴다. 출처/사람 판단 확인과 의미적 정답·기준 활성화·사용자 인수는 서로 다른 사실이다.

FN04 출처 forward32 후보는 design_changes.change_json.sourceRefs의 기존 구조 안에서만 기존4종을 보존한다. 새 표/기준 pointer/사용자 권한을 추가하지 않고 현재 요청 guard의 [] 전용 조건을 같은 프로젝트 문서 버전/hash·READY 텍스트 원본·실제 대화/지시 metadata 검사로 교체한다. 서버는 보호 파일 바이트까지 재검사한다. 기존 요청/영향 snapshot/hash와 SQL29~31은 불변, 과거 지시는 출처 이력이지 현재 적용 지시가 아니다.

FN04 forward30 후보는 기존 design_change_impacts의 v1/MECHANICAL-only CHECK를 새 명시 조건으로 확장하되 기존 행은 그대로 보존한다. HUMAN_REVIEW v>1은 base_version=v-1/base_hash와 동일 id/project/version/hash composite FK로 부모를 고정하고, 새 command/receipt·현재 정책/control/OWNER·최신 base·HUMAN 작성자·대상/공백 보존·UNAFFECTED의 실제 같은 프로젝트 문서 근거 guard를 요구한다. UPDATE/DELETE 권한은 추가하지 않고 현재 설계·계획 pointer를 수정하지 않는다. 적용 SQL29와 기존 이력은 불변이며 적용 여부는 WORK_STATUS를 따른다.

FN04 forward29 후보: design_changes는 exact before 문서 composite FK·실제 proposal FK·project/제안 유일성·초기 요청 v1 JSON/hash·사람/client/command를 append-only 저장한다. design_change_impacts는 해당 change hash/FK와 초기 MECHANICAL_TRACE v1 snapshot/hash·확인 시점·제한된 입력 계획 ref/공백을 보존한다. app UPDATE/DELETE 권한0·현재 control/policy/receipt와 원문 확정/최신 검토·미선택 proposal를 DB guard에서 결박한다. 기존 설계/계획 pointer·원문/선택·적용28 SQL은 변경하지 않는다. 사람 검토 버전/기준 적용은 후속 미구현이며 이 초기 저장 구조를 실행 허가로 쓰지 않는다.

FN04 forward28 후보: `work_plan_confirmations`는 project/plan/version/hash·선택 review_refs·현재 검증 snapshot·사람/client/command를 append-only 보존하며 버전당1건이다. 기존 version_json/DRAFT/hash는 변경하지 않고 work_plans.confirmed_version만 정확 receipt·현재 control/policy/head/원문/최신 검토와 결박해 변경한다. 직접 pointer 변경·확정 삭제는 거절한다. 이후 최신 REWORK/원문 미준비/새 head는 과거 확정을 지우지 않고 현재 유효성을 false로 표시한다. 확정은 기준 활성화/실행이 아니다.

원문 격리 forward27은 artifacts의 기존 QUARANTINED 상태에 nullable inspection_json을 추가한다. 기존 행은 null(미검사)로 보존하며 안전 판정을 소급하지 않는다. 새 업로드는 policyVersion1/method KNOWN_PATTERNS_RAW_BYTES/complete=false/state SUSPECTED 또는 NO_KNOWN_MARKER/reasonCodes를 정확 업로드 receipt와 결박한다. 의심 원문 파일/hash는 불변, 비밀값/일치 구간 저장0·자동 삭제/해제0. 기존 제안의 서버 diff는 기존 정확 guard/READY 경로를 유지한다. 사용자 권한 확대·이전 SQL 변경은 하지 않는다.

FN05 forward26 후보 `0005_knowledge_confirmation`은 기존 content_reviews의 PROJECT/KNOWLEDGE만 현재 명령/정책·제어·exact 버전/hash·HUMAN 작성자로 보호하고, knowledge_events의 CONFIRMED에 review_refs를 추가한다. 버전별 확정1개·최신 ACCEPTED 검토 포함을 강제하며 이전 사건/원문/적용25 SQL은 보존한다. 이후 검토가 보완 필요면 과거 확정은 남고 현재 유효성은 false다. 지식 확정은 헌법 적용 pointer나 Agent 실행 허가가 아니다. 승인/실제 적용은 WORK_STATUS로 구분한다.

## 2026-10-16 실제 자료 정책·원본·문서 버전 보완

복합 충돌·검토/확정 대상 교체는 SQL 추가 없이 기존 불변 version/review/confirmation과 현재 head/hash gate를 소비한다. 브라우저의 거절 snapshot/명령 이력은 사용자·프로젝트별 App 버퍼이며 영속 checkpoint나 서버 완료 기록이 아니다. 새 대상의 판단/확인·명령은 새로 만들고 옛 서버 문서/확정 사건은 그대로 재조회한다(actual ae2c3fd5 1/3017ms). 자동 완료·기준 적용·실제 Agent dispatch0이다.

보관 자료 목록/재개 후속은 새 SQL 없이 기존 imports/proposals/선택을 소비한다. 목록 integrity=NOT_RECHECKED는 저장 metadata 검사만 의미하고 상세 선택 시 실제 원문을 재검증한다. 후보 재개는 기존 candidate/original link를 새 문서에 보존하고 후보를 재생성하지 않는다. 저장 제안 재개는 과거 명령이 아닌 읽기 binding이며 명시 save만 새 선택/version을 만든다. actual exact4997e732 1 PASS/2712ms와 독립 합성 잔여0을 확인했다. 아래 이전 목록 재개 미구현 문구는 후속 전 이력이며 source/draft-scope/전체 browser DB 미완료는 유지한다.

forward19 `document_proposals`는 exact base document/version/hash·업로드한 proposed body·서버 diff artifact·전체 proposedContent·reason·실제 주체/client/command를 불변 저장한다. `document_proposal_selections`는 사용자 명시 saveDocumentDraft의 새 version과 같은 프로젝트 proposal을 한 번 결박하며 현재 제어/정책/receipt·정확 content를 검사한다. 생성 상태 PENDING은 불변 원 기록이고 GET selections가 실제 반영 여부/문서 version/주체/시각 이력이다. 제안만으로 head/확정 변경0, 본문과 무관한 제목/양식 변경을 제안 반영으로 위장하면409다. 기존 artifacts.command_id UNIQUE와 원 업로드 guard는 유지하고 같은 propose 명령에서 서버 diff JSON1개만 정확 receipt metadata로 INSERT를 허용한다. 과거18 SQL·원문·확정본은 보존하며 자동 삭제/DB·FS 완전 원자성은 주장하지 않는다.

새 forward18 `0003_document_imports`는 직접 승인된 범위에서 적용했다. `document_imports`는 PROJECT 원본 artifact/nullable 고정 양식·parser/status/losses/issues·candidate canonical hash·실제 사용자/client/command를 불변으로 저장한다. `document_import_selections`는 같은 프로젝트 candidate→실제 문서 version·선택 사용자/client/command를 append-only로 보존하며 현재 APPLIED save receipt의 candidate ID/문서 version·원본 link가 있어야 한다. candidate 생성은 문서/head/확정본을 만들거나 바꾸지 않는다. 성공 파서 UTF8_IDENTITY_1은 원본과 같은 artifact의 무변환 참조이며 별도 추출 파일 생성으로 주장하지 않는다. 본문 상한/유효 UTF-8 실패나 미지원도 원본 artifact를 유지한다. 실제 FN03/FN11 2 PASS와 독립 후보/선택 포함 합성 잔여0, app 직접 UPDATE/DELETE 불허를 확인했다. 제안/diff·draft-scope import·소스 연결/후보 목록 재개는 미구현이다. 기존17 SQL/과거 이력은 유지한다.

후속17 `0003_document_confirmations`는 project/document/version/hash의 불변 확정과 formRef/reviewRefs/형식 검사·실제 HUMAN/client/command를 저장한다. 현재 OWNER/제어 세대·정책 head·APPLIED confirmDocument/receipt·최신 ACCEPTED가 있어야 INSERT/pointer UPDATE가 된다. 과거 version/link/draft-event guard는 유지하고 document head는 새 초안 때 confirmed pointer를 보존한다. 과거 SQL16/행을 고치지 않았으며 app의 확정 row UPDATE/DELETE는 금지다. 최신 actual2에서 직접 pointer 쓰기42501·확정/replay1·후속 초안/충돌 조정 뒤 구확정 보존과 독립 합성 잔여0을 확인했다.

본문 확정 검사는 현재 파일의 고정 form과 필수 TEXT/RECORDS 범위를 재검사한다. TEXT 목차/빈값/TODO, 중복 위치, 반복 표 필수 열/행/빈 셀과 코드 속 가짜 표는 확정 불가이며 선택 항목을 필수로 바꾸지 않는다. 반복 자료의 현재 지원 표현은 Markdown 표(고정 필드 ID 또는 명칭)이며 임의 코드/문서 명령을 실행하지 않는다. 이는 사실·독립 검수·사용자 인수/Agent 실행 합격이 아니다. 읽기 응답은 새 검사를 제공하지만 기존 저장 시점 validation snapshot은 불변이다.

UI06 내용검토 작성 연결도 현재16개 schema를 유지한다. 기존 PROJECT/DOCUMENT/HUMAN_REVIEW를 현재 OWNER/client/제어 세대·명시 정책·exact head/hash/기준에 결박하고 같은 command replay는 실제 row1을 반환한다. 이번 actual1에서 새 클라이언트로 검토 저장·재조회/실제 사용자·동일 작성자 여부·confirmed=false·실행 outbox0을 확인했다. 화면 fixture10/단위48은 별도 증거다. 새 confirmed pointer/행위는 아직 연결하지 않았으며 단순 section anchor 존재를 필수 내용/반복 필드 검수 합격으로 승격하지 않는다.

UI06 작성/편집 연결은 새 schema를 만들지 않는다. 현재16개 그대로 기존 PROJECT 명시 uploadArtifact/saveDocumentDraft·원문과 불변 버전/감사를 소비한다. 새 문서는 targetId=null/expectedVersion0, 개정은 정확 documentId/head 기준이며 오래된 입력은409로 보존한다. 응답 단절의 각 upload/save command는 탭 상위 버퍼로 보존하고 확인된 업로드 후 JSON 저장 재확인은 새 파일을 만들지 않는다. 성공은 서버 exact ref/hash·새 버전 재조회로 확인하며 사용자 확정/내용검토·실행 사건으로 변경하지 않는다.

후속16 `0003_project_document_reviews`는 기존 append-only content_reviews의 PROJECT/DOCUMENT 경로만 현재 OWNER/client/control·정책 head·APPLIED recordContentReview/receipt exact ref·문서 head/hash·고정 양식 ref에 결박한다. criteria_snapshot_json은 그 양식 버전의 itemId/title/reviewCriteria, reviewer_subject_ref는 서버에서 결정한 HUMAN/동일 작성자 여부다. DRAFT/USER_COMMON 분기는 유지하고 과거 review UPDATE/DELETE는 금지다. 실제3 PASS/skip0을 확인했지만 document confirmed pointer/실행 권한은 바꾸지 않았다.

아래 초기 P02 미실행 문구는 작성 시점 이력이다. 신산님 FN11/FN03 직접 승인 후 새 forward13~15를 개발 DB에 적용했고 WSL exact `dc42b29c4d24d24dc4f6f8f1737ac289023ae09c`의 actual2 PASS로 현재 좁은 연결을 확인했다. 전체 표의 계획 기능/미구현 테이블까지 적용됐다는 뜻은 아니다.

- 정책13: 현재 owner/client/control·최근 재인증의 명시 저장, 정책/version/command/receipt/audit exact 결박·불변 과거 버전. 현재 HUMAN 본인/해당 PROJECT/자료 연산·유한 기한만 지원한다. 자동 정책·Agent grant·일회 승인 소비는 없다.
- 원본14: project/draft 소유 정확히 하나, 현재 app INSERT는 PROJECT READY만 현재 uploadArtifact 명령·receipt·정책/control/hash/크기에 결박. UPDATE/DELETE 금지. 원본을 파일로 독립 보존하며 전역 hash 또는 임의 storage 경로로 접근하지 않는다. 파일 성공/DB 실패의 orphan은 보존·복구 대상으로 분리하며 DB/FS 완전 원자성은 주장하지 않는다.
- 문서15: `documents` head와 nullable confirmed pointer, 정확 form version/hash·같은 project artifact FK의 `document_versions`, BODY/ATTACHMENT links·DRAFT_SAVED events. 현재 saveDocumentDraft만 허용하며 title/content/source/author/validation은 해당 버전에 불변 저장한다. 새 버전이 구버전 제목/본문을 바꾸지 않는다. 정책/권한·명령/receipt/audit와 같은 DB transaction, app UPDATE/DELETE로 과거 version/event 수정 불가.
- 현재 텍스트 본문≤2MiB·필수 양식 항목의 `line:N` 원문 위치 연결만 형식 검사. 빈 필수항목/미연결은 초안 저장 가능하지만 사용자 확정/내용검수로 승격하지 않는다. stage/import/source/proposal·내용검토/확정과 더 넓은 parser는 미연결이며 요청 시 fail-closed다. 원본 자체 업로드는≤20MiB지만 이 사실이 모든 형식 추출 지원을 의미하지 않는다.

상태: **P02 논리·물리 저장 책임 상세화 / SQL·DB 실행 미검증**. 2026-10-16 Main 어울. 설계 r8 §4~10, 계획 r7, 승인 공식 산출물 양식·UI/FN 업무 카드를 기준으로 한다. TD-01 PostgreSQL/파일 선택은 유지한다. 표는 저장 책임/관계 제안이며 DB 생성·migration·실데이터 변경 지시가 아니다. 특정 테이블/타입/인덱스/암호화 구현과 P02 합격을 선언하지 않는다.

## 1. 공통 규칙

모든 프로젝트 자료는 `projectId`에 귀속한다. 공유 내장 정의는 별도 공통 범위와 불변 버전을 가지며 프로젝트 적용본으로 참조한다. 전역 ID를 알아도 접근 권한이 생기지 않는다. ID·생성/변경 시각·행위자·출처·version을 데이터 종류에 맞춰 가진다. 서버 수신 시각과 실행기 관측 시각을 구별한다.

확정 버전·사용자 원문·이벤트·승인/실행/검토 증거는 덮어쓰지 않는다. 정정/대체/사용 제외는 이유와 새 참조를 추가한다. 자료의 삭제/보존 만료는 도구 해제·프로젝트 보관·계정 교체와 분리한다. 실제 삭제 정책은 사용자 결정 전 자동 적용하지 않는다.

## 2. 저장 단위와 관계

| 논리 단위 | 필수 내용·관계 | 책임·고유 조건 |
|---|---|---|
| 사용자·클라이언트 | Anvil 사용자 ID, 인증 주체 참조, client ID, 표시 정보·회수 시각 | FN01/15. Agent 계정과 다른 개체 |
| 프로젝트·참여 권한 | 이름·목적·기대 결과·소유자·참여자별 권한, 보관/현재 상태 | FN01. 권한 없는 목록/건수도 숨김 |
| 생성 중간본·기준선 | 4단계 입력/현재 단계·작성자, 소스 위치 참조·접근 결과, 기능별 4상태·근거·사용자 확인 | FN01. 중간본/프로젝트 생성은 Agent 실행 아님 |
| 방법론 정의/버전 | 내장 SYS-M01~03/공통/전용, 이름·목적·출처·부모 버전·graph hash·확정 상태 | FN02. 내장 원본 불변, 복사본 별도 ID |
| 노드·연결 | 노드 안정 ID·유형·좌표·목적/입출력·담당 역할/환경/조건/한도, edge 유형·조건·합류/재작업 | FN02. 버전 내 ID 유일, 참조·도달/분기/합류 검사 |
| 프로젝트 방법론 적용 | projectId, 확정 방법론 버전, 적용자/시각·프로젝트 조정 참조 | FN02. 공통 개정으로 기존 적용본 변경 금지 |
| 공식 양식 정의/버전 | AF01~08, 필수 목차/필드·작성/검수 규칙·작성 기준 참조 | FN03. 적용 단계는 양식 ID+정확 버전 고정 |
| 파일/첨부 자료 | 소유 프로젝트·형식·크기·hash·저장 참조·생성 주체·검증 결과 | FN03/12. 경로를 공개 ID로 사용하지 않음 |
| 가져오기 후보 | 원본 자료 참조·추출본·지원 형식/크기/파서 버전·오류/손실·사용자 편집 | FN03. 원본/추출/확정 구분, 실패에도 원본 보존 |
| 문서·버전·제안 | 종류·단계·양식 버전·내용 hash/첨부·입력 출처·작성자, baseVersion·diff·이유·검토/확정 | FN03. stale base 거부, 제안 자동 반영 금지 |
| 설계 항목·화면 위치 | 확정 문서 버전·항목 ID·영역/anchor·요구 참조 | FN04. 다른 버전의 같은 표기를 혼동하지 않음 |
| 계획·업무·의존 | 설계 기준·업무 ID/UI·FN·IX 구분·범위/완료조건·담당·선행 | FN04/09. 의존 순환·설계 연결 누락 노출 |
| 추적 연결 | from/to의 종류·ID·버전·관계·근거 | FN04. 설계→화면→업무→코드/시험 및 역조회 |
| 설계 변경·영향 | 이유·전후 참조·영향 있음/없음/미확인·판단 근거·사용자 결정·계획 개정·적용 상태 | FN04. 변경 승인과 적용/재개는 별도 |
| 대화 원문·지시 | 화자·역할/대상·본문/첨부·시각·유효 범위·대체 지시·발신/수신/반영 상태 | FN05/08. 미전송/미수신을 전달 완료로 표시하지 않음 |
| 헌법·결정·지식 버전 | 목적·규칙, 사실/가설·출처·결정 이유·정정/대체/제외·공유 대상/승인 참조 | FN05. 원문 불변, 제외는 삭제 아님 |
| 맥락 묶음·이해 검토 | 목적/헌법/최신 지시·기준/현재 위치·완료/미완료·원문 링크, 포함/누락·예산·이해 답변/불일치/확인자 | FN05/09/14. 수신 receipt만으로 이해 승인 아님 |
| Agent 연결·능력 실측 | 제품·버전·계정 보호 참조·모델/옵션·실행기, 기능별 공식/실측/미확인/미지원·증거/시각 | FN06/07. 비밀 원문·계정 종속 프로젝트 원본 금지 |
| 환경·허가 정책 버전 | 소스/실행기/대상 구분, 허용 경로/명령/환경·자동/승인/금지·기한·한도·비밀 참조 | FN06/11. 개정으로 기존 실행 허가 확대 금지 |
| 역할·임무·책임 binding | 총괄/단계책임자/하위 역할, 목적·범위/산출·기준·부모·권한 부분집합·도구 세션 binding 이력 | FN09. 역할은 세션 종료 후에도 유지, 동시 writer 중복 금지 |
| 실행 명령·전달 대기 | commandId·operationId·행위자/클라이언트·본문 hash·기준 버전·scope·승인 소비·전달 상태 | FN08/11. 같은 key/다른 본문 거부, 저장 후 전달 |
| 실행·writer 소유 | 임무·도구 세션/turn·실행기·환경·세대·scope·유효기한·요청/수신/수행/종결·회수 사실 | FN08/13. 같은 변경 경로의 활성 소유권 중복 차단 |
| 관측·로컬 spool·ACK | 실행/세대/순번·event ID·내용 hash·관측/수신 시각·자료 참조, 연속 서버 ACK | FN08. 같은 순번 내용 충돌·공백 보존, ACK 전 삭제 금지 |
| 실행 모드·queue·한도 | 방법론 적용본·현재 위치·자동/건별 경계·정책 버전·점유/대기 이유·사용량 증거 | FN10. 미설정 무제한 금지, 재시도로 한도 초기화 금지 |
| 승인 요청·결정·소비 | 정확 대상/범위 digest·기준/환경·위험/비용/복구·만료·요청/결정/소비자·시각 | FN11. 한 요청 한 결정·한정된 명령 소비, stale 거부 |
| 결과·검토·보완·문제 | 임무/실행·산출/명령/exit/시험/환경·미실행·조건별 판정·근거·보완 연결·오류 fingerprint | FN12. 제출/검수/최종 완료 구별, 환경/quota는 기능 실패와 별도 |
| 체크포인트·중지·대조 | 현재 단계/담당·변경 파일·검증·오류/횟수·다음·서버/로컬 지점, 범위·실제 process/write·차이 | FN13. 요청≠회수, 불명 상태에서 새 writer 금지 |
| 도구 이전 | 대상 역할/연결, 기준 동결·manifest/hash·회수 공백·지원/실제 상태·이해 검토·확인자·새 binding | FN14. 총괄은 사용자 확인, 단계책임자는 총괄 확인 |
| 사람/클라이언트 인계 | 기존/대상 주체·기기, 요청 이유·안전 요약/버전·수락·제어 세대·발급/회수 | FN15. 프로젝트당 활성 제어자/클라이언트 한 쌍 |
| 백업/반출·복원 검사 | 정책 버전·포함/제외·자료 manifest/hash·생성 결과·검사/누락·대상/영향·승인·적용 | FN16. 키/계정 제외, 실행 재개 없음, live 참조 삭제 금지 |
| 알림·사용자 선택 | 중요 사건·수신자·인증된 대상 링크·전달/읽음·push 지원/허가·구독 보호 참조 | FN17. 같은 사건 중복 방지, 클릭≠승인 |
| 제품/패키지·설정 이력 | 버전/호환성·설치 산출 hash·연결 서버 참조·복구/업데이트 결과 | FN18. 자료 원본/자격증명을 패키지에 포함하지 않음 |

## 3. 버전과 세 가지 상태 축

writer 경로 충돌은 문자열 일치만 검사하지 않는다. 허가된 소스 root·정규화 실경로·링크 대상·상하위 범위의 겹침을 확인한다. DB의 활성 소유권 제약만으로 외부 Agent/프로세스의 실제 쓰기를 차단했다고 주장하지 않는다. 실행기 OS 소유/회수 확인이 부족하면 새 writer를 배정하지 않는다.

업무 진행·기능 사용 가능성·검증 결과·수행자 제출·검수는 별도 필드/증거로 보관하고 공식 코드/표시는 INTERFACES §7을 따른다. 전달/수행/중지 관측 상태도 따로다. 하나의 done 플래그로 합치지 않는다. 과거 완료 근거와 변경 후 재확인 필요를 함께 조회한다.

확정 문서/양식/방법론은 내용 hash와 version 참조가 일치해야 한다. UI의 이름이 같더라도 다른 프로젝트·버전을 합치지 않는다. 적용/rollback은 이전 기록 삭제가 아니라 새 적용 이력이다.

## 4. 파일과 관계 상태의 일관성

- 자료 업로드/생성은 staging→내용/크기/hash 검증→고유 저장 참조 등록→완료 노출 순으로 설계한다. DB와 파일을 단일 원자 트랜잭션이라고 주장하지 않는다.
- 파일만 있거나 DB 참조만 있는 중간/실패 상태는 복구 검사 대상이다. 참조 유효성 확인 전 본문/첨부가 보관됐다고 표시하지 않는다. 업로드 실패 시 사용자 입력/원본을 유지한다.
- 자료 조회는 매번 프로젝트 접근 권한을 확인한다. 전역 hash 중복 제거가 다른 프로젝트 자료의 존재를 노출하지 않게 한다.
- checkpoint 파일은 snapshot ID·기준 시각/서버 순번·내용 hash를 함께 보관한다. 사람이 읽는 현황 파일과 서버의 구조화 상태가 다르면 차이를 표시하고 조용히 어느 한쪽을 사실로 덮지 않는다.
- 본문/원문/증거 export는 Markdown·JSON·첨부 manifest로 읽을 수 있게 설계한다. Agent 로그인은 프로젝트 원본 조회의 필수조건이 아니다.

## 5. 미확정 결정과 후속 검증

서버 확정 문서와 저장소 파일의 투영은 documentId/version/hash, sourceRootId/relativePath/blobHash/commit으로 연결한다. 실제 편집 불일치는 drift이며 새 제안/영향·사용자 선택 없이 확정본/소스 파일을 덮지 않는다. 검사는 연결/내보내기/착수/제출/재개 시 영향을 받는 자료에 한정한다. 원본·요약·투영본은 같은 저장 개체가 아니다.

인증/최초 제어 저장은 FN01, 모든 변경 명령·승인/감사 집행은 FN11, 실행 원문/순번은 FN08, 사람/클라이언트의 원자적 전환은 FN15가 기존 기반을 소비한다. 삭제/취소로 감사 기록을 소급 없애지 않는다.

TD-01 후 실제 테이블/타입·외래키/유일 제약·동시성·물리 파일 경로·migration/rollback·암호화 키 관리·최초 문서 형식/크기/파서·백업/보존 수치를 고정한다. 제안 표의 존재만으로 이 항목이 확정됐다고 세지 않는다. FN별 정상/중요 실패 시험은 실제 저장→재시작→재조회 및 경쟁 요청/중간 실패를 포함하고 결과 증거는 각 업무 ID에 연결한다.

## 6. P02 계속 — 초기 저장 업무의 물리 설계

2026-10-16 Main 어울. INTERFACES §9의 FN01~03와 FN11 공통 집행을 연결하는 상세 명세 초안이다. **SQL 파일 작성/DB 적용은 하지 않았다.** 인증/정책/보호·후속 FN은 §7~11·INTERFACES·TECH_DECISIONS에 이어 명세했다. 초기 표만으로 최신 계약을 대체하지 않는다. 다음 표를 전체 물리 schema 확정이나 migration 실행 승인으로 쓰지 않는다.

### 6.1 공통 저장·버전 규칙

- 내부 ID는 `uuid`, 버전/세대/순번은 `bigint`, 시각은 `timestamptz`, 내용 hash는 SHA256 소문자 64자리 `text`다. 음수 버전/세대·잘못된 hash·필수 NULL은 제약으로 거절한다. 원문 바이트/구조화 requestHash는 INTERFACES §9.1과 구별한다.
- 프로젝트 종속 테이블은 `(project_id,id)` 고유 키를 제공하고 같은 프로젝트 관계는 복합 외래키로 연결한다. 조회/변경 권한 검사는 별도로 매 요청 수행한다. FK가 권한을 대신하지 않는다. 전역 ID만 FK로 사용해 교차 프로젝트 관계를 허용하지 않는다.
- 모든 FK는 원본/증거 자동 연쇄 삭제를 하지 않는 `RESTRICT` 기준이다. 프로젝트 보관/도구 해제는 원본 삭제가 아니다. 삭제·보존 만료 적용은 별도 정책/권한·참조 검수 뒤이며 migration rollback으로 사용자 자료를 drop하지 않는다.
- 내용 버전은 `(project_id,parent_id,version)` 또는 공통 소유 scope+ID+version으로 유일하다. 새 내용을 새 행에 기록하고 현재 pointer만 기준 버전 조건부 갱신한다. 확정/대체/사용 제외 같은 상태 결정은 별도 이력이며 내용 hash/원문을 바꾸지 않는다.
- `jsonb`는 방법론 graph/양식 항목/검증 issues처럼 신뢰 계약으로 검증된 가변 구조에만 쓴다. 권한·project 참조·현재 버전·명령/중복·상태는 JSON 내부 값만으로 강제하지 않는다. 그래프 참조/순환은 서버 검증 후 저장하고 DB CHECK 하나로 해결한다고 하지 않는다.

### 6.2 FN01 — Anvil 주체·프로젝트·초안

| 테이블 / migration 소유 | 열·키·인덱스와 무결성 |
|---|---|
| `users` / 0001·FN01 | `id PK, display_name text, status text, version bigint, created_at, revoked_at?`. 인증 방식과 무관한 내부 주체. password hash/OIDC subject·초기 소유자/복구 저장은 TD-02 전 추가하지 않음. Agent 계정 ID를 PK로 사용 금지 |
| `clients` / 0001·FN01 | `id PK, user_id FK users, label text, version, created_at, revoked_at?`. `(user_id,id)` UNIQUE. client ID 소지만으로 인증하지 않음 |
| `project_drafts` / 0001·FN01 | `id PK, owner_user_id, client_id, version, step, input_json jsonb, consumed_project_id?, created_at, updated_at`. client/owner 복합 FK, step1~4 CHECK. 입력 일부 미완성 허용, consumed 이후 생성용 편집 금지. owner/updated_at/id 목록 인덱스 |
| `projects` / 0001·FN01 | `id PK, name,purpose,desired_outcome text NOT NULL, version, archived_at?, created_at,updated_at`. 생성 시 목적/결과 공백 거절. source root/현재 방법론/기준선 관계는 소유 테이블로 분리. 이름 중복을 프로젝트 동일성으로 취급하지 않음 |
| `project_members` / 0001·FN01 | `(project_id,user_id) PK, participation:OWNER/VIEWER/HANDOFF_ELIGIBLE, version, joined_at,revoked_at?`. 사용자/프로젝트 FK. 허용 역할/행위 사전은 FN11 정책과 결박, 클라이언트가 participation을 임의 승격하지 못함. 마지막 유효 OWNER 제거 거절. user_id/project_id 활성 목록 인덱스 |
| `project_control` / 0001·FN01 | `project_id PK, actor_id,client_id,generation,version,issued_at,revoked_at?`. member와 client/user 복합 FK. 프로젝트당 행1개·generation 단조 증가. FN15는 이 행을 원자 전환하고 초기 저장소를 중복 생성하지 않음. 인증/회수 상태도 집행 시 재확인 |
| `project_baselines` / 0001·FN01 | `(project_id,id) UNIQUE, id PK, version, source_snapshot_ref, content_json,content_hash,created_by,created_at`. `(project_id,version)` UNIQUE. source snapshot은 실제 읽기 관측·dirty/미추적 상태 참조이며 존재만으로 VERIFIED가 아님. 기준선 목록/버전 재조회 인덱스 |

EXISTING 소스 root 등록/관측 테이블의 호스트/실경로·권한/정체성/승인 필드는 FN06/08 경로 계약과 함께 상세화한다. 실제 경로 미정이므로 host 절대경로·Git ref를 여기서 추정하거나 기존 개발환경 값을 새 제품 기본값으로 복사하지 않는다.

### 6.3 FN02 — 공통 원본과 프로젝트 적용본

2026-10-17 승인 후속 실제39: `methodology_reviews.project_id`(nullable/FK projects)를 추가해 프로젝트 확정 사건을 공통본과 분리한다. PROJECT 개정은 기존 methodology_definitions/versions에 새 불변 버전으로만 저장하고 정확 command receipt에 이름/목적/graph/출처/이유 snapshot을 결박한다. 읽기에서 graph hash·snapshot/receipt를 대조하며 v1 최초 생성은 기존 고정 적용 snapshot을 대조한다. PROJECT METHODOLOGY 사람 내용 검토는 기존 content_reviews에 METHOD5/정확 ref·판정/이유를 append-only로 저장하며 확정 직전 현재 head·최신 ACCEPTED 검토·준비된 양식 버전을 다시 확인한다. 초기 생성/USER_COMMON guard는 유지한다. `project_methodologies` 적용 INSERT guard/이력은 변경하지 않았으며 신규 적용 전환은 실행 상태/영향 근거가 없어 아직 열지 않는다.

| 테이블 / migration 소유 | 열·키·인덱스와 무결성 |
|---|---|
| `methodology_definitions` / 0002·FN02 | `id PK, scope SYSTEM/USER_COMMON/PROJECT, owner_user_id?,project_id?,system_code?,name,purpose,head_version,created_at`. scope에 맞는 소유자 조합 CHECK, SYSTEM은 SYS-M01~03 출처 식별·사용자 직접 쓰기 금지. 접근 가능한 소유 scope 내 목록 인덱스 |
| `methodology_versions` / 0002·FN02 | `(definition_id,version) PK, name,purpose,graph_json,content_hash,origin_ref_json?,reason,created_by,created_at`. 이름/목적도 해당 버전에 보존, definition 값은 현재 목록 projection. FK definition. 내용을 UPDATE하지 않음. origin은 읽기 권한/정확 버전·hash를 검증한 복사 출처이며 원본을 교체/삭제해도 보존. SYSTEM 생성은 실제 사용자/사람 확정을 날조하지 않으며 source 승인과 제품 인수 분리 |
| `methodology_reviews` / 0002·FN02 | `id PK,definition_id,version,target_hash,validation_json,review_refs,decision,decided_by,decided_at`. 버전 FK. validation과 사용자 확정 사건을 구분. 같은 내용 hash의 확정 근거만 적용에 사용 |
| `project_methodologies` / 0002·FN02 | `(project_id,id) UNIQUE, id PK, application_version, source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash,created_by,created_at`. `(project_id,application_version)` UNIQUE. 확정한 공통/전용본을 허가 확인 후 프로젝트에 고정 복사. 공통본 개정 시 pointer 자동 변경 금지 |

노드/edge·노드의 문서 양식 참조는 graph와 pinned snapshot에 보존하고 FN02 서버가 정합성을 검사한다. JSON 안 참조의 실제 존재/권한·양식 version/hash 검사를 FK가 대신하지 않는다. 현재 적용본 pointer는 projects의 조건부 갱신 또는 별도 단일 현재 관계로 구현하되 실제 SQL의 순환 FK 생성 순서는 migration 상세에서 고정한다. 진행 중 교체는 FN04 영향·승인/계획 적용을 소비한다.

### 6.4 FN03 — 양식·자료·본문·제안

| 테이블 / migration 소유 | 열·키·인덱스와 무결성 |
|---|---|
| `authoring_standard_versions` / 0003·FN03 | 공식 양식이 실제로 소비하는 공통 작성 기준의 `(id,version) PK,content_hash,body_utf8,source_approval_json,created_at`; 정확 `(id,version,content_hash)` UNIQUE. source 승인 지문과 제품 문서 검수/사용자 확정은 분리하며 미래 지식 저장소의 가짜 참조를 만들지 않는다. app 읽기 전용. 첫0003은 catalog 저장에 한정, 문서 원본/본문/제안 표는 후속 forward-only migration으로 구현한다 |
| `form_definitions` / 0003·FN03 | `id PK, scope,owner_user_id?,project_id?,form_code,name,head_version,created_at`. SYSTEM AF01~08·사용자 공통/전용 scope와 접근 분리. 공식코드/종류 매핑 불변 |
| `form_versions` / 0003·FN03 | `(definition_id,version) PK, definition_json,content_hash,authoring_standard_ref,origin_ref_json?,created_by,created_at`. 필수 항목ID·작성/검수/확정 역할·출처를 저장. 문서/방법론에 사용한 버전은 덮지 않음 |
| `artifacts` / 0003·FN03 | `id PK,project_id?,draft_id?,bytes bigint,content_hash,media_type,storage_key,state:STAGING/READY/QUARANTINED/FAILED,created_by,created_at`. 소유 project/draft 중 정확히 하나. `(project_id,id)`와 `(draft_id,id)` UNIQUE, bytes>=0. storage_key는 서버 생성값, 외부 입력 경로가 아님. 전역 hash만으로 읽기/존재 조회 금지 |
| `document_imports` / 0003·FN03 | `id PK,project_id?,draft_id?,original_artifact_id,extracted_artifact_id?,parser_version?,state,losses_json,issues_json,created_by,created_at`. 소유 범위 정확히 하나·같은 소유 artifact FK. 지원불가/실패에도 original 참조 유지 |
| `documents` / 0003·FN03 | `(project_id,id) UNIQUE,id PK,title,head_version,confirmed_version?,created_by,created_at,updated_at`. `(project_id,updated_at,id)` 목록 인덱스, 현재/확정 pointer를 구별 |
| `document_versions` / 0003·FN03 | `(project_id,document_id,version) PK,form_definition_id,form_version,form_hash,stage_ref_json?,body_artifact_id,title,source_refs_json,content_hash,sections_json,author_ref_json,reason,created_at`. document/body composite FK와 form version FK. title/source_refs_json은 해당 불변 version에 저장·정확 참조/소유 검증, documents.title은 현재 목록용 projection일 뿐 구버전 원본이 아님. 본문 hash/크기 READY 검증 뒤 저장. 양식은 SYSTEM/자기 공통/프로젝트 권한과 정확 version/hash 대조 |
| `document_artifact_links` / 0003·FN03 | `(project_id,document_id,version,artifact_id,kind) PK`, kind BODY/ATTACHMENT/SOURCE. version/artifact 복합 FK. 이름/hash만 같아도 타 프로젝트 파일 연결 거절 |
| `document_proposals` / 0003·FN03 | `(project_id,id) UNIQUE,id PK,document_id,base_version,base_hash,proposed_body_id,diff_artifact_id,reason,created_by,created_at`. 기존 version/같은 프로젝트 artifact FK. 원 제안 불변; 반영/거절은 상태 이력. 생성만으로 문서 head/confirmed pointer 변경0 |
| `document_version_events` / 0003·FN03 | `id PK,project_id,document_id,version,event_kind,review_ref?,actor_ref,reason,created_at`. 버전 FK. 저장/검토/확정/대체·제안 선택 이력 append. 형식 검사와 내용 검수·사용자 확정 사건을 구별 |
| `document_source_links` / 0003·FN03 | `(project_id,id) UNIQUE,id PK,document_id,version,source_root_id,relative_path,source_snapshot_ref,blob_hash,linked_at`. document version FK. root/경로·snapshot 검증 후 저장, drift 관측은 별도 이력으로 남기며 서버 확정 hash를 덮지 않음 |

형식상 표만 채운 빈 repository나 새 범용 EAV 저장 엔진은 만들지 않는다. 아직 없는 source snapshot·검수/승인 테이블을 임시 문자열로 합격 처리하지 않으며 FN04/08/11/12 상세 모델에 exact FK/참조 검사를 연결한다. 작성 중 초안 파일/가져오기를 프로젝트에 귀속할 때 owner만 바꿔 타 자료와 연결하지 않는다. 초안 소비 트랜잭션에서 같은 원본 ID·hash/관계를 새 프로젝트로 함께 옮기고 이전 초안 쓰기를 차단한다.

### 6.5 저장 원자성·권한/제어 경쟁

1. 현재 사용자/client의 유효성→멤버/정책·project_control→명령 유일 키→대상 head를 일정 순서로 잠금/대조한다. 권한/제어 회수 연산도 같은 gate에 참여해야 변경과 회수 사이 경쟁을 막는다. 단순 읽기 후 쓰기 금지. 로그인 세션 저장 방식/회수 gate는 TD-02 상세 뒤 확정한다.
2. `commands`는 FN11 소유로 `id,scope_kind,scope_id,actor_id,operation,command_id,request_hash,operation_id,state,result_ref,received_at`를 갖고 `(scope_kind,scope_id,actor_id,operation,command_id)` UNIQUE다. PROJECT/DRAFT scope_id는 NOT NULL, draft/project 혼동 금지. operation_id도 UNIQUE다. P02 후속 FN11 표에서 승인/감사/이벤트/outbox와 전체 열을 완성한다.
3. 권한을 확인한 동일 key의 기존 행은 hash를 대조해 같은 결과 또는409를 반환한다. 새 명령은 대상 head의 expectedVersion 조건부 UPDATE·내용/상태 이력·감사/receipt·필요 이벤트 대기를 같은 트랜잭션에 저장한다. 경합 한쪽만 성공하고 다른 쪽은409, 부분 내용/유실 감사 없이 rollback한다. 실패/거절 감사의 별도 보존 경계도 FN11에서 고정한다.
4. 공통 원본의 scope 소유 권한도 해당 소유/개정 행을 대조한다. 사용자 공통본 수정 시 다른 프로젝트의 제어권이 자동 생기지 않는다. 다른 프로젝트의 기존 적용본은 불변 snapshot이므로 공통 개정이 실제 실행 기준을 바꾸지 않는다.
5. 자료 파일은 한 DB 트랜잭션처럼 취급하지 않는다. 제한된 staging 쓰기→close/크기/hash 검증→게시/무결성 확인→READY 참조 commit 순이다. 장애 시 미참조 파일은 회수 후보이며 즉시 삭제하지 않는다. DB만 참조/파일 누락이면 본문 성공 대신 저장 불가·복구 대조 상태를 반환한다. checksum만으로 디스크 영속성 전체를 증명하지 않는다.

구현 근거: 복합 FK/UNIQUE로 참조/고유성을 강제하고 다른 행을 참조하는 CHECK에 맡기지 않는다([PostgreSQL 제약](https://www.postgresql.org/docs/15/ddl-constraints.html)). 변경 경쟁의 잠금 범위·해제·교착 실패 처리는 실제 통합 시험으로 확인한다([행 잠금](https://www.postgresql.org/docs/15/explicit-locking.html)). 이 명세는 해당 기술을 실제 적용/검증했다는 뜻이 아니다.

### 6.6 파일 경로·migration·복구의 배정 경계

서버 파일 위치는 사용자/환경에서 확정할 `storageRoot` 아래 `staging/<uploadId>/`와 `blobs/<projectId>/<artifactId>`라는 논리 storage_key로 구분한다. 초안 자료는 `draft-blobs/<draftId>/<artifactId>`로 분리하고 귀속 전환 중 원본/새 참조가 모두 검증될 때만 이전 상태를 정리한다. 이 상대 key를 브라우저/Agent 임의 파일 접근 경로로 쓰지 않는다. 실절대경로·소유권·암호화/백업 키·수명/GC 정책은 아직 미확정이며 새 폴더를 만들지 않았다.

배정 순서: FN01 0001(주체·초안·프로젝트/초기 제어)→FN11 0011(정책·command/감사 기반)→FN02 0002/FN03 0003(정확 FK 소비), FN04 0004/FN05 0005 후속. 번호순 migration 강요는 금지하며 runner 의존/체크섬은 P03에서 고정한다. 이 순서는 현재 실제 적용 순서가 아니라 계획의 선행을 따르는 구현/검수 경계다.

검수는 기존 FILE_MAP의 FN01/FN02/FN03/FN11 시험 파일에서 정상 저장/재시작/재조회·동시 stale/중복·타 프로젝트 FK 거절·공통 원본 불변·파일/DB 중간 실패를 확인한다. 실제 SQL 적용/권한·파일 소유/원본 보호 시험 전에는 설계상 제약을 보안 PASS로 표시하지 않는다. 실패 시 적용된 migration 수정/drop/reset 대신 실패 지점/자료 보존·검증된 후속 migration/복구안을 제시한다.

## 7. P02 계속 — 허가·추적·지식의 저장 명세

INTERFACES §10을 기존 FN11 0011/FN04 0004/FN05 0005에 연결한다. 아래는 실행할 SQL이 아니라 상세 명세다. §6.1의 project 복합 참조·버전/불변 원문·RESTRICT·권한 검사를 상속한다. SQL의 행/열 권한·DB 역할·암호화/운영 사용자는 아직 변경하지 않았다.

### 7.1 FN11 공통 집행·감사

| 테이블 | 필수 열·참조·고유/경쟁 조건 |
|---|---|
| `permission_policies` | `(project_id,id) UNIQUE,id PK,head_version,created_by,created_at`. 현재 적용 관계는 프로젝트당 하나, 정책 변경은 새 버전/적용 이력 |
| `permission_policy_versions` | `(project_id,policy_id,version) PK,rules_json,content_hash,reason,review_refs,created_by,created_at`. policy 복합 FK. operation enum·subject/scope/기한/한도 참조 검증. 자유문장→임의 실행 권한 변환 금지 |
| `approval_requests` | `(project_id,id) UNIQUE,id PK,version,candidate_command_id,action_scope_json,scope_digest,details_json,required_decider_ref,status,expires_at,created_by,created_at`. 내용 불변, 조회용 상태와 별도 결정 사건. 승인 상세/정책 관리 권한 검사 |
| `approval_decisions` | `(project_id,id) UNIQUE,id PK,request_id UNIQUE,request_version,scope_digest,decision,reason,decided_by,client_id,control_generation,decided_at`. request 복합 FK. 최종 결정 한 건, APPROVE/REJECT/REQUEST_CHANGE 경쟁에서 한 번만 성립 |
| `approval_consumptions` | `(project_id,id) UNIQUE,id PK,decision_id UNIQUE,command_id UNIQUE,scope_digest,policy_id,policy_version,consumed_at`. 정확 요청/결정/command·policy 참조. 동일 command의 receipt 재조회는 소비 횟수 증가0. 다른 command 소비 거절 |
| `commands` | §6.5의 공통 command 행에 `authorization_receipt_id?,approval_consumption_id?,expected_version,control_generation,policy_ref,payload_ref,result_ref,completed_at?` 추가. PROJECT/DRAFT scope 분리·중복 key/본문 hash 고정. 상태 PERSISTED/APPLIED/DELIVERY_PENDING/FAILED는 실행/업무 완료와 별개 |
| `authorization_receipts` | `id PK,scope_kind,scope_id,command_id UNIQUE,subject_ref,policy_ref,scope_digest,approval_decision_ref?,authorized_at`. 서버 집행 근거, 외부 Agent가 발급/수정할 수 없음. 승인 소비와 명령의 순환 FK는 transaction 내 deferred 참조 또는 생성 순서를 SQL 배정 때 명시 |
| `audit_events` | `(project_id,server_sequence) PK,event_id UNIQUE,actor_ref,client_ref?,command_id?,operation_id?,target_ref,policy_ref?,approval_ref?,outcome,reason_code,scope_digest?,source_kind,correction_of?,recorded_at`. 내용 append·정정 새 행. 원문/비밀 대신 보호 증거 ref. 권한 없는 UPDATE/DELETE 차단 시험 |
| `project_events` | `(project_id,server_sequence) PK,event_id UNIQUE,kind,target_ref,command_id?,safe_payload_json,recorded_at`. UI 조회/스트림 사건이며 audit와 목적/순번 독립. 권한 있는 현재 구독자에게만 전달, 외부/브라우저 임의 실행 payload 없음 |
| `delivery_outbox` | `id PK,project_id,command_id,kind,destination_ref,payload_ref,scope_digest,state,attempt_count,next_attempt_at?,last_error_code?`. `(command_id,kind,destination_ref)` UNIQUE. 도메인 저장과 같은 transaction에서만 추가. 문서/지식 저장 사건은 Agent dispatch가 아님 |

`commands`의 id와 candidate_command_id의 의미를 혼동하지 않는다. candidate_command_id는 브라우저 사용자 행동의 commandId이며 commands.id는 서버 행 ID다. consumption의 command_id는 서버 commands.id를 FK로 사용하고 승인 요청의 candidate 값과 action/본문 hash를 검사한 뒤 연결한다. DRAFT 명령은 프로젝트 생성 전이라 project 감사가 없을 수 있으므로 별도 `draft_audit_events`를 FN11이 소유한다(`draft_id,sequence` PK·작성자/client/command·결과·비밀 없는 사유·시각). 생성 뒤 새 프로젝트 사건과 원 초안 사건 참조를 연결하고 과거 이력을 다른 프로젝트에 재귀속하지 않는다.

소비 경쟁은 request/decision·현재 policy/control·command의 동일 잠금 순서 아래 처리한다. 성공 시 소비/receipt·command/도메인 변경·audit/outbox가 모두 commit하거나 모두 실패한다. 이미 결정/소비된 요청을 새로운 세대/다른 payload로 재사용하지 않는다. 변경 중 권한/세대 회수는 같은 집행 gate에서 직렬화해 늦게 도착한 옛 명령을 차단한다. deadlock/transaction 실패를 새 commandId 자동 재발행의 근거로 쓰지 않는다.

audit와 UI event의 수신순번은 각각 프로젝트별 카운터/직렬화로 발급하고 commit된 사건만 조회한다. 내구 저장 실패·누락/변조 검출 결과를 별도로 보존한다. 감사와 기준이 같은 관리자 통제 아래 있으면 변조 불가/완전 검출을 보장하지 않는다. 독립 검증 기준/보존 경로·서명키는 미결정이며 임의 외부 서비스/키를 만들지 않는다.

### 7.2 FN04 설계·계획·추적·변경

2026-10-16 forward20 `0004_design_index`만 실제 적용: design_items는 AF02 exact document id/version/hash·localCode/title/line anchor·item_json/item_hash·현재 actor/client/command를, screen_regions는 같은 프로젝트 design_item과 AF03 exact source version/hash/body artifact·screenCode/anchor·region_json/hash를 불변 저장한다. 현재 제어/명시 policy/APPLIED exact receipt guard와 app SELECT/INSERT만 허용하고 UPDATE/DELETE는 불허한다. 기존19 SQL 불변, actual FN03/FN11 2 PASS/3368ms·독립 두 신규 표 포함15종 QA 잔여0이다. 아래 work_plan/trace/change 표는 아직 미구현이며 schema 정의를 실제 완료로 세지 않는다.

| 테이블 | 필수 열·참조·고유 조건 |
|---|---|
| `design_items` | `(project_id,id) UNIQUE,id PK,design_document_id,document_version,local_code,title,anchor,item_hash`. document version 복합 FK, `(project_id,design_document_id,document_version,local_code)` UNIQUE. 같은 코드의 과거 버전 보존 |
| `screen_regions` | `(project_id,id) UNIQUE,id PK,design_item_id,screen_code,artifact_id,anchor,region_hash`. design/시안 artifact composite FK. 버튼/위치→업무 연결, 임의 이미지 파일명만 참조하지 않음 |
| `work_plans` | `(project_id,id) UNIQUE,id PK,head_version,confirmed_version?,created_at`. AF04 문서/기준 설계의 개정은 하위 버전으로 저장 |
| `work_plan_versions` | `(project_id,plan_id,version) PK,document_ref,design_ref,screen_review_refs,content_hash,created_by,created_at`. 정확 AF04·설계/검토 버전의 서버 저장 참조 검사. confirmed pointer는 검토/사람 확정 뒤만 갱신 |
| `plan_tasks` | `(project_id,plan_id,plan_version,task_code) PK,task_type,card_json,card_hash,owner_role`. TaskCard 필수 입력/범위/파일·단계·검수와 SCREEN/FUNCTION/INTEGRATION/PREPARATION 저장. 실제 실행/상태는 계획 내용과 분리 |
| `plan_dependencies` | `(project_id,plan_id,plan_version,task_code,dependency_task_code,phase) PK`, phase START/ACCEPTANCE. 양쪽 task composite FK·자기 의존 거절, phase별 순환/외부 선행 참조는 서버 검사. 두 선행을 한 문자열로 합치지 않음 |
| `trace_edges` | `(project_id,id) UNIQUE,id PK,from_kind,from_id,from_version,to_kind,to_id,to_version,relation,reason,created_by,created_at`. 관계 복합 키 UNIQUE. 다형 참조는 서버의 종류별 whitelist resolver로 실제 존재/권한·버전 대조, 무검증 JSON 링크 저장 금지 |
| `design_change_requests` | `(project_id,id) UNIQUE,id PK,version,before_ref,after_proposal_ref,reason,source_refs,created_by,created_at`. 이전 확정 문서/제안 참조 검사. 요청/승인/적용을 서로 다른 사건으로 보존 |
| `design_change_impacts` | `(project_id,change_id,version) PK,items_json,coverage_gaps_json,content_hash,review_ref?,created_by,created_at`. 모든 영향 판단의 근거/UNKNOWN 유지. 변경 전 실행/결과 참조를 삭제하지 않음 |
| `baseline_activations` | `(project_id,id) UNIQUE,id PK,change_id,impact_version,design_ref,plan_ref,approval_consumption_id,previous_activation_id?,created_by,created_at`. 정확 scope 승인 소비/현재 기준 CAS·영향 업무 재확인 이력과 원자 저장. 적용마다 새 행 |

현재 기준은 별도 프로젝트 현재 pointer로 한 번만 연결한다. 임무는 그 activation/design/plan version을 고정하고 사후 개정으로 원래 완료 근거를 갈아끼우지 않는다. 이전 기준으로 완료된 업무의 진행/기능/검증 상태와 새 기준 재확인 요구를 별도로 보관한다. 실제 실행/검수 테이블(FN09/12) 전에는 빈 완료 증거를 생성하지 않는다.

### 7.3 FN05 원문·헌법·지식·맥락

승인된 forward37 후보 `0005_project_constitutions`는 constitution_applications(projectId/적용 세대 PK·정확 지식/확정·snapshot/hash·이전 적용 ref·주체/client/command/time)의 append-only 이력과 project_constitutions의 guarded 현재 pointer만 추가한다. 현재 정책/제어·명령 receipt·최신 적합 검토/원문 버전을 결박하며 app 이력 UPDATE/DELETE·pointer DELETE는 불허한다. 기존 knowledge 원문/확정과36개 적용 SQL은 수정하지 않는다. 실제 checksum/적용/검증은 WORK_STATUS로 분리한다.

2026-10-16 FN04 적용 후보 `0004_work_plan_drafts`(forward21): work_plans/head와 불변 work_plan_versions·plan_tasks·plan_dependencies를 추가한다. 정확 AF04/AF02 문서 버전/hash·현재 actor/client/control·명시 policy/receipt 및 task/dependency snapshot을 결박한다. app은 SELECT/INSERT와 guarded head/updated_at 변경만 가능하고 confirmed_version·불변 버전/카드의 UPDATE/DELETE는 허용하지 않는다. 관계 모호성이 있는 초안은 version_json에 원 카드/문제 전체를 보존하되 관계 테이블에는 투영하지 않는 ISSUES_ONLY다. 기존20 SQL·원문/확정 pointer는 변경하지 않는다. 실제 적용 결과는 WORK_STATUS에 별도 기록한다.

| 테이블 | 필수 열·참조·고유 조건 |
|---|---|
| `conversations` | `(project_id,id) UNIQUE,id PK,target_role_ref,created_at`. 특정 외부 Agent 계정의 thread가 원본 PK가 아님 |
| `conversation_messages` | `(project_id,conversation_id,sequence) PK,id UNIQUE,author_ref,kind,body_artifact_id,source_refs,reply_to?,supersedes_instruction_id?,effective_scope,recorded_at,redaction_state`. 같은 project artifact·발언 참조, 작성 주체/실행 소유 검증. 원문 UPDATE/삭제 대신 새 정정 발언 |
| `knowledge_entries` | `(project_id,id) UNIQUE,id PK,kind,head_version,created_by,created_at`. 헌법도 CONSTITUTION kind이며 중복 본문 저장소 없음 |
| `knowledge_versions` | `(project_id,entry_id,version) PK,title,content_artifact_id,content_hash,source_refs,reason,scope_json,related_refs,supersedes_version?,created_by,created_at`. source 실제 버전·권한·사실/가설 출처 검사 |
| `knowledge_events` | `id PK,project_id,entry_id,version,kind:PROPOSED/CONFIRMED/CORRECTED/EXCLUDED/SHARED,reason,actor_ref,approval_ref?,target_refs?,recorded_at`. 같은 지식 버전 FK·정확 공유 대상/승인 참조. EXCLUDED는 삭제 아님 |
| `project_constitutions` | `project_id PK,entry_id,version,applied_by,applied_at`. knowledge version composite FK·kind 검사. 임무별 적용본은 당시 version 고정, 새 헌법이 기존 실행 허가를 넓히지 않음 |
| `context_bundles` | `(project_id,id) UNIQUE,id PK,version,assignment_ref,baseline_refs,budget_ref,manifest_json,content_hash,created_at`. assignment/기준은 실제 저장 ref 검사, 생성만으로 전달/이해 완료 아님 |
| `context_items` | `(project_id,bundle_id,bundle_version,item_id) PK,category,required,source_ref,source_hash,included_state,reason`. 원본 hash/허가 대조, MISSING/REDACTED/EXCLUDED 보존. source 관계 검색의 임의 깊이 제한으로 필수 이유 누락 금지 |
| `context_deliveries` | `(project_id,id) UNIQUE,id PK,bundle_ref,connection_ref,external_session_ref,instruction_id,part_manifest_json,receipt_refs,state,created_at`. 수신/실패/미확인과 마지막 순번 보존, 실제 어댑터 수신 근거 전 DONE 금지 |
| `understanding_reviews` | `(project_id,id) UNIQUE,id PK,bundle_ref,response_source_ref,subject_binding_ref,reviewer_ref,items_json,outcome,created_at`. 6항목 각각 기준/응답/판정/근거 저장. 총괄/단계 교체의 최종 확인 주체를 FN09/14가 검증 |

FN05 첫 forward23 후보 `0005_knowledge_drafts`는 knowledge_entries/knowledge_versions/knowledge_events의 새 PROPOSED만 허용한다. entry_json과 정규 열·동일 프로젝트 artifact·정확 현재 command/client/control/명시 policy·receipt를 결박하며 head FK는 transaction 끝에 검사한다. app SELECT/INSERT만 부여하고 UPDATE/DELETE·확정/공유 사건은 차단한다. 기존22 SQL·원문·확정 pointer를 수정하지 않으며 정정/제외 등은 후속 새 forward로 보완한다. 적용 여부·checksum은 WORK_STATUS 실측을 따른다.

후속 forward24 후보 `0005_conversations`: conversations에 head_sequence/created_by/last_client_id/last_command_id/updated_at을 두고 현재 exact 허가 아래 1씩만 전진한다. conversation_messages는 불변 message_json/content_hash·현재 author/client/receipt·같은 프로젝트 보호 artifact와 같은 대화 reply/정정 복합 FK를 결박한다. app SELECT/INSERT와 guarded head 관련 열 UPDATE만 허용하고 발언 UPDATE/DELETE·Agent 주체 위조는 거절한다. 기존23 SQL/원문을 수정하지 않는다.

정정/제외 forward25 후보 `0005_knowledge_changes`: knowledge_events에 base_ref/change_sources를 추가하고 버전별 EXCLUDED1개만 허용한다. 기존 guard를 forward로 보완해 새 정정 버전/출처/원문·사건과 exact 현재 명령/허가·원 base/hash를 결박하고 guarded head_version 증가만 추가 허용한다. 기존 원문·불변 version/event UPDATE/DELETE와 확정/공유 사건은 계속 차단한다. 적용 SQL23/24 자체를 수정하거나 자동 downgrade하지 않는다.

검색은 원문/지식의 project·접근·사용 제외/대체 상태를 먼저 제한한다. 인덱스/랭킹 구현은 FN05가 자료량에 맞는 PostgreSQL/파일 계약 안에서 선택하며 별도 외부 벡터 서비스·학습 엔진을 자동 추가하지 않는다. 임무 자동 선택에서 제외된 지식도 허가된 과거 조회로는 확인 가능하다. 민감 의심으로 격리된 artifact는 검색 snippet·context 전달에서도 차단한다.

### 7.4 참조·시험·migration 배정

VersionRef·TraceRef의 다형 참조를 DB가 자동으로 모두 검증한다고 주장하지 않는다. 서버 resolver는 project/kind/ID/version/hash를 실제 원본과 대조하며 종류별 정상/교차 프로젝트/삭제·구버전/위조 hash를 시험한다. 정규 FK가 가능한 관계는 복합 FK로 강제한다. 아직 없는 임무/실행/검수/보호 저장 ref는 P02 후속 모델에 연결되기 전 배정 준비 미충족이다.

FN11 policy/command·감사 기반은 FN01 뒤, FN04는 FN02/03/FN11 뒤, FN05는 FN03 뒤 구현한다. FN09에 의존하는 context/이해의 실제 전달 검수는 해당 연결 뒤이고, 그 전에도 원문·헌법·지식 저장/검색은 독립 검수한다. 파일/DB/문서·계획 참조는 같은 버전/hash인지 확인하고 실패에 원문을 보존한다. 구체 SQL·migration runner 의존 graph/rollback·정책 수치는 여전히 P02/P03 경계이며 실제 적용0이다.

## 8. TD-02 승인 — 로그인/회수의 물리 명세

신산님의 ‘Anvil 전용 로그인으로 설계’ 직접 선택에 따라 FN01 0001의 access 저장을 아래처럼 상세화한다. §6.2의 인증 필드 유보는 당시 상태이며 현재는 이 절을 소비한다. Agent 계정/사용 토큰은 여기로 복사하지 않는다. 실제 DB/사용자/Secret 변경은 수행하지 않았다.

| 테이블/추가 열 | 필수 내용·보호/원자 조건 |
|---|---|
| `users` 추가 | `login_name,normalized_login_name UNIQUE,credential_generation bigint,server_owner boolean`. display_name과 구별. 초기 server_owner claim은 설치 상태 행과 원자 저장, 사용자ID는 Agent 계정과 무관 |
| `password_credentials` | `user_id PK/FK users,argon2_phc text,credential_generation,changed_at`. PHC에 salt/파라미터 포함, 평문/복호화 비밀번호 없음. 읽기 권한은 인증 처리만, 브라우저/API 일반 조회/프로젝트 export 제외 |
| `auth_sessions` | `id PK,token_digest UNIQUE,user_id,client_id,credential_generation,csrf_digest,created_at,last_seen_at,idle_expires_at,absolute_expires_at,reauth_until?,revoked_at?`. token/CSRF 원문은 응답에만 전달, session digest로 검증. user/client FK, 사용자 회수·세션 고정 방지·전체 로그아웃 인덱스 |
| `installation_claims` | `installation_id PK,bootstrap_digest,expires_at,consumed_at?,owner_user_id?,version`. 미초기화 단일 행 잠금/조건부 갱신. 소비 후 원본 비밀 삭제/회수 상태로 두고 과거 claim을 되살리는 자동 초기화 없음 |
| `user_invitations` | `id PK,normalized_login_name,display_name,secret_digest UNIQUE,project_grants_json,expires_at,consumed_by?,consumed_at?,revoked_at?,created_by`. 명시 소유자/범위·기한, 초대 소비와 사용자/참여 귀속을 같은 transaction에서 저장 |
| `recovery_credentials` | `id PK,user_id,secret_digest UNIQUE,issued_at,consumed_at?,revoked_at?`. 사용자별 활성 복구 수단1개 제한, 고엔트로피 비밀 digest만 저장. 회수/교체 이력·새 비밀번호 generation/전체 session revoke와 원자 처리 |
| `auth_attempt_windows` | `(bucket_kind,bucket_key,window_start) PK,attempt_count,blocked_until?,updated_at`. 계정/신뢰된 source별 실패 제한, 알 수 없는 사용자도 같은 정책. 입력 source 위조·재시작 우회·무제한 row 생성/DoS 상한은 유한 정책과 검수 |
| `auth_actions` | `(actor_scope,operation,command_id) UNIQUE,id PK,protected_fingerprint,result_status,safe_result_ref,created_at`. 인증 요청 재전송용이며 비밀번호/비밀의 단순 requestHash·평문 payload 금지. 원 비밀 응답을 보관하지 않음 |
| `auth_audit_events` | `id PK,server_sequence UNIQUE,subject_ref?,action_id?,client_ref?,operation,outcome,reason_code,recorded_at`. 인증 전에도 비밀 없는 실패/보호 사실 저장. project audit와 권한/목적을 구별, 조회 권한 없는 사용자 이름·존재 노출 금지 |

비밀번호 변경/복구/회수와 사용자 변경 명령은 users의 동일 credential gate에서 현재 generation·session 유효 상태를 검사한다. session revoke보다 먼저 허가된 이미 commit된 명령은 이력으로 남고, 나중 변경은 거절하며 실제 Agent writer는 별도 회수 관측한다. 비밀번호/비밀 검증은 안전한 라이브러리 비교를 사용하고 실패 응답의 이름 존재·시각/상태 차이 최소화는 실제 시험으로 확인한다. 여기서 완전 상수 시간·공격 방지 PASS를 주장하지 않는다.

세션·초대·복구 비밀은 충분한 CSPRNG 출력과 용도별 독립 값으로 설계하고 digest/HMAC 키는 사용자 원본·DB backup과 분리된 보호 Secret 참조를 갖는다. HMAC 알고리즘/키 수명·실보관 위치/OS 소유·bootstrap/키 생성은 P03의 정확 자원 계약과 승인 전 실행하지 않는다. 전체 backup 복원으로 session/초대/복구 권한이 자동 부활하지 않도록 별도 인증 복구 세대·키 회수/재인증 절차를 FN16 계약에 연결한다.

검수 파일은 FN01 `tests/unit/FN01/auth.test.ts`, `tests/integration/FN01/auth-postgres.test.ts`로 추가한다. 정상/실패 로그인·같은 이름·동시 초기 claim·초대/복구 재사용·CSRF·fixation·토큰 회수/만료·비밀번호 교체 경쟁·비밀 로그/command 저장0을 확인하고 FN11/IX01이 현재 client/control과 교차 프로젝트를 소비한다. 실제 SQL·라이브러리·HTTPS/DB 통합 시험은 아직 미실행이다.

## 9. 연결·실행/관측의 저장 명세

INTERFACES §12의 서버 원본과 Windows 로컬 회수 기록을 구별한다. FN06 0006은 연결/환경/등록, FN08 0008은 전달/실행/관측을 소유한다. FN07은 같은 연결 schema·저장에 두 번째 실제 도구를 연결하고 별도 원본 저장소를 만들지 않는다. 모든 프로젝트 관계는 기존 복합 참조/권한을 상속한다.

| 저장 단위 | 필수 열·고유 조건·소유 |
|---|---|
| `connectors` | `id PK,owner_user_id,host_label,host_fingerprint,connector_version,generation,status,created_at,revoked_at?`. 프로젝트별 신뢰/범위는 별도 grants, 외부 계정과 다른 개체. FN06 |
| `connector_registrations` | `id PK,version,requested_by,expected_host_fingerprint,observed_fingerprint?,code_digest,client_nonce_digest,scope_json,scope_digest,expires_at,state,decision_ref?,consumed_at?`. 일회 교환·사용자 비교 확인·반복/타 host 거절. host challenge/서명·DPAPI의 상세 기준은 TECH_DECISIONS §11이며 실제 검증은 미실행. FN06 |
| `connector_grants` | `(connector_id,project_id) PK,environment_ref,policy_ref,version,issued_by,issued_at,revoked_at?`. 연결이 다른 프로젝트 자료 접근 권한을 자동 취득하지 않음. FN06 |
| `connector_credentials` | `id PK,connector_id,generation,token_digest UNIQUE,scope_digest,issued_at,expires_at,revoked_at?`. 비밀 원문은 서버/브라우저 원본에 보관하지 않음. 갱신/회수도 명시 허가/범위 검사. FN06 |
| `agent_connections` | `(project_id,id) UNIQUE,id PK,version,definition_json,connector_id,tool_product,tool_version,account_protected_ref,capability_report_ref,status`. 서버 소유 자료와 외부 계정 참조 분리. FN06/07 |
| `capability_reports` | `(project_id,id) UNIQUE,id PK,connection_id,connection_version,tool_version,environment_ref,documentation_json,measurements_json,limitations_json,content_hash,created_at`. 공식/실측/미확인·통제 수준·정확 증거 참조 구분. FN06/07 |
| `environment_versions` | `(project_id,id,version) PK,source_refs_json,execution_host_ref,target_refs_json,command_profile_refs,secret_protected_refs,policy_ref,content_hash,created_at`. 원문 Secret/내부 접속주소를 UI 목록에 전달하지 않음. FN06 |
| `source_roots` | `(project_id,id) UNIQUE,id PK,host_ref,registered_path_protected_ref,identity_ref,scope_json,mapping_ref?,version,registered_by,registered_at`. host 실경로·링크·정체성 확인 전 등록 준비 실패. 등록이 파일 전체 읽기/쓰기 승인이 아님. FN01은 USER_DECLARED 소스 참조만 먼저 저장하고 VERIFIED로 표시하지 않음. FN06/08 실제 관측이 후속 결박 |
| `source_snapshots` | `(project_id,id) UNIQUE,id PK,source_root_id,observed_host,identity_ref,branch_ref?,commit_ref?,dirty_manifest_ref,protected_diff_refs,recorded_at,observed_at,authority:CONNECTOR_OBSERVED/USER_DECLARED`. command/기준선·드리프트 증거는 실제 관측 등급을 검사. FN01 사용자 선언만으로 snapshot을 CONNECTOR_OBSERVED로 승격할 수 없고 실제 연결이 없어도 원본 생성·문서 저장은 진행 비밀/범위 밖 자료 자동 수집0. FN08 |
| `agent_sessions` | `(project_id,id) UNIQUE,id PK,connection_id,connection_version,role_binding_ref,external_handle_protected_ref,tool_version,created_at,ended_at?,last_observed_state`. 세션 소실/계정 해제가 프로젝트 원본을 지우지 않음. FN06/08 |
| `executions` | `(project_id,id) UNIQUE,id PK,assignment_ref,session_id,connector_id,generation,authorization_receipt_ref,environment_ref,source_scope_hash,budget_ref,requested_at,started_at?,terminal_at?,observed_state,reclaim_state`. 외부 completed/UNKNOWN·STOP_REQUESTED·RECLAIMED를 분리. FN08 |
| `execution_receipts` | `(project_id,execution_id,generation,command_id,state) UNIQUE,id PK,local_receipt_hash,external_turn_ref?,observed_at,received_at,evidence_refs`. durable 수신/시작·거절·불명 상태를 구별, 같은 command 실제 부작용 반복0. FN08 |
| `execution_observations` | `(project_id,execution_id,generation,sequence) PK,event_id UNIQUE,kind,payload_ref,payload_hash,artifact_refs,source_kind,observed_at,received_at,server_event_ref`. 동일 순번/다른 hash 충돌은 별도 격리 사건이며 원행 덮기0. FN08 |
| `execution_acknowledgements` | `(project_id,execution_id,generation) PK,contiguous_sequence,missing_ranges_json,conflict_refs,updated_at`. 동일 실행/generation 관측의 연속 영속 지점만 전진. 뒤 순번으로 공백 숨기기 금지. FN08 |
| `writer_claims` | `id PK,project_id,execution_id,generation,source_root_id,canonical_scope_ref,policy_ref,issued_at,expires_at,reclaimed_at?,ownership_facts_ref`. 행 lock/범위 충돌 검사와 실제 OS/경로 검사 결합, 겹치는 root/하위/링크 scope 차단. 문자 UNIQUE만으로 범위 겹침을 증명하지 않음. FN08/13 |

로컬 spool은 서버 DB의 복제 프로젝트가 아니다. 실행기 보호 저장 root 아래 executionId/generation별 append 기록·hash/sequence/ACK checkpoint와 큰 원문 blob 참조를 보관한다. 정확 serialization·파일 flush/교체/잠금·Windows 소유권/암호화·유한 디스크/보존 정책과 실제 검수는 P02/P03 후속 고정이다. 구세대 관측도 원출처로 보존할 수 있지만 구세대 writer 권한을 부활시키지 않는다. 서버/로컬 ACK 차이는 복구 대조 입력이다.

정확 외부 handle·계정 보호 참조/명령 인자·host 절대경로 등 민감 메타데이터는 역할별 조회 필드를 제한한다. UI는 필요한 표시명/상대 경로·오류·마지막 관측/회수 상태만 보여준다. credential revoke로 전송 못 한 spool을 삭제하지 않고 사용자 허가된 새 연결/회수 경로로 검증해 수집한다. 실제 OS helper/host 증명/credential 보호가 없으면 변경 역할 준비 불가이며 fixture로 그 경계를 PASS 처리하지 않는다.

## 10. 임무/진행·결과·교체·복구/알림의 저장 명세

INTERFACES §13~14와 FILE_MAP의 FN09~18 소유 migration을 연결한다. 공통 project composite FK·원문/버전 불변·서버 주체 검사·단일 writer·별도 상태 축을 그대로 상속한다. 아래 JSON payload도 해당 고정 schema와 실제 참조를 검증하고 무제한 임의 객체 저장소로 사용하지 않는다. FK가 가능한 관계는 명시 FK, 다형 ref는 종류별 resolver/동일 프로젝트·정확 버전/hash 검사를 사용한다.

| 업무·저장 단위 | 필수 키/내용·원자/보존 조건 |
|---|---|
| FN09 `project_roles` | `(project_id,id) UNIQUE,id PK,kind:COORDINATOR/STAGE_OWNER/SUBTASK,stage_ref?,parent_role_ref?,created_at`. 역할 지속 ID와 외부 세션 분리 |
| FN09 `assignments`/`assignment_versions` | assignment `(project_id,id)` 고유/현재 head, version `(project_id,assignment_id,version)` PK·TaskCard/불변 definition/hash·부모·기준/양식·산출/검수·허용 범위/한도·통합 책임·확정 이력. 완료/진행은 별도 실행/검수 근거 |
| FN09 `role_bindings` | `id PK,project_id,role_id,generation,assignment_ref,connection_ref,session_ref?,context_ref?,review_ref?,issued_at,revoked_at?`. 역할당 활성 binding1개, exact 세대/현재 권한/회수·이해 검토 후 전환. 역할별 이력 유지 |
| FN10 `stage_runs`/`queue_requests` | run은 project/적용graph/기준·시작/끝 경계·모드·현재 위치·허가 scope, queue는 run/node/assignment·단조 순번·대기 이유/예약/전달/불명·version. 같은 시작 command는 하나의 요청, 합류/재작업 typed 결과 근거 |
| FN10 `limit_policy_versions`/`usage_reservations` | 정책 ID/version·유한 한도/범위/기한/hash, 예약은 project/run/command/실행·정확 단위/통화·관측/추정·누적/해제 사건. 예약/누적과 명령 발행 원자 검사, 새 세션으로 누적 초기화0 |
| FN12 `result_submissions` | `(project_id,id) UNIQUE,id PK,assignment_ref,execution_ref,manifest_ref,manifest_hash,submission_state,submitted_by,submitted_at`. 주장/직접 관측/시험 산출/검수자 출처 구별, 제출만으로 완료 상태 갱신0 |
| FN12 `result_reviews`/`verification_items` | review는 결과/기준 version·검수자/독립성·조건별 결과/미검증/이유·시각, item은 test/criterion·정확 환경/원문 evidence/hash·기대/실제·판정. 단위/실제 DB/Agent/브라우저 범위 구별, 과거 FAIL/미실행 덮기0 |
| FN12 `execution_issues`/`failure_attempts` | issue 원인 분류/확인 사실·미확인·영향/정확 선택, attempt는 assignment/실패 fingerprint/lineage·정식 제출/검토 근거·순번. quota/권한/환경/단순 중단을 기능 실패 횟수에 혼합하지 않음 |
| FN13 `checkpoints` | `(project_id,id) UNIQUE,id PK,assignment_ref,execution_refs,baseline_refs,state_ref,state_hash,record_file_ref,local/server_sequence,created_at`. 책임자 파일/서버 snapshot·실제 상태 차이 보존 |
| FN13 `stop_requests`/`reconciliations` | stop은 명시 scope/하위·차단 시점·요청/공식 응답/실제 ownership facts·상태, reconcile은 checkpoint/현재 snapshot·source/process/receipt diff·공백·재개 준비/차단 근거·version. 요청≠회수, 자동 replay0 |
| FN13 `source_preservations`/`source_restores` | preservation 계획/version·exact root/manifest·소유/회수·보호/수명·승인·실제 hash/재구성 근거, restore 전후 snapshot/expectedhash/승인 scope·검사/공백·결과. 복원/보존본 삭제 분리, 원본 실패 보존 |
| FN14 `transfers` | `(project_id,id) UNIQUE,id PK,version,role_ref,old_binding_ref,target_ref,manifest_ref,manifest_hash,reclaim_refs,gaps,understanding_review_ref?,decision_ref?,new_binding_ref?,state,created_at`. 총괄/단계 확인 주체·지원/실제 상태·수용 손실 명시, 이전 원문·결정/미완료 유지 |
| FN15 `control_handoffs` | `(project_id,id) UNIQUE,id PK,version,current_actor/client_ref,target_actor/client_ref,reason,summary_ref,summary_version,accepted_at?,state`. project_control은 기존 FN01 행만 전환, old revoke/new generation/accept 이력 원자 저장. 중복 인수1건 |
| FN16 `backup_policy_versions`/`backup_jobs` | 정책은 보호된 대상/키 참조·포함/유한 용량/주기/보존/검사/hash, job은 exact policy/source 선택·일관 기준·manifest/hash·생성/실패·누락/정리·scope 승인. 실행 권한/인증 비밀을 원본 bundle에 포함하지 않음 |
| FN16 `restore_validations`/`restore_applications` | validation은 별도 위치·manifest/자료/관계/키/호환 검사·차이/무결성·실행0, application은 영향 version·exact 승인/현재 hash·보존/rollback·인증 복구 세대·전후/결과. 검증과 원본 적용 분리 |
| FN17 `notifications`/`push_subscriptions` | notification은 사건/수신자/channel UNIQUE·비밀 없는 표시/인증된 대상·전달/읽음/실패, subscription은 사용자/client별 지원/허가·보호 참조·회수. 일반 진도 push0, 클릭≠승인 |
| FN18 로컬 client 설정/제품 산출물 | 같은 서버 reference/정확 origin·client ID/버전·보호 저장 ref·기본 창/종료 설정만 보존. 프로젝트 원본 DB/비밀 평문 복제0. 산출물 manifest는 package version/hash/신뢰 기준/호환·검수/rollback 참조로 저장, build≠실제 설치 합격 |

의존이 아직 없는 행을 placeholder 완료 증거로 만들지 않는다. 활성 binding/단독 control·예약/명령·승인 소비는 current state와 같은 transaction/제약 경계에 놓고, 실제 process/파일·분산 실행의 exactly-once를 DB만으로 보장하지 않는다. 재기동 후 실제 대조/회수/사용자 지시 전 자동 writer 재개0이다.

백업의 공개 원본 manifest와 인증/실행 신뢰 복구를 구별한다. secrets/세션/connector credential·활성 권한을 가져오지 않아도 Anvil 원문 조회가 가능해야 한다. 새 서버로 이관하는 경우 사용자 확인/인증 재설정과 소유권 복구 계획을 먼저 검증하고 타 계정의 프로젝트를 임의 인수하지 않는다. 오래된 audit/approval/role 세대는 이력이고 현재 허가가 아니다.

## 11. 생성 전 작성·검토 참조의 저장 보완

project_drafts.input_json의 방법론 선택은 confirmed reference 또는 새 프로젝트 전용 graph/version/hash다. `draft_methodology_reviews`는 `(draft_id,version,graph_hash,review_id)` 키·확정 사건/작성자/client·시각을 갖고 FN02/03의 검증을 소비한다. 실제 프로젝트 생성은 초안/자료 소유·graph/검토·선택을 잠금/재대조하고 전용 원본/version·고정 적용본·프로젝트/초기 제어·receipt와 함께 저장한다. project_id 없는 초안 자료를 가짜 프로젝트에 넣지 않는다.

`content_reviews`는 FN11 0011의 공통 주체/감사 기반에 둔다. 필수 열은 `id PK,scope_kind:PROJECT/DRAFT,scope_id,target_kind,target_id,target_version,target_hash,criteria_version,items_json,outcome,reviewer_subject_ref,source_kind,reason,created_at`다. scope는 NOT NULL·존재/소유·대상별 exact version/hash를 검사한다. 다른 도메인 검토를 같은 ID로 바꿔 쓰지 않으며 domain service가 확정 시 그 기준/종류·현재 내용과 대조한다. 수행자의 result_reviews와 서로 대체하지 않는다.

2026-10-16 본인 공통 자료 보완 직접 승인에 따라 `0011_user_common_control`은 commands/authorization_receipts의 USER_COMMON을 추가한다. scope_id=actor_id이며 project/draft/control/policy/approval consumption은 null이다. 사용자+command_id 유일성은 연산 간에도 적용한다. `user_common_audit_events`는 owner·현재 client·같은 scope command FK·소유자별 순서·정확 targetRef를 갖는 append-only 이력이다. 현재 METHOD 정의/버전 쓰기는 transaction-local 인증 actor와 owner를 SQL trigger로 대조하며 SYSTEM/PROJECT는 거절한다. 이전 버전 UPDATE/DELETE와 본인 외 owner 변경 권한은 열지 않는다. 양식 쓰기/content_reviews/확정 집행은 후속 migration·도메인 구현 전 미구현이다. 기존 적용0001/0011/0002/0003 SQL은 수정하지 않는다.

후속 `0011_user_common_forms`는 같은 승인으로 USER_COMMON 양식의 INSERT·현재 head/name/code 개정만 허용하고 인증 actor/owner를 trigger에서 대조한다. SYSTEM·PROJECT·표준 원문·과거 version UPDATE/DELETE는 계속 금지한다. 양식 origin_ref_json에 COPY/REVISION 부모 exact ref와 변경 이유를 보존한다. 검토/확정 사건은 이 migration이 생성하지 않는다.

후속 `0011_user_common_content_reviews`의 content_reviews는 계획된 scope/대상/기준/항목/결과에 실제 reviewer_user_id/client_id·기준 snapshot·source_kind·정확 scope command FK를 더한다. DB app의 INSERT guard는 현재 USER_COMMON/FORM/본인/HUMAN_REVIEW만 허용하며 PROJECT/DRAFT/다른 도메인은 후속 집행 전 사용할 수 없다. form_reviews는 정의/버전/hash triple FK·실제 확정자/client·confirmForm command FK·구조검사/ReviewRef 이력이다. 두 테이블 UPDATE/DELETE는 app에 금지하고 기존 SQL/기존 버전·사람 확정 사건을 변경하지 않는다.

승인 기본8종 catalog/저장 schema는 FN03 0003이 소유하고 방법론 저장 검증이 그 정확 버전을 소비한다. 실제 migration DAG는 0001/0011 공통 기반→0003 catalog/document storage→0002 방법론→0004 추적/계획, 0005 지식은 필요한 0003/0011 뒤라는 방향으로 P03에서 SQL 참조/seed와 함께 고정한다. 임무/실행·미검증 source 참조는 실제 자료가 생기기 전 성공 관계로 꾸미지 않는다. 이는 모듈을 번호순으로 개발하라는 뜻이 아니며 FN02/FN03의 기본/연결 검수는 각각 유지한다.

### 11.1 독립 검토 보완 — 최초 소스와 문서 링크 이력

- `source_declarations`(0001·FN01): `id PK,draft_id?,project_id?,version,declared_by,host_label,display_name,path_hint_protected_ref,origin_root_ref?,reason,authority:USER_DECLARED,created_at`. draft/project 소유 정확히 하나와 각 복합 UNIQUE·FK. 초안 생성/수정과 원자 저장·project 생성 때 정확 선언 version을 귀속, 관측 authority 자동 승격0. FN06/08이 별도 source_roots/source_snapshots를 실제 검증해 연결하며 선언 ID를 실제 root ID로 혼용하지 않는다. 입력 pathHint의 저장·조회는 소유 범위와 비밀 마스킹을 지키며 파일 접근 명령으로 실행하지 않는다.

FN01 직접 승인 후속 forward38의 실제 저장 구분: 초기0001 source_declarations identity는 최초 선언 ID/작성자/최초 metadata와 path_hint_protected_ref=`db-source-declaration-version:<id>:<version>`를 보존한다. 새 source_declaration_versions(id/version PK·정확 draft/version·declaration_json/hash·주체/client/command)는 보호 DB의 불변 payload를 보존하고 project_source_declarations는 생성 transaction의 정확 선언 버전만 귀속한다. app UPDATE/DELETE는 불허하며 이전37 SQL과 기존 행을 삭제/변환하지 않는다. 실제 root/관측/검증 권한은 만들지 않는다. 이는 FN05 지식 payload와 다른 FN01 저장이며 실제 적용/증거는 WORK_STATUS를 따른다.
- `document_source_links`(0003·FN03)에 `link_version,state:ACTIVE/DETACHED,current_event_id?`를 추가한다. 문서 확정본과 소스 연결의 변경 세대는 분리한다. `document_source_link_events`는 `id PK,project_id,link_id,link_version,kind:LINKED/OBSERVED/KEEP_SERVER/PROPOSAL_CREATED/DETACHED,snapshot_ref?,observed_blob_hash?,comparison:MATCH/DRIFT/UNVERIFIED,proposal_ref?,reason,actor_ref,created_at`를 append한다. event FK는 불변 `(project_id,link_id)`만 참조하고 link_version은 당시 세대값으로 불변 기록한다. 현재 링크 version의 CAS와 event append를 원자 처리하며 이후 세대 증가가 과거 event FK를 바꾸지 않는다. 당시 snapshot/원문/제안 참조 유지·타 프로젝트 참조 거절. 아직 FN08 관측이 없으면 UNVERIFIED이며 임의 MATCH/원문 import 성공을 만들지 않는다.
- COLLECT_PROPOSAL의 원본/추출/제안은 기존 artifacts/document_imports/document_proposals를 소비한다. 파일 성공/DB 실패는 staging 복구 대상으로 남기고 링크를 성공으로 바꾸지 않는다. FN08이 생기기 전 FN03은 저장·버전/본문 검수를 진행하되 실제 소스 드리프트 확인은 미검증으로 기록한다.

2026-10-16 방법론 검토 연결: 새 forward `0011_user_common_method_reviews`는 methodology_reviews에 nullable client_id/command_id를 추가해 기존 자료를 보존하고, 새로운 app INSERT는 owner USER_COMMON·현재 actor/client·같은 APPLIED command/operation·expected version·receipt exact ref를 trigger로 검사한다. content_reviews의 같은 보호는 FORM/METHODOLOGY만 허용한다. review/confirmation은 append-only이며 기존 적용9개 SQL 불변, 실제 프로젝트 권한·정책/승인 소비는 만들지 않는다.

2026-10-16 생성 초안 보완 직접 승인 후 `0011_project_creation`은 첫 생성의 project_methodologies INSERT만 현재 인증 actor/owner/client·미소비 draft/OWNER/control1·APPLIED createProject/receipt와 묶는다. 기존 snapshot UPDATE/DELETE 금지다. `0011_draft_method_reviews`의 append-only 확정 행은 `id PK,draft_id,version,graph_hash,graph_json,review_refs,validation_json,decided_by,client_id,command_id UNIQUE,decided_at`이며 `(draft_id,version,graph_hash,id)` UNIQUE다. content_reviews의 USER_COMMON guard는 유지하고 DRAFT_METHODOLOGY 전용 guard를 나눠 current draft/client·exact ref/command/receipt를 검사한다. 초안 검토 target_id는 실제 draft_id이고 아직 없는 project_id를 만들지 않는다. 첫 PROJECT 정의/버전1 INSERT만 같은 최초 생성의 context로 허용하며 후속 개정·실행 권한은 열지 않는다. 생성 실패는 초안 소비·프로젝트/멤버/제어/전용 원본·snapshot/명령/receipt/audit 모두 rollback한다. 기존10개 SQL과 공통/공식 원본·기존 버전은 보존한다.
