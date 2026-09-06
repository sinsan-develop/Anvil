# C-21 Provider WSL Exact Binding WorkInstruction

- ID: `WI-C-21-PROVIDER-WSL-EXACT-BINDING-20260906-001`
- 상태: `ACTIVE / STAGE-S-START`
- dispatch 기준: `3501c37b25274c2c3b406a15bc8a57aa03a162e7`
- 실행자: `developer-primary`
- worker/write fencing: `epoch-1-3501c37`

## 목적

검증된 execution-resume K commit을 실제 WSL 실행 전에 정확한 private Git authority와 현재 WSL 상태에 결박할 후속 K exact14 작업을 시작한다. 이번 S는 기록과 validator만 만들며 외부 mutation은 수행하지 않는다.

## S exact10

`docs/WORK_STATUS.md`, start manifest, progress/HANDOFF/Event/detached digest, 본 WorkInstruction과 InvocationPrompt, checker와 tooling test의 정확한 10경로다. sorted LF path hash는 `410EB4E3EB843BFF2FE9D332505445286986BE8572A288DF713E388DAF587B62`, seq536 누적 exact117과 S의 합은 exact121 / `8A7D4AA0124FBC49DD67D48DBF10C9CCC586BB43AB4A9A4473604C1E2F43B429`다.

## 권위 실측

- WSL host `SINSAN`; runtime `/srv/anvil-wsl/repo`는 clean detached `a342d62391a44b349733d1468ac3b180761155ab`, origin은 `git@github-sinsan-develop:sinsan-develop/Anvil.git`이다.
- control repo는 없고 PG15/PG18RC current=`a342d62391a44b349733d1468ac3b180761155ab`, previous=`324eb169fedbce958d2e8cc29362deb7af433677`다.
- containers 없음, exact two test volumes 없음, images `a342d623`/`324eb169`/`830` 있음.
- `/srv/anvil-wsl/.env`는 mode `0600`, 필수 7 key가 각각 한 번 존재한다. 값은 기록하지 않는다.
- private development control은 `772afbd5eb55791ca7b5002d58378437ea496750`, candidate ref는 없고 old control은 `3501c37`의 ancestor라 fast-forward 가능하다. public origin은 private push authority가 아니다.

## 후속 K exact14 계약

기존 K exact14의 forward-only history를 보존한다. 후속 K는 runtime repo의 clean detached 상태를 허용하고 private remote exact control/candidate ref를 CAS 방식으로 결박한다. rollback allowlist는 기존 `a6dca0da5a37e64491e91813895268e78ecb78b2`와 실측 predeploy current `a342d62391a44b349733d1468ac3b180761155ab`를 포함한다. current/previous/image가 위 실측과 다르면 mutation 전에 fail-closed한다.

## 금지 및 완료조건

S에서는 commit, push, SSH/WSL mutation, Docker, DB, Provider, Telegram, ysna, main merge를 실행하지 않는다. seq537 `WORKER_LEASE_ISSUED`, seq538 `WRITE_LEASE_ISSUED`, seq539 `PACKAGE_STARTED`를 append하고 strict builder/validator가 raw seq1~536, exact10/exact121, direct-child Git, private authority 및 malformed 입력을 fail-closed로 검증한다.
