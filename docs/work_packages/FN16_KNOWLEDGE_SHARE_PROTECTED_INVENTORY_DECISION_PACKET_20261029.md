# FN16 지식 공유요청 보호 수집 결정안 — 2026-10-29

상태: CANDIDATE / NOT_ADOPTED. 계약 결정 요청이며 코드·실행 승인이 아니다. 기준 codex/av3-stage-b d771c371659d47933a33bd1fde56fa3c8b2d7269. 기존 FN16 source·합성 승인과 실제 DB·키·서비스 제외는 유지한다.

## 확인된 충돌
Main b76c55, Primary22eca7/7514e9 및 독립 읽기 대조에서 FN05 공유요청 계약 §5, 0051 pending의 FORCE RLS, project-knowledge-share-requests.ts가 모두 created_by=현재 actor만 허용함을 확인했다. 같은 프로젝트의 다른 OWNER 요청도 조회할 수 없다. 현재 대상·원문 검증 실패 시 requestRef/state RECORDED_ONLY/currentCheck UNAVAILABLE/reasonCode SOURCE_OR_TARGET_UNAVAILABLE/기존 false4개만 반환한다. snapshot·지식ref·대상·목적·건수·정책·시각을 부가하면 안 된다.

기존 #projected는 lockShareProjects와 checkShareKnowledge(...,true)를 통해 FOR UPDATE와 원문 검증을 호출한다. 따라서 read-only RR/파일 IO 0의 기존 FN16 collector에 그대로 호출할 수 없다. FN16 원본 보존이라는 개요만으로 이 구체 보호 계약이나 타인 조회/RLS를 완화할 수 없다. 0051은 미적용 후보이며 실제 DB 존재/작동을 확인한 것도 아니다.

## 결정 요청과 권장안
권장 B: 별도 보호 수집 계약을 상세화하고, 본인이 현재 읽을 수 있는 요청만 원형·원hash·증빙 보존 대상으로 정의한다. 조회 불가한 행은 기존 최소 봉투만 보존한다. 타인 요청/접근 상실 원형은 계속 미수집이다. read-only 현재성 검사·원문 접근 확인 방식과 마지막 재검사·누적한도/기한·취소/불명 실패 처리를 명시한 뒤 source-only 코드/시험을 별도 정확 WI로 수행한다. 실제 대상·원문 조회/파일·DB 실행이나 적용은 이번 결정에 포함하지 않는다.

- A: 최소 봉투 보존만 상세화한다. 원형 보존은 해결되지 않고 전체 KNOWLEDGE_SHARE_REQUESTS 미수집 표시는 유지한다.
- B(권장): 위 보호 계약과 source-only 후속 구현을 채택한다. 현재 조회 권한을 넓히지 않고 기존 불가 자료를 숨긴다. RO 방식이 성립하지 않으면 구현으로 우회하지 않고 미검증 경계를 다시 보고한다.
- C: 타인·현재 조회 불가 원형까지 백업하는 별도 권한을 도입한다. RLS·보호자료 노출 범위 변경이므로 이번 범위에서 제외한다.

## 승인의 정확한 효과
B를 선택하면 보호 수집 계약·단독 Primary 구현·합성 반례 및 직접 검수까지 허용하는 source-only 범위다. 새 공개 route/API·SQL 적용·정책/실제 사용자 권한·인증/Secret/키·서비스·Agent·실제 공유/전송·대상 쓰기/원형 조회 실행은 제외한다. 코드만으로 수집 가능/전체 백업 완료를 주장하지 않는다. 상세 WI의 허용 경로·보안 반례를 먼저 독립 검토하며 Main은 동일 코드 writer가 되지 않는다.

## 결정 전 상태
지금은 조사만 했고 제품 코드·시험·0051·권한은 변경하지 않았다. KNOWLEDGE_SHARE_REQUESTS 미수집, 기존22조합/보호조회/false 선언 그대로다. 결정은 PMO에 요청하며 다른 승인된 독립 작업을 차단하지 않는다. 기존 수동 정책 후보158E10BC와 별개 결정이며 그 질문을 재요청하지 않는다.
