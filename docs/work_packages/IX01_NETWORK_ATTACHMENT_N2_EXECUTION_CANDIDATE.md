# IX01 N2 고정 CIDR 연결 검산 후보

상태는 **소스 준비·실행 미승인**이다. 고정 소스는 `80a227e22da9919d86a4c09ca17252233fff386b`다. N1은 연결 후 허용 CIDR 추출에서 중단됐다. N1의 실제 주소나 프리픽스 및 A14의 원인은 미확인이다. N2의 목적은 기존 허용 범위 안에서 주소를 지정하면 현재 WSL 환경의 연결 검산을 통과하는지 확인하는 것이다.

## 범위와 실행 조건

- 지정 WSL-server의 새 N2 컨테이너 `anvil-ix01-network-attachment-20261118-n2`와 새 내부망 `anvil-ix01-network-attachment-net-20261118-n2`만 사용한다. 소스는 `/home/daon/anvil-ix01-network-attachment-20261118-n2-qa`, 영수증 기준은 `/home/daon/.local/share/anvil-v3-qa-receipts/ix01-network-attachment-20261118-n2`다. 소유 프로필은 `IX01_NETWORK_ATTACHMENT_20261118_N2`다.
- [N1 실행 후보](IX01_NETWORK_ATTACHMENT_N1_EXECUTION_CANDIDATE.md)의 엄격 SSH·고정 Git·도구/daemon/image 신원·무게시/무영속 볼륨·UID 999 및 `/bin/sleep 120`을 재사용한다. A1~A14·N1의 대상별 조회나 변경, 기존 망·daemon·호스트 경로 변경, SQL·DB·권한·키·서비스·Agent는 제외한다.
- 고정 후보 CIDR은 **172.30.250.0/28**이다. 허용 172.16~31 및 /16~32 내에 있고 해당 호스트의 충돌 여부는 미확인이다. 신규 망 생성에 `--subnet`으로 명시하며, 중복 거절이나 결과 불명이면 중지한다. 다른 CIDR 탐색·대체·재시도는 하지 않는다.
- 별도 실행 승인 범위 안에서 생성 직전에 동일 WSL 호스트의 이 CIDR과 겹치는 로컬 IPv4 주소·비기본 경로가 있는지 읽기 전용으로 1회 확인한다. CIDR 안에 있는 주소와 이 CIDR을 포함하거나 이 CIDR에 포함되는 비기본 경로를 검사한다. 필요한 현재성·범위 확인이 불가능하거나 결과가 불명확하면 외피를 발급하지 않는다. 결과는 일치 여부만 남기고 주소·경로 원문과 기존 Docker 망 자료는 수거하지 않는다. 이 대조는 그 시점의 호스트 관측이다. Docker 생성 성공을 호스트 경로 검증으로 사용하지 않는다.
- 준비·실행은 승인 후 30분 이내, 외피 5분·명령 10초·프로세스 120초 한도, 단회다. 기존 strict 연결에서 신규 대상 부재와 보호 경로를 확인한 뒤 정확 Git 소스와 아래 원바이트를 대조하고 N2 전용 외피를 배타 발급한다. plan에 `subnet` 필드를 추가하며 승인 외피는 해당 전체 plan 해시에 결박한다. N1 외피는 재사용하지 않는다.

## Git 원본

| 경로 | 바이트 | SHA256 |
| --- | ---: | --- |
| `scripts/qa-ix01-network-attachment-probe.ts` | 23757 | `197deae4c0e29da8c15a28d158565a33d7d7aaec1e4569270ecfd9082941cdea` |
| `scripts/qa-ix01-current-journey.ts` | 63332 | `f40c1e5ef42e7454b88166994731b3914c43c537d866fe9ca7d78ea489c346b4` |
| `contracts/canonical.ts` | 2986 | `5be93c5b92a3bda99baa9bc561e6b535c9c1ab80196601e561903a0b6f74e143` |
| `tests/integration/IX01/current-schema-baseline.ts` | 9378 | `6c574464a72cc64fb9f44476d1da6252a69fef2bce2157e95725a864b32d4f9c` |
| `tests/integration/IX01/current-schema-installation.ts` | 3402 | `0dbd658f8b9d2b484b731b04342db33d2dec216ca9ed9ac0810c9c32323f3cc1` |

## 판정과 복귀

망 생성 직후와 연결 뒤 동일 단독 IPAM subnet을 확인한다. 기존 소유·단독 연결·주소·endpoint 검산 후 정상 호스트 범위, gateway 제외, 양쪽 /28을 대조한다. 완전 정상인 경우에만 원 소유 N2 두 자원을 정리한다. 실패·불명 시 후속 조회·재시도·재시작·자동 삭제 없이 보존한다.

정상 결과는 N2 시점의 네트워크 호환성만 입증한다. N2가 정상적으로 정리되고 주소 충돌 조건까지 검산되면, 기존 보호 검사와 범위를 유지하며 동일한 생성 계약을 반영한 TC01 시험안으로 돌아간다. TC01 실제 저장·재조회는 별도 실행 증거가 있어야 충족된다.
