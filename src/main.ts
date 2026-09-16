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

const form = document.getElementById("entry-form") as HTMLFormElement;
const handleNameInput = document.getElementById("handleName") as HTMLInputElement;
const pinInput = document.getElementById("pin") as HTMLInputElement;
const totalAssetsInput = document.getElementById("totalAssets") as HTMLInputElement;
const unrealizedPlInput = document.getElementById("unrealizedPl") as HTMLInputElement;
const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement;
const resultBox = document.getElementById("result") as HTMLDivElement;

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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitBtn.disabled = true;
  resultBox.hidden = true;

  const handleName = handleNameInput.value.trim();
  const pin = pinInput.value.trim();
  const totalAssets = Number(totalAssetsInput.value);
  const unrealizedRaw = unrealizedPlInput.value.trim();
  const unrealizedPl = unrealizedRaw === "" ? null : Number(unrealizedRaw);

  try {
    const response = await fetch("/api/entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handleName, pin, totalAssets, unrealizedPl }),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      showResult(data.error ?? "エラーが発生しました。", "error");
      return;
    }

    saveStoredLogin({ handleName, pin });

    const rankText = data.rank ? `現在の順位: ${data.rank}位 / ${data.totalStudents}人中` : "";
    const welcomeText = data.isNewStudent ? "登録が完了しました!このPINを次回以降も使ってね。" : "更新しました!";
    showResult(`${welcomeText}\n${rankText}`, "success");
  } catch {
    showResult("通信エラーが発生しました。もう一度お試しください。", "error");
  } finally {
    submitBtn.disabled = false;
  }
});
