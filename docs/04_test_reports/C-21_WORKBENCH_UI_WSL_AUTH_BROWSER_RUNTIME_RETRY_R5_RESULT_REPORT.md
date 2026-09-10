# C-21 Workbench UI WSL authenticated browser runtime retry R5 result

## 판정

`FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R5_WSL_DEVELOPMENT_VALIDATION`

- classification: `WSL_DEVELOPMENT_VALIDATION`
- accepted: `false`
- C-21: `BLOCKED_NOT_ACCEPTED`
- C-01: `BLOCKED_PENDING_C21_ACCEPTANCE`
- DIR-2: `NOT_TRIGGERED`

## 기준선과 실행 권위

- canonical record parent: `48c34f8ef514e061f1cfa24e6d9f9f5bc0173bf1`
- immutable runtime control: `fb311d456fe3cbb2e8439f39017356ddec6cf266`
- candidate: `f0d4bc7badbdae69c2d2b21089667fdcc636518d`
- WSL manifest ref: `refs/remotes/origin/candidates/c21-wsl-runtime-control-v2`
- manifest SHA-256: `3D81F783969336ED83F83EAE4855EB881A1AABC14F18F6EF390E22C272B7B329`
- control-runtime/deploy/verify/cleanup SHA-256: `D0FF497B22851DFC6CB3FA36C761D8BB69DED1CB7A838E81EF55C4A459570097` / `7B6EE6A02BED857299423F78C73D746B6F8AC8C0CC40E3A611ECE06E43E1C1C0` / `93E882D35C055535A7D989962FE0EE0EC49B91542EB462B655F1477DD2562A36` / `65E8AA6F5F02AB554ECF3F4FBA1CEB16BD96616E952EB4D64D1285F183CC462D`

## 실제 실행 결과

| 단계 | 횟수 | exit/result | 근거 |
|---|---:|---|---|
| preflight | 1 valid | PASS | child private refs exact, app detached clean candidate, env mode/hash/name/scope exact, initial runtime residue 0 |
| deploy | 1 | `0 / PASS` | PG15·PG18RC DB healthy, migration, candidate image, ingress 기동 |
| verify | 1 | `0 / PASS` | PG15·PG18RC migration head, authenticated SSE, Last-Event-ID, same-origin, backup/restore |
| Windows PG15 browser | 1 | `1 / PROBE_ERROR` | viewport 0에서 Playwright module resolution fail-closed |
| Windows PG18RC browser | 0 | `NOT_EXECUTED` | 첫 실패 뒤 재실행 금지 |
| cleanup | 1 | `0 / PASS` | outer-finally exact cleanup |

PG15 browser receipt는 token/cookie/header/raw URL occurrence 0, screenshot 파일·디렉터리·residue 0을 기록했다. Node entrypoint와 receipt 생성은 실행됐지만 기본 Playwright module 경로가 없고 `ANVIL_PLAYWRIGHT_MODULE` override도 없어서 viewport 시작 전 `PLAYWRIGHT_MODULE_DEFAULT_PATH_MISSING_R5`로 분류한다. 직전 verify의 API·authenticated SSE·Last-Event-ID PASS와 분리되므로 제품 UI/API/SSE 결함으로 확정하지 않는다.

## 보존 증거

- current JSON receipts 4개만 결박: PG15/PG18RC pre-migration backup 2개와 verification 2개. rollback receipt는 R5에 포함하지 않는다.
- receipt SHA-256: `A2A8FB3CAAAFC0688B82C4FC89610184C00BB554EE4388AA421E869E01369C36`, `2AC37761BF90A36D3F79CD8D1BA0D4271277072DA58BABEA79367FF0EEC39541`, `96BD2FC8D3D96E6D46215419A0917D145FA851226E6D1F3C122D93BC21FC8DB2`, `0CE473C529B74D8D6AC10F43F0E532D591C2D76233A345348812E95541EE4D3B`
- image metadata 2개 SHA-256: `18108107884FE16327CC7942663434382D90F5102A3767A0BD518A361C3E88B3`, `2E549E4BAC11D2D8FEAD70C4DC37C0878A23AFF058DD10DD317E7AA6D2D32393`
- 두 marker는 candidate exact, application과 active control stage는 clean, `.env` mode 600/hash `FECAE53B750E170A5BF345A23AC8D9BA12B508E9C6D0B47C518B90FD4D52A79A` byte-identical이다.
- post-cleanup exact container/network/volume/lock/probe-created screenshot residue는 모두 0. backup/evidence는 보존했다. repository 내부의 기존 versioned PNG는 probe-created residue가 아니다.

## 오류 원장과 미검증

- `MAIN_R5_VERIFY_SHA_TRANSMISSION_TYPO_R1` 1회: Main 전달문 잡문, product=false/runtime=false.
- `R5_PREFLIGHT_WINDOWS_WSL_ARGV_QUOTING_R1` 1회: 첫 read-only compound preflight argv 인용 오류, product=false/runtime=false/action=0.
- `R5_PREFLIGHT_WSL_SANDBOX_DENIED_R1` 1회: 최초 WSL read sandbox 거절, product=false/runtime=false/action=0.
- `MAIN_R5_STATUS_TRANSMISSION_TYPO_R1` 1회: 연속 상태요청 전송 오타를 하나로 기록, product=false/runtime=false.
- `PLAYWRIGHT_MODULE_DEFAULT_PATH_MISSING_R5` 1회: actual PG15 browser phase failure. 재실행하지 않았다.
- Provider external, Telegram, Oracle Cloud, main merge, C-01은 `NOT_EXECUTED`다.

## Tooling 검증

- seq644+650 focused: `9 passed, 247 deselected in 2.50s`, exit0
- live checker: `PASS sequence=650 reporting=AUTO_CONTINUE`, exit0
- sandbox full: 10분/69% 장시간 경계에서 중단한 non-result; 후속 `-x`는 known npm-cache `stat EPERM`으로 `1 failed, 255 passed in 120.17s`, exit1
- 동일 EPERM 단일 테스트 elevated: `1 passed in 4.14s`, exit0
- `test_project_progress.py` 전체: failure 없이 28% 뒤 25분 장시간 경계에서 중단한 non-result
- 최초 exact12 stage: linked-worktree Git index sandbox 거절로 mutation 전 중단; 권한 허용 경계에서 재개
- 직전 seq644 canonical full `619 passed in 1543.54s`와 위 fresh focused/live/single-test 증거를 함께 사용하며 장시간 full을 반복하지 않는다.

## Rollback

이 package는 제품·deploy·probe·WorkPlan을 변경하지 않는다. 기록 commit은 parent `48c34f8...`에서 단일 revert할 수 있으며 WSL runtime은 cleanup 완료 상태다.
