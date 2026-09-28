# Ezer 财报分析系统 - 后端数据契约破坏性变更清单与格式确认函

> **文档性质**：前端与后端数据协议对齐及确认说明  
> **对比基准**：  
> - **旧版基线**：`innolight_300308_sz_2026q1_stream_with_i.frontend.json`（前端原实现所依赖的标准契约）  
> - **新版样板**：`zhongji_xuchuang_300308_2026q1_inline_ref_v1_8card.json`（新联调数据文件）  

---

## 一、 核心破坏性变更清单 (Breaking Changes)

通过对两版 JSON 数据进行全量对比，新版数据在未通知前端的情况下发生了以下 **4 项破坏性变更**，直接导致前端 C 区域呈现异常（暴露内部变量名、内容被流式覆盖）。

---

### 1. 【严重破坏】`c_challenge` 与 `c_resolved` 的 `target_card_id` 语义突变

* **旧版行为**：`target_card_id` 输出的是**用户可见的中文卡片标题**。
* **新版行为**：`target_card_id` 突变为了**系统内部英文 Slug**。
* **破坏性影响**：前端原本按原协议将该字段直接渲染为界面标签（如 `针对: ${d.target_card_id}` / `解决项: ${d.target_card_id}`），导致界面直接把英文变量名打印给终端用户。

#### 对比示例：

| 事件类型 | 旧版基线字段值 | 新版样板字段值 | 前端受影响展现 |
| :--- | :--- | :--- | :--- |
| `c_challenge` | `"历史增长趋势分析"` | `"overview"` | `针对: overview` |
| `c_challenge` | `"负债结构与偿债能力"` | `"balance_sheet_pressure"` | `针对: balance_sheet_pressure` |
| `c_resolved` | `"盈利能力分析"` | `"profitability_quality"` | `解决项: profitability_quality` |
| `c_resolved` | `"业务结构与市场分布"` | `"unknowns_and_limits"` | `解决项: unknowns_and_limits` |

---

### 2. 【破坏】`c_progress` 进度文本直接拼接英文代称

* **旧版行为**：`data.step` 为纯中文自然语言进度描述。
* **新版行为**：`data.step` 直接拼接了未做本地化的内部英文 Slug。
* **破坏性影响**：前端流式状态条和进度区域直接展示未汉化的开发代称。

#### 对比示例：

```diff
- 旧版 step: "复核并挑战 历史增长趋势分析"
+ 新版 step: "复核并挑战 overview"

- 旧版 step: "复核通过 负债结构与偿债能力"
+ 新版 step: "复核并挑战 balance_sheet_pressure"
```

---

### 3. 【逻辑破坏】C 区域事件去重/挂载机制失效（同卡多次审计导致内容覆盖）

* **旧版行为**：C 区域每个目标卡片最多触发 1 次 challenge 和 1 次 resolved，卡片与审计项呈 1:1 关系。
* **新版行为**：同一张卡片在流式过程中被**多次复核挑战**：
  * 先输出一条长篇详尽的证据链审计（事件 14~28）；
  * 后续又针对规则检查（12 季度声称检查）单独输出了一条简讯：`"该卡声称覆盖12个季度，但实际历史序列仅保留11个季度。"`（事件 30~36）。
* **破坏性影响**：前端原逻辑以 `target_card_id` 作为 DOM 挂载和更新的唯一键。新版中同一卡片接收到第二次事件时，**后到达的规则简讯直接清空覆盖了前一次详尽的长篇审计正文**。

---

### 4. 【结构变更】B 区域卡片体系全量重构 (`card_id` 集合变更)

* **旧版行为**：7 张卡片，ID 为：
  `profitability_overview`, `revenue_structure`, `cash_flow_quality`, `rd_innovation`, `liability_solvency`, `growth_trend`, `asset_composition`
* **新版行为**：重构为 8 张卡片，ID 变更为：
  `overview`, `trend_and_turning_points`, `growth_quality`, `profitability_quality`, `profit_cash_consistency`, `balance_sheet_pressure`, `unknowns_and_limits`, `business_outlook`
* **新增字段**：每张卡片新增了 `source_refs` 数组。
* **破坏性影响**：前端原有的卡片降级字典、针对特定卡片（如 `business_outlook`）的打字机跳过规则及样式钩子全部脱节。

---

## 二、 需后端确认的格式决策项 (Decisions Needed)

请后端团队审阅上述变更，并对以下 4 个关键格式约定予以书面确认：

### 决策 1：`c_challenge` / `c_resolved` 的目标卡片标识格式

* [ ] **方案 A（保持纯英文 ID，由后端补充中文标题）**：  
  保留 `target_card_id: "balance_sheet_pressure"`，但在 payload 中显式补充 `target_card_title: "资产负债表压力"`，由前端直接呈现 `target_card_title`。
* [ ] **方案 B（回滚为旧版中文全称）**：  
  将 `target_card_id` 重新对齐为与 B 卡片 `title` 严格一致的中文全称（如 `"资产负债表压力"`）。
* [ ] **方案 C（固定英文 Slug，由前端维护硬编码映射表）**：  
  后端永久锁定这 8 个英文 `card_id`，不再变更；前端建立静态字典完成从 `balance_sheet_pressure` 到 `资产负债表压力` 的转换。

---

### 决策 2：`c_progress.step` 文本的输出规范

* [ ] **确认由后端完成本地化格式化**：  
  输出为用户可读文本，格式如：`"复核并挑战【资产负债表压力】"` 或 `"正在复核资产负债表压力..."`，不再直接输出裸英文变量。

---

### 决策 3：同卡片多条审计意见的输出协议

若未来允许对单张卡片进行多维度复核（即产生多条 `c_challenge`），请确认事件的输出方式：
* [ ] **方案 A（事件独立化，补充唯一键）**：  
  增加 `issue_id` 字段（如 `"chk_balance_01"`, `"chk_balance_02"`），前端以 `issue_id` 为 DOM 挂载粒度，实现多条意见并列展示，互不覆盖。
* [ ] **方案 B（后端内容合并，单卡单条）**：  
  同一卡片的多条审计意见由后端合并为一段完整的 `issue` 文本一次性发出。

---

### 决策 4：新的 8 张卡片体系是否作为未来标准基准

请确认当前 8 张卡片结构（`overview`, `trend_and_turning_points`, `growth_quality`, `profitability_quality`, `profit_cash_consistency`, `balance_sheet_pressure`, `unknowns_and_limits`, `business_outlook`）是否已正式定型，前端将以此作为正式基线进行工程化固化。
