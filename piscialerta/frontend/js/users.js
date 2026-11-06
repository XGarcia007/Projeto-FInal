import { getAccessToken, getCurrentUser, signOut } from './auth.js';
import { getApiBaseUrl } from './api.js';

const form = document.querySelector('#user-create-form');
const tableBody = document.querySelector('#user-table-body');
const formMessage = document.querySelector('#user-form-message');
const submitButton = document.querySelector('#user-submit');
let notifyUsers = () => {};

async function request(path, options = {}) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${getAccessToken()}`,
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) signOut();
  if (!response.ok) throw new Error(result.error || `Falha HTTP ${response.status}`);
  return result;
}

function makeCell(text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  return cell;
}

function renderUsers(users) {
  tableBody.replaceChildren();
  document.querySelector('#user-count').textContent = String(users.length);
  if (!users.length) {
    const row = document.createElement('tr');
    const cell = makeCell('Nenhum usuário cadastrado.');
    cell.colSpan = 4;
    cell.className = 'user-table-state';
    row.append(cell);
    tableBody.append(row);
    return;
  }

  const currentUser = getCurrentUser();
  for (const user of users) {
    const row = document.createElement('tr');
    row.append(makeCell(user.name), makeCell(user.email));
    const roleCell = document.createElement('td');
    const isAdmin = String(user.role).toUpperCase() === 'ADMIN';
    const badge = document.createElement('span');
    badge.className = `user-role-badge ${isAdmin ? 'is-admin' : 'is-operator'}`;
    badge.textContent = isAdmin ? 'Administrador' : 'Operador';
    roleCell.append(badge);
    row.append(roleCell);

    const actionCell = document.createElement('td');
    actionCell.className = 'user-action-cell';
    const removeButton = document.createElement('button');
    removeButton.className = 'user-remove';
    removeButton.type = 'button';
    removeButton.textContent = 'Remover Acesso';
    removeButton.disabled = user.id === currentUser?.id;
    removeButton.title = removeButton.disabled ? 'Não é possível remover o próprio acesso.' : 'Remover acesso deste usuário';
    removeButton.addEventListener('click', () => void removeUser(user));
    actionCell.append(removeButton);
    row.append(actionCell);
    tableBody.append(row);
  }
}

export async function loadUsers() {
  if (String(getCurrentUser()?.role || '').toUpperCase() !== 'ADMIN') return;
  tableBody.replaceChildren();
  const loadingRow = document.createElement('tr');
  const loadingCell = makeCell('Carregando usuários...');
  loadingCell.colSpan = 4;
  loadingCell.className = 'user-table-state';
  loadingRow.append(loadingCell);
  tableBody.append(loadingRow);
  try {
    const result = await request('/users');
    renderUsers(result.data || []);
  } catch (error) {
    tableBody.replaceChildren();
    const row = document.createElement('tr');
    const cell = makeCell(error.message);
    cell.colSpan = 4;
    cell.className = 'user-table-state is-error';
    row.append(cell);
    tableBody.append(row);
  }
}

async function createUser(event, notify) {
  event.preventDefault();
  formMessage.hidden = true;
  submitButton.disabled = true;
  const values = new FormData(form);
  try {
    await request('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: values.get('nome'),
        email: values.get('email'),
        senha: values.get('senha'),
        role: values.get('role'),
      }),
    });
    form.reset();
    await loadUsers();
    notify('Usuário cadastrado com sucesso.', 'success');
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.hidden = false;
  } finally {
    submitButton.disabled = false;
  }
}

async function removeUser(user) {
  if (!window.confirm(`Remover o acesso de ${user.name}? Esta ação não pode ser desfeita.`)) return;
  try {
    await request(`/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' });
    await loadUsers();
    notifyUsers('Acesso removido.', 'success');
  } catch (error) {
    notifyUsers(error.message, 'error');
  }
}

export function initializeUsersPanel(notify) {
  notifyUsers = notify;
  form.addEventListener('submit', (event) => void createUser(event, notify));
}