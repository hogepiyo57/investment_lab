import { Chart, registerables, type ChartConfiguration, type TooltipItem } from "chart.js";

Chart.register(...registerables);

interface Student {
  handle_name: string;
  pin: string | null;
  created_at: string;
}

interface Entry {
  id: number;
  handle_name: string;
  total_assets: number;
  unrealized_pl: number | null;
  created_at: string;
}

interface Summary extends Student {
  entries: Entry[];
  first: Entry | null;
  latest: Entry | null;
  change: number | null;
}

// 配色は dataviz の検証スクリプトでカード背景(#1a2340)に対して検証済み
const COLOR = {
  series1: "#3987e5",
  series2: "#d95926",
  grid: "#2a3760",
  tick: "#9aa4c7",
  text: "#eef1fb",
};

Chart.defaults.color = COLOR.tick;
Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const loginView = $("login-view");
const appView = $("app-view");
const toastEl = $("toast");

let students: Student[] = [];
let entries: Entry[] = [];
let summaries: Summary[] = [];
let activeTab: "overview" | "students" = "overview";
let selectedHandle: string | null = null;
let editingEntryId: number | null = null;
let sortKey = "latest";
let sortAsc = false;
const charts = new Map<string, Chart>();

// ---------- 書式 ----------
const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const jstDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function signedYen(value: number | null): string {
  if (value === null) return "-";
  return `${value > 0 ? "+" : ""}${yen.format(value)}`;
}

function percent(ratio: number | null): string {
  if (ratio === null) return "-";
  return `${ratio > 0 ? "+" : ""}${(ratio * 100).toFixed(1)}%`;
}

function signClass(value: number | null): string {
  if (value === null || value === 0) return "pl-zero";
  return value > 0 ? "pl-positive" : "pl-negative";
}

function compactYen(value: number): string {
  if (Math.abs(value) >= 10000) return `${(value / 10000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万`;
  return value.toLocaleString("ja-JP");
}

function dayKey(iso: string): string {
  return jstDay.format(new Date(iso));
}

function shortDay(key: string): string {
  const [, m, d] = key.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalInputValue(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  return text === "" ? null : Number(text);
}

// ---------- 通信 ----------
class AuthError extends Error {}

async function api<T = { ok: true }>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401 && path !== "/api/admin/login") {
    showLogin();
    throw new AuthError(data?.error ?? "ログインが必要です。");
  }
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? "エラーが発生しました。");
  return data as T;
}

let toastTimer = 0;
function toast(message: string, isError = false): void {
  toastEl.textContent = message;
  toastEl.classList.toggle("is-error", isError);
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastEl.hidden = true), 3000);
}

async function run(action: () => Promise<void>, successMessage?: string): Promise<void> {
  try {
    await action();
    if (successMessage) toast(successMessage);
  } catch (error) {
    if (!(error instanceof AuthError)) toast((error as Error).message, true);
  }
}

async function loadData(): Promise<void> {
  const data = await api<{ students: Student[]; entries: Entry[] }>("/api/admin/data");
  students = data.students;
  entries = data.entries;
  buildSummaries();
  render();
}

function buildSummaries(): void {
  const byHandle = new Map<string, Entry[]>();
  for (const entry of entries) {
    const list = byHandle.get(entry.handle_name) ?? [];
    list.push(entry);
    byHandle.set(entry.handle_name, list);
  }
  summaries = students.map((student) => {
    const list = byHandle.get(student.handle_name) ?? [];
    const first = list[0] ?? null;
    const latest = list[list.length - 1] ?? null;
    const change =
      first && latest && first.total_assets !== 0 ? (latest.total_assets - first.total_assets) / first.total_assets : null;
    return { ...student, entries: list, first, latest, change };
  });
}

// ---------- 画面切り替え ----------
function showLogin(): void {
  appView.hidden = true;
  loginView.hidden = false;
  $<HTMLInputElement>("admin-password").focus();
}

async function showApp(): Promise<void> {
  loginView.hidden = true;
  appView.hidden = false;
  await run(loadData);
}

function setTab(tab: "overview" | "students"): void {
  activeTab = tab;
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  $("tab-overview").hidden = tab !== "overview";
  $("tab-students").hidden = tab !== "students";
  render();
}

function openStudent(handle: string): void {
  selectedHandle = handle;
  editingEntryId = null;
  resetAddEntryForm();
  if (activeTab !== "students") setTab("students");
  else render();
  window.scrollTo({ top: 0 });
}

function closeStudent(): void {
  selectedHandle = null;
  editingEntryId = null;
  render();
}

function render(): void {
  if (activeTab === "overview") {
    renderOverview();
    return;
  }
  const detail = selectedHandle ? summaries.find((s) => s.handle_name === selectedHandle) : undefined;
  if (selectedHandle && !detail) selectedHandle = null;
  $("student-list-view").hidden = Boolean(detail);
  $("student-detail-view").hidden = !detail;
  if (detail) renderDetail(detail);
  else renderStudentList();
}

// ---------- グラフ ----------
function drawChart(key: string, canvas: HTMLCanvasElement, config: ChartConfiguration): void {
  charts.get(key)?.destroy();
  charts.set(key, new Chart(canvas, config));
}

function axes(yFormat: (v: number) => string, integerY = false) {
  return {
    x: { grid: { display: false }, ticks: { color: COLOR.tick, maxRotation: 0, autoSkipPadding: 12 } },
    y: {
      beginAtZero: integerY,
      grid: { color: COLOR.grid },
      border: { display: false },
      ticks: { color: COLOR.tick, precision: integerY ? 0 : undefined, callback: (v: string | number) => yFormat(Number(v)) },
    },
  };
}

// ---------- 概要 ----------
function kpi(label: string, value: string, sub = "", valueClass = ""): string {
  return `<div class="kpi">
    <p class="kpi-label">${escapeHtml(label)}</p>
    <p class="kpi-value ${valueClass}">${escapeHtml(value)}</p>
    ${sub ? `<p class="kpi-sub">${escapeHtml(sub)}</p>` : ""}
  </div>`;
}

function renderOverview(): void {
  const reported = summaries.filter((s) => s.latest);
  const latestValues = reported.map((s) => s.latest!.total_assets);
  const changes = reported.map((s) => s.change).filter((c): c is number => c !== null);
  const today = jstDay.format(new Date());
  const reportedToday = new Set(entries.filter((e) => dayKey(e.created_at) === today).map((e) => e.handle_name));
  const byAssets = [...reported].sort((a, b) => b.latest!.total_assets - a.latest!.total_assets);
  const top = byAssets[0];
  const bottom = byAssets[byAssets.length - 1];
  const totalPl = reported.reduce((sum, s) => sum + (s.latest!.unrealized_pl ?? 0), 0);

  $("kpi-grid").innerHTML = [
    kpi("登録生徒数", `${students.length}人`, `報告あり ${reported.length}人`),
    kpi("平均総資産", latestValues.length ? yen.format(average(latestValues)) : "-", latestValues.length ? `中央値 ${yen.format(median(latestValues))}` : ""),
    kpi("最高総資産", top ? yen.format(top.latest!.total_assets) : "-", top?.handle_name ?? ""),
    kpi("最低総資産", bottom ? yen.format(bottom.latest!.total_assets) : "-", bottom?.handle_name ?? ""),
    kpi("平均騰落率", changes.length ? percent(average(changes)) : "-", "初回報告からの増減", changes.length ? signClass(average(changes)) : ""),
    kpi("含み損益の合計", signedYen(totalPl), "最新の報告値", signClass(totalPl)),
    kpi("今日の報告", `${reportedToday.size} / ${students.length}人`, today.replace(/-/g, "/")),
  ].join("");

  renderTrendChart();
  renderDistributionChart(latestValues);
  renderReportsChart();
  renderMovers();

  const unreported = summaries.filter((s) => !reportedToday.has(s.handle_name));
  $("unreported-note").textContent = `${unreported.length}人 / ${students.length}人中(名前を押すと生徒の詳細を開きます)`;
  $("unreported").innerHTML = unreported.length
    ? unreported.map((s) => `<button type="button" class="chip" data-handle="${escapeHtml(s.handle_name)}">${escapeHtml(s.handle_name)}</button>`).join("")
    : `<p class="empty-text">全員報告済みです。</p>`;
}

function renderTrendChart(): void {
  const keyed = summaries.map((s) => s.entries.map((e) => ({ day: dayKey(e.created_at), value: e.total_assets })));
  const days = [...new Set(keyed.flat().map((e) => e.day))].sort();
  const pointers = keyed.map(() => -1);
  const means: number[] = [];
  const medians: number[] = [];

  for (const day of days) {
    const values: number[] = [];
    keyed.forEach((list, i) => {
      while (pointers[i] + 1 < list.length && list[pointers[i] + 1].day <= day) pointers[i]++;
      if (pointers[i] >= 0) values.push(list[pointers[i]].value);
    });
    means.push(average(values));
    medians.push(median(values));
  }

  drawChart("trend", $("trend-chart"), {
    type: "line",
    data: {
      labels: days.map(shortDay),
      datasets: [
        { label: "平均", data: means, borderColor: COLOR.series1, backgroundColor: COLOR.series1, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0 },
        { label: "中央値", data: medians, borderColor: COLOR.series2, backgroundColor: COLOR.series2, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top", align: "end", labels: { color: COLOR.text, usePointStyle: true, boxWidth: 8 } },
        tooltip: { callbacks: { label: (c: TooltipItem<"line">) => `${c.dataset.label}: ${yen.format(c.parsed.y ?? 0)}` } },
      },
      scales: axes(compactYen),
    },
  });
}

function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * power >= raw) return m * power;
  return 10 * power;
}

function renderDistributionChart(values: number[]): void {
  let labels: string[] = [];
  let ranges: string[] = [];
  let counts: number[] = [];

  if (values.length) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
      labels = [compactYen(min)];
      ranges = [yen.format(min)];
      counts = [values.length];
    } else {
      const step = niceStep((max - min) / 8);
      const start = Math.floor(min / step) * step;
      const binCount = Math.floor((max - start) / step) + 1;
      counts = Array(binCount).fill(0);
      for (const v of values) counts[Math.min(binCount - 1, Math.floor((v - start) / step))]++;
      labels = counts.map((_, i) => `${compactYen(start + i * step)}〜`);
      ranges = counts.map((_, i) => `${yen.format(start + i * step)} 〜 ${yen.format(start + (i + 1) * step)}未満`);
    }
  }

  drawChart("dist", $("dist-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "人数", data: counts, backgroundColor: COLOR.series1, borderRadius: 4, barPercentage: 0.94, categoryPercentage: 1 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: (items: TooltipItem<"bar">[]) => ranges[items[0].dataIndex], label: (c: TooltipItem<"bar">) => `${c.parsed.y}人` } },
      },
      scales: axes((v) => `${v}人`, true),
    },
  });
}

function renderReportsChart(): void {
  const perDay = new Map<string, Set<string>>();
  for (const e of entries) {
    const key = dayKey(e.created_at);
    const set = perDay.get(key) ?? new Set<string>();
    set.add(e.handle_name);
    perDay.set(key, set);
  }
  const days = [...perDay.keys()].sort();

  drawChart("reports", $("reports-chart"), {
    type: "bar",
    data: {
      labels: days.map(shortDay),
      datasets: [{ label: "報告人数", data: days.map((d) => perDay.get(d)!.size), backgroundColor: COLOR.series1, borderRadius: 4, barPercentage: 0.8 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c: TooltipItem<"bar">) => `${c.parsed.y}人が報告` } },
      },
      scales: axes((v) => `${v}人`, true),
    },
  });
}

function moverRow(s: Summary, rank: number): string {
  return `<tr class="clickable" data-handle="${escapeHtml(s.handle_name)}">
    <td class="rank">${rank}</td>
    <td><button type="button" class="link-btn" data-handle="${escapeHtml(s.handle_name)}">${escapeHtml(s.handle_name)}</button></td>
    <td class="num ${signClass(s.change)}">${percent(s.change)}</td>
    <td class="num muted">${yen.format(s.latest!.total_assets)}</td>
  </tr>`;
}

function renderMovers(): void {
  const ranked = summaries.filter((s) => s.change !== null).sort((a, b) => b.change! - a.change!);
  const empty = `<tr><td class="muted">報告がまだありません。</td></tr>`;
  $("top-tbody").innerHTML = ranked.length ? ranked.slice(0, 5).map((s, i) => moverRow(s, i + 1)).join("") : empty;
  $("bottom-tbody").innerHTML = ranked.length
    ? [...ranked].reverse().slice(0, 5).map((s, i) => moverRow(s, ranked.length - i)).join("")
    : empty;
}

// ---------- 生徒一覧 ----------
function sortValue(s: Summary, key: string): number | string {
  switch (key) {
    case "handle_name":
      return s.handle_name;
    case "latest":
      return s.latest?.total_assets ?? -Infinity;
    case "pl":
      return s.latest?.unrealized_pl ?? -Infinity;
    case "change":
      return s.change ?? -Infinity;
    case "count":
      return s.entries.length;
    case "last":
      return s.latest?.created_at ?? "";
    default:
      return 0;
  }
}

function renderStudentList(): void {
  const query = $<HTMLInputElement>("student-search").value.trim();
  const showPins = $<HTMLInputElement>("show-pins").checked;
  const rows = summaries
    .filter((s) => s.handle_name.includes(query))
    .sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string, "ja") : va - (vb as number);
      return sortAsc ? cmp : -cmp;
    });

  document.querySelectorAll<HTMLButtonElement>(".sort-btn").forEach((btn) => {
    btn.classList.toggle("is-sorted", btn.dataset.sort === sortKey);
    btn.classList.toggle("asc", btn.dataset.sort === sortKey && sortAsc);
  });

  $("students-tbody").innerHTML = rows
    .map((s) => {
      const pin = s.pin ? (showPins ? escapeHtml(s.pin) : "••••") : `<span class="muted">未確認</span>`;
      return `<tr data-handle="${escapeHtml(s.handle_name)}">
        <td>${escapeHtml(s.handle_name)}</td>
        <td class="pin-cell">${pin}</td>
        <td class="num">${s.latest ? yen.format(s.latest.total_assets) : "-"}</td>
        <td class="num ${signClass(s.latest?.unrealized_pl ?? null)}">${signedYen(s.latest?.unrealized_pl ?? null)}</td>
        <td class="num ${signClass(s.change)}">${percent(s.change)}</td>
        <td class="num">${s.entries.length}</td>
        <td class="nowrap ${s.latest ? "" : "muted"}">${s.latest ? formatDateTime(s.latest.created_at) : "未報告"}</td>
        <td><button type="button" class="link-btn" data-handle="${escapeHtml(s.handle_name)}">詳細</button></td>
      </tr>`;
    })
    .join("");
  $("students-empty").hidden = summaries.length > 0;
}

// ---------- 生徒詳細 ----------
function resetAddEntryForm(): void {
  const form = $<HTMLFormElement>("add-entry-form");
  form.reset();
  (form.elements.namedItem("createdAt") as HTMLInputElement).value = toLocalInputValue(new Date());
}

function renderDetail(s: Summary): void {
  $("detail-title").textContent = `${s.handle_name} さん`;

  const profile = $<HTMLFormElement>("profile-form");
  (profile.elements.namedItem("newHandleName") as HTMLInputElement).value = s.handle_name;
  (profile.elements.namedItem("pin") as HTMLInputElement).value = s.pin ?? "";
  $("pin-unknown-note").hidden = Boolean(s.pin);

  $("detail-kpis").innerHTML = [
    kpi("最新総資産", s.latest ? yen.format(s.latest.total_assets) : "-", s.latest ? `最終報告 ${formatDateTime(s.latest.created_at)}` : "未報告"),
    kpi("騰落率", percent(s.change), s.first ? `初回 ${yen.format(s.first.total_assets)}` : "", signClass(s.change)),
    kpi("含み損益(最新)", signedYen(s.latest?.unrealized_pl ?? null), "", signClass(s.latest?.unrealized_pl ?? null)),
    kpi("報告回数", `${s.entries.length}回`, s.first ? `初回 ${formatDateTime(s.first.created_at)}` : ""),
  ].join("");

  drawChart("student", $("student-chart"), {
    type: "line",
    data: {
      labels: s.entries.map((e) => formatDateTime(e.created_at)),
      datasets: [
        { label: "総資産", data: s.entries.map((e) => e.total_assets), borderColor: COLOR.series1, backgroundColor: COLOR.series1, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c: TooltipItem<"line">) => `総資産: ${yen.format(c.parsed.y ?? 0)}`,
            afterLabel: (c: TooltipItem<"line">) => `含み損益: ${signedYen(s.entries[c.dataIndex].unrealized_pl)}`,
          },
        },
      },
      scales: axes(compactYen),
    },
  });

  const rows = [...s.entries].reverse();
  $("entries-tbody").innerHTML = rows
    .map((e) =>
      e.id === editingEntryId
        ? `<tr data-id="${e.id}">
            <td><input type="datetime-local" class="input" name="createdAt" value="${toLocalInputValue(new Date(e.created_at))}" /></td>
            <td><input type="number" class="input num" name="totalAssets" value="${e.total_assets}" /></td>
            <td><input type="number" class="input num" name="unrealizedPl" value="${e.unrealized_pl ?? ""}" /></td>
            <td class="actions">
              <button type="button" class="link-btn" data-action="save" data-id="${e.id}">保存</button>
              <button type="button" class="link-btn" data-action="cancel">キャンセル</button>
            </td>
          </tr>`
        : `<tr data-id="${e.id}">
            <td>${formatDateTime(e.created_at)}</td>
            <td class="num">${yen.format(e.total_assets)}</td>
            <td class="num ${signClass(e.unrealized_pl)}">${signedYen(e.unrealized_pl)}</td>
            <td class="actions">
              <button type="button" class="link-btn" data-action="edit" data-id="${e.id}">修正</button>
              <button type="button" class="link-btn danger" data-action="delete" data-id="${e.id}">削除</button>
            </td>
          </tr>`
    )
    .join("");
  $("entries-empty").hidden = s.entries.length > 0;
}

// ---------- イベント ----------
$<HTMLFormElement>("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorEl = $("login-error");
  errorEl.hidden = true;
  try {
    await api("/api/admin/login", "POST", { password: $<HTMLInputElement>("admin-password").value });
    $<HTMLInputElement>("admin-password").value = "";
    await showApp();
  } catch (error) {
    errorEl.textContent = (error as Error).message;
    errorEl.hidden = false;
  }
});

$("logout-btn").addEventListener("click", () =>
  run(async () => {
    await api("/api/admin/logout", "POST");
    showLogin();
  })
);

$("reload-btn").addEventListener("click", () => run(loadData, "最新のデータを読み込みました。"));

document.querySelectorAll<HTMLButtonElement>(".tab").forEach((btn) =>
  btn.addEventListener("click", () => setTab(btn.dataset.tab as "overview" | "students"))
);

// 概要タブの名前(未報告者・騰落率表)から生徒詳細を開く
$("tab-overview").addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-handle]");
  if (target) openStudent(target.dataset.handle!);
});

$("student-search").addEventListener("input", renderStudentList);
$("show-pins").addEventListener("change", renderStudentList);

document.querySelectorAll<HTMLButtonElement>(".sort-btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    const key = btn.dataset.sort!;
    sortAsc = key === sortKey ? !sortAsc : key === "handle_name";
    sortKey = key;
    renderStudentList();
  })
);

$("students-tbody").addEventListener("click", (event) => {
  const row = (event.target as HTMLElement).closest<HTMLElement>("tr[data-handle]");
  if (row) openStudent(row.dataset.handle!);
});

$<HTMLFormElement>("add-student-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  run(async () => {
    await api("/api/admin/students", "POST", { handleName: data.get("handleName"), pin: data.get("pin") });
    form.reset();
    await loadData();
  }, `「${String(data.get("handleName")).trim()}」を追加しました。`);
});

$("back-btn").addEventListener("click", closeStudent);

$<HTMLFormElement>("profile-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selectedHandle) return;
  const data = new FormData(event.currentTarget as HTMLFormElement);
  const original = selectedHandle;
  run(async () => {
    const result = await api<{ handleName: string }>("/api/admin/students", "PUT", {
      handleName: original,
      newHandleName: data.get("newHandleName"),
      pin: String(data.get("pin") ?? "").trim(),
    });
    selectedHandle = result.handleName;
    await loadData();
  }, "保存しました。");
});

$("delete-student-btn").addEventListener("click", () => {
  const s = summaries.find((x) => x.handle_name === selectedHandle);
  if (!s) return;
  const ok = confirm(`「${s.handle_name}」さんと、報告記録${s.entries.length}件をすべて削除します。\n元に戻せません。よろしいですか?`);
  if (!ok) return;
  run(async () => {
    await api("/api/admin/students", "DELETE", { handleName: s.handle_name });
    selectedHandle = null;
    await loadData();
  }, `「${s.handle_name}」さんを削除しました。`);
});

$<HTMLFormElement>("add-entry-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selectedHandle) return;
  const data = new FormData(event.currentTarget as HTMLFormElement);
  const handle = selectedHandle;
  run(async () => {
    await api("/api/admin/entries", "POST", {
      handleName: handle,
      createdAt: new Date(String(data.get("createdAt"))).toISOString(),
      totalAssets: Number(data.get("totalAssets")),
      unrealizedPl: optionalNumber(data.get("unrealizedPl")),
    });
    resetAddEntryForm();
    await loadData();
  }, "記録を追加しました。");
});

$("entries-tbody").addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
  if (!button) return;
  const id = Number(button.dataset.id);

  switch (button.dataset.action) {
    case "edit":
      editingEntryId = id;
      render();
      break;
    case "cancel":
      editingEntryId = null;
      render();
      break;
    case "save": {
      const row = button.closest("tr")!;
      const value = (name: string) => (row.querySelector(`[name="${name}"]`) as HTMLInputElement).value;
      run(async () => {
        await api("/api/admin/entries", "PUT", {
          id,
          createdAt: new Date(value("createdAt")).toISOString(),
          totalAssets: Number(value("totalAssets")),
          unrealizedPl: optionalNumber(value("unrealizedPl")),
        });
        editingEntryId = null;
        await loadData();
      }, "記録を修正しました。");
      break;
    }
    case "delete":
      if (!confirm("この記録を削除します。よろしいですか?")) return;
      run(async () => {
        await api("/api/admin/entries", "DELETE", { id });
        await loadData();
      }, "記録を削除しました。");
      break;
  }
});

(async function init() {
  const { ok } = await fetch("/api/admin/session").then((r) => r.json()).catch(() => ({ ok: false }));
  if (ok) await showApp();
  else showLogin();
})();
