const STORAGE_KEYS = {
  apiUrl: 'gastos.apiUrl',
  secret: 'gastos.secret',
};

const state = {
  mode: 'payment',
  view: 'home',
  accounts: [],
  dashboard: null,
  installPrompt: null,
  currentDate: new Date(),
};

const els = {
  installButton: document.getElementById('installButton'),
  settingsButton: document.getElementById('settingsButton'),
  prevMonth: document.getElementById('prevMonth'),
  monthTitle: document.getElementById('monthTitle'),
  views: {
    home: document.getElementById('homeView'),
    form: document.getElementById('formView'),
    alerts: document.getElementById('alertsView'),
    settings: document.getElementById('settingsView'),
  },
  navButtons: [...document.querySelectorAll('.bottom-nav button')],
  apiUrl: document.getElementById('apiUrl'),
  secret: document.getElementById('secret'),
  saveSettings: document.getElementById('saveSettings'),
  balanceMetric: document.getElementById('balanceMetric'),
  expensesMetric: document.getElementById('expensesMetric'),
  incomeMetric: document.getElementById('incomeMetric'),
  progressLabel: document.getElementById('progressLabel'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  expenseList: document.getElementById('expenseList'),
  refreshHome: document.getElementById('refreshHome'),
  quickAdd: document.getElementById('quickAdd'),
  formTitle: document.getElementById('formTitle'),
  modePayment: document.getElementById('modePayment'),
  modeDue: document.getElementById('modeDue'),
  detail: document.getElementById('detail'),
  date: document.getElementById('date'),
  amountWrap: document.getElementById('amountWrap'),
  amount: document.getElementById('amount'),
  suggestions: document.getElementById('suggestions'),
  saveEntry: document.getElementById('saveEntry'),
  saveEntryLabel: document.getElementById('saveEntryLabel'),
  refreshAlerts: document.getElementById('refreshAlerts'),
  alerts: document.getElementById('alerts'),
  status: document.getElementById('status'),
};

function init() {
  els.apiUrl.value = localStorage.getItem(STORAGE_KEYS.apiUrl) || '';
  els.secret.value = localStorage.getItem(STORAGE_KEYS.secret) || '';
  els.date.value = toInputDate(new Date());

  bindEvents();
  setMode('payment');
  setView(getApiUrl() ? 'home' : 'settings');
  setupPwaInstall();
  registerServiceWorker();

  if (getApiUrl()) {
    loadEverything();
  }
}

function bindEvents() {
  els.installButton.addEventListener('click', installApp);
  els.settingsButton.addEventListener('click', () => setView('settings'));
  els.prevMonth.addEventListener('click', () => {
    state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() - 1, 1);
    loadDashboard();
  });

  els.navButtons.forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });

  els.saveSettings.addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEYS.apiUrl, els.apiUrl.value.trim());
    localStorage.setItem(STORAGE_KEYS.secret, els.secret.value.trim());
    setStatus('Configuracion guardada.', 'ok');
    setView('home');
    loadEverything();
  });

  els.modePayment.addEventListener('click', () => setMode('payment'));
  els.modeDue.addEventListener('click', () => setMode('due'));
  els.saveEntry.addEventListener('click', saveEntry);
  els.refreshAlerts.addEventListener('click', refreshAlerts);
  els.refreshHome.addEventListener('click', loadDashboard);
  els.quickAdd.addEventListener('click', () => {
    setMode('payment');
    setView('form');
  });
}

function setupPwaInstall() {
  if (isStandalone()) {
    els.installButton.hidden = true;
    return;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.installPrompt = event;
    els.installButton.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    state.installPrompt = null;
    els.installButton.hidden = true;
    setStatus('App instalada.', 'ok');
  });
}

async function installApp() {
  if (state.installPrompt) {
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    return;
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const message = isIOS
    ? 'En iPhone: Compartir > Agregar a pantalla de inicio.'
    : 'En el navegador: menu > Instalar app o Agregar a pantalla principal.';

  setStatus(message, 'warn');
  setView('settings');
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      setStatus('No se pudo activar el modo instalable.', 'warn');
    });
  });
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function setView(view) {
  state.view = view;

  Object.entries(els.views).forEach(([name, element]) => {
    element.classList.toggle('active', name === view);
  });

  els.navButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.view === view);
  });

  const titles = {
    home: state.dashboard?.month || 'Gastos',
    form: state.mode === 'payment' ? 'Nuevo gasto' : 'Nuevo vencimiento',
    alerts: 'Alertas',
    settings: 'Configuracion',
  };

  els.monthTitle.textContent = titles[view] || 'Gastos';
  els.prevMonth.hidden = view !== 'home';
}

function setMode(mode) {
  state.mode = mode;
  els.modePayment.classList.toggle('active', mode === 'payment');
  els.modeDue.classList.toggle('active', mode === 'due');
  els.amountWrap.hidden = mode !== 'payment';
  els.formTitle.textContent = mode === 'payment' ? 'Nuevo gasto' : 'Nuevo vencimiento';
  els.saveEntryLabel.textContent = mode === 'payment' ? 'Guardar' : 'Guardar vencimiento';

  if (state.view === 'form') {
    setView('form');
  }
}

async function loadEverything() {
  await loadAccounts();
  await Promise.all([loadDashboard(), refreshAlerts()]);
}

async function loadAccounts() {
  setStatus('Cargando cuentas...', '');

  try {
    const response = await apiCall('accounts', { includeArchived: 'false' });

    if (!response.ok) {
      throw new Error(response.error || 'No se pudieron cargar las cuentas.');
    }

    state.accounts = response.accounts || [];
    els.detail.innerHTML = state.accounts
      .map((account) => `<option value="${escapeHtml(account.detail)}">${escapeHtml(account.detail)}</option>`)
      .join('');
    renderSuggestions();

    setStatus(`${state.accounts.length} cuentas activas.`, 'ok');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function loadDashboard() {
  if (!getApiUrl()) {
    renderEmptyDashboard();
    return;
  }

  try {
    const response = await apiCall('dashboard', { date: toInputDate(state.currentDate) });

    if (!response.ok) {
      throw new Error(response.error || 'No se pudo cargar el tablero.');
    }

    state.dashboard = response;
    renderDashboard(response);

    if (state.view === 'home') {
      setView('home');
    }
  } catch (error) {
    renderEmptyDashboard(error.message);
  }
}

function renderDashboard(data) {
  els.monthTitle.textContent = data.month || 'Gastos';
  els.balanceMetric.textContent = formatMoney(data.balance);
  els.expensesMetric.textContent = formatMoney(data.expenses);
  els.incomeMetric.textContent = formatMoney(data.income);

  const progress = clamp(Number(data.progress) || 0, 0, 100);
  els.progressLabel.textContent = `${progress}%`;
  els.progressFill.style.width = `${progress}%`;
  els.progressText.textContent = `${formatMoney(data.expenses)} de ${formatMoney(data.income)}`;

  const items = data.items || [];

  if (!items.length) {
    els.expenseList.innerHTML = '<div class="empty-state">Sin movimientos cargados en este mes.</div>';
    return;
  }

  els.expenseList.innerHTML = items.map(renderExpenseItem).join('');
}

function renderEmptyDashboard(message) {
  els.balanceMetric.textContent = '$ 0,00';
  els.expensesMetric.textContent = '$ 0,00';
  els.incomeMetric.textContent = '$ 0,00';
  els.progressLabel.textContent = '0%';
  els.progressFill.style.width = '0%';
  els.progressText.textContent = '$ 0,00 de $ 0,00';
  els.expenseList.innerHTML = `<div class="empty-state">${escapeHtml(message || 'Sin datos para mostrar.')}</div>`;
}

function renderExpenseItem(item) {
  const icon = iconForDetail(item.detail);
  const statusClass = item.paid ? 'paid' : 'pending';
  const amount = item.paid ? formatMoney(item.amount) : 'Vence';

  return `
    <article class="expense-item">
      <span class="item-icon ${icon.tone}">${icon.symbol}</span>
      <div class="item-main">
        <strong>${escapeHtml(item.detail)}</strong>
        <small>${escapeHtml(item.date || 'Sin fecha')}</small>
      </div>
      <div class="item-side">
        <strong>${escapeHtml(amount)}</strong>
        <span class="status-chip ${statusClass}">${escapeHtml(item.status)}</span>
      </div>
    </article>
  `;
}

function renderSuggestions() {
  const suggestions = state.accounts.slice(0, 6);

  els.suggestions.innerHTML = suggestions
    .map((account) => {
      const icon = iconForDetail(account.detail);
      return `<button type="button" data-detail="${escapeHtml(account.detail)}"><span>${icon.symbol}</span>${escapeHtml(
        shortLabel(account.detail)
      )}</button>`;
    })
    .join('');

  els.suggestions.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      els.detail.value = button.dataset.detail;
    });
  });
}

async function saveEntry() {
  const detail = els.detail.value;
  const date = els.date.value;
  const amount = els.amount.value;

  if (!detail || !date) {
    setStatus('Falta cuenta o fecha.', 'error');
    setView('settings');
    return;
  }

  if (state.mode === 'payment' && !amount) {
    setStatus('Falta monto.', 'error');
    setView('settings');
    return;
  }

  setStatus('Guardando...', '');

  try {
    const response =
      state.mode === 'payment'
        ? await apiCall('record-payment', { detail, date, amount })
        : await apiCall('record-due-date', { detail, dueDate: date });

    if (!response.ok) {
      throw new Error(response.error || response.message || 'No se pudo guardar.');
    }

    setStatus(state.mode === 'payment' ? 'Pago guardado.' : 'Vencimiento guardado.', 'ok');
    els.amount.value = '';
    state.currentDate = new Date(`${date}T00:00:00`);
    await Promise.all([loadDashboard(), refreshAlerts()]);
    setView('home');
  } catch (error) {
    setStatus(error.message, 'error');
    setView('settings');
  }
}

async function refreshAlerts() {
  if (!getApiUrl()) {
    return;
  }

  els.alerts.textContent = 'Calculando...';

  try {
    const response = await apiCall('alerts-preview');

    if (!response.ok) {
      throw new Error(response.error || 'No se pudo calcular alertas.');
    }

    els.alerts.textContent = response.message || 'Sin novedades para alertar.';
  } catch (error) {
    els.alerts.textContent = error.message;
  }
}

function apiCall(action, params = {}) {
  const apiUrl = getApiUrl();

  if (!apiUrl) {
    return Promise.reject(new Error('Falta configurar la URL del Apps Script.'));
  }

  return new Promise((resolve, reject) => {
    const callbackName = `jsonp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const url = new URL(apiUrl);
    const script = document.createElement('script');

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    url.searchParams.set('action', action);
    url.searchParams.set('callback', callbackName);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    });

    const secret = getSecret();

    if (secret) {
      url.searchParams.set('secret', secret);
    }

    script.src = url.toString();
    script.onerror = () => {
      cleanup();
      reject(new Error('No se pudo conectar con Apps Script.'));
    };

    document.body.appendChild(script);

    function cleanup() {
      delete window[callbackName];
      script.remove();
    }
  });
}

function iconForDetail(detail) {
  const text = String(detail || '').toLowerCase();

  if (text.includes('luz') || text.includes('electric')) return { symbol: '⚡', tone: 'amber' };
  if (text.includes('internet')) return { symbol: '⌁', tone: 'green' };
  if (text.includes('alquiler')) return { symbol: '⌂', tone: 'blue' };
  if (text.includes('tarjeta')) return { symbol: '▣', tone: 'blue' };
  if (text.includes('seguro')) return { symbol: '◆', tone: 'amber' };
  if (text.includes('super') || text.includes('mercado')) return { symbol: '◼', tone: 'green' };
  return { symbol: '•', tone: 'gray' };
}

function shortLabel(detail) {
  return String(detail || '').split(' ')[0] || 'Cuenta';
}

function getApiUrl() {
  return els.apiUrl.value.trim();
}

function getSecret() {
  return els.secret.value.trim();
}

function setStatus(message, tone) {
  els.status.textContent = message;
  els.status.className = tone || '';
}

function formatMoney(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init();
