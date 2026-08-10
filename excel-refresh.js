(function () {
  const TARGET_OFFICES = ["TP567", "TP512", "TP591", "TP767"];
  const GROUPS = ["個人組", "新人組"];
  const TOTAL_PAGES = 11;
  const REPORT_TITLE = "115年第三季競賽報表";
  const REPORT_SIG = "115 Q3 Contest";
  const REPORT_PERIOD = "競賽期間 115/06/26-115/09/29 · 統計至 115/08/06";
  const MONTH_LABELS = ["七月", "八月", "九月"];
  const COLUMNS = {
    rank: 0,
    division: 1,
    region: 2,
    office_code: 3,
    office_name: 4,
    name: 5,
    apr_verified: 6,
    apr_pending: 7,
    apr_total: 8,
    may_verified: 9,
    may_pending: 10,
    may_total: 11,
    jun_verified: 12,
    jun_pending: 13,
    jun_total: 14,
    personal_verified: 15,
    personal_pending: 16,
    personal_total: 17,
    critical_bonus: 18,
    care_bonus: 19,
    medical_bonus: 20,
    participating_bonus: 21,
    interest_bonus: 22,
    buyback_bonus: 23,
    group_bonus: 24,
    contest_verified: 25,
    contest_pending: 26,
    contest_total: 27,
    personal_no_investment: 28,
    base_period: 29,
  };
  const REACH_RULES = {
    "個人組": { monthly: 50000, quarter: 180000, reward: 25000, label: "每月5萬或季累計18萬" },
    "新人組": { monthly: 0, quarter: 80000, reward: 3000, label: "季累計8萬/11萬/14萬階梯獎勵" },
  };
  const NEWCOMER_TARGET_TIERS = [
    [180000, 13000, "18萬加發"],
    [140000, 12000, "14萬達標"],
    [110000, 6000, "11萬達標"],
    [80000, 3000, "8萬達標"],
  ];

  function cleanText(value) {
    if (value == null) return "";
    return String(value).trim().replace(/[\ue000-\uf8ff]/g, "");
  }

  function num(value) {
    if (value == null || value === "") return 0;
    if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
    const parsed = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function money(value) {
    return Math.round(Number(value || 0)).toLocaleString("zh-TW");
  }

  function compactMoney(value) {
    value = Math.round(Number(value || 0));
    if (value >= 10000) return `${(value / 10000).toFixed(1)}萬`;
    return money(value);
  }

  function pct(part, total) {
    return total ? `${(part / total * 100).toFixed(1)}%` : "0%";
  }

  function overReward(group, contestFyc, qualified) {
    if (!qualified) return 0;
    if (group === "個人組") {
      if (contestFyc < 250000) return 0;
      return 10000 + Math.floor(Math.max(0, contestFyc - 250000) / 100000) * 15000;
    }
    if (contestFyc < 200000) return 0;
    if (contestFyc < 250000) return 10000;
    return 20000 + Math.floor(Math.max(0, contestFyc - 250000) / 100000) * 15000;
  }

  function nextOverGap(group, contestFyc, qualified) {
    if (!qualified) return { label: "先取得達標", gap: 0 };
    if (group === "個人組") {
      if (contestFyc < 250000) return { label: "25萬", gap: 250000 - contestFyc };
      const nextTarget = 250000 + (Math.floor((contestFyc - 250000) / 100000) + 1) * 100000;
      return { label: `${Math.floor(nextTarget / 10000)}萬`, gap: nextTarget - contestFyc };
    }
    if (contestFyc < 200000) return { label: "20萬", gap: 200000 - contestFyc };
    if (contestFyc < 250000) return { label: "25萬", gap: 250000 - contestFyc };
    const nextTarget = 250000 + (Math.floor((contestFyc - 250000) / 100000) + 1) * 100000;
    return { label: `${Math.floor(nextTarget / 10000)}萬`, gap: nextTarget - contestFyc };
  }

  function rewardProgress(rec) {
    const rule = REACH_RULES[rec.group];
    let qualified;
    let reachGap;
    let targetReward;
    let reachThreshold;
    let reachNote;
    if (rec.group === "個人組") {
      const monthlyOk = ["apr_total", "may_total", "jun_total"].every(key => rec[key] >= rule.monthly);
      const quarterOk = rec.personal_total >= rule.quarter;
      qualified = monthlyOk || quarterOk;
      const quarterGap = Math.max(0, rule.quarter - rec.personal_total);
      const monthlyGap = ["apr_total", "may_total", "jun_total"]
        .reduce((sum, key) => sum + Math.max(0, rule.monthly - rec[key]), 0);
      reachGap = qualified ? 0 : Math.min(quarterGap, monthlyGap);
      targetReward = qualified ? rule.reward : 0;
      reachThreshold = rule.quarter;
      reachNote = qualified ? (quarterOk ? "季累計達標" : "月月達標") : `差${money(reachGap)}`;
    } else {
      targetReward = 0;
      reachNote = "";
      for (const [threshold, reward, label] of NEWCOMER_TARGET_TIERS) {
        if (rec.personal_total >= threshold) {
          targetReward = reward;
          reachNote = label;
          break;
        }
      }
      reachThreshold = NEWCOMER_TARGET_TIERS[NEWCOMER_TARGET_TIERS.length - 1][0];
      qualified = targetReward > 0;
      reachGap = qualified ? 0 : Math.max(0, reachThreshold - rec.personal_total);
      if (!qualified) reachNote = `差${money(reachGap)}`;
    }
    const over = overReward(rec.group, rec.contest_total, qualified);
    const next = nextOverGap(rec.group, rec.contest_total, qualified);
    return {
      reach_rule: rule.label,
      reach_qualified: qualified,
      reach_note: reachNote,
      reach_gap: reachGap,
      reach_threshold: reachThreshold,
      target_reward: targetReward,
      over_reward: over,
      total_reward: targetReward + over,
      next_over_label: next.label,
      next_over_gap: next.gap,
    };
  }

  function recordFromRow(group, row) {
    const rec = { group };
    for (const [key, idx] of Object.entries(COLUMNS)) {
      const value = row[idx];
      if (["division", "region", "office_code", "office_name", "name", "base_period"].includes(key)) {
        rec[key] = cleanText(value);
      } else {
        rec[key] = num(value);
      }
    }
    return Object.assign(rec, rewardProgress(rec));
  }

  function extractRecords(workbook) {
    const records = [];
    for (const group of GROUPS) {
      const sheet = workbook.Sheets[group];
      if (!sheet) throw new Error(`找不到「${group}」分頁`);
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
      for (const row of rows) {
        const officeCode = cleanText(row[COLUMNS.office_code]);
        const rank = row[COLUMNS.rank];
        if (TARGET_OFFICES.includes(officeCode) && typeof rank === "number") {
          records.push(recordFromRow(group, row));
        }
      }
    }
    return records;
  }

  function summarize(records) {
    const summary = {};
    for (const group of GROUPS) {
      const groupRecords = records.filter(r => r.group === group);
      summary[group] = summarizeRows(groupRecords);
      summary[group].offices = {};
      for (const office of TARGET_OFFICES) {
        const rows = groupRecords.filter(r => r.office_code === office);
        summary[group].offices[office] = Object.assign(summarizeRows(rows), {
          office_name: rows[0]?.office_name || "",
          top: rows.length ? rows.reduce((best, row) => row.contest_total > best.contest_total ? row : best, rows[0]) : null,
        });
      }
    }
    return summary;
  }

  function summarizeRows(rows) {
    return {
      count: rows.length,
      personal_total: rows.reduce((sum, r) => sum + r.personal_total, 0),
      contest_total: rows.reduce((sum, r) => sum + r.contest_total, 0),
      reach_count: rows.filter(r => r.reach_qualified).length,
      over_count: rows.filter(r => r.over_reward > 0).length,
      target_reward: rows.reduce((sum, r) => sum + r.target_reward, 0),
      over_reward: rows.reduce((sum, r) => sum + r.over_reward, 0),
      total_reward: rows.reduce((sum, r) => sum + r.total_reward, 0),
    };
  }

  function fullRows(records, group, office) {
    return records
      .filter(r => r.group === group && (!office || r.office_code === office))
      .sort((a, b) => (b.contest_total - a.contest_total) || (b.personal_total - a.personal_total));
  }

  function topRows(records, group, office, limit = 12) {
    return fullRows(records, group, office).slice(0, limit);
  }

  function sig() {
    return `<div class="slide-sig"><span class="dot"></span>${REPORT_SIG}</div>`;
  }

  function pg(n) {
    return `<div class="slide-pg">${String(n).padStart(2, "0")} / ${String(TOTAL_PAGES).padStart(2, "0")}</div>`;
  }

  function statusBadge(r) {
    const cls = r.reach_qualified ? "ok" : "wait";
    return `<span class="status-badge ${cls}">${esc(r.reach_note)}</span>`;
  }

  function personTable(rows, full = false) {
    if (!rows.length) return '<div class="empty">沒有資料</div>';
    const body = rows.map((r, i) => full ? `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${esc(r.name)}</strong><span class="person-unit">（${esc(r.office_code)} ${esc(r.office_name)}）</span></td>
        <td>${money(r.apr_total)}</td>
        <td>${money(r.may_total)}</td>
        <td>${money(r.jun_total)}</td>
        <td>${money(r.personal_total)}</td>
        <td>${money(r.contest_total)}</td>
        <td>${statusBadge(r)}</td>
        <td>${money(r.over_reward)}</td>
        <td>${money(r.total_reward)}</td>
      </tr>` : `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${esc(r.name)}</strong><span class="person-unit">（${esc(r.office_code)} ${esc(r.office_name)}）</span></td>
        <td>${money(r.personal_total)}</td>
        <td>${money(r.contest_total)}</td>
        <td>${statusBadge(r)}</td>
        <td>${money(r.over_reward)}</td>
        <td>${money(r.total_reward)}</td>
      </tr>`).join("");
    const header = full
      ? `<thead><tr><th>#</th><th>姓名（單位）</th><th>${MONTH_LABELS[0]}</th><th>${MONTH_LABELS[1]}</th><th>${MONTH_LABELS[2]}</th><th>個人險FYC</th><th>競賽FYC</th><th>達標</th><th>超標獎金</th><th>預估合計</th></tr></thead>`
      : "<thead><tr><th>#</th><th>姓名（單位）</th><th>個人險FYC</th><th>競賽FYC</th><th>達標</th><th>超標獎金</th><th>預估合計</th></tr></thead>";
    return `<table class="${full ? "data-table full-table" : "data-table"}">
      ${header}
      <tbody>${body}</tbody>
    </table>`;
  }

  function miniRewardTable(rows, mode) {
    if (!rows.length) return '<div class="empty">沒有資料</div>';
    const body = rows.map((r, i) => {
      let note = r.reach_note;
      if (mode === "gap") note = `達標差 ${money(r.reach_gap)}`;
      if (mode === "reward") note = `超標 ${money(r.over_reward)}`;
      if (mode === "next") note = `${r.next_over_label} 差 ${money(r.next_over_gap)}`;
      return `<tr>
        <td>${i + 1}</td>
        <td><strong>${esc(r.name)}</strong><span class="person-unit">（${esc(r.office_code)} ${esc(r.office_name)} · ${esc(r.group)}）</span></td>
        <td>${money(r.personal_total)}</td>
        <td>${money(r.contest_total)}</td>
        <td>${esc(note)}</td>
      </tr>`;
    }).join("");
    return `<table class="mini-table">
      <thead><tr><th>#</th><th>姓名</th><th>FYC</th><th>競賽FYC</th><th>狀態</th></tr></thead>
      <tbody>${body}</tbody>
    </table>`;
  }

  function coverSlide(summary, sourceName) {
    return `
      <div class="kicker animate-line" style="--i:0">全體合併呈現 · 每日 Excel 更新</div>
      <h1 class="animate-line" style="--i:1">${REPORT_TITLE}</h1>
      <p class="animate-line meta" style="--i:2">${REPORT_PERIOD}</p>
      <div class="cover-metrics deck-steps animate-line" style="--i:3">
        <div><span>01</span><label>選擇今日 Excel</label></div>
        <div><span>02</span><label>自動重算獎勵與資格</label></div>
        <div><span>03</span><label>投影佈達競賽進度</label></div>
      </div>
      <div class="upload-panel animate-line" style="--i:4">
        <label for="excel-upload">讀取每日更新 Excel</label>
        <div class="upload-row">
          <input id="excel-upload" type="file" accept=".xlsx,.xls,.xlsm">
          <span id="excel-upload-status">Excel 讀取功能已就緒，可選擇新版 Excel 重新計算。</span>
        </div>
      </div>
      ${sig()}${pg(1)}`;
  }

  function overviewSlide(summary) {
    const personal = summary["個人組"];
    const newcomer = summary["新人組"];
    const totalCount = personal.count + newcomer.count;
    const totalPersonal = personal.personal_total + newcomer.personal_total;
    const totalContest = personal.contest_total + newcomer.contest_total;
    const totalReach = personal.reach_count + newcomer.reach_count;
    const totalOver = personal.over_count + newcomer.over_count;
    const totalReward = personal.total_reward + newcomer.total_reward;
    const notReached = Math.max(totalCount - totalReach, 0);
    return `<div class="slide-header">
        <div><p class="meta">OVERVIEW</p><h2>全體戰情總覽</h2></div>
        <div class="pill">Excel 擷取版</div>
      </div>
      <div class="hero-metrics">
        <div><span>${totalCount}</span><label>參賽筆數</label></div>
        <div><span>${compactMoney(totalContest)}</span><label>累計競賽FYC</label></div>
        <div><span>${compactMoney(totalReward)}</span><label>目前預估獎金</label></div>
      </div>
      <div class="summary-strip">
        <div><span>${totalReach}</span><label>已達標</label></div>
        <div><span>${totalOver}</span><label>已有超標獎金</label></div>
        <div><span>${notReached}</span><label>尚未達標</label></div>
        <div><span>${compactMoney(totalPersonal)}</span><label>個人險FYC</label></div>
      </div>
      <div class="progress-cards">
        <article class="progress-card">
          <div class="progress-title">個人組</div>
          <div class="progress-big">${personal.reach_count} / ${personal.count}</div>
          <div class="progress-sub">已達標 · 競賽FYC ${compactMoney(personal.contest_total)}</div>
          <div class="bar"><span style="width:${personal.count ? personal.reach_count / personal.count * 100 : 0}%"></span></div>
        </article>
        <article class="progress-card">
          <div class="progress-title">新人組</div>
          <div class="progress-big">${newcomer.reach_count} / ${newcomer.count}</div>
          <div class="progress-sub">已達標 · 競賽FYC ${compactMoney(newcomer.contest_total)}</div>
          <div class="bar"><span style="width:${newcomer.count ? newcomer.reach_count / newcomer.count * 100 : 0}%"></span></div>
        </article>
      </div>
      ${sig()}${pg(2)}`;
  }

  function rulesSlide() {
    return `<div class="slide-header">
        <div><p class="meta">RULES</p><h2>本版呈現：Excel 達標與超標進度</h2></div>
        <div class="pill">以 Excel 數字為主</div>
      </div>
      <div class="rule-grid">
        <article class="rule-card primary">
          <p class="meta">達標獎勵</p><h3>只看個人險 FYC</h3><div class="rule-amount">個人組 25,000</div>
          <ul><li>個人組：每月皆達 5 萬，或季累計達 18 萬。</li><li>新人組：季累計 8 萬 / 11 萬 / 14 萬，獎金 3,000 / 6,000 / 12,000。</li><li>新人組個人險 FYC 達 18 萬，另加發 1,000 元。</li><li>加碼商品、團險、房貸等加成，不拿來判斷達標。</li></ul>
        </article>
        <article class="rule-card accent">
          <p class="meta">超標獎勵</p><h3>先達標，再看競賽 FYC</h3><div class="rule-amount">無上限</div>
          <ul><li>個人組：競賽 FYC 達 25 萬，超標獎金 10,000 元。</li><li>新人組：競賽 FYC 達 20 萬，超標獎金 10,000 元；達 25 萬為 20,000 元。</li><li>25 萬之後，每增加 10 萬再加 15,000 元。</li></ul>
        </article>
      </div>
      <div class="rule-note">預估合計只計入達標與超標獎勵；高標需另看個人險 FYC 成長率與基期，本版先作規則提醒，不混入獎金合計。</div>
      ${sig()}${pg(3)}`;
  }

  function rewardSummarySlide(summary) {
    const totalReach = summary["個人組"].reach_count + summary["新人組"].reach_count;
    const totalOver = summary["個人組"].over_count + summary["新人組"].over_count;
    const totalReward = summary["個人組"].total_reward + summary["新人組"].total_reward;
    const cards = GROUPS.map(group => {
      const data = summary[group];
      const width = data.count ? data.reach_count / data.count * 100 : 0;
      return `<article class="progress-card">
        <div class="progress-title">${group}</div>
        <div class="progress-big">${data.reach_count} / ${data.count}</div>
        <div class="progress-sub">已取得達標獎勵</div>
        <div class="bar"><span style="width:${width.toFixed(1)}%"></span></div>
        <div class="progress-stats">
          <div><b>${data.over_count}</b><span>超標</span></div>
          <div><b>${compactMoney(data.target_reward)}</b><span>達標獎金</span></div>
          <div><b>${compactMoney(data.over_reward)}</b><span>超標獎金</span></div>
        </div>
      </article>`;
    }).join("");
    return `<div class="slide-header">
        <div><p class="meta">REWARD PROGRESS</p><h2>獎勵進度總覽</h2></div>
        <div class="pill success">預估獎金 ${compactMoney(totalReward)}</div>
      </div>
      <div class="hero-metrics">
        <div><span>${totalReach}</span><label>已達標人數</label></div>
        <div><span>${totalOver}</span><label>已進入超標獎勵</label></div>
        <div><span>${compactMoney(totalReward)}</span><label>達標＋超標預估獎金</label></div>
      </div>
      <div class="progress-cards">${cards}</div>
      ${sig()}${pg(5)}`;
  }

  function travelSlide(records, summary) {
    const rows = records
      .filter(r => r.group === "新人組")
      .sort((a, b) => (b.personal_total - a.personal_total) || (b.contest_total - a.contest_total))
      .slice(0, 10);
    const totalReached = summary["新人組"].reach_count;
    const body = rows.map((r, i) => {
      const cls = r.reach_qualified ? "ok" : "wait";
      return `<tr>
        <td>${i + 1}</td>
        <td><strong>${esc(r.name)}</strong><span class="person-unit">（${esc(r.office_code)} ${esc(r.office_name)} · ${esc(r.group)}）</span></td>
        <td>${money(r.personal_total)}</td>
        <td>${money(r.target_reward)}</td>
        <td><span class="status-badge ${cls}">${esc(r.reach_note)}</span></td>
        <td>${esc(newcomerNextTier(r.personal_total))}</td>
      </tr>`;
    }).join("");
    return `<div class="slide-header">
        <div><p class="meta">NEWCOMER TARGET</p><h2>新人組達標階梯 · 個人險 FYC</h2></div>
        <div class="pill success">已達標 ${totalReached} 人</div>
      </div>
      <table class="data-table focus-table">
        <thead><tr><th>#</th><th>姓名（單位）</th><th>個人險FYC</th><th>達標獎金</th><th>目前級距</th><th>下一段</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <div class="rule-note travel-note">新人組第三季達標獎勵：8 萬 3,000、11 萬 6,000、14 萬 12,000；達 18 萬另加 1,000。</div>
      ${sig()}${pg(4)}`;
  }

  function newcomerNextTier(personalTotal) {
    for (let i = NEWCOMER_TARGET_TIERS.length - 1; i >= 0; i--) {
      const [threshold, _reward, label] = NEWCOMER_TARGET_TIERS[i];
      if (personalTotal < threshold) return `${label}差 ${money(threshold - personalTotal)}`;
    }
    return "最高級距";
  }

  function reachProgressSlide(records) {
    const almost = records.filter(r => !r.reach_qualified)
      .sort((a, b) => (a.reach_gap - b.reach_gap) || (b.personal_total - a.personal_total)).slice(0, 10);
    const reachedCount = records.filter(r => r.reach_qualified).length;
    return `<div class="slide-header">
        <div><p class="meta">REACH TARGET</p><h2>達標衝刺 · 最接近達標 Top 10</h2></div>
        <div class="pill">已達標 ${reachedCount} 人</div>
      </div>
      ${focusRewardTable(almost, "reach")}
      ${sig()}${pg(6)}`;
  }

  function overProgressSlide(records) {
    const nextRows = records.filter(r => r.reach_qualified)
      .sort((a, b) => (a.next_over_gap - b.next_over_gap) || (b.contest_total - a.contest_total)).slice(0, 10);
    const overCount = records.filter(r => r.over_reward > 0).length;
    return `<div class="slide-header">
        <div><p class="meta">OVER TARGET</p><h2>超標衝刺 · 下一段門檻 Top 10</h2></div>
        <div class="pill orange">已有超標 ${overCount} 人</div>
      </div>
      ${focusRewardTable(nextRows, "over")}
      ${sig()}${pg(7)}`;
  }

  function focusRewardTable(rows, mode) {
    if (!rows.length) return '<div class="empty">沒有資料</div>';
    const extraLabel = mode === "over" ? "目前超標獎金" : "達標門檻";
    const body = rows.map((r, i) => {
      const status = mode === "over"
        ? `${r.next_over_label} 差 ${money(r.next_over_gap)}`
        : `達標差 ${money(r.reach_gap)}`;
      const extraValue = mode === "over"
        ? money(r.over_reward)
        : money(r.reach_threshold || REACH_RULES[r.group]?.quarter || 0);
      return `<tr>
        <td>${i + 1}</td>
        <td><strong>${esc(r.name)}</strong><span class="person-unit">（${esc(r.office_code)} ${esc(r.office_name)} · ${esc(r.group)}）</span></td>
        <td>${money(r.personal_total)}</td>
        <td>${money(r.contest_total)}</td>
        <td>${extraValue}</td>
        <td><span class="status-badge wait">${esc(status)}</span></td>
      </tr>`;
    }).join("");
    return `<table class="data-table focus-table">
      <thead><tr><th>#</th><th>姓名（單位）</th><th>個人險FYC</th><th>競賽FYC</th><th>${extraLabel}</th><th>差距</th></tr></thead>
      <tbody>${body}</tbody>
    </table>`;
  }

  function rankingSlide(records, group, page) {
    return `<div class="slide-header">
        <div><p class="meta">RANKING</p><h2>${group} · 累計競賽FYC Top 10</h2></div>
        <div class="pill orange">${fullRows(records, group).length} 筆</div>
      </div>
      ${personTable(topRows(records, group, null, 10))}
      ${sig()}${pg(page)}`;
  }

  function officeSlide(records, summary, office, page) {
    const personal = summary["個人組"].offices[office];
    const newcomer = summary["新人組"].offices[office];
    const officeName = personal.office_name || newcomer.office_name;
    return `<div class="slide-header">
        <div><p class="meta">OFFICE DETAIL</p><h2>${office} ${esc(officeName)}</h2></div>
        <div class="pill success">個人 ${personal.count} · 新人 ${newcomer.count}</div>
      </div>
      <div class="detail-metrics">
        <div><span>${personal.reach_count + newcomer.reach_count}</span><label>已達標人數</label></div>
        <div><span>${personal.over_count + newcomer.over_count}</span><label>超標獎金人數</label></div>
        <div><span>${compactMoney(personal.total_reward + newcomer.total_reward)}</span><label>預估獎金合計</label></div>
      </div>
      <div class="two-col">
        <div><h3>個人組前 6 名</h3>${personTable(topRows(records, "個人組", office, 6))}</div>
        <div><h3>新人組前 6 名</h3>${personTable(topRows(records, "新人組", office, 6))}</div>
      </div>
      ${sig()}${pg(page)}`;
  }

  function fullDataSlide(records, group, page) {
    return `<div class="slide-header">
        <div><p class="meta">FULL DATA</p><h2>${group} · 全體完整清單</h2></div>
        <div class="header-actions">
          <button class="pdf-export-btn" type="button" onclick="exportFullListPdf('${group}')">輸出PDF</button>
          <div class="pill gold">${fullRows(records, group).length} 筆資料</div>
        </div>
      </div>
      <div class="table-scroll">${personTable(fullRows(records, group), true)}</div>
      ${sig()}${pg(page)}`;
  }

  function getCurrentPayload() {
    const node = document.getElementById("excel-data");
    if (!node) throw new Error("找不到目前資料");
    return JSON.parse(node.textContent || "{}");
  }

  function pdfCell(value) {
    return esc(value == null || value === "" ? "-" : value);
  }

  function pdfMoney(value) {
    return money(value || 0);
  }

  function buildFullListReport(group) {
    const payload = getCurrentPayload();
    const records = payload.records || [];
    const summary = payload.summary || summarize(records);
    const rows = fullRows(records, group);
    const groupSummary = summary[group] || summarizeRows(rows);
    const source = payload.source ? String(payload.source).split("/").pop() : "Excel";
    const today = new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
    const body = rows.map((r, i) => `<tr>
      <td>${i + 1}</td>
      <td>${pdfCell(r.name)}</td>
      <td>${pdfCell(`${r.office_code} ${r.office_name}`)}</td>
      <td>${pdfMoney(r.apr_total)}</td>
      <td>${pdfMoney(r.may_total)}</td>
      <td>${pdfMoney(r.jun_total)}</td>
      <td>${pdfMoney(r.personal_total)}</td>
      <td>${pdfMoney(r.contest_total)}</td>
      <td>${pdfCell(r.reach_note)}</td>
      <td>${pdfMoney(r.over_reward)}</td>
      <td>${pdfMoney(r.total_reward)}</td>
    </tr>`).join("");
    return `<section class="pdf-report">
      <div class="pdf-report-header">
        <div>
          <h1>${esc(REPORT_TITLE)}｜${esc(group)}全體完整清單</h1>
          <div class="pdf-report-meta">${esc(REPORT_PERIOD)}｜資料來源：${esc(source)}｜輸出日：${esc(today)}</div>
        </div>
        <div class="pdf-report-meta">A4 直式</div>
      </div>
      <div class="pdf-report-summary">
        <div><b>${groupSummary.count}</b><span>筆資料</span></div>
        <div><b>${pdfMoney(groupSummary.personal_total)}</b><span>個人險FYC</span></div>
        <div><b>${pdfMoney(groupSummary.contest_total)}</b><span>競賽FYC</span></div>
        <div><b>${groupSummary.reach_count}</b><span>已達標</span></div>
        <div><b>${pdfMoney(groupSummary.total_reward)}</b><span>達標＋超標</span></div>
      </div>
      <table class="pdf-report-table">
        <thead><tr><th>#</th><th>姓名</th><th>單位</th><th>${MONTH_LABELS[0]}</th><th>${MONTH_LABELS[1]}</th><th>${MONTH_LABELS[2]}</th><th>個人險FYC</th><th>競賽FYC</th><th>達標</th><th>超標</th><th>合計</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>`;
  }

  function ensurePdfReportRoot() {
    let root = document.getElementById("pdf-report-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "pdf-report-root";
      root.className = "pdf-report-root";
      document.body.appendChild(root);
    }
    return root;
  }

  window.exportFullListPdf = function (group) {
    const root = ensurePdfReportRoot();
    root.innerHTML = buildFullListReport(group);
    document.body.classList.add("pdf-exporting");
    requestAnimationFrame(() => window.print());
  };

  window.addEventListener("afterprint", () => {
    document.body.classList.remove("pdf-exporting");
  });

  function renderDeck(payload, sourceName) {
    const records = payload.records;
    const summary = payload.summary || summarize(records);
    const slides = Array.from(document.querySelectorAll(".slide"));
    const contents = [
      { cls: "slide cover title-slide", html: coverSlide(summary, sourceName) },
      { cls: "slide slide-grid", html: overviewSlide(summary) },
      { cls: "slide rule-slide", html: rulesSlide() },
      { cls: "slide travel-slide focus-slide", html: travelSlide(records, summary) },
      { cls: "slide reward-overview", html: rewardSummarySlide(summary) },
      { cls: "slide reach-slide focus-slide", html: reachProgressSlide(records) },
      { cls: "slide over-slide focus-slide", html: overProgressSlide(records) },
      { cls: "slide ranking-slide", html: rankingSlide(records, "個人組", 8) },
      { cls: "slide ranking-slide", html: rankingSlide(records, "新人組", 9) },
      { cls: "slide full-data", html: fullDataSlide(records, "個人組", 10) },
      { cls: "slide full-data", html: fullDataSlide(records, "新人組", 11) },
    ];
    contents.forEach((item, i) => {
      if (!slides[i]) return;
      slides[i].className = item.cls;
      slides[i].innerHTML = item.html;
    });
    if (typeof window.render === "function") window.render();
  }

  function updatePayload(records, fileName) {
    const payload = {
      source: fileName,
      targets: TARGET_OFFICES,
      groups: GROUPS,
      count: records.length,
      summary: summarize(records),
      records,
    };
    const node = document.getElementById("excel-data");
    if (node) node.textContent = JSON.stringify(payload);
    renderDeck(payload, fileName);
    return payload;
  }

  async function handleFile(file) {
    const status = document.getElementById("excel-upload-status");
    if (status) status.textContent = `讀取中：${file.name}`;
    try {
      if (!window.XLSX) throw new Error("Excel 解析器尚未載入");
      const bytes = await file.arrayBuffer();
      const workbook = XLSX.read(bytes, { type: "array" });
      const records = extractRecords(workbook);
      if (!records.length) throw new Error("沒有抓到 TP567、TP512、TP591、TP767 的資料");
      const payload = updatePayload(records, file.name);
      const nextStatus = document.getElementById("excel-upload-status");
      if (nextStatus) {
        const totalReward = payload.summary["個人組"].total_reward + payload.summary["新人組"].total_reward;
        nextStatus.textContent = `已讀取 ${file.name}：${records.length} 筆，預估獎金 ${compactMoney(totalReward)}。按下一頁開始投影。`;
      }
      const nextInput = document.getElementById("excel-upload");
      if (nextInput) nextInput.value = "";
    } catch (error) {
      const nextStatus = document.getElementById("excel-upload-status");
      if (nextStatus) nextStatus.textContent = `讀取失敗：${error.message}`;
      const nextInput = document.getElementById("excel-upload");
      if (nextInput) nextInput.value = "";
      console.error(error);
    }
  }

  document.addEventListener("change", event => {
    if (event.target && event.target.id === "excel-upload" && event.target.files?.[0]) {
      handleFile(event.target.files[0]);
    }
  });

  document.documentElement.dataset.excelRefreshReady = "1";
  document.documentElement.dataset.xlsxReady = window.XLSX ? "1" : "0";
  function resetUploadHome() {
    const input = document.getElementById("excel-upload");
    const status = document.getElementById("excel-upload-status");
    if (input) input.value = "";
    if (status && window.XLSX) {
      status.textContent = "Excel 讀取功能已就緒，可選擇新版 Excel 重新計算。";
    }
  }
  resetUploadHome();
  window.addEventListener("pageshow", event => {
    if (event.persisted) resetUploadHome();
  });

  window.refreshCompetitionFromWorkbook = function (workbook, sourceName) {
    const records = extractRecords(workbook);
    return updatePayload(records, sourceName || "Excel");
  };
})();
