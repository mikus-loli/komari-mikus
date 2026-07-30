# Komari Mikus

一个现代化、优雅的 Komari 监控主题，支持明暗主题切换、网格/表格双视图、WebSocket 实时监控和响应式设计。

![preview](https://komari-market.mikus.ink/resources/Mikus-preview.webp)

## 特性

- 🎨 **双主题支持** - 浅色/深色主题无缝切换，支持跟随系统
- 📊 **双视图模式** - 网格视图和表格视图自由切换
- 🌐 **多语言支持** - 内置中/英/日三语切换
- 📡 **WebSocket 实时监控** - 实时数据推送 + HTTP RPC 降级
- 📱 **响应式设计** - 完美适配桌面、平板、手机
- 🏳️ **国旗图标** - 支持全球 250+ 国家和地区旗帜显示（SVG）
- 🌸 **樱花动效** - 可开关的樱花粒子飘落动画
- 📈 **6 种原生 Canvas 图表** - CPU / 内存 / 磁盘 / 网络 / 进程 / 连接数
- 📉 **延迟详情页** - 多任务延迟曲线 + EWMA 平滑 + 统计信息
- 🔍 **节点搜索 + 分组过滤** - 快速定位目标节点
- 🖥️ **高 DPI 适配** - 自动处理 devicePixelRatio，高清屏不模糊

## 安装

1. 从 [Releases](../../releases) 页面下载最新版本的 ZIP 文件
2. 上传到 Komari 主题目录
3. 在 Komari 后台配置中选择 Mikus 主题

## 项目结构

```
komari-mikus/
├── .github/
│   └── workflows/
│       └── release.yml        # GitHub Actions 自动发布
├── dist/
│   ├── assets/
│   │   ├── flags/             # 250+ 国旗 SVG 图标
│   │   ├── img/               # 图片资源（loli.gif, miku.png 等）
│   │   ├── js/                # ES Module 源码
│   │   │   ├── algorithms/    # EWMA 平滑、LTTB 降采样
│   │   │   ├── core/          # 全局状态、常量
│   │   │   ├── i18n/          # 国际化（中/英/日）
│   │   │   ├── services/      # RPC、API、实时数据
│   │   │   ├── ui/            # 图表、节点、模态框、事件、主题
│   │   │   └── utils/         # 格式化、颜色、时间、辅助
│   │   └── style.css          # 样式
│   └── index.html             # 入口页面
├── komari-theme.json          # 主题配置（含所有可配置项）
└── README.md
```

## 配置选项

主题支持以下配置（在 Komari 后台主题设置中修改）：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `default_theme` | select | 跟随系统 | 默认主题（浅色/深色/跟随系统） |
| `default_view` | select | 网格 | 默认视图（网格/表格） |
| `show_uptime` | switch | true | 显示运行时间 |
| `show_network_speed` | switch | true | 显示网络速度 |
| `show_traffic_tags` | switch | false | 显示流量标签 |
| `icon_bounce` | switch | true | 欢迎区域图标跳动动画 |
| `sakura_enabled` | switch | true | 樱花飘落效果 |
| `preloader_enabled` | switch | true | 显示加载页面 |
| `mascot_enabled` | switch | true | 显示欢迎小人 |
| `mascot_url` | string | - | 小人自定义图片 URL |
| `pc_background_url` | string | - | PC 端自定义背景（图片/视频） |
| `mobile_background_url` | string | - | 手机端自定义背景（图片/视频） |
| `refresh_interval` | number | 2 | WebSocket 刷新间隔（秒） |
| `custom_footer` | string | - | 自定义页脚文本 |

## 开发

### 本地预览

直接在浏览器中打开 `dist/index.html` 即可预览主题（需连接 Komari 后端获取数据）。

### 修改主题

1. 修改 `dist/assets/js/` 目录下的模块文件
2. `app.js` 为编排入口，各功能模块在对应子目录中
3. 更新 `komari-theme.json` 配置（如新增配置项）
4. 提交更改并创建新版本发布

### 模块说明

| 目录 | 职责 |
|------|------|
| `algorithms/` | EWMA 数据平滑、LTTB 降采样算法 |
| `core/` | 全局状态单例（state）、常量定义 |
| `i18n/` | 中/英/日三语国际化 |
| `services/` | RPC2 WebSocket 客户端、API 数据加载、实时数据处理 |
| `ui/` | Canvas 图表绘制、节点渲染、模态框、事件绑定、主题切换、预加载 |
| `utils/` | 格式化（流量/时间/数字）、颜色计算、DOM 辅助 |

## 许可证

MIT License

## 相关链接

- [Komari Monitor](https://github.com/komari-monitor/komari)
