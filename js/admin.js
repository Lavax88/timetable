document.addEventListener('alpine:init', () => {
  Alpine.data('adminApp', () => ({
    password: '',
    unlocked: false,
    statusMsg: '',
    statusType: '',
    subjects: [],
    eventRows: [{ type: 'test', subject: '', title: '', date: '', _id: 1 }],
    seriesRows: [{ subject: '', date: '', _id: 1 }],
    seriesGlobalName: '',
    nextId: 2,
    activeEvents: [],
    holidays: [],
    holidayDate: '',
    examModeEnabled: false,
    _ACCENT: null,

    async init() {
      try {
        const res = await fetch('/api/data');
        const data = await res.json();
        this._ACCENT = data.ACCENT;
        this.subjects = Object.entries(data.SUBJECTS).map(([k, v]) => ({ key: k, ...v }));
      } catch (e) { console.error('Failed to load subjects:', e); }
      await this.refreshEvents();
    },

    async _call(action, extra) {
      const res = await fetch('/api/manage_events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, password: this.password, ...extra })
      });
      return res.json();
    },

    async unlock() {
      try {
        const data = await this._call('verify');
        if (data.success) { this.unlocked = true; this.statusMsg = ''; await this.refreshEvents(); }
        else { this.setStatus('ACCESS DENIED.', 'danger'); }
      } catch (e) { this.setStatus('SERVER ERROR.', 'danger'); }
    },

    addEventRow() { this.eventRows.push({ type: 'test', subject: '', title: '', date: '', _id: this.nextId++ }); },
    removeEventRow(id) { if (this.eventRows.length > 1) this.eventRows = this.eventRows.filter(r => r._id !== id); },
    addSeriesRow() { this.seriesRows.push({ subject: '', date: '', _id: this.nextId++ }); },
    removeSeriesRow(id) { if (this.seriesRows.length > 1) this.seriesRows = this.seriesRows.filter(r => r._id !== id); },

    async submitEvents() {
      const singles = this.eventRows.filter(r => r.title && r.date).map(r => ({ type: r.type, subject: r.subject, title: r.title, date: r.date }));
      const series = this.seriesRows.filter(r => r.subject && r.date).map(r => ({ subject: r.subject, date: r.date }));
      const seriesTitle = this.seriesGlobalName.trim();
      if (!singles.length && !series.length) { this.setStatus('NO VALID EVENTS.', 'danger'); return; }
      const events = [];
      singles.forEach(ev => events.push(ev));
      series.forEach(ev => events.push({ type: 'exam', subject: ev.subject, title: seriesTitle || ev.subject, date: ev.date }));
      try {
        const data = await this._call('add', { events });
        if (data.success) {
          this.setStatus('EVENTS UPLOADED.', 'success');
          this.eventRows = [{ type: 'test', subject: '', title: '', date: '', _id: this.nextId++ }];
          this.seriesRows = [{ subject: '', date: '', _id: this.nextId++ }];
          this.seriesGlobalName = '';
          await this.refreshEvents();
        } else { this.setStatus('UPLOAD FAILED.', 'danger'); }
      } catch (e) { this.setStatus('SERVER ERROR.', 'danger'); }
    },

    async refreshEvents() {
      try {
        const res = await fetch('/api/events');
        const data = await res.json();
        this.activeEvents = (data.EVENTS || []).sort((a, b) => new Date(a.date) - new Date(b.date));
        this.holidays = data.HOLIDAYS || [];
        this.examModeEnabled = data.SETTINGS?.forceExamMode || false;
      } catch (e) { console.error('Refresh error:', e); }
    },

    async deleteEvent(ev) {
      try { const data = await this._call('delete', { targetTitle: ev.title, targetDate: ev.date }); if (data.success) { this.setStatus('EVENT DELETED.', 'success'); await this.refreshEvents(); } } catch (e) { this.setStatus('SERVER ERROR.', 'danger'); }
    },

    async clearAllEvents() {
      if (!confirm('ERASE ALL EVENTS? THIS CANNOT BE UNDONE.')) return;
      try { const data = await this._call('clear_all'); if (data.success) { this.setStatus('ALL EVENTS CLEARED.', 'success'); await this.refreshEvents(); } } catch (e) { this.setStatus('SERVER ERROR.', 'danger'); }
    },

    async addHoliday() {
      if (!this.holidayDate) return;
      try { const data = await this._call('add_holiday', { holidayDate: this.holidayDate }); if (data.success) { this.holidayDate = ''; await this.refreshEvents(); } } catch (e) { this.setStatus('SERVER ERROR.', 'danger'); }
    },

    async removeHoliday(date) {
      try { const data = await this._call('remove_holiday', { holidayDate: date }); if (data.success) await this.refreshEvents(); } catch (e) { this.setStatus('SERVER ERROR.', 'danger'); }
    },

    async toggleExamMode() {
      try { const data = await this._call('update_settings', { settings: { forceExamMode: this.examModeEnabled } }); if (data.success) { this.setStatus(this.examModeEnabled ? 'EXAM MODE: ON' : 'EXAM MODE: OFF', 'success'); } } catch (e) { this.setStatus('SERVER ERROR.', 'danger'); }
    },

    setStatus(msg, type) { this.statusMsg = msg; this.statusType = type; setTimeout(() => { this.statusMsg = ''; }, 3000); },

    eventTypeLabel(type) { return { exam: 'EXAM', test: 'TEST', deadline: 'DEADLINE', general: 'EVENT', reminder: 'REMIND' }[type] || type; },
    eventStatusColor(type) { return { exam: 'var(--neon-magenta)', test: 'var(--neon-yellow)', deadline: 'var(--neon-cyan)', general: 'var(--ink-soft)', reminder: 'var(--neon-green)' }[type] || 'var(--ink-soft)'; },
    subjectOptions() { return this.subjects; }
  }));
});
