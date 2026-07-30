import { t } from '../../i18n/index.js';
import { formatBytes, formatSpeed, formatAxisSpeed, getSpeedAxisUnit, formatAxisCount, getCountAxisUnit } from '../../utils/format.js';

export function getChartConfigs(node, liveData) {
    const cs = getComputedStyle(document.documentElement);
    const colors = [
        cs.getPropertyValue('--chart-cpu').trim(),
        cs.getPropertyValue('--chart-ram').trim(),
        cs.getPropertyValue('--chart-network-down').trim(),
        cs.getPropertyValue('--chart-network-up').trim(),
        cs.getPropertyValue('--chart-disk').trim(),
        cs.getPropertyValue('--chart-process').trim(),
        cs.getPropertyValue('--chart-connections').trim(),
        cs.getPropertyValue('--chart-connections-udp').trim()
    ];

    // 提取 liveData 的实际值（liveData 是对象格式）
    const cpuUsage = liveData && liveData.cpu ? liveData.cpu.usage : null;
    const ramUsed = liveData && liveData.ram ? liveData.ram.used : null;
    const ramTotal = liveData && liveData.ram ? liveData.ram.total : (node ? node.mem_total : 0);
    const diskUsed = liveData && liveData.disk ? liveData.disk.used : null;
    const diskTotal = liveData && liveData.disk ? liveData.disk.total : (node ? node.disk_total : 0);
    const processCount = liveData ? liveData.process : null;
    const connTcp = liveData && liveData.connections ? liveData.connections.tcp : null;
    const connUdp = liveData && liveData.connections ? liveData.connections.udp : null;

    return [
        {
            id: 'cpu',
            canvasId: 'cpuChart',
            title: t('cpu_usage'),
            type: 'area',
            dataKey: 'cpu',
            valueFn: function(r) { return r.cpu; },
            liveValue: cpuUsage !== null ? cpuUsage.toFixed(2) + '%' : '-',
            yAxisDomain: [0, 100],
            yAxisFormatter: function(value) { return value.toFixed(0) + '%'; },
            color: colors[0],
            tooltipFormatter: function(value) { return value.toFixed(2) + '%'; },
            tooltipLabel: t('cpu_usage'),
            smoothKeys: ['cpu']
        },
        {
            id: 'ram',
            canvasId: 'ramChart',
            title: t('ram_usage'),
            type: 'area',
            dataKey: 'ram',
            valueFn: function(r) {
                const ramVal = r.ram;
                if (ramVal === null || ramVal === undefined) return null;
                if (ramVal > 100 && r.ram_total > 0) {
                    return (ramVal / r.ram_total) * 100;
                }
                return ramVal;
            },
            liveValue: ramUsed !== null ? formatBytes(ramUsed) + ' / ' + formatBytes(ramTotal) : '-',
            yAxisDomain: [0, 100],
            yAxisFormatter: function(value) { return value.toFixed(0) + '%'; },
            color: colors[1],
            tooltipFormatter: function(value, raw) { return formatBytes(raw ? raw.ram : 0) + ' (' + value.toFixed(0) + '%)'; },
            tooltipLabel: t('ram_usage'),
            smoothKeys: ['ram']
        },
        {
            id: 'network',
            canvasId: 'networkChart',
            title: t('network_traffic'),
            type: 'line',
            series: [
                {
                    dataKey: 'net_in',
                    color: colors[2],
                    tooltipLabel: t('download'),
                    tooltipFormatter: function(value) { return formatSpeed(value); }
                },
                {
                    dataKey: 'net_out',
                    color: colors[3],
                    tooltipLabel: t('upload'),
                    tooltipFormatter: function(value) { return formatSpeed(value); }
                }
            ],
            liveValue: liveData && liveData.network ? ('▲ ' + formatSpeed(liveData.network.up || 0) + '  ▼ ' + formatSpeed(liveData.network.down || 0)) : '-',
            yAxisFormatter: function(value, maxVal) { return formatAxisSpeed(value, maxVal); },
            yAxisUnitFn: function(maxVal) { return getSpeedAxisUnit(maxVal); },
            smoothKeys: ['net_in', 'net_out']
        },
        {
            id: 'disk',
            canvasId: 'diskChart',
            title: t('disk_usage'),
            type: 'area',
            dataKey: 'disk',
            valueFn: function(r) {
                const diskVal = r.disk;
                if (diskVal === null || diskVal === undefined) return null;
                if (diskVal > 100 && r.disk_total > 0) {
                    return (diskVal / r.disk_total) * 100;
                }
                return diskVal;
            },
            liveValue: diskUsed !== null ? formatBytes(diskUsed) + ' / ' + formatBytes(diskTotal) : '-',
            yAxisDomain: [0, 100],
            yAxisFormatter: function(value) { return value.toFixed(0) + '%'; },
            color: colors[4],
            tooltipFormatter: function(value, raw) { return formatBytes(raw ? raw.disk : 0) + ' (' + value.toFixed(0) + '%)'; },
            tooltipLabel: t('disk_usage'),
            smoothKeys: ['disk']
        },
        {
            id: 'process',
            canvasId: 'processChart',
            title: t('process_count'),
            type: 'line',
            dataKey: 'process',
            valueFn: function(r) { return r.process; },
            liveValue: processCount !== null ? String(processCount) : '-',
            yAxisFormatter: function(value, maxVal) { return formatAxisCount(value, maxVal); },
            yAxisUnitFn: function(maxVal) { return getCountAxisUnit(maxVal); },
            color: colors[5],
            tooltipFormatter: function(value) { return Math.round(value); },
            tooltipLabel: t('process_count'),
            smoothKeys: ['process']
        },
        {
            id: 'connections',
            canvasId: 'connectionsChart',
            title: t('connection_count'),
            type: 'line',
            series: [
                {
                    dataKey: 'connections',
                    color: colors[6],
                    tooltipLabel: 'TCP',
                    tooltipFormatter: function(value) { return Math.round(value); }
                },
                {
                    dataKey: 'connections_udp',
                    color: colors[7],
                    tooltipLabel: 'UDP',
                    tooltipFormatter: function(value) { return Math.round(value); }
                }
            ],
            liveValue: connTcp !== null ? ('TCP: ' + connTcp + ' / UDP: ' + (connUdp || 0)) : '-',
            yAxisFormatter: function(value, maxVal) { return formatAxisCount(value, maxVal); },
            yAxisUnitFn: function(maxVal) { return getCountAxisUnit(maxVal); },
            smoothKeys: ['connections', 'connections_udp']
        }
    ];
}

export function updateNetworkLegend(chartConfigs) {
    const networkConfig = chartConfigs.find(function(c) { return c.id === 'network'; });
    if (networkConfig && networkConfig.series) {
        const uploadSeries = networkConfig.series.find(function(s) { return s.dataKey === 'net_out'; });
        const downloadSeries = networkConfig.series.find(function(s) { return s.dataKey === 'net_in'; });
        const legendEl = document.getElementById('networkLegend');
        if (legendEl) {
            const upDot = legendEl.querySelector('.legend-up .legend-dot');
            const downDot = legendEl.querySelector('.legend-down .legend-dot');
            if (upDot && uploadSeries) upDot.style.background = uploadSeries.color;
            if (downDot && downloadSeries) downDot.style.background = downloadSeries.color;
        }
    }
}
