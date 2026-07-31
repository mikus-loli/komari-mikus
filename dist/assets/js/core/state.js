/**
 * @module core/state
  * @description 全局状态单例 + 缓存管理
 * @dependencies core/constants.js
 * @exports state, historyCache, pingCache, getCachedData, setCachedData
 */

import { EWMA_ALPHA_DEFAULT, CACHE_EXPIRY_MS } from './constants.js';

/** 历史数据缓存 */
export const historyCache = new Map();

/** Ping 数据缓存 */
export const pingCache = new Map();

/**
 * 获取缓存数据
 * @param {Map} cache - 缓存 Map
 * @param {string} key - 缓存键
 * @returns {*} 缓存数据或 null
 */
export function getCachedData(cache, key) {
    if (cache.has(key)) {
        const cached = cache.get(key);
        if (Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
            return cached.data;
        }
        cache.delete(key);
    }
    return null;
}

/**
 * 设置缓存数据
 * @param {Map} cache - 缓存 Map
 * @param {string} key - 缓存键
 * @param {*} data - 缓存数据
 */
export function setCachedData(cache, key, data) {
    cache.set(key, {
        data: data,
        timestamp: Date.now()
    });
}

/** 全局状态单例 */
export const state = {
    nodes: [],
    realtimeData: {},
    onlineNodes: [],
    publicSettings: {},
    themeSettings: {},
    currentView: 'grid',
    currentGroup: 'all',
    searchQuery: '',
    currentTheme: 'light',
    currentLang: 'zh-CN',
    rpc: null,
    selectedNodeUuid: null,
    historyData: {},
    historyDataHours: {},
    realtimeHistory: {},
    pingData: {},
    pingDataHours: {},
    initialRender: true,
    modalElements: null,
    chartsDrawn: {},
    chartObserver: null,
    latencyChartSmooth: true,
    ewmaAlpha: EWMA_ALPHA_DEFAULT,
    historyTimeRange: '1h',
    pingTimeRange: '1h'
};
