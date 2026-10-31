# UI10 지식 편집 선택기 식별 — 한정 재현·보완

2026-11-01 / Main 어울 / 기준 `5a022ee901504ab68b435643d2f452d3de9ece7b`

기존 UI10 시험의 React 중복 key 경고를 좁힌다. 실제 Page116의 KnowledgeArtifactPicker와 Page118의 KnowledgeScopePicker가 같은 바깥 section의 sibling이며 동일 project/user/client/controlGeneration key를 쓴다. Page125의 KnowledgeDocumentPicker는 별도 지식 작성 section 내부다. 앞선 Scope/Document 조합 설명은 부모 경계를 잘못 묶은 가설로 정정하며 이번 제품 수정 대상으로 삼지 않는다.

현재 실제 UI10의 중복 표시·상태 손상은 미확정이다. UI13의 유사 결함만으로 이 기능의 실패를 확정하지 않는다. 새 기능·API·DB·권한 계약은 만들지 않으며 신산님이 허용한 제품 소스/시험 읽기와 기존 source·합성검수 범위를 따른다. 실제 사용자/백업 자료 조사·DB·권한·키·서비스·Agent 실행은 제외한다.

## 정확 두 파일

- `apps/web/src/features/knowledge/KnowledgePage.tsx` 시작 SHA256 `FC6E92329E6DF731B8AA5B69B9451BC03689613909D7BEA99AA5B3D9BC6349AA`.
- `tests/unit/UI10/knowledge-scope-original-boundary.test.ts` 시작 SHA256 `A48FE630F998D6971F1D9A6091F2D92B02D33747F17CA1FF013B784BB8A21496`.

기존 Primary 단일 writer가 먼저 시험만 보강한다. 기존 네 행동 단언·인접 reader5는 보존한다. 실제 KnowledgePage·기존 decoder/native hash를 사용하고, 가능하면 실제 React host state로 유효 onChange를 반영한다. 실제 원문 목록 A/B 선택 또는 도달 가능한 초안 입력/관련성 변경 뒤 `지식 보관파일 출처 작성`·`지식 관련성 선택`이 각각 정확1개, 문서 출처 선택 버튼1개인지 확인한다. 본문·title·scope·sourceRefs·원 pending을 보존하고 편집 자체 외 부모 callback과 명시 조회 외 추가 IO·POST가 없음을 구분한다. 고정 callback 대역만 사용한 부분은 입력 편집 종단으로 확대하지 않는다.

실제 중복 반례가 나오면 정확 명령·exit·동결 시험 지문과 제품 불변을 반환한다. Main의 독립 RED 확인 전 제품 수정은 금지한다. 반례가 없으면 성공 기준을 바꾸거나 경고만으로 제품 오류를 만들지 말고 결과를 보고한다.

PRODUCT_GO 후 허용 제품 변경은 두 sibling key에 서로 다른 고정 namespace를 추가하는 것뿐이다. 기존 project/user/client/controlGeneration 값·props·순서·mount·문서 picker는 유지한다. pane/편집마다 key를 새로 만들거나 다른 UI를 정리하지 않는다. 실제 원인 판단은 같은 반례의 수정 전후 결과로 한정한다.

최종 신규5+직접 reader5를 선택해 검증하고 type·필요한 메모리 UI build·diff·원바이트 역치환·독립 scoped review를 수행한다. 무관한 완료검사와 전수 회귀는 반복하지 않는다. 새 브라우저/QA 파일은 별도 등록 전 만들지 않는다. root/gate/native/global/채널 회수·오류와 미검증을 기록한다. 전체 UI10·Stage·작업계획 완료로 승격하지 않는다. rollback은 소유 commit 정상 revert다.
