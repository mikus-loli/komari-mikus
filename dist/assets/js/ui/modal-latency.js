/**
 * @module ui/modal-latency
 * @description 模态框延迟页渲染（延迟摘要 + 任务列表 + 图例）
 * @dependencies core/state.js, core/constants.js, i18n/index.js, utils/format.js, utils/helpers.js, ui/modal.js
 * @exports renderLatencyPage
 */

import { state } from '../core/state.js';
import { PING_COLORS } from '../core/constants.js';
import { t } from '../i18n/index.js';
import { formatPing } from '../utils/format.js';
import { escapeHtml, getPingLevel, getTaskLatestPing } from '../utils/helpers.js';
import { getModalElements } from './modal.js';

/**
 * 渲染延迟页（摘要 + 任务列表 + 图例）
 * @param {string} uuid - 节点 UUID
 */
export function renderLatencyPage(uuid) {
    const pingInfo = state.pingData[uuid];
    const els = getModalElements();
    const summaryEl = els.latencySummary;
    const tasksEl = els.latencyTasks;
    const legendEl = els.latencyLegend;
    const chartEl = els.latencyChart;

    if (!pingInfo || !pingInfo.tasks || pingInfo.tasks.length === 0) {
        if (summaryEl) summaryEl.innerHTML = '';
        if (legendEl) legendEl.innerHTML = '';
        if (tasksEl) {
            tasksEl.innerHTML = '<div class="latency-empty">' + t('latency_not_configured') + '</div>';
        }
        if (chartEl) {
            const ctx = chartEl.getContext('2d');
            ctx.clearRect(0, 0, chartEl.width, chartEl.height);
        }
        return;
    }

    if (summaryEl && pingInfo.records && pingInfo.records.length > 0) {
        const allValues = pingInfo.records.map(function (r) { return r.value; }).filter(function (v) { return v !== null && v !== undefined && v >= 0; });
        const minPing = allValues.length > 0 ? Math.min.apply(null, allValues) : null;
        const maxPing = allValues.length > 0 ? Math.max.apply(null, allValues) : null;
        const avgPing = allValues.length > 0 ? allValues.reduce(function (a, b) { return a + b; }, 0) / allValues.length : null;

        const summaryItems = [
            '<div class="latency-stat"><div class="latency-stat-value level-' + getPingLevel(minPing) + '">' + formatPing(minPing) + '</div><div class="latency-stat-label">' + t('min_ping') + '</div></div>',
            '<div class="latency-stat"><div class="latency-stat-value level-' + getPingLevel(maxPing) + '">' + formatPing(maxPing) + '</div><div class="latency-stat-label">' + t('max_ping') + '</div></div>',
            '<div class="latency-stat"><div class="latency-stat-value level-' + getPingLevel(avgPing) + '">' + formatPing(avgPing) + '</div><div class="latency-stat-label">' + t('avg_latency') + '</div></div>'
        ];
        summaryEl.innerHTML = summaryItems.join('');
    }

    if (tasksEl && pingInfo.tasks && pingInfo.tasks.length > 0) {
        const taskItems = ['<div class="latency-tasks-title">' + t('tasks') + '</div>'];
        pingInfo.tasks.forEach(function (task, idx) {
            const taskPing = getTaskLatestPing(uuid, task.id);
            const level = getPingLevel(taskPing);
            const color = PING_COLORS[idx % PING_COLORS.length];
            taskItems.push(
                '<div class="latency-task-card" style="border-left-color: ' + color + '">' +
                '<span class="latency-task-name">' + escapeHtml(task.name) + '</span>' +
                '<div class="latency-task-info">' +
                '<span class="latency-task-ping level-' + level + '">' + formatPing(taskPing) + '</span>' +
                (task.loss !== undefined ? '<span class="latency-task-loss">' + t('packet_loss') + ': ' + task.loss.toFixed(1) + '%</span>' : '') +
                '</div></div>'
            );
        });
        tasksEl.innerHTML = taskItems.join('');
    }

    if (legendEl && pingInfo.tasks && pingInfo.tasks.length > 0) {
        const legendItems = pingInfo.tasks.map(function (task, idx) {
            const color = PING_COLORS[idx % PING_COLORS.length];
            return '<div class="latency-legend-item"><span class="latency-legend-color" style="background: ' + color + '"></span>' + escapeHtml(task.name) + '</div>';
        });
        legendEl.innerHTML = legendItems.join('');
    }
}
