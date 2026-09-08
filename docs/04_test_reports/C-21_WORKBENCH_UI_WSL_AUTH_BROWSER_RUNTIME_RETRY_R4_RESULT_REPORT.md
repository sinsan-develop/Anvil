# C-21 Workbench UI WSL authenticated browser runtime retry R4 result

## 판정

`FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_VALIDATION_ATTEMPT_4`.

## 범위

- seq1~632와 attempt1~3을 보존한다.
- child preflight는 private refs, application clean candidate, env mode/hash, required names, `provider:read`, 초기 runtime residue0을 확인했다.
- deploy exact1은 control `eafe12a...`의 실제 lineage가 candidate direct-child exact12 guard와 불일치해 exit1로 실패했다. 재실행하지 않았다.
- verify와 PG15/PG18RC authenticated browser는 실행하지 않았다.
- cleanup exact1은 전달된 cleanup hash의 전사 누락으로 format gate에서 exit1 실패했다. 재실행하지 않았다.
- 사후 application과 env는 byte-identical이고 승인 runtime container/network/volume/lock/screenshot residue는 0이다. active control stage 1개는 `eafe12a...`, clean이다.
- WSL runtime/browser/API/DB 결과는 개발단계 검증으로만 분류한다.
- 성공해도 accepted=false, C-21/C-01 blocked, DIR-2 not triggered를 유지한다.
- Provider 외부, Telegram, ysna, main, C-01은 실행하지 않는다.

## 인수 검증

- 이전 canonical 전체 tooling 실행은 약 70% 진행 중 사용자 중단으로 프로세스가 종료됐다. 화면에 provisional failure 1건이 보였으나 최종 traceback과 exit code가 없어 `INTERRUPTED_NON_RESULT`이며 PASS·FAIL 어느 쪽으로도 집계하지 않는다.
- 인수 후 WSL read-only 재확인에서 application `f0d4bc7...` clean, active control stage `eafe12a...` clean, publish lock과 Anvil 전용 container/network/지정 volume residue 0을 확인했다. actual runtime action은 재실행하지 않았다.
- fresh canonical 전체 tooling은 `.venv\Scripts\python.exe -m pytest tests\tooling -q -p no:cacheprovider`로 1회 실행해 `615 passed in 793.94s (0:13:13)`, exit0을 확인했다.
- 첫 live checker 인수 호출은 지원하지 않는 `--root` 옵션을 사용해 해당 문자열을 root 경로로 해석하면서 `LOAD_ERROR`, exit1로 종료됐다. fingerprint `LIVE_CHECKER_ROOT_FLAG_USAGE_R1` 1회이며 제품·projection·runtime 실패가 아니다. 위치 인자 `.`로 교정한다.
- 최종 결박 준비: seq632+seq638 focused `5 passed, 242 deselected`; 교정 live checker `PASS sequence=638 reporting=AUTO_CONTINUE`; generated5 두 번 생성과 materialized bytes 동일; exact12/cumulative237 Windows·ordinal hash 일치; parent `eafe12a...` exact; `git diff --check` PASS다.
- 인수 orchestration 오류는 `FINALIZER_WSL_SANDBOX_READ_DENIED_R1`, `FINALIZER_WSL_POWERSHELL_QUOTING_R1`, `FINALIZER_GENERATED5_SANDBOX_WRITE_DENIED_R1`, `FINALIZER_PATCH_CONTEXT_MISMATCH_R1` 각 1회다. 모두 runtime attempt·제품·projection 실패가 아니며 승인된 격리 경계와 정확한 호출로 교정했고 actual runtime action은 추가 실행하지 않았다.
- 최초 direct-child commit 뒤 오류 원장을 추가한 dirty amend 전환에서는 live checker가 의도대로 `GIT_DESCENDANT_RECORD_COMMIT_INVALID`, exit1로 fail-closed했다. 이는 최종 clean amend 전의 예상 Git transition이며 최종 commit에서 재검증한다.

다음 안전 조치는 candidate에서 single direct-child exact12인 immutable runtime control ref를 별도 successor로 발행·결박한 뒤 새 attempt에서 정확한 cleanup hash를 사용하는 것이다.
