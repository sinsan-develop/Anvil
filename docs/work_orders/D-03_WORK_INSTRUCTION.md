# D-03 WorkInstruction — LearningSource 등록·보안검사·폐기 영향 계보

## 1. 식별·권위

- Work Package: `D-03`
- 선행: `D-01`, `D-02` ACCEPTED
- 기준 문서: `Anvil_설계서_v2.md` 36.14~36.15, 47.12, 48.9, 49.9, 49.14~49.17
- 작업계획: `Anvil_작업계획서_v1.md` D-03
- 검증 ID: `AV-LRN-006`, `AV-LRN-007`, `AV-LRN-009`, `AV-LRN-027`
- 구현자: `developer-primary-d03-r1`

## 2. 목표

code/repository/document/conversation/completed-run 자료를 immutable `LearningSource` version으로 등록하고,
locator·commit/revision·content hash·기밀·license·적용 scope·제외범위·품질 label을 고정한다. 등록 시
secret·PII·prompt-injection·malware·license 상태를 fail-closed로 판정하고, source의 삭제·권한회수·license 변경·secret
노출로 `REVOKED | QUARANTINED`가 되면 파생 항목과 영향 snapshot/run을 자동 탐색하는 불변 impact record를 만든다.

## 3. product exact write scope

- `packages/knowledge/__init__.py`
- `packages/knowledge/sources.py`
- `packages/api/learning_sources.py`
- `tests/knowledge/test_sources_d03.py`
- `tests/api/test_learning_sources_d03.py`
- `docs/04_test_reports/D-03_COMPLETION_REPORT.md`

위 6개 경로만 제품 writer가 수정한다. Main 소유 progress/HANDOFF/events/checker/tooling, D-01 memory와 D-02
snapshot 구현은 수정하지 않는다.

## 4. 필수 계약

1. source type은 `code_selection`, `repository_snapshot`, `design_document`, `conversation`, `completed_run`,
   `url_or_package_doc`만 허용한다. type별 locator 필수 필드와 commit/revision을 정규화해 content hash와 함께 고정한다.
2. source는 stable ID와 증가 version을 가진 immutable record다. 같은 identity/version의 hash·metadata 재결박, version
   rollback/gap, naive time, 잘못된 enum/scope/hash/locator는 fail-closed다.
3. teaching intent, user quality label, project/user target scope, exclusions, confidentiality, license reference/status,
   ownership, created actor/time, security scan revision/result를 정본에 포함한다. private source는 더 넓은 scope로 파생될 수 없다.
4. source body/metadata 입력 순서와 mutable input/output alias가 정본 bytes/hash를 바꾸지 않는다. raw secret·PII·악성
   payload는 projection/error/audit에 재노출하지 않는다.
5. scanner는 secret-like credential, 직접 식별정보, prompt override/instruction injection, executable/binary/minified/vendor,
   malware marker, 누락·금지·불명확 license/ownership을 구조화 finding으로 만든다. 사용자 exemplar label은 검사를 우회하지 않는다.
6. CRITICAL security finding, secret 노출, 금지 license, 소유권 없음은 activation eligibility를 차단한다. 품질 증거가 부족한
   사용자 지정 자료는 삭제하지 않고 `USER_ENDORSED_UNVERIFIED`로 보존한다.
7. 파생 항목 등록은 `MEMORY | CODE_PATTERN | EXAMPLE_REFERENCE | SKILL | HOOK | PROMPT | BENCHMARK | ANTI_PATTERN`의
   stable id/version/hash, source version/hash, scope/confidentiality/license 계보를 고정한다. private/외부 source의 scope와
   license를 축소 없이 다음 사용까지 상속한다.
8. snapshot/run 사용 등록은 source/derived version/hash와 snapshot/run ID, 사용 시각·상태를 고정한다. source와 무관한
   payload가 영향 목록을 자가 주장할 수 없다.
9. source를 `REVOKED | QUARANTINED`로 전이하면 이유(`DELETED`, `PERMISSION_REVOKED`, `LICENSE_CHANGED`,
   `SECRET_EXPOSED`, `MALWARE`, `SECURITY_REVIEW`)와 actor/time/expected version을 결박하고, 파생 항목·영향 snapshot/run,
   신규 사용 차단, 진행 Run `PAUSE_REQUIRED` 여부를 `SourceRevocationImpact`에 보존한다. 과거 Run lineage는 삭제하지 않는다.
10. 동일 scope의 request replay/concurrent mutation은 하나의 정본만 생성한다. 실패 요청은 receipt를 소모하지 않고,
    stale expected version과 다른 payload 재사용은 거부한다.
11. API adapter는 인증된 host context에서 register/get/list-derived/get-impact/revoke/quarantine projection을 제공한다.
    payload가 actor/scope/ownership/license authority/status를 자가 부여할 수 없다.
12. D-03은 in-memory 순수 domain/API 계약이다. 실제 repository/file/URL fetch, AST extraction, candidate 생성,
    D-02 catalog 전파, 실제 Run pause와 승인 lifecycle은 후속 D-04/D-06 범위다.

## 5. TDD·적대 검증

- 여섯 source type의 필수 locator, commit/revision/content hash 고정과 결정성
- secret·PII·prompt injection·malware·binary/minified/vendor·license/ownership fail-closed
- exemplar label 우회, scope/confidentiality/license 축소·확대 우회, source hash 재결박 거부
- derived item과 snapshot/run usage가 source version/hash 계보에서만 등록됨
- revoke/license change/secret exposure 뒤 신규 사용 차단, active Run pause-required, 과거 Run lineage 보존
- stale expected version, replay payload conflict, 동시 revoke/register에서 정본 1개
- input/output/API projection mutation이 내부 hash·impact를 바꾸지 않음

## 6. 검증·보고

- focused tests: 위 두 D-03 test 파일
- 관련 `tests/knowledge tests/api` 회귀
- `python -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api`
- `git diff --check`
- 완료보고에는 정확한 명령·exit·변경 파일·미검증·rollback을 기록한다.
- 실제 DB/HTTP/browser/Provider/network/WSL/Docker/deployment를 실행하거나 PASS로 표시하지 않는다.

## 7. 완료 후

Developer는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED`로 보고한다. Main 독립 검토 전 D-03은
ACCEPTED가 아니며 D-04를 시작하지 않는다.
