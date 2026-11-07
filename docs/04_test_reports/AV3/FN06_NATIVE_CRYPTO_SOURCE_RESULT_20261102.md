# FN06 r2 native credential·ID·nonce 내부 crypto source 결과

2026-11-02 / Main 어울 / 기존 Primary·Reviewer

## 판정

**SOURCE 한정 검수·통합, 실제 발급/보호 전달·전체 계획 완료 아님.** 원 r2 A5C4AF434…E3085·직접승인9B10475C…6E17567·파생 WI1B8C944D60BFD28F59CE77B72B4D09194CCEE94E28A4B26E2D15D187FD30B802 범위다. 시작79cc02cc local/private동일, code **1a4090dad5ca48d8df856b1b00f30b6ff4ceb2ee** 정확신규2/114추가다. Main72a23b raw/index2동일·stageddiff0을 확인했다. 기존 SQL/제품/시험·보호untracked3·다른담당자료 변경0이다.

| 파일 | 최종 SHA256 |
|---|---|
| apps/server/modules/executions/native-preparation-crypto-source.ts | A2B83BC7B32CA84DBE9DF5D119E32FD715EFE220FA99496B8E8CEB66F7608D38 |
| tests/unit/FN06/native-preparation-crypto-source.test.ts | BDC4C9C2AA9A0D4C00552EB1B04714BEFC1A57A5C9B72EC9B7CEE4952C8F5C33 |

## 변경·계약 보존

기존 NativePreparationSource의 allocate/credential 및 host nonce에 조립할 내부 생산 source다. count는 기존 실제소비 {1,2,4,5}·배치UUID검산/중복거절이며 자동재시도0이다. 별도32byte 난수→prefix없는opaque43·credentialID별최초generation1·ASCII opaque의SHA256 digest를 생성하는 source를 구현했다. 실제 기본Nodecrypto는 import/constructor에서 실행하지 않으며 app에 기본 등록하지 않는다. 기존등록av3ct1_/다른목적·표·수명·권한을 재사용하지 않는다.

credential 결과는 ID/세대/digest뿐이며 exact입력·원120초이내최소기한·clock/포트변경을 검사한다. 수신 callback없음은 생성전 거절, callback은별도임시copy에딱1회·반환후원alias 소거·에러/불명재전달0이다. 완전한관리문자열/외부복사본소거를보장하지않는다. 인증/정책·현재권위·보호recipient/ACK나실제발급producer완성이아니다.

## 검증·오류

- Primary0eaa85: 실제 coordinator가새allocate에서503이되어기대200과다른 기능RED0PASS1FAIL/exit1. 앞47ee27고정시각이원writer요청시각보다앞선fixture준비오류는관측전명시clock전진으로보정했고기존파일변경0이다.
- Primary e195ab 최종11PASS/0FAIL/4164.3009ms·type57ab1f exit0. 중간타입초기화흐름5+callback void반환1에서반환unknown·검산local설정후필드대입으로보완했으며타입실패실행2회와제품실패를구분한다. 기대값/기준완화·any0이다.
- Main6896c9 source·명시대역/diff 대조 후 **9187a0 신규11PASS/0FAIL/skip0/2859.0609ms·type/diff exit0**. Primary결과와중복합산0이다.
- 독립 C0/I0·두SHA시작끝동일. 실제coordinator의prepare5/delivery2·1→원receipt/writer예약/2표저장/COMMIT후전달·callback부재rollback·COMMIT불명전달0·명시replay추가생성/전달0을확인했다. **count1/4와nonce는직접포트검증이며전체host protocol 실행으로확대하지않는다.**

정확 Main 명령:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/unit/FN06/native-preparation-crypto-source.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

### 대역 범위의 중요한 구분

신규crypto randomBytes/UUID/clock는모두명시deterministic대역이다. 기존 persistProjectReceipt의영수증/audit ID에는 **비밀 아닌 메모리Node UUID가 사용됐다.** 전체시험UUID/난수0이라주장하지않는다. WI의모든대역문구는신규crypto포트로한정한다는Main판정을WORK_STATUS에기록했다. 실제credential/키/사용자자료생성이아니며이를없애려고기존제품·전역crypto binding/mock·syncBuiltinESMExports를수정하지않았다. 새 credential 엔트로피의실측증거는아니다.

## 제외·잔여·복구

실제 DB/SQL적용·권한·credential/키/CA·네트워크/서비스·helper/C#/OS/native/Agent·실자료/백업조사·P03R3 실행0이다. 새 QA 파일/자원0·livehandle/시험timer0이며회수대상자원없음이다. 합성 PoolClient transaction 결과는실제DB 원자성/경합/COMMIT검증이아니다.

실제 보호current/options/profile·등록keymapping/caller·delivery/recipient/ACK·native factory/owner bridge·제품기본등록·실제서비스/사용자인수는미구현/미검증으로남긴다. 다음업무는실제연결을막는producer/권한계약차이를정확대조하며또하나의미사용wrapper/반복검증으로기능진도를대신하지않는다. FN04별도관리원문계약결정은해당부분만분리하며전체작업을대기시키지않는다. source복구는1a4090da의정상revert후보,실제환경영향0이다.
