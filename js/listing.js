let listingData = null;
let currentPhotoIndex = 0;

function onAppReady() {
  setupNav('feed');
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { location.href = 'index.html'; return; }

  tg.BackButton.show();
  tg.BackButton.onClick(() => history.back());

  loadListing(id);
}

async function loadListing(id) {
  const container = document.getElementById('listing-container');
  container.innerHTML = `<div class="skeleton-listing"></div>`;

  try {
    listingData = await getListing(id);
    const wantsCount = await getWantsCount(id);
    const alreadyWanted = await hasWanted(id, currentUser.id);
    renderListing(wantsCount, alreadyWanted);
  } catch (e) {
    container.innerHTML = `<p class="error-text">${t('error.generic')}</p>`;
  }
}

function renderListing(wantsCount, alreadyWanted) {
  const d = listingData;
  const photos = [...(d.listing_photos || [])].sort((a, b) => a.order_index - b.order_index);
  const isOwner = d.user_id === currentUser.id;

  document.getElementById('listing-container').innerHTML = `
    <div class="listing-photos">
      ${photos.length ? `
        <div class="carousel" id="carousel">
          ${photos.map((p, i) => `
            <div class="carousel-slide ${i === 0 ? 'active' : ''}">
              <img src="${p.url}" alt="${d.title}">
            </div>
          `).join('')}
        </div>
        ${photos.length > 1 ? `
          <div class="carousel-dots">
            ${photos.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`).join('')}
          </div>
        ` : ''}
      ` : `<div class="listing-no-photo"></div>`}
    </div>

    <div class="listing-body">
      <div class="listing-header">
        <span class="badge badge-${d.type}">${t(`listing.${d.type}`)}</span>
        ${d.type === 'sale' && d.price ? `<span class="listing-price">${d.price} ฿</span>` : ''}
      </div>

      <h1 class="listing-title">${d.title}</h1>

      ${d.description ? `<p class="listing-description">${d.description}</p>` : ''}

      <div class="listing-details">
        ${d.category ? `<div class="detail-row"><span class="detail-label">${getCategoryLabel(d.category)}</span></div>` : ''}
        ${d.size ? `<div class="detail-row"><span class="detail-label">📐 ${d.size}</span></div>` : ''}
        ${d.condition ? `<div class="detail-row"><span class="detail-label">✨ ${t(`listing.condition.${d.condition}`)}</span></div>` : ''}
        ${d.location ? `<div class="detail-row"><span class="detail-label">📍 ${d.location}</span></div>` : ''}
        ${d.available_until ? `<div class="detail-row"><span class="detail-label">📅 ${t('listing.available')} ${formatDate(d.available_until)}</span></div>` : ''}
      </div>

      ${wantsCount > 0 ? `
        <p class="wants-count">${wantsCount} ${t('listing.interested')}</p>
      ` : ''}

      ${!isOwner ? `
        <div id="want-section">
          ${alreadyWanted
            ? `<div class="contact-block" id="contact-block">
                ${renderContact(d.users)}
              </div>`
            : `<button class="btn btn-primary btn-want" id="want-btn">
                ${t('listing.want')}
              </button>
              <div class="contact-block hidden" id="contact-block">
                ${renderContact(d.users)}
              </div>`
          }
        </div>
      ` : ''}

      <div class="listing-author">
        ${d.users?.avatar_url ? `<img src="${d.users.avatar_url}" class="author-avatar" alt="">` : `<div class="author-avatar-placeholder"></div>`}
        <div class="author-info">
          <span class="author-name">${d.users?.name || ''}</span>
          ${d.users?.created_at ? `<span class="author-since">${t('listing.member_since')} ${formatMemberSince(d.users.created_at)}</span>` : ''}
        </div>
      </div>
    </div>
  `;

  setupCarousel(photos);
  setupWantButton(d, alreadyWanted, wantsCount);
}

function renderContact(user) {
  if (!user) return '';
  const tgLink = user.telegram_handle
    ? `<a href="https://t.me/${user.telegram_handle}" class="btn btn-contact" target="_blank">
        ${t('listing.contact')} @${user.telegram_handle}
      </a>`
    : '';
  const igLink = user.instagram
    ? `<a href="https://instagram.com/${user.instagram.replace('@', '')}" class="btn btn-secondary" target="_blank">
        Instagram ${user.instagram}
      </a>`
    : '';
  return tgLink + igLink;
}

function setupCarousel(photos) {
  if (photos.length <= 1) return;
  const carousel = document.getElementById('carousel');
  if (!carousel) return;

  let startX = 0;
  carousel.addEventListener('touchstart', e => { startX = e.touches[0].clientX; });
  carousel.addEventListener('touchend', e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      goToSlide(diff > 0
        ? Math.min(currentPhotoIndex + 1, photos.length - 1)
        : Math.max(currentPhotoIndex - 1, 0)
      );
    }
  });

  document.querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('click', () => goToSlide(Number(dot.dataset.index)));
  });
}

function goToSlide(index) {
  document.querySelectorAll('.carousel-slide').forEach((s, i) => s.classList.toggle('active', i === index));
  document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === index));
  currentPhotoIndex = index;
}

async function setupWantButton(listing, alreadyWanted, wantsCount) {
  if (alreadyWanted) return;
  const btn = document.getElementById('want-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;

    const canWant = await hasAnyListing(currentUser.id);
    if (!canWant) {
      btn.disabled = false;
      showPostFirst();
      return;
    }

    try {
      await addWant(listing.id, currentUser.id);
      Promise.allSettled([notifyOwner(listing.users?.telegram_id, listing.title)]);

      btn.style.display = 'none';
      const contactBlock = document.getElementById('contact-block');
      contactBlock.classList.remove('hidden');
      contactBlock.classList.add('fade-in');

      const wantsEl = document.querySelector('.wants-count');
      if (wantsEl) wantsEl.textContent = `${wantsCount + 1} ${t('listing.interested')}`;
    } catch (e) {
      btn.disabled = false;
    }
  });
}

function showPostFirst() {
  const section = document.getElementById('want-section');
  const msg = document.createElement('p');
  msg.className = 'post-first-msg';
  msg.textContent = t('listing.post_first');
  section.appendChild(msg);
  setTimeout(() => msg.remove(), 3000);
}
