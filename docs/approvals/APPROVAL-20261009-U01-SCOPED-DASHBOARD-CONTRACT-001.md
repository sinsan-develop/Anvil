# U-01 정확 조합·기간 Dashboard 공개 조회 계약 승인

- 승인자: 신산님
- 승인일: 2026-10-09 (Asia/Seoul)
- 승인 기록: 현재 Anvil 담당 Codex 대화에서 권고 B 계약안에 대한 질문 직후 신산님이 `승인`이라고 직접 답함
- 제안 원문: `docs/04_test_reports/U-01_SCOPED_DASHBOARD_CONTRACT_PROPOSAL.md`
- 제안 SHA-256: `5B13E92A16A903F2887BA5F3E038AA5A41BBBBA667EE0DED57FF9C39E7BCA584`
- 시작 기준 branch/HEAD: `codex/u01-dashboard-r2` / `72836ca629ac76d0c6276f9055f7e77aa5a1668a`

## 승인 범위

제안의 권고 B에 명시된 새 읽기 전용 정확 Project·Environment pair Dashboard GET 경로·입출력, `Asia/Seoul` 1/7/30 달력일 계약, 요청별 정확 pair `dashboard:read` 인가, 기존 완전 원본만 사용하는 현재/발생 분리 projection, same-origin 화면 필터와 로컬·WSL-server 검증을 U-01 범위로 승인한다. 기존 F-19A 등록·권한 원장과 업무 원본은 읽기만 한다.

## 제외·불변

- 기존 `GET /api/dashboard/project-environments`, `GET /api/dashboard/operations`, Critical ACK의 경로·인가·응답 의미를 변경하지 않는다.
- 신규 DB schema·migration·지속 데이터 쓰기, 기존 감사 Event 재작성·삭제, Secret·certificate 변경은 승인 범위 밖이다.
- Production/`ysna-server` 배포·실측, Provider 실제 비용 발생과 공개 운영 전환은 승인하지 않았다.
- 단일 기존 작업 branch가 U-01 검증·병합·정리되기 전 신규 작업 branch를 만들지 않는다.

## 검증·복구

제안 문서의 로컬 TDD·API/OpenAPI·Web 회귀와 정확 Git SHA의 WSL-server PG15/OIDC/HTTPS/Chromium/Network 실측, 독립 Tester `AV-SAFE-034`·`AV-OPS-027`·`AV-UI-017` 판정을 완료하기 전 U-01 수락 또는 PR 병합을 선언하지 않는다. 기존 GET/ACK 회귀나 원본 완전성 실패 시 동일 branch에서 수정한다. 새 route·UI는 revert 가능하되 등록 원장·감사 Event는 보존한다.

이 기록은 신산님의 명시적 계약 승인을 정확히 결박한 것이며, 후속 WorkInstruction·dual lease·필수 검증의 완료를 대신하지 않는다.
