/**
 * UI 渲染层纯函数测试
 * 运行：node test/ui.test.mjs
 * 覆盖：charts/tooltip.js 的定位与时间格式化、nodes.js 的指标计算
 */

import assert from 'node:assert/strict';
import { formatTooltipTime, positionTooltip } from '../dist/assets/js/ui/charts/tooltip.js';
import { calculateNodeMetrics } from '../dist/assets/js/ui/nodes.js';
import { renderGrid, updateGridRealtime } from '../dist/assets/js/ui/nodes-grid.js';
import { renderTable, updateTableRealtime } from '../dist/assets/js/ui/nodes-table.js';
import { state } from '../dist/assets/js/core/state.js';

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

// ── formatTooltipTime ─────────────────────────────────────────────

console.log('\nformatTooltipTime:');

test('hours <= 4 显示 时:分:秒', function() {
    const t = new Date(2026, 6, 31, 14, 5, 9);
    assert.strictEqual(formatTooltipTime(t, 1), '14:05:09');
    assert.strictEqual(formatTooltipTime(t, 4), '14:05:09');
});

test('4 < hours <= 24 显示 时:分', function() {
    const t = new Date(2026, 6, 31, 9, 30, 0);
    assert.strictEqual(formatTooltipTime(t, 24), '09:30');
});

test('hours > 24 显示 月-日 时:分', function() {
    const t = new Date(2026, 6, 31, 23, 59, 59);
    assert.strictEqual(formatTooltipTime(t, 168), '07-31 23:59');
});

test('边界值 hours=4 走秒分支，hours=24 走分分支', function() {
    const t = new Date(2026, 0, 1, 0, 0, 0);
    assert.strictEqual(formatTooltipTime(t, 4), '00:00:00');
    assert.strictEqual(formatTooltipTime(t, 24), '00:00');
});

// ── positionTooltip ───────────────────────────────────────────────

console.log('\npositionTooltip:');

function mockTooltip(width, height) {
    const added = [];
    return {
        style: {},
        getBoundingClientRect: function() { return { width: width, height: height }; },
        classList: { add: function(c) { added.push(c); } },
        _added: added
    };
}

test('鼠标在右侧时 tooltip 放左上方', function() {
    const tip = mockTooltip(140, 60);
    positionTooltip(tip, { clientX: 500, clientY: 400 });
    // 500 - 140 - 16 = 344, 400 - 60 - 12 = 328
    assert.strictEqual(tip.style.left, '344px');
    assert.strictEqual(tip.style.top, '328px');
});

test('鼠标在左侧空间不足时翻转到右侧', function() {
    const tip = mockTooltip(140, 60);
    positionTooltip(tip, { clientX: 50, clientY: 400 });
    // 50 - 140 - 16 = -106 < 10 → 翻转 50 + 16 = 66
    assert.strictEqual(tip.style.left, '66px');
    assert.strictEqual(tip.style.top, '328px');
});

test('鼠标在顶部空间不足时翻转到下方', function() {
    const tip = mockTooltip(140, 60);
    positionTooltip(tip, { clientX: 500, clientY: 30 });
    // 30 - 60 - 12 = -42 < 10 → 翻转 30 + 16 = 46
    assert.strictEqual(tip.style.left, '344px');
    assert.strictEqual(tip.style.top, '46px');
});

test('getBoundingClientRect 返回 0 时使用默认尺寸', function() {
    const tip = mockTooltip(0, 0);
    positionTooltip(tip, { clientX: 500, clientY: 400 });
    // 默认 width=140, height=60 → 同场景1
    assert.strictEqual(tip.style.left, '344px');
    assert.strictEqual(tip.style.top, '328px');
});

test('定位后添加 visible class', function() {
    const tip = mockTooltip(140, 60);
    positionTooltip(tip, { clientX: 500, clientY: 400 });
    assert.ok(tip._added.indexOf('visible') !== -1);
});

// ── calculateNodeMetrics ──────────────────────────────────────────

console.log('\ncalculateNodeMetrics:');

const UUID = 'metrics-test-node';

function makeNode(overrides) {
    return Object.assign({
        uuid: UUID,
        mem_total: 2048,
        disk_total: 10240,
        swap_total: 0,
        region: '中国',
        os: 'Debian 12',
        traffic_limit: 0,
        traffic_limit_type: 'max'
    }, overrides || {});
}

function setRealtime(rt) {
    state.realtimeData[UUID] = rt;
}

function resetState() {
    state.realtimeData = {};
    state.onlineNodes = [];
    state.pingData = {};
}

test('基本指标计算：CPU/RAM/Disk 百分比与级别', function() {
    resetState();
    state.onlineNodes = [UUID];
    setRealtime({
        cpu: { usage: 50 },
        ram: { used: 1024, total: 2048 },
        disk: { used: 5120, total: 10240 },
        load: { load1: 0.5 },
        uptime: 3600
    });
    const m = calculateNodeMetrics(makeNode());
    assert.strictEqual(m.cpuUsage, 50);
    assert.strictEqual(m.cpuLevel, 'normal');
    assert.strictEqual(m.ramPercent, 50);
    assert.strictEqual(m.ramLevel, 'normal');
    assert.strictEqual(m.diskPercent, 50);
    assert.strictEqual(m.diskLevel, 'normal');
    assert.strictEqual(m.uptime, 3600);
    assert.strictEqual(m.isOnline, true);
});

test('CPU >= 85% 标记为 danger', function() {
    resetState();
    state.onlineNodes = [UUID];
    setRealtime({ cpu: { usage: 90 }, ram: { used: 0, total: 2048 }, disk: { used: 0, total: 10240 } });
    const m = calculateNodeMetrics(makeNode());
    assert.strictEqual(m.cpuLevel, 'danger');
});

test('CPU 60-85% 标记为 warning', function() {
    resetState();
    state.onlineNodes = [UUID];
    setRealtime({ cpu: { usage: 70 }, ram: { used: 0, total: 2048 }, disk: { used: 0, total: 10240 } });
    const m = calculateNodeMetrics(makeNode());
    assert.strictEqual(m.cpuLevel, 'warning');
});

test('离线节点 isOnline=false', function() {
    resetState();
    state.onlineNodes = [];
    setRealtime({});
    const m = calculateNodeMetrics(makeNode());
    assert.strictEqual(m.isOnline, false);
});

test('realtimeData 缺失时安全返回默认值', function() {
    resetState();
    state.onlineNodes = [];
    const m = calculateNodeMetrics(makeNode());
    assert.strictEqual(m.cpuUsage, null);
    assert.strictEqual(m.cpuLevel, 'normal');
    assert.strictEqual(m.ramPercent, null);
    assert.strictEqual(m.diskPercent, null);
    assert.strictEqual(m.netUp, 0);
    assert.strictEqual(m.netDown, 0);
    assert.strictEqual(m.uptime, 0);
});

test('RAM 百分比正确计算', function() {
    resetState();
    state.onlineNodes = [UUID];
    setRealtime({ ram: { used: 512, total: 4096 } });
    const m = calculateNodeMetrics(makeNode({ mem_total: 2048 }));
    assert.strictEqual(m.ramPercent, 12.5); // 512/4096*100，rt.ram.total 优先于 mem_total
});

test('rt.ram 存在但 total 缺失时回退到 node.mem_total', function() {
    resetState();
    state.onlineNodes = [UUID];
    setRealtime({ ram: { used: 512 } }); // 有 used 无 total
    const m = calculateNodeMetrics(makeNode({ mem_total: 4096 }));
    assert.strictEqual(m.ramPercent, 12.5); // 回退到 4096 → 512/4096*100
});

test('rt.disk 存在但 total 缺失时回退到 node.disk_total', function() {
    resetState();
    state.onlineNodes = [UUID];
    setRealtime({ disk: { used: 2048 } }); // 有 used 无 total
    const m = calculateNodeMetrics(makeNode({ disk_total: 8192 }));
    assert.strictEqual(m.diskPercent, 25); // 回退到 8192 → 2048/8192*100
});

test('rt.swap 存在但 total 缺失时回退到 node.swap_total', function() {
    resetState();
    state.onlineNodes = [UUID];
    setRealtime({ swap: { used: 256 } }); // 有 used 无 total
    const m = calculateNodeMetrics(makeNode({ swap_total: 1024 }));
    assert.strictEqual(m.swapPercent, 25); // 回退到 1024 → 256/1024*100
    assert.strictEqual(m.swapTotal, 1024);
});

// ── calculateNodeMetrics: traffic_limit_type 分支 ─────────────────

test('traffic_limit_type=sum 累加上下行', function() {
    resetState();
    state.onlineNodes = [UUID];
    setRealtime({ network: { totalUp: 500, totalDown: 800 } });
    const m = calculateNodeMetrics(makeNode({ traffic_limit: 2000, traffic_limit_type: 'sum' }));
    assert.strictEqual(m.usedTraffic, 1300);
    assert.strictEqual(m.remainingTraffic, 700); // 2000 - 1300
});

test('traffic_limit_type=up 仅用上行', function() {
    resetState();
    state.onlineNodes = [UUID];
    setRealtime({ network: { totalUp: 500, totalDown: 800 } });
    const m = calculateNodeMetrics(makeNode({ traffic_limit: 2000, traffic_limit_type: 'up' }));
    assert.strictEqual(m.usedTraffic, 500);
    assert.strictEqual(m.remainingTraffic, 1500);
});

test('traffic_limit_type=down 仅用下行', function() {
    resetState();
    state.onlineNodes = [UUID];
    setRealtime({ network: { totalUp: 500, totalDown: 800 } });
    const m = calculateNodeMetrics(makeNode({ traffic_limit: 2000, traffic_limit_type: 'down' }));
    assert.strictEqual(m.usedTraffic, 800);
});

test('traffic_limit_type=min 取较小值', function() {
    resetState();
    state.onlineNodes = [UUID];
    setRealtime({ network: { totalUp: 500, totalDown: 800 } });
    const m = calculateNodeMetrics(makeNode({ traffic_limit: 2000, traffic_limit_type: 'min' }));
    assert.strictEqual(m.usedTraffic, 500);
});

test('traffic_limit_type=max（默认）取较大值', function() {
    resetState();
    state.onlineNodes = [UUID];
    setRealtime({ network: { totalUp: 500, totalDown: 800 } });
    const m = calculateNodeMetrics(makeNode({ traffic_limit: 2000, traffic_limit_type: 'max' }));
    assert.strictEqual(m.usedTraffic, 800);
});

test('traffic_limit_type=unknown 走 default 取较大值', function() {
    resetState();
    state.onlineNodes = [UUID];
    setRealtime({ network: { totalUp: 500, totalDown: 800 } });
    const m = calculateNodeMetrics(makeNode({ traffic_limit: 2000, traffic_limit_type: 'unknown' }));
    assert.strictEqual(m.usedTraffic, 800);
});

test('用量超限时 remainingTraffic 不为负', function() {
    resetState();
    state.onlineNodes = [UUID];
    setRealtime({ network: { totalUp: 1500, totalDown: 1500 } });
    const m = calculateNodeMetrics(makeNode({ traffic_limit: 1000, traffic_limit_type: 'sum' }));
    assert.strictEqual(m.usedTraffic, 3000);
    assert.strictEqual(m.remainingTraffic, 0); // max(0, 1000-3000)
});

test('traffic_limit=0 时不计算流量', function() {
    resetState();
    state.onlineNodes = [UUID];
    setRealtime({ network: { totalUp: 500, totalDown: 800 } });
    const m = calculateNodeMetrics(makeNode({ traffic_limit: 0 }));
    assert.strictEqual(m.usedTraffic, 0);
    assert.strictEqual(m.remainingTraffic, 0);
});

// ── 网格/表格实时增量更新 DOM 回归 ─────────────────────────────────

function stripTags(html) {
    return String(html).replace(/<[^>]*>/g, '');
}

class MockElement {
    constructor(className, attributes) {
        this.className = className || '';
        this.classes = new Set(this.className.split(/\s+/).filter(Boolean));
        this.attributes = attributes || {};
        this.children = [];
        this._innerHTML = '';
        this.textContent = '';
        this.classList = {
            toggle: (classNameToToggle, force) => {
                if (force) {
                    this.classes.add(classNameToToggle);
                } else {
                    this.classes.delete(classNameToToggle);
                }
            }
        };
    }

    set innerHTML(value) {
        this._innerHTML = String(value);

        if (this.classes.has('nodes-grid') || this.classes.has('table-body')) {
            const cardClass = this.classes.has('nodes-grid') ? 'node-card' : 'table-card';
            const metricsClass = this.classes.has('nodes-grid') ? 'node-card-metrics' : 'table-card-metrics';
            const statusClass = this.classes.has('nodes-grid') ? 'node-status-dot' : 'table-card-status';
            const cardPattern = new RegExp('<div class="([^" ]*(?:' + cardClass + ')[^"]*)" data-uuid="([^"]+)">', 'g');

            this.children = Array.from(this._innerHTML.matchAll(cardPattern), (match) => {
                const card = new MockElement(match[1], { 'data-uuid': match[2] });
                const metrics = new MockElement(metricsClass);
                metrics.innerHTML = this._innerHTML;
                const status = new MockElement(statusClass);
                card.children = [metrics, status];

                if (cardClass === 'node-card') {
                    card.children.splice(1, 0, new MockElement('node-card-footer'));
                }

                return card;
            });
            return;
        }

        this.textContent = stripTags(this._innerHTML);

        if (this.classes.has('node-card-footer')) {
            this.children = this._innerHTML.indexOf('<div class="node-card-footer">') !== -1
                ? [new MockElement('node-card-footer')]
                : [];
        }
    }

    get innerHTML() {
        return this._innerHTML;
    }

    getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attributes, name)
            ? this.attributes[name]
            : null;
    }

    addEventListener() {}

    matches(selector) {
        const classes = Array.from(selector.matchAll(/\.([\w-]+)/g), (match) => match[1]);
        if (!classes.every((className) => this.classes.has(className))) return false;
        return !selector.includes('[data-uuid]') || this.getAttribute('data-uuid') !== null;
    }

    querySelectorAll(selector) {
        const matches = [];
        const visit = (element) => {
            if (element.matches(selector)) matches.push(element);
            element.children.forEach(visit);
        };
        visit(this);
        return matches;
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }
}

test('初次渲染和一次增量更新保持卡片结构并更新网格/表格指标', function() {
    const previousDocument = globalThis.document;
    const previousState = {
        nodes: state.nodes,
        realtimeData: state.realtimeData,
        onlineNodes: state.onlineNodes,
        themeSettings: state.themeSettings,
        currentGroup: state.currentGroup,
        searchQuery: state.searchQuery,
        initialRender: state.initialRender
    };

    const nodeA = 'dom-regression-node-a';
    const nodeB = 'dom-regression-node-b';
    const nodes = [
        makeNode({ uuid: nodeA, name: 'DOM Node A', weight: 1 }),
        makeNode({ uuid: nodeB, name: 'DOM Node B', weight: 2 })
    ];
    const grid = new MockElement('nodes-grid');
    const table = new MockElement('table-body');

    globalThis.document = {
        getElementById: function(id) {
            if (id === 'nodesGrid') return grid;
            if (id === 'nodesTableBody') return table;
            return null;
        }
    };

    try {
        state.nodes = nodes;
        state.onlineNodes = [nodeA, nodeB];
        state.currentGroup = 'all';
        state.searchQuery = '';
        state.themeSettings = {};
        state.initialRender = true;
        state.realtimeData = {
            [nodeA]: { cpu: { usage: 20 }, ram: { used: 512, total: 2048 }, disk: { used: 1024, total: 10240 } },
            [nodeB]: { cpu: { usage: 40 }, ram: { used: 512, total: 2048 }, disk: { used: 1024, total: 10240 } }
        };

        renderGrid();
        renderTable();

        const gridBefore = new Map(grid.querySelectorAll('.node-card').map(function(card) {
            return [card.getAttribute('data-uuid'), card];
        }));
        const tableBefore = new Map(table.querySelectorAll('.table-card').map(function(card) {
            return [card.getAttribute('data-uuid'), card];
        }));

        assert.strictEqual(gridBefore.size, 2);
        gridBefore.forEach(function(card) {
            assert.strictEqual(card.querySelectorAll('.node-card-footer').length, 1);
        });
        assert.strictEqual(tableBefore.size, 2);
        tableBefore.forEach(function(card) {
            assert.strictEqual(card.querySelectorAll('.table-card-metrics').length, 1);
        });

        state.realtimeData = {
            [nodeA]: { cpu: { usage: 80 }, ram: { used: 1024, total: 2048 }, disk: { used: 2048, total: 10240 } },
            [nodeB]: { cpu: { usage: 60 }, ram: { used: 1024, total: 2048 }, disk: { used: 2048, total: 10240 } }
        };

        updateGridRealtime();
        updateTableRealtime();

        const expectedCpu = { [nodeA]: '80', [nodeB]: '60' };
        grid.querySelectorAll('.node-card').forEach(function(card) {
            const uuid = card.getAttribute('data-uuid');
            assert.strictEqual(card, gridBefore.get(uuid));
            assert.strictEqual(card.querySelectorAll('.node-card-footer').length, 1);
            assert.match(card.querySelector('.node-card-metrics').textContent, new RegExp(expectedCpu[uuid]));
        });
        table.querySelectorAll('.table-card').forEach(function(card) {
            const uuid = card.getAttribute('data-uuid');
            assert.strictEqual(card, tableBefore.get(uuid));
            assert.strictEqual(card.querySelectorAll('.table-card-metrics').length, 1);
            assert.match(card.querySelector('.table-card-metrics').textContent, new RegExp(expectedCpu[uuid]));
        });
    } finally {
        state.nodes = previousState.nodes;
        state.realtimeData = previousState.realtimeData;
        state.onlineNodes = previousState.onlineNodes;
        state.themeSettings = previousState.themeSettings;
        state.currentGroup = previousState.currentGroup;
        state.searchQuery = previousState.searchQuery;
        state.initialRender = previousState.initialRender;

        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
    }
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
