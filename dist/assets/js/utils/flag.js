/**
 * @module utils/flag
 * @description 国旗/地区相关辅助函数
 * @dependencies core/constants.js
 * @exports parseFlagEmoji, getCountryCode, getCountryFlagUrl, getCountryFlag
 */

import { COUNTRY_CODE_MAP } from '../core/constants.js';

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
