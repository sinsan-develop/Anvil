# UI03/FN03 공통 양식 저장 확정 뒤 조회 복구 — 2026-11-16

기준 main95ff90397c1b625cfbb32f1340028e16fd368f38, branch codex/av3-ui03-form-read-recovery. 기존 공통 양식 저장·고정 GET 계약의 내부 화면 보완이며 새 API/SQL/권한은 없다. WI SHA256 09ED43C8D7854F7050EBA25FF5D7A728C04A6640C8B478722EAC2C26F75FFC5A. Primary 구현, Main 검수·통합.

## 변경

변경 전에는 검산된 APPLIED/DRAFT의 서버 발급 fullref를 지역변수에만 보관해 후속 GET503 때 잃었다. 새 양식은 원명령 targetId=null이어서 발급 ID를 복원할 수 없고 수동 복구가 POST 재전송이었다.

변경 후에는 원 요청과 검산 fullref를 동일 FormBuffer.pending에 명시 타입으로 보존한다. 저장 영수증이 확인된 경우에는 화면 왕복 뒤 명시 GET만 수행하고 원문 검산이 끝난 뒤 기존 formBuffer/onSaved/목록 반영을 수행한다. POST 응답 자체가 유실되면 기존 동일 명령 재확인 경로를 유지한다. 복사 원본 교체·원문 hash 불일치·늦은200/401·사용자/client/화면 종료 보호와 미저장 검토 입력을 보존한다. 이 optional 화면 필드는 서버 권위가 아니다.

## 검증

- 수정 전 RED a0470b: 실제 React RAM의 유효영수증→GET503 뒤 pending에 발급 fullref 없음, 1F/exit1.
- 수정 후 c2659e: 직접/인접 3파일 22P/0F/0SKIP, 1349.6679ms, exit0. 명령은 node --experimental-strip-types --test tests/unit/UI03/project-methodology-review-read.test.ts tests/unit/FN03/form-draft-client.test.ts tests/unit/UI03/duplicate-form-field.test.ts.
- 신규4건: POST1→GET503→왕복→명시 GET만 복구·다른hash거절, 주체/client/화면 종료 후 늦은200/401 폐기, POST응답유실 동일명령 재확인, 복사 원본 교체 뒤 지연조회 미반영.
- npm run typecheck: 1ed83b exit0. Vite envDir:false/write:false의 생산 빌드: 913e78 exit0, 520모듈·HTML/JS/CSS 메모리 출력. 실제 서비스는 아니다.
- diff 검사 4811fe exit0. 기존 시험의 지원되지 않는 envFile:false는 envDir:false로 정정해 환경파일 조회를 차단했다. 기존 기대값은 낮추지 않았다.
- Main 핵심 흐름 7c09a6: 1P/0F/0SKIP, exit0.

## 동결·한계

- CommonFormEditor.tsx: 696FE912E111D847EA64D680D70693972959A60BC2EE50CD7C2C68DDC22DE6AB.
- form-editor-state.ts: 33EBDA8B2F8E35D50B10E0E35D03919FB40B192937A4AAECF13427363C768081.
- project-methodology-review-read.test.ts: 0BDC418E56C241BB4CF2D88C07A44B303EC9D31C18D00D13CA37602E02A94238.

실브라우저·served·DB는 미검증이며 전체 UI03/FN03·계획 완료가 아니다. 실제 DB/권한/키/서비스/Agent·SDK 조회·P03 자원 조작은 0회다. rollback은 세 파일의 한정 diff 역적용이며 기존 사용자 자료 변경은 포함하지 않는다.

독립 소스 검수 C0/I0/M0. 원 요청·전체 저장 참조 보존, GET성공 전 onSaved0, 성공 후 검토 입력 유지, 늦은200/401 폐기를 확인했다. 복사 원본 교체의 신규 직접 시험은 이미 보존된 복사 명령에서 진행 중 GET의 늦은 성공을 폐기하는 범위이며 최초 복사 버튼의 전체 흐름 증거로 확대하지 않는다.
