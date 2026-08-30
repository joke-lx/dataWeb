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
import type { Plugin } from 'vite';
export declare function apiProxyPlugin(): Plugin;
