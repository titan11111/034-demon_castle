/* =========================================
   0. 最新JS基盤 (#4-#10 Class / WebAudio / Canvas / IndexedDB / RAF / Performance)
   ========================================= */

const ITEM_CATALOG = new Map([
    ['hasPhoto', { label: '息子の写真', note: '胸ポケットに温もりが残る' }],
    ['hasKnife', { label: '護身用ナイフ', note: '冷たい刃が頼りになる' }],
    ['greed', { label: '赤い宝石', note: '魔王城の誘惑の欠片' }]
]);

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
        for (let i = 0; i < 120; i++) {
            ctx.fillStyle = `rgba(255,${Math.random() * 80 | 0},${Math.random() * 80 | 0},${alpha})`;
            ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
        }
    }
}

class SoundManager {
    constructor() {
        this.ctx = null;
        this.gain = null;
        this.bgmSource = null;
        this.bgmBuffer = null;
        this.bgmPath = '';
        this.enabled = localStorage.getItem('demon_castle_mute') !== '1';
        this.bufferCache = new Map();
    }

    init() {
        if (this.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.gain = this.ctx.createGain();
        this.gain.gain.value = this.enabled ? 0.4 : 0;
        this.gain.connect(this.ctx.destination);
        const silent = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = silent;
        src.connect(this.ctx.destination);
        src.start(0);
    }

    async ensureResumed() {
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    setEnabled(on) {
        this.enabled = on;
        localStorage.setItem('demon_castle_mute', on ? '0' : '1');
        if (this.gain) this.gain.gain.value = on ? 0.4 : 0;
    }

    async loadBuffer(path) {
        if (this.bufferCache.has(path)) return this.bufferCache.get(path);
        const res = await fetch(path);
        const data = await res.arrayBuffer();
        const buffer = await this.ctx.decodeAudioData(data);
        this.bufferCache.set(path, buffer);
        return buffer;
    }

    async playBgm(path) {
        if (!path || !this.ctx) return;
        if (this.bgmPath === path && this.bgmSource) return;
        await this.ensureResumed();
        if (this.bgmSource) {
            try { this.bgmSource.stop(0); } catch (_) {}
            this.bgmSource = null;
        }
        const buffer = await this.loadBuffer(path);
        this.bgmSource = this.ctx.createBufferSource();
        this.bgmSource.buffer = buffer;
        this.bgmSource.loop = true;
        this.bgmSource.connect(this.gain);
        this.bgmSource.start(0);
        this.bgmPath = path;
    }

    playTap() {
        if (!this.ctx || !this.enabled) return;
        const osc = this.ctx.createOscillator();
        const tapGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 880;
        tapGain.gain.value = 0.04;
        osc.connect(tapGain);
        tapGain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
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

    async hasSave() {
        const data = await this.load();
        return !!(data && data.scene);
    }
}

class PerformanceMonitor {
    mark(label) {
        performance.mark(`${label}-start`);
    }
    measure(label) {
        performance.mark(`${label}-end`);
        performance.measure(label, `${label}-start`, `${label}-end`);
        const entries = performance.getEntriesByName(label);
        const last = entries[entries.length - 1];
        return last ? last.duration : 0;
    }
}

class Typewriter {
    constructor(el, text, onDone) {
        this.el = el;
        this.text = text;
        this.onDone = onDone;
        this.index = 0;
        this.done = false;
        this.last = 0;
        this.rafId = 0;
        this.interval = 26;
    }
    start() {
        this.el.textContent = '';
        this.rafId = requestAnimationFrame((t) => this.tick(t));
    }
    tick(now) {
        if (!this.last) this.last = now;
        if (now - this.last >= this.interval) {
            this.last = now;
            this.index += 1;
            this.el.textContent = this.text.slice(0, this.index);
            if (this.index >= this.text.length) {
                this.finish();
                return;
            }
        }
        this.rafId = requestAnimationFrame((t) => this.tick(t));
    }
    skip() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.el.textContent = this.text;
        this.finish();
    }
    finish() {
        this.done = true;
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
            if (this.active.isFinished(now)) {
                this.active = null;
            }
        }
        this.rafId = this.active ? requestAnimationFrame(() => this.loop()) : 0;
    }
    async irisTransition() {
        return new Promise((resolve) => {
            const effect = new IrisWipeEffect(700);
            const start = performance.now();
            const tick = (now) => {
                const w = this.canvas.clientWidth;
                const h = this.canvas.clientHeight;
                this.ctx.clearRect(0, 0, w, h);
                const p = effect.progress(now);
                effect.draw(this.ctx, w, h, p < 0.5 ? p * 2 : 2 - p * 2);
                if (now - start < 700) {
                    requestAnimationFrame(tick);
                } else {
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
let effectCanvas = null;
let typewriter = null;
let isTransitioning = false;

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

/* =========================================
   1. グローバル変数・状態管理
   ========================================= */

// 【最新技術 #1】Proxy オブジェクト - ゲーム状態管理
const stateHandler = {
    set(target, property, value) {
        if (property === 'flags' && value && typeof value === 'object') {
            if (value.isInjured && !target.flags.isInjured) {
                hapticPulse([40, 30, 80]);
            }
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

// 【最新技術 #2】Map/Set - 効率的なデータ構造
const itemInventory = new Map();
const completedScenes = new Set();

const getEl = (id) => document.getElementById(id);
   
   /* =========================================
      2. シナリオデータ (セラ削除・孤独な戦い版)
      ========================================= */
   const scenarios = {
       // ---------------------------------------------------------
       // 【序章：出発】
       // ---------------------------------------------------------
       'prologue_1': {
           bgm: './audio/Dust_city.mp3',
           image: './images/sick.png',
           texts: [
               { name: "主人公", content: "（窓の外では、冷たい雨が降り続いている……）" },
               { name: "主人公", content: "（原因不明の熱病が息子を襲ってから、もう三日が過ぎた。医者も匙を投げた状態だ。）" },
               { name: "息子", content: "「……うぅ……ママ……苦しいよ……」" },
               { name: "主人公", content: "「大丈夫よ。ここにいるわ。……代わってあげられなくて、ごめんね」" },
               { name: "主人公", content: "息子の体は火のように熱い。伝説の『万魔の雫』を手に入れなければ、この子は助からない。" }
           ],
           nextScene: 'prologue_selection'
       },
       'prologue_selection': { 
           bgm: './audio/Dust_city.mp3',
           image: './images/sick.png',
           texts: [
               { name: "主人公", content: "旅支度を整える。鞄にはもう、あと一つしか物が入らない。" },
               { name: "主人公", content: "何を持っていくべきだろうか……？" }
           ],
           choices: [
               { text: "息子の写真", nextScene: 'prologue_end', setFlag: 'hasPhoto' },
               { text: "護身用ナイフ", nextScene: 'prologue_end', setFlag: 'hasKnife' }
           ]
       },
       'prologue_end': {
           bgm: './audio/Dust_city.mp3',
           image: './images/sick.png',
           texts: [
               { name: "主人公", content: "「……行ってくるね。必ず、お薬を持ち帰るから」" },
               { name: "息子", content: "「……ママ……いかないで……」" },
               { name: "主人公", content: "後ろ髪を引かれる思いを断ち切り、私は扉を閉めた。" }
           ],
           nextScene: 'forest_entry'
       },
   
       // ---------------------------------------------------------
       // 【第1章：帰らずの森】
       // ---------------------------------------------------------
       'forest_entry': {
           bgm: './audio/Dust_city.mp3',
           image: './images/forest.png',
           texts: [
               { name: "主人公", content: "ここが『帰らずの森』……肌を刺すような瘴気（しょうき）が漂っている。" },
               { name: "主人公", content: "目の前には二つの道があった。" }
           ],
           nextScene: 'branch_path'
       },
       'branch_path': {
           bgm: './audio/Dust_city.mp3',
           image: './images/forest.png',
           texts: [
               { name: "主人公", content: "どちらへ進もうか？" }
           ],
           choices: [
               { text: "獣道のような暗い近道", nextScene: 'forest_fruit' },
               { text: "安全だが遠回りな道", nextScene: 'forest_fruit', setFlag: 'lateArrival' }
           ]
       },
       'forest_fruit': { 
           bgm: './audio/Dust_city.mp3',
           image: './images/forest.png',
           texts: [
               { name: "主人公", content: "何時間歩いただろう。空腹で目が回りそうだ。" },
               { name: "主人公", content: "目の前に、毒々しい色だが甘そうな香りの果実がある。" },
               { name: "主人公", content: "（食べたら楽になれるかもしれない……でも、嫌な予感がする）" }
           ],
           choices: [
               { text: "構わず食べる", nextScene: 'forest_plant', setFlag: 'ateFruit' },
               { text: "我慢する", nextScene: 'forest_plant', setFlag: 'starving' }
           ]
       },
       'forest_plant': { 
           bgm: './audio/Dust_city.mp3',
           image: './images/plant.png', // 変更: 植物の画像を使用
           texts: [
               { name: "主人公", content: "その時、巨大な植物の蔦（ツタ）が襲いかかってきた！" },
               { name: "主人公", content: "「嘘……生きてるの！？」" }
           ],
           choices: [
               { text: "武器で切り払う！", nextScene: 'plant_fight_check' }, 
               { text: "必死に逃げる！", nextScene: 'plant_escape' }
           ]
       },
       // --- 判定用シーン ---
       'plant_fight_check': {
           checkFlag: 'hasKnife',
           trueScene: 'plant_win',
           falseScene: 'plant_fail'
       },
       'plant_win': {
           bgm: './audio/Dust_city.mp3',
           image: './images/forest.png',
           texts: [
               { name: "主人公", content: "私は持ってきたナイフを一閃させた！" },
               { name: "主人公", content: "蔦は悲鳴のような音を上げて千切れ飛ぶ。" },
               { name: "主人公", content: "「はぁ、はぁ……持ってきてよかった……」" }
           ],
           nextScene: 'castle_view'
       },
       'plant_fail': {
           bgm: './audio/Dust_city.mp3',
           image: './images/forest.png',
           texts: [
               { name: "主人公", content: "武器がない！ 私は素手で蔦を引き剥がそうとした。" },
               { name: "主人公", content: "「ぐっ……痛いッ！」", textClass: "shaking-text" },
               { name: "主人公", content: "蔦が皮膚に食い込む。私は悲鳴を上げながら、無理やり体をひねって脱出した。" },
               { name: "主人公", content: "なんとか逃げ切ったが、腕に深い傷を負ってしまった……。" }
           ],
           nextScene: 'castle_view',
           setFlag: 'isInjured'
       },
       'plant_escape': {
           bgm: './audio/Dust_city.mp3',
           image: './images/forest.png',
           texts: [
               { name: "主人公", content: "私は泥だらけになりながら、無我夢中で走り抜けた。" },
               { name: "主人公", content: "体力を激しく消耗してしまったが、命だけは助かったようだ。" }
           ],
           nextScene: 'castle_view',
           setFlag: 'starving'
       },
   
       // ---------------------------------------------------------
       // 【第2章：魔王城・侵入】
       // ---------------------------------------------------------
       'castle_view': {
           bgm: './audio/casle.mp3',
           image: './images/palece.png',
           texts: [
               { name: "主人公", content: "森を抜けると、雷鳴と共に巨大な魔王城が姿を現した。" },
               { name: "主人公", content: "あそこに、あの子を救う薬がある……！" }
           ],
           nextScene: 'castle_gate'
       },
       'castle_gate': {
           bgm: './audio/casle.mp3',
           image: './images/palece.png',
           texts: [
               { name: "主人公", content: "巨大な門。鍵はかかっていないが、不自然な静けさだ。" }
           ],
           choices: [
               { text: "構わず扉を押し開ける", nextScene: 'gate_trap' },
               { text: "周囲を慎重に調べる", nextScene: 'gate_safe' }
           ]
       },
       'gate_trap': {
           bgm: './audio/casle.mp3',
           image: './images/palece.png',
           texts: [
               { name: "効果音", content: "プシューッ！" },
               { name: "主人公", content: "「きゃあっ！？」扉の隙間から毒霧が噴き出した。" },
               { name: "主人公", content: "「げほっ、ごほっ！ ……毒……！？」" },
               { name: "主人公", content: "口元を袖で覆い、這いつくばって煙の下をくぐり抜ける。喉が焼けるように痛い。" }
           ],
           nextScene: 'corridor_encounter',
           setFlag: 'isInjured'
       },
       'gate_safe': {
           bgm: './audio/casle.mp3',
           image: './images/palece.png',
           texts: [
               { name: "主人公", content: "よく見ると、扉の足元に細いワイヤーが張ってあった。" },
               { name: "主人公", content: "これを外して……よし。安全に中へ入れるわ。" }
           ],
           nextScene: 'corridor_encounter'
       },
   
       'corridor_encounter': { 
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/gaikotu.png', // 変更: 骸骨の画像を使用
           texts: [
               { name: "主人公", content: "城内は冷え切っている。……前方から、カツン、カツンと硬質な足音が聞こえてきた。" },
               { name: "主人公", content: "（骸骨の兵士……！ 見つかったら殺される）" }
           ],
           choices: [
               { text: "物陰に隠れてやり過ごす", nextScene: 'hide_success' },
               { text: "背後から不意打ちする", nextScene: 'attack_guard' }
           ]
       },
       'hide_success': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/rouya.png',
           texts: [
               { name: "主人公", content: "息を殺して柱の陰に隠れる。兵士は気づかずに通り過ぎていった。" }
           ],
           nextScene: 'treasure_room'
       },
       'attack_guard': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/gaikotu.png', // 変更: 骸骨の画像を使用
           texts: [
               { name: "主人公", content: "私は近くにあった燭台を掴み、骸骨の頭蓋を打ち砕いた！" },
               { name: "効果音", content: "ガシャァン！！" },
               { name: "主人公", content: "「はぁ、はぁ……ごめんね。でも、通らなきゃいけないの」" },
               { name: "主人公", content: "（あの子のためなら、私は鬼にだってなる）" }
           ],
           nextScene: 'treasure_room',
           setFlag: 'madness' // 狂気度アップ
       },
   
       'treasure_room': { 
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/rouya.png',
           texts: [
               { name: "主人公", content: "通りがかった部屋には、山のような金銀財宝が積まれていた。" },
               { name: "主人公", content: "（これがあれば、街一番の医者を雇える……いや、一生遊んで暮らせるかも……）" }
           ],
           choices: [
               { text: "宝石をひとつだけ盗む", nextScene: 'steal_gem', setFlag: 'greed' },
               { text: "目もくれずに先へ進む", nextScene: 'ignore_gem' }
           ]
       },
       'steal_gem': { 
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/piero.png', 
           texts: [
               { name: "主人公", content: "魔除けになりそうな赤い宝石をポケットに入れた。その時——" },
               { name: "ピエロ", content: "「おやおや、また一つ『愛』を『執着』と履き違えましたねぇ？」" },
               { name: "主人公", content: "「！？ 誰！？」" },
               { name: "ピエロ", content: "「ククク……その必死な顔、最高の余興ですよ、お母さん」", textClass: "shaking-text" },
               { name: "主人公", content: "不気味な道化師は、煙のように消え失せた。……ただの幻覚だったのだろうか。" }
           ],
           nextScene: 'dungeon_entry'
       },
       'ignore_gem': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/rouya.png',
           texts: [
               { name: "主人公", content: "今は金銭など無価値だ。必要なのは息子の命を繋ぐ薬だけ。" },
               { name: "主人公", content: "私は迷わず部屋を出た。" }
           ],
           nextScene: 'dungeon_entry'
       },
   
       // ---------------------------------------------------------
       // 【第3章：地下牢のミナ】
       // ---------------------------------------------------------
       'dungeon_entry': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/rouya.png',
           texts: [
               { name: "主人公", content: "地下から、誰かのすすり泣く声が聞こえる……。" },
               { name: "主人公", content: "導かれるように地下牢へ降りると、青白く光る少女の霊がいた。" }
           ],
           nextScene: 'meet_mina'
       },
       'meet_mina': { 
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/mina.png',
           texts: [
               { name: "ミナ", content: "「ひっ……こ、来ないで……痛いのは嫌……」" },
               { name: "主人公", content: "少女は怯えている。どう接しようか？" }
           ],
           choices: [
               { text: "優しく声をかける", nextScene: 'mina_friend', setFlag: 'metMina' },
               { text: "警戒して距離を取る", nextScene: 'mina_wary' }
           ]
       },
       'mina_friend': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/mina.png',
           texts: [
               { name: "主人公", content: "「怖くないわ。私はあなたを傷つけたりしない」" },
               { name: "ミナ", content: "「……本当？ おばさん……ううん、お姉さん、優しい目をしているのね」" },
               { name: "ミナ", content: "「私はミナ。この城の抜け道を教えてあげる」" }
           ],
           nextScene: 'mina_shortcut_offer',
           setFlag: 'minaTrust'
       },
       'mina_wary': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/mina.png',
           texts: [
               { name: "主人公", content: "（罠かもしれない）私はナイフを隠し持ちながら様子を伺った。" },
               { name: "ミナ", content: "「……あなたも、魔王様の手下なのね。……あっちへ行って」" },
               { name: "主人公", content: "少女は姿を消してしまった。" }
           ],
           nextScene: 'stairs_climb'
       },
       'mina_shortcut_offer': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/mina.png',
           texts: [
               { name: "ミナ", content: "「こっちの『死者の谷』を通れば、玉座の裏まで行けるわ」" },
               { name: "主人公", content: "（……あんな危険な場所を？ でも、時間を短縮できるかもしれない）" }
           ],
           choices: [
               { text: "ミナを信じて近道を行く", nextScene: 'shortcut_bridge' },
               { text: "正規ルート（階段）を行く", nextScene: 'stairs_climb' }
           ]
       },
       'shortcut_bridge': { 
           bgm: './audio/casle.mp3',
           image: './images/palece.png',
           texts: [
               { name: "主人公", content: "ミナの案内で古びた吊り橋を渡る。" },
               { name: "効果音", content: "バキッ！" },
               { name: "主人公", content: "「きゃあっ！」足場が崩れた！ ミナが手を伸ばしてくれている！" }
           ],
           choices: [
               { text: "ミナの手を掴む", nextScene: 'shortcut_success' },
               { text: "自力で向こう岸へ跳ぶ", nextScene: 'shortcut_fail' }
           ]
       },
       'shortcut_success': {
           bgm: './audio/casle.mp3',
           image: './images/mina.png',
           texts: [
               { name: "主人公", content: "私はミナの手を掴んだ！ 霊体のはずなのに、確かな温もりがあった。" },
               { name: "ミナ", content: "「よかった……！ お母さん、怪我はない！？」" },
               { name: "主人公", content: "足首を捻ってしまったが、ミナとの絆は深まった気がする。" }
           ],
           nextScene: 'throne_room',
           setFlag: 'minaSaved'
       },
       'shortcut_fail': {
           bgm: './audio/casle.mp3',
           image: './images/palece.png',
           texts: [
               { name: "主人公", content: "私は反射的に対岸へ飛び移った。" },
               { name: "ミナ", content: "「あっ……」" },
               { name: "主人公", content: "ミナは崩れた橋と共に谷底へ落ちていく……いや、霧散して消えてしまった。" },
               { name: "主人公", content: "（ごめん……でも、私は生きなきゃいけないの）" }
           ],
           nextScene: 'throne_room'
       },
       'stairs_climb': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/rouya.png',
           texts: [
               { name: "主人公", content: "長い長い階段を登り続ける。足が棒のようだ。" },
               { name: "主人公", content: "（急がないと……あの子の命が……）" }
           ],
           nextScene: 'throne_room'
       },
   
       // ---------------------------------------------------------
       // 【第4章：試練】
       // ---------------------------------------------------------
       'throne_room': {
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "主人公", content: "扉を開け放つと、玉座には闇を纏った魔王が座していた。" },
               { name: "魔王", content: "「……人間か。死に損ないの小娘の匂いがするな」" },
               { name: "主人公", content: "「薬をちょうだい！ 対価なら払うわ！」" }
           ],
           nextScene: 'demon_dialogue_1'
       },
       'demon_dialogue_1': { 
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "魔王", content: "「なぜそこまでして息子を生かそうとする？ 人はいずれ死ぬ運命だ。早いか遅いかの違いでしかない」" }
           ],
           choices: [
               { text: "「親が子を守るのは本能よ」", nextScene: 'dialogue_logic' },
               { text: "「理屈じゃない！ 愛しているからよ」", nextScene: 'dialogue_emotion' }
           ]
    
       },
       'dialogue_logic': {
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "主人公", content: "「親が子を守るのは生物としての本能よ。理屈なんてないわ」" },
               { name: "魔王", content: "「ほう、本能か。獣と同じだな」" }
           ],
           nextScene: 'demon_dialogue_2'
       },
       'dialogue_emotion': {
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "主人公", content: "「理屈なんてどうでもいい！ 愛しているからよ！ あなたに愛は分からないの！？」" },
               { name: "魔王", content: "「……愛、か。もっとも脆く、裏切りやすい感情だ」" }
           ],
           nextScene: 'demon_dialogue_2'
       },
       'demon_dialogue_2': { 
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "魔王", content: "「仮に薬を持ち帰り、息子が生き延びたとしよう。だが成長した息子が、老いたお前を邪魔者扱いし、捨てたらどうする？」" }
           ],
           choices: [
               { text: "それでも構わない", nextScene: 'demon_trial_start', setFlag: 'pureLove' },
               { text: "そんなことはさせない", nextScene: 'demon_trial_start', setFlag: 'yandere' }
           ]
       },
       'demon_trial_start': { 
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "魔王", content: "「口では何とでも言える。……試してやろう。貴様の精神を破壊する『絶望の幻影』を！」" },
               { name: "主人公", content: "視界が歪む。……そこには、元気に成長した息子の姿があった。", effect: "noise-start" },
               { name: "幻影の息子", content: "『うざいんだよババア！ さっさと死ねよ！』", textClass: "shaking-text" },
               { name: "主人公", content: "「！！ ……あ、ああ……」" }
           ],
           checkFlag: 'hasPhoto', 
           trueScene: 'trial_photo_bonus',
           falseScene: 'trial_no_item'
       },
       'trial_photo_bonus': {
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "主人公", content: "心が折れそうになったその時、ポケットの写真が熱を持った。" },
               { name: "主人公", content: "（違う……これは幻よ。あの子は、こんな事言わない！）" },
               { name: "主人公", content: "私は写真を握りしめ、幻影を睨み返した！" }
           ],
           nextScene: 'final_choice'
       },
       'trial_no_item': {
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "主人公", content: "言葉の刃が胸に突き刺さる。" },
               { name: "主人公", content: "（私が死ねば、あの子は自由になれるの……？）" },
               { name: "主人公", content: "「……いいえ、違う！ これは魔王の見せる幻よ！」" },
               { name: "主人公", content: "ギリギリのところで自我を保つ。だが、精神はボロボロだ。" }
           ],
           nextScene: 'final_choice'
       },
   
       // ---------------------------------------------------------
       // 【最終章：決断】
       // ---------------------------------------------------------
       'final_choice': { 
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "魔王", content: "「ほう、耐え抜くか。……よかろう、薬はやろう」", effect: "noise-stop" },
               { name: "魔王", content: "「ただし代償が必要だ。貴様の『息子に関する記憶』を全て置いていけ」" },
               { name: "主人公", content: "「えっ……？」" },
               { name: "魔王", content: "「息子は助かる。だがお前は、自分が誰を助けたのか、なぜここにいるのかも忘れるのだ」" }
           ],
           choices: [
               { text: "記憶を差し出す", nextScene: 'end_memory_loss' },
               { text: "ふざけるなと拒絶する", nextScene: 'battle_start' }
           ]
       },
   
       // --- 【エンディング演出追加・修正版】 ---
       'end_memory_loss': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/minatenn.png',
           texts: [
               { name: "主人公", content: "「……わかったわ。あの子が助かるなら、私の思い出なんて安いものよ」" },
               { name: "魔王", content: "「契約成立だ」" },
               { name: "システム", content: "……視界が白く染まっていく。", effect: "white-out" }, 
               { name: "？？？", content: "「ママ？ ママ！ 起きて！」" },
               { name: "私", content: "「……あなたは、だぁれ？ どうして泣いているの？」" },
               { name: "システム", content: "〜 BAD END? : 母の愛はどこへ 〜", textClass: "text-blood" } 
           ],
           nextScene: null
       },
       'battle_start': {
           bgm: './audio/casle.mp3',
           image: './images/maou.png',
           texts: [
               { name: "主人公", content: "「記憶を奪ったら、あの子を愛し続けられない！ そんな条件、呑めるもんですか！」" },
               { name: "魔王", content: "「ならば死ね」" },
               { name: "主人公", content: "魔王の魔力が膨れ上がる。勝てるはずがない。でも……！" }
           ],
           choices: [
               { text: "ミナの助けを呼ぶ", nextScene: 'battle_mina_check' },
               { text: "自分自身の魂を燃やす", nextScene: 'end_sacrifice' }
           ]
       },
       'battle_mina_check': {
           checkFlag: 'minaSaved', 
           trueScene: 'end_true',
           falseScene: 'end_bad_dead'
       },
       'end_true': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/minatenn.png',
           texts: [
               { name: "主人公", content: "「ミナ！ お願い、力を貸して！」" },
               { name: "ミナ", content: "「待ってました！ お母さんの勇気、私が守る！」" },
               { name: "システム", content: "まばゆい光が魔王の闇を切り裂く。ミナが身を挺して魔王の動きを封じた！", effect: "white-out" }, 
               { name: "魔王", content: "「ぬぅ……死人の分際で……！」" },
               { name: "主人公", content: "その隙に、私は祭壇の薬を掴み取り、出口へと走り出した！" },
               { name: "息子", content: "「……ママ、おかえり」" },
               { name: "主人公", content: "「ただいま。……愛してるわ」" },
               { name: "システム", content: "〜 TRUE END : 奇跡の生還 〜", textClass: "text-gold" } 
           ],
           nextScene: null
       },
       'end_sacrifice': {
           bgm: './audio/Songs_of_the_Soulless.mp3',
           image: './images/sick.png',
           texts: [
               { name: "主人公", content: "私は自分の生命力を魔力に変えて特攻した。" },
               { name: "主人公", content: "相打ち覚悟の一撃が、魔王の仮面を砕く。" },
               { name: "魔王", content: "「……見事だ。褒美に薬をやろう。ただし、お前の命は尽きる」" },
               { name: "主人公", content: "薄れゆく意識の中で、薬を握りしめ、出口へと這いずり始めた。", effect: "black-out" }, 
               { name: "主人公", content: "（あの子に……渡すまでは……死ねない……！）" },
               { name: "システム", content: "〜 NORMAL END : 母の執念 〜" }
           ],
           nextScene: null
       },
       'end_bad_dead': {
           bgm: null,
           image: './images/maou.png',
           texts: [
               { name: "主人公", content: "「ミナ……！」" },
               { name: "システム", content: "しかし、誰も答えない。あの時、見捨ててしまったからだ。" },
               { name: "魔王", content: "「誰も助けには来ぬ。孤独に死ね」", effect: "black-out" }, 
               { name: "システム", content: "〜 BAD END : 孤独な最期 〜", textClass: "scream-text" }
           ],
           nextScene: null
       }
   };
   
   /* =========================================
      3. 関数定義 (システム更新)
      ========================================= */

   function playBgm(file) {
       sound.playBgm(file).catch(() => {});
   }

   function playSe() {
       sound.playTap();
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
   }

   function persistProgress() {
       saveManager.save({
           scene: gameState.scene,
           textIndex: gameState.textIndex,
           flags: { ...gameState.flags },
           items: [...itemInventory.keys()],
           completed: [...completedScenes]
       }).catch(() => {});
   }

   function checkCondition(sceneData) {
       if (sceneData.checkFlag) {
           const isTrue = gameState.flags[sceneData.checkFlag];
           const targetScene = isTrue ? sceneData.trueScene : sceneData.falseScene;
           loadScene(targetScene);
           return true;
       }
       return false;
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
       }

       playBgm(sceneData.bgm);

       const choicesContainer = getEl('choicesContainer');
       if (choicesContainer) choicesContainer.classList.add('hidden');

       const textWindow = getEl('textWindow');
       if (textWindow) textWindow.classList.remove('faded');

       const endingOverlay = getEl('endingOverlay');
       if (endingOverlay) {
           endingOverlay.className = 'ending-overlay hidden';
       }

       perf.measure(`scene-${sceneId}`);

       persistProgress();
       renderText();

       if (!skipTransition && effectCanvas) {
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

       if (noiseOverlay) noiseOverlay.classList.add('hidden');
       if (textBox) textBox.className = 'game-text';

       if (currentText.se) playSe();

       if (currentText.effect === 'noise-start' && noiseOverlay) {
           noiseOverlay.classList.remove('hidden');
           hapticPulse([20, 40, 20, 40, 60]);
           if (effectCanvas) effectCanvas.play(new NoiseCanvasEffect(1200));
       }

       if (endingOverlay) {
           if (currentText.effect === 'white-out') {
               endingOverlay.classList.remove('hidden');
               endingOverlay.classList.add('effect-white');
           } else if (currentText.effect === 'black-out') {
               endingOverlay.classList.remove('hidden');
               endingOverlay.classList.add('effect-black');
           }
       }

       if (currentText.textClass === 'shaking-text') {
           hapticPulse([15, 25, 15]);
       }

       if (currentText.textClass && textBox) textBox.classList.add(currentText.textClass);
       if (nameBox) nameBox.textContent = currentText.name;

       typewriter = new Typewriter(textBox, currentText.content, () => {
           typewriter = null;
       });
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
           btn.textContent = choice.text;
           btn.style.animationDelay = `${i * 0.08}s`;

           const pick = () => {
               hapticPulse(12);
               sound.playTap();
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

   // 【最新技術 #3】Async/Await - シーン遷移制御
   async function loadSceneAsync(sceneId) {
       if (isTransitioning) return;
       isTransitioning = true;
       try {
           const bgImage = getEl('backgroundImage');
           if (bgImage) bgImage.classList.add('is-fading');
           if (effectCanvas) await effectCanvas.irisTransition();
           loadScene(sceneId, true);
       } finally {
           isTransitioning = false;
       }
   }

   function next() {
       if (isTransitioning) return;

       const choicesContainer = getEl('choicesContainer');
       if (choicesContainer && !choicesContainer.classList.contains('hidden')) return;

       if (typewriter && !typewriter.done) {
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
       } else if (sceneData.nextScene) {
           if (sceneData.setFlag) setFlag(sceneData.setFlag);
           loadSceneAsync(sceneData.nextScene);
       } else if (confirm('物語は結末を迎えました。タイトルへ戻りますか？')) {
           location.reload();
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
       loadScene(sceneId || 'prologue_1', true, !!resume);
   }

   function bindTouchGuards() {
       document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
       document.addEventListener('selectstart', (e) => e.preventDefault());
       document.addEventListener('dragstart', (e) => e.preventDefault());
       document.addEventListener('contextmenu', (e) => e.preventDefault());
       let lastTouchEnd = 0;
       document.addEventListener('touchend', (e) => {
           const now = Date.now();
           if (now - lastTouchEnd <= 300) e.preventDefault();
           lastTouchEnd = now;
       }, false);
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
               sound.setEnabled(!sound.enabled);
               syncMute();
               hapticPulse(10);
           });
       }

       const saveBtn = getEl('saveBtn');
       if (saveBtn) {
           saveBtn.addEventListener('pointerdown', (e) => {
               e.preventDefault();
               persistProgress();
               notify('記憶を刻んだ');
               hapticPulse(15);
           });
       }
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
               gameState.textIndex = data.textIndex || 0;
               startStory(data.scene, true);
           });
       }
   }

   /* =========================================
      4. 初期化
      ========================================= */
   function initGame() {
       effectCanvas = new EffectCanvas(getEl('effectCanvas'));
       effectCanvas.resize();
       window.addEventListener('resize', () => effectCanvas.resize());
       window.addEventListener('orientationchange', () => effectCanvas.resize());

       bindTouchGuards();
       bindUi();

       const gameScreen = getEl('gameScreen');
       const startBtn = getEl('startBtn');

       if (gameScreen) {
           gameScreen.addEventListener('pointerdown', (e) => {
               if (e.target.closest('.choice-item, .ui-button')) return;
               next();
           });
       }

       if (startBtn) {
           startBtn.addEventListener('pointerdown', (e) => {
               e.preventDefault();
               hapticPulse(12);
               startStory('prologue_1');
           });
       }

       restoreIfSaved();

       if ('serviceWorker' in navigator) {
           navigator.serviceWorker.register('./sw.js').catch(() => {});
       }
   }

   if (document.readyState === 'loading') {
       document.addEventListener('DOMContentLoaded', initGame);
   } else {
       initGame();
   }
