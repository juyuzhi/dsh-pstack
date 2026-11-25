# pstack-dsh

把 [pstack](https://github.com/cursor/plugins/tree/main/pstack)（poteto 的严谨工程工作流：`/poteto-mode` + 22 个 playbook + 24 条原则）完整移植到 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)。基于上游 pstack 0.15.48，零原生 JS，纯配置 bundle。

## 这个移植做了什么

1. **62 个技能，61 个隐藏**。59 个上游 pstack 技能加 3 个 vendored 技能（`deslop`、`control-ui`、`control-cli`）。模型 catalog 只多一行 `setup-pstack`，token 成本接近零。路由靠 `/poteto-mode` 手势注入和 `read` 读文件。
2. **两个子代理 preset 加一个委派工具**。`poteto-agent` 负责代码与杂活，`comment-sicko` 在组合层被剥夺写工具，只读审查注释。`subagent_pstack` 复用 DSH 原生的 spawn 后端和模型选择字段。
3. **多家族评审面板**。模型路由表按本机 magpie 网关的 6 个模型家族定制（GLM / Kimi / Qwen / DeepSeek / Hy4 / MiMo）。交叉评审席位用异家族视角：Kimi K3、Qwen3.8、GLM-5.4-max。
4. **完整文档与休眠参考**。10 篇上游指南、DSH 适配表、上游 README 全部随包分发。`pstack/automations/benny/` 保留为休眠参考，DSH 没有 Cursor Automations，不会注册也不会运行。

## 安装

```sh
# 方式一：命令行
dsh plugin --profile desktop add D:\lib\deepseek-harness-plugins\pstack-dsh

# 方式二：DSH Web UI → Plugins → Add plugin → 本地目录
```

仓库自带生成好的 `pstack/` 技能树，装完即可用，不需要本地 cursor/plugins 镜像。

安装后补一步：把面板模型加进子代理白名单。编辑 `~/.dsh/profiles/desktop/cordis.patch.yml` 的 `subagent-model-selection-settings` 段：

```yaml
- id: subagent-model-selection-settings
  name: "@deepseek-ai/dsh-tool-subagent/model-selection-settings"
  config:
    enabled: true
    allowedModels:
      - provider: magpie
        model: group/deepseek-flash
      - provider: magpie
        model: group/hy4-flash
      # pstack-dsh 路由表里的代码角色与面板席位
      - provider: magpie
        model: tokenrhythm/glm-5.3
      - provider: magpie
        model: tokenrhythm/kimi-k3
      - provider: magpie
        model: tokenrhythm/qwen3.8-flash
      - provider: magpie
        model: trae-cn/glm-5.4-max
```

然后新开会话。白名单在会话创建时采样，旧会话看不到新增路由。

如果这个 bundle 已经装过，改完 patch 后必须 `remove_bundle` 再 `install_bundle`。bundle 内的 `cordis.patch.yml` 不会热重载。

## 使用

```text
/poteto-mode 这个 PR 有个滚动漂移 bug，先复现，再修复并验证
```

- `/poteto-mode` 开任务。playbook 步骤进 todo list，其余技能按步骤用 `read` 加载。
- 子代理委派自动走 `subagent_pstack`，默认 `poteto-agent` preset。
- 临时改模型：任务里点名，例如 `/poteto-mode 用 kimi 做交叉评审，检查这段代码`。用户点名优先于路由表默认值。
- `/setup-pstack` 是 catalog 里唯一可见技能，给出模型路由表与三种配置做法（点名、改表、加白名单），不探测模型、不写规则文件。
- 评审面板默认席位见 [DSH 适配表](docs/harness/dsh.md#模型路由)。

## 仓库结构

```
cordis.patch.yml          # bundle 声明：技能提供者 + 2 preset + 委派工具
docs/harness/dsh.md       # DSH 适配表（模型路由、工具/字段/路径/指南映射）
docs/DETAIL.md            # Plugins 页详情文档
docs/porting.md           # 移植决策与已知边界
agents/                   # DSH 版 agent 说明（生成器纳入 pstack/agents/）
overrides/                # DSH 原生 setup-pstack 正文
scripts/generate.mjs      # 生成器：从本地 cursor/plugins 镜像产出 pstack/ 树
scripts/check-patch.mjs   # cordis.patch.yml 结构自检（零依赖）
pstack/                   # 生成树，随仓库分发（勿手改；重生成会清空重建）
  skills/                 #   62 个技能（59 上游 + 3 vendored）
  agents/                 #   2 个 DSH agent 说明
  docs/guide/             #   上游指南 + 每篇 DSH 覆盖说明
  docs/harness/dsh.md     #   适配表副本
  automations/benny/      #   休眠参考包，不注册
  README.md, LICENSE      #   上游原文 + DSH 覆盖说明
```

## 更新上游版本

```sh
cd D:\笔记\plugins && git pull          # 更新 cursor/plugins 镜像
cd D:\lib\deepseek-harness-plugins\pstack-dsh
node scripts/generate.mjs               # 重新生成（校验失败会拒绝写出）
node scripts/generate.mjs --check       # 校验生成树与源同步
node scripts/check-patch.mjs cordis.patch.yml
git add -A && git commit -m "chore: regen from pstack <version>"
```

重生成需要本地 cursor/plugins 镜像（生成器头部 `SRC` 常量）。`--check` 也依赖该镜像，请在带镜像的本机运行。装 bundle 用的是仓库里已有的 `pstack/` 树，与镜像无关。

## 已知边界

- 无 Cursor Automations、Bugbot、云端代理、Projects、Custom Mode、`/loop`。适配表规定跳过并注明一行，playbook 不中断。
- `benny` 自动化包随树分发，但只是休眠参考。DSH 没有 Slack 触发和 Cursor Automations，这些文件不注册成技能。
- `/setup-pstack` 是 DSH 原生技能：路由表即权威，不生成 `pstack-models.mdc` 或任何规则文件。
- 两个上游 agent 定义文件（含 Cursor 模型 slug 与 `~/.cursor/plugins/` 路径）未被复制。本移植用两个 Agent Preset 加 `pstack/agents/` 的 DSH 版说明取代。
- vendored 的 `deslop` / `control-ui` / `control-cli` 来自 cursor-team-kit，加了 `disable-model-invocation`。上游在 Cursor 是自动触发，这里改为手动 `/name`。
- 指南与上游 README 保留原文，仅在 H1 后注入 DSH 覆盖说明。Cursor 专属表述按适配表映射，不逐句改写。
- `cordis.patch.yml` 里有三处本机绝对路径（`customSkillDirs` 一处，两个 preset 的 persona 前缀各一处）。移动目录时同步改这三处。
- 若卸载本 bundle，`subagent_pstack` 工具与两个 preset 随之消失；技能目录里的 `pstack` 子树可整体删除。

## 许可

本仓库新增代码 MIT。`pstack/` 树内是上游 pstack（MIT，© Lauren Tan）与 cursor-team-kit（MIT）的内容，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
