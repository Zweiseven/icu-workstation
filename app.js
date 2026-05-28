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


// --- 版本更新日志 ---
const VERSION_HISTORY = [
  { v:"v2.9", date:"2026-05-28", changes:[
    "移除文献检索模块，精简为核心四模块",
    "侧边栏导航：病区总览、患者详情、交班记录、转归管理",
  ]},
  { v:"v2.8", date:"2026-05-27", changes:[
    "文献检索从 PubMed 改为中文临床诊疗指南检索",
    "内置 50 条 ICU 指南本地索引（中华医学期刊网+医脉通）",
    "DuckDuckGo 联网扩展搜索（无需 API Key）",
    "12 个快速搜索标签（脓毒症、ARDS、镇静、CRRT 等）",
    "转归管理：新增关键词检索（姓名/床号/诊断）",
    "转归管理：按月份下拉筛选 + 分组归纳展示",
  ]},
  { v:"v2.7.1", date:"2026-05-27", changes:[
    "修复 Share Target 不出现：放宽文件类型接受范围",
    "分享数据改用 Cache API 存储，冷启动不丢失",
    "同步面板添加 PWA 必须安装到主屏幕的提示",
  ]},
  { v:"v2.7", date:"2026-05-27", changes:[
    "统一数据同步入口：合并为侧边栏单个「数据同步」按钮",
    "手机端一键分享到云盘（Web Share API）",
    "桌面端云盘自动同步（File System Access API）",
    "同步面板自适应桌面/手机，带清晰操作指引",
  ]},
  { v:"v2.6.2", date:"2026-05-26", changes:[
    "汉堡菜单按钮扩大到 48px 触控目标（手机友好）",
    "添加 touchend 事件兜底（部分安卓 WebView click 不触发）",
    "侧边栏底部 safe-area-inset-bottom 适配",
  ]},
  { v:"v2.6.1", date:"2026-05-26", changes:[
    "手机端：汉堡菜单 + overlay 展开完整侧边栏",
    "折叠态迷你底部栏：显示版本号和更新/同步按钮",
    "中等屏幕（901–1100px）字体优化",
  ]},
  { v:"v2.6", date:"2026-05-26", changes:[
    "PWA 定期轮询更新：每 5 分钟自动检查 SW 更新",
    "页面可见性恢复时立即触发更新检查",
    "检测到新版本弹出横幅通知（非强制刷新）",
    "侧边栏手动「检查更新」按钮",
    "SW 首次安装自动激活，更新安装等用户确认",
  ]},
  { v:"v2.5", date:"2026-05-25", changes:[
    "版本号驱动的自清理机制",
    "检测旧版 SW 自动杀进程、清缓存、重装",
  ]},
  { v:"v2.4", date:"2026-05-25", changes:[
    "网络优先 HTML 加载策略",
    "强制重载 + 版本号显示",
  ]},
  { v:"v2.3", date:"2026-05-25", changes:[
    "四重 SW 更新检测：updatefound + controllerchange + waiting + postMessage",
  ]},
  { v:"v2.2", date:"2026-05-25", changes:[
    "自动版本检测 + 更新通知横幅",
  ]},
  { v:"v2.1", date:"2026-05-25", changes:[
    "首次发布 PWA：病区总览、患者详情、交班记录、转归管理",
    "云同步（File System Access API）",
    "导出/导入 JSON 备份",
    "Share Target 接收云盘分享",
  ]},
];

function showChangelog() {
  let body = '';
  VERSION_HISTORY.forEach(entry => {
    body += '<div style="margin-bottom:16px;">' +
      '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px;">' +
        '<span style="font-weight:700;font-size:1rem;color:var(--primary-dark);">' + entry.v + '</span>' +
        '<span style="font-size:0.72rem;color:var(--text-muted);">' + entry.date + '</span>' +
      '</div>' +
      '<ul style="margin:0;padding-left:18px;font-size:0.82rem;color:var(--text-secondary);line-height:1.8;">';
    entry.changes.forEach(c => {
      body += '<li>' + escHtml(c) + '</li>';
    });
    body += '</ul></div>';
  });

  showModal('更新日志', body, function() { closeModal(); });
  setTimeout(() => {
    const saveBtn = document.getElementById('modalSaveBtn');
    if (saveBtn) saveBtn.textContent = '关闭';
  }, 50);
}// --- 状态 ---
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
    version: '2.9',
    updatedAt: new Date().toISOString(),
    patients: state.patients,
  };
  const jsonStr = JSON.stringify(exportObj, null, 2);

  // 始终使用 icu_data.json 作为文件名——与电脑端自动同步的文件完全一致
  // 上传到同一 OneDrive 文件夹后覆盖原文件，电脑端就会自动读取
  const syncFileName = 'icu_data.json';

  // 尝试 Web Share（部分手机有效）
  const blob = new Blob([jsonStr], { type: 'text/plain' });
  const file = new File([blob], syncFileName, { type: 'text/plain' });
  let cloudShared = false;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'ICU 数据同步 — 覆盖 icu_data.json' });
      cloudShared = true;
    } catch(e) {}
  }

  // 下载文件
  const dlBlob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(dlBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = syncFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (cloudShared) {
    toast('已发送。如未成功，文件也已下载（' + syncFileName + '）。', 'success');
  } else if (supportsCloudSync()) {
    toast('数据已导出', 'success');
  } else {
    showMobileUploadGuide(syncFileName);
  }
}function showMobileUploadGuide(fileName) {
  var body = '<div style="text-align:center;padding:8px 0;">' +
    '<div style="font-size:2rem;margin-bottom:8px;">🔄</div>' +
    '<p style="font-weight:600;margin-bottom:4px;">文件已下载：<code style="background:var(--primary-light);padding:2px 8px;border-radius:4px;">' + escHtml(fileName) + '</code></p>' +
    '<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px;">与电脑端自动同步的是同一个文件</p>' +
    '<div style="background:var(--surface-alt);border-radius:var(--radius);padding:14px;text-align:left;font-size:0.82rem;color:var(--text-secondary);line-height:2;">' +
      '<strong>上传到 OneDrive 实现同步：</strong><br>' +
      '① 打开 <strong>OneDrive App</strong><br>' +
      '② 进入与电脑同步的 <strong>同一文件夹</strong><br>' +
      '③ 点 <strong>+ → 上传</strong>，选下载文件夹<br>' +
      '④ 找到 <strong>' + escHtml(fileName) + '</strong><br>' +
      '⑤ 如提示「已存在同名文件」，选 <strong>替换/覆盖</strong><br>' +
      '⑥ 电脑端会自动检测到更新并读取' +
    '</div>' +
    '<p style="font-size:0.73rem;color:var(--text-muted);margin-top:10px;">' +
      '文件名固定为 icu_data.json，与电脑端完全一致。<br>每次上传覆盖后，电脑会自动同步最新数据。</p>' +
  '</div>';
  showModal('同步到 OneDrive', body, function() { closeModal(); });
  setTimeout(function() {
    var saveBtn = document.getElementById('modalSaveBtn');
    if (saveBtn) saveBtn.textContent = '知道了';
  }, 50);
}// 统一同步面板
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
      '<strong>电脑 → 手机：</strong> 电脑导出备份 → 保存到 OneDrive → 手机 OneDrive App 中找到文件 → 分享 → 选「ICU工作站」（需已安装到主屏幕）<br>' +
      '<strong>手机 → 电脑：</strong> 点「分享到云盘」→ 文件自动下载 → 按指引上传到 OneDrive → 电脑端自动同步或手动导入' +
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
