# FN08 명시 앱 배포 근거 소비 연결 검수

## 판정
한정 source 검수 완료, 독립 C0/I0/M0. 전체 FN08·작업계획 및 실제 환경은 미완료다.

## 변경과 이유
이전 PR112는 adapter와 제품 함수 여정 연결까지였고 app은 배포 GET만 등록했다. `buildApp` 마지막 별도 `nativeOwnership` 옵션에서 실제 store→기존 basis adapter→원 preparations의 단발 연결을 수행한다. GET 단독/옵션 생략은 미등록 상태를 유지한다. 누락·disabled·가짜 store/메서드 교체·중복은 구성 오류다. 기존 endpoint/권한/기본 활성화 변경은 없다.

## 정확 범위
- apps/server/app.ts SHA256 C077D874BDCDB37448AA62B7E38674FABBFF319703706090C3C0511A02637EE2
- tests/unit/FN06/native-worker-deployment-journey.test.ts SHA256 C18819AE3DAC8C2859A883B6F4FA176B642FCCA2572B0F63285B13BDBA5C9409
- WI SHA256 50CFD255A1DD89CFF14F90E54AB97E2A4F6679E113D18FC09C49ADDA7F48D8CE

## 검증
- Primary 수동 connect 제거 RED: 1P/1F, 요청503. 구현 뒤 같은 여정 3P/0F/0SKIP.
- Main `node --test --test-reporter=dot tests/unit/FN06/native-worker-deployment-journey.test.ts`: 3사례 exit0(34690a).
- 최초 root 타입 TS2345 1건은 undefined store 누락 거절로 보완했다.
- Main 최종 `node --test --test-reporter=dot --test-name-pattern='명시 앱 ownership' tests/unit/FN06/native-worker-deployment-journey.test.ts`: 1사례 exit0(bd2d7e).
- Main root TypeScript: exit0(9aaa37). diff check exit0.
- 독립 읽기 검수 C0/I0/M0, 두 제품/시험 지문 확인. Primary 쓰기 반환·live handle0.

## 미검증과 복구
DB·TLS·native 경계는 RAM이다. 실제 DB·권한·키·파일자료 조사·설치·서비스·C#·Agent 실행0. Windows 내구성 unsupported는 유지한다. 실제 환경 변경이 없으며 source 문제 시 기존 main681af80d를 비교 기준으로 이력 보존 revert한다. 다른 사용자 변경을 reset하지 않는다.
