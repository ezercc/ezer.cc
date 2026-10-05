# Ezer 财报分析系统 - LLM 文本图表高亮标签语法适配指南

为了实现在分析报告文本（Section B / Section C）流式生成时，鼠标悬浮在关键数据/结论上自动高亮左侧 ECharts 图表及数据点，前端已实现双模解析机制。

本文档为后端及 Prompt 工程团队提供标准标签语法指南。

---

## 1. 标签语法规范 (Tag Format Syntax)

在 LLM 生成分析结论或审计依据时，若提及具体的财务数据或指标，请使用以下标签语法包裹：

```markdown
[[ref:<chart_key>,period:<period_id>,compare_period:<compare_period_id>,text:<display_text>]]
```

### 参数说明：

| 参数 | 是否必填 | 类型 | 说明与可选值 | 示例 |
| --- | --- | --- | --- | --- |
| `chart_key` | **必填** | String | 图表指标标识，可选值：<br>- `revenue` (营业收入)<br>- `net_profit` 或 `profit` (净利润)<br>- `gross_margin` 或 `margin` (毛利率)<br>- `debt_to_asset` 或 `debt` (资产负债率) | `revenue` |
| `period_id` | 可选 | String | 目标报告期或年份，对应图表 X 轴，如 `2026Q1`, `2024FY` 等。 | `2026Q1` |
| `compare_period` | 可选 | String | 比较参照报告期，如 `2025Q1`, `2023Q1`。填入后鼠标悬浮时图表自动绘制**跨期对比弧形虚线箭头与变化率气泡 (+132.8%)**！ | `2025Q1` |
| `text` | **必填** | String | 呈现在报告界面上的文本内容（支持包含单位）。 | `相较于2025Q1的83.74亿元暴增132.8%` |

---

## 2. LLM 输出文本示例对比

### 适配新标签语法后的输出（含跨期对比）：
> 公司在 2026Q1 实现[[ref:revenue,period:2026Q1,compare_period:2025Q1,text:单季营业收入 194.96 亿元相较于 2025Q1 暴增 132.8%]]，同时[[ref:profit,period:2026Q1,compare_period:2025Q1,text:归母净利润 57.35 亿元较 2025Q1 大幅提升 307.4%]]，均创历史新高。[[ref:debt_to_asset,period:2026Q1,compare_period:2025Q1,text:资产负债率 32.6%]]整体保持平稳。

---

## 3. 前端逻辑与兜底机制 (Fallback Mechanism)

1. **后端未适配或纯文本输出时**：
   前端的 `ChartLinkageParser` 会自动启动基于正则表达式的兜底扫描机制，检测文本中的“营业收入”、“净利润”、“毛利率”、“资产负债率”及其紧邻的数值/年份，并自动转化为关联节点。
2. **后端适配后**：
   前端优先解析 `[[ref:...]]` 结构，能够提供比正则扫描更精准、跨长句的语义绑定体验。
