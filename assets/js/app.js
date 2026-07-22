import { getClient } from "./supabase.js";

const status = document.querySelector("#status");
const retry = document.querySelector("#retry");
const frame = document.querySelector("#case-frame");

function showError(message) {
  status.querySelector("h1").textContent = "Chưa mở được hồ sơ";
  status.querySelector("p").textContent = message;
  retry.hidden = false;
}

async function loadActiveCase() {
  retry.hidden = true;
  const client = await getClient();
  // Preserve the original public experience until the owner finishes Supabase setup.
  // This is not a user-selectable fallback and grants no administrative capability.
  if (!client) {
    frame.addEventListener("load", () => { status.hidden = true; frame.hidden = false; }, { once: true });
    frame.src = "cases/case-001.html";
    return;
  }
  try {
    const { data: setting, error: settingError } = await client.from("site_settings").select("active_case_id").eq("id", 1).single();
    if (settingError) throw settingError;
    const { data: activeCase, error: caseError } = await client.from("cases").select("slug").eq("id", setting.active_case_id).eq("is_enabled", true).single();
    if (caseError || !activeCase) throw caseError || new Error("Hồ sơ không tồn tại");
    if (!/^case-00[12]$/.test(activeCase.slug)) throw new Error("Hồ sơ chưa có giao diện hợp lệ");
    frame.addEventListener("load", () => { status.hidden = true; frame.hidden = false; }, { once: true });
    frame.src = `cases/${activeCase.slug}.html`;
  } catch (error) {
    console.error("Không tải được hồ sơ công khai:", error);
    showError("Có một nhịp bị lỡ. Bạn thử lại sau một chút nha.");
  }
}

retry.addEventListener("click", loadActiveCase);
loadActiveCase();
