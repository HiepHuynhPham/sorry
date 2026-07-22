import { getClient } from "./supabase.js";
const client=await getClient(),status=document.querySelector("#preview-status"),wrapper=document.querySelector("#device-frame"),frame=document.querySelector("#preview-frame");
function fail(text){status.querySelector("h1").textContent="Không thể mở preview";status.querySelector("p").textContent=text}
if(!client)fail("Supabase chưa được cấu hình.");else{
  const {data:{session}}=await client.auth.getSession();
  if(!session)fail("Bạn cần đăng nhập admin trước.");else{
    const id=Number(new URLSearchParams(location.search).get("id"));
    if(!Number.isSafeInteger(id)||id<1)fail("ID hồ sơ không hợp lệ.");else{
      const {data,error}=await client.from("cases").select("id,slug,title").eq("id",id).single();
      if(error||!data)fail("Session không đủ quyền hoặc hồ sơ không tồn tại.");else if(!/^case-\d{3}$/.test(data.slug))fail("Hồ sơ này chưa có renderer preview.");else{frame.src=/^case-00[12]$/.test(data.slug)?`cases/${data.slug}.html?v=20260722-6`:`cases/case-dynamic.html?id=${encodeURIComponent(data.id)}&v=20260722-6`;frame.addEventListener("load",()=>{status.hidden=true;wrapper.hidden=false},{once:true})}
    }
  }
}
document.querySelector("#desktop").addEventListener("click",()=>{wrapper.classList.remove("mobile");document.querySelector("#desktop").setAttribute("aria-pressed","true");document.querySelector("#mobile").setAttribute("aria-pressed","false")});
document.querySelector("#mobile").addEventListener("click",()=>{wrapper.classList.add("mobile");document.querySelector("#desktop").setAttribute("aria-pressed","false");document.querySelector("#mobile").setAttribute("aria-pressed","true")});
