# FN08 START 두 자료 등록 A안 source 구현 지시서

2026-11-06 / Main 어울 / 후행 준비. 이 문서만으로 동시 작성·시험/제품 GO가 생기지 않는다.

## 승인·선행

직접 승인 기록 docs/work_packages/FN08_FN09_START_PREPARATION_SOURCE_DIRECT_APPROVAL_20261106.md SHA256 C82C16EB3AAE2035B8273392549130702167396ACD34095A4617E2D21B6A228B.
채택 계약 docs/contracts/FN08_START_MATERIAL_REGISTRATION_CANDIDATE_20261106.md SHA256 8AE16D6CAB5334FAC4548688777AE44560997BB0D0C78816CB340A114A7E4384.
선행 FN09 r2 준비/Options 원문의 구현·한정 검수 후 기존 Primary에게만 순차 배정한다. 후보 원문은 승인 지문을 유지하고 과거 미채택 표기는 직접 승인 기록으로 해소한다.

목표는 같은 START 명령에 context/options 두 그룹 자료를 원 Tx·봉투·영수증·등록·부분 보호조회/proof와 결박하는 실제 source 연결이다. 선언된 ref·합성 resolver 성공만으로 원문 producer나 실행 권위가 완성됐다고 하지 않는다.

## 단일 writer와 허용10

기존 Primary만 코드·시험·미적용 SQL을 작성한다. Main은 문서/검수/통합, 기존 독립 담당자는 read-only다. FN09 작성 중 이 작업의 코드 write0이며 별도 Main GO 후 시작한다. 다른 담당자의 변경·보호 비추적3을 되돌리지 않는다. 새 agent/chat/branch/자동화0.

기존 수정1:
- apps/server/modules/executions/execution-commands.ts
- 시작14271B/SHA256 A77EE9D8EA0CFB30EF2646F21F2259253F4E67A6996ED671CD87F0A03B76464A.

신규9:
- apps/server/modules/executions/execution-start-material-registration-input.ts
- apps/server/modules/executions/execution-start-material-registration-store.ts
- apps/server/modules/executions/execution-start-material-parts.ts
- apps/server/modules/executions/execution-start-material-basis.ts
- db/migrations/0078_start_execution_material_registration.sql.pending
- tests/unit/FN08/execution-start-material-registration.test.ts
- tests/unit/FN08/execution-start-material-registration-store.test.ts
- tests/unit/FN08/execution-start-material-registration-schema.test.ts
- tests/unit/FN08/execution-start-material-registration-flow.test.ts

독립 읽기에서 신규9 부재와 기존1 지문 동일을 확인했다. 실제 GO 직전에 다시 검산한다. 허용 외 파일이 정말 필요하면 정확 접점·최소 diff를 Main에게 반환하며 조용히 추가하지 않는다. 내부 파일 배치는 Main이 판단하며 승인 범위의 같은 구현을 사용자 재승인 대기로 바꾸지 않는다.

## 보존

기존 SEND input/store/parts/fixture·instruction queue·0062 및 과거 SQL, START payload/queueIntent/ProjectResult·봉투·14필드 material·connector GET/오류 wire·receiver·기본 app 미주입은 보존한다.

공통 wrapper 두 파일은 구조적 START basis/parts/results 포트로 재사용하고 수정하지 않는다.
- execution-instruction-material-store.ts: 8000B/SHA256 84B9842D3CE252D1578B1D586DA8238C9BE263EFCB45A290B0C77600B8D461DC.
- execution-authenticated-materials.ts: 6907B/SHA256 0845D7AD5F303ECF88325B6D25175AADD2C5185D9E8E56C9F25F5D743F60DA12.

0017의 check_initial_execution_graph는 HUMAN 생성 시 그대로 유지한다. connector 후행 조회에서 HUMAN GUC/이 함수를 재사용하거나 임의 HUMAN actor를 만들어 권위를 대신하지 않는다. receiver 또는 SEND parser를 넓혀 START를 억지로 통과시키지 않는다.

## 닫힌 descriptor·source

채택 계약 §3 exact descriptor를 그대로 구현한다. purpose START_CONTEXT_OPTIONS_MATERIAL_V1, sourceKind SYNTHETIC_REFERENCE_ONLY_V1, EXECUTION scope·원 grant/credential 세대·commandId·원 두 payload refs·정확2그룹·expiresAt을 검산한다. CONTEXT_BUNDLE→START_OPTIONS 순서, 같은 fullref 금지·그룹별 payloadRef 일치, 원 source/body/origin refs와 bytes SHA·미디어/길이·부분 연속/offset·materialId 전역 유일을 유지한다.

추가키·누락·중복 JSON key·오염 원형·불량 UTF-8/Ref/숫자·hash 불일치는 거절한다. descriptor canonical 2MiB, 부분 합계200, 각 source/부분 기존2MiB, 새 START 두 source 합계2MiB를 정확히 적용한다. 더 작은 receiver 설정을 늘리지 않는다.

원 source/current의 실제 결과를 대조하고 없는 원문은 SOURCE_UNAVAILABLE로 남긴다. 본문/경로/Secret을 metadata에 저장하지 않는다. Options source는 선행 FN09의 실제 preparationRef/options body·원 closure와 bytes/hash 구분을 유지한다. 실제 context 원문 접근·executor 권위를 새 성공 대역으로 만들지 않는다.

SYNTHETIC_REFERENCE_ONLY/SYNTHETIC_ONLY의 명시 포트를 통해 실제 등록 모듈을 시험하는 것과 실제 보호 원문 supplier/Agent 실행을 구분한다. 기본 app/실환경에 자동 주입하지 않는다. 타입만 맞춘 caller success 주입으로 원 current/source 검산을 생략하지 않는다.

## 원 Tx·등록·replay

같은 원 HUMAN Tx/PoolClient에서 source/current→두 그룹 descriptor prepare→기존 queueIntent·receipt→원 envelope→queue/grant/예약/writer/outbox/등록→최종 current/정산 검산을 연결한다. 정확 순환 회피는 채택 계약의 원문 순서를 따른다. descriptor 준비에는 최종 receipt/envelopeHash를 미리 넣지 않는다. manifestRef는 실제 descriptor id/version1/canonical hash다.

등록은 기존 명령당 manifest1개 제약을 유지하고 descriptor1개 안의 두 그룹으로 처리한다. 두 source마다 manifest를 추가하지 않는다. 원 command/receipt/envelope/outbox·grant/예약·실행/세대와 정확14 material 필드를 원자 결박한다. 누락/중간 실패는 전체 rollback이다.

동일 원 command replay는 원 등록·원문/봉투/receipt 결박을 검산하고 새 등록/승인 소비/추가 charge0이다. 다른 원 body/refs는 conflict이며 COMMIT/응답 불명은 UNKNOWN 보존·새ID/자동 재전송0이다. 과거 미등록 START의 사후 등록/완결 보충은 하지 않는다. 미구성 registrar도 성공으로 통과시키지 않는다.

## 보호 부분·proof·한도

새 START basis/parts는 공통 구조적 포트의 exact 응답과 현재성 검사를 지킨다. 등록 descriptor→정확 그룹/material→실제 원 bytes/hash→현재 grant/등록/실행·credential 세대/기한·원 command/envelope/fullref·정확 GET target을 모두 대조한다. 다른 command/grant/payload/source/target·만료·중지·회수·불명은 거절한다.

같은 원 challenge Tx의 receipt→material binding→nonce 소비→최종 current/bytes 순서를 유지한다. bind/read replay는 같은 원 proof와 기록에 결박하고 consumed지만 binding 없는 과거 결과를 새 성공으로 보충하지 않는다. 실제 source bytes가 바뀌면 원 ref를 선언하는 것만으로 허용하지 않는다.

기존 세 등록표의 프로젝트100000행/1GiB, grantID 모든 버전10000행/64MiB를 SEND+START·전체 이력 합산에 적용한다. 같은 자료 이력·만료를 제외하거나 새 별도 무료 quota를 만들지 않는다. 같은 Tx 잠금·최종 정산·역완결/사후 누락 삭제 우회를 검산한다.

## SQL0078

새 forward SQL만 작성한다. 기존 SEND/0062는 그대로 두고 START 전용 purpose·exact descriptor·두 그룹/부분·proof·원 command/result/envelope/receipt·outbox/등록·원/역완결과 전체 누적 한도를 추가한다. 기존 INVOKER/ACL/보호와 SQL NULL/JSON null·정확 객체 필드를 보존한다. trigger disable·광범위 constraint 삭제·기존 행 변환0, 실제 SQL/DB 실행0이다.

## TDD/결과

Main TEST_ONLY GO 전에는 시험도 쓰지 않는다. 첫 단계 신규 시험4에서 실제 기존 ProjectInitialExecutionQueue가 적합 START를 등록하지 않는 행동 RED와 기존 queue 결과/권한 guard 보존을 확인한다. 신규 module/export 부재·fixture 오류를 기능 RED로 꾸미지 않는다. Main이 행동 RED/기존 지문·WI 검수를 확인한 후 허용10 PRODUCT_GO를 발행한다.

정상/중요 음성:
- 그룹 순서/교환·동일 ref·중복 materialId·offset 공백/중첩·추가키/불량 bytes/hash.
- 원 Tx 등록 누락·rollback·사후 orphan/원 command·result·envelope 변조.
- 다른 주체/project/command/grant/세대·source/target·회수/중지/만료·UNKNOWN.
- 원 proof binding/소비 순서·consumed orphan 재확인 거절.
- 두 source 합계2MiB·200부분·SEND+START 프로젝트/grant 전체 합산·더 작은 receiver 한도.
- 동일 replay 추가 등록/charge0·다른 원문 conflict·COMMIT 불명 보존.
- 실제 새 등록 모듈→공통 Tx/보호 GET/proof→기존 receiver.startOptions 종단 및 SEND 직접 인접 회귀.

기존 시험 execution-command-ledger.test.ts, execution-material-registration-schema.test.ts, execution-materials.test.ts, execution-material-receiver.test.ts는 직접 인접 읽기/선택 실행만 허용하고 기대값을 고치지 않는다. 전수 회귀를 반복하지 않는다. 기존 node/TypeScript/build 도구와 메모리 합성만 사용하며 실제 listener/네트워크/DB/권한/키/서비스/SDK/Agent·실자료·dependency 설치0이다.

정확 변경 지문/diff·실행 명령/exit·RED와 준비 오류·미실행/잔여·live/pending·rollback을 Main에게 반환한다. Main 독립 코드/SQL 검수·fresh 최소 검증 뒤 통합하며 source-only를 실제 PG/TLS/OS/Agent·전체 FN08/계획 완료로 승격하지 않는다.
