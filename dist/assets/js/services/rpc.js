/**
 * @module services/rpc
 * @description RPC2Client 类 + 初始化函数
 * @dependencies core/state.js
 * @exports RPC2Client, initRPC2Client
 * @source app.js L4-L195, L1164-L1188
 */

import { state } from '../core/state.js';

/**
 * RPC2Client 类 - WebSocket/HTTP RPC 客户端
 */
export class RPC2Client {
    constructor(options) {
        this.wsUrl = options.wsUrl || '';
        this.httpUrl = options.httpUrl || '';
        this.ws = null;
        this.rpcId = 0;
        this.pendingCalls = {};
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.maxReconnectDelay = 30000;
        this.pollInterval = null;
        this.pollCallback = null;
        this.isConnected = false;
        this.onConnect = null;
        this.onDisconnect = null;
        this.pollMethod = options.pollMethod || 'common:getNodesLatestStatus';
    }

    connect() {
        var self = this;
        if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
            return;
        }

        try {
            this.ws = new WebSocket(this.wsUrl);
        } catch (e) {
            this.scheduleReconnect();
            return;
        }

        this.ws.onopen = function() {
            self.isConnected = true;
            self.reconnectAttempts = 0;
            if (self.onConnect) self.onConnect();
            self.startPolling();
        };

        this.ws.onmessage = function(event) {
            try {
                var msg = JSON.parse(event.data);
                self.handleMessage(msg);
            } catch (e) {
                console.warn('[RPC] Failed to parse WebSocket message:', e);
            }
        };

        this.ws.onclose = function() {
            self.isConnected = false;
            if (self.onDisconnect) self.onDisconnect();
            self.scheduleReconnect();
        };

        this.ws.onerror = function() {
            self.isConnected = false;
            self.scheduleReconnect();
        };
    }

    scheduleReconnect() {
        var self = this;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

        var delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
        this.reconnectAttempts++;

        this.reconnectTimer = setTimeout(function() {
            self.connect();
        }, delay);
    }

    handleMessage(msg) {
        if (msg.id && this.pendingCalls[msg.id]) {
            var callback = this.pendingCalls[msg.id];
            clearTimeout(callback.timer);
            delete this.pendingCalls[msg.id];

            if (msg.error) {
                callback.reject(msg.error);
            } else {
                callback.resolve(msg.result);
            }
        } else if (msg.method && msg.params !== undefined) {
            if (msg.method === this.pollMethod && this.pollCallback) {
                this.pollCallback(msg.params);
            }
        }
    }

    call(method, params, useHttpFallback) {
        var self = this;
        var id = ++this.rpcId;

        return new Promise(function(resolve, reject) {
            var callObj = {
                jsonrpc: '2.0',
                method: method,
                params: params || {},
                id: id
            };

            var timer = setTimeout(function() {
                delete self.pendingCalls[id];
                if (useHttpFallback) {
                    self.httpCall(method, params).then(resolve).catch(reject);
                } else {
                    reject(new Error('RPC timeout'));
                }
            }, 15000);

            self.pendingCalls[id] = { resolve: resolve, reject: reject, timer: timer };

            if (self.ws && self.ws.readyState === WebSocket.OPEN) {
                self.ws.send(JSON.stringify(callObj));
            } else if (useHttpFallback) {
                clearTimeout(timer);
                delete self.pendingCalls[id];
                self.httpCall(method, params).then(resolve).catch(reject);
            } else {
                clearTimeout(timer);
                delete self.pendingCalls[id];
                reject(new Error('WebSocket not connected'));
            }
        });
    }

    httpCall(method, params) {
        var body = JSON.stringify({
            jsonrpc: '2.0',
            method: method,
            params: params || {},
            id: ++this.rpcId
        });

        return fetch(this.httpUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body,
            credentials: 'include'
        }).then(function(res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        }).then(function(msg) {
            if (msg.error) throw msg.error;
            return msg.result;
        });
    }

    startPolling(callback) {
        if (callback) this.pollCallback = callback;
        if (this.pollInterval) clearInterval(this.pollInterval);

        var self = this;
        this.pollInterval = setInterval(function() {
            if (self.ws && self.ws.readyState === WebSocket.OPEN) {
                self.call(self.pollMethod, {}, false).then(function(result) {
                    if (self.pollCallback) self.pollCallback(result);
                }).catch(function() {});
            }
        }, 1000);
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    disconnect() {
        this.stopPolling();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }
}

/**
 * 初始化 RPC2Client
 * @param {Function} handleRpcResult - 实时数据处理回调
 */
export function initRPC2Client(handleRpcResult) {
    var proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var wsUrl = proto + '//' + window.location.host + '/api/rpc2';
    var httpUrl = window.location.origin + '/api/rpc2';

    state.rpc = new RPC2Client({
        wsUrl: wsUrl,
        httpUrl: httpUrl
    });

    state.rpc.onConnect = function() {};

    state.rpc.onDisconnect = function() {};

    state.rpc.startPolling(function(result) {
        handleRpcResult(result);
    });

    state.rpc.connect();
}
