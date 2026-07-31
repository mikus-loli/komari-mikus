import { state } from '../../core/state.js';
import { t } from '../../i18n/index.js';
import { generateOKLCHColor, getCachedFontFamily } from '../../utils/color.js';
import { applyEWMA, lttbDownsampleRecords } from '../../algorithms/index.js';
import { timeRangeToHours, formatTimeLabel } from '../../utils/time.js';
import { createMouseMoveHandler, createHideHandler, createTouchMoveHandler } from './utils.js';

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

    const cs = getComputedStyle(document.documentElement);
    const gridColor = cs.getPropertyValue('--chart-latency-grid').trim();
    const textColor = cs.getPropertyValue('--chart-latency-text').trim();

    const allValues = records.map(function (r) { return r.value; }).filter(filterFn);

    // 丢包检测：计算中位数，超过阈值的视为丢包
    const sortedValues = allValues.slice().sort(function(a, b) { return a - b; });
    const median = sortedValues.length > 0 ? sortedValues[Math.floor(sortedValues.length / 2)] : 50;
    const lossThreshold = Math.max(500, median * 5); // 丢包阈值

    // 分离正常值和丢包值
    const validValues = allValues.filter(function(v) { return v <= lossThreshold; });

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
            ctx.strokeStyle = cs.getPropertyValue('--chart-loss-line').trim();
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
        ctx.fillStyle = cs.getPropertyValue('--chart-hint-text').trim();
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

