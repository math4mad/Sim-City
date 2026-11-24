/**
 * 预置城市 — 首次运行（无存档）时生成的默认布局。
 *
 * 布局总览（网格坐标，1 格 = 4m）：
 * - 原点十字双车道大街（列 -12..16 × 行 -2..16，含延长段）
 * - 西北旧城：联排住宅 / 公寓 / 写字楼 / 教堂
 * - 东北商业区：百货商场 + 停车楼 + 电影院
 * - 东南公园区：草坪 + 树篱 + 喷泉 + 野餐棚
 * - 西南学校区：校舍 + 校车 + 操场 + 游乐设施
 *
 * @category 预置城市
 * @packageDocumentation
 */

import { make } from "./assets";
import { cellsFree, claimCells } from "./grid";
import type { ToolDef } from "./types";
import type { Group } from "three";

/**
 * 按工具 key 查找目录项并实例化放置。
 *
 * 放置即登记占位（`props` 除外）；不检查工具是否存在，
 * 资源缺失时静默跳过（预置布局容忍个别资源加载失败）。
 *
 * @param catalog - 工具目录
 * @param city - 目标场景组
 * @param toolKey - 目录里的工具 key
 * @param cx - 锚点网格 X
 * @param cz - 锚点网格 Z
 * @param isProp - 覆盖 `props` 判定（默认读工具定义）
 * @param rotY - 绕 Y 旋转（弧度），默认 0
 */
export function claimAndPlace(
  catalog: readonly ToolDef[],
  city: Group,
  toolKey: string,
  cx: number,
  cz: number,
  isProp?: boolean,
  rotY = 0,
): void {
  const t = catalog.find((x) => x.key === toolKey);
  if (!t || t.id === null) return;
  const prop = isProp ?? t.props === true;
  if (!prop && !cellsFree(t.cells, cx, cz)) return;
  const obj = make(t.id, rotY, t);
  if (!obj) return;
  obj.position.set((cx + t.cells[0] / 2) * 4, t.lift ?? 0, (cz + t.cells[1] / 2) * 4);
  city.add(obj);
  obj.userData = { ...obj.userData, tool: t, ox: cx, oz: cz, rot: rotY };
  if (!prop) claimCells(t.cells, cx, cz, obj.uuid);
}

/**
 * 生成完整默认城市（旧城 + 四个新区）。
 *
 * @param catalog - 工具目录
 * @param city - 目标场景组
 */
export function buildDefaultCity(catalog: readonly ToolDef[], city: Group): void {
  buildOldTown(catalog, city);
  buildDistrictStreets(catalog, city);
  buildSchoolQuarter(catalog, city);
  buildParkQuarter(catalog, city);
  buildMallQuarter(catalog, city);
}

/** 原点大街与西北旧城（列 -12..11 × 行 -12..11） */
function buildOldTown(catalog: readonly ToolDef[], city: Group): void {
  // 两条 2 格宽大街在原点交叉
  for (let cx = -12; cx < 12; cx += 2)
    for (let cz = -2; cz < 2; cz += 2) claimAndPlace(catalog, city, "street", cx, cz);
  for (let cz = -12; cz < 12; cz += 2)
    for (let cx = -2; cx < 2; cx += 2) claimAndPlace(catalog, city, "street", cx, cz);

  // 四个街区的环路人行道
  for (let i = -12; i < 12; i++)
    for (const [cx, cz] of [[i, -3], [i, 2], [-3, i], [2, i]] as const)
      claimAndPlace(catalog, city, "walk", cx, cz);

  // 建筑排布
  const buildings: Array<[string, number, number]> = [
    ["brown", -11, -11], ["tenement", -7, -11], ["slab", -11, -7], ["office", -6, -6],
    ["brown", 3, -11], ["shop", 8, -11], ["church", 3, -7],
    ["brown", -11, 3], ["brown", -7, 3], ["slab", -11, 8],
    ["brown", 3, 3], ["office", 8, 3], ["brown", 3, 8], ["shop", 8, 8],
  ];
  for (const [k, cx, cz] of buildings) claimAndPlace(catalog, city, k, cx, cz);

  // 行道树、路灯与临街车辆
  for (const [cx, cz] of [[-4, -3], [0, -3], [1, 3], [-3, 6], [6, 2], [10, 2], [2, 6], [-3, -6]] as const)
    claimAndPlace(catalog, city, "tree", cx, cz, true);
  for (const [cx, cz] of [[-8, -3], [4, 3], [-3, -10], [2, 10]] as const)
    claimAndPlace(catalog, city, "lamp", cx, cz, true);
  claimAndPlace(catalog, city, "cab", 1, -9, true, Math.PI / 2);
  claimAndPlace(catalog, city, "bus", 1, 6, true, Math.PI / 2);
}

/** 新区大街：向南、向东各延伸两条车道（列/行 12..15），并连出环路人行道 */
function buildDistrictStreets(catalog: readonly ToolDef[], city: Group): void {
  for (let cx = 12; cx < 16; cx += 2)
    for (let cz = -2; cz < 2; cz += 2) claimAndPlace(catalog, city, "street", cx, cz);
  for (let cz = 12; cz < 16; cz += 2)
    for (let cx = -2; cx < 2; cx += 2) claimAndPlace(catalog, city, "street", cx, cz);
  for (let i = -12; i < 16; i += 2) {
    for (const cz of [12, 14]) claimAndPlace(catalog, city, "street", i, cz);
    for (const cx of [12, 14]) claimAndPlace(catalog, city, "street", cx, i);
  }
  for (let i = -12; i < 16; i++)
    for (const [cx, cz] of [[i, 11], [11, i], [i, 16], [16, i]] as const)
      claimAndPlace(catalog, city, "walk", cx, cz);
}

/** 学校区：列 3..10 × 行 17..24 — 校舍、校车、操场与游乐设施 */
function buildSchoolQuarter(catalog: readonly ToolDef[], city: Group): void {
  claimAndPlace(catalog, city, "school", 3, 17);           // 5×3 格
  claimAndPlace(catalog, city, "schoolbus", 9, 17, true);
  for (let cx = 3; cx < 7; cx++)
    for (let cz = 21; cz < 25; cz++) claimAndPlace(catalog, city, "yard", cx, cz);
  claimAndPlace(catalog, city, "marking", 3, 21, true);
  claimAndPlace(catalog, city, "marking", 5, 23, true);
  claimAndPlace(catalog, city, "slide", 3, 24, true, Math.PI);
  claimAndPlace(catalog, city, "round", 5, 22, true);
  claimAndPlace(catalog, city, "teeter", 4, 24, true);
  claimAndPlace(catalog, city, "spring", 6, 21, true);
  claimAndPlace(catalog, city, "spring", 6, 24, true);
  claimAndPlace(catalog, city, "tree", 10, 21, true);
  claimAndPlace(catalog, city, "tree", 10, 24, true);
}

/** 公园区：列 17..24 × 行 3..10 — 草坪、树篱围边、喷泉、野餐棚 */
function buildParkQuarter(catalog: readonly ToolDef[], city: Group): void {
  for (let cx = 17; cx < 25; cx++)
    for (let cz = 3; cz < 11; cz++) claimAndPlace(catalog, city, "turf", cx, cz);
  claimAndPlace(catalog, city, "shelter", 17, 3);
  claimAndPlace(catalog, city, "fountain", 21, 6, true);
  for (let cx = 17; cx < 25; cx++) {
    if (cx !== 20 && cx !== 21) claimAndPlace(catalog, city, "hedge", cx, 3, true);
    if (cx !== 20 && cx !== 21) claimAndPlace(catalog, city, "hedge", cx, 10, true, Math.PI);
  }
  for (let cz = 4; cz < 10; cz++) {
    claimAndPlace(catalog, city, "hedge", 17, cz, true, Math.PI / 2);
    claimAndPlace(catalog, city, "hedge", 24, cz, true, -Math.PI / 2);
  }
  claimAndPlace(catalog, city, "bench", 20, 7, true, Math.PI);
  claimAndPlace(catalog, city, "bench", 22, 7, true, Math.PI);
  for (const [cx, cz] of [[19, 5], [22, 4], [23, 8], [18, 7]] as const)
    claimAndPlace(catalog, city, "tree", cx, cz, true);
  for (const [cx, cz] of [[18, 10], [23, 3], [19, 9], [22, 9]] as const)
    claimAndPlace(catalog, city, "bush", cx, cz, true);
}

/** 商业区：列 17..24 × 行 -11..-4 — 商场、停车楼、电影院、候客出租车 */
function buildMallQuarter(catalog: readonly ToolDef[], city: Group): void {
  claimAndPlace(catalog, city, "mall", 17, -11);
  claimAndPlace(catalog, city, "garage", 21, -11);
  claimAndPlace(catalog, city, "cinema", 21, -7);
  claimAndPlace(catalog, city, "cab", 24, -10, true, -Math.PI / 2);
  claimAndPlace(catalog, city, "cab", 24, -8, true, -Math.PI / 2);
  claimAndPlace(catalog, city, "cab", 17, -6, true);
  claimAndPlace(catalog, city, "lamp", 24, -5, true);
  claimAndPlace(catalog, city, "lamp", 20, -4, true);
}
