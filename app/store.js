// 保存・読み込み・データの初期値・バックアップの足し合わせ。端末の保存場所に触るのはこのファイルだけ
// （通知のために iPhone アプリへ包むとき、保存先をここだけ差し替えれば済むようにするため。仕様書 2.8）。
const Store = (() => {
  const KEY = "yoteicho.v1";
  const COLORS = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "gray"]; // 仕様書 2.9
  const TITLE_MAX = 100;
  const MEMO_MAX = 2000;
  const DAY_START = 4; // 毎日のやることのチェックが外れる時刻（仕様書 2.11）
  const TABS = ["cal", "list", "daily", "settings"]; // 下のタブの最初の並び（仕様書 2.10）
  const MONTH_FREQS = ["monthly", "yearly"]; // 「◯月中」の予定で選べる繰り返し（仕様書 D27）

  function fresh() {
    return {
      version: 1,
      events: [],
      habits: [],
      settings: { weekStart: 0, dayStart: DAY_START, tabOrder: TABS.slice(), lastExport: null, startedAt: null, backupAskedAt: null },
    };
  }

  let raw = null; // init() で読んだ中身

  // 起動のときに1回だけ呼ぶ。いまは localStorage なので待ちは無いが、
  // iPhone アプリへ包んでファイルに保存するようになったら、ここで読む（家計簿の store.js と同じ形）
  async function init() {
    try { raw = localStorage.getItem(KEY); } catch (e) { /* 読めないときは空で始める */ }
    return true;
  }

  // 読めない中身を、上書きで消さないよう別のキーへ退避する
  function keepBroken(text) {
    try { localStorage.setItem(KEY + ".broken." + Date.now(), text); } catch (e) { /* 退避もできないときはあきらめる */ }
  }

  function load() {
    if (!raw) return fresh();
    try {
      const d = JSON.parse(raw);
      // 予定の一覧が無い・一覧になっていないのも壊れた中身（空の一覧として読むと、退避せずに上書きしてしまう）
      if (!d || !Array.isArray(d.events)) throw new Error("events");
      const events = d.events.filter(isEvent);
      // 毎日のやることは後から足したので、無い中身（前の版のもの）は空として読む
      const habits = Array.isArray(d.habits) ? d.habits.filter(isHabit) : [];
      // 読めない予定・やることがあったら、元の中身を残してから進む
      if (events.length !== d.events.length || (d.habits != null && (!Array.isArray(d.habits) || habits.length !== d.habits.length))) keepBroken(raw);
      return { version: 1, events: events.map(clean), habits: habits.map(cleanHabit), settings: cleanSettings(d.settings) };
    } catch (e) {
      keepBroken(raw);
      return fresh();
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // 読み込むファイルは手で書き換えられていることもあるので、形だけでなく中身（実在する日付、開始と終了の順）も確かめる
  const str = (v) => typeof v === "string";
  function isEvent(e) {
    if (!e || typeof e !== "object" || !str(e.id) || !/^[A-Za-z0-9_-]{1,40}$/.test(e.id)) return false;
    if (!str(e.title) || !e.title.trim() || e.title.length > TITLE_MAX) return false;
    if (!Cal.isDate(e.start) || !Cal.isDate(e.end) || e.end < e.start) return false;
    if (typeof e.allDay !== "boolean") return false;
    // 「◯月中」：月の1日に始まって同じ日に終わる終日の予定で、繰り返しは毎月・毎年だけ（仕様書 2.12）
    if (e.inMonth != null && typeof e.inMonth !== "boolean") return false;
    if (e.inMonth) {
      if (e.start.slice(8) !== "01" || e.end !== e.start || !e.allDay) return false;
      if (e.repeat != null && !MONTH_FREQS.includes(e.repeat.freq)) return false;
    }
    if (!e.allDay) {
      if (!Cal.isTime(e.startTime) || !Cal.isTime(e.endTime)) return false;
      if (Cal.toMin(e.end, e.endTime) < Cal.toMin(e.start, e.startTime)) return false;
    }
    if (e.memo != null && (!str(e.memo) || e.memo.length > MEMO_MAX)) return false;
    if (e.repeat != null) {
      if (typeof e.repeat !== "object" || !Cal.freqsFor(e.start).includes(e.repeat.freq)) return false;
      if (e.repeat.until != null && (!Cal.isDate(e.repeat.until) || e.repeat.until < e.start)) return false;
    }
    if (e.skips != null && (!Array.isArray(e.skips) || !e.skips.every(Cal.isDate))) return false;
    return true;
  }

  // 決まった形に整える（知らない色は青。繰り返さない予定の skips は空。余計な項目は落とす）
  function clean(e) {
    return {
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      allDay: e.allDay,
      inMonth: e.inMonth === true,
      startTime: e.allDay ? null : e.startTime,
      endTime: e.allDay ? null : e.endTime,
      color: COLORS.includes(e.color) ? e.color : "blue",
      memo: e.memo || "",
      repeat: e.repeat ? { freq: e.repeat.freq, until: e.repeat.until || null } : null,
      skips: e.repeat && Array.isArray(e.skips) ? [...new Set(e.skips)].sort() : [],
      createdAt: str(e.createdAt) ? e.createdAt : null,
    };
  }

  // 毎日のやること（仕様書 3）。days は 0＝日曜〜6＝土曜、since は足した日、done はできた日の一覧、
  // doneAt はチェックを付けた時刻（できた日 → "YYYY-MM-DDTHH:MM"）。doneAt は無くても・おかしくても壊れた扱いにせず、使えるものだけ残す
  const isAt = (v) => str(v) && v.length === 16 && Cal.isDate(v.slice(0, 10)) && v[10] === "T" && Cal.isTime(v.slice(11));
  function isHabit(x) {
    if (!x || typeof x !== "object" || !str(x.id) || !/^[A-Za-z0-9_-]{1,40}$/.test(x.id)) return false;
    if (!str(x.title) || !x.title.trim() || x.title.length > TITLE_MAX) return false;
    if (!Array.isArray(x.days) || !x.days.length || !x.days.every((w) => Number.isInteger(w) && w >= 0 && w <= 6)) return false;
    if (!Cal.isDate(x.since)) return false;
    if (!Array.isArray(x.done) || !x.done.every(Cal.isDate)) return false;
    return true;
  }
  function cleanAt(at, done) {
    const out = {};
    if (!at || typeof at !== "object") return out;
    for (const d of [...new Set(done)].sort()) if (isAt(at[d])) out[d] = at[d];
    return out;
  }
  function cleanHabit(x) {
    return {
      id: x.id,
      title: x.title,
      days: [...new Set(x.days)].sort(),
      since: x.since,
      done: [...new Set(x.done)].sort(),
      doneAt: cleanAt(x.doneAt, x.done),
      createdAt: str(x.createdAt) ? x.createdAt : null,
    };
  }

  // 4つのタブを1つずつ含む並びか
  const isTabOrder = (v) => Array.isArray(v) && v.length === TABS.length && TABS.every((t) => v.includes(t));
  function cleanSettings(s) {
    s = s && typeof s === "object" ? s : {};
    const date = (v) => (Cal.isDate(v) ? v : null);
    return {
      weekStart: s.weekStart === 1 ? 1 : 0,
      dayStart: Number.isInteger(s.dayStart) && s.dayStart >= 0 && s.dayStart <= 23 ? s.dayStart : DAY_START,
      tabOrder: isTabOrder(s.tabOrder) ? s.tabOrder.slice() : TABS.slice(),
      lastExport: date(s.lastExport),
      startedAt: date(s.startedAt),
      backupAskedAt: date(s.backupAskedAt),
    };
  }

  // 読み込んだバックアップを今のデータに足し合わせる（仕様書 2.8）。足した・飛ばした・壊れていた件数を返す。
  // 今に無い id の予定・やることだけ足し、同じ id は今のまま（habits は足したやることの件数。broken は両方の合計）。
  // 予定もやることも無い端末なら、週の始まり・チェックが外れる時刻・タブの並びもファイルどおりにする
  function merge(data, incoming, today) {
    const result = { added: 0, skipped: 0, broken: 0, habits: 0 };
    const wasEmpty = data.events.length === 0 && data.habits.length === 0;
    const have = new Set(data.events.map((e) => e.id));
    for (const e of Array.isArray(incoming.events) ? incoming.events : []) {
      if (!isEvent(e)) { result.broken++; continue; }
      if (have.has(e.id)) { result.skipped++; continue; }
      data.events.push(clean(e));
      have.add(e.id);
      result.added++;
    }
    const haveH = new Set(data.habits.map((x) => x.id));
    for (const x of Array.isArray(incoming.habits) ? incoming.habits : []) {
      if (!isHabit(x)) { result.broken++; continue; }
      if (haveH.has(x.id)) continue;
      data.habits.push(cleanHabit(x));
      haveH.add(x.id);
      result.habits++;
    }
    const s = incoming.settings && typeof incoming.settings === "object" ? incoming.settings : {};
    if (wasEmpty && (s.weekStart === 0 || s.weekStart === 1)) data.settings.weekStart = s.weekStart;
    if (wasEmpty && Number.isInteger(s.dayStart) && s.dayStart >= 0 && s.dayStart <= 23) data.settings.dayStart = s.dayStart;
    if (wasEmpty && isTabOrder(s.tabOrder)) data.settings.tabOrder = s.tabOrder.slice();
    // この端末で使い始めた日（書き出しの催促はここから数える）
    if ((result.added || result.habits) && !data.settings.startedAt) data.settings.startedAt = today;
    return result;
  }

  return { init, load, save, newId, isEvent, clean, isHabit, cleanHabit, merge, fresh, COLORS, TITLE_MAX, MEMO_MAX, TABS, MONTH_FREQS };
})();

if (typeof module !== "undefined") module.exports = Store; // Node（tools/test.js）から読むとき
