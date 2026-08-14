# 공통 모듈·API 우선 및 메뉴 순차 개발 계획 재편 설계

## 1. 결정

신산님의 2026-08-14 지시에 따라 Anvil의 남은 개발 순서를 다음과 같이 변경한다.

1. 공통 모듈을 먼저 완성한다.
2. 공통 API·same-origin BFF·보안 계약을 완성한다.
3. 공통 화면 프레임을 완성한다.
4. 화면 메뉴를 정해진 순서로 하나씩 완성한다.

완료된 G, A, B-01~B-04의 Package ID, 상태, 승인, evidence, hash와 Git 이력은 변경하지 않는다. 재편 대상은 B-05 이후의 미착수 작업이다.

## 2. 목적

기존 계획은 domain, API, Agent, 학습, 화면과 운영 기능이 여러 Phase에 분산되어 있어 운영자가 실제 화면을 확인하기까지 시간이 길고, 공통 계약이 확정되기 전에 메뉴별 구현이 시작될 가능성이 있다. 새 순서는 공통 기반을 먼저 고정하고, 이후 각 메뉴를 backend·API·UI·브라우저 증거까지 하나의 수직 단위로 닫는다.

## 3. 보존 경계

- `Anvil_설계서_v2.md`의 제품 범위, P1~P21, D1~D10, 상태 불변식과 운영 원칙은 변경하지 않는다.
- 기존 검증 ID와 심각도는 삭제하거나 낮추지 않는다.
- 기존 완료 Package를 재개방하거나 재번호화하지 않는다.
- API·DB·LLM·Agent·Provider·배포의 실제 PASS는 각각 실제 evidence가 있을 때만 선언한다.
- 브라우저는 same-origin 상대 경로만 사용한다.
- 다음 메뉴는 현재 메뉴가 독립 Tester `ACCEPTED`가 되기 전에는 시작하지 않는다.
- 공통 모듈이나 API에 메뉴 전용 예외를 넣지 않는다. 메뉴 전용 기능은 해당 메뉴 수직 Package가 소유한다.

## 4. 새 canonical 실행 단계

### 4.1 Foundation 1 — 공통 모듈

모든 메뉴가 공유하는 다음 계약을 먼저 완성한다.

- ID, enum, Event, reducer, 상태 전이
- PostgreSQL repository, migration, transaction, outbox
- Artifact, EvidenceManifest, checkpoint, progress/HANDOFF
- Task, Run, Step, Delegation, Result, approval, intervention, defect, release
- queue, worker/write lease, fencing, budget, cancel, recovery
- framework-neutral service port와 오류 vocabulary

완료조건은 공통 모듈이 웹 framework나 특정 메뉴를 import하지 않고 단위·통합·PostgreSQL 15/18 검증을 통과하는 것이다.

### 4.2 Foundation 2 — 공통 API/BFF

공통 모듈 위에 다음 API 계약을 고정한다.

- canonical API registry와 OpenAPI contract
- 인증·역할·권한·CSRF·Origin·Host·CORS·proxy trust
- same-origin BFF와 서버 전용 내부 주소
- SSE 재연결, `Last-Event-ID`, 409 conflict와 표준 오류 envelope
- pagination, filtering, idempotency, request ID와 audit receipt
- loading, empty, error, blocked, quota, cancel, reconnect 상태의 API 표현

API foundation Gate 전에는 메뉴 화면이 fixture를 넘어 실제 write API에 연결되지 않는다.

### 4.3 Foundation 3 — 공통 화면 프레임

11개 메뉴가 공유하는 shell만 구현한다.

- 1920×1080, 기본 12px 화면 표준
- sidebar, header, project switcher, global search, notification, 어울 drawer
- route, permission guard, error boundary, loading/empty/blocked 상태
- same-origin API client와 Network evidence 수집 경계
- 공통 table, filter, form, confirmation, approval, timeline, evidence viewer

이 단계에서는 메뉴별 업무 기능을 구현하지 않는다.

## 5. 메뉴 개발 순서

메뉴는 아래 순서를 canonical로 고정한다.

| 순서 | 메뉴 | 수직 완료 범위 |
|---:|---|---|
| 1 | Dashboard | 전체 상태, 경고, 승인 대기, 다음 행동의 실제 read model·API·화면 |
| 2 | Workbench | 어울 대화, 작업 지시, 진행, 결과 보고, 승인, 기록 |
| 3 | Projects | 프로젝트 등록, repository onboarding, baseline·정책·보호 경로 |
| 4 | Runs | Run·Step·Delegation·attempt·중단·재개·취소 |
| 5 | Reviews | 기술 검토, ProductValidation, DefectAssessment, 사람 ReleaseDecision |
| 6 | Quality | Gate, 테스트, EvidenceManifest, diff, 적대적·회귀 검증 |
| 7 | Knowledge | source, memory, pattern, provenance, revocation, snapshot |
| 8 | Agents & Automation | Main/Developer/Reviewer/Tester, Skill, Hook, DAG, takeover |
| 9 | Environments | Local·WSL·ysna, DB, secret·egress, deployment target |
| 10 | Operations | queue, worker, alert, budget, audit, health, deployment monitoring |
| 11 | Settings | Provider, model, routing, credential 상태, 실행 모드, 정책 |

각 메뉴 Package는 해당 메뉴의 domain/service 보완, API/BFF, 화면, 접근성, 보안, 실제 클릭, Network, 오류·빈 상태, 회귀, evidence와 rollback까지 포함한다. 메뉴 화면만 만들고 backend나 API를 다음 Package로 미루지 않는다.

## 6. 기존 Package 처리

- B-05 이후 기존 Package ID는 추적 alias로 보존한다.
- 기존 Package의 요구사항은 `공통 모듈`, `공통 API`, `공통 화면`, 또는 11개 메뉴 중 하나로 전량 배치한다.
- 요구사항을 중복 구현하지 않는다. 여러 메뉴가 사용하는 기능은 Foundation이 소유하고 메뉴는 공개 interface만 소비한다.
- 기존 Phase Gate와 DIR 강제 중단점은 유지하되, Gate의 선행조건은 새 실행 단계에 맞게 다시 연결한다.
- 기존 Package 수와 추적표가 바뀌는 경우 이전 수치는 historical로 남기고 새 canonical 수치를 명시한다.

## 7. 메뉴별 완료 계약

각 메뉴는 다음 순서로 완료한다.

1. 요구사항·필드·권한·상태 계약 확정
2. 메뉴 전용 domain/service TDD
3. API/OpenAPI/BFF TDD
4. 화면과 접근성 TDD
5. 운영 유사 Docker에서 실제 클릭·API·DB·Network 검증
6. 오류·권한·빈 상태·중단·재개 검증
7. 기존 메뉴와 공통 모듈 회귀
8. 독립 Tester 판정과 Main Agent acceptance

다음 메뉴는 8단계가 끝난 후에만 시작한다.

## 8. 작업계획서 변경 범위

`Anvil_작업계획서_v1.md`의 다음 내용을 개정한다.

- 문서 버전과 의미 변경 기록
- 전체 개발 원칙과 canonical 실행 순서
- B-05 이후 Package 배치와 선행관계
- Phase·Gate·DIR 관계
- 11개 메뉴 순차 Package와 메뉴별 완료조건
- 요구사항 추적표와 총 Package 수

설계 요구사항이나 검증 기준을 바꾸는 것이 아니라 실행 순서와 Package 소유권을 바꾸는 개정이다. 통합검증매트릭스·테스트계획서의 Package 참조가 달라지는 부분은 후속 계획에서 함께 정합화한다.

## 9. 성공 기준

- 완료된 G·A·B-01~B-04의 기록이 byte-level로 변경되지 않는다.
- B-05 이후 모든 기존 요구사항이 새 단계 또는 메뉴에 정확히 한 번 배치된다.
- 공통 모듈과 공통 API Gate 전에는 메뉴 실제 기능 개발이 시작되지 않는다.
- 메뉴 순서가 Dashboard부터 Settings까지 문서 전체에서 동일하다.
- 각 메뉴가 독립적으로 실행·검증·rollback 가능한 수직 Package다.
- 작업계획서, 추적표, 선행관계와 Gate 사이에 순환 의존성이 없다.

