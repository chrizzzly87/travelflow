Parent epic: #480

## Scope

- [x] Add an AI SDK 7 `ToolLoopAgent` orchestrator with an eight-step ceiling.
- [x] Reload canonical trip/thread state server-side rather than trusting browser history.
- [x] Restrict model output to strict typed proposal operations.
- [x] Persist completed, failed, cancelled, and refunded run state without hidden reasoning tokens.
- [x] Apply selected operations through one locked transaction and return the committed version.
- [x] Propagate browser cancellation to the provider while keeping a started request charged.

## Follow-ups

- [ ] Add deterministic fake-Gateway integration fixtures for malformed output, timeout, and fallback cases.
