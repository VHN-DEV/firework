/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (người ngắm pháo: biên đạo)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Biên đạo cho người ngắm pháo (Actor3D: chuyển động quay thật + IK tay, nhìn, nghiêng):
// - Cặp đôi (Duo): chàng trai từ mép trái, cô gái từ mép phải thong thả đi dạo lại, vừa đi vừa ngước nhìn pháo; gặp
//   nhau ở giữa thì dừng bước, nhìn nhau, cô vén tóc, anh đưa tay, cô nắm lấy; cùng quay ra mặt nước nắm tay ngước nhìn
//   pháo hoa rồi lần lượt: cô tựa đầu vào vai anh, anh choàng tay ôm vai cô (cô vòng tay ôm eo anh), nhìn nhau rồi anh
//   cúi hôn lên tóc cô, cô chỉ tay lên pháo, hai bàn tay nắm đung đưa. Mưa, tuyết: hai người che ô đi tới; gặp nhau anh
//   giơ cao ô, cô gập ô của mình (tay kia vuốt khép tán), cầm buông bên người, bước vào đứng chung ô, khoác tay anh; anh
//   nghiêng ô về phía cô.
// - Một mình (Solo): bước chậm buồn bã, chàng trai đút tay túi quần, cô gái khoanh tay ôm lấy mình; đứng giữa bờ ngước
//   nhìn pháo rồi lần lượt: cúi đầu lặng im, thở dài, nhìn quanh sang bên cạnh trống trải, gãi đầu (chàng), vén tóc (cô),
//   đưa tay lên mặt lau nước mắt. Mưa, tuyết: cầm ô gác vai, ngước nhìn thì ngả ô ra sau, cúi đầu thì ô cụp xuống.

import * as THREE from 'three';

const pick = list => list[(Math.random() * list.length) | 0];
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Hướng nhìn pháo hoa: quay đầu theo chỗ pháo đang nổ, ngẩng theo độ cao
function lookSky(actor, env, add = 0) {
    const dx = env.focus.x - actor.x;
    const yaw = Math.atan2(dx, 9) - actor.yaw;
    actor.lookGoal.yaw = clamp(yaw, -0.9, 0.9);
    actor.lookGoal.pitch = env.focus.pitch * 1.25 + add;
}

function lookAtActor(actor, other, pitch = 0) {
    const dx = other.x - actor.x;
    const dz = other.z - actor.z;
    actor.lookGoal.yaw = clamp(Math.atan2(dx, dz) - actor.yaw, -1.2, 1.2);
    actor.lookGoal.pitch = pitch;
}

// Điểm theo hệ của thân người: r sang phải (của nhân vật), u lên, f phía trước mặt (mét, tính từ gốc chân); ra tọa độ
// thế giới three.js
function bodyPoint(actor, r, u, f) {
    const s = Math.sin(actor.yaw);
    const c = Math.cos(actor.yaw);
    // Hướng trước mặt (x, z cảnh) = (sin, cos); bên phải = (cos, -sin)
    const x = actor.x + c * r + s * f;
    const z = actor.z - s * r + c * f;
    return V(x, u, -z);
}

function bodyDir(actor, r, u, f) {
    const s = Math.sin(actor.yaw);
    const c = Math.cos(actor.yaw);
    return V(c * r + s * f, u, -(-s * r + c * f)).normalize();
}

// Đi tới hoành độ x: đi dạo (động tác walk / walkSad) theo đúng quãng tiến của chuyển động, gần tới thì chuyển sang
// động tác dừng bước, xong thì đứng thở. Trả true khi đã đứng yên
class Walker {
    constructor(actor, x, gait = 'walk') {
        this.a = actor;
        this.x = x;
        this.gait = gait;
        this.state = 'walk';
        this.stopDist = Math.max(0.2, actor.stride('stop').dist);
        actor.goalYaw = actor.yaw = x > actor.x ? Math.PI / 2 : -Math.PI / 2;
        actor.play(gait, { fade: 0.01 });
    }

    update() {
        const a = this.a;
        const left = Math.abs(this.x - a.x);
        if (this.state === 'walk' && left <= this.stopDist) {
            this.state = 'stop';
            a.play('stop', { loop: false, fade: 0.35 });
        } else if (this.state === 'stop' && a.remaining < 0.4) {
            this.state = 'idle';
            a.play('idle', { fade: 0.5 });
        }
        return this.state === 'idle';
    }
}

// Thời gian đi hết quãng (để hai người tới cùng lúc)
function walkTime(actor, dist, gait = 'walk') {
    const { speed } = actor.stride(gait);
    const stop = actor.stride('stop');
    return Math.max(0, dist - stop.dist) / Math.max(0.1, speed) + actor.clips.stop.duration * 0.8;
}

// Điểm hai bàn tay nắm nhau, giữa hai người
function holdPoint(m, w, h = 0.86) {
    const a = m.worldOf('rightHand');
    const b = w.worldOf('leftHand');
    const mid = a.clone().lerp(b, 0.5);
    const hips = m.worldOf('hips').lerp(w.worldOf('hips'), 0.5);
    return V((hips.x + mid.x) / 2, h, hips.z + 0.06);
}

// ---------------------------------------------------------------------------
// Cặp đôi
// ---------------------------------------------------------------------------
export class Duo {
    constructor(man, woman, { halfW, umbrella }) {
        this.m = man;
        this.w = woman;
        this.umbrella = umbrella;
        this.phase = 'wait';
        this.t = 0;
        this.g = null;
        this.last = '';
        const start = halfW + 0.9;
        man.x = -start;
        woman.x = start;
        man.z = 0;
        woman.z = 0.05;
        man.yaw = man.goalYaw = Math.PI / 2;
        woman.yaw = woman.goalYaw = -Math.PI / 2;
        this.stopM = umbrella ? -0.5 : -0.26;
        this.stopW = umbrella ? 0.56 : 0.26;
        // Anh tới trước chừng nửa giây, đứng nhìn cô đi lại
        const tm = walkTime(man, start + this.stopM);
        const tw = walkTime(woman, start - this.stopW);
        this.startM = 0.6;
        this.startW = Math.max(0.4, this.startM + tm - tw + 0.6);
        man.play('idle', { fade: 0.01 });
        woman.play('idle', { fade: 0.01 });
        // Đứng ngoài khung chờ tới lượt
        man.root.visible = woman.root.visible = false;
        if (umbrella) {
            man.umbrellaDir = V(0, 1, 0);
            woman.umbrellaDir = V(0, 1, 0);
        }
    }

    go(phase) {
        this.phase = phase;
        this.t = 0;
    }

    update(dt, env) {
        const { m, w } = this;
        this.t += dt;
        const t = this.t;
        if (this.phase === 'wait' || this.phase === 'enter') {
            this.phase = 'enter';
            if (!this.wm && t >= this.startM) {
                this.wm = new Walker(m, this.stopM);
                m.root.visible = true;
            }
            if (!this.ww && t >= this.startW) {
                this.ww = new Walker(w, this.stopW);
                w.root.visible = true;
            }
            const doneM = this.wm && this.wm.update();
            const doneW = this.ww && this.ww.update();
            // Vừa đi vừa ngước nhìn pháo; tới trước thì nhìn người kia đang đi lại
            [[m, this.wm, doneM, w], [w, this.ww, doneW, m]].forEach(([a, walker, done, other]) => {
                if (!walker) return;
                if (done) lookAtActor(a, other, a === m ? -0.05 : 0.08);
                else this.glance(a, dt, env);
            });
            this.carry(env);
            if (doneM && doneW) this.go('meet');
        } else if (this.phase === 'meet') {
            lookAtActor(m, w, -0.12);
            lookAtActor(w, m, 0.16);
            if (this.umbrella) this.foldUmbrella();
            else this.greet();
            if (t > (this.umbrella ? 4.6 : 2.4)) this.go('turn');
        } else if (this.phase === 'turn') {
            m.goalYaw = 0.32;
            w.goalYaw = -0.32;
            if (t < 0.6) {
                lookAtActor(m, w, -0.1);
                lookAtActor(w, m, 0.12);
            } else {
                lookSky(m, env);
                lookSky(w, env);
            }
            this.hands(env);
            if (t > 1.8) this.go('watch');
        } else {
            this.watch(dt, env);
        }
    }

    // Lâu lâu ngước nhìn pháo trong lúc đi
    glance(a, dt, env) {
        const g = a.glanceState || (a.glanceState = { t: 0, next: rand(1.5, 3.5), until: 0 });
        g.t += dt;
        if (g.t > g.next || (env.burst && g.t > g.until + 1)) {
            g.until = g.t + rand(1.2, 2.2);
            g.next = g.until + rand(2.5, 5);
        }
        if (g.t < g.until) lookSky(a, env, -0.1);
        else {
            a.lookGoal.yaw = 0;
            a.lookGoal.pitch = -0.05;
        }
    }

    // Lúc đi: tay buông theo chuyển động (che ô thì tay cầm ô trước ngực)
    carry(env) {
        const { m, w } = this;
        if (!this.umbrella) {
            m.ik = [null, null];
            w.ik = [null, null];
            m.curlGoal = [0.3, 0.3];
            w.curlGoal = [0.25, 0.25];
            return;
        }
        m.ik[1] = { target: bodyPoint(m, 0.09, 1.05, 0.28), pole: bodyDir(m, 0.6, -1, -0.2) };
        w.ik[0] = { target: bodyPoint(w, -0.08, 0.98, 0.26), pole: bodyDir(w, -0.6, -1, -0.2) };
        m.curlGoal = [0.3, 0.9];
        w.curlGoal = [0.9, 0.25];
        m.umbrellaDir = bodyDir(m, 0, 1, 0.22).add(V(-env.wind * 0.06, 0, 0));
        w.umbrellaDir = bodyDir(w, 0, 1, 0.22).add(V(-env.wind * 0.06, 0, 0));
    }

    // Gặp nhau (trời quang): cô vén tóc, anh đưa tay, cô nắm lấy
    greet() {
        const { m, w } = this;
        const t = this.t;
        if (t > 0.15 && !this.haired) {
            this.haired = true;
            w.play('hair', { loop: false, fade: 0.4 });
        }
        if (this.haired && w.clipName === 'hair' && w.remaining < 0.5) w.play('idle', { fade: 0.5 });
        if (t > 0.9) {
            const p = holdPoint(m, w, 0.9);
            m.ik[1] = { target: p, pole: bodyDir(m, 0.3, -1, -0.4), tau: 0.35 };
            m.curlGoal[1] = 0.75;
        }
        if (t > 1.5) {
            const p = holdPoint(m, w, 0.9);
            w.ik[0] = { target: p, pole: bodyDir(w, -0.3, -1, -0.4), tau: 0.3 };
            w.curlGoal[0] = 0.75;
        }
    }

    // Trời mưa: anh giơ cao ô che sang phía cô; cô gập ô (tay phải vuốt khép tán), cầm buông bên người, bước vào
    foldUmbrella() {
        const { m, w } = this;
        const t = this.t;
        const uw = w.umbrella;
        // Anh giơ ô cao, nghiêng sang cô
        m.ik[1] = { target: bodyPoint(m, 0.05, 1.32, 0.3), pole: bodyDir(m, 0.7, -1, 0), tau: 0.4 };
        m.umbrellaDir = bodyDir(m, 0, 1, 0.42);
        if (t < 2.4) {
            // Cô hạ ô xuống trước mặt, tay phải nắm lấy cán vuốt con chạy xuống
            w.ik[0] = { target: bodyPoint(w, -0.05, 1.0, 0.3), pole: bodyDir(w, -0.6, -1, 0), tau: 0.3 };
            w.umbrellaDir = bodyDir(w, -0.15, 1, -0.05);
            if (t > 0.6) {
                const grip = uw.group.position.clone();
                const along = t < 1.0 ? 0.5 : 0.5 - 0.28 * clamp((t - 1.0) / 0.9, 0, 1);
                w.ik[1] = { target: grip.clone().addScaledVector(w.umbrellaDir, along), pole: bodyDir(w, 0.6, -1, 0), tau: 0.15 };
                w.curlGoal[1] = 0.85;
            }
            if (t > 1.0) uw.goalOpen = 0;
        } else {
            // Cầm ô đã gập ở tay phải, buông bên người; tay trái rảnh
            if (!this.swapped) {
                this.swapped = true;
                w.umbrellaHand = 'right';
                w.umbrellaGrip = 0.28;
            }
            w.ik[0] = null;
            w.curlGoal[0] = 0.3;
            w.ik[1] = { target: bodyPoint(w, 0.22, 0.72, 0.02), pole: bodyDir(w, 0.3, -0.2, -1), tau: 0.4 };
            w.umbrellaDir = bodyDir(w, 0.05, -1, 0.1);
            // Bước vào đứng dưới ô của anh
            if (t > 2.8 && !this.stepIn) {
                this.stepIn = new Walker(w, m.x + 0.4);
            }
            if (this.stepIn) this.stepIn.update();
        }
    }

    // Tay lúc đứng ngắm pháo: nắm tay (hoặc che ô, khoác tay)
    hands(env, name = '', gt = 0) {
        const { m, w } = this;
        if (this.umbrella) {
            const shelter = name === 'shelter' ? 0.55 : 0.32;
            m.ik[1] = { target: bodyPoint(m, 0.12, 1.36, 0.16), pole: bodyDir(m, 0.6, -1, -0.2), tau: 0.5 };
            m.umbrellaDir = bodyDir(m, shelter, 1, -0.12);
            m.ik[0] = null;
            m.curlGoal = [0.35, 0.9];
            // Cô khoác tay anh: bàn tay trái đặt lên cẳng tay anh
            const fore = m.worldOf('rightLowerArm').lerp(m.worldOf('rightHand'), 0.4);
            w.ik[0] = { target: fore.add(V(0.03, -0.02, 0.05)), pole: bodyDir(w, -0.4, -1, -0.5), tau: 0.4 };
            w.curlGoal = [0.55, 0.85];
            return;
        }
        if (name === 'embrace') {
            // Anh choàng tay qua vai cô, cô vòng tay ôm eo anh
            const sh = w.worldOf('rightUpperArm').add(V(0, 0.06, 0.07));
            m.ik[1] = { target: sh, pole: bodyDir(m, 0.2, 1, -1), tau: 0.4 };
            const waist = bodyPoint(m, -0.16, 0.95, -0.12);
            w.ik[0] = { target: waist, pole: bodyDir(w, -0.2, -1, -1), tau: 0.4 };
            m.curlGoal = [0.3, 0.5];
            w.curlGoal = [0.5, 0.3];
            return;
        }
        let p = holdPoint(m, w, 0.86);
        if (name === 'swing') p = p.add(V(0, 0.02 * Math.sin(gt * 3.4), 0.12 * Math.sin(gt * 3.4)));
        m.ik[1] = { target: p, pole: bodyDir(m, 0.3, -1, -0.5), tau: 0.3 };
        w.ik[0] = { target: p, pole: bodyDir(w, -0.3, -1, -0.5), tau: 0.3 };
        m.ik[0] = null;
        m.curlGoal = [0.3, 0.75];
        w.curlGoal = [0.75, 0.3];
        if (name === 'point' && gt > 0.5 && gt < 3.3) {
            const dx = env.focus.x - w.x;
            const dir = bodyDir(w, 0.25 + clamp(dx / 8, -0.4, 0.4), 1.2, 0.8);
            w.ik[1] = { target: w.worldOf('rightUpperArm').addScaledVector(dir, 0.6), pole: bodyDir(w, 0.5, -1, 0), tau: 0.3 };
            w.curlGoal[1] = 0.55;
        } else {
            w.ik[1] = null;
        }
    }

    // Cử chỉ lúc đứng ngắm: nối tiếp ngẫu nhiên, không lặp cử chỉ vừa làm
    watch(dt, env) {
        const { m, w } = this;
        if (!this.g || this.g.t >= this.g.dur) {
            const options = this.umbrella ? ['watch', 'lean', 'gaze', 'shelter', 'lean'] : ['watch', 'lean', 'embrace', 'gaze', 'point', 'swing', 'lean', 'embrace'];
            let name = this.g ? pick(options) : 'watch';
            if (name === this.last) name = pick(options);
            this.last = name;
            const dur = { watch: rand(5, 8), lean: rand(7, 10), embrace: rand(8, 11), gaze: rand(5, 6.5), point: 4.4, swing: 4.2, shelter: rand(5, 7) }[name];
            this.g = { name, t: 0, dur };
            // Thân thỉnh thoảng đổi tư thế đứng (dồn trọng tâm)
            [m, w].forEach(a => a.play(Math.random() < 0.4 ? 'idle2' : 'idle', { fade: 0.8 }));
        }
        const g = this.g;
        g.t += dt;
        const t = g.t;
        const edge = Math.min(1, t / 0.9, (g.dur - t) / 0.9);
        m.goalYaw = 0.32;
        w.goalYaw = -0.32;
        lookSky(m, env);
        lookSky(w, env);
        m.lookGoal.roll = 0;
        w.lookGoal.roll = 0;
        m.leanGoal = 0;
        w.leanGoal = 0;
        if (g.name === 'lean' || g.name === 'embrace' || (g.name === 'shelter' && t > 1.5)) {
            // Cô tựa đầu vào vai anh (nghiêng sang trái của cô), anh nghiêng đầu về phía cô
            w.leanGoal = -0.55 * edge;
            w.lookGoal.roll = -0.42 * edge;
            w.lookGoal.pitch -= 0.15 * edge;
            m.lookGoal.roll = 0.12 * edge;
        } else if (g.name === 'gaze') {
            const look = t > 0.6 && t < g.dur - 1;
            if (look) {
                lookAtActor(m, w, -0.2);
                lookAtActor(w, m, 0.2);
            }
            // Anh cúi xuống hôn lên tóc cô
            const kiss = clamp((t - 2.2) / 0.7, 0, 1) * clamp((g.dur - 1.4 - t) / 0.6, 0, 1);
            m.leanGoal = 0.35 * kiss;
            m.lookGoal.pitch -= 0.35 * kiss;
            m.lookGoal.roll = 0.25 * kiss;
            w.lookGoal.roll = -0.15 * kiss;
        } else if (g.name === 'shelter') {
            if (t < 1.5) lookAtActor(m, w, -0.2);
        }
        this.hands(env, g.name, t);
    }
}

// ---------------------------------------------------------------------------
// Một mình
// ---------------------------------------------------------------------------
export class Solo {
    constructor(actor, { halfW, umbrella }) {
        this.a = actor;
        this.umbrella = umbrella;
        this.phase = 'wait';
        this.t = 0;
        this.g = null;
        this.last = '';
        this.dir = actor.sex === 'm' ? 1 : -1;
        const start = halfW + 0.9;
        actor.x = -this.dir * start;
        actor.z = 0;
        actor.yaw = actor.goalYaw = this.dir * Math.PI / 2;
        actor.play('idle', { fade: 0.01 });
        actor.root.visible = false;
        this.umbHand = actor.sex === 'm' ? 1 : 0;
        if (umbrella) actor.umbrellaDir = V(0, 1, 0);
    }

    update(dt, env) {
        const a = this.a;
        this.t += dt;
        const t = this.t;
        if (this.phase === 'wait') {
            if (t > 1) {
                this.walker = new Walker(a, this.dir * 0.12, 'walkSad');
                a.root.visible = true;
                this.phase = 'enter';
            }
        } else if (this.phase === 'enter') {
            // Bước chậm, đầu cúi, lâu lâu ngẩng lên nhìn pháo
            const g = a.glanceState || (a.glanceState = { t: 0, next: rand(2, 4), until: 0 });
            g.t += dt;
            if (g.t > g.next) {
                g.until = g.t + rand(1.2, 2);
                g.next = g.until + rand(3, 5);
            }
            if (g.t < g.until) lookSky(a, env, -0.15);
            else {
                a.lookGoal.yaw = 0;
                a.lookGoal.pitch = -0.3;
            }
            if (this.walker.update()) {
                this.phase = 'turn';
                this.t = 0;
            }
        } else if (this.phase === 'turn') {
            a.goalYaw = this.dir * 0.1;
            a.lookGoal.pitch = -0.3;
            a.lookGoal.yaw = 0;
            if (t > 1.6) this.phase = 'watch';
        } else {
            this.watch(dt, env);
        }
        this.arms(env);
    }

    watch(dt, env) {
        const a = this.a;
        if (!this.g || this.g.t >= this.g.dur) {
            const options = a.sex === 'm'
                ? ['gaze', 'down', 'sigh', 'aside', 'gaze', 'scratch', 'tear']
                : ['gaze', 'down', 'sigh', 'aside', 'gaze', 'hair', 'tear'];
            let name = this.g ? pick(options) : 'gaze';
            if (name === this.last) name = pick(options);
            this.last = name;
            const clip = { scratch: 'scratch', hair: 'hair', tear: 'face', aside: 'look', down: 'sad' }[name];
            const dur = clip && a.clips[clip] ? Math.min(a.clips[clip].duration, name === 'down' ? 7 : 99) : { gaze: rand(7, 11), sigh: 4.2 }[name] || 5;
            this.g = { name, t: 0, dur, clip };
            if (clip && !(this.umbrella && ['scratch', 'hair', 'tear'].includes(name))) a.play(clip, { loop: false, fade: 0.6 });
            else a.play(this.umbrella ? 'umbrella' : 'idle', { fade: 0.8, pingpong: !!this.umbrella });
        }
        const g = this.g;
        g.t += dt;
        a.goalYaw = this.dir * 0.1;
        a.lookGoal.roll = 0;
        if (g.name === 'gaze') lookSky(a, env, 0.05);
        else if (g.name === 'down' || g.name === 'tear') {
            a.lookGoal.pitch = g.t < g.dur - 0.8 ? -0.42 : env.focus.pitch;
            a.lookGoal.yaw = 0;
        } else if (g.name === 'sigh') {
            a.lookGoal.pitch = g.t > 1.8 && g.t < g.dur - 0.5 ? -0.35 : env.focus.pitch * 0.7;
            if (g.t > 1.8 && !g.breathed) {
                g.breathed = true;
                a.sigh = 1;
            }
        } else if (g.name === 'aside') {
            // Động tác nhìn quanh: không cộng thêm hướng nhìn
            a.lookGoal.yaw = 0;
            a.lookGoal.pitch = 0;
        } else {
            a.lookGoal.yaw = 0;
            a.lookGoal.pitch = 0;
        }
        if (g.clip && a.clipName === g.clip && a.remaining < 0.6) a.play(this.umbrella ? 'umbrella' : 'idle', { fade: 0.8, pingpong: !!this.umbrella });
    }

    // Tay: chàng trai đút túi quần, cô gái khoanh tay ôm lấy mình; tay đang làm cử chỉ (gãi đầu, vén tóc, lau nước mắt)
    // thì theo chuyển động. Che ô: tay cầm ô trước ngực, cán gác vai
    arms(env) {
        const a = this.a;
        const g = this.g;
        const gesture = g && ['scratch', 'hair', 'tear'].includes(g.name) && g.t < g.dur - 0.4;
        const sides = [0, 1];
        sides.forEach(i => {
            const sg = i ? 1 : -1;
            if (this.umbrella && i === this.umbHand) {
                a.ik[i] = { target: bodyPoint(a, sg * 0.07, 1.08, 0.24), pole: bodyDir(a, sg * 0.6, -1, -0.2) };
                a.curlGoal[i] = 0.9;
                return;
            }
            if (gesture && !this.umbrella) {
                a.ik[i] = null;
                a.curlGoal[i] = 0.35;
                return;
            }
            if (a.sex === 'm') {
                // Đút túi quần trước
                a.ik[i] = { target: bodyPoint(a, sg * 0.17, 0.86, 0.07), pole: bodyDir(a, sg, -0.3, -1), tau: 0.35 };
                a.curlGoal[i] = 0.95;
            } else {
                // Khoanh tay ôm lấy mình: bàn tay nắm cánh tay bên kia
                const other = a.worldOf(i ? 'leftUpperArm' : 'rightUpperArm').lerp(a.worldOf(i ? 'leftLowerArm' : 'rightLowerArm'), 0.55);
                const front = bodyDir(a, 0, 0, 1).multiplyScalar(0.06);
                a.ik[i] = { target: other.add(front).add(V(0, i ? 0.02 : -0.02, 0)), pole: bodyDir(a, sg, -0.6, -0.2), tau: 0.35 };
                a.curlGoal[i] = 0.55;
            }
        });
        if (this.umbrella) {
            const name = g ? g.name : '';
            const down = this.phase === 'enter' || name === 'down' || name === 'tear';
            a.umbrellaDir = bodyDir(a, this.umbHand ? 0.18 : -0.18, 1, down ? 0.12 : -0.45).add(V(-env.wind * 0.05, 0, 0));
        }
    }
}
