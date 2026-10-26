# FN11/FN17 읽음 정책 명시 선택 연결 결과

판정: source 구현과 합성 App 핵심 5경로 확인. 실제 정책·DB·서비스 동작은 미검증이다.

- 기준 codex/av3-stage-b a89f204f8a683967da1dc64b931f27fe8ff554af, WI 1A10CB0CBC8BA42A430B7F565702BBCD97A7F70570BB4445022862D2F881C086. 단일 구현 fn17_read_policy_ui / Main 관리·검수·통합·제품수정0.
- 변경 이유: 서버 기존 markNotificationRead가 자료 정책 편집 allowlist에서 누락되어 선택/기존 읽음 규칙 재편집이 불가했다. PROJECT_MATERIAL 선택지1·해당선택 조건부안내만추가. 기본[]/DENY·다른프로필·기존규칙/제어·최근인증·표준정책저장확인은불변. 읽음≠승인결정, REQUIRE_APPROVAL은412 미연결임을명시했다. 실제정책자동부여·새권한/API0. 정확4경로/지문은manifest.
- 실제 unit RED: node --test tests/unit/UI11/material-policy.test.ts / exit1 / 기존7 PASS·신규2 FAIL /662.0436ms. CANDIDATE_POLICY_INPUT_INVALID·editable false를보존. GREEN 같은명령9 PASS345.5256ms. 담당자 material+candidate 직접인접16 PASS414.9179ms, typecheck/diff0, impeccable detect[]/exit0. Main bee132 같은material9 PASS343.7032ms/FAIL·SKIP0, 소유hash4확인.
- 독립정적검수4경로 C0/I0/M0. Main 97f6da Vite write:false442 modules647ms, 61fd8b --grep MATERIAL_NOTIFICATION_READ_POLICY_ 새5건 AUTO/DENY/REQUIRE_APPROVAL/READ_EDIT/READ_MIXED_EDIT PASS·FAIL/SKIP0·6475.293ms. 준비POST0·별도savePermissionPolicy전송1·기존규칙보존·자동mark0·unknown/pageerror0을검수. 실제App bundle+합성API이며 실제정책저장이아니다. 기존테스트본문/기대완화0. 별도 이미지 육안/전체접근성 검수는미실행, UI는기존폼스타일유지.
- 등록 QA30분 root 생성19:04:05.624Z/만료19:34:05.624Z. c5ccae19:05:30Z 정확 owner/nonlink/process0 확인후15파일12dir2163660bytes회수, 별도root/process0확인(resource JSON). 기존서비스/DB·사용자browser·Secret/권한·Agent변경0. 기존환경NO_COLOR/FORCE_COLOR경고는그대로보존.
- 추정 UI14 spec 경로 읽기오류1건은실제rg목록으로정정, 반복추정/ACL변경0. 정식실패보고0·fixround0.

rollback은해당소유source checkpoint 정상revert이다. 전체FN17/Stage/계획완료아님. 실제알림생산/DB·권한·서비스/채널은독립미완료이며 다음기능은기존문서보호GET을이용한저장본문원본다운로드다.
