/**
 * @module algorithms/record-transforms
 * @description 记录数据整形与合并的纯函数
 * @dependencies none
 * @exports flattenRecentRecords, mergeAndDedupRecords, forwardFillTotals
 */

/**
 * 扁平化最近记录：将嵌套对象（cpu, ram, disk, network, connections）
 * 展开为图表可直接消费的平面结构
 * @param {Array} rawRecords - API 返回的原始记录
 * @returns {Array} 扁平化后的记录
 */
export function flattenRecentRecords(rawRecords) {
    return rawRecords.map(function(r) {
        return {
            time: r.updated_at || r.time || '',
            cpu: r.cpu && r.cpu.usage !== undefined ? r.cpu.usage : (r.cpu || null),
            ram: r.ram && typeof r.ram === 'object' ? r.ram.used : (r.ram || null),
            ram_total: r.ram && typeof r.ram === 'object' && r.ram.total !== undefined ? r.ram.total : (r.ram_total || null),
            swap: r.swap && typeof r.swap === 'object' ? r.swap.used : (r.swap || null),
            swap_total: r.swap && typeof r.swap === 'object' && r.swap.total !== undefined ? r.swap.total : (r.swap_total || null),
            disk: r.disk && typeof r.disk === 'object' ? r.disk.used : (r.disk || null),
            disk_total: r.disk && typeof r.disk === 'object' && r.disk.total !== undefined ? r.disk.total : (r.disk_total || null),
            load: r.load && typeof r.load === 'object' ? r.load.load1 : (r.load || null),
            load5: r.load && typeof r.load === 'object' ? r.load.load5 : (r.load5 || null),
            load15: r.load && typeof r.load === 'object' ? r.load.load15 : (r.load15 || null),
            net_in: r.network && typeof r.network === 'object' ? r.network.down : (r.net_in || null),
            net_out: r.network && typeof r.network === 'object' ? r.network.up : (r.net_out || null),
            net_total_up: r.network && typeof r.network === 'object' ? r.network.totalUp : (r.net_total_up || null),
            net_total_down: r.network && typeof r.network === 'object' ? r.network.totalDown : (r.net_total_down || null),
            process: r.process || null,
            connections: r.connections && typeof r.connections === 'object' ? r.connections.tcp : (r.connections || null),
            connections_udp: r.connections && typeof r.connections === 'object' ? r.connections.udp : (r.connections_udp || null),
            gpu: r.gpu || null
        };
    });
}

/**
 * 合并已有记录与新记录，按时间去重并排序
 * @param {Array} existing - 已有记录
 * @param {Array} incoming - 新记录
 * @returns {Array} 合并后的记录（已排序、已去重）
 */
export function mergeAndDedupRecords(existing, incoming) {
    const timeSet = {};
    existing.forEach(function(r) { if (r.time) timeSet[r.time] = true; });
    const merged = existing.slice();
    incoming.forEach(function(r) {
        if (r.time && !timeSet[r.time]) {
            merged.push(r);
            timeSet[r.time] = true;
        }
    });
    merged.sort(function(a, b) { return new Date(a.time).getTime() - new Date(b.time).getTime(); });
    return merged;
}

/**
 * 前向填充 disk_total / ram_total / swap_total
 * /api/recent/ 返回的记录不含 total，WebSocket 的记录含 total，
 * 合并后部分记录 total=null → 图表失真，需用最近有效值填充
 * @param {Array} records - 已排序的记录数组（原地修改）
 */
export function forwardFillTotals(records) {
    let lastDiskTotal = 0;
    let lastRamTotal = 0;
    let lastSwapTotal = 0;
    for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        if (rec.disk_total && rec.disk_total > 0) {
            lastDiskTotal = rec.disk_total;
        } else if (lastDiskTotal > 0) {
            rec.disk_total = lastDiskTotal;
        }
        if (rec.ram_total && rec.ram_total > 0) {
            lastRamTotal = rec.ram_total;
        } else if (lastRamTotal > 0) {
            rec.ram_total = lastRamTotal;
        }
        if (rec.swap_total && rec.swap_total > 0) {
            lastSwapTotal = rec.swap_total;
        } else if (lastSwapTotal > 0) {
            rec.swap_total = lastSwapTotal;
        }
    }
}
