# A-3 소스 관측 권한 경계 결정자료

상태: Main의 다음 업무 구체화·결정 요청용. 구현/DB/실제파일/credential 발급 승인 아님. 기준 checkpoint 4d6821859ccaf0c9754da66bf3e066b007801e2a, WORK_PLAN FN01/FN06/FN08, 설계 §9.1/10.2.1, SourceScopeV1.

## 확인 사실과 목적

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

UI10의 기존 대화 원문을 현재 지식 초안의 출처로 명시 추가하는 연결을 검토한다. 기존 ConversationView/readConversationMessage의 정확 ref/hash와 기존 지식 저장 API만 소비하고 본문·제목·이유·기존 출처/dirty/pending을 보존한다. 새 API/DB·정책/실서비스 변경이나 Agent 전달은 하지 않는다. 이 작업의 착수/검수는 Main이 책임지고 PMO 다음 배정을 기다리지 않는다.
