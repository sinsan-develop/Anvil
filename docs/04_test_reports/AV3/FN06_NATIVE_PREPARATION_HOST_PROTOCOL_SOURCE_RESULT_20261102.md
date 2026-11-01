# FN06 native 준비 r2 A — 서버 protocol·connector 통합 source 결과

2026-11-02 / Main 어울 / **source 검수·통합 · Web 및 실제 공급자 후속**

## 기준과 commit

채택 r2 A `5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085`와 직접 승인 `FN06_NATIVE_PREPARATION_R2_A_SOURCE_APPROVAL_20261102.md`, WI `3905A46EEE54AF75C1971C66A51A8D1AB5E6F2EA439462F4192F53FDA151C1F6`를 따른다. 기존 Primary가 구현하고 Main은 제품 코드를 수정하지 않았다.

- 시작 기준 `be2dbd751b30ed8d7646358ddc8eb49d34829df1`에서 `086df26372d9d5e979a6b0f54ec05963e4808d10`으로 정확9경로·177추가/24삭제를 commit했다. Main `f0cb67`에서 raw/staged blob9 일치를 확인했다.
- UI 소비에서 확인한 HUMAN 오류·결정적 시험과 공급자 독립 역사 조회를 `a677f89fcb6a0a5800d8a82d3102eed3898303eb`의 정확3경로·11추가/4삭제로 보완했다. Main `a7082f`의 raw/staged blob3 일치·diff0을 확인했다. 세 경로는 앞의9경로 안에 있다.
- 변경9경로는 `contracts/runtime/native-preparation-authority-v1.ts`, `apps/server/modules/executions/`의 `project-native-preparations.ts`·`native-preparation-store.ts`·`native-preparation-routes.ts`, `db/migrations/0071_native_preparation_authority.sql.pending`, `tests/unit/FN06/`의 `native-preparation-authority-contract.test.ts`·`native-preparation-store.test.ts`·`native-preparation-routes.test.ts`, `apps/connector/runtime/native-preparation-client.ts`다. client 변경은 빈 query 정규형 `[]`→`{}` 한 상수이며 다른 connector3는 불변이다.

## 연결한 동작

- 새 목적 bearer의 digest로 원 authority를 읽고 현재 HUMAN 세션·OWNER·제어·정책·등록·원 proof를 저장 transaction 안에서 검산한다. host bearer를 HUMAN 세션 토큰으로 위장하지 않는다.
- current/challenge/consume의 정확 wire·빈 query·전용8필드 proof와 P256 P1363 header·nonce/본문/목적 결박을 검사한다. challenge 원문 재조회는 원 nonce를 보존한다.
- 첫 소비는 proof·receipt·CONSUME_COMMITTED를 같은 Tx에 저장하고 permit 응답 자료를 준비하고 COMMIT 성공 확인 뒤에만 FIRST_COMMIT/첫 permit을 반환한다. 같은 원 요청은 원 receipt와 null permit이며, writer ACTIVE 상태 전이 뒤의 원 replay도 새 권위가 아니다. 공급자 현재성·기한·COMMIT 불명·등록 회수·한도·경합을 구분한다.
- 보호 비밀은 별도 인자로 전달한다. 정상 응답·일반 이력에는 비밀과 credential digest를 싣지 않고 DB 보호 열에는 digest만 남긴다. DELIVERY_ATTEMPTED의 commit 뒤 공급자를 최대 한 번 호출하며 timeout·응답 유실과 원 replay는 재전달하지 않는다. 공급자 미정착·COMMIT 불명은 성공 회수로 표시하지 않는다.
- 같은 원 튜플로 실제 HUMAN 생성 코드→Fastify inject→공개 시험 키 signer→실제 connector→PREPARED/소비/ATTEMPTED/ticket→fake factory1을 연결하고 명시 재시도의 추가 호출0을 확인했다. 실제 네트워크/물리 factory는 아니다.
- HUMAN POST의 기존 승인 필요412·불필요422 등 허용된 공통 오류 의미와 6필드 DTO를 보존하고, host의 native2필드 enum은 유지한다. 미분류/모순 오류는 비밀 없는503으로 닫는다.
- HUMAN 고정 조회의 read 정책 없음·타 프로젝트는404로 은폐한다. 현재 인증·OWNER·제어·read 정책·원 proof 복원은 유지하면서 생산 공급자 부재/교체가 보관 이력을 막지 않게 했다. fresh 공급자 없이는 UNAVAILABLE이며 options/prepare/host 새 행동은 계속 거절된다.
- 0071의 typed8종 사건·원 연결·한 번 전달/소비·역검산·유한 cap/RLS false를 작성했다. 원 SQL들은 바꾸지 않았고 0071도 적용하지 않았다.

## 실행한 검증과 해석

Main `e53b16`:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test --test-name-pattern='^(B |HUMAN 고정 조회|실제 HUMAN 원명령)' tests/unit/FN06/native-preparation-authority-contract.test.ts tests/unit/FN06/native-preparation-store.test.ts tests/unit/FN06/native-preparation-routes.test.ts
& 'C:\Program Files\nodejs\node.exe' --test tests/unit/FN06/native-preparation-client.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

선정 서버 **24PASS/9117.456ms**, client **14PASS/420.1901ms**, FAIL/SKIP0. session61274 최종 `23b2c1`에서 type/diff0·당시9SHA 일치를 확인했다. 서버24는 이름으로 선정한 범위이며 파일 전체 통과가 아니다. 이전 A/connector 실행 수치를 더해 새 고유 시험 수로 보고하지 않는다.

추가 영향 검사 `d9ff6f`는 부정 패턴의 의도와 다르게 B까지 포함해46건을 실행했고 `46b585`에서 **45PASS/1FAIL/26913.371ms**였다. 실패는80ms 안에 전달 공급자에 진입한다고 가정한 시험 준비 경계였다. 제품 예산·단언·skip을 바꾸지 않고 시험 clock/scheduler를 소유해 실제 포트 진입→같은80ms 만료를 검증하도록 고쳤다. 동일 코드의 단순 재시도로 숨기지 않았다.

후속 Main `4adfe7`은 이름을 명시한 `HUMAN native|HUMAN 고정 역사|B delivery timeout|B host 입구`를 NativeStore 시험에서 선정해 **5PASS/6801.8528ms/FAIL0/SKIP0**, 수정3SHA·diff0을 확인했다. 승인412/422·unknown sanitize·host 오류 보존·결정적 timeout·공급자 없는 역사 조회 범위다. 이5건에 겹치는 앞선 시험을 중복 합산하지 않는다. Primary의 후속 전체 type0은 해당 제출 시점의 별도 증거이며 현재 Web 작성 중이므로 전체 최종 type/build는 Web 검수 때 다시 확정한다.

암호 양성은 [RFC 6979 A.2.5](https://www.rfc-editor.org/rfc/rfc6979.html#appendix-A.2.5)의 공개 P-256 시험 수치를 메모리로 가져온 합성 서명이다. 새 키 생성/실키 파일 접근0이며 실제 키·TLS·보호 발급자 검증이나 RFC6979 결정적 nonce 구현 검증이 아니다. Main `770b03`에서 해당 공개 상수는 시험 파일에만 있고 제품 파일에는 없음을 확인했다.

## 독립 검수와 주요 지문

동결B9의 독립 C0/I0와 시작·끝 SHA 일치, SQL 단독 정적 C0/I0를 받았다. HUMAN 오류/결정적 시험2경로와 역사 보완3경로도 scoped C0/I0다. 시험의 최초 동결 뒤 타입 annotation 보정으로 지문이 바뀐 사실은 보존하며, 이전 실행 결과를 새 바이트의 실행으로 소급하지 않았다. 최종3경로는 Main5건과 실제 읽은 지문으로 대조했다.

- coordinator `BC2D910DC809E9FF7A75DCE31CE3AE0B30DBEDD6AAF18FADCC7A4E9F9F1FA678`
- routes `ABC73EE892E9F0B9B91E3073D2B64E2000BC733D4530632A54AED041B341B7D2`
- store 시험 `949E46EFFE88407CDE20F35963E6C908F42109569AC6B691AD51CCE70A89DE7F`
- SQL `167FC4CF61992C4BFA97871089BAFEDD9B22CC6B74DF294C52001DC47D7AA33A`

## 남은 범위·복구

Web 연결은 후속 작성 중이다. 실제 보호 issuer·키/TLS 채널·내구 local journal·물리 native factory/강제·회수·writer bootstrap 및 actual START/SEND/STOP/ACK의 공급자 구현·실측이 남았다. 인터페이스·합성 source의 성공을 실제 공급자 구현 완료나 `PASS`로 바꾸지 않는다.

실제 PG 구문/trigger/RLS/OID/동시성, 실제 DB·권한·키·CA/TLS·서비스·OS/native/helper/compiler·Agent·실자료/백업 파일 조사·P03 R3는 NOT_RUN이다. 현재 서비스 반영·사용자 인수·전체 FN06/FN08/계획 완료를 주장하지 않는다. 복구는 해당 source commit의 정상 revert이며 미적용 SQL의 down/자료 삭제는 하지 않는다. 보호 자료·별도 UI 진행 파일을 보존하고 main 병합·배포0을 유지한다.
