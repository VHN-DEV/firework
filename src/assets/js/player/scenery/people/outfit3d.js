/*!
 * Hanabi – trình phát: cảnh vật (người ngắm pháo: quần áo theo mùa)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Quần áo theo mùa cho nhân vật VRM (áo măng tô, khăn len, tay áo dài...): dựng bám đúng bề mặt mô hình, đo từ các đỉnh của
// thân lúc gắn khung xương, rồi mỗi đỉnh của đồ lấy trọng số xương của chỗ thân gần nhất nên cử động theo người (gập khuỷu,
// gối, quay cổ) như vải thật. Đổi màu, đổi kiểu áo, quần gốc thì tô lại ảnh của chính nó. Chất liệu nhân bản từ chất liệu áo
// của nhân vật (MToon: tô phẳng hai tông, viền nét) nên cùng nét vẽ. Tọa độ: không gian gắn khung (mét), mặt nhìn về -Z.

import * as THREE from 'three';

const SKIN = 1;
const CLOTH = 2;
// Quần, váy (áo măng tô phủ ra ngoài thì không đo theo váy xòe)
const BOTTOMS = 4;
// Tóc (chỉ mũ len đo theo tóc; các món khác, cả trọng số xương, bỏ qua tóc)
const HAIR = 8;

// Đồ theo mùa của từng người ('m' chàng trai, 'f' cô gái); mùa hạ để nguyên bộ đồ gốc. sweater: áo nỉ, áo len thay áo
// hoodie (bỏ mũ trùm, mặc trong áo khoác); tee: áo thun ôm theo da thay áo hoodie (length như coat); pants: màu quần (tô lại theo độ sáng); tights: quần tất (alpha: độ dày, thấp thì
// thấy da như tất mỏng); coat: áo khoác (style: kiểu vải, không có là áo măng tô; length: gấu áo cao hơn xương hông bao
// nhiêu mét, không có là dài tới trên gối; open: vạt trước mở, xem coat(); overSkirt: phủ ngoài váy, váy ẩn đi; không thì
// đo theo ống quần, váy để lộ dưới gấu áo); scarf: khăn len quàng cổ (length, width: đuôi khăn dài, rộng bao nhiêu lần bề cao
// khăn; fringe: tua rua; backDepth: phía sau vòng khăn mỏng lại cho tóc dài phủ lên)
const OUTFITS = {
    // Xuân kiểu phố Nhật, Hàn: áo khoác mỏng ngoài áo. Chàng trai áo khoác jean màu nhạt mặc mở ngoài áo thun trắng; cô gái
    // áo trench màu be dài tới gối khoác ngoài đồng phục
    spring: {
        m: { tee: { color: 0xf4f4f6, length: -0.07 }, coat: { color: 0x86a3c8, style: 'denim', length: 0.02, open: { neck: 0.07, depth: 0.12, rest: 0.05 } } },
        f: { coat: { color: 0xd9c49c, style: 'trench', overSkirt: true } }
    },
    // Thu: áo cardigan len cổ chữ V. Chàng trai cardigan xanh than ngoài áo thun trắng, quần màu be; cô gái cardigan màu nâu
    // caramel ngoài đồng phục, quần tất mỏng
    autumn: {
        m: { tee: { color: 0xf4f4f6, length: -0.07 }, pants: 0xcdb48c, coat: { color: 0x323a52, style: 'knit', length: -0.04, open: { neck: 0.065, depth: 0.2, rest: 0 } } },
        f: { coat: { color: 0xc49a6c, style: 'knit', length: -0.02, open: { neck: 0.06, depth: 0.19, rest: 0 } }, tights: { color: 0x2e2426, alpha: 0.6 } }
    },
    // Đông kiểu phố Nhật, Hàn: áo măng tô dài, khăn len to bản quấn một vòng, hai đuôi có tua rua rủ trước ngực. Chàng trai
    // măng tô màu lạc đà ngoài áo len sẫm (hoodie bỏ mũ), khăn xám; cô gái măng tô màu than, khăn kem, quần tất đen
    winter: {
        m: {
            sweater: { color: 0x34363e },
            coat: { color: 0xb08d66 },
            scarf: { color: 0x7c7f88, height: 0.085, depth: 0.05, length: 5.6, width: 1.5, fringe: true }
        },
        f: {
            coat: { color: 0x2d2e35, overSkirt: true },
            scarf: { color: 0xf4f1ea, height: 0.08, depth: 0.048, length: 5.4, width: 1.5, fringe: true, backDepth: 0.45 },
            tights: { color: 0x22222c, alpha: 0.84 }
        }
    }
};

// Mũ len khi trời có tuyết (mùa nào cũng đội): màu len, miếng gắn ở gấu mũ (patch: nhãn hình núi, smile: mặt cười thêu),
// quả bông trên đỉnh; crown: mặt cắt rộng hơn chừng này (mét) mới tính là đỉnh đầu (lọn tóc dựng thì mũ đè xuống); snug: mũ
// ôm theo da đầu, tóc bị đè dày chừng này (tóc nhọn xù ép vào trong mũ); cuff: phần cao của gấu lật; rim: vành sau gáy, giữa
// trán (phần chiều cao đầu); slouch: đỉnh chùng ra sau gáy (mét). Chàng trai mũ xám cho khác màu tóc đen
const HATS = {
    m: { color: '#8f9197', badge: 'patch', crown: 0.05, snug: 0.012, cuff: 0.38, rim: [0.12, 0.4], slouch: 0.018 },
    f: { color: '#efe7d8', badge: 'smile', pompom: true, crown: 0.03 }
};

// Xương tay, ngón tay (áo măng tô đo thân không tính tay)
const ARM_BONES = ['UpperArm', 'LowerArm', 'Hand', 'ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal', 'IndexProximal',
    'IndexIntermediate', 'IndexDistal', 'MiddleProximal', 'MiddleIntermediate', 'MiddleDistal', 'RingProximal',
    'RingIntermediate', 'RingDistal', 'LittleProximal', 'LittleIntermediate', 'LittleDistal'];

// Phần mũ trùm của áo hoodie (mũ, dây mũ, cổ áo sau gáy): đỉnh nặng về xương phụ của mũ, xương cổ, hoặc xương vai mà cao
// hơn chân cổ (hai vạt mũ dựng lên hai bên). Trả về mảng đánh dấu từng đỉnh
function hoodMask(vrm, mesh) {
    const bones = mesh.skeleton.bones;
    const at = n => bones.indexOf(vrm.humanoid.getRawBoneNode(n));
    const neck = at('neck');
    const shoulders = new Set([at('leftShoulder'), at('rightShoulder')]);
    const hood = new Set();
    bones.forEach((b, i) => { if (/Hood/i.test(b.name)) hood.add(i); });
    const cut = bindY(mesh.skeleton, neck, 1.45) + 0.015;
    const g = mesh.geometry;
    const p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const mask = new Uint8Array(p.count);
    for (let i = 0; i < p.count; i++) {
        let best = 0;
        for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, best)) best = j;
        const b = si.getComponent(i, best);
        mask[i] = hood.has(b) || b === neck || (shoulders.has(b) && p.getY(i) > cut) ? 1 : 0;
    }
    return mask;
}

// Độ cao xương thứ i của skeleton lúc gắn khung
function bindY(skeleton, i, fallback) {
    return i >= 0 ? new THREE.Vector3().setFromMatrixPosition(skeleton.boneInverses[i].clone().invert()).y : fallback;
}

// Các đỉnh của thân lúc gắn khung: vị trí, 4 xương + trọng số, loại (da, vải, quần váy), xương chính; lưới ô 2 cm để tìm đỉnh
// gần. without: 'hood' bỏ phần mũ trùm của áo (mặc thành áo len), 'tops' bỏ cả áo (thay bằng áo thun ôm theo da)
function sampleBody(vrm, without = '') {
    let skin = null;
    let cloth = null;
    const meshes = [];
    vrm.scene.traverse(o => {
        if (!o.isSkinnedMesh || o.userData.outfit) return;
        const mat = [].concat(o.material)[0];
        let kind = /_SKIN/.test(mat.name) ? SKIN : /_CLOTH/.test(mat.name) ? CLOTH : /_HAIR/.test(mat.name) ? HAIR : 0;
        if (!kind) return;
        if (/Bottoms_01_CLOTH/.test(mat.name)) kind |= BOTTOMS;
        if (!skin && /Body_00_SKIN/.test(mat.name)) skin = o;
        if (!cloth && /Tops_01_CLOTH/.test(mat.name)) cloth = o;
        meshes.push({ o, kind });
    });
    if (!skin || !cloth) return null;
    const { skeleton } = skin;
    const body = { n: 0, pos: [], idx: [], wt: [], kinds: [], main: [], skeleton, skin, cloth, grid: new Map(), CELL: 0.02 };
    meshes.forEach(({ o, kind }) => {
        if (o.skeleton !== skeleton || (without === 'tops' && o === cloth)) return;
        absorb(body, o.geometry, kind, without === 'hood' && o === cloth ? hoodMask(vrm, o) : null);
    });
    body.bone = name => {
        const node = vrm.humanoid.getRawBoneNode(name);
        return node ? skeleton.bones.indexOf(node) : -1;
    };
    // Vị trí xương lúc gắn khung
    body.at = name => {
        const i = body.bone(name);
        if (i < 0) return null;
        return new THREE.Vector3().setFromMatrixPosition(skeleton.boneInverses[i].clone().invert());
    };
    return body;
}

// Thêm các đỉnh của lưới geometry vào mẫu thân (đồ đã mặc thành bề mặt mới để đồ mặc sau, như khăn, đo theo); skip: bỏ đỉnh
function absorb(body, geometry, kind = CLOTH, skip = null) {
    const p = geometry.attributes.position;
    const si = geometry.attributes.skinIndex;
    const sw = geometry.attributes.skinWeight;
    const { CELL, grid } = body;
    for (let i = 0; i < p.count; i++) {
        if (skip && skip[i]) continue;
        const n = body.n++;
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        body.pos.push(x, y, z);
        let best = 0;
        for (let j = 0; j < 4; j++) {
            body.idx.push(si.getComponent(i, j));
            body.wt.push(sw.getComponent(i, j));
            if (sw.getComponent(i, j) > sw.getComponent(i, best)) best = j;
        }
        body.main.push(si.getComponent(i, best));
        body.kinds.push(kind);
        const k = cellKey(Math.floor(x / CELL), Math.floor(y / CELL), Math.floor(z / CELL));
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(n);
    }
}

// Khóa số của ô lưới (x, y, z): mỗi trục ±256 ô 2 cm, thừa cho một người
const cellKey = (x, y, z) => ((x + 256) * 512 + (y + 256)) * 512 + (z + 256);

// Các đỉnh thuộc nhóm xương bones (theo xương chính), loại kinds
function pick(body, bones, kinds = SKIN | CLOTH) {
    const set = new Set(bones.map(body.bone).filter(i => i >= 0));
    const out = [];
    for (let i = 0; i < body.n; i++) if (set.has(body.main[i]) && (body.kinds[i] & kinds)) out.push(i);
    return out;
}

// Xương tay, ngón tay, đầu (chỉ số trong skeleton); from: bỏ qua mấy xương đầu của ARM_BONES (2: chỉ từ bàn tay trở ra)
function armBones(body, from = 0) {
    const set = new Set();
    ['left', 'right'].forEach(s => ARM_BONES.slice(from).forEach(n => set.add(body.bone(s + n))));
    ['head', 'leftEye', 'rightEye', 'jaw'].forEach(n => set.add(body.bone(n)));
    set.delete(-1);
    return set;
}

// Trọng số xương cho điểm (x, y, z): trộn 4 đỉnh thân gần nhất trong lưới grid (mặc định mọi đỉnh), gần hơn nặng hơn
function weightsAt(body, x, y, z, grid = body.grid) {
    const { pos } = body;
    const CELL = grid.cell || body.CELL;
    // 4 đỉnh gần nhất (khoảng cách, chỉ số), gần trước
    const bd = [Infinity, Infinity, Infinity, Infinity];
    const bi = [-1, -1, -1, -1];
    // Tìm rộng dần từng lớp ô quanh điểm (đồ rộng như gấu áo măng tô có thể cách thân hơn chục cm); đủ 4 đỉnh và đỉnh thứ tư
    // gần hơn lớp kế tiếp thì dừng (lớp ngoài không còn đỉnh nào gần hơn)
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL);
    const visit = (a, b, c) => {
        const list = grid.get(cellKey(cx + a, cy + b, cz + c));
        if (!list) return;
        for (let n = 0; n < list.length; n++) {
            const i = list[n];
            const d = Math.hypot(pos[i * 3] - x, pos[i * 3 + 1] - y, pos[i * 3 + 2] - z);
            if (d >= bd[3]) continue;
            let j = 3;
            for (; j > 0 && bd[j - 1] > d; j--) {
                bd[j] = bd[j - 1];
                bi[j] = bi[j - 1];
            }
            bd[j] = d;
            bi[j] = i;
        }
    };
    for (let r = 0; r <= 16; r++) {
        // Sáu mặt của lớp vỏ cách r ô (mỗi ô đúng một lần)
        if (!r) visit(0, 0, 0);
        for (let a = -r; a <= r && r; a++) {
            for (let b = -r; b <= r; b++) {
                visit(a, b, -r);
                visit(a, b, r);
            }
        }
        for (let a = -r; a <= r && r; a++) {
            for (let c = -r + 1; c < r; c++) {
                visit(a, -r, c);
                visit(a, r, c);
            }
        }
        for (let b = -r + 1; b < r && r; b++) {
            for (let c = -r + 1; c < r; c++) {
                visit(-r, b, c);
                visit(r, b, c);
            }
        }
        if (bd[3] <= r * CELL) break;
    }
    const acc = new Map();
    bi.forEach((i, n) => {
        if (i < 0) return;
        const w0 = 1 / (bd[n] + 0.004);
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

// Lưới có xương từ một mảnh đồ (đỉnh, mặt, tọa độ ảnh); trọng số chép từ thân. part.allow: tên các xương được lấy trọng số,
// hoặc hàm (chỉ số xương) => có được không
function skinnedGeometry(body, part) {
    const { verts, faces, uvs, allow } = part;
    const g = new THREE.BufferGeometry();
    const n = verts.length / 3;
    const si = new Float32Array(n * 4);
    const sw = new Float32Array(n * 4);
    // Lưới riêng chỉ gồm các đỉnh thân được phép, mỗi ô 1 cm giữ một đỉnh (thân rất dày đỉnh: tìm 4 đỉnh gần không phải tính
    // khoảng cách tới hàng nghìn đỉnh, trọng số vẫn đủ mịn)
    let test = () => true;
    if (typeof allow === 'function') test = allow;
    else if (allow) {
        const set = new Set(allow.map(body.bone).filter(i => i >= 0));
        test = b => set.has(b);
    }
    const grid = new Map();
    // Ô 4 cm: đồ rộng (gấu áo măng tô) cách thân vài cm, ô nhỏ thì phải quét quá nhiều ô
    const CELL = grid.cell = 0.04;
    const taken = new Set();
    const { pos } = body;
    for (let i = 0; i < body.n; i++) {
        if (!(body.kinds[i] & (SKIN | CLOTH)) || !test(body.main[i])) continue;
        const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
        const fine = cellKey(Math.floor(x / 0.01), Math.floor(y / 0.01), Math.floor(z / 0.01));
        if (taken.has(fine)) continue;
        taken.add(fine);
        const k = cellKey(Math.floor(x / CELL), Math.floor(y / CELL), Math.floor(z / CELL));
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
    }
    for (let i = 0; i < n; i++) {
        const { index, weight } = weightsAt(body, verts[i * 3], verts[i * 3 + 1], verts[i * 3 + 2], grid);
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
    // Hai đỉnh trùng chỗ nối vòng (mỗi đỉnh chỉ thấy mặt một bên): pháp tuyến chung cho khỏi lộ đường nối khi tô sáng tối
    const nrm = g.attributes.normal;
    (part.seams || []).forEach(([a, b]) => {
        const v = new THREE.Vector3().fromBufferAttribute(nrm, a).add(new THREE.Vector3().fromBufferAttribute(nrm, b)).normalize();
        nrm.setXYZ(a, v.x, v.y, v.z);
        nrm.setXYZ(b, v.x, v.y, v.z);
    });
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

// Hướng (góc) không có đỉnh nào: lấy theo hai hướng có đỉnh gần nhất hai bên
function fillRing(r) {
    const n = r.length;
    for (let k = 0; k < n; k++) {
        if (r[k]) continue;
        let a = 1, b = 1;
        while (!r[(k + n - a) % n] && a < n) a++;
        while (!r[(k + b) % n] && b < n) b++;
        r[k] = (r[(k + n - a) % n] + r[(k + b) % n]) / 2;
    }
    return r;
}

// Bán kính theo góc (r[k] ở góc k / n vòng) căng thành bao lồi: vải dày căng phẳng qua chỗ lõm (rãnh sống lưng, khe giữa hai
// chân) chứ không ôm theo; ôm theo thì viền nét ở chỗ gấp lõm lòi ra thành vệt tối
function convexRing(r) {
    const n = r.length;
    const pts = r.map((d, k) => [Math.sin(k / n * Math.PI * 2) * d, Math.cos(k / n * Math.PI * 2) * d]);
    // Bao lồi (chuỗi đơn điệu)
    const sorted = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const half = list => {
        const h = [];
        list.forEach(p => {
            while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
            h.push(p);
        });
        h.pop();
        return h;
    };
    const hull = half(sorted).concat(half(sorted.slice().reverse()));
    // Bán kính mới: chỗ tia từ tâm theo góc k cắt bao lồi
    return r.map((d, k) => {
        const dx = Math.sin(k / n * Math.PI * 2), dz = Math.cos(k / n * Math.PI * 2);
        let best = d;
        for (let i = 0; i < hull.length; i++) {
            const a = hull[i], b = hull[(i + 1) % hull.length];
            const ex = b[0] - a[0], ez = b[1] - a[1];
            const den = dx * ez - dz * ex;
            if (Math.abs(den) < 1e-9) continue;
            const t = (a[0] * ez - a[1] * ex) / den;
            const u = (a[0] * dz - a[1] * dx) / den;
            if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.max(best, t);
        }
        return best;
    });
}

// Ống bọc theo chuỗi xương (tay áo): dọc trục xương, mỗi lát cắt đo bán kính lớn nhất của thân (loại kinds) theo từng hướng
// rồi phồng ra offset. chain: tên xương từ gốc tới ngọn; from, to: đoạn trên chuỗi (0-1); flare: nới ở cuối ống (cổ tay);
// reach: mỗi lát đo các đỉnh cách nó bao xa dọc trục (áo bên trong hàng đỉnh thưa thì đo rộng);
// taper: tay áo rộng thu dần (bán kính không nhỏ hơn lát trước nhân taper), không bó theo từng chỗ lồi lõm của tay
function tube(body, chain, { from, to, offset, flare = 0, taper = 0, kinds = SKIN, side = 24, step = 0.012, reach = 0.012, up = new THREE.Vector3(0, 1, 0), allow = chain.slice(0, -1) }) {
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
    const samples = pick(body, chain, kinds);
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
            if (Math.abs(along) > reach) return;
            const a = v.dot(U);
            const b = v.dot(V);
            const ang = (Math.atan2(b, a) + Math.PI * 2) % (Math.PI * 2);
            const k = Math.round(ang / (Math.PI * 2) * side) % side;
            r[k] = Math.max(r[k], Math.hypot(a, b));
        });
        // Lát cắt không có đỉnh nào (vd trong giày): lấy theo lát trước
        if (!r.some(Boolean) && rings.length) r.splice(0, side, ...rings[rings.length - 1].r);
        fillRing(r);
        smoothRing(r, 2, true);
        if (taper && rings.length) {
            const prev = rings[rings.length - 1].r;
            for (let k = 0; k < side; k++) r[k] = Math.max(r[k], prev[k] * taper);
        }
        rings.push({ C, U: U.clone(), V, r });
    }
    // Mượt dọc ống, phồng ra offset, nới ở cuối
    const verts = [];
    const uvs = [];
    rings.forEach((ring, s) => {
        const prev = rings[Math.max(0, s - 1)].r;
        const next = rings[Math.min(rings.length - 1, s + 1)].r;
        const end = Math.max(0, (s - (rings.length - 3)) / 2);
        // Đoạn lùi vào trong thân (from < 0, như đầu ống tay áo khoác) thu nhỏ dần cho chìm vào trong thân áo, không thành gờ
        // trên vai
        const t = from + (to - from) * s / count;
        const sink = t < 0 ? 1 - 0.3 * t / from : 1;
        for (let k = 0; k <= side; k++) {
            const kk = k % side;
            const rr = (Math.max(ring.r[kk], (prev[kk] + 2 * ring.r[kk] + next[kk]) / 4) + offset) * sink + flare * end;
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

// Nối các mảnh (đỉnh, mặt, tọa độ ảnh) thành một (cùng cách lấy trọng số của mảnh đầu)
function join(parts) {
    const list = parts.filter(Boolean);
    if (!list.length) return null;
    const out = { verts: [], faces: [], uvs: [], allow: list[0].allow };
    if (Array.isArray(out.allow)) out.allow = [...new Set(list.flatMap(p => p.allow))];
    list.forEach(p => {
        const base = out.verts.length / 3;
        out.verts.push(...p.verts);
        out.uvs.push(...p.uvs);
        p.faces.forEach(f => out.faces.push(f + base));
    });
    return out;
}

// Thân áo khoác: từ chân cổ ôm theo vai, ngực, lưng (không tính tay; overSkirt: không tính váy); từ eo trở xuống buông thẳng
// (không bó vào giữa hai chân). length: gấu áo cao hơn xương hông chừng này (mét; áo ngắn như áo khoác jean, cardigan), không
// có thì dài tới trên gối như áo măng tô. open: vạt trước mở, nửa bề ngang chỗ hở (mét) ở chân cổ là neck, đổi dần tới rest ở
// depth dưới chân cổ (cổ chữ V của cardigan: rest 0, dưới đó cài cúc; áo khoác mặc mở: rest > 0). Tọa độ ảnh: u quanh thân (0
// sau lưng, 0,5 giữa ngực; áo có vạt mở thì u từ 0,5 ở mép vạt này vòng qua lưng tới 1,5 ở mép vạt kia), v từ cổ xuống gấu áo;
// marks: chiều dài áo (mét), v của eo, của đáy cổ chữ V (vẽ ảnh áo). offset: vải cách bề mặt bên dưới bao xa (mét)
function coat(body, { overSkirt = false, length = null, open = null, offset = 0.013 } = {}) {
    const neck = body.at('neck');
    const hips = body.at('hips');
    const knee = body.at('leftLowerLeg');
    if (!neck || !hips || !knee) return null;
    const arms = armBones(body);
    const P = body.pos;
    const cx = hips.x, cz = hips.z;
    // Mép trên ôm sát chân cổ (cổ áo bên trong không nhô lên quá)
    const top = neck.y + 0.012;
    const hem = length === null ? knee.y + 0.07 : hips.y + length;
    const waist = hips.y + 0.06;
    const step = 0.015;
    const N = 40;
    const count = Math.round((top - hem) / step);
    const byStation = Array.from({ length: count + 1 }, () => []);
    for (let i = 0; i < body.n; i++) {
        if (arms.has(body.main[i]) || (overSkirt && (body.kinds[i] & BOTTOMS)) || !(body.kinds[i] & (SKIN | CLOTH))) continue;
        // Mỗi đỉnh tính cho các lát trong khoảng ±3 cm: áo bên trong có hàng đỉnh thưa, mặt vải giữa hai hàng không có đỉnh
        // nào, chỉ đo đúng lát của đỉnh thì áo ngoài hụt, áo trong lòi ra thành từng dải
        const y = P[i * 3 + 1];
        const s0 = Math.max(0, Math.round((top - y - 0.03) / step));
        const s1 = Math.min(count, Math.round((top - y + 0.03) / step));
        // Mấy lát sát cổ chỉ đo đỉnh ngang hoặc cao hơn lát (dốc vai thấp hơn vài cm đã rộng gần bằng vai: đo cả vào thì mép cổ
        // áo xòe ngang thành gờ sau gáy)
        for (let s = s0; s <= s1; s++) if (s * step >= 0.045 || y >= top - s * step - 0.006) byStation[s].push(i);
    }
    const rings = [];
    for (let s = 0; s <= count; s++) {
        let r = new Array(N).fill(0);
        byStation[s].forEach(i => {
            const dx = P[i * 3] - cx, dz = P[i * 3 + 2] - cz;
            const k = Math.round(((Math.atan2(dx, dz) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * N) % N;
            r[k] = Math.max(r[k], Math.hypot(dx, dz));
        });
        if (!r.some(Boolean)) r = rings.length ? rings[rings.length - 1].slice() : new Array(N).fill(0.12);
        fillRing(r);
        r = convexRing(smoothRing(r, 2, true));
        // Dưới eo áo buông thẳng: không hẹp lại so với lát trên
        if (rings.length && top - s * step < waist) {
            const prev = rings[rings.length - 1];
            for (let k = 0; k < N; k++) r[k] = Math.max(r[k], prev[k]);
        }
        rings.push(r);
    }
    // Bán kính mượt dọc thân, phồng ra khỏi thân; ở góc bất kỳ thì nội suy hai hướng kề
    const radii = rings.map((r, s) => {
        const prev = rings[Math.max(0, s - 1)];
        const next = rings[Math.min(rings.length - 1, s + 1)];
        return r.map((v, k) => Math.max(v, (prev[k] + 2 * v + next[k]) / 4) + offset);
    });
    const radiusAt = (R, th) => {
        const f = (th / (Math.PI * 2) % 1 + 1) % 1 * N;
        const k = Math.floor(f);
        return R[k % N] + (R[(k + 1) % N] - R[k % N]) * (f - k);
    };
    // Nửa góc chỗ hở về một bên (side ±1) để mép vạt cách đường giữa đúng half theo chiều ngang
    const gap = (R, half, side) => {
        let g = 0;
        for (let i = 0; i < 3 && half > 0; i++) g = Math.asin(Math.min(0.95, half / radiusAt(R, Math.PI + side * g)));
        return g;
    };
    const verts = [];
    const uvs = [];
    // Áo có vạt mở: mỗi vòng đi từ mép vạt này qua lưng tới mép vạt kia, nên mép vạt là đường liền (bỏ ô lưới thì mép răng
    // cưa); vòng kín (dưới cổ chữ V) thì hai đầu trùng nhau ở giữa ngực, pháp tuyến hai đỉnh đó lấy chung (seams)
    const seams = [];
    const spans = [];
    radii.forEach((R, s) => {
        const y = top - s * step;
        let a = 0, b = Math.PI * 2;
        if (open) {
            const d = s * step;
            const half = d < open.depth ? open.neck + (open.rest - open.neck) * d / open.depth : open.rest;
            a = Math.PI + gap(R, half, 1);
            b = Math.PI * 3 - gap(R, half, -1);
            if (half <= 0) seams.push([s * (N + 1), s * (N + 1) + N]);
        }
        spans.push([a, b]);
        for (let k = 0; k <= N; k++) {
            const th = a + (b - a) * k / N;
            const r = radiusAt(R, th);
            verts.push(cx + Math.sin(th) * r, y, cz + Math.cos(th) * r);
            uvs.push((open ? 0.5 : 0) + k / N, s / count);
        }
    });
    const faces = [];
    for (let s = 0; s < count; s++) {
        for (let k = 0; k < N; k++) {
            const a = s * (N + 1) + k, b = a + 1, c = a + N + 1, d = c + 1;
            faces.push(a, c, b, b, c, d);
        }
    }
    // Trọng số lấy cả xương vai, cánh tay như áo bên trong (tư thế gắn khung dang tay: hạ tay xuống thì vải quanh vai phồng
    // ra, áo ngoài không theo thì áo trong xuyên ra), chỉ không lấy bàn tay, ngón tay, đầu; phủ ngoài váy thì không lấy xương
    // vật lý của váy (váy xếp ly xòe mạnh khi bước, vạt áo dạ theo thì tung lên như váy)
    const skip = armBones(body, 2);
    if (overSkirt) body.skeleton.bones.forEach((b, i) => { if (/Skirt/i.test(b.name)) skip.add(i); });
    const len = top - hem;
    const marks = { len, waist: (top - hips.y - 0.1) / len, vneck: open && !open.rest ? open.depth / len : 0 };
    // Điểm (x, y, z) lúc gắn khung có khuất hẳn dưới thân áo không: trừ dải sát mép cổ, gấu áo, mép vạt mở (margin mét)
    const cover = (x, y, z, margin = 0.025) => {
        if (y > top - 0.01 || y < hem + 0.02) return false;
        if (!open) return true;
        const s = Math.round((top - y) / step);
        let th = Math.atan2(x - cx, z - cz);
        if (th < Math.PI) th += Math.PI * 2;
        const m = margin / radiusAt(radii[s], th);
        return th > spans[s][0] + m && th < spans[s][1] - m;
    };
    return { verts, faces, uvs, seams, marks, cover, allow: b => !skip.has(b) };
}

// Ảnh áo măng tô (nhân màu chất liệu): nẹp cài giữa ngực, hàng cúc, nắp túi hai bên hông, gấu áo
let coatCache = null;

function coatTexture() {
    if (!coatCache) {
        const W = 256, H = 256;
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const g = c.getContext('2d');
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, W, H);
        // Nẹp áo chồng mép ở giữa ngực (u = 0,5)
        g.fillStyle = 'rgba(0, 0, 0, 0.45)';
        g.fillRect(W * 0.5 + 3, 0, 2, H);
        g.fillStyle = 'rgba(0, 0, 0, 0.12)';
        g.fillRect(W * 0.5 - 4, 0, 7, H);
        // Hàng cúc
        [0.16, 0.3, 0.44, 0.58].forEach(v => {
            g.fillStyle = 'rgba(0, 0, 0, 0.7)';
            g.beginPath();
            g.arc(W * 0.5 - 2, H * v, 3.2, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = 'rgba(255, 255, 255, 0.35)';
            g.beginPath();
            g.arc(W * 0.5 - 3, H * v - 1, 1, 0, Math.PI * 2);
            g.fill();
        });
        // Nắp túi hai bên hông
        [0.39, 0.61].forEach(u => {
            g.fillStyle = 'rgba(0, 0, 0, 0.4)';
            g.fillRect(W * u - 11, H * 0.5, 22, 2);
            g.fillStyle = 'rgba(0, 0, 0, 0.1)';
            g.fillRect(W * u - 11, H * 0.5 + 2, 22, 7);
        });
        // Gấu áo
        g.fillStyle = 'rgba(0, 0, 0, 0.25)';
        g.fillRect(0, H - 6, W, 2);
        coatCache = new THREE.CanvasTexture(c);
        coatCache.colorSpace = THREE.SRGBColorSpace;
        coatCache.flipY = false;
    }
    return coatCache;
}

// Ảnh trắng W×H để vẽ lên (chỉ vẽ tối hơn: ảnh nhân màu chất liệu) và bút vẽ: nét liền, nét đứt (chỉ may), cúc, sợi vải chéo
function sketch(W, H) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    const dark = a => `rgba(0, 0, 0, ${a})`;
    const path = (pts, a, width, dash) => {
        g.setLineDash(dash || []);
        g.strokeStyle = dark(a);
        g.lineWidth = width;
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.stroke();
        g.setLineDash([]);
    };
    return {
        c, g, dark,
        fold: (pts, a = 0.32, width = 2) => path(pts, a, width),
        stitch: (pts, a = 0.3) => path(pts, a, 1.4, [4, 3]),
        button: (x, y, r, a = 0.62) => {
            g.fillStyle = dark(a);
            g.beginPath();
            g.arc(x, y, r, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = 'rgba(255, 255, 255, 0.45)';
            g.beginPath();
            g.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2);
            g.fill();
        },
        twill: (a, gap = 4) => {
            g.strokeStyle = dark(a);
            g.lineWidth = 1;
            g.beginPath();
            for (let x = -H; x < W; x += gap) {
                g.moveTo(x, 0);
                g.lineTo(x + H, H);
            }
            g.stroke();
        },
        ribs: (x0, x1, y0, y1, a, gap = 4) => {
            g.fillStyle = dark(a);
            for (let x = x0; x < x1; x += gap) g.fillRect(x, y0, gap / 2, y1 - y0);
        }
    };
}

function canvasTexture(c) {
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    // Áo có vạt mở: u từ 0,5 tới 1,5
    tex.wrapS = THREE.RepeatWrapping;
    // Ảnh vẽ: dòng trên cùng là v = 0 (mặc định ảnh canvas bị lật dọc)
    tex.flipY = false;
    return tex;
}

// Ảnh thân áo theo kiểu (nhân màu chất liệu), vẽ theo số đo của áo (marks của coat): u = 0,5 giữa ngực (áo có vạt mở: cả
// hai mép vạt), 0 sau lưng; v từ cổ xuống gấu. Kích thước tính bằng mét: dọc chia chiều dài áo, ngang chia vòng thân ~0,9 m.
// knit: cardigan len (gân đan, nẹp len dọc hai mép cổ chữ V, cúc dưới cổ, gấu bo len); denim: áo khoác jean (vải chéo, cầu
// vai nhọn, túi ngực có nắp, đường may dọc, hàng cúc kim loại, cạp áo); trench: áo trench (hai hàng cúc, vạt chồng lệch,
// nắp vai, cầu vai sau, đai thắt eo có khóa, túi chéo, xẻ tà sau)
const garmentCache = {};

function garmentTexture(style, marks) {
    const key = [style, marks.len, marks.waist, marks.vneck].map(v => (typeof v === 'number' ? v.toFixed(3) : v)).join('_');
    if (garmentCache[key]) return garmentCache[key];
    const W = 512, H = 512;
    const { c, g, dark, fold, stitch, button, twill, ribs } = sketch(W, H);
    const X = m => m / 0.9 * W;
    const Y = m => m / marks.len * H;
    const mid = W / 2;
    if (style === 'tee') {
        // Áo thun: cổ tròn bo gân, gấu may
        const neck = Y(0.018);
        ribs(0, W, 0, neck, 0.12, 3);
        fold([[0, neck], [W, neck]], 0.22, 1.5);
        stitch([[0, H - Y(0.015)], [W, H - Y(0.015)]], 0.18);
    } else if (style === 'knit') {
        ribs(0, W, 0, H, 0.06, 5);
        // Gấu bo len: gân dọc dày
        const rib = H - Y(0.05);
        ribs(0, W, rib, H, 0.16);
        fold([[0, rib], [W, rib]], 0.26);
        // Nẹp len hai mép vạt (gân chạy dọc mép); dưới cổ chữ V hai nẹp chồng lên nhau, cài cúc
        const pw = X(0.022);
        ribs(mid - pw, mid + pw, 0, rib, 0.12, 3);
        fold([[mid - pw, 0], [mid - pw, H]], 0.3, 1.5);
        fold([[mid + pw, 0], [mid + pw, H]], 0.3, 1.5);
        const v0 = marks.vneck * H;
        fold([[mid + 1, v0], [mid + 1, rib]], 0.32, 1.5);
        for (let y = v0 + Y(0.03); y < rib - Y(0.02); y += Y(0.07)) button(mid, y, 3.6);
    } else if (style === 'denim') {
        twill(0.06);
        const band = H - Y(0.045);
        const yoke = Y(0.1);
        [-1, 1].forEach(s => {
            const at = m => mid + s * X(m);
            // Nẹp mép vạt, cầu vai trước nhọn xuống giữa túi ngực
            stitch([[at(0.022), 0], [at(0.022), band]]);
            fold([[at(0.022), yoke], [at(0.085), yoke + Y(0.022)], [at(0.22), yoke - Y(0.01)]]);
            stitch([[at(0.022), yoke + 4], [at(0.085), yoke + Y(0.022) + 4], [at(0.22), yoke - Y(0.01) + 4]]);
            // Túi ngực: nắp năm cạnh, cúc ở mũi nắp, miệng túi dưới nắp
            const flap = [[at(0.045), yoke + Y(0.03)], [at(0.125), yoke + Y(0.03)], [at(0.125), yoke + Y(0.06)], [at(0.085), yoke + Y(0.075)], [at(0.045), yoke + Y(0.06)]];
            g.fillStyle = dark(0.1);
            g.beginPath();
            flap.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
            g.closePath();
            g.fill();
            fold(flap.concat([flap[0]]), 0.38, 1.5);
            button(at(0.085), yoke + Y(0.062), 3);
            stitch([[at(0.045), yoke + Y(0.03)], [at(0.045), yoke + Y(0.14)], [at(0.125), yoke + Y(0.14)], [at(0.125), yoke + Y(0.03)]], 0.24);
            // Hai đường may dọc từ cầu vai xuống cạp
            [0.045, 0.125].forEach(m => stitch([[at(m), yoke + Y(0.14)], [at(m), band]], 0.26));
            // Đường sườn
            fold([[mid + s * W / 4, 0], [mid + s * W / 4, H]], 0.14, 1.5);
        });
        // Hàng cúc kim loại ở một vạt, khuyết ở vạt kia
        for (let y = Y(0.05); y < band; y += Y(0.085)) {
            button(mid + X(0.012), y, 3.2, 0.55);
            fold([[mid - X(0.018), y], [mid - X(0.006), y]], 0.45, 2);
        }
        // Cầu vai sau nhọn xuống giữa lưng (giữa lưng ở u = 0 = 1), hai đường may dọc lưng
        const back = Y(0.14);
        fold([[W * 0.75, back], [W, back + Y(0.035)]]);
        fold([[0, back + Y(0.035)], [W * 0.25, back]]);
        [X(0.075), W - X(0.075)].forEach(x => stitch([[x, back + Y(0.03)], [x, band]], 0.28));
        // Cạp áo, cúc ở cạp hai mép vạt
        fold([[0, band], [W, band]], 0.4);
        stitch([[0, band + 4], [W, band + 4]], 0.26);
        stitch([[0, H - 4], [W, H - 4]], 0.26);
        button(mid + X(0.012), band + Y(0.022), 3.2, 0.55);
    } else if (style === 'trench') {
        twill(0.035, 5);
        const belt = marks.waist * H;
        const bh = Y(0.04);
        // Vạt chồng cài chéo: mép vạt lệch sang một bên giữa ngực; hai hàng cúc trên đai, một hàng dưới đai
        const edge = mid + X(0.06);
        fold([[mid + X(0.015), 0], [edge, Y(0.07)], [edge, H]], 0.4);
        [Y(0.09), Y(0.18), belt - Y(0.08), belt + Y(0.1)].forEach(y => [-1, 1].forEach(s => button(mid + s * X(0.035), y, 3.6)));
        // Nắp vai che mưa một bên ngực, cầu vai sau
        fold([[mid + X(0.11), 0], [mid + X(0.11), Y(0.13)], [mid + X(0.2), Y(0.15)]], 0.3);
        const back = Y(0.17);
        fold([[W * 0.78, back], [W, back + Y(0.02)]], 0.3);
        fold([[0, back + Y(0.02)], [W * 0.22, back]], 0.3);
        // Đai thắt eo, khóa ở phía trước lệch bên, đuôi đai rủ xuống; quai giữ đai hai bên sườn
        g.fillStyle = dark(0.12);
        g.fillRect(0, belt - bh / 2, W, bh);
        fold([[0, belt - bh / 2], [W, belt - bh / 2]], 0.34, 1.5);
        fold([[0, belt + bh / 2], [W, belt + bh / 2]], 0.34, 1.5);
        stitch([[0, belt], [W, belt]], 0.18);
        const bx = mid + X(0.09);
        g.strokeStyle = dark(0.6);
        g.lineWidth = 2.5;
        g.strokeRect(bx - X(0.014), belt - bh * 0.62, X(0.028), bh * 1.24);
        g.fillStyle = dark(0.14);
        g.fillRect(bx + X(0.016), belt - bh * 0.4, X(0.026), bh * 0.8 + Y(0.1));
        fold([[bx + X(0.016), belt - bh * 0.4], [bx + X(0.016), belt + bh * 0.4 + Y(0.1)], [bx + X(0.042), belt + bh * 0.4 + Y(0.1)], [bx + X(0.042), belt - bh * 0.4]], 0.34, 1.5);
        [W * 0.25, W * 0.75].forEach(x => fold([[x - X(0.012), belt - bh * 0.7], [x - X(0.012), belt + bh * 0.7], [x + X(0.012), belt + bh * 0.7], [x + X(0.012), belt - bh * 0.7]], 0.34, 1.5));
        // Túi chéo có nắp hai bên
        [-1, 1].forEach(s => {
            const p = [[mid + s * X(0.13), belt + Y(0.07)], [mid + s * X(0.17), belt + Y(0.19)]];
            fold(p, 0.42);
            fold(p.map(([x, y]) => [x - s * X(0.014), y]), 0.2, 1.5);
        });
        // Đường giữa lưng, xẻ tà sau, gấu áo
        [1.5, W - 1.5].forEach(x => {
            fold([[x, back + Y(0.02)], [x, belt - bh / 2]], 0.18, 1.5);
            fold([[x, belt + Y(0.25)], [x, H]], 0.4);
        });
        stitch([[0, H - Y(0.025)], [W, H - Y(0.025)]], 0.26);
    }
    return (garmentCache[key] = canvasTexture(c));
}

// Ảnh tay áo theo kiểu áo (u quanh tay, v từ vai xuống cổ tay): knit gân đan, cổ tay bo len; denim vải chéo, măng sét cài
// cúc; trench quai cài ở cổ tay
const sleeveCache = {};

function sleeveTexture(style) {
    if (sleeveCache[style]) return sleeveCache[style];
    const W = 128, H = 256;
    const { c, g, dark, fold, stitch, button, twill, ribs } = sketch(W, H);
    if (style === 'knit') {
        ribs(0, W, 0, H, 0.06, 5);
        const rib = H * 0.9;
        ribs(0, W, rib, H, 0.16);
        fold([[0, rib], [W, rib]], 0.26);
    } else if (style === 'denim') {
        twill(0.06);
        const cuff = H * 0.92;
        fold([[0, cuff], [W, cuff]], 0.4);
        stitch([[0, cuff + 4], [W, cuff + 4]], 0.26);
        button(W * 0.5, H * 0.96, 3, 0.55);
    } else if (style === 'trench') {
        twill(0.035, 5);
        g.fillStyle = dark(0.12);
        g.fillRect(0, H * 0.84, W, H * 0.04);
        fold([[0, H * 0.84], [W, H * 0.84]], 0.34, 1.5);
        fold([[0, H * 0.88], [W, H * 0.88]], 0.34, 1.5);
        g.strokeStyle = dark(0.6);
        g.lineWidth = 2;
        g.strokeRect(W * 0.5 - 4, H * 0.835, 8, H * 0.05);
    }
    return (sleeveCache[style] = canvasTexture(c));
}

// Bản sao ảnh tex đổi sang màu color theo độ sáng (quần đen thành quần màu be): độ sáng từng điểm (lấy khoảng 5%-95% của
// các điểm ảnh) thành độ đậm nhạt quanh màu mới, giữ nếp vải, đường may
function recolorTexture(tex, color) {
    const img = tex.image;
    const W = img.width, H = img.height;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, W, H);
    const d = data.data;
    const lum = new Float32Array(W * H);
    const list = [];
    for (let i = 0; i < W * H; i++) {
        lum[i] = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2];
        if (d[i * 4 + 3] > 8 && i % 7 === 0) list.push(lum[i]);
    }
    list.sort((a, b) => a - b);
    const lo = list[Math.floor(list.length * 0.05)] || 0;
    const hi = Math.max(lo + 1, list[Math.floor(list.length * 0.95)] || 255);
    const rgb = [(color >> 16) & 255, (color >> 8) & 255, color & 255];
    for (let i = 0; i < W * H; i++) {
        const f = 0.62 + 0.5 * Math.max(0, Math.min(1, (lum[i] - lo) / (hi - lo)));
        for (let j = 0; j < 3; j++) d[i * 4 + j] = Math.min(255, rgb[j] * f);
    }
    g.putImageData(data, 0, 0);
    const out = tex.clone();
    out.source = new THREE.Source(c);
    out.needsUpdate = true;
    return out;
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

// Ảnh khăn len: phần trên (v < KNIT) gân dọc sáng tối xen kẽ, dải dưới cùng là tua rua (sợi len rời, giữa các sợi trong
// suốt) cho đuôi khăn
const KNIT = 0.86;
let knitCache = null;

function knitTexture() {
    if (!knitCache) {
        const W = 64, H = 256;
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const g = c.getContext('2d');
        const knitH = Math.round(H * KNIT);
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, W, knitH);
        for (let y = 0; y < knitH; y += 8) {
            g.fillStyle = 'rgba(0, 0, 0, 0.16)';
            g.fillRect(0, y + 6, W, 2);
            g.fillStyle = 'rgba(0, 0, 0, 0.06)';
            g.fillRect(0, y + 3, W, 1);
        }
        // Tua rua: sợi rộng 3 điểm ảnh cách nhau 2, dài ngắn so le
        for (let x = 1, i = 0; x < W; x += 5, i++) {
            const len = (H - knitH) * (0.78 + 0.22 * ((i * 7) % 5) / 4);
            g.fillStyle = '#ffffff';
            g.fillRect(x, knitH, 3, len);
            g.fillStyle = 'rgba(0, 0, 0, 0.12)';
            g.fillRect(x + 2, knitH, 1, len);
        }
        knitCache = new THREE.CanvasTexture(c);
        knitCache.wrapS = THREE.RepeatWrapping;
        knitCache.colorSpace = THREE.SRGBColorSpace;
        // Ảnh vẽ: dòng trên cùng là v = 0 (mặc định ảnh canvas bị lật dọc)
        knitCache.flipY = false;
    }
    return knitCache;
}

// Khăn len quàng cổ: một vòng khăn cuộn dày ôm quanh chân cổ (đo theo cổ, cổ áo), tựa lên vai, hai đuôi khăn rủ trước ngực
// (tua rua ở đuôi nếu có), có thể thêm một đuôi vắt ra sau lưng
function scarf(body, { height, depth, back, length = 4.4, width = 1.35, fringe = false, backDepth = 1 }) {
    const neck = body.at('neck');
    if (!neck) return null;
    const P = body.pos;
    // Vòng khăn quấn ôm cổ, tựa lên vai như khăn thật: vòng trong đo theo cổ và cổ áo (không tính vai, vai rộng hơn cổ
    // nhiều), rồi nâng từng đoạn lên cho đáy khăn nằm trên mặt vai bên dưới. Phía sau cao hơn phía trước (trước rơi xuống
    // hõm cổ)
    const M = 48;
    const yBase = neck.y - height * 0.15;
    const base = th => yBase + Math.cos(th) * height * 0.25;
    const bin = i => {
        const dx = P[i * 3] - neck.x, dz = P[i * 3 + 2] - neck.z;
        const th = (Math.atan2(dx, dz) + Math.PI * 2) % (Math.PI * 2);
        return { th, k: Math.round(th / (Math.PI * 2) * M) % M, d: Math.hypot(dx, dz) };
    };
    const collar = pick(body, ['neck', 'upperChest'], SKIN | CLOTH);
    const r = new Array(M).fill(0);
    collar.forEach(i => {
        const { th, k, d } = bin(i);
        if (Math.abs(P[i * 3 + 1] - base(th)) > height * 0.5) return;
        r[k] = Math.max(r[k], d);
    });
    for (let k = 0; k < M; k++) if (!r[k]) r[k] = (r[(k + M - 1) % M] + r[(k + 1) % M]) / 2 || 0.06;
    smoothRing(r, 4, true);
    // Mặt vai, ngực, lưng ngay dưới chân khăn: đáy khăn (lún nhẹ) không thấp hơn
    const rest = new Array(M).fill(-Infinity);
    pick(body, ['neck', 'upperChest', 'leftShoulder', 'rightShoulder'], SKIN | CLOTH).forEach(i => {
        const { k, d } = bin(i);
        if (d < r[k] || d > r[k] + depth + 0.01 || P[i * 3 + 1] > neck.y + height) return;
        rest[k] = Math.max(rest[k], P[i * 3 + 1]);
    });
    // Mượt hẳn theo vòng (khăn len mềm, lún nhẹ chỗ vai nhô), không nâng quá nửa bề cao khăn
    const lift = rest.map((y, k) => Math.min(height * 0.5, Math.max(0, y + height * 0.38 - base(k / M * Math.PI * 2))));
    smoothRing(lift, 12);
    const yAt = th => base(th) + lift[Math.round(th / (Math.PI * 2) * M) % M];
    // Đo lại vòng trong ở độ cao đã nâng (cổ áo cao hơn chỗ cũ không lòi qua khăn)
    collar.forEach(i => {
        const { k, d } = bin(i);
        if (Math.abs(P[i * 3 + 1] - yAt(k / M * Math.PI * 2)) > height * 0.5) return;
        r[k] = Math.max(r[k], d);
    });
    smoothRing(r, 2, true);
    const K = 16;
    const verts = [];
    const uvs = [];
    const faces = [];
    for (let k = 0; k <= M; k++) {
        const th = (k % M) / M * Math.PI * 2;
        const n = new THREE.Vector3(Math.sin(th), 0, Math.cos(th));
        // Tóc dài phủ lưng: phía sau vòng khăn mỏng lại (backDepth) cho nằm gọn dưới tóc, không lòi qua tóc thành mảng trắng
        const dk = depth * (1 - (1 - backDepth) * (1 + Math.cos(th)) / 2);
        const R = r[k % M] + dk * 0.5 + 0.004;
        const c = new THREE.Vector3(neck.x, yAt(th), neck.z).addScaledVector(n, R);
        // Mặt cắt khăn cuộn: chữ nhật bo tròn, phồng nhẹ theo nhịp các vòng quấn
        const puff = 1 + 0.08 * Math.sin(th * 3);
        for (let j = 0; j <= K; j++) {
            const ps = j / K * Math.PI * 2;
            const cx = Math.sign(Math.cos(ps)) * Math.pow(Math.abs(Math.cos(ps)), 0.55) * dk * 0.5 * puff;
            const cy = Math.sign(Math.sin(ps)) * Math.pow(Math.abs(Math.sin(ps)), 0.55) * height * 0.5 * puff;
            const p = c.clone().addScaledVector(n, cx);
            p.y += cy;
            verts.push(p.x, p.y, p.z);
            uvs.push(k / M * 6, j / K * KNIT * 0.95);
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
    // nhất (ngực, cổ áo) rồi buông thẳng xuống, không lùi vào chỗ lõm (bụng, eo); cả bề ngang dải phẳng như vải dày. Có tua
    // rua thì thêm một hàng cuối dài fringeLen mang phần ảnh tua rua
    const front = pick(body, ['upperChest', 'chest', 'spine', 'neck', 'hips'], SKIN | CLOTH);
    const fringeLen = fringe ? height * 0.6 : 0;
    const tail = (x0, drift, len, w, gap, behind) => {
        const NU = 3, NV = 12;
        const rows = NV + (fringe ? 1 : 0);
        const th = behind ? 0 : Math.PI;
        const top = yAt(th) - height * 0.2;
        const yOf = v => top - (v <= NV ? len * v / NV : len + fringeLen);
        const tv = [], tu = [], tf = [];
        const zs = [];
        let z = null;
        for (let v = 0; v <= rows; v++) {
            const s = surfaceZ(body, front, x0 + drift * Math.min(v, NV) / NV, w * 0.5 + 0.01, yOf(v), behind);
            const want = s === null ? z : s + (behind ? gap : -gap);
            z = z === null ? want : want === null ? z : behind ? Math.max(z, want) : Math.min(z, want);
            zs.push(z ?? neck.z + (behind ? 0.12 : -0.12));
        }
        // Hai lớp (mặt ngoài, mặt trong) cách nhau thick; mép dưới hơi loe, hai mép bên hơi cong theo thân
        const thick = depth * 0.32;
        for (let layer = 0; layer < 2; layer++) {
            for (let v = 0; v <= rows; v++) {
                const vv = Math.min(v, NV);
                for (let u = 0; u <= NU; u++) {
                    const q = u / NU - 0.5;
                    const x = x0 + drift * vv / NV + q * w * (1 + 0.12 * vv / NV);
                    const bend = q * q * w * 0.35;
                    const out = (layer ? 0 : thick) - bend;
                    tv.push(x, yOf(v), zs[v] + (behind ? out : -out));
                    tu.push(u / NU, v <= NV ? v / NV * KNIT * 0.95 : 0.999);
                }
            }
        }
        const row = NU + 1, L = row * (rows + 1);
        const out = behind ? 1 : -1;
        // Tứ giác a b c d (theo vòng), mặt quay theo hướng dir
        const quad = (a, b, c, d, dir) => {
            const p = i => new THREE.Vector3(tv[i * 3], tv[i * 3 + 1], tv[i * 3 + 2]);
            const nrm = p(b).sub(p(a)).cross(p(c).sub(p(a)));
            if (nrm.dot(dir) >= 0) tf.push(a, b, c, a, c, d);
            else tf.push(a, c, b, a, d, c);
        };
        const ZO = new THREE.Vector3(0, 0, out), ZI = new THREE.Vector3(0, 0, -out);
        for (let v = 0; v < rows; v++) {
            for (let u = 0; u < NU; u++) {
                const a = v * row + u, b = a + 1, c = a + row + 1, d = a + row;
                quad(a, b, c, d, ZO);
                quad(a + L, b + L, c + L, d + L, ZI);
            }
        }
        // Mép quanh dải nối hai lớp
        const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
        for (let v = 0; v < rows; v++) {
            const l = v * row, rr = v * row + NU;
            quad(l, l + row, l + row + L, l + L, X.clone().negate());
            quad(rr, rr + row, rr + row + L, rr + L, X);
        }
        for (let u = 0; u < NU; u++) {
            const t = u, b = rows * row + u;
            quad(t, t + 1, t + 1 + L, t + L, Y);
            quad(b, b + 1, b + 1 + L, b + L, Y.clone().negate());
        }
        return { verts: tv, faces: tf, uvs: tu, allow: ['upperChest', 'chest', 'spine', 'neck'] };
    };
    const w = height * width;
    parts.push(tail(neck.x - w * 0.38, -w * 0.1, height * length, w, 0.008, false));
    parts.push(tail(neck.x + w * 0.42, w * 0.06, height * length * 0.82, w * 0.95, 0.008 + depth * 0.35, false));
    if (back) parts.push(tail(neck.x - w * 0.62, -w * 0.12, height * length * 0.9, w * 0.95, 0.01, true));
    return join(parts);
}

// Mũ len: chỏm mũ trùm đầu (quanh trục đứng qua giữa đầu, từng hàng từ vành lên đỉnh, căng tròn như len dệt), vành trước
// ngang trên lông mày, sau thấp xuống gáy; gấu mũ lật dày hơn; quả bông xù trên đỉnh nếu có. Mũ cứng theo đầu. snug: mũ ôm,
// đo theo da đầu cộng lớp tóc bị đè dày chừng này (mét), tóc trong vùng mũ ép vào (squeeze); không thì trùm theo tóc. Tọa
// độ ảnh: u quanh đầu (0 sau gáy, 0,5 giữa trán), v từ vành (0) lên đỉnh (1). Trả về mảnh mũ và squeeze(x, y, z): điểm tóc
// ép vào trong mũ
function beanie(body, { pompom = false, crown = 0.03, snug = 0, cuff = 0.24, rim: [rimBack, rimFront] = [0.17, 0.47], slouch = 0 }) {
    const head = body.at('head');
    if (!head) return null;
    const P = body.pos;
    const headBone = body.bone('head');
    const scalp = [];
    const hair = [];
    for (let i = 0; i < body.n; i++) {
        if (P[i * 3 + 1] < head.y) continue;
        if (body.kinds[i] & HAIR) hair.push(i);
        else if ((body.kinds[i] & SKIN) && body.main[i] === headBone) scalp.push(i);
    }
    // Mũ ôm đo theo da đầu, mũ trùm đo theo cả tóc
    const list = snug ? scalp : scalp.concat(hair);
    if (!list.length) return null;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    list.forEach(i => {
        if (P[i * 3 + 1] < head.y + 0.05) return;
        x0 = Math.min(x0, P[i * 3]);
        x1 = Math.max(x1, P[i * 3]);
        z0 = Math.min(z0, P[i * 3 + 2]);
        z1 = Math.max(z1, P[i * 3 + 2]);
    });
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    // Đỉnh đầu: độ cao cao nhất mà mặt cắt ở đó còn rộng hơn crown theo cả hai chiều ngang (bỏ qua lọn tóc mảnh dựng đứng,
    // mũ đè xuống)
    const slices = new Map();
    list.forEach(i => {
        const b = Math.floor(P[i * 3 + 1] / 0.005);
        const s = slices.get(b) || [Infinity, -Infinity, Infinity, -Infinity];
        s[0] = Math.min(s[0], P[i * 3]);
        s[1] = Math.max(s[1], P[i * 3]);
        s[2] = Math.min(s[2], P[i * 3 + 2]);
        s[3] = Math.max(s[3], P[i * 3 + 2]);
        slices.set(b, s);
    });
    const top = Math.max(...[...slices].filter(([, s]) => s[1] - s[0] > crown && s[3] - s[2] > crown).map(([b]) => (b + 1) * 0.005)) + snug;
    const span = top - head.y;
    // Vành mũ: sau gáy thấp, giữa trán cao (phần chiều cao đầu tính từ xương đầu)
    const rim = th => head.y + span * (rimBack + (rimFront - rimBack) * (1 - Math.cos(th)) / 2);
    const N = 40, ROWS = 12;
    const rowY = (th, j) => rim(th) + (top - 0.004 - rim(th)) * Math.pow(j / ROWS, 0.85);
    const bin = i => Math.round(((Math.atan2(P[i * 3] - cx, P[i * 3 + 2] - cz) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * N) % N;
    const rings = [];
    for (let j = 0; j <= ROWS; j++) {
        let r = new Array(N).fill(0);
        list.forEach(i => {
            const k = bin(i);
            // Quanh hàng này, gần đỉnh chỉ lấy từ hàng trở lên: chỏm mũ tròn theo đỉnh đầu, không bằng đầu như ống
            const dy = P[i * 3 + 1] - rowY(k / N * Math.PI * 2, j);
            if (dy < (j < ROWS - 2 ? -0.015 : -0.006) || dy > 0.04) return;
            r[k] = Math.max(r[k], Math.hypot(P[i * 3] - cx, P[i * 3 + 2] - cz));
        });
        if (!r.some(Boolean)) r = rings.length ? rings[rings.length - 1].map(v => v * 0.8) : new Array(N).fill(0.08);
        fillRing(r);
        r = convexRing(smoothRing(r, 3, true)).map(v => v + snug);
        rings.push(r);
    }
    // Lên tới đỉnh không phình ra (len căng tròn): mỗi hàng không rộng hơn hàng dưới
    for (let j = 1; j <= ROWS; j++) for (let k = 0; k < N; k++) rings[j][k] = Math.min(rings[j][k], rings[j - 1][k]);
    // Lòng mũ ở hàng j, góc k (trước khi thu đỉnh): tóc ép vào trong chừng này
    const inner = (j, k) => rings[j][k] * (1 - 0.22 * Math.pow(j / ROWS, 5));
    // Mũ ôm: len mỏng sát; mũ trùm: chùng nhẹ (tóc đung đưa không xuyên qua)
    const thick = snug ? 0.006 : 0.012;
    // Đỉnh chùng ra sau gáy (mũ len mềm đội lệch về sau)
    const back = v => slouch * Math.pow(Math.max(0, v - 0.45) / 0.55, 2);
    const verts = [];
    const uvs = [];
    for (let j = 0; j <= ROWS; j++) {
        const v = j / ROWS;
        // Gấu lật dày hơn phần chỏm
        const out = thick + (v < cuff ? 0.006 : 0);
        for (let k = 0; k <= N; k++) {
            const th = (k % N) / N * Math.PI * 2;
            const R = inner(j, k % N) + out;
            verts.push(cx + Math.sin(th) * R, rowY(th, j) + (v === 1 ? 0.006 : 0) + back(v) * 0.4, cz + Math.cos(th) * R + back(v));
            uvs.push(k / N, v * 0.98);
        }
    }
    // Đỉnh mũ
    const apex = verts.length / 3;
    verts.push(cx, top + 0.008 + back(1) * 0.4, cz + back(1));
    uvs.push(0.25, 0.97);
    const faces = [];
    for (let j = 0; j < ROWS; j++) {
        for (let k = 0; k < N; k++) {
            const a = j * (N + 1) + k, b = a + 1, c = a + N + 1, d = c + 1;
            faces.push(a, b, c, b, d, c);
        }
    }
    for (let k = 0; k < N; k++) faces.push(ROWS * (N + 1) + k, ROWS * (N + 1) + k + 1, apex);
    const parts = [{ verts, faces, uvs, allow: ['head'] }];
    if (pompom) {
        // Quả bông len xù: cầu bán kính 4,5 cm, mặt lởm chởm như sợi len
        const geo = new THREE.SphereGeometry(0.045, 18, 12);
        const p = geo.attributes.position;
        const pv = [];
        for (let i = 0; i < p.count; i++) {
            const f = 1 + 0.14 * Math.sin(i * 12.9898) * Math.sin(i * 78.233);
            pv.push(cx + p.getX(i) * f, top + 0.034 + back(1) * 0.4 + p.getY(i) * f, cz + back(1) + p.getZ(i) * f);
        }
        parts.push({ verts: pv, faces: Array.from(geo.index.array), uvs: pv.map(() => 0.5).slice(0, (pv.length / 3) * 2), allow: ['head'] });
        geo.dispose();
    }
    const part = join(parts);
    // Điểm tóc (tư thế gắn khung) ép vào trong lòng mũ: chỉ phần trên vành, cách mặt trong mũ 6 mm
    part.squeeze = (x, y, z) => {
        const th = (Math.atan2(x - cx, z - cz) + Math.PI * 2) % (Math.PI * 2);
        const y0 = rim(th);
        if (y < y0) return null;
        const t = Math.min(1, (y - y0) / (top - 0.004 - y0));
        const jf = ROWS * Math.pow(t, 1 / 0.85);
        const j = Math.min(ROWS - 1, Math.floor(jf));
        const k = Math.round(th / (Math.PI * 2) * N) % N;
        const lim = inner(j, k) + (inner(j + 1, k) - inner(j, k)) * (jf - j) - 0.006;
        const d = Math.hypot(x - cx, z - cz);
        const ny = Math.min(y, top - 0.008);
        if (d <= lim && ny === y) return null;
        const f = d > lim ? lim / d : 1;
        return [cx + (x - cx) * f, ny, cz + (z - cz) * f];
    };
    return part;
}

// Ảnh mũ len (màu len vẽ sẵn, chất liệu để trắng): gân dọc, nếp gấp ở mép gấu lật (cuff: phần cao của gấu), miếng gắn giữa
// trán ở gấu mũ (patch: nhãn hình núi, smile: mặt cười thêu)
const hatCache = {};

function hatTexture({ color, badge, cuff = 0.24 }) {
    const key = `${color}_${badge}_${cuff}`;
    if (hatCache[key]) return hatCache[key];
    const W = 256, H = 128;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = color;
    g.fillRect(0, 0, W, H);
    // Gân len dọc (đều cả gấu lẫn chỏm)
    for (let x = 0; x < W; x += 4) {
        g.fillStyle = 'rgba(0, 0, 0, 0.13)';
        g.fillRect(x, 0, 1, H);
        g.fillStyle = 'rgba(255, 255, 255, 0.06)';
        g.fillRect(x + 2, 0, 1, H);
    }
    // Mép gấu lật
    const top = H * cuff;
    g.fillStyle = 'rgba(0, 0, 0, 0.32)';
    g.fillRect(0, top - 1, W, 3);
    g.fillStyle = 'rgba(255, 255, 255, 0.1)';
    g.fillRect(0, top - 4, W, 2);
    // Miếng gắn ở giữa trán (u = 0,5), giữa gấu mũ
    const bx = W * 0.5, by = top * 0.5;
    if (badge === 'patch') {
        g.fillStyle = '#3c3e44';
        g.fillRect(bx - 7, by - 6, 14, 12);
        g.strokeStyle = 'rgba(235, 235, 240, 0.85)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(bx - 5, by + 3);
        g.lineTo(bx - 2, by - 3);
        g.lineTo(bx, by + 1);
        g.lineTo(bx + 2, by - 3);
        g.lineTo(bx + 5, by + 3);
        g.stroke();
    } else if (badge === 'smile') {
        g.strokeStyle = g.fillStyle = '#8a5a3a';
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(bx, by - 1, 5, 0.15 * Math.PI, 0.85 * Math.PI);
        g.stroke();
        [-2.5, 2.5].forEach(dx => {
            g.beginPath();
            g.arc(bx + dx, by - 3, 0.9, 0, Math.PI * 2);
            g.fill();
        });
    }
    const tex = hatCache[key] = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    // Ảnh vẽ: dòng trên cùng là v = 0 (mặc định ảnh canvas bị lật dọc)
    tex.flipY = false;
    return tex;
}

// Tóc ép vào trong mũ ôm (on) hoặc trả về như cũ: đổi bộ vị trí đỉnh của các lưới tóc (giữ bản gốc)
function squeezeHair(vrm, squeeze, on) {
    vrm.scene.traverse(o => {
        if (!o.isSkinnedMesh || o.userData.outfit || !/_HAIR/.test([].concat(o.material)[0].name)) return;
        const g = o.geometry;
        const data = o.userData;
        if (!data.hairPos) data.hairPos = g.attributes.position;
        if (on && !data.squeezed && squeeze) {
            const src = data.hairPos;
            const out = src.clone();
            for (let i = 0; i < src.count; i++) {
                const p = squeeze(src.getX(i), src.getY(i), src.getZ(i));
                if (p) out.setXYZ(i, p[0], p[1], p[2]);
            }
            data.squeezed = out;
        }
        const want = on && data.squeezed ? data.squeezed : data.hairPos;
        if (g.attributes.position !== want) g.setAttribute('position', want);
    });
}

// Chất liệu vải mới từ chất liệu áo của nhân vật (giữ cách tô, viền), màu color, ảnh map (cutout: cắt chỗ trong suốt của
// ảnh, như tua rua); kèm chất liệu viền nét như three-vrm dựng cho từng mảnh. Bỏ ảnh ánh kim (matcap) của áo gốc: vải len, dạ
// mờ đục, mà ánh đó cộng sáng trắng cả mảng lớn ở chỗ mặt áo nghiêng xiên (vạt sau áo dài nhìn ngang)
const UV_MAPS = ['map', 'matcapTexture', 'normalMap', 'emissiveMap', 'shadeMultiplyTexture', 'shadingShiftTexture', 'rimMultiplyTexture', 'outlineWidthMultiplyTexture', 'uvAnimationMaskTexture'];

function clothMaterials(base, color, map, cutout = false) {
    const m = base.clone();
    UV_MAPS.forEach(k => { if (m[k] !== undefined) m[k] = null; });
    m.map = map || null;
    m.shadeMultiplyTexture = map || null;
    m.color.set(color);
    // Mặt tối: cùng màu, sẫm hơn, ngả lạnh như các phần áo gốc
    const c = new THREE.Color(color);
    m.shadeColorFactor.setRGB(c.r * 0.62, c.g * 0.6, c.b * 0.7);
    m.alphaTest = cutout ? 0.5 : 0;
    m.transparent = false;
    m.needsUpdate = true;
    const outline = m.clone();
    outline.outlineColorFactor.setRGB(c.r * 0.3, c.g * 0.27, c.b * 0.3);
    outline.isOutline = true;
    outline.side = THREE.BackSide;
    outline.needsUpdate = true;
    // Chép ma trận ảnh vào uniform (chất liệu này không nằm trong danh sách VRM cập nhật mỗi khung, ảnh cũng không đổi)
    [m, outline].forEach(x => x.update && x.update(0));
    return [m, outline];
}

function garment(body, part, mats, name) {
    const geo = skinnedGeometry(body, part);
    const count = geo.index.count;
    geo.addGroup(0, count, 0);
    geo.addGroup(0, count, 1);
    mats.forEach((m, i) => { m.name = i ? `${name} (Outline)` : name; });
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

// Áo len, áo nỉ từ áo hoodie gốc (mặc trong áo khoác): bỏ mũ trùm, dây mũ (cùng đỉnh, ảnh, trọng số xương của áo gốc, chỉ bớt
// các tam giác chạm vào phần mũ), đổi màu. Áo gốc ẩn đi trong mùa đó (dressBase)
function sweater(vrm, tops, { color }) {
    const mask = hoodMask(vrm, tops);
    const src = tops.geometry;
    const old = src.index.array;
    const keep = [];
    for (let t = 0; t < old.length; t += 3) {
        if (!mask[old[t]] && !mask[old[t + 1]] && !mask[old[t + 2]]) keep.push(old[t], old[t + 1], old[t + 2]);
    }
    const geo = new THREE.BufferGeometry();
    Object.entries(src.attributes).forEach(([k, a]) => geo.setAttribute(k, a));
    geo.setIndex(keep);
    geo.addGroup(0, keep.length, 0);
    geo.addGroup(0, keep.length, 1);
    const tint = new THREE.Color(color);
    const mats = [].concat(tops.material).map(m => {
        const c = m.clone();
        c.name = m.name.replace('Tops', 'Sweater');
        c.color.multiply(tint);
        c.shadeColorFactor.multiply(tint);
        c.update(0);
        return c;
    });
    const mesh = new THREE.SkinnedMesh(geo, mats);
    mesh.name = 'sweater';
    mesh.userData.outfit = true;
    mesh.renderOrder = tops.renderOrder;
    mesh.frustumCulled = false;
    mesh.boundingBox = tops.boundingBox ? tops.boundingBox.clone() : null;
    mesh.boundingSphere = tops.boundingSphere ? tops.boundingSphere.clone() : null;
    mesh.bind(tops.skeleton, tops.bindMatrix);
    return mesh;
}

// Danh sách tam giác của lớp bên trong (mesh: da, áo gốc) bỏ đi phần khuất hẳn dưới áo khoác (cover: điểm lúc gắn khung có
// bị thân áo che không; phần theo xương cánh tay thì ống tay áo che, trừ chỗ sát cổ tay): không bao giờ thấy, cử động thì
// xuyên ra (vạt áo gile ở nách, da đầu vai khi hạ tay). null nếu lưới chia nhóm tam giác kiểu khác
function coverIndex(body, mesh, cover) {
    const g = mesh.geometry;
    const full = g.userData.fullIndex || (g.userData.fullIndex = g.index);
    if (!full || !g.groups.every(gr => gr.start === 0 && gr.count === full.count)) return null;
    const arms = new Set(['left', 'right'].flatMap(s => ['UpperArm', 'LowerArm'].map(n => body.bone(s + n))));
    const hands = ['leftHand', 'rightHand'].map(body.at).filter(Boolean);
    const p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const v = new THREE.Vector3();
    const hidden = new Uint8Array(p.count);
    for (let i = 0; i < p.count; i++) {
        let best = 0;
        for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, best)) best = j;
        v.fromBufferAttribute(p, i);
        const arm = arms.has(si.getComponent(i, best)) && hands.every(h => h.distanceTo(v) > 0.07);
        hidden[i] = arm || cover(v.x, v.y, v.z) ? 1 : 0;
    }
    const a = full.array;
    const keep = [];
    for (let t = 0; t < a.length; t += 3) if (!hidden[a[t]] || !hidden[a[t + 1]] || !hidden[a[t + 2]]) keep.push(a[t], a[t + 1], a[t + 2]);
    return new THREE.BufferAttribute(new a.constructor(keep), 1);
}

function setIndex(mesh, index) {
    const g = mesh.geometry;
    if (!index || g.index === index) return;
    g.setIndex(index);
    g.groups.forEach(gr => { gr.count = index.count; });
}

// Mặc đồ mùa season cho nhân vật (sex 'm' | 'f'), trời có tuyết (weather 'snow') thì đội thêm mũ len; đổi mùa thì ẩn đồ mùa
// cũ. Đồ đã dựng giữ lại, dựng lại không tốn
export function dress(vrm, sex, season, weather = '') {
    dressBase(vrm, sex, season);
    const data = vrm.scene.userData;
    if (weather === 'snow' && !data.hat && HATS[sex]) {
        const body = sampleBody(vrm);
        const part = body && beanie(body, HATS[sex]);
        if (part) {
            data.hat = garment(body, part, clothMaterials([].concat(body.cloth.material)[0], 0xffffff, hatTexture(HATS[sex])), 'hat');
            data.hatSqueeze = HATS[sex].snug ? part.squeeze : null;
            body.cloth.parent.add(data.hat);
        }
    }
    if (data.hat) data.hat.visible = weather === 'snow';
    // Mũ ôm: tóc trong vùng mũ ép vào; bỏ mũ thì tóc trở lại như cũ
    if (data.hatSqueeze) squeezeHair(vrm, data.hatSqueeze, weather === 'snow');
    const store = data.outfits || (data.outfits = {});
    Object.entries(store).forEach(([s, list]) => list.forEach(m => { m.visible = s === season; }));
    // Áo bên trong: mùa này bỏ phần khuất dưới áo khoác, mùa khác đủ cả
    Object.values(store).forEach(list => list.covers.forEach(([mesh]) => setIndex(mesh, mesh.geometry.userData.fullIndex)));
    if (store[season]) {
        store[season].covers.forEach(([mesh, index]) => setIndex(mesh, index));
        return store[season];
    }
    const spec = OUTFITS[season] && OUTFITS[season][sex];
    const list = store[season] = [];
    list.covers = [];
    if (!spec) return list;
    const body = sampleBody(vrm, spec.tee ? 'tops' : spec.sweater ? 'hood' : '');
    if (!body) return list;
    const base = [].concat(body.cloth.material)[0];
    const add = (part, color, map, name, cutout) => {
        if (!part) return null;
        const mesh = garment(body, part, clothMaterials(base, color, map, cutout), name);
        body.cloth.parent.add(mesh);
        list.push(mesh);
        return mesh;
    };
    const armsOf = opts => ['left', 'right'].map(s => tube(body, [`${s}UpperArm`, `${s}LowerArm`, `${s}Hand`], opts));
    let inner = spec.tee ? [] : [body.cloth];
    if (spec.sweater) {
        const sweaterMesh = sweater(vrm, body.cloth, spec.sweater);
        body.cloth.parent.add(sweaterMesh);
        list.push(sweaterMesh);
        inner = [sweaterMesh];
    }
    if (spec.tee) {
        // Áo thun ôm theo da thân (áo hoodie gốc ẩn), thành bề mặt mới cho áo khoác đo: áo khoác gọn theo người
        const part = coat(body, { length: spec.tee.length, offset: 0.006 });
        const tee = add(part, spec.tee.color, part && garmentTexture('tee', part.marks), 'tee');
        if (tee) absorb(body, tee.geometry);
    }
    if (spec.coat) {
        // Áo khoác: thân áo rồi tay áo rộng phủ ngoài tay áo bên trong, thu dần về cổ tay; cả hai thành bề mặt mới cho khăn đo
        const { style } = spec.coat;
        const part = coat(body, spec.coat);
        const coatBody = add(part, spec.coat.color, part && style ? garmentTexture(style, part.marks) : coatTexture(), 'coat');
        // Ống tay bắt đầu lùi vào trong vai (khuất trong thân áo) cho kín chỗ nối; trọng số lấy như thân áo (cả xương vai,
        // ngực): đầu ống tay chỉ theo xương cánh tay thì hạ tay xuống, mép trên đầu ống vểnh ra thành sừng ở vai
        const coatArms = add(join(armsOf({ from: -0.1, to: 0.96, offset: 0.012, taper: 0.985, kinds: SKIN | CLOTH, flare: 0.004, reach: 0.03, allow: part ? part.allow : undefined })), spec.coat.color, style ? sleeveTexture(style) : null, 'coatSleeves');
        [coatBody, coatArms].forEach(m => m && absorb(body, m.geometry));
        // Da và áo bên trong (đồng phục của cô gái, áo len): bỏ phần khuất
        [body.skin].concat(inner).forEach(mesh => {
            const index = part && coverIndex(body, mesh, part.cover);
            if (!index) return;
            list.covers.push([mesh, index]);
            setIndex(mesh, index);
        });
    }
    if (spec.scarf) add(scarf(body, spec.scarf), spec.scarf.color, knitTexture(), 'scarf', spec.scarf.fringe);
    return list;
}

// Phần gốc của nhân vật theo mùa: quần tất tô lên ảnh da chân (chân mô hình gồ ghề chỗ mép tất, bắp chân: dựng ống bọc
// ngoài không khít), màu quần, ẩn áo hoodie khi mặc áo nỉ, áo len, ẩn váy khi mặc áo khoác phủ ngoài; mùa khác trả lại gốc
function dressBase(vrm, sex, season) {
    const spec = (OUTFITS[season] && OUTFITS[season][sex]) || {};
    const parts = {};
    vrm.scene.traverse(o => {
        if (!o.isSkinnedMesh || o.userData.outfit) return;
        const name = [].concat(o.material)[0].name;
        [['skin', /Body_00_SKIN/], ['tops', /Tops_01_CLOTH/], ['bottoms', /Bottoms_01_CLOTH/]].forEach(([k, re]) => {
            if (!parts[k] && re.test(name)) parts[k] = o;
        });
    });
    const { skin, tops, bottoms } = parts;
    if (skin) {
        const hips = skin.skeleton.bones.indexOf(vrm.humanoid.getRawBoneNode('hips'));
        // Da từ dưới hông một chút trở xuống (mép trên khuất trong váy, quần)
        const below = bindY(skin.skeleton, hips, 0.9) - 0.03;
        swapMaps(skin, spec.tights && `tights_${spec.tights.color}_${spec.tights.alpha}`,
            tex => paintRegion(tex, skin.geometry, (x, y) => y < below, spec.tights.color, spec.tights.alpha));
    }
    if (tops) tops.visible = !spec.sweater && !spec.tee;
    if (bottoms) {
        bottoms.visible = !(spec.coat && spec.coat.overSkirt);
        swapMaps(bottoms, spec.pants && `pants_${spec.pants}`, tex => recolorTexture(tex, spec.pants));
    }
}

// Đổi ảnh (và ảnh mặt tối nếu dùng chung) của lưới mesh sang bản make(ảnh gốc) lưu theo key; key rỗng thì trả ảnh gốc
function swapMaps(mesh, key, make) {
    const mat = [].concat(mesh.material)[0];
    const data = mesh.userData;
    if (!data.maps) data.maps = { map: mat.map, shade: mat.shadeMultiplyTexture };
    let maps = data.maps;
    if (key) {
        if (!data[key]) {
            const map = maps.map ? make(maps.map) : null;
            data[key] = { map, shade: maps.shade === maps.map ? map : maps.shade ? make(maps.shade) : null };
        }
        maps = data[key];
    }
    if (mat.map !== maps.map || mat.shadeMultiplyTexture !== maps.shade) {
        mat.map = maps.map;
        mat.shadeMultiplyTexture = maps.shade;
        mat.update(0);
    }
}

// Bản sao ảnh tex: vùng các tam giác của geometry mà cả ba đỉnh thỏa test(x, y, z) (tư thế gắn khung) phủ màu color, độ đậm
// alpha (thấp thì còn thấy màu gốc, như tất mỏng)
function paintRegion(tex, geometry, test, color, alpha) {
    const img = tex.image;
    const W = img.width, H = img.height;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const uv = geometry.attributes.uv;
    const pos = geometry.attributes.position;
    // Đủ cả các tam giác (kể cả phần đang bỏ đi vì khuất dưới áo khoác)
    const index = geometry.userData.fullIndex || geometry.index;
    const mask = document.createElement('canvas');
    mask.width = W;
    mask.height = H;
    const m = mask.getContext('2d');
    m.fillStyle = m.strokeStyle = `#${new THREE.Color(color).getHexString()}`;
    m.lineWidth = 2;
    m.lineJoin = 'round';
    m.beginPath();
    const inside = i => test(pos.getX(i), pos.getY(i), pos.getZ(i));
    // Ảnh glTF không lật dọc (flipY false): tọa độ ảnh (u, v) là (x, y) tính từ góc trên trái
    const y = v => (tex.flipY ? 1 - v : v) * H;
    for (let t = 0; t < index.count; t += 3) {
        const a = index.getX(t), b = index.getX(t + 1), d = index.getX(t + 2);
        if (!inside(a) || !inside(b) || !inside(d)) continue;
        m.moveTo(uv.getX(a) * W, y(uv.getY(a)));
        m.lineTo(uv.getX(b) * W, y(uv.getY(b)));
        m.lineTo(uv.getX(d) * W, y(uv.getY(d)));
        m.closePath();
    }
    // Nét viền 2 điểm ảnh cho kín mép các mảnh ảnh (không lộ đường chỉ)
    m.fill();
    m.stroke();
    g.globalAlpha = alpha;
    g.drawImage(mask, 0, 0);
    const out = tex.clone();
    out.source = new THREE.Source(c);
    out.needsUpdate = true;
    return out;
}
