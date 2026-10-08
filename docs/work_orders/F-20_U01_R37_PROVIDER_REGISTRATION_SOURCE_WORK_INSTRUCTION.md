# F-20/U-01 R37 Provider 등록 상태 source WorkInstruction

- 책임: 단일 `developer-primary`; Main은 lease·검토·Git·WSL QA 소유.
- 기준: 승인된 `Anvil_설계서_v2.md` §29.2, `Anvil_작업계획서_v1.md` U-01, R37 계획 문서. 현재 branch 하나만 유지하며 canonical epoch52 worker/write token의 유효성·exact4를 먼저 확인한다.
- 목적: OIDC host 고정 scope의 Queue source에 기존 `ProviderStatusService(environment)`를 넣어 현재 host 설정의 canonical 9개 Provider 등록 상태를 기존 Dashboard `providers` 필드에 정직하게 전달한다.
- 제품 write lease exact4: `apps/api/anvil_api/oidc_process.py`, `tests/api/test_f20_u01_r37_provider_host_binding.py`, `tests/integration/test_f20_u01_r37_provider_host_pg15.py`, `docs/04_test_reports/F-20_U01_R37_PROVIDER_REGISTRATION_SOURCE_RESULT.md`.
- 금지: 공개 필드·route·권한·UI·DB schema·Secret 저장/전송 변경, 외부 Provider network 호출, 임의 키 대체, Provider 건강 `HEALTHY` 승격, 제품 exact4 밖 수정, Main `docs/WORK_STATUS.md` 수정, commit/push, WSL-server/ysna/Production 접근.
- TDD: 기존 host의 `providers=[]`를 재현해 새 기대 9개 RED를 기록하고, 최소 결선으로 GREEN. 무설정/설정/설정 변경·scope 거부·권한403·Secret 비노출·Health `UNKNOWN`·Queue/Run/Agent/Alert 회귀를 확인한다.
- 로컬 검증: 집중 테스트와 기존 Provider/OIDC/Operations/Dashboard 회귀, Python compile, G-05, diff-check. PG15 opt-in은 Main 전용이며 로컬 SKIP을 PASS로 집계하지 않는다.
- 완료보고: branch/착수 HEAD·기준 문서 hash·dual token, 변경 전후 diff exact4, 명령/exit/실제 결과, 오류 횟수, 미실행/잔여 위험, rollback, Main status 보존을 판정→판단 이유→조치로 기록한다.
