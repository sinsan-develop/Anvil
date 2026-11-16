# FN18 데스크톱 수신 client 정적 계약 보완 결과

## 판정

의존성 복원 뒤의 고정 TS7 진단 104건에서 수신 client의 소스 진단 47건이 사라졌다. 신규 진단은 0건이고 desktop 전체 검사는 **57건, exit 1**이다. 수신 client의 남은 1건은 14행 74열 생성 번들 `./native-proof-runtime.cjs`의 TS2307이다.

| 검산 기준 | 값 |
| --- | --- |
| 브랜치 / 시작 HEAD | `codex/av3-native-connection-followup` / `1ed1dffe16f9e4714862dc9ad61504e69ea4b924` |
| 최초 지시 r3 SHA256 | `F90EE097BD869A17B4E3A574F76445BA1FACBB630225ADCB1FD42796A530B6DF` |
| catch 경계 보완 r4 SHA256 | `390679F6C7137637DCB36D133FCE36622A47F7B970E0AA41E35C9DE1BFE459B9` |
| 기준 진단 원문 | `../fn18-desktop-typecheck-1ed1dffe-restored-20261116.txt`, 13,294바이트, SHA256 `1E7F3828AE51C2C2F30D0859BD9509ECE3DF9C19773134B42630EADCAD7450EA` |
| 제품 SHA256 (작업 트리) | `apps/desktop/src/native-first-receive-client.cjs` · `8059223961A955832FF318D4718CC515DC0E75EB7E519B463F344E7AC866C170` |
| 직접 시험 SHA256 (작업 트리) | `tests/desktop/desktop-trust-registration.test.cjs` · `3F5CD073C00C800ACF7F741C1DEE03CB9A317531EFC191E7189BCCB9167CF3D7` |

시작 시 Main이 수정 중이던 환경 문서·현황·지시서는 보존했다. UI14·settings·preload 결과는 선행 체크포인트에 있다.

## 변경 근거

- 원 `NativeFirstReceiveHumanClient`의 수신 창 준비·열기·제어·조회·닫기와 signing/phase/handoff 입력에 JSDoc를 함수 자체에 연결했다. 수신 전 원문·receiver는 `unknown`, ID는 `string`, epoch는 `number`, 제어 phase는 원 네 리터럴, current source의 취소 인자는 `AbortSignal`이다. `openedWindow`는 검산된 사본의 보유와 dispose를 반영해 `object|null`로 선언했다.
- `produceSlotReceipt`가 원 `receiptBasis(receiver)`의 등록 신원·창·guard·slot 검사를 통과한 직후에만 `WeakMap.has/set`의 두 키 식을 국소적으로 `object`로 좁혔다.
- `handoffReceiveDelivery`의 catch는 첫 신원 검사 실패에도 진입한다. 이때 원래 `slotReceipts.delete(receiver)`가 타입 검사에서 새로 드러났다. r4는 `if(receiver!==null&&typeof receiver==='object')slotReceipts.delete(receiver)` 한 곳을 허용했다. 원 `nativeFirstReceiveReceiverIdentity`는 함수·symbol·기타 비객체를 변경 전부터 거부해 이들이 영수증 키로 등록될 수 없다. 객체 실패의 키 삭제, 기존 `abortReceivePhase` 호출, 원 오류 throw는 유지된다.
- 정적 편집 18곳과 이 guard 한 곳을 각각 역치환했다. 결합 역치환 결과는 원 작업 트리 CRLF 22,720바이트(SHA256 `F5E103F8745CD89CD0810E3C1EB933ECFCDA92B56F9FFBE1F3E50816DEFA2AC5`) 및 `git show HEAD:apps/desktop/src/native-first-receive-client.cjs`의 LF 22,687바이트(SHA256 `1C3DD47490E5197767D9F785FC16ACE782E81E36D08FB9DA1CDDD61AA410D2C6`)와 각각 일치했다(`f3a3e3`). 그 외 실행 표현·보호 경계·인자 순서는 동일하다.

## 검증

모든 명령의 작업 디렉터리는 inner checkout이다.

```powershell
node ../../node_modules/typescript/bin/tsc --noEmit -p apps/desktop/tsconfig.json --pretty false
node --test --test-name-pattern="handoff 거절은 저장된|SlotReceipt는 수용전|실제 slot 수용 뒤 CJS await|원 CJS Client의 private currentSource|실제 settings→preload→shell은 원 HUMAN Window" tests/desktop/desktop-trust-registration.test.cjs
git diff --check development/main
```

1. 중간 정적 검사 `b98518`은 **58건, exit 1**이었다. 원 41개 매개변수 TS7006·`openedWindow` TS7034 1개와 TS7005 3개·`has/set` TS2345 2개가 각 원 위치에서 해소됐다. 그 뒤 이전에 implicit any였던 catch의 `delete(receiver)`에서 TS2345 한 건이 드러났다. 같은 메시지라 파일·코드·메시지 멀티셋만으로는 순감 46건처럼 보인다. 제품 식과 행·열을 별도로 대조했다. 당시 기존 수신 시험 4건은 `fa992d`, 4 PASS, 0 FAIL, 0 SKIP, exit 0이었다.
2. 최종 정적 검사 `c86a0d`는 **57건, exit 1**이었다. 기준과 파일·코드·메시지·중복수로 대조해 정확 47건 삭제·신규 0을 확인했다. 최종 진단 원문의 LF 정규화본(마지막 개행 하나)은 7,433바이트, SHA256 `07535DC14D2BA4B896E6526B92832C3EAF855778194F23CE4F095DA41202F339`이다. 나머지는 수신 client 1, policy 1, shell 12, 등록 owner 43건이다.
3. 최종 RAM 수신 시험 `c85d25`는 **5 PASS, 0 FAIL, 0 SKIP, exit 0**이었다. 새 시험은 성공한 receiver 영수증 조회→재handoff 실패→원 abort 1회와 영수증 조회 거절, 이후 null·undefined·숫자·문자열·symbol·함수 각각의 원 오류와 abort 1회를 관측한다. 선택한 기존 4건이 위조·교차 receiver, 수용 후 만료, dispose, settings→preload→shell 정상 handoff를 검증했다.
4. main 대비 전체 tracked 공백 검사는 `a58e70`, 출력 없음, exit 0이었다. 새 untracked 결과서는 별도로 `git diff --no-index --check -- /dev/null docs/04_test_reports/AV3/FN18_NATIVE_RECEIVE_CLIENT_DECLARATION_RESULT_20261116.md`에서 공백 진단 0건을 확인했다. no-index의 exit 1은 새 파일과 빈 파일의 내용 차이를 나타낸다.

## 미검증과 복구

실제 Electron·설치·패키징·생성 번들 해석·DB·권한·키·사용자 자료·서비스·SDK·Agent·C# 실행은 검증 범위 밖이다. RAM에서 검산한 수신 흐름과 실제 설치 수신을 구분한다. 데스크톱 전체 타입 게이트는 계속 FAIL이다.

이 단위의 복구 대상은 해당 제품의 정적 편집과 catch guard, 직접 시험 한 건 및 이 결과서다. 원 기준은 위 시작 HEAD다. 이전 체크포인트의 UI14·settings·preload와 Main의 별도 편집은 유지한다. Git 통합과 현황 갱신은 Main이 담당한다.
