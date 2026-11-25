
// ============================================================
// CONFIG
// ============================================================
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxcHhuanR0d3N4bGJ6b2dicmlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1OTc0MDYsImV4cCI6MjExMTE3MzQwNn0.erHEfORvQSXWKl6e8knkaPA7N5h2kQXmq-kl0hNXvos";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// ELEMENTS
// ============================================================
const els = {
  tabLogin:      document.getElementById("tabLogin"),
  tabSignup:     document.getElementById("tabSignup"),
  loginForm:     document.getElementById("loginForm"),
  signupForm:    document.getElementById("signupForm"),
  loginEmail:    document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginError:    document.getElementById("loginError"),
  loginSubmit:   document.getElementById("loginSubmit"),
  signupUsername:document.getElementById("signupUsername"),
  signupEmail:   document.getElementById("signupEmail"),
  signupPassword:document.getElementById("signupPassword"),
  signupError:   document.getElementById("signupError"),
  signupSubmit:  document.getElementById("signupSubmit"),
};

// ============================================================
// TAB SWITCHING
// ============================================================
function showLogin() {
  els.tabLogin.classList.add("active");
  els.tabSignup.classList.remove("active");
  els.loginForm.classList.remove("hidden");
  els.signupForm.classList.add("hidden");
  els.loginError.textContent = "";
}
function showSignup() {
  els.tabSignup.classList.add("active");
  els.tabLogin.classList.remove("active");
  els.signupForm.classList.remove("hidden");
  els.loginForm.classList.add("hidden");
  els.signupError.textContent = "";
}

els.tabLogin.addEventListener("click", showLogin);
els.tabSignup.addEventListener("click", showSignup);

// ============================================================
// ALREADY LOGGED IN? → redirect to feed
// ============================================================
(async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    window.location.href = "index.html";
  }
})();

// ============================================================
// LOGIN
// ============================================================
els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.loginError.textContent = "";
  els.loginSubmit.disabled = true;
  els.loginSubmit.textContent = "Logging in…";

  const { error } = await supabase.auth.signInWithPassword({
    email: els.loginEmail.value.trim(),
    password: els.loginPassword.value,
  });

  els.loginSubmit.disabled = false;
  els.loginSubmit.textContent = "Log in";

  if (error) {
    els.loginError.textContent = error.message;
    return;
  }

  window.location.href = "index.html";
});

// ============================================================
// SIGNUP
// ============================================================
els.signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.signupError.textContent = "";

  const username = els.signupUsername.value.trim();
  const email    = els.signupEmail.value.trim();
  const password = els.signupPassword.value;

  // Client-side validation
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    els.signupError.textContent =
      "Username must be 3–20 chars: letters, numbers, underscore.";
    return;
  }
  if (password.length < 6) {
    els.signupError.textContent = "Password must be at least 6 characters.";
    return;
  }

  els.signupSubmit.disabled = true;
  els.signupSubmit.textContent = "Creating…";

  // Metadata → picked up by the handle_new_user() trigger
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

  els.signupSubmit.disabled = false;
  els.signupSubmit.textContent = "Sign up";

  if (error) {
    // Common case: username already taken (unique constraint)
    if (/duplicate key|already exists/i.test(error.message)) {
      els.signupError.textContent = "That username is already taken.";
    } else {
      els.signupError.textContent = error.message;
    }
    return;
  }

  // If email confirmation is ON, session will be null.
  if (!data.session) {
    els.signupError.textContent = "";
    els.signupForm.insertAdjacentHTML(
      "beforeend",
      '<p class="success">Account created. Check your email to confirm, then log in.</p>'
    );
    showLogin();
    return;
  }

  // Session created → go to feed
  window.location.href = "index.html";
});
