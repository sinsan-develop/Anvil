# FN10 새 빈 PG 대기 요청 QA 01

## 첫 bootstrap 및 보정

첫 후보 a6b83915b5fb51c1040f2735f4649bc63cab4b5f는 PG/Node 생성 전에 clean 검사에서 exit1이었다. 등록 node_modules 링크가 Git에서 `?? node_modules`로 표시되는 것을 확인했다. 00:37:38 exact clone·링크만 회수했고 별도 부재/공유 의존성 보존·PG/net0을 확인했다. SQL/제품 검증은 미실행이다.

다음 후보의 runner는 F30B008BFFBCA3FCA2D41FFF3E49CAF74C870EAB7DDDD6993BA614DE9BBADD7B, wrapper는3317856CEBC3236B483D287E02BDBD27B588E5BED1594015DD67FD5D8B537291이다. 아래 원후보 hash는 이력이다. workflow/SQL/manifest는 불변이며, 허용 Git 상태는 **tracked clean + 정확한 등록 링크 한 개**다. 다른 변경/비추적 파일은 거절하고 링크의 실제 대상도 계속 대조한다. 링크 제거 후에는 완전 clean이어야 한다. 신규 단위1RED→최종8PASS4475.1013ms/type/bash-n0, 아직 실제PG PASS가 아니다.

상태: exact56328b99 실제 PG 검증은 WORKFLOW FAIL / 임시자원 독립 잔여0. 아래 미실행 표기는 준비 당시 이력이다. 담당 Main 어울, 2026-10-22. 공식 D:\Project\Anvil / codex/av3-stage-b의 게시 exact commit만 사용한다.

## 첫 workflow 결과와 보완 후보

60SQL COMMIT·PG15 비관리자 접속과 정책없음412/queue0은 확인했다. 이후 METHODOLOGY_APPLICATION_INTEGRITY_FAILED exit1로 저장·조회·취소는 미도달이다. PG/network 자체 회수는 성공했으나 checkout wrapper는 불완전이었다. Main이 exactroot/HEAD/owner/link/process/PGnet 부재를 재확인해00:46:51링크와새clone만회수했고 별도00:47:16rootabsent/shareddeps보존·PGnet0/정식3컨테이너 불변을확인했다.

실제validator는 합성 AGENT seed의 requirements 누락을 AGENT_REQUIREMENTS_REQUIRED로 재현(1RED687.2788ms)했다. 제품검사/기준은바꾸지않고 같은seed에능력FILE_READ·환경WSL_QA만추가, 최종집중9PASS1289.5835ms/type0. workflow SHA256 B5E1339E494FB9A51F9DFF42A84D19CD18581BB0970A8F53580A2C490AFFDB47이며runnerF30B008B/wrapper3317856C/SQL5349703B/manifest464c3a31불변이다. 보완후 실제저장/조회/취소는아직미확인이다.

bootstrap의부모shell이root cwd로자식을기다려lsof가거절했을가능성은정적가설이며당시차단PID는수집하지않았다. 새bootstrap은마지막 exec bash로부모를대체하고정리guard는유지한다. 원실패를PASS로소급하지않는다.

## 대상·지문

- 새 root `/home/daon/deploy/anvil-v3-fn10-stage-queue-qa-01`, PG `anvil-v3-fn10-stage-queue-pg-01`, 내부 network `anvil-v3-fn10-stage-queue-net-01`, DB `anvil_v3_fn10_stage_queue_qa_01`.
- owner `AV3_FN10_STAGE_QUEUE_QA` + 무작위 instance, daon1000. 고정 PG15 image594290/digest6eb0add3·daemon e3349f1d, Node24.21/hash7fde7b8a.
- tmpfs512MiB·외부 port/영구volume0·생성부터10분. Node TERM150초/KILL30초, 별도정리45초/호출잔여최대5초. 생성5분경과후새실행거절.
- runner `scripts/stage-queue-isolated-qa.ts`: 43D925FFBD13E627E4BF49A9D0EED277B3B7F2588562352518A768504FD5B194
- workflow `scripts/stage-queue-pg-workflow.ts`: 3A9AAED1EB8806F122FA024C518AA5355EE431EA5BBBFFA92DFACD56DACE9BF6
- 실행/정리 원문 `scripts/stage-queue-qa-launch.sh`: 3FE03DCDCED44B04E29C73A8BE5526D337C0DFB034BB1BA6E73B73583054BC7A
- 기존51+필수선행8+0036=60manifest: 464c3a31a6d89b5da81926b1dd591a02da747f59a3cb3dc9c2631c42ac71b19d
- 0036: 5349703B2A798638B14B826962712F14E4CA162B8A7439ECDB482A199097DBD2

정식DB/서비스/계정/Secret·인증서/실Agent·비용 변경0. 공유node_modules는같은lock의읽기참조만이며 password/key는새QA메모리/Dockerenv만·값로그0이다. 전체현재migration집합검증이아니다.

## 사전 bootstrap 원문

QA_COMMIT은 게시 직후 local/private exact SHA로 사전기록한 값만 사용한다. 아래는 아직 실행 결과가 아니다.

```bash
set -euo pipefail
umask 077
root=/home/daon/deploy/anvil-v3-fn10-stage-queue-qa-01
cd /home/daon/deploy
test ! -e "$root" && test ! -L "$root"
issued=$(date +%s%3N)
/usr/bin/timeout 40s /usr/bin/git clone --quiet --single-branch --branch codex/av3-stage-b --no-checkout git@github-sinsan-develop:sinsan-develop/Anvil.git "$root"
git -C "$root" checkout --quiet --detach "$QA_COMMIT"
ln -s /home/daon/deploy/anvil-v3/node_modules "$root/node_modules"
exec /usr/bin/bash "$root/scripts/stage-queue-qa-launch.sh" "$QA_COMMIT" "$issued"
```

생성/실행 플랫폼 거절은 우회하지 않는다. bootstrap실패는현재상태/소유를읽고exact정리만수행한다. PG/net잔류시source보존·신규실행/성공선언보다회수/정확실패보고가우선이다. 고정daemon/부재·root/owner/Git/링크·process검사에실패하면삭제로넘어가지않는다. **삭제 진행 중 timeout이면 부분 삭제될 수 있으며 정리 불완전으로 판정한다.**

## 판정 제한

목표는 실제 source·Web 공통command·Fastify·비관리자PG의 저장/조회/replay/취소와 COMMIT음성이다. 관리자seed는 합성 프로젝트/방법론 준비일뿐 정식 생성·확정 흐름검증이 아니다. 동시요청 고유순번만으로 lock경합 자체를입증하지않는다. 실제browser·정식DB·확정임무생성·실Agent·전체FN10/Stage완료로승격하지않는다. 기존Poolfence는connect전후/query시작전만검사하며이미전송된query취소는보장하지않는다.
