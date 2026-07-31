/**
 * @module app
 * @description 应用主入口 - 初始化编排
 * @dependencies core/error-boundary, services/rpc, services/realtime, services/api, ui/preloader, ui/theme, ui/nodes, ui/events, ui/charts, i18n/index
 */

import { initErrorBoundary } from './core/error-boundary.js';
import { initRPC2Client } from './services/rpc.js';
import { handleRpcResult, setRenderFunctions } from './services/realtime.js';
import { loadPublicSettings, loadNodes, loadAllPingData } from './services/api.js';
import {
    startPreloaderSimulation,
    updateTime,
    updatePreloader,
    hidePreloader,
    clearPreloaderTimer,
    getPreloaderProgress
} from './ui/preloader.js';
import { initTheme, initView, applyThemeSettings } from './ui/theme.js';
import { initLang } from './i18n/index.js';
import { renderGroupFilter, renderAll } from './ui/nodes.js';
import { bindEvents } from './ui/events.js';
import { drawCharts } from './ui/charts/index.js';
import { state } from './core/state.js';

/** 模块私有：时间更新定时器引用（重试时需清理） */
let timeIntervalId = null;

/**
 * 释放上一轮 init 申请的可复用资源，保证重试幂等
 */
function cleanupBeforeInit() {
    if (timeIntervalId) {
        clearInterval(timeIntervalId);
        timeIntervalId = null;
    }
    if (state.rpc) {
        state.rpc.disconnect();
        state.rpc = null;
    }
}

/**
 * 应用初始化
 * 编排预加载器、RPC 连接、配置加载、节点渲染、事件绑定等流程
 */
function init() {
    cleanupBeforeInit();
    initErrorBoundary();
    startPreloaderSimulation();
    updateTime();
    timeIntervalId = setInterval(updateTime, 1000);

    document.querySelectorAll('.stat-item').forEach(function (item) {
        item.classList.add('animate-in');
    });

    const groupFilter = document.querySelector('.stats-bar .group-filter');
    if (groupFilter) groupFilter.classList.add('animate-in');

    initRPC2Client(handleRpcResult);
    setRenderFunctions(drawCharts, renderAll);

    loadPublicSettings().then(function () {
        updatePreloader(30, '正在获取配置...');
        initTheme();
        initLang();
        initView();
        applyThemeSettings();
        return loadNodes();
    }).then(function () {
        updatePreloader(60, '正在加载节点...');
        renderGroupFilter();
        renderAll();
        bindEvents();
        return loadAllPingData();
    }).then(function () {
        updatePreloader(90, '正在初始化...');
        renderAll();
        clearPreloaderTimer();
        hidePreloader();
    }).catch(function (err) {
        console.error('Init failed:', err);
        clearPreloaderTimer();
        const MAX_RETRIES = 3;
        const retryCount = (window.__initRetryCount || 0) + 1;
        window.__initRetryCount = retryCount;

        if (retryCount <= MAX_RETRIES) {
            updatePreloader(getPreloaderProgress(), '加载失败，正在重试 (' + retryCount + '/' + MAX_RETRIES + ')...');
            setTimeout(init, 3000);
        } else {
            const statusEl = document.getElementById('preloaderStatus');
            if (statusEl) {
                statusEl.textContent = '加载失败，请刷新页面';
                statusEl.classList.add('error');
            }
            updatePreloader(getPreloaderProgress(), '加载失败，请刷新页面');
            setTimeout(hidePreloader, 3000);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
