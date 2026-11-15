# FN08 원 Query 협력 중지 소비 — 소스 검증 결과

Primary가 `codex/av3-fn08-live-stop-consumer`에서 작업했다. 시작 HEAD는 `a86705e5f5364416d25f23c479df3058aab70e22`, WI는 `DD8CDAE675E1875C683175E06C8A83C171A5637D1A3AEEEEB3E20F3E4234E013`이다. 시작 시 미추적 WI만 있었고 Main의 문서·Git 작업과 쓰기 범위를 분리했다.

## 원 요청과 기존 이력

- 첫 SEND 정착 후의 원 worker·Query와 원 interrupt 메서드, 해당 생성 scope 및 owner가 미리 결박한 reader·strict store를 소비한다. STOP 아이템·부모 START·grant·등록·역할/세대·세션·stopScope·ownership을 기존 판독기로 확인하고, 별도 reader에서 commandRef·envelopeHash와 보호 projection을 읽는다. actor·정책·OS 서명/head의 운영 검증은 원 공급자의 책임이다. 합성 reader는 실제 등록이나 검증된 OS 소유권을 발급하지 않는다.
- 첫 행 STOP_ATTEMPTED는 원 저장 거래 안에서 엄격한 닫힘을 요구하고 append/sync 뒤 다시 읽는다. 거래 종료 후 현재성과 원 객체/메서드/기한을 다시 검사하고 같은 Query에 interrupt를 한 번 호출한다. 초기에 쓰기 body가 실제 실행되지 않은 채 거래가 반환해도 호출 0이다. 원 Query의 close와 수명 abort를 중지 요청으로 계산하지 않는다.
- 두 번째 행 STOP_UNCONFIRMED는 원 첫 행을 가리킨다. 직접 호출에서 spool에 남긴 STOP_REQUESTED만 전달한다. 보존된 두 행의 이력 투영은 기존 두 STOP_UNCONFIRMED 관측과 각자의 원 ref/시각이다. 호출 뒤 취소·늦은 반환 또는 spool 기록 유실 시 과거 시도행으로 STOP_REQUESTED를 재생성하지 않는다. 재시작은 원 spool 관측과 ACK만 복구한다. 200건 첫 batch와 세 STOP 관측이 있는 둘째 batch를 구분했고, 둘째 ACK 응답 유실 후 해당 batch를 그대로 재전달했다. 호출 횟수는 1, cursor는 0이다.

## 최초 WI의 검증 이력

| 명령 | 결과 |
|---|---|
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 tests/unit/FN08/normal-stop-coordinator.test.ts tests/unit/FN08/normal-stop-polling-journey.test.ts` | 29P/0F/0SKIP, exit 0, 44351.8696 ms. 11bbd0 → 4192ae |
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 tests/unit/FN07/normal-first-send-owner.test.ts tests/unit/FN08/normal-stop-target.test.ts` | 15P/0F/0SKIP, exit 0, 26171.1279 ms. 99d572 → fe8f13 |
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-name-pattern="CURRENT 생산자가 없으면 GET/저장412" tests/unit/FN08/normal-stop-command.test.ts` | 1P/0F/0SKIP, exit 0, 4257.5403 ms. dfa5ca. RAM 원 START·정책 검산 후 GET와 저장 모두 412 |
| `npm run typecheck` | 진단 0, exit 0. ae8208 → 65da65 |
| `node --test tests/desktop/native-proof-runtime-build.test.cjs` | 12P/0F/0SKIP, exit 0, 1952.1682 ms. b6b9f3. Vite 메모리 CJS 46 source·17 exports·builtin 4·2MiB 상한 |
| `git diff --check development/main` | exit 0. 3285cc. 추적된 전체 Stage 검사 |

첫 RED `node --experimental-strip-types --experimental-test-module-mocks --test --test-name-pattern="원 live Query에" tests/unit/FN08/normal-stop-coordinator.test.ts`는 exit 1(0P/1F, e8aa84)이었다. 기존 고정 source 형상에서 별도 STOP reader 결박을 거절해 첫 SEND가 UNKNOWN이었다. 같은 시험의 첫 GREEN은 exit 0(1P, 2abf54)이다. 새 fixture의 union 타입 오류 TS2339 1건(643cf1)은 실제 SEND operation을 확인해 해소했다. 쓰기 body가 생략된 store 반례 `node --experimental-strip-types --experimental-test-module-mocks --test --test-name-pattern="시도 쓰기 거래가" tests/unit/FN08/normal-stop-coordinator.test.ts`는 0P/1F(aee19d, interrupt 1), 실제 readback 완료를 확인한 뒤 1P(a0d193, interrupt 0)다. 중간 26P는 최종 직접 29건에 합산하지 않았다.

정상 STOP, source 미설정·빈 CURRENT, 다른 scope/owner/target/store, 만료·메서드 교체·취소, 첫 SEND 정착 전 STOP, 서로 다른 STOP의 재진입, close 불명과 lock 보존, interrupt 자체 오류와 늦은 반환, 1행/2행 역사, 부정형·손상·부분 관측을 검사했다. 실제 지원 목적은 호출 경계와 내구 시도·관측·ACK 구분까지다.

## r2 선점 보완과 최종 검증

지시서 r2 SHA256은 `4605D243EAA61615B284053483A0820FA6A3D872B75D66647DCEBFB235A323CF`이다. 최초 독립 검수에서 I1을 한 차례 확인했다. 원인은 exported 함수가 선점 전에 외부 item의 envelope getter를 실행한 뒤, 거절 경로에서 정상 호출이 잡은 선점까지 해제한 것이다. 최초 결과서 지문은 `EB4A6824A8AC155310EA5157CAE951BAE6D8B5A7382C2D042F3CF4E7408FEAD7`이었다.

LIVE·원 store·기존 선점을 확인한 직후 해당 호출의 비공개 토큰을 저장한다. 입력 두 객체는 기존 data snapshot 검산기로 복사한 뒤 읽는다. 시도 쓰기 전 실패는 자신이 계속 소유한 토큰만 해제하고, 쓰기에 진입한 시도는 토큰을 유지한다.

| 명령 | 수정 후 결과 |
|---|---|
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-name-pattern="선점 전 접근자" tests/unit/FN08/normal-stop-coordinator.test.ts` | c106bc 수정 전 0P/1F, exit 1. getter 1, 경쟁 명령의 현재성 판독 2, interrupt 2. c8dfc4 수정 후 1P/0F/0SKIP, exit 0. getter 0, 경쟁 판독 0, 정상 호출의 interrupt 1과 기존 2행 |
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 tests/unit/FN08/normal-stop-coordinator.test.ts tests/unit/FN08/normal-stop-polling-journey.test.ts` | 30P/0F/0SKIP, exit 0, 43839.4284 ms. cba8ea → ae95fe |
| `npm run typecheck` | 진단 0, exit 0. a6388d → 55d973 |
| `node --test tests/desktop/native-proof-runtime-build.test.cjs` | 12P/0F/0SKIP, exit 0. db23e0. 기존 46 source·17 exports·builtin 4·2MiB 상한 |
| `git diff --check development/main` | 추적된 Stage 공백 검사 exit 0. 43cc43 |

최초 WI에서 실행한 인접 15건과 기본 412 경로 1건은 앞 절의 이력이다. 이번 변경 파일의 최초 지문은 owner `2B0190B573D8CC835B42E2821D9ED77FAFB2C9BF88F4C3E9849D36A9A2A48EF7`, coordinator 시험 `7B6B57CD78457184DFF4FB752B2E5A2FD21B166229284A87E017C8290BFFC367`이다.

## 검수 지문

| 파일 | SHA256 |
|---|---|
| `apps/connector/runtime/normal-first-send-owner.ts` | `2C8BF9AB6D408A96EE3D26F25ED2522CE3CF5CDBDBFCF21DCCC075C23CB9E85A` |
| `apps/connector/runtime/normal-stop-coordinator.ts` | `30C67767A364BC97FB37C8CD039152A4E8D681C4A00E8637F3695F6A8928FEBC` |
| `apps/connector/runtime/normal-start-polling.ts` | `94E33C1DA4B5AD24764A73F5E617A5E145517523F89FCA824C2C56A1C5221512` |
| `tests/unit/FN07/normal-first-send-owner.test.ts` | `932CC09197D4888E2B56FA82C281FBD89B8478462863D9B8340647CA6F22D9D7` |
| `tests/unit/FN08/normal-stop-coordinator.test.ts` | `F891EF866C7F5CB6F0CA9D5369EB1E1B3D72BE646732F21BEB96D07F5866EE9A` |
| `tests/unit/FN08/normal-stop-polling-journey.test.ts` | `FE57DB37CBCA08045D1D40E896878D2DE213C980C31AA9CDF3D2E0BA492D3D8E` |

## 미검증·복구

실제 CURRENT·독립 OS 서명/계보 reader, 원 SDK module/hook/Query·native 보호배정과 실설치는 미구현이다. 기본 서버 GET/저장 412 및 실제 공급자가 없는 로컬 OWNER_UNAVAILABLE의 동작은 유지한다. 실제 종료/OS handle 회수/writer 해제·후속 SEND 양성 종단은 미검증이다. 실제 DB·권한·키·사용자/백업 파일 조사·서비스·SDK/Agent/C#·추가 SDK 조회·P03 실행 0이다.

복구 범위는 위 6개 파일과 이 결과서다. Main은 통합 commit을 정상 revert해 기존 STOP 이력 판독과 첫 SEND 기준선을 복구할 수 있다. 기존 저장형상·공개 사건·서버·SQL에 변경은 없다. WORK_STATUS와 Git 통합은 Main이 관리한다.
