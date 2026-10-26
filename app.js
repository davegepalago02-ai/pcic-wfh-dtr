/**
 * ==========================================================================
 * PCIC WFH ATTENDANCE & DAILY TIME RECORD (DTR) SYSTEM - APPLICATION CORE
 * ==========================================================================
 */

(function () {
  'use strict';

  // Storage Keys
  const STORAGE_KEYS = {
    PROFILE: 'pcic_wfh_profile',
    RECORDS: 'pcic_wfh_records',
    SETTINGS: 'pcic_wfh_settings',
    THEME: 'pcic_wfh_theme',
    SESSION: 'pcic_wfh_session'
  };

  const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwfdZyOirEX1Hgwn7KZ5EV8JCyV3YX5fY2__0kla_vDXYEcy8ENOtuuaqTzKdddYUbh-g/exec';

  // Application State
  let appState = {
    profile: {
      empId: '',
      empName: '',
      empDept: '',
      workLocation: 'Work From Home (WFH)'
    },
    records: [],
    settings: {
      scriptUrl: DEFAULT_SCRIPT_URL,
      soundEnabled: true,
      autoSync: true
    },
    session: {
      currentStatus: 'NOT TIMED IN',
      clockInTime: null,
      lastAction: null
    },
    currentFilter: 'all',
    searchQuery: ''
  };

  // DOM Elements Cache
  const DOM = {
    // Clock & Header
    digitalClock: document.getElementById('digital-clock'),
    currentDate: document.getElementById('current-date'),
    btnSyncNow: document.getElementById('btn-sync-now'),
    syncSpinner: document.getElementById('sync-spinner'),
    syncStatusLabel: document.getElementById('sync-status-label'),
    btnInstallApp: document.getElementById('btn-install-app'),
    btnSettingsToggle: document.getElementById('btn-settings-toggle'),
    btnThemeToggle: document.getElementById('btn-theme-toggle'),
    themeIcon: document.getElementById('theme-icon'),

    // Install Modal
    installModal: document.getElementById('install-modal'),
    btnCloseInstall: document.getElementById('btn-close-install'),
    btnDoneInstall: document.getElementById('btn-done-install'),
    btnTriggerPwaInstall: document.getElementById('btn-trigger-pwa-install'),
    pwaDirectInstallBox: document.getElementById('pwa-direct-install-box'),

    // Status Ribbon
    kpiCurrentStatus: document.getElementById('kpi-current-status'),
    kpiWorkDuration: document.getElementById('kpi-work-duration'),
    statusIcon: document.getElementById('status-icon'),
    cloudStatusIcon: document.getElementById('cloud-status-icon'),
    cloudStatusText: document.getElementById('cloud-status-text'),
    quickSheetIndicator: document.getElementById('sheet-quick-indicator'),
    quickSheetText: document.getElementById('quick-sheet-text'),

    // Attendance Form
    attendanceForm: document.getElementById('attendance-form'),
    empId: document.getElementById('emp-id'),
    empName: document.getElementById('emp-name'),
    empDept: document.getElementById('emp-dept'),
    workLocation: document.getElementById('work-location'),
    actionType: document.getElementById('action-type'),
    accomplishments: document.getElementById('accomplishments'),
    btnSubmitAttendance: document.getElementById('btn-submit-attendance'),
    submitBtnText: document.getElementById('submit-btn-text'),
    submitIcon: document.getElementById('submit-icon'),

    // Table & Filters
    dtrTableBody: document.getElementById('dtr-table-body'),
    tableEmptyState: document.getElementById('table-empty-state'),
    logSearchInput: document.getElementById('log-search-input'),
    filterTabs: document.querySelectorAll('.filter-tab'),
    countAll: document.getElementById('count-all'),
    countToday: document.getElementById('count-today'),
    countPending: document.getElementById('count-pending'),
    footerRecordsInfo: document.getElementById('footer-records-info'),
    btnClearHistory: document.getElementById('btn-clear-history'),
    btnExportCsv: document.getElementById('btn-export-csv'),
    btnPrintDtr: document.getElementById('btn-print-dtr'),

    // Settings Modal
    settingsModal: document.getElementById('settings-modal'),
    appsScriptUrl: document.getElementById('apps-script-url'),
    btnTestConnection: document.getElementById('btn-test-connection'),
    prefSound: document.getElementById('pref-sound'),
    prefAutoSync: document.getElementById('pref-autosync'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnCancelSettings: document.getElementById('btn-cancel-settings'),
    btnSaveSettings: document.getElementById('btn-save-settings'),

    // Print Modal (CSC Form 48)
    printModal: document.getElementById('print-modal'),
    btnClosePrint: document.getElementById('btn-close-print'),
    btnTriggerPrint: document.getElementById('btn-trigger-print'),
    printEmpName: document.getElementById('print-emp-name'),
    printEmpId: document.getElementById('print-emp-id'),
    printEmpDept: document.getElementById('print-emp-dept'),
    printMonthYear: document.getElementById('print-month-year'),
    printSigEmp: document.getElementById('print-sig-emp'),
    cscTableBody: document.getElementById('csc-table-body'),

    // Notifications
    toastContainer: document.getElementById('toast-container')
  };

  /* ==========================================================================
     SYNTHESIZED AUDIO SOUND FX (Web Audio API)
     ========================================================================== */
  const SoundFx = {
    ctx: null,
    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
    },
    playChord(frequencies, type = 'sine', duration = 0.25, interval = 0.05) {
      if (!appState.settings.soundEnabled) return;
      try {
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        frequencies.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const startTime = this.ctx.currentTime + (idx * interval);

          osc.type = type;
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + duration + 0.05);
        });
      } catch (e) {
        console.warn('Audio feedback notice:', e);
      }
    },
    success() {
      // Pleasant rising chime (C5 -> E5 -> G5 -> C6)
      this.playChord([523.25, 659.25, 783.99, 1046.50], 'triangle', 0.22, 0.06);
    },
    click() {
      this.playChord([880], 'sine', 0.04, 0);
    },
    error() {
      this.playChord([220, 207.65], 'sawtooth', 0.15, 0.06);
    }
  };

  /* ==========================================================================
     TOAST NOTIFICATIONS
     ========================================================================== */
  function showToast(title, message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconClass = 'fa-solid fa-circle-info';
    if (type === 'success') iconClass = 'fa-solid fa-circle-check';
    if (type === 'error') iconClass = 'fa-solid fa-triangle-exclamation';
    if (type === 'warning') iconClass = 'fa-solid fa-bell';

    toast.innerHTML = `
      <i class="${iconClass} toast-icon"></i>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
    `;

    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* ==========================================================================
     LIVE CLOCK & TIMERS
     ========================================================================== */
  function startClock() {
    function updateClock() {
      const now = new Date();

      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const formattedHours = String(hours).padStart(2, '0');

      DOM.digitalClock.textContent = `${formattedHours}:${minutes}:${seconds} ${ampm}`;

      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      DOM.currentDate.textContent = now.toLocaleDateString('en-US', options);

      updateDurationCounter(now);
    }

    updateClock();
    setInterval(updateClock, 1000);
  }

  function updateDurationCounter(now = new Date()) {
    if (appState.session.clockInTime && (appState.session.currentStatus === 'TIMED IN' || appState.session.currentStatus === 'ON LUNCH BREAK')) {
      const start = new Date(appState.session.clockInTime);
      const diffMs = Math.max(0, now - start);

      const totalSec = Math.floor(diffMs / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;

      DOM.kpiWorkDuration.textContent = `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    } else {
      DOM.kpiWorkDuration.textContent = '00h 00m 00s';
    }
  }

  /* ==========================================================================
     PERSISTENCE & STATE MANAGEMENT
     ========================================================================== */
  function loadPersistedState() {
    // 1. Theme
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'theme-dark';
    document.body.className = savedTheme;
    updateThemeIcon(savedTheme);

    // 2. Profile
    try {
      const savedProfile = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILE));
      if (savedProfile) {
        appState.profile = { ...appState.profile, ...savedProfile };
        DOM.empId.value = appState.profile.empId || '';
        DOM.empName.value = appState.profile.empName || '';
        DOM.empDept.value = appState.profile.empDept || '';
        DOM.workLocation.value = appState.profile.workLocation || 'Work From Home (WFH)';
      }
    } catch (e) {
      console.warn('Profile parse error:', e);
    }

    // 3. Settings
    try {
      const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS));
      if (savedSettings) {
        appState.settings = { ...appState.settings, ...savedSettings };
      }
      // Ensure default URL if empty
      if (!appState.settings.scriptUrl) {
        appState.settings.scriptUrl = DEFAULT_SCRIPT_URL;
      }
      DOM.appsScriptUrl.value = appState.settings.scriptUrl;
      DOM.prefSound.checked = appState.settings.soundEnabled;
      DOM.prefAutoSync.checked = appState.settings.autoSync;
    } catch (e) {
      console.warn('Settings parse error:', e);
    }

    // 4. Session
    try {
      const savedSession = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION));
      if (savedSession) {
        appState.session = { ...appState.session, ...savedSession };
      }
    } catch (e) {
      console.warn('Session parse error:', e);
    }

    // 5. Records
    try {
      const savedRecords = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECORDS));
      if (savedRecords && Array.isArray(savedRecords)) {
        appState.records = savedRecords;
      } else {
        seedSampleRecords();
      }
    } catch (e) {
      console.warn('Records parse error:', e);
      seedSampleRecords();
    }

    updateStatusUI();
    renderRecordsTable();
  }

  function saveProfile() {
    appState.profile = {
      empId: DOM.empId.value.trim(),
      empName: DOM.empName.value.trim(),
      empDept: DOM.empDept.value,
      workLocation: DOM.workLocation.value
    };
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(appState.profile));
  }

  function saveSession() {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(appState.session));
    updateStatusUI();
  }

  function saveRecords() {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(appState.records));
    updateStatusUI();
    renderRecordsTable();
  }

  function saveSettings() {
    appState.settings.scriptUrl = DOM.appsScriptUrl.value.trim() || DEFAULT_SCRIPT_URL;
    appState.settings.soundEnabled = DOM.prefSound.checked;
    appState.settings.autoSync = DOM.prefAutoSync.checked;
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(appState.settings));
    updateStatusUI();
  }

  function seedSampleRecords() {
    const today = new Date();
    const dateFormatted = today.toISOString().split('T')[0];

    appState.records = [
      {
        id: 'rec_sample_1',
        timestamp: `${dateFormatted} 08:00:15`,
        date: dateFormatted,
        time: '08:00:15 AM',
        employeeId: 'PCIC-2024-0042',
        employeeName: 'Dela Cruz, Juan M.',
        department: 'Head Office - Information Technology (ITD)',
        workLocation: 'Work From Home (WFH)',
        logType: 'Time In (AM In)',
        accomplishments: 'Commenced WFH shift; Verified agricultural damage assessment system operations.',
        gpsCoordinates: 'WFH Station',
        hasPhoto: false,
        syncStatus: 'synced'
      }
    ];
    saveRecords();
  }

  /* ==========================================================================
     STATUS & CLOUD SYNC UI
     ========================================================================== */
  function updateStatusUI() {
    // Current Status Display
    DOM.kpiCurrentStatus.textContent = appState.session.currentStatus;
    DOM.kpiCurrentStatus.className = '';

    if (appState.session.currentStatus === 'TIMED IN') {
      DOM.kpiCurrentStatus.classList.add('text-emerald');
      DOM.statusIcon.className = 'fa-solid fa-user-check text-emerald';
    } else if (appState.session.currentStatus === 'ON LUNCH BREAK') {
      DOM.kpiCurrentStatus.classList.add('text-amber');
      DOM.statusIcon.className = 'fa-solid fa-utensils text-amber';
    } else if (appState.session.currentStatus === 'TIMED OUT') {
      DOM.kpiCurrentStatus.classList.add('text-rose');
      DOM.statusIcon.className = 'fa-solid fa-moon text-rose';
    } else {
      DOM.kpiCurrentStatus.classList.add('text-amber');
      DOM.statusIcon.className = 'fa-solid fa-user-clock text-amber';
    }

    // Pending counts
    const todayStr = new Date().toISOString().split('T')[0];
    const todayRecords = appState.records.filter(r => r.date === todayStr);
    const pendingRecords = appState.records.filter(r => r.syncStatus === 'pending');

    DOM.countAll.textContent = appState.records.length;
    DOM.countToday.textContent = todayRecords.length;
    DOM.countPending.textContent = pendingRecords.length;

    if (pendingRecords.length > 0) {
      DOM.syncStatusLabel.textContent = `Sync (${pendingRecords.length})`;
      DOM.btnSyncNow.style.borderColor = 'var(--status-amber)';
    } else {
      DOM.syncStatusLabel.textContent = 'Sync';
      DOM.btnSyncNow.style.borderColor = '';
    }

    // Google Sheets link indicator
    if (appState.settings.scriptUrl) {
      DOM.cloudStatusText.textContent = 'Google Sheets Connected';
      DOM.cloudStatusIcon.className = 'fa-solid fa-cloud-check text-emerald';
      DOM.quickSheetText.textContent = 'Google Sheets Sync Active';
      DOM.quickSheetIndicator.querySelector('i').className = 'fa-solid fa-circle-check text-emerald';
    } else {
      DOM.cloudStatusText.textContent = 'Local Mode (No Sheet URL)';
      DOM.cloudStatusIcon.className = 'fa-solid fa-cloud-slash text-amber';
      DOM.quickSheetText.textContent = 'Local Cache Only (Click Setup)';
      DOM.quickSheetIndicator.querySelector('i').className = 'fa-solid fa-circle-exclamation text-amber';
    }
  }

  /* ==========================================================================
     ATTENDANCE SUBMISSION ENGINE
     ========================================================================== */
  async function handleSubmitAttendance(e) {
    if (e) e.preventDefault();

    saveProfile();

    const empId = DOM.empId.value.trim();
    const empName = DOM.empName.value.trim();
    const empDept = DOM.empDept.value;
    const workLocation = DOM.workLocation.value;
    const logType = DOM.actionType.value;
    const accomplishments = DOM.accomplishments.value.trim();

    // Field Validation
    if (!empId) {
      showToast('Employee ID Required', 'Please enter your PCIC Employee ID or Plantilla Number.', 'warning');
      DOM.empId.focus();
      SoundFx.error();
      return;
    }

    if (!empName) {
      showToast('Full Name Required', 'Please enter your Full Name.', 'warning');
      DOM.empName.focus();
      SoundFx.error();
      return;
    }

    if (!empDept) {
      showToast('Department Required', 'Please select your PCIC Regional Office or Department.', 'warning');
      DOM.empDept.focus();
      SoundFx.error();
      return;
    }

    // Civil Service Guidance: Prompt for remarks when checking out
    if (logType.includes('Time Out') && !accomplishments) {
      const confirmProceed = confirm(
        'Civil Service WFH Guidelines recommend submitting your Daily Accomplishment Report when Timing Out.\n\nDo you want to submit Time Out without remarks?'
      );
      if (!confirmProceed) {
        DOM.accomplishments.focus();
        return;
      }
    }

    // Set Button Loading State
    const submitBtn = DOM.btnSubmitAttendance;
    submitBtn.disabled = true;
    DOM.submitIcon.className = 'fa-solid fa-spinner spinning';
    DOM.submitBtnText.textContent = 'Submitting to Google Sheet...';

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const timeStr = `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
    const timestampStr = `${dateStr} ${now.toTimeString().split(' ')[0]}`;

    const newRecord = {
      id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: timestampStr,
      date: dateStr,
      time: timeStr,
      employeeId: empId,
      employeeName: empName,
      department: empDept,
      workLocation: workLocation,
      logType: logType,
      accomplishments: accomplishments || 'WFH official duties executed.',
      gpsCoordinates: 'WFH Duty Station',
      hasPhoto: false,
      syncStatus: 'pending'
    };

    // Update Session Status
    if (logType.includes('Time In')) {
      appState.session.currentStatus = 'TIMED IN';
      appState.session.clockInTime = now.toISOString();
      appState.session.lastAction = logType;
    } else if (logType.includes('Break Out')) {
      appState.session.currentStatus = 'ON LUNCH BREAK';
      appState.session.lastAction = logType;
    } else if (logType.includes('Break In')) {
      appState.session.currentStatus = 'TIMED IN';
      appState.session.lastAction = logType;
    } else if (logType.includes('Time Out')) {
      appState.session.currentStatus = 'TIMED OUT';
      appState.session.lastAction = logType;
    }
    saveSession();

    // Add to records list (newest first)
    appState.records.unshift(newRecord);
    saveRecords();

    // Clear accomplishments textarea
    DOM.accomplishments.value = '';

    // Synchronize to Google Sheet
    if (appState.settings.autoSync && appState.settings.scriptUrl) {
      await syncRecordToGoogleSheet(newRecord);
    } else {
      showToast('Saved Locally', `${logType} recorded locally. Configure Google Sheet URL to enable cloud sync.`, 'info');
    }

    // Reset button state
    submitBtn.disabled = false;
    DOM.submitIcon.className = 'fa-solid fa-paper-plane';
    DOM.submitBtnText.textContent = 'Submit Attendance Record';
    SoundFx.success();
  }

  /* ==========================================================================
     GOOGLE APPS SCRIPT / GOOGLE SHEETS SYNC ENGINE
     ========================================================================== */
  async function syncRecordToGoogleSheet(record) {
    const scriptUrl = appState.settings.scriptUrl || DEFAULT_SCRIPT_URL;
    if (!scriptUrl) return;

    try {
      const payload = {
        action: 'append_record',
        timestamp: record.timestamp,
        date: record.date,
        time: record.time,
        employeeId: record.employeeId,
        employeeName: record.employeeName,
        department: record.department,
        workLocation: record.workLocation,
        logType: record.logType,
        accomplishments: record.accomplishments,
        gpsCoordinates: record.gpsCoordinates,
        hasPhoto: record.hasPhoto
      };

      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      record.syncStatus = 'synced';
      saveRecords();
      showToast('Logged to Google Sheet', `${record.logType} for ${record.employeeName} recorded in Google Sheet.`, 'success', 3500);

    } catch (err) {
      console.error('Google Sheet Sync Error:', err);
      record.syncStatus = 'pending';
      saveRecords();
      showToast('Sync Queued', 'Could not reach Google Sheets server. Record safely preserved locally.', 'warning');
    }
  }

  async function syncAllPendingRecords() {
    const pendingRecords = appState.records.filter(r => r.syncStatus === 'pending');
    const scriptUrl = appState.settings.scriptUrl || DEFAULT_SCRIPT_URL;

    if (!scriptUrl) {
      showToast('Setup Required', 'Please configure your Google Apps Script Web App URL first.', 'warning');
      DOM.settingsModal.classList.remove('hidden');
      return;
    }

    if (pendingRecords.length === 0) {
      showToast('All Synced', 'All attendance records are synchronized with Google Sheets.', 'info');
      return;
    }

    DOM.syncSpinner.classList.add('spinning');
    DOM.syncStatusLabel.textContent = 'Syncing...';

    let successCount = 0;

    for (const record of pendingRecords) {
      try {
        const payload = {
          action: 'append_record',
          timestamp: record.timestamp,
          date: record.date,
          time: record.time,
          employeeId: record.employeeId,
          employeeName: record.employeeName,
          department: record.department,
          workLocation: record.workLocation,
          logType: record.logType,
          accomplishments: record.accomplishments,
          gpsCoordinates: record.gpsCoordinates,
          hasPhoto: record.hasPhoto
        };

        await fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        record.syncStatus = 'synced';
        successCount++;
      } catch (e) {
        console.error('Batch sync failure:', e);
      }
    }

    DOM.syncSpinner.classList.remove('spinning');
    saveRecords();

    if (successCount > 0) {
      showToast('Sync Complete', `Pushed ${successCount} record(s) to PCIC Google Sheet!`, 'success');
      SoundFx.success();
    } else {
      showToast('Sync Incomplete', 'Could not reach Google Sheet server. Please verify your connection.', 'error');
    }
  }

  async function testGoogleConnection() {
    const testUrl = DOM.appsScriptUrl.value.trim() || DEFAULT_SCRIPT_URL;

    if (!testUrl) {
      showToast('URL Required', 'Please enter your Google Apps Script Web App URL.', 'warning');
      return;
    }

    const testBtn = DOM.btnTestConnection;
    const originalText = testBtn.innerHTML;
    testBtn.innerHTML = '<i class="fa-solid fa-spinner spinning"></i> Testing...';
    testBtn.disabled = true;

    try {
      await fetch(testUrl + '?action=ping', {
        method: 'GET',
        mode: 'no-cors'
      });

      showToast('Connection Active', 'Dispatched test ping to Google Apps Script. Web App endpoint responded!', 'success', 4000);
      SoundFx.success();
    } catch (err) {
      showToast('Connection Warning', 'Could not verify URL. Make sure deployment access is set to "Anyone".', 'warning', 4000);
    } finally {
      testBtn.innerHTML = originalText;
      testBtn.disabled = false;
    }
  }

  /* ==========================================================================
     DTR TABLE RENDERING
     ========================================================================== */
  function renderRecordsTable() {
    const todayStr = new Date().toISOString().split('T')[0];
    const query = appState.searchQuery.toLowerCase();

    let filtered = appState.records.filter(r => {
      if (appState.currentFilter === 'today' && r.date !== todayStr) return false;
      if (appState.currentFilter === 'pending' && r.syncStatus !== 'pending') return false;

      if (query) {
        const matchName = (r.employeeName || '').toLowerCase().includes(query);
        const matchId = (r.employeeId || '').toLowerCase().includes(query);
        const matchType = (r.logType || '').toLowerCase().includes(query);
        const matchDept = (r.department || '').toLowerCase().includes(query);
        const matchRemarks = (r.accomplishments || '').toLowerCase().includes(query);
        return matchName || matchId || matchType || matchDept || matchRemarks;
      }
      return true;
    });

    DOM.footerRecordsInfo.textContent = `Showing ${filtered.length} of ${appState.records.length} total entries`;

    if (filtered.length === 0) {
      DOM.dtrTableBody.innerHTML = '';
      DOM.tableEmptyState.classList.remove('hidden');
      return;
    }

    DOM.tableEmptyState.classList.add('hidden');

    DOM.dtrTableBody.innerHTML = filtered.map(record => {
      let badgeClass = 'badge-time-in';
      let icon = 'fa-sun';
      if (record.logType.includes('Break Out')) {
        badgeClass = 'badge-break-out';
        icon = 'fa-utensils';
      } else if (record.logType.includes('Break In')) {
        badgeClass = 'badge-break-in';
        icon = 'fa-mug-hot';
      } else if (record.logType.includes('Time Out')) {
        badgeClass = 'badge-time-out';
        icon = 'fa-moon';
      }

      const syncBadge = record.syncStatus === 'synced'
        ? '<span class="sync-pill synced"><i class="fa-solid fa-cloud-check"></i> Synced</span>'
        : '<span class="sync-pill pending"><i class="fa-solid fa-clock"></i> Pending</span>';

      return `
        <tr class="dtr-row">
          <td class="col-timestamp">
            <div class="time-main">${record.time}</div>
            <div class="date-sub">${record.date}</div>
          </td>
          <td class="col-employee">
            <div class="emp-name-cell">${escapeHTML(record.employeeName)}</div>
            <div class="emp-id-sub"><i class="fa-regular fa-id-badge"></i> ${escapeHTML(record.employeeId)}</div>
          </td>
          <td class="col-action">
            <span class="action-tag ${badgeClass}">
              <i class="fa-solid ${icon}"></i> ${escapeHTML(record.logType)}
            </span>
          </td>
          <td class="col-dept">
            <span class="dept-text">${escapeHTML(record.department)}</span>
            <div class="arrangement-sub">${escapeHTML(record.workLocation)}</div>
          </td>
          <td class="col-remarks">
            <div class="remarks-box" title="${escapeHTML(record.accomplishments)}">
              ${escapeHTML(record.accomplishments)}
            </div>
          </td>
          <td class="col-sync">
            ${syncBadge}
          </td>
          <td class="col-action-btn">
            <button class="btn-table-icon" title="Delete record" onclick="PCICApp.deleteRecord('${record.id}')">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function deleteRecord(recordId) {
    if (!confirm('Are you sure you want to remove this attendance entry from your local view?')) return;
    appState.records = appState.records.filter(r => r.id !== recordId);
    saveRecords();
    showToast('Record Removed', 'Entry removed from local log.', 'info');
  }

  function clearLocalHistory() {
    if (!confirm('Clear all local records on this browser? (Your Google Sheet records remain safe).')) return;
    appState.records = [];
    appState.session.currentStatus = 'NOT TIMED IN';
    appState.session.clockInTime = null;
    saveSession();
    saveRecords();
    showToast('Cache Cleared', 'Local records cleared successfully.', 'info');
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ==========================================================================
     CSV EXPORT & CIVIL SERVICE FORM 48
     ========================================================================== */
  function exportCSV() {
    if (appState.records.length === 0) {
      showToast('No Records', 'There are no attendance records to export.', 'warning');
      return;
    }

    const headers = [
      'Timestamp',
      'Date',
      'Time',
      'Employee ID',
      'Full Name',
      'Department / Office',
      'Action Logged',
      'Work Arrangement',
      'Accomplishments / Remarks',
      'Sync Status'
    ];

    const rows = appState.records.map(r => [
      `"${r.timestamp || ''}"`,
      `"${r.date || ''}"`,
      `"${r.time || ''}"`,
      `"${r.employeeId || ''}"`,
      `"${(r.employeeName || '').replace(/"/g, '""')}"`,
      `"${(r.department || '').replace(/"/g, '""')}"`,
      `"${r.logType || ''}"`,
      `"${r.workLocation || ''}"`,
      `"${(r.accomplishments || '').replace(/"/g, '""')}"`,
      `"${r.syncStatus || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const nowStr = new Date().toISOString().split('T')[0];
    a.download = `PCIC_WFH_DTR_Export_${nowStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Export Ready', `Downloaded PCIC_WFH_DTR_Export_${nowStr}.csv`, 'success');
  }

  function openForm48PrintModal() {
    saveProfile();

    DOM.printEmpName.textContent = appState.profile.empName || 'DELA CRUZ, JUAN M.';
    DOM.printEmpId.textContent = appState.profile.empId || 'PCIC-2024-0042';
    DOM.printEmpDept.textContent = appState.profile.empDept || 'Head Office - Information Technology (ITD)';
    DOM.printSigEmp.textContent = (appState.profile.empName || 'EMPLOYEE').toUpperCase();

    const now = new Date();
    const monthYearStr = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    DOM.printMonthYear.textContent = monthYearStr;

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

    let rowsHTML = '';

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const targetDate = `${currentYear}-${currentMonth}-${dayStr}`;

      const dayRecords = appState.records.filter(r => r.date === targetDate);

      let amIn = '';
      let amOut = '';
      let pmIn = '';
      let pmOut = '';
      let remarksArr = [];

      dayRecords.forEach(r => {
        const type = r.logType.toLowerCase();
        if (type.includes('time in') || type.includes('am in')) {
          if (!amIn) amIn = r.time;
        } else if (type.includes('break out') || type.includes('lunch out')) {
          if (!amOut) amOut = r.time;
        } else if (type.includes('break in') || type.includes('lunch in')) {
          if (!pmIn) pmIn = r.time;
        } else if (type.includes('time out') || type.includes('pm out')) {
          pmOut = r.time;
        }

        if (r.accomplishments && r.accomplishments !== 'WFH official duties executed.') {
          remarksArr.push(r.accomplishments);
        }
      });

      const dayOfWeek = new Date(currentYear, now.getMonth(), day).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      let rowRemark = remarksArr.join('; ') || (isWeekend ? (dayOfWeek === 0 ? 'SUNDAY' : 'SATURDAY') : 'WFH Official Duty');

      rowsHTML += `
        <tr>
          <td class="col-day-num">${day}</td>
          <td>${amIn}</td>
          <td>${amOut}</td>
          <td>${pmIn}</td>
          <td>${pmOut}</td>
          <td>-</td>
          <td>-</td>
          <td class="col-rem-text">${escapeHTML(rowRemark)}</td>
        </tr>
      `;
    }

    DOM.cscTableBody.innerHTML = rowsHTML;
    DOM.printModal.classList.remove('hidden');
  }

  /* ==========================================================================
     THEME TOGGLE
     ========================================================================== */
  function toggleTheme() {
    const isDark = document.body.classList.contains('theme-dark');
    const newTheme = isDark ? 'theme-light' : 'theme-dark';
    document.body.className = newTheme;
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
    updateThemeIcon(newTheme);
  }

  function updateThemeIcon(theme) {
    if (theme === 'theme-light') {
      DOM.themeIcon.className = 'fa-solid fa-sun';
      DOM.btnThemeToggle.title = 'Switch to Dark Mode';
    } else {
      DOM.themeIcon.className = 'fa-solid fa-moon';
      DOM.btnThemeToggle.title = 'Switch to Light Mode';
    }
  }

  /* ==========================================================================
     EVENT LISTENERS INITIALIZATION
     ========================================================================== */
  function setupEventListeners() {
    // Form Submit Event
    DOM.attendanceForm.addEventListener('submit', handleSubmitAttendance);

    // Quick Insert Tags for Accomplishments
    document.querySelectorAll('.quick-tag').forEach(tagBtn => {
      tagBtn.addEventListener('click', () => {
        const textToInsert = tagBtn.dataset.tag;
        const current = DOM.accomplishments.value.trim();
        DOM.accomplishments.value = current ? `${current}; ${textToInsert}` : textToInsert;
        DOM.accomplishments.focus();
        SoundFx.click();
      });
    });

    // Profile Autosave
    [DOM.empId, DOM.empName, DOM.empDept, DOM.workLocation].forEach(input => {
      input.addEventListener('change', saveProfile);
    });

    // Header Controls
    DOM.btnSyncNow.addEventListener('click', syncAllPendingRecords);
    DOM.btnThemeToggle.addEventListener('click', toggleTheme);
    DOM.btnSettingsToggle.addEventListener('click', () => {
      DOM.settingsModal.classList.remove('hidden');
    });

    // Settings Modal
    DOM.btnCloseSettings.addEventListener('click', () => DOM.settingsModal.classList.add('hidden'));
    DOM.btnCancelSettings.addEventListener('click', () => DOM.settingsModal.classList.add('hidden'));
    DOM.btnSaveSettings.addEventListener('click', () => {
      saveSettings();
      DOM.settingsModal.classList.add('hidden');
      showToast('Settings Saved', 'Google Sheet configuration updated.', 'success');
      SoundFx.click();
    });
    DOM.btnTestConnection.addEventListener('click', testGoogleConnection);

    // Search and Filters
    DOM.logSearchInput.addEventListener('input', (e) => {
      appState.searchQuery = e.target.value.trim();
      renderRecordsTable();
    });

    DOM.filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        DOM.filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        appState.currentFilter = tab.dataset.filter;
        renderRecordsTable();
      });
    });

    // Table Actions
    DOM.btnExportCsv.addEventListener('click', exportCSV);
    DOM.btnClearHistory.addEventListener('click', clearLocalHistory);
    DOM.btnPrintDtr.addEventListener('click', openForm48PrintModal);

    // Print Modal
    DOM.btnClosePrint.addEventListener('click', () => DOM.printModal.classList.add('hidden'));
    DOM.btnTriggerPrint.addEventListener('click', () => window.print());

    // PWA Mobile Install Modal
    if (DOM.btnInstallApp) {
      DOM.btnInstallApp.addEventListener('click', () => {
        if (deferredInstallPrompt) {
          DOM.pwaDirectInstallBox.classList.remove('hidden');
        }
        DOM.installModal.classList.remove('hidden');
        SoundFx.click();
      });
    }

    if (DOM.btnTriggerPwaInstall) {
      DOM.btnTriggerPwaInstall.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          const { outcome } = await deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            showToast('Installing...', 'Adding PCIC WFH to Home Screen.', 'success');
            DOM.installModal.classList.add('hidden');
          }
          deferredInstallPrompt = null;
        } else {
          showToast('Install Guide', 'Follow the on-screen steps below for your phone.', 'info');
        }
      });
    }

    if (DOM.btnCloseInstall) {
      DOM.btnCloseInstall.addEventListener('click', () => DOM.installModal.classList.add('hidden'));
    }
    if (DOM.btnDoneInstall) {
      DOM.btnDoneInstall.addEventListener('click', () => DOM.installModal.classList.add('hidden'));
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        DOM.settingsModal.classList.add('hidden');
        DOM.printModal.classList.add('hidden');
        if (DOM.installModal) DOM.installModal.classList.add('hidden');
      }
    });
  }

  /* ==========================================================================
     PWA SERVICE WORKER & INSTALL PROMPT
     ========================================================================== */
  let deferredInstallPrompt = null;

  function initPWA() {
    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((registration) => {
            console.log('PCIC Service Worker registered with scope:', registration.scope);
          })
          .catch((err) => {
            console.warn('Service Worker registration note:', err);
          });
      });
    }

    // 2. Intercept beforeinstallprompt for instant Android installation
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;

      if (DOM.pwaDirectInstallBox) {
        DOM.pwaDirectInstallBox.classList.remove('hidden');
      }
      if (DOM.btnInstallApp) {
        DOM.btnInstallApp.classList.add('btn-install-pulse');
      }
    });

    // 3. App installed event
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      if (DOM.installModal) DOM.installModal.classList.add('hidden');
      showToast('App Installed', 'PCIC WFH Portal successfully added to your device!', 'success');
    });
  }

  // Global namespace
  window.PCICApp = {
    deleteRecord: deleteRecord
  };

  /* ==========================================================================
     APP BOOTSTRAP
     ========================================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    loadPersistedState();
    startClock();
    setupEventListeners();
    initPWA();
    console.log('PCIC WFH Attendance Portal initialized successfully.');
  });

})();
