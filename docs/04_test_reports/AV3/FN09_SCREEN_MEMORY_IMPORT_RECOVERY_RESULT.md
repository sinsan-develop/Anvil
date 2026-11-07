# FN09 기존 화면시험 수집 복구 결과

2026-10-27 · 기준 codex/av3-stage-b / 4f5701c5a7251ceb9354fd15504ec2035658419e.

판정: **기존 화면시험 4건의 수집·실행 공백 해소.** 제품 기능을 새로 구현한 진도로 계산하지 않는다. 전체 FN09/Stage/작업계획·정식 서비스 인수 완료는 아니다.

- WI docs/work_packages/FN09_SCREEN_MEMORY_IMPORT_RECOVERY_WORK_INSTRUCTION.md SHA256 DBCA324BDA7EC70512B589CDF7A97E6EFFB4A7347FC3445A7438A57A46BCEF65.
- 단일 구현 담당 fn09_screen_memory_import_recovery, Main 관리·검수·통합. 변경은 tests/unit/FN09/responsible-session-screen.test.ts 1파일의 변환 부분16행 추가/3행 삭제다.
- 최상위 TSX만 변환하던 방식에서 필요한 하위 TSX를 같은 transformWithOxc로 재귀 메모리 변환하고 원본 URL별 Promise를 캐시한다. React/일반 TS는 기존 file URL 해석을 유지한다. 새 의존성·전역 hook·공통 loader·실파일 출력0이다.
- Main409add: node --test tests/unit/FN09/responsible-session-screen.test.ts → ERR_UNKNOWN_FILE_EXTENSION ClaimUnderstandingHistory.tsx, exit1/수집FAIL353.264ms. 해당 기존 실패를 소급 삭제하지 않는다.
- Main09ffc4: 같은 명령 → **4 PASS358.9764ms/fail0/skip0/exit0**. 미확인 명령 보존·다른 주체 비노출·provider 이력 명시 조회/자동 호출0·THREAD/TURN 구분과 정확 원 query를 실제 실행했다.
- Main09ffc4: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json / git diff --check 모두 exit0.
- Mainc85650: const pid= 이후 fixture/시험 본문을 기준HEAD와 바이트 대조해 동일 true. 이름/assertion/데이터/부작용 기대의 삭제·완화0이다.
- 변경 전 HEAD SHA256 4A85B2B3A8649431526F0F1DCE236B17355267BF013A61F0789213D04D071B98.
- 최종 원문 SHA256 3762371CB1A51523AF2FD24FA016891E6F94640C24E183E01A69956CB02EC217.
- 독립 scoped 정적 C0/I0. 실제 반례 없음, 위 시험 증거는 Main 실행과 구분한다.
- 담당 보정 중 타입 실패2회는 정규식 캡처 그룹의 undefined 가능성/튜플 단언 불일치였고 최종 non-null 명시로 해소했다. 카드 이름 추정 읽기2건은 목록 확인으로 정정했다. 제품 실패/정식 FAILURE_REPORT로 세지 않는다.
- 새 파일 산출물·QA 경로·listener·브라우저·DB·서비스·권한·Secret·Agent/비용 변경0. 보호 untracked8과 Main 문서는 담당이 수정하지 않았다. 다른 불변 시험/브라우저 성공을 반복하지 않았다.

직전 FN09_RESPONSIBLE_SESSION_ONE_TIME_APPROVAL_RESULT.md의 기존 화면시험 수집FAIL은 당시 이력이다. 이 후속에서 해당4건만 해소했으며, 그 결과서의 실제 SQL/정식 DB·서비스·Agent/사용자 인수 NOT_RUN은 여전히 미확인이다. 복구는 소유 시험의 후속 revert이며 실제 자료/서비스 복원은 수행하지 않았다.
