/**
 * apiProxyPlugin — vite dev plugin。
 *
 * Why: pybigwig 在 Python 3.13 装不上,api 端启不起来 → /api/* 一直 500。
 *      这个 plugin 在 dev 期接管所有 /api/*:
 *        - /api/species/:species/samples  → 从 apps/api/app/mock/samples.py
 *                                            抽 SAMPLES 字面量,按 species 过滤返回。
 *        - 其它 /api/*                      → 透明转发到 http://localhost:8000
 *                                            (真后端起来时无需改 plugin)。
 *
 * Why not vite server.proxy + bypass:
 *      vite 5 把 proxy middleware 注册在 user middleware **之前**,即使我们
 *      unshift 也抢不到。bypass 也不能让请求回流到 user middleware。
 *      自己接管干净可控。
 *
 * 关闭方式:把 plugins 里的 apiProxyPlugin() 删掉即可回到原生 vite proxy。
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var SAMPLES_PY = path.resolve(__dirname, '../../../apps/api/app/mock/samples.py');
var API_TARGET = 'http://localhost:8000';
function parseSamplesFromPy(source) {
    var startToken = 'SAMPLES: list[dict] = [';
    var startIdx = source.indexOf(startToken);
    if (startIdx < 0)
        return [];
    var openIdx = startIdx + startToken.length - 1;
    var depth = 1;
    var endIdx = -1;
    for (var i = openIdx + 1; i < source.length; i += 1) {
        var ch = source[i];
        if (ch === '[')
            depth += 1;
        else if (ch === ']') {
            depth -= 1;
            if (depth === 0) {
                endIdx = i + 1;
                break;
            }
        }
    }
    if (endIdx < 0)
        return [];
    var block = source.slice(openIdx, endIdx)
        .replace(/'/g, '"')
        .replace(/\bTrue\b/g, 'true')
        .replace(/\bFalse\b/g, 'false')
        .replace(/\bNone\b/g, 'null');
    // Python 允许 trailing comma;标准 JSON 不允许 — 全局剥掉。
    block = block.replace(/,(\s*[}\]])/g, '$1');
    try {
        return JSON.parse(block);
    }
    catch (e) {
        console.warn('[apiProxyPlugin] failed to parse SAMPLES:', e);
        return [];
    }
}
var cachedSamples = null;
function getSamples() {
    if (cachedSamples)
        return cachedSamples;
    try {
        cachedSamples = parseSamplesFromPy(fs.readFileSync(SAMPLES_PY, 'utf8'));
    }
    catch (e) {
        console.warn('[apiProxyPlugin] cannot read samples.py:', e);
        cachedSamples = [];
    }
    return cachedSamples;
}
function proxyToApi(req, res) {
    // req.url 已经剥离了 '/api' 前缀 —— 手动补回去,否则后端 404。
    var url = "".concat(API_TARGET, "/api").concat(req.url);
    var proxyReq = http.request(url, { method: req.method, headers: req.headers }, function (proxyRes) {
        var _a;
        res.writeHead((_a = proxyRes.statusCode) !== null && _a !== void 0 ? _a : 502, proxyRes.headers);
        proxyRes.pipe(res);
    });
    proxyReq.on('error', function (e) {
        console.warn("[apiProxyPlugin] backend ".concat(API_TARGET, " unreachable:"), e.message);
        if (!res.headersSent) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end("backend ".concat(API_TARGET, " unreachable: ").concat(e.message));
        }
    });
    req.pipe(proxyReq);
}
export function apiProxyPlugin() {
    return {
        name: 'dataweb:api-proxy',
        enforce: 'pre',
        configureServer: function (server) {
            var _a;
            // 注意:configureServer 调用时 stack 通常是空 —— vite 的内置 middleware
            // 在 post 阶段注册,排在 user middleware **之后**。所以我们的 handler 自然优先。
            // 这里留一个 hook 用于将来 vite 改变顺序时的兜底,目前是 no-op。
            var _stack = (_a = server.middlewares.stack) !== null && _a !== void 0 ? _a : [];
            void _stack;
            // 自己接管 /api/*
            server.middlewares.use('/api', function (req, res, _next) {
                var _a;
                var r = req;
                var url = (_a = r.url) !== null && _a !== void 0 ? _a : '';
                var m = url.match(/^\/species\/([^/]+)\/samples\/?$/);
                if (r.method === 'GET' && m) {
                    var species_1 = decodeURIComponent(m[1]);
                    var filtered = getSamples().filter(function (s) { return s.species === species_1; });
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.statusCode = 200;
                    res.end(JSON.stringify(filtered));
                    return;
                }
                proxyToApi(req, res);
            });
        },
    };
}
