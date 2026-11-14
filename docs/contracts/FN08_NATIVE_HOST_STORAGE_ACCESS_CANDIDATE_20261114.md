# FN08 native host 저장 접근 — 한정 결정 후보

상태: **채택 — 2026-11-14 신산님 직접 A안 계약·source-only 구현 승인**. 승인 대상 원문 SHA256 `A185C52DAD309718845F3DB40D2B1AC0F7E60ABB83FADACD243E9CABE750B00E`. 독립 C0/I0 및 경미 문구 보정 후 채택. 아래 후보 표현은 결정 당시 이력이다. 코드·미적용 SQL·합성 검증만 허용하며 실제 DB·권한 적용·키·프로세스·서비스·Agent 실행은 제외한다. Main 작성, 원 기준 main `34f613a03c9e6edf0e96f3096aad86e3c3d4aede`, 구현 기준 PR107/main `b2df4dcff3405d5f33a52d6be20e07358fbbdea9`.

## 1. 문제와 필요한 결정

준비 권위 v2와 관측 반환 저장 형상은 채택됐지만, 실제 서버의 `anvil_v3_app` 호출자가 그 저장소에 접근하는 권한 계약은 없다. `ProjectNativePreparations.#hostRun`의 최초 credential digest 조회부터 기존 false RLS/app REVOKE에 막힌다. 반환 결과 INSERT만 연결해서 해결되지 않는다. RAM 저장소 시험은 이 접근을 증명하지 않는다.

권장 A안은 기존 app Pool을 유지하고, 아래 목적에 한정된 보호 함수의 실행 계약을 추가하는 것이다. app의 직접 표 SELECT/INSERT 확대, migrator Pool 사용, 범용 event append, 호출자가 제출한 `verified=true`만 믿는 허용은 제외한다.

이번 결정 후보는 코드·미적용 forward SQL·합성 검증만 대상으로 한다. 실제 DB 접속·migration 적용·역할/권한 부여·키·프로세스·서비스·Agent 실행은 제외한다.

## 2. 정확한 기능 범위

기존 공개 HTTP 형상과 응답은 유지한다. 다음 다섯 host 경로와 §3.2의 receive 선행 접근 공백을 대상으로 한다.

- `/api/v1/connector/native-preparations/:authorityId/current`
- `/api/v1/connector/native-preparations/:authorityId/challenges`
- `/api/v1/connector/native-preparations/:authorityId/consume`
- `/api/v1/connector/native-preparations/:authorityId/ownership-requests`
- `/api/v1/connector/native-preparations/:authorityId/ownership-results`

| 목적 | 허용 입력과 반환 | 보호 함수가 검산할 원 근거 |
|---|---|---|
| 원 host 권위 복원 | authority ID·credential digest·정확 목적·거래 식별 → 해당 원 권위와 한정 이력 | 저장된 credential 결박, 원 subject/session/client/control·등록·writer·정책·기한 및 원 command/receipt/audit |
| challenge 발급 | 원 권위·원 요청·정확 target/attempt → 기존 challenge | 현재 권위, 기존 단발·용량·순번 제한. CHALLENGE_ISSUED만 허용 |
| consume 확정 | 원 challenge·proof·정확 consume body → 기존 receipt | 원 proof/nonce/등록·현재성·일회 소비. 지정 두 event만 원자 저장. 동일 replay는 factoryPermit=null 유지 |
| ownership request | 원 v2 authority/consume/attempt·requestId·process 후보 → 기존 binding/request/candidate | 저장된 원 consume와 동일 실행·세대·등록·sourceScope·원 head. process 후보 자체는 OS 진위 근거가 아님 |
| ownership accept | 원 binding/request·서명 packet → 기존 receipt/observation/head | 원 nonce·서명·현재 권위·정확 부모·expected head·동일 packet replay·원자 완결 |

일반 HUMAN 직접 발급(`receiveArm=null`) 및 일반 HISTORY 조회는 이 후보에 포함하지 않는다. 기존 0076 receive 전용 발급/보호 전달의 인터페이스·의미는 유지한다. 다만 아래에서 확인한 native 두 표의 선행 definer 접근 공백은 이 후보의 추가 권한 결정에 포함해야 한다. 이 제한 때문에 일반 HUMAN 발급 전체가 사용 가능해졌다고 보고하지 않는다.

receiveArm이 있는 기존 HUMAN 명령은 기존 receive 권한 아래 유지한다. 이를 일반 HUMAN 발급 제외와 혼동하지 않는다.

## 3. 권한·저장·거래 경계

- 새 함수의 실행 주체와 EXECUTE 대상은 명시적으로 고정한다. 기존 0076과 같은 `anvil_v3_migrator` 소유 SECURITY DEFINER 방식을 재사용하는 후보이며, 새로 최소 표 권한만 가진 principal을 만드는 것으로 표현하지 않는다. 호출 함수 표면과 내부 연산을 한정하며 app에 일반 표 권한을 부여하지 않는다.
- 원 session/control/registration/command/receipt/audit 검산에 필요한 종속 읽기·기존 보호 함수 호출도 후속 권한표에 열거한다. 그 자료를 app의 일반 조회로 노출하지 않는다.
- 함수별 허용 목적과 원 DB 근거를 확인한다. 호출자 Boolean·임의 GUC·임의 JSON만으로 권한을 만들지 않는다. 보안 함수의 고정 search_path와 한정 입력·출력, PUBLIC 실행 거절을 유지한다.
- 기존 동일 PoolClient 거래 안에서 프로젝트 잠금 → authority/실행 head 대조 → 순번/용량 검산 → 원자 삽입을 유지한다. 없는 head에 대한 FOR UPDATE만으로 경쟁이 막혔다고 간주하지 않는다.
- 함수 내부 독립 COMMIT은 금지한다. 기존 최종 현재성 확인과 확정 COMMIT 뒤 응답을 유지하고, 결과 불명은 자동 재시도하지 않는다.
- native authority/events와 반환 bindings/results, ownership events/observations/anchors/heads의 지정 읽기·삽입만 대상이다. UPDATE·DELETE·일반 목록 조회는 추가하지 않는다.
- 0071 native guard, 0092 부모/graph/불변·완결 guard는 보존한다. 0039 ownership_unavailable와 false RLS의 예외는 위 정확 목적·원 주체 검산에만 한정한다. 기존 synthetic/다른 ownership 쓰기는 계속 거절한다.
- 과거 migration은 변경하지 않고 새 forward SQL에 정의한다. 아래 후보 시그니처·실행 주체·권한표·변경 파일 목록은 독립 검토와 채택 전 최종 고정한다.

### 3.1 보호 함수 후보와 신뢰 경계

다음은 신규 후보명이며 모두 jsonb를 반환한다. `purpose`, 입력 JSON, proposed/ids의 키 집합은 각 연산에 필요한 고정 값만 허용한다. 자유 event JSON은 받지 않는다.

| 후보명 | 인수 |
|---|---|
| native_host_material | authority_id uuid, digest text, purpose text, expected_tx text |
| native_host_challenge | authority_id uuid, digest text, input jsonb, proposed jsonb, expected_tx text |
| native_host_consume | authority_id uuid, digest text, proof jsonb, signature text, body jsonb, ids jsonb, expected_tx text |
| native_host_ownership_request | authority_id uuid, digest text, input jsonb, proposed jsonb, expected_tx text |
| native_host_ownership_accept | authority_id uuid, digest text, packet jsonb, ids jsonb, expected_tx text |

`anvil_v3_app`에는 위 정확 함수 실행만 제안하며 PUBLIC과 app의 내부 helper 실행, 대상 표 직접 접근은 거절한다. 새 LOGIN/Pool·app의 SET ROLE은 추가하지 않는다. material은 원 SPKI/challenge/request와 제한 근거를 반환하고 credential digest는 출력하지 않는다. IDs/nonce 후보는 기존 길이·정규형을 검산하고, event/receipt/graph는 원 DB 행과 후보의 고정 필드에서 구성한다.

**Node ECDSA verifier는 기존과 같이 신뢰 구성요소다.** 기존 0076처럼 Node가 원 material로 ECDSA 검산한 뒤 동일 DB 객체·query·거래·기한에 결박된 WeakMap 일회 lease를 저장 wrapper가 소비한다. SQL은 Boolean이 아니라 원 material·hash·현재 DB 상태·거래·전이를 재검산한다. DB 내부 ECDSA 재검증을 추가하는 후보가 아니다.

따라서 임의 SQL을 실행할 수 있는 app 자체가 침해된 위협까지 독립 암호 검증으로 방어한다고 주장하지 않는다. 가짜 서명을 형식만 맞춰 직접 SQL로 제출하는 공격은 SQL의 원행/해시 대조만으로 식별되지 않는다. 이 위협의 독립 방어가 필요하면 DB 암호 검증 또는 별도 위조 불가능 검증 권위가 추가로 필요하며 이번 기존 신뢰 경계 재사용으로 달성했다고 보고하지 않는다.

### 3.2 기존 receive 발급의 선행 접근 공백

0076은 설치의 current_user/session_user와 각 함수 OWNER를 `anvil_v3_migrator`로 고정한다. receive 자체 7표에는 이 역할의 정책이 있지만, 0071 native authority/events는 FORCE RLS·false 정책이며 기존 receive 생성 함수가 이 두 표에 쓸 수 있도록 여는 정책을 migration 소스에서 확인하지 못했다. 0073의 FN15 reader SELECT는 이를 대신하지 않는다.

개발 역할 생성 원형은 NOSUPERUSER이며 BYPASSRLS 부여 근거가 없다. schema 소유/SECURITY DEFINER라는 이유만으로 FORCE RLS가 우회된다고 가정하지 않는다. 실제 설치 역할·DB 상태는 조회하지 않았다.

따라서 새 미적용 권한표에는 native 두 표의 선행 definer 접근, return 두 표의 definer 접근, ownership 표의 접근과 차단 trigger 예외를 각각 명시한다. 기존 receive 함수는 재사용 가능한 인터페이스이지 실제 DB 저장 완결 증거가 아니다. 세션 GUC나 app가 제출한 Boolean을 함수 경로의 증거로 삼아 차단을 해제하지 않는다.

## 4. 재사용과 검수

0076의 native_receive_native_create, native_receive_binding_material/history, native_receive_native_material은 기존 receive 목적에만 재사용한다. 0073의 project ID 부재 확인용 reader는 이 저장 권한을 대신하지 않는다.

receive 발급에서 v2를 사용할 때는 현재 별도 보완 중인 서버 소유 버전의 예약·용량·delivery 정합 검수를 선행한다. 기존 v1 예약 상한만으로 v2 연결을 완료했다고 판단하지 않는다. 이 계산 보완은 새 DB 실행 권한/RLS 예외를 부여하지 않는다.

필수 합성 검수는 잘못된 digest/목적·다른 프로젝트/사용자/client/세대·만료/회수·원 command/consume 불일치·다른 packet·동시 head/순번 충돌·부분 저장/COMMIT 불명·일반 event append 거절을 포함한다. v1은 반환 권한을 얻지 않는다. 기존 #hostRun의 만료 거절을 유지하며 만료 후 host replay를 새로 허용하지 않는다. 허용된 동일 요청 재조회도 신규 nonce나 실행 권한을 만들지 않는다.

SQL 정적/합성 검수와 실제 PG 함수/RLS/동시성 검증을 분리한다. 실제 PG 검증은 이번 후보의 실행 승인 범위가 아니며 미검증으로 남긴다. 이 기능은 START/grant/resume 또는 Agent 실행 완료를 뜻하지 않는다.

## 5. 읽기 조사 근거

- `apps/server/modules/executions/project-native-preparations.ts`: #hostRun의 첫 권위 조회 및 hostCurrent/Challenge/Consume/OwnershipRequest/OwnershipResult.
- `apps/server/modules/executions/native-preparation-store.ts`: read/#restore/capacity/append와 일반 발급·receive 발급 분기.
- `apps/server/modules/executions/native-preparation-ownership-return-store.ts`: request/accept의 원장·head 삽입.
- `apps/server/modules/executions/native-preparation-routes.ts`: host Bearer와 HUMAN session/CSRF 경로 구분.
- 기존 0039/0071/0073/0076/0092 SQL. d2_preflight 읽기 조사, 실제 DB 실행 0.

대안 B인 새 저장 principal은 인증·Pool·거래 경계를 더 늘리므로 현재 후보에서 권장하지 않는다. A안 채택 전에는 새 EXECUTE나 deny 예외가 승인됐다고 취급하지 않는다.
