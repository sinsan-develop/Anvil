# C-21 NPM upstream DNS refresh 진단

## 판정

`GIT`이나 Docker DNS 자체의 장애가 아니라 배포 순서 결함이다. `deploy-public-preview.sh`는 `anvil-web`을 recreate한 뒤 Nginx Proxy Manager(NPM)를 reload하지 않는다. NPM proxy host 8의 `/api`, `/health`, `/integrations`는 literal `proxy_pass http://anvil-web:3770`을 사용하므로 Nginx configuration load 시 해석한 컨테이너 IP를 worker가 계속 사용한다. 이전 `anvil-web` IP가 다른 컨테이너에 재할당되면 Docker DNS의 현재 결과가 정상이어도 NPM worker는 이전 IP로 요청을 보낼 수 있다.

영구 해결은 사용자의 상시 설정이 아니라 표준 배포 절차 안에서 수행하는 `NPM DNS 확인 -> configuration test -> graceful reload -> 실제 공개 요청의 새 컨테이너 도달 확인`이다. NPM 컨테이너 재시작이나 고정 IP는 필요하지 않다.

## 2026-09-02 읽기 전용 운영 증거

- NPM: `nginx-proxy-manager`, image `jc21/nginx-proxy-manager:latest`, `proxy-network`, IP `172.20.0.2`, 11일간 실행 중.
- 새 unified runtime: `anvil-web`, IP `172.20.0.18`, 동일 `proxy-network`.
- NPM 내부 현재 Docker DNS: `getent hosts anvil-web` -> `172.20.0.18`.
- proxy host: `/data/nginx/proxy_host/8.conf`, `anvil.sinsan.kr`, upstream `anvil-web:3770`.
- `/api`, `/health`, `/integrations`는 literal `proxy_pass`다. `deploy-public-preview.sh`에는 NPM `nginx -t` 또는 reload 단계가 없다.
- NPM 구성 자체는 현재 `nginx -t` PASS다.
- 이번 조사에서는 NPM reload, 파일 변경, 컨테이너 recreate/removal, DB/Telegram mutation을 수행하지 않았다.

따라서 `getent`가 새 주소를 반환한다는 사실만으로 active Nginx worker가 새 주소를 사용한다는 것이 증명되지 않는다. 공개 요청을 새 `anvil-web` access log의 고유 probe ID와 결합해 검증해야 한다.

## 별도 발견: Telegram legacy override

활성 NPM 전역 custom include에 다음 파일이 존재한다.

- exact path: `/data/nginx/custom/server_proxy.conf`
- byte size: `145`
- SHA-256: `406052ff7d4764bd23d03d7bef48db01c9683f801c010dc41ba24c7d2d1593cf`
- exact content: `location = /integrations/telegram/webhook { proxy_pass http://anvil-internal-web-1:4173/integrations/telegram/webhook; proxy_http_version 1.1; }`

이 exact location은 proxy host 8의 `/integrations` prefix보다 우선한다. 이를 유지한 채 Telegram signed POST가 성공하면 unified `anvil-web:3770` 검증이 아니라 legacy internal 검증이다. 그 후 `anvil-internal-web-1`을 제거하면 Telegram webhook이 중단된다. 따라서 이 override를 제거하고 새 public runtime 도달을 증명하기 전에는 Telegram PASS 또는 internal 제거를 허용하면 안 된다.

## 표준 deploy-time refresh 절차

`deploy-public-preview.sh`에서 새 `anvil-web` health가 `healthy`가 된 직후, release evidence/current SHA를 확정하기 전에 아래 동등 절차를 실행한다.

```bash
npm_name=nginx-proxy-manager
web_name=anvil-web
network_name=proxy-network

npm_id_before="$(docker inspect "$npm_name" --format '{{.Id}}')"
web_id="$(docker inspect "$web_name" --format '{{.Id}}')"
web_ip="$(docker inspect "$web_name" --format '{{(index .NetworkSettings.Networks "proxy-network").IPAddress}}')"
npm_dns_ip="$(docker exec "$npm_name" sh -lc "getent hosts anvil-web | awk 'NR == 1 {print \$1}'")"

[[ -n "$web_ip" && "$npm_dns_ip" == "$web_ip" ]]
docker exec "$npm_name" nginx -t
docker exec "$npm_name" nginx -s reload
[[ "$npm_id_before" == "$(docker inspect "$npm_name" --format '{{.Id}}')" ]]
```

reload는 NPM container restart가 아니라 Nginx graceful worker reload다. 그러나 공유 NPM의 모든 proxy host worker에 영향을 줄 수 있으므로 실행 전 명시 승인과 `nginx -t` 성공이 필요하다.

reload 후 단순 HTTP status만 확인하지 않는다. 고유 query probe를 공개 도메인으로 보내고 동일 probe가 새 `anvil-web` access log에 기록됐으며 legacy internal에는 기록되지 않았음을 확인한다.

```bash
probe_id="deploy-${release_commit:0:12}-$(date -u +%s)"
probe_since="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
curl -fsS "https://anvil.sinsan.kr/health/live?probe=${probe_id}" >/dev/null

for _ in $(seq 1 10); do
  docker logs --since "$probe_since" "$web_name" 2>&1 | grep -F "$probe_id" && break
  sleep 1
done
docker logs --since "$probe_since" "$web_name" 2>&1 | grep -F "$probe_id"

if docker ps -a --format '{{.Names}}' | grep -qx 'anvil-internal-web-1'; then
  ! docker logs --since "$probe_since" anvil-internal-web-1 2>&1 | grep -F "$probe_id"
fi
```

동일 방식의 non-mutating route probe를 `/api`(인증 없음 401 허용), `/auth/session` GET(405 허용), `/integrations/telegram/webhook` GET(405 허용)에 적용한다. 각 응답 code뿐 아니라 새 `anvil-web` log 도달을 확인한다. 실제 Telegram signed POST와 authenticated SSE는 이 routing proof 이후 별도 승인된 운영 검증으로 수행한다.

## Telegram override 제거와 rollback

서버에서 임의 `sed` patch를 하지 않는다. Git에 versioned migration script와 expected hash guard를 추가해 승인된 release에서 한 번 실행한다.

1. 대상 file이 정확히 위 path/hash/content인지 확인한다. 하나라도 다르면 변경 없이 abort한다.
2. 원본을 `$HOME/deploy/anvil/runtime/npm-config-backups/` 아래 timestamp/hash 이름으로 복사하고 mode/hash를 기록한다.
3. `/data/nginx/custom` glob에 포함되지 않는 위 backup을 확보한 뒤 exact override file을 제거한다.
4. `docker exec nginx-proxy-manager nginx -t`가 실패하면 즉시 원본을 복원하고 종료한다.
5. `nginx -s reload` 후 Telegram webhook GET probe가 새 `anvil-web` log에만 기록되는지 확인한다.
6. 실패하면 backup을 original path로 원자 복원하고 `nginx -t`, `nginx -s reload`, legacy route 복구 확인을 수행한다. 복구도 실패하면 `DIR/INCIDENT_HOLD`로 전환하고 internal container를 유지한다.

백업은 임시 찌꺼기가 아니라 명시적 rollback artifact이며 internal 제거와 안정화 확인 뒤 승인된 보존 기간에 따라 정리한다.

## deploy 실패 처리

- DNS 불일치 또는 `nginx -t` 실패: reload하지 않고 배포 실패. internal 제거 금지.
- reload 명령 실패 또는 새 runtime routing proof 실패: 이전 unified release를 `rollback-public-preview.sh`로 recreate하고, 이전 release에서도 DNS 비교 -> `nginx -t` -> reload -> 공개 route proof를 다시 수행한다.
- rollback 검증까지 실패: 새/이전 컨테이너를 추가 삭제하지 않고 NPM/internal을 유지한 채 `DIR/INCIDENT_HOLD`. 배포 evidence를 성공으로 기록하지 않는다.
- `current-anvil-web-sha`와 deploy success evidence는 reload 및 routing proof가 모두 성공한 뒤에만 갱신한다.
- `anvil-internal-web-1` 제거는 Telegram override 제거, public UI/API/health/Telegram/authenticated SSE/Last-Event-ID 검증이 모두 PASS인 최종 단계다.

## 테스트 계약

다음 회귀 검증이 필요하다.

1. shell test double로 old/new IP가 다를 때 `nginx -t` 후 reload가 정확히 한 번 호출되고 그 전에는 public verify가 실행되지 않는지 검증.
2. Docker DNS IP와 `docker inspect` IP가 다르면 reload/evidence/current-SHA write 없이 실패하는지 검증.
3. `nginx -t` 실패 시 reload가 호출되지 않는지 검증.
4. reload 또는 new-container log correlation 실패 시 rollback이 호출되고 internal removal이 호출되지 않는지 검증.
5. NPM container ID가 reload 전후 동일한지 검증.
6. expected hash가 다른 custom file은 변경하지 않는지 검증.
7. override 제거 후 Telegram GET probe는 unified web에만 기록되고, 실패 시 byte-identical backup이 복원되는지 검증.
8. deploy/verify evidence에 `npm_id`, `web_id`, `web_ip`, `npm_dns_ip`, `nginx_test`, `nginx_reload`, route probe 결과, override hash/migration 상태를 기록하되 secret/payload는 기록하지 않는지 검증.

## 승인 범위

- 로컬 script/test/report 구현과 commit: 승인된 Unified Runtime WP의 내부 구현 보완.
- NPM graceful reload: 공유 reverse proxy의 외부 운영 변경이므로 실행 승인 필요.
- `/data/nginx/custom/server_proxy.conf` 제거/복원 migration: 운영 설정 변경이므로 exact path/hash/rollback을 결박한 승인 필요.
- unified deploy/rollback 및 최종 internal container 제거: 기존 exact release DeployApproval과 제거 승인에 결박해야 한다.

추가로 사용자가 매 배포마다 NPM UI를 조작하거나 resolver를 설정할 필요는 없다. 승인 후 표준 deploy script가 위 검증과 reload를 자동 수행하도록 고정한다.
