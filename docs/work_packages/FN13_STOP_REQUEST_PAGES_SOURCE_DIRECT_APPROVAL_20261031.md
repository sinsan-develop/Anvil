# FN13 과거 중지 요청 페이지 조회 A — 직접승인

상태 DIRECT_HUMAN_APPROVED / 2026-10-31. 대상 docs/work_packages/FN13_STOP_REQUEST_PAGES_DECISION_20261031.md SHA256 B1ACDCD495DC7F1F582A49620E3456A06540729A218DA57657522219A4DE6FBC의 A안이다. 후보의 이전 NOT_ADOPTED와 결정대기는 이력이며 이번 직접승인으로 해소됐다.

신산님 지시 원문:
> FN13 과거 중지 요청 페이지 조회 A안 승인해. 코드·화면·합성 검증을 기존 subagent에게 맡겨. 실제 DB·권한·키·파일 조사·서비스·Agent 실행과 기존 프로젝트 차단 해제는 제외하고, 너는 검수·통합하면서 작업계획서 완료까지 계속 진행해.

기존GET/DTO 보존·새 읽기GET/고정20·서명cursor 최대30분∩당시세션기한·현재보호/상한/proof·과거왕복·동일실패cursor재시도만 source/UI·합성으로 구현한다. 새 SQL/table/쓰기operation·실제중지/회수·공개배포·실환경 변경은 없다. Main이 정확 경로·최종DTO를 같은 의미 안에서 WI로 고정하고 기존Primary 단일writer→독립검수→Main fresh 검증·통합으로 진행한다. 전체계획 완료 책임과 나머지 미완료 추진은 유지하며 실제 기능/인수 완료와 source 검수를 구분한다.
