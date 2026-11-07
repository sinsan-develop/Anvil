# FN06 native 전용 proof signer source 결과

2026-11-02 / Main 어울 / 기존 Primary 구현·기존 Reviewer 독립검수

## 판정·범위

**SOURCE 한정 검수·통합 / 실제 보호 키 사용·native 준비·전체계획 완료 아님.** 원 r2 A SHA5C4AF434…E3085·직접승인9B10475C…6E17567·원 WI3905A46E…151C1F6을 보존했다. 파생 WI653BC4950A56E0E4AC46FABD889621E309A5844087FB06F0A3AFF5D820A870DC와 WORK_STATUS의 내부 시간오류 보완 판정으로 정확5경로를 구현했다.

시작 local/private f9ac35eb, 지시서 checkpoint b83b83bd, source checkpoint **5dcdef81** 정확5/208추가11삭제다. branch codex/av3-stage-b, main 직접수정·병합0. 기존 보호 untracked3·다른 담당 자료는 제외했다. Main37af0c 최종5SHA/raw-index동일·staged diff0 뒤 checkpoint했다. C# LF→미래CRLF 경고는 Git 안내이며 현재 raw/index bytes 동일, 설정 변경0이다.

## 변경과 보호

HTTPS sign에서만 원 authority/challenge/proof/domain bytes·signal·동적 remaining의 private 객체 문맥을 발행하고 finally/timeout/abort에 폐기한다. slot은 같은 객체 전달과 자기 종료/만료의 추가 거절만 결박한다. typed signer는 기본 미등록 mapping/exchange에 닫히며 실제 등록 mapping/caller/root 인증을 선언값으로 대신하지 않는다. 정확 P256 SPKI/fingerprint·proof8 hash·64B P1363·실제 공개키 검증으로 잘못된 응답을 거절한다.

C# 신규 primitive는 닫힌 canonical 요청과 원 authority/challenge/body/domain·기한·기존키의 공개지문을 대조하는 source다. **기존 ProtectedStore.Main/Run/Load·SIGN_PROOF/CREATE_KEY/DPAPI·build/desktop 연결은0**이다. 임의 바이트 서명·키 발급/저장/평문 반환을 열지 않았다. same-process 문맥은 OS/peer/package·키 사용 인가가 아니다.

### 최종 SHA256

| 파일 | SHA256 |
|---|---|
| apps/connector/runtime/native-preparation-https.ts | 68C6FB45AEE9B85DAA55ECC98A2EF6110172F01E879B89C9328650B4CD64CEE8 |
| apps/connector/runtime/native-preparation-credential-slot.ts | 40548FDFDBD6AF8011BFF45F30D795C24033A0DFDF1A10CF81A62EB98AEEB2F7 |
| apps/connector/runtime/native-preparation-proof-signer.ts | EFC1B5588C7252D22BC8B4A6DDC12C87B198E8D98DAFC03E0EAC9C7441857D8A |
| apps/connector/native/NativePreparationProofSource.cs | DDFF74BAC1D9FBAAF34E3A1A47745F9AFD20D80B39C1A1614DC6C88AFA5912A5 |
| tests/unit/FN06/native-preparation-proof-signer.test.ts | 45FDB38E883527F4A0DFEDFABBCC61703254D15BA7A31D2CC9BE1BC251549661 |

## 실제 검증·오류

| 증거 | 실제 결과·한계 |
|---|---|
| Primary da7325 | 실제 client→slot→HTTPS 신규 signer 부재 UNKNOWN 반례 0PASS1FAIL/188.6152ms/exit1. loader 부재·출력 미회수는 별도 준비/NOT_OBSERVED |
| Primary 중간 | 6PASS2FAIL 중 dispose뒤 늦은exchange1은 실제 source 수명 결함으로 같은context에 slot guard를 결박해 해소. 다른1은 시험 기준시각 준비오류 |
| Main c2cfab, 보완 전 | 신규 signer9PASS/0FAIL/skip0/484.4605ms, tsc exit0. Primary d6cde0 결과와 중복합산0 |
| Main988fcc, 보완 전 | HTTPS정상·timeout/slot정상 선정3PASS/0FAIL/skip0/241.1565ms. 나머지 기존전수 재실행0 |
| 독립 첫 검수 | C0/I1: frame.remainingMs 숫자를 C#수신 후 새Stopwatch로 시작해 전달지연이 원10초에서 빠짐. 부모사후검사는 늦은 반환만 폐기하고 이미 시작한 키사용을 막지 못함. 실제키/helper 실행0으로 실제 사고 관측은 아님 |
| Primary b1a691→e5229c | 잔여100ms frame을200ms 지연시킨 명시 exchange 모델의 서명시작1 RED→고정상한 보완 후 직접정상1/집중음성4=5PASS/264.0902ms, type0 |
| Main ba78ce, 최종 | 아래 선정5PASS/0FAIL/skip0/302.6556ms·tsc/diff exit0. 앞9/3 및 Primary와 합산하지 않음 |
| 독립 scoped 재검수 | I1 해소 C0/I0, 최종5 시작끝 SHA 동일. C# 실제 runtime parity를 PASS로 올리지 않음 |

보완은 최초 channel wall+10초/authority 상한을 고정하고 profile/credential/signer/challenge·mapping 기한으로 좁히기만 하여 lease/frame의 callExpiresAt에 결박한다. C#은 서명 전후 고정 wall상한과 수신후 단조 remaining을 함께 검사한다. 부모 원단조 예산·await후 검사·폐기·전달직전 동적검사를 유지하며 새 시간창/재시도0이다.

Main 최종 선정 명령:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test --test-name-pattern '^(실제 client→slot|지연 frame|최초 고정 call|최소 profile|고정 call)' tests/unit/FN06/native-preparation-proof-signer.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

Primary sandbox Git diff128은 환경 오류로 보존했다. Main elevated823dbf/ba78ce/37af0c의 실제diff0으로 대조했고 Git/ACL 설정 변경0이다. Primary fix-loop 이름 탐색 준비는 정확 references/fix-loop.md로 안내해 해결했으며 별도 skill/agent 생성0이다.

## Main 한정 compile-only1회·정리

초기 WI의 Primary compiler 금지는 유지했다. Main은 최신 코드·합성검증 승인 안의 필수 build로 실제 키/helper 실행과 구분한 보완 계획을 commentary/WORK_STATUS에 사전 등록했다. 자문 C0/I0는 사용자 승인 대행이 아니다. 옛 일회 compile 허가 재사용0이다.

고정 compiler C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe SHA46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00, /noconfig /nostdlib+ /target:library /optimize+ /debug- /platform:x64와 명시 mscorlib/System/System.Core/System.Security/System.Web.Extensions만 참조했다. 위 동결 C# 한파일만 입력, 응답파일/추가source/기존helperbuild0이다.

Main afbaa2: PID29152/2026-11-02T00:56:36.5966510Z, 15초 이내 exit0·진단빈값. DLL15872B/SHA305C18B0CB2E67C4960FB8151AABDE8B20CCD502D352BDB296825B7511817AB5, load/실행0. 신규 전용 D:\tmp\anvil-v3-fn06-native-proof-build-20261102-01은 생성전 부재/상위link·동결source/compiler/ref 확인→소유표식→생성파일 해시→정상종료/소유대조 후 정확정리, 별도37af0c 부재 재확인0잔여다. compiler 외 실제helper/CNG/DPAPI·키/DB/권한/서비스/native/Agent·실자료/P03R3 실행0이다.

이 성공은 구문/타입/참조 적합성뿐이다. **C# canonical/crypto runtime parity·실제 키·보호 공급자·물리 종료는 NOT_RUN/미구현**이다. 명시 대역 시험은 실제 C# 서명 실행이 아니다.

## 잔여·다음·복구

실제 보호 keymapping/caller/root·profile/current·issuer/delivery/recipient/ACK·native factory/bridge/holder와 제품 등록, 실제 DB/브라우저/서비스/사용자 인수는 미구현·미검증으로 남는다. source 보완을 native 준비 가능·Agent 실행·전체계획 완료로 표시하지 않는다. live handle/시험timer0, 임시build경로0잔여다.

다음은 동일 r2의 native credential/ID/nonce 내부 crypto source 신규2(파생 WI1B8C944D…30B802)이며 signer writer반환·검수 통합 후 단일writer로 진행한다. 새 실제 실행 승인은 포함하지 않는다. source 복구는 5dcdef81의 정상 revert 후보이며 실제 자료/키/DB·서비스 변경0이다.
