# pstack-dsh

把 [pstack](https://github.com/cursor/plugins/tree/main/pstack)（poteto 的严谨工程工作流：`/poteto-mode` + 22 个 playbook + 24 条原则）移植到 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的**个人定制版**。基于上游 pstack 0.15.48（比现有社区移植新 5 个版本），零原生 JS，纯配置 bundle。

## 这个移植的三个特点

1. **零原生代码**：只声明配置——一个技能提供者、两个子代理 preset、一个委派工具。没有 JS 跑在你的 DSH Host 进程里，DSH 升级几乎不会弄坏它。
2. **61 个技能对模型目录隐藏**（上游设计 + DSH `disable-model-invocation` 语义完全对齐）：模型 catalog 只多一行 `setup-pstack`，token 成本接近零。路由靠 `/poteto-mode` 手势注入和 `read` 读文件。
3. **多家族评审面板**：模型路由表针对本机 magpie 网关的 6 个模型家族定制（GLM / Kimi / Qwen / DeepSeek / Hy4 / MiMo），arena / interrogate 的交叉评审用异家族席位（Kimi K3 + Qwen3.8 + GLM-5.4-max），这是上游多厂商面板精神在单网关上的落地。

## 安装

```sh
# 方式一：命令行
dsh plugin --profile desktop add D:\lib\deepseek-harness-plugins\pstack-dsh

# 方式二：DSH Web UI → Plugins → Add plugin → 本地目录
```

仓库**自带生成好的 `pstack/` 技能树**，装完即可用，不需要本地 cursor/plugins 镜像，也不需要重生成。

安装后**需要补一步**：把面板模型加进子代理白名单。编辑 `~/.dsh/profiles/desktop/cordis.patch.yml` 的 `subagent-model-selection-settings` 段：

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
      # ↓ pstack-dsh 路由表里的代码角色与面板席位
      - provider: magpie
        model: tokenrhythm/glm-5.3
      - provider: magpie
        model: tokenrhythm/kimi-k3
      - provider: magpie
        model: tokenrhythm/qwen3.8-flash
      - provider: magpie
        model: trae-cn/glm-5.4-max
```

然后**新开会话**（模型白名单是会话创建时采样的）。

## 使用

```text
/poteto-mode 这个 PR 有个滚动漂移 bug，先复现，再修复并验证
```

- `/poteto-mode` 开任务；playbook 步骤进 todo list；其余技能按步骤用 `read` 加载。
- 子代理委派自动走 `subagent_pstack`（默认 poteto-agent preset）。
- **临时改模型**：任务里点名即可，如 `/poteto-mode 用 kimi 做交叉评审，检查这段代码`——用户点名优先于路由表默认值。
- `/setup-pstack` 是 catalog 里唯一可见技能：给出模型路由表与三种配置做法（点名 / 改表 / 加白名单），**不探测模型、不写规则文件**。
- 评审面板默认席位见 [适配表](docs/harness/dsh.md#模型路由)。

## 仓库结构

```
cordis.patch.yml          # bundle 声明：技能提供者 + 2 preset + 委派工具
docs/harness/dsh.md       # DSH 适配表（模型路由、工具/字段/路径/指南映射）★核心
docs/porting-log.md       # 移植决策记录
agents/                   # DSH 版 agent 说明（生成器纳入 pstack/agents/）
overrides/                # DSH 原生 setup-pstack 正文
scripts/generate.mjs      # 生成器：从本地 cursor/plugins 镜像产出 pstack/ 树
scripts/check-patch.mjs   # cordis.patch.yml 结构自检（零依赖）
pstack/                   # ★生成树，随仓库分发（勿手改；重生成会清空重建）
  skills/                 #   62 个技能（59 上游 + 3 vendored）
  agents/                 #   2 个 DSH agent 说明
  docs/guide/             #   上游指南 + 每篇 DSH 覆盖说明
  docs/harness/dsh.md     #   适配表副本（技能注入行指向它）
  README.md, LICENSE      #   上游原文 + DSH 覆盖说明
```

顶层不再保留重复的 `skills/` 与 `docs/guide/` 副本：bundle 的 `customSkillDirs` 只指向 `pstack/skills`，仓库里只存在一份技能树。

## 更新上游版本

```sh
cd D:\笔记\plugins && git pull          # 更新 cursor/plugins 镜像
cd D:\lib\deepseek-harness-plugins\pstack-dsh
node scripts/generate.mjs               # 重新生成（校验失败会拒绝写出）
node scripts/generate.mjs --check       # 校验生成树与源同步
node scripts/check-patch.mjs cordis.patch.yml
git add -A && git commit -m "chore: regen from pstack <version>"
```

> 重生成需要本地 cursor/plugins 镜像（生成器头部 `SRC` 常量）；`--check` 也依赖该镜像，请在带镜像的本机跑。装 bundle 用的是仓库里已有的 `pstack/` 树，与镜像无关。
>
> 仓库维护的 `agents/`、`overrides/`、`docs/harness/dsh.md` 不在重生成范围内，上游升级时按需手工合并适配表。

## 已知边界（与上游/DSH 的差异）

- 无 Cursor Automations / Bugbot / 云端代理 / Projects / Custom Mode / `/loop`：适配表规定"跳过并注明一行"，playbook 不中断（`/loop` 的 overnight 契约用 DSH goal 机制近似）。
- `/setup-pstack` 是 DSH 原生技能：路由表即权威，不生成 `pstack-models.mdc` 或任何规则文件。
- 两个上游 agent 定义文件（含 Cursor 模型 slug 与 `~/.cursor/plugins/` 路径）未被复制；本移植用两个 Agent Preset + `pstack/agents/` 里的 DSH 版说明取代。
- vendored 的 `deslop` / `control-ui` / `control-cli` 来自 cursor-team-kit，加了 `disable-model-invocation`（上游在 Cursor 是自动触发，这里改为手动 `/name`）。
- 指南与上游 README 保留原文，仅在 H1 后注入 DSH 覆盖说明；Cursor 专属表述按适配表映射，不逐句改写。
- `cordis.patch.yml` 里有三处本机绝对路径（`customSkillDirs` 一处 + 两个 preset 的 persona 前缀各一处）。这是有意的取舍：`persona.prefix` 是纯文本模板、无法求值，把 `customSkillDirs` 改成 `!!js` 表达式又需要实机验证才敢用（见 [移植决策记录](docs/porting-log.md)的「关键机制考证」）。**移动目录时同步改这三处**即可，技能树随目录一起移动，无需重生成。
- 若卸载本 bundle，`subagent_pstack` 工具与两个 preset 随之消失；技能目录里的 `pstack` 子树可整体删除。

## 许可

本仓库新增代码 MIT。`pstack/` 树内是上游 pstack（MIT, © Lauren Tan）与 cursor-team-kit（MIT）的内容，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
