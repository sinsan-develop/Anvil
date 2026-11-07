# FN05 임무 맥락 준비 연결 실행계획

> 수행자는 기존 WORK_PLAN과 이 상세 단위를 `superpowers:executing-plans`로 이어간다. 새 세션·branch·자동화는 만들지 않는다.

**목표:** 정확 확정 임무와 허가된 원문을 묶어 준비 후보를 저장·재조회하고 필수 누락을 화면에 표시한다. 실제 Agent 전달/이해·실행 완료는 범위 밖이다.

**구조:** 기존 프로젝트 명령 집행과 보호 원문 조회를 소비한다. DB에는 불변 manifest·분할 metadata만 저장하며 원문은 기존 보호 보관소의 exact ref를 재사용한다.

**기술:** 기존 TypeScript/React/Fastify/PG15·원문 보관소. 새 의존성 없음.

**기준:** FN05_CONTEXT_PREPARATION_PROPOSAL.md SHA256 `5C1B71EB2097232366A11AD60072FD330E20BF1C716864A85CB59639C1185F2B`·INTERFACES §10.4·DATA_MODEL의 context_bundles/items. 2026-10-18 PMO 기존 위임권에 따른 권장 A 전달 범위만 적용한다. 침묵을 Main이 새 승인으로 추정한 것이 아니다.

## 공통 경계와 검수 초점

- 정식 DB 적용/기존 서비스 전환/실사용자 정책 부여·Agent/비용/host/키/Secret/certificate/Oracle·운영0. 기존 QA 경로 심사 직접 확인이 미해결이므로 actual 격리 QA도0이며 이 계획으로 우회하지 않는다.
- 기준은 현재 branch의 안전 checkpoint다. 과거 0012/소진 compile·원실패를 재시도하거나 PASS로 바꾸지 않는다.
- 현재 로그인·OWNER·명시 정책/client/제어 세대·기한/CAS/replay·감사, exact 임무와 같은 프로젝트 원문·현재 헌법/격리·정정·제외를 집행한다.
- 필수 자료·예산·원문 선정/현재 위치·최신 관련 지시 의미·수신/이해가 미확인이면 그대로 남긴다. ready/executionAuthorized/dispatchPerformed=false다.
- 검수 초점: 교차 프로젝트/옛 세대, 동일 명령 재확인과 원문/확정본 변경, 부분 조회 중 원문 격리/권한 회수, 필수 항목/복수 지시의 무음 누락, UI 주체 전환·영수증 유실. 각 소유 단위에서 해당 음성을 검사한다.

## 1. 필수 슬롯·원문 선택 입력과 분할

파일: 신규 `apps/server/modules/context/context-input.ts`, 기존 `context-text-plan.ts`, 신규 `tests/unit/FN05/context-input.test.ts`와 기존 분할 시험.

인터페이스: `readContextPreparationInput(value) -> ContextPreparationInput`, operation=`buildTaskContext`.

정확 payload는 `{assignmentRef,budgetRef,slots,limits,reason}`이다. assignmentRef는 VersionRef, budgetRef는 null/VersionRef며 서버에서 확정 임무의 값과 다시 대조한다. limits는 텍스트 부분의 `{maxPartBytes:1..2097152,maxParts:1..200}`로 실제 Agent 예산을 뜻하지 않는다.

필수 슬롯 코드는 PURPOSE_REASON/RULES_SCOPE/LATEST_INSTRUCTIONS/DECISIONS_REASON/CURRENT_POSITION/ACTUAL_GAPS/NEXT_ACTION 7개이며 각각 `{code,sources,reason}`다. 코드별 하나씩 있어야 하고 미확인 원문은 sources=[]로 명시한다. 필수 여부/INCLUDED/READY를 caller가 설정하지 않는다. 슬롯은 고정 코드 순으로 정규화하되 모든 선택 원문을 보존한다.

source는 `{kind:'KNOWLEDGE_VERSION',versionRef}`, `{kind:'DOCUMENT_VERSION',versionRef}`, `{kind:'USER_INSTRUCTION',conversationId,messageRef}` 중 하나다. messageRef는 실제 기존 CONVERSATION/id/hash 형태다. 목적/헌법은 지식 원문 최대1개, 최신 지시는 지시 원문 복수, 결정 이유는 지식 복수, 현재 위치/실제 공백/다음은 지식·문서 복수를 받는다. 전체 선택은 최대200, 슬롯 안 중복 금지. 같은 원문을 여러 의미 슬롯에 쓰는 것은 허용하되 의미 적합성/최신성은 자동 합격하지 않는다.

- [ ] 입력 시험: 필수7·빈 선택/복수 지시 보존, 코드 누락/중복·READY/required 추가·다른 형태/한도·민감 이유·가짜/불완전 ref 거절을 RED로 확인한다.
- [ ] canonical JSON/2MiB·기존 VersionRef/원문 ref 문법·이유20,000 UTF16/알려진 민감표식을 검사한다. 선택을 권한 검증으로 승격하지 않는다.
- [ ] 분할 매체 형식 coercion M1의 배열/객체 음성 RED→문자열 검사 GREEN. 기존 UTF8/필수 누락/용량 음성은 유지한다.
- [ ] 직접 입력/분할·기존 인접 시험과 type/diff 후 checkpoint. 아직 서버 저장/라우트가 아니라고 기록한다.

## 2. 실제 원문 조회·불변 manifest

파일: 신규 `context-sources.ts`, `context-manifest.ts`와 각 FN05 단위 시험. 기존 ProjectAssignmentConfirmations/ProjectAssignmentDrafts·ProjectKnowledge/ProjectConstitutions/ProjectConversations/ProjectDocuments를 소비한다.

입력 선택은 실제 확정 임무와 현재 draft/basis를 대조한다. 목적 지식은 PURPOSE, 헌법은 현재 적용된 CONSTITUTION/eligibility, 지시는 같은 대화의 실제 USER_INSTRUCTION, 결정은 DECISION인지 검사한다. 지식의 제외/대체·문서 격리/원문 hash/본문 연결을 재조회한다. 문법상 ref만 맞으면 통과시키지 않는다. 명시 빈 슬롯은 MISSING, 민감 격리는 REDACTED, 제외는 EXCLUDED로 보존한다. 다른 프로젝트·변조/불가능 ref는 저장하지 않고 거절한다.

manifest는 기존 ContextBundle 필드와 source별 분할 순서·원본/부분 hash·바이트 범위를 갖고 평문 부분은 저장하지 않는다. 확정 임무/baselineRefs·현재 헌법 적용 ref·선택 원문/이유·예산 ref와 미검증을 결박한다. 생성 시각 당시 자료를 보존하고 최신 의미/실제 수신·이해는 미확인이다. 재조회는 같은 source를 읽어 현재 접근/격리와 hash를 다시 확인한다. 원문 선정/관계 전체성·현재 상태의 의미 확인은 별도 검토 전 미확인으로 남긴다.

- [ ] 같은 프로젝트 실제 서비스 코드의 resolver/manifest 입력 정상·교차/변조/헌법 변경/배제·모든 복수 선택 보존·분할 복원 음성을 RED→GREEN으로 구현한다. 저장 mock을 실제 PG로 부르지 않는다.
- [ ] 권한/본문 계층을 생략하지 않고 기존 helper를 재사용, direct/type/diff로 후보 checkpoint를 만든다.

## 3. 저장·보호 GET·DB guard 후보

파일: 신규 `project-contexts.ts`, `db/migrations/0014_context_preparation.sql`, 기존 프로젝트 routes/명령 operation 목록·DATA_MODEL/INTERFACES, FN05 단위/통합 시험.

`buildTaskContext`는 targetId=null/expectedVersion=0의 새 불변 후보다. 기존 명령 집행 후 exact assignmentRef/CAS·원문을 확인하고 context_bundles/items·receipt를 같은 transaction으로 저장한다. 과거 묶음을 UPDATE/DELETE하지 않는다. 정책이 없거나 DENY/만료면 거절하고 실제 사용자에게 정책을 자동 부여하지 않는다.

`GET context/:id/versions/:version` 및 exact 확정 임무별 후보의 유한 목록은 같은 프로젝트 회원 검사를 먼저 수행하고 현재 원문 권한/격리 상태를 재확인한다. 현재 상태 불명은 당시 manifest의 INCLUDED를 현재 사용 가능으로 덮지 않는다. 원문/명령/기준·정규 열/JSON/hash/FK/직접DML/권한·감사 guard를 기존 SQL 패턴과 대조한다.

- [ ] 보호 route/명령/CAS/replay·manifest 변조·역할/현재 권한·guard 음성을 먼저 작성하고 가능한 순수/transport 검증을 실시한다.
- [ ] forward SQL은 기존0012/0013을 변경하지 않고 후보로만 작성·검수한다. 실제 적용/권한집행/동시성은 actual QA 허용 전 미검증이다.
- [ ] exact clean/private checkpoint 뒤에도 QA 경계 해소·literal 자원 사전등록/부재확인 전 실행0이다. 미실행을 PASS로 표시하지 않는다.

## 4. UI04 준비 저장·목록/정확 원문 재조회

파일: 신규 `context-api.ts`, `WorkspaceContextPreparation.tsx`, 기존 AssignmentContentDecision/WorkspacePage·App의 해당 버퍼 연결과 UI04/FN05 시험.

확정 임무→필수 슬롯별 정확 원문 선택/누락→명시 준비 저장→고정 후보/부분 metadata·현재 사용 가능/미확인 재조회로 연결한다. 기존 조회 API를 사용하고 임의 source ID를 검증된 선택으로 만들지 않는다. 사용자 입력/미확인 command를 project/user/client·binding에 보존하며 이전 화면의 늦은 callback·401·다른 선택이 현재 결과를 덮지 않게 한다.

- [ ] 원입력/명령 보존·같은 명령 재확인·slot 전환/빠짐·현재 원문 거절·주체 전환 음성을 TDD로 구현한다.
- [ ] type/build·영향 회귀와 허용된 실제 핵심 검증을 구분해 기록한다. actual QA가 막히면 실제 UI/API/PG는 미검증으로 제출하고 후보를 사용자 사용 가능/전체 FN05 완료로 승격하지 않는다.

완료 판정은 계획의 해당 범위/필수 검증과 대조한다. 단위 또는 receipt만으로 실제 사용 가능·전달/이해/실행을 선언하지 않는다. Main이 기록·검수·후속 구현을 주도하며 새 업무 배정/실행 방법 재선택을 기다리지 않는다.
