# P03 보존 PG 구조조사 host 제어 소스 준비 검수 — 2026-10-27

## 판정
SOURCE_PREPARATION / 지정 최종 보완 범위 C0/I0/M0. 실제 실행 준비·원 volume 구조조사·PG 복구·제품 기능 완료는 아니다. 전체 WORK_PLAN은 미완료다.
기준 branch codex/av3-stage-b / 시작 checkpoint 6d584a619c457218d7b40e94e58358264270943a. 단일 담당 p03_discovery_host_control 구현, Main 어울 관리·새 검수·통합, p03_discovery_review 독립 읽기 검수. Main 제품 직접 수정0.

## 변경과 이유
신규 scripts/p03-pg-discovery-host.ts, tests/unit/P03/pg-recovery-discovery-host.test.ts, P03_PG_DISCOVERY_HOST_EXECUTION_PLAN_20261027.md의 정확3파일이다. 기존 metadata shell·원 시험·provision·guard/native·승인/소비기록은 보존했다.
기존에는 host60초/단발/신원/정리 제어 소스가 없었다. 이번에는 import/기본 plan 무효과와 실제 고정 FS/Git/Docker adapter→orchestrator 경로를 연결했다. 합성 ports/child로 같은 코드 경로를 확인한다. 미결박 grant·현재원문/기한/소진·자원 불일치는 닫으며 실제 실행 권한을 파일이 인증한다고 주장하지 않는다.
WI 최초 C08526AAB0FC26BCFD9B00BE6195FC81A67EB044B7B1F0E3700267F773FFC729, 내부제어 보완 후 9C4E5936EF733231FEB220D8968C00C69D401D0A01C068A20531681CE1E30CF1. 원 Docker/Git spawn handle TERM최대1/stdio 회수는 source-only 내부 보완이며 새 실제 실행 승인이 아니다.

## 지문
| 파일 | 최종 raw SHA256 |
|---|---|
| scripts/p03-pg-discovery-host.ts | EA54D05C9E6DB05C5BC1E34A5E5B97B10B2E2FE03E41C4E6A8ED8F2207257766 |
| tests/unit/P03/pg-recovery-discovery-host.test.ts | 7B7212AD7CFBA8417015145335296B72A4209C55228ADF697A310BCE9C33BE0D |
| docs/work_packages/P03_PG_DISCOVERY_HOST_EXECUTION_PLAN_20261027.md | 5364283F3CC761DDDDE81DE3AA5F68504202F0B86FE2D245DB9A66741A26C5BE |
기존 shell raw156867EF53948C2A18CF439EBA8DB46ECF461AB11FD86116239B2E5FEC9A480B 불변. 최초 제출 지문과 보완 이력은 담당 실행안에 남겼다.

## Main 실제 검증
- e18418: 신규4건 source 부재 RED/exit1.
- 4332ab: 최초 제출 신규18 PASS/skip0/231.6903ms, fdbdb0 타입·구문 exit0. 보완 전 증거다.
- 독립 예비3건: timeout 뒤 client/pipe 생존, deadline 밖 FS 대기, 중복 JSON 키 허용. 원 handle TERM/close 미확인·lateIO/pendingIO/소비 null·기존 parseWireJson 재사용으로 보완했다. 실제 OS 종료 보장이라고 하지 않는다.
- 최종 I1 RECEIPT_BUDGET_GAP: 최소잔여 검사 뒤 receipt가 시간을 소모해 실제 create/start가 가능했다. Main f869a7의 신규20은18 PASS/2 FAIL/236.0281ms/exit1로 mutation1!==0을 재현했다. 같은 담당 round1이 실제 호출 직전 동일57.5초 가드2곳만 추가했다. 독립 I1 ADDRESSED.
- 별도 EXPOSE_BINDING_GAP: 포트 선언 metadata와 실제 게시를 혼동한 추가 제약 및 image→container 선언 유실 수락. Main f0b877 신규24는22 PASS/2 FAIL/244.9727ms/exit1이었다. 같은 담당이 폐쇄 선언·preflight snapshot·모든 own 비교만 보완했다. 실제 image EXPOSE값은 추측하지 않는다. 게시0/networknone 조건은 유지한다.
- 8fdda4: node --test tests/unit/P03/pg-recovery-discovery-host.test.ts → 최종24 PASS/0 FAIL/skip0/242.4678ms/exit0.
- a8948f: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json 및 node --check 신규 source/unit → exit0.
- 383a12: 최종3지문 일치, 각 git diff --no-index --check -- /dev/null 신규파일 공백출력0(차이존재 exit1과 구별), 기존 tracked 변경은 Main WORK_STATUS뿐.
- b4e326: 보호 untracked8 지문불변, 컴파일01/02 소비marker 지문불변·QA01/02 경로부재. 소비기록은 의도적 보존이다.
독립 최종은 지정 보완 범위 C0/I0/M0이며 읽기만 수행했다. 담당24 PASS/258.1931ms는 Main 새 검사와 구분한다.

## 오류·미검증·자원
담당 신규 fixture 타입 오류 초기2+추가1은 최소 보정 후 타입0이며 제품 실행 실패로 계산하지 않는다. Main provision 파일명 추정 읽기 NOT_FOUND1과 tsconfig.json NOT_FOUND1은 실제 이름/tsconfig.base.json 확인으로 종료했다. Git sandbox 격리 오류는 정확 읽기의 허용 실행으로 분리했으며 ACL/Git설정 변경0이다. 같은 근본 원인3회는 없다.
실제 SSH/WSL/Docker/원 volume 조회·mount·metadata/PG binary/SQL/DB/서비스·Agent/PS/C#/Bash 실행은 이번 작업0이다. 새 source QA·원장·grant/nonce·컨테이너는 생성0이므로 실제 정리 수행이나 WSL 잔여0을 새 관측했다고 주장하지 않는다.
실제 image Env/EXPOSE/NetworkSettings 형태·Linux FS 신원/내구성·OS TERM/미종료·bootstrap·원 metadata는 NOT_RUN. 기본 후보 불일치는 자동 대체하지 않는다. 60초가 kernel 대기/이미 시작한 IO/child 종료를 강제로 보장하지 않는다. 소비·종료·정리 미확정은 보존하고 false로 합성하지 않는다.

## 다음과 복구
기존 branch에 소유6파일만 checkpoint/private 게시하고 exact SHA를 확인한다. 이후 실제 실행 전 source Git/도구·root·Env·record·원자원 현재 신원과 정확 권한을 대조한다. 현재 grant/실행승인 발급0. 소진된 compiler02 승인으로 재시도하지 않는다. FN16의 기존 정확 계약 결정 질문도 중복하지 않는다.
rollback은 소유 신규3 source의 검토된 정상 revert이며 기존 자료·소비marker·원 volume·서비스 삭제가 아니다. WORK_STATUS에 담당·오류·검수·미검증·다음 조치를 누적한다. 이 checkpoint로 전체 Stage/계획 완료나 병합을 주장하지 않는다.


## 관측 profile·정확 Node 후보의 후속 source 검수 — 2026-10-27

1bd72b151d85dc00bc14e3cb912b74fe0a257491의최초source준비뒤새Main읽기74bfc1/ba0213/e94e53을실시했다. daemon/image/원volume·소비자0/신규후보경로부재를대조했고,실imagePATH의PGbin추가·Node1001:1001/0755·현재execuid1000을관측했다. getent1001 exit2=NOT_FOUND,지정5경로ACLaccess/default ENODATA·현재uid1000쓰기false다. root소유기존Python읽기만·설치/chown/ACL/DB/서비스변경0이다. 미확인owner를확인했다고바꾸지않고향후할당/소유자교체·loader/해시-실행경합의위험을남긴다.
PMO는신산님의직접위임범위에서정확UID1001/hash/path·원PATH source-only후보교정을채택했다. source패치첫auto-review는정확보안경계사용자승인미확인으로거절·제품미반영을확인했다. 신산님직접위임2문구→PMOexactsource-only채택→WI87035→actual제외0의근거를추가한동일패치1회재심d32021은허용됐다. 도구교체/분할/대리write/범위은폐0이며두결과모두보존한다. 실제실행승인은발급하지않았다.
초기Node TEST_ONLY2는미정FIXED복사양성으로Main미채택·철회한후담당27의24PASS3FAIL이력을보존했다. 기존24기대/합격기준을삭제하거나완화한것이아니다. Main86abbb PATH신규1 RED→2ab15e 25PASS247.6495ms/type0으로image원PATH1literal교정검수. 이후실측literal을독립fixture로한새명시Node과업Main52ee40은28중25PASS3FAIL246.3302ms였다. purehelper를실factory의원O_NOFOLLOW handle/hash·부모전후/proc동일성에연결하고grant한정위험ack를필수로보완했다. 누락/false/true/임의문자열은Docker0이고정확값도외부승인인증이아니다. OWNER_UNRESOLVED_RESIDUAL_RISK는plan/consume/receipt/result에유지한다.
Main eb151d의정확명령 node --test tests/unit/P03/pg-recovery-discovery-host.test.ts → 최종28PASS/0FAIL/skip0/325.9054ms/exit0. d92264의tsconfig.base type·신규source/test nodecheck exit0. 독립지정Node보완범위C0/I0/M0이며실명령/시험실행0의읽기검수다. 담당첫FS타입number|bigint오류는명시Stats로최소보정·최종0,Main제품수정0이다.
최종source raw B071A57A1EA1DF44A1F93213BBFFEC8EB6D626755BC7FB8E543029BEAB8BFCF7,unit207D7A4CD8EFB5B51A36D01C7976D1464F94136251034F4561CAFDE47146D32E,Main실행봉투추가후plan C9960CD6D65DBFB0BE47E3C7A3131809D2A090CD59C51F36C6890B3BBA73794D,현재WI87035F754EAD40E87DF762F787257BE7CA6E0F80DE193247F9A244746550C00F. 선행지문표는최초checkpoint의이력이며이최종지문과섞지않는다. 실제Linuxfactory/OS/도구변조/QA bootstrap·원volume metadata/PG복구/Agent/제품사용·전체계획은미검증·미완료다.
UI06/UI10의다음독립미연결1개한정조사는기존API의새source연결누락을입증하지못했다. 이미연결된문서/계획/지식/헌법동선을반복하지않으며공유B계약·Agent전달/실제실행증거·정식DB/서비스복구선행을구분했다. 실제결정봉투는원volume RO조사helper1개/새GitQA·원장·30분·60초·정확risk수락·불명보존/정상정리로구체화했으며실행0이다. 소유7경로의후속checkpoint/private게시후정확commit과남은실행결정을PMO로전달한다.
