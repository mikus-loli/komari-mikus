import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../dist/assets/css/stats.css', import.meta.url), 'utf8');

function ruleBody(selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(escaped + '\\s*\\{([^}]*)\\}'));
    assert.ok(match, `未找到 CSS 规则：${selector}`);
    return match[1];
}

const groupFilterRule = ruleBody('.group-filter');

assert.match(groupFilterRule, /overflow-x\s*:\s*auto\s*;/, '分组过多时应允许横向滚动');
assert.match(groupFilterRule, /flex-wrap\s*:\s*nowrap\s*;/, '分组按钮应保持单行');
assert.match(groupFilterRule, /scrollbar-width\s*:\s*none\s*;/, '应隐藏 Firefox 滚动条');
assert.match(css, /\.group-filter::?-webkit-scrollbar\s*\{[^}]*display\s*:\s*none\s*;/s, '应隐藏 WebKit 滚动条');
assert.match(css, /\.group-filter\s+\.filter-btn\s*\{[^}]*flex\s*:\s*0\s+0\s+auto\s*;/s, '分组按钮不应被压缩');

console.log('分组筛选栏横向滚动样式测试通过');
