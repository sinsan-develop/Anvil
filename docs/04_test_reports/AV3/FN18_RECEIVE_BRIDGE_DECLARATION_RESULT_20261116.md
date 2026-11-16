# FN18 기존 수신 브리지 선언 검증

## 판정

데스크톱 타입 진단이 169건에서 164건으로 줄었다. 사라진 5건은 모두 이미 노출된 수신 메서드의 화면 JSDoc 선언 누락(TS2339)이었다. 나머지 164건은 그대로 남아 desktop 타입 검사 전체는 실패다.

## 기준과 수정

branch `codex/av3-native-connection-followup`, HEAD `fcd0ed0cf7283866141496db216076f060529006`, 지시서 SHA256 `4C37E3664308776AF669BD625CF07491BBCC414108657E670506C88549172C4A`. 시작할 때 기존 동결 UI14 제품·시험·결과서 및 Main 문서 변경이 있었다.

`apps/desktop/src/settings.js`에서 기존 trustApi 정적 타입에 수신 브리지 선언을 결합했다. preload.cjs:5~9의 인자 순서와 policy.cjs의 assertTrustIpc, shell.cjs:54~70의 빈 상태·소유 상태·오류 투영, native-first-receive-client.cjs의 보호 원 offer/window/arm 참조 소비를 대조했다. status에는 원 attemptId와 epoch, begin/refresh에는 앞에 requestId가 필요하다. arm에는 version 1 offerRef와 true 확인, close에는 true 확인이 필요하다. 성공 응답은 화면에 전달되는 수신 상태이고 실패 응답은 검산된 오류 코드다. offerRef는 ARM 입력에서는 필수이고 화면 상태의 windowRef·offerRef·armRef는 null을 허용한다.

변경 구간은 JSDoc 24행 추가·1행 교체다. 구간이 전부 주석인지 확인하고 메모리에서 해당 주석을 HEAD의 원 주석으로 되돌려 전체 파일 바이트를 비교했다(a4357c exit0). 실행문과 preload·IPC handler는 그대로다.

| 파일 검산 | SHA256 |
|---|---|
| settings.js HEAD 및 주석 역치환본 | `1399B9CF0D47CDA3264C627118BE91C83076FF02E016E7335BD95BCFEFBDAB6D` |
| settings.js 최종 | `10817EAA8015D097DC79A38A32E256B24B3232C190281624596543BA2F1E88EA` |

## 검증

- 원 진단은 내부 QA 자료 `fn18-desktop-typecheck-fcd0ed0c-20261116.txt`, SHA256 `241145D004D9C824457667ED08D7646FB8E2DE55EEAAD898A63E02E8415325F6`, 169건·exit1. 기존 출력은 변경하지 않았다.
- `node ../../node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json --pretty false` — 같은 고정 TypeScript 7.0.2, 911381 exit1, 164건. 두 출력의 파일·진단 코드·전체 메시지(후속 설명 포함)별 중복 건수를 대조했다. 삭제된 항목은 settings.js 원 45행의 nativeReceiveStatus(820열), Begin(904), Refresh(1008), Arm(1110), Close(1213)의 TS2339 각 1건이다. 신규 진단 0건. 다른 164건은 줄·열도 동일했다.
- `node --test --test-name-pattern="실제 settings의 원 REGISTERED 수신 시작 버튼" tests/desktop/desktop-trust-registration.test.cjs` — 64f144 exit0. 데스크톱 settings 스크립트/이벤트→preload→합성 main handler의 명시 begin/status 경로 1P/0F/0SKIP, 1225.6017ms.
- `git diff --check development/main` — 3307e7 exit0. Git의 LF/CRLF 작업 사본 안내가 있었다. 신규 결과서는 빈 파일과 별도로 공백 검사를 수행한다.

## 미검증·복구

164건의 기존 오류와 전체 데스크톱 빌드·설치·실제 Electron 수신, DB·권한·키·서비스·SDK·Agent·C# 및 사용자/백업 파일은 이 작업에서 검증하지 않았다. 별도 root 타입 검사는 이번 데스크톱 JS 대상에 대한 추가 근거가 없어 반복하지 않았다. 롤백은 지정 제품의 주석 변경만 시작 HEAD로 복구한다. 같은 Stage의 UI14 변경은 보존한다. 소유 코드는 동결하고 Main이 현황·검수·Git 통합을 맡는다.
