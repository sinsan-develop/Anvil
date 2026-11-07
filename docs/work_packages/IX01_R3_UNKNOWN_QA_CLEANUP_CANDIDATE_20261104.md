# IX01 R3 UNKNOWN 신규 QA 정리만 실행 후보

2026-11-04 · 미승인 / 실제실행금지

부모R3단발승인뒤ROLE_PRISTINE에서UNKNOWN이발생했다. 재시도/자동삭제0. Main은2aebf0/eeea55읽기전용소유검산으로새PG1·source1잔여를확인했다. 이번후보는그정리만이며SQL진단재실행이아니다.

## 정확대상
- WSL-server/daonUID1000/SINSAN,daemon e3349f1d-dbfc-478a-96d9-295bf6c6839e.
- fullID dda0ac772e0618ad143a7aedcb3a4a92c6354f7389d3f8e7e3635fa3c59250ec /name anvil-ix01-ddl-pg-20261104-r3-a1.
- image sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f;labels anvil.owner=IX01_DDL_20261104_R3,anvil.instance=fc59c4e8d1f0a56c909ed219fee5e7c0,anvil.plan=a4c40e6a3c425acc94321511ad3950b24dc6aadf6fdec6899644e1660bad19d9.
- source /home/daon/anvil-ix01-ddl-20261104-r3-qa. UID1000/nonlink/realpath/exactfc59c4e8d1f0a56c909ed219fee5e7c0f86ba528/clean/driver12459DF3·indexD6B4B8AB/사용cwd0을 검산한다.
- 감사root /home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261104-r3 는보존하며삭제하지않는다. 원장3/메타데이터사본·실패기록도보존한다.

## 직접승인후순서·한도
새승인수신후30분안에한번만수행한다. 원의도/결과·ownerhash/fullID/daemon/label/image/격리·source소유·사용프로세스를재검산한다. 기존PKI/DB/계정/Secret조회나변경없이Dockermetadata만쓴다. 정확fullID에만stop --time5를최대1회(5초뒤SIGKILL될수있음),반환·state를확인하고같은ID/name/image/label로정지확인된것만rm1회한다. 응답/종료불명·신원변경시추가신호/rm/재시도0·보존보고. 이미부재면해당단계mutation0/별도부재증거만남긴다. 이름만으로대체컨테이너채택/다른PG일괄정리0.

신규source는소유/realpath/link/정확Git/clean/사용프로세스0를재검산한경우등록literal폴더만제거한다. 삭제전대상절대경로가정확source인지확인하고다른경로/공유parent를삭제하지않는다. 불명은source도보존한다. 이후별도fullID/name/source부재조회와비밀없는정리영수증을보존한다.

DB접속/SQL/role조회·권한회수/새PG/재실행/키/서비스/실자료/Agent/P03R3/Oracle/ysna/기존DB변경0. 새QA의tmpfs내용은종료·제거로 소실된다. 기존 데이터에는 영향을 주지 않으며, 불명일 때는 기한 뒤에도 자원이 남을 수 있다.
