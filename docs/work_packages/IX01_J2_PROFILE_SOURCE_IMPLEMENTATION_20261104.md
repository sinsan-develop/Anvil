# IX01 J2 새 단발 profile source 준비 — 2026-11-04

목표: J1 실제/정리 단발은 소진·감사보존됐으므로 해당 namespace/intent를 재사용하지 않고 다음 새 빈 J2 profile 코드만 준비한다. 기본/plan효과0·실제실행미승인이다. 기준27e3b35262dfdbb46dc4e72edd66715d89a9f3a2의검수된tmpfs/30시험·UNKNOWN정책을그대로보존한다.

단일기존Primary소유: scripts/qa-ix01-actual-journey.sh 및 tests/unit/IX01/actual-journey-controller.test.ts 두경로만. Main동시코드쓰기0·다른변경/보호3보존. 새파일/구조/계약/SQL/실시험/manifest/원R9driver/기존실행후보/감사변경0.

## 정확 profile 변경표

- source: /home/daon/anvil-ix01-journey-20261104-j1-qa → /home/daon/anvil-ix01-journey-20261104-j2-qa
- receipt: /home/daon/.local/share/anvil-v3-qa-receipts/ix01-journey-20261104-j1 → /home/daon/.local/share/anvil-v3-qa-receipts/ix01-journey-20261104-j2
- artifact: /tmp/anvil-v3-ix01-journey-20261104-j1/artifacts → /tmp/anvil-v3-ix01-journey-20261104-j2/artifacts
- container: anvil-ix01-journey-pg-20261104-j1-a1 → anvil-ix01-journey-pg-20261104-j2-a1
- network: anvil-ix01-journey-net-20261104-j1-a1 → anvil-ix01-journey-net-20261104-j2-a1
- database: anvil_v3_ix01_20261104_j1_a1 → anvil_v3_ix01_20261104_j2_a1
- owner: IX01_JOURNEY_20261104_J1 → IX01_JOURNEY_20261104_J2

위7개 fixed 상수만 바꾼다. legacy.bootstrapSql의 원R9 literal과 hash·SQL a3a12bd3/105 index/order,Node/npm/image/daemon·testHash·controller/actualports·tmpfs보안·단발/기한/UNKNOWN·진단한계는불변이다. 실행code/instance는후속commit을Main이동결하므로미리임의생성하지않는다. J1감사root/정리파일은절대이동·삭제·재사용하지않는다.

## TDD·검수

- [ ] 신규focused반례로새7개literal과default/plan J2표시,Inspector가원J1 label/name/instance형상을소유로채택하지않음을확인한다. 아직J2 source가없을때기대한RED를수집한다.
- [ ] 위7개상수만최소치환하고신규집중검사GREEN을수집한다. 이름/상수역치환시부모script raw가완전히동일해야한다.
- [ ] 기존30시험/fixture는보존하고기존동일controller/검증전수반복은하지않는다. 신규시험이기존원코드행동에영향주는근거가있으면정확범위만추가검증한다. 필요구문/diff/hash를확인한다.
- [ ] 과거J1 captured실metadata를음성참고로읽을수있으나현재J2사실로변조/승격하지않는다. 새profile의커널mount/DB/권한/로그인/기능·환경은NOT_RUN이다.
- [ ] 정확변경전후·역치환·명령/RED/GREEN/지문/오류/미검증·writer반환/live0을제출한다.

실제SSH/WSL/Docker/npm설치/DB/권한/키/서비스/Agent/새QA경로조사·생성·시각발급/실행0,Git/외부메시지0. J1원UNKNOWN과정리승인소진·잔여0/감사를보존하며새실행에는정확J2후보와새직접결정이필요하다.
