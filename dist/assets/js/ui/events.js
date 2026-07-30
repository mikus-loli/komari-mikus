/**
 * @module ui/events
 * @description 全局事件绑定（主题/语言/视图切换、搜索、模态框、Tab、键盘、时间范围、延迟平滑、窗口 resize）
 * @dependencies core/state.js, ui/theme.js, ui/nodes.js, ui/modal.js, ui/charts.js, utils/helpers.js, utils/time.js, services/api.js
 * @exports bindEvents
 * @source app.js L4376-L4553
 */

import { state } from '../core/state.js';
import { toggleTheme, toggleLang, setView, applyBackgroundSettings } from './theme.js';
import { renderAll } from './nodes.js';
import { closeModal, switchModalPage, initModalDragScroll, renderLatencyPage } from './modal.js';
import { drawCharts, drawLatencyChart } from './charts.js';
import { isMobileDevice } from '../utils/helpers.js';
import { timeRangeToHours } from '../utils/time.js';
import { loadNodeHistory, loadPingHistory } from '../services/api.js';

/**
 * 绑定全局事件
 * 包括：主题/语言/视图切换、搜索、模态框关闭、Tab 切换、键盘 ESC、
 * 延迟平滑按钮、概要/延迟图表时间范围选择、模态框拖拽滚动、窗口 resize
 */
export function bindEvents() {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    const langToggle = document.getElementById('langToggle');
    if (langToggle) {
        langToggle.addEventListener('click', toggleLang);
    }

    document.querySelectorAll('.view-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            setView(this.getAttribute('data-view'));
        });
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchTimer = null;
        searchInput.addEventListener('input', function () {
            clearTimeout(searchTimer);
            const val = this.value;
            searchTimer = setTimeout(function () {
                state.searchQuery = val;
                renderAll();
            }, 200);
        });
    }

    const modalClose = document.getElementById('modalClose');
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function (e) {
            if (e.target === this) closeModal();
        });
    }

    document.querySelectorAll('.modal-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            const pageName = this.getAttribute('data-tab');
            switchModalPage(pageName);
        });
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeModal();
    });

    // 延迟趋势图表平滑按钮
    const latencySmoothBtn = document.getElementById('latencySmoothBtn');
    if (latencySmoothBtn) {
        latencySmoothBtn.addEventListener('click', function () {
            state.latencyChartSmooth = !state.latencyChartSmooth;
            this.classList.toggle('active', state.latencyChartSmooth);

            // 重新绘制延迟图表
            if (state.selectedNodeUuid && state.pingData[state.selectedNodeUuid]) {
                const pingInfo = state.pingData[state.selectedNodeUuid];
                if (pingInfo && pingInfo.records && pingInfo.tasks) {
                    drawLatencyChart('latencyChart', pingInfo.records, pingInfo.tasks);
                }
            }
        });
    }

    // 概要图表时间范围选择
    const overviewTimeRange = document.getElementById('overviewTimeRange');
    if (overviewTimeRange) {
        overviewTimeRange.querySelectorAll('.time-range-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const range = this.getAttribute('data-range');
                state.historyTimeRange = range;

                // 更新按钮激活状态
                overviewTimeRange.querySelectorAll('.time-range-btn').forEach(function (b) {
                    b.classList.remove('active');
                });
                this.classList.add('active');

                // 重新加载历史数据并绘制图表
                if (state.selectedNodeUuid) {
                    const hours = timeRangeToHours(range);
                    // 显示加载动画
                    const chartSections = document.querySelectorAll('.modal-charts .chart-section');
                    chartSections.forEach(function(section) {
                        section.classList.add('loading');
                    });

                    loadNodeHistory(state.selectedNodeUuid, hours).then(function () {
                        // 重置图表动画
                        chartSections.forEach(function(section) {
                            section.style.animation = 'none';
                            void section.offsetHeight;
                            section.style.animation = '';
                        });

                        drawCharts(state.selectedNodeUuid);

                        // 隐藏加载动画
                        chartSections.forEach(function(section) {
                            section.classList.remove('loading');
                        });
                    }).catch(function (err) {
                        console.error('加载历史数据失败:', err);
                        chartSections.forEach(function(section) {
                            section.classList.remove('loading');
                        });
                    });
                }
            });
        });
    }

    // 延迟图表时间范围选择
    const pingTimeRange = document.getElementById('pingTimeRange');
    if (pingTimeRange) {
        pingTimeRange.querySelectorAll('.time-range-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const range = this.getAttribute('data-range');
                state.pingTimeRange = range;

                // 更新按钮激活状态
                pingTimeRange.querySelectorAll('.time-range-btn').forEach(function (b) {
                    b.classList.remove('active');
                });
                this.classList.add('active');

                // 重新加载 Ping 数据并绘制图表
                if (state.selectedNodeUuid) {
                    // 清除图表绘制状态，确保图表重新绘制
                    if (state.chartsDrawn[state.selectedNodeUuid + '_latencyChart']) {
                        delete state.chartsDrawn[state.selectedNodeUuid + '_latencyChart'];
                    }

                    // 显示加载动画
                    const latencyChartContainer = document.querySelector('.latency-chart-container');
                    if (latencyChartContainer) {
                        latencyChartContainer.classList.add('loading');
                    }

                    const hours = timeRangeToHours(range);
                    loadPingHistory(state.selectedNodeUuid, hours).then(function () {
                        // 重置延迟页面动画
                        const latencyAnimated = document.querySelectorAll('#pageLatency .latency-stat, #pageLatency .latency-task-card, #pageLatency .latency-chart-container');
                        latencyAnimated.forEach(function(el) {
                            el.style.animation = 'none';
                            void el.offsetHeight;
                            el.style.animation = '';
                        });

                        renderLatencyPage(state.selectedNodeUuid);

                        // 直接绘制延迟图表（不依赖 IntersectionObserver）
                        const pingInfo = state.pingData[state.selectedNodeUuid];
                        if (pingInfo && pingInfo.records && pingInfo.tasks) {
                            drawLatencyChart('latencyChart', pingInfo.records, pingInfo.tasks);
                            state.chartsDrawn[state.selectedNodeUuid + '_latencyChart'] = true;
                        }

                        // 隐藏加载动画
                        if (latencyChartContainer) {
                            latencyChartContainer.classList.remove('loading');
                        }
                    }).catch(function (err) {
                        console.error('加载 Ping 数据失败:', err);
                        if (latencyChartContainer) {
                            latencyChartContainer.classList.remove('loading');
                        }
                    });
                }
            });
        });
    }

    initModalDragScroll();

    // 响应式防抖优化（参考 PurCarte 的 debounce=50）
    let resizeTimer = null;
    let chartResizeTimer = null;
    let lastIsMobile = isMobileDevice();

    window.addEventListener('resize', function () {
        // 图表重绘防抖：延迟 50ms 后执行，避免频繁重绘
        if (chartResizeTimer) clearTimeout(chartResizeTimer);
        chartResizeTimer = setTimeout(function() {
            if (state.selectedNodeUuid && state.historyData[state.selectedNodeUuid]) {
                drawCharts(state.selectedNodeUuid);
            }
        }, 50);  // PurCarte 使用 debounce=50

        // 移动设备检测防抖：延迟 100ms 后执行
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            const currentIsMobile = isMobileDevice();
            if (currentIsMobile !== lastIsMobile) {
                lastIsMobile = currentIsMobile;
                applyBackgroundSettings();
            }
        }, 100);
    });
}
