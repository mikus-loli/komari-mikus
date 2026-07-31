import { t } from '../../i18n/index.js';
import { getCachedFontFamily } from '../../utils/color.js';

// Re-export tooltip functions from dedicated module
export { showChartTooltip, createHideHandler, createTouchMoveHandler, createMouseMoveHandler } from './tooltip.js';

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
