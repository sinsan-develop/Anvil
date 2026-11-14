# FN08 명시 앱 배포 근거 소비 연결 — source 작업지시

## 기준·범위
채택50596FFCAD26EC0FE9F5BC9AB43A5948BE87BF549C2E989E216D297442FD4389의 소비 조립 후속. PR112 main681af80db8d6d1c7d7efc00a36801a0521cda88f에서 codex/av3-d1-deployment-runtime으로 진행한다. 기존 Primary 단일 code writer, Main 검수·기록·통합. 실제 DB·권한·키·파일자료 조사·설치·서비스·C#·Agent 실행은 제외한다.

## 정확 코드 소유 경로
- apps/server/app.ts
- tests/unit/FN06/native-worker-deployment-journey.test.ts

필수 인접 시험이 필요하면 Primary가 정확 경로·이유를 먼저 Main에 제출한다. Main 문서/Git 외 제품쓰기0.

## 기대 동작
GET용 WorkerDeploymentReadSource와 별도로 명시 내부 ownership 구성 옵션에서 실제 NativeWorkerDeploymentStore를 받는다. nativePreparation enabled 및 실제 preparations가 있을 때 기존 createNativeWorkerDeploymentOwnershipBasisSource→connectNativeOwnershipReturn을 한 번 연결한다. 기존 연결은 오류로 거절하며 자동덮어쓰기/skip/v1→v2변경을 하지 않는다. 옵션 생략과 GET 단독 구성은 기존 미등록 기본값을 유지한다. 공개endpoint/응답/권한·실환경설정 변경0.

## TDD·검수
1. 수동 connect를 제거한 명시 buildApp 구성만으로 기존 consume→request/results→head의 제품 RAM 여정 RED→GREEN.
2. GET만은 ownership 미등록, preparations누락/enabled불일치·중복 연결·가짜store/메서드교체는 구성오류, 회수/취소뒤추가수용0.
3. 기존 정규회수/형상/기한 검사 보존. DB·TLS·native는 RAM이고 실제서비스를 띄우지 않는다.
4. 직접/인접 한정검사·roottsc·diffcheck. 실행 명령/종료/테스트 수와 미실행을 정확히 분리한다.
5. 제품2파일 hash·변경요약·정확검증·오류/미검증·livehandle0 보고 후 쓰기 반환. 독립검수 C/I 해결 후 Main 통합한다.

## 완료의 범위
명시 앱 구성의 source 연결을 확인하는 단위다. Windows내구unsupported·실제DB/서비스/Agent 및 전체계획 완료를 주장하지 않는다. 앞선 검증된 모듈을 재작성하거나 새로운 계약을 만들지 않는다.
