// 画面の切り替えと4つのタブ（カレンダー・一覧・毎日・設定）、予定と毎日のやることの入力の画面。
let data; // いちばん下で Store.init() を待ってから入れる
const view = document.getElementById("view");
const titleEl = document.getElementById("title");
const leftEl = document.getElementById("tb-left");
const addBtn = document.getElementById("add");
const TAB_NAMES = { cal: "カレンダー", list: "一覧", daily: "毎日", settings: "設定" }; // 下のタブの名前
const TITLES = { cal: "カレンダー", list: "一覧", daily: "毎日のやること", settings: "設定" };
const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
const FREQ_NAMES = { daily: "毎日", weekly: "毎週", biweekly: "2週ごと", monthly: "毎月", monthlyNth: "毎月", monthlyLast: "毎月", yearly: "毎年" };
const COLOR_NAMES = { red: "赤", orange: "橙", yellow: "黄", green: "緑", cyan: "水色", blue: "青", purple: "紫", gray: "灰" };
// 共有シートを閉じただけのとき
const isCancel = (e) => e?.name === "AbortError";
const pad2 = (n) => String(n).padStart(2, "0"); // すぐ下で today() が使うので、先に置く

let tab = "cal"; // 起動したら、並びのいちばん左のタブにする（仕様書 D25）
let month = today().slice(0, 7); // カレンダーで見ている月
let selected = today(); // カレンダーで選んでいる日
let query = ""; // 一覧の検索欄
let shownToday = today(); // 開いたまま日をまたいだかを見る
let shownHabitDay = null; // 毎日のタブで出しているやることの日（チェックが外れる時刻をまたいだかを見る）
let habitSorting = false; // 毎日のタブで並べ替えをしているか（仕様書 D30）
const colorFilter = new Set(); // 色の絞り込み（仕様書 D34）。空なら全部の色。保存せず、開き直したら全部に戻る
let calMode = "month"; // カレンダーの「月／週」（仕様書 D33）
let weekScroll = null; // 週の表示の時刻の欄の位置（描き直しても動かさないため）

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
// 「◯月中」の予定の回の呼び名（"2026-11-01" → 「11月中」）
const monthLabel = (date) => `${Number(date.slice(5, 7))}月中`;
// 週の範囲（"2026-10-25" → 「10/25〜10/31」）と、「◯週中」の予定の回の呼び名（「10/25〜10/31の週中」）
const weekRange = (from) => `${shortDate(from)}〜${shortDate(Cal.addDays(from, 6))}`;
const weekLabel = (from) => `${weekRange(from)}の週中`;
// 回の呼び名（「この回だけ消す」などに使う）
const occLabel = (ev, occ) => (ev.inMonth ? monthLabel(occ) : ev.inWeek ? weekLabel(occ) : dayLabel(occ));
// 色の絞り込みをかけた予定（仕様書 D34）
const shownEvents = () => (colorFilter.size ? data.events.filter((e) => colorFilter.has(e.color)) : data.events);
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
    habitSorting = false;
    render();
    window.scrollTo(0, 0);
  });
});
addBtn.addEventListener("click", () => {
  if (!data) return;
  if (tab === "daily") showHabitEditor(null);
  else openNew(tab === "cal" ? selected : today());
});

// 下のタブを設定の並びに置き直す（仕様書 D24）
function applyTabOrder() {
  const nav = document.querySelector(".tabs");
  for (const t of data.settings.tabOrder) nav.appendChild(nav.querySelector(`[data-tab=${t}]`));
}

function render() {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  addBtn.hidden = tab === "settings";
  leftEl.innerHTML = "";
  titleEl.textContent = TITLES[tab];
  view.innerHTML = "";
  ({ cal: renderCal, list: renderList, daily: renderDaily, settings: renderSettings })[tab]();
  updateBadge();
}

// 色の丸を並べた絞り込みの欄（カレンダーと一覧の上。仕様書 D34）。押した色だけを出し、もう一度押すと外す
function colorBar() {
  const bar = h(`<div class="cfilter${colorFilter.size ? " some" : ""}" role="group" aria-label="色で絞り込む"></div>`);
  for (const c of Store.COLORS) {
    const on = colorFilter.has(c);
    const b = h(`<button type="button" class="cf${on ? " on" : ""}" style="--ec:var(--c-${c})" aria-pressed="${on}" aria-label="${COLOR_NAMES[c]}の予定だけ出す"><i></i></button>`);
    b.addEventListener("click", () => {
      if (on) colorFilter.delete(c); else colorFilter.add(c);
      render();
    });
    bar.appendChild(b);
  }
  if (colorFilter.size) {
    const all = h(`<button type="button" class="link cf-all">全部</button>`);
    all.addEventListener("click", () => { colorFilter.clear(); render(); });
    bar.appendChild(all);
  }
  return bar;
}

// ---------- 予定の1行（カレンダーの下・一覧で共通） ----------
// item は { ev, start, end, view }（その日の見え方 view は Cal.dayView）。withDate なら日付も添える（検索の結果）
function eventRow(item, withDate) {
  const { ev, view: v } = item;
  const vague = ev.inMonth || ev.inWeek; // 日を決めない予定（◯月中・◯週中）
  let t1 = ev.inMonth ? "月中" : ev.inWeek ? "週中" : "終日", t2 = "";
  if (!v.allDay && !vague) {
    t1 = v.from ? fmtTime(v.from) : "〜";
    t2 = v.to ? fmtTime(v.to) : "〜";
  }
  const tags = [];
  if (withDate) tags.push(occLabel(ev, item.start));
  if (withDate && !vague && dayTag(item.start)) tags.push(dayTag(item.start));
  if (item.start !== item.end && !vague) tags.push(`${shortDate(item.start)}〜${shortDate(item.end)}`);
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
// 週の表示で、前後の週へ（選んでいる日も同じだけ動かす）
function moveWeek(n) {
  selected = Cal.addDays(selected, n * 7);
  month = selected.slice(0, 7);
  render();
}
// 左右になぞって前後へ動かす
function onSwipe(el, move) {
  let sx = 0, sy = 0;
  el.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  el.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
  });
}
// 「この週中」の欄（仕様書 2.13）。無ければ何も出さない
function weekPanel(evs, day) {
  const items = Cal.weekItems(evs, day, data.settings.weekStart);
  if (!items.length) return;
  const wp = h(`<section class="day-panel week-panel"><h2>この週中<span class="muted">${weekRange(Cal.weekFrom(day, data.settings.weekStart))}</span></h2></section>`);
  for (const i of items) wp.appendChild(eventRow(i));
  view.appendChild(wp);
}

function renderCal() {
  const back = h(`<button type="button" class="link">今日</button>`);
  back.addEventListener("click", () => { month = today().slice(0, 7); selected = today(); weekScroll = null; render(); });
  leftEl.appendChild(back);
  titleEl.innerHTML = "";
  const week = calMode === "week";
  const ws = data.settings.weekStart;
  const label = week ? weekRange(Cal.weekFrom(selected, ws)) : monthTitle(month);
  const unit = week ? "週" : "月";
  const nav = h(`<span class="mnav"><button type="button" class="icon-btn" aria-label="前の${unit}">‹</button><span>${label}</span><button type="button" class="icon-btn" aria-label="次の${unit}">›</button></span>`);
  const [prev, next] = nav.querySelectorAll("button");
  const move = week ? moveWeek : moveMonth;
  prev.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  titleEl.appendChild(nav);

  // 「月／週」の切り替えと色の絞り込み（仕様書 D33・D34）
  const tools = h(`<div class="cal-tools"><div class="seg2 seg-sm" role="radiogroup" aria-label="表示"><button type="button" data-m="month">月</button><button type="button" data-m="week">週</button></div></div>`);
  tools.querySelectorAll(".seg2 button").forEach((b) => {
    const on = b.dataset.m === calMode;
    b.classList.toggle("on", on);
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(on));
    b.addEventListener("click", () => { calMode = b.dataset.m; weekScroll = null; render(); });
  });
  tools.appendChild(colorBar());
  view.appendChild(tools);
  if (week) return renderWeek();

  const evs = shownEvents();
  const { from, to } = Cal.monthRange(month, ws);
  const days = Cal.itemsByDay(evs, from, to);
  const now = today();
  // 「◯月中」の予定は月の表のすぐ上（仕様書 2.12）
  const inMonth = Cal.monthItems(evs, month);
  if (inMonth.length) {
    const mp = h(`<section class="day-panel month-panel"><h2>${monthLabel(month + "-01")}</h2></section>`);
    for (const i of inMonth) mp.appendChild(eventRow(i));
    view.appendChild(mp);
  }
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
    if (data.notes[day]) cls.push("has-note"); // ひとことメモがある日の印（仕様書 2.14）
    // 3件までは全部、4件以上は2件と「+残り」
    const shown = items.length > 3 ? items.slice(0, 2) : items;
    const chips = shown.map((i) => `<span class="chip-ev" style="--ec:${colorVar(i.ev.color)}">${esc(i.ev.title)}</span>`).join("");
    const more = items.length > 3 ? `<span class="more">+${items.length - 2}</span>` : "";
    const label = `${dayLabel(day)}${hol ? " " + hol : ""}、予定${items.length}件${data.notes[day] ? "、メモあり" : ""}`;
    const cell = h(`<button type="button" class="${cls.join(" ")}" data-day="${day}" aria-label="${esc(label)}"><span class="num">${Number(day.slice(8))}</span>${chips}${more}</button>`);
    cell.addEventListener("click", () => {
      selected = day;
      month = day.slice(0, 7); // 前後の月の日なら、その月へ移る
      render();
    });
    grid.appendChild(cell);
  }
  onSwipe(grid, moveMonth); // 左右になぞって月を変える
  wrap.appendChild(grid);
  view.appendChild(wrap);

  // 選んでいる日を含む週の「◯週中」の予定は、その日の予定の上（仕様書 2.13）
  weekPanel(evs, selected);
  // 選んでいる日の予定
  const hol = Cal.holidayName(selected);
  const tag = dayTag(selected);
  const panel = h(`<section class="day-panel"><h2>${dayLabel(selected)}${tag ? `<span class="tag">${tag}</span>` : ""}${hol ? `<span class="hol">${esc(hol)}</span>` : ""}</h2></section>`);
  panel.appendChild(noteInput(selected));
  const items = days.get(selected) || [];
  if (!items.length) panel.appendChild(h(`<p class="none">予定はありません</p>`));
  for (const i of items) panel.appendChild(eventRow(i));
  view.appendChild(panel);
}

// ---------- ひとことメモ（仕様書 2.14） ----------
// 選んだ日の見出しのすぐ下の1行の欄。打ち終えた（欄を離れた）ときに保存する
function noteInput(day) {
  const input = h(`<input class="note-in" type="text" placeholder="ひとことメモ" maxlength="${Store.NOTE_MAX}" autocomplete="off" enterkeyhint="done" aria-label="${dayLabel(day)}のひとことメモ">`);
  input.value = data.notes[day] || "";
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
  input.addEventListener("change", () => { input.value = saveNote(day, input.value); });
  return input;
}
// 保存して、残った文を返す（保存できなければ前の文）。
// 画面は描き直さず、カレンダーの日の枠の印だけ変える（欄を離れたのが日の枠を押したときなら、描き直すとその押した分が消えるため）
function saveNote(day, text) {
  const t = Store.cleanNote(text), before = data.notes[day] || "", startedAt = data.settings.startedAt;
  if (t === before) return t;
  if (t) data.notes[day] = t; else delete data.notes[day];
  if (t && !data.settings.startedAt) data.settings.startedAt = today();
  if (!commit(() => { if (before) data.notes[day] = before; else delete data.notes[day]; data.settings.startedAt = startedAt; })) return before;
  const cell = view.querySelector(`.cal-day[data-day="${day}"]`);
  if (cell) cell.classList.toggle("has-note", !!t);
  return t;
}

// ---------- 週の表示（仕様書 2.15） ----------
const HOUR_PX = 44; // 1時間の高さ
const minOf = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
function renderWeek() {
  const ws = data.settings.weekStart, now = today();
  const from = Cal.weekFrom(selected, ws), to = Cal.addDays(from, 6);
  const evs = shownEvents();
  const days = Cal.itemsByDay(evs, from, to);
  weekPanel(evs, selected);

  const wv = h(`<div class="wv"></div>`);
  // 日付の段。押すとその日を選ぶ（右上の「＋」はその日の予定になる）
  const head = h(`<div class="wv-row wv-head"><span class="wv-gut"></span></div>`);
  for (const day of days.keys()) {
    const w = Cal.weekday(day), hol = Cal.holidayName(day);
    const cls = ["wv-day"];
    if (w === 0 || hol) cls.push("sun"); else if (w === 6) cls.push("sat");
    if (day === now) cls.push("today");
    if (day === selected) cls.push("sel");
    const b = h(`<button type="button" class="${cls.join(" ")}" aria-label="${esc(dayLabel(day) + (hol ? " " + hol : ""))}"><span>${WEEK[w]}</span><span class="num">${Number(day.slice(8))}</span></button>`);
    b.addEventListener("click", () => { selected = day; month = day.slice(0, 7); render(); });
    head.appendChild(b);
  }
  wv.appendChild(head);
  // 終日の段（何日かにまたがる時刻付きの予定の、間の日も入る）。どの日にも無ければ出さない
  if ([...days.values()].some((l) => l.some((i) => i.view.allDay))) {
    const ad = h(`<div class="wv-row wv-allday"><span class="wv-gut">終日</span></div>`);
    for (const [day, list] of days) {
      const col = h(`<div class="wv-adcol"></div>`);
      for (const i of list.filter((x) => x.view.allDay)) {
        const c = h(`<button type="button" class="chip-ev" style="--ec:${colorVar(i.ev.color)}">${esc(i.ev.title)}</button>`);
        c.addEventListener("click", () => openEditor(i.ev.id, i.start));
        col.appendChild(c);
      }
      ad.appendChild(col);
    }
    wv.appendChild(ad);
  }
  // 時刻の欄。0〜24時を縦に並べ、なぞって動かす
  const body = h(`<div class="wv-body"><div class="wv-grid" style="height:${HOUR_PX * 24}px"><div class="wv-gut"></div></div></div>`);
  const grid = body.firstElementChild;
  const gut = grid.firstElementChild;
  for (let hr = 1; hr < 24; hr++) gut.appendChild(h(`<span style="top:${hr * HOUR_PX}px">${hr}:00</span>`));
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  for (const [day, list] of days) {
    const col = h(`<div class="wv-col${day === selected ? " sel" : ""}"></div>`);
    const timed = list.filter((i) => !i.view.allDay).map((i) => {
      const a = i.view.from ? minOf(i.view.from) : 0;
      const b = i.view.to ? minOf(i.view.to) : 1440;
      return { i, a, b: Math.min(1440, Math.max(b, a + 20)) }; // 短い予定も押せる高さにする
    });
    for (const p of Cal.layoutDay(timed)) {
      const { i } = p;
      const time = i.view.from ? fmtTime(i.view.from) : "〜" + fmtTime(i.view.to);
      const b = h(`<button type="button" class="wv-ev" style="--ec:${colorVar(i.ev.color)};top:${(p.a / 60) * HOUR_PX}px;height:${((p.b - p.a) / 60) * HOUR_PX - 1}px;left:${(p.col / p.cols) * 100}%;width:${100 / p.cols}%"><b>${esc(i.ev.title)}</b><span>${time}</span></button>`);
      b.addEventListener("click", () => openEditor(i.ev.id, i.start));
      col.appendChild(b);
    }
    if (day === now) col.appendChild(h(`<span class="wv-now" style="top:${(nowMin / 60) * HOUR_PX}px"></span>`));
    // 空いている所を押すと、その時刻（正時）から始まる予定を足す
    col.addEventListener("click", (e) => {
      if (e.target !== col) return;
      const hr = Math.min(23, Math.floor(e.offsetY / HOUR_PX));
      openNew(day, pad2(hr) + ":00");
    });
    grid.appendChild(col);
  }
  body.addEventListener("scroll", () => { weekScroll = body.scrollTop; }, { passive: true });
  wv.appendChild(body);
  onSwipe(wv, moveWeek); // 左右になぞって週を変える
  view.appendChild(wv);
  // 時刻の欄の高さを画面の残りに合わせ、最初は朝7時ごろから見せる
  const fit = () => {
    const tabs = document.querySelector(".tabs").offsetHeight;
    const top = body.getBoundingClientRect().top + window.scrollY;
    body.style.height = Math.max(240, window.innerHeight - top - tabs - 8) + "px";
  };
  fit();
  body.scrollTop = weekScroll ?? 7 * HOUR_PX;
}
window.addEventListener("resize", () => { if (data && tab === "cal" && calMode === "week") render(); });

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
  view.append(box, colorBar(), results);

  function paint() {
    results.innerHTML = "";
    const now = today();
    const evs = shownEvents();
    if (query.trim()) {
      const r = Cal.search(evs, query, now);
      // ひとことメモも探す（色の絞り込みはかけない。仕様書 2.14）
      const notes = Cal.searchNotes(data.notes, query);
      if (!r.upcoming.length && !r.past.length && !notes.length) {
        results.appendChild(h(`<p class="empty">見つかりませんでした</p>`));
        return;
      }
      for (const [label, list] of [["これから", r.upcoming], ["過去", r.past]]) {
        if (!list.length) continue;
        const sec = h(`<section class="day"><h3>${label}<span class="muted">${list.length}件</span></h3></section>`);
        for (const o of list) sec.appendChild(eventRow({ ...o, view: Cal.dayView(o, o.start) }, true));
        results.appendChild(sec);
      }
      if (notes.length) {
        const sec = h(`<section class="day"><h3>ひとことメモ<span class="muted">${notes.length}件</span></h3></section>`);
        for (const n of notes) {
          // 押すと、カレンダーでその日を開く
          const row = h(`<button type="button" class="ev-row note-row"><span class="ev-main"><span class="ev-sub"><span class="tag">${esc(longDate(n.day))}（${WEEK[Cal.weekday(n.day)]}）</span></span><span class="ev-title">${esc(n.text)}</span></span></button>`);
          row.addEventListener("click", () => { tab = "cal"; calMode = "month"; selected = n.day; month = n.day.slice(0, 7); render(); window.scrollTo(0, 0); });
          sec.appendChild(row);
        }
        results.appendChild(sec);
      }
      return;
    }
    const groups = Cal.upcoming(evs, now);
    if (!groups.length) {
      results.appendChild(h(`<p class="empty">これからの予定はありません<br><span class="hint">右上の「＋」で足せます</span></p>`));
      return;
    }
    for (const g of groups) {
      if (g.week) {
        const cur = g.week <= now;
        const sec = h(`<section class="day"><h3><span>${weekLabel(g.week)}${cur ? `<span class="tag">今週</span>` : ""}</span></h3></section>`);
        for (const i of g.items) sec.appendChild(eventRow(i));
        results.appendChild(sec);
        continue;
      }
      if (g.month) {
        const cur = g.month === now.slice(0, 7);
        const sec = h(`<section class="day"><h3><span>${monthLabel(g.month + "-01")}${cur ? `<span class="tag">今月</span>` : ""}</span></h3></section>`);
        for (const i of g.items) sec.appendChild(eventRow(i));
        results.appendChild(sec);
        continue;
      }
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
// ホーム画面のアイコンに、今日のやることの残りの数を出す（仕様書 2.16）。切ってあれば消す。
// 使えない開き方（Safari のタブ・パソコンなど）では何もしない
function updateBadge() {
  if (!("setAppBadge" in navigator)) return;
  const now = habitToday(), ws = data.settings.weekStart;
  const n = data.settings.badge ? data.habits.filter((x) => Cal.habitLeft(x, now, ws)).length : 0;
  (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}
const MARK_TEXT = { done: "できた", miss: "やらなかった", off: "お休みの曜日", before: "足す前", open: "まだ", future: "", free: "" };
const MARK_SIGN = { done: "●", miss: "×", off: "–", before: "", open: "", future: "", free: "" };
// やる日の書き方（週◯回なら「週3回」、毎日なら「毎日」、ほかは「月・木」。曜日の並びは週の始まりに従う）
function planText(x) {
  if (x.perWeek) return `週${x.perWeek}回`;
  if (x.days.length === 7) return "毎日";
  const ws = data.settings.weekStart;
  return [...x.days].sort((a, b) => ((a - ws + 7) % 7) - ((b - ws + 7) % 7)).map((w) => WEEK[w]).join("・");
}

function renderDaily() {
  const now = habitToday();
  shownHabitDay = now;
  if (!data.habits.length) {
    view.appendChild(h(`<p class="empty">毎日のやることはありません<br><span class="hint">右上の「＋」で足せます</span></p>`));
    return;
  }
  // 並べ替え（仕様書 D30）。押したときだけ ↑↓ を出す
  if (data.habits.length > 1) {
    const sortBtn = h(`<button type="button" class="link sm">${habitSorting ? "完了" : "並べ替え"}</button>`);
    sortBtn.addEventListener("click", () => { habitSorting = !habitSorting; render(); });
    leftEl.appendChild(sortBtn);
  }
  if (habitSorting) return renderHabitSort();
  const w = Cal.weekday(now), ws = data.settings.weekStart;
  // 週◯回のものは、どの曜日も今日の一覧に出す
  const todays = data.habits.filter((x) => x.perWeek || x.days.includes(w));
  const rest = data.habits.filter((x) => !x.perWeek && !x.days.includes(w));
  const left = data.habits.filter((x) => Cal.habitLeft(x, now, ws)).length;
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
  const weekly = data.habits.some((x) => x.perWeek) ? `週◯回のものは${WEEK[ws]}曜から数えます。` : "";
  view.appendChild(h(`<p class="hint hb-foot">毎日 ${data.settings.dayStart}:00 に全部のチェックが外れます（設定で変えられます）。●×は昨日までの7日です。${weekly}</p>`));
}

// 並べ替えの画面。ここでの並びが毎日のタブの並びになる
function renderHabitSort() {
  const card = h(`<section class="card"><h2>並べ替え</h2><div class="tab-order"></div><p class="hint">↑↓で動かし、終わったら左上の「完了」を押します。</p></section>`);
  const list = card.querySelector(".tab-order");
  const n = data.habits.length;
  data.habits.forEach((x, i) => {
    const row = h(`<div class="to-row"><span>${esc(x.title)}</span>
      <button type="button" class="icon-btn" data-d="-1" aria-label="${esc(x.title)}を上へ"${i === 0 ? " disabled" : ""}>↑</button>
      <button type="button" class="icon-btn" data-d="1" aria-label="${esc(x.title)}を下へ"${i === n - 1 ? " disabled" : ""}>↓</button></div>`);
    row.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      const before = data.habits.slice();
      const j = i + Number(b.dataset.d);
      [data.habits[i], data.habits[j]] = [data.habits[j], data.habits[i]];
      if (!commit(() => { data.habits = before; })) return;
      render();
    }));
    list.appendChild(row);
  });
  view.appendChild(card);
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
  // 今日チェックを付けた時刻（今日の行だけ。D28）
  const at = checkable && done && x.doneAt[now] ? Cal.habitTimeText(now, x.doneAt[now]) : "";
  let status, summary;
  if (x.perWeek) {
    // 週◯回：今週の回数（D31）
    const r = Cal.habitWeek(x, now, now, data.settings.weekStart);
    status = `<span class="hb-goal${r.mark === "done" ? " ok" : ""}" aria-hidden="true">今週 ${r.count}/${x.perWeek}回${r.mark === "done" ? " できた" : ""}</span>`;
    summary = `今週 ${x.perWeek}回のうち ${r.count}回`;
  } else {
    // 昨日までの7日（古い順）
    const week = [];
    for (let i = 7; i >= 1; i--) {
      const d = Cal.addDays(now, -i);
      week.push({ d, m: Cal.habitMark(x, d, now) });
    }
    const done7 = week.filter((o) => o.m === "done").length, miss7 = week.filter((o) => o.m === "miss").length;
    status = `<span class="hb-week" aria-hidden="true">${week.map((o) => `<span class="mk ${o.m}"><span>${WEEK[Cal.weekday(o.d)]}</span><b>${MARK_SIGN[o.m]}</b></span>`).join("")}</span>`;
    summary = `昨日までの7日で、できた日 ${done7}、やらなかった日 ${miss7}`;
  }
  const main = h(`<button type="button" class="hb-main" aria-label="${esc(`${x.title}の記録。${at ? `今日は ${at} にできた。` : ""}${summary}`)}">
    <span class="hb-title">${esc(x.title)}${x.perWeek || x.days.length < 7 ? `<span class="tag">${planText(x)}</span>` : ""}</span>
    ${at ? `<span class="hb-at" aria-hidden="true">${at} にできた</span>` : ""}
    ${status}
  </button>`);
  main.addEventListener("click", () => showHabitLog(x));
  row.appendChild(main);
  return row;
}

// 今日のチェックを付ける・外す（昨日より前は変えられない）
// 付けたときはその時刻も残す（外したら消し、付け直したら新しい時刻にする）
function toggleHabit(x, now) {
  const before = x.done, beforeAt = x.doneAt;
  const at = { ...x.doneAt };
  if (x.done.includes(now)) {
    x.done = x.done.filter((d) => d !== now);
    delete at[now];
  } else {
    x.done = [...x.done, now].sort();
    const t = new Date();
    at[now] = `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}T${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
  }
  x.doneAt = at;
  if (!commit(() => { x.done = before; x.doneAt = beforeAt; })) return;
  render();
}

// 記録（やることを押すと出る）。key は月なら "YYYY-MM"、年なら "YYYY"（「月／年」の切り替え。D32）
function showHabitLog(x, key) {
  const now = habitToday();
  key = key || now.slice(0, 7);
  const year = key.length === 4;
  const ws = data.settings.weekStart;
  const wrap = h(`<div><div class="sheet-head"><h2>${esc(x.title)}</h2><button type="button" class="icon-btn" aria-label="閉じる">✕</button></div>
    <p class="hint">${planText(x)}・${longDate(x.since)}から</p></div>`);
  wrap.querySelector(".icon-btn").addEventListener("click", closeSheet);
  const seg = h(`<div class="seg2 seg-sm hb-seg" role="radiogroup" aria-label="記録の表示"><button type="button" role="radio">月</button><button type="button" role="radio">年</button></div>`);
  const [bm, by] = seg.querySelectorAll("button");
  bm.classList.toggle("on", !year); bm.setAttribute("aria-checked", String(!year));
  by.classList.toggle("on", year); by.setAttribute("aria-checked", String(year));
  bm.addEventListener("click", () => { if (year) showHabitLog(x, key === now.slice(0, 4) ? now.slice(0, 7) : key + "-01"); });
  by.addEventListener("click", () => { if (!year) showHabitLog(x, key.slice(0, 4)); });
  wrap.appendChild(seg);
  const unit = year ? "年" : "月";
  const nav = h(`<div class="hb-mnav"><button type="button" class="icon-btn" aria-label="前の${unit}">‹</button><span>${year ? key + "年" : monthTitle(key)}</span><button type="button" class="icon-btn" aria-label="次の${unit}">›</button></div>`);
  const [prev, next] = nav.querySelectorAll("button");
  prev.addEventListener("click", () => showHabitLog(x, year ? String(Number(key) - 1) : shiftMonth(key, -1)));
  next.addEventListener("click", () => showHabitLog(x, year ? String(Number(key) + 1) : shiftMonth(key, 1)));
  wrap.appendChild(nav);

  const count = { done: 0, miss: 0 };
  // 週◯回の週の結果。週の終わりの日がこの月（年）に入る週を数える
  const weeks = { done: 0, miss: 0 };
  const countWeek = (r) => { if (r.to.startsWith(key) && r.mark in weeks) weeks[r.mark]++; };
  if (year) {
    // 12か月の小さな表。押すとその月の表へ
    const yg = h(`<div class="hb-year"></div>`);
    for (let m = 1; m <= 12; m++) {
      const mk = `${key}-${pad2(m)}`;
      const { from, to } = Cal.monthRange(mk, ws);
      const mini = h(`<button type="button" class="hb-mini" aria-label="${m}月の記録を開く"><span class="hb-mini-t">${m}月</span><span class="hb-dots"></span></button>`);
      const dots = mini.querySelector(".hb-dots");
      for (let d = from; d <= to; d = Cal.addDays(d, 1)) {
        if (d.slice(0, 7) !== mk) { dots.appendChild(h(`<i class="blank"></i>`)); continue; }
        const mark = Cal.habitMark(x, d, now);
        if (mark in count) count[mark]++;
        dots.appendChild(h(`<i class="${mark}${d === now ? " today" : ""}"></i>`));
        if (x.perWeek && Cal.weekday(d) === (ws + 6) % 7) countWeek(Cal.habitWeek(x, d, now, ws));
      }
      mini.addEventListener("click", () => showHabitLog(x, mk));
      yg.appendChild(mini);
    }
    wrap.appendChild(yg);
  } else {
    const { from, to } = Cal.monthRange(key, ws);
    // 週◯回は右の端に週の結果の欄を足す（D31）
    const grid = h(`<div class="hb-cal${x.perWeek ? " wk" : ""}"></div>`);
    for (let i = 0; i < 7; i++) {
      const w = (ws + i) % 7;
      grid.appendChild(h(`<span class="hb-wd ${w === 0 ? "sun" : w === 6 ? "sat" : ""}">${WEEK[w]}</span>`));
    }
    if (x.perWeek) grid.appendChild(h(`<span class="hb-wd">週</span>`));
    for (let d = from; d <= to; d = Cal.addDays(d, 1)) {
      if (d.slice(0, 7) !== key) grid.appendChild(h(`<span class="hb-d blank"></span>`));
      else {
        const m = Cal.habitMark(x, d, now);
        if (m in count) count[m]++;
        const label = `${dayLabel(d)} ${MARK_TEXT[m]}`;
        grid.appendChild(h(`<span class="hb-d ${m}${d === now ? " today" : ""}" role="img" aria-label="${esc(label)}"><span>${Number(d.slice(8))}</span><b>${MARK_SIGN[m]}</b></span>`));
      }
      if (x.perWeek && Cal.daysBetween(from, d) % 7 === 6) {
        const r = Cal.habitWeek(x, d, now, ws);
        countWeek(r);
        const txt = { done: "できた", miss: "足りなかった", open: "今週", before: "", future: "" }[r.mark];
        grid.appendChild(h(`<span class="hb-wk ${r.mark}" role="img" aria-label="${esc(`${weekRange(r.from)}の週 ${r.count}回 ${txt}`)}"><span>${r.mark === "future" || r.mark === "before" && !r.count ? "" : r.count + "回"}</span><b>${{ done: "●", miss: "×" }[r.mark] || ""}</b></span>`));
      }
    }
    wrap.appendChild(grid);
  }
  const span = year ? "この年" : "この月";
  if (x.perWeek) {
    wrap.appendChild(h(`<p class="hb-sum">${span}　できた週 <b>${weeks.done}</b>・足りなかった週 <b>${weeks.miss}</b>（できた日 ${count.done}）</p>`));
    wrap.appendChild(h(`<p class="hint">週ごとに${x.perWeek}回できたかを見ます。週の終わりの日がこの${year ? "年" : "月"}にある週を数えます。</p>`));
  } else {
    const total = count.done + count.miss;
    wrap.appendChild(h(`<p class="hb-sum">${span}　できた <b>${count.done}</b> 日・やらなかった <b>${count.miss}</b> 日${total ? `（${Math.round((count.done / total) * 100)}%）` : ""}</p>`));
    wrap.appendChild(h(`<p class="hint">今日の分は、チェックが付くまで数えません。</p>`));
  }
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
    <div class="row-line hb-plan"><span>決め方</span><span class="seg2 seg-sm" role="radiogroup"><button type="button" role="radio" data-p="days">曜日</button><button type="button" role="radio" data-p="week">週◯回</button></span></div>
    <div class="row-line hb-days-in"><span>やる曜日</span><span class="wd-btns">${order.map((w) => `<button type="button" data-w="${w}" class="${w === 0 ? "sun" : w === 6 ? "sat" : ""}">${WEEK[w]}</button>`).join("")}</span></div>
    <label class="row-line hb-per-in"><span>1週間に</span><select name="perWeek">${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}">${n}回</option>`).join("")}</select></label>
    <p class="hint hb-per-in">曜日を決めず、${WEEK[ws]}曜から始まる1週間でこの回数できたかを見ます。やらなかった日に×は付きません。</p>
    ${x ? `<p class="hint">曜日や決め方を変えると、これまでの記録も新しい決め方で数え直します（外した曜日は「お休み」になります）。</p>` : ""}
    <p class="form-error" role="alert"></p>
    <div class="actions">${x ? `<button type="button" class="btn danger" data-act="del">削除</button>` : ""}<button type="submit" class="btn primary">${x ? "保存" : "足す"}</button></div>
  </form>`);
  const f = form.elements;
  f.title.value = x ? x.title : "";
  // 決め方：曜日か週◯回か（D31）
  let perWeek = !!(x && x.perWeek);
  f.perWeek.value = String((x && x.perWeek) || 3);
  const planBtns = form.querySelectorAll(".hb-plan button");
  const paintPlan = () => {
    planBtns.forEach((b) => {
      const sel = (b.dataset.p === "week") === perWeek;
      b.classList.toggle("on", sel);
      b.setAttribute("aria-checked", String(sel));
    });
    form.querySelector(".hb-days-in").hidden = perWeek;
    form.querySelectorAll(".hb-per-in").forEach((el) => { el.hidden = !perWeek; });
  };
  planBtns.forEach((b) => b.addEventListener("click", () => { perWeek = b.dataset.p === "week"; paintPlan(); }));
  paintPlan();
  const on = new Set(x && !x.perWeek ? x.days : [0, 1, 2, 3, 4, 5, 6]);
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
    const msg = !title ? "やることを入れてください" : !perWeek && !on.size ? "やる曜日を1つ以上選んでください" : null;
    form.querySelector(".form-error").textContent = msg || "";
    if (msg) return;
    const plan = perWeek ? { days: [0, 1, 2, 3, 4, 5, 6], perWeek: Number(f.perWeek.value) } : { days: [...on], perWeek: null };
    const before = { habits: data.habits.slice(), startedAt: data.settings.startedAt };
    if (x) {
      const i = data.habits.indexOf(x);
      if (i < 0) return closeSheet(); // 開いているあいだに消された
      data.habits[i] = Store.cleanHabit({ ...x, title, ...plan });
    } else {
      data.habits.push(Store.cleanHabit({ id: Store.newId(), title, ...plan, since: habitToday(), done: [], doneAt: {}, createdAt: new Date().toISOString() }));
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
    b.addEventListener("click", () => {
      // 「◯週中」の予定も新しい週の最初の日へずらす（仕様書 2.13）
      const before = { events: data.events, ws: data.settings.weekStart };
      Store.setWeekStart(data, Number(b.dataset.w));
      if (!commit(() => { data.events = before.events; data.settings.weekStart = before.ws; })) return;
      render();
    });
  });
  view.appendChild(ws);

  // 下のタブの並び（仕様書 2.10・D24）
  const order = data.settings.tabOrder;
  const to = h(`<section class="card"><h2>下のタブの並び</h2><div class="tab-order"></div>
    <p class="hint">いちばん上のものが下のタブの左端になり、アプリを開いたときに最初に出ます。</p></section>`);
  const listEl = to.querySelector(".tab-order");
  order.forEach((t, i) => {
    const row = h(`<div class="to-row"><span>${TAB_NAMES[t]}</span>
      <button type="button" class="icon-btn" data-d="-1" aria-label="${TAB_NAMES[t]}を上へ"${i === 0 ? " disabled" : ""}>↑</button>
      <button type="button" class="icon-btn" data-d="1" aria-label="${TAB_NAMES[t]}を下へ"${i === order.length - 1 ? " disabled" : ""}>↓</button></div>`);
    row.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      const before = order.slice();
      const j = i + Number(b.dataset.d);
      [order[i], order[j]] = [order[j], order[i]];
      if (!commit(() => { data.settings.tabOrder = before; })) return;
      applyTabOrder();
      render();
    }));
    listEl.appendChild(row);
  });
  view.appendChild(to);

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

  // アイコンの数字（仕様書 2.16・D37）
  const canBadge = "setAppBadge" in navigator && "Notification" in window;
  const bd = h(`<section class="card"><h2>アイコンに数字</h2>
    <label class="row-line"><span>今日のやることの残りを出す</span><input type="checkbox" switch aria-label="アイコンに今日のやることの残りの数を出す"></label>
    <p class="hint bd-state"></p>
    <p class="hint">数字はアプリを開いたとき・チェックを付けたときに変わります。開かないまま${data.settings.dayStart}:00 を過ぎても、数字は前の日のまま残ります。iPhone では「通知」の許可が要ります（予定の通知は出しません）。</p>
  </section>`);
  const bdIn = bd.querySelector("input");
  const bdState = bd.querySelector(".bd-state");
  bdIn.checked = data.settings.badge;
  bdIn.disabled = !canBadge;
  const paintBadgeState = () => {
    bdState.textContent = !canBadge ? "この開き方では使えません。ホーム画面に追加したアプリから開いてください。"
      : Notification.permission === "denied" ? "通知が許可されていないため、数字は出ません。iPhone の「設定」→「通知」→「予定帳」で許可してください。"
      : data.settings.badge && Notification.permission !== "granted" ? "通知の許可を待っています。" : "";
    bdState.hidden = !bdState.textContent;
  };
  paintBadgeState();
  bdIn.addEventListener("change", async () => {
    const want = bdIn.checked;
    // 許可を聞く窓は、押した直後でないと出ない
    if (want && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch (e) { /* 聞けなかったときは今の許可のまま */ }
    }
    data.settings.badge = want;
    if (!commit(() => { data.settings.badge = !want; })) bdIn.checked = !want;
    paintBadgeState();
    updateBadge();
  });
  view.appendChild(bd);

  // バックアップ（仕様書 2.8）
  const last = data.settings.lastExport;
  const overdue = backupOverdue();
  const bk = h(`<section class="card"><h2>バックアップ</h2>
    <p class="hint">予定と毎日のやること・ひとことメモはこの端末の中だけにあります。機種変更や万一に備えて、ときどき書き出してください（iPhone では「"ファイル"に保存」を選びます）。</p>
    <p>予定 ${data.events.length} 件・毎日のやること ${data.habits.length} 件・ひとことメモ ${Object.keys(data.notes).length} 日<br>最後に書き出した日：${last ? esc(longDate(last)) : "まだありません"}</p>
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
    <p class="hint">予定と毎日のやること・ひとことメモはこの端末の中だけに保存され、ネットには送られません。予定の時刻の通知はありません。</p>
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
// time を渡すとその時刻から（週の表示で空いている時間を押したとき）
function newDraft(date, time) {
  let start = time || "09:00";
  if (!time && date === today()) start = pad2(Math.min(new Date().getHours() + 1, 23)) + ":00";
  const end = Cal.fromMin(Cal.toMin(date, start) + 60);
  return { title: "", start: date, end: end.date, allDay: false, startTime: start, endTime: end.time, color: "blue", memo: "", repeat: null };
}
function openNew(date, time) {
  showEditor(null, null, newDraft(date, time));
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
  if (v.inMonth && !Cal.isDate(v.start)) return "月を入れてください";
  if (v.inWeek && !Cal.isDate(v.start)) return "週の日付を入れてください";
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
  if (ev && ev.repeat) wrap.appendChild(h(`<p class="hint">${FREQ_NAMES[ev.repeat.freq]}の予定です（${ev.inMonth ? monthTitle(ev.start.slice(0, 7)) : ev.inWeek ? longDate(ev.start) + "の週" : longDate(ev.start)}から）。ここで変えると全部の回が変わります。</p>`));
  const ws = data.settings.weekStart;
  const form = h(`<form class="entry" novalidate>
    <input class="title-in" name="title" placeholder="タイトル" maxlength="${Store.TITLE_MAX}" autocomplete="off" enterkeyhint="done">
    <label class="row-line"><span>日の決め方</span><select name="mode"><option value="day">日を決める</option><option value="week">週の中で（◯週中）</option><option value="month">月の中で（◯月中）</option></select></label>
    <div class="row-line month-line"><span>月</span><input type="month" name="month" aria-label="何月中か"></div>
    <div class="row-line week-line"><span>週</span><span class="dt"><span class="wk-range"></span><input type="date" name="week" aria-label="何日の週か"></span></div>
    <label class="row-line day-line"><span>終日</span><input type="checkbox" switch name="allDay"></label>
    <div class="row-line day-line"><span>開始</span><span class="dt"><input type="date" name="start" aria-label="開始の日付"><input type="time" name="startTime" aria-label="開始の時刻"></span></div>
    <div class="row-line day-line"><span>終了</span><span class="dt"><input type="date" name="end" aria-label="終了の日付"><input type="time" name="endTime" aria-label="終了の時刻"></span></div>
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
  // 日の決め方：日を決める（day）・◯週中（week。仕様書 2.13）・◯月中（month。2.12）
  let mode = v.inMonth ? "month" : v.inWeek ? "week" : "day";
  f.mode.value = mode;
  f.month.value = v.start.slice(0, 7);
  f.week.value = Cal.weekFrom(v.start, ws);
  f.start.value = v.start;
  f.end.value = v.end;
  f.startTime.value = v.startTime || "09:00"; // 終日の予定でも、時刻付きに切り替えたときの既定を入れておく
  f.endTime.value = v.endTime || "10:00";
  f.hasUntil.checked = !!(v.repeat && v.repeat.until);
  f.until.value = (v.repeat && v.repeat.until) || v.start;
  f.memo.value = v.memo || "";
  form.querySelector(`input[name=color][value=${Store.COLORS.includes(v.color) ? v.color : "blue"}]`).checked = true;

  // 繰り返しの選択肢に、開始日から作った中身を添える（例「毎週（土曜）」）
  // 「◯月中」なら月の1日、「◯週中」なら週の最初の日を開始日とみなす
  const monthStart = () => (Cal.isDate(f.month.value + "-01") ? f.month.value + "-01" : v.start.slice(0, 8) + "01");
  const weekStart = () => Cal.weekFrom(Cal.isDate(f.week.value) ? f.week.value : v.start, ws);
  const paintFreq = () => {
    const s = mode === "month" ? monthStart() : mode === "week" ? weekStart() : Cal.isDate(f.start.value) ? f.start.value : v.start;
    const [, m, d] = s.split("-").map(Number);
    const w = WEEK[Cal.weekday(s)];
    const names = { daily: "毎日", weekly: `毎週（${w}曜）`, biweekly: `2週ごと（${w}曜）`, monthly: `毎月（${d}日）`,
      monthlyNth: `毎月（第${Cal.nthOfMonth(s)}${w}曜）`, monthlyLast: `毎月（最終${w}曜）`, yearly: `毎年（${m}月${d}日）` };
    if (mode === "month") Object.assign(names, { monthly: "毎月", yearly: `毎年（${m}月）` }); // 仕様書 D27
    if (mode === "week") Object.assign(names, { weekly: "毎週", biweekly: "2週ごと" }); // 仕様書 D35
    const ok = mode === "month" ? Store.MONTH_FREQS : mode === "week" ? Store.WEEK_FREQS : Cal.freqsFor(s);
    let cur = f.freq.value || (v.repeat ? v.repeat.freq : "none");
    // 開始日を動かして選べなくなった「第◯曜」「最終曜」は、選べるほうへ移す
    // 「◯月中」「◯週中」に切り替えて選べなくなった種類は「しない」に戻す
    if (cur !== "none" && !ok.includes(cur)) cur = mode !== "day" ? "none" : cur === "monthlyNth" ? "monthlyLast" : cur === "monthlyLast" ? "monthlyNth" : "none";
    f.freq.innerHTML = `<option value="none">しない</option>` + ok.map((k) => `<option value="${k}">${names[k]}</option>`).join("");
    f.freq.value = cur;
  };
  const paint = () => {
    form.classList.toggle("all-day", f.allDay.checked);
    form.classList.toggle("in-month", mode === "month");
    form.classList.toggle("in-week", mode === "week");
    form.querySelector(".wk-range").textContent = weekRange(weekStart());
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
  // 決め方を変えたら、今の決め方で選んでいた日・週・月をもう一方へ写す
  f.mode.addEventListener("change", () => {
    const next = f.mode.value;
    const base = mode === "month" ? (Cal.isDate(f.month.value + "-01") ? f.month.value + "-01" : null)
      : mode === "week" ? (Cal.isDate(f.week.value) ? weekStart() : null)
      : Cal.isDate(f.start.value) ? f.start.value : null;
    if (base) {
      if (next === "month") f.month.value = base.slice(0, 7);
      if (next === "week") f.week.value = Cal.weekFrom(base, ws);
      // 日を決めるへ戻すとき、開始日がその月・週の外なら、月・週の最初の日へ移す（終了も同じだけずらす）
      const inside = mode === "month" ? f.start.value.slice(0, 7) === base.slice(0, 7)
        : mode === "week" ? f.start.value >= base && f.start.value <= Cal.addDays(base, 6) : true;
      if (next === "day" && !inside) {
        f.start.value = base;
        onStart();
      }
    }
    mode = next;
    paintFreq();
    paint();
  });
  f.month.addEventListener("change", () => { paintFreq(); paint(); });
  f.week.addEventListener("change", () => {
    if (Cal.isDate(f.week.value)) f.week.value = weekStart(); // 選んだ日を週の最初の日にそろえる
    paintFreq();
    paint();
  });
  f.hasUntil.addEventListener("change", paint);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const inMonth = mode === "month", inWeek = mode === "week";
    const allDay = inMonth || inWeek || f.allDay.checked;
    const vague = inMonth ? f.month.value + "-01" : inWeek ? (Cal.isDate(f.week.value) ? weekStart() : "") : null;
    const out = {
      title: f.title.value.trim(),
      start: vague ?? f.start.value,
      end: vague ?? f.end.value,
      allDay,
      inMonth,
      inWeek,
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
    if (!ev || !out.repeat) {
      const now = today();
      // 「◯月中」は日が無いので、月を変えたときと同じ日を選ぶ。「◯週中」は今週なら今日、ほかは週の最初の日
      selected = out.inMonth ? (out.start.slice(0, 7) === now.slice(0, 7) ? now : out.start)
        : out.inWeek ? (now >= out.start && now <= Cal.addDays(out.start, 6) ? now : out.start)
        : out.start;
      month = selected.slice(0, 7);
    }
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
        <button type="button" class="btn danger" data-c="one">この回だけ消す（${occLabel(ev, occ)}）</button>
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
  toast(`${occLabel(ev, occ)}の回を消しました`, () => {
    ev.skips = ev.skips.filter((d) => d !== occ);
    save(); render();
  });
}

// ---------- バックアップ（仕様書 2.8） ----------
const BACKUP_DAYS = 30; // 最後に書き出してから（まだなら使い始めてから）この日数で知らせる
const BACKUP_ASK_AGAIN = 7; // 「あとで」を選んだら、次に知らせるまでの日数
// 書き出していない日数。知らせる時期でなければ null
function backupOverdue() {
  if (Store.isEmpty(data)) return null;
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
  toast(`予定 ${r.added} 件` + (r.habits ? `・毎日のやること ${r.habits} 件` : "") + (r.notes ? `・ひとことメモ ${r.notes} 日` : "") + "を足しました" + (r.skipped ? `（同じ予定 ${r.skipped} 件は飛ばしました）` : "") + (r.broken ? `　壊れた予定 ${r.broken} 件は読めませんでした` : ""));
}

// ---------- 起動 ----------
Store.init().then(() => {
  data = Store.load();
  applyTabOrder();
  tab = data.settings.tabOrder[0];
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
    else updateBadge();
    setTimeout(maybeAskBackup, 600);
  });
  // 開いたまま、チェックが外れる時刻をまたいだとき
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (sheet.hidden && tab === "daily" && habitToday() !== shownHabitDay) render();
    else updateBadge(); // ほかのタブを開いたまま区切りをまたいでも、アイコンの数字は新しい日にする
  }, 30000);
});

// 消されにくい保存をお願いする（iPhone ではホーム画面から開いたときに効く）
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// 電波がなくても開けるようにする仕組み（サービスワーカー）。パソコンで試すとき（http）は使わない
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js");
}
