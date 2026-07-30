/**
 * @module app
 * @description 应用主入口 - 初始化编排
 * @dependencies services/rpc, services/realtime, services/api, ui/preloader, ui/theme, ui/nodes, ui/events, ui/charts, i18n/index
 * @source app.js L4845-L4897
 */

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
import { drawCharts } from './ui/charts.js';

/**
 * 应用初始化
 * 编排预加载器、RPC 连接、配置加载、节点渲染、事件绑定等流程
 */
function init() {
    startPreloaderSimulation();
    updateTime();
    setInterval(updateTime, 1000);

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
        const statusEl = document.getElementById('preloaderStatus');
        if (statusEl) {
            statusEl.textContent = '加载失败，正在重试...';
            statusEl.classList.add('error');
        }
        updatePreloader(getPreloaderProgress(), '加载失败，正在重试...');
        setTimeout(function () {
            hidePreloader();
        }, 3000);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
