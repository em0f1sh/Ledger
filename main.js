const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('./store.js');

let store = null;
let mainWindow = null;

process.on('uncaughtException', (e) => {
  try {
    fs.writeFileSync(path.join(app.getPath('temp'), 'crash.log'), new Date().toISOString() + '\n' + (e && e.stack ? e.stack : String(e)));
  } catch (_) {}
});

const PRESET_CATEGORIES = [
  { type: 'expense', name: '餐饮' },
  { type: 'expense', name: '交通' },
  { type: 'expense', name: '购物' },
  { type: 'expense', name: '娱乐' },
  { type: 'expense', name: '居住' },
  { type: 'expense', name: '医疗' },
  { type: 'expense', name: '学习' },
  { type: 'expense', name: '其他' },
  { type: 'income', name: '工资' },
  { type: 'income', name: '奖金' },
  { type: 'income', name: '理财' },
  { type: 'income', name: '兼职' },
  { type: 'income', name: '其他' }
];

function getDefaultDataDir() {
  return __dirname;
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'config.json'), 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveConfig(cfg) {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(path.join(app.getPath('userData'), 'config.json'), JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {}
}

function resolveDataDir() {
  const cfg = loadConfig();
  if (cfg && cfg.dataDir) return cfg.dataDir;

  const defaultDir = getDefaultDataDir();
  if (fs.existsSync(path.join(defaultDir, 'data.json'))) return defaultDir;

  const choice = dialog.showMessageBoxSync(mainWindow, {
    type: 'question',
    title: '数据保存位置',
    message: '第一次运行，账本数据保存到哪里？\n\n1) 用户数据目录（推荐，藏在系统里不碍事）\n2) 自定义文件夹\n3) 程序旁边（整包拷贝携带数据）',
    buttons: ['用户数据目录', '自定义位置…', '程序旁边'],
    defaultId: 0,
    cancelId: 2
  });
  let dir = path.join(app.getPath('userData'), 'data');
  if (choice === 1) {
    const picked = dialog.showOpenDialogSync(mainWindow, {
      title: '选择数据保存目录',
      properties: ['openDirectory', 'createDirectory']
    });
    if (picked && picked[0]) dir = picked[0];
  } else if (choice === 2) {
    dir = defaultDir;
  }
  saveConfig({ dataDir: dir });
  return dir;
}

function ensureWritable(dir) {
  const probe = path.join(dir, '.write_test');
  try {
    fs.writeFileSync(probe, '');
    fs.unlinkSync(probe);
    return true;
  } catch (e) {
    return false;
  }
}

function initStore() {
  if (store) return;
  let dir = resolveDataDir();
  if (!ensureWritable(dir)) {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      title: '数据目录无写权限',
      message: `当前目录没有写权限：\n${dir}\n\n请选择一个可以写入数据的文件夹（比如 D 盘），数据库文件将保存在那里。`,
      buttons: ['选择文件夹', '退出'],
      defaultId: 0,
      cancelId: 1
    });
    if (choice !== 0) {
      app.quit();
      return;
    }
    const picked = dialog.showOpenDialogSync(mainWindow, {
      title: '选择数据存放目录',
      properties: ['openDirectory', 'createDirectory']
    });
    if (!picked || !picked[0]) {
      app.quit();
      return;
    }
    dir = picked[0];
  }
  store = new Store(path.join(dir, 'data.json'));
  store.init(PRESET_CATEGORIES);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    title: '记账本',
    icon: fs.existsSync(path.join(__dirname, 'build', 'icon.ico')) ? path.join(__dirname, 'build', 'icon.ico') : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

function registerIpc() {
  ipcMain.handle('categories:list', () => store.getCategories());
  ipcMain.handle('categories:add', (e, { type, name }) => store.addCategory(type, name));
  ipcMain.handle('categories:rename', (e, { id, name }) => store.renameCategory(id, name));
  ipcMain.handle('categories:remove', (e, id) => {
    const inUse = store.categoryRecordCount(id);
    if (inUse > 0) return { ok: false, inUse };
    store.removeCategory(id);
    return { ok: true };
  });

  ipcMain.handle('records:add', (e, record) => store.addRecord(record));
  ipcMain.handle('records:update', (e, { id, record }) => store.updateRecord(id, record));
  ipcMain.handle('records:remove', (e, id) => store.removeRecord(id));
  ipcMain.handle('records:list', (e, filter) => store.listRecords(filter));

  ipcMain.handle('stats:monthly', (e, { year, month }) => store.monthlyStats(year, month));
  ipcMain.handle('stats:trend', () => store.trendStats());
  ipcMain.handle('stats:net', () => store.netStats());
}

app.whenReady().then(() => {
  initStore();
  if (store) {
    createWindow();
    registerIpc();
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});