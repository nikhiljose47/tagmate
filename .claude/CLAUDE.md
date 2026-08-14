## Execution style

Prefer the simplest possible approach.

For small or clearly scoped requests:
- Do not spawn subagents.
- Do not create plans unless the task genuinely requires multiple steps.
- Do not explore unrelated files.
- Do not run broad searches across the repository.
- Do not refactor unrelated code.
- Do not run tests, lint, builds, or validation unless needed for the requested change.
- Make the smallest targeted change that satisfies the request.
- Read only the files necessary to perform the task.
- Do not perform additional improvements unless explicitly requested.

Use subagents only when the task is genuinely large, parallelizable, or requires specialized independent investigation.

For simple edits, perform the edit directly and respond concisely.