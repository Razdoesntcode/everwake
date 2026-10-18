import "./style.css";
import { EverwakeGame } from "./game/engine";
import { Renderer } from "./game/render";
import { UI } from "./game/ui";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const uiRoot = document.querySelector<HTMLElement>("#ui");

if (!canvas || !uiRoot) {
  throw new Error("Game canvas or UI root is missing");
}

const game = new EverwakeGame();
const renderer = new Renderer(canvas, game);
const ui = new UI(game, renderer, uiRoot);

document.body.classList.add("title-mode");

const movementCodes = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

function isTyping(): boolean {
  return ui.isTextInputFocused();
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.code === "Escape") {
    if (ui.isModalOpen()) {
      event.preventDefault();
      ui.closeModal();
    }
    return;
  }

  if (isTyping() || game.mode === "title" || game.mode === "dead" || ui.isModalOpen()) return;

  if (movementCodes.has(event.code)) {
    game.setKey(event.code, true);
    event.preventDefault();
    return;
  }

  if (event.code === "Tab") {
    event.preventDefault();
    game.cycleTarget();
    return;
  }

  if (event.repeat) return;

  switch (event.code) {
    case "Digit1":
    case "Numpad1":
      game.useAbility(0);
      event.preventDefault();
      break;
    case "Digit2":
    case "Numpad2":
      game.useAbility(1);
      event.preventDefault();
      break;
    case "Digit3":
    case "Numpad3":
      game.useAbility(2);
      event.preventDefault();
      break;
    case "Digit4":
    case "Numpad4":
      game.useAbility(3);
      event.preventDefault();
      break;
    case "KeyE":
      game.interact();
      break;
    case "KeyC":
    case "KeyI":
      ui.openShortcut("character");
      break;
    case "KeyL":
      ui.openShortcut("quests");
      break;
    case "KeyM":
      ui.openShortcut("map");
      break;
    case "KeyO":
      ui.openShortcut("social");
      break;
    case "KeyH":
      ui.openShortcut("help");
      break;
    case "Enter":
      ui.focusChat();
      event.preventDefault();
      break;
    case "Slash":
      ui.focusChat();
      event.preventDefault();
      break;
    default:
      break;
  }
}

function handleKeyUp(event: KeyboardEvent): void {
  if (movementCodes.has(event.code)) {
    game.setKey(event.code, false);
  }
}

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("blur", () => game.clearKeys());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) game.clearKeys();
});

canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const point = renderer.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
  game.setMouse(point.x, point.y);
});

canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  if (game.mode !== "playing" || ui.isModalOpen()) return;
  const rect = canvas.getBoundingClientRect();
  const point = renderer.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
  game.setMouse(point.x, point.y);
  game.handleWorldClick(point.x, point.y);
});

canvas.addEventListener("contextmenu", (event) => event.preventDefault());

let lastTime = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (!ui.isModalOpen()) {
    game.update(dt);
  }
  renderer.render(dt);
  ui.update(dt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

declare global {
  interface Window {
    __everwake?: {
      game: EverwakeGame;
      renderer: Renderer;
      ui: UI;
    };
  }
}

window.__everwake = { game, renderer, ui };
