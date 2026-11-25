// ============================================================
// CONFIG
// ============================================================
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-KEY";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// STATE
// ============================================================
let currentUser = null;
let questionId = null;

const els = {
  questionCard:  document.getElementById("questionCard"),
  qLoading:      document.getElementById("qLoading"),
  answerBox:     document.getElementById("answerBox"),
  answerForm:    document.getElementById("answerForm"),
  answerBody:    document.getElementById("answerBody"),
  answerSubmit:  document.getElementById("answerSubmit"),
  answerError:   document.getElementById("answerError"),
  loginHint:     document.getElementById("loginHint"),
  answersHeading:document.getElementById("answersHeading"),
  answersList:   document.getElementById("answersList"),
  answersEmpty:  document.getElementById("answersEmpty"),
  loginBtn:      document.getElementById("loginBtn"),
  logoutBtn:     document.getElementById("logoutBtn"),
};

// ============================================================
// AUTH
// ============================================================
async function initAuth() {
  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user ?? null;
  applyAuthUI();

  supabase.auth.onAuthStateChange((_e, session) => {
    currentUser = session?.user ?? null;
    applyAuthUI();
  });
}

function applyAuthUI() {
  const loggedIn = !!currentUser;
  els.loginBtn.classList.toggle("hidden", loggedIn);
  els.logoutBtn.classList.toggle("hidden", !loggedIn);
  els.answerBox.classList.toggle("hidden", !loggedIn);
  els.loginHint.classList.toggle("hidden", loggedIn);
}

els.logoutBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  await supabase.auth.signOut();
  location.reload();
});

// ============================================================
// LOAD QUESTION + ANSWERS
// ============================================================
async function loadQuestion() {
  const { data, error } = await supabase
    .from("questions")
    .select("id, title, body, created_at, author_id, profiles(username)")
    .eq("id", questionId)
    .single();

  els.qLoading.remove();

  if (error || !data) {
    els.questionCard.innerHTML = '<p class="empty">Question not found.</p>';
    els.answerBox.classList.add("hidden");
    els.loginHint.classList.add("hidden");
    return;
  }

  document.title = `${data.title} · Let's Discuss`;

  els.questionCard.innerHTML = `
    <h1 class="q-title"></h1>
    <div class="q-body"></div>
    <div class="q-meta">
      <span class="author"></span>
      <span class="dot">·</span>
      <span class="time"></span>
    </div>
  `;
  els.questionCard.querySelector(".q-title").textContent = data.title;
  els.questionCard.querySelector(".q-body").textContent  = data.body;
  els.questionCard.querySelector(".author").textContent  = data.profiles?.username || "unknown";
  els.questionCard.querySelector(".time").textContent    = timeAgo(data.created_at);
}

async function loadAnswers() {
  els.answersList.innerHTML = "";
  els.answersEmpty.classList.add("hidden");

  const { data, error } = await supabase
    .from("answers")
    .select("id, body, created_at, author_id, profiles(username)")
    .eq("question_id", questionId)
    .order("created_at", { ascending: true });

  if (error) {
    els.answersEmpty.textContent = "Could not load answers. " + error.message;
    els.answersEmpty.classList.remove("hidden");
    return;
  }

  const list = data || [];
  els.answersHeading.textContent = list.length
    ? `Answers (${list.length})`
    : "Answers";

  if (!list.length) {
    els.answersEmpty.classList.remove("hidden");
    return;
  }

  const frag = document.createDocumentFragment();
  for (const a of list) frag.appendChild(buildAnswer(a));
  els.answersList.appendChild(frag);
}

function buildAnswer(a) {
  const div = document.createElement("div");
  div.className = "answer-card";
  div.innerHTML = `
    <div class="answer-body"></div>
    <div class="answer-meta">
      <span class="author"></span>
      <span class="dot">·</span>
      <span class="time"></span>
    </div>
  `;
  div.querySelector(".answer-body").textContent = a.body;
  div.querySelector(".author").textContent = a.profiles?.username || "unknown";
  div.querySelector(".time").textContent   = timeAgo(a.created_at);
  return div;
}

// ============================================================
// POST ANSWER
// ============================================================
els.answerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.answerError.textContent = "";

  if (!currentUser) {
    els.answerError.textContent = "Please log in first.";
    return;
  }

  const body = els.answerBody.value.trim();
  if (!body) {
    els.answerError.textContent = "Answer cannot be empty.";
    return;
  }

  els.answerSubmit.disabled = true;
  els.answerSubmit.textContent = "Posting…";

  const { data, error } = await supabase
    .from("answers")
    .insert({
      question_id: questionId,
      author_id: currentUser.id,
      body,
    })
    .select("id, body, created_at, author_id, profiles(username)")
    .single();

  els.answerSubmit.disabled = false;
  els.answerSubmit.textContent = "Post answer";

  if (error) {
    console.error(error);
    els.answerError.textContent = error.message;
    return;
  }

  // Append new answer immediately
  els.answersEmpty.classList.add("hidden");
  els.answersList.appendChild(buildAnswer(data));

  // Update heading count
  const count = els.answersList.querySelectorAll(".answer-card").length;
  els.answersHeading.textContent = `Answers (${count})`;

  els.answerBody.value = "";
});

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
  const params = new URLSearchParams(location.search);
  questionId = params.get("id");

  if (!questionId) {
    els.qLoading.remove();
    els.questionCard.innerHTML = '<p class="empty">No question specified.</p>';
    els.answerBox.classList.add("hidden");
    els.loginHint.classList.add("hidden");
    return;
  }

  await initAuth();
  await loadQuestion();
  await loadAnswers();
})();
