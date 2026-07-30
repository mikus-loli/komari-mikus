/**
 * @module ui/nodes
 * @description 节点列表渲染（网格视图 + 表格视图 + 统计栏 + 分组过滤）
 * @dependencies core/state.js, i18n/index.js, utils/format.js, utils/helpers.js, utils/color.js, ui/preloader.js, ui/modal.js
 * @exports renderAll, renderGrid, renderTable, renderStatsBar, renderGroupFilter, getFilteredNodes, getGroups, calculateNodeMetrics
 */

import { state } from '../core/state.js';
import { t } from '../i18n/index.js';
import { formatBytes, formatSpeed, formatPercent, formatUptime, formatExpiry, formatPrice, formatOS } from '../utils/format.js';
import { escapeHtml, parseTagInfo, getLatestPing, getPingLevel, getCountryFlag, getShortOs, getUsageLevel } from '../utils/helpers.js';
import { updateGreetingSubtitle } from './preloader.js';
import { openNodeModal } from './modal.js';

/**
 * 获取所有分组及计数
 * @returns {Object} 分组名 → 节点数映射
 */
export function getGroups() {
    const groups = {};
    state.nodes.forEach(function (node) {
        const g = node.group || '';
        if (!groups[g]) groups[g] = 0;
        groups[g]++;
    });
    return groups;
}

/**
 * 渲染分组过滤器按钮
 */
export function renderGroupFilter() {
    const container = document.getElementById('groupFilter');
    if (!container) return;

    const groups = getGroups();
    const savedGroup = localStorage.getItem('nodeSelectedGroup');
    if (savedGroup !== null && savedGroup !== undefined) {
        state.currentGroup = savedGroup;
    }

    let html = '<button class="filter-btn' + (state.currentGroup === 'all' ? ' active' : '') + '" data-group="all">' + t('all') + '</button>';

    const keys = Object.keys(groups).sort();
    keys.forEach(function (g) {
        const label = g || t('ungrouped');
        const isActive = state.currentGroup === g;
        html += '<button class="filter-btn' + (isActive ? ' active' : '') + '" data-group="' + escapeHtml(g) + '">' + escapeHtml(label) + '</button>';
    });

    container.innerHTML = html;

    container.querySelectorAll('.filter-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const group = this.getAttribute('data-group');
            state.currentGroup = group;
            localStorage.setItem('nodeSelectedGroup', group);
            renderGroupFilter();
            renderAll();
        });
    });
}

/**
 * 获取过滤后的节点列表（按分组 + 搜索关键词）
 * @returns {Array} 过滤并排序后的节点数组
 */
export function getFilteredNodes() {
    let nodes = state.nodes;

    if (state.currentGroup !== 'all') {
        nodes = nodes.filter(function (n) {
            return (n.group || '') === state.currentGroup;
        });
    }

    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        nodes = nodes.filter(function (n) {
            return n.name.toLowerCase().indexOf(q) !== -1 ||
                (n.os || '').toLowerCase().indexOf(q) !== -1 ||
                (n.cpu_name || '').toLowerCase().indexOf(q) !== -1 ||
                (n.group || '').toLowerCase().indexOf(q) !== -1;
        });
    }

    nodes.sort(function (a, b) {
        const aOnline = state.onlineNodes.indexOf(a.uuid) !== -1;
        const bOnline = state.onlineNodes.indexOf(b.uuid) !== -1;
        if (aOnline !== bOnline) return aOnline ? -1 : 1;
        return (a.weight || 0) - (b.weight || 0);
    });

    return nodes;
}

/**
 * 渲染统计栏（节点数、在线数、离线数、总流量）
 */
export function renderStatsBar() {
    const filtered = getFilteredNodes();
    let online = 0;
    let totalTrafficUp = 0;
    let totalTrafficDown = 0;

    filtered.forEach(function (n) {
        if (state.onlineNodes.indexOf(n.uuid) !== -1) {
            online++;
            const rt = state.realtimeData[n.uuid] || {};
            if (rt.network) {
                totalTrafficUp += rt.network.totalUp || 0;
                totalTrafficDown += rt.network.totalDown || 0;
            }
        }
    });

    const totalEl = document.getElementById('totalNodes');
    const onlineEl = document.getElementById('onlineNodes');
    const offlineEl = document.getElementById('offlineNodes');
    const trafficTextEl = document.getElementById('trafficText');

    if (totalEl) totalEl.textContent = filtered.length;
    if (onlineEl) onlineEl.textContent = online;
    if (offlineEl) offlineEl.textContent = filtered.length - online;

    if (trafficTextEl) {
        trafficTextEl.textContent = t('total_upload') + ': ' + formatBytes(totalTrafficUp) + ' / ' + t('total_download') + ': ' + formatBytes(totalTrafficDown);
    }

    updateGreetingSubtitle();
}

/**
 * 计算节点的所有指标数据
 * @param {Object} node - 节点对象
 * @returns {Object} 指标数据对象
 */
export function calculateNodeMetrics(node) {
    const rt = state.realtimeData[node.uuid] || {};

    const cpuUsage = rt.cpu ? rt.cpu.usage : null;
    const ramUsed = rt.ram ? rt.ram.used : null;
    const ramTotal = rt.ram ? rt.ram.total : node.mem_total || 0;
    const ramPercent = (ramUsed !== null && ramTotal > 0) ? (ramUsed / ramTotal * 100) : null;
    const diskUsed = rt.disk ? rt.disk.used : null;
    const diskTotal = rt.disk ? rt.disk.total : node.disk_total || 0;
    const diskPercent = (diskUsed !== null && diskTotal > 0) ? (diskUsed / diskTotal * 100) : null;
    const swapUsed = rt.swap ? rt.swap.used : 0;
    const swapTotal = rt.swap ? rt.swap.total : node.swap_total || 0;
    const swapPercent = swapTotal > 0 ? (swapUsed / swapTotal * 100) : 0;
    const netUp = rt.network ? rt.network.up : 0;
    const netDown = rt.network ? rt.network.down : 0;
    const netTotalUp = rt.network ? rt.network.totalUp : 0;
    const netTotalDown = rt.network ? rt.network.totalDown : 0;
    const uptime = rt.uptime || 0;
    const pingMs = getLatestPing(node.uuid);
    const load1 = rt.load ? rt.load.load1 : null;

    const trafficLimit = node.traffic_limit || 0;
    const trafficLimitType = node.traffic_limit_type || 'max';

    let usedTraffic = 0;
    if (trafficLimit > 0) {
        switch (trafficLimitType) {
            case 'up':
                usedTraffic = netTotalUp;
                break;
            case 'down':
                usedTraffic = netTotalDown;
                break;
            case 'sum':
                usedTraffic = netTotalUp + netTotalDown;
                break;
            case 'min':
                usedTraffic = Math.min(netTotalUp, netTotalDown);
                break;
            default:
                usedTraffic = Math.max(netTotalUp, netTotalDown);
                break;
        }
    }

    const remainingTraffic = trafficLimit > 0 ? Math.max(0, trafficLimit - usedTraffic) : 0;

    return {
        isOnline: state.onlineNodes.indexOf(node.uuid) !== -1,
        cpuUsage: cpuUsage,
        cpuLevel: cpuUsage !== null ? getUsageLevel(cpuUsage) : 'normal',
        ramPercent: ramPercent,
        ramLevel: ramPercent !== null ? getUsageLevel(ramPercent) : 'normal',
        diskPercent: diskPercent,
        diskLevel: diskPercent !== null ? getUsageLevel(diskPercent) : 'normal',
        swapPercent: swapPercent,
        swapLevel: swapTotal > 0 ? getUsageLevel(swapPercent) : 'normal',
        swapTotal: swapTotal,
        netUp: netUp,
        netDown: netDown,
        netTotalUp: netTotalUp,
        netTotalDown: netTotalDown,
        uptime: uptime,
        pingMs: pingMs,
        pingLevel: getPingLevel(pingMs),
        load1: load1,
        flagUrl: getCountryFlag(node.region),
        osShort: getShortOs(node.os),
        osInfo: formatOS(node.os),
        trafficLimit: trafficLimit,
        trafficLimitType: trafficLimitType,
        usedTraffic: usedTraffic,
        remainingTraffic: remainingTraffic
    };
}

/**
 * 渲染指标进度条
 * @param {string} label - 标签
 * @param {number} value - 数值
 * @param {string} level - 等级（normal/warning/danger）
 * @returns {string} HTML
 */
function renderMetricBar(label, value, level) {
    const displayValue = value !== null ? formatPercent(value) : '-';
    const width = value !== null ? Math.min(value, 100) : 0;

    return '<div class="metric">' +
           '<div class="metric-label">' + escapeHtml(label) + '</div>' +
           '<div class="metric-bar"><div class="metric-bar-fill level-' + level + '" style="width:' + width + '%"></div></div>' +
           '<div class="metric-value level-' + level + '">' + displayValue + '</div>' +
           '</div>';
}

/**
 * 渲染节点卡片头部（国旗 + 名称 + OS + 标签）
 * @param {Object} node - 节点对象
 * @param {Object} metrics - 指标数据
 * @returns {string} HTML
 */
function renderNodeCardHeader(node, metrics) {
    let html = '<div class="node-card-header">';

    if (metrics.flagUrl) {
        html += '<span class="node-card-flag" style="background-image: url(\'' + metrics.flagUrl + '\')" title="' + escapeHtml(node.region || '') + '"></span>';
    } else {
        html += '<span class="node-card-flag node-card-flag-placeholder"><span>?</span></span>';
    }

    html += '<div class="node-card-info">';
    html += '<div class="node-card-name">';
    html += '<span class="node-status-dot' + (metrics.isOnline ? '' : ' offline') + '"></span>';
    html += '<span class="node-name-text">' + escapeHtml(node.name) + '</span>';
    html += '</div>';
    html += '<div class="node-card-subtitle">';
    html += '<span class="node-card-os"><span class="os-icon os-icon-' + metrics.osInfo.icon + '"></span>' + escapeHtml(metrics.osInfo.name) + '</span>';

    if (node.tags) {
        const tags = node.tags.split(';').filter(function(t) { return t.trim(); });
        const maxTags = 2;
        tags.slice(0, maxTags).forEach(function(tag) {
            const tagInfo = parseTagInfo(tag);
            html += '<span class="node-api-tag' + tagInfo.className + '">' + escapeHtml(tagInfo.text) + '</span>';
        });
    }

    html += '</div>';
    html += '</div>';
    html += '</div>';

    return html;
}

/**
 * 渲染节点卡片指标区域
 * @param {Object} metrics - 指标数据
 * @returns {string} HTML
 */
function renderNodeMetrics(metrics) {
    let html = '';

    html += renderMetricBar('CPU', metrics.cpuUsage, metrics.cpuLevel);
    html += renderMetricBar('RAM', metrics.ramPercent, metrics.ramLevel);
    html += renderMetricBar('Disk', metrics.diskPercent, metrics.diskLevel);

    if (metrics.swapTotal > 0) {
        html += renderMetricBar('Swap', metrics.swapPercent, metrics.swapLevel);
    } else {
        html += '<div class="metric">';
        html += '<div class="metric-label">Load</div>';
        html += '<div class="metric-value">' + (metrics.load1 !== null ? metrics.load1.toFixed(2) : '-') + '</div>';
        html += '</div>';
    }

    return html;
}

/**
 * 渲染节点卡片底部（价格 + 运行时间 + 到期 + 流量标签 + 网速）
 * 遵循硬约束：第一行价格+uptime+到期（nowrap）；第二行流量标签+网速
 * 剩余流量标签始终显示（若 traffic_limit > 0），不受 show_traffic_tags 开关控制
 * @param {Object} node - 节点对象
 * @param {Object} metrics - 指标数据
 * @param {boolean} showUptime - 是否显示运行时间
 * @param {boolean} showNetwork - 是否显示网速
 * @param {boolean} showTrafficTags - 是否显示流量标签
 * @returns {string} HTML
 */
function renderNodeCardFooter(node, metrics, showUptime, showNetwork, showTrafficTags) {
    let html = '<div class="node-card-footer">';

    const priceText = formatPrice(node.price, node.currency, node.billing_cycle);
    const uptimeText = formatUptime(metrics.uptime);
    const expiry = formatExpiry(node.expired_at);

    html += '<span class="node-info-row">';

    if (priceText) {
        html += '<span class="node-price">' + priceText + '</span>';
    }

    if (uptimeText !== '-') {
        html += '<span class="node-uptime">' + t('uptime_prefix') + ':' + uptimeText + '</span>';
    }

    if (expiry) {
        html += '<span class="node-expiry level-' + expiry.level + '">' + t('remaining') + ':' + expiry.text + '</span>';
    }

    html += '</span>';

    if (showNetwork || showTrafficTags) {
        html += '<span class="node-network-row">';

        if (showTrafficTags) {
            html += '<span class="node-traffic-tag traffic-tag-up" title="' + t('total_upload') + '">↑ ' + formatBytes(metrics.netTotalUp) + '</span>';
            html += '<span class="node-traffic-tag traffic-tag-down" title="' + t('total_download') + '">↓ ' + formatBytes(metrics.netTotalDown) + '</span>';

            if (metrics.trafficLimit > 0) {
                html += '<span class="node-traffic-tag traffic-tag-remaining" title="' + t('traffic_limit') + ': ' + formatBytes(metrics.trafficLimit) + '">' + t('remaining') + ':' + formatBytes(metrics.remainingTraffic) + '</span>';
            }
        }

        if (showNetwork) {
            html += '<span class="node-network-speed">';
            html += '<span class="network-dir"><span class="arrow-up">&#9650;</span>' + formatSpeed(metrics.netUp) + '</span>';
            html += '<span class="network-dir"><span class="arrow-down">&#9660;</span>' + formatSpeed(metrics.netDown) + '</span>';
            html += '</span>';
        }

        html += '</span>';
    }

    html += '</div>';

    return html;
}

/**
 * 渲染单个节点卡片（网格视图）
 * @param {Object} node - 节点对象
 * @param {Object} metrics - 指标数据
 * @param {boolean} showUptime - 是否显示运行时间
 * @param {boolean} showNetwork - 是否显示网速
 * @param {boolean} showPing - 是否显示延迟
 * @param {boolean} showTrafficTags - 是否显示流量标签
 * @returns {string} HTML
 */
function renderNodeCard(node, metrics, showUptime, showNetwork, showPing, showTrafficTags) {
    let html = '';

    html += '<div class="node-card' + (metrics.isOnline ? '' : ' offline') + (state.initialRender ? ' animate-in' : '') + '" data-uuid="' + node.uuid + '">';
    html += renderNodeCardHeader(node, metrics);
    html += '<div class="node-card-metrics">';
    html += renderNodeMetrics(metrics);
    html += '</div>';
    html += renderNodeCardFooter(node, metrics, showUptime, showNetwork, showTrafficTags);
    html += '</div>';

    return html;
}

/**
 * 为节点卡片绑定点击事件
 * @param {HTMLElement} container - 容器元素
 */
function bindNodeCardEvents(container) {
    container.querySelectorAll('.node-card').forEach(function (card) {
        card.addEventListener('click', function () {
            const uuid = this.getAttribute('data-uuid');
            openNodeModal(uuid);
        });
    });
}

/**
 * 渲染网格视图
 */
export function renderGrid() {
    const container = document.getElementById('nodesGrid');
    if (!container) return;

    const nodes = getFilteredNodes();

    if (nodes.length === 0) {
        container.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 15h8M9 9h.01M15 9h.01"/></svg><p>' + t('no_nodes') + '</p></div>';
        return;
    }

    const showUptime = state.themeSettings.show_uptime !== false;
    const showNetwork = state.themeSettings.show_network_speed !== false;
    const showPing = state.themeSettings.show_ping !== false;
    const showTrafficTags = state.themeSettings.show_traffic_tags !== false;

    let html = '';
    nodes.forEach(function (node) {
        const metrics = calculateNodeMetrics(node);
        html += renderNodeCard(node, metrics, showUptime, showNetwork, showPing, showTrafficTags);
    });

    container.innerHTML = html;
    bindNodeCardEvents(container);
}

/**
 * 渲染表格视图
 */
export function renderTable() {
    const container = document.getElementById('nodesTableBody');
    if (!container) return;

    const nodes = getFilteredNodes();

    if (nodes.length === 0) {
        container.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 15h8M9 9h.01M15 9h.01"/></svg><p>' + t('no_nodes') + '</p></div>';
        return;
    }

    const showNetwork = state.themeSettings.show_network_speed !== false;
    const showTrafficTags = state.themeSettings.show_traffic_tags !== false;

    let html = '<div class="table-cards">';
    nodes.forEach(function (node) {
        const metrics = calculateNodeMetrics(node);
        html += renderTableCard(node, metrics, showNetwork, showTrafficTags);
    });
    html += '</div>';

    container.innerHTML = html;
    bindTableCardEvents(container);
}

/**
 * 渲染单个表格卡片
 * @param {Object} node - 节点对象
 * @param {Object} metrics - 指标数据
 * @param {boolean} showNetwork - 是否显示网速
 * @param {boolean} showTrafficTags - 是否显示流量标签
 * @returns {string} HTML
 */
function renderTableCard(node, metrics, showNetwork, showTrafficTags) {
    let html = '';

    html += '<div class="table-card' + (metrics.isOnline ? '' : ' offline') + '" data-uuid="' + node.uuid + '">';
    html += renderTableCardHeader(node, metrics);
    html += '<div class="table-card-metrics">';
    html += renderTableCardMetrics(node, metrics, showNetwork);
    html += renderTableCardTags(node, metrics, showTrafficTags);
    html += '</div>';
    html += '</div>';

    return html;
}

/**
 * 渲染表格卡片头部（状态 + 国旗 + 名称 + 价格 + 到期）
 * @param {Object} node - 节点对象
 * @param {Object} metrics - 指标数据
 * @returns {string} HTML
 */
function renderTableCardHeader(node, metrics) {
    let html = '<div class="table-card-header">';
    html += '<div class="table-card-name-wrap">';
    html += '<span class="table-card-status' + (metrics.isOnline ? '' : ' offline') + '"></span>';
    html += '<span class="table-card-flag-wrap">';
    if (metrics.flagUrl) {
        html += '<span class="table-card-flag" style="background-image: url(\'' + metrics.flagUrl + '\')" title="' + escapeHtml(node.region || '') + '"></span>';
    }
    html += '</span>';
    html += '<span class="table-card-name">' + escapeHtml(node.name) + '</span>';
    html += '</div>';
    html += '<div class="table-card-info">';

    const expiry = formatExpiry(node.expired_at);
    if (expiry || node.price) {
        let priceText = '';
        if (node.price == '-1') {
            priceText = t('free') || '免费';
        } else if (node.price) {
            const currency = node.currency || '¥';
            const cycle = node.billing_cycle;
            let cycleText = '';
            if (cycle) {
                if (cycle === 30 || cycle === 31) {
                    cycleText = '/月';
                } else if (cycle === 365 || cycle === 366) {
                    cycleText = '/年';
                } else if (cycle === 7) {
                    cycleText = '/周';
                } else if (cycle === 1) {
                    cycleText = '/天';
                } else {
                    cycleText = '/' + cycle + '天';
                }
            }
            priceText = currency + node.price + cycleText;
        }
        if (priceText) {
            html += '<span class="table-card-price">价格: ' + priceText + '</span>';
        }
        if (expiry) {
            if (expiry.isLongTerm) {
                html += '<span class="table-card-expiry level-' + expiry.level + '">' + t('long_term') + '</span>';
            } else if (expiry.days >= 0) {
                html += '<span class="table-card-expiry level-' + expiry.level + '">剩余: ' + expiry.days + ' 天</span>';
            } else {
                html += '<span class="table-card-expiry level-' + expiry.level + '">' + expiry.text + '</span>';
            }
        }
    }

    html += '</div>';
    html += '</div>';

    return html;
}

/**
 * 渲染表格卡片指标区域（系统 + CPU + RAM + Disk + 上传/下载）
 * @param {Object} node - 节点对象
 * @param {Object} metrics - 指标数据
 * @param {boolean} showNetwork - 是否显示网速
 * @returns {string} HTML
 */
function renderTableCardMetrics(node, metrics, showNetwork) {
    let html = '';

    const osInfo = metrics.osInfo;
    html += '<div class="table-card-metric table-card-system">';
    html += '<span class="table-card-metric-label">' + t('system') + '</span>';
    html += '<span class="table-card-metric-value"><span class="os-icon os-icon-' + osInfo.icon + '"></span>' + escapeHtml(osInfo.name) + '</span>';
    html += '</div>';

    html += '<div class="table-card-metric">';
    html += '<span class="table-card-metric-label">CPU</span>';
    html += '<span class="table-card-metric-value level-' + metrics.cpuLevel + '">' + (metrics.cpuUsage !== null ? formatPercent(metrics.cpuUsage) : '-') + '</span>';
    html += '<div class="table-card-metric-bar"><div class="table-card-metric-fill level-' + metrics.cpuLevel + '" style="width:' + (metrics.cpuUsage !== null ? Math.min(metrics.cpuUsage, 100) : 0) + '%"></div></div>';
    html += '</div>';

    html += '<div class="table-card-metric">';
    html += '<span class="table-card-metric-label">' + t('ram') + '</span>';
    html += '<span class="table-card-metric-value level-' + metrics.ramLevel + '">' + (metrics.ramPercent !== null ? formatPercent(metrics.ramPercent) : '-') + '</span>';
    html += '<div class="table-card-metric-bar"><div class="table-card-metric-fill level-' + metrics.ramLevel + '" style="width:' + (metrics.ramPercent !== null ? Math.min(metrics.ramPercent, 100) : 0) + '%"></div></div>';
    html += '</div>';

    html += '<div class="table-card-metric">';
    html += '<span class="table-card-metric-label">' + t('disk') + '</span>';
    html += '<span class="table-card-metric-value level-' + metrics.diskLevel + '">' + (metrics.diskPercent !== null ? formatPercent(metrics.diskPercent) : '-') + '</span>';
    html += '<div class="table-card-metric-bar"><div class="table-card-metric-fill level-' + metrics.diskLevel + '" style="width:' + (metrics.diskPercent !== null ? Math.min(metrics.diskPercent, 100) : 0) + '%"></div></div>';
    html += '</div>';

    if (showNetwork) {
        html += '<div class="table-card-metric">';
        html += '<span class="table-card-metric-label">' + t('upload') + '</span>';
        html += '<span class="table-card-metric-value">' + formatSpeed(metrics.netUp) + '</span>';
        html += '</div>';

        html += '<div class="table-card-metric">';
        html += '<span class="table-card-metric-label">' + t('download') + '</span>';
        html += '<span class="table-card-metric-value">' + formatSpeed(metrics.netDown) + '</span>';
        html += '</div>';
    }

    return html;
}

/**
 * 渲染表格卡片标签区域
 * 遵循硬约束：标签顺序为 IPv4/IPv6 → ↑↓流量 → 自定义 → 剩余流量（紫色，最右）
 * 剩余流量标签始终显示（若 traffic_limit > 0），不受 show_traffic_tags 开关控制
 * @param {Object} node - 节点对象
 * @param {Object} metrics - 指标数据
 * @param {boolean} showTrafficTags - 是否显示流量标签
 * @returns {string} HTML
 */
function renderTableCardTags(node, metrics, showTrafficTags) {
    const hasIpv4 = node.ipv4 && typeof node.ipv4 === 'string' && node.ipv4.trim() !== '';
    const hasIpv6 = node.ipv6 && typeof node.ipv6 === 'string' && node.ipv6.trim() !== '';
    const hasIpTags = hasIpv4 || hasIpv6;
    const hasTags = node.tags && node.tags.split(';').filter(function(t) { return t.trim(); }).length > 0;
    const hasTraffic = showTrafficTags && (metrics.netTotalUp > 0 || metrics.netTotalDown > 0);
    const hasRemainingTraffic = metrics.trafficLimit > 0;

    if (!hasIpTags && !hasTags && !hasTraffic && !hasRemainingTraffic) {
        return '';
    }

    let html = '<div class="table-card-metric table-card-metric-tags">';
    html += '<div class="table-card-tags">';

    if (hasIpv4) {
        html += '<span class="table-card-tag tag-ip tag-ipv4">IPv4</span>';
    }
    if (hasIpv6) {
        html += '<span class="table-card-tag tag-ip tag-ipv6">IPv6</span>';
    }

    if (hasTraffic) {
        html += '<span class="table-card-tag tag-traffic tag-upload" title="' + t('total_upload') + '">↑ ' + formatBytes(metrics.netTotalUp) + '</span>';
        html += '<span class="table-card-tag tag-traffic tag-download" title="' + t('total_download') + '">↓ ' + formatBytes(metrics.netTotalDown) + '</span>';
    }

    if (node.tags) {
        const tags = node.tags.split(';').filter(function(t) { return t.trim(); });
        tags.forEach(function(tag) {
            const tagInfo = parseTagInfo(tag);
            html += '<span class="table-card-tag' + tagInfo.className + '">' + escapeHtml(tagInfo.text) + '</span>';
        });
    }

    if (hasRemainingTraffic) {
        html += '<span class="table-card-tag tag-traffic tag-remaining" title="' + t('traffic_limit') + ': ' + formatBytes(metrics.trafficLimit) + '">' + t('remaining_traffic') + ': ' + formatBytes(metrics.remainingTraffic) + '</span>';
    }

    html += '</div>';
    html += '</div>';

    return html;
}

/**
 * 为表格卡片绑定点击事件
 * @param {HTMLElement} container - 容器元素
 */
function bindTableCardEvents(container) {
    container.querySelectorAll('.table-card[data-uuid]').forEach(function (card) {
        card.addEventListener('click', function () {
            const uuid = this.getAttribute('data-uuid');
            openNodeModal(uuid);
        });
    });
}

/**
 * 渲染所有节点（统计栏 + 网格 + 表格）
 */
export function renderAll() {
    renderStatsBar();
    renderGrid();
    renderTable();
    if (state.initialRender) {
        state.initialRender = false;
    }
}
