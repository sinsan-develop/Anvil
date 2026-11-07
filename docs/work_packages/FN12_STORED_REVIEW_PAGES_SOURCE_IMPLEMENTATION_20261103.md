# FN12 보관 검수 과거 페이지 — source 작업지시
2026-11-03 · SOURCE_ONLY_GO · Main 어울 / 기존 Primary 단일 writer
기준 codex/av3-stage-b HEAD4e0cd142464aafc3589cb98bc9c8a7032896c473.
직접 승인: 비동기 call_38ed4cc7f50742c396f42772d7a66447 답변 'A안 계약·source-only 구현 승인'.
승인 계약: docs/contracts/FN12_STORED_REVIEW_PAGES_CANDIDATE_20261103.md r2 SHA256 59B7F0E6178048AD5E5D1A3F1CF8E5B6C11B44A609B0A911182C91E1F44FF0B4.
후보 문서의 채택 전 원바이트/상태 문구는 그대로 보존한다. 현재 채택 상태는 직접 답변과 이 binding·WORK_STATUS가 기록한다.

## 허용 정확8
| 경로 | 시작 SHA256 |
|---|---|
| apps/server/modules/results/project-result-reviews.ts | B6477ED24125A214FBDCF876380D342B39FE8670F048D7AA76FF3F28C0CE00E2 |
| apps/server/modules/projects/routes.ts | 69C9BD147EB3B520A4DC9B295AFF6CD29BAE870875FFBB9E25F00A0BE95CC9E1 |
| apps/web/src/features/session-detail/stored-result-reviews-api.ts | A72A98CFA0237EEFC93EBDBE2FF5959DA19F2E6A7D724D736D4595E615C80CFF |
| apps/web/src/features/session-detail/ResultReviewSources.tsx | D84BFBE51EB446C93D25216847D500494BBD6894BDBF029E54157218C7041AF4 |
| tests/unit/FN12/project-result-reviews.test.ts | 711D0E83BEE4E2500D80278D39C69616AC8607021A814A6BA16EB90317EE956F |
| tests/unit/FN12/result-routes.test.ts | 5C2D4B6280BE144C59CCB70FCF2201CCCF54945B5BC22116E743445B290AC492 |
| tests/unit/UI05/stored-result-reviews-api.test.ts | 702E82D4712FC8BB871A017840BC89E62E540B23157A1ED9DBDD24D3C720B2C5 |
| tests/unit/UI05/stored-result-reviews-pagination.test.ts | 신규·0d1b6c 부재, 생성 직전 재확인 |

## 실행
1. 처음에 PMO/project 규칙·승인r2/이WI·기준Git/정확7지문·신규1부재·제품clean/Main현황과보호3소유를 대조한다. 코드 writer는 기존 Primary 한명, Main은 같은8코드쓰기0. 다른 변경을 되돌리지 않는다.
2. 승인r2의 정확 신규 /results/:id/review-pages·query {}|{cursor}·정확9키/고정20/21후보·64KiB·4096/원30분/cursor결박·page소유30초/원인증정착분리·가시행/비snapshot·이전위치100·falseflags·현재회원권한을 그대로 구현한다. 기존두GET no-query/DTO/원문 hash검산·기준/검수/보완저장·ACCEPTED차단은 보존한다.
3. 새 키/AccessRepository 수정 없이 기존 서버 전용 signProjectCursor를 목적/결박 digest로 명시 주입한다. raw session ID/토큰/키를 가독 cursor나 새 DTO로 노출하지 않는다. 기존 signing 목적 문자열/구 API codec은 바꾸지 않는다. 비교는 정규/canonical·위조/길이·주체·session/credential/project/result/원기한을 검산한다. 서명 성공이 접근허가가 아니다.
4. 페이지가 기존 exact reader와 실제 query를 소비하도록 한다. query의 실제 DB 정착과 인증 Tx 소유는 원 repository가 유지한다. page 첫진입부터의 절대 예산·cancel 뒤 새 page query0/late정착 후검산을 구현하며 인증 pool/BEGIN을30초내 중단했다고 주장하지 않는다. read 오류를 빈 성공이나 저장 UNKNOWN으로 합치지 않는다.
5. 기존 UI05 목록은 명시 이전/다음/새조회·실패target재조회만 연결한다. 성공위치/실패target분리·상세숨김·원문별도선택·새주체/transport/project/result/조회창·ABA/늦은JSON·오류/finally fence를 유지한다. 기존명령/초안/UNKNOWN 삭제0·자동POST/원문선택/완료판정0.
6. 실제 정상/핵심 음성의 최초 소비선RED→GREEN을 보존한다. 기존GET 무변경·21+/동률/keyset·append/지연행한계·빈page·회수/위조/만료·타주체/client/session/credential/project/result·64KiB/4096/100이전위치·정착/cancel/ABA를 의미 있는 단위/메모리handler/React행동으로 검증한다. 기존 기준을 느슨하게 하지 않는다. 집중 및 직접인접/type/diff를 선택하고 변경없는 전체검사 반복0.
7. 공개계약을 조용히 넓히거나 실제 환경이 필요한 경우 실행하지 말고 정확 차이/대안을 Main에 반환한다. source8 밖코드가 필요하면 먼저 근거를 반환한다. 기존reviewer역할/새agent/branch/자동화/QA/서비스 생성0.

## 제외와 반환
신규SQL/DDL/migration·실제DB접속/SQL실행·권한/정책/회원·키/Secret·파일조사·서비스·Agent·OS/제품네트워크0. 합성/메모리 검증만이며 실제PG/RLS/served·사용자인수PASS로승격하지 않는다.
정확파일/hash·실행명령/exit·RED/GREEN/준비오류·미검증/한계·live0와writer반환을 한국어로 제출한다. Main이독립검수·문서·기존branch checkpoint/private를맡는다. 전체FN12/Stage/작업계획완료가아니다.

## Main 내부 상세 r2 — 첫 위치와 원 조회창 보존
기존 승인 r2는 이전 이동/재시도에서 원 window/기한을 연장하지 않도록 한다. 최초 query{}의 위치를null로만보관하고이전시다시{}로요청하면새window가발급되므로이방법은채택하지않는다. 공개9키/window2/단일cursor쿼리/상한4096/이전100위치·실환경제외는불변이다.
- opaque cursor의 내부 직렬화만서명된root와선택position의고정프레임으로구체화한다. root는원주체/session/credential/project/result/20결박digest·startedAt/expiresAt·첫위치(null last)를고정한다. position은정확rootToken과last tuple에별도목적으로서명한다.
- 예: rootEncoded.rootSig는첫위치, rootEncoded.rootSig.positionEncoded.positionSig는다음위치다. 서버는정확2/4분절·canonical/길이·양쪽서명과상호결박·tuple·현재접근/원기한을검산한다. 다른root의position이식·비정상중간절단(1/3분절·빈분절)·추가분절/위조는거절한다. 정상4분절의앞2분절root추출은의도된첫위치이므로거절대상이아니다.
- SDK는초기nextCursor의opaque rootToken만첫위치로보관한다. root payload를권한/사실로신뢰하거나새서명을계산하지않는다. 서버가원root를재검산하므로첫페이지이전도기존window와expiresAt을사용한다. 클라이언트가first-page응답원문전체를별도cache하는우회는추가하지않는다.
- 동일조건의더단순한내부직렬화는Main에게근거를반환할수있다. 응답/쿼리공개필드·인증/권한·키의생성/실행·허용8은변경하지않는다. 첫이전이원창/기한을유지하고새조회만새창을만드는실제소비선RED/GREEN을검수한다.
Ruling: 기채택opaque cursor의원기한/이전위치요건을내부서명프레임으로충족한다. MAIN_RECONFIRMED_NON_SEMANTIC 부모WI SHA30D4089DC433234EF2A6800DDB15D38940D7F07D6A5615B56D825ED7B447D7CE 및직접승인계약59B7F0E6 binding을보존하며기능/공개계약/위험범위를확대하지않는다.
