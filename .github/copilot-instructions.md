
# Copilot Agent Instructions

## Autonomous Development
- Work autonomously until the requested task is fully implemented.
- Do not ask me to approve every routine command individually when the environment already permits it.
- Inspect the existing workspace before making changes.
- Execute necessary setup, implementation, testing, linting, type-checking, and build commands.
- Install required dependencies when needed and permitted.
- If a command is denied by the environment, use an allowed alternative or clearly explain the blocker.
- Do not stop after generating a plan; implement the solution.

## Safety
- Never delete user data or overwrite unrelated files without explicit approval.
- Never expose, print, commit, or transmit secrets.
- Do not run destructive database operations against production.
- Ask before deploying, pushing commits, changing external services, or performing irreversible actions.
- Review errors and fix implementation issues before finishing.

## Completion Report
- Summarize what was implemented.
- List commands executed and their results.
- Report tests, lint, type-check, and build status.
- Mention anything that remains incomplete.
