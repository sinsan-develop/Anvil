import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AuthFailure } from '../access/repository.ts';
import type { AccessRoutesOptions } from '../access/routes.ts';
import { ProjectsRepository } from './repository.ts';
import type { DraftCreate, DraftSave, ProjectCreate } from './repository.ts';
import type { DraftOperation } from './draft-review.ts';
import { ProjectPolicyRepository, type ProjectCommand } from '../access/project-command.ts';
import { ProjectDocuments, registerProjectDocumentReads } from '../documents/project-documents.ts';
import { parseWireJson } from '../../../../contracts/canonical.ts';
import { ProjectDesignIndex } from '../traceability/design-index.ts';

const idSchema = { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' };
const inputProperties = { name: { type: 'string', maxLength: 2 * 1024 * 1024 }, purpose: { type: 'string', maxLength: 2 * 1024 * 1024 }, desiredOutcome: { type: 'string', maxLength: 2 * 1024 * 1024 }, sourceMode: { enum: ['EMPTY', 'EXISTING'] }, methodologySelection: { type: ['object', 'null'] }, artifactRefs: { type: 'array', maxItems: 200 }, sourceDeclaration: { type: 'object' } };
function object(properties: Record<string, unknown>, required = Object.keys(properties)) { return { type: 'object', properties, required, additionalProperties: false }; }
function csrf(request: FastifyRequest) { const value = request.headers['x-anvil-csrf']; if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new AuthFailure('CSRF_INVALID', 403); return value; }

function token(request: FastifyRequest): string {
  const cookies = (request.headers.cookie ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith('__Host-anvil.sid='));
  return cookies.length === 1 ? cookies[0]!.slice('__Host-anvil.sid='.length) : '';
}
export function registerProjectRoutes(app: FastifyInstance, options: AccessRoutesOptions) {
  const repository = new ProjectsRepository(options.repository), policies = new ProjectPolicyRepository(options.repository), documents = new ProjectDocuments(options.artifactRoot), host = new URL(options.origin).host;
  const designIndex=new ProjectDesignIndex(documents);
  registerProjectDocumentReads(app, options, documents);
  app.register(async projects => {
    projects.removeContentTypeParser('application/json');
    projects.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, raw, done) => { try { done(null, parseWireJson(String(raw))); } catch { done(Object.assign(Error('INPUT_INVALID'), { statusCode: 400 }), undefined); } });
    projects.addHook('onRequest', async request => {
      if (request.headers.host !== host || request.method !== 'GET' && (request.headers.origin !== options.origin || !/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? ''))) throw new AuthFailure('ORIGIN_INVALID', 403);
    });
    projects.get<{ Querystring: Record<string, unknown> }>('/api/v1/projects', request => repository.list(token(request), request.query));
    projects.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId/permission-policy', { schema: { params: object({ projectId: idSchema }) } }, request => policies.read(token(request), request.params.projectId));
    projects.get<{Params:{projectId:string};Querystring:{documentId:string;version:string}}>('/api/v1/projects/:projectId/design-index',{schema:{params:object({projectId:idSchema}),querystring:object({documentId:idSchema,version:{type:'string',pattern:'^[1-9][0-9]{0,14}$'}})}},request=>options.repository.authenticated(token(request),null,(db,actor)=>designIndex.read(db,actor,request.params.projectId,request.query.documentId,Number(request.query.version))));
    projects.post<{ Params: { projectId: string }; Body: ProjectCommand }>('/api/v1/projects/:projectId/commands', { schema: { params: object({ projectId: idSchema }), body: object({ schemaVersion: { const: 1 }, projectId: idSchema, commandId: idSchema, clientId: idSchema, controlGeneration: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER }, operation: { enum: ['savePermissionPolicy', 'saveDocumentDraft', 'recordContentReview', 'confirmDocument', 'importDocument', 'proposeDocumentChange', 'indexDesignDocument'] }, targetId: { anyOf: [idSchema, { type: 'null' }] }, expectedVersion: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER }, baselineRefs: { type: 'array', maxItems: 200 }, approvalRef: { type: ['object', 'null'] }, payload: { type: 'object' } }) } }, request => {
      if (request.params.projectId !== request.body.projectId || request.headers['idempotency-key'] !== undefined && request.headers['idempotency-key'] !== request.body.commandId) throw new AuthFailure('INPUT_INVALID', 400);
      return policies.command(token(request), csrf(request), request.body, request.body.operation === 'saveDocumentDraft' ? (db, actor, policyRef) => documents.save(db, actor, request.body, policyRef) : request.body.operation === 'recordContentReview' ? (db, actor, policyRef) => documents.review(db, actor, request.body, policyRef) : request.body.operation === 'confirmDocument' ? (db, actor, policyRef) => documents.confirm(db, actor, request.body, policyRef) : request.body.operation === 'importDocument' ? (db, actor, policyRef) => documents.import(db, actor, request.body, policyRef) : request.body.operation === 'proposeDocumentChange' ? (db, actor, policyRef) => documents.propose(db, actor, request.body, policyRef) : request.body.operation === 'indexDesignDocument' ? (db,actor,policyRef)=>designIndex.write(db,actor,request.body,policyRef) : undefined);
    });
    projects.post<{ Body: ProjectCreate }>('/api/v1/projects', { schema: { body: object({ schemaVersion: { const: 1 }, commandId: idSchema, clientId: idSchema, draftId: idSchema, draftVersion: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER } }) } }, async (request, reply) => reply.code(201).send(await repository.createProject(token(request), csrf(request), request.body)));
    projects.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId', { schema: { params: { type: 'object', properties: { projectId: { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' } }, required: ['projectId'], additionalProperties: false } } }, request => repository.detail(token(request), request.params.projectId));
    projects.get<{ Params: { draftId: string } }>('/api/v1/project-drafts/:draftId', { schema: { params: object({ draftId: idSchema }) } }, request => repository.getDraft(token(request), request.params.draftId));
    projects.post<{ Params: { draftId: string }; Body: DraftOperation }>('/api/v1/project-drafts/:draftId/commands', { schema: { params: object({ draftId: idSchema }), body: object({ schemaVersion: { const: 1 }, commandId: idSchema, clientId: idSchema, targetId: idSchema, expectedVersion: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER }, operation: { enum: ['recordContentReview', 'confirmDraftMethodology'] }, payload: { type: 'object' } }) } }, request => repository.draftOperation(token(request), csrf(request), request.params.draftId, request.body));
    projects.post<{ Body: DraftCreate }>('/api/v1/project-drafts', { schema: { body: object({ schemaVersion: { const: 1 }, commandId: idSchema, clientId: idSchema, targetId: { type: 'null' }, expectedVersion: { const: 0 }, ...inputProperties }, ['schemaVersion', 'commandId', 'clientId', 'targetId', 'expectedVersion', 'name', 'purpose', 'desiredOutcome', 'sourceMode']) } }, async (request, reply) => reply.code(201).send(await repository.createDraft(token(request), csrf(request), request.body)));
    projects.patch<{ Params: { draftId: string }; Body: DraftSave }>('/api/v1/project-drafts/:draftId', { schema: { params: object({ draftId: idSchema }), body: object({ schemaVersion: { const: 1 }, commandId: idSchema, clientId: idSchema, expectedVersion: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER }, step: { type: 'integer', minimum: 1, maximum: 4 }, input: object(inputProperties, ['name', 'purpose', 'desiredOutcome', 'sourceMode', 'methodologySelection', 'artifactRefs']) }) } }, request => repository.saveDraft(token(request), csrf(request), request.params.draftId, request.body));
  });
}
