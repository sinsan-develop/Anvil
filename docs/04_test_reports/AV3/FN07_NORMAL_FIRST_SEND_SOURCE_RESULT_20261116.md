# FN07 첫 SEND의 원 입력과 SDK init 결합 — 소스 검증 결과

단일 작성자 Primary가 `codex/av3-fn07-normal-query-output`의 `4fdfebe000b4e6abbd0fd87528d69a45a3cbb243`에서 구현했다. 채택 계약은 `86A46140DADB38CB31C9B94957E5C836532ACE8093B10A062622B3FE93E7EC9E`다. 최초 WI `48AE0FA94457997C50BC31CB19F1B929E66BF158452DF2C0C394BD388BFB92C9`의 두 조건을 r2 `3D78C767CA30FD04F299994F5C91CD7CE15260BC8B748620D943656EBCD45C64`에서 명시했다. 생성 전 계획 SID digest와 입력 iterable 전체의 1회 제공을 RAM에서 검산했다.

## 원 호출에서 바뀐 동작

- 신규 START 준비가 strict close와 후행 기한 검산을 마친 뒤 같은 worker에만 준비행·원 START 자료·grant를 결박한다. 첫 SEND가 세 번째 dispatch 행을 append/sync/재판독한 뒤 원 ticket으로 슬롯을 소비한다. 원 자료·Options·지시 bytes, 세대 및 보호 scope를 생성 요청에 전달한다.
- 첫 입력을 실제로 내준 증거와 같은 Query·iterator에서 기존 출력 소비자가 정착한 init 증거가 모두 있어야 `FIRST_SEND_INPUT_AND_INIT_RECORDED` 4행을 기록한다. responseRef/processRef는 null이다. 두 증거의 도착순서, 다른 계획 SID, 두 실제 단발 permit의 경쟁, 입력 next의 경합과 iterable 재취득을 검증했다.
- 원 호출의 취소와 만료는 거래가 닫힐 때까지 회수 책임을 유지한다. 정상 닫힘 후에는 원 owner의 수명과 기한이 Query를 제한한다. 늦게 도착한 새 원 Query는 한 번만 정리하고, 다른 소유자가 사용 중인 Query/iterator가 되돌아오면 추가 소비·타 소유자 close를 차단한다.
- 신규 4행은 로컬 기록이다. 기존 SEND 관측을 spool에 보존하고 원 PERMIT 관측까지 연속 ACK를 받아야 cursor를 확정한다. 201건에서 첫 batch ACK 또는 둘째 응답 유실만으로 cursor를 전진시키지 않았다. 재시작은 과거 행과 ACK만 복구했다.

## I1 보완 전 실행 근거

모든 명령은 위 branch의 inner worktree에서 실행했다. 직접 34건과 별도 추가 반례 1건, 인접 24건 및 빌드 12건은 모두 실패·취소·SKIP 0이다.

| 명령 | 종단 | 근거 |
|---|---|---|
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 tests/unit/FN07/normal-first-send-owner.test.ts tests/unit/FN08/normal-claude-start-wire-journey.test.ts tests/unit/FN08/normal-instruction-wire-journey.test.ts tests/unit/FN08/normal-instruction-polling-journey.test.ts` | exit 0, 34P, 82735.9894ms | 9f4390 → f5edba |
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-name-pattern="다른 READY의 생성" tests/unit/FN07/normal-first-send-owner.test.ts` | exit 0, 1P, 8740.399ms | fd4403 → 8fdfa9, 별도 추가 반례 |
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 tests/unit/FN08/normal-instruction-wire.test.ts tests/unit/FN08/normal-stop-polling-journey.test.ts` | exit 0, 24P, 38744.6901ms | 5f706a → cb53af |
| `node --test tests/desktop/native-proof-runtime-build.test.cjs` | exit 0, 12P, 2165.0812ms | 7ad36e, Vite 메모리 CJS 46 source·17 exports·builtin 4, 2MiB 상한 및 import 효과 0 |
| `npm run typecheck` | exit 0, 진단 0 | 18d2b1 → cfb01b, 별도 추가 시험 포함 |
| `git diff --check` | exit 0 | bb5369, 기존 CJS 2파일의 checkout EOL 경고 |

초기 `node --experimental-strip-types --experimental-test-module-mocks --test tests/unit/FN07/normal-first-send-owner.test.ts`는 `forFirstSend` 부재로 1F(890885)였고 첫 양성에서 1P(1db9cb)였다. 중간 4파일 29P는 r2의 최종 검증에 합산하지 않았다. 첫 타입 진단 TS2739는 generic 관측의 형상 검산 후 타입 반환으로 해소했다. 최종 전 검사에서 직접 33P/1F(8f0a7d), 인접 23P/1F(12351c), 타입 1진단(89a15b)이 발생했다. 최종 lock.close 대기 중 취소에서 close 0을 직접 재현한 뒤 원 signal과 단조 기한을 인계 구간에 결박했다. 기존 driver 부재의 오류코드 DRIVER_REQUIRED를 복구했고 새 시험의 원 SEND item은 materials와 operation을 확인해 좁혔다. 위 최종 명령들은 이 보완 후 실행했다.

## 역할을 바꾼 늦은 handle 반환에 대한 I1 보완

보완 전 제품 지문 `529AE3A4B4E699DD55C954A75FB2BAEB2046441A4AFD55D8B2DF9D434019FAE7`, 시험 지문 `2DA1E64502FF6FF63C2B11190FE97ADE78682F9BDD0791B5A6AEC9BAC4F134F9`, 결과서 지문 `106F8AD1ABA9E7B9A48B3273AE1203F4EBE0625BDDCBAE2F5E16761BC0266348`을 기준으로 재현했다. A의 원 iterator로 실제 자바스크립트 async generator를 사용했다. B가 취소되어 UNKNOWN을 반환한 뒤 B의 생성 포트가 A의 iterator를 Query로 반환하자 B.close가 1회 호출됐다. 직접 재현 명령 `node --experimental-strip-types --experimental-test-module-mocks --test --test-name-pattern="취소된 B의 늦은 Query" tests/unit/FN07/normal-first-send-owner.test.ts`은 exit 1, 0P/1F(a5f613)였다.

역할별 두 집합을 단일 모듈 비공개 WeakSet으로 바꿨다. 새 Query가 다른 원객체와 같으면 B의 정리 대상으로 저장하기 전에 거절한다. iterator가 해당 호출에서 방금 선점한 Query 자신인 경우에는 사용한다. RAM에서 B의 UNKNOWN·cursor 0·보호 출력행 0·타 owner close 0, A의 lifetime 유지·next 1 및 A가 직접 종료할 때만 원 generator 정리 1을 검산했다. 기존 같은 Query/같은 iterator 반례와 정상 self-iterator도 함께 검사했다.

| 보완 후 명령 | 결과 |
|---|---|
| `node --experimental-strip-types --experimental-test-module-mocks --test tests/unit/FN07/normal-first-send-owner.test.ts` | 12P/0F/0SKIP, exit 0, 30271.9755ms (3d539f → 73c7db) |
| `node --test tests/desktop/native-proof-runtime-build.test.cjs` | 12P/0F/0SKIP, exit 0, 2301.5267ms (043d10) |
| `npm run typecheck` | 진단 0, exit 0 (609bfe → 80944e) |
| `git diff --check` | exit 0 (cb96af) |

## 검수 동결 지문

| 제품 또는 시험 | SHA256 |
|---|---|
| `apps/connector/adapters/secondary/normal-start-wire.ts` | `F17D1787FC94F0F656FF0AE56515864CB961B68C3D05CBFED27E91BCF3448524` |
| `apps/connector/runtime/normal-start-coordinator.ts` | `058EA8466E0BCC4FFBD03BDF250F6E9C5AB3D4844DF4D9C6D9A3020F660121ED` |
| `apps/connector/adapters/secondary/normal-instruction-wire.ts` | `B6638CD011720B82076064FF7BA2A68276604F1A8E581270D5DBD6D38A20C68D` |
| `apps/connector/runtime/normal-instruction-coordinator.ts` | `59D6FB8DAA9294894577136D3524ABC4BB3E8F2F801C01E71C505B34E951AAE0` |
| `apps/connector/runtime/normal-start-polling.ts` | `026B9E2C05C1A560F89E13BD442EAB3671740C09EFF721E8285F3E4C8088BED5` |
| `apps/connector/runtime/normal-first-send-owner.ts` | `A38D0C158DB0986EF04B4ACA08579158EB67BEE7118843EEA46A1F446EE19DEE` |
| `apps/desktop/scripts/native-proof-runtime-build.cjs` | `A6985B452EAB86FE7BD8308133D7DF4D891D92FE4F9E9D7581B79D9F05C26DD9` |
| `tests/unit/FN07/normal-first-send-owner.test.ts` | `056F1073DEF1A1F6AD9589F7A9317FDF50E5F8E10687A974D2EF3D81F4009238` |
| `tests/desktop/native-proof-runtime-build.test.cjs` | `563BA91DC50D66E6E9B75256B9F91EBBCD9812457BD1AA1B1C12EFC2B3EC79A3` |
| `tests/unit/FN08/normal-claude-start-wire-journey.test.ts` | `8AF476DD7CA65B3A874A6A0DDD1E8A2768E2F2A840485BFB0BD7242861FBD490` |
| `tests/unit/FN08/normal-instruction-wire-journey.test.ts` | `4FD8C1FF866F1B4D1EDA14E611B5E4FE9653B4987CA71C805A47DB8BC1489404` |
| `tests/unit/FN08/normal-instruction-polling-journey.test.ts` | `94C4810D99AC5655EA4FAEF396A4959D0B4ED7E7275B0A619B3AAA76C7EB6AAE` |

## 미지원 범위와 복구

RAM의 create/current/classify/예약/정산 포트는 실제 등록 owner, 내구 파일 또는 실제 SDK 서명의 근거가 될 수 없다. Query·iterator·지시 제공·init 확인에 관한 결과는 명시한 제품 코드와 합성 포트 범위다. 실행계의 SDK module/query/hook, native 등록·배정 및 보호 spool 9E98, 제5 채널·공유 총량, 실제 SDK 입력 수락·응답·업무 완료·OS child 소유는 미검증이다. 후속 SEND를 같은 live Query에 제공하는 전용 소비와 원 STOP 협력 interrupt는 후속 연결이다. 실제 SDK 추가 조회·설치·실행, 사용자/백업 파일 조사, DB·권한·키·서비스·Agent·C#·P03 작업 0.

복구 단위는 위 12개 소스/시험 및 이 결과서다. 통합 후 Main이 해당 변경 commit의 정상 revert로 복구할 수 있다. 기존 START/출력 소비자 체크포인트 및 다른 작성자의 변경은 보존한다. WORK_STATUS, Git, 검수·통합은 Main 소유다.
