# P03 남은 source 연결 — 직접 확인용 묶음

2026-10-28 · Main 어울 · **소스 저장/합성 검증 요청안, 실제 실행 승인 아님**.

## 현재 승인과 정확한 차이

PMO는 후보 FFC3F2A·WI C0ABA0F2의 지정5 source/합성 계약을 채택했다. 자동 안전심사는 concrete runtime 저장의 PMO 위임 근거를 직접 사용자 승인으로 인정하지 않았다. 신산님은 call_9739f65e1ba34ccfa6a172c79e774caf/item0에서 정확5398bytes/A1FE8953의 adapter source 저장과 Bash-n만 직접 승인했고, 그 한정 저장은 허용됐다.

저장된 shell은35378bytes/SHA682F141DC23795BA1E00585E43218AE9699C692B6EFDB6BA76D8ECC7CC4F06E7이다. Main은 승인5398을역추출해정확hash·원파일29979/390489CB복원을확인했다. 실제함수/cp/TERM/컨테이너/grant/PG/DB 실행은0이다.

그 다음 binding/probe/scan 저장은 ‘직접승인5398을넘는추가payload의사용자승인미확인’으로CreateProcess전에거절됐다. 재시도/다른파일·encoding·분할저장우회0이다. 이번요청은아래남은전체를한묶음으로구체화한것이며,같은범위를작은조각별로반복질문하기위한것이아니다.

## 요청 대상과 기능 경계

기존 codex/av3-stage-b의 지정5파일 안에서 남은 연결 source 저장·동일 계약의 필수 오류 보완·합성검증을 수행하는 범위다.

| 파일 | 남은 범위 |
|---|---|
| scripts/pg-recovery-copy.sh | 별도binding/도구부재분류/limited scan·runtime조립/원cp supervisor 연결·동일최초deadline/마지막dispatcher. 기존strict와승인5398을보존 |
| docs/work_packages/P03_PG_COPY_EXECUTION_PLAN_20261027.md | 구현·관측미확인/실제실행제외·source검수/새직접확인/회수·rollback 문서 연결 |
| tests/unit/P03/pg-recovery-copy-host.test.ts | 기존strict기대보존·새경로직접영향의합성검증/필수보완 |
| tests/unit/P03/pg-recovery-copy-preparation.test.ts | fakecp/PID/clock/관측/정상TERM/wait/dispose·deadline경합/ACL부분출력등필수반례·원strict기대보존 |
| scripts/p03-pg-copy-host.ts | 현재저장C96C7AAA의명시분기·새grant/parser를재사용. 지금추가변경계획은없으며위연결의동일계약내필수검수보완만 |

이코드는향후고정개발volume anvil-v3-development-pgdata를helper 안에서RO/nocopy로읽고새보호사본 anvil-v3-pgdata-recovery-20261027-r1에만RW/nocopy로복사하는경로를완성한다. 컨테이너안의 /var/lib/postgresql/data는그개발volume의고정mount이며임의호스트/운영DB경로선택은없다. 신규역할의원PID/부모/시작지문을대조한자기cp만정상TERM최대1·wait/타이머FD회수한다. 이번에이코드를실제호출하는것은아니다.

strict --apply·원grant/evidence/parser/합격기준보존,자동limited전환0이다. 새scope P03_PROTECTED_COPY_LIMITED_RISK_R1·명시 --apply-limited-risk·정책 P03_COPY_LIMITED_RISK_POLICY_R1_20261028·원본/사본/run/정확commit·hash/decision/최초시간창을별도로결박한다. 미확인writer/quota/선택metadata를 CONTROLLED/ENFORCED/DB복구완료로승격하지않는다. known owner/link/mount/도구오류·부분출력·내용불일치는계속거절한다. 기존5398을생산함수재정의/shadow로우회하지않는다.

## 메모리 검토본과 고정 payload

추가코드를어떤파일에도저장하지않은메모리초안이다. 아래SHA/bytes는작성자의순수JS계산신고값이며,독립검토자가전체합성SHA를재계산한것은아니다. 실제저장허용후Main이원본/삽입/교체·최종bytes/hash를독립대조하고그뒤문법·합성검증을한다.

- 현재shell35378bytes/682F141D를기준으로한최종합성안: **54922bytes / 04FE0C3F958DFE5378F60A99D4EF5422F99C543DB66D24157A73BCBADD375FDC**.
- 기존승인adapter5398bytes/A1FE8953…는그대로이며14개생산함수는각정의1·override0이다.
- 교체를포함한source6블록은24533bytes,실행안append3952bytes이며shell의순증은19544bytes다. 이수치를실제PG내용/사본용량으로오인하지않는다.

| 메모리블록 | UTF8/LF bytes | SHA256 |
|---|---:|---|
| binding/probe |2939|BC10E6350919EA902582FDDD9A7DF5AE5EA639D1B035791DB62D5B634132176F|
| limited tools |4003|BAC8FFF2D6BA43B7FD6F4C0ED3522BB53808C343115095333F49A7678E161514|
| limited scan |4829|90640EE11C24E621112D32135BBFBECB13A0C0E5A1C73155771D6A76E47E3D36|
| runtime 조립 |6407|B13ADC353CF7ACC021566852950C3D66E321DB8FC94A0E0B10D86AC7F9016A27|
| supervisor 교체 |5131|081F3A203B49F40919E83BFB59C86E99CF4795CA7CCCB936D92B19010745F81F|
| 마지막 dispatcher 교체 |1224|200AD241C0C61FDE331A91E64F8C54966E569A60718A5A67B7865AC23FA394CB|
| 실행안 append |3952|8C3E0D89B604E422FDAFC2B9E5C3BE75F3DB54614E75767401388DE159625E29|

## 검토 결과·미실행

독립검토자는7개원문/조립기준을대화로읽고,initial sample뒤cp시작·DONE판정전deadline재검사누락I1을확인했다. 메모리에서시작직전/loop진입/최종sample뒤동일deadline확인과limited ACL마지막비개행partial거절을보완했고원I1 ADDRESSED/scopedC0I0다. 최초identity확인실패를정상reap으로바꾸지않고,loop중proc항목이사라질때원Bash job의DONE/CLOSED/REAPED가확인된경우만분리한다.

메모리합성본 Bash-n·새회귀는 **NOT_RUN**이다. 첫문법자료명령은Windows명령길이206으로프로세스생성전에실패했고,후속stdin자료전달은너무커서안전검토불가라는도구거절로실제전달전에중지됐다. 대기Node session41338은Ctrl-C/exit1로종료했다. 다른파일/encoding으로코드저장하거나실행을우회하지않았다. 이도구상태를제품실패/문법PASS로바꾸지않는다.

## 승인 후 검수와 계속 제외할 것

기존strict시험prefix를유지하고위기한경계/ACLpartial등반례를먼저추가·기능전RED로확인한뒤고정연결source를저장한다. Main이bytes/hash/승인5398·원strict/보호12를대조하고Bash-n/type·새경로와직접영향strict합성검증·독립검수후기존승인branch의정상checkpoint/private게시를수행한다. 검수에서나온동일계약내필수오류보완도이정확5파일/동일대상·한도·보호조건안에한정한다. source준비완료와실제1회실행결정은별개다.

**계속제외:** 실제함수/cp/TERM/프로세스신호·probe/init/container/volume생성·실grant작성/소비·위험수락·PG기동/SQL/DB·서비스/Secret/인증서/권한·Agent/비용·운영/Oracle/main쓰기·새helper/도구설치/임의대상/강제중단·재시도. local합성검사는실cp/PID에신호를보내지않는fake주입뿐이다. 실제1회복제는최종exact code/자원/행위/미확인/정리·rollback을별도검토·승인한뒤에만가능하다.

source rollback은정상Git revert이며원본volume·사본/부분사본·과거R2·소비원장·사용자dirty삭제로되돌리지않는다. 전체WORK_PLAN은여전히미완료다.
