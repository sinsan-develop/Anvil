# FN07 normal START 준비 인수 — 소스 구현 지시서

수정 r2: 임의 validator를 받는 내부 helper로 원 옵션 검산을 생략하지 않도록, 증표 생산·검산을 원 wire 모듈의 private 범위에 고정한다. 그 정적 import가 기존 CJS 그래프에 요구하는 순수 source 네 개를 목록에 명시한다. 이는 Main의 내부 파일·빌드 목록 보완이며 계약·권한·실행 범위를 늘리지 않는다.

## 기준·목적

- WORK_PLAN FN07/FN08의 기존 코딩 도구 연결, 직접 채택된 FN07 계약 §2를 구현한다.
- 채택 원문: `docs/contracts/FN07_NORMAL_QUERY_OUTPUT_OWNERSHIP_CANDIDATE_20261116.md`, SHA256 `86A46140DADB38CB31C9B94957E5C836532ACE8093B10A062622B3FE93E7EC9E`.
- 시작 main: `3c420b4157a77d7da08ac80d9c07cc642dbb581d`; branch: `codex/av3-fn07-normal-query-output`.
- 담당 writer: 기존 developer_primary. Main 어울은 지시·독립 검수·통합을 맡는다. 다른 사람의 변경을 되돌리지 않는다.
- 이 단위는 원 worker의 START 준비 인수와 내구 로컬 종단·ACK/cursor까지다. 실제 Query 생성·SDK/OS 실행 또는 일반 출력 보호 저장 완료를 의미하지 않는다. 후속 단위를 생략하거나 전체 FN07을 완료로 표시하지 않는다.

## 정확한 제품·시험 범위

제품 5개:

1. `apps/connector/adapters/secondary/normal-start-wire.ts`
2. `apps/connector/runtime/normal-start-coordinator.ts`
3. `apps/connector/runtime/normal-start-file-store.ts`
4. `apps/connector/runtime/normal-start-polling.ts`
5. `apps/desktop/scripts/native-proof-runtime-build.cjs`

시험 5개:

1. `tests/unit/FN08/normal-claude-start-wire-journey.test.ts`
2. `tests/unit/FN08/normal-start-coordinator.test.ts`
3. `tests/unit/FN08/normal-start-file-store.test.ts`
4. `tests/unit/FN08/normal-start-polling-journey.test.ts`
5. `tests/desktop/native-proof-runtime-build.test.cjs`

새 제품 파일·서버·SQL·공개 enum은 이 단위에서 바꾸지 않는다. desktop 정적 source 목록은 39→43으로 변경하며 추가 항목은 normal-start-wire.ts, start-options.ts, schemas.ts, execution-material-receiver.ts 네 개뿐이다. 뒤 세 source는 읽기 전용이다. EXPORTS17·builtin4·2MiB 상한과 빌드 전후 exact source 검산을 유지한다. SDK/fs/외부 모듈을 추가하지 않는다. 결과서는 `docs/04_test_reports/AV3/FN07_NORMAL_START_READY_SOURCE_RESULT_20261116.md`에 작성한다. Main만 WORK_STATUS·WORK_CHECK를 갱신한다. 기술상 추가 경로가 꼭 필요하면 이유와 영향을 Main에게 먼저 알려 허용목록을 조정하며, 기존 계획 안의 내부 보완을 사용자 재승인 사유로 만들지 않는다.

## 구현 불변식

1. 기존 full bytes·current·permit 검산을 유지한다. 원 worker 인스턴스의 private 슬롯이 원 START 자료와 허가를 실제 인수한 뒤에만 단발 준비 증표를 만든다. key/envelopeHash·세대·grant·receivedRef·localAttemptRef·permit.ref·contextBundleRef/optionsRef를 결박한다. bool, 일반 callback 결과, JSON 복제, 다른 owner·wire·시도·기한이나 재사용으로 증표를 만들 수 없다. 이 준비 owner는 실제 Query나 SDK·OS 소유자가 아니다. 후속 작업 신호와 이번 호출의 취소 신호를 혼동하지 않는다.
2. 같은 START 시도 원장의 세 번째 행으로만 START_READY_RECORDED를 허용한다. 첫 수신행과 두 번째 permit행의 부모·내용을 대조하고 responseRef/processRef는 null이다. 기존 RESPONSE_RECORDED·UNKNOWN의 형상과 역사 의미를 유지한다. 해당 신규 경로와 그 역사 재생은 같은 거래의 정상 닫힘까지 확인해야 한다. 기존 generic exclusive의 의미는 바꾸지 않는다. 필요한 strict-close 포트를 제공할 수 없으면 긍정 결과를 내지 않는다. 잠금 close 불명은 원 잠금을 보존하고 UNKNOWN·cursor 0이며 자동 재시도하지 않는다.
3. 로컬 준비행을 새 서버 관측으로 투영하지 않는다. 기존 RECEIVED, PREPARED/NONE, START_ATTEMPTED, PERMIT_RECORDED 네 사건만 원 ref·시각으로 재생한다. 마지막 PERMIT_RECORDED의 spool.record 반환 ref를 ACK 대상으로 고정한다. 로컬 준비 종단 정상 정착과 그 ref까지의 연속 ACK를 각각 확인한 뒤 START cursor를 진행한다. 준비행의 ref와 spool 사건의 ref를 혼동하지 않는다. 일반 RESPONSE 경로의 다섯 관측과 SEND/STOP의 기존 동작을 유지한다.
4. 불완전 시도, 종단 없이 permit ACK만 존재, 정착/ACK/현재성 불명은 성공으로 진행하지 않는다. 재시작은 원 준비행과 관측의 역사 복구만 가능하며 자료 GET·permit·wire·worker 인수·Query 생성의 재실행은 없다. 역사 ref를 새 live capability로 사용하지 않는다.
5. 같은 모듈 그래프의 원 wire private 생산·검산 경로로 준비 증표를 소비한다. coordinator는 원 wire 모듈의 고정 소비 함수를 정적 import하고 역방향은 type-only로 유지한다. 임의 validator/mint/register 함수를 외부에 열지 않는다. PR141 조립을 재구현하거나 별도 번들의 WeakMap 증표를 받아들이지 않는다. CJS의 실제 새 owner 조립은 여전히 후속이며 기존 외부 wire 응답 경로를 보존한다. exact43 그래프의 실제 메모리 Vite 빌드·import 효과 0·기존 17개 export와 4개 builtin·2MiB 상한을 검증한다.

## 검증·보고

- 필요한 실패 사례를 먼저 실행해 결함을 확인하고 구현 후 같은 사례와 직접·인접 회귀를 검사한다. 실제 fs/서비스/DB를 만들지 않고 기존 RAM fs·전송 시험 도구만 사용한다.
- 양성: 원 owner 인수 1회, Query/SDK/OS 0회, 정상 닫힘과 네 필수 사건 전체 ACK 뒤 cursor 1, provider 응답 관측 0.
- 음성: 위조·복제·다른 owner/시도·재사용·기한 교체, close 실패·상한·취소, 200+1 부분 batch·ACK 유실·불완전 원장·재시작·늦은 결과. 기존 RESPONSE·SEND·STOP의 직접 영향도 확인한다.
- 변경 범위 타입 검사와 diff 검사를 실행한다. 기존 불변 진단이 있으면 새 회귀와 분리하고 PASS로 바꾸지 않는다. 코드·환경이 같은 전체 검사를 반복하지 않는다.
- 결과는 명령·종료 코드·실제 건수·변경 파일 지문·미실행·남은 단위·rollback을 포함한다. mock/RAM과 실제 SDK·보호 저장·사용자 인수의 증거를 분리한다.
- 실제 DB·권한·키·서비스·SDK/Agent/C# 실행·사용자/백업 파일 조사·추가 SDK 조회·P03 실행은 제외한다. 보호 spool 9E98의 생산자나 배정을 구현·활성화하지 않는다. 새 위임·실행 승인·권한으로 해석하지 않는다.
