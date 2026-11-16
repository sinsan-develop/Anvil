# FN18 생성 런타임 타입 연결 작업지시서 r1

## 목적과 근거

WORK_PLAN Stage E/FN18의 필수 desktop 타입 검사에서, 패키징 복사 시 생성하는 native-proof-runtime.cjs의 원 타입 연결 4건을 보완한다. 기존 원 entry의 17개 export를 직접 참조하며 가짜 shim·any·검사 억제를 만들지 않는다. 생성 CJS의 실행/배포 계약은 변경하지 않는다.

기술 검토는 원 desktop options의 TS5097 1213건을 숨기지 않았다. root의 기존 allowImportingTsExtensions:true와 정렬한 RAM compilerHost 대조는 exact17 keys/non-any/잘못된 인자 2건 거절을 보존했고 strict·noImplicitAny·noEmit을 바꾸지 않았다. 옵션은 desktop 전체에 적용되므로 원본 JS의 값 로딩 금지 검증도 함께 추가한다. 이는 새 공개 API·권한·라이브러리 채택이 아닌 내부 컴파일 연결이다.

## 담당과 정확 쓰기 범위

기존 developer_primary 한 명만 제품을 쓴다. r8 작업을 동결·쓰기 반환한 뒤 Main의 별도 GO로 착수한다. 다른 담당자의 변경과 기존 WIP를 보존하고 되돌리지 않는다.

1. apps/desktop/src/native-proof-runtime.d.cts (신규)
2. apps/desktop/tsconfig.json
3. apps/desktop/forge.config.cjs
4. tests/desktop/native-proof-runtime-build.test.cjs
5. docs/04_test_reports/AV3/FN18_GENERATED_RUNTIME_TYPE_LINK_RESULT_20261116.md (신규)

## 구현 경계

- 동반 선언은 typeof import('../scripts/native-proof-runtime-entry.mjs', { with: { 'resolution-mode': 'import' } })를 원 entry에 직접 연결하고 export = runtime을 사용한다. 임의 복제 DTO·any·추가 export는 없다.
- desktop compilerOptions에 allowImportingTsExtensions:true만 추가한다. strict/checkJs/noEmit/noImplicitAny/skipLibCheck 및 include/exclude의 기존 기준은 바꾸지 않는다.
- Forge ignore에 정확 /src/native-proof-runtime.d.cts 하나만 추가한다. 실행 CJS는 계속 복사되고 개발 installer의 상속도 유지한다. 원 package hook/ASAR/inventory/worker profile은 그대로다.
- 기존 시험에서 TypeScript compiler API를 사용한 읽기 전용/RAM 대조로 선언의 exact17 keys·non-any·정상 호출·잘못된 입력/생성자 인자 거절을 검사한다. 원 entry의 전이 타입을 skipLibCheck:false에서도 검증한다. emit/실행 CJS 파일 생성은 하지 않는다.
- 컴파일 옵션의 적용 범위가 넓어지는 점을 보상하기 위해 배포 원본 JS/CJS의 값 require·정적 import/export·동적 import가 .ts/.mts를 직접 로딩하지 않음을 구문으로 검사한다. JSDoc 타입 참조는 값 로딩이 아니다. 상수 문자열 결합 경로도 처리한다. 기존 소스를 읽는 범위이며 사용자/백업 자료는 읽지 않는다. 제품에 새 검사기/의존성/빌드 도구를 추가하지 않는다.
- 생성 CJS의 기존 exact46 source/17 exports/builtin4/2MiB/동적 import 거절은 유지하고 .ts 외부 import 또는 require 음성 사례를 추가한다. 선언 파일의 exact Forge 제외와 실행 CJS 보존을 기본/개발 설정에서 확인한다.

## 검수와 종료

r8 뒤 실측 잔여를 기준으로 같은 고정 TS7 desktop noEmit을 실행한다. 0건은 예상이며 실측 전 PASS로 쓰지 않는다. 새 진단은 위치/원 식으로 분리해 보고하고 검사 기준을 낮추지 않는다. 변경 파일에 필요한 기존 RAM 번들/선택 회귀를 실행한다. 중복 전수 검사를 하지 않는다.

결과는 정확 명령·exit·지문·진단·검증 범위·실행문/배포 불변 근거·미검증·복구를 기록하고 쓰기를 반환한다. 실제 DB·권한·키·사용자자료 조사·서비스·SDK/Agent/C#·Electron 앱·패키징·설치 실행과 추가 SDK 조회는 제외한다. 실패/결과 불명은 PASS로 승격하지 않는다.
