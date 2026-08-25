/**
 * DompetKu - Aplikasi Pencatatan Keuangan
 * app.js - Frontend Logic
 * 
 * PENTING: Ganti SCRIPT_URL di bawah ini dengan URL Web App Google Apps Script Anda.
 */

// ============================================
// KONFIGURASI — GANTI URL INI
// ============================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzFIyMT-Mqe_2RSEcubyMXGNdrUvtqpXKxYUjbl6EQQyhVxYtmLeHCm-d3_uzKqOMD_/exec';

// ============================================
// STATE
// ============================================
let allTransactions = [];
let currentFilter = 'all';
let currentType = 'pemasukan';
let isSubmitting = false;

// ============================================
// CATEGORY SUGGESTIONS
// ============================================
const SUGGESTIONS = {
    pemasukan: ['Gaji', 'Freelance', 'Bonus', 'Investasi', 'Hadiah', 'Penjualan', 'Transfer Masuk'],
    pengeluaran: ['Makan & Minum', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya']
};

// ============================================
// DOM ELEMENTS
// ============================================
const $ = (id) => document.getElementById(id);

const dom = {
    loadingOverlay: $('loadingOverlay'),
    toast: $('toast'),
    sidebar: $('sidebar'),
    mobileOverlay: $('mobileOverlay'),
    menuToggle: $('menuToggle'),
    connectionStatus: $('connectionStatus'),
    headerDate: $('headerDate'),
    // Dashboard
    totalBalance: $('totalBalance'),
    totalIncome: $('totalIncome'),
    totalExpense: $('totalExpense'),
    lastUpdate: $('lastUpdate'),
    recentTransactions: $('recentTransactions'),
    btnViewAll: $('btnViewAll'),
    // Form
    transactionForm: $('transactionForm'),
    typeToggle: $('typeToggle'),
    toggleSlider: $('toggleSlider'),
    labelCategory: $('labelCategory'),
    inputCategory: $('inputCategory'),
    inputAmount: $('inputAmount'),
    inputDescription: $('inputDescription'),
    btnSubmit: $('btnSubmit'),
    btnLoader: $('btnLoader'),
    suggestionsTitle: $('suggestionsTitle'),
    suggestionsList: $('suggestionsList'),
    // History
    historyTransactions: $('historyTransactions'),
    filterBar: $('filterBar'),
    btnRefresh: $('btnRefresh'),
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initDate();
    initNavigation();
    initTypeToggle();
    initForm();
    initFilters();
    initAmountInput();
    renderSuggestions();
    loadData();
});

// ============================================
// DATE DISPLAY
// ============================================
function initDate() {
    const now = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    dom.headerDate.textContent = now.toLocaleDateString('id-ID', options);
}

// ============================================
// NAVIGATION
// ============================================
function initNavigation() {
    // Sidebar nav
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    // Mobile bottom nav
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    // View all button
    dom.btnViewAll.addEventListener('click', () => switchView('history'));
    // Refresh button
    dom.btnRefresh.addEventListener('click', () => loadData());
    // Mobile menu
    dom.menuToggle.addEventListener('click', toggleMobileMenu);
    dom.mobileOverlay.addEventListener('click', toggleMobileMenu);
}

function switchView(viewName) {
    // Update views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('view-' + viewName);
    if (target) target.classList.add('active');

    // Update sidebar nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navBtn = document.getElementById('nav-' + viewName);
    if (navBtn) navBtn.classList.add('active');

    // Update bottom nav
    document.querySelectorAll('.bottom-nav-item').forEach(n => n.classList.remove('active'));
    const bnavBtn = document.getElementById('bnav-' + viewName);
    if (bnavBtn) bnavBtn.classList.add('active');

    // Close mobile menu
    dom.sidebar.classList.remove('open');
    dom.mobileOverlay.classList.remove('active');
}

function toggleMobileMenu() {
    dom.sidebar.classList.toggle('open');
    dom.mobileOverlay.classList.toggle('active');
}

// ============================================
// TYPE TOGGLE (Pemasukan / Pengeluaran)
// ============================================
function initTypeToggle() {
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentType = btn.dataset.type;
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (currentType === 'pengeluaran') {
                dom.toggleSlider.classList.add('right');
                dom.labelCategory.textContent = 'Kategori Pengeluaran';
                dom.inputCategory.placeholder = 'Contoh: Makan, Transport, Belanja...';
            } else {
                dom.toggleSlider.classList.remove('right');
                dom.labelCategory.textContent = 'Sumber Dana';
                dom.inputCategory.placeholder = 'Contoh: Gaji, Freelance, Bonus...';
            }
            renderSuggestions();
        });
    });
}

// ============================================
// SUGGESTIONS
// ============================================
function renderSuggestions() {
    const list = SUGGESTIONS[currentType] || [];
    dom.suggestionsTitle.textContent = currentType === 'pemasukan' ? 'Sumber Dana Cepat' : 'Kategori Cepat';
    dom.suggestionsList.innerHTML = list.map(s =>
        `<button type="button" class="suggestion-chip" data-value="${s}">${s}</button>`
    ).join('');

    dom.suggestionsList.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            dom.inputCategory.value = chip.dataset.value;
            dom.inputCategory.focus();
        });
    });
}

// ============================================
// AMOUNT INPUT FORMATTING
// ============================================
function initAmountInput() {
    dom.inputAmount.addEventListener('input', (e) => {
        let raw = e.target.value.replace(/\D/g, '');
        if (raw === '') {
            e.target.value = '';
            return;
        }
        e.target.value = formatNumberInput(raw);
    });
}

function formatNumberInput(numStr) {
    return parseInt(numStr, 10).toLocaleString('id-ID');
}

// ============================================
// FORM SUBMISSION
// ============================================
function initForm() {
    dom.transactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        const category = dom.inputCategory.value.trim();
        const amountRaw = dom.inputAmount.value.replace(/\./g, '').replace(/,/g, '');
        const amount = parseInt(amountRaw, 10);
        const description = dom.inputDescription.value.trim();

        if (!category) { showToast('Harap isi kategori/sumber dana.', 'error'); return; }
        if (!amount || amount <= 0) { showToast('Harap isi nominal yang valid.', 'error'); return; }

        isSubmitting = true;
        dom.btnSubmit.classList.add('loading');
        dom.btnSubmit.disabled = true;

        try {
            const payload = {
                action: 'addTransaction',
                tipe: currentType,
                kategori: category,
                nominal: amount,
                keterangan: description || '-'
            };

            const response = await fetchAPI(payload);

            if (response.status === 'success') {
                showToast('Transaksi berhasil disimpan! ✅', 'success');
                dom.transactionForm.reset();
                dom.inputCategory.value = '';
                dom.inputAmount.value = '';
                dom.inputDescription.value = '';
                loadData();
            } else {
                showToast('Gagal menyimpan: ' + (response.message || 'Unknown error'), 'error');
            }
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        } finally {
            isSubmitting = false;
            dom.btnSubmit.classList.remove('loading');
            dom.btnSubmit.disabled = false;
        }
    });
}

// ============================================
// FILTERS
// ============================================
function initFilters() {
    dom.filterBar.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            dom.filterBar.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            renderHistory();
        });
    });
}

// ============================================
// DATA LOADING
// ============================================
async function loadData() {
    try {
        const response = await fetchAPI({ action: 'getData' });

        if (response.status === 'success') {
            allTransactions = response.data || [];
            updateDashboard(response);
            renderRecentTransactions();
            renderHistory();
            setConnectionStatus('connected', 'Terhubung');
        } else {
            setConnectionStatus('error', 'Gagal memuat');
            showToast('Gagal memuat data dari Google Sheets.', 'error');
        }
    } catch (err) {
        setConnectionStatus('error', 'Tidak terhubung');
        showToast('Tidak dapat terhubung ke server.', 'error');
        console.error('Load data error:', err);
    } finally {
        dom.loadingOverlay.classList.add('hidden');
    }
}

// ============================================
// UPDATE DASHBOARD
// ============================================
function updateDashboard(data) {
    const totalIn = data.totalPemasukan || 0;
    const totalOut = data.totalPengeluaran || 0;
    const balance = totalIn - totalOut;

    animateValue(dom.totalBalance, balance);
    animateValue(dom.totalIncome, totalIn);
    animateValue(dom.totalExpense, totalOut);

    const now = new Date();
    dom.lastUpdate.textContent = 'Terakhir diperbarui: ' + now.toLocaleString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function animateValue(element, targetValue) {
    const prefix = targetValue < 0 ? '-Rp ' : 'Rp ';
    const absVal = Math.abs(targetValue);
    element.textContent = prefix + absVal.toLocaleString('id-ID');
}

// ============================================
// RENDER TRANSACTIONS
// ============================================
function renderRecentTransactions() {
    const recent = allTransactions.slice(0, 5);
    if (recent.length === 0) {
        dom.recentTransactions.innerHTML = '<div class="empty-state"><p>Belum ada transaksi</p></div>';
        return;
    }
    dom.recentTransactions.innerHTML = recent.map(tx => createTransactionHTML(tx)).join('');
}

function renderHistory() {
    let filtered = allTransactions;
    if (currentFilter !== 'all') {
        filtered = allTransactions.filter(tx => tx.tipe.toLowerCase() === currentFilter);
    }

    if (filtered.length === 0) {
        dom.historyTransactions.innerHTML = `<div class="empty-state"><p>${
            currentFilter === 'all' ? 'Belum ada transaksi' : 'Tidak ada transaksi ' + currentFilter
        }</p></div>`;
        return;
    }
    dom.historyTransactions.innerHTML = filtered.map(tx => createTransactionHTML(tx)).join('');
}

function formatTanggal(raw) {
    if (!raw || raw === '-') return '-';
    // Jika sudah format dd/MM/yyyy, langsung return
    if (typeof raw === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
    // Jika Date object atau string Date mentah, format ulang
    try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return raw.toString();
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    } catch {
        return raw.toString();
    }
}

function createTransactionHTML(tx) {
    const isIncome = tx.tipe.toLowerCase() === 'pemasukan';
    const typeClass = isIncome ? 'income' : 'expense';
    const icon = isIncome ? '📈' : '📉';
    const sign = isIncome ? '+' : '-';
    const nominal = Math.abs(tx.nominal || 0).toLocaleString('id-ID');
    const ket = tx.keterangan && tx.keterangan !== '-' ? ` · ${tx.keterangan}` : '';

    return `
        <div class="transaction-item">
            <div class="tx-icon ${typeClass}">${icon}</div>
            <div class="tx-details">
                <div class="tx-category">${escapeHTML(tx.kategori || '-')}</div>
                <div class="tx-meta">
                    <span>${formatTanggal(tx.tanggal)}</span>
                    <span>${escapeHTML(tx.tipe || '')}${ket ? ' · ' + escapeHTML(tx.keterangan) : ''}</span>
                </div>
            </div>
            <div class="tx-amount ${typeClass}">${sign}Rp ${nominal}</div>
        </div>
    `;
}

// ============================================
// API COMMUNICATION
// ============================================
async function fetchAPI(payload) {
    if (SCRIPT_URL === 'PASTE_URL_WEB_APP_ANDA_DI_SINI') {
        // Demo mode — return demo data
        return getDemoData(payload);
    }

    // Gunakan GET request saja untuk menghindari double entry
    const params = new URLSearchParams(payload).toString();
    const url = SCRIPT_URL + '?' + params + '&t=' + Date.now();
    const response = await fetch(url);
    return await response.json();
}

// ============================================
// DEMO DATA (when no API URL is configured)
// ============================================
function getDemoData(payload) {
    if (payload.action === 'addTransaction') {
        const newTx = {
            tanggal: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            tipe: payload.tipe,
            kategori: payload.kategori,
            nominal: payload.nominal,
            keterangan: payload.keterangan
        };
        allTransactions.unshift(newTx);
        return { status: 'success' };
    }

    if (payload.action === 'getData') {
        if (allTransactions.length === 0) {
            allTransactions = [];
        }

        let totalPemasukan = 0;
        let totalPengeluaran = 0;
        allTransactions.forEach(tx => {
            if (tx.tipe.toLowerCase() === 'pemasukan') totalPemasukan += tx.nominal;
            else totalPengeluaran += tx.nominal;
        });

        return {
            status: 'success',
            data: allTransactions,
            totalPemasukan,
            totalPengeluaran
        };
    }
    return { status: 'error' };
}

// ============================================
// CONNECTION STATUS
// ============================================
function setConnectionStatus(status, text) {
    dom.connectionStatus.className = 'connection-status ' + status;
    dom.connectionStatus.querySelector('.status-text').textContent = text;
}

// ============================================
// TOAST NOTIFICATION
// ============================================
function showToast(message, type = 'info') {
    dom.toast.textContent = message;
    dom.toast.className = 'toast ' + type + ' show';
    clearTimeout(dom.toast._timer);
    dom.toast._timer = setTimeout(() => {
        dom.toast.classList.remove('show');
    }, 3500);
}

// ============================================
// UTILITY
// ============================================
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
