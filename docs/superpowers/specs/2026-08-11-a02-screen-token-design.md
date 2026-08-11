# A-02 화면 토큰·설명 인터페이스 설계

## 목적

A-02는 후속 Phase A 화면이 공통으로 사용할 1920×1080 정적 화면 기준을 확정한다. 제품 UI·CSS·브라우저 runtime은 구현하지 않으며, `AV-UI-001`과 `AV-UI-002`를 정적 artifact 수준에서 검증한다.

## 확정 접근

1. 단일 machine-readable token catalog를 정본으로 둔다.
2. 사람이 읽는 typography/layout/color 명세와 설명 인터페이스 명세가 catalog를 해설한다.
3. 1920×1080 SVG 정적 render에서 typography, layout, semantic color, tooltip/popover 예시를 한 화면에 표시한다.
4. validator와 hostile mutation tests가 문서·catalog·render의 불일치를 stable reason code로 거부한다.

제품 CSS를 먼저 구현하는 방식은 A-03~A-15 책임을 침범하므로 제외한다. 산문 문서만 작성하는 방식은 E-SHOT 정적 증거와 기계 검증이 약하므로 제외한다.

## 고정 계약

### 화면·타이포그래피

- viewport: 1920×1080
- 본문·폼: 12px
- 작은 설명: 10px
- 아주 작은 보조: 9px
- 사이드바 제목: 14px
- 화면 제목: 16px
- 좌측 sidebar: 224px, 접힘 56px
- 상단 header: 48px
- 우측 context drawer: 360px, 필요 시
- 기본 여백: 16px
- card gap: 12px

### 설명 인터페이스

- 설명 진입점은 `i` icon이다.
- 짧은 설명은 tooltip, 상호작용·결정·증거처럼 복합 내용은 popover를 사용한다.
- tooltip/popover에는 최소 `이유`와 `다음 행동`을 포함한다.
- 상시 설명 box는 허용하지 않는다.
- hover만 요구하지 않고 focus/keyboard 경로를 함께 계약한다.

### 상태·색상

- 색상은 semantic role로만 사용하고 상태를 색상만으로 구분하지 않는다.
- 모든 상태 표현은 `icon + 상태명 + 짧은 설명`을 포함한다.
- 상태 role은 neutral, info, success, warning, danger, blocked, focus를 포함한다.
- 실제 hex 값은 catalog에 고정하되 후속 화면은 role만 참조한다.
- 일반 text contrast는 최소 4.5:1, focus/non-text boundary는 최소 3:1을 validator가 계산한다.

## 산출물

- `docs/architecture/a02/A-02_TOKEN_CATALOG.json`
- `docs/architecture/a02/A-02_SCREEN_TOKEN_SPEC.md`
- `docs/architecture/a02/A-02_EXPLANATION_INTERFACE.md`
- `docs/architecture/a02/A-02_STATIC_RENDER.svg`
- `scripts/check_a02_tokens.py`
- `tests/tooling/test_a02_tokens.py`
- `tests/fixtures/a02/**`
- `docs/validation/A-02_TOKEN_VALIDATION.md`
- `docs/evidence/manifests/A-02_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/A-02_COMPLETION_REPORT.md`

## 검증 경계

- `AV-UI-001`: catalog와 SVG가 1920×1080 및 12px 본문 계약을 정확히 결박해야 한다.
- `AV-UI-002`: 설명 진입점·tooltip/popover·상시 설명 box 금지 계약을 정확히 결박해야 한다.
- 증거는 `STATIC_ONLY / STATIC_RENDER`이며 실제 브라우저 screenshot이 아니다.
- 클릭, focus 이동, CSS 적용, responsive 동작, Network, API, DB, Event runtime은 `NOT_EXECUTED`다.
- `E-SHOT` 표기는 `E-SHOT_STATIC` qualifier와 함께만 사용한다.

## 적대 검증

validator는 다음 mutation을 각각 거부해야 한다.

- viewport, font size, sidebar/header/drawer/spacing 값 drift
- persistent explanation box 허용
- `i` icon, tooltip, popover, reason, next action 중 하나 누락
- focus/keyboard 경로 누락 또는 hover-only 계약
- 상태의 icon·문구 결합 누락 또는 color-only 표시 허용
- 필수 semantic role 누락·중복·unknown role
- 지정 contrast threshold 미달
- SVG width/height/viewBox 또는 catalog binding drift
- 정적 증거를 browser/runtime PASS로 위조
- A-01 presentation contract와 A-02 catalog 불일치

## 범위와 안전성

허용 범위는 A-02 architecture, validator/test/fixture, validation/evidence/completion, WorkInstruction/Invocation과 progress/HANDOFF다. `apps/**`, `packages/**`, 제품 CSS, 권위 문서, 기존 accepted evidence, 서버·DB·배포는 수정하지 않는다.

기능 범위·요구사항·중요 위험 변경은 없다. DIR은 A-15 이후이므로 A-02 종료 시 도달하지 않는다.
