# IX02 START 맥락 전달 영수증과 최초 이해 검토

기준 소스 `d9500fba7a83c500f9c7bbcbef3f62bdb5a775b8`. 범위는 [IX02 작업 카드](INTEGRATION_WORK.md#ix02-화면실제-agent파일-변경시험-결과)의 최초 이해 대조와 후속 WORK 준비다.

## 재현 조건

- 실제 HTTP 핸들러는 같은 START 맥락 부분을 새 유효 challenge로 다시 요청할 때 별도 영수증을 저장한다. 같은 challenge와 같은 요청의 재확인은 기존 영수증을 반환한다. 저장된 영수증은 유효 challenge, 원 START 명령·봉투 해시, 자료 목록과 부분의 전체 참조, 본문 해시를 검산한다. 공개키와 인증 자료는 합성 시험에서만 공급한다. [전달 코드](../../apps/server/modules/executions/normal-start-materials.ts#L129), [영수증의 challenge별 유일성](../../db/migrations/0018_execution_observation.sql#L8), [보호 부분 결박](../../db/migrations/0062_execution_material_registration.sql.pending#L22)
- 최초 SEND로 얻은 응답을 사람이 선택한 뒤, 이해 검토는 각 필수 맥락 부분의 서버 전달 영수증 후보가 정확히 한 건이어야 한다. 같은 부분에 두 정상 영수증이 있으면 여섯 기준 검토 전에 `NORMAL_UNDERSTANDING_REVIEW_DELIVERY_INCOMPLETE` 경로로 간다. 이미 정착한 적합 판단 뒤 두 번째 정상 영수증이 생겨도, 별도 WORK 준비가 같은 원 맥락 검산을 다시 호출하므로 거절된다. 이 판정은 소스 대조 결과다. [최초 이해 검산](../../db/migrations/0102_normal_understanding_responses.sql.pending#L2209), [WORK 준비 검산](../../db/migrations/0103_work_preparation_understanding_basis.sql.pending#L83)
- [합성 HTTP 재현](../../tests/unit/FN08/normal-start-materials-journey.test.ts#L120)은 같은 고정 부분의 두 요청에서 정상 응답과 같은 원문을 대조하고 서로 다른 challenge·영수증, 정확한 원 START·목록·부분 귀속과 기존 영수증 재확인을 검산한다. 최초 SEND, 여섯 기준 검토, WORK 준비의 PostgreSQL 함수와 실제 Agent는 이 시험에서 실행하지 않는다.

## 원 실행기가 사용한 자료 결박

실행기에는 각 `MATERIAL` 행이 순번·원 START 키와 봉투 해시·descriptor 해시·부분 ID와 본문 해시·서버 `proofResultRef`·직전 행을 보존한다. `RECEIVED`까지 같은 체인을 검산하고, 반환한 `receivedRef`를 START 준비의 로컬 원장이 보존한다. 현재 확인된 서버 저장 경로에서, 이 로컬 원장이 사용한 부분별 영수증을 원 START와 함께 가리키는 불변 포인터는 찾지 못했다. 서버의 개별 전달 영수증은 보호 바이트 응답의 정착을 증명한다. 그중 어느 응답을 실행기가 받아 준비에 사용했는지는 로컬 원장을 원본으로 대조해야 한다. [부분별 로컬 기록](../../apps/connector/runtime/normal-start-intake.ts#L142), [START 준비 기록](../../apps/connector/runtime/normal-start-coordinator.ts#L116)

| 방안 | 판단 |
| --- | --- |
| 현행 유지 또는 새 challenge의 동일 부분 재조회 금지 | 현행은 이미 정착한 두 정상 영수증 때문에 검토를 막는다. 장래 재조회 금지는 기존 요청 의미를 바꾸며 원 실행기가 사용한 영수증을 알려 주지 못한다. |
| 최초·최신·임의 유효 영수증 선택 | 서버 소비 순서가 로컬 원장 사용을 입증하지 못한다. 무작위 대체나 새 요청 뒤 선택 변경은 검토·WORK의 원 근거를 바꿀 수 있다. |
| 원 실행기의 부분별 정착 자료에 결박 | 동일 START의 원 권위와 고정 descriptor에서 부분 순서별 `MATERIAL` 전체 참조, 서버 `proofResultRef`, 원 `receivedRef`를 함께 검산한다. 이는 어느 부분이 원장에 정착했는지 결박한다. 실제 Agent 이해 판정은 기존 사람 검토가 담당한다. |

세 번째 방안의 기존 보호 수송·저장 재사용 여부와 필요한 지속 또는 전송 계약은 미확정이다. 기존 원본과 이미 고정된 이해 검토 영수증은 보존한다. 원 실행기 결박이 없는 기존 자료의 현재 재사용, 중복·누락·교차 요청, 응답 불명은 별도 검산에서 닫고 임의 영수증으로 채우지 않는다. 이 기록은 시험과 기술 근거만 추가한다. 제품 코드, 미적용 SQL, API와 권한에는 변경이 없다.