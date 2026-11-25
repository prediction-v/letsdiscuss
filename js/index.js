// ============================================================
// CONFIG — replace with your project values
// ============================================================
const SUPABASE_URL = "https://gqpxnjttwsxlbzogbria.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxcHhuanR0d3N4bGJ6b2dicmlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1OTc0MDYsImV4cCI6MjExMTE3MzQwNn0.erHEfORvQSXWKl6e8knkaPA7N5h2kQXmq-kl0hNXvos";

// ============================================================
// INIT
// ============================================================
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const els = {
  askBox:    document.getElementById("askBox"),
  askForm:   document.getElementById("askForm"),
  qTitle:    document.getElementById("qTitle"),
  qBody:     document.getElementById("qBody"),
  askSubmit: document.getElementById("askSubmit"),
  askError:  document.getElementById("askError"),
  loginHint: document.getElementById("loginHint"),
  search:    document.getElementById("searchInput"),
  feed:      document.getElementById("feed"),
  loading:   document.getElementById("loading"),
  empty:     document.getElementById("empty"),
  loginBtn:  document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
};

let currentUser = null;
let allQuestions = [];

// ============================================================
// AUTH STATE
// ============================================================
async function initAuth() {
  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user ?? null;
  applyAuthUI();

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    applyAuthUI();
  });
}

function applyAuthUI() {
  const loggedIn = !!currentUser;
  els.loginBtn.classList.toggle("hidden", loggedIn);
  els.logoutBtn.classList.toggle("hidden", !loggedIn);
  els.askBox.classList.toggle("hidden", !loggedIn);
  els.loginHint.classList.toggle("hidden", loggedIn);
}

els.logoutBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  await supabase.auth.signOut();
  location.reload();
});

// ============================================================
// LOAD QUESTIONS
// ============================================================
async function loadQuestions() {
  els.loading.classList.remove("hidden");
  els.empty.classList.add("hidden");
  els.feed.querySelectorAll(".q-card").forEach(n => n.remove());

  const { data, error } = await supabase
    .from("questions")
    .select("id, title, body, created_at, author_id, profiles(username)")
    .order("created_at", { ascending: false })
    .limit(50);

  els.loading.classList.add("hidden");

  if (error) {
    console.error(error);
    els.empty.textContent = "Could not load questions. " + error.message;
    els.empty.classList.remove("hidden");
    return;
  }

  allQuestions = data || [];
  renderFeed(allQuestions);
}

function renderFeed(list) {
  els.feed.querySelectorAll(".q-card").forEach(n => n.remove());

  if (!list.length) {
    els.empty.classList.remove("hidden");
    return;
  }
  els.empty.classList.add("hidden");

  const frag = document.createDocumentFragment();
  for (const q of list) {
    frag.appendChild(buildCard(q));
  }
  els.feed.appendChild(frag);
}

function buildCard(q) {
  const a = document.createElement("a");
  a.className = "q-card";
  a.href = `question.html?id=${q.id}`;

  const username = q.profiles?.username || "unknown";

  a.innerHTML = `
    <div class="q-title"></div>
    <div class="q-body"></div>
    <div class="q-meta">
      <span class="author"></span>
      <span class="dot">·</span>
      <span class="time"></span>
    </div>
  `;

  // Safe text assignment (prevents XSS)
  a.querySelector(".q-title").textContent = q.title;
  a.querySelector(".q-body").textContent  = q.body;
  a.querySelector(".author").textContent  = username;
  a.querySelector(".time").textContent    = timeAgo(q.created_at);

  return a;
}

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
// SEARCH (client-side filter)
// ============================================================
els.search.addEventListener("input", () => {
  const term = els.search.value.trim().toLowerCase();
  if (!term) { renderFeed(allQuestions); return; }
  const filtered = allQuestions.filter(q =>
    q.title.toLowerCase().includes(term) ||
    q.body.toLowerCase().includes(term)
  );
  renderFeed(filtered);
});

// ============================================================
// ASK QUESTION
// ============================================================
els.askForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.askError.textContent = "";

  if (!currentUser) {
    els.askError.textContent = "Please log in first.";
    return;
  }

  const title = els.qTitle.value.trim();
  const body  = els.qBody.value.trim();

  if (title.length < 5) {
    els.askError.textContent = "Title needs at least 5 characters.";
    return;
  }
  if (!body) {
    els.askError.textContent = "Body cannot be empty.";
    return;
  }

  els.askSubmit.disabled = true;
  els.askSubmit.textContent = "Posting…";

  const { data, error } = await supabase
    .from("questions")
    .insert({ author_id: currentUser.id, title, body })
    .select("id, title, body, created_at, author_id, profiles(username)")
    .single();

  els.askSubmit.disabled = false;
  els.askSubmit.textContent = "Post";

  if (error) {
    console.error(error);
    els.askError.textContent = error.message;
    return;
  }

  // Prepend to local list + re-render
  allQuestions.unshift(data);
  renderFeed(allQuestions);

  els.qTitle.value = "";
  els.qBody.value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ============================================================
// BOOT
// ============================================================
(async function boot() {
  await initAuth();
  await loadQuestions();
})();
