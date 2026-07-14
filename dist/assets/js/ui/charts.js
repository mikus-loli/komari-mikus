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
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (!records || records.length === 0) {
        var ctx = canvas.getContext('2d');
        var dpr = window.devicePixelRatio || 1;
        var rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, rect.width, rect.height);

        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
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
    var colors = ['#F38181', '#FCE38A', '#5BB85B', '#95E1D3', '#AA96DA', '#FCBAD3', '#6C9CE9', '#F4A261'];

    // 提取 liveData 的实际值（liveData 是对象格式）
    var cpuUsage = liveData && liveData.cpu ? liveData.cpu.usage : null;
    var ramUsed = liveData && liveData.ram ? liveData.ram.used : null;
    var ramTotal = liveData && liveData.ram ? liveData.ram.total : (node ? node.mem_total : 0);
    var diskUsed = liveData && liveData.disk ? liveData.disk.used : null;
    var diskTotal = liveData && liveData.disk ? liveData.disk.total : (node ? node.disk_total : 0);
    var processCount = liveData ? liveData.process : null;
    var connTcp = liveData && liveData.connections ? liveData.connections.tcp : null;
    var connUdp = liveData && liveData.connections ? liveData.connections.udp : null;

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
                var ramVal = r.ram;
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
                var diskVal = r.disk;
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
    var canvas = document.getElementById(config.canvasId);
    if (!canvas) return;

    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    var w = rect.width;
    var h = rect.height;
    var padding = config.padding || { top: 24, right: 20, bottom: 32, left: 50 };
    var chartW = w - padding.left - padding.right;
    var chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    // 主题适配
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    var textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
    var bgColor = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)';

    ctx.fillStyle = bgColor;
    ctx.fillRect(padding.left, padding.top, chartW, chartH);

    // 绘制网格和Y轴
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.font = '11px ' + getCachedFontFamily();
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';

    var yAxisDomain = config.yAxisDomain;
    var yTicks = 4;
    var maxVal, minVal;

    // 动态计算最大值（多系列图表和无固定域的单系列图表）
    if (config.type === 'line' && config.series) {
        var allValues = [];
        config.series.forEach(function(series) {
            records.forEach(function(r) {
                var v = r[series.dataKey];
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
        var singleValues = records.map(config.valueFn).filter(function(v) {
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
    var yAxisUnit = config.yAxisUnitFn ? config.yAxisUnitFn(maxVal) : '';

    for (var i = 0; i <= yTicks; i++) {
        var y = padding.top + (chartH / yTicks) * i;
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
        ctx.setLineDash([]);

        var val = maxVal - (maxVal - minVal) * (i / yTicks);
        var yLabel = config.yAxisFormatter ? config.yAxisFormatter(val, maxVal) : val.toFixed(0);
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
    var DOWNSAMPLE_THRESHOLD = 200;
    var renderRecords = records;
    if (records.length > DOWNSAMPLE_THRESHOLD) {
        var valueExtractor;
        if (config.series) {
            valueExtractor = function(r) {
                var sum = 0;
                config.series.forEach(function(s) {
                    var v = r[s.dataKey];
                    if (v !== null && v !== undefined && !isNaN(v)) sum += Math.abs(v);
                });
                return sum;
            };
        } else {
            valueExtractor = config.valueFn;
        }
        var downsampled = lttbDownsampleRecords(records, DOWNSAMPLE_THRESHOLD, valueExtractor);
        renderRecords = downsampled.map(function(d) { return d.data; });
    }

    // 绘制数据
    if (config.series) {
        // 多系列图表（网络图表）
        config.series.forEach(function(series) {
            var values = renderRecords.map(function(r) { return r[series.dataKey] || 0; });
            drawSmoothAreaLine(ctx, values, series.color, padding, chartW, chartH, maxVal, minVal, false);
        });
    } else {
        // 单系列图表（CPU/RAM 图表）
        var values = renderRecords.map(config.valueFn);
        drawSmoothAreaLine(ctx, values, config.color, padding, chartW, chartH, maxVal, minVal, config.type === 'area');
    }

    // 绘制时间标签（只显示首尾）
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.font = '10px ' + getCachedFontFamily();

    var dataLength = renderRecords.length;
    var firstTime = new Date(renderRecords[0].time);
    var lastTime = new Date(renderRecords[renderRecords.length - 1].time);

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

    canvas.onmousemove = createMouseMoveHandler(canvas);
    canvas.onmouseleave = createHideHandler(canvas);

    canvas.ontouchmove = createTouchMoveHandler(canvas);
    canvas.ontouchend = createHideHandler(canvas);
    canvas.ontouchcancel = createHideHandler(canvas);
}

/**
 * 绘制平滑曲线（带可选填充）
 */
function drawSmoothAreaLine(ctx, values, color, padding, chartW, chartH, maxVal, minVal, fill) {
    var points = [];
    for (var j = 0; j < values.length; j++) {
        if (values[j] === null || values[j] === undefined || isNaN(values[j])) continue;
        var x = padding.left + (j / Math.max(values.length - 1, 1)) * chartW;
        var normalized = (values[j] - minVal) / (maxVal - minVal);
        normalized = Math.max(0, Math.min(1, normalized));
        var y = padding.top + chartH - normalized * chartH;
        points.push({ x: x, y: y, value: values[j] });
    }

    if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        // 使用贝塞尔曲线绘制平滑曲线
        for (var k = 1; k < points.length; k++) {
            var prev = points[k - 1];
            var curr = points[k];
            var cpx = (prev.x + curr.x) / 2;
            ctx.quadraticCurveTo(prev.x + (curr.x - prev.x) * 0.5, prev.y, cpx, (prev.y + curr.y) / 2);
            ctx.quadraticCurveTo(cpx, curr.y, curr.x, curr.y);
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        // 填充渐变（仅用于 area 类型）
        if (fill) {
            ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
            ctx.lineTo(points[0].x, padding.top + chartH);
            ctx.closePath();

            var gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
            gradient.addColorStop(0, color + '40');
            gradient.addColorStop(0.5, color + '15');
            gradient.addColorStop(1, color + '02');
            ctx.fillStyle = gradient;
            ctx.fill();
        }
    }

    return points;
}

/**
 * 绘制空图表提示
 */
function drawEmptyChart(canvas) {
    if (!canvas) return;

    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
    ctx.font = '12px ' + getCachedFontFamily();
    ctx.textAlign = 'center';
    ctx.fillText(t('login_required') || 'Login required to view history', rect.width / 2, rect.height / 2);
}

/**
 * 重构后的 drawCharts 函数 - 使用配置驱动
 */
export function drawCharts(uuid) {
    var hours = timeRangeToHours(state.historyTimeRange);
    var records;

    if (hours === 0) {
        // 实时模式：使用实时历史数据
        records = state.realtimeHistory[uuid] || [];
    } else {
        // 历史模式：直接使用历史数据，不需要额外处理
        records = state.historyData[uuid] || [];
    }

    var node = state.nodes.find(function(n) { return n.uuid === uuid; });
    var liveData = state.realtimeData[uuid];

    // 获取图表配置
    var chartConfigs = getChartConfigs(node, liveData);

    if (records.length === 0) {
        chartConfigs.forEach(function(config) {
            var canvas = document.getElementById(config.canvasId);
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
    var networkConfig = chartConfigs.find(function(c) { return c.id === 'network'; });
    if (networkConfig && networkConfig.series) {
        var uploadSeries = networkConfig.series.find(function(s) { return s.dataKey === 'net_out'; });
        var downloadSeries = networkConfig.series.find(function(s) { return s.dataKey === 'net_in'; });
        var legendEl = document.getElementById('networkLegend');
        if (legendEl) {
            var upDot = legendEl.querySelector('.legend-up .legend-dot');
            var downDot = legendEl.querySelector('.legend-down .legend-dot');
            if (upDot && uploadSeries) upDot.style.background = uploadSeries.color;
            if (downDot && downloadSeries) downDot.style.background = downloadSeries.color;
        }
    }
}

// ==================== 多任务延迟图表 ====================

export function drawMultiTaskPingChart(canvas, records, tasks, options) {
    if (!canvas) return;

    options = options || {};
    var padding = options.padding || { top: 10, right: 20, bottom: 30, left: 50 };
    var timeLabels = options.timeLabels || 6;
    var timeLabelBottomOffset = options.timeLabelBottomOffset || 10;
    var filterFn = options.filterFn || function (v) { return v !== null && v !== undefined && !isNaN(v) && v >= 0; };
    var yAxisSuffix = options.yAxisSuffix || t('ping_ms');

    // 动态生成颜色（使用 OKLCH 色彩空间）
    var colors = [];
    var totalTasks = tasks.length;
    for (var i = 0; i < totalTasks; i++) {
        colors.push(generateOKLCHColor(i, totalTasks));
    }
    // 如果提供了自定义颜色，优先使用
    if (options.colors && options.colors.length >= totalTasks) {
        colors = options.colors;
    }

    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    var w = rect.width;
    var h = rect.height;
    var chartW = w - padding.left - padding.right;
    var chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    var textColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';

    var allValues = records.map(function (r) { return r.value; }).filter(filterFn);

    // 丢包检测：计算中位数，超过阈值的视为丢包
    var sortedValues = allValues.slice().sort(function(a, b) { return a - b; });
    var median = sortedValues.length > 0 ? sortedValues[Math.floor(sortedValues.length / 2)] : 50;
    var lossThreshold = Math.max(500, median * 5); // 丢包阈值

    // 分离正常值和丢包值
    var validValues = allValues.filter(function(v) { return v <= lossThreshold; });
    var lossValues = allValues.filter(function(v) { return v > lossThreshold; });

    // 标记丢包记录（按 task_id 分组）
    var lossRecordsByTask = {};
    records.forEach(function(r) {
        if (r.value !== null && r.value !== undefined && !isNaN(r.value) && r.value > lossThreshold) {
            if (!lossRecordsByTask[r.task_id]) lossRecordsByTask[r.task_id] = [];
            lossRecordsByTask[r.task_id].push(r);
        }
    });

    // 计算数据范围（仅使用正常值）
    var dataMin = validValues.length > 0 ? Math.min.apply(null, validValues) : 0;
    var dataMax = validValues.length > 0 ? Math.max.apply(null, validValues) : 100;

    // 智能决定Y轴范围和刻度间隔
    var minVal, maxVal, step;
    var ADAPTIVE_THRESHOLD = 50; // 自适应阈值

    if (dataMin > ADAPTIVE_THRESHOLD) {
        // 使用自适应范围：根据数据范围选择合适的刻度间隔
        var range = dataMax - dataMin;
        var valuePadding = range * 0.1 || 10; // 给数据范围留10%的边距
        
        // 根据数据范围选择刻度间隔
        var adjustedMin = dataMin - valuePadding;
        var adjustedMax = dataMax + valuePadding;
        var fullRange = adjustedMax - adjustedMin;
        
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
        var targetMax = Math.max(dataMax, 60); // 至少显示到60ms
        
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
    var tickCount = Math.round((maxVal - minVal) / step);
    // 确保刻度数量在合理范围内（最多8个）
    if (tickCount > 8) {
        tickCount = 8;
        step = (maxVal - minVal) / tickCount;
    }

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.font = '10px ' + getCachedFontFamily();
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';

    for (var i = 0; i <= tickCount; i++) {
        var y = padding.top + (chartH / tickCount) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
        // Y轴刻度从 minVal 到 maxVal
        var val = maxVal - (maxVal - minVal) * (i / tickCount);
        var yLabel;
        if (maxVal >= 1000) {
            yLabel = (val / 1000).toFixed(val >= 1000 ? 0 : 1) + 's';
        } else {
            yLabel = val.toFixed(0) + yAxisSuffix;
        }
        ctx.fillText(yLabel, padding.left - 6, y + 3);
    }

    var taskMap = {};
    tasks.forEach(function (task) { taskMap[task.id] = task; });

    var taskRecords = {};
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

    var taskIds = Object.keys(taskRecords);
    var colorIdx = 0;

    taskIds.forEach(function (taskId) {
        var taskRecs = taskRecords[taskId];
        var validRecs = taskRecs.filter(function (r) {
            return r.value !== null && r.value !== undefined && !isNaN(r.value) && r.value >= 0 && r.value <= lossThreshold;
        });

        // 如果启用平滑，应用 EWMA 算法
        var smoothedRecs = validRecs;
        if (state.latencyChartSmooth && validRecs.length > 1) {
            var originalValues = validRecs.map(function (r) { return r.value; });
            var smoothedValues = applyEWMA(originalValues, state.ewmaAlpha);

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

        var color = colors[colorIdx % colors.length];
        colorIdx++;

        // LTTB 降采样
        if (smoothedRecs.length > 200) {
            var downsampled = lttbDownsampleRecords(smoothedRecs, 200, function(r) { return r.value; });
            smoothedRecs = downsampled.map(function(d) { return d.data; });
        }

        var points = [];
        for (var j = 0; j < smoothedRecs.length; j++) {
            var x = padding.left + (j / Math.max(smoothedRecs.length - 1, 1)) * chartW;
            // 使用 minVal 和 maxVal 进行归一化
            var normalized = (smoothedRecs[j].value - minVal) / (maxVal - minVal);
            normalized = Math.max(0, Math.min(1, normalized));
            var y = padding.top + chartH - normalized * chartH;
            points.push({ x: x, y: y, value: smoothedRecs[j].value, originalValue: smoothedRecs[j].originalValue });
        }

        // 绘制丢包竖线（红色虚线）
        if (lossRecordsByTask[taskId] && lossRecordsByTask[taskId].length > 0) {
            var lossRecs = lossRecordsByTask[taskId];
            ctx.save();
            ctx.strokeStyle = isDark ? 'rgba(255,100,100,0.6)' : 'rgba(220,50,50,0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            for (var li = 0; li < lossRecs.length; li++) {
                var lossIdx = -1;
                for (var lr = 0; lr < taskRecs.length; lr++) {
                    if (taskRecs[lr].time === lossRecs[li].time && taskRecs[lr].task_id === lossRecs[li].task_id) {
                        lossIdx = lr;
                        break;
                    }
                }
                if (lossIdx >= 0) {
                    var lossX = padding.left + (lossIdx / Math.max(taskRecs.length - 1, 1)) * chartW;
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
            for (var k = 1; k < points.length; k++) {
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

        var hintText = 'EWMA 平滑趋势';
        var hintX = w - padding.right - 5;
        var hintY = padding.top + 12; // 放在图表内部顶部

        ctx.fillText(hintText, hintX, hintY);
    }

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    var firstTaskRecs = taskRecords[taskIds[0]] || records;

    // 只显示首尾时间标签（参考 PurCarte 实现）
    var hours = timeRangeToHours(state.pingTimeRange);
    var dataLength = firstTaskRecs.length;

    for (var ti = 0; ti <= timeLabels; ti++) {
        var idx = Math.floor((firstTaskRecs.length - 1) * ti / timeLabels);
        var x = padding.left + (ti / timeLabels) * chartW;
        var time = new Date(firstTaskRecs[idx].time);

        // 只在首尾显示时间标签，其他位置为空
        var timeText = '';
        if (idx === 0 || idx === dataLength - 1) {
            timeText = formatTimeLabel(time, hours);
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
        padding: padding
    };

    canvas.onmousemove = createMouseMoveHandler(canvas);
    canvas.onmouseleave = createHideHandler(canvas);
    canvas.ontouchmove = createTouchMoveHandler(canvas);
    canvas.ontouchend = createHideHandler(canvas);
    canvas.ontouchcancel = createHideHandler(canvas);
}

function drawPingChart(canvasId, records, tasks) {
    var canvas = document.getElementById(canvasId);
    drawMultiTaskPingChart(canvas, records, tasks, {
        padding: { top: 20, right: 16, bottom: 30, left: 50 },
        timeLabels: 5,
        timeLabelBottomOffset: 8,
        filterFn: function (v) { return v !== null && v !== undefined && v >= 0; },
        drawLegend: function (ctx, padding, tasks, colors, textColor) {
            if (tasks.length > 0) {
                ctx.font = '11px ' + getCachedFontFamily();
                ctx.textAlign = 'left';
                var legendX = padding.left + 10;
                tasks.forEach(function (task, idx) {
                    var color = colors[idx % colors.length];
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
    var tooltip = getOrCreateTooltip();
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;

    var padding = chartData.padding;
    var chartW = rect.width - padding.left - padding.right;
    var chartH = rect.height - padding.top - padding.bottom;

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

    var ratio = (x - padding.left) / chartW;
    var idx = Math.round(ratio * (chartData.records.length - 1));
    idx = Math.max(0, Math.min(idx, chartData.records.length - 1));

    var record = chartData.records[idx];
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
    var crosshair = canvas._crosshair;
    var highlightDot = canvas._highlightDot;
    if (!crosshair) {
        crosshair = document.createElement('div');
        crosshair.className = 'chart-crosshair';
        crosshair.style.cssText = 'position:absolute;pointer-events:none;display:none;z-index:10;';
        highlightDot = document.createElement('div');
        highlightDot.className = 'chart-highlight-dot';
        var chartSection = canvas.closest('.chart-section');
        var mountParent = chartSection || canvas.parentElement;
        mountParent.style.position = 'relative';
        mountParent.appendChild(crosshair);
        mountParent.appendChild(highlightDot);
        canvas._crosshair = crosshair;
        canvas._highlightDot = highlightDot;
    }

    // 使用 getBoundingClientRect 差值计算定位
    var parentRect = crosshair.parentElement.getBoundingClientRect();
    var canvasRect = canvas.getBoundingClientRect();
    var canvasOffsetLeft = canvasRect.left - parentRect.left;
    var canvasOffsetTop = canvasRect.top - parentRect.top;

    var pointX = canvasOffsetLeft + padding.left + (idx / Math.max(chartData.records.length - 1, 1)) * chartW;
    crosshair.style.display = 'block';
    crosshair.style.left = pointX + 'px';
    crosshair.style.top = (canvasOffsetTop + padding.top) + 'px';
    crosshair.style.width = '1px';
    crosshair.style.height = chartH + 'px';
    crosshair.style.background = 'var(--accent)';
    crosshair.style.opacity = '0.5';

    // 计算高亮圆点位置
    var pointY = null;
    var dotColor = 'var(--accent)';
    if (chartData.config) {
        if (chartData.config.series) {
            var series = chartData.config.series[0];
            var seriesValue = record[series.dataKey];
            if (seriesValue !== null && seriesValue !== undefined && !isNaN(seriesValue)) {
                var sNorm = (seriesValue - chartData.minVal) / (chartData.maxVal - chartData.minVal);
                sNorm = Math.max(0, Math.min(1, sNorm));
                pointY = canvasOffsetTop + padding.top + chartH - sNorm * chartH;
                dotColor = series.color;
            }
        } else {
            var singleValue = chartData.config.valueFn(record);
            if (singleValue !== null && singleValue !== undefined && !isNaN(singleValue)) {
                var norm = (singleValue - chartData.minVal) / (chartData.maxVal - chartData.minVal);
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

    var time = new Date(record.time);

    // 智能时间格式化：根据时间范围选择合适的显示格式
    var hours = chartData.hours || timeRangeToHours(state.historyTimeRange);
    if (chartData.type === 'ping') {
        hours = timeRangeToHours(state.pingTimeRange);
    }

    var timeStr = formatTooltipTime(time, hours);

    // 毛玻璃效果容器
    var html = '<div class="chart-tooltip-glass">';
    html += '<div class="chart-tooltip-time">' + timeStr + '</div>';
    html += '<div class="chart-tooltip-content">';

    // 根据图表类型渲染内容
    if (chartData.config) {
        // 新的配置驱动模式
        var config = chartData.config;

        if (config.series) {
            // 多系列图表（网络）
            config.series.forEach(function(series) {
                var value = record[series.dataKey] || 0;
                var formattedValue = series.tooltipFormatter ? series.tooltipFormatter(value, record) : formatSpeed(value);
                html += '<div class="chart-tooltip-row">';
                html += '<div class="chart-tooltip-indicator" style="background:' + series.color + '"></div>';
                html += '<span class="chart-tooltip-label">' + series.tooltipLabel + '</span>';
                html += '<span class="chart-tooltip-value"><strong>' + formattedValue + '</strong></span>';
                html += '</div>';
            });
        } else {
            // 单系列图表（CPU/RAM）
            var value = config.valueFn(record);
            if (value !== null && value !== undefined && !isNaN(value)) {
                var formattedValue = config.tooltipFormatter ? config.tooltipFormatter(value, record) : value.toFixed(2) + '%';
                html += '<div class="chart-tooltip-row">';
                html += '<div class="chart-tooltip-indicator" style="background:' + config.color + '"></div>';
                html += '<span class="chart-tooltip-label">' + config.tooltipLabel + '</span>';
                html += '<span class="chart-tooltip-value"><strong>' + formattedValue + '</strong></span>';
                html += '</div>';
            }
        }
    } else if (chartData.type === 'ping') {
        // Ping 图表
        var taskRecords = chartData.taskRecords;
        var taskMap = chartData.taskMap;
        var taskIds = Object.keys(taskRecords);

        if (state.latencyChartSmooth) {
            html += '<div class="chart-tooltip-hint">EWMA 平滑趋势</div>';
        }

        taskIds.forEach(function(taskId, colorIdx) {
            var taskRecs = taskRecords[taskId];
            var task = taskMap[taskId];
            if (taskRecs && taskRecs.length > 0) {
                var recIdx = Math.round(ratio * (taskRecs.length - 1));
                recIdx = Math.max(0, Math.min(recIdx, taskRecs.length - 1));
                var taskRec = taskRecs[recIdx];
                if (taskRec && taskRec.value !== null && taskRec.value !== undefined && taskRec.value >= 0) {
                    var color = generateOKLCHColor(colorIdx, taskIds.length);

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
    var tooltipRect = tooltip.getBoundingClientRect();
    var tooltipWidth = tooltipRect.width || 140;
    var tooltipHeight = tooltipRect.height || 60;

    var leftPos = e.clientX - tooltipWidth - 16;
    if (leftPos < 10) leftPos = e.clientX + 16;

    var topPos = e.clientY - tooltipHeight - 12;
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
    var tooltip = getOrCreateTooltip();
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
            var touch = e.touches[0];
            showChartTooltip({ clientX: touch.clientX, clientY: touch.clientY }, canvas, canvas._chartData);
        }
    };
}

export function createMouseMoveHandler(canvas) {
    var rafId = null;
    var lastEvent = null;
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

export function drawLineChart(canvasId, records, valueFn, minVal, maxVal, color, label) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;

    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    var w = rect.width;
    var h = rect.height;
    var padding = { top: 24, right: 20, bottom: 32, left: 50 };
    var chartW = w - padding.left - padding.right;
    var chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    var textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
    var bgColor = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)';

    ctx.fillStyle = bgColor;
    ctx.fillRect(padding.left, padding.top, chartW, chartH);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.font = '11px ' + getCachedFontFamily();
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';

    for (var i = 0; i <= 4; i++) {
        var y = padding.top + (chartH / 4) * i;
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
        ctx.setLineDash([]);

        var val = maxVal - (maxVal - minVal) * (i / 4);
        ctx.fillText(val.toFixed(0) + '%', padding.left - 8, y + 4);
    }

    var values = records.map(valueFn);
    var validPoints = [];
    for (var j = 0; j < values.length; j++) {
        if (values[j] === null || values[j] === undefined || isNaN(values[j])) continue;
        var x = padding.left + (j / Math.max(values.length - 1, 1)) * chartW;
        var normalized = (values[j] - minVal) / (maxVal - minVal);
        normalized = Math.max(0, Math.min(1, normalized));
        var y = padding.top + chartH - normalized * chartH;
        validPoints.push({ x: x, y: y, value: values[j] });
    }

    if (validPoints.length > 1) {
        ctx.beginPath();
        ctx.moveTo(validPoints[0].x, validPoints[0].y);
        
        for (var k = 1; k < validPoints.length; k++) {
            var prev = validPoints[k - 1];
            var curr = validPoints[k];
            var cpx = (prev.x + curr.x) / 2;
            ctx.quadraticCurveTo(prev.x + (curr.x - prev.x) * 0.5, prev.y, cpx, (prev.y + curr.y) / 2);
            ctx.quadraticCurveTo(cpx, curr.y, curr.x, curr.y);
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.lineTo(validPoints[validPoints.length - 1].x, padding.top + chartH);
        ctx.lineTo(validPoints[0].x, padding.top + chartH);
        ctx.closePath();

        var gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
        gradient.addColorStop(0, color + '40');
        gradient.addColorStop(0.5, color + '15');
        gradient.addColorStop(1, color + '02');
        ctx.fillStyle = gradient;
        ctx.fill();

        validPoints.forEach(function(point, idx) {
            if (idx % Math.ceil(validPoints.length / 20) === 0 || idx === validPoints.length - 1) {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(point.x, point.y, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = isDark ? '#1a1a2e' : '#fff';
                ctx.fill();
            }
        });
    }

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.font = '10px ' + getCachedFontFamily();
    var timeLabels = Math.min(6, Math.floor(chartW / 60));

    // 只显示首尾时间标签（参考 PurCarte 实现）
    var hours = timeRangeToHours(state.historyTimeRange);
    var dataLength = records.length;

    for (var ti = 0; ti <= timeLabels; ti++) {
        var idx = Math.floor((records.length - 1) * ti / timeLabels);
        var x = padding.left + (ti / timeLabels) * chartW;
        var time = new Date(records[idx].time);

        // 只在首尾显示时间标签，其他位置为空
        var timeText = '';
        if (idx === 0 || idx === dataLength - 1) {
            timeText = formatTimeLabel(time, hours);
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
        color: color
    };

    canvas.onmousemove = function(e) {
        showChartTooltip(e, canvas, canvas._chartData);
    };
    canvas.onmouseleave = createHideHandler(canvas);
    
    canvas.ontouchmove = function(e) {
        if (e.touches.length === 1) {
            var touch = e.touches[0];
            showChartTooltip({ clientX: touch.clientX, clientY: touch.clientY }, canvas, canvas._chartData);
        }
    };
    canvas.ontouchend = createHideHandler(canvas);
}

// ==================== 网络流量图 ====================

export function drawNetworkChart(canvasId, records) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;

    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    var w = rect.width;
    var h = rect.height;
    var padding = { top: 24, right: 20, bottom: 32, left: 60 };
    var chartW = w - padding.left - padding.right;
    var chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    var textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
    var bgColor = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)';

    ctx.fillStyle = bgColor;
    ctx.fillRect(padding.left, padding.top, chartW, chartH);

    var upValues = records.map(function (r) { return r.net_out || 0; });
    var downValues = records.map(function (r) { return r.net_in || 0; });
    var maxVal = Math.max(Math.max.apply(null, upValues), Math.max.apply(null, downValues), 1024);
    maxVal = Math.ceil(maxVal / 1024) * 1024;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.font = '11px ' + getCachedFontFamily();
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';

    for (var i = 0; i <= 4; i++) {
        var y = padding.top + (chartH / 4) * i;
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillText(formatSpeed(maxVal * (1 - i / 4)), padding.left - 8, y + 4);
    }

    function drawSmoothLine(values, color) {
        var points = [];
        for (var j = 0; j < values.length; j++) {
            if (values[j] === null || values[j] === undefined || isNaN(values[j])) continue;
            var x = padding.left + (j / Math.max(values.length - 1, 1)) * chartW;
            var normalized = values[j] / maxVal;
            normalized = Math.max(0, Math.min(1, normalized));
            var y = padding.top + chartH - normalized * chartH;
            points.push({ x: x, y: y, value: values[j] });
        }

        if (points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            
            for (var k = 1; k < points.length; k++) {
                var prev = points[k - 1];
                var curr = points[k];
                var cpx = (prev.x + curr.x) / 2;
                ctx.quadraticCurveTo(prev.x + (curr.x - prev.x) * 0.5, prev.y, cpx, (prev.y + curr.y) / 2);
                ctx.quadraticCurveTo(cpx, curr.y, curr.x, curr.y);
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.stroke();

            ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
            ctx.lineTo(points[0].x, padding.top + chartH);
            ctx.closePath();

            var gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
            gradient.addColorStop(0, color + '35');
            gradient.addColorStop(0.5, color + '12');
            gradient.addColorStop(1, color + '02');
            ctx.fillStyle = gradient;
            ctx.fill();
        }
        return points;
    }

    var upPoints = drawSmoothLine(upValues, '#4caf7d');
    var downPoints = drawSmoothLine(downValues, '#5c9ced');

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.font = '10px ' + getCachedFontFamily();
    var timeLabels = Math.min(6, Math.floor(chartW / 60));

    // 只显示首尾时间标签（参考 PurCarte 实现）
    var hours = timeRangeToHours(state.historyTimeRange);
    var dataLength = records.length;

    for (var ti = 0; ti <= timeLabels; ti++) {
        var idx = Math.floor((records.length - 1) * ti / timeLabels);
        var x = padding.left + (ti / timeLabels) * chartW;
        var time = new Date(records[idx].time);

        // 只在首尾显示时间标签，其他位置为空
        var timeText = '';
        if (idx === 0 || idx === dataLength - 1) {
            timeText = formatTimeLabel(time, hours);
        }

        ctx.fillText(timeText, x, h - 10);
    }

    canvas._chartData = {
        type: 'network',
        records: records,
        padding: padding,
        upPoints: upPoints,
        downPoints: downPoints
    };

    canvas.onmousemove = function(e) {
        showChartTooltip(e, canvas, canvas._chartData);
    };
    canvas.onmouseleave = createHideHandler(canvas);
    
    canvas.ontouchmove = function(e) {
        if (e.touches.length === 1) {
            var touch = e.touches[0];
            showChartTooltip({ clientX: touch.clientX, clientY: touch.clientY }, canvas, canvas._chartData);
        }
    };
    canvas.ontouchend = createHideHandler(canvas);
}
