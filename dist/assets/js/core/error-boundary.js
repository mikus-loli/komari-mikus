/**
 * @module core/error-boundary
 * @description 全局错误边界 — 捕获未处理的 Promise rejection 和运行时错误，以 toast 提示用户
 * @dependencies 无
 * @exports initErrorBoundary, showErrorToast
 */

/** toast 容器（懒创建） */
let toastContainer = null;

/** toast 计数器，用于防抖 */
let toastCount = 0;

/** toast 最大同时显示数 */
const MAX_TOASTS = 3;

/** toast 自动消失时间（毫秒） */
const TOAST_DURATION = 5000;

/**
 * 创建 toast 容器（仅首次调用时创建）
 */
function ensureContainer() {
    if (toastContainer) return;
    toastContainer = document.createElement('div');
    toastContainer.id = 'error-toast-container';
    toastContainer.style.cssText = 'position:fixed;top:16px;right:16px;z-index:999999;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:360px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
    document.body.appendChild(toastContainer);
}

/**
 * 显示错误 toast
 * @param {string} message - 错误信息
 * @param {string} [level='error'] - 级别：'error' | 'warn'
 */
export function showErrorToast(message, level) {
    if (!document.body) return;
    ensureContainer();

    // 防抖：同时最多 MAX_TOASTS 条
    toastCount++;
    if (toastCount > MAX_TOASTS) return;

    const isError = level !== 'warn';
    const toast = document.createElement('div');
    toast.setAttribute('role', 'alert');
    toast.style.cssText = 'pointer-events:auto;padding:10px 14px;border-radius:6px;font-size:13px;line-height:1.4;color:#fff;backdrop-filter:blur(8px);box-shadow:0 2px 8px rgba(0,0,0,0.2);opacity:0;transform:translateX(20px);transition:opacity 0.3s,transform 0.3s;word-break:break-word;' +
        (isError ? 'background:rgba(220,53,69,0.9);' : 'background:rgba(255,159,64,0.9);');

    toast.textContent = message;
    toastContainer.appendChild(toast);

    // 触发入场动画
    requestAnimationFrame(function() {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    });

    // 自动消失
    const timer = setTimeout(function() {
        dismissToast(toast);
    }, TOAST_DURATION);

    toast.addEventListener('click', function() {
        clearTimeout(timer);
        dismissToast(toast);
    });
}

/**
 * 移除 toast（带退场动画）
 */
function dismissToast(toast) {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
        toastCount = Math.max(0, toastCount - 1);
    }, 300);
}

/**
 * 从 Error 对象中提取可读信息
 */
function extractMessage(reason) {
    if (!reason) return 'Unknown error';
    if (typeof reason === 'string') return reason;
    if (reason instanceof Error) {
        if (reason.message === 'Failed to fetch' || reason.message.indexOf('NetworkError') !== -1) {
            return 'Network error — please check your connection';
        }
        if (reason.message.indexOf('RPC timeout') !== -1) {
            return 'Server timeout — retrying...';
        }
        return reason.message;
    }
    if (reason.message) return reason.message;
    try {
        return JSON.stringify(reason);
    } catch (e) {
        return 'Unknown error';
    }
}

/**
 * 初始化全局错误边界
 * 监听 unhandledrejection 和 error 事件，捕获未处理的异常并展示 toast
 */
export function initErrorBoundary() {
    window.addEventListener('unhandledrejection', function(event) {
        const msg = extractMessage(event.reason);
        console.error('[ErrorBoundary] Unhandled rejection:', event.reason);
        showErrorToast(msg, 'error');
    });

    window.addEventListener('error', function(event) {
        if (event.target && (event.target.tagName === 'IMG' || event.target.tagName === 'SCRIPT' || event.target.tagName === 'LINK')) {
            return;
        }
        const msg = event.message || 'Runtime error';
        console.error('[ErrorBoundary] Runtime error:', event.error);
        showErrorToast(msg, 'error');
    }, true);
}
