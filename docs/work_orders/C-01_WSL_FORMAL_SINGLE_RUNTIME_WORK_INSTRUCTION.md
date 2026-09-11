# WI-C-01-WSL-FORMAL-SINGLE-RUNTIME-20260911-001

## 판정과 권위

- 신산님은 C-01 개발·테스트를 추가 승인 요청 없이 완료하고, Git exact commit을 WSL-server의 정식 컨테이너 `anvil-web`·포트 `3770`으로 재배포해 검증하도록 승인했다.
- WSL-server는 Test/Staging이며 ysna-server Production 전환은 이번 범위가 아니다.
- 제품 후보: `bb2ff4374c81865cab127eca14d3d4c9de575465`.
- 제품 부모: `fd3c89665629addd78e74c2fe946fb9dfc893c36`.
- 불변 제품 ref: `refs/heads/candidates/c01-step-execution-bb2ff43` (exact `bb2ff43`).
- 기존 WSL runtime revision: `7b7e7cc0269b22115fd4ffe82bbe1f847e05f2bd`.

## 실행 범위

1. 별도 clean detached control checkout에서 이 WorkInstruction과 manifest·스크립트·테스트가 포함된 단일 direct-child commit을 확인한다.
2. `/srv/anvil-wsl/repo`의 private development origin에서 제품 전용 불변 candidate ref를 fetch하고 exact 제품 후보를 clean detached checkout한다.
3. `deploy/ysna/Dockerfile.web`로 `anvil-web:<exact SHA>` 이미지를 build한다.
4. 기존 정식 `anvil-web` 하나의 허용된 runtime environment만 root-only 임시 파일로 보존한다. 값은 출력하지 않고 실행 종료 때 삭제한다.
5. 기존 `anvil-web`을 정상 stop·remove한 뒤 같은 이름, 같은 `0.0.0.0:3770`, 같은 `proxy-network`, 같은 host-gateway·restart 속성으로 한 번만 교체한다.
   - `HostConfig`의 all-interface 요청 표기 `HostIp=""`와 `HostIp="0.0.0.0"`는 동등하게 허용하되, `NetworkSettings.Ports`의 실제 resolved binding에 IPv4 `0.0.0.0:3770`이 반드시 존재해야 한다. loopback·다른 port·다른 address는 거부하고 선택적 IPv6 `:::3770`만 함께 허용한다.
6. 새 runtime에 read-only rootfs, init, cap-drop ALL, no-new-privileges, tmpfs와 healthcheck를 적용한다.
7. exact revision·컨테이너 수1·health/readiness0013·UI·Provider Workbench·OpenAPI execute path·인증 상태를 검증한다.
   - 공유 WSL host의 Docker inventory는 이름이 `anvil` 자체이거나 `anvil-` 또는 `anvil_`로 시작하는 Anvil 소유 자원으로 한정한다. 실행 전 정식 `anvil-web` 외 Anvil 컨테이너·네트워크·볼륨이 하나라도 있으면 거부하고, 실행 중 새 Anvil 자원이 생겨도 거부한다.
   - 다른 프로젝트 이름의 자원 변동은 Anvil 배포가 생성·변경한 것으로 판정하지 않는다. Docker 목록 조회 자체가 실패하면 계속 거부한다.
8. 교체 후 검증 실패 시 기존 exact image를 같은 이전 속성으로 즉시 복구하고 app checkout도 이전 revision으로 되돌린다.

## 금지 범위

- 추가 컨테이너·네트워크·볼륨, migration 컨테이너 및 Compose stack 생성
- DB write/migration, `.env` 수정, permission scope 추가
- Provider·Telegram 호출과 Secret 값 출력
- `/home/daon/deploy/anvil`, legacy C-21 control, ysna-server, Production, main 변경

## 완료 조건

- 정적 계약 테스트와 manifest 변조 거부 테스트 PASS
- control commit exact direct-child 및 exact5 path 검증 PASS
- 배포 실행 영수증이 `VERIFIED`, candidate SHA exact, `anvil-web` count1, port3770, 외부 호출·DB write·추가 runtime resource 0을 기록
- 실제 브라우저에서 WSL Dashboard와 Provider Workbench가 표시되고 same-origin 요청만 사용하는지 확인
