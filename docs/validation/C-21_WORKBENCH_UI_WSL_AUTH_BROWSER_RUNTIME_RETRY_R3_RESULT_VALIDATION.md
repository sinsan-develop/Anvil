# C-21 Workbench UI WSL authenticated browser runtime retry R3 validation

- attempt number: 3
- preflight: PASS
- deploy: FAIL / exit126 / CONTROL_RUNTIME_DIRECT_EXEC_PERMISSION_DENIED_R3
- verify, PG15 browser, PG18RC browser: NOT_EXECUTED
- cleanup: exact1 attempted / FAIL / exit126
- postcondition: application and env byte-identical; approved residue0
- classification: WSL_DEVELOPMENT_VALIDATION
- acceptance: false
