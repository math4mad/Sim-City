/**
 * 核心类型定义 — Mini Sim City (TypeScript 版)
 *
 * 本模块描述游戏中所有数据结构的类型契约：
 * 工具（可放置物）目录、占位网格、存档格式与运行时实体。
 *
 * @category 类型契约
 *
 * 坐标系约定（继承自 polyfork kit 契约）：
 * - 世界坐标以米为单位，Y 轴向上，Y=0 为地面
 * - 网格坐标 (cx, cz) 以 4m 为一格，世界坐标 = 网格坐标 × {@link GRID_SIZE}
 * - 模型正面朝 +Z，可按 90° 步进旋转
 *
 * @packageDocumentation
 */

import type { Group } from "three";

/** kit 网格尺寸（米）。所有放置物按此吸附，来自 polyfork NYC kit 的装配契约。 */
export const GRID_SIZE = 4;

/**
 * 单个可放置工具的资源定义。
 *
 * 一个"工具"对应工具栏上的一个按钮，以及一个 polyfork 资源（`.mjs` ES 模块，
 * 导出 `createAsset(params): Group`）。
 *
 * @example
 * ```ts
 * const t: ToolDef = {
 *   key: "school", label: "校舍",
 *   id: "public-school-19ade5",
 *   cells: [5, 3],          // 占 5×3 个 4m 网格 = 20×12m
 * };
 * ```
 */
export interface ToolDef {
  /** 唯一标识，同时作为存档里的资源键 */
  key: string;
  /** 工具栏按钮文字（中文） */
  label: string;
  /** polyfork 资源 id；`null` 表示纯功能工具（推土机），无资源可加载 */
  id: string | null;
  /**
   * 占位格数 `[宽, 深]`，单位为网格格（每格 {@link GRID_SIZE} 米）。
   * 建筑的 footprint 必须与资源真实尺寸（size_m 向上取整到格）一致。
   */
  cells: [number, number];
  /**
   * 吸附对齐步长（格数）。街道砖为 8×8m（2 格），必须落在偶数格线上
   * 才能与相邻街砖无缝拼接。缺省为 1（逐格吸附）。
   */
  align?: number;
  /**
   * 小型道具（树、灯、车等）：自由放置，**不占用**占位网格，
   * 可以摆放在建筑格内。缺省 `false`。
   */
  props?: boolean;
  /**
   * 1m 地砖类资源（草坪、操场地面）：`createAsset()` 返回 1×1m 的砖，
   * 由运行时统一缩放 `GRID_SIZE` 倍以铺满一个 4m 格。
   */
  tile4?: boolean;
  /**
   * 垂直抬升量（米）。用于贴地贴片（如场地标线，origin_y 为 -0.05），
   * 抬升 0.02m 避免与下层地面 z-fighting。
   */
  lift?: number;
}

/** 工具栏目录：渲染按钮与资源预加载均以此为准 */
export type ToolCatalog = readonly ToolDef[];

/**
 * 占位网格的键格式 `"cx,cz"`。
 * @see OccupancyGrid
 */
export type CellKey = `${number},${number}`;

/**
 * 占位网格 — 防止建筑 footprint 重叠的空间索引。
 *
 * 键为 {@link CellKey}（`"cx,cz"`），值为占用该格的对象 uuid。
 * 多格建筑声明时占用其覆盖的每一个格；道具（`props: true`）不登记。
 */
export interface OccupancyGrid {
  /** 查询某格是否被占用 */
  has(key: CellKey): boolean;
  /** 占用一组格，`tag` 通常为对象 uuid，删除时用于反向核对 */
  set(key: CellKey, tag: string): this;
  /** 释放一组格 */
  delete(key: CellKey): boolean;
  /** 清空整张网格（重置城市时用） */
  clear(): void;
}

/**
 * 已放置对象的运行时元数据。
 * 挂在 `Object3D.userData` 上，删除与存档序列化都依赖它。
 */
export interface PlacedMeta {
  /** 放置时使用的工具定义（回溯资源与 footprint） */
  tool: ToolDef;
  /** footprint 锚点网格坐标（多格建筑的左下角） */
  ox: number;
  oz: number;
  /** 绕 Y 轴旋转（弧度，90° 步进），存档用 */
  rot: number;
}

/**
 * 存档条目 — 一个已放置对象的最小序列化形式。
 * @see SaveData
 */
export interface SaveItem {
  /** {@link ToolDef.key}，恢复时反查工具定义 */
  k: string;
  /** footprint 锚点网格坐标 */
  x: number;
  z: number;
  /** 绕 Y 轴旋转（弧度） */
  r: number;
}

/**
 * 存档根结构（序列化到 `localStorage`，键 {@link SAVE_KEY}）。
 */
export interface SaveData {
  /** 格式版本；不兼容变更时递增 */
  v: 1;
  /** 全部已放置对象 */
  items: SaveItem[];
}

/** localStorage 存档键 */
export const SAVE_KEY = "minisimcity.v1";

/**
 * 巡航车辆 — 沿固定环路行驶的移动物体。
 * 存放于独立 `traffic` 组，不参与占位、存档与推土机删除。
 */
export interface Mover {
  /** three.js 场景对象（`createAsset()` 的返回值） */
  obj: Group;
  /** 当前里程（米，沿环路累计，自动取模周长） */
  dist: number;
  /** 巡航速度（米/秒） */
  speed: number;
}

/**
 * 资源工厂 — polyfork `.mjs` 模块导出的 `createAsset` 的类型。
 * 传入 remix 参数可生成变体；无参调用复现资源默认形态。
 * 返回值以米为单位、坐在 y=0、正面朝 +Z。
 */
export type AssetFactory = (params?: Record<string, unknown>) => Group;
