/*!
 * Hanabi – trình phát: cảnh vật (người ngắm pháo: biên đạo)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Biên đạo cho người ngắm pháo (Actor3D: chuyển động quay thật + IK tay, nhìn, nghiêng):
// - Cặp đôi (Duo): chàng trai từ mép trái, cô gái từ mép phải thong thả đi dạo lại, vừa đi vừa ngước nhìn pháo; gặp
//   nhau ở giữa thì dừng bước, nhìn nhau, cô vén tóc, anh đưa tay, cô nắm lấy; cùng quay ra mặt nước nắm tay ngước nhìn
//   pháo hoa rồi lần lượt: cô tựa đầu vào vai anh, anh choàng tay ôm vai cô (cô vòng tay ôm eo anh), nhìn nhau rồi anh
//   cúi hôn lên tóc cô, cô chỉ tay lên pháo, hai bàn tay nắm đung đưa. Mưa: hai người che ô đi tới; gặp nhau anh
//   giơ cao ô, cô gập ô của mình (tay kia vuốt khép tán), cầm buông bên người, bước vào đứng chung ô, khoác tay anh; anh
//   nghiêng ô về phía cô.
// - Một mình (Solo): bước chậm buồn bã, chàng trai đút tay túi quần, cô gái khoanh tay ôm lấy mình; đứng giữa bờ ngước
//   nhìn pháo rồi lần lượt: cúi đầu lặng im, thở dài, nhìn quanh sang bên cạnh trống trải, gãi đầu (chàng), vén tóc (cô),
//   đưa tay lên mặt lau nước mắt. Mưa: cầm ô gác vai, ngước nhìn thì ngả ô ra sau, cúi đầu thì ô cụp xuống.

import * as THREE from 'three';

const pick = list => list[(Math.random() * list.length) | 0];
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Hướng nhìn pháo hoa: quay đầu theo chỗ pháo đang nổ, ngẩng theo độ cao. Người thật đưa mắt theo chỗ pháo mới nổ chứ
// không bám đều như máy quay: chỗ nổ dời đủ xa (hoặc vừa có loạt pháo mới) thì sau một nhịp phản xạ riêng của mỗi người
// (0,15-0,5 giây) mới quay đầu theo, hai người không cùng nhịp
function lookSky(actor, env, add = 0) {
    const dx = env.focus.x - actor.x;
    const yaw = clamp(Math.atan2(dx, 9) - actor.yaw, -0.9, 0.9);
    const pitch = env.focus.pitch * 1.25 + add;
    const s = actor.sky || (actor.sky = { yaw, pitch, wait: 0 });
    if (!s.wait && (Math.abs(yaw - s.yaw) > 0.1 || Math.abs(pitch - s.pitch) > 0.08 || env.burst)) s.wait = rand(0.15, 0.5);
    if (s.wait) {
        s.wait -= env.dt || 0;
        if (s.wait <= 0) {
            s.wait = 0;
            s.yaw = yaw;
            s.pitch = pitch;
        }
    }
    actor.lookGoal.yaw = s.yaw;
    actor.lookGoal.pitch = s.pitch;
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
// động tác dừng bước, xong thì đứng thở. Trả true khi đã đứng yên. lane: đi lệch ra trước, ra sau bao nhiêu (độ sâu z,
// để đi cạnh người kia hoặc vòng qua người đang đứng), còn vài bước (hoặc đã qua khỏi hoành độ merge) thì chéo về z (chỗ
// đứng); turn: đang đứng trong khung thì quay người sang hướng đi rồi mới bước (ở ngoài khung thì quay ngay); speed: nhịp
// bước (đi cùng người kia thì bước theo người chậm hơn)
class Walker {
    constructor(actor, x, gait = 'walk', { z = actor.z, lane = z, turn = false, merge = null, speed = 1 } = {}) {
        this.a = actor;
        this.x = x;
        this.z = z;
        this.lane = lane;
        this.merge = merge;
        this.speed = speed;
        this.gait = gait;
        this.dir = x > actor.x ? 1 : -1;
        this.stopDist = Math.max(0.2, actor.stride('stop').dist);
        const goal = this.dir * Math.PI / 2;
        if (turn && Math.abs(actor.yaw - goal) > 0.35) {
            // Đang đứng trong khung: quay người bằng bước chân sang hướng đi rồi bước luôn
            this.state = 'turn';
            if (!actor.turnTo(goal, { then: [gait, { fade: 0.35, speed }] })) actor.goalYaw = goal;
        } else {
            actor.goalYaw = goal;
            actor.yaw = actor.goalYaw;
            this.state = 'walk';
            actor.play(gait, { fade: 0.01, speed });
        }
    }

    // Còn bao xa (mét theo bề ngang)
    get left() {
        return Math.abs(this.x - this.a.x);
    }

    update(dt = 1 / 60) {
        const a = this.a;
        if (this.state === 'turn') {
            if (a.turning ? a.turning.ending : Math.abs(a.yaw - a.goalYaw) < 0.35) {
                this.state = 'walk';
                if (!a.turning) a.play(this.gait, { fade: 0.4, speed: this.speed });
            }
            return false;
        }
        const left = this.left;
        if (this.state === 'walk') {
            // Lái theo độ sâu: đi trên làn, còn chừng hơn một mét (hoặc đã qua khỏi người kia) thì chéo về chỗ đứng
            const past = this.merge === null ? left <= this.stopDist + 1.2 : (a.x - this.merge) * this.dir >= 0;
            const aim = past ? this.z : this.lane;
            a.goalYaw = this.dir * (Math.PI / 2 - clamp((aim - a.z) * 1.5, -0.45, 0.45));
        }
        if (this.state === 'stop') {
            // Động tác dừng trộn chuyển tiếp với bước đi nên quãng trượt thực tế hụt so với tính trước (anh dừng hụt gần
            // 10 cm, hai người đứng xa nhau): bù dần phần còn thiếu trong lúc chân còn đang bước, để dừng đúng chỗ hẹn
            // Còn bao xa tới chỗ hẹn theo hướng đi (âm: đã đi quá) trừ quãng động tác dừng còn trượt
            const err = (this.x - a.x) * this.dir - a.remainingTravel('stop');
            a.x += this.dir * clamp(err, -0.15 * dt, 0.15 * dt);
        }
        if (this.state === 'walk' && left <= this.stopDist) {
            this.state = 'stop';
            a.goalYaw = this.dir * Math.PI / 2;
            a.play('stop', { loop: false, fade: 0.35 });
        } else if (this.state === 'stop' && a.remaining < 0.4) {
            this.state = 'idle';
            a.play('idle', { fade: 0.5 });
        }
        return this.state === 'idle';
    }
}

// Thời gian đi hết quãng (để hai người tới cùng lúc, hoặc người sau tới đúng lúc hẹn)
function walkTime(actor, dist, gait = 'walk') {
    if (dist < 0.05) return 0;
    const { speed } = actor.stride(gait);
    const stop = actor.stride('stop');
    return Math.max(0, dist - stop.dist) / Math.max(0.1, speed) + actor.clips.stop.duration * 0.8;
}

// Điểm hai bàn tay nắm nhau, giữa hai người, lùi ra sau lưng back mét (về phía người xem). Đứng ngắm thì hai người sát vai,
// giữa vạt áo của anh và váy xòe của cô không còn khe: hai bàn tay nắm phải thả ra sau lưng, lệch về phía anh một chút
function holdPoint(m, w, h = 0.86, back = 0.06) {
    const a = m.worldOf('rightHand');
    const b = w.worldOf('leftHand');
    const mid = a.clone().lerp(b, 0.5);
    const hips = m.worldOf('hips').lerp(w.worldOf('hips'), 0.5);
    return V((hips.x + mid.x) / 2 - 0.03, h, hips.z + back);
}

// ---------------------------------------------------------------------------
// Cặp đôi
// ---------------------------------------------------------------------------
export class Duo {
    // from: chỗ bắt đầu của từng người { m, f }: { x: mét tính từ giữa, edge: đi vào từ ngoài khung (bờ bên kia: từ đầu
    // cầu), stand: đứng sẵn ở chỗ gặp }, mặc định từ ngoài hai mép khung; first: ai đến trước ('' cùng đến, 'm', 'f'),
    // wait: người đến trước đứng đợi bao lâu (giây); together: cùng đến thì tới đúng cùng lúc (không thì anh tới trước
    // chừng nửa giây, đứng nhìn cô đi lại)
    constructor(man, woman, { halfW, umbrella, from = {}, first = '', wait = 8, together = false }) {
        this.m = man;
        this.w = woman;
        this.umbrella = umbrella;
        this.phase = 'wait';
        this.t = 0;
        this.g = null;
        this.last = '';
        const edge = halfW + 0.9;
        const fm = from.m || { x: -edge, edge: true };
        const ff = from.f || { x: edge, edge: true };
        // Ngắm pháo thì đứng sát vai nhau (cô tựa đầu được vào vai anh); che ô thì đứng cách ra cho hai tán ô. Đi tới gặp
        // nhau thì dừng cách nhau chừng một sải tay để chào (đứng sát mặt nhau không tự nhiên), quay ra mặt nước mới bước sát
        // lại; đi cùng nhau (cùng một phía) hay cả hai đứng sẵn thì đứng sát vai luôn
        const along = !first && !fm.stand && !ff.stand && Math.sign(-0.19 - fm.x) === Math.sign(0.19 - ff.x) && Math.abs(fm.x - ff.x) < 0.5;
        this.greeting = !umbrella && !along && !(fm.stand && ff.stand);
        this.stopM = umbrella ? -0.5 : this.greeting ? -0.36 : -0.19;
        this.stopW = umbrella ? 0.56 : this.greeting ? 0.36 : 0.19;
        // Mỗi người: chỗ gặp (x, z), chỗ bắt đầu, xuất phát lúc nào (dep), đi mất bao lâu (walk), đã tới chưa
        const plan = (a, f, x, z) => ({ a, x, z, from: f.stand ? x : f.x, edge: !!f.edge && !f.stand, arrived: !!f.stand, lane: null });
        const rm = this.rm = plan(man, fm, this.stopM, 0);
        const rw = this.rw = plan(woman, ff, this.stopW, 0.05);
        rm.other = rw;
        rw.other = rm;
        [rm, rw].forEach(r => {
            const a = r.a;
            a.x = r.from;
            a.z = r.z;
            r.dir = r.x >= r.from ? 1 : -1;
            r.walk = r.arrived ? 0 : walkTime(a, Math.abs(r.x - r.from));
            // Ngoài khung thì quay sẵn hướng đi, chờ tới lượt mới hiện; đứng trong khung thì quay ra mặt nước ngắm pháo
            a.yaw = a.goalYaw = r.edge ? r.dir * Math.PI / 2 : 0;
            a.play('idle', { fade: 0.01 });
            a.root.visible = !r.edge;
        });
        // Xuất phát theo lúc tới nơi: cùng đến, hoặc người sau tới chậm hơn wait giây (người đứng sẵn ở giữa đã tới từ đầu).
        // Cùng một chỗ, cùng đến thì đi cùng nhau
        const gap = first === 'm' ? wait : first === 'f' ? -wait : together ? 0 : 0.6;
        if (rm.arrived && rw.arrived) {
            rm.dep = rw.dep = 0;
        } else if (rm.arrived) {
            rm.dep = 0;
            rw.dep = Math.max(0.6, Math.max(gap, 0.6) - rw.walk);
        } else if (rw.arrived) {
            rw.dep = 0;
            rm.dep = Math.max(0.6, Math.max(-gap, 0.6) - rm.walk);
        } else if (!first && rm.dir === rw.dir && Math.abs(rm.from - rw.from) < 0.5) {
            this.pair = true;
            rm.dep = rw.dep = 0.6;
            const sm = man.stride('walk').speed;
            const sw = woman.stride('walk').speed;
            rm.speed = Math.min(1, sw / Math.max(0.1, sm));
            rw.speed = Math.min(1, sm / Math.max(0.1, sw));
        } else {
            rm.dep = 0.6;
            rw.dep = rm.dep + rm.walk + gap - rw.walk;
            const shift = 0.6 - Math.min(rm.dep, rw.dep);
            if (shift > 0) {
                rm.dep += shift;
                rw.dep += shift;
            }
        }
        // Đường đi chạm người kia (đang đứng ở chỗ bắt đầu trong khung, hay đã đứng ở chỗ gặp lúc mình đi qua): đi trên làn
        // lệch theo độ sâu, qua khỏi người đó mới chéo về chỗ đứng. Cô luôn ở bên tay phải anh (như lúc nắm tay đi cạnh nhau)
        const on = (r, x) => x > Math.min(r.from, r.x) - 0.35 && x < Math.max(r.from, r.x) + 0.35;
        [rw, rm].forEach(r => {
            const o = r.other;
            if (r.arrived || o.lane !== null) return;
            const blocks = [];
            if (!o.edge && !o.arrived && o.dep > r.dep && on(r, o.from)) blocks.push(o.from);
            if (o.dep + o.walk <= r.dep + r.walk && on(r, o.x)) blocks.push(o.x);
            if (!blocks.length) return;
            r.lane = r.z + (r === rw ? -r.dir : r.dir) * 0.45;
            r.merge = r.dir > 0 ? Math.max(...blocks) + 0.3 : Math.min(...blocks) - 0.3;
            r.a.z = r.edge ? r.lane : r.a.z;
            // Đi cùng nhau: người đi làn ngoài nhích lên trước nửa bước, nhìn từ sau lưng không chồng khít lên người kia
            if (this.pair) r.a.x += r.dir * 0.35;
        });
        if (umbrella) {
            man.umbrellaDir = V(0, 1, 0);
            woman.umbrellaDir = V(0, 1, 0);
        }
        // Cả hai đứng sẵn ở giữa (trời quang): đã đứng cạnh nhau ngắm pháo từ đầu
        if (rm.arrived && rw.arrived && !umbrella) {
            man.yaw = man.goalYaw = 0.32;
            woman.yaw = woman.goalYaw = -0.32;
            this.phase = 'watch';
        }
    }

    go(phase) {
        this.phase = phase;
        this.t = 0;
    }

    // Còn bao lâu nữa người này tới chỗ gặp (giây)
    eta(r) {
        if (r.arrived) return 0;
        const speed = Math.max(0.1, r.a.stride('walk').speed);
        if (r.walker) return r.walker.left / speed;
        return Math.max(0, r.dep - this.t) + r.walk;
    }

    update(dt, env) {
        const { m, w, rm, rw } = this;
        this.dt = dt;
        this.t += dt;
        const t = this.t;
        // Tới bằng làn lệch chưa kịp về đúng chỗ đứng: nhích dần cho hai người đứng ngang nhau
        [rm, rw].forEach(r => {
            if (r.arrived && this.phase !== 'meet' && Math.abs(r.a.z - r.z) > 0.01) r.a.z += clamp(r.z - r.a.z, -0.25 * dt, 0.25 * dt);
        });
        if (this.phase === 'wait' || this.phase === 'enter') {
            this.phase = 'enter';
            [rm, rw].forEach(r => {
                if (!r.arrived && !r.walker && t >= r.dep) {
                    r.walker = new Walker(r.a, r.x, 'walk', { z: r.z, lane: r.lane ?? r.z, turn: r.a.root.visible, merge: r.merge, speed: r.speed });
                    r.a.root.visible = true;
                }
                if (r.walker && !r.arrived && r.walker.update(dt)) {
                    r.arrived = true;
                    r.g = null;
                }
            });
            this.carry(env);
            [rm, rw].forEach(r => {
                const a = r.a;
                const o = r.other;
                if (!a.root.visible) return;
                if (!r.arrived && !r.walker) {
                    // Đứng chờ tới lượt đi: quay ra mặt nước, lâu lâu ngước nhìn pháo
                    a.goalYaw = 0;
                    this.glance(a, dt, env);
                } else if (!r.arrived) {
                    // Vừa đi vừa ngước nhìn pháo; người kia đã đứng đợi ở gần (hay vẫy tay gọi) thì nhìn người đó
                    if (o.arrived && (Math.abs(o.a.x - a.x) < 3.5 || o.waved)) lookAtActor(a, o.a, a === m ? -0.05 : 0.08);
                    else this.glance(a, dt, env);
                } else if (!o.arrived && this.eta(o) > (r.waits ? 4.5 : 6.5)) {
                    // Đứng đợi (người kia còn xa: vừa tới mà người kia đã gần thì đứng luôn hướng về phía đó, không quay
                    // ra mặt nước rồi lại quay vào)
                    r.waits = true;
                    this.waiting(r, dt, env);
                } else {
                    // Người kia sắp tới (hoặc đang dừng bước): quay sang phía người đó (đi cùng nhau thì không), nhìn người đó;
                    // người đó còn cách vài bước thì vẫy tay gọi (một lần)
                    if (this.greeting || this.umbrella) a.turnTo(r === rm ? Math.PI / 2 : -Math.PI / 2);
                    if (o.a.root.visible) lookAtActor(a, o.a, a === m ? -0.05 : 0.08);
                    const away = Math.abs(o.a.x - a.x);
                    if (!r.waved && !o.arrived && o.a.root.visible && away > 1.8 && away < 6 && !a.turning && a.clips.wave1 && !this.umbrella) {
                        r.waved = true;
                        a.play('wave1', { loop: false, fade: 0.4 });
                    }
                    // Vẫy xong (động tác vẫy của cô gái còn đứng lặng một lúc sau khi hạ tay) thì đứng thở
                    const waving = a.clipName === 'wave1' && a.remaining > 0.6 && a.current.time < 3.2;
                    if (!waving && a.clipName !== 'idle' && a.clipName !== 'stop') a.play('idle', { fade: 0.6 });
                }
            });
            this.handInHand();
            // Hai người đã tới: quay hẳn vào nhau rồi mới chào
            if (rm.arrived && rw.arrived && !this.greeting && !this.umbrella) {
                // Đi cùng nhau tới nơi thì không chào nhau nữa, quay ra mặt nước luôn
                this.go('turn');
            } else if (rm.arrived && rw.arrived) {
                m.turnTo(Math.PI / 2);
                w.turnTo(-Math.PI / 2);
                if (Math.abs(m.yaw - m.goalYaw) < 0.3 && Math.abs(w.yaw - w.goalYaw) < 0.3) this.go('meet');
            }
        } else if (this.phase === 'meet') {
            lookAtActor(m, w, -0.12);
            lookAtActor(w, m, 0.16);
            if (this.umbrella) this.foldUmbrella();
            else this.greet();
            if (t > (this.umbrella ? 4.6 : 4.5)) this.go('turn');
        } else if (this.phase === 'turn') {
            // Cùng quay ra mặt nước bằng bước chân, cô theo anh chậm một nhịp
            m.turnTo(0.32);
            if (t > 0.25) w.turnTo(-0.32);
            if (t < 0.6) {
                lookAtActor(m, w, -0.1);
                lookAtActor(w, m, 0.12);
            } else {
                lookSky(m, env);
                lookSky(w, env);
            }
            this.hands(env);
            // Vừa quay vừa bước sát lại thành vai kề vai (bước chân của động tác quay che chỗ dời)
            let gap = 0;
            if (this.greeting) {
                [[m, -0.19], [w, 0.19]].forEach(([a, x]) => {
                    if (a.turning || t > 0.5) a.x += clamp(x - a.x, -0.2 * dt, 0.2 * dt);
                    gap += Math.abs(x - a.x);
                });
            }
            if (t > 1 && !m.turning && !w.turning && gap < 0.02) this.go('watch');
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
            // Nhìn tới trước (động tác đi dạo của chàng trai hơi cúi đầu: ngẩng lên bù)
            a.lookGoal.yaw = 0;
            a.lookGoal.pitch = a.sex === 'm' ? 0.12 : 0.02;
        }
    }

    // Người tới trước đứng đợi người kia: quay ra mặt nước hơi ngoảnh về phía người kia sẽ tới, ngắm pháo, ngó về phía đó,
    // nhìn quanh, đổi chân, chàng trai gãi đầu, cô gái vén tóc (che ô thì chỉ ngó, nhìn quanh)
    waiting(r, dt, env) {
        const a = r.a;
        const o = r.other;
        const side = Math.sign((o.a.root.visible || o.walker ? o.a.x : o.from) - a.x) || (r === this.rm ? 1 : -1);
        a.turnTo(side * 0.35);
        if (!r.g || r.g.t >= r.g.dur) {
            const options = this.umbrella ? ['sky', 'toward', 'look', 'sky', 'toward']
                : ['sky', 'toward', 'look', 'sky', 'shift', 'toward', a.sex === 'm' ? 'scratch' : 'hair'];
            let name = r.g ? pick(options) : 'sky';
            if (r.g && name === r.g.name) name = pick(options);
            const clip = { look: 'look', shift: 'idle2', scratch: 'scratch', hair: 'hair' }[name];
            const dur = clip && a.clips[clip] ? a.clips[clip].duration : name === 'toward' ? rand(1.8, 3) : rand(3, 5.5);
            r.g = { name, t: 0, dur, clip };
            if (clip && a.clips[clip]) a.play(clip, { loop: false, fade: 0.6 });
            else if (a.clipName !== 'idle') a.play('idle', { fade: 0.6 });
        }
        const g = r.g;
        g.t += dt;
        a.lookGoal.roll = 0;
        if (g.name === 'toward') {
            // Ngó về phía người kia sẽ tới
            a.lookGoal.yaw = clamp(side * 1.6 - a.goalYaw, -1.1, 1.1);
            a.lookGoal.pitch = -0.05;
        } else if (g.clip && g.name !== 'shift') {
            a.lookGoal.yaw = 0;
            a.lookGoal.pitch = 0;
        } else {
            lookSky(a, env);
        }
        if (g.clip && a.clipName === g.clip && a.remaining < 0.6) a.play('idle', { fade: 0.8 });
    }

    // Đi cùng nhau (cùng một phía, sát cạnh nhau): nắm tay nhau mà đi
    handInHand() {
        const { m, w, rm, rw } = this;
        if (this.umbrella || !rm.walker || !rw.walker || rm.walker.state !== 'walk' || rw.walker.state !== 'walk') return;
        if (rm.dir !== rw.dir || Math.abs(m.x - w.x) > 0.7 || Math.abs(m.z - w.z) < 0.25) return;
        const p = holdPoint(m, w, 0.86);
        m.ik[1] = { target: p, pole: bodyDir(m, 0.3, -1, -0.5), tau: 0.3 };
        w.ik[0] = { target: p, pole: bodyDir(w, -0.3, -1, -0.5), tau: 0.3 };
        m.curlGoal[1] = 0.75;
        w.curlGoal[0] = 0.75;
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
        // Tay cầm ô trước ngực, cán hơi ngả về sau: tán ô nằm ngay trên đầu (tay thấp, cán chúi tới trước thì tán ô che
        // trước mặt, không giống đang che ô)
        m.ik[1] = { target: bodyPoint(m, 0.1, 1.22, 0.2), pole: bodyDir(m, 0.6, -1, -0.2) };
        w.ik[0] = { target: bodyPoint(w, -0.08, 1.12, 0.19), pole: bodyDir(w, -0.6, -1, -0.2) };
        m.curlGoal = [0.3, 0.9];
        w.curlGoal = [0.9, 0.25];
        m.umbrellaDir = bodyDir(m, -0.04, 1, -0.3).add(V(-env.wind * 0.06, 0, 0));
        w.umbrellaDir = bodyDir(w, 0.04, 1, -0.26).add(V(-env.wind * 0.06, 0, 0));
    }

    // Gặp nhau (trời quang): anh gật đầu chào, cô gật nhẹ đáp lại rồi vén tóc ra sau tai; tay cô vừa hạ thì anh đưa tay,
    // cô nắm lấy
    greet() {
        const { m, w } = this;
        const t = this.t;
        const nod = (a, from, len, depth) => {
            const k = (t - from) / len;
            if (k > 0 && k < 1) a.lookGoal.pitch -= depth * Math.sin(Math.PI * k);
        };
        nod(m, 0.05, 0.7, 0.3);
        nod(w, 0.35, 0.6, 0.18);
        if (t > 0.6 && !this.haired) {
            this.haired = true;
            w.play('hair', { loop: false, fade: 0.4 });
        }
        if (this.haired && w.clipName === 'hair' && w.remaining < 0.9) w.play('idle', { fade: 0.7 });
        if (t > 3.4) {
            const p = holdPoint(m, w, 0.9);
            m.ik[1] = { target: p, pole: bodyDir(m, 0.3, -1, -0.4), tau: 0.35 };
            m.curlGoal[1] = 0.75;
        }
        if (t > 3.9) {
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
            if (this.stepIn) this.stepIn.update(this.dt);
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
            // Anh choàng tay qua vai cô: bàn tay đặt lên đỉnh vai bên kia, cánh tay vòng sau lưng cô, khuỷu hạ xuống, ra sau
            // (khuỷu giơ cao thì tay duỗi ngang qua đầu cô). Cô vòng tay ôm ngang lưng anh
            const sh = w.worldOf('rightUpperArm').addScaledVector(bodyDir(w, -0.35, 0.4, -1), 0.1);
            m.ik[1] = { target: sh, pole: bodyDir(m, 0.25, -0.35, -1), tau: 0.4 };
            // Cô vòng tay ra sau lưng anh: khuỷu hạ xuống sau hông, cẳng tay nằm ngang thắt lưng, bàn tay áp giữa lưng (với
            // tới hông bên kia thì tay duỗi thẳng chéo cả lưng như cây gậy)
            const waist = bodyPoint(m, 0.02, 1.0, -0.14);
            w.ik[0] = { target: waist, pole: bodyDir(w, -0.1, -1, -0.8), tau: 0.4 };
            m.curlGoal = [0.3, 0.5];
            w.curlGoal = [0.5, 0.3];
            return;
        }
        let p = holdPoint(m, w, 0.84, 0.16);
        if (name === 'swing') p = p.add(V(0, 0.02 * Math.sin(gt * 3.4), 0.08 * Math.sin(gt * 3.4)));
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

    // Thỉnh thoảng đổi tư thế đứng (đứng thở, dồn trọng tâm sang chân kia), mỗi người một nhịp
    stance(a, dt) {
        a.stanceT = (a.stanceT ?? rand(1, 6)) - dt;
        if (a.stanceT > 0) return;
        a.stanceT = rand(7, 14);
        a.play(Math.random() < 0.4 ? 'idle2' : 'idle', { fade: 1 });
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
        }
        // Mỗi người đổi tư thế đứng (dồn trọng tâm) theo nhịp riêng
        [m, w].forEach(a => this.stance(a, dt));
        const g = this.g;
        g.t += dt;
        const t = g.t;
        const edge = Math.min(1, t / 0.9, (g.dur - t) / 0.9);
        // Người kia đáp lại chậm một nhịp
        const late = clamp(Math.min((t - 0.5) / 0.9, (g.dur - 0.3 - t) / 0.9), 0, 1);
        m.goalYaw = 0.32;
        w.goalYaw = -0.32;
        lookSky(m, env);
        lookSky(w, env);
        m.lookGoal.roll = 0;
        w.lookGoal.roll = 0;
        m.leanGoal = 0;
        w.leanGoal = 0;
        m.bowGoal = 0;
        w.bowGoal = 0;
        if (g.name === 'lean' || g.name === 'embrace' || (g.name === 'shelter' && t > 1.5)) {
            // Cô tựa đầu vào vai anh: cả người ngả sang trái của cô, thân trên nghiêng từ eo, đầu chỉ nghiêng thêm chút theo
            // thân (Actor3D); anh hơi ngả người, nghiêng đầu về phía cô
            w.leanGoal = -0.55 * edge;
            w.lookGoal.roll = -0.12 * edge;
            w.lookGoal.pitch -= 0.1 * edge;
            m.leanGoal = 0.12 * late;
            m.lookGoal.roll = 0.07 * late;
        } else if (g.name === 'gaze') {
            // Anh quay sang nhìn cô trước, cô nhận ra rồi ngước lên nhìn anh
            if (t > 0.6 && t < g.dur - 1) lookAtActor(m, w, -0.2);
            if (t > 1.1 && t < g.dur - 1.3) lookAtActor(w, m, 0.2);
            // Anh cúi xuống hôn lên tóc cô: nghiêng, cúi cả thân trên về phía cô, đầu cúi theo; cô hơi ngả vào anh
            const kiss = clamp((t - 2.2) / 0.7, 0, 1) * clamp((g.dur - 1.4 - t) / 0.6, 0, 1);
            m.leanGoal = 0.3 * kiss;
            m.bowGoal = 0.22 * kiss;
            m.lookGoal.pitch -= 0.2 * kiss;
            m.lookGoal.roll = 0.1 * kiss;
            w.leanGoal = -0.18 * kiss;
            w.lookGoal.roll = -0.08 * kiss;
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
    // from: chỗ bắt đầu { x: mét tính từ giữa, edge: đi vào từ ngoài khung, stand: đứng sẵn ở giữa }, mặc định chàng trai
    // từ mép trái, cô gái từ mép phải
    constructor(actor, { halfW, umbrella, from }) {
        this.a = actor;
        this.umbrella = umbrella;
        this.phase = 'wait';
        this.t = 0;
        this.g = null;
        this.last = '';
        const edge = halfW + 0.9;
        const f = from || { x: actor.sex === 'm' ? -edge : edge, edge: true };
        this.dir = f.stand || Math.abs(f.x) < 0.3 ? (actor.sex === 'm' ? 1 : -1) : f.x < 0 ? 1 : -1;
        this.edge = !!f.edge && !f.stand;
        actor.x = f.stand ? this.dir * 0.12 : f.x;
        actor.z = 0;
        // Ngoài khung thì quay sẵn hướng đi, chờ tới lượt mới hiện; đứng trong khung thì quay ra mặt nước ngắm pháo
        actor.yaw = actor.goalYaw = this.edge ? this.dir * Math.PI / 2 : this.dir * 0.1;
        actor.play('idle', { fade: 0.01 });
        actor.root.visible = !this.edge;
        // Đứng sẵn ở giữa: ngắm pháo luôn
        if (f.stand) this.phase = 'watch';
        this.umbHand = actor.sex === 'm' ? 1 : 0;
        if (umbrella) actor.umbrellaDir = V(0, 1, 0);
    }

    update(dt, env) {
        const a = this.a;
        this.t += dt;
        const t = this.t;
        if (this.phase === 'wait') {
            if (a.root.visible) {
                a.lookGoal.yaw = 0;
                a.lookGoal.pitch = -0.3;
            }
            if (t > 1) {
                this.walker = new Walker(a, this.dir * 0.12, 'walkSad', { turn: a.root.visible });
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
            if (this.walker.update(dt)) {
                this.phase = 'turn';
                this.t = 0;
            }
        } else if (this.phase === 'turn') {
            a.turnTo(this.dir * 0.1);
            a.lookGoal.pitch = -0.3;
            a.lookGoal.yaw = 0;
            if (t > 0.8 && !a.turning) this.phase = 'watch';
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
                a.ik[i] = { target: bodyPoint(a, sg * 0.08, 1.16, 0.2), pole: bodyDir(a, sg * 0.6, -1, -0.2) };
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
            a.umbrellaDir = bodyDir(a, this.umbHand ? 0.12 : -0.12, 1, down ? -0.18 : -0.45).add(V(-env.wind * 0.05, 0, 0));
        }
    }
}
