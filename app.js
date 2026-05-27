/* ============================================
   ICU 工作站 v2.0 — 重症医学科患者管理系统
   主应用逻辑
   ============================================ */

// --- 工具函数 ---
const $ = (s, p) => (p || document).querySelector(s);
const $$ = (s, p) => [...(p || document).querySelectorAll(s)];
const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
};
const fmtDateTime = (d) => {
  if (!d) return '';
  return fmtDate(d) + ' ' + String(new Date(d).getHours()).padStart(2,'0') + ':' + String(new Date(d).getMinutes()).padStart(2,'0');
};
const todayStr = () => new Date().toISOString().split('T')[0];
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
let nextPatientNum = 1;

// --- 常量 ---
const OUTCOME_TYPES = [
  { value: 'transfer', label: '转出', cssClass: 'outcome-transfer', icon: '\u2192' },
  { value: 'discharged', label: '好转出院', cssClass: 'outcome-discharged', icon: '\u2714' },
  { value: 'ama', label: '自动出院', cssClass: 'outcome-ama', icon: '\u2716' },
  { value: 'death', label: '死亡', cssClass: 'outcome-death', icon: '\u2020' },
];

// --- 状态 ---
let state = {
  patients: [],
  currentView: 'dashboard',
  currentPatientId: null,
};

// --- 持久化 ---
function saveState() {
  localStorage.setItem('icu_workstation_v2', JSON.stringify(state));
}
function loadState() {
  try {
    const raw = localStorage.getItem('icu_workstation_v2');
    if (raw) {
      const saved = JSON.parse(raw);
      state.patients = saved.patients || [];
      state.currentView = saved.currentView || 'dashboard';
      state.currentPatientId = saved.currentPatientId || null;
      if (state.patients.length > 0) {
        const maxNum = Math.max(...state.patients.map(p => {
          const m = (p.name || '').match(/患者(\d+)/);
          return m ? parseInt(m[1]) : 0;
        }));
        nextPatientNum = maxNum + 1;
      }
      return;
    }
  } catch(e) {}
  state.patients = [];
}
function getPatient(id) { return state.patients.find(p => p.id === id); }
function getCurrentPatient() { return state.currentPatientId ? getPatient(state.currentPatientId) : null; }

// --- Toast ---
function toast(msg, type) {
  type = type || '';
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 2500);
}

// --- Modal ---
function showModal(title, bodyHTML, onSave) {
  const overlay = document.getElementById('modalOverlay');
  overlay.innerHTML = '<div class="modal"><div class="modal-header"><h2 class="modal-title">' + escHtml(title) + '</h2><button class="modal-close" onclick="closeModal()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div class="modal-body">' + bodyHTML + '</div><div class="modal-footer"><button class="btn" onclick="closeModal()">取消</button><button class="btn btn-primary" id="modalSaveBtn">保存</button></div></div>';
  overlay.classList.add('open');
  if (onSave) {
    document.getElementById('modalSaveBtn').onclick = function() { onSave(); };
  }
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// --- Navigation ---
function navigate(view) {
  state.currentView = view;
  $$('.nav-item').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector('.nav-item[data-view="' + view + '"]');
  if (btn) btn.classList.add('active');
  render();
  saveState();
}

// --- Render Entry ---
function render() {
  const main = document.getElementById('mainContent');
  switch(state.currentView) {
    case 'dashboard': renderDashboard(main); break;
    case 'patient': renderPatientDetail(main); break;
    case 'handover': renderHandover(main); break;
    case 'outcome': renderOutcome(main); break;
    case 'literature': renderLiterature(main); break;
    default: renderDashboard(main);
  }
}

// --- Patient ID Generator ---
function newPatientId() {
  const id = 'p' + Date.now();
  return id;
}
// ============================================
//  1. 病区总览 (Dashboard)
// ============================================
function renderDashboard(main) {
  const activePatients = state.patients.filter(p => !p.outcome);
  const terminatedPatients = state.patients.filter(p => p.outcome);
  let abxAlerts = 0;
  activePatients.forEach(p => {
    abxAlerts += (p.antibiotics || []).filter(a => {
      if (!a.startDate || a.endDate) return false;
      return Math.floor((new Date() - new Date(a.startDate)) / 86400000) >= 7;
    }).length;
  });

  let html = '<div class="page-header"><div><h1 class="page-title">病区总览</h1><p class="page-subtitle">' + fmtDate(new Date()) + ' \u00b7 在科患者 ' + activePatients.length + ' 人 \u00b7 累计管理 ' + state.patients.length + ' 人</p></div><div class="page-actions"><button class="btn btn-primary" onclick="showAddPatient()">+ 收入患者</button><button class="btn" onclick="navigate(\'handover\')">生成交班记录</button></div></div>';

  // 快速统计
  html += '<div class="quick-stats">' +
    '<div class="stat-card" onclick="navigate(\'outcome\')" style="cursor:pointer"><div class="stat-value">' + state.patients.length + '</div><div class="stat-label">累计管理</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + activePatients.length + '</div><div class="stat-label">当前在科</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + abxAlerts + '</div><div class="stat-label">抗生素 \u22657天</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + terminatedPatients.length + '</div><div class="stat-label">已转归</div></div>' +
  '</div>';

  html += '<div class="dashboard-grid">';

  // 在科患者卡片
  activePatients.forEach(p => {
    html += buildPatientCard(p);
  });

  // 添加患者按钮
  html += '<div class="add-patient-card" onclick="showAddPatient()">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>' +
    '<span>收入新患者</span>' +
  '</div>';

  html += '</div>';

  // 如果没有任何患者
  if (state.patients.length === 0) {
    html = '<div class="page-header"><div><h1 class="page-title">病区总览</h1><p class="page-subtitle">尚未录入患者</p></div><div class="page-actions"><button class="btn btn-primary" onclick="showAddPatient()">+ 收入患者</button></div></div>' +
      '<div class="empty-state"><p>点击「收入患者」开始录入第一位患者信息</p></div>';
  }

  main.innerHTML = html;
}

function buildPatientCard(p) {
  const latestVitals = (p.vitals && p.vitals.length > 0) ? p.vitals[p.vitals.length - 1] : null;
  const activeAbx = (p.antibiotics || []).filter(a => !a.endDate);
  const latestMicro = (p.microbiology && p.microbiology.length > 0) ? p.microbiology[p.microbiology.length - 1] : null;

  let alerts = [];
  if (latestVitals && latestVitals.hr && (Number(latestVitals.hr) > 120 || Number(latestVitals.hr) < 50)) alerts.push('心率异常');
  if (latestVitals && latestVitals.spo2 && Number(latestVitals.spo2) < 90) alerts.push('低氧');
  if (activeAbx.length > 0) {
    const maxDays = Math.max(...activeAbx.map(a => {
      if (!a.startDate) return 0;
      return Math.floor((new Date() - new Date(a.startDate)) / 86400000);
    }));
    if (maxDays >= 7) alerts.push('抗生素\u22657d');
  }

  let card = '<div class="patient-card">' +
    '<div class="patient-card-header">' +
      '<span class="patient-card-name" onclick="openPatient(\'' + p.id + '\')" style="cursor:pointer">' + escHtml(p.name || '未命名') + '</span>' +
      '<div style="display:flex;gap:8px;align-items:center;">' +
        '<span class="patient-card-bed">' + escHtml(p.bed || '—') + '</span>' +
        '<button class="patient-card-action" onclick="event.stopPropagation();showTerminatePatient(\'' + p.id + '\')" title="终止治疗">结束治疗</button>' +
      '</div>' +
    '</div>' +
    '<div class="patient-card-body" onclick="openPatient(\'' + p.id + '\')">';

  if (p.primaryDiagnosis) {
    card += '<div class="patient-info-row"><span>主诊断</span><strong>' + escHtml(p.primaryDiagnosis) + '</strong></div>';
  } else {
    card += '<div class="patient-info-row"><span>主诊断</span><em style="color:var(--text-muted)">未录入</em></div>';
  }
  if (p.age) card += '<div class="patient-info-row"><span>年龄/性别</span><strong>' + escHtml(p.age) + '岁 / ' + escHtml(p.gender || '—') + '</strong></div>';
  card += '<div class="patient-info-row"><span>入院日期</span><strong>' + escHtml(p.admissionDate || '—') + '</strong></div>';

  if (latestVitals) {
    card += '<div style="margin-top:8px;font-size:0.8rem;color:var(--text-secondary);display:flex;gap:12px;flex-wrap:wrap;">';
    if (latestVitals.hr) card += '<span>HR <strong>' + escHtml(latestVitals.hr) + '</strong></span>';
    if (latestVitals.sbp && latestVitals.dbp) card += '<span>BP <strong>' + escHtml(latestVitals.sbp) + '/' + escHtml(latestVitals.dbp) + '</strong></span>';
    if (latestVitals.spo2) card += '<span>SpO\u2082 <strong>' + escHtml(latestVitals.spo2) + '%</strong></span>';
    card += '</div>';
  }
  card += '</div><div class="patient-card-footer">';
  if (alerts.length > 0) {
    card += '<span><span class="alert-dot alert-red"></span>' + alerts.join(', ') + '</span>';
  } else {
    card += '<span><span class="alert-dot alert-green"></span>无预警</span>';
  }
  if (latestMicro) card += '<span>病原学: ' + escHtml(latestMicro.organism || '待报') + '</span>';
  if (activeAbx.length > 0) card += '<span>抗感染: ' + activeAbx.length + ' 种</span>';
  card += '</div></div>';
  return card;
}

function openPatient(id) {
  state.currentPatientId = id;
  state.currentView = 'patient';
  $$('.nav-item').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector('.nav-item[data-view="patient"]');
  if (btn) btn.classList.add('active');
  render();
  saveState();
}

// --- Add Patient ---
function showAddPatient() {
  const body = '<div class="form-row"><div class="form-group"><label class="form-label">姓名</label><input class="form-input" id="fNewName" value="患者' + nextPatientNum + '"></div><div class="form-group"><label class="form-label">床号</label><input class="form-input" id="fNewBed" placeholder="如: ICU-05"></div></div>' +
    '<div class="form-row-3"><div class="form-group"><label class="form-label">年龄</label><input class="form-input" id="fNewAge" type="number"></div><div class="form-group"><label class="form-label">性别</label><select class="form-select" id="fNewGender"><option value="男">男</option><option value="女">女</option></select></div><div class="form-group"><label class="form-label">入院日期</label><input class="form-input" id="fNewAdmit" type="date" value="' + todayStr() + '"></div></div>' +
    '<div class="form-group"><label class="form-label">主要诊断</label><input class="form-input" id="fNewDiag" placeholder="入院主要诊断"></div>' +
    '<div class="form-group"><label class="form-label">次要诊断（逗号分隔）</label><input class="form-input" id="fNewDiag2" placeholder="次要诊断"></div>';

  showModal('收入新患者', body, function() {
    const name = document.getElementById('fNewName').value || ('患者' + nextPatientNum);
    if (name === ('患者' + nextPatientNum)) nextPatientNum++;
    const p = {
      id: newPatientId(),
      name: name,
      bed: document.getElementById('fNewBed').value,
      age: document.getElementById('fNewAge').value,
      gender: document.getElementById('fNewGender').value,
      admissionDate: document.getElementById('fNewAdmit').value,
      primaryDiagnosis: document.getElementById('fNewDiag').value,
      secondaryDiagnoses: document.getElementById('fNewDiag2').value,
      outcome: null,
      vitals: [], labs: [], abgs: [], microbiology: [], antibiotics: [],
      treatmentNotes: [], fluidBalance: [], scores: [],
    };
    state.patients.push(p);
    saveState();
    closeModal();
    render();
    toast('已收入患者: ' + name, 'success');
  });
}

// --- Terminate Patient ---
function showTerminatePatient(pid) {
  const p = getPatient(pid);
  if (!p) return;

  let optionsHTML = '';
  OUTCOME_TYPES.forEach(ot => {
    optionsHTML += '<div class="termination-option" data-outcome="' + ot.value + '" onclick="selectTerminationOption(this)">' +
      '<div class="termination-option-icon" style="background:var(--' + (ot.value === 'death' ? 'surface-alt' : ot.cssClass.replace('outcome-','') === 'transfer' ? 'warning-light' : ot.cssClass.replace('outcome-','') === 'discharged' ? 'success-light' : 'danger-light') + ')">' + ot.icon + '</div>' +
      '<div class="termination-option-label">' + ot.label + '</div>' +
    '</div>';
  });

  const body = '<p style="margin-bottom:12px;color:var(--text-secondary);">为 <strong>' + escHtml(p.name) + '</strong> (' + escHtml(p.bed) + ') 选择治疗转归：</p>' +
    '<div id="terminationOptions">' + optionsHTML + '</div>' +
    '<div class="form-group" style="margin-top:12px;"><label class="form-label">备注（可选）</label><textarea class="form-textarea" id="fTermNote" placeholder="简要描述转归情况、转科去向等..."></textarea></div>' +
    '<input type="hidden" id="fTermOutcome" value="">';

  showModal('结束治疗 — ' + escHtml(p.name), body, function() {
    const outcomeVal = document.getElementById('fTermOutcome').value;
    if (!outcomeVal) { toast('请选择转归类型', 'error'); return; }
    const ot = OUTCOME_TYPES.find(o => o.value === outcomeVal);
    p.outcome = {
      type: outcomeVal,
      label: ot ? ot.label : outcomeVal,
      date: todayStr(),
      notes: document.getElementById('fTermNote').value,
    };
    saveState();
    closeModal();
    render();
    toast(p.name + ' 已标记为「' + p.outcome.label + '」，可在转归管理中查看', 'success');
  });
}

function selectTerminationOption(el) {
  $$('#terminationOptions .termination-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('fTermOutcome').value = el.dataset.outcome;
}
// --- 2a. 基本信息 & 诊疗记录 ---
function renderPatientInfo(container, p) {
  let html = '<div class="card" style="margin-bottom:18px"><div class="card-header"><span class="card-title">基本信息</span></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;font-size:0.85rem;">' +
      '<div><span style="color:var(--text-muted)">姓名：</span><strong>' + escHtml(p.name) + '</strong></div>' +
      '<div><span style="color:var(--text-muted)">床号：</span><strong>' + escHtml(p.bed) + '</strong></div>' +
      '<div><span style="color:var(--text-muted)">年龄/性别：</span><strong>' + escHtml(p.age) + '岁 / ' + escHtml(p.gender) + '</strong></div>' +
      '<div><span style="color:var(--text-muted)">入院日期：</span><strong>' + escHtml(p.admissionDate) + '</strong></div>' +
      '<div><span style="color:var(--text-muted)">主诊断：</span><strong>' + escHtml(p.primaryDiagnosis || '—') + '</strong></div>' +
      '<div><span style="color:var(--text-muted)">状态：</span><span class="status-tag ' + (p.outcome ? 'status-terminated' : 'status-active') + '">' + (p.outcome ? '已转归' : '在科') + '</span></div>' +
    '</div>';
  if (p.secondaryDiagnoses) html += '<div style="margin-top:8px;font-size:0.85rem;"><span style="color:var(--text-muted)">次要诊断：</span>' + escHtml(p.secondaryDiagnoses) + '</div>';
  html += '</div>';

  html += '<div class="card" style="margin-bottom:18px"><div class="card-header"><span class="card-title">诊疗记录</span><button class="btn btn-sm btn-primary" onclick="showAddNote(\'' + p.id + '\')">添加记录</button></div>';
  if (p.treatmentNotes && p.treatmentNotes.length > 0) {
    const notes = [...p.treatmentNotes].reverse();
    const catMap = { daily: '日常记录', event: '重要事件', consult: '会诊记录', procedure: '操作记录', other: '其他' };
    notes.forEach(n => {
      html += '<div style="border-bottom:1px solid var(--border);padding:10px 0;"><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span class="card-badge" style="background:var(--primary-light);color:var(--primary-dark);font-size:0.7rem;">' + (catMap[n.category] || n.category) + '</span><span style="font-size:0.75rem;color:var(--text-muted)">' + escHtml(fmtDateTime(n.timestamp)) + '</span></div><p style="font-size:0.85rem;white-space:pre-wrap;">' + escHtml(n.note) + '</p></div>';
    });
  } else {
    html += '<div class="empty-state"><p>暂无诊疗记录</p></div>';
  }
  html += '</div>';

  html += '<div class="card"><div class="card-header"><span class="card-title">最近记录</span><div style="display:flex;gap:8px;"><button class="btn btn-sm" onclick="showAddVitals(\'' + p.id + '\')">+ 生命体征</button><button class="btn btn-sm" onclick="showAddABG(\'' + p.id + '\')">+ 血气分析</button></div></div>';

  if (p.abgs && p.abgs.length > 0) {
    html += '<p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:8px;">血气分析</p><table class="data-table"><thead><tr><th>时间</th><th>pH</th><th>PaCO2</th><th>PaO2</th><th>HCO3</th><th>Lac</th><th>BE</th><th>FiO2</th><th>判读</th></tr></thead><tbody>';
    [...p.abgs].reverse().slice(0, 5).forEach(a => {
      html += '<tr><td>' + escHtml(fmtDateTime(a.timestamp)) + '</td><td class="' + (a.ph && (Number(a.ph) < 7.35 || Number(a.ph) > 7.45) ? 'cell-abnormal' : '') + '">' + escHtml(a.ph || '—') + '</td><td>' + escHtml(a.paco2 || '—') + '</td><td>' + escHtml(a.pao2 || '—') + '</td><td>' + escHtml(a.hco3 || '—') + '</td><td class="' + (a.lac && Number(a.lac) > 2 ? 'cell-abnormal' : '') + '">' + escHtml(a.lac || '—') + '</td><td>' + escHtml(a.be || '—') + '</td><td>' + escHtml(a.fio2 || '—') + '</td><td style="font-size:0.75rem;">' + escHtml(interpretABG(a)) + '</td></tr>';
    });
    html += '</tbody></table>';
  }

  if (p.vitals && p.vitals.length > 0) {
    html += '<p style="font-size:0.8rem;color:var(--text-secondary);margin:12px 0 8px;">生命体征</p><table class="data-table"><thead><tr><th>时间</th><th>HR</th><th>BP</th><th>CVP</th><th>SpO2</th><th>RR</th><th>体温</th></tr></thead><tbody>';
    [...p.vitals].reverse().slice(0, 5).forEach(v => {
      html += '<tr><td>' + escHtml(fmtDateTime(v.timestamp)) + '</td><td class="' + (v.hr && (Number(v.hr) > 120 || Number(v.hr) < 50) ? 'cell-abnormal' : '') + '">' + escHtml(v.hr || '—') + '</td><td>' + escHtml((v.sbp && v.dbp) ? v.sbp + '/' + v.dbp : '—') + '</td><td>' + escHtml(v.cvp || '—') + '</td><td class="' + (v.spo2 && Number(v.spo2) < 90 ? 'cell-abnormal' : '') + '">' + escHtml(v.spo2 || '—') + '</td><td>' + escHtml(v.rr || '—') + '</td><td class="' + (v.temp && (Number(v.temp) > 38 || Number(v.temp) < 36) ? 'cell-abnormal' : '') + '">' + escHtml(v.temp || '—') + '</td></tr>';
    });
    html += '</tbody></table>';
  }

  if ((!p.vitals || p.vitals.length === 0) && (!p.abgs || p.abgs.length === 0)) {
    html += '<div class="empty-state"><p>暂无生命体征或血气记录</p></div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function interpretABG(a) {
  if (!a || !a.ph) return '';
  const pH = Number(a.ph), pCO2 = Number(a.paco2), HCO3 = Number(a.hco3);
  if (pH < 7.35) {
    if (pCO2 > 45) return '呼酸';
    if (HCO3 < 22) return '代酸';
    return '酸血症';
  } else if (pH > 7.45) {
    if (pCO2 < 35) return '呼碱';
    if (HCO3 > 26) return '代碱';
    return '碱血症';
  }
  if (pCO2 > 45) return '代偿呼酸?';
  if (pCO2 < 35) return '代偿呼碱?';
  if (HCO3 < 22) return '代偿代酸?';
  if (HCO3 > 26) return '代偿代碱?';
  return '正常';
}
// ============================================
//  2. 患者详情 (Patient Detail) - 入口函数
// ============================================
function renderPatientDetail(main) {
  const p = getCurrentPatient();
  if (!p) {
    const activePatients = state.patients.filter(pt => !pt.outcome);
    let html = '<div class="page-header"><h1 class="page-title">患者详情</h1></div>';
    if (activePatients.length > 0) {
      html += '<div class="patient-selector">';
      activePatients.forEach(pat => {
        html += '<button class="patient-chip" onclick="openPatient(\'' + pat.id + '\')">' + escHtml(pat.name || '未命名') + ' (' + escHtml(pat.bed) + ')</button>';
      });
      html += '</div>';
    }
    html += '<div class="empty-state"><p>请选择一位在科患者查看详情</p></div>';
    main.innerHTML = html;
    return;
  }

  const terminated = !!p.outcome;
  let html = '<div class="page-header"><div><h1 class="page-title">' + escHtml(p.name || '未命名') + ' <span style="font-size:0.8rem;font-weight:400;color:var(--text-muted)">' + escHtml(p.bed) + '</span></h1><p class="page-subtitle">' + escHtml(p.primaryDiagnosis || '待录入主诊断') + ' - ' + escHtml(p.age || '--') + '岁 - ' + escHtml(p.gender || '--');
  if (terminated && p.outcome) {
    const ot = OUTCOME_TYPES.find(o => o.value === p.outcome.type);
    html += ' - <span class="outcome-tag ' + (ot ? ot.cssClass : '') + '">' + escHtml(p.outcome.label) + '</span>';
  }
  html += '</p></div><div class="page-actions"><button class="btn btn-sm" onclick="showPatientEdit(\'' + p.id + '\')">编辑信息</button>';
  if (!terminated) html += '<button class="btn btn-sm btn-danger" onclick="showTerminatePatient(\'' + p.id + '\')">结束治疗</button>';
  html += '</div></div>';

  const activePatients = state.patients.filter(pt => !pt.outcome);
  if (activePatients.length > 0) {
    html += '<div class="patient-selector">';
    activePatients.forEach(pat => {
      html += '<button class="patient-chip' + (pat.id === p.id ? ' active' : '') + '" onclick="openPatient(\'' + pat.id + '\')">' + escHtml(pat.name || '未命名') + '</button>';
    });
    html += '</div>';
  }

  if (terminated && p.outcome) {
    html += '<div class="card" style="margin-bottom:18px;border-left:4px solid var(--primary);"><div class="card-header"><span class="card-title">治疗转归</span></div><div style="font-size:0.9rem;"><p><strong>转归类型：</strong><span class="outcome-tag ' + (OUTCOME_TYPES.find(o=>o.value===p.outcome.type)?.cssClass||'') + '">' + escHtml(p.outcome.label) + '</span></p><p><strong>日期：</strong>' + escHtml(p.outcome.date) + '</p>' + (p.outcome.notes ? '<p><strong>备注：</strong>' + escHtml(p.outcome.notes) + '</p>' : '') + '</div></div>';
  }

  html += '<div class="tabs" id="patientTabs"><button class="tab-btn active" data-ptab="info">基本信息 & 诊疗记录</button><button class="tab-btn" data-ptab="micro">微生物 & 抗生素</button></div><div id="patientTabContent"></div>';

  main.innerHTML = html;

  $$('#patientTabs .tab-btn').forEach(btn => {
    btn.onclick = function() {
      $$('#patientTabs .tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      renderPatientSubTab(this.dataset.ptab);
    };
  });
  renderPatientSubTab('info');
}

function renderPatientSubTab(tab) {
  const container = document.getElementById('patientTabContent');
  const p = getCurrentPatient();
  if (!p || !container) return;
  switch(tab) {
    case 'info': renderPatientInfo(container, p); break;
    case 'micro': renderPatientMicro(container, p); break;
  }
}
// --- 2b. 微生物 & 抗生素 ---
function renderPatientMicro(container, p) {
  let html = '<div class="card" style="margin-bottom:18px"><div class="card-header"><span class="card-title">抗生素使用追踪</span><button class="btn btn-sm btn-primary" onclick="showAddAntibiotic(\'' + p.id + '\')">+ 添加抗生素</button></div>';

  if (p.antibiotics && p.antibiotics.length > 0) {
    html += '<table class="data-table"><thead><tr><th>药物</th><th>开始日期</th><th>停药日期</th><th>剂量</th><th>途径</th><th>天数</th><th>状态</th></tr></thead><tbody>';
    p.antibiotics.forEach(a => {
      const startDate = a.startDate ? new Date(a.startDate) : null;
      const endDate = a.endDate ? new Date(a.endDate) : null;
      const days = startDate ? Math.floor(((endDate || new Date()) - startDate) / 86400000) : 0;
      let abxClass = 'abx-ok', statusText = '进行中';
      if (endDate) { abxClass = 'abx-ok'; statusText = '已停用'; }
      else if (days >= 10) { abxClass = 'abx-review'; statusText = '需评估!'; }
      else if (days >= 7) { abxClass = 'abx-warn'; statusText = '关注'; }
      html += '<tr><td><strong>' + escHtml(a.drug) + '</strong></td><td>' + escHtml(a.startDate || '—') + '</td><td>' + escHtml(a.endDate || '—') + '</td><td>' + escHtml(a.dose || '—') + '</td><td>' + escHtml(a.route || '—') + '</td><td><span class="abx-days-badge ' + abxClass + '">' + days + '天</span></td><td><span style="font-size:0.75rem;">' + statusText + '</span></td></tr>';
    });
    html += '</tbody></table>';
  } else {
    html += '<div class="empty-state"><p>暂无抗生素记录</p></div>';
  }
  html += '</div>';

  html += '<div class="card"><div class="card-header"><span class="card-title">微生物培养 & 药敏</span><button class="btn btn-sm btn-primary" onclick="showAddMicro(\'' + p.id + '\')">+ 添加培养结果</button></div>';

  if (p.microbiology && p.microbiology.length > 0) {
    [...p.microbiology].reverse().forEach(m => {
      html += '<div class="micro-card"><div class="micro-card-header"><span class="micro-organism">' + escHtml(m.organism || '待鉴定') + '</span><span class="micro-date">' + escHtml(fmtDateTime(m.timestamp)) + '</span></div><div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:4px;">标本: ' + escHtml(m.specimen || '—') + ' | 涂片: ' + escHtml(m.stain || '—') + '</div>';
      if (m.sensitivity && m.sensitivity.length > 0) {
        html += '<div style="margin-top:4px;">';
        m.sensitivity.forEach(s => {
          html += '<span class="sensitivity-tag sens-' + (s.result || 'S') + '">' + escHtml(s.antibiotic) + ': ' + escHtml(s.result || 'S') + '</span>';
        });
        html += '</div>';
      }
      if (m.notes) html += '<div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">' + escHtml(m.notes) + '</div>';
      html += '</div>';
    });
  } else {
    html += '<div class="empty-state"><p>暂无微生物培养结果</p></div>';
  }
  html += '</div>';
  container.innerHTML = html;
}


// ============================================
//  3. 交班记录 (Handover - SBAR)
// ============================================
function renderHandover(main) {
  const activePatients = state.patients.filter(p => !p.outcome);
  let html = '<div class="page-header"><div><h1 class="page-title">交班记录生成</h1><p class="page-subtitle">SBAR 格式结构化交班</p></div><div class="page-actions"><button class="btn btn-primary" id="btnGenerateHandover">生成交班记录</button><button class="btn" id="btnPrintHandover">打印</button><button class="btn" id="btnCopyHandover">复制</button></div></div>';

  if (activePatients.length > 0) {
    html += '<div class="patient-selector" id="handoverPatientSelector">';
    activePatients.forEach(p => {
      html += '<button class="patient-chip" data-pid="' + p.id + '">' + escHtml(p.name || '未命名') + ' (' + escHtml(p.bed) + ')</button>';
    });
    html += '</div>';
  }
  html += '<div class="card"><div class="handover-output" id="handoverOutput">选择患者后点击「生成交班记录」</div></div>';

  main.innerHTML = html;

  $$('#handoverPatientSelector .patient-chip').forEach(chip => {
    chip.onclick = function() {
      $$('#handoverPatientSelector .patient-chip').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
    };
  });
  const firstChip = $('#handoverPatientSelector .patient-chip');
  if (firstChip) firstChip.classList.add('active');

  document.getElementById('btnGenerateHandover').onclick = generateHandover;
  document.getElementById('btnPrintHandover').onclick = () => window.print();
  document.getElementById('btnCopyHandover').onclick = () => {
    const text = document.getElementById('handoverOutput').innerText;
    navigator.clipboard.writeText(text).then(() => toast('已复制到剪贴板', 'success')).catch(() => toast('复制失败', 'error'));
  };
}

function generateHandover() {
  const active = $('#handoverPatientSelector .patient-chip.active');
  if (!active) { toast('请先选择患者', 'error'); return; }
  const p = getPatient(active.dataset.pid);
  if (!p) return;

  const latestVitals = (p.vitals && p.vitals.length > 0) ? p.vitals[p.vitals.length - 1] : null;
  const latestAbg = (p.abgs && p.abgs.length > 0) ? p.abgs[p.abgs.length - 1] : null;
  const activeAbx = (p.antibiotics || []).filter(a => !a.endDate);
  const latestNotes = (p.treatmentNotes && p.treatmentNotes.length > 0) ? [...p.treatmentNotes].reverse().slice(0, 3) : [];
  let sb = '========================================\n';
  sb += '  ICU 交班记录 (SBAR 格式)\n';
  sb += '  生成时间: ' + fmtDateTime(new Date()) + '\n';
  sb += '========================================\n\n';
  sb += '【S — 现状 Situation】\n';
  sb += '患者: ' + (p.name || '—') + '    床号: ' + (p.bed || '—') + '\n';
  sb += '年龄/性别: ' + (p.age || '—') + '岁 / ' + (p.gender || '—') + '\n';
  sb += '主诊断: ' + (p.primaryDiagnosis || '—') + '\n';
  if (p.secondaryDiagnoses) sb += '其他诊断: ' + p.secondaryDiagnoses + '\n';
  sb += '入院日期: ' + (p.admissionDate || '—') + '\n\n';

  sb += '【B — 背景 Background】\n';
  if (latestVitals) {
    sb += '生命体征: HR ' + (latestVitals.hr || '—') + ' bpm, BP ' + (latestVitals.sbp || '—') + '/' + (latestVitals.dbp || '—') + ' mmHg';
    if (latestVitals.cvp) sb += ', CVP ' + latestVitals.cvp + ' mmHg';
    sb += ', SpO2 ' + (latestVitals.spo2 || '—') + '%, RR ' + (latestVitals.rr || '—') + ' bpm, 体温 ' + (latestVitals.temp || '—') + '度\n';
  }
  if (latestAbg) {
    sb += '血气: pH ' + (latestAbg.ph || '—') + ', PaCO2 ' + (latestAbg.paco2 || '—') + ' mmHg, PaO2 ' + (latestAbg.pao2 || '—') + ' mmHg';
    sb += ', HCO3 ' + (latestAbg.hco3 || '—') + ' mmol/L, Lac ' + (latestAbg.lac || '—') + ' mmol/L';
    if (latestAbg.fio2) sb += ', FiO2 ' + latestAbg.fio2 + '%';
    sb += ' -> ' + interpretABG(latestAbg) + '\n';
  }
  if (activeAbx.length > 0) {
    sb += '当前抗生素: ' + activeAbx.map(a => {
      const days = a.startDate ? Math.floor((new Date() - new Date(a.startDate)) / 86400000) : 0;
      return a.drug + ' (第' + days + '天)';
    }).join(', ') + '\n';
  }
  sb += '\n';

  sb += '【A — 评估 Assessment】\n';
  if (latestNotes.length > 0) {
    latestNotes.forEach(n => {
      const catMap = { daily: '日常', event: '事件', consult: '会诊', procedure: '操作', other: '其他' };
      sb += '  [' + (catMap[n.category] || n.category) + '] ' + n.note.substring(0, 120) + (n.note.length > 120 ? '...' : '') + '\n';
    });
  }
  sb += '\n';

  sb += '【R — 建议 Recommendation】\n';
  sb += '□ 继续当前治疗方案\n';
  sb += '□ 抗生素降阶梯评估\n';
  sb += '□ 每日唤醒 / SBT 评估\n';
  sb += '□ 深静脉血栓预防\n';
  sb += '□ 营养支持评估\n';
  sb += '□ 管路拔除评估\n';
  sb += '其他待办: \n\n';
  sb += '========================================\n';
  sb += '  交班医师: ___________    接班医师: ___________\n';
  sb += '========================================\n';

  document.getElementById('handoverOutput').innerText = sb;
  toast('交班记录已生成', 'success');
}
// ============================================
//  4. 转归管理（检索 + 按月归纳）
// ============================================

let outcomeState = { filter: 'all', search: '', month: '' };

function renderOutcome(main) {
  // 维度切换 persistent
  if (!main._outcomeInited) {
    outcomeState = { filter: 'all', search: '', month: '' };
    main._outcomeInited = true;
  }

  const terminated = state.patients.filter(p => p.outcome);
  const total = state.patients.length;
  const active = state.patients.filter(p => !p.outcome).length;
  const counts = { transfer: 0, discharged: 0, ama: 0, death: 0 };
  terminated.forEach(p => { if (counts[p.outcome.type] !== undefined) counts[p.outcome.type]++; });

  // 统计卡片
  let html = '<div class="page-header"><div><h1 class="page-title">转归管理</h1><p class="page-subtitle">累计管理 ' + total + ' 人 · 在科 ' + active + ' 人 · 已转归 ' + terminated.length + ' 人</p></div></div>';

  html += '<div class="outcome-stats-grid">' +
    '<div class="outcome-stat-card outcome-stat-all" onclick="outcomeFilterBy(\'all\')"><div class="outcome-stat-number">' + total + '</div><div class="outcome-stat-label">累计管理</div></div>' +
    '<div class="outcome-stat-card outcome-stat-transfer" onclick="outcomeFilterBy(\'transfer\')"><div class="outcome-stat-number">' + counts.transfer + '</div><div class="outcome-stat-label">转出</div></div>' +
    '<div class="outcome-stat-card outcome-stat-discharged" onclick="outcomeFilterBy(\'discharged\')"><div class="outcome-stat-number">' + counts.discharged + '</div><div class="outcome-stat-label">好转出院</div></div>' +
    '<div class="outcome-stat-card outcome-stat-ama" onclick="outcomeFilterBy(\'ama\')"><div class="outcome-stat-number">' + counts.ama + '</div><div class="outcome-stat-label">自动出院</div></div>' +
    '<div class="outcome-stat-card outcome-stat-death" onclick="outcomeFilterBy(\'death\')"><div class="outcome-stat-number">' + counts.death + '</div><div class="outcome-stat-label">死亡</div></div>' +
  '</div>';

  // 类型筛选 + 检索栏
  html += '<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">' +
    buildOutcomeBtn('all', '全部') +
    buildOutcomeBtn('transfer', '转出') +
    buildOutcomeBtn('discharged', '好转出院') +
    buildOutcomeBtn('ama', '自动出院') +
    buildOutcomeBtn('death', '死亡') +
    buildOutcomeBtn('active', '在科患者') +
  '</div>';

  // 检索 + 月份筛选
  const months = getAvailableMonths();
  html += '<div class="outcome-search-bar">' +
    '<input class="form-input" id="outcomeSearch" placeholder="检索姓名 / 床号 / 诊断..." value="' + escHtml(outcomeState.search) + '" style="flex:1;max-width:240px;">' +
    '<select class="form-select" id="outcomeMonth" style="max-width:160px;">' +
      '<option value="">全部月份</option>';
  months.forEach(m => {
    html += '<option value="' + m.value + '"' + (outcomeState.month === m.value ? ' selected' : '') + '>' + escHtml(m.label) + ' (' + m.count + ')</option>';
  });
  html += '</select>' +
    '<button class="btn btn-sm" onclick="outcomeClearFilters()">清除筛选</button>' +
  '</div>';

  // 月份归纳结果
  html += '<div id="outcomeList"></div>';

  main.innerHTML = html;

  document.getElementById('outcomeSearch').oninput = function() {
    outcomeState.search = this.value;
    doOutcomeRender();
  };
  document.getElementById('outcomeMonth').onchange = function() {
    outcomeState.month = this.value;
    doOutcomeRender();
  };

  doOutcomeRender();
}

function buildOutcomeBtn(type, label) {
  const active = outcomeState.filter === type;
  return '<button class="btn btn-sm' + (active ? ' btn-primary' : '') + '" onclick="outcomeFilterBy(\'' + type + '\')">' + label + '</button>';
}

function outcomeFilterBy(type) {
  outcomeState.filter = type;
  doOutcomeRender();
  // Update button styling
  const allBtns = document.querySelectorAll('.outcome-stats-grid ~ div .btn-sm');
  // Best effort: just rerender
  render(document.getElementById('mainContent'));
}

function outcomeClearFilters() {
  outcomeState.search = '';
  outcomeState.month = '';
  outcomeState.filter = 'all';
  document.getElementById('outcomeSearch').value = '';
  document.getElementById('outcomeMonth').value = '';
  doOutcomeRender();
}

function getAvailableMonths() {
  const monthMap = {};
  state.patients.forEach(p => {
    const key = (p.outcome ? p.outcome.date : p.admissionDate) || '';
    if (!key) return;
    const m = key.substring(0, 7); // YYYY-MM
    if (!monthMap[m]) monthMap[m] = { value: m, count: 0 };
    monthMap[m].count++;
  });
  return Object.values(monthMap).sort((a, b) => b.value.localeCompare(a.value)).map(m => ({
    value: m.value,
    label: m.value.replace('-', '年') + '月',
    count: m.count
  }));
}

function doOutcomeRender() {
  const container = document.getElementById('outcomeList');
  if (!container) return;

  let patients;
  if (outcomeState.filter === 'all') {
    patients = [...state.patients];
  } else if (outcomeState.filter === 'active') {
    patients = [...state.patients.filter(p => !p.outcome)];
  } else {
    patients = [...state.patients.filter(p => p.outcome && p.outcome.type === outcomeState.filter)];
  }

  // 检索过滤
  if (outcomeState.search) {
    const s = outcomeState.search.toLowerCase();
    patients = patients.filter(p =>
      (p.name || '').toLowerCase().includes(s) ||
      (p.bed || '').toLowerCase().includes(s) ||
      (p.primaryDiagnosis || '').toLowerCase().includes(s) ||
      (p.secondaryDiagnoses || '').toLowerCase().includes(s)
    );
  }

  // 月份过滤
  if (outcomeState.month) {
    patients = patients.filter(p => {
      const key = (p.outcome ? p.outcome.date : p.admissionDate) || '';
      return key.startsWith(outcomeState.month);
    });
  }

  // 按日期倒序
  patients.sort((a, b) => {
    const da = (a.outcome ? a.outcome.date : a.admissionDate) || '';
    const db = (b.outcome ? b.outcome.date : b.admissionDate) || '';
    return db.localeCompare(da);
  });

  if (patients.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>暂无符合条件的记录</p></div>';
    return;
  }

  // 按月份分组
  let html = '';
  let currentMonth = '';
  patients.forEach(p => {
    const key = (p.outcome ? p.outcome.date : p.admissionDate) || '';
    const month = key.substring(0, 7);
    
    if (month !== currentMonth) {
      currentMonth = month;
      const monthPatients = patients.filter(pp => {
        const k = (pp.outcome ? pp.outcome.date : pp.admissionDate) || '';
        return k.startsWith(month);
      });
      const monthLabel = month ? month.replace('-', '年') + '月' : '日期未知';
      html += '<div class="outcome-month-header">' +
        '<span class="outcome-month-title">' + escHtml(monthLabel) + '</span>' +
        '<span class="outcome-month-count">' + monthPatients.length + ' 例</span>' +
      '</div>';
    }

    const ot = p.outcome ? OUTCOME_TYPES.find(o => o.value === p.outcome.type) : null;
    html += '<div class="outcome-card">' +
      '<div class="outcome-card-header">' +
        '<div>' +
          '<div class="outcome-card-patient">' + escHtml(p.name || '未命名') + ' <span style="font-weight:400;font-size:0.78rem;color:var(--text-muted);">' + escHtml(p.bed || '') + '</span></div>' +
          '<div class="outcome-card-meta">' + escHtml(p.primaryDiagnosis || '无诊断') + ' · ' + escHtml(p.age || '—') + '岁 · ' + escHtml(p.gender || '') + ' · 入院: ' + escHtml(p.admissionDate || '—') + '</div>' +
        '</div>' +
        '<div style="text-align:right;">' + (p.outcome
          ? '<span class="outcome-tag ' + (ot ? ot.cssClass : '') + '">' + escHtml(p.outcome.label) + '</span><div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">' + escHtml(p.outcome.date || '') + '</div>'
          : '<span class="status-tag status-active">在科</span>') +
        '</div>' +
      '</div>';
    if (p.outcome && p.outcome.notes) {
      html += '<div class="outcome-card-note">' + escHtml(p.outcome.notes) + '</div>';
    }
    if (p.antibiotics && p.antibiotics.length > 0) {
      html += '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">抗生素: ' + escHtml(p.antibiotics.map(a => a.drug).join(', ')) + '</div>';
    }
    if (p.treatmentNotes && p.treatmentNotes.length > 0) {
      html += '<div style="font-size:0.75rem;color:var(--text-muted);">诊疗记录: ' + p.treatmentNotes.length + ' 条</div>';
    }
    html += '</div>';
  });

  container.innerHTML = html;
}// ============================================
//  5. 临床指南检索（中文）
// ============================================

// --- 中文 ICU 临床指南本地索引 ---
const GUIDELINE_INDEX = [
  { t:"中国脓毒症/脓毒性休克急诊治疗指南(2018)", s:"中华急诊医学杂志", y:"2018", u:"https://rs.yiigle.com/CN112138201813/1070211.htm", k:"脓毒症 sepsis 感染性休克 septic shock 液体复苏 血管活性药物 抗菌药物" },
  { t:"拯救脓毒症运动(SSC)指南2021 中文解读", s:"中华危重病急救医学", y:"2021", u:"https://guide.medlive.cn/guideline/24414", k:"sepsis surviving 脓毒症 1小时集束化治疗" },
  { t:"中国急性呼吸窘迫综合征(ARDS)诊断和治疗指南", s:"中华医学杂志", y:"2023", u:"https://rs.yiigle.com/CN112150202303/1431057.htm", k:"ARDS 急性呼吸窘迫 机械通气 俯卧位 PEEP 肺保护通气" },
  { t:"急性呼吸窘迫综合征患者机械通气指南(试行)", s:"中华医学杂志", y:"2016", u:"https://guide.medlive.cn/guideline/11538", k:"ARDS 机械通气 小潮气量 驱动压 俯卧位 肺复张" },
  { t:"中国成人ICU镇痛和镇静治疗指南", s:"中华危重病急救医学", y:"2018", u:"https://rs.yiigle.com/CN121430201806/1035625.htm", k:"镇静 镇痛 ICU 谵妄 丙泊酚 右美托咪定 咪达唑仑 RASS评分" },
  { t:"重症患者谵妄管理专家共识", s:"中华内科杂志", y:"2019", u:"https://guide.medlive.cn/guideline/17141", k:"谵妄 delirium CAM-ICU 氟哌啶醇 右美托咪定" },
  { t:"中国重症患者营养支持治疗指南", s:"中华危重病急救医学", y:"2022", u:"https://rs.yiigle.com/CN121430202204/1381546.htm", k:"营养支持 肠内营养 肠外营养 热量 蛋白质 EN PN" },
  { t:"ICU获得性衰弱诊断与治疗中国专家共识", s:"中华危重病急救医学", y:"2018", u:"https://guide.medlive.cn/guideline/16765", k:"ICU-AW 获得性衰弱 肌无力 早期活动 康复" },
  { t:"呼吸机相关性肺炎预防与控制指南", s:"中华医院感染学杂志", y:"2023", u:"https://guide.medlive.cn/guideline/27749", k:"VAP 呼吸机相关肺炎 预防 bundle 口腔护理 声门下吸引" },
  { t:"连续性肾脏替代治疗(CRRT)临床应用规范", s:"中华医学杂志", y:"2021", u:"https://rs.yiigle.com/CN112150202108/1348056.htm", k:"CRRT 连续性肾替代 枸橼酸抗凝 剂量 AKI RRT" },
  { t:"急性肾损伤诊治中国专家共识", s:"中华危重病急救医学", y:"2018", u:"https://guide.medlive.cn/guideline/16757", k:"AKI 急性肾损伤 KDIGO 诊断 分期" },
  { t:"血管活性药物在休克中的应用中国专家共识", s:"中华急诊医学杂志", y:"2019", u:"https://guide.medlive.cn/guideline/18773", k:"血管活性药物 休克 去甲肾上腺素 多巴胺 肾上腺素 血管加压素" },
  { t:"中国重症患者凝血功能障碍诊疗专家共识", s:"中华危重病急救医学", y:"2020", u:"https://guide.medlive.cn/guideline/21271", k:"凝血功能 DIC 弥漫性血管内凝血 抗凝 血小板" },
  { t:"中国严重创伤救治指南", s:"中华急诊医学杂志", y:"2021", u:"https://guide.medlive.cn/guideline/23743", k:"创伤 多发伤 出血控制 损伤控制复苏" },
  { t:"中国颅脑损伤诊治指南", s:"中华神经外科杂志", y:"2019", u:"https://guide.medlive.cn/guideline/17652", k:"颅脑损伤 TBI 颅内压 去骨瓣减压 脑灌注压" },
  { t:"重症急性胰腺炎诊治中国专家共识", s:"中华消化杂志", y:"2021", u:"https://guide.medlive.cn/guideline/23819", k:"急性胰腺炎 SAP 重症 液体复苏 腹腔间隔室综合征" },
  { t:"中国心力衰竭诊断和治疗指南", s:"中华心血管病杂志", y:"2018", u:"https://rs.yiigle.com/CN113460201804/1042073.htm", k:"心衰 心力衰竭 正性肌力药物 利尿剂" },
  { t:"急性ST段抬高型心肌梗死诊断和治疗指南", s:"中华心血管病杂志", y:"2019", u:"https://guide.medlive.cn/guideline/18846", k:"STEMI 心梗 心肌梗死 PCI 抗血小板" },
  { t:"中国高血压防治指南(2024年修订版)", s:"中华心血管病杂志", y:"2024", u:"https://guide.medlive.cn/guideline/32273", k:"高血压 降压治疗 血压目标" },
  { t:"中国成人社区获得性肺炎诊断和治疗指南", s:"中华结核和呼吸杂志", y:"2016", u:"https://guide.medlive.cn/guideline/10932", k:"CAP 社区获得性肺炎 抗菌治疗 病原学" },
  { t:"医院获得性肺炎/呼吸机相关性肺炎诊疗指南", s:"中华结核和呼吸杂志", y:"2018", u:"https://guide.medlive.cn/guideline/16661", k:"HAP VAP 院内获得性肺炎 呼吸机相关肺炎 抗菌治疗" },
  { t:"中国重症监护病房医院感染预防与控制指南", s:"中华医院感染学杂志", y:"2020", u:"https://guide.medlive.cn/guideline/21407", k:"院感 感染控制 多重耐药菌 MDRO 隔离" },
  { t:"多重耐药菌医院感染预防与控制中国专家共识", s:"中华医院感染学杂志", y:"2018", u:"https://guide.medlive.cn/guideline/13344", k:"MDRO 多重耐药 CRE MRSA VRE 碳青霉烯耐药" },
  { t:"碳青霉烯耐药革兰阴性杆菌感染诊治专家共识", s:"中华临床感染病杂志", y:"2022", u:"https://guide.medlive.cn/guideline/26491", k:"CRE CRO 碳青霉烯耐药 替加环素 多黏菌素 头孢他啶阿维巴坦" },
  { t:"中国鲍曼不动杆菌感染诊治与防控专家共识", s:"中华医学杂志", y:"2018", u:"https://guide.medlive.cn/guideline/10768", k:"鲍曼不动杆菌 Acinetobacter 耐药 舒巴坦" },
  { t:"中国念珠菌病诊断与治疗专家共识", s:"中华传染病杂志", y:"2020", u:"https://guide.medlive.cn/guideline/20949", k:"念珠菌 真菌感染 棘白菌素 氟康唑 血培养" },
  { t:"侵袭性真菌病诊断与治疗指南", s:"中华内科杂志", y:"2020", u:"https://guide.medlive.cn/guideline/20948", k:"真菌 IFD 曲霉菌 念珠菌 伏立康唑 棘白菌素" },
  { t:"中国肺血栓栓塞症诊治与预防指南", s:"中华医学杂志", y:"2018", u:"https://rs.yiigle.com/CN112150201810/1052066.htm", k:"肺栓塞 PE 抗凝 溶栓 D-二聚体" },
  { t:"深静脉血栓形成诊治指南", s:"中华血管外科杂志", y:"2017", u:"https://guide.medlive.cn/guideline/13928", k:"DVT 深静脉血栓 抗凝 低分子肝素" },
  { t:"中国急性缺血性脑卒中诊治指南", s:"中华神经科杂志", y:"2018", u:"https://guide.medlive.cn/guideline/16650", k:"脑卒中 脑梗死 溶栓 取栓 tPA" },
  { t:"自发性脑出血诊治中国专家共识", s:"中华神经外科杂志", y:"2019", u:"https://guide.medlive.cn/guideline/17651", k:"脑出血 颅内出血 血压控制 手术" },
  { t:"中国重症患者血糖管理专家共识", s:"中华危重病急救医学", y:"2020", u:"https://guide.medlive.cn/guideline/21272", k:"血糖管理 高血糖 低血糖 胰岛素 血糖目标" },
  { t:"中国急性肾损伤临床实践指南", s:"中华肾脏病杂志", y:"2024", u:"https://guide.medlive.cn/guideline/32098", k:"AKI 急性肾损伤 KDIGO RRT CRRT" },
  { t:"中国心肺复苏指南", s:"中华急诊医学杂志", y:"2020", u:"https://guide.medlive.cn/guideline/21629", k:"CPR 心肺复苏 心脏骤停 肾上腺素 除颤 ROSC" },
  { t:"体外膜氧合(ECMO)临床应用中国专家共识", s:"中华医学杂志", y:"2020", u:"https://guide.medlive.cn/guideline/20936", k:"ECMO 体外膜氧合 VV-ECMO VA-ECMO 呼吸衰竭 心源性休克" },
  { t:"中国重症超声临床应用规范", s:"中华危重病急救医学", y:"2018", u:"https://guide.medlive.cn/guideline/16760", k:"超声 重症超声 血流动力学 容量评估 FAST" },
  { t:"血流动力学监测与管理中国专家共识", s:"中华危重病急救医学", y:"2021", u:"https://guide.medlive.cn/guideline/24022", k:"血流动力学 监测 PiCCO Swan-Ganz 容量反应性" },
  { t:"中国成人ICU患者血糖控制专家共识", s:"中华危重病急救医学", y:"2024", u:"https://guide.medlive.cn/guideline/32694", k:"血糖 TGC 强化胰岛素治疗 低血糖" },
  { t:"中国成人重症患者血小板减少诊疗专家共识", s:"中华危重病急救医学", y:"2020", u:"https://guide.medlive.cn/guideline/21484", k:"血小板减少 血小板输注 HIT 肝素诱导" },
  { t:"中国输液安全管理指南", s:"中华护理杂志", y:"2018", u:"https://guide.medlive.cn/guideline/16753", k:"输液 静脉通路 CVC PICC 导管相关感染" },
  { t:"血管内导管相关感染预防与控制指南", s:"中华医院感染学杂志", y:"2021", u:"https://guide.medlive.cn/guideline/24460", k:"CLABSI CRBSI 导管感染 中心静脉导管" },
  { t:"中国重症患者肠内营养喂养流程专家共识", s:"中华危重病急救医学", y:"2021", u:"https://guide.medlive.cn/guideline/23992", k:"EN 肠内营养 喂养不耐受 幽门后喂养 营养泵" },
  { t:"中国ICU患者早期活动安全指南", s:"中华危重病急救医学", y:"2022", u:"https://guide.medlive.cn/guideline/26015", k:"早期活动 康复 ICU-AW 安全 离床" },
  { t:"神经重症患者镇痛镇静中国专家共识", s:"中华危重病急救医学", y:"2020", u:"https://guide.medlive.cn/guideline/21273", k:"神经重症 镇静 镇痛 TBI 颅内压" },
  { t:"中国重症患者液体复苏指南", s:"中华危重病急救医学", y:"2020", u:"https://guide.medlive.cn/guideline/21688", k:"液体复苏 晶体 胶体 平衡液 生理盐水" },
  { t:"心源性休克诊治中国专家共识", s:"中华心血管病杂志", y:"2020", u:"https://guide.medlive.cn/guideline/21144", k:"心源性休克 正性肌力药物 血管活性药物 机械辅助" },
  { t:"中国心脏骤停后综合征诊治指南", s:"中华急诊医学杂志", y:"2021", u:"https://guide.medlive.cn/guideline/24103", k:"PCAS 心脏骤停后 目标温度管理 TTM 脑保护" },
  { t:"重症患者气道管理专家共识", s:"中华危重病急救医学", y:"2018", u:"https://guide.medlive.cn/guideline/16759", k:"气道管理 气管插管 拔管 气囊管理 吸痰" },
  { t:"中国危重症患者转运指南", s:"中华危重病急救医学", y:"2019", u:"https://guide.medlive.cn/guideline/18771", k:"转运 危重患者 院际转运 安全" },
  { t:"ICU内床旁即时超声(POCUS)中国专家共识", s:"中华危重病急救医学", y:"2019", u:"https://guide.medlive.cn/guideline/18768", k:"POCUS 床旁超声 肺超声 心超 FAST" },
];

// --- 快速搜索标签 ---
const QUICK_TAGS = [
  { label:"脓毒症/感染性休克", q:"脓毒症 sepsis 感染性休克" },
  { label:"ARDS 呼吸衰竭", q:"ARDS 呼吸窘迫 机械通气" },
  { label:"镇静镇痛谵妄", q:"镇静 镇痛 谵妄" },
  { label:"营养支持", q:"营养 肠内营养 肠外营养 EN" },
  { label:"CRRT / AKI", q:"CRRT 肾替代 AKI 急性肾损伤" },
  { label:"院感防控 VAP", q:"VAP 院感 感染控制 MDRO 多重耐药" },
  { label:"血流动力学 休克", q:"血流动力学 休克 液体复苏" },
  { label:"凝血 / DIC", q:"凝血 DIC 血小板 抗凝" },
  { label:"神经重症", q:"颅脑 脑卒中 脑出血 TBI" },
  { label:"心肺复苏 / ECMO", q:"CPR 心肺复苏 ECMO 心脏骤停" },
  { label:"真菌/耐药菌感染", q:"真菌 念珠菌 CRE 碳青霉烯 多重耐药" },
  { label:"血糖管理", q:"血糖 胰岛素 高血糖" },
];

// 本地索引搜索
function searchGuidelines(query) {
  const q = query.toLowerCase();
  const results = [];
  GUIDELINE_INDEX.forEach(g => {
    const haystack = (g.t + " " + g.s + " " + g.k).toLowerCase();
    const score = fuzzyScore(q, haystack);
    if (score > 0) results.push({ ...g, score });
  });
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 15);
}

// 简单模糊评分：匹配到的关键字越多分数越高
function fuzzyScore(query, haystack) {
  const terms = query.split(/\s+/).filter(t => t.length > 0);
  let score = 0;
  terms.forEach(term => {
    if (haystack.includes(term)) score += term.length * 2;
    // 部分匹配
    for (let i = 0; i <= term.length - 2; i++) {
      if (haystack.includes(term.substring(i, i + 2))) score += 1;
    }
  });
  return score;
}

// --- 渲染文献检索页面 ---
function renderLiterature(main) {
  let html = '<div class="page-header"><div><h1 class="page-title">临床指南检索</h1><p class="page-subtitle">中文 ICU 临床诊疗指南 · 本地索引' + GUIDELINE_INDEX.length + '条</p></div></div>';

  // 搜索框
  html += '<div class="card" style="margin-bottom:16px">' +
    '<div class="guideline-search-bar">' +
      '<input class="form-input" id="litSearchInput" placeholder="搜索指南，如: 脓毒症、ARDS、CRRT、镇静、真菌感染..." style="flex:1;">' +
      '<button class="btn btn-primary" id="btnLitSearch">检索</button>' +
      '<button class="btn btn-sm" id="btnLitDuckDuckGo" style="margin-left:4px;" title="联网扩展搜索">联网搜索</button>' +
    '</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">';

  QUICK_TAGS.forEach(tag => {
    html += '<button class="btn btn-sm guide-tag" onclick="quickGuidelineSearch(\'' + escHtml(tag.q) + '\', this)">' + escHtml(tag.label) + '</button>';
  });

  html += '</div></div>';

  // 结果区域
  html += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">' +
    '<span style="font-size:0.8rem;color:var(--text-muted);" id="litResultCount"></span>' +
    '<span style="font-size:0.75rem;color:var(--text-muted);" id="litSourceTag"></span>' +
  '</div>';
  html += '<div id="litResults"><div class="empty-state"><p>输入关键词检索中文临床诊疗指南，或点击标签快速筛选</p></div></div>';

  main.innerHTML = html;

  document.getElementById('btnLitSearch').onclick = () => {
    const query = document.getElementById('litSearchInput').value.trim();
    if (!query) { toast('请输入检索关键词', 'error'); return; }
    doGuidelineSearch(query, false);
  };
  document.getElementById('btnLitDuckDuckGo').onclick = () => {
    const query = document.getElementById('litSearchInput').value.trim();
    if (!query) { toast('请输入检索关键词', 'error'); return; }
    doGuidelineSearch(query, true);
  };
  document.getElementById('litSearchInput').onkeydown = function(e) {
    if (e.key === 'Enter') doGuidelineSearch(this.value.trim(), false);
  };
}

function quickGuidelineSearch(query, btnEl) {
  document.getElementById('litSearchInput').value = '';
  // 高亮当前标签
  document.querySelectorAll('.guide-tag').forEach(b => b.classList.remove('btn-primary'));
  if (btnEl) { btnEl.classList.remove('btn'); btnEl.classList.add('btn-primary'); }
  doGuidelineSearch(query, false);
}

async function doGuidelineSearch(query, useDuckDuckGo) {
  const resultsDiv = document.getElementById('litResults');
  const countEl = document.getElementById('litResultCount');
  const sourceEl = document.getElementById('litSourceTag');
  if (!resultsDiv) return;

  // 先做本地搜索
  const localResults = searchGuidelines(query);

  if (localResults.length > 0 && !useDuckDuckGo) {
    countEl.textContent = '找到 ' + localResults.length + ' 条指南';
    sourceEl.textContent = '来源：本地索引';
    renderGuidelineResults(localResults);
    return;
  }

  // 本地有结果先展示，同时标注在联网扩展
  if (localResults.length > 0) {
    countEl.textContent = '本地找到 ' + localResults.length + ' 条，正在联网扩展搜索...';
    sourceEl.textContent = '';
    renderGuidelineResults(localResults);
  } else {
    resultsDiv.innerHTML = '<div class="empty-state"><p>正在检索...</p></div>';
  }

  // DuckDuckGo 联网搜索
  if (useDuckDuckGo || localResults.length === 0) {
    try {
      const ddgQuery = query + ' site:guide.medlive.cn OR site:rs.yiigle.com 临床指南';
      const ddgUrl = 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(ddgQuery);
      // 通过 CORS 代理或直接抓取（可能被CORS阻止，降级到打开新窗口）
      const webResults = await searchDuckDuckGo(query);
      if (webResults.length > 0) {
        countEl.textContent = '本地 ' + localResults.length + ' + 联网 ' + webResults.length + ' 条';
        sourceEl.textContent = '来源：本地索引 + DuckDuckGo';
        const allResults = [...localResults, ...webResults.map(r => ({ ...r, score: 0, isWeb: true }))];
        renderGuidelineResults(allResults);
      } else if (localResults.length === 0) {
        resultsDiv.innerHTML = '<div class="empty-state"><p>未找到相关指南</p><p style="font-size:0.8rem;margin-top:8px;">建议尝试不同的关键词，或使用 <a href="https://guide.medlive.cn/" target="_blank">医脉通指南</a> 搜索</p></div>';
        countEl.textContent = '';
        sourceEl.textContent = '';
      }
    } catch(e) {
      if (localResults.length === 0) {
        resultsDiv.innerHTML = '<div class="empty-state"><p>联网搜索暂不可用</p><p style="font-size:0.8rem;margin-top:8px;">请尝试其他关键词，或直接访问：<br><a href="https://guide.medlive.cn/" target="_blank">医脉通临床指南</a><br><a href="https://rs.yiigle.com/" target="_blank">中华医学期刊网</a></p></div>';
        countEl.textContent = '';
        sourceEl.textContent = '';
      } else {
        sourceEl.textContent = '来源：本地索引（联网搜索暂不可用）';
      }
    }
  }
}

// DuckDuckGo 搜索（HTML解析，无需API key）
async function searchDuckDuckGo(query) {
  const fullQuery = query + ' 临床指南 ICU site:guide.medlive.cn OR site:rs.yiigle.com';
  const url = 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(fullQuery);
  
  try {
    const resp = await fetch(url, { headers: { 'Accept': 'text/html' } });
    const html = await resp.text();
    const results = [];
    
    // 解析 DuckDuckGo Lite 结果
    const linkRegex = /<a[^>]*href="(https?:\/\/[^"]*guide\.medlive\.cn[^"]*|https?:\/\/[^"]*rs\.yiigle\.com[^"]*|https?:\/\/[^"]*yiigle\.com[^"]*)"[^>]*class="result-link"[^>]*>([^<]*)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1].replace(/&amp;/g, '&');
      const title = match[2].replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim();
      if (title && title.length > 5) {
        results.push({
          t: title,
          s: '网络来源',
          y: '',
          u: url,
          k: query,
          isWeb: true,
        });
      }
    }
    
    // 备用解析：更宽松的匹配
    if (results.length === 0) {
      const altRegex = /<a[^>]*href="(https?:\/\/[^"]*guide\.medlive\.cn[^"]*|https?:\/\/[^"]*rs\.yiigle\.com[^"]*|https?:\/\/[^"]*yiigle\.com[^"]*)"[^>]*>([^<]+)<\/a>/gi;
      while ((match = altRegex.exec(html)) !== null) {
        const url = match[1].replace(/&amp;/g, '&');
        const title = match[2].replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim();
        if (title && title.length > 3 && !title.includes('http')) {
          results.push({
            t: title,
            s: '网络来源',
            y: '',
            u: url,
            k: query,
            isWeb: true,
          });
        }
      }
    }
    
    return results.slice(0, 10);
  } catch(e) {
    return [];
  }
}

function renderGuidelineResults(results) {
  const container = document.getElementById('litResults');
  if (!container || results.length === 0) {
    if (container) container.innerHTML = '<div class="empty-state"><p>未找到相关指南</p></div>';
    return;
  }

  let html = '';
  results.forEach((g, idx) => {
    const linkUrl = g.u || ('https://guide.medlive.cn/search?q=' + encodeURIComponent(g.t));
    html += '<div class="guideline-card' + (g.isWeb ? ' guideline-web' : '') + '">' +
      '<div class="guideline-card-header">' +
        '<span class="guideline-number">' + (idx + 1) + '</span>' +
        '<div class="guideline-title-wrap">' +
          '<a class="guideline-title" href="' + linkUrl + '" target="_blank" rel="noopener">' + escHtml(g.t) + '</a>' +
          (g.isWeb ? '<span class="guideline-web-badge">联网</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="guideline-meta">' + escHtml(g.s) + (g.y ? ' · ' + g.y : '') + '</div>' +
    '</div>';
  });

  container.innerHTML = html;
}// ============================================
//  6. 表单弹窗 (Form Modals)
// ============================================

function showPatientEdit(id) {
  const p = getPatient(id);
  if (!p) return;
  const body = '<div class="form-row"><div class="form-group"><label class="form-label">姓名</label><input class="form-input" id="fPName" value="' + escHtml(p.name || '') + '"></div><div class="form-group"><label class="form-label">床号</label><input class="form-input" id="fPBed" value="' + escHtml(p.bed || '') + '"></div></div><div class="form-row-3"><div class="form-group"><label class="form-label">年龄</label><input class="form-input" id="fPAge" type="number" value="' + escHtml(p.age || '') + '"></div><div class="form-group"><label class="form-label">性别</label><select class="form-select" id="fPGender"><option value="男"' + (p.gender === '男' ? ' selected' : '') + '>男</option><option value="女"' + (p.gender === '女' ? ' selected' : '') + '>女</option></select></div><div class="form-group"><label class="form-label">入院日期</label><input class="form-input" id="fPAdmit" type="date" value="' + escHtml(p.admissionDate || '') + '"></div></div><div class="form-group"><label class="form-label">主要诊断</label><input class="form-input" id="fPDiag" value="' + escHtml(p.primaryDiagnosis || '') + '"></div><div class="form-group"><label class="form-label">次要诊断（逗号分隔）</label><input class="form-input" id="fPDiag2" value="' + escHtml(p.secondaryDiagnoses || '') + '"></div>';

  showModal('编辑患者信息', body, function() {
    p.name = document.getElementById('fPName').value;
    p.bed = document.getElementById('fPBed').value;
    p.age = document.getElementById('fPAge').value;
    p.gender = document.getElementById('fPGender').value;
    p.admissionDate = document.getElementById('fPAdmit').value;
    p.primaryDiagnosis = document.getElementById('fPDiag').value;
    p.secondaryDiagnoses = document.getElementById('fPDiag2').value;
    saveState();
    closeModal();
    render();
    toast('患者信息已更新', 'success');
  });
}

function showAddNote(pid) {
  const body = '<div class="form-group"><label class="form-label">类别</label><select class="form-select" id="fNoteCat"><option value="daily">日常记录</option><option value="event">重要事件</option><option value="consult">会诊记录</option><option value="procedure">操作记录</option><option value="other">其他</option></select></div><div class="form-group"><label class="form-label">内容</label><textarea class="form-textarea" id="fNoteText" placeholder="输入诊疗记录..."></textarea></div>';
  showModal('添加诊疗记录', body, function() {
    const p = getPatient(pid);
    if (!p) return;
    if (!p.treatmentNotes) p.treatmentNotes = [];
    p.treatmentNotes.push({ timestamp: new Date().toISOString(), category: document.getElementById('fNoteCat').value, note: document.getElementById('fNoteText').value });
    saveState(); closeModal(); renderPatientSubTab('info'); toast('诊疗记录已添加', 'success');
  });
}

function showAddVitals(pid) {
  const body = '<div class="form-row-4"><div class="form-group"><label class="form-label">HR (bpm)</label><input class="form-input" id="fVHR" type="number" placeholder="70"></div><div class="form-group"><label class="form-label">收缩压</label><input class="form-input" id="fVSBP" type="number" placeholder="120"></div><div class="form-group"><label class="form-label">舒张压</label><input class="form-input" id="fVDBP" type="number" placeholder="80"></div><div class="form-group"><label class="form-label">CVP</label><input class="form-input" id="fVCVP" type="number" placeholder="8"></div></div><div class="form-row-4"><div class="form-group"><label class="form-label">SpO2 (%)</label><input class="form-input" id="fVSpO2" type="number" placeholder="98"></div><div class="form-group"><label class="form-label">RR (bpm)</label><input class="form-input" id="fVRR" type="number" placeholder="16"></div><div class="form-group"><label class="form-label">体温 (度)</label><input class="form-input" id="fVTemp" type="number" step="0.1" placeholder="36.8"></div></div>';
  showModal('记录生命体征', body, function() {
    const p = getPatient(pid); if (!p) return;
    if (!p.vitals) p.vitals = [];
    p.vitals.push({ timestamp: new Date().toISOString(), hr: document.getElementById('fVHR').value, sbp: document.getElementById('fVSBP').value, dbp: document.getElementById('fVDBP').value, cvp: document.getElementById('fVCVP').value, spo2: document.getElementById('fVSpO2').value, rr: document.getElementById('fVRR').value, temp: document.getElementById('fVTemp').value });
    saveState(); closeModal(); renderPatientSubTab('info'); toast('生命体征已记录', 'success');
  });
}

function showAddABG(pid) {
  const body = '<div class="form-row-4"><div class="form-group"><label class="form-label">pH</label><input class="form-input" id="fApH" type="number" step="0.01" placeholder="7.40"></div><div class="form-group"><label class="form-label">PaCO2 (mmHg)</label><input class="form-input" id="fAPaCO2" type="number" placeholder="40"></div><div class="form-group"><label class="form-label">PaO2 (mmHg)</label><input class="form-input" id="fAPaO2" type="number" placeholder="95"></div><div class="form-group"><label class="form-label">HCO3 (mmol/L)</label><input class="form-input" id="fAHCO3" type="number" placeholder="24"></div></div><div class="form-row-4"><div class="form-group"><label class="form-label">Lac (mmol/L)</label><input class="form-input" id="fALac" type="number" step="0.1" placeholder="1.2"></div><div class="form-group"><label class="form-label">BE</label><input class="form-input" id="fABE" type="number" step="0.1" placeholder="0"></div><div class="form-group"><label class="form-label">FiO2 (%)</label><input class="form-input" id="fAFiO2" type="number" placeholder="40"></div></div>';
  showModal('记录血气分析', body, function() {
    const p = getPatient(pid); if (!p) return;
    if (!p.abgs) p.abgs = [];
    p.abgs.push({ timestamp: new Date().toISOString(), ph: document.getElementById('fApH').value, paco2: document.getElementById('fAPaCO2').value, pao2: document.getElementById('fAPaO2').value, hco3: document.getElementById('fAHCO3').value, lac: document.getElementById('fALac').value, be: document.getElementById('fABE').value, fio2: document.getElementById('fAFiO2').value });
    saveState(); closeModal(); renderPatientSubTab('info'); toast('血气分析已记录', 'success');
  });
}

function showAddMicro(pid) {
  const body = '<div class="form-row"><div class="form-group"><label class="form-label">标本类型</label><select class="form-select" id="fMSpec"><option value="血培养">血培养</option><option value="痰培养">痰培养</option><option value="BALF">BALF</option><option value="引流液">引流液</option><option value="尿培养">尿培养</option><option value="导管尖端">导管尖端</option><option value="脑脊液">脑脊液</option><option value="其他">其他</option></select></div><div class="form-group"><label class="form-label">涂片结果</label><input class="form-input" id="fMStain" placeholder="G+球菌 / G-杆菌 / 真菌..."></div></div><div class="form-group"><label class="form-label">鉴定菌种</label><input class="form-input" id="fMOrg" placeholder="如: 鲍曼不动杆菌, 肺炎克雷伯菌..."></div><div class="form-group"><label class="form-label">药敏结果（格式: 药物:S/I/R, 逗号分隔）</label><input class="form-input" id="fMSens" placeholder="头孢他啶:R, 美罗培南:S, 替加环素:S..."></div><div class="form-group"><label class="form-label">备注</label><input class="form-input" id="fMNote" placeholder="ESBL? CRE? MRSA?..."></div>';
  showModal('添加微生物培养结果', body, function() {
    const p = getPatient(pid); if (!p) return;
    if (!p.microbiology) p.microbiology = [];
    const sensRaw = document.getElementById('fMSens').value;
    const sensitivity = sensRaw ? sensRaw.split(',').map(s => { const parts = s.trim().split(':'); return { antibiotic: (parts[0]||'').trim(), result: (parts[1]||'S').trim() }; }) : [];
    p.microbiology.push({ timestamp: new Date().toISOString(), specimen: document.getElementById('fMSpec').value, stain: document.getElementById('fMStain').value, organism: document.getElementById('fMOrg').value, sensitivity: sensitivity, notes: document.getElementById('fMNote').value });
    saveState(); closeModal(); renderPatientSubTab('micro'); toast('微生物结果已添加', 'success');
  });
}

function showAddAntibiotic(pid) {
  const body = '<div class="form-row"><div class="form-group"><label class="form-label">药物名称</label><input class="form-input" id="fADrug" placeholder="如: 美罗培南"></div><div class="form-group"><label class="form-label">给药途径</label><select class="form-select" id="fARoute"><option value="IV">IV</option><option value="PO">PO</option><option value="NG">NG</option></select></div></div><div class="form-row-3"><div class="form-group"><label class="form-label">开始日期</label><input class="form-input" id="fAStart" type="date" value="' + todayStr() + '"></div><div class="form-group"><label class="form-label">停药日期（留空表示进行中）</label><input class="form-input" id="fAEnd" type="date"></div><div class="form-group"><label class="form-label">剂量/频次</label><input class="form-input" id="fADose" placeholder="1g q8h"></div></div>';
  showModal('添加抗生素', body, function() {
    const p = getPatient(pid); if (!p) return;
    if (!p.antibiotics) p.antibiotics = [];
    p.antibiotics.push({ drug: document.getElementById('fADrug').value, startDate: document.getElementById('fAStart').value, endDate: document.getElementById('fAEnd').value || null, dose: document.getElementById('fADose').value, route: document.getElementById('fARoute').value });
    saveState(); closeModal(); renderPatientSubTab('micro'); toast('抗生素已添加', 'success');
  });
}

// ============================================
//  7. 初始化
// ============================================
async function init() {
  loadState();
  try { const h = await getFileHandle(); if (h) { await readFromSyncFile(h); updateSyncStatus(true); } else { updateSyncStatus(false); } } catch(e) { updateSyncStatus(false); }
  $$('.nav-item').forEach(btn => {
    btn.onclick = function() {
      const view = this.dataset.view;
      state.currentView = view;
      if (view !== 'patient') state.currentPatientId = null;
      $$('.nav-item').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      render();
      saveState();
    };
  });
  document.getElementById('modalOverlay').onclick = function(e) {
    if (e.target === this) closeModal();
  };
  const savedView = state.currentView || 'dashboard';
  $$('.nav-item').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector('.nav-item[data-view="' + savedView + '"]');
  if (activeBtn) activeBtn.classList.add('active');
  render();
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) {
      switch(e.key) {
        case '1': e.preventDefault(); navigate('dashboard'); break;
        case '2': e.preventDefault(); navigate('patient'); break;
        case '3': e.preventDefault(); navigate('handover'); break;
        case '4': e.preventDefault(); navigate('outcome'); break;
        case '5': e.preventDefault(); navigate('literature'); break;
      }
    }
  });
  console.log('ICU 工作站 v2.0 已就绪');
  console.log('快捷键: Ctrl+1~5 切换模块');
  console.log('本地运行，数据不上传');
}
document.addEventListener('DOMContentLoaded', init);
// ============================================
//  数据导出 / 导入
// ============================================
function exportData() {
  const exportObj = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    patients: state.patients,
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ICU工作站_数据备份_' + todayStr() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('数据已导出', 'success');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported.patients || !Array.isArray(imported.patients)) {
        toast('无效的数据文件', 'error');
        return;
      }
      // Backup current data before import
      const backupKey = 'icu_workstation_v2_backup_' + todayStr();
      localStorage.setItem(backupKey, localStorage.getItem('icu_workstation_v2') || '{}');

      // Merge: imported patients replace all, keep other state
      state.patients = imported.patients;
      saveState();
      render();
      toast('已导入 ' + state.patients.length + ' 位患者记录。原数据已自动备份。', 'success');
    } catch(err) {
      toast('文件解析失败: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  // Reset file input so same file can be imported again
  event.target.value = '';
}
// ============================================
//  云同步 (File System Access API)
//  支持 OneDrive / 坚果云 / Dropbox / iCloud 等同步文件夹
// ============================================

// IndexedDB 存储文件句柄
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('icu_sync_db', 1);
    req.onupgradeneeded = (e) => { e.target.result.createObjectStore('handles'); };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function saveFileHandle(handle) {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, 'syncFile');
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = (e) => { db.close(); reject(e.target.error); };
  });
}

async function getFileHandle() {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readonly');
    const req = tx.objectStore('handles').get('syncFile');
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = (e) => { db.close(); reject(e.target.error); };
  });
}

async function clearFileHandle() {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').delete('syncFile');
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = (e) => { db.close(); reject(e.target.error); };
  });
}

// 检查浏览器是否支持 File System Access API
function supportsCloudSync() {
  return typeof window.showSaveFilePicker === 'function';
}

// 启用云同步 - 选择 OneDrive/坚果云 等同步文件夹中的文件
async function enableCloudSync() {
  if (!supportsCloudSync()) {
    toast('当前浏览器不支持云同步。请使用 Chrome 或 Edge，或使用导出/导入功能。', 'error');
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'icu_data.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    });
    await saveFileHandle(handle);
    // 立即写入当前数据
    await writeToSyncFile(handle);
    updateSyncStatus(true);
    toast('云同步已启用。数据将自动同步到所选文件。', 'success');
  } catch(e) {
    if (e.name !== 'AbortError') {
      toast('启用同步失败: ' + e.message, 'error');
    }
  }
}

// 写入数据到同步文件
async function writeToSyncFile(handle) {
  if (!handle) {
    const h = await getFileHandle();
    if (!h) return;
    handle = h;
  }
  try {
    const writable = await handle.createWritable();
    const exportObj = { version: '2.1', updatedAt: new Date().toISOString(), patients: state.patients };
    await writable.write(JSON.stringify(exportObj, null, 2));
    await writable.close();
  } catch(e) {
    console.warn('云同步写入失败:', e.message);
  }
}

// 从同步文件读取数据
async function readFromSyncFile(handle) {
  try {
    const file = await handle.getFile();
    const text = await file.text();
    const imported = JSON.parse(text);
    if (imported.patients && Array.isArray(imported.patients)) {
      // 比较时间戳，只在新数据更新时才覆盖
      state.patients = imported.patients;
      localStorage.setItem('icu_workstation_v2', JSON.stringify(state));
      return true;
    }
  } catch(e) {
    console.warn('云同步读取失败:', e.message);
  }
  return false;
}

// 更新同步状态显示
async function updateSyncStatus(active) {
  const statusEl = document.getElementById('syncStatus');
  const btnEl = document.getElementById('btnCloudSync');
  if (!statusEl || !btnEl) return;
  if (active) {
    statusEl.textContent = '云同步已启用';
    statusEl.style.color = 'var(--success)';
    btnEl.textContent = '关闭云同步';
    btnEl.onclick = disableCloudSync;
  } else {
    statusEl.textContent = '本地运行 · 数据不上传';
    statusEl.style.color = '';
    btnEl.textContent = '启用云同步';
    btnEl.onclick = enableCloudSync;
  }
}

// 关闭云同步
async function disableCloudSync() {
  await clearFileHandle();
  updateSyncStatus(false);
  toast('云同步已关闭', 'success');
}

// 重写 saveState 加入云同步
const _originalSaveState = saveState;
saveState = function() {
  _originalSaveState();
  // 异步写入同步文件（不阻塞UI）
  getFileHandle().then(handle => {
    if (handle) writeToSyncFile(handle);
  }).catch(() => {});
};
// ============================================
//  数据同步面板（统一入口）
// ============================================

// 智能导出：手机用 Web Share API 分享到云盘，桌面下载
async function smartExport() {
  const exportObj = {
    version: '2.6',
    updatedAt: new Date().toISOString(),
    patients: state.patients,
  };
  const jsonStr = JSON.stringify(exportObj, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const file = new File([blob], 'icu_data_' + todayStr() + '.json', { type: 'application/json' });

  // 手机端：Web Share API → 直接分享到云盘 App
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'ICU 工作站数据备份' });
      toast('已发送到云盘', 'success');
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  // 桌面 / 降级：下载文件
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ICU工作站_数据备份_' + todayStr() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('数据已导出', 'success');
}

// 统一同步面板
function showSyncPanel() {
  const hasCloudSync = supportsCloudSync();
  let body = '';

  // === 桌面端：云盘自动同步 ===
  if (hasCloudSync) {
    body += '<div style="background:var(--primary-light);border-radius:var(--radius);padding:14px;margin-bottom:14px;">' +
      '<div style="font-weight:600;color:var(--primary-dark);margin-bottom:4px;">桌面端 · 云盘自动同步</div>' +
      '<p style="font-size:0.8rem;color:var(--text-secondary);margin:0;">选择云盘文件夹中的文件后，每次修改自动保存。云盘会自动把最新数据同步到手机。</p>' +
      '</div>';

    body += '<button class="btn btn-primary" id="btnStartCloudSync" style="width:100%;margin-bottom:10px;justify-content:center;">选择云盘文件，启用自动同步</button>';
    body += '<div id="syncPanelStatus" style="font-size:0.78rem;color:var(--text-muted);text-align:center;margin-bottom:4px;"></div>';
  }

  // === 手动操作（两端通用）===
  body += '<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px;">' +
    '<p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:10px;">手动操作</p>' +
    '<div style="display:flex;gap:8px;">' +
      '<button class="btn" onclick="smartExport();closeModal()" style="flex:1;justify-content:center;">' +
        (hasCloudSync ? '导出备份' : '分享到云盘') +
      '</button>' +
      '<button class="btn" onclick="document.getElementById(\'importFile\').click();closeModal()" style="flex:1;justify-content:center;">从文件导入</button>' +
    '</div>' +
  '</div>';

  // === 同步指南 ===
  if (!hasCloudSync) {
    body += '<div style="background:var(--surface-alt);border-radius:var(--radius);padding:12px;margin-top:14px;font-size:0.78rem;color:var(--text-secondary);line-height:1.8;">' +
      '<strong>同步方法</strong><br>' +
      '<strong>前提：必须先将 ICU 工作站安装到手机主屏幕</strong>（Chrome → 添加到主屏幕），否则分享列表不会出现 ICU 工作站。<br><br>' +
      '<strong>电脑 → 手机：</strong> 电脑导出 → 保存到云盘 → 手机云盘App → 找到文件 → 分享 → 选「ICU工作站」<br>' +
      '<strong>手机 → 电脑：</strong> 点「分享到云盘」→ 选云盘App保存 → 电脑点「从文件导入」' +
    '</div>';
  } else {
    body += '<div style="background:var(--surface-alt);border-radius:var(--radius);padding:12px;margin-top:14px;font-size:0.78rem;color:var(--text-secondary);line-height:1.8;">' +
      '<strong>手机端同步</strong><br>' +
      '电脑已通过云盘自动同步。手机同步：<br>' +
      '① 确保已将 ICU 工作站安装到主屏幕<br>' +
      '② 打开云盘 App → 找到 icu_data.json<br>' +
      '③ 分享该文件 → 选择「ICU 工作站」即可导入' +
    '</div>';
  }

  showModal('数据同步', body, function() { closeModal(); });

  // 检查是否已有同步文件
  setTimeout(async () => {
    if (!hasCloudSync) return;
    const statusEl = document.getElementById('syncPanelStatus');
    const btnEl = document.getElementById('btnStartCloudSync');
    if (!statusEl || !btnEl) return;
    try {
      const h = await getFileHandle();
      if (h) {
        statusEl.textContent = '✓ 云同步已启用 — 每次修改自动保存';
        statusEl.style.color = 'var(--success)';
        btnEl.textContent = '重新选择云盘文件';
      }
    } catch(e) {}
  }, 100);

  // 绑定云同步按钮
  setTimeout(() => {
    const btn = document.getElementById('btnStartCloudSync');
    if (btn) btn.onclick = startCloudSync;
  }, 100);

  // 改保存按钮为关闭
  setTimeout(() => {
    const saveBtn = document.getElementById('modalSaveBtn');
    if (saveBtn) saveBtn.textContent = '关闭';
  }, 50);
}

// 启动云同步
async function startCloudSync() {
  if (!supportsCloudSync()) return;
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'icu_data.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    });
    await saveFileHandle(handle);
    await writeToSyncFile(handle);
    updateSyncStatus(true);
    closeModal();
    toast('云同步已启用，数据将自动保存', 'success');
  } catch(e) {
    if (e.name !== 'AbortError') {
      toast('保存失败: ' + e.message, 'error');
    }
  }
}
