/**
 * @module utils/helpers
 * @description 通用辅助函数
 * @dependencies core/state.js, core/constants.js, i18n/index.js
 * @exports escapeHtml, parseTagInfo, getGreeting, resetAnimation, isMobileDevice, getUsageLevel, trimRecords, getMaxDataPoints, getCountryCode, getCountryFlag, getCountryFlagUrl, parseFlagEmoji, getLatestPing, getPingTasks, getTaskLatestPing, getPingLevel, getShortOs, getApiBase, getWsUrl
 */

import { state } from '../core/state.js';
import { COUNTRY_CODE_MAP } from '../core/constants.js';
import { i18n, t } from '../i18n/index.js';

/**
 * HTML 转义
 * @param {string} str - 原始字符串
 * @returns {string} 转义后的字符串
 */
export function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * 解析标签信息
 * @param {string} tag - 标签字符串
 * @returns {Object} 标签信息对象
 */
export function parseTagInfo(tag) {
    let tagText = tag.trim();
    let tagClass = '';
    const colorMatch = tagText.match(/<(\w+)>$/);

    if (colorMatch) {
        tagText = tagText.replace(/<\w+>$/, '').trim();
        const color = colorMatch[1].toLowerCase();
        const validColors = ['green', 'red', 'blue', 'yellow', 'orange', 'purple', 'pink', 'cyan', 'gray', 'success', 'danger', 'warning', 'info'];
        if (validColors.indexOf(color) !== -1) {
            tagClass = ' tag-' + color;
        }
    }

    return {
        text: tagText,
        className: tagClass
    };
}

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
 * 数据裁剪：限制数据点数量
 * @param {Array} records - 数据记录数组
 * @param {number} maxCount - 最大数量
 * @returns {Array} 裁剪后的数组
 */
export function trimRecords(records, maxCount) {
    if (!records || records.length <= maxCount) return records;
    return records.slice(-maxCount);
}

/**
 * 根据时间范围智能计算最大数据点数
 * @param {number} hours - 小时数
 * @returns {number} 最大数据点数
 */
export function getMaxDataPoints(hours) {
    if (hours <= 4) return 600;
    return 600;
}

/**
 * 解析国旗 emoji
 * @param {string} emoji - emoji 字符串
 * @returns {string|null} 国家代码
 */
export function parseFlagEmoji(emoji) {
    if (!emoji || emoji.length < 2) return null;

    const codePoints = [];
    for (let i = 0; i < emoji.length; i++) {
        const cp = emoji.codePointAt(i);
        if (cp >= 0x1F1E6 && cp <= 0x1F1FF) {
            codePoints.push(cp);
            if (cp > 0xFFFF) i++;
        }
    }

    if (codePoints.length >= 2) {
        const letter1 = String.fromCharCode(codePoints[0] - 0x1F1E6 + 65);
        const letter2 = String.fromCharCode(codePoints[1] - 0x1F1E6 + 65);
        return (letter1 + letter2).toLowerCase();
    }

    return null;
}

/**
 * 获取国家代码
 * @param {string} region - 地区名称
 * @returns {string|null} 国家代码
 */
export function getCountryCode(region) {
    if (!region) return null;

    const code = region.toLowerCase().trim();

    if (COUNTRY_CODE_MAP[code]) return COUNTRY_CODE_MAP[code];

    for (let key in COUNTRY_CODE_MAP) {
        if (code.indexOf(key) !== -1) {
            return COUNTRY_CODE_MAP[key];
        }
    }

    if (region.length === 2 && /^[a-z]{2}$/i.test(region)) {
        return region.toLowerCase();
    }

    const emojiCode = parseFlagEmoji(region);
    if (emojiCode) return emojiCode;

    return null;
}

/**
 * 获取国旗 URL
 * @param {string} countryCode - 国家代码
 * @returns {string|null} 国旗图片 URL
 */
export function getCountryFlagUrl(countryCode) {
    if (!countryCode) return null;
    return 'assets/flags/' + countryCode.toLowerCase() + '.svg';
}

/**
 * 获取国旗
 * @param {string} region - 地区名称
 * @returns {string|null} 国旗 URL
 */
export function getCountryFlag(region) {
    const code = getCountryCode(region);
    if (!code) return null;
    return getCountryFlagUrl(code);
}

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
