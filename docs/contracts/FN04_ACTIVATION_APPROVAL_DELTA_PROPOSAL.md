# FN04 설계 변경 적용 — FN11 연결 상세 차이 후보 r1

- 상태: **DRAFT / NOT_ADOPTED**. 이 파일은 채택 요청용 자료이며 제품 코드·SQL·실제 DB·권한·기준 전환·Agent 실행을 추가 승인하지 않는다.
- 기준: `32927f0f12c5e7fe75959cf35fe857cf378f1d97`, 승인 WORK_PLAN FN04/FN11·UI07/UI08, INTERFACES §2·§9.1·§10.1/10.2, DATA_MODEL §7.2.
- 작성 근거: 2026-10-21 PMO 지원 지시. 기존 activateDesignChange 기능 전체를 재승인받으려는 문서가 아니다. saveWorkPlanDraft에만 한정된 기존 후보 보관 계약을 자동 확대하지 않는다.
- 목적: 사용자가 **정확한 설계·개정 계획·영향 버전**을 보고 별도 승인·명시 적용하며, 원문·구기준/과거 결과를 보존하도록 연결한다. 적용과 실제 업무 재개/Agent 실행은 분리한다.

## 1. 기존 범위와 확인된 차이

| 구분 | 확인된 기존 계약/구현 | 이번 후보가 필요한 차이 |
|---|---|---|
| 적용 기능 | activateDesignChange와 baseline_activations·현재 pointer·영향업무 재확인은 이미 계획/계약에 있음 | 코드 부재 자체는 새 승인 사유가 아니다. 구현은 기존 논리 계약을 소비한다. |
| 승인 인자 위치 | approvalRef는 공통 봉투/context. payloadHash와 scopeDigest는 별개 | payload5개 안에 scopeDigest를 중복 삽입하지 않는다. 새 ApprovalRef형/토큰0 |
| 후보 원문 | requestApproval의 candidatePayload와 승인 GET candidatePlan은 saveWorkPlanDraft에만 한정 | activate 한 연산에 candidatePayload / candidateActivation 보호 조회를 추가하는 **요청·응답/보관 범위 차이** |
| 기준 CAS | 공통 target/expectedVersion은 변경 요청 대상, baselineRefs는 기존 실제 자료 명령에서 빈 배열만 연결됨 | 활성 기준 pointer CAS를 기존 baselineRefs 필드의 [] 또는 정확 activation fullref 1개로 한정 소비하는 **해당 연산의 연결 차이** |
| 영향·writer | calculateDesignImpact가 실행/시험 source 미연결 gap를 항상 생성, review는 기존 gap 삭제 금지 | 자료 없음·합성 claim을 실제 안전으로 바꾸지 않고 자료 완전성/동시성·writer 증명을 별도 해결해야 함 |

자료 근거: ProjectApprovals consumableOperations·approval-input·WorkPlanApprovalCandidates, UI08 detailsValid/validateApprovalView, 0035 소비 분기, ProjectDesignChanges.#impact, calculateDesignImpact/readImpactReview. 이번 확인은 source 읽기이며 실제 DB/schema/runtime 확인 결과가 아니다.

## 2. 기존 보호 조회만 사용하는 대안 비교

1. **기존 ApprovalDetails만 저장**: 새로운 후보 보관/조회 계약은 없다. 그러나 targetRef는 changeRef이고 payloadHash는 다섯 필드 내용을 복원하지 못한다. 변경 요청 자체에는 새 approvedDesignRef/confirmedPlanRef/적용 이유가 고정돼 있지 않다. 같은 프로젝트의 기존 문서/계획 GET만으로 사용자가 어떤 조합을 승인 요청했는지 확정할 수 없다. 가능한 후보를 열거해 해시가 맞는 조합을 추측하지 않는다.
2. **동일 브라우저의 준비 버퍼를 승인 화면에 전달**: 원 payload를 대조할 수는 있으나 새로고침·다른 기기/세션·장애 후 유실 때 보관된 정확 후보를 조회할 수 없다. 그런 경우 결정/적용을 닫아야 한다. 이를 내구 인계·사후 추적이 완료된 해결책으로 제안하지 않는다.
3. **권장 후보: activate 한 연산의 정확 후보를 보호 보관/조회**: 기존 승인 hash/원자 소비를 재사용하고 내구 조회를 제공한다. 대신 원문 5필드와 이유를 보호 DB에 추가 보관하고, 한정 응답·guard·검수가 필요하다. 다른 연산/공통 후보 일반화·AUTO 우회는 제외한다.

1·2가 논리적으로 불가능한 것은 아니다. 사용자에게 원문 없는 승인/유실 후 진행 불가를 숨기지 않고, 이번 목표인 내구 승인·인계/검수와의 차이로 비교한다.

## 3. 제안하는 exact 자료 형식

### 적용 후보

- operation은 기존 논리 연산 `activateDesignChange`.
- payload는 exact `{changeRef,impactRef,approvedDesignRef,confirmedPlanRef,reason}`. 4개 참조는 각각 id/version/contentHash fullref, reason은 잘 형성된 비공백 문자열·최대20000 UTF-16 code units다. 원 payload를 정규화/요약해 hash를 대체하지 않는다.
- targetId=changeRef.id, expectedVersion=changeRef.version. 서버는 ActionScope.targetRef의 **전체 hash**도 changeRef와 대조한다. id만 같다고 수락하지 않는다.
- payloadHash=canonical SHA256(payload5개). 기존 envelope.approvalRef=`{requestId,decisionId,scopeDigest}`는 별도이며 scopeDigest는 기존 ActionScope 전체의 서버 계산 hash다.
- 기존 ActionScope의 요청자 HUMAN user/client·candidateCommandId·controlGeneration·operation·기한·현재 policyRef/정확 결정 소비를 유지한다. environmentRef=null/sourceScopes=[]/limitsRef=null은 이 명령이 자료 기준 전환이며 실제 OS 실행을 허가하지 않음을 표시한다.

### 현재 pointer CAS — 이 후보의 명시적 연결 차이

- current pointer가 있으면 envelope 및 ActionScope.baselineRefs는 그 불변 activation fullref **1개**, 없으면 둘 다 []다. 임의 문서/계획 ref·복수 ref·기존 다른 연산의 baselineRefs 지원 확대는 거절한다.
- activation fullref는 새 적용 이력의 id/적용세대/불변 snapshot hash를 가리키며 개별 designRef/planRef와 혼동하지 않는다. 새 형태의 승인 토큰은 아니다.
- 첫 적용은 []=현재 pointer 부재를 request/결정/신규 적용 직전에 실제 대조한다. previous_activation_id=null로 새 현재 기준을 최초 등록하며, beforeRef의 확정 문서를 과거에 활성 기준이었다고 소급 표시하지 않는다. UI에서 최초 기준 등록임을 명시한다.
- 이후 적용은 정확 이전 activation/design·현재 impact/새 계획을 대조한다. **currentActivation.designRef와 change.beforeRef의 전체 id/version/contentHash가 같아야 하며 다르면409**다. 현재 B인 상태에서 A→C 변경에 B의 pointer만 결박하는 재기준화는 이번 범위가 아니다. 같은 설계가 여러 적용 이력에 나타나도 이전 activation fullref가 다르면 신규 적용은409다. 최초 []는 바로 앞의 최초 등록 규칙으로만 처리한다.
- CAS를 승인 후 임의 최신 pointer로 갱신하지 않는다. 기준이 바뀌면 기존 요청은 과거 보존하고 새 후보/새 요청이 필요하다. 현재 없음/있음을 클라이언트 보고만으로 결정하지 않는다.
- 현재 공통 reference-pending guard와 approval 입력의 빈 배열 제한은 이 operation에 한해서만 새 forward 보호와 함께 연결해야 한다. 이 문서만으로 해당 guard를 해제하지 않는다.

### 승인 요청·조회

- 해당 연산의 requestApproval payload는 exact `{details,candidatePayload}`, candidatePayload=적용 payload5개다. 기존 saveWorkPlanDraft의 같은 구조/보관·나머지 연산의 exact `{details}`는 불변이다.
- 기존 승인 상세 GET에 해당 operation일 때만 optional `candidateActivation:{candidateCommandId,payloadHash,payload}`를 제공한다. candidatePlan은 기존 계획 저장에만 남긴다.
- hash·ref·원요청 command/정책/작성자/client/세대/기한·CAS 귀속을 저장/조회/결정/신규 소비 때 검증한다. 행 누락/중복/변조를 화면에서 재계산해 정상화하지 않는다.
- 공개되는 내용은 4개 정확 ref와 **사용자 입력 reason 전체**다. 파일/문서 본문·Secret·다른 프로젝트 후보·raw OS/Agent 핸들을 응답에 추가하지 않는다. 알려진 비밀 표식은 기존 보호 원칙대로 값 없는 오류로 닫으며 완전 탐지라고 주장하지 않는다.

## 4. 읽기 주체·회수·보존

- 후보 원문은 **현재 프로젝트 OWNER이고 원요청자인 인증 사용자**만 받는다. 조회 client를 원기기에 고정하지 않아 같은 사용자의 과거 조회/다른 기기 조회를 허용한다. 이는 결정/적용 허가가 아니다.
- 결정/결박/신규 적용은 원요청 client·현재 controlGeneration·현재 정책·유효 세션·현재 기한을 모두 검사한다. 과거 조회 가능과 현재 집행 가능을 분리한다.
- 회원 회수·OWNER 상실·다른 주체/타프로젝트에는 후보/이유를 반환하지 않고 NOT_FOUND404. 기존 조회 metadata만 허용하면서 후보 전체를 일부 노출하는 우회 경로를 만들지 않는다.
- 클라이언트는 user/client/project/검수 세대 key를 분리하고 권한 실패·재조회·선택 이탈 시 이전 후보를 숨긴다. 늦은 JSON/hash 응답은 다음 동작이나 다른 주체 화면에 수집하지 않는다.
- 후보는 요청 transaction에서 생성한 불변 이력이다. 기존 승인/명령 이력과 함께 보호 보존, 자동 삭제/수정/격리 해제0이다. 거절/만료/소비 뒤에도 현재 권한 안에서 당시 입력을 조회한다.
- 감사에는 식별자/hash·결정/소비·결과를 기록하고 사용자 reason/전체 payload·비밀을 반복 복사하지 않는다. 보존은 계정/서버 관리자 침해 방지나 암호화 보장으로 승격하지 않는다.

## 5. 도메인·소비·원자성

- changeRef는 실제 같은 프로젝트 보관 변경 요청/hash이고 impactRef는 그 변경의 **현재 최신** 영향 fullref다. 새로운 영향 검토가 생기면 이전 후보를 자동 갱신하지 않는다.
- approvedDesignRef는 해당 beforeRef/afterProposalRef의 실제 선택 이력에서 만들어진 정확 AF02 버전이며 현재 확정/최신 적합 검토·보호 원문/hash를 확인한다. 다른 확정 AF02를 임의 대체하지 않는다.
- confirmedPlanRef는 같은 approvedDesignRef에 연결된 정확한 현재 확정 계획·AF04·필수 화면 검토와 작업/검수/범위/선행을 확인한다. 계획 확정만으로 실제 실행을 인정하지 않는다.
- 기본 명시 허가/DENY 우선·REQUIRE_APPROVAL 및 정확 일회 결정·현재 control/정책·만료를 유지한다. 해당 기능을 열려고 AUTO로 변경하거나 실제 사용자 정책을 자동 부여하지 않는다.
- current 권한/세션/정책을 먼저 검사하고 **이미 소비된 동일 최종 명령/body/hash의 replay**는 기존 영수증만 반환한다. 과거 이후 진행된 pointer/impact/head를 신규 CAS로 먼저 검사해 합법 replay를 막지 않는다. 다른 commandId/내용/주체/기기에는 재사용 불가다.
- 신규에만 exact 후보/승인·현재 pointer/impact/설계/계획·영향 공백/실행 안전을 다시 대조한다. 성공시 하나의 transaction에서 command/receipt/소비/감사·baseline_activations 새 이력·현재 pointer CAS·영향 업무 재확인 표시를 함께 보존한다. 중간 일부 성공은 없다.
- AFFECTED 업무만 새 재확인 상태로 연결하고 UNAFFECTED 업무/완료 근거는 재발행하지 않는다. UNKNOWN/필수 coverage gap 미해소면412로 적용 불가다. 기존 영향/시험/이력·과거 완료 증거는 삭제하지 않는다.
- 실제 업무 재개·새 임무·외부 호출/OS 쓰기는 별도 FN09/13/08/11 경계다. 적용 receipt로 실행을 시작하지 않는다.

## 6. 영향 완전성·무이력·writer 안전 — 별도 미결 선행

현재 소스만으로 이 절을 통과했다고 판정할 수 없다. candidate 보관 채택과 실제 활성화 가능 판정을 분리한다.

- 기존 calculateDesignImpact의 EXECUTION_SOURCE_NOT_CONNECTED/TEST_EVIDENCE_SOURCE_NOT_CONNECTED는 항상 존재하고 기존 review는 gap 삭제를 금지한다. 기존 보관 gap를 빈 배열로 고치거나 과거 계산을 PASS로 소급하지 않는다.
- 실제 source별 관측/범위·완전성·미수신/순서 누락·정확 환경/세대/hash와 현재 귀속을 읽어야 한다. 수행자 PASS 보고·DB row·등록 파일 bytes와 실제 시험/OS 관측을 혼동하지 않는다. 누락/오류/권한 거절·유한 조회 초과는 UNKNOWN/UNAVAILABLE·412다.
- 실제무이력 주장은 명시된 프로젝트/연결/범위의 자료 저장소에서 **조회한 기록이 없음**일 뿐, OS 프로세스/타Agent·누락 관측·외부 writer의 부재 증명은 아니다. executions/writer_claims/result_submissions count0으로 writer-safe=true를 만들지 않는다.
- 현재 executions.transport/state 및 writer_claims.ownership_state는 SYNTHETIC 전용이다. 해당 row/만료/reclaimed_at 또는 합성 회수 receipt는 실제 OS 쓰기 회수 증거가 아니다.
- 현재 queue guard가 project row FOR UPDATE를 취한다는 사실은 일부 신규 합성 queue의 DB 동시 삽입 경계만 뒷받침한다. 모든 claim/관측/결과/다른 생성 경로와 같은 잠금인지, 이미 진행 중인 실제 writer의 안전 확인이 되는지는 별도 입증 전 미확인이다.
- 후속 상세는 같은 project/control·현재 pointer/impact와 source/실행세대의 잠금 순서, 새 queue/claim/결과/관측 도착 경쟁, 최종 deferred 검사·서버 기한, OS 회수 증거의 freshness/정체성·누락을 정해야 한다. count검사 뒤 새삽입/관측/회수가 생겨도 부정확한 적용을 허용하지 않아야 한다.
- 현 근거로 생산 경로의 gap 해소/안전 상태를 제공할 수 없으면 적용은 계속412다. 합성 시험의 정상 fixture는 이 guard 논리를 시험하는 자료일 뿐 생산 안전 공급자 구현/검증이 아니다.
- **이 후보는 새로운 실제 OS/writer 안전 판정 자료 형식/발급권한·새 source 관측 능력/r2 채택을 정의하거나 승인하지 않는다.** 해당 실제 선행의 정확 자료/범위·동시성은 별도 증거로 제시해야 하며 후보 원문 보관 승인이 이를 대신하지 않는다.

## 7. 미적용 저장 보호·오류·검수

- 채택 후 하나의 새 forward SQL로 activation 후보 불변 저장/관련 exact FK·unique·hash/receipt/감사·양방향 commit 제약과 이 operation의 일회 승인 소비를 연결한다. 기존0011/0033/0035 SQL·기존 행/권한을 덮거나 실제 적용하지 않는다. 이 DRAFT에서는 SQL 파일/역할/DB를 생성하지 않는다.
- 후보 표는 project/request/request server command/candidate command·원 payload/hash·exact change target/current activation scope·policy/actor/client/세대·시각을 결박한다. 임의 request에 남의 후보 삽입/후속 후보 덮기/소비만 보존/activation만 보존·감사 누락은 commit 불가여야 한다.
- 적용/현재 pointer·재확인 표시와 과거 이력 guard는 마지막 합법 신규 command/CAS를 검사한다. 합법 후속 적용으로 현재 pointer가 진행했다고 과거 이력을 위조로 판단하지 않는다.
- 새 후보 오류 제안: 잘못된 구조422 APPROVAL_INPUT_INVALID, 대상/hash/CAS/기준 변경409 APPROVAL_TARGET_CHANGED 또는 기존 VERSION_CONFLICT, 보호 원문 다른 주체404 NOT_FOUND, 후보 저장/귀속/해시 깨짐503 ACTIVATION_APPROVAL_STORAGE_UNAVAILABLE, 영향/안전 미확인412 DESIGN_ACTIVATION_NOT_READY. 오류는 값·SQL·민감 본문을 내보내지 않는다. 기존 연산의 오류 의미는 그대로다.
- UI07 준비/입력 보존→후보 원문 확인→명시 요청→UI08 별도 결정→UI07 exact 결박/별도 적용→고정 이력 조회. 새로고침/이탈/응답 유실은 동일 명령 수동 재확인, 미확인인데 새 ID/새 승인으로 재적용0. 거절 후 새 입력은 옛 후보 보존·새 ID/hash/새 요청이다.
- 필수 시험: 최초/후속 CAS, 같은ID 다른hash·impact/plan 진행, 확정/원문/제안 선택 불일치, 현재OWNER/원요청자·조회다른client와 집행다른client 구별, 회원회수·만료/DENY/옛세대, 소비/부작용 원자성·replay, 동시 새queue/claim/결과·늦은관측/안전미확인, 이탈후 원문/후속GET0. 기존 upload/detach/연결/작업계획 승인과 기존 AUTO 저장은 영향 범위 회귀로 유지한다.
- 단위/in-process/합성 브라우저/SQL 정적 검토와 실제 PG compile/commit·DML·경합·served·OS 관측을 구분한다. 아직 어떤 신규 시험도 실행한 것으로 표시하지 않는다.
- 소스 rollback은 후속 revert 가능. 미래 실제 적용 이력은 코드 revert로 삭제/소급 취소하지 않고 새 수정/복구 사건으로 남긴다. 정책 DENY는 신규 집행 차단이지 이미 적용한 기준의 자동 복구가 아니다.

## 8. 이번 필요한 정확 결정

1. §3~5·7의 **activate 한 연산 후보5필드 보관/보호조회·기존 baselineRefs의 현재 pointer CAS 한정 연결·원자 승인 소비**를 source/화면·미적용 SQL·합성 구현 기준으로 채택할지. 다른 후보 공개/공통 연산 확대0이다.
2. §6은 별도 실제 source/완전성·writer 안전 선행으로 유지한다. 이것을 소스 코드/합성 자료만으로 해결됐다고 간주하지 않는다. 구체적으로 입증 가능한 coverage 패킷이 없으면 그 적용 경로만 닫고 다른 독립 승인 기능은 진행한다.

실제 DB 생성/적용·사용자 정책/계정·Secret/인증서/서비스·실기준 전환/업무재개·실 Agent/비용/Oracle·VIEWER/r2/DD166F/공유B 채택은 이번 요청에 없다. 프로젝트의 전체 구현 승인을 다시 요청하지 않는다.

