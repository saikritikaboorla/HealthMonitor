/* ==========================================================================
   CareBeat / SmartCare Application Logic
   ========================================================================== */

const state = {
  activeView: 'showcase',
  activeRole: 'caregiver',
  selectedPatientId: 'p1',
  patients: [],
  alerts: [],
  selectedPatientHistory: [],
  audioEnabled: true,
  ws: null,
  heroSimBreach: false,
  heroBreachClaimed: false,
  heroTracePoints: [],
  chartInstance: null,
  loggedIn: false,
  loggedInRole: null,
  loggedInId: null,
  loggedInName: null
};

// --------------------------------------------------------------------------
// Login / Logout
// --------------------------------------------------------------------------

// All demo credentials — 4 patients + 2 caregivers
const DEMO_CREDENTIALS = {
  // Caregivers
  'priya.nair':  { password: 'caregiver123', role: 'caregiver', id: 'cg_1', name: 'Priya Nair',  patientId: null },
  'amit.kumar':  { password: 'caregiver123', role: 'caregiver', id: 'cg_2', name: 'Amit Kumar',  patientId: null },
  // Patients
  'patient.a':   { password: 'patient123',   role: 'patient',   id: 'p1',   name: 'Demo Patient A', patientId: 'p1' },
  'patient.b':   { password: 'patient123',   role: 'patient',   id: 'p2',   name: 'Demo Patient B', patientId: 'p2' },
  'patient.c':   { password: 'patient123',   role: 'patient',   id: 'p3',   name: 'Demo Patient C', patientId: 'p3' },
  'patient.d':   { password: 'patient123',   role: 'patient',   id: 'p4',   name: 'Demo Patient D', patientId: 'p4' },
};

// Which caregiver chip is selected (default cg1)
let selectedCgId = 'cg1';
// Which patient chip is selected (default p1)
let selectedPtId = 'p1';

const CG_USERS = {
  cg1: { username: 'priya.nair', label: 'Priya Nair' },
  cg2: { username: 'amit.kumar', label: 'Amit Kumar' },
};
const PT_USERS = {
  p1: { username: 'patient.a', label: 'Demo Patient A' },
  p2: { username: 'patient.b', label: 'Demo Patient B' },
  p3: { username: 'patient.c', label: 'Demo Patient C' },
  p4: { username: 'patient.d', label: 'Demo Patient D' },
};

function showLoginForm() {
  const splash  = document.getElementById('loginSplash');
  const overlay = document.getElementById('loginFormOverlay');
  if (!splash || !overlay) return;
  // Fade out splash
  splash.classList.add('hide');
  // Show form after splash fade starts
  setTimeout(() => {
    splash.style.display = 'none';
    overlay.style.display = 'flex';
    // Focus password field
    const pwd = document.getElementById('cgPassword');
    if (pwd) pwd.focus();
  }, 400);
}

function switchLoginMainTab(role) {
  const isCaregiver = role === 'caregiver';
  document.getElementById('loginPanelCaregiver').style.display = isCaregiver ? 'block' : 'none';
  document.getElementById('loginPanelPatient').style.display   = isCaregiver ? 'none'  : 'block';
  document.getElementById('loginTabCaregiver').classList.toggle('active', isCaregiver);
  document.getElementById('loginTabPatient').classList.toggle('active',  !isCaregiver);
  // Clear passwords and errors on tab switch
  document.getElementById('cgPassword').value = '';
  document.getElementById('ptPassword').value = '';
  document.getElementById('loginErrorCaregiver').style.display = 'none';
  document.getElementById('loginErrorPatient').style.display   = 'none';
}

function selectCaregiverUser(cgKey) {
  selectedCgId = cgKey;
  // Update chip styles
  Object.keys(CG_USERS).forEach(k => {
    const el = document.getElementById(`cgChip_${k}`);
    if (el) el.classList.toggle('active', k === cgKey);
  });
  // Update readonly username field
  const u = CG_USERS[cgKey];
  document.getElementById('cgUsername').value = u.username;
  document.getElementById('cgPassword').value = '';
  document.getElementById('loginErrorCaregiver').style.display = 'none';
}

function selectPatientUser(ptKey) {
  selectedPtId = ptKey;
  // Update chip styles
  Object.keys(PT_USERS).forEach(k => {
    const el = document.getElementById(`ptChip_${k}`);
    if (el) el.classList.toggle('active', k === ptKey);
  });
  // Update readonly username field
  const u = PT_USERS[ptKey];
  document.getElementById('ptUsername').value = u.username;
  document.getElementById('ptPassword').value = '';
  document.getElementById('loginErrorPatient').style.display = 'none';
}

async function doLogin(role) {
  const username = document.getElementById(role === 'caregiver' ? 'cgUsername' : 'ptUsername').value.trim();
  const password = document.getElementById(role === 'caregiver' ? 'cgPassword' : 'ptPassword').value.trim();
  const errorEl  = document.getElementById(role === 'caregiver' ? 'loginErrorCaregiver' : 'loginErrorPatient');

  const creds = DEMO_CREDENTIALS[username];
  if (creds && creds.password === password && creds.role === role) {
    // Successful login
    state.loggedIn      = true;
    state.loggedInRole  = role;
    state.loggedInId    = creds.id;
    state.loggedInName  = creds.name;

    // For patient login, lock to their patient ID
    if (role === 'patient') {
      state.selectedPatientId = creds.patientId;
    }

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display     = 'block';

    // Update badge in header
    const badge = document.getElementById('loggedInBadge');
    if (badge) badge.textContent = `👤 ${creds.name} · Sign Out`;

    // Keep role selector in sync (hidden but used by some internal code)
    const roleSel = document.getElementById('roleSelector');
    if (roleSel) roleSel.value = role;
    state.activeRole = role;

    // Apply role-based UI restrictions BEFORE booting
    applyRoleRestrictions(role);

    // Boot the app
    initNavigation();
    initRoleSwitcher();
    initWebSocket();
    initHeroTraceCanvas();

    // Await patients so the patient dashboard renders correctly on first load
    await loadPatients();
    loadAlerts();
    loadMetrics();
    loadSmsInbox();
    setInterval(loadSmsInbox, 4000);
    setInterval(loadSmsInboxForCaregiver, 5000);
    setInterval(loadAlerts, 5000);
    setInterval(loadMetrics, 6000);

    // Navigate directly to the relevant dashboard — no portal select
    if (role === 'patient') {
      switchView('patient');
    } else {
      switchView('caregiver');
    }
  } else {
    errorEl.textContent = 'Incorrect password. Use the password shown below.';
    errorEl.style.display = 'block';
  }
}

/**
 * Show/hide nav tabs and UI elements based on who is logged in.
 * Caregivers: Caregiver Dashboard + Judge Metrics + Simulator
 * Patients:   Patient Dashboard only (no switching to other patients)
 */
function applyRoleRestrictions(role) {
  // Nav tabs — show only tabs that match the logged-in role
  document.querySelectorAll('.nav-tab[data-roles]').forEach(tab => {
    const allowed = tab.dataset.roles.split(',').map(r => r.trim());
    tab.style.display = allowed.includes(role) ? '' : 'none';
  });

  // Test Emergency button — only caregivers
  document.querySelectorAll('[data-roles="caregiver"]').forEach(el => {
    if (!el.classList.contains('nav-tab')) {
      el.style.display = role === 'caregiver' ? '' : 'none';
    }
  });

  // "Switch Patient" dropdown — only show for caregivers visiting the patient view
  const switchWrap = document.getElementById('patientSwitchWrap');
  if (switchWrap) switchWrap.style.display = role === 'caregiver' ? 'flex' : 'none';

  // Brand click to portal select — disable for patients and non-caregiver roles
  const brandGroup = document.querySelector('.brand-group');
  if (brandGroup) {
    if (role === 'patient') {
      brandGroup.style.cursor = 'default';
      brandGroup.onclick = null;
    } else {
      brandGroup.style.cursor = 'pointer';
      brandGroup.onclick = () => switchView('caregiver');
    }
  }
}

function doLogout() {
  state.loggedIn     = false;
  state.loggedInRole = null;
  state.loggedInId   = null;
  state.loggedInName = null;
  if (state.ws) { state.ws.close(); state.ws = null; }
  document.getElementById('mainApp').style.display  = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  // Reset splash so it shows again on next visit
  const splash  = document.getElementById('loginSplash');
  const overlay = document.getElementById('loginFormOverlay');
  if (splash)  { splash.style.display = 'flex'; splash.classList.remove('hide'); }
  if (overlay) overlay.style.display  = 'none';
  // Reset passwords
  document.getElementById('cgPassword').value = '';
  document.getElementById('ptPassword').value = '';
  document.getElementById('loginErrorCaregiver').style.display = 'none';
  document.getElementById('loginErrorPatient').style.display   = 'none';
}

// --------------------------------------------------------------------------
// Initialization — called after login, not on DOMContentLoaded
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Only show the login screen on load — nothing else boots until login
});

// --------------------------------------------------------------------------
// Navigation & Views
// --------------------------------------------------------------------------
function initNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetView = tab.dataset.view;
      switchView(targetView);
    });
  });
}

function switchView(viewName) {
  state.activeView = viewName;
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.view === viewName);
  });
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `view-${viewName}`);
  });

  if (viewName === 'caregiver') {
    renderCaregiverDashboard();
  } else if (viewName === 'patient') {
    renderPatientSosView();
  } else if (viewName === 'metrics') {
    loadMetrics();
    loadAuditTrail();
    loadCaregiverQueue();
  } else if (viewName === 'simulator') {
    loadSimulatorStats();
    loadWhatsappInbox();
  }
}

function initRoleSwitcher() {
  const sel = document.getElementById('roleSelector');
  if (sel) {
    sel.addEventListener('change', (e) => {
      state.activeRole = e.target.value;
      showToast(`Switched active role to: ${sel.options[sel.selectedIndex].text}`);
      if (state.activeRole === 'patient') {
        switchView('patient');
      } else if (state.activeRole === 'admin') {
        switchView('metrics');
      } else {
        switchView('caregiver');
      }
    });
  }

  const audioBtn = document.getElementById('audioToggleBtn');
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      state.audioEnabled = !state.audioEnabled;
      audioBtn.textContent = state.audioEnabled ? '🔊 Audio Alerts: ON' : '🔇 Audio Alerts: OFF';
      showToast(`Audio alerts ${state.audioEnabled ? 'enabled' : 'muted'}`);
    });
  }
}

// --------------------------------------------------------------------------
// WebSocket Live Connection
// --------------------------------------------------------------------------
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    console.log('CareBeat WebSocket connected');
    const badge = document.getElementById('wsStatusBadge');
    if (badge) {
      badge.textContent = '● Live WebSocket connected';
      badge.style.color = '#5FD0D8';
    }
  };

  state.ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleWebSocketMessage(msg);
    } catch (e) {
      console.error('Error handling WS message:', e);
    }
  };

  state.ws.onclose = () => {
    console.warn('WebSocket closed, reconnecting in 2s...');
    const badge = document.getElementById('wsStatusBadge');
    if (badge) {
      badge.textContent = '○ Reconnecting WebSocket...';
      badge.style.color = '#FF8F7D';
    }
    setTimeout(initWebSocket, 2000);
  };
}

function handleWebSocketMessage(msg) {
  if (msg.type === 'vital_update') {
    updatePatientVitalsInMemory(msg.data);
    if (msg.data.patient_id === state.selectedPatientId) {
      appendReadingToChart(msg.data);
      renderSelectedPatientDetail();
      // Live-update patient dashboard vitals if on patient view
      if (state.activeView === 'patient') {
        updatePatientSosVitals(msg.data);
      }
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
    showToast(`Alert marked as resolved.`);
    loadAlerts();
  } else if (msg.type === 'alert_escalated') {
    showToast(`⚠️ Alert Escalated to secondary family contact!`, true);
    speakNotification('Escalation alert: unacknowledged timeout reached. Notifying secondary family contact.');
    loadAlerts();
  } else if (msg.type === 'medicine_reminder') {
    showToast(`⏰ Medicine Due: ${msg.medicine_name} for ${msg.patient_id}`);
    speakNotification(`Reminder: ${msg.medicine_name} is scheduled now.`);
  } else if (msg.type === 'source_changed') {
    showToast(`Data source changed to: ${msg.source}`);
    loadPatients();
  }
}

function handleNewAlert(alert) {
  showSiren(alert);
  loadAlerts();
  loadSmsInbox();

  if (alert.severity === 'Critical' || alert.alert_type === 'sos') {
    speakNotification(`Critical Alert for ${alert.patient_name || alert.patient_id}: ${alert.explanation}`);
  }
}

function speakNotification(text) {
  if (!state.audioEnabled || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.error('Speech synthesis error:', e);
  }
}

// --------------------------------------------------------------------------
// Siren Banner
// --------------------------------------------------------------------------
function showSiren(alert) {
  const banner = document.getElementById('sirenBanner');
  const txt = document.getElementById('sirenText');
  if (banner && txt) {
    txt.textContent = `[${alert.severity.toUpperCase()}] ${alert.patient_name || alert.patient_id}: ${alert.explanation}`;
    banner.style.display = 'flex';
  }
}

function hideSiren() {
  const banner = document.getElementById('sirenBanner');
  if (banner) {
    banner.style.display = 'none';
  }
}

// --------------------------------------------------------------------------
// Data Fetching: Patients, Alerts, Metrics
// --------------------------------------------------------------------------
async function loadPatients() {
  try {
    // Caregivers only see their assigned patients
    let url = '/patients';
    if (state.loggedInRole === 'caregiver' && state.loggedInId) {
      url = `/patients?caregiver_id=${encodeURIComponent(state.loggedInId)}`;
    }
    const res = await fetch(url);
    if (res.ok) {
      state.patients = await res.json();
      // For patient login, always ensure selectedPatientId matches their own record
      if (state.loggedInRole === 'patient' && state.loggedInId) {
        state.selectedPatientId = state.loggedInId;
      } else if (state.patients.length > 0 && !state.patients.find(p => p.patient_id === state.selectedPatientId)) {
        // If current selection isn't in the filtered list, default to first
        state.selectedPatientId = state.patients[0].patient_id;
      }
      renderPatientCards();
      renderSelectedPatientDetail();
      if (state.activeView === 'patient') renderPatientSosView();
    }
  } catch (e) {
    console.error('Failed to load patients:', e);
  }
}

function updatePatientVitalsInMemory(vital) {
  const p = state.patients.find(pt => pt.patient_id === vital.patient_id);
  if (p) {
    p.latest_measurement = vital;
    p.is_stale = false;
    renderPatientCardVitals(p);
  }
}

/**
 * Lightweight live update for the patient dashboard big vitals display.
 * Only touches the number elements — doesn't re-render the whole view.
 */
function updatePatientSosVitals(vital) {
  const hrEl   = document.getElementById('sosBigHr');
  const tempEl = document.getElementById('sosBigTemp');
  const spo2El = document.getElementById('sosBigSpo2');

  if (hrEl   && vital.heart_rate  != null) hrEl.textContent   = vital.heart_rate;
  if (tempEl && vital.temperature != null) tempEl.textContent = vital.temperature;
  if (spo2El && vital.spo2        != null) spo2El.textContent = vital.spo2;

  // Flash the vitals briefly to show they updated
  [hrEl, tempEl, spo2El].forEach(el => {
    if (!el) return;
    el.style.transition = 'color 0.15s';
    el.style.color = '#5FD0D8';
    setTimeout(() => { el.style.color = ''; }, 300);
  });
}

async function loadAlerts() {
  try {
    const res = await fetch('/alerts');
    if (res.ok) {
      state.alerts = await res.json();
      renderAlertsList();
      // Check if any critical active alert exists for siren banner
      const activeCrit = state.alerts.find(a => a.state === 'Active' && a.severity === 'Critical');
      if (activeCrit) {
        showSiren(activeCrit);
      } else {
        hideSiren();
      }
    }
  } catch (e) {
    console.error('Failed to load alerts:', e);
  }
}

// --------------------------------------------------------------------------
// UI Rendering: Caregiver Dashboard
// --------------------------------------------------------------------------
function renderCaregiverDashboard() {
  renderPatientCards();
  renderSelectedPatientDetail();
  renderAlertsList();
  loadPatientHistory(state.selectedPatientId);
  loadEmergencyContactsForCaregiver(state.selectedPatientId);
  loadSmsInboxForCaregiver();
}

function renderPatientCards() {
  const container = document.getElementById('patientCardsGrid');
  if (!container) return;

  container.innerHTML = state.patients.map(p => {
    const m = p.latest_measurement || {};
    const isSelected = p.patient_id === state.selectedPatientId;
    const cond = p.condition_tags ? p.condition_tags.join(', ') : 'None';
    const statusClass = p.status_color || 'normal';

    return `
      <div class="patient-card status-${statusClass} ${isSelected ? 'selected' : ''}" onclick="selectPatient('${p.patient_id}')">
        <div class="card-top">
          <div class="patient-info">
            <h3>${p.name}</h3>
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
              ${m.heart_rate != null ? m.heart_rate : '--'}
              <span class="vital-unit">BPM</span>
            </div>
          </div>
          <div class="vital-box">
            <span class="vital-label">SpO₂</span>
            <div class="vital-value" id="val-spo2-${p.patient_id}">
              ${m.spo2 != null ? m.spo2 : '--'}
              <span class="vital-unit">%</span>
            </div>
          </div>
          <div class="vital-box">
            <span class="vital-label">Temperature</span>
            <div class="vital-value" id="val-temp-${p.patient_id}">
              ${m.temperature != null ? m.temperature : '--'}
              <span class="vital-unit">°C</span>
            </div>
          </div>
          <div class="vital-box">
            <span class="vital-label">Blood Pressure</span>
            <div class="vital-value" id="val-bp-${p.patient_id}">
              ${m.systolic_bp != null ? `${m.systolic_bp}/${m.diastolic_bp}` : '120/80'}
              <span class="vital-unit">mmHg</span>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <span>Source: <strong>${m.source || 'simulator'}</strong></span>
          <span class="health-score-badge" title="${(p.health_score_details && p.health_score_details.disclaimer) || 'Health Score: 0-100'}">
            Score: ${p.health_score != null ? p.health_score : 95}/100
          </span>
        </div>
      </div>
    `;
  }).join('');
}

function renderPatientCardVitals(p) {
  const m = p.latest_measurement || {};
  const hrEl = document.getElementById(`val-hr-${p.patient_id}`);
  const spo2El = document.getElementById(`val-spo2-${p.patient_id}`);
  const tempEl = document.getElementById(`val-temp-${p.patient_id}`);
  const bpEl = document.getElementById(`val-bp-${p.patient_id}`);

  if (hrEl && m.heart_rate != null) hrEl.innerHTML = `${m.heart_rate}<span class="vital-unit">BPM</span>`;
  if (spo2El && m.spo2 != null) spo2El.innerHTML = `${m.spo2}<span class="vital-unit">%</span>`;
  if (tempEl && m.temperature != null) tempEl.innerHTML = `${m.temperature}<span class="vital-unit">°C</span>`;
  if (bpEl && m.systolic_bp != null) bpEl.innerHTML = `${m.systolic_bp}/${m.diastolic_bp}<span class="vital-unit">mmHg</span>`;
}

function selectPatient(pid) {
  state.selectedPatientId = pid;
  renderPatientCards();
  renderSelectedPatientDetail();
  loadPatientHistory(pid);
}

async function renderSelectedPatientDetail() {
  const p = state.patients.find(pt => pt.patient_id === state.selectedPatientId);
  if (!p) return;

  const titleEl = document.getElementById('selectedPatientTitle');
  if (titleEl) {
    titleEl.textContent = `${p.name} (Live Clinical Monitor)`;
  }

  // Load Care Tasks
  loadCareTasks(p.patient_id);
  // Load Medicines
  loadMedicines(p.patient_id);
  // Load AI Tips
  loadPatientTips(p.patient_id);
  // Load Thresholds
  loadThresholdConfig(p.patient_id);
  // Load Handover Notes
  loadHandoverNotes(p.patient_id);
  // Load Emergency Family Contacts into Caregiver panel
  loadEmergencyContactsForCaregiver(p.patient_id);
}

// --------------------------------------------------------------------------
// Caregiver Tasks & Medicines
// --------------------------------------------------------------------------
async function loadCareTasks(pid) {
  try {
    const res = await fetch(`/patients/${pid}/care-tasks`);
    if (res.ok) {
      const tasks = await res.json();
      const wrap = document.getElementById('careTasksList');
      if (wrap) {
        if (tasks.length === 0) {
          wrap.innerHTML = `<div style="font-size:0.85rem;color:#888;">No pending tasks for today.</div>`;
        } else {
          wrap.innerHTML = tasks.map(t => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid #E4ECEE;">
              <div>
                <strong style="font-size:0.88rem;">${t.task_type}</strong>
                <div style="font-size:0.75rem;color:#666;">Due: ${t.due_time.split(' ')[1] || t.due_time}</div>
              </div>
              <div style="display:flex;gap:6px;">
                <button class="btn-sm ${t.status === 'done' ? 'btn-resolve' : ''}" onclick="updateTaskStatus('${t.task_id}', 'done')">
                  ${t.status === 'done' ? '✓ Done' : 'Mark Done'}
                </button>
              </div>
            </div>
          `).join('');
        }
      }
    }
  } catch (e) {
    console.error('Failed to load care tasks:', e);
  }
}

async function updateTaskStatus(taskId, status) {
  await fetch(`/care-tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  loadCareTasks(state.selectedPatientId);
}

async function loadMedicines(pid) {
  try {
    const res = await fetch(`/patients/${pid}/medicines`);
    if (res.ok) {
      const meds = await res.json();
      const wrap = document.getElementById('medicinesList');
      if (wrap) {
        wrap.innerHTML = meds.map(m => {
          const latestLog = (m.logs && m.logs[0]) || null;
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid #E4ECEE;">
              <div>
                <strong style="font-size:0.88rem;">${m.name}</strong>
                <div style="font-size:0.75rem;color:#666;">Times: ${m.schedule_times.join(', ')} • ${m.notes || ''}</div>
              </div>
              <div>
                ${latestLog && latestLog.status === 'taken'
                  ? `<span style="font-size:0.75rem;color:#14663F;font-weight:600;">✓ Taken Today</span>`
                  : `<button class="btn-sm btn-ack" onclick="takeMedicine('${latestLog ? latestLog.log_id : ''}')">Mark Taken</button>`}
              </div>
            </div>
          `;
        }).join('');
      }
    }
  } catch (e) {
    console.error('Failed to load medicines:', e);
  }
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
}

async function fastForwardMedicine() {
  try {
    const res = await fetch('/demo/fast-forward-medicine', { method: 'POST' });
    const data = await res.json();
    showToast(`Fast-forwarded medicine reminder: ${data.medicine}`);
    loadMedicines(state.selectedPatientId);
  } catch (e) {
    console.error(e);
  }
}

// --------------------------------------------------------------------------
// AI Layer: 24h Summary & Daily Care Tips
// --------------------------------------------------------------------------
async function triggerAISummary() {
  const wrap = document.getElementById('aiSummaryContent');
  const badge = document.getElementById('aiSourceBadge');
  if (wrap) wrap.innerHTML = `<em>Generating 24-hour narrative clinical summary...</em>`;

  try {
    const res = await fetch(`/patients/${state.selectedPatientId}/summary`);
    if (res.ok) {
      const data = await res.json();
      if (wrap) wrap.innerHTML = `<div class="ai-text">${data.summary}</div>`;
      if (badge) {
        badge.textContent = data.source === 'gemini-api' ? `Powered by Gemini AI (${data.model})` : `Clinical Heuristics Engine`;
      }
    }
  } catch (e) {
    if (wrap) wrap.innerHTML = `Failed to generate AI summary.`;
  }
}

async function loadPatientTips(pid) {
  try {
    const res = await fetch(`/patients/${pid}/tips`);
    if (!res.ok) return;
    const data = await res.json();
    const tips = data.tips || [];

    const DIET_KEYWORDS = ['diet', 'glucose', 'hydration', 'cardiac', 'blood pressure', 'temperature', 'nutrition', 'sodium', 'fluid', 'meal', 'food'];
    const dietTips    = tips.filter(t => DIET_KEYWORDS.some(k => t.title.toLowerCase().includes(k)));
    const otherTips   = tips.filter(t => !DIET_KEYWORDS.some(k => t.title.toLowerCase().includes(k)));
    const displayDiet = dietTips.length > 0 ? dietTips : tips.slice(0, 1);
    const displayOther = dietTips.length > 0 ? otherTips : tips.slice(1);

    const ICONS = { 'Hydration': '💧', 'Glucose': '🩸', 'Blood Pressure': '🫀', 'Cardiac': '❤️', 'Temperature': '🌡️', 'Diet': '🥗', 'Nutrition': '🥦', 'Sodium': '🧂', 'Fluid': '💧', 'Meal': '🍽️' };
    function getIcon(title) {
      return Object.entries(ICONS).find(([k]) => title.includes(k))?.[1] || '🥗';
    }

    // Diet section — caregiver panel
    const cgDietWrap = document.getElementById('cgDietTipContent');
    if (cgDietWrap) {
      if (displayDiet.length === 0) {
        cgDietWrap.innerHTML = `<div style="font-size:0.85rem;color:var(--text-muted);">No diet guidance available.</div>`;
      } else {
        cgDietWrap.innerHTML = displayDiet.map(t => `
          <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 12px;background:linear-gradient(135deg,#F0FDF4,#ECFDF5);border:1px solid #A7F3D0;border-radius:var(--radius-sm);margin-bottom:8px;">
            <span style="font-size:1.5rem;line-height:1.2;">${getIcon(t.title)}</span>
            <div>
              <strong style="font-size:0.9rem;color:#065F46;display:block;margin-bottom:3px;">${t.title}</strong>
              <span style="font-size:0.85rem;color:#047857;line-height:1.5;">${t.tip}</span>
            </div>
          </div>
        `).join('');
      }
    }

    // Other wellness tips section
    const otherWrap = document.getElementById('dailyTipsList');
    if (otherWrap) {
      if (displayOther.length === 0) {
        otherWrap.innerHTML = `<div style="font-size:0.82rem;color:var(--text-muted);">No additional tips.</div>`;
      } else {
        otherWrap.innerHTML = displayOther.map(t => `
          <div style="margin-bottom:8px;font-size:0.84rem;">
            <strong style="color:var(--brand);">${t.title}:</strong>
            <span style="color:var(--text);"> ${t.tip}</span>
          </div>
        `).join('');
      }
    }
  } catch (e) {
    console.error('Failed to load patient tips:', e);
  }
}

// --------------------------------------------------------------------------
// Threshold Sandbox Preview
// --------------------------------------------------------------------------
async function loadThresholdConfig(pid) {
  try {
    const res = await fetch(`/thresholds/${pid}`);
    if (res.ok) {
      const th = await res.json();
      const hrWarn = document.getElementById('thHrWarn');
      const hrCrit = document.getElementById('thHrCrit');
      const tempCrit = document.getElementById('thTempCrit');
      const spo2Crit = document.getElementById('thSpo2Crit');

      if (hrWarn) hrWarn.value = th.hr_warn_high;
      if (hrCrit) hrCrit.value = th.hr_crit_high;
      if (tempCrit) tempCrit.value = th.temp_crit;
      if (spo2Crit) spo2Crit.value = th.spo2_crit;
    }
  } catch (e) {
    console.error(e);
  }
}

async function previewThresholdSandbox() {
  const hrWarn = parseFloat(document.getElementById('thHrWarn').value) || 110;
  const hrCrit = parseFloat(document.getElementById('thHrCrit').value) || 130;
  const resBox = document.getElementById('sandboxPreviewResult');

  // Test against client-side history
  let simulatedBreaches = 0;
  state.selectedPatientHistory.forEach(m => {
    if (m.heart_rate && (m.heart_rate >= hrCrit || m.heart_rate >= hrWarn)) {
      simulatedBreaches++;
    }
  });

  if (resBox) {
    resBox.innerHTML = `<strong>Sandbox Preview:</strong> With these limits, <strong>${simulatedBreaches}</strong> alert(s) would have triggered against recent readings.`;
  }
}

async function saveThresholdConfig() {
  const hrWarn = parseFloat(document.getElementById('thHrWarn').value);
  const hrCrit = parseFloat(document.getElementById('thHrCrit').value);
  const tempCrit = parseFloat(document.getElementById('thTempCrit').value);
  const spo2Crit = parseFloat(document.getElementById('thSpo2Crit').value);

  const payload = {
    profile_name: "Custom Updated",
    hr_warn_high: hrWarn,
    hr_warn_low: 50,
    hr_crit_high: hrCrit,
    hr_crit_low: 40,
    temp_warn: 37.8,
    temp_crit: tempCrit,
    spo2_warn: 94,
    spo2_crit: spo2Crit
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

// --------------------------------------------------------------------------
// Alerts List & Actions (Claim, Acknowledge, Resolve)
// --------------------------------------------------------------------------
function renderAlertsList() {
  const wrap = document.getElementById('alertsListContainer');
  if (!wrap) return;

  if (state.alerts.length === 0) {
    wrap.innerHTML = `<div style="padding:16px;text-align:center;color:#666;font-size:0.85rem;">No active alerts right now. (This does not confirm safety)</div>`;
    return;
  }

  wrap.innerHTML = state.alerts.slice(0, 15).map(a => {
    const isCrit = a.severity === 'Critical';
    const isEsc = a.state === 'Escalated';
    const isAck = a.state === 'Acknowledged';
    const isRes = a.state === 'Resolved';

    return `
      <div class="alert-item severity-${a.severity}">
        <div class="alert-item-header">
          <span style="color:${isCrit ? '#C62828' : '#7A4A00'}">
            ${isEsc ? '⚠️ ESCALATED: ' : ''}${a.severity.toUpperCase()} ALERT
          </span>
          <span style="color:#666;font-size:0.75rem;">${a.created_at ? a.created_at.split('T')[1].split('.')[0] : ''}</span>
        </div>
        <div class="alert-explanation">${a.explanation}</div>
        <div style="font-size:0.75rem;margin-bottom:8px;color:#4A6169;">
          State: <strong>${a.state}</strong> ${a.claim_locked_by ? `• Locked by: ${a.claim_locked_by}` : ''}
        </div>
        <div class="alert-actions">
          ${!isAck && !isRes ? `
            <button class="btn-sm btn-claim" onclick="claimAlert('${a.alert_id}')">Claim Lock (60s)</button>
            <button class="btn-sm btn-ack" onclick="acknowledgeAlert('${a.alert_id}')">Acknowledge</button>
          ` : ''}
          ${isAck && !isRes ? `
            <button class="btn-sm btn-resolve" onclick="resolveAlert('${a.alert_id}')">Mark Resolved</button>
          ` : ''}
          ${isRes ? `<span style="font-size:0.75rem;color:#14663F;">✓ Resolved</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function claimAlert(alertId) {
  await fetch(`/alerts/${alertId}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caregiver_id: 'Priya (Caregiver)' })
  });
  showToast('Alert claim lock set for 60 seconds.');
  loadAlerts();
}

async function acknowledgeAlert(alertId) {
  await fetch(`/alerts/${alertId}/acknowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caregiver_id: 'Priya (Caregiver)' })
  });
  hideSiren();
  showToast('Alert acknowledged. Siren stopped.');
  loadAlerts();
}

async function resolveAlert(alertId) {
  await fetch(`/alerts/${alertId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caregiver_id: 'Priya (Caregiver)', note: 'Checked vitals and stabilized patient.' })
  });
  showToast('Alert marked as resolved.');
  loadAlerts();
}

// --------------------------------------------------------------------------
// Patient SOS View (§8)
// --------------------------------------------------------------------------
let sosTimer = null;
let sosHoldSeconds = 0;

function renderPatientSosView() {
  const p = state.patients.find(pt => pt.patient_id === state.selectedPatientId) || state.patients[0];
  if (!p) {
    // Patients not yet loaded — retry after a short delay
    setTimeout(renderPatientSosView, 500);
    return;
  }

  const m = p.latest_measurement || {};
  const nameEl = document.getElementById('patientScreenName');
  if (nameEl) nameEl.textContent = p.name;

  const condEl = document.getElementById('patientScreenCondition');
  if (condEl) {
    const tags = p.condition_tags ? p.condition_tags.join(', ') : 'General Care';
    condEl.textContent = `${tags} • Age ${p.age}`;
  }

  const selEl = document.getElementById('patientViewSelector');
  if (selEl) selEl.value = p.patient_id;

  const hrEl = document.getElementById('sosBigHr');
  const tempEl = document.getElementById('sosBigTemp');
  const spo2El = document.getElementById('sosBigSpo2');

  if (hrEl) hrEl.textContent = m.heart_rate != null ? m.heart_rate : '--';
  if (tempEl) tempEl.textContent = m.temperature != null ? m.temperature : '--';
  if (spo2El) spo2El.textContent = m.spo2 != null ? m.spo2 : '--';

  // Only load heavy sections on first render or patient switch — not on every WS tick
  const alreadyLoaded = document.getElementById('patientScreenName')?.dataset.loadedPid === p.patient_id;
  if (!alreadyLoaded) {
    if (nameEl) nameEl.dataset.loadedPid = p.patient_id;
    loadPatientMedsForPatientScreen(p.patient_id);
    setupSosButton();
    loadFamilyDetailsForPatient(p.patient_id);
    loadDietTipForPatient(p.patient_id);
  }
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
      if (wrap) {
        if (meds.length === 0) {
          wrap.innerHTML = `<div style="font-size:0.85rem;color:#888;">No scheduled medicines for today.</div>`;
        } else {
          wrap.innerHTML = meds.map(m => {
            const latestLog = (m.logs && m.logs[0]) || null;
            const isTaken = latestLog && latestLog.status === 'taken';
            return `
              <div class="patient-med-item">
                <div>
                  <strong style="font-size:0.95rem;color:var(--ink);">${m.name}</strong>
                  <div style="font-size:0.8rem;color:var(--text-muted);">Due: ${m.schedule_times.join(', ')} • ${m.notes || ''}</div>
                </div>
                <div>
                  ${isTaken
                    ? `<span style="font-size:0.85rem;color:var(--normal-fg);font-weight:700;padding:6px 12px;background:var(--normal-bg);border-radius:20px;">✓ Taken Today</span>`
                    : `<button class="btn-sm btn-ack" style="font-size:0.85rem;padding:8px 14px;border-radius:6px;" onclick="takeMedicine('${latestLog ? latestLog.log_id : ''}')">Mark as Taken</button>`}
                </div>
              </div>
            `;
          }).join('');
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
}

async function loadHandoverNotes(pid) {
  try {
    const res = await fetch(`/patients/${pid}/handover`);
    if (res.ok) {
      const notes = await res.json();
      const wrap = document.getElementById('handoverNotesHistory');
      const famWrap = document.getElementById('familyHandoverText');
      if (wrap) {
        if (notes.length === 0) {
          wrap.innerHTML = `<em style="color:#888;">No recent handover notes logged for this patient.</em>`;
        } else {
          wrap.innerHTML = notes.slice(0, 3).map(n => `
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;padding:10px;border-radius:6px;margin-bottom:8px;">
              <div style="font-weight:700;font-size:0.8rem;color:var(--brand);margin-bottom:2px;">
                Shift: ${n.shift} • By Caregiver ${n.caregiver_id} • ${n.created_at ? n.created_at.split('T')[0] : ''}
              </div>
              <div style="font-size:0.85rem;color:var(--text);">${n.condition_summary || n.concerns || ''}</div>
            </div>
          `).join('');
        }
      }
      if (famWrap && notes.length > 0) {
        famWrap.innerHTML = `<em>"${notes[0].condition_summary || notes[0].concerns || ''}"</em>`;
      }
    }
  } catch (e) {
    console.error(e);
  }
}

async function submitHandoverNote() {
  const input = document.getElementById('handoverNoteInput');
  if (!input || !input.value.trim()) {
    showToast('Please type a handover note first.');
    return;
  }

  const text = input.value.trim();
  try {
    const res = await fetch(`/patients/${state.selectedPatientId}/handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caregiver_id: 'Priya (Caregiver)',
        shift: 'Morning',
        condition_on_arrival: 'Vitals stable',
        tasks_completed: 'Care duties logged',
        concerns: text
      })
    });
    if (res.ok) {
      showToast('Shift handover note submitted successfully!');
      input.value = '';
      loadHandoverNotes(state.selectedPatientId);
    }
  } catch (e) {
    console.error('Failed to submit handover note:', e);
  }
}

function setupSosButton() {
  const btn = document.getElementById('patientSosHoldBtn');
  if (!btn) return;

  btn.onmousedown = startSosHold;
  btn.onmouseup = stopSosHold;
  btn.ontouchstart = startSosHold;
  btn.ontouchend = stopSosHold;

  // Accessibility click
  btn.onclick = () => {
    if (confirm("Request immediate emergency caregiver & family assistance?")) {
      triggerSosDirect();
    }
  };

  // Show floating SOS button when the main SOS button scrolls out of view
  initFloatingSosWatcher();
}

function initFloatingSosWatcher() {
  const mainBtn   = document.getElementById('patientSosHoldBtn');
  const floatBtn  = document.getElementById('floatingSosBtn');
  if (!mainBtn || !floatBtn) return;

  // Use IntersectionObserver — most efficient, no scroll jank
  const observer = new IntersectionObserver(
    ([entry]) => {
      // Show floating button when main button is NOT visible
      floatBtn.style.display = entry.isIntersecting ? 'none' : 'block';
    },
    { threshold: 0.1 }
  );
  observer.observe(mainBtn);
}

function startSosHold(e) {
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
  if (subtext) subtext.textContent = `Hold 3 seconds or Click`;
}

async function triggerSosDirect() {
  try {
    const res = await fetch('/sos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: state.selectedPatientId, reason: "Patient pressed SOS Button" })
    });
    if (res.ok) {
      showToast('🚨 SOS ALERT BROADCASTED TO CAREGIVER & FAMILY!', true);
      speakNotification('Emergency help requested. Caregivers and family notified.');
      const subtext = document.getElementById('sosBtnSubtext');
      if (subtext) subtext.textContent = 'ALERT SENT!';
    }
  } catch (e) {
    console.error(e);
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
      showToast("✓ 'I'm OK' Check-in successfully recorded!");
      speakNotification("Thank you. Your check in has been confirmed.");
    }
  } catch (e) {
    console.error(e);
  }
}

// --------------------------------------------------------------------------
// Family Contacts — Caregiver Emergency Contacts Panel
// --------------------------------------------------------------------------
async function loadEmergencyContactsForCaregiver(pid) {
  const wrap = document.getElementById('cgEmergencyContactsList');
  if (!wrap) return;
  try {
    const res = await fetch(`/patients/${pid}`);
    if (!res.ok) return;
    const data = await res.json();
    const contacts = data.family_contacts || [];
    if (contacts.length === 0) {
      wrap.innerHTML = `<div style="font-size:0.85rem;color:var(--text-muted);">No family contacts registered for this patient.</div>`;
      return;
    }
    wrap.innerHTML = contacts.map(c => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
        <div>
          <strong style="font-size:0.92rem;color:var(--ink);">${c.name}</strong>
          <span style="font-size:0.75rem;color:var(--text-muted);margin-left:6px;">(${c.relation})</span>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">
            📞 ${c.phone_masked} &nbsp;•&nbsp;
            <span style="color:${c.priority === 'primary' ? 'var(--brand)' : '#7A4A00'};font-weight:600;">
              ${c.priority === 'primary' ? '⭐ Primary' : '2nd Contact'}
            </span>
            &nbsp;•&nbsp;
            <span style="color:${c.verification_status === 'Verified' ? '#14663F' : '#7A4A00'};">${c.verification_status}</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <a href="tel:${c.phone_raw || ''}" class="btn-sm btn-ack" style="text-decoration:none;">📞 Call</a>
          <a href="https://wa.me/${(c.phone_raw || '').replace(/[^0-9]/g,'')}?text=Emergency+update+regarding+your+family+member+from+CareBeat"
             target="_blank" class="btn-sm" style="background:#25D366;color:white;border:none;text-decoration:none;">💬 WhatsApp</a>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Failed to load emergency contacts:', e);
  }
}

// --------------------------------------------------------------------------
// Family Details — Patient Dashboard
// --------------------------------------------------------------------------
async function loadFamilyDetailsForPatient(pid) {
  const wrap = document.getElementById('patientFamilyContactsList');
  if (!wrap) return;
  try {
    const res = await fetch(`/patients/${pid}`);
    if (!res.ok) return;
    const data = await res.json();
    const contacts = data.family_contacts || [];
    if (contacts.length === 0) {
      wrap.innerHTML = `<div style="font-size:0.9rem;color:var(--text-muted);">No family contacts registered.</div>`;
      return;
    }
    wrap.innerHTML = contacts.map(c => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--brand);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:1rem;">
            ${c.name.charAt(0)}
          </div>
          <div>
            <strong style="font-size:1rem;color:var(--ink);">${c.name}</strong>
            <div style="font-size:0.82rem;color:var(--text-muted);">${c.relation} &nbsp;•&nbsp; ${c.phone_masked}</div>
            <div style="font-size:0.75rem;margin-top:2px;">
              <span style="color:${c.priority === 'primary' ? 'var(--brand)' : '#7A4A00'};font-weight:600;">
                ${c.priority === 'primary' ? '⭐ Primary Emergency Contact' : '2nd Emergency Contact'}
              </span>
            </div>
          </div>
        </div>
        <a href="tel:${c.phone_raw || ''}" class="btn-sm btn-ack" style="text-decoration:none;font-size:0.9rem;padding:8px 14px;">📞 Call</a>
      </div>
    `).join('');
  } catch (e) {
    console.error('Failed to load family details:', e);
  }
}

// --------------------------------------------------------------------------
// Diet Tips — Patient Dashboard
// --------------------------------------------------------------------------
async function loadDietTipForPatient(pid) {
  const wrap = document.getElementById('patientDietTipContent');
  if (!wrap) return;
  try {
    const res = await fetch(`/patients/${pid}/tips`);
    if (!res.ok) return;
    const data = await res.json();
    const tips = data.tips || [];
    // Find a diet-specific tip or show all tips with icons
    const dietTips = tips.filter(t =>
      t.title.toLowerCase().includes('diet') ||
      t.title.toLowerCase().includes('glucose') ||
      t.title.toLowerCase().includes('hydration') ||
      t.title.toLowerCase().includes('cardiac') ||
      t.title.toLowerCase().includes('blood pressure') ||
      t.title.toLowerCase().includes('temperature')
    );
    const displayTips = dietTips.length > 0 ? dietTips : tips;
    if (displayTips.length === 0) {
      wrap.innerHTML = `<div style="font-size:0.88rem;color:var(--text-muted);">No tips available.</div>`;
      return;
    }
    const icons = { 'Hydration': '💧', 'Glucose': '🩸', 'Blood Pressure': '🫀', 'Cardiac': '❤️', 'Temperature': '🌡️', 'Diet': '🥗' };
    wrap.innerHTML = displayTips.map(t => {
      const icon = Object.entries(icons).find(([k]) => t.title.includes(k))?.[1] || '🥗';
      return `
        <div style="display:flex;gap:12px;align-items:flex-start;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);margin-bottom:8px;">
          <span style="font-size:1.6rem;line-height:1;">${icon}</span>
          <div>
            <strong style="font-size:0.92rem;color:var(--brand);display:block;margin-bottom:2px;">${t.title}</strong>
            <span style="font-size:0.88rem;color:var(--text);line-height:1.5;">${t.tip}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('Failed to load diet tips:', e);
  }
}

// --------------------------------------------------------------------------
// Caregiver SMS Notification Log
// --------------------------------------------------------------------------
async function loadSmsInboxForCaregiver() {
  const wrap = document.getElementById('cgSmsInboxList');
  if (!wrap) return;
  try {
    const res = await fetch('/notifications/sms-inbox');
    if (!res.ok) return;
    const msgs = await res.json();
    if (msgs.length === 0) {
      wrap.innerHTML = `<div style="font-size:0.82rem;color:var(--text-muted);padding:8px 0;">No SMS notifications sent yet.</div>`;
      return;
    }
    wrap.innerHTML = msgs.slice(0, 20).map(m => {
      const isReport   = m.recipient_type === 'family_daily_report';
      const isCritical = m.message.includes('CRITICAL') || m.message.includes('SOS');
      const isWarning  = m.message.includes('Warning') || m.message.includes('WARNING');

      const borderColor = isCritical ? 'var(--crit-solid)' : isWarning ? '#D97706' : isReport ? 'var(--brand)' : 'var(--border)';
      const labelColor  = isCritical ? 'var(--crit-solid)' : isWarning ? '#D97706' : isReport ? 'var(--brand)' : 'var(--ink)';
      const badge = isReport
        ? `<span style="font-size:0.7rem;background:#EFF6FF;color:var(--brand);border:1px solid #BFDBFE;padding:1px 6px;border-radius:10px;font-weight:700;">📋 Daily Report</span>`
        : isCritical
        ? `<span style="font-size:0.7rem;background:#FEE2E2;color:var(--crit-solid);border:1px solid #FECACA;padding:1px 6px;border-radius:10px;font-weight:700;">🚨 Alert</span>`
        : isWarning
        ? `<span style="font-size:0.7rem;background:#FFFBEB;color:#D97706;border:1px solid #FDE68A;padding:1px 6px;border-radius:10px;font-weight:700;">⚠️ Warning</span>`
        : `<span style="font-size:0.7rem;background:#F1F5F9;color:#64748B;border:1px solid #CBD5E1;padding:1px 6px;border-radius:10px;font-weight:700;">📱 SMS</span>`;

      // For daily reports show a collapsed preview, not the full text
      const preview = isReport
        ? m.message.split('\n').slice(0, 5).join(' · ')
        : m.message;

      return `
        <div style="padding:8px 0 8px 10px;border-left:3px solid ${borderColor};border-bottom:1px solid var(--border);font-size:0.82rem;margin-bottom:2px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;margin-bottom:4px;">
            <div style="display:flex;align-items:center;gap:6px;">
              ${badge}
              <span style="font-weight:600;color:${labelColor};">To: ${m.phone_masked}</span>
            </div>
            <span style="color:var(--text-muted);font-size:0.75rem;white-space:nowrap;">${m.sent_at ? m.sent_at.split('T')[1].split('.')[0] : ''}</span>
          </div>
          <div style="color:var(--text);line-height:1.4;font-size:0.8rem;">${preview}</div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('Failed to load SMS inbox:', e);
  }
}

async function loadSmsInbox() {
  try {
    const res = await fetch('/notifications/sms-inbox');
    if (res.ok) {
      const msgs = await res.json();
      const wrap = document.getElementById('familyPhoneScreen');
      if (wrap) {
        if (msgs.length === 0) {
          wrap.innerHTML = `<div style="text-align:center;font-size:0.8rem;color:#888;margin-top:20px;">No incoming alerts in phone inbox.</div>`;
        } else {
          wrap.innerHTML = msgs.slice(0, 10).map(m => `
            <div class="sms-bubble ${m.message.includes('CRITICAL') || m.message.includes('SOS') ? 'crit' : ''}">
              <div style="font-weight:700;margin-bottom:2px;">To: ${m.phone_masked}</div>
              <div>${m.message}</div>
              <div class="sms-time">${m.sent_at ? m.sent_at.split('T')[1].split('.')[0] : ''}</div>
            </div>
          `).join('');
        }
      }
      // Also refresh caregiver SMS panel if visible
      loadSmsInboxForCaregiver();
    }
  } catch (e) {
    console.error(e);
  }
}

// --------------------------------------------------------------------------
// Admin & Judge Metrics Page (§16)
// --------------------------------------------------------------------------
async function loadMetrics() {
  try {
    const res = await fetch('/metrics');
    if (res.ok) {
      const data = await res.json();
      const latEl = document.getElementById('metricLatency');
      const critEl = document.getElementById('metricCritCount');
      const suppEl = document.getElementById('metricSuppressed');
      const quarEl = document.getElementById('metricQuarantined');
      const medEl = document.getElementById('metricMedAdherence');
      const srcEl = document.getElementById('metricSource');

      if (latEl) latEl.textContent = `${data.average_alert_latency_ms} ms`;
      if (critEl) critEl.textContent = (data.alerts_raised && data.alerts_raised['Critical']) || 0;
      if (suppEl) suppEl.textContent = data.alerts_suppressed_false_alarm || 0;
      if (quarEl) quarEl.textContent = data.sensor_errors_quarantined || 0;
      if (medEl) {
        const taken = (data.medicine_compliance && data.medicine_compliance['taken']) || 0;
        const missed = (data.medicine_compliance && data.medicine_compliance['missed']) || 0;
        const total = taken + missed;
        medEl.textContent = total > 0 ? `${Math.round((taken / total) * 100)}%` : '100%';
      }
      if (srcEl) srcEl.textContent = data.simulator_source;
    }
  } catch (e) {
    console.error(e);
  }
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
  } catch (e) {
    console.error(e);
  }
}

async function loadCaregiverQueue() {
  try {
    const res = await fetch('/caregivers');
    if (res.ok) {
      const cgs = await res.json();
      const wrap = document.getElementById('caregiverQueueList');
      if (wrap) {
        wrap.innerHTML = cgs.map(c => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #E4ECEE;">
            <div>
              <strong>${c.name}</strong> • ${c.experience}
              <div style="font-size:0.75rem;color:#666;">Status: <span style="font-weight:600;color:${c.verification_status === 'Verified' ? '#14663F' : '#7A4A00'}">${c.verification_status}</span></div>
            </div>
            <div>
              ${c.verification_status !== 'Verified' ? `
                <button class="btn-sm btn-resolve" onclick="verifyCaregiver('${c.caregiver_id}', 'Verified')">Approve / Verify</button>
                <button class="btn-sm" onclick="verifyCaregiver('${c.caregiver_id}', 'Rejected')">Reject</button>
              ` : `<span style="font-size:0.78rem;color:#14663F;">✓ Active</span>`}
            </div>
          </div>
        `).join('');
      }
    }
  } catch (e) {
    console.error(e);
  }
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

// --------------------------------------------------------------------------
// Simulator & Dataset Replayer Controls (§7, §9)
// --------------------------------------------------------------------------
async function triggerAnomaly(type) {
  let endpoint = `/trigger/${type}`;
  if (type === 'emergency') endpoint = '/simulate/emergency';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: state.selectedPatientId })
  });
  if (res.ok) {
    showToast(`Injected ${type} anomaly on ${state.selectedPatientId}! Watch vitals rise.`);
  }
}

async function switchDataSource(source) {
  const res = await fetch('/demo/source', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source })
  });
  if (res.ok) {
    showToast(`Switched active data stream to: ${source}`);
    loadSimulatorStats();
  }
}

async function loadSimulatorStats() {
  const res = await fetch('/demo/source');
  if (res.ok) {
    const data = await res.json();
    const lbl = document.getElementById('currentSourceLabel');
    if (lbl) lbl.textContent = data.source;
  }
}

// --------------------------------------------------------------------------
// Family WhatsApp Daily Report — Simulator Tab
// --------------------------------------------------------------------------
async function triggerDailyReport() {
  const btn = document.querySelector('[onclick="triggerDailyReport()"]');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
  try {
    const res = await fetch('/trigger/daily-report', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      showToast(`📲 ${data.message}`, false);
      await loadWhatsappInbox();
      loadSmsInboxForCaregiver();
    } else {
      showToast('Failed to send daily report. Check server logs.', true);
    }
  } catch (e) {
    showToast('Error sending daily report.', true);
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}

async function loadWhatsappInbox() {
  const wrap = document.getElementById('whatsappInboxList');
  if (!wrap) return;
  try {
    const res = await fetch('/notifications/sms-inbox');
    if (!res.ok) return;
    const msgs = await res.json();
    const relevant = msgs.filter(m =>
      m.recipient_type === 'family_daily_report' ||
      m.recipient_type === 'family' ||
      m.recipient_type === 'family_secondary'
    );
    if (relevant.length === 0) {
      wrap.innerHTML = `<div style="font-size:0.82rem;color:var(--text-muted);padding:8px 0;">No family notifications sent yet. Click "Send Morning Health Report" to demo.</div>`;
      return;
    }
    wrap.innerHTML = relevant.slice(0, 15).map(m => {
      const isReport   = m.recipient_type === 'family_daily_report';
      const isCritical = m.message.includes('CRITICAL') || m.message.includes('SOS');
      const isWarning  = m.message.includes('Warning') || m.message.includes('WARNING');
      const badge = isReport
        ? `<span style="font-size:0.7rem;background:#dcfce7;color:#15803D;padding:1px 7px;border-radius:10px;font-weight:700;">📋 Daily Report</span>`
        : isCritical
        ? `<span style="font-size:0.7rem;background:#FEE2E2;color:#DC2626;padding:1px 7px;border-radius:10px;font-weight:700;">🚨 Critical Alert</span>`
        : isWarning
        ? `<span style="font-size:0.7rem;background:#FFFBEB;color:#D97706;padding:1px 7px;border-radius:10px;font-weight:700;">⚠️ Warning</span>`
        : `<span style="font-size:0.7rem;background:#f0fdf4;color:#15803D;padding:1px 7px;border-radius:10px;font-weight:700;">📱 Family Alert</span>`;

      // Collapse long daily report messages to first 4 lines
      const preview = isReport
        ? m.message.split('\n').slice(0, 5).join('\n')
        : m.message;

      return `
        <div style="padding:10px;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:8px;background:#f0fdf4;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="color:#25D366;font-size:1rem;">●</span>
              ${badge}
            </div>
            <span style="font-size:0.74rem;color:#64748B;">${m.sent_at ? m.sent_at.split('T')[1].split('.')[0] : ''}</span>
          </div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;margin-bottom:3px;">To: ${m.phone_masked}</div>
          <pre style="font-size:0.75rem;color:#374151;white-space:pre-wrap;margin:0;font-family:inherit;line-height:1.5;">${preview}</pre>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('Failed to load WhatsApp inbox:', e);
  }
}

// --------------------------------------------------------------------------
// Live Trend Chart (Canvas / Chart Rendering)
// --------------------------------------------------------------------------
async function loadPatientHistory(pid) {
  try {
    const res = await fetch(`/patients/${pid}/measurements?limit=40`);
    if (res.ok) {
      state.selectedPatientHistory = await res.json();
      renderLiveChart();
    }
  } catch (e) {
    console.error(e);
  }
}

function appendReadingToChart(reading) {
  state.selectedPatientHistory.push(reading);
  if (state.selectedPatientHistory.length > 50) {
    state.selectedPatientHistory.shift();
  }
  renderLiveChart();
}

function renderLiveChart() {
  const canvas = document.getElementById('patientVitalsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.parentElement.clientWidth || 550;
  const height = canvas.height = canvas.parentElement.clientHeight || 260;

  ctx.clearRect(0, 0, width, height);

  // Background grid
  ctx.strokeStyle = '#E4ECEE';
  ctx.lineWidth = 1;
  for (let y = 30; y < height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw Warning & Critical limit lines (HR: 100 and 120)
  // Mapping 40 BPM (bottom) to 150 BPM (top)
  const mapY = (val) => height - 30 - ((val - 40) / (150 - 40)) * (height - 60);

  // Warning limit (100 BPM)
  const warnY = mapY(100);
  ctx.strokeStyle = '#F2A900';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(40, warnY);
  ctx.lineTo(width, warnY);
  ctx.stroke();
  ctx.fillStyle = '#7A4A00';
  ctx.font = '10px sans-serif';
  ctx.fillText('Warn Limit: 100 BPM', width - 110, warnY - 4);

  // Critical limit (120 BPM)
  const critY = mapY(120);
  ctx.strokeStyle = '#C62828';
  ctx.beginPath();
  ctx.moveTo(40, critY);
  ctx.lineTo(width, critY);
  ctx.stroke();
  ctx.fillStyle = '#A31515';
  ctx.fillText('Crit Limit: 120 BPM', width - 105, critY - 4);
  ctx.setLineDash([]);

  // Plot Heart Rate data points
  const history = state.selectedPatientHistory;
  if (history.length < 2) return;

  const stepX = (width - 60) / Math.max(1, history.length - 1);

  ctx.strokeStyle = '#0F7C86';
  ctx.lineWidth = 2.5;
  ctx.beginPath();

  history.forEach((m, idx) => {
    const hr = m.heart_rate || 75;
    const x = 45 + idx * stepX;
    const y = mapY(hr);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Highlight points
  history.forEach((m, idx) => {
    const hr = m.heart_rate || 75;
    const x = 45 + idx * stepX;
    const y = mapY(hr);

    ctx.beginPath();
    ctx.arc(x, y, hr >= 120 ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = hr >= 120 ? '#C62828' : (hr >= 100 ? '#F2A900' : '#0F7C86');
    ctx.fill();
  });
}

// --------------------------------------------------------------------------
// Hero Trace Canvas Interactive Animation (§6)
// --------------------------------------------------------------------------
let heroAngle = 0;
function initHeroTraceCanvas() {
  const canvas = document.getElementById('heroTraceCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function draw() {
    const w = canvas.width = canvas.parentElement.clientWidth || 400;
    const h = canvas.height = canvas.parentElement.clientHeight || 180;

    ctx.fillStyle = '#0A1C22';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#18404B';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Threshold line
    const threshY = h * 0.35;
    ctx.strokeStyle = state.heroSimBreach ? '#FF6B57' : '#2C5360';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, threshY);
    ctx.lineTo(w, threshY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = state.heroSimBreach ? '#FF6B57' : '#9DB8BE';
    ctx.font = '11px sans-serif';
    ctx.fillText('Critical Threshold: 110 BPM', w - 150, threshY - 6);

    // Sine trace with QRS spikes
    heroAngle += 0.08;
    const isBreach = state.heroSimBreach;
    const bpm = isBreach ? 128 : 74;

    const bpmEl = document.getElementById('heroBpmValue');
    if (bpmEl) bpmEl.textContent = `${bpm} BPM`;

    ctx.strokeStyle = isBreach ? '#FF6B57' : '#5FD0D8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    const baselineY = isBreach ? h * 0.45 : h * 0.6;
    for (let x = 0; x < w; x++) {
      const t = heroAngle - (w - x) * 0.035;
      let y = baselineY + Math.sin(t * 2) * 8;
      // QRS spike every period
      const mod = (t % (Math.PI * 2));
      if (mod > 1.2 && mod < 1.4) {
        y -= isBreach ? 55 : 35;
      } else if (mod > 1.4 && mod < 1.55) {
        y += 15;
      }
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);

  // Button: Simulate Hero Breach
  const testBtn = document.getElementById('heroTestBreachBtn');
  if (testBtn) {
    testBtn.addEventListener('click', () => {
      state.heroSimBreach = !state.heroSimBreach;
      const expl = document.getElementById('heroExplanationText');
      const claimBtn = document.getElementById('heroClaimBtn');
      if (state.heroSimBreach) {
        testBtn.textContent = 'Reset to Normal';
        if (expl) expl.textContent = 'Alert fired: Heart rate spiked to 128 BPM, crossing 110 BPM critical threshold.';
        if (claimBtn) claimBtn.style.display = 'inline-block';
        speakNotification('Alert fired: Heart rate 128 BPM above configured limit.');
      } else {
        testBtn.textContent = 'Trigger Test Breach';
        if (expl) expl.textContent = 'Live vital trace within normal physiological bounds (74 BPM).';
        if (claimBtn) claimBtn.style.display = 'none';
      }
    });
  }

  const claimBtn = document.getElementById('heroClaimBtn');
  if (claimBtn) {
    claimBtn.addEventListener('click', () => {
      state.heroBreachClaimed = true;
      claimBtn.textContent = '✓ Claimed by Caregiver (Priya)';
      showToast('Priya (Caregiver) claimed the alert with a 60s lock.');
    });
  }
}

// --------------------------------------------------------------------------
// Toast Helper
// --------------------------------------------------------------------------
function showToast(message, isUrgent = false) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  if (isUrgent) {
    toast.style.background = '#C62828';
  }
  toast.innerHTML = `<span>${isUrgent ? '🚨' : 'ℹ️'}</span> <div>${message}</div>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
