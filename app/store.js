// 保存・読み込み・データの初期値・バックアップの足し合わせ。端末の保存場所に触るのはこのファイルだけ
// （通知のために iPhone アプリへ包むとき、保存先をここだけ差し替えれば済むようにするため。仕様書 2.8）。
const Store = (() => {
  const KEY = "yoteicho.v1";
  const COLORS = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "gray"]; // 仕様書 2.9
  const TITLE_MAX = 100;
  const MEMO_MAX = 2000;
  const DAY_START = 4; // 毎日のやることのチェックが外れる時刻（仕様書 2.11）
  const TABS = ["cal", "list", "daily", "koro", "settings"]; // 下のタブの最初の並び（仕様書 2.10）
  const MONTH_FREQS = ["monthly", "yearly"]; // 「◯月中」の予定で選べる繰り返し（仕様書 D27）
  const WEEK_FREQS = ["weekly", "biweekly"]; // 「◯週中」の予定で選べる繰り返し（仕様書 D35）
  const NOTE_MAX = 200; // ひとことメモの文字数（仕様書 2.14）
  const EVERY_MAX = 3650; // ころあいの「◯日ごと」の上限（仕様書 2.17）

  function fresh() {
    return {
      version: 1,
      events: [],
      habits: [],
      koro: [],
      notes: {},
      settings: { weekStart: 0, dayStart: DAY_START, tabOrder: TABS.slice(), badge: false, lastExport: null, startedAt: null, backupAskedAt: null },
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
      const koro = Array.isArray(d.koro) ? d.koro.filter(isKoro) : []; // ころあいも同じ（D38 より前の中身には無い）
      // 読めない予定・やること・ころあいがあったら、元の中身を残してから進む
      const lost = (list, ok) => list != null && (!Array.isArray(list) || ok.length !== list.length);
      if (events.length !== d.events.length || lost(d.habits, habits) || lost(d.koro, koro)) keepBroken(raw);
      return { version: 1, events: events.map(clean), habits: habits.map(cleanHabit), koro: koro.map(cleanKoro), notes: cleanNotes(d.notes), settings: cleanSettings(d.settings) };
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
    // 「◯週中」：週の最初の日に始まって同じ日に終わる終日の予定で、繰り返しは毎週・2週ごとだけ（仕様書 2.13）。
    // 週の最初の日かどうかは設定によるので、ここでは確かめない
    if (e.inWeek != null && typeof e.inWeek !== "boolean") return false;
    if (e.inWeek) {
      if (e.inMonth || e.end !== e.start || !e.allDay) return false;
      if (e.repeat != null && !WEEK_FREQS.includes(e.repeat.freq)) return false;
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
      inWeek: e.inWeek === true,
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
    // 週◯回（仕様書 D31）。null か 1〜6
    if (x.perWeek != null && !(Number.isInteger(x.perWeek) && x.perWeek >= 1 && x.perWeek <= 6)) return false;
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
      // 週◯回のものは、どの曜日でも付けられるよう曜日を全部にする
      days: x.perWeek ? [0, 1, 2, 3, 4, 5, 6] : [...new Set(x.days)].sort(),
      perWeek: x.perWeek || null,
      since: x.since,
      done: [...new Set(x.done)].sort(),
      doneAt: cleanAt(x.doneAt, x.done),
      createdAt: str(x.createdAt) ? x.createdAt : null,
    };
  }

  // ころあい（仕様書 2.17・3）。every は「◯日ごと」の日数、done はやった日の一覧
  function isKoro(x) {
    if (!x || typeof x !== "object" || !str(x.id) || !/^[A-Za-z0-9_-]{1,40}$/.test(x.id)) return false;
    if (!str(x.title) || !x.title.trim() || x.title.length > TITLE_MAX) return false;
    if (!Number.isInteger(x.every) || x.every < 1 || x.every > EVERY_MAX) return false;
    return Array.isArray(x.done) && x.done.every(Cal.isDate);
  }
  function cleanKoro(x) {
    return { id: x.id, title: x.title, every: x.every, done: [...new Set(x.done)].sort(), createdAt: str(x.createdAt) ? x.createdAt : null };
  }

  // ひとことメモ（仕様書 2.14・3）。{ 日付: 1行の文 }。正しくないもの・空のものは捨てて読み、壊れた扱いにはしない
  const cleanNote = (v) => (str(v) ? v.replace(/\s+/g, " ").trim().slice(0, NOTE_MAX) : "");
  function cleanNotes(n) {
    const out = {};
    if (!n || typeof n !== "object" || Array.isArray(n)) return out;
    for (const d of Object.keys(n).sort()) if (Cal.isDate(d) && cleanNote(n[d])) out[d] = cleanNote(n[d]);
    return out;
  }

  // 週の始まりを変えたら、「◯週中」の予定を新しい週の最初の日へずらす（同じ週を指し続けるように。仕様書 2.13）。
  // 日曜→月曜は1日後ろ、月曜→日曜は1日前
  function moveWeek(e, d) {
    const mv = (s) => Cal.addDays(s, d);
    return {
      ...e, start: mv(e.start), end: mv(e.end), skips: e.skips.map(mv),
      repeat: e.repeat ? { ...e.repeat, until: e.repeat.until && mv(e.repeat.until) } : null,
    };
  }
  function setWeekStart(data, weekStart) {
    const d = weekStart - data.settings.weekStart;
    data.settings.weekStart = weekStart;
    if (d) data.events = data.events.map((e) => (e.inWeek ? moveWeek(e, d) : e));
  }

  // 全部のタブを1つずつ含む並びか
  const isTabOrder = (v) => Array.isArray(v) && v.length === TABS.length && TABS.every((t) => v.includes(t));
  // 正しい並びならその写し、おかしければ null。「ころあい」を足す前の4つの並びなら、毎日のすぐ後に足す
  // （毎日の後ろなので、開いたときのタブ＝左端が「ころあい」に変わることは無い。仕様書 2.10）
  function cleanTabOrder(v) {
    if (Array.isArray(v) && v.length === TABS.length - 1 && !v.includes("koro") && v.includes("daily")) {
      const i = v.indexOf("daily") + 1;
      v = [...v.slice(0, i), "koro", ...v.slice(i)];
    }
    return isTabOrder(v) ? v.slice() : null;
  }
  function cleanSettings(s) {
    s = s && typeof s === "object" ? s : {};
    const date = (v) => (Cal.isDate(v) ? v : null);
    return {
      weekStart: s.weekStart === 1 ? 1 : 0,
      dayStart: Number.isInteger(s.dayStart) && s.dayStart >= 0 && s.dayStart <= 23 ? s.dayStart : DAY_START,
      tabOrder: cleanTabOrder(s.tabOrder) || TABS.slice(),
      badge: s.badge === true,
      lastExport: date(s.lastExport),
      startedAt: date(s.startedAt),
      backupAskedAt: date(s.backupAskedAt),
    };
  }

  // 予定・やること・ころあい・ひとことメモが1つも無いか
  const isEmpty = (data) => data.events.length === 0 && data.habits.length === 0 && data.koro.length === 0 && Object.keys(data.notes).length === 0;

  // 読み込んだバックアップを今のデータに足し合わせる（仕様書 2.8）。足した・飛ばした・壊れていた件数を返す。
  // 今に無い id の予定・やること・ころあいだけ足し、同じ id は今のまま（habits は足したやること、koro は足したころあいの件数。broken は全部の合計）。
  // ひとことメモは今に無い日の分だけ足す（notes は足した日数）。
  // 予定もやることもメモも無い端末なら、週の始まり・チェックが外れる時刻・タブの並びもファイルどおりにする
  function merge(data, incoming, today) {
    const result = { added: 0, skipped: 0, broken: 0, habits: 0, koro: 0, notes: 0 };
    const wasEmpty = isEmpty(data);
    const s = incoming.settings && typeof incoming.settings === "object" ? incoming.settings : {};
    // ファイルと週の始まりが違えば、ファイルの「◯週中」の予定をこの端末の週の最初の日へずらす（setWeekStart と同じ考え方）
    const d = wasEmpty ? 0 : data.settings.weekStart - (s.weekStart === 1 ? 1 : 0);
    const have = new Set(data.events.map((e) => e.id));
    for (const e of Array.isArray(incoming.events) ? incoming.events : []) {
      if (!isEvent(e)) { result.broken++; continue; }
      if (have.has(e.id)) { result.skipped++; continue; }
      data.events.push(e.inWeek && d ? moveWeek(clean(e), d) : clean(e));
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
    const haveK = new Set(data.koro.map((x) => x.id));
    for (const x of Array.isArray(incoming.koro) ? incoming.koro : []) {
      if (!isKoro(x)) { result.broken++; continue; }
      if (haveK.has(x.id)) continue;
      data.koro.push(cleanKoro(x));
      haveK.add(x.id);
      result.koro++;
    }
    const notes = cleanNotes(incoming.notes);
    for (const d of Object.keys(notes)) {
      if (data.notes[d]) continue;
      data.notes[d] = notes[d];
      result.notes++;
    }
    // 空の端末では、週の始まりもファイルどおりにするので「◯週中」の予定はずらさない
    if (wasEmpty && (s.weekStart === 0 || s.weekStart === 1)) data.settings.weekStart = s.weekStart;
    if (wasEmpty && Number.isInteger(s.dayStart) && s.dayStart >= 0 && s.dayStart <= 23) data.settings.dayStart = s.dayStart;
    if (wasEmpty && cleanTabOrder(s.tabOrder)) data.settings.tabOrder = cleanTabOrder(s.tabOrder);
    // この端末で使い始めた日（書き出しの催促はここから数える）
    if ((result.added || result.habits || result.koro || result.notes) && !data.settings.startedAt) data.settings.startedAt = today;
    return result;
  }

  return {
    init, load, save, newId, isEvent, clean, isHabit, cleanHabit, isKoro, cleanKoro, cleanNote, isEmpty, setWeekStart, merge, fresh,
    COLORS, TITLE_MAX, MEMO_MAX, NOTE_MAX, EVERY_MAX, TABS, MONTH_FREQS, WEEK_FREQS,
  };
})();

if (typeof module !== "undefined") module.exports = Store; // Node（tools/test.js）から読むとき
