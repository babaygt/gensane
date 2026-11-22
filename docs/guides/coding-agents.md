# Working with coding agents

Coding agents such as Claude Code, Codex, GitHub Copilot, Cursor and Gemini CLI can write posts, change the config or the theme,
and fix the problems gensane reports. They do it much better when they know how a gensane site works, and gensane gives them two
things for that: a **skill** in the site, and its **documentation as plain text** on gensane.dev.

## The skill

A skill is a folder of instructions an agent reads when a task needs it, in the open [Agent Skills](https://agentskills.io/) format.
gensane's skill tells an agent:

- the folders of a site, and how a file's name becomes its address;
- the commands, and to run `gensane check` after every change, and fix what it prints before saying it is done;
- how to read a problem: its code, its file and line, and its hint;
- each kind of content with its fields, the settings people change first, how to change one part of the theme, and how to publish;
- where to look up the rest: every field, setting, template variable and problem code, in files next to it.

It ships with gensane, so it always describes the version your site uses, and gensane's tests check that everything it names exists.

## Adding it

A new site has it already: [`gensane init`](../cli/init.md) asks, and adds it unless you answer no. For a site made before, or after
updating gensane:

```sh
npx gensane skill add
```

It writes the skill into `.agents/skills/gensane/`, which Codex, Copilot, Cursor, Gemini CLI and most other agents read, and
`.claude/skills/gensane/`, which Claude Code reads. Commit both with the site, so everyone working on it has them.
[skill](../cli/skill.md) shows what it prints.

### With the skills command

The `skills` command installs skills from a GitHub repository for many agents at once, and can install for every project of yours
instead of one:

```sh
npx skills add babaygt/gensane
```

It asks which agents to install for, and needs Node.js 22.20 or newer. `-g` installs for your user instead of the project. This
takes the skill from gensane's repository as it is now, which may be newer than the gensane your site uses; `gensane skill add` takes
the one of your version.

### In Gemini CLI

```sh
gemini skills install https://github.com/babaygt/gensane.git --path skills/gensane
```

## The documentation, for agents

[gensane.dev/llms.txt](https://gensane.dev/llms.txt) lists every page of this documentation, and each page has a plain Markdown copy
at its address with `index.md` added, such as
[gensane.dev/docs/start/tutorial/index.md](https://gensane.dev/docs/start/tutorial/index.md). An agent that can read web pages can
look anything up there; the skill tells it so.

Your own site can have the same: [`llms: true`](../cli/config.md#llms) in its config writes `llms.txt` and the Markdown copies.

## Asking an agent

With the skill in the site, ask as you would ask a person:

- "Write a post about why I write tests first, from these notes."
- "Add my new project, tiny-calc, with its repository, and feature it on the home page."
- "Fix the problems `gensane check` prints."
- "Show only the title and the event of each talk."

The agent should end by running `npx gensane check`. If it says it is done without having run it, ask it to.
