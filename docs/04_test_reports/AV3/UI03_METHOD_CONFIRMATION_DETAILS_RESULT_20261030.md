# UI03 방법론 확정 사건 상세 결과

판정: 기존 GET 자료의 화면 표시 누락 보완·source/합성 UI 한정 검수. 실제 DB/served/사용자인수·전체 UI03/FN02/Stage B 완료는 아니다.
기준 HEAD caa9327f5aacd6557946e4a757f897753e0aef74, codex/av3-stage-b. WI r2 UI03_METHOD_CONFIRMATION_DETAILS_IMPLEMENTATION_20261030.md SHA545AE0C30A50938DD74916A6BE97366B366D65DC3C79A581E7F9BCBAD5D5DDC9. Main 관리·검수·통합, 기존 Primary 단일 writer 해제, 기존 Reviewer 읽기 최종 C0/I0.

## 변화

공통/전용 MethodReviewPanel은 기존 confirmation 존재 여부 문구에 기본 접힘 상세를 더한다. 확정 사건 ID·decision·원 decided_at·확정 사용자·당시 reviewRefs의 id/criteriaVersion/outcome/targetRef를 표시한다. 검토 자체 version/hash는 제공되지 않아 발명하지 않고 대상 버전/지문과 구분한다. 최신 검토로 당시 참조를 대체하지 않으며 과거 확정과 현재 적용·권한·실행 승인을 구분한다.

user/client·정확 source id/version/hash·확정 ID에 details key를 결박한다. 전용 부모에는 기존 !loading&&!error 렌더 조건만 추가해 일반500/응답오류/403 뒤 상세를 숨긴다. 미저장 검토와 미확인 원명령은 기존 buffer에 남는다. API/reader/server/SQL/권한·기존 양식패널/다른 화면 변경0. 열기/닫기는 추가 요청·쓰기0이다.

| 최종 코드4 | SHA256 |
|---|---|
| apps/web/src/features/methodology-editor/MethodReviewPanel.tsx | 9375E29F16B5A9A8586EA4ADDEB3AB4DF3680BEE61AABE42565DAEA306DDD03F |
| apps/web/src/features/methodology-editor/ProjectMethodologyPage.tsx | E8D8F144C5AF4C7CDA8DF77B2CB8B549D54E767D555FA9D54B0AF31349F055E9 |
| tests/browser/UI03/method-confirmation-details.spec.ts | 04952744E490AA885BE6EAB746062AFB518F5FAA0EDE578A4F3E01D47885A880 |
| tests/browser/method-confirmation-details.config.ts | F125A406A63E27DDB9C722CDB5CC42E3D174BCFB30B46EBE34111B2D55E1037C |

## 증거·오류

- 사전 I1: 단일 패널은 전용 부모의 일반 오류를 알 수 없었다. Main172127 실제 분기 대조로 정확 부모 렌더 조건1개를 범위에 포함, r2 사전 C0/I0. ContentReviewRef 실제 필드도87eacf로 정정했다.
- b915ad 실제 공통 GET/parser를 통과한 상세 부재 RED1→c1afad 공통 GREEN1/build/type0. 마지막 제품 build473modules/415ms 이후 제품 변경0.
- ef3d4d 단일 실행의 전용 fixture2FAIL: original.graph에 임의 e/d hash를 결박해 실제 project-api79의 graphHash 검산이 정상 거절했다. Main3496ab 실제 계약 대조 후 original.contentHash로 fixture만 보완. 09a3bf 괄호 오타1은 실제 조건/GET0의 파싱 실패였다. 정확 수정 후3d38a8 전용 버전 전환1 PASS. 부모 alert rawcode 가정1FAIL은 실제 error.message/suffix·정확 HTTP status와 상세0/입력 보존을 검증하도록 바로잡았다. parser·제품·핵심 기대 완화0.
- 339d86 최신순 검토 배열과 확정 당시 ref 분리1 PASS. a5c8fb 목록500/invalid200/403 상세 제거·미저장 입력 및 별도 합성 원POST 단절 후 같은 commandId/payload 재확인2 PASS/3.8초. 47f1c7 기존 직접 명령/read 회귀2 PASS/4.1초·type/diff0. 수행자 분리 실행을 단일 최종 전수로 합산하지 않는다.
- Main b6d086 최종 새 fixture 신규6 PASS/6.5초/0FAIL/0SKIP. 같은 exec session66719의 별도 기존 회귀2는cc27d0 PASS/4.1초/exit0. Main72d593 type/diff0,54edbf 최종4hash 불변. 독립 최종 C0/I0·Reviewer 자체 시험 실행0.

Main 명령:

```powershell
$env:ANVIL_UI03_CONFIRMATION_LEGACY_QA='0'
node node_modules/@playwright/test/cli.js test --config=tests/browser/method-confirmation-details.config.ts --grep='UI03_CONFIRMATION' --output=D:/tmp/anvil-v3-stage-b/ui03-confirmation-details-20261030-01/results/main-new
$env:ANVIL_UI03_CONFIRMATION_LEGACY_QA='1'
node node_modules/@playwright/test/cli.js test --config=tests/browser/method-confirmation-details.config.ts --grep='방법론 내용 검토를 기록하고 단절 때 같은 명령을 확인한 뒤 정확 버전을 별도 확정한다|프로젝트 전용 복사·개정은 공통본과 분리되고 미확인 명령을 화면 이동 뒤 보존한다' --output=D:/tmp/anvil-v3-stage-b/ui03-confirmation-details-20261030-01/results/main-legacy
npm run typecheck
git diff --check
```

기존 회귀는 원 spec을 수정하지 않고 신규 파일 beforeEach의 기존 bundle+정확 flag에서만 기존2spec을 import하는 bridge로 실행했다. 서비스3830을 시작하지 않았다. 기존 회귀의 합성 POST와 상세 열기/닫기 추가통신0은 별도 증거다. 기대 실패 응답의 code 표시 가정만 실제 메시지/정확 status로 정정했고 실패·권한·입력/명령 보존 기준은 유지했다.

현재 파생 build 지문: index3B3925EA7B4AD859D5096A749B9065583667735FDCDA84B4CDFF3E17C56FA3EA/cssBC67262F3704E1FC62ECC0F21B976BDD60A84893B25206197DA7D60E2B015E87/js58A3BC8316210C1C1C7336570AC36B904C5043AAD541708E317B5F2313CABC98. 기존 chunk500k/NO_COLOR 경고 보존·자동수정0, Main 불필요 재빌드0.

## 자원·미검증·복구

사전 등록 D:/tmp/anvil-v3-stage-b/ui03-confirmation-details-20261030-01, owner SINSAN\cyhuh/link0, 생성2026-10-29T17:47:11.2815635Z/30분. 7037c4에서 exact realpath/owner/link0/자기 node·Edge process0 후 QA8항목 정리,54edbf 별도부재 확인. 기존 apps/web/dist 파생 build는 보존했다. 실제 키·DB·서비스·Agent·listener/포트·인증서·권한 변경0.

직접 client prop 교체는 NOT_RUN이며 소스 key와 다른 실행 증거로 구분한다. 실제 DB·WSL served·사용자인수·전체 UI03/FN02/WORK_PLAN은 미완료다. 새 공개 계약·공유B·미채택158E/P03 R2 실행을 활성화하지 않았다. rollback은 본 한정 단위의 정상 Git revert이며 실제 자료·보호8·키DB서비스는 변경하지 않는다. 다음은 기존 공유요청 A의 고정 지식 ref에서 같은 출발 프로젝트 보호 원문 GET을 여는 UI10 누락을 정확 범위로 대조한다.
