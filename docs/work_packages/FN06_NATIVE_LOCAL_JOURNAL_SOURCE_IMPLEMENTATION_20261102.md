# FN06 native 준비 원시도 file adapter — source 구현 작업지시서

2026-11-02 / Main 어울 / 기존 r2 A 승인 내 내부 구현 / **SOURCE_ONLY·합성 검증**

## 1. 목적·근거

원 승인 r2 A SHA5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085의 §10.3은 PREPARED와 FACTORY_ATTEMPTED 두 exact 원형·append/flush/readback·같은 authority의 단발 순서를 이미 정의했다. §177은 새 source 구현 시 내부 저장·보호 소비를 연결하되 실제 효과는 제외한다. 현재 native-preparation-local-attempt.ts는 포트·검산만, NativePreparationClient는 주입 journal을 실제 소비하나 concrete 저장 adapter가 없다. 기존 SyntheticFileClientStore의 목적·6사건을 native 원장으로 재사용하지 않는다.

Main 판단: 새로운 HTTP·명령·DB·권위·키·승인·사용자 데이터 계약을 추가하지 않는 내부 파일 배치/adapter 구현이다. r2 원형·SOURCE_ONLY_MODEL·기본 미등록·실제 보호 미검증을 유지하므로 재승인 대신 이 파생 WI로 정확2경로를 추가 위임한다. 원 승인/원 WI bytes는 수정하지 않는다. 실제 보호 journal 제공 완료나 실제 실행 허가는 아니다.

## 2. 정확 경로·담당

기존 Primary 단일 writer가 신규2경로만 구현한다. Main 제품 쓰기0, 기존 Reviewer read-only, 새 Agent/chat/branch/worktree/예약0.

1. apps/connector/runtime/native-preparation-file-store.ts — 기존 NativeLocalJournal/NativeLocalTransaction을 구현하는 명시 주입 file adapter. Node FS 바인딩은 호출될 때만 동작하며 import/constructor에서 파일 조사·열기·생성0. 실제 제품 기본 등록0.
2. tests/unit/FN06/native-preparation-file-store.test.ts — 메모리 FS/가짜 FileHandle과 실제 NativePreparationClient를 연결하는 집중시험. 실제 파일·디렉터리·키·DB·서비스·Agent를 만들거나 조사하지 않는다.

기존 local-attempt/client/factory source와 기존 시험은 읽기만 한다. 새로운 경로/공개 계약이 필요하면 구현 전에 Main에 정확한 이유를 반환한다. 다른 담당자가 함께 작업하므로 타인 변경·보호 untracked3·기존 SQL·다른 소스는 복구하거나 수정하지 않는다.

## 3. 내부 구현 조건

- 기존 포트 transport='SOURCE_ONLY_MODEL'과 exact 두 원형을 보존한다. source adapter 성공을 OS 보호·전원손실 내구성 PASS로 표시하지 않는다. 별도 실제 key/delivery/native factory는 연결하지 않는다.
- 호출자가 소유 확인한 전용 절대 root만 명시 주입한다. root 생성·ACL 수정·자동 복구/삭제/lock 탈취0. 파일명은 검증된 authority fullref의 canonical hash에서 유도해 임의 외부 경로를 받지 않는다. 정체성·link/realpath·file descriptor 대조 코드는 기존 source adapter 방식을 참고하되 무관 공통화0.
- authority별 배타 처리와 불명 소유권 실패 폐쇄를 구현한다. 동시 호출, 같은 ID/다른 fullref, 교체된 root/directory/lock/file 및 symlink/special/범위 이탈은 새 시도로 승격하지 않는다. 확인하지 못한 OS 보장은 명확히 남긴다.
- 원행은 append-only다. 기존 PREPARED/ATTEMPTED·부분 기록/불완전 JSON·해시/순서 불일치·만료 기록을 빈 원장으로 취급하거나 덮기/삭제하지 않는다. max2records와 기존 원형/정규 hash를 재검산한다. 새 source 내부 파일 wrapper를 사용하면 버전과 exact 원형을 한정하고 외부 계약으로 노출하지 않는다.
- 유한 저장 한도를 생성 인자로 명시하고 기존 데이터+새 기록을 사전 검사한다. 한도 초과 때 truncation/eviction/자동 확대0. 두 기록/상한 검사를 느슨하게 바꾸지 않는다. 실행용 저장량 계약이나 실제 공간 조사로 확장하지 않는다.
- append의 부분 write를 처리하고 sync 성공·정확 readback 뒤에만 완료한다. write/sync/readback/close 불명에서는 원 파일/lock을 보존·추가 append/factory를 차단한다. 확인된 자기 lock만 정상 회수하고 불명 소유 lock은 남긴다. 실패 뒤 늦은 비동기 정착이 파일을 새로 바꾸거나 다른 호출의 lock을 회수하지 않게 한다.
- callback 종료/인증·기한 오류·재시작에서도 원 단발 이력을 지킨다. 안전하게 정착한 자기 자원만 회수하며 진행중 FS 작업을 남긴 채 handle을 재사용/폐기하지 않는다. 파일 시스템 자체가 보장하지 못하는 경합·directory fsync·악의적인 동일사용자 변조 내성은 과장하지 않는다.

## 4. 구현·검증 순서

1. 기존 승인·이 WI·실제 Git와 보호 파일을 대조하고 정확2경로에만 착수한다.
2. 실제 NativePreparationClient에 새 adapter를 주입하는 메모리 FS 정상 반례 RED를 먼저 확보한다. client→PREPARED append/sync/readback→challenge/consume→ATTEMPTED append/sync/readback→private ticket/fake factory1을 같은 tuple로 이어야 한다. 별도 모의 원장만 시험하고 연결 완료로 보고하지 않는다.
3. 최소 구현 뒤 정상 연결 GREEN과 재시작/같은 authority 반복의 factory 추가0, 다른 authority 배타/원행 분리, 부분 write/sync 실패/readback 변조·한도·lock 불명/경합/late 작업에서 factory0·원행 보존을 집중 확인한다. 한 시험에 모든 사례를 무리하게 합치지 않는다.
4. node --test로 신규 file-store와 직접 영향 기존 client/local 원형 시험을 필요한 범위만 선정한다. 기존 native 서버/화면63/17·보완1·기존6은 불변이면 반복하지 않는다. 실제 파일 QA·native·DB·Agent는 NOT_RUN이다.
5. tsc --noEmit -p tsconfig.base.json, git diff --check. 전체 프로젝트/브라우저/부하 검증0. 독립 C/I finding은 같은 Primary가 좁게 보완하고 scoped 재리뷰한다.
6. Primary는 정확2 SHA/diff/실제명령·exit·RED/GREEN/오류횟수/미구현·미검증·live handle0과 writer 반환을 Main에 제출한다. Main fresh 검증·독립 C0/I0 뒤 source checkpoint/private 게시하며 필수 actual gate 미충족으로 PR/main 병합·배포·인수0이다.

## 5. 제외·복구·잔여

실제 DB/DDL/권한·키·CA/TLS·서비스/native/OS/compiler/helper·Agent·실자료/백업 조사·실제 파일작업·P03 R3 실행0. 메모리 FS는 실제 root ACL/소유·전원손실·cross-process 배타/OS 보호 증거가 아니다. 제품 실제 issuer/currentfact/보호전달/실제factory·START/SEND/STOP는 여전히 미구현/미연결이다. 전체 계획을 완료로 표시하지 않는다. source는 별도 commit의 정상 revert 후보로 보존하고 기존 미커밋/보호자료를 건드리지 않는다.