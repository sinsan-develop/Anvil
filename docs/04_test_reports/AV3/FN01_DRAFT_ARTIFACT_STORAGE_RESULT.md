# FN01 초안 원문 첨부 구현·합성 검수 결과

## 판정

**승인 r3의 코드·화면·미적용 SQL·합성 QA 범위 구현 완료. 실제 DB·서비스는 미적용이다.** 전체 FN01/UI02·Stage B·작업계획서 완료나 사용자 인수 판정은 아니다.

직접 승인: call_3619cd1844684a80876b59ff3cbcaecb의 “위 범위 구현 승인”. 부모 계약 SHA256 F4E734B396485E574A8119AECA1731D4F38C2114B15AB285EF18DA1EABC584D0, Main 비의미 재확정 WI r3 SHA256 C5785F57EC898547818BDC42C3DD772626A66F306C8043D9B208831560CAB494다. 실제 DB 적용·사용자 권한·Secret·서비스·Agent 실행은 제외했다.

시작 branch는 codex/av3-stage-b, 실제 HEAD는04e7246021779bd36fca06fd9f965c24444c5e65였다. Main 문서 checkpoint9c9e4ff5a3a8c5fd9b0f6604cc82e42bfe57b192 이후의 소유23파일을 구현·검수했고, 시작 tracked clean과 보호 untracked8을 구분했다. 현재 검증 파일은 통합 commit 전 동결 상태이며 실제 게시 SHA는 후속 WORK_STATUS에서 확인한다.

## 연결한 기능

- 새 초안 첫 저장의 서버 UUID 조회 → 원문 명시 업로드 → 미선택 보관 → 명시 선택/중간 저장 → 재조회 → 별도 프로젝트 생성 → 같은 artifact ID/bytes/hash·원 업로드 출처의 보호 조회.
- 동일 업로드/생성 명령 재확인, v1 업로드의 v2 선택 저장 이후 완료 replay, 응답 유실·부분 파일·DB 확정 실패 시 원 명령/자료/예약 보존.
- 실제 파일 I/O와 DB transaction 분리, durable intent/attempt·유한 quota·선택 snapshot·귀속 출처·한정 함수/불변 사건을 source와 pending0042에 연결했다. 실제 PG 동작은 검증하지 않았다.
- 현재 user/client·CSRF/API 객체·초안 대상이 다른 지연 응답과 권한 회수 시 과거 원문/ref/hash 표시를 차단한다. 편집 버퍼·명령·이력은 지우지 않고 명시 보호 조회로만 표시를 회복한다.
- 업로드만으로 자동 선택·초안 버전 발급·프로젝트 생성·Agent 실행을 하지 않는다. 원문 HTML/스크립트를 실행하지 않는다. 알려진 비밀 표식 격리는 완전한 탐지라고 주장하지 않는다.

## Main 실제 검증

| 범위 | 근거·결과 | 증명 한계 |
|---|---|---|
| 최종 집중/인접 단위·source 검사 | aa1e89 48 PASS / 0 FAIL / 0 SKIP, 타입 exit0 | SQL 정의1건은 source assertion, 실제 PG 아님 |
| 제품 빌드 | 10009f exit0, 기존500kB chunk 경고 유지 | 이후 제품15파일 불변 확인, 배포 아님 |
| 실제 파일·in-process 수직 | A2 614c56 2 PASS, 7a9a55 1 PASS | 실제 ArtifactStore·합성 원문/fakeDB. 실행 후 EOF만 변경된 본문 동일성을 확인했고 actual DB/OS crash 증거 아님 |
| 실제 브라우저·파일 두 진입 | B3 914794 2 PASS / 0 FAIL / 0 SKIP, pageerror·관측 off-origin request0 | headless Edge/native fetch→actual app.inject/repository/service/fakeDB/ArtifactStore. 실제 로그인·served 서비스/PG·사용자 인수 아님 |
| 독립 source 검수 | 서버/SQL I2/M1·UI I3 및 추가 대상 혼합 모두 ADDRESSED, 추가 시험 C0/I0 | 정적 검수, 실제 PG 권한/제약 PASS 아님 |
| 최종 지문/비의미 정리 | 23파일 hash 일치, 이전 검수/실행21개는 EOF suffix만으로 old hash 복원, 제품15파일 불변·기존 DOM14552bytes 보존 | [SourceManifest](../../work_packages/FN01_DRAFT_ARTIFACT_SOURCE_MANIFEST.json) 참조 |

실행 명령은 node --test tests/browser/UI02/draft-artifact.spec.ts다. 추가 loader/의존성 설치는 없었다. 실제 파일 시험은 같은 바이트를 unit에서 integration으로 분류했으며 사례 삭제·skip·기대/timeout 완화는 없다. 이전 명령/지문과 EOF 후 지문을 구분했다.

## 실패와 보완 이력

- 초기 Main c23d47은 실제 인증·초안 GET200 뒤 업로드404≠201로 RED였다.
- A1 b878e5/05315b에서 신규 게시 파일의 O_RDONLY fsync가 Windows EPERM으로 실패했다. 새 DRAFT 복사본에만 O_RDWR sync/read/hash/close와 파일 identity 검사를 적용했다. 오류 무시·ACL/권한 변경·기존 PROJECT adapter 변경 없이 A2로 재검증했다.
- B1 5e1499의403·remount·CSRF5반례 RED → 부모 보호 metadata 표시 snapshot/identity 보완 → B2 8b91c7의새초안 대상 혼합1반례 RED → 실제targetDraftId 결박 → B3 두 사례 GREEN이다. 기존6반례와 기대값/timeout은 유지했다. 앞선 실패를 소급 PASS로 바꾸지 않았다.
- 단일 구현 담당은 최종 제출 후 writer 소유권을 해제했다. Main이 관리·독립 검수·실행·문서·통합을 맡았으며 같은 제품 경로의 동시 writer는 없었다.

## 자원 정리

모든 instance는 생성 전 exact 경로·owner·수명30분·정리 방법을 등록했다. 기존 사용자 브라우저/DB/서비스를 사용하지 않았다.

| instance | 생성 UTC | 정리 UTC | 별도 확인 |
|---|---|---|---|
| A1 실패 파일 QA | 05:38:24 | 05:42:54 | 8cf6df root 부재/process0 |
| A2 파일 GREEN | 05:52:51 | 05:55:35 | 02148f root 부재/process0 |
| B1 원래5반례 RED | 05:59:56 | 06:03:04 | 334073 양root 부재/process0 |
| B2 추가대상 RED | 06:20:06 | 06:22:09 | b41d6b 양root 부재/process0 |
| B3 두사례 GREEN | 07:01:59 | 07:06:57 | 968a68 양root 부재/process0 |

날짜는 모두2026-10-26이다. 파일별 bytes/hash/owner·정리 시각은 같은 폴더의 FN01_DRAFT_ARTIFACT_QA_*_RESOURCE.json 및 *_INVENTORY.json에 보존했다. B3는378파일/133폴더·29280890bytes를 개별 정리했다. 임의 재귀삭제·다른 프로세스 종료·ACL 변경은 없었다.

## 남은 미검증·후속 범위

실제 PG 구문·FK/trigger·권한/직접DML·경합/실COMMIT, 정식 원문 root·계정/Secret·서비스 반영, 실제 socket abort·악성 symlink 생성·OS crash/디렉터리 fsync 내구성, 실제 로그인/TLS/사용자 인수·실 Agent는 미실행이다. pending0042는 실행 runner에 추가하거나 적용하지 않았다. 실행 권위가 아닌 [미적용 SQL source manifest](../../work_packages/FN01_DRAFT_ARTIFACT_MIGRATION_SOURCE_MANIFEST.json)를 남겼다.

현재 사용 가능한 served 화면으로 배포한 상태는 아니다. 후속 실제 반영/검증은 정확 실행 범위를 별도 대조하며, 이 제외를 이유로 다른 승인된 미완료 source 구현을 멈추지 않는다.

Rollback은 FN01 제품/시험23파일의 이전 상태를 복구하는 새 revert commit이며 실제 DB rollback 대상은 없다. 검수 문서·원문 이력은 유지하고 취소 사실을 추가한다. N4 WIP·보호8·무관 dirty/untracked와 main은 보존한다. 정확 게시 commit은 WORK_STATUS의 후속 Git 확인에 기록한다.

## 게시 바이트 구분

기존 .gitattributes와 core.autocrlf 정책에 따라23파일 중14개의Git저장blob은실제검증한작업파일과CRLF→LF만다르다. Main은모든blob이원문또는그LF정규화와정확히일치함을확인했다. SourceManifest의sha256은검증한작업원문,gitBlobSha256/objectId는게시저장바이트다. Git checkout의별도runtime검증은NOT_RUN이다. 실제실행원문과게시원문을같은raw SHA라고보고하지않는다.

신규Main JSON10개는-text 정책때문에CRLF가trailing whitespace로잡혀JSON값을그대로유지한LF포맷만정리했다. 역사fixture/원문JSON·제품/시험파일·Git설정·검사기준은변경하지않았다. 각문서의before/afterSHA와JSON값불변을SourceManifest.publication에보존했다.
