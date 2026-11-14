# FN08 normal SEND 내구 수신·시도·permit source 작업지시

상태: 기존 P3 D1 A안 §3.1 실행기 source 및 normal SEND 채택 §5~6 내부 구현. Main 어울 관리·검수, 기존 developer_primary 단일 writer.
기준: PR117 main93c85d78ce133d9fce19e32859c94ed8d0ca9ee5, branch codex/av3-fn08-send-durable-intake.
목표: 서버 START→SEND→혼합page→보호부분GET→SEND전용내구RECEIVED→SEND_ATTEMPTED→PERMIT_RECORDED까지 RAM여정을 연결한다. 실제 실행이나 전체 계획 완료가 아니다.

## Primary 정확 허용8경로
- apps/connector/runtime/normal-instruction-intake.ts (신규)
- apps/connector/runtime/normal-instruction-coordinator.ts (신규)
- apps/connector/runtime/normal-start-file-store.ts
- tests/unit/FN08/normal-instruction-intake.test.ts (신규)
- tests/unit/FN08/normal-instruction-coordinator.test.ts (신규)
- tests/unit/FN08/normal-instruction-durable-journey.test.ts (신규)
- tests/unit/FN08/normal-start-file-store.test.ts
- tests/unit/FN08/normal-instruction-dispatch-fixture.ts (선택형시험지원, 기존기본값불변)

Main은문서·검수·Git통합만담당한다. 다른작업자의변경을되돌리지않고동일파일writer를겹치지않는다. 범위추가가필요하면정확delta를Main에반환한다.

## 내부형상과검산
1. 기존 intake-<commandId>에 SEND전용 MATERIAL/RECEIVED 행을append한다. ref/snapshot, sequence/previousRef,receiptKey,envelopeHash,descriptorHash,materialId/hash,proofResultRef를결박한다. 부분bytes는sync·재읽기후기존INSTRUCTION codec으로재조립한다. START행을SEND로cast하지않는다.
2. 공통 project/assignment/execution/generation, connection/environment/capability/sourceScopes/executorRegistration은정확비교한다. authorizationReceiptRef/budgetRef만해당SEND의독립값으로보존한다. 무시필드를넓히지않는다. sessionBindingRef는원봉투/attempt/current envelopeHash에결박하며서버permit의원세션검산을유지한다. 실제current생산자가존재한다고주장하지않는다.
3. 기존NormalJournalStore에SEND typed adapter를추가하되private root scope,3MiB/파일·64MiB/채널·10,000행·불명lock보존을유지한다. 신규root/ACL/native namespace/자동삭제/자동재실행없음. 기존file store의directory fsync·전원손실내구성한계를유지한다.
4. attempt-<commandId>에SEND_ATTEMPTED→PERMIT_RECORDED 또는UNKNOWN을append한다. key/envelopeHash/grantRef/sessionBindingRef/receivedRef/previousRef/시각을결박한다. 첫행ref를permit localAttemptRef로사용한다. 원자료/현재source/OS관측검사를START의과거값으로대체하지않는다.
5. 기존NormalProtectedPostClient.preparePermit/send를그대로사용한다. 축약permit의ref.hash를축약객체로재계산하지않는다. 저장후원문/행재읽기를확인한다. 기존PERMIT_RECORDED는기록조회만반환하며현재실행허가로승격하지않는다. 미완료attempt/UNKNOWN은재시작에도추가challenge/permit0으로닫는다. sync/readback/잠금종료불명은기록보존·자동재시도0.
6. wire/polling/cursor는변경하지않는다. START전용context/options driver를SEND로재해석하지않는다. 반환은현재실행권한false·dispatchfalse를명시한다.

## 검증
첫RED는위전체여정의SEND내구수신/permit미연결이다. SEND자체receipt/budget다름성공,scope/세대/session/재봉인변조거절,부분write/sync/readback실패·동시호출·재시작·중간permit응답유실/변조·회수/만료/abort에추가permit0을확인한다. 단독시험도MemoryFS초기화가선행한다. 기존START/file-store직접회귀·root typecheck·diffcheck,동결8지문·정확명령/실패이력·live0을제출한다. 독립검수후Main한정재검증/통합한다.
실제DB/권한/키/파일조사/파일생성·설치/서비스/SDK·Agent/C#실행0. store시험은RAM filesystem만사용한다. 성공합성시험을실제TLS/DB/OS내구성/실행증거로표시하지않는다.
