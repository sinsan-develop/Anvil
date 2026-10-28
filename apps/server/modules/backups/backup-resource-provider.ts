import type {BackupReferenceKind} from '../../../../contracts/runtime/backup-references-v1.ts';
/** 실제 설치 공급자가 아직 연결되지 않았다. 임의 path/key/UUID를 descriptor로 합성하지 않는다. */
export class UnconfiguredBackupResourceProvider {
 readonly state='UNCONFIGURED' as const;
 list(_projectId:string,_kind:BackupReferenceKind):readonly never[]{return [];}
 read(_projectId:string,_id:string,_version:number):null{return null;}
}
