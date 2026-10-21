# FN03 원문·문서 저장/조회 격리 QA 준비

- 2026-10-21 / 담당 Main 어울 / **준비·정적 검토만**, 실제 실행 판정 전이다.
- 계획 연결: FN03·UI06의 실제 원문/문서 저장·불변 버전 조회, IX01의 조기 권한 경계 일부. 전체 FN03/IX01/Stage 완료가 아니다.
- 기존 `document-storage.test.ts`는 제품 `development-config.ts`의 정식 DB/5546을 강제한다. 그 시험·validator를 수정하거나 실행하지 않는다. 새 진입점 `scripts/qa-fn03-document-isolated.ts`만 별도 소비한다.
- 준비 기준 SHA `3bb4cc46289a240686529b01fa5f03dc74582b81`. 실행 후보는 이 문서/새 entry를 게시한 **후속 exact SHA**로 다시 고정해야 한다. 현재 SHA에 새 entry가 있다고 주장하지 않는다.
- entry SHA256 `E5EF62826A20A370A7907B16CCBB8282C7F1A9AB7C8CFDB441A7EEA2A9BEECAD`.

## 생성 전 고정 자원안

소유 작업 `AV3_FN03_DOCUMENT_ISOLATED_QA` / daon uid1000. 실제 생성 전 이름 부재·부모/경로 realpath·link·owner·이미지를 다시 확인한다. 이번 확인 시 두 경로와 지정 컨테이너/network는 부재, 부모 `/home/daon/deploy` uid1000/775·`/home/daon/.local/share` uid1000/700이며 링크 출력0이었다.

| 종류 | literal 대상·제약 |
|---|---|
| 새 빈 Git checkout | `/home/daon/deploy/anvil-v3-fn03-document-qa-01` / 승인 private Git의 기존 branch·게시 exact SHA, tracked clean. 서버 patch/source 복사 금지. |
| 보호 설정 root | `/home/daon/.local/share/anvil-v3-fn03-document-qa-01` / 0700, 신규 `run.json` 0600. 합성 password만, Git/로그/본문 출력 금지. |
| PG | `anvil-v3-fn03-document-qa-pg`, DB `anvil_v3_fn03_document_qa`, PG data tmpfs256MiB, host publish·volume0 |
| Node | `anvil-v3-fn03-document-qa-node`, user1000:1000, `/qa-source` checkout 읽기 전용, `/qa-config` 신규 보호 root 읽기 전용, `/qa-data` tmpfs64MiB(uid1000/0700)·`/tmp` tmpfs16MiB |
| network | `anvil-v3-fn03-document-qa-net` / 새 internal network, 이 PG/Node만 연결, HTTP listen/host port0 |
| 내부 접속 | Node→`anvil-v3-fn03-document-qa-pg:5432`, app `anvil_v3_app`, seed `anvil_v3_migrator` / 신규 비관리자 합성 역할만. 정식 config/env 주입0 |
| 원문 | `/qa-data/artifacts` / entry가 만든 BOM·CRLF·공백·script 문자열의 합성 원문만. HTML 실행0, 사용자 원문0 |
| 수명 | 생성부터 최대30분·자동 연장0. 실제 workflow 최대120초, 작업 전 30초 여유 검사·query10초, 연결 정리10초. 외부 오케스트레이터가 별도 정리60초 및 컨테이너 강제종료/잔여 검사를 담당해야 한다. |

### 로컬 캐시 이미지 읽기 관측

- PG image ID `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`, digest `postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425`.
- Node image ID `sha256:e8c4de1e2519b4f34de27a595df6c2a32df28baa90db80bfaf2e038889d94390`, digest `node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6`.
- 캐시 존재만 확인했으며 이미지 실행/설치/pull0. 첫 Node inspect는 없는 Config.User 필드로 template error가 났고, Id/RepoDigests만 다시 읽어 확인했다.

## SQL·검수 범위

- 기존 `buildExecutionPreparationQaSchema()`의 고정 **51개 순서/각 checksum**을 그대로 사용한다. 44개 legacy + source root/read +0012~0016이며, 최신 전체 schema라고 주장하지 않는다. 정식 DB 적용0, 새 migration0.
- `--plan` 실측 manifest SHA256 `da6f6a9102f8018e2e41d4e00545acd74ec9f2db70e3cf2a7658ec6e6c7e62b6`, schema 바이트 SHA256 `177c4ee11ef74e5d25ebb25a7f507258eac4cc71918af9023b08e0806e215006`.
- entry는 실제 연결 identity/PG15/비관리자·빈 표와 이 exact manifest를 대조한 뒤에만 합성 seed를 만든다. 공식 양식 seed는 현재 Git의 두 양식 문서와 기존 catalog 함수를 소비한다.
- 예정 검수: 정책없음412/저장0 → 합성 upload 정책 → 원문 바이트·hash/replay/비회원404/실파일누락503 → upload 허가만으로 문서쓰기403 → 명시 합성 문서 정책 → v1/v2 별도 저장·구버전 보존·비회원404 → 다른 PG 연결에서 커밋된 원문1/문서버전2 조회.
- `buildApp/Fastify.inject`→실PG/파일 검수다. 실제 브라우저/HTTP socket·정식 사용자·DD166F 대화 GET·Agent·이전·배포·전체 여정은 제외한다. 비회원 음성을 다른 프로젝트 경로 검수로 과장하지 않는다.

## 준비 검증·잔여 조건

- 순수 target/만료/잘못된 비밀 오류 검사 **3 PASS / 545.7255ms**, `--plan` exit0/actualExecuted=false, 최신 typecheck exit0. 실제 QA 0.
- 첫 typecheck TS7022 한 건은 주입 응답의 명시 타입으로 보완했다. 읽기 경로 추정 오류 및 Windows literal wildcard 오류는 파일/권한 변경 없이 정정했다.
- 초기 독립 정적 검토(snapshot6413E8AE) **C0/I3/M1**: 중간 만료·후속 close 누락·비밀 오류 객체·비회원 marker 과장. Main이 query/connect마다 기존 QA proxy 검사/30초 여유, allSettled·10초 정리 기한, 고정 비밀 오류/최상위 안전 출력, marker 축소로 보완했다. 최종 독립 재검토/실행 증거는 아직 없다.
- **오케스트레이터는 아직 작성하지 않았다.** exact Git/image/network/mount/tmpfs/owner/instance 검증·hard timeout·성공/실패 모두 Node→PG→network→보호 root/checkout 정확 정리와 독립 잔여0 검사를 작성·정적 검토하고 PMO의 exact 실행 판정을 받기 전 `--execute` 금지다. 환경변수는 승인 수단이 아니다.
- 실패 시 로그는 고정 코드/phase만 남기고 credentials/DSN/사용자 본문을 출력하지 않는다. 자원 회수 실패는 원인과 남은 exact ID를 기록해 보고하며 광범위 삭제하지 않는다. 제거된 일회 checkout은 Git으로 재생성 가능, 합성 DB/원문은 폐기 대상이다.
- 정식 DB·기존 Secret/계정/정책/인증서·서비스·소스관측·실제 Agent/비용·새 권한 계약은 변경0. 기존 특정 거절 우회0·보호 untracked6 보존.
