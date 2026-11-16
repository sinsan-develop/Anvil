# FN18 고정 개발 의존성의 타입 해석 준비

## 근거

FN18 필수 desktop 타입 검사의 미충족 원인을 해결한다. 이미 승인된 desktop manifest/lock의 개발 의존성을 복원하는 필수 개발 준비이며 새 라이브러리·버전을 도입하지 않는다. PMO AGENTS §6의 승인 계획에 필요한 개발 의존성 준비 범위를 따른다.

- manifest SHA256 F21795964068338AEA8BFD811F7B6FE83B7AF35F81174387536CBF24693749DD.
- lock SHA256 544557A7849299B37EA00E6AF07E00E30DE54C51F950C64A94A050EDAC0516A8.
- 실제 확인: apps/desktop/node_modules 항목 없음. lock의 resolved 163개는 모두 사용자정보 없는 HTTPS registry.npmjs.org이며 다른 scheme/host는0이다.
- electron·asar·fuses·resedit·pe-library의 TS2307 10건이 현재 해석 트리에 없으며, 생성 runtime CJS 관련4건은 이 복원과 별개다. 복원만으로 전체 검사 통과를 예측하지 않는다.

## 정확 실행 범위

- 담당 Main이 실행을 관리한다. 단일 새 apps/desktop/node_modules와 개발 cache .av3-data/fn18-locked-deps-cache-20261116-01만 생성한다. 실행 직전에 대상 부재와 manifest/lock 지문을 다시 확인한다. 기존 공유 node_modules·junction·package/lock/config는 변경·삭제하지 않는다.
- 기존 npm으로 `npm.cmd ci --prefix apps/desktop --ignore-scripts --no-audit --no-fund --cache .av3-data/fn18-locked-deps-cache-20261116-01 --fetch-retries=0 --fetch-timeout=30000`을 한 번 실행한다. pre/post install·prepare 스크립트, 앱·패키징·서비스·SDK/Agent·C#는 실행하지 않는다.
- 종료 코드를 수집하고 지문/작업 Git 상태와 모듈 해석 결과를 확인한다. 실패·불명에서는 자동 재시도·정리 없이 자료를 보존하고 원인을 보고한다. 설치 결과는 후속 개발 검증용으로 유지한다.
- 새 라이브러리/버전 변경·Secret/인증 설정·전역 설치·권한 변경·실제 사용자/백업·DB·서비스·모델 호출은 없다. 민감한 환경값·npm 설정 원문을 출력하지 않는다.
- 성공 후 같은 고정 TS7/원 desktop tsconfig의 --noEmit 진단을 한 번 수집하고 소스/환경 원인과 잔여를 분류한다. 145건과 차이를 실제 결과로만 판단한다. 새로운 shim/any·ignore·Gate 완화로 모듈을 숨기지 않는다.

## 보존·보고

검수된 UI14·브리지 주석 소스를 먼저 안전한 commit/push로 보존한다. 전체 desktop 타입 Gate는 아직 FAIL이므로 FN18 완료·최종 Stage 통합으로 승격하지 않는다. 의존성·생성물 해석을 해결하며 동일 작업 branch에서 계속한다. 작업현황에 정확 명령·실행 상태·종료·변경 범위·미검증을 기록한다.
