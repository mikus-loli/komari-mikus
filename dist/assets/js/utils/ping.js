/**
 * @module utils/ping
 * @description 延迟/Ping 相关辅助函数
 * @dependencies core/state.js
 * @exports getLatestPing, getPingTasks, getTaskLatestPing, getPingLevel
 */

import { state } from '../core/state.js';

/**
 * 获取最新延迟
 * @param {string} uuid - 节点 UUID
 * @returns {number|null} 平均延迟值
 */
export function getLatestPing(uuid) {
    const pingInfo = state.pingData[uuid];
    if (!pingInfo || !pingInfo.records || pingInfo.records.length === 0) {
        return null;
    }
    const taskValues = {};
    pingInfo.records.forEach(function (r) {
        if (!taskValues[r.task_id]) {
            taskValues[r.task_id] = r.value;
        }
    });
    const values = Object.values(taskValues).filter(function (v) { return v !== null && v !== undefined; });
    if (values.length === 0) return null;
    const sum = values.reduce(function (a, b) { return a + b; }, 0);
    return sum / values.length;
}

/**
 * 获取 Ping 任务列表
 * @param {string} uuid - 节点 UUID
 * @returns {Array} 任务数组
 */
export function getPingTasks(uuid) {
    const pingInfo = state.pingData[uuid];
    if (!pingInfo || !pingInfo.tasks) return [];
    return pingInfo.tasks;
}

/**
 * 获取任务最新延迟
 * @param {string} uuid - 节点 UUID
 * @param {string} taskId - 任务 ID
 * @returns {number|null} 延迟值
 */
export function getTaskLatestPing(uuid, taskId) {
    const pingInfo = state.pingData[uuid];
    if (!pingInfo || !pingInfo.records) return null;
    const targetTaskId = String(taskId);
    for (let i = pingInfo.records.length - 1; i >= 0; i--) {
        if (String(pingInfo.records[i].task_id) === targetTaskId) {
            return pingInfo.records[i].value;
        }
    }
    return null;
}

/**
 * 获取延迟级别
 * @param {number} pingMs - 延迟值（毫秒）
 * @returns {string} 级别
 */
export function getPingLevel(pingMs) {
    if (pingMs === null || pingMs === undefined) return 'normal';
    if (pingMs < 50) return 'excellent';
    if (pingMs < 100) return 'normal';
    if (pingMs < 300) return 'warning';
    return 'danger';
}
