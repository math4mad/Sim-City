/**
 * 占位网格 — 建筑 footprint 的空间占用索引。
 *
 * 键为 `"cx,cz"` 网格坐标字符串（{@link CellKey}），值为占用者 uuid。
 * 多格建筑登记其覆盖的每一格；`props` 类小道具不登记，可自由叠放。
 *
 * @category 占位网格
 * @packageDocumentation
 */

import type { CellKey } from "./types";

/** 内部实现：网格坐标 → 占用者 uuid */
const grid = new Map<CellKey, string>();

/** 生成占位键 `"cx,cz"` */
export const cellKey = (cx: number, cz: number): CellKey => `${cx},${cz}` as CellKey;

/**
 * 检查一个 `[宽, 深]` footprint 从锚点 `(cx, cz)` 起是否完全空闲。
 *
 * @param cells - footprint 尺寸 `[cols, rows]`（格）
 * @param cx - 锚点网格 X（footprint 左下角）
 * @param cz - 锚点网格 Z
 * @returns 所有覆盖格均未被占用时为 `true`
 */
export function cellsFree(cells: [number, number], cx: number, cz: number): boolean {
  for (let dx = 0; dx < cells[0]; dx++)
    for (let dz = 0; dz < cells[1]; dz++)
      if (grid.has(cellKey(cx + dx, cz + dz))) return false;
  return true;
}

/**
 * 登记占用：把 footprint 覆盖的每一格写入 `tag`（通常为对象 uuid）。
 */
export function claimCells(cells: [number, number], cx: number, cz: number, tag: string): void {
  for (let dx = 0; dx < cells[0]; dx++)
    for (let dz = 0; dz < cells[1]; dz++)
      grid.set(cellKey(cx + dx, cz + dz), tag);
}

/**
 * 释放占用：删除 footprint 覆盖的所有格。删除对象时调用。
 */
export function releaseCells(cells: [number, number], cx: number, cz: number): void {
  for (let dx = 0; dx < cells[0]; dx++)
    for (let dz = 0; dz < cells[1]; dz++)
      grid.delete(cellKey(cx + dx, cz + dz));
}

/** 清空整张占位网格（"重置城市"时用）。 */
export function clearOccupancy(): void {
  grid.clear();
}
