# U-03 Projects 완료 보고

## 판정

`ACCEPTED_U03_LOCAL_WSL_CONTRACT_SCOPED`

## 근거

- 제품 commit `9904541`은 Projects 경로, repository read-only scan client/BFF, dirty/untracked·baseline 차단 상태와 same-origin API를 포함한다.
- 로컬 state/client 계약 5개, Projects route SSR 1개, Dashboard 회귀 3개, Workbench 10개가 통과했다. Local typecheck·Vite build·Biome lint도 통과했다(React runtime import 관련 lint warning 1건은 동작 보존을 위해 유지).
- WSL-server exact commit `9904541`에서 state/client 5개, Projects route SSR 1개, typecheck가 통과했다. 전용 checkout은 `U03_WSL_CHECKOUT_RESIDUE_ZERO`로 제거했다.
- WSL build는 Node `v18.19.1`이 Vite 8 요구사항(Node 20.19+ 또는 22.12+)을 충족하지 않아 실행 불가했다. 이는 제품 PASS가 아닌 환경 미검증으로 기록한다.
- 브라우저 실제 클릭/Network와 live DB·repository scan은 미실행이다. 로컬 BFF scan은 worktree node_modules symlink 안전거부와 기본 Python runtime 부재로 503이 발생해 `UNVERIFIED`로 유지한다.

## 범위 제한

`ysna-server`·Production preview·운영 사용자 인수·실제 mutation·baseline 승인 작업은 수행하지 않았다. Projects 화면은 scan 결과가 없을 때 `NOT_CONNECTED`/`BLOCKED`를 표시하고 mutation을 허용하지 않는다.

## 롤백

제품 rollback은 commit `6ba6f27`로 되돌리면 된다. WSL 전용 checkout과 npm 산출물은 제거했다.
