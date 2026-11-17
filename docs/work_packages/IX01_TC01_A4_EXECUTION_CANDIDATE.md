# IX01 TC01 A4 격리 시험 후보

실행 승인 대기. 실행 소스는 1b60eec8a3d68a920d08130c3cc131274ae8aec3에 고정한다.

| 자원 | A4 고정값 |
| --- | --- |
| 소스 | /home/daon/anvil-ix01-current-tc01-20261108-a4-qa |
| 영수증 기준 | /home/daon/.local/share/anvil-v3-qa-receipts/ix01-current-tc01-20261108-a4 |
| 산출물 | /tmp/anvil-v3-ix01-current-tc01-20261108-a4 |
| 컨테이너 | anvil-ix01-current-tc01-pg-20261108-a4 |
| 네트워크 | anvil-ix01-current-tc01-net-20261108-a4 |
| 격리 DB | anvil_v3_ix01_current_tc01_20261108_a4 |
| 프로필 및 소유 라벨 | IX01_CURRENT_TC01_20261108_A4 |

[A3 고정 후보](IX01_TC01_A3_EXECUTION_CANDIDATE.md)의 source14 순서와 SQL130 검산 기준을 사용하되, runner scripts/qa-ix01-current-journey.ts 원바이트는 길이 50270 및 SHA256 b6b3cfa40cb703db10a5f26b040cd3c373d5c0e0485e6baf6f66cdbcd9da9d32로 교체한다. 나머지 source13과 SQL130 원바이트는 동일하다. SQL 원장 SHA256 dbd89bb0db4d093f63b836be18d98b72fda2a94dfcea72eea5acb52ba6d0c7cd. 기존 값은 발급 시 정확 Git 커밋에서 다시 계산해 대조한다.

A4는 빈 HostConfig.Mounts 생략과 생성 직후 미할당 none 응답을 처리한다. 실제 마운트·포트·기동 후 네트워크 검사는 유지한다. A3의 정확한 실패 조건은 미확정이다.

승인 후 A4 전용 자원과 plan/approval 형제 파일 부재, 도구·daemon·고정 이미지, clean exact SHA를 검산하고 신규 단회 외피를 발급한다. 외피는 최대30분, PG 최대10분, 자식 최대90초다. 실행에서는 SQL130, 0095 두 NOLOGIN 역할과 임시 ADMIN 멤버십 생성·회수, 합성 자료의 TC01 저장·재조회까지 확인한다. 확인된 성공 후 A4 소유 PG·내부망만 정리하고 감사는 보존한다. 실패나 결과 불명이면 후속 조회·재실행·자동 삭제 없이 보존한다. A1/A2/A3 및 기존 DB·권한·서비스는 접근 범위 밖이다.
