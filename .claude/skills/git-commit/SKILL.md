---
name: git-commit
description: Use when user requests commit.
allowed-tools: Bash(bash ${CLAUDE_SKILL_DIR}/scripts/*)
---

### Commit Target

The commit target below is collected by shell, not by the conversation context. Use only this output.

```
!`bash ${CLAUDE_SKILL_DIR}/scripts/collect-staged.sh`
```

- If there is nothing to commit, tell the user and stop.
- If there are staged changes, the commit target is the staged changes only. Otherwise, the commit target is all changes (they are staged by the commit script).
- Do not run `git add`, `git reset`, `git restore`, or any other command that changes the stage area.
- Do not refer to the conversation history to decide the commit target.

### Commit Message Rules

- Determine the commit type from the Commit Target Diff above: `fix`, `feat`, `refactor`, `docs`, `chore`, `style`, `test`, etc.
- After determining the type, read only the template matching the type, and fill it:
  - `fix` → read `${CLAUDE_SKILL_DIR}/templates/bugfix-template.md`
  - `feat` → read `${CLAUDE_SKILL_DIR}/templates/feature-template.md`
  - Other types → read the feature template and use the same shape, with `feat` replaced by the actual type (e.g. `refactor: {message}`).
- `{message}` should be a concise, single-line summary of the change, written in English.
- For the bugfix template, fill `Issue` / `Cause` / `Solve` based only on what the diff actually shows. Do not fabricate details that aren't evidenced by the change.
- Do not interpret the Markdown. Wrap the generated commit message in a code block when showing it to the user.

### Commit Execution Rules

- Commit only via the script below, passing the generated message via heredoc. Never run `git commit` directly.

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/commit.sh <<'EOF'
{generated commit message}
EOF
```

- If the commit script fails (e.g. a hook fails), show its output to the user and stop. Do not fix files, retry, use `--no-verify`, or change the stage area.
- Do not add a `Co-Authored-By: Claude` trailer or any other Claude authorship line to the commit message.
- Always create a new commit. Never amend an existing commit unless explicitly requested.
- One user request creates exactly one commit.
