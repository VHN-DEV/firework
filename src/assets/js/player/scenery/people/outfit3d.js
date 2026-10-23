/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (người ngắm pháo: quần áo theo mùa)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Quần áo theo mùa cho nhân vật VRM (khăn len quàng cổ, tay áo dài, quần tất...): dựng bám đúng bề mặt mô hình, đo từ các
// đỉnh của thân lúc gắn khung xương, rồi mỗi đỉnh của đồ lấy trọng số xương của chỗ thân gần nhất nên cử động theo người
// (gập khuỷu, gối, quay cổ) như vải thật. Chất liệu nhân bản từ chất liệu áo của chính nhân vật (MToon: tô phẳng hai tông,
// viền nét) nên cùng nét vẽ. Tọa độ: không gian gắn khung (mét), mặt nhân vật nhìn về -Z.

import * as THREE from 'three';

const SKIN = 1;
const CLOTH = 2;

// Đồ theo mùa của từng người ('m' chàng trai, 'f' cô gái); mùa hạ để nguyên bộ đồ gốc. tops: màu áo (nhân với ảnh áo gốc);
// sleeves: tay áo dài; tights: quần tất (alpha: độ dày, thấp thì thấy da như tất mỏng); scarf: khăn len quàng cổ
const SHIRT = 0xf3f3f6;
const OUTFITS = {
    spring: {
        m: { tops: 0xd6efc0 },
        f: { sleeves: { color: SHIRT } }
    },
    autumn: {
        m: { tops: 0xead0a0 },
        f: { sleeves: { color: SHIRT }, tights: { color: 0x2e2426, alpha: 0.6 } }
    },
    winter: {
        m: { scarf: { color: 0x8e2a35, height: 0.07, depth: 0.04, back: true } },
        f: {
            scarf: { color: 0xeee6d8, height: 0.06, depth: 0.034 },
            sleeves: { color: SHIRT },
            tights: { color: 0x22222c, alpha: 0.84 }
        }
    }
};

// Các đỉnh của thân lúc gắn khung: vị trí, 4 xương + trọng số, loại (da, vải), xương chính; lưới ô 2 cm để tìm đỉnh gần
function sampleBody(vrm) {
    let skeleton = null;
    let cloth = null;
    const meshes = [];
    vrm.scene.traverse(o => {
        if (!o.isSkinnedMesh || o.userData.outfit) return;
        const mat = [].concat(o.material)[0];
        const kind = /_SKIN/.test(mat.name) ? SKIN : /_CLOTH/.test(mat.name) ? CLOTH : 0;
        if (!kind) return;
        if (!skeleton && /Body_00_SKIN/.test(mat.name)) skeleton = o.skeleton;
        if (!cloth && /Tops_01_CLOTH/.test(mat.name)) cloth = o;
        meshes.push({ o, kind });
    });
    if (!skeleton || !cloth) return null;
    const pos = [];
    const idx = [];
    const wt = [];
    const kinds = [];
    meshes.forEach(({ o, kind }) => {
        if (o.skeleton !== skeleton) return;
        const g = o.geometry;
        const p = g.attributes.position;
        const si = g.attributes.skinIndex;
        const sw = g.attributes.skinWeight;
        for (let i = 0; i < p.count; i++) {
            pos.push(p.getX(i), p.getY(i), p.getZ(i));
            for (let j = 0; j < 4; j++) {
                idx.push(si.getComponent(i, j));
                wt.push(sw.getComponent(i, j));
            }
            kinds.push(kind);
        }
    });
    const n = kinds.length;
    const main = new Int16Array(n);
    for (let i = 0; i < n; i++) {
        let best = 0;
        for (let j = 1; j < 4; j++) if (wt[i * 4 + j] > wt[i * 4 + best]) best = j;
        main[i] = idx[i * 4 + best];
    }
    const bone = name => {
        const node = vrm.humanoid.getRawBoneNode(name);
        return node ? skeleton.bones.indexOf(node) : -1;
    };
    // Vị trí xương lúc gắn khung
    const at = name => {
        const i = bone(name);
        if (i < 0) return null;
        return new THREE.Vector3().setFromMatrixPosition(skeleton.boneInverses[i].clone().invert());
    };
    const CELL = 0.02;
    const grid = new Map();
    const key = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
    for (let i = 0; i < n; i++) {
        const k = key(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
    }
    return { n, pos, idx, wt, kinds, main, bone, at, skeleton, cloth, grid, CELL };
}

// Các đỉnh thuộc nhóm xương bones (theo xương chính), loại kinds
function pick(body, bones, kinds = SKIN | CLOTH) {
    const set = new Set(bones.map(body.bone).filter(i => i >= 0));
    const out = [];
    for (let i = 0; i < body.n; i++) if (set.has(body.main[i]) && (body.kinds[i] & kinds)) out.push(i);
    return out;
}

// Trọng số xương cho điểm (x, y, z): trộn 4 đỉnh thân gần nhất (thuộc allow nếu có), gần hơn nặng hơn
function weightsAt(body, x, y, z, allow) {
    const { CELL, grid, pos } = body;
    const near = [];
    for (let r = 1; r <= 4 && near.length < 4; r++) {
        near.length = 0;
        const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL);
        for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -r; c <= r; c++) {
            const list = grid.get(`${cx + a},${cy + b},${cz + c}`);
            if (!list) continue;
            list.forEach(i => {
                if (allow && !allow.has(body.main[i])) return;
                const d = Math.hypot(pos[i * 3] - x, pos[i * 3 + 1] - y, pos[i * 3 + 2] - z);
                near.push([d, i]);
            });
        }
    }
    near.sort((p, q) => p[0] - q[0]);
    const acc = new Map();
    near.slice(0, 4).forEach(([d, i]) => {
        const w0 = 1 / (d + 0.004);
        for (let j = 0; j < 4; j++) {
            const b = body.idx[i * 4 + j];
            const w = body.wt[i * 4 + j];
            if (w > 0) acc.set(b, (acc.get(b) || 0) + w * w0);
        }
    });
    const top = [...acc].sort((p, q) => q[1] - p[1]).slice(0, 4);
    const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
    while (top.length < 4) top.push([0, 0]);
    return { index: top.map(([b]) => b), weight: top.map(([, w]) => w / sum) };
}

// Lưới có xương từ các đỉnh, mặt (tam giác), tọa độ ảnh; trọng số chép từ thân (allow: chỉ lấy từ các xương này)
function skinnedGeometry(body, verts, faces, uvs, allow) {
    const g = new THREE.BufferGeometry();
    const n = verts.length / 3;
    const si = new Float32Array(n * 4);
    const sw = new Float32Array(n * 4);
    const set = allow ? new Set(allow.map(body.bone).filter(i => i >= 0)) : null;
    for (let i = 0; i < n; i++) {
        const { index, weight } = weightsAt(body, verts[i * 3], verts[i * 3 + 1], verts[i * 3 + 2], set);
        for (let j = 0; j < 4; j++) {
            si[i * 4 + j] = index[j];
            sw[i * 4 + j] = weight[j];
        }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    g.setIndex(faces);
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
}

// Làm mượt một dãy số vòng tròn (bán kính theo góc); keep: không thấp hơn giá trị gốc (chỗ thân nhô ra không xuyên qua đồ)
function smoothRing(a, passes = 2, keep = false) {
    const raw = a.slice();
    for (let p = 0; p < passes; p++) {
        const b = a.slice();
        for (let i = 0; i < a.length; i++) a[i] = (b[(i + a.length - 1) % a.length] + 2 * b[i] + b[(i + 1) % a.length]) / 4;
    }
    if (keep) for (let i = 0; i < a.length; i++) a[i] = Math.max(a[i], raw[i]);
    return a;
}

// Ống bọc theo chuỗi xương (tay áo, ống quần tất): dọc trục xương, mỗi lát cắt đo bán kính lớn nhất của thân theo từng hướng
// rồi phồng ra offset. chain: tên xương từ gốc tới ngọn; from, to: đoạn trên chuỗi (0-1); flare: nới ở cuối ống (cổ tay)
function tube(body, chain, { from, to, offset, flare = 0, side = 24, step = 0.012, up = new THREE.Vector3(0, 1, 0), allow = chain.slice(0, -1) }) {
    const pts = chain.map(body.at);
    if (pts.some(p => !p)) return null;
    const seg = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
        const l = pts[i].distanceTo(pts[i - 1]);
        seg.push(l);
        total += l;
    }
    // Điểm trên chuỗi xương; quá đầu cuối (s > 1) thì kéo dài theo đoạn cuối
    const pointAt = s => {
        let d = s * total;
        for (let i = 0; i < seg.length; i++) {
            if (d <= seg[i] || i === seg.length - 1) return pts[i].clone().lerp(pts[i + 1], d / seg[i]);
            d -= seg[i];
        }
        return pts[pts.length - 1].clone();
    };
    const samples = pick(body, chain, SKIN);
    const P = body.pos;
    const count = Math.max(4, Math.round((to - from) * total / step));
    const rings = [];
    let U = null;
    let prevT = null;
    for (let s = 0; s <= count; s++) {
        const t = from + (to - from) * s / count;
        const C = pointAt(t);
        // Hướng trục: trung bình hai bên một đoạn ngắn cho mượt chỗ khớp
        const T = pointAt(Math.min(1, t + 0.03)).sub(pointAt(Math.max(0, t - 0.03))).normalize();
        if (!U) {
            U = up.clone().sub(T.clone().multiplyScalar(up.dot(T))).normalize();
        } else {
            U.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(prevT, T));
            U.sub(T.clone().multiplyScalar(U.dot(T))).normalize();
        }
        prevT = T;
        const V = new THREE.Vector3().crossVectors(T, U);
        const r = new Array(side).fill(0);
        const v = new THREE.Vector3();
        samples.forEach(i => {
            v.set(P[i * 3] - C.x, P[i * 3 + 1] - C.y, P[i * 3 + 2] - C.z);
            const along = v.dot(T);
            if (Math.abs(along) > 0.012) return;
            const a = v.dot(U);
            const b = v.dot(V);
            const ang = (Math.atan2(b, a) + Math.PI * 2) % (Math.PI * 2);
            const k = Math.round(ang / (Math.PI * 2) * side) % side;
            r[k] = Math.max(r[k], Math.hypot(a, b));
        });
        // Lát cắt không có đỉnh nào (vd trong giày): lấy theo lát trước; hướng không có đỉnh: lấy theo hai bên
        if (!r.some(Boolean) && rings.length) r.splice(0, side, ...rings[rings.length - 1].r);
        for (let k = 0; k < side; k++) {
            if (r[k]) continue;
            let a = 1, b = 1;
            while (!r[(k + side - a) % side] && a < side) a++;
            while (!r[(k + b) % side] && b < side) b++;
            r[k] = (r[(k + side - a) % side] + r[(k + b) % side]) / 2;
        }
        rings.push({ C, U: U.clone(), V, r: smoothRing(r, 2, true) });
    }
    // Mượt dọc ống, phồng ra offset, nới ở cuối
    const verts = [];
    const uvs = [];
    rings.forEach((ring, s) => {
        const prev = rings[Math.max(0, s - 1)].r;
        const next = rings[Math.min(rings.length - 1, s + 1)].r;
        const end = Math.max(0, (s - (rings.length - 3)) / 2);
        for (let k = 0; k <= side; k++) {
            const kk = k % side;
            const rr = Math.max(ring.r[kk], (prev[kk] + 2 * ring.r[kk] + next[kk]) / 4) + offset + flare * end;
            const ang = kk / side * Math.PI * 2;
            const p = ring.C.clone().addScaledVector(ring.U, Math.cos(ang) * rr).addScaledVector(ring.V, Math.sin(ang) * rr);
            verts.push(p.x, p.y, p.z);
            uvs.push(k / side, s / count);
        }
    });
    const faces = [];
    for (let s = 0; s < count; s++) {
        for (let k = 0; k < side; k++) {
            const a = s * (side + 1) + k, b = a + 1, c = a + side + 1, d = c + 1;
            faces.push(a, b, c, b, d, c);
        }
    }
    return { verts, faces, uvs, allow };
}

// Nối các mảnh (đỉnh, mặt, tọa độ ảnh) thành một
function join(parts) {
    const out = { verts: [], faces: [], uvs: [], allow: [] };
    parts.filter(Boolean).forEach(p => {
        const base = out.verts.length / 3;
        out.verts.push(...p.verts);
        out.uvs.push(...p.uvs);
        p.faces.forEach(f => out.faces.push(f + base));
        out.allow.push(...p.allow);
    });
    return out.verts.length ? out : null;
}

// Mặt trước (-Z) hoặc sau (+Z) của thân trong dải ngang |x - xc| < half, ở độ cao y: z của đỉnh nhô ra nhất
function surfaceZ(body, list, xc, half, y, back) {
    const P = body.pos;
    let best = null;
    list.forEach(i => {
        if (Math.abs(P[i * 3] - xc) > half || Math.abs(P[i * 3 + 1] - y) > 0.02) return;
        const z = P[i * 3 + 2];
        if (best === null || (back ? z > best : z < best)) best = z;
    });
    return best;
}

// Khăn len quàng cổ: một vòng khăn cuộn dày ôm quanh chân cổ (đo theo cổ, vai, mũ trùm áo), hai đuôi khăn rủ trước ngực,
// có thể thêm một đuôi vắt ra sau lưng
function scarf(body, { height, depth, back }) {
    const neck = body.at('neck');
    const chest = body.at('upperChest');
    if (!neck || !chest) return null;
    const torso = pick(body, ['neck', 'upperChest', 'chest', 'spine', 'leftShoulder', 'rightShoulder'], SKIN | CLOTH);
    const P = body.pos;
    // Vòng khăn: phía sau cao hơn phía trước (trước rơi xuống hõm cổ)
    const M = 48;
    const yBase = neck.y - height * 0.15;
    const yAt = th => yBase + Math.cos(th) * height * 0.25;
    const r = new Array(M).fill(0);
    torso.forEach(i => {
        const x = P[i * 3] - neck.x;
        const z = P[i * 3 + 2] - neck.z;
        const th = (Math.atan2(x, z) + Math.PI * 2) % (Math.PI * 2);
        const k = Math.round(th / (Math.PI * 2) * M) % M;
        if (Math.abs(P[i * 3 + 1] - yAt(th)) > height * 0.5) return;
        r[k] = Math.max(r[k], Math.hypot(x, z));
    });
    for (let k = 0; k < M; k++) if (!r[k]) r[k] = (r[(k + M - 1) % M] + r[(k + 1) % M]) / 2 || 0.06;
    smoothRing(r, 4);
    const K = 16;
    const verts = [];
    const uvs = [];
    const faces = [];
    for (let k = 0; k <= M; k++) {
        const th = (k % M) / M * Math.PI * 2;
        const n = new THREE.Vector3(Math.sin(th), 0, Math.cos(th));
        const R = r[k % M] + depth * 0.5 + 0.004;
        const c = new THREE.Vector3(neck.x, yAt(th), neck.z).addScaledVector(n, R);
        // Mặt cắt khăn cuộn: chữ nhật bo tròn, phồng nhẹ theo nhịp các vòng quấn
        const puff = 1 + 0.08 * Math.sin(th * 3);
        for (let j = 0; j <= K; j++) {
            const ps = j / K * Math.PI * 2;
            const cx = Math.sign(Math.cos(ps)) * Math.pow(Math.abs(Math.cos(ps)), 0.55) * depth * 0.5 * puff;
            const cy = Math.sign(Math.sin(ps)) * Math.pow(Math.abs(Math.sin(ps)), 0.55) * height * 0.5 * puff;
            const p = c.clone().addScaledVector(n, cx);
            p.y += cy;
            verts.push(p.x, p.y, p.z);
            uvs.push(k / M * 6, j / K);
        }
    }
    for (let k = 0; k < M; k++) {
        for (let j = 0; j < K; j++) {
            const a = k * (K + 1) + j, b = a + 1, c = a + K + 1, d = c + 1;
            faces.push(a, c, b, b, c, d);
        }
    }
    const parts = [{ verts, faces, uvs, allow: ['neck', 'upperChest', 'leftShoulder', 'rightShoulder'] }];
    // Đuôi khăn: dải vải dày buông từ dưới vòng khăn xuống trước ngực (hoặc sau lưng). Vải rủ thẳng: chạm chỗ thân nhô ra
    // nhất (ngực, mũ trùm) rồi buông thẳng xuống, không lùi vào chỗ lõm (bụng, eo); cả bề ngang dải phẳng như vải dày
    const front = pick(body, ['upperChest', 'chest', 'spine', 'neck', 'hips'], SKIN | CLOTH);
    const tail = (x0, drift, len, width, gap, behind) => {
        const NU = 3, NV = 12;
        const th = behind ? 0 : Math.PI;
        const top = yAt(th) - height * 0.2;
        const tv = [], tu = [], tf = [];
        const zs = [];
        let z = null;
        for (let v = 0; v <= NV; v++) {
            const y = top - len * v / NV;
            const s = surfaceZ(body, front, x0 + drift * v / NV, width * 0.5 + 0.01, y, behind);
            const want = s === null ? z : s + (behind ? gap : -gap);
            z = z === null ? want : want === null ? z : behind ? Math.max(z, want) : Math.min(z, want);
            zs.push(z ?? neck.z + (behind ? 0.12 : -0.12));
        }
        // Hai lớp (mặt ngoài, mặt trong) cách nhau thick; mép dưới hơi loe, hai mép bên hơi cong theo thân
        const thick = depth * 0.32;
        for (let layer = 0; layer < 2; layer++) {
            for (let v = 0; v <= NV; v++) {
                const y = top - len * v / NV;
                for (let u = 0; u <= NU; u++) {
                    const q = u / NU - 0.5;
                    const x = x0 + drift * v / NV + q * width * (1 + 0.12 * v / NV);
                    const bend = q * q * width * 0.35;
                    const out = (layer ? 0 : thick) - bend;
                    tv.push(x, y, zs[v] + (behind ? out : -out));
                    tu.push(u / NU, v / NV * len * 8);
                }
            }
        }
        const row = NU + 1, L = row * (NV + 1);
        const out = behind ? 1 : -1;
        // Tứ giác a b c d (theo vòng), mặt quay theo hướng dir
        const quad = (a, b, c, d, dir) => {
            const p = i => new THREE.Vector3(tv[i * 3], tv[i * 3 + 1], tv[i * 3 + 2]);
            const nrm = p(b).sub(p(a)).cross(p(c).sub(p(a)));
            if (nrm.dot(dir) >= 0) tf.push(a, b, c, a, c, d);
            else tf.push(a, c, b, a, d, c);
        };
        const ZO = new THREE.Vector3(0, 0, out), ZI = new THREE.Vector3(0, 0, -out);
        for (let v = 0; v < NV; v++) {
            for (let u = 0; u < NU; u++) {
                const a = v * row + u, b = a + 1, c = a + row + 1, d = a + row;
                quad(a, b, c, d, ZO);
                quad(a + L, b + L, c + L, d + L, ZI);
            }
        }
        // Mép quanh dải nối hai lớp
        const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
        for (let v = 0; v < NV; v++) {
            const l = v * row, r = v * row + NU;
            quad(l, l + row, l + row + L, l + L, X.clone().negate());
            quad(r, r + row, r + row + L, r + L, X);
        }
        for (let u = 0; u < NU; u++) {
            const t = u, b = NV * row + u;
            quad(t, t + 1, t + 1 + L, t + L, Y);
            quad(b, b + 1, b + 1 + L, b + L, Y.clone().negate());
        }
        return { verts: tv, faces: tf, uvs: tu, allow: ['upperChest', 'chest', 'spine', 'neck'] };
    };
    const w = height * 1.35;
    parts.push(tail(neck.x - w * 0.38, -w * 0.1, height * 4.4, w, 0.008, false));
    parts.push(tail(neck.x + w * 0.42, w * 0.06, height * 3.6, w * 0.95, 0.008 + depth * 0.35, false));
    if (back) parts.push(tail(neck.x - w * 0.62, -w * 0.12, height * 4, w * 0.95, 0.01, true));
    return join(parts);
}

// Ảnh len đan: gân dọc sáng tối xen kẽ (nhân màu chất liệu), lặp lại
let knitCache = null;

function knitTexture() {
    if (!knitCache) {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, 64, 64);
        for (let y = 0; y < 64; y += 8) {
            g.fillStyle = 'rgba(0, 0, 0, 0.16)';
            g.fillRect(0, y + 6, 64, 2);
            g.fillStyle = 'rgba(0, 0, 0, 0.06)';
            g.fillRect(0, y + 3, 64, 1);
        }
        knitCache = new THREE.CanvasTexture(c);
        knitCache.wrapS = knitCache.wrapT = THREE.RepeatWrapping;
        knitCache.colorSpace = THREE.SRGBColorSpace;
    }
    return knitCache;
}

// Chất liệu vải mới từ chất liệu áo của nhân vật (giữ cách tô, viền), màu color, ảnh map; kèm chất liệu viền nét như
// three-vrm dựng cho từng mảnh
const UV_MAPS = ['map', 'normalMap', 'emissiveMap', 'shadeMultiplyTexture', 'shadingShiftTexture', 'rimMultiplyTexture', 'outlineWidthMultiplyTexture', 'uvAnimationMaskTexture'];

function clothMaterials(base, color, map) {
    const m = base.clone();
    UV_MAPS.forEach(k => { if (m[k] !== undefined) m[k] = null; });
    m.map = map || null;
    m.shadeMultiplyTexture = map || null;
    m.color.set(color);
    // Mặt tối: cùng màu, sẫm hơn, ngả lạnh như các phần áo gốc
    const c = new THREE.Color(color);
    m.shadeColorFactor.setRGB(c.r * 0.62, c.g * 0.6, c.b * 0.7);
    m.alphaTest = 0;
    m.transparent = false;
    m.needsUpdate = true;
    const outline = m.clone();
    outline.isOutline = true;
    outline.side = THREE.BackSide;
    outline.needsUpdate = true;
    // Chép ma trận ảnh vào uniform (chất liệu này không nằm trong danh sách VRM cập nhật mỗi khung, ảnh cũng không đổi)
    [m, outline].forEach(x => x.update && x.update(0));
    return [m, outline];
}

function garment(body, part, mats, name) {
    const geo = skinnedGeometry(body, part.verts, part.faces, part.uvs, part.allow);
    const count = geo.index.count;
    geo.addGroup(0, count, 0);
    geo.addGroup(0, count, 1);
    const mesh = new THREE.SkinnedMesh(geo, mats);
    mesh.name = name;
    mesh.userData.outfit = true;
    mesh.renderOrder = body.cloth.renderOrder;
    mesh.frustumCulled = false;
    mesh.boundingBox = geo.boundingBox.clone();
    mesh.boundingSphere = geo.boundingSphere.clone();
    mesh.bind(body.skeleton, new THREE.Matrix4());
    return mesh;
}

// Mặc đồ mùa season cho nhân vật (sex 'm' | 'f'); đổi mùa thì bỏ đồ cũ. Đồ đã dựng giữ lại theo mùa, dựng lại không tốn
export function dress(vrm, sex, season) {
    dressSkin(vrm, sex, season);
    const data = vrm.scene.userData;
    const store = data.outfits || (data.outfits = {});
    Object.entries(store).forEach(([s, list]) => list.forEach(m => { m.visible = s === season; }));
    if (store[season]) return store[season];
    const spec = OUTFITS[season] && OUTFITS[season][sex];
    const list = store[season] = [];
    if (!spec) return list;
    const body = sampleBody(vrm);
    if (!body) return list;
    const base = [].concat(body.cloth.material)[0];
    const add = (part, color, map, name) => {
        if (!part) return;
        const mesh = garment(body, part, clothMaterials(base, color, map), name);
        body.cloth.parent.add(mesh);
        list.push(mesh);
    };
    if (spec.sleeves) {
        // Tay áo dài nối từ trong tay áo ngắn của áo gốc tới cổ tay
        const arms = ['left', 'right'].map(s => tube(body, [`${s}UpperArm`, `${s}LowerArm`, `${s}Hand`], { from: 0.22, to: 0.97, offset: 0.005, flare: 0.006 }));
        add(join(arms), spec.sleeves.color, null, 'sleeves');
    }
    if (spec.scarf) add(scarf(body, spec.scarf), spec.scarf.color, knitTexture(), 'scarf');
    return list;
}

// Quần tất tô thẳng lên ảnh da chân (chân mô hình gồ ghề chỗ mép tất, bắp chân: dựng ống bọc ngoài không khít), màu áo
// theo mùa; mùa khác trả lại ảnh, màu gốc
function dressSkin(vrm, sex, season) {
    const spec = (OUTFITS[season] && OUTFITS[season][sex]) || {};
    let skin = null;
    let tops = null;
    vrm.scene.traverse(o => {
        if (!o.isSkinnedMesh || o.userData.outfit) return;
        const name = [].concat(o.material)[0].name;
        if (!skin && /Body_00_SKIN/.test(name)) skin = o;
        if (!tops && /Tops_01_CLOTH/.test(name)) tops = o;
    });
    if (skin) {
        const mat = [].concat(skin.material)[0];
        const data = skin.userData;
        if (!data.skinMaps) data.skinMaps = { map: mat.map, shade: mat.shadeMultiplyTexture };
        let maps = data.skinMaps;
        if (spec.tights) {
            const key = `tights_${spec.tights.color}_${spec.tights.alpha}`;
            if (!data[key]) {
                // Da từ dưới hông một chút trở xuống (mép trên khuất trong váy)
                const hips = vrm.humanoid.getRawBoneNode('hips');
                const i = skin.skeleton.bones.indexOf(hips);
                const below = (i >= 0 ? new THREE.Vector3().setFromMatrixPosition(skin.skeleton.boneInverses[i].clone().invert()).y : 0.9) - 0.03;
                const paint = tex => (tex ? tintRegion(tex, skin.geometry, below, spec.tights) : null);
                const map = paint(maps.map);
                data[key] = { map, shade: maps.shade === maps.map ? map : paint(maps.shade) };
            }
            maps = data[key];
        }
        if (mat.map !== maps.map || mat.shadeMultiplyTexture !== maps.shade) {
            mat.map = maps.map;
            mat.shadeMultiplyTexture = maps.shade;
            mat.update(0);
        }
    }
    if (tops) {
        // Màu áo nhân với ảnh áo gốc (áo hoodie gốc gần trắng nên ra đúng màu); mặt tối nhân theo
        [].concat(tops.material).forEach(m => {
            const data = m.userData;
            if (!data.color) data.color = { lit: m.color.clone(), shade: m.shadeColorFactor.clone() };
            const tint = new THREE.Color(spec.tops === undefined ? 0xffffff : spec.tops);
            m.color.copy(data.color.lit).multiply(tint);
            m.shadeColorFactor.copy(data.color.shade).multiply(tint);
        });
    }
}

// Bản sao ảnh tex: vùng của các tam giác da nằm thấp hơn below (mét, tư thế gắn khung) phủ màu tights.color, độ đậm
// tights.alpha (để lại chút màu da như tất mỏng)
function tintRegion(tex, geometry, below, { color, alpha }) {
    const img = tex.image;
    const W = img.width, H = img.height;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const uv = geometry.attributes.uv;
    const pos = geometry.attributes.position;
    const index = geometry.index;
    const mask = document.createElement('canvas');
    mask.width = W;
    mask.height = H;
    const m = mask.getContext('2d');
    m.fillStyle = m.strokeStyle = `#${new THREE.Color(color).getHexString()}`;
    m.lineWidth = 2;
    m.lineJoin = 'round';
    m.beginPath();
    // Ảnh glTF không lật dọc (flipY false): tọa độ ảnh (u, v) là (x, y) tính từ góc trên trái
    const y = v => (tex.flipY ? 1 - v : v) * H;
    for (let t = 0; t < index.count; t += 3) {
        const a = index.getX(t), b = index.getX(t + 1), d = index.getX(t + 2);
        if (pos.getY(a) > below || pos.getY(b) > below || pos.getY(d) > below) continue;
        m.moveTo(uv.getX(a) * W, y(uv.getY(a)));
        m.lineTo(uv.getX(b) * W, y(uv.getY(b)));
        m.lineTo(uv.getX(d) * W, y(uv.getY(d)));
        m.closePath();
    }
    // Nét viền 2 điểm ảnh cho kín mép các mảnh ảnh (không lộ đường chỉ da)
    m.fill();
    m.stroke();
    g.globalAlpha = alpha;
    g.drawImage(mask, 0, 0);
    const out = tex.clone();
    out.source = new THREE.Source(c);
    out.needsUpdate = true;
    return out;
}
