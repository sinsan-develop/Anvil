# FN03 원문·문서 저장/조회 일회 격리 검증 결과

2026-10-21 / Main 어울 / **해당 격리 핵심 검증 통과, 전체 FN03·Stage·사용자 인수 아님**

## 승인·후보·실행

- 신산님이 이 대화에서 정식 DB·기존 서비스·Secret 변경 없이 임시 PG/Node의 FN03 저장·조회 1회/최대30분 내 정리를 직접 승인했다. 앞선 PMO 전달 failed를 실행 승인으로 사용하지 않았다.
- 실행 후보 `2034a4d15b22c72f4e613074538b487616bf6558`. 보고 전 로컬/private HEAD는 `ebe8c1e79f1e58eb155475ec909a29419abff248`였으며 이 보고용 tail을 시험 소스로 바꾸지 않았다. 보호 untracked6 보존·main `f976ed5e29e14b13e12729d5b1ccf98f050f2210` 유지.
- 등록 수명 2026-10-21T05:32:08Z~06:02:08Z(14:32:08~15:02:08 KST), 별도 잔여 확인 05:34:14Z. 등록부터 확인까지 약126초로 최대30분 안이다.
- 새 전용 Git checkout에 승인 private Git의 기존 branch를 depth2/no-checkout으로 clone 후 exact 후보 detached checkout. clone·시험은 각각 새로 1회, 자동 재실행0.
- 원격 실행기/entry/guard SHA256 실제 출력은 각각 `2f2f9a311c609cd4ab374a73c9fb27592a707c492fad84ad9600da7967dcf05e` / `e5ef62826a20a370a7907b16ccbb8282c7f1a9ab7c8cfdb441a7eea2a9beecad` / `2dc44d01795a9adf10fe3e69c135a81018b1d4226f1dbce3e4f4b8f34ce31d05`로 고정값과 일치했다.
- `ANVIL_FN03_QA_SHA=2034a4d15b22c72f4e613074538b487616bf6558 ANVIL_FN03_QA_ISSUED=2026-10-21T05:32:08Z ANVIL_FN03_QA_UNTIL=2026-10-21T06:02:08Z /usr/bin/timeout --signal=TERM --kill-after=60s 29m /opt/node-v24.21.0-linux-x64/bin/node /home/daon/deploy/anvil-v3-fn03-document-qa-01/scripts/qa-fn03-document-resources.ts --run`을 SSH로 실행했다. **exit0 / WORKFLOW_DONE**.

## 실제 검증이 증명한 범위

오케스트레이터는 Node exit0 및 아래 고정4marker JSON을 정확 대조해야 WORKFLOW_DONE으로 이동한다. 이번 최상위 stdout에는 이 판정 JSON만 남았고, 자식 원래 stdout 전체를 별도로 보존하지 않았다. 따라서 아래는 고정 소스의 assertion 통과 경로와 최상위 실측을 연결한 증거이며, 개별 HTTP 원문 로그나 독립 재시험을 가진 것은 아니다.

| 범위 | 확인 결과 |
|---|---|
| PG/권한/빈 DB | 격리 DB명·app/migrator 비관리자·PG15, 고정51 SQL의 ID/checksum exact 일치·시험 표 초기0 대조 |
| 권한 없음 | upload 정책 부재412·artifact0, upload 허가만 있는 문서 저장403 |
| 실제 원문 | BOM·CRLF·공백·script 문자열의 합성 bytes 보존, attachment/CSP·동일 업로드 replay·비회원404 |
| 파일 오류 | DB READY/실파일 누락503, 보존한 파일을 되돌린 후 후속 검수 |
| 실제 문서 저장 | 합성 명시 문서 정책 아래 초안 저장/replay·v2 개정, v1 제목/원문 보존·비회원404 |
| 커밋 영속 | 다른 PG 연결에서 artifact1/document_versions2 조회·실파일 원문 bytes 일치 |

검수 marker: `ISOLATED_PG15_NON_SUPER_EMPTY`, `NO_POLICY_DENIED_NO_ARTIFACT`, `RAW_BYTES_REPLAY_NON_MEMBER_DENIED_MISSING_FILE_503`, `DOCUMENT_DENY_SAVE_REPLAY_TWO_VERSIONS_OTHER_CONNECTION`.

- PG image ID `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`, digest `postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425`.
- Node image ID `sha256:e8c4de1e2519b4f34de27a595df6c2a32df28baa90db80bfaf2e038889d94390`, digest `node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6`.
- host Node binary SHA `7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c`를 생성 전 읽어 일치했다. 내부5432/host publish0·HTTP listen0, PG256MiB/Node64MiB+tmp16MiB, source/공개 의존성/합성 config 읽기 전용 및 go 이전 inspect 제약을 실행기가 대조했다.
- 51SQL manifest SHA `da6f6a9102f8018e2e41d4e00545acd74ec9f2db70e3cf2a7658ec6e6c7e62b6`, schema SHA `177c4ee11ef74e5d25ebb25a7f507258eac4cc71918af9023b08e0806e215006`. 최신 전체 schema나 정식 DB migration 적용이 아니다.

## 최상위 원출력 및 독립 정리

```json
{"kind":"FN03_RESOURCE_RESULT","sha":"2034a4d15b22c72f4e613074538b487616bf6558","instance":"d792f701838c11edd2958ed8f432b4ad","phase":"WORKFLOW_DONE","failure":false,"cancelled":false,"cleanupFailure":false,"ids":{"network":"97d04ba939cea0bbdbb83bb3b986cec8d50c8bff8d08630a8d6603e58455b0cf","pg":"a2c47aedb092122dcff5aaf65e8e226428caedd4ca97ba9f5790933993a877d1","node":"2ada61cf46bc5b83325253cdfd5d95800bbe453887a001d0e1a8aed8d5cf84de"},"formalDbChanges":0,"checkoutCleanup":"EXACT_OWN_ROOT_ABSENT","independentResidueCheck":"NOT_PERFORMED"}
```

실행기 자신의 NOT_PERFORMED를 독립 확인 PASS로 소급하지 않는다. **후속 별도 SSH exit0**에서 다음을 새로 확인했다.

```text
ABSENT /home/daon/deploy/anvil-v3-fn03-document-qa-01
ABSENT /home/daon/.local/share/anvil-v3-fn03-document-qa-01
QA_CONTAINERS=0
QA_NETWORKS=0
QA_PROCESSES=0
2026-10-21T05:34:14Z
```

- 두 경로는 `! -e` 및 `! -L`, owner label의 container/network는 출력0, 관련 QA Node 명령 process0이다. 이번 전용 checkout/합성 config·원문/DB·임시 컨테이너/network만 제거했고, checkout은 private Git exact SHA로 재생성 가능하다. 합성 데이터는 일회 폐기 대상이다. 기존 소스/의존성·정식 자원 제거0.
- 기존 정식 PG는 후속 metadata만 읽었다: fullID `e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba`, **exited**, StartedAt `2026-10-20T11:21:54.792276193Z`, restart0/image594290e9. ID/StartedAt/image는 정본의10/20 관측과 같지만, 과거 running 기록과 현재 exited는 다르다. 이번 생성 전 이 PG 상태를 별도로 관측하지 않았으므로 중지 시점/원인은 확정하지 않는다. 이번 명령에는 정식 PG 시작/중지/변경·DB 접속이 없다.

## 미검증·다음 작업

- 정식 DB/기존 서비스/Secret·실사용자 정책/자료·실제 Agent·Oracle 변경0. 사용자 UI가 지금 사용 가능해졌다는 결과가 아니다.
- 실제 HTTP/served 브라우저·최신 첨부 UI↔DB·가져오기/제안/검토/확정 전체 여정·다른 프로젝트 경로 직접 조회·현재 원소스 관측/드리프트·완전한 비밀 탐지는 미검증이다. 본문 정책/일반 초안의 부분 핵심 확인만 판정한다.
- 실제 TERM·만료/오류별 회수와 모든 경합을 실행한 것은 아니다. 초기 정적 I2 보완 후 별도 독립 C0/I0 판정도 없다. 기존 실패/차단 이력은 유지한다.
- 이번 승인1회는 소진했다. 동일 시험/새 이름 자동 재시도0, 동일7단위/type/build 반복0. 다음은 정식 연동/새 계약 선행과 독립 미구현을 대조해 진행하며, 이 결과로 전체 FN03/IX01/Stage 완료나 main 병합·사용자 인수를 선언하지 않는다.
