# C-02 Start Projection Validation

- seq1~728 raw event object bytes: preserved
- seq729~731 lease/write/package start order and hash chain: validated
- WorkInstruction/invocation/design/work-plan hashes: exact
- worker/write lease IDs, epoch, fencing tokens and product path scope: exact
- exact10 staged at control HEAD or clean sole direct-child commit only
- missing/extra/dirty paths, wrong branch/upstream/base, non-direct child and malformed Git collection: rejected
- Provider/Telegram: `USER_OWNED_NOT_EXECUTED`
