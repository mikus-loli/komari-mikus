import { state } from '../../core/state.js';
import { t } from '../../i18n/index.js';
import { formatSpeed } from '../../utils/format.js';
import { timeRangeToHours } from '../../utils/time.js';
import { escapeHtml } from '../../utils/helpers.js';
import { generateOKLCHColor, getCachedFontFamily } from '../../utils/color.js';

/**
 * 绘制平滑曲线（带可选填充）
 */
export function drawSmoothAreaLine(ctx, values, color, padding, chartW, chartH, maxVal, minVal, fill) {
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
export function drawEmptyChart(canvas) {
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

    const cs = getComputedStyle(document.documentElement);
    ctx.fillStyle = cs.getPropertyValue('--chart-empty-text').trim();
    ctx.font = '12px ' + getCachedFontFamily();
    ctx.textAlign = 'center';
    ctx.fillText(t('login_required') || 'Login required to view history', rect.width / 2, rect.height / 2);
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
export function showChartTooltip(e, canvas, chartData) {
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

export function createHideHandler(canvas) {
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
