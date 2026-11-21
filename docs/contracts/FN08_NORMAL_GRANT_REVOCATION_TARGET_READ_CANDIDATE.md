# FN08 normal 허가 회수 대상의 보호 단건 조회 후보

상태: **r2 · 미채택 계약 후보**. 소스 대조 기준 `20cb66a7`(r1 `0715ad99`에 보관된 후보). r2는 PMO의 기존 정책 조회 재사용 판단을 반영한 구현맵이며 신규 대상 GET/읽기 목적의 채택을 대신하지 않는다. 이 문서는 신규 공개 조회·노출·읽기 정책의 결정 준비이며 구현·실제 활성화·DB/ACL 적용·Agent 실행 승인이 아니다. 제품·시험·SQL은 변경하지 않았다.

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

현재 정책 입력은 새 API 없이 기존 보호 조회에서 얻는다. `connections/candidate-policy-api.ts:26–29`의 `readCandidatePermissionPolicy`는 현재 `/permission-policy` head의 ref와 **전체 rules**를 hash 검산한다. PROJECT-only 제한은 같은 파일의 편집 함수에 적용되는 것으로 GET 필터가 아니다. 현재 사용자 HUMAN/userId, `revokeExecutionGrant`, targetScopes 하나의 exact EXECUTION/projectId/executionId/generation, 유효한 limitPolicyRef·기한을 갖는 규칙에서 budget 후보 fullref를 수집한다. 같은 fullref는 묶되 원 규칙을 버리지 않고, 복수 ref는 사용자가 명시 선택한다. 배열 첫 값·최신 추정·과거 발급 정책을 자동 선택하지 않는다.

선택한 limitPolicyRef는 기존 `readLimitPolicy`(`connections/limit-policy-api.ts:48–52`)의 exact GET으로 조회한다. 서버 `ProjectLimitPolicies.read`(`runtime-policy.ts:155–162`)의 projectMember 및 불변 원문/영수증 검산과 웹 project/ref/hash 검산을 유지한다. 이는 **현재 budget head 인증이 아니다**. 화면은 선택한 저장 정책과 기한만 보여 주고 현재 허용/예산 가용/회수 가능을 확정하지 않는다. 원 grant의 sourceScopes는 최소 대상 응답에 없으므로 UI가 coverage를 계산했다고 표시하지 않는다. DENY/REQUIRE_APPROVAL 규칙을 숨기거나 승인 대안으로 바꾸지 않으며, 문법·ref가 오염되면 준비를 닫는다.

최종 판정은 기존 POST의 `authorizeRuntimePolicy`(`runtime-policy.ts:198–219`)에 남긴다. 현재 제어권·permission head exact ref, 현재 HUMAN/EXECUTION scope와 원 grant의 모든 sourceScopes coverage, 겹치는 DENY 우선, 선택 budget에 적용되는 REQUIRE_APPROVAL 거절, approvalRef:null, PROJECT `resolveCurrent`의 현재 head/APPLIED/기한을 원 거래에서 검산한다. 따라서 exact GET에서 읽힌 오래된 budget도 POST에서 거절될 수 있다. 후보 없음·정책 변경·명확한 거절은 사유와 원 입력을 남기고, 선택 ref 교체나 POST 자동 재시도는 하지 않는다. 별도 policy discovery/current-budget GET는 이 여정에 필요하지 않다.

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

## 6. 확정 구현맵과 최소 변경 후보

사용자 흐름은 **UI05 원자료 선택 → 새 대상 GET → 기존 현재 permission policy GET → 후보 limit ref 명시 선택·기존 exact GET → 사유/명시 확인 → 기존 회수 POST → 영수증 또는 원 명령 재확인**이다. A는 원자료와 exact 값이 일치하는 발급에 한정된다. 원자료 없는 전체 발급 발견은 B의 임무별 목록/cursor 노출 비용이 추가되며 이번 A 구현에 포함하지 않는다.

| 단계 | 기존 근거·구현 경계 |
|---|---|
| 대상 조회 | AccessRepository + ProjectLimitPolicies를 사용하는 별도 normal target reader, 명시 projects GET. 원자료 보호 판독과 역사 대조를 같은 authenticated 거래에서 결박한다. 두 독립 인증 결과를 현재성 근거로 합치지 않는다. |
| 정책 후보 선택 | §4의 기존 두 reader를 호출한다. 현재 permission head ref와 선택한 limitPolicyRef를 고정하되 최종 현재성/권한은 POST 책임이다. 새 정책 API·EXECUTION 정책 발급/편집·권한 부여는 추가하지 않는다. |
| 회수 준비/제출 | 현재 documentControl의 client/controlGeneration과 대상 project/execution/generation/grantRef, 선택 policy refs, 사유를 기존 ProjectCommand로 결박한다. `operation:revokeExecutionGrant`, `targetId:executionId`, `expectedVersion:generation`, `baselineRefs:[]`, `approvalRef:null`, payload exact `{grantRef,permissionPolicyRef,budgetPolicyRef,reason}`. 사용자 확인 전 POST0, 새 commandId는 준비 때 한 번 고정한다. |
| 기존 서버 소비 | `/api/v1/projects/:projectId/commands`의 명시 normalRevocations 분기→`NormalGrantRevocations.command`를 그대로 사용한다. 현재 HUMAN·CSRF43·제어·정책·기한·원 grant/회수 원장을 재검산한다. 서버 미구성/미적용 SQL은 실패이며 성공으로 흉내 내지 않는다. |
| 결과와 미결 복구 | 기존 NORMAL_PROTECTED/NORMAL_REVOCATION_STORED/NORMAL_GRANT_REVOCATION_STORED·APPLIED, 원 request/hash/ref와 효과 false flags를 검산한다. 응답 유실/형상 불명은 원 pending/hash·사유·refs를 상위 App buffer에 보존하고 편집/새 준비를 막는다. 사용자 ‘같은 명령 결과 확인’만 원 command를 재제출한다. 정책이 바뀌어 replay가 거절돼도 refs/ID를 교체하지 않는다. |

재사용 근거는 `SourceReadGrantsPanel.tsx:14–23`의 명시 회수 작성→상위 buffer에 pending/hash 저장→send→소유된 settle/불명 보존 및 `App.tsx:130–131,373`의 페이지 밖 buffer 보유다. 정확 buffer/transport·세션/CSRF와 늦은 결과 분리는 `MethodApplicationPanel.tsx`의 `capture/changeOwned/send` 패턴을 참조한다. 기존 관측 패널의 자동 목록 조회나 회수 권한을 복사하지 않는다. 새 target/policy 읽기는 명시 동작이며 project/user/client·세션/transport·닫기/ABA 후 응답은 폐기한다. 원 pending은 별도 소유 검산 아래 보존해 페이지 왕복 후 돌아올 수 있고, 다른 주체에게 노출하거나 자동 제출하지 않는다. 명확한 거절과 응답 유실을 구별하며 원 명령을 수정한 재확인은 없다.

채택 후 소유 후보는 다음으로 한정해 순차 검수한다.

- 서버: 신규 `apps/server/modules/executions/normal-grant-revocation-target.ts`, 기존 `projects/routes.ts`·`app.ts` 명시 조립, `access/project-command.ts`의 신규 GET 목적 allowlist/일반 POST 차단. 기존 normal 회수 producer와 runtime policy 계약은 유지한다.
- 웹: 기존 `ExecutionStartOriginPanel.tsx`, 신규 같은 폴더의 `normal-grant-revocation-api.ts`/`NormalGrantRevocationPanel.tsx`, `App.tsx` 및 실제 상위 session-detail props 경로의 원 buffer 전달, `connections/policy-editor-profile.ts`의 **신규 읽기 목적만** 추가. `candidate-policy-api.ts`와 `limit-policy-api.ts`는 기존 export 재사용이 우선이다. 실제 props 연결 파일은 구현 착수 시 확정한다.
- 검수: 신규 FN08 보호 target/service 시험과 UI05 회수 폼·App buffer RAM 시험. 기존 normal revoke/replay 시험은 의미·기댓값을 유지한다. 조회·후보 선택의 성공과 회수 저장/실제 효과를 분리한다.

`0017:209`의 app SELECT와 0083의 기존 표/완결을 재사용하므로 현재 소스상 새 table/role/일반 GRANT가 필수로 입증되지는 않았다. 실제 PG ACL/RLS·잠금은 미검증이며 필요 권한은 별도 정확 delta로 보고한다. 기존 0017/0083/0096 수정·일반 권한 완화는 없다. **새 공개 계약은 대상 GET과 읽기 목적만**이다. 실제 server main 활성화·DB 적용·권한 발급·서비스/Agent/STOP 실행은 제외하며, 이 문서만으로 전체 사용자 여정 구현 완료를 주장하지 않는다.

## 7. 채택 후 합성 검수와 rollback

- 실제 App RAM에서 원자료 목록→고정 선택→명시 target GET→현재 policy head/rules→복수 limit ref 중 명시 선택→exact GET→사유/확인→기존 POST와 원 영수증을 연결한다. 클릭 전 추가 GET/POST0, 서로 다른 선택·project·주체에서 누수0. 원 발급자와 다른 현재 OWNER의 읽기 및 신규 읽기 정책 거절도 검산한다.
- 현재 permission GET에 PROJECT/EXECUTION 규칙을 함께 두어 전체 rules가 유지되는지 확인한다. 다른 사용자/op/project/execution/generation·오염 ref는 후보0, 동일 ref 중복/복수 ref는 자동 선택0. 과거 발급 policy와 현재 선택 policy를 다르게 두고 자동 치환0, 새 policy API0.
- exact budget GET 성공이 현재 head를 뜻하지 않는 반례와 POST의 current head 교체·제어 상실·DENY·sourceScopes 미충족·REQUIRE_APPROVAL·budget 회수/만료 거절을 기존 서버 합성 경계로 검산한다. UI 자체의 조회 성공을 회수 권한으로 표시하지 않는다.
- 대상 0/2건·다른 prep/임무/hash·손상·옛 세대·만료/회수와 닫기·ABA·늦은 401·세션/transport 교체를 검산한다. 원 commandId/queueRef/과거 policy refs 공개0, origin 계보 추가0.
- POST 응답 유실 및 APPLIED 후 응답 검산 실패→App 상위 pending 보존→페이지 왕복→동일 q/hash 명시 재확인. 이 사이 target/read 정책 실패·현재 runtime policy 변경도 원 입력을 지우거나 ref를 바꾸지 않는다. silent retry/다른 command 생성0, 새 회수 409와 기존 replay 검산 유지. 실제 회수/OS 종료/writer 해제·Agent 효과 주장0.

이 r2 작업은 문서만 변경하며 시험·실환경 실행은 하지 않았다. 이후 rollback은 신규 reader/UI 명시 연결을 제거하고 기존 회수 명령·역사·미결 buffer·정책 기록을 보존한다. 저장된 회수 삭제/취소나 기존 채택 POST 폐쇄는 이 범위가 아니다.
