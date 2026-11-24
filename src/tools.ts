/**
 * 工具目录 — 全部可放置物的资源清单。
 *
 * 每一条对应工具栏一个按钮 + 一个 polyfork 免费 ES 模块资源
 * （`https://polyfork.dev/cdn/{id}.mjs`，CORS 开放、无需密钥）。
 *
 * 分组：地面 → 建筑 → 街具 → 学校区 → 公园区 → 商业区 → 推土机。
 *
 * @category 工具目录
 * @packageDocumentation
 */

import type { ToolCatalog } from "./types";

/**
 * 游戏内全部工具，按区划分。
 *
 * 常用字段速查：
 * - `cells` — footprint（格，1 格 = 4m），与 polyfork `size_m` 对齐
 * - `align: 2` — 街砖（8×8m）落在偶数格线上拼接
 * - `props: true` — 小道具，不占格，可叠放在建筑格内
 * - `tile4: true` — 1m 地砖放大 4 倍铺满一格
 * - `lift` — 贴片抬升，防 z-fighting
 */
export const TOOLS: ToolCatalog = [
  // ---- 地面 ----
  { key: "street",   label: "街道",   id: "street-tile-c7e3cf",            cells: [2, 2], align: 2 },
  { key: "walk",     label: "人行道", id: "sidewalk-tile-4dfa7b",          cells: [1, 1] },
  { key: "plaza",    label: "广场",   id: "plaza-tile-23b48e",             cells: [1, 1] },
  // ---- 建筑 ----
  { key: "brown",    label: "住宅楼", id: "brownstone-row-house-1b84fd",   cells: [4, 3] },
  { key: "tenement", label: "公寓",   id: "corner-tenement-92fb62",        cells: [4, 4] },
  { key: "office",   label: "写字楼", id: "office-tower-1538cc",           cells: [3, 3] },
  { key: "slab",     label: "板楼",   id: "postwar-apartment-slab-cee5f9", cells: [4, 3] },
  { key: "shop",     label: "商铺",   id: "one-storey-shop-row-83c958",    cells: [4, 2] },
  { key: "church",   label: "教堂",   id: "brick-church-322885",           cells: [4, 3] },
  // ---- 街具 ----
  { key: "tree",     label: "行道树", id: "street-tree-0d33f3",            cells: [1, 1], props: true },
  { key: "lamp",     label: "路灯",   id: "street-lamp-136745",            cells: [1, 1], props: true },
  { key: "bench",    label: "长椅",   id: "park-bench-dc8b62",             cells: [1, 1], props: true },
  { key: "cab",      label: "出租车", id: "yellow-cab-8df4a0",             cells: [1, 2], props: true },
  { key: "bus",      label: "巴士",   id: "city-bus-49fd97",               cells: [1, 3], props: true },
  // ---- 学校区 ----
  { key: "school",   label: "校舍",   id: "public-school-19ade5",          cells: [5, 3] },
  { key: "schoolbus",label: "校车",   id: "yellow-school-bus-0fd3b6",      cells: [1, 2], props: true },
  { key: "yard",     label: "操场地面", id: "yard-hardstanding-tile-2afb6a", cells: [1, 1], tile4: true },
  { key: "marking",  label: "场地标线", id: "playground-marking-decal-97e0b2", cells: [1, 1], tile4: true, props: true, lift: 0.02 },
  { key: "slide",    label: "滑梯",   id: "playground-slide-8b764c",       cells: [1, 1], props: true },
  { key: "round",    label: "转盘",   id: "playground-roundabout-e4d43b",  cells: [1, 1], props: true },
  { key: "teeter",   label: "跷跷板", id: "teeter-totter-ee9c62",          cells: [1, 1], props: true },
  { key: "spring",   label: "弹跳椅", id: "spring-rider-c8b8d8",           cells: [1, 1], props: true },
  // ---- 公园区 ----
  { key: "turf",     label: "草坪",   id: "playing-field-turf-tile-2b68f5", cells: [1, 1], tile4: true },
  { key: "shelter",  label: "野餐棚", id: "park-picnic-shelter-9548a3",    cells: [2, 2] },
  { key: "fountain", label: "喷泉",   id: "campus-plaza-fountain-a0cab1",  cells: [1, 1], props: true },
  { key: "hedge",    label: "树篱",   id: "clipped-boundary-hedge-run-c9027b", cells: [1, 1], props: true },
  { key: "bush",     label: "灌木",   id: "round-bush-cd2ac0",             cells: [1, 1], props: true },
  // ---- 商业区 ----
  { key: "mall",     label: "百货商场", id: "department-store-ffbd58",     cells: [4, 4] },
  { key: "garage",   label: "停车楼", id: "parking-garage-6e4f2c",         cells: [3, 3] },
  { key: "cinema",   label: "电影院", id: "movie-theater-40eeef",          cells: [3, 2] },
  // ---- 功能工具 ----
  { key: "erase",    label: "推土机", id: null,                            cells: [1, 1] },
] as const;
