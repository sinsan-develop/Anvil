# FN06 필수 정책 회귀 시험 경로 delta — Main 내부 판정

2026-11-05 · Main 어울 · source-only 필수 검수 보완
부모 직접 채택: call_453a800c6ef74f0c8b723fea57ed2100 questionItem0
부모 packet SHA256 682a51daca51fad9525b4db34ab62dcdd99b0d5dc63a2b1bca1acc211f2ca24e
부모 WI SHA256 c66b3381829513a5a1cb69a0d606fbcd4904e62a4561e8b979bdfad940df43bc
기존 source adoption: docs/contracts/FN06_NATIVE_FIRST_RECEIVE_SOURCE_ADOPTION_20261104.md
기준 HEAD c3f12d8f62d7f5e6da2d1b4310a2be4da0da71c4
SOURCE_GO1 / ACTUAL_EXECUTION_GO0

## 근거와 판정

채택 WI 2절58행은 부득이한 추가 파일의 정확 호출선·최소 delta를 쓰기 전에 Main에 반환하도록 정한다. Primary가 한 파일을 반환했고 기존 읽기 검토자가 실제 import·정책 목록·서버 소비를 독립 확인했다. 이는 이미 채택된 HUMAN3/read3에 직접 영향받는 기존 회귀 시험의 필수 정합이며 기능·공개 API·저장·권한·비용·운영 범위를 새로 넓히지 않는다.

기존56개 허용 경로는 그대로 보존한다. 정확 추가 경로는 tests/unit/UI11/preparation-policy.test.ts 한 개다. 이 판정 뒤 최종 허용목록은 기존56과 이1개의 합집합57개이며 다른 추가 파일은0이다. 부모 문서 bytes/hash를 바꾸지 않고 최종 diff 허용목록 대조에 이 파생 판정을 함께 사용한다. 신산님이57개를 직접 별도 승인했다고 표현하지 않는다. Main이 채택 WI의 최소 delta 절차와 승인된 필수 검수 범위에서 판정한 것이다.

## 정확 baseline·소비 근거

시험 파일은 읽기 확인 시 tracked clean, raw SHA256 8e045c88a8eed438c59a2d39bca6468416b7d3a7785d28b49d5dcf005f30edb8이다. 쓰기 직전 동일 여부를 재검산하고 다르면 덮어쓰지 않는다.
실제 import는 apps/web/src/features/connections/policy-editor-profile.ts다. PROJECT_PREPARATION과 서버 documentOperations/materialRules 및 새 runtime HUMAN3/read3의 소비가 연결됐다.
새 목록은 실제 source 순서대로 기존12 앞에 다음6개를 추가한다.
- prepareNativeReceiveWindow
- offerNativeReceiveCommand
- closeNativeReceiveWindow
- readNativeChannelProfile
- readNativeReceiveWindow
- readNativeReceiveOffer

기존12개의 이름과 상대 순서는 보존한다. 정확18개 비교를 유지하며 wildcard·부분포함·개수만 비교로 줄이지 않는다.

## 허용 변경·필수 검증

기존 Primary 한 명만 이 추가 시험 파일을 수정한다. 허용 delta는 고정 ops 목록에 위6개를 추가하고 정확12행동/12준비행동을 적은 시험명 두 곳을18로 정정하는 것이다. assertion·기존 negative 목록·기본 미선택/DENY/acknowledged=false·다른 규칙 보존·준비 POST0/별도 저장 POST1·ops×3 disposition 왕복은 그대로 둔다.
정확 node --test tests/unit/UI11/preparation-policy.test.ts와 변경 전후 diff·종료/결과를 제출한다. 기존 전체 시험을 다시 실행하지 않는다. 정책 작성/저장 형태의 REQUIRE_APPROVAL 왕복을 실제 수신 연산 실행 허용·승인 소비·권한 부여 PASS로 표현하지 않는다.
이외의 제품 source는 기존56 안에서만 수정한다. 실제 DB·정책/권한 적용·키·서비스·Agent·C# 컴파일·실자료 조사·J3/P03 R3·Git 복구 실행은 계속 제외한다. 테스트 삭제/skip/기대 축소·SourceAPI 추가로 맞추지 않는다.