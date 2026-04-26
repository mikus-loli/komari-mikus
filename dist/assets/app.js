(function () {
    'use strict';

    var i18n = {
        'zh-CN': {
            total_nodes: '节点总数',
            online: '在线',
            offline: '离线',
            status: '状态',
            name: '名称',
            region: '地区',
            network: '网络',
            uptime: '运行时间',
            cpu_usage: 'CPU 使用率',
            ram_usage: '内存使用率',
            network_traffic: '网络流量',
            search_placeholder: '搜索节点...',
            loading: '加载中...',
            no_nodes: '暂无节点数据',
            os_info: '系统信息',
            cpu_model: 'CPU 型号',
            memory: '内存',
            swap: '交换分区',
            disk: '磁盘',
            load: '负载',
            processes: '进程',
            connections: '连接',
            up: '上传',
            down: '下载',
            days: '天',
            hours: '小时',
            minutes: '分钟',
            seconds: '秒',
            all: '全部',
            grid_view: '网格视图',
            table_view: '表格视图',
            toggle_theme: '切换主题',
            switch_lang: '切换语言',
            arch: '架构',
            virtualization: '虚拟化',
            ungrouped: '未分组',
            ping: '延迟',
            ping_ms: 'ms',
            ping_latency: '网络延迟',
            ping_chart: '延迟趋势',
            avg_ping: '平均延迟',
            packet_loss: '丢包率',
            overview: '概览',
            latency_detail: '延迟详情',
            min_ping: '最低延迟',
            max_ping: '最高延迟',
            avg_latency: '平均延迟',
            tasks: '监测任务',
            good_morning: '早上好',
            good_afternoon: '下午好',
            good_evening: '晚上好',
            welcome_back: '欢迎回来，一切正常运行中',
            expired: '已过期',
            long_term: '长期'
        },
        'en': {
            total_nodes: 'Total Nodes',
            online: 'Online',
            offline: 'Offline',
            status: 'Status',
            name: 'Name',
            region: 'Region',
            network: 'Network',
            uptime: 'Uptime',
            cpu_usage: 'CPU Usage',
            ram_usage: 'RAM Usage',
            network_traffic: 'Network Traffic',
            search_placeholder: 'Search nodes...',
            loading: 'Loading...',
            no_nodes: 'No node data available',
            os_info: 'System Info',
            cpu_model: 'CPU Model',
            memory: 'Memory',
            swap: 'Swap',
            disk: 'Disk',
            load: 'Load',
            processes: 'Processes',
            connections: 'Connections',
            up: 'Up',
            down: 'Down',
            days: 'd',
            hours: 'h',
            minutes: 'm',
            seconds: 's',
            all: 'All',
            grid_view: 'Grid View',
            table_view: 'Table View',
            toggle_theme: 'Toggle Theme',
            switch_lang: 'Switch Language',
            arch: 'Arch',
            virtualization: 'Virtualization',
            ungrouped: 'Ungrouped',
            ping: 'Ping',
            ping_ms: 'ms',
            ping_latency: 'Network Latency',
            ping_chart: 'Latency Trend',
            avg_ping: 'Avg Ping',
            packet_loss: 'Packet Loss',
            overview: 'Overview',
            latency_detail: 'Latency Detail',
            min_ping: 'Min Ping',
            max_ping: 'Max Ping',
            avg_latency: 'Avg Latency',
            tasks: 'Monitor Tasks',
            good_morning: 'Good Morning',
            good_afternoon: 'Good Afternoon',
            good_evening: 'Good Evening',
            welcome_back: 'Welcome back, everything is running smoothly',
            expired: 'Expired',
            long_term: 'Long Term'
        }
    };

    var state = {
        nodes: [],
        realtimeData: {},
        onlineNodes: [],
        publicSettings: {},
        themeSettings: {},
        currentView: 'grid',
        currentGroup: 'all',
        searchQuery: '',
        currentTheme: 'light',
        currentLang: 'zh-CN',
        ws: null,
        wsReconnectTimer: null,
        wsReconnectAttempts: 0,
        selectedNodeUuid: null,
        historyData: {},
        pingData: {},
        initialRender: true,
        modalElements: null,
        chartsDrawn: {},
        chartObserver: null
    };

    function t(key) {
        var lang = state.currentLang;
        var dict = i18n[lang] || i18n['en'];
        return dict[key] || i18n['en'][key] || key;
    }

    var THEME_MAP = {
        '浅色': 'light',
        '深色': 'dark',
        '跟随系统': 'system',
        'light': 'light',
        'dark': 'dark',
        'system': 'system'
    };

    var VIEW_MAP = {
        '网格': 'grid',
        '表格': 'table',
        'grid': 'grid',
        'table': 'table'
    };

    function formatBytes(bytes) {
        if (bytes === null || bytes === undefined) return '-';
        if (bytes === 0) return '0 B';
        var units = ['B', 'KB', 'MB', 'GB', 'TB'];
        var i = Math.floor(Math.log(bytes) / Math.log(1024));
        i = Math.min(i, units.length - 1);
        return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
    }

    function formatSpeed(bytesPerSec) {
        if (bytesPerSec === null || bytesPerSec === undefined) return '-';
        if (bytesPerSec === 0) return '0B/s';
        var units = ['B', 'K', 'M', 'G'];
        var i = Math.floor(Math.log(bytesPerSec) / Math.log(1024));
        i = Math.min(i, units.length - 1);
        return (bytesPerSec / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + units[i] + '/s';
    }

    function formatUptime(seconds) {
        if (!seconds || seconds <= 0) return '-';
        var d = Math.floor(seconds / 86400);
        var h = Math.floor((seconds % 86400) / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        if (d > 0) return d + t('days') + ' ' + h + t('hours');
        if (h > 0) return h + t('hours') + ' ' + m + t('minutes');
        if (m > 0) return m + t('minutes');
        return Math.floor(seconds) + t('seconds');
    }

    function formatExpiry(expiredAt) {
        if (!expiredAt) return null;
        var expiry = new Date(expiredAt);
        if (isNaN(expiry.getTime())) return null;
        var now = new Date();
        var diff = expiry - now;
        if (diff < 0) return { text: t('expired'), level: 'expired' };
        var days = Math.floor(diff / (1000 * 60 * 60 * 24));
        var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (days > 365) return { text: t('long_term'), level: 'normal' };
        if (days > 30) return { text: days + t('days'), level: 'normal' };
        if (days > 7) return { text: days + t('days'), level: 'warning' };
        if (days > 0) return { text: days + t('days') + ' ' + hours + t('hours'), level: 'danger' };
        if (hours > 0) return { text: hours + t('hours'), level: 'danger' };
        return { text: '<1' + t('hours'), level: 'danger' };
    }

    function formatPercent(value) {
        if (value === null || value === undefined) return '-';
        return value.toFixed(1) + '%';
    }

    function getUsageLevel(percent) {
        if (percent < 60) return 'normal';
        if (percent < 85) return 'warning';
        return 'danger';
    }

    function getApiBase() {
        return window.location.origin;
    }

    function getWsUrl() {
        var proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return proto + '//' + window.location.host + '/api/rpc2';
    }

    function fetchJson(url) {
        return fetch(url).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        });
    }

    function loadPublicSettings() {
        return fetchJson(getApiBase() + '/api/public').then(function (res) {
            if (res.status === 'success' && res.data) {
                state.publicSettings = res.data;
                state.themeSettings = res.data.theme_settings || {};
            }
        }).catch(function (err) {
            console.warn('Failed to load public settings:', err);
        });
    }

    function loadNodes() {
        return fetchJson(getApiBase() + '/api/nodes').then(function (res) {
            if (res.status === 'success' && res.data) {
                state.nodes = res.data.filter(function (n) { return !n.hidden; });
            }
        }).catch(function (err) {
            console.warn('Failed to load nodes:', err);
        });
    }

    function loadNodeHistory(uuid, hours) {
        hours = hours || 24;
        return fetchJson(getApiBase() + '/api/records/load?uuid=' + encodeURIComponent(uuid) + '&hours=' + hours)
            .then(function (res) {
                if (res.status === 'success' && res.data && res.data.records) {
                    state.historyData[uuid] = res.data.records;
                }
            }).catch(function (err) {
                console.warn('Failed to load history for', uuid, err);
            });
    }

    function loadPingHistory(uuid, hours) {
        hours = hours || 24;
        return fetchJson(getApiBase() + '/api/records/ping?uuid=' + encodeURIComponent(uuid) + '&hours=' + hours)
            .then(function (res) {
                if (res.status === 'success' && res.data) {
                    state.pingData[uuid] = {
                        records: res.data.records || [],
                        tasks: res.data.tasks || []
                    };
                }
            }).catch(function (err) {
                console.warn('Failed to load ping history for', uuid, err);
            });
    }

    function getLatestPing(uuid) {
        var pingInfo = state.pingData[uuid];
        if (!pingInfo || !pingInfo.records || pingInfo.records.length === 0) {
            return null;
        }
        var taskValues = {};
        pingInfo.records.forEach(function (r) {
            if (!taskValues[r.task_id]) {
                taskValues[r.task_id] = r.value;
            }
        });
        var values = Object.values(taskValues).filter(function (v) { return v !== null && v !== undefined; });
        if (values.length === 0) return null;
        var sum = values.reduce(function (a, b) { return a + b; }, 0);
        return sum / values.length;
    }

    function getPingTasks(uuid) {
        var pingInfo = state.pingData[uuid];
        if (!pingInfo || !pingInfo.tasks) return [];
        return pingInfo.tasks;
    }

    function getTaskLatestPing(uuid, taskId) {
        var pingInfo = state.pingData[uuid];
        if (!pingInfo || !pingInfo.records) return null;
        for (var i = pingInfo.records.length - 1; i >= 0; i--) {
            if (pingInfo.records[i].task_id === taskId) {
                return pingInfo.records[i].value;
            }
        }
        return null;
    }

    function getPingLevel(pingMs) {
        if (pingMs === null || pingMs === undefined) return 'normal';
        if (pingMs < 50) return 'excellent';
        if (pingMs < 100) return 'normal';
        if (pingMs < 300) return 'warning';
        return 'danger';
    }

    function formatPing(value) {
        if (value === null || value === undefined || value < 0) return '-';
        return value.toFixed(1) + t('ping_ms');
    }

    function getShortOs(os) {
        if (!os) return '-';
        var osLower = os.toLowerCase();
        if (osLower.indexOf('debian') !== -1) return 'Debian';
        if (osLower.indexOf('ubuntu') !== -1) return 'Ubuntu';
        if (osLower.indexOf('centos') !== -1) return 'CentOS';
        if (osLower.indexOf('rocky') !== -1) return 'Rocky';
        if (osLower.indexOf('almalinux') !== -1) return 'Alma';
        if (osLower.indexOf('fedora') !== -1) return 'Fedora';
        if (osLower.indexOf('arch') !== -1) return 'Arch';
        if (osLower.indexOf('alpine') !== -1) return 'Alpine';
        if (osLower.indexOf('windows') !== -1) return 'Windows';
        if (osLower.indexOf('macos') !== -1 || osLower.indexOf('darwin') !== -1) return 'macOS';
        if (osLower.indexOf('freebsd') !== -1) return 'FreeBSD';
        if (osLower.indexOf('opensuse') !== -1 || osLower.indexOf('suse') !== -1) return 'openSUSE';
        if (osLower.indexOf('raspbian') !== -1) return 'Raspbian';
        if (osLower.indexOf('oracle') !== -1) return 'Oracle';
        if (osLower.indexOf('red hat') !== -1 || osLower.indexOf('rhel') !== -1) return 'RHEL';
        var parts = os.split(' ');
        return parts[0] || os.substring(0, 12);
    }

    var COUNTRY_CODE_MAP = {
        'cn': 'cn', 'china': 'cn', '中国': 'cn', 'zh': 'cn',
        'hk': 'hk', 'hongkong': 'hk', 'hong kong': 'hk', '香港': 'hk',
        'tw': 'tw', 'taiwan': 'tw', '台湾': 'tw',
        'jp': 'jp', 'japan': 'jp', '日本': 'jp',
        'kr': 'kr', 'korea': 'kr', 'south korea': 'kr', '韩国': 'kr',
        'sg': 'sg', 'singapore': 'sg', '新加坡': 'sg',
        'us': 'us', 'usa': 'us', 'united states': 'us', '美国': 'us',
        'uk': 'gb', 'gb': 'gb', 'united kingdom': 'gb', '英国': 'gb',
        'de': 'de', 'germany': 'de', '德国': 'de',
        'fr': 'fr', 'france': 'fr', '法国': 'fr',
        'nl': 'nl', 'netherlands': 'nl', '荷兰': 'nl',
        'au': 'au', 'australia': 'au', '澳大利亚': 'au',
        'ca': 'ca', 'canada': 'ca', '加拿大': 'ca',
        'ru': 'ru', 'russia': 'ru', '俄罗斯': 'ru',
        'in': 'in', 'india': 'in', '印度': 'in',
        'br': 'br', 'brazil': 'br', '巴西': 'br',
        'it': 'it', 'italy': 'it', '意大利': 'it',
        'es': 'es', 'spain': 'es', '西班牙': 'es',
        'ch': 'ch', 'switzerland': 'ch', '瑞士': 'ch',
        'se': 'se', 'sweden': 'se', '瑞典': 'se',
        'no': 'no', 'norway': 'no', '挪威': 'no',
        'fi': 'fi', 'finland': 'fi', '芬兰': 'fi',
        'dk': 'dk', 'denmark': 'dk', '丹麦': 'dk',
        'pl': 'pl', 'poland': 'pl', '波兰': 'pl',
        'my': 'my', 'malaysia': 'my', '马来西亚': 'my',
        'th': 'th', 'thailand': 'th', '泰国': 'th',
        'vn': 'vn', 'vietnam': 'vn', '越南': 'vn',
        'id': 'id', 'indonesia': 'id', '印度尼西亚': 'id',
        'ph': 'ph', 'philippines': 'ph', '菲律宾': 'ph',
        'nz': 'nz', 'new zealand': 'nz', '新西兰': 'nz',
        'ie': 'ie', 'ireland': 'ie', '爱尔兰': 'ie',
        'at': 'at', 'austria': 'at', '奥地利': 'at',
        'be': 'be', 'belgium': 'be', '比利时': 'be',
        'pt': 'pt', 'portugal': 'pt', '葡萄牙': 'pt',
        'cz': 'cz', 'czech': 'cz', '捷克': 'cz',
        'ro': 'ro', 'romania': 'ro', '罗马尼亚': 'ro',
        'hu': 'hu', 'hungary': 'hu', '匈牙利': 'hu',
        'tr': 'tr', 'turkey': 'tr', '土耳其': 'tr',
        'sa': 'sa', 'saudi arabia': 'sa', '沙特': 'sa',
        'ae': 'ae', 'uae': 'ae', 'united arab emirates': 'ae', '阿联酋': 'ae',
        'il': 'il', 'israel': 'il', '以色列': 'il',
        'za': 'za', 'south africa': 'za', '南非': 'za',
        'ar': 'ar', 'argentina': 'ar', '阿根廷': 'ar',
        'mx': 'mx', 'mexico': 'mx', '墨西哥': 'mx',
        'cl': 'cl', 'chile': 'cl', '智利': 'cl',
        'co': 'co', 'colombia': 'co', '哥伦比亚': 'co',
        'pe': 'pe', 'peru': 'pe', '秘鲁': 'pe',
        'ua': 'ua', 'ukraine': 'ua', '乌克兰': 'ua',
        'kz': 'kz', 'kazakhstan': 'kz', '哈萨克斯坦': 'kz',
        'pk': 'pk', 'pakistan': 'pk', '巴基斯坦': 'pk',
        'bd': 'bd', 'bangladesh': 'bd', '孟加拉': 'bd',
        'eg': 'eg', 'egypt': 'eg', '埃及': 'eg',
        'ng': 'ng', 'nigeria': 'ng', '尼日利亚': 'ng',
        'ke': 'ke', 'kenya': 'ke', '肯尼亚': 'ke',
        'lu': 'lu', 'luxembourg': 'lu', '卢森堡': 'lu',
        'is': 'is', 'iceland': 'is', '冰岛': 'is',
        'sk': 'sk', 'slovakia': 'sk', '斯洛伐克': 'sk',
        'bg': 'bg', 'bulgaria': 'bg', '保加利亚': 'bg',
        'hr': 'hr', 'croatia': 'hr', '克罗地亚': 'hr',
        'rs': 'rs', 'serbia': 'rs', '塞尔维亚': 'rs',
        'si': 'si', 'slovenia': 'si', '斯洛文尼亚': 'si',
        'ee': 'ee', 'estonia': 'ee', '爱沙尼亚': 'ee',
        'lv': 'lv', 'latvia': 'lv', '拉脱维亚': 'lv',
        'lt': 'lt', 'lithuania': 'lt', '立陶宛': 'lt',
        'gr': 'gr', 'greece': 'gr', '希腊': 'gr',
        'cy': 'cy', 'cyprus': 'cy', '塞浦路斯': 'cy',
        'mt': 'mt', 'malta': 'mt', '马耳他': 'mt',
        'mo': 'mo', 'macau': 'mo', '澳门': 'mo'
    };

    function getCountryCode(region) {
        if (!region) return null;

        var code = region.toLowerCase().trim();

        if (COUNTRY_CODE_MAP[code]) return COUNTRY_CODE_MAP[code];

        for (var key in COUNTRY_CODE_MAP) {
            if (code.indexOf(key) !== -1) {
                return COUNTRY_CODE_MAP[key];
            }
        }

        if (region.length === 2 && /^[a-z]{2}$/i.test(region)) {
            return region.toLowerCase();
        }

        var emojiCode = parseFlagEmoji(region);
        if (emojiCode) return emojiCode;

        return null;
    }

    function parseFlagEmoji(emoji) {
        if (!emoji || emoji.length < 2) return null;

        var codePoints = [];
        for (var i = 0; i < emoji.length; i++) {
            var cp = emoji.codePointAt(i);
            if (cp >= 0x1F1E6 && cp <= 0x1F1FF) {
                codePoints.push(cp);
                if (cp > 0xFFFF) i++;
            }
        }

        if (codePoints.length >= 2) {
            var letter1 = String.fromCharCode(codePoints[0] - 0x1F1E6 + 65);
            var letter2 = String.fromCharCode(codePoints[1] - 0x1F1E6 + 65);
            return (letter1 + letter2).toLowerCase();
        }

        return null;
    }

    function getCountryFlagUrl(countryCode) {
        if (!countryCode) return null;
        return 'assets/flags/' + countryCode.toLowerCase() + '.svg';
    }

    function getCountryFlag(region) {
        var code = getCountryCode(region);
        if (!code) return null;
        return getCountryFlagUrl(code);
    }

    var rpcId = 0;
    var pollInterval = null;

    function connectWebSocket() {
        if (state.ws && (state.ws.readyState === WebSocket.CONNECTING || state.ws.readyState === WebSocket.OPEN)) {
            return;
        }

        try {
            state.ws = new WebSocket(getWsUrl());
        } catch (e) {
            console.warn('WebSocket creation failed:', e);
            scheduleReconnect();
            return;
        }

        state.ws.onopen = function () {
            state.wsReconnectAttempts = 0;
            requestNodesLatestStatus();
            startPolling();
        };

        state.ws.onmessage = function (event) {
            try {
                var msg = JSON.parse(event.data);
                if (msg.result) {
                    handleRpcResult(msg.result);
                } else if (msg.error) {
                    console.warn('RPC error:', msg.error);
                }
            } catch (e) {
                console.warn('WebSocket parse error:', e);
            }
        };

        state.ws.onclose = function () {
            stopPolling();
            scheduleReconnect();
        };

        state.ws.onerror = function () {
            if (state.ws) {
                state.ws.close();
            }
        };
    }

    function startPolling() {
        stopPolling();
        pollInterval = setInterval(function () {
            requestNodesLatestStatus();
        }, 1000);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    function requestNodesLatestStatus() {
        if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
        rpcId++;
        var request = {
            jsonrpc: '2.0',
            method: 'common:getNodesLatestStatus',
            params: {},
            id: rpcId
        };
        state.ws.send(JSON.stringify(request));
    }

    function handleRpcResult(result) {
        if (!result) return;
        
        var onlineNodes = [];
        var realtimeData = {};
        
        Object.keys(result).forEach(function (uuid) {
            var status = result[uuid];
            if (status.online) {
                onlineNodes.push(uuid);
            }
            realtimeData[uuid] = {
                cpu: status.cpu !== undefined ? { usage: status.cpu } : null,
                ram: status.ram !== undefined ? { used: status.ram, total: status.ram_total } : null,
                swap: status.swap !== undefined ? { used: status.swap, total: status.swap_total } : null,
                load: status.load !== undefined ? { load1: status.load, load5: status.load5, load15: status.load15 } : null,
                disk: status.disk !== undefined ? { used: status.disk, total: status.disk_total } : null,
                network: status.net_in !== undefined ? { up: status.net_out, down: status.net_in, totalUp: status.net_total_up, totalDown: status.net_total_down } : null,
                connections: status.connections !== undefined ? { tcp: status.connections, udp: status.connections_udp } : null,
                uptime: status.uptime || 0,
                process: status.process || 0
            };
        });
        
        state.onlineNodes = onlineNodes;
        state.realtimeData = realtimeData;
        renderAll();
    }

    function scheduleReconnect() {
        if (state.wsReconnectTimer) return;
        var delay = Math.min(1000 * Math.pow(2, state.wsReconnectAttempts), 30000);
        state.wsReconnectAttempts++;
        state.wsReconnectTimer = setTimeout(function () {
            state.wsReconnectTimer = null;
            connectWebSocket();
        }, delay);
    }

    function initTheme() {
        var saved = localStorage.getItem('appearance');
        var configDefault = state.themeSettings.default_theme;
        var preferred = 'system';

        if (configDefault) {
            preferred = THEME_MAP[configDefault] || configDefault;
        }

        var theme = saved || preferred;
        if (theme === 'system') {
            theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        state.currentTheme = theme;
        applyTheme(theme);

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
            var saved = localStorage.getItem('appearance');
            if (!saved || saved === 'system') {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    function applyTheme(theme) {
        state.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        var themeColor = theme === 'dark' ? '#0f0a15' : '#f8f6f9';
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', themeColor);
    }

    function toggleTheme() {
        var next = state.currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem('appearance', next);
    }

    function initLang() {
        var saved = localStorage.getItem('i18nextLng');
        if (saved && i18n[saved]) {
            state.currentLang = saved;
        } else {
            var browserLang = navigator.language || navigator.userLanguage || 'zh-CN';
            if (browserLang.startsWith('zh')) {
                state.currentLang = 'zh-CN';
            } else {
                state.currentLang = 'en';
            }
        }
        applyLang();
    }

    function applyLang() {
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var key = el.getAttribute('data-i18n');
            el.textContent = t(key);
        });
        var searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.placeholder = t('search_placeholder');
        }
    }

    function toggleLang() {
        state.currentLang = state.currentLang === 'zh-CN' ? 'en' : 'zh-CN';
        localStorage.setItem('i18nextLng', state.currentLang);
        applyLang();
        renderAll();
    }

    function initView() {
        var saved = localStorage.getItem('nodeViewMode');
        var configDefault = state.themeSettings.default_view;
        var mappedDefault = configDefault ? (VIEW_MAP[configDefault] || configDefault) : 'grid';
        state.currentView = saved || mappedDefault;
        applyView();
    }

    function applyView() {
        var grid = document.getElementById('nodesGrid');
        var table = document.getElementById('nodesTableContainer');
        var btns = document.querySelectorAll('.view-btn');

        if (state.currentView === 'grid') {
            if (grid) grid.style.display = '';
            if (table) table.style.display = 'none';
        } else {
            if (grid) grid.style.display = 'none';
            if (table) table.style.display = '';
        }

        btns.forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-view') === state.currentView);
        });
    }

    function setView(view) {
        state.currentView = view;
        localStorage.setItem('nodeViewMode', view);
        applyView();
    }

    function getGroups() {
        var groups = {};
        state.nodes.forEach(function (node) {
            var g = node.group || '';
            if (!groups[g]) groups[g] = 0;
            groups[g]++;
        });
        return groups;
    }

    function renderGroupFilter() {
        var container = document.getElementById('groupFilter');
        if (!container) return;

        var groups = getGroups();
        var savedGroup = localStorage.getItem('nodeSelectedGroup');
        if (savedGroup !== null && savedGroup !== undefined) {
            state.currentGroup = savedGroup;
        }

        var html = '<button class="filter-btn' + (state.currentGroup === 'all' ? ' active' : '') + '" data-group="all">' + t('all') + '</button>';

        var keys = Object.keys(groups).sort();
        keys.forEach(function (g) {
            var label = g || t('ungrouped');
            var isActive = state.currentGroup === g;
            html += '<button class="filter-btn' + (isActive ? ' active' : '') + '" data-group="' + escapeHtml(g) + '">' + escapeHtml(label) + '</button>';
        });

        container.innerHTML = html;

        container.querySelectorAll('.filter-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var group = this.getAttribute('data-group');
                state.currentGroup = group;
                localStorage.setItem('nodeSelectedGroup', group);
                renderGroupFilter();
                renderAll();
            });
        });
    }

    function getFilteredNodes() {
        var nodes = state.nodes;

        if (state.currentGroup !== 'all') {
            nodes = nodes.filter(function (n) {
                return (n.group || '') === state.currentGroup;
            });
        }

        if (state.searchQuery) {
            var q = state.searchQuery.toLowerCase();
            nodes = nodes.filter(function (n) {
                return n.name.toLowerCase().indexOf(q) !== -1 ||
                    (n.os || '').toLowerCase().indexOf(q) !== -1 ||
                    (n.cpu_name || '').toLowerCase().indexOf(q) !== -1 ||
                    (n.group || '').toLowerCase().indexOf(q) !== -1;
            });
        }

        nodes.sort(function (a, b) {
            var aOnline = state.onlineNodes.indexOf(a.uuid) !== -1;
            var bOnline = state.onlineNodes.indexOf(b.uuid) !== -1;
            if (aOnline !== bOnline) return aOnline ? -1 : 1;
            return (a.weight || 0) - (b.weight || 0);
        });

        return nodes;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderStatsBar() {
        var filtered = getFilteredNodes();
        var online = 0;
        filtered.forEach(function (n) {
            if (state.onlineNodes.indexOf(n.uuid) !== -1) online++;
        });

        var totalEl = document.getElementById('totalNodes');
        var onlineEl = document.getElementById('onlineNodes');
        var offlineEl = document.getElementById('offlineNodes');

        if (totalEl) totalEl.textContent = filtered.length;
        if (onlineEl) onlineEl.textContent = online;
        if (offlineEl) offlineEl.textContent = filtered.length - online;
        
        updateGreetingSubtitle();
    }

    function renderGrid() {
        var container = document.getElementById('nodesGrid');
        if (!container) return;

        var nodes = getFilteredNodes();

        if (nodes.length === 0) {
            container.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 15h8M9 9h.01M15 9h.01"/></svg><p>' + t('no_nodes') + '</p></div>';
            return;
        }

        var showUptime = state.themeSettings.show_uptime !== false;
        var showNetwork = state.themeSettings.show_network_speed !== false;
        var showPing = state.themeSettings.show_ping !== false;

        var html = '';
        nodes.forEach(function (node) {
            var isOnline = state.onlineNodes.indexOf(node.uuid) !== -1;
            var rt = state.realtimeData[node.uuid] || {};
            var cpuUsage = rt.cpu ? rt.cpu.usage : null;
            var ramUsed = rt.ram ? rt.ram.used : null;
            var ramTotal = rt.ram ? rt.ram.total : node.mem_total || 0;
            var ramPercent = (ramUsed !== null && ramTotal > 0) ? (ramUsed / ramTotal * 100) : null;
            var diskUsed = rt.disk ? rt.disk.used : null;
            var diskTotal = rt.disk ? rt.disk.total : node.disk_total || 0;
            var diskPercent = (diskUsed !== null && diskTotal > 0) ? (diskUsed / diskTotal * 100) : null;
            var swapUsed = rt.swap ? rt.swap.used : 0;
            var swapTotal = rt.swap ? rt.swap.total : node.swap_total || 0;
            var swapPercent = swapTotal > 0 ? (swapUsed / swapTotal * 100) : 0;
            var netUp = rt.network ? rt.network.up : 0;
            var netDown = rt.network ? rt.network.down : 0;
            var uptime = rt.uptime || 0;
            var pingMs = getLatestPing(node.uuid);
            var pingLevel = getPingLevel(pingMs);

            var cpuLevel = cpuUsage !== null ? getUsageLevel(cpuUsage) : 'normal';
            var ramLevel = ramPercent !== null ? getUsageLevel(ramPercent) : 'normal';
            var diskLevel = diskPercent !== null ? getUsageLevel(diskPercent) : 'normal';

            var flagUrl = getCountryFlag(node.region);
            var osShort = getShortOs(node.os);

            html += '<div class="node-card' + (isOnline ? '' : ' offline') + (state.initialRender ? ' animate-in' : '') + '" data-uuid="' + node.uuid + '">';
            html += '<div class="node-card-header">';
            if (flagUrl) {
                html += '<span class="node-card-flag"><img src="' + flagUrl + '" alt="' + escapeHtml(node.region || '') + '" loading="lazy" onerror="this.style.display=\'none\'"></span>';
            } else {
                html += '<span class="node-card-flag node-card-flag-placeholder"><span>?</span></span>';
            }
            html += '<div class="node-card-info">';
            html += '<div class="node-card-name">';
            html += '<span class="node-status-dot' + (isOnline ? '' : ' offline') + '"></span>';
            html += '<span class="node-name-text">' + escapeHtml(node.name) + '</span>';
            html += '</div>';
            html += '<div class="node-card-subtitle">';
            html += '<span class="node-card-os">' + escapeHtml(osShort) + '</span>';
            if (node.tags) {
                var tags = node.tags.split(';').filter(function(t) { return t.trim(); });
                var maxTags = 2;
                tags.slice(0, maxTags).forEach(function(tag) {
                    var tagText = tag.trim();
                    var tagClass = '';
                    var colorMatch = tagText.match(/<(\w+)>$/);
                    if (colorMatch) {
                        tagText = tagText.replace(/<\w+>$/, '').trim();
                        var color = colorMatch[1].toLowerCase();
                        var validColors = ['green', 'red', 'blue', 'yellow', 'orange', 'purple', 'pink', 'cyan', 'gray', 'success', 'danger', 'warning', 'info'];
                        if (validColors.indexOf(color) !== -1) {
                            tagClass = ' tag-' + color;
                        }
                    }
                    html += '<span class="node-api-tag' + tagClass + '">' + escapeHtml(tagText) + '</span>';
                });
            }
            html += '</div>';
            html += '</div>';
            html += '</div>';
            html += '<div class="node-card-metrics">';

            html += '<div class="metric">';
            html += '<div class="metric-label">CPU</div>';
            html += '<div class="metric-bar"><div class="metric-bar-fill level-' + cpuLevel + '" style="width:' + (cpuUsage !== null ? Math.min(cpuUsage, 100) : 0) + '%"></div></div>';
            html += '<div class="metric-value level-' + cpuLevel + '">' + (cpuUsage !== null ? formatPercent(cpuUsage) : '-') + '</div>';
            html += '</div>';

            html += '<div class="metric">';
            html += '<div class="metric-label">RAM</div>';
            html += '<div class="metric-bar"><div class="metric-bar-fill level-' + ramLevel + '" style="width:' + (ramPercent !== null ? Math.min(ramPercent, 100) : 0) + '%"></div></div>';
            html += '<div class="metric-value level-' + ramLevel + '">' + (ramPercent !== null ? formatPercent(ramPercent) : '-') + '</div>';
            html += '</div>';

            html += '<div class="metric">';
            html += '<div class="metric-label">Disk</div>';
            html += '<div class="metric-bar"><div class="metric-bar-fill level-' + diskLevel + '" style="width:' + (diskPercent !== null ? Math.min(diskPercent, 100) : 0) + '%"></div></div>';
            html += '<div class="metric-value level-' + diskLevel + '">' + (diskPercent !== null ? formatPercent(diskPercent) : '-') + '</div>';
            html += '</div>';

            if (swapTotal > 0) {
                var swapLevel = getUsageLevel(swapPercent);
                html += '<div class="metric">';
                html += '<div class="metric-label">Swap</div>';
                html += '<div class="metric-bar"><div class="metric-bar-fill level-' + swapLevel + '" style="width:' + Math.min(swapPercent, 100) + '%"></div></div>';
                html += '<div class="metric-value level-' + swapLevel + '">' + formatPercent(swapPercent) + '</div>';
                html += '</div>';
            } else {
                var load1 = rt.load ? rt.load.load1 : null;
                html += '<div class="metric">';
                html += '<div class="metric-label">Load</div>';
                html += '<div class="metric-value">' + (load1 !== null ? load1.toFixed(2) : '-') + '</div>';
                html += '</div>';
            }

            html += '</div>';

            html += '<div class="node-card-footer">';
            if (showUptime) {
                html += '<span class="node-uptime">' + formatUptime(uptime) + '</span>';
            }
            var expiry = formatExpiry(node.expired_at);
            if (expiry) {
                html += '<span class="node-expiry level-' + expiry.level + '">' + expiry.text + '</span>';
            }
            if (showNetwork) {
                html += '<span class="node-network">';
                html += '<span class="network-dir"><span class="arrow-up">&#9650;</span>' + formatSpeed(netUp) + '</span>';
                html += '<span class="network-dir"><span class="arrow-down">&#9660;</span>' + formatSpeed(netDown) + '</span>';
                html += '</span>';
            }
            html += '</div>';

            html += '</div>';
        });

        container.innerHTML = html;

        container.querySelectorAll('.node-card').forEach(function (card) {
            card.addEventListener('click', function () {
                var uuid = this.getAttribute('data-uuid');
                openNodeModal(uuid);
            });
        });
    }

    function renderTable() {
        var tbody = document.getElementById('nodesTableBody');
        if (!tbody) return;

        var nodes = getFilteredNodes();

        if (nodes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-tertiary)">' + t('no_nodes') + '</td></tr>';
            return;
        }

        var html = '';
        nodes.forEach(function (node) {
            var isOnline = state.onlineNodes.indexOf(node.uuid) !== -1;
            var rt = state.realtimeData[node.uuid] || {};
            var cpuUsage = rt.cpu ? rt.cpu.usage : null;
            var ramUsed = rt.ram ? rt.ram.used : null;
            var ramTotal = rt.ram ? rt.ram.total : node.mem_total || 0;
            var ramPercent = (ramUsed !== null && ramTotal > 0) ? (ramUsed / ramTotal * 100) : null;
            var diskUsed = rt.disk ? rt.disk.used : null;
            var diskTotal = rt.disk ? rt.disk.total : node.disk_total || 0;
            var diskPercent = (diskUsed !== null && diskTotal > 0) ? (diskUsed / diskTotal * 100) : null;
            var netUp = rt.network ? rt.network.up : 0;
            var netDown = rt.network ? rt.network.down : 0;
            var uptime = rt.uptime || 0;
            var pingMs = getLatestPing(node.uuid);
            var pingLevel = getPingLevel(pingMs);

            var cpuLevel = cpuUsage !== null ? getUsageLevel(cpuUsage) : 'normal';
            var ramLevel = ramPercent !== null ? getUsageLevel(ramPercent) : 'normal';
            var diskLevel = diskPercent !== null ? getUsageLevel(diskPercent) : 'normal';

            var tableFlagUrl = getCountryFlag(node.region);

            html += '<tr data-uuid="' + node.uuid + '">';
            html += '<td><span class="table-status"><span class="node-status-dot' + (isOnline ? '' : ' offline') + '"></span>' + (isOnline ? t('online') : t('offline')) + '</span></td>';
            html += '<td><span class="table-name">' + escapeHtml(node.name) + '</span></td>';
            html += '<td><span class="table-region">' + (tableFlagUrl ? '<img src="' + tableFlagUrl + '" alt="' + escapeHtml(node.region || '') + '" class="table-flag" loading="lazy" onerror="this.style.display=\'none\'">' : '<span class="table-flag-placeholder">?</span>') + '</span></td>';
            html += '<td><span class="table-metric"><span class="table-metric-bar"><span class="table-metric-bar-fill level-' + cpuLevel + '" style="width:' + (cpuUsage !== null ? Math.min(cpuUsage, 100) : 0) + '%"></span></span><span class="table-metric-value level-' + cpuLevel + '">' + (cpuUsage !== null ? formatPercent(cpuUsage) : '-') + '</span></span></td>';
            html += '<td><span class="table-metric"><span class="table-metric-bar"><span class="table-metric-bar-fill level-' + ramLevel + '" style="width:' + (ramPercent !== null ? Math.min(ramPercent, 100) : 0) + '%"></span></span><span class="table-metric-value level-' + ramLevel + '">' + (ramPercent !== null ? formatPercent(ramPercent) : '-') + '</span></span></td>';
            html += '<td><span class="table-metric"><span class="table-metric-bar"><span class="table-metric-bar-fill level-' + diskLevel + '" style="width:' + (diskPercent !== null ? Math.min(diskPercent, 100) : 0) + '%"></span></span><span class="table-metric-value level-' + diskLevel + '">' + (diskPercent !== null ? formatPercent(diskPercent) : '-') + '</span></span></td>';
            html += '<td><span class="table-network"><span class="arrow-up" style="color:var(--success)">&#9650;</span>' + formatSpeed(netUp) + ' <span class="arrow-down" style="color:var(--info)">&#9660;</span>' + formatSpeed(netDown) + '</span></td>';
            html += '<td><span class="table-ping level-' + pingLevel + '">' + formatPing(pingMs) + '</span></td>';
            html += '<td><span class="table-uptime">' + formatUptime(uptime) + '</span></td>';
            html += '</tr>';
        });

        tbody.innerHTML = html;

        tbody.querySelectorAll('tr[data-uuid]').forEach(function (row) {
            row.addEventListener('click', function () {
                var uuid = this.getAttribute('data-uuid');
                openNodeModal(uuid);
            });
        });
    }

    function renderAll() {
        renderStatsBar();
        renderGrid();
        renderTable();
        if (state.initialRender) {
            state.initialRender = false;
        }
    }

    function getModalElements() {
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
                latencyChart: document.getElementById('latencyChart')
            };
        }
        return state.modalElements;
    }

    function initChartObserver() {
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
                            }
                        } else {
                            var records = state.historyData[uuid] || [];
                            if (records.length > 0) {
                                if (chartId === 'cpuChart') {
                                    drawLineChart('cpuChart', records, function (r) { return r.cpu; }, 0, 100, '#e8668a', 'CPU %');
                                } else if (chartId === 'ramChart') {
                                    drawLineChart('ramChart', records, function (r) {
                                        var ramVal = r.ram;
                                        if (ramVal === null || ramVal === undefined) return null;
                                        if (ramVal > 100 && r.ram_total > 0) {
                                            return (ramVal / r.ram_total) * 100;
                                        }
                                        return ramVal;
                                    }, 0, 100, '#5c9ced', 'RAM %');
                                } else if (chartId === 'networkChart') {
                                    drawNetworkChart('networkChart', records);
                                }
                                state.chartsDrawn[uuid + '_' + chartId] = true;
                            }
                        }
                    }
                }
            });
        }, {
            rootMargin: '50px',
            threshold: 0.1
        });
    }

    function openNodeModal(uuid) {
        state.selectedNodeUuid = uuid;
        state.chartsDrawn = {};
        
        var node = state.nodes.find(function (n) { return n.uuid === uuid; });
        if (!node) return;

        var rt = state.realtimeData[uuid] || {};
        var els = getModalElements();

        if (els.nodeName) els.nodeName.textContent = node.name;

        switchModalPage('overview');
        renderOverviewPage(node, rt, uuid);

        if (els.overlay) {
            els.overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        initChartObserver();

        Promise.all([
            loadNodeHistory(uuid),
            loadPingHistory(uuid, 1)
        ]).then(function () {
            renderLatencyPage(uuid);
            
            [els.cpuChart, els.ramChart, els.networkChart, els.latencyChart].forEach(function(canvas) {
                if (canvas) {
                    canvas.classList.add('chart-loading');
                    state.chartObserver.observe(canvas);
                }
            });
        });
    }

    function renderOverviewPage(node, rt, uuid) {
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
            buildInfoItem(t('network'), t('up') + ': ' + formatBytes(netTotalUp) + ' / ' + t('down') + ': ' + formatBytes(netTotalDown))
        ];

        infoEl.innerHTML = items.join('');
    }

    function renderLatencyPage(uuid) {
        var pingInfo = state.pingData[uuid];
        if (!pingInfo) return;

        var els = getModalElements();
        var summaryEl = els.latencySummary;
        var tasksEl = els.latencyTasks;
        var legendEl = els.latencyLegend;

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

    function drawLatencyChart(canvasId, records, tasks) {
        var els = getModalElements();
        var canvas = canvasId === 'latencyChart' ? els.latencyChart : document.getElementById(canvasId);
        if (!canvas || !records || records.length === 0) return;

        var ctx = canvas.getContext('2d');
        var dpr = window.devicePixelRatio || 1;
        var rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        var w = rect.width;
        var h = rect.height;
        var padding = { top: 10, right: 20, bottom: 30, left: 50 };
        var chartW = w - padding.left - padding.right;
        var chartH = h - padding.top - padding.bottom;

        ctx.clearRect(0, 0, w, h);

        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        var gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        var textColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';

        var validValues = records.filter(function (r) { return r.value !== null && r.value !== undefined && !isNaN(r.value) && r.value >= 0; }).map(function (r) { return r.value; });
        var maxVal = validValues.length > 0 ? Math.max(Math.max.apply(null, validValues), 100) : 100;
        maxVal = Math.ceil(maxVal / 50) * 50;

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.font = '10px ' + getComputedStyle(document.body).fontFamily;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'right';

        for (var i = 0; i <= 4; i++) {
            var y = padding.top + (chartH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();
            ctx.fillText((maxVal * (1 - i / 4)).toFixed(0) + t('ping_ms'), padding.left - 6, y + 3);
        }

        var taskMap = {};
        tasks.forEach(function (task) { taskMap[task.id] = task; });

        var taskRecords = {};
        records.forEach(function (r) {
            if (!taskRecords[r.task_id]) taskRecords[r.task_id] = [];
            taskRecords[r.task_id].push(r);
        });

        var taskIds = Object.keys(taskRecords);
        var colorIdx = 0;

        taskIds.forEach(function (taskId) {
            var taskRecs = taskRecords[taskId];
            var values = taskRecs.map(function (r) { return r.value; });
            var color = PING_COLORS[colorIdx % PING_COLORS.length];
            colorIdx++;

            var points = [];
            for (var j = 0; j < values.length; j++) {
                if (values[j] === null || values[j] === undefined || isNaN(values[j]) || values[j] < 0) continue;
                var x = padding.left + (j / Math.max(values.length - 1, 1)) * chartW;
                var normalized = values[j] / maxVal;
                normalized = Math.max(0, Math.min(1, normalized));
                var y = padding.top + chartH - normalized * chartH;
                points.push({ x: x, y: y });
            }

            if (points.length > 1) {
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (var k = 1; k < points.length; k++) {
                    ctx.lineTo(points[k].x, points[k].y);
                }
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.lineJoin = 'round';
                ctx.stroke();
            }
        });

        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        var firstTaskRecs = taskRecords[taskIds[0]] || records;
        var timeLabels = 6;
        for (var ti = 0; ti <= timeLabels; ti++) {
            var idx = Math.floor((firstTaskRecs.length - 1) * ti / timeLabels);
            var x = padding.left + (ti / timeLabels) * chartW;
            var time = new Date(firstTaskRecs[idx].time);
            ctx.fillText(time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0'), x, h - 10);
        }

        canvas._chartData = {
            type: 'ping',
            records: records,
            tasks: tasks,
            taskRecords: taskRecords,
            taskMap: taskMap,
            maxVal: maxVal,
            padding: padding
        };

        canvas.onmousemove = function(e) {
            showChartTooltip(e, canvas, canvas._chartData);
        };
        canvas.onmouseleave = createHideHandler(canvas);
    }

    function switchModalPage(pageName) {
        var pages = document.querySelectorAll('.modal-page');
        var tabs = document.querySelectorAll('.modal-tab');

        pages.forEach(function (page) {
            if (page.id === 'page' + pageName.charAt(0).toUpperCase() + pageName.slice(1)) {
                page.classList.remove('slide-out');
                page.classList.add('active');
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

    function buildInfoItem(label, value) {
        return '<div class="modal-info-item"><div class="modal-info-label">' + escapeHtml(label) + '</div><div class="modal-info-value">' + escapeHtml(value) + '</div></div>';
    }

    function closeModal() {
        var els = getModalElements();
        if (els.overlay) {
            els.overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
        
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
            [els.cpuChart, els.ramChart, els.networkChart, els.latencyChart].forEach(function(canvas) {
                if (canvas) {
                    state.chartObserver.unobserve(canvas);
                    canvas.classList.remove('chart-loading');
                }
            });
        }
        
        state.selectedNodeUuid = null;
        state.chartsDrawn = {};
        switchModalPage('overview');
    }

    function drawCharts(uuid) {
        var records = state.historyData[uuid] || [];
        if (records.length === 0) return;

        drawLineChart('cpuChart', records, function (r) { return r.cpu; }, 0, 100, '#e8668a', 'CPU %');
        drawLineChart('ramChart', records, function (r) {
            var ramVal = r.ram;
            if (ramVal === null || ramVal === undefined) return null;
            if (ramVal > 100 && r.ram_total > 0) {
                return (ramVal / r.ram_total) * 100;
            }
            return ramVal;
        }, 0, 100, '#5c9ced', 'RAM %');
        drawNetworkChart('networkChart', records);
    }

    var PING_COLORS = ['#e8668a', '#5c9ced', '#4caf7d', '#f5a623', '#9c5ce0', '#00bcd4', '#ff5722', '#795548'];

    function drawPingChart(canvasId, records, tasks) {
        var canvas = document.getElementById(canvasId);
        if (!canvas) return;

        var ctx = canvas.getContext('2d');
        var dpr = window.devicePixelRatio || 1;
        var rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        var w = rect.width;
        var h = rect.height;
        var padding = { top: 20, right: 16, bottom: 30, left: 50 };
        var chartW = w - padding.left - padding.right;
        var chartH = h - padding.top - padding.bottom;

        ctx.clearRect(0, 0, w, h);

        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        var gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        var textColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';

        var validValues = records.filter(function (r) { return r.value !== null && r.value !== undefined && r.value >= 0; }).map(function (r) { return r.value; });
        var maxVal = validValues.length > 0 ? Math.max(Math.max.apply(null, validValues), 100) : 100;
        maxVal = Math.ceil(maxVal / 50) * 50;

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.font = '10px ' + getComputedStyle(document.body).fontFamily;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'right';

        for (var i = 0; i <= 4; i++) {
            var y = padding.top + (chartH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();
            ctx.fillText((maxVal * (1 - i / 4)).toFixed(0) + t('ping_ms'), padding.left - 6, y + 3);
        }

        var taskMap = {};
        tasks.forEach(function (task) { taskMap[task.id] = task; });

        var taskRecords = {};
        records.forEach(function (r) {
            if (!taskRecords[r.task_id]) taskRecords[r.task_id] = [];
            taskRecords[r.task_id].push(r);
        });

        var taskIds = Object.keys(taskRecords);
        var colorIdx = 0;

        taskIds.forEach(function (taskId) {
            var taskRecs = taskRecords[taskId];
            var values = taskRecs.map(function (r) { return r.value; });
            var color = PING_COLORS[colorIdx % PING_COLORS.length];
            colorIdx++;

            var points = [];
            for (var j = 0; j < values.length; j++) {
                if (values[j] === null || values[j] === undefined || isNaN(values[j]) || values[j] < 0) continue;
                var x = padding.left + (j / Math.max(values.length - 1, 1)) * chartW;
                var normalized = values[j] / maxVal;
                normalized = Math.max(0, Math.min(1, normalized));
                var y = padding.top + chartH - normalized * chartH;
                points.push({ x: x, y: y });
            }

            if (points.length > 1) {
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (var k = 1; k < points.length; k++) {
                    ctx.lineTo(points[k].x, points[k].y);
                }
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.lineJoin = 'round';
                ctx.stroke();
            }
        });

        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        var firstTaskRecs = taskRecords[taskIds[0]] || records;
        var timeLabels = 5;
        for (var ti = 0; ti <= timeLabels; ti++) {
            var idx = Math.floor((firstTaskRecs.length - 1) * ti / timeLabels);
            var x = padding.left + (ti / timeLabels) * chartW;
            var time = new Date(firstTaskRecs[idx].time);
            ctx.fillText(time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0'), x, h - 8);
        }

        if (tasks.length > 0) {
            ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
            ctx.textAlign = 'left';
            var legendX = padding.left + 10;
            tasks.forEach(function (task, idx) {
                var color = PING_COLORS[idx % PING_COLORS.length];
                ctx.fillStyle = color;
                ctx.fillRect(legendX, padding.top + 4, 12, 3);
                ctx.fillStyle = textColor;
                ctx.fillText(task.name, legendX + 16, padding.top + 10);
                legendX += ctx.measureText(task.name).width + 30;
            });
        }

        canvas._chartData = {
            type: 'ping',
            records: records,
            tasks: tasks,
            taskRecords: taskRecords,
            taskMap: taskMap,
            maxVal: maxVal,
            padding: padding
        };

        canvas.onmousemove = function(e) {
            showChartTooltip(e, canvas, canvas._chartData);
        };
        canvas.onmouseleave = createHideHandler(canvas);
    }

    var chartTooltip = null;

    function getOrCreateTooltip() {
        if (!chartTooltip) {
            chartTooltip = document.createElement('div');
            chartTooltip.className = 'chart-tooltip';
            document.body.appendChild(chartTooltip);
        }
        return chartTooltip;
    }

    function showChartTooltip(e, canvas, chartData) {
        var tooltip = getOrCreateTooltip();
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;

        var padding = chartData.padding;
        var chartW = rect.width - padding.left - padding.right;
        var chartH = rect.height - padding.top - padding.bottom;

        if (x < padding.left || x > rect.width - padding.right || y < padding.top || y > rect.height - padding.bottom) {
            tooltip.classList.remove('visible');
            if (canvas._crosshair) {
                canvas._crosshair.style.display = 'none';
            }
            return;
        }

        var ratio = (x - padding.left) / chartW;
        var idx = Math.round(ratio * (chartData.records.length - 1));
        idx = Math.max(0, Math.min(idx, chartData.records.length - 1));

        var record = chartData.records[idx];
        if (!record) {
            tooltip.classList.remove('visible');
            return;
        }

        var crosshair = canvas._crosshair;
        if (!crosshair) {
            crosshair = document.createElement('div');
            crosshair.className = 'chart-crosshair';
            crosshair.style.cssText = 'position:absolute;pointer-events:none;display:none;z-index:10;';
            var chartSection = canvas.closest('.chart-section');
            if (chartSection) {
                chartSection.style.position = 'relative';
                chartSection.appendChild(crosshair);
            } else {
                canvas.parentElement.style.position = 'relative';
                canvas.parentElement.appendChild(crosshair);
            }
            canvas._crosshair = crosshair;
        }

        var canvasOffsetLeft = canvas.offsetLeft || 0;
        var canvasOffsetTop = canvas.offsetTop || 0;

        var pointX = canvasOffsetLeft + padding.left + (idx / Math.max(chartData.records.length - 1, 1)) * chartW;
        crosshair.style.display = 'block';
        crosshair.style.left = pointX + 'px';
        crosshair.style.top = (canvasOffsetTop + padding.top) + 'px';
        crosshair.style.width = '1px';
        crosshair.style.height = chartH + 'px';
        crosshair.style.background = 'var(--accent)';
        crosshair.style.opacity = '0.5';

        var time = new Date(record.time);
        var timeStr = time.getHours().toString().padStart(2, '0') + ':' +
                      time.getMinutes().toString().padStart(2, '0') + ':' +
                      time.getSeconds().toString().padStart(2, '0');

        var html = '<div class="chart-tooltip-time">' + timeStr + '</div>';

        if (chartData.type === 'line') {
            var val = chartData.valueFn(record);
            if (val !== null && val !== undefined && !isNaN(val)) {
                html += '<div class="chart-tooltip-value" style="color:' + chartData.color + '">' + chartData.label + ': <strong>' + val.toFixed(1) + '%</strong></div>';
            }
        } else if (chartData.type === 'network') {
            var netIn = record.net_in || 0;
            var netOut = record.net_out || 0;
            html += '<div class="chart-tooltip-value" style="color: #4caf7d">▲ ' + t('up') + ': <strong>' + formatSpeed(netOut) + '</strong></div>';
            html += '<div class="chart-tooltip-value" style="color: #5c9ced">▼ ' + t('down') + ': <strong>' + formatSpeed(netIn) + '</strong></div>';
        } else if (chartData.type === 'ping') {
            var taskRecords = chartData.taskRecords;
            var taskMap = chartData.taskMap;
            var taskIds = Object.keys(taskRecords);
            taskIds.forEach(function (taskId, colorIdx) {
                var taskRecs = taskRecords[taskId];
                var task = taskMap[taskId];
                if (taskRecs && taskRecs.length > 0) {
                    var recIdx = Math.round(ratio * (taskRecs.length - 1));
                    recIdx = Math.max(0, Math.min(recIdx, taskRecs.length - 1));
                    var taskRec = taskRecs[recIdx];
                    if (taskRec && taskRec.value !== null && taskRec.value !== undefined && taskRec.value >= 0) {
                        var color = PING_COLORS[colorIdx % PING_COLORS.length];
                        html += '<div class="chart-tooltip-value" style="color: ' + color + '">' + escapeHtml(task.name) + ': <strong>' + taskRec.value.toFixed(1) + t('ping_ms') + '</strong></div>';
                    }
                }
            });
        }

        tooltip.innerHTML = html;
        var tooltipRect = tooltip.getBoundingClientRect();
        var tooltipWidth = tooltipRect.width || 140;
        var tooltipHeight = tooltipRect.height || 60;
        
        var leftPos = e.clientX - tooltipWidth - 16;
        if (leftPos < 10) leftPos = e.clientX + 16;
        
        var topPos = e.clientY - tooltipHeight - 12;
        if (topPos < 10) topPos = e.clientY + 16;
        
        tooltip.style.left = leftPos + 'px';
        tooltip.style.top = topPos + 'px';
        tooltip.classList.add('visible');
    }

    function hideChartTooltip(canvas) {
        var tooltip = getOrCreateTooltip();
        tooltip.classList.remove('visible');
        if (canvas && canvas._crosshair) {
            canvas._crosshair.style.display = 'none';
        }
    }

    function createHideHandler(canvas) {
        return function() {
            hideChartTooltip(canvas);
        };
    }

    function drawLineChart(canvasId, records, valueFn, minVal, maxVal, color, label) {
        var canvas = document.getElementById(canvasId);
        if (!canvas) return;

        var ctx = canvas.getContext('2d');
        var dpr = window.devicePixelRatio || 1;
        var rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        var w = rect.width;
        var h = rect.height;
        var padding = { top: 24, right: 20, bottom: 32, left: 50 };
        var chartW = w - padding.left - padding.right;
        var chartH = h - padding.top - padding.bottom;

        ctx.clearRect(0, 0, w, h);

        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        var gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
        var textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
        var bgColor = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)';

        ctx.fillStyle = bgColor;
        ctx.fillRect(padding.left, padding.top, chartW, chartH);

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'right';

        for (var i = 0; i <= 4; i++) {
            var y = padding.top + (chartH / 4) * i;
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();
            ctx.setLineDash([]);

            var val = maxVal - (maxVal - minVal) * (i / 4);
            ctx.fillText(val.toFixed(0) + '%', padding.left - 8, y + 4);
        }

        var values = records.map(valueFn);
        var validPoints = [];
        for (var j = 0; j < values.length; j++) {
            if (values[j] === null || values[j] === undefined || isNaN(values[j])) continue;
            var x = padding.left + (j / Math.max(values.length - 1, 1)) * chartW;
            var normalized = (values[j] - minVal) / (maxVal - minVal);
            normalized = Math.max(0, Math.min(1, normalized));
            var y = padding.top + chartH - normalized * chartH;
            validPoints.push({ x: x, y: y, value: values[j] });
        }

        if (validPoints.length > 1) {
            ctx.beginPath();
            ctx.moveTo(validPoints[0].x, validPoints[0].y);
            
            for (var k = 1; k < validPoints.length; k++) {
                var prev = validPoints[k - 1];
                var curr = validPoints[k];
                var cpx = (prev.x + curr.x) / 2;
                ctx.quadraticCurveTo(prev.x + (curr.x - prev.x) * 0.5, prev.y, cpx, (prev.y + curr.y) / 2);
                ctx.quadraticCurveTo(cpx, curr.y, curr.x, curr.y);
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.stroke();

            ctx.lineTo(validPoints[validPoints.length - 1].x, padding.top + chartH);
            ctx.lineTo(validPoints[0].x, padding.top + chartH);
            ctx.closePath();

            var gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
            gradient.addColorStop(0, color + '40');
            gradient.addColorStop(0.5, color + '15');
            gradient.addColorStop(1, color + '02');
            ctx.fillStyle = gradient;
            ctx.fill();

            validPoints.forEach(function(point, idx) {
                if (idx % Math.ceil(validPoints.length / 20) === 0 || idx === validPoints.length - 1) {
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 1.5, 0, Math.PI * 2);
                    ctx.fillStyle = isDark ? '#1a1a2e' : '#fff';
                    ctx.fill();
                }
            });
        }

        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.font = '10px ' + getComputedStyle(document.body).fontFamily;
        var timeLabels = Math.min(6, Math.floor(chartW / 60));
        for (var ti = 0; ti <= timeLabels; ti++) {
            var idx = Math.floor((records.length - 1) * ti / timeLabels);
            var x = padding.left + (ti / timeLabels) * chartW;
            var time = new Date(records[idx].time);
            ctx.fillText(time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0'), x, h - 10);
        }

        canvas._chartData = {
            type: 'line',
            records: records,
            valueFn: valueFn,
            label: label,
            padding: padding,
            validPoints: validPoints,
            color: color
        };

        canvas.onmousemove = function(e) {
            showChartTooltip(e, canvas, canvas._chartData);
        };
        canvas.onmouseleave = createHideHandler(canvas);
        
        canvas.ontouchmove = function(e) {
            if (e.touches.length === 1) {
                var touch = e.touches[0];
                showChartTooltip({ clientX: touch.clientX, clientY: touch.clientY }, canvas, canvas._chartData);
            }
        };
        canvas.ontouchend = createHideHandler(canvas);
    }

    function drawNetworkChart(canvasId, records) {
        var canvas = document.getElementById(canvasId);
        if (!canvas) return;

        var ctx = canvas.getContext('2d');
        var dpr = window.devicePixelRatio || 1;
        var rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        var w = rect.width;
        var h = rect.height;
        var padding = { top: 24, right: 20, bottom: 32, left: 60 };
        var chartW = w - padding.left - padding.right;
        var chartH = h - padding.top - padding.bottom;

        ctx.clearRect(0, 0, w, h);

        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        var gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
        var textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
        var bgColor = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)';

        ctx.fillStyle = bgColor;
        ctx.fillRect(padding.left, padding.top, chartW, chartH);

        var upValues = records.map(function (r) { return r.net_out || 0; });
        var downValues = records.map(function (r) { return r.net_in || 0; });
        var maxVal = Math.max(Math.max.apply(null, upValues), Math.max.apply(null, downValues), 1024);
        maxVal = Math.ceil(maxVal / 1024) * 1024;

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'right';

        for (var i = 0; i <= 4; i++) {
            var y = padding.top + (chartH / 4) * i;
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillText(formatSpeed(maxVal * (1 - i / 4)), padding.left - 8, y + 4);
        }

        function drawSmoothLine(values, color) {
            var points = [];
            for (var j = 0; j < values.length; j++) {
                if (values[j] === null || values[j] === undefined || isNaN(values[j])) continue;
                var x = padding.left + (j / Math.max(values.length - 1, 1)) * chartW;
                var normalized = values[j] / maxVal;
                normalized = Math.max(0, Math.min(1, normalized));
                var y = padding.top + chartH - normalized * chartH;
                points.push({ x: x, y: y, value: values[j] });
            }

            if (points.length > 1) {
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                
                for (var k = 1; k < points.length; k++) {
                    var prev = points[k - 1];
                    var curr = points[k];
                    var cpx = (prev.x + curr.x) / 2;
                    ctx.quadraticCurveTo(prev.x + (curr.x - prev.x) * 0.5, prev.y, cpx, (prev.y + curr.y) / 2);
                    ctx.quadraticCurveTo(cpx, curr.y, curr.x, curr.y);
                }

                ctx.strokeStyle = color;
                ctx.lineWidth = 2.5;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.stroke();

                ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
                ctx.lineTo(points[0].x, padding.top + chartH);
                ctx.closePath();

                var gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
                gradient.addColorStop(0, color + '35');
                gradient.addColorStop(0.5, color + '12');
                gradient.addColorStop(1, color + '02');
                ctx.fillStyle = gradient;
                ctx.fill();
            }
            return points;
        }

        var upPoints = drawSmoothLine(upValues, '#4caf7d');
        var downPoints = drawSmoothLine(downValues, '#5c9ced');

        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.font = '10px ' + getComputedStyle(document.body).fontFamily;
        var timeLabels = Math.min(6, Math.floor(chartW / 60));
        for (var ti = 0; ti <= timeLabels; ti++) {
            var idx = Math.floor((records.length - 1) * ti / timeLabels);
            var x = padding.left + (ti / timeLabels) * chartW;
            var time = new Date(records[idx].time);
            ctx.fillText(time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0'), x, h - 10);
        }

        canvas._chartData = {
            type: 'network',
            records: records,
            padding: padding,
            upPoints: upPoints,
            downPoints: downPoints
        };

        canvas.onmousemove = function(e) {
            showChartTooltip(e, canvas, canvas._chartData);
        };
        canvas.onmouseleave = createHideHandler(canvas);
        
        canvas.ontouchmove = function(e) {
            if (e.touches.length === 1) {
                var touch = e.touches[0];
                showChartTooltip({ clientX: touch.clientX, clientY: touch.clientY }, canvas, canvas._chartData);
            }
        };
        canvas.ontouchend = createHideHandler(canvas);
    }

    function applyThemeSettings() {
        var customFooter = state.themeSettings.custom_footer;
        var footerEl = document.getElementById('customFooter');
        if (footerEl && customFooter) {
            footerEl.textContent = customFooter;
        }

        var iconBounce = state.themeSettings.icon_bounce !== false;
        var greetingIcon = document.querySelector('.greeting-icon');
        if (greetingIcon) {
            if (!iconBounce) {
                greetingIcon.classList.add('no-bounce');
            } else {
                greetingIcon.classList.remove('no-bounce');
            }
        }
    }

    function bindEvents() {
        var themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
        }

        var langToggle = document.getElementById('langToggle');
        if (langToggle) {
            langToggle.addEventListener('click', toggleLang);
        }

        document.querySelectorAll('.view-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                setView(this.getAttribute('data-view'));
            });
        });

        var searchInput = document.getElementById('searchInput');
        if (searchInput) {
            var searchTimer = null;
            searchInput.addEventListener('input', function () {
                clearTimeout(searchTimer);
                var val = this.value;
                searchTimer = setTimeout(function () {
                    state.searchQuery = val;
                    renderAll();
                }, 200);
            });
        }

        var modalClose = document.getElementById('modalClose');
        if (modalClose) {
            modalClose.addEventListener('click', closeModal);
        }

        var modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', function (e) {
                if (e.target === this) closeModal();
            });
        }

        document.querySelectorAll('.modal-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                var pageName = this.getAttribute('data-tab');
                switchModalPage(pageName);
            });
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeModal();
        });

        initModalDragScroll();

        window.addEventListener('resize', function () {
            if (state.selectedNodeUuid && state.historyData[state.selectedNodeUuid]) {
                drawCharts(state.selectedNodeUuid);
            }
        });
    }

    function initModalDragScroll() {
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

    function loadAllPingData() {
        var promises = state.nodes.map(function (node) {
            return loadPingHistory(node.uuid, 1);
        });
        return Promise.all(promises);
    }

    function updateTime() {
        var now = new Date();
        var hours = now.getHours();
        var greeting = '';
        
        if (hours >= 5 && hours < 12) {
            greeting = i18n[state.currentLang] && i18n[state.currentLang].good_morning ? i18n[state.currentLang].good_morning : '早上好';
        } else if (hours >= 12 && hours < 18) {
            greeting = i18n[state.currentLang] && i18n[state.currentLang].good_afternoon ? i18n[state.currentLang].good_afternoon : '下午好';
        } else {
            greeting = i18n[state.currentLang] && i18n[state.currentLang].good_evening ? i18n[state.currentLang].good_evening : '晚上好';
        }
        
        var greetingEl = document.getElementById('greetingText');
        if (greetingEl) greetingEl.textContent = greeting;
        
        updateGreetingSubtitle();
        
        var dateOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        var dateStr = now.toLocaleDateString(state.currentLang === 'zh-CN' ? 'zh-CN' : 'en-US', dateOptions);
        var dateEl = document.getElementById('currentDate');
        if (dateEl) dateEl.textContent = dateStr;
        
        var timeStr = now.toLocaleTimeString(state.currentLang === 'zh-CN' ? 'zh-CN' : 'en-US', { hour12: false });
        var timeEl = document.getElementById('currentTime');
        if (timeEl) timeEl.textContent = timeStr;
    }

    function updateGreetingSubtitle() {
        var subtitleEl = document.querySelector('.greeting-subtitle');
        if (!subtitleEl) return;
        
        var total = state.nodes.length;
        var online = state.onlineNodes.length;
        var offline = total - online;
        
        var isZh = state.currentLang === 'zh-CN';
        var message = '';
        
        if (total === 0) {
            message = isZh ? '欢迎回来，正在加载数据...' : 'Welcome back, loading data...';
        } else if (offline === 0) {
            message = isZh ? '欢迎回来，一切正常运行中' : 'Welcome back, all systems operational';
        } else if (online === 0) {
            message = isZh ? '欢迎回来，服务暂时不可用' : 'Welcome back, services temporarily unavailable';
        } else if (offline <= Math.floor(total * 0.3)) {
            message = isZh 
                ? '欢迎回来，部分服务异常，' + offline + '个节点离线'
                : 'Welcome back, some services affected, ' + offline + ' nodes offline';
        } else {
            message = isZh 
                ? '欢迎回来，多数服务异常，' + offline + '/' + total + '个节点离线'
                : 'Welcome back, major service issues, ' + offline + '/' + total + ' nodes offline';
        }
        
        subtitleEl.textContent = message;
    }

    var preloaderProgress = 0;
    var preloaderTimer = null;

    function updatePreloader(progress, statusText) {
        var fillEl = document.getElementById('progressFill');
        var textEl = document.getElementById('progressText');
        var statusEl = document.getElementById('preloaderStatus');
        if (fillEl) fillEl.style.width = progress + '%';
        if (textEl) textEl.textContent = Math.round(progress) + '%';
        if (statusEl && statusText) statusEl.textContent = statusText;
        preloaderProgress = progress;
    }

    function hidePreloader() {
        var preloader = document.getElementById('preloader');
        if (!preloader) return;
        updatePreloader(100, '加载完成');
        setTimeout(function () {
            preloader.classList.add('fade-out');
            setTimeout(function () {
                preloader.classList.add('hidden');
            }, 600);
        }, 300);
    }

    function startPreloaderSimulation() {
        var stages = [
            { target: 20, text: '正在加载样式...' },
            { target: 40, text: '正在获取配置...' },
            { target: 60, text: '正在加载节点...' },
            { target: 80, text: '正在连接服务...' },
            { target: 90, text: '正在初始化...' }
        ];
        var stageIndex = 0;
        preloaderTimer = setInterval(function () {
            if (stageIndex >= stages.length) {
                clearInterval(preloaderTimer);
                return;
            }
            var stage = stages[stageIndex];
            if (preloaderProgress < stage.target) {
                updatePreloader(preloaderProgress + 1, stage.text);
            } else {
                stageIndex++;
            }
        }, 80);
    }

    function init() {
        startPreloaderSimulation();
        updateTime();
        setInterval(updateTime, 1000);
        
        document.querySelectorAll('.stat-item').forEach(function(item) {
            item.classList.add('animate-in');
        });
        
        var groupFilter = document.querySelector('.stats-bar .group-filter');
        if (groupFilter) groupFilter.classList.add('animate-in');
        
        loadPublicSettings().then(function () {
            updatePreloader(30, '正在获取配置...');
            initTheme();
            initLang();
            initView();
            applyThemeSettings();

            return loadNodes();
        }).then(function () {
            updatePreloader(60, '正在加载节点...');
            renderGroupFilter();
            renderAll();
            connectWebSocket();
            bindEvents();
            return loadAllPingData();
        }).then(function () {
            updatePreloader(90, '正在初始化...');
            renderAll();
            if (preloaderTimer) clearInterval(preloaderTimer);
            hidePreloader();
        }).catch(function (err) {
            console.error('Init failed:', err);
            if (preloaderTimer) clearInterval(preloaderTimer);
            var statusEl = document.getElementById('preloaderStatus');
            if (statusEl) {
                statusEl.textContent = '加载失败，正在重试...';
                statusEl.classList.add('error');
            }
            updatePreloader(preloaderProgress, '加载失败，正在重试...');
            setTimeout(function () {
                hidePreloader();
            }, 3000);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
