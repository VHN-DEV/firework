/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (người ngắm pháo: sân khấu)
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
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Actor3D, buildClips } from './actor3d.js';
import { Umbrella3D } from './umbrella3d.js';

export { Duo, Solo } from './choreo.js';

const FILES = { m: 'man', f: 'woman' };

const asset = name => new URL(`models/people/${name}`, document.baseURI).href;

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
            vrm.scene.traverse(o => {
                if (o.isMesh) o.frustumCulled = false;
            });
            return { vrm, clips: buildClips(vrm, moves) };
        });
        loaded[sex].catch(() => { delete loaded[sex]; });
    }
    return loaded[sex];
}

// Tải sẵn một nhân vật ('m' | 'f')
export const loadCastFor = sex => loadCast(sex);

export class Stage3D {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
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
        this.umbrellas = [];
        this.size = { w: 0, h: 0, k: 0 };
    }

    // Nạp các nhân vật cần ('m', 'f'): trả về Actor3D theo đúng thứ tự
    async cast(list) {
        const cast = await Promise.all(list.map(loadCast));
        this.actors.forEach(a => this.scene.remove(a.root));
        this.umbrellas.forEach(u => this.scene.remove(u.group));
        this.umbrellas = [];
        this.actors = cast.map(({ vrm, clips }, i) => {
            vrm.scene.position.set(0, 0, 0);
            const actor = new Actor3D(list[i], vrm, clips);
            this.scene.add(actor.root);
            return actor;
        });
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
        if (this.size.w !== cssW || this.size.h !== cssH || this.size.k !== k) {
            this.renderer.setPixelRatio(k);
            this.renderer.setSize(cssW, cssH, false);
            this.size = { w: cssW, h: cssH, k };
        }
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
        this.actors.forEach(a => a.vrm.scene.traverse(o => {
            if (!o.isMesh) return;
            [].concat(o.material).forEach(m => {
                if (m && m.isMToonMaterial && m.parametricRimColorFactor) {
                    m.parametricRimColorFactor.copy(rim);
                    m.parametricRimFresnelPowerFactor = 3.5;
                    m.parametricRimLiftFactor = 0.05;
                }
            });
        }));
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    // Điểm thế giới (three.js) ra điểm ảnh CSS trên màn hình
    toScreen(v, out = [0, 0]) {
        const p = v.clone().project(this.camera);
        out[0] = (p.x + 1) / 2 * this.view.cssW;
        out[1] = (1 - p.y) / 2 * this.view.cssH;
        return out;
    }
}
