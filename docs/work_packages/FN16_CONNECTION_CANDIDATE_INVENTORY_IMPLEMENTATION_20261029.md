# FN16 연결·환경 후보 이력 내부 수집 WI — 2026-10-29

상태: 읽기 사전검수 전, 제품 GO 아님. 기준 codex/av3-stage-b 7b2498e53280a8f69a3b907b9696406b61b5f151. 기존 FN16 내부 metadata 수집·합성 범위의 한정 단위다. 실제 host 신뢰등록/소스root·경로/전역설정/키·Secret/설치자원 권한은 미수집이다. 후보를 실제 자원으로 승격하지 않는다.

## 허용3코드
신규 apps/server/modules/backups/connection-candidate-inventory.ts, tests/unit/FN16/connection-candidate-inventory.test.ts, tests/unit/FN16/connection-candidate-inventory-schema.test.ts만 허용한다. 기존 producer/조회/API/input/parser·SQL/의존성·22조합/helper/보호8/Git개발자쓰기0. Main 관리·검수·통합, 기존 Primary 단독 writer, Reviewer 읽기.

## 저장 계약과 인증
기존 ProjectConnectionCandidates.read/list는 projectMember 기반 프로젝트 후보 조회다. 실제 신뢰등록의 현재 actor/client/control/policy 보호조회와 혼동하지 않는다. 새 내부 collector의 시작/최종 기존 authenticated RC는 같은 actor/client/authSession/credentialGeneration·활성 OWNER·기한을 확인한다. 자료는 단일 READ ONLY Repeatable Read, 실제 isolation/read_only/snapshot을 검사한다. 모든 SQL은 projectId 결박·명시 열·keyset200·유한 누적 metadata/기한/취소를 유지한다. 실제 DB/키/서비스·원문FS·Agent 연결/실행은0이다.

## 고정63열과 검증
- connection_candidates 6열: id,project_id,kind,head_version,created_by,created_at.
- connection_candidate_versions 11열: project_id,candidate_id,version,kind,snapshot_json,content_hash,created_by,client_id,command_id,expires_at,created_at.
- 선택 commands21: id,scope_kind,scope_id,project_id,draft_id,actor_id,client_id,operation,command_id,request_hash,operation_id,state,authorization_receipt_id,approval_consumption_id,expected_version,control_generation,policy_ref,payload_ref,result_ref,received_at,completed_at.
- 선택 authorization_receipts9: id,scope_kind,scope_id,command_id,subject_ref,policy_ref,scope_digest,approval_decision_ref,authorized_at.
- 선택 audit_events16: project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,recorded_at,source_kind,correction_of.

앞2표는 프로젝트 모든 후보/과거 버전을 (id)/(candidate_id,version) 순서로 수집한다. head/버전1..head/종류/최초creator와1버전creator·이전 정확 candidateRef를 대조하며 과거 변경 actor/client를 현재 호출자와 동일하게 강제하지 않는다. 현재 만료된 후보도 보존하고 현재 정책으로 역사 재허가하지 않는다.

snapshot 정확4필드 {kind,input,readiness,capabilities}의 canonical H가 row content_hash와 일치해야 한다. 기존 readCandidateInput(operation,input,{now:row.created_at,policyExpiresAt:row.expires_at}) 및 candidateReadiness/candidateCapabilities로 원 snapshot을 대조한다. 현재 now를 사용해 과거 만료를 삭제하지 않는다. parser의 입력expiry≤DBexpiry만으로 끝내지 않고 stamp(row.expires_at)===input.expiresAt를 별도 정확 비교한다. 1마이크로초 차이도503이다. input.policyRef와 command.policy_ref도 canonical 정확 일치를 요구한다. 입력의 connectorRef/environmentRef/executionHostRef 및 비어있지 않은 sourceRootRefs/targetHostRefs/commandProfileRefs/secretRefs는 기존 rejectUnconnectedReferences와 동일하게 거절한다. 실제등록/실측을 후보로 위장0.

선택 증빙은 원 command의 PROJECT scope/project/draft_id null/명령·actor/client/control/expectedVersion=version-1·APPLIED·policyRef·result 정확 외피를 검사한다. operation은 kind별 registerConnection/saveEnvironment, result data={ref,status:CANDIDATE_STORED,candidate,previousRef:input.candidateRef}. 원 request_json은 저장되지 않았으므로 원 request 재구성 검증은 NOT_PERFORMED. 일반 명령 scopeDigest는 {projectId,actorId,clientId,controlGeneration,requestHash,policyRef,targetRef} 해시이며 receipt/audit/command를 정확 결박한다. reasonCode EXPLICIT_UNVERIFIED_CONNECTION_CANDIDATE·HUMAN_COMMAND·APPLIED·correction null을 대조한다. 승인 없는 경우만 command.approval_consumption_id/payload_ref·receipt.approval_decision_ref·audit.approval_ref가 모두 null이다. 승인 있는 정상 후보도 보존하며 consumption UUID·정확 payload_ref {kind:ONE_TIME_APPROVAL_SCOPE,payloadHash,scopeDigest}·audit approval_ref {requestId,decisionId,scopeDigest}·receipt decisionId 일치와 구조를 검사한다. 승인 scopeDigest는 일반 명령 scopeDigest와 별개다. payloadHash는 정확 snapshot.input이 원 request.payload의 structuredClone이므로 hash(input)와 반드시 재계산 일치해야 한다. approval scopeDigest는 유효64hash와 기존 감사/영수증 결박을 확인하되 전체 request_hash 재구성/소비원장 자체 검산은 NOT_PERFORMED로 유지한다. 결정/소비/request ID-only는 외부 미검증 참조이며 가짜 VersionRef를 만들지 않는다. null/nonnull 혼합·decision/digest 불일치는503이다. 원형 result.serverReceivedAt/input.expiresAt 등은 strict ISO 유지, DB 열의 날짜는 검수된 ledger parser와 같은 PG offset/6소수 정규화·마이크로초 보존을 사용한다. 독립 사건의 단조 시각을 새로 강제하지 않는다.

## 내부 결과와 비노출
kind CONNECTION_CANDIDATE_INVENTORY_V1, scope PROJECT_UNVERIFIED_CONNECTION_ENVIRONMENT_CANDIDATE_HISTORY_ONLY. projectId와 candidates,versions,evidence,issues,externalDependencies 배열을 포함하고 원 projection {kind,projectId,candidates,versions,evidence,issues,externalDependencies}의 inventoryHash를 발급한다. candidates는 id/kind/headVersion/createdBy 익명/createdAt, versions는 원 ref/previousRef/policyRef/kind/createdAt/expiresAt/producerSubjectVerification 및 snapshotSummary만 반환한다.

snapshotSummary는 입력 원형을 반환하지 않는다. 원 input 전체 canonical hash와 후보 각 필드의 이름·canonical hash, documentation의 건수/고정code/versionCompatibility/observedAt만 허용하며 label/reason/toolProduct/toolVersion/adapterKind/docs.source 등 자유문자열·URL·OS경로·사람UUID/client는 해시·익명화한다. readiness는 원 고정구조, capabilities는 고정 code/controlLevel/limitations 및 measurement state만 보존하고 자유문자열은 제외한다. 자유metadata 원문은 반환 전이 아닌 입력 검증시 기존 sensitive 검사로 고정503 거절한다. 원ref.contentHash와 투영projectionHash를 분리하며 원형 전체 복원이라고 하지 않는다. 선택증빙도 rawactor/client/result/input0, 필요한 고정 ref/식별/상태·scopeDigest만 투영한다.

정책ref는 외부 POLICY_VERSION/verification NOT_PERFORMED로 남긴다. 현재 정책/재인증·신뢰/능력실측·실등록·소스root/설정/원형복원은 NOT_PERFORMED/NOT_COLLECTED, sourceSnapshot NOT_EXPORTED, fullProjectCoverage/restorable/authorizationRestoration/executionAuthorized/dispatchPerformed/atomicSnapshotVerified false. actual connection 등록/Resource ref로 후보 원ref를 해석0. 이 단위만으로 CONNECTION_REGISTRATION_SOURCE_ROOT_SETTINGS 전체 미수집 항목을 삭제하지 않는다.

## TDD와 한계
신규 source 부재 RED→GREEN 뒤 최소 정상 두kind·다중버전/creator변경/만료·원hash/이전ref/head/row·producer/cmd/receipt/audit 결박·독립재봉인·일회승인 null/nonnull 정상과 payloadHash만 다른 유효64hash로 변경한 독립 음성·반쪽null/decision·scopeDigest 불일치·비노출/비밀·201행keyset/메타413/마지막 현재성·신원/기한/취소/회수불명503·잘못된입력·빈실조회·DB부재실패를 확인한다. PG DB형식과 원 프로토콜 경계를 구분한다. DB expiry만 늦추기/1micro 차이와 input.policyRef·command.policy_ref 독립 정합 재봉인 불일치도503 반례로 확인한다. 기존 producer의 clock_timestamp와 created_at 기본 transaction now 차이 때문에 documentation.observedAt 경계가 기존 read에서 거절될 수 있는 한계는 그대로 기록하고 이번 단위에서 기존 조회를 고치거나 우회하지 않는다. 두 신규 시험파일만 실행하고 type/diff/독립C/I0, Main fresh 같은 범위 후 신규3+WI/결과/WORK_STATUS/WORK_PLAN 정확7경로 checkpoint한다. 기존 완료 수집기 전수·브라우저/부하 반복0.

실제 PG/RLS·원문파일/키/서비스/Agent·전체 archive/복원/UI NOT_RUN. 원형이 아닌 metadata 수집임을 명시한다. rollback은 신규3의 검토된 revert·연결 비활성이며 자료/권한/키 삭제0이다. 전체 WORK_PLAN 미완료.
