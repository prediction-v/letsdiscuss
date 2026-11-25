// ============================================================
// CONFIG
// ============================================================
const SUPABASE_URL = "https://gqpxnjttwsxlbzogbria.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxcHhuanR0d3N4bGJ6b2dicmlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1OTc0MDYsImV4cCI6MjExMTE3MzQwNn0.erHEfORvQSXWKl6e8knkaPA7N5h2kQXmq-kl0hNXvos";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// STATE
// ============================================================
let currentUser = null;
let profile = null;

const els = {
  loggedOut:      document.getElementById("loggedOut"),
  profileContent: document.getElementById("profileContent"),
  avatar:         document.getElementById("avatar"),
  username:       document.getElementById("username"),
  joined:         document.getElementById("joined"),
  questionCount:  document.getElementById("questionCount"),
  answerCount:    document.getElementById("answerCount"),
  qLoading:       document.getElementById("qLoading"),
  qEmpty:         document.getElementById("qEmpty"),
  questionsList:  document.getElementById("questionsList"),
  aLoading:       document.getElementById("aLoading"),
  aEmpty:         document.getElementById("aEmpty"),
  answersList:    document.getElementById("answersList"),
  loginBtn:       document.getElementById("loginBtn"),
  logoutBtn:      document.getElementById("logoutBtn"),
};

// ============================================================
// AUTH
// ============================================================
async function initAuth() {
  const { data } = await sb.auth.getSession();
  currentUser = data.session?.user ?? null;
  applyAuthUI();

  supabase.auth.onAuthStateChange((_e, session) => {
    currentUser = session?.user ?? null;
    applyAuthUI();
    if (currentUser) loadProfileData();
    else showLoggedOut();
  });
}

function applyAuthUI() {
  const loggedIn = !!currentUser;
  els.loginBtn.classList.toggle("hidden", loggedIn);
  els.logoutBtn.classList.toggle("hidden", !loggedIn);
}

els.logoutBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  await supabase.auth.signOut();
  location.href = "index.html";
});

function showLoggedOut() {
  els.loggedOut.classList.remove("hidden");
  els.profileContent.classList.add("hidden");
}

// ============================================================
// LOAD ALL PROFILE DATA
// ============================================================
async function loadProfileData() {
  els.loggedOut.classList.add("hidden");
  els.profileContent.classList.remove("hidden");

  await loadProfile();
  await Promise.all([loadMyQuestions(), loadMyAnswers()]);
}

async function loadProfile() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, created_at")
    .eq("id", currentUser.id)
    .single();

  if (error) {
    console.error(error);
    els.username.textContent = "Error loading profile";
    return;
  }

  profile = data;
  els.username.textContent = profile.username;
  els.avatar.textContent   = profile.username.slice(0, 1).toUpperCase();
  els.joined.textContent   = "Joined " + new Date(profile.created_at).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
}

// ============================================================
// MY QUESTIONS
// ============================================================
async function loadMyQuestions() {
  els.qLoading.classList.remove("hidden");
  els.qEmpty.classList.add("hidden");
  els.questionsList.innerHTML = "";

  const { data, error, count } = await sb
    .from("questions")
    .select("id, title, body, created_at", { count: "exact" })
    .eq("author_id", currentUser.id)
    .order("created_at", { ascending: false });

  els.qLoading.classList.add("hidden");

  if (error) {
    els.qEmpty.textContent = "Could not load questions. " + error.message;
    els.qEmpty.classList.remove("hidden");
    return;
  }

  els.questionCount.textContent = count ?? (data?.length ?? 0);

  if (!data || !data.length) {
    els.qEmpty.classList.remove("hidden");
    return;
  }

  const frag = document.createDocumentFragment();
  for (const q of data) frag.appendChild(buildQuestionRow(q));
  els.questionsList.appendChild(frag);
}

function buildQuestionRow(q) {
  const div = document.createElement("div");
  div.className = "q-card";
  div.dataset.id = q.id;

  div.innerHTML = `
    <div class="q-card-top">
      <div class="q-card-main" style="flex:1;min-width:0;">
        <a class="q-title" href="question.html?id=${q.id}"></a>
        <div class="q-body"></div>
        <div class="q-meta"><span class="time"></span></div>
      </div>
      <button class="delete-btn" type="button">Delete</button>
    </div>
  `;

  div.querySelector(".q-title").textContent = q.title;
  div.querySelector(".q-body").textContent  = q.body;
  div.querySelector(".time").textContent    = timeAgo(q.created_at);

  div.querySelector(".delete-btn").addEventListener("click", () => deleteQuestion(q.id, div));
  return div;
}

async function deleteQuestion(id, rowEl) {
  if (!confirm("Delete this question and all its answers?")) return;

  const btn = rowEl.querySelector(".delete-btn");
  btn.disabled = true;
  btn.textContent = "Deleting…";

  const { error } = await sb
    .from("questions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("Could not delete: " + error.message);
    btn.disabled = false;
    btn.textContent = "Delete";
    return;
  }

  rowEl.remove();
  const remaining = els.questionsList.querySelectorAll(".q-card").length;
  els.questionCount.textContent = remaining;
  if (remaining === 0) els.qEmpty.classList.remove("hidden");

  // Also refresh answers (answers on the deleted question are cascaded in DB)
  loadMyAnswers();
}

// ============================================================
// MY ANSWERS
// ============================================================
async function loadMyAnswers() {
  els.aLoading.classList.remove("hidden");
  els.aEmpty.classList.add("hidden");
  els.answersList.innerHTML = "";

  const { data, error, count } = await sb
    .from("answers")
    .select("id, body, created_at, question_id, questions(id, title)", { count: "exact" })
    .eq("author_id", currentUser.id)
    .order("created_at", { ascending: false });

  els.aLoading.classList.add("hidden");

  if (error) {
    els.aEmpty.textContent = "Could not load answers. " + error.message;
    els.aEmpty.classList.remove("hidden");
    return;
  }

  els.answerCount.textContent = count ?? (data?.length ?? 0);

  if (!data || !data.length) {
    els.aEmpty.classList.remove("hidden");
    return;
  }

  const frag = document.createDocumentFragment();
  for (const a of data) frag.appendChild(buildAnswerRow(a));
  els.answersList.appendChild(frag);
}

function buildAnswerRow(a) {
  const div = document.createElement("div");
  div.className = "a-card";

  div.innerHTML = `
    <div class="a-body"></div>
    <div class="a-meta">
      on <a class="q-link"></a>
      <span class="dot">·</span>
      <span class="time"></span>
    </div>
  `;

  div.querySelector(".a-body").textContent = a.body;

  const link = div.querySelector(".q-link");
  if (a.questions) {
    link.textContent = a.questions.title;
    link.href = `question.html?id=${a.question_id}`;
  } else {
    link.textContent = "(question deleted)";
    link.removeAttribute("href");
  }

  div.querySelector(".time").textContent = timeAgo(a.created_at);
  return div;
}

// ============================================================
// UTIL
// ============================================================
function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ============================================================
// BOOT
// ============================================================
(async function boot() {
  await initAuth();
  if (currentUser) await loadProfileData();
  else showLoggedOut();
})();
