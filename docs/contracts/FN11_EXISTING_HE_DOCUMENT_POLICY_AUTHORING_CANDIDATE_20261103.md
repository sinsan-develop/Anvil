# FN11 기존 HE 참여자의 일반문서 정책 작성 — 결정 검토 후보

상태 DRAFT / NOT_ADOPTED / SOURCE_GO0 / EXECUTION_GO0. 현재 FN01 25경로 작업을 확장하거나 중단하지 않는다. 이 문서는 후속 공백의 결정 검토용이며 구현 작업지시서가 아니다.

## 확인한 공백

Main45db5d와 이번3ffb68/f79b51은 현재 materialRules가 모든 HUMAN subject.userId를 정책 작성 actorId와 같게 제한하고, currentPolicy는 프로젝트 단일 head의 rules 전체를 소비함을 확인했다. 정책 저장은 전체 head를 교체한다. 따라서 다른 사용자 HE에게 유효한 일반문서 정책을 정상 관리 흐름에서 생산할 수 있는지는 미연결이다. 기존 FN15 양성 fixture는 정책이 있다는 조건의 합성일 뿐 이 생산 경로를 증명하지 않는다.

회원 역할 등록과 정책 작성은 다르다. FN01의 참여자 A안 직접 승인으로 이 타사용자 정책 의미까지 승인됐다고 하지 않는다. 기존 raw role/grant만으로 일반문서 쓰기를 자동 허용하지 않는다.

## 권장하는 최소 A 검토안

기존 savePermissionPolicy의 보호된 현재 OWNER·단독제어·최근 재인증·원 명령/버전/감사 경계 아래, 같은 프로젝트에 이미 ACTIVE로 등록된 HANDOFF_ELIGIBLE 사용자에게 일반문서 연산 정책을 명시적으로 작성할 수 있도록 추가한다.

- 기존 자기 자신 subject 규칙은 그대로다. 추가 대상은 서버가 같은 인증 Tx에서 실제 member·user ACTIVE/미회수를 검산한 타사용자 HE뿐이다. caller가 제공한 verified/role flag나 전역 사용자 검색을 쓰지 않는다.
- 타사용자 대상 연산은 기존 ordinaryDocumentOperations 9개만이다: saveDocumentDraft,recordContentReview(DOCUMENT만),confirmDocument,proposeDocumentChange,importDocument,uploadArtifact,linkDocumentSource,proposeDocumentSourceChange,detachDocumentSource. 실제 명령의 다른 도메인·등록/보호source 권위·물리grant/current 제어 검사는 계속 별도로 집행한다.
- PROJECT scope 한 개·같은 projectId·limitPolicyRef:null·기존 만료/명령 상한/중복 ruleId·AUTO/REQUIRE_APPROVAL/DENY와 DENY 우선 의미는 유지한다. 새 무제한 예외·관리/정책작성권·실행/Agent 권한·OWNER 승격·회원 회수/등록은 부여하지 않는다.
- REQUIRE_APPROVAL의 아직 미지원 producer/소비는 기존처럼 차단한다. 이 정책 저장을 새 승인 operation 채택으로 해석하지 않는다.
- 현재 정책의 정확 head/version/hash와 이전 rules 전체를 검토하고 새 버전을 저장한다. 자동 병합·타사용자 규칙 조용한 삭제·기한 연장·적용 성공 추정은 없다. 회원/역할이 바뀌면 새 명령은 현재 역할/grant/정책을 다시 검산하며 과거 정책은 보존한다.
- 화면은 보호된 현재 참여자 목록 또는 사용자가 아는 ID를 사용해 대상·현재 HE 역할·연산·정책 방식·기한·이전/이후 rules를 별도로 확인한다. 프로필·이메일·인증정보를 조회하지 않는다. 저장된 정확 정책 버전을 재조회한다.

## 대안과 결정 경계

1. A: 기존 HE/일반문서에만 정책 작성 대상을 확장한다. 계획된 사람 인계 후 문서 작업을 위한 좁은 생산 경로지만, 타사용자 정책 허용의 공개 입력 의미·권한 계약이 추가된다.
2. 보류: 동일 사용자 기기 인계와 독립 source 구현은 계속하며 다른 사용자 HE의 정상 여정은 미완료로 남긴다. fixture만으로 이를 완료 처리하지 않는다.
3. 모든 참여자/모든 연산의 일반 정책 편집 확장: 범위와 위험이 크므로 이번 후보로 권장하거나 묵시 채택하지 않는다.

채택 검토가 끝나면 정확 허용 파일·기존 SQL/새 forward 필요 여부·불변/변경 계약·합성 반례를 작업지시서에 고정한다. 이번 후보만으로 공개 API·코드·미적용 SQL을 수정하지 않는다. 실행 승인을 요청하는 문서도 아니다. 후속 구현도 별도 직접 결정 범위의 source-only이며 실제 DB·권한/정책 적용·키·서비스·Agent는 계속 제외한다.
## 기술 상세 작성 전 열린 경계 — r2 메모

부모 검토 초안 SHA D95335D6EA1AC5D037FAC89BC8E876D899884953427338F6F30C81389E2B5DC4. 본 후보는 아직 채택/구현 가능한 고정 계약이 아니다.

기존 policy operation인 recordContentReview는 DOCUMENT뿐 아니라 다른 도메인에도 쓰인다. 현재 HE의 실제 명령 집행은 DOCUMENT로 제한하지만, 나중에 대상 역할이 OWNER로 바뀌는 경우에도 이 추가 정책의 의미를 그대로 문서 범위로 유지할지, 역할 변경 시 재검토/새 정책을 요구할지, 처음에는 해당 공용 operation을 제외할지 구체화해야 한다. 기존 rule에는 targetKind/role-bound 필드가 없으므로 필드가 있다고 가정하거나 Boolean으로 권위를 추가하지 않는다. 새 공개 필드·역할 결박·기존 정책 평가 의미가 필요하다면 정확 delta와 영향을 별도 결정안에 넣는다. 이 미정점을 숨기고 현재 A를 전체 인계 문서 흐름의 완결 계약으로 보고하지 않는다. 현재 FN01 작업이나 그 역할 변경 승인에 새 조건을 소급 적용하지 않는다.