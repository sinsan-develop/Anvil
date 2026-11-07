# UI10 보관 공유요청 원문 미리보기 결과

판정: 기존 A안 출발측 보호 조회의 source/합성 DOM 한정 보완. 실제 공유·HTTP API/DB·서비스·사용자 인수 및 전체 UI10/FN05/WORK_PLAN 완료는 아니다.
기준27b79b7c6414e865a0ec23cff293e7c3eab70d0e / codex/av3-stage-b. WI r2 UI10_SHARE_REQUEST_ORIGINAL_PREVIEW_IMPLEMENTATION_20261030.md SHAAEC0AE85A22D53AC789D0459200A1B7DF75782021DC833D6D2AF6D0360CBD725. Main 관리/검수/통합, 기존 Primary 단일 writer 해제, 기존 Reviewer 최종C0/I0.

## 구현

METADATA_ELIGIBLE 보관 요청의 정확 지식 ref를 명시 선택해 기존 readKnowledge(client,출발 projectId,ref)로 현재 보호 조회·entry/body 검산을 수행한다. 부모 inspect는 selected를 바꿔 요청 상세/목록을 초기화하므로 재사용하지 않고 패널 내부 읽기 전용 미리보기를 추가했다. 요청 ref/hash·기존 panel key/client 문맥 및 선택 지식 ref/sequence에 결박하며, 요청 전환·재조회·닫기·주체/client/project/ABA 뒤 늦은 결과를 버린다.

UNAVAILABLE는 버튼/원문/추가 참조를 노출하지 않는다. 조회 시작/거절·ref/entry/body/보호 검산 실패 시 미리보기의 이전 본문을 제거한다.401만 기존 인증 상실 통지,403은 읽기 거절이다. 부모 selected·미전송/미확인 공유 buffer·원명령은 변경하거나 자동 전송하지 않는다. title/ref/state/body는 텍스트이며 편집·확정·실제 공유/대상쓰기/공유B 활성화0. snapshot은 원문 접근 허가가 아니다.

정확 코드3:

| 파일 | SHA256 |
|---|---|
| apps/web/src/features/knowledge/KnowledgeShareRequestPanel.tsx | 97680953A3A256B843D29C7A87F9486F690E9E18C907C7C56B476D65CDD46EF2 |
| tests/browser/UI10/knowledge-share-request-dom-harness.tsx | B0E4075DF44B3F10D35EEB3A8449FCBAFDE6B00801D3F275277886C9A2DEC70B |
| tests/browser/UI10/knowledge-share-request-original-dom.test.ts | A2E8FE2A1E28668EB1F626D94EFCED514F5876432F4D345BFF5B18AFC5006263 |

harness는 기본 NORMAL 반환/보관 의미를 보존하고 선택적 두 요청 seed와 원문 지연/거절/불일치만 추가했다. 부모·기존 reader/API/server/SQL·다른 제품 기능/기존 구 QA script는 수정/실행하지 않았다.

## 검증과 오류

- 839c04/d16c1b 원문 버튼 부재 RED는 자식1+부모1 FAIL·실제조건1개다. 구현후 d30fee/dcf5a2 자식6+부모1 Node7PASS. NORMAL 회귀/GET 정확1/응답 관측 보강후 a27bcf/d89f4e 자식7+부모1 Node8PASS/14.958초·type/diff0. 이 중간 결과를 최종 단일전수로 합산하지 않는다.
- 독립 I1: 새 시험의 mkdir/build/env/launch가 try 밖이고 close 오류가 후속 정리를 막았다(Main51f93f/e990c5). 동일 신규 시험1만 outer setup/finally·optional context·항상 env복구·원오류+회수오류 보존으로 보완했다. 정상 close 확인 자원만 삭제하며 실제 launch/close 불명은 보존/실패로 보고한다. 제품/harness는 불변이다.
- b0904f BUILD-before-build와3c1055 LAUNCH-before-launch는 의도한 안전 합성 오류 각exit1/env복구true/별도QA0. 실제 compiler/browser failure가 아니며 물리 close 실패/프로세스 불명은 NOT_RUN이다. 정상 최종82ea8d/b08776은 자식7+부모1 Node8PASS/15.852초,2b1f07 type/diff0/QA0. 독립 scoped 재검수 I1해소·최종 C0/I0.
- Main a2c946→0ebd39→d31261 session15482: 최종 자식7+부모1 Node8PASS/0FAIL/0SKIP/총18684.4276ms(exit0), QA_ENV_RESTORED true/QA_REMOVED. 이 집계를 독립 조건8개로 표현하지 않는다.
- Main16b744→c538d2 session78169 npm run build(타입 포함)/diff exit0,473modules/801ms. 기존 chunk500k 경고를 보존·자동수정0. a436cc 별도조회 QA root/관련 node·Edge process0·최종3지문불변.

Main 명령:

```powershell
$env:ANVIL_UI10_ORIGINAL_QA='1'
# RED/SETUP_FAULT 환경변수는 없는 정상 경로
node --test tests/browser/UI10/knowledge-share-request-original-dom.test.ts
npm run build
git diff --check
```

조건은 정상 정확 원문·XSS 텍스트·GET 정확1, UNAVAILABLE 최소봉투,403/401·wrong ref/entry hash/body/격리 표식 거절, 서로 다른 요청/재조회/닫기·client/user/project/ABA 전환 후 늦은 결과 폐기, 기본 NORMAL 보관·효과false, 미전송/미확인 원명령 전체 불변이다. 기존 공유 보관의 합성 POST와 미리보기의 GET-only는 별도다.

실제 Edge DOM·실제 ApiClient/reader를 사용하지만 API는 메모리 transport 응답이다. DELAY는 Response 반환 전 transport 대기이며 HTTP response.json 본문 대기·실제 API Network 증거가 아니다. 전체 보호/권한·DB/서버 정상 증거로 승격하지 않는다. 합성 bundle SHA256 e2e4303d8531b8bc2d1f88d1d4e089bcf9016d6b636240a5899245bbe1b3b34b는 수행자/Main이 동일하다.

## 자원·남은 범위

등록 root D:/tmp/anvil-v3-stage-b/ui10-share-request-original-20261030-01에서 매 실행 fresh/owner/realpath/nonlink·inode/dev 신원을 확인하고 자기 Edge 정상 close·환경 복구 뒤 회수했다. Main 생성2026-10-29T18:26:08.482Z, 약18초 정상시험 뒤회수/별도a436cc부재·process0. 각 실행30분내이며 과거구QA/다른폴더·보호8/실제키DB서비스·Agent·서버port·대상쓰기 변경0.

현재 실제 HTTP API·DB·served·사용자 인수와 실제 OS close/launch 실패는 NOT_RUN이다. 미채택 HUMAN R2/158E·명시 제외된 prepareExecution/reviewUnderstanding·소진P03 R2 경계는 유지한다. rollback은 본 한정 delta의 정상 Git revert이며 실제자료·보호8 보존이다. 전체 기능은 정식 환경/계약 선행이 남아 미완료이며 다음 안전한 미완료 업무와 정확 결정을 별도 대조한다.
