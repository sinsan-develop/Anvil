export interface PlanDependency { taskCode: string; dependencyTaskCode: string; phase: 'START' | 'ACCEPTANCE' }
export interface DependencyIssue { code: string; location: string; message: string }

export function analyzePlanDependencies(taskCodes: readonly string[], dependencies: readonly PlanDependency[]) {
  const issues:DependencyIssue[]=[], normalized:PlanDependency[]=[], codes=new Set<string>(), seen=new Set<string>(), originalIndexes:number[]=[];
  const issue=(code:string,location:string,message:string)=>issues.push({code,location,message});
  const validCode=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=200&&v.isWellFormed();
  if(!Array.isArray(taskCodes)||!Array.isArray(dependencies)) issue('DEPENDENCY_INPUT_INVALID','tasks','업무 코드와 선행 목록이 필요합니다.');
  else {
    taskCodes.forEach((code,index)=>{
      if(!validCode(code)) issue('TASK_CODE_INVALID',`tasks[${index}].taskCode`,'업무 코드는 유한한 비어 있지 않은 식별자여야 합니다.');
      else if(codes.has(code)) issue('DUPLICATE_TASK_CODE',`tasks[${index}].taskCode`,'같은 계획 버전의 업무 코드가 중복되었습니다.');
      else codes.add(code);
    });
    dependencies.forEach((edge,index)=>{
      const at=`dependencies[${index}]`;
      if(!edge||typeof edge!=='object'||Array.isArray(edge)||Object.keys(edge).sort().join(',')!=='dependencyTaskCode,phase,taskCode'||!validCode(edge.taskCode)||!validCode(edge.dependencyTaskCode)||!['START','ACCEPTANCE'].includes(edge.phase)) { issue('DEPENDENCY_INPUT_INVALID',at,'착수/검수 단계와 정확한 업무 코드만 받습니다.'); return; }
      if(!codes.has(edge.taskCode)||!codes.has(edge.dependencyTaskCode)) { issue('DEPENDENCY_TASK_NOT_FOUND',at,'같은 계획 버전에 없는 업무를 선행으로 연결할 수 없습니다.'); return; }
      if(edge.taskCode===edge.dependencyTaskCode) { issue('SELF_DEPENDENCY',at,'자기 자신을 선행으로 지정할 수 없습니다.'); return; }
      const key=JSON.stringify([edge.taskCode,edge.dependencyTaskCode,edge.phase]);
      if(seen.has(key)) { issue('DUPLICATE_DEPENDENCY',at,'같은 업무·선행·단계의 연결이 중복되었습니다.'); return; }
      seen.add(key); normalized.push({...edge}); originalIndexes.push(index);
    });
    for(const phase of ['START','ACCEPTANCE'] as const) {
      const graph=new Map<string,{to:string;index:number}[]>(), colors=new Map<string,number>();
      for(const code of codes) graph.set(code,[]);
      normalized.forEach((edge,index)=>{if(edge.phase===phase) graph.get(edge.taskCode)!.push({to:edge.dependencyTaskCode,index:originalIndexes[index]!});});
      for(const code of codes) {
        if(colors.has(code)) continue;
        const stack=[{code,next:0}]; colors.set(code,1);
        while(stack.length) {
          const frame=stack[stack.length-1]!, edges=graph.get(frame.code)!;
          if(frame.next>=edges.length) {colors.set(frame.code,2);stack.pop();continue;}
          const edge=edges[frame.next++]!;
          if(colors.get(edge.to)===1) issue('DEPENDENCY_CYCLE',`dependencies[${edge.index}]`,`${phase==='START'?'착수':'검수'} 선행에 순환이 있습니다.`);
          else if(!colors.has(edge.to)) {colors.set(edge.to,1);stack.push({code:edge.to,next:0});}
        }
      }
    }
  }
  return {formatOnly:true as const,readiness:'REFERENCE_AND_PERMISSION_CHECKS_REQUIRED' as const,dependencies:normalized,issues};
}
