/**
 * @module utils/url
 * @description URL/网络相关辅助函数
 * @exports getApiBase, getWsUrl
 */

/**
 * 获取 API 基础 URL
 * @returns {string} API 基础 URL
 */
export function getApiBase() {
    return window.location.origin;
}

/**
 * 获取 WebSocket URL
 * @returns {string} WebSocket URL
 */
export function getWsUrl() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + window.location.host + '/api/rpc2';
}
