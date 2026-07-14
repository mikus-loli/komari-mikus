/**
 * @module algorithms/index
 * @description 所有数据处理算法（EWMA, LTTB, 插值, 峰值检测, pipeline）
 * @dependencies core/state.js, utils/helpers.js
 * @exports applyEWMA, lttbDownsampleRecords, createNullTemplate, fillMissingTimePoints, interpolateNullsLinear, cutPeakValues, processDataPipeline
 * @source app.js L431-L878
 */

import { state } from '../core/state.js';
import { trimRecords, getMaxDataPoints } from '../utils/helpers.js';

/**
 * EWMA（指数加权移动平均）算法
 * @param {Array} values - 数值数组
 * @param {number} alpha - 平滑因子（0-1）
 * @returns {Array} 平滑后的数组
 */
export function applyEWMA(values, alpha) {
    if (!values || values.length === 0) return [];

    var smoothed = [];
    var prevSmoothed = values[0];

    for (var i = 0; i < values.length; i++) {
        if (values[i] === null || values[i] === undefined || isNaN(values[i])) {
            smoothed.push(null);
            continue;
        }

        var currentSmoothed = alpha * values[i] + (1 - alpha) * prevSmoothed;
        smoothed.push(currentSmoothed);
        prevSmoothed = currentSmoothed;
    }

    return smoothed;
}

/**
 * LTTB 降采样算法
 * @param {Array} records - 数据记录
 * @param {number} threshold - 目标点数
 * @param {Function} valueExtractor - 值提取函数
 * @returns {Array} 降采样后的数据
 */
export function lttbDownsampleRecords(records, threshold, valueExtractor) {
    if (!records || records.length <= threshold || threshold < 3) {
        return records;
    }

    var dataLength = records.length;
    var bucketSize = (dataLength - 2) / (threshold - 2);
    var result = [];

    result.push(records[0]);

    var prevSelectedIdx = 0;
    var prevSelectedVal = valueExtractor(records[0]) || 0;

    for (var i = 0; i < threshold - 2; i++) {
        var bucketStart = Math.floor((i + 1) * bucketSize) + 1;
        var bucketEnd = Math.floor((i + 2) * bucketSize) + 1;
        bucketEnd = Math.min(bucketEnd, dataLength);

        var nextBucketStart = Math.floor((i + 2) * bucketSize) + 1;
        var nextBucketEnd = Math.min(Math.floor((i + 3) * bucketSize) + 1, dataLength);

        var avgX = 0, avgY = 0, avgCount = 0;
        for (var j = nextBucketStart; j < nextBucketEnd; j++) {
            var v = valueExtractor(records[j]);
            if (v !== null && v !== undefined && !isNaN(v)) {
                avgX += j;
                avgY += v;
                avgCount++;
            }
        }
        if (avgCount === 0) {
            avgX = nextBucketStart;
            avgY = 0;
        } else {
            avgX /= avgCount;
            avgY /= avgCount;
        }

        var maxArea = -1;
        var maxAreaIdx = bucketStart;
        for (var k = bucketStart; k < bucketEnd; k++) {
            var val = valueExtractor(records[k]);
            if (val === null || val === undefined || isNaN(val)) continue;
            var area = Math.abs(
                (prevSelectedIdx - avgX) * (val - prevSelectedVal) -
                (prevSelectedIdx - k) * (avgY - prevSelectedVal)
            ) * 0.5;
            if (area > maxArea) {
                maxArea = area;
                maxAreaIdx = k;
            }
        }

        result.push(records[maxAreaIdx]);
        prevSelectedIdx = maxAreaIdx;
        prevSelectedVal = valueExtractor(records[maxAreaIdx]) || 0;
    }

    result.push(records[dataLength - 1]);
    return result;
}

/**
 * 创建 Null 模板对象
 * @param {*} obj - 模板对象
 * @returns {*} Null 模板
 */
export function createNullTemplate(obj) {
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'number') return null;
    if (typeof obj === 'string' || typeof obj === 'boolean') return obj;
    if (Array.isArray(obj)) return obj.map(createNullTemplate);
    if (typeof obj === 'object') {
        var res = {};
        for (var k in obj) {
            if (k === 'updated_at' || k === 'time') continue;
            res[k] = createNullTemplate(obj[k]);
        }
        return res;
    }
    return null;
}

/**
 * 时间填充算法
 * @param {Array} data - 输入数据数组
 * @param {number} intervalSec - 时间间隔（秒）
 * @param {number} totalSeconds - 总时长（秒）
 * @param {number} matchToleranceSec - 匹配容差（秒）
 * @returns {Array} 填充后的数据数组
 */
export function fillMissingTimePoints(data, intervalSec, totalSeconds, matchToleranceSec) {
    if (!data || data.length === 0) return [];

    intervalSec = intervalSec || 60;
    totalSeconds = totalSeconds !== undefined ? totalSeconds : 3600;
    matchToleranceSec = matchToleranceSec || intervalSec;

    var getTime = function(item) {
        return new Date(item.time || item.updated_at || '').getTime();
    };

    var timedData = data.map(function(item) {
        return { item: item, timeMs: getTime(item) };
    });
    timedData.sort(function(a, b) { return a.timeMs - b.timeMs; });

    var firstItem = timedData[0];
    var lastItem = timedData[timedData.length - 1];
    var end = lastItem.timeMs;
    var interval = intervalSec * 1000;

    var start;
    if (totalSeconds !== null && totalSeconds > 0) {
        start = end - totalSeconds * 1000 + interval;
    } else {
        start = firstItem.timeMs;
    }

    var timePoints = [];
    for (var t = start; t <= end; t += interval) {
        timePoints.push(t);
    }

    var nullTemplate = createNullTemplate(lastItem.item);

    var dataIdx = 0;
    var matchToleranceMs = matchToleranceSec * 1000;

    var filled = timePoints.map(function(t) {
        var found = undefined;

        while (dataIdx < timedData.length && timedData[dataIdx].timeMs < t - matchToleranceMs) {
            dataIdx++;
        }

        if (dataIdx < timedData.length && Math.abs(timedData[dataIdx].timeMs - t) <= matchToleranceMs) {
            found = timedData[dataIdx].item;
        }

        if (found) {
            return Object.assign({}, found, { time: new Date(t).toISOString() });
        }

        return Object.assign({}, nullTemplate, { time: new Date(t).toISOString() });
    });

    return filled;
}

/**
 * 线性插值算法
 * @param {Array} rows - 数据数组
 * @param {Array} keys - 需要插值的属性名数组
 * @param {Object|number} options - 配置选项
 * @returns {Array} 插值后的数据数组
 */
export function interpolateNullsLinear(rows, keys, options) {
    if (!rows || rows.length === 0 || !keys || keys.length === 0) return rows;

    var times = rows.map(function(r) {
        return new Date(r.time || r.updated_at || '').getTime();
    });
    var out = rows.map(function(r) { return Object.assign({}, r); });

    var opts = typeof options === 'number' ? { maxGapMs: options } : (options || {});
    var maxGapMsUnified = opts.maxGapMs;
    var multiplier = opts.maxGapMultiplier || 6;
    var minCap = opts.minCapMs || 2 * 60000;
    var maxCap = opts.maxCapMs || 30 * 60000;

    var clamp = function(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    };

    for (var ki = 0; ki < keys.length; ki++) {
        var key = keys[ki];

        var validIdx = [];
        for (var i = 0; i < rows.length; i++) {
            var v = rows[i][key];
            if (typeof v === 'number' && !isNaN(v) && isFinite(v)) {
                validIdx.push(i);
            }
        }

        if (validIdx.length < 2) continue;

        var perKeyMaxGap = maxGapMsUnified;
        if (perKeyMaxGap === undefined) {
            var gaps = [];
            for (var s = 0; s < validIdx.length - 1; s++) {
                var i0 = validIdx[s];
                var i1 = validIdx[s + 1];
                var t0 = times[i0];
                var t1 = times[i1];
                if (isFinite(t0) && isFinite(t1) && t1 > t0) {
                    gaps.push(t1 - t0);
                }
            }
            if (gaps.length === 0) continue;
            gaps.sort(function(a, b) { return a - b; });
            var median = gaps[Math.floor(gaps.length / 2)];
            perKeyMaxGap = clamp(median * multiplier, minCap, maxCap);
        }

        for (var s = 0; s < validIdx.length - 1; s++) {
            var i0 = validIdx[s];
            var i1 = validIdx[s + 1];
            var t0 = times[i0];
            var t1 = times[i1];
            var v0 = rows[i0][key];
            var v1 = rows[i1][key];

            if (!isFinite(t0) || !isFinite(t1) || t1 <= t0) continue;
            if (typeof v0 !== 'number' || typeof v1 !== 'number') continue;
            if (perKeyMaxGap && t1 - t0 > perKeyMaxGap) continue;

            for (var j = i0 + 1; j < i1; j++) {
                var tj = times[j];
                var ratio = (tj - t0) / (t1 - t0);
                out[j][key] = v0 + (v1 - v0) * ratio;
            }
        }
    }

    return out;
}

/**
 * EWMA 平滑 + 突变检测算法
 * @param {Array} data - 输入数据数组
 * @param {Array} keys - 需要处理的属性名数组
 * @param {number} alpha - 平滑因子
 * @param {number} windowSize - 突变检测窗口大小
 * @param {number} spikeThreshold - 突变阈值
 * @returns {Array} 处理后的数据数组
 */
export function cutPeakValues(data, keys, alpha, windowSize, spikeThreshold) {
    if (!data || data.length === 0) return data;

    alpha = alpha || 0.1;
    windowSize = windowSize || 15;
    spikeThreshold = spikeThreshold || 0.3;

    var result = data.map(function(d) { return Object.assign({}, d); });
    var halfWindow = Math.floor(windowSize / 2);

    for (var ki = 0; ki < keys.length; ki++) {
        var key = keys[ki];

        for (var i = 0; i < result.length; i++) {
            var currentValue = result[i][key];

            if (currentValue != null && typeof currentValue === 'number') {
                var neighborValues = [];

                for (var j = Math.max(0, i - halfWindow); j <= Math.min(result.length - 1, i + halfWindow); j++) {
                    if (j === i) continue;
                    var neighbor = result[j][key];
                    if (neighbor != null && typeof neighbor === 'number') {
                        neighborValues.push(neighbor);
                    }
                }

                if (neighborValues.length >= 2) {
                    var neighborSum = neighborValues.reduce(function(sum, val) { return sum + val; }, 0);
                    var neighborMean = neighborValues.length > 0 ? neighborSum / neighborValues.length : 0;

                    if (neighborMean > 0) {
                        var relativeChange = Math.abs(currentValue - neighborMean) / neighborMean;
                        if (relativeChange > spikeThreshold) {
                            result[i][key] = null;
                        }
                    } else if (Math.abs(currentValue) > 10) {
                        result[i][key] = null;
                    }
                }
            }
        }

        var ewma = null;

        for (var i = 0; i < result.length; i++) {
            var currentValue = result[i][key];

            if (currentValue != null && typeof currentValue === 'number') {
                if (ewma === null) {
                    ewma = Math.round(currentValue * 100) / 100;
                } else {
                    ewma = Math.round((alpha * currentValue + (1 - alpha) * ewma) * 100) / 100;
                }
                result[i][key] = ewma;
            } else if (ewma !== null) {
                result[i][key] = ewma;
            }
        }
    }

    return result;
}

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

    var filledData = data;
    if (hours > 0) {
        var minute = 60;
        var hour = minute * 60;

        var stringifiedData = data.map(function(d) {
            return Object.assign({}, d, {
                time: typeof d.time === 'number' ? new Date(d.time).toISOString() : d.time
            });
        });

        var intervalSeconds;
        if (hours === 1 || hours === 4) {
            intervalSeconds = minute;
        } else if (hours > 120) {
            intervalSeconds = hour;
        } else {
            intervalSeconds = minute * 15;
        }

        var now = new Date();
        if (stringifiedData.length > 0) {
            var lastDataTime = new Date(stringifiedData[stringifiedData.length - 1].time).getTime();
            if (now.getTime() - lastDataTime > intervalSeconds * 1000) {
                stringifiedData.push({ time: now.toISOString() });
            }
        }

        var maxGap = intervalSeconds * 2;
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

    var maxPoints = getMaxDataPoints(hours);
    filledData = trimRecords(filledData, maxPoints);

    return filledData;
}
