# UI06 문서 충돌 조정의 출처 소비 정합화

상태: 후속 준비/미배정. 현재 UI_DOCUMENT_SOURCE_REF_CONSUMER_ALIGNMENT 업무의 검수·병합·정리를 마친 뒤 기존 Primary 단일 writer에게 순차 배정한다. 지금 새 branch/구현 GO0이다.

## 근거와 기대 동작
WORK_PLAN의 UI06/FN03, FUNCTION_WORK39·SCREEN_WORK85 및 INTERFACES의 DocumentContent.sourceRefs·문서409 충돌 비교/명시 조정 계약을 소비한다. PR68/69로 정상4종 출처 문서가 저장되지만 conflict-api.ts22/27의 빈배열 조건으로 KEEP_INPUT과 LATEST_METADATA가 모두 막힌다. Main은 DocumentEditor.compare가 현재 mounted만 확인하고 adopt가 원명령 ID만 대조하는 실제 경로도 확인했다. 새 출처가 있는 정상 문서를 비교하면서 이전 주체/선택의 늦은 원문을 표시하지 않도록 기존 epoch/현재성 검산을 이 호출선에 적용한다. 새 공개 API·SourceRef종류·SQL·권한·사용자 정책0이다.

## 정확 소유
제품2:
- apps/web/src/features/design-trace/conflict-api.ts
- apps/web/src/features/design-trace/DocumentEditor.tsx
시험2:
- tests/unit/UI06/conflict-api.test.ts
- 신규 tests/unit/UI06/document-conflict-source-refs-ui.test.ts
다른 코드·기존 도메인 변경은 쓰기 전 Main에 반환한다. Main은 문서/검수/통합만, 같은 경로의 writer는 한 명이다. 다른 담당자 변경을 되돌리지 않는다.

## 구현
1. readDocument의 기존 strict4종·분리열/원본문/버전 검사를 소비한다. 이 reader는 expectedContentHash가 있을 때만 전체 content hash를 재산출하므로 비교 helper는 최신 metadata.contentHash와 documentDraftHash(전체 실제content)를 추가 대조하고 async hash 뒤에도 active를 검사한다. 원문/metadata hash 불일치에서 비교·채택0이다. 최신refs의 빈배열 조건으로 정상 문서를 거절하지 않는다. hash-valid 잘못된종류/추가키·오염을 허용하기 위해 판독기를 느슨하게 하지 않는다.
2. KEEP_INPUT은 기존 입력 refs·본문·제목·항목을 보존하고, LATEST_METADATA는 기존알고리즘대로 최신refs·양식·첨부·형식을 보존하며 내본문/제목/이유와 원 거절packet을 보관한다. LATEST_METADATA의sections초기화는 기존규칙을 유지한다. 두 출처를 자동합치거나 최신refs를 []로 치환하지 않는다. 양측 출처의 비교를 기존 충돌 비교 영역에서 명확히 보여 주며 기존 별도확인 후에만 미저장 초안을 준비한다.
3. compareDocumentConflict는 내부 optional active 함수를 기본true로 받아 기존 호출과 호환하고 모든 await 뒤/후속페이지·고정문서·본문 조회 전에 이를 검사한다. readDocument의 active에도 같은함수를 전달한다. 변경된 transport/사용자/client/CSRF·epoch/외부buffer A/B/A·원pending 명령과세대에 결박한다. stale 성공/401은 새 비교/본문/auth를 바꾸지 않으며 후속요청0이다. 원편집기가 실제 호출해 검사하도록하고 함수시험만으로 UI경로를 대체하지 않는다.
4. compare/adopt 상태를 실제 요청epoch/원pending에 고정하고 명시채택의 부모CAS를현재buffer에대조한다. 기존 save/proposal/import의보호와완료ref·UNKNOWN 보존을회귀시키지않는다. 기존 UNKNOWN을 뒤409만으로 해소하거나 새저장명령으로 우회하지 않는다. 새명령은 명시채택된초안의 다음수동저장 때만 만든다.

## TDD·완료조건
정확한 고정본문·content/분리refs·canonical hash를 갖춘 최신v3에4종refs를 넣고 v2의원409에서 두조정경로의현재거절RED부터재현한다. 새화면시험은실제DocumentEditor/기존Page buffer·메모리DOM/transport를사용한다.
- 정상4종/[] 두방식과원refs/최신refs가다른경우 각각출처·원거절packet보존.
- 실제409→보호최신비교→별도확인→미저장조정→명시저장 고정GET에서정확refs/hash. 실제서버/PG저장증거로승격하지않는다.
- 최신refs/hash·종류/추가키오염·원문실패/권한거절·주체/transport·선택ABA·후행401에서채택/본문노출/후속GET/불필요POST0.
- ACK없이채택/타대상/원pending상이/UNKNOWN은거절하고기존거절packet·입력을유지.
직접집중2파일·필요기존UI06 editor-api/source/proposal·stage충돌선택회귀/typecheck·diff만실행한다. Main은필요Webmemorybuild와독립검수/통합. 실served/DB·권한·키·서비스·Agent·SSH·실자료조사는0이다. 결과서에실명령/exit·RED/GREEN·준비오류/실패횟수·raw지문·미검증·writer반환을기록한다. source/DOM합격을전체FN03/UI06·작업계획완료로표시하지않는다. 원문/역사는보존하고회귀는정상revert다.

## 사전 독립 확인
독립 읽기 C0/I0는 기존epoch/current·UNKNOWN/뒤409 차단과 비교 성공 후 scope이탈시 보관 comparison본문 즉시 숨김을 검수 초점으로 명시했다. 최신 자기contentHash 전체검산은 Main105a94에서도 확인한 정확 내부보완이다. 미배정 상태 유지·기존제품3 writer 종료 전 후속 구현0이다.
