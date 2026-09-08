# C-21 Workbench UI WSL authenticated browser runtime result R1

## 판정

`FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_EXECUTION`.

## 실행 결과

- WSL host `SINSAN`, application checkout exact candidate, clean detached 상태를 확인했다.
- private control/candidate fetch, validated base ancestor, `.env` mode/hash 및 필요한 이름 존재, `provider:read` scope, immutable manifest/action hash 검증은 통과했다.
- deploy 1회는 control checkout ref 입력에 candidate ref를 전달하여 trusted control과 관측 checkout이 불일치했고 mutation 전 fail-closed(exit 3)했다.
- 실패 증거를 재실행으로 덮어쓰지 않았다. verify 및 PG15/PG18RC authenticated browser probe는 실행하지 않았다.
- deploy 시작 이후 계약에 따라 표준 cleanup을 정확히 1회 실행했고 exit 0이었다.
- 사후 application checkout clean, `.env` mode/hash byte-identical, 두 격리 project의 container/network 및 exact volume residue 0을 확인했다.
- projection TDD는 missing builder/metadata로 `2 failed` RED를 확인한 뒤 seq620 focused `2 passed` GREEN을 확인했다.
- canonical 전체 tooling은 `608 passed in 1214.47s (0:20:14)`, exit 0이다.

## 비밀 안전성

credential 값, token, cookie, header, raw URL은 stdout 또는 산출물에 기록하지 않았다. 이름 존재와 hash만 기록했다.

## 경계

- Provider 외부 호출, Telegram, ysna, main merge, C-01: `NOT_EXECUTED`
- C-21: `BLOCKED_NOT_ACCEPTED`
- DIR-2: `NOT_TRIGGERED`
- 다음 조치: control ref와 candidate manifest ref의 역할을 분리한 후 새 runtime attempt를 별도 successor package로 실행한다.
- 이번 WSL 실행은 개발단계 검증이며 사용자 인수, 외부 테스트 또는 개발 완료 증거가 아니다. 작업계획서 용어 정정은 exact12 밖의 후속 별도 projection 대상이다.
