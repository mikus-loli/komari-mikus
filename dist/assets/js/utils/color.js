/**
 * @module utils/color
 * @description 颜色生成与字体缓存
 * @dependencies 无
 * @exports generateOKLCHColor, getCachedFontFamily
 */

/** 模块私有变量：缓存的字体名称 */
let _cachedFontFamily = null;
/** 模块私有变量：字体缓存时间 */
let _cachedFontFamilyTime = 0;

/**
 * 获取缓存的字体名称（5秒缓存）
 * @returns {string} 字体名称
 */
export function getCachedFontFamily() {
    const now = Date.now();
    if (!_cachedFontFamily || now - _cachedFontFamilyTime > 5000) {
        _cachedFontFamily = getComputedStyle(document.body).fontFamily;
        _cachedFontFamilyTime = now;
    }
    return _cachedFontFamily;
}

/**
 * OKLCH 颜色生成
 * @param {number} index - 索引
 * @param {number} total - 总数
 * @returns {string} 颜色字符串
 */
export function generateOKLCHColor(index, total) {
    const hue = (index * (360 / total)) % 360;
    const oklchColor = 'oklch(0.7 0.2 ' + hue + ' / 0.8)';
    const hslFallback = 'hsl(' + hue + ', 50%, 60%)';

    if (typeof window !== 'undefined' && window.CSS && CSS.supports('color', oklchColor)) {
        return oklchColor;
    } else {
        return hslFallback;
    }
}
