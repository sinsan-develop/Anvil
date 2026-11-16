# FN08 등록 owner의 보호 spool profile 소스 검증 결과

## 판정

채택 계약 r2의 단일 등록 owner, 원 실행 slot, 세 writer의 예약과 동일 host 대여를 제품 소스에 연결했다. 메모리에서 등록 owner가 실제 번들의 원 READY wire를 명시 조립하고 준비행을 한 번 저장했다. 서버 응답 대역이 필수 관측 4건을 ACK한 뒤 cursor가 1이 되었다. 수행자 검증을 마치고 독립 검수를 위해 동결했다.

- 시작 브랜치는 `codex/av3-connection-integration-next`, HEAD는 `efa7a563a63489aa5640bb703168f5b126a4f383`이다. 소유 범위는 제품 14개, 시험 8개, 이 결과서다. 관리 문서와 Git 통합은 Main이 소유한다.
- 채택 계약은 `9E98D4EAA162B2E12498DCC3742D7E33921EB688B794ACA8CFF8187C0FCE9C4C`이다. coordinator 마스킹 보완지시서의 최초 지문은 `1E86A1E63B5BEF90AE18CFF33110DF0C908E94733336D5840EFC4497459AEEFE`, 원 worker의 비공개 단발 재조회를 명시한 r2는 `A6E63A2A3F646BFDBC3A18B426C30E5EDCB5FE39DBF04780BF9CE2E01BDDD02A`이다.
- 최초 21파일 부분동결 지문은 `D62CCB36851362FD64A0213DF266AE046841704DB5D370423327C3E84A77000B`다. 당시는 일반 START가 통과했고 profile의 원 READY 경로는 미지원이었다. 최종 22파일 지문은 `3802FD9217E549B09BBE07C29DA58C2787AB66FE70569DDFCA91B829E7CEC8E7`이다.

## 변경과 근거

1. Native 소스에서 root 배타 생성과 Keep 검산을 마친 현재 신원에만 profile 전용 생성 증표를 발급한다. 기존 준비원장 생성 증표는 별도로 소비한다. REGISTERED 원행, 등록 키, 실행 slot·grant와 보호 배정을 결박한다. 고정 writer별 신원과 원장·별도 head·데이터 tail을 재검산한다. 동일 세대의 검산된 갱신은 기존 배정을 재개한다. 등록 이전 행, 손실된 배정·마지막 행 또는 다른 grant를 신규 빈 채널로 채택하지 않는다.
2. 단일 활성 profile 안에서 모든 프로젝트와 실행세대의 NORMAL_EXECUTION 256MiB, UNVERIFIED_RECEIPT_INBOX 512MiB, NATIVE_PREPARATION 64MiB, 관리 64MiB를 합산한다. 1GiB 중 배정한 896MiB와 미배정 128MiB를 구분한다. 각 writer는 첫 mutation 전 유보를 요구하고 미정산분도 용량을 차지한다. 기존 normal 3MiB/파일·64MiB/채널·10,000행, receipt 4,096바이트/1,024건 및 native의 기존 별도 제한을 보존했다. 준비 writer의 기존 Windows 내구 지원 거절은 유지한다.
3. Native가 등록·quota·신원·정산을 관리하고 Node의 기존 store는 원 bytes·file.sync·재판독을 수행한다. 원 host·기한·slot 상실을 관측하면 새 I/O를 차단한다. 진행 중이던 I/O와 정산 응답 유실은 호출자 UNKNOWN이다. 미확정 예약을 보존하며, native에서 정산한 사실만으로 작업 수신이나 Agent 성공을 추론하지 않는다. receipt는 등록 owner와 project에 한정되고 실행 slot을 요구하지 않으며 비권위 결과를 유지한다.
4. 기존 CJS 46 source·17 exports·builtin 4를 49·18·8로 갱신했다. 추가 외부 모듈은 node:fs, node:fs/promises, node:path, node:async_hooks다. 기존 node:util/types 항목과 2MiB 출력 상한·정확한 source/exports 대조를 유지했다. Native 고정 입력 목록은 26개에서 27개로 바뀌었다.
5. coordinator에서 기존 current 호출 1곳, 원 wire 호출 2곳을 private ALS.exit 안에서 실행한다. 원 wire 객체의 WeakMap 신원과 원 READY 소비 검사를 보존했다. profile의 `createWorkerStartPolling`은 실제 번들 내부에서 `forWorker`를 명시 조립한다. 외부 current를 넘겨받고, 그 worker의 읽기 전용 intake만 같은 journal·attempt·session·signal·기한과 slot에 묶는다. reserve 뒤 원 attempt body에서 마련한 재조회 권리를 중첩 전에 1회 소진하고 finally에서 해제한다. 기존 intake가 원 bytes와 참조를 다시 읽는다. current에서 새 poller를 재호출하면 원 host 사용 중에는 새 frame을 보낼 수 없다.
6. 등록 owner RAM 양성에서 일반 응답 경로와 원 READY 경로 모두 각 permit의 물리 host sequence가 1부터 40까지였다. READY의 저장행은 START_ATTEMPTED, PERMIT_RECORDED, START_READY_RECORDED 순서였고 responseRef/processRef는 null이었다. 필수 RECEIVED/PREPARED/START_ATTEMPTED/PERMIT_RECORDED의 ACK 뒤 cursor 1, 역사를 다시 읽은 뒤 permit 추가 0·generic wire 호출 0이었다. 큰 permit 응답 반례는 최대 64번 frame까지만 보내고 UNKNOWN으로 끝났으며 wire 호출 0, 남은 예약을 보존했다.

## 실패와 보완 이력

- 외부 wire가 같은 pair로 대여에 성공한 최초 RED `ddf5fc` 뒤 일반 wire 격리 `4ecf0f`가 통과했다. 원 READY 목적 메서드 부재는 `f293e4`에서 1F로 재현했다. coordinator 호출 지점의 격리와 비공개 단발 재조회로 보완한 `6e654b`에서 실제 번들 내 READY 준비행과 ACK를 확인했다.
- 물리 host.send에서 파생된 비동기 작업이 외부 wire를 호출하는 동안 같은 pair로 원 ticket을 빌린 반례는 `36b59d`에서 기대 0, 실제 1로 실패했다. 물리 host.current·send 및 open/close의 외부 호출을 ticket 밖에 두고 내부 저장 body만 원 문맥을 사용하도록 고쳤다. `5fd3e9`에서 같은 반례 1P, 무단 challenge 0을 확인했다. `69d892`의 current 자손과 worker 단발 재조회 2P는 아래 최종 직접 실행에도 포함된다. 초기 시험에서 여러 자손을 동시에 깨웠을 때 client의 BUSY가 반례를 가렸다. 정확히 원 attempt에서 파생한 자손 하나를 깨운 결과로 판정했다.
- 중간 desktop 타입 검사 `9cb6de`는 조립 입력 union에서 wire 필드에 접근한 TS2339 1건으로 exit 1이었다. 명시 worker 입력의 wire 부재를 내부 타입에 반영하고 런타임의 정확 키 검사를 유지했다. 최종 root와 desktop 타입 검사는 모두 exit 0이다.
- 최초 부분동결의 35P·11P·26P 등은 겹치는 선행 증거다. 최종 건수는 아래 명령의 출력으로 각각 집계했다.

## 최종 명령과 결과

실행 위치는 지시된 inner worktree다. 시험의 파일·native·HUMAN/TLS·서버 응답과 시계는 RAM 대역이다. 빌드는 제품 소스를 읽어 메모리에서 결과를 검산했다.

| 검사 | 종료 기록 | 판정 |
| --- | --- | --- |
| 직접 FN06/FN08·desktop owner | b67919 → 86e729, session 41028 종료 | exit 0, 64P/0F/0SKIP |
| 선택 등록·C# source 목록·메모리 번들 | 35b523 → 0fdb1f, session 64517 종료 | exit 0, 6P/0F/0SKIP |
| root TypeScript | 78acb5 → 915816, session 89712 종료 | exit 0 |
| desktop TypeScript | 50d543 | exit 0 |
| 기준 브랜치 tracked diff 공백 / 신규 제품·시험 포함 지문 검산 | git diff --check 및 아래 22경로의 EOF·trailing whitespace 검사 | exit 0 |

```powershell
node --experimental-strip-types --test tests/unit/FN06/native-preparation-journal-native.test.ts tests/unit/FN08/normal-credential-bootstrap-client.test.ts tests/unit/FN08/normal-start-file-store.test.ts tests/unit/FN08/normal-spool-profile.test.ts tests/desktop/normal-execution-credential-owner.test.cjs
node --experimental-strip-types --test --test-name-pattern="retained/worker|exact49|18개 타입|고정 source closure|고정 HUMAN wrong-project|실제 IPC pair" tests/desktop/desktop-trust-key-host-build.test.cjs tests/desktop/native-proof-runtime-build.test.cjs tests/desktop/desktop-trust-registration.test.cjs
node ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json --pretty false
node ../../node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json --pretty false
git diff --check development/main
```

## 범위와 복구

C#의 보호 저장·ACL·원 SID·DPAPI·directory handle·셋업은 고정 소스 검산이다. Native 실행·컴파일과 실파일/ACL/키·실제 사용자 데이터·서비스·DB·SDK/Agent·P03 실행은 제외했다. 실 Windows에서의 부모 metadata 정착, 전원손실 후 복구, OS 동일 사용자 공격 방어, 최대 입력의 실시간 완주를 검증하지 않았다. SID별 단일 활성 profile 밖의 과거 root와 고아 파일은 조사 대상에서 제외했다. 보호 원장·head와 데이터 전체가 같은 과거 시점으로 함께 돌아간 경우를 완전히 탐지할 수 없다. 실제 보호 저장 관측 공급자 부재의 차단과 기존 준비원장 UNSUPPORTED를 유지한다.

제품/시험 소스 복구 단위는 아래 22경로의 이번 변경이다. 실제 데이터 생성·삭제·이관은 수행하지 않았다. Main이 현황, 독립 검수, Git 통합을 관리한다.

## 동결 지문

각 줄은 원 파일 바이트의 SHA-256, 한 칸, 저장소 상대경로다. 지문 목록은 아래 22줄 각각에 LF를 붙여 UTF-8로 계산했다.

```text
71BA1796B19EB5F2128F0697ECD1F2ABE1EBD95D51AFCB79FB4A87C0947FB80D apps/connector/native/DesktopTrustKeyRootSource.cs
3B599C25698361576EDAF81CEB4350E8058D7D2253198F62803F936B0A99622F apps/connector/native/DesktopTrustKeyHostSource.cs
0384EBE7AA96D35845CF8086E8DB54BCE74EF59E6F1AF12F1E72CC57DF419B32 apps/connector/native/NativePreparationJournalKernel.cs
ACB7D985002007CE0255E8D30CD52290A1CC6D8D7AD0384F58C8E41308AA37C8 apps/connector/native/NormalExecutionCredentialSource.cs
F5D262C5D4EF0B1805F648E38BEBCABE32C7A631BA76854A1D9DA82490AB7C95 apps/connector/native/NormalExecutionSpoolProfileSource.cs
5604F37861CFA09DC09EA7F660734271D65C2B7273345EA043BF31B5B03F38F8 apps/connector/runtime/normal-start-file-store.ts
CA753E673EF803B9254850B611703CE54EE5F36483EEF2333EFF6F6B36CF247E apps/connector/runtime/receipt-inbox.ts
044FD9B853212C58834CC62FA2E581DF5D491E9DD63901FDF6188B3A08A5C15A apps/desktop/src/trust-enrollment-owner.cjs
E945F3D1847F8984E2044C7F04D5A0E0A2095E855D75578B2E43BCF2D1BD1AA5 apps/desktop/scripts/desktop-trust-key-host-build.cjs
1B91388686349016634D6DBB49732337ABFCE65064C736F5762DEB1D6FA1C43F apps/desktop/scripts/native-proof-runtime-build.cjs
DE483E8AB7EB02D558C7EE3305766F079F40A05C7B5826E101564F4010892BAB apps/desktop/scripts/native-proof-runtime-entry.mts
D17785F68822BCC87604B20A33A7BC8B8913AD0A65302E095402F2E748B8358D apps/connector/runtime/normal-owned-spool-profile.ts
28A6F352F26A38343F64DEF5DCE24FAC5D634417851CA9E384093536A7B345AD apps/connector/runtime/normal-credential-bootstrap-client.ts
19D77F18E00E0722C31CBB5074CA79FC57268ADAD65F7216B91E92BDAB0E5B3E apps/connector/runtime/normal-start-coordinator.ts
4365FD6D805746E17769A9C8B9E77F29596F15FC254D3CACDC8E922949DF1848 tests/unit/FN08/normal-start-file-store.test.ts
E1A29195F6881E9EDAA2D70F2CFEA3D59E2A49B31B02E14C16307A40857484FA tests/desktop/desktop-trust-registration.test.cjs
7266BC6C2E3301E089FF16FC078BAE4DC734CD8A28B54AC8F56C1B61F4FF19E5 tests/unit/FN06/native-preparation-journal-native.test.ts
B39C20ABC261FAD2E9E0BA4F8DCDBAD04E49376016E7142D37535FEC5E879D7B tests/desktop/normal-execution-credential-owner.test.cjs
9452D32C47A25B2770E915DA4214FAC78B785F9DA55B702F3216575443D23D72 tests/desktop/desktop-trust-key-host-build.test.cjs
3FEF2D05611BD6F6CC9DFC27A0EB6B38643386BEAE75973995F8A8AA0C45C9BF tests/desktop/native-proof-runtime-build.test.cjs
64943DF524ED0AD506A1F6BBF4E3734EDC2E69B20389B2CAE5A8022834619916 tests/unit/FN08/normal-spool-profile.test.ts
EE9C88C4D35CABBF4943BB203AEC2744C7F252A666DAF228025CABB5C765D2C5 tests/unit/FN08/normal-credential-bootstrap-client.test.ts
```
