# FN08 spool 외부 callback 분리 내부 구현 보완

기준은 신산님이 채택한 profile r2 SHA256 9E98D4EAA162B2E12498DCC3742D7E33921EB688B794ACA8CFF8187C0FCE9C4C §6의 외부 current/wire/observer callback을 ticket 밖에서 호출하는 계약이다. 최초 허용목록의 entry에서 wire를 포장하면 원 READY wire의 private 신원이 달라져 해당 기능이 UNSUPPORTED로 남는다. ddf5fc의 원 pair를 이용한 외부 대여 성공은 거절 조건 누락의 RED이며, generic 경로만 포장한 4ecf0f는 부분 구현 근거다.

Main 판단: 새 권한·공개API·저장 의미·기능 범위 변경이 아니라, 채택된 외부 callback 격리와 원 wire 신원을 동시에 보존하기 위한 내부 호출 위치 보완이다. 기존13제품에 apps/connector/runtime/normal-start-coordinator.ts 한 경로만 추가 배정한다. 기존 primary 단일 writer가 수행하며 다른 작성자 변경을 되돌리지 않는다.

## 정확 변경

- coordinator는 기존 허용 파일 normal-owned-spool-profile.ts의 outsideOwnedSpoolCallback을 정적 import한다. 해당 helper는 원 private AsyncLocalStorage.exit만 수행한다. 새 ticket/session/권위·caller 주입 옵션을 만들거나 CJS 공개 export를 추가하지 않는다.
- current.current 원 호출1곳과 wire.send 원 호출2곳만 helper로 감싼다. 기존 원 객체와 인자·반환·await·throw·기한·검산 순서를 보존한다. isNormalStartReadyWire/consumeNormalStartReady/settledStarts는 원 wire를 그대로 쓴다.
- entry의 임시 READY 거절과 포장 문제를 같은 허용 entry/profile 파일에서 제거해 원 READY 경로를 연결한다. 단독 legacy 경로와 원 권한·UNKNOWN·원장 검사는 유지한다.
- 기존 허용 시험8경로에서 원 READY identity 양성, 외부 current/wire/observer의 대여 거절, 반환된 ticket/교차 owner/늦은 자손 거절, 원40frame 또는 실측 총64이하와65번째 발송0을 검증한다. expected값을 느슨하게 바꾸지 않는다.
- 원 READY 준비 수락은 SDK 실행이 아니다. 실제 OS/파일·권한·키·DB·서비스·SDK/Agent/C# 실행과 기존 차단 해제는 계속 제외한다.

제품 동결 뒤 기존 담당자와 분리해 독립 검수하고, 정확 file 지문·RED/GREEN·타입·메모리 closure·잔여를 결과서에 기록한다. 새 저장 목적이나 허용목록 밖 추가 의존이 나오면 정확한 근거를 Main에게 먼저 반환한다.

## r2: 원 READY의 내부 보호 재조회

원 READY wire는 원 intake를 재검산하므로, 외부 callback 마스킹을 제거하거나 원 read를 생략해 성공시키지 않는다. 기존 목적 factory의 createStartPolling과 구분한 명시 createWorkerStartPolling을 허용한다. CJS export/서버/renderer/API 권한·원 wire 신원은 추가하거나 바꾸지 않으며 옵션 생략 fallback은 없다. 내부에서 원 NormalClaudeStartWire.forWorker를 조립한다.

기존 허용 profile/entry 파일 안의 private read-only intake는 같은 journal closure·원 store·owner·signal·profile/slot/session·project/execution/generation/command와 원 attempt 및 기한에 결박한다. native reserve 뒤 run(path,io) 시작에서만 parent ticket을 설정하고 finally에서 즉시 해제한다. 현재 t.live, !child, !borrowed와 빈 외부 ALS를 확인하고 중첩 진입 전에 used=true로 소진한다. 원 root 검산은 매 await와 반환 시 유지한다. 내부 tx는 read/readPart만 가능하고 append는 거절한다.

원 READY wire만 이 reader를 보유한다. controller 외부에는 lease/path/store/intake/ticket을 반환하지 않는다. 새 poller를 current 안에서 재조립하면 별도 journal closure라 parent가 없고 첫 보호 GET은 원 host BUSY로 거절되어야 한다. 중복·반환 뒤·기한/취소/정산 뒤·늦은 자손·교차 owner의 재조회는 거절한다. 원 재조회/출처 검산을 생략하거나 외부로 부모 대여권을 복구하지 않는다.

f293e4의 원 READY 명시 조립 메서드 부재 RED를 같은 공개 목적 factory/원 READY 양성으로 닫는다. generic 양성은 실제 READY 증거를 대신하지 않는다. 이 보완은 기존 허용 파일과 위 coordinator1개 안에서 수행하며 신규 host 목적/권한/저장 계약은 없다.
