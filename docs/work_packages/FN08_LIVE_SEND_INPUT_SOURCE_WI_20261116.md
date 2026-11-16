# FN08 같은 Query 후속 SEND 입력 소스 지시서 r3

## 기준·책임

- 직접 채택: FN08_LIVE_SEND_INPUT_TERMINAL_CANDIDATE_20261116 r2, SHA256 23BF070B7266C660A505B9357FE71567D8748BF3866C407CE617A8286BF1778B.
- WORK_PLAN Stage C/FN08. branch codex/av3-normal-query-followup, 시작 HEAD e03e93e75a897673399a441aedc77aa6177d3531. PR145의 STOP·출력 수집을 보존한다.
- Main은 지시·검수·통합, developer_primary는 단일 제품 writer다. 다른 담당자의 편집을 되돌리지 않는다.

## 정확 쓰기 범위

제품:

1. apps/connector/runtime/normal-first-send-owner.ts
2. apps/connector/adapters/secondary/normal-instruction-wire.ts
3. apps/connector/runtime/normal-instruction-intake.ts
4. apps/connector/runtime/normal-instruction-coordinator.ts
5. apps/connector/runtime/normal-start-polling.ts
6. apps/connector/runtime/normal-start-file-store.ts

시험:

1. tests/unit/FN08/normal-instruction-dispatch-fixture.ts
2. tests/unit/FN07/normal-first-send-owner.test.ts
3. tests/unit/FN08/normal-instruction-wire-journey.test.ts
4. tests/unit/FN08/normal-instruction-polling-journey.test.ts

결과서: docs/04_test_reports/AV3/FN08_LIVE_SEND_INPUT_SOURCE_RESULT_20261116.md.

## 구현·보존 조건

- 첫 SEND의 정상 닫힘 뒤 commit에 원 receiptKey·envelopeHash·첫 종단 fullref·START 준비/init 확인 fullref를 같은 worker의 private lease에 고정한다. 첫 키와 현재 키는 달라야 한다. 호출자가 준 임의 키로 자료를 조사하지 않는다.
- 같은 원 Query의 선택형 내부 입력 포트만 사용한다. 실제 SDK 메서드·고정 실행구성·권위를 추측해 만들지 않는다. 포트가 없으면 거절하며 Query/iterator/init 생성이나 기본 SDK 호출로 대체하지 않는다.
- 원 owner의 일회 선점은 외부 속성·콜백보다 먼저 한다. 경쟁 요청은 다른 호출의 선점을 해제할 수 없다. 원 함수는 실제 함수·Proxy 여부와 동일성을 검산하고 Reflect.apply로 호출한다.
- LIVE 목적에서 현재 3행을 append·sync·재판독하고 엄격한 정상 닫힘을 확인한 뒤 입력을 제공한다. 부모와 현재 원장 잠금을 중첩하거나 역순으로 잡지 않는다. 거래 밖에서 부모 intake의 원 RECEIVED·원문 bytes, 부모 attempt 전체 정확4행·마지막 FIRST 상태/fullref·READY/init·원 grant/등록/session을 대조한다. 읽기 전후 원 lease·현재 3행·permit·현재성·기한을 다시 검사한다.
- 한 iterable이 현재 명령의 검산된 원 입력을 정확히 한 번 실제 yield하고 입력 포트도 정상 반환한 경우만 private 증표를 소비한다. pull0·실제 두 번째 메시지 제공·yield 뒤 오류·위조/복제 증표는 성공으로 정착하지 않는다. 반복·경합 next 호출에서도 실제 yield는 총1회이며, 이후 종료 확인용 next는 done:true를 반환할 수 있다. 포트가 정상 반환하면 원 증표 한 건만 소비한다. raw 본문·SDK SID는 새 원장에 저장하지 않는다.
- 현 3행을 재대조한 뒤 채택 r2의 정확 LIVE_SEND_INPUT_YIELDED 4행을 append·sync·재판독·정상 닫힘으로 확정한다. responseRef/processRef는 null이다. 부모5번째 UNKNOWN·추가행·불명에서는 입력·역사 cursor 모두0이다.
- STOP이 먼저 선점하면 yield0, yield 뒤 정상 정착 전 STOP·취소·만료·현재성 소실이면 불명과 추가yield0을 보존한다. 같은 Query 출력 수집과 STOP의 기존 동작을 유지한다.
- 역사 조회는 저장된 같은 scope의 첫 부모 키·원자료 digest·전체 원장과 현재 체인을 재검산한다. live handle/입력 증표를 재발급하지 않는다. 저장되지 않은 SDK SID로 messageDigest를 재계산했다고 주장하지 않는다.
- 정확한 현 RECEIVED/PREPARED/PERMIT_RECORDED의 마지막 필수 관측까지 기존 연속 ACK를 검산해야 페이지가 진행한다. 부분/다른 명령 ACK·원행 소실·불명은 cursor0이다. 재시작은 동일 관측 ref의 기존 복구만 사용하고 입력/Query/iterator 생성0이다.
- 기존 FIRST/generic 응답/UNKNOWN exact 형상·STOP2행·SESSION_ONLY·동일 source46/exports17/builtin4/2MiB 기준을 유지한다. 새 공개 API·서버 이벤트·SQL·권한·채널 활성화는 없다.

## r3 내부 종료 순서 보완

- I3 해결을 위해 기존 저장소 제품 한 파일을 추가한다. 원 행 형식·경로·공개 API·권한은 바꾸지 않는다. LIVE 최종 거래만 선택형 requireLiveInputClose(key, 원 guard)로 등록한다. 기존 START/SEND/STOP·역사의 비동기 해제 계약은 유지한다.
- 주입 FS의 동기 해제 포트는 앞서 고정·검산한다. 포트가 없으면 LIVE 4행 쓰기 전에 거절하며 실제 disk로 fallback하지 않는다. 실제 disk 객체를 쓰는 기존 경로만 이미 사용 중인 node:fs의 고정 unlinkSync를 참조한다. 이번 검증은 RAM 포트만 실행한다.
- 본문과 재판독 종료 뒤 lock.close 및 root·lock dev/ino 재검산의 await를 모두 마친다. 그 뒤 원 guard를 정확히 한 번 검산하고 같은 JS 호출 구간에서 고정 lock만 동기로 해제한다. 마지막 guard와 원 해제 함수 호출 사이에 await·주입 객체 getter·다른 콜백을 두지 않는다. 원 함수는 미리 캡처해 Reflect.apply로 호출한다.
- close·신원·guard·해제 불명은 lock을 보존하고 현재 및 역사 긍정 사용을 막는다. 임의 store 반환값은 보증이 아니다. 바깥 거래는 원 final guard의 정확한 실행 시점/횟수와 body·readback 완료를 비공개 표식으로 검산한다. 최종 해제 성공 뒤 취소는 이미 정착한 입력 사실을 뒤집지 않으며 ACK 미확인은 cursor0이다.
- 보장은 동일 JS owner가 관측한 취소·STOP과 종료의 순서다. OS 전원손실·외부 취소의 물리 시각·외부 파일 교체 방지를 새로 보증하지 않는다. 보상 UNKNOWN 5행의 best-effort 쓰기로 이 경계를 대체하지 않는다.

## 검증·결과 반환

- 먼저 서로 다른 첫/후속 명령을 실제 제품 경로로 생산하는 RAM 여정의 RED를 확인한다. 동일 Query/iterator 각1과 후속 yield1, 정확4행·연속 ACK·재시작 재전송0을 확인한다.
- 부모 끝 상태/fullref/READY/init·5행/중간행 변조, 두 SEND와 STOP의 동기 재진입/경합, 무pull/실제두번째제공/정상종료확인pull/반환오류, 현3/4행의 body 생략·sync/readback/close 불명·기한/current 소실을 구별한다.
- 실제 lock.close/lstat 대기 중 STOP·취소, 동기 해제 부재/변조/실패, body 전후 가짜 final guard·이중 실행, 동기 해제 직후 microtask 취소를 구별한다. 부모 UNKNOWN5행을 둔 상태에서 store가 반환값만 RESPONSE로 바꾸어도 부모 검사를 건너뛸 수 없어야 한다.
- 201번째 permit·첫200 ACK·마지막 ACK 응답 유실, 다른 명령 ACK와 역사 복구에서 잘못된 cursor 진행이 없는지 확인한다.
- 직접 시험·영향받는 STOP/출력/기존 여정, 타입, 메모리 빌드, main 대비 diff를 실행한다. 전체 회귀를 불필요하게 반복하지 않는다. 기존 기대값을 낮추지 않는다.
- 결과서에 기준/시작Git·정확명령·exit·건수·오류/수정 전후·지문·미검증·복구를 기록하고 쓰기를 반환한다. Main은 독립 검수 뒤 통합한다.
- 실제 DB·권한·키·사용자/백업 파일 조사·서비스·SDK/Agent/C# 실행·추가SDK조회·P03·미채택root9E98 활성화는 금지한다. RAM 성공을 SDK 수락·응답·종료·업무 완료로 표시하지 않는다.
