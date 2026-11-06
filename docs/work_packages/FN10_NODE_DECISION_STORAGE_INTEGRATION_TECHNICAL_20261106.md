# FN10 판단 저장·보호 조회의 내부 기술 접합
- 일자: 2026-11-06
- 기준: FN10 후보462BD405·신산님의 확정 문서 묶음 별도 선택 및 source-only 계속 지시.
- 성격: Main 내부 기술 선택·후속 저장 WI 근거. 제품/SQL 쓰기 GO와 실제 환경 승인 아님.
- 입력 단위 WI78C47D4C와 해당 신규2는 변경하지 않는다.

## 1. 같은 transaction과 원 source
기록/철회는 원 인증→project/member/control/policy 경계→선택 적용/문서/계획의 실제 보호 current→quota 예약→basis/decision/receipt/audit/head→정산→COMMIT 순서다. 별도 선택 API·전역 basis pointer·실행활성화는 없다.

기존 문서/계획/확정/검토·방법론 적용·정책/회원/제어 producer는 동일 project 잠금을 먼저 소비한다는 읽기 근거가 있다. 새 FN10도 그 경계를 우선 소비하며 임의 document→plan 순서로 잠금만 더하지 않는다. 현재 조사에서 기존 writer 변경을 필수로 볼 근거는 없다. 실제 PG의 순서·경합/무교착은 NOT_RUN이다.

원 artifact의 기존 격리 UPDATE/DELETE 생산자는 확인되지 않았으므로 새로 만들지 않는다. 원 보호 reader의 접근/격리/bytes/hash 검산을 소비하며 권한이 없는 raw artifact FOR SHARE를 임의 추가하지 않는다.

## 2. 저장 후 보호 반환
원 authenticated의 COMMIT tag와 release가 확정된 뒤 같은 repository와 원 token으로 새 authenticated 보호 조회를 수행한다. 원 actorId/clientId/credentialGeneration/Session ID·원 request/command·결과/출처 refs와 새 인증을 대조한다. 두 Tx의 PoolClient가 같다고 요구하거나 과거 Tx 잠금이 살아 있다고 주장하지 않는다.

신규 저장의 current head/선택 refs 조건과 역사 GET/replay의 현재 OWNER/member·readNodeDecisions·출처 접근/격리·저장관계 검산을 분리한다. 역사 replay에 새 controller/head CAS를 소급하지 않는다. 응답의 설계/AF04/근거 자료 전체를 검사하고 한 출처라도 거절되면 성공 원문 전체를 닫으며, 저장된 receipt/version은 보존한다.

원 호출·Session·정책 기한의 최소값을 후행 조회까지 유지하고 await 뒤 늘리지 않는다. timeout/취소 뒤 늦은 결과를 반환하지 않는다. 내부 query 종결/Pool 회수를 외부 응답 정착과 구분하며 유한 보장이 없는 것을 보장하지 않는다. 마지막 보호 관측과 HTTP 마지막 byte 사이의 원자적 회수까지 주장하지 않는다.

## 3. 기존 quota 목적의 한정 접합
Main은 기존 FN09 동일 Tx 예약/정산 방식에 FN10 내부 목적 하나를 추가하는 기술안을 선택한다.
- part.kind=NODE_DECISION, part.key=node_decision
- part.id=decisionRef.id, part.contentHash=해당 불변 version hash
- reservation.id=원 serverCommandId, operation=recordNodeDecision 또는 revokeNodeDecision
- 원 외부 commandId·actor/client·target/basis/requestHash와 결박
- 공통 part exact 형식은 유지하며 기존 FN09 canonicalPairs 목적을 바꾸지 않음

기존 10GiB·계정 분모·coverage 검산을 유지한다. 새 유료 정책·임의 건수cap·정책 자동 부여·알림/승인소비0이다. 공개 quota_current/reserve/start 경로는 새 내부 목적을 계속 거절한다. 새 FN10 전용 reserve/settle RPC2만 앱 진입으로 두며 helper의 직접 EXECUTE는 닫는 미적용 forward를 작성한다. 실제 권한 적용은 하지 않는다.

## 4. 실제 비용과 과거 head 재현
c는 기존 고정 숫자/UTC 시각 projection의 canonical UTF-8 bytes다.

B=c(version 전체행: decision+basis+관계열)+c(command)+c(authorization_receipt)+c(audit)+Δhead

basis의 version행 보관과 command 결과 복제는 실제 복제대로 각각 센다. 원 source body는 복제하지 않아 원문 전체를 중복 계상하지 않는다. head projection의 최소열은 project_id/stream_id/application_ref/node_id/head_version/head_hash/created_at/updated_at이다. 숫자/시각의 비용 projection만 기존 방식으로 고정하며 snapshot 내부 원 JSON은 변형하지 않는다.

불변 version n에서 다음을 재구성한다.
- 공통 stream/application/node는 불변.
- created_at은 동일 stream의 불변 version1 recordedAt.
- n=1의 before=null, 비용0.
- n>1의 before는 previousRef로 검산한 정확 n−1 원행. hash/stream/application/node·원 command/time 관계를 대조.
- after는 현재 decisionRef version/hash와 현재 원 recordedAt.
- Δhead=c(after)−c(before). 음수는0으로 보정하지 않고 projection 불일치로 거절.

FN10 전용 sealed plan에 headProjections:{before,after}를 두고 H(plan-planHash)에 포함한다. plan에 복제된 projection bytes는 R 자기비용에도 포함한다. caller가 준 비용 before/after를 신뢰하지 않는다.
- reserve: 실제 잠긴 현재 head와 before를 exact 비교, 최초는 부재. 원 request/검산된 신규 원형으로 after를 생성.
- settle: 실제 신규 불변 version·version1·previous 원행으로 재구성해 sealed plan과 비교하고 실제 현재 head=after도 확인.
- 역사 완결: 해당 version의 불변 원행과 plan만 사용. 현재 head를 과거 after로 요구하지 않음.
- 별도 최신 head guard는 실제 head와 최신 불변 version을 검산.

before_n=after_(n−1)이므로 모든 Δ의 합은 현재 head 비용과 같다. v3 뒤에도 v1/v2의 원행/plan과 B·s는 변하지 않는다. 이 점이 독립 검토의 I1 보완 설계이며 구현/검증 완료는 아니다.

## 5. 예약 고정점과 계정
기존 고정 숫자/시각 폭으로 실제 예정 행의 최대 projection M을 구한다. 임의 배수나 FN09 준비 목적 projection을 그대로 쓰지 않는다.

r0=M
r(n+1)=max(rn,M+max(R_RESERVED(rn),R_IO_STARTED(rn),R_SETTLED(rn,rn)))
s0=B
s(n+1)=max(sn,B+R_SETTLED(r,sn)), s≤r

원 plan은 coverageGeneration을 포함해 봉인하며 settle에서 재작성하지 않는다.
U=무필터 SETTLED settled_bytes 합+기존 FN15/FN75/FN76 actual
H=기존 RESERVED/IO_STARTED/UNKNOWN reserved_bytes 합+기존 future
O=기존 fn09_registered_other_bytes의6표 소계
admission: U+H+r+O≤10737418240
settlement: U+s+H−r+O≤10737418240

FN10은 무필터 reservation 합에 포함되므로 새 actual 소계를 중복 추가하지 않는다. 같은 account 잠금에서 VERIFIED·generation·used/held와 실제 계산 일치를 확인하고 reserve held+=r, settle used+=s/held−=r CAS를 적용한다.

## 6. forward와 필수 검증
기존0059/0073/0075/0076/0077을 직접 수정하지 않는다. 새0080 pending에서 FN10 projection/actual·maximum·고정점·reserve/settle·reservation/domain/head 완결을 정의하고 기존 plan_valid/settled_complete·목적 CHECK를 한정 확장한다. 다른 목적은 기존 검증에 위임한다. domain↔원 command/receipt/audit↔R의 양방향 deferred 완결, txid/deadline·IO_STARTED→SETTLED CAS·직접 DML 거절을 유지한다.

필수 사례:
- record v1→정정v2→철회v3 뒤 v1/v2의 B·s 불변과 전체 Δ 합=head 비용
- version 자릿수 경계·previousRef/누락version1/교차stream·시각/hash·실제head만 변조
- sealed before/after 누락/변조·projection 복제비용 누락
- account used/held/coverage mismatch·상한 경계·actual/held/O 중복·고정점과 자기비용
- 원 Tx/actor/request/receipt/audit/R 누락·변조의 전체 rollback, same command replay 비용0
- COMMIT/정산 불명은 UNKNOWN·원 command 유지, 새예약/재명령/보상삭제0
- 저장 뒤 보호 거절·늦은 조회는 원 receipt 보존/성공 원문0

근거 읽기 경로는 project-storage-quota.ts:106~154, 0077의cost/fixed-point/reserve/settle/complete, 0073/0075/0076 collector다. 정확 구현 경로/함수 원형·시험은 후속 WI에서 고정한다. 실제 PG·권한·COMMIT/경합·서비스/Agent 검증은 미실행이다.
