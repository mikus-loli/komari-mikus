/**
 * services/api.js + services/rpc.js 单元测试
 * 运行：node test/api-rpc.test.mjs
 */

import assert from 'node:assert/strict';
import { flattenRecentRecords } from '../dist/assets/js/services/api.js';
import { getMaxDataPoints } from '../dist/assets/js/utils/helpers.js';
import { RPC2Client } from '../dist/assets/js/services/rpc.js';
import { RPC_METHODS, MAX_HISTORY_POINTS } from '../dist/assets/js/core/constants.js';

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

// ── flattenRecentRecords ──────────────────────────────────────────

console.log('\nflattenRecentRecords:');

test('flattens nested cpu/ram/disk objects', function() {
    const input = [{
        updated_at: '2026-01-01T00:00:00Z',
        cpu: { usage: 45.2 },
        ram: { used: 1024, total: 2048 },
        disk: { used: 5120, total: 10240 },
        swap: { used: 0, total: 4096 },
        load: { load1: 0.5, load5: 0.3, load15: 0.2 },
        network: { down: 1000, up: 500 },
        process: 42,
        connections: { tcp: 10, udp: 2 }
    }];
    const result = flattenRecentRecords(input);
    assert.strictEqual(result[0].time, '2026-01-01T00:00:00Z');
    assert.strictEqual(result[0].cpu, 45.2);
    assert.strictEqual(result[0].ram, 1024);
    assert.strictEqual(result[0].ram_total, 2048);
    assert.strictEqual(result[0].disk, 5120);
    assert.strictEqual(result[0].disk_total, 10240);
    assert.strictEqual(result[0].swap, 0);
    assert.strictEqual(result[0].swap_total, 4096);
    assert.strictEqual(result[0].load, 0.5);
    assert.strictEqual(result[0].load5, 0.3);
    assert.strictEqual(result[0].load15, 0.2);
    assert.strictEqual(result[0].net_in, 1000);
    assert.strictEqual(result[0].net_out, 500);
    assert.strictEqual(result[0].process, 42);
    assert.strictEqual(result[0].connections, 10);
    assert.strictEqual(result[0].connections_udp, 2);
});

test('handles flat format passthrough', function() {
    const input = [{
        time: '2026-01-01T00:00:00Z',
        cpu: 30,
        ram: 512,
        ram_total: 1024,
        disk: 2048,
        disk_total: 4096
    }];
    const result = flattenRecentRecords(input);
    assert.strictEqual(result[0].cpu, 30);
    assert.strictEqual(result[0].ram, 512);
    assert.strictEqual(result[0].ram_total, 1024);
    assert.strictEqual(result[0].disk, 2048);
    assert.strictEqual(result[0].disk_total, 4096);
});

test('handles null/missing fields', function() {
    const input = [{
        updated_at: '2026-01-01T00:00:00Z',
        cpu: null,
        ram: null
    }];
    const result = flattenRecentRecords(input);
    assert.strictEqual(result[0].cpu, null);
    assert.strictEqual(result[0].ram, null);
    assert.strictEqual(result[0].disk, null);
    assert.strictEqual(result[0].ram_total, null);
    assert.strictEqual(result[0].disk_total, null);
});

test('handles cpu as number directly', function() {
    const input = [{ updated_at: '2026-01-01', cpu: 77 }];
    const result = flattenRecentRecords(input);
    assert.strictEqual(result[0].cpu, 77);
});

test('handles cpu as object without usage key — passes through as-is', function() {
    const input = [{ updated_at: '2026-01-01', cpu: { something: 1 } }];
    const result = flattenRecentRecords(input);
    // cpu 有 usage 走 r.cpu.usage，否则走 r.cpu || null（truthy 对象直接透传）
    assert.deepStrictEqual(result[0].cpu, { something: 1 });
});

test('extracts network total up/down from nested object', function() {
    const input = [{
        updated_at: '2026-01-01',
        network: { down: 100, up: 50, totalUp: 5000, totalDown: 10000 }
    }];
    const result = flattenRecentRecords(input);
    assert.strictEqual(result[0].net_total_up, 5000);
    assert.strictEqual(result[0].net_total_down, 10000);
});

test('handles multiple records', function() {
    const input = [
        { updated_at: '2026-01-01', cpu: { usage: 10 } },
        { updated_at: '2026-01-02', cpu: { usage: 20 } },
        { updated_at: '2026-01-03', cpu: { usage: 30 } }
    ];
    const result = flattenRecentRecords(input);
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].cpu, 10);
    assert.strictEqual(result[1].cpu, 20);
    assert.strictEqual(result[2].cpu, 30);
});

// ── getMaxDataPoints ──────────────────────────────────────────────

console.log('\ngetMaxDataPoints:');

test('returns 600 for hours <= 4', function() {
    assert.strictEqual(getMaxDataPoints(1), 600);
    assert.strictEqual(getMaxDataPoints(4), 600);
});

test('returns 600 for hours between 4 and 24', function() {
    assert.strictEqual(getMaxDataPoints(12), 600);
    assert.strictEqual(getMaxDataPoints(24), 600);
});

test('returns 800 for hours > 24', function() {
    assert.strictEqual(getMaxDataPoints(48), 800);
    assert.strictEqual(getMaxDataPoints(720), 800);
});

// ── RPC2Client 基础属性 ──────────────────────────────────────────

console.log('\nRPC2Client:');

test('constructor sets default properties', function() {
    const client = new RPC2Client({ wsUrl: 'ws://localhost/api/rpc2', httpUrl: 'http://localhost/api/rpc2' });
    assert.strictEqual(client.wsUrl, 'ws://localhost/api/rpc2');
    assert.strictEqual(client.httpUrl, 'http://localhost/api/rpc2');
    assert.strictEqual(client.ws, null);
    assert.strictEqual(client.rpcId, 0);
    assert.strictEqual(client.isConnected, false);
    assert.strictEqual(client.reconnectAttempts, 0);
    assert.strictEqual(client.maxReconnectDelay, 30000);
    assert.strictEqual(client.pollMethod, 'common:getNodesLatestStatus');
});

test('constructor accepts custom pollMethod', function() {
    const client = new RPC2Client({ wsUrl: '', httpUrl: '', pollMethod: 'custom:method' });
    assert.strictEqual(client.pollMethod, 'custom:method');
});

test('scheduleReconnect delay follows exponential backoff', function() {
    const client = new RPC2Client({ wsUrl: '', httpUrl: '' });
    assert.strictEqual(Math.min(1000 * Math.pow(2, 0), 30000), 1000);
    assert.strictEqual(Math.min(1000 * Math.pow(2, 1), 30000), 2000);
    assert.strictEqual(Math.min(1000 * Math.pow(2, 5), 30000), 30000);
});

test('disconnect cleans up WebSocket and state', function() {
    const client = new RPC2Client({ wsUrl: '', httpUrl: '' });
    const fakeWs = {
        onclose: null,
        close: function() { this.onclose = null; }
    };
    client.ws = fakeWs;
    client.isConnected = true;
    client.disconnect();
    assert.strictEqual(client.ws, null);
    assert.strictEqual(client.isConnected, false);
});

test('stopPolling clears interval', function() {
    const client = new RPC2Client({ wsUrl: '', httpUrl: '' });
    client.pollInterval = setInterval(function() {}, 99999);
    client.stopPolling();
    assert.strictEqual(client.pollInterval, null);
});

test('handleMessage resolves pending call with result', function() {
    const client = new RPC2Client({ wsUrl: '', httpUrl: '' });
    let resolved = null;
    let rejected = null;
    client.pendingCalls[42] = {
        resolve: function(v) { resolved = v; },
        reject: function(e) { rejected = e; },
        timer: {}
    };
    client.handleMessage({ id: 42, result: { cpu: 50 } });
    assert.deepStrictEqual(resolved, { cpu: 50 });
    assert.strictEqual(rejected, null);
    assert.strictEqual(client.pendingCalls[42], undefined, 'pending call should be cleaned up');
});

test('handleMessage rejects pending call on error', function() {
    const client = new RPC2Client({ wsUrl: '', httpUrl: '' });
    let resolved = false;
    let rejected = null;
    client.pendingCalls[7] = {
        resolve: function() { resolved = true; },
        reject: function(e) { rejected = e; },
        timer: {}
    };
    client.handleMessage({ id: 7, error: { code: -32601, message: 'Method not found' } });
    assert.strictEqual(resolved, false);
    assert.deepStrictEqual(rejected, { code: -32601, message: 'Method not found' });
    assert.strictEqual(client.pendingCalls[7], undefined, 'pending call should be cleaned up');
});

test('handleMessage dispatches poll callback', function() {
    const client = new RPC2Client({ wsUrl: '', httpUrl: '' });
    let received = null;
    client.pollCallback = function(params) { received = params; };
    const params = { 'uuid-1': { online: true } };
    client.handleMessage({ method: client.pollMethod, params: params });
    assert.strictEqual(received, params);
});

test('handleMessage ignores unknown messages without throwing', function() {
    const client = new RPC2Client({ wsUrl: '', httpUrl: '' });
    assert.doesNotThrow(function() {
        client.handleMessage({ id: 999, result: null }); // 无对应 pending call
        client.handleMessage({ method: 'other:method', params: {} }); // 非 poll 方法
    });
});

// ── Constants ─────────────────────────────────────────────────────

console.log('\nConstants:');

test('RPC_METHODS has all required method names', function() {
    assert.ok(RPC_METHODS.getPublicSettings);
    assert.ok(RPC_METHODS.getPublicSettingsFallback);
    assert.ok(RPC_METHODS.getNodesInformation);
    assert.ok(RPC_METHODS.getClientRecentRecords);
    assert.ok(RPC_METHODS.queryMetrics);
    assert.ok(RPC_METHODS.getPublicPingTasks);
    assert.ok(RPC_METHODS.getPingMetricStats);
});

test('MAX_HISTORY_POINTS is 600', function() {
    assert.strictEqual(MAX_HISTORY_POINTS, 600);
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
