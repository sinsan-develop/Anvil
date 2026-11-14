# FN08 STOP 역사 소비 source 결과

## 판정 → 이유 → 조치
승인된 STOP A §4/5의 역사 소비 source 범위 검수 완료. 실제 협력적 중지는 미구현이며 전체 계획 미완료다. 기존 normal START에 Query/child owner가 없으므로 신규 STOP 시도와 interrupt는 제공하지 않는다. 원 START 내구수신·STOP 역사 검산, strict-close 뒤 관측 복구와 ACK를 연결했고 이후에도 UNKNOWN/cursor 유지로 종료한다.

기준 main f37d4e9673f5a4ab51f7d49461ec3efbfdb69734, branch codex/av3-fn08-stop-history, 문서 baseline71d61cdf. WI FN08_NORMAL_STOP_HISTORY_SOURCE_20261115.md SHA E593961B252658B770B0922112B9827BE2E12CDDB03199532F386EAC26649CFE, 원 채택 계약2E644507…56CAC0F 불변. Primary 단일 writer·Main 검수/문서/통합, live0.

## 동작·한계
신규 NormalStopCoordinator는 원 START readStatus 원메서드/RECEIVED와 readNormalStopItem의 정확 부모·UUID/target을 검산하고, 기존 attempt-commandId 채널의 최대2행 STOP_ATTEMPTED→STOP_UNCONFIRMED hash/key/ref/previousRef/시각을 확인한다. 원 owner 부재·빈 기록은 거절한다. 첫 행만 있으면 새로운 종결행을 추가하지 않고 UNKNOWN/RECORD_UNCERTAIN을 투영한다. 두 행도 STOP_UNCONFIRMED만 투영하며 실제 요청·중지 성공을 주장하지 않는다.

NormalStartFileStore.stopAttempts는 strictClose=true adapter만 추가하고 기존 START/SEND 의미는 유지한다. NormalStartPolling의 선택형 stop 소비는 동일 intake/clock을 확인하고 기존 spool record/sync/coverage를 재사용한다. ACK 이전과 이후에도 STOP cursor를 전진시키지 않으며 뒤 명령 실행으로 넘어가지 않는다. 원 행 ref/time과 이미 spool에 기록된 eventId를 보존하고, spool에 없던 관측은 최초 record 시 새 eventId를 만든다. 역사 행은 실제 owner 권위가 아니다.

## 검증
```
node --experimental-strip-types --experimental-test-module-mocks --test --test-concurrency=1 --test-reporter=tap tests/unit/FN08/normal-stop-coordinator.test.ts tests/unit/FN08/normal-stop-polling-journey.test.ts tests/unit/FN08/normal-start-file-store.test.ts tests/unit/FN08/normal-start-polling.test.ts tests/unit/FN08/normal-start-polling-journey.test.ts tests/unit/FN08/normal-instruction-polling-journey.test.ts
```
Primary 최종47P0F0SKIP exit0 39130.001ms(83028a), npm run typecheck exit0(94db40).
```
node --experimental-strip-types --experimental-test-module-mocks --test --test-reporter=tap tests/unit/FN08/normal-stop-coordinator.test.ts tests/unit/FN08/normal-stop-polling-journey.test.ts
```
Main fresh14P0F0SKIP exit0 8892.1909ms(5c749b). 원 owner 없음·다른START·재해시 target/namespace·부분/손상/미래이력·메서드교체·취소/늦은읽기·close/sync 불명·RAM 두batch ACK/cursor를 확인했다. 직접/인접 수는 중복 합산하지 않는다. diff0(c1148e/5a3745).

독립 spec C0/I0/M0, quality C0/I0/M1. M1은 POST 사전 hook throw를 ACK 유실로 표현한 시험제목으로, 제목만 POST 사전 실패/불명으로 정정(최종지문 Main5a3745). 본문·단언은 유지해 불필요한 재실행0. 서버 commit 이후 ACK 응답 유실 검증이라고 주장하지 않는다. 신규 모듈 부재 RED1F, RAM seed 선행read 누락1F, polling연결전 RED1F, 신규 타입진단6건은 보완됐다.

## 최종 지문
- apps/connector/runtime/normal-stop-coordinator.ts
  SHA256 484273258A18FD2761CEE5C9D0A6F570D9D5038C7A775CA9B1B1B096806E609B
- apps/connector/runtime/normal-start-file-store.ts
  SHA256 19DB80AD6B38ABE0AE37B43641F906E889A8DE62623D18BDCB7DC5322D22F0DB
- apps/connector/runtime/normal-start-polling.ts
  SHA256 1A53EEFAB5A483BA49DBFF0DCAC7EFF4564959A1AD0BFB6168FCF887FA8D0228
- tests/unit/FN08/normal-stop-coordinator.test.ts
  SHA256 B93D60F77D7916C2AE108DB76CA0DD75CA284244452B558186D55C53932F0740
- tests/unit/FN08/normal-stop-polling-journey.test.ts
  SHA256 F1AA57B7384400DBD5EB43AF5DC458CFA32DAD47F140A6AD82C6FE298C753F68
- tests/unit/FN08/normal-start-file-store.test.ts
  SHA256 01CCBBFD2237BAC751D9728EFE0F4370B955830C5D4B5BD5FAEC82081272B920
- tests/unit/FN08/normal-start-polling.test.ts
  SHA256 06ACF5337EE430F05803F71B5920DA38D9EE4AFA07AC24377B01F93E549D94BA

## 미검증·복구
실제 STOP 양성 생산/Query 소유·interrupt·DB 수용·파일 내구성·SDK/Agent·키·서비스·실자료는 미실행이다. 긍정 page/행/ACK는 RAM 형상·복구 증거만이다. 추가 공개 API·권한·owner factory·current callback은 없다. 정상 revert로 위7 source 경로를 복구할 수 있으며 실제DB/서비스 복구는 수행하지 않는다. 통합/병합후근거는 WORK_STATUS 후속기록에 남긴다.
