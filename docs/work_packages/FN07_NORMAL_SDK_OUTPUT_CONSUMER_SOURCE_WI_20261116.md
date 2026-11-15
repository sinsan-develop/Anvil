# FN07 SDK 출력행 검산·소비자 — 소스 구현 지시서

## 기준과 순서

WORK_PLAN FN07/FN08 및 직접 채택된 `FN07_NORMAL_QUERY_OUTPUT_OWNERSHIP_CANDIDATE_20261116.md` §4·6(SHA256 `86A46140DADB38CB31C9B94957E5C836532ACE8093B10A062622B3FE93E7EC9E`)를 따른다. START 준비 단위가 동결된 뒤 기존 Primary 한 명이 구현한다. 이 소비자의 원 init 정착 증거가 첫 SEND의 두 증거 결합에 선행하므로, 임시 ref로 SEND부터 완성하지 않는다. Main은 결과를 검수·통합한다.

## 소유 경로

- 제품 신규: `apps/connector/runtime/normal-sdk-session-output.ts`
- 시험 신규: `tests/unit/FN07/normal-sdk-session-output.test.ts`
- 결과서: `docs/04_test_reports/AV3/FN07_NORMAL_SDK_OUTPUT_CONSUMER_SOURCE_RESULT_20261116.md`

기존 `secondary/schemas.ts`, `codec.ts`, canonical·validation 및 journal 거래 형상은 읽고 재사용하되 수정하지 않는다. 경로 추가가 필요하면 구현 이유·영향을 Main에게 알린다. Main의 WORK_STATUS·WORK_CHECK 수정과 앞선 동결 파일을 되돌리지 않는다. 이 단위는 실제 profile·제5 채널을 등록하거나 desktop 번들·서버·SQL·공개 API를 변경하지 않는다.

## 필요한 구현

1. 같은 원 owner·Query·iterator·생성 시도의 출력만 직렬로 소비한다. scope는 채택안의 원 등록·배정·slot/grant·project/execution/generation, START 준비행·첫 SEND dispatch·논리 sessionBindingRef·계획 SID digest에 결박한다. 외부 JSON/fullref만으로 실제 보호 owner·새 권한을 발급하지 않는다. 주입 거래·예약·현재성 포트는 소스 의존성이며 실제 등록 공급자의 증거가 아니다. 기본 공급자·test 모드 우회·raw root fallback은 만들지 않는다.
2. 각 next 전 최악 점유를 예약하고 원 기한·소유를 재검산한다. 유계 plain-data/canonical bytes와 기존 codec의 동기 capture 슬롯을 대조한다. capture의 RECORDED를 비동기 저장 완료로 사용하거나 codec에 Promise/thenable을 통과시키지 않는다. 실제 행 append·sync·원문 bytes/부모/순번/hash 재판독과 정상 닫힘이 끝나기 전 다음 next를 호출하지 않는다.
3. init 전 assistant/result와 init 자체는 불변 OUTPUT_PENDING_SESSION 행으로 보존한다. 올바른 init의 SESSION_INIT_CONFIRMED 확인행은 원 prefix 개수·tail·연속 digest·계획/관측 SID 및 원 owner/시도를 묶는다. 원행을 고쳐 확인 상태로 만들지 않는다. 확인 전에 정상 출력 영수증은 없으며, 확인 뒤에도 각 원 출력과 확인행을 함께 검산한다. 출력의 귀속은 SESSION_ONLY다.
4. 보호 원문은 지원하는 assistant와 success/error result의 전체 메시지이며 일부 텍스트·init-only·digest-only 저장으로 대체하지 않는다. 미지원 형상·SID 불일치·init 유실·중간/끝행 손실·부모 충돌·동일 식별의 다른 bytes·소유/기한 상실·정착 불명은 UNKNOWN으로 보존하고 추가 읽기·재생성·재수신하지 않는다. 동일 내용의 중복은 정착한 동일 ref를 재판독한다. SDK가 명령별 답변·작업 완료를 보증한다고 해석하지 않는다.
5. 알려진/모호한 민감 원문은 보호 격리 상태를 유지하고 일반 영수증·로그·spool·UI·Agent 재전달에 본문·SID·도구 인자/결과를 싣지 않는다. 격리 자동 해제와 원문 조회 API는 없다. 격리 판정이 완전한 비밀 탐지라는 주장도 하지 않는다. 실제 보호 공급자가 없으면 운영 지원은 미지원이다.
6. 객체 2MiB·식별 한도 최대1024, 실제 직렬화된 행3MiB·채널64MiB/10000행과 기존 기한을 유지한다. 원문뿐 아니라 확인행·잠금·관리/예약 비용과 불명 보존의 최악 점유를 포함한다. 다섯 채널이 기존 NORMAL_EXECUTION 256MiB를 공유하는 예약 의존성을 검산하되 미채택9E98의 실제 배정은 사용하지 않는다. 예약 부족은 next 0, 정산 불명은 최악 예약 유지다.
7. 원 Query·owner·생성 시도에 결박한 init 확인 증거는 모듈 내부에서 단발 발급·소비할 수 있게 준비한다. 복제한 객체와 ref만으로 원 관측을 재인증하거나 다른 worker에 옮길 수 없어야 한다. 후속 SEND 연결 전에는 이 단위를 실제 SDK Query 생산자로 표시하지 않는다. 독립 OS 생산자가 없으므로 processRef는 null이다.

## 검증과 보고

RAM 거래·예약·원 iterable만 사용한다. init 선후 양방향, assistant와 success/error result의 전체 bytes, 동일/상이 중복, prefix 교체·누락, 다른 owner/시도/기한·위조 증거, 예약 마지막 잔량 경쟁·관리 비용 초과, append/sync/readback/close 불명, 늦은 결과와 추가 next 0을 직접 검사한다. 민감하거나 판정이 모호한 assistant/result의 전체 canonical bytes도 격리행·순번·예약에 포함되는지 확인한다. 이후 올바른 init이 확인돼도 그 행의 일반 영수증 발급과 Agent 재전달은 0이어야 한다. 과거 기록을 live Query로 복구하지 않는다.

필요한 RED→GREEN, 직접/인접 회귀·타입·diff를 기록한다. 명령·종료 코드·건수·지문·미실행·잔여 선행을 결과서에 남긴다. 실제 권위·파일·SDK를 시험했다고 보고하지 않는다. 9E98의 등록 owner/profile·보호 배정 생산자와 실제 SDK module/hook·원 child 연결은 여전히 별도 미구현·미검증이다. 실제 DB·권한·키·사용자/백업 파일 조사·서비스·SDK/Agent/C# 실행·추가 SDK 조회·P03 실행은 금지한다.
