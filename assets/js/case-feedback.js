import { getClient } from "./supabase.js";
import { getAnonymousSessionId } from "./privacy-session.js";

const caseSlug = document.documentElement.dataset.case;
const decision = document.querySelector(".decision") || document.querySelector(".decision-inner")?.parentElement;
if (decision) {
  const panel = document.createElement("section");
  panel.className = "recipient-feedback";
  panel.setAttribute("aria-labelledby", "feedback-title");
  const title = document.createElement("h2"); title.id = "feedback-title"; title.textContent = "Nếu cần, em có thể chọn thêm";
  const hint = document.createElement("p"); hint.textContent = "Mọi lựa chọn đều được tôn trọng và chỉ admin mới xem được phản hồi.";
  const choices = document.createElement("div"); choices.className = "feedback-choices";
  const options = [{ type: "need_time", label: "Cho em thêm thời gian" }, { type: "food", label: "Đền bằng đồ ăn đi" }];
  options.forEach(({ type, label }) => { const button = document.createElement("button"); button.type = "button"; button.dataset.response = type; button.textContent = label; choices.append(button); });
  const form = document.createElement("form"); form.className = "feedback-form"; form.hidden = true;
  const formTitle = document.createElement("label"); formTitle.htmlFor = "recipient-message"; formTitle.textContent = "Bạn có muốn để lại lời nhắn không?";
  const textarea = document.createElement("textarea"); textarea.id = "recipient-message"; textarea.maxLength = 300; textarea.rows = 4; textarea.placeholder = "Lời nhắn tối đa 300 ký tự (không bắt buộc)"; textarea.setAttribute("aria-label", "Lời nhắn cho người xin lỗi");
  const count = document.createElement("small"); count.textContent = "0/300";
  const actions = document.createElement("div"); actions.className = "feedback-actions";
  const send = document.createElement("button"); send.type = "submit"; send.textContent = "Gửi phản hồi";
  const skip = document.createElement("button"); skip.type = "button"; skip.className = "feedback-skip"; skip.textContent = "Bỏ qua";
  const result = document.createElement("p"); result.className = "feedback-result"; result.setAttribute("role", "status");
  actions.append(send, skip); form.append(formTitle, textarea, count, actions); panel.append(title, hint, choices, form, result); decision.append(panel);
  let selectedType = null;
  const choose = (type, focusMessage = true) => {
    selectedType = type; form.hidden = false; result.textContent = "";
    choices.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.response === type)));
    if (focusMessage) textarea.focus({ preventScroll: true });
  };
  choices.addEventListener("click", (event) => { const type = event.target.closest("button")?.dataset.response; if (type) choose(type); });
  document.querySelector(caseSlug === "case-001" ? "#yesBtn" : "#forgive")?.addEventListener("click", () => choose("forgiven", false));
  document.querySelector(caseSlug === "case-001" ? "#notYetBtn" : "#angry")?.addEventListener("click", () => choose("still_angry", false));
  textarea.addEventListener("input", () => { count.textContent = `${textarea.value.length}/300`; });
  skip.addEventListener("click", () => { form.hidden = true; result.textContent = "Không sao, cảm ơn em đã phản hồi."; });
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); if (!selectedType || send.disabled) return;
    send.disabled = true; send.textContent = "Đang gửi…"; const originalMessage = textarea.value;
    try {
      const client = await getClient(); if (!client) throw new Error("not_configured");
      const { data: activeCase, error: caseError } = await client.from("cases").select("id").eq("slug", caseSlug).single();
      if (caseError) throw caseError;
      const { error } = await client.rpc("submit_case_response", { p_case_id: activeCase.id, p_response_type: selectedType, p_message: originalMessage.trim() || null, p_session_id: getAnonymousSessionId() });
      if (error) throw error;
      form.hidden = true; textarea.value = ""; result.textContent = "Đã gửi phản hồi. Cảm ơn em đã để lại lời nhắn 💛";
    } catch (error) {
      console.info("Không gửi được phản hồi:", error);
      textarea.value = originalMessage; result.textContent = "Chưa gửi được, nội dung vẫn được giữ lại. Em thử lại sau nha.";
    } finally { send.disabled = false; send.textContent = "Gửi phản hồi"; }
  });
}
