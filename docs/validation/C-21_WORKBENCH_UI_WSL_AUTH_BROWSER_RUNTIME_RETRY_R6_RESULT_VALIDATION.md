# C-21 Workbench UI WSL authenticated browser runtime retry R6 validation

- seq651~656 append-only; seq1~650 byte-preserved
- exact12 Windows/ordinal: `58CE542C2E5F2946FDFC0D159D4E294AC50D9FFF1012CE86BE151F9724941975` / `2FD1D089F870B271B0E97C21F675DAAC4DAD5A1923838E25446EC4B12FFE6DC3`
- cumulative255 Windows/ordinal: `880C34EB128C6C44407AF05BC1692D7C0C6C99232EF1B89EA1BD2D9D0D584786` / `CEEBA7C44B1AB182186202579F550791FBE9455AE3138DB3B0C66FCBCC5554F6`
- preflight: PASS; deploy count1/exit0/PASS; verify count0; PG15 browser count0; PG18RC browser count0; outer-finally cleanup count1/exit0/PASS
- controller: `POWERSHELL_FUNCTION_STDOUT_EXITCODE_CAPTURE_R6`, exit1, runtime reexecution=false, product failure=false
- current receipts: JSON2(backup2/verification0/rollback0), image metadata2; backup JSON secret-safe PASS
- post-cleanup: application/control/`.env` clean or byte-identical; container/network/exact-volume/lock/probe screenshot residue0
- focused seq650+seq656: `10 passed, 251 deselected`, exit0
- accepted=false; C-21/C-01 blocked; DIR-2 not triggered; verify/browser/external/Telegram/Oracle/ysna/main/C-01 not executed
