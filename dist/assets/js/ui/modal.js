/**
 * @module ui/modal
 * @description 模态框核心管理（打开/关闭/切换 Tab/图表观察器/拖拽滚动）
 * @dependencies core/state.js, i18n/index.js, utils/time.js, services/api.js, ui/charts.js, ui/modal-overview.js, ui/modal-latency.js
 * @exports openNodeModal, closeModal, switchModalPage, initChartObserver, renderOverviewPage, renderLatencyPage, getModalElements, updateTimeRangeButtons, initModalDragScroll
 */

import { state } from '../core/state.js';
import { timeRangeToHours } from '../utils/time.js';
import { loadNodeHistory, loadPingHistory } from '../services/api.js';
import { drawLatencyChart, renderChartByConfig, getChartConfigs, drawLineChart, drawNetworkChart } from './charts/index.js';
import { renderOverviewPage } from './modal-overview.js';
import { renderLatencyPage } from './modal-latency.js';

// 重新导出供 events.js 等外部模块使用
export { renderOverviewPage } from './modal-overview.js';
export { renderLatencyPage } from './modal-latency.js';

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
                const canvas = entry.target;
                const chartId = canvas.id;
                const uuid = state.selectedNodeUuid;

                if (uuid && !state.chartsDrawn[uuid + '_' + chartId]) {
                    canvas.classList.remove('chart-loading');
                    if (chartId === 'latencyChart') {
                        const pingInfo = state.pingData[uuid];
                        if (pingInfo) {
                            drawLatencyChart('latencyChart', pingInfo.records, pingInfo.tasks);
                            state.chartsDrawn[uuid + '_' + chartId] = true;
                            const latencyContainer = document.querySelector('.latency-chart-container');
                            if (latencyContainer) latencyContainer.classList.remove('loading');
                        }
                    } else {
                        const dataHours = state.historyDataHours[uuid] !== undefined
                            ? state.historyDataHours[uuid]
                            : timeRangeToHours(state.historyTimeRange);
                        let records;
                        if (dataHours === 0) {
                            records = state.realtimeHistory[uuid] || [];
                        } else {
                            records = state.historyData[uuid] || [];
                        }
                        if (records.length > 0) {
                            const node = state.nodes.find(function(n) { return n.uuid === uuid; });
                            const liveData = state.realtimeData[uuid];
                            const chartConfigs = getChartConfigs(node, liveData);
                            const config = chartConfigs.find(function(c) { return c.canvasId === chartId; });
                            if (config) {
                                renderChartByConfig(config, records, dataHours);
                            } else {
                                if (chartId === 'cpuChart') {
                                    drawLineChart('cpuChart', records, function (r) { return r.cpu; }, 0, 100, '#e8668a', 'CPU %', dataHours);
                                } else if (chartId === 'ramChart') {
                                    drawLineChart('ramChart', records, function (r) {
                                        const ramVal = r.ram;
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
                        const section = canvas.closest('.chart-section');
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

    const node = state.nodes.find(function (n) { return n.uuid === uuid; });
    if (!node) return;

    const rt = state.realtimeData[uuid] || {};
    const els = getModalElements();

    if (els.nodeName) els.nodeName.textContent = node.name;

    // 清空所有 canvas 并显示加载动画，避免新节点加载时短暂显示旧图表
    [els.cpuChart, els.ramChart, els.networkChart, els.diskChart, els.processChart, els.connectionsChart].forEach(function(canvas) {
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    });
    const chartSections = document.querySelectorAll('.modal-charts .chart-section');
    chartSections.forEach(function(section) { section.classList.add('loading'); });
    const latencyContainer = document.querySelector('.latency-chart-container');
    if (latencyContainer) latencyContainer.classList.add('loading');

    updateTimeRangeButtons();

    switchModalPage('overview');
    renderOverviewPage(node, rt, uuid);

    if (els.overlay) {
        els.overlay.classList.add('active');
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = scrollbarWidth + 'px';
        }
        document.body.style.overflow = 'hidden';
    }

    const animatedSections = document.querySelectorAll('.modal-charts .chart-section');
    animatedSections.forEach(function(section) {
        section.style.animation = 'none';
        void section.offsetHeight;
        section.style.animation = '';
    });

    initChartObserver();

    const historyHours = timeRangeToHours(state.historyTimeRange);
    const pingHours = timeRangeToHours(state.pingTimeRange);

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
        document.querySelectorAll('.modal-charts .chart-section').forEach(function(section) {
            section.classList.remove('loading');
        });
        const latencyContainer = document.querySelector('.latency-chart-container');
        if (latencyContainer) latencyContainer.classList.remove('loading');
    });
}

/**
 * 更新时间范围按钮的激活状态
 */
export function updateTimeRangeButtons() {
    const overviewTimeRange = document.getElementById('overviewTimeRange');
    if (overviewTimeRange) {
        overviewTimeRange.querySelectorAll('.time-range-btn').forEach(function (btn) {
            const range = btn.getAttribute('data-range');
            btn.classList.toggle('active', range === state.historyTimeRange);
        });
    }

    const pingTimeRange = document.getElementById('pingTimeRange');
    if (pingTimeRange) {
        pingTimeRange.querySelectorAll('.time-range-btn').forEach(function (btn) {
            const range = btn.getAttribute('data-range');
            btn.classList.toggle('active', range === state.pingTimeRange);
        });
    }
}

/**
 * 切换模态框页面（概览/延迟）
 * @param {string} pageName - 页面名称 'overview' 或 'latency'
 */
export function switchModalPage(pageName) {
    const pages = document.querySelectorAll('.modal-page');
    const tabs = document.querySelectorAll('.modal-tab');

    pages.forEach(function (page) {
        if (page.id === 'page' + pageName.charAt(0).toUpperCase() + pageName.slice(1)) {
            page.classList.remove('slide-out');
            page.classList.add('active');

            const animatedElements = page.querySelectorAll('.modal-info-item, .chart-section, .latency-stat, .latency-task-card, .latency-chart-container');
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
        const els = getModalElements();
        if (els.latencyChart) {
            state.chartObserver.observe(els.latencyChart);
        }
    }
}

/**
 * 关闭模态框
 */
export function closeModal() {
    const els = getModalElements();
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
    const modal = document.getElementById('nodeModal');
    const scrollIndicator = document.getElementById('modalScrollIndicator');
    if (!modal) return;

    let isDragging = false;
    let startY = 0;
    let scrollTop = 0;
    let lastY = 0;
    let velocity = 0;
    let animationFrame = null;

    function updateScrollIndicator() {
        if (!scrollIndicator) return;
        const scrollHeight = modal.scrollHeight - modal.clientHeight;
        if (scrollHeight <= 0) {
            scrollIndicator.classList.remove('visible');
            return;
        }
        const progress = modal.scrollTop / scrollHeight;
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

        const deltaY = startY - e.clientY;
        const currentY = e.clientY;
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

    let touchStartY = 0;
    let touchStartScrollTop = 0;

    modal.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
            touchStartY = e.touches[0].clientY;
            touchStartScrollTop = modal.scrollTop;
        }
    }, { passive: true });

    modal.addEventListener('touchmove', function(e) {
        if (e.touches.length === 1) {
            const touchY = e.touches[0].clientY;
            const deltaY = touchStartY - touchY;
            modal.scrollTop = touchStartScrollTop + deltaY;
            updateScrollIndicator();
        }
    }, { passive: true });

    modal.addEventListener('touchend', function() {
        updateScrollIndicator();
    }, { passive: true });

    const dragHandle = document.getElementById('modalDragHandle');
    if (dragHandle) {
        let handleStartY = 0;
        let handleStartTop = 0;
        let isHandleDragging = false;
        let modalStartHeight = 0;

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

            const currentY = e.touches[0].clientY;
            const deltaY = currentY - handleStartY;

            if (deltaY > 0 && modal.scrollTop === 0) {
                e.preventDefault();
                const newHeight = Math.max(modalStartHeight - deltaY, 100);
                modal.style.maxHeight = newHeight + 'px';
                modal.style.transform = 'translateY(' + (deltaY * 0.5) + 'px)';
                modal.style.opacity = Math.max(1 - deltaY / 300, 0.3);
            }
        }, { passive: false });

        dragHandle.addEventListener('touchend', function(e) {
            if (!isHandleDragging) return;

            isHandleDragging = false;
            modal.style.transition = '';

            const currentY = e.changedTouches[0].clientY;
            const deltaY = currentY - handleStartY;

            if (deltaY > 100 && modal.scrollTop === 0) {
                closeModal();
            } else {
                modal.style.maxHeight = '';
                modal.style.transform = '';
                modal.style.opacity = '';
            }
        }, { passive: true });
    }

    const observer = new MutationObserver(function() {
        setTimeout(updateScrollIndicator, 100);
    });

    observer.observe(modal, {
        childList: true,
        subtree: true
    });
}
