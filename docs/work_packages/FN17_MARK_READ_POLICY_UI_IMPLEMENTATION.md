# FN11/FN17 알림 읽음 정책 명시 선택 연결

기준: codex/av3-stage-b a89f204f8a683967da1dc64b931f27fe8ff554af. 승인된 WORK_PLAN FN11/FN17/UI11의 표준 markNotificationRead 편집 연결 누락만 보완한다. Main ruling: 서버 기존 operation과 현재 자료 정책 프로필의 일관성을 복원하며 새 API·권한 예외·자동 정책 부여가 아니다. PMO 자체 대기는 이 업무의 중단 사유가 아니다.

## 허용 단일 writer 4경로

1. apps/web/src/features/connections/policy-editor-profile.ts — PROJECT_MATERIAL에 markNotificationRead/알림 읽음 표시 추가. 다른 프로필/기본 선택 불변.
2. apps/web/src/features/connections/CandidatePolicyPanel.tsx — 해당 행동 명시 선택 시 현재 제어·서버 정책 재검사, 읽음은 승인 결정이 아님, REQUIRE_APPROVAL 선택은 현재 412 NOT_CONNECTED임을 알려 오인 방지. 기존 제어·최근 인증·정확 버전·보존명령·정책 확인을 보존한다.
3. tests/unit/UI11/material-policy.test.ts — 새 버퍼 기본 미선택/DENY; 명시 준비는 POST0, 별도 전송만 savePermissionPolicy; 기존/혼합 규칙 보존, 순수 읽음 규칙의 재편집 가능; 후보 프로필에는 읽음 허용0.
4. tests/browser/UI11/material-policy.spec.ts — 기존 App fixture에 선택/안내/원명령 준비/전송 반례를 추가. 알림 mark 자동 호출0, unknown/pageerror0, 기존 규칙 보존. 기존 expectation/테스트 삭제·완화0.

## 순서·검수

- 작업 전 PMO AGENTS/프로젝트 v3 진입점·관련 계획/설계/상태를 확인하고 실제 경로는 rg로 확인한다. 기존 보호 untracked8/다른 파일 보존, writer는1명이며 Main 제품 수정0.
- 먼저 의미 있는 새 unit RED를 실행해 편집 불가를 확인하고 기존 helper 소비 경로만 최소 수정한다. Node 선택 unit/typecheck/diff를 실행, 전체 회귀 반복0. Browser spec 작성과 실행은 분리하며 실제 QA는 Main 사전 등록 후에만 실행한다. 현재 신규 QA 생성0.
- 새 SQL/DB/정책/계정/Secret/권한/서비스/Agent/브라우저 OS permission 변경0. 생산자/원승인 원자성/10000상한/REQUIRE_APPROVAL 구현 확장0.
- 기존 impeccable craft-floor와 스타일을 적용하되 새 메뉴/테마/문서체계/리팩토링/의존 설치0. 추가 설명은 해당 선택 때만 조건부, 기존 폼 레이아웃 유지.
- 결과에 기준/변경 전후 이유·4파일 지문/정확 명령·종료코드/RED→GREEN/미실행·남은 위험·writer해제를 보고한다. 실제 정책 저장·서비스 사용가능/전체 FN17 완료 주장0. Git commit/push는 Main만 수행한다.

rollback: 해당 source checkpoint 정상 revert, 실제 데이터 변경 없음. 별도 publisher/실DB/정식 서비스 선행은 독립 미완료로 보존하며 이 업무를 막지 않는다.
