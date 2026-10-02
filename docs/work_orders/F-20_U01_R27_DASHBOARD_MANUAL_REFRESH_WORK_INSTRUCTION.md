# WorkInstruction — F-20/U-01 R27 Dashboard 수동 새로고침

- 담당: `developer-primary-f20-u01-r27`. Main이 기존 branch/private Git/WSL-server 동일 checkpoint 및 canonical epoch41 worker/write dual lease ACTIVE·두 fencing token을 확인한 뒤 단일 writer로 착수한다.
- 기준: `docs/04_test_reports/F-20_U01_R27_DASHBOARD_MANUAL_REFRESH_PLAN.md`, 설계서 §29.2, 작업계획서 U-01, 테스트계획서 §10.8. Main이 dispatch 때 계획/WI/Invocation SHA-256을 제공한다.
- 분류: 승인된 U-01 내부 UI 절편. 기능 범위·요구사항·중요 위험, 공개 API·DB/schema·auth/Secret 계약 변경 없음.

## allowed_paths 정확히 4개

1. `apps/web/src/console/App.tsx`: Dashboard operations 수동 재조회. 기존 same-origin GET·검증 로더 재사용, 요청 분리/abort·중복 방지, 로딩 중 이전 보호값 제거, native button 키보드/상태 제공. Provider·Alert·readiness 독립 유지.
2. `apps/web/tests/f15-console.test.mjs`: RED→GREEN. 클릭·GET 횟수/경로, 로딩·새 시각·403/503/invalid·연속 클릭 및 타 카드 불변·민감정보 비노출.
3. `tests/browser/f20-u01-oidc-browser-pg15.mjs`: 기존 실제 PG15/OIDC/HTTPS/Chromium 저장·철회 flow에 수동 버튼 실제 클릭과 Network 요청·새 관측 시각 단언을 추가한다. R23~R26 fact/Secret·Network 단언은 느슨하게 하지 않는다.
4. `docs/04_test_reports/F-20_U01_R27_DASHBOARD_MANUAL_REFRESH_RESULT.md`: 시작 HEAD/status·기준 hash/lease, RED/GREEN 명령/exit·diff·미검증·rollback·Main 인계를 기록한다.

## 검증·금지·인계

- Node console 전체·browser 문법/`--audit-self-test`·typecheck/lint/build, Python 비 opt-in, G-05와 diff check를 실행한다. 로컬 생성 임시자원은 사전 신원·경로와 정리 방법을 기록하고 그 대상만 제거한다.
- Main은 exact4를 독립 검토·기존 branch commit/private push하고, WSL-server 동일 clean SHA 격리 PG15/OIDC/Chromium 실제 opt-in과 PNG/Network 검토 후 전용 자원 잔여0을 확인한다.
- Developer는 progress/HANDOFF/WORK_STATUS/control, Git commit/push, WSL-server/Docker/DB, 새 branch/main, ysna/Production을 변경하지 않는다. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나다.
- R27 PASS는 수동 재조회 절편만 의미한다. 필터·운영 read model·전체 상태·정식 독립 Tester 증거·C30은 미충족이며 U-01/F-20 acceptance가 아니다.
