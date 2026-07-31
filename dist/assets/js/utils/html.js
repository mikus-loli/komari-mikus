/**
 * @module utils/html
 * @description HTML 相关辅助函数
 * @exports escapeHtml, parseTagInfo
 */

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
