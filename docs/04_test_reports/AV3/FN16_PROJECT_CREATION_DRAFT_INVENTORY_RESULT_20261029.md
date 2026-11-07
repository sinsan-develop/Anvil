# FN16 본인 소비 프로젝트 초안·귀속 metadata 수집 결과 — 2026-10-29

## 판정과 기준
신규 내부 수집기3파일을 Main17합성PASS/type·diff0·독립최종C0/I0로 검수했다. 실제 원문 반출·프로젝트 생성·복원·전체 FN16 완료는 아니다. 기준 codex/av3-stage-b, 시작 HEAD ce9c79661f41cdc374eab110a3ba987bb2963a26. 최종 WI는 docs/work_packages/FN16_PROJECT_CREATION_DRAFT_INVENTORY_IMPLEMENTATION_20261029.md, SHA25615A43533BE2B8643DED0CCD60180177501855DA6EEC1D94EF8517E89FCCA723E다.

Main 관리·검수·통합/기존 Primary 단독 구현/Reviewer 읽기. 본인 소유이며 요청 프로젝트에 소비된 자료만 기존 FN16 범위로 대조했다. app SELECT와 RO guard가 가능한 소스 근거를 확인했지만 실제 DB 권한·0042 적용은 확인하지 않았다.

## 구현과 보호
owner_user_id=검증actor AND consumed_project_id=요청project로 SQL 선필터한다. 타인/미소비/타project·미선택 UNKNOWN 목록·개인quota를 수집하지 않는다. 같은 사용자의 다른 유효 client 읽기는 기존 readonly 계약대로 허용하며 과거 writer 권한을 복원하지 않는다.

11표141열의 현재 초안·선택 snapshot·원 upload/create·귀속 provenance와 DRAFT/PROJECT 별도 증빙을 검산한다. 원draft에 content_hash가 없으므로 관측 input/row의 derived hash를 원 VersionRef로 만들지 않는다. 원문·자유 입력·pathHint·storage key·사람/client·계정/Secret은 출력·로그·오류에 넣지 않는다.

현재 input의 전체 ref에 기존 공개 guard를 처음/마지막 RC에서 적용한다. 이 guard는 본인의 READY 미귀속 ref도 허용한다. 그다음 별도 소비 provenance에서 currentinput=selection=creation=adoption와 요청project 귀속을 검산하며 불일치는503으로 닫는다. FINALIZED 필터의 반환/증빙 수집과 guard lookup을 혼동하지 않는다. 중간 소유행 소실·격리·권한회수·UNKNOWN이면 ref/hash/부분건수를 반환하지 않는다.

선택 ordinal과 snapshot hash의 사용자 순서는 보존한다. 실제0042의 creation.sources_json만 artifact_id 정렬이므로 대조용 목록만 정렬한다. 반환 selected 고유 ArtifactRef의 선언bytes/수는 inputBytes/fileCount 한도에 적용하며 실제 byte 검증으로 보지 않는다. 기존23조합·보호참조·API/parser/SQL/RLS/권한·실제키DB서비스/파일/Agent는 변경하지 않았다.

## 오류와 검증
- Primary77c4fe: source 부재 RED0PASS/12FAIL.
- 구현 중 receipt.authorized_at fixture누락1건, 최종RC 주입시점 fixture1건을 보완했다. 제품은 최종 소유행 소실404와 임의 inspection.state 비노출(enum고정, RED900e43)을 보완했다.
- Main25c758의16PASS는 보완 전 증거다. 독립 제품I1에서 UI 선택순서와 creation artifact 정렬순서를 혼동한 정상거절을 확인했다.
- 9d8f90에서 역순선택2개·정렬sources/manifest·정합 원명령/귀속의 정상 RED1FAIL을 보존했다. 비교용 sources 복사만 정렬해8ebc5e17PASS/type·diff0로 보완했다. 원 input/ordinal/선택H는 변경하지 않았다.
- 최종 Main2f3b2e: 아래 명령으로17PASS/0FAIL/0SKIP,793.4316ms/exit0. npm run typecheck,git diff --check exit0·최종3지문 일치. 독립최종C0/I0는 순서 반례의 정합성·원본 불변과 나머지 보호 경계를 읽기 검수한 것으로 실제 실행과 구분한다.

정확 명령: node --test tests/unit/FN16/project-creation-draft-inventory.test.ts tests/unit/FN16/project-creation-draft-inventory-schema.test.ts

본인 선필터·다른client readonly·빈선택/다중첨부·전체guard와선택provenance·2scope/hash·현재성·비노출·선언byte/file 한도·최소기한/취소+회수불명503을 검증했다. 정상201행은 target_project_id UNIQUE·선택≤20의 도메인에서 불가능하므로 발명하지 않았다. LIMIT200/keyset과 비정상201응답 거절, 정상20/초과21을 확인했다. 기준 완화가 아니다.

## 지문
- source:A695586AE98A48A0693D316F61B31D6395BAE509BAE551720F4FCD0D57FC800D
- 행동:8BE8B64290C8B3D3DC8448DDFC26BA2B0CC85B3B6DA8D4AAC42D9931BE8D92BA
- schema:8EAB0F00326A11EC8E81DDF99EDA684A3E67A94B322DDB5DBF0A47B8DADB7D61

## 미검증과 복구
실제 PG/권한/0042·경합/ABA·원 byte/검사·쓰기 proof·브라우저·Agent·반출/복원은 NOT_RUN이다. 전체초안/개인보존/SourceDeclaration 이력은 미수집, 원draft checksum은 NOT_STORED다. fullProjectCoverage/restorable/authorizationRestoration/executionAuthorized/dispatchPerformed/atomicSnapshotVerified는 false다. 기존23에 연결하지 않고 전체 미수집 항목을 유지한다. 공유B 권위 미충족·민감검사 미정·정책158E10BC 미채택도 그대로다.

Main만 신규3+WI/본결과/WORK_STATUS/WORK_PLAN 정확7경로를 checkpoint한다. rollback은 신규3의 검토된 revert/미연결 유지이며 자료·권한·키는 삭제하지 않는다. 보호8 보존, 전체 WORK_PLAN은 미완료다.
