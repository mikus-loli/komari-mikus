import { state } from '../../core/state.js';
import { getCachedFontFamily } from '../../utils/color.js';
import { formatTimeLabel, timeRangeToHours } from '../../utils/time.js';
import { showChartTooltip, createHideHandler } from './utils.js';

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

    const cs = getComputedStyle(document.documentElement);
    const gridColor = cs.getPropertyValue('--chart-grid').trim();
    const textColor = cs.getPropertyValue('--chart-text').trim();

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
                ctx.fillStyle = cs.getPropertyValue('--chart-dot-center').trim();
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
