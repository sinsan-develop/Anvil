# FN09 원자료 기반 합성 START 입력 연결 지시서

- 상태: MAIN_INTERNAL_SOURCE_GO. 새 발급 계약 채택 또는 실제 실행 승인이 아니다.
- 부모: 신산님 FN09 r2 source-only 승인, 원자료 통합 bbd20aa5, 시험 보완 5bac8073.
- 기준: FN09_ORIGIN_ISSUANCE_CURRENT_FACT_CANDIDATE_20261107.md §3.1, SHA256 97B35B967F7B642C610A8F21FEF3EE858397BFC885D950ACAE98B24AD8D94156. §4~9의 발급/권한 계약은 미채택.
- 기존 Primary 한 명만 아래 3개 코드/시험 경로를 작성한다. Main은 나머지 작업현황과 검수·통합을 맡는다.

정확 허용 경로:

1. apps/server/modules/executions/execution-start-origin-queue-basis.ts — 신규 내부 생산자.
2. apps/server/modules/executions/execution-budget.ts — 기존 순수 readClaim의 내부 별칭 export만. 검산 본문·호출부·오류 불변.
3. tests/unit/FN09/execution-start-origin-queue-basis.test.ts — 신규 메모리 검수.

## 구현·검수

원 S/Q를 실제 store에서 C/A/U/R와 함께 검산하고 현재 readExecutionStartOrigins 정책·원 출처 읽기권·FRESH의 동일 actor/Session/H/제어/tx를 대조한다. 검산된 원 등록 request는 조회에만 쓰며 재실행하지 않는다. START 입력의 실행 ID/lifecycle·preparation/context/options·permission/budget refs를 맞추고, exact13을 기존 registrar가 쓰는 공통11로 투영해 원 reader로 검산한다. source의 Options format/bytes/hash·원기한, Q의 RESERVED_NOT_ISSUED와 false를 보존한다. claim의 commandId는 새 START 명령에서만 가져오고 나머지는 검산한 원자료와 명시 합성 demand에 결박한다. 반환은 기존 SyntheticQueueResolver.basis의 정확 {intent,claim}이다. 원 source 원문/발급 사실은 반환하지 않는다.

기존 authorizeExecution/queue 정책·writer·예산 예약·current는 후속 소비자 검사 그대로다. 별칭으로 기존 demand 검산을 쓰고 임의 비용·시계·source fallback을 만들지 않는다. 입력/포트 변경, actor/Session/tx 불일치, 최소기한·취소 뒤 반환 금지와 남은 읽기의 실제 정착 경계를 §3.1대로 유지한다. same Tx의 기존 보호 읽기/잠금 외에 BEGIN/COMMIT 소유·domain mutation·예약/소비·current/grant/E/발급0. 합성 포트에서만 사용할 내부 입력이고 HTTP/DB 스키마/정책/화면 계약 변경0이다.

먼저 실제 producer/reader를 기존 메모리 fixture로 연결한 정상 실패 증거를 확보한 뒤, 정상 exact11/claim9·원 자료와 queue commandId·부작용0을 검증한다. 잘못된 S/Q·실행/제어/Session/원ref·Options·UNKNOWN/OBSERVED·수요 변이·query/Tx 교체·응답 HOLD·만료를 검증한다. 독립 M1은 호출 abort와 실제 queue.cancel의 CANCELLED 원자료를 분리하고, origin 읽기권은 남겨 원 출처 권한만 회수한 경우도 추가한다. source 실패를 보관 조회 fallback으로 성공시키지 않는다. 기존 ledger의 current 합성 모델은 변경하지 않으며 연결 지점은 tests/unit/FN08/execution-command-ledger.test.ts이다. 신규 집중·직접 인접 해당 파일·필요 type/diff만 실행하고 기존 FN09 48/build를 반복하지 않는다.

금지: 실제 DB/SQL·권한·키·서비스·SDK 추가 읽기/Agent·실자료·P03 R3/J3·새 branch/원격/PR/병합. 해당 파일 외 쓰기가 필요하면 확대하지 말고 변경점과 근거를 Main에 반환한다. 정확 raw 지문·diff·시험 명령/종료·오류/미검증·live0를 반환해 writer를 동결한다.
