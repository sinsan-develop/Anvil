# FN01 기능 상태 시작 기준선 후보 구현 계획

> Main은 `superpowers:executing-plans`로 기존 branch의 단일 writer 실행을 이어간다. 새 세션/branch/자동화를 만들지 않는다. 업무 카드와 WORK_STATUS를 실행 ledger로 사용한다.

**목표:** 기능 4상태·근거/미확인을 사용자 검토·별도 채택과 불변 이력으로 연결하는 후보를 구현한다. 실행 source 기준이나 Agent 실행 허가를 만들지 않는다.

**구조:** 기존 프로젝트 명령의 현재 OWNER/client/제어·정책·기한/CAS/replay·감사, 보호 원문 읽기를 재사용한다. 초안→내용 검토→별도 채택을 분리하며 기존 project_baselines와 실제 source_snapshots를 재생성하지 않는다.

**기술:** 현재 TypeScript/React/Fastify/PG15·파일 보관소, 새 의존성 없음.

**승인 기준:** FN01_BASELINE_GAP_AND_PROPOSAL.md SHA256 `C7C5B6D39C4889A156246B94C0073C1EBDFFE2680B7B9849B94B5F58D33E44E0`. PMO가 전달한 신산님 직접 ‘승인해’ 수신 UTC2026-10-18T07:21:31Z의 A안 후보 작성·검수다. 무응답 추정/다음 업무 배정이 아니다.

## 공통 경계·검수 초점

- 실제 DB 적용/격리 QA·서비스·실사용자 정책/권한·실소스/host/native/Agent·Secret/cert/비용0. 원 QA 경로 심사·복구 PATH_GUARD·정식0012·소진 compile 경계를 해제하지 않는다.
- 4상태의 공식 표시: IMPLEMENTED_CORE_CHECKED=구현 완료·핵심 동작 확인, IMPLEMENTED_UNCHECKED=구현했지만 동작 미확인, PARTIAL=부분 구현, NOT_IMPLEMENTED=미구현. 작업 진행/검수 상태와 구분한다.
- 파일 존재·본문/목업·정적/단위 녹색을 실제 기능 합격으로 만들지 않는다. 실제 처리·저장/조회·중요 실패 근거와 내용 검토 없이는 CORE_CHECKED를 채택하지 않는다. 분류/근거의 의미 판정은 책임 있는 사용자 검토이며 기계 구조검사와 다르다.
- source 보고는 과거 CONNECTOR_REPORTED/OS UNVERIFIED·READ_ATTRIBUTES 그대로다. baseline 채택/내용 확정과 source 접근·SourceScope·실행 준비를 구분한다. 실행/dispatch/sourceAuthorization/coverage 검증은 자동 true가 되지 않는다.
- 기존 표/행/SQL/원문을 보존한다. 기존 baseline row가 없다고 추정하지 않고 옛 결박 없는 행은 LEGACY_UNVERIFIED로 분리/거절하며 자동 backfill/채택하지 않는다.
- 검수 초점: 다른 프로젝트/옛 사용자·client/제어, source 종류/nullable 혼동, 원문 격리/미접근, 실제 근거 없는 동작 합격, duplicate/CAS/늦은 callback·응답 유실. 각 소유 단위에서 정상·해당 음성을 검사한다.

## Task 1. 초안 입력·4상태·source 종류 경계

파일: 신규 `apps/server/modules/projects/baseline-input.ts`, `tests/unit/FN01/baseline-input.test.ts`.

인터페이스: `readBaselineDraftInput(value) -> {input:BaselineDraftInput,issues,contentConfirmed:false,sourceAuthorizationVerified:false,coverageVerified:false,executionAuthorized:false,dispatchPerformed:false}`. HTTP/DB/실제 원문 검사는 하지 않는 순수 입력 계층이다.

정확 입력은 `{baseRef,source,items,coverageReason,reason}`. baseRef는 null 또는 기존 VersionRef다. coverageReason/reason은 각각 비공백 1..20000 UTF16. 전체 canonical JSON UTF8≤2MiB, getter/순환·잘못된 JSON형/추가 키·알려진 민감표식은 거절한다. 원입력은 변경하지 않는다.

source는 `{kind,declarationRef,sourceRootRef,snapshotRef,grantRef,unverifiedReason}`이며 모든 키를 명시한다. 이유는 비공백 1..20000 UTF16. NONE_SELECTED는 ref4개 모두 null이며 실제 빈 소스/없는 root라고 단정하지 않는다. DECLARATION_ONLY는 declarationRef만 VersionRef/나머지 null. ATTRIBUTE_REPORT는 root/snapshot/grant 정확 VersionRef(snapshot/grant version1), declarationRef는 null/VersionRef다. 실제 project/원문·현재 권한/보고 결박은 Task2가 확인한다. 기존 Id 문자열/불완전 ref를 exact ref로 추측하지 않는다.

items는1..200, 정확 `{itemId,title,designRef,featureState,evidenceRefs,limitations,reason}`. itemId는 비공백·제어문자 없는 문자열≤200(한글/UUID 포함), 중복 금지. title≤200·나머지 이유/한계≤20000·모두 비공백. designRef는 null/VersionRef. evidenceRefs는 정확 `{artifactId,bytes,contentHash,mediaType}`: 기존 UUID/hash, bytes0..20MiB 정수, mediaType 비공백/제어문자 없는≤200; 항목별/전체≤200·같은 항목 중복 금지. CORE_CHECKED 제안은 evidence≥1을 요구하지만 존재/의미·현재 접근 확인은 아직 아니며 analysis는 항상 미확정이다.

- [ ] 위 원입력/네 상태·nullable3종/순서·한글 ID 보존, CORE근거 없음/추가 verified flag·ref누락/Id-only/다른kind·중복/상한·민감값/getter를 RED로 확인한다.
- [ ] `baseline-input.ts`를 구현해 직접 GREEN, 기존 source 선언/assignment 입력 인접 검사와 type/diff 후 checkpoint한다. 이 단계의 정상 파싱은 기능 구현/실사용·내용 검토/DB 저장 PASS가 아니다.

## Task 2. 실제 source·증거 결박과 검토/채택 입력

파일: 신규 `baseline-sources.ts`, `baseline-decision-input.ts`와 각 FN01 단위 시험. 소비: Task1 타입, 기존 `SourceReadRecords.snapshot`, `readSourceDeclarationRecord`, ArtifactStore·`assertStoredArtifactReadable`, projectMember.

`ProjectBaselineSources.resolve(db,actor,projectId,input)`는 같은 프로젝트 source 선언 귀속·원본hash를 보호 reader로 대조하고 ATTRIBUTE_REPORT의 정확 snapshot/grant/root와 보고 등급/시각을 보존한다. NONE_SELECTED로 알려진 원 선언을 숨기지 않는다. 현재 소스 검증/본문 hash나 Git을 만들어내지 않는다. item evidence는 같은 프로젝트의 실제 artifact metadata/hash·격리/현재 읽기 권한과 실제 바이트를 확인한다. 내용은 명령으로 실행하지 않는다.

`readBaselineContentReview`는 정확 draftRef·criteriaVersion1·모든 itemId별 요청 featureState/판정·이유·evidence refs를 고정한다. CORE_CHECKED 항목은 실제 정상처리/저장조회/중요실패의 각각 근거·환경/시각과 HUMAN 내용 검토가 필요하다. mock/static/미실행·불명 근거는 합격시키지 않는다. `readBaselineConfirmation`은 draftRef/reviewRefs/reason/acknowledged=true를 분리한다. SourceScope나 Agent 준비는 항상 미확인/false다.

- [ ] 다른 프로젝트/변조·격리/접근거절·보고/root불일치, 알려진 선언 누락·raw본과 metadata 혼동, CORE 실제근거/내용검토 누락·다른항목/이전검토를 RED→GREEN으로 검사한다.
- [ ] 직접/인접/type/diff·독립 한정 검토를 구분해 기록한다. 현재 fixture/double을 실제 PG/파일 권한 실측으로 부르지 않는다.

## Task 3. 보호 저장/조회·forward SQL 후보

파일: 신규 `project-baselines.ts`, `db/migrations/0015_project_baselines.sql`; 기존 project routes/access 명령 목록·DATA_MODEL/INTERFACES, 각 store/routes/SQL 후보 시험.

새 명령은 `saveBaselineDraft`/`reviewBaselineContent`/계획된 `confirmBaseline`. 기존 command transaction 안에서 현재 OWNER/명시 AUTO 정책·제어세대/기한·CAS/replay·감사를 소비한다. REQUIRE_APPROVAL/approvalRef는 미연결 거절이며 uploadArtifact 전용 일회 승인 소비를 확장하지 않는다. 초안과 검토는 불변 버전, 확정은 최신 적합 내용 검토를 다시 대조한 별도 사용자 채택이다. 기존 project_baselines의 id PK/project-version UNIQUE에 맞춰 기록별 새 ID·프로젝트 채택 순번을 쓰고 같은 id에 버전을 추가한다고 가정하지 않는다. legacy 결박 없는 row는 자동 head로 사용하지 않는다.

exact GET/유한 목록으로 초안·검토·채택과 source/증거의 현재 접근·변경/불가를 구별한다. 채택 이력은 source 없음/기능 미확인·과거 등급을 보존한다. SQL은 기존 표·행/적용SQL을 보존하는 추가 guard/참조·명령/receipt/audit 결박이며 source_snapshot nullable는 새 source-kind 계약과 함께 보호한다. 실제 적용/동시성/COMMIT 증거는0이다.

- [ ] same-command replay·다른target/버전/정책/주체·변조/옛검토, FK/guard·직접 DML·null/문자열·immutable/history·동시 head 경계의 가능한 시험을 RED→GREEN으로 구현한다.
- [ ] 단위/transport/type·정적 SQL 검수와 actual PG 미검증을 분리한다. 승인 경계 해소·사전 자원등록 전 actual QA0이다.

## Task 4. UI02 기준선 작성·원문·검토/별도 채택

파일: 신규 `apps/web/src/features/project-create/baseline-api.ts`, `ProjectBaselinePanel.tsx`, 기존 생성 완료/프로젝트 화면과 해당 App 보존 버퍼·UI02/FN01 시험. 기존 source 조회의 보호 helper를 재사용한다.

프로젝트 생성은 그대로 유지하고 기준선은 별도 미확정 상태에서 시작한다. 정확 source 선언/보고 원문 선택·기능4상태/근거/한계→초안 저장→항목별 내용 검토→사용자 별도 채택→고정 이력/현재 재조회로 연결한다. client가 권한/ref를 생성하지 않는다. source 관측이 없으면 이유를 보존하고 없는 보고/실행 준비를 만들지 않는다. 같은 명령/입력과 project/user/client binding을 보존하며 변경/401·다른 선택 뒤 옛 결과가 살아나지 않게 한다.

- [ ] source 유형/필수근거·분류와판정 구분·동일명령 재확인·다른주체/늦은콜백·원문거절/변조를 TDD로 검사한다.
- [ ] build/type·직접/인접 회귀·독립 scoped 검토. 실제 UI/API/PG 미실행은 그대로 남기며 후보 완료를 사용자 사용 가능/전체 FN01/Stage 완료로 승격하지 않는다.

기존 승인 계획의 일반 후보 작성은 Main이 주도한다. PMO에는 새 범위/권한/실행이 필요한 정확 결정만 요청한다. 이미 확인한 불변 코드·환경의 전수 검사를 반복하지 않는다.

### Task2 상세 wire 고정·기존 소비 이름 대조

- Pre-flight Ruling: 실제 SourceReadRecords의 메서드는 `readSnapshot`이다. 위 `snapshot`은 개괄 표기이며 새 메서드/우회를 만들지 않고 기존 `readSnapshot(db,actor,projectId,id)`를 소비한다. 비용은 소비 이름 교정뿐이고 원 보호 reader/계약은 불변이다.
- 검토 입력의 정확 top key는 `{draftRef,criteriaVersion,reviewerKind,items,coverage,outcome,reason}`, criteriaVersion=1/reviewerKind=HUMAN이다. outcome은 ACCEPTED/REWORK/BLOCKED/NOT_EXECUTED. HUMAN은 현재 로그인 사용자가 직접 내용 검토를 기록한다는 선언이며 Agent·기계가 실제 의미 합격을 증명한 표식이 아니다.
- 검토 items1..200의 정확 key는 `{itemId,featureState,outcome,reason,evidenceRefs,coreEvidence}`. Task1 ID/상태·ArtifactRef 규칙을 유지하고 ID/같은항목 artifact 중복을 거절한다. coverage는 정확 `{outcome,reason}`. 전체 ACCEPTED는 모든 항목/coverage ACCEPTED일 때만 가능하다. Task3는 draft의 전체 itemId/featureState와 정확 일치 및 현재 원문 접근을 다시 확인한다.
- coreEvidence는 null 또는 정확 `{basis,environment,checkedAt,normalFlow,storageRead,importantFailure}`다. basis ACTUAL/MOCK/STATIC/NOT_EXECUTED/UNKNOWN을 보존하고 environment1..20000·checkedAt은 정규 UTC millisecond ISO다. 세 목록은 ArtifactRef[]이며 각각≤200, 같은 목록 중복0, 모두 같은 검토항목 evidenceRefs에 exact 포함되어야 한다. 전체 item evidenceRefs 총합≤200. CORE_CHECKED의 ACCEPTED는 basis ACTUAL·각 세 목록≥1이어야 한다. 이는 제출 구조 조건이지 실제 바이트 내용/동작의 기계 검증이 아니며 Task3의 별도 현재 HUMAN 검토/채택을 대체하지 않는다.
- readBaselineContentReview/readBaselineConfirmation은 원입력 격리·2MiB·getter/민감표식 거절을 적용한다. Confirmation은 정확 `{draftRef,reviewRefs,reason,acknowledged:true}`, exact refs1..200/중복0이며 이것만으로 적용하지 않는다. 저장 계층에서 내용 검토/정확 버전/현재 권한을 다시 대조한다.
- ProjectBaselineSources의 의존성은 기존 snapshot 보호 reader·기본 readSourceDeclarationRecord·ArtifactStore.read다. projectMember의 현재 OWNER를 먼저 확인한다. 알려진 project_source_declarations binding을 생략/타프로젝트 선언으로 바꾸지 않으며 기존 생성 명령/원문hash를 대조한다. 없음은 미선택으로만 표시한다. artifacts의 project/id/bytes/hash/media/storage_key·격리와 실제 바이트 길이/hash·알려진 민감표식을 대조하고 raw bytes/경로를 반환 snapshot에 넣지 않는다. source 보고는 역사등급·관측시각을 유지하며 grant의 현재 실행 허가를 발급/추정하지 않는다.

### Task3 입출력·저장 경계 고정

- `ProjectBaselines(sources, documents)`는 기존 보호 resolver 및 ProjectDocuments의 version/originalText를 소비한다. item.designRef는 nullable인 **설계 문서 불변 버전 참조**로 대조하고 문서 본문 접근·hash를 확인하되 설계 확정/실행 허가로 승격하지 않는다.
- save(db,actor,command,policyRef): saveBaselineDraft·targetId=null/expected0/baseRef=null이면 새 ID/version1, 개정은 targetId/baseRef.id·expected/baseRef.version과 현재 draft head/hash가 모두 일치해야 한다. 현재 보호 source/evidence·design 문서를 다시 읽고 schemaVersion1 snapshot을 불변 저장한다. recordedBy/At·input/sourceBinding/evidenceBindings/issues와 contentConfirmed/sourceAuthorizationVerified/coverageVerified/executionAuthorized/dispatchPerformed=false를 보존한다.
- review: reviewBaselineContent의 target/expected는 정확 draftRef와 현재 head다. draft 모든 itemId/featureState가 정확 일치하고, 각 draft evidenceRef는 검토 evidenceRefs에 exact 포함되어야 한다. 검토의 추가 근거도 기존 보호 resolver로 바이트/격리를 확인한다. 미래 checkedAt을 서버 검토 시각 이후 실제 증거로 소비하지 않는다. review snapshot은 정확 `{input,reviewedBy,reviewedAt,independence:NOT_CLAIMED}`, 새 reviewId/version1이며 body를 복제하지 않는다.
- confirm: confirmBaseline·target/expected는 draftRef와 동일, 별도 acknowledged를 요구한다. 최신 server_sequence의 HUMAN 검토가 ACCEPTED이고 선택한 reviewRefs에 포함되며 선택 전부 동일 draft/hash·분류/내용 조건을 충족해야 한다. draft와 검토의 모든 근거/설계·source 현재 접근을 재대조한다. 같은 draft/version의 중복 채택은 VERSION_CONFLICT(같은 command replay는 바깥 기존 명령 계층이 보존). 채택 ref는 매번 새 id·기존 project_baselines의 모든 역사행을 포함한 project MAX(version)+1, 현재 project 행 잠금에서 계산한다.
- 기존 project_baselines에 FEATURE_STATUS_V1용 nullable metadata(draft_id/version·command_id/client_id·source_snapshot_version/hash·baseline_kind)만 추가한다. source_snapshot_ref NOT NULL 해제는 새 kind/source-kind guard와 함께만 허용한다. 원SQL/행은 변경·backfill하지 않는다. 새 baseline_drafts/baseline_draft_versions/baseline_content_reviews/baseline_heads는 각각 head/불변초안/불변검토/명시채택 pointer다. 옛행은 legacy metadata null 유지·LEGACY_UNVERIFIED로만 반환하고 raw 과거 content는 자동 공개/채택하지 않는다.
- 채택 snapshot은 schemaVersion1·kind FEATURE_STATUS_V1·draftRef·input/sourceBinding/evidenceBindings·reviewRefs·previousBaselineRef·reason/acknowledged·adoptedBy/At·contentConfirmed=true와 나머지4 false다. contentConfirmed는 ‘기능 분류 기록을 사용자 채택’만 뜻하며 기능 전체 합격/source 허가/실행준비가 아니다. baseline_heads는 이 새 채택만 가리키며 legacy를 자동 head로 선택하지 않는다.
- GET `/api/v1/projects/:projectId/baseline-drafts/:id/versions/:version`와 같은 경로의 `/decision`, `/baselines/:id/versions/:version`, 목록 `/baseline-drafts`·`/baselines`(limit 기본20/최대50, recent hasMore; 임의key 거절), `/baseline-current`를 연결한다. exact/history는 원 snapshot을 보존하고 currentCheck MATCHED_METADATA/CHANGED/UNAVAILABLE·내용검토와 실행 false를 구분한다. VIEWER는 원문을 받지 않고 현재 OWNER 보호 재대조는 UNAVAILABLE로 표시하며 새 권한을 받지 않는다.
- SQL guard는 현재 OWNER/client/control·정책 AUTO/기한·활성 세션·명령/receipt/audit·해시/불변성·head/CAS·최신검토·현재 artifact 메타데이터/격리·source exact refs를 다시 검사한다. 파일 바이트/의미 판정은 서버 보호 reader/HUMAN 책임이며 SQL만으로 보장했다고 하지 않는다. 후보 SQL은 실제 PG/동시성 미실행으로 남긴다.

### Task3 보완 판정

- 목록은 기존 ProjectListCodec의 actor/project/kind/limit 결박 서명 cursor로 연속 조회한다(limit 기본20/최대50). 목록 자체는 metadataIntegrity=NOT_RECHECKED이며 원문/검토·현재 접근 합격이 아니다. exact GET에서만 저장 무결성/현재 접근을 대조한다.
- 개정 CAS는 옛 head/hash·불변 기록을 대조하되 옛 격리 근거를 제거한 새 입력까지 막지 않는다. 새 입력의 source/근거/설계는 여전히 보호 reader로 확인한다. 검토·채택은 현재 head의 모든 기존/추가 근거를 재검사한다.
- 채택 이력의 contentConfirmed=true는 과거 명시 채택 사실이다. 뒤 REWORK·새 검토 또는 선택 검토의 추가 근거 격리/미접근이면 currentContentReviewValid=false/currentCheck로 현재 가용성과 구분한다. execution/dispatch false는 불변이다.
- 명령 목록 const는 project-command와 store의 순환 import를 피하기 위해 신규 baseline-operations.ts에 분리한다(내부 파일 배치만 보완). actual SQL은 승인 범위상 실행하지 못하므로 문자열 존재 시험으로 PASS를 만들지 않고 독립 정적 검토/미실행으로 기록한다.

### Task4 소비·버퍼 상세화 (Main 비의미 재확정)

- 시작 checkpoint3719a277. Task1~3 완료 후보를 재구현하지 않는다. `baseline-validation.ts`는 browser 순수 JSON/형식 검사, `baseline-api.ts`는 기존 상대경로 transport/보호 reader와 WebCrypto snapshot hash 대조를 맡는다. server 모듈은 type-only로만 가져온다. 새 의존성/공개 계약 변경0.
- App의 project/user/client별 BaselineBuffer에 입력·저장 ref·검토 입력·채택 이유/확인·원 upload bytes와 동일 pending 명령을 보존한다. 화면 이동/인증 상실은 자동 폐기·새 명령 재생성을 하지 않는다. 미확인 명령이 있으면 편집/다른 쓰기를 잠그고 정확 동일 명령 재확인만 허용한다. 현재 controller 세대가 달라지면 기존 입력은 유지하되 전송하지 않는다. 명시 새 초안/저장본 편집은 미해결 명령이 없고 사용자 확인 후에만 가능하다.
- 조회 이력은 mutation 결과와 별도 상태다. 늦은 원문/보고/초안/검토/채택 응답은 mount·project/user/client/control·선택 epoch 및 buffer binding/pending identity를 대조하고 무시한다. 실패401/403·변조 시 이전 조회본문은 숨긴다. 오류 코드 외 서버 원문/비밀을 오류로 표시하지 않는다.
- source는 실제 project의 보호 선언 ref와 기존 source-read 목록→exact snapshot 보호 helper만 선택한다. NONE_SELECTED는 미선택일 뿐 실제 빈 source를 증명하지 않는다. ATTRIBUTE_REPORT는 정확 root/snapshot/grant를 그대로 소비하고 CONNECTOR_REPORTED/OS UNVERIFIED를 표시한다. 보고 조회는 새 관측/native실행이 아니다.
- 근거는 새 파일을 기존 uploadArtifact 명령으로 보호 저장하고 READY exact artifact/hash만 항목에 연결한다. upload도 원 bytes/명령 보존·중복 재확인·격리 거절을 따른다. 원문은 보호 files GET의 hash/크기 대조 후 text/plain·markdown만 텍스트로 표시하고 나머지는 명시 다운로드로 제공하며 HTML/스크립트를 실행하지 않는다.
- 초안 항목의4상태/한계·분류 이유를 편집한다. 검토는 저장된 정확 버전의 전체 항목/분류와 근거를 고정하고 판정·이유를 사용자가 입력한다. CORE의 ACTUAL/환경/시각/정상·저장조회·중요실패 근거는 각각 명시 선택하며 자동 ACCEPTED/실행합격을 만들지 않는다. 최신 적합검토를 재조회한 뒤 별도 채택 이유/체크를 요구한다. currentContentReviewValid와 과거 contentConfirmed를 분리 표시한다.
- 직접 TDD는 동일명령 재확인/다른주체·변조·false flag·source mismatch·늦은응답·원문거절을 다룬다. React 연결은 생성 후 별도 panel과 기존 workspace 재진입에 같은 App 버퍼를 사용한다. 최종 영향범위 test/type/build 및 독립 scoped 검토를 수행하되 실제PG/브라우저/서비스 검증은 실행하지 않았다고 남긴다. 개별 transport 후보 checkpoint는 Task4/전체FN01 완료가 아니다.

### Task4 단일 보완 판정

- 최초 독립 정적 검토 C0/I2/M1을 보존한다. I1의 검증된 APPLIED 격리 receipt는 기존 helper의 quarantinedArtifactId를 보존해 결과 미확인을 해소하되 명시 분리 전 pending을 유지한다. 최초 시도의 명확한 거절은 별도 분리 가능, 이전 단절 뒤 일반4xx는 미확인 그대로다. 분리는 원명령/실패/격리 ID를 탭 rejectedCommands에 보존하고 입력만 다시 편집하게 하며 서버 원문 삭제·격리해제0이다.
- I2는 현재 OWNER/HELD의 새 초안 시작 권한과 옛 buffer의 전송 권한을 분리한다. 원 pending/uncertain이 있으면 새 binding 불가, 해결된 이전 세대 버퍼만 사용자 확인·현재 제어 재조회 뒤 새 binding/현재세대 초안으로 전환한다. 기존 입력 자동 재전송/권한 이전0.
- Main 재등급 Ruling: M1의 중복/빈 항목 ID 업로드는 단순 표시 문제가 아니라 다른 기능에 근거가 오귀속될 수 있어 Important로 처리한다. 업로드 준비와 전송에서 비공백·유일한 대상 itemId만 허용한다. 계약 변경이 아니라 기존 exact 항목 귀속을 지키는 보정이며 잘못 판단하면 새 파일 연결이 불필요하게 거절될 비용이 있다.
- 독립 판단밖(actual 브라우저/주체전환·digest 경쟁, PG/COMMIT/SQL, 실제 권한·격리/파일, 사람의 근거 의미, host/Agent/서비스)은 미검증으로 남긴다. merge 입력 fingerprint의 추가 반례는 확인되지 않았고 현재 single flight·busy/epoch/unmount/binding/pending guard 밖 보장으로 확대하지 않는다. 새로운 독립 C0/I0를 주장하거나 보정 후 재검토를 반복하지 않는다. 실제 검증 가능한 실행 경계가 열리기 전 이 후보를 실사용/전체FN01 완료로 승격하지 않는다.
