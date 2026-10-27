// 画面の切り替えと4つのタブ（カレンダー・一覧・毎日・設定）、予定と毎日のやることの入力の画面。
let data; // いちばん下で Store.init() を待ってから入れる
const view = document.getElementById("view");
const titleEl = document.getElementById("title");
const leftEl = document.getElementById("tb-left");
const addBtn = document.getElementById("add");
const TITLES = { cal: "カレンダー", list: "一覧", daily: "毎日のやること", settings: "設定" };
const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
const FREQ_NAMES = { daily: "毎日", weekly: "毎週", biweekly: "2週ごと", monthly: "毎月", monthlyNth: "毎月", monthlyLast: "毎月", yearly: "毎年" };
const COLOR_NAMES = { red: "赤", orange: "橙", yellow: "黄", green: "緑", cyan: "水色", blue: "青", purple: "紫", gray: "灰" };
// 共有シートを閉じただけのとき
const isCancel = (e) => e?.name === "AbortError";
const pad2 = (n) => String(n).padStart(2, "0"); // すぐ下で today() が使うので、先に置く

let tab = "cal";
let month = today().slice(0, 7); // カレンダーで見ている月
let selected = today(); // カレンダーで選んでいる日
let query = ""; // 一覧の検索欄
let shownToday = today(); // 開いたまま日をまたいだかを見る
let shownHabitDay = null; // 毎日のタブで出しているやることの日（チェックが外れる時刻をまたいだかを見る）

// ---------- 小道具 ----------
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function h(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}
function dayLabel(date) {
  const [, m, d] = date.split("-").map(Number);
  return `${m}月${d}日（${WEEK[Cal.weekday(date)]}）`;
}
function longDate(date) {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}
function monthTitle(key) {
  const [y, m] = key.split("-").map(Number);
  return `${y}年${m}月`;
}
function shiftMonth(key, n) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
// 日付に付ける印「今日」「明日」「あと3日」（仕様書 2.4）。昨日より前は無し
function dayTag(date) {
  const n = Cal.daysBetween(today(), date);
  return n === 0 ? "今日" : n === 1 ? "明日" : n >= 2 ? `あと${n}日` : "";
}
const shortDate = (date) => date.slice(5).split("-").map(Number).join("/"); // 10/24
const fmtTime = (t) => String(Number(t.slice(0, 2))) + t.slice(2); // 09:00 → 9:00
const colorVar = (c) => `var(--c-${Store.COLORS.includes(c) ? c : "blue"})`;

// 失敗はすぐ後の「◯◯しました」の案内に上書きされないよう、閉じるまで残る alert で知らせる
const saveFailed = (kept) => alert("保存できませんでした。端末の空きを確認してください。\n"
  + (kept ? "（いまの変更は、アプリを閉じると消えます）" : "（いまの変更は取りやめました）"));
function save() {
  const ok = Store.save(data);
  if (!ok) saveFailed(true);
  return ok;
}
// 予定を足す・変える・消すときの保存。失敗したら undo で変える前に戻す
// （そのまま残すと、もう一度押したときに同じ予定が2件できたり、変更が保存されずに閉じたりするため）
function commit(undo) {
  if (Store.save(data)) return true;
  undo();
  saveFailed(false);
  return false;
}
let toastTimer = null;
// undo を渡すと「取り消す」を付け、押せるよう長めに出す
function toast(msg, undo) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.toggle("has-act", !!undo);
  if (undo) {
    const b = h(`<button type="button">取り消す</button>`);
    b.addEventListener("click", () => { t.classList.remove("show", "has-act"); undo(); });
    t.appendChild(b);
  }
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show", "has-act"), undo ? 4500 : 2200);
}

// ---------- タブの切り替え ----------
document.querySelectorAll(".tabs button").forEach((b) => {
  b.addEventListener("click", () => {
    if (!data) return; // 読み込みが済む前
    tab = b.dataset.tab;
    render();
    window.scrollTo(0, 0);
  });
});
addBtn.addEventListener("click", () => {
  if (!data) return;
  if (tab === "daily") showHabitEditor(null);
  else openNew(tab === "cal" ? selected : today());
});

function render() {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  addBtn.hidden = tab === "settings";
  leftEl.innerHTML = "";
  titleEl.textContent = TITLES[tab];
  view.innerHTML = "";
  ({ cal: renderCal, list: renderList, daily: renderDaily, settings: renderSettings })[tab]();
}

// ---------- 予定の1行（カレンダーの下・一覧で共通） ----------
// item は { ev, start, end, view }（その日の見え方 view は Cal.dayView）。withDate なら日付も添える（検索の結果）
function eventRow(item, withDate) {
  const { ev, view: v } = item;
  let t1 = "終日", t2 = "";
  if (!v.allDay) {
    t1 = v.from ? fmtTime(v.from) : "〜";
    t2 = v.to ? fmtTime(v.to) : "〜";
  }
  const tags = [];
  if (withDate) tags.push(dayLabel(item.start));
  if (withDate && dayTag(item.start)) tags.push(dayTag(item.start));
  if (item.start !== item.end) tags.push(`${shortDate(item.start)}〜${shortDate(item.end)}`);
  if (ev.repeat) tags.push(FREQ_NAMES[ev.repeat.freq]);
  // 毎年の予定は、最初の回から何年目か（誕生日を生まれた日で入れれば年齢になる）
  const years = ev.repeat && ev.repeat.freq === "yearly" ? Number(item.start.slice(0, 4)) - Number(ev.start.slice(0, 4)) : 0;
  if (years > 0) tags.push(`${years}周年`);
  const memo = ev.memo ? ev.memo.split("\n")[0] : "";
  const sub = tags.length || memo
    ? `<span class="ev-sub">${tags.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}${esc(memo)}</span>`
    : "";
  const row = h(`<button type="button" class="ev-row" style="--ec:${colorVar(ev.color)}">
    <span class="ev-time"><span>${t1}</span><span>${t2}</span></span>
    <span class="ev-bar"></span>
    <span class="ev-main"><span class="ev-title">${esc(ev.title)}</span>${sub}</span>
  </button>`);
  row.addEventListener("click", () => openEditor(ev.id, item.start));
  return row;
}

// ---------- カレンダー（仕様書 2.2） ----------
function moveMonth(n) {
  month = shiftMonth(month, n);
  selected = month === today().slice(0, 7) ? today() : month + "-01";
  render();
}

function renderCal() {
  const back = h(`<button type="button" class="link">今日</button>`);
  back.addEventListener("click", () => { month = today().slice(0, 7); selected = today(); render(); });
  leftEl.appendChild(back);
  titleEl.innerHTML = "";
  const nav = h(`<span class="mnav"><button type="button" class="icon-btn" aria-label="前の月">‹</button><span>${monthTitle(month)}</span><button type="button" class="icon-btn" aria-label="次の月">›</button></span>`);
  const [prev, next] = nav.querySelectorAll("button");
  prev.addEventListener("click", () => moveMonth(-1));
  next.addEventListener("click", () => moveMonth(1));
  titleEl.appendChild(nav);

  const ws = data.settings.weekStart;
  const { from, to } = Cal.monthRange(month, ws);
  const days = Cal.itemsByDay(data.events, from, to);
  const now = today();
  const wrap = h(`<div class="cal-wrap"></div>`);
  const head = h(`<div class="cal-head" aria-hidden="true"></div>`);
  for (let i = 0; i < 7; i++) {
    const w = (ws + i) % 7;
    head.appendChild(h(`<span class="${w === 0 ? "sun" : w === 6 ? "sat" : ""}">${WEEK[w]}</span>`));
  }
  wrap.appendChild(head);

  const grid = h(`<div class="cal-grid"></div>`);
  for (const [day, items] of days) {
    const w = Cal.weekday(day);
    const hol = Cal.holidayName(day);
    const cls = ["cal-day"];
    if (day.slice(0, 7) !== month) cls.push("out");
    if (day === now) cls.push("today");
    if (day === selected) cls.push("sel");
    if (w === 0 || hol) cls.push("sun");
    else if (w === 6) cls.push("sat");
    // 3件までは全部、4件以上は2件と「+残り」
    const shown = items.length > 3 ? items.slice(0, 2) : items;
    const chips = shown.map((i) => `<span class="chip-ev" style="--ec:${colorVar(i.ev.color)}">${esc(i.ev.title)}</span>`).join("");
    const more = items.length > 3 ? `<span class="more">+${items.length - 2}</span>` : "";
    const label = `${dayLabel(day)}${hol ? " " + hol : ""}、予定${items.length}件`;
    const cell = h(`<button type="button" class="${cls.join(" ")}" aria-label="${esc(label)}"><span class="num">${Number(day.slice(8))}</span>${chips}${more}</button>`);
    cell.addEventListener("click", () => {
      selected = day;
      month = day.slice(0, 7); // 前後の月の日なら、その月へ移る
      render();
    });
    grid.appendChild(cell);
  }
  // 左右になぞって月を変える
  let sx = 0, sy = 0;
  grid.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  grid.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) moveMonth(dx < 0 ? 1 : -1);
  });
  wrap.appendChild(grid);
  view.appendChild(wrap);

  // 選んでいる日の予定
  const hol = Cal.holidayName(selected);
  const tag = dayTag(selected);
  const panel = h(`<section class="day-panel"><h2>${dayLabel(selected)}${tag ? `<span class="tag">${tag}</span>` : ""}${hol ? `<span class="hol">${esc(hol)}</span>` : ""}</h2></section>`);
  const items = days.get(selected) || [];
  if (!items.length) panel.appendChild(h(`<p class="none">予定はありません</p>`));
  for (const i of items) panel.appendChild(eventRow(i));
  view.appendChild(panel);
}

// ---------- 一覧（これからの予定・検索。仕様書 2.3） ----------
function renderList() {
  const box = h(`<label class="search">
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 15l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    <input type="search" placeholder="タイトル・メモで探す" aria-label="予定を探す" autocomplete="off" enterkeyhint="search">
  </label>`);
  const input = box.querySelector("input");
  input.value = query;
  const results = h(`<div></div>`);
  input.addEventListener("input", () => { query = input.value; paint(); });
  view.append(box, results);

  function paint() {
    results.innerHTML = "";
    const now = today();
    if (query.trim()) {
      const r = Cal.search(data.events, query, now);
      if (!r.upcoming.length && !r.past.length) {
        results.appendChild(h(`<p class="empty">見つかりませんでした</p>`));
        return;
      }
      for (const [label, list] of [["これから", r.upcoming], ["過去", r.past]]) {
        if (!list.length) continue;
        const sec = h(`<section class="day"><h3>${label}<span class="muted">${list.length}件</span></h3></section>`);
        for (const o of list) sec.appendChild(eventRow({ ...o, view: Cal.dayView(o, o.start) }, true));
        results.appendChild(sec);
      }
      return;
    }
    const groups = Cal.upcoming(data.events, now);
    if (!groups.length) {
      results.appendChild(h(`<p class="empty">これからの予定はありません<br><span class="hint">右上の「＋」で足せます</span></p>`));
      return;
    }
    for (const g of groups) {
      const hol = Cal.holidayName(g.day);
      const tag = dayTag(g.day);
      const sec = h(`<section class="day"><h3><span>${dayLabel(g.day)}${tag ? `<span class="tag">${tag}</span>` : ""}</span>${hol ? `<span class="hol">${esc(hol)}</span>` : ""}</h3></section>`);
      for (const i of g.items) sec.appendChild(eventRow(i));
      results.appendChild(sec);
    }
  }
  paint();
}

// ---------- 毎日のやること（仕様書 2.11） ----------
// いま数えている「やることの日」。チェックが外れる時刻より前なら前の日
function habitToday() {
  return Cal.habitDay(today(), new Date().getHours(), data.settings.dayStart);
}
const MARK_TEXT = { done: "できた", miss: "やらなかった", off: "お休みの曜日", before: "足す前", open: "まだ", future: "" };
const MARK_SIGN = { done: "●", miss: "×", off: "–", before: "", open: "", future: "" };
// やる曜日の書き方（毎日なら「毎日」、ほかは「月・木」。並びは週の始まりに従う）
function daysText(days) {
  if (days.length === 7) return "毎日";
  const ws = data.settings.weekStart;
  return [...days].sort((a, b) => ((a - ws + 7) % 7) - ((b - ws + 7) % 7)).map((w) => WEEK[w]).join("・");
}

function renderDaily() {
  const now = habitToday();
  shownHabitDay = now;
  if (!data.habits.length) {
    view.appendChild(h(`<p class="empty">毎日のやることはありません<br><span class="hint">右上の「＋」で足せます</span></p>`));
    return;
  }
  const w = Cal.weekday(now);
  const todays = data.habits.filter((x) => x.days.includes(w));
  const rest = data.habits.filter((x) => !x.days.includes(w));
  const left = todays.filter((x) => !x.done.includes(now)).length;
  view.appendChild(h(`<div class="hb-head"><h2>${dayLabel(now)}</h2><span class="${todays.length && !left ? "hb-all" : ""}">${!todays.length ? "今日はお休み" : left ? `あと ${left} 件` : "全部できました"}</span></div>`));

  if (todays.length) {
    const sec = h(`<section class="day hb-list"></section>`);
    for (const x of todays) sec.appendChild(habitRow(x, now, true));
    view.appendChild(sec);
  }
  if (rest.length) {
    const off = h(`<section class="day hb-list"><h3>今日はお休み</h3></section>`);
    for (const x of rest) off.appendChild(habitRow(x, now, false));
    view.appendChild(off);
  }
  view.appendChild(h(`<p class="hint hb-foot">毎日 ${data.settings.dayStart}:00 に全部のチェックが外れます（設定で変えられます）。●×は昨日までの7日です。</p>`));
}

// やることの1行。checkable なら左にチェックの箱
function habitRow(x, now, checkable) {
  const done = x.done.includes(now);
  const row = h(`<div class="hb-row${done ? " done" : ""}"></div>`);
  if (checkable) {
    const box = h(`<button type="button" class="hb-box" role="checkbox" aria-checked="${done}" aria-label="${esc(x.title)}">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`);
    box.addEventListener("click", () => toggleHabit(x, now));
    row.appendChild(box);
  } else {
    row.appendChild(h(`<span class="hb-box off" aria-hidden="true"></span>`));
  }
  // 昨日までの7日（古い順）
  const week = [];
  for (let i = 7; i >= 1; i--) {
    const d = Cal.addDays(now, -i);
    week.push({ d, m: Cal.habitMark(x, d, now) });
  }
  const done7 = week.filter((o) => o.m === "done").length, miss7 = week.filter((o) => o.m === "miss").length;
  const marks = week.map((o) => `<span class="mk ${o.m}"><span>${WEEK[Cal.weekday(o.d)]}</span><b>${MARK_SIGN[o.m]}</b></span>`).join("");
  const main = h(`<button type="button" class="hb-main" aria-label="${esc(`${x.title}の記録。昨日までの7日で、できた日 ${done7}、やらなかった日 ${miss7}`)}">
    <span class="hb-title">${esc(x.title)}${x.days.length < 7 ? `<span class="tag">${daysText(x.days)}</span>` : ""}</span>
    <span class="hb-week" aria-hidden="true">${marks}</span>
  </button>`);
  main.addEventListener("click", () => showHabitLog(x));
  row.appendChild(main);
  return row;
}

// 今日のチェックを付ける・外す（昨日より前は変えられない）
function toggleHabit(x, now) {
  const before = x.done;
  x.done = x.done.includes(now) ? x.done.filter((d) => d !== now) : [...x.done, now].sort();
  if (!commit(() => { x.done = before; })) return;
  render();
}

// ひと月の記録（やることを押すと出る）
function showHabitLog(x, key) {
  const now = habitToday();
  key = key || now.slice(0, 7);
  const wrap = h(`<div><div class="sheet-head"><h2>${esc(x.title)}</h2><button type="button" class="icon-btn" aria-label="閉じる">✕</button></div>
    <p class="hint">${daysText(x.days)}・${longDate(x.since)}から</p></div>`);
  wrap.querySelector(".icon-btn").addEventListener("click", closeSheet);
  const nav = h(`<div class="hb-mnav"><button type="button" class="icon-btn" aria-label="前の月">‹</button><span>${monthTitle(key)}</span><button type="button" class="icon-btn" aria-label="次の月">›</button></div>`);
  const [prev, next] = nav.querySelectorAll("button");
  prev.addEventListener("click", () => showHabitLog(x, shiftMonth(key, -1)));
  next.addEventListener("click", () => showHabitLog(x, shiftMonth(key, 1)));
  wrap.appendChild(nav);

  const ws = data.settings.weekStart;
  const { from, to } = Cal.monthRange(key, ws);
  const grid = h(`<div class="hb-cal"></div>`);
  for (let i = 0; i < 7; i++) {
    const w = (ws + i) % 7;
    grid.appendChild(h(`<span class="hb-wd ${w === 0 ? "sun" : w === 6 ? "sat" : ""}">${WEEK[w]}</span>`));
  }
  const count = { done: 0, miss: 0 };
  for (let d = from; d <= to; d = Cal.addDays(d, 1)) {
    if (d.slice(0, 7) !== key) { grid.appendChild(h(`<span class="hb-d blank"></span>`)); continue; }
    const m = Cal.habitMark(x, d, now);
    if (m in count) count[m]++;
    const label = `${dayLabel(d)} ${MARK_TEXT[m]}`;
    grid.appendChild(h(`<span class="hb-d ${m}${d === now ? " today" : ""}" role="img" aria-label="${esc(label)}"><span>${Number(d.slice(8))}</span><b>${MARK_SIGN[m]}</b></span>`));
  }
  wrap.appendChild(grid);
  const total = count.done + count.miss;
  wrap.appendChild(h(`<p class="hb-sum">この月　できた <b>${count.done}</b> 日・やらなかった <b>${count.miss}</b> 日${total ? `（${Math.round((count.done / total) * 100)}%）` : ""}</p>`));
  wrap.appendChild(h(`<p class="hint">今日の分は、チェックが付くまで数えません。</p>`));
  const act = h(`<div class="actions hb-act"><button type="button" class="btn">変える</button></div>`);
  act.querySelector("button").addEventListener("click", () => showHabitEditor(x));
  wrap.appendChild(act);
  openSheet(wrap);
}

// やることを足す・変える
function showHabitEditor(x) {
  const ws = data.settings.weekStart;
  const wrap = h(`<div><div class="sheet-head"><h2>${x ? "やることの変更" : "毎日のやることを足す"}</h2><button type="button" class="icon-btn" aria-label="閉じる">✕</button></div></div>`);
  wrap.querySelector(".icon-btn").addEventListener("click", closeSheet);
  const order = Array.from({ length: 7 }, (_, i) => (ws + i) % 7);
  const form = h(`<form class="entry" novalidate>
    <input class="title-in" name="title" placeholder="やること（例：薬を飲む）" maxlength="${Store.TITLE_MAX}" autocomplete="off" enterkeyhint="done">
    <div class="row-line hb-days-in"><span>やる曜日</span><span class="wd-btns">${order.map((w) => `<button type="button" data-w="${w}" class="${w === 0 ? "sun" : w === 6 ? "sat" : ""}">${WEEK[w]}</button>`).join("")}</span></div>
    ${x ? `<p class="hint">曜日を変えると、これまでの記録も新しい曜日で数え直します（外した曜日は「お休み」になります）。</p>` : ""}
    <p class="form-error" role="alert"></p>
    <div class="actions">${x ? `<button type="button" class="btn danger" data-act="del">削除</button>` : ""}<button type="submit" class="btn primary">${x ? "保存" : "足す"}</button></div>
  </form>`);
  const f = form.elements;
  f.title.value = x ? x.title : "";
  const on = new Set(x ? x.days : [0, 1, 2, 3, 4, 5, 6]);
  const btns = form.querySelectorAll(".wd-btns button");
  const paint = () => btns.forEach((b) => {
    const w = Number(b.dataset.w);
    b.classList.toggle("on", on.has(w));
    b.setAttribute("aria-pressed", String(on.has(w)));
  });
  btns.forEach((b) => b.addEventListener("click", () => {
    const w = Number(b.dataset.w);
    if (on.has(w)) on.delete(w); else on.add(w);
    paint();
  }));
  paint();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = f.title.value.trim();
    const msg = !title ? "やることを入れてください" : !on.size ? "やる曜日を1つ以上選んでください" : null;
    form.querySelector(".form-error").textContent = msg || "";
    if (msg) return;
    const days = [...on];
    const before = { habits: data.habits.slice(), startedAt: data.settings.startedAt };
    if (x) {
      const i = data.habits.indexOf(x);
      if (i < 0) return closeSheet(); // 開いているあいだに消された
      data.habits[i] = Store.cleanHabit({ ...x, title, days });
    } else {
      data.habits.push(Store.cleanHabit({ id: Store.newId(), title, days, since: habitToday(), done: [], createdAt: new Date().toISOString() }));
      if (!data.settings.startedAt) data.settings.startedAt = today();
    }
    if (!commit(() => { data.habits = before.habits; data.settings.startedAt = before.startedAt; })) return;
    closeSheet();
    render();
    toast(x ? "変えました" : "やることを足しました");
  });

  const del = form.querySelector("[data-act=del]");
  if (del) del.addEventListener("click", () => {
    if (!confirm(`「${x.title}」を消しますか？これまでの記録も消えます。`)) return;
    const i = data.habits.indexOf(x);
    if (i < 0) return closeSheet();
    data.habits.splice(i, 1);
    if (!commit(() => data.habits.splice(i, 0, x))) return;
    closeSheet();
    render();
    toast("消しました", () => {
      data.habits.splice(Math.min(i, data.habits.length), 0, x);
      save(); render();
    });
  });

  wrap.appendChild(form);
  openSheet(wrap);
  if (!x) f.title.focus();
}

// ---------- 設定 ----------
function renderSettings() {
  const ws = h(`<section class="card"><h2>週の始まり</h2>
    <div class="seg2" role="radiogroup"><button type="button" data-w="0">日曜</button><button type="button" data-w="1">月曜</button></div>
  </section>`);
  ws.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("on", Number(b.dataset.w) === data.settings.weekStart);
    b.setAttribute("aria-checked", String(Number(b.dataset.w) === data.settings.weekStart));
    b.addEventListener("click", () => { data.settings.weekStart = Number(b.dataset.w); save(); render(); });
  });
  view.appendChild(ws);

  // 毎日のやることのチェックが外れる時刻（仕様書 2.11）
  const ds = h(`<section class="card"><h2>毎日のやること</h2>
    <label class="row-line"><span>チェックが外れる時刻</span><select aria-label="チェックが外れる時刻">${Array.from({ length: 24 }, (_, i) => `<option value="${i}">${i}:00</option>`).join("")}</select></label>
    <p class="hint">この時刻に全部のチェックが外れ、チェックの無かったものは「やらなかった」になります。この時刻より前に付けたチェックは、前の日の分になります。</p>
  </section>`);
  const dsSel = ds.querySelector("select");
  dsSel.value = String(data.settings.dayStart);
  dsSel.addEventListener("change", () => {
    const before = data.settings.dayStart;
    data.settings.dayStart = Number(dsSel.value);
    if (!commit(() => { data.settings.dayStart = before; })) dsSel.value = String(before);
  });
  view.appendChild(ds);

  // バックアップ（仕様書 2.8）
  const last = data.settings.lastExport;
  const overdue = backupOverdue();
  const bk = h(`<section class="card"><h2>バックアップ</h2>
    <p class="hint">予定と毎日のやることはこの端末の中だけにあります。機種変更や万一に備えて、ときどき書き出してください（iPhone では「"ファイル"に保存」を選びます）。</p>
    <p>予定 ${data.events.length} 件・毎日のやること ${data.habits.length} 件<br>最後に書き出した日：${last ? esc(longDate(last)) : "まだありません"}</p>
    ${overdue != null ? `<p class="notice">${last ? `最後に書き出してから ${overdue} 日たっています。` : "まだ一度も書き出していません。"}</p>` : ""}
    <div class="actions"><button type="button" class="btn" data-act="import">読み込む</button><button type="button" class="btn primary" data-act="export">書き出す</button></div>
    <input type="file" accept="application/json,.json" hidden>
  </section>`);
  bk.querySelector("[data-act=export]").addEventListener("click", exportData);
  const file = bk.querySelector("input[type=file]");
  bk.querySelector("[data-act=import]").addEventListener("click", () => file.click());
  file.addEventListener("change", () => { if (file.files[0]) importData(file.files[0]); file.value = ""; });
  view.appendChild(bk);

  // 消されにくい保存になっているか（TA管理アプリと同じ文）
  const ps = h(`<section class="card"><h2>保存の状態</h2><p class="hint">確かめています…</p></section>`);
  const p = ps.querySelector("p");
  if (navigator.storage && navigator.storage.persisted) {
    navigator.storage.persisted().then((ok) => {
      p.textContent = ok
        ? "消されにくい保存になっています。"
        : "通常の保存です。ホーム画面に追加したアプリから使うと消えにくくなります。念のためバックアップも取ってください。";
    }).catch(() => { p.textContent = "確かめられませんでした。バックアップを取ってください。"; });
  } else {
    p.textContent = "このブラウザでは確認できません。バックアップを取ってください。";
  }
  view.appendChild(ps);

  view.appendChild(h(`<section class="card"><h2>このアプリについて</h2>
    <p class="hint">予定と毎日のやることはこの端末の中だけに保存され、ネットには送られません。予定の時刻の通知はありません。</p>
    <p class="hint">祝日は 2007〜2099 年に対応しています（春分の日・秋分の日は計算による予測です）。</p>
  </section>`));
}

// ---------- 下から出る画面 ----------
const sheet = document.getElementById("sheet");
const sheetBack = document.getElementById("sheet-back");
function openSheet(content) {
  sheet.innerHTML = "";
  sheet.appendChild(content);
  sheet.hidden = false; sheetBack.hidden = false;
  requestAnimationFrame(() => sheet.classList.add("open"));
}
function closeSheet() {
  sheet.classList.remove("open");
  sheet.hidden = true; sheetBack.hidden = true;
}
sheetBack.addEventListener("click", closeSheet);

// ---------- 予定の入力・変更（仕様書 2.5） ----------
// 新しい予定の既定：今日なら次の正時（23時台は 23:00）、ほかの日は 9:00 から1時間
function newDraft(date) {
  let start = "09:00";
  if (date === today()) start = pad2(Math.min(new Date().getHours() + 1, 23)) + ":00";
  const end = Cal.fromMin(Cal.toMin(date, start) + 60);
  return { title: "", start: date, end: end.date, allDay: false, startTime: start, endTime: end.time, color: "blue", memo: "", repeat: null };
}
function openNew(date) {
  showEditor(null, null, newDraft(date));
}
// occ はその予定を開いた回の開始日（「この回だけ消す」に使う）
function openEditor(id, occ) {
  const ev = data.events.find((x) => x.id === id);
  if (ev) showEditor(ev, occ, ev);
}
// 保存してある中身を写した新しい予定の入力を開く。日付は開いた回に合わせ、繰り返しは「しない」にする
function openCopy(ev, occ) {
  const end = Cal.addDays(occ, Cal.daysBetween(ev.start, ev.end));
  showEditor(null, null, { ...ev, start: occ, end, repeat: null }, true);
}

// 保存できない理由。無ければ null
function problem(v) {
  if (!v.title) return "タイトルを入れてください";
  if (!Cal.isDate(v.start) || !Cal.isDate(v.end)) return "開始と終了の日付を入れてください";
  if (!v.allDay && (!Cal.isTime(v.startTime) || !Cal.isTime(v.endTime))) return "開始と終了の時刻を入れてください";
  if (v.allDay ? v.end < v.start : Cal.toMin(v.end, v.endTime) < Cal.toMin(v.start, v.startTime)) return "終了が開始より前になっています";
  if (v.repeat && v.repeat.until !== null) {
    if (!Cal.isDate(v.repeat.until)) return "繰り返しの終わりの日を入れてください";
    if (v.repeat.until < v.start) return "繰り返しの終わりの日が、開始日より前になっています";
  }
  return null;
}

// copy なら複製（ev は null で、v に写した中身が入っている）
function showEditor(ev, occ, v, copy) {
  const wrap = h(`<div><div class="sheet-head"><h2>${ev ? "予定の変更" : copy ? "予定の複製" : "予定を足す"}</h2><button type="button" class="icon-btn" aria-label="閉じる">✕</button></div></div>`);
  wrap.querySelector(".icon-btn").addEventListener("click", closeSheet);
  if (ev && ev.repeat) wrap.appendChild(h(`<p class="hint">${FREQ_NAMES[ev.repeat.freq]}の予定です（${longDate(ev.start)}から）。ここで変えると全部の回が変わります。</p>`));
  const form = h(`<form class="entry" novalidate>
    <input class="title-in" name="title" placeholder="タイトル" maxlength="${Store.TITLE_MAX}" autocomplete="off" enterkeyhint="done">
    <label class="row-line"><span>終日</span><input type="checkbox" switch name="allDay"></label>
    <div class="row-line"><span>開始</span><span class="dt"><input type="date" name="start" aria-label="開始の日付"><input type="time" name="startTime" aria-label="開始の時刻"></span></div>
    <div class="row-line"><span>終了</span><span class="dt"><input type="date" name="end" aria-label="終了の日付"><input type="time" name="endTime" aria-label="終了の時刻"></span></div>
    <label class="row-line"><span>繰り返し</span><select name="freq"></select></label>
    <div class="until-box">
      <label class="row-line"><span>終わりの日を決める</span><input type="checkbox" switch name="hasUntil"></label>
      <div class="row-line until-date"><span>終わりの日</span><input type="date" name="until" aria-label="繰り返しの終わりの日"></div>
    </div>
    <div class="row-line"><span>色</span><span class="colors">${Store.COLORS.map((c) => `<label class="sw-c" style="--ec:var(--c-${c})"><input type="radio" name="color" value="${c}" aria-label="${COLOR_NAMES[c]}"><i></i></label>`).join("")}</span></div>
    <textarea class="memo-in" name="memo" rows="3" placeholder="メモ（なくてもよい）" maxlength="${Store.MEMO_MAX}"></textarea>
    <p class="form-error" role="alert"></p>
    <div class="actions">${ev ? `<button type="button" class="btn danger" data-act="del">削除</button><button type="button" class="btn" data-act="dup">複製</button>` : ""}<button type="submit" class="btn primary">${ev ? "保存" : "足す"}</button></div>
  </form>`);
  const f = form.elements;
  f.title.value = v.title;
  f.allDay.checked = v.allDay;
  f.start.value = v.start;
  f.end.value = v.end;
  f.startTime.value = v.startTime || "09:00"; // 終日の予定でも、時刻付きに切り替えたときの既定を入れておく
  f.endTime.value = v.endTime || "10:00";
  f.hasUntil.checked = !!(v.repeat && v.repeat.until);
  f.until.value = (v.repeat && v.repeat.until) || v.start;
  f.memo.value = v.memo || "";
  form.querySelector(`input[name=color][value=${Store.COLORS.includes(v.color) ? v.color : "blue"}]`).checked = true;

  // 繰り返しの選択肢に、開始日から作った中身を添える（例「毎週（土曜）」）
  const paintFreq = () => {
    const s = Cal.isDate(f.start.value) ? f.start.value : v.start;
    const [, m, d] = s.split("-").map(Number);
    const w = WEEK[Cal.weekday(s)];
    const names = { daily: "毎日", weekly: `毎週（${w}曜）`, biweekly: `2週ごと（${w}曜）`, monthly: `毎月（${d}日）`,
      monthlyNth: `毎月（第${Cal.nthOfMonth(s)}${w}曜）`, monthlyLast: `毎月（最終${w}曜）`, yearly: `毎年（${m}月${d}日）` };
    const ok = Cal.freqsFor(s);
    let cur = f.freq.value || (v.repeat ? v.repeat.freq : "none");
    // 開始日を動かして選べなくなった「第◯曜」「最終曜」は、選べるほうへ移す
    if (cur !== "none" && !ok.includes(cur)) cur = cur === "monthlyNth" ? "monthlyLast" : cur === "monthlyLast" ? "monthlyNth" : "none";
    f.freq.innerHTML = `<option value="none">しない</option>` + ok.map((k) => `<option value="${k}">${names[k]}</option>`).join("");
    f.freq.value = cur;
  };
  const paint = () => {
    form.classList.toggle("all-day", f.allDay.checked);
    form.querySelector(".until-box").hidden = f.freq.value === "none";
    form.querySelector(".until-date").hidden = !f.hasUntil.checked;
  };
  paintFreq();
  paint();

  // 開始を動かしたら、終了も同じだけ動かす（予定の長さを保つ）
  const startKey = () => {
    if (!Cal.isDate(f.start.value)) return null;
    return Cal.toMin(f.start.value, !f.allDay.checked && Cal.isTime(f.startTime.value) ? f.startTime.value : "00:00");
  };
  let prevStart = startKey();
  const onStart = () => {
    const now = startKey();
    if (now !== null && prevStart !== null && Cal.isDate(f.end.value)) {
      const timed = !f.allDay.checked && Cal.isTime(f.endTime.value);
      const e = Cal.fromMin(Cal.toMin(f.end.value, timed ? f.endTime.value : "00:00") + now - prevStart);
      f.end.value = e.date;
      if (timed) f.endTime.value = e.time;
    }
    prevStart = now;
    paintFreq();
  };
  f.start.addEventListener("change", onStart);
  f.startTime.addEventListener("change", onStart);
  f.allDay.addEventListener("change", () => { prevStart = startKey(); paint(); });
  f.freq.addEventListener("change", paint);
  f.hasUntil.addEventListener("change", paint);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const allDay = f.allDay.checked;
    const out = {
      title: f.title.value.trim(),
      start: f.start.value,
      end: f.end.value,
      allDay,
      startTime: allDay ? null : f.startTime.value,
      endTime: allDay ? null : f.endTime.value,
      color: f.color.value || "blue",
      memo: f.memo.value.replace(/\s+$/, ""),
      repeat: f.freq.value === "none" ? null : { freq: f.freq.value, until: f.hasUntil.checked ? f.until.value : null },
    };
    const msg = problem(out);
    form.querySelector(".form-error").textContent = msg || "";
    if (msg) return;
    const before = { events: data.events.slice(), startedAt: data.settings.startedAt };
    if (ev) {
      const i = data.events.indexOf(ev);
      if (i < 0) return closeSheet(); // 開いているあいだに消された
      // 開始日か繰り返しの種類が変わったら、「この回だけ消す」の記録は捨てる（別の回を誤って隠さないため）
      const moved = ev.start !== out.start || (ev.repeat ? ev.repeat.freq : null) !== (out.repeat ? out.repeat.freq : null);
      data.events[i] = Store.clean({ ...ev, ...out, skips: moved ? [] : ev.skips });
    } else {
      data.events.push(Store.clean({ id: Store.newId(), ...out, skips: [], createdAt: new Date().toISOString() }));
      if (!data.settings.startedAt) data.settings.startedAt = today();
    }
    if (!commit(() => { data.events = before.events; data.settings.startedAt = before.startedAt; })) return;
    closeSheet();
    // 足した予定・繰り返さない予定は、その日をカレンダーで選ぶ（繰り返しの回から開いたときは動かさない）
    if (!ev || !out.repeat) { selected = out.start; month = out.start.slice(0, 7); }
    render();
    toast(ev ? "変えました" : "予定を足しました");
  });

  const dup = form.querySelector("[data-act=dup]");
  if (dup) dup.addEventListener("click", () => openCopy(ev, occ));

  const del = form.querySelector("[data-act=del]");
  if (del) {
    del.addEventListener("click", () => {
      if (!ev.repeat) {
        if (confirm(`「${ev.title}」を消しますか？`)) removeEvent(ev);
        return;
      }
      // 繰り返しの予定は、この回だけか全部かを選ぶ
      const actions = form.querySelector(".actions");
      const box = h(`<div class="del-choice"><p>繰り返しの予定です。どれを消しますか？</p>
        <button type="button" class="btn danger" data-c="one">この回だけ消す（${dayLabel(occ)}）</button>
        <button type="button" class="btn danger" data-c="all">全部消す</button>
        <button type="button" class="btn" data-c="cancel">やめる</button>
      </div>`);
      box.querySelector("[data-c=one]").addEventListener("click", () => skipOne(ev, occ));
      box.querySelector("[data-c=all]").addEventListener("click", () => removeEvent(ev));
      box.querySelector("[data-c=cancel]").addEventListener("click", () => box.replaceWith(actions));
      actions.replaceWith(box);
    });
  }

  wrap.appendChild(form);
  openSheet(wrap);
  if (!ev) f.title.focus();
}

function removeEvent(ev) {
  const i = data.events.indexOf(ev);
  if (i < 0) return;
  data.events.splice(i, 1);
  if (!commit(() => data.events.splice(i, 0, ev))) return;
  closeSheet();
  render();
  toast("消しました", () => {
    data.events.splice(Math.min(i, data.events.length), 0, ev);
    save(); render();
  });
}
function skipOne(ev, occ) {
  const before = ev.skips;
  ev.skips = [...new Set([...ev.skips, occ])].sort();
  if (!commit(() => { ev.skips = before; })) return;
  closeSheet();
  render();
  toast(`${dayLabel(occ)}の回を消しました`, () => {
    ev.skips = ev.skips.filter((d) => d !== occ);
    save(); render();
  });
}

// ---------- バックアップ（仕様書 2.8） ----------
const BACKUP_DAYS = 30; // 最後に書き出してから（まだなら使い始めてから）この日数で知らせる
const BACKUP_ASK_AGAIN = 7; // 「あとで」を選んだら、次に知らせるまでの日数
// 書き出していない日数。知らせる時期でなければ null
function backupOverdue() {
  if (!data.events.length && !data.habits.length) return null;
  const base = data.settings.lastExport || data.settings.startedAt;
  if (!base) return null;
  const n = Cal.daysBetween(base, today());
  return n >= BACKUP_DAYS ? n : null;
}
function maybeAskBackup() {
  const n = backupOverdue();
  if (n == null || !sheet.hidden) return; // ほかの画面が開いていたら、次に開いたときに回す
  const asked = data.settings.backupAskedAt;
  if (asked && Cal.daysBetween(asked, today()) < BACKUP_ASK_AGAIN) return;
  data.settings.backupAskedAt = today();
  save();
  const wrap = h(`<div><div class="sheet-head"><h2>バックアップしませんか</h2><button type="button" class="icon-btn" aria-label="閉じる">✕</button></div>
    <p>${data.settings.lastExport ? `最後に書き出してから ${n} 日たちました。` : `使い始めてから ${n} 日、まだ一度も書き出していません。`}</p>
    <p class="hint">予定はこの端末の中にしかありません。機種変更や故障のときに消えないよう、ファイルに書き出しておくと安心です（iPhone では「"ファイル"に保存」を選びます）。</p>
    <div class="actions"><button type="button" class="btn" data-act="later">あとで</button><button type="button" class="btn primary" data-act="export">書き出す</button></div></div>`);
  wrap.querySelector(".icon-btn").addEventListener("click", closeSheet);
  wrap.querySelector("[data-act=later]").addEventListener("click", closeSheet);
  // 共有シートは押した直後でないと開かないので、先に書き出しを始めてから閉じる
  wrap.querySelector("[data-act=export]").addEventListener("click", () => { exportData(); closeSheet(); });
  openSheet(wrap);
}

async function exportData() {
  const payload = JSON.stringify({ app: "yoteicho", exportedAt: new Date().toISOString(), ...data }, null, 1);
  const name = `予定帳_${today()}.json`;
  const file = new File([payload], name, { type: "application/json" });
  try {
    // iPhone では共有シートが開き、「"ファイル"に保存」や AirDrop で逃がせる
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }
    data.settings.lastExport = today();
    save();
    if (tab === "settings") render();
  } catch (e) {
    if (!isCancel(e)) toast("書き出しに失敗しました");
  }
}

async function importData(f) {
  let incoming;
  try {
    incoming = JSON.parse(await f.text());
  } catch (e) {
    return toast("読み込めないファイルです");
  }
  if (!incoming || incoming.app !== "yoteicho" || !Array.isArray(incoming.events)) return toast("予定帳の書き出しファイルではありません");
  const r = Store.merge(data, incoming, today());
  save();
  render();
  toast(`予定 ${r.added} 件` + (r.habits ? `・毎日のやること ${r.habits} 件` : "") + "を足しました" + (r.skipped ? `（同じ予定 ${r.skipped} 件は飛ばしました）` : "") + (r.broken ? `　壊れた予定 ${r.broken} 件は読めませんでした` : ""));
}

// ---------- 起動 ----------
Store.init().then(() => {
  data = Store.load();
  render();
  setTimeout(maybeAskBackup, 600);
  // ホーム画面のアプリは閉じずに裏へ回るだけのことが多いので、戻ってきたときにも確かめる
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const now = today();
    if (now !== shownToday) {
      // 開いたまま日をまたいだら、今日の印と「これから」を新しい今日に合わせる
      if (selected === shownToday) { selected = now; month = now.slice(0, 7); }
      shownToday = now;
      render();
    } else if (tab === "daily" && habitToday() !== shownHabitDay) render();
    setTimeout(maybeAskBackup, 600);
  });
  // 開いたまま、チェックが外れる時刻をまたいだとき
  setInterval(() => {
    if (document.visibilityState === "visible" && sheet.hidden && tab === "daily" && habitToday() !== shownHabitDay) render();
  }, 30000);
});

// 消されにくい保存をお願いする（iPhone ではホーム画面から開いたときに効く）
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// 電波がなくても開けるようにする仕組み（サービスワーカー）。パソコンで試すとき（http）は使わない
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js");
}
