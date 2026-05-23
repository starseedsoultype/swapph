let selectedFiles = [];

function onAppReady() {
  setupNav('add');
  renderForm();

  tg.BackButton.show();
  tg.BackButton.onClick(() => history.back());

  tg.MainButton.setText(t('add.publish'));
  tg.MainButton.show();
  tg.MainButton.onClick(submitListing);
}

function renderForm() {
  applyI18n();
  document.getElementById('price-row').style.display = 'none';

  document.getElementById('type-select').addEventListener('change', e => {
    document.getElementById('price-row').style.display =
      e.target.value === 'sale' ? 'block' : 'none';
  });

  document.getElementById('photo-input').addEventListener('change', handlePhotoSelect);
}

function handlePhotoSelect(e) {
  const files = Array.from(e.target.files);
  const remaining = 5 - selectedFiles.length;
  const toAdd = files.slice(0, remaining);
  selectedFiles = [...selectedFiles, ...toAdd];
  renderPhotoPreview();
  e.target.value = '';
}

function renderPhotoPreview() {
  const container = document.getElementById('photo-preview');
  container.innerHTML = '';

  selectedFiles.forEach((f, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';

    const img = document.createElement('img');
    img.alt = '';
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    reader.readAsDataURL(f);

    const btn = document.createElement('button');
    btn.className = 'photo-remove';
    btn.textContent = '×';
    btn.addEventListener('click', () => {
      selectedFiles.splice(i, 1);
      renderPhotoPreview();
    });

    thumb.appendChild(img);
    thumb.appendChild(btn);
    container.appendChild(thumb);
  });

  document.getElementById('photo-add-btn').style.display =
    selectedFiles.length >= 5 ? 'none' : 'flex';
}

async function submitListing() {
  if (selectedFiles.length === 0) {
    showError(t('add.photos'));
    return;
  }

  const title = document.getElementById('title-input').value.trim();
  if (!title) { showError(t('add.name')); return; }

  const category = document.getElementById('category-select').value;
  const type = document.getElementById('type-select').value;
  if (!category) { showError(t('add.category')); return; }
  if (!type) { showError(t('add.type')); return; }

  tg.MainButton.setText(t('add.uploading'));
  tg.MainButton.disable();
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('add.uploading'); }

  try {
    const listing = {
      user_id: currentUser.id,
      title,
      description: document.getElementById('description-input').value.trim() || null,
      category,
      type,
      price: type === 'sale' ? Number(document.getElementById('price-input').value) || null : null,
      size: document.getElementById('size-select').value || null,
      condition: document.getElementById('condition-select').value || null,
      location: document.getElementById('location-input').value.trim() || null,
      city: currentCity,
      available_from: document.getElementById('from-input').value || null,
      available_until: document.getElementById('until-input').value || null,
      language: document.getElementById('lang-select').value || 'ru',
    };

    const { id: listingId } = await createListing(listing);

    const urls = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const url = await uploadPhoto(listingId, selectedFiles[i], i);
      urls.push(url);
    }
    await savePhotos(listingId, urls);

    tg.MainButton.hide();
    location.href = 'index.html';
  } catch (e) {
    tg.MainButton.setText(t('add.publish'));
    tg.MainButton.enable();
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t('add.publish'); }
    showError(e.message || t('error.generic'));
  }
}
