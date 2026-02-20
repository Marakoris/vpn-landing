// Mobile menu
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');

burger.addEventListener('click', () => {
  burger.classList.toggle('active');
  nav.classList.toggle('open');
});

// Close mobile menu on link click
nav.querySelectorAll('.nav__link').forEach(link => {
  link.addEventListener('click', () => {
    burger.classList.remove('active');
    nav.classList.remove('open');
  });
});

// FAQ accordion
document.querySelectorAll('.faq__question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.parentElement;
    const isActive = item.classList.contains('active');

    // Close all
    document.querySelectorAll('.faq__item.active').forEach(el => {
      el.classList.remove('active');
      el.querySelector('.faq__question').setAttribute('aria-expanded', 'false');
    });

    // Open clicked (if wasn't active)
    if (!isActive) {
      item.classList.add('active');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});

// Fade-in on scroll (Intersection Observer)
const fadeEls = document.querySelectorAll('.fade-in');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.15,
  rootMargin: '0px 0px -40px 0px'
});

fadeEls.forEach(el => observer.observe(el));

// ==================== AUTH ====================

const API_URL = 'https://vpnnoborder.sytes.net';

// Tab switching
document.querySelectorAll('.auth__tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth__tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const target = tab.dataset.tab;
    document.getElementById('register-form').style.display = target === 'register' ? '' : 'none';
    document.getElementById('login-form').style.display = target === 'login' ? '' : 'none';

    // Clear errors
    document.querySelectorAll('.auth__error, .auth__success').forEach(el => el.textContent = '');
  });
});

// Register
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const errorEl = document.getElementById('register-error');
  const successEl = document.getElementById('register-success');
  const btn = form.querySelector('.auth__btn');
  errorEl.textContent = '';
  successEl.textContent = '';

  const email = form.email.value.trim();
  const password = form.password.value;
  const passwordConfirm = form.password_confirm.value;

  if (!email || !password || !passwordConfirm) {
    errorEl.textContent = 'Заполните все поля';
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = 'Пароль должен быть не менее 6 символов';
    return;
  }
  if (password !== passwordConfirm) {
    errorEl.textContent = 'Пароли не совпадают';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Регистрация...';

  try {
    const res = await fetch(API_URL + '/api/v1/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, password_confirm: passwordConfirm }),
    });
    const data = await res.json();

    if (data.ok) {
      successEl.textContent = 'Аккаунт создан! Перенаправляем...';
      setTimeout(() => {
        window.location.href = API_URL + '/dashboard/auth/jwt?t=' + encodeURIComponent(data.token);
      }, 500);
    } else {
      errorEl.textContent = data.error || 'Ошибка регистрации';
    }
  } catch (err) {
    errorEl.textContent = 'Ошибка соединения с сервером';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Создать аккаунт';
  }
});

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const errorEl = document.getElementById('login-error');
  const successEl = document.getElementById('login-success');
  const btn = form.querySelector('.auth__btn');
  errorEl.textContent = '';
  successEl.textContent = '';

  const email = form.email.value.trim();
  const password = form.password.value;

  if (!email || !password) {
    errorEl.textContent = 'Заполните все поля';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Вход...';

  try {
    const res = await fetch(API_URL + '/api/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (data.ok) {
      successEl.textContent = 'Успешный вход! Перенаправляем...';
      setTimeout(() => {
        window.location.href = API_URL + '/dashboard/auth/jwt?t=' + encodeURIComponent(data.token);
      }, 500);
    } else {
      errorEl.textContent = data.error || 'Ошибка входа';
    }
  } catch (err) {
    errorEl.textContent = 'Ошибка соединения с сервером';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Войти';
  }
});
