import{f as Z,S as L,T as ee,M as te}from"./MyMath-DyofDy1u.js";window.fscreen=Z;window.Stage=L;window.Ticker=ee;window.MyMath=te;const r={events:[],nextId:1,currentFilename:"",activeEventId:null,miniPreviewEnabled:!1},p={Red:"#ff0043",Green:"#14fc56",Blue:"#1e7fff",Purple:"#e60aff",Gold:"#ffbf36",White:"#ffffff"},S=Math.PI*2,B=.9,ne=["Hoa cúc","Văn bản","Liễu","Trái tim","Ngôi sao","Kim cương","Bông tuyết","Bông sen","Hành tinh","Mặt cười","Mặt mèo","Vòng nhẫn","Nổ chéo","Cây cọ","Ma","Đuôi ngựa","Nhấp nháy","Nổ lách tách","Tạm dừng"],ie=[{name:"Đỏ (Red)",value:"Red"},{name:"Xanh lá (Green)",value:"Green"},{name:"Xanh dương (Blue)",value:"Blue"},{name:"Tím (Purple)",value:"Purple"},{name:"Vàng (Gold)",value:"Gold"},{name:"Trắng (White)",value:"White"},{name:"Ngẫu nhiên",value:"Ngẫu nhiên"}];document.addEventListener("DOMContentLoaded",()=>{document.getElementById("btn-add-event").addEventListener("click",y),document.getElementById("btn-save").addEventListener("click",I),document.getElementById("btn-preview").addEventListener("click",W),document.getElementById("btn-export").addEventListener("click",R),document.getElementById("btn-import").addEventListener("click",()=>document.getElementById("import-file").click()),document.getElementById("btn-my-scripts").addEventListener("click",D),document.getElementById("btn-copy-link").addEventListener("click",le),document.getElementById("btn-toggle-mini-preview").addEventListener("click",()=>x()),document.getElementById("import-file").addEventListener("change",re);const e=document.getElementById("btn-toggle-settings"),n=document.getElementById("btn-toggle-settings-header"),t=document.getElementById("btn-fab-add"),i=document.getElementById("sidebar-overlay");e&&e.addEventListener("click",w),n&&n.addEventListener("click",w),t&&t.addEventListener("click",()=>y()),i&&i.addEventListener("click",w),r.events.length===0&&y()});function h(e,n="info"){const t=document.getElementById("notification-container"),i=document.createElement("div");i.className=`toast ${n}`;let o="info-circle";n==="success"&&(o="check-circle"),n==="error"&&(o="exclamation-circle"),n==="warning"&&(o="exclamation-triangle"),i.innerHTML=`
        <i class="fas fa-${o}"></i>
        <span>${e}</span>
    `,t.appendChild(i),setTimeout(()=>{i.classList.add("fade-out"),setTimeout(()=>i.remove(),300)},4e3)}function se(e,n){const t=document.getElementById("confirm-modal"),i=document.getElementById("confirm-message"),o=document.getElementById("btn-confirm-yes"),l=document.getElementById("btn-confirm-no");i.innerText=e,t.classList.remove("hide");const a=()=>{c(),n()},s=()=>{c()},c=()=>{t.classList.add("hide"),o.removeEventListener("click",a),l.removeEventListener("click",s)};o.addEventListener("click",a),l.addEventListener("click",s)}function y(e=null){const n=r.nextId++;let t;e?t={burst:1,shell:"Hoa cúc",color:"Ngẫu nhiên",x:.5,y:.5,delay:0,size:1,strobe:!1,pistil:!1,streamers:!1,crossette:!1,crackle:!1,horsetail:!1,comet:!1,starDensity:1,starLife:2500,spreadSize:350,...e,id:n}:t={id:n,burst:1,shell:"Hoa cúc",color:"Ngẫu nhiên",x:.5,y:.5,delay:0,size:1,strobe:!1,pistil:!1,streamers:!1,crossette:!1,crackle:!1,horsetail:!1,comet:!1,starDensity:1,starLife:2500,spreadSize:350},r.events.push(t),b()}function N(e,n){const t=r.events.find(i=>i.id===e);!t||!n||(Array.isArray(t.color)?t.color.push(n):t.color=[t.color,n],b())}function z(e,n){const t=r.events.find(i=>i.id===e);!t||!Array.isArray(t.color)?t.color="Ngẫu nhiên":(t.color.splice(n,1),t.color.length===1&&(t.color=t.color[0]),t.color.length===0&&(t.color="Ngẫu nhiên")),b()}function ae(e){return(Array.isArray(e.color)?e.color:[e.color]).map((t,i)=>`
        <div class="color-tag" style="--tag-color: ${t}">
            <span class="dot"></span>
            <span class="label">${t}</span>
            <i class="fas fa-times" onclick="removeColorFromEvent(${e.id}, ${i})"></i>
        </div>
    `).join("")}function A(e){r.events=r.events.filter(n=>n.id!==e),b()}function $(e,n,t){const i=r.events.find(o=>o.id===e);i&&(["burst","x","y","delay","size","duration","starLife","starDensity","spreadSize"].includes(n)?i[n]=t===""?void 0:Number(t):["strobe","pistil","streamers","crossette","crackle","horsetail","comet"].includes(n)?i[n]=t===!0:i[n]=t)}function b(){const e=document.getElementById("event-list");if(r.events.length===0){e.innerHTML=`
            <div class="empty-state">
                <i class="fas fa-sparkles"></i>
                <p>Chưa có phát bắn nào. Hãy nhấn "Thêm phát bắn" để bắt đầu.</p>
            </div>
        `;return}e.innerHTML="",r.events.forEach((n,t)=>{const i=oe(n,t);e.appendChild(i)})}function oe(e,n){const t=document.createElement("div");t.className="event-card"+(r.activeEventId===e.id?" active":""),t.dataset.id=e.id,t.onclick=l=>{l.target.tagName==="INPUT"||l.target.tagName==="SELECT"||l.target.tagName==="BUTTON"||l.target.closest("button")||l.target.closest(".color-tag")||U(e.id)};const i=ne.map(l=>`<option value="${l}" ${e.shell===l?"selected":""}>${l}</option>`).join(""),o=ie.map(l=>`<option value="${l.value}" ${e.color===l.value?"selected":""}>${l.name}</option>`).join("");return t.innerHTML=`
        <div class="event-card-header">
            <span class="event-id">#${n+1}</span>
            <div class="event-controls">
                <button class="btn text small btn-remove" onclick="removeEvent(${e.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>

        <div class="event-grid-3">
            <div class="form-group">
                <label>Đợt (Burst)</label>
                <input type="number" value="${e.burst}" onchange="updateEvent(${e.id}, 'burst', this.value)">
            </div>
            <div class="form-group" style="grid-column: span 2;">
                <label>Loại pháo (Shell)</label>
                <select onchange="handleShellChange(${e.id}, this)">
                    ${i}
                </select>
            </div>
        </div>

        <div id="shell-specific-${e.id}">
            ${e.shell==="Văn bản"?`
                <div class="form-group">
                    <label>Nội dung chữ (Text)</label>
                    <input type="text" value="${e.text||""}" onchange="updateEvent(${e.id}, 'text', this.value)">
                </div>
            `:""}
            ${e.shell==="Tạm dừng"?`
                <div class="form-group">
                    <label>Thời gian nghỉ (ms)</label>
                    <input type="number" value="${e.duration||1e3}" onchange="updateEvent(${e.id}, 'duration', this.value)">
                </div>
            `:""}
        </div>

        <div class="event-grid-4">
            <div class="form-group">
                <label>X (0-1)</label>
                <input type="number" step="0.1" min="0" max="1" value="${e.x}" onchange="updateEvent(${e.id}, 'x', this.value)">
            </div>
            <div class="form-group">
                <label>Y (0-1)</label>
                <input type="number" step="0.1" min="0" max="1" value="${e.y}" onchange="updateEvent(${e.id}, 'y', this.value)">
            </div>
            <div class="form-group">
                <label>Size</label>
                <input type="number" min="0" max="5" value="${e.size}" onchange="updateEvent(${e.id}, 'size', this.value)">
            </div>
            <div class="form-group">
                <label>Trễ (ms)</label>
                <input type="number" step="100" min="0" value="${e.delay}" onchange="updateEvent(${e.id}, 'delay', this.value)">
            </div>
        </div>

        <div class="form-group">
            <label>Màu sắc</label>
            <div class="color-tags" id="color-tags-${e.id}">
                ${ae(e)}
            </div>
            <div class="color-input-group compact">
                <select id="preset-color-${e.id}" onchange="if(this.value) { addColorToEvent(${e.id}, this.value); this.value=''; }">
                    <option value="">+ Mẫu...</option>
                    ${o}
                </select>
                <input type="color" id="picker-color-${e.id}" onchange="addColorToEvent(${e.id}, this.value)">
                <div class="input-with-btn">
                    <input type="text" id="custom-color-${e.id}" placeholder="Hex/Tên" onkeydown="if(event.key==='Enter') { addColorToEvent(${e.id}, this.value); this.value=''; }">
                    <button class="btn secondary small" onclick="const input=document.getElementById('custom-color-${e.id}'); addColorToEvent(${e.id}, input.value); input.value='';">Thêm</button>
                </div>
            </div>
        </div>

        <div class="advanced-toggle" onclick="toggleAdvanced(${e.id})">
            <i class="fas fa-chevron-down"></i> Tùy chỉnh nâng cao
        </div>

        <div id="advanced-${e.id}" class="advanced-settings hide">
            <div class="form-group checkbox">
                <input type="checkbox" id="strobe-${e.id}" ${e.strobe?"checked":""} onchange="updateEvent(${e.id}, 'strobe', this.checked)">
                <label for="strobe-${e.id}">Lấp lánh (Strobe)</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="crackle-${e.id}" ${e.crackle?"checked":""} onchange="updateEvent(${e.id}, 'crackle', this.checked)">
                <label for="crackle-${e.id}">Nổ lách tách</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="pistil-${e.id}" ${e.pistil?"checked":""} onchange="updateEvent(${e.id}, 'pistil', this.checked)">
                <label for="pistil-${e.id}">Nhụy ở giữa</label>
            </div>
            <div class="form-group checkbox">
                <input type="checkbox" id="streamers-${e.id}" ${e.streamers?"checked":""} onchange="updateEvent(${e.id}, 'streamers', this.checked)">
                <label for="streamers-${e.id}">Dải sáng (Streamers)</label>
            </div>
            <div class="form-group">
                <label>Mật độ hạt</label>
                <input type="number" step="0.5" value="${e.starDensity||""}" placeholder="Mặc định: 1" onchange="updateEvent(${e.id}, 'starDensity', this.value)">
            </div>
            <div class="form-group">
                <label>Tuổi thọ sao (ms)</label>
                <input type="number" step="500" value="${e.starLife||""}" placeholder="VD: 3000" onchange="updateEvent(${e.id}, 'starLife', this.value)">
            </div>
        </div>
    `,t}function O(e,n){const t=n.value;$(e,"shell",t),b()}function j(e){const n=document.getElementById(`advanced-${e}`),i=n.previousElementSibling.querySelector("i");n.classList.contains("hide")?(n.classList.remove("hide"),i.className="fas fa-chevron-up"):(n.classList.add("hide"),i.className="fas fa-chevron-down")}function P(){return{title:document.getElementById("title").value||"Kịch bản mới",subtitle:document.getElementById("subtitle").value||"",author:document.getElementById("author").value||"Anonymous",loop:document.getElementById("loop").checked,status:r.status||"public",events:r.events.map(e=>{const{id:n,...t}=e;return t})}}function I(e=!1){let n=document.getElementById("filename").value;if(!n)if(e)n="preview_temp";else return h("Vui lòng nhập tên file!","warning"),Promise.reject("No filename");const t=P();return e?h("Đang chuẩn bị xem thử...","info"):(V("save-modal"),document.getElementById("save-status").innerText="Đang lưu kịch bản...",document.getElementById("save-spinner").classList.remove("hide"),document.getElementById("save-actions").classList.add("hide")),fetch("api/save_config.php",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:n,config:t})}).then(i=>i.json()).then(i=>{if(i.success)return e||(r.currentFilename=i.filename,document.getElementById("save-status").innerText="Đã lưu kịch bản thành công!",document.getElementById("save-spinner").classList.add("hide"),document.getElementById("save-actions").classList.remove("hide"),_(i.filename)),i.filename;throw e?h("Lỗi xem thử: "+i.message,"error"):(h("Lỗi: "+i.message,"error"),k("save-modal")),new Error(i.message)}).catch(i=>{throw e||(k("save-modal"),h("Đã xảy ra lỗi khi lưu kịch bản.","error")),console.error(i),i})}function _(e){const n=document.getElementById("share-bar"),t=document.getElementById("share-url"),i=window.location.origin+window.location.pathname.replace("builder.html","index.html")+"?config="+e;t.innerText=i,n.classList.remove("hide")}function le(){const e=document.getElementById("share-url").innerText;navigator.clipboard.writeText(e).then(()=>{const n=document.getElementById("btn-copy-link"),t=n.innerHTML;n.innerHTML='<i class="fas fa-check"></i> Đã sao chép!',setTimeout(()=>n.innerHTML=t,2e3)})}function D(){V("scripts-modal"),H()}function H(){const e=document.getElementById("scripts-list");e.innerHTML='<div class="spinner"></div>',fetch("api/manage_configs.php?action=list").then(n=>n.json()).then(n=>{if(e.innerHTML="",n.length===0){e.innerHTML='<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Bạn chưa có kịch bản nào.</p>';return}n.forEach(t=>{const i=document.createElement("div");i.className="script-item";const o=t.status==="private";i.innerHTML=`
                <h4>${o?'<i class="fas fa-lock" title="Riêng tư"></i> ':""}${t.title}</h4>
                <div class="meta">
                    <span><i class="fas fa-user"></i> ${t.author}</span><br>
                    <span><i class="fas fa-fireworks"></i> ${t.eventCount} phát bắn</span>
                </div>
                <div class="script-actions">
                    <button class="btn primary small" onclick="editScript('${t.id}')" title="Sửa"><i class="fas fa-edit"></i></button>
                    <button class="btn secondary small" onclick="duplicateScript('${t.id}')" title="Nhân bản"><i class="fas fa-copy"></i></button>
                    <button class="btn secondary small" onclick="copyScriptLink('${t.id}')" title="Sao chép link"><i class="fas fa-link"></i></button>
                    ${o?"":`<button class="btn danger small" onclick="deleteScript('${t.id}')"><i class="fas fa-trash"></i></button>`}
                </div>
            `,e.appendChild(i)})})}function F(e){fetch(`configs/${e}.json?t=${Date.now()}`).then(n=>n.json()).then(n=>{T(n,e),k("scripts-modal"),_(e)}).catch(n=>h("Không thể tải kịch bản: "+n,"error"))}function Y(e){fetch(`configs/${e}.json?t=${Date.now()}`).then(n=>n.json()).then(n=>{T(n,e+"_copy"),k("scripts-modal"),document.getElementById("share-bar").classList.add("hide"),h("Đã nhân bản kịch bản! Bạn có thể chỉnh sửa và lưu thành file mới.","success")}).catch(n=>h("Không thể nhân bản kịch bản: "+n,"error"))}function X(e){se(`Bạn có chắc chắn muốn xóa kịch bản "${e}"?`,()=>{fetch("api/manage_configs.php?action=delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:e})}).then(n=>n.json()).then(n=>{n.success?(H(),r.currentFilename===e&&document.getElementById("share-bar").classList.add("hide"),h("Đã xóa kịch bản thành công!","success")):h("Lỗi: "+n.message,"error")})})}function R(){const e=P(),n="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(e,null,2)),t=document.createElement("a"),i=(document.getElementById("filename").value||"firework_config")+".json";t.setAttribute("href",n),t.setAttribute("download",i),document.body.appendChild(t),t.click(),t.remove()}function re(e){const n=e.target.files[0];if(!n)return;const t=new FileReader;t.onload=function(i){try{const o=JSON.parse(i.target.result);T(o,n.name.replace(".json","")),h("Đã nhập kịch bản thành công!","success")}catch{h("Lỗi: File JSON không đúng định dạng.","error")}},t.readAsText(n)}function T(e,n){document.getElementById("title").value=e.title||"",document.getElementById("subtitle").value=e.subtitle||"",document.getElementById("author").value=e.author||"",document.getElementById("loop").checked=e.loop!==!1,document.getElementById("filename").value=n,r.events=[],r.nextId=1,r.currentFilename=n,r.status=e.status||"public",e.events&&Array.isArray(e.events)?e.events.forEach(t=>y(t)):y()}function W(){I(!0).then(e=>{window.open(`index.html?config=${e}`,"_blank")}).catch(e=>{console.error("Preview failed:",e)})}function V(e){document.getElementById(e).classList.remove("hide")}function k(e){document.getElementById(e).classList.add("hide")}function w(){const e=document.querySelector(".sidebar"),n=document.getElementById("sidebar-overlay");e.classList.contains("open")?(e.classList.remove("open"),n.classList.remove("show")):(e.classList.add("open"),n.classList.add("show"))}function G(e){const n=window.location.origin+window.location.pathname.replace("builder.html","index.html")+"?config="+e;navigator.clipboard.writeText(n).then(()=>{h("Đã sao chép link kịch bản!","success")})}window.removeEvent=A;window.updateEvent=$;window.handleShellChange=O;window.toggleAdvanced=j;window.editScript=F;window.duplicateScript=Y;window.deleteScript=X;window.addColorToEvent=N;window.removeColorFromEvent=z;window.copyScriptLink=G;const q=new L("mini-trails-canvas"),v=new L("mini-main-canvas"),u={drawWidth:3,airDrag:.98,airDragHeavy:.992,active:{},_pool:[],_new(){return{}},add(e,n,t,i,o,l,a,s){const c=this._pool.pop()||this._new();let d=Array.isArray(t)?t[Math.floor(Math.random()*t.length)]:t||p.White;return d==="Ngẫu nhiên"&&(d=Object.values(p)[Math.floor(Math.random()*6)]),c.visible=!0,c.heavy=!1,c.x=e,c.y=n,c.prevX=e,c.prevY=n,c.color=d,c.speedX=Math.sin(i)*o+(a||0),c.speedY=Math.cos(i)*o+(s||0),c.life=l,c.fullLife=l,c.spinAngle=Math.random()*S,c.spinSpeed=.8,c.spinRadius=0,c.sparkFreq=0,c.sparkSpeed=1,c.sparkTimer=0,c.sparkColor=d,c.sparkLife=750,c.sparkLifeVariation=.25,c.strobe=!1,this.active[d]||(this.active[d]=[]),this.active[d].push(c),c},returnInstance(e){e.onDeath&&e.onDeath(e),e.onDeath=null,e.secondColor=null,e.transitionTime=0,e.colorChanged=!1,this._pool.push(e)},reset(){Object.keys(this.active).forEach(e=>this.active[e]=[])}},m={drawWidth:1,airDrag:.9,active:{},_pool:[],_new(){return{}},add(e,n,t,i,o,l){const a=this._pool.pop()||this._new();return a.x=e,a.y=n,a.prevX=e,a.prevY=n,a.color=t,a.speedX=Math.sin(i)*o,a.speedY=Math.cos(i)*o,a.life=l,this.active[t]||(this.active[t]=[]),this.active[t].push(a),a},returnInstance(e){this._pool.push(e)},reset(){Object.keys(this.active).forEach(e=>this.active[e]=[])}},J={active:[],_pool:[],_new(){return{}},add(e,n,t){const i=this._pool.pop()||this._new();return i.x=e,i.y=n,i.radius=t,this.active.push(i),i},returnInstance(e){this._pool.push(e)},reset(){this.active=[]}};class ce{constructor(n){if(Object.assign(this,n),this.starLifeVariation=n.starLifeVariation||.125,this.color=n.color||p.White,!this.starCount){const t=n.starDensity||1,i=this.spreadSize/54;this.starCount=Math.max(6,i*i*t)}}launch(n,t){this.burst(n*v.width,t*v.height)}burst(n,t){const i=this.spreadSize/96;let o,l,a;this.glitter==="light"?(o=400,l=.3,a=300):this.glitter==="willow"?(o=80,l=.48,a=1500):(o=200,l=.44,a=700);const s=(c,d)=>{const f=u.add(n,t,this.color,c,d*i,this.starLife+Math.random()*this.starLife*this.starLifeVariation,0,0);this.glitter&&(f.sparkFreq=o,f.sparkSpeed=l,f.sparkLife=a,f.sparkColor=this.glitterColor||f.color,f.sparkTimer=Math.random()*f.sparkFreq)};if(this.shapePoints)this.shapePoints.forEach(c=>{const d=u.add(n,t,this.color,0,0,this.starLife+Math.random()*this.starLife*this.starLifeVariation);d.speedX=c.x*i,d.speedY=c.y*i});else{const c=this.starCount;for(let d=0;d<c;d++){const f=Math.random()*S,Q=Math.random();s(f,Q)}}J.add(n,t,this.spreadSize/4)}}function de(e,n){const t=n||1;switch(e){case"Liễu":return{shellSize:t,spreadSize:300+t*100,starDensity:.7,starLife:3e3+t*300,glitter:"willow",glitterColor:p.Gold,color:p.Gold};case"Trái tim":return{shellSize:t,spreadSize:300+t*100,starLife:1e3+t*200,color:p.Red};case"Ngôi sao":return{shellSize:t,spreadSize:350+t*100,starLife:1200+t*200,color:p.Gold};default:return{shellSize:t,spreadSize:300+t*100,starLife:900+t*200,color:p.White}}}let g=null,E=0;function he(e,n){if(!r.miniPreviewEnabled)return;const t=e,i=n;Object.keys(u.active).forEach(o=>{const l=u.active[o];for(let a=l.length-1;a>=0;a--){const s=l[a];if(s.life-=t,s.life<=0)l.splice(a,1),u.returnInstance(s);else if(s.prevX=s.x,s.prevY=s.y,s.x+=s.speedX*i,s.y+=s.speedY*i,s.speedX*=u.airDrag,s.speedY*=u.airDrag,s.speedY+=t/1e3*B,s.sparkFreq)for(s.sparkTimer-=t;s.sparkTimer<0;)s.sparkTimer+=s.sparkFreq,m.add(s.x,s.y,s.sparkColor,Math.random()*S,Math.random()*s.sparkSpeed,s.sparkLife)}}),Object.keys(m.active).forEach(o=>{const l=m.active[o];for(let a=l.length-1;a>=0;a--){const s=l[a];s.life-=t,s.life<=0?(l.splice(a,1),m.returnInstance(s)):(s.prevX=s.x,s.prevY=s.y,s.x+=s.speedX*i,s.y+=s.speedY*i,s.speedX*=m.airDrag,s.speedY*=m.airDrag,s.speedY+=t/1e3*B)}}),ue()}function ue(){const e=q.ctx,n=v.ctx,t=v.width,i=v.height;e.globalCompositeOperation="source-over",e.fillStyle="rgba(0, 0, 0, 0.175)",e.fillRect(0,0,t,i),n.clearRect(0,0,t,i),e.globalCompositeOperation="lighten",e.lineWidth=u.drawWidth,Object.keys(u.active).forEach(o=>{const l=u.active[o];e.strokeStyle=o,e.beginPath(),l.forEach(a=>{e.moveTo(a.x,a.y),e.lineTo(a.prevX,a.prevY)}),e.stroke()}),e.lineWidth=m.drawWidth,Object.keys(m.active).forEach(o=>{const l=m.active[o];e.strokeStyle=o,e.beginPath(),l.forEach(a=>{e.moveTo(a.x,a.y),e.lineTo(a.prevX,a.prevY)}),e.stroke()})}function K(){const e=document.querySelector(".mini-preview-canvas-container"),n=e.offsetWidth,t=e.offsetHeight;q.resize(n,t),v.resize(n,t)}let M=!1;function x(e){r.miniPreviewEnabled=e!==void 0?e:!r.miniPreviewEnabled;const n=document.getElementById("mini-preview"),t=document.getElementById("btn-toggle-mini-preview");r.miniPreviewEnabled?(n.classList.remove("hide"),t.classList.add("primary"),t.classList.remove("secondary"),K(),M||(v.addEventListener("ticker",he),M=!0),me()):(n.classList.add("hide"),t.classList.remove("primary"),t.classList.add("secondary"),pe())}function me(){g&&clearInterval(g),g=setInterval(()=>{if(r.miniPreviewEnabled)if(r.activeEventId){const e=r.events.find(n=>n.id===r.activeEventId);e&&C(e)}else{const e=r.events.length>0?Math.max(...r.events.map(t=>t.burst)):0;if(e===0)return;E++,E>e&&(E=1),r.events.filter(t=>t.burst===E).forEach(t=>setTimeout(()=>C(t),t.delay||0))}},2e3)}function pe(){g&&clearInterval(g),g=null,u.reset(),m.reset(),J.reset()}function C(e){if(e.shell==="Tạm dừng")return;const n=de(e.shell,e.size);e.color&&(Array.isArray(e.color)?n.color=e.color.map(i=>p[i]||i):n.color=p[e.color]||e.color),new ce(n).launch(e.x||.5,e.y||.5)}function U(e){r.activeEventId===e?r.activeEventId=null:r.activeEventId=e,b();const n=document.getElementById("mini-preview-info");if(r.activeEventId){const t=r.events.findIndex(i=>i.id===e)+1;n.innerText="Đang hiển thị phát bắn #"+t,r.miniPreviewEnabled||x(!0)}else n.innerText="Đang hiển thị toàn bộ"}window.toggleMiniPreview=x;window.selectEvent=U;window.removeEvent=A;window.updateEvent=$;window.handleShellChange=O;window.toggleAdvanced=j;window.editScript=F;window.duplicateScript=Y;window.deleteScript=X;window.addColorToEvent=N;window.removeColorFromEvent=z;window.copyScriptLink=G;window.openScriptsModal=D;window.exportConfig=R;window.previewConfig=W;window.saveConfig=I;window.toggleSidebar=w;window.addEventListener("resize",K);
