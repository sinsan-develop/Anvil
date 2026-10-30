# UI09 기존 체크포인트 명시 조회 연결 작업지시서 — 2026-10-31

## 기준·판단
신산님의 승인 WORK_PLAN 완료 지시와 FN13 r2 A source-only 채택을 따른다. SCREEN_WORK UI09(AV3-S09 §8.2/11.10)의 기록·안전→인계내용에서 이미 구현된 FN13 고정/목록 GET을 연결하는 내부 UI 누락 보완이다. 새 API/입력·저장·권한·인계 확정 계약을 채택하는 작업이 아니므로 재승인 없이 진행한다.
- 시작 codex/av3-stage-b / product checkpoint3611de4a0bfc677234087dc52a35269db466ef08(local/private 일치). Main 문서 checkpoint가 추가돼도 제품기준은 이 SHA다.
- 기존 단일 Primary만 코드 write, Main은 관리·검수·통합, 기존 Reviewer 읽기 검수. 다른 보호3/원5 복구사본·기존 dirty 보존. 새 agent/chat/branch/worktree0.
- 실제 DB/권한/키/서비스/Agent·새 SQL·원문 FS·인계/재개 실행0. FN14 manifest/6항목 의미검토/확정 후보 미채택 상태를 변경하지 않는다.

## 실제 누락·범위
TransferPreparationPage는 readTransferRecords/readTransferContext로 기존 임무/맥락을 읽지만 새 FN13 GET은 소비하지 않는다.
- 현재 제품 hash6F5B4050DB6B3DFB4A70089955BD8AB53208E2AD1CC9E92C5EC1E101851205C0.
- 기존 checkpoint-api.ts의 listStoredCheckpoints/readStoredCheckpoint를 그대로 사용한다. 서버/helper/App·계약 변경0. App candidateKey는 현재 user/client/project+assignment로 기존 페이지를 remount한다.
- 정확 write 허용3:
  1. apps/web/src/features/transfers/TransferPreparationPage.tsx
  2. tests/browser/UI09/transfer-checkpoint-dom.test.ts(신규/부재확인)
  3. tests/browser/UI09/transfer-checkpoint-dom-harness.tsx(신규/부재확인)
- 다른 제품파일 수정 필요 시 구체 이유를 Main에 먼저 제시하며 임의 확대하지 않는다.

## 구현·검수 조건
1. TDD: 실제 기존 페이지에 체크포인트 명시조회 동선이 없는 RED를 먼저 기록한다. 명시 기존 인계기록 조회 후 현재 선택과 정확하게 일치하는 records.detail.confirmed.ref만 소비한다. old records가 다른 project/ref/current client에 잠깐 재사용되지 않게 렌더 시점부터 감춘다.
2. 명시 체크포인트 목록→이전페이지→정확 기록 선택→검산된 원문/기록시각·순번·미확인 표시를 제공한다. 새 세션이 ID를 몰라도 현재 허가된 정확 임무의 기존목록에서 찾을 수 있다. mount/render만으로 자동GET/POST0.
3. 기존 helper의 hash/원문/flags·scope·지연 digest·same-origin 검사를 우회하지 않는다. 예전 작성자가 다른 정상기록도 조회가능하되 현재권한 거절401/403/404·손상503/변형hash는 이전 원문/목록을 숨긴다. 401은 기존 authenticationLost에 연결한다. 실패를 빈정상목록으로 꾸미지 않는다.
4. 전송중 다른임무/프로젝트·client객체/실제 transport교체·이탈/복귀/ABA/재조회는 즉시 이전본문/지연응답을 폐기한다. active에서 actualtransport 동일성을 직접 비교한다. 같은 프로젝트라도 parent의 실제confirmed선택과 일치하지 않으면 원문을 표시하지 않는다.
5. 조회는 저장·기준선적용·writer회수·인계준비확정·새세션/Agent·재개를 실행하지 않는다. 전체quota 공급자 미연결/신규저장412·실제중지/회수·인계/재개 미확인은 그대로 표시한다. 선택된 기록을 현재사실/안전/이전완료로 승격0. 기존 맥락/대상후보 UI·준비/내려받기 흐름을 보존한다.
6. 정상목록/페이지·원문/다른작성자, deny/hash손상, 중복클릭·지연전환·transport와 이탈, POST0/same-origin GET만, 기존 UI09맥락/대상후보 보존을 필요한 범위로 검증한다. 정확 실행 명령/exit·RED→GREEN·미검증을 제출한다.
7. 기존 Node24 타입/메모리 build 및 인접 unit을 선택한다. 합성 DOM은 ego-browser 단일 신규 기능검수 taskSpace만 사용하고 기존 사용자tab/profile/실network/listener/DB0. 실제 실행 전에 정확 root·name·수명/owner/정리를 Main에 등록하고 생성GO받는다. 단위/메모리 준비는 즉시 가능하다. Playwright/별도browser launch0.
8. 원문이 실제서버에서 생산/저장됐다고 주장하지 않는다. 신규producer가quota412이므로 source/합성연결 검수와 실제사용가능·FN14전체/계획완료를 분리한다. 독립 C/I0·Main검증후 소유3+관련문서만 정상checkpoint, 실제서비스반영/PRmain병합0.
