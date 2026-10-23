/*!
 * Hanabi – trình phát: cảnh vật (người ngắm pháo: sân khấu)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Sân khấu của người ngắm pháo, tải riêng (three.js, mô hình) chỉ khi kịch bản có người: nhân vật anime VRM (VRoid,
// CC0) tô kiểu MToon (màu phẳng, viền nét), chuyển động quay từ người thật (Microsoft Rocketbox, MIT) đã chuyển sang khung
// xương VRM (models/people/*-moves.json). Máy quay chiếu thẳng (không phối cảnh), hơi nhìn từ trên xuống, khớp đúng bố cục
// 2D của cảnh: gốc tọa độ (chỗ người đứng) nằm ở (cx, gy) trên màn hình. Ánh sáng ban đêm: ánh trời xanh mờ, ánh trăng
// phía người xem; ánh pháo chiếu ngược từ phía mặt nước (màu, độ sáng theo pháo đang nổ) làm sáng mép người, viền tóc
// như phim hoạt hình.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Actor3D, buildClips } from './actor3d.js';
import { Umbrella3D } from './umbrella3d.js';
import { dress } from './outfit3d.js';
import { IS_RECORD } from '../../env.js';

export { Duo, Solo } from './choreo.js';

const FILES = { m: 'man', f: 'woman' };

const asset = name => new URL(`models/people/${name}`, document.baseURI).href;

// Mô hình VRoid chia mỗi chất liệu thành nhiều mảnh (tóc chàng trai 114 mảnh chung một chất liệu), mỗi mảnh một lần vẽ,
// thêm một lần cho viền nét: cặp đôi hơn 200 lần vẽ mỗi khung. Gộp các mảnh cùng chất liệu, cùng khung xương thành một
// lưới (còn chừng 40 lần vẽ), giữ nguyên thứ tự vẽ của lưới đầu tiên
const attrKey = g => Object.keys(g.attributes).sort().map(n => {
    const a = g.attributes[n];
    return `${n}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`;
}).join(',') + `|${!!g.index}|${Object.keys(g.morphAttributes).length}`;

function mergePrimitives(vrm) {
    const groups = new Map();
    vrm.scene.traverse(o => {
        if (!o.isSkinnedMesh || !o.parent) return;
        const mats = [].concat(o.material);
        const key = [o.parent.uuid, o.skeleton.uuid, mats[0].uuid, mats.length, o.renderOrder, attrKey(o.geometry)].join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(o);
    });
    groups.forEach(list => {
        const first = list[0];
        if (list.length < 2 || list.some(m => !m.bindMatrix.equals(first.bindMatrix) || !m.matrix.equals(first.matrix))) return;
        // Bỏ nhóm viền nét của từng mảnh, đặt lại cho cả lưới gộp
        const parts = list.map(m => {
            const g = m.geometry.clone();
            g.clearGroups();
            return g;
        });
        const geometry = mergeGeometries(parts, false);
        parts.forEach(g => g.dispose());
        if (!geometry) return;
        const count = geometry.index ? geometry.index.count : geometry.attributes.position.count;
        if (Array.isArray(first.material)) first.material.forEach((m, i) => geometry.addGroup(0, count, i));
        const mesh = new THREE.SkinnedMesh(geometry, first.material);
        mesh.name = first.name;
        mesh.renderOrder = first.renderOrder;
        mesh.matrix.copy(first.matrix);
        mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
        mesh.bindMode = first.bindMode;
        mesh.bind(first.skeleton, first.bindMatrix);
        const parent = first.parent;
        const at = parent.children.indexOf(first);
        list.forEach(m => {
            parent.remove(m);
            m.geometry.dispose();
        });
        parent.add(mesh);
        parent.children.splice(parent.children.length - 1, 1);
        parent.children.splice(at, 0, mesh);
    });
    // Chất liệu viền của các mảnh đã gộp không còn dùng: thôi cập nhật mỗi khung
    const used = new Set();
    vrm.scene.traverse(o => {
        if (o.isMesh) [].concat(o.material).forEach(m => used.add(m));
    });
    if (Array.isArray(vrm.materials)) vrm.materials = vrm.materials.filter(m => used.has(m));
}

// Mỗi nhân vật tải một lần (mô hình + chuyển động)
const loaded = {};

function loadCast(sex) {
    if (!loaded[sex]) {
        const loader = new GLTFLoader();
        loader.register(parser => new VRMLoaderPlugin(parser));
        loaded[sex] = Promise.all([
            loader.loadAsync(asset(`${FILES[sex]}.vrm`)),
            fetch(asset(`${FILES[sex]}-moves.json`)).then(r => r.json())
        ]).then(([gltf, moves]) => {
            const vrm = gltf.userData.vrm;
            VRMUtils.removeUnnecessaryVertices(gltf.scene);
            // Mặt, thân, tóc chung một khung xương: mỗi khung hình tính ma trận xương một lần thay vì ba
            VRMUtils.combineSkeletons(gltf.scene);
            mergePrimitives(vrm);
            vrm.scene.traverse(o => {
                if (!o.isMesh) return;
                o.frustumCulled = false;
                // Khung bao của lưới có xương: three.js tự tính một lần (đưa từng đỉnh qua xương, ~20 ms mỗi nhân vật, khựng
                // lúc vẽ lần đầu) rồi giữ nguyên dù người cử động; lấy luôn khung bao tư thế gốc của hình học, rẻ hơn nhiều
                if (o.isSkinnedMesh) {
                    // Chỉ số xương kiểu số nguyên (glTF JOINTS_0, Uint16): WebGL trên Direct3D (ANGLE, Windows) phải dịch
                    // thêm biến thể shader ngay lần vẽ đầu, trên luồng GPU (~0,4 giây khựng lúc người bước vào); số thực
                    // thì dùng luôn bản đã dịch sẵn
                    const joints = o.geometry.getAttribute('skinIndex');
                    if (joints && !(joints.array instanceof Float32Array)) {
                        o.geometry.setAttribute('skinIndex', new THREE.BufferAttribute(Float32Array.from(joints.array), joints.itemSize));
                    }
                    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
                    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
                    o.boundingBox = o.geometry.boundingBox.clone();
                    o.boundingSphere = o.geometry.boundingSphere.clone();
                }
            });
            return { vrm, clips: buildClips(vrm, moves) };
        });
        loaded[sex].catch(() => { delete loaded[sex]; });
    }
    return loaded[sex];
}

export class Stage3D {
    constructor() {
        // Khung dựng video là iframe ẩn: Chrome hạ ưu tiên WebGL của canvas trong khung ẩn (mỗi lần chép hình chờ rất
        // lâu), OffscreenCanvas thì không gắn với hiển thị của khung nên dựng nhanh như bình thường
        const make = canvas => new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
        if (IS_RECORD && typeof OffscreenCanvas !== 'undefined') {
            try {
                this.canvas = new OffscreenCanvas(1, 1);
                this.renderer = make(this.canvas);
            } catch (e) {
                // Trình duyệt chưa có WebGL trên OffscreenCanvas: dùng canvas thường
                this.renderer = null;
            }
        }
        if (!this.renderer) {
            this.canvas = document.createElement('canvas');
            this.renderer = make(this.canvas);
        }
        // Không đọc nhật ký dịch shader lúc dùng lần đầu (mỗi lần đọc chờ một vòng tiến trình GPU ~50 ms, khựng lúc người
        // bước vào); shader cố định đã chạy đúng, three.js khuyên tắt ở bản chạy thật
        this.renderer.debug.checkShaderErrors = false;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setClearColor(0x000000, 0);
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
        this.hemi = new THREE.HemisphereLight(0x8a9ad0, 0x1c1c26, 0.6);
        // Ánh pháo: từ phía mặt nước, trên cao, chiếu về phía người xem (sáng mép người)
        this.key = new THREE.DirectionalLight(0xffffff, 0.2);
        this.key.position.set(0, 6, -8);
        // Ánh trăng, đèn xa phía người xem: lưng, tóc không tối đen hẳn
        this.fill = new THREE.DirectionalLight(0x9aaae0, 0.55);
        this.fill.position.set(-2, 4, 8);
        this.scene.add(this.hemi, this.key, this.key.target, this.fill);
        this.actors = [];
        this.toon = [];
        this.umbrellas = [];
        this.size = { w: 0, h: 0, k: 0 };
    }

    // Nạp các nhân vật cần ('m', 'f'), mặc đồ theo mùa season, thời tiết weather (tuyết thì đội mũ len): trả về Actor3D theo
    // đúng thứ tự
    async cast(list, season, weather) {
        const cast = await Promise.all(list.map(loadCast));
        this.actors.forEach(a => this.scene.remove(a.root));
        this.umbrellas.forEach(u => this.scene.remove(u.group));
        this.umbrellas = [];
        this.actors = cast.map(({ vrm, clips }, i) => {
            vrm.scene.position.set(0, 0, 0);
            const actor = new Actor3D(list[i], vrm, clips);
            dress(vrm, list[i], season, weather);
            this.scene.add(actor.root);
            return actor;
        });
        // Chất liệu MToon có viền sáng (setLight đổi theo ánh pháo mỗi khung)
        const toon = new Set();
        this.actors.forEach(a => a.vrm.scene.traverse(o => {
            if (o.isMesh) [].concat(o.material).forEach(m => { if (m && m.isMToonMaterial && m.parametricRimColorFactor) toon.add(m); });
        }));
        this.toon = [...toon];
        return this.actors;
    }

    // Chiếc ô cho nhân vật (màu theo người cầm)
    umbrellaFor(actor, sex) {
        const u = new Umbrella3D(sex === 'm' ? { color: 0x262a33, size: 0.55, shaft: 0.8 } : { color: 0xc23a5c, size: 0.47, shaft: 0.72 });
        this.scene.add(u.group);
        this.umbrellas.push(u);
        actor.umbrella = u;
        return u;
    }

    // Khớp máy quay với bố cục 2D: cssW x cssH điểm ảnh CSS, k điểm ảnh thật mỗi điểm ảnh CSS, gốc ở (cx, gy), ppm điểm
    // ảnh CSS mỗi mét, tilt: độ nhìn từ trên xuống
    setView({ cssW, cssH, k, cx, gy, ppm, tilt }) {
        this.size = { w: cssW, h: cssH, k };
        const cam = this.camera;
        cam.left = -cx / ppm;
        cam.right = (cssW - cx) / ppm;
        cam.top = gy / ppm;
        cam.bottom = -(cssH - gy) / ppm;
        const th = Math.atan(tilt);
        cam.position.set(0, Math.sin(th) * 50, Math.cos(th) * 50);
        cam.up.set(0, 1, 0);
        cam.lookAt(0, 0, 0);
        cam.near = 1;
        cam.far = 100;
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld(true);
        this.view = { cssW, cssH, ppm };
    }

    // sky: màu trời theo ánh pháo; focusX: chỗ pháo đang nổ (mét, theo trục x của cảnh)
    setLight(sky, focusX) {
        const glow = Math.max(sky.r, sky.g, sky.b);
        const I = Math.min(1.3, glow / 30);
        const g = Math.max(glow, 1);
        // Màu pháo pha chút trắng cho ánh sáng không gắt
        const c = new THREE.Color((sky.r / g) * 0.75 + 0.25, (sky.g / g) * 0.75 + 0.25, (sky.b / g) * 0.75 + 0.25);
        this.key.color.copy(glow > 0.5 ? c : new THREE.Color(0.75, 0.82, 1));
        this.key.intensity = 0.35 + 2.6 * I;
        this.key.position.set(Math.max(-6, Math.min(6, focusX)), 6, -8);
        this.hemi.intensity = 0.55 + 0.5 * Math.min(1, I);
        this.hemi.color.setRGB(0.54 + sky.r / 255 * 1.2, 0.6 + sky.g / 255 * 1.2, 0.82 + sky.b / 255 * 1.2);
        // Viền sáng kiểu anime (MToon) theo màu pháo
        const rim = c.clone().multiplyScalar(0.15 + 0.55 * Math.min(1, I));
        this.toon.forEach(m => {
            m.parametricRimColorFactor.copy(rim);
            m.parametricRimFresnelPowerFactor = 3.5;
            m.parametricRimLiftFactor = 0.05;
        });
    }

    // Dịch sẵn shader của mọi vật trong cảnh, song song (trình duyệt có KHR_parallel_shader_compile thì không chặn khung
    // hình): để three.js dịch lúc vẽ lần đầu thì cả trang khựng hơn một giây (MToon nhiều biến thể, viền nét) đúng lúc
    // người bước vào
    warm() {
        return this.renderer.compileAsync(this.scene, this.camera).catch(() => {});
    }

    // Tải sẵn các nhân vật ('m', 'f'), mặc sẵn đồ mùa season và dịch sẵn shader của họ theo đúng cảnh (đèn) sẽ đứng vào,
    // trong lúc người xem còn ở màn mở quà: lúc màn pháo bắt đầu không còn phải dựng đồ (~0,1 giây), dịch shader. Cấp sẵn cả
    // lớp dựng hình cỡ thường gặp (rộng bằng màn hình, cao nửa màn hình): cấp phát lúc người bước vào chờ tiến trình GPU
    // ~0,1 giây
    prepare(list, season, weather) {
        if (!this.allocated) {
            const dpr = window.devicePixelRatio || 1;
            this.allocated = true;
            this.renderer.setPixelRatio(1);
            this.renderer.setSize(Math.ceil(window.innerWidth * dpr), Math.ceil(window.innerHeight * dpr * 0.5 / 128) * 128, false);
        }
        return Promise.all(list.map(loadCast))
            .then(cast => Promise.all(cast.map(({ vrm }, i) => {
                if (season) dress(vrm, list[i], season, weather);
                return this.renderer.compileAsync(vrm.scene, this.camera, this.scene);
            })))
            .catch(() => {});
    }

    // Chỉ dựng vùng quanh nhân vật (x, y, w, h: điểm ảnh thật của khung, số nguyên), đặt ở góc trên trái lớp dựng hình:
    // dựng cả khung (vd 1920×1080, khử răng cưa 4 lần) tốn công card đồ họa, bộ nhớ gấp nhiều lần mà chỉ dùng một góc
    // nhỏ. Mỗi lần đổi cỡ lớp dựng hình phải cấp phát lại bộ đệm khử răng cưa (khựng vài chục mili giây) nên cấp một lần
    // cho đủ: rộng bằng khung (người đi vào từ hai mép), cao dư 1,5 lần vùng cần; không thu lại
    render(x, y, w, h) {
        const c = this.canvas;
        const { cssW, cssH } = this.view;
        const k = this.size.k;
        const fullW = Math.ceil(cssW * k);
        if (!this.allocated || c.width < Math.max(w, fullW) || c.height < h) {
            this.allocated = true;
            this.renderer.setPixelRatio(1);
            this.renderer.setSize(Math.max(c.width, fullW), Math.min(Math.ceil(cssH * k), Math.max(c.height, Math.ceil(h * 1.5 / 128) * 128)), false);
        }
        // Khung nhìn WebGL tính từ đáy lên
        this.renderer.setViewport(0, c.height - h, w, h);
        this.camera.setViewOffset(cssW * k, cssH * k, x, y, w, h);
        this.renderer.render(this.scene, this.camera);
        this.camera.clearViewOffset();
    }

    // Điểm thế giới (three.js) ra điểm ảnh CSS trên màn hình
    toScreen(v, out = [0, 0]) {
        const p = v.clone().project(this.camera);
        out[0] = (p.x + 1) / 2 * this.view.cssW;
        out[1] = (1 - p.y) / 2 * this.view.cssH;
        return out;
    }
}
