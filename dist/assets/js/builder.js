var je=Object.defineProperty;var Ue=(e,t,n)=>t in e?je(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var fe=(e,t,n)=>Ue(e,typeof t!="symbol"?t+"":t,n);import{f as H,S as le,T as Ye,M as Xe}from"./MyMath.js";const ce=""+new URL("../img/background.png",import.meta.url).href;window.fscreen=H;window.Stage=le;window.Ticker=Ye;window.MyMath=Xe;const a={events:[],nextId:1,currentFilename:"",activeEventId:null,activeAdvancedId:null,miniPreviewEnabled:!1,showBackground:!1,background:null},B=window.location.hostname.includes("github.io")||window.location.hostname.includes("vercel.app")||window.location.hostname.includes("netlify.app")||window.location.protocol==="file:",S={Red:"#ff0043",Green:"#14fc56",Blue:"#1e7fff",Purple:"#e60aff",Gold:"#ffbf36",White:"#ffffff"},k=Math.PI*2,ge=.9,Ge=["Hoa cúc","Nổ nhiều lần","Văn bản","Hình ảnh","Liễu","Trái tim","Ngôi sao","Kim cương","Bông tuyết","Bông sen","Hành tinh","Mặt cười","Mặt mèo","Vòng nhẫn","Nổ chéo","Cây cọ","Ma","Đuôi ngựa","Nhấp nháy","Nổ lách tách","Tạm dừng"],Ke=[{name:"Vuông",value:"square"},{name:"Tròn",value:"circle"},{name:"Tam giác",value:"triangle"},{name:"Trái tim",value:"heart"}],ae=new Map;function Se(e){if(!e)return e;const n=window.location.hostname.includes("github.io")||window.location.hostname.includes("vercel.app")||window.location.hostname.includes("netlify.app")||window.location.pathname.includes("/dist/")||window.location.pathname.includes("/build/");let i=e.replace(/^\.\//,"");return n?(i.startsWith("src/assets/")&&(i=i.replace("src/assets/","assets/")),"./"+i.replace(/^dist\//,"")):(i.startsWith("assets/")&&!i.startsWith("src/assets/")&&(i="src/"+i),"./"+i)}function Je(e,t=""){const i=document.createElement("canvas");i.width=500,i.height=500;const o=i.getContext("2d",{willReadFrequently:!0});if(t){if(o.save(),o.beginPath(),t==="circle")o.arc(500/2,500/2,500/2,0,Math.PI*2);else if(t==="square")o.rect(0,0,500,500);else if(t==="triangle")o.moveTo(500/2,0),o.lineTo(500,500),o.lineTo(0,500),o.closePath();else if(t==="heart"){o.translate(500/2,500/2),o.beginPath();for(let s=0;s<=Math.PI*2;s+=.01){const r=16*Math.pow(Math.sin(s),3),l=-(13*Math.cos(s)-5*Math.cos(2*s)-2*Math.cos(3*s)-Math.cos(4*s)),c=500/35;s===0?o.moveTo(r*c,l*c):o.lineTo(r*c,l*c)}o.closePath(),o.translate(-500/2,-500/2)}o.clip()}return o.drawImage(e,0,0,500,500),t&&o.restore(),i}function Ze(e,t,n,i,o){e.beginPath();const s=i/2;if(o==="circle")e.arc(t,n,s,0,Math.PI*2);else if(o==="square")e.rect(t-s,n-s,i,i);else if(o==="triangle")e.moveTo(t,n-s),e.lineTo(t+s,n+s),e.lineTo(t-s,n+s),e.closePath();else if(o==="heart"){e.save(),e.translate(t,n),e.beginPath();for(let r=0;r<=Math.PI*2;r+=.1){const l=16*Math.pow(Math.sin(r),3),c=-(13*Math.cos(r)-5*Math.cos(2*r)-2*Math.cos(3*r)-Math.cos(4*r)),d=i/35;r===0?e.moveTo(l*d,c*d):e.lineTo(l*d,c*d)}e.closePath(),e.restore()}}class U{constructor(t,n,i,o,s,r){this.x=t,this.y=n,this.img=i,this.frame=s,this.color=r,this.maxSize=o*300,this.totalLife=1500,this.life=this.totalLife}static updateAll(t){for(let n=this.active.length-1;n>=0;n--){const i=this.active[n];i.life-=t,i.life<=0&&this.active.splice(n,1)}}static drawAll(t){this.active.forEach(n=>{const i=1-n.life/n.totalLife,s=(.1+(1-Math.pow(1-i,3))*.9)*n.maxSize,r=1-Math.pow(i,2);t.save(),t.globalAlpha=r,n.color&&n.color!=="invisible"&&(t.strokeStyle=n.color,t.lineWidth=Math.max(2,s*.02),Ze(t,n.x,n.y,s,n.frame),t.stroke()),t.drawImage(n.img,n.x-s/2,n.y-s/2,s,s),t.restore()})}}fe(U,"active",[]);window.preloadFireworkImage=(e,t)=>{if(!e)return;const n=Se(e),i=`${n}_${t||""}`;if(!ae.has(i)){const o=new Image;o.onload=()=>{const s=Je(o,t);ae.set(i,s)},o.onerror=s=>{console.error("[Builder] Failed to load image:",n,s)},o.src=n}};const Qe=[{name:"Mặc định",value:""},{name:"Nhẹ (Light)",value:"light"},{name:"Vừa (Medium)",value:"medium"},{name:"Dày (Heavy)",value:"heavy"},{name:"Đặc (Thick)",value:"thick"},{name:"Dải sáng (Streamer)",value:"streamer"},{name:"Liễu (Willow)",value:"willow"}],et=[{name:"Ngẫu nhiên",value:"Ngẫu nhiên"},{name:"Đỏ (Red)",value:"Red"},{name:"Xanh lá (Green)",value:"Green"},{name:"Xanh dương (Blue)",value:"Blue"},{name:"Tím (Purple)",value:"Purple"},{name:"Vàng (Gold)",value:"Gold"},{name:"Trắng (White)",value:"White"}];document.addEventListener("DOMContentLoaded",()=>{var c,d,f,u,p,g,w,A,z,m,L;(c=document.getElementById("btn-add-event"))==null||c.addEventListener("click",F),(d=document.getElementById("btn-save"))==null||d.addEventListener("click",de),(f=document.getElementById("btn-preview"))==null||f.addEventListener("click",Fe),(u=document.getElementById("btn-export"))==null||u.addEventListener("click",He),(p=document.getElementById("btn-import"))==null||p.addEventListener("click",()=>{var M;return(M=document.getElementById("import-file"))==null?void 0:M.click()}),(g=document.getElementById("btn-my-scripts"))==null||g.addEventListener("click",Pe),(w=document.getElementById("btn-copy-link"))==null||w.addEventListener("click",he),(A=document.getElementById("btn-toggle-mini-preview"))==null||A.addEventListener("click",()=>_e()),(z=document.getElementById("btn-help"))==null||z.addEventListener("click",()=>pe("help-modal"));const e=document.getElementById("show-background"),t=document.getElementById("background-upload-container"),n=document.getElementById("background-file"),i=document.getElementById("background-preview");e==null||e.addEventListener("change",M=>{a.showBackground=M.target.checked,t==null||t.classList.toggle("hide",!a.showBackground),X()}),n==null||n.addEventListener("change",M=>{const O=M.target.files[0];if(!O)return;const W=new FileReader;W.onload=Ve=>{a.background=Ve.target.result,i&&(i.src=a.background),X()},W.readAsDataURL(O)}),(m=document.getElementById("loop"))==null||m.addEventListener("change",M=>{var W;const O=M.target.checked;O?We():qe(),(W=document.getElementById("btn-play-mini"))==null||W.classList.toggle("hide",O)}),(L=document.getElementById("import-file"))==null||L.addEventListener("change",ht);const o=document.getElementById("btn-toggle-settings"),s=document.getElementById("btn-toggle-settings-header"),r=document.getElementById("btn-fab-add"),l=document.getElementById("sidebar-overlay");o&&o.addEventListener("click",J),s&&s.addEventListener("click",J),r&&r.addEventListener("click",()=>F()),l&&l.addEventListener("click",J),a.events.length===0&&F()});function h(e,t="info"){const n=document.getElementById("notification-container"),i=document.createElement("div");i.className=`toast ${t}`;let o="info-circle";t==="success"&&(o="check-circle"),t==="error"&&(o="exclamation-circle"),t==="warning"&&(o="exclamation-triangle"),i.innerHTML=`
        <i class="fas fa-${o}"></i>
        <span>${e}</span>
    `,n.appendChild(i),setTimeout(()=>{i.classList.add("fade-out"),setTimeout(()=>i.remove(),300)},4e3)}function D(e="Đang xử lý..."){const t=document.getElementById("global-loading"),n=document.getElementById("loading-message");t&&n&&(n.innerText=e,t.classList.remove("hide"))}function v(){const e=document.getElementById("global-loading");e&&e.classList.add("hide")}function tt(){let e=!0;const t=[];document.querySelectorAll(".is-invalid").forEach(s=>s.classList.remove("is-invalid")),document.querySelectorAll(".validation-error-text").forEach(s=>s.remove());const n=document.getElementById("filename"),i=n.value.trim();i?/^[a-zA-Z0-9_-]+$/.test(i)||(e=!1,t.push("Tên file chỉ được chứa chữ cái, số, gạch nối và gạch dưới"),n.classList.add("is-invalid")):(e=!1,t.push("Tên file không được để trống"),n.classList.add("is-invalid")),a.events.length===0&&(e=!1,t.push("Kịch bản phải có ít nhất một phát bắn")),a.events.length>200&&(e=!1,t.push("Kịch bản quá lớn (tối đa 200 phát bắn)"));const o=a.events.find(s=>s.burst>100);return o&&(e=!1,t.push(`Phát bắn #${a.events.indexOf(o)+1} có số đợt quá lớn (tối đa 100)`)),e||t.forEach(s=>h(s,"error")),e}function ne(e,t){const n=document.getElementById("confirm-modal"),i=document.getElementById("confirm-message"),o=document.getElementById("btn-confirm-yes"),s=document.getElementById("btn-confirm-no");i.innerText=e,n.classList.remove("hide");const r=()=>{c(),t()},l=()=>{c()},c=()=>{n.classList.add("hide"),o.removeEventListener("click",r),s.removeEventListener("click",l)};o.addEventListener("click",r),s.addEventListener("click",l)}function F(e=null){const t=a.nextId++;let n;e?n={burst:1,shell:"Hoa cúc",color:"Ngẫu nhiên",x:.5,y:.5,delay:0,size:1,strobe:!1,pistil:!1,streamers:!1,crossette:!1,crackle:!1,horsetail:!1,comet:!1,floral:!1,ring:!1,starDensity:1,starLife:2500,spreadSize:350,strobeFreq:50,launchAngle:0,ascentSpeed:1,rotation:void 0,liftSound:"",burstSound:"",expanded:!1,...e,id:t}:n={id:t,burst:1,shell:"Hoa cúc",color:"Ngẫu nhiên",x:.5,y:.5,delay:0,size:1,strobe:!1,strobeColor:"",pistil:!1,pistilColor:"",streamers:!1,crossette:!1,crackle:!1,horsetail:!1,comet:!1,starDensity:1,starCount:void 0,starLife:2500,starLifeVariation:.125,spreadSize:350,glitterColor:"",secondColor:"",transitionTime:void 0,floral:!1,ring:!1,strobeFreq:50,launchAngle:0,ascentSpeed:1,rotation:void 0,liftSound:"",burstSound:"",expanded:!1},a.events.push(n),I()}function $e(e,t){const n=a.events.find(i=>i.id===e);!n||!t||(Array.isArray(n.color)?n.color.push(t):n.color=[n.color,t],I())}function Ie(e,t){const n=a.events.find(i=>i.id===e);!n||!Array.isArray(n.color)?n.color="Ngẫu nhiên":(n.color.splice(t,1),n.color.length===1&&(n.color=n.color[0]),n.color.length===0&&(n.color="Ngẫu nhiên")),I()}function nt(e){return(Array.isArray(e.color)?e.color:[e.color]).map((n,i)=>`
        <div class="color-tag" style="--tag-color: ${n}">
            <span class="dot"></span>
            <span class="label">${n}</span>
            <i class="fas fa-times" onclick="removeColorFromEvent(${e.id}, ${i})"></i>
        </div>
    `).join("")}function it(){ne("Bạn có chắc chắn muốn tạo kịch bản mới? Mọi thay đổi chưa lưu sẽ bị mất.",()=>{a.events=[],a.nextId=1,a.currentFilename=null,a.activeEventId=null,document.getElementById("title").value="",document.getElementById("subtitle").value="",document.getElementById("author").value="",document.getElementById("filename").value="",document.getElementById("loop").checked=!0,document.getElementById("share-bar").classList.add("hide"),a.showBackground=!1,a.background=null,document.getElementById("show-background").checked=!1,document.getElementById("background-upload-container").classList.add("hide"),document.getElementById("background-preview").src=ce,X(),F(),h("Đã tạo kịch bản mới!","success")})}function Le(e){a.events=a.events.filter(t=>t.id!==e),I()}function ot(e){const t=a.events.findIndex(c=>c.id===e);if(t===-1)return;const n=a.events[t],{id:i,expanded:o,...s}=n,r=a.nextId++,l={...JSON.parse(JSON.stringify(s)),id:r,expanded:!1};a.events.splice(t+1,0,l),I(),h("Đã nhân bản phát bắn!","success")}function Y(e,t,n){const i=a.events.find(o=>o.id===e);if(i){if(["burst","x","y","delay","size","duration","starLife","starDensity","spreadSize","starCount","starLifeVariation","transitionTime","strobeFreq","launchAngle","ascentSpeed","rotation"].includes(t))if(n==null)i[t]=void 0;else{let o=n===""?void 0:Number(n);o!==void 0&&!isNaN(o)&&((t==="x"||t==="y")&&(o=Math.max(0,Math.min(1,o))),t==="size"&&(o=Math.max(0,Math.min(10,o))),t==="delay"&&(o=Math.max(0,Math.min(6e4,o))),t==="burst"&&(o=Math.max(1,o)),t==="starLifeVariation"&&(o=Math.max(0,Math.min(1,o))),t==="launchAngle"&&(o=Math.max(-80,Math.min(80,o))),t==="ascentSpeed"&&(o=Math.max(.1,Math.min(5,o)))),i[t]=o}else["strobe","pistil","streamers","crossette","crackle","horsetail","comet","floral","ring"].includes(t)?i[t]=n===!0:i[t]=n;a.miniPreviewEnabled&&a.activeEventId===e&&G(i)}}function I(){const e=document.getElementById("event-list");if(a.events.length===0){e.innerHTML=`
            <div class="empty-state">
                <i class="fas fa-sparkles"></i>
                <p>Chưa có phát bắn nào. Hãy nhấn "Thêm phát bắn" để bắt đầu.</p>
            </div>
        `;return}e.innerHTML="",a.events.forEach((t,n)=>{const i=st(t,n);e.appendChild(i)})}function st(e,t){const n=document.createElement("div");n.className="event-card"+(a.activeEventId===e.id?" active":""),n.dataset.id=e.id,n.onclick=s=>{s.target.tagName==="INPUT"||s.target.tagName==="SELECT"||s.target.tagName==="BUTTON"||s.target.closest("button")||s.target.closest(".color-tag")||s.target.closest(".advanced-toggle")||Re(e.id)};const i=Ge.map(s=>`<option value="${s}" ${e.shell===s?"selected":""}>${s}</option>`).join(""),o=et.map(s=>`<option value="${s.value}" ${e.color===s.value?"selected":""}>${s.name}</option>`).join("");return n.innerHTML=`
        <div class="event-card-header">
            <span class="event-id">#${t+1}</span>
            <div class="event-controls">
                <button class="btn text small btn-advanced" onclick="toggleAdvanced(${e.id})" title="Tùy chỉnh nâng cao">
                    <i class="fas fa-magic"></i>
                </button>
                <button class="btn text small btn-duplicate" onclick="duplicateEvent(${e.id})" title="Nhân bản phát bắn">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="btn text small btn-remove" onclick="removeEvent(${e.id})" title="Xóa phát bắn">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>

        <div class="event-grid-3">
            <div class="form-group">
                <label>Đợt (Burst)</label>
                <input type="number" value="${e.burst}" onchange="updateEvent(${e.id}, 'burst', this.value)">
            </div>
            <div class="form-group">
                <label>Loại pháo (Shell)</label>
                <select onchange="handleShellChange(${e.id}, this)">
                    ${i}
                </select>
            </div>
            <div id="shell-specific-${e.id}">
                ${e.shell==="Văn bản"?`
                    <div class="form-group">
                        <label>Nội dung chữ (Text)</label>
                        <input type="text" value="${e.text||""}" onchange="updateEvent(${e.id}, 'text', this.value)">
                    </div>
                `:""}
                ${e.shell==="Hình ảnh"?`
                    <div class="form-group">
                        <label>Khung hình (Frame)</label>
                        <select onchange="updateEvent(${e.id}, 'frame', this.value)">
                            ${Ke.map(s=>`<option value="${s.value}" ${e.frame===s.value?"selected":""}>${s.name}</option>`).join("")}
                        </select>
                    </div>
                `:""}
                ${e.shell==="Tạm dừng"?`
                    <div class="form-group">
                        <label>Thời gian nghỉ (ms)</label>
                        <input type="number" value="${e.duration||1e3}" onchange="updateEvent(${e.id}, 'duration', this.value)">
                    </div>
                `:""}
            </div>
        </div>

        <div class="event-grid-4">
            <div class="form-group">
                <label>X (0-1)</label>
                <input type="number" step="0.01" min="0" max="1" value="${e.x}" onchange="updateEvent(${e.id}, 'x', this.value)">
            </div>
            <div class="form-group">
                <label>Y (0-1)</label>
                <input type="number" step="0.01" min="0" max="1" value="${e.y}" onchange="updateEvent(${e.id}, 'y', this.value)">
            </div>
            <div class="form-group">
                <label>Size</label>
                <input type="number" step="0.1" min="0" max="10" value="${e.size}" onchange="updateEvent(${e.id}, 'size', this.value)">
            </div>
            <div class="form-group">
                <label>Trễ (ms)</label>
                <input type="number" step="100" min="0" max="60000" value="${e.delay}" onchange="updateEvent(${e.id}, 'delay', this.value)">
            </div>
        </div>

        <div class="event-grid-physics">
            <div class="form-group">
                <label title="Góc bắn tính bằng độ. 0 = thẳng đứng, dương = nghiêng phải, âm = nghiêng trái">Góc bắn (°)</label>
                <input type="number" step="5" min="-80" max="80" value="${e.launchAngle||0}" onchange="updateEvent(${e.id}, 'launchAngle', this.value)">
            </div>
            <div class="form-group">
                <label title="Tốc độ bay lên. 1 = bình thường, >1 = nhanh hơn">Tốc độ bay (x)</label>
                <input type="number" step="0.1" min="0.1" max="5" value="${e.ascentSpeed||1}" onchange="updateEvent(${e.id}, 'ascentSpeed', this.value)">
            </div>
            <div class="form-group">
                <label title="Góc xoay hình nổ tính bằng độ (dành cho pháo có hình dạng)">Xoay hình (°)</label>
                <input type="number" step="15" min="-180" max="180" value="${e.rotation!==void 0?e.rotation:""}" placeholder="Ngẫu nhiên" onchange="updateEvent(${e.id}, 'rotation', this.value === '' ? undefined : this.value)">
            </div>
        </div>

        <div class="event-grid-physics">
            <div class="form-group">
                <label>Âm thanh phóng</label>
                <select onchange="updateEvent(${e.id}, 'liftSound', this.value)">
                    <option value="" ${e.liftSound?"":"selected"}>Mặc định</option>
                    <option value="liftWick" ${e.liftSound==="liftWick"?"selected":""}>Phóng – Ngòi pháo thật</option>
                    <option value="liftDeep" ${e.liftSound==="liftDeep"?"selected":""}>Phóng – Trầm</option>
                    <option value="liftSharp" ${e.liftSound==="liftSharp"?"selected":""}>Phóng – Sắc</option>
                    <option value="liftSoft" ${e.liftSound==="liftSoft"?"selected":""}>Phóng – Mềm</option>
                    <option value="burstSmall" ${e.liftSound==="burstSmall"?"selected":""}>Phóng – Nhỏ</option>
                    <option value="crackleSmall" ${e.liftSound==="crackleSmall"?"selected":""}>Phóng – Lách tách</option>
                    <option value="liftWhoosh" ${e.liftSound==="liftWhoosh"?"selected":""}>Phóng – Vút mạnh (Mới)</option>
                    <option value="none" ${e.liftSound==="none"?"selected":""}>Im lặng</option>
                </select>
            </div>
            <div class="form-group">
                <label>Âm thanh bay</label>
                <select onchange="updateEvent(${e.id}, 'whistleSound', this.value)">
                    <option value="" ${e.whistleSound?"":"selected"}>Không có</option>
                    <option value="whistle" ${e.whistleSound==="whistle"?"selected":""}>🚀 Bay – Víuuuu classic</option>
                    <option value="whistleHigh" ${e.whistleSound==="whistleHigh"?"selected":""}>🚀 Bay – Víuuuu cao</option>
                    <option value="whistleSwish" ${e.whistleSound==="whistleSwish"?"selected":""}>🚀 Bay – Víuuuu rơi</option>
                    <option value="whistleRocket" ${e.whistleSound==="whistleRocket"?"selected":""}>🚀 Bay – Tên lửa vút (Mới)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Âm thanh nổ</label>
                <select onchange="updateEvent(${e.id}, 'burstSound', this.value)">
                    <option value="" ${e.burstSound?"":"selected"}>Mặc định (Mạnh)</option>
                    <option value="burstDeep" ${e.burstSound==="burstDeep"?"selected":""}>Nổ – Trầm vũ</option>
                    <option value="burstSoft" ${e.burstSound==="burstSoft"?"selected":""}>Nổ – Nhẹ nhàng</option>
                    <option value="burstSmall" ${e.burstSound==="burstSmall"?"selected":""}>Nổ – Nhỏ</option>
                    <option value="burstWhoosh" ${e.burstSound==="burstWhoosh"?"selected":""}>Nổ – Vút</option>
                    <option value="crackleBang" ${e.burstSound==="crackleBang"?"selected":""}>Nổ – Tiếng bụp thật</option>
                    <option value="crackle" ${e.burstSound==="crackle"?"selected":""}>Lách tách – To</option>
                    <option value="crackleHeavy" ${e.burstSound==="crackleHeavy"?"selected":""}>Lách tách – Dồn dập</option>
                    <option value="crackleFirecracker" ${e.burstSound==="crackleFirecracker"?"selected":""}>Lách tách – Pháo thật</option>
                    <option value="crackleSmall" ${e.burstSound==="crackleSmall"?"selected":""}>Lách tách – Nhỏ</option>
                    <option value="burstOut" ${e.burstSound==="burstOut"?"selected":""}>Nổ – Tỏa rộng (Mới)</option>
                    <option value="none" ${e.burstSound==="none"?"selected":""}>Im lặng</option>
                </select>
            </div>
        </div>


        ${e.shell==="Hình ảnh"?`
            <div class="image-upload-section">
                <label>Ảnh nổ pháo hoa</label>
                <div class="image-upload-btn-large" onclick="document.getElementById('image-file-${e.id}').click()">
                    ${e.imageUrl?`<img src="${e.imageUrl}" class="full-thumb">`:'<i class="fas fa-cloud-upload-alt"></i>'}
                    <span>${e.imageUrl?"Thay đổi hình ảnh":"Chọn hình ảnh từ thiết bị"}</span>
                </div>
                <input type="file" id="image-file-${e.id}" class="hide" accept="image/*" onchange="handleImageUpload(${e.id}, this)">
            </div>
        `:`
            <div class="form-group color-group">
                <label>Màu sắc (Colors)</label>
                <div class="color-tags" id="color-tags-${e.id}">
                    ${nt(e)}
                </div>
                <div class="color-input-group compact">
                    <select id="preset-color-${e.id}" onchange="if(this.value) { addColorToEvent(${e.id}, this.value); this.value=''; }">
                        ${o}
                    </select>
                    <input type="color" id="picker-color-${e.id}" onchange="addColorToEvent(${e.id}, this.value)">
                    <div class="input-with-btn">
                        <input type="text" id="custom-color-${e.id}" placeholder="Hex/Tên" onkeydown="if(event.key==='Enter') { addColorToEvent(${e.id}, this.value); this.value=''; }">
                        <button class="btn secondary small" onclick="const input=document.getElementById('custom-color-${e.id}'); addColorToEvent(${e.id}, input.value); input.value='';">Thêm</button>
                    </div>
                </div>
            </div>
        `}
    `,n}function Me(e,t){const n=t.value;Y(e,"shell",n),I()}async function at(e,t){const n=t.files[0];if(!n)return;let i=document.getElementById("filename").value.trim();if(!i){h("Vui lòng nhập tên kịch bản trước khi tải ảnh!","warning"),t.value="";return}if(D("Đang xử lý hình ảnh..."),B){const s=new FileReader;s.onload=r=>{const l=r.target.result;Y(e,"imageUrl",l),I(),v(),h("Đã tải ảnh lên (Lưu cục bộ dưới dạng DataURL)!","success")},s.onerror=()=>{v(),h("Lỗi khi đọc file ảnh.","error")},s.readAsDataURL(n);return}const o=new FormData;o.append("image",n),o.append("filename",i);try{const r=await(await fetch("static/api/upload_image.php",{method:"POST",body:o})).json();v(),r.success?(Y(e,"imageUrl",r.url),I(),h("Tải ảnh lên thành công!","success")):h("Lỗi: "+r.message,"error")}catch{v(),h("Lỗi kết nối khi tải ảnh.","error")}}window.handleImageUpload=at;function xe(e){a.activeAdvancedId===e?Te():(a.activeEventId=e,rt(e),I())}function rt(e){if(!a.events.find(o=>o.id===e))return;a.activeAdvancedId=e,lt(e);const n=document.getElementById("advanced-drawer");n.classList.add("open"),n.classList.remove("hide"),document.querySelector(".event-list-container").classList.add("has-drawer-open"),document.querySelectorAll(".event-card").forEach(o=>o.classList.remove("active"));const i=document.querySelector(`.event-card[data-id="${e}"]`);i&&i.classList.add("active")}function Te(){a.activeAdvancedId=null,a.activeEventId=null;const e=document.getElementById("advanced-drawer");e.classList.remove("open"),document.querySelector(".event-list-container").classList.remove("has-drawer-open"),document.querySelectorAll(".event-card").forEach(t=>t.classList.remove("active")),setTimeout(()=>{a.activeAdvancedId===null&&e.classList.add("hide")},400)}function lt(e){const t=a.events.find(i=>i.id===e);if(!t)return;const n=document.getElementById("drawer-content");n.innerHTML=`
        <div class="advanced-settings">
            <!-- Hạt và Tuổi thọ -->
            <div class="form-group">
                <label>Mật độ hạt</label>
                <input type="number" step="0.1" value="${t.starDensity||""}" placeholder="Mặc định: 1" onchange="updateEvent(${t.id}, 'starDensity', this.value)">
            </div>
            <div class="form-group">
                <label>Số lượng hạt (starCount)</label>
                <input type="number" value="${t.starCount||""}" placeholder="Tự động" onchange="updateEvent(${t.id}, 'starCount', this.value)">
            </div>
            <div class="form-group">
                <label>Tuổi thọ sao (ms)</label>
                <input type="number" step="100" value="${t.starLife||""}" placeholder="VD: 2500" onchange="updateEvent(${t.id}, 'starLife', this.value)">
            </div>
            <div class="form-group">
                <label>Biến thiên tuổi thọ (0-1)</label>
                <input type="number" step="0.05" min="0" max="1" value="${t.starLifeVariation||""}" placeholder="Mặc định: 0.125" onchange="updateEvent(${t.id}, 'starLifeVariation', this.value)">
            </div>

            <!-- Màu sắc nâng cao -->
            <div class="form-group">
                <label>Màu nhấp nháy (Strobe)</label>
                <div class="color-input-group tiny">
                    <input type="color" value="${t.strobeColor&&t.strobeColor.startsWith("#")?t.strobeColor:"#ffffff"}" onchange="updateEvent(${t.id}, 'strobeColor', this.value)">
                    <input type="text" value="${t.strobeColor||""}" placeholder="Hex/Tên" onchange="updateEvent(${t.id}, 'strobeColor', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label>Màu nhụy (Pistil)</label>
                <div class="color-input-group tiny">
                    <input type="color" value="${t.pistilColor&&t.pistilColor.startsWith("#")?t.pistilColor:"#ffffff"}" onchange="updateEvent(${t.id}, 'pistilColor', this.value)">
                    <input type="text" value="${t.pistilColor||""}" placeholder="Hex/Tên" onchange="updateEvent(${t.id}, 'pistilColor', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label>Màu lấp lánh (Glitter)</label>
                <div class="color-input-group tiny">
                    <input type="color" value="${t.glitterColor&&t.glitterColor.startsWith("#")?t.glitterColor:"#ffffff"}" onchange="updateEvent(${t.id}, 'glitterColor', this.value)">
                    <input type="text" value="${t.glitterColor||""}" placeholder="Hex/Tên" onchange="updateEvent(${t.id}, 'glitterColor', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label>Loại lấp lánh</label>
                <select onchange="updateEvent(${t.id}, 'glitter', this.value)">
                    ${Qe.map(i=>`<option value="${i.value}" ${t.glitter===i.value?"selected":""}>${i.name}</option>`).join("")}
                </select>
            </div>

            <!-- Chuyển đổi màu -->
            <div class="form-group">
                <label>Màu chuyển đổi (2nd)</label>
                <div class="color-input-group tiny">
                    <input type="color" value="${t.secondColor&&t.secondColor.startsWith("#")?t.secondColor:"#ffffff"}" onchange="updateEvent(${t.id}, 'secondColor', this.value)">
                    <input type="text" value="${t.secondColor||""}" placeholder="Hex/Tên" onchange="updateEvent(${t.id}, 'secondColor', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label>Thời điểm chuyển (ms)</label>
                <input type="number" step="100" value="${t.transitionTime||""}" placeholder="Tự động" onchange="updateEvent(${t.id}, 'transitionTime', this.value)">
            </div>
            <div class="form-group">
                <label>Kích thước nổ (spread)</label>
                <input type="number" step="10" value="${t.spreadSize||""}" placeholder="Mặc định: 350" onchange="updateEvent(${t.id}, 'spreadSize', this.value)">
            </div>
            <div class="form-group">
                <label>Tốc độ nháy (ms)</label>
                <input type="number" step="10" value="${t.strobeFreq||""}" placeholder="Mặc định: 50" onchange="updateEvent(${t.id}, 'strobeFreq', this.value)">
            </div>
            <div></div> <!-- Spacer -->
        </div>

        <!-- Hiệu ứng Toggle -->
        <div class="advanced-checkbox-grid">
            <div class="form-group checkbox">
                <input type="checkbox" id="strobe-${t.id}" ${t.strobe?"checked":""} onchange="updateEvent(${t.id}, 'strobe', this.checked)">
                <label for="strobe-${t.id}">Nhấp nháy</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="crackle-${t.id}" ${t.crackle?"checked":""} onchange="updateEvent(${t.id}, 'crackle', this.checked)">
                <label for="crackle-${t.id}">Nổ lách tách</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="pistil-${t.id}" ${t.pistil?"checked":""} onchange="updateEvent(${t.id}, 'pistil', this.checked)">
                <label for="pistil-${t.id}">Nhụy ở giữa</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="streamers-${t.id}" ${t.streamers?"checked":""} onchange="updateEvent(${t.id}, 'streamers', this.checked)">
                <label for="streamers-${t.id}">Dải sáng</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="crossette-${t.id}" ${t.crossette?"checked":""} onchange="updateEvent(${t.id}, 'crossette', this.checked)">
                <label for="crossette-${t.id}">Nổ chéo</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="horsetail-${t.id}" ${t.horsetail?"checked":""} onchange="updateEvent(${t.id}, 'horsetail', this.checked)">
                <label for="horsetail-${t.id}">Đuôi ngựa</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="comet-${t.id}" ${t.comet?"checked":""} onchange="updateEvent(${t.id}, 'comet', this.checked)">
                <label for="comet-${t.id}">Đuôi phóng</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="floral-${t.id}" ${t.floral?"checked":""} onchange="updateEvent(${t.id}, 'floral', this.checked)">
                <label for="floral-${t.id}">Hoa nở (Floral)</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="ring-${t.id}" ${t.ring?"checked":""} onchange="updateEvent(${t.id}, 'ring', this.checked)">
                <label for="ring-${t.id}">Vòng nhẫn (Ring)</label>
            </div>
        </div>
    `}window.closeAdvancedDrawer=Te;function Ce(){return{title:document.getElementById("title").value||"Kịch bản mới",subtitle:document.getElementById("subtitle").value||"",author:document.getElementById("author").value||"Anonymous",loop:document.getElementById("loop").checked,showBackground:a.showBackground,background:a.background,status:a.status||"public",events:a.events.map(e=>{const{id:t,...n}=e;return n})}}async function ct(){if(B){const e=JSON.parse(localStorage.getItem("my_firework_scripts")||"{}"),t=Object.keys(e);try{const o=(await(await fetch("static/configs/configs_index.json")).json()).map(s=>s.id);return[...new Set([...t,...o])].filter(s=>s!=="configs_index")}catch{return t}}else try{return(await(await fetch("static/api/manage_configs.php?action=list")).json()).map(n=>n.id)}catch{return[]}}async function Be(e,t){const n=(await ct()).map(l=>l.toLowerCase()),i=e.toLowerCase(),o=t?t.toLowerCase():"";if(i===o||!n.includes(i))return e;let s=1,r=`${e}_${s}`;for(;n.includes(r.toLowerCase());)s++,r=`${e}_${s}`;return r}async function de(e=!1){if(typeof e!="boolean"&&(e=!1),!e&&!tt())return;let t=document.getElementById("filename").value.trim();if(e)t="preview_temp";else if(!t){h("Vui lòng nhập tên file!","warning");return}if(!e){const o=t;t=await Be(t,a.currentFilename),t!==o&&(document.getElementById("filename").value=t,h(`Tên file đã tồn tại, tự động đổi thành: ${t}`,"info"))}const n=document.querySelector(".btn-save");n&&(n.disabled=!0);const i=Ce();return e?D("Đang chuẩn bị xem thử..."):(pe("save-modal"),document.getElementById("save-status").innerText="Đang lưu kịch bản...",document.getElementById("save-spinner").classList.remove("hide"),document.getElementById("save-actions").classList.add("hide")),B?new Promise(o=>{setTimeout(()=>{const s=JSON.parse(localStorage.getItem("my_firework_scripts")||"{}");s[t]=i,localStorage.setItem("my_firework_scripts",JSON.stringify(s)),e?v():(a.currentFilename=t,document.getElementById("save-status").innerText="Đã lưu kịch bản thành công! (Lưu cục bộ tại trình duyệt)",document.getElementById("save-spinner").classList.add("hide"),document.getElementById("save-actions").classList.remove("hide"),Z(t),setTimeout(()=>{N("save-modal")},1500)),o(t)},500)}):fetch("static/api/save_config.php",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:t,config:i})}).then(o=>o.json()).then(o=>{if(o.success)return e?v():(a.currentFilename=o.filename,document.getElementById("save-status").innerText="Đã lưu kịch bản thành công!",document.getElementById("save-spinner").classList.add("hide"),document.getElementById("save-actions").classList.remove("hide"),Z(o.filename),setTimeout(()=>{N("save-modal")},1500)),o.filename;throw v(),e?h("Lỗi xem thử: "+o.message,"error"):(h("Lỗi: "+o.message,"error"),N("save-modal")),new Error(o.message)}).catch(o=>{v(),e||(N("save-modal"),h("Đã xảy ra lỗi khi lưu kịch bản.","error"))}).finally(()=>{n&&(n.disabled=!1)})}function Z(e){const t=document.getElementById("share-bar"),n=document.getElementById("share-url"),i=window.location.origin+window.location.pathname.replace("builder.html","index.html")+"?config="+e;n.innerText=i,t.classList.remove("hide"),t.classList.add("highlight-save"),setTimeout(()=>{t.classList.remove("highlight-save")},2e3)}function he(){const e=document.getElementById("share-url").innerText;if(!e){h("Vui lòng lưu kịch bản trước khi sao chép link!","warning");return}navigator.clipboard.writeText(e).then(()=>{const t=document.getElementById("btn-copy-link"),n=t.innerHTML;t.innerHTML='<i class="fas fa-check"></i> Đã sao chép!',h("Đã sao chép link chia sẻ!","success"),setTimeout(()=>t.innerHTML=n,2e3)}).catch(t=>{h("Không thể sao chép link: "+t,"error")})}function ue(e){const t=window.location.origin+window.location.pathname.replace("builder.html","index.html")+"?config="+e;navigator.clipboard.writeText(t).then(()=>{h("Đã sao chép link kịch bản!","success")}).catch(n=>{h("Không thể sao chép link: "+n,"error")})}function Pe(){pe("scripts-modal"),re()}function re(){const e=document.getElementById("scripts-list");e.innerHTML='<div class="spinner"></div>',(B?fetch("static/configs/configs_index.json").then(n=>n.json()):fetch("static/api/manage_configs.php?action=list").then(n=>n.json())).then(n=>{if(n=n.filter(i=>i.id!=="configs_index"),e.innerHTML="",B){const i=JSON.parse(localStorage.getItem("my_firework_scripts")||"{}");Object.keys(i).forEach(o=>{const s=i[o];n.find(r=>r.id===o)||n.push({id:o,title:s.title||o,author:s.author||"Tôi",eventCount:s.events?s.events.length:0,status:"local"})})}if(n.length===0){e.innerHTML='<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Bạn chưa có kịch bản nào.</p>';return}n.forEach(i=>{const o=document.createElement("div");o.className="script-item";const s=i.status==="private",r=i.status==="local";o.onclick=l=>{l.target.closest(".btn")||ue(i.id)},o.innerHTML=`
                <h4>${s?'<i class="fas fa-lock" title="Riêng tư"></i> ':""}${r?'<i class="fas fa-laptop" title="Lưu cục bộ"></i> ':""}${i.title}</h4>
                <div class="meta">
                    <span><i class="fas fa-user"></i> ${i.author}</span><br>
                    <span><i class="fas fa-fireworks"></i> ${i.eventCount} phát bắn</span>
                </div>
                <div class="script-actions">
                    <button class="btn primary small" onclick="editScript('${i.id}')" title="Sửa"><i class="fas fa-edit"></i></button>
                    <button class="btn secondary small" onclick="duplicateScript('${i.id}')" title="Nhân bản"><i class="fas fa-copy"></i></button>
                    <button class="btn secondary small" onclick="previewScript('${i.id}')" title="Xem thử"><i class="fas fa-play"></i></button>
                    ${!s||r?`<button class="btn danger small" onclick="deleteScript('${i.id}')"><i class="fas fa-trash"></i></button>`:""}
                </div>
            `,e.appendChild(o)})}).catch(n=>{e.innerHTML=`<p style="grid-column: 1/-1; text-align: center; color: var(--error);">Không thể tải danh sách: ${n.message}</p>`})}async function Ne(e){D("Đang nhân bản kịch bản...");const t=async n=>{const i=await Be(e+"_copy","");Q(n,i),N("scripts-modal"),document.getElementById("share-bar").classList.add("hide"),v(),h(`Đã nhân bản kịch bản thành: ${i}`,"success")};if(B){const n=JSON.parse(localStorage.getItem("my_firework_scripts")||"{}");if(n[e]){t(n[e]);return}}fetch(`static/configs/${e}.json?t=${Date.now()}`).then(n=>{if(!n.ok)throw new Error("Không thể tải file kịch bản");return n.json()}).then(t).catch(n=>{v(),h("Không thể nhân bản kịch bản: "+n.message,"error")})}function dt(e){const t=window.location.origin+window.location.pathname.replace("builder.html","index.html")+"?config="+e;window.open(t,"_blank")}function Ae(e){if(D("Đang tải kịch bản..."),B){const t=JSON.parse(localStorage.getItem("my_firework_scripts")||"{}");if(t[e]){Q(t[e],e),N("scripts-modal"),Z(e),v(),h("Đã tải kịch bản thành công!","success");return}}fetch(`static/configs/${e}.json?t=${Date.now()}`).then(t=>{if(!t.ok)throw new Error("Không thể tải file kịch bản");return t.json()}).then(t=>{Q(t,e),N("scripts-modal"),Z(e),v(),h("Đã tải kịch bản thành công!","success")}).catch(t=>{v(),h("Không thể tải kịch bản: "+t.message,"error")})}function ze(e){ne(`Bạn có chắc chắn muốn xóa kịch bản "${e}"?`,()=>{if(D("Đang xóa kịch bản..."),B){const t=JSON.parse(localStorage.getItem("my_firework_scripts")||"{}");if(t[e]){delete t[e],localStorage.setItem("my_firework_scripts",JSON.stringify(t)),re(),a.currentFilename===e&&document.getElementById("share-bar").classList.add("hide"),v(),h("Đã xóa kịch bản thành công!","success");return}}fetch("static/api/manage_configs.php?action=delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:e})}).then(t=>{if(!t.ok)throw new Error("Mạng không ổn định hoặc lỗi server");return t.json()}).then(t=>{v(),t.success?(re(),a.currentFilename===e&&document.getElementById("share-bar").classList.add("hide"),h("Đã xóa kịch bản thành công!","success")):h("Lỗi: "+t.message,"error")}).catch(t=>{v(),h("Lỗi khi xóa: "+t.message,"error")})})}function He(){const e=Ce(),t="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(e,null,2)),n=document.createElement("a"),i=(document.getElementById("filename").value||"firework_config")+".json";n.setAttribute("href",t),n.setAttribute("download",i),document.body.appendChild(n),n.click(),n.remove()}function ht(e){const t=e.target.files[0];t&&(ne("Việc nhập kịch bản mới sẽ ghi đè lên kịch bản hiện tại. Bạn có chắc chắn muốn tiếp tục?",()=>{D("Đang nhập kịch bản...");const n=new FileReader;n.onload=function(i){try{const o=JSON.parse(i.target.result);Q(o,t.name.replace(".json","")),v(),h("Đã nhập kịch bản thành công!","success")}catch{v(),h("Lỗi: File JSON không đúng định dạng.","error")}},n.readAsText(t)}),e.target.value="")}function Q(e,t){document.getElementById("title").value=e.title||"",document.getElementById("subtitle").value=e.subtitle||"",document.getElementById("author").value=e.author||"",document.getElementById("loop").checked=e.loop!==!1,document.getElementById("filename").value=t,a.events=[],a.nextId=1,a.currentFilename=t,a.status=e.status||"public",a.showBackground=!!e.showBackground,a.background=e.background||null,document.getElementById("show-background").checked=a.showBackground,document.getElementById("background-upload-container").classList.toggle("hide",!a.showBackground),a.background?document.getElementById("background-preview").src=a.background:document.getElementById("background-preview").src=ce,X(),e.events&&Array.isArray(e.events)?e.events.forEach(n=>F(n)):F()}function Fe(){de(!0).then(e=>{e&&window.open(`index.html?config=${e}`,"_blank")}).catch(e=>{})}function pe(e){document.getElementById(e).classList.remove("hide")}function N(e){document.getElementById(e).classList.add("hide")}let ve=0;function J(e){e&&(e.preventDefault(),e.stopPropagation());const t=Date.now();if(t-ve<300)return;ve=t;const n=document.querySelector(".sidebar"),i=document.getElementById("sidebar-overlay");n.classList.contains("open")?(n.classList.remove("open"),i.classList.remove("show")):(n.classList.add("open"),i.classList.add("show"))}window.removeEvent=Le;window.duplicateEvent=ot;window.updateEvent=Y;window.handleShellChange=Me;window.toggleAdvanced=xe;window.editScript=Ae;window.duplicateScript=Ne;window.deleteScript=ze;window.addColorToEvent=$e;window.removeColorFromEvent=Ie;window.copyScriptLink=ue;window.previewScript=dt;window.toggleFullscreenMiniPreview=Oe;const De=new le("mini-trails-canvas"),$=new le("mini-main-canvas"),b={drawWidth:3,airDrag:.98,airDragHeavy:.992,active:{},_pool:[],_new(){return{}},add(e,t,n,i,o,s,r,l){const c=this._pool.pop()||this._new();let d=Array.isArray(n)?n[Math.floor(Math.random()*n.length)]:n||S.White;return d==="Ngẫu nhiên"&&(d=Object.values(S)[Math.floor(Math.random()*6)]),c.visible=!0,c.heavy=!1,c.x=e,c.y=t,c.prevX=e,c.prevY=t,c.color=d,c.speedX=Math.cos(i)*o+(r||0),c.speedY=Math.sin(i)*o+(l||0),c.life=s,c.fullLife=s,c.spinAngle=Math.random()*k,c.spinSpeed=.8,c.spinRadius=0,c.sparkFreq=0,c.sparkSpeed=1,c.sparkTimer=0,c.sparkColor=d,c.sparkLife=750,c.sparkLifeVariation=.25,c.strobe=!1,this.active[d]||(this.active[d]=[]),this.active[d].push(c),c},returnInstance(e){e.onDeath&&(e.onDeath(e),e.onDeath=null),e.secondColor=null,e.transitionTime=0,e.colorChanged=!1,e.visible=!0,this._pool.push(e)},reset(){Object.keys(this.active).forEach(e=>this.active[e]=[])}},E={drawWidth:1,airDrag:.9,active:{},_pool:[],_new(){return{}},add(e,t,n,i,o,s){const r=this._pool.pop()||this._new();return r.x=e,r.y=t,r.prevX=e,r.prevY=t,r.color=n,r.speedX=Math.cos(i)*o,r.speedY=Math.sin(i)*o,r.life=s,this.active[n]||(this.active[n]=[]),this.active[n].push(r),r},returnInstance(e){this._pool.push(e)},reset(){Object.keys(this.active).forEach(e=>this.active[e]=[])}},ee={active:[],_pool:[],_new(){return{}},add(e,t,n){const i=this._pool.pop()||this._new();return i.x=e,i.y=t,i.radius=n,this.active.push(i),i},returnInstance(e){this._pool.push(e)},reset(){this.active=[]}};function ut(e){const t=3+Math.random()*4;for(let n=0;n<t;n++){const i=Math.random()*k,o=Math.random()*2;E.add(e.x,e.y,S.Gold,i,o,300+Math.random()*200)}}function pt(e){for(let t=0;t<4;t++){const n=t/4*k,o=b.add(e.x,e.y,e.color,n,1.5,600);o.sparkFreq=40,o.sparkSpeed=.4,o.sparkLife=400,o.sparkColor=S.Gold}}function mt(e){for(let n=0;n<24;n++){const i=n/24*k,o=Math.random()*2+1,s=b.add(e.x,e.y,e.color,i,o,800+Math.random()*400);s.sparkFreq=80,s.sparkSpeed=.3,s.sparkLife=500,s.sparkColor=S.White}ee.add(e.x,e.y,40)}function ft(e,t){for(let n=0;n<e;n++){const i=Math.random()*k,o=Math.random()*.5+.5;t(i,o)}}function q(e){return e?e==="Ngẫu nhiên"?"Ngẫu nhiên":S[e]||e:""}class te{constructor(t){if(Object.assign(this,t),this.starLifeVariation=t.starLifeVariation!==void 0?t.starLifeVariation:.125,this.color=t.color||S.White,!this.starCount){const n=t.starDensity||1,i=this.spreadSize/54;this.starCount=Math.max(6,i*i*n)}}launch(t,n){const i=t*$.width,o=n*$.height,s=$.height,r=(this.launchAngle||0)*(Math.PI/180),l=s-o,c=i+Math.sin(r)*l,d=i,f=c-d,u=o-s,p=Math.sqrt(f*f+u*u),g=Math.atan2(u,f),w=(this.horsetail?100:600)+Math.random()*200,z=Math.max(p*.035,3)*(this.ascentSpeed||1);let m=this.color;Array.isArray(m)&&(m=m[0]),m==="Ngẫu nhiên"&&(m=Object.values(S)[Math.floor(Math.random()*6)]);const L=b.add(d,s,m,g,z,w);L.heavy=!0,L.sparkFreq=30,L.sparkSpeed=.5,L.sparkLife=500,L.sparkColor=m,L.onDeath=()=>{this.burst(c,o)}}burst(t,n){if(this.shell==="Hình ảnh"&&this.imageUrl){const f=`${Se(this.imageUrl)}_${this.frame||""}`,u=ae.get(f);if(u){const p=Array.isArray(this.color)?this.color[0]:this.color||"#ffffff";U.active.push(new U(t,n,u,this.shellSize||1,this.frame,p)),ee.add(t,n,this.spreadSize/5);return}else window.preloadFireworkImage(this.imageUrl,this.frame)}const i=this.spreadSize/96*.75;let o,s,r,l=null;this.crackle&&(l=ut),this.crossette&&(l=pt),this.floral&&(l=mt),this.glitter==="willow"?(o=100,s=.4,r=1200):this.glitter==="light"?(o=400,s=.2,r=300):this.glitter==="streamer"?(o=32,s=1.05,r=620):(o=250,s=.3,r=600);const c=(d,f)=>{const u=b.add(t,n,this.color,d,f*i,this.starLife+Math.random()*this.starLife*this.starLifeVariation,0,0);u.onDeath=l,this.secondColor&&(u.transitionTime=this.starLife*(Math.random()*.05+.32),this.transitionTime&&(u.transitionTime=this.transitionTime),u.secondColor=this.secondColor),this.glitter&&(u.sparkFreq=o,u.sparkSpeed=s,u.sparkLife=r,u.sparkColor=this.glitterColor||u.color,u.sparkTimer=Math.random()*u.sparkFreq),this.strobe&&(u.strobe=!0,u.strobeFreq=this.strobeFreq||40+Math.random()*40,this.strobeColor&&(u.secondColor=this.strobeColor))};if(this.shapePoints){const d=this.shapePoints.isText,f=(this.rotation||0)*(Math.PI/180),u=d?0:this.rotation!==void 0?f:(Math.random()-.5)*.4,p=Math.cos(u),g=Math.sin(u);this.shapePoints.forEach(w=>{const A=w.x*p-w.y*g,z=w.x*g+w.y*p,m=b.add(t,n,this.color,0,0,this.starLife+Math.random()*this.starLife*this.starLifeVariation);m.speedX=A*i*1.2,m.speedY=z*i*1.2,m.onDeath=l,this.glitter&&(m.sparkFreq=o,m.sparkSpeed=s,m.sparkLife=r,m.sparkColor=this.glitterColor||m.color,m.sparkTimer=Math.random()*m.sparkFreq)})}else ft(this.starCount,c);if(this.ring){const d=Math.floor(Math.max(10,this.starCount*.5));for(let f=0;f<d;f++){const u=f/d*k;c(u,1.1)}}this.pistil&&new te({spreadSize:this.spreadSize*.5,starLife:this.starLife*.6,color:this.pistilColor||S.Gold,glitter:"light"}).burst(t,n),this.streamers&&new te({spreadSize:this.spreadSize*.9,starLife:this.starLife*.8,starCount:Math.floor(Math.max(6,this.spreadSize/45)),color:S.White,glitter:"streamer"}).burst(t,n),ee.add(t,n,this.spreadSize/5)}}function gt(e,t){const n=t||1,i=e.shell,o={shellSize:n,spreadSize:300+n*100,starLife:900+n*200,color:q(e.color),strobe:e.strobe,strobeColor:q(e.strobeColor),pistil:e.pistil,pistilColor:q(e.pistilColor),streamers:e.streamers,crossette:e.crossette,crackle:e.crackle,horsetail:e.horsetail,comet:e.comet,starDensity:e.starDensity||1,starCount:e.starCount,starLifeVariation:e.starLifeVariation,glitter:e.glitter,glitterColor:q(e.glitterColor),secondColor:q(e.secondColor),transitionTime:e.transitionTime,floral:e.floral,ring:e.ring,strobeFreq:e.strobeFreq,launchAngle:e.launchAngle,ascentSpeed:e.ascentSpeed,rotation:e.rotation,liftSound:e.liftSound,burstSound:e.burstSound,whistleSound:e.whistleSound};switch(e.starLife&&(o.starLife=e.starLife),e.spreadSize&&(o.spreadSize=e.spreadSize),i){case"Liễu":o.glitter="willow",o.glitterColor=S.Gold,o.starLife=3e3+n*500;break;case"Trái tim":o.shapePoints=vt(50);break;case"Ngôi sao":o.shapePoints=bt(50);break;case"Kim cương":o.shapePoints=wt(50);break;case"Bông tuyết":o.shapePoints=yt();break;case"Mặt cười":o.shapePoints=kt(50);break;case"Hình ảnh":o.shell="Hình ảnh",o.imageUrl=e.imageUrl,o.frame=e.frame;break;case"Văn bản":e.text&&(o.shapePoints=Tt(e.text,50));break;default:o.glitter="light";break}return o}function vt(e){const t=[];for(let n=0;n<e;n++){const i=n/e*k;t.push({x:16*Math.pow(Math.sin(i),3)/16,y:-(13*Math.cos(i)-5*Math.cos(2*i)-2*Math.cos(3*i)-Math.cos(4*i))/16})}return t}function bt(e){const t=[];for(let n=0;n<e;n++){const i=n/e*k,o=n%2===0?1:.5;t.push({x:Math.cos(i)*o,y:Math.sin(i)*o})}return t}function wt(e){const t=[];for(let n=0;n<e;n++){const i=n/e*k;t.push({x:Math.pow(Math.cos(i),3),y:Math.pow(Math.sin(i),3)})}return t}function yt(e){const t=[];for(let n=0;n<6;n++){const i=n/6*k;for(let o=0;o<10;o++){const s=o/10;t.push({x:Math.cos(i)*s,y:Math.sin(i)*s})}}return t}function kt(e){const t=[];for(let n=0;n<e*.7;n++){const i=n/(e*.7)*k;t.push({x:Math.cos(i),y:Math.sin(i)})}t.push({x:-.3,y:-.3},{x:.3,y:-.3});for(let n=0;n<10;n++){const i=Math.PI*(.2+.6*(n/10));t.push({x:Math.cos(i)*.5,y:Math.sin(i)*.5})}return t}let C=null,R=0;function Et(e,t){Object.keys(b.active).forEach(n=>{const i=b.active[n];for(let o=i.length-1;o>=0;o--){const s=i[o];if(s.life-=e,s.life<=0)i.splice(o,1),b.returnInstance(s);else{if(s.prevX=s.x,s.prevY=s.y,s.x+=s.speedX*t,s.y+=s.speedY*t,s.speedX*=b.airDrag,s.speedY*=b.airDrag,s.speedY+=e/1e3*ge,s.secondColor&&!s.colorChanged&&s.life<(s.transitionTime||s.fullLife*.4)){s.colorChanged=!0,i.splice(o,1);const r=s.secondColor;s.color=r,b.active[r]||(b.active[r]=[]),b.active[r].push(s)}if(s.strobe&&(s.visible=Math.floor(s.life/(s.strobeFreq||50))%3===0),s.sparkFreq)for(s.sparkTimer-=e;s.sparkTimer<0;)s.sparkTimer+=s.sparkFreq,E.add(s.x,s.y,s.sparkColor,Math.random()*k,Math.random()*s.sparkSpeed,s.sparkLife)}}}),Object.keys(E.active).forEach(n=>{const i=E.active[n];for(let o=i.length-1;o>=0;o--){const s=i[o];s.life-=e,s.life<=0?(i.splice(o,1),E.returnInstance(s)):(s.prevX=s.x,s.prevY=s.y,s.x+=s.speedX*t,s.y+=s.speedY*t,s.speedX*=E.airDrag,s.speedY*=E.airDrag,s.speedY+=e/1e3*ge)}}),St()}let V=null;function X(){const e=document.querySelector(".mini-preview-canvas-container");if(e)if(a.showBackground){const t=a.background||ce;e.style.backgroundImage=`url(${t})`,e.style.backgroundSize="cover",e.style.backgroundPosition="center",V||(V=new Image),V.src!==t&&(V.src=t)}else e.style.backgroundImage="none",V=null}function St(){const{dpr:e}=$,t=De.ctx,n=$.ctx,i=$.width,o=$.height;t.scale(e,e),n.scale(e,e),a.showBackground?(t.globalCompositeOperation="destination-out",t.fillStyle="rgba(0, 0, 0, 0.175)",t.fillRect(0,0,i,o),t.globalCompositeOperation="source-over"):(t.globalCompositeOperation="source-over",t.fillStyle="rgba(0, 0, 0, 0.175)",t.fillRect(0,0,i,o)),n.clearRect(0,0,i,o),t.globalCompositeOperation="lighten",t.lineWidth=b.drawWidth,Object.keys(b.active).forEach(s=>{const r=b.active[s];t.strokeStyle=s,t.beginPath(),r.forEach(l=>{l.visible&&(t.moveTo(l.x,l.y),t.lineTo(l.prevX,l.prevY))}),t.stroke()}),t.lineWidth=E.drawWidth,Object.keys(E.active).forEach(s=>{const r=E.active[s];t.strokeStyle=s,t.beginPath(),r.forEach(l=>{t.moveTo(l.x,l.y),t.lineTo(l.prevX,l.prevY)}),t.stroke()}),U.drawAll($.ctx),t.setTransform(1,0,0,1,0,0),n.setTransform(1,0,0,1,0,0)}function _(){const e=document.querySelector(".mini-preview-canvas-container");if(!e)return;const t=e.clientWidth||300,n=e.clientHeight||200;De.resize(t,n),$.resize(t,n)}let be=!1;function $t(e,t){if(!a.miniPreviewEnabled)return;const n=e;Et(n,t),U.updateAll(n)}function me(){const e=document.getElementById("mini-preview");if(!e)return 0;const t=e.querySelector(".mini-preview-header"),n=e.querySelector(".mini-preview-info");return(t?t.offsetHeight:0)+(n?n.offsetHeight:0)}function _e(e){a.miniPreviewEnabled=e!==void 0?e:!a.miniPreviewEnabled;const t=document.getElementById("mini-preview"),n=document.getElementById("btn-toggle-mini-preview");if(a.miniPreviewEnabled){t.classList.remove("hide"),n.classList.add("primary"),n.classList.remove("secondary");const i=window.innerWidth/window.innerHeight,o=t.offsetWidth,s=me();t.style.height=o/i+s+"px",_(),X(),be||($.addEventListener("ticker",$t),be=!0),document.getElementById("loop").checked&&We()}else t.classList.add("hide"),n.classList.remove("primary"),n.classList.add("secondary"),qe()}function Oe(){const e=document.getElementById("mini-preview");H.fullscreenElement?H.exitFullscreen():H.requestFullscreen(e)}function It(){const e=document.getElementById("mini-preview");if(!e)return;const t=window.innerWidth/window.innerHeight,n=e.offsetWidth,i=me();e.style.height=n/t+i+"px",_(),h("Đã khôi phục tỉ lệ màn hình","info")}H.onfullscreenchange=()=>{const e=document.getElementById("mini-preview");H.fullscreenElement?(e.classList.add("fullscreen"),h("Đã vào chế độ toàn màn hình","info")):e.classList.remove("fullscreen"),setTimeout(_,100)};function We(){C&&clearInterval(C),R=0,C=setInterval(()=>{if(a.miniPreviewEnabled)if(a.activeEventId){const e=a.events.find(t=>t.id===a.activeEventId);e&&G(e)}else{const e=a.events.length>0?Math.max(...a.events.map(n=>Number(n.burst)||1)):0;if(e===0)return;R++,R>e&&(R=1),a.events.filter(n=>Number(n.burst||1)===R).forEach(n=>setTimeout(()=>G(n),Number(n.delay)||0))}},2e3)}function Lt(){if(C&&clearInterval(C),a.events.length===0)return;const e=document.getElementById("mini-preview-info");e&&(e.innerText="Đang chạy kịch bản...");const t=Math.max(...a.events.map(n=>Number(n.burst)||1));for(let n=1;n<=t;n++)setTimeout(()=>{if(!a.miniPreviewEnabled||document.getElementById("loop").checked)return;a.events.filter(o=>Number(o.burst||1)===n).forEach(o=>setTimeout(()=>G(o),Number(o.delay)||0)),n===t&&setTimeout(()=>{e&&!a.activeEventId&&(e.innerText="Đã chạy xong")},2e3)},(n-1)*2e3)}function qe(){C&&clearInterval(C),C=null,b.reset(),E.reset(),ee.reset()}function G(e){if(e.shell==="Tạm dừng")return;const t=gt(e,e.size),n=new te(t),i=e.x!==void 0?e.x:.5,o=e.y!==void 0?e.y:.5;n.launch(i,o)}let K=!1,j="both",ie,oe,x,T;function Mt(){const e=document.getElementById("mini-preview-resize-v"),t=document.getElementById("mini-preview-resize-h"),n=document.getElementById("mini-preview-resize-both"),i=document.getElementById("mini-preview"),o=(l,c)=>{K=!0,j=c,ie=l.clientX,oe=l.clientY,x=i.offsetWidth,T=i.offsetHeight,l.target.setPointerCapture&&l.target.setPointerCapture(l.pointerId),l.preventDefault(),l.stopPropagation()};e.onpointerdown=l=>o(l,"v"),t.onpointerdown=l=>o(l,"h"),n.onpointerdown=l=>o(l,"both");const s=l=>{if(!K)return;me();let c=x,d=T;const f=ie-l.clientX,u=oe-l.clientY;if(j==="v")d=Math.max(150,T+u);else if(j==="h")c=Math.max(200,x+f);else{const p=(ie-l.clientX+x)/x,g=(oe-l.clientY+T)/T,w=Math.max(p,g);c=Math.max(200,x*w),d=Math.max(150,T*w)}c>window.innerWidth*.95&&(c=window.innerWidth*.95,j==="both"&&(d=c*T/x)),d>window.innerHeight*.8&&(d=window.innerHeight*.8,j==="both"&&(c=d*x/T)),i.style.width=c+"px",i.style.height=d+"px",_()},r=l=>{K&&(K=!1,l.target.releasePointerCapture&&l.target.releasePointerCapture(l.pointerId))};[e,t,n].forEach(l=>{l.onpointermove=s,l.onpointerup=r})}let se=!1,we,ye,ke,Ee;function xt(){const e=document.querySelector(".mini-preview-header"),t=document.getElementById("mini-preview");e.onpointerdown=n=>{if(n.target.closest("button"))return;se=!0,we=n.clientX,ye=n.clientY;const i=window.getComputedStyle(t);ke=parseInt(i.bottom)||0,Ee=parseInt(i.right)||0,e.setPointerCapture(n.pointerId),n.preventDefault()},e.onpointermove=n=>{if(!se)return;const i=we-n.clientX,o=ye-n.clientY;let s=Ee+i,r=ke+o;const l=t.getBoundingClientRect();s<0&&(s=0),r<0&&(r=0),s+l.width>window.innerWidth&&(s=window.innerWidth-l.width),r+l.height>window.innerHeight&&(r=window.innerHeight-l.height),t.style.right=s+"px",t.style.bottom=r+"px"},e.onpointerup=n=>{se=!1,e.releasePointerCapture&&e.releasePointerCapture(n.pointerId)}}document.addEventListener("DOMContentLoaded",()=>{Mt(),xt()});const y=document.createElement("canvas"),P=y.getContext("2d",{willReadFrequently:!0});function Tt(e,t=80){y.width=1e3,y.height=200,P.clearRect(0,0,y.width,y.height),P.font=`bold ${t}px Outfit, Inter, sans-serif`,P.fillStyle="white",P.textAlign="center",P.textBaseline="middle",P.fillText(e,y.width/2,y.height/2);const n=P.getImageData(0,0,y.width,y.height).data,i=[],o=4;let s=y.width,r=0,l=y.height,c=0;for(let p=0;p<y.height;p+=o)for(let g=0;g<y.width;g+=o){const w=(p*y.width+g)*4;n[w+3]>128&&(i.push({x:g,y:p}),g<s&&(s=g),g>r&&(r=g),p<l&&(l=p),p>c&&(c=p))}const d=(s+r)/2,f=(l+c)/2,u=Math.max(r-s,c-l)/2||1;return i.map(p=>({x:(p.x-d)/u,y:(p.y-f)/u}))}function Re(e){a.activeEventId===e?a.activeEventId=null:a.activeEventId=e,I();const t=document.getElementById("mini-preview-info");if(a.activeEventId){const n=a.events.find(o=>o.id===e),i=a.events.findIndex(o=>o.id===e)+1;t.innerText="Đang hiển thị phát bắn #"+i,n&&a.miniPreviewEnabled&&G(n)}else t.innerText="Đang hiển thị toàn bộ"}window.toggleMiniPreview=_e;window.toggleFullscreenMiniPreview=Oe;window.resetMiniPreviewSize=It;window.playMiniPreviewOnce=Lt;window.createNewScript=it;window.selectEvent=Re;window.removeEvent=Le;window.updateEvent=Y;window.handleShellChange=Me;window.toggleAdvanced=xe;window.editScript=Ae;window.duplicateScript=Ne;window.deleteScript=ze;window.addColorToEvent=$e;window.removeColorFromEvent=Ie;window.copyShareLink=he;window.copyScriptLink=ue;window.openScriptsModal=Pe;window.exportConfig=He;window.previewConfig=Fe;window.saveConfig=de;window.toggleSidebar=J;window.resizeMiniStages=_;window.notify=h;window.confirmAction=ne;window.shareSocial=e=>{const t=document.getElementById("share-url").innerText;if(!t){h("Vui lòng lưu kịch bản trước khi chia sẻ!","warning");return}let n="";const i=/Android|iPhone|iPad/i.test(navigator.userAgent);switch(e){case"messenger":i?n=`fb-messenger://share/?link=${encodeURIComponent(t)}`:n=`https://www.facebook.com/dialog/send?link=${encodeURIComponent(t)}&app_id=2177090129179921&redirect_uri=${encodeURIComponent(t)}`;break;case"zalo":n=`https://sp.zalo.me/share/base?url=${encodeURIComponent(t)}`;break;case"tiktok":he(),h("TikTok chưa hỗ trợ chia sẻ link trực tiếp. Đã sao chép link để bạn dán vào TikTok!","info");return}n&&(window.open(n,"_blank")||h("Vui lòng cho phép trình duyệt mở cửa sổ mới để chia sẻ.","warning"))};window.addEventListener("resize",_);
