# FN09 임무 초안: 격리 SQL 경계 검증

- 담당: Main 어울 / 2026-10-18 KST. 판정: **격리 SQL 경계만 PASS**, 실제 임무 저장·정식 서비스·FN09 완료는 미검증이다.
- 기준 branch: `codex/av3-stage-b`, exact `9e4214942492814c29f0f180c0defb5b5a8eb759`(local/private/WSL clean). `main`은 `f976ed5e29e14b13e12729d5b1ccf98f050f2210` 불변.
- 신규 SQL: `db/migrations/0012_assignment_drafts.sql`, SHA256 `1120676ce1df7a086d374adb5c81356d7ab2c12ef6e07c8ce66c36b4c57a7133`. 기존46 SQL은 변경하지 않았다.
- 승인: AV3-FN09-ASSIGNMENT-DRAFT의 후보/격리검수만. 정식 DB 적용·실제 배정/Agent/정책 부여·서비스 전환은 포함하지 않는다.

## 수행과 실제 결과

WSL-server의 기존 정식 Git에서 `node scripts/qa-assignment-draft-sql.ts --run`을 exact commit/SQL hash·daemon·UTC23:20~23:40에 결박해 실행했다. SSH 명령 exit0, client wall6.1786929초(개별 PG 소요시간 아님), Node v24.21.0이다.

```json
{"status":"PASS","failure":null,"cleanupFailure":null,"phase":"SQL_BOUNDARY_DONE","diagnostic":null,"report":{"commit":"9e4214942492814c29f0f180c0defb5b5a8eb759","sqlHash":"1120676ce1df7a086d374adb5c81356d7ab2c12ef6e07c8ce66c36b4c57a7133","node":"v24.21.0","schema":{"kind":"FN09_DRAFT_SCHEMA_COMMITTED","migrations":47},"readOnly":{"kind":"FN09_DRAFT_READ_ONLY_DONE","migrations":47,"canonicalVectors":2,"newTablesEmpty":2},"denied":{"kind":"FN09_DRAFT_UNAUTHORIZED_WRITE_DENIED","remainingRows":0},"actualWorkflowVerified":false,"actualAgentCalls":0,"formalDbChanges":0},"resourceIdentity":{"containerId":"8ed502330bd61cf74213cafefae6648a82649e09e0cff11f857e73bfc747bc79","networkId":"bcdbb1e6d60f572771d1623c23384b0074a2aaeb5f85d0dd38aa1898da3e7c71","instance":"e8591adbaf4ec7f7eb0f576df15630b0"},"formalDbChanges":0,"actualWorkflowVerified":false}
```

확인한 것은 새 빈 DB의 전체47 SQL 파싱/COMMIT·ID/checksum, 새2표0행, canonical2개 표본, 필수 새 app 권한5개 각각 및 금지권한, 명령 없는 INSERT42501/잔여0이다. app role은 비관리자·대상 DB/PG15 제한을 검사했다. 실제 준비 명령의 양성 저장·CAS/회수/중복의 PG 실행, API/브라우저·원문/계획 준비의 실제 연결은 이번 범위 밖이다. canonical 표본2개는 모든 Node↔PG 값의 동등성 증명이 아니다.

## 자원과 정리

- 컨테이너 `anvil-v3-fn09-draft-sql-qa-pg`, DB `anvil_v3_fn09_draft_qa`, 전용 Internal 네트워크 `anvil-v3-fn09-draft-sql-qa-net`. owner FN09_ASSIGNMENT_DRAFT_SQL_QA/Main·daon uid1000/위 instance label.
- PG image `postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425`, ID `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`.
- tmpfs256MiB만·hostport/bind/volume0·일회3role/password 메모리/stdin·값 출력/보존0. 기존 network 연결0.
- fullID/name/owner/instance/image/실tmpfs/network/미공개 port 대조 후 이번 자원만 제거했다. 별도 SSH 조회에서 두 이름과 위 두 fullID 잔여0, Git exact clean이다. 제거물은 일회 빈 DB·합성 QA뿐이며 제품 데이터·기존 실패자료를 삭제하지 않았다.
- 정식 PG fullID `e6f798c3a2a3bdb2be533dd4c024d76f34d19fcfbbe4bf2acbe0437fb0cf32ba`, 같은 image/StartedAt2026-10-15T18:53:33.435483583Z/restart0/running=true 유지. 별도 app `BEGIN READ ONLY`는 migrations46/new2표부재 true를 확인했다.
- WSL 보호 app/migrator2hash 및 Windows auth/db-app/runtime receipt3hash 불변. 기존 127.0.0.1:3830/PID54212 보존, 실제 서비스 변경0.

## 검수·오류·남은 조치

원 후보 검수 C0/I2/M1의 불확실성 해제/기존 nodeId 거절은 각각 RED 후 최소 보정·scoped C0/I0/기존M1이다. 직접 입력/Web10PASS319.3266ms·임무UI5PASS8.1s·type/build 확인, 이전 UI24 실행의 stdout 집계 미회수 한계는 WORK_STATUS에 보존한다. 목록/cursor2PASS442.9178ms는 fake DB transport이며 실 PG가 아니다.

QA 준비 검수의 CSV 권한 ANY/ALL I1도 RED282.9618ms→각 필수권한 AND 보정·직접4PASS761.1707ms/type/구문/diff0·scoped C0/I0/신규M0. SQL 실행의 실패/cleanupFailure는 없었다. 생성 응답유실·컨테이너 중도종료/정리보류 경로는 실제로 발생하지 않아 미검증이다. 기존 UI 목록 재조회 실패 잔존 Minor1은 이월한다.

다음: 실제 임무 저장·읽기/개정과 고위험 권한 핵심검증을 위한 정식 schema-only 적용의 정확 후보/원본보존/복구·검증 계획을 준비하고 필요한 결정만 PMO에 요청한다. 정식 적용 전에는 DB46 유지. 적용 전 transaction 실패는 rollback, COMMIT 뒤에는 자동 drop/옛 SQL 수정 없이 별도 승인 forward repair를 사용한다. 사용자 정책 자동 부여·Agent·서비스 변경은 제외한다.
