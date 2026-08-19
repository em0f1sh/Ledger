const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require(path.join(__dirname, '..', 'store.js'));

const PRESET = [
  { type: 'expense', name: '餐饮' }, { type: 'expense', name: '交通' },
  { type: 'expense', name: '购物' }, { type: 'expense', name: '娱乐' },
  { type: 'expense', name: '居住' }, { type: 'expense', name: '医疗' },
  { type: 'expense', name: '学习' }, { type: 'expense', name: '其他' },
  { type: 'income', name: '工资' }, { type: 'income', name: '奖金' },
  { type: 'income', name: '理财' }, { type: 'income', name: '兼职' },
  { type: 'income', name: '其他' }
];

const ROOT = path.join(__dirname, '..');
const dataFile = path.join(app.getPath('temp'), 'jizhangben-screens-data.json');
const outDir = path.join(ROOT, 'screenshots');

let rngState = 42;
function rnd() { rngState = (rngState * 1664525 + 1013904223) >>> 0; return rngState / 4294967296; }
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }

function dateStr(offset) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function seedData(store) {
  const cats = store.getCategories();
  const byName = {};
  for (const c of cats) byName[c.name] = c;
  const r = (cname, amount, offset, remark) =>
    store.addRecord({ type: byName[cname].type, categoryId: byName[cname].id, amount, date: dateStr(offset), remark });

  for (let i = 29; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    r('餐饮', Math.round((25 + rnd() * 60) * 100) / 100, i, pick(['午饭', '晚饭', '外卖', '早餐']));
    if (rnd() > 0.3) r('交通', Math.round((5 + rnd() * 20) * 100) / 100, i, pick(['地铁', '打车', '公交']));
    if (rnd() > 0.75) r('购物', Math.round((50 + rnd() * 400) * 100) / 100, i, pick(['日用品', '衣服', '快递', '零食']));
    if (rnd() > 0.85) r('娱乐', Math.round((30 + rnd() * 150) * 100) / 100, i, pick(['电影', '游戏', '奶茶', 'KTV']));
    if (day.getDate() === 1 || day.getDate() === 15) r('居住', day.getDate() === 1 ? 2600 : 1500, i, '房租');
  }

  const t = new Date();
  r('工资', 15000, 2, '8 月工资');
  r('奖金', 5000, 5, '绩效奖金');
  r('理财', 428.6, 12, '基金收益');
  r('兼职', 900, 18, '周末接单');
  const last = new Date(t.getFullYear(), t.getMonth() - 1, 10);
  const lastOff = Math.round((t - last) / 86400000);
  r('工资', 15000, lastOff, '7 月工资');
  if (rnd() > 0.5) r('理财', 260.3, lastOff - 4, '利息');
}

function registerIpc(store) {
  ipcMain.handle('categories:list', () => store.getCategories());
  ipcMain.handle('categories:add', (e, d) => store.addCategory(d.type, d.name));
  ipcMain.handle('categories:rename', (e, d) => store.renameCategory(d.id, d.name));
  ipcMain.handle('categories:remove', (e, id) => store.removeCategory(id));
  ipcMain.handle('records:add', (e, r) => store.addRecord(r));
  ipcMain.handle('records:update', (e, d) => store.updateRecord(d.id, d.record));
  ipcMain.handle('records:remove', (e, id) => store.removeRecord(id));
  ipcMain.handle('records:list', (e, f) => store.listRecords(f));
  ipcMain.handle('stats:monthly', (e, r) => store.monthlyStats(r.year, r.month));
  ipcMain.handle('stats:trend', () => store.trendStats());
  ipcMain.handle('stats:net', () => store.netStats());
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

app.whenReady().then(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const store = new Store(dataFile);
  store.init(PRESET);
  seedData(store);

  registerIpc(store);

  const win = new BrowserWindow({
    width: 1100, height: 720,
    show: false,
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  await win.loadFile(path.join(ROOT, 'renderer', 'index.html'));
  await sleep(800);

  await win.webContents.executeJavaScript(`localStorage.setItem('goalTarget', '40000'); location.reload(); true`);
  await new Promise(res => win.webContents.once('did-finish-load', res));
  await sleep(1500);

  const views = [
    ['record', 'record.png'],
    ['stats', 'stats.png'],
    ['history', 'history.png'],
    ['categories', 'categories.png']
  ];

  for (const [view, file] of views) {
    await win.webContents.executeJavaScript(`document.querySelector('.nav-btn[data-view="${view}"]').click(); true`);
    await sleep(view === 'stats' ? 2000 : 1200);
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, file), image.toPNG());
    console.log('saved', file);
  }
  app.quit();
});