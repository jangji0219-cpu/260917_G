/* ==========================================================================
   TaskFlow Frontend Application Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // State Management
  const state = {
    todos: [],
    filterStatus: 'all',
    filterCategory: 'all',
    searchQuery: '',
  };

  // DOM Elements
  const todoList = document.getElementById('todo-list');
  const emptyState = document.getElementById('empty-state');
  const todoForm = document.getElementById('todo-form');
  const todoTitleInput = document.getElementById('todo-title');
  const todoCategoryInput = document.getElementById('todo-category');
  const todoPriorityInput = document.getElementById('todo-priority');
  const todoDueDateInput = document.getElementById('todo-due-date');
  const todoDescInput = document.getElementById('todo-desc');

  const statTotal = document.getElementById('stat-total');
  const statActive = document.getElementById('stat-active');
  const statCompleted = document.getElementById('stat-completed');
  const statRate = document.getElementById('stat-rate');
  const progressFill = document.getElementById('progress-fill');

  const statusTabs = document.querySelectorAll('#status-tabs .tab-btn');
  const searchInput = document.getElementById('search-input');
  const filterCategorySelect = document.getElementById('filter-category');
  const btnClearCompleted = document.getElementById('btn-clear-completed');

  const editModal = document.getElementById('edit-modal');
  const editForm = document.getElementById('edit-form');
  const editId = document.getElementById('edit-id');
  const editTitle = document.getElementById('edit-title');
  const editCategory = document.getElementById('edit-category');
  const editPriority = document.getElementById('edit-priority');
  const editDueDate = document.getElementById('edit-due-date');
  const editDesc = document.getElementById('edit-desc');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  const modalClose = document.getElementById('modal-close');

  const themeToggle = document.getElementById('theme-toggle');
  const currentDateEl = document.getElementById('current-date');
  const toastContainer = document.getElementById('toast-container');

  // 1. Initial Setup: Date & Theme
  initDateDisplay();
  initTheme();

  // 2. Fetch Initial Data
  fetchTodos();
  fetchStats();

  // ==========================================
  // API Calls
  // ==========================================

  // Fetch Todos with current filters
  async function fetchTodos() {
    try {
      const params = new URLSearchParams();
      if (state.filterStatus !== 'all') params.append('status', state.filterStatus);
      if (state.filterCategory !== 'all') params.append('category', state.filterCategory);
      if (state.searchQuery) params.append('search', state.searchQuery);

      const res = await fetch(`/api/todos?${params.toString()}`);
      if (!res.ok) throw new Error('목록을 불러오는 중 오류가 발생했습니다.');
      state.todos = await res.json();
      renderTodoList();
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  }

  // Fetch Dashboard Stats
  async function fetchStats() {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('통계를 불러오지 못했습니다.');
      const stats = await res.json();

      statTotal.textContent = stats.total;
      statActive.textContent = stats.active;
      statCompleted.textContent = stats.completed;
      statRate.textContent = `${stats.completion_rate}%`;
      progressFill.style.width = `${stats.completion_rate}%`;
    } catch (err) {
      console.error(err);
    }
  }

  // Create Todo
  async function createTodo(payload) {
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '할 일 추가 실패');
      }
      showToast('새 할 일이 추가되었습니다.', 'success');
      fetchTodos();
      fetchStats();
      todoForm.reset();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Toggle Todo Completion
  async function toggleTodo(id) {
    try {
      const res = await fetch(`/api/todos/${id}/toggle`, { method: 'PATCH' });
      if (!res.ok) throw new Error('상태 변경 실패');
      fetchTodos();
      fetchStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Delete Todo
  async function deleteTodo(id) {
    if (!confirm('이 할 일을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('삭제 실패');
      showToast('할 일이 삭제되었습니다.', 'success');
      fetchTodos();
      fetchStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Update Todo
  async function updateTodo(id, payload) {
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '수정 실패');
      }
      showToast('할 일이 업데이트되었습니다.', 'success');
      closeEditModal();
      fetchTodos();
      fetchStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Clear Completed Todos
  async function clearCompleted() {
    try {
      const res = await fetch('/api/todos/clear-completed', { method: 'POST' });
      if (!res.ok) throw new Error('완료 항목 정리 실패');
      const data = await res.json();
      showToast(data.message || '완료된 항목이 정리되었습니다.', 'success');
      fetchTodos();
      fetchStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ==========================================
  // Rendering
  // ==========================================

  function renderTodoList() {
    todoList.innerHTML = '';

    if (state.todos.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    state.todos.forEach(todo => {
      const item = document.createElement('div');
      item.className = `todo-item ${todo.completed ? 'completed' : ''} priority-${todo.priority}`;
      item.setAttribute('data-id', todo.id);

      const priorityLabels = { high: '높음', medium: '보통', low: '낮음' };

      item.innerHTML = `
        <div class="todo-left">
          <label class="custom-checkbox" title="${todo.completed ? '미완료로 변경' : '완료로 표시'}">
            <input type="checkbox" ${todo.completed ? 'checked' : ''} data-action="toggle" />
            <span class="checkbox-visual">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          </label>

          <div class="todo-content">
            <span class="todo-title">${escapeHtml(todo.title)}</span>
            ${todo.description ? `<p class="todo-desc">${escapeHtml(todo.description)}</p>` : ''}
            <div class="todo-meta">
              <span class="meta-chip category">🏷️ ${escapeHtml(todo.category)}</span>
              <span class="meta-chip priority-${todo.priority}">
                ${todo.priority === 'high' ? '🔥' : todo.priority === 'medium' ? '⚡' : '🌱'} 
                ${priorityLabels[todo.priority] || '보통'}
              </span>
              ${todo.due_date ? `<span class="meta-chip date">📅 ${escapeHtml(todo.due_date)}</span>` : ''}
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

      // Event delegation for item actions
      item.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.getAttribute('data-action');
        if (action === 'toggle') {
          toggleTodo(todo.id);
        } else if (action === 'edit') {
          openEditModal(todo);
        } else if (action === 'delete') {
          deleteTodo(todo.id);
        }
      });

      todoList.appendChild(item);
    });
  }

  // ==========================================
  // Modal Handling
  // ==========================================

  function openEditModal(todo) {
    editId.value = todo.id;
    editTitle.value = todo.title;
    editCategory.value = todo.category || '일반';
    editPriority.value = todo.priority || 'medium';
    editDueDate.value = todo.due_date || '';
    editDesc.value = todo.description || '';
    editModal.style.display = 'flex';
    editTitle.focus();
  }

  function closeEditModal() {
    editModal.style.display = 'none';
  }

  modalClose.addEventListener('click', closeEditModal);
  btnCancelEdit.addEventListener('click', closeEditModal);
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
  });

  editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = editId.value;
    const payload = {
      title: editTitle.value.trim(),
      category: editCategory.value,
      priority: editPriority.value,
      due_date: editDueDate.value || null,
      description: editDesc.value.trim()
    };
    updateTodo(id, payload);
  });

  // ==========================================
  // Form Submission
  // ==========================================

  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = todoTitleInput.value.trim();
    if (!title) return;

    const payload = {
      title,
      category: todoCategoryInput.value,
      priority: todoPriorityInput.value,
      due_date: todoDueDateInput.value || null,
      description: todoDescInput.value.trim()
    };

    createTodo(payload);
  });

  // ==========================================
  // Filters & Search
  // ==========================================

  // Tab Filtering
  statusTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      statusTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.filterStatus = tab.getAttribute('data-status');
      fetchTodos();
    });
  });

  // Category Filtering
  filterCategorySelect.addEventListener('change', (e) => {
    state.filterCategory = e.target.value;
    fetchTodos();
  });

  // Debounced Search
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value.trim();
      fetchTodos();
    }, 250);
  });

  // Clear Completed
  btnClearCompleted.addEventListener('click', () => {
    if (confirm('완료된 모든 항목을 삭제하시겠습니까?')) {
      clearCompleted();
    }
  });

  // ==========================================
  // Helpers: Date, Theme, Toast
  // ==========================================

  function initDateDisplay() {
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    currentDateEl.textContent = new Intl.DateTimeFormat('ko-KR', options).format(new Date());
  }

  function initTheme() {
    const savedTheme = localStorage.getItem('taskflow_theme') || 'theme-dark';
    document.body.className = savedTheme;

    themeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.contains('theme-dark');
      const newTheme = isDark ? 'theme-light' : 'theme-dark';
      document.body.className = newTheme;
      localStorage.setItem('taskflow_theme', newTheme);
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
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
