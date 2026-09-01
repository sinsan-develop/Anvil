# WI-C-21-OPS-R2 — C-21 최소 운영 검증 재개 WorkInstruction

## 1. 목적과 기준선

이 WorkInstruction은 C-21의 정적·내부 런타임 확인 이후 남은 최소 운영 경계만 검증한다. 대상은 승인된 검증 환경의 Provider non-billing capability/health probe, Telegram signed POST 1회, 인증된 SSE와 `Last-Event-ID` 재개, credential 비노출, DB side effect 처리, `EvidenceManifest` 기록이다.

- 작업 패키지: `C-21-OPS-R2`
- 선행 보고서: `docs/04_test_reports/C-21_OPERATIONAL_VALIDATION_REPORT.md`
- 실행 주체: Main Agent가 승인 범위·증거·중단을 관리하고, 지정된 실행 agent가 명령을 수행한다.
- 적용 기준: 현재 승인된 설계서·작업계획서·통합검증매트릭스·테스트계획서 및 C-21 predecessor hash
- 운영 대상: `ysna-server`의 Anvil 검증 환경과 `anvil.sinsan.kr` same-origin 경계

## 2. 허용 범위

### 2.1 Provider probe

- 9개 Provider(CEREBRAS, GROQ, MISTRAL, OPENROUTER, UPSTAGE, GEMINI, ANTHROPIC, OPENAI, OLLAMA)의 configured 상태만 조회한다.
- credential 원문·환경변수 값·Authorization header·응답 secret은 출력·저장·EvidenceManifest 기록을 하지 않는다.
- Provider별 capability/health endpoint 또는 비용이 발생하지 않는 metadata probe만 사용한다.
- 모델 생성, completion/chat 호출, embedding·이미지·파일 업로드·과금 가능 요청, fallback 실행은 금지한다.
- 결과는 `configured`, `credential_present`(boolean 또는 masked state), `health`, `capability`, `drift`, `probe_timestamp`처럼 비밀값이 없는 구조로 기록한다.

### 2.2 Telegram signed POST 1회

- 승인된 test fixture 한 건만 `POST /integrations/telegram/webhook`으로 전송한다.
- 서명·timestamp/nonce·allowlist를 현재 운영 설정으로 생성하며 token/secret 원문은 명령·로그·보고서에 넣지 않는다.
- 동일 fixture의 첫 요청에서 생성된 update/audit/command 상태와 HTTP receipt만 확인한다.
- Telegram 외부 API 호출, webhook URL 변경, BotFather 변경, 반복 전송·재생 공격은 이 WI 범위에 포함하지 않는다.
- POST는 DB side effect를 생성할 수 있으므로 실행 전 별도 사람 승인이 필요하다(§6).

### 2.3 인증 SSE 및 재개

- 승인된 테스트 identity로 `GET /api/runs/{run_id}/events`를 인증해 연결한다.
- 최초 event id, 순서, terminal immutability와 disconnect 후 `Last-Event-ID` 재연결 결과를 기록한다.
- 실제 Provider 실행을 발생시키지 않는 기존 test run 또는 승인된 fixture run만 사용한다.
- 인증정보와 내부 upstream 주소는 브라우저·로그·증거에 노출하지 않는다.

### 2.4 DB side effect 및 정리

- Telegram POST 전후의 관련 row count/hash-safe 식별자와 감사 event를 확인한다.
- 검증 데이터는 production business data와 분리된 test identity/run으로 제한한다.
- 종료 후 기본 결정은 **정리**다. 정리할 경우 관련 test update/audit/rate-limit/command와 생성 run을 식별해 삭제 또는 지원되는 보상 정리 API를 사용하고 결과를 기록한다.
- 보존이 필요하면 사용자 승인 후 보존 사유·보존 대상·보존 기간을 DecisionRecord에 기록한다. 임의 삭제·schema downgrade·migration 변경은 금지한다.

## 3. 금지 범위

- 배포, image rebuild, compose/Nginx/DNS/webhook 설정 변경
- schema/migration 생성·변경·downgrade
- Provider 모델 catalog/routing 변경
- credential 발급·회전·삭제 또는 원문 열람
- 과금 가능한 Provider 요청
- Telegram 재전송, 외부 Telegram API mutation, 공개 노출 변경
- 테스트 실패를 PASS로 승격하거나, 다른 target/environment의 EvidenceManifest 재사용

## 4. 순서와 중단 조건

1. 시작 시 Git HEAD/branch/status, deployed image digest, API/config revision, DB identity와 migration head를 read-only로 수집한다.
2. secret 비노출 정적·로그·브라우저 Network 점검을 수행한다.
3. Provider non-billing probe를 수행한다.
4. **승인 확인 후** Telegram signed POST를 정확히 한 번 수행한다.
5. 동일 승인 identity로 인증 SSE 및 `Last-Event-ID` 재개를 수행한다.
6. DB side effect와 audit receipt를 대조하고 정리 또는 승인된 보존 결정을 기록한다.
7. EvidenceManifest와 C-21 R2 TestReport를 작성하고 미검증 범위를 명시한다.

다음 중 하나라도 발생하면 즉시 중단하고 `BLOCKED`로 기록한다.

- credential 원문이 화면·로그·명령·응답·artifact에 노출됨
- endpoint가 billing 가능하거나 probe 범위가 불명확함
- 서명/allowlist/인증이 예상과 다르게 fail-open 또는 다른 identity로 동작함
- test fixture가 아닌 업무 데이터/run을 변경할 위험이 있음
- target hash, image digest, migration head, environment가 시작 증거와 불일치함
- DB side effect가 예상 집합을 벗어나거나 rollback/정리 방법이 불명확함
- SSE가 다른 run의 event를 섞거나 `Last-Event-ID` gap/order/dedupe를 보장하지 못함

## 5. 완료 조건

- [ ] 동일 target의 HEAD, image digest, migration head, config/policy revision을 EvidenceManifest에 고정
- [ ] 9개 Provider의 비밀값 없는 상태·credential presence·capability/health/drift 결과 기록
- [ ] Telegram signed POST 1회와 HTTP receipt, update/audit/command event 계보 기록
- [ ] 인증 SSE 최초 연결·disconnect·`Last-Event-ID` 재개와 순서/중복 판정 기록
- [ ] credential 원문 및 내부 endpoint 비노출 확인
- [ ] DB side effect를 정리했거나, 승인된 보존 DecisionRecord를 기록
- [ ] 실행하지 못한 항목을 `NOT_EXECUTED`/`BLOCKED`로 분리하고 PASS로 승격하지 않음
- [ ] R2 TestReport, EvidenceManifest, progress/HANDOFF에 동일 hash와 다음 상태를 기록

## 6. 사람 승인 필요 지점

다음 세 가지는 실행 전에 Main Agent가 신산님에게 명시적으로 승인을 받아야 한다.

1. 실제 Telegram signed POST 1회(감사 행·DB side effect 생성 가능)
2. Provider endpoint로의 외부 non-billing probe(비용 없음과 endpoint 범위 확인 포함)
3. 생성된 test side effect의 정리 또는 보존 결정(기본안은 정리)

승인 전에는 read-only 준비 점검과 명령 dry-run/fixture 검토만 수행한다. 승인 범위를 벗어난 운영·외부 변경은 별도 승인 대상이다.

## 7. 결과 계약 및 증거

결과 상태는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나다. 결과에는 판정 → 판단 이유 → 조치 순서를 사용한다.

EvidenceManifest에는 다음을 포함한다.

- design/work-plan/WI/prompt hash와 predecessor report hash
- Git HEAD·branch·전후 status, image digest, DB migration head, environment id
- Provider probe receipt의 비밀값 없는 요약과 각 provider별 raw artifact checksum
- Telegram HTTP receipt, update/audit 식별자, signed request의 secret-safe checksum
- SSE event id/order/reconnect evidence와 `Last-Event-ID`
- DB side-effect before/after 식별자 및 cleanup/retention DecisionRecord
- actor/role, acquisition mode, exact commands와 종료 코드, 미검증 범위

원문 credential, token, 서명 secret, Authorization header, 개인 메시지 payload는 EvidenceManifest와 TestReport에 기록하지 않는다.

## 8. Rollback

이 WI는 제품 코드·배포·schema를 변경하지 않는다. 따라서 코드 rollback은 없다. 테스트 side effect는 §2.4의 승인된 정리 절차로 되돌리고, 정리 불가 시 즉시 보존 상태로 멈춰 사용자 결정을 요청한다.
