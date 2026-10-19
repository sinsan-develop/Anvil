# FN15 사람·클라이언트 인계 최소 계약 제안

- 상태: DRAFT / NOT_ADOPTED. 계약 채택·제품 구현·실인계 승인 아님.
- 작성: 2026-10-20 Main 어울. PMO의 기존 FN15 공백 구체화 요청에 따른 상세화 제안이다.
- 작성 기준: codex/av3-stage-b `433b2cec6a11acf6955537b065fb89e983723d08`.
- 부모: 설계 §9.3/§11.13, WORK_PLAN FN15/UI12, FUNCTION_WORK FN15(186~197행), INTERFACES §13.6.
- DATA_MODEL의 FN15 control_handoffs는 계획상 관계 정의이며 실제 table 존재 증거가 아니다. 해당 부모 SHA256은 `C92A24746CE9A8840251E9F6CA8ADA560B55B75CC8D0F83D5D47C6D40A87D0B8`이다.
- 부모 SHA256: 설계 `63FD6C2E43689668345BC529F925C1BEF823833E88D59EA99310C301D1854BD3`, 계획 `2FDF3BBD12B937889C7539C512262829E564025D655A929DAFE5AEA03E1386E6`, INTERFACES `B81DC492721DE38634F3EFF711934451161E02833A8BC9EB0A41858B1AA208ED`, FUNCTION_WORK `906D53CA0EC8724C20C54E01D39B38E82D5677D32461957F5FCF081880C290A9`.

## 1. 목적과 실제 공백

프로젝트는 여러 사람이 조회하되 한 사람·한 client만 지휘한다. 다음 담당자가 인계를 요청하고 현재 담당자가 안전 상태를 준비한 뒤, 정확한 요약을 다음 담당자가 수락해야 제어 세대가 바뀐다. 단절·만료·요청·알림·요약 조회는 제어 이전이 아니다.

현재 코드는 최초 제어 행과 변경 집행을 구현했다. 다만 다음 공백은 이름만 있는 기능에 버튼을 붙여 해결할 수 없다.

| 근거 | 현재 사실 | 필요한 상세 계약 |
|---|---|---|
| `db/migrations/0001_projects_access.sql` | project_members는 OWNER/VIEWER/HANDOFF_ELIGIBLE, project_control은 프로젝트당 1행/세대·version | 불변 요청·요약·수락/전후 grant 이력과 동시성 결박 없음 |
| `apps/server/modules/access/project-command.ts` currentProjectController | OWNER + 현재 actor/client + 세대가 모두 같아야 변경 가능 | 현재 제어가 없는 적격 참여자의 요청만 허용하는 별도 제한 검사 필요 |
| 같은 파일 documentOperations/materialRules | requestControl/prepareControlHandoff/acceptControl은 등록되지 않음 | 일반 문서 쓰기·일회 승인으로 위장하거나 검사 생략 금지 |
| `apps/server/modules/projects/repository.ts` detail | 현재 controlState HELD/OTHER_CLIENT/UNASSIGNED를 조회 | 인수 요청·요약·안전 근거·버전은 반환하지 않음 |
| `apps/`, `contracts/`, `db/` 정확 심벌 검색 | 세 FN15 연산과 control_handoff 저장/consumer 없음 | 구체 wire/schema/접근 행렬을 먼저 채택해야 함 |
| FN13 현황/실행 중지 저장 계약 | 합성 중지 요청·불명 보존 등 일부만 구현. 체크포인트 영속 후보는 미게시 | 화면 전환을 실제 중지·소유 회수·안전 인계 증명으로 사용할 수 없음 |

특히 HANDOFF_ELIGIBLE을 새 제어자에 넣어도 현재 OWNER-only 집행으로는 작업할 수 없다. 이를 OWNER로 자동 승격하거나 모든 기존 OWNER 검사를 넓히지 않는다. 다른 사람의 실제 제어 시 허용되는 변경 연산/멤버 역할 유지와 회수 방법은 별도 채택 대상이다.

## 2. 대안과 권장 분할

1. **A 요청·조회·미확인 요약부터 구현(권장):** 현재 grant를 바꾸지 않고 인수 의사·이유·정확 대상/현재 세대·기한을 보존한다. A에서는 수락/제어 전환이 없고 인수 요청자는 요청을 근거로 변경 권한을 얻지 않는다. 기존 제어자의 정상 권한과 변경은 유지한다. 유용한 요청 흐름을 먼저 만들지만 FN15 전체 완료는 아니다.
2. **B 전체 원자 인계까지 한 번에 구현:** 실회수·FN13·진행 작업 안전·HANDOFF_ELIGIBLE 쓰기 행렬까지 같은 범위에서 확정한다. 최종 흐름은 짧지만 현재 미확인 근거를 안전으로 꾸미거나 범위를 지나치게 키울 위험이 크다.
3. **C 현 controlState 조회만 유지:** 권한 계약 변경은 없지만 이미 있는 조회를 다시 꾸미는 데 그쳐 사용자 인수 기능은 생기지 않는다. 개발 진도로 대체하지 않는다.

A는 제안이며 자동 채택하지 않는다. A 이후 B의 실수락은 별도 근거와 변경 계약을 채택해야 한다. 이번 문서 자체는 SQL/API/권한/서비스/실제 Agent를 추가하지 않는다.

## 3. A의 최소 요청 계약 — 제안, 미채택

- requestControl의 첫 범위는 SELF 요청: 인증된 현재 actor/client가 요청의 target과 일치해야 한다. 다른 사람·client를 임의로 지명하거나 가입·초대·역할 변경하지 않는다. 현재 OWNER의 다른 client와 명시 HANDOFF_ELIGIBLE 참여자는 요청 가능 후보, VIEWER/비회원/회수 회원은 거절한다. 이 접근 예외도 새 권한 계약으로 명시 채택한다.
- payload 제안: `targetActorRef:{userId},targetClientRef:{userId,clientId},baseControl:{actorId,clientId,generation,version},reason,expiresAt`. projectId/작성자는 경로·인증에서 결정한다. Secret/session token·임의 표시 경로는 받지 않는다.
- 요청은 현재 제어자를 덮지 않는다. 서버가 project/member/client/control의 존재·활성·정확 세대/version, 자기 대상·최신 재인증·기한을 같은 transaction에서 검사한다. 이미 본인/client가 제어 중이면 중복 인계 대신 거절한다.
- 제어 행이 없거나 회수·사용 불명인 경우에는 A 요청으로 최초 소유권을 만들거나 복구하지 않는다. 알려진 현재 제어 기준이 없는 이유를 거절/미확인으로 표시한다. 요청 역할의 권한은 본인 요청 보관에만 한정된 새 제한 계약이며 일반 프로젝트 변경·승인 정책에 AUTO를 덧붙이지 않는다.
- 유한 기한 제안: 요청 최대 30분, reason 1~20000 UTF16, canonical body 최대 2MiB. 모두 신규 계약의 제안값이며 현재 정책이라고 부르지 않는다.
- 요청 상태는 PENDING과 부가 만료/기준변경 표시를 구분한다. 실패·기한 경과·새 제어 세대가 요청을 삭제하거나 자동 수락하지 않는다. 동일 commandId/내용은 정확 replay, 다른 내용/대상/세대 재사용은 거절한다. replay 전에도 현재 세션·멤버·client 접근을 검사한다.
- 결과 제안: `requestRef:{id,version:1,contentHash},projectId,requestedBy,target,baseControl,reason,createdAt,expiresAt,storedState:PENDING,executionAuthorized:false,controlTransferred:false`. contentHash는 불변 snapshot canonical SHA256이며 표시 상태는 해당 원문을 변경하지 않는다.
- 저장 제안: 요청 원문/버전과 요청 전용 중복 명령·감사 이력. 기존 명령 엔진의 OWNER-only 현재제어 검사를 주석/조건문으로 우회하지 않는다. 새 forward DDL·DB guard/권한 최소 범위는 채택 뒤 실제 schema 목록/번호를 고정한다. 보류 중 0029를 덮거나 예약하지 않는다.

## 4. 조회·요약과 화면 — 제안, 미채택

- 보호 GET 후보: `/api/v1/projects/:projectId/control/requests`(limit/cursor), `/control/requests/:id/versions/:version`, `/control/requests/:id/summaries/:version`. 정확 route·filter·응답은 채택 때 INTERFACES/schema에 고정한다. 기존 project detail 응답을 몰래 확장하지 않는다.
- 요청자에게 본인 요청, 현재 제어자에게 동일 프로젝트의 적격 요청을 최소 정보로 조회시킨다. 임의 VIEWER·타 프로젝트/회수 멤버의 전역 client/요청 탐색은 허용하지 않는다. cursor는 actor/project/filter/limit/기한에 결박하고 raw 원문·다른 사람 세션/Secret은 제외한다.
- HandoffSummary 제안: `requestRef,version,baseControl,observedAt,validUntil,activeExecutions,pendingCommands,pendingApprovals,sourceCheckpointRefs,gaps,safetyState,acceptanceEnabled:false`. 근거마다 exact ref/관측 시각/출처를 보존한다. 미구현 수집자는 빈 배열이 아니라 미확인 gap을 낸다. 요약은 생성 순번/hash로 불변 보존하며 재조회가 현재 안전을 보증하지 않는다.
- 요약 생성은 현재 제어자·일치 actor/client/세대·최신 재인증만 가능하게 제안한다. 요청자에게 생성이나 기존 작업 중지 권한을 주지 않는다. 요청/조회와 다른 제한 명령·감사 계약으로 구분하고 현재 제어·요청 기준을 수집 전후 transaction에서 대조한다. proposed validUntil은 관측 후 최대30초, 각 근거 목록 최대200건/본문2MiB이며 초과·누락은 gap/UNVERIFIED다. 이 수치와 생성 권한도 미채택 제안이다.
- A의 safetyState는 WAITING 또는 UNVERIFIED만 가능하다. FN13 전체 실회수·연속 관측/미전송·실제 writer/child 상태 근거가 없으면 수락 불가다. STOP_REQUEST_STORED·ACK·exit0·오래된 체크포인트·표시상 실행0을 안전 증거로 승격하지 않는다.
- UI12 상세: 현재 담당/제어 client·세대 → 본인 인수 요청/이유/기한 → 자기 요청·현재 담당자 요청 목록 → 정확 원문 → 미결 명령/승인·진행/미확인 근거 → 새 요약. A에서는 수락 버튼 disabled, 이유를 표시한다. 요청 성공 배너는 ‘요청 보관·제어 미이전’이다.
- 화면 왕복/인증 상실/전송 유실: 미확인 명령은 같은 ID/본문만 재확인한다. 이전 제어자의 쓰기/초안을 삭제하거나 다시 실행하지 않는다. 조회 거절/변조/이탈·대상 전환은 이전 원문·요약을 숨기며 보존 입력은 덮지 않는다.

## 5. B의 실수락 전에 확정할 별도 조건

- 새 담당자의 실제 변경 권한 행렬: OWNER와 HANDOFF_ELIGIBLE의 정확 차이, 기존 OWNER 전용 연산 유지, 동일 사용자 client 전환, 변경·승인·요청·읽기별 허용/회수. 자동 OWNER 부여0이다.
- acceptControl의 정확 requestRef/summaryVersion/hash·현재 target 세션/재인증·member/control/안전 facts를 마지막 transaction에서 다시 검사한다. project_control 1행 CAS와 옛 실행 grant/outbox의 차단을 같은 검증 경계에 둔다. UI 수락만으로 OS writer를 회수했다고 주장하지 않는다.
- 동시 수락 하나만 성공, 옛 client·세대의 쓰기/승인·대기 명령 재허가 없이는0, 실패 시 현재 서버 제어 상태 재조회만 한다. 새 세대를 되돌려 양쪽 grant를 살리는 rollback은 없다.
- FN13 체크포인트/실제 회수·진행 실행과 단순 화면 전환을 분리한다. 필요한 근거가 없으면 요청/원문 조회는 유지하고 실수락만 차단한다.

## 6. 구현·검수 순서와 필요한 결정

채택 시 A는 요청 exact schema·접근 행렬/immutable 저장 guard → 기존 인증/멤버/current control과 별도 요청 명령 검증 → 요청·고정 조회·미확인 요약 → UI12 보존 명령/왕복 → 한정 격리 실제 PG 검증 순서다. 업무·판정·원본 추적은 기존 WORK_STATUS에 누적하고 새 관리 도구를 만들지 않는다.

최소 반례: 비회원/VIEWER·다른 target/client·회수/만료 세션 거절, 미수락 요청의 기존 control 행/세대 불변, command 중복/변조·옛 세대, hash/cursor/타 프로젝트 거절, 미확인 실행/스풀/회수 근거의 accept=false, 요청 유실 뒤 같은 명령·원입력 보존. B는 동시 수락/옛 tab/실제 회수 시험을 추가하며 A PASS로 대신하지 않는다.

필요한 새 결정은 **이 문서 A의 SELF 요청 권한 예외·요청/조회/미확인 요약 데이터/API 계약과 그 source·새 forward SQL·신규 빈 격리 QA 구현의 채택 여부**다. 실수락/멤버 권한 부여·정식 DB/서비스·Agent/비용·Secret/인증서 변경은 제외한다. 기존 승인 FN15 전체를 다시 승인받는 질문이나 기존 CapReport/0029 승인 요청의 반복이 아니다.

rollback: A 미공개 source는 일반 revert, 이미 보관한 요청/감사 원문은 삭제하지 않고 접근 경로만 닫는다. 실제 제어 전환0이므로 옛 grant 복구 작업은 없다. 새 schema의 파괴적 downgrade/기존 control 재작성은 하지 않는다.

## 7. 이번 수행의 경계

제안 작성·부모/실코드 대조만 수행했다. 제품 코드/API/SQL·DB/권한/서비스·실인계0, 기능 시험/수락 PASS0이다. 이전 세 UI checkpoint 뒤 Main이 일반 final로 idle한 것은 새 승인 경계 때문이 아니라 계획 연속 진행을 놓친 실행 관리 오류다. 이를 ‘다음 할 일이 없음’으로 일반화하지 않는다. FN15 상세화는 기존 승인 안에서 계속 가능한 작업이며 A 채택 전 mutation만 분리한다. 다른 미완료 업무 전체의 불가능을 주장하지 않는다.
