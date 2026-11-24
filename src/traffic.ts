/**
 * 巡航交通 — 沿固定环路行驶的车辆。
 *
 * 环路覆盖城市四条边道，拐角以四分之一圆弧过渡（半径 {@link CORNER_R}），
 * 车辆沿弧线连续转弯，朝向逐帧平滑变化，不再是生硬的 90° 瞬切。
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

/** 拐角圆弧半径（米）。车道中线距街缘约 2m，8m 半径接近真实路口转弯半径 */
const CORNER_R = 8;

/**
 * 环路几何 — 由四个"车道中线上的拐角点"定义的圆角矩形。
 *
 * 采样为折线（直线段 + 圆弧弦段），并预计算每段的长度与
 * 出段方向角，运行时按里程 O(段数) 定位。
 */
interface RouteSeg {
  /** 段起点（世界坐标） */
  a: Vector3;
  /** 段终点（世界坐标） */
  b: Vector3;
  /** 段长（米） */
  len: number;
  /** 段方向角（绕 Y 弧度，atan2(dx, dz)，模型正面 +Z） */
  heading: number;
}

// 四个直角拐点（车道中线）
const CORNERS: readonly Vector3[] = [
  new Vector3(-2, 0, -2),
  new Vector3(-2, 0, GRID_SIZE * 13 + 2), // (−2, 54)
  new Vector3(54, 0, 54),
  new Vector3(54, 0, -2),
];

/** 预计算圆角折线段表：每条边一条直线段 + 每个拐角一条弧（弦采样 N 段） */
const SEGS: RouteSeg[] = (() => {
  const segs: RouteSeg[] = [];
  const push = (a: Vector3, b: Vector3) => {
    segs.push({ a, b, len: a.distanceTo(b), heading: Math.atan2(b.x - a.x, b.z - a.z) });
  };
  const ARC_STEPS = 8; // 每个 90° 拐角弧的采样数 → 每步 11.25°，视觉平滑
  const n = CORNERS.length;

  // 每个拐角的入弯点 / 出弯点
  const arcIn: Vector3[] = [];
  const arcOut: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const cur = CORNERS[i];
    const dirIn = cur.clone().sub(CORNERS[(i - 1 + n) % n]).normalize(); // 朝拐角方向
    const dirOut = CORNERS[(i + 1) % n].clone().sub(cur).normalize(); // 离开拐角方向
    arcIn.push(cur.clone().addScaledVector(dirIn, -CORNER_R)); // 沿入边回退 R
    arcOut.push(cur.clone().addScaledVector(dirOut, CORNER_R)); // 沿出边前进 R
  }

  for (let i = 0; i < n; i++) {
    // 1) 本边直线段：上个拐角的出弯点 → 本拐角的入弯点
    push(arcOut[(i - 1 + n) % n], arcIn[i]);
    // 2) 本拐角圆弧：arcIn[i] → arcOut[i]，四分之一圆，按角度插值弦采样
    // 弧心几何：从入弯点沿"出边行进方向"偏移 R（验证：到两条路中线距离均为 R，
    // 切点分别落在入边回退 R 处与出边前进 R 处，弧经拐角内侧过渡）
    const a0 = arcIn[i];
    const a1 = arcOut[i];
    const dirOut = CORNERS[(i + 1) % n].clone().sub(CORNERS[i]).normalize();
    const center = a0.clone().addScaledVector(dirOut, CORNER_R);
    // 起止角（以弧心为原点，XZ 平面）
    const ang0 = Math.atan2(a0.z - center.z, a0.x - center.x);
    const ang1 = Math.atan2(a1.z - center.z, a1.x - center.x);
    // 处理角度回绕，保证从 ang0 到 ang1 走 90°
    let sweep = ang1 - ang0;
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    while (sweep < -Math.PI) sweep += 2 * Math.PI;
    let prev = a0;
    for (let s = 1; s <= ARC_STEPS; s++) {
      const ang = ang0 + (sweep * s) / ARC_STEPS;
      const p = new Vector3(center.x + CORNER_R * Math.cos(ang), 0, center.z + CORNER_R * Math.sin(ang));
      push(prev, p);
      prev = p;
    }
  }
  return segs;
})();

/** 环路总周长（米），里程取模的模数 */
export const ROUTE_LENGTH = SEGS.reduce((s, seg) => s + seg.len, 0);

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
 * 路线为圆角折线（直线 + 弧弦段），车辆在弧段上逐帧改变朝向，
 * 转弯视觉平滑。段方向角已在 {@link SEGS} 预计算，这里只做定位。
 *
 * @param dist - 沿环路累计的里程（米，任意实数，内部取模周长）
 * @param out - 位置写入目标向量
 * @returns 该点的行进方向角（绕 Y 弧度）。模型正面为 +Z，
 *          `atan2(dx, dz)` 使车头对齐 `a→b` 方向。
 */
function sampleAt(dist: number, out: Vector3): number {
  dist = modDist(dist);
  for (const seg of SEGS) {
    if (dist <= seg.len) {
      out.lerpVectors(seg.a, seg.b, dist / seg.len);
      return seg.heading;
    }
    dist -= seg.len;
  }
  // 浮点余量：回退到最后一段终点
  const last = SEGS[SEGS.length - 1];
  out.copy(last.b);
  return last.heading;
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
 * 沿环路每 2m 采样朝向角（度），供调试验证转弯平滑性。
 */
export function debugHeadings(): number[] {
  const v = new Vector3();
  const out: number[] = [];
  for (let d = 0; d < ROUTE_LENGTH; d += 2) {
    out.push(Math.round((sampleAt(d, v) * 180) / Math.PI));
  }
  return out;
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
