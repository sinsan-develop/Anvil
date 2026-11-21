# FN08 normal 허가 회수 대상의 보호 단건 조회 후보

상태: **미채택 계약 후보**. 소스 대조 기준 `753b551b`. 이 문서는 신규 공개 조회·노출·읽기 정책의 결정 준비이며 구현·실제 활성화·DB/ACL 적용·Agent 실행 승인이 아니다. 제품·시험·SQL은 변경하지 않았다.

기존 normal 회수 저장은 이미 채택됐다. `FN08_NORMAL_GRANT_REVOCATION_SOURCE_IMPLEMENTATION_20261114.md`의 부모 SHA256 `462D92B2429701077E9B9A8BDE26DCC68ACE8F31323A87ABF685FBC8A4EFC542`, `WORK_STATUS.md:19380–19390`의 채택·source 검수 기록을 따른다. 부모 후보의 과거 “미채택” 표제를 다시 승인 대기로 해석하지 않는다. 기존 `revokeExecutionGrant` payload/저장/동일 명령 재확인·0096은 재승인 대상이 아니다.

## 1. 실제 끊김과 입력 출처

| 근거 | 확인한 사실 |
|---|---|
| `apps/server/modules/executions/normal-initial-execution.ts:191–218` | 원 START의 grant.binding에 execution/generation·preparationRef·intent.assignmentRef·permissionPolicyRef가 결박된다. `NORMAL_QUEUE_STORED` 영수증의 snapshot에는 execution/generation/grantRef/budgetPolicyRef가 있고 permissionPolicyRef는 없다. grant.binding과 commands.policy_ref를 대조해야 한다. |
| `apps/server/modules/access/project-command.ts:187–191` | 기존 projectReplay는 project·원 actor·명령/hash로 원 결과를 확인한다. 다른 현재 OWNER를 위한 공개 역사 reader가 아니다. |
| `apps/web/src/features/session-detail/ExecutionStartOriginPanel.tsx:29–37`, `execution-start-origin-api.ts:25–36` | UI05의 선택된 확정 임무에서 START 원자료의 보호 목록→고정 원문을 열 수 있다. 검산된 origin에는 executionId/generation·assignmentRef·preparationRef가 있다. 이 화면의 commandId는 **registerExecutionStartOrigin** 명령이며 grant 발급 명령이 아니다. |
| `normal-initial-execution.ts:66–72,191–199` | normal 초기 입력·grant binding에는 originRef가 없다. origin을 normal 발급의 부모·승인·사용된 원문이라고 선언할 근거가 없다. |
| 웹의 normal queue/revoke 소비 검색 및 `projects/routes.ts:369` | normal 회수 POST는 명시 구성된 서버 분기에 존재하지만 웹에서 normal 발급 영수증/발급 commandId를 선택하는 경로와 normal 회수 폼은 연결돼 있지 않다. 준비·대기 요청·원자료 영수증은 대체 식별자가 아니다. |

따라서 “발급 commandId를 입력받는 GET 한 개 추가”만으로 사용자의 회수 여정이 끝나지 않는다. 수기 ID 입력, 로그/DB 조회, 내부 raw 응답 복사를 정상 화면 동선으로 요구하지 않는다.

## 2. 대안과 좁은 권장안

| 안 | 실제 출발점과 추가 범위 | 판단 |
|---|---|---|
| A. 선택된 원자료의 exact 복합값으로 원 normal 발급 단건 검색 | 기존 UI05 보호 원자료 선택에서 출발. 그 저장값을 **탐색 입력으로만** 읽고 원 normal 발급행을 별도로 검산하는 신규 GET 한 개. | 이 후보의 권장안. 동일 값을 가진 유일한 발급이 실제 존재할 때만 대상 표시가 가능하다. |
| B. 선택 임무의 보호 발급 이력→고정 단건 | 기존 확정 임무 fullref로 한정한 신규 목록/cursor·단건 두 공개 조회, 명시 정책 및 UI 선택. | 원자료 없이 발급된 grant까지 발견해야 할 때의 대안. 목록 노출·페이지/시간 anchor 범위가 더 크므로 A에 묵시 포함하지 않는다. |
| C. 발급 명령 ID만 받는 단건 | 원 raw POST 영수증을 보유한 내부 caller에는 가능하지만 현재 웹 사용자가 ID를 얻지 못한다. | 최종 권장안이 아니다. 화면 없는 reader만으로 완료 처리할 수 없다. |

A의 유일성은 새 귀속 규칙이 아니라 기존 저장 식별자의 결합으로 확인한다. `0017_execution_authority.sql:170–186`에서 executions는 PK `(project_id,id,generation)` 및 UNIQUE `(project_id,command_id)`, execution_grants는 UNIQUE `(project_id,command_id)`를 가진다. 선택된 원자료의 **project/executionId/generation**으로 E를 찾고 `G.project_id=E.project_id AND G.command_id=E.command_id AND G.execution_id=E.id AND G.generation=E.generation`를 강제한다. 양쪽 원 command FK를 통해 현재 원장 형상에서는 발급 명령 하나·grant 하나만 대응한다. 다른 command의 추가 grant를 최신판/정렬 순서로 고르지 않는다.

그다음 G의 원 canonical hash, grant.binding의 project/execution/generation, `preparationRef`, `intent.assignmentRef`를 선택 원자료의 값과 **fullref 전체**로 대조한다. 원 C/queue 영수증 및 START record도 독립적으로 일치해야 한다. 같은 실행 ID만 맞으면 통과시키지 않는다. 이 대조는 “선택 원자료와 같은 식별값을 가진 별도 발급”을 뜻하며 origin→grant 계보나 원자료의 실제 실행 소비를 증명하지 않는다.

0건의 완전한 부재는 연결된 발급 없음이다. E는 있는데 G/C/영수증이 없거나, 둘 이상·hash/참조 불일치이면 손상/불명으로 닫는다. 유일성을 제약 이름만 믿지 않고 실제 조회 건수와 관계를 검산한다. 대상 generation의 발급을 찾으며 current/latest generation으로 바꿔 검색하지 않는다.

**사용성 범위:** 기존 보호 원자료를 선택했고 위 복합값의 정상 normal 발급이 존재하는 사용자는 수기 식별자 없이 단건에 도달할 수 있다. 원자료 없는 발급·다른 준비/임무로 발급된 grant 전체 발견은 A가 해결하지 않는다. 이 경우 “발급 없음”을 “프로젝트 grant 없음”으로 표시하지 않으며 B의 별도 노출 결정을 남긴다. 새로운 origin 귀속 계약은 채택하지 않는다.

## 3. 제안하는 공개·읽기 정책 delta

새 GET 후보:

`GET /api/v1/projects/:projectId/execution-grant-revocation-target`

닫힌 query: `{assignmentId,assignmentVersion,assignmentHash,originId,originVersion,originHash}`. UI05에서 이미 보호 GET으로 선택한 정확 assignmentRef/originRef만 공급한다. 본문·추가 query·connector Bearer·프로젝트 교차는 거절한다. 서버가 원 origin을 다시 보호 판독하고 그 assignmentRef와 요청 fullref를 대조한 후 §2 검색을 수행한다. caller가 임의 executionId/grant/policy를 삽입하는 대체 경로는 없다. GET 이름·query는 이 후보의 신규 공개 계약이며 아직 구현되지 않았다.

현재 인증된 HUMAN, 현재 미보관 project의 OWNER, 현재 회원·client·credential generation·세션 기한을 같은 `AccessRepository.authenticated(token,null,...)` 거래에서 확인한다. 원 발급자와 현재 조회자가 달라도 위 검산과 **현재 조회자 명시 정책**을 만족해야 한다. 원 발급자의 현재 로그인·현재 제어권·현재 세션 기한은 역사 판독 조건으로 재사용하지 않는다. 공개 GET이 현재 제어권 획득이나 회수 권한을 부여하지 않는다.

새 읽기 연산 후보 `readExecutionGrantRevocationTarget` 한 개를 기존 PROJECT/HUMAN material 정책 allowlist·직렬화·UI 선택에 명시 추가한다. 이 신규 읽기 목적의 정책 결정 후보는 exact 현재 project/HUMAN·`limitPolicyRef:null`·유한 기한의 AUTO만 허용하는 것이다. 이 AUTO 한정은 기존 회수 저장 승인에 자동 포함된 사실이 아니며 본 조회 계약의 채택 대상이다. 일치 규칙에서 DENY 우선, REQUIRE_APPROVAL/미설정/만료/회수는 거절한다. approval 소비나 runtime EXECUTION 정책 연산 추가는 하지 않는다. 기존 원자료 읽기 `readExecutionStartOrigins` 권한도 그대로 요구한다. 원자료 선택을 빌미로 그 보호 reader의 조건을 우회하지 않는다.

새 연산은 GET 전용이다. 일반 project POST/replay 분기에서 이 읽기 목적을 받아 이전 영수증을 반환하거나 새 command를 저장하지 못하게 해야 한다. 읽기 권한 추가가 기존 `revokeExecutionGrant`의 명시 EXECUTION/sourceScopes·현재 PROJECT budget·단독 제어 검산을 대신하지 않는다. 기존 회수 정책을 PROJECT material 규칙으로 바꾸지 않는다.

공개 응답은 raw 영수증/그랜트가 아니라 다음의 닫힌 최소 projection 후보(최대 4KiB, Cache-Control:no-store)다.

```text
{
  kind: 'NORMAL_GRANT_REVOCATION_TARGET_V1', projectId,
  selectionOriginRef, assignmentRef, preparationRef,
  executionId, executionGeneration,
  grantRef,
  issuedAt, grantExpiresAt,
  historyVerification: 'STORED_GRANT_VERIFIED',
  selectionRelation: 'EXACT_FIELDS_MATCH_ONLY',
  generationRelation: 'CURRENT_GENERATION' | 'HISTORICAL_GENERATION',
  grantRecordState: 'UNEXPIRED_AT_READ' | 'EXPIRED_AT_READ' | 'REVOCATION_RECORDED',
  checkedAt, expiresAt,
  executionAuthorized:false, dispatchPerformed:false,
  revocationEffectiveVerified:false, writerReleaseVerified:false
}
```

fullref는 항상 `{id,version,contentHash}` 전체다. 원 envelope/영수증의 commandId와 `commands.command_id`, 내부 `commands.id`/G.command_id, queue 영수증 data.ref, 과거 permissionPolicyRef/budgetPolicyRef는 내부 관계·hash 검산에만 사용한다. 기존 회수 POST가 이 역사 식별자를 요구하지 않으므로 공개 projection에 반환하지 않는다. `selectionOriginRef`는 요청 선택 확인값일 뿐 grant 부모 ref가 아니다.

사유·주체 원문/세션 ID·sourceScopes 상대경로·Options/지시/문서·credential·키·PID/SDK SID·전체 grant/receipt/manifest는 반환하지 않는다. checkedAt/expiresAt은 조회 시점과 HUMAN/읽기 정책/최대 30초의 최단 기한이며 저장 grant의 기한을 연장하지 않는다. `UNEXPIRED_AT_READ`는 원 grant의 만료·회수 기록 대조만 뜻하며 현재 실행/OS/허가 사용 가능 상태가 아니다.

## 4. 원 저장 검산과 역사/현재 정책 분리

같은 authenticated PoolClient/query/XID·유한 DB 시각 안에서 현재 OWNER/원자료 읽기 정책/새 읽기 정책을 먼저 검산하고 project·관련 head의 기존 잠금 순서와 종료 직전 재검사를 유지한다. 동시 정책 변경·회수·회원/client/session 변경 및 결과 유실 때 보호 projection을 성공으로 내보내지 않는다. 각 current guard의 기한은 줄어들 수만 있다. 이 GET은 실행·예약·quota·원 command/grant/회수행을 쓰지 않는다. 기존 인증 거래의 세션 관리·COMMIT/ROLLBACK 의미는 그대로다.

신규 역사 reader가 구현해야 할 후보 검산은 다음과 같다. 현재 이 전체 검산을 수행하는 공개 역사 reader는 없으며, 기존 producer의 저장 관계를 이 후보가 구현 완료했다고 간주하지 않는다. 원 C는 PROJECT `queueExecutionCommand`, APPLIED, `NORMAL_QUEUE_STORED`, snapshot NORMAL_PROTECTED/START_SESSION이어야 한다. E/G/C/X·authorization receipt/audit와 원 queue ref/hash, grant의 factHash/scopeDigest/hash 및 원 발급 시각/기한을 검산한다. `G.binding.permissionPolicyRef = C.policy_ref`, `q.budgetPolicyRef = G.binding.intent.budgetPolicyRef`와 원 발급 역사 참조를 확인한다. 없는 값을 최신 policy로 채우거나 source callback 값을 검산된 저장 사실로 승격하지 않는다.

`ProjectLimitPolicies.read(db,actor,pid,id,version)`는 원 발급 budget의 불변 버전/hash와 저장 영수증 대조에 재사용할 수 있다. 원 budget/permission 정책이 현재 expired/revised라는 이유로 정상 역사 ref를 최신 ref로 치환하지 않는다. 반면 실제 회수 입력의 permissionPolicyRef/budgetPolicyRef는 **현재 회수자에게 적용되는 현재 정책**이다. 기존 `authorizeRuntimePolicy`/`ProjectLimitPolicies.resolveCurrent` 및 POST가 이를 다시 검산한다. 원 발급의 과거 정책 refs는 반환하지 않으며 회수 폼의 현재 정책으로 자동 채택하지 않는다.

`0083_normal_initial_execution.sql.pending:96`의 `normal_initial_graph`는 첫 단계에서 `normal_queue_authorized`를 호출한다. 후자는 현재 command GUC/원 HUMAN·정책 등 발급 거래 조건을 포함한다. 이를 역사 GET에 그대로 호출하여 “옛 발급자 현재 로그인 필요”를 만들거나 그 조건을 완화하지 않는다. 역사 불변 관계 검산을 기존 TS ref/hash·receipt 규칙에서 분리해 재사용하는 구현이 필요하다. 현재 발급/permit/challenge 함수를 역사 조회를 위해 수정하지 않는다.

## 5. 부재·옛 세대·만료·회수·UNKNOWN

| 상황 | 조회/화면 의미와 후속 |
|---|---|
| 현재 읽기 권한 없음, 다른 project/assignment/origin hash | 원 대상 정보 비표시. 기존 401/403/404 계열 처리, 탐색 fallback0. |
| 선택 복합값의 E/발급이 실제 없음 | 고정 단건 연결 없음. 프로젝트 전체 grant 부재나 미실행을 추론하지 않는다. |
| E 존재 후 필요한 G/C/X/영수증 누락, 중복, 변조 | 손상/UNKNOWN으로 거절. 0건으로 숨기거나 성공 projection을 부분 반환하지 않는다. |
| 정상 과거 세대 | 당시 원 ref만 역사 표시, HISTORICAL_GENERATION. 새 회수 준비/새 POST는 열지 않는다. 기존 POST의 current_generation exact 거절은 그대로다. |
| grant 만료 | 정상 역사라면 EXPIRED_AT_READ. 기존 채택 회수는 ACTIVE/EXPIRED를 허용하므로 만료만으로 역사 조회나 기존 회수 의미를 금지하지 않는다. 현재 HUMAN/정책 만료와 구분한다. |
| 회수 기록 존재 | 원 회수 ref/hash/범위를 내부 검산한 뒤 REVOCATION_RECORDED. 새 회수 명령 준비0. 실제 credential 폐기/OS 종료/writer 해제 완료를 표시하지 않는다. |
| 조회 중 정책/head/세션/제어 관련 문맥 변경·요청 취소·기한/응답 유실 | 새 보호 결과 없음. 재조회는 명시 동작만; 자동 retry/다른 ID 선택0. |

기존 미결 회수 command/hash와 입력은 조회 실패·새 대상 선택·페이지 왕복으로 지우거나 다시 쓰지 않는다. UNKNOWN/APPLIED 응답 유실은 **기존 동일 command 명시 재확인**으로만 처리한다. 새 GET이 그 명령 결과를 대신 판단하지 않는다. 회수 기록 존재/조회 실패가 기존 동일 명령 재확인을 금지하는 사유도 아니다. 새 명령의 이중 회수 409 및 기존 replay 현재 권한 검산은 보존한다.

## 6. 최소 조립·SQL/ACL 판단 및 미완료

Main 조립 후보는 기존 AccessRepository와 ProjectLimitPolicies를 사용하는 별도 normal target reader→명시 구성된 projects GET→UI05 기존 원자료 선택의 조회 버튼이다. 원자료 재검산은 기존 보호 reader의 같은 거래 핵심을 재사용해야 하며 두 인증 거래의 독립 결과를 현재성 근거로 단순 합치지 않는다. 필요 내부 메서드 추출은 의미 보존 범위로 검수한다. app 기본 활성화·서버 main 구성은 이 문서로 켜지 않는다.

`0017:209`는 app에 executions/execution_grants/execution_commands SELECT를 이미 부여한다. 0083는 normal 저장·완결을 기존 표에 연결한다. 실제 normal revoke도 같은 app authenticated 거래에서 해당 저장행을 SELECT한다. 따라서 **현재 소스상 새 table/role/일반 GRANT는 필수로 입증되지 않았다**. 프로젝트/주체 보호는 새 reader의 실제 접근 경계이며 기존 table SELECT가 공개 GET 노출 승인을 대신하지 않는다. 실제 PG role/ACL/RLS·잠금·역사 손상 행은 미검증이다. 구현 중 추가 권한이 필요하면 이 후보로 넓히지 않고 정확 대상/최소 delta를 별도 보고한다. 기존 0017/0083/0096 원문 수정이나 일반 권한 완화는 없다.

채택 후 파일 후보: 신규 `apps/server/modules/executions/normal-grant-revocation-target.ts`, 기존 `projects/routes.ts`·`app.ts`의 명시 reader 구성, `access/project-command.ts`의 GET 목적 allowlist/POST 차단, `connections/policy-editor-profile.ts`의 정확 읽기 목적, 기존 UI05 원자료 패널과 신규 전용 웹 decoder/작은 조회 패널, 대응 FN08/UI05 직접 시험. 실제 소유 경로는 Main이 채택 이후 최소 단위로 고정한다. 기존 회수 생산자/정책 의미를 바꾸는 일은 이 목록에 포함하지 않는다.

**현재 회수 정책 입력의 별도 빈칸:** `connections/candidate-policy-api.ts:26–29`의 `readCandidatePermissionPolicy`는 `/permission-policy`의 현재 PROJECT policy head 전체와 rules/hash를 읽는다(`access/project-command.ts:157,326`). 이 ref는 서버 `authorizeRuntimePolicy`가 받는 현재 permission policy head와 같은 종류이지만, 조회 성공만으로 `revokeExecutionGrant`의 exact HUMAN·EXECUTION(project/execution/generation)·sourceScopes·limitPolicyRef·DENY/기한 조건을 만족한다고 볼 수 없다. 같은 파일의 `editablePermissionRule`과 `policy-editor-profile.ts`는 PROJECT scope/limitPolicyRef:null의 편집만 지원하며 runtime 회수 규칙을 준비하는 화면이 아니다. `connections/limit-policy-api.ts:48–52`의 `readLimitPolicy` 역시 이미 아는 exact ref의 역사 판독이고 현재 budget head/가용성 선택을 보증하지 않는다. 따라서 현재 runtime 규칙에서 같은 grant 범위에 적용될 명시 후보를 선택하고 그 limitPolicyRef가 현재 PROJECT budget head인지 확인하는 웹 소비는 아직 미구현·미입증이다. 이 후보의 역사 GET으로 그 권위를 만들거나 과거 ref를 자동 채우지 않는다. 기존 보호 정책 조회/선택으로 이를 닫을 수 있는지 후속 구현에서 먼저 증명하고, 부족한 공개 조회가 실제 필요하면 그 delta를 별도로 제시한다.

**남은 사용자 연결:** A GET+UI 명시 조회로 고정 회수 대상을 찾는 단계는 닫을 수 있다. 현재 웹에 없는 normal 회수 폼·현재 EXECUTION 정책 선택/제어 확인·원 미결 buffer 보존을 기존 채택 POST와 연결해야 실제 회수 요청 여정이 끝난다. 이 문서는 저장 의미를 다시 승인받는 안이 아니며, 그 UI 미구현을 숨기지도 않는다. source-only 합격을 실제 회수/STOP/Agent 실행 완료로 세지 않는다.

## 7. 채택 후 검수와 rollback

- 실제 앱 RAM: 기존 UI05 원자료 목록→정확 원문 선택→명시 버튼 전 GET0→같은 project/assignment의 유일한 normal 발급 단건. 원자료 생성 commandId를 발급 commandId로 오용하지 않음. 원 발급자와 다른 현재 OWNER의 정상 읽기 및 명시 읽기 정책 없는 거절.
- normal producer의 실제 RAM 행/영수증에서 최소 projection 생성. 발급 commandId/queueRef/과거 permission·budget refs 공개0. 과거 policy와 현재 회수 policy를 다른 값으로 두고 자동 치환0. originRef가 grant binding에 새로 들어가지 않음.
- 0건/2건·같은 execution 다른 prep/임무/hash·다른 project·기존 C/G 관계 손상·옛 세대·만료/회수·정책 전환/경합·현재 세션 변경·지연 old401/닫기·ABA 반례. current/OS/Agent/STOP 호출0·POST 자동0.
- 기존 normal revoke 정상 저장 및 동일 q/hash 재확인·다른 q 이중 회수·COMMIT UNKNOWN 회귀. 현재 읽기 실패로 원 미결 buffer 소멸0.
- SQL 소스/실제 ACL 근거를 구분한다. RAM/정적 검수는 실제 PG 잠금·권한·배포나 사용자 인수를 대신하지 않는다.

미채택 후보 rollback은 이 신규 문서의 인수 제외다. 이후 소스 구현을 철회할 때는 명시 reader/UI 구성만 제거하고 원 회수 명령·역사 행·미결 buffer와 기존 정책 기록을 보존한다. 이미 저장된 회수를 삭제/취소하거나 기존 승인된 회수 POST를 닫는 rollback은 이 범위가 아니다. 실제 DB·권한·키·서비스·Agent·사용자 자료·네트워크 실행은 모두 제외한다.
