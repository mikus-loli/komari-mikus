/**
 * @module utils/time
 * @description 时间范围转换与格式化
 * @dependencies 无
 * @exports timeRangeToHours, formatTimeLabel, formatTooltipTime
 */

/**
 * 时间范围转换为小时数
 * @param {string} range - 时间范围标识
 * @returns {number} 小时数
 */
export function timeRangeToHours(range) {
    switch (range) {
        case 'realtime': return 0;
        case '1h': return 1;
        case '4h': return 4;
        case '1d': return 24;
        default: return 24;
    }
}

/**
 * 根据时间范围智能选择时间格式
 * @param {Date} time - 时间对象
 * @param {number} hours - 小时数
 * @returns {string} 格式化后的时间字符串
 */
export function formatTimeLabel(time, hours) {
    if (hours <= 4) {
        return time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0');
    } else if (hours <= 24) {
        return time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0');
    } else if (hours <= 168) {
        return (time.getMonth() + 1).toString().padStart(2, '0') + '-' + time.getDate().toString().padStart(2, '0') + ' ' + time.getHours().toString().padStart(2, '0');
    } else {
        return (time.getMonth() + 1).toString().padStart(2, '0') + '-' + time.getDate().toString().padStart(2, '0');
    }
}

/**
 * 格式化 tooltip 时间
 * @param {Date} time - 时间对象
 * @param {number} hours - 小时数
 * @returns {string} 格式化后的时间字符串
 */
export function formatTooltipTime(time, hours) {
    const dateStr = (time.getMonth() + 1).toString().padStart(2, '0') + '-' + time.getDate().toString().padStart(2, '0');
    const timeStr = time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0');
    if (hours <= 4) {
        return timeStr;
    }
    return dateStr + ' ' + timeStr;
}
