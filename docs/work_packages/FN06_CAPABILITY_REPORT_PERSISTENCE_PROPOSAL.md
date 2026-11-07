# FN06 CapabilityReport 입력·불변 보관·고정조회 계약 제안

- 상태: DRAFT_PROPOSAL / NOT_ADOPTED — 2026-10-20, Main 어울.
- 근거: PMO의 2026-10-20 '계약 제안 설계만' 위임. 기존 WORK_PLAN FN06/08/09, INTERFACES §12.1/12.3을 구체화하는 제안이며 기존 정본·실행 권한을 변경하지 않는다.
- 이번 범위: 문서 설계만. 새 제품 코드·endpoint·SQL/DB·권한·키·서비스·OS helper·실제 Agent/비용·실제 QA는 모두 미실행이다.
- 부모 문서 SHA256: INTERFACES 23D89CF4C64C3FFBEE92DAB2357931947C35A6ECD9B0DD00D60FC9C61DE3D4FB; FUNCTION_WORK 906D53CA0EC8724C20C54E01D39B38E82D5677D32461957F5FCF081880C290A9; v3 설계 63FD6C2E43689668345BC529F925C1BEF823833E88D59EA99310C301D1854BD3.
- 보호 출처 GET/FN05 거절·0029·보류6·정식 PG 재개 미승인과 독립이며 어느 것도 해제하지 않는다.

## 1. 해결할 공백과 바꾸지 않을 것

현재 execution-intent-v1의 capabilityRef는 필수 VersionRef다. project-execution-preparations는 연결/환경 후보의 같은 프로젝트·head/hash/기한을 검사하지만 능력 실측 원본을 해석하지 않고 CAPABILITY_UNVERIFIED/NOT_AUTHORIZED를 남긴다. UI04는 유효한 능력 참조 없는 새 준비 저장을 닫는다. 후보에는 6능력의 미확인 선언만 있고 CodexHandshakeQa는 actualExecutionVerified=false인 QA 보고다.

후보 ref/임의 ID/성공한 initialize/공급자 주장/QA fixture를 실제 능력 보고서로 승격하지 않는다. 실제 ConnectionDefinition/EnvironmentVersion과 후보 버전은 다르며 현재 후보 참조만 있는 경우 CANDIDATE_ONLY로 남긴다. 문서/형식/등록/세션 연결/개별 능력/실제 임무 적합/허가는 각각 별도 상태다.

## 2. 대안과 권장안

| 대안 | 장점 | 한계·영향 |
|---|---|---|
| A. 독립 불변 보고서 + 기존 보호 근거 참조 (권장) | Anvil 소유 이력·정확 hash/귀속·현재성 resolver를 분리; 기존 capabilityRef 소비 가능 | 새 데이터/보관·권한/고정조회 계약과 후속 forward migration 결정 필요 |
| B. 기존 artifact에 보고서 원문만 보관 | 기존 bytes/hash/격리 저장 재사용 | artifact hash는 보고 주체/현재성/능력 판정이 아님; 별도 검증 인덱스가 결국 필요 |
| C. 후보 ref 또는 메모리 QA 보고를 대신 사용 | 새 보관 없이 표시 가능 | 실측/이력·귀속/재시작·현재성 구분 불가; 실행 근거로 부적합 |

A에서 원문 근거는 기존 보호 artifact를 재사용하고 보고서 snapshot과 원명령/근거 참조 결박만 새로 저장한다. 기존 후보/API 응답·기존 SQL·권한은 변경하지 않는다.

## 3. 제안 자료형

ReportRef는 기존 VersionRef(id/version/contentHash) 문법을 유지한다. 한 수집 시도의 보고는 불변 id/v1이며 정정·재측정은 새 id/v1과 supersedesRef를 만든다. 이전 보고의 내용·판정·실패는 덮지 않는다.

Report snapshot의 필수 항목:
- projectId, connectionRef, environmentRef: 정확 fullref; bindingKind(CANDIDATE_ONLY/REGISTERED_BINDING). bindingKind는 서버가 실제 저장 종류·버전을 조회해 결정하며 호출자 주장을 믿지 않는다.
- tool: product, version, adapterVersion, executableObservationRef 또는 null. 표시 버전과 실제 바이너리/호스트 관측은 별개다.
- reportedBy: HUMAN/CONNECTOR의 주체·client/connectorGeneration 참조. 실제 credential·외부 account/session handle 원문은 제외한다.
- sourceAssurance: HUMAN_CLAIM/QA_SYNTHETIC/TRUSTED_PROBE. 인증된 사람이 쓴 보고도 실측 진위를 자동 인증하지 않는다.
- observedAt(실측 시각 또는 null), recordedAt(서버), expiresAt(유한 기한), probeRunRef/authorizationReceiptRef(없으면 null), supersedesRef(없으면 null).
- capabilities: 아래 6개가 각각 정확히 한 번. 누락/중복/알 수 없는 code는 거절한다. 별도 rawFailureCode/비밀 없는 제한 이유는 허용하되 예외 원문·stderr를 일반 snapshot에 넣지 않는다.
- executionAuthorized=false, dispatchPerformed=false. 보고 등록 자체는 도구 호출이나 실행 허가가 아니다.

각 항목은 기존 §12.1과 같은 code/documentation/measurement/controlLevel/limitations를 사용한다.
- documentation: source(보호 문서 ref 또는 자격정보 없는 HTTPS 근거), observedAt, versionCompatibility=CONFIRMED/UNVERIFIED/UNSUPPORTED. 문서 확인을 measurement 상태에 복사하지 않는다.
- measurement: state=VERIFIED/UNVERIFIED/UNSUPPORTED, toolVersion, environmentRef, executionRef?(별도 허가된 시험), evidenceRefs. 확인한 코드·환경·버전/시각·실제 명령/결과·근거 hash가 정확히 결박되어야 한다.
- controlLevel=DIRECT/ISOLATED/OBSERVED_ONLY/UNVERIFIED. 실행기 격리가 없는데 ISOLATED, 중지 응답만으로 회수 DIRECT를 주장하지 않는다.
- limitations: 남은 한계·미측정 이유. 임무의 N/A는 이 6능력에서 삭제하지 않고 별도 임무 검토로 사유/검토자를 남긴다.

| code | VERIFIED를 검토할 최소 근거 | 그 자체로는 부족한 것 |
|---|---|---|
| INSTRUCTION_SESSION | 허가된 제한 시험의 정확 지시→동일 세션/turn 수신 상관 | 도구 실행/initialize/메시지 전송 시도 |
| STATE_ORIGINAL | 허가된 상태·원문 회수와 식별/순번·누락·hash 대조 | 마지막 요약/공급자 완료 주장 |
| RESULT_EVIDENCE | 실제 변경/명령/시험 자료와 실행·환경 결박 | exit0/fixture/build만 |
| TOOL_APPROVAL | 정확 요청·결정·scope·기한·일회 소비/거절 관측 | 자동 승인/임의 사용자 지시 우회 |
| STOP_RECLAIM | 요청→정확 소유 프로세스 종료/쓰기 회수·잔여 대조 | interrupt 응답/시간 초과/화면 닫힘 |
| PATH_WRITE_CONTROL | 실제 등록 root·정체성/매핑·범위·교체/이탈 차단 근거 | 경로 문자열/DB lock/선언 |

실측이 없거나 시각/환경/버전/수집 신뢰가 불명확하면 UNVERIFIED다. UNSUPPORTED는 정확 제품/버전의 명시적 공식 근거와 검증된 지원 불가 관측으로만 분류한다. quota/권한/통신 실패·원인 미확정은 UNSUPPORTED로 바꾸지 않는다. HUMAN_CLAIM/QA_SYNTHETIC 입력은 VERIFIED 또는 실제 통제 수준으로 자동 승격하지 않는다.

원 주장은 submittedMeasurementState/requestedControlLevel 및 불변 입력/claimRef에 보존하고, 응답의 measurement.state/controlLevel은 서버 판정으로 분리한다. sourceAssurance/bindingKind/서버 판정은 호출자가 지정할 수 없다. HUMAN 입력에 VERIFIED 주장이 있어도 그 주장은 삭제/덮기 없이 보관하고 서버 판정은 UNVERIFIED/통제 미확인이다. TRUSTED_PROBE는 서명만으로 충분하지 않으며 실제 허가된 수집기·probe와 근거 귀속/상관을 검증할 수 있을 때만 서버가 부여한다.

유한 기본값 제안(미채택): canonical 입력/snapshot 각각 최대2MiB, 정확6항목, 항목별 evidence 최대20·문서근거 최대20·텍스트 각20000 UTF16/URL2048. 유효기간 기본30분/상한2시간이며 실제 효력은 측정/허가·근거의 가장 짧은 기한을 넘지 않는다. 실측시계/시각 결박이 미확인·미래 시각이면 VERIFIED를 만들지 않는다. 이 수치는 기존 정책이 이미 보고서에 승인됐다는 주장이 아니라 후속 채택의 결정 대상이다.

## 4. 입력·보관·조회 제안 — 아직 채택하지 않음

- 입력은 기존 프로젝트 commands의 신규 operation=recordCapabilityReport를 제안한다. targetId=null/expectedVersion=0, 동일 commandId/동일 payload만 replay하고 다른 내용은 충돌한다. raw credential/임의 실행 명령은 받지 않는다.
- HUMAN 입력에는 현재 로그인·프로젝트 OWNER/단독 제어·최근 재인증·별도 명시 정책·대상 fullref/원문 권한을 요구한다. 실제 사용자에게 정책을 자동 부여하지 않는다. REQUIRE_APPROVAL의 소비 연결이 채택되기 전에는 승인 필요를 우회하지 않고 거절한다.
- CONNECTOR 실측 수집은 별도 후속 계약이다. 기존 STATUS_ONLY credential에 보고/원문/실행 권한을 암묵 추가하지 않는다. 현재 세대/정확 프로젝트·허가된 probe·근거 상관을 확인할 수 없으면 저장 거절 또는 HUMAN_CLAIM/UNVERIFIED로만 별도 기록한다.
- 새 capability_reports 불변 snapshot/원명령 결박 저장을 제안한다. 기존 protected artifact는 같은 프로젝트/허용 버전/hash·격리 상태를 확인해 참조만 연결한다. 보고/receipt/감사·근거 결박은 같은 transaction COMMIT 또는 전부 rollback이다. 구체 DDL·기존 app 역할의 새 표 권한·합성 QA 생성은 후속 별도 결정 대상이다.
- 고정 GET 제안: /api/v1/projects/:projectId/capability-reports/:id/versions/1. query/list/latest/전역 검색·자동 근거 다운로드는 이번 제안에 포함하지 않는다. 현재 회원/주체·보고 귀속·hash/receipt/불변 원본을 재검사하며 타 프로젝트/미존재는 같은 404, 현재 접근 회수는 거절한다.
- 응답은 reportRef/snapshot와 checkedAt 및 currentnessIssues/effectiveForExecution=false를 분리한다. 보관 VERIFIED 이력이 있어도 현재 유효하거나 실행 가능하다는 뜻은 아니다. 과거 보고·supersedes 이력과 현재 무효 이유를 함께 표시한다.
- 근거 원문 열기는 기존 보호 파일 경로를 명시 소비하고 매번 현재 권한·격리/bytes/hash를 검사한다. 일반 조회에는 비밀 없는 코드/참조/한계만 제공한다. 의심 자료는 기존 격리 정책을 따르며 보고서가 격리를 해제하지 않는다.

## 5. 현재성·기존 소비와 호환

보관 무결성과 현재 적합성은 별도다. 내부 resolver는 선택한 report fullref→같은 project/connection/environment 종류·현재 버전→현재 tool/adapter/host 관측→현재 credential/허가 세대→실측 근거/기한·격리/회수→임무 필수 능력별 상태/통제 한계를 순서대로 대조한다. 변경·만료/회수·근거 부재/미확인은 유효성 false/구체 issue이며 과거 보고 삭제가 아니다.

execution-intent-v1/AdapterContext의 capabilityRef 형태는 유지한다. 후속 prepareExecution/authority/dispatch의 실제 resolver는 보고된 ref의 존재/무결성/정확 binding과 현재성을 소비해야 한다. 기존 SYNTHETIC_ONLY와 기존 미확인 준비는 이력으로 보존하며 migration 시 실제 보고로 backfill하거나 실행 가능으로 바꾸지 않는다. CANDIDATE_ONLY 보고는 실행 근거가 될 수 없다. 예산·필수 맥락/이해·원문 효력·도구 승인·OS fence·수신/실행 관측은 별도로 필요하다.

부트스트랩: 실능력 확인에 필요한 제한 시험은 일반 개발 임무를 미리 허용하는 우회가 아니다. 정확 대상/소스/변경/시간/비용/정리의 PROBE_ONLY 별도 허가와 실측 수집 계약이 필요하다. 그 계약/허가가 없으면 보고서 보관만 구현해도 실제 연결은 미완료다.

## 6. 후속 최소 검증·rollback·필요 결정

구현을 별도 채택한 뒤에만 아래를 실행한다.
- 문법/6능력 누락·중복·알 수 없는 값·불명 시각/무제한 기한·민감 원문·과대 본문 거절; 주장/문서/QA를 실측으로 승격하지 않는 음성.
- 정확 fullref·타 프로젝트/옛 세대·expired/revoked binding·근거 hash/격리/권한 회수·정정 이전본 보존·원명령 exact replay/내용 충돌·중간 실패 rollback.
- 새 빈 격리 PG에서 승인된 새 forward migration/COMMIT·권한·고정 GET를 검증하고 정식 DB/served/실Agent 증거와 구분한다. QA 자원은 먼저 literal 등록·수명/정리·잔여0을 확인한다.
- 제한 실측의 호출/OS/비용·원문 수집은 별도 exact 승인 범위에서만; 미실행이면 해당 능력 UNVERIFIED, source/DB/형식 PASS를 실제 연결 PASS로 보고하지 않는다.
- rollback: 새 코드/route/소비 연결을 비활성화하되 보고/근거·감사 이력을 삭제하지 않는다. 지속 데이터/새 권한 회수·DB rollback은 별도 영향/승인에 따른다. 이번 문서만 철회할 때는 제안 철회 이력만 남긴다.

이번 문서 설계는 PMO 위임으로 완료 가능하며 재승인을 기다릴 항목이 아니다. 다음 결정은 A안 채택 여부와 정확 신규 저장/GET·operation·접근권한/forward migration source 범위다. 실제 적용·정식 DB·키/credential scope·OS helper/Agent/비용은 그 결정에 포함해 추정하지 않는다. 채택 전 기존 정본/manifest hash·제품 API/SQL은 불변이다.
