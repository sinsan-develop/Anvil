# FN08 D2 실행 grant 결박 맥락 묶음 내부 읽기 — 세부 작업지시서 r1

상태: 작업지시서(구현 전). 근거는 `docs/contracts/FN06_FN08_P3_NORMAL_TRANSPORT_DECISION_PACKET_20261113.md` D2 A안(2026-11-13 신산님 채택)이다. 범위는 source·합성 검증이며, 실제 DB·권한 부여·실제 Agent는 제외한다.
작성: 2026-11-13, Claude 세션(Main). 기준: main ed4208d3. 조사: read-only 하위 조사(호출 트리 전수 대조).

## 1. 목표

normal START 자료 GET의 맥락 묶음 공급자(`NormalStartContextSource`, `apps/server/modules/executions/normal-start-materials.ts`)를 구현한다. 공급자는 START가 등록한 맥락 묶음 원문을 **사용자 actor를 흉내 내지 않고, 회원·프로젝트 행 잠금 없이** 다시 조립한다.

결과 bytes는 START 때 `startContextBody`(normal-initial-execution.ts:111-129)가 만든 bytes와 같아야 한다. 등록된 길이·hash 대조는 자료 GET이 이미 한다(normal-start-materials.ts:156).

## 2. 현재 사실(조사 결과)

**호출 트리.**
- `ProjectContexts.readStartSource` → `#load`(→ `#stored` → `ProjectApprovals.readContextConsumption`)
- → `ProjectContextSources.resolve`
- → 배정 확인(CONF) → 초안(DR, → 작업계획 WP → 설계 색인 DI·문서 DOC, → 방법론 MET)
- → 헌법 → 지식(KN, → `#verify` → WP·DOC·대화 CV) → 문서(DOC) → 대화(CV)
- → `planContextText` → `startContextBody`

**actor 사용 분류(전수).**
- **결과 bytes를 바꾸는 사용(S)은 도달 가능한 경로에 없다.** 모든 호출자 actor 사용은 `projectMember` 회원 확인(M)이다.
- S 사용(승인 originReuse 분기, 후보 reader, 방법론 `formsFor`)은 buildTaskContext 경로에서 도달하지 않는다.

**잠금(L).**
- CS:146 `FOR UPDATE OF projects p, project_members m`
- DR:126 `assignment_drafts` head 행 `FOR UPDATE`
- WP:101 `documents` 두 행 `FOR SHARE`
- 그 밖의 잠금은 없다.

**쓰기.** 없다. 파일 읽기는 `ProjectDocuments.#artifact`/`originalText` 하나뿐이며, 이미 actor를 쓰지 않는다.

**보관(archived) 프로젝트 거절은 현재 어디에도 없다.** `projectMember`도 `archived_at`을 거절하지 않는다. D2가 요구하므로 새로 추가한다.

**현재 시험 대역 문제.** `tests/unit/FN08/normal-start-materials-journey.test.ts:57-66`의 공급자는 `readStartSource(db, f.actor, …)`로 START 사용자를 흉내 낸다. 이는 D2가 금지한 방식이므로 교체 대상이다.

## 3. 설계

### 3.1 접근 판별자(한 구현 유지)

reader 구현을 두 벌로 복사하지 않는다. `actor` 자리에 **접근 판별자**를 받게 해서, 모든 유지 검사(§4)를 한 구현으로 남긴다.

```ts
type ReadAccess = { kind:'HUMAN'; actor: AuthenticatedIdentity } | ExecutionGrantRead;
// ExecutionGrantRead: 모듈 비공개 WeakSet/symbol로만 발급되는 표식 객체. HTTP 경로·외부 호출자는 만들 수 없다.
function assertReadAccess(db, access, projectId, lock:boolean): Promise<void>
//  HUMAN → 기존 projectMember(db, actor, projectId, lock) 그대로(같은 SQL 문자열)
//  GRANT → 회원 조회·잠금 없음. 호출자가 같은 snapshot에서 grant 현재성을 이미 검산했다는 표식만 확인
```

- **기존 공개 메서드**(`read`, `readStartSource`, `resolve`, `current` 등)는 시그니처와 SQL 문자열을 바꾸지 않는다. 내부에서 `{kind:'HUMAN',actor}`로 core를 부른다.
- **그대로 둘 SQL**: 시험 대역이 SQL 문자열을 그대로 비교하는 곳이 있다(예: `FOR UPDATE OF p,m`, assignment_drafts `FOR UPDATE`). 그래서 **기존 문장은 고치지 않고**, GRANT 분기에만 잠금 없는 새 문장을 둔다.
- **prototype 고정 검사 유지**: 일부 메서드는 prototype identity를 고정해 검사한다(execution-start-context-source.ts:20/39, execution-start-origin-reuse.ts:172-181, ProjectContexts 생성자 :28). 해당 메서드 객체는 바꾸지 않고, 새 core를 별도 메서드로 둔다.

### 3.2 모듈별 분리 지점

| 모듈 | 추가(core) | 공개 actor 경로 |
|---|---|---|
| ProjectContexts (context/project-contexts.ts) | `#loadStored(db,pid,id,version)` = :72-79에서 :71 회원 확인 제외. `readRegisteredStartSource(db,grant,pid,ref)` = :95-101 본문 + `sources.resolveRegistered` | `read`·`readStartSource`·`list`는 `projectMember` 유지. `readStartSource`도 같은 core를 불러 START와 전달이 한 구현을 공유 |
| ProjectApprovals (approvals/project-approvals.ts) | `readContextConsumptionForGrant(db,pid,id)` = `#history` core에서 :234 제외. **operation은 `buildTaskContext`만 허용**하고, `queueExecutionCommand`·후보 종류는 actor 의존 분기 **전에** 거절 | `readContextConsumption` 메서드 객체·동작 불변 |
| ProjectContextSources (context/context-sources.ts) | `#resolveCore(db,pid,input,access)` = :147-210. `resolveRegistered(db,grant,pid,value)`는 :146 잠금 없이 core 호출 | `resolve`는 `projectMember(…,true)` 유지 |
| 배정 확인 CONF | `readCore(db,pid,id,version,access)` = :84-98 | `read` 유지 |
| 배정 초안 DR | `readCore`, `currentCore(db,pid,ref,access)`. GRANT에서는 head_version을 **잠금 없는** 새 SELECT로 읽고 `#basis(access)` | `read`·`current`·`currentForContent`·`#parent` 유지 |
| 작업계획 WP | `read`·`decision` core(access). `#readiness`의 documents head/confirmed는 GRANT에서 **FOR SHARE 없는** 새 SELECT | 기존 유지 |
| 설계 색인 DI | `read` core(access) | 기존 유지 |
| 방법론 MET | `readApplicationCore(db,pid)` = :22-23 | 기존 유지 |
| 지식 KN | `read` core·`#verify` core(access). 계획·문서·대화는 각 core로 | 기존 유지 |
| 대화 CV | `readMessageCore(db,pid,cid,id)` = :52-59(backupBudget 없음) | `readMessage` 유지 |
| 문서 DOC | `#version`·`#verifySources`가 actor 대신 access를 받음. :303 DOCUMENT_SOURCE_REFS 경로도 access 전달 | `version` 유지. `originalText`·`#artifact`는 변경 없음 |
| 접근 ACC | `projectNotArchived(db,pid)` = 잠금 없는 `SELECT archived_at` | — |

### 3.3 공급자 흐름(`NormalStartContextSource.contextBody`)

1. **연결과 거래**: 자기 pool 연결에서 `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`로 시작한다. 일관 snapshot이 생기고, 잠금이 없으며, 쓰기 0을 DB가 강제한다.
   - 이 공급자는 이미 자료 GET 거래 **밖**에서 불린다(I1 보완, normal-start-materials.ts:149-150, :208).
2. **grant 결박 확인(잠금 없음)**:
   - grant 행이 NORMAL_PROTECTED이고, 실행·세대가 일치하며, 회수되지 않았다.
   - 원 START 명령·자료 등록 행이 그대로이고, 등록 맥락 그룹의 payloadRef가 요청 `contextBundleRef`와 같다.
   - 프로젝트가 보관되지 않았다(`projectNotArchived`).
   - `normal_exchange_current`는 `FOR UPDATE`를 쓰므로 READ ONLY 거래에서 쓸 수 없다. 그래서 잠금 없는 읽기 전용 확인을 둔다.
   - **권위 있는 현재성·회수 재확인은 자료 GET의 두 번째 거래가 잠금 아래에서 다시 하므로 이중이다.**
3. **표식 발급**: 2가 통과한 경우에만 같은 거래 범위에서 `ExecutionGrantRead`를 만든다.
4. **조립**: `contexts.readRegisteredStartSource(db, grant, projectId, contextBundleRef)` → `startContextBody(ctx, {contextBundleRef, assignmentRef: ctx.manifest.assignmentRef})`.
   - 두 번째 몸체 조립기(execution-start-context-source.ts:73)를 복사하지 않는다.
   - 저장 manifest와 원문만으로 지름길 조립을 하지 않는다. `resolve`의 검사를 건너뛰게 되기 때문이다.
5. **종료**: ROLLBACK 후 연결을 반환한다. 2초 제한·abort는 기존 `boundedContext`가 맡는다.

## 4. 반드시 유지할 검사

모두 한 구현에 남아야 한다.

**격리**
- `ARTIFACT_QUARANTINED`(DOC:167, sensitive-inspection:10)
- CS:198-201의 REDACTED 변환
- PC:100 비INCLUDED 거절(412)

**민감 내용**
- `assertStoredArtifactReadable`(412)
- `assertKnowledgeTextSafe`: KN, CV, DOC, context-text-plan, context-manifest, 자료 GET:157

**지식 정정·대체**
- `knowledgeState` SUPERSEDED
- CS:178-181 EXCLUDED/MISSING
- `constitutionEligibility`
- KN:72/74 정정 근거·변경 출처

**사용자 지시 대체**: CS:166 supersedes → EXCLUDED

**문서 확정**: CS:185-187 확정 버전 + 최신 HUMAN_REVIEW ACCEPTED

**헌법 현재성**: CS:151/171, manifest의 constitutionRef

**배정 확인·현재성**
- CONF receipt·review 무결성
- DR head_version 일치, `#basis`(계획 확인 유효·관계 projection·방법론 적용 불변·기준선 허용)

**저장 묶음 무결성**
- PC `#stored`: 명령·영수증·감사·manifest hash·승인 소비
- PC `#load` context_items와 manifest 일치

**재구성 고정**
- 재구성 manifest가 저장 manifest와 정확히 같아야 한다(PC:99, part hash·sourceState 포함).
- `startContextBody`의 part bytes·hash 재검산
- 자료 GET의 등록 길이·hash 재검산

## 5. 바뀌는 검사

- 회원 여부(`projectMember`) → grant 현재성·회수·세대·등록 행 확인(§3.3-2)
  - START 사용자의 회원 자격이 나중에 해지돼도 이것만으로는 거절되지 않는다. 대신 grant가 회수되거나 만료되면 거절된다.
  - D2 원칙(실행은 grant 범위로 결박)에 따른 의도된 변화다.
- 행 잠금 3곳 → READ ONLY snapshot(잠금 없음)
- 보관 프로젝트 거절 **추가**

## 6. 단계와 소유 파일

**P-A 판별자 도입(동작 불변 리팩터)**
- 대상: §3.2의 모듈 core 추출, `ReadAccess`·`assertReadAccess`·`projectNotArchived`
- 기존 공개 경로는 HUMAN 판별자로 같은 결과를 내야 한다.
- 완료 조건: §7 회귀 시험 전부가 **변경 없이** 통과한다(기대값·대역 SQL 수정 0).

**P-B 공급자 구현과 전달 연결**
- 대상: `NormalStartContextSource` 구현 모듈(신규), 서버 조립(app 옵션), grant 결박 읽기 전용 확인 SQL(필요하면 미적용 0091)
- 시험: 자료 여정 시험의 공급자를 actor 흉내에서 grant 결박 reader로 교체한다.

**P-C 독립 검수.** 단계마다 검수하고, 승인 범위·실행 승인 경계를 확인한다.

## 7. 회귀·검증 시험

**변경 금지 기준선(P-A)**
- FN05: `context-sources`, `context-store`(:54 회원 부재·manifest 변조, :63 항목 변조), `context-approval-consumption`, `context-manifest`, `context-text-plan`
- FN05 지식·대화: `knowledge*`, `constitution`, `conversation*`
- FN03 `document-source-refs`
- FN09 `assignment-store`, `assignment-confirmation-store`, `child-human-content`, `execution-start-origin-routes`(+fixture, prototype 고정)
- FN08 `execution-start-context-source`(prototype 고정)
- IX01 `work-plan-readiness-boundary`
- FN14 `preparation-record-connection`

**신규(P-B)**
- grant 결박 reader 여정: START 몸체와 바이트 동일
- 거절 경우: 회수·만료 grant, 다른 실행·세대, 등록 행 변조, 보관 프로젝트, 격리 원문, 대체된 지식·지시, 미확정 문서, 헌법 재적용, 배정 head 변경
- 잠금·쓰기 0: 대역 SQL에 FOR UPDATE/SHARE·INSERT가 없음
- START 사용자 회원 해지만으로는 거절하지 않음(grant 유효 시)
- 표식 위조: 외부에서 만든 객체를 거절

**통합(실제 DB, D1 1단계 이후)**
- `integration/FN02/application-assignment-race-isolated`
- `integration/IX01/methodology-design-plan-knowledge-source`

## 8. 위험과 대응

- **바이트 불일치**: 실패해도 닫힌 쪽으로 끝난다(409 CONTEXT_SOURCE_MISMATCH 또는 412). 다른 bytes를 내지 않는다(PC:99 + startContextBody + 자료 GET hash).
- **판별자 우회**: 표식은 모듈 비공개로만 발급하고, 위조 시험을 둔다. 승인 core는 buildTaskContext만 허용한다.
- **잠금 제거로 인한 경합**: READ ONLY snapshot 안에서는 일관되고, 소비 직전 자료 GET 두 번째 거래가 잠금 아래에서 다시 확인한다.
- **넓은 리팩터 회귀**: P-A는 동작 불변이 완료 조건이다. 기존 시험의 기대값·대역 SQL 수정을 금지한다.

## 9. 범위 밖

실제 DB 적용, 권한(ROLE·RLS) 변경, 실제 Agent 실행, D1 3단계 실행기 작업, 맥락 묶음 생성(START) 쪽 동작 변경.
