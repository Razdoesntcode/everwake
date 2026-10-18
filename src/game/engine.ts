import {
  BOTS,
  CAMP_SAFE_RADIUS,
  CHAT_REPLIES,
  CLASSES,
  DUNGEON,
  DUNGEON_ENTRY,
  HUB,
  ITEMS,
  MOBS,
  NPCS,
  OBSTACLES,
  PORTAL_POS,
  POTION_ABILITY,
  QUESTS,
  SPAWNS,
  STARTING_WEAPONS,
  SYSTEM_LINES,
  VENDOR_STOCK,
  WORLD,
  WORLD_CHAT,
  ZONES,
} from "./data";
import type {
  AbilityDef,
  Ally,
  Bot,
  ChatChannel,
  ChatMessage,
  ClassId,
  DungeonState,
  Floater,
  ItemDef,
  ItemInstance,
  Mob,
  Npc,
  Particle,
  ParticleKind,
  Player,
  QuestDef,
  QuestStatus,
  Vec,
  WorldRift,
} from "./types";

export type ZoneKey = keyof typeof ZONES;
export type ToastTone = "gold" | "danger" | "quest" | "loot" | "system";
export type WeatherKind = "clear" | "rain" | "storm" | "mist" | "ash";

export const WEATHER_META: Record<WeatherKind, { label: string; icon: string }> = {
  clear: { label: "Fair skies", icon: "☀" },
  rain: { label: "Rain", icon: "☂" },
  storm: { label: "Storm", icon: "ϟ" },
  mist: { label: "Mist", icon: "≋" },
  ash: { label: "Ashfall", icon: "※" },
};

// Weighted weather tables per zone. The reliquary is indoors and stays clear.
const WEATHER_BY_ZONE: Record<ZoneKey, [WeatherKind, number][]> = {
  hub: [
    ["clear", 5],
    ["rain", 3],
    ["mist", 2],
  ],
  reach: [
    ["clear", 4],
    ["rain", 4],
    ["storm", 2.5],
  ],
  gloam: [
    ["mist", 5],
    ["rain", 2.5],
    ["clear", 2.5],
  ],
  ruins: [
    ["ash", 4],
    ["clear", 3],
    ["storm", 2],
  ],
  dungeon: [["clear", 1]],
};

export interface GameEvents {
  toast(title: string, detail?: string, tone?: ToastTone): void;
  sound(name: string): void;
  shake(strength: number): void;
  flash(color: string, alpha: number): void;
  openNpc(npcId: string): void;
  openVendor(): void;
}

export interface Interactable {
  kind: "npc" | "portal" | "exit";
  npc: Npc;
  label: string;
  sub: string;
}

export interface NpcQuest {
  quest: QuestDef;
  status: QuestStatus;
}

const TAU = Math.PI * 2;
const BAG_SIZE = 18;

const NO_EVENTS: GameEvents = {
  toast: () => undefined,
  sound: () => undefined,
  shake: () => undefined,
  flash: () => undefined,
  openNpc: () => undefined,
  openVendor: () => undefined,
};

const CHANNEL_COLORS: Record<ChatChannel, string> = {
  world: "#d8c8a5",
  system: "#9fb0a6",
  say: "#f1e7d3",
  combat: "#dba171",
  loot: "#e5bf72",
  party: "#9ec8ff",
};

function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function xpNeeded(level: number): number {
  return Math.round(70 * Math.pow(level, 1.3));
}

export function itemScore(item: ItemDef): number {
  return (item.power ?? 0) * 2.4 + (item.armor ?? 0) * 1.7 + (item.hp ?? 0) * 0.35;
}

export function rarityColor(rarity: ItemDef["rarity"]): string {
  switch (rarity) {
    case "uncommon":
      return "#8fd39a";
    case "rare":
      return "#8bb7ff";
    case "epic":
      return "#c79bff";
    default:
      return "#d8cdb8";
  }
}

export class EverwakeGame {
  mode: "title" | "playing" | "dead" = "title";
  scene: "world" | "dungeon" = "world";
  player: Player;
  mobs: Mob[] = [];
  bots: Bot[] = [];
  allies: Ally[] = [];
  npcs: Npc[] = [];
  particles: Particle[] = [];
  floaters: Floater[] = [];
  chat: ChatMessage[] = [];
  zoneKey: ZoneKey = "hub";
  dungeon: DungeonState = {
    stage: 0,
    started: false,
    bossSpawned: false,
    cleared: false,
    introTimer: 0,
    pulseWarning: 0,
  };
  rift: WorldRift = {
    active: false,
    x: 0,
    y: 0,
    timer: 75,
    mobId: null,
    announced: false,
    number: 0,
  };
  online = 1284;
  time = 0;
  areaTitle = { text: "", sub: "", time: 0 };
  events: GameEvents = NO_EVENTS;
  weather: {
    kind: WeatherKind;
    prev: WeatherKind;
    blend: number;
    timer: number;
    bolt: number;
    boltSeed: number;
  } = { kind: "clear", prev: "clear", blend: 1, timer: 30, bolt: 0, boltSeed: 0.42 };

  private keys = new Set<string>();
  private mouse: Vec = { x: 0, y: 0 };
  private chatTimer = 10;
  private onlineTimer = 4;
  private ambientTimer = 0;
  private combatTimer = 0;
  private pendingAbility: string | null = null;
  private pendingInteractNpc: string | null = null;
  private uidCounter = 0;
  private chatCounter = 0;
  private pendingChat: {
    timer: number;
    channel: ChatChannel;
    author: string;
    text: string;
    color?: string;
  }[] = [];
  private lastDeadCheck = 0;
  private lightningTimer = 7;
  private weatherPrimed = true;

  constructor() {
    this.player = this.createPlayer("Wanderer", "vanguard");
    this.player.x = HUB.x + 34;
    this.player.y = HUB.y + 70;
    this.bots = BOTS.map((bot) => this.makeBot(bot));
    this.npcs = NPCS.map((npc) => ({ ...npc, questIds: [...npc.questIds] }));
    this.mobs = this.createWorldMobs();
  }

  start(name: string, classId: ClassId): void {
    const cleanName = name.trim().slice(0, 18) || "Wanderer";
    this.player = this.createPlayer(cleanName, classId);
    this.player.x = HUB.x + 34;
    this.player.y = HUB.y + 70;
    this.mode = "playing";
    this.scene = "world";
    this.zoneKey = "hub";
    this.mobs = this.createWorldMobs();
    this.allies = [];
    this.npcs = NPCS.map((npc) => ({ ...npc, questIds: [...npc.questIds] }));
    this.bots = BOTS.map((bot) => this.makeBot(bot));
    this.particles = [];
    this.floaters = [];
    this.chat = [];
    this.pendingChat = [];
    this.chatTimer = 8;
    this.dungeon = {
      stage: 0,
      started: false,
      bossSpawned: false,
      cleared: false,
      introTimer: 0,
      pulseWarning: 0,
    };
    this.rift = {
      active: false,
      x: 0,
      y: 0,
      timer: 72,
      mobId: null,
      announced: false,
      number: 0,
    };
    this.combatTimer = 0;
    this.pendingAbility = null;
    this.pendingInteractNpc = null;
    this.time = 0;
    this.weather = { kind: "clear", prev: "clear", blend: 1, timer: 18, bolt: 0, boltSeed: Math.random() };
    this.weatherPrimed = true;
    this.lightningTimer = 7;
    this.refreshQuestAvailability();
    this.setAreaTitle("Wayfarer's Rest", "The last warm fire before the wilds");
    this.addChat("system", "", `Welcome to Everwake, ${cleanName}. The world has been waiting.`);
    this.scheduleChat(2.2, "world", "Ashwyn", "new face at the fire. welcome, wanderer.", CLASSES.arcanist.color);
    this.scheduleChat(4.6, "world", "Bramble", "o7", CLASSES.wildkeeper.color);
    this.scheduleChat(7.1, "world", "Thorne", "Maelin's been eyeing the east road all morning. start there.", CLASSES.vanguard.color);
    this.events.toast("Wayfarer's Rest", "Find Captain Maelin near the fire.", "quest");
    this.events.sound("start");
  }

  private createPlayer(name: string, classId: ClassId): Player {
    const def = CLASSES[classId];
    const weapon: ItemInstance = {
      uid: `item_${++this.uidCounter}`,
      defId: STARTING_WEAPONS[classId],
    };
    const player: Player = {
      name,
      classId,
      x: HUB.x,
      y: HUB.y + 50,
      facing: -Math.PI / 2,
      level: 1,
      xp: 0,
      xpNext: xpNeeded(1),
      hp: 1,
      maxHp: 0,
      resource: classId === "vanguard" ? 25 : def.resourceMax,
      maxResource: def.resourceMax,
      resourceName: def.resource,
      armor: def.baseArmor,
      power: def.basePower,
      speed: 228,
      radius: 15,
      gold: 12,
      potions: 2,
      inventory: [],
      equipment: { weapon },
      quests: {},
      cooldowns: {},
      gcd: 0,
      autoTimer: 0,
      targetId: null,
      moving: false,
      walkPhase: 0,
      dead: false,
      shield: 0,
      buffs: [],
      dungeonCleared: false,
      kills: 0,
      deaths: 0,
      playTime: 0,
      moveTarget: null,
    };
    this.player = player;
    this.recalculateStats(true);
    for (const quest of QUESTS) {
      player.quests[quest.id] = { status: "locked", progress: 0 };
    }
    this.refreshQuestAvailability();
    return player;
  }

  private recalculateStats(fullHeal = false): void {
    const def = CLASSES[this.player.classId];
    let hpBonus = 0;
    let armorBonus = 0;
    let powerBonus = 0;
    for (const item of Object.values(this.player.equipment)) {
      if (!item) continue;
      const itemDef = ITEMS[item.defId];
      if (!itemDef) continue;
      hpBonus += itemDef.hp ?? 0;
      armorBonus += itemDef.armor ?? 0;
      powerBonus += itemDef.power ?? 0;
    }
    const newMaxHp = def.baseHp + (this.player.level - 1) * 15 + hpBonus;
    const missingHp = Math.max(0, this.player.maxHp - this.player.hp);
    this.player.maxHp = newMaxHp;
    this.player.hp = fullHeal ? newMaxHp : clamp(newMaxHp - missingHp, 1, newMaxHp);
    this.player.armor = def.baseArmor + (this.player.level - 1) * 2 + armorBonus;
    this.player.power = def.basePower + (this.player.level - 1) * 1.7 + powerBonus;
    this.player.maxResource = def.resourceMax;
    this.player.resource = clamp(this.player.resource, 0, this.player.maxResource);
  }

  private makeBot(source: (typeof BOTS)[number]): Bot {
    return {
      ...source,
      wanderX: source.x,
      wanderY: source.y,
      wanderTimer: randomRange(1, 5),
      moving: false,
      walkPhase: Math.random() * TAU,
    };
  }

  private makeMob(templateId: string, x: number, y: number, summoned = false): Mob {
    const template = MOBS[templateId];
    if (!template) throw new Error(`Unknown mob template: ${templateId}`);
    return {
      id: `mob_${++this.uidCounter}`,
      name: template.name,
      templateId,
      x,
      y,
      homeX: x,
      homeY: y,
      radius: template.radius,
      level: template.level,
      hp: template.hp,
      maxHp: template.hp,
      alive: true,
      respawnTimer: 0,
      state: "idle",
      targetId: null,
      wanderX: x,
      wanderY: y,
      wanderTimer: randomRange(1, 3),
      attackTimer: randomRange(0, 1),
      pulseTimer: template.boss ? 7.5 : 0,
      speed: template.speed,
      range: template.range,
      aggro: template.aggro,
      damage: template.damage,
      xp: template.xp,
      elite: Boolean(template.elite),
      boss: Boolean(template.boss),
      color: template.color,
      accent: template.accent,
      facing: Math.random() * TAU,
      hitFlash: 0,
      slowTimer: 0,
      rootTimer: 0,
      stunTimer: 0,
      scale: template.scale ?? 1,
      enraged: false,
      summoned,
      pulseArmed: false,
    };
  }

  private createWorldMobs(): Mob[] {
    const mobs: Mob[] = [];
    for (const spawn of SPAWNS) {
      for (let i = 0; i < spawn.count; i += 1) {
        const angle = Math.random() * TAU;
        const radius = Math.sqrt(Math.random()) * spawn.radius;
        let x = clamp(spawn.x + Math.cos(angle) * radius, 90, WORLD.width - 90);
        let y = clamp(spawn.y + Math.sin(angle) * radius, 90, WORLD.height - 90);
        const hubDistance = Math.hypot(x - HUB.x, y - HUB.y);
        if (hubDistance < CAMP_SAFE_RADIUS + 60) {
          const push = (CAMP_SAFE_RADIUS + 60) / Math.max(1, hubDistance);
          x = clamp(HUB.x + (x - HUB.x) * push, 100, WORLD.width - 100);
          y = clamp(HUB.y + (y - HUB.y) * push, 100, WORLD.height - 100);
        }
        mobs.push(this.makeMob(spawn.templateId, x, y));
      }
    }
    return mobs;
  }

  setEvents(events: GameEvents): void {
    this.events = events;
  }

  setKey(code: string, down: boolean): void {
    if (down) this.keys.add(code);
    else this.keys.delete(code);
  }

  clearKeys(): void {
    this.keys.clear();
    this.player.moveTarget = null;
    this.pendingInteractNpc = null;
  }

  setMouse(worldX: number, worldY: number): void {
    this.mouse.x = worldX;
    this.mouse.y = worldY;
  }

  update(dt: number): void {
    const step = Math.min(dt, 0.05);
    this.time += step;
    if (this.mode !== "title") {
      this.player.playTime += step;
    }
    this.updateAreaTitle(step);
    this.updateParticles(step);
    this.updateFloaters(step);
    this.updateChatSim(step);
    this.updateOnline(step);
    this.updateAmbient(step);
    this.updateWeather(step);

    if (this.mode === "title") {
      this.updateBots(step);
      return;
    }

    if (this.mode === "dead") {
      this.updateBots(step);
      return;
    }

    this.combatTimer = Math.max(0, this.combatTimer - step);
    this.player.gcd = Math.max(0, this.player.gcd - step);
    this.player.autoTimer = Math.max(0, this.player.autoTimer - step);
    for (const key of Object.keys(this.player.cooldowns)) {
      this.player.cooldowns[key] = Math.max(0, this.player.cooldowns[key] - step);
    }
    this.updateBuffs(step);
    this.updatePlayer(step);
    this.updateBots(step);
    this.updateMobs(step);
    if (this.scene === "dungeon") {
      this.updateAllies(step);
      this.checkDungeonStage();
    } else {
      this.updateRift(step);
    }
    this.checkZone();
  }

  private updateAreaTitle(dt: number): void {
    this.areaTitle.time = Math.max(0, this.areaTitle.time - dt);
  }

  /** 0..1 presence of a given weather state, crossfading between prev and kind. */
  weatherStrength(kind: WeatherKind): number {
    const w = this.weather;
    let value = 0;
    if (w.kind === kind) value += w.blend;
    if (w.prev === kind && w.kind !== kind) value += 1 - w.blend;
    return clamp(value, 0, 1);
  }

  private weatherResourceMultiplier(): number {
    const wet = this.weatherStrength("rain") + this.weatherStrength("storm");
    return wet > 0 ? 1 + 0.35 * Math.min(1, wet) : 1;
  }

  private updateWeather(dt: number): void {
    const w = this.weather;
    w.bolt = Math.max(0, w.bolt - dt);
    if (w.blend < 1) w.blend = Math.min(1, w.blend + dt / 5);

    if (this.scene === "dungeon") {
      // Indoors the sky does not reach you.
      if (w.kind !== "clear") {
        w.prev = w.kind;
        w.kind = "clear";
        w.blend = 0;
      }
      w.timer = 12;
      return;
    }

    w.timer -= dt;
    if (w.timer <= 0) {
      const next = this.pickWeather();
      if (next !== w.kind) {
        w.prev = w.kind;
        w.kind = next;
        w.blend = 0;
        if (this.mode === "playing") this.announceWeather(next);
      }
      w.timer = randomRange(42, 84);
    }

    const storm = this.weatherStrength("storm");
    if (storm > 0.5 && this.mode === "playing") {
      this.lightningTimer -= dt * storm;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = randomRange(6, 15);
        w.bolt = 0.5;
        w.boltSeed = Math.random();
        this.events.flash("#dce9ff", 0.26);
        this.events.shake(5);
      }
    } else if (this.lightningTimer < 3) {
      this.lightningTimer = 3;
    }
  }

  private pickWeather(): WeatherKind {
    const table = WEATHER_BY_ZONE[this.zoneKey] ?? WEATHER_BY_ZONE.hub;
    let options = table.filter(([kind]) => kind !== "clear");
    if (this.weatherPrimed || options.length === 0) {
      this.weatherPrimed = false;
    } else {
      options = table;
    }
    const total = options.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * total;
    for (const [kind, weight] of options) {
      roll -= weight;
      if (roll <= 0) return kind;
    }
    return options[options.length - 1][0];
  }

  private announceWeather(kind: WeatherKind): void {
    const resource = this.player.resourceName;
    const copy: Record<WeatherKind, { title: string; detail: string; tone: ToastTone }> = {
      clear: { title: "The sky clears", detail: "Sunlight finds the old road once more.", tone: "system" },
      rain: {
        title: "Rain moves in",
        detail: `Steady and warm. ${resource} recovery +35% while it falls.`,
        tone: "quest",
      },
      storm: {
        title: "A storm rolls over",
        detail: `Thunder walks the horizon. ${resource} recovery +35%.`,
        tone: "danger",
      },
      mist: { title: "Mist settles", detail: "The world draws a curtain around itself.", tone: "quest" },
      ash: { title: "Ashfall begins", detail: "The dead kingdoms snow again.", tone: "quest" },
    };
    const entry = copy[kind];
    this.events.toast(entry.title, entry.detail, entry.tone);
  }

  private setAreaTitle(text: string, sub: string): void {
    this.areaTitle = { text, sub, time: 4.2 };
    this.events.sound("area");
  }

  private updateBuffs(dt: number): void {
    for (const buff of [...this.player.buffs]) {
      buff.time -= dt;
      if (buff.time <= 0) {
        this.player.buffs = this.player.buffs.filter((b) => b !== buff);
        if (buff.id === "shield") this.player.shield = 0;
      }
    }
  }

  private addBuff(id: string, name: string, time: number, color: string, icon: string): void {
    this.player.buffs = this.player.buffs.filter((b) => b.id !== id);
    this.player.buffs.push({ id, name, time, maxTime: time, color, icon });
  }

  private updatePlayer(dt: number): void {
    const player = this.player;
    const def = CLASSES[player.classId];
    const inCombat = this.combatTimer > 0;

    if (player.hp < player.maxHp) {
      const regen = inCombat ? player.maxHp * 0.001 : player.maxHp * 0.014;
      player.hp = Math.min(player.maxHp, player.hp + regen * dt);
    }
    const weatherMult = this.scene === "world" ? this.weatherResourceMultiplier() : 1;
    if (player.classId === "vanguard") {
      player.resource = clamp(
        player.resource + (inCombat ? 0.7 : 2.5) * dt * weatherMult,
        0,
        player.maxResource,
      );
    } else {
      player.resource = clamp(
        player.resource + (inCombat ? 2.6 : 9) * dt * weatherMult,
        0,
        player.maxResource,
      );
    }

    let dx = 0;
    let dy = 0;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) dx += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) dx -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) dy += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) dy -= 1;

    let moving = false;
    if (dx !== 0 || dy !== 0) {
      const length = Math.hypot(dx, dy);
      dx /= length;
      dy /= length;
      player.x += dx * player.speed * dt;
      player.y += dy * player.speed * dt;
      player.facing = Math.atan2(dy, dx);
      player.moveTarget = null;
      moving = true;
    } else if (player.moveTarget) {
      const targetDx = player.moveTarget.x - player.x;
      const targetDy = player.moveTarget.y - player.y;
      const length = Math.hypot(targetDx, targetDy);
      if (length < 6) {
        player.moveTarget = null;
      } else {
        const speed = Math.min(player.speed, length / dt);
        player.x += (targetDx / length) * speed * dt;
        player.y += (targetDy / length) * speed * dt;
        player.facing = Math.atan2(targetDy, targetDx);
        moving = true;
      }
    }

    const halfW = this.scene === "dungeon" ? DUNGEON.width : WORLD.width;
    const halfH = this.scene === "dungeon" ? DUNGEON.height : WORLD.height;
    player.x = clamp(player.x, 48, halfW - 48);
    player.y = clamp(player.y, 48, halfH - 48);
    if (this.scene === "world") this.resolveWorldCollisions();
    player.moving = moving;
    if (moving) player.walkPhase += dt * 10;

    this.updatePendingInteract();
    this.updatePendingAbility();

    const target = this.getTarget();
    if (!target) {
      player.autoTimer = 0;
      return;
    }
    if (dist(player, target) <= def.attackRange + target.radius) {
      if (player.autoTimer <= 0) this.autoAttack(target);
    }
  }

  private resolveWorldCollisions(): void {
    const player = this.player;
    for (const obstacle of OBSTACLES) {
      const left = obstacle.x - obstacle.halfW;
      const right = obstacle.x + obstacle.halfW;
      const top = obstacle.y - obstacle.halfH;
      const bottom = obstacle.y + obstacle.halfH;
      const closestX = clamp(player.x, left, right);
      const closestY = clamp(player.y, top, bottom);
      let dx = player.x - closestX;
      let dy = player.y - closestY;
      const distance = Math.hypot(dx, dy);
      if (distance === 0) {
        const distances = [
          { value: player.x - left + player.radius, x: left - player.radius, y: player.y },
          { value: right - player.x + player.radius, x: right + player.radius, y: player.y },
          { value: player.y - top + player.radius, x: player.x, y: top - player.radius },
          { value: bottom - player.y + player.radius, x: player.x, y: bottom + player.radius },
        ];
        const nearest = distances.reduce((a, b) => (a.value < b.value ? a : b));
        player.x = nearest.x;
        player.y = nearest.y;
      } else if (distance < player.radius) {
        const push = (player.radius - distance) / distance;
        player.x += dx * push;
        player.y += dy * push;
      }
    }
    player.x = clamp(player.x, 48, WORLD.width - 48);
    player.y = clamp(player.y, 48, WORLD.height - 48);
  }

  private isInCamp(x: number, y: number): boolean {
    return Math.hypot(x - HUB.x, y - HUB.y) < CAMP_SAFE_RADIUS;
  }

  private interactionReach(npc: Npc): number {
    return npc.role === "portal" && this.scene === "dungeon" ? 96 : 136;
  }

  private updatePendingInteract(): void {
    if (!this.pendingInteractNpc) return;
    const npc = this.getNpc(this.pendingInteractNpc);
    if (!npc) {
      this.pendingInteractNpc = null;
      return;
    }
    if (dist(this.player, npc) <= this.interactionReach(npc)) {
      this.pendingInteractNpc = null;
      this.player.moveTarget = null;
      this.activateNpc(npc);
      return;
    }
    if (!this.player.moveTarget && !this.player.moving) {
      this.approachNpc(npc);
    }
  }

  private approachNpc(npc: Npc): void {
    const dx = npc.x - this.player.x;
    const dy = npc.y - this.player.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const stop = npc.role === "portal" ? (this.scene === "dungeon" ? 70 : 100) : 62;
    this.player.moveTarget = {
      x: npc.x - (dx / length) * stop,
      y: npc.y - (dy / length) * stop,
    };
  }

  private activateNpc(npc: Npc): void {
    if (npc.role === "portal") {
      if (this.scene === "dungeon") this.leaveDungeon(false);
      else this.tryEnterDungeon();
      return;
    }
    if (npc.role === "vendor") {
      this.events.sound("ui");
      this.events.openVendor();
      return;
    }
    this.events.sound("ui");
    this.events.openNpc(npc.id);
  }

  private updatePendingAbility(): void {
    if (!this.pendingAbility) return;
    const def = this.getAbilityById(this.pendingAbility);
    if (!def) {
      this.pendingAbility = null;
      return;
    }
    const target = this.getTarget();
    if (this.requiresTarget(def) && !target) {
      this.pendingAbility = null;
      return;
    }
    if (target && this.requiresTarget(def)) {
      const reach = def.range + target.radius;
      if (dist(this.player, target) <= reach) {
        this.pendingAbility = null;
        this.executeAbility(def);
      } else if (!this.player.moveTarget) {
        this.approachTarget(target, def.range);
      }
    }
  }

  private approachTarget(target: Mob, range: number): void {
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const stop = Math.max(26, range + target.radius - 18);
    this.player.moveTarget = {
      x: target.x - (dx / length) * stop,
      y: target.y - (dy / length) * stop,
    };
  }

  private updateBots(dt: number): void {
    if (this.scene === "dungeon") return;
    for (const bot of this.bots) {
      bot.wanderTimer -= dt;
      if (bot.wanderTimer <= 0) {
        const angle = Math.random() * TAU;
        const radius = randomRange(24, 150);
        bot.wanderX = clamp(bot.homeX + Math.cos(angle) * radius, 60, WORLD.width - 60);
        bot.wanderY = clamp(bot.homeY + Math.sin(angle) * radius, 60, WORLD.height - 60);
        bot.wanderTimer = randomRange(3.5, 9);
      }
      const dx = bot.wanderX - bot.x;
      const dy = bot.wanderY - bot.y;
      const length = Math.hypot(dx, dy);
      if (length > 8) {
        const speed = Math.min(46, length / dt);
        bot.x += (dx / length) * speed * dt;
        bot.y += (dy / length) * speed * dt;
        bot.facing = Math.atan2(dy, dx);
        bot.moving = true;
        bot.walkPhase += dt * 7;
      } else {
        bot.moving = false;
      }

      // Adventurers give each other room; otherwise a wandering stranger
      // can stand directly on top of the player and hide them completely.
      const px = bot.x - this.player.x;
      const py = bot.y - this.player.y;
      const playerDistance = Math.hypot(px, py);
      if (playerDistance < 58) {
        const push = (58 - playerDistance) / Math.max(playerDistance, 0.01);
        bot.x += px * push;
        bot.y += py * push;
      }
    }
  }

  private updateMobs(dt: number): void {
    for (const mob of this.mobs) {
      if (!mob.alive) {
        if (mob.respawnTimer > 0) {
          mob.respawnTimer -= dt;
          if (mob.respawnTimer <= 0) this.respawnMob(mob);
        }
        continue;
      }

      mob.hitFlash = Math.max(0, mob.hitFlash - dt);
      mob.slowTimer = Math.max(0, mob.slowTimer - dt);
      mob.rootTimer = Math.max(0, mob.rootTimer - dt);
      mob.stunTimer = Math.max(0, mob.stunTimer - dt);

      if (mob.boss) this.updateBossPulse(mob, dt);

      let target = this.getActor(mob.targetId);
      if (target && (!target.alive || dist(mob, target) > 720)) {
        mob.targetId = null;
        target = null;
      }

      if (this.scene === "world" && this.isInCamp(mob.x, mob.y)) {
        mob.targetId = null;
        mob.state = "return";
        target = null;
      }

      if (target && target.id === "player" && this.scene === "world" && this.isInCamp(this.player.x, this.player.y)) {
        mob.targetId = null;
        mob.state = "return";
        target = null;
      }

      if (!target) {
        const closest = this.findMobTarget(mob);
        if (closest) {
          mob.targetId = closest.id;
          mob.state = "chase";
          target = closest;
        } else {
          mob.state = dist(mob, { x: mob.homeX, y: mob.homeY }) > 520 ? "return" : "idle";
        }
      }

      if (!target) {
        if (mob.state === "return") {
          const dx = mob.homeX - mob.x;
          const dy = mob.homeY - mob.y;
          const length = Math.hypot(dx, dy);
          if (length < 12) {
            mob.x = mob.homeX;
            mob.y = mob.homeY;
            mob.hp = mob.maxHp;
            mob.state = "idle";
          } else {
            this.moveMob(mob, mob.homeX, mob.homeY, mob.speed * 0.9, dt);
          }
        } else {
          mob.wanderTimer -= dt;
          if (mob.wanderTimer <= 0) {
            const angle = Math.random() * TAU;
            const radius = randomRange(26, 130);
            mob.wanderX = clamp(mob.homeX + Math.cos(angle) * radius, 50, (this.scene === "dungeon" ? DUNGEON.width : WORLD.width) - 50);
            mob.wanderY = clamp(mob.homeY + Math.sin(angle) * radius, 50, (this.scene === "dungeon" ? DUNGEON.height : WORLD.height) - 50);
            if (this.scene === "world" && this.isInCamp(mob.wanderX, mob.wanderY)) {
              mob.wanderX = mob.homeX;
              mob.wanderY = mob.homeY;
            }
            mob.wanderTimer = randomRange(2.5, 6);
          }
          if (dist(mob, { x: mob.wanderX, y: mob.wanderY }) > 10) {
            this.moveMob(mob, mob.wanderX, mob.wanderY, mob.speed * 0.32, dt);
          }
        }
        continue;
      }

      mob.state = "chase";
      if (mob.stunTimer > 0) continue;
      const distance = dist(mob, target);
      const speed = mob.speed * (mob.slowTimer > 0 ? 0.48 : 1);
      if (distance > mob.range + target.radius) {
        if (mob.rootTimer <= 0) this.moveMob(mob, target.x, target.y, speed, dt);
        continue;
      }

      mob.facing = Math.atan2(target.y - mob.y, target.x - mob.x);
      mob.attackTimer -= dt;
      if (mob.attackTimer <= 0) {
        this.mobAttack(mob, target);
        mob.attackTimer = mob.boss ? 1.85 : mob.templateId === "gloom_wisp" || mob.templateId === "drowned_acolyte" ? 1.9 : 1.55;
      }
    }
  }

  private updateBossPulse(mob: Mob, dt: number): void {
    if (mob.stunTimer > 0 || !mob.targetId) return;
    mob.pulseTimer -= dt;
    if (mob.pulseTimer <= 1.4 && !mob.pulseArmed) {
      mob.pulseArmed = true;
      this.spawnRing(mob.x, mob.y, "#d8b8ff", 238, 1.4);
      this.events.sound("warn");
    }
    if (mob.pulseTimer > 0) return;
    mob.pulseTimer = 8.2;
    mob.pulseArmed = false;
    this.spawnRing(mob.x, mob.y, "#b8fff2", 246, 0.55);
    this.spawnBurst(mob.x, mob.y, "#b8fff2", 24, 180, "spark");
    this.events.shake(3);
    const playerDist = dist(mob, this.player);
    if (playerDist < 246 && this.mode === "playing") {
      this.damagePlayer(32, mob.name);
      this.events.flash("rgba(140,255,235,0.16)", 0.28);
    }
    for (const ally of this.allies) {
      if (ally.alive && dist(mob, ally) < 246) this.damageAlly(ally, 30);
    }
  }

  private moveMob(mob: Mob, x: number, y: number, speed: number, dt: number): void {
    const dx = x - mob.x;
    const dy = y - mob.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) return;
    mob.x += (dx / length) * speed * dt;
    mob.y += (dy / length) * speed * dt;
    mob.facing = Math.atan2(dy, dx);
  }

  private findMobTarget(mob: Mob): { id: string; x: number; y: number; radius: number; alive: boolean } | null {
    let best: { id: string; x: number; y: number; radius: number; alive: boolean } | null = null;
    let bestDistance = mob.aggro;
    if (
      this.mode === "playing" &&
      this.player.hp > 0 &&
      (this.scene !== "world" || !this.isInCamp(this.player.x, this.player.y))
    ) {
      const playerDistance = dist(mob, this.player);
      if (playerDistance < bestDistance) {
        bestDistance = playerDistance;
        best = {
          id: "player",
          x: this.player.x,
          y: this.player.y,
          radius: this.player.radius,
          alive: true,
        };
      }
    }
    for (const ally of this.allies) {
      if (!ally.alive) continue;
      const distance = dist(mob, ally);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = {
          id: ally.id,
          x: ally.x,
          y: ally.y,
          radius: 15,
          alive: ally.alive,
        };
      }
    }
    return best;
  }

  private getActor(id: string | null): {
    id: string;
    x: number;
    y: number;
    radius: number;
    alive: boolean;
  } | null {
    if (!id) return null;
    if (id === "player") {
      return {
        id: "player",
        x: this.player.x,
        y: this.player.y,
        radius: this.player.radius,
        alive: this.mode === "playing" && !this.player.dead,
      };
    }
    const ally = this.allies.find((a) => a.id === id);
    if (ally) {
      return { id: ally.id, x: ally.x, y: ally.y, radius: 15, alive: ally.alive };
    }
    return null;
  }

  private mobAttack(
    mob: Mob,
    target: { id: string; x: number; y: number; radius: number; alive: boolean },
  ): void {
    const raw = mob.damage * randomRange(0.88, 1.16) * (mob.enraged ? 1.32 : 1);
    if (mob.templateId === "gloom_wisp") {
      this.spawnBeam(mob.x, mob.y, target.x, target.y, "#79f1df");
    } else if (mob.templateId === "drowned_acolyte") {
      this.spawnBeam(mob.x, mob.y, target.x, target.y, "#9fe8e0");
    } else if (mob.boss) {
      this.spawnBurst(target.x, target.y, "#d6fff8", 8, 90, "shadow");
    } else {
      this.spawnBurst(target.x, target.y, "#e0b078", 5, 80, "spark");
    }
    if (target.id === "player") {
      if (!this.getTarget()) this.player.targetId = mob.id;
      this.damagePlayer(raw, mob.name);
    } else {
      const ally = this.allies.find((a) => a.id === target.id);
      if (ally) this.damageAlly(ally, raw);
    }
    this.events.sound(mob.boss ? "bossHit" : "enemyHit");
  }

  private updateAllies(dt: number): void {
    if (this.mode !== "playing") return;
    for (const ally of this.allies) {
      if (!ally.alive) {
        ally.downedTimer -= dt;
        if (ally.downedTimer <= 0) {
          ally.alive = true;
          ally.hp = ally.maxHp * 0.62;
          ally.x = this.player.x + randomRange(-42, 42);
          ally.y = this.player.y + randomRange(30, 60);
          this.addChat("party", ally.name, "I'm back. Mostly.", ally.color);
          this.spawnRing(ally.x, ally.y, ally.color, 46, 0.5);
        }
        continue;
      }

      let target = this.mobs.find((mob) => mob.id === ally.targetId && mob.alive) ?? null;
      if (target && dist(ally, target) > 560) {
        ally.targetId = null;
        target = null;
      }
      if (!target) {
        const playerPos = this.player;
        const candidates = this.mobs
          .filter(
            (mob) =>
              mob.alive &&
              dist(playerPos, mob) < 380 &&
              dist(ally, mob) < 560,
          )
          .sort((a, b) => dist(ally, a) - dist(ally, b));
        target = candidates[0] ?? null;
        ally.targetId = target?.id ?? null;
      }

      if (target) {
        const distance = dist(ally, target);
        if (distance > ally.range + target.radius) {
          const dx = target.x - ally.x;
          const dy = target.y - ally.y;
          const length = Math.max(1, Math.hypot(dx, dy));
          ally.x += (dx / length) * ally.speed * dt;
          ally.y += (dy / length) * ally.speed * dt;
          ally.facing = Math.atan2(dy, dx);
          ally.moving = true;
          ally.walkPhase += dt * 8;
        } else {
          ally.moving = false;
          ally.facing = Math.atan2(target.y - ally.y, target.x - ally.x);
          ally.attackTimer -= dt;
          if (ally.attackTimer <= 0) {
            ally.attackTimer = ally.classId === "vanguard" ? 1.45 : 1.7;
            const amount = Math.round(ally.damage * randomRange(0.85, 1.15));
            if (ally.classId === "arcanist") {
              this.spawnBeam(ally.x, ally.y, target.x, target.y, ally.color);
            } else {
              this.spawnBurst(target.x, target.y, ally.color, 5, 80, "spark");
            }
            this.damageMob(target, amount, false, ally.color);
          }
        }
        if (dist(ally, this.player) > 700) {
          ally.x = this.player.x + randomRange(-40, 40);
          ally.y = this.player.y + randomRange(35, 65);
        }
      } else {
        const dx = this.player.x - ally.x;
        const dy = this.player.y - ally.y;
        const distance = Math.hypot(dx, dy);
        ally.moving = false;
        if (distance > 92) {
          const length = Math.max(1, distance);
          ally.x += (dx / length) * ally.speed * 0.92 * dt;
          ally.y += (dy / length) * ally.speed * 0.92 * dt;
          ally.facing = Math.atan2(dy, dx);
          ally.moving = true;
          ally.walkPhase += dt * 8;
        }
      }
      if (ally.hp < ally.maxHp) ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * 0.004 * dt);
    }
  }

  private damageAlly(ally: Ally, raw: number): void {
    if (!ally.alive) return;
    const reduced = Math.round(raw * 0.84);
    ally.hp = Math.max(0, ally.hp - reduced);
    this.addFloater(ally.x, ally.y - 34, `-${reduced}`, "#f0a388", 14, false);
    this.spawnBurst(ally.x, ally.y - 12, "#d38a74", 5, 70, "spark");
    if (ally.hp <= 0) {
      ally.alive = false;
      ally.downedTimer = 8;
      ally.targetId = null;
      this.addChat("party", ally.name, "I'm down — keep going!", ally.color);
      this.addFloater(ally.x, ally.y - 48, "DOWN", "#ffb3a6", 18, true);
      this.events.sound("death");
    }
  }

  private autoAttack(target: Mob): void {
    const player = this.player;
    const def = CLASSES[player.classId];
    if (dist(player, target) > def.attackRange + target.radius) return;
    const amount = Math.round((player.power * 1.1 + player.level * 2.4 + randomRange(0, 4)) * (player.buffs.some((b) => b.id === "battlecry") ? 1.1 : 1));
    const crit = Math.random() < 0.14;
    const final = crit ? Math.round(amount * 1.7) : amount;
    if (player.classId === "vanguard") {
      this.spawnBurst(target.x, target.y - 10, "#f0c98c", 7, 110, "spark");
      this.spawnSlash(target.x, target.y, Math.atan2(target.y - player.y, target.x - player.x), "#f1d49a");
      player.resource = Math.min(player.maxResource, player.resource + 9);
      this.events.sound("attack");
    } else if (player.classId === "arcanist") {
      this.spawnBeam(player.x, player.y - 16, target.x, target.y - 10, "#aebcff");
      this.events.sound("cast");
    } else {
      this.spawnBeam(player.x, player.y - 16, target.x, target.y - 10, "#a8e79e");
      this.events.sound("arrow");
    }
    this.damageMob(target, final, crit, CLASSES[player.classId].color);
    player.autoTimer = def.attackSpeed;
    this.combatTimer = 5;
    player.facing = Math.atan2(target.y - player.y, target.x - player.x);
  }

  useAbility(index: number): void {
    if (this.mode !== "playing" || this.player.dead) return;
    const def = this.getAbility(index);
    if (!def) return;
    if (def.id === "potion") {
      this.usePotion();
      return;
    }
    if (this.player.gcd > 0) return;
    if (this.player.cooldowns[def.id] > 0) {
      this.events.sound("error");
      return;
    }
    if (this.player.resource < def.cost) {
      this.events.toast("Not enough " + this.player.resourceName, `Need ${def.cost} ${this.player.resourceName}.`, "danger");
      this.events.sound("error");
      return;
    }
    const target = this.getTarget();
    if (this.requiresTarget(def)) {
      if (!target) {
        this.events.toast("No target", "Select an enemy with Tab or a click.", "system");
        this.events.sound("error");
        return;
      }
      if (dist(this.player, target) > def.range + target.radius) {
        this.pendingAbility = def.id;
        this.approachTarget(target, def.range);
        return;
      }
    }
    this.pendingAbility = null;
    this.executeAbility(def);
  }

  private executeAbility(def: AbilityDef): void {
    const player = this.player;
    if (this.player.gcd > 0 || this.player.cooldowns[def.id] > 0) return;
    if (player.resource < def.cost) return;
    const target = this.getTarget();

    if (def.id === "greenmend" && player.hp >= player.maxHp) {
      this.events.toast("Already at full health", `${def.name} would be wasted.`, "system");
      return;
    }
    if ((def.kind === "strike" || def.kind === "root" || (def.kind === "aoe" && def.id === "suncleave")) && !target) return;

    player.resource -= def.cost;
    player.cooldowns[def.id] = def.cooldown;
    player.gcd = 0.82;
    this.combatTimer = 5;

    switch (def.id) {
      case "suncleave": {
        if (!target) break;
        const primary = this.rollAbilityDamage(def.power * 1.45);
        this.spawnSlash(target.x, target.y, Math.atan2(target.y - player.y, target.x - player.x), "#ffd78f");
        this.spawnBurst(target.x, target.y, "#ffcf78", 12, 140, "spark");
        this.damageMob(target, primary.amount, primary.crit, def.color);
        for (const mob of this.mobs) {
          if (mob.id === target.id || !mob.alive) continue;
          if (dist(mob, target) <= (def.radius ?? 82)) {
            const splash = this.rollAbilityDamage(def.power * 0.8);
            this.damageMob(mob, splash.amount, splash.crit, def.color);
          }
        }
        this.events.sound("cleave");
        break;
      }
      case "aegis_rush": {
        if (!target) break;
        const result = this.rollAbilityDamage(def.power * 1.15);
        target.stunTimer = Math.max(target.stunTimer, 2);
        this.spawnBurst(target.x, target.y, "#ffe4ad", 16, 150, "spark");
        this.spawnRing(target.x, target.y, "#ffe7b4", 58, 0.42);
        this.damageMob(target, result.amount, result.crit, def.color);
        this.addFloater(target.x, target.y - 54, "STUNNED", "#ffe8b0", 14, false);
        this.events.shake(2);
        this.events.sound("stun");
        break;
      }
      case "unbroken": {
        const heal = Math.round(player.maxHp * 0.28);
        this.healPlayer(heal);
        player.shield = Math.max(player.shield, Math.round(player.maxHp * 0.24));
        this.addBuff("shield", "Unbroken", 9, "#ffd98f", "✧");
        this.spawnRing(player.x, player.y, "#ffd98f", 74, 0.65);
        this.spawnBurst(player.x, player.y, "#ffe4ac", 20, 100, "heal");
        this.addFloater(player.x, player.y - 56, "UNBROKEN", "#ffe1a3", 15, false);
        this.events.sound("heal");
        break;
      }
      case "cindervein": {
        if (!target) break;
        const result = this.rollAbilityDamage(def.power * 1.5);
        this.spawnBeam(player.x, player.y - 20, target.x, target.y - 12, "#c3cdff");
        this.spawnBurst(target.x, target.y, "#aebcff", 12, 120, "spark");
        this.damageMob(target, result.amount, result.crit, def.color);
        this.events.sound("cast");
        break;
      }
      case "hollow_frost": {
        this.spawnRing(player.x, player.y, "#bdf4ff", def.radius ?? 172, 0.55);
        this.spawnBurst(player.x, player.y, "#d2f8ff", 26, 180, "spark");
        let hits = 0;
        for (const mob of this.mobs) {
          if (!mob.alive || dist(player, mob) > (def.radius ?? 172)) continue;
          hits += 1;
          const result = this.rollAbilityDamage(def.power * 1.08);
          mob.slowTimer = Math.max(mob.slowTimer, 3.5);
          this.damageMob(mob, result.amount, result.crit, def.color);
        }
        if (hits === 0) this.events.sound("frost");
        break;
      }
      case "starstep": {
        let dx = this.mouse.x - player.x;
        let dy = this.mouse.y - player.y;
        if (Math.hypot(dx, dy) < 1) {
          dx = Math.cos(player.facing);
          dy = Math.sin(player.facing);
        }
        const length = Math.hypot(dx, dy) || 1;
        const travel = Math.min(def.range, length);
        const oldX = player.x;
        const oldY = player.y;
        player.x = clamp(player.x + (dx / length) * travel, 50, (this.scene === "dungeon" ? DUNGEON.width : WORLD.width) - 50);
        player.y = clamp(player.y + (dy / length) * travel, 50, (this.scene === "dungeon" ? DUNGEON.height : WORLD.height) - 50);
        player.moveTarget = null;
        player.shield = Math.max(player.shield, Math.round(player.maxHp * 0.22));
        this.addBuff("shield", "Starlight", 7, "#c8c1ff", "✦");
        this.spawnBurst(oldX, oldY, "#b6b2ff", 18, 120, "spark");
        this.spawnBurst(player.x, player.y, "#d8d1ff", 18, 90, "spark");
        this.spawnRing(player.x, player.y, "#c8c1ff", 60, 0.4);
        this.events.sound("blink");
        break;
      }
      case "thornshot": {
        if (!target) break;
        const result = this.rollAbilityDamage(def.power * 1.45);
        this.spawnBeam(player.x, player.y - 20, target.x, target.y - 10, "#b8ec9d");
        this.spawnBurst(target.x, target.y, "#9bdd82", 10, 110, "spark");
        this.damageMob(target, result.amount, result.crit, def.color);
        this.events.sound("arrow");
        break;
      }
      case "rootcall": {
        if (!target) break;
        target.rootTimer = Math.max(target.rootTimer, 2.5);
        const result = this.rollAbilityDamage(def.power * 1.05);
        this.spawnRing(target.x, target.y, "#a8e07e", 58, 0.6);
        this.spawnBurst(target.x, target.y, "#92d56a", 14, 110, "heal");
        this.damageMob(target, result.amount, result.crit, def.color);
        this.addFloater(target.x, target.y - 54, "ROOTED", "#b7ee8d", 14, false);
        this.events.sound("root");
        break;
      }
      case "greenmend": {
        this.healPlayer(Math.round(player.maxHp * 0.3));
        this.spawnRing(player.x, player.y, "#b9ed91", 64, 0.6);
        this.spawnBurst(player.x, player.y, "#c7f2a8", 22, 90, "heal");
        this.events.sound("heal");
        break;
      }
      default:
        break;
    }
  }

  private rollAbilityDamage(base: number): { amount: number; crit: boolean } {
    const raw = (base + this.player.power * 1.15 + this.player.level * 2.2) * randomRange(0.92, 1.08);
    const crit = Math.random() < 0.15;
    return { amount: Math.round(crit ? raw * 1.65 : raw), crit };
  }

  private requiresTarget(def: AbilityDef): boolean {
    return def.kind === "strike" || def.kind === "root" || def.id === "suncleave";
  }

  private usePotion(): void {
    if (this.mode !== "playing" || this.player.dead) return;
    if (this.player.gcd > 0 || this.player.cooldowns.potion > 0) {
      this.events.sound("error");
      return;
    }
    if (this.player.potions <= 0) {
      this.events.toast("No draughts left", "Sable sells Sunpetal Draughts at the camp.", "danger");
      this.events.sound("error");
      return;
    }
    if (this.player.hp >= this.player.maxHp) {
      this.events.toast("Already at full health", "Save the draught for later.", "system");
      return;
    }
    this.player.potions -= 1;
    this.player.cooldowns.potion = POTION_ABILITY.cooldown;
    this.player.gcd = 0.7;
    this.healPlayer(Math.round(this.player.maxHp * 0.42));
    this.spawnBurst(this.player.x, this.player.y, "#ffd383", 18, 80, "heal");
    this.events.sound("potion");
  }

  private damageMob(mob: Mob, amount: number, crit: boolean, color: string): void {
    if (!mob.alive) return;
    mob.hp = Math.max(0, mob.hp - amount);
    mob.hitFlash = 0.18;
    if (mob.state === "idle" || mob.state === "wander" || mob.state === "return") {
      mob.targetId = "player";
      mob.state = "chase";
    }
    this.addFloater(mob.x + randomRange(-8, 8), mob.y - 38 - (mob.scale - 1) * 16, `${amount}`, crit ? "#ffe29a" : color, crit ? 21 : 15, crit);
    this.spawnBurst(mob.x, mob.y - 10, color, crit ? 12 : 6, crit ? 140 : 95, "spark");
    this.combatTimer = 5;
    if (crit) {
      this.events.shake(1.2);
      this.events.sound("crit");
    }
    if (mob.boss) this.handleBossThresholds(mob);
    if (mob.hp <= 0) {
      this.killMob(mob);
    }
  }

  private handleBossThresholds(mob: Mob): void {
    const ratio = mob.hp / mob.maxHp;
    if (!mob.summoned && ratio < 0.62) {
      mob.summoned = true;
      this.addChat("party", "Mira", "It's calling something up from the water!", CLASSES.arcanist.color);
      this.spawnRing(mob.x, mob.y, "#b6fff1", 120, 0.8);
      for (let i = 0; i < 2; i += 1) {
        const x = clamp(mob.x + (i === 0 ? -105 : 105), 60, DUNGEON.width - 60);
        const y = clamp(mob.y + 55, 60, DUNGEON.height - 60);
        const add = this.makeMob("drowned_acolyte", x, y, true);
        add.targetId = "player";
        this.mobs.push(add);
        this.spawnBurst(x, y, "#9fe8e0", 16, 100, "shadow");
      }
      this.events.toast("The hymn splits", "Drowned acolytes rise from the dark.", "danger");
      this.events.sound("boss");
    }
    if (!mob.enraged && ratio < 0.3) {
      mob.enraged = true;
      this.events.toast("The choir rises", "Nhal'Vareth is enraged.", "danger");
      this.events.shake(4);
      this.events.sound("boss");
      this.addChat("party", "Thorne", "Hold! It's almost done!", CLASSES.vanguard.color);
    }
  }

  private killMob(mob: Mob): void {
    if (!mob.alive) return;
    mob.alive = false;
    mob.state = "dead";
    mob.targetId = null;
    mob.hp = 0;
    this.player.kills += 1;
    const template = MOBS[mob.templateId];
    const gold = mob.boss ? 65 : Math.round(mob.level * 1.35 + randomRange(0, 4));
    this.player.gold += gold;
    this.awardXp(mob.xp);
    this.addFloater(mob.x, mob.y - 56, `+${mob.xp} XP`, "#b9d8ff", 14, false);
    this.spawnBurst(mob.x, mob.y - 8, mob.accent, mob.boss ? 34 : 12, mob.boss ? 180 : 110, "shadow");
    this.spawnRing(mob.x, mob.y, mob.accent, mob.boss ? 160 : 44, 0.5);
    this.events.sound(mob.boss ? "victory" : "kill");
    this.addChat("combat", "", `You defeated ${mob.name}. +${mob.xp} XP, +${gold}g`, CHANNEL_COLORS.combat);

    if (this.scene === "world") {
      mob.respawnTimer = mob.boss ? 0 : randomRange(20, 34);
    } else {
      mob.respawnTimer = 0;
    }

    if (template.loot && Math.random() < (template.lootChance ?? 1)) {
      this.gainItem(template.loot, true);
    }
    if (mob.boss) {
      this.player.gold += 75;
    }

    this.advanceQuests(mob);
    if (this.player.targetId === mob.id) {
      this.player.targetId = null;
      this.pendingAbility = null;
    }
    if (mob.templateId === "riftwraith") {
      this.endRift(true);
    }
    if (mob.boss && this.scene === "dungeon") {
      this.completeDungeon();
    }
  }

  private respawnMob(mob: Mob): void {
    mob.alive = true;
    mob.hp = mob.maxHp;
    mob.x = mob.homeX;
    mob.y = mob.homeY;
    mob.state = "idle";
    mob.targetId = null;
    mob.stunTimer = 0;
    mob.slowTimer = 0;
    mob.rootTimer = 0;
    mob.attackTimer = randomRange(0.3, 1);
    mob.respawnTimer = 0;
    this.spawnRing(mob.x, mob.y, mob.accent, 30, 0.45);
  }

  private damagePlayer(raw: number, source: string): void {
    if (this.mode !== "playing" || this.player.dead) return;
    const reduced = Math.max(1, Math.round(raw * (1 - this.player.armor / (this.player.armor + 165))));
    let remaining = reduced;
    if (this.player.shield > 0) {
      const absorbed = Math.min(this.player.shield, remaining);
      this.player.shield -= absorbed;
      remaining -= absorbed;
      if (absorbed > 0) {
        this.addFloater(this.player.x, this.player.y - 58, `-${absorbed} shielded`, "#bfe5ff", 12, false);
      }
      if (this.player.shield <= 0) {
        this.player.buffs = this.player.buffs.filter((b) => b.id !== "shield");
      }
    }
    if (remaining > 0) {
      this.player.hp = Math.max(0, this.player.hp - remaining);
      this.addFloater(this.player.x + randomRange(-6, 6), this.player.y - 60, `-${remaining}`, "#ff9d8f", 17, remaining > reduced * 0.8);
      this.spawnBurst(this.player.x, this.player.y - 22, "#e59a82", 7, 100, "spark");
      this.events.flash("rgba(180,42,42,0.13)", 0.22);
      this.events.shake(1);
    }
    this.combatTimer = 5;
    this.player.buffs = this.player.buffs.filter((b) => b.id !== "meditating");
    if (this.player.hp <= 0) {
      this.killPlayer(source);
    } else if (this.player.hp / this.player.maxHp < 0.25 && this.lastDeadCheck > 3) {
      this.lastDeadCheck = 0;
      this.addChat("system", "", "Your vision swims. Drink a draught or disengage.", CHANNEL_COLORS.system);
      this.events.sound("lowHealth");
    }
    this.lastDeadCheck += 0.016;
  }

  private healPlayer(amount: number): void {
    const healed = Math.min(amount, this.player.maxHp - this.player.hp);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + amount);
    if (healed > 0) {
      this.addFloater(this.player.x, this.player.y - 58, `+${Math.round(healed)}`, "#9fe3a7", 16, false);
    }
  }

  private killPlayer(source: string): void {
    if (this.mode === "dead") return;
    this.mode = "dead";
    this.player.dead = true;
    this.player.hp = 0;
    this.player.shield = 0;
    this.player.buffs = [];
    this.player.deaths += 1;
    this.player.targetId = null;
    this.player.moveTarget = null;
    this.keys.clear();
    this.pendingAbility = null;
    for (const mob of this.mobs) mob.targetId = null;
    for (const ally of this.allies) ally.targetId = null;
    this.spawnRing(this.player.x, this.player.y, "#d98c88", 86, 1.1);
    this.events.shake(5);
    this.events.flash("rgba(120,12,12,0.32)", 0.6);
    this.events.sound("death");
    this.addChat("system", "", `You were slain by ${source}. The world keeps playing.`, CHANNEL_COLORS.system);
  }

  releaseSpirit(): void {
    if (this.mode !== "dead") return;
    const wasDungeon = this.scene === "dungeon";
    if (wasDungeon) {
      this.leaveDungeon(true);
    }
    this.mode = "playing";
    this.player.dead = false;
    this.player.hp = Math.round(this.player.maxHp * 0.62);
    this.player.resource = Math.round(this.player.maxResource * 0.45);
    this.player.shield = 0;
    this.player.x = HUB.x + 6;
    this.player.y = HUB.y + 64;
    this.player.moveTarget = null;
    this.player.targetId = null;
    this.zoneKey = "hub";
    this.combatTimer = 0;
    this.setAreaTitle("Wayfarer's Rest", "The fire is still warm");
    this.events.toast("Spirit returned", "You wake beside the fire at Wayfarer's Rest.", "system");
    this.addChat("system", "", "You return to the last warm fire.", CHANNEL_COLORS.system);
    this.events.sound("respawn");
  }

  selectTarget(id: string | null): void {
    this.player.targetId = id;
    this.pendingAbility = null;
    this.pendingInteractNpc = null;
    this.player.autoTimer = 0;
  }

  getTarget(): Mob | null {
    if (!this.player.targetId) return null;
    const mob = this.mobs.find((m) => m.id === this.player.targetId && m.alive);
    return mob ?? null;
  }

  cycleTarget(): void {
    const candidates = this.mobs
      .filter((mob) => mob.alive && dist(this.player, mob) < 760)
      .sort((a, b) => dist(this.player, a) - dist(this.player, b));
    if (candidates.length === 0) {
      this.player.targetId = null;
      return;
    }
    const index = candidates.findIndex((mob) => mob.id === this.player.targetId);
    const next = candidates[(index + 1) % candidates.length];
    this.selectTarget(next.id);
    this.events.sound("target");
  }

  handleWorldClick(x: number, y: number): void {
    if (this.mode !== "playing") return;
    const point = { x, y };
    const npc = this.getNpcAt(point);
    if (npc) {
      this.player.moveTarget = null;
      if (dist(this.player, npc) <= this.interactionReach(npc)) {
        this.pendingInteractNpc = null;
        this.activateNpc(npc);
      } else {
        this.pendingInteractNpc = npc.id;
        this.approachNpc(npc);
      }
      return;
    }
    const mob = this.mobs
      .filter((m) => m.alive)
      .sort((a, b) => dist(point, a) - dist(point, b))[0];
    if (mob && dist(point, mob) < mob.radius + 26) {
      this.selectTarget(mob.id);
      return;
    }
    this.pendingInteractNpc = null;
    this.player.moveTarget = { x, y };
    this.pendingAbility = null;
  }

  private getNpcAt(point: Vec): Npc | null {
    let best: Npc | null = null;
    let bestDistance = 50;
    for (const npc of this.npcs) {
      const distance = dist(point, npc);
      if (distance < bestDistance) {
        best = npc;
        bestDistance = distance;
      }
    }
    return best;
  }

  getInteractable(): Interactable | null {
    if (this.mode !== "playing") return null;
    if (this.scene === "dungeon") {
      const gate = this.npcs.find((npc) => npc.role === "portal");
      if (gate && dist(this.player, gate) < 96) {
        return {
          kind: "exit",
          npc: gate,
          label: "Leave the Reliquary",
          sub: "Return to the Ashen Verge",
        };
      }
      return null;
    }
    let best: Npc | null = null;
    let bestDistance = 132;
    for (const npc of this.npcs) {
      const distance = dist(this.player, npc);
      if (distance < bestDistance) {
        best = npc;
        bestDistance = distance;
      }
    }
    if (!best) return null;
    if (best.role === "portal") {
      const status = this.player.quests.sunken_choir?.status;
      return {
        kind: "portal",
        npc: best,
        label: status === "active" ? "Enter the Sunken Reliquary" : "Inspect the Reliquary Seal",
        sub:
          status === "active"
            ? "Mira and Thorne are waiting inside"
            : status === "ready" || status === "done"
              ? "The stone is quiet now"
              : "The seal is cold to the touch",
      };
    }
    return {
      kind: "npc",
      npc: best,
      label:
        best.role === "vendor"
          ? `Trade with ${best.name}`
          : best.role === "flavor"
            ? `Speak with ${best.name}`
            : `Speak with ${best.name}`,
      sub: best.title,
    };
  }

  interact(): void {
    const interactable = this.getInteractable();
    if (!interactable) {
      this.events.toast("Nothing within reach", "Move closer to an NPC or marker.", "system");
      return;
    }
    this.pendingInteractNpc = null;
    if (interactable.kind === "exit") {
      this.leaveDungeon(false);
      return;
    }
    if (interactable.kind === "portal") {
      this.tryEnterDungeon();
      return;
    }
    this.activateNpc(interactable.npc);
  }

  getNpc(id: string): Npc | null {
    return this.npcs.find((npc) => npc.id === id) ?? null;
  }

  getNpcQuest(npcId: string): NpcQuest | null {
    const npc = this.getNpc(npcId);
    if (!npc) return null;
    const priority: Record<QuestStatus, number> = {
      ready: 5,
      available: 4,
      active: 3,
      locked: 2,
      done: 1,
    };
    let best: NpcQuest | null = null;
    for (const questId of npc.questIds) {
      const quest = QUESTS.find((q) => q.id === questId);
      const state = this.player.quests[questId];
      if (!quest || !state) continue;
      if (!best || priority[state.status] > priority[best.status]) {
        best = { quest, status: state.status };
      }
    }
    return best;
  }

  acceptQuest(questId: string): void {
    const state = this.player.quests[questId];
    const quest = QUESTS.find((q) => q.id === questId);
    if (!state || !quest || state.status !== "available") return;
    state.status = "active";
    state.progress = 0;
    this.events.toast("Quest accepted", quest.title, "quest");
    this.events.sound("quest");
    this.addChat("system", "", `Quest accepted: ${quest.title}`, CHANNEL_COLORS.system);
    this.refreshQuestAvailability();
  }

  completeQuest(questId: string): void {
    const state = this.player.quests[questId];
    const quest = QUESTS.find((q) => q.id === questId);
    if (!state || !quest || state.status !== "ready") return;
    state.status = "done";
    this.player.gold += quest.reward.gold;
    if (quest.reward.item) this.gainItem(quest.reward.item, true);
    if (quest.reward.potions) this.player.potions += quest.reward.potions;
    this.awardXp(quest.reward.xp);
    this.spawnRing(this.player.x, this.player.y, "#f4d18b", 90, 0.8);
    this.spawnBurst(this.player.x, this.player.y, "#ffe6a8", 28, 130, "levelup");
    this.events.toast("Quest complete", `${quest.title}  ·  +${quest.reward.gold}g`, "gold");
    this.events.sound("questComplete");
    this.addChat("system", "", `Quest complete: ${quest.title}`, "#e4c67d");
    const bot = randomItem(BOTS);
    this.scheduleChat(
      2.1,
      "world",
      bot.name,
      quest.id === "sunken_choir" ? "the hymn stopped. that was you, wasn't it?" : "grats!",
      CLASSES[bot.classId].color,
    );
    if (quest.id === "sunken_choir") {
      this.scheduleChat(3.6, "system", "", `Server: ${this.player.name} has silenced the Sunken Choir.`, CHANNEL_COLORS.system);
    }
    this.refreshQuestAvailability();
  }

  private advanceQuests(mob: Mob): void {
    for (const quest of QUESTS) {
      const state = this.player.quests[quest.id];
      if (!state || state.status !== "active") continue;
      if (quest.objective.target !== mob.templateId) continue;
      if (quest.objective.kind === "boss" && !mob.boss) continue;
      state.progress = Math.min(quest.objective.count, state.progress + 1);
      if (state.progress >= quest.objective.count) {
        state.status = "ready";
        this.events.toast("Ready to turn in", quest.title, "quest");
        this.events.sound("questReady");
        this.addChat("system", "", `${quest.title} is ready to turn in.`, CHANNEL_COLORS.system);
      }
    }
  }

  private refreshQuestAvailability(): void {
    for (const quest of QUESTS) {
      const state = this.player.quests[quest.id] ?? { status: "locked", progress: 0 };
      this.player.quests[quest.id] = state;
      if (state.status === "done" || state.status === "active" || state.status === "ready") continue;
      const prereqOk = !quest.prereq || this.player.quests[quest.prereq]?.status === "done";
      state.status = prereqOk && this.player.level >= quest.level ? "available" : "locked";
    }
  }

  private awardXp(amount: number): void {
    this.player.xp += amount;
    this.refreshQuestAvailability();
    while (this.player.xp >= this.player.xpNext && this.player.level < 12) {
      this.player.xp -= this.player.xpNext;
      this.player.level += 1;
      this.player.xpNext = xpNeeded(this.player.level);
      this.recalculateStats(true);
      this.player.resource = this.player.maxResource;
      this.spawnRing(this.player.x, this.player.y, "#ffe6a0", 100, 1);
      this.spawnBurst(this.player.x, this.player.y, "#ffe29a", 36, 170, "levelup");
      this.events.toast("Level " + this.player.level, "Your path grows clearer.", "gold");
      this.events.sound("levelup");
      this.addChat("system", "", `${this.player.name} has reached level ${this.player.level}.`, "#e6c77b");
      const bot = randomItem(BOTS);
      this.scheduleChat(1.9, "world", bot.name, "ding " + this.player.level + "! grats!", CLASSES[bot.classId].color);
      this.refreshQuestAvailability();
    }
  }

  private gainItem(defId: string, announce: boolean): void {
    const def = ITEMS[defId];
    if (!def) return;
    const instance: ItemInstance = { uid: `item_${++this.uidCounter}`, defId };
    const current = this.player.equipment[def.slot];
    const currentDef = current ? ITEMS[current.defId] : null;
    const better = !currentDef || itemScore(def) > itemScore(currentDef);
    if (better) {
      this.player.equipment[def.slot] = instance;
      if (current) this.pushToBag(current, false);
      this.recalculateStats(false);
      if (announce) {
        this.events.toast(`Equipped: ${def.name}`, `${def.slot}  ·  ${def.rarity}`, "loot");
        this.addChat("loot", "", `You equipped ${def.name}.`, rarityColor(def.rarity));
      }
    } else {
      this.pushToBag(instance, announce);
    }
    this.events.sound("loot");
  }

  private pushToBag(instance: ItemInstance, announce: boolean): void {
    const def = ITEMS[instance.defId];
    if (!def) return;
    const duplicate = this.player.inventory.find((item) => item.defId === instance.defId);
    if (duplicate) {
      const sold = Math.max(1, Math.floor(def.value * 0.5));
      this.player.gold += sold;
      if (announce) {
        this.events.toast("Duplicate sold", `${def.name} · +${sold}g`, "system");
      }
      return;
    }
    if (this.player.inventory.length < BAG_SIZE) {
      this.player.inventory.push(instance);
      if (announce) {
        this.events.toast(`Looted: ${def.name}`, `${def.slot}  ·  ${def.rarity}`, "loot");
        this.addChat("loot", "", `You looted ${def.name}.`, rarityColor(def.rarity));
      }
    } else {
      const sold = Math.max(1, Math.floor(def.value * 0.5));
      this.player.gold += sold;
      this.events.toast("Bag full — item sold", `${def.name}  ·  +${sold}g`, "system");
    }
  }

  equipItem(uid: string): void {
    const index = this.player.inventory.findIndex((item) => item.uid === uid);
    if (index < 0) return;
    const instance = this.player.inventory[index];
    const def = ITEMS[instance.defId];
    if (!def) return;
    this.player.inventory.splice(index, 1);
    const old = this.player.equipment[def.slot];
    this.player.equipment[def.slot] = instance;
    if (old) this.player.inventory.push(old);
    this.recalculateStats(false);
    this.events.toast(`Equipped: ${def.name}`, `${def.slot}  ·  ${def.rarity}`, "loot");
    this.events.sound("equip");
  }

  sellItem(uid: string): void {
    const index = this.player.inventory.findIndex((item) => item.uid === uid);
    if (index < 0) return;
    const instance = this.player.inventory[index];
    const def = ITEMS[instance.defId];
    this.player.inventory.splice(index, 1);
    const value = Math.max(1, Math.floor((def?.value ?? 1) * 0.5));
    this.player.gold += value;
    this.events.toast("Item sold", `+${value}g`, "gold");
    this.events.sound("coin");
  }

  buyItem(itemId: string): void {
    const stock = VENDOR_STOCK.find((entry) => entry.itemId === itemId);
    if (!stock) return;
    if (this.player.gold < stock.price) {
      this.events.toast("Not enough gold", `You need ${stock.price}g.`, "danger");
      this.events.sound("error");
      return;
    }
    this.player.gold -= stock.price;
    if (itemId === "potion") {
      this.player.potions += 1;
      this.events.toast("Purchased Sunpetal Draught", `You now carry ${this.player.potions}.`, "loot");
    } else {
      this.gainItem(itemId, true);
    }
    this.events.sound("coin");
  }

  getAbility(index: number): AbilityDef | null {
    if (index === 3) return POTION_ABILITY;
    return CLASSES[this.player.classId].abilities[index] ?? null;
  }

  getAbilityById(id: string): AbilityDef | null {
    if (id === "potion") return POTION_ABILITY;
    return CLASSES[this.player.classId].abilities.find((a) => a.id === id) ?? null;
  }

  getAbilityList(): AbilityDef[] {
    return [...CLASSES[this.player.classId].abilities, POTION_ABILITY];
  }

  getQuestStatus(questId: string): QuestStatus {
    return this.player.quests[questId]?.status ?? "locked";
  }

  isInCombat(): boolean {
    return this.combatTimer > 0;
  }

  sendChat(text: string): void {
    const clean = text.trim().slice(0, 180);
    if (!clean) return;
    if (clean.toLowerCase() === "/who") {
      this.addChat("system", "", `${this.online.toLocaleString()} adventurers online. ${this.bots.length} are nearby.`, CHANNEL_COLORS.system);
      return;
    }
    this.addChat("say", this.player.name, clean, CLASSES[this.player.classId].color);
    const lower = clean.toLowerCase();
    let reply = randomItem(CHAT_REPLIES);
    let author = randomItem(BOTS);
    if (lower.includes("reliquary") || lower.includes("dungeon")) {
      author = BOTS.find((b) => b.name === "Mira") ?? author;
      reply = "I'm free if you need a body in the Reliquary. I only complain a little.";
    } else if (lower.includes("wisp") || lower.includes("gloam")) {
      author = BOTS.find((b) => b.name === "Wren") ?? author;
      reply = "the wisps hum before they strike. hit them between notes.";
    } else if (lower.includes("wolf")) {
      author = BOTS.find((b) => b.name === "Kestrel") ?? author;
      reply = "silver-ear is the mean one. he circles left.";
    } else if (lower.includes("hi") || lower.includes("hello") || lower.includes("hey")) {
      author = BOTS.find((b) => b.name === "Ashwyn") ?? author;
      reply = "well met. the fire's free, the advice is mostly free.";
    } else if (lower.includes("help") || lower.includes("how")) {
      author = BOTS.find((b) => b.name === "Thorne") ?? author;
      reply = "WASD to move, Tab to pick a target, 1–3 to fight. E for anything with a marker.";
    }
    this.scheduleChat(randomRange(1.8, 3.4), "world", author.name, reply, CLASSES[author.classId].color);
  }

  private tryEnterDungeon(): void {
    const quest = QUESTS.find((q) => q.id === "sunken_choir");
    if (!quest) return;
    const state = this.player.quests[quest.id];
    if (!state || state.status === "locked" || state.status === "available") {
      this.events.toast("The seal is cold", "Speak with Orin Vale before descending.", "system");
      this.events.sound("error");
      return;
    }
    if (state.status === "ready" || state.status === "done" || this.player.dungeonCleared) {
      this.events.toast("The Reliquary is silent", "The hymn has already ended.", "system");
      return;
    }
    this.enterDungeon();
  }

  private enterDungeon(): void {
    this.scene = "dungeon";
    this.zoneKey = "dungeon";
    this.player.x = DUNGEON_ENTRY.x;
    this.player.y = DUNGEON_ENTRY.y;
    this.player.moveTarget = null;
    this.player.targetId = null;
    this.pendingAbility = null;
    this.mobs = [
      this.makeMob("reliquary_sentinel", 790, 760),
      this.makeMob("reliquary_sentinel", 915, 620),
      this.makeMob("drowned_acolyte", 615, 645),
      this.makeMob("drowned_acolyte", 730, 480),
      this.makeMob("drowned_acolyte", 880, 480),
    ];
    this.allies = [
      this.makeAlly("Mira", "arcanist", this.player.level, this.player.x - 72, this.player.y - 30),
      this.makeAlly("Thorne", "vanguard", this.player.level, this.player.x + 68, this.player.y - 16),
    ];
    this.npcs = [
      {
        id: "npc_dungeon_gate",
        name: "Reliquary Gate",
        title: "The way back",
        role: "portal",
        x: DUNGEON_ENTRY.x,
        y: DUNGEON_ENTRY.y + 118,
        facing: Math.PI,
        color: "#9be0d6",
        questIds: [],
        line: "A doorway stitched from cold light.",
        emote: "waits",
      },
    ];
    this.dungeon = {
      stage: 1,
      started: true,
      bossSpawned: false,
      cleared: false,
      introTimer: 4,
      pulseWarning: 0,
    };
    this.combatTimer = 0;
    this.particles = [];
    this.floaters = [];
    this.player.shield = 0;
    this.player.buffs = [];
    this.setAreaTitle("The Sunken Reliquary", "Something below is still singing");
    this.events.toast("The Sunken Reliquary", "Thorne and Mira have joined your party.", "quest");
    this.events.flash("rgba(120,225,210,0.18)", 0.45);
    this.events.shake(2);
    this.events.sound("portal");
    this.addChat("party", "Thorne", "Stay behind me. The floor remembers footsteps.", CLASSES.vanguard.color);
    this.scheduleChat(1.2, "party", "Mira", "The hymn is below us. It knows we're here.", CLASSES.arcanist.color);
    this.scheduleChat(3.1, "system", "", "Party formed: Thorne (Vanguard), Mira (Arcanist).", CHANNEL_COLORS.system);
  }

  private makeAlly(name: string, classId: ClassId, level: number, x: number, y: number): Ally {
    const def = CLASSES[classId];
    return {
      id: `ally_${++this.uidCounter}`,
      name,
      classId,
      x,
      y,
      hp: classId === "vanguard" ? 280 + level * 12 : 170 + level * 8,
      maxHp: classId === "vanguard" ? 280 + level * 12 : 170 + level * 8,
      alive: true,
      downedTimer: 0,
      targetId: null,
      attackTimer: randomRange(0.2, 1),
      pulseTimer: 0,
      speed: 205,
      range: classId === "vanguard" ? 82 : 260,
      damage: classId === "vanguard" ? 16 + level * 2 : 14 + level * 2,
      facing: 0,
      walkPhase: 0,
      moving: false,
      color: def.color,
    };
  }

  private checkDungeonStage(): void {
    if (this.scene !== "dungeon" || this.dungeon.bossSpawned || this.dungeon.cleared) return;
    const livingMinions = this.mobs.filter((mob) => mob.alive && !mob.boss);
    if (livingMinions.length > 0) return;
    this.dungeon.bossSpawned = true;
    this.dungeon.stage = 2;
    const boss = this.makeMob("choir", 760, 300);
    boss.targetId = "player";
    this.mobs.push(boss);
    this.events.toast("Nhal'Vareth, the Sunken Choir", "The hymn takes shape.", "danger");
    this.events.sound("boss");
    this.events.shake(3);
    this.events.flash("rgba(120,240,220,0.12)", 0.4);
    this.spawnRing(760, 300, "#c4fff3", 180, 1.2);
    this.addChat("party", "Thorne", "Something's coming. Together, now.", CLASSES.vanguard.color);
    this.scheduleChat(1.4, "party", "Mira", "The hymn— it knows my name.", CLASSES.arcanist.color);
  }

  private completeDungeon(): void {
    this.dungeon.cleared = true;
    this.dungeon.stage = 3;
    this.player.dungeonCleared = true;
    this.events.toast("The hymn ends", "Return to Orin Vale at Wayfarer's Rest.", "gold");
    this.events.sound("victory");
    this.events.flash("rgba(255,230,170,0.2)", 0.6);
    this.events.shake(4);
    this.spawnRing(this.player.x, this.player.y, "#ffe6aa", 150, 1.2);
    this.spawnBurst(this.player.x, this.player.y, "#ffe3a1", 40, 180, "levelup");
    this.addChat("system", "", "The Sunken Choir has been silenced.", "#e7c97e");
    this.scheduleChat(1.6, "party", "Mira", "The water's gone quiet. I didn't know I missed quiet.", CLASSES.arcanist.color);
    this.scheduleChat(2.8, "party", "Thorne", "Take the moment. Then we go home.", CLASSES.vanguard.color);
    this.scheduleChat(4.6, "system", "", "The way out opens behind you.", CHANNEL_COLORS.system);
  }

  private leaveDungeon(respawn: boolean): void {
    this.scene = "world";
    this.zoneKey = "ruins";
    this.mobs = this.createWorldMobs();
    this.allies = [];
    this.npcs = NPCS.map((npc) => ({ ...npc, questIds: [...npc.questIds] }));
    this.player.x = PORTAL_POS.x;
    this.player.y = PORTAL_POS.y + 54;
    this.player.moveTarget = null;
    this.player.targetId = null;
    this.player.buffs = [];
    this.player.shield = 0;
    this.combatTimer = 0;
    this.dungeon = {
      stage: 0,
      started: false,
      bossSpawned: false,
      cleared: false,
      introTimer: 0,
      pulseWarning: 0,
    };
    this.particles = [];
    this.floaters = [];
    if (!respawn) {
      this.setAreaTitle("Ashen Verge", "The hymn fades behind you");
      this.events.toast("You leave the Reliquary", "Orin Vale waits back at camp.", "system");
      this.events.sound("portal");
      this.addChat("system", "", "You return to the Ashen Verge.", CHANNEL_COLORS.system);
    }
  }

  private updateRift(dt: number): void {
    if (this.rift.active) {
      this.rift.timer -= dt;
      if (this.rift.timer <= 0) {
        this.endRift(false);
      }
      return;
    }
    this.rift.timer -= dt;
    if (this.rift.timer > 0) return;
    const points = [
      { x: 1710, y: 1180, zone: "The Verdant Reach" },
      { x: 2470, y: 1120, zone: "Gloamwood" },
      { x: 1670, y: 1860, zone: "Ashen Verge" },
    ];
    const point = randomItem(points);
    const mob = this.makeMob("riftwraith", point.x, point.y);
    this.mobs.push(mob);
    this.rift = {
      active: true,
      x: point.x,
      y: point.y,
      timer: 125,
      mobId: mob.id,
      announced: true,
      number: this.rift.number + 1,
    };
    this.events.toast("A rift tears open", `A Riftwraith has appeared in ${point.zone}.`, "danger");
    this.events.sound("rift");
    this.addChat("system", "", `A rift has opened in ${point.zone}. Something is coming through.`, "#d1a5ff");
    this.scheduleChat(2.4, "world", "Rook", "that's a riftwraith. do not engage it alone.", CLASSES.vanguard.color);
  }

  private endRift(killed: boolean): void {
    if (killed && this.rift.mobId) {
      const mob = this.mobs.find((m) => m.id === this.rift.mobId);
      if (mob) this.spawnRing(mob.x, mob.y, "#c79bff", 130, 1);
      this.events.toast("The rift collapses", "The Riftwraith is undone.", "gold");
      this.addChat("system", "", "The rift collapses. The air tastes like rain.", "#c8a6ff");
    } else {
      this.events.toast("The rift closes", "The Riftwraith slipped back into the dark.", "system");
    }
    this.rift = {
      ...this.rift,
      active: false,
      timer: randomRange(165, 215),
      mobId: null,
      announced: false,
    };
    this.mobs = this.mobs.filter((mob) => mob.templateId !== "riftwraith");
  }

  private checkZone(): void {
    if (this.scene !== "world") return;
    let next: ZoneKey;
    if (dist(this.player, HUB) < 345) {
      next = "hub";
    } else if (this.player.x > 2030 && this.player.y < 1470) {
      next = "gloam";
    } else if (this.player.y > 1560) {
      next = "ruins";
    } else {
      next = "reach";
    }
    if (next === this.zoneKey) return;
    this.zoneKey = next;
    const zone = ZONES[next];
    this.setAreaTitle(zone.name, zone.sub);
    this.addChat("system", "", `Entering ${zone.name}.`, CHANNEL_COLORS.system);
  }

  private updateChatSim(dt: number): void {
    for (const pending of [...this.pendingChat]) {
      pending.timer -= dt;
      if (pending.timer <= 0) {
        this.addChat(pending.channel, pending.author, pending.text, pending.color);
        this.pendingChat = this.pendingChat.filter((p) => p !== pending);
      }
    }
    if (this.mode === "title") return;
    this.chatTimer -= dt;
    if (this.chatTimer > 0) return;
    this.chatTimer = randomRange(9, 17);
    if (Math.random() < 0.16) {
      this.addChat("system", "", randomItem(SYSTEM_LINES), CHANNEL_COLORS.system);
      return;
    }
    const bot = randomItem(BOTS);
    this.addChat("world", bot.name, randomItem(WORLD_CHAT), CLASSES[bot.classId].color);
  }

  private scheduleChat(
    delay: number,
    channel: ChatChannel,
    author: string,
    text: string,
    color?: string,
  ): void {
    this.pendingChat.push({ timer: delay, channel, author, text, color });
  }

  private addChat(channel: ChatChannel, author: string, text: string, color?: string): void {
    const message: ChatMessage = {
      id: ++this.chatCounter,
      channel,
      author,
      text,
      color: color ?? CHANNEL_COLORS[channel],
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    };
    this.chat.push(message);
    if (this.chat.length > 90) this.chat = this.chat.slice(-90);
  }

  private updateOnline(dt: number): void {
    this.onlineTimer -= dt;
    if (this.onlineTimer > 0) return;
    this.onlineTimer = randomRange(3, 7);
    this.online = clamp(this.online + Math.round(randomRange(-8, 9)), 1080, 1480);
  }

  private updateAmbient(dt: number): void {
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    this.ambientTimer = 0.22;
    if (this.particles.length > 280) return;
    if (this.rift.active) {
      this.addParticle(
        this.rift.x + randomRange(-80, 80),
        this.rift.y + randomRange(-80, 80),
        randomRange(-8, 8),
        randomRange(-28, -8),
        randomRange(0.7, 1.8),
        randomRange(1, 3),
        "#b98cff",
        "firefly",
      );
    }
    if (this.scene === "world") {
      if (this.zoneKey === "hub" || this.mode === "title") {
        this.addParticle(
          HUB.x - 25 + randomRange(-22, 22),
          HUB.y + 20 + randomRange(-14, 14),
          randomRange(-6, 6),
          randomRange(-34, -12),
          randomRange(0.7, 1.6),
          randomRange(1, 2.7),
          Math.random() < 0.7 ? "#ffbc6b" : "#ffe0a6",
          "firefly",
        );
      }
      if (this.zoneKey === "gloam") {
        this.addParticle(
          this.player.x + randomRange(-420, 420),
          this.player.y + randomRange(-320, 320),
          randomRange(-6, 6),
          randomRange(-10, 4),
          randomRange(1.4, 3.2),
          randomRange(1, 2.6),
          Math.random() < 0.65 ? "#7ff0d9" : "#d2fff4",
          "firefly",
        );
      } else if (this.zoneKey === "ruins") {
        this.addParticle(
          this.player.x + randomRange(-360, 360),
          this.player.y + randomRange(-260, 260),
          randomRange(-4, 4),
          randomRange(-10, -2),
          randomRange(1.2, 2.8),
          1,
          "#b8ad96",
          "dust",
        );
      } else if (Math.random() < 0.28) {
        this.addParticle(
          this.player.x + randomRange(-320, 320),
          this.player.y + randomRange(-260, 260),
          randomRange(-12, 12),
          randomRange(6, 18),
          randomRange(1.5, 3),
          randomRange(1, 2.5),
          "#c4b56f",
          "firefly",
        );
      }
    } else {
      this.addParticle(
        this.player.x + randomRange(-330, 330),
        this.player.y + randomRange(-260, 260),
        randomRange(-4, 4),
        randomRange(-12, -2),
        randomRange(1.3, 3),
        1.2,
        "#9ecbc2",
        "dust",
      );
    }
  }

  private addParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    color: string,
    kind: ParticleKind,
    rotation = 0,
    gravity = 0,
  ): void {
    this.particles.push({
      x,
      y,
      vx,
      vy,
      life,
      maxLife: life,
      size,
      color,
      kind,
      rotation,
      gravity,
    });
  }

  private updateParticles(dt: number): void {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += particle.gravity * dt;
      particle.vx *= 0.985;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private spawnBurst(
    x: number,
    y: number,
    color: string,
    count: number,
    speed: number,
    kind: ParticleKind,
  ): void {
    if (this.particles.length > 380) return;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * TAU;
      const velocity = randomRange(speed * 0.25, speed);
      this.addParticle(
        x + randomRange(-4, 4),
        y + randomRange(-5, 5),
        Math.cos(angle) * velocity,
        Math.sin(angle) * velocity * 0.6,
        randomRange(0.25, 0.7),
        randomRange(1.2, 3.6),
        color,
        kind,
        angle,
        kind === "heal" ? -20 : 70,
      );
    }
  }

  private spawnRing(x: number, y: number, color: string, size: number, life: number): void {
    this.addParticle(x, y, 0, 0, life, size, color, "ring");
  }

  private spawnBeam(x1: number, y1: number, x2: number, y2: number, color: string): void {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const length = Math.hypot(x2 - x1, y2 - y1);
    this.addParticle(
      x1,
      y1,
      0,
      0,
      0.18,
      length,
      color,
      "beam",
      angle,
    );
    for (let i = 0; i < 6; i += 1) {
      const t = Math.random();
      this.addParticle(
        x1 + (x2 - x1) * t + randomRange(-5, 5),
        y1 + (y2 - y1) * t + randomRange(-5, 5),
        randomRange(-16, 16),
        randomRange(-22, 8),
        randomRange(0.2, 0.45),
        randomRange(1, 2.8),
        color,
        "spark",
      );
    }
  }

  private spawnSlash(x: number, y: number, rotation: number, color: string): void {
    this.addParticle(x, y, 0, 0, 0.24, 46, color, "slash", rotation);
  }

  private addFloater(
    x: number,
    y: number,
    text: string,
    color: string,
    size: number,
    crit: boolean,
  ): void {
    this.floaters.push({
      x,
      y,
      text,
      color,
      life: crit ? 1.15 : 0.9,
      maxLife: crit ? 1.15 : 0.9,
      size,
      crit,
    });
  }

  private updateFloaters(dt: number): void {
    for (const floater of this.floaters) {
      floater.life -= dt;
      floater.y -= 30 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  getEquipped(slot: "weapon" | "armor" | "trinket"): ItemInstance | null {
    return this.player.equipment[slot] ?? null;
  }

  getInventory(): ItemInstance[] {
    return this.player.inventory;
  }

  getXpPercent(): number {
    return clamp(this.player.xp / this.player.xpNext, 0, 1);
  }
}
