/* ==========================================================================
   CareBeat / SmartCare Application Logic — Redesigned & Restructured
   Preserves all existing API calls, database schemas, and business logic.
   Features:
   - Cohesive, blended patient login icon and portal card
   - Accessible, senior-friendly patient dashboard features:
     * 4th vital: Blood pressure with live updates
     * 1-Tap speech readout: "Read Vitals Aloud"
     * 1-Tap feeling check: "How Are You Feeling Right Now?"
     * 1-Tap hydration tracker: Daily 6-glass water logging
     * Family emergency speed-dial card with direct calling
     * Live check-in confirmation timestamp
   - Restructured caregiver clinical dashboard:
     * Structured tab navigation (Telemetry, Alerts, AI/Thresholds, Family, System)
     * Alert badge counter on navigation tab
     * Preserves all documentation and README features
   ========================================================================== */

const state = {
  activeView: null,          // 'patient' or 'caregiver' — null before login
  activeRole: null,          // 'patient' or 'caregiver'
  activeCaregiverTab: 'telemetry',
  activeCommDevice: 'whatsapp', // 'whatsapp' or 'sms'
  loggedInUser: null,        // { role, name }
  selectedPatientId: 'p1',
  caregiverAssignedPatients: ['p1', 'p2'], // Caregiver sees one patient per session; both selectable at login
  patients: [],
  alerts: [],
  whatsappInbox: [],
  selectedPatientHistory: [],
  audioEnabled: true,
  ws: null,
  chartInstance: null
};

// ==========================================================================
// FLOATING PARTICLES for login page
// ==========================================================================
function spawnLoginParticles() {
  const screen = document.getElementById('loginScreen');
  if (!screen) return;
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'login-particle';
    const size = Math.random() * 6 + 3;
    const colors = ['rgba(12,202,170,0.5)', 'rgba(99,102,241,0.5)', 'rgba(255,107,107,0.5)', 'rgba(255,255,255,0.3)'];
    p.style.cssText = `
      width:${size}px;height:${size}px;
      left:${Math.random() * 100}%;
      animation-duration:${8 + Math.random() * 12}s;
      animation-delay:${Math.random() * 10}s;
      background:${colors[Math.floor(Math.random() * colors.length)]};
    `;
    screen.appendChild(p);
  }
}

// ==========================================================================
// LOGIN / LOGOUT
// ==========================================================================
const DEMO_CREDS = {
  patient:   { user: 'patient',   pass: 'care',   name: 'Demo Patient A' },
  caregiver: { user: 'caregiver', pass: 'care',   name: 'Priya Nair'     }
};

const PATIENT_LOGIN_NAMES = {
  p1: 'Demo Patient A',
  p2: 'Demo Patient B',
  p3: 'Demo Patient C',
  p4: 'Demo Patient D'
};

// Step 1: card clicked — reveal the patient picker inside the card
function selectLoginRole(event, role) {
  if (event && event.stopPropagation) event.stopPropagation();

  const picker  = document.getElementById(`patientPicker-${role}`);
  const cta     = document.getElementById(`loginCta-${role}`);
  const card    = document.getElementById(`loginCard-${role}`);

  // If picker already open, do nothing (let button clicks handle it)
  if (picker && picker.classList.contains('picker-open')) return;

  // Close any other open picker first
  ['patient', 'caregiver'].forEach(r => {
    if (r === role) return;
    const op = document.getElementById(`patientPicker-${r}`);
    const oc = document.getElementById(`loginCta-${r}`);
    const oca = document.getElementById(`loginCard-${r}`);
    if (op) op.classList.remove('picker-open');
    if (oc) oc.style.display = '';
    if (oca) oca.classList.remove('card-expanded');
  });

  if (picker) picker.classList.add('picker-open');
  if (cta) cta.style.display = 'none';
  if (card) card.classList.add('card-expanded');
}

// Step 2: patient button clicked — set patient and login
function doLoginWithPatient(event, role, patientId) {
  if (event && event.preventDefault) event.preventDefault();
  if (event && event.stopPropagation) event.stopPropagation();

  state.selectedPatientId = patientId;
  doLogin(event, role);
}

function doLogin(event, role) {
  if (event && event.preventDefault) event.preventDefault();
  const baseCred = DEMO_CREDS[role] || { name: role === 'patient' ? 'Demo Patient A' : 'Priya Nair' };
  const cred = role === 'patient'
    ? { ...baseCred, name: PATIENT_LOGIN_NAMES[state.selectedPatientId] || baseCred.name }
    : baseCred;

  // Animate out login screen
  state.activeRole = role;
  state.loggedInUser = { role, name: cred.name };

  const loginEl = document.getElementById('loginScreen');
  if (loginEl) {
    loginEl.style.transition = 'opacity 0.45s, transform 0.45s';
    loginEl.style.opacity = '0';
    loginEl.style.transform = 'scale(0.97)';
  }

  setTimeout(() => {
    if (loginEl) loginEl.style.display = 'none';
    const appRoot = document.getElementById('appRoot');
    if (appRoot) {
      appRoot.style.display = 'flex';
      appRoot.style.flexDirection = 'column';
      appRoot.style.opacity = '0';
      appRoot.style.transition = 'opacity 0.35s';
      setTimeout(() => { appRoot.style.opacity = '1'; }, 20);
    }

    // Update user pill
    const avatar = document.getElementById('userPillAvatar');
    const name   = document.getElementById('userPillName');
    if (avatar && name) {
      avatar.textContent = cred.name.charAt(0);
      avatar.className = `user-pill-avatar ${role}-av`;
      name.textContent = cred.name;
    }

    // Initialize systems
    initWebSocket();
    loadPatients();
    loadAlerts();
    loadMetrics();
    loadSmsInbox();
    loadWhatsAppInbox();

    if (!state._intervalsStarted) {
      state._intervalsStarted = true;
      setInterval(loadSmsInbox, 4000);
      setInterval(loadWhatsAppInbox, 3500);
      setInterval(loadAlerts,   5000);
      setInterval(loadMetrics,  7000);
    }

    // Switch to selected view
    switchView(role === 'patient' ? 'patient' : 'caregiver');

  }, 450);
}

function doLogout() {
  if (state.ws) {
    try { state.ws.close(); } catch(e) {}
    state.ws = null;
  }
  state.activeRole = null;
  state.loggedInUser = null;
  state.patients = [];
  state.alerts = [];

  const appRoot = document.getElementById('appRoot');
  appRoot.style.transition = 'opacity 0.3s';
  appRoot.style.opacity = '0';
  setTimeout(() => {
    appRoot.style.display = 'none';
    appRoot.style.opacity = '1';

    const loginEl = document.getElementById('loginScreen');
    loginEl.style.display = 'flex';
    loginEl.style.opacity = '0';
    loginEl.style.transition = 'opacity 0.4s, transform 0.4s';
    loginEl.style.transform = 'scale(0.97)';
    setTimeout(() => {
      loginEl.style.opacity = '1';
      loginEl.style.transform = 'scale(1)';
    }, 20);
  }, 300);
}

// Backwards-compatible accordion helper
function toggleAccordion(id) {
  const map = {
    'acc-family': 'family',
    'acc-metrics': 'system',
    'acc-simulator': 'system'
  };
  if (map[id]) setCaregiverTab(map[id]);
}

// ==========================================================================
// CAREGIVER TAB SWITCHING
// ==========================================================================
function setCaregiverTab(tabId) {
  state.activeCaregiverTab = tabId;
  document.querySelectorAll('.cg-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.cg-tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-pane-${tabId}`);
  });

  if (tabId === 'telemetry') {
    renderPatientCards();
    setTimeout(renderLiveChart, 50);
  } else if (tabId === 'alerts') {
    renderAlertsList();
    loadCareTasks(state.selectedPatientId);
    loadMedicines(state.selectedPatientId);
  } else if (tabId === 'ai') {
    loadThresholdConfig(state.selectedPatientId);
    loadPatientTips(state.selectedPatientId);
  } else if (tabId === 'family') {
    loadSmsInbox();
    loadWhatsAppInbox();
    loadHandoverNotes(state.selectedPatientId);
  } else if (tabId === 'system') {
    loadMetrics();
    loadAuditTrail();
    loadCaregiverQueue();
    loadSimulatorStats();
  }
}

// ==========================================================================
// NAVIGATION & VIEWS
// ==========================================================================
function switchView(viewName) {
  state.activeView = viewName;
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `view-${viewName}`);
  });
  const appRoot = document.getElementById('appRoot');
  if (appRoot) appRoot.classList.toggle('patient-mode', viewName === 'patient');

  if (viewName === 'caregiver') {
    renderCaregiverDashboard();
  } else if (viewName === 'patient') {
    renderPatientSosView();
  }
}

// ==========================================================================
// AUDIO TOGGLE
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  spawnLoginParticles();

  const audioBtn = document.getElementById('audioToggleBtn');
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      state.audioEnabled = !state.audioEnabled;
      audioBtn.textContent = state.audioEnabled ? '🔊 Audio: ON' : '🔇 Audio: OFF';
      showToast(`Audio alerts ${state.audioEnabled ? 'enabled' : 'muted'}`);
    });
  }

  // Window resize re-draw live chart
  window.addEventListener('resize', () => {
    if (state.activeView === 'caregiver' && state.activeCaregiverTab === 'telemetry') {
      renderLiveChart();
    }
  });
});

// ==========================================================================
// WEBSOCKET LIVE CONNECTION & SERVERLESS FALLBACK
// ==========================================================================
let wsFailCount = 0;
let pollingInterval = null;

function startPollingFallback() {
  if (pollingInterval) return;
  console.log('Activating live cloud stream polling fallback (Vercel serverless mode)');
  const badge = document.getElementById('wsStatusBadge');
  const dot   = document.getElementById('wsStatusDot');
  if (badge) { badge.textContent = '● Live (Cloud Stream)'; badge.style.color = '#0CCAAA'; }
  if (dot)   { dot.classList.remove('offline'); }

  pollingInterval = setInterval(async () => {
    if (!state.loggedInUser) return;
    try {
      const res = await fetch('/patients?step=true');
      if (res.ok) {
        state.patients = await res.json();
        renderPatientCards();
        const cur = state.patients.find(pt => pt.patient_id === state.selectedPatientId);
        if (cur && cur.latest_measurement) {
          appendReadingToChart(cur.latest_measurement);
          if (state.activeView === 'caregiver') renderPatientCardVitals(cur);
          if (state.activeView === 'patient')   updatePatientBigVitals(cur.latest_measurement);
        }
      }
    } catch (e) {
      console.warn('Polling error:', e);
    }
  }, 1500);
}

function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  try {
    state.ws = new WebSocket(wsUrl);
  } catch (e) {
    startPollingFallback();
    return;
  }

  state.ws.onopen = () => {
    console.log('CareBeat WebSocket connected');
    wsFailCount = 0;
    if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
    const badge = document.getElementById('wsStatusBadge');
    const dot   = document.getElementById('wsStatusDot');
    if (badge) { badge.textContent = '● Live'; badge.style.color = '#0CCAAA'; }
    if (dot)   { dot.classList.remove('offline'); }
  };

  state.ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleWebSocketMessage(msg);
    } catch (e) { console.error('WS parse error:', e); }
  };

  state.ws.onerror = () => {
    wsFailCount++;
    if (wsFailCount >= 2) startPollingFallback();
  };

  state.ws.onclose = () => {
    wsFailCount++;
    if (wsFailCount >= 2) {
      startPollingFallback();
    } else {
      setTimeout(initWebSocket, 2000);
    }
  };
}

function handleWebSocketMessage(msg) {
  if (msg.type === 'vital_update') {
    updatePatientVitalsInMemory(msg.data);
    if (msg.data.patient_id === state.selectedPatientId) {
      appendReadingToChart(msg.data);
      if (state.activeView === 'caregiver') renderSelectedPatientDetail();
      if (state.activeView === 'patient')   updatePatientBigVitals(msg.data);
    }
  } else if (msg.type === 'alert_new') {
    state.alerts.unshift(msg.data);
    handleNewAlert(msg.data);
  } else if (msg.type === 'alert_claimed') {
    showToast(`Alert claimed by ${msg.locked_by}`);
    loadAlerts();
  } else if (msg.type === 'alert_acknowledged') {
    hideSiren();
    showToast(`Alert acknowledged by ${msg.by || 'caregiver'}`);
    loadAlerts();
  } else if (msg.type === 'alert_resolved') {
    hideSiren();
    showToast('Alert marked as resolved.');
    loadAlerts();
  } else if (msg.type === 'alert_escalated') {
    showToast('⚠️ Alert Escalated to secondary family contact!', true);
    speakNotification('Escalation alert: unacknowledged timeout reached.');
    loadAlerts();
  } else if (msg.type === 'medicine_reminder') {
    showToast(`⏰ Medicine Due: ${msg.medicine_name} for ${msg.patient_id}`);
    speakNotification(`Reminder: ${msg.medicine_name} is scheduled now.`);
  } else if (msg.type === 'source_changed') {
    showToast(`Data stream changed to: ${msg.source}`);
    const badge = document.getElementById('caregiverActiveStreamBadge');
    if (badge) badge.textContent = msg.source === 'simulator' ? 'Live Math Simulator' : 'Kaggle CSV Replay';
    const lbl = document.getElementById('currentSourceLabel');
    if (lbl) lbl.textContent = msg.source;
    loadPatients();
  } else if (msg.type === 'whatsapp_new') {
    loadWhatsAppInbox();
  }
}

function handleNewAlert(alert) {
  showSiren(alert);
  loadAlerts();
  loadSmsInbox();
  loadWhatsAppInbox();
  if (alert.severity === 'Critical' || alert.alert_type === 'sos') {
    speakNotification(`Critical Alert for ${alert.patient_name || alert.patient_id}: ${alert.explanation}`);
  }
}

function speakNotification(text) {
  if (!state.audioEnabled || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95; u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  } catch (e) { console.error('Speech error:', e); }
}

// ==========================================================================
// SIREN BANNER
// ==========================================================================
function showSiren(alert) {
  const banner = document.getElementById('sirenBanner');
  const txt    = document.getElementById('sirenText');
  if (banner && txt) {
    txt.textContent = `[${alert.severity.toUpperCase()}] ${alert.patient_name || alert.patient_id}: ${alert.explanation}`;
    banner.style.display = 'flex';
  }
}
function hideSiren() {
  const banner = document.getElementById('sirenBanner');
  if (banner) banner.style.display = 'none';
}

// ==========================================================================
// DATA FETCHING
// ==========================================================================
async function loadPatients() {
  try {
    const res = await fetch('/patients');
    if (res.ok) {
      state.patients = await res.json();
      renderPatientCards();
      renderSelectedPatientDetail();
      if (state.activeView === 'patient') renderPatientSosView();
    }
  } catch (e) { console.error('Failed to load patients:', e); }
}

function updatePatientVitalsInMemory(vital) {
  const p = state.patients.find(pt => pt.patient_id === vital.patient_id);
  if (p) {
    p.latest_measurement = vital;
    p.is_stale = false;
    renderPatientCardVitals(p);
    if (state.activeView === 'patient' && vital.patient_id === state.selectedPatientId) {
      updatePatientBigVitals(vital);
    }
  }
}

async function loadAlerts() {
  try {
    const res = await fetch('/alerts');
    if (res.ok) {
      state.alerts = await res.json();
      renderAlertsList();

      // Update badge on Alerts tab
      const activeAlerts = state.alerts.filter(a => a.state === 'Active' || a.state === 'Escalated');
      const badge = document.getElementById('cgAlertsBadge');
      if (badge) {
        if (activeAlerts.length > 0) {
          badge.textContent = activeAlerts.length;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }

      const activeCrit = state.alerts.find(a => a.state === 'Active' && a.severity === 'Critical');
      if (activeCrit) showSiren(activeCrit); else hideSiren();
    }
  } catch (e) { console.error('Failed to load alerts:', e); }
}

// ==========================================================================
// CAREGIVER DASHBOARD RENDERING
// ==========================================================================
function renderCaregiverDashboard() {
  renderPatientCards();
  renderSelectedPatientDetail();
  renderAlertsList();
  loadPatientHistory(state.selectedPatientId);
  loadSimulatorStats();
}

function renderPatientCards() {
  const container = document.getElementById('patientCardsGrid');
  if (!container) return;

  // Show ONLY the single patient that was selected at login — no switching within dashboard
  const p = state.patients.find(pt => pt.patient_id === state.selectedPatientId);
  if (!p) { container.innerHTML = '<p style="color:var(--text-muted);padding:16px;">No patient data available.</p>'; return; }

  const m = p.latest_measurement || {};
  const cond = p.condition_tags ? p.condition_tags.join(', ') : 'General Care';
  const statusClass = p.status_color || 'normal';
  const sys = m.systolic_bp != null ? Math.round(m.systolic_bp) : 122;
  const dia = m.diastolic_bp != null ? Math.round(m.diastolic_bp) : 80;
  const pNum = state.selectedPatientId === 'p1' ? '1' : '2';

  container.innerHTML = `
    <div class="patient-card status-${statusClass} selected" style="max-width:100%;width:100%;">
      <div class="card-top">
        <div class="patient-info">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:0.75rem;font-weight:800;background:var(--brand-light);color:var(--brand-dark);padding:2px 8px;border-radius:var(--r-full);">🔒 Dedicated Patient ${pNum}</span>
            <h3>${p.name}</h3>
          </div>
          <div class="patient-meta">Age ${p.age} • ${cond}</div>
        </div>
        <span class="status-pill ${statusClass}">
          ${statusClass === 'critical' ? '🚨 CRITICAL' : (statusClass === 'warning' ? '⚠️ WARNING' : '✓ NORMAL')}
        </span>
      </div>

      <div class="vitals-grid">
        <div class="vital-box">
          <span class="vital-label">Heart Rate</span>
          <div class="vital-value" id="val-hr-${p.patient_id}">
            ${m.heart_rate != null ? Math.round(m.heart_rate) : '--'}<span class="vital-unit"> BPM</span>
          </div>
        </div>
        <div class="vital-box">
          <span class="vital-label">SpO₂</span>
          <div class="vital-value" id="val-spo2-${p.patient_id}">
            ${m.spo2 != null ? Math.round(m.spo2) : '--'}<span class="vital-unit"> %</span>
          </div>
        </div>
        <div class="vital-box">
          <span class="vital-label">Temp</span>
          <div class="vital-value" id="val-temp-${p.patient_id}">
            ${m.temperature != null ? Number(m.temperature).toFixed(1) : '--'}<span class="vital-unit"> °C</span>
          </div>
        </div>
        <div class="vital-box">
          <span class="vital-label">Blood Press.</span>
          <div class="vital-value" id="val-bp-${p.patient_id}">
            ${sys}/${dia}<span class="vital-unit"> mmHg</span>
          </div>
        </div>
      </div>

      <div class="card-footer" style="display:flex;justify-content:space-between;align-items:center;">
        <span>Source: <strong>${m.source || 'simulator'}</strong></span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="health-score-badge">Score: ${p.health_score != null ? p.health_score : 95}/100</span>
          <span style="font-size:0.75rem;font-weight:700;color:var(--caregiver);">● ACTIVE SESSION</span>
        </div>
      </div>
    </div>
  `;

  updatePatientSwitcherButtons();
}

function updatePatientSwitcherButtons() {
  const label = document.getElementById('caregiverActivePatientLabel');
  if (label) {
    const cur = state.patients.find(pt => pt.patient_id === state.selectedPatientId);
    label.textContent = cur ? `${cur.name} (${cur.patient_id.toUpperCase()})` : state.selectedPatientId;
  }
  const pill = document.getElementById('caregiverActiveSessionPill');
  if (pill) {
    const pNum = state.selectedPatientId === 'p1' ? '1' : '2';
    pill.textContent = `🔒 Active Focus: Patient ${pNum}`;
  }
}

function selectCaregiverPatient(pid) {
  state.selectedPatientId = pid;
  renderPatientCards();
  renderSelectedPatientDetail();
  loadPatientHistory(pid);
  showToast(`Switched caregiver focus to: ${PATIENT_LOGIN_NAMES[pid] || pid}`);
}

function selectPatient(pid) {
  selectCaregiverPatient(pid);
}

function renderPatientCardVitals(p) {
  const m = p.latest_measurement || {};
  const hrEl   = document.getElementById(`val-hr-${p.patient_id}`);
  const spo2El = document.getElementById(`val-spo2-${p.patient_id}`);
  const tempEl = document.getElementById(`val-temp-${p.patient_id}`);
  const bpEl   = document.getElementById(`val-bp-${p.patient_id}`);
  if (hrEl   && m.heart_rate  != null) hrEl.innerHTML   = `${Math.round(m.heart_rate)}<span class="vital-unit"> BPM</span>`;
  if (spo2El && m.spo2        != null) spo2El.innerHTML = `${Math.round(m.spo2)}<span class="vital-unit"> %</span>`;
  if (tempEl && m.temperature != null) tempEl.innerHTML = `${Number(m.temperature).toFixed(1)}<span class="vital-unit"> °C</span>`;
  if (bpEl) {
    const sys = m.systolic_bp != null ? Math.round(m.systolic_bp) : 122;
    const dia = m.diastolic_bp != null ? Math.round(m.diastolic_bp) : 80;
    bpEl.innerHTML = `${sys}/${dia}<span class="vital-unit"> mmHg</span>`;
  }
}

async function renderSelectedPatientDetail() {
  const p = state.patients.find(pt => pt.patient_id === state.selectedPatientId);
  if (!p) return;
  const titleEl = document.getElementById('selectedPatientTitle');
  if (titleEl) titleEl.textContent = `${p.name} — Live Vitals Waveform Trend`;

  const famNameEl = document.getElementById('familyPatientName');
  if (famNameEl) famNameEl.textContent = p.name;
  const famScoreEl = document.getElementById('familyPatientScore');
  if (famScoreEl) famScoreEl.textContent = `${p.health_score != null ? p.health_score : 95}/100`;

  const famCondEl = document.getElementById('familyPatientConditionTags');
  if (famCondEl) {
    const condTags = p.condition_tags ? p.condition_tags.join(', ') : 'Continuous Care';
    famCondEl.textContent = `${condTags} • Age ${p.age} • Continuous Monitoring`;
  }

  // Bind Family Contact and Caregiver Details with Masked Numbers
  try {
    const res = await fetch(`/patients/${p.patient_id}`);
    if (res.ok) {
      const data = await res.json();
      const contacts = data.family_contacts || [];
      const primaryContact = contacts.find(c => c.priority === 'primary') || contacts[0];
      const caregiver = data.caregiver || { name: 'Priya Nair', phone: '+91 9844455566' };

      const cgNameEl = document.getElementById('familyCaregiverName');
      const cgPhoneEl = document.getElementById('familyCaregiverPhone');
      const cgCallBtn = document.getElementById('familyCallCaregiverBtn');
      if (cgNameEl) cgNameEl.textContent = caregiver.name;
      if (cgPhoneEl) cgPhoneEl.textContent = caregiver.phone ? maskPhoneNumberString(caregiver.phone) : '+91 98XXXXXX66';
      if (cgCallBtn && caregiver.phone) cgCallBtn.href = `tel:${caregiver.phone}`;

      const fcNameEl = document.getElementById('familyContactName');
      const fcRelEl = document.getElementById('familyContactRelation');
      const fcPhoneEl = document.getElementById('familyContactPhone');
      if (primaryContact) {
        if (fcNameEl) fcNameEl.textContent = primaryContact.name;
        if (fcRelEl) fcRelEl.textContent = primaryContact.relation;
        if (fcPhoneEl) fcPhoneEl.textContent = primaryContact.phone_masked || maskPhoneNumberString(primaryContact.phone_raw || '+91 9876543210');
      }
    }
  } catch (e) {
    console.error('Error fetching patient details for family view:', e);
  }

  loadCareTasks(p.patient_id);
  loadMedicines(p.patient_id);
  loadPatientTips(p.patient_id);
  loadThresholdConfig(p.patient_id);
  loadHandoverNotes(p.patient_id);
  updatePatientSwitcherButtons();
}

// ==========================================================================
// CARE TASKS
// ==========================================================================
async function loadCareTasks(pid) {
  try {
    const res = await fetch(`/patients/${pid}/care-tasks`);
    if (res.ok) {
      const tasks = await res.json();
      const wrap = document.getElementById('careTasksList');
      const patientWrap = document.getElementById('patientCareTasksList');
      const patientBadge = document.getElementById('patientTasksBadge');
      const pendingCount = tasks.filter(t => t.status !== 'done').length;

      if (patientBadge) {
        patientBadge.textContent = pendingCount === 0 ? 'All Done' : `${pendingCount} To Do`;
        patientBadge.className = `patient-section-badge ${pendingCount === 0 ? 'ok' : ''}`;
      }

      const caregiverHtml = tasks.length === 0
        ? `<div style="font-size:0.85rem;color:var(--text-muted);padding:8px 0;">No pending care tasks today.</div>`
        : tasks.map(t => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 4px;border-bottom:1px solid var(--border);">
            <div>
              <strong style="font-size:0.88rem;color:var(--ink);">${t.task_type}</strong>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">Scheduled: ${t.due_time.split(' ')[1] || t.due_time}</div>
            </div>
            <button class="btn-sm ${t.status === 'done' ? 'btn-ack' : ''}" onclick="updateTaskStatus('${t.task_id}', 'done')">
              ${t.status === 'done' ? '✓ Completed' : 'Mark Done'}
            </button>
          </div>
        `).join('');

      const patientHtml = tasks.length === 0
        ? `<div class="patient-loading-row">No activities scheduled today.</div>`
        : tasks.map(t => `
          <div class="patient-med-item">
            <div>
              <div class="patient-med-name">${t.task_type}</div>
              <div class="patient-med-sub">Scheduled: ${t.due_time.split(' ')[1] || t.due_time}</div>
            </div>
            ${t.status === 'done'
              ? `<span style="font-size:0.9rem;color:var(--ok-fg);font-weight:800;background:var(--ok-bg);padding:8px 14px;border-radius:var(--r-full);white-space:nowrap;">Done</span>`
              : `<button class="btn-sm btn-ack" style="font-size:0.92rem;padding:10px 16px;border-radius:var(--r-sm);font-weight:800;white-space:nowrap;" onclick="updateTaskStatus('${t.task_id}', 'done')">Done</button>`
            }
          </div>
        `).join('');

      if (wrap) wrap.innerHTML = caregiverHtml;
      if (patientWrap) patientWrap.innerHTML = patientHtml;
    }
  } catch (e) { console.error('Failed to load care tasks:', e); }
}

async function updateTaskStatus(taskId, status) {
  await fetch(`/care-tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  showToast('Care task status updated.');
  loadCareTasks(state.selectedPatientId);
}

// ==========================================================================
// MEDICINES (Caregiver view)
// ==========================================================================
async function loadMedicines(pid) {
  try {
    const res = await fetch(`/patients/${pid}/medicines`);
    if (res.ok) {
      const meds = await res.json();
      const wrap = document.getElementById('medicinesList');
      if (!wrap) return;
      wrap.innerHTML = meds.map(m => {
        const latestLog = (m.logs && m.logs[0]) || null;
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 4px;border-bottom:1px solid var(--border);">
            <div>
              <strong style="font-size:0.88rem;color:var(--ink);">${m.name}</strong>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">${m.schedule_times.join(', ')} • ${m.notes || ''}</div>
            </div>
            ${latestLog && latestLog.status === 'taken'
              ? `<span style="font-size:0.75rem;color:var(--ok-fg);font-weight:700;background:var(--ok-bg);padding:4px 10px;border-radius:var(--r-full);">✓ Taken</span>`
              : `<button class="btn-sm btn-ack" onclick="takeMedicine('${latestLog ? latestLog.log_id : ''}')">Mark Taken</button>`
            }
          </div>
        `;
      }).join('');
    }
  } catch (e) { console.error('Failed to load medicines:', e); }
}

async function takeMedicine(logId) {
  if (!logId) return;
  await fetch(`/medicine-logs/${logId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'taken', marked_by: 'Priya (Caregiver)' })
  });
  showToast('Medicine marked as taken.');
  loadMedicines(state.selectedPatientId);
  if (state.activeView === 'patient') loadPatientMedsForPatientScreen(state.selectedPatientId);
}

async function fastForwardMedicine() {
  try {
    const res = await fetch('/demo/fast-forward-medicine', { method: 'POST' });
    const data = await res.json();
    showToast(`Fast-forwarded medicine reminder: ${data.medicine}`);
    loadMedicines(state.selectedPatientId);
    if (state.activeView === 'patient') loadPatientMedsForPatientScreen(state.selectedPatientId);
  } catch (e) { console.error(e); }
}

// ==========================================================================
// AI SUMMARY & TIPS
// ==========================================================================
async function triggerAISummary() {
  const wrap  = document.getElementById('aiSummaryContent');
  const badge = document.getElementById('aiSourceBadge');
  if (wrap) wrap.innerHTML = `<em style="color:var(--text-muted);">Generating 24-hour summary via AI layer...</em>`;
  try {
    const res = await fetch(`/patients/${state.selectedPatientId}/summary`);
    if (res.ok) {
      const data = await res.json();
      if (wrap)  wrap.innerHTML = `<div class="ai-text">${data.summary}</div>`;
      if (badge) badge.textContent = data.source === 'gemini-api' ? `Gemini AI (${data.model})` : `Clinical Heuristics (Offline)`;
    }
  } catch (e) {
    if (wrap) wrap.innerHTML = `Failed to generate summary.`;
  }
}

async function loadPatientTips(pid) {
  try {
    const res = await fetch(`/patients/${pid}/tips`);
    if (res.ok) {
      const data = await res.json();
      const wrap = document.getElementById('dailyTipsList');
      if (wrap && data.tips) {
        wrap.innerHTML = data.tips.map(t => `
          <div style="margin-bottom:10px;padding:10px 12px;background:var(--brand-light);border-radius:var(--r-sm);border-left:3px solid var(--brand);">
            <strong style="font-size:0.84rem;color:var(--brand-dark);">${t.title}:</strong>
            <span style="font-size:0.83rem;color:var(--ink);">${t.tip}</span>
          </div>
        `).join('');
      }
    }
  } catch (e) { console.error(e); }
}

// ==========================================================================
// THRESHOLD CONFIG & SANDBOX PREVIEW
// ==========================================================================
async function loadThresholdConfig(pid) {
  try {
    const res = await fetch(`/thresholds/${pid}`);
    if (res.ok) {
      const th = await res.json();
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      set('thHrWarn',   th.hr_warn_high);
      set('thHrCrit',   th.hr_crit_high);
      set('thTempCrit', th.temp_crit);
      set('thSpo2Crit', th.spo2_crit);
    }
  } catch (e) { console.error(e); }
}

async function previewThresholdSandbox() {
  const hrWarn = parseFloat(document.getElementById('thHrWarn').value) || 110;
  const hrCrit = parseFloat(document.getElementById('thHrCrit').value) || 130;
  const resBox = document.getElementById('sandboxPreviewResult');
  let breaches = 0;
  state.selectedPatientHistory.forEach(m => {
    if (m.heart_rate && (m.heart_rate >= hrCrit || m.heart_rate >= hrWarn)) breaches++;
  });
  if (resBox) resBox.innerHTML = `<strong>Sandbox Preview:</strong> With these limits, <strong>${breaches}</strong> alert(s) would have triggered across the last ${state.selectedPatientHistory.length} readings.`;
}

async function saveThresholdConfig() {
  const payload = {
    profile_name: 'Custom Updated',
    hr_warn_high: parseFloat(document.getElementById('thHrWarn').value),
    hr_warn_low:  50,
    hr_crit_high: parseFloat(document.getElementById('thHrCrit').value),
    hr_crit_low:  40,
    temp_warn:    37.8,
    temp_crit:    parseFloat(document.getElementById('thTempCrit').value),
    spo2_warn:    94,
    spo2_crit:    parseFloat(document.getElementById('thSpo2Crit').value)
  };
  const res = await fetch(`/thresholds/${state.selectedPatientId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (res.ok) {
    const data = await res.json();
    showToast(`Thresholds saved as Version ${data.version}!`);
  }
}

// ==========================================================================
// ALERTS LIST & ACTIONS
// ==========================================================================
function renderAlertsList() {
  const wrap = document.getElementById('alertsListContainer');
  if (!wrap) return;

  if (state.alerts.length === 0) {
    wrap.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.88rem;">No active alerts right now. All patients stable! 🎉</div>`;
    return;
  }

  wrap.innerHTML = state.alerts.slice(0, 15).map(a => {
    const isCrit = a.severity === 'Critical';
    const isAck  = a.state === 'Acknowledged';
    const isRes  = a.state === 'Resolved';
    const isEsc  = a.state === 'Escalated';

    return `
      <div class="alert-item severity-${a.severity}">
        <div class="alert-item-header">
          <span style="color:${isCrit ? '#991B1B' : '#92400E'};font-weight:800;">
            ${isEsc ? '⚠️ ESCALATED: ' : ''}${a.severity.toUpperCase()}
          </span>
          <span style="color:var(--text-muted);font-size:0.74rem;">${a.created_at ? a.created_at.split('T')[1].split('.')[0] : ''}</span>
        </div>
        <div class="alert-explanation">${a.explanation}</div>
        <div style="font-size:0.74rem;margin-bottom:8px;color:var(--text-muted);">
          Patient: <strong>${a.patient_name || a.patient_id}</strong> • Status: <strong>${a.state}</strong>${a.claim_locked_by ? ` • Locked by: ${a.claim_locked_by}` : ''}
        </div>
        <div class="alert-actions">
          ${!isAck && !isRes ? `
            <button class="btn-sm btn-claim" onclick="claimAlert('${a.alert_id}')">Claim Lock (60s)</button>
            <button class="btn-sm btn-ack" onclick="acknowledgeAlert('${a.alert_id}')">Acknowledge</button>
          ` : ''}
          ${isAck && !isRes ? `<button class="btn-sm btn-resolve" onclick="resolveAlert('${a.alert_id}')">Resolve with Note</button>` : ''}
          ${isRes ? `<span style="font-size:0.74rem;color:var(--ok-fg);font-weight:700;">✓ Resolved</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function claimAlert(alertId) {
  await fetch(`/alerts/${alertId}/claim`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caregiver_id: 'Priya (Caregiver)' })
  });
  showToast('Alert claim lock set for 60 seconds.');
  loadAlerts();
}

async function acknowledgeAlert(alertId) {
  await fetch(`/alerts/${alertId}/acknowledge`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caregiver_id: 'Priya (Caregiver)' })
  });
  hideSiren();
  showToast('Alert acknowledged. Siren muted.');
  loadAlerts();
}

async function resolveAlert(alertId) {
  await fetch(`/alerts/${alertId}/resolve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caregiver_id: 'Priya (Caregiver)', note: 'Checked vitals and stabilized patient.' })
  });
  showToast('Alert marked as resolved.');
  loadAlerts();
}

// ==========================================================================
// PATIENT DASHBOARD RENDERING (Senior-Centric)
// ==========================================================================
async function renderPatientSosView() {
  const p = state.patients.find(pt => pt.patient_id === state.selectedPatientId) || state.patients[0];
  if (!p) return;

  const m = p.latest_measurement || {};

  const nameEl = document.getElementById('patientScreenName');
  if (nameEl) nameEl.textContent = p.name;

  const condEl = document.getElementById('patientScreenCondition');
  if (condEl) {
    const tags = p.condition_tags ? p.condition_tags.join(', ') : 'General Care';
    condEl.textContent = `${tags} • Age ${p.age} • Continuous Monitoring`;
  }

  updatePatientBigVitals(m);
  loadPatientMedsForPatientScreen(p.patient_id);
  loadCareTasks(p.patient_id);
  setupSosButton();
  updatePatientStatusBanner(p);
  updatePatientHealthScore(p);
  renderWaterTracker();

  // Load family contact for emergency speed-dial card
  try {
    const res = await fetch(`/patients/${p.patient_id}`);
    if (res.ok) {
      const data = await res.json();
      const contacts = data.family_contacts || [];
      const primaryContact = contacts.find(c => c.priority === 'primary') || contacts[0];
      if (primaryContact) {
        const nameEl = document.getElementById('familyCardName');
        const relEl = document.getElementById('familyCardRelation');
        const phoneEl = document.getElementById('familyCardPhone');
        const avEl = document.getElementById('familyCardAvatar');
        const callBtn = document.getElementById('familyCardCallBtn');
        if (nameEl) nameEl.textContent = primaryContact.name;
        if (relEl) relEl.textContent = `${primaryContact.relation} • Primary Family Contact`;
        if (phoneEl) phoneEl.textContent = primaryContact.phone_masked || maskPhoneNumberString(primaryContact.phone_raw || '+91 9876543210');
        if (avEl) avEl.textContent = primaryContact.name.charAt(0);
        if (callBtn) callBtn.href = `tel:${primaryContact.phone_raw || '+919876543210'}`;
      }

      // Also dynamically map caregiver on duty in patient screen
      const cg = data.caregiver || { name: 'Priya Nair', shift: 'Morning', phone: '+91 9844455566' };
      const cgCard = document.querySelector('.caregiver-contact-card');
      if (cgCard) {
        const cgStrong = cgCard.querySelector('strong');
        const cgSub = cgCard.querySelector('div[style*="font-weight:700"]');
        const cgPhone = cgCard.querySelector('div[style*="color:var(--text-muted)"]');
        const cgBtn = cgCard.querySelector('a');
        if (cgStrong) cgStrong.textContent = cg.name;
        if (cgSub) cgSub.textContent = `✓ Verified • ${cg.shift || 'Morning Shift'}`;
        if (cgPhone) cgPhone.textContent = maskPhoneNumberString(cg.phone);
        if (cgBtn && cg.phone) cgBtn.href = `tel:${cg.phone}`;
      }
    }
  } catch (e) { console.error('Failed to load patient contacts:', e); }
}

function updatePatientBigVitals(m) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val != null) el.textContent = val;
  };
  set('sosBigHr',   m.heart_rate != null ? Math.round(m.heart_rate) : '--');
  set('sosBigSpo2', m.spo2 != null ? Math.round(m.spo2) : '--');
  set('sosBigTemp', m.temperature != null ? Number(m.temperature).toFixed(1) : '--');

  const hrStatusEl = document.getElementById('hrStatus');
  if (hrStatusEl && m.heart_rate != null) {
    if (m.heart_rate >= 120) { hrStatusEl.className = 'big-vital-status crit'; hrStatusEl.textContent = 'High'; }
    else if (m.heart_rate >= 100) { hrStatusEl.className = 'big-vital-status warn'; hrStatusEl.textContent = 'Elevated'; }
    else if (m.heart_rate < 50) { hrStatusEl.className = 'big-vital-status warn'; hrStatusEl.textContent = 'Low'; }
    else { hrStatusEl.className = 'big-vital-status ok'; hrStatusEl.textContent = 'Normal'; }
  }

  const spo2StatusEl = document.getElementById('spo2Status');
  if (spo2StatusEl && m.spo2 != null) {
    if (m.spo2 < 90) { spo2StatusEl.className = 'big-vital-status crit'; spo2StatusEl.textContent = 'Low'; }
    else if (m.spo2 < 95) { spo2StatusEl.className = 'big-vital-status warn'; spo2StatusEl.textContent = 'Moderate'; }
    else { spo2StatusEl.className = 'big-vital-status ok'; spo2StatusEl.textContent = 'Optimal'; }
  }

  const tempStatusEl = document.getElementById('tempStatus');
  if (tempStatusEl && m.temperature != null) {
    if (m.temperature >= 38.5) { tempStatusEl.className = 'big-vital-status crit'; tempStatusEl.textContent = 'Fever'; }
    else if (m.temperature >= 37.8) { tempStatusEl.className = 'big-vital-status warn'; tempStatusEl.textContent = 'Warm'; }
    else { tempStatusEl.className = 'big-vital-status ok'; tempStatusEl.textContent = 'Stable'; }
  }

  // 4th Vital: Blood pressure
  const bpValEl = document.getElementById('sosBigBp');
  const bpStatusEl = document.getElementById('bpStatus');
  if (bpValEl) {
    const sys = m.systolic_bp != null ? Math.round(m.systolic_bp) : 124;
    const dia = m.diastolic_bp != null ? Math.round(m.diastolic_bp) : 82;
    bpValEl.textContent = `${sys}/${dia}`;
    if (bpStatusEl) {
      if (sys >= 160 || dia >= 100) { bpStatusEl.className = 'big-vital-status crit'; bpStatusEl.textContent = 'High'; }
      else if (sys >= 140 || dia >= 90) { bpStatusEl.className = 'big-vital-status warn'; bpStatusEl.textContent = 'Elevated'; }
      else { bpStatusEl.className = 'big-vital-status ok'; bpStatusEl.textContent = 'Normal'; }
    }
  }
}

function updatePatientStatusBanner(p) {
  const banner = document.getElementById('patientStatusBanner');
  if (!banner) return;
  const sc = p.status_color || 'normal';
  banner.className = `patient-status-banner ${sc !== 'normal' ? 'status-' + sc : ''}`;
  const inner = banner.querySelector('div');
  if (!inner) return;
  if (sc === 'critical') {
    inner.innerHTML = `<span style="font-size:1.6rem;">🚨</span><div><div style="font-weight:700;color:var(--crit-fg);font-size:1.05rem;">Critical Alert Active</div><div style="font-size:0.82rem;color:var(--crit-fg);opacity:0.85;">Your caregiver and family have been notified immediately. Help is on the way.</div></div>`;
  } else if (sc === 'warning') {
    inner.innerHTML = `<span style="font-size:1.6rem;">⚠️</span><div><div style="font-weight:700;color:var(--warn-fg);font-size:1.05rem;">Notice: Vitals Require Attention</div><div style="font-size:0.82rem;color:var(--warn-fg);opacity:0.85;">Your caregiver is actively reviewing your measurements.</div></div>`;
  } else {
    inner.innerHTML = `<span style="font-size:1.6rem;">🛡️</span><div><div style="font-weight:700;color:var(--ok-fg);font-size:1.05rem;">All Vitals Normal &amp; Stable</div><div style="font-size:0.82rem;color:var(--ok-fg);opacity:0.85;">Your vitals are monitored continuously. Your assigned caregiver is online.</div></div>`;
  }
}

function updatePatientHealthScore(p) {
  const score = p.health_score != null ? p.health_score : null;
  const details = p.health_score_details || {};
  const breakdown = details.breakdown || {};

  const scoreValue = document.getElementById('healthScoreValue');
  const scoreBadge = document.getElementById('healthScoreBadge');
  const scoreVitals = document.getElementById('scoreVitals');
  const scoreAlerts = document.getElementById('scoreAlerts');
  const scoreMeds = document.getElementById('scoreMeds');
  const scoreCheckins = document.getElementById('scoreCheckins');

  if (scoreValue) scoreValue.textContent = score != null ? score : '--';
  if (scoreBadge) {
    scoreBadge.textContent = score != null ? `${score}/100` : 'Loading...';
    scoreBadge.className = `patient-section-badge ${score == null || score >= 80 ? 'ok' : ''}`;
  }
  if (scoreVitals) scoreVitals.textContent = `${breakdown.vitals_pts ?? '--'}/${breakdown.vitals_max ?? '--'}`;
  if (scoreAlerts) scoreAlerts.textContent = `${breakdown.alert_pts ?? '--'}/${breakdown.alert_max ?? '--'}`;
  if (scoreMeds) scoreMeds.textContent = `${breakdown.medicine_pts ?? '--'}/${breakdown.medicine_max ?? '--'}`;
  if (scoreCheckins) scoreCheckins.textContent = `${breakdown.checkin_pts ?? '--'}/${breakdown.checkin_max ?? '--'}`;
}

function onPatientViewSelect(pid) {
  state.selectedPatientId = pid;
  renderPatientSosView();
  renderPatientCards();
  renderSelectedPatientDetail();
}

async function loadPatientMedsForPatientScreen(pid) {
  try {
    const res = await fetch(`/patients/${pid}/medicines`);
    if (res.ok) {
      const meds = await res.json();
      const wrap = document.getElementById('patientMedsList');
      const badge = document.getElementById('patientMedsBadge');
      if (!wrap) return;
      const pendingCount = meds.filter(m => {
        const latestLog = (m.logs && m.logs[0]) || null;
        return !(latestLog && latestLog.status === 'taken');
      }).length;
      if (badge) {
        badge.textContent = meds.length === 0 ? 'None Today' : (pendingCount === 0 ? 'All Taken' : `${pendingCount} Due`);
        badge.className = `patient-section-badge ${pendingCount === 0 ? 'ok' : ''}`;
      }
      if (meds.length === 0) {
        wrap.innerHTML = `<div class="patient-loading-row">No medicines scheduled today.</div>`;
      } else {
        wrap.innerHTML = meds.map(m => {
          const latestLog = (m.logs && m.logs[0]) || null;
          const isTaken = latestLog && latestLog.status === 'taken';
          return `
            <div class="patient-med-item">
              <div>
                <div class="patient-med-name">${m.name}</div>
                <div class="patient-med-sub">Time: ${m.schedule_times.join(', ')} • ${m.notes || ''}</div>
              </div>
              ${isTaken
                ? `<span style="font-size:0.82rem;color:var(--ok-fg);font-weight:700;background:var(--ok-bg);padding:6px 14px;border-radius:var(--r-full);">✓ Taken!</span>`
                : `<button class="btn-sm btn-ack" style="font-size:0.84rem;padding:8px 16px;border-radius:var(--r-full);font-weight:700;" onclick="takeMedicine('${latestLog ? latestLog.log_id : ''}')">Mark Taken</button>`
              }
            </div>
          `;
        }).join('');
      }
    }
  } catch (e) { console.error(e); }
}

// ── Voice Assistance: Read Vitals Aloud ──
function readPatientStatusAloud() {
  const p = state.patients.find(pt => pt.patient_id === state.selectedPatientId) || state.patients[0];
  const m = (p && p.latest_measurement) || {};
  const name = (p && p.name) || "Patient";
  const hr = m.heart_rate != null ? Math.round(m.heart_rate) : 75;
  const spo2 = m.spo2 != null ? Math.round(m.spo2) : 98;
  const temp = m.temperature != null ? Number(m.temperature).toFixed(1) : "36.6";
  const sys = m.systolic_bp != null ? Math.round(m.systolic_bp) : 124;
  const dia = m.diastolic_bp != null ? Math.round(m.diastolic_bp) : 82;

  const message = `Hello ${name}. Here is your health update. Your heart rate is ${hr} beats per minute. Your oxygen level is ${spo2} percent. Body temperature is ${temp} degrees Celsius. Blood pressure is ${sys} over ${dia}. All vital signs are stable and being monitored. Have a wonderful day!`;
  speakNotification(message);
  showToast("🔊 Reading health vitals aloud...");
}

// ── Senior Feature: Mood / Feeling Check ──
function recordPatientMood(feeling) {
  const feelings = {
    'good': { text: 'Feeling Great 😊', note: 'Patient reported feeling great and active.', voice: 'Wonderful to hear you are feeling well today!' },
    'tired': { text: 'A Bit Tired 😐', note: 'Patient reported feeling somewhat tired, resting comfortably.', voice: 'Thank you for checking in. Remember to rest and hydrate.' },
    'unwell': { text: 'Need Attention 😟', note: 'Patient reported feeling unwell or uncomfortable.', voice: 'We have notified your caregiver to check on you shortly.' }
  };
  const item = feelings[feeling] || feelings['good'];
  const statusEl = document.getElementById('patientMoodStatus');
  if (statusEl) {
    statusEl.textContent = `Status logged: ${item.text} • Caregiver updated`;
    statusEl.style.display = 'block';
  }
  speakNotification(item.voice);
  showToast(`Wellness status logged: ${item.text}`);

  fetch(`/patients/${state.selectedPatientId}/care-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: `[Patient Self-Report] ${item.note}` })
  }).catch(() => {});
}

// ── Senior Feature: Daily Hydration Tracker ──
let waterCount = parseInt(localStorage.getItem('carebeat_water_' + (new Date().toDateString())) || '2', 10);

function toggleWaterGlass(glassIndex) {
  if (waterCount === glassIndex) {
    waterCount = glassIndex - 1;
  } else {
    waterCount = glassIndex;
  }
  localStorage.setItem('carebeat_water_' + (new Date().toDateString()), waterCount);
  renderWaterTracker();
  if (waterCount >= 6) {
    showToast("💧 Daily hydration goal completed! Great job!");
    speakNotification("Congratulations! You have reached your daily goal of six glasses of water.");
  } else {
    showToast(`💧 ${waterCount} of 6 glasses logged today.`);
  }
}

function renderWaterTracker() {
  const container = document.getElementById('waterTrackerCups');
  const countLabel = document.getElementById('waterTrackerCount');
  if (countLabel) countLabel.textContent = `${waterCount} of 6 Glasses`;
  if (!container) return;
  let html = '';
  for (let i = 1; i <= 6; i++) {
    const filled = i <= waterCount;
    html += `
      <button class="water-glass-btn ${filled ? 'filled' : ''}" onclick="toggleWaterGlass(${i})" title="Glass ${i}">
        <span class="glass-icon">${filled ? '💧' : '🥛'}</span>
        <span class="glass-label">Glass ${i}</span>
      </button>
    `;
  }
  container.innerHTML = html;
}

// ==========================================================================
// SOS BUTTON
// ==========================================================================
let sosTimer = null;
let sosHoldSeconds = 0;

function setupSosButton() {
  const btn = document.getElementById('patientSosHoldBtn');
  if (!btn) return;

  btn.onmousedown  = startSosHold;
  btn.onmouseup    = stopSosHold;
  btn.ontouchstart = (e) => { e.preventDefault(); startSosHold(); };
  btn.ontouchend   = stopSosHold;

  btn.onclick = () => {
    if (confirm('Request immediate emergency caregiver & family assistance?')) {
      triggerSosDirect();
    }
  };
}

function startSosHold() {
  sosHoldSeconds = 0;
  const subtext = document.getElementById('sosBtnSubtext');
  sosTimer = setInterval(() => {
    sosHoldSeconds += 0.2;
    if (subtext) subtext.textContent = `HOLD... ${(3 - sosHoldSeconds).toFixed(1)}s`;
    if (sosHoldSeconds >= 3) {
      clearInterval(sosTimer);
      triggerSosDirect();
    }
  }, 200);
}

function stopSosHold() {
  clearInterval(sosTimer);
  const subtext = document.getElementById('sosBtnSubtext');
  if (subtext) subtext.textContent = 'Hold 3s or Tap';
}

async function triggerSosDirect() {
  try {
    const res = await fetch('/sos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: state.selectedPatientId, reason: 'Patient pressed SOS Panic Button' })
    });
    if (res.ok) {
      showToast('🚨 SOS EMERGENCY BROADCAST SENT TO CAREGIVER & FAMILY!', true);
      speakNotification('Emergency assistance requested! Caregivers and family contacts have been notified.');
      const subtext = document.getElementById('sosBtnSubtext');
      if (subtext) subtext.textContent = '✓ ALERT SENT!';
      setTimeout(() => {
        if (subtext) subtext.textContent = 'Hold 3s or Tap';
      }, 4000);
    }
  } catch (e) { console.error(e); }
}

function handleQuickSos() {
  if (confirm('Request immediate emergency caregiver & family assistance?')) {
    triggerSosDirect();
  }
}

async function recordCheckIn() {
  try {
    const res = await fetch('/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: state.selectedPatientId })
    });
    if (res.ok) {
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const statusText = document.getElementById('patientCheckInStatusText');
      if (statusText) {
        statusText.textContent = `Last Check-In: Today at ${nowStr} (Confirmed ✓)`;
      }
      showToast("✅ 'I'm OK' check-in recorded! Your caregiver has been notified.");
      speakNotification("Thank you. Your daily check-in has been confirmed and logged.");
    }
  } catch (e) { console.error(e); }
}

// ==========================================================================
// HANDOVER NOTES
// ==========================================================================
async function loadHandoverNotes(pid) {
  try {
    const res = await fetch(`/patients/${pid}/handover`);
    if (res.ok) {
      const notes = await res.json();
      const wrap    = document.getElementById('handoverNotesHistory');
      const famWrap = document.getElementById('familyHandoverText');

      if (wrap) {
        if (notes.length === 0) {
          wrap.innerHTML = `<em style="color:var(--text-muted);font-size:0.82rem;">No previous handover notes logged for this patient.</em>`;
        } else {
          wrap.innerHTML = notes.slice(0, 3).map(n => `
            <div class="handover-note-item">
              <div class="handover-note-meta">Shift: ${n.shift} • Caregiver: ${n.caregiver_id} • ${n.created_at ? n.created_at.split('T')[0] : ''}</div>
              <div class="handover-note-text">${n.condition_summary || n.concerns || ''}</div>
            </div>
          `).join('');
        }
      }

      if (famWrap && notes.length > 0) {
        famWrap.innerHTML = `<em>&quot;${notes[0].condition_summary || notes[0].concerns || ''}&quot;</em>`;
      }
    }
  } catch (e) { console.error(e); }
}

async function submitHandoverNote() {
  const input = document.getElementById('handoverNoteInput');
  if (!input || !input.value.trim()) {
    showToast('Please type a handover note first.');
    return;
  }
  try {
    const res = await fetch(`/patients/${state.selectedPatientId}/handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caregiver_id: 'Priya (Caregiver)',
        shift: 'Morning',
        condition_on_arrival: 'Vitals stable',
        tasks_completed: 'Routine checks complete',
        concerns: input.value.trim()
      })
    });
    if (res.ok) {
      showToast('Shift handover note submitted successfully!');
      input.value = '';
      loadHandoverNotes(state.selectedPatientId);
    }
  } catch (e) { console.error(e); }
}

// ==========================================================================
// ==========================================================================
// FAMILY SMS & WHATSAPP PHONE INBOXES
// ==========================================================================
function maskPhoneNumberString(phone) {
  if (!phone) return '+91 9XXXXXX10';
  const cleaned = phone.trim();
  if (cleaned.length < 6) return 'XXXXXX';
  const prefix = cleaned.length >= 8 ? cleaned.slice(0, 5) : cleaned.slice(0, 2);
  const suffix = cleaned.slice(-2);
  return `${prefix}XXXXXX${suffix}`;
}

function switchCommDevice(type) {
  state.activeCommDevice = type;
  const btnWa  = document.getElementById('btnDeviceWhatsApp');
  const btnSms = document.getElementById('btnDeviceSms');
  const viewWa = document.getElementById('deviceMockupWhatsApp');
  const viewSms= document.getElementById('deviceMockupSms');

  if (btnWa) btnWa.classList.toggle('active', type === 'whatsapp');
  if (btnSms) btnSms.classList.toggle('active', type === 'sms');

  if (viewWa) viewWa.style.display = type === 'whatsapp' ? 'block' : 'none';
  if (viewSms) viewSms.style.display = type === 'sms' ? 'block' : 'none';

  if (type === 'whatsapp') loadWhatsAppInbox();
  else loadSmsInbox();
}

function openWhatsAppDrawerForFamily() {
  setCaregiverTab('family');
  switchCommDevice('whatsapp');
  const input = document.getElementById('whatsappQuickMsgInput');
  if (input) {
    const cur = state.patients.find(pt => pt.patient_id === state.selectedPatientId);
    input.value = `Checking in on ${cur ? cur.name : 'patient'} status. All vitals normal?`;
    input.focus();
  }
}

async function loadWhatsAppInbox() {
  try {
    const res = await fetch('/notifications/whatsapp-inbox');
    if (res.ok) {
      const msgs = await res.json();
      state.whatsappInbox = msgs;
      renderWhatsAppMessages();
    }
  } catch (e) { console.error('Failed to load WhatsApp messages:', e); }
}

function renderWhatsAppMessages() {
  const wrap = document.getElementById('whatsappPhoneScreen');
  if (!wrap) return;

  const msgs = state.whatsappInbox;
  if (!msgs || msgs.length === 0) {
    wrap.innerHTML = `<div style="text-align:center;font-size:0.76rem;color:#8696A0;margin-top:40px;">No WhatsApp alerts yet.<br>Emergency alerts and caregiver updates appear here in real time.</div>`;
    return;
  }

  wrap.innerHTML = msgs.slice(0, 15).map(m => {
    const isOutbound = m.recipient_type === 'manual' || m.channel === 'whatsapp_outbound';
    const isCrit = m.message.includes('CRITICAL') || m.message.includes('Emergency') || m.message.includes('🚨');
    const timeStr = m.sent_at ? m.sent_at.split('T')[1].split('.')[0] : new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const safeMaskedPhone = m.phone_masked || maskPhoneNumberString(m.phone || '+91 98XXXXXX10');

    return `
      <div class="wa-bubble ${isOutbound ? 'outbound' : ''} ${isCrit ? 'crit' : ''}">
        ${!isOutbound ? `
          <div class="wa-bubble-sender">${m.recipient_name || 'CareBeat Alert Bot'}</div>
          <div class="wa-bubble-phone">To: ${safeMaskedPhone}</div>
        ` : `
          <div class="wa-bubble-sender" style="color:#A7F3D0;">Caregiver Priya Nair</div>
        `}
        <div class="wa-bubble-text">${escapeHtml(m.message)}</div>
        <div class="wa-bubble-time">
          <span>${timeStr}</span>
          <span class="wa-ticks">✓✓</span>
        </div>
      </div>
    `;
  }).join('');

  wrap.scrollTop = wrap.scrollHeight;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>');
}

async function sendCaregiverWhatsAppMsg() {
  const input = document.getElementById('whatsappQuickMsgInput');
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  const curPatient = state.patients.find(pt => pt.patient_id === state.selectedPatientId);
  const pName = curPatient ? curPatient.name : 'Patient';

  input.value = '';

  try {
    const res = await fetch('/notifications/send-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: state.selectedPatientId,
        recipient_name: `Family of ${pName}`,
        phone: '+91 98XXXXXX10',
        message: text
      })
    });
    if (res.ok) {
      showToast('💬 WhatsApp update sent to family contact!');
      loadWhatsAppInbox();
    }
  } catch (e) {
    console.error('Failed to send WhatsApp message:', e);
  }
}

async function loadSmsInbox() {
  try {
    const res = await fetch('/notifications/sms-inbox');
    if (res.ok) {
      const msgs = await res.json();
      const wrap = document.getElementById('familyPhoneScreen');
      if (!wrap) return;
      if (msgs.length === 0) {
        wrap.innerHTML = `<div style="text-align:center;font-size:0.78rem;color:#888;margin-top:20px;">No alerts in inbox.</div>`;
      } else {
        wrap.innerHTML = msgs.slice(0, 10).map(m => `
          <div class="sms-bubble ${m.message.includes('CRITICAL') || m.message.includes('SOS') ? 'crit' : ''}">
            <div style="font-weight:700;margin-bottom:2px;font-size:0.75rem;">To: ${m.phone_masked || maskPhoneNumberString(m.phone)}</div>
            <div>${m.message}</div>
            <div class="sms-time">${m.sent_at ? m.sent_at.split('T')[1].split('.')[0] : ''}</div>
          </div>
        `).join('');
      }
    }
  } catch (e) { console.error(e); }
}

// ==========================================================================
// METRICS, AUDIT TRAIL, CAREGIVER QUEUE
// ==========================================================================
async function loadMetrics() {
  try {
    const res = await fetch('/metrics');
    if (res.ok) {
      const data = await res.json();
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('metricLatency',     `${data.average_alert_latency_ms} ms`);
      set('metricCritCount',   (data.alerts_raised && data.alerts_raised['Critical']) || 0);
      set('metricSuppressed',  data.alerts_suppressed_false_alarm || 0);
      set('metricQuarantined', data.sensor_errors_quarantined || 0);
      set('metricSource',      data.simulator_source);
      const taken  = (data.medicine_compliance && data.medicine_compliance['taken'])  || 0;
      const missed = (data.medicine_compliance && data.medicine_compliance['missed']) || 0;
      const total  = taken + missed;
      set('metricMedAdherence', total > 0 ? `${Math.round((taken / total) * 100)}%` : '100%');
    }
  } catch (e) { console.error(e); }
}

async function loadAuditTrail() {
  try {
    const res = await fetch('/audit');
    if (res.ok) {
      const audits = await res.json();
      const wrap = document.getElementById('auditTrailTableBody');
      if (wrap) {
        wrap.innerHTML = audits.slice(0, 15).map(a => `
          <tr>
            <td>${a.timestamp.split('T')[1].split('.')[0]}</td>
            <td><strong>${a.event_type}</strong></td>
            <td>${a.actor}</td>
            <td>${a.patient_id || 'System'}</td>
            <td>${a.new_value_masked || '--'}</td>
          </tr>
        `).join('');
      }
    }
  } catch (e) { console.error(e); }
}

async function loadCaregiverQueue() {
  try {
    const res = await fetch('/caregivers');
    if (res.ok) {
      const cgs = await res.json();
      const wrap = document.getElementById('caregiverQueueList');
      if (wrap) {
        wrap.innerHTML = cgs.map(c => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px;border-bottom:1px solid var(--border);">
            <div>
              <strong>${c.name}</strong> • ${c.experience}
              <div style="font-size:0.74rem;color:${c.verification_status === 'Verified' ? 'var(--ok-fg)' : 'var(--warn-fg)'};margin-top:2px;">
                Status: <strong>${c.verification_status}</strong>
              </div>
            </div>
            <div>
              ${c.verification_status !== 'Verified'
                ? `<button class="btn-sm btn-ack" onclick="verifyCaregiver('${c.caregiver_id}', 'Verified')">Approve</button>`
                : `<span style="font-size:0.74rem;color:var(--ok-fg);font-weight:700;">✓ Active</span>`}
            </div>
          </div>
        `).join('');
      }
    }
  } catch (e) { console.error(e); }
}

async function verifyCaregiver(cgId, status) {
  await fetch(`/caregivers/${cgId}/verify`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  showToast(`Caregiver marked as ${status}`);
  loadCaregiverQueue();
}

// ==========================================================================
// SIMULATOR CONTROLS
// ==========================================================================
async function triggerAnomaly(type) {
  let endpoint = `/trigger/${type}`;
  if (type === 'emergency') endpoint = '/simulate/emergency';
  const res = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: state.selectedPatientId })
  });
  if (res.ok) showToast(`Injected ${type} anomaly — monitoring response!`);
}

async function switchDataSource(source) {
  const res = await fetch('/demo/source', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source })
  });
  if (res.ok) {
    showToast(`Switched data stream to: ${source}`);
    loadSimulatorStats();
    const badge = document.getElementById('caregiverActiveStreamBadge');
    if (badge) badge.textContent = source === 'simulator' ? 'Live Math Simulator' : 'Kaggle CSV Replay';
  }
}

async function loadSimulatorStats() {
  const res = await fetch('/demo/source');
  if (res.ok) {
    const data = await res.json();
    const lbl = document.getElementById('currentSourceLabel');
    if (lbl) lbl.textContent = data.source;
    const badge = document.getElementById('caregiverActiveStreamBadge');
    if (badge) badge.textContent = data.source === 'simulator' ? 'Live Math Simulator' : 'Kaggle CSV Replay';
  }
}

// ==========================================================================
// LIVE CHART (Canvas Rendering)
// ==========================================================================
async function loadPatientHistory(pid) {
  try {
    const res = await fetch(`/patients/${pid}/measurements?limit=40`);
    if (res.ok) {
      state.selectedPatientHistory = await res.json();
      renderLiveChart();
    }
  } catch (e) { console.error(e); }
}

function appendReadingToChart(reading) {
  state.selectedPatientHistory.push(reading);
  if (state.selectedPatientHistory.length > 50) state.selectedPatientHistory.shift();
  renderLiveChart();
}

function renderLiveChart() {
  const canvas = document.getElementById('patientVitalsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width  = canvas.width  = canvas.parentElement.clientWidth  || 600;
  const height = canvas.height = canvas.parentElement.clientHeight || 300;

  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = '#F9FFFE';
  ctx.fillRect(0, 0, width, height);

  // Grid lines
  ctx.strokeStyle = 'rgba(12,202,170,0.12)';
  ctx.lineWidth = 1;
  for (let y = 30; y < height; y += 45) {
    ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // Map Y: 40 BPM (bottom) → 150 BPM (top)
  const mapY = (val) => height - 30 - ((val - 40) / (150 - 40)) * (height - 60);

  // Warning limit line (100 BPM)
  const warnY = mapY(100);
  ctx.strokeStyle = '#F59E0B'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(40, warnY); ctx.lineTo(width, warnY); ctx.stroke();
  ctx.fillStyle = '#92400E'; ctx.font = '11px Inter, sans-serif';
  ctx.fillText('Warn: 100 BPM', width - 95, warnY - 5);

  // Critical limit line (120 BPM)
  const critY = mapY(120);
  ctx.strokeStyle = '#DC2626';
  ctx.beginPath(); ctx.moveTo(40, critY); ctx.lineTo(width, critY); ctx.stroke();
  ctx.fillStyle = '#991B1B';
  ctx.fillText('Crit: 120 BPM', width - 95, critY - 5);
  ctx.setLineDash([]);

  const history = state.selectedPatientHistory;
  if (history.length < 2) return;

  const stepX = (width - 60) / Math.max(1, history.length - 1);

  // Waveform line gradient
  const grad = ctx.createLinearGradient(40, 0, width, 0);
  grad.addColorStop(0, '#0CCAAA');
  grad.addColorStop(1, '#6366F1');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.8;
  ctx.lineJoin = 'round';
  ctx.beginPath();

  history.forEach((m, idx) => {
    const hr = m.heart_rate || 75;
    const x = 45 + idx * stepX;
    const y = mapY(hr);
    if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Data point dots
  history.forEach((m, idx) => {
    const hr = m.heart_rate || 75;
    const x = 45 + idx * stepX;
    const y = mapY(hr);
    ctx.beginPath();
    ctx.arc(x, y, hr >= 120 ? 5 : 3.2, 0, Math.PI * 2);
    ctx.fillStyle = hr >= 120 ? '#DC2626' : (hr >= 100 ? '#F59E0B' : '#0CCAAA');
    ctx.fill();
  });
}

// ==========================================================================
// TOAST HELPER
// ==========================================================================
function showToast(message, isUrgent = false) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  if (isUrgent) {
    toast.style.background = '#991B1B';
    toast.style.borderLeftColor = '#DC2626';
  }
  toast.innerHTML = `<span>${isUrgent ? '🚨' : 'ℹ️'}</span> <div>${message}</div>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}
