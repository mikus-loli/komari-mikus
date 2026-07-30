/**
 * @module ui/preloader
 * @description 预加载器进度模拟 + 时间问候更新
 * @dependencies core/state.js, i18n/index.js
 * @exports startPreloaderSimulation, updatePreloader, hidePreloader, updateTime, updateGreetingSubtitle, clearPreloaderTimer, getPreloaderProgress
 * @source app.js L4739-L4843
 */

import { state } from '../core/state.js';
import { i18n } from '../i18n/index.js';

/** 模块私有：预加载器当前进度 */
let preloaderProgress = 0;

/** 模块私有：预加载器定时器引用 */
let preloaderTimer = null;

/**
 * 更新顶部时间显示和问候语
 */
export function updateTime() {
    const now = new Date();
    const hours = now.getHours();
    let greeting = '';

    if (hours >= 5 && hours < 12) {
        greeting = i18n[state.currentLang] && i18n[state.currentLang].good_morning ? i18n[state.currentLang].good_morning : '早上好';
    } else if (hours >= 12 && hours < 18) {
        greeting = i18n[state.currentLang] && i18n[state.currentLang].good_afternoon ? i18n[state.currentLang].good_afternoon : '下午好';
    } else {
        greeting = i18n[state.currentLang] && i18n[state.currentLang].good_evening ? i18n[state.currentLang].good_evening : '晚上好';
    }

    const greetingEl = document.getElementById('greetingText');
    if (greetingEl) greetingEl.textContent = greeting;

    updateGreetingSubtitle();

    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const dateStr = now.toLocaleDateString(state.currentLang === 'zh-CN' ? 'zh-CN' : 'en-US', dateOptions);
    const dateEl = document.getElementById('currentDate');
    if (dateEl) dateEl.textContent = dateStr;

    const timeStr = now.toLocaleTimeString(state.currentLang === 'zh-CN' ? 'zh-CN' : 'en-US', { hour12: false });
    const timeEl = document.getElementById('currentTime');
    if (timeEl) timeEl.textContent = timeStr;
}

/**
 * 根据节点在线状态更新欢迎区副标题
 */
export function updateGreetingSubtitle() {
    const subtitleEl = document.querySelector('.greeting-subtitle');
    if (!subtitleEl) return;

    const total = state.nodes.length;
    const online = state.onlineNodes.length;
    const offline = total - online;

    const isZh = state.currentLang === 'zh-CN';
    let message = '';

    if (total === 0) {
        message = isZh ? '欢迎回来，正在加载数据...' : 'Welcome back, loading data...';
    } else if (offline === 0) {
        message = isZh ? '欢迎回来，一切正常运行中' : 'Welcome back, all systems operational';
    } else if (online === 0) {
        message = isZh ? '欢迎回来，服务暂时不可用' : 'Welcome back, services temporarily unavailable';
    } else if (offline <= Math.floor(total * 0.3)) {
        message = isZh
            ? '欢迎回来，部分服务异常，' + offline + '个节点离线'
            : 'Welcome back, some services affected, ' + offline + ' nodes offline';
    } else {
        message = isZh
            ? '欢迎回来，多数服务异常，' + offline + '/' + total + '个节点离线'
            : 'Welcome back, major service issues, ' + offline + '/' + total + ' nodes offline';
    }

    subtitleEl.textContent = message;
}

/**
 * 更新预加载器进度
 * @param {number} progress - 进度百分比 0-100
 * @param {string} [statusText] - 状态文字
 */
export function updatePreloader(progress, statusText) {
    const fillEl = document.getElementById('progressFill');
    const textEl = document.getElementById('progressText');
    const statusEl = document.getElementById('preloaderStatus');
    if (fillEl) fillEl.style.width = progress + '%';
    if (textEl) textEl.textContent = Math.round(progress) + '%';
    if (statusEl && statusText) statusEl.textContent = statusText;
    preloaderProgress = progress;
}

/**
 * 隐藏预加载器
 */
export function hidePreloader() {
    const preloader = document.getElementById('preloader');
    if (!preloader) return;
    const completeText = state.currentLang === 'zh-CN' ? '加载完成' : 'Loading complete';
    updatePreloader(100, completeText);
    setTimeout(function () {
        preloader.classList.add('fade-out');
        setTimeout(function () {
            preloader.classList.add('hidden');
        }, 600);
    }, 300);
}

/**
 * 启动预加载器进度模拟
 */
export function startPreloaderSimulation() {
    const stages = [
        { target: 20, text: state.currentLang === 'zh-CN' ? '正在加载样式...' : 'Loading styles...' },
        { target: 40, text: state.currentLang === 'zh-CN' ? '正在获取配置...' : 'Fetching config...' },
        { target: 60, text: state.currentLang === 'zh-CN' ? '正在加载节点...' : 'Loading nodes...' },
        { target: 80, text: state.currentLang === 'zh-CN' ? '正在连接服务...' : 'Connecting service...' },
        { target: 90, text: state.currentLang === 'zh-CN' ? '正在初始化...' : 'Initializing...' }
    ];
    let stageIndex = 0;
    preloaderTimer = setInterval(function () {
        if (stageIndex >= stages.length) {
            clearInterval(preloaderTimer);
            return;
        }
        const stage = stages[stageIndex];
        if (preloaderProgress < stage.target) {
            updatePreloader(preloaderProgress + 1, stage.text);
        } else {
            stageIndex++;
        }
    }, 80);
}

/**
 * 清理预加载器定时器
 */
export function clearPreloaderTimer() {
    if (preloaderTimer) {
        clearInterval(preloaderTimer);
        preloaderTimer = null;
    }
}

/**
 * 获取预加载器当前进度
 * @returns {number} 当前进度百分比 0-100
 */
export function getPreloaderProgress() {
    return preloaderProgress;
}
