# F-18 R43D WSL-server 격리 runtime 재검증

## 사전 판정과 자원 계획

- `NOT_STARTED`. 제품 R43C `e3a1b0bdbe62f68b37a4798be6f16f91e3208bd9`의 로컬 164 PASS는 실제 WSL runtime 인수가 아니다. F-18 `accepted=false`, F-19 blocked, Production `NOT_EXECUTED`.
- Main 전용 checkout `/home/daon/anvil-f18-r43d-qa`, Git 밖 합성 material `/home/daon/anvil-f18-r43d-material`은 WSL-server user `daon` 소유·이번 검증 1회 수명이다. 생성 전 두 경로 부재, WSL 8444 listener 없음, Docker Compose v5.1.1 및 공유 `anvil-web` healthy·`local-postgres` Up을 읽기 전용 확인했다. material은 합성 CA/TLS, signing key, client Secret, trust JSON, Compose env만 두며 credential 원문은 기록하지 않는다.
- Compose project `anvil-f18-r43d`, services Web/API/Worker/PG18/MinIO/QA issuer, 전용 container/network. Web만 WSL loopback8444 publish. Git archive exact SHA에서 전용 Web/API/Worker/issuer image 4개를 build/label 확인 후 이번 수명 끝에 force 없이 제거한다. PostgreSQL18/MinIO cache는 공유로 보존하고, 전용 DB/role/data는 project tmpfs와 함께 제거한다. 기존 공유 project/DB/image는 만지지 않는다.
- Windows `127.0.0.2:8444` SSH tunnel과 `C:\Users\cyhuh\AppData\Local\Temp\anvil-f18-r43d-chrome-profile`은 생성 전 부재를 확인했다. 기존 WSL relay가 점유한 Windows `127.0.0.1:8444`, 기존 Chrome 프로필·탭·계정, OS 전역 CA는 사용·변경하지 않는다. exact PID/profile 확인 후 전용 자원만 종료·제거한다.
- API proxy trust는 초기 loopback placeholder, Web internal-network의 실제 단일 IPv4 검증 후 그 값으로 API 재생성·Web restart한다. 두 컨테이너의 ID/IP/env와 project/network label을 최종 검사하며 drift 시 FAIL한다. wildcard/CIDR/다중 IP는 사용하지 않는다. 결과와 실제 자원 ID·정리 판정은 실행 후 누적한다.
