import { BOTS, CLASSES, ITEMS, QUESTS, VENDOR_STOCK, ZONES } from "./data";
import { EverwakeGame, rarityColor, WEATHER_META } from "./engine";
import { Renderer } from "./render";
import { AudioEngine } from "./audio";
import type { ClassId, ItemDef, QuestDef, QuestStatus } from "./types";

type PanelName = "character" | "vendor" | "map" | "social" | "quests" | "help" | "npc" | null;

const CLASS_GLYPHS: Record<ClassId, string> = {
  vanguard: "⚔",
  arcanist: "✦",
  wildkeeper: "❧",
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char] ?? char;
  });

const itemStatLine = (def: ItemDef): string => {
  const parts: string[] = [];
  if (def.power) parts.push(`+${def.power} Power`);
  if (def.armor) parts.push(`+${def.armor} Armor`);
  if (def.hp) parts.push(`+${def.hp} Health`);
  return parts.join(" · ") || "No bonuses";
};

const questStatusLabel = (status: QuestStatus): string => {
  switch (status) {
    case "active":
      return "In progress";
    case "ready":
      return "Ready to turn in";
    case "available":
      return "New thread";
    case "done":
      return "Completed";
    default:
      return "Locked";
  }
};

export class UI {
  private game: EverwakeGame;
  private renderer: Renderer;
  private audio = new AudioEngine();
  private root: HTMLElement;
  private titleScreen!: HTMLElement;
  private hud!: HTMLElement;
  private modalLayer!: HTMLElement;
  private toastLayer!: HTMLElement;
  private deathOverlay!: HTMLElement;
  private deathDetail!: HTMLElement;
  private lowHealth!: HTMLElement;
  private areaBanner!: HTMLElement;
  private areaTitleEl!: HTMLElement;
  private areaSubEl!: HTMLElement;
  private playerNameEl!: HTMLElement;
  private playerLevelEl!: HTMLElement;
  private playerClassEl!: HTMLElement;
  private portraitGlyph!: HTMLElement;
  private healthFill!: HTMLElement;
  private healthShield!: HTMLElement;
  private healthText!: HTMLElement;
  private resourceFill!: HTMLElement;
  private resourceText!: HTMLElement;
  private xpFill!: HTMLElement;
  private playerXpFill!: HTMLElement;
  private xpText!: HTMLElement;
  private playerFrame!: HTMLElement;
  private buffRow!: HTMLElement;
  private targetFrame!: HTMLElement;
  private targetName!: HTMLElement;
  private targetLevel!: HTMLElement;
  private targetHealthFill!: HTMLElement;
  private targetHealthText!: HTMLElement;
  private targetMeta!: HTMLElement;
  private zoneName!: HTMLElement;
  private zoneOnline!: HTMLElement;
  private zoneWeather!: HTMLElement;
  private lastWeatherSignature = "";
  private minimap!: HTMLCanvasElement;
  private minimapZone!: HTMLElement;
  private minimapRift!: HTMLElement;
  private questTracker!: HTMLElement;
  private actionBar!: HTMLElement;
  private actionSlots: HTMLElement[] = [];
  private interactPrompt!: HTMLElement;
  private interactLabel!: HTMLElement;
  private interactSub!: HTMLElement;
  private chatMessages!: HTMLElement;
  private chatInput!: HTMLInputElement;
  private chatPanel!: HTMLElement;
  private bossFrame!: HTMLElement;
  private bossName!: HTMLElement;
  private bossFill!: HTMLElement;
  private bossPercent!: HTMLElement;
  private controlHint!: HTMLElement;
  private nameInput!: HTMLInputElement;
  private titleOnline!: HTMLElement;
  private selectedClass: ClassId = "vanguard";
  private activeModal: PanelName = null;
  private selectedItemUid: string | null = null;
  private chatTab: "world" | "combat" = "world";
  private lastChatId = 0;
  private chatRenderedTab = "world";
  private lastMinimapUpdate = 0;
  private lastTitleUpdate = 0;
  private lastQuestSignature = "";
  private lastBuffSignature = "";
  private modalType = "";
  private soundButtons: HTMLButtonElement[] = [];

  constructor(game: EverwakeGame, renderer: Renderer, root: HTMLElement) {
    this.game = game;
    this.renderer = renderer;
    this.root = root;
    this.build();
    this.bindEvents();
    this.game.setEvents({
      toast: (title, detail, tone) => this.toast(title, detail, tone),
      sound: (name) => this.audio.play(name),
      shake: (strength) => this.renderer.shake(strength),
      flash: (color, alpha) => this.renderer.flash(color, alpha),
      openNpc: (id) => this.openNpc(id),
      openVendor: () => this.openVendor(),
    });
    this.selectClass("vanguard");
    // Browsers need one gesture before any sound; title-screen music waits on it.
    const unlockAudio = (): void => this.audio.unlock();
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
  }

  private build(): void {
    this.root.innerHTML = `
      <div class="title-screen" id="title-screen">
        <div class="title-shade"></div>
        <div class="title-inner">
          <header class="title-header">
            <div class="title-eyebrow"><span></span>A living-world roleplaying game<span></span></div>
            <h1 class="game-logo">EVERWAKE</h1>
            <p class="game-tagline">A world that keeps playing.</p>
            <p class="title-intro">The realm does not wait for heroes. It makes room for them.<br/>Every fire, rumour and small bravery continues while you are gone.</p>
          </header>

          <div class="character-creation">
            <div class="creation-heading">
              <span class="eyebrow">YOUR STORY BEGINS</span>
              <h2>Choose how the road remembers you.</h2>
            </div>
            <div class="class-grid" id="class-grid">
              ${Object.values(CLASSES)
                .map(
                  (def) => `
                <button type="button" class="class-card" data-class="${def.id}" style="--class-color:${def.color};--class-dark:${def.color2};--class-glow:${def.glow}">
                  <span class="class-card-wash"></span>
                  <span class="class-sigil">${CLASS_GLYPHS[def.id]}</span>
                  <span class="class-role">${def.role} · ${def.resource}</span>
                  <span class="class-name">${def.name}</span>
                  <span class="class-epithet">${def.epithet}</span>
                  <span class="class-description">${def.description}</span>
                  <span class="class-abilities">
                    ${def.abilities.map((ability) => `<span class="ability-pip" title="${ability.name}">${ability.icon}</span>`).join("")}
                  </span>
                  <span class="class-select-mark">Selected</span>
                </button>`,
                )
                .join("")}
            </div>

            <div class="creator-footer">
              <label class="name-field">
                <span>Wanderer's name</span>
                <input id="character-name" type="text" maxlength="18" placeholder="Aster" autocomplete="off" spellcheck="false" />
              </label>
              <button class="primary-button enter-button" id="enter-world">
                <span class="button-spark">✦</span> Enter Everwake
              </button>
            </div>
            <div class="title-foot">
              <span>Single-player MMO simulation</span>
              <i></i>
              <span><b id="title-online">1,284</b> adventurers online</span>
              <i></i>
              <span>No queue. No account. Just the road.</span>
            </div>
          </div>
        </div>
      </div>

      <div class="hud hidden" id="hud">
        <div class="hud-top-left">
          <div class="player-frame" id="player-frame">
            <div class="portrait-shell" id="portrait-shell">
              <span class="portrait-glyph" id="portrait-glyph">⚔</span>
              <span class="portrait-level" id="player-level">1</span>
            </div>
            <div class="player-vitals">
              <div class="player-heading">
                <span class="player-name" id="player-name">Aster</span>
                <span class="player-class" id="player-class">Vanguard</span>
              </div>
              <div class="bar health-bar">
                <div class="bar-fill" id="health-fill"></div>
                <div class="bar-shield" id="health-shield"></div>
                <span class="bar-text" id="health-text">185 / 185</span>
                <span class="bar-icon">♥</span>
              </div>
              <div class="bar resource-bar">
                <div class="bar-fill" id="resource-fill"></div>
                <span class="bar-text" id="resource-text">25 / 100 Fervor</span>
                <span class="bar-icon">✦</span>
              </div>
              <div class="xp-line"><span id="xp-fill"></span></div>
            </div>
            <span class="frame-corner tl"></span><span class="frame-corner tr"></span><span class="frame-corner bl"></span><span class="frame-corner br"></span>
          </div>
          <div class="target-frame hidden" id="target-frame">
            <div class="target-ring">◎</div>
            <div class="target-body">
              <div class="target-head"><span id="target-name">Target</span><span class="target-level" id="target-level">Lv 2</span></div>
              <div class="bar target-health"><div class="bar-fill" id="target-health-fill"></div><span class="bar-text" id="target-health-text"></span></div>
              <div class="target-meta" id="target-meta">Hostile</div>
            </div>
          </div>
          <div class="buff-row" id="buff-row"></div>
        </div>

        <div class="top-center">
          <div class="world-line"><span class="live-dot"></span> EVERWAKE <i></i> <span id="online-count">1,284 ONLINE</span></div>
          <div class="zone-line">
            <span class="zone-rule"></span>
            <span id="zone-name">Wayfarer's Rest</span>
            <span class="zone-rule"></span>
          </div>
          <div class="zone-weather hidden" id="zone-weather"></div>
        </div>

        <div class="minimap-cluster">
          <button class="minimap-shell" id="minimap-button" title="Open world map (M)">
            <canvas id="minimap" width="220" height="220"></canvas>
            <span class="minimap-compass">N</span>
            <span class="minimap-frame-corner tl"></span><span class="minimap-frame-corner tr"></span><span class="minimap-frame-corner bl"></span><span class="minimap-frame-corner br"></span>
          </button>
          <div class="minimap-caption">
            <span class="minimap-zone" id="minimap-zone">Wayfarer's Rest</span>
            <span class="rift-indicator hidden" id="rift-indicator">RIFT OPEN</span>
          </div>
        </div>

        <aside class="quest-tracker" id="quest-tracker"></aside>

        <div class="boss-frame hidden" id="boss-frame">
          <div class="boss-head"><span class="boss-skull">✦</span><span id="boss-name">Nhal'Vareth</span><span class="boss-tag">THE SUNKEN CHOIR</span></div>
          <div class="boss-health"><div id="boss-fill"></div><span id="boss-percent">100%</span></div>
        </div>

        <div class="area-banner" id="area-banner">
          <span class="area-ornament"></span>
          <h2 id="area-title"></h2>
          <p id="area-sub"></p>
        </div>

        <div class="chat-panel" id="chat-panel">
          <div class="chat-head">
            <div class="chat-tabs">
              <button class="chat-tab active" data-chat-tab="world">World</button>
              <button class="chat-tab" data-chat-tab="combat">Combat</button>
            </div>
            <span class="chat-channel-mark">A living realm</span>
            <button class="chat-collapse" id="chat-collapse" title="Collapse chat">−</button>
          </div>
          <div class="chat-messages" id="chat-messages"></div>
          <form class="chat-input-row" id="chat-form">
            <span class="chat-prompt">›</span>
            <input id="chat-input" type="text" maxlength="180" autocomplete="off" spellcheck="false" placeholder="Speak to the realm..." />
            <span class="chat-key">Enter</span>
          </form>
        </div>

        <div class="interact-prompt hidden" id="interact-prompt">
          <span class="keycap">E</span>
          <span class="interact-copy"><b id="interact-label">Speak with Maelin</b><small id="interact-sub">Dawnwatch Captain</small></span>
        </div>

        <div class="action-dock">
          <div class="menu-row">
            <button class="menu-button" data-panel="character" title="Character & satchel (C)"><span>◈</span><small>C</small></button>
            <button class="menu-button" data-panel="quests" title="Quest journal (L)"><span>✎</span><small>L</small></button>
            <button class="menu-button" data-panel="map" title="World map (M)"><span>◉</span><small>M</small></button>
            <button class="menu-button" data-panel="social" title="Who is online (O)"><span>☍</span><small>O</small></button>
            <button class="menu-button" data-panel="help" title="Field guide (H)"><span>?</span><small>H</small></button>
            <button class="menu-button sound-button" id="sound-button" title="Toggle sound"><span>♪</span><small>Sound</small></button>
          </div>
          <div class="action-bar" id="action-bar"></div>
          <div class="xp-track"><div class="xp-track-fill" id="xp-track-fill"></div><span id="xp-track-text">0 / 70 XP TO LEVEL 2</span></div>
          <div class="action-caption"><span>WASD</span> move <i></i> <span>Tab</span> target <i></i> <span>1–4</span> abilities</div>
        </div>

        <div class="control-hint" id="control-hint">
          <span><b>WASD</b> to move</span><span><b>Click</b> or <b>Tab</b> to target</span><span><b>1–3</b> to fight</span><span><b>E</b> to interact</span>
          <button id="dismiss-hint">Got it</button>
        </div>
      </div>

      <div class="death-overlay hidden" id="death-overlay">
        <div class="death-fog"></div>
        <div class="death-panel">
          <span class="death-mark">†</span>
          <p class="eyebrow">THE ROAD CONTINUES</p>
          <h2>You have fallen.</h2>
          <p class="death-line" id="death-detail">The world keeps playing.</p>
          <div class="death-rule"><span></span><i></i><span></span></div>
          <button class="primary-button" id="release-spirit">Release spirit</button>
          <small>Return to the last warm fire. Nothing is lost but time.</small>
        </div>
      </div>

      <div class="modal-layer hidden" id="modal-layer"></div>
      <div class="toast-layer" id="toast-layer"></div>
      <div class="low-health-vignette" id="low-health-vignette"></div>
    `;

    this.titleScreen = this.require("title-screen");
    this.hud = this.require("hud");
    this.modalLayer = this.require("modal-layer");
    this.toastLayer = this.require("toast-layer");
    this.deathOverlay = this.require("death-overlay");
    this.deathDetail = this.require("death-detail");
    this.lowHealth = this.require("low-health-vignette");
    this.areaBanner = this.require("area-banner");
    this.areaTitleEl = this.require("area-title");
    this.areaSubEl = this.require("area-sub");
    this.playerNameEl = this.require("player-name");
    this.playerLevelEl = this.require("player-level");
    this.playerClassEl = this.require("player-class");
    this.portraitGlyph = this.require("portrait-glyph");
    this.healthFill = this.require("health-fill");
    this.healthShield = this.require("health-shield");
    this.healthText = this.require("health-text");
    this.resourceFill = this.require("resource-fill");
    this.resourceText = this.require("resource-text");
    this.playerXpFill = this.require("xp-fill");
    this.xpText = this.require("xp-track-text");
    this.playerFrame = this.require("player-frame");
    this.buffRow = this.require("buff-row");
    this.targetFrame = this.require("target-frame");
    this.targetName = this.require("target-name");
    this.targetLevel = this.require("target-level");
    this.targetHealthFill = this.require("target-health-fill");
    this.targetHealthText = this.require("target-health-text");
    this.targetMeta = this.require("target-meta");
    this.zoneName = this.require("zone-name");
    this.zoneOnline = this.require("online-count");
    this.zoneWeather = this.require("zone-weather");
    this.minimap = this.require("minimap");
    this.minimapZone = this.require("minimap-zone");
    this.minimapRift = this.require("rift-indicator");
    this.questTracker = this.require("quest-tracker");
    this.actionBar = this.require("action-bar");
    this.interactPrompt = this.require("interact-prompt");
    this.interactLabel = this.require("interact-label");
    this.interactSub = this.require("interact-sub");
    this.chatMessages = this.require("chat-messages");
    this.chatInput = this.require("chat-input");
    this.chatPanel = this.require("chat-panel");
    this.bossFrame = this.require("boss-frame");
    this.bossName = this.require("boss-name");
    this.bossFill = this.require("boss-fill");
    this.bossPercent = this.require("boss-percent");
    this.controlHint = this.require("control-hint");
    this.nameInput = this.require("character-name");
    this.titleOnline = this.require("title-online");
    this.soundButtons = [...this.root.querySelectorAll<HTMLButtonElement>(".sound-button")];
    this.xpFill = this.require("xp-track-fill");

    this.renderActionBar();
  }

  private require<T extends HTMLElement = HTMLElement>(id: string): T {
    const element = this.root.querySelector<T>(`#${id}`);
    if (!element) throw new Error(`Missing UI element #${id}`);
    return element;
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLButtonElement>(".class-card").forEach((card) => {
      card.addEventListener("click", () => {
        const classId = card.dataset.class as ClassId | undefined;
        if (classId && CLASSES[classId]) this.selectClass(classId);
        this.audio.play("ui");
      });
    });

    const enterButton = this.require<HTMLButtonElement>("enter-world");
    enterButton.addEventListener("click", () => this.startGame());
    this.nameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.startGame();
      }
      event.stopPropagation();
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-panel]").forEach((button) => {
      button.addEventListener("click", () => {
        const panel = button.dataset.panel as PanelName;
        if (panel) this.openPanel(panel);
        this.audio.play("ui");
      });
    });

    this.require("minimap-button").addEventListener("click", () => {
      this.openPanel("map");
      this.audio.play("ui");
    });

    this.root.querySelectorAll<HTMLButtonElement>(".chat-tab").forEach((button) => {
      button.addEventListener("click", () => {
        const tab = button.dataset.chatTab;
        if (tab === "world" || tab === "combat") {
          this.chatTab = tab;
          this.root.querySelectorAll(".chat-tab").forEach((el) => el.classList.toggle("active", el === button));
          this.renderChat(true);
          this.audio.play("ui");
        }
      });
    });

    this.require("chat-collapse").addEventListener("click", () => {
      this.chatPanel.classList.toggle("collapsed");
      const button = this.require("chat-collapse");
      button.textContent = this.chatPanel.classList.contains("collapsed") ? "+" : "−";
    });

    this.require<HTMLFormElement>("chat-form").addEventListener("submit", (event) => {
      event.preventDefault();
      this.sendChat();
    });
    this.chatInput.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        this.chatInput.blur();
      }
    });

    this.require("dismiss-hint").addEventListener("click", () => {
      this.controlHint.classList.add("dismissed");
    });
    window.setTimeout(() => this.controlHint.classList.add("dismissed"), 22000);

    this.require("release-spirit").addEventListener("click", () => {
      this.game.releaseSpirit();
      this.deathOverlay.classList.add("hidden");
      this.audio.play("respawn");
    });

    this.root.querySelectorAll<HTMLButtonElement>(".sound-button").forEach((button) => {
      button.addEventListener("click", () => {
        const enabled = this.audio.toggle();
        this.soundButtons.forEach((soundButton) => {
          soundButton.classList.toggle("muted", !enabled);
        });
        this.toast(enabled ? "Sound on" : "Sound muted", enabled ? "The realm finds its voice." : undefined, "system");
      });
    });

    this.modalLayer.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-close]") || target.classList.contains("modal-backdrop")) {
        this.closeModal();
        return;
      }
      const questAction = target.closest<HTMLElement>("[data-quest-action]");
      if (questAction) {
        const action = questAction.dataset.questAction;
        const questId = questAction.dataset.questId;
        if (questId && action === "accept") {
          this.game.acceptQuest(questId);
          this.closeModal();
        } else if (questId && action === "complete") {
          this.game.completeQuest(questId);
          this.closeModal();
        } else if (questId && action === "journal") {
          this.openPanel("quests");
        }
        return;
      }
      const itemSelect = target.closest<HTMLElement>("[data-item-select]");
      if (itemSelect) {
        this.selectedItemUid = itemSelect.dataset.itemSelect ?? null;
        this.openCharacter();
        return;
      }
      const itemAction = target.closest<HTMLElement>("[data-item-action]");
      if (itemAction) {
        const uid = itemAction.dataset.itemUid;
        if (uid && itemAction.dataset.itemAction === "equip") {
          this.game.equipItem(uid);
          this.selectedItemUid = null;
          this.openCharacter();
        } else if (uid && itemAction.dataset.itemAction === "sell") {
          this.game.sellItem(uid);
          this.selectedItemUid = null;
          this.openCharacter();
        }
        return;
      }
      const buy = target.closest<HTMLElement>("[data-vendor-buy]");
      if (buy?.dataset.vendorBuy) {
        this.game.buyItem(buy.dataset.vendorBuy);
        this.openVendor(true);
        return;
      }
      const sell = target.closest<HTMLElement>("[data-vendor-sell]");
      if (sell?.dataset.vendorSell) {
        this.game.sellItem(sell.dataset.vendorSell);
        this.openVendor(true);
        return;
      }
      const panelLink = target.closest<HTMLElement>("[data-panel-link]");
      if (panelLink?.dataset.panelLink) {
        this.openPanel(panelLink.dataset.panelLink as PanelName);
      }
    });
  }

  private selectClass(classId: ClassId): void {
    this.selectedClass = classId;
    this.root.querySelectorAll<HTMLElement>(".class-card").forEach((card) => {
      card.classList.toggle("selected", card.dataset.class === classId);
    });
    const def = CLASSES[classId];
    const glyph = this.root.querySelector<HTMLElement>(".portrait-glyph");
    if (glyph) glyph.textContent = CLASS_GLYPHS[classId];
    document.documentElement.style.setProperty("--selected-class", def.color);
  }

  private startGame(): void {
    const name = this.nameInput.value.trim() || "Aster";
    this.game.start(name, this.selectedClass);
    this.audio.unlock();
    this.audio.play("start");
    document.body.classList.remove("title-mode");
    document.body.classList.add("playing");
    this.titleScreen.classList.add("hidden");
    this.hud.classList.remove("hidden");
    this.activeModal = null;
    this.modalLayer.classList.add("hidden");
    this.modalLayer.innerHTML = "";
    this.selectedItemUid = null;
    this.chatTab = "world";
    this.chatRenderedTab = "world";
    this.lastChatId = 0;
    this.chatMessages.innerHTML = "";
    this.renderActionBar();
    this.renderChat(true);
    this.lastMinimapUpdate = 0;
    this.controlHint.classList.remove("dismissed");
    window.setTimeout(() => this.controlHint.classList.add("dismissed"), 22000);
    this.renderer.drawMinimap(this.minimap);
  }

  isModalOpen(): boolean {
    return this.activeModal !== null;
  }

  isTextInputFocused(): boolean {
    const active = document.activeElement;
    return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
  }

  focusChat(): void {
    if (!this.game.player.dead) {
      this.chatInput.focus();
    }
  }

  openShortcut(panel: "character" | "quests" | "map" | "social" | "help"): void {
    this.openPanel(panel);
  }

  closeModal(): void {
    if (!this.activeModal) return;
    this.activeModal = null;
    this.modalLayer.classList.add("hidden");
    this.modalLayer.innerHTML = "";
    this.audio.play("ui");
  }

  private toast(title: string, detail?: string, tone: "gold" | "danger" | "quest" | "loot" | "system" = "system"): void {
    while (this.toastLayer.children.length >= 4) {
      this.toastLayer.firstElementChild?.remove();
    }
    const node = document.createElement("div");
    node.className = `toast toast-${tone}`;
    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.textContent = tone === "quest" ? "!" : tone === "loot" ? "✦" : tone === "danger" ? "!" : tone === "gold" ? "✧" : "·";
    const copy = document.createElement("div");
    copy.className = "toast-copy";
    const heading = document.createElement("b");
    heading.textContent = title;
    copy.appendChild(heading);
    if (detail) {
      const small = document.createElement("span");
      small.textContent = detail;
      copy.appendChild(small);
    }
    node.append(icon, copy);
    this.toastLayer.prepend(node);
    requestAnimationFrame(() => node.classList.add("show"));
    window.setTimeout(() => {
      node.classList.add("leaving");
      window.setTimeout(() => node.remove(), 340);
    }, 4200);
  }

  update(dt: number): void {
    this.lastMinimapUpdate += dt;
    this.audio.setZone(this.game.mode === "title" ? "title" : this.game.zoneKey);
    if (this.game.mode === "title") {
      this.lastTitleUpdate += dt;
      if (this.lastTitleUpdate > 0.8) {
        this.lastTitleUpdate = 0;
        this.titleOnline.textContent = this.game.online.toLocaleString();
      }
    }

    if (this.game.mode !== "title") {
      this.updateHUD();
      this.renderChat(false);
    }

    if (this.activeModal === "vendor" || this.activeModal === "map") {
      // Panels read live state but the world is paused underneath them.
      if (this.activeModal === "map" && this.lastMinimapUpdate > 0.15) {
        const canvas = this.modalLayer.querySelector<HTMLCanvasElement>("#world-map-canvas");
        if (canvas) this.renderer.drawWorldMap(canvas);
      }
    }

    if (this.game.mode === "dead") {
      if (this.deathOverlay.classList.contains("hidden")) {
        this.deathDetail.textContent = `${this.game.player.name} · Level ${this.game.player.level} · ${this.game.player.kills} foes bested. The world keeps playing.`;
        this.deathOverlay.classList.remove("hidden");
        this.audio.play("death");
      }
    } else if (!this.deathOverlay.classList.contains("hidden")) {
      this.deathOverlay.classList.add("hidden");
    }
  }

  private updateHUD(): void {
    const player = this.game.player;
    const def = CLASSES[player.classId];
    const healthRatio = Math.max(0, Math.min(1, player.hp / player.maxHp));
    const resourceRatio = Math.max(0, Math.min(1, player.resource / player.maxResource));
    const xpRatio = this.game.getXpPercent();
    const score = player.level;

    this.playerNameEl.textContent = player.name;
    this.playerLevelEl.textContent = String(player.level);
    this.playerClassEl.textContent = def.name;
    this.portraitGlyph.textContent = CLASS_GLYPHS[player.classId];
    this.healthFill.style.width = `${healthRatio * 100}%`;
    this.healthText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
    this.healthShield.style.width = `${Math.min(100, (player.shield / player.maxHp) * 100)}%`;
    this.resourceFill.style.width = `${resourceRatio * 100}%`;
    this.resourceText.textContent = `${Math.floor(player.resource)} / ${player.maxResource} ${player.resourceName}`;
    this.playerXpFill.style.width = `${xpRatio * 100}%`;
    this.xpFill.style.width = `${xpRatio * 100}%`;
    this.xpText.textContent = `${Math.floor(player.xp)} / ${player.xpNext} XP TO LEVEL ${player.level + 1}`;
    this.playerFrame.classList.toggle("in-combat", this.game.isInCombat());
    this.playerFrame.classList.toggle("low-health", healthRatio < 0.3);
    this.lowHealth.style.opacity = String(healthRatio < 0.3 ? (0.3 - healthRatio) * 2.2 : 0);
    this.zoneName.textContent = ZONES[this.game.zoneKey].name;
    this.zoneOnline.textContent = `${this.game.online.toLocaleString()} ONLINE`;

    const weather = this.game.weather;
    const dominant = weather.blend >= 0.5 ? weather.kind : weather.prev;
    const weatherSignature = dominant === "clear" ? "" : dominant;
    if (weatherSignature !== this.lastWeatherSignature) {
      this.lastWeatherSignature = weatherSignature;
      if (weatherSignature === "") {
        this.zoneWeather.classList.add("hidden");
        this.zoneWeather.removeAttribute("data-tone");
        this.zoneWeather.innerHTML = "";
      } else {
        const meta = WEATHER_META[dominant];
        this.zoneWeather.innerHTML = `<span class="weather-icon">${meta.icon}</span><span>${meta.label}</span>`;
        this.zoneWeather.dataset.tone = dominant;
        this.zoneWeather.classList.remove("hidden");
      }
    }

    const buffSignature = player.buffs.map((buff) => `${buff.id}:${Math.ceil(buff.time)}`).join("|");
    if (buffSignature !== this.lastBuffSignature) {
      this.lastBuffSignature = buffSignature;
      this.buffRow.innerHTML = player.buffs
        .map(
          (buff) => `
          <div class="buff" style="--buff-color:${buff.color}" title="${escapeHtml(buff.name)}">
            <span>${buff.icon}</span><small>${Math.max(0, Math.ceil(buff.time))}s</small>
          </div>`,
        )
        .join("");
    }

    const target = this.game.getTarget();
    if (target) {
      this.targetFrame.classList.remove("hidden");
      this.targetName.textContent = target.name;
      this.targetLevel.textContent = `LV ${target.level}${target.elite ? " · ELITE" : ""}`;
      this.targetHealthFill.style.width = `${Math.max(0, (target.hp / target.maxHp) * 100)}%`;
      this.targetHealthText.textContent = `${Math.ceil(target.hp)} / ${target.maxHp}`;
      const distance = Math.round(Math.hypot(target.x - player.x, target.y - player.y) / 10);
      this.targetMeta.textContent = `${target.boss ? "Boss" : target.elite ? "Elite" : "Hostile"} · ${distance}m`;
      this.targetFrame.classList.toggle("elite", target.elite);
    } else {
      this.targetFrame.classList.add("hidden");
    }

    const boss = this.game.scene === "dungeon" ? this.game.mobs.find((mob) => mob.boss && mob.alive) : undefined;
    if (boss) {
      this.bossFrame.classList.remove("hidden");
      this.bossName.textContent = boss.name;
      const bossRatio = Math.max(0, boss.hp / boss.maxHp);
      this.bossFill.style.width = `${bossRatio * 100}%`;
      this.bossPercent.textContent = `${Math.ceil(bossRatio * 100)}%`;
      this.bossFrame.classList.toggle("enraged", boss.enraged);
    } else {
      this.bossFrame.classList.add("hidden");
    }

    const interactable = this.game.getInteractable();
    if (interactable && !this.activeModal) {
      this.interactPrompt.classList.remove("hidden");
      this.interactLabel.textContent = interactable.label;
      this.interactSub.textContent = interactable.sub;
    } else {
      this.interactPrompt.classList.add("hidden");
    }

    this.minimapZone.textContent = ZONES[this.game.zoneKey].name;
    if (this.game.rift.active) {
      this.minimapRift.classList.remove("hidden");
    } else {
      this.minimapRift.classList.add("hidden");
    }

    const area = this.game.areaTitle;
    if (area.time > 0 && area.text) {
      if (this.areaTitleEl.textContent !== area.text) {
        this.areaTitleEl.textContent = area.text;
        this.areaSubEl.textContent = area.sub;
      }
      this.areaBanner.classList.add("visible");
      this.areaBanner.style.opacity = String(Math.min(1, area.time / 0.8));
    } else {
      this.areaBanner.classList.remove("visible");
    }

    const questSignature = QUESTS.map((quest) => {
      const state = player.quests[quest.id];
      return `${quest.id}:${state?.status}:${state?.progress}`;
    }).join("|");
    if (questSignature !== this.lastQuestSignature) {
      this.lastQuestSignature = questSignature;
      this.renderQuestTracker();
    }

    if (this.lastMinimapUpdate > 0.09) {
      this.lastMinimapUpdate = 0;
      this.renderer.drawMinimap(this.minimap);
      this.updateActionCooldowns();
      this.renderAreaInfo(score);
    }
  }

  private renderAreaInfo(score: number): void {
    const area = ZONES[this.game.zoneKey];
    this.minimapZone.title = `${area.name} · ${area.sub}`;
    this.zoneOnline.title = `${this.game.online.toLocaleString()} adventurers online · level ${score}`;
  }

  private renderQuestTracker(): void {
    const active = QUESTS.filter((quest) => {
      const state = this.game.player.quests[quest.id];
      return state && (state.status === "active" || state.status === "ready");
    });
    if (active.length === 0) {
      this.questTracker.innerHTML = `
        <div class="tracker-head"><span>THE ROAD AHEAD</span><i></i></div>
        <div class="tracker-empty">
          <span class="tracker-rune">!</span>
          <p>Seek the gold markers around Wayfarer's Rest.</p>
          <small>Captain Maelin waits by the fire.</small>
        </div>`;
      return;
    }
    this.questTracker.innerHTML = `
      <div class="tracker-head"><span>THE ROAD AHEAD</span><i></i></div>
      ${active
        .map((quest) => {
          const state = this.game.player.quests[quest.id];
          const progress = state?.progress ?? 0;
          const ready = state?.status === "ready";
          const giverName =
            quest.giver === "npc_maelin"
              ? "Maelin Voss"
              : quest.giver === "npc_ilyra"
                ? "Ilyra Venn"
                : quest.giver === "npc_orin"
                  ? "Orin Vale"
                  : "the quest giver";
          return `
            <div class="tracked-quest ${ready ? "ready" : ""}">
              <div class="tracked-title"><span>${escapeHtml(quest.title)}</span><em>LV ${quest.level}</em></div>
              <div class="tracked-objective">
                <span class="objective-dot"></span>
                ${escapeHtml(quest.objective.label)}
                <b>${Math.min(progress, quest.objective.count)}/${quest.objective.count}</b>
              </div>
              <div class="tracked-hint">${ready ? `Return to ${giverName}` : escapeHtml(quest.summary)}</div>
            </div>`;
        })
        .join("")}
    `;
  }

  private updateActionCooldowns(): void {
    const abilities = this.game.getAbilityList();
    this.actionSlots.forEach((slot, index) => {
      const ability = abilities[index];
      if (!ability) return;
      const cooldown = this.game.player.cooldowns[ability.id] ?? 0;
      const cdText = slot.querySelector<HTMLElement>(".slot-cdtext");
      const cdOverlay = slot.querySelector<HTMLElement>(".slot-cooldown");
      const ready = cooldown <= 0;
      slot.classList.toggle("cooling", !ready);
      if (cdText) cdText.textContent = ready ? "" : cooldown < 1 ? cooldown.toFixed(1) : String(Math.ceil(cooldown));
      if (cdOverlay) {
        const progress = ability.cooldown > 0 ? cooldown / ability.cooldown : 0;
        cdOverlay.style.setProperty("--sweep", String(Math.max(0, Math.min(1, progress))));
        cdOverlay.style.opacity = ready ? "0" : "1";
      }
      const insufficient = ability.id !== "potion" && this.game.player.resource < ability.cost;
      const emptyPotion = ability.id === "potion" && this.game.player.potions <= 0;
      slot.classList.toggle("unavailable", insufficient || emptyPotion);
      if (ability.id === "potion") {
        const count = slot.querySelector<HTMLElement>(".potion-count");
        if (count) count.textContent = String(this.game.player.potions);
      }
    });
  }

  private renderActionBar(): void {
    const abilities = this.game.getAbilityList();
    this.actionBar.innerHTML = abilities
      .map((ability, index) => {
        const cost =
          ability.id === "potion" ? "USE" : ability.cost > 0 ? String(ability.cost) : "—";
        return `
          <button class="action-slot" data-ability-index="${index}" style="--ability:${ability.color};--ability-dark:${ability.color2}">
            <span class="slot-key">${ability.key}</span>
            <span class="slot-icon">${ability.icon}</span>
            <span class="slot-cost">${cost}</span>
            ${ability.id === "potion" ? '<span class="potion-count">2</span>' : ""}
            <span class="slot-cooldown" style="--sweep:0"></span>
            <span class="slot-cdtext"></span>
            <span class="slot-tooltip">
              <b>${ability.name}</b>
              <em>${ability.hint}</em>
              <span>${ability.description}</span>
            </span>
          </button>`;
      })
      .join("");
    this.actionSlots = [...this.actionBar.querySelectorAll<HTMLElement>(".action-slot")];
    this.actionSlots.forEach((slot, index) => {
      slot.addEventListener("click", () => {
        this.game.useAbility(index);
      });
      slot.addEventListener("mouseenter", () => this.audio.play("ui"));
    });
    this.updateActionCooldowns();
  }

  private renderChat(reset = false): void {
    const messages = this.game.chat;
    const latestId = messages.length > 0 ? messages[messages.length - 1].id : 0;
    if (reset || this.chatRenderedTab !== this.chatTab || this.lastChatId > latestId) {
      this.chatMessages.innerHTML = "";
      this.chatRenderedTab = this.chatTab;
      const filtered = messages.filter((message) => this.matchesChatTab(message.channel));
      for (const message of filtered.slice(-70)) {
        this.chatMessages.appendChild(this.messageElement(message));
      }
      this.lastChatId = latestId;
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
      return;
    }
    if (latestId === this.lastChatId) return;
    const nearBottom =
      this.chatMessages.scrollHeight - this.chatMessages.scrollTop - this.chatMessages.clientHeight < 52;
    const newMessages = messages.filter((message) => message.id > this.lastChatId);
    for (const message of newMessages) {
      if (this.matchesChatTab(message.channel)) {
        this.chatMessages.appendChild(this.messageElement(message));
      }
    }
    while (this.chatMessages.children.length > 90) {
      this.chatMessages.firstElementChild?.remove();
    }
    this.lastChatId = latestId;
    if (nearBottom) this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  private matchesChatTab(channel: string): boolean {
    if (this.chatTab === "combat") return channel === "combat" || channel === "loot";
    return channel !== "combat" && channel !== "loot";
  }

  private messageElement(message: {
    channel: string;
    author: string;
    text: string;
    color: string;
    time: string;
  }): HTMLElement {
    const line = document.createElement("div");
    line.className = `chat-line ${message.channel}`;
    if (message.channel === "system" && !message.author) {
      const glyph = document.createElement("span");
      glyph.className = "chat-system-mark";
      glyph.textContent = "·";
      const copy = document.createElement("span");
      copy.textContent = message.text;
      line.append(glyph, copy);
      return line;
    }
    const prefix = document.createElement("span");
    prefix.className = "chat-prefix";
    prefix.textContent =
      message.channel === "world"
        ? "[World]"
        : message.channel === "party"
          ? "[Party]"
          : message.channel === "loot"
            ? "[Loot]"
            : message.channel === "combat"
              ? "[Log]"
              : message.channel === "system"
                ? "[System]"
                : "[Say]";
    const author = document.createElement("b");
    author.style.color = message.color;
    author.textContent = message.author ? `${message.author}: ` : "";
    const text = document.createElement("span");
    text.textContent = message.text;
    const time = document.createElement("small");
    time.className = "chat-time";
    time.textContent = message.time;
    line.append(prefix, author, text);
    if (message.channel === "loot" || message.channel === "combat") line.append(time);
    return line;
  }

  private sendChat(): void {
    const text = this.chatInput.value.trim();
    if (!text) {
      this.chatInput.blur();
      return;
    }
    this.game.sendChat(text);
    this.chatInput.value = "";
    this.chatInput.blur();
    this.audio.play("ui");
    this.renderChat(false);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  private openPanel(panel: PanelName): void {
    if (!panel) return;
    if (this.game.mode !== "playing" && panel !== "help") return;
    switch (panel) {
      case "character":
        this.openCharacter();
        break;
      case "vendor":
        this.openVendor();
        break;
      case "map":
        this.openMap();
        break;
      case "social":
        this.openSocial();
        break;
      case "quests":
        this.openQuests();
        break;
      case "help":
        this.openHelp();
        break;
      case "npc":
        break;
    }
  }

  private openModal(name: PanelName, content: string, className = ""): void {
    this.activeModal = name;
    this.game.clearKeys();
    this.modalLayer.innerHTML = `
      <div class="modal-backdrop"></div>
      <section class="modal-window ${className}" role="dialog" aria-modal="true">
        <button class="modal-close" data-close aria-label="Close">×</button>
        ${content}
      </section>`;
    this.modalLayer.classList.remove("hidden");
    const modal = this.modalLayer.querySelector<HTMLElement>(".modal-window");
    if (modal) {
      requestAnimationFrame(() => modal.classList.add("visible"));
    }
    this.audio.play("ui");
  }

  private openNpc(npcId: string): void {
    const npc = this.game.getNpc(npcId);
    if (!npc) return;
    const questInfo = this.game.getNpcQuest(npcId);
    if (npc.role === "vendor") {
      this.openVendor();
      return;
    }
    const npcGlyph = npc.role === "flavor" ? "♪" : npc.name.startsWith("Ilyra") ? "✦" : npc.name.startsWith("Orin") ? "◈" : "⚔";
    let body = "";
    let actions = "";
    if (questInfo) {
      const { quest, status } = questInfo;
      const state = this.game.player.quests[quest.id];
      const progress = state?.progress ?? 0;
      const objective = `${Math.min(progress, quest.objective.count)} / ${quest.objective.count}`;
      const lockReason = quest.prereq
        ? "You must finish the previous thread before this one can begin."
        : `Requires level ${quest.level}.`;
      if (status === "available") {
        body = `
          <p class="npc-dialogue">“${escapeHtml(quest.intro)}”</p>
          <div class="quest-offer">
            <span class="quest-kicker">QUEST AVAILABLE</span>
            <div class="quest-offer-head"><h3>${escapeHtml(quest.title)}</h3><span>LEVEL ${quest.level}</span></div>
            <p>${escapeHtml(quest.summary)}</p>
            <div class="quest-objective-row"><span class="objective-dot"></span>${escapeHtml(quest.objective.label)} <b>0 / ${quest.objective.count}</b></div>
            <div class="quest-rewards">
              <span><i>✦</i>${quest.reward.xp} XP</span>
              <span><i>◉</i>${quest.reward.gold} gold</span>
              ${quest.reward.item ? `<span class="reward-item" style="color:${rarityColor(ITEMS[quest.reward.item]?.rarity ?? "common")}"><i>${ITEMS[quest.reward.item]?.icon ?? "◈"}</i>${escapeHtml(ITEMS[quest.reward.item]?.name ?? quest.gearHint)}</span>` : ""}
            </div>
          </div>`;
        actions = `<button class="primary-button" data-quest-action="accept" data-quest-id="${quest.id}">Accept quest</button>
                   <button class="ghost-button" data-close>Not yet</button>`;
      } else if (status === "active") {
        body = `
          <p class="npc-dialogue">“${escapeHtml(quest.progress)}”</p>
          <div class="quest-offer active">
            <span class="quest-kicker">IN PROGRESS</span>
            <div class="quest-offer-head"><h3>${escapeHtml(quest.title)}</h3><span>${objective}</span></div>
            <p>${escapeHtml(quest.objective.label)}</p>
          </div>`;
        actions = `<button class="primary-button" data-quest-action="journal" data-quest-id="${quest.id}">Open journal</button>
                   <button class="ghost-button" data-close>I'll return</button>`;
      } else if (status === "ready") {
        body = `
          <p class="npc-dialogue">“${escapeHtml(quest.complete)}”</p>
          <div class="quest-offer ready">
            <span class="quest-kicker">READY TO TURN IN</span>
            <div class="quest-offer-head"><h3>${escapeHtml(quest.title)}</h3><span>${objective}</span></div>
            <div class="quest-rewards">
              <span><i>✦</i>${quest.reward.xp} XP</span>
              <span><i>◉</i>${quest.reward.gold} gold</span>
              ${quest.reward.item ? `<span class="reward-item" style="color:${rarityColor(ITEMS[quest.reward.item]?.rarity ?? "common")}"><i>${ITEMS[quest.reward.item]?.icon ?? "◈"}</i>${escapeHtml(ITEMS[quest.reward.item]?.name ?? quest.gearHint)}</span>` : ""}
            </div>
          </div>`;
        actions = `<button class="primary-button" data-quest-action="complete" data-quest-id="${quest.id}">Complete quest</button>
                   <button class="ghost-button" data-close>One moment</button>`;
      } else if (status === "locked") {
        body = `
          <p class="npc-dialogue">“${escapeHtml(npc.line)}”</p>
          <div class="quest-locked"><span>THREAD NOT YET OPEN</span><p>${escapeHtml(quest.title)}</p><small>${escapeHtml(lockReason)}</small></div>`;
        actions = `<button class="ghost-button" data-close>I understand</button>`;
      } else {
        body = `<p class="npc-dialogue">“${escapeHtml(npc.line)}”</p><p class="npc-aside">${escapeHtml(npc.name)} ${escapeHtml(npc.emote)}.</p>`;
        actions = `<button class="ghost-button" data-close>Farewell</button>`;
      }
    } else {
      body = `
        <p class="npc-dialogue">“${escapeHtml(npc.line)}”</p>
        <p class="npc-aside">${escapeHtml(npc.name)} ${escapeHtml(npc.emote)}. For a moment, the fire seems to lean closer.</p>`;
      actions = `<button class="primary-button" data-panel-link="quests">Open journal</button><button class="ghost-button" data-close>Farewell</button>`;
    }

    this.openModal(
      "npc",
      `
      <div class="npc-modal">
        <div class="npc-portrait" style="--npc-color:${npc.color}">
          <span class="npc-halo"></span>
          <span class="npc-glyph">${npcGlyph}</span>
          <small>${escapeHtml(npc.title)}</small>
        </div>
        <div class="npc-content">
          <span class="modal-kicker">${questInfo ? questStatusLabel(questInfo.status).toUpperCase() : "A VOICE IN EVERWAKE"}</span>
          <h2>${escapeHtml(npc.name)}</h2>
          <p class="npc-title">${escapeHtml(npc.title)}</p>
          <div class="modal-divider"></div>
          ${body}
          <div class="npc-actions">${actions}</div>
        </div>
      </div>`,
      "npc-window",
    );
  }

  private openVendor(keepState = false): void {
    if (!keepState) this.selectedItemUid = null;
    const stock = VENDOR_STOCK.map((entry) => {
      if (entry.itemId === "potion") {
        return `
          <div class="vendor-row">
            <span class="vendor-icon" style="--item-color:#e8c476">◉</span>
            <div class="vendor-copy"><b>Sunpetal Draught</b><small>Restores 42% health · carries ${this.game.player.potions}</small></div>
            <span class="vendor-price">${entry.price}g</span>
            <button class="mini-button" data-vendor-buy="${entry.itemId}" ${this.game.player.gold < entry.price ? "disabled" : ""}>Buy</button>
          </div>`;
      }
      const item = ITEMS[entry.itemId];
      if (!item) return "";
      return `
        <div class="vendor-row">
          <span class="vendor-icon" style="--item-color:${rarityColor(item.rarity)}">${item.icon}</span>
          <div class="vendor-copy"><b style="color:${rarityColor(item.rarity)}">${escapeHtml(item.name)}</b><small>${itemStatLine(item)}</small></div>
          <span class="vendor-price">${entry.price}g</span>
          <button class="mini-button" data-vendor-buy="${entry.itemId}" ${this.game.player.gold < entry.price ? "disabled" : ""}>Buy</button>
        </div>`;
    }).join("");

    const sellable = this.game.getInventory();
    const sellRows =
      sellable.length > 0
        ? sellable
            .map((instance) => {
              const item = ITEMS[instance.defId];
              if (!item) return "";
              return `
                <div class="sell-row">
                  <span style="color:${rarityColor(item.rarity)}">${item.icon}</span>
                  <span>${escapeHtml(item.name)}</span>
                  <small>${Math.max(1, Math.floor(item.value * 0.5))}g</small>
                  <button class="mini-button quiet" data-vendor-sell="${instance.uid}">Sell</button>
                </div>`;
            })
            .join("")
        : `<div class="vendor-empty">Your satchel holds nothing Sable wants. Yet.</div>`;

    const content = `
      <div class="vendor-head">
        <div class="vendor-crest">⚖</div>
        <div>
          <span class="modal-kicker">THE WAYFARER'S TRADE</span>
          <h2>Sable Quill</h2>
          <p>“Everything has a price. Some things have two.”</p>
        </div>
        <div class="vendor-gold"><span>◉</span>${this.game.player.gold} <small>gold</small></div>
      </div>
      <div class="vendor-body">
        <div class="vendor-main">
          <h3 class="modal-section-title">WARES FOR THE ROAD <span>prices in gold</span></h3>
          <div class="vendor-list">${stock}</div>
        </div>
        <div class="vendor-side">
          <h3 class="modal-section-title">SELL FROM SATCHEL <span>half value</span></h3>
          <div class="sell-list">${sellRows}</div>
        </div>
      </div>
      <div class="modal-footer-note">Sable counts the coins twice. The second time is for the story.</div>`;
    this.openModal("vendor", content, "vendor-window");
  }

  private openCharacter(): void {
    const player = this.game.player;
    const def = CLASSES[player.classId];
    const equipmentSlots: Array<"weapon" | "armor" | "trinket"> = ["weapon", "armor", "trinket"];
    const equipment = equipmentSlots
      .map((slot) => {
        const instance = this.game.getEquipped(slot);
        const item = instance ? ITEMS[instance.defId] : null;
        return `
          <div class="equipment-slot ${item ? "filled" : ""}">
            <span class="equipment-icon" style="--item-color:${item ? rarityColor(item.rarity) : "#827763"}">${item ? item.icon : "·"}</span>
            <div><small>${slot}</small><b style="color:${item ? rarityColor(item.rarity) : "#938977"}">${item ? escapeHtml(item.name) : "Empty"}</b><span>${item ? itemStatLine(item) : "No item equipped"}</span></div>
          </div>`;
      })
      .join("");

    const selectedInstance = player.inventory.find((instance) => instance.uid === this.selectedItemUid);
    const selectedItem = selectedInstance ? ITEMS[selectedInstance.defId] : null;
    const selectedPanel = selectedItem
      ? `
        <div class="item-detail">
          <span class="item-detail-icon" style="color:${rarityColor(selectedItem.rarity)}">${selectedItem.icon}</span>
          <div class="item-detail-copy">
            <span class="modal-kicker">${selectedItem.rarity.toUpperCase()} ${selectedItem.slot}</span>
            <h3 style="color:${rarityColor(selectedItem.rarity)}">${escapeHtml(selectedItem.name)}</h3>
            <p>${itemStatLine(selectedItem)}</p>
            <small>${escapeHtml(selectedItem.flavor)}</small>
          </div>
          <div class="item-detail-actions">
            <button class="mini-button" data-item-action="equip" data-item-uid="${selectedInstance?.uid}">Equip</button>
            <button class="mini-button quiet" data-item-action="sell" data-item-uid="${selectedInstance?.uid}">Sell ${Math.max(1, Math.floor(selectedItem.value * 0.5))}g</button>
          </div>
        </div>`
      : `<div class="item-detail empty"><span>Select an item from your satchel to inspect it.</span></div>`;

    const inventoryCells = Array.from({ length: 18 })
      .map((_, index) => {
        const instance = player.inventory[index];
        if (!instance) return `<span class="bag-cell empty"></span>`;
        const item = ITEMS[instance.defId];
        if (!item) return `<span class="bag-cell empty"></span>`;
        return `
          <button class="bag-cell filled ${this.selectedItemUid === instance.uid ? "selected" : ""}" data-item-select="${instance.uid}" style="--item-color:${rarityColor(item.rarity)}" title="${escapeHtml(item.name)}">
            <span>${item.icon}</span>
            <small>${item.slot === "weapon" ? "W" : item.slot === "armor" ? "A" : "T"}</small>
          </button>`;
      })
      .join("");

    const completion = QUESTS.filter((quest) => player.quests[quest.id]?.status === "done").length;
    const content = `
      <div class="character-layout">
        <div class="character-left">
          <div class="char-head">
            <div class="char-portrait" style="--class-color:${def.color};--class-dark:${def.color2}">
              <span>${CLASS_GLYPHS[player.classId]}</span>
              <b>${player.level}</b>
            </div>
            <div>
              <span class="modal-kicker">${def.epithet.toUpperCase()}</span>
              <h2>${escapeHtml(player.name)}</h2>
              <p>${def.name} · ${def.role} · ${player.resourceName}</p>
            </div>
          </div>
          <div class="char-quote">“${escapeHtml(def.fantasy)}”</div>
          <div class="stat-grid">
            <div><span>Health</span><b>${Math.ceil(player.hp)} / ${player.maxHp}</b></div>
            <div><span>Power</span><b>${Math.round(player.power)}</b></div>
            <div><span>Armor</span><b>${Math.round(player.armor)}</b></div>
            <div><span>Critical</span><b>15%</b></div>
            <div><span>Foes bested</span><b>${player.kills}</b></div>
            <div><span>Threads finished</span><b>${completion} / ${QUESTS.length}</b></div>
          </div>
          <h3 class="modal-section-title">EQUIPPED <span>the shape of a wanderer</span></h3>
          <div class="equipment-list">${equipment}</div>
          <div class="char-wallet"><span>◉ <b>${player.gold}</b> gold</span><span>◉ <b>${player.potions}</b> draughts</span></div>
        </div>
        <div class="character-right">
          <h3 class="modal-section-title">SATCHEL <span>${player.inventory.length} / 18</span></h3>
          <div class="bag-grid">${inventoryCells}</div>
          ${selectedPanel}
          <div class="char-note"><span>✦</span> Loot that improves an empty or weaker slot is equipped automatically. Everything else waits here.</div>
        </div>
      </div>`;
    this.openModal("character", content, "character-window");
  }

  private openQuests(): void {
    const active = QUESTS.filter((quest) => {
      const status = this.game.player.quests[quest.id]?.status;
      return status === "active" || status === "ready";
    });
    const done = QUESTS.filter((quest) => this.game.player.quests[quest.id]?.status === "done");
    const upcoming = QUESTS.filter((quest) => {
      const status = this.game.player.quests[quest.id]?.status;
      return status === "available" || status === "locked";
    });
    const questCard = (quest: QuestDef, status: QuestStatus): string => {
      const state = this.game.player.quests[quest.id];
      const progress = state?.progress ?? 0;
      return `
        <article class="journal-entry ${status}">
          <div class="journal-top"><span class="journal-status">${questStatusLabel(status)}</span><span class="journal-level">LEVEL ${quest.level}</span></div>
          <h3>${escapeHtml(quest.title)}</h3>
          <p>${escapeHtml(status === "active" || status === "ready" ? quest.progress : quest.summary)}</p>
          <div class="journal-objective"><span class="objective-dot"></span>${escapeHtml(quest.objective.label)} <b>${Math.min(progress, quest.objective.count)} / ${quest.objective.count}</b></div>
          <div class="journal-rewards"><span>✦ ${quest.reward.xp} XP</span><span>◉ ${quest.reward.gold}g</span>${quest.reward.item ? `<span style="color:${rarityColor(ITEMS[quest.reward.item]?.rarity ?? "common")}">${ITEMS[quest.reward.item]?.icon} ${escapeHtml(ITEMS[quest.reward.item]?.name ?? "")}</span>` : ""}</div>
        </article>`;
    };
    const content = `
      <div class="journal-head">
        <div><span class="modal-kicker">THE WANDERER'S JOURNAL</span><h2>Threads of the realm</h2><p>Every road here was walked before you. Some are still warm.</p></div>
        <div class="journal-count"><b>${done.length}</b><span>threads finished</span></div>
      </div>
      <div class="journal-body">
        <section><h3 class="modal-section-title">IN YOUR HANDS</h3>${active.length ? active.map((quest) => questCard(quest, this.game.player.quests[quest.id].status)).join("") : `<div class="journal-empty">No thread is currently in your hands. The gold markers in camp will point the way.</div>`}</section>
        ${upcoming.length ? `<section><h3 class="modal-section-title">STILL WAITING</h3>${upcoming.map((quest) => questCard(quest, this.game.player.quests[quest.id].status)).join("")}</section>` : ""}
        ${done.length ? `<section><h3 class="modal-section-title">REMEMBERED</h3><div class="done-list">${done.map((quest) => `<span>✓ ${escapeHtml(quest.title)}</span>`).join("")}</div></section>` : ""}
      </div>`;
    this.openModal("quests", content, "journal-window");
  }

  private openMap(): void {
    const content = `
      <div class="map-head">
        <div><span class="modal-kicker">THE KNOWN ROAD</span><h2>${ZONES[this.game.zoneKey].name}</h2><p>${ZONES[this.game.zoneKey].sub}</p></div>
        <div class="map-legend">
          <span><i class="legend-player"></i>You</span>
          <span><i class="legend-quest"></i>Thread</span>
          <span><i class="legend-danger"></i>Hostile</span>
          <span><i class="legend-rift"></i>Rift</span>
        </div>
      </div>
      <div class="map-canvas-wrap">
        <canvas id="world-map-canvas"></canvas>
        <div class="map-scale">— 200 paces —</div>
        <div class="map-flavor">“The map is not the realm. It is only the realm's best guess.”</div>
      </div>
      <div class="map-foot">
        <div><b>${this.game.zoneKey === "dungeon" ? "THE SUNKEN RELIQUARY" : "THE VERDANT REACH"}</b><span>Quest markers are gold. Rifts are violet. The rest is yours to find.</span></div>
        <button class="ghost-button" data-close>Close map</button>
      </div>`;
    this.openModal("map", content, "map-window");
    const canvas = this.modalLayer.querySelector<HTMLCanvasElement>("#world-map-canvas");
    if (canvas) requestAnimationFrame(() => this.renderer.drawWorldMap(canvas));
  }

  private openSocial(): void {
    const statusList = ["at the fire", "questing", "reading the sky", "on the old road", "looking for a party", "in Gloamwood"];
    const others = BOTS.map((bot, index) => `
      <div class="social-row">
        <span class="social-dot" style="--class-color:${CLASSES[bot.classId].color}"></span>
        <div class="social-name"><b style="color:${CLASSES[bot.classId].color}">${escapeHtml(bot.name)}</b><small>${escapeHtml(bot.title)}</small></div>
        <span class="social-class">${CLASSES[bot.classId].name}</span>
        <span class="social-level">LV ${bot.level}</span>
        <span class="social-zone">${escapeHtml(bot.zone)}<small>${statusList[index % statusList.length]}</small></span>
      </div>`).join("");
    const content = `
      <div class="social-head">
        <div><span class="modal-kicker">THE REALM IS AWAKE</span><h2>Who is out there</h2><p>You walk alone, but you are not the only story moving.</p></div>
        <div class="social-online"><span class="live-dot"></span><b>${this.game.online.toLocaleString()}</b><small>online</small></div>
      </div>
      <div class="social-layout">
        <div class="social-main">
          <h3 class="modal-section-title">NEARBY ADVENTURERS <span>${BOTS.length} in the region</span></h3>
          <div class="social-list">${others}</div>
        </div>
        <aside class="social-side">
          <div class="guild-card">
            <span class="guild-mark">✦</span>
            <span class="modal-kicker">GUILD</span>
            <h3>The Unwritten</h3>
            <p>“No oath but the road. No banner but the weather.”</p>
            <small>1 member · you</small>
          </div>
          <div class="social-stat"><span>Realm</span><b>Everwake</b></div>
          <div class="social-stat"><span>Shard</span><b>Dawn · 01</b></div>
          <div class="social-stat"><span>Riftwatch</span><b>${this.game.rift.active ? "Rift detected" : "Quiet"}</b></div>
          <div class="social-note">The adventurers around you are part of the living-world simulation. They quest, gossip and grow without you.</div>
        </aside>
      </div>`;
    this.openModal("social", content, "social-window");
  }

  private openHelp(): void {
    const content = `
      <div class="help-head">
        <div><span class="modal-kicker">A FIELD GUIDE</span><h2>How to walk a living world</h2><p>There is no race. There is only the road and what you notice along it.</p></div>
        <span class="help-mark">✦</span>
      </div>
      <div class="help-grid">
        <section>
          <h3 class="modal-section-title">MOVEMENT &amp; COMBAT</h3>
          <div class="control-grid">
            <span><kbd>W A S D</kbd><small>Move. You can also click the ground.</small></span>
            <span><kbd>Tab</kbd><small>Cycle nearby enemies.</small></span>
            <span><kbd>1 2 3</kbd><small>Class abilities. They approach your target if needed.</small></span>
            <span><kbd>4</kbd><small>Drink a Sunpetal Draught.</small></span>
            <span><kbd>E</kbd><small>Speak, trade or enter a marked place.</small></span>
            <span><kbd>Esc</kbd><small>Close a panel.</small></span>
          </div>
        </section>
        <section>
          <h3 class="modal-section-title">THE LIVING REALM</h3>
          <ul class="help-list">
            <li><b>Gold markers</b> mean a quest. A <b>?</b> means a thread is ready to be finished.</li>
            <li><b>Rifts</b> open without warning. They are dangerous, brief, and worth the story.</li>
            <li><b>Other adventurers</b> are not waiting for you. They wander, chat and level on their own clock.</li>
            <li><b>Gear</b> in your satchel can be equipped or sold at Sable's stall.</li>
            <li><b>Death</b> returns you to the last fire. Progress remains.</li>
          </ul>
        </section>
        <section class="help-wide">
          <h3 class="modal-section-title">A SMALL NOTE ON THE ROAD</h3>
          <p>Everwake is built as a single-player MMO simulation: the shape of a shared world, with all the other players replaced by lives of their own. Read the chat. Follow a rumour. Fight something above your weight. The realm will keep going.</p>
        </section>
      </div>
      <div class="help-foot"><span>Press <kbd>H</kbd> at any time to return here.</span><button class="ghost-button" data-close>Back to the road</button></div>`;
    this.openModal("help", content, "help-window");
  }

  dispose(): void {
    this.audio.setAmbientIntensity(0);
    this.audio.dispose();
  }

  setVendorOpen(): void {
    if (this.activeModal !== "vendor") return;
    this.modalType = "vendor";
  }

  getModalType(): string {
    return this.modalType;
  }
}
