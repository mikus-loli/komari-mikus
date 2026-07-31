/**
 * @module utils/data-trim
 * @description 数据裁剪辅助函数
 * @dependencies core/constants.js
 * @exports trimRecords, getMaxDataPoints
 */

import { MAX_HISTORY_POINTS, MAX_HISTORY_POINTS_LONG } from '../core/constants.js';

/**
 * 数据裁剪：限制数据点数量
 * @param {Array} records - 数据记录数组
 * @param {number} maxCount - 最大数量
 * @returns {Array} 裁剪后的数组
 */
export function trimRecords(records, maxCount) {
    if (!records || records.length <= maxCount) return records;
    return records.slice(-maxCount);
}

/**
 * 根据时间范围智能计算最大数据点数
 * @param {number} hours - 小时数
 * @returns {number} 最大数据点数
 */
export function getMaxDataPoints(hours) {
    if (hours <= 24) return MAX_HISTORY_POINTS;
    return MAX_HISTORY_POINTS_LONG;
}
