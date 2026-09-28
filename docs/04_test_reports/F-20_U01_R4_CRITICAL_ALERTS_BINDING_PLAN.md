# F-20/U-01 R4 — Dashboard Critical Alerts 저장 기록 읽기 연결 계획 (DRAFT)

## 판정과 기준

- R3b 제품 SHA `98b8d0b31d884cf1517ce039d73d7f6b7a7bae2a`의 WSL-server Python 전체 회귀는 `8239 passed, 117 skipped, 14 warnings`(exit0)다. 이는 Dashboard Alerts UI·브라우저 수락이 아니다. R3b 최종 기록 commit `b6e2990e7c3d00bcaeab95454198584eaf290e0d`은 기존 branch에 보존됐다.
- 승인된 U-01 Dashboard의 다음 직렬 slice는 기존 OIDC scope의 `GET /api/operations/alerts`가 반환한 **저장된 경고 기록**만 같은 origin의 Dashboard Critical Alerts 영역에 연결하는 것이다. 현재 브라우저 `App.tsx`는 이 영역을 `UNAVAILABLE`로 표시하며 기존 R3a는 API owner만 연결했다.
- C30 사고는 CRITICAL `OPEN_BLOCKING`, ReleaseDecision은 `DEFER`, U-01/F-20은 미수락이다. 이 slice도 이 상태를 변경하지 않으며 `main` 병합·새 branch·ysna-server/Production은 제외한다.

## 정확한 경계

1. R3b epoch15 write→worker lease를 순서대로 회수하고 R4 epoch16 exact3 `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `docs/04_test_reports/F-20_U01_R4_CRITICAL_ALERTS_RESULT.md`를 새 WI/Invocation·dual lease로 발급한다. G-05 PASS 전 제품 exact3 write는 금지한다.
2. Dashboard `GET /api/operations/alerts`만 same-origin 상대 경로와 `credentials: 'same-origin'`으로 읽는다. 200의 `{data: {alerts: [...], next_before_sequence: number|null}}`를 엄격 검증한다. 인증 거부, HTTP 오류, 네트워크·JSON 오류, 범위 밖·위조 필드, 잘못된 cursor는 `UNAVAILABLE`로 닫는다. Secret, dedupe key, evidence hash, 내부 endpoint는 화면에 노출하지 않는다.
3. 저장된 `level=critical`, `status=open|acknowledged` 경고만 `code`, `source`, `observed_at`, `owner_id`(null이면 미배정), 원인/대상 정보를 텍스트로 표시한다. React escaping을 유지한다. 빈 목록은 ‘이 페이지에 저장된 Critical 기록 없음’일 뿐 detector 실행·전체 경고 없음·운영 건강 PASS가 아니다. `next_before_sequence`가 있으면 과거 페이지 미조회/부분 결과를 명시해 전량 0건으로 오해하지 않게 한다. 이 slice에서 경고 수집·pagination mutation은 하지 않는다.
4. 새 API/route·permission·DB schema/migration·Secret, detector 호출, acknowledge mutation, Next Actions 연결, Queue/Worker/Backend/Artifact health를 만들지 않는다. 기존 Database·Provider 카드와 다른 메뉴는 유지한다. 확인 버튼·딥링크가 실제 원인 화면으로 가지 못한다면 활성화하지 않는다.
5. RED→GREEN Node 계약(정상 critical/warning 혼합, 빈 페이지/older cursor, 401/403/500, malformed/transport, source text escaping)과 web typecheck/lint/build, F-13 인접/G-05를 먼저 확인한다. Main 독립 diff/검증 후 기존 branch commit/push, WSL-server exact SHA의 실제 OIDC/API·브라우저 1920×1080/390×844 및 Network same-origin을 별도 확인한다. 임시 자원은 이름·범위·수명을 사전 기록하고 정확한 대상만 제거한다.

## 남는 조건

R4 GREEN은 저장 기록 read UI만 증명한다. detector 실행·경고 신선도/완전성, acknowledge, Next Actions, Dashboard의 다른 카드·운영 행, U-01 독립 acceptance 및 F-20 최종 검증은 후속 작업이다. rollback은 R4 제품 commit만 후속 정상 Git commit으로 되돌려 Alerts 영역을 `UNAVAILABLE`로 복귀한다. 원장·이전 기록·DB를 되돌리지 않는다.
