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
  chartInstance: null
};

// --------------------------------------------------------------------------
// Initialization
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initRoleSwitcher();
  initWebSocket();
  initHeroTraceCanvas();
  loadPatients();
  loadAlerts();
  loadMetrics();
  loadSmsInbox();

  // Polling for stats and SMS fallback
  setInterval(loadSmsInbox, 4000);
  setInterval(loadAlerts, 5000);
  setInterval(loadMetrics, 6000);
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
  } else if (viewName === 'family') {
    renderFamilyView();
  } else if (viewName === 'metrics') {
    loadMetrics();
    loadAuditTrail();
    loadCaregiverQueue();
  } else if (viewName === 'simulator') {
    loadSimulatorStats();
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
      } else if (state.activeRole === 'family') {
        switchView('family');
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
    const res = await fetch('/patients');
    if (res.ok) {
      state.patients = await res.json();
      renderPatientCards();
      renderSelectedPatientDetail();
      if (state.activeView === 'patient') renderPatientSosView();
      if (state.activeView === 'family') renderFamilyView();
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
    if (res.ok) {
      const data = await res.json();
      const wrap = document.getElementById('dailyTipsList');
      if (wrap && data.tips) {
        wrap.innerHTML = data.tips.map(t => `
          <div style="margin-bottom:8px;">
            <strong style="font-size:0.85rem;color:var(--brand);">${t.title}:</strong>
            <span style="font-size:0.85rem;color:var(--text);">${t.tip}</span>
          </div>
        `).join('');
      }
    }
  } catch (e) {
    console.error(e);
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

  const hrEl = document.getElementById('sosBigHr');
  const tempEl = document.getElementById('sosBigTemp');
  const spo2El = document.getElementById('sosBigSpo2');

  if (hrEl) hrEl.textContent = m.heart_rate != null ? m.heart_rate : '--';
  if (tempEl) tempEl.textContent = m.temperature != null ? m.temperature : '--';
  if (spo2El) spo2El.textContent = m.spo2 != null ? m.spo2 : '--';

  loadPatientMedsForPatientScreen(p.patient_id);
  setupSosButton();
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
// Family View & Simulated Phone Screen (§14.4)
// --------------------------------------------------------------------------
function renderFamilyView() {
  const p = state.patients.find(pt => pt.patient_id === state.selectedPatientId) || state.patients[0];
  if (!p) return;

  const fName = document.getElementById('familyPatientName');
  if (fName) fName.textContent = p.name;

  const fScore = document.getElementById('familyPatientScore');
  if (fScore) fScore.textContent = `${p.health_score || 95}/100`;

  loadSmsInbox();
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
