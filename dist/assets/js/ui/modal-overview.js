/**
 * @module ui/modal-overview
 * @description 模态框概览页渲染（节点详细信息 + 指标展示）
 * @dependencies i18n/index.js, utils/format.js, utils/helpers.js, ui/modal.js
 * @exports renderOverviewPage
 */

import { t } from '../i18n/index.js';
import { formatBytes, formatUptime } from '../utils/format.js';
import { escapeHtml } from '../utils/helpers.js';
import { getModalElements } from './modal.js';

/**
 * 构建模态框信息项 HTML
 * @param {string} label - 标签
 * @param {string} value - 值
 * @param {boolean} nowrap - 是否不换行
 * @returns {string} HTML
 */
function buildInfoItem(label, value, nowrap) {
    const cls = nowrap ? 'modal-info-value modal-info-value-nowrap' : 'modal-info-value';
    return '<div class="modal-info-item"><div class="modal-info-label">' + escapeHtml(label) + '</div><div class="' + cls + '">' + escapeHtml(value) + '</div></div>';
}

/**
 * 渲染概览页信息区域
 * @param {Object} node - 节点对象
 * @param {Object} rt - 实时数据
 * @param {string} uuid - 节点 UUID
 */
export function renderOverviewPage(node, rt, uuid) {
    const els = getModalElements();
    const infoEl = els.modalInfo;
    if (!infoEl) return;

    const ramUsed = rt.ram ? rt.ram.used : null;
    const ramTotal = rt.ram ? rt.ram.total : node.mem_total || 0;
    const diskUsed = rt.disk ? rt.disk.used : null;
    const diskTotal = rt.disk ? rt.disk.total : node.disk_total || 0;
    const swapUsed = rt.swap ? rt.swap.used : null;
    const swapTotal = rt.swap ? rt.swap.total : node.swap_total || 0;
    const load1 = rt.load ? rt.load.load1 : null;
    const load5 = rt.load ? rt.load.load5 : null;
    const load15 = rt.load ? rt.load.load15 : null;
    const process = rt.process || 0;
    const tcpConn = rt.connections ? rt.connections.tcp : 0;
    const udpConn = rt.connections ? rt.connections.udp : 0;
    const netTotalUp = rt.network ? rt.network.totalUp : 0;
    const netTotalDown = rt.network ? rt.network.totalDown : 0;

    const items = [
        buildInfoItem(t('os_info'), node.os || '-'),
        buildInfoItem(t('cpu_model'), node.cpu_name || '-'),
        buildInfoItem(t('arch'), node.arch || '-'),
        buildInfoItem(t('virtualization'), node.virtualization || '-'),
        buildInfoItem(t('memory'), ramUsed !== null ? formatBytes(ramUsed) + ' / ' + formatBytes(ramTotal) : '- / ' + formatBytes(ramTotal)),
        buildInfoItem(t('swap'), swapTotal > 0 ? (swapUsed !== null ? formatBytes(swapUsed) + ' / ' + formatBytes(swapTotal) : '- / ' + formatBytes(swapTotal)) : '-'),
        buildInfoItem(t('disk'), diskUsed !== null ? formatBytes(diskUsed) + ' / ' + formatBytes(diskTotal) : '- / ' + formatBytes(diskTotal)),
        buildInfoItem(t('load'), load1 !== null ? load1.toFixed(2) + ' / ' + (load5 !== null ? load5.toFixed(2) : '-') + ' / ' + (load15 !== null ? load15.toFixed(2) : '-') : '-'),
        buildInfoItem(t('processes'), String(process)),
        buildInfoItem(t('connections'), 'TCP: ' + tcpConn + ' / UDP: ' + udpConn),
        buildInfoItem(t('uptime'), formatUptime(rt.uptime || 0)),
        buildInfoItem(t('network'), t('up') + ': ' + formatBytes(netTotalUp) + ' / ' + t('down') + ': ' + formatBytes(netTotalDown), true)
    ];

    infoEl.innerHTML = items.join('');
}
