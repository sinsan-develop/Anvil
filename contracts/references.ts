import { readFileSync } from 'node:fs';
import { Ajv } from 'ajv';
import type { VersionRef } from './generated-types.ts';

const schema = JSON.parse(readFileSync(new URL('./common/refs.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv({ strict: true, allErrors: false }).compile(schema);
export function isVersionRef(value: unknown): value is VersionRef { return validate(value) === true; }
