# FN02 저장 보호 후보 첫 격리 검수 — 진행 중

## 범위와 판정

기존 Stage B/FN02의 미적용 SQL 컴파일·graph/form/숫자/검토 함수 대조다. 실제 양성 적용·직접 DML 위조/양방향 COMMIT·경합·초기 createProject 실행·정식 DB/served·전체 FN02 완료를 검증하지 않았다.

## 시도 1 — 원 실패 보존

- 실행 source: `b6c6a00306888d6a2a731fb1e5bf1c62c88c32da`, 새 WSL Git exact/detached clean. Node24.21.0 SHA256 `7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c`.
- pending SQL: `F70F838E11293C5BA71255F762DCA7C42BB81DD00D9ED5D65CEE66C2BB399B89`. 등록 53개/순서/지문은 `EMPTY_APPLICATION_QA_MANIFEST.json`.
- 실제 명령: 등록 전용 경로에서 `ANVIL_FN02_QA_SHA=<위 SHA>`, `ANVIL_FN02_QA_SQL_HASH=<위 소문자 지문>`, 원격 현재시각+20분의 `ANVIL_FN02_QA_UNTIL` 아래 `node --experimental-strip-types scripts/qa-fn02-empty-application.ts --run`.
- 종료 1, `phase=CANDIDATE_SCHEMA`, `failure=FN02_QA_ASSERTION_OR_UNCLASSIFIED_FAILURE`, `cleanupFailure=null`, `diagnostic=null`, `report=null`. 함수 시험에 도달하지 않았다. 당시 단계가 초기 guard/hash와 manifest 비교를 함께 포함해 직접 원인은 미확정이다. psql 오류가 없다는 사실을 전체 SQL/COMMIT PASS로 승격하지 않는다.
- 생성 ID: PG `a81c79f179ff7c364821c80c9f5545a0b3f691c21b3e8d224b13bbc8ec6d169d`, network `70795ad257c524133369a14b5a403d8ff4fe2c185bc95ea806adb5004d9943a6`, instance `2c5007b4aafa2b0a3900c89ddd13434c`. exact ID/label/image/mount/port 검사 뒤 finally 회수했다.
- 독립 SSH 읽기 exit0: 등록 PG/network/tmp 이름 잔류0. 정식 PG의 exited/Runningfalse/Pid0/ExitCode0/Started2026-10-18T15:25:12.085069883Z/Finished2026-10-19T12:56:52.490883698Z·image594290·127.0.0.1:5546 정의가 사전과 동일했다. 새 Git checkout/의존성은 원인 재현용 보존 중이며 아직 경로 전체 잔여0이 아니다.
- 원인 조사: 로컬 manifest의 ASCII/locale 정렬 차이는 동일이라 기각했다. SQL·합격 기준을 추측 수정하지 않고 단계 세분화/비밀 없는 manifest ID·checksum 차이/에러 source 행만 추가했다. 이 진단은 원 실패의 삭제/통과 전환이 아니다.
- 준비 범위 예외: `npm ci --ignore-scripts --no-audit --no-fund`의 명시 cache 인자를 누락했다. 기본 npm cache 사용/실제 쓰기량 미측정이며 공유 cache는 임의 정리하지 않았다. 실제 Secret/설정·정식 DB·서비스 변경0. 이미 완료한 설치는 재실행하지 않는다.

## 다음 확인

같은 SQL/53개 기준의 진단만 보강한 exact Git 후보를 새 빈 PG로 한정 재현하고 실패·정리까지 기록한다. 직접 원인 확인 전 조건 완화나 SQL 변경은 하지 않는다. 본문 작성 시점에 재현은 미실행이다.
