/**
 * @module i18n/index
 * @description 国际化字典 + 翻译函数 + 语言初始化
 * @dependencies core/state.js
 * @exports t, initLang, applyLang, i18n
 */

import { state } from '../core/state.js';

/** 中文翻译字典 */
const zhCN = {
    total_nodes: '节点总数',
    online: '在线',
    offline: '离线',
    status: '状态',
    name: '名称',
    region: '地区',
    network: '网络',
    uptime: '运行时间',
    uptime_prefix: '已运行',
    cpu_usage: 'CPU 使用率',
    ram_usage: '内存使用率',
    network_traffic: '网络流量',
    disk_usage: '磁盘使用率',
    process_count: '进程数',
    connection_count: '连接数',
    search_placeholder: '搜索节点...',
    loading: '加载中...',
    no_nodes: '暂无节点数据',
    os_info: '系统信息',
    cpu_model: 'CPU 型号',
    memory: '内存',
    swap: '交换分区',
    system: '系统',
    disk: '磁盘',
    ram: '内存',
    upload: '上传',
    download: '下载',
    load: '负载',
    processes: '进程',
    connections: '连接',
    up: '上传',
    down: '下载',
    days: '天',
    hours: '小时',
    minutes: '分钟',
    seconds: '秒',
    all: '全部',
    grid_view: '网格视图',
    table_view: '表格视图',
    toggle_theme: '切换主题',
    switch_lang: '切换语言',
    arch: '架构',
    virtualization: '虚拟化',
    ungrouped: '未分组',
    ping: '延迟',
    ping_ms: 'ms',
    ping_latency: '网络延迟',
    ping_chart: '延迟趋势',
    avg_ping: '平均延迟',
    packet_loss: '丢包率',
    overview: '概览',
    latency_detail: '延迟详情',
    min_ping: '最低延迟',
    max_ping: '最高延迟',
    avg_latency: '平均延迟',
    tasks: '监测任务',
    time_range: '时间范围：',
    good_morning: '早上好',
    good_afternoon: '下午好',
    good_evening: '晚上好',
    welcome_back: '欢迎回来，一切正常运行中',
    expired: '已过期',
    long_term: '长期',
    free: '免费',
    login_required: '登录后查看历史数据',
    task: '任务',
    total_upload: '总上传',
    total_download: '总下载',
    traffic_overview: '流量概览',
    traffic_limit: '流量限制',
    remaining_traffic: '剩余',
    remaining: '剩余',
    latency_not_configured: '请在后台节点编辑中设置延迟监测任务',
    month: '月',
    quarter: '季',
    half_year: '半年',
    year: '年',
    two_years: '两年',
    three_years: '三年',
    five_years: '五年'
};

/** 英文翻译字典 */
const en = {
    total_nodes: 'Total Nodes',
    online: 'Online',
    offline: 'Offline',
    status: 'Status',
    name: 'Name',
    region: 'Region',
    network: 'Network',
    uptime: 'Uptime',
    uptime_prefix: 'Running',
    cpu_usage: 'CPU Usage',
    ram_usage: 'RAM Usage',
    network_traffic: 'Network Traffic',
    disk_usage: 'Disk Usage',
    process_count: 'Processes',
    connection_count: 'Connections',
    search_placeholder: 'Search nodes...',
    loading: 'Loading...',
    no_nodes: 'No node data available',
    os_info: 'System Info',
    cpu_model: 'CPU Model',
    memory: 'Memory',
    swap: 'Swap',
    system: 'System',
    disk: 'Disk',
    ram: 'RAM',
    upload: 'Upload',
    download: 'Download',
    load: 'Load',
    processes: 'Processes',
    connections: 'Connections',
    up: 'Up',
    down: 'Down',
    days: 'd',
    hours: 'h',
    minutes: 'm',
    seconds: 's',
    all: 'All',
    grid_view: 'Grid View',
    table_view: 'Table View',
    toggle_theme: 'Toggle Theme',
    switch_lang: 'Switch Language',
    arch: 'Arch',
    virtualization: 'Virtualization',
    ungrouped: 'Ungrouped',
    ping: 'Ping',
    ping_ms: 'ms',
    ping_latency: 'Network Latency',
    ping_chart: 'Latency Trend',
    avg_ping: 'Avg Ping',
    packet_loss: 'Packet Loss',
    overview: 'Overview',
    latency_detail: 'Latency Detail',
    min_ping: 'Min Ping',
    max_ping: 'Max Ping',
    avg_latency: 'Avg Latency',
    tasks: 'Monitor Tasks',
    time_range: 'Time Range:',
    good_morning: 'Good Morning',
    good_afternoon: 'Good Afternoon',
    good_evening: 'Good Evening',
    welcome_back: 'Welcome back, everything is running smoothly',
    expired: 'Expired',
    long_term: 'Long Term',
    free: 'Free',
    login_required: 'Login required to view history',
    task: 'Task',
    total_upload: 'Total Upload',
    total_download: 'Total Download',
    traffic_overview: 'Traffic Overview',
    traffic_limit: 'Traffic Limit',
    remaining_traffic: 'Remaining',
    remaining: 'Remaining',
    latency_not_configured: 'Please set up latency monitoring tasks in the admin panel',
    month: 'Month',
    quarter: 'Quarter',
    half_year: 'Half Year',
    year: 'Year',
    two_years: '2 Years',
    three_years: '3 Years',
    five_years: '5 Years'
};

/** 国际化字典集合 */
export const i18n = {
    'zh-CN': zhCN,
    'en': en
};

/**
 * 翻译函数
 * @param {string} key - 翻译键
 * @returns {string} 翻译后的文本
 */
export function t(key) {
    const lang = state.currentLang || 'zh-CN';
    const dict = i18n[lang] || i18n['zh-CN'];
    return dict[key] || key;
}

/**
 * 初始化语言设置
 * 优先级：localStorage('i18nextLng') > 浏览器语言 > 默认 'zh-CN'
 */
export function initLang() {
    const saved = localStorage.getItem('i18nextLng');
    if (saved && i18n[saved]) {
        state.currentLang = saved;
    } else {
        const browserLang = navigator.language || navigator.userLanguage || 'zh-CN';
        if (browserLang.startsWith('zh')) {
            state.currentLang = 'zh-CN';
        } else {
            state.currentLang = 'en';
        }
    }
    applyLang();
}

/**
 * 应用语言到页面
 * 更新所有 data-i18n 元素的文本内容，并处理搜索框 placeholder
 */
export function applyLang() {
    document.documentElement.lang = state.currentLang;
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.placeholder = t('search_placeholder');
    }
}
