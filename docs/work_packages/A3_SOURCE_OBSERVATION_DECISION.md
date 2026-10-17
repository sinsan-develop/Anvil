# A-3 소스 관측 권한 경계 결정자료

상태: Main의 다음 업무 구체화·결정 요청용. 구현/DB/실제파일/credential 발급 승인 아님. 기준 checkpoint 4d6821859ccaf0c9754da66bf3e066b007801e2a, WORK_PLAN FN01/FN06/FN08, 설계 §9.1/10.2.1, SourceScopeV1.

후속 결정: 2026-10-17T13:07:30Z PMO가 실제 게시12:56:17Z 이후11분13초·직접답변/중지/거절 부재를 대조하여 권장 A를 상세설계 기준으로만 적용했다(AV3-PMO-A3-READ-OBSERVATION-DESIGN). 아래 요청은 그 결정 전 원문이다. 상세 계약은 docs/contracts/SOURCE_READ_OBSERVATION_A3.md이며 실제 API/SQL/credential/키/native/소스/Agent/서비스 실행 승인으로 확대하지 않는다.

## 확인 사실과 목적

상세 r2 보정: 독립 문서 검수 C0/I1/M1의 root 경로 전달과 시각 규칙 누락을 직접 대조했다. 신규 보호 /permit·서버 exact snapshot/hash→scope.pathHintHash→connector 원 경로 단일입력, 주장 시각/서버 receivedAt·30초 오차/관측 창·서버 기한 무관용을 추가했다. 다른 OWNER 원문·VIEWER/일반 receipt·로그 비노출, 기존 token 무확장·OS UNVERIFIED/dispatch false는 유지한다. 보정 scoped 확인은 재실행 검증/제품 완료가 아니다.

Anvil이 기존 코딩 Agent에 실제 작업을 맡기려면 정확한 소스와 허용 범위·시작 지점을 확인해야 한다. Dashboard/일반 관제 기능을 추가하는 업무가 아니다. A-2R의 source_roots/source_root_versions는 USER_DECLARED/UNVERIFIED 선언이며 파일 grant/관측/시작 baseline이 아니다.

현재 registration-protocol.ts의 발급·status 검사는 scope=REGISTRATION_STATUS_ONLY, grants=[]로 결박한다. TRUSTED 표시나 ACTIVE_STATUS_ONLY를 소스 접근 권한으로 승격할 수 없다. SourceScopeV1은 observationRef와 baselineRef를 모두 요구하므로 첫 읽기 관측 자체를 기존 Agent dispatch envelope로 실행하면 선행이 순환한다. 실제 소스 확인용 별도 읽기 관측 계약이 필요하다.

## 권장 결정 A — 읽기 관측 권한을 별도 계약으로 설계

- 현재 등록/상태조회 credential은 그대로 두고, SOURCE_OBSERVE_READ_ONLY를 별도 scope와 교환 절차로 설계한다. 기존 token/grants를 넓히지 않는다.
- 주체는 현재 신뢰 등록의 connector/등록세대/host와 현재 OWNER·client·제어/credential 세대다. 프로젝트·선언의 exact root/version/hash·정확 상대 FILE 목록(최대200, recursive=false)·목적·현재 정책/명시 허가·유한 기한을 결박한다. TTL 상한은 기존2시간 이하이며 실제 실행 창은 별도 고정한다.
- 첫 관측 권한에는 observationRef/baselineRef를 요구하지 않는다. 대신 선행 미확인 상태와 대상 선언 ref를 고정한 별도 관측 요청으로 구별한다. 이를 SourceScopeV1의 Agent 실행 허가로 사용하지 않는다.
- 등록 위치의 문자열 선언과 실제 host/경로/파일 정체성·Git 관측을 별도 불변 기록으로 연결한다. 기존 선언/관측을 덮거나 USER_DECLARED를 소급 승격하지 않는다. 파일본문·diff/Secret 수집은 첫 관측의 기본 범위가 아니며 필요한 항목만 후속 명시한다.
- 서버의 현재 권한/중복/기한·root 철회/개정 대조와 관측의 출처·정확 버전/hash를 저장한다. 서명된 보고와 실제 OS에서 검증한 사실은 분리하고 OS 미확인 보고로 write-ready/baseline 확정을 만들지 않는다.
- 별도 credential 발급/교환/회수·저장 보호, 새 테이블/정확 SQL·관측 wire·OS 소비자는 이 결정 후 상세 계약에서 정의·검토한다. 이 결정자료가 그 코드/DB 실행을 승인하지 않는다.

장점: 상태조회 권한을 보존하면서 실제 작업의 소스 권한을 최소 범위로 확장할 수 있다. 영향/위험: 새 권한·비밀 수명 계약과 실제 host/currentness 검증이 필요하다. 관측을 신뢰해도 파일교체경합/악의적 같은 사용자까지 보호됐다고 주장하지 않는다.

## 대안

B. 기존 등록을 폐기하고 소스 읽기까지 포함한 통합 등록으로 재설계: 단일 교환 흐름이지만 현재 동작·credential/공개 API가 바뀌고 재등록·회귀가 커진다. 현재 상태조회 token을 그대로 재사용하는 방식은 제외한다.

C. READ/WRITE·실제 Agent·중지/회수를 한 번에 설계: 최종 제어 흐름을 한 번에 볼 수 있지만 관측 선행과 OS/권한·비용·복구의 검증 범위가 커져 다음 실제 기능 연결이 늦어진다.

## 이번 필요한 정확 결정

권장 A를 A-3 상세 계약의 기준으로 사용해도 되는지 결정 요청한다. 이번에는 문서/계약 설계만이며 새 공개 API/DB schema·credential/키·ACL/native helper·실제 소스 접근/Agent 호출·서비스/Oracle/main 변경은 실행하지 않는다. 상세 계약의 payload/endpoint/SQL·실행 자원이 고정되면 필요한 실행 변경만 다시 정확 제시한다. 거절/보완 시 기존 A-1/A-2R을 보존하고 실제 dispatch는 닫힌 상태를 유지한다.

## 승인과 무관한 Main 병행 작업

아래 UI10 대화 출처 연결은 이후 ff385ace0330dbe91a04910e165eb0e7427104c6에서 후보 구현·한정 검수/정리까지 기록한 과거 선정이다. 다시 착수/시험하지 않는다. 다음 업무는 Main이 현재 계획과 실제 상태에서 선정하며 PMO가 배정하지 않는다.

UI10의 기존 대화 원문을 현재 지식 초안의 출처로 명시 추가하는 연결을 검토한다. 기존 ConversationView/readConversationMessage의 정확 ref/hash와 기존 지식 저장 API만 소비하고 본문·제목·이유·기존 출처/dirty/pending을 보존한다. 새 API/DB·정책/실서비스 변경이나 Agent 전달은 하지 않는다. 이 작업의 착수/검수는 Main이 책임지고 PMO 다음 배정을 기다리지 않는다.

## 다음 필요한 결정 — 상세 계약의 제한된 구현 (현재 미승인)

결정 대상 상세 문서는 r2 SHA256 `095B5FEFDBB2F903415AE404CC97D50FB585D1696FA6468CBFC91E805464D035`다. 독립 최초 C0/I1/M1 뒤 원 두 지적 보정에 대한 scoped 확인 C0/I0/M0를 받았으며 전체 계약·실제 구현/SQL/OS 검증 판정은 아니다. 다음 권장 A는 아직 결정 전이다.

목적은 UI11에서 관측 요청/조회/회수와 서명 보고 보관을 실제 기능으로 연결할 후보 코드를 만드는 것이다. 이 결과만으로 실제 소스/Agent 실행·실OS 안전·기준선 확정을 주장하지 않는다. 기존 계획의 다음 업무 선정은 Main 책임이며 다음 배정/재착수 허가를 요청하는 문서가 아니다. 새 인증·공개 연산·자료 계약의 **구현 변경**만 분리해 결정 요청한다.

**권장 A:** SOURCE_READ_OBSERVATION_A3.md r2의 유한 계약을 기준으로 FILE_MAP의 신규 wire/서버·UI11과 새 forward SQL 파일 1건을 작성하고 로컬 좁은 TDD·인접/type/build·후보 합성 browser 검수까지만 진행한다. 새 SQL은 `db/migrations/0008_source_read_observation.sql` 46번째 후보·신규4표만이며 기존45 SQL/정식DB/자료·등록/실사용자 정책은 변경0이다. 현재 SQL 파일/내용/hash는 없으므로 이를 적용 승인으로 요청하지 않는다. 등록 key를 사용하지 않는 시험 전용 P-256 키/합성 token은 메모리에서만 생성·검증·폐기하고 보호 key/기존 token/일반 스풀에 접근하지 않는다. bearer 신규 발급 경로의 코드/합성 시험일 뿐 실제 등록 credential 발급이 아니다.

후보 화면 검수 예정 자원은 Windows `D:\tmp\anvil-v3-stage-b\browser\ui11-source-read-01`의 dist/results/temp/config.mjs만이다. Main 소유·새 root 부재/부모 owner/nonlink 확인 후 생성·이번 검수 종료 또는2시간 이내 exact 목록/owner/link/process 대조 후 제거·독립 잔여0이다. 기존3830/서비스/CA/계정·실사용자 자료는 사용·변경하지 않고 후보asset·합성 API만 쓴다. 아직 이 root/시험자료는 생성0이다.

구현 후 정확 commit·SQL hash·독립 C/I·좁은 검증/미검증을 먼저 보존한다. **격리 actual PG 실행·정식 schema-only 적용·native 파일/컴파일/OS probe·key/ACL/DPAPI·실제 경로 관측·Agent/서비스/Oracle/main 변경은 이 요청에서 제외**한다. 그때 필요한 실행만 exact SQL/image·literal 자원·보호/복구·전후 gate로 별도 결정한다. 검증은 현재 합성 범위를 actual PG/served/OS PASS로 올리지 않는다. rollback은 후보 코드 일반 revert 검토·신규 합성 자원만 정확 정리이며 기존 DB/자료 reset0이다.

**대안 B:** wire/서버 후보와 SQL 초안만 먼저 작성하고 UI를 뒤로 둔다. 권한 계약을 좁게 볼 수 있지만 화면 처리·저장/조회 연결이 늦고 별도 재결정이 늘어난다. **대안 C:** native/actual PG/정식 DB·실제 source까지 한 번에 결정한다. 한 번에 최종 경로를 볼 수 있지만 아직 없는 SQL/helper의 정확 hash·OS 위험을 추측 승인하게 되므로 권하지 않는다.

PMO에 필요한 정확 답은 권장 A의 새 코드/공개연산·SQL **작성과 합성 QA만** 진행 가능한지 또는 바꿀 구체 범위다. 현재 상세설계 기준 결정은 이 구현 권한을 포함하지 않는다. 결정 전 Main은 독립적인 기존 승인 업무를 계속 선정하되 A-3 코드·DDL파일/DB/credential/native/실소스는 실행하지 않는다.
