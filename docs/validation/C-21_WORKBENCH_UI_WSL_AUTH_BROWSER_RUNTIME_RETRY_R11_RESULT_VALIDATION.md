# C-21 Workbench UI WSL authenticated browser runtime retry R11 validation

- expected: final controller gate/preflight PASS; deploy1/verify1/PG15 browser1; PG15 strict PASS일 때만 PG18RC1; finally cleanup1; retry0.
- actual: gate/preflight PASS; deploy1 exit0; verify1 exit0; PG15 browser1 exit1 `ACCEPTANCE_FAILED`; PG18RC0; cleanup1 exit0; retry0.
- exact false: receipt `receipt.result==PASS`, `safe_receipt.viewports[2].documentHorizontalOverflowZero==true`; native `native.exit_code==0`; consistency none.
- viewport: `mobile-430x844`, 430×844, horizontal overflow zero false; 다른 8 boolean true. desktop 2개는 9/9 true.
- safety: secret scan0, raw/token/cookie/origin/exception message persisted0, screenshot subtree/path/hash/binary persisted0, post-cleanup residue0.
- verdict: `FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R11_WSL_DEVELOPMENT_VALIDATION`; accepted=false; independent review pending.
