const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('./store.js');

let store = null;
let mainWindow = null;

process.on('uncaughtException', (e) => {
  try {
    const dir = process.env.PORTABLE_EXECUTABLE_DIR || app.getPath('temp');
    fs.writeFileSync(path.join(dir, 'crash.log'), new Date().toISOString() + '\n' + (e && e.stack ? e.stack : String(e)));
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

function getDataDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
  if (app.isPackaged) return path.dirname(app.getPath('exe'));
  return __dirname;
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
  let dir = getDataDir();
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