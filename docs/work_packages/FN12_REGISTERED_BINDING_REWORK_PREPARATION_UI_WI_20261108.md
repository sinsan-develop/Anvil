# FN12 등록 정의 예약의 기존 보완 준비 화면 연결 작업지시

- 담당: Main 어울 / 기존 Primary 단일 writer.
- 기준: PR63 merged main `44dfca069f0e1aacf3556eec4e11b4d30cdc258a`, 작업 branch `codex/av3-fn12-review-followup`.
- 근거: WORK_PLAN FN12/UI05, FUNCTION_WORK FN12 및 기존 등록 정의 책임세션 예약·보완 준비 계약. 새 후속 임무 계보 후보의 채택·구현은 아니다.

## 실제 누락과 변경 전후

`apps/web/src/features/session-detail/result-rework-api.ts`의 prepareResultReworkDraft는 기존 binding hash를 검산한 뒤 connectionReadiness를 CANDIDATE_ONLY에 고정한다. 서버 result-rework-input.ts는 readResponsibleSessionBinding으로 종류를 확인하고 REGISTERED_DEFINITION/REGISTERED_DEFINITION_ONLY도 이미 허용한다. workspace의 책임세션 reader도 같은 쌍을 읽는다. 따라서 정상 등록 정의 예약이 화면 prepare 요청 전에 거절된다.

변경 전: 후보 예약만 보완 준비 가능.
변경 후: 종류 필드가 없는 기존 후보/CANDIDATE_ONLY와 명시 REGISTERED_DEFINITION/REGISTERED_DEFINITION_ONLY 두 쌍만 기존 prepare 요청으로 연결한다. 알 수 없는 own kind·종류/준비상태 교차는 거절한다. 새 종류나 기본 허용 fallback은 추가하지 않는다.

## 정확 소유 범위

제품은 아래 1파일만 수정한다.

- apps/web/src/features/session-detail/result-rework-api.ts

시험은 아래 2파일 안에서 필요한 것만 추가한다. 기존 private ResultReworkEditor의 선택/준비 동작을 Vite write:false와 시험 전용 가상 export로 확인하며 제품 export는 추가하지 않는다. 기존 result-rework-form.test.ts는 수정 없이 필요한 인접 회귀로만 사용한다.

- tests/unit/UI05/result-rework-api.test.ts
- tests/unit/UI05/result-rework-registered-preparation.test.ts (신규 합성 DOM 시험)

Main은 이 지시서·WORK_STATUS·결과 기록만 쓴다. 서버/API/DTO/SQL/정책/권한·다른 제품·기존 사용자 자료를 수정하지 않는다. 예상과 달리 다른 제품 파일이 필요하면 정확 원인과 diff를 Main에 먼저 반환한다.

## 수행·검증

1. 해시가 정상인 등록 정의 예약을 기존 prepareResultReworkDraft에 주었을 때의 요청 전 거절을 새 시험으로 RED 재현한다. 서버의 기존 pure prepareResultRework를 합성 transport에서 사용할 수 있으나 실제 DB/네트워크/Agent를 호출하지 않는다.
2. 해당 UI guard 한정 보완 뒤 등록 정의 정상과 기존 후보 정상을 확인한다. 원 요청 본문·same-origin/CSRF·고정 ref/hash·입력 clone·scope·기한/false 표식·403/이탈/응답 변조 검산을 보존한다.
3. 잘못된 kind/readiness 쌍과 unknown own kind는 해시를 다시 계산한 유효 모양에서도 POST0으로 거절해야 한다. true 권위 표식이나 다른 binding/주체·범위가 이 보완으로 허용되지 않도록 직접 영향 음성을 확인한다.
4. 기존 Form의 등록 정의 예약 준비 클릭→정확 응답 표시를 합성 DOM에서 확인한다. 새 실행·승인·후속 임무 발급/저장은 만들지 않는다. 실제 브라우저·서비스 검증으로 승격하지 않는다.
5. 변경 시험과 직접 영향받는 기존 보완 준비/폼 시험만 실행한다. 변경 최종 타입과 UI 메모리 빌드·diff check를 수행하며 무변경 검사와 무관한 START/SEND 전체 검사를 반복하지 않는다.

실제 DB·권한·키·서비스·Agent/SSH·사용자 자료 조사·배포는 제외한다. completionAccepted/currentAuthorityVerified/실행·전송 표식을 true로 승격하지 않는다. 새 공개/데이터 계약과 후속 임무 계보는 이 작업 밖이다.

## 반환·복구

정확 명령/exit/결과, 변경 파일 hash/bytes, RED→GREEN, 살아 있는 handle/미검증과 오류 원인을 반환하고 writer를 해제한다. Main 독립 검수 뒤 같은 branch에 게시·일반 PR 통합·merged smoke·정리를 수행한다. 완료된 코드의 수정 사유와 전후 diff는 이 guard 불일치로 한정한다. 복구는 통합 후 해당 PR revert이며 실제 DB 복구는 필요 없다. 전체 WORK_PLAN 완료로 보고하지 않는다.
