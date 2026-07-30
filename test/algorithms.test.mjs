/**
 * algorithms/index.js 单元测试
 * 运行：node test/algorithms.test.mjs
 */

import assert from 'node:assert/strict';
import {
    applyEWMA,
    lttbDownsampleRecords,
    createNullTemplate,
    fillMissingTimePoints,
    interpolateNullsLinear,
    cutPeakValues
} from '../dist/assets/js/algorithms/index.js';

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

function approxEq(a, b, eps = 1e-6) {
    return Math.abs(a - b) < eps;
}

function assertApprox(actual, expected, eps = 1e-6) {
    if (!approxEq(actual, expected, eps)) {
        throw new Error(`Expected ${actual} to approximately equal ${expected} (eps=${eps})`);
    }
}

// ═══════════════════════════════════════
// applyEWMA
// ═══════════════════════════════════════
console.log('\napplyEWMA');

test('空输入返回空数组', () => {
    assert.deepStrictEqual(applyEWMA([], 0.3), []);
    assert.deepStrictEqual(applyEWMA(null, 0.3), []);
});

test('单元素直接返回', () => {
    const result = applyEWMA([10], 0.3);
    assert.strictEqual(result.length, 1);
    assertApprox(result[0], 10);
});

test('alpha=1 时输出等于输入', () => {
    const input = [1, 5, 3, 8, 2];
    const result = applyEWMA(input, 1);
    for (let i = 0; i < input.length; i++) {
        assertApprox(result[i], input[i]);
    }
});

test('alpha=0 时输出全为首个值', () => {
    const result = applyEWMA([1, 5, 3, 8, 2], 0);
    assertApprox(result[0], 1);
    for (let i = 1; i < result.length; i++) {
        assertApprox(result[i], 1);
    }
});

test('标准 alpha=0.3 平滑结果', () => {
    const result = applyEWMA([10, 20, 10, 20, 10], 0.3);
    assertApprox(result[0], 10);    // 10
    assertApprox(result[1], 13);    // 0.3*20 + 0.7*10 = 13
    assertApprox(result[2], 12.1);  // 0.3*10 + 0.7*13 = 12.1
    assertApprox(result[3], 14.47); // 0.3*20 + 0.7*12.1 = 14.47
});

test('null/undefined/NaN 跳过并输出 null', () => {
    const result = applyEWMA([10, null, 20, undefined, NaN, 30], 0.3);
    assert.strictEqual(result[0], 10);
    assert.strictEqual(result[1], null);
    assertApprox(result[2], 13);    // 0.3*20 + 0.7*10 (prevSmoothed stays 10)
    assert.strictEqual(result[3], null);
    assert.strictEqual(result[4], null);
});

// ═══════════════════════════════════════
// lttbDownsampleRecords
// ═══════════════════════════════════════
console.log('\nlttbDownsampleRecords');

const identityExtractor = (r) => r.value;

test('数据量 <= threshold 直接返回原数组', () => {
    const data = [{ value: 1 }, { value: 2 }, { value: 3 }];
    const result = lttbDownsampleRecords(data, 5, identityExtractor);
    assert.strictEqual(result, data); // 同一引用
});

test('threshold < 3 直接返回原数组', () => {
    const data = [{ value: 1 }, { value: 2 }, { value: 3 }];
    assert.strictEqual(lttbDownsampleRecords(data, 2, identityExtractor), data);
    assert.strictEqual(lttbDownsampleRecords(data, 1, identityExtractor), data);
    assert.strictEqual(lttbDownsampleRecords(data, 0, identityExtractor), data);
});

test('空/null 输入安全返回', () => {
    assert.strictEqual(lttbDownsampleRecords(null, 10, identityExtractor), null);
    assert.deepStrictEqual(lttbDownsampleRecords([], 10, identityExtractor), []);
});

test('输出长度等于 threshold', () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ value: Math.sin(i * 0.1) }));
    const result = lttbDownsampleRecords(data, 20, identityExtractor);
    assert.strictEqual(result.length, 20);
});

test('首尾点保留', () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ value: i }));
    const result = lttbDownsampleRecords(data, 10, identityExtractor);
    assert.strictEqual(result[0], data[0]);
    assert.strictEqual(result[result.length - 1], data[data.length - 1]);
});

test('恒定值降采样结果正确', () => {
    const data = Array.from({ length: 50 }, () => ({ value: 42 }));
    const result = lttbDownsampleRecords(data, 10, identityExtractor);
    assert.strictEqual(result.length, 10);
    for (const r of result) {
        assert.strictEqual(r.value, 42);
    }
});

test('NaN 值被跳过不导致崩溃', () => {
    const data = [{ value: 1 }, { value: NaN }, { value: 3 }, { value: 4 }, { value: 5 }, { value: 6 }];
    const result = lttbDownsampleRecords(data, 3, identityExtractor);
    assert.strictEqual(result.length, 3);
});

// ═══════════════════════════════════════
// createNullTemplate
// ═══════════════════════════════════════
console.log('\ncreateNullTemplate');

test('null/undefined 返回 null', () => {
    assert.strictEqual(createNullTemplate(null), null);
    assert.strictEqual(createNullTemplate(undefined), null);
});

test('数字返回 null', () => {
    assert.strictEqual(createNullTemplate(42), null);
});

test('字符串/布尔原样返回', () => {
    assert.strictEqual(createNullTemplate('hello'), 'hello');
    assert.strictEqual(createNullTemplate(true), true);
    assert.strictEqual(createNullTemplate(false), false);
});

test('数组递归处理', () => {
    assert.deepStrictEqual(createNullTemplate([1, 2, 'x']), [null, null, 'x']);
});

test('对象递归处理，数字属性变 null', () => {
    const result = createNullTemplate({ cpu: 50, name: 'test', flag: true });
    assert.strictEqual(result.cpu, null);
    assert.strictEqual(result.name, 'test');
    assert.strictEqual(result.flag, true);
});

test('time/updated_at 字段被跳过', () => {
    const result = createNullTemplate({ time: '2024-01-01', updated_at: '2024-01-01', cpu: 50 });
    assert.strictEqual(result.time, undefined);
    assert.strictEqual(result.updated_at, undefined);
    assert.strictEqual(result.cpu, null);
});

// ═══════════════════════════════════════
// fillMissingTimePoints
// ═══════════════════════════════════════
console.log('\nfillMissingTimePoints');

test('空输入返回空数组', () => {
    assert.deepStrictEqual(fillMissingTimePoints([], 60, 3600), []);
    assert.deepStrictEqual(fillMissingTimePoints(null, 60, 3600), []);
});

test('单点数据生成完整时间序列', () => {
    const baseTime = new Date('2024-01-01T00:00:00Z');
    const data = [{ time: baseTime.toISOString(), cpu: 50 }];
    // 1小时范围，60秒间隔 → 60个点（0-59分钟）
    const result = fillMissingTimePoints(data, 60, 3600);
    assert.ok(result.length > 0);
    // 最后一个点应该匹配原始数据
    const lastTime = new Date(result[result.length - 1].time).getTime();
    assert.strictEqual(lastTime, baseTime.getTime());
});

test('填充的 null 点使用 nullTemplate', () => {
    const baseTime = new Date('2024-01-01T01:00:00Z');
    const data = [{ time: baseTime.toISOString(), cpu: 50, ram: 80 }];
    const result = fillMissingTimePoints(data, 60, 3600);
    // 第一个点没有匹配数据，cpu 应为 null（nullTemplate）
    const firstPoint = result[0];
    assert.strictEqual(firstPoint.cpu, null);
    assert.strictEqual(firstPoint.ram, null);
});

test('已有数据点被正确匹配', () => {
    // 生成 10 分钟均匀数据，间隔 60 秒
    const base = new Date('2024-01-01T00:00:00Z').getTime();
    const data = [];
    for (let i = 0; i < 10; i++) {
        data.push({ time: new Date(base + i * 60000).toISOString(), cpu: i * 10 });
    }
    const result = fillMissingTimePoints(data, 60, 600); // 10分钟范围
    assert.ok(result.length >= 10, `应有>=10个时间点，实际: ${result.length}`);
    // 非null点应来自原始数据
    const nonNull = result.filter(r => r.cpu !== null);
    assert.ok(nonNull.length >= 2, `至少2个非null点，实际: ${nonNull.length}`);
    // 非null点的cpu值应全在原始数据范围内
    for (const r of nonNull) {
        assert.ok(r.cpu >= 0 && r.cpu <= 90, `cpu=${r.cpu} 超出范围 [0, 90]`);
    }
});

// ═══════════════════════════════════════
// interpolateNullsLinear
// ═══════════════════════════════════════
console.log('\ninterpolateNullsLinear');

test('空输入安全返回', () => {
    assert.deepStrictEqual(interpolateNullsLinear([], ['cpu']), []);
    assert.deepStrictEqual(interpolateNullsLinear(null, ['cpu']), null);
    assert.deepStrictEqual(interpolateNullsLinear([{ cpu: 1 }], []), [{ cpu: 1 }]);
});

test('中间 null 值被线性插值填充', () => {
    const rows = [
        { time: '2024-01-01T00:00:00Z', cpu: 10 },
        { time: '2024-01-01T00:01:00Z', cpu: null },
        { time: '2024-01-01T00:02:00Z', cpu: 20 }
    ];
    const result = interpolateNullsLinear(rows, ['cpu'], { maxGapMs: 180000 });
    assertApprox(result[1].cpu, 15); // 线性插值 10 → 20
});

test('不修改原始数组', () => {
    const rows = [
        { time: '2024-01-01T00:00:00Z', cpu: 10 },
        { time: '2024-01-01T00:01:00Z', cpu: null },
        { time: '2024-01-01T00:02:00Z', cpu: 20 }
    ];
    interpolateNullsLinear(rows, ['cpu'], { maxGapMs: 180000 });
    assert.strictEqual(rows[1].cpu, null); // 原数组不变
});

test('超过 maxGapMs 的间隔不插值', () => {
    const rows = [
        { time: '2024-01-01T00:00:00Z', cpu: 10 },
        { time: '2024-01-01T00:01:00Z', cpu: null },
        { time: '2024-01-01T01:00:00Z', cpu: 20 } // 1小时间隔
    ];
    const result = interpolateNullsLinear(rows, ['cpu'], { maxGapMs: 60000 }); // maxGap 1分钟
    assert.strictEqual(result[1].cpu, null); // 间隔太大，不插值
});

test('多个 key 同时插值', () => {
    const rows = [
        { time: '2024-01-01T00:00:00Z', cpu: 10, ram: 40 },
        { time: '2024-01-01T00:01:00Z', cpu: null, ram: null },
        { time: '2024-01-01T00:02:00Z', cpu: 20, ram: 60 }
    ];
    const result = interpolateNullsLinear(rows, ['cpu', 'ram'], { maxGapMs: 180000 });
    assertApprox(result[1].cpu, 15);
    assertApprox(result[1].ram, 50);
});

// ═══════════════════════════════════════
// cutPeakValues
// ═══════════════════════════════════════
console.log('\ncutPeakValues');

test('空输入安全返回', () => {
    assert.deepStrictEqual(cutPeakValues([], ['cpu']), []);
    assert.deepStrictEqual(cutPeakValues(null, ['cpu']), null);
});

test('平滑数据不改变趋势方向', () => {
    const data = [
        { cpu: 10 }, { cpu: 12 }, { cpu: 14 },
        { cpu: 16 }, { cpu: 18 }, { cpu: 20 }
    ];
    const result = cutPeakValues(data, ['cpu'], 0.3, 15, 0.3);
    // 平滑后应该大致保持递增趋势
    assert.ok(result[result.length - 1].cpu >= result[0].cpu);
});

test('突变尖峰被抑制', () => {
    const data = [
        { cpu: 10 }, { cpu: 10 }, { cpu: 10 }, { cpu: 10 }, { cpu: 10 },
        { cpu: 100 }, // 尖峰
        { cpu: 10 }, { cpu: 10 }, { cpu: 10 }, { cpu: 10 }, { cpu: 10 }
    ];
    const result = cutPeakValues(data, ['cpu'], 0.1, 5, 0.3);
    // 尖峰处的值应被抑制（设为 null 后由 EWMA 填充）
    assert.ok(result[5].cpu < 100, `尖峰应被抑制，实际值: ${result[5].cpu}`);
});

test('不修改原始数组', () => {
    const data = [{ cpu: 10 }, { cpu: 100 }, { cpu: 10 }];
    const originalCpu = data.map(d => d.cpu);
    cutPeakValues(data, ['cpu'], 0.3, 15, 0.3);
    assert.deepStrictEqual(data.map(d => d.cpu), originalCpu);
});

// ═══════════════════════════════════════
// 结果汇总
// ═══════════════════════════════════════
console.log(`\n────────────────────────────`);
console.log(`结果: ${passed} 通过, ${failed} 失败`);
if (failed > 0) {
    console.log('❌ 有测试失败');
    process.exit(1);
} else {
    console.log('✅ 全部通过');
}
