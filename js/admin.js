const lockScreen = document.getElementById('lockScreen');
const eventBuilder = document.getElementById('eventBuilder');
const pwdInput = document.getElementById('password');
const seriesRows = document.getElementById('seriesRows');
const addSeriesRowBtn = document.getElementById('addSeriesRow');
const eventRowsContainer = document.getElementById('eventRows');
const addEventRowBtn = document.getElementById('addEventRow');

document.getElementById('unlockBtn').addEventListener('click', async () => {
  const pwd = pwdInput.value.trim();
  if (!pwd) { alert("Please enter a password."); return; }

  const unlockBtn = document.getElementById('unlockBtn');
  unlockBtn.textContent = "Verifying...";
  unlockBtn.disabled = true;

  try {
    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd, action: 'verify' })
    });
    const result = await res.json();

    if (res.ok) {
      lockScreen.style.display = 'none';
      eventBuilder.style.display = 'flex';
      document.getElementById('holidaysSection').style.display = 'block';
      document.getElementById('examToggleSection').style.display = 'block';
    } else {
      alert(result.error || "Incorrect password.");
      unlockBtn.textContent = "Unlock Dashboard";
      unlockBtn.disabled = false;
    }
  } catch {
    alert("Network error. Check your connection.");
    unlockBtn.textContent = "Unlock Dashboard";
    unlockBtn.disabled = false;
  }
});

function populateSubjectSelect(sel, placeholder) {
  sel.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
  sel.innerHTML += `<option value="">— No subject —</option>`;
  for (const [key, details] of Object.entries(window._subjects || {})) {
    if(key !== "ACT" && key !== "LABCOMBO") {
      const opt = document.createElement('option');
      opt.value = details.name;
      opt.textContent = details.name;
      sel.appendChild(opt);
    }
  }
  sel.innerHTML += `<option value="General">General / Other</option>`;
}

async function loadData() {
  try {
    const [dataRes, eventsRes] = await Promise.all([
      fetch('/api/data'),
      fetch('/api/events?t=' + Date.now())
    ]);
    const data = await dataRes.json();
    let eventsData = { EVENTS: [], HOLIDAYS: [], SETTINGS: {} };
    if (eventsRes.ok) {
      eventsData = await eventsRes.json();
    }
    window._subjects = data.SUBJECTS;
    window._holidays = eventsData.HOLIDAYS || [];
    window._settings = eventsData.SETTINGS || {};

    populateSubjectSelect(document.querySelector('.event-subject'), 'Select a Subject');
    document.querySelectorAll('.series-subject').forEach(sel => populateSubjectSelect(sel, 'Select Subject'));

    renderEventsList(eventsData.EVENTS || []);
    renderHolidaysList();
    initExamModeToggle();
  } catch (err) {
    console.error("Failed to load data", err);
  }
}

function setMinDates() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const min = `${yyyy}-${mm}-${dd}`;
  document.querySelectorAll('.event-date').forEach(el => el.setAttribute('min', min));
  document.getElementById('holidayDate').setAttribute('min', min);
  document.querySelectorAll('.series-date').forEach(el => el.setAttribute('min', min));
}

loadData();
setMinDates();

function updateRowFields(row) {
  const type = row.querySelector('.event-type').value;
  const subjectSel = row.querySelector('.event-subject');
  const titleInp = row.querySelector('.event-title');
  const noSubjNeeded = ['general', 'reminder'].includes(type);
  subjectSel.style.display = noSubjNeeded ? 'none' : '';
  if (noSubjNeeded) {
    subjectSel.value = '';
    titleInp.value = row.querySelector('.event-type').options[row.querySelector('.event-type').selectedIndex].text;
  } else if (subjectSel.value && subjectSel.value !== 'General') {
    titleInp.value = subjectSel.value;
  }
}

document.addEventListener('change', function(e) {
  if (e.target.matches('.event-type')) {
    updateRowFields(e.target.closest('.event-row'));
  }
  if (e.target.matches('.event-subject')) {
    const row = e.target.closest('.event-row');
    const titleInp = row.querySelector('.event-title');
    const type = row.querySelector('.event-type').value;
    if (e.target.value && e.target.value !== 'General' && !['general','reminder'].includes(type)) {
      titleInp.value = e.target.value;
    }
  }
});

function addEventRow() {
  const rows = eventRowsContainer.querySelectorAll('.event-row');
  const template = rows[0].cloneNode(true);
  template.querySelector('.event-subject').value = '';
  template.querySelector('.event-title').value = '';
  template.querySelector('.event-date').value = '';
  const rmBtn = template.querySelector('.event-remove-btn');
  rmBtn.style.display = 'flex';
  rmBtn.addEventListener('click', () => {
    if (eventRowsContainer.querySelectorAll('.event-row').length > 1) {
      template.remove();
    }
  });
  populateSubjectSelect(template.querySelector('.event-subject'), 'Select a Subject');
  updateRowFields(template);
  const today = new Date();
  const yyyy = today.getFullYear(), mm = String(today.getMonth()+1).padStart(2,'0'), dd = String(today.getDate()).padStart(2,'0');
  template.querySelector('.event-date').setAttribute('min', `${yyyy}-${mm}-${dd}`);
  eventRowsContainer.appendChild(template);
}

addEventRowBtn.addEventListener('click', addEventRow);

eventRowsContainer.addEventListener('click', function(e) {
  if (e.target.matches('.event-remove-btn')) {
    if (eventRowsContainer.querySelectorAll('.event-row').length > 1) {
      e.target.closest('.event-row').remove();
    }
  }
});

addSeriesRowBtn.addEventListener('click', () => {
  const rows = seriesRows.querySelectorAll('.series-row');
  const template = rows[0].cloneNode(true);
  template.querySelector('.series-subject').value = '';
  template.querySelector('.series-date').value = '';
  const rmBtn = template.querySelector('.series-remove-btn');
  rmBtn.style.display = 'flex';
  rmBtn.addEventListener('click', () => {
    if (seriesRows.querySelectorAll('.series-row').length > 1) {
      template.remove();
    }
  });
  populateSubjectSelect(template.querySelector('.series-subject'), 'Subject');
  seriesRows.appendChild(template);
});

seriesRows.addEventListener('click', function(e) {
  if (e.target.matches('.series-remove-btn')) {
    if (seriesRows.querySelectorAll('.series-row').length > 1) {
      e.target.closest('.series-row').remove();
    }
  }
});

const typeLabels = {
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

function renderEventsList(events) {
  const listEl = document.getElementById('eventsList');
  window._cachedEvents = events;
  if (events.length === 0) {
    listEl.innerHTML = `<p style="color: var(--ink-soft); font-size: 14px;">No upcoming events found.</p>`;
    document.getElementById('deleteSelectedBtn').style.display = 'none';
    return;
  }
  listEl.innerHTML = '';

  const examTitleCount = {};
  events.forEach(ev => {
    if (ev.type === 'exam' && ev.title) {
      examTitleCount[ev.title] = (examTitleCount[ev.title] || 0) + 1;
    }
  });

  events.forEach((ev, idx) => {
    const item = document.createElement('div');
    item.className = 'event-item';
    const displayTitle = ev.title || ev.subject || 'Untitled';
    const typeLabel = typeShortLabels[ev.type] || ev.type.toUpperCase();

    const safeTitle = ev.title.replace(/'/g, "\\'");

    let actionsHtml = `<input type="checkbox" class="event-checkbox" data-index="${idx}" style="margin-right:10px;accent-color:var(--toc);">`;
    actionsHtml += `<button class="del-btn" onclick="deleteEvent('${safeTitle}', '${ev.date}')">Delete</button>`;

    if (ev.type === 'exam' && examTitleCount[ev.title] > 1) {
      actionsHtml += `<button class="del-btn" onclick="deleteSeries('${safeTitle}')" style="background:var(--ink-soft);margin-left:6px;">Delete All</button>`;
    }

    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        ${actionsHtml}
        <div>
          <span style="font-weight: 700; font-size: 14px; display: block;">${displayTitle}</span>
          <span style="font-size: 12px; color: var(--ink-soft); text-transform: capitalize;">${ev.date} · ${typeLabel}</span>
        </div>
      </div>
    `;
    item.querySelector('.event-checkbox').addEventListener('change', updateDeleteSelectedBtn);
    listEl.appendChild(item);
  });
  document.getElementById('deleteSelectedBtn').style.display = events.length > 0 ? 'inline-block' : 'none';
}

function updateDeleteSelectedBtn() {
  const checked = document.querySelectorAll('.event-checkbox:checked').length;
  document.getElementById('deleteSelectedBtn').style.display = checked > 0 ? 'inline-block' : 'none';
}

function renderHolidaysList() {
  const listEl = document.getElementById('holidaysList');
  const holidays = window._holidays || [];
  if (holidays.length === 0) {
    listEl.innerHTML = `<p style="color: var(--ink-soft); font-size: 14px;">No holidays set.</p>`;
    return;
  }
  listEl.innerHTML = '';
  holidays.sort();
  holidays.forEach(date => {
    const item = document.createElement('div');
    item.className = 'event-item';
    item.innerHTML = `
      <div>
        <span style="font-weight: 700; font-size: 14px; display: block;">${date}</span>
        <span style="font-size: 12px; color: var(--ink-soft);">No notifications</span>
      </div>
      <button class="del-btn" onclick="removeHoliday('${date}')" style="background: var(--ink-soft);">Remove</button>
    `;
    listEl.appendChild(item);
  });
}

async function sendToAPI(payload) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = "Updating events...";
  statusEl.style.color = "var(--ink-soft)";

  try {
    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (res.ok) {
      statusEl.textContent = "✅ Success! Events updated.";
      statusEl.style.color = "var(--oop)";
      if(payload.action === 'add' || payload.action === 'clear_all') {
        document.getElementById('eventRows').querySelectorAll('.event-row').forEach((r, i) => {
          if (i > 0) r.remove();
        });
        const first = document.querySelector('.event-row');
        if (first) {
          const firstType = first.querySelector('.event-type');
          first.querySelector('.event-subject').value = '';
          first.querySelector('.event-title').value = firstType.options[firstType.selectedIndex].text;
          first.querySelector('.event-date').value = '';
          updateRowFields(first);
        }
      }
      loadData();
    } else {
      statusEl.textContent = "❌ " + (result.error || "Authentication failed.");
      statusEl.style.color = "var(--ds)";
    }
  } catch (err) {
    statusEl.textContent = "❌ Network error. Check your connection.";
    statusEl.style.color = "var(--ds)";
  }
}

document.getElementById('submitEventsBtn').addEventListener('click', (e) => {
  e.preventDefault();

  const events = [];

  eventRowsContainer.querySelectorAll('.event-row').forEach(row => {
    const type = row.querySelector('.event-type').value;
    const subject = row.querySelector('.event-subject').value;
    const title = row.querySelector('.event-title').value.trim();
    const date = row.querySelector('.event-date').value;
    if (title && date) {
      const ev = { title: title, date: date, type: type };
      if (subject && !['general', 'reminder'].includes(type)) {
        ev.subject = subject;
      }
      events.push(ev);
    }
  });

  const globalName = document.getElementById('seriesGlobalName').value.trim();
  seriesRows.querySelectorAll('.series-row').forEach(row => {
    const subject = row.querySelector('.series-subject').value;
    const date = row.querySelector('.series-date').value;
    if (subject && date) {
      const title = globalName || subject;
      events.push({ title: title, date: date, type: 'exam', subject: subject });
    }
  });

  if (events.length === 0) {
    alert("Please fill in at least one event.");
    return;
  }

  sendToAPI({ password: pwdInput.value, action: 'add', events: events });
});

window.deleteEvent = function(title, date) {
  if (!pwdInput.value) {
    alert("Please enter the Admin Password at the top to unlock deletion.");
    return;
  }
  if (confirm(`Are you sure you want to delete '${title}'?`)) {
    sendToAPI({ password: pwdInput.value, action: 'delete', targetTitle: title, targetDate: date });
  }
};

window.deleteSeries = function(title) {
  if (!pwdInput.value) {
    alert("Please enter the Admin Password at the top to unlock deletion.");
    return;
  }
  if (confirm(`Delete ALL events in the series '${title}'? This cannot be undone.`)) {
    sendToAPI({ password: pwdInput.value, action: 'delete_series', targetTitle: title });
  }
};

document.getElementById('deleteSelectedBtn').addEventListener('click', () => {
  if (!pwdInput.value) { alert("Please enter the Admin Password at the top first."); return; }
  const checked = document.querySelectorAll('.event-checkbox:checked');
  if (checked.length === 0) return;
  if (confirm(`Delete ${checked.length} selected event(s)?`)) {
    checked.forEach(cb => {
      const idx = parseInt(cb.dataset.index);
      const ev = window._cachedEvents[idx];
      if (ev) sendToAPI({ password: pwdInput.value, action: 'delete', targetTitle: ev.title, targetDate: ev.date });
    });
    setTimeout(loadData, 2000);
  }
});

document.getElementById('clearAllBtn').addEventListener('click', () => {
  if (!pwdInput.value) { alert("Please enter the Admin Password at the top first."); return; }
  if (confirm("Delete ALL upcoming events? This cannot be undone.")) {
    sendToAPI({ password: pwdInput.value, action: 'clear_all' });
  }
});

document.getElementById('addHolidayBtn').addEventListener('click', () => {
  const date = document.getElementById('holidayDate').value;
  if (!date) { alert("Please select a date."); return; }
  if (!pwdInput.value) { alert("Please enter the Admin Password at the top first."); return; }
  sendToAPI({ password: pwdInput.value, action: 'add_holiday', holidayDate: date });
});

window.removeHoliday = function(date) {
  if (!pwdInput.value) { alert("Please enter the Admin Password at the top first."); return; }
  if (confirm(`Remove holiday on ${date}?`)) {
    sendToAPI({ password: pwdInput.value, action: 'remove_holiday', holidayDate: date });
  }
};

/* ---------- Exam Mode Toggle ---------- */
function initExamModeToggle() {
  const toggle = document.getElementById('examModeToggle');
  const status = document.getElementById('examModeStatus');
  if (!toggle) return;

  if (window._settings) {
    toggle.checked = window._settings.forceExamMode || false;
    status.textContent = window._settings.forceExamMode
      ? '⚠️ Exam mode is currently forced for all users.'
      : 'Auto-detection is active (exams within 1 day trigger mode).';
  }

  toggle.addEventListener('change', () => {
    if (!pwdInput.value) {
      alert("Please enter the Admin Password at the top first.");
      toggle.checked = !toggle.checked;
      return;
    }
    sendToAPI({
      password: pwdInput.value,
      action: 'update_settings',
      settings: { forceExamMode: toggle.checked }
    });
  });
}

initExamModeToggle();