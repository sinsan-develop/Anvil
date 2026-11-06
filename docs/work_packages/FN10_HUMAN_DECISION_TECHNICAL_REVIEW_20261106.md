# FN10 사람 판단 기록의 기술 검토와 결정 지점
- 일자: 2026-11-06
- 상태: 기술 검토·설계 선택 지원 / 제품 SOURCE_GO0 / 실제 실행0
- 기준 HEAD: 133d16c17a49cd0453cf91144755a4002bee34a8
- 후보: docs/contracts/FN10_HUMAN_DECISION_CANDIDATE.md
- 후보 SHA256: 4DC5269C1D3A77073AF07DD19E15B736A6D60638C58DDFEBB70173530668807B
- 범위: 사람 결정 저장·정정·철회·보호 조회. 평가·분기·node 완료·queue 전이·dispatch 제외.

## 1. 실제로 빠진 사용자 동작
현재 방법론은 HUMAN/DECISION과 USER_DECISION 조건을 정의할 수 있지만 사람이 정확한 기준 문서를 보고 값을 선택하고 이유·근거를 저장한 뒤 정정/철회 이력을 조회하는 경로는 미연결이다. stage-queue의 WAITING/CANCELLED 저장이나 순수 조건 계산을 이 기능 완료로 세지 않는다.

기존 제한 AST/노드 역할 검사는 validateMethodologyGraph를 재사용한다. 별도 허용값 추출/봉인 parser는 확인되지 않았다. 신규 저장을 항상412로 만들거나 가짜 현재 기준으로 정상 시험을 만드는 방식은 이 기능 구현이 아니다.

## 2. 먼저 필요한 설계 선택
기존 후보의 basisRef는 현재 확정 설계·작업계획 묶음이라고 적혀 있지만 그 묶음의 발급·선택 의미가 정해지지 않았다.

| 선택 | 동작 | 영향 |
|---|---|---|
| 확정 문서 묶음 별도 선택 — 권장 | 사람이 확정된 설계/계획의 정확 버전을 명시 선택해 판단 기준에 고정 | Agent 실제 실행 전에 판단을 기록할 수 있다. 묶음 발급·현재 선택·불변 이력/계상과 잠금 의미를 추가로 상세화해야 한다. 실행 활성화는 바꾸지 않는다. |
| 활성화된 실행 기준만 사용 | 기존 활성화 pointer의 정확 설계/계획을 기준으로 사용 | 별도 묶음 의미는 줄지만 실제 활성화 생산의 안전 선행이 미연결인 동안 판단 저장도 사용할 수 없다. |

Main은 위 선택을 사용자에게 비동기 질문했으며 답변 전 어느 쪽도 채택하지 않는다. 권장안에서도 확정 문서 선택이 실행 권한·자동 완료·분기 진행을 만들지 않는다. 선택 이후 별도 묶음의 정확 refs/hash/발급/수명·정정/제외·계상·조회와 잠금 계약을 검토해야 하므로 방향 답변을 실제 DB 실행 승인으로 확대하지 않는다.

## 3. 재사용할 실제 경로와 빈 연결
| 원 경로 | 재사용 가능 사실 | 추가로 필요한 연결 |
|---|---|---|
| traceability/baseline-activations.ts current | OWNER 검사와 단일 SQL 관측의 활성화·설계·계획 ref | 별도 확정 묶음 producer가 아니다. 활성화 생산은 실제 안전 선행 미연결로 차단된다. |
| traceability/work-plans.ts | 설계/계획 원문 현재 head·확정 버전·최신 검토·계획 확인 원장 | FN10 Tx의 선택/잠금/최종 재검산을 대신하지 않는다. |
| traceability/design-activation-stored-relations.ts | 설계와 계획의 정확 ref 관계 | 동시성/현재 pointer 검증으로 승격하지 않는다. |
| documents/project-documents.ts version 및 documents/project-content-review.ts documentReviews | 회원·불변 버전 hash·UTF-8·artifact 귀속/격리·검토/확정 조회 | 미확정/부적합 원문도 조회 사실로 반환하므로 FN10이 확정·최신 적합·접근을 명시 판정해야 한다. |
| ProjectMethodologies.readApplication | 원 적용 fullref/hash | 현재 적용 선택과 새 결정의 같은 Tx 결박 필요. |
| project-command의 controller/authorize/replay/receipt | 기존 명령·제어·정책·영수증/감사 절차 | receipt 저장만으로 source 전체 현재 접근을 검사하지 않는다. 신규 응답/replay/GET 각각 보호 후 직렬화해야 한다. |
| ProjectListCodec·Web UNKNOWN buffer | 기존 signed cursor와 원명령 보존 | 새 node 결정의 정확 조건/cursor·주체/선택 전환 결박 필요. |

출처 접근/격리·검토 개정·기준 전환이 일어나는 실제 생산 경로와 공유하는 잠금/세대 표가 먼저 필요하다. COMMIT 이후 응답 전 보호 변경에서도 과거 성공 원문을 노출하지 않으면서 원 영수증을 보존해야 한다. 현재 read 함수를 호출한 사실만으로 이 경합을 해결했다고 주장하지 않는다.

## 4. 구현 파일 후보 — 아직 허용목록 아님
신규 후보:
- apps/server/modules/scheduling/node-decision-input.ts
- apps/server/modules/scheduling/node-decision-sources.ts
- apps/server/modules/scheduling/node-decision-store.ts
- apps/server/modules/scheduling/project-node-decisions.ts
- db/migrations/0080_node_decisions.sql.pending
- apps/web/src/features/session-detail/node-decision-api.ts
- apps/web/src/features/session-detail/NodeDecisionPanel.tsx

연결 변경 후보:
- apps/server/modules/access/project-command.ts
- apps/server/modules/control-handoff/control-grant.ts
- apps/server/modules/projects/routes.ts
- apps/server/modules/projects/project-storage-quota.ts
- apps/web/src/App.tsx
- apps/web/src/features/session-detail/SessionDetailPage.tsx
- apps/web/src/features/connections/policy-editor-profile.ts와 직접 시험

0079가 조사 당시 최신 migration 번호다. 번호는 구현 착수 때 재검산한다. 공유 잠금 참여 producer는 최종 패킷에서 확정한다. 위 목록만으로 코드 쓰기를 시작하지 않는다.

## 5. 구현·인수 순서
1. 기준 묶음의 의미를 결정하고 원 발급·현재 선택·잠금/응답 보호·계상 표를 닫는다.
2. 기존 후보와 정확 delta/허용목록·정상/중요 음성을 독립 검토한다.
3. 허용된 경우 기존 Primary가 선언 검사→원 보호 source→저장/미적용 forward SQL→same-origin 화면을 순차 구현한다.
4. Main은 실제 저장·재조회·정정·철회 양성 및 권한/격리/버전/경합/UNKNOWN 반례를 합성 범위에서 검수한다.
5. 실제 DB/권한/키/서비스/Agent 실행은 계속 제외하고 미검증을 표시한다.

정상 기준/출처 producer가 없으면 그 빈 연결을 상세화해야 하며 source-only 통과만으로 전체 FN10·Stage·작업계획을 완료 처리하지 않는다. 이 문서는 검토 사실과 제안이며 새 공개·저장·권한 계약의 채택 기록이 아니다.
