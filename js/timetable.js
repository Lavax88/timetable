/* ---------- Theme ---------- */
const root = document.documentElement;
const themeToggle = document.getElementById("themeToggle");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
let currentTheme = prefersDark ? "dark" : "light";
applyTheme(currentTheme);

themeToggle.addEventListener("click", () => {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(currentTheme);
});

function applyTheme(theme){
  root.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("timetableTheme", theme);
}

/* ---------- Globals ---------- */
let _ACCENT = null;
let _SUBJECTS = null;
let _events = [];
let _holidays = [];
let _settings = {};
let _lastCheckedDate = new Date().toDateString();

/* ---------- Event helpers ---------- */
const typeCardLabels = {
  exam: 'Upcoming Exam',
  test: 'Upcoming Class Test',
  deadline: 'Pending Assignment',
  general: 'General Event',
  reminder: 'Reminder'
};
const typeShortLabels = {
  exam: 'SERIES',
  test: 'TEST',
  deadline: 'DEADLINE',
  general: 'EVENT',
  reminder: 'REMINDER'
};

function eventKey(ev) { return ev.title + '|' + ev.date; }
function isEventCompleted(ev) {
  try { return JSON.parse(localStorage.getItem('timetableCompleted') || '[]').indexOf(eventKey(ev)) >= 0; }
  catch(e) { return false; }
}
function toggleEventComplete(ev) {
  var key = eventKey(ev);
  var arr = JSON.parse(localStorage.getItem('timetableCompleted') || '[]');
  var idx = arr.indexOf(key);
  if (idx >= 0) { arr.splice(idx, 1); } else { arr.push(key); }
  localStorage.setItem('timetableCompleted', JSON.stringify(arr));
  renderEvents();
}

function subjectAccent(subjectName) {
  if (!subjectName || !_SUBJECTS) return null;
  for (const details of Object.values(_SUBJECTS)) {
    if (details.name === subjectName) {
      return _ACCENT[details.accentKey] || null;
    }
  }
  return null;
}

function createEventCard(ev) {
  const card = document.createElement("div");
  card.className = "card now";

  const subAccent = subjectAccent(ev.subject);
  const accent = subAccent || (_ACCENT && _ACCENT.MAT) || ['#6366f1', '#eef2ff'];
  card.style.setProperty("--card-accent", accent[0]);

  card.dataset.eventDate = ev.date;
  card.dataset.eventType = ev.type;

  const d = new Date(ev.date);
  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const tagLabel = typeCardLabels[ev.type] || 'Event';
  const completedLabels = { exam: 'Completed Exam', test: 'Completed Class Test', deadline: 'Completed Assignment', general: 'Completed Event', reminder: 'Completed Reminder' };
  const canComplete = ev.type === 'deadline' || ev.type === 'reminder';
  const completed = canComplete && isEventCompleted(ev);
  const displayTag = completed ? '✓ ' + (completedLabels[ev.type] || tagLabel) : tagLabel;
  const shortLabel = typeShortLabels[ev.type] || ev.type.toUpperCase();

    let subjLabel = '';
  if (ev.subject && _SUBJECTS) {
    for (const d of Object.values(_SUBJECTS)) {
      if (d.name === ev.subject) { subjLabel = d.chipLabel; break; }
    }
  }
  const mainHeading = ev.title + (subjLabel ? ' (' + subjLabel + ')' : '');

  card.innerHTML = `
    <div class="card-main">
      <div class="card-time" style="flex-basis: 90px;">
        <span class="p-num" style="font-size:15px; color:var(--ink);">${dateStr}</span>
        <span class="p-time" style="font-size: 11px; margin-top:6px; color:var(--ink-soft);">${shortLabel}</span>
      </div>
      <div class="card-body">
        <div class="card-info">
          <span class="now-tag" style="background:${accent[0]}">${displayTag}</span>${canComplete ? ' <button class="complete-btn">' + (completed ? '↩' : '✓') + '</button>' : ''}<br>
          <p class="subj-name" style="margin-top:4px;">${mainHeading}</p>
          <div class="progress-wrap">
            <div class="progress-track"><div class="progress-fill"></div></div>
            <span class="progress-remaining" style="font-variant-numeric: tabular-nums; min-width: 90px;"></span>
          </div>
        </div>
      </div>
    </div>
  `;
  if (canComplete) {
    var btn = card.querySelector('.complete-btn');
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleEventComplete(ev);
    });
  }
  return card;
}


function injectCalendarBadges() {
  document.querySelectorAll('.event-calendar-badge').forEach(el => el.remove());

  const now = new Date();
  const nowDay = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const nowDayName = dayNames[nowDay];

  const monday = new Date(now);
  monday.setDate(now.getDate() - ((nowDay + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  if (!_events || !_events.length) return;

  _events.forEach(ev => {
    if (!ev.subject) return;
    const parts = ev.date.split('-').map(Number);
    const evDate = new Date(parts[0], parts[1] - 1, parts[2]);
    if (evDate < monday || evDate >= nextMonday) return;

    let subjectKey = null;
    for (const [key, details] of Object.entries(_SUBJECTS)) {
      if (details.name === ev.subject) {
        subjectKey = key;
        break;
      }
    }
    if (!subjectKey) return;

    const evDayName = dayNames[evDate.getDay()];
    const panel = document.querySelector('.day-panel[data-day="' + evDayName + '"]');
    if (!panel) return;

    const cards = panel.querySelectorAll('.card[data-subject-key="' + subjectKey + '"]');
    if (!cards.length) return;

    const shortLabel = typeShortLabels[ev.type] || ev.type.toUpperCase();

    cards.forEach(card => {
      if (evDayName === nowDayName) {
        const endMin = Number(card.dataset.endMin);
        if (endMin && nowMinutes >= endMin) return;
      }
      const badge = document.createElement('div');
      badge.className = 'event-calendar-badge';
      badge.textContent = shortLabel + ': ' + ev.title;
      card.querySelector('.subj-sub').after(badge);
    });
  });
}

/* ---------- Events Fetching & Rendering ---------- */
async function loadEvents() {
  try {
    const res = await fetch('/api/events');
    const data = await res.json();
    _events = data.EVENTS || [];
    _holidays = data.HOLIDAYS || [];
    _settings = data.SETTINGS || {};
  } catch (e) {
    console.error('Failed to load events:', e);
    _events = [];
    _holidays = [];
    _settings = {};
  }
  renderEvents();
  checkExamMode();
}

function getFilteredEvents() {
  const nowTime = new Date().getTime();
  const upcoming = _events.filter(ev => {
    const evDate = new Date(ev.date);
    evDate.setHours(13, 30, 0, 0);
    return evDate.getTime() > nowTime;
  }).sort((a,b) => new Date(a.date) - new Date(b.date));
  return {
    exams: upcoming.filter(e => e.type === 'exam'),
    deadlines: upcoming.filter(e => e.type !== 'exam'),
  };
}

function renderEvents() {
  const { exams, deadlines } = getFilteredEvents();

  // Render upcoming tasks section
  const container = document.getElementById('upcomingTasks');
  if (container) {
    container.innerHTML = '';
    if (deadlines.length > 0) {
      container.innerHTML = `<p class="legend-title" style="margin: 0 0 10px 4px;">Urgent Tasks</p>`;
      deadlines.forEach(ev => container.appendChild(createEventCard(ev)));
      const tt = document.createElement('p');
      tt.className = 'legend-title';
      tt.style.cssText = 'margin: 20px 0 10px 4px;';
      tt.textContent = 'Timetable';
      container.appendChild(tt);
    }
  }

  // Render exams tab
  const examsPanel = document.querySelector('.day-panel[data-day="Exams"]');
  if (examsPanel) {
    examsPanel.innerHTML = '';
    if (exams.length === 0) {
      examsPanel.innerHTML = `<div class="free-note">No upcoming exams scheduled. You're safe (for now).</div>`;
    } else {
      exams.forEach(ev => examsPanel.appendChild(createEventCard(ev)));
    }
  }
}

/* ---------- Data Fetching & Initialization ---------- */
async function initTimetableApp() {
  try {
    let data = null;
    const cached = sessionStorage.getItem('timetableData');
    const cachedAt = sessionStorage.getItem('timetableDataAt');
    if (cached && cachedAt && Date.now() - Number(cachedAt) < 300000) {
      data = JSON.parse(cached);
    }
    if (!data) {
      const response = await fetch('/api/data');
      data = await response.json();
      try {
        sessionStorage.setItem('timetableData', JSON.stringify(data));
        sessionStorage.setItem('timetableDataAt', String(Date.now()));
      } catch (e) {}
    }

    _ACCENT = data.ACCENT;
    _SUBJECTS = data.SUBJECTS;
    const SCHEDULE = data.SCHEDULE;

    const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday", "Exams"];

    function fmt(hhmm){
      const [h,m] = hhmm.split(":").map(Number);
      const period = h>=12 ? "PM":"AM";
      let h12 = h%12; if(h12===0) h12=12;
      return `${h12}:${m.toString().padStart(2,"0")} ${period}`;
    }
    function minutesOf(hhmm){ const [h,m]=hhmm.split(":").map(Number); return h*60+m; }
    function minsToLabel(mins){
      if(mins < 60) return `${mins} min`;
      const h = Math.floor(mins/60), m = mins%60;
      return m ? `${h}h ${m}m` : `${h}h`;
    }

    function withBreaks(periods){
      const out = [];
      for(let i=0; i<periods.length; i++){
        out.push(periods[i]);
        if(i < periods.length - 1){
          const gap = minutesOf(periods[i+1][0]) - minutesOf(periods[i][1]);
          if(gap > 5){
            out.push([periods[i][1], periods[i+1][0], "BREAK", minsToLabel(gap)]);
          }
        }
      }
      return out;
    }

    const now = new Date();
    const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const nowDayName = dayNames[now.getDay()];
    const nowMinutes = now.getHours()*60 + now.getMinutes();

    function isSaturdayClassWeek(date){
      const occurrence = Math.ceil(date.getDate() / 7);
      return occurrence === 1 || occurrence === 3;
    }
    function isClassDayToday(day){
      if(day !== nowDayName) return false;
      if(day === "Saturday") return isSaturdayClassWeek(now);
      return true;
    }
    function thisWeeksSaturday(date){
      const daysSinceMonday = (date.getDay() + 6) % 7;
      const offsetToSaturday = 5 - daysSinceMonday;
      const sat = new Date(date);
      sat.setDate(date.getDate() + offsetToSaturday);
      return sat;
    }

    const thisWeekHasNoSaturdayClass = !isSaturdayClassWeek(thisWeeksSaturday(now));

    const tabsEl = document.getElementById("tabs");
    const panelsEl = document.getElementById("panels");

    const indicator = document.createElement("div");
    indicator.className = "tab-indicator";
    indicator.style.transition = "none";
    tabsEl.appendChild(indicator);

    DAYS.forEach((day) => {
      const isToday = day === nowDayName;
      const isClassDay = isClassDayToday(day);
      const isExamsTab = day === "Exams";

      const btn = document.createElement("button");
      btn.className = "tab" + (isToday && !isExamsTab ? " today" : "");
      btn.dataset.day = day;

      const tabLabel = isExamsTab ? "Exams" : day.slice(0,3);
      btn.innerHTML = `${tabLabel}<span class="dot"></span>`;
      btn.onclick = () => selectDay(day);
      tabsEl.appendChild(btn);

      const panel = document.createElement("div");
      panel.className = "day-panel";
      panel.dataset.day = day;

      if (isExamsTab) {
        panel.innerHTML = `<div class="free-note">No upcoming exams scheduled. You're safe (for now).</div>`;
        panelsEl.appendChild(panel);
        return;
      }

      if(day === "Saturday" && thisWeekHasNoSaturdayClass){
        const caution = document.createElement("div");
        caution.className = "caution-banner";
        caution.innerHTML = `⚠️ No classes this Saturday — classes only run on the 1st &amp; 3rd Saturdays of the month.`;
        panel.appendChild(caution);
      }

      const rawPeriods = SCHEDULE[day];
      if(!rawPeriods || rawPeriods.length === 0){
        panel.insertAdjacentHTML('beforeend', `<div class="free-note">No classes scheduled.</div>`);
        panelsEl.appendChild(panel);
        return;
      }

      const periods = withBreaks(rawPeriods);
      let periodCount = 0;

      periods.forEach((p) => {
        const [start, end, key, note, subCount] = p;

        if(key === "BREAK"){
          const isBreakNow = isClassDay && nowMinutes >= minutesOf(start) && nowMinutes < minutesOf(end);
          const card = document.createElement("div");
          card.className = "card break" + (isBreakNow ? " now" : "");
          if(isBreakNow){
            card.dataset.startMin = minutesOf(start);
            card.dataset.endMin = minutesOf(end);
          }
          card.innerHTML = `
            <div class="card-main">
              <div class="card-time">
                <span class="p-time">${fmt(start)}<br>${fmt(end)}</span>
              </div>
              <div class="card-body">
                <div class="card-info">
                  ${isBreakNow ? `<span class="now-tag break-now-tag">Ongoing break</span><br>` : ""}
                  <p class="subj-name">☕ Break</p>
                  <p class="subj-sub">${note} free</p>
                  ${isBreakNow ? `<div class="progress-wrap"><div class="progress-track"><div class="progress-fill"></div></div><span class="progress-remaining"></span></div>` : ""}
                </div>
              </div>
            </div>
          `;
          panel.appendChild(card);
          return;
        }

        periodCount++;
        const subjData = _SUBJECTS[key];
        const subj = { name: subjData.name };
        const accent = _ACCENT[subjData.accentKey];
        const subLine = subjData.subLine;
        const chipLabel = subjData.chipLabel;
        const extraNote = note || "";

        const isNow = isClassDay && nowMinutes >= minutesOf(start) && nowMinutes < minutesOf(end);
        const dividerCount = key === "LABCOMBO" ? (subCount || 1) : 1;
        const dividersHtml = Array.from({ length: dividerCount - 1 }, (_, i) => {
          const pos = ((i + 1) / dividerCount) * 100;
          return `<div class="progress-divider" data-pos="${pos}" style="left:${pos}%"></div>`;
        }).join("");

        const card = document.createElement("div");
        card.className = "card" + (isNow ? " now" : "");
        card.style.setProperty("--card-accent", accent[0]);
        if(isNow){
          card.dataset.startMin = minutesOf(start);
          card.dataset.endMin = minutesOf(end);
        }
        card.dataset.subjectKey = key;

        card.innerHTML = `
          <div class="card-main">
            <div class="card-time">
              <span class="p-time">${fmt(start)}<br>${fmt(end)}</span>
            </div>
            <div class="card-body">
              <div class="card-info">
                ${isNow ? `<span class="now-tag">Ongoing lecture</span><br>` : ""}
                <p class="subj-name">${subj.name}${extraNote ? ` <span style="font-weight:500;color:var(--ink-soft);font-size:13px;">(${extraNote})</span>` : ""}</p>
                <p class="subj-sub">${subLine}</p>
                ${isNow ? `<div class="progress-wrap"><div class="progress-track">${dividersHtml}<div class="progress-fill"></div></div><span class="progress-remaining"></span></div>` : ""}
              </div>
              <div class="fac-chip" style="background:${accent[1]}; color:${accent[0]};">${chipLabel}</div>
            </div>
          </div>
        `;
        panel.appendChild(card);
      });

      panelsEl.appendChild(panel);
    });

    let currentDay = null;
    let isAnimating = false;
    const h1El = document.querySelector("h1");
    const originalH1 = h1El ? h1El.textContent : "Weekly Class Timetable";

    function selectDay(day){
      if(isAnimating) return;
      if (day === "Exams") {
        const { exams } = getFilteredEvents();
        const label = exams.length > 0 ? exams[0].title : "Exam Timetable";
        h1El.textContent = label;
      } else {
        h1El.textContent = originalH1;
      }
      const tasksEl = document.getElementById('upcomingTasks');
      if (tasksEl) tasksEl.style.display = day === 'Exams' ? 'none' : '';
      document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.day === day));
      moveIndicator();
      if(day === currentDay) return;

      const newPanel = panelsEl.querySelector(`.day-panel[data-day="${day}"]`);
      if(!newPanel) return;
      if(!currentDay){
        currentDay = day;
        newPanel.classList.add("active");
        return;
      }

      const oldDay = currentDay;
      const oldPanel = panelsEl.querySelector(`.day-panel[data-day="${oldDay}"]`);
      currentDay = day;

      const n = DAYS.length;
      const oldIndex = DAYS.indexOf(oldDay);
      const newIndex = DAYS.indexOf(day);
      const forwardDist = (newIndex - oldIndex + n) % n;
      const backwardDist = (oldIndex - newIndex + n) % n;
      const forward = forwardDist <= backwardDist;

      isAnimating = true;
      const startHeight = panelsEl.offsetHeight;
      panelsEl.style.height = startHeight + "px";
      panelsEl.classList.add("sliding");

      oldPanel.classList.add("sliding-panel");
      newPanel.classList.add("active", "sliding-panel");
      newPanel.style.transition = "none";
      newPanel.style.transform = forward ? "translateX(100%)" : "translateX(-100%)";

      void newPanel.offsetWidth;
      const endHeight = newPanel.scrollHeight;

      requestAnimationFrame(() => {
        newPanel.style.transition = "";
        newPanel.style.transform = "translateX(0)";
        oldPanel.style.transform = forward ? "translateX(-100%)" : "translateX(100%)";
        panelsEl.style.height = endHeight + "px";
      });

      setTimeout(() => {
        oldPanel.classList.remove("active", "sliding-panel");
        oldPanel.style.transform = "";
        newPanel.classList.remove("sliding-panel");
        newPanel.style.transform = "";
        panelsEl.classList.remove("sliding");
        panelsEl.style.height = "";
        isAnimating = false;
      }, 440);
    }

    function moveIndicator(){
      const activeTab = tabsEl.querySelector(".tab.active");
      if(!activeTab) return;
      indicator.style.left = activeTab.offsetLeft + "px";
      indicator.style.width = activeTab.offsetWidth + "px";
    }

    window.addEventListener("resize", moveIndicator);

    /* ---------- Swipe / horizontal scroll to change day ---------- */
    function goToDay(offset){
      if(isAnimating) return;
      const idx = DAYS.indexOf(currentDay);
      const nextIdx = (idx + offset + DAYS.length) % DAYS.length;
      selectDay(DAYS[nextIdx]);
    }

    let touchStartX = 0, touchStartY = 0, touchTracking = false;
    panelsEl.addEventListener("touchstart", (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchTracking = true;
    }, { passive: true });

    panelsEl.addEventListener("touchend", (e) => {
      if(!touchTracking) return;
      touchTracking = false;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const SWIPE_THRESHOLD = 55;
      if(Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.2){
        goToDay(dx < 0 ? 1 : -1);
      }
    }, { passive: true });

    let wheelCooldown = false;
    panelsEl.addEventListener("wheel", (e) => {
      if(Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 24){
        if(wheelCooldown) return;
        wheelCooldown = true;
        goToDay(e.deltaX > 0 ? 1 : -1);
        setTimeout(() => { wheelCooldown = false; }, 550);
      }
    }, { passive: true });

    /* ---------- Legend ---------- */
    const legendEl = document.getElementById("legend");
    data.LEGEND.forEach(([key,name,sub]) => {
      const accent = _ACCENT[key];
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `<span class="legend-swatch" style="background:${accent[0]}"></span>
        <div><b>${name}</b><span>${sub}</span></div>`;
      legendEl.appendChild(item);
    });

    selectDay(DAYS.includes(nowDayName) ? nowDayName : "Monday");
    requestAnimationFrame(() => { indicator.style.transition = ""; });

    setTimeout(() => {
      const nowCard = document.querySelector(".day-panel.active .card.now");
      if(nowCard){
        const rect = nowCard.getBoundingClientRect();
        const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
        if(!inView){
          nowCard.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, 500);

    /* ---------- LIVE PROGRESS TRACKERS ---------- */
    function updateProgressBars(){
      const t = new Date();
      const curMinutes = t.getHours() * 60 + t.getMinutes() + t.getSeconds() / 60;

      const classCards = document.querySelectorAll(".card.now[data-start-min]");
      classCards.forEach(card => {
        const startMin = Number(card.dataset.startMin);
        const endMin = Number(card.dataset.endMin);
        const total = endMin - startMin;
        const elapsed = curMinutes - startMin;
        const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));

        const fill = card.querySelector(".progress-fill");
        const remainingEl = card.querySelector(".progress-remaining");
        if(fill) fill.style.width = pct + "%";

        card.querySelectorAll(".progress-divider").forEach(d => {
          const dividerPos = parseFloat(d.dataset.pos);
          d.classList.toggle("passed", pct >= dividerPos);
        });

        if(remainingEl){
          const minsLeft = Math.max(0, Math.ceil(endMin - curMinutes));
          remainingEl.textContent = minsLeft <= 0 ? "Wrapping up" : `${minsToLabel(minsLeft)} left`;
        }
      });

      const eventCards = document.querySelectorAll(".card.now[data-event-date]");
      eventCards.forEach(card => {
        const evDate = new Date(card.dataset.eventDate);

        if (card.dataset.eventType === 'exam') evDate.setHours(9, 0, 0);
        else evDate.setHours(23, 59, 59);

        const diffMs = evDate - t;
        const fill = card.querySelector(".progress-fill");
        const remainingEl = card.querySelector(".progress-remaining");

        if(diffMs <= 0) {
          if(remainingEl) remainingEl.textContent = "It's Time!";
          if(fill) fill.style.width = "100%";
        } else {
          const d = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const h = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
          const m = Math.floor((diffMs / 1000 / 60) % 60);
          const s = Math.floor((diffMs / 1000) % 60);

          if(remainingEl) {
            if(d > 0) remainingEl.textContent = `${d}d ${h}h left`;
            else if (h > 0) remainingEl.textContent = `${h}h ${m}m left`;
            else remainingEl.textContent = `${m}m ${s}s left!`;
          }

          const totalMs = 14 * 24 * 60 * 60 * 1000;
          const pct = Math.max(0, 100 - ((diffMs / totalMs) * 100));
          if(fill) fill.style.width = Math.min(100, pct) + "%";
        }
      });
      injectCalendarBadges();
    }


    updateProgressBars();

    setInterval(updateProgressBars, 1000);
    setInterval(checkForDateChange, 30000);
    injectCalendarBadges();


    /* ---------- Load events after timetable is ready ---------- */
    await loadEvents();
    injectCalendarBadges();


  } catch (error) {
    console.error("Failed to load timetable data:", error);
    document.getElementById("panels").innerHTML = `<div class="free-note">Error loading schedule. Please check your connection.<br><span style="font-size:12px;color:var(--ds);">${error.message || error}</span></div>`;
  }
}

/* ---------- Exam Mode ---------- */
function checkExamMode() {
  const manualForce = _settings && _settings.forceExamMode === true;
  let autoActive = false;
  let examInfo = null;

  if (!manualForce) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const ev of _events) {
      if (ev.type !== 'exam') continue;
      const evDate = new Date(ev.date);
      evDate.setHours(0, 0, 0, 0);
      if (evDate >= today && evDate <= tomorrow) {
        autoActive = true;
        examInfo = ev;
        break;
      }
    }
  }

  const active = manualForce || autoActive;
  document.body.classList.toggle('exam-mode', active);

  const banner = document.getElementById('examModeBanner');
  const content = document.getElementById('examModeContent');
  if (!banner || !content) return;

  if (active) {
    const reason = manualForce
      ? 'Exam mode manually enabled by admin.'
      : (examInfo
        ? `📝 ${examInfo.title}${examInfo.subject ? ' (' + examInfo.subject + ')' : ''} is scheduled ${new Date(examInfo.date).toDateString() === new Date().toDateString() ? 'today' : 'tomorrow'} — showing exam timetable.`
        : 'Exam mode active.');
    banner.innerHTML = `📌 Exam mode · ${reason}`;

    const examEvents = _events.filter(e => e.type === 'exam').sort((a,b) => new Date(a.date) - new Date(b.date));
    content.innerHTML = '';
    if (examEvents.length === 0) {
      content.innerHTML = `<div class="free-note">No upcoming exams scheduled.</div>`;
    } else {
      examEvents.forEach(ev => content.appendChild(createEventCard(ev)));
    }
  }
}

/* ---------- Midnight crossover ---------- */
function checkForDateChange() {
  const today = new Date().toDateString();
  if (today !== _lastCheckedDate) {
    _lastCheckedDate = today;
    checkExamMode();
  }
}

/* ---------- Auto-refresh events ---------- */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { loadEvents(); checkForDateChange(); }
});

window.checkForDateChange = checkForDateChange;

/* --- Tap title 7 times with 1.5s delay to open admin --- */
let titleClicks = 0;
let clickTimer = null;
document.getElementById('mainTitle').addEventListener('click', () => {
  titleClicks++;
  clearTimeout(clickTimer);
  clickTimer = setTimeout(() => { titleClicks = 0; }, 1500);
  if (titleClicks >= 7) {
    titleClicks = 0;
    window.location.href = 'admin.html';
  }
});

initTimetableApp();
