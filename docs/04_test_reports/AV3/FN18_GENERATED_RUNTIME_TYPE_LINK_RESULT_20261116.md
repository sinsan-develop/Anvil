# FN18 생성 런타임 타입 연결 결과

## 판정

Desktop TypeScript 7.0.2 `noEmit` 검사는 종료 코드 0, 진단 0건이다. 기존 r8 마지막 검사에서 남은 TS2307 4건은 생성 CJS의 동반 선언을 원 entry에 연결하면서 모두 해소됐다. 메모리 번들·타입·포장 규칙 시험은 15건 모두 통과했다.

## 기준과 변경

작업 브랜치는 `codex/av3-native-connection-followup`, 시작 HEAD는 `1ed1dffe16f9e4714862dc9ad61504e69ea4b924`다. 시작 시 r8과 앞선 작업의 소스·시험·문서 변경이 있었다. 작업지시서 `FN18_GENERATED_RUNTIME_TYPE_LINK_WI_20261116.md`의 SHA256은 `1C5ED6AA44619183EB474E79A416268B9CED098223EAC50C6E0F4F265A51B12C`다.

| 파일 | 변경 | 최종 SHA256 |
|---|---|---|
| apps/desktop/src/native-proof-runtime.d.cts | 2행 신규. 원 ESM entry의 모듈 타입을 import 해석 모드로 참조해 CJS에 연결 | E8585F4CD137795F1780673FC01855A49401AD5053D28E90B689DED25FE502B5 |
| apps/desktop/tsconfig.json | allowImportingTsExtensions 한 옵션 추가. 기존 strict·checkJs·noEmit·skipLibCheck와 파일 선택 유지 | 2C6A59AD06D5D151CA62F64616EC67C1CDAF03A4477FCFB5FA69456692B8B75B |
| apps/desktop/forge.config.cjs | 기본 ignore에 정확한 /src/native-proof-runtime.d.cts 한 경로 추가. 개발 설정이 상속 | D2F6C8C3354455A3AB0A0BCB64068469636CFDEB1DC4727209D6DFA48A8E5389 |
| tests/desktop/native-proof-runtime-build.test.cjs | 기존 생성물 시험에 원본 TS 외부 참조 거절을 추가하고 타입·배포 규칙 시험 3건 추가 | 47DD5EE7674FA2D2600EA9F68E346E45EA140777040D143849354D45C0CFB0A2 |

## 검증

- r8 기준 명령 `node ../../node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json --pretty false`는 exit 1이었다(1e428f). 미해결 원 위치는 `native-first-receive-client.cjs(14,74)`와 `trust-enrollment-owner.cjs(255,24), (363,104), (437,4260)`였다. 같은 명령의 최종 실행은 exit 0, 출력 0바이트였다(1d0305). 기존 4건 소실, 신규 진단 0건이다.
- `node --test tests/desktop/native-proof-runtime-build.test.cjs`는 최초 15 PASS, 0 FAIL, 0 SKIP, exit 0, 3049.15ms였다(b178e1). 직접 module.require 보완 후 최종 15 PASS, 0 FAIL, 0 SKIP, exit 0, 3334.7045ms였다(aabbbb). 기존 Vite 메모리 CJS 46개 소스·17개 export·builtin 4종·2MiB 한도, import 시 부수 효과 및 임의 외부 로딩 거절을 확인했다. 합성 copy는 메모리 IO를 사용했다.
- 고정 TS7 compiler API의 메모리 프로젝트가 실제 .d.cts, 원 .mts와 그 전이 타입을 `skipLibCheck:false`로 읽었다. 직접 타입 참조의 키 17개가 양방향 일치하고 모듈과 각 멤버가 any가 아님을 검산했다. 정상 parse·decoder 생성식의 진단은 0건이었다. 의도한 오류는 숫자 123 입력의 TS2345와 인자 없는 decoder 생성식의 TS2554였다. 다른 위치의 진단은 0건이었다.
- 독립 검수에서 직접 module.require 누락을 확인했다. `node --test --test-name-pattern="배포 JavaScript의 값 로딩 경로" tests/desktop/native-proof-runtime-build.test.cjs`가 상수 TS 경로를 0개로 관측해 1 FAIL/exit 1(079bb8)이었다. AST에서 module.require의 원 객체·메서드를 식별해 기존 경로 판독에 연결했다. 최종 시험에서 고정 .ts, 결합 .mts, 미해결 변수 경로를 거절하고 고정 .cjs를 인식했다. 제품 3개와 compiler 옵션은 이 보완 전후 지문이 같다.
- 기본/개발 Forge ignore를 각각 적용해 배포 대상 원본 JS/CJS/MJS의 AST에서 값 require·정적 import/export·동적 import 경로를 검사했다. 기본 설정에 남는 루트 개발 installer 설정도 포함했다. JSDoc 타입 import와 상수 문자열 결합을 구별했다. 정확 선언만 제외되고 실행 CJS와 인접 이름은 제외 규칙에 걸리지 않았다.
- `git diff --check development/main`은 exit 0(c41faf). 미추적 선언·이 결과서는 `git -c core.autocrlf=false diff --no-index --check -- /dev/null <파일>`로 별도 대조했다. 두 신규 파일은 차이가 있어 각각 exit 1이고 공백 진단은 0건이었다.
- 시험 기준을 넣는 과정에서 원문 고유 일치 확인이 1회 편집을 거절했다. 쓰기 전에 멈춘 명령이었다. 현재 시험의 실제 배열 경계를 읽고 해당 문자열만 교정했다.

## 미검증과 복구

실제 Electron 앱·패키징·설치·C#·SDK/Agent·서비스·DB·권한·키·사용자 자료는 검증 범위에서 제외했다. 배포 증거는 설정의 복사 규칙, 원본 구문, 생성 번들 및 메모리 copy에 한정한다. 복구 시 표의 신규 선언과 옵션·ignore·시험 변경만 같은 단위로 원복한다. 앞선 r8 변경과 다른 담당자의 문서를 보존한다. WORK_STATUS와 Git 통합은 Main 담당이다.
