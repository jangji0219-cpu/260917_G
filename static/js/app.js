/* ==========================================================================
   ValueCheck Frontend Application Logic
   판단 기록은 서버에 저장되지 않고, 이 브라우저의 localStorage에만 저장됩니다.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'valuecheck_history';
  const TIER_LABELS = {
    'strong-buy': '강력 매수 고려',
    'buy': '매수 고려',
    'neutral': '중립 · 관망',
    'caution': '신중 검토 필요',
    'avoid': '매도 · 회피 고려',
  };
  const POSITIVE_TIERS = ['strong-buy', 'buy'];
  const CAUTION_TIERS = ['caution', 'avoid'];

  // State Management
  const state = {
    history: [],
    filterTier: 'all',
    searchQuery: '',
    sort: 'recent',
  };

  // DOM Elements
  const evalForm = document.getElementById('eval-form');
  const tickerInput = document.getElementById('ticker-input');
  const metricInputs = {
    per: document.getElementById('m-per'),
    pbr: document.getElementById('m-pbr'),
    roe: document.getElementById('m-roe'),
    operating_margin: document.getElementById('m-operating-margin'),
    debt_ratio: document.getElementById('m-debt-ratio'),
    revenue_growth: document.getElementById('m-revenue-growth'),
    profit_growth: document.getElementById('m-profit-growth'),
    dividend_yield: document.getElementById('m-dividend-yield'),
  };

  const resultPanel = document.getElementById('result-panel');
  const verdictLabel = document.getElementById('verdict-label');
  const verdictTicker = document.getElementById('verdict-ticker');
  const verdictScore = document.getElementById('verdict-score');
  const scoreGaugeFill = document.getElementById('score-gauge-fill');
  const breakdownGrid = document.getElementById('breakdown-grid');

  const historyList = document.getElementById('history-list');
  const emptyState = document.getElementById('empty-state');

  const statTotal = document.getElementById('stat-total');
  const statPositive = document.getElementById('stat-positive');
  const statCaution = document.getElementById('stat-caution');
  const statRate = document.getElementById('stat-rate');
  const progressFill = document.getElementById('progress-fill');

  const tierTabs = document.querySelectorAll('#tier-tabs .tab-btn');
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  const btnClearHistory = document.getElementById('btn-clear-history');

  const themeToggle = document.getElementById('theme-toggle');
  const currentDateEl = document.getElementById('current-date');
  const toastContainer = document.getElementById('toast-container');

  // Initial Setup
  initDateDisplay();
  initTheme();
  loadHistory();
  renderHistory();
  renderStats();

  // ==========================================
  // API Call
  // ==========================================

  async function evaluate(payload) {
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '판단 요청에 실패했습니다.');

      renderResult(data);
      saveToHistory(data);
      showToast('판단이 완료되어 기록에 저장되었습니다.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ==========================================
  // Result Rendering
  // ==========================================

  function renderResult(data) {
    resultPanel.style.display = 'block';
    verdictLabel.textContent = data.verdict;
    verdictLabel.className = `verdict-label verdict-${data.tier}`;
    verdictTicker.textContent = data.ticker ? `· ${data.ticker}` : '';
    verdictScore.innerHTML = `${data.score}<span class="score-unit">점 (${data.percentage}%)</span>`;
    scoreGaugeFill.style.width = `${data.percentage}%`;

    breakdownGrid.innerHTML = data.breakdown.map(renderBreakdownItem).join('');
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderBreakdownItem(item) {
    const scoreClass = item.score > 0 ? 'positive' : item.score < 0 ? 'negative' : 'zero';
    const scoreText = item.score > 0 ? `+${item.score}` : `${item.score}`;
    return `
      <div class="breakdown-item">
        <div class="breakdown-item-header">
          <span>${escapeHtml(item.label)} = ${item.value}</span>
          <span class="breakdown-score ${scoreClass}">${scoreText}</span>
        </div>
        <div class="breakdown-comment">${escapeHtml(item.comment)}</div>
      </div>
    `;
  }

  // ==========================================
  // History (localStorage)
  // ==========================================

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      state.history = raw ? JSON.parse(raw) : [];
    } catch (err) {
      state.history = [];
    }
  }

  function persistHistory() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
  }

  function saveToHistory(data) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ticker: data.ticker,
      score: data.score,
      percentage: data.percentage,
      verdict: data.verdict,
      tier: data.tier,
      breakdown: data.breakdown,
      createdAt: new Date().toISOString(),
    };
    state.history.unshift(entry);
    persistHistory();
    renderHistory();
    renderStats();
  }

  function deleteHistoryItem(id) {
    state.history = state.history.filter((item) => item.id !== id);
    persistHistory();
    renderHistory();
    renderStats();
  }

  function clearHistory() {
    state.history = [];
    persistHistory();
    renderHistory();
    renderStats();
  }

  // ==========================================
  // History Rendering
  // ==========================================

  function getFilteredHistory() {
    let list = [...state.history];

    if (state.filterTier === 'positive') {
      list = list.filter((item) => POSITIVE_TIERS.includes(item.tier));
    } else if (state.filterTier === 'caution') {
      list = list.filter((item) => CAUTION_TIERS.includes(item.tier));
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter((item) => (item.ticker || '').toLowerCase().includes(q));
    }

    if (state.sort === 'score-desc') {
      list.sort((a, b) => b.score - a.score);
    } else if (state.sort === 'score-asc') {
      list.sort((a, b) => a.score - b.score);
    } else {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return list;
  }

  function renderHistory() {
    const list = getFilteredHistory();
    historyList.innerHTML = '';

    if (list.length === 0) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    list.forEach((item) => {
      const el = document.createElement('div');
      el.className = `todo-item verdict-${item.tier}`;
      el.setAttribute('data-id', item.id);

      el.innerHTML = `
        <div class="todo-left" data-action="toggle-expand">
          <span class="tier-dot"></span>
          <div class="todo-content">
            <span class="todo-title">${escapeHtml(item.ticker || '무명 종목')}</span>
            <div class="todo-meta">
              <span class="meta-chip verdict-chip verdict-${item.tier}">${escapeHtml(item.verdict)}</span>
              <span class="meta-chip score-chip">${item.score}점 (${item.percentage}%)</span>
              <span class="meta-chip date">📅 ${formatDate(item.createdAt)}</span>
            </div>
            <div class="breakdown-grid mini" style="display: none;">
              ${item.breakdown.map(renderBreakdownItem).join('')}
            </div>
          </div>
        </div>

        <div class="todo-actions">
          <button class="btn-action btn-delete" title="삭제" data-action="delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      `;

      el.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        if (action === 'delete') {
          if (confirm('이 판단 기록을 삭제하시겠습니까?')) deleteHistoryItem(item.id);
        } else if (action === 'toggle-expand') {
          const mini = el.querySelector('.breakdown-grid.mini');
          mini.style.display = mini.style.display === 'none' ? 'grid' : 'none';
        }
      });

      historyList.appendChild(el);
    });
  }

  function renderStats() {
    const total = state.history.length;
    const positive = state.history.filter((item) => POSITIVE_TIERS.includes(item.tier)).length;
    const caution = state.history.filter((item) => CAUTION_TIERS.includes(item.tier)).length;
    const rate = total > 0 ? Math.round((positive / total) * 1000) / 10 : 0;

    statTotal.textContent = total;
    statPositive.textContent = positive;
    statCaution.textContent = caution;
    statRate.textContent = `${rate}%`;
    progressFill.style.width = `${rate}%`;
  }

  // ==========================================
  // Form Submission
  // ==========================================

  evalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = { ticker: tickerInput.value.trim() };
    for (const [key, input] of Object.entries(metricInputs)) {
      payload[key] = input.value.trim();
    }
    evaluate(payload);
  });

  // ==========================================
  // Filters, Search & Sort
  // ==========================================

  tierTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tierTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.filterTier = tab.getAttribute('data-tier');
      renderHistory();
    });
  });

  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value.trim();
      renderHistory();
    }, 200);
  });

  sortSelect.addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderHistory();
  });

  btnClearHistory.addEventListener('click', () => {
    if (state.history.length === 0) return;
    if (confirm('모든 판단 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      clearHistory();
      showToast('모든 기록이 삭제되었습니다.', 'success');
    }
  });

  // ==========================================
  // Helpers: Date, Theme, Toast
  // ==========================================

  function initDateDisplay() {
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    currentDateEl.textContent = new Intl.DateTimeFormat('ko-KR', options).format(new Date());
  }

  function formatDate(isoString) {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
    return new Intl.DateTimeFormat('ko-KR', options).format(new Date(isoString));
  }

  function initTheme() {
    const savedTheme = localStorage.getItem('valuecheck_theme') || 'theme-dark';
    document.body.className = savedTheme;

    themeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.contains('theme-dark');
      const newTheme = isDark ? 'theme-light' : 'theme-dark';
      document.body.className = newTheme;
      localStorage.setItem('valuecheck_theme', newTheme);
      showToast(isDark ? '라이트 테마로 전환되었습니다.' : '다크 테마로 전환되었습니다.', 'success');
    });
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
      <span>${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
