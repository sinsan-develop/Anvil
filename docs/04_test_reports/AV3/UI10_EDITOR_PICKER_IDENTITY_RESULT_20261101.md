# UI10 편집 선택기 중복 보완

2026-11-01 / Main 어울 / source 보완·메모리 핵심 동작 확인

## 기준·부모 경계 정정

WI `UI10_EDITOR_PICKER_IDENTITY_FIX_20261101.md` SHA256 `9F404AF806413D22B7775491529D5648E2033E48978F33CF9D1E1FD3FAAF64F2`, control `bcf1cc8bc059a7461e2f14480a0b8614fd373e82`다. 기존 Primary가 구현하고 Main이 검수·통합했다.

실제 충돌은 같은 바깥 section의 Page116 **KnowledgeArtifactPicker**와 Page118 **KnowledgeScopePicker**다. Page125의 DocumentPicker는 별도 작성 section 안이다. 앞선 Scope/Document 조합을 충돌 부모로 묶은 가설을 정정하며 DocumentPicker는 수정하지 않았다.

## 변경과 검증

제품은 두 key에 고정 `artifact-picker:`/`scope-picker:` 접두사만 추가했다. 기존 project/user/client/controlGeneration tuple·props·순서·mount·다른 picker와 UI13은 유지했다. 역치환하면 시작 raw SHA256 `FC6E92329E6DF731B8AA5B69B9451BC03689613909D7BEA99AA5B3D9BC6349AA`가 복원된다. 원래 CRLF2개를 임의 정규화하지 않았고 Git의 LF 경고는 별도로 보존했다.

- 최종 Page raw SHA256 `0D79C497794B60A5176B4CF1BA6890C6C3961330EC1A67C406966DC050D70D83`, 32,821B. Git LF projection `2BF7DF1512D284EA0054DE5A5E60338E21877F0CCC303CCE04CFE5AD543BAF0F`.
- 최종 시험 SHA256 `03C94A2FCD03693B2DD523F1FFBC228D42D3DE4446D823E24B77D0B882BD5675`, 21,640B. 기존 네 행동 단언을 보존하고 새 실제 Page 중복 반례 한 개만 추가했다.
- Main `9a2a60`의 선택 재현은 실제 React host state·A→B→A 원문 GET·명시 제목 변경 뒤 artifact10/scope1/documentButtons1로 실패했다. 0 PASS/1 FAIL·native exit1, 622.8185ms, 중복 key 경고10. wrapper exit0은 예상 RED 확인이며 제품 PASS가 아니다.
- 같은 반례의 두 key 보정 후 각1개로 회복했다. Main `5c5034`의 아래 두 파일 단일 실행은 **10 PASS/FAIL0/SKIP0/CANCEL0/TODO0**, 755.5269ms·exit0·중복 key 경고0이다.

```text
C:/Program Files/nodejs/node.exe --test tests/unit/UI10/knowledge-scope-original-boundary.test.ts tests/unit/FN05/knowledge-scope-original.test.ts
```

Main의 타입 검사·diff도 exit0이다. 수행자 최종10/1704.9169ms·메모리 build(write:false) 출력3/모듈487은 별도 증거다. 독립 최종 동일 지문 C0/I0/M0.

## 보존 범위와 한계

실제 KnowledgePage/React host state가 제목 변경을 반영하고 원 body·scope·sourceRefs·fixture의 pending 값을 보존했다. 명시 입력 callback1 외 자동 callback0, 명시 GET 외 추가 IO0·POST0·unknown0·인증상실0을 확인했다. **fixture의 pending은 채워진 UNKNOWN 전체 사례를 증명하지 않는다.** 입력은 React 소유 onChange 직접 호출이며 실제 브라우저/native 입력·시각 인수가 아니다.

기존 reader5와 네 원문 경계 시험은 유지했다. 신규 시험의 root/container·gate/native/global/소유 채널 회수, Node 정상 종료를 확인했다. 새 브라우저·서비스·파일 QA 자원은 만들지 않았다. 이번 보완의 준비 오류는 없으며 수행하지 않은 실제 DB·서비스·실권한·Agent·사용자 인수는 미검증/제외다. 전체 UI10·Stage·작업계획은 미완료다.

소유 제품/시험2+본 결과·WORK_PLAN·WORK_STATUS의 정확5경로만 통합한다. 보호3은 보존하고 rollback은 소유 commit 정상 revert다. API·DTO·권한·DB·키·실서비스·Agent 실행·사용자/백업 대상 조사·main 병합/배포는 수행하지 않았다.
