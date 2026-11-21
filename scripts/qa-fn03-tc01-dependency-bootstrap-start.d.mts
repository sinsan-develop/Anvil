/** The fixed runtime checks the startup ports and each untrusted packet before loading. */
export declare function createTc01DependencyBootstrapStart(startup: unknown): Readonly<{
  run(value: unknown): Promise<string | {
    readonly status: 'UNKNOWN';
    readonly code: 'DEPENDENCY_BOOTSTRAP_UNKNOWN';
    readonly authority: 'NOT_ISSUED';
  }>;
}>;
