# WI-C-21-WORKBENCH-UI-WSL-AUTH-BROWSER-RUNTIME-RETRY-R4-RESULT-20260908-001

## 목적

seq632와 attempt1~3을 보존하고 표준 bash 호출로 authenticated browser 개발검증 attempt 4를 정확히 1회 실행·기록한다.

## 실행 계약

- child `ls-remote`·private ref·application repo·`.env`·scope·residue preflight를 secret-safe하게 완료한다.
- deploy, verify, cleanup은 모두 outermost `sudo -n env`에 동일한 explicit `GIT_SSH_COMMAND`와 immutable hash를 전달하고 `bash /srv/anvil-wsl/repo/deploy/wsl/control-runtime.sh <action> f0d4bc7badbdae69c2d2b21089667fdcc636518d`로 호출한다.
- deploy 1회, verify 1회, PG15 `127.0.0.1:4770` 및 PG18RC `127.0.0.1:4870` authenticated browser probe, cleanup 1회 순서를 지킨다.
- actual failure는 재실행하거나 증거를 덮어쓰지 않는다. cleanup 후 residue·environment·application을 읽기 전용으로 확인한다.
- credential, token, cookie, header, raw URL 값은 출력·저장하지 않고 screenshot은 memory-only다.
- Provider 외부, Telegram, ysna, main, C-01은 실행하지 않는다.

## 완료 경계

성공해도 `READY_FOR_INDEPENDENT_C21_WORKBENCH_UI_WSL_ACCEPTANCE`이며 accepted=false, C-21/C-01 blocked, DIR-2 not triggered를 유지한다.

## 실제 결과

deploy exact1은 active guard의 candidate direct-child exact12 요구와 control `eafe12a...`의 lineage 불일치로 실패했다. verify/browser는 미실행이다. cleanup exact1은 cleanup hash 전사 오류로 format gate에서 mutation 전에 실패했고, 사후 승인 runtime residue는 0이다.
