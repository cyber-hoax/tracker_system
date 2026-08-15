const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatClock(iso, tz) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const grab = (type) => (parts.find((p) => p.type === type) || {}).value || "";
  return {
    heading: `${grab("weekday")} ${grab("day")} ${grab("month")}`,
    time: `${grab("hour")}:${grab("minute")}`,
  };
}

function kindClass(kind, subject) {
  if (subject === "walk" || kind === "walk") return "walk";
  if (subject === "reading" || kind === "reading") return "reading";
  if (kind === "meal") return "meal";
  if (kind === "study") return "study";
  return kind || "buffer";
}

function setStatus(node, message, isError) {
  node.textContent = message;
  node.classList.toggle("error", Boolean(isError));
}

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Request failed");
  }
  return data;
}

function renderBriefing(data) {
  const clock = formatClock(data.now, data.timezone);
  $("clock-day").textContent = clock.heading;
  $("clock-time").textContent = clock.time;
  $("clock-tz").textContent = data.timezone;
  $("phase-line").textContent = `${data.phase.name} · ${data.phase.mix}`;

  const current = data.current;
  const card = $("now-card");
  card.className = "now-card";
  if (current) {
    card.classList.add(`is-${kindClass(current.kind, current.subject)}`);
    $("now-kicker").textContent = data.day_label;
    $("now-title").textContent = current.title;
    $("now-meta").textContent = `${current.start}–${current.end} · ${current.remaining_min} min left · ${current.kind}`;
    $("now-meter").style.width = `${current.progress_pct || 0}%`;
    $("log-subject").value = ["dsa", "lld", "hld", "ai", "reading", "walk", "review"].includes(current.subject)
      ? current.subject
      : "other";
    if (current.remaining_min) {
      document.querySelector('#log-form [name="minutes"]').value = Math.max(5, Math.round(current.minutes / 5) * 5);
    }
  } else {
    $("now-kicker").textContent = data.day_label;
    $("now-title").textContent = "Between blocks";
    $("now-meta").textContent = data.next ? `Next: ${data.next.title} at ${data.next.start}` : "No upcoming block";
    $("now-meter").style.width = "0%";
  }

  $("guidance").innerHTML = (data.guidance || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  $("next-line").textContent = data.next
    ? `Up next: ${data.next.title} at ${data.next.start}–${data.next.end}`
    : "No further blocks today.";

  const nowIso = data.now;
  $("timeline").innerHTML = (data.today || [])
    .map((block) => {
      const currentNow = current && current.start === block.start && current.title === block.title;
      const done = block.end_iso < nowIso && !currentNow;
      return `<li class="${currentNow ? "current" : ""} ${done ? "done" : ""}">
        <span class="when">${block.start}–${block.end}</span>
        <span>${escapeHtml(block.title)}</span>
      </li>`;
    })
    .join("");

  const stats = data.stats || {};
  const dsaTotal = stats.dsa_problems_total || 0;
  const studyH = ((stats.study_minutes_week || 0) / 60).toFixed(1);
  $("stats").innerHTML = `
    <div class="stat"><b>${dsaTotal}</b><span>DSA problems logged</span></div>
    <div class="stat"><b>${stats.dsa_problems_week || 0}</b><span>DSA this week</span></div>
    <div class="stat"><b>${stats.walk_days || 0}/7</b><span>Walk days</span></div>
    <div class="stat"><b>${studyH}h</b><span>Focus hours this week</span></div>
  `;

  if (stats.review) {
    const form = $("review-form");
    form.dsa.value = stats.review.dsa || "";
    form.lld.value = stats.review.lld || "";
    form.hld.value = stats.review.hld || "";
    form.ai.value = stats.review.ai || "";
    form.personal.value = stats.review.personal || "";
  }
}

function renderSessions(payload) {
  const items = payload.recent || [];
  $("recent").innerHTML = items
    .slice(0, 8)
    .map((row) => {
      const when = (row.ts || "").replace("T", " ").slice(0, 16);
      const extra = row.problems_count ? ` · ${row.problems_count} problems` : "";
      return `<li><span class="tag">${escapeHtml(row.subject)}</span>${escapeHtml(when)} · ${row.minutes}m${extra}${row.notes ? " — " + escapeHtml(row.notes) : ""}</li>`;
    })
    .join("");
}

async function refresh() {
  const [briefing, sessions] = await Promise.all([api("/api/briefing"), api("/api/sessions")]);
  renderBriefing(briefing);
  renderSessions(sessions);
}

async function logSession(body) {
  const result = await api("/api/sessions", { method: "POST", body: JSON.stringify(body) });
  renderBriefing(result.briefing);
  await refresh();
}

$("log-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $("log-status");
  try {
    await logSession({
      subject: form.subject.value,
      minutes: Number(form.minutes.value || 0),
      problems_count: Number(form.problems_count.value || 0),
      notes: form.notes.value,
    });
    form.notes.value = "";
    setStatus(status, "Saved.");
  } catch (err) {
    setStatus(status, err.message, true);
  }
});

$("review-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $("review-status");
  try {
    await api("/api/reviews", {
      method: "POST",
      body: JSON.stringify({
        dsa: form.dsa.value,
        lld: form.lld.value,
        hld: form.hld.value,
        ai: form.ai.value,
        personal: form.personal.value,
      }),
    });
    setStatus(status, "Weekly review saved.");
    await refresh();
  } catch (err) {
    setStatus(status, err.message, true);
  }
});

$("log-current").addEventListener("click", () => {
  $("log-form").requestSubmit();
});

$("log-walk").addEventListener("click", async () => {
  await logSession({ subject: "walk", minutes: 20, notes: "20-minute walk" });
  setStatus($("log-status"), "Walk logged.");
});

$("log-reading").addEventListener("click", async () => {
  await logSession({ subject: "reading", minutes: 30, notes: "Reading block" });
  setStatus($("log-status"), "Reading logged.");
});

$("sync-calendar").addEventListener("click", async () => {
  const button = $("sync-calendar");
  const status = $("calendar-status");
  button.disabled = true;
  setStatus(status, "Syncing Apple Calendar…");
  try {
    const result = await api("/api/calendar/sync", { method: "POST", body: "{}" });
    if (result.method === "calendar_app") {
      setStatus(status, `Wrote ${result.event_count} recurring events to “${result.calendar_name}”.`);
    } else {
      setStatus(
        status,
        `Opened Calendar with ${result.event_count} events. Import into “${result.calendar_name}” if asked. ${result.error || ""}`.trim()
      );
    }
  } catch (err) {
    setStatus(status, err.message, true);
  } finally {
    button.disabled = false;
  }
});

refresh();
setInterval(refresh, 30000);
