# Komari Mikus

一个现代化、优雅的 Komari 监控主题，支持明暗主题切换、网格/表格双视图、WebSocket 实时监控和响应式设计。

## 特性

- 🎨 **双主题支持** - 浅色/深色主题无缝切换，支持跟随系统
- 📊 **双视图模式** - 网格视图和表格视图自由切换
- 🌐 **多语言支持** - 内置中文/英文/日语切换
- 📡 **WebSocket 实时监控** - 实时数据更新
- 📱 **响应式设计** - 完美适配各种设备
- 🏳️ **国旗图标** - 支持全球国家和地区旗帜显示

## 安装

1. 从 [Releases](../../releases) 页面下载最新版本的 ZIP 文件
2. 上传到 Komari 主题
3. 在 Komari 配置中选择 Mikus 主题

## 项目结构

```
komari-mikus/
├── .github/
│   └── workflows/
│       ├── test.yml           # CI 测试 + 代码风格检查
│       └── release.yml        # 自动化发布工作流
├── dist/
│   ├── assets/
│   │   ├── css/              # 样式模块
│   │   │   ├── style.css     # 主样式
│   │   │   ├── welcome.css   # 欢迎区域
│   │   │   ├── modal.css     # 模态框
│   │   │   ├── nodes.css     # 节点列表
│   │   │   ├── charts.css    # 图表
│   │   │   ├── theme.css     # 主题变量
│   │   │   ├── responsive.css # 响应式
│   │   │   └── animations.css # 动画
│   │   ├── flags/            # 国旗 SVG 图标（按需加载）
│   │   ├── img/              # 图片资源
│   │   ├── js/
│   │   │   ├── app.js        # 应用入口
│   │   │   ├── sakura.js     # 樱花特效（可选，按需加载）
│   │   │   ├── core/         # 核心状态与常量
│   │   │   │   ├── state.js
│   │   │   │   ├── constants.js
│   │   │   │   └── error-boundary.js
│   │   │   ├── i18n/         # 国际化
│   │   │   │   └── index.js  # zh-CN / en / ja
│   │   │   ├── services/     # 通信层
│   │   │   │   ├── rpc.js    # RPC2 客户端
│   │   │   │   ├── api.js    # 数据加载 API
│   │   │   │   └── realtime.js # 实时数据处理
│   │   │   ├── ui/           # UI 渲染
│   │   │   │   ├── nodes.js      # 节点核心逻辑
│   │   │   │   ├── nodes-grid.js # 网格视图
│   │   │   │   ├── nodes-table.js # 表格视图
│   │   │   │   ├── modal.js      # 模态框核心
│   │   │   │   ├── modal-overview.js # 概览页
│   │   │   │   ├── modal-latency.js  # 延迟页
│   │   │   │   ├── events.js  # 事件绑定
│   │   │   │   ├── preloader.js # 预加载器
│   │   │   │   ├── theme.js   # 主题管理
│   │   │   │   └── charts/    # 图表引擎
│   │   │   ├── algorithms/    # 数据处理算法
│   │   │   │   ├── index.js   # EWMA/LTTB/插值/峰值检测
│   │   │   │   └── pipeline.js # 数据处理管道
│   │   │   └── utils/        # 工具函数
│   │   │       ├── helpers.js    # 聚合导出
│   │   │       ├── html.js       # HTML 转义/标签
│   │   │       ├── ui-helpers.js # UI 辅助
│   │   │       ├── data-trim.js  # 数据裁剪
│   │   │       ├── flag.js       # 国旗/地区
│   │   │       ├── ping.js       # 延迟/Ping
│   │   │       ├── url.js        # URL/网络
│   │   │       ├── format.js     # 格式化
│   │   │       ├── time.js       # 时间处理
│   │   │       └── color.js      # 颜色计算
│   │   └── style.css          # 主样式入口
│   └── index.html             # 主页面
├── test/                      # 测试
│   ├── algorithms.test.mjs    # 算法测试（32 用例）
│   └── api-rpc.test.mjs       # API/RPC 测试（17 用例）
├── komari-theme.json          # 主题配置
├── package.json               # 项目配置
├── .eslintrc.json             # ESLint 配置
└── README.md
```

## 配置选项

主题支持以下配置：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `default_theme` | select | 跟随系统 | 默认主题（浅色/深色/跟随系统） |
| `default_view` | select | 网格 | 默认视图（网格/表格） |
| `show_uptime` | switch | true | 显示运行时间 |
| `show_network_speed` | switch | true | 显示网络速度 |
| `show_ping` | switch | true | 显示网络延迟 |
| `show_connections` | switch | false | 显示连接数 |
| `refresh_interval` | number | 2 | 刷新间隔（秒） |
| `custom_footer` | string | - | 自定义页脚文本 |

## 开发

### 本地预览

直接在浏览器中打开 `dist/index.html` 即可预览主题。

### 修改主题

1. 修改 `dist/` 目录下的文件
2. 更新 `komari-theme.json` 配置
3. 提交更改并创建新版本发布

## 许可证

MIT License

## 相关链接

- [Komari Monitor](https://github.com/komari-monitor/komari)
