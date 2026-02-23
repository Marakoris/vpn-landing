// ==================== Analytics ====================

const analytics = {
  track(event, params) {
    if (typeof gtag === 'function') gtag('event', event, params);
  }
};

// ==================== i18n ====================

const i18n = {
  translations: {},
  currentLang: 'ru',
  supported: ['ru', 'en'],

  async init() {
    this.currentLang = this.detectLanguage();
    if (this.currentLang !== 'ru') {
      // Non-Russian: load translations and update the DOM
      await this.loadLanguage(this.currentLang);
      this.applyTranslations();
    } else {
      // Russian: HTML already has correct text — just preload JSON
      // in background for i18n.t() calls in JS (auth errors, etc.)
      await this.loadLanguage('ru');
    }
    this.updateSwitcher();
    this.bindSwitcher();
  },

  detectLanguage() {
    const stored = localStorage.getItem('lang');
    if (stored && this.supported.includes(stored)) return stored;
    const browserLang = (navigator.language || '').split('-')[0];
    return browserLang === 'ru' ? 'ru' : 'en';
  },

  async loadLanguage(lang) {
    try {
      const res = await fetch('/lang/' + lang + '.json');
      this.translations = await res.json();
      this.currentLang = lang;
    } catch (e) {
      console.error('i18n: failed to load', lang, e);
    }
  },

  _ruFallback: {
    'auth.errorFillAll': 'Заполните все поля',
    'auth.errorPasswordMin': 'Пароль должен быть не менее 6 символов',
    'auth.errorPasswordMismatch': 'Пароли не совпадают',
    'auth.registeringBtn': 'Регистрация...',
    'auth.registerBtn': 'Создать аккаунт',
    'auth.errorRegister': 'Ошибка регистрации',
    'auth.errorConnection': 'Ошибка соединения с сервером',
    'auth.errorCode': 'Введите 6-значный код',
    'auth.verifyingBtn': 'Проверка...',
    'auth.verifyBtn': 'Подтвердить',
    'auth.verifySuccess': 'Email подтверждён! Перенаправляем...',
    'auth.errorInvalidCode': 'Неверный код',
    'auth.resendSuccess': 'Код отправлен повторно',
    'auth.errorGeneric': 'Ошибка',
    'auth.loggingInBtn': 'Вход...',
    'auth.loginBtn': 'Войти',
    'auth.loginSuccess': 'Успешный вход! Перенаправляем...',
    'auth.errorLogin': 'Ошибка входа'
  },

  t(key) {
    var val = key.split('.').reduce(function(o, k) { return o && o[k]; }, this.translations);
    return val || this._ruFallback[key] || key;
  },

  applyTranslations() {
    var self = this;
    // textContent
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      el.textContent = self.t(el.getAttribute('data-i18n'));
    });
    // innerHTML (for content with <br>, <strong>, etc.)
    document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
      var html = self.t(el.getAttribute('data-i18n-html'));
      el.innerHTML = html;
    });
    // placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
      el.placeholder = self.t(el.getAttribute('data-i18n-placeholder'));
    });
    // Restore verify email display if visible
    if (authEmail && document.getElementById('verify-email-display')) {
      document.getElementById('verify-email-display').textContent = authEmail;
    }
    this.updateMeta();
    this.updateJsonLd();
  },

  updateMeta() {
    var meta = this.translations.meta;
    if (!meta) return;
    document.documentElement.lang = this.currentLang;
    document.title = meta.title;
    var descEl = document.querySelector('meta[name="description"]');
    if (descEl) descEl.setAttribute('content', meta.description);
    var kwEl = document.querySelector('meta[name="keywords"]');
    if (kwEl) kwEl.setAttribute('content', meta.keywords);
    // OG
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', meta.ogTitle);
    var ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', meta.ogDescription);
    var ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale) ogLocale.setAttribute('content', meta.ogLocale);
    // Twitter
    var twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', meta.twitterTitle);
    var twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute('content', meta.twitterDescription);
  },

  updateJsonLd() {
    var jsonld = this.translations.jsonld;
    if (!jsonld) return;
    // SoftwareApplication description
    var appEl = document.getElementById('jsonld-app');
    if (appEl) {
      try {
        var appData = JSON.parse(appEl.textContent);
        appData.description = jsonld.appDescription;
        appEl.textContent = JSON.stringify(appData);
      } catch (e) {}
    }
    // FAQ
    var faqEl = document.getElementById('jsonld-faq');
    if (faqEl && jsonld.faq) {
      try {
        var faqData = JSON.parse(faqEl.textContent);
        faqData.mainEntity = jsonld.faq.map(function(item) {
          return {
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer }
          };
        });
        faqEl.textContent = JSON.stringify(faqData);
      } catch (e) {}
    }
  },

  async setLanguage(lang) {
    if (lang === this.currentLang) return;
    await this.loadLanguage(lang);
    this.applyTranslations();
    localStorage.setItem('lang', lang);
    this.updateSwitcher();
    analytics.track('lang_switch', { lang: lang });
  },

  updateSwitcher() {
    var self = this;
    document.querySelectorAll('.lang-switch__btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === self.currentLang);
    });
  },

  bindSwitcher() {
    var self = this;
    document.querySelectorAll('.lang-switch__btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self.setLanguage(btn.getAttribute('data-lang'));
      });
    });
  }
};

// ==================== Mobile menu ====================

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

// ==================== FAQ accordion ====================

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
      analytics.track('faq_open', { question: btn.textContent.trim() });
    }
  });
});

// ==================== Fade-in on scroll ====================

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

const API_URL = '__API_URL__';

// Tab switching
document.querySelectorAll('.auth__tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth__tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const target = tab.dataset.tab;
    document.getElementById('register-form').style.display = target === 'register' ? '' : 'none';
    document.getElementById('login-form').style.display = target === 'login' ? '' : 'none';
    analytics.track('tab_switch', { tab: target });

    // Clear errors
    document.querySelectorAll('.auth__error, .auth__success').forEach(el => el.textContent = '');
  });
});

// State for verification flow
let authToken = '';
let authEmail = '';

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
    errorEl.textContent = i18n.t('auth.errorFillAll');
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = i18n.t('auth.errorPasswordMin');
    return;
  }
  if (password !== passwordConfirm) {
    errorEl.textContent = i18n.t('auth.errorPasswordMismatch');
    return;
  }

  btn.disabled = true;
  btn.textContent = i18n.t('auth.registeringBtn');
  analytics.track('register_submit');

  try {
    const res = await fetch(API_URL + '/api/v1/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, password_confirm: passwordConfirm }),
    });
    const data = await res.json();

    if (data.ok) {
      analytics.track('register_success');
      authToken = data.token;
      authEmail = email;
      // Show verification form
      document.getElementById('register-form').style.display = 'none';
      document.getElementById('verify-form').style.display = '';
      document.getElementById('verify-email-display').textContent = email;
      document.querySelector('.auth__tabs').style.display = 'none';
    } else {
      errorEl.textContent = data.error || i18n.t('auth.errorRegister');
    }
  } catch (err) {
    errorEl.textContent = i18n.t('auth.errorConnection');
  } finally {
    btn.disabled = false;
    btn.textContent = i18n.t('auth.registerBtn');
  }
});

// Verify email code
document.getElementById('verify-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const errorEl = document.getElementById('verify-error');
  const successEl = document.getElementById('verify-success');
  const btn = form.querySelector('.auth__btn');
  errorEl.textContent = '';
  successEl.textContent = '';

  const code = form.code.value.trim();
  if (!code || code.length !== 6) {
    errorEl.textContent = i18n.t('auth.errorCode');
    return;
  }

  btn.disabled = true;
  btn.textContent = i18n.t('auth.verifyingBtn');

  try {
    const res = await fetch(API_URL + '/api/v1/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();

    if (data.ok) {
      analytics.track('verify_success');
      successEl.textContent = i18n.t('auth.verifySuccess');
      setTimeout(() => {
        window.location.href = API_URL + '/dashboard/auth/jwt?t=' + encodeURIComponent(authToken);
      }, 500);
    } else {
      errorEl.textContent = data.error || i18n.t('auth.errorInvalidCode');
    }
  } catch (err) {
    errorEl.textContent = i18n.t('auth.errorConnection');
  } finally {
    btn.disabled = false;
    btn.textContent = i18n.t('auth.verifyBtn');
  }
});

// Resend verification code
document.getElementById('resend-btn').addEventListener('click', async () => {
  const btn = document.getElementById('resend-btn');
  const errorEl = document.getElementById('verify-error');
  const successEl = document.getElementById('verify-success');
  errorEl.textContent = '';
  successEl.textContent = '';

  btn.disabled = true;
  try {
    const res = await fetch(API_URL + '/api/v1/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
    });
    const data = await res.json();

    if (data.ok) {
      successEl.textContent = i18n.t('auth.resendSuccess');
    } else {
      errorEl.textContent = data.error || i18n.t('auth.errorGeneric');
    }
  } catch (err) {
    errorEl.textContent = i18n.t('auth.errorConnection');
  } finally {
    setTimeout(() => { btn.disabled = false; }, 60000); // 1 min cooldown
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
    errorEl.textContent = i18n.t('auth.errorFillAll');
    return;
  }

  btn.disabled = true;
  btn.textContent = i18n.t('auth.loggingInBtn');
  analytics.track('login_submit');

  try {
    const res = await fetch(API_URL + '/api/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (data.ok) {
      analytics.track('login_success');
      successEl.textContent = i18n.t('auth.loginSuccess');
      setTimeout(() => {
        window.location.href = API_URL + '/dashboard/auth/jwt?t=' + encodeURIComponent(data.token);
      }, 500);
    } else {
      errorEl.textContent = data.error || i18n.t('auth.errorLogin');
    }
  } catch (err) {
    errorEl.textContent = i18n.t('auth.errorConnection');
  } finally {
    btn.disabled = false;
    btn.textContent = i18n.t('auth.loginBtn');
  }
});

// ==================== Analytics: click & scroll events ====================

// CTA clicks (hero, pricing, nav → #auth)
document.querySelectorAll('a[href="#auth"]').forEach(link => {
  link.addEventListener('click', () => {
    analytics.track('cta_click', { source: link.closest('section, header')?.id || 'unknown' });
  });
});

// Telegram bot links
document.querySelectorAll('a[href*="t.me/NoBorderVPN_bot"]').forEach(link => {
  link.addEventListener('click', () => {
    analytics.track('telegram_bot_click', { source: link.closest('section')?.id || 'unknown' });
  });
});

// Pricing plan select
document.querySelectorAll('.price-card .btn, .price-card .btn--outline').forEach(btn => {
  btn.addEventListener('click', () => {
    const card = btn.closest('.price-card');
    const plan = card?.querySelector('.price-card__period')?.textContent.trim() || '';
    analytics.track('pricing_select', { plan: plan });
  });
});

// Section views (IntersectionObserver)
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      analytics.track('section_view', { section: entry.target.id });
      sectionObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.3 });

document.querySelectorAll('section[id]').forEach(sec => sectionObserver.observe(sec));

// ==================== Init i18n ====================

i18n.init();
