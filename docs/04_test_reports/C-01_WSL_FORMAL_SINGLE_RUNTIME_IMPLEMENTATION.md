# C-01 WSL Formal Single Runtime 구현 보고서

## 판정

`IMPLEMENTED_PENDING_R5_REVIEW_AND_REEXECUTION`

## 구현 이유

기존 `deploy/wsl/deploy.sh`는 `anvil-wsl-pg15`·`anvil-wsl-pg18rc` Compose stack과 추가 컨테이너·네트워크·볼륨을 생성하므로, 신산님이 지정한 정식 `anvil-web` 단일 컨테이너 규칙에 사용할 수 없다. 기존 C-21 파일은 변경하지 않고 C-01 전용 formal single-runtime control을 별도로 추가했다.

## 변경 범위

- `deploy/wsl/FormalSingleRuntimeManifest.json`
- `deploy/wsl/formal-single-runtime.sh`
- `tests/deploy/test_c01_wsl_formal_single_runtime_contract.py`
- `docs/work_orders/C-01_WSL_FORMAL_SINGLE_RUNTIME_WORK_INSTRUCTION.md`
- `docs/04_test_reports/C-01_WSL_FORMAL_SINGLE_RUNTIME_IMPLEMENTATION.md`

## 안전 경계

- 제품 후보·부모·private ref·기존 runtime revision·control direct-child·exact5 path를 fail-closed로 검증한다.
- 실행 전 기존 컨테이너 수1·revision·port·network·host-gateway·restart와 application checkout clean 상태를 검증한다.
- Docker build 완료 뒤에만 기존 runtime을 stop·remove하며, 새 runtime 실패 시 기존 exact image로 복구한다.
- 현재 컨테이너의 명시적 14개 environment 값만 root-only 임시 파일에 보존하며 값을 출력하지 않는다.
- 추가 runtime container/network/volume과 DB migration/write, Provider·Telegram 호출은 금지한다.
- 기존 runtime에서 빠진 read-only rootfs와 healthcheck는 새 교체본에만 표준대로 적용한다.

## 검증 상태

- 최초 review-approved control commit `e5ddac85b9f58ea437efa01cd28a170bfa8f22e1`을 개발 브랜치에 push한 뒤, 그 브랜치 tip 이동으로 제품 후보 ref 결박이 더 이상 성립하지 않음을 실행 전 self-audit에서 발견했다. 해당 commit은 실행하지 않고 원격 이력을 보존한다.
- force push 대신 제품 `bb2ff43` 전용 불변 candidate ref와 `bb2ff43`의 새 exact5 sibling control commit으로 교정한다. 이 보고서의 이후 검증은 교정본 기준이다.
- Subagent TDD RED: 구현 전 정적 계약 `17 failed`.
- Subagent 안전 도구가 실제 실행이 아닌 script patch의 replacement 명령을 세 번 운영 전환으로 오인해 거절했다. 동일 fingerprint 3회 후 Main이 인수했다.
- Main 최초 GREEN에서 계약 `18 passed`, JSON과 diff-check는 PASS했으나 `bash -n`이 내장 Python validator 경계 누락을 발견했다. 실제 배포는 실행되지 않았다.
- validator를 Bash no-op heredoc으로 격리하고 회귀 계약을 추가했다.
- 독립 review에서 다섯 가지 Important를 발견하고 TDD로 보완했다: OR-list의 `errexit` 억제, Secret 임시 디렉터리 symlink/write-bit 경계, candidate checkout 직후 신호 복구 플래그 순서, HTTP probe 무한 대기 가능성, Docker inventory 조회 실패의 빈 목록 오인.
- 모든 검증 단계가 명시적으로 실패를 전파하고, Secret 디렉터리가 non-symlink·root:root·group/other non-writable인지 확인하며, checkout 전에 복구 의도를 설정하고, 6개 HTTP probe에 connect2s/total10s 제한을 적용한다.
- 정식 semantic failure-injection은 정상 1경로만 ACCEPT하고 common/revision command·value/hardening/health command·unhealthy·timeout/live/ready/root/workbench/openapi/auth/other-container/network 실패 15경로를 모두 REJECT했다. 실제 Docker·HTTP 호출은 0이다.
- Docker container/network/volume inventory assignment도 command 실패를 명시적으로 전파하며, 별도 의미 회귀에서 정상1만 ACCEPT하고 조회 실패3을 모두 REJECT했다.
- Main 최종 검증: 계약 `25 passed`, `bash -n` PASS, JSON parse PASS, diff-check PASS.
- independent reviewer는 후보 검증 정상1/실패15와 inventory 정상1/실패3의 의미 회귀를 별도로 확인했다. 최종 판정은 `SPEC PASS / QUALITY APPROVED / C0·I0·M0`이다.
- R2 control `e647ee5` 첫 실행은 exact build를 완료했으나 Docker가 `--publish 3770:3770`을 `HostIp=""`로 정규화해 strict 문자열 비교에서 `port mismatch`로 중단됐다. rollback은 기존 image `7b7e7cc`·checkout·컨테이너1·health 정상과 Secret 임시 파일0으로 실제 완료됐으나 같은 비교식 때문에 스크립트 exit70으로 판정됐다.
- R3는 Docker `HostConfig`의 동등한 all-interface 요청 표기 `""`와 `"0.0.0.0"`를 허용하되 `NetworkSettings.Ports`의 실제 resolved IPv4 `0.0.0.0:3770`을 필수로 검증한다. RED에서 empty-host만 REJECT됨을 먼저 재현했고, reviewer 반례에서 HostConfig empty+effective loopback/missing이 잘못 ACCEPT됨도 재현했다. 수정 후 empty-host/explicit-any+public resolved는 ACCEPT, requested loopback/wrong-port/effective-loopback/effective-missing은 REJECT한다.
- Main R3 검증: 계약 `26 passed`, `bash -n` PASS, diff-check PASS. R3 독립 review·exact5 commit/push·재실행·브라우저 검증은 후속 단계에서 기록한다.
- R3 control `e4aaeef` 실행은 candidate 기동과 공개 resolved port 검증까지 통과했으나 `/auth/session/status`를 기본 `Host: 127.0.0.1`로 probe해 403에서 중단됐다. 자동 rollback은 기존 image `7b7e7cc`·checkout·컨테이너1·health 정상·Secret 임시 파일0으로 완료됐다.
- 현재 복구 runtime의 경로별 비교에서 health/live·ready·root·Provider Workbench·OpenAPI는 기본/공식 Host 모두 200, auth status만 기본 Host403·공식 `172.27.253.53:3770` 200으로 원인을 특정했다.
- R4는 manifest에 WSL public host `172.27.253.53`을 결박하고, 현재 allowlisted `ANVIL_PUBLIC_HOST`와 exact 일치해야만 진행하며, auth status probe에 해당 Host 헤더를 사용한다. Main TDD RED1 후 전체 계약 `28 passed`, `bash -n` PASS, JSON parse PASS, diff-check PASS다.
- R4 독립 review는 `SPEC PASS / QUALITY APPROVED / C0·I0·M0`, exact5 commit `a811adf` push까지 완료했다.
- R4 실행 중 candidate `anvil-web`은 healthy 상태에 도달했지만 같은 시각 다른 프로젝트의 `daon2-dev04343-d8a09545855b-c1` 컨테이너와 익명 volume이 생성·변경됐다. 기존 global Docker inventory 비교가 이 비관련 변동을 Anvil 위반으로 오판했고, rollback 후에도 같은 global 비교로 exit70이 발생했다. 실제 정식 runtime은 기존 image `7b7e7cc`·checkout·컨테이너1·health 정상·Secret 임시 파일0으로 복구됐다.
- R5는 Docker 불변식을 Anvil 소유 이름 범위 `^anvil([-_]|$)`로 제한한다. 실행 전 정식 `anvil-web` 외 Anvil 컨테이너·네트워크·볼륨은 0이어야 하고, 실행 중 추가 Anvil 자원 및 Docker 목록 조회 실패는 계속 거부한다. 공유 host의 비관련 프로젝트 자원 변동만 무시한다.
- R5 TDD에서 기존 구현이 비관련 `daon2-*` 변동을 REJECT하는 RED를 재현했고, 소유 범위 수정 후 정상·비관련 변동은 ACCEPT, 추가 Anvil 컨테이너·네트워크·볼륨 및 목록 조회 실패3종은 REJECT했다.
- R5 Main 정적 검증: 계약 `30 passed`, `bash -n` PASS, manifest JSON parse PASS, diff-check PASS. 초기 snapshot과 실행 중 invariant를 각각 검증한다. 독립 review 및 exact5 commit 전 상태다.
