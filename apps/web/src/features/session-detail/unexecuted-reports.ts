import {inspectReportedTests} from './reported-tests.ts';
export interface UnexecutedReport{criterionId:string;testId:string;reason:string}
const code=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(v);
function valid(v:any):v is UnexecutedReport{return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')==='criterionId,reason,testId'&&code(v.criterionId)&&code(v.testId)&&typeof v.reason==='string'&&!!v.reason.trim()&&v.reason.length<=20000&&v.reason.isWellFormed();}
/** 원 제출자의 미실행/시험 보고 표시 관계만 만든다. 시점·출처 진위·실수행·모순/합격을 판정하지 않는다. */
export function inspectUnexecutedReports(raw:unknown,tests:unknown){
 const reported=inspectReportedTests(tests),testReportsIncomplete=reported.listInvalid||reported.invalidIndices.length>0;
 const rows:{index:number;value:UnexecutedReport;testReports:typeof reported.rows}[]=[],invalidIndices:number[]=[];
 if(!Array.isArray(raw)||raw.length>200)return{rows,invalidIndices,listInvalid:true,testReportsIncomplete};
 raw.forEach((value,index)=>{if(!valid(value)){invalidIndices.push(index);return;}rows.push({index,value:structuredClone(value),testReports:reported.rows.filter(r=>r.value.criterionId===value.criterionId&&r.value.testId===value.testId)});});
 return{rows,invalidIndices,listInvalid:false,testReportsIncomplete};
}
