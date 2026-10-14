# Task별 내부 Main 요청 생성 권위 추가 승인

- 승인 ID: `APPROVAL-20261014-U01-TASK-PLANNING-AUTHORITY-001`
- 승인자: 신산님. 직접 응답: `승인`.
- 승인 대상 질문: 조회 계정과 분리된 내부 Main에 해당 Task의 승인 요청 생성 권한만 추가하는 범위. 사람 승인·반려·자동 실행은 계속 제외한다.
- 부모 승인: `APPROVAL-20261014-U01-APPROVAL-REQUEST-LEDGER-001` 및 해당 승인 대상 제안 SHA256 `9BAF4FAEB4454EDC2ED1151C30F614ABAEB55E3AE5F10C34533B4FB1DC7A0010`.
- 분류: `HUMAN_APPROVED_TASK_SCOPED_INTERNAL_REQUEST_AUTHORITY`.
- 기준 branch/HEAD: `codex/u01-dashboard-r2` / `3ee62694ab6508265dba5b79247909c32117d530`.

## 추가 허용과 제한

Task별 계획 작성 위임을 영속 저장하고, 실제 계획 확정→요청 원장 생성 전에 같은 트랜잭션에서 내부 Main 주체·정확 Task/Project/Environment·plan/WI/mode hash·유효기간·회수·fencing을 검증하는 최소 내부 권한 계약을 추가한다. 이 권위는 요청 생성에만 쓰며 사람 승인이나 Run 실행 권위가 아니다.

구체적인 내부 이름·저장 구조·파일 배치와 검증 순서는 승인 범위 안의 Main 기술 결정으로 WI에 고정한다. 기존 Dashboard reader의 계정·권한·Secret은 변경하지 않는다. 신규 외부 로그인/공개 생성 POST, SSH/PAT/API key/인증서, 사람 승인·반려, 자동 실행·재개, 전체 U-02 메뉴와 외부 비용은 제외한다. 내부 Main의 권위를 다른 Task/조합으로 자동 전파하지 않는다.

본 승인은 A안의 신규 권위 자동 부여 제외 중 **정확 Task에 제한된 별도 내부 Main 요청 생성 권위**만 해소한다. 나머지 제외·로컬→private Git→WSL exact SHA·backup/복구·단일 writer·원본 보존·미검증 구분은 유지한다. 설계서나 원 제안의 역사 내용을 재작성하지 않는다. 구현·검증 완료를 뜻하지 않는다.
