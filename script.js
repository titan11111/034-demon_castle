/* =========================================
   魔王城と母 — 演出エンジン (#1-#20)
   シナリオ本文は story.js。ここでは音・間・画面だけを足す。
   ========================================= */

const ITEM_CATALOG = new Map([
    ['hasPhoto', { label: '息子の写真', note: '胸ポケットに温もりが残る' }],
    ['hasKnife', { label: '護身用ナイフ', note: '冷たい刃が頼りになる' }],
    ['greed', { label: '赤い宝石', note: '魔王城の誘惑の欠片' }]
]);

const SPEAKER_CLASS = {
    '主人公': 'sp-hero',
    '息子': 'sp-son',
    'ミナ': 'sp-mina',
    '魔王': 'sp-demon',
    'ピエロ': 'sp-clown',
    '幻影の息子': 'sp-phantom',
    '効果音': 'sp-se',
    'システム': 'sp-sys',
    '？？？': 'sp-son',
    '私': 'sp-hero'
};

const KEN_BURNS = {
    'sick.png': { from: 'scale(1) translate(0, 0)', to: 'scale(1.14) translate(0, -4%)', dur: 22000 },
    'palece.png': { from: 'scale(1.04) translate(0, 5%)', to: 'scale(1.16) translate(0, -2%)', dur: 20000 },
    'mina.png': { from: 'scale(1.02)', to: 'scale(1.08)', dur: 14000 },
    'maou.png': { from: 'scale(1.05) translate(0, -2%)', to: 'scale(1.12) translate(0, -2%)', dur: 24000 },
    'forest.png': { from: 'scale(1)', to: 'scale(1.1) translate(-3%, 0)', dur: 18000 },
    'plant.png': { from: 'scale(1.03)', to: 'scale(1.14)', dur: 8000 },
    'gaikotu.png': { from: 'scale(1)', to: 'scale(1.1) translate(2%, 0)', dur: 12000 },
    'rouya.png': { from: 'scale(1.02)', to: 'scale(1.08)', dur: 16000 },
    'piero.png': { from: 'scale(1.02)', to: 'scale(1.08)', dur: 9000 },
    'minatenn.png': { from: 'scale(1.03)', to: 'scale(1.1)', dur: 18000 },
    'bridge.png': { from: 'scale(1.04) translate(0, 3%)', to: 'scale(1.12) translate(0, -2%)', dur: 16000 },
    'treasure.png': { from: 'scale(1.02)', to: 'scale(1.1) translate(0, 2%)', dur: 14000 },
    'phantom.png': { from: 'scale(1.04)', to: 'scale(1.12)', dur: 9000 },
    'phantom-face.png': { from: 'scale(1.06)', to: 'scale(1.14) translate(0, 2%)', dur: 11000 },
    'remembered.png': { from: 'scale(1.02)', to: 'scale(1.08) translate(0, -2%)', dur: 18000 }
};

const getEl = (id) => document.getElementById(id);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

class SceneEffect {
    constructor(duration = 900) {
        this.duration = duration;
        this.startTime = 0;
    }
    begin(now) { this.startTime = now; }
    progress(now) {
        return Math.min(1, (now - this.startTime) / this.duration);
    }
    isFinished(now) {
        return now - this.startTime >= this.duration;
    }
    draw() {}
}

class IrisWipeEffect extends SceneEffect {
    draw(ctx, width, height, progress) {
        const cx = width * 0.5;
        const cy = height * 0.5;
        const maxR = Math.hypot(cx, cy) * 1.05;
        ctx.save();
        ctx.fillStyle = 'rgba(8, 0, 16, 0.92)';
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        ctx.arc(cx, cy, maxR * (1 - progress), 0, Math.PI * 2, true);
        ctx.fill('evenodd');
        ctx.restore();
    }
}

class NoiseCanvasEffect extends SceneEffect {
    draw(ctx, width, height, progress) {
        const alpha = 0.08 + progress * 0.12;
        const n = 80;
        for (let i = 0; i < n; i++) {
            ctx.fillStyle = `rgba(255,${Math.random() * 80 | 0},${Math.random() * 80 | 0},${alpha})`;
            ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
        }
    }
}


class SaveManager {
    static DB = 'demon_castle_v1';
    static STORE = 'progress';

    openDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(SaveManager.DB, 1);
            req.onupgradeneeded = () => {
                req.result.createObjectStore(SaveManager.STORE);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async save(state) {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(SaveManager.STORE, 'readwrite');
            tx.objectStore(SaveManager.STORE).put(state, 'slot1');
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async load() {
        const db = await this.openDb();
        return new Promise((resolve) => {
            const tx = db.transaction(SaveManager.STORE, 'readonly');
            const req = tx.objectStore(SaveManager.STORE).get('slot1');
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    }
}

class PerformanceMonitor {
    mark(label) { performance.mark(`${label}-start`); }
    measure(label) {
        performance.mark(`${label}-end`);
        performance.measure(label, `${label}-start`, `${label}-end`);
        const entries = performance.getEntriesByName(label);
        const last = entries[entries.length - 1];
        return last ? last.duration : 0;
    }
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function withRuby(text) {
    return escapeHtml(text)
        .replace(/万魔の雫/g, '<ruby>万魔の雫<rt>まんまのしずく</rt></ruby>')
        .replace(/死者の谷/g, '<ruby>死者の谷<rt>ししゃのたに</rt></ruby>');
}

function segmentText(text) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const seg = new Intl.Segmenter('ja', { granularity: 'grapheme' });
        return Array.from(seg.segment(text), (part) => part.segment);
    }
    return Array.from(text);
}

function delayForGrapheme(g, inParen) {
    if (inParen) return 11;
    if (g === '…' || g === '・') return 130;
    if (g === '。' || g === '！' || g === '？' || g === '!' || g === '?') return 210;
    if (g === '、' || g === '，') return 85;
    return 26;
}

class Typewriter {
    constructor(el, text, onDone, fast) {
        this.el = el;
        this.text = text;
        this.chars = segmentText(text);
        this.onDone = onDone;
        this.index = 0;
        this.done = false;
        this.last = 0;
        this.rafId = 0;
        this.wait = fast ? 8 : 26;
        this.fast = !!fast;
        this.paren = 0;
    }
    start() {
        this.el.textContent = '';
        this.rafId = requestAnimationFrame((t) => this.tick(t));
    }
    tick(now) {
        if (!this.last) this.last = now;
        if (now - this.last >= this.wait) {
            this.last = now;
            const g = this.chars[this.index];
            if (g === '（' || g === '(') this.paren += 1;
            this.index += 1;
            this.el.textContent = this.chars.slice(0, this.index).join('');
            if (g === '）' || g === ')') this.paren = Math.max(0, this.paren - 1);
            this.wait = this.fast ? 8 : delayForGrapheme(g, this.paren > 0);
            if (this.index >= this.chars.length) {
                this.finish();
                return;
            }
        }
        this.rafId = requestAnimationFrame((t) => this.tick(t));
    }
    skip() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.finish();
    }
    finish() {
        if (this.done) return;
        this.done = true;
        this.el.innerHTML = withRuby(this.text);
        if (this.onDone) this.onDone();
    }
}

class EffectCanvas {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.active = null;
        this.rafId = 0;
    }
    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    play(effect) {
        this.active = effect;
        effect.begin(performance.now());
        if (!this.rafId) this.loop();
    }
    loop() {
        const now = performance.now();
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        this.ctx.clearRect(0, 0, w, h);
        if (this.active) {
            this.active.draw(this.ctx, w, h, this.active.progress(now));
            if (this.active.isFinished(now)) this.active = null;
        }
        this.rafId = this.active ? requestAnimationFrame(() => this.loop()) : 0;
    }
    async irisTransition() {
        if (reducedMotion()) return;
        return new Promise((resolve) => {
            const effect = new IrisWipeEffect(640);
            const start = performance.now();
            const tick = (now) => {
                const w = this.canvas.clientWidth;
                const h = this.canvas.clientHeight;
                this.ctx.clearRect(0, 0, w, h);
                const p = effect.progress(now);
                effect.draw(this.ctx, w, h, p < 0.5 ? p * 2 : 2 - p * 2);
                if (now - start < 640) requestAnimationFrame(tick);
                else {
                    this.ctx.clearRect(0, 0, w, h);
                    resolve();
                }
            };
            effect.begin(start);
            requestAnimationFrame(tick);
        });
    }
}

const sound = new SoundManager();
const saveManager = new SaveManager();
const perf = new PerformanceMonitor();
const imageCache = new Map();
const itemInventory = new Map();
const completedScenes = new Set();
const seenTexts = new Set();
const pickedChoices = new Set();
const backlog = [];

let effectCanvas = null;
let typewriter = null;
let isTransitioning = false;
let kenAnim = null;
let wakeLock = null;
let holdTimer = 0;
let holdInterval = 0;
let whiteSoftTimer = 0;

const stateHandler = {
    set(target, property, value) {
        if (property === 'flags' && value && typeof value === 'object') {
            if (value.isInjured && !target.flags.isInjured) hapticPulse([40, 30, 80]);
            if (typeof value.madness === 'number' && value.madness > target.flags.madness) {
                hapticPulse(18);
                if (effectCanvas) effectCanvas.play(new NoiseCanvasEffect(500));
            }
        }
        target[property] = value;
        return true;
    }
};

let gameState = new Proxy({
    scene: 'prologue_1',
    textIndex: 0,
    flags: {
        hasPhoto: false,
        hasKnife: false,
        metMina: false,
        minaSaved: false,
        minaTrust: 0,
        isInjured: false,
        greed: false,
        madness: 0
    }
}, stateHandler);

function hapticPulse(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}

function notify(msg) {
    const area = getEl('notificationArea');
    if (!area) return;
    const node = document.createElement('div');
    node.className = 'notification-msg';
    node.textContent = msg;
    area.textContent = '';
    area.appendChild(node);
}

function registerItem(flagName) {
    const item = ITEM_CATALOG.get(flagName);
    if (item && !itemInventory.has(flagName)) {
        itemInventory.set(flagName, item);
        notify(`手に入れた：${item.label}`);
    }
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function preloadImage(src) {
    if (!src) return null;
    if (imageCache.has(src)) return imageCache.get(src);
    const pending = (async () => {
        const img = new Image();
        img.decoding = 'async';
        img.src = src;
        try {
            if (img.decode) await img.decode();
        } catch (_) {}
        return img;
    })();
    imageCache.set(src, pending);
    return pending;
}

function preloadNearby(sceneId) {
    const scene = scenarios[sceneId];
    if (!scene) return;
    const ids = [];
    if (scene.nextScene) ids.push(scene.nextScene);
    if (scene.trueScene) ids.push(scene.trueScene);
    if (scene.falseScene) ids.push(scene.falseScene);
    (scene.choices || []).forEach((choice) => ids.push(choice.nextScene));
    const run = () => {
        ids.forEach((id) => {
            const next = scenarios[id];
            if (!next) return;
            if (next.image) preloadImage(next.image);
            if (next.bgm) sound.prefetch(next.bgm);
        });
    };
    if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 900 });
    else setTimeout(run, 0);
}

function playKenBurns(src) {
    const img = getEl('backgroundImage');
    if (!img) return;
    if (kenAnim) {
        kenAnim.cancel();
        kenAnim = null;
    }
    img.style.transform = '';
    if (reducedMotion() || !img.animate) return;
    const key = (src || '').split('/').pop();
    const spec = KEN_BURNS[key];
    if (!spec) return;
    kenAnim = img.animate(
        [{ transform: spec.from }, { transform: spec.to }],
        { duration: spec.dur, fill: 'forwards', easing: 'linear' }
    );
}

function lineKey(sceneId, index) {
    return `${sceneId}:${index}`;
}

function syncWorldLook() {
    const root = document.documentElement;
    const screen = getEl('gameScreen');
    const purified = isSoftLightEnding();
    const madness = purified ? 0 : (gameState.flags.madness || 0);
    root.style.setProperty('--madness', String(madness));
    if (!screen) return;
    screen.classList.toggle('is-injured', !purified && !!gameState.flags.isInjured);
    screen.classList.toggle('is-mad', madness > 0);
}

function syncAtmosphere(sceneData, currentText) {
    const img = sceneData.image || '';
    if (isSoftLightEnding() && currentText && currentText.effect === 'white-out') {
        sound.setAmbient('none');
    } else if (img.includes('sick') || img.includes('remembered')) sound.setAmbient('rain');
    else if (img.includes('palece') || img.includes('maou') || img.includes('bridge') || img.includes('phantom') || img.includes('piero')) sound.setAmbient('castle');
    else if (img.includes('rouya') || img.includes('mina') || img.includes('minatenn') || img.includes('treasure')) sound.setAmbient('dungeon');
    else if (img.includes('forest') || img.includes('plant')) sound.setAmbient('forest');
    else sound.setAmbient('none');

    const injured = !!gameState.flags.isInjured;
    const madness = gameState.flags.madness || 0;
    let hz = 14000;
    if (injured) hz = 1600;
    if (madness > 0) hz = Math.min(hz, 2400 - madness * 400);
    if (isSoftLightEnding()) hz = 14000;
    sound.setLowpass(Math.max(240, hz));
}

function detectFx(currentText) {
    if (!currentText) return;
    const body = currentText.content || '';
    if (currentText.name === '効果音') {
        if (body.includes('プシュー')) sound.playFx('hiss');
        else if (body.includes('ガシャ')) sound.playFx('crash');
        else if (body.includes('バキ')) sound.playFx('snap');
    }
    if (body.includes('カツン')) sound.playFx('foot');
}

function classifyTransition(fromId, toId) {
    const from = scenarios[fromId];
    const to = scenarios[toId];
    if (!from || !to || from.image === to.image) return 'none';
    if (toId === 'castle_view') return 'iris';
    if ((from.image || '').includes('rouya') && (to.image || '').includes('mina')) return 'fade';
    return 'cross';
}

function setFlag(flagName) {
    if (!flagName) return;
    if (flagName === 'madness') {
        gameState.flags.madness = (gameState.flags.madness || 0) + 1;
        hapticPulse(18);
        if (effectCanvas) effectCanvas.play(new NoiseCanvasEffect(500));
    } else if (flagName === 'minaTrust') {
        gameState.flags.minaTrust = 1;
        gameState.flags.metMina = true;
    } else if (flagName === 'isInjured') {
        gameState.flags.isInjured = true;
        hapticPulse([40, 30, 80]);
    } else {
        gameState.flags[flagName] = true;
    }
    registerItem(flagName);
    syncWorldLook();
}

function persistProgress() {
    saveManager.save({
        scene: gameState.scene,
        textIndex: gameState.textIndex,
        flags: { ...gameState.flags },
        items: [...itemInventory.keys()],
        completed: [...completedScenes],
        seen: [...seenTexts],
        picked: [...pickedChoices],
        log: backlog.slice(-80)
    }).catch(() => {});
}

function flagGatePasses(sceneData) {
    if (sceneData.checkAll && sceneData.checkAll.length) {
        return sceneData.checkAll.every((name) => !!gameState.flags[name]);
    }
    if (sceneData.checkFlag) return !!gameState.flags[sceneData.checkFlag];
    return false;
}

function hasFlagGate(sceneData) {
    return !!(sceneData.checkFlag || (sceneData.checkAll && sceneData.checkAll.length));
}

function isSoftLightEnding() {
    return gameState.scene === 'end_true' || gameState.scene === 'end_remembered';
}

function checkCondition(sceneData) {
    if (hasFlagGate(sceneData) && !(sceneData.texts && sceneData.texts.length)) {
        const targetScene = flagGatePasses(sceneData) ? sceneData.trueScene : sceneData.falseScene;
        loadScene(targetScene);
        return true;
    }
    return false;
}

function playBgm(file) {
    sound.playBgm(file).catch(() => {});
}

function appendBacklog(name, content) {
    backlog.push({ name, content });
    if (backlog.length > 120) backlog.shift();
}

function renderBacklog() {
    const list = getEl('backlogList');
    if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    backlog.forEach((entry) => {
        const wrap = document.createElement('div');
        wrap.className = 'backlog-entry';
        const name = document.createElement('div');
        name.className = 'backlog-name';
        name.textContent = entry.name;
        const body = document.createElement('div');
        body.className = 'backlog-body';
        body.textContent = entry.content;
        wrap.appendChild(name);
        wrap.appendChild(body);
        list.appendChild(wrap);
    });
    list.scrollTop = list.scrollHeight;
}

function isBacklogOpen() {
    const panel = getEl('backlogPanel');
    return panel && !panel.classList.contains('hidden');
}

function setBacklogOpen(open) {
    const panel = getEl('backlogPanel');
    if (!panel) return;
    panel.classList.toggle('hidden', !open);
    if (open) renderBacklog();
}

function showEndingGate() {
    const gate = getEl('endingGate');
    if (gate) gate.classList.remove('hidden');
}

function loadScene(sceneId, skipTransition, keepTextIndex) {
    perf.mark(`scene-${sceneId}`);
    const sceneData = scenarios[sceneId];
    if (!sceneData) return;
    if (checkCondition(sceneData)) return;

    completedScenes.add(gameState.scene);
    gameState.scene = sceneId;
    if (!keepTextIndex) gameState.textIndex = 0;

    const bgImage = getEl('backgroundImage');
    if (bgImage) {
        bgImage.style.display = '';
        bgImage.setAttribute('src', sceneData.image);
        bgImage.classList.remove('is-fading');
        playKenBurns(sceneData.image);
    }

    playBgm(sceneData.bgm);

    const choicesContainer = getEl('choicesContainer');
    if (choicesContainer) choicesContainer.classList.add('hidden');
    const gate = getEl('endingGate');
    if (gate) gate.classList.add('hidden');

    const textWindow = getEl('textWindow');
    if (textWindow) textWindow.classList.remove('faded');

    const endingOverlay = getEl('endingOverlay');
    if (endingOverlay && !String(sceneId).startsWith('end_')) {
        endingOverlay.className = 'ending-overlay hidden';
    }

    perf.measure(`scene-${sceneId}`);
    persistProgress();
    syncWorldLook();
    renderText();
    preloadNearby(sceneId);

    if (!skipTransition && effectCanvas && classifyTransition([...completedScenes][completedScenes.size - 1], sceneId) === 'iris') {
        effectCanvas.play(new IrisWipeEffect(550));
    }
}

function renderText() {
    const sceneData = scenarios[gameState.scene];
    const currentText = sceneData.texts[gameState.textIndex];
    const noiseOverlay = getEl('noiseOverlay');
    const endingOverlay = getEl('endingOverlay');
    const textBox = getEl('gameText');
    const nameBox = getEl('speakerName');

    if (typewriter) typewriter.skip();

    if (currentText.effect === 'noise-stop' && noiseOverlay) noiseOverlay.classList.add('hidden');
    if (textBox) textBox.className = 'game-text';

    detectFx(currentText);
    syncAtmosphere(sceneData, currentText);

    if (currentText.effect === 'noise-start') {
        if (noiseOverlay) noiseOverlay.classList.remove('hidden');
        hapticPulse([20, 40, 20, 40, 60]);
        if (effectCanvas) effectCanvas.play(new NoiseCanvasEffect(1200));
        sound.setHeartbeat(true);
    }
    if (currentText.effect === 'noise-stop') sound.setHeartbeat(false);

    if (endingOverlay) {
        if (whiteSoftTimer) {
            clearTimeout(whiteSoftTimer);
            whiteSoftTimer = 0;
        }
        if (currentText.effect === 'white-out') {
            endingOverlay.classList.remove('hidden');
            endingOverlay.className = 'ending-overlay effect-white';
            const trueEnd = isSoftLightEnding();
            sound.applyEnding(trueEnd ? 'true' : 'white');
            whiteSoftTimer = setTimeout(() => {
                endingOverlay.className = trueEnd
                    ? 'ending-overlay effect-true-glow'
                    : 'ending-overlay effect-white-soft';
            }, 900);
        } else if (currentText.effect === 'black-out') {
            endingOverlay.classList.remove('hidden');
            endingOverlay.className = 'ending-overlay effect-black';
            sound.applyEnding(gameState.scene === 'end_bad_dead' ? 'silence' : 'black');
        }
    }

    if (currentText.textClass === 'shaking-text') hapticPulse([15, 25, 15]);
    if (currentText.textClass && textBox) textBox.classList.add(currentText.textClass);

    if (nameBox) {
        nameBox.textContent = currentText.name;
        nameBox.className = `speaker-name ${SPEAKER_CLASS[currentText.name] || ''}`;
    }

    appendBacklog(currentText.name, currentText.content);
    const key = lineKey(gameState.scene, gameState.textIndex);
    const fast = seenTexts.has(key);
    typewriter = new Typewriter(textBox, currentText.content, () => {
        seenTexts.add(key);
        typewriter = null;
        persistProgress();
    }, fast);
    typewriter.start();
}

function showChoices(choices) {
    const container = getEl('choicesContainer');
    const wrapper = container.querySelector('.choices-wrapper');
    if (!wrapper) return;
    while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);

    choices.forEach((choice, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'choice-item choice-appear game-btn';
        const remembered = pickedChoices.has(`${gameState.scene}::${choice.text}`);
        if (remembered) btn.classList.add('is-remembered');
        btn.textContent = choice.text;
        btn.style.animationDelay = `${i * 0.08}s`;

        const pick = () => {
            hapticPulse(12);
            sound.playTap();
            pickedChoices.add(`${gameState.scene}::${choice.text}`);
            if (choice.setFlag) setFlag(choice.setFlag);
            container.classList.add('hidden');
            loadSceneAsync(choice.nextScene);
        };

        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            btn.classList.add('is-pressed');
        });
        btn.addEventListener('pointerup', pick);
        btn.addEventListener('pointerleave', () => btn.classList.remove('is-pressed'));
        wrapper.appendChild(btn);
    });
    container.classList.remove('hidden');
}

async function loadSceneAsync(sceneId) {
    if (isTransitioning) return;
    isTransitioning = true;
    const fromId = gameState.scene;
    const kind = classifyTransition(fromId, sceneId);
    const bgImage = getEl('backgroundImage');
    try {
        await preloadImage(scenarios[sceneId] && scenarios[sceneId].image);
        if (kind === 'iris' && effectCanvas) {
            if (bgImage) bgImage.classList.add('is-fading');
            await effectCanvas.irisTransition();
        } else if (kind === 'fade' || kind === 'cross') {
            if (bgImage) bgImage.classList.add('is-fading');
            await wait(kind === 'fade' ? 420 : 280);
        }
        loadScene(sceneId, true);
    } finally {
        isTransitioning = false;
    }
}

function choicesVisible() {
    const el = getEl('choicesContainer');
    return el && !el.classList.contains('hidden');
}

function next(fromHold) {
    if (isTransitioning || isBacklogOpen()) return;
    if (choicesVisible()) return;
    const gate = getEl('endingGate');
    if (gate && !gate.classList.contains('hidden')) return;

    if (typewriter && !typewriter.done) {
        if (fromHold && !seenTexts.has(lineKey(gameState.scene, gameState.textIndex))) return;
        typewriter.skip();
        sound.playTap();
        return;
    }

    const sceneData = scenarios[gameState.scene];
    if (!sceneData) return;

    sound.playTap();
    hapticPulse(8);

    if (gameState.textIndex < sceneData.texts.length - 1) {
        gameState.textIndex += 1;
        renderText();
        persistProgress();
    } else if (sceneData.choices) {
        showChoices(sceneData.choices);
    } else if (hasFlagGate(sceneData)) {
        const target = flagGatePasses(sceneData) ? sceneData.trueScene : sceneData.falseScene;
        loadSceneAsync(target);
    } else if (sceneData.nextScene) {
        if (sceneData.setFlag) setFlag(sceneData.setFlag);
        loadSceneAsync(sceneData.nextScene);
    } else {
        showEndingGate();
    }
}

async function requestWakeLock() {
    try {
        if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    } catch (_) {}
}

function bindTouchGuards() {
    document.addEventListener('touchmove', (e) => {
        if (e.target.closest('[data-scrollable]')) return;
        e.preventDefault();
    }, { passive: false });
    document.addEventListener('selectstart', (e) => e.preventDefault());
    document.addEventListener('dragstart', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    let lastTap = 0;
    document.addEventListener('touchstart', (e) => {
        const now = Date.now();
        if (now - lastTap < 300) e.preventDefault();
        lastTap = now;
    }, { passive: false });
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) e.preventDefault();
        lastTouchEnd = now;
    }, { passive: false });
}

function clearHold() {
    if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = 0;
    }
    if (holdInterval) {
        clearInterval(holdInterval);
        holdInterval = 0;
    }
}

function bindUi() {
    const muteBtn = getEl('muteBtn');
    if (muteBtn) {
        const syncMute = () => {
            muteBtn.textContent = sound.enabled ? '🔊' : '🔇';
        };
        syncMute();
        muteBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            muteBtn.classList.add('is-pressed');
            sound.setEnabled(!sound.enabled);
            syncMute();
            hapticPulse(10);
        });
        muteBtn.addEventListener('pointerup', () => muteBtn.classList.remove('is-pressed'));
    }

    const saveBtn = getEl('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            saveBtn.classList.add('is-pressed');
            persistProgress();
            notify('記憶を刻んだ');
            hapticPulse(15);
        });
        saveBtn.addEventListener('pointerup', () => saveBtn.classList.remove('is-pressed'));
    }

    const logBtn = getEl('logBtn');
    if (logBtn) {
        logBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            logBtn.classList.add('is-pressed');
            hapticPulse(12);
            setBacklogOpen(!isBacklogOpen());
        });
        logBtn.addEventListener('pointerup', () => logBtn.classList.remove('is-pressed'));
    }
    const logClose = getEl('backlogClose');
    if (logClose) {
        logClose.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            setBacklogOpen(false);
        });
    }

    const returnBtn = getEl('endingReturnBtn');
    if (returnBtn) {
        returnBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            hapticPulse(12);
            location.reload();
        });
    }
}

function bindResume() {
    const resume = () => {
        sound.ensureResumed().then(() => sound.restartBgmIfNeeded());
        requestWakeLock();
    };
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') resume();
    });
    window.addEventListener('pageshow', resume);
    window.addEventListener('focus', resume);
}

async function restoreIfSaved() {
    const data = await saveManager.load();
    const continueBtn = getEl('continueBtn');
    if (data && data.scene && continueBtn) {
        continueBtn.classList.remove('hidden');
        continueBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            hapticPulse(12);
            gameState.flags = { ...gameState.flags, ...data.flags };
            (data.items || []).forEach((key) => registerItem(key));
            (data.completed || []).forEach((id) => completedScenes.add(id));
            (data.seen || []).forEach((id) => seenTexts.add(id));
            (data.picked || []).forEach((id) => pickedChoices.add(id));
            if (Array.isArray(data.log)) {
                data.log.forEach((entry) => backlog.push(entry));
            }
            gameState.textIndex = data.textIndex || 0;
            startStory(data.scene, true);
        });
    }
}

function startStory(sceneId, resume) {
    const titleScreen = getEl('titleScreen');
    const gameScreen = getEl('gameScreen');
    if (titleScreen) {
        titleScreen.classList.add('hidden');
        titleScreen.classList.remove('active');
    }
    if (gameScreen) {
        gameScreen.classList.remove('hidden');
        gameScreen.classList.add('active');
    }
    sound.init();
    sound.ensureResumed();
    requestWakeLock();
    loadScene(sceneId || 'prologue_1', true, !!resume);
}

function initGame() {
    effectCanvas = new EffectCanvas(getEl('effectCanvas'));
    effectCanvas.resize();
    window.addEventListener('resize', () => effectCanvas.resize());
    window.addEventListener('orientationchange', () => effectCanvas.resize());

    bindTouchGuards();
    bindUi();
    bindResume();

    const gameScreen = getEl('gameScreen');
    const startBtn = getEl('startBtn');

    if (gameScreen) {
        gameScreen.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.choice-item, .ui-button, .backlog-panel, .ending-gate, .game-btn')) return;
            next(false);
            clearHold();
            holdTimer = setTimeout(() => {
                holdInterval = setInterval(() => next(true), 90);
            }, 420);
        });
        gameScreen.addEventListener('pointerup', clearHold);
        gameScreen.addEventListener('pointercancel', clearHold);
        gameScreen.addEventListener('pointerleave', clearHold);
    }

    if (startBtn) {
        startBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            hapticPulse(12);
            startStory('prologue_1');
        });
    }

    restoreIfSaved();
    preloadImage('./images/sick.png');
    preloadImage('./images/palece.png');

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
