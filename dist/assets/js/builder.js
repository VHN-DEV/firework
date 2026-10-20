import{f as y}from"./fscreen@1.0.1.js";const pe=""+new URL("../img/background.png",import.meta.url).href;window.fscreen=y;const l={events:[],nextId:1,currentFilename:"",activeEventId:null,activeAdvancedId:null,miniPreviewEnabled:!1,showBackground:!1,background:null},w=window.location.hostname.includes("github.io")||window.location.hostname.includes("vercel.app")||window.location.hostname.includes("netlify.app")||window.location.protocol==="file:",ge={Red:"#ff0043",Green:"#14fc56",Blue:"#1e7fff",Purple:"#e60aff",Gold:"#ffbf36",White:"#ffffff"},_e=["Hoa cúc","Nổ nhiều lần","Văn bản","Hình ảnh","Liễu","Trái tim","Ngôi sao","Kim cương","Bông tuyết","Bông sen","Hành tinh","Mặt cười","Mặt mèo","Vòng nhẫn","Nổ chéo","Cây cọ","Ma","Đuôi ngựa","Nhấp nháy","Nổ lách tách","Tạm dừng"],De=[{name:"Không khung",value:""},{name:"Vuông",value:"square"},{name:"Tròn",value:"circle"},{name:"Tam giác",value:"triangle"},{name:"Trái tim",value:"heart"}];function h(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function Re(e){if(!e||/^(data:|blob:|https?:|\/)/i.test(e))return e;let t=e.replace(/^\.\//,"");return t.startsWith("src/assets/")&&(t=t.replace("src/assets/","assets/")),"./"+t.replace(/^dist\//,"")}function M(e){const t=new URL("index.html",window.location.href);return t.searchParams.set("config",e),t.href}const Fe=[{name:"Mặc định",value:""},{name:"Nhẹ (Light)",value:"light"},{name:"Vừa (Medium)",value:"medium"},{name:"Dày (Heavy)",value:"heavy"},{name:"Đặc (Thick)",value:"thick"},{name:"Dải sáng (Streamer)",value:"streamer"},{name:"Liễu (Willow)",value:"willow"}],Oe=[{name:"Ngẫu nhiên",value:"Ngẫu nhiên"},{name:"Đỏ (Red)",value:"Red"},{name:"Xanh lá (Green)",value:"Green"},{name:"Xanh dương (Blue)",value:"Blue"},{name:"Tím (Purple)",value:"Purple"},{name:"Vàng (Gold)",value:"Gold"},{name:"Trắng (White)",value:"White"}];document.addEventListener("DOMContentLoaded",()=>{var u,p,P,A,_,D,L,ie,oe,ae,le;(u=document.getElementById("btn-add-event"))==null||u.addEventListener("click",()=>$()),(p=document.getElementById("btn-save"))==null||p.addEventListener("click",Q),(P=document.getElementById("btn-preview"))==null||P.addEventListener("click",Be),(A=document.getElementById("btn-export"))==null||A.addEventListener("click",Le),(_=document.getElementById("btn-import"))==null||_.addEventListener("click",()=>{var k;return(k=document.getElementById("import-file"))==null?void 0:k.click()}),(D=document.getElementById("btn-my-scripts"))==null||D.addEventListener("click",$e),(L=document.getElementById("btn-copy-link"))==null||L.addEventListener("click",Z),(ie=document.getElementById("btn-toggle-mini-preview"))==null||ie.addEventListener("click",()=>Ne()),(oe=document.getElementById("btn-help"))==null||oe.addEventListener("click",()=>te("help-modal"));const e=document.getElementById("show-background"),t=document.getElementById("background-upload-container"),n=document.getElementById("background-file"),o=document.getElementById("background-preview");e==null||e.addEventListener("change",k=>{l.showBackground=k.target.checked,t==null||t.classList.toggle("hide",!l.showBackground),E()}),n==null||n.addEventListener("change",k=>{const se=k.target.files[0];if(!se)return;const ce=new FileReader;ce.onload=Ae=>{l.background=Ae.target.result,o&&(o.src=l.background),E()},ce.readAsDataURL(se)}),(ae=document.getElementById("loop"))==null||ae.addEventListener("change",Y),(le=document.getElementById("import-file"))==null||le.addEventListener("change",Qe);const a=document.getElementById("btn-toggle-settings"),i=document.getElementById("btn-toggle-settings-header"),c=document.getElementById("btn-fab-add"),s=document.getElementById("sidebar-overlay");a&&a.addEventListener("click",O),i&&i.addEventListener("click",O),c&&c.addEventListener("click",()=>$()),s&&s.addEventListener("click",O),l.events.length===0&&$()});function Y(){var t;const e=document.getElementById("loop").checked;g=e?"loop":"idle",(t=document.getElementById("btn-play-mini"))==null||t.classList.toggle("hide",e),H(),I(!0)}function r(e,t="info"){const n=document.getElementById("notification-container"),o=document.createElement("div");o.className=`toast ${t}`;let a="info-circle";t==="success"&&(a="check-circle"),t==="error"&&(a="exclamation-circle"),t==="warning"&&(a="exclamation-triangle"),o.innerHTML=`
        <i class="fas fa-${a}"></i>
        <span>${h(e)}</span>
    `,n.appendChild(o),setTimeout(()=>{o.classList.add("fade-out"),setTimeout(()=>o.remove(),300)},4e3)}function S(e="Đang xử lý..."){const t=document.getElementById("global-loading"),n=document.getElementById("loading-message");t&&n&&(n.innerText=e,t.classList.remove("hide"))}function d(){const e=document.getElementById("global-loading");e&&e.classList.add("hide")}function Ue(){let e=!0;const t=[];document.querySelectorAll(".is-invalid").forEach(i=>i.classList.remove("is-invalid")),document.querySelectorAll(".validation-error-text").forEach(i=>i.remove());const n=document.getElementById("filename"),o=n.value.trim();o?/^[a-zA-Z0-9_-]+$/.test(o)||(e=!1,t.push("Tên file chỉ được chứa chữ cái, số, gạch nối và gạch dưới"),n.classList.add("is-invalid")):(e=!1,t.push("Tên file không được để trống"),n.classList.add("is-invalid")),l.events.length===0&&(e=!1,t.push("Kịch bản phải có ít nhất một phát bắn")),l.events.length>200&&(e=!1,t.push("Kịch bản quá lớn (tối đa 200 phát bắn)"));const a=l.events.find(i=>i.burst>100);return a&&(e=!1,t.push(`Phát bắn #${l.events.indexOf(a)+1} có số đợt quá lớn (tối đa 100)`)),e||t.forEach(i=>r(i,"error")),e}function z(e,t){const n=document.getElementById("confirm-modal"),o=document.getElementById("confirm-message"),a=document.getElementById("btn-confirm-yes"),i=document.getElementById("btn-confirm-no");o.innerText=e,n.classList.remove("hide");const c=()=>{u(),t()},s=()=>{u()},u=()=>{n.classList.add("hide"),a.removeEventListener("click",c),i.removeEventListener("click",s)};a.addEventListener("click",c),i.addEventListener("click",s)}function $(e=null){const t=l.nextId++;let n;e?n={burst:1,shell:"Hoa cúc",color:"Ngẫu nhiên",x:50,y:50,delay:0,size:1,strobe:!1,pistil:!1,streamers:!1,crossette:!1,crackle:!1,horsetail:!1,comet:!1,floral:!1,ring:!1,starDensity:1,starLife:2500,spreadSize:350,strobeFreq:50,launchAngle:90,ascentSpeed:1,rotation:void 0,liftSound:"",burstSound:"",expanded:!1,...e,id:t}:n={id:t,burst:1,shell:"Hoa cúc",color:"Ngẫu nhiên",x:50,y:50,delay:0,size:1,strobe:!1,strobeColor:"",pistil:!1,pistilColor:"",streamers:!1,crossette:!1,crackle:!1,horsetail:!1,comet:!1,starDensity:1,starCount:void 0,starLife:2500,starLifeVariation:.125,spreadSize:350,glitterColor:"",secondColor:"",transitionTime:void 0,floral:!1,ring:!1,strobeFreq:50,launchAngle:90,ascentSpeed:1,rotation:void 0,liftSound:"",burstSound:"",expanded:!1},l.events.push(n),m()}function ve(e,t){const n=l.events.find(a=>a.id===e);if(t=typeof t=="string"?t.trim():t,!n||!t)return;const o=Array.isArray(n.color)?n.color:[n.color];t==="Ngẫu nhiên"||!n.color||n.color==="Ngẫu nhiên"?n.color=t:o.includes(t)||(n.color=[...o,t]),m()}function fe(e,t){const n=l.events.find(o=>o.id===e);n&&(Array.isArray(n.color)?(n.color.splice(t,1),n.color.length===1&&(n.color=n.color[0]),n.color.length===0&&(n.color="Ngẫu nhiên")):n.color="Ngẫu nhiên",m())}function Ve(e){return(Array.isArray(e.color)?e.color:[e.color]).map((n,o)=>`
        <div class="color-tag" style="--tag-color: ${h(ge[n]||n)}">
            <span class="dot"></span>
            <span class="label">${h(n)}</span>
            <i class="fas fa-times" onclick="removeColorFromEvent(${e.id}, ${o})"></i>
        </div>
    `).join("")}function ze(){z("Bạn có chắc chắn muốn tạo kịch bản mới? Mọi thay đổi chưa lưu sẽ bị mất.",()=>{l.events=[],l.nextId=1,l.currentFilename=null,l.activeEventId=null,document.getElementById("title").value="",document.getElementById("subtitle").value="",document.getElementById("author").value="",document.getElementById("filename").value="",document.getElementById("loop").checked=!0,Y(),document.getElementById("share-bar").classList.add("hide"),l.showBackground=!1,l.background=null,document.getElementById("show-background").checked=!1,document.getElementById("background-upload-container").classList.add("hide"),document.getElementById("background-preview").src=pe,E(),$(),r("Đã tạo kịch bản mới!","success")})}function be(e){l.events=l.events.filter(t=>t.id!==e),m()}function We(e){const t=l.events.findIndex(u=>u.id===e);if(t===-1)return;const n=l.events[t],{id:o,expanded:a,...i}=n,c=l.nextId++,s={...JSON.parse(JSON.stringify(i)),id:c,expanded:!1};l.events.splice(t+1,0,s),m(),r("Đã nhân bản phát bắn!","success")}const je={burst:1,x:50,y:50,size:1,delay:0};function C(e,t,n){const o=l.events.find(a=>a.id===e);if(o){let a=!1;if(["burst","x","y","delay","size","duration","starLife","starDensity","spreadSize","starCount","starLifeVariation","transitionTime","strobeFreq","launchAngle","ascentSpeed","rotation"].includes(t))if(n==null)o[t]=void 0;else{let i=n===""?NaN:Number(n);isNaN(i)&&(i=je[t],a=i!==void 0),i!==void 0&&((t==="x"||t==="y")&&(i=Math.max(0,Math.min(100,i))),t==="size"&&(i=Math.max(0,Math.min(10,i))),t==="delay"&&(i=Math.max(0,Math.min(6e4,i))),t==="burst"&&(i=Math.max(1,Math.round(i))),t==="starLifeVariation"&&(i=Math.max(0,Math.min(1,i))),t==="launchAngle"&&(i=Math.max(0,Math.min(180,i))),t==="ascentSpeed"&&(i=Math.max(.1,Math.min(5,i)))),o[t]=i}else["strobe","pistil","streamers","crossette","crackle","horsetail","comet","floral","ring"].includes(t)?o[t]=n===!0:o[t]=n;a&&m(),E()}}function m(){const e=document.getElementById("event-list");if(l.events.length===0){e.innerHTML=`
            <div class="empty-state">
                <i class="fas fa-sparkles"></i>
                <p>Chưa có phát bắn nào. Hãy nhấn "Thêm phát bắn" để bắt đầu.</p>
            </div>
        `,E();return}e.innerHTML="",l.events.forEach((t,n)=>{const o=qe(t,n);e.appendChild(o)}),E()}function qe(e,t){const n=document.createElement("div");n.className="event-card"+(l.activeEventId===e.id?" active":""),n.dataset.id=e.id,n.onclick=i=>{i.target.tagName==="INPUT"||i.target.tagName==="SELECT"||i.target.tagName==="BUTTON"||i.target.closest("button")||i.target.closest(".color-tag")||i.target.closest(".advanced-toggle")||Pe(e.id)};const o=_e.map(i=>`<option value="${i}" ${e.shell===i?"selected":""}>${i}</option>`).join(""),a=Oe.map(i=>`<option value="${i.value}" ${e.color===i.value?"selected":""}>${i.name}</option>`).join("");return n.innerHTML=`
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
                    ${o}
                </select>
            </div>
            <div id="shell-specific-${e.id}">
                ${e.shell==="Văn bản"?`
                    <div class="form-group">
                        <label>Nội dung chữ (Text)</label>
                        <input type="text" value="${h(e.text)}" onchange="updateEvent(${e.id}, 'text', this.value)">
                    </div>
                `:""}
                ${e.shell==="Hình ảnh"?`
                    <div class="form-group">
                        <label>Khung hình (Frame)</label>
                        <select onchange="updateEvent(${e.id}, 'frame', this.value)">
                            ${De.map(i=>`<option value="${i.value}" ${e.frame===i.value?"selected":""}>${i.name}</option>`).join("")}
                        </select>
                    </div>
                `:""}
                ${e.shell==="Tạm dừng"?`
                    <div class="form-group">
                        <label>Thời gian nghỉ (ms)</label>
                        <input type="number" value="${e.duration||2e3}" onchange="updateEvent(${e.id}, 'duration', this.value)">
                    </div>
                `:""}
            </div>
        </div>

        <div class="event-grid-4">
            <div class="form-group">
                <label>X (0-100)</label>
                <input type="number" step="0.1" min="0" max="100" value="${e.x}" onchange="updateEvent(${e.id}, 'x', this.value)">
            </div>
            <div class="form-group">
                <label>Y (0-100)</label>
                <input type="number" step="0.1" min="0" max="100" value="${e.y}" onchange="updateEvent(${e.id}, 'y', this.value)">
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
                <label title="Góc bắn tính bằng độ. 90 = thẳng đứng, 0 = nằm ngang trái, 180 = nằm ngang phải">Góc bắn (0-180°)</label>
                <input type="number" step="1" min="0" max="180" value="${e.launchAngle??90}" onchange="updateEvent(${e.id}, 'launchAngle', this.value)">
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
                    ${e.imageUrl?`<img src="${h(Re(e.imageUrl))}" class="full-thumb">`:'<i class="fas fa-cloud-upload-alt"></i>'}
                    <span>${e.imageUrl?"Thay đổi hình ảnh":"Chọn hình ảnh từ thiết bị"}</span>
                </div>
                <input type="file" id="image-file-${e.id}" class="hide" accept="image/*" onchange="handleImageUpload(${e.id}, this)">
            </div>
        `:`
            <div class="form-group color-group">
                <label>Màu sắc (Colors)</label>
                <div class="color-tags" id="color-tags-${e.id}">
                    ${Ve(e)}
                </div>
                <div class="color-input-group compact">
                    <select id="preset-color-${e.id}" onchange="if(this.value) { addColorToEvent(${e.id}, this.value); this.value=''; }">
                        ${a}
                    </select>
                    <input type="color" id="picker-color-${e.id}" onchange="addColorToEvent(${e.id}, this.value)">
                    <div class="input-with-btn">
                        <input type="text" id="custom-color-${e.id}" placeholder="Hex/Tên" onkeydown="if(event.key==='Enter') { addColorToEvent(${e.id}, this.value); this.value=''; }">
                        <button class="btn secondary small" onclick="const input=document.getElementById('custom-color-${e.id}'); addColorToEvent(${e.id}, input.value); input.value='';">Thêm</button>
                    </div>
                </div>
            </div>
        `}
    `,n}function we(e,t){const n=t.value;C(e,"shell",n),m()}async function Ke(e,t){const n=t.files[0];if(!n)return;let o=document.getElementById("filename").value.trim();if(!o){r("Vui lòng nhập tên kịch bản trước khi tải ảnh!","warning"),t.value="";return}if(S("Đang xử lý hình ảnh..."),w){const i=new FileReader;i.onload=c=>{const s=c.target.result;C(e,"imageUrl",s),m(),d(),r("Đã tải ảnh lên (Lưu cục bộ dưới dạng DataURL)!","success")},i.onerror=()=>{d(),r("Lỗi khi đọc file ảnh.","error")},i.readAsDataURL(n);return}const a=new FormData;a.append("image",n),a.append("filename",o);try{const c=await(await fetch("api/upload_image.php",{method:"POST",body:a})).json();d(),c.success?(C(e,"imageUrl",c.url),m(),r("Tải ảnh lên thành công!","success")):r("Lỗi: "+c.message,"error")}catch{d(),r("Lỗi kết nối khi tải ảnh.","error")}}window.handleImageUpload=Ke;function ye(e){l.activeAdvancedId===e?Ee():(l.activeEventId=e,Je(e),m())}function Je(e){if(!l.events.find(a=>a.id===e))return;l.activeAdvancedId=e,Xe(e);const n=document.getElementById("advanced-drawer");n.classList.add("open"),n.classList.remove("hide"),document.querySelector(".event-list-container").classList.add("has-drawer-open"),document.querySelectorAll(".event-card").forEach(a=>a.classList.remove("active"));const o=document.querySelector(`.event-card[data-id="${e}"]`);o&&o.classList.add("active")}function Ee(){l.activeAdvancedId=null,l.activeEventId=null;const e=document.getElementById("advanced-drawer");e.classList.remove("open"),document.querySelector(".event-list-container").classList.remove("has-drawer-open"),document.querySelectorAll(".event-card").forEach(t=>t.classList.remove("active")),H(),I(!0),setTimeout(()=>{l.activeAdvancedId===null&&e.classList.add("hide")},400)}function R(e){const t=ge[e]||e;return typeof t=="string"&&/^#[0-9a-f]{6}$/i.test(t)?t:"#ffffff"}function Xe(e){const t=l.events.find(o=>o.id===e);if(!t)return;const n=document.getElementById("drawer-content");n.innerHTML=`
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
                    <input type="color" value="${R(t.strobeColor)}" onchange="updateEvent(${t.id}, 'strobeColor', this.value)">
                    <input type="text" value="${h(t.strobeColor)}" placeholder="Hex/Tên" onchange="updateEvent(${t.id}, 'strobeColor', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label>Màu nhụy (Pistil)</label>
                <div class="color-input-group tiny">
                    <input type="color" value="${R(t.pistilColor)}" onchange="updateEvent(${t.id}, 'pistilColor', this.value)">
                    <input type="text" value="${h(t.pistilColor)}" placeholder="Hex/Tên" onchange="updateEvent(${t.id}, 'pistilColor', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label>Màu lấp lánh (Glitter)</label>
                <div class="color-input-group tiny">
                    <input type="color" value="${R(t.glitterColor)}" onchange="updateEvent(${t.id}, 'glitterColor', this.value)">
                    <input type="text" value="${h(t.glitterColor)}" placeholder="Hex/Tên" onchange="updateEvent(${t.id}, 'glitterColor', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label>Loại lấp lánh</label>
                <select onchange="updateEvent(${t.id}, 'glitter', this.value)">
                    ${Fe.map(o=>`<option value="${o.value}" ${t.glitter===o.value?"selected":""}>${o.name}</option>`).join("")}
                </select>
            </div>

            <!-- Chuyển đổi màu -->
            <div class="form-group">
                <label>Màu chuyển đổi (2nd)</label>
                <div class="color-input-group tiny">
                    <input type="color" value="${R(t.secondColor)}" onchange="updateEvent(${t.id}, 'secondColor', this.value)">
                    <input type="text" value="${h(t.secondColor)}" placeholder="Hex/Tên" onchange="updateEvent(${t.id}, 'secondColor', this.value)">
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
    `}window.closeAdvancedDrawer=Ee;function G(){return{title:document.getElementById("title").value||"Kịch bản mới",subtitle:document.getElementById("subtitle").value||"",author:document.getElementById("author").value||"Anonymous",loop:document.getElementById("loop").checked,showBackground:l.showBackground,background:l.background,status:l.status||"public",events:l.events.map(e=>{const{id:t,...n}=e;return n})}}async function Ye(){if(w){const e=JSON.parse(localStorage.getItem("my_firework_scripts")||"{}"),t=Object.keys(e);try{const a=(await(await fetch("configs/configs_index.json")).json()).map(i=>i.id);return[...new Set([...t,...a])].filter(i=>i!=="configs_index")}catch{return t}}else try{return(await(await fetch("api/manage_configs.php?action=list")).json()).map(n=>n.id)}catch{return[]}}async function ke(e,t){const n=(await Ye()).map(s=>s.toLowerCase()),o=e.toLowerCase(),a=t?t.toLowerCase():"";if(o===a||!n.includes(o))return e;let i=1,c=`${e}_${i}`;for(;n.includes(c.toLowerCase());)i++,c=`${e}_${i}`;return c}async function Q(e=!1){if(typeof e!="boolean"&&(e=!1),!e&&!Ue())return;let t=document.getElementById("filename").value.trim();if(e)t="preview_temp";else if(!t){r("Vui lòng nhập tên file!","warning");return}const n=document.querySelectorAll("#btn-save, .btn-save-mobile"),o=i=>n.forEach(c=>c.disabled=i);if(o(!0),!e){const i=t;t=await ke(t,l.currentFilename),t!==i&&(document.getElementById("filename").value=t,r(`Tên file đã tồn tại, tự động đổi thành: ${t}`,"info"))}const a=G();return e?S("Đang chuẩn bị xem thử..."):(te("save-modal"),document.getElementById("save-status").innerText="Đang lưu kịch bản...",document.getElementById("save-spinner").classList.remove("hide"),document.getElementById("save-actions").classList.add("hide")),w?new Promise(i=>{setTimeout(()=>{o(!1);try{const c=JSON.parse(localStorage.getItem("my_firework_scripts")||"{}");c[t]=a,localStorage.setItem("my_firework_scripts",JSON.stringify(c))}catch{d(),b("save-modal"),r("Không thể lưu vào trình duyệt: dữ liệu quá lớn (hãy dùng ảnh nhẹ hơn hoặc bớt ảnh).","error"),i(null);return}e?d():(l.currentFilename=t,document.getElementById("save-status").innerText="Đã lưu kịch bản thành công! (Lưu cục bộ tại trình duyệt)",document.getElementById("save-spinner").classList.add("hide"),document.getElementById("save-actions").classList.remove("hide"),U(t),setTimeout(()=>{b("save-modal")},1500)),i(t)},500)}):fetch("api/save_config.php",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:t,config:a})}).then(i=>i.json()).then(i=>{if(i.success)return e?d():(l.currentFilename=i.filename,document.getElementById("save-status").innerText="Đã lưu kịch bản thành công!",document.getElementById("save-spinner").classList.add("hide"),document.getElementById("save-actions").classList.remove("hide"),U(i.filename),setTimeout(()=>{b("save-modal")},1500)),i.filename;throw d(),e?r("Lỗi xem thử: "+i.message,"error"):(r("Lỗi: "+i.message,"error"),b("save-modal")),new Error(i.message)}).catch(i=>{d(),e||(b("save-modal"),r("Đã xảy ra lỗi khi lưu kịch bản.","error"))}).finally(()=>{o(!1)})}function U(e){const t=document.getElementById("share-bar"),n=document.getElementById("share-url"),o=M(e);n.innerText=o,t.classList.remove("hide"),t.classList.add("highlight-save"),setTimeout(()=>{t.classList.remove("highlight-save")},2e3)}function Z(){const e=document.getElementById("share-url").innerText;if(!e){r("Vui lòng lưu kịch bản trước khi sao chép link!","warning");return}navigator.clipboard.writeText(e).then(()=>{const t=document.getElementById("btn-copy-link"),n=t.innerHTML;t.innerHTML='<i class="fas fa-check"></i> Đã sao chép!',r("Đã sao chép link chia sẻ!","success"),setTimeout(()=>t.innerHTML=n,2e3)}).catch(t=>{r("Không thể sao chép link: "+t,"error")})}function ee(e){const t=M(e);navigator.clipboard.writeText(t).then(()=>{r("Đã sao chép link kịch bản!","success")}).catch(n=>{r("Không thể sao chép link: "+n,"error")})}function $e(){te("scripts-modal"),J()}function J(){const e=document.getElementById("scripts-list");e.innerHTML='<div class="spinner"></div>',(w?fetch("configs/configs_index.json").then(n=>n.json()):fetch("api/manage_configs.php?action=list").then(n=>n.json())).then(n=>{if(n=n.filter(o=>o.id!=="configs_index"&&o.id!=="preview_temp"),e.innerHTML="",w){const o=JSON.parse(localStorage.getItem("my_firework_scripts")||"{}");Object.keys(o).filter(a=>a!=="preview_temp").forEach(a=>{const i=o[a];n.find(c=>c.id===a)||n.push({id:a,title:i.title||a,author:i.author||"Tôi",eventCount:i.events?i.events.length:0,status:"local"})})}if(n.length===0){e.innerHTML='<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Bạn chưa có kịch bản nào.</p>';return}n.forEach(o=>{const a=document.createElement("div");a.className="script-item";const i=o.status==="private",c=o.status==="local";a.onclick=s=>{s.target.closest(".btn")||ee(o.id)},a.innerHTML=`
                <h4>${i?'<i class="fas fa-lock" title="Riêng tư"></i> ':""}${c?'<i class="fas fa-laptop" title="Lưu cục bộ"></i> ':""}${h(o.title)}</h4>
                <div class="meta">
                    <span><i class="fas fa-user"></i> ${h(o.author)}</span><br>
                    <span><i class="fas fa-fireworks"></i> ${h(o.eventCount)} phát bắn</span>
                </div>
                <div class="script-actions">
                    <button class="btn primary small" onclick="editScript('${o.id}')" title="Sửa"><i class="fas fa-edit"></i></button>
                    <button class="btn secondary small" onclick="duplicateScript('${o.id}')" title="Nhân bản"><i class="fas fa-copy"></i></button>
                    <button class="btn secondary small" onclick="previewScript('${o.id}')" title="Xem thử"><i class="fas fa-play"></i></button>
                    ${!i||c?`<button class="btn danger small" onclick="deleteScript('${o.id}')"><i class="fas fa-trash"></i></button>`:""}
                </div>
            `,e.appendChild(a)})}).catch(n=>{e.innerHTML=`<p style="grid-column: 1/-1; text-align: center; color: var(--error);">Không thể tải danh sách: ${h(n.message)}</p>`})}async function Se(e){S("Đang nhân bản kịch bản...");const t=async n=>{const o=await ke(e+"_copy","");V(n,o),b("scripts-modal"),document.getElementById("share-bar").classList.add("hide"),d(),r(`Đã nhân bản kịch bản thành: ${o}`,"success")};if(w){const n=JSON.parse(localStorage.getItem("my_firework_scripts")||"{}");if(n[e]){t(n[e]);return}}fetch(`configs/${e}.json?t=${Date.now()}`).then(n=>{if(!n.ok)throw new Error("Không thể tải file kịch bản");return n.json()}).then(t).catch(n=>{d(),r("Không thể nhân bản kịch bản: "+n.message,"error")})}function Ge(e){window.open(M(e),"_blank")}function Ie(e){if(S("Đang tải kịch bản..."),w){const t=JSON.parse(localStorage.getItem("my_firework_scripts")||"{}");if(t[e]){V(t[e],e),b("scripts-modal"),U(e),d(),r("Đã tải kịch bản thành công!","success");return}}fetch(`configs/${e}.json?t=${Date.now()}`).then(t=>{if(!t.ok)throw new Error("Không thể tải file kịch bản");return t.json()}).then(t=>{V(t,e),b("scripts-modal"),U(e),d(),r("Đã tải kịch bản thành công!","success")}).catch(t=>{d(),r("Không thể tải kịch bản: "+t.message,"error")})}function xe(e){z(`Bạn có chắc chắn muốn xóa kịch bản "${e}"?`,()=>{if(S("Đang xóa kịch bản..."),w){const t=JSON.parse(localStorage.getItem("my_firework_scripts")||"{}");if(t[e]){delete t[e],localStorage.setItem("my_firework_scripts",JSON.stringify(t)),J(),l.currentFilename===e&&document.getElementById("share-bar").classList.add("hide"),d(),r("Đã xóa kịch bản thành công!","success");return}}fetch("api/manage_configs.php?action=delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:e})}).then(t=>{if(!t.ok)throw new Error("Mạng không ổn định hoặc lỗi server");return t.json()}).then(t=>{d(),t.success?(J(),l.currentFilename===e&&document.getElementById("share-bar").classList.add("hide"),r("Đã xóa kịch bản thành công!","success")):r("Lỗi: "+t.message,"error")}).catch(t=>{d(),r("Lỗi khi xóa: "+t.message,"error")})})}function Le(){const e=G(),t="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(e,null,2)),n=document.createElement("a"),o=(document.getElementById("filename").value||"firework_config")+".json";n.setAttribute("href",t),n.setAttribute("download",o),document.body.appendChild(n),n.click(),n.remove()}function Qe(e){const t=e.target.files[0];t&&(z("Việc nhập kịch bản mới sẽ ghi đè lên kịch bản hiện tại. Bạn có chắc chắn muốn tiếp tục?",()=>{S("Đang nhập kịch bản...");const n=new FileReader;n.onload=function(o){try{const a=JSON.parse(o.target.result);V(a,t.name.replace(".json","")),d(),r("Đã nhập kịch bản thành công!","success")}catch{d(),r("Lỗi: File JSON không đúng định dạng.","error")}},n.readAsText(t)}),e.target.value="")}function V(e,t){document.getElementById("title").value=e.title||"",document.getElementById("subtitle").value=e.subtitle||"",document.getElementById("author").value=e.author||"",document.getElementById("loop").checked=e.loop!==!1,Y(),document.getElementById("filename").value=t,l.events=[],l.nextId=1,l.currentFilename=t,l.status=e.status||"public",l.showBackground=!!e.showBackground,l.background=e.background||null,document.getElementById("show-background").checked=l.showBackground,document.getElementById("background-upload-container").classList.toggle("hide",!l.showBackground),l.background?document.getElementById("background-preview").src=l.background:document.getElementById("background-preview").src=pe,E(),e.events&&Array.isArray(e.events)?(e.events.forEach(n=>{typeof n.x=="number"&&typeof n.y=="number"&&n.x<=1&&n.y<=1&&(n.x=Math.round(n.x*1e3)/10,n.y=Math.round(n.y*1e3)/10)}),e.events.forEach(n=>$(n))):$()}function Be(){const e=window.open("","_blank");Q(!0).then(t=>{t?e?e.location.href=M(t):window.open(M(t),"_blank"):e&&e.close()}).catch(t=>{e&&e.close()})}function te(e){document.getElementById(e).classList.remove("hide")}function b(e){document.getElementById(e).classList.add("hide")}let re=0;function O(e){e&&(e.preventDefault(),e.stopPropagation());const t=Date.now();if(t-re<300)return;re=t;const n=document.querySelector(".sidebar"),o=document.getElementById("sidebar-overlay");n.classList.contains("open")?(n.classList.remove("open"),o.classList.remove("show")):(n.classList.add("open"),o.classList.add("show"))}window.removeEvent=be;window.duplicateEvent=We;window.updateEvent=C;window.handleShellChange=we;window.toggleAdvanced=ye;window.editScript=Ie;window.duplicateScript=Se;window.deleteScript=xe;window.addColorToEvent=ve;window.removeColorFromEvent=fe;window.copyScriptLink=ee;window.previewScript=Ge;window.toggleFullscreenMiniPreview=He;const Te={desktop:()=>({width:Math.max(1024,window.innerWidth),height:Math.max(600,window.innerHeight)}),mobile:()=>({width:390,height:844})};let T="desktop",W=!1,g="loop",X=null;function N(){return document.getElementById("mini-preview-frame")}function I(e){clearTimeout(X);const t=N();if(!l.miniPreviewEnabled||!W||!t||!t.contentWindow)return;const n=G(),o=l.activeEventId?l.events.findIndex(a=>a.id===l.activeEventId):-1;o!==-1?(n.loop=!0,n.events=[{...n.events[o],burst:1,delay:0}]):g==="idle"?n.events=[]:n.loop=g==="loop",t.contentWindow.postMessage({type:"firework-preview",config:n,restart:e},window.location.origin)}function E(){clearTimeout(X),X=setTimeout(()=>I(!!l.activeEventId),300)}function H(){const e=document.getElementById("mini-preview-info");if(!e)return;const t=l.activeEventId?l.events.findIndex(n=>n.id===l.activeEventId):-1;t!==-1?e.innerText="Đang hiển thị phát bắn #"+(t+1):g==="once"?e.innerText="Đang chạy kịch bản...":g==="idle"?e.innerText="Bấm ▶ để chạy kịch bản":e.innerText="Đang hiển thị toàn bộ"}window.addEventListener("message",e=>{var t;if(!(e.origin!==window.location.origin||!e.data)){if(e.data.type==="firework-preview-ready"&&e.source===((t=N())==null?void 0:t.contentWindow))W=!0,I(!0);else if(e.data.type==="firework-preview-ended"&&g==="once"&&!l.activeEventId){g="idle";const n=document.getElementById("mini-preview-info");n&&(n.innerText="Đã chạy xong")}}});function Me(){W=!1,x(),N().src="index.html?preview=1"}function x(){const e=document.querySelector(".mini-preview-canvas-container"),t=document.getElementById("mini-preview-stage"),n=N();if(!e||!t||!n)return;const{width:o,height:a}=Te[T](),i=Math.min(e.clientWidth/o,e.clientHeight/a)||.01;n.style.width=o+"px",n.style.height=a+"px",n.style.transform=`scale(${i})`,t.style.width=o*i+"px",t.style.height=a*i+"px"}function Ze(){const e=document.getElementById("mini-ruler-x"),t=document.getElementById("mini-ruler-y");if(!e||!t)return;e.innerHTML="",t.innerHTML="",[0,20,40,60,80,100].forEach(o=>{const a=document.createElement("span");a.innerText=o,e.appendChild(a);const i=document.createElement("span");i.innerText=100-o,t.appendChild(i)})}function Ce(){const e=document.getElementById("mini-preview");if(!e)return 0;const t=e.querySelector(".mini-preview-header"),n=e.querySelector(".mini-preview-info");return(t?t.offsetHeight:0)+(n?n.offsetHeight:0)}function ne(){const e=document.getElementById("mini-preview");if(!e)return;const{width:t,height:n}=Te[T](),o=Ce();let a=e.offsetWidth,i=a*n/t;const c=window.innerHeight*.8-o;i>c&&(i=c,a=i*t/n),e.style.width=a+"px",e.style.height=i+o+"px",x()}function Ne(e){l.miniPreviewEnabled=e!==void 0?e:!l.miniPreviewEnabled;const t=document.getElementById("mini-preview"),n=document.getElementById("btn-toggle-mini-preview");l.miniPreviewEnabled?(t.classList.remove("hide"),n.classList.add("primary"),n.classList.remove("secondary"),g=document.getElementById("loop").checked?"loop":"idle",ne(),Ze(),H(),Me()):(t.classList.add("hide"),n.classList.remove("primary"),n.classList.add("secondary"),W=!1,N().src="about:blank")}function et(){T=T==="desktop"?"mobile":"desktop";const e=T==="mobile",t=document.getElementById("btn-device-mini");t&&(t.innerHTML=`<i class="fas fa-${e?"mobile-alt":"desktop"}"></i>`,t.title=e?"Đang xem như trên điện thoại - bấm để xem như trên máy tính":"Đang xem như trên máy tính - bấm để xem như trên điện thoại");const n=document.getElementById("mini-preview");n&&(n.style.width=""),ne(),l.miniPreviewEnabled&&Me()}function He(){const e=document.getElementById("mini-preview");if(!y.fullscreenEnabled){r("Trình duyệt này không hỗ trợ chế độ toàn màn hình.","warning");return}y.fullscreenElement?y.exitFullscreen():y.requestFullscreen(e)}function tt(){ne(),r("Đã khôi phục tỉ lệ màn hình","info")}y.onfullscreenchange=()=>{const e=document.getElementById("mini-preview");y.fullscreenElement?(e.classList.add("fullscreen"),r("Đã vào chế độ toàn màn hình","info")):e.classList.remove("fullscreen"),setTimeout(x,100)};function nt(){l.events.length!==0&&(g="once",H(),I(!0))}let F=!1,B="both",j,q,v,f;function it(){const e=document.getElementById("mini-preview-resize-v"),t=document.getElementById("mini-preview-resize-h"),n=document.getElementById("mini-preview-resize-both"),o=document.getElementById("mini-preview"),a=(s,u)=>{F=!0,B=u,j=s.clientX,q=s.clientY,v=o.offsetWidth,f=o.offsetHeight,s.target.setPointerCapture&&s.target.setPointerCapture(s.pointerId),s.preventDefault(),s.stopPropagation()};e.onpointerdown=s=>a(s,"v"),t.onpointerdown=s=>a(s,"h"),n.onpointerdown=s=>a(s,"both");const i=s=>{if(!F)return;Ce();let u=v,p=f;const P=j-s.clientX,A=q-s.clientY;if(B==="v")p=Math.max(150,f+A);else if(B==="h")u=Math.max(200,v+P);else{const _=(j-s.clientX+v)/v,D=(q-s.clientY+f)/f,L=Math.max(_,D);u=Math.max(200,v*L),p=Math.max(150,f*L)}u>window.innerWidth*.95&&(u=window.innerWidth*.95,B==="both"&&(p=u*f/v)),p>window.innerHeight*.8&&(p=window.innerHeight*.8,B==="both"&&(u=p*v/f)),o.style.width=u+"px",o.style.height=p+"px",x()},c=s=>{F&&(F=!1,s.target.releasePointerCapture&&s.target.releasePointerCapture(s.pointerId))};[e,t,n].forEach(s=>{s.onpointermove=i,s.onpointerup=c})}let K=!1,de,ue,he,me;function ot(){const e=document.querySelector(".mini-preview-header"),t=document.getElementById("mini-preview");e.onpointerdown=n=>{if(n.target.closest("button"))return;K=!0,de=n.clientX,ue=n.clientY;const o=window.getComputedStyle(t);he=parseInt(o.bottom)||0,me=parseInt(o.right)||0,e.setPointerCapture(n.pointerId),n.preventDefault()},e.onpointermove=n=>{if(!K)return;const o=de-n.clientX,a=ue-n.clientY;let i=me+o,c=he+a;const s=t.getBoundingClientRect();i<0&&(i=0),c<0&&(c=0),i+s.width>window.innerWidth&&(i=window.innerWidth-s.width),c+s.height>window.innerHeight&&(c=window.innerHeight-s.height),t.style.right=i+"px",t.style.bottom=c+"px"},e.onpointerup=n=>{K=!1,e.releasePointerCapture&&e.releasePointerCapture(n.pointerId)}}document.addEventListener("DOMContentLoaded",()=>{it(),ot()});function Pe(e){l.activeEventId=l.activeEventId===e?null:e,m(),H(),I(!0)}window.toggleMiniPreview=Ne;window.togglePreviewDevice=et;window.toggleFullscreenMiniPreview=He;window.resetMiniPreviewSize=tt;window.playMiniPreviewOnce=nt;window.createNewScript=ze;window.selectEvent=Pe;window.removeEvent=be;window.updateEvent=C;window.handleShellChange=we;window.toggleAdvanced=ye;window.editScript=Ie;window.duplicateScript=Se;window.deleteScript=xe;window.addColorToEvent=ve;window.removeColorFromEvent=fe;window.copyShareLink=Z;window.copyScriptLink=ee;window.openScriptsModal=$e;window.exportConfig=Le;window.previewConfig=Be;window.saveConfig=Q;window.toggleSidebar=O;window.resizeMiniStages=x;window.notify=r;window.confirmAction=z;window.shareSocial=e=>{const t=document.getElementById("share-url").innerText;if(!t){r("Vui lòng lưu kịch bản trước khi chia sẻ!","warning");return}let n="";const o=/Android|iPhone|iPad/i.test(navigator.userAgent);switch(e){case"messenger":o?n=`fb-messenger://share/?link=${encodeURIComponent(t)}`:n=`https://www.facebook.com/dialog/send?link=${encodeURIComponent(t)}&app_id=2177090129179921&redirect_uri=${encodeURIComponent(t)}`;break;case"zalo":n=`https://sp.zalo.me/share/base?url=${encodeURIComponent(t)}`;break;case"tiktok":Z(),r("TikTok chưa hỗ trợ chia sẻ link trực tiếp. Đã sao chép link để bạn dán vào TikTok!","info");return}n&&(window.open(n,"_blank")||r("Vui lòng cho phép trình duyệt mở cửa sổ mới để chia sẻ.","warning"))};window.addEventListener("resize",x);
