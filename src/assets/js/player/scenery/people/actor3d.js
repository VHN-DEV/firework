/*!
 * Hanabi – trình phát: cảnh vật (người ngắm pháo: nhân vật anime)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Một nhân vật anime (mô hình VRM, tô kiểu MToon: màu phẳng, viền nét) cử động theo chuyển động quay từ người thật
// (đi dạo, dừng bước, đứng thở, nhìn quanh, vén tóc...), trộn chuyển tiếp mềm giữa các động tác. Nhân vật tiến lên đúng
// bằng quãng gốc khung xương đi được trong chuyển động (chân bám đất, không trượt). Trên nền chuyển động đó thêm:
// quay đầu nhìn pháo hoa, nghiêng đầu tựa vai, cánh tay tự với tới đích (nắm tay, cầm ô, đút túi, ôm vai...) bằng IK hai
// đoạn, ngón tay co tự nhiên hoặc nắm lại.
//
// Tọa độ của cảnh (mét): x sang phải màn hình, z đi vào trong (về phía mặt nước); yaw 0 là quay lưng về phía người xem,
// +π/2 là quay sang phải. Trong three.js: (x, y, -z), mô hình VRM 0.x nhìn về -Z nên rotation.y = -yaw.

import * as THREE from 'three';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const approach = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-dt / Math.max(1e-4, tau)));

const b64buf = s => {
    const bin = atob(s);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
};

// Dựng các AnimationClip của three.js từ dữ liệu chuyển động đã chuyển sang khung xương VRM (xem models/people/*-moves.json):
// quaternion cục bộ của từng xương chuẩn hóa (Int16), vị trí hông (Float32) theo từng khung
export function buildClips(vrm, data) {
    const clips = {};
    const hipsName = vrm.humanoid.getNormalizedBoneNode('hips').name;
    const nb = data.bones.length;
    Object.entries(data.clips).forEach(([name, c]) => {
        const q = new Int16Array(b64buf(c.q));
        const p = new Float32Array(b64buf(c.p));
        const times = Float32Array.from({ length: c.frames }, (_, i) => Math.min(c.dur, i / c.fps));
        const tracks = [];
        data.bones.forEach((bone, i) => {
            const node = vrm.humanoid.getNormalizedBoneNode(bone);
            if (!node) return;
            const v = new Float32Array(c.frames * 4);
            for (let f = 0; f < c.frames; f++) {
                for (let k = 0; k < 4; k++) v[f * 4 + k] = q[(f * nb + i) * 4 + k] / 32767;
            }
            tracks.push(new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, times, v));
        });
        tracks.push(new THREE.VectorKeyframeTrack(`${hipsName}.position`, times, p));
        const clip = new THREE.AnimationClip(name, c.dur, tracks);
        // Quãng tiến của gốc (theo -Z của mô hình) để đẩy nhân vật đi, tách khỏi tư thế
        clip.userData = { forward: Float32Array.from({ length: c.frames }, (_, f) => -p[f * 3 + 2]), fps: c.fps, frames: c.frames };
        clips[name] = clip;
    });
    return clips;
}

// Quãng tiến của gốc khung xương tại thời điểm t trong clip (nội suy)
function forwardAt(clip, t) {
    const { forward, fps, frames } = clip.userData;
    const x = clamp(t * fps, 0, frames - 1);
    const i = Math.floor(x);
    const f = x - i;
    return forward[i] + (forward[Math.min(frames - 1, i + 1)] - forward[i]) * f;
}

// Nghiêng người sang bên, cúi: phần góc của từng đốt sống (nghiêng, cúi), cộng thêm phần cả người ngả từ bàn chân
const LEAN = [['spine', 0.24, 0.3], ['chest', 0.16, 0.4], ['upperChest', 0.1, 0.3]];

// Ngón tay: đốt gần, giữa, xa; ngón cái
const FINGERS = ['Index', 'Middle', 'Ring', 'Little'];
const THUMB = ['ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal'];

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();

// Xoay xương một góc quanh trục trong hệ tọa độ thế giới (giữ nguyên các xương cha)
function rotateWorld(node, q) {
    node.getWorldQuaternion(_q1);
    _q1.premultiply(q);
    node.parent.getWorldQuaternion(_q2).invert();
    node.quaternion.copy(_q2.multiply(_q1));
    node.updateMatrixWorld(true);
}

// Váy (vật liệu "Bottoms" của mô hình VRoid): bán kính ngang lớn nhất quanh hông theo từng lát cao SKIRT_STEP, đo ở tư thế
// nghỉ. Trả về { from (độ cao lát dưới cùng so với hông, mét), r: [bán kính từng lát] } hoặc null khi không có váy
const SKIRT_STEP = 0.04;
// Tay cách mép váy bấy nhiêu (nửa bề dày bàn tay, váy đung đưa khi đi)
const SKIRT_GAP = 0.035;

function measureSkirt(root, hips) {
    const rows = new Map();
    const v = new THREE.Vector3();
    root.traverse(o => {
        if (!o.isMesh) return;
        const mats = [].concat(o.material);
        const geo = o.geometry;
        const index = geo.index;
        const groups = geo.groups.length ? geo.groups : [{ start: 0, count: index ? index.count : geo.attributes.position.count, materialIndex: 0 }];
        groups.forEach(g => {
            const m = mats[g.materialIndex];
            if (!m || !/Bottoms/i.test(m.name) || /Outline/i.test(m.name)) return;
            for (let i = g.start; i < g.start + g.count; i++) {
                o.getVertexPosition(index ? index.getX(i) : i, v).applyMatrix4(o.matrixWorld);
                const k = Math.round((v.y - hips.y) / SKIRT_STEP);
                rows.set(k, Math.max(rows.get(k) || 0, Math.hypot(v.x - hips.x, v.z - hips.z)));
            }
        });
    });
    if (!rows.size) return null;
    const lo = Math.min(...rows.keys());
    const hi = Math.max(...rows.keys());
    const r = [];
    for (let k = lo; k <= hi; k++) r.push(rows.get(k) || 0);
    // Lát không có đỉnh nào: lấy theo lát bên cạnh
    for (let i = 0; i < r.length; i++) if (!r[i]) r[i] = Math.max(r[i - 1] || 0, r[i + 1] || 0);
    return { from: lo * SKIRT_STEP, r };
}

export class Actor3D {
    constructor(sex, vrm, clips) {
        this.sex = sex;
        this.vrm = vrm;
        this.root = vrm.scene;
        this.clips = clips;
        this.h = vrm.humanoid;
        this.bone = name => this.h.getNormalizedBoneNode(name);
        this.mixer = new THREE.AnimationMixer(this.root);
        this.actions = {};
        this.current = null;
        this.prevTimes = new Map();
        this.x = 0;
        // Độ cao chỗ đứng (mét): đứng trên mặt cầu vồng thì cao dần lên giữa cầu
        this.y = 0;
        this.z = 0;
        this.yaw = 0;
        this.goalYaw = 0;
        this.moved = 0;
        // Lớp cử động thêm (tiến dần về đích)
        this.look = { yaw: 0, pitch: 0, roll: 0 };
        this.lookGoal = { yaw: 0, pitch: 0, roll: 0 };
        this.lean = 0;
        this.leanGoal = 0;
        this.bow = 0;
        this.bowGoal = 0;
        this.curl = [0.35, 0.35];
        this.curlGoal = [0.35, 0.35];
        // IK hai tay: { target (Vector3 thế giới three.js), pole, weight } hoặc null
        this.ik = [null, null];
        this.ikW = [0, 0];
        // Đích IK gần nhất của từng tay (tay thả ra thì nhả dần khỏi đích cũ)
        this.lastIk = [null, null];
        this.umbrella = null;
        this.fresh = true;
        const hips = this.bone('hips');
        this.hipsRest = hips.position.clone();
        this.root.traverse(o => {
            if (o.isMesh) o.frustumCulled = false;
        });
        // Chiều dài cánh tay (để IK), đo ở tư thế nghỉ
        this.root.updateMatrixWorld(true);
        this.armLen = ['left', 'right'].map(side => {
            const s = this.bone(`${side}UpperArm`).getWorldPosition(new THREE.Vector3());
            const e = this.bone(`${side}LowerArm`).getWorldPosition(new THREE.Vector3());
            const w = this.bone(`${side}Hand`).getWorldPosition(new THREE.Vector3());
            return [s.distanceTo(e), e.distanceTo(w)];
        });
        this.height = new THREE.Box3().setFromObject(this.root).max.y;
        this.restHead = this.bone('head').getWorldPosition(new THREE.Vector3()).y;
        // Váy xòe của cô gái (xem clearSkirt)
        this.skirt = sex === 'f' ? measureSkirt(this.root, this.bone('hips').getWorldPosition(new THREE.Vector3())) : null;
    }

    // Chuyển sang động tác name (trộn mờ trong fade giây). loop: lặp; once: làm một lượt rồi đứng ở khung cuối
    play(name, { fade = 0.45, loop = true, pingpong = false, speed = 1, from = 0 } = {}) {
        const clip = this.clips[name];
        if (!clip) return null;
        let action = this.actions[name];
        if (!action) action = this.actions[name] = this.mixer.clipAction(clip);
        if (this.current === action && action.isRunning()) {
            action.timeScale = speed;
            return action;
        }
        action.reset();
        action.time = from * clip.duration;
        action.timeScale = speed;
        action.setLoop(pingpong ? THREE.LoopPingPong : loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        action.clampWhenFinished = !loop;
        action.enabled = true;
        action.setEffectiveWeight(1);
        if (this.current && this.current !== action) {
            action.crossFadeFrom(this.current, fade, false);
        } else if (!this.current) {
            action.fadeIn(Math.min(fade, 0.01));
        }
        action.play();
        this.current = action;
        this.prevTimes.set(action, action.time);
        return action;
    }

    get clipName() {
        return this.current ? this.current.getClip().name : '';
    }

    // Phần còn lại của động tác đang làm (giây)
    get remaining() {
        const a = this.current;
        if (!a) return 0;
        return Math.max(0, (a.getClip().duration - a.time) / Math.max(0.01, Math.abs(a.timeScale)));
    }

    // Quãng gốc khung xương tiến được trong một vòng động tác (mét), và tốc độ trung bình
    stride(name) {
        const clip = this.clips[name];
        if (!clip) return { dist: 0, speed: 0 };
        const dist = forwardAt(clip, clip.duration) - forwardAt(clip, 0);
        return { dist, speed: dist / clip.duration };
    }

    // Quãng tiến còn lại (mét) của động tác name đang chạy, tới hết động tác
    remainingTravel(name) {
        const action = this.actions[name];
        if (!action) return 0;
        const clip = action.getClip();
        return forwardAt(clip, clip.duration) - forwardAt(clip, action.time);
    }

    get facing() {
        return [Math.sin(this.yaw), Math.cos(this.yaw)];
    }

    update(dt) {
        // Xoay người tới hướng đích (không nhanh quá 1,6 rad/s)
        const dy = this.goalYaw - this.yaw;
        this.yaw += clamp(dy * (1 - Math.exp(-dt / 0.35)), -1.6 * dt, 1.6 * dt);
        this.mixer.update(dt);
        // Quãng tiến của gốc khung xương theo các động tác đang chạy (cộng theo trọng số trộn)
        let advance = 0;
        Object.values(this.actions).forEach(a => {
            const prev = this.prevTimes.get(a);
            const now = a.time;
            this.prevTimes.set(a, now);
            if (prev === undefined || !a.isRunning() && a.getEffectiveWeight() === 0) return;
            const clip = a.getClip();
            const w = a.getEffectiveWeight();
            if (!w) return;
            let d = forwardAt(clip, now) - forwardAt(clip, prev);
            // Vòng lặp quay lại đầu: cộng thêm cả vòng
            if (now < prev && a.loop === THREE.LoopRepeat && a.timeScale > 0) d += forwardAt(clip, clip.duration) - forwardAt(clip, 0);
            if (Math.abs(d) < 0.5) advance += d * w;
        });
        const [fx, fz] = this.facing;
        this.x += fx * advance;
        this.z += fz * advance;
        this.moved += Math.abs(advance);
        // Giữ hông tại chỗ theo chiều tiến (đã chuyển thành bước đi của cả người), giữ lắc ngang, nhún lên xuống
        const hips = this.bone('hips');
        hips.position.z = this.hipsRest.z;
        this.root.position.set(this.x, this.y, -this.z);
        this.root.rotation.set(0, -this.yaw, 0);
        // Không cập nhật ma trận cả mô hình ở đây (lúc vẽ three.js làm lại): lớp cử động thêm đọc vị trí, hướng xương
        // bằng getWorld*, tự cập nhật theo chuỗi xương cha
        this.overlay(dt);
        this.vrm.update(dt);
        // Lần cập nhật đầu (mô hình dùng lại từ cảnh trước, chỗ đứng, hướng nhảy cóc): tóc, váy về dáng nghỉ theo tư thế mới,
        // không thì ngọn tóc còn ở chỗ cũ, hắt tung ra trước mặt vài khung
        if (this.fresh) {
            this.fresh = false;
            if (this.vrm.springBoneManager) this.vrm.springBoneManager.reset();
        }
    }

    // Lớp cử động thêm lên trên chuyển động: nhìn, nghiêng, ngón tay, IK tay
    overlay(dt) {
        const L = this.look;
        const G = this.lookGoal;
        L.yaw = approach(L.yaw, G.yaw, dt, 0.4);
        L.pitch = approach(L.pitch, G.pitch, dt, 0.45);
        L.roll = approach(L.roll, G.roll, dt, 0.5);
        this.lean = approach(this.lean, this.leanGoal, dt, 0.6);
        this.bow = approach(this.bow, this.bowGoal, dt, 0.6);
        // Nhìn: chia cho cổ 40%, đầu 60% (trục trong hệ của thân: ngẩng quanh trục ngang, quay quanh trục đứng)
        const body = _q3.setFromAxisAngle(_v3.set(0, 1, 0), -this.yaw);
        const right = _v1.set(1, 0, 0).applyQuaternion(body);
        const up = _v2.set(0, 1, 0);
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(body);
        if (Math.abs(this.lean) > 1e-3 || Math.abs(this.bow) > 1e-3) {
            // Nghiêng người sang bên (dương: sang phải của nhân vật) như tựa vào vai người kia, cúi (bow, dương: tới trước):
            // cả người ngả nhẹ từ bàn chân (dồn trọng tâm sang người kia, chân lệch chưa tới 1 cm), thân trên nghiêng, cúi
            // từ eo dần lên ngực; đầu chỉ nghiêng thêm chút theo thân (choreo.js), nghiêng mỗi cổ trông như gãy cổ. Xoay quanh
            // trục nhìn tới trước (fwd) một góc dương thì đỉnh đầu ngả sang phải
            const tilt = (k, b) => new THREE.Quaternion().setFromAxisAngle(fwd, this.lean * k).multiply(new THREE.Quaternion().setFromAxisAngle(right, -this.bow * b));
            this.root.quaternion.premultiply(tilt(0.07, 0));
            LEAN.forEach(([name, k, b]) => {
                const node = this.bone(name);
                if (node) rotateWorld(node, tilt(k, b));
            });
        }
        ['neck', 'head'].forEach((name, i) => {
            const k = i ? 0.6 : 0.4;
            const node = this.bone(name);
            if (!node) return;
            const q = new THREE.Quaternion().setFromAxisAngle(up, -L.yaw * k);
            q.multiply(new THREE.Quaternion().setFromAxisAngle(right.clone().applyAxisAngle(up, -L.yaw * k), L.pitch * k));
            // Nghiêng đầu (dương: sang phải của nhân vật), cùng chiều với nghiêng thân
            q.premultiply(new THREE.Quaternion().setFromAxisAngle(fwd, L.roll * k));
            rotateWorld(node, q);
        });
        // Váy xòe: tay buông (tay đang với tới đích bằng IK thì không đụng)
        if (this.skirt) ['left', 'right'].forEach((side, i) => this.clearSkirt(side, 1 - this.ikW[i]));
        // IK tay
        ['left', 'right'].forEach((side, i) => {
            const goal = this.ik[i];
            this.ikW[i] = approach(this.ikW[i], goal ? (goal.weight ?? 1) : 0, dt, goal && goal.tau ? goal.tau : 0.25);
            if (goal) this.lastIk[i] = goal;
            const g = goal || this.lastIk[i];
            if (g && this.ikW[i] > 0.002) this.solveArm(side, i, g, this.ikW[i]);
        });
        // Ngón tay co tự nhiên (buông), nắm lại (cầm ô, nắm tay)
        ['left', 'right'].forEach((side, i) => {
            this.curl[i] = approach(this.curl[i], this.curlGoal[i], dt, 0.2);
            this.curlFingers(side, this.curl[i]);
        });
    }

    // Bán kính váy ở độ cao dy (mét, so với hông); 0 là ngoài váy
    skirtAt(dy) {
        const { from, r } = this.skirt;
        const x = (dy - from) / SKIRT_STEP;
        if (x < -0.5 || x > r.length - 0.5) return 0;
        const i = clamp(Math.floor(x), 0, r.length - 1);
        const j = Math.min(r.length - 1, i + 1);
        return r[i] + (r[j] - r[i]) * clamp(x - i, 0, 1);
    }

    // Chuyển động quay từ người mặc quần: tay buông, vung khi đi sát hông nên lọt vào trong váy xòe. Giữa cẳng tay, cổ tay,
    // đầu ngón tay chỗ nào lọt vào trong vòng váy thì xoay bắp tay quanh vai, đẩy chỗ đó ra cách mép váy SKIRT_GAP theo
    // hướng từ hông ra (như người mặc váy xòe dang tay nhẹ). w: mức áp dụng
    clearSkirt(side, w) {
        if (w < 0.01) return;
        const ua = this.bone(`${side}UpperArm`);
        const la = this.bone(`${side}LowerArm`);
        const hand = this.bone(`${side}Hand`);
        const H = this.bone('hips').getWorldPosition(new THREE.Vector3());
        for (let pass = 0; pass < 2; pass++) {
            const S = ua.getWorldPosition(new THREE.Vector3());
            const E = la.getWorldPosition(new THREE.Vector3());
            const W = hand.getWorldPosition(new THREE.Vector3());
            let worst = 0.002;
            let at = null;
            let out = null;
            [E.clone().lerp(W, 0.5), W, W.clone().addScaledVector(W.clone().sub(E), 0.35)].forEach(P => {
                const R = this.skirtAt(P.y - H.y);
                const dx = P.x - H.x;
                const dz = P.z - H.z;
                const r = Math.hypot(dx, dz);
                if (!R || r < 1e-3 || R + SKIRT_GAP - r <= worst) return;
                worst = R + SKIRT_GAP - r;
                at = P;
                out = new THREE.Vector3(dx / r, 0, dz / r);
            });
            if (!at) return;
            // Xoay quanh trục vuông góc với (vai → chỗ lọt) và hướng ra ngoài: chỗ đó đi thẳng ra ngoài
            const arm = at.sub(S);
            const axis = arm.clone().cross(out);
            if (axis.lengthSq() < 1e-8) return;
            rotateWorld(ua, new THREE.Quaternion().setFromAxisAngle(axis.normalize(), worst * w / arm.length()));
        }
    }

    // IK hai đoạn: vai cố định, khuỷu tay gập về phía pole, cổ tay tới đích (trộn với tư thế chuyển động theo w)
    solveArm(side, i, goal, w) {
        const ua = this.bone(`${side}UpperArm`);
        const la = this.bone(`${side}LowerArm`);
        const hand = this.bone(`${side}Hand`);
        const S = ua.getWorldPosition(new THREE.Vector3());
        const E = la.getWorldPosition(new THREE.Vector3());
        const W = hand.getWorldPosition(new THREE.Vector3());
        const T = W.clone().lerp(goal.target, w);
        const [l1, l2] = this.armLen[i];
        const d = T.clone().sub(S);
        let dist = d.length();
        dist = clamp(dist, Math.abs(l1 - l2) + 0.01, (l1 + l2) * 0.999);
        d.normalize();
        const Tc = S.clone().addScaledVector(d, dist);
        const cosA = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1);
        const pole = (goal.pole || new THREE.Vector3(0, -1, 0)).clone();
        let p = pole.sub(d.clone().multiplyScalar(pole.dot(d)));
        if (p.lengthSq() < 1e-8) p = new THREE.Vector3(0, -1, 0);
        p.normalize();
        const E2 = S.clone().addScaledVector(d, l1 * cosA).addScaledVector(p, l1 * Math.sqrt(1 - cosA * cosA));
        // Bắp tay: xoay từ hướng cũ (vai→khuỷu) sang hướng mới
        rotateWorld(ua, new THREE.Quaternion().setFromUnitVectors(E.clone().sub(S).normalize(), E2.clone().sub(S).normalize()));
        const W2 = hand.getWorldPosition(new THREE.Vector3());
        const E3 = la.getWorldPosition(new THREE.Vector3());
        rotateWorld(la, new THREE.Quaternion().setFromUnitVectors(W2.clone().sub(E3).normalize(), Tc.clone().sub(E3).normalize()));
        // Bàn tay xoay theo cẳng tay mới (giữ góc cổ tay), hoặc hướng cho sẵn
        if (goal.handDir) {
            const H = hand.getWorldPosition(new THREE.Vector3());
            const mid = this.bone(`${side}MiddleProximal`);
            if (mid) {
                const M = mid.getWorldPosition(new THREE.Vector3());
                rotateWorld(hand, new THREE.Quaternion().setFromUnitVectors(M.sub(H).normalize(), goal.handDir.clone().normalize()));
            }
        }
    }

    // Co ngón tay (0 duỗi, 1 nắm chặt): xoay từng đốt quanh trục vuông góc với ngón, về phía lòng bàn tay
    curlFingers(side, amount) {
        const down = new THREE.Vector3(0, -1, 0);
        const sideSign = side === 'left' ? -1 : 1;
        FINGERS.forEach((f, fi) => {
            ['Proximal', 'Intermediate', 'Distal'].forEach((seg, si) => {
                const node = this.bone(`${side}${f}${seg}`);
                if (!node) return;
                // Ở tư thế chuẩn hóa ngón tay duỗi theo trục X (trái: +X với VRM 0.x nhìn -Z thì tay trái ở +X? lấy theo vị trí con)
                const child = node.children[0];
                const dir = child ? child.position.clone().normalize() : new THREE.Vector3(-sideSign, 0, 0);
                const axis = new THREE.Vector3().crossVectors(dir, down).normalize();
                const k = amount * (si === 0 ? 0.9 : si === 1 ? 1.25 : 0.9) * (1 + fi * 0.08);
                node.quaternion.setFromAxisAngle(axis, k * 1.15);
            });
        });
        THUMB.forEach((seg, si) => {
            const node = this.bone(`${side}${seg}`);
            if (!node) return;
            const child = node.children[0];
            const dir = child ? child.position.clone().normalize() : new THREE.Vector3(-sideSign, 0, 0);
            const axis = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, sideSign)).normalize();
            node.quaternion.setFromAxisAngle(axis, amount * (si ? 0.6 : 0.35));
        });
    }

    // Vị trí thế giới (three.js) của một xương
    worldOf(name, out = new THREE.Vector3()) {
        return this.bone(name).getWorldPosition(out);
    }
}
