/**
 * @module ui/theme
 * @description 主题切换、视图切换、语言切换、主题设置应用（footer/mascot/background/sakura）
 * @dependencies core/state.js, core/constants.js, i18n/index.js, ui/preloader.js, ui/nodes.js, utils/helpers.js
 * @exports initTheme, applyTheme, toggleTheme, toggleLang, initView, applyView, setView, applyThemeSettings, applyBackgroundSettings, applySakura
 * @source app.js L1816-L1922, L4232-L4374
 */

import { state } from '../core/state.js';
import { THEME_MAP, VIEW_MAP } from '../core/constants.js';
import { applyLang } from '../i18n/index.js';
import { clearPreloaderTimer } from './preloader.js';
import { renderAll } from './nodes.js';
import { isMobileDevice } from '../utils/helpers.js';

/**
 * 初始化主题（读取 localStorage 或配置默认值，监听系统主题变化）
 */
export function initTheme() {
    const saved = localStorage.getItem('appearance');
    const configDefault = state.themeSettings.default_theme;
    let preferred = 'system';

    if (configDefault) {
        preferred = THEME_MAP[configDefault] || configDefault;
    }

    let theme = saved || preferred;
    if (theme === 'system') {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    state.currentTheme = theme;
    applyTheme(theme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
        const saved = localStorage.getItem('appearance');
        if (!saved || saved === 'system') {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
}

/**
 * 应用主题到页面
 * @param {string} theme - 'dark' 或 'light'
 */
export function applyTheme(theme) {
    state.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    const themeColor = theme === 'dark' ? '#0f0a15' : '#f8f6f9';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', themeColor);
}

/**
 * 切换主题（明暗互换）
 */
export function toggleTheme() {
    const next = state.currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('appearance', next);
}

/**
 * 切换语言（中英文互换）并重新渲染页面
 */
export function toggleLang() {
    state.currentLang = state.currentLang === 'zh-CN' ? 'en' : 'zh-CN';
    localStorage.setItem('i18nextLng', state.currentLang);
    applyLang();
    renderAll();
}

/**
 * 初始化视图模式（读取 localStorage 或配置默认值）
 */
export function initView() {
    const saved = localStorage.getItem('nodeViewMode');
    const configDefault = state.themeSettings.default_view;
    const mappedDefault = configDefault ? (VIEW_MAP[configDefault] || configDefault) : 'grid';
    state.currentView = saved || mappedDefault;
    applyView();
}

/**
 * 应用视图模式到页面（网格/表格）
 */
export function applyView() {
    const grid = document.getElementById('nodesGrid');
    const table = document.getElementById('nodesTableContainer');
    const btns = document.querySelectorAll('.view-btn');

    if (state.currentView === 'grid') {
        if (grid) grid.style.display = '';
        if (table) table.style.display = 'none';
        document.body.classList.remove('view-table');
        document.body.classList.add('view-grid');
    } else {
        if (grid) grid.style.display = 'none';
        if (table) table.style.display = '';
        document.body.classList.remove('view-grid');
        document.body.classList.add('view-table');
    }

    btns.forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-view') === state.currentView);
    });
}

/**
 * 设置视图模式并持久化
 * @param {string} view - 'grid' 或 'table'
 */
export function setView(view) {
    state.currentView = view;
    localStorage.setItem('nodeViewMode', view);
    applyView();
}

/**
 * 应用主题设置（footer/mascot/preloader/background/sakura）
 */
export function applyThemeSettings() {
    const customFooter = state.themeSettings.custom_footer;
    const footerEl = document.getElementById('customFooter');
    if (footerEl && customFooter) {
        footerEl.textContent = customFooter;
    }

    const iconBounce = state.themeSettings.icon_bounce !== false;
    const greetingIcon = document.querySelector('.greeting-icon');
    if (greetingIcon) {
        if (!iconBounce) {
            greetingIcon.classList.add('no-bounce');
        } else {
            greetingIcon.classList.remove('no-bounce');
        }

        const mascotEnabled = state.themeSettings.mascot_enabled !== false;
        const mascotUrl = state.themeSettings.mascot_url || '';
        const welcomeGreeting = document.querySelector('.welcome-greeting');
        if (!mascotEnabled) {
            greetingIcon.style.display = 'none';
            if (welcomeGreeting) welcomeGreeting.classList.add('no-mascot');
        } else {
            greetingIcon.style.display = '';
            if (welcomeGreeting) welcomeGreeting.classList.remove('no-mascot');
            if (mascotUrl) {
                greetingIcon.src = mascotUrl;
            }
        }
    }

    const preloaderEnabled = state.themeSettings.preloader_enabled !== false;
    if (!preloaderEnabled) {
        const preloader = document.getElementById('preloader');
        if (preloader) {
            preloader.classList.add('hidden');
            clearPreloaderTimer();
        }
    }

    applyBackgroundSettings();
    applySakura();
}

/**
 * 应用背景设置（图片/视频，区分 PC/移动端）
 */
export function applyBackgroundSettings() {
    const isMobile = isMobileDevice();
    const prefix = isMobile ? 'mobile_' : 'pc_';

    let bgUrl = state.themeSettings[prefix + 'background_url'];
    if (bgUrl === undefined || bgUrl === null) {
        bgUrl = state.themeSettings.background_url || '';
    }

    const bgType = bgUrl ? 'custom' : 'none';

    const root = document.documentElement;
    root.style.setProperty('--custom-card-alpha', '0.85');

    if (bgType !== 'none') {
        document.body.classList.add('has-custom-background');
    } else {
        document.body.classList.remove('has-custom-background');
    }

    let bgContainer = document.getElementById('customBackground');
    if (!bgContainer) {
        bgContainer = document.createElement('div');
        bgContainer.id = 'customBackground';
        bgContainer.className = 'custom-background hidden';
        document.body.insertBefore(bgContainer, document.body.firstChild);
    }

    const existingVideo = bgContainer.querySelector('video');
    if (existingVideo) {
        existingVideo.pause();
        existingVideo.remove();
    }

    bgContainer.className = 'custom-background';
    bgContainer.style.backgroundImage = '';

    if (bgType === 'none') {
        bgContainer.classList.add('hidden');
    } else if (bgType === 'custom' && bgUrl) {
        const isVideo = /\.(webm|mp4|ogg|mov)(\?.*)?$/i.test(bgUrl);

        if (isVideo) {
            bgContainer.classList.remove('hidden');
            const video = document.createElement('video');
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.src = bgUrl;
            bgContainer.appendChild(video);
            video.play().catch(function() {});
        } else {
            bgContainer.classList.remove('hidden');
            bgContainer.style.backgroundImage = 'url(' + bgUrl + ')';
        }
    }

    bgContainer.style.opacity = '1';
}

/**
 * 应用樱花特效（根据配置动态加载/移除 sakura.js）
 */
export function applySakura() {
    const sakuraEnabled = state.themeSettings.sakura_enabled !== false;
    const sakuraScript = document.getElementById('sakura-script');

    if (sakuraEnabled && !sakuraScript) {
        const style = document.createElement('style');
        style.id = 'sakura-style';
        style.textContent = '#sakura-canvas, canvas[id*="sakura"] { z-index: 99999 !important; pointer-events: none !important; position: fixed !important; top: 0 !important; left: 0 !important; }';
        document.head.appendChild(style);

        const script = document.createElement('script');
        script.id = 'sakura-script';
        script.type = 'text/javascript';
        script.src = 'https://static.mikus.ink/%E6%A8%B1%E8%8A%B1/sakura.js';
        script.onload = function() {
            const canvas = document.querySelector('canvas[style*="fixed"]');
            if (canvas) {
                canvas.id = canvas.id || 'sakura-canvas';
                canvas.style.zIndex = '99999';
                canvas.style.pointerEvents = 'none';
            }
        };
        document.body.appendChild(script);
    } else if (!sakuraEnabled && sakuraScript) {
        sakuraScript.remove();
        const sakuraStyle = document.getElementById('sakura-style');
        if (sakuraStyle) sakuraStyle.remove();
        let sakuraCanvas = document.getElementById('sakura-canvas');
        if (!sakuraCanvas) sakuraCanvas = document.querySelector('canvas[style*="fixed"]');
        if (sakuraCanvas) sakuraCanvas.remove();
    }
}
