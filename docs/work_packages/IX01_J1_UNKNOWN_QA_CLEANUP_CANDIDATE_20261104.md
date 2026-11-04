# IX01 J1 UNKNOWN QA 한정 확인·정리 후보 — 2026-11-04

상태: NOT_APPROVED. 원 J1 결과는 UNKNOWN/보존이며 원 실행 승인은 소진됐다. 새 직접 결정 전 후속 원격 조회·변경·삭제0이다. 이 후보는 SQL/시험 재실행 허가가 아니다.

## 정확 대상·목적

- daemon ID e3349f1d-dbfc-478a-96d9-295bf6c6839e/SINSAN·WSL-server/daon1000의 이번 QA만 확인한다. 공개 daemon 버전·상태 metadata도 확인할 수 있으나 키/DB는 읽지 않는다.
- 컨테이너 fullID372ceb0edf1a5c09bea21b5c20195fc35317ba9d2e2145eeaf4f3fc507f983d8 / anvil-ix01-journey-pg-20261104-j1-a1. image sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f.
- owner IX01_JOURNEY_20261104_J1 / instance792314b3005793b7a0c2cc1a1528fc9c / planHash8ede4bb7ca4665575de9755908b3bafb63f9a3a30c45cad70d0435eabf110752.
- source /home/daon/anvil-ix01-journey-20261104-j1-qa / Git792314b3005793b7a0c2cc1a1528fc9c42d64fec/driverSHA207c073f29eedab7e4e21d08d50c0a317ed6be52b1befcee9b402b62f18645d6.
- receipt /home/daon/.local/share/anvil-v3-qa-receipts/ix01-journey-20261104-j1 의 owner.json,slot-a1.intent.json,slot-a1.result.json은 보존·비밀 없는 원문/hash 수거 대상이다.
- 같은 receipt의 docker-config,npm-cache,npm-user.conf,npm-global.conf 네 임시 대상과 source/node_modules는 소유 검산 후 정리할 수 있다. 새 cleanup.json0600 metadata를 보존한다.
- network anvil-ix01-journey-net-20261104-j1-a1 및 /tmp/anvil-v3-ix01-journey-20261104-j1은 부재 여부만 확인한다. 존재하면 본 후보로 삭제/연결하지 않고 그 미충족을 보존한다.

## 허용 순서·검산

1. 새 승인을 최초 관측한 시각부터30분, 단1회. 대상 ID/name/image/labels·소유·realpath/link·code/계획·현재 state를 읽는다. 컨테이너 Env/비밀번호·원사용자자료·SQL/DB접속·pg exec·권한/키변경은0이다. inspect는 State,Labels,User,HostConfig,Mounts,NetworkSettings 등 공개소유/격리 필드만 사용하고 Config.Env는 읽지 않는다.
2. 원 plan hash·label3·image·999:999·readonly/capdrop/no-new-privileges/lognone·hostpublish/bind/volume접근0·정확 Tmpfs data/socket/tmp3 설정을 검산한다. --tmpfs의 HostConfig.Tmpfs와 inspect Mounts 표현을 구분한다. Mounts가 비어 있어도 곧바로 원인 확정하지 않고 별도보존한다. 실제 entries가 있으면 등록목적지의 tmpfs/RW이고 외부Source·bind·volume이 없어야 한다. 다른 신원/추가 자원이면 정리하지 않는다.
3. 신원이 일치하면 running일 때만 docker stop --time 5를 한 번 호출하고 정착/실제 runningfalse를 확인한다. 이미 created/exited·Pid0이면 정지를 생략한다. 정지 결과/신원이 불명이면 추가조회·삭제·재시도 없이 보존한다. --force rm·볼륨 삭제는 금지한다.
4. 정착된 대상만 docker container rm fullID 한 번으로 제거한다. 삭제 불명이면 후속 조회·추가삭제를 멈춘다. 확정 성공에만 정확 name/fullID 부재를 검산한다.
5. source와 임시4경로를 읽기전용 process metadata로 사용process0·daon소유·보호 부모체인·nonlink root·exactcode/clean tracked로 검산한다. 재귀 조사도 이 등록 QA 안의 metadata만이며 링크를 따라 외부 자료를 조사하지 않는다. 확인된 source와 네 임시 대상만 제거하고 감사3/cleanup은 보존한다. 소유/정리 불명은 추가동작0이다.
6. 모든 정리가 확정 성공인 경우에만 별도 최종 metadata 조회로 ID/name/source/임시4 부재와 감사보존을 확인한다. 원격 감사는 로컬 정본에도 원문/hash로 남긴다. 부재 미충족/불명은 잔여0/PASS로 바꾸지 않는다.

## 제외·결과

새 PG/network/artifact/DB 생성·SQL/로그인/자료여정 재실행·권한/키/서비스/Agent·P03 R3·기존 network/volume/DB/인증서/운영/Oracle/ysna는 제외한다. 컨테이너 내부 프로세스 실행이나 Secret/Env 조회도 하지 않는다. 원 OWNER/UNKNOWN은 정리 성공으로 소급 PASS되지 않는다. 원인 분석은 수거한 공개 metadata와 로컬/공식 source만 대조한다. 정리/신원/출력이 불명이면 이 새 승인에서도 재실행·후속조회·자동삭제 없이 보존하며 기한 이후 자원이 남을 수 있다.
