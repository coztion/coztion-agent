# coztion-agent

## Plugins

| Plugin | Description |
|---|---|
| `todo-pane` | Keeps a to-do list pinned in a pane beside the conversation |
| `git-commit` | Skill for writing commits |
| `write-pull-request` | Skill for writing pull requests |

## Installation

You can install the plugins straight from Claude Code without cloning this repo.

1. Add the marketplace

   ```
   /plugin marketplace add coztion/coztion-agent
   ```

2. Install the plugins

   ```
   /plugin install todo-pane@coztion-agent
   /plugin install git-commit@coztion-agent
   /plugin install write-pull-request@coztion-agent
   ```

3. Restart Claude Code

### Update

```
/plugin marketplace update coztion-agent
```

### Note

- If the repo is private, you need GitHub authentication (`gh auth login` or an SSH key).
