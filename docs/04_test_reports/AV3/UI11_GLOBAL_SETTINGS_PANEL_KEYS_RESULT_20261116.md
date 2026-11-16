# UI11 전역 설정 패널 key 충돌 검증 결과

## 판정

전역 설정의 보호참조 등록·조회 패널과 설치 자원·이식키 관리 패널을 형제 목록에서 구분하도록 JSX key 두 개에 각각 `backup-reference:`, `installation-resource:`를 붙였다. 개발 React의 중복 key 경고가 1건에서 0건으로 줄었다. 두 패널이 각각 한 번 렌더되는 것을 확인했다.

기준 main `ab8b2a2ea94dbac2ecaaaf710a64df4ddd2c6332`, 브랜치 `codex/av3-settings-panel-keys`, 지시서 SHA256 `1387E43D886D777BBE376AC3760AB99FF758353F844EB32AAC05EDC5874E7D5B`.

## 변경과 검증

| 변경 파일 | SHA256 |
|---|---|
| apps/web/src/App.tsx | `592F6A46A10E939F07570FACC30A38BD0A732BB919D7F033A1886AC3E5E5DF6C` |
| tests/unit/UI00/project-shell-access.test.ts | `0B9AFCA9204F6748DEFD20DF97063FAB2EFC999F98457D05EADDA45DF5EE540F` |

원래 전역 설정에서는 두 key의 기본값이 모두 비어 있고 같은 세션 접미사를 붙였다. 새 접두사를 두 JSX 위치에서만 역치환한 제품 파일 전체가 기준 Git 바이트와 같았다(a5a258 · exit 0). 기존 부모 저장소 키와 프로젝트·주체·CSRF 접미사 및 자식 props는 그대로다.

- 수정 전 `node --experimental-strip-types --test --test-reporter=tap --test-name-pattern='전역 설정 패널' tests/unit/UI00/project-shell-access.test.ts` · a8f5ba · exit 1 · 1실패. 기대한 중복 경고 0건에 실제 1건을 관측했다. 경고 판정은 포맷만 세며 원래 console.error를 호출한다.
- 수정 후 `node --experimental-strip-types --test --test-reporter=tap tests/unit/UI00/project-shell-access.test.ts tests/unit/UI00/settings-source-links.test.ts` · d2da8c · exit 0 · 16통과, 0실패, 0건너뜀 · 1586.0417ms. 실제 App을 기존 메모리 Vite/React 환경에서 마운트했다. 한 패널의 선택은 다른 패널을 바꾸지 않았고 같은 프로젝트의 재렌더에서 두 선택과 노드가 유지됐다. 다른 프로젝트에서 두 노드는 교체되고 종류 선택은 각각 TARGET으로 초기화됐다. 해당 시험의 모든 요청은 모의 GET이었다.
- `npm run typecheck` · 771c10 → b7e31e · exit 0, 세션 62252 종료. `git diff --check development/main` · fae09b · exit 0.

## 미검증과 복구

실제 브라우저·백업·설정 POST·권한·키·DB·서비스·CLI·SDK·Agent·사용자 데이터 접근은 미실행이다. 실제 세션의 CSRF 회전은 미검증이며 접미사 보존은 제품 바이트 대조로 확인했다. 실행 중인 핸들은 0개다.

복구 단위는 두 JSX 접두사, 해당 RAM 반례와 이 결과서다. 운영 데이터·설정 복구는 필요하지 않다. Main이 독립 검수·현황·Git 통합을 담당한다.
