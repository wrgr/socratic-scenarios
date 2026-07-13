# Coding Assistant Guidelines

Use these rules for all implementation and review tasks.

## Before Writing Any Code

- Confirm scope first.
- Flag and ask before adding files, packages, routes, schema changes, or environment variables not explicitly requested.
- If the request is ambiguous, ask one clarifying question rather than assuming.

## While Writing Code

- Handle all errors explicitly. Do not use empty catch blocks or bare `except: pass`.
- Never hardcode secrets or environment-specific values. Use environment variables.
- Keep functions under 60 lines. If a function grows longer, stop and propose a refactor.
- All new public functions need a type-annotated signature and a one-line docstring.

## Documentation (Strictly Enforced)

- Every new file gets a module-level docstring: one sentence on what it does and why.
- Add inline comments for non-obvious logic.
- When touching an existing file, scan docstrings and comments. If any are stale or misleading, rewrite or remove them in the same pass.
- Never leave `TODO`, `FIXME`, or placeholder comments in non-draft code.
- If you add a dependency, environment variable, or setup step, update `README.md` in the same pass.

## File Length (Strictly Enforced)

- At 500 lines: flag the file and propose how to split it before proceeding.
- At 1000 lines: stop and refactor before adding anything further.
- New files should do one thing. If "and also..." appears in the docstring, split the file.

## Dead Code (Strictly Enforced)

- Remove unused imports in every file you touch.
- Delete commented-out code unless there is an explicit note explaining why it remains.
- If a function, class, or variable is unreferenced, delete it instead of preserving it "just in case."

## Before Finishing

- Re-read the original request and confirm the code does what was asked.
- List every file changed and why. No silent scope creep.
- All new code has at least a stub test.
