# FN09 등록 정의 책임 세션 예약 — 최소 결정 후보

2026-11-01 / Main 어울 / NOT_ADOPTED / 제품·SQL 구현 승인 아님

## 1. 목적과 확인 근거

사용자가 Anvil에 보관한 실제 연결 정의를 총괄 또는 단계 책임 세션의 **예약 설정**으로 명시 선택할 수 있게 하는 FN09 부분 기능이다. Agent 실행이나 능력 검증 완료를 뜻하지 않는다. 현재 실제 실행을 제외한 범위 안에서 진행할 다음 사용자 기능으로 A를 권장한다.

직전 구현 2e816315, 현황 checkpoint1493c3f0. 등록 정의 HUMAN 보고는 HUMAN_CLAIM/UNVERIFIED/false이며 FN06 실측이나 FN14 재개 안전 근거로 자동 사용하지 않는다.

현재 responsible-sessions.ts의 입력은 exact5, binding snapshot exact14/CANDIDATE_ONLY, session snapshot exact6이다. fresh는 connection_candidates의 현재 head/만료를 검사한다. 0016의 CHECK/guard와 0049.pending의 승인·원형 proof도 후보만 허용한다. connectionRef에 직접 FK가 있다고 가정할 수 없다. Web responsible-session-approval.ts 역시 exact5를 검사한다. 따라서 단순 reader 주입은 기존 계약 보완 범위를 넘는다.

## 2. 선택지와 권장안

- **A 권장:** 아래 명시적 등록 정의 분기를 코드·화면·미적용 forward SQL·합성 검증으로 구현한다. 기존 후보 계약과 기록은 유지한다. 사용자에게 등록 정의를 예약 설정으로 고정할 수 있게 하되 실제 능력/Agent/실행 준비는 계속 별도다.
- **B:** 현재 후보 예약을 유지하고 등록 정의 예약은 미구현으로 남긴다. 다음은 실제 능력 증빙·실행기 공급 경계의 별도 설계/실행 결정을 우선한다. 현재 실제 Agent·DB·서비스 실행 제외를 자동 해제하지 않는다.

A의 대가는 새 공개 payload/snapshot 분기와 forward CHECK/proof 보완이다. 적용 전 source이므로 정상 revert로 철회할 수 있다. B는 이번 예약 기능을 제공하지 못한다. 둘 다 실제 실행 전체 완료가 아니다.

## 3. 정확한 공개 차이

기존 operation `bindResponsibleSession`, schemaVersion1 명령 봉투·targetId/expectedVersion·baselineRefs·approvalRef, 기존 endpoint/receipt status를 유지한다.

기존 payload exact5 `{assignmentRef,roleRef,connectionRef,existingSessionBindingRef,reason}`는 계속 후보만 의미한다. 신규 exact6은 위5와 `connectionKind:'REGISTERED_DEFINITION'`이다. 판별값 **부재만** 기존 분기이며 null/unknown/추가키·키만 다른 위조는 거절한다. connectionRef의 UUID가 후보와 같더라도 namespace를 자동 추측하지 않는다.

기존 binding snapshot exact14는 유지한다. 신규는 exact15로 `connectionKind`를 원payload에서 보존하고 `connectionReadiness:'REGISTERED_DEFINITION_ONLY'`를 쓴다. `state:'RESERVED'`, externalSessionHandleRef:null, executionAuthorized:false, dispatchPerformed:false를 유지한다. 신규 session snapshot은 기존6에 같은 connectionKind를 더한 exact7이다. 원hash·sessionRef·bindingRef·generation·최초/후속 CAS·명령/receipt/audit에 각각 정확히 결박한다.

기존 readBinding/예약 상태 GET은 원형에 따라 정확 분기를 검산한다. 새 endpoint/목록·currentness DTO는 추가하지 않는다. 과거 snapshot의 판별값 부재를 새 정의로 재해석하거나 backfill하지 않는다.

## 4. fresh·replay·교체·권한

fresh 등록 정의 분기는 같은 PoolClient/현재 actor로 실제 ProjectConnectionDefinitions.read를 소비하고 project/id/version/hash 및 agent_connections head를 검사한다. 다른 프로젝트·변조·현재 head 불일치는 저장하지 않는다. 설정 상태 NOT_READY는 예약 설정일 뿐 지원 합격이 아니다. capabilityReportRef·HUMAN 보고를 자동 조회/연결/합격에 사용하지 않는다.

현재 회원·OWNER·단독 제어/세대·현재 정책/기한 보호 뒤 원명령 replay를 먼저 검산한다. replay에는 새 head 등 fresh 조건을 소급하지 않는다. 역사 read는 기존 회원·원명령/receipt/audit/hash 보호를 유지한다. 원형 손상은 현재성 주석으로 숨기지 않는다.

기존 후보↔등록 정의 또는 다른 connectionRef로 같은 session을 조용히 재해석하지 않는다. 같은 분기·같은 fullref와 정확 existingSessionBindingRef의 후속 예약만 기존 의미로 허용한다. 분기 변경/다른 연결은 SESSION_REPLACEMENT_REQUIRED/FN14 기존 절차에 남긴다. 새 교체·실행·준비 기능을 열지 않는다.

AUTO/DENY/REQUIRE_APPROVAL은 기존대로다. REQUIRE는 신규 exact6 원payloadHash를 기존 별도 요청→결정→정확 원명령 결박→일회 소비에 포함한다. 후보 exact5 승인/역할 정의 승인·다른 분기의 승인을 상속하지 않는다. 정책 자동 부여/GRANT·승인 종류 추가는 없다.

## 5. 저장과 미적용 SQL

기존0016/0049 및 다른 migration 원문은 수정하지 않는다. 새 forward pending 파일에서 기존 후보 CHECK/원형·승인 proof를 그대로 보존하면서 위 명시 분기만 추가한다. 정확한 원문·canonical/hash·역할/임무/session/command/receipt/audit와 실제 정의 관계를 양방향 검사한다. 같은 UUID의 후보 행으로 정의 관계를 대체할 수 없다.

기존 역할/session/binding 저장 구조와 조회 경로를 재사용하며 신규 표·기존 데이터 변환·삭제·초기화는 하지 않는다. 실제 CHECK 이름/정의·관련 caller는 구현 WI 발행 전 원문에서 고정하고 추정하지 않는다. 관계/완결의 반쪽 행·임의 discriminator·승인 SQL NULL/JSON null 혼동을 거절한다. 현재 원장·정책·저장 제한을 우회하거나 위장된 quota coverage를 만들지 않는다.

후속 prepareExecution/이해 검토·실제 환경/Agent provider에는 자동 적용하지 않는다. executions/project-execution-preparations.ts의 기존 후보 요구는 새예약으로 열지 않는다. 필요한 후속 기능은 별도 미완료로 남긴다.

## 6. 화면 흐름

기존 후보 예약 기본 선택/총괄·단계 선택은 유지한다. 등록 정의는 별도 명시 선택으로 기존 보호 고정 GET에 id/version/hash를 넣어 실제 조회한 뒤 선택한다. 조회 실패나 참조 불일치면 선택을 확정하지 않는다. 선택한 원형·종류와 RESERVED/지원 미확인/실행 허가 없음 표시를 유지한다. 새 목록 API는 만들지 않는다.

선택→원명령 준비→사용자 명시 보관→영수증/고정 재조회로 연결한다. App/부모의 현재 binding·owner/project/client/session/CSRF/transport에 결박하고 첫 async 준비 전후 선택 변경·늦은 응답·관측 ABA를 차단한다. 전송 전 원명령 보존 성공을 확인한다. UNKNOWN은 원명령만 명시 재확인하고 저장 후 GET 실패는 영수증을 보존한다. 명확한 서버 거절과 판독불가 오류를 구분하며 자동 POST/자동 역할·세션 생성은 없다.

## 7. 구현·검수 후보 범위

채택 후 Main이 실제 시작 hash/허용 경로를 고정한 WI를 발행한다. 현재 최소 예상은 다음 제품5와 신규 forward SQL/집중 시험이다.

- apps/server/modules/assignments/responsible-sessions.ts
- apps/server/modules/projects/routes.ts
- apps/web/src/features/workspace/responsible-session-api.ts
- apps/web/src/features/workspace/responsible-session-approval.ts
- apps/web/src/features/workspace/WorkspaceResponsibleSessions.tsx
- 신규 forward pending migration 1개(번호/이름은 부재와 기존 suffix 확인 후 고정)
- 신규 실제 서버/route·React·SQL source 집중 시험, 직접 영향받는 기존 strict fixture만 필요한 최소 적응

현재 제품5 외 원형 검산 소비자가 실제로 드러나면 구현 전 정확 경로/이유를 WI에 포함하고 공개 의미를 더 넓히지 않는다. 기존 Primary 단일 writer, Main 관리·검수·통합, 기존 Reviewer 독립 읽기 검토를 사용한다.

검수는 후보 v1 불변, 신규 정확 선택/다른project/hash/head, discriminator 누락/null/unknown·같은UUID namespace, 후속 CAS/분기 교체 거절, REQUIRE 원payloadHash 일회소비·다른승인 재사용 차단, 현재 보호 뒤 replay/head변경 비소급, 역사/영수증/감사 변조, 첫 준비 중 선택 교체 POST0, UNKNOWN/저장후GET실패·늦은401을 포함한다. 실제 소비 행동 RED→GREEN과 직접 영향 검사를 수행하고 실제 DB/브라우저/Agent 미실행을 명시한다.

## 8. 필요한 결정과 제외

필요한 채택은 **A의 새 exact6 payload·별도 binding/session snapshot·forward CHECK/proof와 위 코드/화면/미적용 SQL/합성 검증 범위**다. 기존 등록 정의 HUMAN 보고 승인이나 총괄 후보 예약 UI 승인에서 이를 추정하지 않는다. PMO가 위임 범위에서 결정할 수 없는 새 계약으로 판단하면 정확 차이로 신산님께 한 번만 전달한다.

실제 DB/DDL·권한·키·인증서·서비스·Agent·사용자/백업 대상 파일 조사·기존 프로젝트 차단 해제·실제 기준/실행 전환·main 병합·Oracle 배포는 제외한다. 채택 전에는 제품/SQL을 쓰지 않는다.
