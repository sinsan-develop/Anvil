# FN12 등록 정의 예약 보완 준비 UI 연결 결과

## 판정

기존 서버 계약에 이미 있는 등록 정의 예약으로 화면에서 보완 초안을 준비하는 연결 누락을 보완했다. 제품은 `apps/web/src/features/session-detail/result-rework-api.ts`의 종류·준비 상태 검사 한 조건만 수정했다. 서버·공개 API·DTO·SQL·권한·실제 실행은 변경하지 않았다. 전체 FN12/WORK_PLAN 완료나 실제 브라우저·DB 인수는 아니다.

- 기준 main: `44dfca069f0e1aacf3556eec4e11b4d30cdc258a`.
- 작업 branch: `codex/av3-fn12-review-followup`.
- WI: `docs/work_packages/FN12_REGISTERED_BINDING_REWORK_PREPARATION_UI_WI_20261108.md`, SHA256 `599b8fcb569ed39f3be6ac91a21d4e9b7d80f3c28342c9aa2b43b8f2abf03244`.
- 최종 제품1/시험2 manifest: `68d1c9352719dc9bcc634ac5e9fafadbdeafbf65471211f40003436c1610b418`(경로 정렬 path/bytes/sha256 compact UTF-8 JSON, BOM·끝 개행 없음).

## 변경 사유와 결과

서버 result-rework-input.ts와 책임세션 reader는 종류가 없는 기존 후보/CANDIDATE_ONLY 및 REGISTERED_DEFINITION/REGISTERED_DEFINITION_ONLY를 이미 구분한다. 웹 준비 helper만 CANDIDATE_ONLY에 고정해 정상 등록 정의를 요청 전에 거절했다. 반대로 unknown own kind와 CANDIDATE_ONLY 조합은 입력 guard를 지나 전송할 수 있었다.

정확한 두 쌍만 받아들이도록 소비자를 맞췄다. unknown own kind·교차 조합은 hash를 다시 계산한 입력에서도 POST0으로 거절한다. 기존 후보 흐름·structuredClone·hash·scope·same-origin/CSRF·false 표식·응답/403·이탈 검산은 유지했다. 실제 상위 ResultReworkEditor의 선택 필터/버튼에는 추가 후보 전용 제한이 없어 다른 제품을 수정하지 않았다.

## 검증

| 검증 | 결과 | 범위 |
|---|---|---|
| 신규 API 입력 RED | fb6be5: 2 FAIL/skip0/exit1 | 정상 등록 정의 사전 거절·unknown kind POST0 실패 재현 |
| 실제 private Editor RED | 0f5f9e: 1 FAIL/exit1 | 등록 정의 option 선택/입력/준비 클릭 후 사전 거절 |
| API·실제 Editor 합성 DOM | edef77: 8 PASS/skip0/exit0 | 등록/후보 정상·교차/unknown/true 거절·prepare POST1·서버 pure 응답 표시·commands POST0·403·unmount late 배제 |
| 서버 준비·기존 form/write 인접 | c8703e: 7 PASS/skip0/exit0 | 기존 보호 준비·저장 소비 경계 |
| 최종 타입 | ed7258/session51822→a6f7af: exit0 | 신규 DOM callback 타입 주석 보완 후 |
| UI 메모리 빌드 | Main 5e612f: exit0, 518 modules/1.13s | Vite write:false, 출력 파일 없음 |
| diff/지문 | 232e38 exit0, Main e88849 원본 대조 | 최종 제품/시험 원본 확인 |

독립 읽기 검수는 제품 guard/기존 서버 계약 동치·실제 private Editor 소비·해시 유효 변조·scope/false 보존과 최종 타입 주석을 대조해 C0/I0/M0로 판정했다. 마지막 DOM 변경은 callback의 기존 원소 타입 주석뿐으로 행동·기대값이 같아 시험을 무의미하게 재실행하지 않았다. commit/PR/main smoke는 WORK_STATUS에 이어 기록한다.

```powershell
node --test tests/unit/UI05/result-rework-api.test.ts tests/unit/UI05/result-rework-registered-preparation.test.ts
node --test tests/unit/FN12/project-result-rework-preparation.test.ts tests/unit/UI05/result-rework-form.test.ts tests/unit/UI05/result-rework-write-api.test.ts
npm run typecheck
node --input-type=module -e "import {build} from 'vite'; await build({configFile:'apps/web/vite.config.ts',build:{write:false}})"
git diff --check
```

## 오류와 미검증

- option의 실제 value attribute 대신 메모리 property를 읽은 시험 준비 오류와 Python 기본 cp949 읽기 실패를 원 제품 RED와 분리했다. 명시 UTF-8/native exit 확인을 적용했다.
- 최초 타입은 신규 callback scope의 TS7006 한 건으로 exit1이었다. 기존 fixture 타입 주석만 추가해 최종 exit0을 확인했다.
- DOM 선택 scope는 실제 Editor가 원 허용 WRITE target을 그대로 선택하는 동작에 맞췄다. 기존 API READ 부분집합 시험은 유지했다.
- 메모리 DOM은 제품 export를 바꾸지 않는 시험용 virtual export/Vite write:false를 사용했다. 실제 네트워크·served browser·실제 DB·권한·키·서비스·Agent·SSH/사용자 자료 조사는 NOT_RUN이다.
- 준비 결과의 reworkStored/currentBindingVerified/currentAuthorityVerified/completionAccepted/executionAuthorized/dispatchPerformed false를 그대로 유지한다. 새 후속 임무 계보·실행/저장은 추가하지 않았다.

## 복구

기존 승인 범위의 화면 소비 보완이며 실제 DB 복구는 필요 없다. 통합 뒤 복구는 해당 PR 정상 revert를 사용한다. 완료된 원자료 START/SEND·무관한 전수 검증은 반복하지 않았다.
