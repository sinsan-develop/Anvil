# IX01 tmpfs inspect 표현 검산 source 보완 — 2026-11-04

목표: 승인된 IX01 준비기의 잘못된 Docker 표현 가정을 바로잡고 실제 격리 기준을 보존한다. J1 actual은 OWNER/UNKNOWN으로 보존·승인소진이며 직접 원인은 미확정이다. 이 source 작업은 그 QA를 조회/정리/재실행하는 권한이 아니다.

## 근거·범위

로컬 df15c5와 기존 Primary의 공식 CLI/Moby v28.5.1 source 읽기는 --tmpfs가 HostConfig.Tmpfs, top-level Mounts는 별도 MountPoints를 소비함을 확인했다. 현재 daemon 정확 버전/실패 inspect는 아직 조회하지 않았으며 원인확정으로 승격하지 않는다. 원R9 owned는 Tmpfs 정확3을 검산하고 Mounts 개수는 강제하지 않았다. 새 parser는 추가로 Mounts3을 강제했고 unit 정상fixture는 Runningtrue/인위적3만 있었다.

단일 기존 Primary만 scripts/qa-ix01-actual-journey.sh 와 tests/unit/IX01/actual-journey-controller.test.ts 두 경로를 수정한다. Main은 코드 동시수정0·독립 검수/통합/문서/Git만 소유한다. 다른 변경·보호3·원 SQL/actual test/R9 driver/manifest/과거실패감사는 보존한다.

## 변경 전·후와 안전 기준

변경 전: 정확 HostConfig.Tmpfs3에 더해 top-level Mounts.length3을 필요조건으로 간주. 변경 후: 선언 권위인 HostConfig.Tmpfs3·각옵션을 그대로 exact 검산하고, 별도 Mounts는 빈 배열도 유효한 표현으로 처리한다. 존재하는 모든 entry는 설정된 목적지의 중복 없는 tmpfs/RWtrue·외부Source없음이어야 한다. 추가 bind/volume·누락/변조 Tmpfs·외부mount 선언은 계속 거절한다. HostConfig.Binds뿐 아니라 HostConfig.Mounts/VolumesFrom의 추가 입력도 거절해 빈 top-level 배열이 별도 외부 mount 입력을 숨기지 못하게 한다. 유효한 API 표현을 잘못 거절하던 문제의 보정이며 실제 격리·소유·합격 기준을 느슨하게 하지 않는다.

image/owner label3/fullID/UID/readonly/caps/security/log/port/network/자원한도·실제SQL/보안감사/시간한도/UNKNOWN뒤효과0은 그대로다. 설정 검산은 실제 kernel mount 실행 증명이라고 주장하지 않는다. 기존 fixture가 actual fields를 빠뜨렸다면 RW/Source와 상태를 정확히 보완하되 실패 assert/보안 음성을 지우지 않는다.

## TDD·검수

- [ ] 실제 buildCreateArgs의 --tmpfs 입력3개와 일치하는 HostConfig.Tmpfs·Mounts=[]·created/Runningfalse 정상 fixture로 현재 actual parser RED를 확인한다.
- [ ] Runningtrue/정착후/정상정지 표현에서도 Mounts3을 필수로 가정하지 않음을 확인한다. 주어진 tmpfs entries가 있으면 전부 strict 검산한다.
- [ ] 누락/변조 Tmpfs·추가 HostConfig.Mounts/VolumesFrom/Bind·bind/volume type·외부Source/RWfalse·중복/미등록목적지·label/image/network 불일치 음성을 보존/보강한다.
- [ ] actual parser를 소비한 controller 최초검산 거절에서 start·SQL·역할조회·정리0을 확인한다. 단순 문자열검사/unused helper로 대체하지 않는다.
- [ ] focused unit·필요 noEmit/Bash-n·diff/hash만 수행하고 실제 npm/SSH/Docker/PG/DB/권한/키/서비스/Agent·현재QA조회/clock/실행0을 지킨다.
- [ ] 정확 RED/GREEN/파일지문/변경전후diff·미검증·오류·writer반환/live0을 제출한다. 실제J1 원인/인수는 아직미확정이며 새실행에는 정확 새결정이 필요하다.

공식근거: https://github.com/docker/cli/blob/v28.5.1/cli/command/container/opts.go , https://github.com/moby/moby/blob/v28.5.1/daemon/inspect.go , https://github.com/moby/moby/blob/v28.5.1/container/container_unix.go , https://github.com/moby/moby/blob/v28.5.1/daemon/create_unix.go .
