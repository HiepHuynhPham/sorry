import { getClient } from "./supabase.js";
const client = await getClient();
const loginPanel = document.querySelector("#login-panel"), dashboard = document.querySelector("#dashboard");
const loginMessage = document.querySelector("#login-message"), adminMessage = document.querySelector("#admin-message"), list = document.querySelector("#case-list");
const dialog = document.querySelector("#confirm"), confirmText = document.querySelector("#confirm-text"); let pendingCase = null;

function message(element, text, error=false){ element.textContent=text; element.style.color=error?"#a11d3f":"#236d43"; }
function setAuthenticated(value){ loginPanel.hidden=value; dashboard.hidden=!value; }
function caseCard(item, activeId){
  const article=document.createElement("article"); article.className=`case-card${item.id===activeId?" active":""}`;
  const preview=document.createElement("iframe"); preview.title=`Xem trước ${item.title}`; preview.src=`cases/${item.slug}.html`; preview.loading="lazy";
  const title=document.createElement("h2"); title.textContent=`Hồ sơ ${item.case_number}: ${item.title}`;
  const description=document.createElement("p"); description.textContent=item.short_description;
  article.append(preview,title,description);
  if(item.id===activeId){const badge=document.createElement("span");badge.className="status";badge.textContent="Đang công khai";article.append(badge)}
  else {const button=document.createElement("button");button.type="button";button.textContent="Chọn làm hồ sơ công khai";button.addEventListener("click",()=>{pendingCase=item;confirmText.textContent=`Website chính sẽ chuyển sang hồ sơ ${item.case_number}: ${item.title}.`;dialog.showModal()});article.append(button)}
  return article;
}
async function loadDashboard(){
  message(adminMessage,"Đang tải danh sách hồ sơ…");
  const [{data:cases,error:caseError},{data:setting,error:settingError}]=await Promise.all([client.from("cases").select("id,slug,case_number,title,short_description,is_enabled").order("case_number"),client.from("site_settings").select("active_case_id").eq("id",1).single()]);
  if(caseError||settingError){message(adminMessage,"Không tải được dữ liệu. Session có thể đã hết hạn hoặc tài khoản không đủ quyền.",true);return}
  list.replaceChildren(...cases.map(item=>caseCard(item,setting.active_case_id)));message(adminMessage,"");
}
document.querySelector("#login-form").addEventListener("submit",async(event)=>{event.preventDefault();if(!client)return message(loginMessage,"Supabase chưa được cấu hình.",true);const button=event.submitter;button.disabled=true;button.textContent="Đang đăng nhập…";const {error}=await client.auth.signInWithPassword({email:document.querySelector("#email").value,password:document.querySelector("#password").value});button.disabled=false;button.textContent="Đăng nhập";if(error)return message(loginMessage,"Email hoặc mật khẩu không đúng, hoặc kết nối đang gặp sự cố.",true);setAuthenticated(true);event.target.reset();await loadDashboard()});
document.querySelector("#logout").addEventListener("click",async()=>{await client?.auth.signOut();setAuthenticated(false);list.replaceChildren();message(loginMessage,"Đã đăng xuất an toàn.")});
document.querySelector("#confirm-change").addEventListener("click",async(event)=>{event.preventDefault();if(!pendingCase)return dialog.close();const {error}=await client.from("site_settings").update({active_case_id:pendingCase.id}).eq("id",1);dialog.close();if(error)return message(adminMessage,"Cập nhật thất bại. Hãy kiểm tra quyền admin và kết nối.",true);message(adminMessage,`Đã công khai hồ sơ ${pendingCase.case_number}.`);pendingCase=null;await loadDashboard()});
if(client){const {data:{session}}=await client.auth.getSession();setAuthenticated(Boolean(session));if(session)await loadDashboard();client.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"||!session)setAuthenticated(false)})}else message(loginMessage,"Supabase chưa được cấu hình. Xem README.md để thiết lập.",true);
