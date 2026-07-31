/**
 * @module services/realtime
 * @description 实时 RPC 数据处理
 * @dependencies core/state.js, ui/nodes.js, ui/charts.js
 * @exports handleRpcResult
 */

import { state } from '../core/state.js';

// 延迟导入，避免循环依赖
let _drawCharts = null;
let _renderAll = null;

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
 * 处理实时 RPC 数据
 * @param {Object} result - RPC 返回的实时数据
 */
export function handleRpcResult(result) {
    if (!result) return;

    const onlineNodes = [];
    const realtimeData = {};

    Object.keys(result).forEach(function (uuid) {
        const status = result[uuid];
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

                if (history.length > 600) {
                    state.realtimeHistory[uuid] = history.slice(history.length - 600);
                }

                if (state.selectedNodeUuid === uuid && state.historyTimeRange === 'realtime') {
                    if (_drawCharts) _drawCharts(uuid);
                }
            }
        }
    });

    state.onlineNodes = onlineNodes;
    state.realtimeData = realtimeData;
    if (_renderAll) _renderAll();
}
