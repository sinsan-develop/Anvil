import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';

export const officialFormsSourceHash = '622ffc6db4ccc26ae07c785c91b114467019b21571b728a71dea05d206816b13';
export const authoringStandardSourceHash = '85ec190976ce45af49b4f57fb5745d193b41640cfc62f5cbd19aa4711cb03f07';

export interface FormField { fieldId: string; title: string; required: boolean; valueType: 'TEXT' }
export interface FormItem {
  itemId: string; title: string; required: boolean; valueType: 'TEXT' | 'RECORDS';
  repeated: boolean; fields: FormField[]; authoringRules: string[]; reviewCriteria: string[];
}
export interface FormDefinition {
  formCode: string; name: string; purpose: string; scope: 'SYSTEM' | 'USER_COMMON' | 'PROJECT';
  authorRole: string; reviewerRole: string; confirmerRole: string;
  requiredInputs: string[]; items: FormItem[]; authoringStandardRef: VersionRef;
}
export interface OfficialForm { ref: VersionRef; definition: FormDefinition }
export interface OfficialCatalog {
  forms: OfficialForm[];
  standard: { ref: VersionRef; body: Buffer };
  sourceHash: string;
}

const names = ['요구사항정의서', '설계서', '화면시안', '작업계획서', '테스트계획서', '테스트 결과서', '작업진행상황', '개발환경 정의서'];
// 반복 행의 필드는 승인 목차의 항목을 표현한다. 실행 코드를 담는 스키마가 아니다.
const repeatFields: Record<string, string[]> = {
  'AF01-03': ['R ID', '제목', '상세 요구', '출처·이유', '우선순위', '기능/비기능 구분', '관련 요구'],
  'AF02-02': ['D ID', '입력', '검사', '처리', '영속', '출력', '상태·오류', '의존'],
  'AF02-03': ['S ID', '화면 목적', '필드·버튼·동작', '진입·이탈', '상태', 'AF03 렌더 자료'],
  'AF03-03': ['위치/요소 ID', '표시 값·입력 조건', '동작 결과', '저장·조회 연산', '비활성 사유'],
  'AF03-05': ['화면 위치', 'D ID', '화면 업무', '기능 업무', '연결 업무', '시험 참조'],
  'AF04-02': ['업무 ID', 'D/S 위치', '사용자 조작', '상태', '기능 소비 계약'],
  'AF04-03': ['업무 ID', '처리', '저장', '조회', '권한', '인터페이스', '실패 규칙'],
  'AF04-04': ['연결 업무 ID', '화면', '실제 처리', '저장·조회', 'Agent 결과', '연결 확인'],
  'AF04-05': ['업무 ID', '이유·책임', '선행·후속', '입력·출력', '허용 파일·제외', '완료 조건', '시험·검수·증거', 'rollback'],
  'AF05-03': ['TC ID', 'D/업무 ID', '전제', '입력', '정상·중요 실패 조건'],
  'AF05-04': ['TC ID', '재현 동작·명령', '관측 위치', '기대 결과'],
  'AF06-03': ['TC ID', '예상', '실제', '실행 상태', '재현 절차'],
  'AF06-04': ['TC ID', '정확 명령', 'exit', '증거 참조'],
  'AF07-02': ['단계 ID', '목표', '상태', '남은 조건', '증거'],
  'AF07-03': ['업무 ID', '담당', '시작·종료', '현재 지점', '구현·확인 상태', '다음'],
  'AF07-04': ['일시', '변경 파일', '명령·exit', '결과', '오류 식별·횟수', '원인·조치·인수'],
  'AF08-01': ['환경', '역할', '소유·담당'],
  'AF08-03': ['도구', '버전·설치 근거', 'cwd', '실행·검증 명령', '기대 결과'],
};

export function buildOfficialForms(source: Buffer, standard: Buffer): OfficialCatalog {
  if (contentHash(source) !== officialFormsSourceHash) throw new Error('CATALOG_SOURCE_NOT_APPROVED');
  if (contentHash(standard) !== authoringStandardSourceHash) throw new Error('AUTHORING_STANDARD_SOURCE_CHANGED');
  const standardRef: VersionRef = {
    id: 'a6f30000-0000-4000-8000-000000000100', version: 1, contentHash: authoringStandardSourceHash,
  };
  const sections = [...source.toString('utf8').matchAll(/^### (AF0[1-8]) (.+)\r?\n([\s\S]*?)(?=^### |^## |$(?![\s\S]))/gm)];
  if (sections.length !== 8) throw new Error('CATALOG_STRUCTURE_INVALID');
  const forms = sections.map((section, index): OfficialForm => {
    const code = `AF0${index + 1}`;
    if (section[1] !== code || section[2] !== names[index]) throw new Error('CATALOG_STRUCTURE_INVALID');
    const rows = [...section[3]!.matchAll(/^([1-6])\. \*\*(.+?):\*\* (.+)\r?$/gm)];
    if (rows.length !== 6) throw new Error('CATALOG_STRUCTURE_INVALID');
    const items = rows.map((row, position): FormItem => {
      if (Number(row[1]) !== position + 1) throw new Error('CATALOG_STRUCTURE_INVALID');
      const itemId = `${code}-${String(position + 1).padStart(2, '0')}`;
      const fields = (repeatFields[itemId] ?? []).map((title, i): FormField => ({
        fieldId: `${itemId}-F${String(i + 1).padStart(2, '0')}`, title, required: true, valueType: 'TEXT',
      }));
      return {
        itemId, title: row[2]!, required: true, valueType: fields.length ? 'RECORDS' : 'TEXT',
        repeated: fields.length > 0, fields, authoringRules: [row[3]!],
        reviewCriteria: [`「${row[2]}」의 작성 규칙을 원문·증거와 대조한다.`,
          '미확인·미실행·예시를 실제 완료나 사용자 합의로 판정하지 않는다.'],
      };
    });
    const definition: FormDefinition = {
      formCode: code, name: names[index]!, purpose: items[0]!.authoringRules[0]!, scope: 'SYSTEM',
      authorRole: 'USER_OR_STAGE_OWNER', reviewerRole: 'USER_OR_REVIEWER', confirmerRole: 'USER',
      requiredInputs: ['프로젝트 목적·헌법·최신 지시', '적용 방법론·단계·양식의 고정 버전', '입력 원문·출처·관련 요구/설계/업무/시험', '문서 작성 공통 기준의 고정 버전'],
      items, authoringStandardRef: standardRef,
    };
    return { ref: { id: `a6f30000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, version: 1,
      contentHash: contentHash(canonicalJson(definition)) }, definition };
  });
  return { forms, standard: { ref: standardRef, body: Buffer.from(standard) }, sourceHash: officialFormsSourceHash };
}
