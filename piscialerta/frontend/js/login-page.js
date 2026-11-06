import { hasValidSession, signIn } from './auth.js';

const form = document.querySelector('#login-form');
const errorMessage = document.querySelector('#login-error');
const submitButton = document.querySelector('#login-submit');
const passwordInput = document.querySelector('#password');

if (window.lucide) window.lucide.createIcons();
if (hasValidSession()) window.location.replace('index.html');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  if (!form.email.value.trim() || !passwordInput.value) {
    errorMessage.textContent = 'Informe seu e-mail e sua senha para continuar.';
    errorMessage.hidden = false;
    return;
  }
  submitButton.disabled = true;
  submitButton.querySelector('span').textContent = 'Validando acesso…';

  try {
    await signIn(form.email.value, passwordInput.value);
    window.location.replace('index.html');
  } catch (error) {
    errorMessage.textContent = error instanceof TypeError
      ? 'Não foi possível conectar à API. Verifique a conexão e tente novamente.'
      : error.message;
    errorMessage.hidden = false;
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector('span').textContent = 'Entrar no painel';
  }
});

document.querySelector('#password-toggle').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const showing = passwordInput.type === 'text';
  passwordInput.type = showing ? 'password' : 'text';
  button.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
  button.innerHTML = `<i data-lucide="${showing ? 'eye' : 'eye-off'}"></i>`;
  if (window.lucide) window.lucide.createIcons();
});

document.querySelectorAll('[data-biometric]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('#biometric-hint').textContent =
      'Este dispositivo ainda não possui uma passkey cadastrada. Entre com e-mail e senha.';
  });
});