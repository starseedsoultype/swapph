let feedFilters = { category: 'all', type: 'all' };
let feedData = [];

function onAppReady() {
  renderFilters();
  loadFeed();
  setupNav('feed');
}

function renderFilters() {
  const categoryEl = document.getElementById('filter-category');
  const typeEl = document.getElementById('filter-type');

  const categories = ['all', 'clothes', 'shoes', 'accessories', 'swimwear', 'kids', 'other'];
  categoryEl.innerHTML = categories.map(c => `
    <button class="filter-btn ${c === feedFilters.category ? 'active' : ''}"
            data-filter="category" data-value="${c}">
      ${c === 'all' ? t('feed.filter.all') : t(`category.${c}`)}
    </button>
  `).join('');

  const types = ['all', 'swap', 'sale', 'free'];
  typeEl.innerHTML = types.map(tp => `
    <button class="filter-btn ${tp === feedFilters.type ? 'active' : ''}"
            data-filter="type" data-value="${tp}">
      ${tp === 'all' ? t('feed.filter.all') : t(`feed.filter.${tp}`)}
    </button>
  `).join('');

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      const value = btn.dataset.value;
      feedFilters[filter] = value;
      document.querySelectorAll(`[data-filter="${filter}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadFeed();
    });
  });
}

async function loadFeed() {
  const grid = document.getElementById('feed-grid');
  grid.innerHTML = `<div class="skeleton-grid">${Array(4).fill('<div class="skeleton-card"></div>').join('')}</div>`;

  try {
    const filters = {};
    if (feedFilters.category !== 'all') filters.category = feedFilters.category;
    if (feedFilters.type !== 'all') filters.type = feedFilters.type;

    feedData = await getListings(filters);
    renderFeed();
  } catch (e) {
    grid.innerHTML = `<p class="feed-empty">${t('error.generic')}</p>`;
  }
}

function renderFeed() {
  const grid = document.getElementById('feed-grid');

  if (!feedData.length) {
    grid.innerHTML = `<p class="feed-empty">${t('feed.empty')}</p>`;
    return;
  }

  grid.innerHTML = feedData.map((item, i) => {
    const photo = getFirstPhoto(item);
    const typeLabel = getListingTypeLabel(item.type);
    const daysLeft = item.available_until ? getDaysLeft(item.available_until) : null;

    return `
      <div class="card" data-id="${item.id}" style="animation-delay:${i * 50}ms">
        <div class="card-photo">
          ${photo
            ? `<img src="${photo}" alt="${item.title}" loading="lazy">`
            : `<div class="card-no-photo"></div>`
          }
          <span class="badge badge-${item.type}">${typeLabel}</span>
          ${item.type === 'sale' && item.price ? `<span class="card-price">${item.price} ฿</span>` : ''}
        </div>
        <div class="card-body">
          <h3 class="card-title">${item.title}</h3>
          <div class="card-meta">
            ${item.size ? `<span class="card-size">${item.size}</span>` : ''}
            ${item.location ? `<span class="card-location">${item.location}</span>` : ''}
          </div>
          ${daysLeft !== null && daysLeft <= 7
            ? `<p class="card-expires">${t('listing.available')} ${formatDate(item.available_until)}</p>`
            : ''
          }
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = `listing.html?id=${card.dataset.id}`;
    });
  });
}

function getDaysLeft(dateStr) {
  const until = new Date(dateStr);
  const now = new Date();
  return Math.ceil((until - now) / 86400000);
}

function setupNav(active) {
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.dataset.page === active) item.classList.add('active');
  });
}
