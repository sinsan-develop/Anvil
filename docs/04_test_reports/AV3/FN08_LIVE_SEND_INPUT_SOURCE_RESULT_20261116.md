# FN08 같은 Query의 후속 SEND 입력 제공 검증

## 근거와 범위

- 채택 r2 `23BF070B7266C660A505B9357FE71567D8748BF3866C407CE617A8286BF1778B`. 시작 branch `codex/av3-normal-query-followup`, HEAD `e03e93e75a897673399a441aedc77aa6177d3531`. Main 작성 계획·현황·지시서 변경을 보존했다.
- 최초 지시서 `807B6EED7CD7BC947A835387E6E4AA5ED5B38E4CDA816393F4A4271A6C25EDD1`, r2 `4EE938787C99E91C7A847134389FDDD04998DDF1112C396CA704BB8B084F3AB9`. r3 `457D88316883948605C4675162DA6BA7C4A9699D6AB35F7B0BCFF7A405C266C3`는 LIVE 마지막 거래의 strict release 경계를 추가해 저장소 1파일을 포함한다. r2는 정상 for-await가 종료를 확인하는 두 번째 next의 done:true를 허용한다. 원 사용자 메시지의 실제 제공은 한 번이다.
- 원 첫 SEND의 정상 정착 후 같은 private lease에 원 키·envelopeHash·첫 종단·READY·init fullref를 고정했다. 후속 명령의 세 번째 dispatch 행을 정상 닫은 뒤 부모 보호 intake의 원문·등록·session과 부모 attempt 정확 4행을 검산한다. 부모와 현재 attempt 잠금은 차례대로 획득한다.
- 원 Query와 원 입력 포트가 현재 메시지를 한 번 실제로 제공하고 정상 반환한 뒤에만 현재 4행 `LIVE_SEND_INPUT_YIELDED`를 쓴다. 네 번째 행의 재판독·정상 닫힘으로 입력 제공 사실이 확정된다. 저장된 raw 본문·SDK SID는 없고 responseRef/processRef는 null이다. 반복 열기·STOP 선점·current 소실·기한 만료·불명은 추가 제공을 막는다. ACK는 현재 명령 RECEIVED/PREPARED/PERMIT_RECORDED의 연속 전달을 확인한다.
- 역사 조회는 부모와 현재 행의 ref·원 지시 bytes를 다시 비교한다. 저장된 messageDigest 형상과 snapshot hash를 검산한다. 실제 제공 메시지의 동일성은 live 경로에서 검산했다. 역사 재생은 원 SDK SID를 복원하지 않는다.

## 실제 오류와 교정

| 단계 | 관측 | 교정 또는 판정 |
|---|---|---|
| RAM fixture | 9d3204 1F, 후속 요청의 permit 412 | 첫 메시지의 spoolBytes를 후속 명령에 재사용하던 RAM 대역을 원 instructionRef별 bytes로 고쳤다. 현재 HTTP·권한·예산 검사 그대로. |
| 목적 RED | 38e9be 1F, 두 번째 자료/permit/관측 요청 200, 두 permit 저장, cursor0·SEND_UNKNOWN | 같은 Query에 제공하는 새 원 입력·목적별 종단·부모 판독을 연결했다. 414c61 1P에서 서로 다른 message/parts/command와 재시작 추가 입력0 확인. |
| 첫 중간 type 검사 | 3ec245 4진단, fc1d7c 1F | 검산 함수 추출 시 남았던 rows 참조와 FIRST/LIVE completion 타입 분기를 교정했다. |
| 사전 I1 | 0e2b43 1F, 기존 포트가 optional requireStartReadyClose 없이 RESPONSE 이력을 재판독할 때 거절 | 원 이력의 첫 판독 계약 복구. 새 LIVE 검산은 별도 strict 재판독 필수. a7a378 16P에서 기존 RESPONSE·UNKNOWN·빈 행과 오류 경계 확인. |
| 사전 I2 | 첫 보완 11563ms 묶음의 4P는 정상 close 뒤에도 취소를 UNKNOWN 5행으로 보상한 중간 동작 | 정상 close를 입력 제공 사실의 확정점으로 고정했다. 이후 commit은 자기 토큰만 해제한다. 08c955 3P는 정상 close 뒤 microtask 취소에도 현재/역사가 같은 4행인 최종 동작, 부모 위조 및 201번째 permit/ACK유실을 확인했다. |
| 독립 I4 | eb87f9 1F, 기존 호환판독 callback이 원 LIVE 이력을 읽었지만 store가 반환 state만 RESPONSE로 바꿔 부모 5행 검산 생략 | 원 callback 안에서 state/inputs를 비공개로 고정하고 외부에는 사본만 반환. 33ebf5 1P, 최종 영향 검사에 포함. |
| 독립 I3 | cc4546 1F, 네 번째 행의 실제 RAM lock.close 중 취소가 기존 구현에서 성공 | 최종 거래에 원 guard를 등록하고 body/readback 뒤 lock.close, root/lock 신원 검사 await, 같은 JS 구간에서 원 guard 후 고정 lock만 동기 해제한다. 등록이 빠진 LIVE 행은 실제 저장소가 append 전에 거절한다. 주입 FS에 포트 부재/변조 시 disk 대체가 없다. aea5ff 10P, 바뀐 누락 반례 ae9e2b 1P, 최종 54P에 포함. |
| 독립 I5 | 06c610에서 일반 함수가 반환한 pending/rejected Promise·thenable·Proxy 및 지연 삭제를 모두 성공으로 반환 | 원 해제 함수의 반환값이 정확히 undefined여야 정상 종료한다. 표준 native Promise의 거절을 수거했다. 다른 반환의 then 접근자 호출0·원 잠금 해제 재호출0. 080d1a에서는 현재 호출을 거절했다. |
| 독립 I6 | 06c610에서 최상위 행 또는 snapshot Proxy가 필수 종료 검사를 생략한 뒤 LIVE 행으로 직렬화됨 | 두 Proxy를 직렬화 전에 거절하고 같은 canonical 문자열에서 만들어질 저장 바이트와 LIVE 판별을 결박했다. 080d1a에서 원 Proxy trap·4행 쓰기·동기 해제 호출 모두 0. |
| r3 타입 | d3b7e8→443e88 TS2769 1건 | 기존 fail 함수 변수의 반환 never를 명시, TS가 직전 검사 이후 원 syncRelease 함수를 좁힘. 27abd9 진단0. |
| 중간 타입 교정 | 6b12e0 TS2345 1건 | 시험의 assert.rejects 메시지 인자 표기만 정정. 중간 파일 매핑 충돌은 쓰기 실패 확인 후 같은 대상의 원문을 다시 확인했다. |

## 명령과 결과

```powershell
node --experimental-strip-types --experimental-test-module-mocks --test --test-name-pattern="별도 원문 후속" tests/unit/FN08/normal-instruction-polling-journey.test.ts
node --experimental-strip-types --experimental-test-module-mocks --test --test-name-pattern="기존 strict 저장소|후속 SEND의 원 부모" tests/unit/FN08/normal-instruction-wire-journey.test.ts
node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 --test-name-pattern="201번째 permit|후속 정상 이력|commit 직전" tests/unit/FN08/normal-instruction-polling-journey.test.ts tests/unit/FN08/normal-instruction-wire-journey.test.ts
node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 --test-reporter=tap tests/unit/FN07/normal-first-send-owner.test.ts tests/unit/FN08/normal-instruction-wire-journey.test.ts tests/unit/FN08/normal-instruction-polling-journey.test.ts tests/unit/FN08/normal-instruction-intake.test.ts tests/unit/FN08/normal-instruction-coordinator.test.ts tests/unit/FN08/normal-instruction-wire.test.ts tests/unit/FN08/normal-instruction-durable-journey.test.ts tests/unit/FN08/normal-stop-polling-journey.test.ts tests/unit/FN07/normal-sdk-session-output.test.ts | Select-String -Pattern '^(not ok|# tests|# pass|# fail|# cancelled|# skipped|# duration)|error:|expected:|actual:|failureType:'
exit $LASTEXITCODE
```

첫 동결의 직접·인접9파일 c0102d 174P/0F/0SKIP, exit0, 176329.7469ms. 이 결과는 I3/I4 보완 전의 영향 조사로 보존한다.

I5/I6 보완 전 r3 영향 검증 기록이다.

```powershell
node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 --test-reporter=tap tests/unit/FN08/normal-instruction-wire-journey.test.ts tests/unit/FN08/normal-instruction-polling-journey.test.ts tests/unit/FN08/normal-start-file-store.test.ts | Select-String -Pattern '^(not ok|# tests|# pass|# fail|# cancelled|# skipped|# duration)|error:|expected:|actual:|failureType:'
exit $LASTEXITCODE
```

54P/0F/0SKIP, exit0, 78972.3106ms (00b802, 11845 종료). store 타입 표기 정정은 JS 실행문을 보존했다.

```powershell
node --experimental-strip-types --experimental-test-module-mocks --test --test-name-pattern="후속 입력과 원 STOP|두 후속 명령|정착한 첫 SEND 뒤 원 출력 대기" tests/unit/FN07/normal-first-send-owner.test.ts
npm run typecheck
node --test --test-name-pattern="실제 Vite 메모리 CJS" tests/desktop/native-proof-runtime-build.test.cjs
git diff --check development/main
git diff --no-index --check -- /dev/null docs/04_test_reports/AV3/FN08_LIVE_SEND_INPUT_SOURCE_RESULT_20261116.md
```

owner에서 4P/0F/0SKIP, exit0, 8796.6254ms (8e5dbf). 최종 TypeScript 진단0·exit0 (27abd9), 메모리 번들 1P/0F/0SKIP·exit0 (969da4). 마지막 두 diff 명령은 각각 main 대비 추적 파일과 신규 결과서의 whitespace를 검사한다. 신규 파일과 빈 파일 비교의 exit1은 차이가 존재하는 상태이며 공백 오류 메시지는 0건이다.

- `npm run typecheck`는 bebd14 exit0, TS 진단0. `node --test --test-name-pattern="실제 Vite 메모리 CJS" tests/desktop/native-proof-runtime-build.test.cjs`는 fc2c85 exit0, 1P/0F/0SKIP. 고정 source46·exports17·builtin4 및 기존 2MiB 상한을 메모리로 대조했다.
- 기존 보호 handler와 Fastify inject·합성 HTTPS/credential·RAM 파일 포트로 START, 첫 SEND, 다른 원문의 후속 SEND를 생산했다. 정상 for-await와 경합 next에서 후속 메시지 1개, Query/출력 iterator 취득 각1, 정상 행에는 회신·프로세스 ref가 없었다. 198개 기존 heartbeat 뒤 후속 3관측이 이어져 두 번째 배치의 permit ACK를 잃으면 cursor0, 정상 재조회에서 추가 입력0이었다.
- 원 부모의 추가 UNKNOWN·중간행 훼손·마지막 ref 교체·새 행의 원문/registration/READY/init fullref 불일치를 검산했다. 포트 부재·무pull·재취득·yield 뒤 오류·STOP 경합·새 명령 경쟁·3/4행 거래본문 생략·sync/readback/close 불명·취소·기한 경계를 별도 검산했다.

## I5/I6 수정 후 최종 영향 검증

```powershell
node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=tap --test-name-pattern="LIVE 파일 경계" tests/unit/FN08/normal-instruction-wire-journey.test.ts 2>&1 | Select-String -Pattern '^not ok|^# (tests|pass|fail|skipped)|^  error:'
exit $LASTEXITCODE
node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 --test-reporter=tap tests/unit/FN08/normal-instruction-wire-journey.test.ts tests/unit/FN08/normal-instruction-polling-journey.test.ts tests/unit/FN08/normal-start-file-store.test.ts 2>&1 | Select-String -Pattern '^(not ok|# tests|# pass|# fail|# cancelled|# skipped|# duration)|error:'
exit $LASTEXITCODE
npm run typecheck
node --test --test-reporter=tap --test-name-pattern="실제 Vite 메모리 CJS" tests/desktop/native-proof-runtime-build.test.cjs | Select-String -Pattern '^not ok|^# (tests|pass|fail|skipped|duration)|error:'
exit $LASTEXITCODE
```

- 같은 선택 7건을 수정 전후 실행했다. 06c610은 0P/7F·exit1, 080d1a는 7P/0F/0SKIP·exit0이다. 모든 실패 반환에서 원 해제 호출은 한 번이다. late-release 대역은 나중에 잠금을 삭제했다.
- wire·polling·file-store 직접 영향 3파일 61P/0F/0SKIP/0cancelled·exit0, 76463.2298ms (b3779f, 세션36205 종료). 목적 7건은 이 61건에 포함된다. TypeScript 진단0·exit0 (c7526e, 세션25413 종료). Vite 메모리 CJS 1P/0F/0SKIP·exit0 (1c735c).
- main 대비 추적 파일 공백검사 exit0 (af6dc1). 신규 결과서는 빈 파일과 별도로 공백을 대조한다. Main의 독립 재검수 C0/I0/M0와 최종 snapshot-proxy/thenable 2P(b3919b)를 전달받았다. 이전 지문의 확인 결과와 구분했다.

## 동결 지문

```
apps/connector/runtime/normal-first-send-owner.ts 2E4E6EE2E444628CDC65F9201D64F8F97E8EBA155C960D83A1E4FD4C2147CD26
apps/connector/adapters/secondary/normal-instruction-wire.ts 564A181326ED8EE6146D95F95F25569620D4AFF70BF6F3F73AEB59F04DF38000
apps/connector/runtime/normal-instruction-intake.ts 12A66CEB5636B51AE6D36BD2D290BD5AF8912B81F54CBEC13D6730C24DD01759
apps/connector/runtime/normal-instruction-coordinator.ts 9C72F1F7A1A182E6AB42127CF8CC2367F896D33FDAF38827ECD11AB8F130C81E
apps/connector/runtime/normal-start-polling.ts F6E61CCCFC291EB6BEC7A37352CBEF0E11A00956473B2E57E10BEED9D614D2E3
apps/connector/runtime/normal-start-file-store.ts FDDB7934E02307109423E74324DF310BED728B22911D3D1C7038AF3FF00FB527
tests/unit/FN08/normal-instruction-dispatch-fixture.ts FCCB4E663A6A8860E98097B1592C58EB4114CE73F06E4CCBA049F56C554772D1
tests/unit/FN07/normal-first-send-owner.test.ts B604E870E356DE3B64CC5F05EEAF5EF449ACA828FAE6DEB6686B2345C280EC81
tests/unit/FN08/normal-instruction-wire-journey.test.ts 2B9F0BCC798ED167BAB242D057C8F7471CAE0305C66BAF9979D1A11817023A24
tests/unit/FN08/normal-instruction-polling-journey.test.ts 5F3E44D88730107ABDF413BFFC32687EBCDB1AF41A6C1F2DC037D20B216C9171
```

## 미검증·복구

- 합성 포트는 실제 등록 owner, SDK 입력 서명·원격 수락·명령 응답·업무 완료·OS 종료·보호 배정의 증거를 제공하지 않는다. 실제 CURRENT/SDK/module/hook·9E98 등록·실DB/키/권한·사용자파일·서비스·Agent/C#·P03은 실행하지 않았다.
- 원 파일 저장소 내부 lock close/unlink와 외부 STOP의 물리 순서를 원자적으로 관측한 증거는 없다. RAM에서 원 본문 마지막 검산, 명시 strict-close 오류와 정상 종료 뒤 취소를 구분했다. r3에서 실제 RAM lock.close 대기 STOP/abort와 lock lstat 대기 abort는 복구 가능한 긍정 이력 없이 lock을 보존했다. 같은 JS owner가 취소를 관측한 순서와 동기 release 호출을 대조했다. 물리 디스크 정착·전원손실·다른 프로세스는 검증에서 제외했다. 기존 보존 lock은 자동 삭제하거나 재개하지 않는다.
- 동기 해제 보증은 고정된 Node fs.unlinkSync와 계약을 준수하는 동기 RAM 구현에 한정한다. 지연 삭제를 예약한 비정상 주입 함수는 호출 결과를 거절한 뒤에도 실제 RAM lock을 지웠다. 이 경로에서 재시작 시 잠금이 보존된다는 보증은 없다. undefined를 반환하며 효과를 수행하지 않는 잘못된 함수의 동작을 독립 검증할 능력도 없다. 실제 파일 시스템 실행은 제외했다.
- rollback 기준은 시작 HEAD다. Main이 통합 시 독립 검수·Git·WORK_STATUS를 담당한다. 이 작업에서 Git mutation은 없었다.
