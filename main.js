// Mini Sim City — three.js × Polyfork (NYC City Kit)
// Assets are hotlinked ES modules from polyfork.dev (free tier, CORS-open, no key).
// Kit contract: snap to a 4m grid, rotate in 90° steps, y=0 ground, +Z front.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const CDN = "https://polyfork.dev/cdn/";
const GRID = 4; // kit grid: 4m
const statusEl = document.getElementById("status");
const uiEl = document.getElementById("ui");

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ec7e8);
scene.fog = new THREE.Fog(0x9ec7e8, 120, 400);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 1000);
camera.position.set(95, 85, 160);
camera.lookAt(25, 0, 15);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.05;
controls.minDistance = 10;
controls.maxDistance = 250;
controls.target.set(25, 0, 15);

// ---------------------------------------------------------------- lights
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

// ---------------------------------------------------------------- ground
const ground = new THREE.Mesh(
  new THREE.BoxGeometry(400, 1, 400),
  new THREE.MeshStandardMaterial({ color: 0x7fa35c }) // grass
);
ground.position.y = -0.55; // top face just below y=0 so ground tiles don't z-fight
ground.receiveShadow = true;
scene.add(ground);

// all placed objects live here so erase is simple
const city = new THREE.Group();
scene.add(city);

// ---------------------------------------------------------------- tools
// cells: footprint in grid cells (4m each). props: small free placement (no reservation)
// tile4: 1m ground tile scaled up to fill a 4m cell. lift: raise slightly to avoid z-fighting
const TOOLS = [
  { key: "street",   label: "街道",   id: "street-tile-c7e3cf",            cells: [2, 2], align: 2 },
  { key: "walk",     label: "人行道", id: "sidewalk-tile-4dfa7b",          cells: [1, 1] },
  { key: "plaza",    label: "广场",   id: "plaza-tile-23b48e",             cells: [1, 1] },
  { key: "brown",    label: "住宅楼", id: "brownstone-row-house-1b84fd",   cells: [4, 3] },
  { key: "tenement", label: "公寓",   id: "corner-tenement-92fb62",        cells: [4, 4] },
  { key: "office",   label: "写字楼", id: "office-tower-1538cc",           cells: [3, 3] },
  { key: "slab",     label: "板楼",   id: "postwar-apartment-slab-cee5f9", cells: [4, 3] },
  { key: "shop",     label: "商铺",   id: "one-storey-shop-row-83c958",    cells: [4, 2] },
  { key: "church",   label: "教堂",   id: "brick-church-322885",           cells: [4, 3] },
  { key: "tree",     label: "行道树", id: "street-tree-0d33f3",            cells: [1, 1], props: true },
  { key: "lamp",     label: "路灯",   id: "street-lamp-136745",            cells: [1, 1], props: true },
  { key: "bench",    label: "长椅",   id: "park-bench-dc8b62",             cells: [1, 1], props: true },
  { key: "cab",      label: "出租车", id: "yellow-cab-8df4a0",             cells: [1, 2], props: true },
  { key: "bus",      label: "巴士",   id: "city-bus-49fd97",               cells: [1, 3], props: true },
  // school district
  { key: "school",   label: "校舍",   id: "public-school-19ade5",          cells: [5, 3] },
  { key: "schoolbus",label: "校车",   id: "yellow-school-bus-0fd3b6",      cells: [1, 2], props: true },
  { key: "yard",     label: "操场地面", id: "yard-hardstanding-tile-2afb6a", cells: [1, 1], tile4: true },
  { key: "marking",  label: "场地标线", id: "playground-marking-decal-97e0b2", cells: [1, 1], tile4: true, props: true, lift: 0.02 },
  { key: "slide",    label: "滑梯",   id: "playground-slide-8b764c",       cells: [1, 1], props: true },
  { key: "round",    label: "转盘",   id: "playground-roundabout-e4d43b",  cells: [1, 1], props: true },
  { key: "teeter",   label: "跷跷板", id: "teeter-totter-ee9c62",          cells: [1, 1], props: true },
  { key: "spring",   label: "弹跳椅", id: "spring-rider-c8b8d8",           cells: [1, 1], props: true },
  // park district
  { key: "turf",     label: "草坪",   id: "playing-field-turf-tile-2b68f5", cells: [1, 1], tile4: true },
  { key: "shelter",  label: "野餐棚", id: "park-picnic-shelter-9548a3",    cells: [2, 2] },
  { key: "fountain", label: "喷泉",   id: "campus-plaza-fountain-a0cab1",  cells: [1, 1], props: true },
  { key: "hedge",    label: "树篱",   id: "clipped-boundary-hedge-run-c9027b", cells: [1, 1], props: true },
  { key: "bush",     label: "灌木",   id: "round-bush-cd2ac0",             cells: [1, 1], props: true },
  // mall district
  { key: "mall",     label: "百货商场", id: "department-store-ffbd58",     cells: [4, 4] },
  { key: "garage",   label: "停车楼", id: "parking-garage-6e4f2c",         cells: [3, 3] },
  { key: "cinema",   label: "电影院", id: "movie-theater-40eeef",          cells: [3, 2] },
  { key: "erase",    label: "推土机", id: null,                            cells: [1, 1] },
];

// ---------------------------------------------------------------- module loading
// polyfork .mjs modules export createAsset(params) -> THREE.Group.
// Load sequentially with a small gap — polite to the CDN even though it has no stated limit.
const factories = {};
async function loadAssets() {
  const ids = [...new Set(TOOLS.filter(t => t.id).map(t => t.id))];
  let done = 0;
  for (const id of ids) {
    try {
      const mod = await import(/* @vite-ignore */ CDN + id + ".mjs");
      factories[id] = mod.createAsset;
    } catch (err) {
      console.error("failed to load", id, err);
    }
    done++;
    statusEl.textContent = `加载资源 ${done}/${ids.length}…`;
    await new Promise(r => setTimeout(r, 150)); // gentle pacing
  }
  statusEl.textContent = `就绪 — ${Object.keys(factories).length}/${ids.length} 资源`;
}

function make(id, rotY = 0, tool = null) {
  const factory = factories[id];
  if (!factory) return null;
  const obj = factory();
  obj.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  obj.rotation.y = rotY;
  if (tool?.tile4) obj.scale.set(GRID, 1, GRID); // 1m ground tile → 4m cell
  return obj;
}

// ---------------------------------------------------------------- occupancy grid
// cellKey "x,z" -> placed object id; prevents overlapping footprints
const occupied = new Map();
const key = (x, z) => `${x},${z}`;
const cellsFree = (cells, cx, cz) => {
  for (let dx = 0; dx < cells[0]; dx++)
    for (let dz = 0; dz < cells[1]; dz++)
      if (occupied.has(key(cx + dx, cz + dz))) return false;
  return true;
};
const claimCells = (cells, cx, cz, tag) => {
  for (let dx = 0; dx < cells[0]; dx++)
    for (let dz = 0; dz < cells[1]; dz++)
      occupied.set(key(cx + dx, cz + dz), tag);
};
const releaseCells = (cells, cx, cz) => {
  for (let dx = 0; dx < cells[0]; dx++)
    for (let dz = 0; dz < cells[1]; dz++)
      occupied.delete(key(cx + dx, cz + dz));
};

// ---------------------------------------------------------------- ghost preview
let currentTool = TOOLS[0];
let ghost = null;
let ghostRot = 0;

function setTool(tool) {
  currentTool = tool;
  ghostRot = 0;
  if (ghost) { scene.remove(ghost); ghost = null; }
  if (tool.id && factories[tool.id]) {
    ghost = make(tool.id, 0, tool);
    if (ghost) {
      ghost.visible = false;
      scene.add(ghost);
    }
  }
  document.querySelectorAll("#ui button").forEach(b =>
    b.classList.toggle("active", b.dataset.key === tool.key));
}

// ---------------------------------------------------------------- placement
let placeCount = 0;
function snap(v, step = GRID) { return Math.round(v / step) * step; }

function place(cx, cz) {
  const t = currentTool;
  if (t.key === "erase") return;

  // align multi-cell footprints so streets land on even grid lines
  let ox = cx, oz = cz;
  if (t.align) { ox = Math.floor(ox / t.align) * t.align; oz = Math.floor(oz / t.align) * t.align; }

  if (!t.props && !cellsFree(t.cells, ox, oz)) return; // blocked
  if (!ghost) return;

  const obj = ghost.clone();
  // world position: footprint center; cells anchored at (ox, oz)
  const wx = (ox + t.cells[0] / 2) * GRID;
  const wz = (oz + t.cells[1] / 2) * GRID;
  obj.position.set(wx, t.lift || 0, wz);
  obj.rotation.y = ghostRot;
  obj.rotation.z = 0;
  city.add(obj);
  obj.userData.tool = t;
  obj.userData.ox = ox;
  obj.userData.oz = oz;
  obj.userData.rot = ghostRot;
  placeCount++;

  if (!t.props) claimCells(t.cells, ox, oz, obj.uuid);
  saveCity();
}

function eraseAt(obj) {
  if (!obj.userData.tool) return;
  releaseCells(obj.userData.tool.cells, obj.userData.ox, obj.userData.oz);
  city.remove(obj);
  saveCity();
  // clones share geometry/materials with the ghost build — do NOT dispose, just detach
}

function tryErase(intersection) {
  // walk up to the direct child of `city`
  let o = intersection.object;
  while (o.parent && o.parent !== city) o = o.parent;
  if (o.parent === city) eraseAt(o);
}

// ---------------------------------------------------------------- input
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();
let downPos = null; // {x, y, button} — 用于区分"点击"与"拖拽旋转视角"
const CLICK_SLOP = 6; // px

function updatePointer(e) {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}

function groundCell() {
  if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return null;
  return { cx: Math.floor(hitPoint.x / GRID), cz: Math.floor(hitPoint.z / GRID) };
}

function isClick(e) {
  return downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) < CLICK_SLOP;
}

function moveGhost() {
  if (!ghost) return;
  const cell = groundCell();
  if (!cell) { ghost.visible = false; return; }
  let { cx, cz } = cell;
  if (currentTool.align) { cx = Math.floor(cx / currentTool.align) * currentTool.align; cz = Math.floor(cz / currentTool.align) * currentTool.align; }
  ghost.visible = true;
  ghost.position.set((cx + currentTool.cells[0] / 2) * GRID, currentTool.lift || 0, (cz + currentTool.cells[1] / 2) * GRID);
  ghost.rotation.y = ghostRot;
  const free = currentTool.props || cellsFree(currentTool.cells, cx, cz);
  // blocked spots show the ghost tilted slightly as a hint (cheap, avoids touching shared materials)
  ghost.rotation.z = free ? 0 : 0.02;
}

renderer.domElement.addEventListener("pointermove", e => {
  updatePointer(e);
  if (currentTool.key === "erase") return;
  moveGhost();
});

renderer.domElement.addEventListener("pointerdown", e => {
  downPos = { x: e.clientX, y: e.clientY, button: e.button };
  updatePointer(e);
});

renderer.domElement.addEventListener("pointerup", e => {
  updatePointer(e);
  if (!isClick(e)) { downPos = null; return; } // 拖拽视角，不做任何编辑
  downPos = null;

  if (e.button === 0 && currentTool.key !== "erase") {
    // 左键单击：放置
    const cell = groundCell();
    if (cell) { place(cell.cx, cell.cz); moveGhost(); }
  } else if (e.button === 2 || (e.button === 0 && currentTool.key === "erase")) {
    // 右键单击（或推土机左键）：删除
    const hits = raycaster.intersectObjects(city.children, true);
    if (hits.length) tryErase(hits[0]);
  }
});

renderer.domElement.addEventListener("contextmenu", e => e.preventDefault());
window.addEventListener("keydown", e => {
  if (e.key === "r") { ghostRot += Math.PI / 2; moveGhost(); }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- starter city
// a small pre-built downtown: streets, sidewalks, buildings, trees, a cab
function buildStarterCity() {
  // streets: two 2-cell-wide avenues crossing at the center (cells -12..12)
  for (let cx = -12; cx < 12; cx += 2)
    for (let cz = -2; cz < 2; cz += 2)
      claimAndPlace("street", cx, cz);
  for (let cz = -12; cz < 12; cz += 2)
    for (let cx = -2; cx < 2; cx += 2)
      claimAndPlace("street", cx, cz);

  // sidewalk ring around the four blocks
  for (let i = -12; i < 12; i++) {
    for (const [cx, cz] of [[i, -3], [i, 2], [-3, i], [2, i]]) {
      claimAndPlace("walk", cx, cz);
    }
  }

  // buildings on each block
  claimAndPlace("brown",   -11, -11);
  claimAndPlace("tenement", -7, -11);
  claimAndPlace("slab",    -11,  -7);
  claimAndPlace("office",   -6,  -6);
  claimAndPlace("brown",     3, -11);
  claimAndPlace("shop",      8, -11);
  claimAndPlace("church",    3,  -7);
  claimAndPlace("brown",   -11,   3);
  claimAndPlace("brown",    -7,   3);
  claimAndPlace("slab",    -11,   8);
  claimAndPlace("brown",     3,   3);
  claimAndPlace("office",    8,   3);
  claimAndPlace("brown",     3,   8);
  claimAndPlace("shop",      8,   8);

  // trees & lamps along sidewalks, a couple of cars on the street
  for (const [cx, cz] of [[-4, -3], [0, -3], [1, 3], [-3, 6], [6, 2], [10, 2], [2, 6], [-3, -6]])
    claimAndPlace("tree", cx, cz, true);
  for (const [cx, cz] of [[-8, -3], [4, 3], [-3, -10], [2, 10]])
    claimAndPlace("lamp", cx, cz, true);
  claimAndPlace("cab", 1, -9, true, Math.PI / 2);
  claimAndPlace("bus", 1, 6, true, Math.PI / 2);
}

function claimAndPlace(toolKey, cx, cz, isProp = false, rotY = 0) {
  const t = TOOLS.find(t => t.key === toolKey);
  if (!t || !factories[t.id]) return;
  if (!isProp && !cellsFree(t.cells, cx, cz)) return; // avoid overlap / z-fighting
  const obj = make(t.id, rotY, t);
  if (!obj) return;
  obj.position.set((cx + t.cells[0] / 2) * GRID, t.lift || 0, (cz + t.cells[1] / 2) * GRID);
  city.add(obj);
  obj.userData.tool = t;
  obj.userData.ox = cx;
  obj.userData.oz = cz;
  obj.userData.rot = rotY;
  if (!isProp) claimCells(t.cells, cx, cz, obj.uuid);
}

// ---------------------------------------------------------------- save / load
// 自动保存到 localStorage：每次放置或删除后快照整个城市
const SAVE_KEY = "minisimcity.v1";

function saveCity() {
  try {
    const items = city.children.map(o => ({
      k: o.userData.tool?.key,
      x: o.userData.ox,
      z: o.userData.oz,
      r: o.userData.rot || 0,
    }));
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, items }));
  } catch (e) { console.warn("save failed", e); }
}

function loadCity() {
  let data;
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { data = null; }
  if (!data?.items?.length) return false;
  for (const it of data.items) {
    const t = TOOLS.find(t => t.key === it.k);
    if (!t) continue;
    claimAndPlace(it.k, it.x, it.z, !!t.props, it.r || 0); // props 不占格，与原行为一致
  }
  return true;
}

function clearCity() {
  while (city.children.length) eraseAt(city.children[0]);
}

// ---------------------------------------------------------------- moving traffic
// 车辆沿街道环路巡航（世界坐标，贴着车道右侧）。放在独立组：不参与占位/存档/删除
const traffic = new THREE.Group();
scene.add(traffic);

// 环路四角：西边道 x=-2（南北向街中央西侧），东边道 x=54，北边道 z=54，南边道 z=-2
const ROUTE = [
  new THREE.Vector3(-2, 0, -2),
  new THREE.Vector3(-2, 0, 54),
  new THREE.Vector3(54, 0, 54),
  new THREE.Vector3(54, 0, -2),
];
// 每段累计长度，用于按里程取样位置
const segLens = ROUTE.map((p, i) => p.distanceTo(ROUTE[(i + 1) % ROUTE.length]));
const routeLen = segLens.reduce((a, b) => a + b, 0);
const movers = [];

function posAt(dist, out) {
  dist = ((dist % routeLen) + routeLen) % routeLen;
  let i = 0;
  while (dist > segLens[i]) { dist -= segLens[i]; i = (i + 1) % ROUTE.length; }
  const a = ROUTE[i], b = ROUTE[(i + 1) % ROUTE.length];
  out.lerpVectors(a, b, dist / segLens[i]);
  // 车头朝行进方向（模型正面 +Z）
  return Math.atan2(b.x - a.x, b.z - a.z);
}

function addMover(toolKey, startDist, speed) {
  const t = TOOLS.find(t => t.key === toolKey);
  if (!t || !factories[t.id]) return;
  const obj = make(t.id);
  if (!obj) return;
  traffic.add(obj);
  movers.push({ obj, dist: startDist, speed });
}

const moverPos = new THREE.Vector3();
function updateTraffic(dt) {
  for (const m of movers) {
    m.dist += m.speed * dt;
    const rot = posAt(m.dist, moverPos);
    m.obj.position.copy(moverPos);
    m.obj.rotation.y = rot; // 车头朝行进方向，90° 直角弯符合低模风格
  }
}

// ---------------------------------------------------------------- districts
// new street bands open up the south-east, then fill school / park / mall quarters
function buildDistricts() {
  // connect the old avenues to the new bands (cols/rows 12..15, world 48..64m)
  for (let cx = 12; cx < 16; cx += 2)
    for (let cz = -2; cz < 2; cz += 2) claimAndPlace("street", cx, cz);
  for (let cz = 12; cz < 16; cz += 2)
    for (let cx = -2; cx < 2; cx += 2) claimAndPlace("street", cx, cz);

  // new full-length avenue bands
  for (let i = -12; i < 16; i += 2) {
    for (const cz of [12, 14]) claimAndPlace("street", i, cz);
    for (const cx of [12, 14]) claimAndPlace("street", cx, i);
  }

  // sidewalk rings flanking the new streets
  for (let i = -12; i < 16; i++) {
    for (const [cx, cz] of [[i, 11], [11, i], [i, 16], [16, i]])
      claimAndPlace("walk", cx, cz);
  }

  buildSchoolQuarter();
  buildParkQuarter();
  buildMallQuarter();
}

// SCHOOL QUARTER: cols 3..10 × rows 17..24 (south of the new avenue)
function buildSchoolQuarter() {
  claimAndPlace("school", 3, 17);           // 5×3 cells → cols 3-7, rows 17-19
  claimAndPlace("schoolbus", 9, 17, true);  // parked beside the school

  // playground hardstanding, cols 3..6 × rows 21..24
  for (let cx = 3; cx < 7; cx++)
    for (let cz = 21; cz < 25; cz++) claimAndPlace("yard", cx, cz);
  // hopscotch-style markings, then equipment on top
  claimAndPlace("marking", 3, 21, true);
  claimAndPlace("marking", 5, 23, true);
  claimAndPlace("slide",   3, 24, true, Math.PI);      // facing into the yard
  claimAndPlace("round",   5, 22, true);
  claimAndPlace("teeter",  4, 24, true);
  claimAndPlace("spring",  6, 21, true);
  claimAndPlace("spring",  6, 24, true);
  // a couple of trees on the fence line
  claimAndPlace("tree", 10, 21, true);
  claimAndPlace("tree", 10, 24, true);
}

// PARK QUARTER: cols 17..24 × rows 3..10 (east of the new avenue)
function buildParkQuarter() {
  for (let cx = 17; cx < 25; cx++)
    for (let cz = 3; cz < 11; cz++) claimAndPlace("turf", cx, cz);

  claimAndPlace("shelter", 17, 3);          // 2×2 cells in the corner
  claimAndPlace("fountain", 21, 6, true);   // centrepiece

  // hedge border (leave gaps as paths at rows/cols 3 and 10 midpoints)
  for (let cx = 17; cx < 25; cx++) {
    if (cx !== 20 && cx !== 21) claimAndPlace("hedge", cx, 3, true);
    if (cx !== 20 && cx !== 21) claimAndPlace("hedge", cx, 10, true, Math.PI);
  }
  for (let cz = 4; cz < 10; cz++) {
    claimAndPlace("hedge", 17, cz, true, Math.PI / 2);
    claimAndPlace("hedge", 24, cz, true, -Math.PI / 2);
  }

  // benches, trees and bushes scattered inside
  claimAndPlace("bench", 20, 7, true, Math.PI);
  claimAndPlace("bench", 22, 7, true, Math.PI);
  for (const [cx, cz] of [[19, 5], [22, 4], [23, 8], [18, 7]])
    claimAndPlace("tree", cx, cz, true);
  for (const [cx, cz] of [[18, 10], [23, 3], [19, 9], [22, 9]])
    claimAndPlace("bush", cx, cz, true);
}

// MALL QUARTER: cols 17..24 × rows -11..-4
function buildMallQuarter() {
  claimAndPlace("mall",   17, -11);         // 4×4 cells → cols 17-20, rows -11..-8
  claimAndPlace("garage", 21, -11);         // 3×3 cells → cols 21-23
  claimAndPlace("cinema", 21, -7);          // 3×2 cells → rows -7..-6

  // cabs and lamps around the plaza edge
  claimAndPlace("cab", 24, -10, true, -Math.PI / 2);
  claimAndPlace("cab", 24, -8, true, -Math.PI / 2);
  claimAndPlace("cab", 17, -6, true);
  claimAndPlace("lamp", 24, -5, true);
  claimAndPlace("lamp", 20, -4, true);
}

// ---------------------------------------------------------------- UI toolbar
function buildUI() {
  for (const t of TOOLS) {
    const b = document.createElement("button");
    b.textContent = t.label;
    b.dataset.key = t.key;
    b.addEventListener("click", () => setTool(t));
    uiEl.appendChild(b);
  }
}

// 重置按钮：清空存档并重建默认城市
function addResetButton() {
  const b = document.createElement("button");
  b.textContent = "重置城市";
  b.addEventListener("click", () => {
    localStorage.removeItem(SAVE_KEY);
    clearCity();
    occupied.clear();
    buildStarterCity();
    buildDistricts();
    saveCity();
  });
  uiEl.appendChild(b);
}

// ---------------------------------------------------------------- loop
const timer = new THREE.Timer();
timer.connect(document);

function animate() {
  timer.update();
  controls.update();
  updateTraffic(timer.getDelta());
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

// ---------------------------------------------------------------- boot
(async () => {
  buildUI();
  addResetButton();
  await loadAssets();

  // 有存档则恢复进度，否则生成默认城市并写入首个存档
  if (!loadCity()) {
    buildStarterCity();
    buildDistricts();
    saveCity();
  }

  // 巡游车队：3 辆出租车 + 1 辆巴士沿环路行驶
  addMover("cab", 0, 9);
  addMover("cab", routeLen * 0.33, 8);
  addMover("cab", routeLen * 0.66, 10);
  addMover("bus", routeLen * 0.5, 7);

  setTool(TOOLS[1]); // sidewalk by default
})();
