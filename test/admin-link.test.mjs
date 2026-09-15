import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');

assert.match(
    html,
    /<a\s+class="login-btn"\s+href="\/admin\/dashboard"/,
    '后台入口必须指向 Komari 当前管理面板路径 /admin/dashboard'
);

console.log('后台入口路径测试通过');
