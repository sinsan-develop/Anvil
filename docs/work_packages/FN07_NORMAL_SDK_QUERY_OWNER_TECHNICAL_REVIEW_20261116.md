# FN07 normal SDK Query 소유자·관측 — 미채택 기술 검토

이 문서는 source 구현 승인이나 실제 SDK 호출 지시가 아니다. WORK_PLAN FN07의 실제 driver·SDK SID/child 결박은 기존 FN07 Query 생성·인계 WI에서 후속으로 남겼다. PMO도 원 소유자와 관측 ref 발급 의미가 미채택임을 원문에서 확인했다. 기존 원칙을 재승인받기 위한 문서가 아니다.

## 확인한 호출선과 미구현

- NormalClaudeStartWire.send는 원 START·자료·permit·현재성을 검산하고 명시 driver.send까지 호출한다. 실제 SDK query()를 생성하는 normal driver 구현은 확인되지 않았다.
- SyntheticClaudeSdkQueryFactory는 주입 driver.create와 첫 입력 iterable·단일 iterator·실제 init SID 대조를 합성 범위에서 모델링한다. 기존 SYNTHETIC_ONLY 가드를 normal로 바꾸어 실제 공급자라고 선언할 수 없다.
- 기존 codec의 capture는 동기 RECORDED/digest를 처리한다. actual normal 보호 Sink와 보관 fullref 생산자는 연결되지 않았다. normal 관측 spool은 요약 ref를 ACK하며 SDK raw stream을 수신하는 Sink가 아니다.
- 따라서 남은 세 접점은 normal current/permit/wire→실제 Query 호출, 동일 owner의 SDK SID/child 대응, 정규화한 실제 SDK 관측→보호 Sink/fullref다. 실제 Agent 검증만 실행하면 완성되는 상태가 아니다.

## 이미 채택된 원칙

P3의 RECEIVED→permit→wire와 normal STOP의 원 owner 협력 interrupt 단발 원칙은 유지한다. FN07의 명시적으로 선택한 첫 SEND에서 Query 단발 생성·같은 Query/iterator 인계·UNKNOWN 뒤 재생성 금지는 **합성 bootstrap에서 채택·구현된 범위**다. normal 최초 SEND 선택과 실제 Query/SID/child 결박까지 이미 채택됐다고 확대하지 않는다. 아래 A안은 이 순서를 normal worker에도 적용하도록 제안한다. interrupt 반환·SDK SID·PID·exit만으로 STOPPED나 writer 해제를 인정하지 않는다. 새 공개 admission이 필요하다고 추정하지 않는다.

## A안 제안 — 원 worker가 Query·iterator 소유

제안 A는 원 START attempt/permit과 Anvil 논리 sessionBindingRef를 인수한 normal worker가 준비 상태를 소유한다. 원 첫 SEND의 수신 원문·localAttempt/dispatchAttempt·permit/proof를 다시 검산한 뒤 Query를 한 번 생성한다. 첫 입력은 같은 iterable에서 한 번만 yield하고 원 Query에서 iterator를 한 번만 취득한다. 실제 init SID의 대조와 첫 yield가 같은 생성에 속함을 모두 확인하기 전에는 논리세션과 SDK세션의 대응을 확정하지 않는다. 두 사건의 선후 순서를 SDK 보장으로 가정하지 않는다. normal의 생성 시점은 아직 미채택이므로 합성 규칙을 새 강제 gate로 전용하지 않는다.

Anvil 논리 fullref·SDK SID·child PID는 서로 다른 식별자다. 이후 SEND는 같은 Query에만, 중지/close는 같은 원 capability에서만 수행한다. 기한·소유상실·취소 후 늦게 도착한 Query/child는 원 owner의 회수·협력 정리에만 사용한다. 효과/종결 불명은 UNKNOWN으로 남기고 새 Query로 보상하지 않는다.

## 결정이 필요한 의미 두 가지

1. **START 준비 수락과 SDK 응답의 구분.** 현재 START coordinator는 필수 responseRef를 받으면 RESPONSE_RECORDED를 PROVIDER_RESPONSE_RECEIVED/UNVERIFIED_PROVIDER_CLAIM으로 투영한다. 기존 PREPARED는 permit 전 자료 수신 관측으로 driver의 START 준비 수락이 아니다. A안의 첫 SEND 생성 방식을 선택하면 START에서 실제 SDK init을 관측했다고 주장하거나 기존 permit/PREPARED ref를 SDK response로 대입할 수 없다. A안은 실제로 인수한 START 준비 ACK를 원 attempt/permit/Options·context fullref/세대에 결박한 별도 종단으로 제안한다(Query0/processRef=null). 저장·역사 재생·ACK coverage·cursor가 이 종단을 어떻게 소비할지는 새 의미다. 기존 v1 행을 소급 재해석하지 않는다. 다른 normal 생성 시점을 선택하려면 그 SDK 효과·예산과 관측의 의미를 별도로 정의해야 하며, Query handle 반환을 init 메시지/OS 소유/작업 성공으로 바꾸어 말할 수 없다.
2. **SDK 관측과 OS 소유 근거.** 첫 SEND의 responseRef는 같은 원 Query에서 실제로 읽고 정규화하여 보호 보관한 관측 fullref로 한정한다. SDK 메시지 수락 자체를 작업 성공으로 보지 않는다. 세션에만 귀속되는 사건을 특정 후속 SEND의 응답으로 임의 배정하지 않는다. processRef는 원 child에 결박된 독립 OS 소유 관측이 있을 때만 발급하고 callback/PID/exit만 있으면 null이다. owner/current 자체가 불명이면 UNKNOWN이다.

구체화 전에는 별도 준비 ACK의 기존 응답 형상과 허용 관측/저장 제약, 실제 보호 Sink의 producer·보관/격리/정규화·명령 귀속, 원 SDK module/hook 계약 및 소유 capability를 대조해야 한다. 새 공개 enum/저장 계약·권위가 필요하면 그 delta만 직접 결정 대상으로 제시한다. 무조건 normal flag를 붙이거나 가상의 응답/OS ref로 우회하지 않는다.

## 근거와 실행 경계

근거는 FN06_FN08_P3_NORMAL_TRANSPORT_DECISION_PACKET_20261113 §3.1, FN07_SDK_QUERY_CREATION_HANDOFF_SOURCE_IMPLEMENTATION_20261106, FN08_NORMAL_SEND_DISPATCH_CANDIDATE_20261115 §6, FN08_NORMAL_STOP_TARGET_PAGE_CANDIDATE_20261115 §5와 관련 제품/시험이다. Windows SDK 단발 읽기는6구간/CanUseTool 전체 미확인으로 유지한다. SDK의 미확인 동기성·권한 callback/child 소유를 추정으로 확정하지 않고 새 SDK 조회를 반복하지 않는다.

이번에는 문서/제품 읽기만 수행했다. 실제 Query·SDK/Agent·키·DB·서비스·root/파일/OS 작업0, 제품 코드 GO0이다. 보호 spool 후보9E98의 채택과 P03 후속 관측 답변은 별개이며 서로의 승인을 대신하지 않는다. 실제 Coding Agent 연결·전체 계획은 미완료다.
