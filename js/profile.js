let myListings = [];
let activeTab = 'active';

function onAppReady() {
  setupNav('profile');
  renderProfile();
  loadMyListings();
}

function renderProfile() {
  const u = currentUser;
  document.getElementById('profile-avatar').src = u.avatar_url || '';
  document.getElementById('profile-avatar').style.display = u.avatar_url ? 'block' : 'none';
  document.getElementById('profile-name').textContent = u.name;
  document.getElementById('profile-since').textContent =
    `${t('profile.member_since')} ${formatMemberSince(u.created_at)}`;

  const availBtn = document.getElementById('availability-btn');
  availBtn.textContent = u.is_available ? t('profile.available') : t('profile.unavailable');
  availBtn.className = `btn availability-btn ${u.is_available ? 'available' : 'unavailable'}`;
  availBtn.addEventListener('click', toggleAvailability);

  document.getElementById('instagram-input').value = u.instagram || '';
  document.getElementById('save-contacts-btn').addEventListener('click', saveContacts);

  if (u.telegram_handle === 'AlexxaBreeze') {
    document.getElementById('admin-link').style.display = 'block';
  }

  document.getElementById('delete-account-btn').addEventListener('click', confirmDeleteAccount);

  applyI18n();
}

async function toggleAvailability() {
  const newVal = !currentUser.is_available;
  await updateUser(currentUser.id, { is_available: newVal });
  currentUser.is_available = newVal;
  const btn = document.getElementById('availability-btn');
  btn.textContent = newVal ? t('profile.available') : t('profile.unavailable');
  btn.className = `btn availability-btn ${newVal ? 'available' : 'unavailable'}`;
}

async function saveContacts() {
  const instagram = document.getElementById('instagram-input').value.trim() || null;
  await updateUser(currentUser.id, { instagram });
  currentUser.instagram = instagram;
  const btn = document.getElementById('save-contacts-btn');
  btn.textContent = '✓';
  setTimeout(() => btn.textContent = t('profile.save'), 1500);
}

function confirmDeleteAccount() {
  const confirmMsg = t('profile.delete_confirm');
  const tg = window.Telegram?.WebApp;

  if (tg?.showConfirm) {
    tg.showConfirm(confirmMsg, async (confirmed) => {
      if (confirmed) await executeDeleteAccount();
    });
  } else {
    // Fallback for non-Telegram context
    if (window.confirm(confirmMsg)) executeDeleteAccount();
  }
}

async function executeDeleteAccount() {
  const btn = document.getElementById('delete-account-btn');
  btn.textContent = '...';
  btn.disabled = true;
  try {
    await deleteMyAccount();
    clearSession();
    const tg = window.Telegram?.WebApp;
    if (tg?.showAlert) {
      tg.showAlert(t('profile.delete_done'), () => tg.close());
    } else {
      alert(t('profile.delete_done'));
      tg?.close();
    }
  } catch (e) {
    btn.textContent = t('profile.delete_account');
    btn.disabled = false;
    showError(e.message || t('error.generic'));
  }
}

async function loadMyListings() {
  myListings = await getMyListings(currentUser.id);
  renderMyListings();
}

function renderMyListings() {
  const active = myListings.filter(l => l.is_active);
  const archive = myListings.filter(l => !l.is_active);
  const list = activeTab === 'active' ? active : archive;

  document.getElementById('tab-active').classList.toggle('active', activeTab === 'active');
  document.getElementById('tab-archive').classList.toggle('active', activeTab === 'archive');

  document.getElementById('tab-active').addEventListener('click', () => { activeTab = 'active'; renderMyListings(); });
  document.getElementById('tab-archive').addEventListener('click', () => { activeTab = 'archive'; renderMyListings(); });

  const container = document.getElementById('my-listings');
  if (!list.length) {
    container.innerHTML = `<p class="feed-empty">${t('feed.empty')}</p>`;
    return;
  }

  container.innerHTML = list.map(item => {
    const photo = getFirstPhoto(item);
    return `
      <div class="my-listing-row">
        <div class="my-listing-photo">
          ${photo ? `<img src="${photo}" alt="">` : `<div class="no-photo-sm"></div>`}
        </div>
        <div class="my-listing-info">
          <span class="my-listing-title">${item.title}</span>
          <span class="badge badge-${item.type} badge-sm">${t(`listing.${item.type}`)}</span>
        </div>
        ${item.is_active ? `
          <button class="btn btn-close-listing" data-id="${item.id}">
            ${t('profile.close_listing')}
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-close-listing').forEach(btn => {
    btn.addEventListener('click', async () => {
      await closeListing(btn.dataset.id);
      const idx = myListings.findIndex(l => l.id === btn.dataset.id);
      if (idx !== -1) myListings[idx].is_active = false;
      renderMyListings();
    });
  });
}
