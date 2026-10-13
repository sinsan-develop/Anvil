# 신산님 직접 승인 — Anvil WSL 개발 화면 반영

- 승인자: 신산님. 출처: 현재 Anvil 대화의 2026-10-14 직접 응답 `승인해`.
- 승인 대상 질문: `WSL의 Anvil 개발DB 백업·갱신과 테스트 로그인·HTTPS 설정 변경까지 진행해도 될까요? Oracle·운영 환경은 제외합니다.`
- 이는 실제 실행 승인이다. 별도 사람 승인이나 전체 U-01/Release 합격을 만들어 낸 기록이 아니다.

## 포함 범위

기존 `codex/u01-dashboard-r2`의 검증된 Git 소스를 사설 원격에서 정식 `/srv/anvil-wsl/repo`로 받아, WSL-server의 Anvil 개발 DB `anvil`을 보존/백업·복원 검증 후 필요한 migration0013→0020으로 갱신한다. 테스트 로그인·HTTPS 자료와 개발용 읽기 계정/정확 QA 조합, existing3770 포트의 Anvil 서비스 전환·핵심 확인·실패 시 복구를 포함한다. 현재 검증 시작 기준선은 `4b75c87f395ded6e48b0074b1d8c21f364061730`이다.

배포 구성은 기존 WSL Web/API/OIDC QA 역할을 재사용한다. 테스트 issuer는 실제 외부 SSO가 아니며 기존 데이터 전체 접근·고위험 명령 권한을 주지 않는다. 기존 데이터/원본 Secret과 기존 공유 proxy-network 설정은 보존한다. Anvil 대상 컨테이너 교체·Anvil 소유 내부망과 비밀/인증서 파일 생성은 허용하되, 다른 프로젝트의 서비스·DB·권한·인증서를 변경하지 않는다.

## 제외·안전 조건

Oracle/ysna/Production·공개 운영·실제 Provider/Telegram 호출/비용·SSH/Git key 변경·Windows 전역 인증서 신뢰 설치·새 branch·PR/main·force push/history rewrite·예약 변경은 제외한다. Windows 소스를 서버에 복사하거나 dirty 소스로 배포하지 않는다. HTTPS self-signed 개발 인증서와 테스트 계정은 개발 한정으로 표시한다. 전체 미구현/검증 미진을 성공으로 바꾸지 않는다.

암호화 백업·기존 image/container/config 복구 자료를 확인하고, 백업 복원 및 migration의 기존 데이터 보존을 격리 복사본에서 검증하기 전 원 DB migration을 하지 않는다. 알려진 Anvil 서비스만 정지하며 알려지지 않은 DB writer/충돌·복구 불가가 있으면 mutation 전에 멈춘다. 동일 승인 범위의 상세 구현/순서·파일 배치는 Main이 WI/manifest/hash로 결박한다.
