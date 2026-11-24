/**
 * 资源加载与实例化 — 从 polyfork CDN 热链接 `.mjs` 模块。
 *
 * polyfork 免费层：`/cdn` CORS 开放、无需密钥、无明确限速；
 * 本加载器仍按 150ms 间隔串行请求，对 CDN 保持礼貌。
 *
 * @category 资源加载
 * @packageDocumentation
 */

import type { Group, Mesh } from "three";
import type { AssetFactory, ToolDef } from "./types";

/** polyfork CDN 根地址（免费资源无需密钥） */
const CDN = "https://polyfork.dev/cdn/";

/** 每个资源之间的加载间隔（毫秒）— 无明确限速要求下的礼貌节流 */
const LOAD_GAP_MS = 150;

/**
 * 已加载的资源工厂表。键为 polyfork 资源 id（如 `"street-tile-c7e3cf"`）。
 * 加载失败的工具不出现在表里，`make()` 返回 `null` 并跳过。
 */
const factories = new Map<string, AssetFactory>();

/**
 * 按工具目录串行预加载全部资源。
 *
 * @param tools - 需要预加载的工具清单（自动去重 `id`）
 * @param onProgress - 每加载完一个资源的进度回调
 * @returns 就绪计数与总数，供 UI 状态栏展示
 *
 * @example
 * ```ts
 * const { ready, total } = await loadAssets(TOOLS,
 *   (msg) => (statusEl.textContent = msg));
 * ```
 */
export async function loadAssets(
  tools: readonly ToolDef[],
  onProgress?: (msg: string) => void,
): Promise<{ ready: number; total: number }> {
  const ids = [...new Set(tools.filter((t) => t.id !== null).map((t) => t.id!))];
  let ready = 0;
  for (const id of ids) {
    try {
      const mod = await import(/* @vite-ignore */ `${CDN}${id}.mjs`);
      factories.set(id, mod.createAsset as AssetFactory);
    } catch (err) {
      console.error("资源加载失败:", id, err);
    }
    ready++;
    onProgress?.(`加载资源 ${ready}/${ids.length}…`);
    await new Promise((r) => setTimeout(r, LOAD_GAP_MS));
  }
  return { ready, total: ids.length };
}

/**
 * 实例化一个资源为可入场场景的 `Group`。
 *
 * - 遍历子树开启 `castShadow` / `receiveShadow`
 * - `tool.tile4` 为真时整体放大 {@link GRID_SIZE} 倍（仅 X/Z，1m 地砖铺满 4m 格）
 *
 * @param id - polyfork 资源 id
 * @param rotY - 初始绕 Y 旋转（弧度），默认 0
 * @param tool - 所属工具定义（用于 tile4 缩放判断），可省略
 * @returns 实例化对象；资源未加载或工厂缺失时返回 `null`
 */
export function make(id: string | null, rotY = 0, tool?: ToolDef): Group | null {
  const factory = id ? factories.get(id) : undefined;
  if (!factory) return null;
  const obj = factory();
  obj.traverse((o) => {
    const mesh = o as Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  obj.rotation.y = rotY;
  if (tool?.tile4) obj.scale.set(4, 1, 4); // GRID_SIZE，字面量避免循环依赖
  return obj;
}
