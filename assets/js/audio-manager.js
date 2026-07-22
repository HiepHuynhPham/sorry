const STORAGE = Object.freeze({
  muted: "sorry-site.audio.muted",
  musicVolume: "sorry-site.audio.music-volume",
  effectVolume: "sorry-site.audio.effect-volume",
});

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

class AudioManager {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.effectGain = null;
    this.caseId = null;
    this.unlocked = false;
    this.initialized = false;
    this.musicTimer = null;
    this.musicNodes = new Set();
    this.effectNodes = new Set();
    this.lastDodgeAt = 0;
    this.muted = false;
    this.musicVolume = 0.18;
    this.effectVolume = 0.34;
    this.visibilityHandler = () => this.handleVisibility();
  }

  initialize() {
    if (this.initialized) return this;
    this.initialized = true;
    this.muted = this.readPreference(STORAGE.muted, "false") === "true";
    this.musicVolume = clamp(Number(this.readPreference(STORAGE.musicVolume, "0.18")) || 0.18);
    this.effectVolume = clamp(Number(this.readPreference(STORAGE.effectVolume, "0.34")) || 0.34);
    document.addEventListener("visibilitychange", this.visibilityHandler);
    return this;
  }

  readPreference(key, fallback) {
    try { return localStorage.getItem(key) ?? fallback; }
    catch { return fallback; }
  }

  savePreference(key, value) {
    try { localStorage.setItem(key, String(value)); }
    catch (error) { console.info("Không thể lưu tùy chọn âm thanh:", error); }
  }

  async unlock() {
    this.initialize();
    try {
      if (!this.context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return false;
        this.context = new AudioContextClass();
        this.masterGain = this.context.createGain();
        this.musicGain = this.context.createGain();
        this.effectGain = this.context.createGain();
        this.musicGain.connect(this.masterGain);
        this.effectGain.connect(this.masterGain);
        this.masterGain.connect(this.context.destination);
        this.masterGain.gain.value = this.muted ? 0 : 1;
        this.musicGain.gain.value = 0;
        this.effectGain.gain.value = this.effectVolume;
      }
      if (this.context.state === "suspended") await this.context.resume().catch(() => undefined);
      this.unlocked = this.context.state === "running";
      return this.unlocked;
    } catch (error) {
      console.info("Trình duyệt không thể khởi tạo âm thanh:", error);
      return false;
    }
  }

  startCaseMusic(caseId) {
    this.initialize();
    if (this.caseId !== caseId) this.stopMusic(false);
    this.caseId = caseId;
    if (!this.unlocked || this.muted || document.hidden) return;
    this.stopMusic(false);
    this.fadeGain(this.musicGain, this.musicVolume, 1.25);
    this.scheduleMusicLoop();
  }

  scheduleMusicLoop() {
    if (!this.context || this.muted || !this.caseId || document.hidden) return;
    const now = this.context.currentTime + 0.04;
    const isCaseOne = this.caseId === "case-001";
    const motif = isCaseOne
      ? [[72, 0], [76, .48], [79, .96], [76, 1.44], [74, 2.05], [77, 2.53], [81, 3.01], [79, 3.49]]
      : [[60, 0], [64, .55], [67, 1.1], [72, 1.65], [69, 2.35], [67, 2.9], [64, 3.45], [67, 4]];
    motif.forEach(([note, offset], index) => this.playNote({
      note, start: now + offset, duration: isCaseOne ? .3 : .42,
      type: isCaseOne ? "sine" : "triangle", destination: this.musicGain,
      volume: isCaseOne ? .12 : .105, sparkle: isCaseOne && index % 3 === 0,
    }, this.musicNodes));
    if (!isCaseOne) [0.28, 1.38, 2.58, 3.72].forEach((offset, index) => this.playNote({ note: index % 2 ? 43 : 45, start: now + offset, duration: .055, type: "sine", destination: this.musicGain, volume: .025 }, this.musicNodes));
    this.musicTimer = window.setTimeout(() => this.scheduleMusicLoop(), isCaseOne ? 4300 : 4850);
  }

  playEffect(name, variant = 0) {
    if (!this.context || !this.unlocked || this.muted || document.hidden) return;
    const nowMs = performance.now();
    if (name === "button-dodge" && nowMs - this.lastDodgeAt < 250) return;
    if (name === "button-dodge") this.lastDodgeAt = nowMs;
    if (name === "case-open") return this.playOpenEffect();
    if (name === "button-dodge") return this.playDodgeEffect(variant);
    if (name === "surrender") return this.playSurrender();
    if (name === "forgiven") return this.playForgiven();
  }

  playOpenEffect() {
    this.clearNodes(this.effectNodes);
    const now = this.context.currentTime;
    const notes = this.caseId === "case-001" ? [[84, 0], [72, .18], [76, .34], [79, .5]] : [[88, 0], [88, .14], [64, .38], [67, .54], [71, .7], [69, .86]];
    notes.forEach(([note, offset], index) => this.playNote({ note, start: now + offset, duration: index < 2 ? .12 : .22, type: "sine", destination: this.effectGain, volume: .32 }, this.effectNodes));
  }

  playDodgeEffect(variant) {
    const now = this.context.currentTime;
    if (this.caseId === "case-002" && variant >= 2) {
      [76, 81].forEach((note, index) => this.playNote({ note, start: now + index * .1, duration: .14, type: "triangle", destination: this.effectGain, volume: .25 }, this.effectNodes));
      return;
    }
    this.playNote({ note: 55 + (variant % 4) * 3, endNote: 72 + (variant % 3) * 2, start: now, duration: .17, type: "sine", destination: this.effectGain, volume: .24 }, this.effectNodes);
    if (this.caseId === "case-002") this.playNote({ note: 86, start: now, duration: .045, type: "square", destination: this.effectGain, volume: .08 }, this.effectNodes);
  }

  playSurrender() {
    const now = this.context.currentTime;
    [72, 69, 65].forEach((note, index) => this.playNote({ note, start: now + index * .16, duration: .2, type: "triangle", destination: this.effectGain, volume: .2 }, this.effectNodes));
  }

  playForgiven() {
    this.clearNodes(this.effectNodes);
    this.duckMusic(2.1);
    const now = this.context.currentTime;
    const notes = this.caseId === "case-001" ? [72, 76, 79, 84, 88] : [60, 64, 67, 72, 76, 79];
    notes.forEach((note, index) => this.playNote({ note, start: now + index * .23, duration: .32, type: index === notes.length - 1 ? "sine" : "triangle", destination: this.effectGain, volume: .3, sparkle: index === notes.length - 1 }, this.effectNodes));
  }

  playNote(options, collection) {
    if (!this.context || !options.destination) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const start = options.start ?? this.context.currentTime;
    const duration = Math.max(.04, options.duration ?? .2);
    oscillator.type = options.type || "sine";
    oscillator.frequency.setValueAtTime(this.noteFrequency(options.note), start);
    if (options.endNote) oscillator.frequency.exponentialRampToValueAtTime(this.noteFrequency(options.endNote), start + duration * .7);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.001, options.volume || .1), start + .018);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(options.destination);
    collection.add(oscillator);
    oscillator.onended = () => { collection.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start); oscillator.stop(start + duration + .03);
    if (options.sparkle) {
      const overtone = this.context.createOscillator(), overtoneGain = this.context.createGain();
      overtone.type = "sine"; overtone.frequency.value = this.noteFrequency(options.note + 12);
      overtoneGain.gain.setValueAtTime(.0001, start); overtoneGain.gain.exponentialRampToValueAtTime((options.volume || .1) * .3, start + .01); overtoneGain.gain.exponentialRampToValueAtTime(.0001, start + duration * .8);
      overtone.connect(overtoneGain); overtoneGain.connect(options.destination); collection.add(overtone);
      overtone.onended = () => { collection.delete(overtone); overtone.disconnect(); overtoneGain.disconnect(); };
      overtone.start(start); overtone.stop(start + duration);
    }
  }

  noteFrequency(note) { return 440 * (2 ** ((note - 69) / 12)); }

  duckMusic(duration = 2) {
    if (!this.musicGain || this.muted) return;
    const now = this.context.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(Math.max(.0001, this.musicGain.gain.value), now);
    this.musicGain.gain.linearRampToValueAtTime(.08, now + .12);
    this.musicGain.gain.linearRampToValueAtTime(this.musicVolume, now + duration);
  }

  setMuted(value) {
    this.muted = Boolean(value); this.savePreference(STORAGE.muted, this.muted);
    if (!this.context) return;
    if (this.muted) {
      this.fadeGain(this.masterGain, 0, .35);
      window.setTimeout(() => { if (this.muted) { this.stopMusic(false); this.clearNodes(this.effectNodes); this.context?.suspend().catch(() => undefined); } }, 380);
    } else {
      this.context.resume().then(() => { this.unlocked = true; this.fadeGain(this.masterGain, 1, .45); this.startCaseMusic(this.caseId); }).catch(() => undefined);
    }
  }

  setMusicVolume(value) { this.musicVolume = clamp(Number(value)); this.savePreference(STORAGE.musicVolume, this.musicVolume); if (this.musicGain && !this.muted) this.fadeGain(this.musicGain, this.musicVolume, .2); }
  setEffectVolume(value) { this.effectVolume = clamp(Number(value)); this.savePreference(STORAGE.effectVolume, this.effectVolume); if (this.effectGain) this.effectGain.gain.value = this.effectVolume; }

  handleVisibility() {
    if (!this.context || !this.unlocked) return;
    if (document.hidden) {
      this.fadeGain(this.masterGain, 0, .25);
      window.setTimeout(() => { if (document.hidden) { this.stopMusic(false); this.context?.suspend().catch(() => undefined); } }, 280);
    } else if (!this.muted) {
      this.context.resume().then(() => { this.fadeGain(this.masterGain, 1, .5); this.startCaseMusic(this.caseId); }).catch(() => undefined);
    }
  }

  fadeGain(node, target, seconds) {
    if (!node || !this.context) return;
    const now = this.context.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(Math.max(.0001, node.gain.value), now);
    node.gain.linearRampToValueAtTime(Math.max(.0001, target), now + seconds);
  }

  clearNodes(nodes) { nodes.forEach((node) => { try { node.stop(); } catch {} }); nodes.clear(); }
  stopMusic(fade = true) {
    clearTimeout(this.musicTimer); this.musicTimer = null;
    if (fade && this.musicGain) this.fadeGain(this.musicGain, 0, .3);
    this.clearNodes(this.musicNodes);
  }
  stopAll() { this.stopMusic(); this.clearNodes(this.effectNodes); if (this.masterGain) this.fadeGain(this.masterGain, 0, .25); }
  destroy() { this.stopAll(); document.removeEventListener("visibilitychange", this.visibilityHandler); this.context?.close().catch(() => undefined); this.context = null; this.unlocked = false; }
}

export const audioManager = new AudioManager();
