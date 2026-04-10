# Komari Mikus

一个现代化、优雅的 Komari 监控主题，支持明暗主题切换、网格/表格双视图、WebSocket 实时监控和响应式设计。

## 特性

- 🎨 **双主题支持** - 浅色/深色主题无缝切换，支持跟随系统
- 📊 **双视图模式** - 网格视图和表格视图自由切换
- 🌐 **多语言支持** - 内置中英文切换
- 📡 **WebSocket 实时监控** - 实时数据更新
- 📱 **响应式设计** - 完美适配各种设备
- 🏳️ **国旗图标** - 支持全球国家和地区旗帜显示

## 安装

1. 从 [Releases](../../releases) 页面下载最新版本的 ZIP 文件
2. 上传 Komari

## 项目结构

```
komari-mikus/
├── .github/
│   └── workflows/
│       └── release.yml      # GitHub Actions 工作流
├── dist/
│   ├── assets/
│   │   ├── flags/           # 国旗图标
│   │   ├── img/             # 图片资源
│   │   ├── app.js           # 应用脚本
│   │   └── style.css        # 样式文件
│   └── index.html           # 主页面
├── komari-theme.json        # 主题配置
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
