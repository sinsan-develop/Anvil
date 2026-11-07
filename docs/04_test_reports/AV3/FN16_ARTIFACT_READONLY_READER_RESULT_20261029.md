# FN16 원문 readonly reader 소스 검수 결과

2026-10-29 · Main 어울 · codex/av3-stage-b · 부모 ff0aca9c1b47fcdc9e37e5372bfb3a59d8ea70ba

## 판정
실제 Node 읽기 연산 본문을 가진 내부 reader 구현·합성 핵심 동작 확인. 실제 Linux/원문 보관소 적용·현재 권한/DB 귀속 연결·전체 FN16/사용자 백업은 미완료다.

WI docs/work_packages/FN16_ARTIFACT_READONLY_READER_20261029.md
SHA256 91A387E2AA9E280B686598C8C268D8E5C2A24EBFAC0C31F893354F0D50611078

## 변경
신규 제품 apps/server/modules/backups/artifact-readonly-reader.ts
SHA256 1483BB84DB6F6BD634008FDCFAB619565E89FE620DA6AFB5F45B4F1638536000

신규 시험 tests/unit/FN16/artifact-readonly-reader.test.ts
SHA256 BB7E1C69D53BECA8EDEFBBB159C496067663E8BAF122ECC53746620E40C03E78

변경 전 byte verifier에 기본 실제 파일 adapter가 없었다. 변경 후 서버가 주입한 root/identity/owner의 고정 기준 아래 Linux/ext4/procfs·FD chain·원문 소유/모드·현재 이름/파일/mount·유한 read·단발 close/dispose drain을 코드로 제공한다. 기존 설치 reader는 관측 type만 재사용하고 제품·수치·root 소유계약·ArtifactStore를 수정하지 않았다. 경로/설정 자동 발견·등록, 실제 runtime 호출선, 쓰기/삭제 연산은 없다.

## 증거와 원 실패
| 수행 | 명령/범위 | 결과 |
|---|---|---|
| Main05ee06 | node --test tests/unit/FN16/artifact-readonly-reader.test.ts | factory 미구현0PASS16FAIL/skip0/210.8415ms,exit1 |
| Primary ee2406 | 같은 신규 시험 | 2PASS14FAIL/160.9187ms; runtime 관측 함수 호출 누락으로 정상경로 UNSUPPORTED |
| Primary c438fb | 타입검사 | fixture Uint8Array generic 추론 TS2345 1건. 뒤 diff exit0과 분리해 실패 보존 |
| Primary8e42f0 | 같은 신규 시험 | observe() 최소 보완 후16PASS913.8954ms/skip0,exit0 |
| Primary0488a6 | 타입검사·diff | 시험 인자 Uint8Array 명시1곳 보완 후exit0; 기대값 불변 |
| Main9545c4 | 같은 신규 시험·제품 전체 읽기 | 최종지문16PASS1070.2835ms/skip0,exit0 |
| Maineab546 | npm run typecheck; git diff --check | 각각exit0 |
| 독립검수 | WI·fixture·최종제품 정적 읽기 | scoped C0/I0/M0,실행0 |

기존 기대값/기준 완화0, 불변 전체 검사 반복0. 원문 byte verifier와의 합성 연결, factory IO0/snapshot, runtime/rootpin/owner/mode, symlink/FIFO/hardlink, proc/mount/파일 교체·성장·축소, 제한된 위치읽기·독립 buffer, 부분open·취소·동시open/read BUSY·late drain·close/dispose 단발·원오류 비노출을 확인했다.

## 한계·보존·다음 작업
모든 시험은 공개 fake IO/runtime을 주입했다. 실제 OS 파일/proc·권한·키·DB·서비스/P03·Agent 실행0이다. 합성 close 실패 fixture는 closed=true 뒤 throw하므로 단발 회수 시도는 관측하지만 실제 불명 FD가 닫혔다는 증거가 아니다. 실제 Linux/ACL/경합·FS 내구성·동일UID 악성writer/특권OS 방어는 NOT_RUN 또는 보장 밖이다. 임의 IO promise의 강제 종료 보장은 없다.

sourceStabilityVerified/authorityVerified/restorable=false와 inventory NOT_PERFORMED는 보존한다. 실제 로그인/OWNER/세대·artifact 귀속/격리의 전후 재검사, 실제 root 주입·활성화, 전체 backup/job/암호화·복원·사용자 화면 여정은 아직 미완료다. 다음은 현재 권한·원문 상태를 reader 앞뒤에 연결하는 내부 orchestration의 상세 대조다.

QA 디렉터리·container·listener·실제 원문 생성0, 외부 QA 정리 대상0이다. 기존 보호 미추적8은 변경/stage하지 않는다. rollback은 신규 두 파일의 검토된 revert이며 원자료·키·DB·서비스를 삭제하지 않는다.
