# F-20/U-01 R2 Provider 등록 상태 Dashboard WorkInstruction

- 발행 준비자: Main Agent 어울. **DRAFT — canonical WI Event·epoch12 exact3 dual lease·G-05 PASS 전 제품 파일 수정 불가.**
- 상위 권위: 승인된 `Anvil_작업계획서_v1.md` §13 U-01, `Anvil_통합검증매트릭스_v1.md` U-01, `docs/04_test_reports/F-20_FULL_SUITE_RECOVERY_PLAN.md` U-01 R2.
- 환경: Windows 로컬 개발, 지정 원격 push 후 `ssh WSL-server` exact SHA 테스트. 새 branch·ysna-server·Production 금지.

## 정확한 제품 쓰기 범위

1. `apps/web/src/console/App.tsx`
2. `apps/web/tests/f15-console.test.mjs`
3. `docs/04_test_reports/F-20_U01_R2_PROVIDER_STATUS_RESULT.md`

Main은 R1b epoch11 write→worker lease를 순서대로 회수하고 새 worker/write exact3을 발급한다. G-05 PASS 전에는 제품 경로를 쓰지 않는다. Main은 단일 Developer가 소유한 제품 경로를 동시에 수정하지 않는다.

## 구현·검증

- Dashboard의 `LLM Providers` 카드에 기존 same-origin `GET /api/providers`를 1회 읽어 반영한다. `data`가 canonical 9개 Provider의 중복 없는 전체 목록이고 각 `credential_status`가 `REGISTERED/MISSING`, `health_status`가 `NOT_CHECKED`일 때만 등록 개수를 보여준다. 건강은 연결 테스트가 아니므로 `NOT CHECKED`이며 `READY`나 live Provider 성공이라고 쓰지 않는다.
- 401/403, 5xx, fetch 실패, JSON 파싱 실패, 누락·중복·알 수 없는 Provider 또는 상태, 빈 목록은 `UNAVAILABLE`로 닫는다. API 응답의 credential 값·내부 주소·오류 원문·기타 임의 필드를 렌더링하지 않는다.
- 기존 Database 카드와 다른 미연결 카드, 다른 메뉴, API·인증·권한·DB·Secret·routing 계약은 변경하지 않는다. 화면 호출은 상대경로 및 `credentials: same-origin`을 사용하고 cleanup 시 fetch를 abort한다.
- Node 테스트에서 정상 등록 일부/0, 잘못된 응답, auth/network 실패를 먼저 RED로 확인한다. 최소 GREEN 뒤 web typecheck/lint/build, G-05, 독립 diff·제품 리뷰를 수행한다. Main은 안전한 commit/push 뒤 WSL-server exact SHA의 API/실제 브라우저 Network와 두 viewport를 검증한다.
- 결과보고서에는 시작 branch/HEAD/status, 문서 hash, 변경 diff, 명령·exit·결과, 실측과 미검증 구분, 기존 동작 유지, 잔여 위험, rollback, progress/HANDOFF 갱신 여부를 기록한다.

## 완료 경계

R2 GREEN은 실제 Provider 연결 건강, U-01 전체 acceptance, C30 `OPEN_BLOCKING` 복구, F-20 수락 또는 release가 아니다. 116 skip과 운영/Production 미실행은 그대로 기록한다.
