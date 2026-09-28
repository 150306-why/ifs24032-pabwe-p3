/**
 * Yuk's Wallet — Praktikum 3 (Studi Kasus PABWE, IT Del)
 * Fitur:
 *   1. Tab switcher (mengingat tab terakhir via localStorage)
 *   2. Expense Tracker  — CRUD transaksi harian + ringkasan saldo + cari/filter/sort
 *   3. Bookmark Manager — CRUD tautan favorit + validasi URL + cari/sort
 *   4. Quiz App         — kuis pilihan ganda + skor + high score
 *
 * Setiap fitur memakai key localStorage terpisah agar data tidak saling menimpa:
 *   - yukswallet:active-tab
 *   - yukswallet:expenses
 *   - yukswallet:bookmarks
 *   - yukswallet:quiz-highscore
 */

/* =====================================================================
   UTILITAS
   ===================================================================== */

/** Ambil satu elemen; lempar error jika tidak ditemukan (membantu debug DOM) */
function $(selector, scope = document) {
  const el = scope.querySelector(selector);
  if (!el) throw new Error(`Elemen tidak ditemukan: ${selector}`);
  return el;
}

/** Ambil banyak elemen sekaligus */
function $all(selector, scope = document) {
  return scope.querySelectorAll(selector);
}

/** Buat id unik untuk setiap data (transaksi / bookmark) */
function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Format angka menjadi Rupiah, mis. 15000 -> "Rp15.000" */
function formatRupiah(n) {
  const num = Number(n) || 0;
  return "Rp" + num.toLocaleString("id-ID");
}

/** Format tanggal ISO (yyyy-mm-dd) menjadi format ringkas Indonesia */
function formatTanggal(iso) {
  if (!iso) return "-";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

/** Baca JSON dari localStorage dengan aman; kembalikan fallback jika gagal/kosong */
function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Tulis data ke localStorage dalam bentuk JSON */
function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}


/** Buat elemen ikon SVG dari sprite di index.html (tanpa font/CDN eksternal) */
function createIcon(name, extraClass = "") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", ("icon " + extraClass).trim());
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", "#i-" + name);
  svg.appendChild(use);
  return svg;
}

/** Tampilkan pesan error singkat di bawah form, sembunyikan otomatis saat input berikutnya valid */
function showFormError(el, message) {
  el.textContent = message;
  el.classList.remove("hidden");
}
function hideFormError(el) {
  el.textContent = "";
  el.classList.add("hidden");
}

/* =====================================================================
   TAB SWITCHER
   ===================================================================== */

const TAB_STORAGE_KEY = "yukswallet:active-tab";
const tabButtons = $all(".tab-btn");
const panels = {
  expense: $("#panel-expense"),
  bookmark: $("#panel-bookmark"),
  quiz: $("#panel-quiz"),
};

/** Ganti tab aktif: tampilkan panel terkait, highlight tombol, simpan pilihan */
function switchTab(name) {
  if (!panels[name]) name = "expense";

  Object.entries(panels).forEach(([key, panel]) => {
    panel.classList.toggle("hidden", key !== name);
  });

  tabButtons.forEach((btn) => {
    const active = btn.dataset.tab === name;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });

  writeStorage(TAB_STORAGE_KEY, name);
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

/* =====================================================================
   MODAL HELPERS (dipakai bersama oleh Expense & Bookmark)
   ===================================================================== */

function openModal(modal) {
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}
function closeModal(modal) {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

// Tutup modal lewat tombol/backdrop yang bertanda [data-close-modal]
document.addEventListener("click", (e) => {
  const trigger = e.target.closest("[data-close-modal]");
  if (!trigger) return;
  const modal = document.getElementById(`modal-${trigger.dataset.closeModal}`);
  if (modal) closeModal(modal);
});

// Tutup modal yang sedang terbuka dengan tombol Escape
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  $all('[id^="modal-"]:not(.hidden)').forEach(closeModal);
});

/* =====================================================================
   FITUR 1 — EXPENSE TRACKER (Catatan Pengeluaran Harian)
   ===================================================================== */

const EXPENSE_KEY = "yukswallet:expenses";
let expenses = readStorage(EXPENSE_KEY, []);
let deletingExpenseId = null;

const expenseForm = $("#expense-form");
const expenseTitle = $("#expense-title");
const expenseCategory = $("#expense-category");
const expenseAmount = $("#expense-amount");
const expenseDate = $("#expense-date");
const expenseFormError = $("#expense-form-error");

const expenseSearch = $("#expense-search");
const expenseFilterType = $("#expense-filter-type");
const expenseFilterCategory = $("#expense-filter-category");
const expenseSort = $("#expense-sort");

const expenseListEl = $("#expense-list");
const expenseEmptyEl = $("#expense-empty");

const expenseTotalIncomeEl = $("#expense-total-income");
const expenseTotalOutcomeEl = $("#expense-total-outcome");
const expenseBalanceEl = $("#expense-balance");

const modalExpenseEdit = $("#modal-expense-edit");
const expenseEditForm = $("#expense-edit-form");
const expenseEditId = $("#expense-edit-id");
const expenseEditTitle = $("#expense-edit-title");
const expenseEditCategory = $("#expense-edit-category");
const expenseEditAmount = $("#expense-edit-amount");
const expenseEditDate = $("#expense-edit-date");
const expenseEditError = $("#expense-edit-error");

const modalExpenseDelete = $("#modal-expense-delete");
const expenseDeleteTitleEl = $("#expense-delete-title");
const expenseDeleteConfirmBtn = $("#expense-delete-confirm");

function saveExpenses() {
  writeStorage(EXPENSE_KEY, expenses);
}

/** Validasi input transaksi. Kembalikan pesan error, atau string kosong jika valid. */
function validateExpenseInput({ title, amount, date, type }) {
  if (!title.trim()) return "Judul transaksi wajib diisi.";
  if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    return "Jumlah harus berupa angka lebih dari 0.";
  }
  if (!date) return "Tanggal wajib diisi.";
  if (type !== "Pemasukan" && type !== "Pengeluaran") return "Pilih tipe transaksi.";
  return "";
}

/** Hitung & tampilkan ringkasan total pemasukan, pengeluaran, dan saldo */
function renderExpenseSummary() {
  const income = expenses
    .filter((t) => t.type === "Pemasukan")
    .reduce((sum, t) => sum + t.amount, 0);
  const outcome = expenses
    .filter((t) => t.type === "Pengeluaran")
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = income - outcome;

  expenseTotalIncomeEl.textContent = formatRupiah(income);
  expenseTotalOutcomeEl.textContent = formatRupiah(outcome);
  expenseBalanceEl.textContent = formatRupiah(balance);
  expenseBalanceEl.classList.toggle("text-garnet-600", balance < 0);
  expenseBalanceEl.classList.toggle("text-ink", balance >= 0);
}

/** Terapkan pencarian, filter, dan sorting terhadap daftar transaksi */
function getFilteredSortedExpenses() {
  const query = expenseSearch.value.trim().toLowerCase();
  const typeFilter = expenseFilterType.value;
  const categoryFilter = expenseFilterCategory.value;
  const sortMode = expenseSort.value;

  let items = expenses.filter((t) => {
    const matchQuery = t.title.toLowerCase().includes(query);
    const matchType = !typeFilter || t.type === typeFilter;
    const matchCategory = !categoryFilter || t.category === categoryFilter;
    return matchQuery && matchType && matchCategory;
  });

  items = [...items].sort((a, b) => {
    switch (sortMode) {
      case "oldest":
        return a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
      case "amount-desc":
        return b.amount - a.amount;
      case "amount-asc":
        return a.amount - b.amount;
      case "newest":
      default:
        return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
    }
  });

  return items;
}

/** Buat satu baris DOM untuk sebuah transaksi (pakai createElement, bukan innerHTML mentah) */
function buildExpenseRow(item) {
  const row = document.createElement("div");
  row.className = "flex flex-wrap items-center gap-3 p-4 sm:px-5";
  row.dataset.id = item.id;

  const dateEl = document.createElement("div");
  dateEl.className = "w-20 shrink-0 text-xs text-muted tabular-nums";
  dateEl.textContent = formatTanggal(item.date);
  row.appendChild(dateEl);

  const info = document.createElement("div");
  info.className = "flex-1 min-w-[10rem]";

  const titleEl = document.createElement("p");
  titleEl.className = "text-sm font-semibold text-ink";
  titleEl.textContent = item.title;
  info.appendChild(titleEl);

  const badgeWrap = document.createElement("div");
  badgeWrap.className = "mt-1 flex flex-wrap items-center gap-1.5";

  const categoryBadge = document.createElement("span");
  categoryBadge.className = "badge bg-brand-50 text-brand-700";
  categoryBadge.textContent = item.category;
  badgeWrap.appendChild(categoryBadge);

  const typeBadge = document.createElement("span");
  typeBadge.className =
    item.type === "Pemasukan"
      ? "badge bg-brand-50 text-brand-700"
      : "badge bg-garnet-50 text-garnet-700";
  typeBadge.textContent = item.type;
  badgeWrap.appendChild(typeBadge);

  info.appendChild(badgeWrap);
  row.appendChild(info);

  const amountEl = document.createElement("p");
  amountEl.className =
    "text-sm font-semibold tabular-nums " +
    (item.type === "Pemasukan" ? "text-brand-600" : "text-garnet-600");
  amountEl.textContent = (item.type === "Pemasukan" ? "+" : "-") + formatRupiah(item.amount);
  row.appendChild(amountEl);

  const actions = document.createElement("div");
  actions.className = "flex items-center gap-1";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "icon-btn";
  editBtn.setAttribute("aria-label", "Ubah transaksi");
  editBtn.dataset.action = "edit";
  editBtn.appendChild(createIcon("pencil"));
  actions.appendChild(editBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "icon-btn";
  deleteBtn.setAttribute("aria-label", "Hapus transaksi");
  deleteBtn.dataset.action = "delete";
  deleteBtn.appendChild(createIcon("trash"));
  actions.appendChild(deleteBtn);

  row.appendChild(actions);
  return row;
}

/** Render ulang daftar transaksi sesuai hasil filter/sort saat ini */
function renderExpenseList() {
  const items = getFilteredSortedExpenses();

  expenseListEl.innerHTML = "";
  items.forEach((item) => expenseListEl.appendChild(buildExpenseRow(item)));

  const hasAnyData = expenses.length > 0;
  const hasVisibleData = items.length > 0;
  expenseListEl.classList.toggle("hidden", !hasVisibleData);
  expenseEmptyEl.classList.toggle("hidden", hasVisibleData);
  expenseEmptyEl.textContent = hasAnyData
    ? "Tidak ada transaksi yang cocok dengan pencarian/filter."
    : "Belum ada transaksi. Tambahkan transaksi pertamamu lewat form di samping.";

  renderExpenseSummary();
}

// Submit form tambah transaksi
expenseForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const type = expenseForm.querySelector('input[name="type"]:checked')?.value;

  const payload = {
    title: expenseTitle.value,
    amount: expenseAmount.value,
    date: expenseDate.value,
    type,
  };

  const errorMessage = validateExpenseInput(payload);
  if (errorMessage) {
    showFormError(expenseFormError, errorMessage);
    return;
  }
  hideFormError(expenseFormError);

  expenses.push({
    id: uid(),
    title: expenseTitle.value.trim(),
    category: expenseCategory.value,
    amount: Number(expenseAmount.value),
    type,
    date: expenseDate.value,
    createdAt: Date.now(),
  });

  saveExpenses();
  renderExpenseList();
  expenseForm.reset();
  expenseDate.value = new Date().toISOString().slice(0, 10);
});

// Klik tombol ubah/hapus pada daftar transaksi (event delegation)
expenseListEl.addEventListener("click", (e) => {
  const actionBtn = e.target.closest("[data-action]");
  if (!actionBtn) return;
  const row = actionBtn.closest("[data-id]");
  const id = row.dataset.id;
  const item = expenses.find((t) => t.id === id);
  if (!item) return;

  if (actionBtn.dataset.action === "edit") {
    expenseEditId.value = item.id;
    expenseEditTitle.value = item.title;
    expenseEditCategory.value = item.category;
    expenseEditAmount.value = item.amount;
    expenseEditDate.value = item.date;
    const radio = expenseEditForm.querySelector(`input[name="edit-type"][value="${item.type}"]`);
    if (radio) radio.checked = true;
    hideFormError(expenseEditError);
    openModal(modalExpenseEdit);
  }

  if (actionBtn.dataset.action === "delete") {
    deletingExpenseId = item.id;
    expenseDeleteTitleEl.textContent = item.title;
    openModal(modalExpenseDelete);
  }
});

// Submit form ubah transaksi
expenseEditForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const type = expenseEditForm.querySelector('input[name="edit-type"]:checked')?.value;

  const errorMessage = validateExpenseInput({
    title: expenseEditTitle.value,
    amount: expenseEditAmount.value,
    date: expenseEditDate.value,
    type,
  });
  if (errorMessage) {
    showFormError(expenseEditError, errorMessage);
    return;
  }

  const item = expenses.find((t) => t.id === expenseEditId.value);
  if (item) {
    item.title = expenseEditTitle.value.trim();
    item.category = expenseEditCategory.value;
    item.amount = Number(expenseEditAmount.value);
    item.date = expenseEditDate.value;
    item.type = type;
    saveExpenses();
    renderExpenseList();
  }
  closeModal(modalExpenseEdit);
});

// Konfirmasi hapus transaksi
expenseDeleteConfirmBtn.addEventListener("click", () => {
  expenses = expenses.filter((t) => t.id !== deletingExpenseId);
  saveExpenses();
  renderExpenseList();
  closeModal(modalExpenseDelete);
  deletingExpenseId = null;
});

// Pencarian, filter, dan sort langsung merender ulang daftar
[expenseSearch, expenseFilterType, expenseFilterCategory, expenseSort].forEach((el) => {
  el.addEventListener("input", renderExpenseList);
  el.addEventListener("change", renderExpenseList);
});

/* =====================================================================
   FITUR 2 — BOOKMARK / LINK MANAGER
   ===================================================================== */

const BOOKMARK_KEY = "yukswallet:bookmarks";
let bookmarks = readStorage(BOOKMARK_KEY, []);
let deletingBookmarkId = null;

const URL_PATTERN = /^https?:\/\/.+/i;

const bookmarkForm = $("#bookmark-form");
const bookmarkTitle = $("#bookmark-title");
const bookmarkUrl = $("#bookmark-url");
const bookmarkCategory = $("#bookmark-category");
const bookmarkNote = $("#bookmark-note");
const bookmarkFormError = $("#bookmark-form-error");

const bookmarkSearch = $("#bookmark-search");
const bookmarkSort = $("#bookmark-sort");

const bookmarkListEl = $("#bookmark-list");
const bookmarkEmptyEl = $("#bookmark-empty");

const modalBookmarkEdit = $("#modal-bookmark-edit");
const bookmarkEditForm = $("#bookmark-edit-form");
const bookmarkEditId = $("#bookmark-edit-id");
const bookmarkEditTitle = $("#bookmark-edit-title");
const bookmarkEditUrl = $("#bookmark-edit-url");
const bookmarkEditCategory = $("#bookmark-edit-category");
const bookmarkEditNote = $("#bookmark-edit-note");
const bookmarkEditError = $("#bookmark-edit-error");

const modalBookmarkDelete = $("#modal-bookmark-delete");
const bookmarkDeleteTitleEl = $("#bookmark-delete-title");
const bookmarkDeleteConfirmBtn = $("#bookmark-delete-confirm");

function saveBookmarks() {
  writeStorage(BOOKMARK_KEY, bookmarks);
}

/** Validasi input bookmark. Kembalikan pesan error, atau string kosong jika valid. */
function validateBookmarkInput({ title, url, category }) {
  if (!title.trim()) return "Nama/judul wajib diisi.";
  if (!URL_PATTERN.test(url.trim())) return "URL harus diawali http:// atau https://";
  if (!category.trim()) return "Kategori/tag wajib diisi.";
  return "";
}

function getFilteredSortedBookmarks() {
  const query = bookmarkSearch.value.trim().toLowerCase();
  const sortMode = bookmarkSort.value;

  let items = bookmarks.filter((b) => {
    return (
      b.title.toLowerCase().includes(query) ||
      b.url.toLowerCase().includes(query) ||
      b.category.toLowerCase().includes(query)
    );
  });

  items = [...items].sort((a, b) => {
    switch (sortMode) {
      case "title-asc":
        return a.title.localeCompare(b.title, "id");
      case "title-desc":
        return b.title.localeCompare(a.title, "id");
      case "newest":
      default:
        return b.createdAt - a.createdAt;
    }
  });

  return items;
}

/** Buat satu kartu DOM untuk sebuah bookmark */
function buildBookmarkCard(item) {
  const card = document.createElement("div");
  card.className = "rounded-2xl border border-brand-100 bg-white p-4 flex flex-col gap-2";
  card.dataset.id = item.id;

  const top = document.createElement("div");
  top.className = "flex items-start justify-between gap-2";

  const link = document.createElement("a");
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = "flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-brand-700 min-w-0";

  link.appendChild(createIcon("external-link", "shrink-0 text-brand-500"));

  const linkText = document.createElement("span");
  linkText.className = "truncate";
  linkText.textContent = item.title;
  link.appendChild(linkText);

  top.appendChild(link);

  const actions = document.createElement("div");
  actions.className = "flex items-center gap-1 shrink-0";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "icon-btn";
  editBtn.setAttribute("aria-label", "Ubah tautan");
  editBtn.dataset.action = "edit";
  editBtn.appendChild(createIcon("pencil"));
  actions.appendChild(editBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "icon-btn";
  deleteBtn.setAttribute("aria-label", "Hapus tautan");
  deleteBtn.dataset.action = "delete";
  deleteBtn.appendChild(createIcon("trash"));
  actions.appendChild(deleteBtn);

  top.appendChild(actions);
  card.appendChild(top);

  const urlEl = document.createElement("p");
  urlEl.className = "text-xs text-muted truncate";
  urlEl.textContent = item.url;
  card.appendChild(urlEl);

  const categoryBadge = document.createElement("span");
  categoryBadge.className = "badge bg-brand-50 text-brand-700 w-fit";
  categoryBadge.textContent = item.category;
  card.appendChild(categoryBadge);

  if (item.note) {
    const noteEl = document.createElement("p");
    noteEl.className = "text-xs text-muted line-clamp-2";
    noteEl.textContent = item.note;
    card.appendChild(noteEl);
  }

  return card;
}

function renderBookmarkList() {
  const items = getFilteredSortedBookmarks();

  bookmarkListEl.innerHTML = "";
  items.forEach((item) => bookmarkListEl.appendChild(buildBookmarkCard(item)));

  const hasAnyData = bookmarks.length > 0;
  const hasVisibleData = items.length > 0;
  bookmarkListEl.classList.toggle("hidden", !hasVisibleData);
  bookmarkEmptyEl.classList.toggle("hidden", hasVisibleData);
  bookmarkEmptyEl.textContent = hasAnyData
    ? "Tidak ada tautan yang cocok dengan pencarian."
    : "Belum ada tautan tersimpan. Tambahkan tautan favoritmu lewat form di samping.";
}

// Submit form tambah bookmark
bookmarkForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const payload = {
    title: bookmarkTitle.value,
    url: bookmarkUrl.value,
    category: bookmarkCategory.value,
  };

  const errorMessage = validateBookmarkInput(payload);
  if (errorMessage) {
    showFormError(bookmarkFormError, errorMessage);
    return;
  }
  hideFormError(bookmarkFormError);

  bookmarks.push({
    id: uid(),
    title: bookmarkTitle.value.trim(),
    url: bookmarkUrl.value.trim(),
    category: bookmarkCategory.value.trim(),
    note: bookmarkNote.value.trim(),
    createdAt: Date.now(),
  });

  saveBookmarks();
  renderBookmarkList();
  bookmarkForm.reset();
});

// Klik tombol ubah/hapus pada daftar bookmark (event delegation)
bookmarkListEl.addEventListener("click", (e) => {
  const actionBtn = e.target.closest("[data-action]");
  if (!actionBtn) return;
  const card = actionBtn.closest("[data-id]");
  const id = card.dataset.id;
  const item = bookmarks.find((b) => b.id === id);
  if (!item) return;

  if (actionBtn.dataset.action === "edit") {
    bookmarkEditId.value = item.id;
    bookmarkEditTitle.value = item.title;
    bookmarkEditUrl.value = item.url;
    bookmarkEditCategory.value = item.category;
    bookmarkEditNote.value = item.note || "";
    hideFormError(bookmarkEditError);
    openModal(modalBookmarkEdit);
  }

  if (actionBtn.dataset.action === "delete") {
    deletingBookmarkId = item.id;
    bookmarkDeleteTitleEl.textContent = item.title;
    openModal(modalBookmarkDelete);
  }
});

// Submit form ubah bookmark
bookmarkEditForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const errorMessage = validateBookmarkInput({
    title: bookmarkEditTitle.value,
    url: bookmarkEditUrl.value,
    category: bookmarkEditCategory.value,
  });
  if (errorMessage) {
    showFormError(bookmarkEditError, errorMessage);
    return;
  }

  const item = bookmarks.find((b) => b.id === bookmarkEditId.value);
  if (item) {
    item.title = bookmarkEditTitle.value.trim();
    item.url = bookmarkEditUrl.value.trim();
    item.category = bookmarkEditCategory.value.trim();
    item.note = bookmarkEditNote.value.trim();
    saveBookmarks();
    renderBookmarkList();
  }
  closeModal(modalBookmarkEdit);
});

// Konfirmasi hapus bookmark
bookmarkDeleteConfirmBtn.addEventListener("click", () => {
  bookmarks = bookmarks.filter((b) => b.id !== deletingBookmarkId);
  saveBookmarks();
  renderBookmarkList();
  closeModal(modalBookmarkDelete);
  deletingBookmarkId = null;
});

// Pencarian & sort langsung merender ulang daftar
[bookmarkSearch, bookmarkSort].forEach((el) => {
  el.addEventListener("input", renderBookmarkList);
  el.addEventListener("change", renderBookmarkList);
});

/* =====================================================================
   FITUR 3 — QUIZ INTERAKTIF (Kuis Cerdas Finansial)
   ===================================================================== */

const QUIZ_HIGHSCORE_KEY = "yukswallet:quiz-highscore";

/** Bank soal: array of object, sesuai tema Yuk's Wallet (finansial & literasi digital) */
const quizQuestions = [
  {
    question: "Apa tujuan utama membuat anggaran (budget) bulanan?",
    options: [
      "Agar pengeluaran bisa dipantau dan disesuaikan dengan pemasukan",
      "Agar semua uang langsung dihabiskan setiap bulan",
      "Supaya tidak perlu menabung sama sekali",
      "Agar bank memberi bunga lebih besar",
    ],
    answer: 0,
  },
  {
    question: "Manakah yang termasuk kategori pengeluaran, bukan pemasukan?",
    options: ["Gaji bulanan", "Uang jajan dari orang tua", "Beasiswa", "Bayar tagihan listrik"],
    answer: 3,
  },
  {
    question: "Mengapa dana darurat (emergency fund) penting dimiliki?",
    options: [
      "Untuk dipakai belanja online saat diskon",
      "Sebagai cadangan menghadapi kebutuhan mendesak/tak terduga",
      "Agar bisa dipamerkan ke teman",
      "Karena wajib menurut hukum",
    ],
    answer: 1,
  },
  {
    question: "Ciri tautan (link) yang aman untuk diklik adalah...",
    options: [
      "Menggunakan protokol https:// dari sumber terpercaya",
      "Selalu memakai domain yang sangat panjang dan acak",
      "Dikirim oleh nomor tak dikenal lewat SMS",
      "Menjanjikan hadiah tanpa syarat apa pun",
    ],
    answer: 0,
  },
  {
    question: "Istilah 'saldo' dalam catatan keuangan berarti...",
    options: [
      "Total transaksi yang dibatalkan",
      "Selisih antara total pemasukan dan total pengeluaran",
      "Jumlah kategori transaksi yang tercatat",
      "Nama bank tempat menabung",
    ],
    answer: 1,
  },
  {
    question: "Kebiasaan finansial mana yang paling disarankan bagi mahasiswa?",
    options: [
      "Mencatat pengeluaran secara rutin agar tahu ke mana uang mengalir",
      "Berutang untuk hal-hal yang tidak mendesak",
      "Tidak pernah membandingkan harga sebelum membeli",
      "Menghabiskan seluruh uang begitu diterima",
    ],
    answer: 0,
  },
];

let quizState = {
  currentIndex: 0,
  score: 0,
  answered: false,
};

const quizStartEl = $("#quiz-start");
const quizPlayEl = $("#quiz-play");
const quizResultEl = $("#quiz-result");

const quizHighscoreEl = $("#quiz-highscore");
const quizStartBtn = $("#quiz-start-btn");

const quizProgressLabel = $("#quiz-progress-label");
const quizScoreLabel = $("#quiz-score-label");
const quizProgressBar = $("#quiz-progress-bar");
const quizQuestionEl = $("#quiz-question");
const quizOptionsEl = $("#quiz-options");
const quizNextBtn = $("#quiz-next-btn");

const quizFinalScoreEl = $("#quiz-final-score");
const quizResultMessageEl = $("#quiz-result-message");
const quizRestartBtn = $("#quiz-restart-btn");

function getQuizHighscore() {
  return readStorage(QUIZ_HIGHSCORE_KEY, 0);
}
function setQuizHighscore(value) {
  writeStorage(QUIZ_HIGHSCORE_KEY, value);
}
function renderQuizHighscoreLabel() {
  quizHighscoreEl.textContent = `${getQuizHighscore()} / ${quizQuestions.length}`;
}

function showQuizStage(stage) {
  quizStartEl.classList.toggle("hidden", stage !== "start");
  quizPlayEl.classList.toggle("hidden", stage !== "play");
  quizResultEl.classList.toggle("hidden", stage !== "result");
}

/** Mulai / ulangi kuis dari soal pertama dengan skor bersih */
function startQuiz() {
  quizState = { currentIndex: 0, score: 0, answered: false };
  showQuizStage("play");
  renderQuizQuestion();
}

/** Render soal aktif beserta pilihan jawabannya */
function renderQuizQuestion() {
  const total = quizQuestions.length;
  const q = quizQuestions[quizState.currentIndex];
  quizState.answered = false;

  quizProgressLabel.textContent = `Soal ${quizState.currentIndex + 1} dari ${total}`;
  quizScoreLabel.textContent = `Skor: ${quizState.score}`;
  quizProgressBar.style.width = `${(quizState.currentIndex / total) * 100}%`;
  quizQuestionEl.textContent = q.question;
  quizNextBtn.classList.add("hidden");

  quizOptionsEl.innerHTML = "";
  q.options.forEach((optionText, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quiz-option";
    btn.textContent = optionText;
    btn.dataset.index = String(index);
    btn.addEventListener("click", () => selectQuizAnswer(index));
    quizOptionsEl.appendChild(btn);
  });
}

/** Proses jawaban yang dipilih user: beri feedback benar/salah, kunci pilihan lain */
function selectQuizAnswer(selectedIndex) {
  if (quizState.answered) return;
  quizState.answered = true;

  const q = quizQuestions[quizState.currentIndex];
  const optionButtons = $all(".quiz-option", quizOptionsEl);

  optionButtons.forEach((btn) => {
    const index = Number(btn.dataset.index);
    btn.disabled = true;
    if (index === q.answer) btn.classList.add("correct");
    else if (index === selectedIndex) btn.classList.add("wrong");
  });

  if (selectedIndex === q.answer) quizState.score += 1;

  quizScoreLabel.textContent = `Skor: ${quizState.score}`;
  quizNextBtn.classList.remove("hidden");
  quizNextBtn.focus();
}

/** Lanjut ke soal berikutnya, atau tampilkan hasil akhir jika sudah soal terakhir */
function nextQuizQuestion() {
  quizState.currentIndex += 1;
  if (quizState.currentIndex >= quizQuestions.length) {
    finishQuiz();
  } else {
    renderQuizQuestion();
  }
}

/** Tampilkan hasil akhir kuis dan perbarui high score bila perlu */
function finishQuiz() {
  const total = quizQuestions.length;
  quizProgressBar.style.width = "100%";

  const previousHighscore = getQuizHighscore();
  const isNewRecord = quizState.score > previousHighscore;
  if (isNewRecord) setQuizHighscore(quizState.score);

  quizFinalScoreEl.textContent = `${quizState.score} / ${total}`;
  quizResultMessageEl.textContent = isNewRecord
    ? "Rekor baru! Skor tertinggimu berhasil diperbarui."
    : `Skor tertinggimu saat ini tetap ${Math.max(previousHighscore, quizState.score)} / ${total}.`;

  renderQuizHighscoreLabel();
  showQuizStage("result");
}

quizStartBtn.addEventListener("click", startQuiz);
quizNextBtn.addEventListener("click", nextQuizQuestion);
quizRestartBtn.addEventListener("click", startQuiz);

/* =====================================================================
   INISIALISASI APLIKASI
   ===================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // Tampilkan tanggal hari ini di header
  const todayLabel = document.getElementById("today-date");
  if (todayLabel) {
    todayLabel.textContent = new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  // Pulihkan tab terakhir yang dibuka (default: expense)
  const savedTab = readStorage(TAB_STORAGE_KEY, "expense");
  switchTab(savedTab);

  // Set tanggal default form expense ke hari ini
  expenseDate.value = new Date().toISOString().slice(0, 10);

  // Render awal untuk expense & bookmark (quiz baru dirender saat "Mulai Kuis" ditekan)
  renderExpenseList();
  renderBookmarkList();
  renderQuizHighscoreLabel();
});
