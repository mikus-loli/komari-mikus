/**
 * @module core/constants
 * @description 静态常量映射表
 * @dependencies 无
 * @exports RPC_METHODS, THEME_MAP, VIEW_MAP, PING_COLORS, COUNTRY_CODE_MAP, RPC_TIMEOUT_MS, RPC_POLL_INTERVAL_MS, MAX_HISTORY_POINTS, MAX_HISTORY_POINTS_LONG, RECENT_RECORDS_LIMIT, PING_DEFAULT_HOURS, EWMA_ALPHA_DEFAULT, CACHE_EXPIRY_MS, BATCH_CONCURRENCY
 */

/** RPC 方法名映射 */
export const RPC_METHODS = {
    getPublicSettings: 'public:getPublicSettings',
    getPublicSettingsFallback: 'common:getPublicInfo',
    getNodesInformation: 'common:getNodes',
    getNodesInformationFallback: 'public:getNodesInformation',
    getClientRecentRecords: 'public:getClientRecentRecords',
    getClientRecentRecordsFallback: 'common:getNodeRecentStatus',
    getRecordsByUUID: 'public:getRecordsByUUID',
    getRecordsByUUIDFallback: 'common:getRecords',
    getPingRecords: 'public:getPingRecords',
    getPingRecordsFallback: 'common:getRecords',
    getPublicPingTasks: 'public:getPublicPingTasks',
    queryMetrics: 'public:queryMetrics',
    getPingMetricStats: 'public:getPingMetricStats'
};

/** 主题映射 */
export const THEME_MAP = {
    light: 'light',
    dark: 'dark',
    auto: 'auto'
};

/** 视图映射 */
export const VIEW_MAP = {
    grid: 'grid',
    table: 'table'
};

/** Ping 延迟颜色 */
export const PING_COLORS = [
    '#e8668a', '#4caf7d', '#5c9ced', '#f5a623',
    '#7ab3f7', '#ff8fa3', '#a78bfa', '#34d399',
    '#fb923c', '#60a5fa', '#f472b6', '#10b981'
];

/** 国家代码映射（常见国家） */
export const COUNTRY_CODE_MAP = {
    '中国': 'CN', 'China': 'CN',
    '美国': 'US', 'United States': 'US', 'USA': 'US',
    '日本': 'JP', 'Japan': 'JP',
    '韩国': 'KR', 'Korea': 'KR', 'South Korea': 'KR',
    '新加坡': 'SG', 'Singapore': 'SG',
    '德国': 'DE', 'Germany': 'DE',
    '英国': 'GB', 'United Kingdom': 'GB', 'UK': 'GB',
    '法国': 'FR', 'France': 'FR',
    '加拿大': 'CA', 'Canada': 'CA',
    '澳大利亚': 'AU', 'Australia': 'AU',
    '俄罗斯': 'RU', 'Russia': 'RU',
    '印度': 'IN', 'India': 'IN',
    '巴西': 'BR', 'Brazil': 'BR',
    '香港': 'HK', 'Hong Kong': 'HK',
    '台湾': 'TW', 'Taiwan': 'TW',
    '荷兰': 'NL', 'Netherlands': 'NL',
    '土耳其': 'TR', 'Turkey': 'TR'
};

/** RPC 调用超时时间（毫秒） */
export const RPC_TIMEOUT_MS = 15000;

/** RPC 轮询间隔（毫秒） */
export const RPC_POLL_INTERVAL_MS = 1000;

/** 历史数据最大保留点数 */
export const MAX_HISTORY_POINTS = 600;

/** 长时间范围（>24h）历史数据的最大保留点数 */
export const MAX_HISTORY_POINTS_LONG = 800;

/** /api/recent/ 接口保留的最大记录条数（与 komari-web length=30*5 一致） */
export const RECENT_RECORDS_LIMIT = 150;

/** Ping 总览默认加载小时数 */
export const PING_DEFAULT_HOURS = 1;

/** EWMA 平滑因子默认值 */
export const EWMA_ALPHA_DEFAULT = 0.3;

/** 缓存有效期（毫秒） */
export const CACHE_EXPIRY_MS = 60000;

/** 批量加载每批并发数 */
export const BATCH_CONCURRENCY = 10;
