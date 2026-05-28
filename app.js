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
const nowDateTime = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + 'T' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); };
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


const OUTCOME_STATS = [
  { key:'aki', label:'AKI' },
  { key:'brainInjury', label:'脑损伤' },
  { key:'septicShock', label:'感染性休克' },
  { key:'antibioticUse', label:'抗生素使用' },
  { key:'readmit48h', label:'48h内重返ICU' },
  { key:'pronePosition', label:'俯卧位' },
  { key:'modSevereARDS', label:'中重度ARDS' },
  { key:'bundle', label:'Bundle' },
  { key:'vteProphylaxis', label:'VTE预防' },
  { key:'ards', label:'ARDS' },
  { key:'delirium', label:'谵妄' },
  { key:'intubation', label:'气管插管' },
  { key:'extubation', label:'拔除气管插管' },
  { key:'accidentalExtub', label:'插管脱出' },
  { key:'reintub48h', label:'48h再插管' },
  { key:'unplannedPostOp', label:'非计划术后' },
];

// --- 版本更新日志 ---
const VERSION_HISTORY = [
  { v:"v2.20", date:"2026-05-29", changes:[
    "移除交班记录模块，精简为核心三模块",
  ]},
  { v:"v2.19", date:"2026-05-29", changes:[
    "患者卡片新增删除功能（病区总览 + 转归管理）",
    "删除前弹出确认对话框防止误操作",
  ]},
  { v:"v2.18", date:"2026-05-28", changes:[
    "APACHE II 双评分：入住ICU 24h内 + 结束治疗时",
    "结束治疗统计：16项关键指标是/否记录",
    "编辑信息保存 APACHE II、肠内营养状态",
    "转归卡片显示治疗统计数据（是项）",
    "基本信息卡片增加 APACHE II 分数展示",
  ]},
  { v:"v2.17", date:"2026-05-29", changes:[
    "PWA缓存破坏机制：JS/CSS带版本号参数强制刷新",
    "编辑信息弹窗新增肠内营养是/否+原因编辑",
  ]},
  { v:"v2.16", date:"2026-05-29", changes:[
    "转归管理：已出科患者可编辑信息",
    "转归卡片新增肠内营养状态 + ICU入住天数显示",
    "编辑信息弹窗对在科/出科患者通用",
  ]},
  { v:"v2.15", date:"2026-05-29", changes:[
    "肠内营养简化为是/否选择，未启动需填写原因",
    "治疗转归自动记录ICU入住是否超48h",
    "48h评估提醒卡片简化显示",
  ]},
  { v:"v2.14", date:"2026-05-29", changes:[
    "诊疗记录新增删除功能",
    "入院日期改为入住ICU日期 + 精确到小时分钟(datetime-local)",
    "icuHours兼容新旧日期格式，实现精确48h计算",
  ]},
  { v:"v2.13", date:"2026-05-29", changes:[
    "新增ICU入住超48h评估提醒",
    "肠内营养追踪：标记启动/48h未启动提醒",
    "患者详情新增ICU时长+肠内营养状态",
    "修复诊疗编辑按钮不显示的问题",
  ]},
  { v:"v2.12", date:"2026-05-29", changes:[
    "诊疗类别精简为4个：日常/事件/病情变化/下一步计划",
    "编辑按钮改为始终可见文字按钮",
    "诊疗记录支持类别切换编辑",
  ]},
  { v:"v2.11", date:"2026-05-28", changes:[
    "诊疗模块重构：「诊疗记录」→「诊疗」",
    "诊疗类别五色区分：日常蓝/事件橙/会诊紫/操作绿/其他灰",
    "日常折叠：只展示最新2条，其余收起可展开",
    "诊疗记录可编辑：悬停显示编辑图标，点击修改内容",
  ]},
  { v:"v2.10.1", date:"2026-05-28", changes:[
    "云同步面板新增「从云盘同步最新数据」按钮",
    "一键拉取云盘 icu_data.json 覆盖本地",
  ]},
  { v:"v2.10", date:"2026-05-28", changes:[
    "云同步架构升级：showSaveFilePicker → showDirectoryPicker",
    "目录级文件访问，云盘客户端可正确检测文件变化",
    "修复云盘同步文件写入后未被云盘客户端识别的问题",
  ]},
  { v:"v2.9.3", date:"2026-05-28", changes:[
    "手机导出文件名固定为 icu_data.json，与桌面同步同一文件",
  ]},
  { v:"v2.9.2", date:"2026-05-28", changes:[
    "手机分享改为下载+上传指引，绕过 Android 分享面板云盘不显示问题",
  ]},
  { v:"v2.9.1", date:"2026-05-28", changes:[
    "分享 MIME 改为 text/plain，让 OneDrive 出现在 Android 分享列表",
  ]},
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

  let html = '<div class="page-header"><div><h1 class="page-title">病区总览</h1><p class="page-subtitle">' + fmtDate(new Date()) + ' \u00b7 在科患者 ' + activePatients.length + ' 人 \u00b7 累计管理 ' + state.patients.length + ' 人</p></div><div class="page-actions"><button class="btn btn-primary" onclick="showAddPatient()">+ 收入患者</button></div></div>';

  // 快速统计
  html += '<div class="quick-stats">' +
    '<div class="stat-card" onclick="navigate(\'outcome\')" style="cursor:pointer"><div class="stat-value">' + state.patients.length + '</div><div class="stat-label">累计管理</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + activePatients.length + '</div><div class="stat-label">当前在科</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + abxAlerts + '</div><div class="stat-label">抗生素 \u22657天</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + terminatedPatients.length + '</div><div class="stat-label">已转归</div></div>' +
  '</div>';

  const alerts48h = get48hAlerts();
  if (alerts48h.length > 0) {
    html += render48hAlerts(alerts48h);
  }

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
        '<button class="patient-card-action patient-card-delete" onclick="event.stopPropagation();deletePatient(\'' + p.id + '\')" title="删除患者"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
      '</div>' +
    '</div>' +
    '<div class="patient-card-body" onclick="openPatient(\'' + p.id + '\')">';

  if (p.primaryDiagnosis) {
    card += '<div class="patient-info-row"><span>主诊断</span><strong>' + escHtml(p.primaryDiagnosis) + '</strong></div>';
  } else {
    card += '<div class="patient-info-row"><span>主诊断</span><em style="color:var(--text-muted)">未录入</em></div>';
  }
  if (p.age) card += '<div class="patient-info-row"><span>年龄/性别</span><strong>' + escHtml(p.age) + '岁 / ' + escHtml(p.gender || '—') + '</strong></div>';
  card += '<div class="patient-info-row"><span>ICU日期</span><strong>' + escHtml(fmtDate(p.admissionDate) || '—') + '</strong></div>';

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
    '<div class="form-row-3"><div class="form-group"><label class="form-label">年龄</label><input class="form-input" id="fNewAge" type="number"></div><div class="form-group"><label class="form-label">性别</label><select class="form-select" id="fNewGender"><option value="男">男</option><option value="女">女</option></select></div><div class="form-group"><label class="form-label">入住ICU日期</label><input class="form-input" id="fNewAdmit" type="datetime-local" value="' + nowDateTime() + '"></div></div>' +
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
      enteralNutrition: { started: false, reason: '' },
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

  // Build stats checkboxes
  let statsHTML = '<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px;"><label class="form-label" style="font-weight:600;">治疗统计数据（是/否）</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.82rem;">';
  OUTCOME_STATS.forEach(s => {
    statsHTML += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 0;"><input type="checkbox" id="fStat_' + s.key + '" onchange="var r=document.getElementById(\'fStatReason_\'+this.id.split(\'_\')[1]);if(r)r.style.display=this.checked?\'none\':\'block\'"> ' + s.label + '</label>';
  });
  statsHTML += '</div></div>';

  const body = '<p style="margin-bottom:12px;color:var(--text-secondary);">为 <strong>' + escHtml(p.name) + '</strong> (' + escHtml(p.bed) + ') 选择治疗转归：</p>' +
    '<div id="terminationOptions">' + optionsHTML + '</div>' +
    '<div class="form-group" style="margin-top:12px;"><label class="form-label">备注（可选）</label><textarea class="form-textarea" id="fTermNote" placeholder="简要描述转归情况、转科去向等..."></textarea></div>' +
    statsHTML +
    '<input type="hidden" id="fTermOutcome" value="">';

  showModal('结束治疗 — ' + escHtml(p.name), body, function() {
    const outcomeVal = document.getElementById('fTermOutcome').value;
    if (!outcomeVal) { toast('请选择转归类型', 'error'); return; }
    const ot = OUTCOME_TYPES.find(o => o.value === outcomeVal);
    // Collect stats
    const stats = {};
    OUTCOME_STATS.forEach(s => {
      const cb = document.getElementById('fStat_' + s.key);
      if (cb && cb.checked) stats[s.key] = true;
    });
    p.outcome = {
      type: outcomeVal,
      label: ot ? ot.label : outcomeVal,
      date: todayStr(),
      notes: document.getElementById('fTermNote').value,
      icuOver48h: icuHours(p.admissionDate) > 48,
      enWithin48h: p.enteralNutrition && p.enteralNutrition.started,
      stats: stats,
    };
    saveState();
    closeModal();
    render();
    toast(p.name + ' 已标记为「' + p.outcome.label + '」，可在转归管理中查看', 'success');
  });
}


function deletePatient(pid) {
  const p = getPatient(pid);
  if (!p) return;
  showModal('确认删除', '<p>确定删除患者 <strong>' + escHtml(p.name) + '</strong> (' + escHtml(p.bed || '') + ') 的所有记录吗？此操作不可撤销。</p>', function() {
    state.patients = state.patients.filter(function(pp) { return pp.id !== pid; });
    if (state.currentPatientId === pid) state.currentPatientId = null;
    saveState();
    closeModal();
    render();
    toast('已删除 ' + p.name, 'success');
  });
  setTimeout(function() {
    var btn = document.getElementById('modalSaveBtn');
    if (btn) { btn.textContent = '确认删除'; btn.style.background = 'var(--danger)'; }
  }, 50);
}

function selectTerminationOption(el) {
  $$('#terminationOptions .termination-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('fTermOutcome').value = el.dataset.outcome;
}
// --- 2a. 基本信息 & 诊疗 ---
function renderPatientInfo(container, p) {
  let html = '<div class="card" style="margin-bottom:18px"><div class="card-header"><span class="card-title">基本信息</span></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;font-size:0.85rem;">' +
      '<div><span style="color:var(--text-muted)">姓名：</span><strong>' + escHtml(p.name) + '</strong></div>' +
      '<div><span style="color:var(--text-muted)">床号：</span><strong>' + escHtml(p.bed) + '</strong></div>' +
      '<div><span style="color:var(--text-muted)">年龄/性别：</span><strong>' + escHtml(p.age) + '岁 / ' + escHtml(p.gender) + '</strong></div>' +
      '<div><span style="color:var(--text-muted)">入住ICU日期：</span><strong>' + escHtml(fmtDate(p.admissionDate)) + '</strong></div>' +
      '<div><span style="color:var(--text-muted)">主诊断：</span><strong>' + escHtml(p.primaryDiagnosis || '—') + '</strong></div>' +
      '<div><span style="color:var(--text-muted)">状态：</span><span class="status-tag ' + (p.outcome ? 'status-terminated' : 'status-active') + '">' + (p.outcome ? '已转归' : '在科') + '</span></div>' +
    '</div>';
  if (p.secondaryDiagnoses) html += '<div style="margin-top:8px;font-size:0.85rem;"><span style="color:var(--text-muted)">次要诊断：</span>' + escHtml(p.secondaryDiagnoses) + '</div>';
  if (p.apache24h || p.apacheDischarge) {
    html += '<div style="margin-top:6px;display:flex;gap:16px;flex-wrap:wrap;font-size:0.82rem;">' +
      (p.apache24h ? '<span style="color:var(--text-muted)">APACHE II (24h内)：</span><strong>' + escHtml(p.apache24h) + '</strong>' : '') +
      (p.apacheDischarge ? '<span style="color:var(--text-muted);margin-left:8px;">APACHE II (结束治疗时)：</span><strong>' + escHtml(p.apacheDischarge) + '</strong>' : '') +
    '</div>';
  }
  const en = p.enteralNutrition;
  const icuH = icuHours(p.admissionDate);
  html += '<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);display:flex;align-items:center;gap:16px;flex-wrap:wrap;">' +
    '<span style="font-size:0.82rem;color:var(--text-muted)">ICU已住：<strong style="color:' + (icuH > 48 ? 'var(--danger)' : 'var(--text)') + '">' + Math.floor(icuH / 24) + '天' + (icuH % 24) + '小时</strong></span>' +
    '<span style="font-size:0.82rem;color:var(--text-muted)">肠内营养：<strong style="color:' + (en && en.started ? 'var(--success)' : 'var(--warning)') + '">' + (en && en.started ? '是' : ('否' + (en && en.reason ? '（' + escHtml(en.reason) + '）' : ''))) + '</strong></span>' +
    '<button class="btn btn-sm" onclick="toggleEnteralNutrition(\'' + p.id + '\')" style="font-size:0.72rem;">肠内营养</button>' +
  '</div>';
  html += '</div>';

  html += '<div class="card" style="margin-bottom:18px"><div class="card-header"><span class="card-title">诊疗</span><button class="btn btn-sm btn-primary" onclick="showAddNote(\'' + p.id + '\')">添加记录</button></div>';
  if (p.treatmentNotes && p.treatmentNotes.length > 0) {
    html += renderTreatmentNotes(p);
  } else {
    html += '<div class="empty-state"><p>暂无诊疗</p></div>';
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

  html += '<div class="tabs" id="patientTabs"><button class="tab-btn active" data-ptab="info">基本信息 & 诊疗</button><button class="tab-btn" data-ptab="micro">微生物 & 抗生素</button></div><div id="patientTabContent"></div>';

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
          '<div class="outcome-card-meta">' + escHtml(p.primaryDiagnosis || '无诊断') + ' · ' + escHtml(p.age || '—') + '岁 · ' + escHtml(p.gender || '') + ' · ICU: ' + escHtml(fmtDate(p.admissionDate) || '—') + '</div>' +
        '</div>' +
        '<div style="text-align:right;">' + (p.outcome
          ? '<span class="outcome-tag ' + (ot ? ot.cssClass : '') + '">' + escHtml(p.outcome.label) + '</span><div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">' + escHtml(p.outcome.date || '') + '</div>'
          : '<span class="status-tag status-active">在科</span>') +
        '</div>' +
      '</div>';
    if (p.outcome && p.outcome.notes) {
      html += '<div class="outcome-card-note">' + escHtml(p.outcome.notes) + '</div>';
    }
    if (p.outcome && p.outcome.icuOver48h !== undefined) {
      html += '<div style="font-size:0.75rem;color:' + (p.outcome.icuOver48h ? 'var(--warning)' : 'var(--text-muted)') + ';margin-top:4px;">ICU入住超48h: ' + (p.outcome.icuOver48h ? '是' : '否') + '</div>';
    }
      const enStat = p.enteralNutrition;
    html += '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">肠内营养: ' + (enStat && enStat.started ? '是' : '否' + (enStat && enStat.reason ? '（' + escHtml(enStat.reason) + '）' : '')) + '</div>';
    html += '<div style="font-size:0.75rem;color:var(--text-muted);">ICU已住: ' + Math.floor(icuHours(p.admissionDate) / 24) + '天</div>';
    if (p.outcome && p.outcome.stats) {
      const trueStats = Object.entries(p.outcome.stats).filter(function(e) { return e[1] === true; });
      if (trueStats.length > 0) {
        html += '<div style="font-size:0.75rem;color:var(--text-secondary);margin-top:4px;display:flex;flex-wrap:wrap;gap:4px 12px;">';
        trueStats.forEach(function(e) {
          var s = OUTCOME_STATS.find(function(os) { return os.key === e[0]; });
          if (s) html += '<span style="background:var(--surface-alt);padding:1px 8px;border-radius:3px;">' + escHtml(s.label) + '</span>';
        });
        html += '</div>';
      }
    }
    if (p.antibiotics && p.antibiotics.length > 0) {
      html += '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">抗生素: ' + escHtml(p.antibiotics.map(a => a.drug).join(', ')) + '</div>';
    }
    if (p.treatmentNotes && p.treatmentNotes.length > 0) {
      html += '<div style="font-size:0.75rem;color:var(--text-muted);">诊疗: ' + p.treatmentNotes.length + ' 条</div>';
    }
    html += '<button class="btn btn-sm" onclick="showPatientEdit(\'' + p.id + '\')" style="font-size:0.72rem;">编辑信息</button><button class="btn btn-sm" onclick="deletePatient(\'' + p.id + '\')" style="font-size:0.72rem;color:var(--danger);margin-left:6px;">删除</button>';
    html += '</div>';
  });

  container.innerHTML = html;
}// ============================================
//  6. 表单弹窗 (Form Modals)
// ============================================

function showPatientEdit(id) {
  const p = getPatient(id);
  if (!p) return;
  const body = '<div class="form-row"><div class="form-group"><label class="form-label">姓名</label><input class="form-input" id="fPName" value="' + escHtml(p.name || '') + '"></div><div class="form-group"><label class="form-label">床号</label><input class="form-input" id="fPBed" value="' + escHtml(p.bed || '') + '"></div></div><div class="form-row-3"><div class="form-group"><label class="form-label">年龄</label><input class="form-input" id="fPAge" type="number" value="' + escHtml(p.age || '') + '"></div><div class="form-group"><label class="form-label">性别</label><select class="form-select" id="fPGender"><option value="男"' + (p.gender === '男' ? ' selected' : '') + '>男</option><option value="女"' + (p.gender === '女' ? ' selected' : '') + '>女</option></select></div><div class="form-group"><label class="form-label">入住ICU日期</label><input class="form-input" id="fPAdmit" type="datetime-local" value="' + escHtml(p.admissionDate || '') + '"></div></div><div class="form-group"><label class="form-label">主要诊断</label><input class="form-input" id="fPDiag" value="' + escHtml(p.primaryDiagnosis || '') + '"></div><div class="form-group"><label class="form-label">次要诊断（逗号分隔）</label><input class="form-input" id="fPDiag2" value="' + escHtml(p.secondaryDiagnoses || '') + '"></div>' +
    '<div class="form-row"><div class="form-group"><label class="form-label">APACHE II (入住24h内)</label><input class="form-input" id="fPApache24" type="number" value="' + escHtml(p.apache24h || '') + '"></div><div class="form-group"><label class="form-label">APACHE II (结束治疗时)</label><input class="form-input" id="fPApacheDc" type="number" value="' + escHtml(p.apacheDischarge || '') + '"></div></div>' +
    '<div class="form-group"><label class="form-label">肠内营养</label><select class="form-select" id="fPENStarted" onchange="document.getElementById(\'fPENReasonRow\').style.display=this.value===\'false\'?\'block\':\'none\'"><option value="true"' + ((p.enteralNutrition && p.enteralNutrition.started) ? ' selected' : '') + '>是，已启动</option><option value="false"' + (!p.enteralNutrition || !p.enteralNutrition.started ? ' selected' : '') + '>否，未启动</option></select></div>' +
    '<div class="form-group" id="fPENReasonRow" style="display:' + ((p.enteralNutrition && p.enteralNutrition.started) ? 'none' : 'block') + ';"><label class="form-label">未启动原因</label><textarea class="form-textarea" id="fPENReason">' + escHtml((p.enteralNutrition && p.enteralNutrition.reason) || '') + '</textarea></div>';

  showModal('编辑患者信息', body, function() {
    p.name = document.getElementById('fPName').value;
    p.bed = document.getElementById('fPBed').value;
    p.age = document.getElementById('fPAge').value;
    p.gender = document.getElementById('fPGender').value;
    p.admissionDate = document.getElementById('fPAdmit').value;
    p.primaryDiagnosis = document.getElementById('fPDiag').value;
    p.secondaryDiagnoses = document.getElementById('fPDiag2').value;
    p.apache24h = document.getElementById('fPApache24').value;
    p.apacheDischarge = document.getElementById('fPApacheDc').value;
    if (!p.enteralNutrition) p.enteralNutrition = { started: false, reason: '' };
    p.enteralNutrition.started = document.getElementById('fPENStarted').value === 'true';
    p.enteralNutrition.reason = p.enteralNutrition.started ? '' : (document.getElementById('fPENReason').value || '');
    saveState();
    closeModal();
    render();
    toast('患者信息已更新', 'success');
  });
}

// 诊疗类别颜色
const NOTE_COLORS = {
  daily:     { bg: '#e3f0fa', fg: '#1a6cb5', label: '日常' },
  event:     { bg: '#fef3e2', fg: '#b76e08', label: '事件' },
  change: { bg: '#fce4ec', fg: '#c62828', label: '病情变化' },
  plan:   { bg: '#e8f5e9', fg: '#2e7d32', label: '下一步计划' }
};

function renderNoteBadge(cat, label) {
  const c = NOTE_COLORS[cat] || NOTE_COLORS.daily;
  return '<span class="note-cat-badge" style="background:' + c.bg + ';color:' + c.fg + ';">' + escHtml(label || c.label) + '</span>';
}

function renderTreatmentNotes(p) {
  const notes = [...p.treatmentNotes].reverse();
  const dailyNotes = notes.filter(n => n.category === 'daily');
  const otherNotes = notes.filter(n => n.category !== 'daily');
  let html = '';

  // 非日常始终展开
  otherNotes.forEach((n, i) => {
    const origIdx = p.treatmentNotes.indexOf(n);
    html += renderSingleNote(n, origIdx, p.id);
  });

  // 日常：折叠超过2条
  if (dailyNotes.length > 0) {
    const showAll = dailyNotes.length <= 2;
    const visible = showAll ? dailyNotes : dailyNotes.slice(0, 2);
    const hidden = showAll ? [] : dailyNotes.slice(2);

    if (dailyNotes.length > 2 && otherNotes.length > 0) {
      html += '<div style="border-top:1px dashed var(--border);margin:8px 0;padding-top:8px;"></div>';
    }

    visible.forEach((n, i) => {
      const origIdx = p.treatmentNotes.indexOf(n);
      html += renderSingleNote(n, origIdx, p.id);
    });

    if (hidden.length > 0) {
      const collapseId = 'dailyCollapse_' + p.id;
      html += '<div class="daily-collapse" id="' + collapseId + '" style="display:none;">';
      hidden.forEach((n, i) => {
        const origIdx = p.treatmentNotes.indexOf(n);
        html += renderSingleNote(n, origIdx, p.id);
      });
      html += '</div>';
      html += '<button class="btn btn-sm daily-toggle" onclick="toggleDailyCollapse(\'' + collapseId + '\', this)" style="width:100%;justify-content:center;font-size:0.72rem;">展开 ' + hidden.length + ' 条更早的日常</button>';
    }
  }

  return html;
}

function renderSingleNote(n, idx, pid) {
  const catMap = { daily: '日常', event: '事件', change: '病情变化', plan: '下一步计划' };
  return '<div class="treatment-note">' +
    '<div class="treatment-note-header">' +
      renderNoteBadge(n.category, catMap[n.category] || n.category) +
      '<span class="treatment-note-time">' + escHtml(fmtDateTime(n.timestamp)) + '</span>' +
      '<button class="treatment-note-edit" onclick="editNote(\'' + pid + '\', ' + idx + ')">编辑</button>' +
      '<button class="treatment-note-delete" onclick="deleteNote(\x27' + pid + '\x27, ' + idx + ')">删除</button>' +
    '</div>' +
    '<p class="treatment-note-body">' + escHtml(n.note) + '</p>' +
  '</div>';
}function toggleDailyCollapse(collapseId, btn) {
  const el = document.getElementById(collapseId);
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    btn.textContent = '收起';
  } else {
    el.style.display = 'none';
    const count = el.querySelectorAll('.treatment-note').length;
    btn.textContent = '展开 ' + count + ' 条更早的日常';
  }
}

function editNote(pid, idx) {
  const p = getPatient(pid);
  if (!p || !p.treatmentNotes || !p.treatmentNotes[idx]) return;
  const note = p.treatmentNotes[idx];
  const catMap = { daily: '日常', event: '事件', change: '病情变化', plan: '下一步计划' };

  const body = '<div class="form-group"><label class="form-label">类别</label><select class="form-select" id="fEditNoteCat">' +
    Object.entries(catMap).map(([k,v]) => '<option value="' + k + '"' + (note.category === k ? ' selected' : '') + '>' + v + '</option>').join('') +
    '</select></div>' +
    '<div class="form-group"><label class="form-label">内容</label><textarea class="form-textarea" id="fEditNoteText">' + escHtml(note.note) + '</textarea></div>';

  showModal('编辑诊疗', body, function() {
    note.category = document.getElementById('fEditNoteCat').value;
    note.note = document.getElementById('fEditNoteText').value;
    saveState(); closeModal(); renderPatientSubTab('info'); toast('诊疗已更新', 'success');
  });
}
function deleteNote(pid, idx) {
  const p = getPatient(pid);
  if (!p || !p.treatmentNotes || !p.treatmentNotes[idx]) return;
  showModal('确认删除', '<p>确定删除这条诊疗记录吗？此操作不可撤销。</p>', function() {
    p.treatmentNotes.splice(idx, 1);
    saveState(); closeModal(); renderPatientSubTab('info'); toast('诊疗已删除', 'success');
  });
}

function showAddNote(pid) {
  const body = '<div class="form-group"><label class="form-label">类别</label><select class="form-select" id="fNoteCat"><option value="daily">日常</option><option value="event">事件</option><option value="change">病情变化</option><option value="plan">下一步计划</option></select></div><div class="form-group"><label class="form-label">内容</label><textarea class="form-textarea" id="fNoteText" placeholder="输入诊疗内容..."></textarea></div>';
  showModal('添加诊疗', body, function() {
    const p = getPatient(pid);
    if (!p) return;
    if (!p.treatmentNotes) p.treatmentNotes = [];
    p.treatmentNotes.push({ timestamp: new Date().toISOString(), category: document.getElementById('fNoteCat').value, note: document.getElementById('fNoteText').value });
    saveState(); closeModal(); renderPatientSubTab('info'); toast('诊疗已添加', 'success');
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

// ICU入住超48h检测
function icuHours(admissionDate) {
  if (!admissionDate) return 0;
  const d = admissionDate.includes('T') ? new Date(admissionDate) : new Date(admissionDate + 'T00:00:00');
  return Math.floor((new Date() - d) / 3600000);
}

function get48hAlerts() {
  return state.patients
    .filter(p => !p.outcome)
    .filter(p => icuHours(p.admissionDate) > 48)
    .map(p => ({
      patient: p,
      hours: icuHours(p.admissionDate),
      enStarted: p.enteralNutrition && p.enteralNutrition.started,
      enReason: (p.enteralNutrition && p.enteralNutrition.reason) || '',
    }));
}

function render48hAlerts(alerts) {
  let html = '<div class="alert-48h-section"><div class="alert-48h-header"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>ICU入住超48h评估提醒</div><div class="alert-48h-list">';
  alerts.forEach(a => {
    const p = a.patient;
    html += '<div class="alert-48h-card" onclick="openPatient(\'' + p.id + '\')">' +
      '<div class="alert-48h-card-top"><span class="alert-48h-name">' + escHtml(p.name) + '</span><span class="alert-48h-bed">' + escHtml(p.bed) + '</span><span class="alert-48h-badge badge-warn">' + Math.floor(a.hours / 24) + '天</span></div>' +
      '<div class="alert-48h-checks">' +
        '<div class="alert-48h-check' + (a.enStarted ? ' check-ok' : ' check-fail') + '">' +
          '<span class="alert-48h-dot"></span>' +
          '肠内营养: ' + (a.enStarted ? '已启动' : ('未启动' + (a.enReason ? ' — ' + escHtml(a.enReason.substring(0,30)) : ''))) +
        '</div>' +
        '<div class="alert-48h-check check-warn">' +
          '<span class="alert-48h-dot"></span>' +
          '入住超' + Math.floor(a.hours / 24) + 'h' +
        '</div>' +
      '</div></div>';
  });
  html += '</div></div>';
  return html;
}

function toggleEnteralNutrition(pid) {
  const p = getPatient(pid);
  if (!p) return;
  if (!p.enteralNutrition) p.enteralNutrition = { started: false, reason: '' };
  const body = '<div class="form-group"><label class="form-label">是否已启动肠内营养</label><select class="form-select" id="fENStarted" onchange="var r=document.getElementById(\'enReasonRow\');r.style.display=this.value===\'false\'?\'block\':\'none\'"><option value="true"' + (p.enteralNutrition.started ? ' selected' : '') + '>是，已启动</option><option value="false"' + (!p.enteralNutrition.started ? ' selected' : '') + '>否，未启动</option></select></div>' +
    '<div class="form-group" id="enReasonRow" style="display:' + (p.enteralNutrition.started ? 'none' : 'block') + ';"><label class="form-label">未启动原因</label><textarea class="form-textarea" id="fENReason" placeholder="血流动力学不稳定、腹腔高压、肠梗阻...">' + escHtml(p.enteralNutrition.reason || '') + '</textarea></div>';
  showModal('肠内营养评估 — ' + escHtml(p.name), body, function() {
    p.enteralNutrition.started = document.getElementById('fENStarted').value === 'true';
    p.enteralNutrition.reason = p.enteralNutrition.started ? '' : (document.getElementById('fENReason').value || '');
    saveState(); closeModal(); renderPatientSubTab('info');
    toast('肠内营养已更新', 'success');
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
        case '4': e.preventDefault(); navigate('outcome'); break;
      }
    }
  });
  console.log('ICU 工作站 v2.0 已就绪');
  console.log('快捷键: Ctrl+1~4 切换模块');
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
    tx.objectStore('handles').put(handle, 'syncDir');
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = (e) => { db.close(); reject(e.target.error); };
  });
}

async function getFileHandle() {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readonly');
    const req = tx.objectStore('handles').get('syncDir');
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = (e) => { db.close(); reject(e.target.error); };
  });
}

async function clearFileHandle() {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').delete('syncDir');
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = (e) => { db.close(); reject(e.target.error); };
  });
}

function supportsCloudSync() {
  return typeof window.showDirectoryPicker === 'function';
}

// 从目录句柄获取或创建 icu_data.json 文件句柄
async function getSyncFileHandle(dirHandle) {
  try {
    return await dirHandle.getFileHandle('icu_data.json', { create: true });
  } catch(e) {
    // 权限过期重新请求
    if (e.name === 'NotAllowedError') {
      const ok = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (ok) return await dirHandle.getFileHandle('icu_data.json', { create: true });
    }
    throw e;
  }
}

async function writeToSyncFile(dirHandle) {
  if (!dirHandle) {
    const h = await getFileHandle();
    if (!h) return;
    dirHandle = h;
  }
  try {
    // 确保目录权限
    if ((await dirHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      await dirHandle.requestPermission({ mode: 'readwrite' });
    }

    const fileHandle = await getSyncFileHandle(dirHandle);
    const exportObj = { version: '2.9', updatedAt: new Date().toISOString(), patients: state.patients };
    const content = JSON.stringify(exportObj, null, 2);

    const writable = await fileHandle.createWritable();
    await writable.truncate(0);
    await writable.write(content);
    await writable.close();
    // 读回触发文件系统事件
    await fileHandle.getFile();
    console.log('云同步已写入: ' + exportObj.patients.length + ' 位患者');
  } catch(e) {
    console.warn('云同步写入失败:', e.message);
  }
}

async function readFromSyncFile(dirHandle) {
  if (!dirHandle) {
    const h = await getFileHandle();
    if (!h) return false;
    dirHandle = h;
  }
  try {
    const fileHandle = await getSyncFileHandle(dirHandle);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const imported = JSON.parse(text);
    if (imported.patients && Array.isArray(imported.patients)) {
      state.patients = imported.patients;
      localStorage.setItem('icu_workstation_v2', JSON.stringify(state));
      return true;
    }
  } catch(e) {
    console.warn('云同步读取失败:', e.message);
  }
  return false;
}

async function updateSyncStatus(active) {
  const statusEl = document.getElementById('syncStatus');
  if (!statusEl) return;
  if (active) {
    statusEl.textContent = '云同步已启用 · 数据自动保存';
    statusEl.style.color = 'var(--success)';
  } else {
    statusEl.textContent = '本地运行 · 数据不上传';
    statusEl.style.color = '';
  }
}

async function disableCloudSync() {
  await clearFileHandle();
  updateSyncStatus(false);
  toast('云同步已关闭', 'success');
}

// 重写 saveState 加入云同步
const _originalSaveState = saveState;
saveState = function() {
  _originalSaveState();
  getFileHandle().then(handle => {
    if (handle) writeToSyncFile(handle);
  }).catch(() => {});
};
// ============================================
//  数据同步面板（统一入口）
// ============================================

async function smartExport() {
  const exportObj = {
    version: '2.9',
    updatedAt: new Date().toISOString(),
    patients: state.patients,
  };
  const jsonStr = JSON.stringify(exportObj, null, 2);
  const syncFileName = 'icu_data.json';

  const blob = new Blob([jsonStr], { type: 'text/plain' });
  const file = new File([blob], syncFileName, { type: 'text/plain' });
  let cloudShared = false;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'ICU 数据同步 — 覆盖 icu_data.json' });
      cloudShared = true;
    } catch(e) {}
  }

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
}

function showMobileUploadGuide(fileName) {
  var body = '<div style="text-align:center;padding:8px 0;">' +
    '<div style="font-size:2rem;margin-bottom:8px;">🔄</div>' +
    '<p style="font-weight:600;margin-bottom:4px;">文件已下载：<code style="background:var(--primary-light);padding:2px 8px;border-radius:4px;">' + escHtml(fileName) + '</code></p>' +
    '<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px;">与电脑端自动同步的是同一个文件</p>' +
    '<div style="background:var(--surface-alt);border-radius:var(--radius);padding:14px;text-align:left;font-size:0.82rem;color:var(--text-secondary);line-height:2;">' +
      '<strong>上传到云盘实现同步：</strong><br>' +
      '① 打开云盘 App<br>' +
      '② 进入与电脑同步的同一文件夹<br>' +
      '③ 点 + → 上传，选下载文件夹<br>' +
      '④ 找到 <strong>' + escHtml(fileName) + '</strong><br>' +
      '⑤ 如提示同名文件，选替换/覆盖<br>' +
      '⑥ 电脑端会自动检测到更新并读取' +
    '</div>' +
    '<p style="font-size:0.73rem;color:var(--text-muted);margin-top:10px;">文件名为 icu_data.json，与电脑端一致。每次覆盖后电脑自动同步最新数据。</p>' +
  '</div>';
  showModal('同步到云盘', body, function() { closeModal(); });
  setTimeout(function() {
    var saveBtn = document.getElementById('modalSaveBtn');
    if (saveBtn) saveBtn.textContent = '知道了';
  }, 50);
}

function showSyncPanel() {
  const hasCloudSync = supportsCloudSync();
  let body = '';

  if (hasCloudSync) {
    body += '<div style="background:var(--primary-light);border-radius:var(--radius);padding:14px;margin-bottom:14px;">' +
      '<div style="font-weight:600;color:var(--primary-dark);margin-bottom:4px;">桌面端 · 云盘自动同步</div>' +
      '<p style="font-size:0.8rem;color:var(--text-secondary);margin:0;">选择云盘同步文件夹，之后每次修改自动保存 icu_data.json。请确认云盘客户端正在运行且同步状态正常。</p>' +
      '</div>';

    body += '<button class="btn btn-primary" id="btnStartCloudSync" style="width:100%;margin-bottom:8px;justify-content:center;">选择云盘同步文件夹</button>';
    body += '<button class="btn btn-sm" id="btnSyncFromCloud" style="width:100%;margin-bottom:10px;justify-content:center;">从云盘同步最新数据</button>';
    body += '<div id="syncPanelStatus" style="font-size:0.78rem;color:var(--text-muted);text-align:center;margin-bottom:4px;"></div>';
  }

  body += '<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px;">' +
    '<p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:10px;">手动操作</p>' +
    '<div style="display:flex;gap:8px;">' +
      '<button class="btn" onclick="smartExport();closeModal()" style="flex:1;justify-content:center;">' +
        (hasCloudSync ? '导出备份' : '分享到云盘') +
      '</button>' +
      '<button class="btn" onclick="document.getElementById(\'importFile\').click();closeModal()" style="flex:1;justify-content:center;">从文件导入</button>' +
    '</div>' +
  '</div>';

  if (!hasCloudSync) {
    body += '<div style="background:var(--surface-alt);border-radius:var(--radius);padding:12px;margin-top:14px;font-size:0.78rem;color:var(--text-secondary);line-height:1.8;">' +
      '<strong>同步方法</strong><br>' +
      '<strong>前提：必须先将 ICU 工作站安装到手机主屏幕</strong>（Chrome → 添加到主屏幕），否则分享列表不会出现 ICU 工作站。<br><br>' +
      '<strong>电脑 → 手机：</strong> 电脑导出备份 → 保存到云盘 → 手机云盘 App 中找到文件 → 分享 → 选「ICU工作站」（需已安装到主屏幕）<br>' +
      '<strong>手机 → 电脑：</strong> 点「分享到云盘」→ 文件自动下载 → 按指引上传到云盘 → 电脑端自动同步或手动导入' +
    '</div>';
  } else {
    body += '<div style="background:var(--surface-alt);border-radius:var(--radius);padding:12px;margin-top:14px;font-size:0.78rem;color:var(--text-secondary);line-height:1.8;">' +
      '<strong>手机端同步</strong><br>' +
      '电脑数据每次修改后自动写入同步文件夹的 icu_data.json。请确认云盘客户端正在运行且同步状态正常。如未自动同步，尝试暂停再恢复云盘同步。<br>手机同步：<br>' +
      '① 确保已将 ICU 工作站安装到主屏幕<br>' +
      '② 打开云盘 App → 找到 icu_data.json<br>' +
      '③ 分享该文件 → 选择「ICU 工作站」即可导入' +
    '</div>';
  }

  showModal('数据同步', body, function() { closeModal(); });

  setTimeout(async () => {
    if (!hasCloudSync) return;
    const statusEl = document.getElementById('syncPanelStatus');
    const btnEl = document.getElementById('btnStartCloudSync');
    const syncBtn2 = document.getElementById('btnSyncFromCloud');
    if (!statusEl || !btnEl) return;
    if (syncBtn2) syncBtn2.style.display = 'block';
    try {
      const h = await getFileHandle();
      if (h) {
        statusEl.textContent = '✓ 云同步已启用 — 每次修改自动保存';
        statusEl.style.color = 'var(--success)';
        btnEl.textContent = '重新选择同步文件夹';
      }
    } catch(e) {}
  }, 100);

  setTimeout(() => {
    const btn = document.getElementById('btnStartCloudSync');
    if (btn) btn.onclick = startCloudSync;
    const syncBtn = document.getElementById('btnSyncFromCloud');
    if (syncBtn) syncBtn.onclick = syncFromCloud;
  }, 100);

  setTimeout(() => {
    const saveBtn = document.getElementById('modalSaveBtn');
    if (saveBtn) saveBtn.textContent = '关闭';
  }, 50);
}

// 从云盘同步最新数据
async function syncFromCloud() {
  const btn = document.getElementById('btnSyncFromCloud');
  if (btn) { btn.textContent = '同步中...'; btn.disabled = true; }
  try {
    const h = await getFileHandle();
    if (!h) { toast('未启用云同步，请先选择同步文件夹', 'error'); if (btn) { btn.textContent = '从云盘同步最新数据'; btn.disabled = false; } return; }
    const fileHandle = await getSyncFileHandle(h);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const imported = JSON.parse(text);
    if (imported.patients && Array.isArray(imported.patients)) {
      const backupKey = 'icu_workstation_v2_backup_' + todayStr();
      localStorage.setItem(backupKey, JSON.stringify(state));
      state.patients = imported.patients;
      saveState();
      render();
      toast('已从云盘同步 ' + imported.patients.length + ' 位患者记录', 'success');
    } else {
      toast('云盘数据格式异常', 'error');
    }
  } catch(e) {
    toast('同步失败: ' + e.message, 'error');
  }
  if (btn) { btn.textContent = '从云盘同步最新数据'; btn.disabled = false; }
}

// 启动云同步：选择文件夹而非单个文件（目录级访问更可靠）
async function startCloudSync() {
  if (!supportsCloudSync()) return;
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await saveFileHandle(dirHandle);
    await writeToSyncFile(dirHandle);
    updateSyncStatus(true);
    closeModal();
    toast('云同步已启用。数据将自动保存到 ' + dirHandle.name + '/icu_data.json', 'success');
  } catch(e) {
    if (e.name !== 'AbortError') {
      toast('设置失败: ' + e.message, 'error');
    }
  }
}
