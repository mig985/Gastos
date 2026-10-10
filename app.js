const STORAGE_KEYS = {
  apiUrl: 'gastos.apiUrl',
  secret: 'gastos.secret',
};

const state = {
  mode: 'payment',
  accounts: [],
  installPrompt: null,
};

const els = {
  installButton: document.getElementById('installButton'),
  settingsButton: document.getElementById('settingsButton'),
  settingsPanel: document.getElementById('settingsPanel'),
  apiUrl: document.getElementById('apiUrl'),
  secret: document.getElementById('secret'),
  saveSettings: document.getElementById('saveSettings'),
  modePayment: document.getElementById('modePayment'),
  modeDue: document.getElementById('modeDue'),
  detail: document.getElementById('detail'),
  date: document.getElementById('date'),
  amountWrap: document.getElementById('amountWrap'),
  amount: document.getElementById('amount'),
  saveEntry: document.getElementById('saveEntry'),
  refreshAlerts: document.getElementById('refreshAlerts'),
  alerts: document.getElementById('alerts'),
  status: document.getElementById('status'),
};

function init() {
  els.apiUrl.value = localStorage.getItem(STORAGE_KEYS.apiUrl) || '';
  els.secret.value = localStorage.getItem(STORAGE_KEYS.secret) || '';
  els.date.value = new Date().toISOString().slice(0, 10);

  bindEvents();
  setMode('payment');
  setupPwaInstall();
  registerServiceWorker();

  if (getApiUrl()) {
    els.settingsPanel.hidden = true;
    loadAccounts();
    refreshAlerts();
  }
}

function bindEvents() {
  els.installButton.addEventListener('click', installApp);

  els.settingsButton.addEventListener('click', () => {
    els.settingsPanel.hidden = !els.settingsPanel.hidden;
  });

  els.saveSettings.addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEYS.apiUrl, els.apiUrl.value.trim());
    localStorage.setItem(STORAGE_KEYS.secret, els.secret.value.trim());
    setStatus('Configuracion guardada.', 'ok');
    loadAccounts();
    refreshAlerts();
  });

  els.modePayment.addEventListener('click', () => setMode('payment'));
  els.modeDue.addEventListener('click', () => setMode('due'));
  els.saveEntry.addEventListener('click', saveEntry);
  els.refreshAlerts.addEventListener('click', refreshAlerts);
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

function setMode(mode) {
  state.mode = mode;
  els.modePayment.classList.toggle('active', mode === 'payment');
  els.modeDue.classList.toggle('active', mode === 'due');
  els.amountWrap.hidden = mode !== 'payment';
  els.saveEntry.textContent = mode === 'payment' ? 'Guardar pago' : 'Guardar vencimiento';
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

    setStatus(`${state.accounts.length} cuentas activas.`, 'ok');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function saveEntry() {
  const detail = els.detail.value;
  const date = els.date.value;
  const amount = els.amount.value;

  if (!detail || !date) {
    setStatus('Falta cuenta o fecha.', 'error');
    return;
  }

  if (state.mode === 'payment' && !amount) {
    setStatus('Falta monto.', 'error');
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
    refreshAlerts();
  } catch (error) {
    setStatus(error.message, 'error');
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init();
