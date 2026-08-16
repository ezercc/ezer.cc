export interface ChangelogItem {
  version: string;
  date: string;
  zh: {
    title: string;
    features?: string[];
    improvements?: string[];
    fixes?: string[];
  };
  en: {
    title: string;
    features?: string[];
    improvements?: string[];
    fixes?: string[];
  };
}

export const changelogData: ChangelogItem[] = [
  {
    version: "v1.3.0",
    date: "2026-08-14",
    zh: {
      title: "订阅支付与分析体验全面升级",
      features: [
        "升级专业版订阅体验，新增月付、季付与年付计划展示，并清晰呈现银行卡、支付宝等可选支付方式。",
        "优化财报分析任务启动与报告加载体验，让报告能更快开始并随着生成过程逐步呈现。"
      ],
      improvements: [
        "改进部分报告数据的处理与展示，提升分析结果的完整性和阅读体验。",
        "新增 Cookie 同意、研究提示及法律信息页面，并统一相关页面布局，帮助用户更清楚了解数据使用与研究服务说明。",
        "优化专业版、订阅与分析额度体验，并更清晰地展示已开通状态。"
      ],
      fixes: [
        "优化结账完成后的页面链接，减少无关状态参数残留。",
        "当奖励额度更新暂时不可用时采用更安全的处理方式，保障额度记录的一致性。",
        "增强站点地图和部分依赖服务暂时不可用时的稳定性。"
      ]
    },
    en: {
      title: "Subscription, Payments & Analysis Experience Upgrade",
      features: [
        "Refined the Premium subscription experience with monthly, quarterly, and annual plan displays, along with clearly presented card and Alipay payment options.",
        "Improved analysis startup and report loading so reports can begin sooner and appear progressively as they are generated."
      ],
      improvements: [
        "Improved the processing and presentation of some report data for more complete, readable results.",
        "Added cookie consent, research notices, and legal information pages, while unifying related page layouts to make data use and research-service terms clearer.",
        "Refined the Premium, subscription, and analysis-credit experience, including clearer display of activated status."
      ],
      fixes: [
        "Cleaned up checkout-completion links to avoid leaving unrelated state parameters in the URL.",
        "Added safer handling when a reward-credit update is temporarily unavailable, helping keep credit records consistent.",
        "Improved resilience for sitemap generation and when certain supporting services are temporarily unavailable."
      ]
    }
  },
  {
    version: "v1.2.2",
    date: "2026-07-09",
    zh: {
      title: "新增分析反馈系统，持续打磨财报解读质量",
      features: [
        "新增分析结果评分模块。用户可在报告生成后对分析结果进行评价并提交反馈，帮助我们持续优化财报解读的准确性、可读性与实用性。"
      ],
      improvements: [
        "完善热门搜索内容池，覆盖更多常见公司与高关注财报场景。",
        "优化“换一换”交互，帮助用户更快发现可分析的热门标的与示例入口。"
      ]
    },
    en: {
      title: "Analysis Feedback System & Quality Refinements",
      features: [
        "Added an analysis rating module, allowing users to rate and submit feedback on generated reports to help continuously improve the accuracy, readability, and utility of our financial interpretations."
      ],
      improvements: [
        "Enriched the popular search database to cover more mainstream companies and high-focus reporting scenarios.",
        "Optimized the \"Change\" interaction, helping users discover analyzable trending companies and sample reports faster."
      ]
    }
  },
  {
    version: "v1.2.1",
    date: "2026-07-05",
    zh: {
      title: "产品更新更透明，热门搜索发现体验升级",
      features: [
        "新增独立“更新日志”页面，支持中英文查看重要版本变化，方便用户持续了解弈泽的产品演进。",
        "新增热门搜索模块，提供更直观的分析入口，并支持通过“换一换”发现更多高关注标的。"
      ],
      fixes: [
        "修复部分 iOS 浏览器和 PWA 场景下页面缓存滞后的问题，降低用户打开旧版本页面的概率。"
      ]
    },
    en: {
      title: "Transparent Product Updates & Enhanced Discovery Experience",
      features: [
        "Launched a dedicated \"Changelog\" page supporting bilingual version history, promoting transparency in our product evolution.",
        "Introduced a \"Popular Searches\" module with a more intuitive entry point, supporting a \"Change\" button to discover more trending targets."
      ],
      fixes: [
        "Resolved caching delay issues in certain iOS browsers and PWA scenarios, reducing the likelihood of users loading outdated page versions."
      ]
    }
  },
  {
    version: "v1.2.0",
    date: "2026-06-25",
    zh: {
      title: "引入行业资讯词云，财报分析从数字延伸到产业语境",
      features: [
        "新增“行业资讯词云”模块。系统会结合公司所属行业与近期市场信息，提炼高相关度关键词，帮助用户从产业、政策、需求和竞争格局等角度补充理解财报表现。",
        "支持点击关键词查看关联资讯与审计参考信息，让财务结论拥有更清晰的外部语境。"
      ],
      improvements: [
        "优化分析链路，增强行业信息检索、关键词提取和证据聚合能力，使分析结果能够同时参考财务数据与市场动态。",
        "优化长篇分析报告的传输与读取体验，提升复杂报告场景下的加载稳定性。",
        "调整深色模式下的背景与文字对比度，让夜间阅读更清晰、长时间查看报告更舒适。"
      ]
    },
    en: {
      title: "Industry News Word Cloud & Contextual Insights",
      features: [
        "Introduced the \"Industry News Word Cloud\" module, extracting highly relevant keywords based on industry context and market updates to help users understand financial performance through industry dynamics, policy, demand, and competitive landscapes.",
        "Supported clicking keywords to view associated news and auditing reference info, providing clearer external context for financial conclusions."
      ],
      improvements: [
        "Optimized the analysis pipeline by enhancing industry intelligence retrieval, keyword extraction, and evidence aggregation, combining financial data with market dynamics.",
        "Optimized the transmission and loading experience of long analysis reports, improving load stability in complex report scenarios.",
        "Adjusted the background and text contrast in dark mode, making night reading clearer and long-term report viewing more comfortable."
      ]
    }
  },
  {
    version: "v1.1.2",
    date: "2026-06-10",
    zh: {
      title: "用户中心与邀请权益升级",
      features: [
        "用户中心新增“邀请好友”模块。用户可通过邀请好友获得额外使用次数，用更低门槛体验弈泽的财报分析能力。"
      ],
      improvements: [
        "优化免费计划的额度分配规则，让新用户和轻度用户更容易完成一次完整的财报分析体验。"
      ],
      fixes: [
        "修复特定跨域跳转场景下登录态异常失效的问题，提升登录、返回分析页和访问用户中心时的连续性。"
      ]
    },
    en: {
      title: "User Center & Referral Benefits Upgrade",
      features: [
        "Added an \"Invite Friends\" module in the User Center, allowing users to earn extra analysis credits by referring friends, lowering the barrier to experience Ezer's capabilities."
      ],
      improvements: [
        "Optimized the allocation rules of the free plan quota, making it easier for new and light users to complete a full financial analysis experience.",
      ],
      fixes: [
        "Fixed session validation failures on certain cross-domain redirects, improving user journey continuity across login, analysis pages, and the User Center."
      ]
    }
  },
  {
    version: "v1.1.0",
    date: "2026-06-10",
    zh: {
      title: "机构级多智能体审计引擎升级，财报分析进入工业化协作阶段",
      features: [
        "新增机构级多智能体分析群。系统会在一次完整分析中调度约 30 个专业分析智能体，分别承担数据抽取、指标校验、历史趋势判断、行业语境补充、风险识别、结论审阅等任务，形成更接近专业研究团队的协作式分析流程。",
        "升级大模型分析链路，引入更高阶的财报理解与审计推理能力，增强对复杂财务指标、历史趋势和潜在风险的识别。",
        "引入“红蓝对抗”式复核机制：一侧主动寻找异常、证据缺口与逻辑跳跃，另一侧负责校验结论、修正表述并确认可通过的判断，降低单一模型直接下结论带来的偏差。",
        "新增五大维度可视化面板，围绕利润质量、现金流质量、增长持续性、资产负债结构和估值预期组织关键信息，帮助用户更快抓住报告重点。"
      ],
      improvements: [
        "强化财报数据抽取与标准化能力，减少公司代码、市场后缀、财报期间和指标口径不一致带来的误读。",
        "优化历史趋势分析，增强对连续季度数据、年度报告与季度报告之间口径差异的识别，降低把年度数据与单季度数据混用的风险。",
        "完善跨市场财报识别能力，提升 A 股、港股、美股等不同市场下公司名称、证券代码和财报期间的解析准确性。",
        "优化数据源异常处理。在上游数据拥堵、额度不足或响应不稳定时，系统会尝试更稳健的补充检索，并向用户提供更清晰的任务状态。",
        "优化分析过程中的实时展示体验，减少空白等待、重复信息或难以理解的中间状态。",
        "完善中英文报告表达，使英文场景下的分析卡片、审计结论和最终摘要更加统一。"
      ],
      fixes: [
        "修复历史图表中部分财务指标无法正常展示的问题。",
        "修复部分美股年度财报场景下，目标年度识别不准确或被季度数据干扰的问题。",
        "修复港股历史财务数据在累计口径下展示不完整的问题。",
        "修复部分公司别名或市场后缀导致的重复查询、错误查询问题。",
        "修复报告页面中偶现内部字段名、机器编号或低可读性证据标签的问题，让报告表达更接近专业研究语言。"
      ]
    },
    en: {
      title: "Institution-Grade Multi-Agent Audit Engine Upgrade",
      features: [
        "Introduced an institution-grade multi-agent analysis fleet, orchestrating ~30 specialized analysis agents (data extraction, indicator validation, historical trends, industry context, risk identification, final review) to form a collaborative workflow mimicking a professional research team.",
        "Upgraded the LLM analysis pipeline to introduce higher-order financial understanding and audit reasoning capabilities, enhancing the detection of complex indicators, trends, and latent risks.",
        "Introduced a \"Red-Blue Adversarial\" review mechanism, where one side seeks anomalies, evidence gaps, and logical leaps, while the other validates conclusions, refines phrasing, and approves final judgements to minimize single-model bias.",
        "Added a 5-dimension visualization dashboard, organizing key details around Profit Quality, Cash Flow Quality, Growth Sustainability, Balance Sheet Structure, and Valuation Expectations to help users grasp report summaries faster."
      ],
      improvements: [
        "Strengthened financial data extraction and standardization, reducing misinterpretations caused by inconsistencies in company codes, market suffixes, report periods, and metric definitions.",
        "Optimized historical trend analysis, improving identification of discrepancies between continuous quarters, annual reports, and quarterly reports to prevent mixing up annual and single-quarter metrics.",
        "Improved cross-market report recognition, enhancing parsing accuracy for company names, ticker codes, and report periods across A-share, HK, and US stock markets.",
        "Optimized data source exception handling, attempting more robust fallback queries under upstream congestion, insufficient quotas, or unstable responses, and providing users with clearer task status.",
        "Optimized real-time loading UI, reducing empty states, repetitive information, or confusing progress states.",
        "Refined bilingual report expression to ensure consistency in analysis cards, audit conclusions, and final summaries in English."
      ],
      fixes: [
        "Fixed display issues where certain financial metrics failed to show in historical charts.",
        "Fixed target year misidentifications or quarterly data interferences in certain US annual report scenarios.",
        "Fixed incomplete display of cumulative historical financial data for Hong Kong stocks.",
        "Fixed query duplication or errors caused by company aliases or market suffixes.",
        "Fixed occasional leaks of internal field names, machine IDs, or low-readability evidence tags in reports, ensuring professional research terminology."
      ]
    }
  }
];
