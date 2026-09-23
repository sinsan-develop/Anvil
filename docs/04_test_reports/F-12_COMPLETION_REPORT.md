# F-12 Developer 결과 — Provider Settings API/BFF

## 판정

R2 개발자 결과 `COMPLETED` — 승인된 exact10 로컬 owner/API/BFF 계약과 관련 회귀를 구현·검증했다. 최종 Package 수용과 실제 환경 검증은 Main 소유이며, 이 판정은 브라우저·Provider·DB·배포 완료를 뜻하지 않는다.

R1 역사적 판정은 `INCOMPLETE`였다. 당시 exact8 범위에는 F-01 current-profile selection/version CAS API가 없어 기존 profile `:revise`를 501로 닫았다. Main의 R2 WorkInstruction 및 lease revision으로 F-01 공개 owner API가 exact10에 추가되어 이 공백을 보완했다. R1의 정식 `FAILURE_REPORT` 횟수는 0회다.

## 기준·시작 상태

- Work Package `F-12`, 담당 `developer-primary-f12-r1`; branch `codex/f12-provider-settings`; 시작 HEAD `697ae08d2aa63952d8efef5c5761458110500745`; 시작 `git status --short` clean. base main `798ed952ad6900c87db2c0b2e1d6f71c2755f69c`.
- 활성 worker `worker-lease-f12-r1-20260924-001`, execution fence `f12-r1-execution-fence-epoch-1-798ed952ad6900c8`; write `write-lease-f12-r1-20260924-001`, write fence `f12-r1-write-fence-epoch-1-db2c0b2e1d6f71c2`; exact8 scope와 2026-09-24 16:04+09:00 만료를 확인했다.
- SHA-256: 설계 `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`; 계획 `A10A01759496511AF32354BACE84C1FCEF135A57A07247A45B8228E2A1CE0477`; 매트릭스 `999A906EF7D69835EE8C5EFAFD9DE72885BEF5AB3C7A2C1B47B58D7A9628A0BB`; 테스트계획 `9A6AFC5FCDD89C351D2D6E98551472BA362212C8C863E2542BFA93B1723DA102`; 운영규칙 `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`; WorkInstruction `9344D2E06C86E882FA151118DC6E79A7A3508DD14F76AFF487B8CA082C0B3A1E`; A-10 catalog `90C4A7C410FB73ED916890FC4736540537BF3B7C55D9D2BF692E5E1331081DEF`.
- `docs/progress/build-progress.json`/`BUILD_HANDOFF.md`는 F-12 ACTIVE, 해당 lease, `DEVELOPER_PRIMARY_IMPLEMENT_F12_EXACT8`를 가리킨다. Developer는 control/progress를 수정하지 않았다.

R2 재개 기준: WorkInstruction SHA-256 `8AB0DB1BD336A313B19DD266991BBBC1A6F4819AA5238A358319F0B90F6046B3` (R1 `9344D2...`에서 개정), progress sequence `1441`, `DEVELOPER_PRIMARY_IMPLEMENT_F12_R2_EXACT10`; branch 동일, 재개 HEAD `dc90a8780e8a6478eada39e6013b9d53ece9f966`. 재개 status는 R1 exact8 중 runtime tracked 1개 수정 + 7개 untracked였으며 새 F-01 두 경로는 clean/부재였다. 활성 worker `worker-lease-f12-r1-20260924-001` execution fence 동일; 새 write `write-lease-f12-r2-20260924-001`, epoch 2, `f12-r2-write-fence-epoch-2-798ed952ad6900c8`, scope exact10, 만료 2026-09-24 16:04+09:00. Main이 G-05 PASS 및 checkpoint push를 완료했다고 전달했으며 Developer는 Git/control/progress를 수정하지 않았다.

## 변경 전→후 및 파일

- `packages/provider_settings/projection.py`: 신규. F-01 canonical 9 순서, D-11/F-02 model/route, SecretRef, egress를 명시적 공개 field로만 투영한다. A-10 표시 역할 `main/tester`는 D-11 역할로 임의 변환하지 않고 `ROLE_NOT_SUPPORTED_BY_D11`을 표시한다. 역할별 route는 같은 provider의 임의 준비된 모델이 아닌 해당 route의 정확한 model hash와 host 증거가 일치할 때만 enabled다.
- `packages/provider_settings/service.py`: 신규. F-01 `ProviderCatalog`, D-11 `ModelRegistry`, F-02 `DiscoveryRouter`를 재사용한다. host observation + F-01 발행 egress/Secret decision + D-11 active route/fresh model이 일치해야 `AVAILABLE`이다. 조회 중 `evaluate_egress`/`broker_decision`을 다시 호출해 audit를 변경하지 않는다. R2 독립 검토 후에는 F-01 공개 `validate_decision`에서 정확한 저장 결정 payload/hash를 확인하고 요청 hash도 대조해 audit 메타데이터만 일치하는 위조 ALLOW를 차단한다. Secret revoke/expiry, egress drift, stale probe, 미승인 route는 차단한다. configure/refresh/route validate/activate/Secret rotate/revoke는 각 owner가 최종 상태를 검사한다. activation capture는 브라우저 입력에서 받지 않고 host callback으로만 받는다. R2에서는 로컬 `_profile` authority를 제거하고 F-01의 현재 선택을 매번 읽으며, 최초·교체 `:revise` 모두 owner CAS를 소비한다.
- `packages/api/provider_settings.py`: 신규. canonical registry의 provider, routing, egress, Secret endpoint application port. 인증된 project/environment/actor, expected version, target hash, reason을 owner 호출에 보존한다. 브라우저의 credential/endpoint/probe/approval 자체 증거 필드를 거부한다. Host capability 미결선은 501이다.
- `packages/api/runtime.py`: 기존 기본 Provider status read는 유지한다. 명시적 `provider_settings_owner` 주입 때만 F-12 query/command port를 결선하며 기존 port 충돌을 거부한다.
- `packages/bff/provider_settings.py`: 신규. 브라우저 `/api/...` same-origin URL만 허용하고 서버 전용 transport를 사용한다. 응답 field allowlist와 민감 문자열 검사를 적용하며 `:activate` 성공 응답의 공개 `activation_hash`를 보존한다.
- `tests/provider_settings/test_f12_settings.py`: 신규. 실제 F-01/D-11/F-02 객체 및 제한된 host double을 통한 canonical 9, 역할 불일치, Secret revoke, stale/drift, positive AVAILABLE, F-01/D-11 command/CAS/host approval을 검증한다. 추가로 정확한 route model hash, foreign/forged profile 차단, 읽기 전용 audit 불변, 같은 초의 drift 재평가와 위조 decision 차단을 검증한다.
- `tests/api/test_f12_provider_settings_api.py`: 신규. TestClient로 권한·scope·CSRF·Origin·브라우저 자체 증거 거부, runtime 기본 읽기 회귀, host configure 및 routing validate/activate, BFF same-origin/비노출과 활성화 hash 보존을 검증한다.
- `packages/provider_catalog/service.py` (R2 추가): F-01 공개 read-only scope/profile/decision validation과 current selection, lock 보호 원자적 version/hash CAS를 추가했다. 결정은 `_requests`의 정확한 owner 저장 payload/hash에 맞아야 하며 조회는 audit/state를 변경하지 않는다. 선택 시 등록 profile의 exact hash와 host 승인 binding을 대조하고 이전 Run pin은 그대로 둔다.
- `tests/provider_catalog/test_f12_profile_selection.py` (R2 추가): 최초·교체 선택, stale version/hash, 승인 binding 불일치, foreign/forged handle, 경쟁 CAS 단일 승자, old/new Run pin, 정확한 owner 결정 검증을 확인한다.
- 이 보고서 `docs/04_test_reports/F-12_COMPLETION_REPORT.md`: 신규. 최종 변경은 exact10 경로만이며 control/progress 파일은 수정하지 않았다.

## 명령·종료 코드·실제 결과

| 명령 | exit | 결과 |
|---|---:|---|
| `git branch --show-current`, `git rev-parse HEAD`, `git status --short` | 0 | 지정 branch/HEAD, 시작 clean. Git global ignore 접근 경고만 있음. |
| `python -m pytest tests/provider_settings/test_f12_settings.py -q` | 1 | 기본 `python` 명령 없음. |
| `py -3 -m pytest tests/provider_settings/test_f12_settings.py -q` | 1 | launcher에 설치 Python 없음. |
| `D:\Project\Anvil\.venv\Scripts\python.exe -m pytest ...` | 1 | 해당 venv에 pytest 없음. |
| `uv run --offline --with pytest --with 'httpx2>=2,<3' python -m pytest tests/provider_settings/test_f12_settings.py -q` | 1 | sandbox 내 uv cache 접근 거부. 승인 실행에서 격리 worktree `.venv` 자동 생성 후 기대 RED: `packages.provider_settings.service` 미존재로 collection 실패. |
| `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -B -m pytest -p no:cacheprovider --basetemp D:\tmp\anvil-f12-pytest tests/provider_settings/test_f12_settings.py -q` | RED 1 → GREEN 0 | projection 초기 2 실패, positive host 경로 부재, command 메서드 부재, revoke allowlist, routing revoke 반영 등 각 기대 RED를 관찰하고 수정 후 8 PASS. |
| 같은 Python/옵션으로 `tests/api/test_f12_provider_settings_api.py -q` | RED 1 → GREEN 0 | API port 부재, runtime owner 결선 부재, host configure 미결선, BFF public field 안의 endpoint 노출 등을 RED로 관찰한 후 9 PASS. |
| 같은 Python/옵션으로 `tests/provider_settings/test_f12_settings.py -q` — 3 Important 및 read audit 재작업 | RED 1 → GREEN 0 | 정확한 route model hash 누락 시 다른 모델 때문에 enabled=true, foreign profile 수용, 읽기에서 F-01 audit sequence 3→5 증가를 각각 재현했다. 보완 후 10 PASS. |
| 같은 Python/옵션으로 `tests/api/test_f12_provider_settings_api.py -q` — `activation_hash` 재작업 | RED 1 → GREEN 0 | BFF `:activate`가 성공 응답의 `activation_hash`를 버리는 실패를 재현했다. allowlist 보완 후 10 PASS; TestClient→BFF 경유 성공 응답도 확인했다. |
| `& 'D:\tmp\anvil-main-integration\.venv\Scripts\python.exe' -B -m pytest -p no:cacheprovider --basetemp 'D:\tmp\anvil-f12-pytest' tests/provider_settings tests/api tests/provider_catalog tests/model_registry tests/llm_gateway tests/providers -q` | 0 | 재작업 후 최종 재실행 관련 회귀 966 PASS, 12.63초. |
| 같은 Python/옵션으로 `tests/knowledge/test_model_registry_d11.py -q` | 0 | 86 PASS, 1.55초 (최종 F-12 수정 직전 D-11 단독 확인). |
| 같은 Python/옵션으로 `-q` (전체 pytest) | 1 | collection에서 16 ERROR: `yaml`/`httpx` 누락, 중복 test module basename, fixture `src` import 실패. 테스트 본문 실행 전 중단. Main이 clean main 동일 Python·명령에서 같은 16 파일의 collection error를 독립 재현했다고 전달했다. 따라서 966 PASS를 전체 suite PASS로 확대하지 않는다. |
| 7개 Python 파일 `ast.parse` | 0 | `AST_OK 7`. |
| `git diff --check` | 0 | 공백 오류 없음 (tracked diff 대상). |

R2 명령·결과 (`D:\tmp\anvil-main-integration\.venv\Scripts\python.exe` 및 `-B -m pytest -p no:cacheprovider --basetemp 'D:\tmp\anvil-f12-r2-pytest'` 공통):

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `... tests/provider_catalog/test_f12_profile_selection.py -q` | RED 1 → GREEN 0 | 신규 F-01 API 부재로 4 FAIL(`profile_selection`, `validate_profile`); 구현 후 4 PASS. 추가 hostile evidence callback 테스트가 RED 1 FAIL(위조 객체 비교로 선택됨)→GREEN 5 PASS. |
| `... tests/provider_settings/test_f12_settings.py -q` | RED 1 → GREEN 0 | R1 `:revise`의 initial selection hash 거부 2 FAIL; owner 선택 연결 뒤 projection signature 2 FAIL; 보완 후 11 PASS. 추가 foreign catalog scope 테스트는 최초 RED 1 FAIL→GREEN 12 PASS. |
| `... tests/api/test_f12_provider_settings_api.py -q` | RED 1 → GREEN 0 | 실제 TestClient→BFF에서 `:revise` 응답의 `version` 누락 1 FAIL; 공개 allowlist 보완 후 11 PASS. 브라우저 approval/profile payload self-attestation 거부와 stale CAS 409 포함. |
| `... tests/provider_settings/test_f12_settings.py::test_host_verified_connection_egress_secret_and_active_route_enable_only_exact_model -q` | RED 1 → GREEN 0 | 실제 F-01 BLOCKED egress 결정의 `decision`만 ALLOW로 바꾸고 재해시한 Snapshot이 R2 초안에서 `enabled=True`로 승격됨을 재현(1 FAIL). F-01 exact stored decision 검증 연결 후 1 PASS, audit 불변. |
| `... tests/provider_catalog/test_f12_profile_selection.py tests/provider_settings/test_f12_settings.py -q` | 0 | owner exact decision 검증 및 위조 거부를 포함해 18 PASS. |
| `& 'D:\tmp\anvil-main-integration\.venv\Scripts\python.exe' -B -m pytest -p no:cacheprovider --basetemp 'D:\tmp\anvil-f12-r2-pytest' tests/provider_settings tests/api tests/provider_catalog tests/model_registry tests/llm_gateway tests/providers -q` | 0 | R2 Important 재작업 후 최종 재실행 975 PASS, 12.88초. R1 baseline 966 PASS 대비 신규 9건. |
| 같은 Python/옵션으로 `-q` (전체 pytest) | 1 | collection 16 ERROR에서 본문 실행 전 중단. R1에서 Main이 clean main에 동일한 16개 collection error를 독립 재현함. `yaml`/`httpx` 누락, test module basename 충돌, fixture `src` import 문제. 전체 suite PASS로 승격하지 않는다. |
| 9개 Python 파일 `ast.parse` | 0 | `AST_OK 9`. |
| `git diff --check` | 0 | tracked diff 공백 오류 없음; 새 untracked 파일은 별도 pytest/AST로 검증. |
| `& 'D:\tmp\anvil-main-integration\.venv\Scripts\python.exe' -B scripts/check_f12_progress.py` | 0 | `G-05 project progress contract: PASS sequence=1441 reporting=AUTO_CONTINUE`. Developer는 control/progress를 쓰지 않았다. |
| `git status --short --untracked-files=all` | 0 | 변경은 exact10만 남음. Git global ignore 접근 거부 경고는 status 판정과 무관한 환경 경고. |

오류 횟수: F-12 동일 근본 원인의 유효 정식 실패보고 0회. 위 RED와 환경/collection 실패는 구현 실패 lineage로 계상하지 않는다. 임시 `.venv`, `.pytest_cache`, F-12 두 경로의 `__pycache__`는 실제 격리 worktree 경로를 검증한 뒤 각각 삭제했다. `.pytest_cache`는 최초 일반 권한 삭제가 거부되어 정확한 경로만 승인 실행으로 삭제했다. 테스트에는 `-B`, `-p no:cacheprovider`, 지정 `--basetemp`를 사용했다.

## 검증 경계·미검증·다음 조치

- 실행한 증거는 Python owner 객체·TestClient·BFF transport double의 로컬 계약이다. 실제 Provider 네트워크/credential material/Secret Broker child injection, F-01 승인 사건의 실재, DB, WSL-server, PostgreSQL 15/18, 운영 배포, 실제 브라우저 Network는 `NOT_EXECUTED`다. Host callback의 연결 관측은 테스트 double이며 실제 연결 성공 증거가 아니다.
- 양성 `AVAILABLE`은 host가 이미 F-01에서 취득한 immutable egress/broker decision handle이 owner의 저장 결정과 정확히 같고, request hash, 유효 SecretRef, D-11 active model hash와 연결 관측도 일치할 때만 나온다. 조회는 F-01 decision을 새로 발행하지 않는다. 같은 초에 host 관측이 drift로 바뀐 회귀와 위조 handle 회귀는 audit sequence 불변 및 차단을 확인했다. `mask`/`payload_hash`를 필요로 하는 egress 형태의 양성 경로는 현재 F-12 관측 계약에 없으며 fail-closed다.
- R2 Important 보완: audit의 kind/request_id/request_hash/reason만으로는 결정 본문의 `decision` 위조를 검출할 수 없었다. F-01 공개 read-only `validate_decision`이 저장된 exact payload/hash를 대조하며 F-12는 이 반환값만 평가한다. BLOCKED→위조 ALLOW 재현은 `OWNER_EVIDENCE_INVALID`로 차단되고 audit는 byte-identical했다. API/BFF에는 결정 원문을 내보내지 않는다.
- `AV-UI-003`의 실제 U-11 Settings 화면 E-SHOT/E-DEC는 `NOT_EXECUTED`; 화면은 F-12 write scope 밖이다. `AV-OPS-010`/`AV-FLOW-019`도 로컬 API/BFF 계약 범위만 검증했다.
- `:configure`, `:test`, `:refresh-models`, `:validate`, `:activate`, Secret rotate/revoke는 host owner·증거 미주입 때 명시적 501/blocked다. Host 주입 양성 경로는 F-01/D-11 owner method를 호출한다. `:test`는 host route observation 계약을 소비하며 실제 네트워크 probe를 F-12가 수행하지 않는다.
- R1의 기존 profile `:revise` 501 제한과 audit 기반 profile 소유 검사는 R2에서 제거했다. F-01 `current_profile`/`profile_selection`/`validate_profile`이 read-only owner 상태를 제공한다. Host operation은 이미 F-01에 등록된 immutable profile handle, 해당 exact hash, 등록 때의 human approval ID만 반환하며 F-01 `select_profile`이 세 항목과 선택 version/hash를 lock 안에서 검사한다. 브라우저 body에서 profile/approval ID를 받지 않는다. 조회와 profile 선택은 기존 Run pin을 소급 변경하지 않는다.
- F-01 선택 상태는 현재 프로세스 메모리 계약이다. 재시작·다중 인스턴스·DB 영속성은 F-14 별도 acceptance이며 F-12의 운영 준비 완료로 주장하지 않는다.
- rollback: Main이 이 branch의 R2 exact10 diff를 검토해 F-12 API/BFF·service와 F-01 owner profile 선택/CAS·decision 검증 변경을 함께 되돌리며, 기존 clean main에는 F-12 변경이 없고 Developer는 commit/push/PR/merge 또는 control/progress 변경을 하지 않았으므로 lease 회수와 후속 통제는 Main이 수행한다.
