document.addEventListener('alpine:init', () => {
  Alpine.data('timetableApp', () => ({
    loaded: false,
    currentDay: '',
    now: new Date(),
    ACCENT: null,
    SUBJECTS: null,
    SCHEDULE: null,
    LEGEND: null,
    events: [],
    holidays: [],
    settings: {},
    touchStartX: 0,
    touchStartY: 0,
    _timer: null,
    _dateCheck: null,
    _deferredPrompt: null,
    installVisible: false,
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,

    get days() { return ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Exams']; },

    get currentMinutes() {
      const d = this.now;
      return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    },

    get currentDayName() {
      return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][this.now.getDay()];
    },

    get isSaturdayClassWeek() {
      const sat = new Date(this.now);
      sat.setDate(this.now.getDate() + (5 - (this.now.getDay() + 6) % 7));
      const occ = Math.ceil(sat.getDate() / 7);
      return occ === 1 || occ === 3;
    },

    get upcomingExams() {
      const t = this.now.getTime();
      return (this.events || []).filter(ev => {
        if (ev.type !== 'exam') return false;
        const d = new Date(ev.date);
        d.setHours(13, 30, 0, 0);
        return d.getTime() > t;
      }).sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    get upcomingDeadlines() {
      const t = this.now.getTime();
      return (this.events || []).filter(ev => {
        if (ev.type === 'exam') return false;
        const d = new Date(ev.date);
        d.setHours(13, 30, 0, 0);
        return d.getTime() > t;
      }).sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    get examModeActive() {
      if (this.settings && this.settings.forceExamMode) return true;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return (this.events || []).some(ev => {
        if (ev.type !== 'exam') return false;
        const ed = new Date(ev.date);
        ed.setHours(0, 0, 0, 0);
        return ed >= today && ed <= tomorrow;
      });
    },

    get examTitle() {
      const exams = this.upcomingExams;
      return exams.length ? exams[0].title : 'Exam Timetable';
    },

    get isExamDay() { return this.currentDay === 'Exams'; },

    async init() {
      this.setupBeforeInstall();
      try {
        const cached = sessionStorage.getItem('timetableData');
        const cachedAt = sessionStorage.getItem('timetableDataAt');
        let data = null;
        if (cached && cachedAt && Date.now() - Number(cachedAt) < 300000) {
          data = JSON.parse(cached);
        }
        if (!data) {
          const res = await fetch('/api/data');
          data = await res.json();
          try {
            sessionStorage.setItem('timetableData', JSON.stringify(data));
            sessionStorage.setItem('timetableDataAt', String(Date.now()));
          } catch (e) {}
        }
        this.ACCENT = data.ACCENT;
        this.SUBJECTS = data.SUBJECTS;
        this.SCHEDULE = data.SCHEDULE;
        this.LEGEND = data.LEGEND;

        await this.loadEvents();
        this.loaded = true;

        const startDay = this.days.includes(this.currentDayName) ? this.currentDayName : 'Monday';
        this.selectDay(startDay);
        this.$nextTick(() => this.scrollToNow());

        this._timer = setInterval(() => { this.now = new Date(); }, 1000);
        this._dateCheck = setInterval(() => this.checkDateChange(), 30000);
      } catch (e) {
        console.error('Init error:', e);
      }
    },

    async loadEvents() {
      try {
        const res = await fetch('/api/events');
        const d = await res.json();
        this.events = d.EVENTS || [];
        this.holidays = d.HOLIDAYS || [];
        this.settings = d.SETTINGS || {};
        this.$nextTick(() => this.injectCalendarBadges());
      } catch (e) { console.error('Events error:', e); }
    },

    selectDay(day) { this.currentDay = day; if (day === 'Exams') this.$nextTick(() => this.injectCalendarBadges()); },
    goToDay(offset) { const idx = this.days.indexOf(this.currentDay); this.selectDay(this.days[(idx + offset + this.days.length) % this.days.length]); },

    touchStart(e) { this.touchStartX = e.touches[0].clientX; this.touchStartY = e.touches[0].clientY; },
    touchEnd(e) {
      const dx = e.changedTouches[0].clientX - this.touchStartX;
      const dy = e.changedTouches[0].clientY - this.touchStartY;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.2) { this.goToDay(dx < 0 ? 1 : -1); }
    },

    formatTime(hhmm) {
      const [h, m] = hhmm.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      let h12 = h % 12; if (h12 === 0) h12 = 12;
      return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
    },
    minutesOf(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; },
    minsToLabel(mins) {
      if (mins < 60) return `${mins}min`;
      const h = Math.floor(mins / 60); const m = mins % 60;
      return m ? `${h}h ${m}m` : `${h}h`;
    },

    withBreaks(periods) {
      const out = [];
      for (let i = 0; i < periods.length; i++) {
        out.push(periods[i]);
        if (i < periods.length - 1) {
          const gap = this.minutesOf(periods[i + 1][0]) - this.minutesOf(periods[i][1]);
          if (gap > 5) out.push([periods[i][1], periods[i + 1][0], 'BREAK', this.minsToLabel(gap)]);
        }
      }
      return out;
    },

    getSchedule(day) {
      if (day === 'Exams') return [];
      const raw = this.SCHEDULE && this.SCHEDULE[day];
      if (!raw || !raw.length) return [];
      return this.withBreaks(raw);
    },

    isOngoing(start, end) { const cur = this.currentMinutes; return cur >= this.minutesOf(start) && cur < this.minutesOf(end); },
    isToday(day) { return day === this.currentDayName; },
    periodKey(p) { return p[0] + '-' + p[1] + '-' + p[2]; },

    cardAccentStyle(key) {
      const c = this.neonColors(key);
      return c ? `background: ${c.accent}` : '';
    },

    subjectName(key) { return (this.SUBJECTS && this.SUBJECTS[key]) ? this.SUBJECTS[key].name : key; },
    subjectLine(key) { return (this.SUBJECTS && this.SUBJECTS[key]) ? this.SUBJECTS[key].subLine : ''; },
    subjectChip(key) { return (this.SUBJECTS && this.SUBJECTS[key]) ? this.SUBJECTS[key].chipLabel : ''; },

    neonColors(key) {
      const accentMap = {
        TOC:  { accent: '#6E56CF', bg: 'rgba(110,86,207,0.15)', text: '#B9A6FF' },
        EE:   { accent: '#00A896', bg: 'rgba(0,168,150,0.15)', text: '#5FE0CB' },
        DS:   { accent: '#F0563D', bg: 'rgba(240,86,61,0.15)', text: '#FF8A73' },
        MAT:  { accent: '#E0A100', bg: 'rgba(224,161,0,0.15)', text: '#FFCB4D' },
        OOP:  { accent: '#2E9E4D', bg: 'rgba(46,158,77,0.15)', text: '#6FDD8F' },
        DAL:  { accent: '#D6338C', bg: 'rgba(214,51,140,0.15)', text: '#F582C0' },
        LAB:  { accent: '#5B4FE0', bg: 'rgba(91,79,224,0.15)', text: '#A79BFF' },
        ACT:  { accent: '#6B7280', bg: 'rgba(107,114,128,0.15)', text: '#A6ACB8' },
      };
      if (this.ACCENT && this.ACCENT[key]) {
        return { accent: this.ACCENT[key][0], bg: this.ACCENT[key][1], text: this.ACCENT[key][0] };
      }
      return accentMap[key] || { accent: '#00f0ff', bg: 'rgba(0,240,255,0.1)', text: '#00f0ff' };
    },

    progressPercent(start, end) {
      const total = this.minutesOf(end) - this.minutesOf(start);
      const elapsed = this.currentMinutes - this.minutesOf(start);
      return Math.min(100, Math.max(0, (elapsed / total) * 100));
    },
    progressLabel(start, end) {
      const mins = Math.max(0, Math.ceil(this.minutesOf(end) - this.currentMinutes));
      return mins <= 0 ? 'WRAPPING UP' : `${this.minsToLabel(mins)} LEFT`;
    },

    eventProgressPct(ev) {
      const evDate = new Date(ev.date);
      if (ev.type === 'exam') evDate.setHours(9, 0, 0);
      else evDate.setHours(23, 59, 59);
      const diff = evDate - this.now;
      if (diff <= 0) return 100;
      const total = 14 * 24 * 60 * 60 * 1000;
      return Math.min(100, Math.max(0, 100 - (diff / total) * 100));
    },
    eventProgressLabel(ev) {
      const evDate = new Date(ev.date);
      if (ev.type === 'exam') evDate.setHours(9, 0, 0);
      else evDate.setHours(23, 59, 59);
      const diff = evDate - this.now;
      if (diff <= 0) return 'NOW';
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      if (d > 0) return `${d}D ${h}H LEFT`;
      if (h > 0) return `${h}H ${m}M LEFT`;
      return `${m}M LEFT`;
    },

    isClassDay(day) {
      if (day !== this.currentDayName) return false;
      if (day === 'Saturday') return this.isSaturdayClassWeek;
      return true;
    },
    showSaturdayCaution(day) { return day === 'Saturday' && this.currentDayName === 'Saturday' && !this.isSaturdayClassWeek; },

    eventKey(ev) { return ev.title + '|' + ev.date; },
    isEventCompleted(ev) {
      try { return JSON.parse(localStorage.getItem('timetableCompleted') || '[]').indexOf(this.eventKey(ev)) >= 0; }
      catch (e) { return false; }
    },
    toggleEventComplete(ev) {
      const key = this.eventKey(ev);
      const arr = JSON.parse(localStorage.getItem('timetableCompleted') || '[]');
      const idx = arr.indexOf(key);
      if (idx >= 0) arr.splice(idx, 1); else arr.push(key);
      localStorage.setItem('timetableCompleted', JSON.stringify(arr));
      this.now = new Date();
    },

    injectCalendarBadges() {
      document.querySelectorAll('.event-calendar-badge').forEach(el => el.remove());
      if (!this.events || !this.events.length) return;
      const nowMin = this.currentMinutes;
      const mon = new Date(this.now);
      mon.setDate(this.now.getDate() - ((this.now.getDay() + 6) % 7));
      mon.setHours(0, 0, 0, 0);
      const nextMon = new Date(mon); nextMon.setDate(mon.getDate() + 7);
      const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      this.events.forEach(ev => {
        if (!ev.subject) return;
        const parts = ev.date.split('-').map(Number);
        const evDate = new Date(parts[0], parts[1] - 1, parts[2]);
        if (evDate < mon || evDate >= nextMon) return;
        let subjKey = null;
        for (const [k, v] of Object.entries(this.SUBJECTS || {})) { if (v.name === ev.subject) { subjKey = k; break; } }
        if (!subjKey) return;
        const evDayName = dayNames[evDate.getDay()];
        if (evDayName === this.currentDayName && this.currentDay !== 'Exams') {
          const cards = document.querySelectorAll(`.card[data-subj="${subjKey}"]`);
          if (!cards.length) return;
          const label = (ev.type === 'exam' ? 'EXAM' : ev.type === 'test' ? 'TEST' : ev.type.toUpperCase());
          cards.forEach(c => {
            const endMin = Number(c.dataset.endMin);
            if (evDayName === this.currentDayName && endMin && nowMin >= endMin) return;
            const badge = document.createElement('div');
            badge.className = 'event-calendar-badge';
            badge.textContent = label + ': ' + ev.title;
            c.querySelector('.subj-sub')?.after(badge);
          });
        }
      });
    },

    checkDateChange() {
      const today = new Date().toDateString();
      if (this._lastChecked !== today) { this._lastChecked = today; this.loadEvents(); }
    },

    scrollToNow() {
      if (this.currentDay === 'Exams') return;
      const nowCard = document.querySelector('.day-panel.active .card-now');
      if (nowCard) { const rect = nowCard.getBoundingClientRect(); if (rect.top < 0 || rect.bottom > window.innerHeight) nowCard.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    },

    setupBeforeInstall() {
      window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); this._deferredPrompt = e; });
      window.addEventListener('appinstalled', () => { this.installVisible = false; this._deferredPrompt = null; });
    },
    showInstallBanner() { this.installVisible = true; },
    hideInstallBanner() { this.installVisible = false; },
    async doInstall() {
      if (!this._deferredPrompt) return;
      try { this._deferredPrompt.prompt(); await this._deferredPrompt.userChoice; } catch (_) {}
      this._deferredPrompt = null; this.installVisible = false;
    },

    dividerPositions(key, subCount) {
      const count = key === 'LABCOMBO' ? (subCount || 1) : 1;
      return Array.from({ length: count - 1 }, (_, i) => ((i + 1) / count) * 100);
    }
  }));
});
