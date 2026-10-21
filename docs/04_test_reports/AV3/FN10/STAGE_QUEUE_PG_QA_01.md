# FN10 새 빈 PG 대기 요청 QA 01

상태: 실제PG 미실행. 담당 Main 어울, 2026-10-22. 공식 D:\Project\Anvil / codex/av3-stage-b의 게시 exact commit만 사용한다.

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
bash "$root/scripts/stage-queue-qa-launch.sh" "$QA_COMMIT" "$issued"
```

생성/실행 플랫폼 거절은 우회하지 않는다. bootstrap실패는현재상태/소유를읽고exact정리만수행한다. PG/net잔류시source보존·신규실행/성공선언보다회수/정확실패보고가우선이다. 고정daemon/부재·root/owner/Git/링크·process검사에실패하면삭제로넘어가지않는다. **삭제 진행 중 timeout이면 부분 삭제될 수 있으며 정리 불완전으로 판정한다.**

## 판정 제한

목표는 실제 source·Web 공통command·Fastify·비관리자PG의 저장/조회/replay/취소와 COMMIT음성이다. 관리자seed는 합성 프로젝트/방법론 준비일뿐 정식 생성·확정 흐름검증이 아니다. 동시요청 고유순번만으로 lock경합 자체를입증하지않는다. 실제browser·정식DB·확정임무생성·실Agent·전체FN10/Stage완료로승격하지않는다. 기존Poolfence는connect전후/query시작전만검사하며이미전송된query취소는보장하지않는다.
