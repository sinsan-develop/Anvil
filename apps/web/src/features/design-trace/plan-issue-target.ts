import type{TaskCard}from'../../../../server/modules/traceability/work-plan-card.ts';
const index='(0|[1-9][0-9]{0,4})';
const fields=new Set(['taskCode','title','purpose','ownerRole','rollback','recoveryNotes','inputs','outputs','included','excluded','allowedFileRefs','steps','acceptanceCriteria','evidenceRequirements','designRefs','screenRefs','testCases','startPrerequisites','acceptancePrerequisites']);
/** 원 카드의 선언 순번에만 결박한다. DOM selector/실행·자동 수정으로 쓰지 않는다. */
export function planIssueTaskTarget(tasks:TaskCard[],location:string):number|null{
 if(typeof location!=='string'||location.length>4096)return null;
 const card=new RegExp('^tasks\\['+index+'\\](?:\\.([A-Za-z]+)(?:\\['+index+'\\])?)?$').exec(location);
 if(card){const n=Number(card[1]),field=card[2],sub=card[3],task=tasks[n];if(!task||field&&!fields.has(field))return null;if(sub!==undefined){if(field!=='testCases'||Number(sub)>=task.testCases.length)return null;}return n;}
 const dep=new RegExp('^dependencies\\['+index+'\\]$').exec(location);if(!dep)return null;let remaining=Number(dep[1]);
 for(let n=0;n<tasks.length;n++){const length=tasks[n]!.startPrerequisites.length+tasks[n]!.acceptancePrerequisites.length;if(remaining<length)return n;remaining-=length;}return null;
}
