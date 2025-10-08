/* WellNest - script.js
   Handles:
   - localStorage users & session
   - signup/login/logout
   - dashboard mood tracker (protected)
   - testimonials (seeded + add)
   - landing demo interactions
*/

/* ---------- STORAGE KEYS ---------- */
const USERS_KEY = 'wellnest_users_v1';
const SESSION_KEY = 'wellnest_session_v1';
const ENTRIES_KEY_PREFIX = 'wellnest_entries_user_'; // + username
const TESTIMONIALS_KEY = 'wellnest_testimonials_v1';

/* ---------- UTIL ---------- */
function readJSON(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (e) { return fallback; }
}
function writeJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

/* ---------- USERS & SESSION ---------- */
function getUsers() { return readJSON(USERS_KEY, []); }
function saveUsers(u) { writeJSON(USERS_KEY, u); }

function registerUser({username, email, password}) {
  const users = getUsers();
  if (users.find(x => x.username.toLowerCase() === username.toLowerCase())) return {ok:false, msg:'Username already taken.'};
  if (users.find(x => x.email.toLowerCase() === email.toLowerCase())) return {ok:false, msg:'Email already registered.'};
  users.push({username, email, password}); // demo: storing plaintext (for production, hash & secure)
  saveUsers(users);
  return {ok:true};
}

function loginUser({credential, password}) {
  const users = getUsers();
  const user = users.find(u => u.username.toLowerCase() === credential.toLowerCase() || u.email.toLowerCase() === credential.toLowerCase());
  if (!user) return {ok:false, msg:'No account found with that username/email.'};
  if (user.password !== password) return {ok:false, msg:'Incorrect password.'};
  // set session
  writeJSON(SESSION_KEY, {username: user.username, email: user.email, loggedAt: new Date().toISOString()});
  return {ok:true, user: {username: user.username, email: user.email}};
}
function logout() { localStorage.removeItem(SESSION_KEY); window.location.href = 'index.html'; }
function currentSession() { return readJSON(SESSION_KEY, null); }

/* ---------- ENTRIES per user ---------- */
function entriesKeyForUser(username) { return ENTRIES_KEY_PREFIX + username; }
function loadEntriesFor(username) { return readJSON(entriesKeyForUser(username), []); }
function saveEntriesFor(username, entries) { writeJSON(entriesKeyForUser(username), entries); }

/* ---------- TESTIMONIALS ---------- */
function seedTestimonials() {
  const t = readJSON(TESTIMONIALS_KEY, null);
  if (!t) {
    const seeded = [
      {text: '“WellNest helped me recognize my stress patterns.” — Sam'},
      {text: '“I love how quick and easy check-ins are!” — Noor'},
      {text: '“The weekly chart nudged me to improve my sleep.” — Malik'}
    ];
    writeJSON(TESTIMONIALS_KEY, seeded);
    return seeded;
  }
  return t;
}
function addTestimonial(text, author) {
  const arr = readJSON(TESTIMONIALS_KEY, []);
  const item = {text: `${text} — ${author}`, created: new Date().toISOString()};
  arr.unshift(item);
  writeJSON(TESTIMONIALS_KEY, arr);
  return arr;
}
function getTestimonials() { return readJSON(TESTIMONIALS_KEY, []); }

/* ---------- PAGE BOOTSTRAP ---------- */
document.addEventListener('DOMContentLoaded', () => {
  seedTestimonials();
  const path = document.body.id;

  // Global DOM hooks (if present)
  const authLink = document.getElementById('auth-link');
  const session = currentSession();
  if (authLink) {
    authLink.innerText = session ? session.username + ' • Dashboard' : 'Log In';
    authLink.href = session ? '#' : 'login.html';
  }

  // Page-specific boot
  if (path === 'signup-page') bootSignupPage();
  else if (path === 'login-page') bootLoginPage();
  else if (path === 'index-page') bootIndexPage();
});

/* ---------- SIGNUP PAGE ---------- */
function bootSignupPage() {
  const sBtn = document.getElementById('signupBtn');
  const cancel = document.getElementById('signupCancel');
  const session = currentSession();
  if (session) { window.location.href = 'index.html'; return; }

  sBtn.addEventListener('click', () => {
    const username = document.getElementById('signupUser').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const pass = document.getElementById('signupPass').value;
    const pass2 = document.getElementById('signupPass2').value;

    if (!username || !email || !pass) { alert('Please fill all fields.'); return; }
    if (!email.includes('@')) { alert('Enter a valid email.'); return; }
    if (pass.length < 5) { alert('Password should be at least 5 characters.'); return; }
    if (pass !== pass2) { alert('Passwords do not match.'); return; }

    const r = registerUser({username, email, password: pass});
    if (!r.ok) { alert(r.msg); return; }
    alert('Account created! You will be logged in now.');
    writeJSON(SESSION_KEY, {username, email, loggedAt: new Date().toISOString()});
    // create empty entries storage for user
    saveEntriesFor(username, []);
    window.location.href = 'index.html';
  });

  cancel.addEventListener('click', () => window.location.href = 'index.html');
}

/* ---------- LOGIN PAGE ---------- */
function bootLoginPage() {
  const session = currentSession();
  if (session) { window.location.href = 'index.html'; return; }

  const loginBtn = document.getElementById('loginBtn');
  const back = document.getElementById('backHome');

  loginBtn.addEventListener('click', () => {
    const credential = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    if (!credential || !pass) { alert('Please fill both fields.'); return; }
    const r = loginUser({credential, password: pass});
    if (!r.ok) { alert(r.msg); return; }
    window.location.href = 'index.html';
  });

  back.addEventListener('click', () => window.location.href = 'index.html');
}

/* ---------- INDEX / DASHBOARD PAGE ---------- */
function bootIndexPage() {
  const session = currentSession();
  const landingHero = document.getElementById('landing-hero');
  const dashboard = document.getElementById('dashboard');
  const authLink = document.getElementById('auth-link');

  // If logged in show dashboard
  if (session) {
    landingHero.style.display = 'none';
    dashboard.style.display = 'grid';
    document.getElementById('welcomeChip').innerText = `Welcome, ${session.username}`;
    if (authLink) { authLink.innerText = session.username; authLink.href = '#'; }
    bindDashboard(session.username);
  } else {
    landingHero.style.display = 'grid';
    dashboard.style.display = 'none';
    bindLandingDemo();
  }

  // testimonials rendering (shared)
  renderTestimonials();

  // subscribe (landing & dash)
  const subscribeBtn = document.getElementById('subscribe');
  if (subscribeBtn) {
    subscribeBtn.addEventListener('click', () => {
      const email = document.getElementById('email').value.trim();
      if (!email || !email.includes('@')) { alert('Enter a valid email.'); return; }
      alert('Thanks! This demo does not persist emails.');
      document.getElementById('email').value = '';
    });
  }

  // login & signup shortcuts
  const goSignup = document.getElementById('goSignup');
  if (goSignup) goSignup.addEventListener('click', () => window.location.href = 'signup.html');
  const goLogin = document.getElementById('goLogin');
  if (goLogin) goLogin.addEventListener('click', () => window.location.href = 'login.html');

  // testimonial add modal
  const addTestimonialBtn = document.getElementById('addTestimonialBtn');
  if (addTestimonialBtn) {
    addTestimonialBtn.addEventListener('click', () => openTestimonialModal(session.username));
  }
  // modal controls
  const modal = document.getElementById('modal');
  if (modal) {
    document.getElementById('modalCancel').addEventListener('click', () => { modal.style.display = 'none'; });
    document.getElementById('modalSave').addEventListener('click', () => {
      const txt = document.getElementById('modalText').value.trim();
      if (!txt || txt.length > 200) { alert('Please write a short testimonial (max 200 chars).'); return; }
      addTestimonial(txt, session.username);
      renderTestimonials();
      document.getElementById('modalText').value = '';
      modal.style.display = 'none';
      alert('Thanks — your testimonial was added.');
    });
  }
}

/* ---------- LANDING DEMO: small interactive chart and demo mood */ 
function bindLandingDemo() {
  // simple demo chart using localStorage 'wellnest_demo_entries'
  const DEMO_KEY = 'wellnest_demo_entries';
  if (!readJSON(DEMO_KEY)) {
    // seed a few random demo moods for last 7 days
    const seed = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      seed.push({date: d.toISOString(), mood: Math.ceil(Math.random() * 5)});
    }
    writeJSON(DEMO_KEY, seed);
  }
  // draw chart
  const days = readJSON(DEMO_KEY, []);
  const canvas = document.getElementById('weeklyChartLanding');
  if (canvas) {
    drawChartOnCanvas(canvas, days.map(e => ({date: e.date.slice(0,10), moods: [e.mood]})));
  }
  // weekly summary
  const avg = (days.reduce((a,b)=>a+b.mood,0) / days.length).toFixed(2);
  const last = new Date(days[days.length-1].date).toLocaleString();
  const wa = document.getElementById('weeklyAvgLanding'); if (wa) wa.innerText = avg + ' / 5';
  const le = document.getElementById('lastEntryLanding'); if (le) le.innerText = last;
}

/* ---------- DASHBOARD BINDINGS ---------- */
function bindDashboard(username) {
  // protect: if no session, redirect
  if (!currentSession()) { window.location.href = 'login.html'; return; }

  // logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => { if (confirm('Log out?')) { logout(); } });

  // mood buttons
  const moodBtns = document.querySelectorAll('#moodScale .mood-btn');
  let selectedMood = null;
  moodBtns.forEach(b => b.addEventListener('click', () => {
    moodBtns.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    selectedMood = Number(b.dataset.value);
  }));

  // clear
  const clearBtn = document.getElementById('clearBtn');
  clearBtn.addEventListener('click', () => {
    moodBtns.forEach(x => x.classList.remove('active'));
    selectedMood = null;
    document.getElementById('notes').value = '';
    document.querySelectorAll('#symptomList input').forEach(i => i.checked = false);
  });

  // save
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.addEventListener('click', () => {
    if (!selectedMood) { alert('Select a mood (1–5).'); return; }
    const notes = document.getElementById('notes').value.trim();
    const symptoms = Array.from(document.querySelectorAll('#symptomList input:checked')).map(n => n.value);
    const entries = loadEntriesFor(username);
    const entry = {date: new Date().toISOString(), mood: selectedMood, symptoms, notes};
    entries.push(entry);
    saveEntriesFor(username, entries);
    renderDashboardSummary(username);
    alert('Check-in saved.');
  });

  // keyboard quick pick (1-5)
  document.addEventListener('keydown', (e) => {
    if (['1','2','3','4','5'].includes(e.key)) {
      const btn = document.querySelector(`#moodScale .mood-btn[data-value='${e.key}']`);
      if (btn) btn.click();
    }
  });

  // initial render
  renderDashboardSummary(username);
}

/* ---------- DASHBOARD RENDER ---------- */
function getLastNDaysEntriesForUser(username, n=7) {
  const entries = loadEntriesFor(username);
  const days = [];
  for (let i = n-1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0,10);
    const dayEntries = entries.filter(e => e.date.slice(0,10) === iso).map(e => e.mood);
    days.push({date: iso, moods: dayEntries});
  }
  return days;
}

function renderDashboardSummary(username) {
  const days = getLastNDaysEntriesForUser(username, 7);
  // weekly avg
  let total = 0, count = 0;
  days.forEach(d => { if (d.moods.length) { total += d.moods.reduce((a,b)=>a+b,0); count += d.moods.length; } });
  const avg = count ? (total / count).toFixed(2) : '—';
  const wa = document.getElementById('weeklyAvg'); if (wa) wa.innerText = avg === '—' ? '—' : avg + ' / 5';
  // last entry
  const entries = loadEntriesFor(username);
  const last = entries.length ? new Date(entries[entries.length-1].date).toLocaleString() : '—';
  const le = document.getElementById('lastEntry'); if (le) le.innerText = last;
  // chart
  const canvas = document.getElementById('weeklyChart');
  if (canvas) drawChartOnCanvas(canvas, days);
}

/* ---------- CHART UTILITY (canvas bar chart) ---------- */
function drawChartOnCanvas(canvas, days) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const barW = w / (days.length * 1.6);
  days.forEach((d, i) => {
    const avg = d.moods.length ? d.moods.reduce((a,b)=>a+b,0)/d.moods.length : 0;
    const barH = (avg / 5) * (h - 20);
    const x = 12 + i * (barW * 1.4);
    ctx.fillStyle = '#c8f2e4';
    ctx.fillRect(x, h - 10 - barH, barW, barH);
    ctx.fillStyle = '#0f172a';
    ctx.font = '10px sans-serif';
    ctx.fillText(d.date.slice(5), x, h - 2);
  });
}

/* ---------- TESTIMONIALS UI ---------- */
let testimonialIndex = 0;
function renderTestimonials() {
  const wrap = document.getElementById('testimonialsWrap');
  const list = getTestimonials();
  if (!wrap) return;
  wrap.innerHTML = '';
  if (list.length === 0) {
    wrap.innerHTML = '<div class="testimonial-card">No testimonials yet.</div>';
    return;
  }
  // show one at a time (carousel)
  const t = list[testimonialIndex % list.length];
  const card = document.createElement('div'); card.className = 'testimonial-card';
  card.innerText = t.text || t;
  wrap.appendChild(card);

  // prev / next
  document.getElementById('prevT').onclick = () => { testimonialIndex = (testimonialIndex - 1 + list.length) % list.length; renderTestimonials(); };
  document.getElementById('nextT').onclick = () => { testimonialIndex = (testimonialIndex + 1) % list.length; renderTestimonials(); };
}

/* ---------- MODAL ---------- */
function openTestimonialModal(username) {
  if (!username) { alert('You must be logged in to add a testimonial.'); window.location.href = 'login.html'; return; }
  const modal = document.getElementById('modal');
  document.getElementById('modalTitle').innerText = 'Share your experience';
  document.getElementById('modalText').value = '';
  modal.style.display = 'flex';
}
