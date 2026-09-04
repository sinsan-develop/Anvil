# C-21 WSL readiness 결정 보고서

- 기록 시각: 2026-09-04T14:40:00+09:00
- 판정: `WAITING_APPROVAL`
- 대상: `C-21/LR-02C/OPS-R2` 이후 WSL-server 선행검증 요청
- checkpoint: `894e7b71fc52905e774892844905199401199fb2`

## 1. 확인 결과

- feature branch의 `HEAD`와 upstream은 모두 `894e7b71fc52905e774892844905199401199fb2`이며 감사 시작 시 제품 작업 트리는 clean이었다.
- `deploy/ysna/ReleaseManifest.json`의 source/runtime target은 이전 후보 `b4858ffb373066b24d7d9ee9bfde810160cacb75`에 고정돼 있다.
- `deploy/ysna/manifest-guard.sh`는 ReleaseManifest target이 `origin/main`의 조상이어야 통과하도록 제한한다.
- 현재 R4 WorkInstruction §5는 checkpoint commit과 feature push만 허용하고 ReleaseManifest rebind, main merge, deploy, Telegram, Provider 실행을 금지한다.
- 작업계획서 F-16은 Git-only WSL Test/Staging 배포와 signed ReleaseManifest 구현을, F-17은 WSL PostgreSQL 15와 격리 PostgreSQL 18 RC의 실제 검증을 소유한다.
- `deploy/wsl`에는 `.gitkeep`만 있으며 WSL 전용 배포 하네스가 아직 없다.
- `deploy/ysna/verify.sh`는 `anvil.sinsan.kr`, Telegram, Provider 경로를 결합하므로 WSL 전용 검증으로 그대로 재사용할 수 없다.

## 2. 결정

WSL-server 선행검증은 현재 C-21 R4 승인 범위의 단순 실행이 아니다. Phase C successor를 작업계획서 F-16/F-17보다 먼저 실행하고 별도 배포 하네스·후보 manifest를 도입하므로 기능 범위, 작업 순서 및 중요 운영 위험 변경 승인이 필요하다.

따라서 다음을 유지한다.

- C-01: `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`
- WSL Phase C 조기실행: `WAITING_APPROVAL`
- Telegram·Provider: 사용자 검증 범위로 유지하며 이번 WSL 제안에서도 제외
- seq1~482와 기존 evidence: byte 단위 변경 금지

## 3. 이번 checkpoint에서 수행하지 않은 작업

- 제품 코드 변경
- 서버 배포·재배포·재시작
- DB·DNS·TLS·Secret 변경
- 기존 자료 삭제
- ReleaseManifest rebind
- main 병합
- Telegram·Provider 실행

## 4. 정확한 다음 승인 문구

`C-21 WSL 선행검증을 Phase C successor로 앞당기고, deploy/wsl Git-only staging harness와 별도 candidate ReleaseManifest/guard를 구현한 뒤 WSL-server의 PG15 전용 DB 및 격리 PG18 RC에서 Telegram·Provider를 제외한 migration·API·SSE·same-origin·backup/restore·rollback 검증을 수행하는 것을 승인한다.`

## 5. Projection 오류 인수

- seq483 checkpoint 커밋 뒤 동일 계열 `GIT_DESCENDANT_ORIGIN_MISMATCH`가 다시 발생했다.
- C-21 successor projection에서 같은 근본 원인이 3회 이상 반복된 상태이므로 Main Agent가 직접 인수했다.
- 실제 제품·범위·event 변경 없이, projected local checkpoint가 실제 HEAD의 조상이고 exact18·branch·upstream·remote가 모두 일치할 때만 정상 governance successor를 허용한다.
