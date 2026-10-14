# 실제 승인 요청 원장 A안 승인

- 승인 ID: `APPROVAL-20261014-U01-APPROVAL-REQUEST-LEDGER-001`
- 승인자: 신산님
- 승인 근거: 이 대화에서 최소 요청 원장 A안의 구현 여부를 묻는 직전 질문에 대한 직접 답변 `승인`.
- 변경 분류: `HUMAN_APPROVED_SEMANTIC_FUNCTION_AND_DATA_CONTRACT_CHANGE`
- 기준 branch/HEAD: `codex/u01-dashboard-r2` / `3ee62694ab6508265dba5b79247909c32117d530`
- 승인 대상: `docs/04_test_reports/U-01_APPROVAL_REQUEST_LEDGER_CONTRACT_PROPOSAL.md`
- 승인 대상 SHA256: `9BAF4FAEB4454EDC2ED1151C30F614ABAEB55E3AE5F10C34533B4FB1DC7A0010`

## 허용 범위

A안의 최소 backend 선행 절편을 U-01 범위에 추가한다. Task 귀속·Run 선택 참조의 EXECUTION_PLAN 요청 원장과 append-only 감사, 검증된 실제 계획 확정 경계의 영속 생성, 1시간 만료 및 정확 Project·Environment의 인가된 Dashboard 조회·화면 연결을 로컬/WSL에서 구현한다. 새 원장 schema/migration·지속 저장·기존 scoped 응답 확장을 포함한다. 실제 사람 승인 결정 원장이나 Run 실행 권한을 요청 원장으로 대체하지 않는다.

실행 전 WI에서 기존 신뢰된 Task 계획 작성 권위의 공급원과 실제 producer를 고정한다. 기존 권위로 검증할 수 없어 새 permission/principal/Secret가 필요한 경우 이 승인으로 자동 생성·부여하지 않고 정확 대상을 별도 결정받는다. 새 유효 dual lease의 단일 Primary가 구현하고 Main은 같은 코드 경로에 동시 쓰기하지 않는다.

## 제외·안전 경계

- 사람 승인·반려 UI/결정 쓰기, 자동 실행·재개, U-02 메뉴 전체, 새 공개 POST는 제외한다.
- 신규 principal/permission/Secret/certificate의 자동 생성·권한 부여는 승인하지 않는다.
- 404 무조건 허용, timeout 연장, body/Secret/off-origin 감사 생략, F19A 임의 활성화는 승인하지 않는다.
- 예약, 다른 프로젝트, Oracle/ysna/Production, 외부 비용, PR/main 병합, 새 branch, force push/history rewrite는 제외한다.
- 격리 PG15 migration 검증 후 정식 WSL 적용 전에 현재 DB/image/migration·암호화 backup/복원 수단을 확인한다. 생성 자원은 먼저 등록하고 정확히 정리한다.
- rollback 때 요청/감사 이력을 보존한다. 데이터 삭제·파괴적 downgrade는 별도 승인 대상이다.

## 증거와 상태

이 파일은 사람의 범위 승인 기록이며 제품 구현·검증·배포 완료 증거가 아니다. 원 제안의 PROPOSED 문구는 승인 전 이력을 보존하기 위해 바꾸지 않는다. 현재 기능 상태는 미구현이며 기존 U-01 NOT_ACCEPTED/Release DEFER 및 역사 실패는 유지한다.
