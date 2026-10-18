import { CLASSES, DUNGEON, HUB, NPCS, PORTAL_POS, WORLD, ZONES } from "./data";
import type { ClassId, Mob, Npc } from "./types";
import { EverwakeGame } from "./engine";

const TAU = Math.PI * 2;
const FIRE = { x: HUB.x - 25, y: HUB.y + 20 };

const TREE_GREEN = [
  { dark: "#294a33", mid: "#3e6442", light: "#577d50", trunk: "#55402c" },
  { dark: "#25422f", mid: "#36583b", light: "#4d7148", trunk: "#4a3829" },
  { dark: "#2d4d36", mid: "#416844", light: "#5b8153", trunk: "#5a422d" },
];
const TREE_GLOAM = [
  { dark: "#1e3336", mid: "#2a4241", light: "#3e5851", trunk: "#41342e" },
  { dark: "#252f3c", mid: "#303f48", light: "#46575b", trunk: "#3b332f" },
  { dark: "#28383a", mid: "#364b47", light: "#4b6155", trunk: "#4a3a30" },
];
const TREE_DEAD = [
  { dark: "#3a3b35", mid: "#4a4a40", light: "#5b5a4c", trunk: "#4d4237" },
  { dark: "#343630", mid: "#44453b", light: "#565446", trunk: "#433a32" },
];

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function roadDistance(px: number, py: number): number {
  const main = [
    [850, 790],
    [1080, 760],
    [1320, 870],
    [1620, 975],
    [1930, 1000],
    [2230, 940],
    [2520, 930],
  ];
  const south = [
    [820, 900],
    [930, 1140],
    [1160, 1400],
    [1370, 1670],
    [1500, 1930],
  ];
  let closest = Infinity;
  for (const path of [main, south]) {
    for (let i = 0; i < path.length - 1; i += 1) {
      closest = Math.min(
        closest,
        segmentDistance(px, py, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]),
      );
    }
  }
  return closest;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawRoad(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(64, 49, 35, 0.34)";
  ctx.lineWidth = 74;
  ctx.beginPath();
  ctx.moveTo(850, 790);
  ctx.bezierCurveTo(1120, 740, 1340, 900, 1630, 975);
  ctx.bezierCurveTo(1940, 1045, 2200, 930, 2550, 925);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(820, 900);
  ctx.bezierCurveTo(930, 1200, 1220, 1470, 1380, 1690);
  ctx.bezierCurveTo(1450, 1800, 1490, 1910, 1510, 1980);
  ctx.stroke();

  ctx.strokeStyle = "#7f6a4d";
  ctx.lineWidth = 50;
  ctx.beginPath();
  ctx.moveTo(850, 790);
  ctx.bezierCurveTo(1120, 740, 1340, 900, 1630, 975);
  ctx.bezierCurveTo(1940, 1045, 2200, 930, 2550, 925);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(820, 900);
  ctx.bezierCurveTo(930, 1200, 1220, 1470, 1380, 1690);
  ctx.bezierCurveTo(1450, 1800, 1490, 1910, 1510, 1980);
  ctx.stroke();

  ctx.strokeStyle = "rgba(189, 163, 112, 0.3)";
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(850, 790);
  ctx.bezierCurveTo(1120, 740, 1340, 900, 1630, 975);
  ctx.bezierCurveTo(1940, 1045, 2200, 930, 2550, 925);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(820, 900);
  ctx.bezierCurveTo(930, 1200, 1220, 1470, 1380, 1690);
  ctx.bezierCurveTo(1450, 1800, 1490, 1910, 1510, 1980);
  ctx.stroke();

  const rng = mulberry32(991);
  for (let i = 0; i < 150; i += 1) {
    const t = rng();
    const x = 850 + t * 1650 + (rng() - 0.5) * 46;
    const y = 790 + Math.sin(t * 4.2) * 120 + 170 * t + (rng() - 0.5) * 22;
    ctx.fillStyle = `rgba(202, 180, 136, ${0.06 + rng() * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 2 + rng() * 4, 1 + rng() * 2, rng() * TAU, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  palette: { dark: string; mid: string; light: string; trunk: string },
  seed: number,
  dead = false,
): void {
  const rng = mulberry32(seed);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(5, 13, 9, 0.26)";
  ctx.beginPath();
  ctx.ellipse(5, 3, size * 0.6, size * 0.2, 0.08, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = palette.trunk;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(3, size * 0.13);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.05, -size * 0.36, size * 0.02, -size * 0.72);
  ctx.stroke();
  if (dead) {
    ctx.lineWidth = Math.max(1.5, size * 0.05);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.4);
    ctx.lineTo(-size * 0.3, -size * 0.77);
    ctx.moveTo(0, -size * 0.52);
    ctx.lineTo(size * 0.34, -size * 0.82);
    ctx.moveTo(-size * 0.1, -size * 0.62);
    ctx.lineTo(-size * 0.24, -size * 1.02);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const blobs = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < blobs; i += 1) {
    const angle = rng() * TAU;
    const radius = size * (0.12 + rng() * 0.28);
    const bx = Math.cos(angle) * radius;
    const by = -size * (0.74 + rng() * 0.22) + Math.sin(angle) * radius * 0.46;
    const blobSize = size * (0.35 + rng() * 0.24);
    ctx.fillStyle = i === 0 ? palette.dark : palette.mid;
    ctx.beginPath();
    ctx.arc(bx, by, blobSize, 0, TAU);
    ctx.fill();
    ctx.fillStyle = palette.light;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(bx - blobSize * 0.22, by - blobSize * 0.25, blobSize * 0.54, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawCamp(ctx: CanvasRenderingContext2D): void {
  const rng = mulberry32(410);
  ctx.save();
  const plaza = ctx.createRadialGradient(HUB.x, HUB.y, 22, HUB.x, HUB.y, 240);
  plaza.addColorStop(0, "#776c55");
  plaza.addColorStop(0.7, "#655d4a");
  plaza.addColorStop(1, "rgba(70, 65, 51, 0)");
  ctx.fillStyle = plaza;
  ctx.beginPath();
  ctx.arc(HUB.x, HUB.y, 246, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = "rgba(213, 188, 131, 0.23)";
  ctx.lineWidth = 2;
  for (const radius of [118, 168, 218]) {
    ctx.beginPath();
    ctx.arc(HUB.x, HUB.y, radius, 0, TAU);
    ctx.stroke();
  }
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * TAU;
    ctx.save();
    ctx.translate(HUB.x + Math.cos(angle) * 194, HUB.y + Math.sin(angle) * 194);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = "rgba(218, 192, 137, 0.16)";
    ctx.fillRect(-2, -10, 4, 20);
    ctx.fillRect(-8, -3, 16, 3);
    ctx.restore();
  }

  for (let i = 0; i < 95; i += 1) {
    const angle = rng() * TAU;
    const radius = Math.sqrt(rng()) * 230;
    const x = HUB.x + Math.cos(angle) * radius;
    const y = HUB.y + Math.sin(angle) * radius;
    ctx.fillStyle = `rgba(205, 188, 151, ${0.018 + rng() * 0.035})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 8 + rng() * 24, 4 + rng() * 11, rng() * TAU, 0, TAU);
    ctx.fill();
  }

  // The fire ring.
  ctx.fillStyle = "#4b4338";
  ctx.beginPath();
  ctx.arc(FIRE.x, FIRE.y, 33, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * TAU;
    ctx.fillStyle = i % 2 === 0 ? "#80735d" : "#6a5e4d";
    ctx.beginPath();
    ctx.ellipse(FIRE.x + Math.cos(angle) * 31, FIRE.y + Math.sin(angle) * 31, 8, 5, angle, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = "#3b2a1d";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(FIRE.x - 20, FIRE.y + 3);
  ctx.lineTo(FIRE.x + 18, FIRE.y - 3);
  ctx.moveTo(FIRE.x - 14, FIRE.y - 12);
  ctx.lineTo(FIRE.x + 13, FIRE.y + 12);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 126, 48, 0.55)";
  ctx.beginPath();
  ctx.arc(FIRE.x, FIRE.y, 13, 0, TAU);
  ctx.fill();

  // String lights around the plaza.
  ctx.strokeStyle = "rgba(217, 188, 131, 0.32)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(622, 594);
  ctx.quadraticCurveTo(770, 645, 930, 584);
  ctx.stroke();
  for (let i = 0; i < 8; i += 1) {
    const t = i / 7;
    const x = 622 + (930 - 622) * t;
    const y = 594 + Math.sin(t * Math.PI) * -18 + 26 * t + 8;
    ctx.fillStyle = i % 2 ? "#ffd083" : "#f5b564";
    ctx.shadowColor = "#ffc46f";
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.arc(x, y, 2.3, 0, TAU);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  drawTent(ctx, 566, 674, 70, "#71513a", "#b88a58");
  drawTent(ctx, 626, 940, 62, "#4d5e55", "#8e9d7e");
  drawInn(ctx, 1032, 800);
  drawMarket(ctx, 984, 568);
  drawWaystone(ctx, 443, 716);
  drawCampBanner(ctx, 914, 858);
  drawQuestBoard(ctx, 834, 932);
  ctx.restore();
}

function drawTent(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  colorA: string,
  colorB: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(4, 9, 7, 0.32)";
  ctx.beginPath();
  ctx.ellipse(4, 7, size * 0.8, size * 0.24, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = colorA;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.95);
  ctx.lineTo(-size * 0.82, size * 0.2);
  ctx.lineTo(size * 0.82, size * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colorB;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.95);
  ctx.lineTo(-size * 0.14, size * 0.2);
  ctx.lineTo(size * 0.82, size * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(26, 19, 14, 0.72)";
  ctx.beginPath();
  ctx.moveTo(-size * 0.22, size * 0.2);
  ctx.quadraticCurveTo(0, -size * 0.3, size * 0.22, size * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(228, 198, 144, 0.45)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.95);
  ctx.lineTo(0, -size * 1.23);
  ctx.stroke();
  ctx.fillStyle = "#bb493f";
  ctx.beginPath();
  ctx.moveTo(0, -size * 1.23);
  ctx.lineTo(size * 0.25, -size * 1.13);
  ctx.lineTo(0, -size * 1.04);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawInn(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(4, 8, 6, 0.34)";
  ctx.beginPath();
  ctx.ellipse(8, 36, 156, 38, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "#3b332a";
  ctx.fillRect(-132, -20, 264, 68);
  ctx.fillStyle = "#6f604b";
  ctx.fillRect(-124, -30, 248, 68);
  ctx.fillStyle = "#85745a";
  ctx.fillRect(-116, -38, 232, 14);
  ctx.fillStyle = "#2d2923";
  for (let i = 0; i < 5; i += 1) {
    ctx.fillRect(-120 + i * 58, -30, 4, 64);
  }
  ctx.fillStyle = "#463b2e";
  ctx.beginPath();
  ctx.moveTo(-150, -34);
  ctx.lineTo(-86, -105);
  ctx.lineTo(94, -105);
  ctx.lineTo(152, -34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#574736";
  ctx.beginPath();
  ctx.moveTo(-142, -36);
  ctx.lineTo(-80, -99);
  ctx.lineTo(88, -99);
  ctx.lineTo(143, -36);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(26, 21, 16, 0.45)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-126 + i * 63, -38);
    ctx.lineTo(-72 + i * 36, -96);
    ctx.stroke();
  }
  ctx.fillStyle = "#241d18";
  ctx.fillRect(-20, -18, 42, 58);
  ctx.fillStyle = "rgba(255, 199, 110, 0.85)";
  ctx.beginPath();
  ctx.arc(-84, -2, 5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#d6ad61";
  drawRoundedRect(ctx, -95, -55, 60, 18, 3);
  ctx.fill();
  ctx.fillStyle = "#3b2d1e";
  ctx.font = "700 10px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("THE LAMP & LARK", -65, -42);
  ctx.fillStyle = "#574736";
  ctx.fillRect(96, -112, 22, 43);
  ctx.fillStyle = "rgba(126, 116, 103, 0.4)";
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(107, -122 - i * 10, 5 + i * 3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawMarket(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(5, 9, 6, 0.3)";
  ctx.beginPath();
  ctx.ellipse(3, 30, 76, 20, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#5a4733";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-56, 28);
  ctx.lineTo(-56, -42);
  ctx.moveTo(56, 28);
  ctx.lineTo(56, -42);
  ctx.stroke();
  ctx.fillStyle = "#5f3b44";
  ctx.beginPath();
  ctx.moveTo(-68, -34);
  ctx.lineTo(68, -34);
  ctx.lineTo(54, -56);
  ctx.lineTo(-54, -56);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d5b274";
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-60 + i * 25, -34);
    ctx.lineTo(-46 + i * 25, -34);
    ctx.lineTo(-50 + i * 25, -56);
    ctx.lineTo(-62 + i * 25, -56);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "#4e3b2a";
  ctx.fillRect(-50, -18, 100, 46);
  ctx.fillStyle = "#766043";
  ctx.fillRect(-46, -22, 92, 10);
  ctx.fillStyle = "#a7834f";
  ctx.beginPath();
  ctx.arc(-25, -25, 9, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#7f9b6b";
  ctx.beginPath();
  ctx.arc(-2, -25, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#c56f58";
  ctx.beginPath();
  ctx.arc(19, -25, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#584331";
  ctx.fillRect(64, -4, 24, 32);
  ctx.fillStyle = "#876d4f";
  ctx.fillRect(67, -10, 18, 9);
  ctx.restore();
}

function drawWaystone(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(4, 8, 6, 0.32)";
  ctx.beginPath();
  ctx.ellipse(4, 6, 22, 8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#5b5a4d";
  ctx.beginPath();
  ctx.moveTo(-14, 4);
  ctx.lineTo(-10, -60);
  ctx.lineTo(5, -74);
  ctx.lineTo(15, -55);
  ctx.lineTo(17, 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(141, 214, 183, 0.62)";
  ctx.lineWidth = 1.5;
  ctx.save();
  ctx.translate(0, -33);
  ctx.rotate(0.14);
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(8, -4);
  ctx.lineTo(2, 11);
  ctx.lineTo(-8, 2);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -2, 12, 0, TAU);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawCampBanner(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#4f3e2b";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 28);
  ctx.lineTo(0, -76);
  ctx.stroke();
  ctx.fillStyle = "#6f3034";
  ctx.beginPath();
  ctx.moveTo(1, -72);
  ctx.lineTo(46, -64);
  ctx.lineTo(43, -22);
  ctx.lineTo(1, -31);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#d5b46e";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(22, -48, 11, 0, TAU);
  ctx.moveTo(22, -62);
  ctx.lineTo(22, -34);
  ctx.moveTo(8, -48);
  ctx.lineTo(36, -48);
  ctx.stroke();
  ctx.restore();
}

function drawQuestBoard(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(4, 8, 6, 0.3)";
  ctx.beginPath();
  ctx.ellipse(2, 5, 36, 10, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#4b3826";
  ctx.fillRect(-38, -28, 4, 34);
  ctx.fillRect(34, -28, 4, 34);
  ctx.fillStyle = "#67513a";
  ctx.fillRect(-42, -42, 84, 26);
  ctx.fillStyle = "#b5a181";
  ctx.fillRect(-34, -38, 24, 16);
  ctx.fillStyle = "#8f7d66";
  ctx.fillRect(-5, -40, 18, 20);
  ctx.fillStyle = "#c0ad8c";
  ctx.fillRect(18, -35, 17, 13);
  ctx.strokeStyle = "rgba(84, 28, 26, 0.65)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-28, -31);
  ctx.lineTo(-16, -31);
  ctx.moveTo(-28, -27);
  ctx.lineTo(-20, -27);
  ctx.stroke();
  ctx.restore();
}

function drawRuins(ctx: CanvasRenderingContext2D): void {
  const rng = mulberry32(772);
  ctx.save();
  const ground = ctx.createRadialGradient(1510, 1830, 30, 1510, 1830, 440);
  ground.addColorStop(0, "rgba(91, 88, 75, 0.85)");
  ground.addColorStop(0.6, "rgba(74, 72, 62, 0.52)");
  ground.addColorStop(1, "rgba(74, 72, 62, 0)");
  ctx.fillStyle = ground;
  ctx.beginPath();
  ctx.ellipse(1510, 1830, 470, 360, -0.1, 0, TAU);
  ctx.fill();

  for (let i = 0; i < 55; i += 1) {
    const x = 1220 + rng() * 570;
    const y = 1620 + rng() * 420;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rng() - 0.5) * 0.2);
    ctx.fillStyle = `rgba(120, 118, 103, ${0.1 + rng() * 0.18})`;
    ctx.fillRect(-16 - rng() * 18, -10 - rng() * 8, 32 + rng() * 34, 20 + rng() * 14);
    ctx.restore();
  }
  ctx.strokeStyle = "rgba(34, 31, 28, 0.3)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 16; i += 1) {
    let x = 1320 + rng() * 390;
    let y = 1680 + rng() * 300;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 3; j += 1) {
      x += (rng() - 0.5) * 55;
      y += 12 + rng() * 18;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const columns = [
    [1270, 1690, 94],
    [1740, 1700, 120],
    [1300, 1950, 70],
    [1710, 1920, 88],
  ] as const;
  for (const [x, y, height] of columns) {
    ctx.fillStyle = "rgba(4, 7, 6, 0.26)";
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 4, 27, 11, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#5a594f";
    ctx.fillRect(x - 18, y - height, 36, height);
    ctx.fillStyle = "#6d6b5e";
    ctx.fillRect(x - 13, y - height, 10, height);
    ctx.fillStyle = "#4a4941";
    ctx.fillRect(x - 24, y - 9, 48, 12);
    for (let j = 0; j < 4; j += 1) {
      ctx.fillRect(x - 18 + j * 10, y - height + 8, 4, height - 18);
    }
  }
  ctx.fillStyle = "#5f5d50";
  ctx.save();
  ctx.translate(1500, 1608);
  ctx.rotate(-0.16);
  ctx.fillRect(-70, -14, 140, 28);
  ctx.fillStyle = "#4b4a40";
  ctx.fillRect(-62, -8, 124, 5);
  ctx.restore();

  // Dais and stairs to the sealed reliquary.
  ctx.fillStyle = "#57564a";
  ctx.beginPath();
  ctx.ellipse(PORTAL_POS.x, PORTAL_POS.y + 62, 116, 68, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#676557";
  for (let i = 0; i < 4; i += 1) {
    ctx.fillRect(PORTAL_POS.x - 80 + i * 4, PORTAL_POS.y + 28 + i * 12, 160 - i * 8, 11);
  }
  ctx.strokeStyle = "rgba(133, 218, 202, 0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(PORTAL_POS.x, PORTAL_POS.y + 10, 82, 0.15, Math.PI - 0.15);
  ctx.stroke();
  drawArch(ctx, PORTAL_POS.x, PORTAL_POS.y + 8, 1.15);
  ctx.restore();
}

function drawArch(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#565c54";
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-70, 4);
  ctx.lineTo(-70, -72);
  ctx.quadraticCurveTo(-64, -124, 0, -126);
  ctx.quadraticCurveTo(64, -124, 70, -72);
  ctx.lineTo(70, 4);
  ctx.stroke();
  ctx.strokeStyle = "rgba(143, 227, 207, 0.24)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-56, -48);
  ctx.quadraticCurveTo(-50, -108, 0, -110);
  ctx.quadraticCurveTo(50, -108, 56, -48);
  ctx.stroke();
  ctx.restore();
}

function drawGloamMushrooms(ctx: CanvasRenderingContext2D): void {
  const rng = mulberry32(405);
  for (let i = 0; i < 68; i += 1) {
    const x = 1910 + rng() * 960;
    const y = 350 + rng() * 1000;
    if (roadDistance(x, y) < 45) continue;
    const size = 2 + rng() * 5;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 5);
    glow.addColorStop(0, "rgba(118, 237, 211, 0.25)");
    glow.addColorStop(1, "rgba(118, 237, 211, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, size * 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#8fe7d3";
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 0.55, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#cbfff2";
    ctx.beginPath();
    ctx.arc(x - size * 0.2, y - size * 0.2, size * 0.26, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function drawWorldBackground(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rng = mulberry32(4821);
  canvas.width = WORLD.width;
  canvas.height = WORLD.height;

  ctx.fillStyle = "#2d4835";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  drawnGroundPatches(ctx, rng);

  const gloamGlow = ctx.createRadialGradient(2350, 900, 100, 2350, 900, 860);
  gloamGlow.addColorStop(0, "rgba(24, 32, 43, 0.48)");
  gloamGlow.addColorStop(0.7, "rgba(27, 36, 44, 0.24)");
  gloamGlow.addColorStop(1, "rgba(27, 36, 44, 0)");
  ctx.fillStyle = gloamGlow;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  const ruinsGlow = ctx.createRadialGradient(1510, 1830, 40, 1510, 1830, 650);
  ruinsGlow.addColorStop(0, "rgba(89, 77, 63, 0.32)");
  ruinsGlow.addColorStop(1, "rgba(89, 77, 63, 0)");
  ctx.fillStyle = ruinsGlow;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  drawRoad(ctx);
  drawRuins(ctx);
  drawCamp(ctx);
  drawGloamMushrooms(ctx);

  // Scatter small ground details.
  for (let i = 0; i < 1100; i += 1) {
    const x = rng() * WORLD.width;
    const y = rng() * WORLD.height;
    if (Math.hypot(x - HUB.x, y - HUB.y) < 235) continue;
    if (roadDistance(x, y) < 32) continue;
    const gloam = x > 1950 && y < 1430;
    const dead = x > 1950 && y > 1430;
    ctx.strokeStyle = gloam
      ? "rgba(91, 122, 107, 0.34)"
      : dead
        ? "rgba(129, 120, 99, 0.24)"
        : `rgba(112, 145, 96, ${0.15 + rng() * 0.2})`;
    ctx.lineWidth = 1;
    const height = 3 + rng() * 8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (rng() - 0.5) * 5, y - height * 0.5, x + (rng() - 0.5) * 8, y - height);
    ctx.stroke();
  }

  for (let i = 0; i < 220; i += 1) {
    const x = 950 + rng() * 930;
    const y = 640 + rng() * 760;
    if (roadDistance(x, y) < 40) continue;
    ctx.fillStyle = rng() < 0.5 ? "rgba(201, 192, 131, 0.5)" : "rgba(194, 147, 154, 0.44)";
    ctx.beginPath();
    ctx.arc(x, y, 1.1 + rng() * 1.7, 0, TAU);
    ctx.fill();
  }

  // Trees.
  for (let i = 0; i < 360; i += 1) {
    let x = rng() * WORLD.width;
    let y = rng() * WORLD.height;
    if (i > 300) {
      // Dense border forest frames the world.
      if (rng() < 0.5) {
        x = rng() < 0.5 ? 20 + rng() * 180 : WORLD.width - 20 - rng() * 180;
      } else {
        y = rng() < 0.5 ? 20 + rng() * 150 : WORLD.height - 20 - rng() * 150;
      }
    }
    if (Math.hypot(x - HUB.x, y - HUB.y) < 345) continue;
    if (Math.hypot(x - PORTAL_POS.x, y - PORTAL_POS.y) < 245) continue;
    if (roadDistance(x, y) < 64) continue;
    if (x > 1260 && x < 1770 && y > 1590 && y < 2050) continue;
    const gloam = x > 1950 && y < 1500;
    const dead = x > 1950 && y > 1500;
    if (!gloam && !dead && rng() < 0.23) continue;
    const palette = dead
      ? TREE_DEAD[i % TREE_DEAD.length]
      : gloam
        ? TREE_GLOAM[i % TREE_GLOAM.length]
        : TREE_GREEN[i % TREE_GREEN.length];
    const size = 34 + rng() * 52 + (gloam ? 8 : 0);
    drawTree(ctx, x, y, size, palette, 1000 + i, dead);
  }

  // Rocks and bushes.
  for (let i = 0; i < 75; i += 1) {
    const x = rng() * WORLD.width;
    const y = rng() * WORLD.height;
    if (Math.hypot(x - HUB.x, y - HUB.y) < 300 || roadDistance(x, y) < 55) continue;
    if (Math.hypot(x - PORTAL_POS.x, y - PORTAL_POS.y) < 220) continue;
    ctx.save();
    ctx.translate(x, y);
    const size = 6 + rng() * 17;
    ctx.fillStyle = "rgba(6, 12, 8, 0.2)";
    ctx.beginPath();
    ctx.ellipse(4, 3, size, size * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rng() > 0.5 ? "#62655b" : "#6b6c60";
    ctx.beginPath();
    ctx.moveTo(-size, 2);
    ctx.lineTo(-size * 0.45, -size * 0.7);
    ctx.lineTo(size * 0.4, -size * 0.5);
    ctx.lineTo(size, 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(152, 155, 138, 0.3)";
    ctx.beginPath();
    ctx.ellipse(-size * 0.15, -size * 0.35, size * 0.4, size * 0.18, -0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Boundary water/mist darkening.
  const edge = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  edge.addColorStop(0, "rgba(10, 23, 18, 0.35)");
  edge.addColorStop(0.16, "rgba(10, 23, 18, 0)");
  edge.addColorStop(0.82, "rgba(10, 23, 18, 0)");
  edge.addColorStop(1, "rgba(10, 23, 18, 0.5)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
}

function drawnGroundPatches(ctx: CanvasRenderingContext2D, rng: () => number): void {
  for (let i = 0; i < 1200; i += 1) {
    const x = rng() * WORLD.width;
    const y = rng() * WORLD.height;
    const gloam = x > 1950 && y < 1450;
    const dead = x > 1950 && y > 1450;
    ctx.fillStyle = gloam
      ? `rgba(25, 48, 48, ${0.025 + rng() * 0.06})`
      : dead
        ? `rgba(92, 85, 69, ${0.02 + rng() * 0.05})`
        : `rgba(91, 125, 83, ${0.025 + rng() * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      18 + rng() * 90,
      8 + rng() * 42,
      rng() * TAU,
      0,
      TAU,
    );
    ctx.fill();
  }
  for (let i = 0; i < 260; i += 1) {
    const x = rng() * WORLD.width;
    const y = rng() * WORLD.height;
    ctx.fillStyle = `rgba(210, 187, 116, ${0.02 + rng() * 0.04})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 4 + rng() * 22, 2 + rng() * 8, rng() * TAU, 0, TAU);
    ctx.fill();
  }
}

function drawDungeonBackground(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rng = mulberry32(663);
  canvas.width = DUNGEON.width;
  canvas.height = DUNGEON.height;

  const bg = ctx.createRadialGradient(750, 560, 40, 750, 560, 820);
  bg.addColorStop(0, "#243437");
  bg.addColorStop(0.45, "#172629");
  bg.addColorStop(1, "#090f11");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, DUNGEON.width, DUNGEON.height);

  ctx.save();
  ctx.strokeStyle = "rgba(91, 132, 127, 0.3)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 16; i += 1) {
    const x = 80 + rng() * (DUNGEON.width - 160);
    const y = 80 + rng() * (DUNGEON.height - 160);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + rng() * 120 - 60, y + rng() * 80 - 40);
    ctx.stroke();
  }

  const floor = ctx.createRadialGradient(760, 620, 30, 760, 620, 590);
  floor.addColorStop(0, "#344a4a");
  floor.addColorStop(0.55, "#273c3d");
  floor.addColorStop(1, "#121f21");
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.ellipse(760, 620, 660, 500, 0, 0, TAU);
  ctx.fill();

  // Stone tiles.
  for (let y = 118; y < 1060; y += 68) {
    for (let x = 60; x < 1450; x += 82) {
      if (Math.hypot(x - 760, y - 620) > 630 && y < 1000) continue;
      const offset = (Math.floor(y / 68) % 2) * 41;
      ctx.fillStyle = rng() > 0.5 ? "rgba(110, 145, 139, 0.035)" : "rgba(3, 11, 12, 0.1)";
      ctx.fillRect(x + offset + 1, y + 1, 78, 64);
      ctx.strokeStyle = "rgba(5, 15, 16, 0.38)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + offset, y, 80, 66);
    }
  }

  // Central ritual circles.
  for (const [radius, alpha] of [
    [360, 0.18],
    [280, 0.12],
    [198, 0.1],
  ] as const) {
    ctx.strokeStyle = `rgba(130, 225, 205, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(760, 610, radius, 0, TAU);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(760, 610);
  for (let i = 0; i < 12; i += 1) {
    ctx.rotate(TAU / 12);
    ctx.fillStyle = "rgba(153, 234, 216, 0.2)";
    ctx.fillRect(-1.5, -322, 3, 18);
    ctx.fillStyle = "rgba(153, 234, 216, 0.12)";
    ctx.beginPath();
    ctx.arc(0, -300, 3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // Water channels.
  ctx.strokeStyle = "rgba(63, 136, 132, 0.24)";
  ctx.lineWidth = 44;
  ctx.beginPath();
  ctx.moveTo(0, 830);
  ctx.bezierCurveTo(250, 770, 350, 880, 520, 840);
  ctx.stroke();
  ctx.strokeStyle = "rgba(127, 218, 205, 0.12)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 826);
  ctx.bezierCurveTo(250, 766, 350, 876, 520, 836);
  ctx.stroke();

  // Boss dais.
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? "#304345" : "#293c3e";
    ctx.fillRect(560 - i * 14, 410 + i * 12, 400 + i * 28, 18);
  }
  ctx.fillStyle = "#2d4143";
  ctx.beginPath();
  ctx.ellipse(760, 380, 190, 92, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(142, 242, 219, 0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(760, 380, 150, 70, 0, 0, TAU);
  ctx.stroke();

  // Pillars.
  const pillars = [
    [260, 340],
    [1260, 330],
    [230, 840],
    [1290, 860],
    [450, 950],
    [1080, 940],
  ] as const;
  for (const [x, y] of pillars) {
    ctx.fillStyle = "rgba(3, 8, 7, 0.35)";
    ctx.beginPath();
    ctx.ellipse(x + 12, y + 10, 46, 18, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#35484a";
    ctx.fillRect(x - 28, y - 160, 56, 168);
    ctx.fillStyle = "#405658";
    ctx.fillRect(x - 19, y - 160, 14, 168);
    ctx.fillStyle = "#243638";
    ctx.fillRect(x - 35, y - 12, 70, 16);
    ctx.fillRect(x - 38, y - 174, 76, 17);
    ctx.strokeStyle = "rgba(109, 180, 168, 0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 152);
    ctx.lineTo(x + 6, y - 132);
    ctx.lineTo(x - 2, y - 112);
    ctx.stroke();
  }

  // Bones, rubble and reeds.
  for (let i = 0; i < 120; i += 1) {
    const x = 90 + rng() * 1320;
    const y = 110 + rng() * 920;
    if (Math.hypot(x - 760, y - 620) < 220 && rng() < 0.7) continue;
    const size = 2 + rng() * 9;
    ctx.fillStyle = `rgba(128, 147, 132, ${0.06 + rng() * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 0.35, rng() * TAU, 0, TAU);
    ctx.fill();
  }

  // Entrance stairs.
  for (let i = 0; i < 6; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? "#283b3c" : "#304647";
    ctx.fillRect(570 - i * 10, 1030 + i * 12, 380 + i * 20, 15);
  }
  ctx.fillStyle = "rgba(97, 217, 198, 0.17)";
  ctx.beginPath();
  ctx.ellipse(750, 1110, 80, 24, 0, 0, TAU);
  ctx.fill();

  const edge = ctx.createRadialGradient(750, 600, 200, 750, 600, 790);
  edge.addColorStop(0, "rgba(2, 7, 8, 0)");
  edge.addColorStop(1, "rgba(2, 7, 8, 0.78)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, DUNGEON.width, DUNGEON.height);
  ctx.restore();
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private game: EverwakeGame;
  private worldCanvas: HTMLCanvasElement;
  private dungeonCanvas: HTMLCanvasElement;
  private minimapWorld: HTMLCanvasElement;
  private minimapDungeon: HTMLCanvasElement;
  private width = 1;
  private height = 1;
  private camera = { x: 0, y: 0, initialized: false, scene: "world" as "world" | "dungeon" };
  private time = 0;
  private shakeAmount = 0;
  private flashColor = "rgba(255,255,255,0.2)";
  private flashAlpha = 0;
  private resizeHandler: () => void;
  private rainDrops: { x: number; y: number; speed: number; len: number; alpha: number; width: number }[] = [];
  private ashFlakes: { x: number; y: number; speed: number; phase: number; size: number; alpha: number }[] = [];

  constructor(canvas: HTMLCanvasElement, game: EverwakeGame) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;
    this.game = game;
    this.worldCanvas = document.createElement("canvas");
    this.dungeonCanvas = document.createElement("canvas");
    this.minimapWorld = document.createElement("canvas");
    this.minimapDungeon = document.createElement("canvas");
    this.build();
    this.resizeHandler = () => this.resize();
    window.addEventListener("resize", this.resizeHandler);
    this.resize();
  }

  private build(): void {
    drawWorldBackground(this.worldCanvas);
    drawDungeonBackground(this.dungeonCanvas);
    this.makeMinimap(this.worldCanvas, this.minimapWorld);
    this.makeMinimap(this.dungeonCanvas, this.minimapDungeon);
  }

  private makeMinimap(source: HTMLCanvasElement, target: HTMLCanvasElement): void {
    target.width = 260;
    target.height = 195;
    const ctx = target.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(source, 0, 0, target.width, target.height);
    ctx.fillStyle = "rgba(11, 20, 16, 0.24)";
    ctx.fillRect(0, 0, target.width, target.height);
  }

  respawnTrees(): void {
    drawWorldBackground(this.worldCanvas);
    this.makeMinimap(this.worldCanvas, this.minimapWorld);
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
  }

  screenToWorld(x: number, y: number): { x: number; y: number } {
    return { x: x + this.camera.x, y: y + this.camera.y };
  }

  flash(color: string, alpha: number): void {
    this.flashColor = color;
    this.flashAlpha = alpha;
  }

  shake(strength: number): void {
    this.shakeAmount = Math.max(this.shakeAmount, strength);
  }

  render(dt: number): void {
    this.time += dt;
    this.updateCamera(dt);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#0d1713";
    ctx.fillRect(0, 0, this.width, this.height);

    const shakeX = (Math.random() - 0.5) * this.shakeAmount;
    const shakeY = (Math.random() - 0.5) * this.shakeAmount;
    this.shakeAmount *= Math.pow(0.0025, dt);
    if (this.shakeAmount < 0.05) this.shakeAmount = 0;

    ctx.save();
    ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);

    const map = this.game.scene === "dungeon" ? this.dungeonCanvas : this.worldCanvas;
    const mapWidth = this.game.scene === "dungeon" ? DUNGEON.width : WORLD.width;
    const mapHeight = this.game.scene === "dungeon" ? DUNGEON.height : WORLD.height;
    const sourceWidth = Math.min(this.width, mapWidth);
    const sourceHeight = Math.min(this.height, mapHeight);
    const sourceX = clamp(this.camera.x, 0, Math.max(0, mapWidth - sourceWidth));
    const sourceY = clamp(this.camera.y, 0, Math.max(0, mapHeight - sourceHeight));
    ctx.drawImage(
      map,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      this.camera.x,
      this.camera.y,
      sourceWidth,
      sourceHeight,
    );

    this.drawWorldGlows(ctx);
    this.drawTargetRings(ctx);
    this.drawActors(ctx);
    this.drawNameplates(ctx);
    this.drawParticles(ctx);
    this.drawFloaters(ctx);
    ctx.restore();

    this.drawWeather(ctx, dt);
    this.drawAtmosphere(ctx);
    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.fillStyle = this.flashColor;
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 1.8);
    }
  }

  private updateCamera(dt: number): void {
    const scene = this.game.scene;
    if (this.camera.scene !== scene) {
      this.camera.scene = scene;
      this.camera.initialized = false;
    }
    const mapWidth = scene === "dungeon" ? DUNGEON.width : WORLD.width;
    const mapHeight = scene === "dungeon" ? DUNGEON.height : WORLD.height;
    let targetX: number;
    let targetY: number;
    if (this.game.mode === "title") {
      targetX = HUB.x + Math.cos(this.time * 0.075) * 145;
      targetY = HUB.y + 54 + Math.sin(this.time * 0.052) * 70;
    } else {
      targetX = this.game.player.x;
      targetY = this.game.player.y;
    }
    const maxX = Math.max(0, mapWidth - this.width);
    const maxY = Math.max(0, mapHeight - this.height);
    const destinationX = clamp(targetX - this.width / 2, 0, maxX);
    const destinationY = clamp(targetY - this.height / 2, 0, maxY);
    if (!this.camera.initialized) {
      this.camera.x = destinationX;
      this.camera.y = destinationY;
      this.camera.initialized = true;
      return;
    }
    const follow = this.game.mode === "title" ? 1 - Math.pow(0.3, dt) : 1 - Math.pow(0.000001, dt);
    this.camera.x += (destinationX - this.camera.x) * follow;
    this.camera.y += (destinationY - this.camera.y) * follow;
  }

  private drawWorldGlows(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (this.game.scene === "world") {
      this.drawFireGlow(ctx);
      if (this.game.rift.active) {
        const rift = this.game.rift;
        const pulse = 0.7 + Math.sin(this.time * 4) * 0.15;
        const glow = ctx.createRadialGradient(rift.x, rift.y, 10, rift.x, rift.y, 170);
        glow.addColorStop(0, `rgba(187, 123, 255, ${0.22 * pulse})`);
        glow.addColorStop(0.5, "rgba(138, 92, 238, 0.08)");
        glow.addColorStop(1, "rgba(138, 92, 238, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(rift.x - 180, rift.y - 280, 360, 430);
        ctx.strokeStyle = `rgba(218, 187, 255, ${0.28 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(rift.x, rift.y + 10, 46, 17, 0, 0, TAU);
        ctx.stroke();
      }
    } else {
      const boss = this.game.mobs.find((mob) => mob.boss && mob.alive);
      if (boss) {
        const glow = ctx.createRadialGradient(boss.x, boss.y, 10, boss.x, boss.y, 210);
        glow.addColorStop(0, "rgba(91, 242, 217, 0.16)");
        glow.addColorStop(1, "rgba(91, 242, 217, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(boss.x - 220, boss.y - 280, 440, 430);
      }
      const gate = this.game.npcs.find((npc) => npc.role === "portal");
      if (gate) {
        const glow = ctx.createRadialGradient(gate.x, gate.y, 4, gate.x, gate.y, 105);
        glow.addColorStop(0, "rgba(141, 243, 225, 0.22)");
        glow.addColorStop(1, "rgba(141, 243, 225, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(gate.x - 110, gate.y - 150, 220, 240);
      }
    }
    ctx.restore();
  }

  private drawFireGlow(ctx: CanvasRenderingContext2D): void {
    const flicker = 0.9 + Math.sin(this.time * 9) * 0.08 + Math.sin(this.time * 15.7) * 0.04;
    const glow = ctx.createRadialGradient(FIRE.x, FIRE.y, 5, FIRE.x, FIRE.y, 155 * flicker);
    glow.addColorStop(0, "rgba(255, 201, 114, 0.28)");
    glow.addColorStop(0.4, "rgba(255, 148, 70, 0.1)");
    glow.addColorStop(1, "rgba(255, 148, 70, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(FIRE.x - 170, FIRE.y - 170, 340, 340);

    ctx.fillStyle = "#f4a14f";
    ctx.beginPath();
    ctx.moveTo(FIRE.x - 9, FIRE.y + 3);
    ctx.quadraticCurveTo(FIRE.x - 17, FIRE.y - 20 * flicker, FIRE.x - 1, FIRE.y - 34 * flicker);
    ctx.quadraticCurveTo(FIRE.x + 2, FIRE.y - 16, FIRE.x + 9, FIRE.y + 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffe0a0";
    ctx.beginPath();
    ctx.moveTo(FIRE.x - 2, FIRE.y + 2);
    ctx.quadraticCurveTo(FIRE.x - 8, FIRE.y - 14 * flicker, FIRE.x + 1, FIRE.y - 23 * flicker);
    ctx.quadraticCurveTo(FIRE.x + 6, FIRE.y - 8, FIRE.x + 5, FIRE.y + 2);
    ctx.closePath();
    ctx.fill();
  }

  private drawPortal(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    time: number,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(0, -60, 4, 0, -60, 106);
    glow.addColorStop(0, "rgba(157, 255, 232, 0.4)");
    glow.addColorStop(0.45, "rgba(88, 222, 204, 0.12)");
    glow.addColorStop(1, "rgba(88, 222, 204, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-120, -180, 240, 240);
    ctx.fillStyle = "rgba(77, 218, 203, 0.22)";
    ctx.beginPath();
    ctx.ellipse(0, -47, 42, 68, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(174, 255, 240, 0.38)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      const rotation = time * (0.35 + i * 0.12) + i * 2.1;
      ctx.beginPath();
      ctx.ellipse(0, -47, 30 + i * 10, 50 + i * 9, rotation * 0.12, 0.3, Math.PI * 1.8);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(5, 22, 22, 0.55)";
    ctx.beginPath();
    ctx.ellipse(0, -47, 31, 55, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(130, 255, 234, 0.65)";
    for (let i = 0; i < 4; i += 1) {
      const angle = time * 0.5 + i * 1.6;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * 24, -47 + Math.sin(angle) * 38, 1.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawTargetRings(ctx: CanvasRenderingContext2D): void {
    const target = this.game.getTarget();
    if (target) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 151, 126, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(target.x, target.y + 1, target.radius + 14, (target.radius + 14) * 0.42, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 151, 126, 0.25)";
      ctx.beginPath();
      ctx.ellipse(target.x, target.y + 1, target.radius + 22, (target.radius + 22) * 0.42, 0, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 4; i += 1) {
        const angle = this.time * 0.6 + (i / 4) * TAU;
        const radius = target.radius + 18;
        ctx.fillStyle = "rgba(255, 176, 145, 0.85)";
        ctx.beginPath();
        ctx.arc(target.x + Math.cos(angle) * radius, target.y + Math.sin(angle) * radius * 0.42, 2.2, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    if (this.game.mode !== "title") {
      const player = this.game.player;
      const classDef = CLASSES[player.classId];
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = classDef.color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(player.x, player.y + 1, 28, 12, 0, 0, TAU);
      ctx.stroke();
      if (player.shield > 0) {
        ctx.strokeStyle = "rgba(170, 211, 255, 0.7)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(player.x, player.y - 23, 31, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    const interactable = this.game.getInteractable();
    if (interactable) {
      const npc = interactable.npc;
      ctx.save();
      ctx.strokeStyle = "rgba(233, 208, 151, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 7]);
      ctx.lineDashOffset = -this.time * 16;
      ctx.beginPath();
      ctx.ellipse(npc.x, npc.y + 2, npc.role === "portal" ? 54 : 32, npc.role === "portal" ? 18 : 10, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawActors(ctx: CanvasRenderingContext2D): void {
    type Drawable = { y: number; draw: () => void };
    const drawables: Drawable[] = [];
    const scene = this.game.scene;

    for (const npc of this.game.npcs) {
      drawables.push({
        y: npc.y,
        draw: () => {
          if (npc.role === "portal") {
            this.drawPortal(ctx, npc.x, npc.y, scene === "dungeon" ? 0.68 : 0.95, this.time + 1.7);
          } else {
            this.drawNpcBody(ctx, npc);
          }
        },
      });
    }

    for (const bot of this.game.bots) {
      if (scene === "dungeon") continue;
      drawables.push({
        y: bot.y,
        draw: () => this.drawHeroBody(ctx, bot.x, bot.y, bot.classId, bot.color, bot.walkPhase, bot.moving, bot.facing, 0.95),
      });
    }

    for (const mob of this.game.mobs) {
      if (!mob.alive) continue;
      drawables.push({ y: mob.y, draw: () => this.drawMobBody(ctx, mob) });
    }

    for (const ally of this.game.allies) {
      if (!ally.alive) {
        drawables.push({
          y: ally.y,
          draw: () => this.drawFallen(ctx, ally.x, ally.y, ally.color),
        });
        continue;
      }
      drawables.push({
        y: ally.y,
        draw: () =>
          this.drawHeroBody(
            ctx,
            ally.x,
            ally.y,
            ally.classId,
            ally.color,
            ally.walkPhase,
            ally.moving,
            ally.facing,
            1,
            true,
          ),
      });
    }

    if (this.game.mode !== "title" && !this.game.player.dead) {
      const player = this.game.player;
      drawables.push({
        y: player.y,
        draw: () =>
          this.drawHeroBody(
            ctx,
            player.x,
            player.y,
            player.classId,
            CLASSES[player.classId].color,
            player.walkPhase,
            player.moving,
            player.facing,
            1.08,
            false,
            true,
          ),
      });
    } else if (this.game.mode === "dead") {
      drawables.push({
        y: this.game.player.y,
        draw: () => this.drawFallen(ctx, this.game.player.x, this.game.player.y, "#d4b77e"),
      });
    }

    drawables.sort((a, b) => a.y - b.y);
    for (const drawable of drawables) drawable.draw();
  }

  private drawHeroBody(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    classId: ClassId,
    color: string,
    walkPhase: number,
    moving: boolean,
    facing: number,
    scale: number,
    ally = false,
    isPlayer = false,
  ): void {
    const def = CLASSES[classId];
    const bob = moving ? Math.sin(walkPhase * 2) * 1.5 : Math.sin(this.time * 2.1 + x * 0.02) * 0.55;
    const swing = moving ? Math.sin(walkPhase) * 5 : 0;
    const facingRight = Math.cos(facing) >= 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(3, 8, 6, 0.36)";
    ctx.beginPath();
    ctx.ellipse(2, 2, 18, 7, 0, 0, TAU);
    ctx.fill();

    if (isPlayer) {
      const glow = ctx.createRadialGradient(0, -20, 4, 0, -20, 42);
      glow.addColorStop(0, def.glow);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -20, 42, 0, TAU);
      ctx.fill();
    }

    ctx.translate(0, bob);

    // Cloak.
    ctx.fillStyle = def.color2;
    ctx.beginPath();
    ctx.moveTo(-13, -31);
    ctx.quadraticCurveTo(-20, -12, -15 + (facingRight ? -3 : 3), 1);
    ctx.lineTo(14, 1);
    ctx.quadraticCurveTo(19, -14, 13, -31);
    ctx.closePath();
    ctx.fill();

    // Legs.
    ctx.strokeStyle = "#2e2a24";
    ctx.lineWidth = 5.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-5, -14);
    ctx.lineTo(-5 + swing, -1);
    ctx.moveTo(5, -14);
    ctx.lineTo(5 - swing, -1);
    ctx.stroke();
    ctx.strokeStyle = "#191816";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-5 + swing, -1);
    ctx.lineTo(-2 + swing, 1);
    ctx.moveTo(5 - swing, -1);
    ctx.lineTo(8 - swing, 1);
    ctx.stroke();

    // Body.
    const body = ctx.createLinearGradient(-12, -45, 12, -12);
    body.addColorStop(0, def.color2);
    body.addColorStop(0.5, color);
    body.addColorStop(1, def.color2);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-12, -44);
    ctx.quadraticCurveTo(-17, -32, -13, -14);
    ctx.lineTo(13, -14);
    ctx.quadraticCurveTo(17, -32, 12, -44);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(235, 204, 143, 0.45)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-11, -15);
    ctx.lineTo(11, -15);
    ctx.stroke();
    ctx.fillStyle = "#2b241d";
    ctx.fillRect(-12, -22, 24, 4);

    // Shoulders.
    ctx.fillStyle = def.color2;
    ctx.beginPath();
    ctx.ellipse(-12, -39, 7, 8, -0.2, 0, TAU);
    ctx.ellipse(12, -39, 7, 8, 0.2, 0, TAU);
    ctx.fill();
    if (classId === "vanguard") {
      ctx.fillStyle = "#c9a96b";
      ctx.beginPath();
      ctx.ellipse(-13, -42, 6, 5, -0.2, 0, TAU);
      ctx.ellipse(13, -42, 6, 5, 0.2, 0, TAU);
      ctx.fill();
    }

    // Head and hood.
    ctx.fillStyle = "#cfa57d";
    ctx.beginPath();
    ctx.arc(0, -52, 7.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = classId === "arcanist" ? "#3e3157" : classId === "wildkeeper" ? "#304b35" : "#543b2a";
    ctx.beginPath();
    ctx.arc(0, -55, 8, Math.PI, TAU);
    ctx.lineTo(8, -52);
    ctx.quadraticCurveTo(0, -59, -8, -52);
    ctx.closePath();
    ctx.fill();
    if (classId === "wildkeeper") {
      ctx.fillStyle = def.color2;
      ctx.beginPath();
      ctx.moveTo(-9, -54);
      ctx.lineTo(-16, -46);
      ctx.lineTo(-7, -48);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#27211a";
    ctx.beginPath();
    ctx.arc(-2.5 + (facingRight ? 0.8 : -0.8), -52, 0.9, 0, TAU);
    ctx.arc(2.5 + (facingRight ? 0.8 : -0.8), -52, 0.9, 0, TAU);
    ctx.fill();

    // Weapon arm and class props.
    ctx.save();
    if (!facingRight) ctx.scale(-1, 1);
    if (classId === "vanguard") {
      ctx.strokeStyle = "#8f6f42";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(13, -33);
      ctx.lineTo(20, -20);
      ctx.stroke();
      ctx.fillStyle = "#d4d6cf";
      ctx.beginPath();
      ctx.moveTo(19, -21);
      ctx.lineTo(24, -38);
      ctx.lineTo(27, -36);
      ctx.lineTo(23, -18);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#e7d6ad";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(22, -21);
      ctx.lineTo(25, -35);
      ctx.stroke();
      ctx.fillStyle = "#4b5863";
      ctx.beginPath();
      ctx.arc(-16, -29, 10, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#b99b60";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(-16, -29, 10, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-16, -37);
      ctx.lineTo(-16, -21);
      ctx.moveTo(-24, -29);
      ctx.lineTo(-8, -29);
      ctx.stroke();
    } else if (classId === "arcanist") {
      ctx.strokeStyle = "#826a4d";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(15, -9);
      ctx.lineTo(18, -48);
      ctx.stroke();
      ctx.fillStyle = "#a9bcff";
      ctx.shadowColor = "#8fa9ff";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(18, -52, 4.4, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(180, 199, 255, 0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(18, -52, 8 + Math.sin(this.time * 2) * 1.5, 0.3, 5.4);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#7b5c3b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(17, -28, 16, -1.2, 1.25);
      ctx.stroke();
      ctx.strokeStyle = "rgba(214, 220, 190, 0.75)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(17 + Math.cos(-1.2) * 16, -28 + Math.sin(-1.2) * 16);
      ctx.lineTo(17 + Math.cos(1.25) * 16, -28 + Math.sin(1.25) * 16);
      ctx.stroke();
      ctx.fillStyle = "#5a4733";
      ctx.save();
      ctx.rotate(-0.35);
      ctx.fillRect(-22, -48, 9, 25);
      ctx.restore();
      ctx.strokeStyle = "#c1b485";
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-20 + i * 2.5, -47);
        ctx.lineTo(-23 + i * 2.5, -59);
        ctx.stroke();
      }
    }
    ctx.restore();

    if (ally) {
      ctx.strokeStyle = "rgba(157, 215, 255, 0.5)";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.ellipse(0, 1, 23, 9, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  private drawNpcBody(ctx: CanvasRenderingContext2D, npc: Npc): void {
    ctx.save();
    ctx.translate(npc.x, npc.y);
    ctx.fillStyle = "rgba(3, 8, 6, 0.34)";
    ctx.beginPath();
    ctx.ellipse(2, 2, 17, 7, 0, 0, TAU);
    ctx.fill();
    const bob = Math.sin(this.time * 1.6 + npc.x * 0.02) * 0.7;
    ctx.translate(0, bob);
    // Robe.
    const robe = ctx.createLinearGradient(0, -50, 0, 1);
    robe.addColorStop(0, npc.color);
    robe.addColorStop(1, "#352a22");
    ctx.fillStyle = robe;
    ctx.beginPath();
    ctx.moveTo(-12, -44);
    ctx.quadraticCurveTo(-16, -18, -12, 2);
    ctx.lineTo(12, 2);
    ctx.quadraticCurveTo(16, -18, 12, -44);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#26231e";
    ctx.fillRect(-12, -23, 24, 4);
    ctx.fillStyle = "#c9a67f";
    ctx.beginPath();
    ctx.arc(0, -53, 7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#30261e";
    ctx.beginPath();
    ctx.arc(0, -56, 8, Math.PI, TAU);
    ctx.lineTo(8, -51);
    ctx.quadraticCurveTo(0, -59, -8, -51);
    ctx.closePath();
    ctx.fill();
    // Walking staff.
    ctx.strokeStyle = "#836844";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(14, -2);
    ctx.lineTo(17, -53);
    ctx.stroke();
    ctx.fillStyle = "rgba(232, 206, 150, 0.8)";
    ctx.beginPath();
    ctx.arc(17, -56, 2.7, 0, TAU);
    ctx.fill();
    if (npc.role === "vendor") {
      ctx.fillStyle = "#5f4633";
      ctx.fillRect(-20, -31, 9, 16);
      ctx.fillStyle = "#c59b5a";
      ctx.fillRect(-19, -32, 7, 3);
    }
    ctx.restore();
  }

  private drawFallen(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(3, 8, 6, 0.34)";
    ctx.beginPath();
    ctx.ellipse(2, 2, 24, 9, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, -4, 22, 8, -0.14, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(58, 39, 30, 0.9)";
    ctx.beginPath();
    ctx.arc(-18, -7, 6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(127, 211, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -5, 28 + Math.sin(this.time * 2) * 3, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  private drawMobBody(ctx: CanvasRenderingContext2D, mob: Mob): void {
    switch (mob.templateId) {
      case "meadow_wolf":
        this.drawWolf(ctx, mob, false);
        break;
      case "ridge_boar":
        this.drawBoar(ctx, mob);
        break;
      case "gloom_wisp":
        this.drawWisp(ctx, mob);
        break;
      case "ruin_bandit":
        this.drawBandit(ctx, mob);
        break;
      case "riftwraith":
        this.drawRiftwraith(ctx, mob);
        break;
      case "reliquary_sentinel":
        this.drawSentinel(ctx, mob);
        break;
      case "drowned_acolyte":
        this.drawAcolyte(ctx, mob);
        break;
      case "choir":
        this.drawBoss(ctx, mob);
        break;
      default:
        this.drawWolf(ctx, mob, false);
    }
  }

  private drawWolf(ctx: CanvasRenderingContext2D, mob: Mob, wraith: boolean): void {
    const bob = Math.sin(this.time * 3 + mob.x * 0.03) * 0.8;
    ctx.save();
    ctx.translate(mob.x, mob.y);
    ctx.fillStyle = "rgba(3, 8, 6, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 3, 27, 8, 0, 0, TAU);
    ctx.fill();
    ctx.translate(0, bob);
    ctx.rotate(mob.facing);
    const flash = mob.hitFlash > 0;
    ctx.strokeStyle = wraith ? "#4d365d" : flash ? "#efe9dc" : "#3a3a35";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-11, -5);
    ctx.lineTo(-17, 6);
    ctx.moveTo(10, -5);
    ctx.lineTo(17, 6);
    ctx.stroke();
    ctx.fillStyle = flash ? "#eee8db" : mob.color;
    ctx.beginPath();
    ctx.ellipse(0, -10, 24, 12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = flash ? "#f2ede2" : "#75776d";
    ctx.beginPath();
    ctx.ellipse(-7, -13, 13, 7, -0.1, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = flash ? "#eee9dd" : "#4b4a42";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-20, -10);
    ctx.quadraticCurveTo(-30, -17, -29, -24);
    ctx.stroke();
    ctx.fillStyle = flash ? "#f5f0e4" : mob.color;
    ctx.beginPath();
    ctx.ellipse(21, -15, 12, 9, -0.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = flash ? "#f2eddf" : "#6e7067";
    ctx.beginPath();
    ctx.moveTo(16, -22);
    ctx.lineTo(17, -33);
    ctx.lineTo(23, -24);
    ctx.closePath();
    ctx.moveTo(25, -23);
    ctx.lineTo(29, -33);
    ctx.lineTo(31, -21);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#262722";
    ctx.beginPath();
    ctx.arc(29, -15, 2.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mob.accent;
    ctx.shadowColor = mob.accent;
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.arc(27, -17, 1.5, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private drawBoar(ctx: CanvasRenderingContext2D, mob: Mob): void {
    const bob = Math.sin(this.time * 2.5 + mob.x * 0.04) * 0.7;
    ctx.save();
    ctx.translate(mob.x, mob.y + bob);
    ctx.rotate(mob.facing);
    ctx.fillStyle = "rgba(3, 8, 6, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 5, 30, 9, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#3c2c21";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-12, -4);
    ctx.lineTo(-16, 8);
    ctx.moveTo(11, -4);
    ctx.lineTo(15, 8);
    ctx.stroke();
    const hide = mob.hitFlash > 0 ? "#eee6d9" : mob.color;
    ctx.fillStyle = hide;
    ctx.beginPath();
    ctx.ellipse(0, -10, 28, 17, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#5b4839";
    ctx.beginPath();
    ctx.ellipse(23, -12, 13, 11, -0.1, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#d8c397";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(31, -10);
    ctx.quadraticCurveTo(38, -16, 39, -22);
    ctx.moveTo(28, -5);
    ctx.quadraticCurveTo(36, -2, 40, -8);
    ctx.stroke();
    ctx.fillStyle = mob.accent;
    ctx.beginPath();
    ctx.arc(27, -16, 1.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#3b2e25";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, -18);
    ctx.lineTo(-28, -25);
    ctx.stroke();
    ctx.restore();
  }

  private drawWisp(ctx: CanvasRenderingContext2D, mob: Mob): void {
    const bob = Math.sin(this.time * 2.2 + mob.x) * 5;
    ctx.save();
    ctx.translate(mob.x, mob.y + bob);
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(0, -22, 2, 0, -22, 50);
    glow.addColorStop(0, "rgba(171, 255, 238, 0.55)");
    glow.addColorStop(0.4, "rgba(93, 236, 211, 0.18)");
    glow.addColorStop(1, "rgba(93, 236, 211, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -22, 50, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(139, 255, 233, 0.4)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i += 1) {
      const angle = this.time * 0.35 + i * 2.1;
      ctx.beginPath();
      ctx.arc(0, -22, 18 + i * 6, angle, angle + 2);
      ctx.stroke();
    }
    ctx.fillStyle = mob.hitFlash > 0 ? "#ffffff" : "#8cf4df";
    ctx.beginPath();
    ctx.arc(0, -24, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#f3fffb";
    ctx.beginPath();
    ctx.arc(-2, -27, 3.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(89, 206, 188, 0.62)";
    for (let i = 0; i < 4; i += 1) {
      const angle = this.time * 0.9 + i * 1.57;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * 20, -22 + Math.sin(angle) * 17, 1.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawBandit(ctx: CanvasRenderingContext2D, mob: Mob): void {
    ctx.save();
    ctx.translate(mob.x, mob.y);
    ctx.fillStyle = "rgba(3, 8, 6, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 2, 18, 7, 0, 0, TAU);
    ctx.fill();
    const bob = Math.sin(this.time * 2.4 + mob.x * 0.02) * 0.7;
    ctx.translate(0, bob);
    ctx.fillStyle = mob.hitFlash > 0 ? "#eee8dc" : "#513830";
    ctx.beginPath();
    ctx.moveTo(-11, -43);
    ctx.lineTo(-16, -4);
    ctx.lineTo(14, -4);
    ctx.lineTo(11, -43);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mob.hitFlash > 0 ? "#f1eadf" : mob.color;
    ctx.beginPath();
    ctx.moveTo(-12, -38);
    ctx.quadraticCurveTo(0, -30, 12, -38);
    ctx.lineTo(9, -55);
    ctx.lineTo(-9, -55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1c1a19";
    ctx.beginPath();
    ctx.arc(0, -58, 9, Math.PI, TAU);
    ctx.lineTo(8, -51);
    ctx.lineTo(-8, -51);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2a2018";
    ctx.fillRect(-8, -52, 16, 4);
    ctx.fillStyle = mob.accent;
    ctx.beginPath();
    ctx.arc(-2.6, -56, 1.2, 0, TAU);
    ctx.arc(2.6, -56, 1.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#c9c2b1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(13, -32);
    ctx.lineTo(24, -17);
    ctx.stroke();
    ctx.fillStyle = "#a98a5d";
    ctx.fillRect(10, -35, 8, 4);
    ctx.restore();
  }

  private drawAcolyte(ctx: CanvasRenderingContext2D, mob: Mob): void {
    ctx.save();
    ctx.translate(mob.x, mob.y);
    ctx.fillStyle = "rgba(3, 8, 6, 0.36)";
    ctx.beginPath();
    ctx.ellipse(0, 2, 20, 8, 0, 0, TAU);
    ctx.fill();
    const bob = Math.sin(this.time * 2 + mob.x * 0.03) * 2;
    ctx.translate(0, bob);
    ctx.fillStyle = mob.hitFlash > 0 ? "#eef7f2" : mob.color;
    ctx.beginPath();
    ctx.moveTo(-3, -55);
    ctx.quadraticCurveTo(-24, -24, -17, 1);
    ctx.lineTo(19, 1);
    ctx.quadraticCurveTo(24, -25, 4, -55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(110, 220, 204, 0.42)";
    ctx.beginPath();
    ctx.moveTo(-9, -15);
    ctx.lineTo(-13, 1);
    ctx.lineTo(15, 1);
    ctx.lineTo(11, -14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#182325";
    ctx.beginPath();
    ctx.arc(0, -58, 10, Math.PI, TAU);
    ctx.lineTo(9, -49);
    ctx.lineTo(-9, -49);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mob.accent;
    ctx.shadowColor = mob.accent;
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.arc(-2.5, -57, 1.4, 0, TAU);
    ctx.arc(2.5, -57, 1.4, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#607368";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, -2);
    ctx.lineTo(19, -55);
    ctx.stroke();
    ctx.fillStyle = "rgba(133, 255, 231, 0.8)";
    ctx.beginPath();
    ctx.arc(19, -58, 3.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(116, 234, 212, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -26, 28 + Math.sin(this.time * 2.3) * 4, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  private drawSentinel(ctx: CanvasRenderingContext2D, mob: Mob): void {
    ctx.save();
    ctx.translate(mob.x, mob.y);
    ctx.fillStyle = "rgba(3, 8, 6, 0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 3, 30, 11, 0, 0, TAU);
    ctx.fill();
    const bob = Math.sin(this.time * 1.5 + mob.x) * 0.8;
    ctx.translate(0, bob);
    ctx.fillStyle = mob.hitFlash > 0 ? "#f1f0e5" : "#4c5b55";
    ctx.beginPath();
    ctx.moveTo(-20, -55);
    ctx.lineTo(-25, -6);
    ctx.lineTo(23, -6);
    ctx.lineTo(20, -55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#64726a";
    ctx.beginPath();
    ctx.moveTo(-27, -62);
    ctx.lineTo(-9, -68);
    ctx.lineTo(-3, -54);
    ctx.lineTo(-21, -46);
    ctx.closePath();
    ctx.moveTo(27, -62);
    ctx.lineTo(9, -68);
    ctx.lineTo(3, -54);
    ctx.lineTo(21, -46);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#384842";
    ctx.beginPath();
    ctx.arc(0, -79, 12, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(245, 215, 143, 0.7)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -79, 7, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = mob.accent;
    ctx.shadowColor = mob.accent;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, -35, 5.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -79, 2, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#3b4843";
    ctx.beginPath();
    ctx.ellipse(-34, -31, 12, 24, 0.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#8a9b8c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-34, -31, 11, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "#75827a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-20, -18);
    ctx.lineTo(-23, -5);
    ctx.moveTo(20, -18);
    ctx.lineTo(23, -5);
    ctx.stroke();
    ctx.restore();
  }

  private drawRiftwraith(ctx: CanvasRenderingContext2D, mob: Mob): void {
    ctx.save();
    ctx.translate(mob.x, mob.y);
    ctx.globalCompositeOperation = "lighter";
    const aura = ctx.createRadialGradient(0, -55, 5, 0, -55, 85);
    aura.addColorStop(0, "rgba(196, 139, 255, 0.3)");
    aura.addColorStop(1, "rgba(124, 77, 218, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, -55, 85, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(3, 6, 8, 0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 4, 31, 11, 0, 0, TAU);
    ctx.fill();
    const bob = Math.sin(this.time * 1.8 + mob.x) * 5;
    ctx.translate(0, bob);
    ctx.fillStyle = "rgba(37, 27, 52, 0.94)";
    ctx.beginPath();
    ctx.moveTo(0, -108);
    ctx.quadraticCurveTo(-31, -80, -27, -31);
    ctx.lineTo(-45, -2);
    ctx.lineTo(-17, -19);
    ctx.lineTo(-7, 3);
    ctx.lineTo(6, -17);
    ctx.lineTo(20, 0);
    ctx.lineTo(31, -32);
    ctx.quadraticCurveTo(30, -82, 0, -108);
    ctx.fill();
    ctx.strokeStyle = "rgba(172, 115, 242, 0.35)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i += 1) {
      const angle = this.time * 0.45 + i * 1.57;
      ctx.beginPath();
      ctx.arc(0, -60, 25 + i * 11, angle, angle + 1.2);
      ctx.stroke();
    }
    ctx.fillStyle = "#1b1524";
    ctx.beginPath();
    ctx.arc(0, -92, 17, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#d8b9ff";
    ctx.shadowColor = "#c08cff";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(-6, -95, 2.4, 0, TAU);
    ctx.arc(6, -95, 2.4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -62, 4, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(200, 158, 255, 0.6)";
    for (let i = 0; i < 5; i += 1) {
      const angle = this.time * 0.8 + i * 1.3;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * 36, -52 + Math.sin(angle) * 24, 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawBoss(ctx: CanvasRenderingContext2D, mob: Mob): void {
    const bob = Math.sin(this.time * 1.3) * 3;
    ctx.save();
    ctx.translate(mob.x, mob.y);
    const aura = ctx.createRadialGradient(0, -80, 10, 0, -80, 160);
    aura.addColorStop(0, "rgba(107, 238, 215, 0.16)");
    aura.addColorStop(1, "rgba(107, 238, 215, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, -80, 160, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(3, 7, 7, 0.42)";
    ctx.beginPath();
    ctx.ellipse(0, 8, 52, 17, 0, 0, TAU);
    ctx.fill();
    ctx.translate(0, bob);
    ctx.strokeStyle = "rgba(171, 255, 238, 0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 3, 68, 23, 0, 0, TAU);
    ctx.stroke();

    // Lower robe, dissolving into the dais.
    const robe = ctx.createLinearGradient(0, -125, 0, 10);
    robe.addColorStop(0, "#4e6969");
    robe.addColorStop(0.55, "#314c4d");
    robe.addColorStop(1, "rgba(18, 35, 36, 0)");
    ctx.fillStyle = mob.hitFlash > 0 ? "#e9f4ee" : robe;
    ctx.beginPath();
    ctx.moveTo(-10, -156);
    ctx.quadraticCurveTo(-55, -110, -50, -16);
    ctx.quadraticCurveTo(0, 11, 50, -16);
    ctx.quadraticCurveTo(55, -110, 10, -156);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(122, 220, 205, 0.2)";
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.ellipse(0, -125 + i * 25, 14 + i * 5, 3, 0, 0, TAU);
      ctx.fill();
    }

    // Shoulders and arms.
    ctx.fillStyle = "#314b4c";
    ctx.beginPath();
    ctx.ellipse(-34, -139, 18, 15, -0.3, 0, TAU);
    ctx.ellipse(34, -139, 18, 15, 0.3, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#2b4546";
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-38, -132);
    ctx.quadraticCurveTo(-61, -96, -49, -68);
    ctx.moveTo(38, -132);
    ctx.quadraticCurveTo(64, -104, 52, -73);
    ctx.stroke();
    ctx.strokeStyle = "rgba(169, 255, 238, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-49, -69);
    ctx.lineTo(-55, -54);
    ctx.moveTo(52, -74);
    ctx.lineTo(58, -58);
    ctx.stroke();

    // Head and crown.
    ctx.fillStyle = "#1b2c2e";
    ctx.beginPath();
    ctx.arc(0, -171, 24, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(190, 255, 242, 0.36)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -171, 17, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.fillStyle = "#b9fff1";
    ctx.shadowColor = "#7bffdf";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(-8, -174, 3, 0, TAU);
    ctx.arc(8, -174, 3, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Broken crown.
    ctx.fillStyle = "#8dc7b8";
    for (let i = 0; i < 5; i += 1) {
      const angle = -2.6 + i * 0.62;
      const x = Math.cos(angle) * 29;
      const y = -171 + Math.sin(angle) * 29;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(0, -18 - (i % 2) * 8);
      ctx.lineTo(4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Floating hymn fragments.
    for (let i = 0; i < 7; i += 1) {
      const angle = this.time * 0.25 + (i / 7) * TAU;
      const radius = 76 + Math.sin(this.time * 0.8 + i) * 12;
      const x = Math.cos(angle) * radius;
      const y = -100 + Math.sin(angle) * 36;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = "rgba(148, 255, 235, 0.42)";
      ctx.fillRect(-1, -6, 2, 12);
      ctx.fillRect(-5, -1, 10, 2);
      ctx.restore();
    }
    ctx.restore();
  }

  private drawNameplates(ctx: CanvasRenderingContext2D): void {
    if (this.game.mode === "title") return;
    const target = this.game.getTarget();
    for (const mob of this.game.mobs) {
      if (!mob.alive) continue;
      this.drawMobPlate(ctx, mob, target?.id === mob.id);
    }
    for (const npc of this.game.npcs) {
      if (npc.role === "portal") continue;
      this.drawNpcPlate(ctx, npc);
    }
    if (this.game.scene === "world") {
      for (const bot of this.game.bots) this.drawBotPlate(ctx, bot.x, bot.y, bot.name, bot.level, bot.color);
    }
    this.drawPlayerPlate(ctx);
    for (const ally of this.game.allies) {
      if (!ally.alive) continue;
      this.drawAllyPlate(ctx, ally.x, ally.y, ally.name, ally.hp / ally.maxHp);
    }
  }

  private drawMobPlate(ctx: CanvasRenderingContext2D, mob: Mob, targeted: boolean): void {
    if (mob.x < this.camera.x - 80 || mob.x > this.camera.x + this.width + 80) return;
    if (mob.y < this.camera.y - 120 || mob.y > this.camera.y + this.height + 120) return;
    const distanceToPlayer = Math.hypot(mob.x - this.game.player.x, mob.y - this.game.player.y);
    if (distanceToPlayer > 880) return;
    const y = mob.y - 46 - mob.scale * 24;
    const barWidth = Math.min(100, Math.max(46, 54 * mob.scale));
    ctx.save();
    ctx.globalAlpha = clamp(1 - Math.max(0, distanceToPlayer - 600) / 300, 0.22, 1);
    ctx.font = `${mob.boss ? "700 13px" : "600 11px"} Inter, Segoe UI, sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(7, 10, 8, 0.8)";
    ctx.fillStyle = mob.boss ? "#d9b7ff" : mob.elite ? "#f4d58a" : "#e3b1a5";
    const label = mob.boss ? mob.name : `${mob.elite ? "✦ " : ""}${mob.name} · Lv ${mob.level}`;
    ctx.strokeText(label, mob.x, y - 12);
    ctx.fillText(label, mob.x, y - 12);
    if (targeted || mob.hp < mob.maxHp || mob.boss) {
      const ratio = clamp(mob.hp / mob.maxHp, 0, 1);
      ctx.fillStyle = "rgba(10, 12, 10, 0.8)";
      drawRoundedRect(ctx, mob.x - barWidth / 2, y - 4, barWidth, 5, 2.5);
      ctx.fill();
      ctx.fillStyle = mob.boss ? "#8be5ce" : mob.elite ? "#e2bd6d" : "#ce6f5b";
      drawRoundedRect(ctx, mob.x - barWidth / 2, y - 4, Math.max(2, barWidth * ratio), 5, 2.5);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawNpcPlate(ctx: CanvasRenderingContext2D, npc: Npc): void {
    if (npc.x < this.camera.x - 100 || npc.x > this.camera.x + this.width + 100) return;
    if (npc.y < this.camera.y - 160 || npc.y > this.camera.y + this.height + 100) return;
    const quest = this.game.getNpcQuest(npc.id);
    const y = npc.y - 78;
    ctx.save();
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(7, 9, 7, 0.78)";
    ctx.font = "600 12px Inter, Segoe UI, sans-serif";
    ctx.fillStyle = "#f0d79a";
    ctx.strokeText(npc.name, npc.x, y);
    ctx.fillText(npc.name, npc.x, y);
    ctx.font = "500 9px Inter, Segoe UI, sans-serif";
    ctx.fillStyle = "rgba(212, 194, 156, 0.7)";
    ctx.strokeText(npc.title, npc.x, y + 12);
    ctx.fillText(npc.title, npc.x, y + 12);
    if (quest && (quest.status === "available" || quest.status === "ready" || quest.status === "active")) {
      const marker = quest.status === "available" || quest.status === "ready" ? (quest.status === "available" ? "!" : "?") : "·";
      const color = quest.status === "active" ? "#d4c69e" : "#ffe08a";
      const markerY = y - 24 + Math.sin(this.time * 2.4) * 2;
      ctx.font = "700 24px Georgia, serif";
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.fillText(marker, npc.x, markerY);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  private drawPlayerPlate(ctx: CanvasRenderingContext2D): void {
    const player = this.game.player;
    if (player.dead) return;
    const color = CLASSES[player.classId].color;
    const x = player.x;
    const y = player.y - 88;
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "600 11px Inter, Segoe UI, sans-serif";
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "rgba(5, 8, 7, 0.85)";
    ctx.fillStyle = "#f3e6c8";
    ctx.strokeText(player.name, x, y);
    ctx.fillText(player.name, x, y);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.lineTo(x - 4, y + 11);
    ctx.lineTo(x + 4, y + 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawBotPlate(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    name: string,
    level: number,
    color: string,
  ): void {
    if (x < this.camera.x - 80 || x > this.camera.x + this.width + 80) return;
    if (y < this.camera.y - 130 || y > this.camera.y + this.height + 80) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "500 10px Inter, Segoe UI, sans-serif";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(5, 8, 7, 0.75)";
    ctx.fillStyle = "#a9c8ee";
    ctx.strokeText(name, x, y - 75);
    ctx.fillText(name, x, y - 75);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(x - ctx.measureText(name).width / 2 - 7, y - 78, 2, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.font = "500 8px Inter, Segoe UI, sans-serif";
    ctx.fillStyle = "#8098a8";
    ctx.fillText(`Lv ${level}`, x, y - 65);
    ctx.restore();
  }

  private drawAllyPlate(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    name: string,
    health: number,
  ): void {
    if (x < this.camera.x - 80 || x > this.camera.x + this.width + 80) return;
    if (y < this.camera.y - 130 || y > this.camera.y + this.height + 80) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "600 10px Inter, Segoe UI, sans-serif";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(5, 8, 7, 0.8)";
    ctx.fillStyle = "#9ed5ff";
    ctx.strokeText(name, x, y - 76);
    ctx.fillText(name, x, y - 76);
    ctx.fillStyle = "rgba(8, 12, 12, 0.75)";
    drawRoundedRect(ctx, x - 20, y - 70, 40, 4, 2);
    ctx.fill();
    ctx.fillStyle = "#72c791";
    drawRoundedRect(ctx, x - 20, y - 70, Math.max(2, 40 * health), 4, 2);
    ctx.fill();
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const particle of this.game.particles) {
      const progress = 1 - particle.life / particle.maxLife;
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      switch (particle.kind) {
        case "ring": {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const radius = Math.max(2, particle.size * (0.16 + progress * 0.84));
          ctx.strokeStyle = particle.color;
          ctx.globalAlpha = alpha * 0.8;
          ctx.lineWidth = 1.5 + alpha * 2.5;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, radius, 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = alpha * 0.07;
          ctx.fillStyle = particle.color;
          ctx.fill();
          ctx.restore();
          break;
        }
        case "beam": {
          ctx.save();
          ctx.translate(particle.x, particle.y);
          ctx.rotate(particle.rotation);
          ctx.globalCompositeOperation = "lighter";
          const gradient = ctx.createLinearGradient(0, 0, particle.size, 0);
          gradient.addColorStop(0, particle.color);
          gradient.addColorStop(0.75, particle.color);
          gradient.addColorStop(1, "rgba(255,255,255,0)");
          ctx.strokeStyle = gradient;
          ctx.globalAlpha = Math.min(1, alpha * 1.4);
          ctx.lineWidth = 2.4;
          ctx.shadowColor = particle.color;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(particle.size, 0);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case "slash": {
          ctx.save();
          ctx.translate(particle.x, particle.y);
          ctx.rotate(particle.rotation);
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = particle.color;
          ctx.globalAlpha = alpha * 0.85;
          ctx.lineWidth = 5 * alpha + 1;
          ctx.shadowColor = particle.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(0, 0, particle.size, -0.85, 0.85);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case "heal": {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = particle.color;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * (1 + progress), 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
        case "firefly": {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = particle.color;
          ctx.globalAlpha = Math.sin(progress * Math.PI) * 0.9;
          ctx.shadowColor = particle.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
        case "dust": {
          ctx.save();
          ctx.fillStyle = particle.color;
          ctx.globalAlpha = alpha * 0.25;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
        case "shadow": {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = particle.color;
          ctx.globalAlpha = alpha * 0.6;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * 1.4, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
        case "levelup": {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = particle.color;
          ctx.globalAlpha = alpha;
          ctx.shadowColor = particle.color;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * 1.5, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
        case "spark":
        default: {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = particle.color;
          ctx.globalAlpha = alpha * 0.95;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, Math.max(0.6, particle.size * alpha), 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
      }
    }
  }

  private drawFloaters(ctx: CanvasRenderingContext2D): void {
    for (const floater of this.game.floaters) {
      const alpha = clamp(floater.life / floater.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(7, 9, 7, 0.75)";
      ctx.fillStyle = floater.color;
      ctx.font = `${floater.crit ? "800" : "700"} ${floater.size}px Inter, Segoe UI, sans-serif`;
      if (floater.crit) {
        ctx.translate(floater.x, floater.y);
        const scale = 1 + (1 - alpha) * 0.15;
        ctx.scale(scale, scale);
        ctx.strokeText(floater.text, 0, 0);
        ctx.fillText(floater.text, 0, 0);
      } else {
        ctx.strokeText(floater.text, floater.x, floater.y);
        ctx.fillText(floater.text, floater.x, floater.y);
      }
      ctx.restore();
    }
  }

  private ensureWeatherParticles(): void {
    if (this.rainDrops.length === 0) {
      for (let i = 0; i < 260; i += 1) {
        this.rainDrops.push({
          x: Math.random(),
          y: Math.random(),
          speed: 780 + Math.random() * 460,
          len: 14 + Math.random() * 22,
          alpha: 0.16 + Math.random() * 0.3,
          width: Math.random() < 0.25 ? 1.6 : 1.1,
        });
      }
    }
    if (this.ashFlakes.length === 0) {
      for (let i = 0; i < 170; i += 1) {
        this.ashFlakes.push({
          x: Math.random(),
          y: Math.random(),
          speed: 24 + Math.random() * 44,
          phase: Math.random() * TAU,
          size: 1 + Math.random() * 2.4,
          alpha: 0.22 + Math.random() * 0.38,
        });
      }
    }
  }

  private drawWeather(ctx: CanvasRenderingContext2D, dt: number): void {
    const rain = this.game.weatherStrength("rain");
    const storm = this.game.weatherStrength("storm");
    const ash = this.game.weatherStrength("ash");
    const rainStrength = Math.min(1, rain + storm * 1.2);
    this.ensureWeatherParticles();

    if (rainStrength > 0.01) {
      const count = Math.ceil(this.rainDrops.length * Math.min(1, rainStrength));
      const windX = 0.14 + storm * 0.3;
      ctx.save();
      ctx.lineCap = "round";
      for (let i = 0; i < count; i += 1) {
        const drop = this.rainDrops[i];
        drop.y += (drop.speed * (1 + storm * 0.35) * dt) / Math.max(1, this.height);
        drop.x += (drop.speed * windX * dt) / Math.max(1, this.width);
        if (drop.y > 1.05) {
          drop.y -= 1.15;
          drop.x = Math.random();
        }
        if (drop.x > 1.05) drop.x -= 1.15;
        const x = drop.x * this.width;
        const y = drop.y * this.height;
        const len = drop.len * (1 + storm * 0.35);
        ctx.strokeStyle = `rgba(174, 202, 230, ${drop.alpha * rainStrength})`;
        ctx.lineWidth = drop.width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * windX, y - len);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (ash > 0.01) {
      const count = Math.ceil(this.ashFlakes.length * ash);
      ctx.save();
      for (let i = 0; i < count; i += 1) {
        const flake = this.ashFlakes[i];
        flake.phase += dt * 0.7;
        flake.y += (flake.speed * dt) / Math.max(1, this.height);
        flake.x += ((Math.sin(flake.phase) * 16 + 14) * dt) / Math.max(1, this.width);
        if (flake.y > 1.04) {
          flake.y -= 1.08;
          flake.x = Math.random();
        }
        if (flake.x > 1.04) flake.x -= 1.08;
        ctx.fillStyle = `rgba(163, 157, 144, ${flake.alpha * ash})`;
        ctx.beginPath();
        ctx.ellipse(
          flake.x * this.width,
          flake.y * this.height,
          flake.size,
          flake.size * 0.8,
          flake.phase,
          0,
          TAU,
        );
        ctx.fill();
      }
      ctx.restore();
    }

    const weather = this.game.weather;
    if (weather.bolt > 0) {
      const life = clamp(weather.bolt / 0.5, 0, 1);
      const rng = mulberry32(Math.floor(weather.boltSeed * 100000) + 7);
      const startX = (0.12 + weather.boltSeed * 0.76) * this.width;
      const segments = 9;
      const endY = this.height * (0.5 + rng() * 0.3);
      const stepY = (endY + 12) / segments;
      ctx.save();
      ctx.globalAlpha = Math.min(1, life * 1.5);
      ctx.strokeStyle = "#e9f1ff";
      ctx.shadowColor = "#bcd4ff";
      ctx.shadowBlur = 22;
      ctx.lineWidth = 2.6;
      ctx.lineJoin = "round";
      ctx.beginPath();
      let px = startX;
      ctx.moveTo(px, -12);
      for (let s = 1; s <= segments; s += 1) {
        px += (rng() - 0.5) * 92;
        ctx.lineTo(px, -12 + stepY * s);
      }
      ctx.stroke();
      // A short fork branching off the main bolt.
      ctx.globalAlpha *= 0.55;
      ctx.lineWidth = 1.6;
      let fx = startX + (rng() - 0.5) * 40;
      let fy = endY * (0.35 + rng() * 0.2);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      for (let s = 0; s < 3; s += 1) {
        fx += (rng() - 0.3) * 70;
        fy += 34 + rng() * 30;
        ctx.lineTo(fx, fy);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawAtmosphere(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    if (this.game.scene === "world") {
      if (this.game.zoneKey === "gloam") {
        ctx.fillStyle = "rgba(23, 31, 50, 0.12)";
        ctx.fillRect(0, 0, this.width, this.height);
      } else if (this.game.zoneKey === "ruins") {
        ctx.fillStyle = "rgba(82, 63, 44, 0.07)";
        ctx.fillRect(0, 0, this.width, this.height);
      }
      const stormTint = this.game.weatherStrength("storm");
      const rainTint = this.game.weatherStrength("rain");
      const ashTint = this.game.weatherStrength("ash");
      const mistTint = this.game.weatherStrength("mist");
      if (stormTint > 0) {
        ctx.fillStyle = `rgba(16, 24, 42, ${0.17 * stormTint})`;
        ctx.fillRect(0, 0, this.width, this.height);
      }
      if (rainTint > 0) {
        ctx.fillStyle = `rgba(26, 40, 56, ${0.11 * rainTint})`;
        ctx.fillRect(0, 0, this.width, this.height);
      }
      if (ashTint > 0) {
        ctx.fillStyle = `rgba(64, 58, 52, ${0.13 * ashTint})`;
        ctx.fillRect(0, 0, this.width, this.height);
      }
      if (mistTint > 0) {
        ctx.fillStyle = `rgba(116, 132, 138, ${0.11 * mistTint})`;
        ctx.fillRect(0, 0, this.width, this.height);
      }
      const fogTime = this.time * 9;
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 4; i += 1) {
        const x = ((fogTime + i * 460) % (this.width + 500)) - 250;
        const y = 100 + i * 150 + Math.sin(this.time * 0.2 + i) * 30;
        const fog = ctx.createRadialGradient(x, y, 20, x, y, 330);
        const color = this.game.zoneKey === "gloam" ? "rgba(100, 117, 145, 0.035)" : "rgba(206, 204, 172, 0.025)";
        fog.addColorStop(0, color);
        fog.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = fog;
        ctx.beginPath();
        ctx.arc(x, y, 330, 0, TAU);
        ctx.fill();
      }
      if (mistTint > 0) {
        ctx.globalCompositeOperation = "screen";
        for (let i = 0; i < 3; i += 1) {
          const x = ((this.time * 30 + i * 640) % (this.width + 760)) - 380;
          const y = this.height * (0.28 + 0.24 * i) + Math.sin(this.time * 0.14 + i * 2.1) * 54;
          const mist = ctx.createRadialGradient(x, y, 40, x, y, 430);
          mist.addColorStop(0, `rgba(181, 193, 199, ${0.07 * mistTint})`);
          mist.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = mist;
          ctx.beginPath();
          ctx.arc(x, y, 430, 0, TAU);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.fillStyle = "rgba(5, 16, 18, 0.18)";
      ctx.fillRect(0, 0, this.width, this.height);
      const fog = ctx.createRadialGradient(this.width / 2, this.height / 2, 100, this.width / 2, this.height / 2, this.width * 0.7);
      fog.addColorStop(0, "rgba(92, 195, 181, 0.025)");
      fog.addColorStop(1, "rgba(1, 5, 6, 0)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    const vignette = ctx.createRadialGradient(
      this.width / 2,
      this.height * 0.48,
      Math.min(this.width, this.height) * 0.18,
      this.width / 2,
      this.height / 2,
      Math.max(this.width, this.height) * 0.76,
    );
    vignette.addColorStop(0, "rgba(4, 9, 7, 0)");
    vignette.addColorStop(0.62, "rgba(4, 9, 7, 0.08)");
    vignette.addColorStop(1, this.game.scene === "dungeon" ? "rgba(1, 5, 6, 0.72)" : "rgba(3, 8, 6, 0.48)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  drawMinimap(target: HTMLCanvasElement): void {
    const rect = target.getBoundingClientRect();
    const cssSize = Math.max(120, rect.width);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (target.width !== Math.floor(cssSize * dpr)) {
      target.width = Math.floor(cssSize * dpr);
      target.height = Math.floor(cssSize * dpr);
    }
    const ctx = target.getContext("2d");
    if (!ctx) return;
    const size = cssSize;
    const scale = dpr;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, TAU);
    ctx.clip();
    ctx.fillStyle = "#101c16";
    ctx.fillRect(0, 0, size, size);

    const isDungeon = this.game.scene === "dungeon";
    const source = isDungeon ? this.minimapDungeon : this.minimapWorld;
    const mapWidth = isDungeon ? DUNGEON.width : WORLD.width;
    const mapHeight = isDungeon ? DUNGEON.height : WORLD.height;
    const fit = Math.max(size / source.width, size / source.height);
    const drawWidth = source.width * fit;
    const drawHeight = source.height * fit;
    const offsetX = (size - drawWidth) / 2;
    const offsetY = (size - drawHeight) / 2;
    ctx.drawImage(source, offsetX, offsetY, drawWidth, drawHeight);
    ctx.fillStyle = "rgba(9, 20, 15, 0.16)";
    ctx.fillRect(0, 0, size, size);

    const mapX = (worldX: number): number => offsetX + (worldX / mapWidth) * drawWidth;
    const mapY = (worldY: number): number => offsetY + (worldY / mapHeight) * drawHeight;

    for (const npc of this.game.npcs) {
      if (npc.role === "portal") {
        ctx.fillStyle = "#8de4d2";
        ctx.beginPath();
        ctx.arc(mapX(npc.x), mapY(npc.y), 2.2, 0, TAU);
        ctx.fill();
        continue;
      }
      const quest = this.game.getNpcQuest(npc.id);
      if (quest && (quest.status === "available" || quest.status === "ready" || quest.status === "active")) {
        ctx.save();
        ctx.shadowColor = "#ffd87d";
        ctx.shadowBlur = 7;
        ctx.fillStyle = quest.status === "ready" ? "#ffe6a0" : "#e9c36f";
        ctx.beginPath();
        ctx.arc(mapX(npc.x), mapY(npc.y), 2.8, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (npc.role === "vendor") {
        ctx.fillStyle = "#bda77d";
        ctx.beginPath();
        ctx.arc(mapX(npc.x), mapY(npc.y), 1.8, 0, TAU);
        ctx.fill();
      }
    }

    if (isDungeon) {
      for (const ally of this.game.allies) {
        if (!ally.alive) continue;
        ctx.fillStyle = "#86c5ff";
        ctx.beginPath();
        ctx.arc(mapX(ally.x), mapY(ally.y), 2.2, 0, TAU);
        ctx.fill();
      }
    }

    for (const mob of this.game.mobs) {
      if (!mob.alive) continue;
      if (this.game.scene !== "dungeon" && Math.hypot(mob.x - this.game.player.x, mob.y - this.game.player.y) > 760) continue;
      ctx.fillStyle = mob.boss ? "#b594ff" : mob.elite ? "#e6bc69" : "rgba(216, 107, 90, 0.82)";
      ctx.beginPath();
      ctx.arc(mapX(mob.x), mapY(mob.y), mob.boss ? 3.2 : mob.elite ? 2.6 : 1.7, 0, TAU);
      ctx.fill();
    }

    if (this.game.rift.active) {
      const x = mapX(this.game.rift.x);
      const y = mapY(this.game.rift.y);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#c69aff";
      ctx.shadowColor = "#b380ff";
      ctx.shadowBlur = 8;
      ctx.fillRect(-2.6, -2.6, 5.2, 5.2);
      ctx.restore();
    }

    const player = this.game.player;
    const px = mapX(player.x);
    const py = mapY(player.y);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(player.facing + Math.PI / 2);
    ctx.fillStyle = "#ffe6a7";
    ctx.strokeStyle = "rgba(22, 25, 18, 0.9)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.2, 4.5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.2, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "rgba(232, 219, 180, 0.68)";
    ctx.font = "600 8px Inter, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("N", size / 2, 13);
    ctx.restore();

    // Ring.
    ctx.strokeStyle = "rgba(213, 185, 124, 0.72)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2.5, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(31, 25, 17, 0.8)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4.5, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(213, 185, 124, 0.32)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 7.5, 0, TAU);
    ctx.stroke();
  }

  get zoneTitle(): string {
    return ZONES[this.game.zoneKey].name;
  }

  get zoneSub(): string {
    return ZONES[this.game.zoneKey].sub;
  }

  get npcCount(): number {
    return NPCS.length;
  }

  drawWorldMap(target: HTMLCanvasElement): void {
    const rect = target.getBoundingClientRect();
    const width = Math.max(320, rect.width);
    const height = Math.max(220, rect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (target.width !== Math.floor(width * dpr) || target.height !== Math.floor(height * dpr)) {
      target.width = Math.floor(width * dpr);
      target.height = Math.floor(height * dpr);
    }
    const ctx = target.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const source = this.game.scene === "dungeon" ? this.dungeonCanvas : this.worldCanvas;
    const mapWidth = this.game.scene === "dungeon" ? DUNGEON.width : WORLD.width;
    const mapHeight = this.game.scene === "dungeon" ? DUNGEON.height : WORLD.height;
    const fit = Math.max(width / mapWidth, height / mapHeight);
    const drawWidth = mapWidth * fit;
    const drawHeight = mapHeight * fit;
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;
    ctx.save();
    ctx.beginPath();
    drawRoundedRect(ctx, 2, 2, width - 4, height - 4, 10);
    ctx.clip();
    ctx.fillStyle = "#0a130f";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, offsetX, offsetY, drawWidth, drawHeight);
    ctx.fillStyle = "rgba(7, 16, 12, 0.34)";
    ctx.fillRect(0, 0, width, height);
    const mapX = (x: number): number => offsetX + (x / mapWidth) * drawWidth;
    const mapY = (y: number): number => offsetY + (y / mapHeight) * drawHeight;

    if (this.game.scene === "world") {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(227, 206, 158, 0.4)";
      ctx.font = "600 15px Cinzel, Georgia, serif";
      ctx.fillText("THE VERDANT REACH", mapX(1500), mapY(1280));
      ctx.fillStyle = "rgba(166, 207, 192, 0.38)";
      ctx.fillText("GLOAMWOOD", mapX(2360), mapY(680));
      ctx.fillStyle = "rgba(210, 177, 132, 0.36)";
      ctx.fillText("ASHEN VERGE", mapX(1480), mapY(1580));
      ctx.fillStyle = "rgba(246, 219, 156, 0.62)";
      ctx.font = "600 11px Inter, Segoe UI, sans-serif";
      ctx.fillText("WAYFARER'S REST", mapX(HUB.x), mapY(HUB.y - 285));
    }

    for (const npc of this.game.npcs) {
      if (npc.role === "portal") {
        ctx.fillStyle = "#8ce6d3";
        ctx.shadowColor = "#7fffe4";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(mapX(npc.x), mapY(npc.y), 4, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        continue;
      }
      const quest = this.game.getNpcQuest(npc.id);
      if (quest && (quest.status === "available" || quest.status === "ready" || quest.status === "active")) {
        ctx.fillStyle = quest.status === "ready" ? "#ffe7a8" : "#dfba76";
        ctx.shadowColor = "#ffd782";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(mapX(npc.x), mapY(npc.y), 3.4, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    const player = this.game.player;
    const px = mapX(player.x);
    const py = mapY(player.y);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(player.facing + Math.PI / 2);
    ctx.fillStyle = "#ffe6a7";
    ctx.strokeStyle = "rgba(15, 18, 13, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(6.6, 7);
    ctx.lineTo(0, 3.4);
    ctx.lineTo(-6.6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(255, 233, 177, 0.9)";
    ctx.font = "600 10px Inter, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("YOU", px, py - 17);
    ctx.restore();

    ctx.strokeStyle = "rgba(213, 185, 124, 0.5)";
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 1.5, 1.5, width - 3, height - 3, 10);
    ctx.stroke();
  }
}
