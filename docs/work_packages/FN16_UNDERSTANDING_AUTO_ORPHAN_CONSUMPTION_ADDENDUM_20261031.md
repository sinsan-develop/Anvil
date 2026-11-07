# FN16 이해검토 이력 AUTO 고아 소비 검산 — 보완 부록

2026-10-31 / Main 내부 보완 / 부모 WI6D223643EFCD598E846D78AED023C22E0B4386E4E8502EB70F583ABB1F4FD873.
부모의 정상 AUTO/승인 원형·dangling 거절 요구를 함께 만족시키는 독립 Important1 보정이다. 새 기능·공개 계약·권한·SQL·실행을 추가하지 않는다.

## 1. 지적·실제 반례
제출 source678FC89E와 신규시험2DAC9359에 대한 Main34/type/diff 통과는 해당 실행 범위만의 증거였다.
독립 검토는 AUTO의 snapshot/command 승인 metadata가 전부 null인데 해당 command_id를 가리키는 소비행만 있는 경우, approvedCommandIds 선택에서 빠져 검산을 우회함을 확인했다.
Primary91d7fc는 원 AUTO snapshot·command·ar.approval_decision_ref·audit.approval_ref를 그대로 두고 고아 approval_consumptions 행1개만 추가해 collector가 성공하는 RED를 확인했다(Node exit1).
기존 dangling 시험은 command metadata도 바꿨으므로 이 독립 반례를 증명하지 못했다. 이전34를 최종 합격으로 승격하지 않는다.

## 2. 조회·검산 보완
- 기존 review command ID 전체에 한정해 기본 approval_consumptions의 존재/행을 유한 조회한다. 최대200 단위·metadata/기한/선택집합·command별/id별 중복 검산은 유지한다.
- 같은 프로젝트의 실제 연결된 소비가 있을 때만 decision→request→candidate/관련 command/proof 선택을 잇는다. 원 AUTO에 고아 소비가 있으면 실패로 닫고 승인 원형으로 재발급하지 않는다.
- 부모 WI의 '정상 AUTO에서 새 승인표 조회를 강제하지 않음'은 이 필수 소비 존재 검사를 제외한 request/decision/candidate 표를 뜻하도록 정정한다. 정상 AUTO의 새 후보/request/decision 조회0은 유지한다.
- 프로젝트 전체 소비/후보/승인 스캔·별도 actor/client 위장·현재 권한/기한의 과거 재적용·누락 AUTO fallback·기준 완화0.
- START/SEND loop 및 다른 기존 원형/false/NOT_PERFORMED는 그대로다.

## 3. 정확 최종3경로
부모 source1+신규시험1은 유지한다.
1. apps/server/modules/backups/understanding-permit-inventory.ts — Important 제출본 SHA678FC89EC0660F82770C14ADBE65B874A82B9DD1F1F3836E3F048FB2FEB6C1B5
2. tests/unit/FN16/understanding-approval-permit-inventory.test.ts — 새 고아 반례와 조회 선택 검산을 보강한다.
3. tests/unit/FN16/understanding-permit-inventory.test.ts — 시작 SHA9941A4999AE0B2162102BB15C1EC037EDBB3C76F71460AA529DB978E88D54638
3번은 기존 fixture tables에 approval_consumptions:[] 한 항목만 추가한다. 실제 기본 표의 빈 조회를 정확히 모사하며 행 생산/기존 단언·거절·조건/한도는 변경하지 않는다.
알 수 없는 모든 표를 []로 처리하는 fallback은 금지한다. 다른 기존 회귀·schema·SQL·producer·helper·문서/Git은 Primary 범위 밖이다.

## 4. 검증·반환
단독 고아 소비 RED→GREEN, 정상 AUTO의 한정 소비 조회와 다른 새3표0, 실제 승인 원형/기존 회귀·START/SEND block 동일·type/diff를 확인한다.
새 판단/소스 수정이 있으므로 영향 검증을 다시 실행하며, 무관한 이미 완료된 검사·전체 회귀는 반복하지 않는다.
기존 Reviewer 재검토 C/I0 전에는 최종 합격/commit으로 통합하지 않는다. 이전 실패와 보완은 WORK_STATUS·결과에 구분해 보존한다.
같은 Primary 단일 writer, Main 같은 코드쓰기0. 실제 DB/권한/키/파일조사/서비스/Agent·실백업/복원/일반차단 해제·새QA0.
전체 FN16/작업계획은 여전히 미완료다. rollback은 해당 source commit 정상 revert, 실제 자료 삭제0.
