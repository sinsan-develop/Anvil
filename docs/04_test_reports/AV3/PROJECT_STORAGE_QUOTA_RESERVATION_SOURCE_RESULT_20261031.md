# 저장량·지속예약 A — source 구현·검수 결과 (2026-10-31)

## 판정
승인된 **코드·미적용 SQL·합성 검증 범위의 Q1~Q4를 검수**했다. 실제 DB 적용·저장 서비스 사용 가능·기존 프로젝트 차단 해제·전체 WORK_PLAN 완료 판정은 아니다.

## 기준·담당
- 후보 SHA256: 9110DEA86C1616B224F5BB4DA6E1099B7BD9915A0DC67D044CDBC06827EE12E2.
- 직접 승인 기록: PROJECT_STORAGE_QUOTA_RESERVATION_APPROVAL_20261031.md / DE377C277F9C90C849586CF711977D4DE7DAFD013CE979F0336641201858E236.
- 최종 WI r3: PROJECT_STORAGE_QUOTA_RESERVATION_IMPLEMENTATION_20261031.md / CD13DAAC5E1FDAF5AF368C745BED6125237BFAE62E0D9907E4C129A62AE7BBA3.
- 기존 Primary 단일 구현, Main 어울 관리·검수·통합, 기존 Reviewer 읽기 독립 검수. Main의 동일 코드 수정0.
- 시작 branch codex/av3-stage-b, 최초 HEAD/private 3e2decf2b3ef6099d21255e21b00a0d7c95bbfa9. 문서19cf35ba → Q1 15d36edb → Q2 39da3312. Q3 최종 통합 commit은 이 문서와 WORK_STATUS의 후속 Git 기록을 따른다. main/PR/배포 변경0.

## 구현
|단위|실제 source 연결|범위 판정|
|---|---|---|
|Q1|새 accounts/reservations 두 표, 보호 계획·독립 예약 COMMIT·독립 시작 COMMIT·같은 운영Tx 정산, 정확 U/R·10GiB·2B/C·fence|source·메모리 검수|
|Q2|실제 upload/diff route/class → 고정 bytes/명령 → 예약/start → 실제 ArtifactStore put/게시·staging 검산 → 원 receipt/자료·정산|source·대역 핵심 동작 확인|
|Q3 생성|실제 namespace 독점 생성/닫힌 copy 검산 → genuine proof → PROJECT 생성/adoption과 같은 Tx의 초기 B/원장 인계|source·메모리 FS 알고리즘 확인|
|Q3 checkpoint|고정 preparedHash·최종형태 C 계획 → 예약/start → 원 운영Tx 시각·최종 H/C·chain/CAS → receipt/record/정산·보호 replay|source·인증/자료 SQL 대역 핵심 동작 확인|
|Q4|Main 직접 시험·type·메모리 build·diff/지문·독립 C0/I0, 계획·현황 반영|실환경 인수와 구분|

동일 RESERVED 재확인은 원 part ID/기한·plan을 유지하고 원자료를 다시 대조한다. 이미 시작/불명인 명령을 재I/O하지 않는다. COMMIT 유실·FS 후 rollback·기한/권한 변화는 원명령/보유 R를 보존한다. 기존 보호 읽기·정확 replay·격리·일회 승인 소비는 유지한다. 429의 기존 UI 보수적 불명 분류는 바꾸지 않았다.

빈 프로젝트라도 새 비혼재 namespace 증거 없이는 VERIFIED/0을 발급하지 않는다. 기존 COMMITTED 재생성·raw legacy 초기화를 거절하고, 현재 생성Tx identity와 불변 명령·receipt·원시각·계보를 교차 대조한다. 원 upload 명령과 PROJECT 생성 명령은 구분한다.

checkpoint 계획 hash는 시각 없는 preparedHash이고 최종 snapshot H·receipt ref는 별도로 검산한다. 미래 운영 시각을 예측하지 않으며 최종 C가 예약 C와 같음을 확인한다. 0042·0058 원형과 기존 checkpoint 현재성/불변/양방향 deferred 검사도 보존했다.

## Main 직접 실행 증거
고정 실행기: C:/Program Files/nodejs/node.exe.

```powershell
node --test tests/unit/FN13/project-storage-quota.test.ts tests/unit/FN13/project-storage-quota-schema.test.ts tests/unit/FN13/project-storage-quota-writers.test.ts tests/unit/FN01/draft-artifact-service.test.ts tests/unit/FN13/project-checkpoints.test.ts tests/unit/FN13/checkpoint-storage-schema.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
node --input-type=module -e "import {build} from 'vite'; await build({configFile:'apps/web/vite.config.ts',build:{write:false}}); console.log('QUOTA_Q4_MEMORY_BUILD_OK');"
git diff --check
```
- 최종 Q3 동결본 Main **9ecb97: 89PASS/0fail/0skip**, fe43ad type exit0, c758bf diff exit0.
- Q4 **516a2b: 482 modules 메모리 build / exit0**. 서비스/listener·배포·실제 파일 시험을 만들지 않았다.
- Q2 Main f1756d의53PASS 후 replay 경계를 보정했고 최종 13ba03 writers22PASS/type0를 확인했다. Q1 r2 Main90e001은21PASS/type0다. 각 시점의 증거이며 합산 단일 전수 결과가 아니다.
- 독립 검토: Q1 최초 C0/I2 → 보정 C0/I0. Q2 replay 정산/최종Tx 보완 후 C0/I0. Q3 legacy raw 초기화 I1 보완 후 최종 C0/I0.

## 보정·오류 이력
- 예약 변경 후 현재성 실패의 명확 거절, checkpoint 계획 hash 미결박, START 후 정산 오류412를 각각 반례 후 보정했다.
- 같은 RESERVED 재확인 ID/기한, VERIFIED replay의 SETTLED/원receipt 대응, proposal replay 보호 검산/반환 Tx 분리를 보완했다.
- Q3 raw legacy 초기화와 생성 COMMIT 유실 raw 오류, namespace 시작 후 실패 raw 오류를 반례 후 보완했다.
- Primary의 시험 문법/타입/대역 query 누락은 원인별 보정했고 동일 유효 FAILURE_REPORT3회는 없다. 출력이 잘린 선택시험은 PASS로 세지 않고 실자원/handle0의 메모리 선택만1회 fresh 확인했다.
- Main은 읽기 leaf 오기1·Windows rg glob 구문1·sandbox Git 문맥1·기록 CRLF diff 경고1을 좁혀 교정했다. 권한/ACL/Git 설정 변경0. LF/CRLF 예정 경고는 diff 통과와 구분한다. 상세 사건·명령 ID는 WORK_STATUS에 보존한다.

## 최종 제품 지문
|저장소 루트 기준 경로|SHA256|
|---|---|
|apps/server/storage/artifact-store.ts|7293A272E7785FC33E0513686E27FF5639703BD762D8096AC969B4732C4FD027|
|apps/server/modules/documents/project-files.ts|34DAF0AD9D9D8756B7067B09A464779E6DD79F91A22309AFFF4FBED3C7029268|
|apps/server/modules/documents/project-proposals.ts|C35AD83B36B28082E62389BE102733434E7F20761565E3588C2E7275B2F4D6DF|
|apps/server/modules/documents/project-documents.ts|2A04CE202B339C3BFD2A4434C6F20501C8A8D3EBCAEABFC1401EE3E3F331D86D|
|apps/server/modules/projects/draft-artifacts.ts|6242BA72FAF55A7AA25C2FCE506EE44CA154F72406AF83121542719991FCB2F5|
|apps/server/modules/projects/draft-artifact-files.ts|6B077D50430AFC8265D36D7FD2CE8C708A8317A726DA09C8D05CA55599A279B6|
|apps/server/modules/projects/repository.ts|E6F15689A042A303FA4C4C56F8EC401B32427A323B65095375E5BFBE79AD2B4C|
|apps/server/modules/checkpoints/project-checkpoints.ts|9CBC41276503E1D8BAE18BBAB2548BF2D472A0D6F1053B22739454BBACF8D7B1|
|apps/server/modules/projects/routes.ts|5C841A44848A96BEA3A627BC71803D17666343638C22D92BAF37CC4F0A51A7F2|
|apps/server/modules/projects/project-storage-quota.ts|F6559AF9416DB59070B255D6D960579AC569D477E51BE1CAE835AFE5756F462A|
|db/migrations/0059_project_storage_quota.sql.pending|0E13C17946D47A03E388C16D6CC05CAB17F13033DEC572DEDD9E559A0F4E24E7|
|tests/unit/FN13/project-storage-quota.test.ts|42B4F9219B6FA984AE894D71A22F502C1D215DCDDDB9FBA991AEFE8BE6D93189|
|tests/unit/FN13/project-storage-quota-writers.test.ts|022CA5000E09649D8AB9CACECB7B46BA76BDF577C07D98FABF2F21F90F0DB6D7|
|tests/unit/FN13/project-storage-quota-schema.test.ts|5C452593A0CD57C8A91BC85C2C43CC0033CBECE8CBCFD36890F1A59931CF938E|

## 미실행·보존·다음 범위
- 실제 DB/SQL 적용·권한/GRANT·키·현재 사용자 파일/사용량 조사·OS 파일 IO·서비스·Agent 실행·기존 프로젝트 차단 해제는 제외/NOT_RUN이다. 실제 서비스에서 지금 사용 가능하다고 보고하지 않는다.
- 생성은 실제 AccessRepository/ProjectsRepository/ArtifactStore 알고리즘과 메모리 FS binding을 사용했다. 미모델 경로를 거절하고 finally에서 원 binding을 복원한다. checkpoint는 별도 인증/자료 SQL 대역이며 생성과 같은 실제 DB의 연속 운영 증거가 아니다.
- 실제 PG의 함수 문법/원자성·경합·native xid/subtransaction·OS crash·실 FS 보호·실 HTTP/브라우저/사용자 인수는 미검증이다. 합성 SQL 모델/정적 source 시험을 이에 대한 PASS로 승격하지 않는다.
- PG15 현재Tx/row-version 타입 근거는 [공식 시스템 함수 문서](https://www.postgresql.org/docs/15/functions-info.html)와 [시스템 열 문서](https://www.postgresql.org/docs/15/ddl-system-columns.html)를 읽었다. 공식 문서 확인은 실제 SQL 실행 증거가 아니다.
- DB 물리 overhead/WAL/명령·감사 metadata 등의 집계 제외, 별도 디스크 안전·UNKNOWN 실제 조정은 승인 후보의 미해결 범위 그대로다. 자동 해제/삭제0.
- 원0042 SHA76D16C97…·0058 SHA376D2A31…와 보호3 지문은 Main c758bf/fba5be로 불변 확인. 원 WIP5 복구본은 수정/삭제/stage하지 않았다. 새 QA/서비스/파일자원은 생성하지 않았다.
- 롤백은 미배포 source checkpoint를 기준으로 다음 정상 수정 commit으로 수행한다. 이미 게시된 이력 reset/rebase/force0, 실제 DB 롤백/기존 원문 삭제0. 실제 적용 전에는 별도 정확 실행 범위와 PG 검증을 확인해야 한다.
- 전체 WORK_PLAN의 미완료 항목과 별도 계약/실행 경계를 대조해 다음 승인 범위 구현을 계속한다. 이 source 결과는 전체 프로젝트 완료보고가 아니다.
