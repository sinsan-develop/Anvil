# F-18 R12 auth ingress writer 종료 계획

- 범위: 승인된 F-18 R12 exact3 제품 수정과 게시 SHA `88004220423c324374b47a32ad7a50728c810094`의 WSL-server 실제 Web/API ingress HTTP QA, 로컬 Web 타입검사·빌드, 독립 리뷰 결과를 근거로 epoch10 단일 writer의 write lease와 worker lease를 순서대로 회수한다. 제품 파일·인증 의미·공개 API·DB·Secret·Production은 변경하지 않는다.
- 선행조건: 게시 제품 commit `cae47aa8c2dd14d561d03b8eaf25948c860f136e`의 seq1561 활성 lease 원문과 이벤트 prefix 일치, 승인 branch/remote clean, `development/main` 기준선 불변, QA 통제 commit 조상 관계, 경로 exact scope. 현재 G-05 seq1561 PASS.
- 방법: fail-closed 종료 overlay와 거부 회귀를 먼저 게시·검증한다. 검증된 control QA commit에 결박해 seq1562 `WRITE_LEASE_REVOKED` → seq1563 `WORKER_LEASE_REVOKED`를 materialize하고 progress/handoff/digest/manifest hash를 동기화한다. 증거 commit/push 후 G-05 PASS를 확인한다.
- 결과 경계: `F-18 accepted=false`, `F-19 BLOCKED_PENDING_F18_ACCEPTANCE`, Production `NOT_EXECUTED` 유지. 다음은 같은 작업 branch에서 F-18 잔여 실제 DB/OIDC/browser/network/restart 검증이다. 새 branch, main 병합·삭제는 F-18 통합 gate 전에는 하지 않는다.
