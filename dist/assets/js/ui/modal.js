/**
 * @module ui/modal
 * @description 模态框管理（打开/关闭/切换 Tab/图表观察器/拖拽滚动/概览页/延迟页渲染）
 * @dependencies core/state.js, core/constants.js, i18n/index.js, utils/format.js, utils/time.js, utils/helpers.js, services/api.js, ui/charts.js
 * @exports openNodeModal, closeModal, switchModalPage, initChartObserver, renderOverviewPage, renderLatencyPage, getModalElements, updateTimeRangeButtons, initModalDragScroll
 * @source app.js L2509-L2876, L4555-L4730
 */

import { state } from '../core/state.js';
import { PING_COLORS } from '../core/constants.js';
import { t } from '../i18n/index.js';
import { formatBytes, formatUptime, formatPing } from '../utils/format.js';
import { timeRangeToHours } from '../utils/time.js';
import { escapeHtml, getPingLevel, getTaskLatestPing } from '../utils/helpers.js';
import { loadNodeHistory, loadPingHistory } from '../services/api.js';
import { drawCharts, drawLatencyChart, renderChartByConfig, getChartConfigs, drawLineChart, drawNetworkChart } from './charts.js';

/**
 * 获取模态框元素引用（带缓存）
 * @returns {Object} 模态框元素对象
 */
export function getModalElements() {
    if (!state.modalElements) {
        state.modalElements = {
            overlay: document.getElementById('modalOverlay'),
            modal: document.getElementById('nodeModal'),
            scrollIndicator: document.getElementById('modalScrollIndicator'),
            nodeName: document.getElementById('modalNodeName'),
            modalInfo: document.getElementById('modalInfo'),
            latencySummary: document.getElementById('latencySummary'),
            latencyTasks: document.getElementById('latencyTasks'),
            latencyLegend: document.getElementById('latencyLegend'),
            cpuChart: document.getElementById('cpuChart'),
            ramChart: document.getElementById('ramChart'),
            networkChart: document.getElementById('networkChart'),
            diskChart: document.getElementById('diskChart'),
            processChart: document.getElementById('processChart'),
            connectionsChart: document.getElementById('connectionsChart'),
            latencyChart: document.getElementById('latencyChart')
        };
    }
    return state.modalElements;
}

/**
 * 初始化图表懒加载观察器
 * 使用 IntersectionObserver 在 canvas 可见时才渲染图表
 */
export function initChartObserver() {
    if (state.chartObserver) return;

    state.chartObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var canvas = entry.target;
                var chartId = canvas.id;
                var uuid = state.selectedNodeUuid;

                if (uuid && !state.chartsDrawn[uuid + '_' + chartId]) {
                    canvas.classList.remove('chart-loading');
                    if (chartId === 'latencyChart') {
                        var pingInfo = state.pingData[uuid];
                        if (pingInfo) {
                            drawLatencyChart('latencyChart', pingInfo.records, pingInfo.tasks);
                            state.chartsDrawn[uuid + '_' + chartId] = true;
                            var latencyContainer = document.querySelector('.latency-chart-container');
                            if (latencyContainer) latencyContainer.classList.remove('loading');
                        }
                    } else {
                        var dataHours = state.historyDataHours[uuid] !== undefined
                            ? state.historyDataHours[uuid]
                            : timeRangeToHours(state.historyTimeRange);
                        // 实时模式使用 realtimeHistory，历史模式使用 historyData
                        var records;
                        if (dataHours === 0) {
                            records = state.realtimeHistory[uuid] || [];
                        } else {
                            records = state.historyData[uuid] || [];
                        }
                        if (records.length > 0) {
                            var node = state.nodes.find(function(n) { return n.uuid === uuid; });
                            var liveData = state.realtimeData[uuid];
                            var chartConfigs = getChartConfigs(node, liveData);
                            var config = chartConfigs.find(function(c) { return c.canvasId === chartId; });
                            if (config) {
                                renderChartByConfig(config, records, dataHours);
                            } else {
                                if (chartId === 'cpuChart') {
                                    drawLineChart('cpuChart', records, function (r) { return r.cpu; }, 0, 100, '#e8668a', 'CPU %', dataHours);
                                } else if (chartId === 'ramChart') {
                                    drawLineChart('ramChart', records, function (r) {
                                        var ramVal = r.ram;
                                        if (ramVal === null || ramVal === undefined) return null;
                                        if (ramVal > 100 && r.ram_total > 0) {
                                            return (ramVal / r.ram_total) * 100;
                                        }
                                        return ramVal;
                                    }, 0, 100, '#5c9ced', 'RAM %', dataHours);
                                } else if (chartId === 'networkChart') {
                                    drawNetworkChart('networkChart', records, dataHours);
                                }
                            }
                            state.chartsDrawn[uuid + '_' + chartId] = true;
                        }
                        // 概览图表渲染完成或无数据时，均移除该区域的加载动画
                        var section = canvas.closest('.chart-section');
                        if (section) section.classList.remove('loading');
                    }
                }
            }
        });
    }, {
        rootMargin: '50px',
        threshold: 0.1
    });
}

/**
 * 打开节点详情模态框
 * @param {string} uuid - 节点 UUID
 */
export function openNodeModal(uuid) {
    state.selectedNodeUuid = uuid;
    state.chartsDrawn = {};

    var node = state.nodes.find(function (n) { return n.uuid === uuid; });
    if (!node) return;

    var rt = state.realtimeData[uuid] || {};
    var els = getModalElements();

    if (els.nodeName) els.nodeName.textContent = node.name;

    // 清空所有 canvas 并显示加载动画，避免新节点加载时短暂显示旧图表
    [els.cpuChart, els.ramChart, els.networkChart, els.diskChart, els.processChart, els.connectionsChart].forEach(function(canvas) {
        if (canvas) {
            var ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    });
    var chartSections = document.querySelectorAll('.modal-charts .chart-section');
    chartSections.forEach(function(section) { section.classList.add('loading'); });
    var latencyContainer = document.querySelector('.latency-chart-container');
    if (latencyContainer) latencyContainer.classList.add('loading');

    updateTimeRangeButtons();

    switchModalPage('overview');
    renderOverviewPage(node, rt, uuid);

    if (els.overlay) {
        els.overlay.classList.add('active');
        var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = scrollbarWidth + 'px';
        }
        document.body.style.overflow = 'hidden';
    }

    var chartSections = document.querySelectorAll('.modal-charts .chart-section');
    chartSections.forEach(function(section) {
        section.style.animation = 'none';
        void section.offsetHeight;
        section.style.animation = '';
    });

    initChartObserver();

    var historyHours = timeRangeToHours(state.historyTimeRange);
    var pingHours = timeRangeToHours(state.pingTimeRange);

    Promise.all([
        loadNodeHistory(uuid, historyHours),
        loadPingHistory(uuid, pingHours)
    ]).then(function () {
        renderLatencyPage(uuid);

        [els.cpuChart, els.ramChart, els.networkChart, els.diskChart, els.processChart, els.connectionsChart, els.latencyChart].forEach(function(canvas) {
            if (canvas) {
                canvas.classList.add('chart-loading');
                state.chartObserver.observe(canvas);
            }
        });
    }).catch(function () {
        // 加载失败也移除动画
        document.querySelectorAll('.modal-charts .chart-section').forEach(function(section) {
            section.classList.remove('loading');
        });
        var latencyContainer = document.querySelector('.latency-chart-container');
        if (latencyContainer) latencyContainer.classList.remove('loading');
    });
}

/**
 * 更新时间范围按钮的激活状态
 */
export function updateTimeRangeButtons() {
    var overviewTimeRange = document.getElementById('overviewTimeRange');
    if (overviewTimeRange) {
        overviewTimeRange.querySelectorAll('.time-range-btn').forEach(function (btn) {
            var range = btn.getAttribute('data-range');
            btn.classList.toggle('active', range === state.historyTimeRange);
        });
    }

    var pingTimeRange = document.getElementById('pingTimeRange');
    if (pingTimeRange) {
        pingTimeRange.querySelectorAll('.time-range-btn').forEach(function (btn) {
            var range = btn.getAttribute('data-range');
            btn.classList.toggle('active', range === state.pingTimeRange);
        });
    }
}

/**
 * 渲染概览页信息区域
 * @param {Object} node - 节点对象
 * @param {Object} rt - 实时数据
 * @param {string} uuid - 节点 UUID
 */
export function renderOverviewPage(node, rt, uuid) {
    var els = getModalElements();
    var infoEl = els.modalInfo;
    if (!infoEl) return;

    var ramUsed = rt.ram ? rt.ram.used : null;
    var ramTotal = rt.ram ? rt.ram.total : node.mem_total || 0;
    var diskUsed = rt.disk ? rt.disk.used : null;
    var diskTotal = rt.disk ? rt.disk.total : node.disk_total || 0;
    var swapUsed = rt.swap ? rt.swap.used : null;
    var swapTotal = rt.swap ? rt.swap.total : node.swap_total || 0;
    var load1 = rt.load ? rt.load.load1 : null;
    var load5 = rt.load ? rt.load.load5 : null;
    var load15 = rt.load ? rt.load.load15 : null;
    var process = rt.process || 0;
    var tcpConn = rt.connections ? rt.connections.tcp : 0;
    var udpConn = rt.connections ? rt.connections.udp : 0;
    var netTotalUp = rt.network ? rt.network.totalUp : 0;
    var netTotalDown = rt.network ? rt.network.totalDown : 0;

    var items = [
        buildInfoItem(t('os_info'), node.os || '-'),
        buildInfoItem(t('cpu_model'), node.cpu_name || '-'),
        buildInfoItem(t('arch'), node.arch || '-'),
        buildInfoItem(t('virtualization'), node.virtualization || '-'),
        buildInfoItem(t('memory'), ramUsed !== null ? formatBytes(ramUsed) + ' / ' + formatBytes(ramTotal) : '- / ' + formatBytes(ramTotal)),
        buildInfoItem(t('swap'), swapTotal > 0 ? (swapUsed !== null ? formatBytes(swapUsed) + ' / ' + formatBytes(swapTotal) : '- / ' + formatBytes(swapTotal)) : '-'),
        buildInfoItem(t('disk'), diskUsed !== null ? formatBytes(diskUsed) + ' / ' + formatBytes(diskTotal) : '- / ' + formatBytes(diskTotal)),
        buildInfoItem(t('load'), load1 !== null ? load1.toFixed(2) + ' / ' + (load5 !== null ? load5.toFixed(2) : '-') + ' / ' + (load15 !== null ? load15.toFixed(2) : '-') : '-'),
        buildInfoItem(t('processes'), String(process)),
        buildInfoItem(t('connections'), 'TCP: ' + tcpConn + ' / UDP: ' + udpConn),
        buildInfoItem(t('uptime'), formatUptime(rt.uptime || 0)),
        buildInfoItem(t('network'), t('up') + ': ' + formatBytes(netTotalUp) + ' / ' + t('down') + ': ' + formatBytes(netTotalDown), true)
    ];

    infoEl.innerHTML = items.join('');
}

/**
 * 渲染延迟页（摘要 + 任务列表 + 图例）
 * @param {string} uuid - 节点 UUID
 */
export function renderLatencyPage(uuid) {
    var pingInfo = state.pingData[uuid];
    var els = getModalElements();
    var summaryEl = els.latencySummary;
    var tasksEl = els.latencyTasks;
    var legendEl = els.latencyLegend;
    var chartEl = els.latencyChart;

    if (!pingInfo || !pingInfo.tasks || pingInfo.tasks.length === 0) {
        if (summaryEl) summaryEl.innerHTML = '';
        if (legendEl) legendEl.innerHTML = '';
        if (tasksEl) {
            tasksEl.innerHTML = '<div class="latency-empty">' + t('latency_not_configured') + '</div>';
        }
        if (chartEl) {
            var ctx = chartEl.getContext('2d');
            ctx.clearRect(0, 0, chartEl.width, chartEl.height);
        }
        return;
    }

    if (summaryEl && pingInfo.records && pingInfo.records.length > 0) {
        var allValues = pingInfo.records.map(function (r) { return r.value; }).filter(function (v) { return v !== null && v !== undefined && v >= 0; });
        var minPing = allValues.length > 0 ? Math.min.apply(null, allValues) : null;
        var maxPing = allValues.length > 0 ? Math.max.apply(null, allValues) : null;
        var avgPing = allValues.length > 0 ? allValues.reduce(function (a, b) { return a + b; }, 0) / allValues.length : null;

        var summaryItems = [
            '<div class="latency-stat"><div class="latency-stat-value level-' + getPingLevel(minPing) + '">' + formatPing(minPing) + '</div><div class="latency-stat-label">' + t('min_ping') + '</div></div>',
            '<div class="latency-stat"><div class="latency-stat-value level-' + getPingLevel(maxPing) + '">' + formatPing(maxPing) + '</div><div class="latency-stat-label">' + t('max_ping') + '</div></div>',
            '<div class="latency-stat"><div class="latency-stat-value level-' + getPingLevel(avgPing) + '">' + formatPing(avgPing) + '</div><div class="latency-stat-label">' + t('avg_latency') + '</div></div>'
        ];
        summaryEl.innerHTML = summaryItems.join('');
    }

    if (tasksEl && pingInfo.tasks && pingInfo.tasks.length > 0) {
        var taskItems = ['<div class="latency-tasks-title">' + t('tasks') + '</div>'];
        pingInfo.tasks.forEach(function (task, idx) {
            var taskPing = getTaskLatestPing(uuid, task.id);
            var level = getPingLevel(taskPing);
            var color = PING_COLORS[idx % PING_COLORS.length];
            taskItems.push(
                '<div class="latency-task-card" style="border-left-color: ' + color + '">' +
                '<span class="latency-task-name">' + escapeHtml(task.name) + '</span>' +
                '<div class="latency-task-info">' +
                '<span class="latency-task-ping level-' + level + '">' + formatPing(taskPing) + '</span>' +
                (task.loss !== undefined ? '<span class="latency-task-loss">' + t('packet_loss') + ': ' + task.loss.toFixed(1) + '%</span>' : '') +
                '</div></div>'
            );
        });
        tasksEl.innerHTML = taskItems.join('');
    }

    if (legendEl && pingInfo.tasks && pingInfo.tasks.length > 0) {
        var legendItems = pingInfo.tasks.map(function (task, idx) {
            var color = PING_COLORS[idx % PING_COLORS.length];
            return '<div class="latency-legend-item"><span class="latency-legend-color" style="background: ' + color + '"></span>' + escapeHtml(task.name) + '</div>';
        });
        legendEl.innerHTML = legendItems.join('');
    }
}

/**
 * 切换模态框页面（概览/延迟）
 * @param {string} pageName - 页面名称 'overview' 或 'latency'
 */
export function switchModalPage(pageName) {
    var pages = document.querySelectorAll('.modal-page');
    var tabs = document.querySelectorAll('.modal-tab');

    pages.forEach(function (page) {
        if (page.id === 'page' + pageName.charAt(0).toUpperCase() + pageName.slice(1)) {
            page.classList.remove('slide-out');
            page.classList.add('active');

            var animatedElements = page.querySelectorAll('.modal-info-item, .chart-section, .latency-stat, .latency-task-card, .latency-chart-container');
            animatedElements.forEach(function(el) {
                el.style.animation = 'none';
                void el.offsetHeight;
                el.style.animation = '';
            });
        } else {
            page.classList.remove('active');
        }
    });

    tabs.forEach(function (tab) {
        tab.classList.toggle('active', tab.getAttribute('data-tab') === pageName);
    });

    if (pageName === 'latency' && state.selectedNodeUuid) {
        var els = getModalElements();
        if (els.latencyChart) {
            state.chartObserver.observe(els.latencyChart);
        }
    }
}

/**
 * 构建模态框信息项 HTML
 * @param {string} label - 标签
 * @param {string} value - 值
 * @param {boolean} nowrap - 是否不换行
 * @returns {string} HTML
 */
function buildInfoItem(label, value, nowrap) {
    var cls = nowrap ? 'modal-info-value modal-info-value-nowrap' : 'modal-info-value';
    return '<div class="modal-info-item"><div class="modal-info-label">' + escapeHtml(label) + '</div><div class="' + cls + '">' + escapeHtml(value) + '</div></div>';
}

/**
 * 关闭模态框
 */
export function closeModal() {
    var els = getModalElements();
    if (els.overlay && els.overlay.classList.contains('active')) {
        els.overlay.classList.add('closing');

        if (els.modal) {
            els.modal.style.transform = 'scale(0.95) translateY(20px)';
            els.modal.style.opacity = '0';
        }

        setTimeout(function() {
            els.overlay.classList.remove('active');
            els.overlay.classList.remove('closing');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';

            if (els.modal) {
                els.modal.scrollTop = 0;
                els.modal.classList.remove('dragging');
                els.modal.style.maxHeight = '';
                els.modal.style.transform = '';
                els.modal.style.opacity = '';
            }

            if (els.scrollIndicator) {
                els.scrollIndicator.classList.remove('visible');
                els.scrollIndicator.style.setProperty('--scroll-progress', '0');
            }

            if (state.chartObserver) {
                [els.cpuChart, els.ramChart, els.networkChart, els.diskChart, els.processChart, els.connectionsChart, els.latencyChart].forEach(function(canvas) {
                    if (canvas) {
                        state.chartObserver.unobserve(canvas);
                    }
                });
            }

            state.selectedNodeUuid = null;
            state.chartsDrawn = {};
            switchModalPage('overview');
        }, 250);
    }
}

/**
 * 初始化模态框拖拽滚动
 * 包含鼠标拖拽 + 触摸拖拽 + 惯性滚动 + 拖拽手柄下拉关闭
 */
export function initModalDragScroll() {
    var modal = document.getElementById('nodeModal');
    var scrollIndicator = document.getElementById('modalScrollIndicator');
    if (!modal) return;

    var isDragging = false;
    var startY = 0;
    var scrollTop = 0;
    var lastY = 0;
    var velocity = 0;
    var animationFrame = null;

    function updateScrollIndicator() {
        if (!scrollIndicator) return;
        var scrollHeight = modal.scrollHeight - modal.clientHeight;
        if (scrollHeight <= 0) {
            scrollIndicator.classList.remove('visible');
            return;
        }
        var progress = modal.scrollTop / scrollHeight;
        scrollIndicator.style.setProperty('--scroll-progress', progress);
        scrollIndicator.classList.add('visible');
    }

    function momentumScroll() {
        if (Math.abs(velocity) < 0.5) {
            velocity = 0;
            return;
        }

        modal.scrollTop += velocity;
        velocity *= 0.95;
        updateScrollIndicator();
        animationFrame = requestAnimationFrame(momentumScroll);
    }

    function onMouseDown(e) {
        if (e.button !== 0) return;
        if (e.target.closest('button, a, input, .modal-tabs, .modal-header')) return;

        isDragging = true;
        startY = e.clientY;
        scrollTop = modal.scrollTop;
        lastY = startY;
        velocity = 0;

        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }

        modal.classList.add('dragging');
        document.body.style.cursor = 'grabbing';

        document.addEventListener('mousemove', onMouseMove, { passive: false });
        document.addEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e) {
        if (!isDragging) return;

        var deltaY = startY - e.clientY;
        var currentY = e.clientY;
        velocity = lastY - currentY;
        lastY = currentY;

        modal.scrollTop = scrollTop + deltaY;
        updateScrollIndicator();

        e.preventDefault();
    }

    function onMouseUp() {
        if (!isDragging) return;

        isDragging = false;
        modal.classList.remove('dragging');
        document.body.style.cursor = '';

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        if (Math.abs(velocity) > 1) {
            momentumScroll();
        }
    }

    modal.addEventListener('mousedown', onMouseDown);

    modal.addEventListener('scroll', function() {
        updateScrollIndicator();
    }, { passive: true });

    var touchStartY = 0;
    var touchStartScrollTop = 0;

    modal.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
            touchStartY = e.touches[0].clientY;
            touchStartScrollTop = modal.scrollTop;
        }
    }, { passive: true });

    modal.addEventListener('touchmove', function(e) {
        if (e.touches.length === 1) {
            var touchY = e.touches[0].clientY;
            var deltaY = touchStartY - touchY;
            modal.scrollTop = touchStartScrollTop + deltaY;
            updateScrollIndicator();
        }
    }, { passive: true });

    modal.addEventListener('touchend', function() {
        updateScrollIndicator();
    }, { passive: true });

    var dragHandle = document.getElementById('modalDragHandle');
    if (dragHandle) {
        var handleStartY = 0;
        var handleStartTop = 0;
        var isHandleDragging = false;
        var modalStartHeight = 0;

        dragHandle.addEventListener('touchstart', function(e) {
            if (e.touches.length === 1) {
                isHandleDragging = true;
                handleStartY = e.touches[0].clientY;
                handleStartTop = modal.offsetTop;
                modalStartHeight = modal.offsetHeight;
                modal.style.transition = 'none';
            }
        }, { passive: true });

        dragHandle.addEventListener('touchmove', function(e) {
            if (!isHandleDragging || e.touches.length !== 1) return;

            var currentY = e.touches[0].clientY;
            var deltaY = currentY - handleStartY;

            if (deltaY > 0 && modal.scrollTop === 0) {
                e.preventDefault();
                var newHeight = Math.max(modalStartHeight - deltaY, 100);
                modal.style.maxHeight = newHeight + 'px';
                modal.style.transform = 'translateY(' + (deltaY * 0.5) + 'px)';
                modal.style.opacity = Math.max(1 - deltaY / 300, 0.3);
            }
        }, { passive: false });

        dragHandle.addEventListener('touchend', function(e) {
            if (!isHandleDragging) return;

            isHandleDragging = false;
            modal.style.transition = '';

            var currentY = e.changedTouches[0].clientY;
            var deltaY = currentY - handleStartY;

            if (deltaY > 100 && modal.scrollTop === 0) {
                closeModal();
            } else {
                modal.style.maxHeight = '';
                modal.style.transform = '';
                modal.style.opacity = '';
            }
        }, { passive: true });
    }

    var observer = new MutationObserver(function() {
        setTimeout(updateScrollIndicator, 100);
    });

    observer.observe(modal, {
        childList: true,
        subtree: true
    });
}
