/* Web Audio: BGMクロスフェード / 生成SE / 雨・残響・心拍 */
class SoundManager {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.filter = null;
        this.bgmBus = null;
        this.seGain = null;
        this.ambientGain = null;
        this.reverbGain = null;
        this.slots = [];
        this.active = 0;
        this.bgmPath = '';
        this.enabled = localStorage.getItem('demon_castle_mute') !== '1';
        this.bufferCache = new Map();
        this.ambientMode = '';
        this.heartbeatOn = false;
        this.hbTimer = 0;
        this.rainSource = null;
        this.rainFilter = null;
        this.lowpassHz = 14000;
        this.bgmToken = 0;
    }

    init() {
        if (this.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? 1 : 0;
        this.master.connect(this.ctx.destination);

        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = this.lowpassHz;
        this.bgmBus = this.ctx.createGain();
        this.bgmBus.gain.value = 0.38;
        this.bgmBus.connect(this.filter);
        this.filter.connect(this.master);

        this.slots = [0, 1].map(() => {
            const gain = this.ctx.createGain();
            gain.gain.value = 0;
            gain.connect(this.bgmBus);
            return { source: null, gain, path: '' };
        });

        this.seGain = this.ctx.createGain();
        this.seGain.gain.value = 0.32;
        this.seGain.connect(this.master);

        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = 0.1;
        this.ambientGain.connect(this.master);

        const conv = this.ctx.createConvolver();
        conv.buffer = this.makeImpulse(1.6);
        this.reverbGain = this.ctx.createGain();
        this.reverbGain.gain.value = 0;
        this.reverbGain.connect(conv);
        conv.connect(this.master);

        this.rainBuffer = this.makeNoise(2, 0.97);
        this.seHiss = this.makeNoise(0.5, 0.4);
        this.seCrash = this.makeNoise(0.35, 0.2);
        const silent = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = silent;
        src.connect(this.ctx.destination);
        src.start(0);
    }

    makeImpulse(seconds) {
        const rate = this.ctx.sampleRate;
        const len = Math.floor(rate * seconds);
        const buf = this.ctx.createBuffer(2, len, rate);
        for (let c = 0; c < 2; c++) {
            const data = buf.getChannelData(c);
            for (let i = 0; i < len; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
            }
        }
        return buf;
    }

    makeNoise(seconds, brown) {
        const rate = this.ctx.sampleRate;
        const len = Math.floor(rate * seconds);
        const buf = this.ctx.createBuffer(1, len, rate);
        const data = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
            last = last * brown + (Math.random() * 2 - 1) * (1 - brown);
            data[i] = last;
        }
        return buf;
    }

    async ensureResumed() {
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    setEnabled(on) {
        this.enabled = on;
        localStorage.setItem('demon_castle_mute', on ? '0' : '1');
        if (this.master) {
            const now = this.ctx.currentTime;
            this.master.gain.cancelScheduledValues(now);
            this.master.gain.setValueAtTime(this.master.gain.value, now);
            this.master.gain.linearRampToValueAtTime(on ? 1 : 0, now + 0.08);
        }
    }

    setLowpass(hz) {
        this.lowpassHz = hz;
        if (!this.filter || !this.ctx) return;
        const now = this.ctx.currentTime;
        this.filter.frequency.cancelScheduledValues(now);
        this.filter.frequency.setValueAtTime(this.filter.frequency.value, now);
        this.filter.frequency.linearRampToValueAtTime(hz, now + 0.45);
    }

    async loadBuffer(path) {
        if (this.bufferCache.has(path)) return this.bufferCache.get(path);
        const pending = fetch(path)
            .then((res) => res.arrayBuffer())
            .then((data) => this.ctx.decodeAudioData(data));
        this.bufferCache.set(path, pending);
        return pending;
    }

    prefetch(path) {
        if (!path || !this.ctx || this.bufferCache.has(path)) return;
        this.loadBuffer(path).catch(() => {});
    }

    fadeSlot(slot, value, seconds) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        slot.gain.gain.cancelScheduledValues(now);
        slot.gain.gain.setValueAtTime(slot.gain.gain.value, now);
        slot.gain.gain.linearRampToValueAtTime(value, now + seconds);
    }

    async playBgm(path) {
        if (!this.ctx) return;
        await this.ensureResumed();
        if (!path) {
            this.slots.forEach((slot) => this.fadeSlot(slot, 0, 1.6));
            this.bgmPath = '';
            setTimeout(() => {
                this.slots.forEach((slot) => {
                    if (slot.source) {
                        try { slot.source.stop(0); } catch (_) {}
                        slot.source = null;
                    }
                });
            }, 1700);
            return;
        }
        if (path === this.bgmPath) return;
        const token = ++this.bgmToken;
        const buffer = await this.loadBuffer(path);
        if (token !== this.bgmToken) return;
        const next = 1 - this.active;
        const incoming = this.slots[next];
        const outgoing = this.slots[this.active];
        if (incoming.source) {
            try { incoming.source.stop(0); } catch (_) {}
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.connect(incoming.gain);
        this.fadeSlot(incoming, 1, 1.35);
        this.fadeSlot(outgoing, 0, 1.35);
        src.start(0);
        incoming.source = src;
        incoming.path = path;
        this.active = next;
        this.bgmPath = path;
        const old = outgoing;
        setTimeout(() => {
            if (old.source && old !== this.slots[this.active]) {
                try { old.source.stop(0); } catch (_) {}
                old.source = null;
            }
        }, 1500);
    }

    async restartBgmIfNeeded() {
        await this.ensureResumed();
        if (!this.bgmPath || !this.ctx) return;
        const live = this.slots[this.active];
        if (live.source) return;
        const path = this.bgmPath;
        this.bgmPath = '';
        await this.playBgm(path);
    }

    connectOut(node, pan) {
        if (typeof pan === 'number' && this.ctx.createStereoPanner) {
            const panner = this.ctx.createStereoPanner();
            panner.pan.value = pan;
            node.connect(panner);
            panner.connect(this.seGain);
            return;
        }
        node.connect(this.seGain);
    }

    playTap() {
        if (!this.ctx || !this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 880;
        gain.gain.value = 0.035;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.045);
    }

    playFx(kind, pan = 0) {
        if (!this.ctx || !this.enabled) return;
        const now = this.ctx.currentTime;
        if (kind === 'hiss') {
            const src = this.ctx.createBufferSource();
            src.buffer = this.seHiss;
            const hp = this.ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 1600;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.16, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            src.connect(hp);
            hp.connect(gain);
            this.connectOut(gain, pan);
            src.start(now);
            src.stop(now + 0.5);
            return;
        }
        if (kind === 'crash') {
            const src = this.ctx.createBufferSource();
            src.buffer = this.seCrash;
            const lp = this.ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 900;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            src.connect(lp);
            lp.connect(gain);
            this.connectOut(gain, pan);
            src.start(now);
            const osc = this.ctx.createOscillator();
            const og = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.28);
            og.gain.setValueAtTime(0.08, now);
            og.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.connect(og);
            this.connectOut(og, pan);
            osc.start(now);
            osc.stop(now + 0.32);
            return;
        }
        if (kind === 'snap') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(420, now);
            osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
            osc.connect(gain);
            this.connectOut(gain, pan);
            osc.start(now);
            osc.stop(now + 0.14);
            return;
        }
        if (kind === 'foot') {
            [-0.65, 0.15, 0.7].forEach((p, i) => {
                const t = now + i * 0.42;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.value = 90 - i * 6;
                gain.gain.setValueAtTime(0.07, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
                osc.connect(gain);
                this.connectOut(gain, p);
                osc.start(t);
                osc.stop(t + 0.09);
            });
        }
    }

    setAmbient(mode) {
        if (!this.ctx || this.ambientMode === mode) return;
        this.ambientMode = mode;
        const now = this.ctx.currentTime;
        const wet = mode === 'castle' ? 0.2 : mode === 'dungeon' ? 0.12 : mode === 'rain' ? 0.04 : 0;
        this.reverbGain.gain.cancelScheduledValues(now);
        this.reverbGain.gain.setValueAtTime(this.reverbGain.gain.value, now);
        this.reverbGain.gain.linearRampToValueAtTime(wet, now + 0.6);

        const wantRain = mode === 'rain';
        if (wantRain && !this.rainSource) {
            const src = this.ctx.createBufferSource();
            src.buffer = this.rainBuffer;
            src.loop = true;
            const hp = this.ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 700;
            const gain = this.ctx.createGain();
            gain.gain.value = 0.0001;
            src.connect(hp);
            hp.connect(gain);
            gain.connect(this.ambientGain);
            gain.connect(this.reverbGain);
            src.start(0);
            gain.gain.linearRampToValueAtTime(0.9, now + 0.8);
            this.rainSource = src;
            this.rainFilter = gain;
        }
        if (!wantRain && this.rainSource) {
            const g = this.rainFilter;
            if (g) {
                g.gain.cancelScheduledValues(now);
                g.gain.setValueAtTime(g.gain.value, now);
                g.gain.linearRampToValueAtTime(0.0001, now + 0.7);
            }
            const old = this.rainSource;
            this.rainSource = null;
            this.rainFilter = null;
            setTimeout(() => {
                try { old.stop(0); } catch (_) {}
            }, 800);
        }
    }

    setHeartbeat(on) {
        if (on === this.heartbeatOn) return;
        this.heartbeatOn = on;
        if (this.hbTimer) {
            clearInterval(this.hbTimer);
            this.hbTimer = 0;
        }
        if (!on || !this.ctx) return;
        const beat = () => {
            if (!this.ctx || !this.enabled || !this.heartbeatOn) return;
            const now = this.ctx.currentTime;
            [0, 0.2].forEach((off, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = i ? 54 : 72;
                gain.gain.setValueAtTime(0.0001, now + off);
                gain.gain.exponentialRampToValueAtTime(0.09, now + off + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + off + 0.18);
                osc.connect(gain);
                gain.connect(this.seGain);
                osc.start(now + off);
                osc.stop(now + off + 0.2);
            });
        };
        beat();
        this.hbTimer = setInterval(beat, 940);
    }

    applyEnding(kind) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        this.setHeartbeat(false);
        if (kind === 'white') {
            this.bgmBus.gain.cancelScheduledValues(now);
            this.bgmBus.gain.setValueAtTime(this.bgmBus.gain.value, now);
            this.bgmBus.gain.linearRampToValueAtTime(0.07, now + 2.1);
            this.setAmbient('none');
            return;
        }
        if (kind === 'true') {
            this.setLowpass(14000);
            this.setAmbient('none');
            return;
        }
        if (kind === 'black') {
            this.filter.frequency.cancelScheduledValues(now);
            this.filter.frequency.setValueAtTime(this.filter.frequency.value, now);
            this.filter.frequency.linearRampToValueAtTime(260, now + 2.4);
            this.bgmBus.gain.cancelScheduledValues(now);
            this.bgmBus.gain.setValueAtTime(this.bgmBus.gain.value, now);
            this.bgmBus.gain.linearRampToValueAtTime(0.05, now + 2.4);
            return;
        }
        if (kind === 'silence') {
            this.playBgm(null);
            this.setAmbient('none');
        }
    }
}
