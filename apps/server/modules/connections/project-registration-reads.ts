import {AuthFailure} from '../access/repository.ts';

export function readTrustListQuery(query:Record<string,unknown>){
 if(Object.keys(query).some(k=>!['limit','cursor'].includes(k))||query.limit!==undefined&&(typeof query.limit!=='string'||!/^[1-9][0-9]{0,2}$/.test(query.limit)||Number(query.limit)>200)||query.cursor!==undefined&&(typeof query.cursor!=='string'||!query.cursor||query.cursor.length>4096))throw new AuthFailure('INPUT_INVALID',400);
 return{limit:query.limit===undefined?50:Number(query.limit),cursor:query.cursor===undefined?null:query.cursor as string};
}
export function trustScopeProjection(scope:any){
 return{kind:scope.kind,installationId:scope.installationId,projectId:scope.projectId,subject:{kind:scope.subject.kind,userId:scope.subject.userId,clientId:scope.subject.clientId,credentialGeneration:scope.subject.credentialGeneration,controlGeneration:scope.subject.controlGeneration},policyRef:{id:scope.policyRef.id,version:scope.policyRef.version,contentHash:scope.policyRef.contentHash},expectedHostFingerprint:scope.expectedHostFingerprint,hostLabel:scope.hostLabel,expiresAt:scope.expiresAt,credentialScope:scope.credentialScope,grants:[]};
}
