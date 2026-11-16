# FN07 SDK 출력 보호 저장 연결 검증 결과

## 판정과 대상

등록된 desktop owner가 원 START worker와 첫 SEND Query의 iterator를 연결해 전용 출력 채널에 저장하는 제품 소스를 구현했다. 같은 CJS 번들에서 보호 저장의 읽기·쓰기와 첫 SEND의 네 번째 행, 필수 관측 ACK까지 RAM으로 검증했다. 브랜치 `codex/av3-sdk-output-storage`, 소스 기준 `e0c152e4`. Main의 문서 커밋 `50f1bf7f`는 제품 기준과 분리했다.

초기 WI SHA256은 `CA970F2AE828A7F15CDFC8EE99DBDEB4F73C18B3051060C8358376E43FC217C2`, 최종 r2는 `EB2337E648ADD66B9995E7A9EFD61F66CEA043C6B39B35E985B5E0B792230348`이다. r2에서 첫 SEND의 원 Query 발급 위치와 원장 잠금 순서를 다루기 위해 제품 두 경로를 추가했다.

## 변경과 관측

- 등록·slot·grant·세대와 보호 PROFILE/ALLOCATED 원행의 fullref를 확보한 뒤, 원 worker가 발급한 dispatch 시도와 원 Query/iterator를 한 번 결박한다. 파일 저장소의 일반 입구는 전용 채널을 거부한다.
- 첫 SEND 3행을 strict close한 뒤 별도 coordinator가 원행을 조회하거나 polling을 재개해도 추가 permit/Query를 발급하지 않는다. 소유한 시도만 원 세 행을 재검산해 네 번째 행을 쓴다. 기존 generic·후속 SEND의 자료, 관측, ACK 의미를 유지했다.
- 기존 여섯 native purpose 안에서 원 예약의 정상 읽기 종료를 보호 행으로 기록한다. 다음 물리 host는 원 slot·grant·allocation·scope·request·원 파일 요약과 일회 challenge를 검산한다. SDK next 대기 동안 두 물리 host가 이어서 점유되지 않는다. 각 host의 한도는 10초/64프레임이고 호출자는 원 논리기한과 slot 기한을 계속 적용한다.
- 제5채널은 원 NORMAL_EXECUTION 256MiB 안에서 모든 배정의 정상 자료·기존 미정산액·출력 관리 비용과 함께 계산한다. 원장 파일을 늘려 새로운 정상 풀을 만들지 않는다. native `Inspect`는 원 채널 개수·bytes·파일 바이트 tail을 검산한다. Node strict 거래에서 전체 canonical 출력행의 ref/hash/순서를 검산하고 마지막 재판독 및 정산응답의 실제 파일 tail도 대조한다.
- 등록 CJS 양성에서는 SDK next 대기 중 동일 등록/세대의 별도 START polling이 역사 ACK를 확인하고 cursor1을 반환했다. 같은 출력 예약의 두 번째 거래가 성공하여 격리 assistant 본문과 init 원행·확인행이 저장되고 원 polling이 cursor2를 반환했다. START·SEND permit은 각 한 번이다. 합성 SDK의 Query는 한 번 생성했다.
- 등록 CJS 음성은 용량 부족, 다른 challenge, 정산 후 응답 유실, 현재성 소실, 논리기한 만료, 같은 길이의 중간행 변조, 마지막 행 소실을 다루었다. 모두 첫 SEND의 긍정 네 번째 행과 init 확인행을 추가하지 않았다. 정산 응답 유실 사례는 합성 native가 이미 첫 자료 정산을 기록자 측에서 마친 뒤 호출자가 UNKNOWN을 관측한 경우다. 시간·주체 상실 및 잘못된 증표의 최악 예약은 자동 재발급하지 않았다.

## 실행 증거

모든 명령은 inner checkout에서 실행했다. 아래 완료한 각 묶음은 skip, 취소, 실패가 0건이다. 별도 선택검사와 중복되는 건수를 더하지 않았다.

| 명령 | 결과 |
|---|---|
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 --test-reporter=spec tests/unit/FN06/native-preparation-journal-native.test.ts tests/unit/FN07/normal-sdk-session-output.test.ts tests/unit/FN08/normal-spool-profile.test.ts` | 70 PASS, exit 0, 10813.769ms, 6d0fe1→4b9c9d |
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=spec tests/desktop/normal-execution-credential-owner.test.cjs` | 35 PASS, exit 0, 25454.1253ms, a31677→118892 (원 callable 보완 후) |
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 --test-reporter=spec tests/unit/FN07/normal-first-send-owner.test.ts tests/unit/FN08/normal-instruction-polling-journey.test.ts` | 34 PASS, exit 0, 95490.14ms, 4174e0→d322d0 (원 callable 보완 전 인접 근거) |
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=spec tests/unit/FN07/normal-first-send-owner.test.ts` | 18 PASS, exit 0, 34306.4727ms, 2e0931→588092 (원 callable 보완 후) |
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=tap --test-name-pattern="실제 Vite 메모리" tests/desktop/native-proof-runtime-build.test.cjs` | 1 PASS, exit 0, 8528ff. 메모리 CJS 소스49·exports18·builtin8·2MiB 미만 |
| `node ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json --pretty false` | exit 0, bdfbf4 |
| `node ../../node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json --pretty false` | exit 0, a64b8a |
| `git diff --check e0c152e4` | exit 0, f2a8ca |

## 수정 과정

원 파일 저장소의 전용 채널 미수용을 c9e41b에서 확인한 뒤 승인된 profile 입구로 제한해 89fb77에서 통과했다. 첫 SEND 잠금 안에서는 별도 coordinator의 관측을 얻지 못했다. 세 번째 행 정상 종료 뒤 원 상태는 `SEND_DISPATCH_ATTEMPTED`이고 별도 polling 반환은 UNKNOWN이다. 이 둘을 개별 단언했고 원 Query/permit 추가 발급이 0임을 확인했다.

통합 RAM fixture가 slot의 유효시간보다 긴 timeout을 제출한 사례는 보호 경계에서 거절됐다. 고정 SDK 버전과 다른 init fixture도 기존 codec에서 거절됐다. 이후 실제 초기 출력 drain과 ACK의 물리 host가 경합한 경우를 확인해 원 권한을 가진 짧은 거래를 직렬화했다. 외부 callback의 ALS 격리와 다른 목적의 BUSY 거절을 유지했다. 중간 양성 ba3136과 원 callable 보완 전 CJS 34건을 구분한다.

native 사전 I1은 1회였다. 출력 파일 조회를 마친 뒤에 논리기한이 지나면 전이 행을 쓰기 직전과 쓰기 후 권한 반환 직전에 다시 확인한다. Reserve에도 적용하고 Log를 벗어난 응답 반환 전 다시 확인한다. 기록 뒤에 시각이 지나면 append한 행과 최악 예약을 보존한다. C# 원문의 순서를 검사했고 실행은 하지 않았다.

음성 묶음 7967d2는 7 PASS/1 FAIL이었다. 4.5초 이동 시 SDK와 credential 갱신 시점에 함께 도달해 polling이 NEEDS_RENEWAL을 반환했다. SDK 원기한을 200ms로 두고 clock을 300ms만 이동해 유효한 credential 아래의 출력 거절을 확인했다. root 타입 689075에서 새 정적 검사표의 tuple 추론 진단 6개를 확인하고 `as const`로 수정했다. 최종 타입은 양쪽 exit 0이다.

원 iterator 획득의 독립 검수 I1은 1회였다. 마스킹된 원 함수에 자체 `call` getter가 있으면 원 호출 대신 다른 iterator를 반환할 수 있었다. 등록 CJS 양성 및 Proxy callable 사례가 9b21dd에서 0 PASS/2 FAIL이었다. 원 descriptor의 함수가 Proxy인지 거절하고 `Reflect.apply(iterate, query, [])`로 획득했다. 최종 35건에서 정상 원함수 1회·자체 getter/대체 iterator next 0회, Proxy 경로에서 원 iterator 획득/원 next/첫 SEND 긍정 0회를 검증했다.

### I2 자기 Query 단발 정리

Proxy iterator callable을 거절하기 직전에 이미 선점한 자기 Query가 정리 목록에 들어가지 않아 `source.close`가 0회였다(선택시험 edbc4e, exit 1). 다른 owner 선점 여부 검사 → 원 Query 선점과 정리 참조 보관 → 이미 불명이면 자기 Query 즉시 정리 → iterator descriptor 검산 순으로 변경했다. Proxy 거절에서 close 인자는 원 Query와 동일하고 호출은 1회였다. 다른 객체를 닫거나 Proxy trap을 호출한 횟수는 0이었다. 위 직접 35건·인접 18건은 I1 수정 시점의 근거다. I2 최종 소스에서는 다음 직접 영향만 다시 검증했다.

| 명령 | 결과 |
|---|---|
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=spec --test-name-pattern="등록 owner 원 Query\|ITERATOR_PROXY" tests/desktop/normal-execution-credential-owner.test.cjs` | 2 PASS, exit 0, 6cfd3b |
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=spec --test-name-pattern="late-create\|다른 READY\|취소된 B\|자기 iterator" tests/unit/FN07/normal-first-send-owner.test.ts` | 4 PASS, exit 0, dc92e0→7a55f6 |
| `node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=spec --test-name-pattern="실제 Vite 메모리" tests/desktop/native-proof-runtime-build.test.cjs` | 1 PASS, exit 0, 82595a |
| `node ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json --pretty false` | exit 0, ad3115 |
| `node ../../node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json --pretty false` | exit 0, d2ca6b |

## 제출 파일 SHA256

```text
1A26C1C5352FDCDDDF235BFE69D42B74F28425877AA4447C38446467A1FBD5A4 apps/connector/native/NormalExecutionSpoolProfileSource.cs
0E8B67C9A090F0626C3FC0BCB9F6262161D6318814B1868D1D0E8B490D6AC0BA apps/connector/runtime/normal-first-send-owner.ts
B0E8FF2AD0E2F69891D50050C630E308029D5B864AA7DC545DE1D507DD57CF48 apps/connector/runtime/normal-instruction-coordinator.ts
1061EFFEBB31F21D8B061EDFE0DBC0F831BD0EE8C8172BD62DC790743F5CB92A apps/connector/runtime/normal-owned-spool-profile.ts
1D6E268CDBD84617AC15A56F3DAD512ECC1C0F3F3BB7934C541E539CB13CB943 apps/connector/runtime/normal-start-file-store.ts
512424416D69A73C3D9A268C1F384812828F379C03B941AC26880EC8A0AC05EE apps/desktop/scripts/native-proof-runtime-entry.mts
107413B659705CA97A198B4D675A9C6927BE8D1B66E869F9B4B4A718599DB369 tests/desktop/normal-execution-credential-owner.test.cjs
57A5B4BD7F0BAA36CF4B7C9CC742B6BA9F807EB60BEFB9817CBF47ADD26356F9 tests/unit/FN06/native-preparation-journal-native.test.ts
705059A5B08AC3E694EC538E9809766E26D947BC8D3AB11193389BD1899B4D08 tests/unit/FN07/normal-sdk-session-output.test.ts
ABEC09EBCBA87813DCCF6A9264C6DA74B827867D5A0C1F2E57C2BF9729ADFED8 tests/unit/FN08/normal-spool-profile.test.ts
```

## 미검증과 복구

Windows native를 컴파일·실행하지 않았다. DPAPI·실디스크·ACL·전원손실·실제 등록된 키와 slot·실 서비스/DB/권한·SDK/Agent 생성/실행은 미검증이다. Native 단계, 분산된 용량 경합 및 원장 비용에 관한 근거는 C# 소스의 계산과 RAM 모형이다. 잠금 해제와 호스트 수명 검증은 소스 및 RAM 관측이며 커널의 동시취소를 입증하지 않는다. 실제 SDK module/query/spawn 공급자의 연결은 후속 작업이다.

저장/입력/배정 공개 계약과 SQL 변경이 없으며 이번 단계에서는 운영 리소스를 생성하지 않았다. 통합 후 복구가 필요하면 Main이 이 단계의 제품·시험 변경을 기준 커밋과 대조하여 되돌린다. 기존 원장·미정산 예약·UNKNOWN은 보존한다. Git·WORK_STATUS·독립검수·통합은 Main 담당이다.
