export interface Vec {
  x: number;
  y: number;
}

export type ClassId = "vanguard" | "arcanist" | "wildkeeper";
export type Slot = "weapon" | "armor" | "trinket";
export type Rarity = "common" | "uncommon" | "rare" | "epic";
export type QuestStatus = "locked" | "available" | "active" | "ready" | "done";

export type AbilityKind =
  | "strike"
  | "aoe"
  | "execute"
  | "heal"
  | "shield"
  | "dash"
  | "root";

export interface AbilityDef {
  id: string;
  name: string;
  key: string;
  icon: string;
  color: string;
  color2: string;
  cooldown: number;
  cost: number;
  range: number;
  power: number;
  kind: AbilityKind;
  radius?: number;
  description: string;
  hint: string;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  epithet: string;
  role: string;
  color: string;
  color2: string;
  glow: string;
  resource: string;
  resourceMax: number;
  baseHp: number;
  baseArmor: number;
  basePower: number;
  attackRange: number;
  attackSpeed: number;
  description: string;
  fantasy: string;
  abilities: AbilityDef[];
}

export interface ItemDef {
  id: string;
  name: string;
  slot: Slot;
  rarity: Rarity;
  power?: number;
  armor?: number;
  hp?: number;
  value: number;
  icon: string;
  flavor: string;
}

export interface ItemInstance {
  uid: string;
  defId: string;
}

export interface QuestObjective {
  kind: "kill" | "boss";
  target: string;
  count: number;
  label: string;
}

export interface QuestReward {
  xp: number;
  gold: number;
  item?: string;
  potions?: number;
}

export interface QuestDef {
  id: string;
  title: string;
  giver: string;
  level: number;
  prereq?: string;
  summary: string;
  intro: string;
  progress: string;
  complete: string;
  objective: QuestObjective;
  reward: QuestReward;
  gearHint: string;
}

export interface QuestState {
  status: QuestStatus;
  progress: number;
}

export interface MobTemplate {
  id: string;
  name: string;
  level: number;
  hp: number;
  damage: number;
  xp: number;
  speed: number;
  range: number;
  aggro: number;
  radius: number;
  elite?: boolean;
  boss?: boolean;
  color: string;
  accent: string;
  loot?: string;
  lootChance?: number;
  scale?: number;
}

export interface Mob {
  id: string;
  name: string;
  templateId: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  radius: number;
  level: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  respawnTimer: number;
  state: "idle" | "wander" | "chase" | "attack" | "return" | "dead";
  targetId: string | null;
  wanderX: number;
  wanderY: number;
  wanderTimer: number;
  attackTimer: number;
  pulseTimer: number;
  speed: number;
  range: number;
  aggro: number;
  damage: number;
  xp: number;
  elite: boolean;
  boss: boolean;
  color: string;
  accent: string;
  facing: number;
  hitFlash: number;
  slowTimer: number;
  rootTimer: number;
  stunTimer: number;
  scale: number;
  enraged: boolean;
  summoned: boolean;
  pulseArmed: boolean;
}

export interface Bot {
  id: string;
  name: string;
  classId: ClassId;
  level: number;
  title: string;
  zone: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  wanderX: number;
  wanderY: number;
  wanderTimer: number;
  moving: boolean;
  facing: number;
  walkPhase: number;
  color: string;
}

export interface Ally {
  id: string;
  name: string;
  classId: ClassId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  downedTimer: number;
  targetId: string | null;
  attackTimer: number;
  pulseTimer: number;
  speed: number;
  range: number;
  damage: number;
  facing: number;
  walkPhase: number;
  moving: boolean;
  color: string;
}

export interface Npc {
  id: string;
  name: string;
  title: string;
  role: "quest" | "vendor" | "portal" | "flavor";
  x: number;
  y: number;
  facing: number;
  color: string;
  questIds: string[];
  line: string;
  emote: string;
}

export interface Buff {
  id: string;
  name: string;
  time: number;
  maxTime: number;
  color: string;
  icon: string;
}

export interface Player {
  name: string;
  classId: ClassId;
  x: number;
  y: number;
  facing: number;
  level: number;
  xp: number;
  xpNext: number;
  hp: number;
  maxHp: number;
  resource: number;
  maxResource: number;
  resourceName: string;
  armor: number;
  power: number;
  speed: number;
  radius: number;
  gold: number;
  potions: number;
  inventory: ItemInstance[];
  equipment: Partial<Record<Slot, ItemInstance>>;
  quests: Record<string, QuestState>;
  cooldowns: Record<string, number>;
  gcd: number;
  autoTimer: number;
  targetId: string | null;
  moving: boolean;
  walkPhase: number;
  dead: boolean;
  shield: number;
  buffs: Buff[];
  dungeonCleared: boolean;
  kills: number;
  deaths: number;
  playTime: number;
  moveTarget: Vec | null;
}

export type ParticleKind =
  | "spark"
  | "ring"
  | "slash"
  | "beam"
  | "heal"
  | "shadow"
  | "levelup"
  | "firefly"
  | "dust";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: ParticleKind;
  rotation: number;
  gravity: number;
}

export interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
  crit: boolean;
}

export type ChatChannel = "world" | "system" | "say" | "combat" | "loot" | "party";

export interface ChatMessage {
  id: number;
  channel: ChatChannel;
  author: string;
  text: string;
  color: string;
  time: string;
}

export interface WorldRift {
  active: boolean;
  x: number;
  y: number;
  timer: number;
  mobId: string | null;
  announced: boolean;
  number: number;
}

export interface DungeonState {
  stage: number;
  started: boolean;
  bossSpawned: boolean;
  cleared: boolean;
  introTimer: number;
  pulseWarning: number;
}

export interface GameSnapshot {
  mode: "title" | "playing" | "dead";
  scene: "world" | "dungeon";
  player: Player;
  mobs: Mob[];
  bots: Bot[];
  allies: Ally[];
  npcs: Npc[];
  particles: Particle[];
  floaters: Floater[];
  chat: ChatMessage[];
  zone: string;
  dungeon: DungeonState;
  rift: WorldRift;
  online: number;
  time: number;
  areaTitle: { text: string; sub: string; time: number };
}
