# FN06 native factory bridge — 소유·인가 연결 공백과 지원 요청

2026-11-02 / Main 어울 / **읽기 근거·설계 제안, native bridge 채택/구현 GO 아님**

## 현재 사실

- r2 A(5C4AF434…E3085)의 TS NativePreparationClient→NativePreparationFactoryConsumer는 실제 private ticket의 한 번 소비·current/기한/factory fullref를 검사한다. 현재 ticket material은 flat permit snapshot이다(Main50ca45).
- C# OwnershipEvidenceJobFactorySource.CreateEmptyJobSource(timeoutMs)는 private IEmptyJobCandidate/ReadEmpty/Dispose/LocalHandleCloseConfirmed를 제공하지만 인가/lease/localAttempt/원소비를 받지 않는다. 관측은 FACTORY_CREATED_EMPTY_JOB_CANDIDATE_ONLY이며 준비·실행·process생성/dispatch·writer부재 검증은 모두 false다.
- 기존 windows-host/OwnershipHost는 과거 고정 QA 허가·worker PREPARE 프로토콜이다(Main99a901). 새 r2 실행 허가나 준비 전용 bridge로 재사용할 수 없다.
- Reviewer와 Primary의 한정 읽기 결론은 동일하다. 두 source 사이에는 사전인가·원시도별 helper/owner 보유·결과 의미·불명/종료 인계 계약이 없고 안전한 직접 연결이 완성되지 않는다. 일반 Node PID·경로/hash·verified:true만으로 Anvil 부모·현재 package·전용 channel 소유를 증명하지 않는다.

## 권장 설계 방향과 아직 정의할 내용

A안: 기존 Windows 실행기가 원시도별 전용 helper와 닫힌 private channel을 소유하는 준비 전용 연결을 상세화한다. 새 상주 서비스·새 사용자 권한을 만드는 B안은 범위를 늘리므로 권장하지 않는다. A도 지금 채택/활성화하거나 일반 CLI/stdin JSON OPEN을 허용한다는 뜻이 아니다.

| 항목 | 필요한 정확한 정의 |
|---|---|
| 진입 | 원 ticket의 실제 단발 소비와 원 authority/permit·소비 receipt/record·localAttempt·factory·최소기한을 source 호출에 결박. raw JSON은 권위가 아님 |
| peer/package | 실제 부모 process instance/시작 신원·승인 package/image/실행 코드·helper image·전용 양방향 channel 소유/상속·복제 제한의 보호 producer. 현재 없음/미정 |
| 내부 frame | schemaVersion/purpose/bridgeRunId/sequence/operation/requestId와 원본 tuple. OPEN_EMPTY/QUERY_EMPTY/CLOSE_OWNER 한정 후보이며 아직 최종 wire 아님 |
| native owner | helper가 private owner를 보유하고 raw handle을 노출하지 않음. holderRef는 조회 식별자이며 새 권위가 아님. QUERY/CLOSE는 같은 소유 경계에 결박 |
| 결과/불명 | 후보 생성과 실제 준비/두 LEASE_CURRENT 관측을 분리. 응답유실·기한·부모/helper 종료·동기 native 미정착은 UNKNOWN, 자동 OPEN 재전송/새helper 우회0. close는 해당owner LocalHandleCloseConfirmed까지만 의미 |

원 native 포트 outcome exact {state}와 D1 false 관측을 보존해야 한다. holder query/close의 내부 소비자·종료 인계는 현재 포트에 없으므로 상세화가 필요하다. source 프로세스의 객체 provenance와 OS peer 검증을 혼동하지 않는다.

## PMO에 필요한 지원

기존 공통 표준 또는 검증된 제품 경로 중 **실제 Anvil 부모/package 및 private channel의 소유 증거를 생산하는 기준/producer**가 있는지, 있다면 정확한 정본·코드·검증 경계를 제공해 달라는 요청이다. 없다면 없는 것으로 남기고 Main이 A안의 내부 연결·수명 설계를 구체화한다. 새로운 보호 방식·권위/공개 계약·중요 위험이 필요한 경우 정확 차이를 별도로 제시한다. PMO에게 다음 업무 배정을 요청하거나 실제 실행 승인을 요청하는 것이 아니다.

Main은 기다리며 전체 작업을 멈추지 않는다. 기존 r2의 검증된 authority/receipt/permit 원본을 private ticket에 결박하는 source 내부3경로를 별도 WI(613F5337…C0F162)로 사전 검토 중이다. 이는 새 native bridge·holder·peer 인가의 채택이 아니며 원 flat consume/wire를 보존한다.

실 C#/compiler/helper/PInvoke/OS·파일·DB/권한·키·서비스·Agent·실자료/P03 R3 실행0. 보호 공급자 부재를 성공으로 채우지 않고 전체 FN06/FN08/계획 미완료를 유지한다.