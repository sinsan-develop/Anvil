# FN07 SDK 출력 보호 저장 연결 작업지시서

## 승인과 목적

WORK_PLAN FN07/FN08, 사용자 채택86A46140DADB38CB31C9B94957E5C836532ACE8093B10A062622B3FE93E7EC9E §4/§64의 SDK_SESSION_OUTPUT 제5채널과 이후 채택9E98 profile을 함께 구현한다. 원256MiB NORMAL_EXECUTION과전체1GiB를늘리지않고기존4채널과공동예약한다. 실제SDK생산자완료나실제Windows저장지원으로보고하지않는다.

현재main e0c152e4, 작업branch codex/av3-sdk-output-storage. 기존 developer_primary 한 명만 제품을 쓰고 Main은 관리·검수·통합한다. 다른 작성자의 변경을 되돌리지 않는다. 이번은 이미 채택된 제5채널 연결이며 새 서버API·키·권한·상한을 추가하지 않는다.

## 정확 쓰기 소유

제품:
1. apps/connector/native/NormalExecutionSpoolProfileSource.cs
2. apps/connector/runtime/normal-start-file-store.ts
3. apps/connector/runtime/normal-owned-spool-profile.ts
4. apps/desktop/scripts/native-proof-runtime-entry.mts

시험:
1. tests/unit/FN08/normal-spool-profile.test.ts
2. tests/unit/FN07/normal-sdk-session-output.test.ts
3. tests/unit/FN06/native-preparation-journal-native.test.ts
4. tests/desktop/normal-execution-credential-owner.test.cjs

결과: docs/04_test_reports/AV3/FN07_SDK_OUTPUT_PROTECTED_STORAGE_RESULT_20261116.md

## 구현·검수 조건

- 원 private worker/Query 발급 시도, 등록fullref·profile/배정·slot·원grant·project/execution/generation·계획SID digest를 검산한 내부 포트만 reserve/strictExclusive/settle을 제공한다. caller SID/path/ref나 가짜 같은이름 객체로 발급하지 않는다. rawstore/withLease/범용경로를 외부로 반환하지 않는다.
- reserve 뒤 읽기·쓰기의 두 짧은 strict 거래를 각각 정상닫고 SDK iterator.next는 잠금과 물리host 점유 밖에서 기다린다. 같은 owner가 보유한 원 예약을 원근거로 검산하며, UNKNOWN/불명 정착·동일시도 재발행이나 새host를통한기한연장/미정산반환으로 우회하지 않는다. 기존 source collector의 fullbytes/init전행/격리/후행확인/fullref 검산을 유지한다.
- 다섯채널과같은profile의모든project/세대가같은256MiB·관리/최악예약을사용한다. 마지막잔량경합·미정산/정산응답유실·tail소실/동일길이중간변조·격리행재판독·교차worker/grant/session/current상실을검증한다. 기존 four-channel/receipt/native 준비의 회귀와상한은그대로다.
- 같은CJS번들의실제등록owner와원worker에서출력포트를조립해기존collector의제품함수로저장·재판독하는RAM양성과실패를검증한다. 시험전용가짜authority mint·미연결주입포트를실제연결이라고바꾸지않는다.
- 이미검증한spool단위를전수반복하지않고변경직접/인접검사·루트/desktop타입·메모리closure/공백을선택한다. 파일목록/exports/builtin 변화가실제의존으로필요하면그경로와이유를Main에게먼저반환하고임의확대하지않는다. 보안·권위·저장 의미의 미채택 변경이 필요하면 그 부분만 근거와함께보고하고나머지기존승인구현은이어간다.
- 실제 사용자/백업/SDK파일 조사·쓰기, 실제C#컴파일·PInvoke·키·DB·권한·서비스·SDK/Agent 실행·추가SSH/SDK조회는하지않는다. 소스·시험 읽기/쓰기와RAM 검증만허용한다.

정확지문·변경파일·명령/exit/결과·오류이력·미검증·복구를기록하고쓰기반환한다. Main이동결지문독립검수·commit/push/PR/병합·smoke·정리를수행한다.

## r2 — 원 origin 결박과 FIRST 원장 거래 위치

기존 동작 대조에서 원 worker/claim/query/iterator는 normal-first-send-owner.ts의 최초 출력 생성 시점에만 함께 있고, 기존 FIRST coordinator는 wire 호출 전체를 journal 잠금 안에서 수행한다. 채택86A의 원 origin 결박·두 짧은 출력 거래와 SDK next의 잠금 밖 대기를 구현하기 위해 다음 두 내부 제품 경로만 추가 배정한다.

5. apps/connector/runtime/normal-first-send-owner.ts
6. apps/connector/runtime/normal-instruction-coordinator.ts

- 등록 owner가 미리 만든 private 저장 핸들을 원 worker/claim/원 Query/iterator·실제scope에 일회 결박한다. 복제 요청/ref/digest만으로 발급하지 않는다.
- FIRST만 3행 dispatch 시도의 strict 정착·정상닫힘 → 잠금 밖 원 owner 호출 → 원3행 재검산과4행 strict 정착으로 분리한다. 같은 stack의원 ticket/worker만 진행하고 history의3행·재시작/다른 coordinator는 Query를생성하지않는다. 원 current 검사마다 같은3행을짧게재판독하며 중간변경/동시실행/close불명은UNKNOWN·새Query/permit0으로끝낸다. 일반 RESPONSE/LIVE/STOP 이력과기존dispatch 소비는유지한다.
- native SDK 출력 전용 정상읽기 완료가 증명된 때만 scope/slot/원grant/allocation/request digest/원원장 before와 단계별 일회 challenge를 보호 기록해 다음 짧은 거래로 인계할 수 있다. UNKNOWN/진행중/응답유실 예약의 일반 RESUME 거절은 유지한다. 원 단발증표·owner·기한·재판독을 모두 검산하고 새 host의 임의 holdId 정산은 거절한다. 다른 채널의 STOP/독립 작업은정상닫힌SDK읽기예약때문에막히지않되잔액은계속최악예약으로차감한다.
- 물리 host의각10초/64frame과 원 logical owner/collector·grant의절대기한을구분하고 어느기한도새host로연장하지않는다. SDK next 대기를임의로10초이하로축소해양성만맞추지않는다. 원 collector 기한 안에서 물리host를해제하고나중의두번째거래를검산하는근거를정확히기록한다. 미채택권한/새공개API·상한을추가하지않는다.
- 원 FIRST3행 정착 뒤 동시조작/별도coordinator 재진입·이력재생은 추가생성0, 원 SDK next 미해결 중같은등록/세대의독립작업/STOP완료, 원native증표재사용/위조·교차owner/phase·정산유실의거절을관측반례로검증한다. 기존4시험외추가시험경로가필수면Main에게정확히반환한다.

이는 이미 채택된 원 출력·첫 SEND 종단을 연결할 내부 코드 배치/거래 순서 보완이며 새 기능·권한을 승인한 것이 아니다. 실제 C#/FS/SDK·Agent 실행은 계속 제외한다.
