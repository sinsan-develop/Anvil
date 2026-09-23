# F-12 독립 검토 및 Main 인수 판정

## 판정

`ACCEPT` — F-12 로컬 Provider Settings·Egress·Secret·Execution Mode·routing API/BFF 계약에 대해 Critical 0, 미해결 Important 0, Minor 0. 실제 U-11 화면·Provider network·Secret material·DB·브라우저 Network·운영 배포 및 F-14 영속성은 이 판정에 포함되지 않는다.

## 기준과 변경 범위

- 기준 `main` `798ed952ad6900c87db2c0b2e1d6f71c2755f69c`, 작업 branch `codex/f12-provider-settings`, 제품 checkpoint `276548a1d28bbe958f0c706d436668c46b4599bc`.
- R1 제품 exact8에 대한 독립 검토에서 기존 egress profile 전환의 F-01 owner CAS 부재, 역할별 정확한 model hash 검증, foreign profile scope, BFF activation hash 누락을 지적했다. R2 WI·write lease epoch2로 F-01 소유 API와 테스트 2경로를 추가해 제품 exact10으로 개정했다.
- R2 재검토에서 F-01이 거부한 decision을 ALLOW로 위조해 재해시하면 F-12 상태가 잘못 활성화되는 Important를 재현·지적했다. F-01 공개 read-only `validate_decision`이 저장된 정확한 payload/hash를 대조하고 F-12가 그 결과만 소비하도록 수정했다. 위조 ALLOW 회귀와 감사 기록 불변 테스트를 확인했다.
- 최종 독립 재검토는 위 지적 모두 해소, 신규 Critical/Important 없음, 로컬 계약 기준 병합 가능으로 판정했다. 기존 `main/tester` UI label과 D-11 runtime role은 임의 매핑하지 않고 미지원으로 유지한다.

## Main 독립 검증

| 환경·명령 | 종료 | 실제 결과 |
|---|---:|---|
| Windows 격리 F-12 checkout에서 `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider --basetemp D:\Project\Anvil\.codex-sandbox\.f12-r2-main-final-20260924 tests/provider_settings tests/api tests/provider_catalog tests/model_registry tests/llm_gateway tests/providers` | 0 | 975 PASS, 12.09초. 지정 temp 제거 확인. |
| WSL-server의 임시 Git checkout `276548a1...`에서 `uv run --offline --group dev python -B -m pytest -q -p no:cacheprovider --basetemp /tmp/anvil-f12-verify.4nrQMKUs/pytest tests/provider_settings tests/api tests/provider_catalog tests/model_registry tests/llm_gateway tests/providers` | 0 | CPython 3.14.3, 975 PASS, 12.47초. 체크아웃·venv·pytest 디렉터리 제거 및 잔여 F-12 컨테이너 0 확인. |
| `git diff --cached --check` (제품 exact10 checkpoint 전) | 0 | 공백 오류 없음. staged path 정확히 10개. |
| `python -B scripts/check_f12_progress.py` (R2 control checkpoint) | 0 | G-05 PASS, sequence 1441. 최종 projection은 별도 재검증한다. |

전체 pytest는 clean `main`에서도 동일한 collection 16 ERROR(`yaml`/`httpx` 누락, 중복 모듈명, fixture import)를 재현했다. 975 PASS를 전체 suite PASS로 확대하지 않는다. F-12는 실제 화면을 만들지 않는다(U-11 소유). AV-UI-003 E-SHOT/E-DEC와 실제 Network evidence는 `NOT_EXECUTED`; F-12의 AV-OPS-010·AV-FLOW-019는 로컬·WSL TestClient 계약만 확인했다. F-01 current-profile state는 메모리 구현이므로 재시작 복구·다중 인스턴스 CAS·DB 영속성은 F-14 acceptance로 남긴다. 실제 profile 확대는 host-authenticated human approval이 계속 필요하며 이번 synthetic host callback은 그 실재를 증명하지 않는다.

## 영향·다음 조치·rollback

변경은 계획된 F-12 제품 exact10과 control/progress 범위에 한정된다. 기존 Provider status 기본 읽기는 host owner 미주입 때 유지하며, 새 쓰기 경로는 인증된 scope·CSRF·Origin과 host evidence가 없으면 닫힌다. 서버 내부 endpoint/Secret value는 공개 BFF field allowlist에 넣지 않는다. Main은 최종 G-05·검증·PR 검사를 통과한 경우에만 같은 branch를 `main`에 병합한다. Rollback은 F-12 merge commit 이전의 검증된 `main`으로 되돌리는 정상 Git 복구 절차이며, 별도 dirty 자료를 삭제하지 않는다.
