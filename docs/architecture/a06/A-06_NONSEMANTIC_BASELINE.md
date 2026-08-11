# A-06 Non-semantic Derived Baseline

## 판정 경계

`STATIC_ONLY / STATIC_CONTRACT_PASS`. `E-API NOT_EXECUTED`, `E-AUD NOT_EXECUTED`; runtime은 `RUNTIME_DEFERRED / NOT_EXECUTED`다.

## 계보와 비확장

binding은 root human approval, parent baseline, old/new hash, semantic diff, impact, rationale, actor/time, scope before/after와 `scope_expanded=false`를 보존한다. `semantic_diff=NONE`이고 scope가 동일할 때만 Main의 non-semantic reconfirm을 허용한다.

기능 범위·요구사항·중요 위험의 material change 또는 scope 확장은 사람 승인이 필요하다. `NON_SEMANTIC_RECONFIRM`은 이를 대체할 수 없다. 권한이 없으면 `reason=재확정 권한 부족`, `next_action=Main Agent 검토`를 표시한다.

