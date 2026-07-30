import { state } from '../../core/state.js';
import { t } from '../../i18n/index.js';
import { getCachedFontFamily } from '../../utils/color.js';
import { lttbDownsampleRecords } from '../../algorithms/index.js';
import { formatTimeLabel, timeRangeToHours } from '../../utils/time.js';
import { drawSmoothAreaLine, drawEmptyChart, createMouseMoveHandler, createHideHandler, createTouchMoveHandler } from './utils.js';
import { getChartConfigs, updateNetworkLegend } from './config.js';
import { drawLineChart } from './line.js';
import { drawNetworkChart } from './network.js';
import { drawMultiTaskPingChart } from './latency.js';

// ==================== 延迟图表入口 ====================

export function drawLatencyChart(canvasId, records, tasks) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (!records || records.length === 0) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const targetW = Math.round(rect.width * dpr);
        const targetH = Math.round(rect.height * dpr);

        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
            ctx.scale(dpr, dpr);
        } else {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        ctx.clearRect(0, 0, rect.width, rect.height);

        const cs = getComputedStyle(document.documentElement);
        ctx.fillStyle = cs.getPropertyValue('--chart-empty-text').trim();
        ctx.font = '12px ' + getCachedFontFamily();
        ctx.textAlign = 'center';
        ctx.fillText(t('login_required') || 'Login required to view history', rect.width / 2, rect.height / 2);
        return;
    }

    drawMultiTaskPingChart(canvas, records, tasks, {
        padding: { top: 10, right: 20, bottom: 30, left: 50 },
        timeLabels: 6,
        timeLabelBottomOffset: 10
    });
}

// ==================== 配置驱动的图表系统 ====================

/**
 * 统一的图表绘制函数 - 根据配置渲染图表
 * 参考 PurCarte 的 renderChart 函数设计
 */
export function renderChartByConfig(config, records, hours) {
    const canvas = document.getElementById(config.canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);

    // 仅在尺寸变化时才重设 Canvas（避免不必要的上下文重置）
    if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        ctx.scale(dpr, dpr);
    } else {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const w = rect.width;
    const h = rect.height;
    const padding = config.padding || { top: 24, right: 20, bottom: 32, left: 50 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    // 主题适配
    const cs = getComputedStyle(document.documentElement);
    const gridColor = cs.getPropertyValue('--chart-grid').trim();
    const textColor = cs.getPropertyValue('--chart-text').trim();
    const bgColor = cs.getPropertyValue('--chart-bg').trim();

    ctx.fillStyle = bgColor;
    ctx.fillRect(padding.left, padding.top, chartW, chartH);

    // 绘制网格线（批量路径，减少 draw call）
    ctx.beginPath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    const yAxisDomain = config.yAxisDomain;
    const yTicks = 4;
    let maxVal, minVal;

    // 动态计算最大值（多系列图表和无固定域的单系列图表）
    if (config.type === 'line' && config.series) {
        const allValues = [];
        config.series.forEach(function(series) {
            records.forEach(function(r) {
                const v = r[series.dataKey];
                if (v !== null && v !== undefined && !isNaN(v)) {
                    allValues.push(v);
                }
            });
        });
        maxVal = allValues.length > 0 ? Math.max.apply(null, allValues) : 1024;
        // 智能对齐：按数据量级选择步长
        if (maxVal >= 1024 * 1024 * 1024) {
            maxVal = Math.ceil(maxVal / (1024 * 1024 * 1024)) * (1024 * 1024 * 1024);
        } else if (maxVal >= 1024 * 1024) {
            maxVal = Math.ceil(maxVal / (1024 * 1024)) * (1024 * 1024);
        } else if (maxVal >= 1024) {
            maxVal = Math.ceil(maxVal / 1024) * 1024;
        } else {
            maxVal = Math.ceil(maxVal / 100) * 100;
        }
        minVal = 0;
    } else if (!yAxisDomain && config.valueFn) {
        // 单系列无固定域：动态计算
        const singleValues = records.map(config.valueFn).filter(function(v) {
            return v !== null && v !== undefined && !isNaN(v);
        });
        maxVal = singleValues.length > 0 ? Math.max.apply(null, singleValues) : 100;
        // 智能对齐
        if (maxVal >= 10000) {
            maxVal = Math.ceil(maxVal / 1000) * 1000;
        } else if (maxVal >= 1000) {
            maxVal = Math.ceil(maxVal / 100) * 100;
        } else if (maxVal >= 100) {
            maxVal = Math.ceil(maxVal / 50) * 50;
        } else {
            maxVal = Math.ceil(maxVal / 10) * 10;
        }
        maxVal = Math.max(maxVal, 10);
        minVal = 0;
    } else {
        maxVal = yAxisDomain ? yAxisDomain[1] : 100;
        minVal = yAxisDomain ? yAxisDomain[0] : 0;
    }

    // 动态 Y 轴单位
    const yAxisUnit = config.yAxisUnitFn ? config.yAxisUnitFn(maxVal) : '';

    for (let i = 0; i <= yTicks; i++) {
        const y = padding.top + (chartH / yTicks) * i;
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 绘制 Y 轴标签
    ctx.font = '11px ' + getCachedFontFamily();
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    for (let i = 0; i <= yTicks; i++) {
        const y = padding.top + (chartH / yTicks) * i;
        const val = maxVal - (maxVal - minVal) * (i / yTicks);
        const yLabel = config.yAxisFormatter ? config.yAxisFormatter(val, maxVal) : val.toFixed(0);
        ctx.fillText(yLabel, padding.left - 8, y + 4);
    }

    // 在图表右上角显示 Y 轴单位
    if (yAxisUnit) {
        ctx.fillStyle = textColor;
        ctx.textAlign = 'right';
        ctx.font = '10px ' + getCachedFontFamily();
        ctx.fillText(yAxisUnit, w - padding.right, padding.top - 6);
        ctx.textAlign = 'right';
    }

    // LTTB 降采样
    const DOWNSAMPLE_THRESHOLD = 200;
    let renderRecords = records;
    if (records.length > DOWNSAMPLE_THRESHOLD) {
        let valueExtractor;
        if (config.series) {
            valueExtractor = function(r) {
                let sum = 0;
                config.series.forEach(function(s) {
                    const v = r[s.dataKey];
                    if (v !== null && v !== undefined && !isNaN(v)) sum += Math.abs(v);
                });
                return sum;
            };
        } else {
            valueExtractor = config.valueFn;
        }
        renderRecords = lttbDownsampleRecords(records, DOWNSAMPLE_THRESHOLD, valueExtractor);
    }

    // 绘制数据
    if (config.series) {
        // 多系列图表（网络图表）
        config.series.forEach(function(series) {
            const values = renderRecords.map(function(r) { return r[series.dataKey] || 0; });
            drawSmoothAreaLine(ctx, values, series.color, padding, chartW, chartH, maxVal, minVal, false);
        });
    } else {
        // 单系列图表（CPU/RAM 图表）
        const values = renderRecords.map(config.valueFn);
        drawSmoothAreaLine(ctx, values, config.color, padding, chartW, chartH, maxVal, minVal, config.type === 'area');
    }

    // 绘制时间标签（只显示首尾）
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.font = '10px ' + getCachedFontFamily();

    const dataLength = renderRecords.length;
    const firstTime = new Date(renderRecords[0].time);
    const lastTime = new Date(renderRecords[renderRecords.length - 1].time);

    // 左侧时间标签
    ctx.fillText(formatTimeLabel(firstTime, hours), padding.left, h - 10);
    // 右侧时间标签
    ctx.fillText(formatTimeLabel(lastTime, hours), w - padding.right, h - 10);

    // 存储图表数据用于 Tooltip
    canvas._chartData = {
        type: config.series ? 'network' : 'line',
        config: config,
        records: renderRecords,
        padding: padding,
        maxVal: maxVal,
        minVal: minVal,
        hours: hours
    };

    // 仅首次绑定事件（避免重复创建闭包）
    if (!canvas._chartEventsBound) {
        canvas._chartEventsBound = true;
        canvas.onmousemove = createMouseMoveHandler(canvas);
        canvas.onmouseleave = createHideHandler(canvas);
        canvas.ontouchmove = createTouchMoveHandler(canvas);
        canvas.ontouchend = createHideHandler(canvas);
        canvas.ontouchcancel = createHideHandler(canvas);
    }
}

/**
 * 重构后的 drawCharts 函数 - 使用配置驱动
 */
export function drawCharts(uuid) {
    // 使用数据加载时存储的 hours，确保时间格式与数据一致
    const hours = state.historyDataHours[uuid] !== undefined
        ? state.historyDataHours[uuid]
        : timeRangeToHours(state.historyTimeRange);
    let records;

    if (hours === 0) {
        // 实时模式：使用实时历史数据
        records = state.realtimeHistory[uuid] || [];
    } else {
        // 历史模式：直接使用历史数据，不需要额外处理
        records = state.historyData[uuid] || [];
    }

    const node = state.nodes.find(function(n) { return n.uuid === uuid; });
    const liveData = state.realtimeData[uuid];

    // 获取图表配置
    const chartConfigs = getChartConfigs(node, liveData);

    if (records.length === 0) {
        chartConfigs.forEach(function(config) {
            const canvas = document.getElementById(config.canvasId);
            drawEmptyChart(canvas);
        });
        return;
    }

    // 根据配置渲染每个图表
    chartConfigs.forEach(function(config) {
        renderChartByConfig(config, records, hours);
    });

    updateNetworkLegend(chartConfigs);
}

// ==================== Re-exports ====================

export { getChartConfigs, updateNetworkLegend } from './config.js';
export { drawLineChart } from './line.js';
export { drawNetworkChart } from './network.js';
export { drawMultiTaskPingChart } from './latency.js';
export { createMouseMoveHandler, createTouchMoveHandler } from './utils.js';
