# FN15 한정 source QA 1회 결과 — 2026-10-26

## 판정

SETUP_FAILED / FN15_SOURCE_NOT_RUN. 실제 PostgreSQL 핵심 동작은 실행되지 않았다. 전체 FN15·UI12·사용자 인수·작업계획 완료 증거가 아니다.

## 고정 대상

- source: 918712e5c8407a7e8eb40fd078979500d36c42a6
- candidate.sh: 08C229C541CA16603B996016A1E48B97899503F5ACB98FFB25DBD43CB98A5BD4
- manifest.json: F37BB54D1278BE2905B8C8A1738C0E140B9965A0D25C5F373C316B59195766CD
- argv: `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ControlMaster=no -o ControlPath=none WSL-server bash -s -- 918712e5c8407a7e8eb40fd078979500d36c42a6`
- stdin: hash 대조한 동결 후보 원문. 실제 비밀값은 출력하지 않았다.
- root: /home/daon/deploy/anvil-v3-fn15-source-qa-01
- container: anvil-v3-fn15-source-qa-pg-01
- network: anvil-v3-fn15-source-qa-net-01
- source 준비의 단위·구문·fake 시험은 이 실제 결과와 별도다.

## 실제 실행과 실패

Main2972ab: 7.146초, SSH exit1. PREFLIGHT → REGISTER_SOURCE_ROOT → REGISTER_NETWORK → REGISTER_CONTAINER에 도달했다. 시작 전 container guard가 CREATED_CONTAINER_MISMATCH로 거절했다. PG start/ready·역할/SQL/seed·handler·API 모두 미실행, sourceMarkers는 빈 배열이다.

자동 정리 실패 코드는 순서대로 CONTAINER_OWNERSHIP_REFUSED, NETWORK_CONTAINER_RESIDUAL_PRESERVE, RESOURCE_POSTCHECK_FAILED다. 원 실패와 자동 정리 실패는 보존하며 후속 정리 성공으로 소급하지 않는다.

읽기14b467 exit0:

- daemon: e3349f1d-dbfc-478a-96d9-295bf6c6839e
- container fullID: c8f4eed79468c4ff2affe1655a146e51288ca876474a7075dd34415c47f34272
- image: sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f
- network fullID: c55bbb049716d1d3e5f11b27268d6767b75f6062fd4e9e53a488fa83e97c485d
- labels: owner AV3_FN15_SOURCE_QA, source 위 SHA, instance fn15-81ca790d4b995148e05f9b1986b47234, expires 2026-10-25T22:56:35.782Z
- container: status created, running false, mounts [], ports {}, restart no. tmpfs는 /var/lib/postgresql/data:rw,size=536870912,mode=0700으로 설정됐다.
- 지정 network 항목은 있으나 NetworkID/EndpointID/IPAddress는 빈 문자열이었다.
- network: 같은 4 labels, internal true, driver bridge, containers {}.
- rootExists false, rootLink false.

원인 범위: 생성 직후 metadata를 기동 후 구조와 동일하게 요구한 검증 전제 오류로 좁혔다. 기동 후 실제 tmpfs·network 표상과 DB 연결은 확인하지 않았다. 제품 결함·SQL 실패로 판정하지 않는다.

## 잔여 회수

Main82ecd4: 1.188초, exit0. 동일 daemon·두 fullID·같은 labels·image·tmpfs·ports·created/정지·빈 mounts·미연결 network를 재대조했다. force 없이 정확 container를 제거하고, network의 attached0·labels를 다시 대조한 뒤 정확 network만 제거했다. 기존 DB/서비스 변경은 수행하지 않았다.

별도 Mainbd484e SSH exit0:

`{"code":"INDEPENDENT_FN15_RESIDUAL_READ","containerCount":0,"networkCount":0,"rootExists":false,"rootLink":false}`

이는 이번 등록 신규 자원의 잔여0이며 다른 환경이나 정식 서비스 검증이 아니다.

## 승인 전달 시점

Main은 당시 PMO의 검토 중 ‘기존 개발 검증 위임 범위·고정 후보1회’ 의견을 확정 판단으로 해석해 플랫폼 require_escalated에 exact 후보를 제출했다. 도구는 실행을 허용했고 위 실제 실패가 발생했다. Main이 잔여 정리 명령을 제출·수행한 직후에 PMO의 승인 메시지 전송 자체가 자동심사에서 거절돼 미전달됐다는 통지와 읽기만 허용한다는 통지를 받았다. 이후 PMO는 관측된 두 신규 자원에 한한 동일 최소 정리 범위를 별도로 수용했다. 완료된 정리 명령을 반복하지 않았다.

Main이 이미 알고 있던 거절을 다른 도구로 우회한 것은 아니나, 검토 중 의견을 확정 지시로 먼저 취급한 판단과 전달 시점 충돌을 기록한다. PMO 메시지 전송 거절을 소급 해제하거나 새 QA 실행 허가로 해석하지 않는다. 재실행은 0이다.

## 남은 작업

생성 직후·기동 후 metadata guard를 관측 근거와 순수 반례로 분리 보완하고 독립 검수한다. 보완한 후보의 새 실제 실행은 정확 범위·플랫폼 및 필요한 직접 승인 판단 이후로 분리한다. 실제 PG/권한·SQL/COMMIT·조회/API·TLS/browser·정식 개발 DB/서비스·Agent·수락/제어 전환은 미검증이다. 기존 실패는 계속 남긴다.