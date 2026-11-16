# UI04 답글의 원 발언 명시 조회 · 구현 지시

기준은 codex/av3-normal-sdk-producer의 안전 checkpoint bf324138ecb6e5903b2b64244edfe50aef63d775다. WORK_PLAN UI04/FN09와 기존 FN05 답글 원문 조회 계약·ConversationPanel의 원 발언 읽기 동작을 재사용한다. 같은 Stage C의 승인된 Workbench 원문 조회에서 읽기 전용 사용자가 이전 목록 페이지의 원 발언을 직접 열지 못하는 누락을 보완한다. 새 공개 API·저장형상·권한·DB·키·서비스·Agent 실행은 추가하지 않는다. 기존 SDK 생산자 핵심과 실행구성 후보는 별개이며 완료로 표시하지 않는다.

## 단일 writer와 닫힌 범위

기존 developer_primary만 아래 3개 제품/시험과 결과서1개를 쓴다. Main은 현황·지시서·검수·Git을 맡는다. 다른 담당자의 변경을 되돌리지 않는다.

- apps/web/src/features/workspace/WorkspaceConversationSources.tsx
- apps/web/src/features/workspace/workspace-conversation-reader.ts
- tests/unit/FN09/workspace-conversation-read.test.ts
- docs/04_test_reports/AV3/UI04_REPLY_ORIGINAL_SOURCE_RESULT_20261117.md (신규 결과서)

## 기대 동작

1. 현재 보호 조회가 성공한 원문의 message.replyTo가 있는 경우에만 '답글의 원 발언 열기' 버튼을 표시한다. pending이면 잠그고 자동 조회하지 않는다. 쓰기/제어권 취득 버튼으로 구현하지 않는다.
2. 새 reader 메서드는 인자로 임의 ref를 받지 않고 현재 검산한 source의 고정 replyTo를 복사한다. 현재 선택 conversation과 source.conversationId가 같아야 한다. 기존 readConversationMessage를 same-origin 상대 GET으로 한 번 호출한다. 목록 페이지에 없다는 이유로 유효한 답글 대상을 거절하지 않는다.
3. 응답은 같은 대화·정확한 원 ref/hash·본문 hash와 더 앞선 서버 순번을 만족해야 한다. USER_MESSAGE와 USER_INSTRUCTION 모두 원 발언이 될 수 있다. 정정 지시의 previous와 의미를 혼동하지 않는다.
4. replyTo 없음/다른 대화/잘못된 hash/같거나 뒤 순번/403·401/네트워크 실패는 기존 오류·이전 원문 제거 규칙을 따른다. 401은 기존 인증 소실 콜백만 사용한다. 화면 해제·프로젝트 교체 뒤 늦은 응답은 원문/콜백/추가 GET을 발급하지 않는다.
5. 기존 대화/발언 목록·페이지·일반 원문·정정 전 지시 조회·HTML 이스케이프·읽기 정책은 유지한다. 읽은 원문을 현재 유효 지시·맥락 편입·실제 Agent 전달로 승격하지 않는다.

## 필요한 검증

현재 기존 시험에서 누락을 재현하는 RED 후 최소 변경으로 GREEN을 확인한다. 같은 파일에 목록 밖 원 발언의 GET1, replyTo 없음 GET0, 정확 ref/hash/앞 순번·권한 거절·dispose 뒤 응답 무표시 반례를 추가한다. 현재 화면 버튼의 표시·클릭과 원문 연결도 기존 RAM UI 도구로 확인한다. 추가 경로가 필요하면 이유/정확 경로를 Main에 반환하고 임의 확대하지 않는다. 직접 시험과 인접 기존 원문/정정 조회 시험, 루트 타입, 변경 공백만 수행한다. 실제 DB·서비스·브라우저 운영·Agent 검증은 제외/미검증으로 명시한다. 동일 코드 검사를 불필요하게 반복하지 않는다.

결과서는 변경 파일/diff·최초 RED/최종 정확 명령과 종료·개별 SHA·오류/해결·미검증·rollback을 포함한다. writer는 시험 session과 RAM 자원을 닫아 0을 확인하고 쓰기를 반환한다. Main이 독립 읽기 검수·안전 commit/push를 한다. 새 승인 요청 없이 이 기존 계약 구현을 진행한다.
