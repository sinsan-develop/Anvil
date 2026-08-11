# A-02 화면 토큰 정적 계약

## 판정 경계

- execution: `STATIC_ONLY`
- package verdict: `STATIC_CONTRACT_PASS`
- evidence qualifier: `E-SHOT_STATIC_NOT_RUNTIME_UI`
- canonical L4 runtime: `RUNTIME_DEFERRED / NOT_EXECUTED`
- assigned: `AV-UI-001`, `AV-UI-002`
- 실제 브라우저·Playwright 판정 책임: `A-14`, `A Gate`

이 문서와 SVG는 정적 설계 artifact이며 runtime UI PASS 증거가 아니다.

## 화면·글자·배치

| token | 값 |
|---|---:|
| viewport | 1920×1080 |
| body/form | 12px |
| small description | 10px |
| auxiliary | 9px |
| sidebar title | 14px |
| screen title | 16px |
| sidebar expanded/collapsed | 224px / 56px |
| header | 48px |
| context drawer | 360px, ON_DEMAND |
| base padding | 16px |
| card gap | 12px |

## semantic palette

| role | value |
|---|---|
| canvas | `#0B1220` |
| surface | `#142033` |
| surface-raised | `#1B2A42` |
| text-primary | `#F7F9FC` |
| text-muted | `#B8C4D8` |
| border | `#60738F` |
| interactive | `#7DB4FF` |
| focus | `#F8D66D` |
| success | `#5EE3A1` |
| warning | `#FFD166` |
| danger | `#FF7B86` |
| blocked | `#C4A7FF` |
| info | `#74D7FF` |
| neutral | `#B8C4D8` |

일반 text 조합은 contrast 4.5:1 이상, focus·경계 같은 non-text 조합은 3.0:1 이상이어야 한다. raw hex를 새로 직접 추가하지 않고 catalog의 semantic role을 사용한다.

## 상태 표시

상태는 `icon + status_label + short_description`을 함께 사용한다. 색상만으로 성공·경고·오류·blocked를 구분하지 않는다. 추가 설명은 `i-icon`을 통해 tooltip/popover로 연다.
