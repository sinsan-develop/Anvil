# P03 보호 사본 source 준비 검수 — 2026-10-28

판정: 승인된 strict source·합성 검수 범위 완료. **실제 복제·PG/DB 복구·기능 사용·P03/WORK_PLAN 전체 완료 아님**. 실제 writer/quota producer 미채택으로 strict actual apply는 첫 소비/mutation 전 거절한다. 새 limited 경로는 이 검수에서 구현하지 않았다.

## 범위·기준

기존 codex/av3-stage-b / 소스 전 HEAD7bf6ceb288e592ec265ebcf0dc85ce9d2cb40b77. scope009EA669·WI DC5A3B33·위임결정D394B4 아래 controller/shell/시험2/실행안5만 구현했다. Main 제품 write0·단일담당구현·독립검수다. private/development main은f976ed5e29e14b13e12729d5b1ccf98f050f2210, 별도 local main은오래된0443043251d25aa77c17d23165b7c9299c8dbeb8이며같다고표시하지않는다.

구현은 무효과 import/default/plan, 구체 FS/Git/O_NOFOLLOW·단발 O_EXCL/fsync receipt·고정 Docker adapter, strict grant/evidence/carrier·생성후 mount/identity·단일deadline·원본/부분사본보존, LF shell의 private bounded 도구 진단·raw NUL framing·copy전gate·전후/사본내용·선정metadata 대조다. 실제 image/FS/runtime 동작은 NOT_RUN이다.

## 실제 실행한 검증

- Maineb90c4 초기 TEST_ONLY25: 0PASS/25FAIL/skip0·135.5334ms/exit1. 정확 신규 source부재 RED.
- Main698beb 보강경계7: 0PASS/7FAIL/skip0·140.5548ms/exit1. source부재 RED. 독립원I1/I2 시험명세보강C0I0후GO.
- Mainee8710 신규35PASS/fail0/skip0·3153.3325ms. type/Bash -n0. 이후진단I1을발견해전체무결함판정으로승격하지않았다.
- Mainffdaa0 stderr보완본40PASS/fail0/skip0/cancel0·6085.6833ms/exit0. type/Bash -n0. 후속독립은memorycapture NUL정규화잔여I1을확인했다.
- 작성자NUL반례2 RED: 각외부stderr146bytes·0PASS2FAIL/614.214ms, 이후관련6GREEN. Main최종d95616→동일session56666/ec9fff는 **preparation/library20PASS/fail0/skip0/cancel0·9233.9655ms/exit0**. controller/hosttest는ffdaa0이후raw불변이어서host23반복0. 최종43개단일실행PASS라고합산하지않는다.
- 최종 node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json exit0, C:/Program Files/Git/bin/bash.exe --noprofile --norc -n scripts/pg-recovery-copy.sh exit0. WindowsApps Bash/WSL실행0.

Node 명령은 node --test --test-reporter=spec tests/unit/P03/pg-recovery-copy-host.test.ts tests/unit/P03/pg-recovery-copy-preparation.test.ts(35/40당시), 최종은해당preparation.test.ts만실행했다. 실제명령은private도구가아닌가짜ports와local library/framing/순수gate/잘못된carrier거절·합성외부명령만사용했다. 실제probe/init/copy·PG·Secret·서비스·Agent·실grant/소비0, 설치/일회자원/새temp파일0이다.

## 독립 지적과 조치

시험I1은사후report거절만있던공백을별도writer/quota evidence와copy start전재확인·run별carrier/inspect/cp직전gate반례로닫았다. I2는shell확장문자/비UTF8/NUL경로원bytes대조로닫았다.

제품I1은도구별stderr폐기/exit·필수완결누락·JSON도중재호출이다. private관측접점·검증값만출력·initUID0전용tmpfs(원본mount/cap추가0)로보완했고,잔여$()의NUL제거는rawguard/pipefail·상태marker/후행개행·유한chunk회수·외부stderr0반례로닫았다. 독립최종원I1 ADDRESSED/scopedC0I0. 새로운위험수락/strict완화로해소한것이아니다.

## 최종 소유파일 지문

| 파일 | Windows raw SHA256 | CRLF→LF만 정규화한 Git 예상 SHA256 |
|---|---|---|
| scripts/p03-pg-copy-host.ts | 7A62FFD7AE310A950243F668AAA91BA01C8BB9C1D5A4B148C535DB6E33A33743 | 8D81CD5068B8E762ACFB7C5733BABAC40116392387000FB75F27F6DCDA5F967E |
| scripts/pg-recovery-copy.sh | 70697DC3D787D5CED8442730B3A3A68BD8D61E1A883B73CF462E2BE452145782 | 70697DC3D787D5CED8442730B3A3A68BD8D61E1A883B73CF462E2BE452145782 |
| tests/unit/P03/pg-recovery-copy-host.test.ts | C4523CD7882BF25E626D0820688524AA8024208BBC5A39556274354193E133CA | 3D8681EA15C69160E0F153D39F020392C28FA14A2F6B5D537C0034C3694F1048 |
| tests/unit/P03/pg-recovery-copy-preparation.test.ts | B6A5677F13F0632EED1F71234831AE50B89D5FFB1B49CC6CBC6D1AC9EFCA762A | B015490BD8E4F37F9BB12BF6B6DB72BF26E9FC64D1E72646A0E1F0E4FFA36183 |
| docs/work_packages/P03_PG_COPY_EXECUTION_PLAN_20261027.md | 1E97EA97C326F41A4D545070AE300223718E7BD39E6FB75A4F52900601F6FE04 | 1E97EA97C326F41A4D545070AE300223718E7BD39E6FB75A4F52900601F6FE04 |

실제 cached blob이위정규화와동일한지는commit전대조한다. 의미변경없는EOL차이만허용하며최종Gitcommit/privateSHA는WORK_STATUS의후속게시기록으로결박한다.

## 미검증·보존·다음

실제 FS/POSIX/Docker/image 도구·ACL/xattr·allocation/inode/quota/writer신뢰·원내용일치·PG무결성/기동·SQL/API/화면/사용자인수·전체계획은 NOT_RUN/미완료다. getfacl/getfattr 후보가image에있다고주장하지않고미확인이면strict cp0이다. source준비성공을복구완료로바꾸지않는다.

원R2 source/test4와보호untracked8은지문동일·stage제외다. 임시자원을만들지않았으므로이번검수의자원생성/정리효과0이다. rollback은이source의정상Git revert이며원본volume/과거R2/소진marker/사용자dirty를삭제하거나되돌리지않는다. PR/main병합·원격main변경0이다.

다음은PMO가후보FFC3F2A를별도source계약으로채택한한정위험경로의TEST_ONLY다. WI C0ABA0F2/결정C1EC9108은정확5내source/합성구현만허용하며실제위험수락/grant/실행은제외한다. strict baseline을먼저검수·보존하고새scope/정책·명시진입·별도결과/관측감시/오류거절을원strict와분리해검증한다.

- commit전 ebcea1/90e87d의 cached check는 신규 실행안67행 CR1개를 trailing whitespace로 거절했다(commit0). Main은 해당 신규 문서의 CRLF→LF만 정규화했고 논리 내용은 동일하다. 검수당시 raw B390A0A0…에서 최종 문서 1E97EA97C326F41A4D545070AE300223718E7BD39E6FB75A4F52900601F6FE04로 변했으며 제품/시험 bytes는 불변·재시험 불필요다.
