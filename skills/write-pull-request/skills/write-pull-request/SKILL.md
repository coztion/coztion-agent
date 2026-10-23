---
name: write-pull-request
description: Use when user requests to generate a pull request.
allowed-tools: Bash(bash ${CLAUDE_SKILL_DIR}/scripts/*)
---

### Pull Request Target

The pull request target below is collected by shell, not by the conversation context. Use only this output.

```
!`bash ${CLAUDE_SKILL_DIR}/scripts/collect-diff.sh`
```

- The target is the difference between the remote `develop` branch and the current branch.
- If the user requests a different base branch, run the script below with that branch and use its output instead.

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/collect-diff.sh {base branch}
```

- Do not refer to the conversation history or commit history to decide the pull request content.

### Pull Request Generation Rules

- Generate pull request contents.
- Follow @.claude/skills/write-pull-request/templates/pull-request-template.md and fill braces with contents following:
  - Title should summarize the major changes of the pull request. (Do not include commit type)
  - Description should show details about the pull request.
  - Changes should show each change's.
- Do not create a file or request to create a PR. Just show the plain text.
- Do not interpret the Markdown. Wrap the entire output in a code block to prevent Markdown rendering.
- Write a pull request content in Korean.
- Do not add a `Generated with Claude Code` line or any other Claude authorship line to the pull request content.

### After Generation

- After showing the output, copy the same content (title on the first line, followed by a blank line, then the PR template content) to the clipboard only via the script below, passing the content via heredoc.

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/copy-clipboard.sh <<'EOF'
{generated pull request content}
EOF
```
