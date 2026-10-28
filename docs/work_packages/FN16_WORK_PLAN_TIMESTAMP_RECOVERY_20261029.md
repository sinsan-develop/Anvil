# FN16 작업계획 이력 시각 오거절 보완

2026-10-29 / codex/av3-stage-b. 기존 승인 FN16 내부 수집의 정합 오류 보완이다. 새 기능/권한/SQL/실제실행0. 기존 primary 단독 writer, reviewer 독립, Main검수. 직전 설계변경 collector 게시후 착수HEAD를WORK_STATUS에기록한다.
허용수정2: apps/server/modules/backups/work-plan-inventory.ts, tests/unit/FN16/work-plan-inventory.test.ts. 기존 schema시험은 변경0. 다른제품/SQL/시험0. 실제DB/FS/키/서비스/P03/job/Agent0.

## 문제·수정 전후
기존 collector077E5DA0는 생성/수정·버전/검토/확정 사이 timestamp 대소순서를 요구한다. 실제 writer는 transaction_timestamp/now를 사용하며 버전·parent·audit순번/정확receipt로 순서를 연결한다. transaction 시작시각은 lock대기나clock변경 때문에 업무버전순서를 보장하지 않는다.
변경 전: 서로 다른 transaction의 시각 역전만으로 INTEGRITY_FAILED.
변경 후: 원래timestamp를그대로보존하고서로다른transaction간 대소만으로 거절하지 않는다. 각행↔JSON↔receipt 시각일치·첫버전과head생성시각일치·시각유효형식·모든원hash/참조/버전연속·confirmedpointer/정확검토·명령/권한/한도는 유지한다.
대상은104행 head.created>updated,117행 prior.version>row 및 row>head.updated,131행 review<version,135행 review>confirmation,136행 confirmation<version/confirmation>head.updated,140행 confirmation버전간대소 검사다. 숫자행은실제본문으로확인한다. 기존updatedAt가어느transaction에서왔는지미확인을자동정합확인으로승격0. 기존writer에없는새업무순서검사를추가하지않는다.

## 반례·검수
TEST_ONLY 먼저추가: 실제정상version/review/confirmation/updated 시각을각row·snapshot/receipt와일치하도록바꾸어 (a)후속버전시각역전 (b)검토가대상보다이른 (c)확정이검토/대상보다이른 (d)head.updated가과거생성보다이른의정상자료를수집해야한다. 가능하면독립case로각잘못된조건을실제도달시킨다. 과거확정후REWORK와audit순번을유지한다. 기존15기대/fixture불변,추가반례만. MainRED후sourceGO,제거된조건외diff0.
다른행/JSON/receipt시각불일치는여전히실패해야하므로기존음성확인또는필요음성1추가. 신규포함작업계획행동+기존schema한정검증/type/diff·독립재검수. 다른불변collector는반복0. 실제DB/키/서비스/wholebackup/UI미검증유지. WORK_STATUS에원인/RED/최종diff·sourcehash·Main결과기록하고정확범위게시한다.
