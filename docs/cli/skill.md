# skill

`gensane skill add` adds the gensane skill to a site: instructions, in the open [Agent Skills](https://agentskills.io/) format, that
teach coding agents such as Claude Code, Codex, Copilot, Cursor or Gemini CLI how a gensane site works. An agent reads it when a task
is about the site, and then knows the folders, the fields of each kind of content, the commands, how to read a problem and fix it,
and to run `gensane check` before it says it is done.

<!-- runs -->
```console
$ gensane skill add
Added the gensane skill for coding agents:
  .agents/skills/gensane/  read by Codex, Copilot, Cursor, Gemini CLI and others
  .claude/skills/gensane/  read by Claude Code
```

```text files .claude/skills/gensane
SKILL.md
references/config.md
references/content-types.md
references/problems.md
references/templates.md
```

The two folders have the same files, as copies, because links between folders break on Windows. Most agents read
`.agents/skills/`; Claude Code reads `.claude/skills/`. Commit them with the site, so the agents of everyone working on it have them.

[`gensane init`](init.md) asks whether to add the skill to a new site, and adds it unless the answer is no.

## After an update

The skill ships with gensane, so it describes the version the site uses. After updating gensane, run the command again: it replaces
the skill with the new version's, and leaves any other skill in those folders alone.

<!-- runs -->
```console
$ gensane skill add
Added the gensane skill for coding agents:
  .agents/skills/gensane/  read by Codex, Copilot, Cursor, Gemini CLI and others
  .claude/skills/gensane/  read by Claude Code
```

```console
$ gensane skill add
Updated the gensane skill for coding agents:
  .agents/skills/gensane/  read by Codex, Copilot, Cursor, Gemini CLI and others
  .claude/skills/gensane/  read by Claude Code
```

## Arguments

<!-- runs -->
```console
$ gensane skill --help
Usage: gensane skill add [arguments]

Add the gensane skill for AI coding agents to the site.

It teaches coding agents how a gensane site works. Run it again after updating gensane, to update the skill.

Arguments:
  -h, --help  Show this help
```
