# FN16 선택 파일 검증 프로필 — 승인 A안 구현 지시서

2026-10-29 / Main 어울 / 기준 64f5fd9fb467cc0360b139f524a5f3719af772ec

## 승인과 역할
후보 docs/contracts/FN16_VERIFICATION_PROFILE_SOURCE_CANDIDATE_20261029.md SHA256 08EA347866945F647593E39B9A22F5CDCBC441253FE3B61B05D62492466D91FB를 신산님이 PMO 질문 call_d08cff04abd2411a9eb7454c9de28443/item0에서 A안 채택했다. 승인 기록 FN16_VERIFICATION_PROFILE_DIRECT_APPROVAL_20261029.json SHA256 D1ED7A7F7B328013A47DA04AFB87B7BF370826B5E4611017E58516F6AF272673이다.
기존 fn16_primary만 코드 작성, Main은 문서·검수·통합, fn16_review는 독립 읽기 검수. 기존 branch에서 진행하며 보호된 미추적 8파일은 수정하지 않는다.

## 허용 13경로
제품:
- contracts/runtime/backup-verification-profiles-v1.ts (신규)
- apps/server/modules/backups/backup-verification-profiles.ts (신규)
- apps/server/modules/backups/backup-reference-store.ts
- apps/server/modules/backups/backup-reference-routes.ts
- apps/server/modules/access/repository.ts (optional 내부 공급 port만)
- apps/server/modules/projects/routes.ts (기존 store 생성 주입만)
- apps/web/src/features/backups/backup-reference-api.ts
- apps/web/src/features/backups/BackupReferencePanel.tsx

검증:
- tests/unit/FN16/backup-verification-profiles.test.ts (신규)
- tests/unit/FN16/backup-reference-store.test.ts
- tests/unit/FN16/backup-reference-routes.test.ts
- tests/unit/UI14/backup-reference-api.test.ts
- tests/browser/UI14/backup-verification-profiles.spec.ts (신규)

App·기존 snapshot parser·SQL·기존 backup-resource-provider·설치/native reader는 변경하지 않는다. 새 source가 필요한 경우 이유와 경로를 먼저 Main에 전달한다. 실제 값/설정 발급·DB/정책·키·서비스·Agent·전체 백업/복원·P03 실행은 제외한다.

## 내부 구현 기준
- 공용 runtime은 Node 의존 없이 공개 Profile/ref/current의 닫힌 구조, SELECTED_FILES_V1, 고정 순서 checks3, 양의 안전정수 limits7을 검사한다. 공개 DTO에 없는 installationId로 브라우저 hash를 검증했다고 주장하지 않는다.
- 신뢰된 내부 VerificationProfileSource는 installationId, list(context,{after:{id,version}|null,limit}), read(context,id,version), assertCurrent(context,record):Promise<void>를 필수로 둔다. context는 기존 db/actor+projectId, 목록 공급은 최대 limit+1(최대201)로 제한한다. 기본 성공·실제 설정 생성은 없다.
- 내부 record는 공개 본문과 고정 sourceRef를 포함한다. sourceRef는 기존 정확 VersionRef 형식을 쓴다. hash만으로 출처 인증을 대신하지 않는다. 필수 공급자의 assertCurrent는 현재 출처·버전 확인 책임이며 return void 외 결과/불명은 거절한다.
- source 본문을 유효성 검사·복사하여 사용한다. 서버 ref hash는 승인 후보의 installationId/id/version/scope/checks/limits만 canonical hash로 계산한다. 목록은 고정 read와 대조하고 idASC/versionDESC·cursor 경계·중복 id/version 다른hash를 검사한다. 한 페이지 이외 전체 시점 snapshot 보장은 만들지 않는다.
- 공급 부재는 UNCONFIGURED/빈 목록, 잘못된 공급·현재성 불명은 UNVERIFIED/새 사용 불가다. 공개 current는 기존 reasonCode 2개와 observedAt/eligible만 사용한다. 원 Error/path/cause/공급 sourceRef/설치 신원 비노출.
- 전용 cursor는 기존 signProjectCursor와 다른 domain으로 서명하고 project/actor/client/limit/order/마지막 id·version을 결박한다. 기존30분/4096자와 정규 인코딩·고정 구조를 유지한다. 공용 ProjectListCodec이나 날짜 필드는 변경하지 않는다.
- 새 GET /api/v1/projects/:projectId/backup-verification-profiles는 기존 OWNER·민감자료/no-store·세션/다른프로젝트404 검사를 그대로 사용한다. query는 limit/cursor만이다.
- 기존 과거 snapshot 파서는 보존한다. 새 VERIFICATION command에서 checks3의 정확 일치를400으로 검사하고 provider 없는 기존412는 유지한다. 선검사 및 쓰기 후 commit 전 동일 ref/출처/currentness를 다시 검증한다. 승인·policy·control·receipt/audit·CAS·replay·rollback/UNKNOWN 경계를 완화하지 않는다. 과거 snapshot을 삭제/수정하지 않고 현재 eligible만 구분한다.
- UI14 프로필 선택은 POST/확정을 수행하지 않는다. 조회 범위·체크3·유한한도·현재성·정확ref를 표시하고 명시선택한 ref를 기존 승인 왕복/명시저장/재조회로 연결한다. 공급 불명·회수·응답변경·다른세션·늦은응답은 신규 준비를 막고, 이미 UNKNOWN인 원명령은 교체하지 않는다. 전체 백업 준비완료 문구·실행 API 추가0.

## 검증 순서
1. TEST_ONLY: 공급/runtime/cursor·store/route·Web API의 핵심 정상/음성 시험을 먼저 작성한다. Main이 신규 실패를 확인한 뒤 동일 writer 구현.
2. 공급/조회: 정렬·페이지·부재·exact checks/limits/hash/source/ref·고정 read/현재성 불명·cursor 만료/주체/project/limit 변조·OWNER/no-store·원 오류 비노출.
3. 저장/조회: 실제 서버 command 소비선을 합성 SQL 포트로 검증. 일회 승인→정확 저장/replay 소비1·쓰기 후 회수 rollback·구버전 본문보존/현재불가·RETENTION/TARGET/KEY 직접 인접 경계.
4. UI/API: 명시 선택/명령 보존·승인 왕복·재조회·회수·늦은 응답/이탈·UNKNOWN. 실제 App 합성 브라우저는 별도 QA 이름·경로·owner·수명/정리를 Main이 등록한 후 시행한다. 실제 DB/served 검증으로 보고하지 않는다.
5. 독립 검수→Main 변경 집중 unit/type/build/diff. 변화 없는 native/reader/bootstrap 시험은 반복하지 않는다. 실패는 원인별로 기록하며 기준을 낮추지 않는다.
6. Main 문서/WORK_STATUS/결과 기록, 정확 소유 경로만 commit/private push, 실제 local/private와 main 불변 확인. 전체 FN16/Stage/계획 완료는 아니다.

## 복귀
새 optional port 공급을 제거하면 기존 UNCONFIGURED/VERIFICATION 저장412로 돌아간다. source는 검토된 revert로 복귀하며 과거 자료·참조·승인 이력을 삭제하지 않는다. 실제 자원 생성/변경이 없으므로 DB/키/서비스 복구 작업은 없다.
