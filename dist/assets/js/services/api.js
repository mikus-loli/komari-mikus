/**
 * @module services/api
 * @description 所有数据加载 API
 * @dependencies core/state.js, core/constants.js, services/rpc.js, utils/helpers.js, i18n/index.js
 * @exports loadPublicSettings, loadNodes, loadNodeHistory, loadRecentRecordsFallback, loadPingHistory, loadAllPingData, enrichPingTasksFromRPC, fetchPingTaskNames
 * @source app.js L1190-L1537
 */

import { state, historyCache, pingCache, getCachedData, setCachedData } from '../core/state.js';
import { RPC_METHODS } from '../core/constants.js';
import { trimRecords, getApiBase } from '../utils/helpers.js';
import { t } from '../i18n/index.js';

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
    });
}

/**
 * 加载节点列表
 * @returns {Promise}
 */
export function loadNodes() {
    return state.rpc.call(RPC_METHODS.getNodesInformation, {}, true).then(function(result) {
        if (result) {
            var nodes = Array.isArray(result) ? result : Object.values(result);
            state.nodes = nodes.filter(function(n) { return !n.hidden; });
        }
    }).catch(function(err) {
        console.warn('common:getNodes failed, falling back:', err);
        return state.rpc.call(RPC_METHODS.getNodesInformationFallback, {}, true).then(function(result) {
            if (result) {
                var nodes = Array.isArray(result) ? result : Object.values(result);
                state.nodes = nodes.filter(function(n) { return !n.hidden; });
            }
        });
    }).catch(function(err) {
        console.warn('Failed to load nodes:', err);
    });
}

/**
 * 加载最近记录（fallback）
 * @param {string} uuid - 节点 UUID
 * @param {string|null} cacheKey - 缓存键
 * @returns {Promise}
 */
export function loadRecentRecordsFallback(uuid, cacheKey) {
    return state.rpc.call(RPC_METHODS.getClientRecentRecords, { uuid: uuid })
        .then(function(result) {
            var records = Array.isArray(result) ? result : (result && result.records ? result.records : null);
            if (records && records.length > 0) {
                var trimmedRecords = trimRecords(records, 600);
                if (cacheKey) {
                    state.historyData[uuid] = trimmedRecords;
                    setCachedData(historyCache, cacheKey, trimmedRecords);
                } else {
                    state.realtimeHistory[uuid] = trimmedRecords;
                }
            }
        })
        .catch(function(err) {
            console.warn('public:getClientRecentRecords failed, falling back:', err);
            return state.rpc.call(RPC_METHODS.getClientRecentRecordsFallback, { uuid: uuid })
                .then(function(fallback) {
                    if (fallback && fallback.records) {
                        var trimmedRecords = trimRecords(fallback.records, 600);
                        if (cacheKey) {
                            state.historyData[uuid] = trimmedRecords;
                            setCachedData(historyCache, cacheKey, trimmedRecords);
                        } else {
                            state.realtimeHistory[uuid] = trimmedRecords;
                        }
                    }
                });
        })
        .catch(function() {});
}

/**
 * 加载节点历史数据
 * @param {string} uuid - 节点 UUID
 * @param {number} hours - 时间范围（小时）
 * @returns {Promise}
 */
export function loadNodeHistory(uuid, hours) {
    hours = hours || 24;

    if (hours === 0) {
        if (!state.realtimeHistory[uuid] || state.realtimeHistory[uuid].length === 0) {
            return loadRecentRecordsFallback(uuid, null);
        }
        return Promise.resolve();
    }

    var cacheKey = uuid + '-' + hours;
    var cachedData = getCachedData(historyCache, cacheKey);
    if (cachedData) {
        state.historyData[uuid] = cachedData;
        return Promise.resolve();
    }

    var metricKeys = [
        'cpu.usage', 'load.average',
        'memory.used', 'memory.total', 'swap.used',
        'disk.used', 'disk.total',
        'net.in.rate', 'net.out.rate', 'net.total.down', 'net.total.up',
        'process.count', 'connections.tcp', 'connections.udp'
    ];

    return state.rpc.call(RPC_METHODS.queryMetrics, {
        metric_keys: metricKeys,
        entity_id: uuid,
        hours: hours,
        downsample: true,
        max_points: 600,
        aggregation: 'avg',
        fill_empty: false
    }, true).then(function(result) {
        var recordsMap = {};
        var series = result && result.series ? result.series : [];

        series.forEach(function(s) {
            var metricKey = s.metric_key || s.key;
            var points = s.points || [];

            points.forEach(function(point) {
                var time = point.time;
                if (!recordsMap[time]) {
                    recordsMap[time] = { time: time };
                }
                if (metricKey === 'cpu.usage') {
                    recordsMap[time].cpu = point.value;
                } else if (metricKey === 'load.average') {
                    recordsMap[time].load = point.value;
                } else if (metricKey === 'memory.used') {
                    recordsMap[time].ram = point.value;
                } else if (metricKey === 'memory.total') {
                    recordsMap[time].ram_total = point.value;
                } else if (metricKey === 'swap.used') {
                    recordsMap[time].swap = point.value;
                } else if (metricKey === 'disk.used') {
                    recordsMap[time].disk = point.value;
                } else if (metricKey === 'disk.total') {
                    recordsMap[time].disk_total = point.value;
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

        var records = Object.values(recordsMap);
        records.sort(function(a, b) {
            return new Date(a.time) - new Date(b.time);
        });

        if (records.length > 0) {
            state.historyData[uuid] = records;
            setCachedData(historyCache, cacheKey, records);
        } else {
            return loadRecentRecordsFallback(uuid, cacheKey);
        }
    }).catch(function(err) {
        console.warn('queryMetrics failed, falling back:', err);
        return loadRecentRecordsFallback(uuid, cacheKey);
    });
}

/**
 * 加载 Ping 历史数据
 * @param {string} uuid - 节点 UUID
 * @param {number} hours - 时间范围（小时）
 * @returns {Promise}
 */
export function loadPingHistory(uuid, hours) {
    hours = hours || 4;

    var cacheKey = uuid + '-' + hours;
    var cachedData = getCachedData(pingCache, cacheKey);
    if (cachedData) {
        state.pingData[uuid] = cachedData;
        return Promise.resolve();
    }

    var metricRequest = state.rpc.call(RPC_METHODS.queryMetrics, {
        metric_keys: ['ping.latency_ms'],
        entity_id: uuid,
        hours: hours,
        downsample: true,
        max_points: 600,
        aggregation: 'avg',
        fill_empty: false
    }, true);

    var taskRequest = state.rpc.call(RPC_METHODS.getPublicPingTasks, {}, true).catch(function() { return []; });

    var statsRequest = state.rpc.call(RPC_METHODS.getPingMetricStats, {
        entity_id: uuid,
        hours: hours,
        max_points: 600
    }, true).catch(function() { return null; });

    return Promise.all([metricRequest, taskRequest, statsRequest])
        .then(function(results) {
            var metricResult = results[0];
            var taskList = results[1];
            var statsResult = results[2];

            var taskMap = {};
            if (Array.isArray(taskList)) {
                taskList.forEach(function(task) {
                    var taskId = String(task.id);
                    taskMap[taskId] = {
                        id: task.id,
                        name: task.name || (t('task') + ' #' + task.id),
                        interval: task.interval
                    };
                });
            }

            var statsMap = {};
            if (statsResult && Array.isArray(statsResult.stats)) {
                statsResult.stats.forEach(function(stat) {
                    var key = stat.task_id;
                    statsMap[key] = stat;
                });
            }

            var records = [];
            var series = metricResult && metricResult.series ? metricResult.series : [];

            series.forEach(function(s) {
                var tags = s.tags || s.tag || {};
                var taskId = tags.task_id;
                var points = s.points || [];

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
                    var stat = statsMap[taskId];
                    taskMap[taskId].loss = stat.loss;
                    taskMap[taskId].min = stat.min;
                    taskMap[taskId].max = stat.max;
                    taskMap[taskId].avg = stat.avg;
                }
            });

            var tasks = Object.keys(taskMap).map(function(k) { return taskMap[k]; });

            var pingData = {
                records: records,
                tasks: tasks
            };

            state.pingData[uuid] = pingData;
            setCachedData(pingCache, cacheKey, pingData);
        })
        .catch(function(err) {
            console.error('Failed to load ping history:', err);
        });
}

/**
 * 加载所有节点的 Ping 数据
 * @returns {Promise}
 */
export function loadAllPingData() {
    var promises = state.nodes.map(function(node) {
        return loadPingHistory(node.uuid, 1);
    });
    return Promise.all(promises);
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
            var pingInfo = state.pingData[uuid];
            if (!pingInfo) return;

            var taskNameMap = {};
            tasks.forEach(function(task) {
                taskNameMap[task.id] = task;
            });

            pingInfo.tasks.forEach(function(task) {
                var rpcTask = taskNameMap[task.id];
                if (rpcTask) {
                    if (rpcTask.name) task.name = rpcTask.name;
                    if (rpcTask.interval) task.interval = rpcTask.interval;
                    if (rpcTask.loss !== undefined) task.loss = rpcTask.loss;
                }
            });

            var cacheKey = uuid + '-1';
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
            var pingInfo = state.pingData[uuid];
            if (!pingInfo) return;

            var taskNameMap = {};
            res.data.tasks.forEach(function(task) {
                taskNameMap[task.id] = task.name;
            });

            pingInfo.tasks.forEach(function(task) {
                if (taskNameMap[task.id]) {
                    task.name = taskNameMap[task.id];
                }
                var apiTask = res.data.tasks.find(function(t) { return t.id === task.id; });
                if (apiTask) {
                    task.interval = apiTask.interval;
                    task.loss = apiTask.loss;
                }
            });

            if (renderCallback) renderCallback(uuid);
        }
    }).catch(function() {});
}
