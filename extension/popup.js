// Ticket Trainer Notepad — popup logic
// Checklist template (painpoint/action rows) is synced from a published Google
// Sheet CSV and cached locally. Per-ticket notes/checks live in session storage
// only, so a "New ticket" always starts clean but an accidental popup close
// doesn't wipe work in progress mid-session.

const els = {
  mainView: document.getElementById('mainView'),
  settingsView: document.getElementById('settingsView'),
  settingsBtn: document.getElementById('settingsBtn'),
  backBtn: document.getElementById('backBtn'),

  ticketId: document.getElementById('ticketId'),
  newTicketBtn: document.getElementById('newTicketBtn'),
  notepad: document.getElementById('notepad'),

  refreshBtn: document.getElementById('refreshBtn'),
  progressText: document.getElementById('progressText'),
  progressFill: document.getElementById('progressFill'),

  checklistList: document.getElementById('checklistList'),
  checklistEmpty: document.getElementById('checklistEmpty'),

  syncStatus: document.getElementById('syncStatus'),
  qaScoresBtn: document.getElementById('qaScoresBtn'),

  csvUrlInput: document.getElementById('csvUrlInput'),
  hasHeaderCheckbox: document.getElementById('hasHeaderCheckbox'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  settingsStatus: document.getElementById('settingsStatus'),
};

let template = []; // [{painpoint, action}]
let checkedSet = new Set(); // indexes into template that are checked, for current ticket
let saveTimer = null;

init();

async function init() {
  const local = await chrome.storage.local.get(['csvUrl', 'hasHeader', 'template', 'lastSynced']);
  els.csvUrlInput.value = local.csvUrl || '';
  els.hasHeaderCheckbox.checked = local.hasHeader !== false;
  template = Array.isArray(local.template) ? local.template : [];
  renderSyncStatus(local.lastSynced);

  const session = await chrome.storage.session.get(['currentTicket']);
  const current = session.currentTicket || { id: '', notes: '', checked: [] };
  els.ticketId.value = current.id || '';
  els.notepad.value = current.notes || '';
  checkedSet = new Set(current.checked || []);

  renderChecklist();

  els.settingsBtn.addEventListener('click', () => showView('settings'));
  els.backBtn.addEventListener('click', () => showView('main'));
  els.saveSettingsBtn.addEventListener('click', onSaveSettings);
  els.refreshBtn.addEventListener('click', () => syncFromSheet({ preserveChecks: true }));
  els.newTicketBtn.addEventListener('click', onNewTicket);
  els.ticketId.addEventListener('input', scheduleSave);
  els.notepad.addEventListener('input', scheduleSave);
  els.qaScoresBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('qa.html') });
  });
}

function showView(name) {
  const showSettings = name === 'settings';
  els.settingsView.hidden = !showSettings;
  els.mainView.hidden = showSettings;
  if (showSettings) {
    els.settingsStatus.textContent = '';
    els.settingsStatus.className = 'hint';
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCurrentTicket, 250);
}

function saveCurrentTicket() {
  chrome.storage.session.set({
    currentTicket: {
      id: els.ticketId.value,
      notes: els.notepad.value,
      checked: Array.from(checkedSet),
    },
  });
}

function onNewTicket() {
  if (els.ticketId.value.trim() || els.notepad.value.trim() || checkedSet.size) {
    const ok = confirm('Start a new ticket? This clears the ticket ID, notes, and checked items.');
    if (!ok) return;
  }
  els.ticketId.value = '';
  els.notepad.value = '';
  checkedSet = new Set();
  renderChecklist();
  saveCurrentTicket();
  els.ticketId.focus();
}

function renderChecklist() {
  els.checklistList.innerHTML = '';
  els.checklistEmpty.hidden = template.length > 0;

  template.forEach((row, idx) => {
    const li = document.createElement('li');
    li.className = 'checklist-item' + (checkedSet.has(idx) ? ' checked' : '');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checkedSet.has(idx);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) checkedSet.add(idx);
      else checkedSet.delete(idx);
      li.classList.toggle('checked', checkbox.checked);
      updateProgress();
      saveCurrentTicket();
    });

    const text = document.createElement('div');
    text.className = 'item-text';

    if (row.painpoint) {
      const pp = document.createElement('div');
      pp.className = 'painpoint';
      pp.textContent = row.painpoint;
      text.appendChild(pp);
    }
    const action = document.createElement('div');
    action.className = 'action';
    action.textContent = row.action || '(no action text)';
    text.appendChild(action);

    li.appendChild(checkbox);
    li.appendChild(text);
    els.checklistList.appendChild(li);
  });

  updateProgress();
}

function updateProgress() {
  const total = template.length;
  const done = Array.from(checkedSet).filter((i) => i < total).length;
  els.progressText.textContent = `${done} / ${total} actions done`;
  els.progressFill.style.width = total ? `${(done / total) * 100}%` : '0%';
}

function renderSyncStatus(lastSynced) {
  els.syncStatus.textContent = lastSynced
    ? `Checklist last synced ${new Date(lastSynced).toLocaleString()}`
    : 'Checklist not synced yet';
}

async function onSaveSettings() {
  const url = els.csvUrlInput.value.trim();
  const hasHeader = els.hasHeaderCheckbox.checked;
  if (!url) {
    setSettingsStatus('Paste a published CSV link first.', true);
    return;
  }
  await chrome.storage.local.set({ csvUrl: url, hasHeader });
  await syncFromSheet({ preserveChecks: false, fromSettings: true });
}

async function syncFromSheet({ preserveChecks, fromSettings }) {
  const local = await chrome.storage.local.get(['csvUrl', 'hasHeader']);
  const url = local.csvUrl;
  if (!url) {
    setSettingsStatus('No sheet link saved yet. Open Settings first.', true);
    return;
  }

  const statusEl = fromSettings ? els.settingsStatus : els.syncStatus;
  const prevChecked = new Set(checkedSet);
  const prevTemplate = template;

  try {
    if (fromSettings) setSettingsStatus('Syncing…', false, true);
    else els.syncStatus.textContent = 'Syncing…';

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Sheet responded with ${res.status}`);
    const csvText = await res.text();
    const rows = parseCsv(csvText);
    const dataRows = local.hasHeader !== false ? rows.slice(1) : rows;

    const newTemplate = dataRows
      .map((r) => ({ painpoint: (r[0] || '').trim(), action: (r[1] || '').trim() }))
      .filter((r) => r.painpoint || r.action);

    template = newTemplate;

    if (preserveChecks) {
      // Re-map checks by matching identical painpoint+action text so edits
      // to the sheet don't silently keep stale checkmarks.
      const oldByKey = new Map();
      prevTemplate.forEach((row, i) => {
        if (prevChecked.has(i)) oldByKey.set(row.painpoint + '||' + row.action, true);
      });
      checkedSet = new Set(
        newTemplate
          .map((row, i) => (oldByKey.has(row.painpoint + '||' + row.action) ? i : -1))
          .filter((i) => i !== -1)
      );
    } else {
      checkedSet = new Set();
    }

    const now = Date.now();
    await chrome.storage.local.set({ template, lastSynced: now });
    renderChecklist();
    renderSyncStatus(now);
    saveCurrentTicket();

    if (fromSettings) {
      setSettingsStatus(`Synced ${template.length} checklist item(s).`, false);
      setTimeout(() => showView('main'), 700);
    }
  } catch (err) {
    const msg = `Couldn't load the sheet: ${err.message}. Make sure it's published to the web as CSV.`;
    if (fromSettings) setSettingsStatus(msg, true);
    else els.syncStatus.textContent = msg;
  }
}

function setSettingsStatus(msg, isError, neutral) {
  els.settingsStatus.textContent = msg;
  els.settingsStatus.className = isError ? 'hint error' : neutral ? 'hint' : 'hint success';
}

// Minimal RFC4180-ish CSV parser: handles quoted fields, escaped quotes ("")
// and commas/newlines inside quotes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}
