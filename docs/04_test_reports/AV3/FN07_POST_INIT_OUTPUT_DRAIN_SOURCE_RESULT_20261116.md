# FN07 첫 SEND 정착 후 원 iterator 출력 수집 검증

## 구현과 기준

채택 원형은 `86A46140DADB38CB31C9B94957E5C836532ACE8093B10A062622B3FE93E7EC9E`이고 지시서 지문은 `67A4667EAF7D26B4BB173B19E32A15A0AA128BB70854CE8F38E4DC0C59C2CDA9`다. 작업 branch는 `codex/av3-fn08-live-stop-consumer`, 시작 main은 `a86705e5f5364416d25f23c479df3058aab70e22`다. Primary는 기존 STOP r2와 Main 관리 문서의 변경이 있는 상태에서 지정한 제품 2개와 시험 2개 및 이 결과서를 소유했다.

- 이전에는 첫 SEND 4행의 엄격한 닫힘 뒤에 원 출력 소비자를 보유했지만 init 이후 읽기가 없었다. 이제 commit을 단발 선점하고, 같은 호출 스택의 후행 검사와 실패 정리를 거친 다음 원 worker·lease·Query·iterator·생명 신호로 수집한다. 일반 출력을 정산할 때마다 이벤트 루프에 실행 기회를 준다. DONE은 해당 iterator의 소비만 끝낸다.
- 기존 출력 저장 거래는 iterator.next() 동안 잠금을 보유했다. 변경 후 최악 예약을 한 번 잡고 첫 짧은 거래로 전체 prefix와 정상 닫힘을 확인한다. 잠금을 반환한 후 원 next를 한 번 호출하고, 반환된 메시지를 유한한 원문으로 복사한다. 같은 예약으로 두 번째 거래에서 전체 prefix를 다시 검산하고 기존 codec·append/sync·재판독 후 닫는다. 양 거래의 body 완료·holdId·행수·tail을 각각 검산하며, 정산을 끝낸 뒤에만 다음 읽기를 연다. 불명은 원 예약과 기존 행을 보존한다.
- 같은 RAM 잠금을 출력과 STOP에 적용했다. 출력 next 한 건이 대기 중인 상태에서 STOP 시도행이 정상 닫히고 원 interrupt 1회에 먼저 도달했다. 이후 출력 대기를 풀자 같은 iterator에서 assistant와 result의 전체 canonical bytes가 기록됐다. Query 생성과 iterator 취득은 각 1회, 동시 next 최대 1회였다. STOP 실제 종료·writer 해제·명령에 대한 SDK 답변을 추론하지 않는다.

## 최초 검증 이력

| 실행 명령 | 결과 |
|---|---|
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-name-pattern="출력 대기" tests/unit/FN07/normal-first-send-owner.test.ts tests/unit/FN07/normal-sdk-session-output.test.ts` | 수정 전 ae8cb7 0P/2F exit 1. 원 owner의 후속 출력 대기 미진입, SDK 대기 중 저장 잠금 점유를 각각 재현했다. 수정 후 05bd61 2P/0F/0SKIP exit 0 |
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 --test-reporter=tap tests/unit/FN07/normal-first-send-owner.test.ts tests/unit/FN07/normal-sdk-session-output.test.ts` | 1e3cd8 → 66b6ef, 57P/0F/0SKIP, 31874.2202 ms, exit 0 |
| `npm run typecheck` | c24f2e → 739475, 진단 0, exit 0 |
| `node --test tests/desktop/native-proof-runtime-build.test.cjs` | 038771, 12P/0F/0SKIP, 1528.4299 ms, exit 0. 메모리 CJS 46 source, 17 exports, builtin 4, 2MiB 상한 |
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 --test-reporter=tap tests/unit/FN08/normal-stop-coordinator.test.ts tests/unit/FN08/normal-stop-polling-journey.test.ts tests/unit/FN08/normal-instruction-polling-journey.test.ts` | 954af6 → 2a8456, 43P/0F/0SKIP, 75821.7242 ms, exit 0. I1 수정 전 시작한 인접 검사 |

첫 SEND strict-close 실패와 commit 직후의 동기 live() 실패에서는 init 이후 읽기 0, Query 재생성 0, 원 수명 정리 1회였다. 재시작에서는 보존 이력만 읽었다. 잠금이 없는 대기 중 prefix 중간행을 바꾸고 같은 행수와 끝 ref를 유지한 경우 두 번째 거래에서 UNKNOWN으로 봉인했고 추가 append·정산·next는 없었다. 양 거래의 body 생략·hold·rows·tail·close 장애와 원문 변조, 격리·중복·만료·현재성 소실도 직접 검사했다. 중간 직접 57건과 초기 2건은 위 직접 57건에 합산하지 않았다.

## 원 함수 호출 보완과 최종 검증

최초 독립 검수 I1은 1건이다. 두 단계 거래에서 원 read와 appendAndSync를 고정했지만 함수 자신의 `.call` 속성이 원 함수를 대체할 수 있었다. 형상 검사에서 일반 함수인지와 Proxy 여부를 확인하고, 포트와 메서드를 재검산한 뒤 `Reflect.apply`로 원 함수를 원 tx에 호출한다. 신규 후속 iterator 소비도 고정된 메서드와 `Reflect.apply`를 사용한다.

| 실행 명령 | 결과 |
|---|---|
| `node --experimental-strip-types --test --test-name-pattern="own.call|거래의 비정규" tests/unit/FN07/normal-sdk-session-output.test.ts` | bc110d 0P/6F, exit 1 → 34c098 6P/0F/0SKIP, exit 0. read의 own.call이 감춘 변경 중간행은 원 read에서 UNKNOWN, 원 append는 자신의 call 속성 호출 0. 함수가 아닌 객체와 Proxy 함수는 SDK next 전 거절 |
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 --test-reporter=tap tests/unit/FN07/normal-first-send-owner.test.ts tests/unit/FN07/normal-sdk-session-output.test.ts` | 61b8c8 → 360e9c, 63P/0F/0SKIP, 34174.1321 ms, exit 0. 정상 drain의 고정 next에 own.call을 붙여도 해당 속성 호출 0 |
| `npm run typecheck` | 01d07f → 916638, 진단 0, exit 0 |
| `node --test tests/desktop/native-proof-runtime-build.test.cjs` | 6db6fd, 12P/0F/0SKIP, 1834.7667 ms, exit 0 |
| `git diff --check development/main` | 3440d9 exit 1, Main 소유 WORK_CHECK/WORK_STATUS 줄끝 오류. Main 보완 뒤 56560d exit 0 |
| `git diff --no-index --check -- /dev/null docs/04_test_reports/AV3/FN07_POST_INIT_OUTPUT_DRAIN_SOURCE_RESULT_20261116.md` | 추가 결과서의 공백 진단을 별도로 검사. 신규 파일의 정상 차이 종료값은 1 |

## 동결 지문

| 파일 | SHA256 |
|---|---|
| `apps/connector/runtime/normal-first-send-owner.ts` | 0DB76A2D3302DA1C8043BD37FBDE418C39495859A51F1BBC4037399F893672A3 |
| `apps/connector/runtime/normal-sdk-session-output.ts` | C911C15866ED279F9395A6AA9D205633AFD7291192CEFCA36E7C70DFB174AD91 |
| `tests/unit/FN07/normal-first-send-owner.test.ts` | 2243869CFF7C3C9CDDD55286F5ADE7756AA5F780318A92AFE3AC0A69D46A4E6D |
| `tests/unit/FN07/normal-sdk-session-output.test.ts` | 23F943EFA8CBCCB3E4DF26A80BE4BD2BBDFB278EE1895C97EF21D14EEAD32EB5 |

## 미검증과 복구

실제 보호 profile/배정, OS CURRENT, 실제 SDK 모듈·hook·Query 및 OS 종료는 미지원 또는 미검증이다. RAM 포트의 저장·정산·interrupt 검사는 실제 배포 공급자의 등록/권한 증거를 발급하지 않는다. 사용자 자료 조사, 실제 DB·키·권한·서비스·SDK/Agent/C#·추가 SDK 조회·P03 실행은 0이다. 후속 SEND 종단과 기존 ACK·cursor·서버·SQL에는 변경이 없다. 복구 시 Main은 이 단위의 제품 2개·시험 2개·결과서 delta를 되돌리고 선행 STOP r2의 변경을 보존한다. WORK_STATUS와 Git 통합은 Main이 관리한다.
