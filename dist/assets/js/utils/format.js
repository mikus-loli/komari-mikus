/**
 * @module utils/format
 * @description 数据格式化纯函数
 * @dependencies i18n/index.js
 * @exports formatBytes, formatSpeed, formatPercent, formatAxisSpeed, getSpeedAxisUnit, formatAxisCount, getCountAxisUnit, formatUptime, formatExpiry, formatPrice, formatPing, formatOS
 * @source app.js L967-L1152
 */

import { t } from '../i18n/index.js';

/**
 * 格式化字节数
 * @param {number} bytes - 字节数
 * @param {number} decimals - 小数位数
 * @returns {string} 格式化后的字符串
 */
export function formatBytes(bytes, decimals) {
    if (bytes === null || bytes === undefined) return '-';
    if (bytes === 0) return '0 B';

    var units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
    var k = 1024;
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    i = Math.min(i, units.length - 1);

    var value = bytes / Math.pow(k, i);

    if (value >= 1000 && i < units.length - 1) {
        i++;
        value = bytes / Math.pow(k, i);
    }

    if (decimals === undefined) {
        decimals = (i >= 3) ? 1 : 0;
    }

    var dm = decimals < 0 ? 0 : decimals;

    if (dm > 0 && value !== Math.floor(value)) {
        var multiplier = Math.pow(10, dm);
        value = Math.floor(value * multiplier) / multiplier;
    }

    var result = value.toFixed(dm).replace(/\.?0+$/, '') + ' ' + units[i];
    return result;
}

/**
 * 格式化网速
 * @param {number} bytesPerSec - 每秒字节数
 * @returns {string} 格式化后的字符串
 */
export function formatSpeed(bytesPerSec) {
    if (bytesPerSec === null || bytesPerSec === undefined) return '-';
    if (bytesPerSec === 0) return '0B/s';
    var units = ['B', 'K', 'M', 'G'];
    var i = Math.floor(Math.log(bytesPerSec) / Math.log(1024));
    i = Math.min(i, units.length - 1);
    return (bytesPerSec / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + units[i] + '/s';
}

/**
 * 格式化坐标轴网速值
 * @param {number} bytesPerSec - 每秒字节数
 * @param {number} maxVal - 最大值（用于确定单位）
 * @returns {string} 格式化后的字符串
 */
export function formatAxisSpeed(bytesPerSec, maxVal) {
    if (bytesPerSec === 0) return '0';
    if (maxVal === undefined) maxVal = bytesPerSec;
    var unitIdx = 0;
    if (maxVal >= 1024 * 1024 * 1024) {
        unitIdx = 3;
    } else if (maxVal >= 1024 * 1024) {
        unitIdx = 2;
    } else if (maxVal >= 1024) {
        unitIdx = 1;
    }
    var value = bytesPerSec / Math.pow(1024, unitIdx);
    if (unitIdx === 0) return Math.round(value).toString();
    return value.toFixed(value >= 100 ? 0 : 1);
}

/**
 * 获取网速坐标轴单位
 * @param {number} maxVal - 最大值
 * @returns {string} 单位字符串
 */
export function getSpeedAxisUnit(maxVal) {
    if (maxVal >= 1024 * 1024 * 1024) return 'GB/s';
    if (maxVal >= 1024 * 1024) return 'MB/s';
    if (maxVal >= 1024) return 'KB/s';
    return 'B/s';
}

/**
 * 格式化坐标轴计数值
 * @param {number} val - 值
 * @param {number} maxVal - 最大值
 * @returns {string} 格式化后的字符串
 */
export function formatAxisCount(val, maxVal) {
    if (maxVal === undefined) maxVal = val;
    if (maxVal >= 10000) {
        return (val / 1000).toFixed(val >= 1000 ? 0 : 1);
    }
    return Math.round(val).toString();
}

/**
 * 获取计数坐标轴单位
 * @param {number} maxVal - 最大值
 * @returns {string} 单位字符串
 */
export function getCountAxisUnit(maxVal) {
    if (maxVal >= 10000) return '×10³';
    return '';
}

/**
 * 格式化运行时间
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的字符串
 */
export function formatUptime(seconds) {
    if (!seconds || seconds <= 0) return '-';
    var d = Math.floor(seconds / 86400);
    var h = Math.floor((seconds % 86400) / 3600);
    var m = Math.floor((seconds % 3600) / 60);

    if (d > 0 && h > 0) return d + t('days') + ' ' + h + t('hours');
    if (d > 0) return d + t('days');
    if (h > 0 && m > 0) return h + t('hours') + ' ' + m + t('minutes');
    if (h > 0) return h + t('hours');
    if (m > 0) return m + t('minutes');
    return '<1' + t('minutes');
}

/**
 * 格式化过期时间
 * @param {string} expiredAt - 过期时间字符串
 * @returns {Object|null} 过期信息对象
 */
export function formatExpiry(expiredAt) {
    if (!expiredAt) return null;
    var expiry = new Date(expiredAt);
    if (isNaN(expiry.getTime())) return null;
    var now = new Date();
    var diff = expiry - now;
    if (diff < 0) return { text: t('expired'), level: 'expired', days: -1 };

    var days = Math.floor(diff / (1000 * 60 * 60 * 24));
    var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 365) return { text: t('long_term'), level: 'normal', days: days, isLongTerm: true };
    if (days > 30) return { text: days + t('days'), level: 'normal', days: days };
    if (days > 7) return { text: days + t('days') + ' ' + hours + t('hours'), level: 'warning', days: days };
    if (days > 0) return { text: days + t('days') + ' ' + hours + t('hours'), level: 'danger', days: days };
    if (hours > 0) return { text: hours + t('hours'), level: 'danger', days: 0 };
    return { text: '<1' + t('hours'), level: 'danger', days: 0 };
}

/**
 * 格式化价格
 * @param {number} price - 价格
 * @param {string} currency - 货币符号
 * @param {number} billingCycle - 计费周期（天）
 * @returns {string} 格式化后的字符串
 */
export function formatPrice(price, currency, billingCycle) {
    if (price === -1) return t('free');
    if (price === 0) return '';
    if (!currency || !billingCycle) return 'N/A';

    var cycleStr = billingCycle + t('days');
    if (billingCycle < 0) {
        return currency + price.toFixed(2);
    } else if (billingCycle === 30 || billingCycle === 31) {
        cycleStr = t('month');
    } else if (billingCycle >= 89 && billingCycle <= 92) {
        cycleStr = t('quarter');
    } else if (billingCycle >= 180 && billingCycle <= 183) {
        cycleStr = t('half_year');
    } else if (billingCycle >= 364 && billingCycle <= 366) {
        cycleStr = t('year');
    } else if (billingCycle >= 730 && billingCycle <= 732) {
        cycleStr = t('two_years');
    } else if (billingCycle >= 1095 && billingCycle <= 1097) {
        cycleStr = t('three_years');
    } else if (billingCycle >= 1825 && billingCycle <= 1827) {
        cycleStr = t('five_years');
    }

    return currency + price.toFixed(2) + '/' + cycleStr;
}

/**
 * 格式化百分比
 * @param {number} value - 值
 * @returns {string} 格式化后的字符串
 */
export function formatPercent(value) {
    if (value === null || value === undefined) return '-';
    return value.toFixed(1) + '%';
}

/**
 * 格式化 Ping 延迟
 * @param {number} latency - 延迟值（毫秒）
 * @returns {string} 格式化后的字符串
 */
export function formatPing(latency) {
    if (latency === null || latency === undefined || isNaN(latency)) return '-';
    return Math.round(latency) + 'ms';
}

/**
 * 格式化操作系统信息
 * @param {string} os - OS 字符串
 * @returns {Object} OS 信息对象
 */
export function formatOS(os) {
    if (!os) return { name: '-', icon: 'unknown' };
    var osLower = os.toLowerCase();
    if (osLower.indexOf('windows') !== -1) return { name: 'Windows', icon: 'windows' };
    if (osLower.indexOf('ubuntu') !== -1) return { name: 'Ubuntu', icon: 'ubuntu' };
    if (osLower.indexOf('debian') !== -1) return { name: 'Debian', icon: 'debian' };
    if (osLower.indexOf('centos') !== -1) return { name: 'CentOS', icon: 'centos' };
    if (osLower.indexOf('rocky') !== -1) return { name: 'Rocky', icon: 'rocky' };
    if (osLower.indexOf('alma') !== -1) return { name: 'Alma', icon: 'alma' };
    if (osLower.indexOf('red hat') !== -1 || osLower.indexOf('rhel') !== -1) return { name: 'RHEL', icon: 'rhel' };
    if (osLower.indexOf('fedora') !== -1) return { name: 'Fedora', icon: 'fedora' };
    if (osLower.indexOf('arch') !== -1) return { name: 'Arch', icon: 'arch' };
    if (osLower.indexOf('manjaro') !== -1) return { name: 'Manjaro', icon: 'manjaro' };
    if (osLower.indexOf('mint') !== -1) return { name: 'Mint', icon: 'mint' };
    if (osLower.indexOf('gentoo') !== -1) return { name: 'Gentoo', icon: 'gentoo' };
    if (osLower.indexOf('nix') !== -1) return { name: 'Nix', icon: 'nix' };
    if (osLower.indexOf('opensuse') !== -1 || osLower.indexOf('suse') !== -1) return { name: 'openSUSE', icon: 'suse' };
    if (osLower.indexOf('alpine') !== -1) return { name: 'Alpine', icon: 'alpine' };
    if (osLower.indexOf('openwrt') !== -1) return { name: 'OpenWrt', icon: 'openwrt' };
    if (osLower.indexOf('freebsd') !== -1) return { name: 'FreeBSD', icon: 'freebsd' };
    if (osLower.indexOf('macos') !== -1 || osLower.indexOf('mac os') !== -1) return { name: 'macOS', icon: 'macos' };
    if (osLower.indexOf('android') !== -1) return { name: 'Android', icon: 'android' };
    if (osLower.indexOf('armbian') !== -1) return { name: 'Armbian', icon: 'armbian' };
    if (osLower.indexOf('kail') !== -1 || osLower.indexOf('kali') !== -1) return { name: 'Kali', icon: 'kail' };
    if (osLower.indexOf('huawei') !== -1 || osLower.indexOf('openeuler') !== -1) return { name: 'Euler', icon: 'huawei' };
    if (osLower.indexOf('unraid') !== -1) return { name: 'Unraid', icon: 'unraid' };
    if (osLower.indexOf('qnap') !== -1) return { name: 'QNAP', icon: 'qnap' };
    if (osLower.indexOf('orange') !== -1) return { name: 'OrangePi', icon: 'orange-pi' };
    if (osLower.indexOf('fnos') !== -1) return { name: 'fnOS', icon: 'fnos' };
    if (osLower.indexOf('opencloudos') !== -1) return { name: 'OpenCloudOS', icon: 'opencloudos' };
    if (osLower.indexOf('istore') !== -1) return { name: 'iStore', icon: 'istore' };
    if (osLower.indexOf('proxmox') !== -1) return { name: 'Proxmox', icon: 'proxmox' };
    if (osLower.indexOf('synology') !== -1) return { name: 'Synology', icon: 'synology' };
    if (osLower.indexOf('astar') !== -1) return { name: 'Astar', icon: 'astar' };
    if (osLower.indexOf('alibaba') !== -1 || osLower.indexOf('aliyun') !== -1) return { name: 'Alibaba', icon: 'alibaba' };
    if (osLower.indexOf('linux') !== -1) return { name: 'Linux', icon: 'linux' };
    var parts = os.split(/[\s\-_]/);
    return { name: parts[0] || os, icon: 'unknown' };
}
