// app/cal.js と app/store.js の計算の検査。使い方: node tools/test.js
// 祝日の日付の答えは内閣府の一覧（「国民の祝日について」の 2026・2027 年と、syukujitsu.csv の 2007・2018〜2021・2025 年。
// 2026-10-24 に確認）。内閣府が「休日」とだけ書く日の名前は、仕様書 2.7 のとおり「振替休日」「国民の休日」にしてある。
const path = require("path");
global.Cal = require(path.join(__dirname, "..", "app", "cal.js"));
// store.js が使う localStorage の代わり
const mem = new Map();
global.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const Store = require(path.join(__dirname, "..", "app", "store.js"));

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++;
  else {
    fail++;
    console.log(`✗ ${name}\n    得たもの  : ${g}\n    正しい答え: ${w}`);
  }
}

// ---------- 祝日 ----------
const HOLIDAYS = {
  2007: "01-01 元日|01-08 成人の日|02-11 建国記念の日|02-12 振替休日|03-21 春分の日|04-29 昭和の日|04-30 振替休日|05-03 憲法記念日|05-04 みどりの日|05-05 こどもの日|07-16 海の日|09-17 敬老の日|09-23 秋分の日|09-24 振替休日|10-08 体育の日|11-03 文化の日|11-23 勤労感謝の日|12-23 天皇誕生日|12-24 振替休日",
  2018: "01-01 元日|01-08 成人の日|02-11 建国記念の日|02-12 振替休日|03-21 春分の日|04-29 昭和の日|04-30 振替休日|05-03 憲法記念日|05-04 みどりの日|05-05 こどもの日|07-16 海の日|08-11 山の日|09-17 敬老の日|09-23 秋分の日|09-24 振替休日|10-08 体育の日|11-03 文化の日|11-23 勤労感謝の日|12-23 天皇誕生日|12-24 振替休日",
  2019: "01-01 元日|01-14 成人の日|02-11 建国記念の日|03-21 春分の日|04-29 昭和の日|04-30 国民の休日|05-01 天皇の即位の日|05-02 国民の休日|05-03 憲法記念日|05-04 みどりの日|05-05 こどもの日|05-06 振替休日|07-15 海の日|08-11 山の日|08-12 振替休日|09-16 敬老の日|09-23 秋分の日|10-14 体育の日|10-22 即位礼正殿の儀の行われる日|11-03 文化の日|11-04 振替休日|11-23 勤労感謝の日",
  2020: "01-01 元日|01-13 成人の日|02-11 建国記念の日|02-23 天皇誕生日|02-24 振替休日|03-20 春分の日|04-29 昭和の日|05-03 憲法記念日|05-04 みどりの日|05-05 こどもの日|05-06 振替休日|07-23 海の日|07-24 スポーツの日|08-10 山の日|09-21 敬老の日|09-22 秋分の日|11-03 文化の日|11-23 勤労感謝の日",
  2021: "01-01 元日|01-11 成人の日|02-11 建国記念の日|02-23 天皇誕生日|03-20 春分の日|04-29 昭和の日|05-03 憲法記念日|05-04 みどりの日|05-05 こどもの日|07-22 海の日|07-23 スポーツの日|08-08 山の日|08-09 振替休日|09-20 敬老の日|09-23 秋分の日|11-03 文化の日|11-23 勤労感謝の日",
  2025: "01-01 元日|01-13 成人の日|02-11 建国記念の日|02-23 天皇誕生日|02-24 振替休日|03-20 春分の日|04-29 昭和の日|05-03 憲法記念日|05-04 みどりの日|05-05 こどもの日|05-06 振替休日|07-21 海の日|08-11 山の日|09-15 敬老の日|09-23 秋分の日|10-13 スポーツの日|11-03 文化の日|11-23 勤労感謝の日|11-24 振替休日",
  2026: "01-01 元日|01-12 成人の日|02-11 建国記念の日|02-23 天皇誕生日|03-20 春分の日|04-29 昭和の日|05-03 憲法記念日|05-04 みどりの日|05-05 こどもの日|05-06 振替休日|07-20 海の日|08-11 山の日|09-21 敬老の日|09-22 国民の休日|09-23 秋分の日|10-12 スポーツの日|11-03 文化の日|11-23 勤労感謝の日",
  2027: "01-01 元日|01-11 成人の日|02-11 建国記念の日|02-23 天皇誕生日|03-21 春分の日|03-22 振替休日|04-29 昭和の日|05-03 憲法記念日|05-04 みどりの日|05-05 こどもの日|07-19 海の日|08-11 山の日|09-20 敬老の日|09-23 秋分の日|10-11 スポーツの日|11-03 文化の日|11-23 勤労感謝の日",
};
for (const [y, text] of Object.entries(HOLIDAYS)) {
  const want = text.split("|").map((s) => { const [md, name] = s.split(" "); return [`${y}-${md}`, name]; });
  eq(`祝日 ${y}`, Object.entries(Cal.holidays(Number(y))).sort(), want);
}
eq("祝日 範囲外 2006", Cal.holidays(2006), {});
eq("祝日 範囲外 2100", Cal.holidays(2100), {});
eq("祝日の名前", [Cal.holidayName("2026-09-22"), Cal.holidayName("2026-10-24")], ["国民の休日", null]);

// ---------- 日付 ----------
eq("うるう年の2月", Cal.addDays("2028-02-28", 1), "2028-02-29");
eq("うるう年でない2月", Cal.addDays("2027-02-28", 1), "2027-03-01");
eq("年をまたぐ", Cal.addDays("2026-12-31", 1), "2027-01-01");
eq("前の日", Cal.addDays("2026-03-01", -1), "2026-02-28");
eq("日数の差", Cal.daysBetween("2026-10-24", "2027-10-24"), 365);
eq("曜日", ["2026-10-24", "2026-10-25", "2027-01-01"].map(Cal.weekday), [6, 0, 5]);
eq("実在する日付か", ["2026-02-29", "2028-02-29", "2026-13-01", "2026-04-31", "0099-01-01", "2026-1-1", "2199-12-31", 20261024].map(Cal.isDate),
  [false, true, false, false, false, false, true, false]);
eq("時刻の形か", ["00:00", "23:59", "24:00", "9:00", "12:60"].map(Cal.isTime), [true, true, false, false, false]);
eq("分 ⇔ 日付と時刻", Cal.fromMin(Cal.toMin("2026-10-24", "23:30") + 60), { date: "2026-10-25", time: "00:30" });
eq("月の範囲 日曜始まり", Cal.monthRange("2026-10", 0), { from: "2026-09-27", to: "2026-10-31" });
eq("月の範囲 月曜始まり", Cal.monthRange("2026-10", 1), { from: "2026-09-28", to: "2026-11-01" });
eq("月の範囲 4段で済む月", Cal.monthRange("2026-02", 0), { from: "2026-02-01", to: "2026-02-28" });

// ---------- 繰り返しの展開 ----------
let seq = 0;
function ev(o) {
  seq++;
  return { id: "e" + seq, title: o.title || "予定" + seq, start: o.start, end: o.end || o.start, allDay: o.allDay ?? true,
    startTime: o.startTime || null, endTime: o.endTime || null, color: "blue", memo: o.memo || "",
    repeat: o.repeat || null, skips: o.skips || [], createdAt: o.createdAt || `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z` };
}
const occ = (e, a, b, limit) => Cal.occurrences(e, a, b, limit).map((o) => (o.start === o.end ? o.start : `${o.start}〜${o.end}`));

const one = ev({ start: "2026-10-24" });
eq("1回だけ 範囲内", occ(one, "2026-10-01", "2026-10-31"), ["2026-10-24"]);
eq("1回だけ 範囲外", occ(one, "2026-10-25", "2026-10-31"), []);
const trip = ev({ start: "2026-10-23", end: "2026-10-25" });
eq("何日か 終わりの日だけかかる", occ(trip, "2026-10-25", "2026-10-31"), ["2026-10-23〜2026-10-25"]);
eq("何日か かからない", occ(trip, "2026-10-26", "2026-10-31"), []);
eq("何日か 始まりの日だけかかる", occ(trip, "2026-10-20", "2026-10-23"), ["2026-10-23〜2026-10-25"]);

const weekly = ev({ start: "2026-10-03", repeat: { freq: "weekly", until: null } });
eq("毎週", occ(weekly, "2026-10-01", "2026-10-31"), ["2026-10-03", "2026-10-10", "2026-10-17", "2026-10-24", "2026-10-31"]);
eq("毎週 先の月から数える", occ(weekly, "2027-01-01", "2027-01-31"), ["2027-01-02", "2027-01-09", "2027-01-16", "2027-01-23", "2027-01-30"]);
eq("毎週 始まる前は出さない", occ(weekly, "2026-09-01", "2026-10-09"), ["2026-10-03"]);
eq("毎週 この回だけ消す", occ({ ...weekly, skips: ["2026-10-17"] }, "2026-10-01", "2026-10-31"), ["2026-10-03", "2026-10-10", "2026-10-24", "2026-10-31"]);
eq("毎週 終わりの日", occ({ ...weekly, repeat: { freq: "weekly", until: "2026-10-20" } }, "2026-10-01", "2026-10-31"), ["2026-10-03", "2026-10-10", "2026-10-17"]);
eq("毎週 終わりの日のあと", occ({ ...weekly, repeat: { freq: "weekly", until: "2026-10-10" } }, "2026-11-01", "2026-11-30"), []);
eq("毎週 件数で打ち切る", occ(weekly, "2026-10-01", "2026-12-31", 2), ["2026-10-03", "2026-10-10"]);

const monthly31 = ev({ start: "2026-01-31", repeat: { freq: "monthly", until: null } });
eq("毎月31日 31日の無い月は出さない", occ(monthly31, "2026-01-01", "2026-12-31"),
  ["2026-01-31", "2026-03-31", "2026-05-31", "2026-07-31", "2026-08-31", "2026-10-31", "2026-12-31"]);
eq("毎月 先の月から数える", occ(monthly31, "2026-04-01", "2026-06-30"), ["2026-05-31"]);
const monthlySpan = ev({ start: "2026-01-30", end: "2026-02-02", repeat: { freq: "monthly", until: null } });
eq("毎月 何日か 前の月から続く回", occ(monthlySpan, "2026-02-01", "2026-02-01"), ["2026-01-30〜2026-02-02"]);
eq("毎月 何日か かからない", occ(monthlySpan, "2026-03-03", "2026-03-29"), []);
eq("毎月 何日か 月をまたぐ回", occ(monthlySpan, "2026-03-31", "2026-04-01"), ["2026-03-30〜2026-04-02"]);

const leap = ev({ start: "2024-02-29", repeat: { freq: "yearly", until: null } });
eq("毎年2月29日 うるう年だけ", occ(leap, "2024-01-01", "2032-12-31"), ["2024-02-29", "2028-02-29", "2032-02-29"]);
const birthday = ev({ start: "2026-11-05", repeat: { freq: "yearly", until: null } });
eq("毎年", occ(birthday, "2026-01-01", "2028-12-31"), ["2026-11-05", "2027-11-05", "2028-11-05"]);
eq("毎年 先の年から数える", occ(birthday, "2030-01-01", "2030-12-31"), ["2030-11-05"]);

const weekend = ev({ start: "2026-10-23", end: "2026-10-25", repeat: { freq: "weekly", until: null } });
eq("毎週 何日か 次の週", occ(weekend, "2026-10-26", "2026-11-01"), ["2026-10-30〜2026-11-01"]);
eq("毎週 何日か 途中の日", occ(weekend, "2026-10-25", "2026-10-25"), ["2026-10-23〜2026-10-25"]);

const daily = ev({ start: "2026-10-30", repeat: { freq: "daily", until: "2026-11-02" } });
eq("毎日 月をまたいで終わりの日まで", occ(daily, "2026-10-01", "2026-11-30"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
eq("毎日 先の日から数える", occ({ ...daily, repeat: { freq: "daily", until: null } }, "2027-03-01", "2027-03-02"), ["2027-03-01", "2027-03-02"]);
const biweekly = ev({ start: "2026-10-03", repeat: { freq: "biweekly", until: null } });
eq("2週ごと", occ(biweekly, "2026-10-01", "2026-11-30"), ["2026-10-03", "2026-10-17", "2026-10-31", "2026-11-14", "2026-11-28"]);
eq("2週ごと 先の月から数える（間の週は出さない）", occ(biweekly, "2027-01-01", "2027-01-31"), ["2027-01-09", "2027-01-23"]);
// 2026-10-13 は第2火曜、2026-10-31 は最終土曜
const nth = ev({ start: "2026-10-13", repeat: { freq: "monthlyNth", until: null } });
eq("毎月 第2火曜", occ(nth, "2026-10-01", "2027-03-31"), ["2026-10-13", "2026-11-10", "2026-12-08", "2027-01-12", "2027-02-09", "2027-03-09"]);
const lastSat = ev({ start: "2026-10-31", repeat: { freq: "monthlyLast", until: null } });
eq("毎月 最終土曜（30日・28日の月も）", occ(lastSat, "2026-10-01", "2027-03-31"), ["2026-10-31", "2026-11-28", "2026-12-26", "2027-01-30", "2027-02-27", "2027-03-27"]);
eq("毎月 第◯曜 始まる前は出さない・件数で打ち切る", occ(nth, "2026-09-01", "2027-12-31", 2), ["2026-10-13", "2026-11-10"]);
eq("選べる繰り返し 第1〜4は第◯と最終", [Cal.freqsFor("2026-10-13"), Cal.freqsFor("2026-10-24"), Cal.freqsFor("2026-10-25")].map((l) => l.filter((f) => f.startsWith("monthly"))),
  [["monthly", "monthlyNth"], ["monthly", "monthlyNth"], ["monthly", "monthlyNth", "monthlyLast"]]);
eq("選べる繰り返し 第5は最終だけ", Cal.freqsFor("2026-10-29").filter((f) => f.startsWith("monthly")), ["monthly", "monthlyLast"]);

// ---------- 1日の中の並びと見え方 ----------
const A = ev({ title: "終日A", start: "2026-10-24", createdAt: "2026-10-01T00:00:00.000Z" });
const D = ev({ title: "夜通しD", start: "2026-10-23", end: "2026-10-25", allDay: false, startTime: "22:00", endTime: "02:00", createdAt: "2026-10-02T00:00:00.000Z" });
const C = ev({ title: "朝C", start: "2026-10-24", allDay: false, startTime: "08:00", endTime: "08:30" });
const B = ev({ title: "会議B", start: "2026-10-24", allDay: false, startTime: "09:00", endTime: "10:00", createdAt: "2026-10-03T00:00:00.000Z" });
const E = ev({ title: "電話E", start: "2026-10-24", allDay: false, startTime: "09:00", endTime: "09:30", createdAt: "2026-10-04T00:00:00.000Z" });
const days = Cal.itemsByDay([E, B, C, D, A], "2026-10-23", "2026-10-25");
const show = (list) => list.map((i) => `${i.ev.title} ${i.view.allDay ? "終日" : `${i.view.from || ""}〜${i.view.to || ""}`}`);
eq("並び 初日", show(days.get("2026-10-23")), ["夜通しD 22:00〜"]);
eq("並び 終日→時刻→作った順", show(days.get("2026-10-24")), ["終日A 終日", "夜通しD 終日", "朝C 08:00〜08:30", "会議B 09:00〜10:00", "電話E 09:00〜09:30"]);
eq("並び 最終日は 0:00 扱い", show(Cal.itemsByDay([C, D], "2026-10-25", "2026-10-25").get("2026-10-25")), ["夜通しD 〜02:00"]);
eq("日ごと 空の日も入る", [...Cal.itemsByDay([], "2026-10-01", "2026-10-03").keys()], ["2026-10-01", "2026-10-02", "2026-10-03"]);

// ---------- これからの予定 ----------
const past = ev({ title: "過ぎた", start: "2026-10-01" });
const lastDay = ev({ title: "364日後", start: "2027-10-23" });
const outside = ev({ title: "365日後", start: "2027-10-24" });
const up = Cal.upcoming([past, D, weekly, lastDay, outside], "2026-10-24");
eq("これから 最初の日（続いている予定は今日に置く）", show(up[0].items).concat(up[0].day), [`${weekly.title} 終日`, "夜通しD 終日", "2026-10-24"]);
eq("これから 何日かの予定は1回だけ", up.filter((g) => g.items.some((i) => i.ev === D)).length, 1);
eq("これから 365日目まで", [up[up.length - 1].day, up.some((g) => g.items.some((i) => i.ev === outside))], ["2027-10-23", false]);
eq("これから 過ぎた予定は出さない", up.some((g) => g.items.some((i) => i.ev === past)), false);

// ---------- 検索 ----------
const dentist = ev({ title: "歯医者", memo: "定期検診", start: "2026-11-02" });
const meeting = ev({ title: "ＡＢＣ会議", start: "2026-10-30" });
const shop = ev({ title: "買い物", start: "2026-10-01" });
const gym = ev({ title: "ジム", start: "2026-09-01", repeat: { freq: "weekly", until: "2026-10-20" } });
const yoga = ev({ title: "ヨガ", start: "2026-09-02", repeat: { freq: "weekly", until: null } });
const all = [dentist, meeting, shop, gym, yoga];
const found = (q) => { const r = Cal.search(all, q, "2026-10-24"); return [r.upcoming.map((o) => `${o.ev.title} ${o.start}`), r.past.map((o) => `${o.ev.title} ${o.start}`)]; };
eq("検索 全角と大文字を無視", found("abc"), [["ＡＢＣ会議 2026-10-30"], []]);
eq("検索 メモも探す", found("検診"), [["歯医者 2026-11-02"], []]);
eq("検索 空白で区切ると全部を含むもの", [found("歯医者 検診"), found("歯医者 会議")], [[["歯医者 2026-11-02"], []], [[], []]]);
eq("検索 繰り返しは次の回", found("ヨガ"), [["ヨガ 2026-10-28"], []]);
eq("検索 終わった繰り返しは最後の回", found("ジム"), [[], ["ジム 2026-10-20"]]);
eq("検索 これからは早い順・過去は新しい順", found("")[0].length + found(" ")[0].length, 0);
const order = Cal.search(all.concat(ev({ title: "買い物2", start: "2026-09-15" }), ev({ title: "買い物3", start: "2026-12-01" })), "買い物", "2026-10-24");
eq("検索 並び", [order.upcoming.map((o) => o.start), order.past.map((o) => o.start)], [["2026-12-01"], ["2026-10-01", "2026-09-15"]]);
// 全期間から探す：遠い先の予定も、消した回が続いて次の回が遠い繰り返しも見つかる
const far = ev({ title: "十年後", start: "2036-10-26" });
const skipped = ev({ title: "記念日", start: "2020-11-01", repeat: { freq: "yearly", until: null },
  skips: Array.from({ length: 12 }, (_, i) => `${2026 + i}-11-01`) });
const farFound = (e) => Cal.search([e], e.title, "2026-10-24").upcoming.map((o) => o.start);
eq("検索 遠い先の予定", [farFound(far), farFound(skipped)], [["2036-10-26"], ["2038-11-01"]]);

// ---------- 「◯月中」の予定（仕様書 2.12） ----------
const nov = { ...ev({ title: "11月中", start: "2026-11-01" }), inMonth: true };
const everyMonth = { ...ev({ title: "毎月中", start: "2026-09-01", repeat: { freq: "monthly", until: null }, skips: ["2026-11-01"] }), inMonth: true };
const march = { ...ev({ title: "毎年3月中", start: "2026-03-01", repeat: { freq: "yearly", until: null } }), inMonth: true };
eq("月中 各回はその月の1日〜末日", occ(everyMonth, "2026-09-30", "2027-02-01"), ["2026-09-01〜2026-09-30", "2026-10-01〜2026-10-31", "2026-12-01〜2026-12-31", "2027-01-01〜2027-01-31", "2027-02-01〜2027-02-28"]);
eq("月中 月末だけかかる", [occ(nov, "2026-11-30", "2026-12-31"), occ(nov, "2026-12-01", "2026-12-31")], [["2026-11-01〜2026-11-30"], []]);
eq("月中 日の枠には出さない", Cal.itemsByDay([nov, one], "2026-11-01", "2026-11-30").get("2026-11-01").length, 0);
eq("月中 その月の分", ["2026-10", "2026-11", "2027-03"].map((k) => Cal.monthItems([nov, everyMonth, march], k).map((i) => i.ev.title)),
  [["毎月中"], ["11月中"], ["毎月中", "毎年3月中"]]);
const upM = Cal.upcoming([nov, everyMonth, one], "2026-10-24").slice(0, 4).map((g) => g.month ? `${g.month} ${g.items.map((i) => i.ev.title)}` : g.day);
eq("これから 月中は今月がいちばん上・先の月は1日の前", upM, ["2026-10 毎月中", "2026-10-24", "2026-11 11月中", "2026-12 毎月中"]);
const mFound = Cal.search([nov], "11月", "2026-11-30");
eq("検索 月中は月末まで「これから」", [mFound.upcoming.map((o) => o.start), Cal.search([nov], "11月", "2026-12-01").past.map((o) => o.start)], [["2026-11-01"], ["2026-11-01"]]);

// ---------- 毎日のやること（仕様書 2.11） ----------
eq("区切りの時刻より前は前の日", [Cal.habitDay("2026-10-27", 3, 4), Cal.habitDay("2026-10-27", 4, 4), Cal.habitDay("2026-11-01", 0, 1), Cal.habitDay("2026-10-27", 0, 0)],
  ["2026-10-26", "2026-10-27", "2026-10-31", "2026-10-27"]);
// 月・木だけのやること。10月22日（木）に足した
const hb = { id: "h1", title: "ゴミ出し", days: [1, 4], since: "2026-10-22", done: ["2026-10-22"] };
eq("やることの印", ["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-26", "2026-10-29", "2026-10-30"].map((d) => Cal.habitMark(hb, d, "2026-10-29")),
  ["before", "done", "off", "miss", "open", "future"]);
eq("チェックした時刻の書き方", [Cal.habitTimeText("2026-10-29", "2026-10-29T07:05"), Cal.habitTimeText("2026-10-29", "2026-10-29T23:59"),
  Cal.habitTimeText("2026-10-29", "2026-10-30T01:30"), Cal.habitTimeText("2026-10-29", "2026-10-29T24:00"), Cal.habitTimeText("2026-10-29", "x")],
  ["7:05", "23:59", "翌1:30", "", ""]);
eq("やることの印 今日できた", Cal.habitMark({ ...hb, done: ["2026-10-29"] }, "2026-10-29", "2026-10-29"), "done");

// ---------- 保存（store.js） ----------
const KEY = "yoteicho.v1";
const brokenKeys = () => [...mem.keys()].filter((k) => k.startsWith(KEY + ".broken."));
(async () => {
  await Store.init();
  eq("初めて開いたとき", Store.load(), Store.fresh());

  const data = Store.fresh();
  data.events.push(Store.clean({ ...ev({ start: "2026-10-24" }), color: "pink" }));
  eq("知らない色は青", data.events[0].color, "blue");
  eq("保存", Store.save(data), true);
  await Store.init();
  eq("保存して読み直す", Store.load(), data);

  mem.set(KEY, "{壊れた中身");
  await Store.init();
  eq("壊れていたら空で始める", Store.load(), Store.fresh());
  eq("壊れた中身は退避する", brokenKeys().map((k) => mem.get(k)), ["{壊れた中身"]);
  for (const k of brokenKeys()) mem.delete(k);

  const good = ev({ start: "2026-10-24" });
  mem.set(KEY, JSON.stringify({ version: 1, events: [good, { id: "x", title: "" }], settings: { weekStart: 1 } }));
  await Store.init();
  const partly = Store.load();
  eq("一部が壊れていたら読める予定だけ使う", [partly.events.map((e) => e.id), partly.settings.weekStart], [[good.id], 1]);
  eq("一部が壊れていても元の中身は退避する", brokenKeys().length, 1);
  for (const k of brokenKeys()) mem.delete(k);

  const noList = JSON.stringify({ version: 1, events: { a: good }, settings: { weekStart: 1 } });
  mem.set(KEY, noList);
  await Store.init();
  eq("予定の一覧が壊れていたら空で始める", Store.load(), Store.fresh());
  eq("予定の一覧が壊れていたら元の中身は退避する", brokenKeys().map((k) => mem.get(k)), [noList]);
  for (const k of brokenKeys()) mem.delete(k);

  const bad = (o) => Store.isEvent({ ...ev({ start: "2026-10-24" }), ...o });
  eq("正しい予定", bad({}), true);
  eq("予定の形の確かめ", [
    bad({ title: "  " }), bad({ title: "あ".repeat(101) }), bad({ end: "2026-10-23" }), bad({ allDay: "true" }),
    bad({ allDay: false, startTime: "10:00", endTime: "09:00" }), bad({ allDay: false, startTime: "10:00", endTime: null }),
    bad({ repeat: { freq: "hourly", until: null } }), bad({ repeat: { freq: "weekly", until: "2026-10-23" } }),
    bad({ start: "2026-10-29", repeat: { freq: "monthlyNth", until: null } }), bad({ start: "2026-10-13", repeat: { freq: "monthlyLast", until: null } }),
    bad({ repeat: { freq: "weekly", until: null }, skips: ["2026-02-30"] }), bad({ id: "a/b" }), bad({ start: "0099-01-01" }),
    bad({ memo: "あ".repeat(2001) }),
  ], [false, false, false, false, false, false, false, false, false, false, false, false, false, false]);
  eq("新しい繰り返しの種類は正しい", ["daily", "biweekly", "monthlyNth"].map((freq) => bad({ start: "2026-10-13", repeat: { freq, until: null } })), [true, true, true]);
  eq("日をまたぐ時刻の予定は正しい", bad({ end: "2026-10-25", allDay: false, startTime: "22:00", endTime: "02:00" }), true);

  // 足し合わせ
  const mine = Store.fresh();
  const keep = Store.clean(ev({ title: "今の予定", start: "2026-10-24" }));
  mine.events.push(keep);
  mine.settings.startedAt = "2026-10-01";
  const added = Store.clean(ev({ title: "足す予定", start: "2026-10-25" }));
  const r = Store.merge(mine, { app: "yoteicho", events: [{ ...keep, title: "ファイルの予定" }, added, { id: "z", title: "壊れた" }], settings: { weekStart: 1 } }, "2026-10-24");
  eq("足し合わせ 件数", r, { added: 1, skipped: 1, broken: 1, habits: 0 });
  eq("足し合わせ 同じ id は今のまま・週の始まりは変えない", [mine.events.map((e) => e.title), mine.settings.weekStart, mine.settings.startedAt],
    [["今の予定", "足す予定"], 0, "2026-10-01"]);
  const empty = Store.fresh();
  Store.merge(empty, { events: [added], settings: { weekStart: 1 } }, "2026-10-24");
  eq("足し合わせ 空の端末は週の始まりも・使い始めた日は今日", [empty.events.length, empty.settings.weekStart, empty.settings.startedAt], [1, 1, "2026-10-24"]);
  eq("繰り返さない予定の skips は空にする", Store.clean({ ...ev({ start: "2026-10-24" }), skips: ["2026-10-24"] }).skips, []);

  // 毎日のやること
  const hbad = (o) => Store.isHabit({ ...hb, ...o });
  eq("正しいやること", hbad({}), true);
  eq("やることの形の確かめ", [
    hbad({ title: " " }), hbad({ title: "あ".repeat(101) }), hbad({ days: [] }), hbad({ days: [7] }), hbad({ days: [1.5] }),
    hbad({ since: "2026-02-30" }), hbad({ done: ["2026-10-32"] }), hbad({ done: null }), hbad({ id: "a b" }),
  ], [false, false, false, false, false, false, false, false, false]);
  eq("やることを整える", Store.cleanHabit({ ...hb, days: [4, 1, 4], done: ["2026-10-29", "2026-10-22", "2026-10-29"], extra: 1 }),
    { id: "h1", title: "ゴミ出し", days: [1, 4], since: "2026-10-22", done: ["2026-10-22", "2026-10-29"], doneAt: {}, createdAt: null });
  eq("チェックした時刻は、できた日の正しいものだけ残す", Store.cleanHabit({ ...hb, done: ["2026-10-22", "2026-10-29"],
    doneAt: { "2026-10-22": "2026-10-22T07:30", "2026-10-29": "07:30", "2026-10-26": "2026-10-26T08:00" } }).doneAt, { "2026-10-22": "2026-10-22T07:30" });
  eq("チェックした時刻がおかしくても、やることは壊れた扱いにしない", [hbad({ doneAt: null }), hbad({ doneAt: [1] }), Store.cleanHabit({ ...hb, doneAt: [1] }).doneAt], [true, true, {}]);

  const old = JSON.stringify({ version: 1, events: [good], settings: { weekStart: 1 } });
  mem.set(KEY, old);
  await Store.init();
  const oldLoaded = Store.load();
  eq("前の版の中身はやること無し・時刻は4時", [oldLoaded.habits, oldLoaded.settings.dayStart, brokenKeys().length], [[], 4, 0]);
  mem.set(KEY, JSON.stringify({ version: 1, events: [good], habits: [hb, { id: "y" }], settings: { dayStart: 0 } }));
  await Store.init();
  const hPartly = Store.load();
  eq("壊れたやることは飛ばして退避する", [hPartly.habits.map((x) => x.id), hPartly.settings.dayStart, brokenKeys().length], [["h1"], 0, 1]);
  for (const k of brokenKeys()) mem.delete(k);
  const startOf = async (v) => {
    mem.set(KEY, JSON.stringify({ version: 1, events: [], settings: { dayStart: v } }));
    await Store.init();
    return Store.load().settings.dayStart;
  };
  const starts = [];
  for (const v of [24, -1, "5", 2.5, 23]) starts.push(await startOf(v));
  eq("時刻の設定がおかしければ4時", starts, [4, 4, 4, 4, 23]);

  const hm = Store.fresh();
  hm.habits.push(Store.cleanHabit({ ...hb, title: "今のやること" }));
  const hr = Store.merge(hm, { events: [], habits: [{ ...hb, title: "ファイルのやること" }, { ...hb, id: "h2" }, { id: "z" }], settings: { dayStart: 0 } }, "2026-10-29");
  eq("足し合わせ やること", [hr, hm.habits.map((x) => x.title), hm.settings.dayStart], [{ added: 0, skipped: 0, broken: 1, habits: 1 }, ["今のやること", "ゴミ出し"], 4]);
  const he = Store.fresh();
  Store.merge(he, { events: [], habits: [hb], settings: { dayStart: 0 } }, "2026-10-29");
  eq("足し合わせ 空の端末はチェックが外れる時刻も・使い始めた日は今日", [he.habits.length, he.settings.dayStart, he.settings.startedAt], [1, 0, "2026-10-29"]);

  // 「◯月中」の予定の形（仕様書 2.12・3）
  eq("月中 正しい予定", [Store.isEvent(nov), Store.isEvent(everyMonth), Store.isEvent(march), Store.clean(nov).inMonth, Store.clean(one).inMonth], [true, true, true, true, false]);
  eq("月中 形の確かめ", [
    bad({ inMonth: "true" }), bad({ inMonth: true }), bad({ inMonth: true, start: "2026-11-01", end: "2026-11-02" }),
    bad({ inMonth: true, start: "2026-11-01", end: "2026-11-01", allDay: false, startTime: "09:00", endTime: "10:00" }),
    bad({ inMonth: true, start: "2026-11-01", end: "2026-11-01", repeat: { freq: "weekly", until: null } }),
  ], [false, false, false, false, false]);

  // 下のタブの並び（仕様書 2.10）
  const tabsOf = async (v) => {
    mem.set(KEY, JSON.stringify({ version: 1, events: [], settings: { tabOrder: v } }));
    await Store.init();
    return Store.load().settings.tabOrder.join(",");
  };
  const tabs = [];
  for (const v of [["daily", "cal", "list", "settings"], ["cal", "cal", "list", "settings"], ["cal", "list", "daily"], "cal", undefined]) tabs.push(await tabsOf(v));
  eq("タブの並び おかしければ最初の並び", tabs, ["daily,cal,list,settings", "cal,list,daily,settings", "cal,list,daily,settings", "cal,list,daily,settings", "cal,list,daily,settings"]);
  const tm = Store.fresh(), te = Store.fresh();
  tm.events.push(Store.clean(one));
  Store.merge(tm, { events: [], settings: { tabOrder: ["settings", "cal", "list", "daily"] } }, "2026-10-27");
  Store.merge(te, { events: [one], settings: { tabOrder: ["settings", "cal", "list", "daily"] } }, "2026-10-27");
  eq("足し合わせ タブの並びは空の端末だけファイルどおり", [tm.settings.tabOrder[0], te.settings.tabOrder[0]], ["cal", "settings"]);

  console.log(`${pass} 件 OK` + (fail ? ` / ${fail} 件 失敗` : ""));
  process.exit(fail ? 1 : 0);
})();
