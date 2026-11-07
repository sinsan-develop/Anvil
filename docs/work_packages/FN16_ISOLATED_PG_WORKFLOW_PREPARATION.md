# FN16 선택 원본 반출 — 격리 PostgreSQL 실제 여정 준비

2026-10-27 / Main 어울. 기준 branch `codex/av3-stage-b`, 제품 후보 `92cef0472f58b7a2c8656f70ac29c210316350f8`다. 목적은 이미 승인된 FN16의 저장·조회 연결을 DB 대역이 아닌 새 일회 PG에서 확인하는 것이다. 과거 FN03 소진 1회 실행이나 정식 개발 DB 권한을 재사용하지 않는다.

## 이번 단일 writer 소스 범위

- 신규 `scripts/qa-fn16-selected-export-isolated.ts`
- 신규 `tests/unit/FN16/isolated-export-workflow-input.test.ts`
- 기존 `tests/integration/FN16/project-artifact-export-pg.ts`: config 소비 workflow를 명시 함수로 export하는 최소 연결만. 기존 CLI의 거절/검증은 유지한다.

다른 제품/SQL/기존 QA runner/환경 설정은 수정하지 않는다. Main이 관리·검수·게시하며 수행자는 실제 WSL/DB/Docker/파일 QA를 실행하지 않는다. 문서·Git은 Main 소유다.

## 계약

기본 실행은 PLAN_ONLY이며 네트워크·파일 생성·DB 연결 0이다. 명시 `--execute --config`와 보호 config·exact SHA·기한·신규 격리 대상의 고정 이름 검사를 모두 만족해야 실행한다. Secret 값은 stdout/오류/보고서에 출력하지 않는다. 정식 development config/env fallback과 임의 호스트/DB/root 입력을 허용하지 않는다.

새 전용 자원 후보(실제 생성 전 Main이 부재·owner·realpath·link·image·서비스 영향과 생성/정리 명세를 따로 등록한다):

- Git: `/home/daon/deploy/anvil-v3-fn16-artifact-export-qa-01`
- 보호 config: `/home/daon/.local/share/anvil-v3-fn16-artifact-export-qa-01`
- 컨테이너: `anvil-v3-fn16-artifact-export-qa-pg`, `anvil-v3-fn16-artifact-export-qa-node`
- internal network: `anvil-v3-fn16-artifact-export-qa-net`
- DB: `anvil_fn16_qa_selected_artifact_01`, 새 일회 역할 `anvil_v3_migrator`, `anvil_v3_app`
- 컨테이너 source `/qa-source` 읽기 전용, 보호 `/qa-config/run.json` 읽기 전용, 새 `/qa-data` tmpfs. 원문 `/qa-data/artifacts`, 별도 반출 `/qa-data/exports`를 신규 0700으로 생성한다. host publish·HTTP/TLS listener·외부 Agent 0.
- 생성별 최대30분. 실제 workflow 최대120초, query/접속·정리 기한을 별도로 유한화하고 절대기한을 연장하지 않는다. 외부 Main이 컨테이너/네트워크/경로 exact 소유 정리·잔여 확인을 맡는다.

`buildExecutionPreparationQaSchema()`의 기존 고정51 baseline과 그 manifest/hash를 그대로 사용하고, 승인 후보0043을 별도 적용한다. 기존51이나 최신 전체 SQL 집합으로 조용히 바꾸지 않는다. 제품 source도 바꾸지 않는다. 새 전용 PG의 bootstrap/schema 준비만 명시 별도 함수/모드로 제공할 수 있으나 실행 기본은 OFF이고 현재 DB/user·PG15·빈 instance·정확 config를 확인해야 한다. 기존 정식 계정/권한/DB/키에 접근하지 않는다. schema 내용을 생성하는 read-only mode는 actualExecuted=false로 표시한다.

seed는 기존 FN03의 안전한 표준 경로를 재사용한다: 공식 양식 seed → 합성 사용자/비밀번호 → 실제 login으로 client/session/CSRF → 새 project/OWNER/controller → 재인증 → 표준 savePermissionPolicy의 uploadArtifact/saveDocumentDraft/exportProject만 명시 AUTO → 실제 합성 파일 POST → 표준 saveDocumentDraft. artifacts/document_versions를 bare INSERT하거나 guard를 해제하지 않는다.

새 일회 DB app의 TEMPORARY가 CHECK 복제 반례에 필요하면 그 DB에만 제한해 명시한다. 정식 권한을 변경하지 않는다. 기존 `project-artifact-export-pg.ts`의 실제 command/COMMIT replay·별도 사본 bytes·목록/고정조회·RLS/DELETE거절·NULL CHECK 반례를 같은 process의 생성된 config로 소비한다. config·key·password를 파일/로그로 재출력하지 않는다. isolated 복제 CHECK 검증을 provenance 전체 반증으로 표시하지 않는다.

실제 표준 route 저장→다른 연결의 확정 job 조회 및 사본 bytes를 확인하고 원본 물리 파일이 없을 때도 사본을 읽는 범위까지 실제 여정에 연결한다. 합성 원본만 이동/복원하며 기존 사용자 자료는 건드리지 않는다. 강제 종료/동시경합/완전한 비밀 탐지·정식 서비스/사용자 인수는 이 시험으로 주장하지 않는다.

## 검수

### Main 내부 검증 보강 — Git CLI가 없는 Node image

동일한 새 보호 root에 `run.json`과 별도로 `source-manifest.json`(0600)을 둔다. config에 `sourceManifestHash`를 추가해 이 검증 metadata의 SHA256을 결박한다. 형식은 `{kind:'FN16_QA_EXACT_SOURCE_MANIFEST',sha,files:[{path,sha256}]}`이며 Main이 게시 exact commit의 tracked blob 목록으로 생성한다. helper는 manifest/commit과 원격 metadata, 실제 source 바이트 및 경로를 대조하고 `.git`·공급된 읽기 전용 `node_modules` 외 미확인 파일을 거절한다. 경로 이탈·링크·입력 크기/시간은 유한하게 검사한다. 이것은 같은 코드 후보를 검증하는 내부 방법 보강이며 새 기능·정식 권한·서비스 변경은 아니다. 비밀 없는 metadata도 기존 파일을 덮지 않고 새로 생성하며 종료 때 소유 증거에 따라 회수한다.

먼저 잘못된 mode/config/DB/host/path/기한/키를 DB나 파일 접근 전에 거절하는 단위 RED→GREEN을 작성한다. Main의 새 source 실행 준비가 완료되기 전 실제 PG·네트워크·OS QA는 NOT_RUN이다. typecheck·직접 입력 시험·diff와 독립 읽기 검수를 수행하고 exact 지문·원 실패·한계·writer 해제를 보고한다. 소스가 준비되었다는 이유로 실제 QA를 실행했다고 표시하지 않는다.
