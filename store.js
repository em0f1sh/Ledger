const fs = require('fs');
const path = require('path');

class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { categories: [], records: [] };
    this.nextCategoryId = 1;
    this.nextRecordId = 1;
  }

  init(presetCategories) {
    if (fs.existsSync(this.filePath)) {
      try {
        this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        this.nextCategoryId = (this.data.categories.reduce((m, c) => Math.max(m, c.id), 0)) + 1;
        this.nextRecordId = (this.data.records.reduce((m, r) => Math.max(m, r.id), 0)) + 1;
        return;
      } catch (e) {
        // 文件损坏则重新初始化
      }
    }
    this.data = { categories: [], records: [] };
    this.nextCategoryId = 1;
    this.nextRecordId = 1;
    for (const p of presetCategories) {
      this.addCategory(p.type, p.name);
    }
    this.save();
  }

  save() {
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, this.filePath);
  }

  getCategories() {
    return this.data.categories;
  }

  addCategory(type, name) {
    const cat = { id: this.nextCategoryId++, type, name };
    this.data.categories.push(cat);
    this.save();
    return cat;
  }

  renameCategory(id, name) {
    const cat = this.data.categories.find(c => c.id === id);
    if (cat) { cat.name = name; this.save(); }
    return cat;
  }

  removeCategory(id) {
    this.data.categories = this.data.categories.filter(c => c.id !== id);
    this.save();
  }

  categoryRecordCount(id) {
    return this.data.records.filter(r => r.categoryId === id).length;
  }

  addRecord({ type, categoryId, amount, date, remark }) {
    const record = {
      id: this.nextRecordId++,
      type,
      categoryId,
      amount,
      date,
      remark: remark || '',
      createdAt: Date.now()
    };
    this.data.records.push(record);
    this.save();
    return record;
  }

  updateRecord(id, { type, categoryId, amount, date, remark }) {
    const record = this.data.records.find(r => r.id === id);
    if (record) {
      record.type = type;
      record.categoryId = categoryId;
      record.amount = amount;
      record.date = date;
      record.remark = remark || '';
      this.save();
    }
    return record;
  }

  removeRecord(id) {
    this.data.records = this.data.records.filter(r => r.id !== id);
    this.save();
  }

  listRecords(filter = {}) {
    const { startDate, endDate, type, categoryId, keyword } = filter;
    let list = this.data.records.slice();
    if (startDate) list = list.filter(r => r.date >= startDate);
    if (endDate) list = list.filter(r => r.date <= endDate);
    if (type) list = list.filter(r => r.type === type);
    if (categoryId) list = list.filter(r => r.categoryId === categoryId);
    if (keyword) {
      const kw = keyword.toLowerCase();
      list = list.filter(r => (r.remark || '').toLowerCase().includes(kw));
    }
    const catMap = {};
    for (const c of this.data.categories) catMap[c.id] = c;
    list.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
    return list.map(r => ({ ...r, categoryName: catMap[r.categoryId] ? catMap[r.categoryId].name : '已删除' }));
  }

  netStats() {
    const income = this.data.records.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
    const expense = this.data.records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
    return { income, expense, balance: income - expense };
  }

  monthlyStats(year, month) {
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    const monthRecords = this.data.records.filter(r => r.date.startsWith(ym));
    const income = monthRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
    const expense = monthRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);

    const catMap = {};
    for (const c of this.data.categories) catMap[c.id] = c.name;
    const pieMap = {};
    for (const r of monthRecords) {
      if (r.type !== 'expense') continue;
      const name = catMap[r.categoryId] || '已删除';
      pieMap[name] = (pieMap[name] || 0) + r.amount;
    }
    const categoryPie = Object.entries(pieMap)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);

    return { income, expense, balance: income - expense, categoryPie };
  }

  trendStats() {
    const days = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    const dates = [];
    const income = [];
    const expense = [];
    const set = days.map(date => ({ date, inc: 0, exp: 0 }));
    const map = {};
    for (const s of set) map[s.date] = s;
    for (const r of this.data.records) {
      const s = map[r.date];
      if (!s) continue;
      if (r.type === 'income') s.inc += r.amount;
      else s.exp += r.amount;
    }
    for (const s of set) {
      dates.push(s.date.slice(5));
      income.push(Math.round(s.inc * 100) / 100);
      expense.push(Math.round(s.exp * 100) / 100);
    }
    return { dates, income, expense };
  }
}

module.exports = Store;