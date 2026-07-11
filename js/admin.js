const lockScreen = document.getElementById('lockScreen');
const eventBuilder = document.getElementById('eventBuilder');
const subjectSelect = document.getElementById('subject');
const typeSelect = document.getElementById('type');
const titleInput = document.getElementById('title');
const pwdInput = document.getElementById('password');
const normalFields = document.getElementById('normalFields');
const seriesFields = document.getElementById('seriesFields');
const seriesRows = document.getElementById('seriesRows');
const addSeriesRowBtn = document.getElementById('addSeriesRow');

document.getElementById('unlockBtn').addEventListener('click', async () => {
  const pwd = pwdInput.value.trim();
  if (!pwd) { alert("Please enter a password."); return; }

  const unlockBtn = document.getElementById('unlockBtn');
  unlockBtn.textContent = "Verifying...";
  unlockBtn.disabled = true;

  try {
    const res = await fetch('/api/manage_events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd, action: 'verify' })
    });
    const result = await res.json();

    if (res.ok) {
      lockScreen.style.display = 'none';
      eventBuilder.style.display = 'flex';
      document.getElementById('holidaysSection').style.display = 'block';
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
    const res = await fetch('./data.json?v=' + new Date().getTime());
    const data = await res.json();
    window._subjects = data.SUBJECTS;
    window._holidays = data.HOLIDAYS || [];

    populateSubjectSelect(subjectSelect, 'Select a Subject');
    document.querySelectorAll('.series-subject').forEach(sel => populateSubjectSelect(sel, 'Select Subject'));

    renderEventsList(data.EVENTS || []);
    renderHolidaysList();
  } catch (err) {
    console.error("Failed to load data.json", err);
  }
}

function setMinDates() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const min = `${yyyy}-${mm}-${dd}`;
  document.getElementById('date').setAttribute('min', min);
  document.getElementById('holidayDate').setAttribute('min', min);
  document.querySelectorAll('.series-date').forEach(el => el.setAttribute('min', min));
}

loadData();
setMinDates();

typeSelect.addEventListener('change', toggleEventType);
toggleEventType();

function toggleEventType() {
  if (typeSelect.value === 'exam') {
    normalFields.style.display = 'none';
    seriesFields.style.display = 'flex';
    titleInput.required = false;
    document.getElementById('date').required = false;
    subjectSelect.required = true;
  } else {
    normalFields.style.display = 'flex';
    seriesFields.style.display = 'none';
    titleInput.required = true;
    document.getElementById('date').required = true;
    // subject optional for general/reminder
    const noSubjNeeded = ['general', 'reminder'].includes(typeSelect.value);
    subjectSelect.required = !noSubjNeeded;
    if (noSubjNeeded) subjectSelect.value = '';
  }
  updateTitle();
}

function updateTitle() {
  if (typeSelect.value === 'exam') {
    titleInput.value = '';
    return;
  }
  const subj = subjectSelect.value;
  const typeLabel = typeSelect.options[typeSelect.selectedIndex].text;
  const prefix = subj && subj !== "General" ? subj : typeLabel;
  titleInput.value = prefix;
}
subjectSelect.addEventListener('change', updateTitle);
typeSelect.addEventListener('change', updateTitle);

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

document.querySelectorAll('.series-remove-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    if (seriesRows.querySelectorAll('.series-row').length > 1) {
      this.closest('.series-row').remove();
    }
  });
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
  if (events.length === 0) {
    listEl.innerHTML = `<p style="color: var(--ink-soft); font-size: 14px;">No upcoming events found.</p>`;
    return;
  }
  listEl.innerHTML = '';
  events.forEach(ev => {
    const item = document.createElement('div');
    item.className = 'event-item';
    const displayTitle = ev.title || ev.subject || 'Untitled';
    const typeLabel = typeShortLabels[ev.type] || ev.type.toUpperCase();
    item.innerHTML = `
      <div>
        <span style="font-weight: 700; font-size: 14px; display: block;">${displayTitle}</span>
        <span style="font-size: 12px; color: var(--ink-soft); text-transform: capitalize;">${ev.date} · ${typeLabel}</span>
      </div>
      <button class="del-btn" onclick="deleteEvent('${ev.title.replace(/'/g, "\\'")}', '${ev.date}')">Delete</button>
    `;
    listEl.appendChild(item);
  });
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
  statusEl.textContent = "Connecting to repository...";
  statusEl.style.color = "var(--ink-soft)";

  try {
    const res = await fetch('/api/manage_events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (res.ok) {
      statusEl.textContent = "✅ Success! Devices will sync shortly.";
      statusEl.style.color = "var(--oop)";
      if(payload.action === 'add') {
        document.getElementById('adminForm').reset();
        titleInput.value = "";
        toggleEventType();
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

document.getElementById('adminForm').addEventListener('submit', (e) => {
  e.preventDefault();

  let events;
  if (typeSelect.value === 'exam') {
    events = [];
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
      alert("Please add at least one subject and date for the Series.");
      return;
    }
  } else {
    events = [{
      title: titleInput.value,
      date: document.getElementById('date').value,
      type: typeSelect.value
    }];
    // Include subject if a real one was selected
    if (subjectSelect.value && !['general', 'reminder'].includes(typeSelect.value)) {
      events[0].subject = subjectSelect.value;
    }
  }

  const payload = {
    password: pwdInput.value,
    action: 'add',
    events: events
  };
  sendToAPI(payload);
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
