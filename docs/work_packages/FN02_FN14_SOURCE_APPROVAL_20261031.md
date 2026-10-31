# FN02 r2·FN14 준비 기록/상한 A — 직접 승인 binding

2026-10-31 신산님 최신 직접 지시: “FN02 r2 A안과 FN14 준비 기록·상한 A안 둘 다 승인해. 실제 DB·권한·키·파일 조사·서비스·Agent 실행과 기존 프로젝트 차단 해제는 제외하고, 기존 subagent에게 구현을 맡겨. 너는 검수·통합하면서 작업계획서 완료까지 계속 진행해.”

상태 DIRECT_HUMAN_APPROVED / source-only. goal은 신산님이 ACTIVE로 재개했다. 이전 BLOCKED·미채택 질문은 이력이다. 원 후보문서의 NOT_ADOPTED 문구를 소급 삭제하지 않고 이 binding을 현재 채택 근거로 사용한다.

- FN02 채택: docs/work_packages/FN02_REVIEW_OVERFLOW_READ_DECISION_20261031.md r2 SHA256 8B6742A94ABB4433AF6A2B220EF823097AA7EAEFEB84B27E516A152D3BCF99F7. 기존fullGET·mutation201guard 보존/별도readonly overview·이력page GET2/명시UI·합성검증이다. 신규DDL/실제SQL0.
- FN14 채택: docs/work_packages/FN14_PREPARATION_STORAGE_LIMIT_DECISION_20261031.md SHA256 C842350B21242E6817FF1BA7BF709A286B8B33A936D368B212F98E63073DB0AD와 이 안이 결합한 docs/contracts/FN14_TRANSFER_PREPARATION_RECORD_PROPOSAL.md SHA256 E096C897761A71D980F19B98E7BB47623DF8933C4F456BD1592621751DB1EB9D. 새준비기록/버전2표·별도원문읽기·10000건/1GiB논리상한·429/전체rollback·합성검증의source/미적용SQL이다. 원후보의source verifier 부재는fail-closed·실제이전/재개/제어전환0. 화면은FN14 A안범위에포함하지않는다.
- 두 업무 모두 실제DB·권한/정책부여·키/Secret·현재사용자파일조사·서비스·Agent실행·기존project차단해제0. 허가된SQL파일/SELECT adapter를작성하는것과실제SQL실행을구분한다. 기존프로젝트소스·보호자료/dirty·복구본·main보존.
- 기존 Primary 단일 code writer에게 FN02→FN14 순서로 위임한다. Main은 같은code수정0·관리/검수/통합. 기존 Reviewer는read-only. 새agent/chat/branch/worktree·예약/자동화0, 반복질문0. 단계가끝나도전체WORK_PLAN완료라고보고하지않는다.
- 시작 기준 codex/av3-stage-b / cea1c1ff969581ad851e289c4dc11852bf769281. WI/결과/WORK_STATUS/WORK_PLAN은Main소유다. FN02 준비WI D60C4F3ABC8C8D253106AABFBB44ED76CD88517B9D712BEBB63BCF19FAC0E712는이binding에따라MainGO상태만갱신해같은7경로로발행한다. FN14는기존실제caller/새SQL번호를읽기확인한별도정확WI뒤구현한다.
