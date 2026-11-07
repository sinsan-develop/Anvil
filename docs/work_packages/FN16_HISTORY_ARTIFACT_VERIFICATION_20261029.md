# FN16 대화·지식 목록의 원문 검증 연결 작업지시서

## 기준·범위
2026-10-29, codex/av3-stage-b/2643674508cb1156ebdb9e3ba89f8d9a978205ed. 설계§10.4/FN16 및 신산님 source·합성 직접승인 내 기존 내부 수집기 소비선 연결이다. 실제 DB/FS/키/서비스/P03/job/Agent 실행0·공개 API/schema/권한 확대0. 기존 fn16_primary 단독 writer, Main검수/통합, fn16_review읽기검수.
허용 수정 apps/server/modules/backups/artifact-current-verification.ts 및 신규 tests/unit/FN16/history-inventory-artifact-verification.test.ts 두 경로. 기존 collector/byte reader/문서·단일 테스트는 변경하지 않는다. 기존 private currentScope를 재사용하고 기존 verifyCurrentArtifact/verifyDocumentInventoryArtifacts의 동작을 보존한다. 새 사용자 입력으로 collector나 임의 SQL을 선택하게 하지 않는다.

## 결과·소비선
새 내부 함수 verifyConversationInventoryArtifacts(access,token,value,reader,signal), verifyKnowledgeInventoryArtifacts(동일인자). 요청은 기존 projectId/limits. 각각 실제 collectConversationInventory/collectKnowledgeInventory를 scope.guardedAccess로 호출한다. 외부에서 전달된 inventory·actor·완료결과를 신뢰하지 않는다. 신규 합성시험도 실제 두 수집기를 거치고 원문 reader/DB만 메모리fake를 사용한다.
1. 최초 currentScope.boundary([])·수집·현재 boundary를 같은 최초 scope/최소 세션기한/전체deadline 안에 수행한다. collector 도중 더 짧아진 기한도 guard가 Math.min으로 보존한다.
2. collector별 kind/scope/projectId, artifacts 배열의 정확 닫힌 필드/정렬/중복없음, usage.fileCount/inputBytes 및 유한한도를 대조한다. 원문목록은 artifactId/bytes/contentHash/mediaType/state/inspectionStatus/blobVerification이다. 원 inventory는 수정하지 않고 canonical 전체 hash와 관측 요약을 결박한다.
3. 최초 artifact가 READY+NO_KNOWN_MARKER가 아니면 NOT_VERIFIED/기존고정사유·IO0. 처음 eligible였던 원문이 이후 바뀌거나 읽기/해시/검사에서 실패하면 전체 실패이며 초기skip으로 낮추지 않는다. 같은원문1회만 verify하고 마지막 boundary에서 모든 VERIFIED exact ref를 다시대조한다.
4. 대화는 메시지 자체의 QUARANTINED가 artifact READY와 별개다. 최초 inventory.messages에서 sourceRef/conversationId/serverSequence/message.bodyRef/redactionState의 관계를 수집한다. 같은 body를 가리키는 메시지 중 하나라도 최초QUARANTINED면 그 body 전체를 NOT_VERIFIED/MESSAGE_QUARANTINED로 남겨 IO0. 처음 NOT_REDACTED였던 검증대상의 모든 메시지참조는 IO직전 및 마지막현재RC에서 재대조한다. 지식의 EXCLUDED/SUPERSEDED는 이 필터가 아니며 역사자료검증을 막지 않는다.
5. 대화현재성 SELECT는 scope.guardedAccess.authenticated의 별도 RC에서 OWNER/nonarchived·isolation·clock(기존 guard관측)와 유한statement_timeout을 적용한다. 정확 project_id/메시지ID 최대200묶음, 명시 열 project_id,conversation_id,id,sequence,content_hash,body_artifact_id,message_json,redaction_state만. **body_artifact_id가 실제 열이며 content_artifact_id가 아니다.** SQL측JSON크기제한·조회payload누적metadataBytes 한도를 적용하고 누락/중복/추가row를거절한다.
6. 재조회 snapshot canonical hash와 readConversationInput의 실제형식, conversationId/sequence/sourceHash/body exact ref를 최초관측과대조하고 NOT_REDACTED 유지확인. 이후격리/변조/소실은 전체고정오류로실패. 원문IO중DBclient/transaction보유0, 해당authCOMMIT뒤취소/기한재검사. 최종 모든 VERIFIED body의 처음메시지참조를재검사하되 파일재읽기0. 최초수집후새로생긴모든참조나관측사이모든상태변화를검사했다고주장하지않는다.
7. 원문결과는 기존 CurrentArtifactVerification을 그대로 사용한다. 새kind CONVERSATION_INVENTORY_ARTIFACT_VERIFICATION_V1 / KNOWLEDGE_INVENTORY_ARTIFACT_VERIFICATION_V1, scope는각자료군, inventory관측/hash/metadataComplete/issueCount/externalDependencyCount, artifacts와기존usage를반환한다. 결과UTF8도metadataBytes한도. 원문/지식본문·토큰·actor/client/session·storage경로를결과/오류에담지않는다. atomicSnapshotVerified/fullProjectCoverage/restorable 모두false.

## 오류·회수·변경통제
닫힌 CONVERSATION_INVENTORY/KNOWLEDGE_INVENTORY 오류만 기존scope normalization에 추가한다. AUTH401/NOT_FOUND404/입력400/취소409/한도·기한413/무결성·회수503을구별하고DB원문/cause/stack비밀출력0. 새 collector STORAGE_FAILED는 취소/기한이같이발생해도 회수불명503우선이다. 기존문서/단일오류의동작을바꾸지않는다. 소유query/reader회수는기존계약유지, 무작정재시도·시간연장·상태PASS승격0.
새대화현재성auth도기존pool/auth잠금전체강제상한이있는것처럼주장하지않는다. 미완료query종료전client정상재사용0. 실제 OS reader·DB활성화는이번범위밖이다.

## 필수검증
TEST_ONLY 신규1파일 먼저: 각 live수집→중복원문1회검증 정상; 대화최초메시지격리/원문격리·UNKNOWN IO0; 수집후 IO직전과 최종 메시지/원문상태변경·누락·변조 fail; 다른동일body메시지참조가변하면fail; 지식EXCLUDED 역사검증 유지; 최초/중간 최소세션기한·취소·총한도·DB/reader회수불명·상태강등금지. 기존helper전수시험을복제하지않고새연결반례로한정한다.
Main RED→제품GO, 신규test·npm run typecheck·diff. 공통 normalize/guard를수정한경우에만 직접영향받는 기존 artifact-current-verification17 및 document-inventory-artifact-verification15를함께재검사한다. 완료된collector 자체14/15는수정0이면반복하지않는다. 독립C/I해결후정확파일private게시·WORK_STATUS/결과기록. 실제DB/FS/키/서비스·전체archive/복원·화면인수는NOT_RUN.
