const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const topbar = document.querySelector("#topbar");
const state = { createType: null, createStep: 1, currentBook: null, currentUserId: null, authKind: null, giftSession: null, autoSave: null, bookWritingFull: false, giftCreateType: null, giftCreateStep: 1, giftDraft: null, giftCover: null, giftResult: null, giftSubmitting: false, giftCopyTimer: null, profileSaved: false, renderId: 0, writingBooksCache: null, mobileMenuOpen: false, mobileStoryOpen: false };
const createClient = window.supabase?.createClient;
let authClient = null;
let authReady = null;
const homeData = {
  moments: {
    time: "3 p. m.", date: "2026/07/28/Tues",
    body: "매일 작가가 좋아하는 시간대에 드는 단상을 메모한다. 단상이 모이면 어떤 이야기가 될까. 매그 시간에 남겨놓은 작은 흔적들. 매일 같은 시간에 떠오른 생각을 짧게 남기는 기능. 매일 작가가 좋아하는 시간대에 드는 단상을 메모한다. 단상이 모이면 어떤 이야기가 될까. 우리가 어렸을 때만 성장하는게 아니잖아.",
    author: "작가명", more: "more",
  },
  note: {
    badge: "나의 이야기 질문노트",
    descriptionLines: [
      "이 노트는 ‘거창하게 말해서 미리 써보는 자서전’입니다.",
      "지금쯤 기록을 남길때가 됐다면 이 질문이 도움이 될거에요.",
    ],
    handwriting: {
      title: "질문 노트에 손글씨로 기록하기",
      images: [
        { src: "/assets/home-note-first.png", alt: "나의 이야기 질문노트 표지" },
        { src: "/assets/home-note-second.png", alt: "나의 이야기 질문노트 카테고리" },
      ],
      buttonLabel: "‘나의 이야기' 질문노트 구매하기",
      buttonUrl: "#",
    },
    categories: [
      { key: "taste", name: "나의 취향", icon: "/assets/home-category-taste.svg", nodeId: "2226:576", titleNodeId: "2226:578", iconNodeId: "2226:580", position: "taste" },
      { key: "parents", name: "나와 부모님", icon: "/assets/home-category-parents.svg", nodeId: "2226:587", titleNodeId: "2226:589", iconNodeId: "2226:591", position: "parents" },
      { key: "family", name: "나의 가족", icon: "/assets/home-category-family.svg", nodeId: "2226:599", titleNodeId: "2226:601", iconNodeId: "2226:603", position: "family" },
      { key: "friends", name: "나의 친구", icons: ["/assets/home-category-friends-a.svg", "/assets/home-category-friends-b.svg"], nodeId: "2226:562", titleNodeId: "2226:564", iconNodeId: "2226:566", position: "friends" },
      { key: "story", name: "나의 이야기", icon: "/assets/home-category-story.svg", nodeId: "2226:607", titleNodeId: "2226:609", iconNodeId: "2226:611", position: "story" },
      { key: "wishes", name: "나의 당부와 바램", icon: "/assets/home-category-wishes.svg", nodeId: "2226:614", titleNodeId: "2226:616", iconNodeId: "2226:618", position: "wishes" },
    ],
  },
  recommendation: {
    heading: "추천글",
    body: "나의 과거를 알지 못한면, 나의 현재 모습을 이해하기 어렵습니다. 나의 부모님을 알지 못하면, 내가 부모로부터 물려받은 유산을 알기 어렵습니다. 인정하고 싶지 않을 수도 있지만, 나라는 사람은 내가 물려받은 유산을 토대로 형성되었기 때문입니다. 이 노트는 그런 나를 이해하기 위한 유용한 길잡이가 되어 줄 것입니다.",
    author: "정신건강의학과 전문의 김현식",
    forYouHeading: "이분들에게 선물하세요",
    forYou: ["엄마", "아빠", "이모, 고모, 삼촌", "할머니, 할아버지", "좋아하는 선후배", "마음이 쓰이는 주변 어른", "아무 이유없이 생각나는 사람", "나이가 들어가는 내친구", "나이가 들어가는 나", "뭘하든 관심없는 사람"],
  },
  onlineWriting: {
    title: "② 웹에서 편하게 기록하기",
    buttonLabel: "웹에서 ‘나의 이야기' 시작하기",
    buttonUrl: "#create",
    cards: [
      { number: "01", title: "질문 선택", description: "나에게 맞는 책을 고르면 질문이 준비됩니다" },
      { number: "02", title: "답변 작성", description: "언제든 저장하고 나중에 이어서 작성하세요" },
      { number: "03", title: "책으로 출판", description: "표지를 고르고 PDF 혹은 책으로 출판하세요" },
    ],
  },
};

window.addEventListener("hashchange", render);
document.addEventListener("click", onClick);
let writingSwipeStart = null;
let writingMouseSwipeStart = null;
function handleWritingSwipe(start, endX, endY) {
  if (!start || !window.matchMedia("(max-width: 760px)").matches || !document.body.classList.contains("book-detail-route") || !start.panel.isConnected) return;
  const dx = endX - start.x;
  const dy = endY - start.y;
  if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
  const link = start.panel.querySelector(dx < 0 ? ".book-writing-navigation a:last-of-type" : ".book-writing-navigation a:first-of-type");
  if (link) link.click();
}
document.addEventListener("touchstart", (event) => {
  if (!window.matchMedia("(max-width: 760px)").matches || !document.body.classList.contains("book-detail-route")) return;
  const touch = event.touches[0];
  const panel = event.target.closest(".book-writing-panel");
  if (!touch || !panel || event.target.closest("input,select,button,a,[contenteditable]")) return;
  writingSwipeStart = { panel, x: touch.clientX, y: touch.clientY };
}, { passive: true });
document.addEventListener("touchmove", (event) => {
  if (!writingSwipeStart) return;
  const touch = event.touches[0];
  if (touch) {
    writingSwipeStart.endX = touch.clientX;
    writingSwipeStart.endY = touch.clientY;
  }
}, { passive: true });
document.addEventListener("touchend", (event) => {
  const start = writingSwipeStart;
  writingSwipeStart = null;
  if (!start || !window.matchMedia("(max-width: 760px)").matches || !document.body.classList.contains("book-detail-route")) return;
  const touch = event.changedTouches[0];
  if (touch) handleWritingSwipe(start, touch.clientX, touch.clientY);
}, { passive: true });
document.addEventListener("touchcancel", () => { writingSwipeStart = null; }, { passive: true });
document.addEventListener("mousedown", (event) => {
  if (!window.matchMedia("(max-width: 760px)").matches || !document.body.classList.contains("book-detail-route") || event.button !== 0) return;
  const panel = event.target.closest(".book-writing-panel");
  if (!panel || event.target.closest("textarea,input,select,button,a,[contenteditable=\"true\"]")) return;
  writingMouseSwipeStart = { panel, x: event.clientX, y: event.clientY };
}, { passive: true });
document.addEventListener("mousemove", (event) => {
  if (!writingMouseSwipeStart) return;
  writingMouseSwipeStart.endX = event.clientX;
  writingMouseSwipeStart.endY = event.clientY;
}, { passive: true });
document.addEventListener("mouseup", (event) => {
  const start = writingMouseSwipeStart;
  writingMouseSwipeStart = null;
  handleWritingSwipe(start, start?.endX ?? event.clientX, start?.endY ?? event.clientY);
}, { passive: true });
document.addEventListener("mouseleave", () => { writingMouseSwipeStart = null; }, { passive: true });
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-author-delete]");
  if (!button) return;
  if (!confirm("작성한 Moments를 삭제하시겠습니까?")) return;
  try {
    await api(`/api/author/moments/${button.dataset.authorDelete}`, { method: "DELETE" });
    if (state.authorEditingId === Number(button.dataset.authorDelete)) state.authorEditingId = null;
    toastMsg("Moments를 삭제했습니다.");
    await moments();
  } catch (error) { toastMsg(error.message); }
});
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-author-moments-pdf]");
  if (!button) return;
  try {
    const session = await getAuthSession();
    const response = await fetch("/api/author/moments/pdf", { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "PDF를 생성할 수 없습니다.");
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "moments.pdf";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toastMsg("Moments PDF를 저장했습니다.");
  } catch (error) { toastMsg(error.message); }
});
document.addEventListener("submit", onGiftLoginSubmit, true);
document.addEventListener("submit", onSubmit);
document.addEventListener("submit", onProfileSubmit, true);
document.addEventListener("input", onInput);
document.addEventListener("change", onChange);
const authorMomentDeleteObserver = new MutationObserver(() => {
  app.querySelectorAll(".author-moment-item").forEach((item) => {
    if (item.querySelector("[data-author-delete]")) return;
    const editButton = item.querySelector("[data-author-edit]");
    if (!editButton) return;
    const deleteButton = document.createElement("button");
    deleteButton.className = "button small danger";
    deleteButton.dataset.authorDelete = editButton.dataset.authorEdit;
    deleteButton.textContent = "삭제";
    editButton.parentElement.append(deleteButton);
  });
  const momentsHeading = app.querySelector(".author-moment-list .inline");
  if (momentsHeading && !momentsHeading.querySelector("[data-author-moments-pdf]")) {
    const pdfButton = document.createElement("button");
    pdfButton.className = "button small ghost";
    pdfButton.dataset.authorMomentsPdf = "true";
    pdfButton.textContent = "PDF로 저장";
    momentsHeading.append(pdfButton);
  }
});
authorMomentDeleteObserver.observe(app, { childList: true, subtree: true });
async function authedApi(url, options = {}) {
  const session = await getAuthSession();
  return api(url, { ...options, headers: { ...(options.headers || {}), ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) } });
}

startApp();

async function onProfileSubmit(event) {
  const form = event.target;
  if (!form.matches('form[data-form="profile"]')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    const data = Object.fromEntries(new FormData(form));
    await authedApi("/api/auth/profile", { method: "PUT", body: { displayName: data.displayName } });
    state.profileSaved = true;
    toastMsg("닉네임을 저장했습니다.");
    await render();
  } catch (error) { toastMsg(error.message); }
}

async function startApp() {
  if (location.hash.includes("access_token=")) {
    try { await ensureAuthClient(); await authClient.auth.getSession(); history.replaceState(null, "", `${location.pathname}${location.search}`); location.hash = "#books"; } catch (error) { app.innerHTML = `<div class="panel empty">${escapeHtml(error.message)}</div>`; return; }
  }
  render();
}

async function ensureAuthClient() {
  if (authReady) return authReady;
  authReady = fetch("/api/auth/config").then(async (response) => { const config = await response.json(); if (!response.ok) throw new Error(config.error || "Supabase Auth 설정을 불러올 수 없습니다."); if (!createClient) throw new Error("Supabase Auth client를 불러오지 못했습니다."); authClient = createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); return authClient; });
  return authReady;
}

async function getAuthSession() { const client = await ensureAuthClient(); return (await client.auth.getSession()).data.session; }

async function loadAuthState() {
  let session = null;
  try { session = await getAuthSession(); } catch {}
  if (session?.access_token) {
    try {
      const account = await api("/api/auth/me");
      return { session, ...account, authKind: "account", giftSession: null };
    } catch {}
  }
  try {
    const giftSession = await api("/api/gifts/session");
    return { session: null, user: null, isAdmin: false, moments: { canWrite: false }, authKind: "gift", giftSession };
  } catch { return { session: null, user: null, isAdmin: false, moments: { canWrite: false }, authKind: null, giftSession: null }; }
}

async function login() {
  const auth = await loadAuthState();
  if (auth.session) {
    app.innerHTML = `<section class="author-login"><div class="eyebrow">MY STORY</div><h1 class="admin-title">${escapeHtml(auth.user?.displayName || "사용자")}님</h1><p class="lead">로그인된 계정으로 서비스를 이용하고 있습니다.</p><div class="actions">${auth.moments?.canWrite ? `<a class="button primary" href="#moments">Moments</a>` : ""}<a class="button ghost" href="#books">내 이야기</a><button class="button ghost" data-logout>로그아웃</button></div></section>`;
    return;
  }
  if (auth.authKind === "gift" && auth.giftSession?.bookId) {
    app.innerHTML = `<section class="author-login"><div class="eyebrow">MY STORY</div><h1 class="admin-title">내 이야기</h1><p class="lead">내 이야기를 이어서 작성할 수 있습니다.</p><div class="actions"><a class="button primary" href="#books">내 이야기</a><button class="button ghost" data-gift-logout>로그아웃</button></div></section>`;
    return;
  }
  app.innerHTML = `<section class="author-login"><h1 class="admin-title">로그인</h1><div class="author-login-divider"><span>간편 로그인</span></div><div class="social-login-group" aria-label="간편로그인"><button class="button social-login-button social-google" data-google-login type="button" aria-label="Google 계정으로 계속하기"><img class="social-login-icon" src="/assets/icn_google.svg.svg" alt="" aria-hidden="true"></button><button class="button social-login-button social-kakao" data-kakao-login type="button" aria-label="카카오로 계속하기"><img class="social-login-icon" src="/assets/icn_kakao.svg.svg" alt="" aria-hidden="true"></button><button class="button social-login-button social-naver" data-naver-login type="button" aria-label="네이버로 계속하기"><img class="social-login-icon" src="/assets/icn_naver.svg" alt="" aria-hidden="true"></button></div><div class="author-login-divider"><span>이메일 로그인</span></div><form class="login-form" data-form="login"><label class="field">이메일<input type="email" name="email" autocomplete="email" required></label><label class="field">비밀번호<input type="password" name="password" autocomplete="current-password" required></label><div class="login-form-links"><button class="login-text-link" type="button">비밀번호 찾기</button></div><button class="button primary" type="submit">로그인</button></form><button class="login-signup-link" type="button">회원가입</button><section class="gift-login-section" aria-labelledby="gift-login-title"><p id="gift-login-title">선물받으셨나요?</p><form class="gift-login-form" data-form="gift-login"><label class="field">선물코드<input type="text" name="code" autocomplete="off" spellcheck="false" required></label><button class="button gift-login-button" type="submit">선물코드로 로그인하기</button><p class="gift-login-error" data-gift-login-error role="alert" hidden></p></form></section></section>`;
}

async function onGiftLoginSubmit(event) {
  const form = event.target;
  if (!form.matches('form[data-form="gift-login"]')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const codeInput = form.elements.code;
  const errorBox = form.querySelector("[data-gift-login-error]");
  const submitButton = form.querySelector("button[type=submit]");
  const code = codeInput.value;
  if (errorBox) { errorBox.hidden = true; errorBox.textContent = ""; }
  if (submitButton) submitButton.disabled = true;
  try {
    const result = await api("/api/gifts/login", { method: "POST", body: { code } });
    codeInput.value = "";
    if (!result?.bookId) throw new Error("선물받은 책을 찾을 수 없습니다.");
    state.authKind = "gift";
    state.giftSession = { giftId: result.giftId, bookId: result.bookId, sessionExpiresAt: result.sessionExpiresAt };
    location.hash = "#books";
    await render();
  } catch (error) {
    codeInput.value = "";
    if (errorBox) { errorBox.textContent = error.message; errorBox.hidden = false; }
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

async function moments() {
  const auth = await loadAuthState();
  if (!auth.session) { location.hash = "#login"; return; }
  if (!auth.moments?.canWrite) {
    app.innerHTML = `<section class="author-moments"><div class="eyebrow">MOMENTS LOG</div><h1 class="admin-title">Moments Log</h1><div class="panel empty"><h2>작성 권한이 필요합니다.</h2><p>관리자가 Moments 작성 권한을 부여한 계정만 메모를 작성할 수 있습니다.</p><a class="button ghost" href="#home">Home으로 돌아가기</a></div></section>`;
    return;
  }
  const [rawEntries, slots] = await Promise.all([api("/api/author/moments"), api("/api/author/moment-slots")]);
  const entries = rawEntries.map((entry, index) => ({ entry, index })).sort((a, b) => String(b.entry.createdAt || "").localeCompare(String(a.entry.createdAt || "")) || a.index - b.index).map(({ entry }) => entry);
  const editing = state.authorEditingId ? entries.find((entry) => entry.id === state.authorEditingId) : null;
  state.authorEntries = entries; state.authorSlots = slots; state.authorEditingEntry = editing;
  const displayName = auth.moments?.author?.displayName?.trim() || auth.user?.email || "사용자";
  const taken = new Set(slots.takenTimes);
  const timeOptions = Array.from({length: 24}, (_, hour) => { const value = `${String(hour).padStart(2, "0")}:00`; const selected = editing?.slotTime === value || (!editing && slots.myTimes[0] === value && !taken.has(value)); const disabled = taken.has(value) && !selected; return `<option value="${value}" ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}>${value}${disabled ? " · 선택됨" : ""}</option>`; }).join("");
  const todayLabel = formatMomentTodayLabel(slots.today);
  app.innerHTML = `<section class="author-moments"><div class="author-session"><div><div class="eyebrow">MOMENTS LOG</div><h1 class="admin-title">${escapeHtml(displayName)}님의 Moments</h1></div></div><div class="author-moments-grid"><section class="panel author-moment-editor"><h2>${editing ? "Moments 수정" : "새 Moments 작성"}</h2><form data-form="author-moment" data-id="${editing?.id || ""}"><label class="field">선택한 시간<select name="slotTime" required ${editing ? "disabled" : ""}>${timeOptions}</select>${editing ? `<input type="hidden" name="slotTime" value="${editing.slotTime}">` : ""}</label><div class="field"><span>오늘 날짜</span><strong>${escapeHtml(todayLabel)}</strong></div><label class="field">메모<textarea name="body" required>${escapeHtml(editing?.body || "")}</textarea></label><div class="actions"><button class="button ghost" type="button" data-author-cancel-edit ${editing ? "" : "hidden"}>취소</button><button class="button primary" type="submit">${editing ? "수정 저장" : "Moments 저장"}</button></div></form><p class="muted author-slot-help">다른 작가가 선택한 시간은 선택할 수 없습니다.</p></section><section class="author-moment-list"><div class="inline" style="justify-content:space-between"><h2>내 Moments (${slots.myTimes.length})</h2></div>${entries.length ? entries.map((entry) => `<article class="panel author-moment-item"><div class="author-moment-item-meta"><strong>${entry.slotTime}</strong><span>${entry.momentDate}</span></div><p>${escapeHtml(entry.body)}</p><button class="button small" data-author-edit="${entry.id}">수정</button></article>`).join("") : `<div class="panel empty">아직 작성한 Moments가 없습니다.</div>`}</section></div></section>`;
}

function formatMomentTodayLabel(date) {
  const [year, month, day] = String(date || "").split("-").map(Number);
  if (!year || !month || !day) return "오늘";
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${month}월 ${day}일 (${weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]})`;
}

async function momentsDetail() {
  const authorId = location.hash.split("/")[1] ? decodeURIComponent(location.hash.split("/")[1]) : "";
  const entries = authorId ? await api(`/api/home/moments/${encodeURIComponent(authorId)}`) : [];
  const displayName = entries[0]?.author || "작가명";
  app.innerHTML = `<section class="moments-detail-page"><div class="moments-detail-content"><h1>Moments</h1><p class="moments-detail-author">${escapeHtml(displayName)}</p><div class="moments-detail-entries">${entries.length ? entries.map((entry) => `<article class="moments-detail-entry"><div class="moments-detail-meta">${escapeHtml(formatMomentDetailDate(entry.momentDate))} · ${escapeHtml(formatMomentDetailTime(entry.slotTime))}</div><p>${escapeHtml(entry.body)}</p></article>`).join("") : `<p class="moments-detail-empty">아직 작성된 Moments가 없습니다.</p>`}</div></div></section>`;
}

function formatMomentDetailDate(date) {
  const [year, month, day] = String(date).split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function formatMomentDetailTime(time) {
  const [hour] = String(time).split(":").map(Number);
  const suffix = hour < 12 ? "a. m." : "p. m.";
  return `${hour % 12 || 12} ${suffix}`;
}

async function render() {
  clearInterval(state.autoSave); state.autoSave = null;
  const renderId = ++state.renderId;
  const [route, ...params] = (location.hash.slice(1) || "home").split("/");
  if (route !== "book") state.bookWritingFull = false;
  document.body.classList.toggle("home-route", route === "home");
  document.body.classList.toggle("moments-detail-route", route === "moments-detail");
  document.body.classList.toggle("white-page-route", route === "books" || route === "create" || route === "gift-create" || route === "book" || route === "profile");
  document.body.classList.toggle("books-page-route", route === "books");
  document.body.classList.toggle("book-detail-route", route === "book");
  document.body.classList.toggle("publish-page-route", route === "publish");
  document.body.classList.toggle("admin-route", route === "admin");
  document.body.classList.toggle("book-writing-full-route", route === "book" && state.bookWritingFull);
  const divider = document.querySelector("#gnb-divider");
  if (divider) divider.src = route === "books" || route === "book" ? "/assets/gnb-divider-brown.svg" : "/assets/gnb-divider.svg";
  try {
    const auth = await loadAuthState();
    state.currentUserId = auth.session?.user?.id || null;
    state.authKind = auth.authKind || (auth.session ? "account" : null);
    state.giftSession = auth.giftSession || null;
    const writingBooks = auth.session ? await getWritingBooks(auth) : [];
    if (renderId !== state.renderId) return;
    renderTopGnb(auth, writingBooks);
    if (route === "admin" && auth.isAdmin !== true) { location.hash = "#home"; return; }
    if (route === "home") return home();
    if (route === "books") return books();
    if (route === "create") return create();
    if (route === "gift-create") return giftCreate();
    if (route === "book") { const pageParam = params[1] || ""; const page = pageParam.startsWith("group-") ? { type: "group", groupId: Number(pageParam.slice(6)) } : pageParam.startsWith("question-") ? { type: "question", questionId: Number(pageParam.slice(9)) } : pageParam ? { type: "question", questionId: Number(pageParam) } : null; return book(Number(params[0]), page); }
    if (route === "write") return write(Number(params[0]), Number(params[1]));
    if (route === "publish") return publish(Number(params[0]));
    if (route === "login") return login();
    if (route === "profile") return profileFinal();
    if (route === "moments") return moments();
    if (route === "moments-detail") return momentsDetail();
    if (route === "author") return params[0] === "moments" ? moments() : login();
    if (route === "admin") return admin(params[0] || "dashboard");
    location.hash = "#home";
  } catch (error) { app.innerHTML = `<div class="panel empty">${escapeHtml(error.message)}</div>`; }
}

function lastBookQuestionKey(userId, bookId) { return `my-story:last-question:${userId}:${bookId}`; }
function readLastBookQuestion(userId, bookId) { try { return localStorage.getItem(lastBookQuestionKey(userId, bookId)) || ""; } catch { return ""; } }
function rememberBookQuestion(bookId, questionId) { if (!state.currentUserId || !questionId) return; try { localStorage.setItem(lastBookQuestionKey(state.currentUserId, bookId), String(questionId)); } catch {} const cachedBook = state.writingBooksCache?.books?.find((book) => String(book.id) === String(bookId)); if (cachedBook) cachedBook.resumePage = `question-${questionId}`; }
async function fetchWritingBooks(auth) {
  const books = (await api("/api/books")).filter((book) => book.status === "writing");
  return Promise.all(books.map(async (book) => {
    try {
      const detail = await api(`/api/books/${book.id}`);
      const questions = detail.outline.groups.flatMap((group) => group.questions);
      const lastQuestionId = readLastBookQuestion(auth.session.user.id, book.id);
      const lastQuestion = questions.find((question) => String(question.id) === String(lastQuestionId)) || questions[0];
      return { ...book, resumePage: lastQuestion ? `question-${lastQuestion.id}` : "" };
    } catch { return { ...book, resumePage: "" }; }
  }));
}

async function getWritingBooks(auth) {
  const userId = auth.session?.user?.id;
  if (!userId) return [];
  if (state.writingBooksCache?.userId === userId) {
    return state.writingBooksCache.promise || state.writingBooksCache.books || [];
  }
  const promise = fetchWritingBooks(auth).then((books) => {
    if (state.writingBooksCache?.userId === userId) state.writingBooksCache.books = books;
    return books;
  }).catch(() => {
    if (state.writingBooksCache?.userId === userId) state.writingBooksCache.books = [];
    return [];
  });
  state.writingBooksCache = { userId, promise, books: [] };
  return promise;
}

function clearWritingBooksCache() {
  state.writingBooksCache = null;
}

function closeMobileMenu() {
  state.mobileMenuOpen = false;
  state.mobileStoryOpen = false;
  const panel = topbar.querySelector("[data-mobile-menu-panel]");
  const toggle = topbar.querySelector("[data-mobile-menu-toggle]");
  const storyToggle = topbar.querySelector("[data-mobile-story-toggle]");
  if (panel) panel.hidden = true;
  if (toggle) { toggle.setAttribute("aria-expanded", "false"); toggle.setAttribute("aria-label", "메뉴 열기"); }
  if (storyToggle) { storyToggle.setAttribute("aria-expanded", "false"); storyToggle.setAttribute("aria-label", "내 이야기 책 목록 펼치기"); }
}

function toggleMobileMenu() {
  const panel = topbar.querySelector("[data-mobile-menu-panel]");
  const toggle = topbar.querySelector("[data-mobile-menu-toggle]");
  if (!panel || !toggle) return;
  if (state.mobileMenuOpen) return closeMobileMenu();
  state.mobileMenuOpen = !state.mobileMenuOpen;
  panel.hidden = !state.mobileMenuOpen;
  toggle.setAttribute("aria-expanded", String(state.mobileMenuOpen));
  toggle.setAttribute("aria-label", state.mobileMenuOpen ? "메뉴 닫기" : "메뉴 열기");
}

function toggleMobileStory() {
  const panel = topbar.querySelector("[data-mobile-story-panel]");
  const toggle = topbar.querySelector("[data-mobile-story-toggle]");
  if (!panel || !toggle) return;
  state.mobileStoryOpen = !state.mobileStoryOpen;
  panel.hidden = !state.mobileStoryOpen;
  toggle.setAttribute("aria-expanded", String(state.mobileStoryOpen));
  toggle.setAttribute("aria-label", state.mobileStoryOpen ? "내 이야기 책 목록 접기" : "내 이야기 책 목록 펼치기");
}

function handleStoreClick(event) {
  event.preventDefault();
  closeMobileMenu();
  toastMsg("준비중입니다");
}

function renderTopGnb(auth, writingBooks = []) {
  state.mobileMenuOpen = false;
  state.mobileStoryOpen = false;
  const loggedIn = Boolean(auth.session);
  const giftLoggedIn = auth.authKind === "gift" && Boolean(auth.giftSession?.bookId);
  const mobileLoggedOut = !loggedIn && !giftLoggedIn;
  const isAdmin = auth.isAdmin === true;
  const storyBooks = writingBooks.length
    ? writingBooks.map((book) => `<a href="#book/${book.id}/${book.resumePage}">${escapeHtml(book.title)}</a>`).join("")
    : `<span class="home-story-empty">작성 중인 이야기가 없습니다.</span>`;
  const storyMenu = `<div class="home-story-menu"><a class="home-story-link" href="#books" aria-haspopup="true">내 이야기</a><div class="home-story-popover" role="menu" aria-label="내 이야기 목록">${storyBooks}</div></div>`;
  const createItem = `<a class="home-create-link home-icon-link" href="#create" aria-label="나의 이야기 만들기"><img src="/assets/icn_add_note.svg" alt="" aria-hidden="true"></a>`;
  const profileMenu = `<div class="home-profile-menu"><a class="home-profile-link home-icon-link" href="#profile" aria-label="프로필 메뉴" aria-haspopup="true"><img src="/assets/icn_profile.svg" alt="" aria-hidden="true"></a><div class="home-profile-popover" role="menu" aria-label="프로필 메뉴"><a href="#profile" role="menuitem">프로필</a><button class="home-nav-action" data-logout role="menuitem">로그아웃</button></div></div>`;
  const mobileStoryBooks = writingBooks.length
    ? `<div class="mobile-story-books" id="mobile-story-books" data-mobile-story-panel role="menu" aria-label="내 이야기 책 목록" hidden>${writingBooks.map((book) => `<a href="#book/${book.id}/${book.resumePage}" data-mobile-menu-item role="menuitem">${escapeHtml(book.title)}</a>`).join("")}</div>`
    : "";
  const mobileStoryMenu = `<div class="mobile-story-item"><a href="#books" data-mobile-menu-item>내 이야기</a>${writingBooks.length ? `<button class="mobile-story-toggle" type="button" data-mobile-story-toggle aria-controls="mobile-story-books" aria-expanded="false" aria-label="내 이야기 책 목록 펼치기">⌄</button>` : ""}</div>${mobileStoryBooks}`;
  const mobileMenu = loggedIn
    ? `${mobileStoryMenu}<a href="#create" data-mobile-menu-item>새 이야기 만들기</a><a href="#gift-create" data-mobile-menu-item>선물하기</a><a href="#" data-store-link data-mobile-menu-item>스토어</a><a href="#profile" data-mobile-menu-item>계정</a><button type="button" data-logout data-mobile-menu-item>로그아웃</button>`
    : `<a href="#login" data-mobile-menu-item>로그인</a><a href="#" data-store-link data-mobile-menu-item>스토어</a>`;
  const menu = loggedIn
    ? `${storyMenu}<span class="home-divider" aria-hidden="true"></span><a href="#gift-create">선물하기</a><span class="home-divider" aria-hidden="true"></span>${createItem}<span class="home-divider" aria-hidden="true"></span><a class="home-icon-link" href="#" data-store-link aria-label="네이버 스마트 스토어"><img src="/assets/icn_naver.svg" alt="" aria-hidden="true"></a>${auth.moments?.canWrite === true ? `<span class="home-divider" aria-hidden="true"></span><a class="home-icon-link" href="#moments" aria-label="Moments"><img src="/assets/icn_time.svg" alt="" aria-hidden="true"></a>` : ""}${isAdmin ? `<span class="home-divider" aria-hidden="true"></span><a href="#admin/dashboard">관리자</a>` : ""}<span class="home-divider" aria-hidden="true"></span>${profileMenu}`
    : giftLoggedIn
      ? `${storyMenu}<span class="home-divider" aria-hidden="true"></span><button class="home-nav-action" data-gift-logout>로그아웃</button>`
      : `<a href="#login">로그인</a><span class="home-divider" aria-hidden="true"></span><a class="home-icon-link" href="#" data-store-link aria-label="네이버 스마트 스토어"><img src="/assets/icn_naver.svg" alt="" aria-hidden="true"></a>`;
  const mobileProfileLink = mobileLoggedOut ? `<a class="mobile-profile-link" href="#login" aria-label="로그인"><img src="/assets/icn_profile.svg" alt="" aria-hidden="true"></a>` : "";
  const mobileStoreLink = mobileLoggedOut ? `<a class="mobile-store-link home-icon-link" href="#" data-store-link aria-label="네이버 스마트 스토어"><img src="/assets/icn_naver.svg" alt="" aria-hidden="true"></a>` : "";
  topbar.innerHTML = `<a class="home-logo" href="#home">북촌꾸러미연구소</a><nav class="home-nav" aria-label="홈 메뉴">${menu}</nav>${mobileProfileLink}${mobileStoreLink}<button class="mobile-menu-toggle${mobileLoggedOut ? " mobile-menu-toggle-logged-out" : ""}" type="button" data-mobile-menu-toggle aria-label="메뉴 열기" aria-controls="mobile-gnb-menu" aria-expanded="false"><img src="/assets/m_icn_menu.svg" alt="" aria-hidden="true"></button><div class="mobile-menu-panel" id="mobile-gnb-menu" data-mobile-menu-panel role="menu" aria-label="모바일 메뉴" hidden>${mobileMenu}</div>`; console.debug("[My Story] GNB rendered", { logoutButton: Boolean(topbar.querySelector("[data-logout]")), logoutButtonHtml: topbar.querySelector("[data-logout]")?.outerHTML || null, loggedIn, isAdmin });
  topbar.querySelectorAll(".home-divider").forEach((divider) => divider.remove());
  topbar.querySelectorAll(".home-nav a, .home-nav-action").forEach((label) => label.classList.add("home-gnb-label"));
}

async function home() {
  const transparentBanner = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
  const homeContent = await api("/api/home");
  const leftBanner = (homeContent.banners || []).find((item) => item.position === "left") || null;
  const rightBanner = (homeContent.banners || []).find((item) => item.position === "right") || null;
  const banner = {
    left: leftBanner ? { src: leftBanner.imageUrl, alt: leftBanner.caption || "메인 배너", caption: leftBanner.caption } : { src: transparentBanner, alt: "", caption: "" },
    right: rightBanner ? { src: rightBanner.imageUrl, alt: rightBanner.caption || "메인 배너", caption: rightBanner.caption } : { src: transparentBanner, alt: "", caption: "" },
  };
  const { note, recommendation, onlineWriting } = homeData;
  const auth = await loadAuthState();
  const moments = homeContent.moments || { time: "", date: "", body: "", author: "", more: "" };
  const momentsUrl = moments.authorId ? `#moments-detail/${encodeURIComponent(moments.authorId)}` : "#moments-detail";
  const forYou = recommendation.forYou.map((item, index) => `${[4, 7, 9].includes(index) ? `<li class="home-for-you-divider" aria-hidden="true"></li>` : ""}<li class="home-for-you-item"><img src="/assets/${index === recommendation.forYou.length - 1 ? "home-recommendation-check-final.svg" : "home-recommendation-check.svg"}" alt="" aria-hidden="true"><span>${item}</span></li>`).join("");
  const writingCards = onlineWriting.cards.map((card) => `<article class="home-writing-card"><div class="home-writing-card-heading"><span>${card.number}</span><strong>${card.title}</strong></div><p>${card.description}</p></article>`).join("");
  const reviewCards = (homeContent.reviews || []).map((review) => `<article class="home-review-card ${review.variant === "intro" ? "home-review-card-intro" : ""}"><h3>${review.relationship}</h3><p class="home-review-author">${review.author}</p><p class="home-review-body">${review.body}</p></article>`).join("");

app.innerHTML = `<div class="home-page" data-node-id="2097:288"><main class="home-main"><section class="home-banner" data-node-id="2109:357"><div class="home-banner-pane home-banner-left"><img src="${banner.left.src}" alt="${banner.left.alt}"><span class="home-caption">${banner.left.caption}</span></div><div class="home-banner-pane home-banner-right"><img src="${banner.right.src}" alt="${banner.right.alt}"><span class="home-caption">${banner.right.caption}</span></div></section><section class="home-moments" data-node-id="2119:398"><div class="home-moments-inner"><div class="home-moment-meta"><span class="home-moment-label">우리가 좋아하는 시간</span><span class="home-moment-time">${moments.time}</span><span class="home-moment-date">${moments.date}</span></div><div class="home-moment-content"><p>${moments.body}</p><div class="home-moment-footer"><span>${moments.author}</span><a href="${momentsUrl}">${moments.more}</a></div></div></div></section><div class="home-note-area"><section class="home-note" data-node-id="2310:192"><div class="home-note-inner"><section class="home-note-description" data-node-id="2143:287"><span class="home-note-badge">${note.badge}</span><p>${note.descriptionLines.map((line) => `<span>${line}</span>`).join("")}</p></section><section class="home-note-paper" data-node-id="2214:392"><img class="home-note-divider" src="/assets/home-note-divider.svg" alt="" aria-hidden="true"><div class="home-note-paper-title-row"><h2>${note.handwriting.title}</h2><a class="home-note-purchase" href="${note.handwriting.buttonUrl}">${note.handwriting.buttonLabel}</a></div><div class="home-note-paper-images">${note.handwriting.images.map((image) => `<div class="home-note-image-frame"><img class="home-note-paper-image" src="${image.src}" alt="${image.alt}"></div>`).join("")}</div></section></div></section><section class="home-recommendation" data-node-id="2324:201"><div class="home-recommendation-inner"><div class="home-doctor" data-node-id="2267:260"><p class="home-recommendation-heading">${recommendation.heading}</p><p class="home-recommendation-body">${recommendation.body}</p><p class="home-recommendation-author">${recommendation.author}</p></div><aside class="home-for-you" data-node-id="2324:160"><h2>${recommendation.forYouHeading}</h2><ul>${forYou}</ul></aside></div></section><section class="home-online-writing" data-node-id="2175:293"><img class="home-online-divider" src="/assets/home-online-divider.svg" alt="" aria-hidden="true"><div class="home-online-title-row"><h2>${onlineWriting.title}</h2><a class="home-online-button" href="${onlineWriting.buttonUrl}">${onlineWriting.buttonLabel}</a></div><div class="home-writing-cards" data-node-id="2214:409">${writingCards}</div></section></div><section class="home-review" data-node-id="2377:1765"><div class="home-review-background" aria-hidden="true"></div><div class="home-review-container" data-node-id="2345:216"><div class="home-review-track" data-node-id="2377:1765">${reviewCards}</div></div></section></main></div>`;
  document.querySelectorAll(".home-note-description p > span").forEach((line) => {
    if (!line.textContent.trim()) line.remove();
  });
  const notePaper = document.querySelector(".home-note-paper");
  const noteTitleRow = notePaper?.querySelector(".home-note-paper-title-row");
  if (noteTitleRow) {
    const title = noteTitleRow.querySelector("h2");
    if (title) {
      const desktopTitle = title.textContent;
      title.innerHTML = `<span class="home-note-title-desktop">${desktopTitle}</span><span class="home-note-title-mobile">질문 노트에 손글씨로 기록하기</span>`;
      title.insertAdjacentHTML("beforebegin", `<img class="home-note-step-number" src="/assets/num_1.svg" alt="01">`);
      const stepNumber = title.previousElementSibling;
      const titleGroup = document.createElement("div");
      titleGroup.className = "home-note-title-group";
      stepNumber?.before(titleGroup);
      titleGroup.append(stepNumber, title);
    }
    noteTitleRow.insertAdjacentHTML("afterend", `<img class="home-note-divider home-note-divider-second" src="/assets/home-note-divider.svg" alt="" aria-hidden="true">`);
  }
  if (notePaper) {
    const purchaseButton = notePaper.querySelector(".home-note-purchase");
    if (purchaseButton && !purchaseButton.querySelector(".home-note-purchase-label-desktop")) {
      const desktopLabel = document.createElement("span");
      desktopLabel.className = "home-note-purchase-label-desktop";
      desktopLabel.textContent = purchaseButton.textContent;
      const mobileLabel = document.createElement("span");
      mobileLabel.className = "home-note-purchase-label-mobile";
      mobileLabel.textContent = "구매하기";
      purchaseButton.replaceChildren(desktopLabel, mobileLabel);
    }
    const mobileBanners = document.createElement("div");
    mobileBanners.className = "home-note-mobile-banners";
    ["m_notebanner_01.png", "m_notebanner_02.png", "m_notebanner_03.png"].forEach((asset, index) => {
      mobileBanners.insertAdjacentHTML("beforeend", `<div class="home-note-mobile-banner"><img src="/assets/${asset}" alt="질문 노트 배너 ${index + 1}"></div>`);
    });
    const existingImages = notePaper.querySelector(".home-note-paper-images");
    existingImages?.before(mobileBanners);
  }
  const onlineWritingSection = document.querySelector(".home-online-writing");
  const onlineTitleRow = onlineWritingSection?.querySelector(".home-online-title-row");
  if (onlineTitleRow) {
    const title = onlineTitleRow.querySelector("h2");
    if (title && !title.querySelector(".home-online-title-mobile")) {
      const desktopTitle = title.textContent;
      title.innerHTML = `<span class="home-online-title-desktop">${desktopTitle}</span><span class="home-online-title-mobile">웹에서 편하게 기록하기</span>`;
      title.insertAdjacentHTML("beforebegin", `<img class="home-online-step-number" src="/assets/num_2.svg" alt="02">`);
      const stepNumber = title.previousElementSibling;
      const titleGroup = document.createElement("div");
      titleGroup.className = "home-online-title-group";
      stepNumber?.before(titleGroup);
      titleGroup.append(stepNumber, title);
      onlineTitleRow.insertAdjacentHTML("afterend", `<img class="home-online-divider-second" src="/assets/home-online-divider.svg" alt="" aria-hidden="true">`);
    }
    const button = onlineTitleRow.querySelector(".home-online-button");
    if (button && !button.querySelector(".home-online-button-label-mobile")) {
      const desktopLabel = document.createElement("span");
      desktopLabel.className = "home-online-button-label-desktop";
      desktopLabel.textContent = button.textContent;
      const mobileLabel = document.createElement("span");
      mobileLabel.className = "home-online-button-label-mobile";
      mobileLabel.textContent = "시작하기";
      button.replaceChildren(desktopLabel, mobileLabel);
    }
  }
  const homeMain = document.querySelector(".home-main");
  const recommendationSection = homeMain?.querySelector(".home-recommendation");
  const recommendationInner = recommendationSection?.querySelector(".home-recommendation-inner");
  const forYouSection = recommendationInner?.querySelector(".home-for-you");
  const onlineSection = homeMain?.querySelector(".home-online-writing");
  const reviewSection = homeMain?.querySelector(".home-review");
  const createDivider = document.createElement("img");
  createDivider.className = "home-mobile-create-divider";
  createDivider.src = "/assets/create-divider.svg";
  createDivider.alt = "";
  createDivider.setAttribute("aria-hidden", "true");
  const syncMobileHomeOrder = () => {
    if (!homeMain || !recommendationSection || !recommendationInner || !forYouSection || !onlineSection || !reviewSection) return;
    if (window.matchMedia("(max-width: 767px)").matches) {
      recommendationSection.after(onlineSection);
      onlineSection.after(recommendationSection);
      onlineSection.after(createDivider);
      createDivider.after(recommendationSection);
      reviewSection.before(forYouSection);
    } else {
      createDivider.remove();
      recommendationInner.append(forYouSection);
      recommendationSection.after(onlineSection);
    }
  };
  syncMobileHomeOrder();
  setHomeBannerLinks(leftBanner, rightBanner);
}

function setHomeBannerLinks(leftBanner, rightBanner) {
  [[".home-banner-left", leftBanner], [".home-banner-right", rightBanner]].forEach(([selector, banner]) => {
    const pane = document.querySelector(selector);
    if (!pane || !banner?.linkUrl) return;
    pane.classList.add("home-banner-link");
    pane.dataset.bannerLink = banner.linkUrl;
    pane.setAttribute("role", "link");
    pane.setAttribute("tabindex", "0");
  });
}

async function books() {
  const giftOnly = state.authKind === "gift";
  const items = giftOnly && state.giftSession?.bookId ? [await api(`/api/books/${state.giftSession.bookId}`)] : await api("/api/books");
  const createAction = giftOnly ? "" : `<a class="books-create-button home-note-purchase" href="#create">+ 새 이야기 만들기</a>`;
  const emptyAction = giftOnly ? "" : `<a class="button primary" href="#create">책 만들기</a>`;
  const cards = giftOnly ? items.map(giftBookCard).join("") : items.map(bookCard).join("");
  app.innerHTML = `<section class="books-page ${giftOnly ? "gift-only-books" : ""}"><div class="books-description"><span class="books-subject">내 이야기</span><div class="books-description-row"><div class="books-lead">나에게 맞는 속도로 언제든 편하게 작성하고 저장하세요.<br> 이미 작성이 완료된 이야기도 다시 수정할 수 있어요.</div>${createAction}</div></div>${items.length ? `<div class="my-books-grid">${cards}</div>` : `<div class="panel empty"><h2>아직 만든 책이 없어요.</h2><p>첫 번째 이야기를 시작해 보세요.</p>${emptyAction}</div>`}</section>`;
}

async function profile() {
  const auth = await loadAuthState();
  if (!auth.session) { location.hash = "#login"; return; }
  const gifts = await authedApi("/api/account/gifts");
  const typeCode = (name) => ({ Parents: "P", "Single Parent": "SP", Couple: "C", Single: "S" }[name] || name || "-");
  const formatDate = (value) => value ? new Date(value).toLocaleDateString("ko-KR") : "-";
  const statusLabel = (gift) => gift.progressStatus === "not_accessed" ? "미접속" : gift.progressStatus === "not_started" ? "작성 전" : gift.progressStatus === "completed" ? "완료" : `작성 중 ${gift.progress}%`;
  app.innerHTML = `<section class="profile-page"><div class="eyebrow">PROFILE</div><h1 class="admin-title">${escapeHtml(auth.user?.displayName || "사용자")}</h1><section class="panel profile-name-panel"><h2>네임 설정</h2><form class="form" data-form="profile"><label class="field">닉네임<input name="displayName" value="${escapeHtml(auth.user?.displayName || "")}" maxlength="40" required></label><div class="actions"><button class="button primary" type="submit">저장</button></div></form></section><section class="profile-gifts"><h2>선물한 이야기</h2><div class="panel table-wrap"><table class="table admin-gifts-table"><thead><tr><th>받는 사람</th><th>책 제목</th><th>진행상태</th><th>선물일</th><th>관리</th></tr></thead><tbody>${gifts.length ? gifts.map((gift) => `<tr><td>${escapeHtml(gift.receiver || "-")}</td><td>${escapeHtml(gift.title || "-")}</td><td><span class="status ${gift.progressStatus === "completed" ? "done" : ""}">${statusLabel(gift)}</span></td><td>${formatDate(gift.createdAt)}</td><td><span class="muted">수정 권한 없음</span></td></tr>`).join("") : `<tr><td colspan="5" class="empty">아직 선물한 이야기가 없습니다.</td></tr>`}</tbody></table></div><p class="muted gift-permission-note">선물받은 사람의 글은 수정할 수 없으며, 작성률과 진행상태만 확인할 수 있습니다.</p></section></section>`;
  const profileSaved = state.profileSaved;
  state.profileSaved = false;
  const profilePanel = app.querySelector(".profile-name-panel");
  if (profilePanel) {
    profilePanel.className = "profile-settings";
    profilePanel.innerHTML = `<form class="profile-name-form" data-form="profile"><div class="profile-name-form-row"><input name="displayName" value="${escapeHtml(auth.user?.displayName || "")}" maxlength="40" placeholder="닉네임을 입력하세요" aria-label="닉네임" required><button class="button primary" type="submit">저장</button></div><div class="profile-save-message muted"${profileSaved ? "" : " hidden"} role="status">저장되었습니다</div></form>`;
  }
  const giftsSection = app.querySelector(".profile-gifts");
  const giftsBoard = giftsSection?.querySelector(".panel.table-wrap");
  const profileTitle = app.querySelector(".profile-page > .admin-title");
  const profileEmail = auth.user?.email || auth.session?.user?.email || "";
  if (profileTitle) {
    const heading = document.createElement("div");
    heading.className = "admin-page-heading-row";
    const email = document.createElement("span");
    email.className = "muted";
    email.textContent = profileEmail;
    profileTitle.replaceWith(heading);
    heading.append(profileTitle, email);
  }
  giftsSection?.classList.add("admin-content");
  const giftsTitle = giftsSection?.querySelector("h2");
  if (giftsTitle) giftsTitle.textContent = "선물한 목록";
  giftsTitle?.classList.add("books-lead", "admin-page-title");
  giftsSection?.querySelector("h2")?.parentElement?.classList.add("admin-page-header");
  giftsBoard?.classList.add("admin-board");
}

function coverStyle(item) { const color = /^#[0-9a-f]{6}$/i.test(item.coverColor || "") ? item.coverColor : "#00BC3C"; const text = /^#[0-9a-f]{6}$/i.test(item.textColor || "") ? item.textColor : "#FFFFFF"; return `style="background:${color};color:${text}"`; }
const bookTypeIllustrationOptions = [
  { value: "book-type-parents.png", label: "Parents" },
  { value: "book-type-couple.png", label: "Couple" },
  { value: "book-type-single-parent.png", label: "Single Parent" },
  { value: "book-type-single.png", label: "Single" },
];
function bookTypeIllustration(type, index) { const name = String(type.name || "").toLowerCase(); if (/single parent|싱글.*부모|한부모/.test(name)) return "book-type-single-parent.png"; if (/couple|커플|부부/.test(name)) return "book-type-couple.png"; if (/single|싱글/.test(name)) return "book-type-single.png"; if (/parent|부모/.test(name)) return "book-type-parents.png"; return ["book-type-parents.png", "book-type-single.png", "book-type-single-parent.png", "book-type-couple.png"][index % 4]; }
function bookTypeDesign(type) { const name = String(type?.name || "").toLowerCase(); const description = String(type?.description || ""); const image = bookTypeIllustrationOptions.some((option) => option.value === type?.coverImage) ? type.coverImage : /couple|커플|부부/.test(name) ? "book-type-couple.png" : /parent|부모/.test(name) || /부모님/.test(description) ? "book-type-parents.png" : /single|싱글/.test(name) ? "book-type-single.png" : "book-type-single-parent.png"; return { image }; }
function syncBookQuestionScroll(previousScrollLeft = null) {
  if (state.bookWritingFull || !window.matchMedia("(max-width: 760px)").matches) return;
  requestAnimationFrame(() => {
    const list = app.querySelector(".book-question-list");
    const active = list?.querySelector('[data-book-page][aria-current="page"]');
    if (!list || !active) return;
    if (Number.isFinite(previousScrollLeft)) list.scrollLeft = previousScrollLeft;
    const listRect = list.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const edge = 10;
    const nextLeft = activeRect.left < listRect.left + edge
      ? list.scrollLeft + activeRect.left - (listRect.left + edge)
      : activeRect.right > listRect.right - edge
        ? list.scrollLeft + activeRect.right - (listRect.right - edge)
        : list.scrollLeft;
    if (nextLeft !== list.scrollLeft) list.scrollTo({ left: nextLeft, behavior: "smooth" });
  });
}
function createSteps(active) { const labels = ["북타입 선택", "기본정보", "안내", "질문생성"]; return `<div class="steps create-steps">${labels.map((label, index) => `${index ? "<i></i>" : ""}<span class="${active === index + 1 ? "active" : ""}">0${index + 1} ${label}</span>`).join("")}</div>`; }
function bookCard(b) { const design = bookTypeDesign(b); return `<article class="my-book-card book-card" data-go="book/${b.id}"><span class="my-book-status ${b.status === "published" ? "published" : ""}">${b.status === "published" ? "출판완료" : `작성중 <em>${b.progress}%</em>`}</span><div class="my-book-main"><div class="my-book-title"><p class="my-book-script">My Story</p><p class="my-book-name">${escapeHtml(b.title)}</p></div><div class="my-book-from-to"><strong>${escapeHtml(b.sender || "보내는 사람이")}(이)가</strong><img src="/assets/home-category-line.svg" alt="" aria-hidden="true"><strong>${escapeHtml(b.receiver || "받는 사람")}에게</strong></div></div><div class="my-book-illustration"><img src="/assets/${design.image}" alt="${escapeHtml(b.bookTypeName)} 유형 일러스트"></div></article>`; }
function giftBookCard(b) { return `<article class="gift-book-card" data-go="book/${b.id}" style="background-color:${escapeHtml(b.coverColor || "")}"><span class="gift-book-status ${b.status === "published" ? "published" : ""}">${b.status === "published" ? "출판완료" : `작성중 <em>${b.progress}%</em>`}</span><div class="gift-book-main"><div class="gift-book-title"><p class="gift-book-script">My Story</p><p class="gift-book-name">${escapeHtml(b.title)}</p></div><div class="gift-book-from-to"><strong>${escapeHtml(b.sender || "보내는 사람이")}(이)가</strong><img src="/assets/home-category-line.svg" alt="" aria-hidden="true"><strong>${escapeHtml(b.receiver || "받는 사람")}에게</strong></div></div><div class="gift-book-cover"><img src="${escapeHtml(b.coverImageUrl || "")}" alt="${escapeHtml(b.title)} 표지"></div></article>`; }

async function create() {
  const types = await api("/api/book-types");
  if (state.createStep === 1) { const activeTypes = types.filter(t => t.isActive); app.innerHTML = `<section class="create-page"><div class="create-intro"><p class="create-kicker">웹에서 ‘나의 이야기’ 시작하기</p><h1>오래보고 자세히 보면 모두 아름다운 인생입니다.</h1><p>어느 정도 나이를 먹고 보니 내 삶과 부모님의 삶도 돌아봐야겠다는 생각이 들었습니다.<br>가족을 사랑하는 것은 그냥 의무 같을 때가 많았던 거 같고요.<br>들여다보고 알아야 나 자신조차 이해하고 사랑할 수 있는 거 같아요.</p></div><div class="steps"><b>01 북타입 선택</b><i></i>02 기본정보<i></i>03 안내<i></i>04 질문생성</div><div class="grid cards create-type-cards">${activeTypes.map(t => { const design = bookTypeDesign(t); return `<article class="card book-card ${state.createType === t.id ? "selected" : ""}" data-pick-type="${t.id}"><div class="cover"><span class="thumbnail-title">My Story</span><span class="thumbnail-type">${escapeHtml(t.name)}</span><img src="/assets/${design.image}" alt="${escapeHtml(t.name)} 유형 일러스트"></div><div class="muted">${escapeHtml(t.description)}</div></article>`; }).join("")}</div><div class="actions"><a class="button ghost" href="#home">취소</a></div></section>`; }
  else if (state.createStep === 2) app.innerHTML = `<section class="create-page create-flow create-basic-page"><div class="create-intro create-basic-intro"><p class="create-kicker">나의 이야기를 위한 정보</p><h1>책의 기본정보를 입력해 주세요.</h1><p>책에 담길 이름과 인사말을 차분히 적어 주세요.</p></div>${createSteps(2)}<form id="create-basic-form" class="form create-basic-form" data-form="create-book"><label class="create-basic-field"><span class="guide_02">책 제목</span><input name="title" value="${escapeHtml(state.bookDraft?.title || "")}" placeholder="오래보고 자세히 보면 모두 어여쁜 인생입니다" required></label><label class="create-basic-field"><span class="guide_02">보내는 사람</span><input name="sender" value="${escapeHtml(state.bookDraft?.sender || "")}" placeholder="이름 (딸, 가을)"></label><label class="create-basic-field"><span class="guide_02">받는 사람</span><input name="receiver" value="${escapeHtml(state.bookDraft?.receiver || "")}" placeholder="이름 (엄마, 이겨울)"></label><label class="create-basic-field"><span class="guide_02">인사말</span><textarea name="introduction" placeholder="내 곁에 있어 주셔서 감사합니다&#10;꼭 하고 싶었던 말을 이제서야 드립니다&#10;고맙고 미안하고 사랑합니다.">${escapeHtml(state.bookDraft?.introduction || "")}</textarea></label></form><div class="create-basic-actions actions"><button type="button" class="button ghost" data-create-back>이전</button><button type="submit" form="create-basic-form" class="button primary">다음 →</button></div></section>`;
  else if (state.createStep === 3) app.innerHTML = `<section class="create-page create-flow create-info-page"><div class="create-intro"><p class="create-kicker">작성 전에 확인해 주세요</p><h1>당신의 속도로 이야기를 시작하세요.</h1><p>완벽한 답보다, 지금 떠오르는 기억을 남기는 것이 더 중요합니다.</p></div>${createSteps(3)}<div class="create-info-list"><section><h2>작성 방법</h2><p>정답은 없습니다. 기억나는 만큼 자유롭게 작성해 주세요.</p></section><section><h2>저장 방법</h2><p>작성 중인 답변은 30초마다 자동 저장되며, 저장 버튼으로 직접 저장할 수도 있습니다.</p></section><section><h2>개인정보</h2><p>작성 내용은 나의 책에만 저장됩니다.</p></section><div class="actions"><button class="button ghost" data-create-back>이전</button><button class="button primary" data-next-create>다음 →</button></div></div></section>`;
  else { const type = types.find(t => t.id === state.createType); const design = bookTypeDesign(type); app.innerHTML = `<section class="create-page create-flow create-outline-page"><div class="create-intro"><p class="create-kicker">나의 이야기 목차</p><h1>질문을 확인하고 책을 시작하세요.</h1><p>선택한 질문은 책을 만든 뒤에도 답변을 작성하며 확인할 수 있습니다.</p></div>${createSteps(4)}<div class="create-outline"><div class="create-outline-content"><div class="outline-thumbnail-column"><div class="outline-thumbnail"><span class="thumbnail-title">My Story</span><span class="thumbnail-type">${escapeHtml(type.name)}</span><img src="/assets/${design.image}" alt="${escapeHtml(type.name)} 유형 일러스트"></div><p class="outline-thumbnail-summary">선택한 질문그룹 ${type.questionGroups.length}개 · 총 ${type.questionCount}개의 질문</p></div><div class="outline-groups">${type.questionGroups.map((g, index) => `<section class="outline-group"><h3><span>${String(index + 1).padStart(2, "0")}</span><span>${escapeHtml(g.name)}</span></h3></section>`).join("")}<div class="actions"><button class="button ghost" data-create-back>이전</button><button class="button primary" data-create-confirm>이 질문으로 책 만들기 →</button></div></div></div></div></section>`; }
}

function giftSteps(active) {
  const labels = ["북타입 선택", "기본정보", "표지", "보내기"];
  return `<div class="steps create-steps gift-create-steps">${labels.map((label, index) => `${index ? "<i></i>" : ""}<span class="${active === index + 1 ? "active" : ""}">0${index + 1} ${label}</span>`).join("")}</div>`;
}

async function giftCreate() {
  if (state.giftCreateStep === 1) {
    const types = await api("/api/book-types");
    const activeTypes = types.filter((type) => type.isActive);
    app.innerHTML = `<section class="create-page gift-create-page gift-create-flow"><div class="create-intro"><p class="create-kicker">선물하기</p><h1>선물할 책의 형태를 골라 주세요.</h1><p>마음을 전하고 싶은 사람에게 맞는 이야기를 선택해 주세요.</p></div>${giftSteps(1)}<div class="grid cards create-type-cards gift-type-cards">${activeTypes.map((type) => { const design = bookTypeDesign(type); return `<article class="card book-card ${state.giftCreateType === type.id ? "selected" : ""}" data-gift-pick-type="${type.id}"><div class="cover"><span class="thumbnail-title">My Story</span><span class="thumbnail-type">${escapeHtml(type.name)}</span><img src="/assets/${design.image}" alt="${escapeHtml(type.name)} 유형 일러스트"></div><div class="muted">${escapeHtml(type.description)}</div></article>`; }).join("")}</div></section>`;
    return;
  }
  if (state.giftCreateStep === 2) {
    app.innerHTML = `<section class="create-page create-flow create-basic-page gift-create-page gift-basic-page"><div class="create-intro create-basic-intro"><p class="create-kicker">선물하기</p><h1>책의 기본정보를 입력해 주세요.</h1><p>선물받을 사람을 생각하며 이름과 인사말을 적어 주세요.</p></div>${giftSteps(2)}<form id="gift-basic-form" class="form create-basic-form" data-form="gift-basic"><label class="create-basic-field"><span class="guide_02">책 제목</span><input name="title" value="${escapeHtml(state.giftDraft?.title || "")}" placeholder="오래보고 자세히 보면 모두 어여쁜 인생입니다" required></label><label class="create-basic-field"><span class="guide_02">보내는 사람</span><input name="sender" value="${escapeHtml(state.giftDraft?.sender || "")}" placeholder="이름 (딸, 가을)"></label><label class="create-basic-field"><span class="guide_02">받는 사람</span><input name="receiver" value="${escapeHtml(state.giftDraft?.receiver || "")}" placeholder="이름 (엄마, 이겨울)"></label><label class="create-basic-field"><span class="guide_02">인사말</span><textarea name="introduction" placeholder="내 곁에 있어 주셔서 감사합니다&#10;꼭 하고 싶었던 말을 이제서야 드립니다&#10;고맙고 미안하고 사랑합니다.">${escapeHtml(state.giftDraft?.introduction || "")}</textarea></label></form><div class="create-basic-actions actions gift-create-actions"><button type="button" class="button ghost" data-gift-back>이전</button><button type="submit" form="gift-basic-form" class="button primary">다음 →</button></div></section>`;
    return;
  }
  if (state.giftCreateStep === 3) {
    const coverOptions = await api("/api/cover-options");
    const coverImages = (coverOptions.images || []).sort((a, b) => Number(a.column) - Number(b.column) || Number(a.sortOrder) - Number(b.sortOrder));
    const colors = coverOptions.colors || [];
    const defaultImage = "/assets/cover_girl_02.png";
    const selectedImage = state.giftCover?.image || (coverImages.some((image) => image.imagePath === defaultImage) ? defaultImage : coverImages[0]?.imagePath || defaultImage);
    const selectedColor = state.giftCover?.color || colors[0]?.colorValue || "#FEAAE8";
    state.giftCover = { image: selectedImage, color: selectedColor };
    const imageUrlFor = (imagePath) => coverImages.find((image) => image.imagePath === imagePath)?.imageUrl || (imagePath?.startsWith("/") ? imagePath : imagePath ? `/assets/${imagePath}` : "");
    const imageOptions = (column, label) => coverImages.filter((image) => Number(image.column) === column).map((image) => `<label class="publish-cover-option"><input type="radio" name="giftCoverImage" value="${escapeHtml(image.imagePath)}" data-image-url="${escapeHtml(image.imageUrl)}" ${image.imagePath === selectedImage ? "checked" : ""}><span><img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.name || `${label} 표지 이미지`)}"></span></label>`).join("");
    const colorOptions = colors.map((color) => `<label class="publish-color-option"><input type="radio" name="giftCoverColor" value="${escapeHtml(color.colorValue)}" ${color.colorValue.toLowerCase() === selectedColor.toLowerCase() ? "checked" : ""}><span style="--swatch:${escapeHtml(color.colorValue)}" aria-label="표지 색상 ${escapeHtml(color.name)}"></span></label>`).join("");
    app.innerHTML = `<section class="create-page gift-create-page gift-cover-page" data-gift-cover-page><div class="create-intro gift-cover-intro"><p class="create-kicker">선물하기</p><h1>이야기를 책으로 출판할 준비가 되었나요?</h1><p>미작성 질문은 PDF에 ‘미작성’으로 표시됩니다. 출판 후에도 책의 답변을 수정할 수 있습니다.</p></div>${giftSteps(3)}<div class="publish-layout gift-cover-layout"><section class="publish-preview-column gift-cover-preview"><h2 class="sr-only">선택한 표지 미리보기</h2><div class="publish-book-cover" data-cover-preview style="--cover-color:${escapeHtml(selectedColor)}"><div class="publish-cover-content"><p class="publish-cover-script">My Story</p><h2>${escapeHtml(state.giftDraft?.title || "")}</h2><div class="publish-cover-bottom"><p class="publish-cover-fixed-copy">자세히 보고 오래보면 모두 어여쁜 인생입니다</p><p class="publish-cover-publisher">북촌꾸러미연구소</p></div></div><img data-cover-image src="${escapeHtml(imageUrlFor(selectedImage))}" alt="선택한 표지 이미지"><small class="publish-cover-copyright">© 북촌꾸러미연구소, All rights reserved since 2025.</small></div></section><section class="publish-settings gift-cover-settings"><fieldset class="publish-fieldset"><legend>표지 컬러</legend><div class="publish-colors">${colorOptions}</div></fieldset><fieldset class="publish-fieldset"><legend>표지 이미지</legend><div class="publish-image-grid"><div class="publish-image-row">${imageOptions(1, "여성")}</div><div class="publish-image-row">${imageOptions(2, "남성")}</div></div></fieldset></section></div><div class="actions gift-create-actions gift-cover-actions"><button class="button ghost" type="button" data-gift-back>이전</button><button class="button primary" type="button" data-gift-create ${state.giftSubmitting ? "disabled" : ""}>${state.giftSubmitting ? "생성 중…" : "다음 →"}</button></div></section>`;
    return;
  }
  const result = state.giftResult;
  if (!result?.code) { state.giftCreateStep = 3; return giftCreate(); }
  const maskedCode = maskGiftCode(result.code);
  app.innerHTML = `<section class="create-page gift-create-page gift-send-page"><div class="create-intro gift-send-intro"><p class="create-kicker">선물하기</p><h1>이제 선물하면 됩니다 :-)</h1><p>오래보고 자세히 보면 모두 아름다운 인생입니다</p></div>${giftSteps(4)}<section class="gift-delivery-grid" aria-label="선물 전달 방법"><article class="gift-delivery-card"><h2>카톡 보내기</h2><code class="gift-delivery-code">${escapeHtml(maskedCode)}</code><button class="button primary" type="button" data-gift-share="kakao">보내기</button></article><article class="gift-delivery-card"><h2>메일 보내기</h2><code class="gift-delivery-code">${escapeHtml(maskedCode)}</code><button class="button primary" type="button" data-gift-share="email">보내기</button></article><article class="gift-delivery-card"><h2>코드 복사</h2><code class="gift-delivery-code">${escapeHtml(maskedCode)}</code><button class="button primary" type="button" data-copy-gift-code>복사하기</button></article></section><p class="gift-code-help">선물코드로 로그인하면 선물받은 책을 바로 시작할 수 있습니다.</p><p class="gift-copy-feedback" data-gift-copy-feedback hidden>복사되었습니다.</p></section>`;
}

function captureGiftCover() {
  const page = document.querySelector("[data-gift-cover-page]");
  if (!page) return;
  const image = page.querySelector('input[name="giftCoverImage"]:checked')?.value;
  const color = page.querySelector('input[name="giftCoverColor"]:checked')?.value;
  if (image && color) state.giftCover = { image, color };
}

async function submitGiftCreation(button) {
  if (state.giftSubmitting || state.giftResult) return;
  captureGiftCover();
  state.giftSubmitting = true;
  if (button) button.disabled = true;
  try {
    state.giftResult = await api("/api/gifts", { method: "POST", body: { bookTypeId: state.giftCreateType, ...state.giftDraft, coverColor: state.giftCover?.color, coverImage: state.giftCover?.image } });
    state.giftSubmitting = false;
    state.giftCreateStep = 4;
    await giftCreate();
  } catch (error) {
    state.giftSubmitting = false;
    if (button) button.disabled = false;
    toastMsg(error.message);
  }
}

async function copyGiftCode() {
  const code = state.giftResult?.code;
  if (!code) return;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
    else {
      const input = document.createElement("textarea");
      input.value = code; input.setAttribute("readonly", ""); input.style.position = "fixed"; input.style.opacity = "0";
      document.body.append(input); input.select(); document.execCommand("copy"); input.remove();
    }
    const feedback = document.querySelector("[data-gift-copy-feedback]");
    if (!feedback) return;
    feedback.hidden = false;
    clearTimeout(state.giftCopyTimer);
    state.giftCopyTimer = setTimeout(() => { feedback.hidden = true; }, 2000);
  } catch (error) { toastMsg("선물 코드 복사에 실패했습니다."); }
}

function maskGiftCode(code) { const value = String(code || ""); return value.length > 16 ? `${value.slice(0, 8)}******${value.slice(-8)}` : `${value.slice(0, 4)}******`; }
async function createGiftShareMessage(method) {
  const result = state.giftResult;
  if (!result?.gift?.id || !result.code) throw new Error("선물 정보를 찾을 수 없습니다.");
  const response = await api(`/api/gifts/${result.gift.id}/share`, { method: "POST" });
  const shareUrl = new URL(response.shareUrl, location.origin).href;
  await authedApi(`/api/account/gifts/${result.gift.id}/deliveries`, { method: "POST", body: { method } });
  const message = `선물 미리보기 1·2페이지\n${shareUrl}\n\n선물코드\n${result.code}\n\n선물 접속 URL\n${shareUrl}`;
  return { shareUrl, message };
}
async function shareGift(method) {
  try {
    const { shareUrl, message } = await createGiftShareMessage(method);
    if (method === "email") {
      location.href = `mailto:?subject=${encodeURIComponent("나의 이야기 선물")}&body=${encodeURIComponent(message)}`;
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: "나의 이야기 선물", text: message, url: shareUrl });
      return;
    }
    await navigator.clipboard?.writeText(message);
    toastMsg("선물 내용을 복사했습니다.");
  } catch (error) { if (error.name !== "AbortError") toastMsg(error.message || "선물 전달 정보를 만들지 못했습니다."); }
}

async function book(id, selectedPage = null) {
  const bookRenderId = state.renderId;
  const previousQuestionList = app.querySelector(".book-question-list");
  const previousScrollLeft = previousQuestionList?.scrollLeft ?? null;
  const b = await api(`/api/books/${id}`); state.currentBook = b;
  if (bookRenderId !== state.renderId) return;
  const all = b.outline.groups.flatMap(g => g.questions);
  const pages = b.outline.groups.flatMap(group => [{ type: "group", groupId: group.id, group }, ...group.questions.map(question => ({ type: "question", questionId: question.id, question, group }))]);
  const selectedIndex = selectedPage?.type === "group"
    ? pages.findIndex(page => page.type === "group" && String(page.groupId) === String(selectedPage.groupId))
    : selectedPage?.type === "question"
      ? pages.findIndex(page => page.type === "question" && String(page.questionId) === String(selectedPage.questionId))
      : 0;
  const page = selectedIndex >= 0 ? pages[selectedIndex] : null;
  const selected = page?.type === "question" ? page.question : null;
  if (!page) { app.innerHTML = `<div class="panel empty">이 책에 등록된 질문이 없습니다.</div>`; return; }
  if (selected) rememberBookQuestion(id, selected.id);
  const groupCounts = new Map(b.outline.groups.map(g => [g.id, { total: g.questions.length, done: g.questions.filter(q => q.answer.trim() || q.isFinal).length }]));
  const groupList = b.outline.groups.map(group => {
    const count = groupCounts.get(group.id);
    const groupFilled = count.done > 0;
    const docs = group.questions.map(q => {
      const filled = Boolean(q.answer.trim() || q.isFinal);
      const active = selected?.id === q.id;
      const icon = filled ? (active ? "doc_filledActive.svg" : "doc_filled.svg") : (active ? "doc_blankActive.svg" : "doc_blank.svg");
      return `<button class="book-question-icon" type="button" data-book-page="question-${q.id}" aria-label="${escapeHtml(q.content)}" aria-current="${active ? "page" : "false"}"><img src="/assets/${icon}" alt=""></button>`;
    }).join("");
    return `<section class="book-question-group"><div class="book-question-group-title"><strong>${escapeHtml(group.name)}</strong><span>(${count.done}/${count.total})</span></div><div class="book-question-icons">${docs}</div></section>`;
  }).join(`<div class="book-question-divider" aria-hidden="true"></div>`);
  const questionIndex = selected ? all.findIndex(q => q.id === selected.id) : -1;
  const questionNumber = questionIndex >= 0 ? String(questionIndex + 1).padStart(2, "0") : "";
  const previous = pages[selectedIndex - 1]; const next = pages[selectedIndex + 1];
  const updated = selected?.updatedAt ? new Date(selected.updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "";
  const groupHeightReference = page.type === "group" ? page.group.questions[0] : null;
  const writingContent = page.type === "group" ? `<div class="book-group-height-reference" aria-hidden="true"><div class="book-writing-question"><span>01</span><h2>${escapeHtml(groupHeightReference.content)}</h2>${groupHeightReference.description ? `<p>${escapeHtml(groupHeightReference.description)}</p>` : ""}</div><span class="book-writing-save-state">저장되지 않음</span><textarea class="book-answer-input">${escapeHtml(groupHeightReference.answer)}</textarea><div class="book-writing-footer"><p>30초마다 자동 저장됩니다. 사진·음성·동영상 첨부는 다음 버전에서 제공됩니다.</p><button class="button small" type="button">저장</button></div></div><div class="book-group-divider-page">${page.group.imageUrl ? `<img src="${escapeHtml(page.group.imageUrl)}" alt="${escapeHtml(page.group.name)} 대표 이미지">` : ""}</div>` : `<div class="book-writing-question"><span>${questionNumber}</span><h2>${escapeHtml(selected.content)}</h2>${selected.description ? `<p>${escapeHtml(selected.description)}</p>` : ""}</div><span id="saveState" class="book-writing-save-state">${updated ? `저장됨 ${updated}` : "저장되지 않음"}</span><textarea id="answerInput" class="book-answer-input" placeholder="기억나는 이야기를 자유롭게 적어 주세요.">${escapeHtml(selected.answer)}</textarea><div class="book-writing-footer"><p>30초마다 자동 저장됩니다. 사진·음성·동영상 첨부는 다음 버전에서 제공됩니다.</p><button class="button small" type="button" data-save-inline-answer="true">저장</button></div>`;
  const cover = bookTypeDesign({ name: b.bookTypeName, coverImage: b.coverImage }).image;
  app.innerHTML = `<section class="book-detail-page ${state.bookWritingFull ? "book-writing-full" : ""}">
    <div class="book-detail-head"><div class="book-detail-info"><a class="book-back" href="#books">← 내 이야기 목록</a><div class="book-detail-title-actions"><h1>${escapeHtml(b.title)}</h1> <button class="book-detail-edit" type="button" data-open-book-info="${b.id}">📝 기본정보 수정하기</button></div></div><div class="book-detail-illustration"><img src="/assets/${cover}" alt="${escapeHtml(b.bookTypeName)} 유형 일러스트"><span>${b.status === "published" ? "출판완료" : "작성중"}</span></div></div>
    <div class="book-detail-stats"><div class="book-detail-progress-highlight"><div class="book-detail-stat-progress" style="width:${b.totalQuestions ? Math.max(0, Math.min(100, b.progress)) : 0}%"></div><div class="book-detail-progress-row"><div class="book-detail-mobile-progress-status"><b>${b.progress}%</b><span>진행상태</span></div><div class="book-detail-actions"><a class="button small" href="/preview/${b.id}" data-open-book-output="${b.id}" data-output-type="preview" target="_blank" rel="noopener">미리보기</a><a class="button small" href="#publish/${b.id}">출력하기</a>${state.authKind === "gift" ? "" : `<button class="book-trash-button" type="button" data-open-book-delete="${b.id}" aria-label="책 삭제"><img src="/assets/icn_trash.svg" alt=""></button>`}</div></div></div><div class="book-detail-progress-content"><div><b>${b.totalQuestions}</b><span>전체질문</span></div><div><b>${b.completedQuestions}</b><span>작성완료</span></div><div><b>${b.progress}%</b><span>진행상태</span></div></div></div>
    <div class="book-writing-layout"><aside class="book-question-list">${groupList}</aside><section class="book-writing-panel"><div class="book-writing-tools"><button class="book-writing-view-toggle" type="button" data-notewindow-toggle aria-label="${state.bookWritingFull ? "전체보기" : "작성영역만 보기"}" aria-pressed="${state.bookWritingFull}"><img src="/assets/${state.bookWritingFull ? "notewindow_dashboard.svg" : "notewindow_full.svg"}" alt=""></button></div><div class="book-writing-content${page.type === "group" ? " book-writing-group-content" : ""}">${writingContent}</div><div class="book-writing-navigation">${previous ? `<a href="#book/${b.id}/${previous.type === "group" ? `group-${previous.groupId}` : `question-${previous.questionId}`}" aria-label="이전 ${previous.type === "group" ? "질문그룹" : "질문"}"><img src="/assets/arrow_previous_1.svg" alt="이전 페이지"></a>` : `<span></span>`}${next ? `<a href="#book/${b.id}/${next.type === "group" ? `group-${next.groupId}` : `question-${next.questionId}`}" aria-label="다음 ${next.type === "group" ? "질문그룹" : "질문"}"><img src="/assets/arrow_next_1.svg" alt="다음 페이지"></a>` : `<span></span>`}</div></section></div>
  </section>`;
  syncBookQuestionScroll(previousScrollLeft);
  if (selected) state.autoSave = setInterval(() => saveAnswer(b.id, selected.id, false, true), 30000);
}

async function write(bookId, questionId) {
  const b = await api(`/api/books/${bookId}`); const all = b.outline.groups.flatMap(g => g.questions); const index = all.findIndex(q => q.id === questionId); const q = all[index]; if (!q) throw new Error("질문을 찾을 수 없습니다.");
  app.innerHTML = `<div class="editor"><div class="inline" style="justify-content:space-between"><a class="muted" href="#book/${bookId}">← 목차로 돌아가기</a><span id="saveState" class="save-state">마지막 저장 ${q.updatedAt ? new Date(q.updatedAt).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}) : ""}</span></div><p class="eyebrow">${index + 1} / ${all.length} · ${escapeHtml(b.title)}</p><h1 class="editor-question">${escapeHtml(q.content)}</h1><textarea id="answerInput" class="field" style="width:100%;min-height:300px" placeholder="기억나는 이야기를 자유롭게 적어 주세요.">${escapeHtml(q.answer)}</textarea><p class="muted">30초마다 자동 저장됩니다. 사진·음성·동영상 첨부는 다음 버전에서 제공됩니다.</p><div class="actions"><div class="inline">${index > 0 ? `<a class="button ghost" href="#write/${bookId}/${all[index-1].id}">이전 질문</a>` : ""}${index < all.length-1 ? `<a class="button ghost" href="#write/${bookId}/${all[index+1].id}">다음 질문</a>` : ""}</div><div class="inline"><a class="button ghost" href="#book/${bookId}">책시작으로 돌아가기</a><button class="button primary" data-save-answer="final">저장</button></div></div></div>`;
  state.autoSave = setInterval(() => saveAnswer(bookId, questionId, false, true), 30000);
}

async function publish(id) {
  const b = await api(`/api/books/${id}`);
  const coverOptions = await api("/api/cover-options");
  const coverImages = (coverOptions.images || []).sort((a, b) => Number(a.column) - Number(b.column) || Number(a.sortOrder) - Number(b.sortOrder));
  const defaultCoverImage = "/assets/cover_girl_02.png";
  const selectedImage = b.coverImageSelected && b.coverImage ? b.coverImage : defaultCoverImage;
  const colors = coverOptions.colors || [];
  const selectedColor = b.coverColorSelected && /^#[0-9a-f]{6}$/i.test(b.coverColor || "") ? b.coverColor : "#FEAAE8";
  const imageUrlFor = (imagePath) => coverImages.find((image) => image.imagePath === imagePath)?.imageUrl || (imagePath?.startsWith("/") ? imagePath : imagePath ? `/assets/${imagePath}` : "");
  const imageOptions = (column, label) => coverImages.filter((image) => Number(image.column) === column).map((image) => { const isSelected = image.imagePath === selectedImage || image.imageUrl === selectedImage || (selectedImage === defaultCoverImage && image.imagePath === "cover_girl_02.png"); return `<label class="publish-cover-option"><input type="radio" name="coverImage" value="${escapeHtml(image.imagePath)}" data-image-url="${escapeHtml(image.imageUrl)}" ${isSelected ? "checked" : ""}><span><img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.name || `${label} 표지 이미지`)}"></span></label>`; }).join("");
  const colorOptions = colors.map((color) => `<label class="publish-color-option"><input type="radio" name="coverColor" value="${escapeHtml(color.colorValue)}" ${color.colorValue.toLowerCase() === selectedColor.toLowerCase() ? "checked" : ""}><span style="--swatch:${escapeHtml(color.colorValue)}" aria-label="표지 색상 ${escapeHtml(color.name)}"></span></label>`).join("");
  const cover = (image = selectedImage, color = selectedColor) => `<div class="publish-book-cover" data-cover-preview style="--cover-color:${color}"><div class="publish-cover-content"><p class="publish-cover-script">My Story</p><h2>${escapeHtml(b.title)}</h2><div class="publish-cover-bottom"><p class="publish-cover-fixed-copy">자세히 보고 오래보면 모두 어여쁜 인생입니다</p><p class="publish-cover-publisher">북촌꾸러미연구소</p></div></div><img data-cover-image src="${escapeHtml(imageUrlFor(image))}" alt="선택한 표지 이미지"><small class="publish-cover-copyright">© 북촌꾸러미연구소, All rights reserved since 2025.</small></div>`;
  const progress = `<div class="book-detail-stats publish-book-progress" aria-label="작성 진행률"><div class="book-detail-stat-progress book-writing-question" style="width:${b.totalQuestions ? Math.max(0, Math.min(100, b.progress)) : 0}%"></div></div>`;
  app.innerHTML = `<section class="publish-page" data-publish-id="${id}">
    <div class="publish-description"><a class="publish-back" href="#book/${id}"><span aria-hidden="true">←</span> 이전으로</a><h1>이야기를 책으로 출판할 준비가 되었나요?</h1>${progress}</div>
    <p class="publish-notice">미작성 질문은 PDF에 ‘미작성’으로 표시됩니다. 출판 후에도 책의 답변을 수정할 수 있습니다.</p>
    <div class="publish-layout"><section class="publish-preview-column"><h2 class="sr-only">책 표지 미리보기</h2>${cover()}</section><section class="publish-settings"><fieldset class="publish-fieldset"><legend>표지 컬러</legend><div class="publish-colors">${colorOptions}</div></fieldset><fieldset class="publish-fieldset"><legend>표지 이미지</legend><div class="publish-image-grid"><div class="publish-image-row">${imageOptions(1, "여성")}</div><div class="publish-image-row">${imageOptions(2, "남성")}</div></div><button class="book-detail-edit publish-cover-save" type="button" data-save-cover="${id}">저장</button></fieldset><div class="publish-actions"><button class="publish-button publish-button-pdf" type="button" data-publish-book="${id}">출판하기(PDF로 내보내기)</button><button class="publish-button publish-button-paper" type="button" data-paper-book="${id}">📗 종이책으로 출판 의뢰하기</button></div><p class="publish-paper-note">☀︎ 종이책으로 출판 의뢰하기하면 커버 이미지를 개인화 할 수 있습니다.</p></section></div>
  </section>`;
}

async function admin(section) {
  const data = section === "dashboard" ? await api("/api/admin/dashboard?period=month") : await api("/api/bootstrap"); const content = section === "dashboard" ? adminDashboardExpanded(data) : section === "questions" ? await adminQuestions() : section === "groups" ? await adminGroups() : section === "types" ? await adminTypes() : section === "covers" ? await adminCovers() : section === "reviews" ? await adminReviews() : section === "moments" ? await adminMoments() : section === "moment-authors" ? await adminMomentAuthors() : section === "banners" ? await adminBanners() : section === "gifts" ? await adminGiftsHeaderFixed() : await adminPublishingHeaderFixed();
  app.innerHTML = `<div class="admin-layout"><nav class="panel side-menu" aria-label="관리자 메뉴"><a class="${section === "dashboard" ? "active" : ""}" href="#admin/dashboard">대시보드</a><a class="${section === "questions" ? "active" : ""}" href="#admin/questions">질문 관리</a><a class="${section === "groups" ? "active" : ""}" href="#admin/groups">질문그룹 관리</a><a class="${section === "types" ? "active" : ""}" href="#admin/types">북타입 관리</a><a class="${section === "covers" ? "active" : ""}" href="#admin/covers">표지 관리</a><a class="${section === "publishing" ? "active" : ""}" href="#admin/publishing">출판 관리</a><a class="${section === "reviews" ? "active" : ""}" href="#admin/reviews">Review 관리</a><a class="${section === "moments" ? "active" : ""}" href="#admin/moments">Moments 관리</a><a class="${section === "banners" ? "active" : ""}" href="#admin/banners">메인 배너 관리</a><a class="${section === "moment-authors" ? "active" : ""}" href="#admin/moment-authors">Moments 작가 관리</a></nav><main class="admin-content">${content}</main></div>`;
  if (!app.querySelector('.side-menu a[href="#admin/banners"]')) app.querySelector(".side-menu")?.insertAdjacentHTML("beforeend", `<a class="${section === "banners" ? "active" : ""}" href="#admin/banners">메인 배너 관리</a>`);
  renderAdminMenu(section);
  normalizeAdminPageStructure();
  normalizeAdminActionButtons();
}

function renderAdminMenu(section) {
  const menu = document.querySelector(".side-menu");
  if (!menu) return;
  const link = (href, label) => `<a class="admin-menu-item home-logo ${section === href.slice(7) ? "active" : ""}" href="${href}">${label}</a>`;
  const group = (items) => `<div class="admin-menu-group">${items.map((item, index) => `${index ? `<div class="admin-menu-divider" aria-hidden="true"></div>` : ""}${item}`).join("")}</div>`;
  menu.innerHTML = `${group([link("#admin/dashboard", "대시보드")])}${group([link("#admin/questions", "질문 관리"), link("#admin/groups", "질문그룹 관리"), link("#admin/types", "북타입 관리"), link("#admin/covers", "표지 관리")])}${group([link("#admin/publishing", "출판 관리")])}${group([link("#admin/banners", "메인 배너 관리"), link("#admin/reviews", "Review 관리")])}${group([link("#admin/moments", "Moments 관리"), link("#admin/moment-authors", "Moments 작가 관리")])}${group([link("#admin/gifts", "선물하기")])}`;
}
function normalizeAdminActionButtons() {
  const selectors = ["[data-edit-group]", "[data-edit-type]", "[data-edit-cover-color]", "[data-edit-cover-image]", "[data-edit-review]", "[data-edit-moment]", "[data-edit-banner]", "[data-delete-book]", "[data-delete-group]", "[data-delete-type]", "[data-delete-cover-color]", "[data-delete-cover-image]", "[data-delete-review]", "[data-delete-moment]", "[data-delete-banner]"];
  document.querySelectorAll(selectors.join(",")).forEach((button) => {
    if (button.classList.contains("admin-icon-button")) return;
    const isDelete = button.matches("[data-delete-book],[data-delete-group],[data-delete-type],[data-delete-cover-color],[data-delete-cover-image],[data-delete-review],[data-delete-moment],[data-delete-banner]");
    button.className = "admin-icon-button";
    button.setAttribute("aria-label", isDelete ? "삭제" : "수정");
    button.textContent = "";
    const icon = document.createElement("img");
    icon.src = `/assets/${isDelete ? "icn_trash.svg" : "icn_edit.svg"}`;
    icon.alt = "";
    button.append(icon);
  });
}
function normalizeAdminPageStructure() {
  const content = document.querySelector(".admin-content");
  if (!content) return;
  content.classList.add("admin-page");
  content.querySelectorAll(":scope .panel.table-wrap").forEach((board) => board.classList.add("admin-board"));
  const title = content.querySelector(":scope h1.admin-title");
  if (!title || content.querySelector(":scope > .admin-page-header")) return;
  const titleParent = title.parentElement;
  const existingHeader = title.closest(".inline")?.parentElement === content ? title.closest(".inline") : null;
  if (existingHeader) {
    existingHeader.classList.add("admin-page-header");
    const kicker = existingHeader.querySelector(".eyebrow");
    const headingRow = document.createElement("div");
    headingRow.className = "admin-page-heading-row";
    headingRow.append(title);
    existingHeader.querySelectorAll(".button.primary").forEach((button) => { button.classList.remove("primary"); button.classList.add("books-create-button"); headingRow.append(button); });
    existingHeader.replaceChildren();
    if (kicker) { kicker.classList.add("home-recommendation-heading", "admin-label"); kicker.textContent = "Admin"; existingHeader.append(kicker); }
    existingHeader.append(headingRow);
    if (title.textContent.trim() === "질문 관리") title.textContent = "질문관리";
    title.classList.add("books-lead", "admin-page-title");
    normalizeAdminBoardWidth(content);
    return;
  }
  const header = document.createElement("div");
  header.className = "admin-page-header";
  const titleBlock = document.createElement("div");
  titleBlock.className = "admin-page-heading-row";
  const eyebrow = title.previousElementSibling?.classList.contains("eyebrow") ? title.previousElementSibling : null;
  titleBlock.append(title);
  if (eyebrow) { eyebrow.classList.add("home-recommendation-heading", "admin-label"); eyebrow.textContent = "Admin"; header.append(eyebrow); }
  header.append(titleBlock);
  if (titleParent === content) content.insertBefore(header, content.firstChild);
  else content.insertBefore(header, titleParent);
  const kicker = header.querySelector(".eyebrow");
  if (kicker) { kicker.classList.add("home-recommendation-heading"); kicker.textContent = "Admin"; }
  title.classList.add("books-lead", "admin-page-title");
  if (title.textContent.trim() === "질문 관리") title.textContent = "질문관리";
  header.querySelectorAll(".button.primary").forEach((button) => { button.classList.remove("primary"); button.classList.add("books-create-button"); });
  normalizeAdminBoardWidth(content);
}
function normalizeAdminBoardWidth(content) {
  const header = content.querySelector(":scope > .admin-page-header");
  const headingRow = header?.querySelector(":scope > .admin-page-heading-row");
  const board = content.querySelector(":scope > .admin-board");
  if (!header || !headingRow || !board || content.querySelector(":scope > .admin-board-width")) return;
  const boardWidth = document.createElement("div");
  boardWidth.className = "admin-board-width";
  content.insertBefore(boardWidth, board);
  boardWidth.append(headingRow, board);
  const label = header.querySelector(":scope > .admin-label");
  header.replaceChildren();
  if (label) header.append(label);
}
function adminDashboard(d) { const labels = { all:"전체", month:"이번 달", week:"이번 주", today:"오늘", custom:"기간 선택" }; const max = Math.max(1, ...(d.trend || []).map((item) => item.count)); const bars = d.trend?.length ? d.trend.map((item) => `<div class="gift-trend-item" title="${escapeHtml(item.label)}: ${item.count}건"><i style="height:${Math.max(8, item.count / max * 100)}%"></i><span>${escapeHtml(item.label.slice(5))}</span></div>`).join("") : `<p class="empty">해당 기간의 선물 데이터가 없습니다.</p>`; return `<div class="eyebrow">ADMIN</div><div class="admin-page-heading-row"><h1 class="admin-title">대시보드</h1><label class="dashboard-period-label">기간<select data-dashboard-period aria-label="통계 기간"><option value="all" ${d.period === "all" ? "selected" : ""}>전체</option><option value="month" ${d.period === "month" ? "selected" : ""}>이번 달</option><option value="week" ${d.period === "week" ? "selected" : ""}>이번 주</option><option value="today" ${d.period === "today" ? "selected" : ""}>오늘</option><option value="custom" ${d.period === "custom" ? "selected" : ""}>기간 선택</option></select></label></div>${d.period === "custom" ? `<div class="dashboard-custom-period"><input type="date" data-dashboard-from value="${d.from.slice(0,10)}" aria-label="시작일"><span>—</span><input type="date" data-dashboard-to value="${d.to.slice(0,10)}" aria-label="종료일"><button type="button" class="button small" data-dashboard-apply>적용</button></div>` : ""}<div class="admin-dashboard-content"><div class="admin-dashboard-stats gift-dashboard-stats"><div class="admin-dashboard-stat"><b>${d.stats.gifts}</b><span>선물 수</span></div><div class="admin-dashboard-stat"><b>${d.stats.accessRate}%</b><span>접속률</span></div><div class="admin-dashboard-stat"><b>${d.stats.writing}</b><span>작성 중</span></div><div class="admin-dashboard-stat"><b>${d.stats.completed}</b><span>완료</span></div></div><section class="gift-dashboard-section"><h2>선물 추이 <small>${labels[d.period]}</small></h2><div class="gift-trend-chart">${bars}</div></section><section class="gift-dashboard-section"><h2>전달 현황</h2><div class="gift-delivery-stats"><div><b>${d.deliveryCounts.kakao}</b><span>카카오톡</span></div><div><b>${d.deliveryCounts.email}</b><span>이메일</span></div><div><b>${d.deliveryCounts.code}</b><span>코드복사</span></div></div><p class="muted">실제 발송 기능 연결 전에는 기록된 전달 활동만 집계합니다.</p></section></div>`; }
async function adminQuestions() { const [data, groups] = await Promise.all([api("/api/questions"), api("/api/question-groups")]); const typeCode = (name) => ({ Parents:"P", "Single Parent":"SP", Single:"S", Couple:"C" }[name] || name.slice(0, 1).toUpperCase()); const bookTypes = (q) => q.bookTypes?.length === 4 ? "All" : (q.bookTypes || []).map((type) => typeCode(type.name)).join(", ") || "-"; return `<div class="inline" style="justify-content:space-between"><div><div class="eyebrow">ADMIN</div><h1 class="admin-title">질문 관리</h1></div><button class="button primary" data-open-form="question">+ 질문 등록</button></div><div class="panel table-wrap"><table class="table admin-questions-table"><thead><tr><th>번호</th><th>질문내용</th><th>질문설명</th><th>질문그룹</th><th>북타입</th><th>사용</th><th>편집</th></tr></thead><tbody>${data.items.map((q) => `<tr><td>${q.sortOrder}</td><td title="${escapeHtml(q.content)}">${escapeHtml(shortenText(q.content, 20))}</td><td title="${escapeHtml(q.description)}">${escapeHtml(shortenText(q.description, 10))}</td><td>${escapeHtml(q.questionGroupName)}</td><td>${escapeHtml(bookTypes(q))}</td><td><button class="admin-icon-button" data-toggle-question="${q.id}" aria-label="${q.isActive ? "사용 중지" : "사용"}"><img src="/assets/${q.isActive ? "icn_use_active.svg" : "icn_use_inactive.svg"}" alt=""></button></td><td><div class="admin-icon-actions"><button class="admin-icon-button" data-edit-question="${q.id}" aria-label="질문 수정"><img src="/assets/icn_edit.svg" alt=""></button><button class="admin-icon-button" data-delete-question="${q.id}" aria-label="질문 삭제"><img src="/assets/icn_trash.svg" alt=""></button></div></td></tr>`).join("")}</tbody></table></div>`; }
async function adminGroups() { const groups = await api("/api/question-groups"); return `<div class="inline" style="justify-content:space-between"><div><div class="eyebrow">ADMIN</div><h1 class="admin-title">질문그룹 관리</h1></div><button class="button primary" data-open-form="group">+ 그룹 등록</button></div><div class="panel table-wrap"><table class="table"><thead><tr><th>순서</th><th>그룹명</th><th>설명</th><th>질문 수</th><th></th></tr></thead><tbody>${groups.map(g => `<tr><td>${g.sortOrder}</td><td>${escapeHtml(g.name)}</td><td>${escapeHtml(g.description)}</td><td>${g.questionCount}</td><td><div class="admin-icon-actions"><button class="admin-icon-button" data-edit-group="${g.id}" aria-label="질문그룹 수정"><img src="/assets/icn_edit.svg" alt=""></button><button class="admin-icon-button" data-delete-group="${g.id}" aria-label="질문그룹 삭제"><img src="/assets/icn_trash.svg" alt=""></button></div></td></tr>`).join("")}</tbody></table></div>`; }
async function adminTypes() { const types = await api("/api/book-types"); return `<div class="inline" style="justify-content:space-between"><div><div class="eyebrow">ADMIN</div><h1 class="admin-title">북타입 관리</h1></div><button class="button primary" data-open-form="type">+ 북타입 등록</button></div><div class="panel table-wrap"><table class="table admin-book-types-table"><thead><tr><th>순서</th><th>북타입</th><th>설명</th><th>질문그룹</th><th>질문 수</th><th>질문 리스트</th><th>사용</th><th>편집</th></tr></thead><tbody>${types.map(t => `<tr><td>${t.sortOrder}</td><td>${escapeHtml(t.name)}</td><td>${escapeHtml(t.description)}</td><td>${t.questionGroups.map(g => escapeHtml(g.name)).join(" · ") || "-"}</td><td>${t.questionCount}</td><td><button class="button small" data-question-list-type="${t.id}">리스트</button></td><td><button class="admin-icon-button" data-admin-status-toggle="type" data-admin-status-id="${t.id}" aria-label="${t.isActive ? "사용 중지" : "사용"}"><img src="/assets/${t.isActive ? "icn_use_active.svg" : "icn_use_inactive.svg"}" alt=""></button></td><td><div class="admin-icon-actions"><button class="admin-icon-button" data-edit-type="${t.id}" aria-label="북타입 수정"><img src="/assets/icn_edit.svg" alt=""></button><button class="admin-icon-button" data-delete-type="${t.id}" aria-label="북타입 삭제"><img src="/assets/icn_trash.svg" alt=""></button></div></td></tr>`).join("")}</tbody></table></div>`; }
async function openBookTypeQuestionList(typeId) { const type = await api(`/api/book-types/${typeId}`); const groups = await api("/api/question-groups"); const groupSortOrder = new Map(groups.map((group) => [group.id, Number(group.sortOrder || 0)])); const grouped = new Map(); const orderedQuestions = [...(type.questions || [])].sort((a, b) => groupSortOrder.get(a.questionGroupId) - groupSortOrder.get(b.questionGroupId) || Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id) - Number(b.id)); for (const question of orderedQuestions) { const group = groups.find((item) => item.id === question.questionGroupId); if (!grouped.has(question.questionGroupId)) grouped.set(question.questionGroupId, { name: group?.name || "미지정", sortOrder: groupSortOrder.get(question.questionGroupId) || 0, questions: [] }); grouped.get(question.questionGroupId).questions.push(question); } const body = [...grouped.values()].sort((a, b) => a.sortOrder - b.sortOrder).map((group) => `<section class="admin-question-list-group"><h3>${escapeHtml(group.name)}</h3><ul>${group.questions.map((q) => `<li>${escapeHtml(q.content)}</li>`).join("")}</ul></section>`).join("") || `<p class="empty">사용 중인 질문이 없습니다.</p>`; document.body.insertAdjacentHTML("beforeend", `<div class="modal"><div class="modal-box admin-question-list-modal"><div class="inline" style="justify-content:space-between"><h2>${escapeHtml(type.name)} 질문 리스트</h2><button type="button" class="button small" data-close-modal>닫기</button></div><p class="muted">전체 ${type.questions?.length || 0}개</p>${body}</div></div>`); }
async function adminCovers() { const [colors, images] = await Promise.all([api("/api/admin/cover-colors"), api("/api/admin/cover-images")]); const colorRows = colors.length ? colors.map((color) => `<tr><td>${escapeHtml(color.name)}</td><td><span class="admin-cover-color-swatch" style="--cover-admin-color:${escapeHtml(color.colorValue)}"></span>${escapeHtml(color.colorValue)}</td><td>${color.sortOrder}</td><td><button class="admin-icon-button" data-admin-status-toggle="cover-color" data-admin-status-id="${color.id}" aria-label="${color.isActive ? "사용 중지" : "사용"}"><img src="/assets/${color.isActive ? "icn_use_active.svg" : "icn_use_inactive.svg"}" alt=""></button></td><td class="inline"><button class="button small" data-edit-cover-color="${color.id}">수정</button><button class="button small danger" data-delete-cover-color="${color.id}">삭제</button></td></tr>`).join("") : `<tr><td colspan="5" class="empty">등록된 표지 컬러가 없습니다.</td></tr>`; const imageTable = (column) => { const rows = images.filter((image) => Number(image.column) === column); return rows.length ? rows.map((image) => `<tr><td><img class="admin-cover-thumbnail" src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.name)}"></td><td>${escapeHtml(image.name)}</td><td>${image.sortOrder}</td><td><button class="admin-icon-button" data-admin-status-toggle="cover-image" data-admin-status-id="${image.id}" aria-label="${image.isActive ? "사용 중지" : "사용"}"><img src="/assets/${image.isActive ? "icn_use_active.svg" : "icn_use_inactive.svg"}" alt=""></button></td><td class="inline"><button class="button small" data-edit-cover-image="${image.id}">수정</button><button class="button small danger" data-delete-cover-image="${image.id}">삭제</button></td></tr>`).join("") : `<tr><td colspan="5" class="empty">등록된 표지 이미지가 없습니다.</td></tr>`; }; return `<div><div class="inline" style="justify-content:space-between"><div><div class="eyebrow">ADMIN</div><h1 class="admin-title">표지 관리</h1></div><button class="button primary" data-open-form="cover-color">+ 표지 컬러 추가</button></div><div class="panel table-wrap"><h2>표지 컬러</h2><table class="table"><thead><tr><th>컬러명</th><th>컬러값</th><th>순서</th><th>사용</th><th></th></tr></thead><tbody>${colorRows}</tbody></table></div><div class="inline admin-cover-heading"><h2>표지 이미지 1열</h2><button class="button primary" data-open-form="cover-image" data-cover-column="1">+ 1열 이미지 추가</button></div><div class="panel table-wrap"><table class="table admin-cover-images-table"><thead><tr><th>이미지</th><th>이름</th><th>순서</th><th>사용</th><th></th></tr></thead><tbody>${imageTable(1)}</tbody></table></div><div class="inline admin-cover-heading"><h2>표지 이미지 2열</h2><button class="button primary" data-open-form="cover-image" data-cover-column="2">+ 2열 이미지 추가</button></div><div class="panel table-wrap"><table class="table admin-cover-images-table"><thead><tr><th>이미지</th><th>이름</th><th>순서</th><th>사용</th><th></th></tr></thead><tbody>${imageTable(2)}</tbody></table></div></div>`; }
async function adminGifts() { const gifts = await api("/api/admin/gifts"); const typeCode = (name) => ({ Parents:"P", "Single Parent":"SP", Couple:"C", Single:"S" }[name] || name || "-"); const formatDate = (value) => value ? new Date(value).toLocaleDateString("ko-KR") : "-"; const statusLabel = (gift) => gift.progressStatus === "not_accessed" ? "미접속" : gift.progressStatus === "not_started" ? "작성 전" : gift.progressStatus === "completed" ? "완료" : `작성 중 ${gift.progress}%`; return `<div><div class="eyebrow">ADMIN</div><h1 class="admin-title">선물하기</h1><div class="panel table-wrap"><table class="table admin-gifts-table"><thead><tr><th>번호</th><th>보낸 사람</th><th>받는 사람</th><th>책 제목</th><th>북타입</th><th>작성률</th><th>선물일</th><th>상태</th><th>관리</th></tr></thead><tbody>${gifts.length ? gifts.map((gift) => `<tr><td>${gift.id}</td><td>${escapeHtml(gift.sender || "-")}</td><td>${escapeHtml(gift.receiver || "-")}</td><td>${escapeHtml(gift.title || "-")}</td><td>${escapeHtml(typeCode(gift.bookTypeName))}</td><td>${gift.progress}%</td><td>${formatDate(gift.createdAt)}</td><td><span class="status ${gift.progressStatus === "completed" ? "done" : ""}">${statusLabel(gift)}</span></td><td><button class="admin-icon-button" type="button" data-admin-gift-detail="${gift.id}" aria-label="선물 상세 보기"><img src="/assets/icn_edit.svg" alt=""></button></td></tr>`).join("") : `<tr><td colspan="9" class="empty">아직 생성된 선물이 없습니다.</td></tr>`}</tbody></table></div></div>`; }
async function adminPublishing() { const books = await api("/api/admin/books"); return `<div><div class="eyebrow">ADMIN</div><h1 class="admin-title">출판 관리</h1><p class="lead">사용자가 만든 책의 작성 현황과 출판 상태를 확인합니다.</p><div class="panel table-wrap"><table class="table"><thead><tr><th>책 제목</th><th>북타입</th><th>작성 현황</th><th>상태</th><th>출판일</th><th>관리</th></tr></thead><tbody>${books.length ? books.map(book => `<tr><td><b>${escapeHtml(book.title)}</b><br><small class="muted">${escapeHtml(book.sender)} → ${escapeHtml(book.receiver)}</small></td><td>${escapeHtml(book.bookTypeName)}</td><td>${book.completedQuestions}/${book.totalQuestions} · ${book.progress}%</td><td><span class="status ${book.status === "published" ? "done" : ""}">${book.status === "published" ? "출판 완료" : "작성 중"}</span></td><td>${book.publishedAt ? new Date(book.publishedAt).toLocaleDateString("ko-KR") : "-"}</td><td style="vertical-align:middle"><div class="book-management" style="display:flex;align-items:center;gap:8px;white-space:nowrap"><a class="button small" href="#book/${book.id}">책 보기</a>${book.status === "published" ? `<a class="button small" href="/print/${book.id}" data-open-book-output="${book.id}" data-output-type="print" target="_blank">PDF 열기</a>` : `<a class="button small" href="#publish/${book.id}">출판 진행</a>`}<button class="button small danger" data-delete-book="${book.id}">책 삭제</button></div></td></tr>`).join("") : `<tr><td colspan="6" class="empty">아직 생성된 마이북이 없습니다.</td></tr>`}</tbody></table></div></div>`; }
async function adminReviews() { const reviews = await api("/api/admin/home/reviews"); return `<div class="inline" style="justify-content:space-between"><div><div class="eyebrow">ADMIN</div><h1 class="admin-title">Review 관리</h1></div><button class="button primary" data-open-form="review">+ Review 등록</button></div><div class="panel table-wrap"><table class="table"><thead><tr><th>순서</th><th>관계</th><th>작성자</th><th>본문</th><th>상태</th><th></th></tr></thead><tbody>${reviews.length ? reviews.map(review => `<tr><td>${review.sortOrder}</td><td title="${escapeHtml(review.relationship)}">${escapeHtml(shortenText(review.relationship, 10))}</td><td title="${escapeHtml(review.author)}">${escapeHtml(shortenText(review.author, 10))}</td><td title="${escapeHtml(review.body)}">${escapeHtml(shortenText(review.body, 20))}</td><td><button class="admin-icon-button" data-toggle-review="${review.id}" aria-label="${review.isVisible ? "노출 중지" : "노출"}"><img src="/assets/${review.isVisible ? "icn_use_active.svg" : "icn_use_inactive.svg"}" alt=""></button></td><td class="inline"><button class="button small" data-edit-review="${review.id}">수정</button><button class="button small danger" data-delete-review="${review.id}">삭제</button></td></tr>`).join("") : `<tr><td colspan="6" class="empty">등록된 Review가 없습니다.</td></tr>`}</tbody></table></div>`; }
async function adminMoments() { const moments = await api("/api/admin/home/moments"); return `<div class="inline" style="justify-content:space-between"><div><div class="eyebrow">ADMIN</div><h1 class="admin-title">Moments Log 관리</h1></div><button class="button primary" data-open-form="moment">+ Moments 등록</button></div><div class="panel table-wrap"><table class="table"><thead><tr><th>날짜</th><th>시간</th><th>작가</th><th>본문</th><th>상태</th><th></th></tr></thead><tbody>${moments.length ? moments.map(moment => `<tr><td>${moment.momentDate}</td><td>${moment.slotTime}</td><td>${escapeHtml(moment.author)}</td><td>${escapeHtml(moment.body)}</td><td><button class="admin-icon-button" data-toggle-moment="${moment.id}" aria-label="${moment.isVisible ? "노출 중지" : "노출"}"><img src="/assets/${moment.isVisible ? "icn_use_active.svg" : "icn_use_inactive.svg"}" alt=""></button></td><td class="inline"><button class="button small" data-edit-moment="${moment.id}">수정</button><button class="button small danger" data-delete-moment="${moment.id}">삭제</button></td></tr>`).join("") : `<tr><td colspan="6" class="empty">등록된 Moments가 없습니다.</td></tr>`}</tbody></table></div>`; }
async function adminBanners() { const banners = await api("/api/admin/home/banners"); return `<div class="inline" style="justify-content:space-between"><div><div class="eyebrow">ADMIN</div><h1 class="admin-title">메인 배너 관리</h1></div><button class="button primary" data-open-form="banner">+ 배너 등록</button></div><div class="panel table-wrap admin-banner-table-wrap"><table class="table admin-banner-table"><thead><tr><th>미리보기</th><th>위치</th><th>캡션</th><th>링크</th><th>노출</th><th>관리</th></tr></thead><tbody>${banners.length ? banners.map((banner) => `<tr><td><img class="admin-banner-thumbnail" src="${escapeHtml(banner.imageUrl)}" alt="${escapeHtml(banner.caption || "메인 배너")}"></td><td>${banner.position === "left" ? "왼쪽" : "오른쪽"}</td><td class="admin-banner-caption">${escapeHtml(banner.caption || "-")}</td><td class="admin-banner-link-cell">${banner.linkUrl ? escapeHtml(banner.linkUrl) : "-"}</td><td><button class="admin-icon-button" data-toggle-banner="${encodeURIComponent(banner.id)}" aria-label="${banner.isVisible ? "노출 중지" : "노출"}"><img src="/assets/${banner.isVisible ? "icn_use_active.svg" : "icn_use_inactive.svg"}" alt=""></button></td><td><div class="admin-banner-actions"><button class="button small" data-edit-banner="${encodeURIComponent(banner.id)}">수정</button><button class="button small danger" data-delete-banner="${encodeURIComponent(banner.id)}">삭제</button></div></td></tr>`).join("") : `<tr><td colspan="6" class="empty">등록된 메인 배너가 없습니다.</td></tr>`}</tbody></table></div>`; }
async function adminMomentAuthors() { const users = await api("/api/admin/moment-authors"); return `<div><div class="eyebrow">ADMIN</div><h1 class="admin-title">Moments 작가 관리</h1><p class="lead">로그인한 사용자에게 Moments 작성 권한을 부여하거나 해제합니다.</p><div class="panel table-wrap"><table class="table"><thead><tr><th>닉네임</th><th>이메일</th><th>상태</th><th></th></tr></thead><tbody>${users.length ? users.map(user => `<tr data-moment-author-row="${encodeURIComponent(user.id)}"><td><input class="moment-author-name" data-moment-author-name value="${escapeHtml(user.displayName)}" aria-label="${escapeHtml(user.displayName)} 닉네임"></td><td>${escapeHtml(user.email || "-")}</td><td><button class="admin-icon-button" data-toggle-moment-author="${encodeURIComponent(user.id)}" data-active="${user.isActive}" aria-label="${user.isAuthor && user.isActive ? "권한 해제" : "권한 부여"}"><img src="/assets/${user.isAuthor && user.isActive ? "icn_use_active.svg" : "icn_use_inactive.svg"}" alt=""></button></td><td class="inline"><button class="button small primary" data-save-moment-author="${encodeURIComponent(user.id)}" data-active="${user.isActive}">닉네임 저장</button></td></tr>`).join("") : `<tr><td colspan="4" class="empty">Supabase Auth 사용자가 없습니다.</td></tr>`}</tbody></table></div></div>`; }

async function openProtectedBookOutput(bookId, print = false, outputWindow = null) {
  const target = outputWindow || window.open("about:blank", "_blank");
  try {
    const session = await getAuthSession();
    const response = await fetch(`${print ? "/print/" : "/preview/"}${bookId}`, {
      credentials: "same-origin",
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "책을 열 수 없습니다.");
    }
    const html = await response.text();
    const htmlWithOrigin = html.replace('<meta charset="utf-8">', `<meta charset="utf-8"><base href="${location.origin}/">`);
    const outputUrl = URL.createObjectURL(new Blob([htmlWithOrigin], { type: "text/html" }));
    if (target) target.location.href = outputUrl;
    else window.open(outputUrl, "_blank");
    setTimeout(() => URL.revokeObjectURL(outputUrl), 60000);
  } catch (error) {
    target?.close();
    if (outputWindow) throw error;
    toastMsg(error.message);
  }
}

async function onClick(e) {
  const bannerPane = e.target.closest("[data-banner-link]");
  if (bannerPane) { window.location.href = bannerPane.dataset.bannerLink; return; }
  if (state.mobileMenuOpen && !e.target.closest("#topbar [data-mobile-menu-panel], #topbar [data-mobile-menu-toggle]")) closeMobileMenu();
  const el = e.target.closest("[data-go],[data-pick-type],[data-next-create],[data-create-back],[data-create-confirm],[data-gift-pick-type],[data-gift-next],[data-gift-back],[data-gift-create],[data-copy-gift-code],[data-gift-share],[data-open-book-output],[data-gift-logout],[data-save-answer],[data-save-inline-answer],[data-book-page],[data-notewindow-toggle],[data-publish-book],[data-save-cover],[data-delete-publication],[data-delete-book],[data-open-book-delete],[data-confirm-book-delete],[data-open-book-info],[data-confirm-book-info],[data-open-form],[data-question-list-type],[data-edit-question],[data-edit-group],[data-edit-type],[data-edit-cover-color],[data-edit-cover-image],[data-edit-review],[data-edit-moment],[data-edit-banner],[data-admin-gift-detail],[data-dashboard-apply],[data-google-login],[data-kakao-login],[data-naver-login],[data-logout],[data-store-link],[data-mobile-menu-toggle],[data-mobile-story-toggle],[data-mobile-menu-item],[data-author-edit],[data-author-cancel-edit],[data-toggle-question],[data-toggle-review],[data-toggle-moment],[data-toggle-moment-author],[data-save-moment-author],[data-delete-question],[data-delete-group],[data-delete-type],[data-delete-cover-color],[data-delete-cover-image],[data-delete-review],[data-delete-moment],[data-delete-banner],[data-close-modal]"); if (!el) return;
  if (el.dataset.mobileMenuToggle !== undefined) return toggleMobileMenu();
  if (el.dataset.mobileStoryToggle !== undefined) return toggleMobileStory();
  if (el.dataset.storeLink !== undefined) return handleStoreClick(e);
  if (el.dataset.mobileMenuItem !== undefined) closeMobileMenu();
  if (el.dataset.giftPickType) { state.giftCreateType = Number(el.dataset.giftPickType); state.giftCreateStep = 2; return giftCreate(); }
  if (el.dataset.giftNext) { if (!state.giftCreateType) return toastMsg("북타입을 선택하세요."); state.giftCreateStep = Number(el.dataset.giftNext) + 1; return giftCreate(); }
  if ("giftBack" in el.dataset) { captureGiftCover(); state.giftCreateStep = Math.max(1, state.giftCreateStep - 1); return giftCreate(); }
  if ("giftCreate" in el.dataset) return submitGiftCreation(el);
  if ("copyGiftCode" in el.dataset) return copyGiftCode();
  if (el.dataset.giftShare) return shareGift(el.dataset.giftShare);
  if (el.dataset.openBookOutput) { e.preventDefault(); return openProtectedBookOutput(Number(el.dataset.openBookOutput), el.dataset.outputType === "print"); }
  if (el.dataset.adminGiftDetail) return openAdminGiftDetail(el.dataset.adminGiftDetail);
  if (el.dataset.dashboardApply !== undefined) { const box = el.closest(".admin-page") || document; return loadAdminDashboard("custom", box.querySelector("[data-dashboard-from]")?.value, box.querySelector("[data-dashboard-to]")?.value); }
  if ("giftLogout" in el.dataset) {
    try { await api("/api/gifts/logout", { method: "POST" }); state.giftSession = null; location.hash = "#login"; return render(); }
    catch (error) { return toastMsg(error.message); }
  }
  if (el.dataset.go) location.hash = `#${el.dataset.go}`;
  if (el.dataset.pickType) { state.createType = Number(el.dataset.pickType); state.createStep = 2; create(); }
  if ("nextCreate" in el.dataset) { state.createStep++; create(); }
  if ("createBack" in el.dataset) { state.createStep--; create(); }
  if ("createConfirm" in el.dataset) { const created = await api("/api/books", { method: "POST", body: { bookTypeId: state.createType, ...state.bookDraft } }); clearWritingBooksCache(); state.createStep = 1; state.createType = null; state.bookDraft = null; toastMsg("책과 질문 목차를 만들었습니다."); location.hash = `#book/${created.id}`; }
  if (el.dataset.saveAnswer) { const [, bookId, pageParam] = location.hash.slice(1).split("/"); await saveAnswer(Number(bookId), pageQuestionId(pageParam), el.dataset.saveAnswer === "final"); }
  if (el.dataset.bookPage) { const [, bookId] = location.hash.slice(1).split("/"); location.hash = `#book/${bookId}/${el.dataset.bookPage}`; return; }
  if ("notewindowToggle" in el.dataset) { state.bookWritingFull = !state.bookWritingFull; document.body.classList.toggle("book-writing-full-route", state.bookWritingFull); const page = el.closest(".book-detail-page"); page?.classList.toggle("book-writing-full", state.bookWritingFull); const image = el.querySelector("img"); if (image) image.src = `/assets/${state.bookWritingFull ? "notewindow_dashboard.svg" : "notewindow_full.svg"}`; el.setAttribute("aria-label", state.bookWritingFull ? "전체보기" : "작성영역만 보기"); el.setAttribute("aria-pressed", String(state.bookWritingFull)); if (state.bookWritingFull) requestAnimationFrame(() => window.scrollTo(0, 0)); }
  if (el.dataset.saveCover) {
    const page = el.closest("[data-publish-id]");
    const coverColor = page?.querySelector("input[name=coverColor]:checked")?.value || "#FEAAE8";
    const coverImage = page?.querySelector("input[name=coverImage]:checked")?.value || "/assets/cover_girl_02.png";
    try { el.disabled = true; await api(`/api/books/${el.dataset.saveCover}/cover`, { method: "PUT", body: { coverColor, coverImage } }); toastMsg("저장되었습니다."); }
    catch (error) { console.error("[My Story] 표지 저장 실패", error); toastMsg(`저장에 실패했습니다: ${error.message}`); }
    finally { el.disabled = false; }
  }
  if (el.dataset.saveInlineAnswer) { const [, bookId, pageParam] = location.hash.slice(1).split("/"); const questionId = pageQuestionId(pageParam); await saveAnswer(Number(bookId), questionId, true); clearInterval(state.autoSave); state.autoSave = null; await book(Number(bookId), { type: "question", questionId }); }
  if (el.dataset.publishBook) {
    const printWindow = window.open("about:blank", "_blank");
    try {
    const coverColor = document.querySelector("input[name=coverColor]:checked")?.value || "#FEAAE8";
      const coverImage = document.querySelector("input[name=coverImage]:checked")?.value || "/assets/cover_girl_02.png";
      const result = await api(`/api/books/${el.dataset.publishBook}/publish`, { method:"POST", body:{coverStyle:coverImage, coverColor, coverImage} });
      if (!result?.printUrl) throw new Error("PDF 인쇄 주소를 받지 못했습니다.");
      await openProtectedBookOutput(Number(el.dataset.publishBook), true, printWindow);
      toastMsg("PDF 인쇄 화면을 열었습니다.");
      location.hash = "#books";
    } catch (error) {
      printWindow?.close();
      console.error("[My Story] PDF 출판 실패", error);
      toastMsg(`PDF 출판에 실패했습니다: ${error.message}`);
    }
  }
  if (el.dataset.paperBook) toastMsg("종이책 출판 의뢰 기능을 준비하고 있습니다.");
  if (el.dataset.deletePublication) { if (!confirm("출판물을 삭제하시겠습니까? 책과 작성한 답변은 유지되며, 다시 출판할 수 있습니다.")) return; try { await api(`/api/books/${el.dataset.deletePublication}/publish`, { method:"DELETE" }); toastMsg("출판물을 삭제했습니다."); render(); } catch (error) { toastMsg(error.message); } }
  if (el.dataset.deleteBook) { if (!confirm("이 책과 작성한 모든 답변, 출판물이 영구 삭제됩니다. 계속하시겠습니까?")) return; try { await api(`/api/books/${el.dataset.deleteBook}`, { method:"DELETE" }); clearWritingBooksCache(); toastMsg("책을 삭제했습니다."); render(); } catch (error) { toastMsg(error.message); } }
  if (el.dataset.openBookDelete) openBookDeleteModal(el.dataset.openBookDelete);
  if (el.dataset.openBookInfo) openBookInfoModal(el.dataset.openBookInfo);
  if (el.dataset.confirmBookInfo) { const bookId = Number(el.dataset.confirmBookInfo); const [, , pageParam] = location.hash.slice(1).split("/"); const page = pageParam?.startsWith("group-") ? { type: "group", groupId: Number(pageParam.slice(6)) } : pageParam ? { type: "question", questionId: pageQuestionId(pageParam) } : null; try { const form = el.closest("form"); const data = Object.fromEntries(new FormData(form)); await api(`/api/books/${bookId}`, { method: "PUT", body: { title: data.title, sender: data.sender, receiver: data.receiver, introduction: data.introduction } }); document.querySelector(".modal")?.remove(); toastMsg("기본정보를 저장했습니다."); clearInterval(state.autoSave); state.autoSave = null; await book(bookId, page); } catch (error) { toastMsg(error.message); } }
  if (el.dataset.confirmBookDelete) { try { await api(`/api/books/${el.dataset.confirmBookDelete}`, { method:"DELETE" }); clearWritingBooksCache(); document.querySelector(".modal")?.remove(); toastMsg("책을 삭제했습니다."); location.hash = "#books"; } catch (error) { toastMsg(error.message); } }
  if (el.dataset.openForm) openForm(el.dataset.openForm, el.dataset.coverColumn);
  if (el.dataset.questionListType) return openBookTypeQuestionList(el.dataset.questionListType);
  if (el.hasAttribute("data-google-login")) { const client = await ensureAuthClient(); const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/` } }); if (error) toastMsg(error.message); }
  if (el.hasAttribute("data-kakao-login")) { const client = await ensureAuthClient(); const { error } = await client.auth.signInWithOAuth({ provider: "kakao", options: { redirectTo: `${location.origin}/` } }); if (error) toastMsg(error.message); }
  if (el.hasAttribute("data-naver-login")) { window.location.href = "/auth/naver"; return; }
  if ("logout" in el.dataset) { console.debug("[My Story] logout click received", { target: el.outerHTML, currentHash: location.hash }); try { const client = await ensureAuthClient(); console.debug("[My Story] calling Supabase signOut"); const result = await client.auth.signOut(); console.debug("[My Story] signOut result", { error: result.error?.message || null, dataHasSession: Boolean(result.data?.session) }); if (result.error) throw result.error; const sessionAfterSignOut = await getAuthSession(); console.debug("[My Story] session after signOut", { sessionExists: Boolean(sessionAfterSignOut) }); clearWritingBooksCache(); state.authorEditingId = null; if (location.hash === "#home" || location.hash === "") { console.debug("[My Story] rendering logged-out UI"); return render(); } console.debug("[My Story] routing to #home for logged-out UI"); location.hash = "#home"; } catch (error) { console.error("[My Story] logout failed", { name: error.name, message: error.message }); toastMsg(`로그아웃에 실패했습니다: ${error.message}`); } return; }
  if (el.dataset.authorEdit) { state.authorEditingId = Number(el.dataset.authorEdit); return moments(); }
  if ("authorCancelEdit" in el.dataset) { state.authorEditingId = null; return moments(); }
  if (el.dataset.editQuestion) openEdit("question", el.dataset.editQuestion); if (el.dataset.editGroup) openEdit("group", el.dataset.editGroup); if (el.dataset.editType) openEdit("type", el.dataset.editType); if (el.dataset.editCoverColor) openEdit("cover-color", el.dataset.editCoverColor); if (el.dataset.editCoverImage) openEdit("cover-image", el.dataset.editCoverImage); if (el.dataset.editReview) openEdit("review", el.dataset.editReview); if (el.dataset.editMoment) openEdit("moment", el.dataset.editMoment); if (el.dataset.editBanner) openEdit("banner", decodeURIComponent(el.dataset.editBanner));
  if (el.dataset.toggleQuestion) { try { await api(`/api/questions/${el.dataset.toggleQuestion}/toggle-active`, {method:"PATCH"}); render(); } catch (error) { toastMsg(error.message); } }
  if (el.dataset.toggleReview) { try { await api(`/api/admin/home/reviews/${el.dataset.toggleReview}`, {method:"PATCH", body:{action:"toggle-visible"}}); render(); } catch (error) { toastMsg(error.message); } }
  if (el.dataset.toggleMoment) { try { await api(`/api/admin/home/moments/${el.dataset.toggleMoment}`, {method:"PATCH", body:{action:"toggle-visible"}}); render(); } catch (error) { toastMsg(error.message); } }
  if (el.dataset.saveMomentAuthor) { const row = el.closest("[data-moment-author-row]"); const input = row?.querySelector("[data-moment-author-name]"); const displayName = input?.value.trim(); if (!displayName) { toastMsg("닉네임을 입력하세요."); return; } try { await api(`/api/admin/moment-authors/${el.dataset.saveMomentAuthor}`, {method:"PUT", body:{displayName, isActive:el.dataset.active === "true"}}); toastMsg("닉네임을 저장했습니다."); render(); } catch (error) { toastMsg(error.message); } }
  if (el.dataset.toggleMomentAuthor) { try { await api(`/api/admin/moment-authors/${el.dataset.toggleMomentAuthor}`, {method:"PATCH", body:{action:"toggle-active"}}); render(); } catch (error) { toastMsg(error.message); } }
  for (const key of ["question","group","type","cover-color","cover-image","review","moment","banner"]) { const datasetKey = key.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(""); if (el.dataset[`delete${datasetKey}`]) await removeAdmin(key, decodeURIComponent(el.dataset[`delete${datasetKey}`])); }
  if ("closeModal" in el.dataset) document.querySelector(".modal")?.remove();
}

async function onSubmit(e) { if (!e.target.matches("form")) return; e.preventDefault(); const form = e.target; const data = Object.fromEntries(new FormData(form)); try { if (form.dataset.form === "login") { const client = await ensureAuthClient(); const { error } = await client.auth.signInWithPassword({ email: data.email, password: data.password }); if (error) throw error; location.hash = "#home"; return render(); } if (form.dataset.form === "author-moment") { const id = form.dataset.id; await api(`/api/author/moments${id ? `/${id}` : ""}`, {method:id ? "PUT" : "POST", body:{slotTime:data.slotTime, momentDate:data.momentDate, body:data.body, isVisible:true}}); state.authorEditingId = null; toastMsg("Moments를 저장했습니다."); return moments(); } if (form.dataset.form === "create-book") { state.bookDraft = data; state.createStep = 3; return create(); } if (form.dataset.form === "gift-basic") { state.giftDraft = data; state.giftCreateStep = 3; return giftCreate(); } if (form.dataset.form === "admin") { const kind = form.dataset.kind; const id = form.dataset.id; if (kind === "review") { const payload = { ...data, sortOrder:Number(data.sortOrder), isVisible:data.isVisible === "true", variant:data.variant || null }; await api(`/api/admin/home/reviews${id ? `/${id}` : ""}`, {method:id?"PUT":"POST",body:payload}); } else if (kind === "moment") { const payload = { ...data, isVisible:data.isVisible === "true" }; await api(`/api/admin/home/moments${id ? `/${id}` : ""}`, {method:id?"PUT":"POST",body:payload}); } else if (kind === "banner") { const file = form.elements.image?.files?.[0]; const imagePath = file ? (await api("/api/admin/home/banner-upload", {method:"POST", body:{contentType:file.type, data:await readFileAsDataUrl(file)}})).imagePath : data.imagePath; const payload = { imagePath, caption:data.caption, linkUrl:data.linkUrl, position:data.position, isVisible:data.isVisible === "true" }; await api(`/api/admin/home/banners${id ? `/${id}` : ""}`, {method:id?"PUT":"POST",body:payload}); } else if (kind === "cover-color") { const payload = { name:data.name, colorValue:data.colorValue, sortOrder:Number(data.sortOrder), isActive:data.isActive === "true" }; await api(`/api/admin/cover-colors${id ? `/${id}` : ""}`, {method:id?"PUT":"POST",body:payload}); } else if (kind === "cover-image") { const file = form.elements.image?.files?.[0]; const imagePath = file ? (await api("/api/admin/cover-images/upload", {method:"POST", body:{contentType:file.type, data:await readFileAsDataUrl(file)}})).imagePath : data.imagePath; const payload = { name:data.name, imagePath, column:Number(data.column), sortOrder:Number(data.sortOrder), isActive:data.isActive === "true" }; await api(`/api/admin/cover-images${id ? `/${id}` : ""}`, {method:id?"PUT":"POST",body:payload}); } else { const payload = { ...data, sortOrder:Number(data.sortOrder), isActive:data.isActive === "true" }; if (kind === "type") payload.questionGroupIds = [...form.querySelectorAll("input[name=questionGroupIds]:checked")].map(i => Number(i.value)); const endpoint = kind === "question" ? "/api/questions" : kind === "group" ? "/api/question-groups" : "/api/book-types"; await api(`${endpoint}${id ? `/${id}` : ""}`, {method:id?"PUT":"POST",body:payload}); } document.querySelector(".modal")?.remove(); toastMsg("저장했습니다."); return render(); } } catch (error) { toastMsg(error.message); } }

async function saveAnswer(bookId, questionId, final, quiet = false) { const input = document.querySelector("#answerInput"); if (!input) return; await api(`/api/books/${bookId}/answers`, {method:"PUT", body:{questionId, answer:input.value, isFinal:final}}); const label = document.querySelector("#saveState"); if (label) label.textContent = `저장됨 ${new Date().toLocaleTimeString("ko-KR", {hour:"2-digit",minute:"2-digit"})}`; if (!quiet) toastMsg(final ? "저장했습니다." : "자동 저장했습니다."); }

async function openForm(kind, column = "") { if (kind === "banner") return openBannerModal(null); await openModal(kind, null, column); await setNewAdminSortOrder(kind, column); }
async function setNewAdminSortOrder(kind, coverColumn = "") {
  const form = document.querySelector(`form[data-form="admin"][data-kind="${kind}"]`);
  if (form?.dataset.id) return;
  const input = form?.querySelector('input[name="sortOrder"]');
  if (!input) return;
  const endpoints = { question: "/api/questions", group: "/api/question-groups", type: "/api/book-types", review: "/api/admin/home/reviews", "cover-color": "/api/admin/cover-colors", "cover-image": "/api/admin/cover-images" };
  if (!endpoints[kind]) return;
  const response = await api(endpoints[kind]);
  const items = Array.isArray(response) ? response : response.items || [];
  const scopedItems = kind === "question" ? items.filter((item) => item.questionGroupId === Number(form.elements.questionGroupId?.value)) : kind === "cover-image" ? items.filter((item) => Number(item.column) === Number(coverColumn || form.elements.column?.value || 1)) : items;
  input.value = String(Math.max(0, ...scopedItems.map((item) => Number(item.sortOrder) || 0)) + 1);
}
function openBookInfoModal(bookId) { const book = state.currentBook; if (!book || Number(book.id) !== Number(bookId)) return; document.body.insertAdjacentHTML("beforeend", `<div class="modal"><form class="modal-box book-info-modal" data-form="book-info"><div class="inline" style="justify-content:space-between"><h2>기본정보 수정</h2><button type="button" class="button small" data-close-modal>닫기</button></div><label class="field">책 제목<input name="title" value="${escapeHtml(book.title)}" required></label><label class="field">보내는 사람<input name="sender" value="${escapeHtml(book.sender || "")}"></label><label class="field">받는 사람<input name="receiver" value="${escapeHtml(book.receiver || "")}"></label><label class="field">인사말<textarea name="introduction">${escapeHtml(book.introduction || "")}</textarea></label><div class="actions"><button type="button" class="button ghost" data-close-modal>취소</button><button type="button" class="button primary" data-confirm-book-info="${book.id}">저장</button></div></form></div>`); }
function openBannerModal(item) { const fields = `${item?.imageUrl ? `<img class="admin-banner-preview" data-banner-preview src="${escapeHtml(item.imageUrl)}" alt="현재 배너 이미지">` : `<div class="admin-banner-preview admin-banner-preview-empty" data-banner-preview>이미지 미리보기</div>`}<input type="hidden" name="imagePath" value="${escapeHtml(item?.imagePath || "")}"><input type="hidden" name="isVisible" value="${item?.isVisible === false ? "false" : "true"}"><label class="field">이미지<input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" ${item ? "" : "required"}></label><label class="field">캡션<input name="caption" value="${escapeHtml(item?.caption || "")}"></label><label class="field">링크<input type="url" name="linkUrl" value="${escapeHtml(item?.linkUrl || "")}" placeholder="https:// 또는 / 내부 경로"></label><label class="field">위치<select name="position"><option value="left" ${item?.position !== "right" ? "selected" : ""}>왼쪽</option><option value="right" ${item?.position === "right" ? "selected" : ""}>오른쪽</option></select></label>`; document.body.insertAdjacentHTML("beforeend", `<div class="modal"><form class="modal-box admin-banner-modal" data-form="admin" data-kind="banner" data-id="${item?.id || ""}"><div class="inline" style="justify-content:space-between"><h2>메인 배너 ${item ? "수정" : "등록"}</h2><button type="button" class="button small" data-close-modal>닫기</button></div>${fields}<div class="actions"><button type="button" class="button ghost" data-close-modal>취소</button><button class="button primary">저장</button></div></form></div>`); }
function openBookDeleteModal(bookId) { const title = escapeHtml(state.currentBook?.title || "이 책"); document.body.insertAdjacentHTML("beforeend", `<div class="modal"><div class="modal-box"><h2>책을 삭제할까요?</h2><p><b>${title}</b>과 작성한 모든 답변, 출판물이 영구 삭제됩니다.</p><p class="muted">삭제한 내용은 복구할 수 없습니다.</p><div class="actions"><button class="button ghost" data-close-modal>취소</button><button class="button danger" data-confirm-book-delete="${bookId}">삭제하기</button></div></div></div>`); }
async function openEdit(kind, id) { const endpoint = kind === "question" ? "/api/questions" : kind === "group" ? "/api/question-groups" : kind === "type" ? "/api/book-types" : kind === "cover-color" ? "/api/admin/cover-colors" : kind === "cover-image" ? "/api/admin/cover-images" : kind === "review" ? "/api/admin/home/reviews" : "/api/admin/home/moments"; const item = await api(`${kind === "banner" ? "/api/admin/home/banners" : endpoint}/${id}`); if (kind === "banner") return openBannerModal(item); openModal(kind, item); }
async function openModal(kind, item, coverColumn = "") { const groups = ["question", "type"].includes(kind) ? await api("/api/question-groups") : []; const types = ["question", "type"].includes(kind) ? await api("/api/book-types") : []; const nextTypeSortOrder = Math.max(0, ...types.map(type => Number(type.sortOrder) || 0)) + 1; const title = `${item ? "수정" : "등록"}`; let fields = ""; if (kind === "question") fields = `<label class="field">질문 내용<textarea name="content" required>${escapeHtml(item?.content || "")}</textarea></label><label class="field">질문 설명<textarea name="description">${escapeHtml(item?.description || "")}</textarea></label><label class="field">질문 그룹<select name="questionGroupId" required>${groups.map(g=>`<option value="${g.id}" ${item?.questionGroupId===g.id?"selected":""}>${escapeHtml(g.name)}</option>`).join("")}</select></label><span class="field-label">사용 북타입</span><div class="check-grid admin-question-book-types">${types.map(type=>`<label class="check"><input type="checkbox" name="bookTypeIds" value="${type.id}" ${item ? item.bookTypeIds?.includes(type.id) ? "checked" : "" : "checked"}> ${escapeHtml(type.name)}</label>`).join("")}</div><label class="field">질문 순서<input type="number" min="1" name="sortOrder" value="${item?.sortOrder || 1}" required></label><label class="field">사용 여부<select name="isActive"><option value="true" ${item?.isActive!==false?"selected":""}>사용</option><option value="false" ${item?.isActive===false?"selected":""}>미사용</option></select></label>`;
  if (kind === "group") fields = `<label class="field">그룹명<input name="name" value="${escapeHtml(item?.name||"")}" required></label><label class="field">설명<textarea name="description">${escapeHtml(item?.description||"")}</textarea></label><label class="field">정렬순서<input type="number" min="1" name="sortOrder" value="${item?.sortOrder||1}" required></label>`;
  if (kind === "type") { const coverImage = bookTypeDesign(item || { name: "Parents" }).image; const sortOrder = item?.sortOrder || nextTypeSortOrder; fields = `<label class="field">책 제목<input name="name" value="${escapeHtml(item?.name||"")}" required></label><label class="field">한 줄 소개<textarea name="description">${escapeHtml(item?.description||"")}</textarea></label><label class="field">노출 순서<input type="number" min="1" name="sortOrder" value="${sortOrder}" required></label><label class="field">일러스트 이미지<select name="coverImage">${bookTypeIllustrationOptions.map((option) => `<option value="${option.value}" ${coverImage === option.value ? "selected" : ""}>${option.label}</option>`).join("")}</select></label><div class="admin-type-preview" data-type-preview><img data-preview-image src="/assets/${coverImage}" alt="${escapeHtml(item?.name || "Parents")} 유형 일러스트"></div><label class="field">사용 여부<select name="isActive"><option value="true" ${item?.isActive!==false?"selected":""}>사용</option><option value="false" ${item?.isActive===false?"selected":""}>미사용</option></select></label><span class="field-label">포함 질문그룹</span><div class="check-grid">${groups.map(g=>`<label class="check"><input type="checkbox" name="questionGroupIds" value="${g.id}" ${item?.questionGroupIds?.includes(g.id)?"checked":""}> ${escapeHtml(g.name)}</label>`).join("")}</div>`; }
  if (kind === "review") fields = `<label class="field">관계<input name="relationship" value="${escapeHtml(item?.relationship || "")}" required></label><label class="field">작성자<input name="author" value="${escapeHtml(item?.author || "")}" required></label><label class="field">본문<textarea name="body" required>${escapeHtml(item?.body || "")}</textarea></label><label class="field">유형<select name="variant"><option value="" ${!item?.variant?"selected":""}>일반</option><option value="intro" ${item?.variant === "intro"?"selected":""}>소개 카드</option></select></label><label class="field">정렬순서<input type="number" min="1" name="sortOrder" value="${item?.sortOrder || 1}" required></label><label class="field">노출 여부<select name="isVisible"><option value="true" ${item?.isVisible !== false?"selected":""}>노출</option><option value="false" ${item?.isVisible === false?"selected":""}>숨김</option></select></label>`;
  if (kind === "moment") fields = `<label class="field">작가 ID<input name="authorId" value="${escapeHtml(item?.authorId || "")}" required ${item ? "readonly" : ""}></label><label class="field">시간<input type="time" name="slotTime" value="${item?.slotTime || "13:00"}" required ${item ? "readonly" : ""}></label><div class="field"><span>오늘 날짜</span><strong>${escapeHtml(formatMomentTodayLabel(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date())))}</strong></div><label class="field">메모<textarea name="body" required>${escapeHtml(item?.body || "")}</textarea></label><label class="field">노출 여부<select name="isVisible"><option value="true" ${item?.isVisible !== false?"selected":""}>노출</option><option value="false" ${item?.isVisible === false?"selected":""}>숨김</option></select></label>`;
  if (kind === "cover-color") fields = `<label class="field">컬러 이름<input name="name" value="${escapeHtml(item?.name || "")}" required></label><label class="field">컬러 값<input name="colorValue" value="${escapeHtml(item?.colorValue || "#FFFFFF")}" pattern="#[0-9A-Fa-f]{6}" required></label><label class="field">노출 순서<input type="number" min="1" name="sortOrder" value="${item?.sortOrder || 1}" required></label><label class="field">사용 여부<select name="isActive"><option value="true" ${item?.isActive !== false ? "selected" : ""}>사용</option><option value="false" ${item?.isActive === false ? "selected" : ""}>미사용</option></select></label>`;
  if (kind === "cover-image") fields = `<input type="hidden" name="imagePath" value="${escapeHtml(item?.imagePath || "")}">${item?.imageUrl ? `<img class="admin-cover-upload-preview" src="${escapeHtml(item.imageUrl)}" alt="현재 표지 이미지">` : ""}<label class="field">표지 이미지<input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" ${item ? "" : "required"}></label><label class="field">이름<input name="name" value="${escapeHtml(item?.name || "")}" required></label><label class="field">열<select name="column"><option value="1" ${Number(item?.column || coverColumn || 1) === 1 ? "selected" : ""}>1열</option><option value="2" ${Number(item?.column || coverColumn) === 2 ? "selected" : ""}>2열</option></select></label><label class="field">노출 순서<input type="number" min="1" name="sortOrder" value="${item?.sortOrder || 1}" required></label><label class="field">사용 여부<select name="isActive"><option value="true" ${item?.isActive !== false ? "selected" : ""}>사용</option><option value="false" ${item?.isActive === false ? "selected" : ""}>미사용</option></select></label>`;
  document.body.insertAdjacentHTML("beforeend", `<div class="modal"><form class="modal-box" data-form="admin" data-kind="${kind}" data-id="${item?.id||""}" data-cover-color="${item?.coverColor || "#00BC3C"}" data-text-color="${item?.textColor || "#FFFFFF"}"><div class="inline" style="justify-content:space-between"><h2>${kind === "question" ? "질문" : kind === "group" ? "질문그룹" : kind === "type" ? "북타입" : kind === "cover-color" ? "표지 컬러" : kind === "cover-image" ? "표지 이미지" : kind === "moment" ? "Moments" : "Review"} ${title}</h2><button type="button" class="button small" data-close-modal>닫기</button></div>${fields}<div class="actions"><button type="button" class="button ghost" data-close-modal>취소</button><button class="button primary">저장</button></div></form></div>`); }
async function removeAdmin(kind, id) { if (!confirm("정말 삭제하시겠습니까?")) return; const endpoint = kind === "question" ? "/api/questions" : kind === "group" ? "/api/question-groups" : kind === "type" ? "/api/book-types" : kind === "cover-color" ? "/api/admin/cover-colors" : kind === "cover-image" ? "/api/admin/cover-images" : kind === "review" ? "/api/admin/home/reviews" : kind === "moment" ? "/api/admin/home/moments" : "/api/admin/home/banners"; try { await api(`${endpoint}/${id}`, {method:"DELETE"}); toastMsg("삭제했습니다."); render(); } catch (e) { toastMsg(e.message); } }
function updateBookTypePreview(form) { const preview = form.querySelector("[data-type-preview]"); if (!preview) return; const name = form.elements.name.value || "Parents"; const image = form.elements.coverImage.value; const previewImage = preview.querySelector("[data-preview-image]"); previewImage.src = `/assets/${image}`; previewImage.alt = `${name} 유형 일러스트`; }
function onInput(e) { const form = e.target.closest('form[data-kind="type"]'); if (!form) return; if (["coverColor", "textColor"].includes(e.target.name)) { e.target.value = e.target.value.replace(/[^#0-9a-f]/gi, "").replace(/(?!^)#/g, "").slice(0, 7); const preview = form.querySelector("[data-cover-preview]"); if (!preview) return; const coverColor = form.elements.coverColor.value; const textColor = form.elements.textColor.value; preview.style.background = /^#[0-9a-f]{6}$/i.test(coverColor) ? coverColor : "#00BC3C"; preview.style.color = /^#[0-9a-f]{6}$/i.test(textColor) ? textColor : "#FFFFFF"; return; } if (["name", "description"].includes(e.target.name)) updateBookTypePreview(form); }
function onChange(e) {
  if (e.target.matches("[data-dashboard-period]")) { const value = e.target.value; if (value === "custom") return admin("dashboard"); return loadAdminDashboard(value); }
  if (e.target.matches('input[name="coverImage"], input[name="coverColor"], input[name="giftCoverImage"], input[name="giftCoverColor"]')) {
    const page = e.target.closest(".publish-page, .gift-create-page");
    if (!page) return;
    const imageInput = page.querySelector('input[name="coverImage"]:checked, input[name="giftCoverImage"]:checked');
    const image = imageInput?.value;
    const color = page.querySelector('input[name="coverColor"]:checked, input[name="giftCoverColor"]:checked')?.value;
    const preview = page.querySelector("[data-cover-preview]");
    const previewImage = page.querySelector("[data-cover-image]");
    if (preview && color) preview.style.setProperty("--cover-color", color);
    if (previewImage && image) previewImage.src = imageInput?.dataset.imageUrl || (image.startsWith("/") ? image : `/assets/${image}`);
    if (page.matches(".gift-create-page") && image && color) state.giftCover = { image, color };
    return;
  }
  if (e.target.name === "coverImage") return updateBookTypePreview(e.target.form);
  if (e.target.name !== "image" || !e.target.files?.[0]) return;
  const preview = e.target.form?.querySelector("[data-banner-preview]"); if (!preview) return; preview.src = URL.createObjectURL(e.target.files[0]); preview.classList.remove("admin-banner-preview-empty"); preview.textContent = "";
}

async function loadAdminDashboard(period, from = "", to = "") { const query = new URLSearchParams({ period }); if (from) query.set("from", from); if (to) query.set("to", to); try { const data = await api(`/api/admin/dashboard?${query}`); app.innerHTML = `<div class="admin-layout"><nav class="panel side-menu" aria-label="관리자 메뉴"></nav><main class="admin-content">${adminDashboardExpanded(data)}</main></div>`; renderAdminMenu("dashboard"); normalizeAdminPageStructure(); } catch (error) { toastMsg(error.message); } }
async function openAdminGiftDetail(id) { try { const gift = await api(`/api/admin/gifts/${id}`); const methodLabel = { kakao: "카카오톡", email: "이메일", code: "코드복사" }; const history = gift.deliveries?.length ? gift.deliveries.map((item) => `<li>${methodLabel[item.method] || item.method} · ${new Date(item.createdAt).toLocaleString("ko-KR")}</li>`).join("") : "<li>기록된 전달 활동이 없습니다.</li>"; document.body.insertAdjacentHTML("beforeend", `<div class="modal"><div class="modal-box"><div class="inline" style="justify-content:space-between"><h2>선물 상세</h2><button type="button" class="button small" data-close-modal>닫기</button></div><p><b>${escapeHtml(gift.title || "-")}</b></p><p class="muted">${escapeHtml(gift.sender || "-")} → ${escapeHtml(gift.receiver || "-")} · 작성률 ${gift.progress}%</p><h3>전달 활동</h3><ul>${history}</ul><p class="muted">전달 활동 기록만 확인할 수 있으며, 실제 발송 기능은 아직 연결되지 않았습니다.</p></div></div>`); } catch (error) { toastMsg(error.message); } }
function readFileAsDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
async function api(url, options={}) { const headers = {"Content-Type":"application/json", ...(options.headers || {})}; if (url.startsWith("/api/author/") || url.startsWith("/api/admin/") || url.startsWith("/api/books") || url === "/api/auth/me" || url === "/api/gifts") { const session = await getAuthSession(); const accessToken = session?.access_token; console.debug("[My Story] access token diagnostics", { exists: Boolean(accessToken), type: typeof accessToken, length: typeof accessToken === "string" ? accessToken.length : null, segmentCount: typeof accessToken === "string" ? accessToken.split(".").length : null, nonIso88591Count: typeof accessToken === "string" ? [...accessToken].filter((character) => character.charCodeAt(0) > 255).length : null }); if (accessToken) headers.Authorization = `Bearer ${accessToken}`; } const response = await fetch(url, {...options, headers, body:options.body ? JSON.stringify(options.body) : undefined}); const data = await response.json(); if (!response.ok) { const error = new Error(data.error || "요청을 처리할 수 없습니다."); error.status = response.status; throw error; } return data; }
function toastMsg(message) { toast.textContent = message; toast.hidden = false; clearTimeout(toast.timer); toast.timer=setTimeout(()=>toast.hidden=true,2800); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function shortenText(value, length) { const text = String(value || ""); return text.length > length ? `${text.slice(0, length)}…` : text; }
function pageQuestionId(value) { const page = String(value || ""); return Number(page.startsWith("question-") ? page.slice(9) : page); }

function enhanceQuestionGroupModal(form) {
  if (form.dataset.groupImageReady) return;
  form.dataset.groupImageReady = "true";
  const actions = form.querySelector(".actions");
  if (!actions) return;
  actions.insertAdjacentHTML("beforebegin", `<label class="field admin-group-image-field"><span>대표 이미지</span><span class="admin-group-image-control"><input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"><img class="admin-group-image-preview" data-group-image-preview alt="대표 이미지 미리보기"></span><input type="hidden" name="imagePath" value=""></label>`);
  if (!form.dataset.id) return;
  api(`/api/question-groups/${form.dataset.id}`).then((group) => {
    const path = group.imagePath || "";
    const pathInput = form.elements.imagePath;
    const preview = form.querySelector("[data-group-image-preview]");
    if (pathInput) pathInput.value = path;
    if (preview && group.imageUrl) preview.src = group.imageUrl;
  }).catch(() => {});
}

const questionGroupModalObserver = new MutationObserver(() => {
  document.querySelectorAll('form[data-kind="group"]').forEach(enhanceQuestionGroupModal);
});
questionGroupModalObserver.observe(document.body, { childList: true, subtree: true });

document.addEventListener("change", (event) => {
  const input = event.target;
  if (input.name !== "image" || input.form?.dataset.kind !== "group" || !input.files?.[0]) return;
  const preview = input.form.querySelector("[data-group-image-preview]");
  if (preview) preview.src = URL.createObjectURL(input.files[0]);
}, true);

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-toggle-banner]");
  if (!button) return;
  try {
    await api(`/api/admin/home/banners/${decodeURIComponent(button.dataset.toggleBanner)}`, {method:"PATCH", body:{action:"toggle-visible"}});
    render();
  } catch (error) { toastMsg(error.message); }
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-admin-status-toggle]");
  if (!button) return;
  const endpoints = {
    type: `/api/book-types/${button.dataset.adminStatusId}`,
    "cover-color": `/api/admin/cover-colors/${button.dataset.adminStatusId}`,
    "cover-image": `/api/admin/cover-images/${button.dataset.adminStatusId}`,
  };
  const endpoint = endpoints[button.dataset.adminStatusToggle];
  if (!endpoint) return;
  try {
    await api(endpoint, {method:"PATCH", body:{action:"toggle-active"}});
    render();
  } catch (error) { toastMsg(error.message); }
});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!form.matches('form[data-form="admin"][data-kind="group"]')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const data = Object.fromEntries(new FormData(form));
  try {
    const file = form.elements.image?.files?.[0];
    const imagePath = file ? (await api("/api/admin/question-groups/image-upload", { method: "POST", body: { contentType: file.type, data: await readFileAsDataUrl(file) } })).imagePath : data.imagePath || "";
    const payload = { name: data.name, description: data.description, imagePath, sortOrder: Number(data.sortOrder) };
    const endpoint = `/api/question-groups${form.dataset.id ? `/${form.dataset.id}` : ""}`;
    await api(endpoint, { method: form.dataset.id ? "PUT" : "POST", body: payload });
    document.querySelector(".modal")?.remove();
    toastMsg("저장했습니다.");
    render();
  } catch (error) { toastMsg(error.message); }
}, true);

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!form.matches('form[data-form="admin"][data-kind="question"]')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const data = Object.fromEntries(new FormData(form));
  const payload = { ...data, sortOrder: Number(data.sortOrder), isActive: data.isActive === "true", bookTypeIds: [...form.querySelectorAll("input[name=bookTypeIds]:checked")].map((input) => Number(input.value)) };
  try {
    await api(`/api/questions${form.dataset.id ? `/${form.dataset.id}` : ""}`, { method: form.dataset.id ? "PUT" : "POST", body: payload });
    document.querySelector(".modal")?.remove();
    toastMsg("저장했습니다.");
    render();
  } catch (error) { toastMsg(error.message); }
}, true);

function removeAdminStatusSelects() {
  document.querySelectorAll('form[data-form="admin"]').forEach((form) => {
    form.querySelectorAll('select[name="isActive"], select[name="isVisible"]').forEach((select) => {
      const name = select.name;
      const value = select.value;
      const hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = name;
      hidden.value = value || "true";
      select.closest("label.field")?.replaceWith(hidden);
    });
  });
}

const adminStatusSelectObserver = new MutationObserver(removeAdminStatusSelects);
adminStatusSelectObserver.observe(document.body, { childList: true, subtree: true });
removeAdminStatusSelects();

async function profileFinal() {
  const auth = await loadAuthState();
  if (!auth.session) { location.hash = "#login"; return; }
  const gifts = await authedApi("/api/account/gifts");
  const formatDate = (value) => value ? new Date(value).toLocaleDateString("ko-KR") : "-";
  const statusLabel = (gift) => gift.progressStatus === "not_accessed" ? "미접속" : `${gift.progress}%`;
  const rows = gifts.length ? gifts.map((gift) => `<tr><td>${escapeHtml(gift.receiver || "-")}</td><td>${escapeHtml(gift.title || "-")}</td><td><span class="status ${gift.progressStatus === "completed" ? "done" : ""}">${statusLabel(gift)}</span></td><td>${formatDate(gift.createdAt)}</td><td>${gift.previewAllowed ? `<a class="button small" href="/preview/${gift.bookId}" data-open-book-output="${gift.bookId}" data-output-type="preview" target="_blank" rel="noopener">미리보기</a>` : `<button class="button small" type="button" disabled>미리보기 불가</button>`}</td><td><button class="button small" type="button" data-account-gift-detail="${gift.id}">상세보기</button></td><td><button class="button small" type="button" data-account-gift-manage="${gift.id}">관리하기</button></td></tr>`).join("") : `<tr><td colspan="7" class="empty">아직 선물한 이야기가 없습니다.</td></tr>`;
  app.innerHTML = `<section class="profile-page"><div class="eyebrow">PROFILE</div><h1 class="admin-title">${escapeHtml(auth.user?.displayName || "사용자")}</h1><section class="profile-settings"><form class="profile-name-form" data-form="profile"><div class="profile-name-form-row"><input name="displayName" value="${escapeHtml(auth.user?.displayName || "")}" maxlength="40" placeholder="닉네임을 입력하세요" aria-label="닉네임" required><button class="button primary" type="submit">저장</button></div></form></section><section class="profile-gifts admin-content"><div class="admin-page-header"><div class="admin-page-heading-row"><h2 class="books-lead admin-page-title">선물한 목록</h2></div></div><div class="panel table-wrap admin-board"><table class="table admin-gifts-table"><thead><tr><th>받는 사람</th><th>책 제목</th><th>진행상태</th><th>선물일</th><th>미리보기</th><th>상세보기</th><th>관리하기</th></tr></thead><tbody>${rows}</tbody></table></div></section></section>`;
}
document.addEventListener("click", (event) => { const detail = event.target.closest("[data-account-gift-detail]"); if (detail) return openAccountGiftDetail(detail.dataset.accountGiftDetail); const manage = event.target.closest("[data-account-gift-manage]"); if (manage) return openAccountGiftManage(manage.dataset.accountGiftManage); });
async function openAccountGiftDetail(id) { try { const gift = await authedApi(`/api/account/gifts/${id}`); const methods = { kakao: "카카오톡", email: "이메일", code: "코드복사" }; const status = gift.progressStatus === "not_accessed" ? "미접속" : gift.progressStatus === "not_started" ? "작성 전" : gift.progressStatus === "completed" ? "완료" : `작성 중 ${gift.progress}%`; const history = gift.deliveries?.length ? gift.deliveries.map((item) => `<li>${methods[item.method] || item.method} · ${new Date(item.createdAt).toLocaleString("ko-KR")}</li>`).join("") : "<li>기록된 전달 활동이 없습니다.</li>"; document.body.insertAdjacentHTML("beforeend", `<div class="modal"><div class="modal-box"><div class="inline" style="justify-content:space-between"><h2>선물 상세보기</h2><button type="button" class="button small" data-close-modal>닫기</button></div><dl class="gift-detail-list"><dt>받는 사람</dt><dd>${escapeHtml(gift.receiver || "-")}</dd><dt>책 제목</dt><dd>${escapeHtml(gift.title || "-")}</dd><dt>북타입</dt><dd>${escapeHtml(gift.bookTypeName || "-")}</dd><dt>진행상태</dt><dd>${status}</dd><dt>작성률</dt><dd>${gift.progress}%</dd><dt>선물일</dt><dd>${new Date(gift.createdAt).toLocaleString("ko-KR")}</dd><dt>마지막 접속</dt><dd>${gift.lastAccessedAt ? new Date(gift.lastAccessedAt).toLocaleString("ko-KR") : "-"}</dd><dt>최초 전달 방식</dt><dd>${methods[gift.initialDeliveryMethod] || "-"}</dd><dt>미리보기 허용</dt><dd>${gift.previewAllowed ? "허용" : "비허용"}</dd></dl><h3>전달 이력</h3><ul>${history}</ul></div></div>`); } catch (error) { toastMsg(error.message); } }
function openAccountGiftManage(id) { document.body.insertAdjacentHTML("beforeend", `<div class="modal"><div class="modal-box"><div class="inline" style="justify-content:space-between"><h2>선물 관리하기</h2><button type="button" class="button small" data-close-modal>닫기</button></div><p class="muted">선물 재전달 및 접근 관리 기능을 준비하고 있습니다.</p><div class="actions"><button class="button small" type="button" disabled>카카오톡 다시 보내기</button><button class="button small" type="button" disabled>이메일 다시 보내기</button><button class="button small" type="button" disabled>선물코드 복사</button><button class="button small" type="button" disabled>공유링크 재생성</button><button class="button small danger" type="button" disabled>선물 취소</button></div></div></div>`); }

function adminTypeFilterSummary(items, filter) {
  const types = [["all", "전체"], ["Parents", "P"], ["Single", "S"], ["Single Parent", "SP"], ["Couple", "C"]];
  return `<div class="admin-type-filter-summary" role="group" aria-label="북타입 필터">${types.map(([value, label]) => `<button type="button" class="admin-type-filter${filter === value ? " active" : ""}" data-admin-type-filter="${value}">${label}${value === "all" ? "" : `(${items.filter((item) => item.bookTypeName === value).length})`}</button>`).join("<span aria-hidden=\"true\">/</span>")}</div>`;
}
function selectedAdminType(items) { return items.filter((item) => !state.adminTypeFilter || state.adminTypeFilter === "all" || item.bookTypeName === state.adminTypeFilter); }
async function adminPublishingFiltered() {
  const books = await api("/api/admin/books"); const visible = selectedAdminType(books);
  return `<div><div class="admin-page-heading-row"><div><div class="eyebrow">ADMIN</div><h1 class="admin-title">출판 관리</h1></div>${adminTypeFilterSummary(books, state.adminTypeFilter || "all")}</div><p class="lead">사용자가 만든 책의 작성 현황과 출판 상태를 확인합니다.</p><div class="panel table-wrap"><table class="table"><thead><tr><th>책 제목</th><th>북타입</th><th>작성 현황</th><th>상태</th><th>출판일</th><th>관리</th></tr></thead><tbody>${visible.length ? visible.map((book) => `<tr><td><b>${escapeHtml(book.title)}</b><br><small class="muted">${escapeHtml(book.sender)} → ${escapeHtml(book.receiver)}</small></td><td>${escapeHtml(book.bookTypeName)}</td><td>${book.completedQuestions}/${book.totalQuestions} · ${book.progress}%</td><td><span class="status ${book.status === "published" ? "done" : ""}">${book.status === "published" ? "출판 완료" : "작성 중"}</span></td><td>${book.publishedAt ? new Date(book.publishedAt).toLocaleDateString("ko-KR") : "-"}</td><td style="vertical-align:middle"><div class="book-management" style="display:flex;align-items:center;gap:8px;white-space:nowrap"><a class="button small" href="#book/${book.id}">책 보기</a>${book.status === "published" ? `<a class="button small" href="/print/${book.id}" data-open-book-output="${book.id}" data-output-type="print" target="_blank">PDF 열기</a>` : `<a class="button small" href="#publish/${book.id}">출판 진행</a>`}<button class="button small danger" data-delete-book="${book.id}">책 삭제</button></div></td></tr>`).join("") : `<tr><td colspan="6" class="empty">조건에 맞는 책이 없습니다.</td></tr>`}</tbody></table></div></div>`;
}
async function adminGiftsFiltered() {
  const gifts = await api("/api/admin/gifts"); const visible = selectedAdminType(gifts); const typeCode = (name) => ({ Parents: "P", "Single Parent": "SP", Couple: "C", Single: "S" }[name] || name || "-"); const formatDate = (value) => value ? new Date(value).toLocaleDateString("ko-KR") : "-"; const statusLabel = (gift) => gift.progressStatus === "not_accessed" ? "미접속" : `${gift.progress}%`;
  return `<div><div class="admin-page-heading-row"><div><div class="eyebrow">ADMIN</div><h1 class="admin-title">선물하기</h1></div>${adminTypeFilterSummary(gifts, state.adminTypeFilter || "all")}</div><div class="panel table-wrap"><table class="table admin-gifts-table"><thead><tr><th>번호</th><th>보낸 사람</th><th>받는 사람</th><th>책 제목</th><th>북타입</th><th>선물일</th><th>상태</th><th>관리</th></tr></thead><tbody>${visible.length ? visible.map((gift) => `<tr><td>${gift.id}</td><td title="${escapeHtml(gift.sender || "-")}">${escapeHtml(shortenText(gift.sender, 6) || "-")}</td><td title="${escapeHtml(gift.receiver || "-")}">${escapeHtml(shortenText(gift.receiver, 6) || "-")}</td><td title="${escapeHtml(gift.title || "-")}">${escapeHtml(shortenText(gift.title, 20) || "-")}</td><td>${escapeHtml(typeCode(gift.bookTypeName))}</td><td>${formatDate(gift.createdAt)}</td><td><span class="status ${gift.progressStatus === "completed" ? "done" : ""}">${statusLabel(gift)}</span></td><td><button class="admin-icon-button" type="button" data-admin-gift-detail="${gift.id}" aria-label="선물 상세 보기"><img src="/assets/icn_edit.svg" alt=""></button></td></tr>`).join("") : `<tr><td colspan="8" class="empty">조건에 맞는 선물이 없습니다.</td></tr>`}</tbody></table></div></div>`;
}
document.addEventListener("click", (event) => { const button = event.target.closest("[data-admin-type-filter]"); if (!button) return; state.adminTypeFilter = button.dataset.adminTypeFilter; render(); });

function adminCommonBoardHeader(title, filter) { return `<div class="admin-page-header"><div class="eyebrow admin-label">ADMIN</div><div class="admin-page-heading-row"><h1 class="admin-title">${title}</h1>${filter}</div></div>`; }
async function adminPublishingHeaderFixed() { const html = await adminPublishingFiltered(); const boardStart = html.indexOf('<div class="panel table-wrap">'); return `${adminCommonBoardHeader("출판관리", html.slice(html.indexOf('<div class="admin-type-filter-summary"'), html.indexOf('</div>', html.indexOf('<div class="admin-type-filter-summary"')) + 6))}${html.slice(boardStart)}`; }
async function adminGiftsHeaderFixed() { const html = await adminGiftsFiltered(); const boardStart = html.indexOf('<div class="panel table-wrap">'); return `${adminCommonBoardHeader("선물관리", html.slice(html.indexOf('<div class="admin-type-filter-summary"'), html.indexOf('</div>', html.indexOf('<div class="admin-type-filter-summary"')) + 6))}${html.slice(boardStart)}`; }

// Dashboard 확장 렌더러: 기존 관리자 스타일과 공통 기간 필터를 재사용한다.
function adminDashboardExpanded(d) {
  const labels = { all: "전체", month: "이번 달", week: "이번 주", today: "오늘", custom: "기간 선택" };
  const max = Math.max(1, ...(d.trend || []).map((item) => item.count));
  const bars = d.trend?.length ? d.trend.map((item) => `<div class="gift-trend-item" title="${escapeHtml(item.label)}: ${item.count}건"><i style="height:${Math.max(8, item.count / max * 100)}%"></i><span>${escapeHtml(item.label.slice(5))}</span></div>`).join("") : `<p class="empty">해당 기간의 선물 데이터가 없습니다.</p>`;
  const stat = (value, label, extra = "") => `<div class="admin-dashboard-stat"><b>${value}</b><span>${label}${extra}</span></div>`;
  const books = d.books || { total: 0, accessRate: 0, writing: 0, completed: 0, shared: null, byType: {} };
  const users = d.users || { total: 0, new: 0, active: 0, gifted: null };
  const typeSummary = [["Parents", "P"], ["Couple", "C"], ["Single Parent", "SP"], ["Single", "S"]].map(([name, code]) => `<span>${name} ${code} ${books.byType?.[name] || 0}</span>`).join("");
  return `<div class="eyebrow">ADMIN</div><div class="admin-page-heading-row"><h1 class="admin-title">대시보드</h1><label class="dashboard-period-label">기간<select data-dashboard-period aria-label="통계 기간"><option value="all" ${d.period === "all" ? "selected" : ""}>전체</option><option value="month" ${d.period === "month" ? "selected" : ""}>이번 달</option><option value="week" ${d.period === "week" ? "selected" : ""}>이번 주</option><option value="today" ${d.period === "today" ? "selected" : ""}>오늘</option><option value="custom" ${d.period === "custom" ? "selected" : ""}>기간 선택</option></select></label></div>${d.period === "custom" ? `<div class="dashboard-custom-period"><input type="date" data-dashboard-from value="${d.from.slice(0, 10)}" aria-label="시작일"><span>—</span><input type="date" data-dashboard-to value="${d.to.slice(0, 10)}" aria-label="종료일"><button type="button" class="button small" data-dashboard-apply>적용</button></div>` : ""}<div class="admin-dashboard-content"><section class="gift-dashboard-section"><h2>선물 현황</h2><div class="admin-dashboard-stats gift-dashboard-stats">${stat(d.stats.gifts, "선물 수")}${stat(`${d.stats.accessRate}%`, "접속률")}${stat(d.stats.writing, "작성 중")}${stat(d.stats.completed, "완료")}</div><h3>선물 추이 <small>${labels[d.period]}</small></h3><div class="gift-trend-chart">${bars}</div><h3>전달 현황</h3><div class="gift-delivery-stats"><div><b>${d.deliveryCounts.kakao}</b><span>카카오톡</span></div><div><b>${d.deliveryCounts.email}</b><span>이메일</span></div><div><b>${d.deliveryCounts.code}</b><span>코드복사</span></div></div></section><section class="gift-dashboard-section"><h2>북 현황</h2><div class="admin-dashboard-stats gift-dashboard-stats">${stat(books.total, "전체 북 수")}${stat(`${books.accessRate}%`, "접속률")}${stat(books.writing, "작성 중")}${stat(books.completed, "완료")}${stat(books.shared === null ? "-" : books.shared, "공유", ` <span class="dashboard-info" title="미리보기 허용" aria-label="미리보기 허용">ⓘ</span>`)}</div><div class="book-type-summary">${typeSummary}</div><p class="muted">공유 수는 미리보기 허용 데이터가 준비된 후 집계됩니다.</p></section><section class="gift-dashboard-section"><h2>사용자 현황</h2><div class="admin-dashboard-stats gift-dashboard-stats">${stat(users.total, "전체 사용자")}${stat(users.new, "신규 사용자")}${stat(users.active, "활성 사용자")}${stat(users.gifted === null ? "-" : users.gifted, "선물받은 사용자")}</div><p class="muted">선물받은 사용자 수는 현재 선물코드 세션에 사용자 식별자가 없어 집계하지 않습니다.</p></section></div>`;
}
