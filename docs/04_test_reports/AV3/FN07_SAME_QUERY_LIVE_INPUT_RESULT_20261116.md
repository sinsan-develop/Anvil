# FN07 동일 Query 후속 입력 연결 검증 결과

## 판정

등록 owner가 처음 생성한 Query의 입력 스트림으로 서로 다른 후속 지시를 전달하도록 연결했다. RAM 종단에서 Query 생성 1회, 출력 iterator 획득 1회, 첫 본문과 후속 본문의 실제 제공 각 1회, START·첫 SEND·후속 SEND permit 각 1회와 기존 관측 ACK 뒤 cursor 3을 확인했다. 첫 SEND는 기존 `FIRST_SEND_INPUT_AND_INIT_RECORDED`, 후속 SEND는 자기 명령의 `LIVE_SEND_INPUT_YIELDED`를 쓴다. 출력은 세션 귀속으로 유지한다.

소스 기준 main `9013faef`. 원 WI SHA256은 `A7353F1082997B1A890116975C5C673B0BDDC3417A58ABAE25A8F8B6BACCA621`, r2는 `9BBC89D53893D3F2BBB62CCB8C5A4FF40183F936D7452CCF039F3E68604FC765`다. r2에서 마지막 전달 직전에 원 명령의 기한·STOP 선점·현재성을 다시 확인할 수 있도록 첫 SEND owner 한 경로를 추가했다.

## 변경과 경계

- `normal-owned-spool-profile.ts`에서 원 create 요청과 수명을 그대로 전달하고 원 Query에만 입력 포트를 결박한다. 첫 command iterable을 먼저 소비하고 후속 명령은 대기하는 단 하나의 pull에 제공한다. 두 번째 동시 pull을 거절한다. 미소비·취소·불명에서 자동 재생성·재전송을 수행하지 않는다.
- `native-proof-runtime-entry.mts`에서 등록된 원 worker가 가진 source와 port를 같은 번들의 `NormalInstructionWire.forFirstSend`에 함께 제공한다. 신규 CJS export가 없고 사용자 경로나 실행 설정을 받지 않는다.
- `normal-first-send-owner.ts`는 발급한 후속 prompt와 원 worker·Query·port를 private WeakMap에 묶는다. 최종 전달 직전 정확한 원객체를 대조하고 증표를 소진한 뒤 지역 `active()`와 토큰을 다시 확인한다. `provide` 종료 시 남은 결박을 삭제한다. 마지막 검산과 SDK 대기 promise의 정상 반환 사이에는 추가 await가 없다.
- `normal-execution-credential-owner.test.cjs`에서 기존 등록 fixture의 명시적 세 번째 명령에 별도 본문·자료 해시·참조·permit을 공급한다. 정상, 미소비, dispose, current 상실, 입력 스트림 종료와 늦은 재사용을 확인했다. 별도 RAM owner 경계에서는 원 yield 뒤 CURRENT 상실·명령기한 경과·원 STOP 선점 시 최종 전달이 0건이었고, 서로 다른 prompt/worker/query/port·재사용을 거절했다. 이 마지막 네 사례의 STOP은 합성 CURRENT와 기존 실제 제품 STOP 상태기계로 검사했다.

## 오류와 보완

1. 최초 0a6452 exit 1에서 후속 command가 UNKNOWN이었다. 초기 합성 출력 iterator가 종료 시 필수 `value` 필드를 빠뜨려 기존 codec이 owner를 닫는 두 번째 원인이 있었다(75a8aa). fixture를 고친 뒤 세 번째 port 연결만 빼고 같은 시험을 실행한 6ed0d6 exit 1에서, 첫 SEND 네 번째 행과 후속 세 번째 행까지 정착했으나 후속 본문 제공과 ACK cursor는 0이었다. 연결 후 등록 RAM 양성, 미소비, dispose 3건이 통과했다(e77e26).
2. 작성 중 검수 I1은 원 iterable의 yield 뒤 SDK 대기 pull에 실제 전달하기 직전의 검산 공백이었다. 원 명령의 소유 토큰·기한·STOP epoch는 첫 SEND owner의 지역 함수에 있다. r2에서 이를 재사용했다. 원 결박 확인 함수 추가 전 70bd95 exit 1, 추가 뒤 마지막 전달 경계 네 경우 f701d4 exit 0. 이 선택검사는 아래 직접 파일 44건에도 포함된다.

## 검증

승인된 개발 branch에서 실행했다. 아래 시험은 모두 취소·SKIP·실패 0건이다.

| 명령 | 실제 결과 |
|---|---|
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=spec tests/desktop/normal-execution-credential-owner.test.cjs` | 44 PASS, exit 0, 50109.5471ms, 99f421→7c48a8 |
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=spec --test-name-pattern="후속 입력\|후속 명령의 경합\|다른 READY" tests/unit/FN07/normal-first-send-owner.test.ts` | 4 PASS, exit 0, 13390.463ms, ff3b3a→1081af |
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=spec --test-name-pattern="실제 Vite 메모리" tests/desktop/native-proof-runtime-build.test.cjs` | 1 PASS, exit 0, 18b850. 원 closure 49개·export 18개·builtin 8개·2MiB 미만 |
| `node ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json --pretty false` | exit 0, 8b3faf |
| `node ../../node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json --pretty false` | exit 0, 7d6a2e |
| `git diff --check 9013faef` | exit 0, b583c5 |

## 최종 SHA256

```text
CE67B480354E2B614FA853C94D949DA00C78F9C1AB851E51F01E7D9A31CD2611  apps/connector/runtime/normal-first-send-owner.ts
26AE97FE5105F84205CCB1216FF054BCDA01F89E347AAB7A323B01537D35B06E  apps/connector/runtime/normal-owned-spool-profile.ts
58354B95706DA0DE72A65FBD752DF260FA035DE10A95A0EA25EF37889F6560FF  apps/desktop/scripts/native-proof-runtime-entry.mts
FB0C5432D05701CDB3DECA9B461C7BA6143D441FAC41B2ACDF9F756B6AD55BE8  tests/desktop/normal-execution-credential-owner.test.cjs
```

## 미검증과 복구

SDK와 CURRENT는 등록 RAM 시나리오의 합성 포트였다. 실제 SDK·CLI 모듈 생산, child 보유, 실제 OS STOP/CURRENT 공급, Windows 보호 설치, 실제 파일·키·권한·DB·서비스·Agent는 미검증이다. 승인된 원 행과 기존 서버 관측을 사용했다. SDK 수락, 응답 귀속, 업무 성공이나 OS 종료를 실행 결과로 추론하지 않는다.

이 단계의 제품·시험 변경을 소스 기준과 대조하여 Main이 되돌릴 수 있다. 기존 보존 원장·불명 행·미정산 예약에는 정리 작업을 적용하지 않는다. Git 통합·현황 기록은 Main이 소유한다.
