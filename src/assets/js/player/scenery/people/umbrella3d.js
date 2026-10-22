/*!
 * Trình diễn Pháo hoa – trình phát: cảnh vật (người ngắm pháo: chiếc ô)
 * © 2026 Vũ Hoài Nam. Mọi quyền được bảo lưu. Liên hệ: vuhoainam18032002@gmail.com
 * Không sao chép, phân phối hay triển khai lại khi chưa được tác giả cho phép (xem LICENSE).
 */

// Chiếc ô cầm tay tô kiểu anime (màu phẳng hai tông, viền nét đậm như nhân vật): cán thẳng, tay cầm cong chữ J, tán 8
// nan cong vồng, mép tán võng vào giữa hai đầu nan. Gập ô: nan cụp dần sát cán, vải túm thành búp dài.

import * as THREE from 'three';

const RIBS = 8;
const RINGS = 4;
const SUB = 3;
const OPEN = 1.29;

// Bậc màu tô kiểu hoạt hình: sáng / tối rõ ràng
let toonRamp = null;

function ramp() {
    if (!toonRamp) {
        const data = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]);
        toonRamp = new THREE.DataTexture(data, 2, 1, THREE.RGBAFormat);
        toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
        toonRamp.needsUpdate = true;
    }
    return toonRamp;
}

export class Umbrella3D {
    constructor({ color = 0x23262e, size = 0.5, shaft = 0.78 } = {}) {
        this.size = size;
        this.shaft = shaft;
        this.open = 1;
        this.goalOpen = 1;
        this.group = new THREE.Group();
        const count = 1 + RIBS * SUB * RINGS;
        this.geo = new THREE.BufferGeometry();
        this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
        const idx = [];
        // Đỉnh tán là điểm 0; điểm của múi s, vòng r là 1 + s * RINGS + r
        const id = (ring, seg) => 1 + ((seg + RIBS * SUB) % (RIBS * SUB)) * RINGS + ring;
        for (let s = 0; s < RIBS * SUB; s++) {
            // Mặt ngoài tán quay lên trên (pháp tuyến hướng ra ngoài)
            idx.push(0, id(0, s + 1), id(0, s));
            for (let r = 0; r < RINGS - 1; r++) {
                const a = id(r, s), b = id(r, s + 1), c = id(r + 1, s), d = id(r + 1, s + 1);
                idx.push(a, b, c, b, d, c);
            }
        }
        this.geo.setIndex(idx);
        const fabric = new THREE.MeshToonMaterial({ color, gradientMap: ramp(), side: THREE.DoubleSide });
        this.canopy = new THREE.Mesh(this.geo, fabric);
        // Viền nét: lớp vỏ phồng ra, chỉ vẽ mặt trong, màu tối
        this.outline = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: 0x0b0b10, side: THREE.BackSide }));
        this.outline.scale.setScalar(1.025);
        const metal = new THREE.MeshToonMaterial({ color: 0x8c8f99, gradientMap: ramp() });
        this.stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, shaft + 0.06, 6), metal);
        this.stick.position.y = (shaft + 0.06) / 2 - 0.02;
        const hook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 12, Math.PI), new THREE.MeshToonMaterial({ color: 0x3a2a20, gradientMap: ramp() }));
        hook.rotation.z = Math.PI;
        hook.position.set(0.035, -0.02, 0);
        this.canopyGroup = new THREE.Group();
        this.canopyGroup.position.y = shaft;
        this.canopyGroup.add(this.canopy, this.outline);
        this.group.add(this.stick, hook, this.canopyGroup);
        this.group.traverse(o => {
            if (o.isMesh) o.frustumCulled = false;
        });
        this.tips = Array.from({ length: RIBS }, () => new THREE.Vector3());
        this.shape(1);
    }

    // Dựng lại tán theo độ mở (0 gập - 1 mở)
    shape(o) {
        const pos = this.geo.attributes.position.array;
        const alpha = 0.06 + (OPEN - 0.06) * o;
        const len = this.size / Math.sin(OPEN);
        pos[0] = pos[1] = pos[2] = 0;
        for (let s = 0; s < RIBS * SUB; s++) {
            const rib = s / SUB;
            const phi = rib / RIBS * Math.PI * 2;
            // Giữa hai nan vải võng vào trong (mép tán lượn sóng)
            const between = Math.sin((s % SUB) / SUB * Math.PI);
            for (let r = 0; r < RINGS; r++) {
                const t = (r + 1) / RINGS;
                // Nan cong vồng: gần đỉnh gần như nằm ngang, ra mép cụp xuống
                const a = Math.min(1.53, alpha + 0.4 * o * (1 - t));
                const rr = len * t * (1 - between * 0.1 * t * o);
                const k = (1 + s * RINGS + r) * 3;
                pos[k] = Math.cos(phi) * Math.sin(a) * rr;
                pos[k + 1] = -Math.cos(a) * rr * (0.55 + 0.45 * t) + between * 0.025 * t * o;
                pos[k + 2] = Math.sin(phi) * Math.sin(a) * rr;
            }
        }
        this.geo.attributes.position.needsUpdate = true;
        this.geo.computeVertexNormals();
        this.shaped = o;
    }

    // Đặt ô: chỗ cầm (Vector3 thế giới), hướng cán (từ tay cầm lên đỉnh), dt để mở/gập dần
    place(grip, dir, dt) {
        this.open += (this.goalOpen - this.open) * (1 - Math.exp(-dt / 0.22));
        if (Math.abs(this.open - this.goalOpen) < 0.003) this.open = this.goalOpen;
        if (Math.abs(this.open - this.shaped) > 0.002) this.shape(this.open);
        this.group.position.copy(grip);
        this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        this.group.updateMatrixWorld(true);
    }

    // Đầu các nan (thế giới) để nước mưa nhỏ giọt
    ribTips() {
        const pos = this.geo.attributes.position.array;
        for (let i = 0; i < RIBS; i++) {
            const k = (1 + i * SUB * RINGS + RINGS - 1) * 3;
            this.tips[i].set(pos[k], pos[k + 1], pos[k + 2]).applyMatrix4(this.canopy.matrixWorld);
        }
        return this.tips;
    }

    // Đỉnh tán (thế giới)
    apex(out = new THREE.Vector3()) {
        return out.set(0, 0, 0).applyMatrix4(this.canopy.matrixWorld);
    }
}
