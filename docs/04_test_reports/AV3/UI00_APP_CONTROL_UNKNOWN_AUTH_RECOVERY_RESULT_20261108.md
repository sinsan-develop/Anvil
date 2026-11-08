# UI00 M2 실제 App 제어 UNKNOWN·상단401 결합 검증

## 판정

기존 실제 App controlStore의 원 제어 요청이 UNKNOWN이 된 뒤 상단 접근 GET401로 세션 문맥이 해제되고, 사용자가 기존 ‘접근 상태 다시 확인’의 session GET으로 동일 actor/client를 회복할 때 원 명령 UUID/body가 보존됨을 확인했다. 제품 결함은 재현되지 않았고 제품 파일은 변경하지 않았다. 암호 로그인·새 credential 발급·실제 서버 COMMIT·receipt 보존 검증으로 확대하지 않는다.

- 기준 main e3c7dd1abe69c3a966a419f63c661b72ba1ddef0, branch codex/av3-plan-completion-audit.
- 최종 WI SHA256: 853e2ea86a1bdd9b0485f31e7409c87673b8f9647e2b1cd7166ce4fb7cc04de7.
- 변경은 tests/unit/UI00/project-shell-access.test.ts 한 파일, 21906B/SHA256 d0f6147429b1fd75475ff857b1d261bd7246c085e30b42e579d28889e52bd893.
- WI의 ‘명시 로그인 회복’ 표현은 실제 수행한 기존 세션의 명시 재확인으로 정확히 정리했다. 원 M2가 요구한 UNKNOWN/401/App store 결합 범위이며 새 인증 계약을 발명하지 않았다.

## 실제 증거

실제 App UI에서 첫 requestControl 명령을 생성해 CAS UNKNOWN 선보존→합성 POST 응답 유실→상단 GET401→명시 session GET→원 프로젝트 복귀→다른 프로젝트의 원 packet/전송 비노출→원 프로젝트에서 동일 UUID/body 명시 재확인을 검산했다. store 재주입·가짜 페이지·제품 export·일반 성공 fallback은 없다. requestControl UNKNOWN은 receipt 미수신이므로 기존 타입에 없는 receipt 필드를 추가하지 않았다.

```powershell
node --test --test-name-pattern='실제 App UNKNOWN 제어 요청은' tests/unit/UI00/project-shell-access.test.ts
node --test tests/unit/UI00/project-shell-access.test.ts tests/unit/UI12/control-state.test.ts tests/unit/UI12/control-api.test.ts
npm run typecheck
git diff --check
```

- 신규08cb1c: 1 PASS/skip0/exit0(1869.248ms).
- 전체+최소인접7eb0f5: 17 PASS/skip0/exit0(2450.5685ms), 신규1은 이 안에 포함하며 중복 합산하지 않는다.
- 타입419a30/session78899→ffa0cb exit0, diff check0.
- 기존5사례 본문/기대값과 나머지404 fallback은 helper 변경 역치환으로 HEAD 전체와 같음을 e3166c에서 확인했다.
- 독립 읽기 C0/I0/M0, 시작/종료 지문 동일. 제품이 불변이어서 별도 Vite build·무관 회귀를 반복하지 않았다. 시험 과정의 actual App 메모리 bundle을 사용했다.

## 미검증·복구

실제 암호 재인증/만료·다른 actor/client의 복원·새 인증정보/영수증·DB/COMMIT·서비스/브라우저·Agent는 미검증이다. UI00 전체/전체 계획 완료는 아니다. 복구는 시험 변경 분리 또는 통합 PR 정상 revert이며 제품/실제 제어 상태는 바뀌지 않는다.
