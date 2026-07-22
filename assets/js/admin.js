import { getClient } from "./supabase.js";

const client = await getClient();
const $ = (selector) => document.querySelector(selector);
const loginPanel = $("#login-panel"), dashboard = $("#dashboard"), loginMessage = $("#login-message"), adminMessage = $("#admin-message");
const dialog = $("#confirm"), confirmText = $("#confirm-text"), confirmTitle = $("#confirm-title"), confirmAction = $("#confirm-action");
let cases = [], responses = [], views = [], settings = null, migrationReady = false, pendingAction = null;
const labels = { draft:"Bản nháp",published:"Đang công khai",reconciled:"Đã hòa giải",archived:"Đã lưu trữ",forgiven:"Hết giận",still_angry:"Còn giận",need_time:"Cần thêm thời gian",food:"Đền bằng đồ ăn" };

function setMessage(text, isError=false){ adminMessage.textContent=text; adminMessage.style.color=isError?"#a11d3f":"#276342"; }
function setAuthenticated(value){ loginPanel.hidden=value; dashboard.hidden=!value; }
function el(tag,className,text){ const node=document.createElement(tag); if(className)node.className=className; if(text!==undefined)node.textContent=text; return node; }
function formatDate(value){ return value ? new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(new Date(value)) : "—"; }
function ask(title,text,action){ confirmTitle.textContent=title;confirmText.textContent=text;pendingAction=action;dialog.showModal(); }

async function loadData(){
  setMessage("Đang tải dữ liệu…");
  const migrationCheck=await client.rpc("get_public_site_state");
  migrationReady=!migrationCheck.error;
  let caseResult=migrationReady?await client.from("cases").select("id,slug,case_number,title,recipient_display_name,short_description,status,visibility,audio_settings,created_at,updated_at,is_enabled,dodge_limit").order("case_number"):await client.from("cases").select("id,slug,case_number,title,short_description,created_at,updated_at,is_enabled").order("case_number");
  if(caseResult.error&&migrationReady){ migrationReady=false; caseResult=await client.from("cases").select("id,slug,case_number,title,short_description,created_at,updated_at,is_enabled").order("case_number"); }
  if(caseResult.error) throw caseResult.error;
  cases=(caseResult.data||[]).map(item=>migrationReady?item:{...item,recipient_display_name:"—",status:"draft",visibility:"admin_only",audio_settings:{enabled:true},dodge_limit:item.slug==="case-001"?4:2});
  let settingResult=migrationReady?await client.from("site_settings").select("active_case_id,maintenance_mode,global_audio_enabled,safe_mode,updated_at").eq("id",1).single():await client.from("site_settings").select("active_case_id,updated_at").eq("id",1).single();
  if(settingResult.error&&migrationReady){ migrationReady=false;settingResult=await client.from("site_settings").select("active_case_id,updated_at").eq("id",1).single(); }
  if(settingResult.error) throw settingResult.error;
  settings={maintenance_mode:false,global_audio_enabled:true,safe_mode:false,...settingResult.data};
  if(!migrationReady){ cases=cases.map(item=>({...item,status:item.id===settings.active_case_id?"published":item.status,visibility:item.id===settings.active_case_id?"public":item.visibility})); responses=[];views=[];setMessage("Migration 002 chưa được chạy; dashboard đang ở chế độ tương thích.",true); }
  else {
    const [responseResult,viewResult]=await Promise.all([client.from("case_responses").select("id,case_id,response_type,message,is_read,is_archived,created_at").eq("is_archived",false).order("created_at",{ascending:false}).limit(100),client.from("case_views").select("case_id").limit(10000)]);
    responses=responseResult.error?[]:responseResult.data;views=viewResult.error?[]:viewResult.data;
    setMessage("");
  }
  renderAll();
}

function renderSummary(){
  const active=cases.find(item=>item.id===settings.active_case_id); const unread=responses.filter(item=>!item.is_read).length;
  const items=[["Tổng hồ sơ",cases.length],["Bản nháp",cases.filter(c=>c.status==="draft").length],["Đang công khai",active?`Hồ sơ ${active.case_number}`:"Chưa có"],["Đã hòa giải",cases.filter(c=>c.status==="reconciled").length],["Phản hồi mới",unread],["Cập nhật gần nhất",formatDate(settings.updated_at)]];
  $("#summary").replaceChildren(...items.map(([label,value])=>{const card=el("article","summary-card");card.append(el("small","",label),el("strong","",String(value)));return card}));
  $("#response-badge").hidden=unread===0;$("#response-badge").textContent=String(unread);
  const recent=$("#recent-cases");recent.replaceChildren(...cases.slice(-3).reverse().map(item=>el("p","",`Hồ sơ ${item.case_number} · ${item.title} · ${labels[item.status]||item.status}`)));
}

function makeCaseCard(item){
  const card=el("article",`case-card${item.id===settings.active_case_id?" active":""}`);const head=el("div","case-head");const heading=el("div");heading.append(el("span","tag",`HỒ SƠ ${item.case_number}`),el("h2","",item.title));const status=el("span",`status-pill ${item.status}`,item.id===settings.active_case_id?"ĐANG CÔNG KHAI":labels[item.status]||item.status);head.append(heading,status);
  const latestResponse=responses.find(r=>r.case_id===item.id);const description=el("p","",item.short_description);const meta=el("div","case-meta");[["Người nhận",item.recipient_display_name||"—"],["Tạo",formatDate(item.created_at)],["Cập nhật",formatDate(item.updated_at)],["Nhạc",item.audio_settings?.enabled===false?"Tắt":"Bật"],["Lượt mở",views.filter(v=>v.case_id===item.id).length],["Phản hồi gần nhất",latestResponse?labels[latestResponse.response_type]||latestResponse.response_type:"Chưa có"]].forEach(([a,b])=>meta.append(el("span","",`${a}: ${b}`)));
  const actions=el("div","card-actions");const preview=el("a","","Xem trước");preview.href=`preview.html?id=${encodeURIComponent(item.id)}`;preview.target="_blank";preview.rel="noopener";actions.append(preview);
  if(item.id!==settings.active_case_id&&item.status!=="archived"){const publish=el("button","","Chọn công khai");publish.addEventListener("click",()=>ask("Công khai hồ sơ?",`Hồ sơ ${item.case_number} sẽ thay thế hồ sơ đang hiển thị.`,()=>publishCase(item.id)));actions.append(publish)}
  if(migrationReady&&item.status!=="archived"&&item.id!==settings.active_case_id){const archive=el("button","secondary","Lưu trữ");archive.addEventListener("click",()=>ask("Lưu trữ hồ sơ?","Hồ sơ không bị xóa và có thể khôi phục sau.",()=>archiveCase(item.id)));actions.append(archive)}
  const feedback=el("button","secondary","Xem phản hồi");feedback.addEventListener("click",()=>{showView("responses");$("#response-filter").value="all";renderResponses(item.id)});actions.append(feedback);card.append(head,description,meta,actions);return card;
}

function renderCases(){ $("#case-list").replaceChildren(...cases.map(makeCaseCard)); }
function renderResponses(caseId=null){
  const filter=$("#response-filter").value;let data=responses.filter(item=>!caseId||item.case_id===caseId);if(filter==="unread")data=data.filter(item=>!item.is_read);else if(filter!=="all")data=data.filter(item=>item.response_type===filter);
  const container=$("#response-list");if(!migrationReady)return container.replaceChildren(el("div","panel empty-state","Hãy chạy migration 002 để bật phản hồi."));if(!data.length)return container.replaceChildren(el("div","panel empty-state","Chưa có phản hồi phù hợp."));
  container.replaceChildren(...data.map(item=>{const related=cases.find(c=>c.id===item.case_id);const card=el("article",`response-card${item.is_read?"":" unread"}`);const head=el("header");head.append(el("strong","",`Hồ sơ ${related?.case_number||item.case_id} · ${labels[item.response_type]||item.response_type}`),el("time","",formatDate(item.created_at)));card.append(head,el("p","message-body",item.message||"Không để lại lời nhắn."));if(!item.is_read){const button=el("button","secondary","Đánh dấu đã xem");button.addEventListener("click",()=>markRead(item.id));card.append(button)}return card}));
}
async function renderHistory(){const container=$("#history-list");if(!migrationReady)return container.replaceChildren(el("p","","Hãy chạy migration 002 để bật audit log."));const {data,error}=await client.from("audit_logs").select("id,action,entity_type,entity_id,created_at").order("created_at",{ascending:false}).limit(50);if(error)return container.replaceChildren(el("p","","Không tải được lịch sử."));container.replaceChildren(...(data||[]).map(item=>el("p","",`${formatDate(item.created_at)} · ${item.action} · ${item.entity_type} ${item.entity_id??""}`)));}
function renderSettings(){ $("#maintenance-mode").checked=settings.maintenance_mode;$("#global-audio").checked=settings.global_audio_enabled;$("#safe-mode").checked=settings.safe_mode; }
function renderAll(){renderSummary();renderCases();renderResponses();renderSettings()}

async function publishCase(id){if(!migrationReady)return setMessage("Không thể đổi hồ sơ trong chế độ tương thích. Hãy kiểm tra migration 002.",true);const {error}=await client.rpc("publish_case",{p_case_id:id});if(error)return setMessage("Không thể công khai hồ sơ: "+error.message,true);setMessage("Đã đổi hồ sơ công khai.");await loadData()}
async function archiveCase(id){const {error}=await client.from("cases").update({status:"archived",visibility:"admin_only"}).eq("id",id);if(error)return setMessage("Không thể lưu trữ hồ sơ.",true);await loadData()}
async function markRead(id){const {error}=await client.from("case_responses").update({is_read:true}).eq("id",id);if(error)return setMessage("Không thể cập nhật phản hồi.",true);const item=responses.find(r=>r.id===id);if(item)item.is_read=true;renderSummary();renderResponses()}
async function saveSettings(){if(!migrationReady)return setMessage("Hãy chạy migration 002 trước khi dùng công cụ khẩn cấp.",true);const patch={maintenance_mode:$("#maintenance-mode").checked,global_audio_enabled:$("#global-audio").checked,safe_mode:$("#safe-mode").checked};const {error}=await client.from("site_settings").update(patch).eq("id",1);if(error)return setMessage("Không thể lưu cài đặt.",true);settings={...settings,...patch};setMessage("Đã lưu cài đặt an toàn.")}

function showView(name){document.querySelectorAll(".admin-view").forEach(view=>view.hidden=view.id!==`view-${name}`);document.querySelectorAll(".nav-item").forEach(item=>item.classList.toggle("active",item.dataset.view===name));$("#view-title").textContent={overview:"Tổng quan",cases:"Hồ sơ",create:"Tạo hồ sơ",responses:"Phản hồi",history:"Lịch sử",settings:"Cài đặt"}[name];$(".sidebar").classList.remove("open");$("#menu-toggle").setAttribute("aria-expanded","false");if(name==="history")renderHistory()}
document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>showView(button.dataset.view)));document.querySelectorAll("[data-view-target]").forEach(button=>button.addEventListener("click",()=>showView(button.dataset.viewTarget)));$("#response-filter").addEventListener("change",()=>renderResponses());$("#menu-toggle").addEventListener("click",()=>{const open=$(".sidebar").classList.toggle("open");$("#menu-toggle").setAttribute("aria-expanded",String(open))});
confirmAction.addEventListener("click",async(event)=>{event.preventDefault();dialog.close();const action=pendingAction;pendingAction=null;if(action)await action()});
$("#save-settings").addEventListener("click",saveSettings);$("#restore-case-001").addEventListener("click",()=>{const original=cases.find(c=>c.slug==="case-001");if(original)ask("Khôi phục hồ sơ 001?","Hồ sơ 001 sẽ trở lại link chính. Không dữ liệu nào bị xóa.",()=>publishCase(original.id))});
$("#login-form").addEventListener("submit",async(event)=>{event.preventDefault();if(!client){loginMessage.textContent="Supabase chưa được cấu hình.";return}const button=event.submitter;button.disabled=true;button.textContent="Đang đăng nhập…";const {error}=await client.auth.signInWithPassword({email:$("#email").value,password:$("#password").value});button.disabled=false;button.textContent="Đăng nhập";if(error){loginMessage.textContent="Email hoặc mật khẩu không đúng, hoặc kết nối đang gặp sự cố.";return}setAuthenticated(true);event.target.reset();await loadData().catch(error=>setMessage(error.message,true))});
$("#logout").addEventListener("click",async()=>{await client?.auth.signOut();setAuthenticated(false);loginMessage.textContent="Đã đăng xuất an toàn."});
if(client){const {data:{session}}=await client.auth.getSession();setAuthenticated(Boolean(session));if(session)await loadData().catch(error=>setMessage(error.message,true));client.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"||!session)setAuthenticated(false)})}else loginMessage.textContent="Supabase chưa được cấu hình.";
window.addEventListener("sorry-site:case-created",async()=>{await loadData().catch(error=>setMessage(error.message,true));showView("cases")});
