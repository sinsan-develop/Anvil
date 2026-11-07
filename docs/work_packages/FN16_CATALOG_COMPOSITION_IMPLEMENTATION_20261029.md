# FN16 내부 catalog 조합 구현

2026-10-29 / Main 어울 / source·메모리 합성 / 기준 b1a8aea66977458fef43563a14f7f1ebbbf611e0

## 권한과 목적
직접승인3FAD0CE9·원계약5A6819 §3 및 기존 안전handle WI의 미구현 catalog 소비선을 연결한다. 사용자 기능·공개 API·DB·권한 계약은 늘리지 않는다. 기본 catalog와 App/routes는 바꾸지 않는다. 실제 설치 catalog/바이너리 loader/키/Secret/DB/서비스·P03 실행0이다. 기존 운영 제외를 source 내부 조합의 작성 금지로 확대하지 않는다.

## 정확 허용 경로
- 신규 apps/server/modules/backups/installation-resource-catalog-provider.ts
- 신규 tests/unit/FN16/installation-resource-catalog-provider.test.ts

기존 fn16_primary 단일 writer. 처음 시험파일만 작성하고 Main RED 확인 후 제품 구현. Main은 코드 동시 수정0. 원 승인·기존 검사·native/adapter/source는 보존한다.

## 조합과 검증
- 신뢰된 서버 내부에서만 snapshot과 native factory 함수, 현재 설치 보호를 검사할 필수 dependency를 명시 주입한다. 하나의 catalog는 native port/관리 adapter를 각1개 소유한다. 파일 검색·require/dlopen·환경변수 fallback·설정 생성·권한 수정0. 기존 Repository→Routes→Store 주입은 그대로 소비한다.
- snapshot은 installationId와 slots1..64. slot은 기존 binding(slotId/installationId/purpose/profileRef/expectedRootIdentity/ownerUid), absoluteRoot, displayName, capacityBytes, profileVersion으로 고정한다. 엄격한 닫힌 구조·UUID·정규 identity·유한수·목적·profileVersion=profileRef.version을 대조하고 복사/불변화한다. profileRef를 생성/재해시/보정하지 않는다.
- 모든 항목 검증을 factory 호출보다 먼저 끝낸다. 동일 slot, device/inode, 동일·중첩 경로(성분 기준), 상대/비정규 경로·상위이탈·NUL은 거절한다. 원문/실행경로 분리는 실제 설치 검증 dependency의 책임이며 provider의 문자열 비교만으로 증명하지 않는다. capacityBytes>=1024 안전정수이고 KEY_VAULT는 최소16384, 실제 availableBytes/inodes도 해당 최소치와 대조한다. capacityBytes는 현재 고정 설치 한도 정보이며 누적 quota라고 주장하지 않는다.
- 현재 설치 검증은 기본 구현 없는 필수 내부 port `assertCurrent(snapshot):Promise<void>`로 둔다. 실제 loader가 아직 없으므로 운영 verifier도 제공/등록하지 않는다. bool·hash 하나·호출자가 넣는 VERIFIED 상태로 대체하는 경로0. verifier에 정확히 복사·고정한 snapshot을 전달하고, 검사 실패/부재는 사용불가다. 합성 verifier는 시험에서만 제공하며 이 호출의 성공을 실제 설치 검증이라고 보고하지 않는다.
- list/prepareSlot 시작과 비동기 검사 이후 반환 직전에 현재 verifier를 다시 확인하고 종료 상태를 재검사한다. managed adapter.prepareSlot과 root.inspect를 통해 현재 identity/owner/mode/공간을 대조한다. list는 파일 생성/쓰기/probe/키연산0. 기존보호DTO `{slotId,displayName,purpose,profileRef,state,reasonCodes}`만 반환한다. VERIFIED는 해당 주입 verifier+root관측의 합성 검증 상태이며 등록probe·키생성완료를 뜻하지 않는다. 실제 provider 미주입 기본UNCONFIGURED는변경0.
- 한 슬롯 실패가 목록의 다른 슬롯을 VERIFIED로 오염시키지 않도록 해당 슬롯 UNVERIFIED/RESOURCE_UNVERIFIED를 표시하고 정상 항목과 구분한다. 전체 설치근거 실패는 list UNVERIFIED로 반환하며 모든 항목 사용차단. 잘못된 kind는 INPUT_INVALID400; prepareSlot의 없는ID/잘못된purpose/근거실패는RESOURCE_UNVERIFIED412, 종료회수불명은RESOURCE_STATE_UNKNOWN503. 원오류/path/bytes/stack/cause를 외부로 전달하지 않는다.
- 동시 list/prepare는 같은 adapter를 공유하고 native work32 상한을 넘어 한꺼번에 슬롯을 열지 않는다. 목록내 순차관측과 같은slot 준비재사용을 유지한다. 늦은 응답은 verifier회수/종료 뒤 사용가능 결과로 반환하지 않는다.
- dispose는 즉시 신규 사용을 막고 받아둔 유한 작업을 drain한 뒤 adapter.dispose를1회 await한다. 같은 Promise/실패를 보존하고 파일삭제·재시도·자동재활성화0. factory/preflight실패때미반환root를놓치지않는다.

## 집중 검증과 완료
정상보호목록/준비·목적분리·path/handle비노출, 잘못된kind/profile/installation/identity/중복/중첩/과대입력의factory0,입력변조,공간부족,근거부재/회수/변경,동시준비,dispose/늦은응답·단발회수/UNKNOWN·원오류비노출을 메모리 native 포트와공개fixture로확인한다. 기존 default catalog2건과 직접 영향이 있는 항목만 추가 확인하며 실제native15검사재실행0이다. node --test 신규파일, npm run typecheck, git diff --check 및 독립검토. 구현·합성증거와 실제catalog/loader미제공을 명확히 구분한다. rollback은신규주입구성의source revert이며실제자료/권한/키/DB/서비스변경없음.
## 내부 결정 — 현재성 회수 관측 후 수명
Main/담당자 소비선 대조 결과, 현재성 검사 실패를 관측한 뒤에도 이미 준비한 root를 계속 쓰는 gap은 같은 catalog에서 자동 복구하지 않는다. 해당 catalog를 영구 UNVERIFIED로 두고 관리 adapter.dispose를 단발 시작해 기존 handle의 신규 IO를 즉시 막는다. 진행 중 작업은기존drain원칙으로회수하고회수불명은보존한다. 자기요청을기다리는순환await/오류삼키기·자동재활성화0. 명시catalog.dispose는같은회수결과를재사용한다. 신규반례1개로보유handle의후속IO거절/정리단발을확인한다. 모든root/file메서드에별도wrapper나polling은추가하지않는다. 아직관측하지않은외부변화를즉시탐지했다고주장하지않으며실제설치활성화때loader/verifier의현재성근거를검수한다. 기존Store의사용전prepare/inspect·권한검사와config hotreload미지원전제는유지한다.