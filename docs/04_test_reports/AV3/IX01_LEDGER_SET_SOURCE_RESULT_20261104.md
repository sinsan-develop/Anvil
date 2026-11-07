# IX01 최종 원장 집합 검산 source 보완

판정: source 한정 검수. J2 원 UNKNOWN은 유지하며 실제 원격 조회·재실행0이다.

변경 이유: DB ORDER BY id의 collation과 Node 코드순 배열을 직접 비교하던 방식은 동일 집합도 거절할 수 있다. 실제 J2 반환값/DB collation을 수거하지 않아 J2 직접 원인 확정은 아니다.

변경 전: SELECT JSON 배열과 Node 정렬 기대값의 canonical 문자열 직접 비교. 변경 후: 정확105·exact id/checksum2키·유효형식·유일ID·일대일 checksum을 검사하고 양쪽 같은코드순 비교. 누락/추가/중복/변조/잘못된shape/중복JSON키/상한초과는 LEDGER_UNKNOWN이다. 원 SQL·manifest105 실행순서·순차receipt·controller·시간/보안/UNKNOWN정책 불변. script/unit2만 수정했다.

Primary10b1a6 RED1P2F→0920b7신규3PASS·b843bc직접34PASS/524.4449ms·85cff5 rootnoEmit0/7.083156초·5153ce Bash-n0·a200f0diff0/부모역차분불변/기존31시험prefix보존. Main8830fe 같은전체직접34PASS/skip0/fail0/510.3635ms·5fb5de실제포트/15음성/UNKNOWN후record외0검토·diff0. scoped C0/I0. 기존LF→CRLF경고는보존했다.

명령: node --test tests/unit/IX01/actual-journey-controller.test.ts; node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json; Git Bash --noprofile --norc -n scripts/qa-ix01-actual-journey.sh; git diff --check.

script44446B SHA67B41E83FB4521DD83ADB498E0315CC0224128C150ACD6084258D1332A03593F, unit35501B SHA547EC883AEFDA8C010D1083D044496E460C727B5C02D7D1746A81B6E0AB2E4A4. rollback은이2경로diff만역적용. integration:104의인접정렬문제는이번허용범위밖미수정으로후속이다. 실제기능/DB/브라우저인수·전체계획완료아니다.
