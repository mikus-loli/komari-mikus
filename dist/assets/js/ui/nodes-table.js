/**
 * @module ui/nodes-table
 * @description 表格视图渲染（表格卡片 + 头部/指标/标签区域）
 * @dependencies core/state.js, i18n/index.js, utils/format.js, utils/helpers.js, ui/modal.js, ui/nodes.js
 * @exports renderTable
 */

import { state } from '../core/state.js';
import { t } from '../i18n/index.js';
import { formatBytes, formatSpeed, formatPercent, formatExpiry } from '../utils/format.js';
import { escapeHtml, parseTagInfo } from '../utils/helpers.js';
import { openNodeModal } from './modal.js';
import { getFilteredNodes, calculateNodeMetrics } from './nodes.js';

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
