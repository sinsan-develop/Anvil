# FN06 native 준비 r2 A — connector 원시도·일회 소비 source 결과

2026-11-02 / Main 어울 / **connector 부분 source 검수 · 전체 기능 미완료**

## 기준·변경

직접 채택한 r2 A SHA256 `5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085`와 승인 기록 `FN06_NATIVE_PREPARATION_R2_A_SOURCE_APPROVAL_20261102.md`, WI SHA256 `3905A46EEE54AF75C1971C66A51A8D1AB5E6F2EA439462F4192F53FDA151C1F6`의 범위다. 기존 Primary가 작성하고 Main은 검수·통합했다.

기준 `a3b60191da0f5403f85471cc9e87f42632d2c42f`에서 코드 `51c411eda507c136372b368e3c7aa2e15a5a2cb2`로 정확4경로·93추가를 commit했다. `315ec6`에서 네 raw blob/staged blob 일치·diff0을 확인했다.

| 경로 | SHA256 |
|---|---|
| apps/connector/runtime/native-preparation-client.ts | 8F04C446DC153C273963A4C808CED18D408900B19F6D1F7EAA151023A52B8937 |
| apps/connector/runtime/native-preparation-local-attempt.ts | 3FAF4F4BC986B7570AFD0A184C5D3F8348B49A6A5A43D86B5F45CBF6E74C9EF4 |
| apps/connector/runtime/native-preparation-factory-consumer.ts | 9FB7336EAFEFD1744AEE0E17ACF35D51845341A6C4668521EC48FF8BC15ECD93 |
| tests/unit/FN06/native-preparation-client.test.ts | 125CF10AE34C34FE31D5E44D172DD1BC029130A27005B5E5CFD091732B87FA26 |

## 구현 범위

- 기본 channel/journal/factory 공급자는 미등록이며 임의 상태·STATUS_ONLY·getter/함수 교체를 실제 준비 권위로 승격하지 않는다.
- 소유 channel→PREPARED append/flush/readback→current/challenge/정확8 proof·consume→ATTEMPTED readback→현재성/최단기한→비공개 capability→factory가 한 번 소비하는 ticket의 호출선을 작성했다. 이번 journal은 시험용 메모리 포트이며 실제 내구 저장이 아니다.
- authority의 정확 nativeFactoryRef와 주입된 factory의 고정 fullref·own 함수를 대조한다. ticket은 직렬화·다른 receiver·재소비·취소 뒤 사용을 거절한다.
- 실제 비동기 ticket 소비 직전에 current·기한·receiver를 다시 검산한다. 소비 Promise가 정착하기 전에 factory가 성공을 반환하면 UNKNOWN/폐기이며 늦은 material 반환과 미처리 rejection을 막는다.
- 원 응답 유실·동일 consume replay·재시작 PREPARED/ATTEMPTED·timeout 뒤 늦은 응답은 factory 추가 호출0으로 남긴다. UNKNOWN을 자동 재시도로 바꾸지 않는다. CREATED_OBSERVED도 실제 writer ACTIVE나 coding Agent 실행 허가가 아니다.

## 검증·보정

Main `572ccb`:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/unit/FN06/native-preparation-client.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

**14PASS / FAIL0 / SKIP0 / 388.9193ms**, type·diff exit0, 네 지문 일치. 실제 네트워크·파일·키·factory 대신 메모리 포트와 fake factory를 사용했다.

독립 첫 C0/I2는 factory ref 결박 누락과 지연된 ticket 소비 직전 current 누락이었다. 같은 Primary의 `2ca78d` 실제2반례→보정, `64fc49` 비동기 소비 미대기의 거절 Promise 관측 실패→보정을 거쳐 최종 scoped C0/I0·변경3경로 시작/끝 지문 일치를 확인했다. 불변 local1은 재검토한 것으로 확대하지 않는다.

Primary type handle54653은 결과 미회수로 보존했으며 최종31b654와 Main의 현재 type 결과로 대체 확인했다. Primary diff의 sandbox worktree 인식128은 실행 환경 오류이며, Main의 승인 환경 diff0과 구분한다. module 부재 등 준비 실패를 기능 RED로 합산하지 않았다.

## 미완료·복구

서버 B의 host current/challenge/consume·issuer/delivery와 typed 사건/0071 확장, Web 연결은 아직 후속이다. 실제 내구 local journal·pinned TLS/보호 credential·암호 양성·native factory·writer bootstrap·실제 강제/회수·START/SEND/STOP/ACK·실제 사용자 흐름은 구현 또는 검증이 남았다. 이 단위의 미완료를 테스트 이월로 숨기지 않는다.

실제 DB/권한·키·서비스·OS/native/helper/compiler·Agent 실행·실자료 조사·P03 R3는 수행하지 않았다. 현재 사용 가능한 서비스 반영·사용자 인수·전체 FN06/FN08/계획 완료를 주장하지 않는다. source commit의 정상 revert가 복구 수단이며 기존 보호 자료·원 SQL·별도 진행 파일을 삭제하지 않는다. PR/main 병합·배포0이다.
