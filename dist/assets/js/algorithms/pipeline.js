/**
 * @module algorithms/pipeline
 * @description 智能数据处理管道，负责时间序列生成、缺失点填充、插值、EWMA 平滑、数据裁剪
 * @dependencies algorithms/index.js, core/state.js, utils/helpers.js
 * @exports processDataPipeline
 */

import { fillMissingTimePoints, interpolateNullsLinear, cutPeakValues } from './index.js';
import { trimRecords, getMaxDataPoints } from '../utils/helpers.js';
import { state } from '../core/state.js';

/**
 * 智能数据处理管道
 * @param {Array} data - 原始数据
 * @param {number} hours - 时间范围（小时）
 * @param {Array} keys - 需要处理的属性名数组
 * @param {boolean} enableSmooth - 是否启用平滑
 * @returns {Array} 处理后的数据
 */
export function processDataPipeline(data, hours, keys, enableSmooth) {
    if (!data || data.length === 0) return [];

    let filledData = data;
    if (hours > 0) {
        const minute = 60;
        const hour = minute * 60;

        const stringifiedData = data.map(function(d) {
            return Object.assign({}, d, {
                time: typeof d.time === 'number' ? new Date(d.time).toISOString() : d.time
            });
        });

        let intervalSeconds;
        if (hours === 1 || hours === 4) {
            intervalSeconds = minute;
        } else if (hours > 120) {
            intervalSeconds = hour;
        } else {
            intervalSeconds = minute * 15;
        }

        const now = new Date();
        if (stringifiedData.length > 0) {
            const lastDataTime = new Date(stringifiedData[stringifiedData.length - 1].time).getTime();
            if (now.getTime() - lastDataTime > intervalSeconds * 1000) {
                stringifiedData.push({ time: now.toISOString() });
            }
        }

        const maxGap = intervalSeconds * 2;
        filledData = fillMissingTimePoints(
            stringifiedData,
            intervalSeconds,
            hour * hours,
            maxGap
        );

        filledData = filledData.map(function(d) {
            return Object.assign({}, d, { time: new Date(d.time).getTime() });
        });
    }

    if (hours > 0 && keys && keys.length > 0) {
        filledData = interpolateNullsLinear(filledData, keys, {
            maxGapMultiplier: 6,
            minCapMs: 2 * 60000,
            maxCapMs: 30 * 60000
        });
    }

    if (enableSmooth && keys && keys.length > 0) {
        filledData = cutPeakValues(filledData, keys, state.ewmaAlpha, 15, 0.3);
    }

    const maxPoints = getMaxDataPoints(hours);
    filledData = trimRecords(filledData, maxPoints);

    return filledData;
}
