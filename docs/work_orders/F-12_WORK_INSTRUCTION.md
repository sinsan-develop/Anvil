# F-12 WorkInstruction — Provider Settings·Egress·Secret·Execution Mode·routing API/BFF

## 승인 기준과 목적

- 작업자: `developer-primary-f12-r1`; branch `codex/f12-provider-settings`; base main `798ed952ad6900c87db2c0b2e1d6f71c2755f69c`.
- 상위 기준: `Anvil_설계서_v2.md` §15.9, §16, §49.7~49.8; `Anvil_작업계획서_v1.md` F-12; `Anvil_통합검증매트릭스_v1.md` AV-UI-003·AV-OPS-010·AV-FLOW-019; `Anvil_테스트계획서_v1.md`; `docs/governance/ANVIL_OPERATING_RULES.md`.
- 구체화 기준: `docs/superpowers/specs/2026-08-12-a10-provider-routing.md`, `docs/architecture/a10/A-10_PROVIDER_ROUTING_CATALOG.json` SHA-256 `90C4A7C410FB73ED916890FC4736540537BF3B7C55D9D2BF692E5E1331081DEF`. A-10은 정적 계약이므로 runtime 성공 증거로 승격하지 않는다.
- 결과: 9개 Provider의 canonical 순서·상태·비활성 사유·다음 조치가 Settings/Execution Mode/routing 조회에서 일치하고, F-01 egress/SecretRef 및 D-11/F-02 모델·routing 소유 증거를 소비하는 API/BFF 계약을 구현한다. 실제 U-11 Settings 화면은 구현하지 않는다.

## R1 제품 write scope exact8 (2026-09-24 04:04 KST)

1. `packages/provider_settings/projection.py` — F-01/D-11/F-02 증거를 검증하고 공개 field allowlist만 생성.
2. `packages/provider_settings/service.py` — host-owned 소유자들을 조정하는 read/command facade; 새 shadow authority 금지.
3. `packages/api/provider_settings.py` — canonical registry에 이미 선언된 Settings·routing endpoint용 application port.
4. `packages/api/runtime.py` — trusted owner가 주입될 때 F-12 포트 결선; 없는 production runtime은 허위 성공을 반환하지 않는다. 기존 task/provider 기본 읽기 회귀 보존.
5. `packages/bff/provider_settings.py` — 브라우저 same-origin `/api/...` 경로와 서버 전용 proxy 요청·공개 응답 제한.
6. `tests/provider_settings/test_f12_settings.py` — 실제 소유 객체와 제한된 host double로 projection·mutation 계약 RED→GREEN.
7. `tests/api/test_f12_provider_settings_api.py` — TestClient 권한·CSRF·Origin·scope·BFF·endpoint 비노출·canonical 9개 통합 계약.
8. `docs/04_test_reports/F-12_COMPLETION_REPORT.md` — 정확한 명령/exit, diff, 미검증, rollback.

위 외 제품·control/progress·Git 파일 수정 금지. 경로 추가가 기술적으로 불가피하면 Main에게 근거와 영향만 보고하고 lease scope revision 전에는 write하지 않는다.

## 구현 계약

1. 기존 `packages/provider_catalog/service.py`의 F-01 `ProviderCatalog`와 `packages/knowledge/model_registry.py`의 D-11 `ModelRegistry`, `packages/model_registry/service.py`의 F-02 `DiscoveryRouter`를 소유자로 재사용한다. F-01/D-11 내부 상태를 읽거나 새 DB/Secret 저장소를 만들지 않는다. Host observation 등록은 실제 네트워크 probe나 Secret material 주입이 아니다.
2. `cerebras,groq,mistral,openrouter,upstage,gemini,anthropic,openai,ollama` 순서를 고정한다. 연결·credential·필수 capability·fresh model probe/benchmark·egress가 확인되지 않으면 숨기거나 추정해 활성화하지 않고 stable reason와 next action을 반환한다. 모델 ID만으로 capability를 추정하지 않는다. stale/drift는 `BLOCKED_CAPABILITY_DRIFT` 등 실제 소유자 결과로 표시한다.
3. Browser-facing payload는 명시적 field allowlist로 생성한다. SecretRef의 id/version/status 및 마스킹 상태만 표시하고 값·token·API key·raw endpoint/IP·provider raw error·unauthorized path는 오류/로그/API/BFF 어디에도 싣지 않는다. `REVOKED|EXPIRED`는 routing 차단이다.
4. `DataEgressProfile`의 `local_only|metadata_only|approved_paths|masked_content`와 allowlist/excluded paths/승인 binding을 F-01 판정으로 재사용한다. profile 확대나 local→cloud fallback을 묵인하지 않는다. 기존 Run snapshot은 변경하지 않고 활성화는 다음 snapshot부터 적용한다.
5. Configure/test/refresh-models/route validate·activate는 브라우저가 credential 값·endpoint·probe 결과·human approval ID를 자체 확정할 수 없게 한다. Host-authenticated owner/evidence가 없으면 501/명시적 blocked 상태로 닫힌다. D-11 `capture_activation`과 `activate`의 version CAS 및 HUMAN/MAIN_POLICY 승인 증거를 우회하지 않는다. 역할 저장은 D-11이 지원하는 정확한 runtime role ID에서만 허용한다. A-10 표시 역할 `main/tester`와 D-11 runtime role 집합 차이는 임의 매핑하지 말고 미지원 사유·미검증 범위로 명시한다.
6. 기존 canonical API registry의 경로만 사용한다. `ApplicationRequest`의 인증된 project/environment/actor, expected_version/target_hash/reason을 소유자 호출에 보존한다. 기존 FastAPI mutation CSRF·Origin/Host·권한 검증을 우회하지 않는다. 브라우저는 same-origin 상대 URL만 사용하고 내부 base는 서버 BFF에만 둔다.
7. 실제 API/Provider network, Secret material, DB migration, 화면, WSL 배포, 운영 전환은 수행하지 않는다. 합성 TestClient/host seam 증거를 `E-NET` 실환경 PASS로 표시하지 않는다. WSL-server 정식 테스트는 별도 격리 실행/정리와 기록을 Main이 담당한다.

## TDD·검증·완료보고

- 각 행위마다 실패 테스트를 먼저 실행해 예상 RED를 기록하고 최소 구현 후 GREEN, 관련 회귀를 실행한다. baseline `tests/api tests/providers tests/provider_catalog tests/model_registry tests/llm_gateway`: 946 PASS, exit 0.
- 반드시 권한 없는 변경·browser-supplied secret/endpoint/evidence, stale model/secret/egress, 승인 없는 activation, 역할 ID 불일치, 9개 순서와 비활성 사유, 원문 비노출, URL same-origin을 테스트한다.
- 최소 `tests/provider_settings tests/api tests/provider_catalog tests/model_registry tests/llm_gateway tests/providers` 회귀, AST/type·diff check. DB/browser/실제 WSL/Provider/Secret/egress가 실행되지 않았다면 미검증으로 표시한다.
- 완료보고는 기준 hash, 시작 HEAD/status, 변경 전후, exact8 파일, 실제 명령/exit, 오류 횟수, 테스트/skip, 잔여 위험, rollback 및 progress 미갱신 여부를 포함한다. Developer는 commit/push/PR/merge 금지.
- 이 Package의 G-05 진입점은 `scripts/check_f12_progress.py`이다. 기존 대형 `scripts/check_project_progress.py`는 byte-identical로 보존하고 F-12 mode만 얇은 wrapper가 검증한다.

## R2 Main 내부 보완·write scope revision (2026-09-24)

R1 독립 검토에서 기존 DataEgressProfile의 안전한 전환에 F-01 소유 current-profile 선택·CAS 계약이 없다는 Important finding이 확인되었다. F-12의 승인된 Egress API/BFF 계약을 충족하기 위한 내부 소유자 보완이며 기능 범위·요구사항·중요 위험을 확대하지 않는다. 실제 profile 확대의 human approval은 여전히 필수이고 브라우저 입력으로 증명할 수 없다. R1 exact8 구현은 보존하고 다음 두 경로를 추가해 R2 제품 write scope를 exact10으로 한다.

9. `packages/provider_catalog/service.py` — F-01이 직접 소유하는 current-profile 조회/원자적 선택·version CAS 및 등록 profile 소유 검증. 새 profile의 정확한 hash와 이미 host-authenticated human approval binding을 확인하고 이전 Run pin 불변을 유지한다.
10. `tests/provider_catalog/test_f12_profile_selection.py` — F-01 owner의 승인 binding, stale version/hash 거부, scope/handle 검증, 기존 Run pin 불변을 RED→GREEN으로 고정한다.

R2에서는 F-12 `service.py`의 프로세스 로컬 `_profile` 교체를 제거하고 F-01 공개 선택 API만 소비한다. 최초 profile 등록과 기존 profile 전환 모두 동일한 owner CAS를 통과한다. `:revise` 브라우저 body는 approval ID·profile payload·Secret/endpoint를 받지 않으며 host callback에서만 exact evidence를 받는다. 조회는 F-01의 read-only API만 호출하고 감사/egress 결정 기록을 새로 만들지 않는다. F-01 내부 상태는 메모리 계약이므로 재시작·다중 인스턴스·DB 영속성은 F-14에서 별도 acceptance로 증명하고 F-12에서 운영 준비 완료로 주장하지 않는다.

R2 write lease는 기존 R1 write lease를 회수하고 새 epoch/token으로 발행한 뒤에만 유효하다. Main이 scope/approval binding/progress를 갱신하고 G-05를 통과시키기 전 두 추가 경로의 쓰기는 금지한다.
