# FN16 정상 반복 조회의 닫힌 handle 보관 보완

2026-10-29 / Main 어울 / 기존 직접 승인3FAD0CE9·원계약5A6819E6 유지

## 사유와 범위
native WI C6E59B3E 구현 중 독립 검수에서 소비선 I1을 확인했다. 관리 adapter #files가 확정 close 후에도 native cap을 보관하고 native file_records는 GC 때만 줄어 정상 open→close 반복이256기록을소진한다. Store의읽기/자원조회도이경로를소비한다. 실제catalog는미활성이므로운영발생주장은아니며,연결할제품의명백한기능오류다. 기능·공개API·원문·DB·권한/키·서비스 범위확대없이기존handle수명과내부자원방어를정합화한다.

## 정확6경로 / 단일 담당
기존 fn16_primary만 쓴다. Main 동시 code write0.
1. native/fn16-posix-safe-handle/addon.c
2. native/fn16-posix-safe-handle/binding.gyp
3. native/fn16-posix-safe-handle/BUILD_CONTRACT.md
4. tests/integration/FN16/installation-resource-posix-native.test.ts
5. apps/server/modules/backups/installation-resource-posix.ts
6. tests/unit/FN16/installation-resource-posix.test.ts

기존 native 소스1A442912/BUILD32233406·gyp23717159·시험2FF5AC5B와관리adapter11F95CD0의diff를보존하고필요부분만변경한다. 기존검사삭제/기준완화0. source-only작성및합성단위검증이며실제native실행은Main고정실행안으로만한다.

## 유지할 계약
- 확정 close 후관리Map과불필요한nativecap강한참조를해제하되닫힌publichandle재사용거절·동일closePromise·UNKNOWN/poison과단발회수는유지한다. 회수실패를성공으로정리하지않는다.
- 진행/열린FD예약상한256과닫힌wrapper의메모리수명을구분한다. 정상순차조회총횟수를설치자원수한도로바꾸지않고제품에서강제GC를호출하지않는다.
- native C할당은JS소유수명에대응하는정확external-memory계산및finalizer/prune회수로관리한다. FD예약은확정회수때한번반납하고불명은반납하지않는다. 닫힌wrapper가정상JS참조로남는것을열린FD로계산하지않으며그C메모리를숨기지도않는다.
- root/file타소유·generation·진행workdrain·close1회·결과UNKNOWN·파일보존은변하지않는다. 배열·경로·bytes·진행작업·열린FD의유한상한은유지한다. 실제catalog/loader활성화·키/DB/SQL·서비스변경0.

## 검증
기존close/재사용거절/foreigncap/UNKNOWN단위검사를보존하고직접변경된소비선만검증한다. 실제native통합시험에는동일root에서정상생성/읽기/닫기를256회를넘겨반복해같은파일바이트보존·마지막조회가능·종료FD잔여0을확인하는반례를추가한다. 공개합성bytes만사용하며새QAroot를자동생성/실행하지않는다. 기존fixture상한이필요하면실제case수에맞게좁게대조하되보호기준은완화하지않는다.

Main은소스·타입·직접단위및독립C0/I0를확인후exactSHA게시·실행안결박으로WSL검증한다. 기존완료검증의불필요한반복0. 전체FN16/계획완료또는실제키/DB/servicePASS가아니다.