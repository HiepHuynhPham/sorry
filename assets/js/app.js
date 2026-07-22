import { getClient } from "./supabase.js";
import { getAnonymousSessionId } from "./privacy-session.js";

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
    const enhanced = true;
    const { data: setting, error: settingError } = await client.rpc("get_public_site_state").single();
    if (settingError) throw settingError;
    if (setting.maintenance_mode) {
      status.querySelector("h1").textContent = "Website đang tạm nghỉ một chút";
      status.querySelector("p").textContent = "Hãy quay lại sau nha.";
      return;
    }
    const { data: activeCase, error: caseError } = await client.from("cases").select("id,slug").eq("id", setting.active_case_id).eq("is_enabled", true).single();
    if (caseError || !activeCase) throw caseError || new Error("Hồ sơ không tồn tại");
    if (!/^case-00[12]$/.test(activeCase.slug)) throw new Error("Hồ sơ chưa có giao diện hợp lệ");
    frame.addEventListener("load", () => {
      status.hidden = true; frame.hidden = false;
      frame.contentWindow?.postMessage({ type: "sorry-site:settings", globalAudioEnabled: setting.global_audio_enabled, safeMode: setting.safe_mode }, location.origin);
      if (enhanced) client.rpc("record_case_view", { p_case_id: activeCase.id, p_session_id: getAnonymousSessionId(), p_device_type: matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop" }).then(({ error }) => {
        if (error && error.code !== "PGRST202") console.info("Không thể ghi nhận lượt mở:", error.message);
      }).catch(() => undefined);
    }, { once: true });
    frame.src = `cases/${activeCase.slug}.html`;
  } catch (error) {
    console.error("Không tải được hồ sơ công khai:", error);
    showError("Có một nhịp bị lỡ. Bạn thử lại sau một chút nha.");
  }
}

retry.addEventListener("click", loadActiveCase);
loadActiveCase();
