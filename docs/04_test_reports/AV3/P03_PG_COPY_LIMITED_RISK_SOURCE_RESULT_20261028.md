# P03 별도 한정위험 source 검수 — 2026-10-28

판정: **소스 구현·지정 합성 핵심 검수 완료 / 실제 복제 동작 미확인**. 실제 PG/DB 복구·화면 사용·P03·전체 WORK_PLAN 완료가 아니다. source-only 구현을 실제 원본/사본의 무결성·실행 안전 검증으로 승격하지 않는다.

## 승인·범위·Git

시작안전기준은 codex/av3-stage-b / 8f8c76c96d7a8a87f6be51d4cf49fd6ccc1a2c12(local/private exact 확인)다. private main f976은분리된통합기준선이며local main04430432는옛ref다. source부모는후보FFC3F2A/위임WI C0ABA0F2·결정C1EC9108·manifest09CA3DD2다. 이후자동심사가PMO위임을직접승인으로인정하지않아정확5398bytes는call973/승인CF4FB997,남은전체packetD962/지정5·필수검수보완은call_fdbf857/승인F64CDBAA로직접확인됐다. 두기록모두 notExecutionGrant이며실제grant/위험수락/복제권한아니다.

허용5는아래표뿐이다. 단일subagent구현·Main제품write0·독립읽기검수다. Main문서/현황·승인원본은별도관리하고원R2 source/test4와보호untracked8·사용자dirty는stage하지않는다.

## 구현된 source

새명시 --apply-limited-risk·scope P03_PROTECTED_COPY_LIMITED_RISK_R1·정책 P03_COPY_LIMITED_RISK_POLICY_R1_20261028·최종source/decision/run/대상/최초시간창과사안별delta를strict와분리한다. strict --apply/grant/evidence/parser/합격기준은보존하며실패시자동전환0이다.

실도구가미설치/필수기능미지원일때만ACL/xattr UNAVAILABLE를선택하고known ERROR/PRESENT/PRESERVATION_FAILED/경고·부분출력/owner·link·mount/내용불일치는거절한다. privateNUL-safe원본전후/사본내용·선정metadata 비교에실제supervisor를연결했다. 관측된공간·inode와예상량/논리guard를사용하며hardquota/보장reserve로주장하지않는다.

원cp PID/부모/시작지문·host의원container fullID 전후inspect,최초budget·10초관측/정상TERM1/wait·timer/pipe회수·최초위반latch를묶는다. 최초identity실패는거절·보존하며proc항목소실을원job DONE/CLOSED/REAPED가확인된경합에서만분리한다. helper는fullID를스스로관측했다고꾸미지않고null을host증거에만결합한다.

결과는 COPY_BYTES_AND_SELECTED_METADATA_MATCH_WITH_ACCEPTED_UNCERTAINTY와 writerFullyControlled=false/hardQuotaVerified=false/pointInTimeConsistencyProven=false/postgresStarted=false다. 실제실행결정이없으면진행하지않으며내부grant/digest를외부사람승인인증으로부르지않는다.

## 실제 검증·원실패

- Mainaf6bf4 새LIMITED33:0PASS33FAIL/skip0·2065.1075ms/exit1. CLI·공개접점/supervisor부재 RED이며원strictprefix/제품3/보호12불변.
- 메모리독립검토에서시작/완료시deadline재검사누락I1 발견→새8반례를저장한Main d1a0ca:0PASS8FAIL/skip0·843.5711ms/exit1. fake cp starts0기대actual1(initial4),늦은성공rc0(DONE4)의실기능누락을확인했다.
- 사용자직접승인후동결54922/04FE조립을저장했다. 작성자deadline8GREEN·당시전체84PASS/10105.287ms와후속필수호출선7PASS/870.3595ms는별도명령기록이다. 이둘을단일91실행으로합산하지않는다.
- **Main 최종97f682→동일session98356/efe46f:** node --test --test-reporter=spec tests/unit/P03/pg-recovery-copy-host.test.ts tests/unit/P03/pg-recovery-copy-preparation.test.ts → **91PASS/0FAIL/skip0/cancel0/todo0,11816.5839ms,exit0**. strict43+새LIMITED48의해당2파일최종실행이다.
- Main688cab: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json exit0. Main507b93: C:/Program Files/Git/bin/bash.exe --noprofile --norc -n scripts/pg-recovery-copy.sh exit0. 실제함수/CP/신호모드는실행하지않았다.
- Main643324: 실shell54922/04FE,기존strict shellprefix23499bytes·승인5398/A1FE·production14각1/override0,strictTS validateGrant/validateEvidence/parseCopyResult/runCopyHost의LF논리원문 exact불변. Maine3e408:최종5raw/strict시험prefix/protected12 일치·허용5 diff-check0. 개행전환예고는오류/실raw변경으로오인하지않는다.

메모리단계Bash-n은Win길이206/입력검토크기차단으로NOT_RUN이었다. 그당시를소급PASS하지않고실저장후위507b93으로새검증했다. 대기Node세션41338은Ctrl-C exit1종료·파일저장우회0이다. source저장원거절2회→5398직접답변저장,추가binding거절→남은전체직접답변저장으로새권한을구분했다. author원문읽기ParserError1과문서EOF빈줄1은실행전/문서보완이며제품91실패아니다. Main185020 AST읽기도설치된typescript모듈의Compiler API 미노출로실패·변경0이고643324 직접원문비교로대조했다.

## 독립 판정

메모리원I1 보완은scopedC0I0. 실제저장5지문을확인한최종독립정적검수도C0/I0다. shell302/315/319의기한재검사·513의ACLpartial거절·584의실supervisor호출,host318/325의nullable fullID결합·다른ID거절·sentinel로막은dispatcher invalidbinding을읽었다. 독립검수는시험실행0이며Main91과분리된증거다.

## 최종 source raw / Git 예상 LF 지문

| 파일 | UTF8 raw SHA256 | CRLF→LF만 정규화한 Git 예상 SHA256 |
|---|---|---|
| scripts/p03-pg-copy-host.ts | C96C7AAADC4B76822F698A6E4E9BD3CD7EADBA4F57ECC2EE5951FF3E598E40A5 | 605FB84674B99629B99004023AFF7F1E79F9400EFE8ADE0303043861E0F17AA8 |
| scripts/pg-recovery-copy.sh | 04FE0C3F958DFE5378F60A99D4EF5422F99C543DB66D24157A73BCBADD375FDC | 04FE0C3F958DFE5378F60A99D4EF5422F99C543DB66D24157A73BCBADD375FDC |
| tests/unit/P03/pg-recovery-copy-host.test.ts | 10CAFD444DE2631E1B7F2778BBAF7B1484FAD27D0B091C4043A7D521BBD44DF2 | F276712E1D8417256722E986F2A69986C943F2234DEA3D4306481C1F54E2BB45 |
| tests/unit/P03/pg-recovery-copy-preparation.test.ts | 55345F63479E88B6400EFE3348262885CAD1200C79D83736932C6BF1AEAEBA1F | BF35F26C55262792C0B0CBFD0FC98AD1750C7B6774B8FAF0A19868C6CAF638B4 |
| docs/work_packages/P03_PG_COPY_EXECUTION_PLAN_20261027.md | 3CD24DAD1F6B43935B15EB471D62D558E0F6C39AEDAE237006EF7ED43E23BFF4 | 3CD24DAD1F6B43935B15EB471D62D558E0F6C39AEDAE237006EF7ED43E23BFF4 |

실제index와의EOL-only동일성은commit전에검사한다. semantic변경/원기대완화는허용하지않는다. 정확commit/private게시후WORK_STATUS에서최종SHA를결박한다.

## 한계·다음

actualimage/도구지원·LinuxOS proc/job/FD/timer·실CP/PID신호·새volume/내용무결성·PG기동/SQL/API/화면/Agent는 NOT_RUN이다. ACLpartial의실scan은파일IO가필수라현무파일조건에서는동적NOT_RUN·정적guard검토만이다. fake주입91은이범위를증명하지않는다. 실제리소스/실grant작성·소비0이며이번에는새QA파일/컨테이너/volume을만들지않았다.

다음은안전한source checkpoint/private게시와별도의정확1회개발원본보호사본실행안/새사안별위험·자원·한도·보존/정리·rollback 결정을준비하는것이다. source승인을실제복제승인으로바꾸지않는다. 성공/실패의원본·새/부분사본volume보존과불명helper보존·정확확인된정상종료helper회수만을구분한다. source rollback은정상Git revert이며원본/과거R2/소비원장/사용자dirty삭제는없다. PR/main병합·운영/Oracle/서비스/Secret/권한·실Agent효과0이다.
