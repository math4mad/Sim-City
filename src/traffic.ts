/**
 * 巡航交通 — 沿固定环路行驶的车辆。
 *
 * 环路覆盖城市四条边道（世界坐标），车辆按里程匀速前进，
 * 车头自动朝向行进方向（90° 直角弯，符合低模风格）。
 * 车辆存放于独立 `traffic` 组：不参与占位网格、不写存档、
 * 推土机不可删除。
 *
 * @category 巡航交通
 * @packageDocumentation
 */

import { Group, Vector3 } from "three";
import { make } from "./assets";
import type { Mover, ToolDef } from "./types";
import { GRID_SIZE } from "./types";

/**
 * 环路四角（世界坐标，米）。
 * 西边道 x=-2（南北街的西侧车道中线），东 x=54，北 z=54，南 z=-2。
 */
const ROUTE: readonly Vector3[] = [
  new Vector3(-2, 0, -2),
  new Vector3(-2, 0, GRID_SIZE * 13 + 2), // 54
  new Vector3(54, 0, 54),
  new Vector3(54, 0, -2),
];

/** 环路每段的长度（米），与 {@link ROUTE} 索引对应 */
const SEG_LENS: readonly number[] = ROUTE.map((p, i) => p.distanceTo(ROUTE[(i + 1) % ROUTE.length]));

/** 环路总周长（米），里程取模的模数 */
export const ROUTE_LENGTH = SEG_LENS.reduce((a, b) => a + b, 0);

/** 全部巡航车辆 */
const movers: Mover[] = [];

/**
 * 最小车距（米）。同环路 1D 里程间距防追尾：
 * 后车与前车里程差小于此值时，后车本帧不动（排队跟随）。
 * 车长 8–12m，取 14m 覆盖 bus（12m）+ 余量。
 */
const MIN_GAP = 14;

/** 车辆所在的场景组（挂到 scene 上，位于 city 之外） */
export const trafficGroup = new Group();

/** 复用的临时向量，避免每帧分配 */
const samplePos = new Vector3();

/** 里程归一化到 [0, ROUTE_LENGTH) */
const modDist = (d: number): number => ((d % ROUTE_LENGTH) + ROUTE_LENGTH) % ROUTE_LENGTH;

/**
 * 里程 → 环路上的位置与朝向。
 *
 * @param dist - 沿环路累计的里程（米，任意实数，内部取模周长）
 * @param out - 位置写入目标向量
 * @returns 该点的行进方向角（绕 Y 弧度）。模型正面为 +Z，
 *          `atan2(dx, dz)` 使车头对齐 `a→b` 方向。
 */
function sampleAt(dist: number, out: Vector3): number {
  dist = ((dist % ROUTE_LENGTH) + ROUTE_LENGTH) % ROUTE_LENGTH;
  let i = 0;
  while (dist > SEG_LENS[i]) {
    dist -= SEG_LENS[i];
    i = (i + 1) % ROUTE.length;
  }
  const a = ROUTE[i];
  const b = ROUTE[(i + 1) % ROUTE.length];
  out.lerpVectors(a, b, dist / SEG_LENS[i]);
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/**
 * 注册一辆巡航车。
 *
 * @param tool - 车辆工具定义（`cab` / `bus` 等带 `props` 的车辆）
 * @param startDist - 初始里程（米），错开多辆车避免重叠
 * @param speed - 巡航速度（米/秒），建议 7–10
 * @returns 注册成功与否（资源未就绪时 `false`）
 */
export function addMover(tool: ToolDef, startDist: number, speed: number): boolean {
  const obj = make(tool.id);
  if (!obj) return false;
  trafficGroup.add(obj);
  movers.push({ obj, dist: startDist, speed });
  return true;
}

/**
 * 当前全部车辆的环上里程（米，已归一化到 [0, ROUTE_LENGTH)）。
 * 供调试/测试检查车距。
 */
export function getMoverDists(): number[] {
  return movers.map((m) => ((m.dist % ROUTE_LENGTH) + ROUTE_LENGTH) % ROUTE_LENGTH).sort((a, b) => a - b);
}

/**
 * 每帧推进全部车辆，带防追尾碰撞检测。
 *
 * 所有车辆沿同一环路同向行驶，碰撞问题即一维里程问题：
 * 按里程排序后，每辆车检查与前车（环路上前方最近的一辆）的间距，
 * 间距小于 {@link MIN_GAP} 时本帧保持不动，直到前车驶离。
 * 效果：快车追上慢车后会排队跟随，而不是从车底钻过。
 *
 * @param delta - 帧间隔（秒），来自 `Timer.getDelta()`
 */
export function updateTraffic(delta: number): void {
  if (movers.length < 2) {
    // 单车无需检测
    for (const m of movers) m.dist += m.speed * delta;
  } else {
    // 按里程升序排列；行驶方向为里程增加方向，因此前车 = sorted[i+1]（末车的前车是首车，环路回绕）
    const sorted = [...movers].sort((a, b) => modDist(a.dist) - modDist(b.dist));
    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      const ahead = sorted[(i + 1) % sorted.length];
      let aheadDist = modDist(ahead.dist);
      const myDist = modDist(m.dist);
      if (aheadDist < myDist) aheadDist += ROUTE_LENGTH; // 回绕段：前车在环路边界另一侧
      const gap = aheadDist - myDist;
      // 间距充足才前进；否则原地等待（保持里程不变）
      if (gap >= MIN_GAP) m.dist += m.speed * delta;
    }
  }

  for (const m of movers) {
    const rot = sampleAt(m.dist, samplePos);
    m.obj.position.copy(samplePos);
    m.obj.rotation.y = rot;
  }
}
