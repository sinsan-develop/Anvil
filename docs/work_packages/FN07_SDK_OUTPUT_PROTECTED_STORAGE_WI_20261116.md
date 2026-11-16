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
