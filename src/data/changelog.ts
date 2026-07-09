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
    version: "v1.2.2",
    date: "2026-07-09",
    zh: {
      title: "新增分析结果评分系统",
      features: [
        "分析完成后，分析结果下方将显示评分模块，支持用户提交反馈，帮助我们完善分析算法。"
      ],
      improvements: [
        "完善了热门搜索的内容，支持点击“换一换”按钮切换。",
      ]
    },
    en: {
      title: "Add Rating System",
      features: [
        "Added a rating system to the analysis results, allowing users to submit feedback to help us improve our analysis algorithms."
      ],
      improvements: [
        "Improved the content of \"Popular Searches\", supporting switching by clicking the \"Change\" button.",
      ],
    }
  },
  {
    version: "v1.2.1",
    date: "2026-07-05",
    zh: {
      title: "新增独立更新日志与热门搜索模块",
      features: [
        "新增独立的“更新日志”页面，支持中英双语的迭代历史查阅。",
        "新增“热门搜索”模块，支持用户点击“换一换”按钮切换。"
      ],
      fixes: [
        "修复了 PWA 服务工作线程（Service Worker）在部分 iOS 浏览器下因资源缓存导致的页面版本滞后问题。"
      ]
    },
    en: {
      title: "Independent Changelog & Popular Searches Module",
      features: [
        "Added a dedicated \"Changelog\" page supporting bilingual version history, promoting transparency in product evolution.",
        "Added \"Popular Searches\" module, supporting switching by clicking the \"Change\" button."
      ],
      fixes: [
        "Resolved an issue where PWA Service Worker caching caused stale page versions in certain iOS browsers."
      ]
    }
  },
  {
    version: "v1.2.0",
    date: "2026-06-25",
    zh: {
      title: "新增资讯词云交互与性能优化",
      features: [
        "在财报分析页面中新增“行业资讯词云”可视化模块，支持点击关键词探索关联的市场情报与审计参考。"
      ],
      improvements: [
        "优化了后端分析链路，支持行业信息搜寻",
        "调整了深色模式下的背景与文字对比度配色，降低夜间阅读的眼部疲劳感。"
      ],
    },
    en: {
      title: "Industry Word Cloud Interaction",
      features: [
        "Introduced an interactive \"Industry News Word Cloud\" visualization to the analysis page, allowing users to click keywords to explore related news."
      ],
      improvements: [
        "Optimized backend analysis pipeline to support industry news retrieval",
        "Optimized dark mode contrast and color scheme to improve legibility and reduce eye strain."
      ],
    }
  },
  {
    version: "v1.1.2",
    date: "2026-06-10",
    zh: {
      title: "新增用户中心邀请系统",
      features: [
        "用户中心增加“邀请好友”模块，用户可以通过邀请好友增加使用次数"
      ],
      improvements: [
        "完善了免费计划的额度分配"
      ],
      fixes: [
        "修复了用户登录态在特定跨域跳转情况下失效的问题。"
      ]
    },
    en: {
      title: "User Invitation System",
      features: [
        "Added 'Invite Friends' module in User Center, allowing users to earn extra analysis credits by inviting friends."
      ],
      improvements: [
        "Improved free plan credit allocation strategy."
      ],
      fixes: [
        "Fixed user session validation errors occurring on certain cross-domain redirects."
      ]
    }
  },
  {
    version: "v1.1.0",
    date: "2026-06-10",
    zh: {
      title: "大模型审计大脑升级",
      features: [
        "将底层财报分析大模型升级至 Gemini 3.1 Pro，大幅提升复杂财务数据勾稽关系与财务隐患的审计精度。",
        "正式引入“红蓝对抗”式多智能体协作机制：红队负责挖掘异常，蓝队负责校验纠偏，减少大模型幻觉。"
      ],
      improvements: [
        "在分析页面中新增“利润质量、现金流、增长持续性、资产负债、估值预期”五大维度的可视化数据面板。",
        "优化了 API 请求过载时的友好截断拦截与提示机制。"
      ]
    },
    en: {
      title: "Gemini 3.1 Core Model Upgrade",
      features: [
        "Upgraded core auditing brain to Gemini 3.1 Pro, significantly improving reasoning accuracy for complex financial relationships.",
        "Launched the \"Red-Blue Adversarial\" multi-agent verification workflow, where Red team identifies anomalies and Blue team double-checks targets to minimize hallucinations."
      ],
      improvements: [
        "Added visual comparison panels mapping the 5 key analysis dimensions: Profit Quality, Cash Flow, Growth, Balance Sheet, and Valuation.",
        "Optimized rate-limit error catching to provide cleaner UI feedback under high load."
      ]
    }
  }
];
