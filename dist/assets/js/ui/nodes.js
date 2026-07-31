/**
 * @module ui/nodes
 * @description 节点列表核心逻辑（分组过滤 + 统计栏 + 指标计算 + 渲染编排）
 * @dependencies core/state.js, i18n/index.js, utils/format.js, utils/helpers.js, ui/preloader.js, ui/nodes-grid.js, ui/nodes-table.js
 * @exports renderAll, renderGrid, renderTable, renderStatsBar, renderGroupFilter, getFilteredNodes, getGroups, calculateNodeMetrics
 */

import { state } from '../core/state.js';
import { t } from '../i18n/index.js';
import { formatBytes, formatOS } from '../utils/format.js';
import { escapeHtml, getLatestPing, getPingLevel, getCountryFlag, getShortOs, getUsageLevel } from '../utils/helpers.js';
import { updateGreetingSubtitle } from './preloader.js';
import { renderGrid } from './nodes-grid.js';
import { renderTable } from './nodes-table.js';

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
    const ramTotal = (rt.ram && rt.ram.total != null) ? rt.ram.total : (node.mem_total || 0);
    const ramPercent = (ramUsed !== null && ramTotal > 0) ? (ramUsed / ramTotal * 100) : null;
    const diskUsed = rt.disk ? rt.disk.used : null;
    const diskTotal = (rt.disk && rt.disk.total != null) ? rt.disk.total : (node.disk_total || 0);
    const diskPercent = (diskUsed !== null && diskTotal > 0) ? (diskUsed / diskTotal * 100) : null;
    const swapUsed = rt.swap ? rt.swap.used : 0;
    const swapTotal = (rt.swap && rt.swap.total != null) ? rt.swap.total : (node.swap_total || 0);
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
