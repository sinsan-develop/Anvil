# C-21 Provider WSL verify scope correction 보고서

## 판정

Provider/Telegram 제외 경계에 맞춰 WSL verify 범위를 정정했다.

## 실패 사실

- deploy PASS 이후 PG15 local Provider envelope에서 중단했다.
- PG15 SSE/backup은 NOT_REACHED, PG18RC는 NOT_STARTED다.
- local Provider status만 ATTEMPTED이며 external Provider/billing과 Telegram은 NOT_EXECUTED다.
- valid failure count는 기존 2를 유지한다.

## 변경

`verify.sh`에서 인증 여부와 관계없이 모든 `/api/providers` 호출, Provider 임시파일·parser·assertion을 제거했다. migration, API, auth session, SSE, Last-Event-ID, same-origin, backup/restore는 유지한다.

commit/push/WSL/Docker/DB/Provider/Telegram/ysna/main은 실행하지 않았다.

## 로컬 검증 결과

- Main takeover fixture 집중 검증: `2 passed in 28.11s`
- final 영향 집중 검증: `4 passed, 306 deselected in 30.35s`
- API 전체: `8 passed in 1.66s`
- deploy 계약 전체: `103 passed, 2 skipped in 1224.87s`
- tooling 전체: `197 passed in 961.27s`
- live checker 및 diff check: PASS

deploy skip 2건은 Windows에서 POSIX 파일 mode와 WSL Compose parser 조건을 직접 검증할 수 없는 기존 환경 한계다. 따라서 로컬 계약 PASS를 실제 WSL SSE·backup/restore PASS로 승격하지 않는다.
