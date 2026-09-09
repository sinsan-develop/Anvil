# C-21 Workbench UI WSL authenticated browser runtime retry R9 result

`FAILED_R9_CONTROLLER_EVIDENCE_CAPTURE_LINEAGE_COUNT3_TAKEOVER_REQUIRED`

- parent `eadba5bad0df3ea4f52e28b847ab20957217b6c5`
- exact12/cumulative273 경로 hash를 WorkInstruction에 결박했고 seq1~668 및 제품/probe/deploy/`.env` bytes는 변경하지 않았다.
- TDD synthetic4(PASS, PROBE_ERROR, malformed JSON, throwing transformer)는 one-object always-return, step/exception allowlist, raw/secret clear 계약을 모두 PASS했다. 동일 token shape의 harmless local call-shape 5건과 final preflight도 PASS했다.
- actual은 deploy를 정확히 1회 호출해 두 target의 backup receipt와 image metadata를 갱신한 뒤, safe native metadata 변환의 `stdout_sha256=H native.stdout;stderr_sha256=H native.stderr` statement에서 `H`가 `Get-History` alias로 해석됐다. `ParameterBindingException`/`GET_HISTORY_ID_CONVERSION_FAILURE` 때문에 action exit·stream hash/line count를 담은 단일 envelope가 반환되지 않았다.
- 첫 실패 뒤 verify/PG15 browser/PG18RC browser는 모두 0회다. outer-finally cleanup은 정확히 1회 호출됐으나 동일 hash helper 오류로 exit envelope는 미보존이다. runtime retry는 0이다.
- post-cleanup read-only는 application `f0d4bc7...`/active control `fb311d45...` clean, env mode600/SHA byte-identical, container/network/exact-volume/publish-lock residue0를 확인했다. backup2 SHA는 `140CCCFE...B6A0`, `17FD2E60...950A`; 기존 verification2는 `96BD2FC8...C8DB2`, `0CE473C5...E4D3B`; image metadata2는 `18108107...E88B3`, `2E549E4B...32393`이다.
- primary fingerprint는 `R9_ACTUAL_ENVELOPE_HASH_HELPER_RESOLUTION_R1`, diagnostic은 `BROWSER_RECEIPT_NOT_PERSISTED_R9`다. R7+R8+R9의 동일 `BROWSER_RECEIPT_NOT_PERSISTED` evidence-capture lineage valid failure count3이며 제품 UI/API/SSE 결함은 확정되지 않았다.
- worker/write lease와 runtime tool ownership을 모두 회수했고 내부 TakeoverPacket의 next owner를 `MAIN_AGENT_SEQUENTIAL_TAKEOVER`로 고정했다. 이후 Subagent runtime/implementation retry는 금지한다.
- secret/token/cookie/header/raw origin, browser raw output, screenshot binary/base64는 기록하지 않았다. Provider external/Telegram/Oracle Cloud/ysna/main/C-01은 미실행이다. accepted=false, C-21/C-01 blocked, DIR-2 not triggered다.
