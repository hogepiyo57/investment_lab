import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

interface RankingRow {
  handle_name: string;
  total_assets: number;
  unrealized_pl: number | null;
  created_at: string;
  rank: number;
}

interface HistoryRow {
  id: number;
  handle_name: string;
  total_assets: number;
  unrealized_pl: number | null;
  created_at: string;
}

const refreshBtn = document.getElementById("refresh-btn") as HTMLButtonElement;
const podiumEl = document.getElementById("podium") as HTMLElement;
const tbody = document.getElementById("ranking-tbody") as HTMLTableSectionElement;
const modal = document.getElementById("history-modal") as HTMLElement;
const modalTitle = document.getElementById("modal-title") as HTMLElement;
const modalClose = document.getElementById("modal-close") as HTMLButtonElement;
const chartCanvas = document.getElementById("history-chart") as HTMLCanvasElement;

let chartInstance: Chart | null = null;
let lastTopHandle: string | null = null;
let hasScrolledToMe = false;

const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });

function plClass(value: number | null): string {
  if (value === null || value === 0) return "pl-zero";
  return value > 0 ? "pl-positive" : "pl-negative";
}

function formatPl(value: number | null): string {
  if (value === null) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${yen.format(value)}`;
}

const myHandle = new URLSearchParams(location.search).get("me");

refreshBtn.addEventListener("click", () => loadRanking());

async function loadRanking(): Promise<void> {
  const res = await fetch("/api/ranking");
  const data = await res.json();
  if (!data.ok) return;
  renderRanking(data.ranking as RankingRow[]);
}

function renderRanking(ranking: RankingRow[]): void {
  renderPodium(ranking.slice(0, 3));
  renderTable(ranking);

  const currentTop = ranking[0]?.handle_name ?? null;
  if (currentTop && currentTop !== lastTopHandle && lastTopHandle !== null) {
    launchConfetti();
  }
  lastTopHandle = currentTop;
}

const MEDALS = ["🥇", "🥈", "🥉"];

function renderPodium(top3: RankingRow[]): void {
  podiumEl.innerHTML = "";
  top3.forEach((row, index) => {
    const card = document.createElement("div");
    card.className = `podium-card rank-${index + 1}${row.handle_name === myHandle ? " is-me" : ""}`;
    card.innerHTML = `
      <span class="podium-medal">${MEDALS[index]}</span>
      <div class="podium-name">${escapeHtml(row.handle_name)}</div>
      <div class="podium-assets">${yen.format(row.total_assets)}</div>
      <div class="podium-pl ${plClass(row.unrealized_pl)}">${formatPl(row.unrealized_pl)}</div>
    `;
    card.addEventListener("click", () => openHistory(row.handle_name));
    podiumEl.appendChild(card);
  });
}

function renderTable(ranking: RankingRow[]): void {
  tbody.innerHTML = "";
  for (const row of ranking) {
    const tr = document.createElement("tr");
    if (row.handle_name === myHandle) {
      tr.className = "is-me";
    }
    tr.innerHTML = `
      <td><span class="rank-badge">${row.rank}</span></td>
      <td>${escapeHtml(row.handle_name)}</td>
      <td>${yen.format(row.total_assets)}</td>
      <td class="${plClass(row.unrealized_pl)}">${formatPl(row.unrealized_pl)}</td>
    `;
    tr.addEventListener("click", () => openHistory(row.handle_name));
    tbody.appendChild(tr);
  }

  if (myHandle && !hasScrolledToMe) {
    const myRow = tbody.querySelector("tr.is-me");
    if (myRow) {
      myRow.scrollIntoView({ behavior: "smooth", block: "center" });
      hasScrolledToMe = true;
    }
  }
}

async function openHistory(handleName: string): Promise<void> {
  const res = await fetch(`/api/history?handle=${encodeURIComponent(handleName)}`);
  const data = await res.json();
  if (!data.ok) return;

  const history = data.history as HistoryRow[];
  modalTitle.textContent = `${handleName} さんの資産推移`;
  modal.hidden = false;

  const labels = history.map((h) =>
    new Date(h.created_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
  );

  chartInstance?.destroy();
  chartInstance = new Chart(chartCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "総資産",
          data: history.map((h) => h.total_assets),
          borderColor: "#5b8dff",
          backgroundColor: "rgba(91, 141, 255, 0.15)",
          tension: 0.3,
          fill: true,
        },
        {
          label: "含み損益",
          data: history.map((h) => h.unrealized_pl ?? null),
          borderColor: "#35d68f",
          backgroundColor: "rgba(53, 214, 143, 0.1)",
          tension: 0.3,
          fill: false,
          spanGaps: true,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#eef1fb" } },
      },
      scales: {
        x: { ticks: { color: "#9aa4c7" }, grid: { color: "rgba(154,164,199,0.1)" } },
        y: { ticks: { color: "#9aa4c7" }, grid: { color: "rgba(154,164,199,0.1)" } },
      },
    },
  });
}

modalClose.addEventListener("click", () => {
  modal.hidden = true;
});
modal.addEventListener("click", (event) => {
  if (event.target === modal) modal.hidden = true;
});

function launchConfetti(): void {
  const colors = ["#ffd166", "#5b8dff", "#35d68f", "#ff5c7a", "#7c5bff"];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = `${2 + Math.random() * 1.5}s`;
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 4000);
  }
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

(async function init() {
  await loadRanking();
  window.setInterval(loadRanking, 30_000);
})();
