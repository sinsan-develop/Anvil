# IX01 N1 격리 네트워크 검산 후보

상태는 SOURCE_ONLY_PREPARED / NOT_APPROVED_EXECUTION이다. 고정 소스는 `2a506f96e9c1c6f4fd7bfe600aa47ea25936817d`다. 새 N1 자원에서 A14가 중단된 연결 검산을 DB 없이 대조한다. N1 결과는 해당 실행 시점의 증거다. IX01의 TC01 저장·재조회에는 별도 실제 여정과 증거가 필요하다.

## 고정 자원과 권한

| 항목 | 고정값 |
| --- | --- |
| 실행자·서버 | 지정 WSL-server, UID 1000, 기존 엄격 SSH 경로 |
| Git 기준 | `git@github-sinsan-develop:sinsan-develop/Anvil.git`의 고정 소스 |
| 소스 | `/home/daon/anvil-ix01-network-attachment-20261118-n1-qa` |
| 영수증 기준 | `/home/daon/.local/share/anvil-v3-qa-receipts/ix01-network-attachment-20261118-n1` |
| 컨테이너 | `anvil-ix01-network-attachment-20261118-n1` |
| 내부망 | `anvil-ix01-network-attachment-net-20261118-n1` |
| 소유 프로필 | `IX01_NETWORK_ATTACHMENT_20261118_N1` |
| 이미지 | `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f` |
| 진입 프로세스 | 이미지의 `/bin/sleep 120`, UID:GID 999:999 |
| 실행 한도 | 준비·실행 승인 후 30분 이내, 외피 유효 5분 이내, 각 명령 최대 10초, 단회 |

기존 A14 사전검산의 Node·Git·Docker·daemon 지문을 실행기에서 재사용한다. 기존 이미지 그대로 사용하고 원래의 read-only root·cap drop·no-new-privileges·tmpfs·포트 미게시를 검사한다. PG·SQL·npm·Agent·자격증명·영속 볼륨·이미지 pull·daemon 설정 변경은 대상에서 제외한다. 단회 A14 승인은 소진됐고, 반복 승인된 J3는 고정 여정이다. N1은 독립 전용 자원에 별도 진입 프로세스와 회수 경로를 실행하므로 새로운 실행 결정이 필요하다.

## 진입 전 검산

승인 후 고정 Git 기준에서 신규 소스 경로에만 checkout한다. 이전 실행의 자원·checkout은 읽거나 사용하지 않는다. N1 경로의 부재, 보호 부모 소유·모드·nonlink와 도구/daemon/이미지 현재성을 기존 엄격 경로에서 확인한다. 실제 소스 모듈을 import하기 전에 외부 감독자가 정확 HEAD와 아래 5개를 **Git blob 및 checkout 원바이트**로 대조한다. 하나라도 어긋나면 외피를 발급하거나 실행하지 않는다.

| 경로 | 바이트 | SHA256 |
| --- | ---: | --- |
| `scripts/qa-ix01-network-attachment-probe.ts` | 22468 | `8deb4096722f6ac25ed7e6382b6f7e55f4b83e099824e62a343481ebeeed3946` |
| `scripts/qa-ix01-current-journey.ts` | 63332 | `f40c1e5ef42e7454b88166994731b3914c43c537d866fe9ca7d78ea489c346b4` |
| `contracts/canonical.ts` | 2986 | `5be93c5b92a3bda99baa9bc561e6b535c9c1ab80196601e561903a0b6f74e143` |
| `tests/integration/IX01/current-schema-baseline.ts` | 9378 | `6c574464a72cc64fb9f44476d1da6252a69fef2bce2157e95725a864b32d4f9c` |
| `tests/integration/IX01/current-schema-installation.ts` | 3402 | `0dbd658f8b9d2b484b731b04342db33d2dec216ca9ed9ac0810c9c32323f3cc1` |

N1 신규 `-plan.json`과 `-approval.json`은 각각 0600으로 배타 발급한다. N1 목적·소유 프로필·정확 sourceHead·소스 순서와 지문·시각 및 단회 승인을 일치시킨다. 실행기는 별도 보호 intent와 빈 0700 Docker 설정 디렉터리를 배타 정착한 뒤 Docker를 호출한다. 소스·도구·socket·기한이 불명이면 중단한다.

## 실행과 결과

1. 권한·소유·현재성을 검산한 뒤 N1 전용 컨테이너를 새로 만들고 `none`에서 유한 대기 프로세스만 시작한다.
2. 전용 internal bridge의 비어 있는 상태를 확인한다. 원래의 none 신원·분리·연결·교차 검산을 같은 순서와 조건으로 수행한다. 결과 출력은 단계와 고정 판정 코드만 포함한다. 유효한 자원 ID는 보호 기록에 한해 저장한다.
3. 연결과 소유를 모두 검산한 정상 경로에서는 N1의 정확 컨테이너와 망만 정리하고 잔여 검산을 한다. 실패·결과 불명·기한 소실 시 추가 조회·재시도·재시작·자동 삭제 없이 보존한다. **A1~A14와 기존 DB·권한·서비스는 전체 과정에서 보존한다.**
4. N1에서 고정 조건이 거절되면 그 조건의 원인과 승인된 보정 가능성을 우선 검토한다. 정상 검산이면 해당 환경의 연결 호환성 증거를 보존한다. 두 결과 모두 A14의 실제 원인을 소급 확정하거나 TC01 PASS로 올리는 근거로 사용하지 않는다.

## 검수와 미검증

- 기존 담당자 직접 8건·인접 3건 통과. Main 직접 `node --test --test-reporter=spec tests/unit/IX01/network-attachment-probe.test.ts` 8통과·실패/건너뜀0(2c03d8), 타입·diff 종료0 및 파일 지문 일치(9a91fe).
- 별도 담당 d2_preflight가 제출된 동일 3파일 지문에 대해 Critical 0 / Important 0을 확인했다. Main이 고정 Git blob 5개와 실행 권한·기한·정리 범위를 대조했다.
- 실제 외피 발급, 소스 checkout, N1 생성·실행·정리는 미실행이다. 현재 호스트·보호 파일 정착·빈 Docker 설정·`/bin/sleep` 존재와 실제 연결 표현은 미확인이다.
