// 日付の計算・日本の祝日・繰り返しの予定の展開・検索。画面には触らない
// （tools/test.js が Node からそのまま呼んで検査するため。仕様書 2.3・2.4・2.6・2.7）。
// 日付は "YYYY-MM-DD" の文字列で持ち、計算のときだけ「1970-01-01 から数えた日数」に直す。
const Cal = (() => {
  const MS_DAY = 86400000;
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`; // m は 1〜12

  // ---------- 日付 ----------
  // 時差の影響を受けないよう、日数は UTC で数える
  function toNum(s) {
    const [y, m, d] = s.split("-").map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / MS_DAY);
  }
  function fromNum(n) {
    const t = new Date(n * MS_DAY);
    return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  const addDays = (s, n) => fromNum(toNum(s) + n);
  const daysBetween = (a, b) => toNum(b) - toNum(a);
  const weekday = (s) => new Date(toNum(s) * MS_DAY).getUTCDay(); // 0＝日曜
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  // 実在する日付か。年は 1900〜2199 に限る（Date.UTC は 0〜99 年を 1900 年代と読むため、変な年を通さない）
  function isDate(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split("-").map(Number);
    return y >= 1900 && y <= 2199 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
  }
  const isTime = (s) => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const mins = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)); // "HH:MM" → 0:00 からの分
  // 日付と時刻 ⇔ 1970-01-01 0:00 からの分。終了を開始と同じだけずらすときに使う
  const toMin = (date, time) => toNum(date) * 1440 + mins(time);
  function fromMin(n) {
    const d = Math.floor(n / 1440), r = n - d * 1440;
    return { date: fromNum(d), time: `${pad(Math.floor(r / 60))}:${pad(r % 60)}` };
  }

  // その月の日が入る週の並び（weekStart は 0＝日曜始まり・1＝月曜始まり）の最初の日と最後の日
  function monthRange(key, weekStart) {
    const [y, m] = key.split("-").map(Number);
    const first = ymd(y, m, 1), last = ymd(y, m, daysInMonth(y, m));
    return {
      from: addDays(first, -((weekday(first) - weekStart + 7) % 7)),
      to: addDays(last, (weekStart + 6 - weekday(last)) % 7),
    };
  }

  // ---------- 祝日（仕様書 2.7） ----------
  // y 年 m 月の第 n 月曜日
  function nthMonday(y, m, n) {
    const first = weekday(ymd(y, m, 1));
    return ymd(y, m, 1 + ((8 - first) % 7) + (n - 1) * 7);
  }
  // 春分日・秋分日の計算式（1980〜2099 年に使える近似。正式な日は毎年2月に翌年分が発表される）
  const shift = (y) => 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4);
  const springDay = (y) => Math.floor(20.8431 + shift(y));
  const autumnDay = (y) => Math.floor(23.2488 + shift(y));

  const holidayCache = new Map();
  // y 年の祝日と休日を { "YYYY-MM-DD": "名前" } で返す。2007〜2099 年の外は空
  function holidays(y) {
    if (holidayCache.has(y)) return holidayCache.get(y);
    const named = {}; // 祝日法の「国民の祝日」（振替休日・国民の休日はこれをもとに決まる）
    const h = {};
    if (y >= 2007 && y <= 2099) {
      const add = (m, d, name) => { named[ymd(y, m, d)] = name; };
      add(1, 1, "元日");
      named[nthMonday(y, 1, 2)] = "成人の日";
      add(2, 11, "建国記念の日");
      if (y >= 2020) add(2, 23, "天皇誕生日");
      add(3, springDay(y), "春分の日");
      add(4, 29, "昭和の日");
      add(5, 3, "憲法記念日");
      add(5, 4, "みどりの日");
      add(5, 5, "こどもの日");
      // 2020・2021 年は東京五輪のため、海の日・スポーツの日・山の日が動いた
      if (y === 2020) { add(7, 23, "海の日"); add(7, 24, "スポーツの日"); add(8, 10, "山の日"); }
      else if (y === 2021) { add(7, 22, "海の日"); add(7, 23, "スポーツの日"); add(8, 8, "山の日"); }
      else {
        named[nthMonday(y, 7, 3)] = "海の日";
        if (y >= 2016) add(8, 11, "山の日");
        named[nthMonday(y, 10, 2)] = y >= 2020 ? "スポーツの日" : "体育の日";
      }
      named[nthMonday(y, 9, 3)] = "敬老の日";
      add(9, autumnDay(y), "秋分の日");
      add(11, 3, "文化の日");
      add(11, 23, "勤労感謝の日");
      if (y <= 2018) add(12, 23, "天皇誕生日");
      // 即位の年。この2日は祝日と同じに扱う法律があり、前後に国民の休日ができた
      if (y === 2019) { add(5, 1, "天皇の即位の日"); add(10, 22, "即位礼正殿の儀の行われる日"); }
      Object.assign(h, named);
      // 国民の休日：前の日と次の日が祝日で、その日は祝日でない日（祝日法 第3条第3項）
      for (const s of Object.keys(named)) {
        const mid = addDays(s, 1);
        if (!named[mid] && named[addDays(s, 2)]) h[mid] = "国民の休日";
      }
      // 振替休日：祝日が日曜なら、そのあとでいちばん近い祝日でない日（第3条第2項）
      for (const s of Object.keys(named)) {
        if (weekday(s) !== 0) continue;
        let d = addDays(s, 1);
        while (named[d]) d = addDays(d, 1);
        h[d] = "振替休日";
      }
    }
    holidayCache.set(y, h);
    return h;
  }
  const holidayName = (s) => holidays(Number(s.slice(0, 4)))[s] || null;

  // ---------- 繰り返しの展開（仕様書 2.6） ----------
  const FREQS = ["daily", "weekly", "biweekly", "monthly", "monthlyNth", "monthlyLast", "yearly"];
  // その日がその月の第何◯曜日か（1〜5）と、最後の◯曜日か
  const nthOfMonth = (s) => Math.ceil(Number(s.slice(8)) / 7);
  const isLastWeekdayOfMonth = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return d + 7 > daysInMonth(y, m);
  };
  // 開始日 s で選べる繰り返しの種類。第5◯曜日は無い月が多いので「第◯」は第4までにし、そこは「最終」で選ぶ
  function freqsFor(s) {
    return FREQS.filter((f) => (f === "monthlyNth" ? nthOfMonth(s) <= 4 : f === "monthlyLast" ? isLastWeekdayOfMonth(s) : true));
  }
  // 予定 ev の回のうち、from〜to（両端を含む）に1日でもかかるものを、始まる日の早い順に返す。
  // 回は { ev, start, end }（その回の開始日・終了日）。limit を渡すとその件数で打ち切る
  function occurrences(ev, from, to, limit = Infinity) {
    const s = toNum(ev.start), len = toNum(ev.end) - s;
    const A = toNum(from), B = toNum(to);
    const out = [];
    const skips = ev.repeat && ev.skips && ev.skips.length ? new Set(ev.skips) : null;
    const push = (n) => {
      if (n + len < A || n > B || out.length >= limit) return;
      const d = fromNum(n);
      if (!skips || !skips.has(d)) out.push({ ev, start: d, end: fromNum(n + len) });
    };
    if (!ev.repeat) {
      push(s);
      return out;
    }
    const last = ev.repeat.until ? Math.min(toNum(ev.repeat.until), B) : B; // この日までに始まる回だけ
    const lo = Math.max(s, A - len); // これより前に始まる回は from にかからない
    const [, sm, sd] = ev.start.split("-").map(Number);
    const freq = ev.repeat.freq;
    const step = { daily: 1, weekly: 7, biweekly: 14 }[freq];
    if (step) {
      for (let n = s + Math.ceil((lo - s) / step) * step; n <= last && out.length < limit; n += step) push(n);
    } else if (freq === "monthlyNth" || freq === "monthlyLast") {
      // 毎月の第◯◯曜日・最終◯曜日。その曜日が無い月は無いので、毎月出る
      const wd = weekday(ev.start), nth = nthOfMonth(ev.start);
      let [y, m] = fromNum(lo).split("-").map(Number);
      while (toNum(ymd(y, m, 1)) <= last && out.length < limit) {
        const d = freq === "monthlyNth"
          ? 1 + ((wd - weekday(ymd(y, m, 1)) + 7) % 7) + (nth - 1) * 7
          : daysInMonth(y, m) - ((weekday(ymd(y, m, daysInMonth(y, m))) - wd + 7) % 7);
        const n = toNum(ymd(y, m, d));
        if (n >= lo && n <= last) push(n);
        if (++m > 12) { m = 1; y++; }
      }
    } else if (freq === "monthly") {
      // その日付が無い月（31日に対する30日までの月など）には出さない
      let [y, m] = fromNum(lo).split("-").map(Number);
      while (toNum(ymd(y, m, 1)) <= last && out.length < limit) {
        if (sd <= daysInMonth(y, m)) {
          const n = toNum(ymd(y, m, sd));
          if (n >= lo && n <= last) push(n);
        }
        if (++m > 12) { m = 1; y++; }
      }
    } else if (freq === "yearly") {
      // 2月29日は、うるう年だけ
      for (let y = Number(fromNum(lo).slice(0, 4)); toNum(ymd(y, 1, 1)) <= last && out.length < limit; y++) {
        if (sd <= daysInMonth(y, sm)) {
          const n = toNum(ymd(y, sm, sd));
          if (n >= lo && n <= last) push(n);
        }
      }
    }
    return out;
  }

  // ---------- 1日の中での見え方と並び（仕様書 2.4） ----------
  // 回 occ が day にどう見えるか。from・to は時刻（無い側は null）。終日と、時刻付きの予定の間の日は allDay
  function dayView(occ, day) {
    const ev = occ.ev;
    if (ev.allDay) return { allDay: true, from: null, to: null };
    const first = occ.start === day, last = occ.end === day;
    if (first && last) return { allDay: false, from: ev.startTime, to: ev.endTime };
    if (first) return { allDay: false, from: ev.startTime, to: null };
    if (last) return { allDay: false, from: null, to: ev.endTime };
    return { allDay: true, from: null, to: null };
  }
  // 終日 → 始まる時刻（前の日から続いて day に終わるものは 0:00 扱い）→ 作った順 → タイトル
  function byTime(a, b) {
    const ka = a.view.allDay ? -1 : a.view.from ? mins(a.view.from) : 0;
    const kb = b.view.allDay ? -1 : b.view.from ? mins(b.view.from) : 0;
    if (ka !== kb) return ka - kb;
    const ca = a.ev.createdAt || "", cb = b.ev.createdAt || "";
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.ev.title < b.ev.title ? -1 : a.ev.title > b.ev.title ? 1 : 0;
  }

  // from〜to の日ごとの予定を Map（日付 → 並べた一覧）で返す。何日かにまたがる回は、かかる日すべてに入る。
  // 一覧の1件は { ev, start, end, view }
  function itemsByDay(events, from, to) {
    const map = new Map();
    for (let n = toNum(from), B = toNum(to); n <= B; n++) map.set(fromNum(n), []);
    for (const ev of events) {
      for (const o of occurrences(ev, from, to)) {
        const a = Math.max(toNum(o.start), toNum(from)), b = Math.min(toNum(o.end), toNum(to));
        for (let n = a; n <= b; n++) {
          const day = fromNum(n);
          map.get(day).push({ ...o, view: dayView(o, day) });
        }
      }
    }
    for (const list of map.values()) list.sort(byTime);
    return map;
  }

  // 「これからの予定」：today から days 日分にかかる回を、始まる日（今日より前に始まったものは今日）に1回だけ置き、
  // [{ day, items }] を日付の早い順に返す（仕様書 2.3）
  function upcoming(events, today, days = 365) {
    const to = addDays(today, days - 1);
    const map = new Map();
    for (const ev of events) {
      for (const o of occurrences(ev, today, to)) {
        const day = o.start < today ? today : o.start;
        if (!map.has(day)) map.set(day, []);
        map.get(day).push({ ...o, view: dayView(o, day) });
      }
    }
    return [...map.keys()].sort().map((day) => ({ day, items: map.get(day).sort(byTime) }));
  }

  // ---------- 検索（仕様書 2.3） ----------
  // 全角・半角と英字の大文字・小文字をそろえる
  const norm = (s) => String(s || "").normalize("NFKC").toLowerCase();
  // 今日以降にかかる最初の回（何日かにまたがって今日も続いている回を含む）。
  // 予定の日付は 2199 年までなので、そこまでを探す（最初の1回で打ち切るので、毎日の予定でも重くならない）
  function nextOccurrence(ev, today) {
    return occurrences(ev, today, "2199-12-31", 1)[0] || null;
  }
  // 今日より前に終わった最後の回
  function lastOccurrenceBefore(ev, today) {
    if (ev.start >= today) return null;
    const list = occurrences(ev, ev.start, addDays(today, -1)).filter((o) => o.end < today);
    return list[list.length - 1] || null;
  }
  // q を空白で区切った言葉のすべてを、タイトルかメモに含む予定を探す。
  // 次の回がある予定は upcoming（次の回の早い順）、無い予定は past（最後の回の新しい順）。どちらも回 { ev, start, end } の一覧
  function search(events, q, today) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const result = { upcoming: [], past: [] };
    if (!words.length) return result;
    for (const ev of events) {
      const text = norm(ev.title) + "\n" + norm(ev.memo);
      if (!words.every((w) => text.includes(w))) continue;
      const next = nextOccurrence(ev, today);
      if (next) result.upcoming.push(next);
      else {
        const prev = lastOccurrenceBefore(ev, today);
        if (prev) result.past.push(prev);
      }
    }
    result.upcoming.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
    result.past.sort((a, b) => (a.start > b.start ? -1 : a.start < b.start ? 1 : 0));
    return result;
  }

  return {
    toNum, fromNum, addDays, daysBetween, weekday, daysInMonth, isDate, isTime, toMin, fromMin, monthRange,
    holidays, holidayName, FREQS, freqsFor, nthOfMonth, occurrences, dayView, itemsByDay, upcoming, search,
  };
})();

if (typeof module !== "undefined") module.exports = Cal; // Node（tools/test.js）から読むとき
