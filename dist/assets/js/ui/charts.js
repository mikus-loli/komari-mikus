/**
 * @module ui/charts
 * @description 所有 Canvas 图表渲染（概览图表配置驱动 + 延迟图表多任务 + 网络图表 + tooltip 交互）
 * @dependencies core/state.js, i18n/index.js, utils/format.js, utils/time.js, utils/helpers.js, utils/color.js, algorithms/index.js
 * @exports renderChartByConfig, drawCharts, drawLatencyChart, drawMultiTaskPingChart, drawLineChart, drawNetworkChart, getChartConfigs, createMouseMoveHandler, createTouchMoveHandler, updateNetworkLegend
 * @source app.js L2761-L2789, L2877-L4230
 */

import { state } from '../core/state.js';
import { t } from '../i18n/index.js';
import { formatBytes, formatSpeed, formatAxisSpeed, getSpeedAxisUnit, formatAxisCount, getCountAxisUnit } from '../utils/format.js';
import { timeRangeToHours, formatTimeLabel } from '../utils/time.js';
import { escapeHtml } from '../utils/helpers.js';
import { generateOKLCHColor, getCachedFontFamily } from '../utils/color.js';
import { applyEWMA, lttbDownsampleRecords } from '../algorithms/index.js';

// ==================== 延迟图表 ====================

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

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
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
 * 图表配置系统 - 参考 PurCarte 的配置驱动架构
 * 定义所有图表的配置，实现统一的渲染逻辑
 */
export function getChartConfigs(node, liveData) {
    const colors = ['#F38181', '#FCE38A', '#5BB85B', '#95E1D3', '#AA96DA', '#FCBAD3', '#6C9CE9', '#F4A261'];

    // 提取 liveData 的实际值（liveData 是对象格式）
    const cpuUsage = liveData && liveData.cpu ? liveData.cpu.usage : null;
    const ramUsed = liveData && liveData.ram ? liveData.ram.used : null;
    const ramTotal = liveData && liveData.ram ? liveData.ram.total : (node ? node.mem_total : 0);
    const diskUsed = liveData && liveData.disk ? liveData.disk.used : null;
    const diskTotal = liveData && liveData.disk ? liveData.disk.total : (node ? node.disk_total : 0);
    const processCount = liveData ? liveData.process : null;
    const connTcp = liveData && liveData.connections ? liveData.connections.tcp : null;
    const connUdp = liveData && liveData.connections ? liveData.connections.udp : null;

    return [
        {
            id: 'cpu',
            canvasId: 'cpuChart',
            title: t('cpu_usage'),
            type: 'area',
            dataKey: 'cpu',
            valueFn: function(r) { return r.cpu; },
            liveValue: cpuUsage !== null ? cpuUsage.toFixed(2) + '%' : '-',
            yAxisDomain: [0, 100],
            yAxisFormatter: function(value) { return value.toFixed(0) + '%'; },
            color: colors[0],
            tooltipFormatter: function(value) { return value.toFixed(2) + '%'; },
            tooltipLabel: t('cpu_usage'),
            smoothKeys: ['cpu']
        },
        {
            id: 'ram',
            canvasId: 'ramChart',
            title: t('ram_usage'),
            type: 'area',
            dataKey: 'ram',
            valueFn: function(r) {
                const ramVal = r.ram;
                if (ramVal === null || ramVal === undefined) return null;
                if (ramVal > 100 && r.ram_total > 0) {
                    return (ramVal / r.ram_total) * 100;
                }
                return ramVal;
            },
            liveValue: ramUsed !== null ? formatBytes(ramUsed) + ' / ' + formatBytes(ramTotal) : '-',
            yAxisDomain: [0, 100],
            yAxisFormatter: function(value) { return value.toFixed(0) + '%'; },
            color: colors[1],
            tooltipFormatter: function(value, raw) { return formatBytes(raw ? raw.ram : 0) + ' (' + value.toFixed(0) + '%)'; },
            tooltipLabel: t('ram_usage'),
            smoothKeys: ['ram']
        },
        {
            id: 'network',
            canvasId: 'networkChart',
            title: t('network_traffic'),
            type: 'line',
            series: [
                {
                    dataKey: 'net_in',
                    color: colors[2],
                    tooltipLabel: t('download'),
                    tooltipFormatter: function(value) { return formatSpeed(value); }
                },
                {
                    dataKey: 'net_out',
                    color: colors[3],
                    tooltipLabel: t('upload'),
                    tooltipFormatter: function(value) { return formatSpeed(value); }
                }
            ],
            liveValue: liveData && liveData.network ? ('▲ ' + formatSpeed(liveData.network.up || 0) + '  ▼ ' + formatSpeed(liveData.network.down || 0)) : '-',
            yAxisFormatter: function(value, maxVal) { return formatAxisSpeed(value, maxVal); },
            yAxisUnitFn: function(maxVal) { return getSpeedAxisUnit(maxVal); },
            smoothKeys: ['net_in', 'net_out']
        },
        {
            id: 'disk',
            canvasId: 'diskChart',
            title: t('disk_usage'),
            type: 'area',
            dataKey: 'disk',
            valueFn: function(r) {
                const diskVal = r.disk;
                if (diskVal === null || diskVal === undefined) return null;
                if (diskVal > 100 && r.disk_total > 0) {
                    return (diskVal / r.disk_total) * 100;
                }
                return diskVal;
            },
            liveValue: diskUsed !== null ? formatBytes(diskUsed) + ' / ' + formatBytes(diskTotal) : '-',
            yAxisDomain: [0, 100],
            yAxisFormatter: function(value) { return value.toFixed(0) + '%'; },
            color: colors[4],
            tooltipFormatter: function(value, raw) { return formatBytes(raw ? raw.disk : 0) + ' (' + value.toFixed(0) + '%)'; },
            tooltipLabel: t('disk_usage'),
            smoothKeys: ['disk']
        },
        {
            id: 'process',
            canvasId: 'processChart',
            title: t('process_count'),
            type: 'line',
            dataKey: 'process',
            valueFn: function(r) { return r.process; },
            liveValue: processCount !== null ? String(processCount) : '-',
            yAxisFormatter: function(value, maxVal) { return formatAxisCount(value, maxVal); },
            yAxisUnitFn: function(maxVal) { return getCountAxisUnit(maxVal); },
            color: colors[5],
            tooltipFormatter: function(value) { return Math.round(value); },
            tooltipLabel: t('process_count'),
            smoothKeys: ['process']
        },
        {
            id: 'connections',
            canvasId: 'connectionsChart',
            title: t('connection_count'),
            type: 'line',
            series: [
                {
                    dataKey: 'connections',
                    color: colors[6],
                    tooltipLabel: 'TCP',
                    tooltipFormatter: function(value) { return Math.round(value); }
                },
                {
                    dataKey: 'connections_udp',
                    color: colors[7],
                    tooltipLabel: 'UDP',
                    tooltipFormatter: function(value) { return Math.round(value); }
                }
            ],
            liveValue: connTcp !== null ? ('TCP: ' + connTcp + ' / UDP: ' + (connUdp || 0)) : '-',
            yAxisFormatter: function(value, maxVal) { return formatAxisCount(value, maxVal); },
            yAxisUnitFn: function(maxVal) { return getCountAxisUnit(maxVal); },
            smoothKeys: ['connections', 'connections_udp']
        }
    ];
}

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
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
    const bgColor = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)';

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
 * 绘制平滑曲线（带可选填充）
 */
function drawSmoothAreaLine(ctx, values, color, padding, chartW, chartH, maxVal, minVal, fill) {
    const points = [];
    const range = maxVal - minVal || 1;
    const stepX = chartW / Math.max(values.length - 1, 1);
    const baseY = padding.top + chartH;

    for (let j = 0; j < values.length; j++) {
        if (values[j] === null || values[j] === undefined || isNaN(values[j])) continue;
        const x = padding.left + j * stepX;
        const normalized = Math.max(0, Math.min(1, (values[j] - minVal) / range));
        const y = baseY - normalized * chartH;
        points.push(x, y);
    }

    const pointCount = points.length >> 1;
    if (pointCount < 2) return points;

    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);

    // 密集数据（>50点）用 lineTo，稀疏数据用 quadraticCurveTo
    if (pointCount > 50) {
        for (let k = 2; k < points.length; k += 2) {
            ctx.lineTo(points[k], points[k + 1]);
        }
    } else {
        for (let k = 2; k < points.length; k += 2) {
            const prevX = points[k - 2];
            const prevY = points[k - 1];
            const currX = points[k];
            const currY = points[k + 1];
            const midX = (prevX + currX) * 0.5;
            ctx.quadraticCurveTo(midX, prevY, midX, (prevY + currY) * 0.5);
            ctx.quadraticCurveTo(midX, currY, currX, currY);
        }
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // 填充渐变（仅用于 area 类型）
    if (fill) {
        const lastIdx = points.length - 2;
        ctx.lineTo(points[lastIdx], baseY);
        ctx.lineTo(points[0], baseY);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, padding.top, 0, baseY);
        gradient.addColorStop(0, color + '40');
        gradient.addColorStop(0.5, color + '15');
        gradient.addColorStop(1, color + '02');
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    return points;
}

/**
 * 绘制空图表提示
 */
function drawEmptyChart(canvas) {
    if (!canvas) return;

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

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
    ctx.font = '12px ' + getCachedFontFamily();
    ctx.textAlign = 'center';
    ctx.fillText(t('login_required') || 'Login required to view history', rect.width / 2, rect.height / 2);
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

export function updateNetworkLegend(chartConfigs) {
    const networkConfig = chartConfigs.find(function(c) { return c.id === 'network'; });
    if (networkConfig && networkConfig.series) {
        const uploadSeries = networkConfig.series.find(function(s) { return s.dataKey === 'net_out'; });
        const downloadSeries = networkConfig.series.find(function(s) { return s.dataKey === 'net_in'; });
        const legendEl = document.getElementById('networkLegend');
        if (legendEl) {
            const upDot = legendEl.querySelector('.legend-up .legend-dot');
            const downDot = legendEl.querySelector('.legend-down .legend-dot');
            if (upDot && uploadSeries) upDot.style.background = uploadSeries.color;
            if (downDot && downloadSeries) downDot.style.background = downloadSeries.color;
        }
    }
}

// ==================== 多任务延迟图表 ====================

export function drawMultiTaskPingChart(canvas, records, tasks, options) {
    if (!canvas) return;

    options = options || {};
    const padding = options.padding || { top: 10, right: 20, bottom: 30, left: 50 };
    const timeLabels = options.timeLabels || 6;
    const timeLabelBottomOffset = options.timeLabelBottomOffset || 10;
    const filterFn = options.filterFn || function (v) { return v !== null && v !== undefined && !isNaN(v) && v >= 0; };
    const yAxisSuffix = options.yAxisSuffix || t('ping_ms');

    // 动态生成颜色（使用 OKLCH 色彩空间）
    let colors = [];
    const totalTasks = tasks.length;
    for (let i = 0; i < totalTasks; i++) {
        colors.push(generateOKLCHColor(i, totalTasks));
    }
    // 如果提供了自定义颜色，优先使用
    if (options.colors && options.colors.length >= totalTasks) {
        colors = options.colors;
    }

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

    const w = rect.width;
    const h = rect.height;
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';

    const allValues = records.map(function (r) { return r.value; }).filter(filterFn);

    // 丢包检测：计算中位数，超过阈值的视为丢包
    const sortedValues = allValues.slice().sort(function(a, b) { return a - b; });
    const median = sortedValues.length > 0 ? sortedValues[Math.floor(sortedValues.length / 2)] : 50;
    const lossThreshold = Math.max(500, median * 5); // 丢包阈值

    // 分离正常值和丢包值
    const validValues = allValues.filter(function(v) { return v <= lossThreshold; });
    const lossValues = allValues.filter(function(v) { return v > lossThreshold; });

    // 标记丢包记录（按 task_id 分组）
    const lossRecordsByTask = {};
    records.forEach(function(r) {
        if (r.value !== null && r.value !== undefined && !isNaN(r.value) && r.value > lossThreshold) {
            if (!lossRecordsByTask[r.task_id]) lossRecordsByTask[r.task_id] = [];
            lossRecordsByTask[r.task_id].push(r);
        }
    });

    // 计算数据范围（仅使用正常值）
    const dataMin = validValues.length > 0 ? Math.min.apply(null, validValues) : 0;
    const dataMax = validValues.length > 0 ? Math.max.apply(null, validValues) : 100;

    // 智能决定Y轴范围和刻度间隔
    let minVal, maxVal, step;
    const ADAPTIVE_THRESHOLD = 50; // 自适应阈值

    if (dataMin > ADAPTIVE_THRESHOLD) {
        // 使用自适应范围：根据数据范围选择合适的刻度间隔
        const range = dataMax - dataMin;
        const valuePadding = range * 0.1 || 10; // 给数据范围留10%的边距
        
        // 根据数据范围选择刻度间隔
        const adjustedMin = dataMin - valuePadding;
        const adjustedMax = dataMax + valuePadding;
        const fullRange = adjustedMax - adjustedMin;
        
        // 选择合适的刻度间隔（目标：4-6个刻度）
        if (fullRange <= 60) {
            step = 15; // 0-15-30-45-60
        } else if (fullRange <= 100) {
            step = 20; // 0-20-40-60-80-100
        } else if (fullRange <= 200) {
            step = 50; // 0-50-100-150-200
        } else if (fullRange <= 500) {
            step = 100; // 0-100-200-300-400-500
        } else if (fullRange <= 1000) {
            step = 200; // 0-200-400-600-800-1000
        } else {
            step = 500; // 更大范围
        }
        
        minVal = Math.max(0, Math.floor(adjustedMin / step) * step);
        maxVal = Math.ceil(adjustedMax / step) * step;
    } else {
        // 从0开始：根据数据最大值选择合适的刻度间隔
        const targetMax = Math.max(dataMax, 60); // 至少显示到60ms
        
        // 选择合适的刻度间隔
        if (targetMax <= 60) {
            step = 15; // 0-15-30-45-60
        } else if (targetMax <= 100) {
            step = 20; // 0-20-40-60-80-100
        } else if (targetMax <= 200) {
            step = 50; // 0-50-100-150-200
        } else {
            step = 100; // 更大范围
        }
        
        minVal = 0;
        maxVal = Math.ceil(targetMax / step) * step;
    }

    // 计算刻度数量
    let tickCount = Math.round((maxVal - minVal) / step);
    // 确保刻度数量在合理范围内（最多8个）
    if (tickCount > 8) {
        tickCount = 8;
        step = (maxVal - minVal) / tickCount;
    }

    // 批量绘制网格线
    ctx.beginPath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= tickCount; i++) {
        const y = padding.top + (chartH / tickCount) * i;
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
    }
    ctx.stroke();

    // Y 轴标签
    ctx.font = '10px ' + getCachedFontFamily();
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    for (let i = 0; i <= tickCount; i++) {
        const y = padding.top + (chartH / tickCount) * i;
        const val = maxVal - (maxVal - minVal) * (i / tickCount);
        let yLabel;
        if (maxVal >= 1000) {
            yLabel = (val / 1000).toFixed(val >= 1000 ? 0 : 1) + 's';
        } else {
            yLabel = val.toFixed(0) + yAxisSuffix;
        }
        ctx.fillText(yLabel, padding.left - 6, y + 3);
    }

    const taskMap = {};
    tasks.forEach(function (task) { taskMap[task.id] = task; });

    const taskRecords = {};
    records.forEach(function (r) {
        if (!taskRecords[r.task_id]) taskRecords[r.task_id] = [];
        taskRecords[r.task_id].push(r);
    });

    // 按时间升序排序每个任务的记录（确保时间轴从左到右是正确的时间顺序）
    Object.keys(taskRecords).forEach(function(taskId) {
        taskRecords[taskId].sort(function(a, b) {
            return new Date(a.time) - new Date(b.time);
        });
    });

    const taskIds = Object.keys(taskRecords);
    let colorIdx = 0;

    taskIds.forEach(function (taskId) {
        const taskRecs = taskRecords[taskId];
        const validRecs = taskRecs.filter(function (r) {
            return r.value !== null && r.value !== undefined && !isNaN(r.value) && r.value >= 0 && r.value <= lossThreshold;
        });

        // 如果启用平滑，应用 EWMA 算法
        let smoothedRecs = validRecs;
        if (state.latencyChartSmooth && validRecs.length > 1) {
            const originalValues = validRecs.map(function (r) { return r.value; });
            const smoothedValues = applyEWMA(originalValues, state.ewmaAlpha);

            // 创建平滑后的记录对象（保留原始时间等信息）
            smoothedRecs = validRecs.map(function (r, idx) {
                return {
                    task_id: r.task_id,
                    time: r.time,
                    value: smoothedValues[idx],
                    originalValue: r.value // 保存原始值用于 tooltip
                };
            });
        }

        const color = colors[colorIdx % colors.length];
        colorIdx++;

        // LTTB 降采样
        if (smoothedRecs.length > 200) {
            smoothedRecs = lttbDownsampleRecords(smoothedRecs, 200, function(r) { return r.value; });
        }

        const points = [];
        for (let j = 0; j < smoothedRecs.length; j++) {
            const x = padding.left + (j / Math.max(smoothedRecs.length - 1, 1)) * chartW;
            // 使用 minVal 和 maxVal 进行归一化
            let normalized = (smoothedRecs[j].value - minVal) / (maxVal - minVal);
            normalized = Math.max(0, Math.min(1, normalized));
            const y = padding.top + chartH - normalized * chartH;
            points.push({ x: x, y: y, value: smoothedRecs[j].value, originalValue: smoothedRecs[j].originalValue });
        }

        // 绘制丢包竖线（红色虚线）
        if (lossRecordsByTask[taskId] && lossRecordsByTask[taskId].length > 0) {
            const lossRecs = lossRecordsByTask[taskId];
            ctx.save();
            ctx.strokeStyle = isDark ? 'rgba(255,100,100,0.6)' : 'rgba(220,50,50,0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            for (let li = 0; li < lossRecs.length; li++) {
                let lossIdx = -1;
                for (let lr = 0; lr < taskRecs.length; lr++) {
                    if (taskRecs[lr].time === lossRecs[li].time && taskRecs[lr].task_id === lossRecs[li].task_id) {
                        lossIdx = lr;
                        break;
                    }
                }
                if (lossIdx >= 0) {
                    const lossX = padding.left + (lossIdx / Math.max(taskRecs.length - 1, 1)) * chartW;
                    ctx.beginPath();
                    ctx.moveTo(lossX, padding.top);
                    ctx.lineTo(lossX, padding.top + chartH);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }

        if (points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);

            // EWMA 已经平滑了数据，直接用直线连接即可
            for (let k = 1; k < points.length; k++) {
                ctx.lineTo(points[k].x, points[k].y);
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    });

    // 如果启用平滑，显示提示信息
    if (state.latencyChartSmooth) {
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
        ctx.font = '10px ' + getCachedFontFamily();
        ctx.textAlign = 'right';

        const hintText = 'EWMA 平滑趋势';
        const hintX = w - padding.right - 5;
        const hintY = padding.top + 12; // 放在图表内部顶部

        ctx.fillText(hintText, hintX, hintY);
    }

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    const firstTaskRecs = taskRecords[taskIds[0]] || records;

    // 只显示首尾时间标签（参考 PurCarte 实现）
    const pingHours = state.pingDataHours[state.selectedNodeUuid] !== undefined
        ? state.pingDataHours[state.selectedNodeUuid]
        : timeRangeToHours(state.pingTimeRange);
    const dataLength = firstTaskRecs.length;

    for (let ti = 0; ti <= timeLabels; ti++) {
        const idx = Math.floor((firstTaskRecs.length - 1) * ti / timeLabels);
        const x = padding.left + (ti / timeLabels) * chartW;
        const time = new Date(firstTaskRecs[idx].time);

        // 只在首尾显示时间标签，其他位置为空
        let timeText = '';
        if (idx === 0 || idx === dataLength - 1) {
            timeText = formatTimeLabel(time, pingHours);
        }

        ctx.fillText(timeText, x, h - timeLabelBottomOffset);
    }

    if (options.drawLegend) {
        options.drawLegend(ctx, padding, tasks, colors, textColor);
    }

    canvas._chartData = {
        type: 'ping',
        records: records,
        tasks: tasks,
        taskRecords: taskRecords,
        taskMap: taskMap,
        minVal: minVal,
        maxVal: maxVal,
        padding: padding,
        hours: pingHours
    };

    if (!canvas._chartEventsBound) {
        canvas._chartEventsBound = true;
        canvas.onmousemove = createMouseMoveHandler(canvas);
        canvas.onmouseleave = createHideHandler(canvas);
        canvas.ontouchmove = createTouchMoveHandler(canvas);
        canvas.ontouchend = createHideHandler(canvas);
        canvas.ontouchcancel = createHideHandler(canvas);
    }
}

function drawPingChart(canvasId, records, tasks) {
    const canvas = document.getElementById(canvasId);
    drawMultiTaskPingChart(canvas, records, tasks, {
        padding: { top: 20, right: 16, bottom: 30, left: 50 },
        timeLabels: 5,
        timeLabelBottomOffset: 8,
        filterFn: function (v) { return v !== null && v !== undefined && v >= 0; },
        drawLegend: function (ctx, padding, tasks, colors, textColor) {
            if (tasks.length > 0) {
                ctx.font = '11px ' + getCachedFontFamily();
                ctx.textAlign = 'left';
                let legendX = padding.left + 10;
                tasks.forEach(function (task, idx) {
                    const color = colors[idx % colors.length];
                    ctx.fillStyle = color;
                    ctx.fillRect(legendX, padding.top + 4, 12, 3);
                    ctx.fillStyle = textColor;
                    ctx.fillText(task.name, legendX + 16, padding.top + 10);
                    legendX += ctx.measureText(task.name).width + 30;
                });
            }
        }
    });
}

// ==================== Tooltip 交互系统 ====================

/** 模块私有变量：tooltip DOM 元素缓存 */
let chartTooltip = null;

function getOrCreateTooltip() {
    if (!chartTooltip) {
        chartTooltip = document.createElement('div');
        chartTooltip.className = 'chart-tooltip';
        document.body.appendChild(chartTooltip);
    }
    return chartTooltip;
}

/**
 * 改进的 Tooltip 显示函数 - 参考 PurCarte 的 CustomTooltip
 * 支持配置驱动、毛玻璃效果、智能时间格式化
 */
function showChartTooltip(e, canvas, chartData) {
    const tooltip = getOrCreateTooltip();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = chartData.padding;
    const chartW = rect.width - padding.left - padding.right;
    const chartH = rect.height - padding.top - padding.bottom;

    // 边界检查
    if (x < padding.left || x > rect.width - padding.right || y < padding.top || y > rect.height - padding.bottom) {
        tooltip.classList.remove('visible');
        if (canvas._crosshair) {
            canvas._crosshair.style.display = 'none';
        }
        if (canvas._highlightDot) {
            canvas._highlightDot.style.display = 'none';
        }
        return;
    }

    const ratio = (x - padding.left) / chartW;
    let idx = Math.round(ratio * (chartData.records.length - 1));
    idx = Math.max(0, Math.min(idx, chartData.records.length - 1));

    const record = chartData.records[idx];
    if (!record) {
        tooltip.classList.remove('visible');
        return;
    }

    // 如果 idx 未变化，只更新 tooltip 位置，跳过 innerHTML 重建
    if (canvas._lastTooltipIdx === idx) {
        positionTooltip(tooltip, e);
        return;
    }
    canvas._lastTooltipIdx = idx;

    // 创建十字线和高亮圆点
    let crosshair = canvas._crosshair;
    let highlightDot = canvas._highlightDot;
    if (!crosshair) {
        crosshair = document.createElement('div');
        crosshair.className = 'chart-crosshair';
        crosshair.style.cssText = 'position:absolute;pointer-events:none;display:none;z-index:10;';
        highlightDot = document.createElement('div');
        highlightDot.className = 'chart-highlight-dot';
        const chartSection = canvas.closest('.chart-section');
        const mountParent = chartSection || canvas.parentElement;
        mountParent.style.position = 'relative';
        mountParent.appendChild(crosshair);
        mountParent.appendChild(highlightDot);
        canvas._crosshair = crosshair;
        canvas._highlightDot = highlightDot;
    }

    // 使用 getBoundingClientRect 差值计算定位
    const parentRect = crosshair.parentElement.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const canvasOffsetLeft = canvasRect.left - parentRect.left;
    const canvasOffsetTop = canvasRect.top - parentRect.top;

    const pointX = canvasOffsetLeft + padding.left + (idx / Math.max(chartData.records.length - 1, 1)) * chartW;
    crosshair.style.display = 'block';
    crosshair.style.left = pointX + 'px';
    crosshair.style.top = (canvasOffsetTop + padding.top) + 'px';
    crosshair.style.width = '1px';
    crosshair.style.height = chartH + 'px';
    crosshair.style.background = 'var(--accent)';
    crosshair.style.opacity = '0.5';

    // 计算高亮圆点位置
    let pointY = null;
    let dotColor = 'var(--accent)';
    if (chartData.config) {
        if (chartData.config.series) {
            const series = chartData.config.series[0];
            const seriesValue = record[series.dataKey];
            if (seriesValue !== null && seriesValue !== undefined && !isNaN(seriesValue)) {
                let sNorm = (seriesValue - chartData.minVal) / (chartData.maxVal - chartData.minVal);
                sNorm = Math.max(0, Math.min(1, sNorm));
                pointY = canvasOffsetTop + padding.top + chartH - sNorm * chartH;
                dotColor = series.color;
            }
        } else {
            const singleValue = chartData.config.valueFn(record);
            if (singleValue !== null && singleValue !== undefined && !isNaN(singleValue)) {
                let norm = (singleValue - chartData.minVal) / (chartData.maxVal - chartData.minVal);
                norm = Math.max(0, Math.min(1, norm));
                pointY = canvasOffsetTop + padding.top + chartH - norm * chartH;
                dotColor = chartData.config.color;
            }
        }
    }

    if (pointY !== null) {
        highlightDot.style.display = 'block';
        highlightDot.style.left = pointX + 'px';
        highlightDot.style.top = pointY + 'px';
        highlightDot.style.background = dotColor;
    } else {
        highlightDot.style.display = 'none';
    }

    const time = new Date(record.time);

    // 智能时间格式化：优先使用数据加载时存储的 hours
    let hours = chartData.hours !== undefined
        ? chartData.hours
        : timeRangeToHours(state.historyTimeRange);
    if (chartData.type === 'ping') {
        hours = chartData.hours !== undefined
            ? chartData.hours
            : timeRangeToHours(state.pingTimeRange);
    }

    const timeStr = formatTooltipTime(time, hours);

    // 毛玻璃效果容器
    let html = '<div class="chart-tooltip-glass">';
    html += '<div class="chart-tooltip-time">' + timeStr + '</div>';
    html += '<div class="chart-tooltip-content">';

    // 根据图表类型渲染内容
    if (chartData.config) {
        // 新的配置驱动模式
        const config = chartData.config;

        if (config.series) {
            // 多系列图表（网络）
            config.series.forEach(function(series) {
                const value = record[series.dataKey] || 0;
                const formattedValue = series.tooltipFormatter ? series.tooltipFormatter(value, record) : formatSpeed(value);
                html += '<div class="chart-tooltip-row">';
                html += '<div class="chart-tooltip-indicator" style="background:' + series.color + '"></div>';
                html += '<span class="chart-tooltip-label">' + series.tooltipLabel + '</span>';
                html += '<span class="chart-tooltip-value"><strong>' + formattedValue + '</strong></span>';
                html += '</div>';
            });
        } else {
            // 单系列图表（CPU/RAM）
            const value = config.valueFn(record);
            if (value !== null && value !== undefined && !isNaN(value)) {
                const formattedValue = config.tooltipFormatter ? config.tooltipFormatter(value, record) : value.toFixed(2) + '%';
                html += '<div class="chart-tooltip-row">';
                html += '<div class="chart-tooltip-indicator" style="background:' + config.color + '"></div>';
                html += '<span class="chart-tooltip-label">' + config.tooltipLabel + '</span>';
                html += '<span class="chart-tooltip-value"><strong>' + formattedValue + '</strong></span>';
                html += '</div>';
            }
        }
    } else if (chartData.type === 'ping') {
        // Ping 图表
        const taskRecords = chartData.taskRecords;
        const taskMap = chartData.taskMap;
        const taskIds = Object.keys(taskRecords);

        if (state.latencyChartSmooth) {
            html += '<div class="chart-tooltip-hint">EWMA 平滑趋势</div>';
        }

        taskIds.forEach(function(taskId, colorIdx) {
            const taskRecs = taskRecords[taskId];
            const task = taskMap[taskId];
            if (taskRecs && taskRecs.length > 0) {
                let recIdx = Math.round(ratio * (taskRecs.length - 1));
                recIdx = Math.max(0, Math.min(recIdx, taskRecs.length - 1));
                const taskRec = taskRecs[recIdx];
                if (taskRec && taskRec.value !== null && taskRec.value !== undefined && taskRec.value >= 0) {
                    const color = generateOKLCHColor(colorIdx, taskIds.length);

                    html += '<div class="chart-tooltip-row">';
                    html += '<div class="chart-tooltip-indicator" style="background:' + color + '"></div>';
                    html += '<span class="chart-tooltip-label">' + escapeHtml(task.name) + '</span>';

                    if (taskRec.originalValue !== undefined) {
                        html += '<span class="chart-tooltip-value"><strong>' + taskRec.value.toFixed(1) + t('ping_ms') + '</strong>';
                        html += '<span class="chart-tooltip-original">(' + taskRec.originalValue.toFixed(1) + t('ping_ms') + ')</span></span>';
                    } else {
                        html += '<span class="chart-tooltip-value"><strong>' + taskRec.value.toFixed(1) + t('ping_ms') + '</strong></span>';
                    }

                    html += '</div>';
                }
            }
        });
    }

    html += '</div></div>';

    tooltip.innerHTML = html;
    positionTooltip(tooltip, e);
}

function positionTooltip(tooltip, e) {
    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width || 140;
    const tooltipHeight = tooltipRect.height || 60;

    let leftPos = e.clientX - tooltipWidth - 16;
    if (leftPos < 10) leftPos = e.clientX + 16;

    let topPos = e.clientY - tooltipHeight - 12;
    if (topPos < 10) topPos = e.clientY + 16;

    tooltip.style.left = leftPos + 'px';
    tooltip.style.top = topPos + 'px';
    tooltip.classList.add('visible');
}

/**
 * 智能时间格式化 - 用于 Tooltip
 */
function formatTooltipTime(time, hours) {
    if (hours <= 4) {
        // 1h、4h：显示"小时:分钟:秒"
        return time.getHours().toString().padStart(2, '0') + ':' +
               time.getMinutes().toString().padStart(2, '0') + ':' +
               time.getSeconds().toString().padStart(2, '0');
    } else if (hours <= 24) {
        // 1d：显示"小时:分钟"
        return time.getHours().toString().padStart(2, '0') + ':' +
               time.getMinutes().toString().padStart(2, '0');
    } else {
        // 7d及以上：显示"月-日 小时:分钟"
        return (time.getMonth() + 1).toString().padStart(2, '0') + '-' +
               time.getDate().toString().padStart(2, '0') + ' ' +
               time.getHours().toString().padStart(2, '0') + ':' +
               time.getMinutes().toString().padStart(2, '0');
    }
}

function hideChartTooltip(canvas) {
    const tooltip = getOrCreateTooltip();
    tooltip.classList.remove('visible');
    if (canvas && canvas._crosshair) {
        canvas._crosshair.style.display = 'none';
    }
    if (canvas && canvas._highlightDot) {
        canvas._highlightDot.style.display = 'none';
    }
    if (canvas) {
        canvas._lastTooltipIdx = -1;
    }
}

function createHideHandler(canvas) {
    return function() {
        hideChartTooltip(canvas);
    };
}

export function createTouchMoveHandler(canvas) {
    return function(e) {
        if (e.touches.length === 1) {
            e.preventDefault();
            e.stopPropagation();
            const touch = e.touches[0];
            showChartTooltip({ clientX: touch.clientX, clientY: touch.clientY }, canvas, canvas._chartData);
        }
    };
}

export function createMouseMoveHandler(canvas) {
    let rafId = null;
    let lastEvent = null;
    return function(e) {
        lastEvent = e;
        if (rafId !== null) return;
        rafId = requestAnimationFrame(function() {
            rafId = null;
            if (lastEvent) {
                showChartTooltip(lastEvent, canvas, canvas._chartData);
            }
        });
    };
}

// ==================== 基础折线图 ====================

export function drawLineChart(canvasId, records, valueFn, minVal, maxVal, color, label, hours) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

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

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 24, right: 20, bottom: 32, left: 50 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
    const bgColor = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)';

    ctx.fillStyle = bgColor;
    ctx.fillRect(padding.left, padding.top, chartW, chartH);

    // 批量绘制网格线
    ctx.beginPath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '11px ' + getCachedFontFamily();
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        const val = maxVal - (maxVal - minVal) * (i / 4);
        ctx.fillText(val.toFixed(0) + '%', padding.left - 8, y + 4);
    }

    const range = maxVal - minVal || 1;
    const stepX = chartW / Math.max(records.length - 1, 1);
    const baseY = padding.top + chartH;

    const validPoints = [];
    for (let j = 0; j < records.length; j++) {
        const v = valueFn(records[j]);
        if (v === null || v === undefined || isNaN(v)) continue;
        const x = padding.left + j * stepX;
        const normalized = Math.max(0, Math.min(1, (v - minVal) / range));
        const y = baseY - normalized * chartH;
        validPoints.push(x, y);
    }

    const pointCount = validPoints.length >> 1;
    if (pointCount > 1) {
        ctx.beginPath();
        ctx.moveTo(validPoints[0], validPoints[1]);

        if (pointCount > 50) {
            for (let k = 2; k < validPoints.length; k += 2) {
                ctx.lineTo(validPoints[k], validPoints[k + 1]);
            }
        } else {
            for (let k = 2; k < validPoints.length; k += 2) {
                const prevX = validPoints[k - 2];
                const prevY = validPoints[k - 1];
                const currX = validPoints[k];
                const currY = validPoints[k + 1];
                const midX = (prevX + currX) * 0.5;
                ctx.quadraticCurveTo(midX, prevY, midX, (prevY + currY) * 0.5);
                ctx.quadraticCurveTo(midX, currY, currX, currY);
            }
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        const lastIdx = validPoints.length - 2;
        ctx.lineTo(validPoints[lastIdx], baseY);
        ctx.lineTo(validPoints[0], baseY);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, padding.top, 0, baseY);
        gradient.addColorStop(0, color + '40');
        gradient.addColorStop(0.5, color + '15');
        gradient.addColorStop(1, color + '02');
        ctx.fillStyle = gradient;
        ctx.fill();

        const dotInterval = Math.ceil(pointCount / 20);
        for (let di = 0; di < pointCount; di++) {
            if (di % dotInterval === 0 || di === pointCount - 1) {
                const px = validPoints[di * 2];
                const py = validPoints[di * 2 + 1];
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(px, py, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = isDark ? '#1a1a2e' : '#fff';
                ctx.fill();
            }
        }
    }

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.font = '10px ' + getCachedFontFamily();
    const timeLabels = Math.min(6, Math.floor(chartW / 60));

    // 只显示首尾时间标签（参考 PurCarte 实现）
    const renderHours = hours !== undefined ? hours : timeRangeToHours(state.historyTimeRange);
    const dataLength = records.length;

    for (let ti = 0; ti <= timeLabels; ti++) {
        const idx = Math.floor((records.length - 1) * ti / timeLabels);
        const x = padding.left + (ti / timeLabels) * chartW;
        const time = new Date(records[idx].time);

        // 只在首尾显示时间标签，其他位置为空
        let timeText = '';
        if (idx === 0 || idx === dataLength - 1) {
            timeText = formatTimeLabel(time, renderHours);
        }

        ctx.fillText(timeText, x, h - 10);
    }

    canvas._chartData = {
        type: 'line',
        records: records,
        valueFn: valueFn,
        label: label,
        padding: padding,
        validPoints: validPoints,
        color: color,
        hours: renderHours
    };

    if (!canvas._chartEventsBound) {
        canvas._chartEventsBound = true;
        canvas.onmousemove = function(e) {
            showChartTooltip(e, canvas, canvas._chartData);
        };
        canvas.onmouseleave = createHideHandler(canvas);
        canvas.ontouchmove = function(e) {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                showChartTooltip({ clientX: touch.clientX, clientY: touch.clientY }, canvas, canvas._chartData);
            }
        };
        canvas.ontouchend = createHideHandler(canvas);
    }
}

// ==================== 网络流量图 ====================

export function drawNetworkChart(canvasId, records, hours) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

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

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 24, right: 20, bottom: 32, left: 60 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
    const bgColor = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)';

    ctx.fillStyle = bgColor;
    ctx.fillRect(padding.left, padding.top, chartW, chartH);

    const upValues = records.map(function (r) { return r.net_out || 0; });
    const downValues = records.map(function (r) { return r.net_in || 0; });
    let maxVal = Math.max(Math.max.apply(null, upValues), Math.max.apply(null, downValues), 1024);
    maxVal = Math.ceil(maxVal / 1024) * 1024;

    // 批量绘制网格线
    ctx.beginPath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '11px ' + getCachedFontFamily();
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        ctx.fillText(formatSpeed(maxVal * (1 - i / 4)), padding.left - 8, y + 4);
    }

    const baseY = padding.top + chartH;
    const stepX = chartW / Math.max(records.length - 1, 1);

    function drawNetLine(values, color) {
        const points = [];
        for (let j = 0; j < values.length; j++) {
            if (values[j] === null || values[j] === undefined || isNaN(values[j])) continue;
            const x = padding.left + j * stepX;
            const normalized = Math.max(0, Math.min(1, values[j] / maxVal));
            const y = baseY - normalized * chartH;
            points.push(x, y);
        }

        const pointCount = points.length >> 1;
        if (pointCount < 2) return points;

        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);

        if (pointCount > 50) {
            for (let k = 2; k < points.length; k += 2) {
                ctx.lineTo(points[k], points[k + 1]);
            }
        } else {
            for (let k = 2; k < points.length; k += 2) {
                const prevX = points[k - 2];
                const prevY = points[k - 1];
                const currX = points[k];
                const currY = points[k + 1];
                const midX = (prevX + currX) * 0.5;
                ctx.quadraticCurveTo(midX, prevY, midX, (prevY + currY) * 0.5);
                ctx.quadraticCurveTo(midX, currY, currX, currY);
            }
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        const lastIdx = points.length - 2;
        ctx.lineTo(points[lastIdx], baseY);
        ctx.lineTo(points[0], baseY);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, padding.top, 0, baseY);
        gradient.addColorStop(0, color + '35');
        gradient.addColorStop(0.5, color + '12');
        gradient.addColorStop(1, color + '02');
        ctx.fillStyle = gradient;
        ctx.fill();

        return points;
    }

    const upPoints = drawNetLine(upValues, '#4caf7d');
    const downPoints = drawNetLine(downValues, '#5c9ced');

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.font = '10px ' + getCachedFontFamily();
    const timeLabels = Math.min(6, Math.floor(chartW / 60));

    // 只显示首尾时间标签（参考 PurCarte 实现）
    const renderHours = hours !== undefined ? hours : timeRangeToHours(state.historyTimeRange);
    const dataLength = records.length;

    for (let ti = 0; ti <= timeLabels; ti++) {
        const idx = Math.floor((records.length - 1) * ti / timeLabels);
        const x = padding.left + (ti / timeLabels) * chartW;
        const time = new Date(records[idx].time);

        // 只在首尾显示时间标签，其他位置为空
        let timeText = '';
        if (idx === 0 || idx === dataLength - 1) {
            timeText = formatTimeLabel(time, renderHours);
        }

        ctx.fillText(timeText, x, h - 10);
    }

    canvas._chartData = {
        type: 'network',
        records: records,
        hours: renderHours,
        padding: padding,
        upPoints: upPoints,
        downPoints: downPoints
    };

    if (!canvas._chartEventsBound) {
        canvas._chartEventsBound = true;
        canvas.onmousemove = function(e) {
            showChartTooltip(e, canvas, canvas._chartData);
        };
        canvas.onmouseleave = createHideHandler(canvas);
        canvas.ontouchmove = function(e) {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                showChartTooltip({ clientX: touch.clientX, clientY: touch.clientY }, canvas, canvas._chartData);
            }
        };
        canvas.ontouchend = createHideHandler(canvas);
    }
}
