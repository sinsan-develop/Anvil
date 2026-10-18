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
