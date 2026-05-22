const tg = window.Telegram?.WebApp;
let currentUser = null; // { id, telegram_id, name, telegram_handle, ... }

async function initApp() {
  // Desktop detection
  if (!tg || !tg.initData) {
    showDesktopScreen();
    return;
  }

  tg.ready();
  tg.expand();

  // Apply Telegram theme
  if (tg.colorScheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  // Auth
  try {
    const stored = getStoredSession();
    if (stored) {
      setAccessToken(stored.access_token);
      currentUser = await getUser(stored.user_id);
    } else {
      const session = await authWithTelegram(tg.initData);
      storeSession(session);
      setAccessToken(session.access_token);
      currentUser = await getUser(session.user_id);
    }
  } catch (e) {
    // Clear bad session and retry once
    clearSession();
    try {
      const session = await authWithTelegram(tg.initData);
      storeSession(session);
      setAccessToken(session.access_token);
      currentUser = await getUser(session.user_id);
    } catch (e2) {
      showError(e2.message || t('error.generic'));
      return;
    }
  }

  applyI18n();
  onAppReady();
}

function getStoredSession() {
  try {
    const raw = localStorage.getItem('swapph_session');
    if (!raw) return null;
    const s = JSON.parse(raw);
    // basic expiry check (24h)
    if (Date.now() - s.stored_at > 86400000) {
      clearSession();
      return null;
    }
    return s;
  } catch { return null; }
}

function storeSession(session) {
  localStorage.setItem('swapph_session', JSON.stringify({
    ...session,
    stored_at: Date.now()
  }));
}

function clearSession() {
  localStorage.removeItem('swapph_session');
}

function showDesktopScreen() {
  document.body.innerHTML = `
    <div class="desktop-screen">
      <div class="desktop-content">
        <div class="logo">SwapPH</div>
        <h2 data-i18n="desktop.title">${t('desktop.title')}</h2>
        <p data-i18n="desktop.text">${t('desktop.text')}</p>
        <div class="desktop-icon">📱</div>
      </div>
    </div>
  `;
}

function showError(msg) {
  const el = document.getElementById('error-banner');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
    el.style.fontSize = '11px';
    el.style.padding = '8px 12px';
    // не скрываем — нужно увидеть ошибку
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric', month: 'short'
  });
}

function formatMemberSince(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US', {
    month: 'long', year: 'numeric'
  });
}

function getListingTypeLabel(type) {
  return t(`listing.${type}`);
}

function getCategoryLabel(cat) {
  return t(`category.${cat}`);
}

function getFirstPhoto(listing) {
  if (!listing.listing_photos?.length) return null;
  const sorted = [...listing.listing_photos].sort((a, b) => a.order_index - b.order_index);
  return sorted[0].url;
}

document.addEventListener('DOMContentLoaded', initApp);
