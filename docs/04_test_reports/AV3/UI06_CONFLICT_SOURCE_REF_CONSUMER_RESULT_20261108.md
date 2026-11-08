# UI06 문서 충돌 조정의 출처 소비·현재성 보완 결과

## 현재 판정
기존 계약의 소스·합성 DOM 검수 인수다. 실제 DB·served·사용자 인수 및 전체업무 완료 판정은 아니다. 기존 main39f159a59a6dc315bcdf7c2892eb24142a42ab37, branch codex/av3-document-conflict-sources, 시작 checkpoint5b85ef828c81284667ea5efe4703c3854ed06e95. WI UI06_CONFLICT_SOURCE_REF_CONSUMER_WI_20261108.md SHA f28376d2cfe74a2093ef5e93fce3af9ede50366108bc10daf7470fa498978916. 기존 Primary 제품2/시험2 단일 writer, Main 문서·검수·통합. 새 API/필드/SQL·권한 계약0이며 실제 DB·키·권한·서비스·Agent·SSH·사용자자료 조사는 제외한다.

## 재현과 구현 경계
기존 DocumentContent 출처4종을 가진 최신 v3를 v2 편집자의409 비교/명시 조정에 연결한다. KEEP_INPUT은 원 입력 출처/본문/항목을, LATEST_METADATA는 최신 출처/양식/첨부·형식을 보존하며 기존 sections초기화·내본문/제목/이유·거절 원packet 보존을 유지한다. 출처 자동합집합/자동저장/확정은 없다.

readDocument는 expectedContentHash가 없으면 전체 metadata hash를 재산출하지 않으므로 helper에서 최신 contentHash와 documentDraftHash를 대조한다. 기존 optional active 패턴과 Editor epoch·사용자/client/CSRF/transport·현재buffer/원pending·비교요청sequence·부모CAS에 연결하고 UNKNOWN뒤409로 새명령 우회를 허용하지 않는다. 두 출처는 기존 비교 영역에 함께 표시한다. 변경 전·후 diff는 해당제품2로 제한한다.

## RED·초안 오류 구분
- API RED3ac5e4 exit1/3FAIL: 정상4종의 compatible/수동조정 false, 최신 자기contentHash 오염 미거절, UNKNOWN뒤409 비교 허용. 원제품 시점 재현이다.
- 실제 Editor DOM RED6cfb2a exit1/2FAIL: 정상4종의 불필요 수동조정 차단, 같은actor/client에서CSRF교체뒤늦은401의auth callback1회.
- 추가 CAS RED1877d5: 이전 채택의 부모CAS 지연→같은pending 새비교→옛CAS실행. 기존epoch에 비교요청sequence를 결박해 선택 a82f09 1PASS로 보완했다. 해당1은 최종집중에 포함하므로 합산하지 않는다.
- f2923e의 ACK 전disabled 잘못된 기대1회와 UNKNOWN DOM의 Page초기목록GET 오인1회는 준비assert 오류로 분리했다. 주체변경 반례는 Page가unmount되어 원현상을 입증하지 못하므로 CSRF교체로 정확화했다. 기존 guard/권한·기대기준을 느슨하게 하여 통과시키지 않았다.
- 중간 집중 f36333 17PASS/exit0는 그 시점 증거다. 이후 최종집중18·동결·독립검수는 아래 별도 증거로 확인했으며 이 중간 결과와 합산하지 않는다.

## 미검증과 남은 조치
합성 API/메모리 DOM은 실제 DB·RLS·COMMIT·served 브라우저·사용자인수 증거가 아니다. 전체 UI06/FN03·작업계획은 미완료다. 최종 정확명령/exit·개별 지문/manifest·writer반환 및 독립 검수, Main필요Webbuild 후 안전commit/private push→PR필수검증→main병합→merged한정smoke→완료branch정리를 수행한다. 회귀는 정상revert로 복구하며 원문/과거명령·감사를 보존한다.

## 최종 검증·독립 판정
- node --test tests/unit/UI06/conflict-api.test.ts tests/unit/UI06/document-conflict-source-refs-ui.test.ts — Primary2501ff 18PASS/skip0/exit0. Main0a2cc3 같은 명령18PASS/skip0/fail0/exit0/3011.246ms. 두 실행을 합산한 새 시험 수로 세지 않는다.
- node --test --test-name-pattern='중단된 화면의 저장|저장 클라이언트|기존 일반 텍스트|단계에 연결된 문서 저장|^제안의 다른 주체|^수정 제안 선택|실제 Page/Editor에서 4종|저장 후 보호 GET 실패|부모가 완료 CAS' tests/unit/UI06/editor-api.test.ts tests/unit/UI06/proposal-api.test.ts tests/unit/UI06/document-source-refs-ui.test.ts — b3bd13 9PASS/skip0/exit0.
- npm run typecheck — 5a76a7/session88414→1137b2 exit0. git diff --check — f7f4d9 exit0.
- Main node --input-type=module -e "const {build}=await import('vite');await build({configFile:'apps/web/vite.config.ts',build:{write:false}})" — b45336,520modules/1.43s/exit0. 이후 제품 불변.
- 기존 conflict-api.test.ts 시험 본문 보존(+32/-0), 새 실제 Editor DOM/합성transport로 두 조정→별도ACK→명시저장/고정GET·원packet/양측refs·UNKNOWN·CSRF/transport/외부ABA·선택pending clone·late401·권한403·지연CAS를 검산했다.
- 독립9b4970→982665 시작/끝4개별SHA동일, 전체manifest e93f745c8f01d9ec752ca8928a228106e7c319f124ceeb639fcd8c39745fbb55/제품2manifest263652f6feb55e5da02c7453fc7e1e1c2477e129f0582fd381a0d9af7ed9a404 직접재현 C0/I0/M0. 독립 시험 재실행0.
- 알려진 live검증handle0·writer반환. 읽기 rg/gitdiff 호출6e52e9는 요약에서 exit/handle 누락으로 관측불명이며 시험명령이 아니다. 별도 최종f7f4d9 diff0로 그 과거 exit를 소급하지 않는다. 강제종료/재실행0이다.

구현의 source/합성 판정만 인수하며 실제 DB·권한·served 브라우저·Agent 실행은 NOT_RUN이다. 다음은 정확게시/PR필수검증/main/merged한정smoke·정리와 FN03 원관측 생산 선행의 정확한 계약 결정 지원이다. 미채택 보호관리원문·새조회/비용·현재권위를 임의 true로 연결하지 않는다.

## 통합 확인
PR71 sourcec16b160e5909de4a7398e871fdd4944a74818e4c는 Broker42439301458 success/9054e8로 main969cebbc4a69dda633da0b05f16fabf4c0f070c1에 병합됐다. parent39f159a5·source/merge tree d1967ca6a4b35b7fcb6b4744598dea7081298797 동일이다. Main64a669 정상FF 뒤 집중2파일18PASS/skip0/fail0/exit0/2338.1571ms를 확인했다. abdaef는 main local/private동일·clean·완료remotebranch/tag부재·PR71복구refc16b160e를 확인해 정상-d/-dr로 완료branch를 정리했다. squash 경고는 PR/tree/ref 근거와 보존하고 force0이다. 이후 최신main에서 후속FN03 원문생산 계약 상세 문서 branch를 생성·즉시 원격 게시했다.
