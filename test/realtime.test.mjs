/**
 * services/realtime.js 单元测试
 * 运行：node test/realtime.test.mjs
 * 说明：RAF 在 node 中不存在，测试中 polyfill 为同步执行，以便断言渲染/重绘被正确调度
 */

import assert from 'node:assert/strict';
import { handleRpcResult, setRenderFunctions } from '../dist/assets/js/services/realtime.js';
import { state } from '../dist/assets/js/core/state.js';
import { MAX_HISTORY_POINTS } from '../dist/assets/js/core/constants.js';

// RAF polyfill：同步执行回调（等价于"下一帧立即渲染"），模块内的 typeof document 守卫保证可导入
globalThis.requestAnimationFrame = function(fn) { fn(); return 0; };

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (err) {
        failed++;
        console.log(`  ✗ ${name}`);
        console.log(`    ${err.message}`);
    }
}

const UUID = 'test-node-uuid';

function status(time, online) {
    return {
        online: online !== false,
        time: time,
        cpu: 50,
        ram: 1024,
        ram_total: 2048
    };
}

const renderCalls = [];
const drawCalls = [];
setRenderFunctions(function(uuid) { drawCalls.push(uuid); }, function() { renderCalls.push(true); });

function resetState() {
    state.onlineNodes = [];
    state.realtimeData = {};
    state.realtimeHistory = {};
    state.selectedNodeUuid = null;
    state.historyTimeRange = 'realtime';
    renderCalls.length = 0;
    drawCalls.length = 0;
}

// ── handleRpcResult ───────────────────────────────────────────────

console.log('\nhandleRpcResult:');

test('null/undefined result 安全返回', function() {
    resetState();
    assert.doesNotThrow(function() { handleRpcResult(null); });
    assert.doesNotThrow(function() { handleRpcResult(undefined); });
    assert.strictEqual(renderCalls.length, 0);
});

test('收集在线节点并写入 realtimeData', function() {
    resetState();
    handleRpcResult({
        [UUID]: status('2026-07-31T00:00:00Z', true),
        'offline-node': status('2026-07-31T00:00:00Z', false)
    });
    assert.deepStrictEqual(state.onlineNodes, [UUID]);
    assert.ok(state.realtimeData[UUID]);
    assert.strictEqual(state.realtimeData[UUID].cpu.usage, 50);
    assert.strictEqual(state.realtimeData[UUID].ram.used, 1024);
});

test('相同时间戳去重，不重复追加记录', function() {
    resetState();
    handleRpcResult({ [UUID]: status('2026-07-31T00:00:00Z') });
    handleRpcResult({ [UUID]: status('2026-07-31T00:00:00Z') });
    assert.strictEqual(state.realtimeHistory[UUID].length, 1);
});

test('不同时间戳按序追加合并', function() {
    resetState();
    handleRpcResult({ [UUID]: status('2026-07-31T00:00:00Z') });
    handleRpcResult({ [UUID]: status('2026-07-31T00:00:01Z') });
    handleRpcResult({ [UUID]: status('2026-07-31T00:00:03Z') });
    assert.strictEqual(state.realtimeHistory[UUID].length, 3);
    assert.strictEqual(state.realtimeHistory[UUID][0].time, '2026-07-31T00:00:00Z');
    assert.strictEqual(state.realtimeHistory[UUID][2].time, '2026-07-31T00:00:03Z');
});

test('realtimeHistory 超过 MAX_HISTORY_POINTS 时裁剪', function() {
    resetState();
    const total = MAX_HISTORY_POINTS + 20;
    const base = Date.UTC(2026, 6, 31);
    for (let i = 0; i < total; i++) {
        handleRpcResult({ [UUID]: status(new Date(base + i * 1000).toISOString()) });
    }
    assert.strictEqual(state.realtimeHistory[UUID].length, MAX_HISTORY_POINTS);
    // 保留的是最后 MAX_HISTORY_POINTS 条
    assert.strictEqual(state.realtimeHistory[UUID][0].time, new Date(base + 20 * 1000).toISOString());
});

test('选中实时节点时触发图表重绘', function() {
    resetState();
    state.selectedNodeUuid = UUID;
    state.historyTimeRange = 'realtime';
    handleRpcResult({ [UUID]: status('2026-07-31T00:00:00Z') });
    assert.deepStrictEqual(drawCalls, [UUID]);
});

test('非实时范围不触发图表重绘', function() {
    resetState();
    state.selectedNodeUuid = UUID;
    state.historyTimeRange = '1h';
    handleRpcResult({ [UUID]: status('2026-07-31T00:00:00Z') });
    assert.strictEqual(drawCalls.length, 0);
});

test('每次数据推送都会调度一次 renderAll', function() {
    resetState();
    handleRpcResult({ [UUID]: status('2026-07-31T00:00:00Z') });
    assert.strictEqual(renderCalls.length, 1);
    handleRpcResult({ [UUID]: status('2026-07-31T00:00:01Z') });
    assert.strictEqual(renderCalls.length, 2);
});

// ── Summary ───────────────────────────────────────────────────────

console.log('\n' + '='.repeat(40));
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
    console.log('\nSome tests failed!');
    process.exit(1);
} else {
    console.log('\nAll tests passed!');
}
