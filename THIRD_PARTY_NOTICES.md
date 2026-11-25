# 第三方内容声明

本包（@local/pstack-dsh）是个人移植项目，不隶属于 Cursor 或 DeepSeek。

## pstack（skills/ 目录的绝大部分内容）

- 来源：https://github.com/cursor/plugins/tree/main/pstack
- 版本：0.15.48
- 许可：MIT，Copyright (c) Lauren Tan
- 移植方式：`scripts/generate.mjs` 从本地镜像仓库复制生成，注入 DSH 适配行并改写越出技能树范围的链接。除注入的适配行外，技能正文保持上游原文。

## deslop / control-ui / control-cli（skills/ 内的 3 个 vendored 技能）

- 来源：https://github.com/cursor/plugins/tree/main/cursor-team-kit
- 许可：MIT（上游仓库 LICENSE）
- 移植方式：整目录复制，frontmatter 追加 `disable-model-invocation: true`（上游面向 Cursor 自动触发，在 DSH 中改为仅手动 `/name` 调用）。

## DeepSeek Harness（cordis.patch.yml 引用的所有 @deepseek-ai/* 插件）

- 来源：随 DSH 0.2.2-rc.5 发行，本包不含其代码，仅在 patch 中声明挂载。
