# U-01 Task4 Foundation R6 STORED_ROW 진단 결과

## 판정

`R6_STORED_ROW_CONTROLS_FAIL; DIAGNOSTIC_CLOSED; U01_NOT_ACCEPTED`. 기존 단일 `codex/u01-dashboard-r2`의 C3 `625a117812d39beb82c08f9d8cb364e2cc28afe3`를 WSL-server 전용 Git checkout에서 exact SHA로 실행했다. 합성 OIDC/HTTPS/Chromium·격리 PostgreSQL 15 opt-in은 exit1 `R6_BROWSER_FAILED stage=STORED_ROW_CONTROLS exit=1 class=AssertionError`, `1 failed, 1 warning in 25.93s`다. 문단 단언 이후 역사 행 조작 요소0 단언이 승인된 열린 Critical 확인(ACK) 버튼과 충돌했다. 제품 ACK 결함, R6 PASS 또는 U-01 인수로 승격하지 않는다.

## 기준·실행·영향

- 기준 설계 `Anvil_설계서_v2.md` SHA-256 `2171EC811E3F25D672E00E470E1EA6D4A78A9FFBA13540B561CC38B0CAEE9BC7`, 계획 `Anvil_작업계획서_v1.md` `19B7AC91EF17D14AA65BE2BDB871F1B6503565C67ACCEDC558972634A42ACBF4`, 진단 WI SHA-256 `830881863E50E2644E33274548A58EC7EFE049422396DDDD07964EB173FE307C`. W4 `c6631a22`→A3 `c26cc10b`→C3→B3 `e6d79117`→H3 `da1651d1`은 직접 부모·각 정확 경로, 제품 수정0이다.
- C3의 Main 로컬 집중 `21 passed in 317.40s`, Node 자체·구문·diff check exit0, 독립 코드 검토 Critical0/Important0/Minor0. C3 local/private G-05와 WSL-server 전용 checkout G-05는 각각 exit0 `PASS sequence=2352 reporting=AUTO_CONTINUE`였다. 이는 통제와 코드 후보의 검증이지 R6 opt-in PASS가 아니다.
- 격리 Node24 `npm ci --ignore-scripts`·Web build exit0(20 modules), 전용 venv의 SQLAlchemy 2.1.4/pytest 8.4.2 import PASS. PG `postgres:15` exact ID `7a9c806decedbcc5a00fea1c20d41b0c91bf29a0d03e9a1669346dcf0b061ab9`, AutoRemove·data tmpfs256MiB·mount0·loopback `127.0.0.1:5545`, 비관리자 DB/role `anvil_f20_r3a_625a117`(`rolsuper=f`), migration `0019_oidc_sessions`, server_version_num `150019` 확인 뒤 `tests/integration/test_f20_u01_oidc_browser_pg15.py::test_opt_in_r6_oidc_browser_pg15`를 실제 opt-in으로 실행했다.
- 실패 stage는 `STORED_ROW_CONTROLS`이며 앞선 `STORED_ROW_PARAGRAPHS`는 도달·통과했다. 이후 entity/cause 단언과 전체 E-NET/E-API/E-AUD는 이 실행에서 도달하지 못했다. ACK/인가/감사/Network 제품 경로는 수정하지 않았다. `npm ci`의 high severity audit notice 1건은 별도 확인 범위이며 audit fix나 버전 변경은 하지 않았다.
- 사전진단 두 번은 생성된 `apps/web/dist`의 untracked 순서/clean 가정 오류로 시험 전 exit1, PG 버전 읽기 전용 SQL 한 번은 인용 오류 exit1이었다. 별도 `SHOW server_version_num`과 role/migration 확인으로 환경 사실을 재검증했으며 앞선 실패를 성공으로 소급하지 않는다. 첫 단축 원격 URL G-05도 exit1이었고 전용 checkout remote만 canonical URL로 정정한 뒤 같은 SHA에서 G-05 PASS를 확인했다.

## 자원 정리·통제 종료·잔여

WSL-server 전용 `/home/daon/anvil-u01-r6-e113-diagnostic-qa`와 `-venv`는 owner·realpath·HEAD·clean·link·process를 확인했다. 내부 `node_modules`·`apps/web/dist`는 exact 대상만 제거했고 WSL G-05 seq2352 PASS를 다시 확인했다. PG exact ID/label/image/mount/port를 대조한 뒤 해당 컨테이너만 stop했다. browser/Node/PG container0, checkout/venv/pytest/evidence/TLS/path0, port5545=0으로 `U01_R6_E113_QA_RESIDUE_ZERO` exit0; 공유 WSL 자원·ysna/Production 변경0이다.

진단 실측은 B3 `e6d791171c7d0c0fa66fa6ac1c41fb351d47c108`의 progress/HANDOFF/digest/WORK_STATUS 정확4문서에 결박했고 독립 검토 Critical0/Important0/Minor0, local/private clean G-05 seq2352 PASS다. H3 `da1651d15248941d41c6f8525f7e708aa0345a00`는 Event seq2353 write→2354 worker 순서로 epoch113을 REVOKED, active lease/agent null·제품 scope0으로 종료했다. H3 독립 검토 Critical0/Important0/Minor0, local/private clean G-05 seq2354 PASS. 원본 C `3e788ed2`의 G-05 FAIL은 불변이다.

다음은 `design_change.md`의 DC-U01-017에 따라 별도 최소 하네스 보정 WI·dual lease를 발행해 승인 ACK/인가/감사/Network를 보존한 채 단언을 RED→GREEN으로 보완하고, 새 exact SHA를 WSL-server의 새 빈 격리 환경에서 재시험한다. 이 보고 뒤 최신 HEAD의 G-05는 별도 확인 전까지 H3 PASS를 상속하지 않는다. U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`, U-02 `BLOCKED`; PR/main 병합·신규 branch·ysna는 진행하지 않는다.
