# F-18 R43B2 WSL-server 격리 runtime 검증

## 사전 판정

- 상태 `NOT_STARTED`; R43B1 합성 issuer 로컬·정적 결과와 R43A Compose config는 실제 runtime 인수가 아니다. F-18 `accepted=false`, F-19 blocked, Production `NOT_EXECUTED`.
- 시작 전 원격 read-only inventory: `ssh WSL-server`의 Docker Compose v5.1.1, `/home/daon/anvil-f18-r43b2-qa`·`/srv/anvil-wsl/f18-ops-rehearsal` 부재, WSL TCP 8444 listener 없음, F18 cleanup label 컨테이너 없음, 공유 `anvil-web` healthy·`local-postgres` Up. `/srv/anvil-wsl`은 root:root 755이므로 새 checkout은 `/home/daon` 전용 경로를 사용한다. 지정 SSH Git 별칭은 `c6baa6a75da984ba3f077e6e684078aea93100f2`를 읽을 수 있다.

## 생성 예정 전용 자원과 수명

- WSL-server owner OS `daon`, Main 검증 소유: Git checkout `/home/daon/anvil-f18-r43b2-qa`, Git 밖 합성 material `/home/daon/anvil-f18-r43b2-material`. 생성 전 두 경로 부재·realpath·owner 재확인; 작업 수명은 이번 R43B2 단회 QA이며 종료/실패 시 둘 다 제거 후 부재 확인. material에는 합성 CA/cert/key, issuer signing key, client-secret, trust JSON, Compose env만 두고 Git·로그에 원문을 남기지 않는다.
- 전용 Compose project `anvil-f18-r43b2`, services web/api/worker/postgres/minio/oidc-issuer, network project prefix 한정. Web `127.0.0.1:8444`만 host publish. 이 project의 컨테이너·network·합성 PG18 DB `anvil_f18_qa`/role `anvil_app`은 `docker compose -p anvil-f18-r43b2 ... down --remove-orphans`로 제거한다. 다른 Compose project나 공유 DB/서비스는 만지지 않는다.
- 전용 태그 `anvil-f18-r43b2-web:<exact12>`, `...-api:<exact12>`, `...-worker:<exact12>`, `...-issuer:<exact12>`의 Git archive exact SHA build 이미지 4개, 이미지 ID/revision label과 참조 컨테이너를 확인한 후 전용 ID만 제거한다. PostgreSQL 18·MinIO 검증 이미지 ID는 공유 cache로 간주해 삭제하지 않는다. Docker volume은 만들지 않고 PG18/MinIO 임시 데이터는 Compose tmpfs만 사용한다.
- Windows 로컬 8444 SSH tunnel process 1개와 격리 Chrome 임시 프로필/프로세스·시험 산출물은 실제 실행 직전 경로/PID를 추가 기록한다. 기존 Chrome 프로필·탭·계정과 OS 전역 인증서 저장소는 사용·변경하지 않고 종료 후 정확한 PID/path만 제거한다.

## 결과

아직 실행하지 않았다. 시작 후 각 명령·exit code·정확한 SHA/image ID·거부·브라우저·정리 증거를 누적 기록한다.
