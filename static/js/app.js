/* ==========================================================================
   CareBeat / SmartCare Application Logic — Redesigned
   Preserves all existing API calls and business logic.
   Adds: login/logout, accordion sections, new patient dashboard rendering.
   ========================================================================== */

const state = {
  activeView: null,          // 'patient' or 'caregiver' — null before login
  activeRole: null,          // 'patient' or 'caregiver'
  loggedInUser: null,        // { role, name }
  selectedPatientId: 'p1',
  patients: [],
  alerts: [],
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

function doLogin(event, role) {
  if (event && event.preventDefault) event.preventDefault();
  const cred = DEMO_CREDS[role] || { name: role === 'patient' ? 'Demo Patient A' : 'Priya Nair' };

  // Success → animate out login, show app
  state.activeRole = role;
  state.loggedInUser = { role, name: cred.name };

  const loginEl = document.getElementById('loginScreen');
  if (loginEl) {
    loginEl.style.transition = 'opacity 0.5s, transform 0.5s';
    loginEl.style.opacity = '0';
    loginEl.style.transform = 'scale(0.97)';
  }

  setTimeout(() => {
    if (loginEl) loginEl.style.display = 'none';
    const appRoot = document.getElementById('appRoot');
    if (appRoot) {
      appRoot.style.display = 'flex';
      appRoot.style.flexDirection = 'column';

      // Animate app root in
      appRoot.style.opacity = '0';
      appRoot.style.transition = 'opacity 0.4s';
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

    // Init systems
    initWebSocket();
    loadPatients();
    loadAlerts();
    loadMetrics();
    loadSmsInbox();

    if (!state._intervalsStarted) {
      state._intervalsStarted = true;
      setInterval(loadSmsInbox, 4000);
      setInterval(loadAlerts,   5000);
      setInterval(loadMetrics,  7000);
    }

    // Switch to appropriate view
    switchView(role === 'patient' ? 'patient' : 'caregiver');

  }, 500);
}

function doLogout() {
  // Stop WebSocket
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

    // Reset login form
    ['patientUser','patientPass','caregiverUser','caregiverPass'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['patientError','caregiverError'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

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

// ==========================================================================
// ACCORDION SECTIONS
// ==========================================================================
function toggleAccordion(id) {
  const section = document.getElementById(id);
  if (!section) return;
  const isOpen = section.classList.contains('open');
  section.classList.toggle('open', !isOpen);

  // Load data when accordion opens
  if (!isOpen) {
    if (id === 'acc-family') {
      loadSmsInbox();
      loadHandoverNotes(state.selectedPatientId);
    } else if (id === 'acc-metrics') {
      loadMetrics();
      loadAuditTrail();
      loadCaregiverQueue();
    } else if (id === 'acc-simulator') {
      loadSimulatorStats();
    }
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
});

// ==========================================================================
// WEBSOCKET LIVE CONNECTION
// ==========================================================================
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    console.log('CareBeat WebSocket connected');
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

  state.ws.onclose = () => {
    console.warn('WebSocket closed, reconnecting in 2s...');
    const badge = document.getElementById('wsStatusBadge');
    const dot   = document.getElementById('wsStatusDot');
    if (badge) { badge.textContent = '○ Reconnecting...'; badge.style.color = '#F59E0B'; }
    if (dot)   { dot.classList.add('offline'); }
    setTimeout(initWebSocket, 2000);
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
    showToast(`Data source: ${msg.source}`);
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
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0; u.pitch = 1.0;
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
}

function renderPatientCards() {
  const container = document.getElementById('patientCardsGrid');
  if (!container) return;

  container.innerHTML = state.patients.map(p => {
    const m = p.latest_measurement || {};
    const isSelected = p.patient_id === state.selectedPatientId;
    const cond = p.condition_tags ? p.condition_tags.join(', ') : 'General';
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
              ${m.heart_rate != null ? m.heart_rate : '--'}<span class="vital-unit"> BPM</span>
            </div>
          </div>
          <div class="vital-box">
            <span class="vital-label">SpO₂</span>
            <div class="vital-value" id="val-spo2-${p.patient_id}">
              ${m.spo2 != null ? m.spo2 : '--'}<span class="vital-unit"> %</span>
            </div>
          </div>
          <div class="vital-box">
            <span class="vital-label">Temp</span>
            <div class="vital-value" id="val-temp-${p.patient_id}">
              ${m.temperature != null ? m.temperature : '--'}<span class="vital-unit"> °C</span>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <span>Source: <strong>${m.source || 'simulator'}</strong></span>
          <span class="health-score-badge">Score: ${p.health_score != null ? p.health_score : 95}/100</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderPatientCardVitals(p) {
  const m = p.latest_measurement || {};
  const hrEl   = document.getElementById(`val-hr-${p.patient_id}`);
  const spo2El = document.getElementById(`val-spo2-${p.patient_id}`);
  const tempEl = document.getElementById(`val-temp-${p.patient_id}`);
  if (hrEl   && m.heart_rate  != null) hrEl.innerHTML   = `${m.heart_rate}<span class="vital-unit"> BPM</span>`;
  if (spo2El && m.spo2        != null) spo2El.innerHTML = `${m.spo2}<span class="vital-unit"> %</span>`;
  if (tempEl && m.temperature != null) tempEl.innerHTML = `${m.temperature}<span class="vital-unit"> °C</span>`;
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
  if (titleEl) titleEl.textContent = `${p.name} — Live Vitals Trend`;
  loadCareTasks(p.patient_id);
  loadMedicines(p.patient_id);
  loadPatientTips(p.patient_id);
  loadThresholdConfig(p.patient_id);
  loadHandoverNotes(p.patient_id);
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
      if (!wrap) return;
      if (tasks.length === 0) {
        wrap.innerHTML = `<div style="font-size:0.82rem;color:var(--text-muted);">No pending tasks today. 🎉</div>`;
      } else {
        wrap.innerHTML = tasks.map(t => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px;border-bottom:1px solid var(--border);">
            <div>
              <strong style="font-size:0.85rem;">${t.task_type}</strong>
              <div style="font-size:0.72rem;color:var(--text-muted);">Due: ${t.due_time.split(' ')[1] || t.due_time}</div>
            </div>
            <button class="btn-sm ${t.status === 'done' ? 'btn-ack' : ''}" onclick="updateTaskStatus('${t.task_id}', 'done')">
              ${t.status === 'done' ? '✓ Done' : 'Mark Done'}
            </button>
          </div>
        `).join('');
      }
    }
  } catch (e) { console.error('Failed to load care tasks:', e); }
}

async function updateTaskStatus(taskId, status) {
  await fetch(`/care-tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
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
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px;border-bottom:1px solid var(--border);">
            <div>
              <strong style="font-size:0.85rem;">${m.name}</strong>
              <div style="font-size:0.72rem;color:var(--text-muted);">${m.schedule_times.join(', ')} • ${m.notes || ''}</div>
            </div>
            ${latestLog && latestLog.status === 'taken'
              ? `<span style="font-size:0.72rem;color:var(--ok-fg);font-weight:700;">✓ Taken</span>`
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
}

async function fastForwardMedicine() {
  try {
    const res = await fetch('/demo/fast-forward-medicine', { method: 'POST' });
    const data = await res.json();
    showToast(`Fast-forwarded medicine reminder: ${data.medicine}`);
    loadMedicines(state.selectedPatientId);
  } catch (e) { console.error(e); }
}

// ==========================================================================
// AI SUMMARY & TIPS
// ==========================================================================
async function triggerAISummary() {
  const wrap  = document.getElementById('aiSummaryContent');
  const badge = document.getElementById('aiSourceBadge');
  if (wrap) wrap.innerHTML = `<em style="color:var(--text-muted);">Generating 24-hour summary...</em>`;
  try {
    const res = await fetch(`/patients/${state.selectedPatientId}/summary`);
    if (res.ok) {
      const data = await res.json();
      if (wrap)  wrap.innerHTML = `<div class="ai-text">${data.summary}</div>`;
      if (badge) badge.textContent = data.source === 'gemini-api' ? `Gemini AI (${data.model})` : `Clinical Heuristics`;
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
          <div style="margin-bottom:8px;padding:8px;background:var(--brand-light);border-radius:var(--r-sm);">
            <strong style="font-size:0.82rem;color:var(--brand-dark);">${t.title}:</strong>
            <span style="font-size:0.82rem;color:var(--ink);">${t.tip}</span>
          </div>
        `).join('');
      }
    }
  } catch (e) { console.error(e); }
}

// ==========================================================================
// THRESHOLD CONFIG
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
  if (resBox) resBox.innerHTML = `<strong>Sandbox:</strong> With these limits, <strong>${breaches}</strong> alert(s) would have fired.`;
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
    wrap.innerHTML = `<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:0.82rem;">No active alerts right now.</div>`;
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
          <span style="color:${isCrit ? '#991B1B' : '#92400E'};">
            ${isEsc ? '⚠️ ESCALATED: ' : ''}${a.severity.toUpperCase()}
          </span>
          <span style="color:var(--text-muted);font-size:0.72rem;">${a.created_at ? a.created_at.split('T')[1].split('.')[0] : ''}</span>
        </div>
        <div class="alert-explanation">${a.explanation}</div>
        <div style="font-size:0.72rem;margin-bottom:6px;color:var(--text-muted);">
          Status: <strong>${a.state}</strong>${a.claim_locked_by ? ` • Locked: ${a.claim_locked_by}` : ''}
        </div>
        <div class="alert-actions">
          ${!isAck && !isRes ? `
            <button class="btn-sm btn-claim"   onclick="claimAlert('${a.alert_id}')">Claim Lock</button>
            <button class="btn-sm btn-ack"     onclick="acknowledgeAlert('${a.alert_id}')">Acknowledge</button>
          ` : ''}
          ${isAck && !isRes ? `<button class="btn-sm btn-resolve" onclick="resolveAlert('${a.alert_id}')">Mark Resolved</button>` : ''}
          ${isRes ? `<span style="font-size:0.72rem;color:var(--ok-fg);">✓ Resolved</span>` : ''}
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
  showToast('Alert acknowledged. Siren stopped.');
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
// PATIENT DASHBOARD RENDERING
// ==========================================================================
function renderPatientSosView() {
  const p = state.patients.find(pt => pt.patient_id === state.selectedPatientId) || state.patients[0];
  if (!p) return;

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

  updatePatientBigVitals(m);
  loadPatientMedsForPatientScreen(p.patient_id);
  setupSosButton();
  updatePatientStatusBanner(p);
}

function updatePatientBigVitals(m) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val != null) el.textContent = val;
  };
  set('sosBigHr',   m.heart_rate);
  set('sosBigSpo2', m.spo2);
  set('sosBigTemp', m.temperature);
}

function updatePatientStatusBanner(p) {
  const banner = document.getElementById('patientStatusBanner');
  if (!banner) return;
  const sc = p.status_color || 'normal';
  banner.className = `patient-status-banner ${sc !== 'normal' ? 'status-' + sc : ''}`;
  const inner = banner.querySelector('div');
  if (!inner) return;
  if (sc === 'critical') {
    inner.innerHTML = `<span style="font-size:1.5rem;">🚨</span><div><div style="font-weight:700;color:var(--crit-fg);">⚠️ Critical Alert Active</div><div style="font-size:0.78rem;color:var(--crit-fg);opacity:0.8;">Your caregiver has been notified immediately.</div></div>`;
  } else if (sc === 'warning') {
    inner.innerHTML = `<span style="font-size:1.5rem;">⚠️</span><div><div style="font-weight:700;color:var(--warn-fg);">Warning: Vitals Need Attention</div><div style="font-size:0.78rem;color:var(--warn-fg);opacity:0.8;">Your caregiver is monitoring the situation.</div></div>`;
  } else {
    inner.innerHTML = `<span style="font-size:1.5rem;">🛡️</span><div><div style="font-weight:700;color:var(--ok-fg);">All Vitals Normal</div><div style="font-size:0.78rem;color:var(--ok-fg);opacity:0.8;">Your vitals are checked every second. Your caregiver is connected.</div></div>`;
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
      if (!wrap) return;
      if (meds.length === 0) {
        wrap.innerHTML = `<div style="font-size:0.9rem;color:var(--text-muted);">No medicines scheduled today. 🌟</div>`;
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
                ? `<span style="font-size:0.85rem;color:var(--ok-fg);font-weight:700;background:var(--ok-bg);padding:6px 14px;border-radius:var(--r-full);">✓ Taken!</span>`
                : `<button class="btn-sm btn-ack" style="font-size:0.88rem;padding:9px 16px;border-radius:var(--r-full);" onclick="takeMedicine('${latestLog ? latestLog.log_id : ''}')">Mark as Taken</button>`
              }
            </div>
          `;
        }).join('');
      }
    }
  } catch (e) { console.error(e); }
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
      body: JSON.stringify({ patient_id: state.selectedPatientId, reason: 'Patient pressed SOS Button' })
    });
    if (res.ok) {
      showToast('🚨 SOS ALERT SENT TO CAREGIVER & FAMILY!', true);
      speakNotification('Emergency help requested. Caregivers and family notified.');
      const subtext = document.getElementById('sosBtnSubtext');
      if (subtext) subtext.textContent = '✓ ALERT SENT!';
      setTimeout(() => {
        if (subtext) subtext.textContent = 'Hold 3s or Tap';
      }, 4000);
    }
  } catch (e) { console.error(e); }
}

async function recordCheckIn() {
  try {
    const res = await fetch('/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: state.selectedPatientId })
    });
    if (res.ok) {
      showToast("✅ 'I'm OK' check-in recorded! Your caregiver has been notified.");
      speakNotification("Thank you. Your check-in has been confirmed.");
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
          wrap.innerHTML = `<em style="color:var(--text-muted);font-size:0.82rem;">No recent handover notes logged.</em>`;
        } else {
          wrap.innerHTML = notes.slice(0, 3).map(n => `
            <div class="handover-note-item">
              <div class="handover-note-meta">Shift: ${n.shift} • Caregiver ${n.caregiver_id} • ${n.created_at ? n.created_at.split('T')[0] : ''}</div>
              <div class="handover-note-text">${n.condition_summary || n.concerns || ''}</div>
            </div>
          `).join('');
        }
      }

      if (famWrap && notes.length > 0) {
        famWrap.innerHTML = `<em>"${notes[0].condition_summary || notes[0].concerns || ''}"</em>`;
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
        tasks_completed: 'Care duties logged',
        concerns: input.value.trim()
      })
    });
    if (res.ok) {
      showToast('Shift handover note submitted!');
      input.value = '';
      loadHandoverNotes(state.selectedPatientId);
    }
  } catch (e) { console.error(e); }
}

// ==========================================================================
// FAMILY VIEW (within accordion)
// ==========================================================================
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
            <div style="font-weight:700;margin-bottom:2px;font-size:0.75rem;">To: ${m.phone_masked}</div>
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
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 4px;border-bottom:1px solid var(--border);">
            <div>
              <strong>${c.name}</strong> • ${c.experience}
              <div style="font-size:0.72rem;color:${c.verification_status === 'Verified' ? 'var(--ok-fg)' : 'var(--warn-fg)'};">
                ${c.verification_status}
              </div>
            </div>
            <div>
              ${c.verification_status !== 'Verified'
                ? `<button class="btn-sm btn-ack" onclick="verifyCaregiver('${c.caregiver_id}', 'Verified')">Approve</button>`
                : `<span style="font-size:0.72rem;color:var(--ok-fg);">✓ Active</span>`}
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
  if (res.ok) showToast(`Injected ${type} anomaly — watch vitals!`);
}

async function switchDataSource(source) {
  const res = await fetch('/demo/source', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source })
  });
  if (res.ok) {
    showToast(`Switched data stream to: ${source}`);
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

// ==========================================================================
// LIVE CHART
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
  const width  = canvas.width  = canvas.parentElement.clientWidth  || 550;
  const height = canvas.height = canvas.parentElement.clientHeight || 260;

  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = '#F9FFFE';
  ctx.fillRect(0, 0, width, height);

  // Grid lines
  ctx.strokeStyle = 'rgba(12,202,170,0.12)';
  ctx.lineWidth = 1;
  for (let y = 30; y < height; y += 40) {
    ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // Map Y: 40 BPM (bottom) → 150 BPM (top)
  const mapY = (val) => height - 30 - ((val - 40) / (150 - 40)) * (height - 60);

  // Warning limit line
  const warnY = mapY(100);
  ctx.strokeStyle = '#F59E0B'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(40, warnY); ctx.lineTo(width, warnY); ctx.stroke();
  ctx.fillStyle = '#92400E'; ctx.font = '10px Inter, sans-serif';
  ctx.fillText('Warn: 100 BPM', width - 90, warnY - 4);

  // Critical limit line
  const critY = mapY(120);
  ctx.strokeStyle = '#DC2626';
  ctx.beginPath(); ctx.moveTo(40, critY); ctx.lineTo(width, critY); ctx.stroke();
  ctx.fillStyle = '#991B1B';
  ctx.fillText('Crit: 120 BPM', width - 90, critY - 4);
  ctx.setLineDash([]);

  const history = state.selectedPatientHistory;
  if (history.length < 2) return;

  const stepX = (width - 60) / Math.max(1, history.length - 1);

  // Line gradient
  const grad = ctx.createLinearGradient(40, 0, width, 0);
  grad.addColorStop(0, '#0CCAAA');
  grad.addColorStop(1, '#6366F1');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();

  history.forEach((m, idx) => {
    const hr = m.heart_rate || 75;
    const x = 45 + idx * stepX;
    const y = mapY(hr);
    if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Dots
  history.forEach((m, idx) => {
    const hr = m.heart_rate || 75;
    const x = 45 + idx * stepX;
    const y = mapY(hr);
    ctx.beginPath();
    ctx.arc(x, y, hr >= 120 ? 5 : 3, 0, Math.PI * 2);
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
