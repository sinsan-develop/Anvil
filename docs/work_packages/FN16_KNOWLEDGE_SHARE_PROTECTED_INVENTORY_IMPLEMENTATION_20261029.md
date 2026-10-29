# FN16 지식 공유요청 보호 수집 작업지시서 초안 — 2026-10-29

## 상태·권한

기준 HEAD `7b2498e53280a8f69a3b907b9696406b61b5f151`. PMO 결정안023B6BDF의 B 한정채택을 상세화한다. 정본 계약은 `docs/contracts/FN16_KNOWLEDGE_SHARE_PROTECTED_INVENTORY_SOURCE_CONTRACT_20261029.md`다. 현재 허용은 이 WI와 계약 두 문서 작성뿐이며 **제품 코드·시험 GO 아님**이다. Main 관리/독립 검토 전 구현하지 않는다.

실제 server RO issuer가 없고 기존 #projected가 잠금·원문 IO를 요구하므로 eligible 원형 수집은 `NOT_IMPLEMENTED / NOT_COLLECTED`다. fake provider/과거 eligible/caller true/명목 proof로 대체하지 않는다. 이를 제품 완료로 보고하지 않는다.

## 검토 후 착수 가능한 하위 단위 후보

제안: 본인 고정 requestRef 하나의 기존 최소 unavailable 봉투를 보존하는 별도 내부 함수. 새로운 전체 원형 수집기나 eligible stub를 만들지 않는다. 범위는 원형/target/knowledge를 읽지 않는 진짜 own-row 확인·세션/한도·회수 처리이며 source 접근 상실·타인·미존재404를 구분하지 않는다.

후속 허용 코드 후보는 정확3이며 현재 쓰기 허가가 아니다.

1. `apps/server/modules/backups/knowledge-share-protected-envelope.ts`
2. `tests/unit/FN16/knowledge-share-protected-envelope.test.ts`
3. `tests/unit/FN16/knowledge-share-protected-envelope-schema.test.ts`

FN05 source·0051·기존22조합·artifact helper·다른 collector/설정·키·정책·API·의존성 변경0. Git 쓰기와 실제DB/SQL실행/원문IO/대상조회/서비스/Agent0. 보호8 및 사용자 dirty/untracked 자료를 보존한다. 구현 시 Primary 단독 writer, Main 같은 코드 쓰기0이며 정본 상태/문서 checkpoint는 Main 소유다.

**추가 착수 전 조건:** 기존 FN05 integrity()는 unavailable에서도 원형·증빙의 손상을503으로 닫는다. 6열 최소 SELECT만으로 이 동등성이 성립하지 않으므로 현재3코드 후보도 구현 GO가 아니다. 원형을 응답/요약에 노출하지 않는 동일 무결성 검산을 기존 권위·한도 안에서 수행할 구체 경로가 확인되지 않으면 이 하위 단위도 NOT_IMPLEMENTED로 유지하고 문서만 보존한다. 잠금/권한/검사를 생략하여 후보를 실행 가능한 것으로 바꾸지 않는다.

## source 책임과 불가능 경계

- 함수 후보 `collectOwnKnowledgeShareRequestEnvelope(access,token,value,signal)`는 계약§4 입력과 정확8필드 최소 반환만 소비한다. protectedRef·Snapshot·검사 issuer를 임의 추가하지 않는다.
- RC OWNER/source 접근·동일 세션/actor/client/credentialGeneration·DB clock/최소 expiry를 최초와 최종에 확인한다. RR은 own exact id/version/hash row의6열 metadata만 읽는다. snapshot/detail/member target·원문·59열 선택 증빙은 읽지 않는다.
- 원문미검산·현재대상미확인 때문에 반환은 항상 기존 UNAVAILABLE 의미이며 이를 현재 부적격 사실의 확정판정으로 주장하지 않는다. 이것은 원형 구현의 빈 처리 함수가 아니라 보호된 최소 봉투의 한정 구현이다. 원형 기능은 별도로 미구현 표시한다.
- 실제 table 부재/권한 불가/오류는503. 타인/미존재/source 상실은404. auth 자체 무효401, 취소409/한도·기한413, 회수불명503 우선. raw DB/cause·row/비밀을 오류에 넣지 않는다.
- 모든 크기·시간은 내부 유한 검사만 하며 상세건수/시각·정책·길이·대상존재를 DTO/조합 요약/로그로 노출하지 않는다. 이 하위 단위는 기존 조합에 추가하지 않아 자동 rowCounts 누출을 막는다.
- eligible 공급자는 이번3파일에 존재하지 않는다. 검증 결과를 brand/WeakMap에 저장하는 것만으로 검증 권위가 생기지 않는다. 후속 issuer는 실제 권한/원문·변동/기한 근거가 갖춰진 별도 계약/검토 대상이다.

## 단계별 수행·검수 — 후속 GO 이후에만

1. Main은 이 설계의 '원형 불가/최소봉투 가능 여부도 미확정' 구분과 정확 입력·출력·3경로를 독립 검토하고 GO 여부를 결정한다. 현재 문서 작성은 이 단계 이전이다.
2. GO가 있을 경우 시험 두 개부터 RED를 기록한다. 실제 memory SQL 응답은 명시6열을 반환하며 caller의 공급자/eligible 값을 주입하지 않는다.
3. 최소 source를 구현하고 아래 집중 반례를 GREEN으로 만든다. 기존 완료 collector 전수 재실행0. 관련 타입·diff 검증, 지문·정확 명령/exit·RED/GREEN/미검증·writer 해제를 제출한다.
4. Main fresh/독립 C/I0 뒤에만 이 하위 단위 checkpoint를 고려한다. 별도 원형 구현이나 KNOWLEDGE_SHARE_REQUESTS 완료/23번째 조합으로 자동 승격하지 않는다.

필수 반례:

- 정상 본인 fixed ref는 정확 최소8필드·false4이며 raw snapshot/목적/지식·target ref·건수·기록시각·정책·증빙은 반환/로그에0.
- 타인·다른 project·잘못된 id/version/hash·출발 접근 상실은 동일404; 외부 접근·타인 존재 count query0.
- RR own predicate 및 project·actor·ref 변조/중복/잘못된 UUID/hash/state는 실패. table 부재는503이며 빈봉투 성공0.
- 원형·target·knowledge 입력 테이블을 fake가 사용금지하여 조회0 증명. 공급자 없음 상태에서 positive eligible 생성0.
- 최초/최종 신원·OWNER 상실·최소만료, 외부 COMMIT 후 취소/기한, 누적payload·최종DTO한도, BEGIN/ROLLBACK/release 불명과 동시취소503.
- caller extra key/eligible=true/과거검사결과/proof 입력 거절. 정상 최소봉투를 원형hash검산 또는 target적격성PASS로 승격하지 않음.

중간 상태/ABA에 대한 **eligible 원형** 검증은 현존 issuer 부재로 구현/검증 불가다. 이 필수 조건을 최소 봉투 시험 PASS로 덮지 않고 NOT_RUN으로 남긴다. 기존 조건을 삭제해 B 완료로 만들지 않는다.

## 현재 문서 작업 검증·rollback

문서 두 개의 내용·경로·UTF8·지문만 확인한다. 제품시험·타입·DB는 현재 미실행이다. rollback은 두 초안 문서의 검토된 수정이며 사용자 자료/지식/요청/키 삭제가 아니다. 후속 source rollback도 정확3 신규 파일의 검토된 revert이며 실제 DB/권한 변경은 없다.

미검증: 실제PG/0051/RLS/원문물리IO/대상권한·현행 UI·archive/restore·eligible검증issuer·전체FN16/작업계획. Main에는 계약2문서 지문과 실현불가 근거, 가능한 최소 단위, 필요한 다음 결정을 전달한다. 다른 승인된 독립업무를 막지 않는다.
