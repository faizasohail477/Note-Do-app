(() => {
  const STORAGE_KEY = "note-do-tasks.v3";
  const THEME_KEY = "note-do.theme";
  
  // Inspiring English Quotes
  const QUOTES = [
    "Believe you can and you're halfway there.",
    "Your only limit is your mind.",
    "Dream it. Wish it. Do it.",
    "Success starts with self-discipline.",
    "Don't stop when you're tired. Stop when you're done.",
    "Little things make big days.",
    "Stay focused, stay grateful, stay positive.",
    "Action is the foundational key to all success.",
    "Do it with passion or not at all.",
    "Make each day your masterpiece."
  ];

  let tasks = [];
  let filter = "all";
  let search = "";

  const $ = (id) => document.getElementById(id);

  function load() {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) tasks = JSON.parse(raw); } catch {}
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }

  function applyTheme(t) {
    document.documentElement.classList.toggle("dark", t === "dark");
    $("themeToggle").textContent = t === "dark" ? "☀️" : "🌙";
    localStorage.setItem(THEME_KEY, t);
  }
  $("themeToggle").addEventListener("click", () => {
    const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
    applyTheme(next);
  });

  function pickQuote() {
    const randomIndex = Math.floor(Math.random() * QUOTES.length);
    $("quoteText").textContent = QUOTES[randomIndex];
  }

  function requestNotificationPermission() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") showToast("Notifications enabled! 🔔");
      });
    }
  }

  function showToast(msg) {
    const x = $("toast"); x.textContent = msg; x.className = "show";
    setTimeout(() => { x.className = x.className.replace("show", ""); }, 3000);
  }

  function checkReminders() {
    if (Notification.permission !== "granted") return;
    const now = new Date();
    tasks.forEach(t => {
      if (t.done || !t.dueDate) return;
      const due = new Date(t.dueDate);
      if ((due - now) > 0 && (due - now) < 60000) { 
        new Notification("Note & Do Reminder 🔔", { body: `Time for: ${t.text}` });
      }
    });
  }
  setInterval(checkReminders, 30000);

  function visible() {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filter !== "all" && t.category !== filter) return false;
      if (q && !t.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function render() {
    const list = visible();
    const pending = list.filter((t) => !t.done).sort((a, b) => {
       if(!a.dueDate) return 1; if(!b.dueDate) return -1;
       return new Date(a.dueDate) - new Date(b.dueDate);
    });
    const done = list.filter((t) => t.done);

    $("pendingList").innerHTML = "";
    $("doneList").innerHTML = "";
    pending.forEach((t) => $("pendingList").appendChild(renderEntry(t)));
    done.forEach((t) => $("doneList").appendChild(renderEntry(t)));

    $("emptyPending").classList.toggle("hidden", pending.length !== 0);

    const total = tasks.length;
    const completed = tasks.filter((t) => t.done).length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    $("barFill").style.width = pct + "%";
    $("progressText").textContent = `${completed}/${total}`;
  }

  function formatDate(isoString) {
    if (!isoString) return null;
    const d = new Date(isoString);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function renderEntry(t) {
    const li = document.createElement("li");
    li.className = "entry" + (t.done ? " done" : "");
    li.dataset.id = t.id;

    const check = document.createElement("button");
    check.className = "check"; check.textContent = t.done ? "✓" : "";
    check.addEventListener("click", () => toggle(t.id));

    const text = document.createElement("div");
    text.className = "text"; text.textContent = t.text;
    
    // Tap & Hold
    let pressTimer;
    const startPress = (e) => { if(!t.done) pressTimer = setTimeout(() => startEdit(text, t.id), 800); };
    const cancelPress = () => clearTimeout(pressTimer);
    text.addEventListener('mousedown', startPress); text.addEventListener('touchstart', startPress);
    text.addEventListener('mouseup', cancelPress); text.addEventListener('mouseleave', cancelPress); text.addEventListener('touchend', cancelPress);

    const meta = document.createElement("div"); meta.className = "meta";
    const tagsRow = document.createElement("div"); tagsRow.className = "tags-row";

    const cat = document.createElement("span"); cat.className = "cat"; cat.textContent = t.category;
    tagsRow.appendChild(cat);

    if (t.dueDate) {
      const dateSpan = document.createElement("span"); dateSpan.className = "date-badge";
      const dDate = new Date(t.dueDate); if(dDate < new Date() && !t.done) dateSpan.classList.add("overdue");
      dateSpan.innerHTML = `📅 ${formatDate(t.dueDate)}`; tagsRow.appendChild(dateSpan);
    }
    meta.appendChild(tagsRow); text.appendChild(meta);

    const del = document.createElement("button"); del.className = "del"; del.textContent = "✕";
    del.addEventListener("click", () => remove(t.id));

    li.append(check, text, del); return li;
  }

  function startEdit(el, id) {
    el.contentEditable = "true"; el.focus();
    const range = document.createRange(); range.selectNodeContents(el);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);

    const finish = (commit) => {
      el.contentEditable = "false"; el.removeEventListener("blur", onBlur); el.removeEventListener("keydown", onKey);
      if (commit) { const v = el.textContent.trim(); const t = tasks.find((x) => x.id === id); if (t && v) { t.text = v; save(); } }
      render(); 
    };
    const onBlur = () => finish(true);
    const onKey = (e) => { if (e.key === "Enter") { e.preventDefault(); finish(true); } else if (e.key === "Escape") { e.preventDefault(); finish(false); } };
    el.addEventListener("blur", onBlur); el.addEventListener("keydown", onKey);
  }

  function add(text, category, date) {
    tasks.unshift({ id: crypto.randomUUID() || String(Date.now()), text, done: false, category, dueDate: date, createdAt: Date.now() });
    save(); render(); requestNotificationPermission();
  }
  function toggle(id) { const t = tasks.find((x) => x.id === id); if (!t) return; t.done = !t.done; save(); render(); }
  function remove(id) { tasks = tasks.filter((t) => t.id !== id); save(); render(); }

  $("addForm").addEventListener("submit", (e) => {
    e.preventDefault(); const v = $("taskInput").value.trim(); if (!v) return;
    add(v, $("categorySelect").value, $("dateInput").value);
    $("taskInput").value = ""; $("dateInput").value = "";
  });
  $("search").addEventListener("input", (e) => { search = e.target.value; render(); });
  $("filters").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-filter]"); if (!btn) return;
    filter = btn.dataset.filter;
    document.querySelectorAll("#filters .chip").forEach((c) => c.classList.toggle("active", c === btn));
    render();
  });

  load(); applyTheme(localStorage.getItem(THEME_KEY) || "light"); pickQuote(); render();
})();