# 第三方内容声明

本包（@local/pstack-dsh）是个人移植项目，不隶属于 Cursor 或 DeepSeek。

## pstack（`pstack/skills/`、`pstack/docs/guide/`、`pstack/automations/benny/`、`pstack/README.md`、`pstack/LICENSE`）

- 来源：https://github.com/cursor/plugins/tree/main/pstack
- 版本：0.15.48
- 许可：MIT，Copyright (c) Lauren Tan
- 移植方式：`scripts/generate.mjs` 从本地镜像仓库复制生成。除注入的 DSH 适配行（技能 H1 后）、DSH 覆盖说明（每篇指南、上游 README 与 benny README 的 H1 后）以及越界链接改写外，上游正文保持原文。
- 例外：`pstack/skills/setup-pstack/SKILL.md` 由本仓库 `overrides/` 中的 DSH 原生正文整体替换；上游的 `pstack/agents/*.md` 未被复制，见下。

## deslop / control-ui / control-cli（`pstack/skills/` 内的 3 个 vendored 技能）

- 来源：https://github.com/cursor/plugins/tree/main/cursor-team-kit
- 许可：MIT（上游仓库 LICENSE）
- 移植方式：整目录复制，frontmatter 追加 `disable-model-invocation: true`。上游面向 Cursor 自动触发，在 DSH 中改为仅手动 `/name` 调用。

## `pstack/agents/`、`docs/harness/dsh.md`、`docs/DETAIL.md`、`docs/porting.md`

- 本仓库原创内容，许可见根 `LICENSE`（MIT）。
- `pstack/agents/poteto-agent.md`、`pstack/agents/comment-sicko.md` 是 DSH 版说明文件，不是上游 agent 定义文件的副本。上游文件含 Cursor 模型 slug 与 `~/.cursor/plugins/` 搜索逻辑，在本移植中由 `cordis.patch.yml` 的两个 Agent Preset 取代。

## DeepSeek Harness（`cordis.patch.yml` 引用的所有 `@deepseek-ai/*` 插件）

- 来源：随 DSH 发行，本包不含其代码，仅在 patch 中声明挂载。
