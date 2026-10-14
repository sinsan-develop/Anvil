# 내부 계획 원본 등록 권한·기능 추가 승인

- 승인자: 신산님. 이 대화의 직접 지시: `**등록 권한과 기능 추가까지 승인**해`.
- 승인 ID: `APPROVAL-20261014-U01-PLANNING-SOURCE-REGISTRATION-001`.
- 승인 대상: `docs/04_test_reports/U-01_PLANNING_SOURCE_REGISTRATION_CONTRACT_PROPOSAL.md`의 권고 A.
- 제안 SHA256: `69F648A29D3E0C32507D2272BB59C0616F5A74BCFF8C58F1F920AB9C9B464716`.
- 기준 branch/HEAD: `codex/u01-dashboard-r2` / `5578ba27945ff994f4c363fb2173b5fa75c51da0`.
- 분류: `HUMAN_APPROVED_SCOPED_PLANNING_SOURCE_REGISTRATION`.

현재 개발 조합 `anvil-wsl-development / wsl-development`과 별도 검증 Task에 한정하여 내부 Main이 실제 private Anvil repository mapping과 현재 승인 설계·계획 및 원장/Task 권위 승인 원본의 hash를 결박해 정상 영속 등록하는 최소 기능을 추가한다. 정상 Task 생성과 실제 typed 계획 확정→요청 원장/감사→인가된 GET/화면1건 확인까지 진행한다. 기존 Task1/Run1은 보존한다.

설계 원문 SHA256 `2171EC811E3F25D672E00E470E1EA6D4A78A9FFBA13540B561CC38B0CAEE9BC7`, 작업계획 원문 `19B7AC91EF17D14AA65BE2BDB871F1B6503565C67ACCEDC558972634A42ACBF4`, 기존 `APPROVAL-20261014-U01-APPROVAL-REQUEST-LEDGER-001`/`APPROVAL-20261014-U01-TASK-PLANNING-AUTHORITY-001`를 원본으로 인정하는 제한된 등록 승인이다. 새 typed artifact의 canonical hash와 원 문서 hash를 혼동하지 않는다. 등록 참조를 제품 사람 승인 결정으로 위장하거나 approval_records/authenticated_human을 생성하지 않는다.

세부 adapter·호스트 연결·시간 제한/회수·감사·멱등·원자성·위조 거부는 Main이 WI에 고정한다. reader 권한·공개 POST/메뉴·새 외부 로그인/Secret/certificate·사람 승인/반려·Run 생성/실행/재개·Oracle/Production/예약/PR/main/새 branch/history rewrite는 제외한다. 기존 정상 기능과 승인 원본을 보존하며 구현·검증 완료나 전체 U-01 인수를 뜻하지 않는다.
