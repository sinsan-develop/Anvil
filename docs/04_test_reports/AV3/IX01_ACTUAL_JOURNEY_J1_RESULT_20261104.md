# IX01 J1 실제 단1회 결과 — 2026-11-04

판정: UNKNOWN / NOT_CONFIRMED. 신규 컨테이너 생성 뒤 소유·격리 검산에서 멈췄다. SQL 정의/기능 시험의 실패 원인이나 제품 결함을 확정하지 않는다. 전체 IX01·계획은 미완료다.

- 직접 승인 call_ada5644124f14515a6b595baaa51bc15, 최초관측2026-11-04T05:00:20Z/전체기한05:30:20Z. 이번 단1회는 소진됐다.
- 실행code792314b3005793b7a0c2cc1a1528fc9c42d64fec/SQL a3a12bd3, packetF67ED5A955B88A02F75C61A0A43A1E1CAF2194833EEFD1EE3DD51A935D8988F8.
- 6dda65 생성전 부재/UID1000·부모소유/link·Node/image/daemon·기존 private URL 확인.569164/86729→75494b 새Git exact/clean/0700(05:03:12.003Z).
- 54f0af: /bin/bash --noprofile --norc scripts/qa-ix01-actual-journey.sh --run 단1회, exit1·부모정착05:04:37.058Z.
- statusUNKNOWN/journeyNOT_CONFIRMED/codeOWNER/stageCREATE, fullID372ceb0edf1a5c09bea21b5c20195fc35317ba9d2e2145eeaf4f3fc507f983d8·networkIdnull·completed0·receipts/roleEvidence빈값·childDiagnosticnull.
- 현재source의create→inspect→start 소비선상 최초검산 거절과 부합한다. 실제 현재 running/state/mount 원문은 확인하지 않았으므로 정지·자원잔여0을 주장하지 않는다.
- 승인한 UNKNOWN 정책대로 이후 WSL/QA 추가조회·mutation·정지·자동삭제·재실행0. 원격 감사 파일도 수거하지 않았다. 기존 DB·권한·키·서비스·Agent·P03 R3 변경0.

## 로컬에 보존한 공개 캡처

- IX01/J1_APPROVED_PLAN_20261104.json:1788B/SHA8ede4bb7ca4665575de9755908b3bafb63f9a3a30c45cad70d0435eabf110752.
- IX01/J1_CAPTURED_RESULT_20261104.json:537B/SHA4f719aec9b1f599e5a139b1a7054788cd41aa39b5e7398157206205242acb183.
- IX01/J1_CAPTURED_PARENT_20261104.json:163B/SHA480e1a79b76708ccf144b5617e51f365bc3b08937d20aa23ac75ef09804c5951.
이 세 파일은 승인계획과 이미 수신한 stdout 공개결과다. 원격 owner/intent/result 원문 수거본이 아니며 그 원격 hash를 확인한 것으로 쓰지 않는다. 비밀값은 포함하지 않는다.

## 원인 조사·후속

기존 Primary의 로컬/공식 source 읽기는 새 inspectContainer가 HostConfig.Tmpfs 정확3개뿐 아니라 top-level Mounts3개를 강제하지만 원R9 owned는 개수를 강제하지 않았음을 확인했다. CLI/Moby v28.5.1에서 --tmpfs는 HostConfig.Tmpfs, inspect Mounts는 별도 MountPoints를 소비하므로 Mounts=[] 형상이 가능하다. 정상 fixture가 Runningtrue/Mounts3만 써 공백이 있었다. 이는 강한 준비기 결함 후보지만 현재 daemon 버전·실패 inspect를 확인하지 않아 직접 원인 확정은 아니다.

공식근거: https://github.com/docker/cli/blob/v28.5.1/cli/command/container/opts.go / https://github.com/moby/moby/blob/v28.5.1/daemon/inspect.go / https://github.com/moby/moby/blob/v28.5.1/container/container_unix.go / https://github.com/moby/moby/blob/v28.5.1/daemon/create_unix.go .

현재 QA의 metadata 확인·정상 정리는 새 한정 직접 결정 전 하지 않는다. 독립적인 로컬 source 검토/수정은 승인된 내부 범위에서 계속하며 기존 gate·SQL·실패/UNKNOWN 감사를 보존한다.

## 새 직접 승인으로 확인·정리한 후속 증거

신산님 call_38ed011470c340689eb51f668887a236의 정확 J1 한정 정리 승인(후보A700B2AF)을 별도로 받았다. 새 clock2026-11-04T05:13:23Z~05:43:23Z이며 원 실행 grant를 재사용하지 않았다.

- e3276e05:15:41.656Z: daemon29.1.3/ID동일, exact container/image/labels·created/PID0/Runningfalse/StartedAt영시각, HostConfig.Tmpfs3·Mounts0, network/artifact부재·source792 exact/clean/owner 및 감사3원문을 확인했다. Config.Env·SQL·DB·컨테이너내부exec는 읽지 않았다.
- b8a988: 수거 metadata의 원792 parser 순수 replay는 OWNER, 가정 Mounts3만 넣은 반증은 수용했다. 이는 부정확한 Mounts 개수 가정을 확인하는 소스/metadata 증거이며 실제 기능 여정 재실행이 아니다.
-5e26f1 05:18:28.313Z: 미기동이라 stop생략, exact fullID rm1회 및 부재 확인.32d24f/20657→98bcbe: process269/errors0/matches0·9681files1106dirs13내부links를 소유/실경로/범위 검산한 뒤 source와 임시4만 정리했다. 감사3/새cleanup.json0600은 보존했다.
-181eea05:21:08.642Z 별도 SSH 최종조회: 등록 fullID/name/network/source/임시4/artifact부재·감사4hash동일. 실행자원잔여0, 보존감사root는 잔여0 분모와 구분한다.

원격감사 raw는 J1_REMOTE_owner_json_20261104.json(382B/b17a0832...), J1_REMOTE_slot-a1_intent_json_20261104.json(287B/4eb297c9...), J1_REMOTE_slot-a1_result_json_20261104.json(536B/40a305ae...), J1_REMOTE_cleanup_json_20261104.json(737B/d89d23c7...)에 보존했다. stdout캡처 결과에는 LF1B가 있어537B/4f719aec이며 remote result 원문과 저장형식을 구분한다. J1_CLEANUP_FIRST_METADATA_20261104.json·J1_CLEANUP_FINAL_METADATA_20261104.json·J1_CONTAINER_REMOVAL_20261104.json도 보존했다. 원 J1 UNKNOWN/NOT_CONFIRMED는 소급 PASS하지 않으며 SQL/기능 여정은 NOT_RUN이다. 새 정리 승인도 소진됐고 이후 추가 실행0이다.
