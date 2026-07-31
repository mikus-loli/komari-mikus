/**
 * @module services/api
 * @description 所有数据加载 API
 * @dependencies core/state.js, core/constants.js, core/error-boundary.js, services/rpc.js, utils/helpers.js, i18n/index.js, algorithms/record-transforms.js
 * @exports loadPublicSettings, loadNodes, loadNodeHistory, loadRecentRecordsFallback, loadPingHistory, loadAllPingData, enrichPingTasksFromRPC, fetchPingTaskNames
 */

import { state, historyCache, pingCache, getCachedData, setCachedData } from '../core/state.js';
import { RPC_METHODS, MAX_HISTORY_POINTS, BATCH_CONCURRENCY, RECENT_RECORDS_LIMIT, PING_DEFAULT_HOURS } from '../core/constants.js';
import { showErrorToast } from '../core/error-boundary.js';
import { trimRecords, getApiBase } from '../utils/helpers.js';
import { t } from '../i18n/index.js';
import { flattenRecentRecords, mergeAndDedupRecords, forwardFillTotals } from '../algorithms/record-transforms.js';

/**
 * 加载公共设置
 * @returns {Promise}
 */
export function loadPublicSettings() {
    return state.rpc.call(RPC_METHODS.getPublicSettings, {}, true).then(function(result) {
        state.publicSettings = result || {};
        state.themeSettings = result.theme_settings || {};
    }).catch(function(err) {
        console.warn('public:getPublicSettings failed, falling back:', err);
        return state.rpc.call(RPC_METHODS.getPublicSettingsFallback, {}, true).then(function(result) {
            state.publicSettings = result || {};
            state.themeSettings = result.theme_settings || {};
        });
    }).catch(function(err) {
        console.warn('Failed to load public settings:', err);
        showErrorToast('Failed to load settings', 'warn');
    });
}

/**
 * 加载节点列表
 * @returns {Promise}
 */
export function loadNodes() {
    return state.rpc.call(RPC_METHODS.getNodesInformation, {}, true).then(function(result) {
        if (result) {
            const nodes = Array.isArray(result) ? result : Object.values(result);
            state.nodes = nodes.filter(function(n) { return !n.hidden; });
        }
    }).catch(function(err) {
        console.warn('common:getNodes failed, falling back:', err);
        return state.rpc.call(RPC_METHODS.getNodesInformationFallback, {}, true).then(function(result) {
            if (result) {
                const nodes = Array.isArray(result) ? result : Object.values(result);
                state.nodes = nodes.filter(function(n) { return !n.hidden; });
            }
        });
    }).catch(function(err) {
        console.warn('Failed to load nodes:', err);
        showErrorToast('Failed to load nodes', 'warn');
    });
}

/**
 * 将 /api/recent/ 返回的嵌套 Record 转为扁平格式
 * 纯函数实现已移至 algorithms/record-transforms.js，此处 re-export 保持向后兼容
 */
export { flattenRecentRecords } from '../algorithms/record-transforms.js';

/**
 * 合并近期记录到 realtimeHistory（去重、排序、限 MAX_HISTORY_POINTS 条）
 * 数据整形逻辑已下沉到 algorithms/record-transforms.js
 */
function mergeIntoRealtimeHistory(uuid, records) {
    const existing = state.realtimeHistory[uuid] || [];
    let merged = mergeAndDedupRecords(existing, records);
    forwardFillTotals(merged);
    if (merged.length > MAX_HISTORY_POINTS) merged = merged.slice(merged.length - MAX_HISTORY_POINTS);
    state.realtimeHistory[uuid] = merged;
    state.historyDataHours[uuid] = 0;
}

/**
 * 加载最近记录（使用 /api/recent/ REST API，与 komari-web 一致）
 * @param {string} uuid - 节点 UUID
 * @param {string|null} cacheKey - 缓存键
 * @param {number} [fallbackHours] - 备用小时数
 * @returns {Promise}
 */
export function loadRecentRecordsFallback(uuid, cacheKey, fallbackHours) {
    // 优先使用 /api/recent/ REST API（与 komari-web 一致）
    return fetch(getApiBase() + '/api/recent/' + encodeURIComponent(uuid), {
        credentials: 'include'
    })
    .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    })
    .then(function(data) {
        let rawRecords = (data && data.data) ? data.data : [];
        if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
            throw new Error('No recent records from /api/recent/');
        }
        // 保留最近 RECENT_RECORDS_LIMIT 条（与 komari-web length=30*5 一致）
        rawRecords = rawRecords.slice(-RECENT_RECORDS_LIMIT);
        const records = flattenRecentRecords(rawRecords);
        if (cacheKey) {
            state.historyData[uuid] = records;
            if (fallbackHours !== undefined) state.historyDataHours[uuid] = fallbackHours;
            setCachedData(historyCache, cacheKey, records);
        } else {
            mergeIntoRealtimeHistory(uuid, records);
        }
    })
    .catch(function(err) {
        // /api/recent/ 失败，fallback 到 RPC
        console.warn('/api/recent/ failed, falling back to RPC:', err);
        return state.rpc.call(RPC_METHODS.getClientRecentRecords, { uuid: uuid })
            .then(function(result) {
                const records = Array.isArray(result) ? result : (result && result.records ? result.records : null);
                if (records && records.length > 0) {
                    const trimmedRecords = trimRecords(records, MAX_HISTORY_POINTS);
                    if (cacheKey) {
                        state.historyData[uuid] = trimmedRecords;
                        if (fallbackHours !== undefined) state.historyDataHours[uuid] = fallbackHours;
                        setCachedData(historyCache, cacheKey, trimmedRecords);
                    } else {
                        mergeIntoRealtimeHistory(uuid, trimmedRecords);
                    }
                }
            });
    })
    .catch(function(err) {
        console.warn('RPC getClientRecentRecords failed, trying fallback:', err);
        return state.rpc.call(RPC_METHODS.getClientRecentRecordsFallback, { uuid: uuid })
            .then(function(fallback) {
                const records = fallback && fallback.records ? fallback.records : [];
                if (records.length > 0) {
                    const trimmedRecords = trimRecords(records, MAX_HISTORY_POINTS);
                    if (cacheKey) {
                        state.historyData[uuid] = trimmedRecords;
                        if (fallbackHours !== undefined) state.historyDataHours[uuid] = fallbackHours;
                        setCachedData(historyCache, cacheKey, trimmedRecords);
                    } else {
                        mergeIntoRealtimeHistory(uuid, trimmedRecords);
                    }
                }
            });
    })
    .catch(function(err) {
        console.warn('All record loading methods failed:', err);
        showErrorToast('Failed to load node records', 'warn');
    });
}

/**
 * 加载节点历史数据
 * @param {string} uuid - 节点 UUID
 * @param {number} hours - 时间范围（小时）
 * @returns {Promise}
 */
export function loadNodeHistory(uuid, hours) {
    // 实时模式：始终加载近期记录作为基础，与 WebSocket 数据合并形成滚动窗口
    if (hours === 0) {
        return loadRecentRecordsFallback(uuid, null, 0);
    }

    hours = hours || 24;

    const cacheKey = uuid + '-' + hours;
    const cachedData = getCachedData(historyCache, cacheKey);
    if (cachedData) {
        state.historyData[uuid] = cachedData;
        state.historyDataHours[uuid] = hours;
        return Promise.resolve();
    }

    // komari 1.3.0+: memory.total, disk.total, swap.total 已废弃
    // 改为从节点信息中获取 mem_total/disk_total/swap_total 填充
    const metricKeys = [
        'cpu.usage', 'load.average',
        'memory.used', 'swap.used',
        'disk.used',
        'net.in.rate', 'net.out.rate', 'net.total.down', 'net.total.up',
        'process.count', 'connections.tcp', 'connections.udp'
    ];

    // 从节点信息获取 total 值（1.3.0 不再存储为独立指标）
    const node = state.nodes.find(function(n) { return n.uuid === uuid; });
    const nodeMemTotal = node ? (node.mem_total || 0) : 0;
    const nodeDiskTotal = node ? (node.disk_total || 0) : 0;
    const nodeSwapTotal = node ? (node.swap_total || 0) : 0;

    return state.rpc.call(RPC_METHODS.queryMetrics, {
        metric_keys: metricKeys,
        entity_id: uuid,
        hours: hours,
        downsample: true,
        max_points: MAX_HISTORY_POINTS,
        aggregation: 'avg',
        fill_empty: false
    }, true).then(function(result) {
        const recordsMap = {};
        const series = result && result.series ? result.series : [];

        series.forEach(function(s) {
            const metricKey = s.metric_key || s.key;
            const points = s.points || [];

            points.forEach(function(point) {
                const time = point.time;
                if (!recordsMap[time]) {
                    recordsMap[time] = { time: time };
                }
                if (metricKey === 'cpu.usage') {
                    recordsMap[time].cpu = point.value;
                } else if (metricKey === 'load.average') {
                    recordsMap[time].load = point.value;
                } else if (metricKey === 'memory.used') {
                    recordsMap[time].ram = point.value;
                } else if (metricKey === 'swap.used') {
                    recordsMap[time].swap = point.value;
                } else if (metricKey === 'disk.used') {
                    recordsMap[time].disk = point.value;
                } else if (metricKey === 'net.in.rate') {
                    recordsMap[time].net_in = point.value;
                } else if (metricKey === 'net.out.rate') {
                    recordsMap[time].net_out = point.value;
                } else if (metricKey === 'net.total.down') {
                    recordsMap[time].netTotalDown = point.value;
                } else if (metricKey === 'net.total.up') {
                    recordsMap[time].netTotalUp = point.value;
                } else if (metricKey === 'process.count') {
                    recordsMap[time].process = point.value;
                } else if (metricKey === 'connections.tcp') {
                    recordsMap[time].connections = point.value;
                } else if (metricKey === 'connections.udp') {
                    recordsMap[time].connections_udp = point.value;
                }
            });
        });

        const records = Object.values(recordsMap);
        records.sort(function(a, b) {
            return new Date(a.time) - new Date(b.time);
        });

        // 用节点信息填充 ram_total / disk_total / swap_total
        // 1.3.0 不再将 total 作为独立指标存储
        for (let ri = 0; ri < records.length; ri++) {
            const rec = records[ri];
            if (!rec.ram_total && nodeMemTotal > 0) {
                rec.ram_total = nodeMemTotal;
            }
            if (!rec.disk_total && nodeDiskTotal > 0) {
                rec.disk_total = nodeDiskTotal;
            }
            if (!rec.swap_total && nodeSwapTotal > 0) {
                rec.swap_total = nodeSwapTotal;
            }
        }

        if (records.length > 0) {
            state.historyData[uuid] = records;
            state.historyDataHours[uuid] = hours;
            setCachedData(historyCache, cacheKey, records);
        } else {
            return loadRecentRecordsFallback(uuid, cacheKey, hours);
        }
    }).catch(function(err) {
        console.warn('queryMetrics failed, falling back:', err);
        return loadRecentRecordsFallback(uuid, cacheKey, hours);
    });
}

/**
 * 加载 Ping 历史数据
 * @param {string} uuid - 节点 UUID
 * @param {number} hours - 时间范围（小时）
 * @returns {Promise}
 */
export function loadPingHistory(uuid, hours) {
    if (hours === 0) hours = 4; // 延迟图表不支持实时模式，默认 4h

    const cacheKey = uuid + '-' + hours;
    const cachedData = getCachedData(pingCache, cacheKey);
    if (cachedData) {
        state.pingData[uuid] = cachedData;
        state.pingDataHours[uuid] = hours;
        return Promise.resolve();
    }

    const metricRequest = state.rpc.call(RPC_METHODS.queryMetrics, {
        metric_keys: ['ping.latency_ms'],
        entity_id: uuid,
        hours: hours,
        downsample: true,
        max_points: MAX_HISTORY_POINTS,
        aggregation: 'avg',
        fill_empty: false
    }, true);

    const taskRequest = state.rpc.call(RPC_METHODS.getPublicPingTasks, {}, true).catch(function() { return []; });

    const statsRequest = state.rpc.call(RPC_METHODS.getPingMetricStats, {
        entity_id: uuid,
        hours: hours,
        max_points: MAX_HISTORY_POINTS
    }, true).catch(function() { return null; });

    return Promise.all([metricRequest, taskRequest, statsRequest])
        .then(function(results) {
            const metricResult = results[0];
            const taskList = results[1];
            const statsResult = results[2];

            const taskMap = {};
            if (Array.isArray(taskList)) {
                taskList.forEach(function(task) {
                    const taskId = String(task.id);
                    taskMap[taskId] = {
                        id: task.id,
                        name: task.name || (t('task') + ' #' + task.id),
                        interval: task.interval
                    };
                });
            }

            const statsMap = {};
            if (statsResult && Array.isArray(statsResult.stats)) {
                statsResult.stats.forEach(function(stat) {
                    const key = stat.task_id;
                    statsMap[key] = stat;
                });
            }

            const records = [];
            const series = metricResult && metricResult.series ? metricResult.series : [];

            series.forEach(function(s) {
                const tags = s.tags || s.tag || {};
                const taskId = tags.task_id;
                const points = s.points || [];

                points.forEach(function(point) {
                    if (typeof point.value === 'number' && point.value >= 0) {
                        records.push({
                            time: point.time,
                            value: point.value,
                            task_id: taskId
                        });
                    }
                });
            });

            records.sort(function(a, b) {
                return new Date(a.time) - new Date(b.time);
            });

            Object.keys(taskMap).forEach(function(taskId) {
                if (statsMap[taskId]) {
                    const stat = statsMap[taskId];
                    taskMap[taskId].loss = stat.loss;
                    taskMap[taskId].min = stat.min;
                    taskMap[taskId].max = stat.max;
                    taskMap[taskId].avg = stat.avg;
                }
            });

            const tasks = Object.keys(taskMap).map(function(k) { return taskMap[k]; });

            const pingData = {
                records: records,
                tasks: tasks
            };

            state.pingData[uuid] = pingData;
            state.pingDataHours[uuid] = hours;
            setCachedData(pingCache, cacheKey, pingData);
        })
        .catch(function(err) {
            console.error('Failed to load ping history:', err);
            showErrorToast('Failed to load ping history', 'warn');
        });
}

/**
 * 分批加载 Promise 数组（控制并发）
 * @param {Array} items - 待处理项
 * @param {Function} fn - 每项执行的异步函数
 * @param {number} batchSize - 每批并发数
 * @returns {Promise<Array>} 收集所有结果
 */
async function batchProcess(items, fn, batchSize) {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(fn));
        results.push(...batchResults);
    }
    return results;
}

/**
 * 加载所有节点的 Ping 数据
 * @returns {Promise}
 */
export function loadAllPingData() {
    return batchProcess(state.nodes, function(node) {
        return loadPingHistory(node.uuid, PING_DEFAULT_HOURS);
    }, BATCH_CONCURRENCY);
}

/**
 * 从 RPC 获取 Ping 任务信息
 * @param {string} uuid - 节点 UUID
 * @param {Function} renderCallback - 渲染回调
 */
export function enrichPingTasksFromRPC(uuid, renderCallback) {
    state.rpc.call(RPC_METHODS.getPublicPingTasks, {})
        .then(function(tasks) {
            if (!tasks || !Array.isArray(tasks)) return;
            const pingInfo = state.pingData[uuid];
            if (!pingInfo) return;

            const taskNameMap = {};
            tasks.forEach(function(task) {
                taskNameMap[task.id] = task;
            });

            pingInfo.tasks.forEach(function(task) {
                const rpcTask = taskNameMap[task.id];
                if (rpcTask) {
                    if (rpcTask.name) task.name = rpcTask.name;
                    if (rpcTask.interval) task.interval = rpcTask.interval;
                    if (rpcTask.loss !== undefined) task.loss = rpcTask.loss;
                }
            });

            const cacheKey = uuid + '-' + PING_DEFAULT_HOURS;
            setCachedData(pingCache, cacheKey, pingInfo);

            if (renderCallback) renderCallback(uuid);
        })
        .catch(function(err) {
            console.warn('public:getPublicPingTasks failed, falling back to REST:', err);
            fetchPingTaskNames(uuid, renderCallback);
        });
}

/**
 * 从 REST API 获取 Ping 任务名称
 * @param {string} uuid - 节点 UUID
 * @param {Function} renderCallback - 渲染回调
 */
export function fetchPingTaskNames(uuid, renderCallback) {
    fetch(getApiBase() + '/api/records/ping?uuid=' + encodeURIComponent(uuid) + '&hours=1', {
        credentials: 'include'
    })
    .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    })
    .then(function(res) {
        if (res.status === 'success' && res.data && res.data.tasks) {
            const pingInfo = state.pingData[uuid];
            if (!pingInfo) return;

            const taskNameMap = {};
            res.data.tasks.forEach(function(task) {
                taskNameMap[task.id] = task.name;
            });

            pingInfo.tasks.forEach(function(task) {
                if (taskNameMap[task.id]) {
                    task.name = taskNameMap[task.id];
                }
                const apiTask = res.data.tasks.find(function(t) { return t.id === task.id; });
                if (apiTask) {
                    task.interval = apiTask.interval;
                    task.loss = apiTask.loss;
                }
            });

            if (renderCallback) renderCallback(uuid);
        }
    }).catch(function() {});
}
