/* ==========================================================================
   MatzipNote (맛집노트) Frontend Application Logic
   모든 데이터는 서버에 저장되지 않고, 이 브라우저의 localStorage에만 저장됩니다.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'matzipnote_places';

  // State Management
  const state = {
    places: [],
    filterStatus: 'all',
    filterCategory: 'all',
    searchQuery: '',
    sort: 'recent',
  };

  // DOM Elements
  const placeList = document.getElementById('place-list');
  const emptyState = document.getElementById('empty-state');
  const placeForm = document.getElementById('place-form');
  const placeNameInput = document.getElementById('place-name');
  const placeCategoryInput = document.getElementById('place-category');
  const placeLocationInput = document.getElementById('place-location');
  const placeMemoInput = document.getElementById('place-memo');
  const placeVisitedInput = document.getElementById('place-visited');
  const ratingField = document.getElementById('rating-field');
  const ratingPicker = document.getElementById('rating-picker');

  const statTotal = document.getElementById('stat-total');
  const statVisited = document.getElementById('stat-visited');
  const statAvgRating = document.getElementById('stat-avg-rating');
  const statRate = document.getElementById('stat-rate');
  const progressFill = document.getElementById('progress-fill');

  const statusTabs = document.querySelectorAll('#status-tabs .tab-btn');
  const searchInput = document.getElementById('search-input');
  const filterCategorySelect = document.getElementById('filter-category');
  const sortSelect = document.getElementById('sort-select');
  const btnClearAll = document.getElementById('btn-clear-all');

  const editModal = document.getElementById('edit-modal');
  const editForm = document.getElementById('edit-form');
  const editId = document.getElementById('edit-id');
  const editName = document.getElementById('edit-name');
  const editCategory = document.getElementById('edit-category');
  const editLocation = document.getElementById('edit-location');
  const editVisited = document.getElementById('edit-visited');
  const editRatingField = document.getElementById('edit-rating-field');
  const editRatingPicker = document.getElementById('edit-rating-picker');
  const editMemo = document.getElementById('edit-memo');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  const modalClose = document.getElementById('modal-close');

  const themeToggle = document.getElementById('theme-toggle');
  const currentDateEl = document.getElementById('current-date');
  const toastContainer = document.getElementById('toast-container');

  // Initial Setup
  initDateDisplay();
  initTheme();
  setupStarPicker(ratingPicker);
  setupStarPicker(editRatingPicker);
  loadPlaces();
  renderList();
  renderStats();

  // ==========================================
  // Storage
  // ==========================================

  function loadPlaces() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      state.places = raw ? JSON.parse(raw) : [];
    } catch (err) {
      state.places = [];
    }
  }

  function persistPlaces() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.places));
  }

  // ==========================================
  // CRUD
  // ==========================================

  function addPlace(payload) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: payload.name,
      category: payload.category,
      location: payload.location,
      memo: payload.memo,
      visited: payload.visited,
      rating: payload.visited ? payload.rating : 0,
      createdAt: new Date().toISOString(),
    };
    state.places.unshift(entry);
    persistPlaces();
    renderList();
    renderStats();
    showToast('새 맛집이 추가되었습니다.', 'success');
  }

  function updatePlace(id, payload) {
    const idx = state.places.findIndex((p) => p.id === id);
    if (idx === -1) return;
    state.places[idx] = {
      ...state.places[idx],
      name: payload.name,
      category: payload.category,
      location: payload.location,
      memo: payload.memo,
      visited: payload.visited,
      rating: payload.visited ? payload.rating : 0,
    };
    persistPlaces();
    renderList();
    renderStats();
    showToast('맛집 정보가 수정되었습니다.', 'success');
  }

  function deletePlace(id) {
    state.places = state.places.filter((p) => p.id !== id);
    persistPlaces();
    renderList();
    renderStats();
    showToast('삭제되었습니다.', 'success');
  }

  function toggleVisited(id) {
    const idx = state.places.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const place = state.places[idx];
    place.visited = !place.visited;
    if (!place.visited) place.rating = 0;
    persistPlaces();
    renderList();
    renderStats();
  }

  function clearAll() {
    state.places = [];
    persistPlaces();
    renderList();
    renderStats();
  }

  // ==========================================
  // Rendering
  // ==========================================

  function getFilteredPlaces() {
    let list = [...state.places];

    if (state.filterStatus === 'wishlist') {
      list = list.filter((p) => !p.visited);
    } else if (state.filterStatus === 'visited') {
      list = list.filter((p) => p.visited);
    }

    if (state.filterCategory !== 'all') {
      list = list.filter((p) => p.category === state.filterCategory);
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.location || '').toLowerCase().includes(q)
      );
    }

    if (state.sort === 'rating-desc') {
      list.sort((a, b) => b.rating - a.rating);
    } else if (state.sort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    } else {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return list;
  }

  function renderList() {
    const list = getFilteredPlaces();
    placeList.innerHTML = '';

    if (list.length === 0) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    list.forEach((place) => {
      const item = document.createElement('div');
      item.className = `todo-item ${place.visited ? 'visited' : 'wishlist'}`;
      item.setAttribute('data-id', place.id);

      item.innerHTML = `
        <div class="todo-left">
          <label class="custom-checkbox" title="${place.visited ? '가보고 싶은 곳으로 변경' : '방문 완료로 표시'}">
            <input type="checkbox" ${place.visited ? 'checked' : ''} data-action="toggle" />
            <span class="checkbox-visual">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          </label>

          <div class="todo-content">
            <span class="todo-title">${escapeHtml(place.name)}</span>
            ${place.memo ? `<p class="todo-desc">${escapeHtml(place.memo)}</p>` : ''}
            <div class="todo-meta">
              <span class="meta-chip category">🍽️ ${escapeHtml(place.category)}</span>
              ${place.location ? `<span class="meta-chip date">📍 ${escapeHtml(place.location)}</span>` : ''}
              ${
                place.visited
                  ? `<span class="meta-chip rating">${renderStars(place.rating)} (${place.rating}.0)</span>`
                  : `<span class="meta-chip wishlist-chip">🔖 가보고 싶은 곳</span>`
              }
              <span class="meta-chip date">📅 ${formatDate(place.createdAt)}</span>
            </div>
          </div>
        </div>

        <div class="todo-actions">
          <button class="btn-action btn-edit" title="수정" data-action="edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
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

      item.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.getAttribute('data-action');
        if (action === 'toggle') {
          toggleVisited(place.id);
        } else if (action === 'edit') {
          openEditModal(place);
        } else if (action === 'delete') {
          if (confirm('이 맛집을 삭제하시겠습니까?')) deletePlace(place.id);
        }
      });

      placeList.appendChild(item);
    });
  }

  function renderStats() {
    const total = state.places.length;
    const visitedPlaces = state.places.filter((p) => p.visited);
    const visited = visitedPlaces.length;
    const rate = total > 0 ? Math.round((visited / total) * 1000) / 10 : 0;
    const avgRating =
      visited > 0
        ? Math.round((visitedPlaces.reduce((sum, p) => sum + p.rating, 0) / visited) * 10) / 10
        : null;

    statTotal.textContent = total;
    statVisited.textContent = visited;
    statAvgRating.textContent = avgRating !== null ? `${avgRating} ★` : '-';
    statRate.textContent = `${rate}%`;
    progressFill.style.width = `${rate}%`;
  }

  function renderStars(rating) {
    const full = Math.max(0, Math.min(5, rating));
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  // ==========================================
  // Star Picker Component
  // ==========================================

  function setupStarPicker(container) {
    const stars = container.querySelectorAll('.star');
    stars.forEach((star) => {
      star.addEventListener('click', () => {
        const value = parseInt(star.getAttribute('data-value'), 10);
        setStarPickerValue(container, value);
      });
    });
  }

  function setStarPickerValue(container, value) {
    container.setAttribute('data-value', value);
    container.querySelectorAll('.star').forEach((star) => {
      const starValue = parseInt(star.getAttribute('data-value'), 10);
      star.classList.toggle('filled', starValue <= value);
    });
  }

  function getStarPickerValue(container) {
    return parseInt(container.getAttribute('data-value'), 10) || 0;
  }

  // ==========================================
  // Modal Handling
  // ==========================================

  function openEditModal(place) {
    editId.value = place.id;
    editName.value = place.name;
    editCategory.value = place.category || '기타';
    editLocation.value = place.location || '';
    editVisited.checked = place.visited;
    editMemo.value = place.memo || '';
    setStarPickerValue(editRatingPicker, place.rating || 0);
    editRatingField.classList.toggle('hidden', !place.visited);
    editModal.style.display = 'flex';
    editName.focus();
  }

  function closeEditModal() {
    editModal.style.display = 'none';
  }

  modalClose.addEventListener('click', closeEditModal);
  btnCancelEdit.addEventListener('click', closeEditModal);
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
  });

  editVisited.addEventListener('change', () => {
    editRatingField.classList.toggle('hidden', !editVisited.checked);
  });

  editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = editId.value;
    const payload = {
      name: editName.value.trim(),
      category: editCategory.value,
      location: editLocation.value.trim(),
      memo: editMemo.value.trim(),
      visited: editVisited.checked,
      rating: getStarPickerValue(editRatingPicker),
    };
    updatePlace(id, payload);
    closeEditModal();
  });

  // ==========================================
  // Form Submission
  // ==========================================

  placeVisitedInput.addEventListener('change', () => {
    ratingField.classList.toggle('hidden', !placeVisitedInput.checked);
  });

  placeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = placeNameInput.value.trim();
    if (!name) return;

    const payload = {
      name,
      category: placeCategoryInput.value,
      location: placeLocationInput.value.trim(),
      memo: placeMemoInput.value.trim(),
      visited: placeVisitedInput.checked,
      rating: getStarPickerValue(ratingPicker),
    };

    addPlace(payload);
    placeForm.reset();
    ratingField.classList.add('hidden');
    setStarPickerValue(ratingPicker, 0);
  });

  // ==========================================
  // Filters & Search
  // ==========================================

  statusTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      statusTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.filterStatus = tab.getAttribute('data-status');
      renderList();
    });
  });

  filterCategorySelect.addEventListener('change', (e) => {
    state.filterCategory = e.target.value;
    renderList();
  });

  sortSelect.addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderList();
  });

  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value.trim();
      renderList();
    }, 200);
  });

  btnClearAll.addEventListener('click', () => {
    if (state.places.length === 0) return;
    if (confirm('등록된 모든 맛집을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      clearAll();
      showToast('전체 목록이 삭제되었습니다.', 'success');
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
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return new Intl.DateTimeFormat('ko-KR', options).format(new Date(isoString));
  }

  function initTheme() {
    const savedTheme = localStorage.getItem('matzipnote_theme') || 'theme-dark';
    document.body.className = savedTheme;

    themeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.contains('theme-dark');
      const newTheme = isDark ? 'theme-light' : 'theme-dark';
      document.body.className = newTheme;
      localStorage.setItem('matzipnote_theme', newTheme);
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
