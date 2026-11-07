# FN06 native 준비 원시도 journal file adapter source 결과

2026-11-02 / Main 어울 / **SOURCE 검수·통합, 실제 보호 journal 미검증**

## 기준·변경

- r2 A SHA5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085의 §10.3/177, 파생 WI FN06_NATIVE_LOCAL_JOURNAL_SOURCE_IMPLEMENTATION_20261102.md SHA0821BACBA15500C38B196DB4B66DC51DE4592E0A7AC47389981792E73F3CE218를 따른다. 독립 preflight C0/I0 후 기존 Primary 한 명이 구현했다. Main 제품 쓰기0이다.
- 시작 branch codex/av3-stage-b/local-private ef866d4e8203f370ebf34006e7930635ba82e6e9. code c9a3e284d5bbbffa816af6f2f3c1534a3a8bacb0 정확신규2/130추가, Main950d08 raw/staged2일치·staged diff0. 원 승인/WI27·기존 코드/SQL·보호 untracked3는 수정하지 않았다.
- apps/connector/runtime/native-preparation-file-store.ts — 10907B/SHA85C039063F73EEC86BB982A511B9923661071E079F11B521A84826CA232306ED.
- tests/unit/FN06/native-preparation-file-store.test.ts — 20600B/SHAB1D914CCE5EF1BA2B18C882E783BFCB189EF2E68D210E25CBDAE40B95D9D86A3. 두 파일 UTF-8/LF·CR0.

## 연결한 기능

기존 NativeLocalJournal 포트의 실제 file adapter source를 추가했다. 전용 절대 root·유한 한도·FS 포트를 명시 주입하며 import/constructor IO0, 제품 기본 등록0, SOURCE_ONLY_MODEL을 유지한다. Node FS 바인딩은 명시 호출 시 사용할 source일 뿐 이번 시험에서 호출하지 않았다.

기존 NativePreparationClient가 adapter의 PREPARED append→부분 write 처리→sync/readback→서버 consume 대역→FACTORY_ATTEMPTED sync/readback→소유 private ticket→fake factory1을 실제 소비한다. 재시작과 원행 존재 시 추가 factory0이다. 기존 SyntheticFileClientStore를 native 원장으로 위장하지 않았다.

root/directory/file/lock 정체성·symlink/special·실경로·동일 ID/상반 fullref·두 exact 기록/hash/순서·root 합산 저장량을 검사한다. 부분 write/sync/readback/close 불명·한도·경합/잠금 불명은 원행과 lock을 보존하고 자동 초기화/삭제·탈취하지 않는다. 정상 확인한 자기 lock만 회수한다. callback 종료 시 진행 FS 작업의 정착을 기다리고 늦은 추가 write/sync·handle 재사용을 차단한다.

## 검증·검토

- Primary29b32f 신규 모듈 부재 ERR_MODULE_NOT_FOUND는 준비 실패다. 포트 진입 뒤 e0280a 실제 client UNKNOWN≠CREATED_OBSERVED 행동 RED1/exit1/171.6823ms를 확보했다.
- 2cdbc6 집중10의9PASS/1FAIL은 다른 authority 기록도 반환한 시험 대역의 투영 오류였다. 제품 전역 원형 검산/기대값은 보존하고 authority별 대역을 보정했다. 타입5진단 보완도 별도 기록했다.
- Primary 신규5aa501 12PASS/505.0584ms·직접client선정aca089 3PASS/375.2353ms·type5eb7670을 제출했다.
- Main488fc5 최종 고정2에서 아래 명령을 독립 실행했다. 신규12PASS/0FAIL/skip0/441.5569ms, 인접3PASS/0FAIL/skip0/376.411ms, 타입/diff exit0. Primary 수치와 중복 합산하지 않는다.

```powershell
node --test tests/unit/FN06/native-preparation-file-store.test.ts
node --test --test-name-pattern='^(owned 채널|재시작 PREPARED|current 또는 consume timeout)' tests/unit/FN06/native-preparation-client.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

신규12는 실제 client 연결/재시작, 생성자 IO0·설정, 짧은 write, write/sync/readback/close 실패, 부분 JSON/상반 fullref, callback 실패/만료 이력, 저장량 경계/포화, authority 분리/동시 lock, root/lock 교체·링크, 미정착 write 후 late 차단, 세 번째 append 거절, 읽는 중 directory/file 교체·special/이탈을 포함한다. 테스트는 모두 메모리 FS이며 실제 파일을 생성·열기·조사하지 않았다.

Main178782가 저장/회수 source를 확인했고 기존 Reviewer 신규2 독립 scoped C0/I0·시작끝2SHA 일치를 반환했다. Reviewer는 시험 실행0인 정적 검토다. 실제 server/UI 기존 시험은 불변이므로 반복하지 않았다.

## 미완료·복구

실제 FS/소유 root·ACL·directory fsync·전원손실·cross-process 배타·동일사용자 악의적 변조 내성은 미검증이다. 메모리 readback 성공이 OS 보호/실제 내구성 보장은 아니다. 실제 journal 제공·제품 기본 등록·권위 발급/현재 물리 사실·보호전달·실제 factory/START/SEND/STOP 연결은 미구현/미연결이다.

실제 DB/권한·키·CA/TLS·서비스/native/OS/helper/compiler·Agent·실자료/백업 조사·P03 R3 실행0이다. live handle0/메모리 promise 정착/QA0은 제출·시험 범위다. 전체 FN06/FN08/Stage/작업계획 완료, PR/main 병합·배포·사용자 인수가 아니다. rollback은 별도 source code commit의 정상 revert 후보이며 실제 자료 삭제/DB down migration0이다.