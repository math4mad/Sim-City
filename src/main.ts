/**
 * Mini Sim City — 主入口。
 *
 * 一个基于 three.js 与 polyfork 免费资源库的迷你城市规划游戏：
 * - 左键单击放置 · `R` 旋转 · 右键单击删除 · 拖拽旋转视角
 * - 自动存档（localStorage），刷新即恢复
 * - 车辆沿环路巡航
 *
 * 模块划分：
 * - {@link types} — 全部类型契约
 * - {@link tools} — 工具目录
 * - {@link assets} — polyfork 资源加载/实例化
 * - {@link grid} — 占位网格
 * - {@link save} — 存档系统
 * - {@link traffic} — 巡航车辆
 * - {@link city} — 预置城市
 *
 * @category 主入口
 * @packageDocumentation
 * @module main
 */

import * as THREE from "three";
import { Group, Timer } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { loadAssets, make } from "./assets";
import { claimAndPlace, buildDefaultCity } from "./city";
import { cellsFree, claimCells, clearOccupancy, releaseCells } from "./grid";
import { clearSave, readSave, saveCity, toolFromSave } from "./save";
import { TOOLS } from "./tools";
import { addMover, getMoverDists, ROUTE_LENGTH, trafficGroup, updateTraffic } from "./traffic";
import { GRID_SIZE } from "./types";

import type { ToolDef, PlacedMeta } from "./types";

// ---------------------------------------------------------------------------
// 常量与 DOM
// ---------------------------------------------------------------------------

/** 单击判定的最大位移（px）：按下与抬起间距小于此值视为点击，否则为拖拽视角 */
const CLICK_SLOP = 6;

/** 状态栏（右上角，显示加载进度） */
const statusEl = document.getElementById("status") as HTMLElement;
/** 工具栏容器 */
const uiEl = document.getElementById("ui") as HTMLElement;

// ---------------------------------------------------------------------------
// 渲染器 / 场景 / 相机
// ---------------------------------------------------------------------------

/** WebGL 渲染器：开 MSAA 与阴影， capped DPR ≤ 2 保填充率 */
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

/** 游戏场景：浅蓝天空 + 线性雾 */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ec7e8);
scene.fog = new THREE.Fog(0x9ec7e8, 120, 400);

/** 俯瞰相机：注视城市中心偏新区一侧 */
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 1000);
camera.position.set(95, 85, 160);
camera.lookAt(25, 0, 15);

/** 轨道控制器：左键拖拽旋转视角（与编辑点击通过 CLICK_SLOP 区分） */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.05;
controls.minDistance = 10;
controls.maxDistance = 250;
controls.target.set(25, 0, 15);

// ---------------------------------------------------------------------------
// 光照
// ---------------------------------------------------------------------------

/** 主平行光（太阳），带 4096² 阴影贴图覆盖 ±130m */
const sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
sun.position.set(60, 90, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -130;
sun.shadow.camera.right = 130;
sun.shadow.camera.top = 130;
sun.shadow.camera.bottom = -130;
sun.shadow.camera.far = 400;
sun.shadow.bias = -0.0005;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbdd9ff, 0x6b7a5a, 1.1));

// ---------------------------------------------------------------------------
// 地面与城市组
// ---------------------------------------------------------------------------

/** 草地基底：顶面压到 y=-0.05 之下，避免与街砖 z-fighting */
const ground = new THREE.Mesh(
  new THREE.BoxGeometry(400, 1, 400),
  new THREE.MeshStandardMaterial({ color: 0x7fa35c }),
);
ground.position.y = -0.55;
ground.receiveShadow = true;
scene.add(ground);

/** 全部玩家放置对象挂在此组；存档即序列化它的 children */
const city = new Group();
scene.add(city);

// ---------------------------------------------------------------------------
// 当前工具与幽灵预览
// ---------------------------------------------------------------------------

/** 当前选中的工具（初始为人行道） */
let currentTool: ToolDef = TOOLS[1];
/** 幽灵预览对象（跟随鼠标，占位被阻时轻微倾斜示意） */
let ghost: Group | null = null;
/** 幽灵当前朝向（弧度，`R` 键 90° 步进） */
let ghostRot = 0;

/**
 * 切换当前工具并重建幽灵预览。
 * @param tool - 目标工具定义
 */
function setTool(tool: ToolDef): void {
  currentTool = tool;
  ghostRot = 0;
  if (ghost) {
    scene.remove(ghost);
    ghost = null;
  }
  ghost = make(tool.id, 0, tool);
  if (ghost) {
    ghost.visible = false;
    scene.add(ghost);
  }
  document.querySelectorAll<HTMLButtonElement>("#ui button").forEach((b) =>
    b.classList.toggle("active", b.dataset.key === tool.key),
  );
}

// ---------------------------------------------------------------------------
// 放置与删除
// ---------------------------------------------------------------------------

/**
 * 在网格坐标放置当前工具。
 *
 * - 多格 footprint 按 `tool.align` 对齐到偶数格线（街砖拼接）
 * - 非 `props` 工具先查占位网格，被阻则放弃
 * - 成功后登记占位并触发自动存档
 *
 * @param cx - 点击命中的网格 X
 * @param cz - 点击命中的网格 Z
 */
function place(cx: number, cz: number): void {
  const t = currentTool;
  if (t.key === "erase" || !ghost) return;

  let ox = cx;
  let oz = cz;
  if (t.align) {
    ox = Math.floor(ox / t.align) * t.align;
    oz = Math.floor(oz / t.align) * t.align;
  }
  if (!t.props && !cellsFree(t.cells, ox, oz)) return;

  const obj = ghost.clone();
  obj.position.set((ox + t.cells[0] / 2) * GRID_SIZE, t.lift ?? 0, (oz + t.cells[1] / 2) * GRID_SIZE);
  obj.rotation.y = ghostRot;
  obj.rotation.z = 0;
  city.add(obj);

  const meta: PlacedMeta = { tool: t, ox, oz, rot: ghostRot };
  Object.assign(obj.userData, meta);

  if (!t.props) claimCells(t.cells, ox, oz, obj.uuid);
  saveCity(city);
}

/**
 * 删除一个已放置对象并释放其占位、刷新存档。
 * @param obj - `city` 的直接子对象（须带 PlacedMeta）
 */
function eraseAt(obj: Group): void {
  const meta = obj.userData as Partial<PlacedMeta>;
  if (!meta.tool) return;
  releaseCells(meta.tool.cells, meta.ox!, meta.oz!);
  city.remove(obj);
  // 克隆与幽灵共享几何体/材质，仅从场景摘除，不做 dispose
  saveCity(city);
}

/**
 * 从射线命中的最深网格节点上溯到 `city` 的直接子对象并删除。
 * @param intersection - `raycaster.intersectObjects` 的首个命中
 */
function tryErase(intersection: { object: THREE.Object3D }): void {
  let o = intersection.object;
  while (o.parent && o.parent !== city) o = o.parent;
  if (o.parent === city) eraseAt(o as Group);
}

// ---------------------------------------------------------------------------
// 输入：点击 vs 拖拽
// ---------------------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
/** y=0 地面平面：指针拾取面 */
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();
/** 按下时的指针状态，`null` 表示无按下 */
let downPos: { x: number; y: number; button: number } | null = null;

/** 更新内部 raycaster 到指针位置 */
function updatePointer(e: PointerEvent): void {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}

/**
 * 指针射线与地面平面的交点 → 网格坐标。
 * @returns 网格坐标；射线未与地面相交（如仰角过平）时 `null`
 */
function groundCell(): { cx: number; cz: number } | null {
  if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return null;
  return { cx: Math.floor(hitPoint.x / GRID_SIZE), cz: Math.floor(hitPoint.z / GRID_SIZE) };
}

/**
 * 判定本次抬起是否为"点击"：须有按下记录且位移 < {@link CLICK_SLOP}。
 * 拖拽旋转视角不触发任何编辑操作。
 */
function isClick(e: PointerEvent): boolean {
  return (
    downPos !== null &&
    Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) < CLICK_SLOP
  );
}

/** 幽灵跟随鼠标：吸附到网格，占位被阻时轻微倾斜（rotation.z=0.02）示意 */
function moveGhost(): void {
  if (!ghost) return;
  const cell = groundCell();
  if (!cell) {
    ghost.visible = false;
    return;
  }
  let { cx, cz } = cell;
  if (currentTool.align) {
    cx = Math.floor(cx / currentTool.align) * currentTool.align;
    cz = Math.floor(cz / currentTool.align) * currentTool.align;
  }
  ghost.visible = true;
  ghost.position.set(
    (cx + currentTool.cells[0] / 2) * GRID_SIZE,
    currentTool.lift ?? 0,
    (cz + currentTool.cells[1] / 2) * GRID_SIZE,
  );
  ghost.rotation.y = ghostRot;
  const free = currentTool.props === true || cellsFree(currentTool.cells, cx, cz);
  ghost.rotation.z = free ? 0 : 0.02;
}

renderer.domElement.addEventListener("pointermove", (e) => {
  updatePointer(e);
  if (currentTool.key === "erase") return;
  moveGhost();
});

renderer.domElement.addEventListener("pointerdown", (e) => {
  downPos = { x: e.clientX, y: e.clientY, button: e.button };
  updatePointer(e);
});

renderer.domElement.addEventListener("pointerup", (e) => {
  updatePointer(e);
  if (!isClick(e)) {
    downPos = null;
    return; // 拖拽视角，不编辑
  }
  downPos = null;

  if (e.button === 0 && currentTool.key !== "erase") {
    const cell = groundCell();
    if (cell) {
      place(cell.cx, cell.cz);
      moveGhost();
    }
  } else if (e.button === 2 || (e.button === 0 && currentTool.key === "erase")) {
    const hits = raycaster.intersectObjects(city.children, true);
    if (hits.length) tryErase(hits[0] as { object: THREE.Object3D });
  }
});

renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("keydown", (e) => {
  if (e.key === "r") {
    ghostRot += Math.PI / 2;
    moveGhost();
  }
});
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// UI 工具栏
// ---------------------------------------------------------------------------

/** 按目录渲染工具按钮，点击即 {@link setTool} */
function buildUI(): void {
  for (const t of TOOLS) {
    const b = document.createElement("button");
    b.textContent = t.label;
    b.dataset.key = t.key;
    b.addEventListener("click", () => setTool(t));
    uiEl.appendChild(b);
  }
}

/**
 * "重置城市"按钮：清存档 → 清场景与占位 → 重建默认城市并存档。
 */
function addResetButton(): void {
  const b = document.createElement("button");
  b.textContent = "重置城市";
  b.addEventListener("click", () => {
    clearSave();
    while (city.children.length) city.remove(city.children[0]);
    clearOccupancy();
    buildDefaultCity(TOOLS, city);
    saveCity(city);
  });
  uiEl.appendChild(b);
}

// ---------------------------------------------------------------------------
// 主循环
// ---------------------------------------------------------------------------

/** 帧计时器（标签页隐藏时自动冻结 delta） */
const timer = new Timer();
timer.connect(document);

renderer.setAnimationLoop(() => {
  timer.update();
  controls.update();
  updateTraffic(timer.getDelta());
  renderer.render(scene, camera);
});

// ---------------------------------------------------------------------------
// 启动
// ---------------------------------------------------------------------------

void (async () => {
  buildUI();
  addResetButton();
  const { ready, total } = await loadAssets(TOOLS, (msg) => (statusEl.textContent = msg));
  statusEl.textContent = `就绪 — ${ready}/${total} 资源`;

  // 有存档则重放；否则生成默认城市并写入首个存档
  const saved = readSave();
  if (saved) {
    for (const it of saved) {
      const t = toolFromSave(it.k, TOOLS);
      if (t) claimAndPlace(TOOLS, city, t.key, it.x, it.z, t.props === true, it.r);
    }
  } else {
    buildDefaultCity(TOOLS, city);
    saveCity(city);
  }

  // 巡游车队：3 辆出租车 + 1 辆巴士，里程错开
  void addMover(TOOLS.find((t) => t.key === "cab")!, 0, 9);
  void addMover(TOOLS.find((t) => t.key === "cab")!, ROUTE_LENGTH * 0.33, 8);
  void addMover(TOOLS.find((t) => t.key === "cab")!, ROUTE_LENGTH * 0.66, 10);
  void addMover(TOOLS.find((t) => t.key === "bus")!, ROUTE_LENGTH * 0.5, 7);
  scene.add(trafficGroup);

  // 调试句柄：供控制台/自动化测试读取真实车辆里程
  window.__trafficDists = getMoverDists;

  setTool(TOOLS[1]);
})();

// 供调试/控制台访问
export { city };

// 运行时窗口调试类型
declare global {
  interface Window {
    /** 调试：读取全部巡航车辆的环上里程（米） */
    __trafficDists: () => number[];
  }
}
export type { ToolDef, PlacedMeta, SaveData, SaveItem } from "./types";
