# FN01 초안 원문 첨부·저장·생성 귀속 구현 계획

> 작업자는 `superpowers:subagent-driven-development`와 TDD 절차로 수행한다. Main은 범위·관리·검수·통합을 소유하며, 코드 writer는 한 명이다.

## 목표·승인·기준

UI02에서 실제 초안 ID를 만든 뒤 원문을 업로드하고, 사용자가 선택한 자료를 초안 버전에 저장·재조회하며, 별도 프로젝트 생성에서 같은 artifact ID/bytes/hash와 선택 관계를 귀속하고 기존 보호 조회로 읽는다. 화면·입력 helper·SQL 일부만 구현하고 이 업무를 완료로 보고하지 않는다.

- Stage B FN01/UI02, 부모 `docs/contracts/FN01_DRAFT_ARTIFACT_STORAGE_CANDIDATE.md` r3 SHA256 `F4E734B396485E574A8119AECA1731D4F38C2114B15AB285EF18DA1EABC584D0` 전체를 소비한다. 부모 원문은 변경하지 않는다.
- 신산님의 직접 답변: `request_user_input_async call_3619cd1844684a80876b59ff3cbcaecb`, 답변 **위 범위 구현 승인**. 승인 질문의 대상은 코드·화면·미적용 SQL·합성 검증이며 실제 DB 적용·사용자 권한·Secret·서비스·Agent 실행은 제외한다. 실패한 PMO 메시지를 승인으로 재해석하지 않는다.
- 기준 branch `codex/av3-stage-b`, checkpoint `04e7246021779bd36fca06fd9f965c24444c5e65`.
- N4 부분 source는 이 checkpoint의 작업단위 PAUSED다. native `6D33BBB3…B8388F`/미래시험 `81BAD535…1F562`와 보호8·다른 미채택/거절은 쓰지 않는다. source 권한을 실제 DB/정식 경로·정책·실행 권한으로 확대하지 않는다.

## 단일 업무의 파일 책임

기존 수정 허용:

- `apps/server/modules/projects/repository.ts`: 원 DRAFT 명령/선택 버전·생성 final transaction의 실제 연결.
- `apps/server/modules/projects/routes.ts`: 같은 auth/host 경계의 DRAFT 파일 route·저장 서비스 주입.
- `apps/server/storage/artifact-store.ts`: 기존 PROJECT 메서드 보존, 명시 root 아래 DRAFT 보관/검증·프로젝트 복사·정확 중복 회수.
- `apps/web/src/features/project-create/api.ts`, `ProjectCreatePage.tsx`, `draft-wizard.ts`, `DraftWizardReview.ts`: 원 초안/명령/입력 보존과 업로드·선택·저장·조회·생성 소비.
- `apps/web/src/App.tsx`: 원 upload 바이트/명령이 남은 상태에서 새 초안/탭 종료 보호. 기존 사용자·로그아웃/문서·대화 버퍼 정책을 바꾸지 않는다.

신규 업무 source:

- `contracts/draft-artifacts.ts`: 정확 wire/ArtifactRef/receipt·조회 projection 타입·검사.
- `apps/server/modules/projects/draft-artifacts.ts`: durable intent/quota/선택·귀속의 실제 transaction과 orchestration.
- `apps/server/modules/projects/draft-artifact-files.ts`: 제한된 파일 port와 실제 ArtifactStore 소비/검증 결과의 내부 결박.
- `apps/server/modules/projects/draft-artifact-routes.ts`: DRAFT POST/보호 GET과 body 전 검사·복구/최종 확정.
- `apps/web/src/features/project-create/draft-artifact-api.ts`, `DraftArtifactsPanel.tsx`: 실제 ApiClient·정확 명령/바이트·보호 원문·명시 선택 UI.
- `db/migrations/0042_draft_artifact_storage.sql.pending`: 미적용 forward SQL. 기존 SQL·적용 runner·기존 manifest를 수정하지 않는다.

직접 검수 source:

- 신규 `tests/unit/FN01/draft-artifact-input.test.ts`, `draft-artifact-service.test.ts`, `draft-artifact-files.test.ts`.
- 신규 `tests/support/draft-artifact-fixture.ts`: 합성 identity·transaction rollback/commit을 갖춘 fake DB/파일 port. 실제 DB의 제약·경합을 검증했다고 하지 않는다.
- 신규 `tests/integration/FN01/draft-artifact-synthetic.test.ts`: 실제 route/service/repository/ApiClient의 수직 소비.
- 신규 `tests/unit/UI02/draft-artifact-api.test.ts`, `tests/browser/UI02/draft-artifact.spec.ts`, 필요 시 해당 spec의 harness 한 개.
- 기존 FN01/UI02 직접 시험에서 응답/입력 계약 변경으로 필요한 fixture 추가만 허용한다. 기존 기대값/사례를 삭제·완화하지 않는다. 필요한 경로를 먼저 발견·보고하고 무관 시험은 수정하지 않는다.

Main이 이 카드·승인 binding·미적용 manifest·현황/계획을 소유한다. 신규 파일이 이미 있으면 덮지 않고 보고한다. 목록 밖 제품 변경이 꼭 필요하면 기존 호출선과 이유를 Main에게 제시한다. 사용자에게 계획 전체 재승인을 요청하지 않는다.

## source·미적용 SQL 상세 결정

1. 신규0042와 전용 비실행 manifest를 사용한다. `scripts/migrate-development.ts`, 기존 migration 목록 및 과거 `FN01_BASELINE_PG_MIGRATION_MANIFEST.json`은 그대로 둔다. manifest에는 부모 r3·실제 의존 SQL의 ID/bytes/hash·새 SQL hash와 `executionAuthorized:false`, `applied:false`만 결박한다. 실행 runner를 추가하지 않는다.
2. owner quota/예약, upload/creation intent, 불변 상태 사건, 선택 버전 header/행, adoption 사건을 저장한다. 빈 선택도 `draft_artifact_selection_versions`로 버전/command/receipt를 증명한다. 최종 열·제약·함수는 r3의 소유/현재성·유일성·보존 조건을 모두 소비한다.
3. 원 `artifacts.id/created_by/client_id/command_id`와 원 receipt/audit는 불변이다. 생성 command로 업로드 FK를 바꾸지 않는다. 기존 PROJECT guard/inspection/일회 승인 경계를 그대로 두고 DRAFT만 정확 분기한다.
4. app의 일반 artifact UPDATE/DELETE는 계속 금지한다. 한정 함수는 고정 search_path·수식 객체명·PUBLIC EXECUTE 회수·정확 app 경로만 선언한다. GUC 문자열만 믿지 않고 현재 session/user/client·draft/intent·원 command/receipt/audit·새 OWNER/제어·선택 snapshot을 대조한다. 실제 권한 부여/SQL 적용은 하지 않는다.
5. 공통 lock 순서는 현재 인증 user/session/client → owner quota → draft → 같은 command/intent → 정렬한 artifact/선택 → 새 project/관계다. 관련 save/draftOperation/create도 같은 순서를 소비한다. DB transaction을 열린 채 파일 I/O를 기다리지 않는다.

## 업로드·저장·생성의 실제 흐름

- POST는 기존 r3의 DRAFT 전용 header/body만 받는다. UTF-8 8000bytes strict JSON·정확 필드·20MiB·실제 bytes/hash·현재 auth/CSRF/owner/원 client·host/origin을 검사한다. root 미설정은 예약/파일 생성 전에 닫고 기본 root를 만들지 않는다.
- 기존 FINALIZED 같은 요청을 현재 draftVersion 검사보다 먼저 분기한다. v1 업로드→v2 선택 저장 후에도 같은 v1 완료 명령을 현재 원문 권한·격리·동일 body/metadata로 재확인한다. 신규/미확정만 미소비/exactVersion을 검사한다.
- 새 업로드는 intent/최악 물리 quota 예약 COMMIT → 파일 port의 제한 쓰기·close/sync·독점 게시/재검증 → 새 transaction의 현재성/원 intent/fencing/파일 결과 대조 → artifact/원 command/receipt/audit 최종 COMMIT이다. rollback/응답 유실에도 같은 UUID/key/명령을 사용한다.
- 같은 intent의 이전 writer 종료나 부분 파일이 불명이면 UNKNOWN을 보존한다. TTL/lease 만료·프로세스 메모리의 부재만으로 원 작성 종료를 증명하거나 덮어쓰지 않는다. 실제 file port의 닫힌 작성/정확 게시 검증과 서비스의 SQL fencing을 연결한다.
- 업로드는 초안 버전·선택을 자동 변경하지 않는다. saveDraft는 사용자가 선택한 exact READY/비격리 ref만 검증하고 그 버전의 선택 snapshot을 같은 transaction에 보존한다.
- 생성은 intent/복사 quota 예약 COMMIT → 같은 고정 target project의 copy/sync/bytes/hash 검증 → 마지막 transaction의 현재 초안/선택/intent/권한/파일 재대조와 기존 project/OWNER/제어/방법론·소비·귀속/사건·명령/receipt 일괄 COMMIT이다. 다른 미확정 생성 명령은409, 같은 명령은 같은 project/receipt다.
- 현재 귀속·새 주 원문·원 key·현재 권한을 재검사한 정확 중복만 회수한다. 회수 실패/불명은 보존·quota 유지다. 미선택/격리/UNKNOWN·마지막 원문·고아를 자동 삭제하지 않는다.

## 조회 projection과 UI 결정

- 새 목록 endpoint는 만들지 않고 기존 draft GET에 owner 범위의 보관/복구 metadata projection을 추가할 수 있다. storage key·원문 body·서버 경로/예외·Secret은 반환하지 않는다. immutable 저장 사실과 현재 읽기/쓰기 가능 여부를 구분한다.
- 미귀속 원문은 현재 draft owner 범위의 보호 GET, 귀속 후 원문은 현재 프로젝트 권한의 기존 files GET만 사용한다. 선택한 귀속 자료의 현재 프로젝트 읽기가 회수된 경우 ref/hash/receipt를 projection으로 새로 노출하지 않는다. 원 DB snapshot/receipt를 삭제·변조해 숨기지 않으며 필요한 보호 조회는 명확히403/404로 닫는다. 빈 과거 초안의 기존 조회는 유지한다.
- 첫 단계는 실제 초안 ID 저장이다. 업로드 전에 실제 browser 파일명/크기/형식/대상을 보여주되 filename을 r3 backend header에 새 필드로 넣지 않는다. 새로 조회한 보관 ref에는 실제 보존된 ID/bytes/hash/MIME을 표시하며 저장하지 않은 파일명을 발명하지 않는다.
- 명시 업로드와 명시 선택·중간 저장·최종 생성은 별도다. 업로드 성공만으로 checkbox 선택/버전 증가/생성을 하지 않는다. 새로 조회 후 현재 선택·미선택·격리·UNKNOWN과 차단 사유를 구분한다.
- pending 원 command/정확 bytes·actor/client/draft/version을 App 버퍼에 보존한다. 미확정 동안 다른 변경/새 초안·이탈을 보호하고 명시 같은 명령 재확인만 허용한다. 다른 사용자/client/프로젝트·지연 응답/401·원문 오류에서는 이전 보호 내용을 숨기고 원 명령/이력을 몰래 바꾸지 않는다.
- 원문은 HTML/스크립트로 실행하지 않는다. 격리는 일반 읽기·첨부·생성 귀속/Agent 전달을 막고 자동 해제하지 않는다. 탐지는 기존 알려진 표식 범위이며 완전한 탐지라고 하지 않는다.

### 독립 검수 보완 r2

- 첫 scoped 검수 C0/I1/M0: 새 보관 projection뿐 아니라 기존 input.artifactRefs와 saveDraft의 previous.result_ref replay도 현재 프로젝트 접근을 우회할 수 있다. 귀속 ref가 포함된 draft GET와 과거 saveProjectDraft replay는 응답 전에 현재 프로젝트 원문 읽기·격리를 재검사하고, 하나라도 거절이면 응답 전체를403/404로 닫는다. 원 input/snapshot/receipt를 빈 배열·다른 hash로 변경하지 않는다. 자료 없는 과거 초안과 미귀속 보존 자료의 owner 보호 GET는 유지한다.
- 후속 필수 반례: 업로드→선택 저장→생성→프로젝트 권한 회수 후 draft GET와 과거 저장 명령 replay 모두 ref/hash/receipt 비노출, 미선택 보존 자료 owner GET는 유지. 최초 route404 RED만으로 이 경계를 검증했다고 하지 않는다.
- 기존 PROJECT files GET는 실제 ArtifactStore를 생성하므로 마지막 보호 조회까지 수직 연결하는 시험은 Main이 별도 사전 등록한 일회 격리 root의 실제 ArtifactStore·합성 bytes와 fake DB를 사용한다. 메모리 file port 결과를 기존 실제 route 실행으로 대신하지 않는다. 이번 TESTONLY 첫 RED에는 실파일 자원을 만들지 않는다. 기존 PROJECT route/security/파일 port 주입은 수정하지 않는다. 실제 DB 적용·정식 root/서비스·권한 변경은 계속 제외한다.
## TDD·검수

- [ ] writer는 기존 source 전후 hash와 첫 실제 실패 시험을 제출한다. Main은 구현 전 RED를 확인하고 제품 보완을 이어가게 한다. 의미 없는 module 부재만으로 수직 흐름 검수를 대신하지 않는다.
- [ ] 실제 service/route/repository/ApiClient를 소비하는 합성 수직 흐름: 업로드→미선택 보관→명시 선택/save→재조회→별도 생성→동일 ID/bytes/hash/관계의 프로젝트 원문 GET.
- [ ] 정상/멱등: v1 완료 replay/v2 선택, 응답 유실의 동일 upload/create, 다른 payload/body409·중복 생성/원문0·원 command FK 불변.
- [ ] 권한/원문: 타 사용자/초안/원 client·오래된 신규 버전·회수/격리·누락/변조·중복 ref, 정확 경로 외 원문 비노출. 세대/주체 변경 중 지연 응답을 수용하지 않는다.
- [ ] 실패/자료 보존: quota 경쟁용 합성 순서·0byte 개수·publish 후 DB rollback·부분 쓰기/미종료 writer·생성 복사 실패·최종 현재성 회수·UNKNOWN 잔류와 원 예약 보존. 실제 경합/OS fsync·재시작 증거와 분리한다.
- [ ] 실제 React UI의 같은 명시 흐름·자동 선택/생성0·기존 readonly/consumed/pending·무자료 생성/방법론·소스 선언/PROJECT 업로드·일회 승인 직접 영향만 확인한다.
- [ ] 타입·관련 빌드·직접 unit/합성 integration·DOM과 독립 code/SQL 정적 검수 후 source 상태를 기록한다. 합성 fake DB는 PostgreSQL 구문/FK/권한·실COMMIT·경합 PASS가 아니다.

실제 PG/DB 적용·정식 storage root/소유권·실 OS fsync/프로세스 재시작·서비스·사용자 권한·Agent는 미실행으로 남긴다. 검수 자원은 Main이 이름/owner/수명/정리를 사전 등록하고 정확 정리·별도 잔여0을 확인한다. source checkpoint는 기존 branch에만 보존하며 Stage 전체 gate·실사용·PR/병합 승인을 대신하지 않는다.

rollback은 소유 commit 일반 revert다. SQL은 미적용 상태로 보존하고 실제 원문·DB·권한/감사 이력을 reset/delete하지 않는다.
