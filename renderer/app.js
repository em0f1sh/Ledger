const $ = sel => document.querySelector(sel);

let categories = [];
let recordType = 'expense';
let selectedCategory = null;
let goalTarget = parseInt(localStorage.getItem('goalTarget')) || 500000;

function fmtMoney(n) {
  const neg = n < 0;
  return (neg ? '-' : '') + '¥' + Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function renderGoal() {
  const net = await window.api.netStats();
  const pct = Math.min(100, Math.max(0, goalTarget > 0 ? (net.balance / goalTarget) * 100 : 0));
  animateWater(184 - 170 * (pct / 100));
  $('#bottle-caption').textContent = pct.toFixed(0) + '%';
  if (net.balance >= goalTarget) {
    $('#goal-cap').textContent = '已达成目标，超出';
    $('#goal-remain').textContent = fmtMoney(net.balance - goalTarget);
  } else {
    $('#goal-cap').textContent = '离目标还差';
    $('#goal-remain').textContent = fmtMoney(goalTarget - net.balance);
  }
  $('#goal-note').textContent = '累计结余 ' + fmtMoney(net.balance);
  $('#goal-mini-fill').style.width = pct + '%';
  $('#goal-mini-pct').textContent = pct.toFixed(0) + '%';
}

let currentWaterY = 184;
let waterRaf = null;
function animateWater(targetY) {
  if (waterRaf) cancelAnimationFrame(waterRaf);
  const start = currentWaterY;
  const t0 = performance.now();
  const dur = 1200;
  const water = document.getElementById('water');
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    currentWaterY = start + (targetY - start) * e;
    water.setAttribute('transform', `translate(0 ${currentWaterY.toFixed(2)})`);
    if (p < 1) waterRaf = requestAnimationFrame(step);
  };
  waterRaf = requestAnimationFrame(step);
}

// ---------- 工具 ----------
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 1800);
}

function openModal(title, bodyHtml, onOk, okText = '确定') {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHtml;
  $('#modal-ok').textContent = okText;
  $('#modal-mask').classList.remove('hidden');
  $('#modal-cancel').onclick = closeModal;
  $('#modal-ok').onclick = () => { onOk(); closeModal(); };
}
function closeModal() { $('#modal-mask').classList.add('hidden'); }

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------- 导航 ----------
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $(`#view-${view}`).classList.add('active');
    if (view === 'stats') refreshStats();
    if (view === 'history') refreshHistory();
    if (view === 'categories') renderCategories();
  };
});

// ---------- 记账 ----------
async function loadCategories() {
  categories = await window.api.listCategories();
  renderCategoryPicker();
  renderHistoryCategoryFilter();
}

function renderCategoryPicker() {
  const list = categories.filter(c => c.type === recordType);
  const box = $('#category-picker');
  box.innerHTML = '';
  list.forEach(c => {
    const chip = document.createElement('button');
    chip.className = 'cat-chip' + (c.id === selectedCategory ? ' active' : '');
    chip.textContent = c.name;
    chip.onclick = () => {
      selectedCategory = c.id;
      renderCategoryPicker();
    };
    box.appendChild(chip);
  });
}

document.querySelectorAll('.type-btn').forEach(btn => {
  btn.onclick = () => {
    recordType = btn.dataset.type;
    selectedCategory = null;
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderCategoryPicker();
  };
});

$('#btn-save').onclick = async () => {
  const amount = parseFloat($('#rec-amount').value);
  const date = $('#rec-date').value;
  const remark = $('#rec-remark').value.trim();
  if (!selectedCategory) return toast('请先选择分类');
  if (!amount || amount <= 0) return toast('请输入正确的金额');
  if (!date) return toast('请选择日期');
  await window.api.addRecord({ type: recordType, categoryId: selectedCategory, amount, date, remark });
  $('#rec-amount').value = '';
  $('#rec-remark').value = '';
  toast('已记一笔');
  renderGoal();
};

// ---------- 统计 ----------
let statRange = 'month';
let statYear = new Date().getFullYear();
let statMonth = new Date().getMonth() + 1;
let pieChart = null, trendChart = null;

function initCharts() {
  if (!pieChart) pieChart = echarts.init($('#chart-pie'));
  if (!trendChart) trendChart = echarts.init($('#chart-trend'));
}

document.querySelectorAll('.range-btn').forEach(btn => {
  btn.onclick = () => {
    statRange = btn.dataset.range;
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('#stat-month').style.display = statRange === 'month' ? '' : 'none';
    refreshStats();
  };
});

$('#stat-year').onchange = () => {
  statYear = parseInt($('#stat-year').value) || new Date().getFullYear();
  refreshStats();
};
$('#stat-month').onchange = () => {
  statMonth = Math.min(12, Math.max(1, parseInt($('#stat-month').value) || 1));
  refreshStats();
};

async function refreshStats() {
  initCharts();
  renderGoal();
  const now = new Date();
  if (statRange === 'month') {
    $('#stat-year').value = statYear;
    $('#stat-month').value = statMonth;
    $('#stat-month').style.display = '';
    const s = await window.api.monthlyStats({ year: statYear, month: statMonth });
    $('#card-income').textContent = s.income.toFixed(2);
    $('#card-expense').textContent = s.expense.toFixed(2);
    $('#card-balance').textContent = (s.balance >= 0 ? '' : '-') + Math.abs(s.balance).toFixed(2);
    pieChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
      series: [{
        type: 'pie',
        radius: ['40%', '68%'],
        data: s.categoryPie.length ? s.categoryPie : [{ name: '暂无数据', value: 1 }],
        label: { formatter: '{b}\n{d}%' },
        color: ['#b98a4e', '#4c8a66', '#c85d50', '#9c6f3f', '#6b94b4', '#d3a964', '#b9705e', '#8aa8be', '#e0c287', '#4a5f70']
      }]
    });
  } else {
    $('#stat-month').style.display = 'none';
    $('#stat-year').value = statYear;
    let income = 0, expense = 0;
    for (let m = 1; m <= 12; m++) {
      const s = await window.api.monthlyStats({ year: statYear, month: m });
      income += s.income; expense += s.expense;
    }
    $('#card-income').textContent = income.toFixed(2);
    $('#card-expense').textContent = expense.toFixed(2);
    $('#card-balance').textContent = (income - expense >= 0 ? '' : '-') + Math.abs(income - expense).toFixed(2);
    pieChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
      series: [{
        type: 'pie', radius: ['40%', '68%'],
        data: [{ name: '年度合计按月份', value: income + expense }],
        label: { show: false }
      }]
    });
  }
  const t = await window.api.trendStats();
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['收入', '支出'], textStyle: { color: '#8a99a6' } },
    grid: { left: 50, right: 20, top: 34, bottom: 30 },
    xAxis: { type: 'category', data: t.dates, axisLabel: { fontSize: 10, color: '#8a99a6' }, axisLine: { lineStyle: { color: '#dde5ec' } } },
    yAxis: { type: 'value', axisLabel: { color: '#8a99a6' }, splitLine: { lineStyle: { color: 'rgba(90,110,130,.14)' } } },
    series: [
      { name: '收入', type: 'bar', data: t.income, itemStyle: { color: '#4c8a66', borderRadius: [3, 3, 0, 0] } },
      { name: '支出', type: 'bar', data: t.expense, itemStyle: { color: '#c85d50', borderRadius: [3, 3, 0, 0] } }
    ]
  });
  pieChart.resize();
  trendChart.resize();
}

// ---------- 历史 ----------
let historyFilter = {};
let editingRecord = null;

function renderHistoryCategoryFilter() {
  const sel = $('#his-category');
  const cur = sel.value;
  sel.innerHTML = '<option value="">全部分类</option>';
  categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = (c.type === 'expense' ? '支·' : '收·') + c.name;
    sel.appendChild(opt);
  });
  sel.value = cur;
}

$('#his-search').onclick = () => {
  historyFilter = {
    startDate: $('#his-start').value || null,
    endDate: $('#his-end').value || null,
    type: $('#his-type').value || null,
    categoryId: $('#his-category').value ? parseInt($('#his-category').value) : null,
    keyword: $('#his-keyword').value.trim() || null
  };
  refreshHistory();
};

async function refreshHistory() {
  const records = await window.api.listRecords(historyFilter);
  const list = $('#history-list');
  if (!records.length) {
    list.innerHTML = '<div class="empty">还没有记录，先去"记一笔"吧</div>';
    return;
  }
  list.innerHTML = '';
  records.forEach(r => {
    const item = document.createElement('div');
    item.className = 'his-item';
    item.innerHTML = `
      <div class="his-type ${r.type}">${r.type === 'expense' ? '支' : '收'}</div>
      <div class="his-cat">${r.categoryName}</div>
      <div class="his-date">${r.date}</div>
      <div class="his-remark">${r.remark || ''}</div>
      <div class="his-amount ${r.type}">${r.type === 'expense' ? '-' : '+'}¥${r.amount.toFixed(2)}</div>
      <div class="his-op">
        <button class="icon-btn">编辑</button>
        <button class="icon-btn danger">删除</button>
      </div>`;
    item.querySelectorAll('.icon-btn')[0].onclick = () => openEditRecord(r);
    item.querySelectorAll('.icon-btn')[1].onclick = () => confirmDeleteRecord(r);
    list.appendChild(item);
  });
}

function openEditRecord(r) {
  editingRecord = r;
  const cats = categories.filter(c => c.type === r.type);
  const options = cats.map(c => `<option value="${c.id}" ${c.id === r.categoryId ? 'selected' : ''}>${c.name}</option>`).join('');
  openModal('编辑记录', `
    <div class="form-row"><label>类型</label>
      <select id="ed-type">
        <option value="expense" ${r.type === 'expense' ? 'selected' : ''}>支出</option>
        <option value="income" ${r.type === 'income' ? 'selected' : ''}>收入</option>
      </select>
    </div>
    <div class="form-row"><label>分类</label><select id="ed-category">${options}</select></div>
    <div class="form-row"><label>金额</label><input id="ed-amount" type="number" step="0.01" value="${r.amount}"></div>
    <div class="form-row"><label>日期</label><input id="ed-date" type="date" value="${r.date}"></div>
    <div class="form-row"><label>备注</label><input id="ed-remark" type="text" value="${r.remark || ''}"></div>`,
    async () => {
      const type = $('#ed-type').value;
      const amount = parseFloat($('#ed-amount').value);
      const date = $('#ed-date').value;
      if (!amount || amount <= 0) return toast('请输入正确的金额');
      if (!date) return toast('请选择日期');
      await window.api.updateRecord({
        id: r.id,
        record: { type, categoryId: parseInt($('#ed-category').value), amount, date, remark: $('#ed-remark').value.trim() }
      });
      toast('已保存');
      refreshHistory();
    });
  $('#ed-type').onchange = () => {
    const t = $('#ed-type').value;
    const cats2 = categories.filter(c => c.type === t);
    $('#ed-category').innerHTML = cats2.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  };
}

function confirmDeleteRecord(r) {
  openModal('删除记录',
    `<p style="color:var(--muted);font-size:14px;">确定删除这条记录吗？<br>${r.date} ${r.categoryName} ¥${r.amount.toFixed(2)}</p>`,
    async () => {
      await window.api.removeRecord(r.id);
      toast('已删除');
      refreshHistory();
    });
}

// ---------- 分类管理 ----------
function renderCategories() {
  const exp = categories.filter(c => c.type === 'expense');
  const inc = categories.filter(c => c.type === 'income');
  const draw = (list, boxId) => {
    const box = $(boxId);
    const type = list.length ? list[0].type : (boxId === '#cat-expense' ? 'expense' : 'income');
    box.innerHTML = '';
    list.forEach(c => {
      const item = document.createElement('div');
      item.className = 'cat-item';
      item.innerHTML = `<span class="name">${c.name}</span><button class="icon-btn del">删除</button>`;
      item.querySelector('.name').onclick = () => {
        openModal('重命名分类',
          `<div class="form-row"><input id="ren-name" type="text" value="${c.name}" maxlength="10"></div>`,
          async () => {
            const name = $('#ren-name').value.trim();
            if (!name) return toast('名称不能为空');
            await window.api.renameCategory({ id: c.id, name });
            categories = await window.api.listCategories();
            renderCategories();
            toast('已改名');
          });
      };
      item.querySelector('.del').onclick = async () => {
        const res = await window.api.removeCategory(c.id);
        if (!res.ok) return toast(`该分类下还有 ${res.inUse} 条记录，无法删除`);
        categories = await window.api.listCategories();
        renderCategories();
        toast('已删除');
      };
      box.appendChild(item);
    });
    const add = document.createElement('button');
    add.className = 'add-cat';
    add.textContent = '+ 新增分类';
    add.onclick = () => {
      openModal('新增分类',
        `<div class="form-row"><input id="new-cat-name" type="text" maxlength="10" placeholder="分类名称"></div>`,
        async () => {
          const name = $('#new-cat-name').value.trim();
          if (!name) return toast('名称不能为空');
          await window.api.addCategory({ type, name });
          categories = await window.api.listCategories();
          renderCategories();
          toast('已添加');
        });
    };
    box.appendChild(add);
  };
  draw(exp, '#cat-expense');
  draw(inc, '#cat-income');
}

// ---------- 初始化 ----------
async function init() {
  $('#rec-date').value = today();
  $('#stat-year').value = statYear;
  $('#stat-month').value = statMonth;
  $('#goal-target').value = goalTarget;
  $('#goal-target').onchange = () => {
    const v = parseInt($('#goal-target').value);
    if (v && v > 0) {
      goalTarget = v;
      localStorage.setItem('goalTarget', String(v));
      renderGoal();
      toast('目标已更新');
    }
  };
  await loadCategories();
  refreshStats();
}
init();