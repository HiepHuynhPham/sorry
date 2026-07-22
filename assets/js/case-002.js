(() => {
  const $ = (selector) => document.querySelector(selector);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("#open-case").addEventListener("click", () => $("#intro").classList.add("hide"));
  addEventListener("scroll", () => { const max = document.documentElement.scrollHeight - innerHeight; $("#progress").style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`; }, { passive: true });
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("in")), { threshold: .12 });
  document.querySelectorAll(".reveal").forEach((el) => reduced ? el.classList.add("in") : observer.observe(el));

  const angry = $("#angry"); let dodges = 0;
  const dodge = () => { if (dodges >= 2 || reduced || document.documentElement.dataset.safeMode === "true") return; dodges += 1; angry.style.transform = `translate(${dodges % 2 ? -70 : 70}px,${dodges * 4}px)`; };
  angry.addEventListener("pointerenter", dodge);
  angry.addEventListener("focus", dodge);
  angry.addEventListener("click", () => { angry.style.transform = "none"; dodges = 2; $("#response").textContent = "Anh hiểu. Anh không ép em phải hết giận ngay. Anh vẫn xin lỗi em đàng hoàng và sẽ nghiêm túc sửa lỗi."; });

  const modal = $("#modal"), card = modal.querySelector(".modal-card"), close = $("#close-modal"); let previousFocus;
  function closeModal() { modal.hidden = true; stopConfetti(); previousFocus?.focus(); }
  $("#forgive").addEventListener("click", () => { previousFocus = document.activeElement; modal.hidden = false; card.focus(); if (!reduced && document.documentElement.dataset.safeMode !== "true") startConfetti(); });
  close.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => event.target === modal && closeModal());
  addEventListener("keydown", (event) => { if (event.key === "Escape" && !modal.hidden) closeModal(); });

  const canvas = $("#confetti"), context = canvas.getContext("2d"); let pieces = [], frame;
  function startConfetti() { canvas.width = innerWidth; canvas.height = innerHeight; pieces = Array.from({length:100},()=>({x:Math.random()*canvas.width,y:-20-Math.random()*canvas.height,r:3+Math.random()*5,c:["#ec789c","#f6cf73","#6bc398","#fff"][Math.floor(Math.random()*4)],v:2+Math.random()*4})); draw(); setTimeout(stopConfetti, 3500); }
  function draw(){ context.clearRect(0,0,canvas.width,canvas.height); pieces.forEach(p=>{p.y+=p.v;p.x+=Math.sin(p.y/25);context.fillStyle=p.c;context.fillRect(p.x,p.y,p.r,p.r*1.8)}); frame=requestAnimationFrame(draw); }
  function stopConfetti(){ cancelAnimationFrame(frame); context.clearRect(0,0,canvas.width,canvas.height); }
})();
