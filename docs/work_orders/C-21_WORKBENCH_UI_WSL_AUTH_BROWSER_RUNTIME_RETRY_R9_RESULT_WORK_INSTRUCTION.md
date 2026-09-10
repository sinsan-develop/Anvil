# WI-C-21-WORKBENCH-UI-WSL-AUTH-BROWSER-RUNTIME-RETRY-R9-RESULT-20260909-001

## 권위와 범위

- parent `eadba5bad0df3ea4f52e28b847ab20957217b6c5`; control `fb311d456fe3cbb2e8439f39017356ddec6cf266`; candidate `f0d4bc7badbdae69c2d2b21089667fdcc636518d`
- exact12 Windows/ordinal `C76DF85C02565072777A14B469396E5E56F001BD094051F546A9CF2C6AA3F003` / `E52F1859A1643A060D3D680554B111E54D7DDC7F05C543E0EE39B8F2C50036D5`
- cumulative273 Windows/ordinal `BF167099DC8F21AC96258B041C333A9F19DC2426899EB140B48531FFA26A9D45` / `797C222A29F7B7D6F729D6DC2C3F06CE55586705AA0C8C01A6E42D9708806338`
- seq1~668/historical evidence와 product/probe/deploy/`.env`를 수정하지 않는다.

## always-return envelope gate

- native dispatch 전 envelope와 step marker를 초기화한다.
- native 반환 즉시 exit/stdout·stderr line count와 SHA-256을 먼저 넣고 이후 secret scan/strict parse/safe transform을 수행한다.
- exception은 allowlisted enum, failure step, statement enum만 기록한다. raw/message/secret은 기록하지 않는다.
- finally에서 envelope를 정확히 한 개 반환하고 raw/secret memory를 clear한다.
- synthetic PASS, PROBE_ERROR, malformed, throwing-transformer 네 건이 모두 통과하지 않으면 actual0, 동일 lineage count3, lease 회수, TakeoverPacket으로 seq674를 종결한다.

## actual

- gate PASS 후 preflight→deploy1→verify1→PG15 browser1→strict PASS면 PG18RC1→outer-finally cleanup1, retry0.
- 동일 capture root가 actual에서 재발하면 count3/lease 회수/TakeoverPacket으로 즉시 종결한다.
- 다른 predicate/native/probe 실패는 새 root count1로 분류한다. Provider external/Telegram/Oracle Cloud/ysna/main/C-01은 미실행이다.

## actual 결과와 TakeoverPacket

- synthetic4/call-shape5/final preflight는 PASS했다.
- deploy1 직후 safe metadata hash helper `H`가 PowerShell `Get-History` alias로 해석돼 `ParameterBindingException`이 발생했다. verify/PG15/PG18RC는0, outer-finally cleanup1, retry0이다.
- 동일 `BROWSER_RECEIPT_NOT_PERSISTED` lineage가 R7+R8+R9 count3에 도달했다. worker/write lease 및 runtime tool ownership을 회수하고 이후 Subagent 실행을 금지한다.
- 내부 TakeoverPacket은 parent/candidate/control, clean env/residue0, failure step/statement, 금지 action과 Main의 최소 교정안을 포함해 seq674 projection에 둔다.
