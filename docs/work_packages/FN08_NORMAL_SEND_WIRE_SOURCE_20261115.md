# FN08 normal SEND 명시 전달 연결 source 작업지시

기준: PR118 main3ce883045554b8f56fe0d35d6e080471ff0c4d3a, branch codex/av3-fn08-send-wire. Main 어울 관리·검수, 기존 developer_primary 단일 writer.
근거: 기존 채택 P3 D1 A안 §3.1의 수신→permit→wire 및 normal SEND §5~6. 이번은 새 공개 API/권한 없이 내부 typed port·로컬 attempt 행을 연결하는 source/RAM 구현이다.

## 허용 6경로
- apps/connector/runtime/normal-instruction-coordinator.ts
- apps/connector/adapters/secondary/normal-instruction-wire.ts (신규)
- tests/unit/FN08/normal-instruction-coordinator.test.ts
- tests/unit/FN08/normal-instruction-wire.test.ts (신규)
- tests/unit/FN08/normal-instruction-wire-journey.test.ts (신규)
- tests/unit/FN08/normal-instruction-dispatch-fixture.ts (기존 기본값 보존)

Main 소유는 지시·상태·결과 문서와 Git 통합이다. 다른 변경을 되돌리거나 동일 파일 writer를 중복하지 않는다.

## 구현과 보존 조건
1. 기존 prepare 결과와 재조회 의미를 유지한다. 같은 coordinator의 신규 permit 기록과 strict-close가 확정된 원 결과 객체만 private WeakMap으로 결박하고, 별도 명시 dispatch에서 한 번 소비한다. 복제/직렬화/재시작 조회는 소비 권위를 만들지 않는다.
2. 같은 attempt 채널 잠금에서 원 RECEIVED bytes, SEND_ATTEMPTED/PERMIT_RECORDED, sessionBindingRef, 현재 관측/최단기한을 다시 대조한다. 원 SEND의 독립 승인 영수증/예산을 START 값으로 대체하지 않는다.
3. driver 진입 전 SEND_DISPATCH_ATTEMPTED를 append/sync/readback한다. 기존 행의 닫힌 형상과 역사 조회는 보존하고 새 상태 행만 별도 검산한다. sync/읽기/잠금 불명 시 driver0·원 기록/lock 보존, 자동 재실행0.
4. 신규 SEND 전용 adapter와 NormalInstructionDriver를 사용한다. 원 coordinator 단발 결박·intake 원문·envelope·원 localAttemptRef·permit/proofResultRef를 exact 대조한다. START options/context/driver나 SYNTHETIC_ONLY 권위를 전용하지 않는다. 기본 실제 driver는 등록하지 않는다.
5. 정확한 기존 normal 관측 형상 {transport:'NORMAL_PROTECTED',responseRef,processRef}만 받는다. 근거 없는 ref를 생성하지 않고 processRef는 근거 없으면 null이다. 관측을 SDK 수락·작업 완료로 표시하지 않는다. 반환을 RESPONSE_RECORDED에 저장하며 throw/timeout/늦은 반환/기록 불명은 UNKNOWN으로 봉인한다.
6. PERMIT_RECORDED 재시작은 계속 조회만 한다. SEND_DISPATCH_ATTEMPTED 이후 재시작은 driver 추가0이다. WeakMap을 내구 기록 대신 쓰지 않는다.
7. spool/ACK·polling·cursor는 이번에 연결하지 않는다. 실제 SDK Query 생산자·논리 session과 SDK SID/child 매핑은 미정이며 추측하지 않는다. 새 공개/권한 의미가 필요하면 정확 delta를 분리한다.

## 검증·제출
실제 서버 RAM handler→SEND 자료→내구 수신→명령별 permit→명시 RAM driver→관측 ref 저장의 첫 RED→GREEN을 보인다. 다른 명령/세대/session, 원문/permit/attempt 변조, 복제 결과 객체, current 철회/기한, 동시 호출, dispatch sync/readback 실패 시 driver0, 응답 유실/늦은 반환/응답 기록 실패 후 재시작 추가0을 검증한다. 기존 prepare 재조회·START 인접을 보존하고 필요한 typecheck·diffcheck, 최종6지문·정확 명령/종료/실패이력을 제출한다. 마지막 시험 추가 후 영향을 받는 전체 시험 파일도 검증한다.
실제 DB·권한·키·파일 조사/생성·설치·서비스·SDK/Agent/C# 실행은 제외한다. 메모리 포트만 사용한다. 실제 실행이나 전체 계획 완료로 보고하지 않는다.
