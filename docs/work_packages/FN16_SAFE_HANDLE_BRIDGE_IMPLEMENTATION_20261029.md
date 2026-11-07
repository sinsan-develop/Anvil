# FN16 안전 handle 연결 구현 지시서

2026-10-29 / Main 어울 / 내부 source-only 구현 / 기준93fcbe6a

## 목적과 권한

기존 직접승인3FAD0CE9·원계약5A6819E6의 미구현 설치 파일 공급자를 순차 구현한다. 상세안0988E7A2 §10의 수명·게시·불명보존 결정을 적용한다. 새 사용자 기능/공개 API/SQL/수치/권한은 추가하지 않는다. 실제 catalog·키·DB·서비스, native compile/load와 실제 파일 probe는 이번 실행에 포함하지 않는다. 코드/메모리 합성 검수만 수행하고 합성 adapter를 운영 설정으로 노출하지 않는다.

이미 완료한 probe 열린 handle 보완과 UI/암호/intent 회귀를 다시 개발하지 않는다. 현재 기본 catalog는 실제 안전 공급자가 없으면 계속 UNCONFIGURED/UNVERIFIED다.

## 업무 단위 1 — 관리되는 파일 handle과 catalog 소비 연결

정확 허용5경로:
- 신규 apps/server/modules/backups/installation-resource-posix.ts
- 신규 tests/unit/FN16/installation-resource-posix.test.ts
- 기존 apps/server/modules/backups/installation-resource-catalog.ts
- 기존 apps/server/modules/backups/installation-resource-store.ts
- 기존 tests/unit/FN16/installation-resource-store.test.ts

Primary 단일 writer. Main은 이 코드에 동시 write하지 않는다. 처음에는 신규 시험파일만 작성하고 Main RED 확인 후 제품 GO. 기존 시험 prefix와 원 계약을 보존한다. 다른 코드가 필요하면 소비선과 최소 delta를 Main에 먼저 제시하며 동시 확장하지 않는다. Git/상태/계약은 Main 소유다.

### 내부 책임

- 새로운 서버 내부 TypeScript adapter는 나중의 native opaque root/file capability 포트를 기존 InstallationRootHandle/VaultRootHandle에 연결한다. raw FD·임의 사용자 경로를 받는 공개 API는 없다. 현재 실제 native 구현/로더는 없으며 주입한 메모리 포트만 이번 검증에 사용한다. 이 포트를 실제 OS 구현으로 표시하지 않는다.
- root/부모·file identity/owner/mode·available bytes/inodes·slot purpose·profile의 검증값을 native가 제공하고 adapter도 닫힌 구조/유한 범위/현재성·정확 귀속을 검사한다. 모르는 값·닫힌 handle·타 root handle·세대 불일치는 거절한다. path 기반 fallback이나 VERIFIED true 한 개로 대신하지 않는다.
- 각 연산 시작에 소유/세대를 고정하고 진행 연산이 끝나기 전 capability를 close하지 않는다. dispose가 시작되면 신규 작업을 거절하고 단발 Promise로 진행 연산을 drain한 뒤 열려 있는 자기 file과 root만 close한다. close 결과 불명은 재close하지 않고 오류를 유지한다. 자동 unlink/reconcile0.
- create는 서버 UUID 단일 성분·exclusive/noFollow·0600·최대16KiB, read는 최대16KiB+1의 bounded 관측을 유지한다. 생성 bytes는 주입 호출 전에 복사하고 자체 buffer는 성공/실패 뒤 소거한다. 반환 bytes와 입력 객체 변경으로 다른 요청 상태가 바뀌지 않게 한다.
- remove는 열린 생성소유 file과 expected identity만 허용한다. open으로 조회한 기존 파일은 remove 대상이 아니다. 이미 publish한 final도 삭제하지 않는다. native의 단일 자기 정리 성공만 resolve한다. 불명 후 재정리0.
- publish는 같은 열린 inode의 배타 final 생성과 자기tmp alias 제거가 확인돼야 resolve한다. 이후 store의 fsyncParent/close까지 성공해야 결과를 저장한다. raw native 오류·path/bytes는 외부 오류로 전달하지 않는다. 효과 가능/불명은 RESOURCE_STATE_UNKNOWN503이며 파일 보존·재시도0이다.
- catalog lifecycle과 기존 store dispose 연결이 필요한 최소 내부 변경만 수행한다. 종료·config교체 중 신규 사용 차단과 in-flight 작업의 FD 수명이 어긋나지 않게 한다. 현재 async onClose가 반환 Promise를 기다리는 사실을 활용하고 불필요한 route 변경은 하지 않는다.

### 시험과 검수

정상 생성→읽기→자기정리와 불변 게시→고정조회, 입력변경 격리, 임의 path/과대bytes/특수파일/타root/닫힌capability 거절, 생성/게시/삭제/sync/close 불명과 비밀누출0, dispose 중 진행operation 종료 전 close0·신규거절·멱등회수를 직접 관측한다. 권한/소유 근거 없이 준비한 catalog가 사용 가능해지는 경로가 없어야 한다. 필요한 기존 store 영향시험만 실행한다.

명령: node --test tests/unit/FN16/installation-resource-posix.test.ts; 기존 store 직접영향은 이름 필터; npm run typecheck; git diff --check. 테스트를 source 문자열 검사로 대신하지 않는다. 실제 syscall/경쟁 안전성·native ABI/loader/OS fsync 내구성은 NOT_RUN으로 분리한다.

## 다음 업무 단위 — native 소스와 실제 검증

업무1 API와 독립 검수 후 같은 primary에게 Linux C Node-API source와 고정 build/loader 신원 계약의 정확 파일을 별도 WI로 전달한다. native이므로 자동 재승인을 요구하지 않으며 기존 코드 승인과 새 실제 실행을 구분한다. 실제 build/load/격리 FS 시험은 정확 대상·도구·공개 fixture·수명·정리·중단조건을 먼저 고정하고 기존 승인/PMO 위임 범위에 대조한다. 실제 키/DB/서비스는 제외한다. 실제 검증 전 adapter를 기본 제품 구성에 활성화하지 않는다.

## 결과와 복구

완료보고는 변경/시험의 정확 hash·명령·결과·미검증/차단 소비선을 적는다. 기존 자료/Secret/키/DB/서비스 변화0. rollback은 검토된 source revert이며 파일/키 삭제가 아니다. 이 업무 완료는 FN16 전체 또는 native 실제 사용 완료가 아니다.