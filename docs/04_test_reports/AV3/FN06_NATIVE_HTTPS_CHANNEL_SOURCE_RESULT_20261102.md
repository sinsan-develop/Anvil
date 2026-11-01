# FN06 native 준비 HTTPS 채널 source 결과

2026-11-02 / Main 어울 / **SOURCE 검수·통합, 실제 TLS·보호 공급자 미검증**

## 기준·변경

- r2 A SHA5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085, 파생 WI FN06_NATIVE_HTTPS_CHANNEL_SOURCE_IMPLEMENTATION_20261102.md SHA4F81118FEAC9EEC4D00101DF1AC2FA56AC66A69EC185F148E323047F432A6E30를 따른다. 기존 Reviewer preflight C0/I0 뒤 기존 Primary 한 명이 구현했다. Main 제품쓰기0이다.
- 시작 branch codex/av3-stage-b/local-private e1d92cdfb65e375ef73e01226421070bd332f704. code82ea3b7955b4559d5375b3c685a272a53dc2a615 정확신규2/109추가, Mainbb8455 raw/staged2일치·stageddiff0. 원 승인/원WI·기존 제품/시험·SQL·보호 untracked3 불변이다.
- apps/connector/runtime/native-preparation-https.ts — 19876B/SHA188CA8CA45A52AE5C3E9C7D5D1D4EBCCA5387F7D8E1E1D3AF04C5ACB68D04AD2.
- tests/unit/FN06/native-preparation-https.test.ts — 25109B/SHA17A2C2AD77B4DE7C507460AE55A938ACBBC33A83E29DA60D97C121E3C21DC243. 두 파일 UTF-8/LF·CR0·후행공백0.

## 구현한 소비

기존 NativeOwnedChannel의 안정된 own current/challenge/sign/consume와 identity를 제공하는 Node HTTPS 전송 source를 연결했다. import/constructor socket·파일IO0·기본미등록·SOURCE_ONLY_MODEL을 유지한다. 실제 보호profile/current/native credential/등록 signer 공급자가 아니라 해당 source 의존성을 검사하는 adapter다.

고정 원 authority·등록/profile·목적/세대·host fingerprint·기한을 대조하고 정확 current GET/challenge POST/consume POST·canonical 본문·8proof/P1363 header를 만든다. sign은 원 purpose/authority/challenge/target/body에 한정한다. 임의 bytes·다른 목적 credential·query/cookie·redirect/자동 retry를 허용하지 않는다. Node 설정은 rejectUnauthorized:true·명시 CA·기본 hostname 검사·agent:false다. 실제 CA의 보호/신뢰 검증을 수행했다는 뜻은 아니다.

한 시도의 첫 signal·단조 시작점과 전체10초/최소기한을 유지하고 단계마다 예산을 다시 시작하지 않는다. read/sign/response await 뒤 현재성·기한, abort/후퇴clock/late응답을 검사한다. 응답2MiB·엄격UTF-8/중복JSON/header/status·고정오류를 제한한다. bearer/서명입력/CA 원문/raw 오류를 결과·로그에 싣지 않는다.

실제 NativePreparationClient→새 adapter→고정 request driver의 wire/응답→원 journal→private ticket→fake factory1을 연결했다. 실제 서버/네트워크/TLS/물리 factory를 실행한 것은 아니다.

## 검증과 독립 보완

- 93fc2b 모듈부재 loader exit1은 준비실패다. 미구현 own 포트 진입 뒤4041a0 실제 client UNKNOWN≠CREATED_OBSERVED 기능RED1/exit1/271.1969ms를 확보했다. 비정규nonce fixture와 타입진단5건 보완을 별도 기록했다.
- e488dc는 동기 조기response에서 수동error listener2개가 등록되는 실제RED였다. 같은 emitter에 한 번만 부착하도록 보완해5e90ad 해당GREEN 뒤 최초13조건을 통과했다.
- Main02db76은 모든 시험 생성지점의 명시request대역을 읽고 default실request 호출0임을 확인한 뒤 Main9da9eb에서 신규13PASS/0FAIL/skip0/368.6428ms·직접client선정3PASS/0FAIL/skip0/395.8117ms·type/diff exit0을 확인했다. 이 수치는 아래 I1 보완 전 snapshot이고 Primary346164/cc44c5와 중복합산하지 않는다.
- 독립 첫 C0/I1: public identity는 값만 동결돼 속성 재바인딩이 가능했으며, 보호read 대기 중 origin을 바꾸면 원 CA/bearer의 요청이 사후client검사보다 먼저 다른origin에 만들어질 수 있었다. Main94a024도 소스에서 확인했다. 0c91b2 명시fake driver의 실제RED는 다른origin요청1을 관측했으며 실네트워크/실비밀 사용0이다.
- 같은 Primary가 전송용 #origin/#identity를 private 고정하고 매 #ports 검사에서 public own data descriptor·원객체 동일성을 확인했다. 원origin변경·동일값새객체·getter교체를 요청 전에 거절한다.
- Main486457 보완 후 `public identity origin|^실제 NativeClient` 선정2PASS/0FAIL/skip0/204.3967ms·최종type/diff exit0. 신규3교체음성과 정상client소비를 확인했다. 최종전체14를 단일실행했다고 주장하지 않는다.
- 기존 Reviewer scoped 재검수 I1 ADDRESSED·C0/I0·시작끝2SHA동일. 보완 역치환 source SHA는 직전1659A79A…9D7FF0AA와 정확일치하며 fixdiff 추가C/I0이다. Reviewer는 읽기만 했고 시험 실행0이다.

```powershell
# I1 보완 전 직접 묶음
node --test tests/unit/FN06/native-preparation-https.test.ts
node --test --test-name-pattern='^(owned 채널|재시작 PREPARED|current 또는 consume timeout)' tests/unit/FN06/native-preparation-client.test.ts
# I1 보완 후 해당 음성·정상 소비
node --test --test-name-pattern='public identity origin|^실제 NativeClient' tests/unit/FN06/native-preparation-https.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

13조건은 정상 exact wire, 공급자·목적/등록/profile/기한, 서명범위, consume signature/proof/body, await변경/동일signal, 원10초/최소기한, hold timeout·late/abort·후퇴clock,2MiB/중복JSON·UTF8/header/redirect/status, 고정오류/자동재송신0, consume뒤만료·원PREPARED, REPLAY_ONLY, 동기조기response 수신기중복을 포함한다. 이후 새 identity교체조건은 별도로 위선정2에서 확인했다. 기존server/UI/App/journal검사는 불변이므로 반복하지 않았다.

## 정리·미검증·복구

시험 timer와 active listener를 회수했다. late error 방어용 수동 listener1은 요청·응답 객체 수명 동안 남기므로 listener0/완전제거로 보고하지 않는다. known live handle0/QA0는 제출·시험 범위다. 모든 실행 시험은 명시 request대역이며 default Node request 실호출0이다.

실네트워크/TLS handshake·CA/키/Secret·파일·DB/권한·서비스/native/OS/helper/compiler·Agent·실자료/백업/P03R3 실행0. 실제 보호profile material/current회수 확인/native bearer소유·전달·등록키signer는 미구현이다. 이 adapter 성공은 임의 CA/선언값을 보호 검증으로 승격하지 않는다. 실제issuer/physical factory/START/SEND/STOP·journal 제품등록도 미연결이며 전체 FN06/FN08/Stage/계획 완료·PR/main병합·배포·사용자인수0이다.

복구는 별도 source commit의 정상revert 후보이며 실제 키/권한·DB·서비스·파일 삭제/복구를 실행하지 않는다.