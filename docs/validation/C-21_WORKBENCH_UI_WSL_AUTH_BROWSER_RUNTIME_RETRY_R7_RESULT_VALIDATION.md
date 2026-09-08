# C-21 Workbench UI WSL authenticated browser runtime retry R7 validation

- seq657~662 append-only; seq1~656 byte-preserved
- exact12/cumulative261 hash는 Main 독립 helper 재검산값에 고정
- native wrapper는 stdout과 integer exit code를 분리하고 caller는 `.ExitCode`만 판정
- wrapper self-check PASS; R6 stdout/exit capture root `RESOLVED`
- preflight PASS; deploy1/exit0; verify1/exit0; PG15 browser1/exit1; PG18RC browser0; cleanup1/exit0; retry0
- primary `BROWSER_ACCEPTANCE_FAILED_R7`; diagnostic `BROWSER_RECEIPT_NOT_PERSISTED_R7`; product defect not established
- verification authenticated SSE/Last-Event-ID/same-origin PASS for both targets; browser sub-predicate is not inferred
- current JSON4/image metadata2 secret-safe; post-cleanup exact residue0
- status `FAILED_R7_WSL_DEVELOPMENT_VALIDATION_EVIDENCE_INSUFFICIENT`
