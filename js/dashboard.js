const ADMIN_HANDLE = 'AlexxaBreeze';

function onAppReady() {
  const page = document.getElementById('dashboard-page');

  if (currentUser.telegram_handle !== ADMIN_HANDLE) {
    page.innerHTML = '<p style="padding:60px 20px;text-align:center;color:var(--color-text-muted)">Access denied</p>';
    return;
  }

  tg.BackButton.show();
  tg.BackButton.onClick(() => history.back());

  renderSkeleton();
  loadMetrics();
}

function renderSkeleton() {
  document.getElementById('dashboard-page').innerHTML = `
    <div style="padding: 20px">
      <h1 style="font-family: var(--font-display); font-size: 28px; margin-bottom: 20px">Dashboard</h1>
      <div class="dash-grid">
        <div class="skeleton-card" style="height: 90px"></div>
        <div class="skeleton-card" style="height: 90px"></div>
        <div class="skeleton-card" style="height: 90px"></div>
        <div class="skeleton-card" style="height: 90px"></div>
      </div>
    </div>
  `;
}

async function loadMetrics() {
  try {
    const m = await getMetrics();
    renderDashboard(m);
  } catch (e) {
    document.getElementById('dashboard-page').innerHTML =
      `<p style="padding:40px;text-align:center;color:var(--color-text-muted)">${e.message}</p>`;
  }
}

function renderDashboard(m) {
  const avgWants = m.listings.active > 0
    ? (m.wants / m.listings.active).toFixed(1)
    : '—';

  document.getElementById('dashboard-page').innerHTML = `
    <div style="padding: 20px 20px 60px">
      <h1 style="font-family: var(--font-display); font-size: 28px; margin-bottom: 4px">Dashboard</h1>
      <p style="color: var(--color-text-muted); font-size: 12px; margin-bottom: 24px">
        ${new Date().toLocaleString('ru-RU')}
      </p>

      <div class="dash-grid">
        <div class="dash-card">
          <div class="dash-value">${m.users}</div>
          <div class="dash-label">Пользователей</div>
        </div>
        <div class="dash-card">
          <div class="dash-value">${m.listings.active}</div>
          <div class="dash-label">Активных объявлений</div>
        </div>
        <div class="dash-card">
          <div class="dash-value">${m.wants}</div>
          <div class="dash-label">Всего хотят</div>
        </div>
        <div class="dash-card">
          <div class="dash-value">${avgWants}</div>
          <div class="dash-label">Avg wants / listing</div>
        </div>
      </div>

      <h3 class="dash-section-title">Объявления по типу</h3>
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px">
        <span class="badge badge-swap">Обмен: ${m.listings.swap}</span>
        <span class="badge badge-sale">Продажа: ${m.listings.sale}</span>
        <span class="badge badge-free">Бесплатно: ${m.listings.free}</span>
      </div>
      <p style="font-size: 12px; color: var(--color-rose-dusty); margin-bottom: 24px">
        + ${m.listings.newThisWeek} новых за 7 дней
      </p>

      <h3 class="dash-section-title">Последние объявления</h3>
      ${m.recent.map(l => {
        const photo = (l.listing_photos || [])
          .sort((a, b) => a.order_index - b.order_index)[0]?.url;
        return `
          <div class="my-listing-row" onclick="location.href='listing.html?id=${l.id}'" style="cursor:pointer">
            <div class="my-listing-photo">
              ${photo ? `<img src="${photo}" alt="">` : `<div class="no-photo-sm"></div>`}
            </div>
            <div class="my-listing-info">
              <span class="my-listing-title">${l.title}</span>
              <span style="font-size:11px; color: var(--color-text-muted)">${formatDate(l.created_at)}</span>
            </div>
            <span class="badge badge-${l.type} badge-sm">${l.type}</span>
          </div>
        `;
      }).join('')}

      <button class="btn btn-secondary" onclick="loadMetrics()" style="margin-top: 24px">
        ↺ Обновить
      </button>
    </div>
  `;
}
