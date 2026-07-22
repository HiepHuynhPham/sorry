import { audioManager } from "./audio-manager.js";

const caseId = document.documentElement.dataset.case;
const selectors = caseId === "case-001"
  ? { open: "#openBtn", dodge: "#notYetBtn", forgive: "#yesBtn", dodgeLimit: 4 }
  : { open: "#open-case", dodge: "#angry", forgive: "#forgive", dodgeLimit: 2 };
const openButton = document.querySelector(selectors.open);
const dodgeButton = document.querySelector(selectors.dodge);
const forgiveButton = document.querySelector(selectors.forgive);
let dodgeCount = 0;

audioManager.initialize();

const control = document.createElement("button");
control.type = "button";
control.className = "audio-control";
control.hidden = true;
control.innerHTML = '<span class="audio-control-icon" aria-hidden="true"></span><span class="audio-control-label"></span>';
document.body.append(control);

function updateControl() {
  const muted = audioManager.muted;
  control.setAttribute("aria-pressed", String(!muted));
  control.setAttribute("aria-label", muted ? "Bật nhạc và âm thanh" : "Tắt nhạc và âm thanh");
  control.title = muted ? "Bật nhạc và âm thanh" : "Tắt nhạc và âm thanh";
  control.querySelector(".audio-control-icon").textContent = muted ? "🔇" : "🔊";
  control.querySelector(".audio-control-label").textContent = muted ? "Đã tắt nhạc" : "Nhạc đang bật";
}

openButton?.addEventListener("click", async () => {
  control.hidden = false; updateControl();
  try {
    const ready = await audioManager.unlock();
    audioManager.startCaseMusic(caseId);
    if (ready && !audioManager.muted) audioManager.playEffect("case-open");
  } catch (error) {
    console.info("Âm thanh mở hồ sơ không khả dụng:", error);
  }
});

const onDodge = () => {
  dodgeCount += 1;
  if (dodgeCount <= selectors.dodgeLimit) {
    audioManager.playEffect("button-dodge", dodgeCount);
    if (caseId === "case-002" && dodgeCount === selectors.dodgeLimit) {
      window.setTimeout(() => audioManager.playEffect("surrender"), 360);
    }
  }
  else if (dodgeCount === selectors.dodgeLimit + 1) audioManager.playEffect("surrender");
};
dodgeButton?.addEventListener("mouseenter", onDodge);
dodgeButton?.addEventListener("touchstart", onDodge, { passive: true });
if (caseId === "case-002") dodgeButton?.addEventListener("focus", onDodge);
forgiveButton?.addEventListener("click", () => audioManager.playEffect("forgiven"));

control.addEventListener("click", async () => {
  control.classList.remove("pop"); void control.offsetWidth; control.classList.add("pop");
  try {
    if (audioManager.muted) await audioManager.unlock();
    audioManager.setMuted(!audioManager.muted); updateControl();
  } catch (error) { console.info("Không thể đổi trạng thái âm thanh:", error); }
});

updateControl();
window.addEventListener("pagehide", () => audioManager.stopAll(), { once: true });
