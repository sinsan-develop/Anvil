# UI03 확정 방법론의 별도 적용 — 화면 연결 검수

2026-10-20 / Main 어울 / 승인 Stage B의 FN02·UI03. **화면 구현·fixture 핵심 검수 완료, 정식 DB/served 통합 미확인**. 전체 FN02 완료가 아니다.

## 변경과 사용자 흐름

- 기존 `ProjectMethodologyPage`의 무조건 비활성 적용 표식을 `MethodApplicationPanel`에 연결했다. 최신 전용 원문의 적합 검토·확정과 현재 적용본 조회, 미저장/미확인 작업 부재를 확인한 뒤 이유와 별도 체크로만 적용한다. 저장·검토·확정 자체는 적용/Agent 실행이 아니다.
- 첫 준비 GET에서 현재 owner/client/control·이전 적용 fullref를 고정하고 기존 `applyMethodology` command를 보낸다. 결과 ref/원문·이유/이전ref/hash를 검사한 뒤 적용본 재조회가 일치해야 성공을 표시한다.
- 프로젝트별 탭 버퍼에 owner/client와 원 명령을 보존한다. 자동 전송/재시도는 없고, 503·영수증 후 조회 실패·이탈 중 늦은 응답은 같은 명령으로만 사용자가 재확인한다. 사용자·client가 달라지면 이전 입력을 노출·전송하지 않는다.
- 최초의 명확한 비저장 409/412/422는 입력을 보존하고 잠금을 해제한다. 과거 불명 또는 영수증 수신 이후의 거절은 이에 합치지 않는다. 임무/실행 이력의 최종 허용 판단은 서버에 남긴다.
- 기존 복사/저장·검토/확정도 준비 GET부터 공유 preparation 잠금을 사용한다. 늦은 준비는 이탈 후 송신하지 않고, 완료 시 명령 CAS와 다른 적용 pending 부재를 검사해 버퍼 전체 교체가 미확인 적용을 버리지 않게 했다. 브라우저 종료 경고에 이 상태를 포함했다.

## 검증

- 타입: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json` exit0.
- 직접 단위: `node --experimental-strip-types --test tests/unit/FN02/method-application-web.test.ts tests/unit/FN02/project-method-web.test.ts` **7 PASS /197.1731ms**.
- 빌드: `node node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts` exit0/258 modules/321ms. JS SHA256 `A99F1591CA8211640A41971B57942D605A6D38A189BA58A186ECCF7F1E2C40E4`.
- 브라우저: `node node_modules/@playwright/test/cli.js test --config qa-ui03-method-application.playwright.config.ts` **11 PASS/9.4s**. config는 이번 작업 전용(Edge headless/worker1/retries0/timeout12000/trace·screenshot OFF)으로 검수 후 회수했다. 실제 bundle과 same-origin fake API를 사용했으며 실제 API/DB/로그인 서비스 검증이 아니다.
- 신규10건: 별도 확인 이전 전송0, 503 후 이동·동일 명령 재확인, 준비 GET 이탈 후 POST0, receipt 후 readback503 성공 표시0, 검토ref 키순서 무관, 다른 사용자/같은 사용자 다른client의 이전 입력 비노출·재전송0, 최초409 입력보존/잠금해제, 과거503 후409 원명령유지, 기존 복사 준비 공유잠금, POST 이탈→늦은503→재확인409 원명령유지.
- 직접 회귀1건: 기존 복사·개정·내용검토·확정·원 명령의 이동 후 재확인과 고정 적용본 유지. 옛 무조건 적용불가 표식 두 assert만 신규 기능의 **과거 버전 적용 금지/적용 명령 호출0**으로 대체했다. 저장/확정·기존 거절 기준은 완화하지 않았다.
- 늦은 GET 시험은 JSON 본문 소비 count를 기다린 후 전송0을 검사한다. fixture의 Response.json 래핑은 원 body를 그대로 반환하고 exact GET/command의 소비 횟수만 세므로 정밀 timing/모든 이탈 조합의 증거는 아니다.

## 원 실패·검토와 조치

1. 화면 부재 최초3 RED → 새 패널3 PASS. 검토ref JSON 키 순서의 정상 차이를 잘못 막는 추가1 RED → 구조 정렬 비교로 보정4 PASS.
2. 주체 전환2건은 기존 로그인 화면의 GET auth/setup fixture 누락으로 실패했다. 실제 계약 `{setupRequired:false,policyVersion:1}` 응답을 추가했고 제품 인증/권한은 변경하지 않았다.
3. 독립 최초 C0/I2/M0: 최초 명시409의 영구 미확인 잠금, 기존 복사 준비와 적용의 경합/버퍼 소실. 둘 다 actual RED 뒤 위 거절 분리·공유 준비 잠금/CAS로 보완했다. 첫 복사 음성은 확인창 미수락으로 미도달했음을 보존하고 명시 수락 후 실제 enabled 오류를 재현했다.
4. 이후8 PASS/1 FAIL은 거절 후 보존 textarea의 implicit label 탐색이었다. snapshot에 보존 값은 확인했고 htmlFor/id를 명시 연결한 뒤9 PASS. 재확인 시 항상 uncertain으로 다뤄야 하는 추가 POST 이탈 반례는 원 한 줄 동작에서 RED → 재확인 uncertain=true 후 GREEN이다.
5. 한정 재리뷰 C0/I0/M1의 이탈 후 소비 장벽 누락을 보완했고 마지막 한정 재검토 **C0/I0/M0**. 원 I2/M1을 지우지 않는다. 검수자는 source 읽기만 했으며 독립 실제 실행 PASS가 아니다.
6. 빌드 chunk 크기 및 NO_COLOR/FORCE_COLOR 경고는 보존하며 조건 완화·공통화/도구/자동설치로 우회하지 않았다. cmd 다중 줄 호출에서 두 번째 명령 미실행은 개별 실행으로 바로잡았고 미실행을 PASS로 세지 않았다. 추정 Auth/Session 파일의 읽기 부재는 실제 파일 목록으로 좁혀 확인했으며 파일/권한 변경은 없다.

## 정리·남은 작업

Main/SINSAN\cyhuh 소유·실경로/nonlink·process0·전체 파일hash를 확인한 전용 자료만 비재귀 회수했다.

- `D:\tmp\anvil-v3-stage-b\ui03-method-application-01`: 2파일/하위dir2/2136bytes, inventory `4CD0072ADBF1B5E86C5A0F75F028CD79E029F26C6691CC6BB0ACA99E6600A3E6`.
- Web 생성 dist: 3파일/하위dir1/1336078bytes, inventory `5BC676D6F02CE6BE3DEBF38184ABFFCF75FC491BC4C9D6373745BE39672EAFF7`.
- 새 전용 config hash `EDD441526C7214C5A9123B40C8065F5A150D98A12CF7AB840F86F2E626EB6220`도 회수. 별도 조회 QA/build/config 모두 False,3830/5546 listener0. 소스와 시험은 Git에 보존한다.

정식 서비스/DB/migration·실사용자 정책/Secret/cert·Agent/OS helper/운영/Oracle 변경0. 실제 초기 createProject 회귀·7원장 직접 DML 경합/다른 프로젝트·비기본 isolation, 정식 DB/served의 UI03→API→DB 통합은 여전히 남았다. 실제 서비스가 중지되어 있어 이 결과만으로 신산님이 현재 URL에서 새 기능을 사용할 수 있다고 주장하지 않는다. 다음은 남은 핵심 저장 경계 검수다. 롤백은 새 화면 소비와 공유 준비 상태 보완을 일반 revert하며 기존 snapshot/자료는 보존한다.
