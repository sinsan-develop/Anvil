# FN16 선택 문서 원본 수동 반출 — 서버·저장·화면 연결

## 기준과 Main 판단

기준은 codex/av3-stage-b / cfcf40af6b91a9d0131294ddd627259824fba46e이다. 승인 INTERFACES §14.1의 exportProject(includeSource,selection,reason), backups 목록/항목 조회와 예정 job 영속 모델을 처음 구현한다. 형식이나 모듈이 없다는 이유로 계획 전체를 재승인받지 않는다. 아래 DTO는 기존 기능 의미를 고정하는 구현 상세이며 새 권한 예외나 기존 API 변경이 아니다.

이번 범위는 사용자가 고른 저장 문서 버전의 BODY 또는 첨부 **1개**를 별도 보관한 뒤 조회·다운로드하는 부분 반출이다. includeSource=false만 지원하며, 프로젝트 DB snapshot·소스·다른 자료·실행 상태 복원은 포함하지 않았다고 명시한다. createBackup의 policyRef/대상/키 정책을 null이나 암묵 정책으로 우회하지 않는다. 실제 DB 적용·설정·정책·서비스·Secret 변경은 하지 않는다.

## 단일 writer 허용 경로

신규:
- apps/server/modules/backups/project-backups-input.ts
- apps/server/modules/backups/project-backups.ts
- apps/server/modules/backups/project-export-store.ts
- db/migrations/0043_project_artifact_exports.sql.pending
- apps/web/src/features/backups/project-backups-api.ts
- apps/web/src/features/backups/ProjectBackupsPanel.tsx
- tests/unit/FN16/project-backups.test.ts
- tests/unit/FN16/project-backups-fixture.ts
- tests/browser/UI14/project-backups.spec.ts
- tests/integration/FN16/project-artifact-export-pg.ts

기존 최소 연결:
- apps/server/modules/access/routes.ts
- apps/server/main.ts
- apps/server/modules/access/project-command.ts
- apps/server/modules/projects/routes.ts
- apps/web/src/App.tsx
- apps/web/src/shell/AccountSecurity.tsx
- apps/web/src/features/settings/SettingsSourceLinks.ts
- apps/web/src/features/connections/policy-editor-profile.ts
- apps/web/src/features/connections/CandidatePolicyPanel.tsx

기존 ArtifactStore/sensitive-inspection/파일 GET, manifest·builder·검증복원, app.ts와 다른 정상 기능은 수정하지 않는다. 경로를 실제 rg 목록으로 확인한다. 위 범위가 부족하면 정확한 호출선과 필요한 diff를 Main에게 먼저 제시한다. Main은 제품 코드를 수정하지 않는다.

## 고정 계약

표준 ProjectCommand를 사용한다. operation=exportProject, targetId=null, expectedVersion=0, approvalRef=null, baselineRefs=[]이며 기존 actor/client·제어 세대·CSRF·idempotency 검사를 유지한다.

payload의 정확 필드는 includeSource:false, selection, reason이다. selection의 정확 필드는 kind:'DOCUMENT_ARTIFACT', documentRef:기존 VersionRef, artifactRef:기존 ArtifactRef다. documentRef의 고정 버전/내용 hash와 그 content.body 또는 attachments에 있는 **동일한 ArtifactRef**를 서버가 대조한다. reason은 기존 자료 명령의 제한을 재사용한다. 임의 ID/path/filename/storage key를 브라우저 입력으로 허가하지 않는다.

공개 manifest의 정확 필드는 schemaVersion:1, kind:'SELECTED_DOCUMENT_ARTIFACT_EXPORT', projectId, includeSource:false, selection, files, omitted, createdAt, createdBy다. files는 정확히 한 개의 {artifactRef,downloadName}이고 파일명은 서버가 artifact UUID로 만든 .bin이다. omitted는 PROJECT_DB_SNAPSHOT, PROJECT_SOURCE, OTHER_PROJECT_MATERIALS, EXECUTION_STATE_RESTORE의 고정 목록이다. createdBy는 {kind:'HUMAN',userId}, 시간은 서버 UTC다. 이는 선택 반출 manifest이며 전체 프로젝트 백업/복원 형식 구현으로 표시하지 않는다.

불변 ref는 {id:서버 job UUID,version:1,contentHash:canonical manifest hash}다. JobDTO는 정확히 {ref,manifest,sourceAvailability:'READY'|'BLOCKED'}이며 현재 sourceAvailability는 불변 manifest hash와 분리한다. 생성시 검증과 지금 다운로드 허가를 구별한다. receipt.data는 {status:'EXPORT_STORED',ref}를 표준 receipt에 담는다.

GET /api/v1/projects/:projectId/backups?view=SELECTED_ARTIFACT_EXPORTS&limit=50&cursor=... 는 {items,hasMore,nextCursor,observedAt,baselineVersion:null}을 반환한다. 기존 ProjectListCodec과 repository.signProjectCursor의 FN16 전용 도메인을 재사용해 actor/project/view/position을 결박한다. GET .../backups/:id는 JobDTO, GET .../backups/:id/file은 **별도 보관 복사본**을 attachment .bin/no-store/nosniff로 내려준다. 기존 files GET의 저장소 범위를 넓히지 않는다. 조회·링크 클릭은 command/승인/정책 변경을 만들지 않는다.

## 서버·DB·파일 안전

1. 현재 회원/OWNER·단독 controller·세대/정책·CSRF·정확 payload/원문 버전·replay·receipt/audit를 실제 표준 경로로 재사용한다. 다른 프로젝트·임의/부적합 source·격리/의심 원문은 파일 생성 전 거절한다. ArtifactStore.read와 assertStoredArtifactReadable을 소비하며 원본 무결성/격리를 우회하지 않는다.
2. exportProject는 기존 자료 정책 프로필에 명시 선택으로 추가하고 기본 미선택을 유지한다. 실제 정책을 자동 부여하지 않는다. REQUIRE_APPROVAL 경로가 연결되지 않았으면 EXPORT_APPROVAL_NOT_CONNECTED로 닫고 화면에서 명시한다. 다른 operation·알림 읽음의 동작은 보존한다.
3. 선택적 AccessRoutesOptions.exportRoot와 ANVIL_EXPORT_ROOT 전달만 지원한다. 설정값·인증 키·실제 디렉터리는 지금 만들지 않는다. root 미설정/SQL 미적용은 인증 후 명시 503이며 가짜 빈목록·가짜 저장 성공이 아니다. 서버 전용 보호 root의 소유/nonlink를 확인한 뒤 UUID 기반 새 하위 위치만 만든다. 기존 자료/목적지를 덮지 않는다.
4. 서버 adapter가 원본 DB 귀속을 보관 위치와 결박하고 기존 builder로 실제 복사·재읽기한다. 원본/복사본의 bytes/hash와 알려진 민감 표식을 검사한다. 다운로드는 DB에 확정된 job과 현재 회원·원 source의 DB 귀속/격리 상태를 재검사하고, 보관 복사본 자체를 검증한다. 원 source 물리 파일이 없어도 정상 보관본은 원 파일로 redirect하지 않고 독립적으로 읽어야 한다. source가 사후 격리되면 과거 hash를 덮거나 사본을 자동 삭제하지 않고 다운로드를 차단한다.
5. TECH_DECISIONS §12의 두 예산을 그대로 구분한다. 기존 파일20MiB·프로젝트 원본/첨부10GiB 집행은 수정하지 않는다(156행). 반출 저장소는 별도 사용자 지정 백업 대상의 기본10GiB 예산(162행) 안에서 모든 프로젝트의 복사본·metadata·미확인 orphan을 합산한다. 원본+백업을 합친 단일10GiB 집행을 새로 약속하지 않는다. target 전체의 동시 반출은 배타 reservation/소유 lock 등으로 예산 경합을 막고, unknown 구조/소유 불명 lock은 추정 해제하지 않는다. 새 임의 행수 한도·자동 삭제를 도입하지 않는다. 수동 반출 IO의 내부 협력적 기한은 최대30초와 현재 session/정책 잔여 중 짧은 값을 적용한다. 하위 호출에서 기한을 늘리지 않는다. COMMIT 이후 현재성 확인이 불가능하거나 기한을 넘으면 EXPORT_RESULT_UNCERTAIN로 원명령/receipt를 보존한다. 기존 다른 operation의 응답/기한을 바꾸지 않는다.
6. 파일 생성과 DB commit은 원자적이라고 주장하지 않는다. COMMIT 불명/미확인·orphan은 확정 job과 분리하고 원명령을 재확인한다. 소유·미커밋이 확실하지 않은 사본을 추정 삭제하지 않는다. 확정 job이 없는 파일은 다운로드하지 않는다. 같은 command의 확정 replay는 같은 ref를 반환하고 다른 payload 재사용을 거절한다. 실제 정책·schema·서비스 변경은 하지 않는다.
7. 새 .sql.pending은 명령/receipt/audit·project/source/actor/client 귀속과 불변 manifest/hash·중복 제약·app 역할/RLS를 정확하게 연결한다. 기존 SQL/일반 migration runner의 ID 목록은 변경하지 않는다. 실제 PG 실행 전에는 SQL syntax/RLS/FK 검증을 PASS로 보고하지 않는다.

## 화면 동작

기존 settings slot에 선택 원문 반출 패널만 추가한다. 문서 목록→명시 버전 조회→BODY/첨부 metadata 선택→반출 이유/범위 확인→명시 command 준비→별도 전송→불변 ref 결과/목록→같은 origin 보관 복사본 링크로 이어진다. 기존 인증 입력의 remount/초기화와 새 메뉴·Dashboard·테마 추가는 금지한다.

App이 actor/client/project와 원 command/body·API/transport/CSRF를 고정한 buffer를 소유한다. 화면 왕복에도 미확인 명령을 보존하고, 같은 명령 재확인만 허용한다. 주체/프로젝트/클라이언트 변경·늦은 응답·ABA·403/404·확정 receipt 역행을 막는다. 명령 결과 확정과 후속 GET 실패를 구분한다. 전체 reload 이후 메모리 복구 한계는 숨기지 않는다. 실제 서비스가 준비되지 않았으면 미확인/미설정으로 보이고 mock 행을 만들지 않는다.

## TDD·검수·자원

서버의 실제 파서/ProjectCommand/route와 실제 합성 파일을 사용하는 RED→GREEN, API DTO/서명 cursor·replay·격리·교차project/현재 권한·CSRF·오류/고아 보존·할당량/기한을 검수한다. 브라우저는 실제 App bundle에서 명시 선택/준비 POST0/별도전송·receipt/후속 실패·유실/원명령·범위/늦은 응답과 기존 인증 입력 보존을 검수한다. native 브라우저 다운로드는 합성 route에서 canceled였던 기존 사실을 숨기지 않으며, .bin bytes는 실제 서버 API와 파일 검수 범위로 분리한다. 기대/한도·기존 검사를 완화하지 않는다.

집중 unit/API+FS, 관련 기존 notification/자료 정책 검수, typecheck·build/diff와 독립 backend/UI review를 선택한다. 전체 기존 회귀 반복은 하지 않는다. integration 스크립트는 명시적 격리 QA config/DB 이름·root 검사를 요구하고 기본 PG/실제 설정·credential fallback을 금지한다. 실행은 Main이 private exact SHA 이후 WSL용 경로/컨테이너/이미지/DB/역할/수명/정리를 따로 등록한 뒤 수행한다. 그 전에는 PG 검증 NOT_RUN이다.

Windows 사전등록 자원:
- unit 실제 파일: D:/tmp/anvil-v3-stage-b/fn16-project-artifact-export-20261027-01
- App QA: D:/tmp/anvil-v3-stage-b/ui14-project-artifact-export-20261027-01
- owner SINSAN\cyhuh. 각 생성 직전 부재/부모 owner·nonlink/realpath, 최대30분, 종료·실패 즉시 소유 파일/빈dir 명시 회수와 별도 잔류0. 두 root는 분리하고 기존 QA/사용자 자료는 재사용하지 않는다. 새 Windows/WSL HTTP·TLS listener/인증서·Secret·실제 DB/정책·서비스는 생성하지 않는다.

writer는 신규 resource 생성 전 Main에게 정확한 시각/대상을 알리고, 브라우저 실행은 Main 등록/실행을 기다린다. source·미적용SQL·합성 검수와 실제 개발환경 사용 가능을 구분한다. 파일 hash·정확 명령/exit·원RED/최종/오류·미검증·정리·writer 해제를 보고하며 Git/문서/DB 설정 쓰기는 Main이 관리한다. 전체 FN16이나 작업계획서 완료를 선언하지 않는다.
