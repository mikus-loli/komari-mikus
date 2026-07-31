/**
 * @module utils/helpers
 * @description 通用辅助函数聚合模块 — 从各子模块 re-export，保持外部导入路径不变
 * @re-exports html, ui-helpers, data-trim, flag, ping, url
 */

export { escapeHtml, parseTagInfo } from './html.js';
export { getGreeting, resetAnimation, isMobileDevice, getUsageLevel, getShortOs } from './ui-helpers.js';
export { trimRecords, getMaxDataPoints } from './data-trim.js';
export { parseFlagEmoji, getCountryCode, getCountryFlagUrl, getCountryFlag } from './flag.js';
export { getLatestPing, getPingTasks, getTaskLatestPing, getPingLevel } from './ping.js';
export { getApiBase, getWsUrl } from './url.js';
