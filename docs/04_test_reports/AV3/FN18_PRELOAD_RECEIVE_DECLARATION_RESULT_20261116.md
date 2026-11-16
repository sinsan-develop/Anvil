# FN18 수신 preload 인자 타입 연결 결과

## 판정

기존 수신 브리지와 상태 리스너의 인자 19개에 JSDoc을 연결했다. 고정 TypeScript 7.0.2 데스크톱 검사에서 정확히 19개의 TS7006이 사라졌다. 새 진단은 0건이며 나머지 145건이 그대로 남아 전체 검사는 exit1이다. 앞 단계에서 보완한 화면 TS2339 5건과 별도로 집계했다.

## 범위와 변경

- 지시서 r2 SHA256 `D44F1E33A99DD6DD96562DE14A063CA90C2FA2C920AA0C1BA0722FA1C383B716`. 작업 브랜치 `codex/av3-native-connection-followup`, 기준 HEAD `fcd0ed0cf7283866141496db216076f060529006`. 앞 단계 settings.js·UI14 제품/시험/결과서와 Main의 현황·점검표·지시서 편집이 있는 상태로 시작했다.
- 제품 `apps/desktop/src/preload.cjs`. begin/status/refresh/arm/close의 인자 17개는 policy.cjs의 assertTrustIpc가 검사하는 동일 requestId·attemptId·epoch, 명시 확인 true, 정확한 offerRef(version 1)와 일치한다. onState 내부의 _event·state는 unknown이고 기존 callback에는 state만 전달한다.
- 주석 외 제품 실행문, IPC 채널·인자 순서·권한·모듈 해석 및 패키지 설정을 보존했다. Git diff는 주석 5줄 추가와 기존 listener 줄의 인라인 주석 변경으로 6행 추가·1행 삭제다.

## 검증

| 증거 | 결과 |
|---|---|
| 원 진단 | QA 원출력 SHA256 `241145D004D9C824457667ED08D7646FB8E2DE55EEAAD898A63E02E8415325F6`, 169건. settings.js 보완 후 같은 검사 911381에서 164건·exit1. 본 단계는 이 164건을 기준으로 삼았다. |
| `node ../../node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json --pretty false` | 98b015 exit1, 145건. 파일·코드·전체 메시지별 중복 건수를 대조했다. 사라진 TS7006은 원 5행 3건, 6행 2건, 7행 3건, 8행 5건, 9행 4건, 20행 2건이다. 다른 145건은 순서·줄·열·메시지까지 동일했다. preload 잔여는 2행43열의 electron 모듈 해석 오류 TS2307 1건이다. |
| `node --test --test-name-pattern="첫 수신 exact5 IPC|실제 settings의 원 REGISTERED 수신 시작 버튼" tests/desktop/shell-policy.test.cjs tests/desktop/desktop-trust-registration.test.cjs` | cc6b04 exit0, 2P/0F/0SKIP, 1557.4042ms. 등록된 수신 시작 버튼의 begin/status 호출과 IPC 5개에 대한 발신자·epoch·attempt·offerRef·확인 검사를 실행했다. |
| 주석 역치환 | ad46ba exit0. 새 메서드 JSDoc 5개와 리스너 인라인 주석 1개를 각각 정확히 한 번 제거했다. 작업 사본의 CRLF 원본 SHA256과 일치했고 Git LF 정규화 후 HEAD 파일 전체와 바이트가 일치했다. |
| `git diff --check development/main` | 3caf61 exit0. settings.js의 기존 작업 사본 개행 안내 외 공백 진단 0건. 미추적 결과서는 빈 파일과 별도로 공백을 확인한다. |

| 바이트 기준 | preload.cjs SHA256 |
|---|---|
| 수정 전 및 역치환한 작업 사본(CRLF) | `2CE57ABF0EFEF7010428D8C8F529923D4EE29A0167A884E9788ABFA23EA4B9B1` |
| HEAD 파일(LF) | `9094B6136BF47B2C57AF8EB4FEA325D628948DAEFAFC4A001A4D94C652EB9279` |
| 최종 작업 사본(CRLF) | `309B8D077103313C6FD5E442528F30C6E84D12A0B873E9FAA6A96A59F5CAD1AD` |
| 최종 Git용 LF 정규화 사본 | `2B604D92F1BC0FBD8DA80955873E21F80A398D4334C2FD8105720EAC3C895A0A` |

## 미검증·복구

남은 진단에는 모듈 해석 실패가 포함된다. 실제 Electron 설치·앱 실행·패키징, 실제 권한·키·사용자 자료·서비스·SDK·Agent·C#·DB 검증은 제외했다. RAM 시험은 onState 수명이나 설치 제품 전체 동작을 검증하지 않는다. 롤백은 preload.cjs의 이 주석 변경만 시작 HEAD 기준으로 복구한다. 현황·Git·통합은 Main이 담당한다.
