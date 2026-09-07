# WI-C-21-A13-HISTORICAL-MODULE-ISOLATION-20260908-001

- step: `A13-HISTORICAL-MODULE-ISOLATION-R1`
- subject: `C-21/A13-HISTORICAL-MODULE-ISOLATION-R1`
- parent: `6e06810ea02b72e5642da8258cd0ae5fb6d87dc6`
- owner: `developer-primary`
- scope: `tests/tooling/test_a13_repository_scan.py`의 historical import 격리와 exact13 successor evidence.
- invariant: seq1~596, historical evidence, 제품 코드는 불변이다.
- required: 성공 및 예외 경로에서 exact package module cache와 `sys.path`를 복원한다.
- verification: RED/GREEN, A13 전체, 전체 tooling, focused seq602, live checker, generated5 determinism, historical raw prefix, Git exact/direct-child/clean.
- excluded: Provider, Telegram, WSL, ysna, main merge, push.
- terminal: `READY_FOR_INDEPENDENT_C21_WORKBENCH_UI_WSL_ACCEPTANCE`.
- next: `INDEPENDENT_C21_WORKBENCH_UI_WSL_ACCEPTANCE`.
