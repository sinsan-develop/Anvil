# UI00 모바일 메뉴 선택 후 본문 초점 복귀 결과

## 판정

동일 화면과 다른 화면 모두 열린 모바일 메뉴의 일반 링크를 선택하면 메뉴가 닫히고 선택한 화면의 본문에 초점이 도달했다. 다른 화면인 경우 원 화면에 머무르는 동안에는 본문에 초점을 주지 않고 해시 변경이 React 경로에 반영된 후 옮긴다.

기준 main `fedf6631e37c745c6e2534e0a3e3554f85bf11ff`, 브랜치 `codex/av3-shell-menu-focus`, 지시서 SHA256 `C017EF163743F5B6EEAFC97EFFCD3A2E524ABDC7330C3F9081D85838E7AC9628`.

## 변경

아래 두 지문과 최초 21건 검증은 독립 검수 전의 이력이다. 재작업 후 최종 지문과 검증은 이어지는 절에 기록했다.

- `apps/web/src/shell/AppShell.tsx`는 열린 모바일 메뉴에서 현재 탭의 일반 링크를 선택한 경우 대상 href를 기억한다. 메뉴 닫힘과 경로 반영 후 기존 `main[tabIndex="-1"]`에 한 번 초점을 준다. 해시 이동은 기존 링크와 App의 hashchange 처리에 맡긴다. SHA256 `F7287B5AC17736FC9FD3307D00EDE5EA48F2EA0E15B4A6DB96C5F369DD8DA05A`.
- `tests/unit/UI00/project-shell-access.test.ts`의 기존 RAM DOM·React App으로 메뉴 열기, 같은 화면·다른 화면의 선택, 제목·aria-expanded·activeElement, 입력 편집, 데스크톱 및 새 탭 선택을 관측했다. SHA256 `7FC94B034DFA2B919CC8CAEBEEA0AA57A5E4B64D964E5D9FD5D3B09A9E114091`.

## 실행 결과

| 명령 | 결과 |
|---|---|
| `node --experimental-strip-types --test --test-reporter=tap --test-name-pattern='모바일 메뉴 선택|초기 렌더와' tests/unit/UI00/project-shell-access.test.ts` | 제품 변경 전 06a1b3 · exit 1 · 1 통과, 2 실패. 현재 화면과 다른 화면에서 모두 선택한 화면의 본문 초점 단언이 실패했다. |
| `node --experimental-strip-types --test --test-reporter=tap tests/unit/UI00/project-shell-access.test.ts tests/unit/UI00/routes.test.ts tests/unit/UI00/mobile-approval-navigation.test.ts` | 52f1c7 · exit 0 · 21 통과, 0 실패, 0 건너뜀 · 2376.795ms |
| `npm run typecheck` | 7a982f → 05f4d8 · exit 0 · 세션 41474 종료 |
| `git diff --check development/main` | 708e6e · exit 0 |

## 독립 검수 I1 재작업

경로 도착 전에 메뉴를 다시 여는 경우와 별도 입력으로 초점을 옮기는 경우, 이전 메뉴 선택이 이후 본문 초점을 가져갔다. 기존 셸의 수동 토글과 셸 안에서 다른 요소가 초점을 받는 순간 대기 선택을 취소했다. 처리 시 원 링크와 현재 초점을 다시 확인하며 메뉴 숨김으로 body가 초점을 받은 경우도 허용한다. 입력이 제거되어 body로 돌아가도 이미 취소한 선택은 다시 실행되지 않는다.

- RED · `node --experimental-strip-types --test --test-reporter=tap --test-name-pattern='경로 반영 전' tests/unit/UI00/project-shell-access.test.ts` · 5b842b · 2 실패, exit 1.
- 첫 보완 후 위 직접·인접 3파일 명령 · 8a168c · 24 통과, 0 실패, 0 건너뜀, exit 0. 당시 제품 지문 `7EDE95F2D8B41AE0F2BD47B33C754FD40C2A35C90F8A6DA97DB8E8D46577ED57`에서 루트 타입 검사는 f9348b · exit 1이었다. React가 셸의 초점 이벤트 대상을 div로 표현해 링크와 직접 비교한 곳에서 TS2367 한 건이 발생했다.
- 비교에 `Object.is`를 사용한 최종 제품 SHA256 `431B00C67CBF03FD3D9AE3D771BAEF3EE925FEFFFC56BCE04CDA2813B4FC6B44`, 최종 시험 SHA256 `CF8935B987967BBD42F3CAD6A58CAEC948EA0A58D20BEC672FE3ABF04F25F79D`.
- 최종 동일 직접·인접 명령 · 063543 · 24 통과, 0 실패, 0 건너뜀, 3290.4326ms · exit 0. `npm run typecheck` · e54837 → 67382d · exit 0, 세션 44116 종료. `git diff --check development/main` · d69d77 · exit 0. 각 지문에서 실행한 수는 따로 기록했다.

직접 시험은 실제 App 번들을 메모리에 빌드했다. Vite 설정 파일·환경 파일 로딩과 출력 쓰기는 비활성화했다. 키보드 Enter가 링크에서 발생시키는 click을 전달하고, 경로가 바뀌는 사례에서는 기존 App에 hashchange를 전달했다. 실제 브라우저의 키 입력·기본 링크 활성화·CSS 레이아웃·뒤로가기 인수는 미검증이다. 실서비스·DB·권한·키·CLI·SDK·Agent·사용자 자료 접근은 없었다. 실행 중인 핸들은 0개다.

통합 후 되돌릴 때에는 이 작업의 셸 및 시험 변경을 함께 복구한다. 데이터·환경 설정에는 복구 작업이 없다. 작업현황, 독립 검수 및 Git 통합은 Main 담당이다.
