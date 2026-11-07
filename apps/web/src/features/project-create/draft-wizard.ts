import type {DraftEditorState} from './api.ts';

const validStep=(value:unknown):value is number=>typeof value==='number'&&Number.isInteger(value)&&value>=1&&value<=4;
/** 같은 미확인 저장 명령의 단계가 우선이다. 입력/명령을 바꾸거나 서버로 전송하지 않는다. */
export function draftWizardStep(buffer:DraftEditorState):number{
 const pending=buffer.pendingCommand?.body.step;
 return validStep(pending)?pending:validStep(buffer.wizardStep)?buffer.wizardStep:1;
}
export function moveDraftWizardStep(buffer:DraftEditorState,userId:string,target:number,busy:boolean,editable:boolean):DraftEditorState|null{
 const current=draftWizardStep(buffer);
 if(!validStep(target)||Math.abs(target-current)!==1||busy||buffer.upload||buffer.pendingCommand||buffer.pendingAction||buffer.ownerUserId&&buffer.ownerUserId!==userId)return null;
 if(target>current&&(!editable||!buffer.draftId||buffer.dirty))return null;
 return {...buffer,wizardStep:target};
}
