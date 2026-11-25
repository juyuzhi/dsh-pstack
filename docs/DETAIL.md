# pstack-dsh

pstack 是 poteto 的严谨工程工作流。这个 bundle 把 pstack 0.15.48 搬进 DeepSeek Harness，用 DSH 原生的技能、子代理 preset 和模型路由实现，不引入原生 JS。

## 你会得到什么

- 62 个技能：59 个上游 pstack 技能，加 3 个来自 cursor-team-kit 的 vendored 技能（deslop、control-ui、control-cli）。61 个对模型 catalog 隐藏，只保留 setup-pstack 可见。
- 两个子代理 preset：poteto-agent 负责代码与杂活，comment-sicko 负责只读评论审查。
- subagent_pstack 工具：spawn 后端，支持 agent_preset、provider、model、reasoning_effort。
- 多家族模型路由：代码实现、prose 与 judgment、swarm worker、三个交叉评审席位、arena 裁判、trivial 小改各自有默认席位。
- 完整指南、DSH 适配表和休眠的 benny 自动化参考包。

## 安装

1. 在 DSH 的 Plugins 页选择 Add plugin，指向本地目录 `D:\lib\deepseek-harness-plugins\pstack-dsh`；或运行 `dsh plugin --profile desktop add D:\lib\deepseek-harness-plugins\pstack-dsh`。
2. 把评审席位模型加入 profile 的 `subagent-model-selection-settings.allowedModels`。白名单在会话创建时采样，改完要新开会话。
3. 新开会话后，在消息里输入 `/setup-pstack` 查看路由表，或直接 `/poteto-mode` 开始任务。

## 使用

```text
/poteto-mode 这个 PR 有个滚动漂移 bug，先复现，再修复并验证
```

- `/poteto-mode` 匹配 playbook，把步骤逐字复制进 todo list，并按需加载其他技能。
- 隐藏技能直接输入 `/how`、`/why`、`/interrogate`、`/unslop`、`/tdd` 等名字即可调用。
- 委派用 `subagent_pstack`。默认 preset 是 poteto-agent；只读评论审查传 `agent_preset: comment-sicko`。
- 临时换模型在任务里点名，例如「用 kimi 做交叉评审」。用户点名优先于路由表默认值。

## 边界

- DSH 没有 Cursor Automations、Bugbot、云端代理、Projects、Custom Mode 和 `/loop`。playbook 遇到这些步骤时跳过并写一行说明。
- `pstack/automations/benny/` 只是休眠参考文件，不注册成技能，也不能在 DSH 中运行。
- 模型路由表按本机 magpie 网关写死。换网关要改 `docs/harness/dsh.md` 和白名单。
- `cordis.patch.yml` 与两个 persona 里有本机绝对路径。移动安装目录时同步修改这三处。
- 61 个技能不在模型 catalog 里，这是有意设计。模型用 `read` 加载，用户用 `/name` 手势加载。

## 验证

```sh
node scripts/generate.mjs --check
node scripts/check-patch.mjs cordis.patch.yml
```

`--check` 比较生成树与 pstack 源镜像。`check-patch.mjs` 检查 patch 的顶层结构与关键字段。安装后在 Plugins 页应看到 4 行：`skill-filesystem-pstack`、`tool-subagent-pstack`、`preset-poteto-agent`、`preset-comment-sicko`。
