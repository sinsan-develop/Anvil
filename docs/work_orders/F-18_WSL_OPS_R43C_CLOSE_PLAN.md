# F-18 R43C 제품 보정 종료·검증 인수

- Developer exact5 제품 SHA `e3a1b0bdbe62f68b37a4798be6f16f91e3208bd9`의 변경 경로·diff·로컬 164 PASS를 Main이 검토했다. 전체 bare pytest 기존 13 collection ERROR와 실제 WSL OIDC/Worker는 non-green으로 보존한다.
- R43C writer의 write lease→worker lease 순으로 회수해 제품 write scope를 비운다. Main은 별도 QA lease·자원 사전 기록/G-05 후 동일 SHA WSL-server 전용 검증을 시행한다. 이 종료는 R43C runtime 또는 F-18 인수가 아니다.
- Windows 개발·지정 Git SSH alias 원격 push, WSL-server 검증만 허용한다. 새 branch, ysna-server, Production, 공유 컨테이너/DB 변경은 금지한다.
