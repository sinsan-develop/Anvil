# U-01 Task4 두 조합 WSL-server R4 수직 QA 결과

## 판정

`THREE_PHASE_PASS; OTHER_HARNESS_FAIL; FOUR_PHASE_NOT_ACCEPTED`. 기존 단일 branch와 WSL-server Git checkout의 clean exact SHA `3eb267c910422c6ee486ef664d16bd9a2f45db54`에서 전용 PG15/OIDC/HTTPS/API/Web/Chromium을 기동했다. 같은 빈 DB 수명에서 `granted` 2 PASS/30 deselected(21.28초), `revoked` 2 PASS/30 deselected(17.02초), `restored` 2 PASS/30 deselected(19.17초), 각 exit0이었다. issuer만 다른 합성 subject로 교체한 `other`는 DB/접근 차단 preflight 후 브라우저 UI `TimeoutError`로 `1 passed, 1 failed, 30 deselected`(35.32초, exit1)였다. 따라서 네 phase 인수·U-01 수락·Release 준비를 주장하지 않는다.

## 실제 경로·원인 분리

- WSL-server Git exact SHA/clean, 전용 network `anvil-u01-two-pair-qa-r4-net` ID `c4145513541f9b70bc4e8d4cbb6208964b4da6afa9acea94b70152eb7cc463ed`, tmpfs PG15 `150018`/Alembic `0020_f19a_pair_grants`, 비관리자 DB/user `anvil_u01_qa_3eb267c91042`, 등록/환경/grant/등록감사/운영감사 `0|0|0|0|0`부터 시작했다. API/Web/issuer image revision은 위 exact SHA, Web loopback `127.0.0.1:8444`, PG loopback `127.0.0.1:5546`, 브라우저 내부 도메인은 전용 Web `172.30.239.10`이었다. 공유 서비스는 사용하지 않았다.
- 세 phase의 실제 브라우저가 각각 조합·기간 API, 화면, stale·합성 503 복구와 same-origin Network를 통과했다. phase별 network JSON은 `granted` API response 28/관측6, `revoked` 23/관측3, `restored` 29/관측6이며 모두 합성 fault 실행 true다. 이후 `other` phase의 비허용 조합 목록·scoped GET 차단을 하네스가 검사하고 DB 원장 `2|2|2|8|5`를 확인했으나, 브라우저의 빈 목록 상태 선택자가 타임아웃됐다. 이 phase의 수직 인수는 FAIL이다.
- Main의 별도 Chromium DOM 진단은 다른 사용자 OIDC callback 200, `#scoped-pair` option 1개(기본 항목만), `status` 실제 텍스트 `선택 가능한 조합이 없습니다.`, pair select disabled true를 확인했다. 그러나 `getByRole('status', {name: '선택 가능한 조합이 없습니다.'})` count0이고 `getByRole('status').filter({hasText: '선택 가능한 조합이 없습니다.'})` count1이다. 빈 목록은 구현돼 있지만 하네스의 accessible-name 선택자가 실제 DOM과 맞지 않는다. 추가 키보드 진단에서는 비활성 pair select에 `.focus()`가 적용되지 않아 직전 새로고침 button이 포커스를 유지하고, Tab 후 `#scoped-period`로 이동했다. 제품 결함 확정이 아니다.
- 기존 epoch106 dual lease의 단일 Developer는 WI 허용 브라우저 하네스 한 파일만 위 status 선택 방식으로 최소 보완했다. 수정 전 self-test RED(exit1), 수정 후 JS 자체·구문·diff check PASS, Developer Python 인접 30 PASS/2 deselected, Main 독립 Python 31 PASS/1 opt-in SKIP(exit0). 실제 새 SHA WSL 재검증 전이므로 `other`를 PASS로 바꾸지 않는다. Developer 정식 FAILURE_REPORT 0건.

## 보존 증거·정리·잔여

- 로컬 `docs/evidence/u01-task4-two-pair-r4/`에 세 phase의 1920×1080 full-page PNG와 Network JSON 6개, 별도 `other` 빈 목록 진단 PNG 1개를 WSL 원본과 SHA-256 일치로 보존했다. JSON의 token/Secret/DSN 표식0, screenshot은 합성 화면만 보였다. `other` 진단 PNG는 공식 phase PASS 증거가 아니다. 세 phase Network SHA-256: granted `A11895E67720F00059F9B8FC7346E139F6C95BF72D4B067B1ECFB4B7ED2C88E9`, revoked `6962F8854A0228798DD767914F6CDD11ECD49A7CFCB2A8D6E99D32330C87E976`, restored `1D7255411DE6BA90A279827482DB9C2685E181A613E96170C8E0CCA6FD32D8D6`. 진단 PNG `4577FA0275F729337307A1F3D56D23EE2C6D9BE707A9C84AA9844A1B48515B9A`.
- 정확 5 container의 label/ID, network ID, 세 image revision, checkout clean, 세 root owner/realpath를 확인한 뒤 전용 browser/Web/API/issuer/PG, network, 세 image tag와 checkout/material/browser root를 제거했다. R4 label container/network, root, loopback 5546/8444 잔여0. 공유 Web `f0107aada3b2`, PG `99f3bf939d40`는 ID·running 불변이다. 원본 캐시 image는 보존했다.
- 다음은 같은 branch에 하네스/기록 commit·push한 새 정확 SHA로 새 빈 격리 PG15 네 phase를 다시 실행한다. 기존 R6 `STORED_ROW` 원인 분리, E-SHOT/E-NET/E-API/E-AUD 완결, 최신 G-05 successor와 독립 Tester 판정 전 U-01 `NOT_ACCEPTED`, Release `DEFER`, PR/main·branch 삭제·새 branch/U-02·ysna/Production 미실행이다. Rollback은 이번 하네스 선택자 변경 commit만 정상 revert한다.
