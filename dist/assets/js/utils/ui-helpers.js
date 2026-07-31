/**
 * @module utils/ui-helpers
 * @description UI 辅助函数
 * @dependencies core/state.js, i18n/index.js
 * @exports getGreeting, resetAnimation, isMobileDevice, getUsageLevel, getShortOs
 */

import { state } from '../core/state.js';
import { i18n } from '../i18n/index.js';

/**
 * 获取问候语
 * @returns {string} 问候语
 */
export function getGreeting() {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) {
        return i18n[state.currentLang] && i18n[state.currentLang].good_morning ? i18n[state.currentLang].good_morning : '早上好';
    } else if (hours >= 12 && hours < 18) {
        return i18n[state.currentLang] && i18n[state.currentLang].good_afternoon ? i18n[state.currentLang].good_afternoon : '下午好';
    } else {
        return i18n[state.currentLang] && i18n[state.currentLang].good_evening ? i18n[state.currentLang].good_evening : '晚上好';
    }
}

/**
 * 重置元素动画
 * @param {HTMLElement} element - DOM 元素
 */
export function resetAnimation(element) {
    if (!element) return;
    element.style.animation = 'none';
    void element.offsetHeight;
    element.style.animation = '';
}

/**
 * 判断是否为移动设备
 * @returns {boolean} 是否为移动设备
 */
export function isMobileDevice() {
    return window.innerWidth <= 768;
}

/**
 * 获取使用率级别
 * @param {number} percent - 百分比
 * @returns {string} 级别
 */
export function getUsageLevel(percent) {
    if (percent < 60) return 'normal';
    if (percent < 85) return 'warning';
    return 'danger';
}

/**
 * 获取 OS 简称
 * @param {string} os - OS 字符串
 * @returns {string} OS 简称
 */
export function getShortOs(os) {
    if (!os) return '-';
    const osLower = os.toLowerCase();
    if (osLower.indexOf('debian') !== -1) return 'Debian';
    if (osLower.indexOf('ubuntu') !== -1) return 'Ubuntu';
    if (osLower.indexOf('centos') !== -1) return 'CentOS';
    if (osLower.indexOf('rocky') !== -1) return 'Rocky';
    if (osLower.indexOf('almalinux') !== -1) return 'Alma';
    if (osLower.indexOf('fedora') !== -1) return 'Fedora';
    if (osLower.indexOf('arch') !== -1) return 'Arch';
    if (osLower.indexOf('alpine') !== -1) return 'Alpine';
    if (osLower.indexOf('windows') !== -1) return 'Windows';
    if (osLower.indexOf('macos') !== -1 || osLower.indexOf('darwin') !== -1) return 'macOS';
    if (osLower.indexOf('freebsd') !== -1) return 'FreeBSD';
    if (osLower.indexOf('opensuse') !== -1 || osLower.indexOf('suse') !== -1) return 'openSUSE';
    if (osLower.indexOf('raspbian') !== -1) return 'Raspbian';
    if (osLower.indexOf('oracle') !== -1) return 'Oracle';
    if (osLower.indexOf('red hat') !== -1 || osLower.indexOf('rhel') !== -1) return 'RHEL';
    const parts = os.split(' ');
    return parts[0] || os.substring(0, 12);
}
