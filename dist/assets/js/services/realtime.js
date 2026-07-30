/**
 * @module services/realtime
 * @description 实时 RPC 数据处理（RAF 节流 + Page Visibility 暂停）
 * @dependencies core/state.js, ui/nodes.js, ui/charts.js
 * @exports handleRpcResult
 */

import { state } from '../core/state.js';
import { MAX_HISTORY_POINTS } from '../core/constants.js';

// 延迟导入，避免循环依赖
let _drawCharts = null;
let _renderAll = null;

// RAF 节流：多帧数据合并为一次渲染
let _renderRAF = 0;
let _chartRAF = 0;
let _pendingChartUuid = null;

// Page Visibility：不可见时暂停渲染，恢复时一次性刷新
let _pageHidden = false;

document.addEventListener('visibilitychange', function() {
    _pageHidden = document.hidden;
    if (!_pageHidden && _renderAll) {
        // 页面重新可见，立即刷新一次
        _renderAll();
    }
});

/**
 * 设置渲染函数（由 app.js 在初始化时调用）
 * @param {Function} drawCharts - 绘制图表函数
 * @param {Function} renderAll - 渲染所有函数
 */
export function setRenderFunctions(drawCharts, renderAll) {
    _drawCharts = drawCharts;
    _renderAll = renderAll;
}

/**
 * 调度渲染（RAF 节流，同一帧内多次数据推送只触发一次 renderAll）
 */
function scheduleRender() {
    if (_pageHidden) return;
    if (_renderRAF) return; // 已调度，跳过
    _renderRAF = requestAnimationFrame(function() {
        _renderRAF = 0;
        if (_renderAll) _renderAll();
    });
}

/**
 * 调度图表重绘（RAF 节流）
 */
function scheduleChartRedraw(uuid) {
    _pendingChartUuid = uuid;
    if (_pageHidden) return;
    if (_chartRAF) return;
    _chartRAF = requestAnimationFrame(function() {
        _chartRAF = 0;
        if (_drawCharts && _pendingChartUuid) {
            _drawCharts(_pendingChartUuid);
        }
        _pendingChartUuid = null;
    });
}

/**
 * 处理实时 RPC 数据
 * @param {Object} result - RPC 返回的实时数据
 */
export function handleRpcResult(result) {
    if (!result) return;

    const onlineNodes = [];
    const realtimeData = {};

    Object.keys(result).forEach(function (uuid) {
        const status = result[uuid];
        if (!status || typeof status !== 'object') return;
        if (status.online) {
            onlineNodes.push(uuid);
        }
        realtimeData[uuid] = {
            cpu: status.cpu !== undefined ? { usage: status.cpu } : null,
            ram: status.ram !== undefined ? { used: status.ram, total: status.ram_total } : null,
            swap: status.swap !== undefined ? { used: status.swap, total: status.swap_total } : null,
            load: status.load !== undefined ? { load1: status.load, load5: status.load5, load15: status.load15 } : null,
            disk: status.disk !== undefined ? { used: status.disk, total: status.disk_total } : null,
            network: status.net_in !== undefined ? { up: status.net_out, down: status.net_in, totalUp: status.net_total_up, totalDown: status.net_total_down } : null,
            connections: status.connections !== undefined ? { tcp: status.connections, udp: status.connections_udp } : null,
            uptime: status.uptime || 0,
            process: status.process || 0
        };

        if (status.online && status.time) {
            if (!state.realtimeHistory[uuid]) {
                state.realtimeHistory[uuid] = [];
            }

            const history = state.realtimeHistory[uuid];
            const lastTime = history.length > 0 ? new Date(history[history.length - 1].time).getTime() : 0;
            const currentTime = new Date(status.time).getTime();

            if (currentTime !== lastTime) {
                const record = {
                    time: status.time,
                    cpu: status.cpu,
                    ram: status.ram,
                    ram_total: status.ram_total,
                    swap: status.swap,
                    swap_total: status.swap_total,
                    disk: status.disk,
                    disk_total: status.disk_total,
                    load: status.load,
                    load5: status.load5,
                    load15: status.load15,
                    net_in: status.net_in,
                    net_out: status.net_out,
                    net_total_up: status.net_total_up,
                    net_total_down: status.net_total_down,
                    process: status.process,
                    connections: status.connections,
                    connections_udp: status.connections_udp,
                    gpu: status.gpu
                };

                history.push(record);

                if (history.length > MAX_HISTORY_POINTS) {
                    state.realtimeHistory[uuid] = history.slice(history.length - MAX_HISTORY_POINTS);
                }

                if (state.selectedNodeUuid === uuid && state.historyTimeRange === 'realtime') {
                    scheduleChartRedraw(uuid);
                }
            }
        }
    });

    state.onlineNodes = onlineNodes;
    state.realtimeData = realtimeData;
    scheduleRender();
}
