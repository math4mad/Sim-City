/**
 * 存档系统 — 自动保存 / 恢复 / 重置。
 *
 * 每次放置或删除后，将全部已放置对象序列化到 `localStorage`
 * （键 {@link SAVE_KEY}），刷新页面即自动恢复。
 *
 * @category 存档系统
 * @packageDocumentation
 */

import type { Group } from "three";
import type { SaveData, SaveItem, ToolDef } from "./types";
import { SAVE_KEY } from "./types";

/**
 * 从场景组快照并写入 localStorage。
 *
 * @param city - 承载全部已放置对象的场景组（每个子对象须带 {@link PlacedMeta 形态的 userData}）
 * @returns 写入的对象数；`localStorage` 异常时捕获并返回 0
 */
export function saveCity(city: Group): number {
  try {
    const items: SaveItem[] = city.children.map((o) => ({
      k: o.userData.tool?.key as string,
      x: o.userData.ox as number,
      z: o.userData.oz as number,
      r: (o.userData.rot as number) || 0,
    }));
    const data: SaveData = { v: 1, items };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return items.length;
  } catch (e) {
    console.warn("存档失败", e);
    return 0;
  }
}

/**
 * 读取存档并反序列化为待重放的条目列表。
 *
 * @returns 条目数组；无存档 / 解析失败 / 版本不符时返回 `null`
 */
export function readSave(): SaveItem[] | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.v !== 1 || !Array.isArray(data.items) || data.items.length === 0) return null;
    return data.items;
  } catch {
    return null;
  }
}

/** 删除存档（"重置城市"时先于重建调用）。 */
export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

/**
 * 存档条目 → 工具定义 的反查。
 * @param key - {@link SaveItem.k}
 * @param catalog - 工具目录
 * @returns 匹配的工具定义；存档含未知 key（目录已变更）时返回 `undefined` 并由调用方跳过
 */
export function toolFromSave(key: string, catalog: readonly ToolDef[]): ToolDef | undefined {
  return catalog.find((t) => t.key === key);
}
