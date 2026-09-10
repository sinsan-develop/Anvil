# C-21 Workbench UI WSL Runtime Result Report

## 판정

`READY_FOR_INDEPENDENT_C21_WORKBENCH_UI_WSL_ACCEPTANCE`

이 보고서는 WSL 통합검증 성공을 독립 acceptance로 승격하지 않는다. `accepted=false`, C-21 `BLOCKED_NOT_ACCEPTED`, C-01 `BLOCKED_PENDING_C21_ACCEPTANCE`, DIR-2 `NOT_TRIGGERED`를 유지한다.

## 실제 실행 결과

- SINSAN application repo는 candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d` clean detached, control ref는 `8fe7b975f39990b3d721d27b1a3e9353f891c5c1`이다.
- PG15와 PG18RC의 최초 deploy, 표준 verify, rollback은 PASS했다. rollback 뒤 current/previous/image는 승인된 `324eb169fedbce958d2e8cc29362deb7af433677`였고, DB migration head는 `0013_task_bootstrap_authority`를 유지했다.
- rollback 후 첫 재배포에서 PG15 신규 Compose one-off endpoint의 DB 연결 timeout이 같은 근본 원인으로 3회 관찰되어 Main이 인수했다. exact PG15 test service 3개와 project network 2개만 제거·재생성했고 DB volume, `.env`, backup/evidence는 보존했다.
- 복구 후 두 target 재배포와 표준 verify가 PASS했다. migration, API, `/auth/session`, authenticated SSE 1건, acknowledged Last-Event-ID 무재생, same-origin ingress, dump/restore와 scratch DB 정리가 모두 확인됐다.
- verify와 pre-migration backup receipt 경로는 실행마다 overwrite되는 계약이므로 현재 hash는 최종 verify/final deploy 상태만 증명한다. 첫 verify의 독립 file evidence로 주장하지 않으며 rollback receipt만 보존 상태로 구분한다.
- 최종 cleanup은 허용된 두 Compose project의 container/network와 exact volume 2개만 제거했다. 사후 residue는 container/network/volume 모두 0이다.
- `.env` mode는 600이며 작업 전후 SHA-256 `FECAE53B750E170A5BF345A23AC8D9BA12B508E9C6D0B47C518B90FD4D52A79A`로 byte-identical이다.

## 검증 경계

- in-app browser에서 두 UI surface와 9개 Provider/Registry/Run Event UI 렌더링은 확인했다. 브라우저에는 test token을 주입하지 않았으므로 Provider 목록은 `PERMISSION DENIED`, SSE는 `NOT CONNECTED`였다. 이는 authenticated browser PASS가 아니다.
- authenticated SSE와 Last-Event-ID는 표준 same-origin HTTP verify에서 PASS했다.
- Provider와 Telegram 실제 호출, ysna, main merge, C-01은 `NOT_EXECUTED`다.

## Rollback

이 record-only successor의 rollback은 direct-child exact12 commit을 되돌리는 것이다. WSL runtime은 이미 exact cleanup 후 residue 0이며 서버 `.env`와 evidence/backup은 보존돼 있다.
