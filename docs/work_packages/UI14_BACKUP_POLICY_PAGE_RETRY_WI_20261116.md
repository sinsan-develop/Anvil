# UI14 수동 백업 정책의 다음 페이지 명시 재조회

## 근거와 책임

- WORK_PLAN UI14/FN16의 채택된 수동 백업 정책 r2 A 목록·고정 조회 화면을 완성한다. 기존 UI14_BACKUP_POLICY_SELECTION_BINDING_WI_20261115와 listBackupPolicies의 cursor 계약을 유지한다.
- branch codex/av3-native-connection-followup, 기준 HEAD fcd0ed0cf7283866141496db216076f060529006. 별도 보호 저장·P03·SDK 승인 경계를 대신하지 않는다.
- Main은 기록·검수·통합, 기존 developer_primary는 단일 제품 writer다. 다른 담당자의 편집을 되돌리지 않는다.

## 정확 쓰기 범위

1. apps/web/src/features/backups/BackupPolicyPanel.tsx
2. tests/unit/UI14/backup-policy.test.ts
3. docs/04_test_reports/AV3/UI14_BACKUP_POLICY_PAGE_RETRY_RESULT_20261116.md

## 결함과 목표

현재 다음 페이지 요청은 기존 page를 먼저 지운다. 일시 실패 뒤 nextCursor와 다음 버튼이 사라져 같은 페이지를 명시 재조회하지 못하고 첫 페이지부터 다시 읽어야 한다.

- 같은 현재 문맥에서 다음 페이지 GET이 CONNECTION_LOST 또는 정상 검산된 502/503/504 응답으로 일시 실패하면, 이전 페이지와 원 nextCursor를 안전하게 보존·복원해 기존 다음 버튼으로 같은 cursor를 다시 요청할 수 있게 한다. 자동 재시도·첫 페이지 fallback·POST는 없다.
- API/client/transport·project·user/clientId/CSRF·scope 세대가 바뀌면 이전 요청의 결과·목록·재조회 상태를 되살리지 않는다. 필요하면 기존 scope의 새 ticket에 현재 문맥을 검산한 사본만 결박한다. 늦은 실패도 현재 상태를 덮어쓰지 않는다.
- 401/403/404와 잘못된 본문/참조·문맥 오류는 일시 실패로 취급하지 않는다. 기존 목록·선택 폐기와 인증 소실 처리를 유지한다. 다른 오류로 새 재조회 경로를 열지 않는다.
- 첫 페이지 명시 조회는 기존 동작을 유지한다. 선택 상세의 정확 fullref 대조·직접 ID/version 조회·작성 초안·미확정 명령·일회 승인·저장 호출은 바꾸지 않는다. 보호참조 목록의 별도 refs 함수는 이번 범위에서 변경하지 않는다.

## 검수와 제외

- 먼저 첫 페이지 → 다음 cursor GET 503 → 같은 cursor 명시 재조회 → 둘째 페이지의 React RAM 행동 RED를 확인하고 최소 수정한다. 성공 요청·실패 요청의 정확 cursor와 저장/백업 호출0을 단언한다.
- CONNECTION_LOST, 401/403/404·RESPONSE_INVALID, project·session·client/transport 변경과 ABA, 늦은 성공/실패에서 데이터가 잘못 복원되지 않는지 영향 범위로 확인한다. 기존 fullref 선택·초안/불명 명령 보존 검사를 낮추지 않는다.
- 직접 UI14 시험·필요한 인접 시험·루트 타입·main 대비 diff를 실행한다. 코드가 변하지 않은 전체 회귀·실제 환경 검증은 반복하지 않는다.
- 결과서에 기준·시작 Git·정확 명령/exit/건수·오류/보완·변경 지문·미검증·rollback을 기록하고 쓰기를 반환한다. Main이 독립 검수 후 통합한다.
- 실제 DB·권한·키·사용자/백업 자료 조사·서비스·SDK/Agent/C#·백업 생성·실파일·브라우저 프로필·추가 의존성은 사용하지 않는다. 새 공개 API·SQL·권한·저장 의미는 없다. RAM 통과를 실제 사용자 화면 인수로 표시하지 않는다.
