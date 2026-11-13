
"use strict";

/* CASHIER STORAGE */

const STORAGE_KEY = "cashier_receipts_v1";
const SETTINGS_KEY = "cashier_settings_v1";

const DEFAULT_SETTINGS = {
  businessName: "Cashier",
  currency: "IQD",
  prefix: "CSH",
  payment: "Cash"
};

let receipts = loadReceipts();
let settings = loadSettings();
let selectedReceiptId = null;
let deferredInstallPrompt = null;

/* HELPERS */

const $ = id => document.getElementById(id);

function loadReceipts() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function loadSettings() {
  try {
    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveReceipts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function money(value) {
  const number = Number(value) || 0;
  return number.toLocaleString("en-US", {
    maximumFractionDigits: 2
  }) + " " + settings.currency;
}

function dateKey(date) {
  const d = new Date(date);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

function formatDate(date) {
  return new Date(date).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

function sameWeek(a, b = new Date()) {
  const start = startOfWeek(b);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const d = new Date(a);
  return d >= start && d < end;
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function showMessage(id, message) {
  const element = $(id);
  if (element) element.textContent = message;
}

/* NAVIGATION */

function navigate(view) {
  document.querySelectorAll(".view").forEach(section => {
    section.classList.toggle(
      "active",
      section.id === "view-" + view
    );
  });

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.nav === view
    );
  });

  if (view === "dashboard") renderDashboard();
  if (view === "weekly") renderWeekly();
  if (view === "history") renderHistory();
}

document.querySelectorAll("[data-nav]").forEach(button => {
  button.addEventListener("click", () => {
    navigate(button.dataset.nav);
  });
});

/* SETTINGS */

function applySettings() {
  $("businessNameTop").textContent = settings.businessName;
  $("currencySuffix").textContent = settings.currency;
  document.title = settings.businessName;

  $("settingBusinessName").value = settings.businessName;
  $("settingCurrency").value = settings.currency;
  $("settingPrefix").value = settings.prefix;
  $("settingPayment").value = settings.payment;

  $("paymentMethod").value = settings.payment;
}

$("settingsForm").addEventListener("submit", event => {
  event.preventDefault();

  settings = {
    businessName: $("settingBusinessName").value.trim() || "Cashier",
    currency: $("settingCurrency").value.trim() || "IQD",
    prefix: $("settingPrefix").value.trim() || "CSH",
    payment: $("settingPayment").value
  };

  saveSettings();
  applySettings();
  renderAll();

  showMessage("settingsMessage", "Settings saved successfully.");
});

/* DATE DISPLAY */

function updateDateDisplay() {
  $("todayLabel").textContent = new Date().toLocaleDateString(
    undefined,
    { weekday: "short", day: "numeric", month: "short" }
  );

  $("receiptDate").value = formatDate(new Date());
}

/* RECEIPT CREATION */

function createReceiptNumber() {
  const number = String(Date.now()).slice(-8);
  return settings.prefix + "-" + number;
}

$("receiptForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("buyerName").value.trim();
  const items = $("items").value.trim();
  const total = Number($("totalPrice").value);

  if (!name || !items || !Number.isFinite(total) || total < 0) {
    showMessage("formMessage", "Please complete the required fields.");
    return;
  }

  const receipt = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2),
    number: createReceiptNumber(),
    buyerName: name,
    phone: $("buyerPhone").value.trim(),
    items,
    location: $("buyerLocation").value.trim(),
    total,
    payment: $("paymentMethod").value,
    createdAt: new Date().toISOString()
  };

  receipts.unshift(receipt);
  saveReceipts();

  $("receiptForm").reset();
  $("paymentMethod").value = settings.payment;
  updateDateDisplay();

  showMessage("formMessage", "Receipt saved successfully.");
  showToast("Receipt saved successfully.");

  renderAll();
});

$("resetFormButton").addEventListener("click", () => {
  $("receiptForm").reset();
  $("paymentMethod").value = settings.payment;
  updateDateDisplay();
  showMessage("formMessage", "");
});

/* DASHBOARD */

function totalOf(list) {
  return list
    .filter(r => r.payment !== "Unpaid")
    .reduce((sum, r) => sum + Number(r.total || 0), 0);
}

function renderDashboard() {
  const now = new Date();
  const today = dateKey(now);
  const todayList = receipts.filter(r => dateKey(r.createdAt) === today);
  const weekList = receipts.filter(r => sameWeek(r.createdAt, now));

  $("todaySales").textContent = money(totalOf(todayList));
  $("todayCount").textContent = todayList.length + " receipts";

  $("weekSales").textContent = money(totalOf(weekList));
  $("weekCount").textContent = weekList.length + " receipts";

  $("allSales").textContent = money(totalOf(receipts));
  $("allCount").textContent = receipts.length + " receipts";

  const average = receipts.length
    ? totalOf(receipts) / receipts.length
    : 0;

  $("averageSale").textContent = money(average);

  renderReceiptList("recentReceipts", receipts.slice(0, 5));
}

/* RECEIPT LIST */

function renderReceiptList(containerId, list) {
  const container = $(containerId);

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">▤</span>
        <strong>No receipts yet</strong>
        <p>Your sales will appear here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(receipt => `
    <div class="receipt-row" data-receipt-id="${escapeHTML(receipt.id)}">
      <div class="receipt-left">
        <div class="receipt-avatar">
          ${escapeHTML((receipt.buyerName || "?").charAt(0).toUpperCase())}
        </div>

        <div class="receipt-info">
          <div class="receipt-name">
            ${escapeHTML(receipt.buyerName)}
          </div>
          <div class="receipt-meta">
            ${escapeHTML(receipt.number)} · ${escapeHTML(formatDate(receipt.createdAt))}
          </div>
          <span class="receipt-status">
            ${escapeHTML(receipt.payment)}
          </span>
        </div>
      </div>

      <div class="receipt-price">
        ${escapeHTML(money(receipt.total))}
      </div>
    </div>
  `).join("");

  container.querySelectorAll(".receipt-row").forEach(row => {
    row.addEventListener("click", () => {
      openReceipt(row.dataset.receiptId);
    });
  });
}

/* WEEKLY SALES */

function renderWeekly() {
  const start = startOfWeek();
  const days = [];
  const totals = [];

  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);

    days.push(day);

    const total = totalOf(
      receipts.filter(r => dateKey(r.createdAt) === dateKey(day))
    );

    totals.push(total);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  $("weekRangeLabel").textContent =
    start.toLocaleDateString(undefined, { day: "numeric", month: "short" }) +
    " – " +
    end.toLocaleDateString(undefined, { day: "numeric", month: "short" });

  const weekList = receipts.filter(r => sameWeek(r.createdAt));
  const weeklyTotal = totals.reduce((a, b) => a + b, 0);

  $("weeklyTotal").textContent = money(weeklyTotal);
  $("weeklyReceipts").textContent = weekList.length + " receipts";
  $("dailyAverage").textContent = money(weeklyTotal / 7);

  const best = Math.max(...totals);
  const bestIndex = totals.indexOf(best);

  $("bestDay").textContent = best > 0
    ? days[bestIndex].toLocaleDateString(undefined, { weekday: "short" })
    : "—";

  $("bestDayAmount").textContent = best > 0
    ? money(best)
    : "No sales yet";

  const max = Math.max(...totals, 1);

  $("weeklyChart").innerHTML = days.map((day, index) => {
    const height = Math.max(3, (totals[index] / max) * 100);

    return `
      <div class="chart-day">
        <span class="chart-value">
          ${totals[index] ? escapeHTML(money(totals[index])) : "—"}
        </span>
        <div class="chart-track">
          <div class="chart-bar" style="height:${height}%"></div>
        </div>
        <span class="chart-label">
          ${day.toLocaleDateString(undefined, { weekday: "short" })}
        </span>
      </div>
    `;
  }).join("");

  renderReceiptList("weeklyReceiptsList", weekList);
}

$("currentWeekButton").addEventListener("click", renderWeekly);

/* HISTORY */

function renderHistory() {
  const search = $("historySearch").value.toLowerCase().trim();
  const period = $("historyPeriod").value;
  const now = new Date();

  let filtered = receipts.filter(receipt => {
    const searchable = [
      receipt.number,
      receipt.buyerName,
      receipt.phone,
      receipt.items,
      receipt.location,
      receipt.payment
    ].join(" ").toLowerCase();

    if (search && !searchable.includes(search)) return false;

    const d = new Date(receipt.createdAt);

    if (period === "today" && dateKey(d) !== dateKey(now)) {
      return false;
    }

    if (period === "week" && !sameWeek(d, now)) {
      return false;
    }

    if (
      period === "month" &&
      (d.getMonth() !== now.getMonth() ||
       d.getFullYear() !== now.getFullYear())
    ) {
      return false;
    }

    return true;
  });

  $("historyCount").textContent =
    filtered.length + " receipts";

  $("historyTotal").textContent = money(totalOf(filtered));

  renderReceiptList("historyReceipts", filtered);
}

$("historySearch").addEventListener("input", renderHistory);
$("historyPeriod").addEventListener("change", renderHistory);

/* RECEIPT DETAILS */

function findReceipt(id) {
  return receipts.find(r => r.id === id);
}

function detailLine(label, value) {
  return `
    <div class="detail-line">
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(value || "—")}</strong>
    </div>
  `;
}

function openReceipt(id) {
  const receipt = findReceipt(id);
  if (!receipt) return;

  selectedReceiptId = id;

  $("receiptDetailContent").innerHTML = `
    ${detailLine("Receipt number", receipt.number)}
    ${detailLine("Customer", receipt.buyerName)}
    ${detailLine("Phone", receipt.phone)}
    <div class="detail-line">
      <span>Items</span>
      <strong class="detail-items">${escapeHTML(receipt.items)}</strong>
    </div>
    ${detailLine("Location", receipt.location)}
    ${detailLine("Payment", receipt.payment)}
    ${detailLine("Date", formatDate(receipt.createdAt))}
    <div class="detail-line">
      <span>Total</span>
      <strong class="detail-total">${escapeHTML(money(receipt.total))}</strong>
    </div>
  `;

  $("receiptDialog").showModal();
}

/* EDIT RECEIPT */

$("editReceiptButton").addEventListener("click", () => {
  const receipt = findReceipt(selectedReceiptId);
  if (!receipt) return;

  $("receiptDialog").close();

  $("editReceiptId").value = receipt.id;
  $("editBuyerName").value = receipt.buyerName;
  $("editBuyerPhone").value = receipt.phone;
  $("editItems").value = receipt.items;
  $("editBuyerLocation").value = receipt.location;
  $("editTotalPrice").value = receipt.total;
  $("editPaymentMethod").value = receipt.payment;

  $("editDialog").showModal();
});

$("editReceiptForm").addEventListener("submit", event => {
  event.preventDefault();

  const receipt = findReceipt($("editReceiptId").value);
  if (!receipt) return;

  receipt.buyerName = $("editBuyerName").value.trim();
  receipt.phone = $("editBuyerPhone").value.trim();
  receipt.items = $("editItems").value.trim();
  receipt.location = $("editBuyerLocation").value.trim();
  receipt.total = Number($("editTotalPrice").value);
  receipt.payment = $("editPaymentMethod").value;

  saveReceipts();
  $("editDialog").close();

  renderAll();
  showToast("Receipt updated.");
});

/* DELETE RECEIPT */

$("deleteReceiptButton").addEventListener("click", () => {
  const receipt = findReceipt(selectedReceiptId);
  if (!receipt) return;

  if (!confirm("Delete receipt " + receipt.number + "?")) return;

  receipts = receipts.filter(r => r.id !== selectedReceiptId);

  saveReceipts();
  $("receiptDialog").close();

  renderAll();
  showToast("Receipt deleted.");
});

/* PRINT */

$("printReceiptButton").addEventListener("click", () => {
  window.print();
});

/* DIALOG CLOSING */

document.querySelectorAll(".close-dialog").forEach(button => {
  button.addEventListener("click", () => {
    button.closest("dialog").close();
  });
});

/* CSV EXPORT */

function exportCSV() {
  const headers = [
    "Receipt Number",
    "Customer",
    "Phone",
    "Items",
    "Location",
    "Total",
    "Currency",
    "Payment",
    "Date"
  ];

  const rows = receipts.map(r => [
    r.number,
    r.buyerName,
    r.phone,
    r.items,
    r.location,
    r.total,
    settings.currency,
    r.payment,
    r.createdAt
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(value =>
      '"' + String(value ?? "").replace(/"/g, '""') + '"'
    ).join(","))
    .join("\r\n");

  downloadFile(
    "\uFEFF" + csv,
    "cashier-sales.csv",
    "text/csv;charset=utf-8"
  );
}

$("exportCsvButton").addEventListener("click", exportCSV);
$("adminCsvButton").addEventListener("click", exportCSV);

/* BACKUP */

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("backupButton").addEventListener("click", () => {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    receipts
  };

  downloadFile(
    JSON.stringify(backup, null, 2),
    "cashier-backup.json",
    "application/json"
  );

  showMessage("backupMessage", "Backup downloaded.");
});

$("importBackupInput").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());

    if (!Array.isArray(data.receipts)) {
      throw new Error("Invalid backup format.");
    }

    if (!confirm("Import this backup? Existing records will be replaced.")) {
      event.target.value = "";
      return;
    }

    receipts = data.receipts;
    settings = {
      ...DEFAULT_SETTINGS,
      ...(data.settings || {})
    };

    saveReceipts();
    saveSettings();
    applySettings();
    renderAll();

    showMessage("backupMessage", "Backup imported successfully.");
    showToast("Backup imported.");
  } catch (error) {
    showMessage("backupMessage", "Could not import this backup.");
  }

  event.target.value = "";
});

/* CLEAR ALL */

$("clearAllButton").addEventListener("click", () => {
  const confirmed = confirm(
    "Are you absolutely sure? This will permanently delete all receipts."
  );

  if (!confirmed) return;

  const secondConfirm = confirm("Confirm one last time: delete everything?");

  if (!secondConfirm) return;

  receipts = [];
  saveReceipts();
  renderAll();

  showToast("All receipts deleted.");
});

/* PWA INSTALL */

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;

  const button = $("installButton");
  button.hidden = false;

  button.onclick = async () => {
    if (!deferredInstallPrompt) return;

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;

    deferredInstallPrompt = null;
    button.hidden = true;
  };
});

/* SERVICE WORKER */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(error => {
      console.error("Service worker registration failed:", error);
    });
  });
}

/* INITIALIZATION */

function renderAll() {
  renderDashboard();
  renderWeekly();
  renderHistory();
}

applySettings();
updateDateDisplay();
renderAll();

setInterval(updateDateDisplay, 30000);
