const STORAGE_KEY = "investment-lab:last-login";

interface StoredLogin {
  handleName: string;
  pin: string;
}

function loadStoredLogin(): StoredLogin | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredLogin) : null;
  } catch {
    return null;
  }
}

function saveStoredLogin(data: StoredLogin): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorageが使えない環境では無視する
  }
}

const loginForm = document.getElementById("login-form") as HTMLFormElement;
const handleNameInput = document.getElementById("handleName") as HTMLInputElement;
const pinInput = document.getElementById("pin") as HTMLInputElement;
const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;

const entryForm = document.getElementById("entry-form") as HTMLFormElement;
const backBtn = document.getElementById("back-btn") as HTMLButtonElement;
const whoName = document.getElementById("who-name") as HTMLSpanElement;
const newNote = document.getElementById("new-note") as HTMLParagraphElement;
const totalAssetsInput = document.getElementById("totalAssets") as HTMLInputElement;
const plTypeSelect = document.getElementById("plType") as HTMLSelectElement;
const plAmountInput = document.getElementById("plAmount") as HTMLInputElement;
const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement;
const resultBox = document.getElementById("result") as HTMLDivElement;

// 1画面目で確かめたハンドルネームとPIN
let verified: (StoredLogin & { isNewStudent: boolean }) | null = null;

const stored = loadStoredLogin();
if (stored) {
  handleNameInput.value = stored.handleName;
  pinInput.value = stored.pin;
}

function showResult(message: string, kind: "success" | "error"): void {
  resultBox.textContent = message;
  resultBox.className = `result ${kind}`;
  resultBox.hidden = false;
}

function hideResult(): void {
  resultBox.hidden = true;
}

function showStep(step: 1 | 2): void {
  loginForm.hidden = step !== 1;
  entryForm.hidden = step !== 2;
  hideResult();
  (step === 1 ? handleNameInput : totalAssetsInput).focus();
}

// 選んだ種類に合わせて色を変え、どちらを選んだか一目でわかるようにする
function updatePlTypeStyle(): void {
  plTypeSelect.classList.toggle("is-gain", plTypeSelect.value === "gain");
  plTypeSelect.classList.toggle("is-loss", plTypeSelect.value === "loss");
}
plTypeSelect.addEventListener("change", updatePlTypeStyle);

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginBtn.disabled = true;
  hideResult();

  const handleName = handleNameInput.value.trim();
  const pin = pinInput.value.trim();

  try {
    const response = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handleName, pin }),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      showResult(data.error ?? "エラーが発生しました。", "error");
      return;
    }

    verified = { handleName, pin, isNewStudent: Boolean(data.isNewStudent) };
    whoName.textContent = handleName;
    newNote.hidden = !verified.isNewStudent;
    showStep(2);
  } catch {
    showResult("通信エラーが発生しました。もう一度お試しください。", "error");
  } finally {
    loginBtn.disabled = false;
  }
});

backBtn.addEventListener("click", () => {
  verified = null;
  showStep(1);
});

// 含み益・含み損の入力を、送信用の符号つきの数値にする。入力ミスがあれば文言を返す
function readUnrealizedPl(): { value: number | null } | { error: string } {
  const raw = plAmountInput.value.trim();
  if (raw === "") return { value: null };

  const amount = Math.abs(Number(raw));
  if (!Number.isFinite(amount)) return { error: "含み益・含み損の金額は数字で入力してください。" };
  if (amount === 0) return { value: 0 };

  if (plTypeSelect.value === "gain") return { value: amount };
  if (plTypeSelect.value === "loss") return { value: -amount };
  return { error: "「含み益」か「含み損」かを選んでください。" };
}

entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!verified) {
    showStep(1);
    return;
  }
  hideResult();

  const unrealized = readUnrealizedPl();
  if ("error" in unrealized) {
    showResult(unrealized.error, "error");
    plTypeSelect.focus();
    return;
  }

  submitBtn.disabled = true;
  const { handleName, pin } = verified;
  const totalAssets = Number(totalAssetsInput.value);

  try {
    const response = await fetch("/api/entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handleName, pin, totalAssets, unrealizedPl: unrealized.value }),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      showResult(data.error ?? "エラーが発生しました。", "error");
      submitBtn.disabled = false;
      return;
    }

    saveStoredLogin({ handleName, pin });

    const rankText = data.rank ? `現在の順位: ${data.rank}位 / ${data.totalStudents}人中` : "";
    const welcomeText = data.isNewStudent ? "登録が完了しました!このPINを次回以降も使ってね。" : "更新しました!";
    showResult(`${welcomeText}\n${rankText}\nダッシュボードに移動します...`, "success");

    setTimeout(() => {
      location.href = `/dashboard.html?me=${encodeURIComponent(handleName)}`;
    }, 1200);
  } catch {
    showResult("通信エラーが発生しました。もう一度お試しください。", "error");
    submitBtn.disabled = false;
  }
});
