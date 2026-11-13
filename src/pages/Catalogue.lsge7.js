// Page « Liste biens ». Dataset Location en lecture seule, 12 éléments par charge.
// Dataset #dynamicDataset confirmé dans Studio le 26 octobre. Garder les connexions CMS
// du répéteur et de #button4 (« En voir plus ») ; aucun onClick ajouté à ce bouton.
// Réduire au chargement : repeater1, button4, emptyState, filterError.
// Garder imageX2/cover et cardSummary/summary connectés au CMS.
// onItemReady précède les liaisons CMS : le dataset virtuel de chaque carte
// fournit son onReady après leur alimentation, y compris après « En voir plus ».
// https://dev.wix.com/docs/velo/velo-only-apis/$w/repeater/using-connected-datasets-and-repetaers
import wixData from 'wix-data';

const DATASET_ID = '#dynamicDataset';
const OPTIONS = {
  transactionFilter: [['', 'Tous les biens'], ['sale', 'À vendre'], ['rent', 'À louer'], ['sold', 'Biens vendus']],
  typeFilter: [['', 'Tous les types'], ['maison', 'Maison'], ['appartement', 'Appartement'],
    ['terrain', 'Terrain'], ['bureau', 'Bureau'], ['local', 'Local'], ['autre', 'Autre']],
  sortFilter: [['newest', 'Plus récentes'], ['priceAsc', 'Prix croissant'], ['priceDesc', 'Prix décroissant']],
};
const INPUT_COPY = {
  transactionFilter: ['Transaction', 'Tous les biens'],
  typeFilter: ['Type de bien', 'Tous les types'],
  cityFilter: ['Commune', 'Ex. Bordeaux'],
  maxPriceFilter: ['Budget maximum (€)', 'Ex. 285 000'],
  sortFilter: ['Trier par', 'Plus récentes'],
};
const CONTROLS = ['transactionFilter', 'typeFilter', 'cityFilter', 'maxPriceFilter',
  'sortFilter', 'applyFilters', 'resetFilters'];

$w.onReady(() => {
  const dataset = $w(DATASET_ID);
  let ready = false;
  let busy = false;
  let datasetFailed = false;
  let uiWork = Promise.resolve();
  const cardWork = new Map();

  function updateCard($item, item) {
    const id = item?._id;
    if (typeof id !== 'string' || !id) return Promise.resolve();
    // Une réduction initiale lente ne doit pas masquer une image déjà chargée.
    const work = (cardWork.get(id) || Promise.resolve()).catch(() => {})
      .then(() => renderCard($item, item));
    cardWork.set(id, work);
    work.finally(() => { if (cardWork.get(id) === work) cardWork.delete(id); }).catch(() => {});
    return work;
  }

  function refreshCards() {
    const pending = [];
    $w('#repeater1').forEachItem(($item, item) => pending.push(updateCard($item, item)));
    return Promise.all(pending);
  }

  $w('#repeater1').onItemReady(($item, itemData) => {
    // Écarter les images/textes de modèle avant que la carte apparaisse.
    updateCard($item, { _id: itemData._id }).catch(() => {
      console.error('Impossible de préparer une carte de bien.');
    });
    const cardDataset = $item(DATASET_ID);
    cardDataset.onReady(() => {
      const current = cardDataset.getCurrentItem() || {};
      if (current._id !== itemData._id) return;
      return updateCard($item, current).catch(() => {
        console.error('Impossible de mettre en forme une carte de bien.');
      });
    });
  });

  for (const [id, choices] of Object.entries(OPTIONS)) {
    $w(`#${id}`).options = choices.map(([value, label]) => ({ value, label }));
  }
  for (const [id, [label, placeholder]] of Object.entries(INPUT_COPY)) {
    $w(`#${id}`).label = label;
    $w(`#${id}`).placeholder = placeholder;
    $w(`#${id}`).required = false;
  }
  $w('#applyFilters').label = 'Rechercher';
  $w('#resetFilters').label = 'Réinitialiser';
  resetInputs();
  setControls(false);
  render('loading');

  function setControls(enabled) {
    for (const id of CONTROLS) $w(`#${id}`)[enabled ? 'enable' : 'disable']();
  }

  // Sérialiser aussi les transitions visuelles : une réduction lente ne doit
  // pas masquer une recherche terminée. Ne jamais activer/désactiver button4 :
  // son état et son chargement restent gérés par la connexion native au dataset.
  function render(state, total = 0, message = '') {
    uiWork = uiWork.catch(() => {}).then(async () => {
      $w('#resultCount').text = state === 'loading' ? 'Chargement des biens…'
        : state === 'error' ? 'Annonces indisponibles'
          : `${total} bien${total === 1 ? '' : 's'}`;
      $w('#emptyState').text = 'Aucun bien ne correspond à vos critères. Essayez une autre recherche.';
      $w('#filterError').text = message;
      await Promise.all([
        display('#repeater1', state === 'results' && total > 0),
        display('#button4', state === 'results' && total > 0),
        display('#emptyState', state === 'results' && total === 0),
        display('#filterError', state === 'error'),
      ]);
    });
    return uiWork;
  }

  async function apply(reset = false) {
    if (!ready || busy) return;
    if (reset) resetInputs();
    let criteria;
    try {
      criteria = readCriteria();
    } catch (error) {
      // Une faute de saisie conserve les résultats précédents et leur compteur.
      uiWork = uiWork.catch(() => {}).then(async () => {
        $w('#filterError').text = error.message;
        await $w('#filterError').expand();
      });
      return uiWork;
    }

    busy = true;
    datasetFailed = false;
    setControls(false);
    try {
      await render('loading');
      await dataset.setFilter(makeFilter(criteria));
      if (datasetFailed) throw new Error('DATASET_FAILED');
      await dataset.setSort(makeSort(criteria.sort));
      if (datasetFailed) throw new Error('DATASET_FAILED');
      const total = dataset.getTotalCount();
      if (!Number.isSafeInteger(total) || total < 0) throw new Error('INVALID_COUNT');
      // Revenir explicitement au premier lot après une recherche. La pagination
      // suivante reste entièrement celle de « En voir plus » dans Studio.
      if (total > 0) await dataset.loadPage(1);
      if (datasetFailed) throw new Error('DATASET_FAILED');
      // Les IDs déjà présents ne redéclenchent pas onItemReady après un filtre.
      await refreshCards();
      await render('results', total);
    } catch {
      await render('error', 0, 'Impossible de charger les biens. Réessayez avec le bouton Rechercher.');
    } finally {
      busy = false;
      setControls(true);
    }
  }

  dataset.onReady(() => {
    if (ready) return refreshCards();
    ready = true;
    return apply();
  });
  dataset.onError(() => {
    datasetFailed = true;
    if (busy) return;
    return render('error', 0, ready
      ? 'Le chargement des biens a été interrompu. Réessayez avec le bouton Rechercher.'
      : 'Impossible de charger les biens. Rechargez la page pour réessayer.');
  });
  $w('#applyFilters').onClick(() => apply());
  $w('#resetFilters').onClick(() => apply(true));
});

async function renderCard($item, item) {
  const cover = cardImageSource(item.cover);
  const summary = cardSummary(item);
  // src reste une liaison CMS native ; le code ne remplace jamais une photo.
  $item('#imageX2').alt = cover ? (cardText(item.imageAltText)
    || [cardText(item.propertyTypeLabel) || cardText(item.title), cardText(item.city)].filter(Boolean).join(' — ')) : '';
  $item('#cardSummary').text = summary;
  await Promise.all([
    $item('#imageX2')[cover ? 'expand' : 'collapse'](),
    $item('#cardSummary')[summary ? 'expand' : 'collapse'](),
  ]);
}

function cardText(value) { return typeof value === 'string' ? value.trim() : ''; }

function cardImageSource(value) {
  const src = cardText(value);
  if (/^wix:image:\/\/v1\/[^/]+\//.test(src)) return src;
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

function cardSummary(item) {
  if (cardText(item.summary)) return cardText(item.summary);
  const parts = [];
  if (typeof item.area === 'number' && Number.isFinite(item.area) && item.area > 0) {
    parts.push(`${item.area.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} m²`);
  }
  if (Number.isInteger(item.rooms) && item.rooms > 0) parts.push(`${item.rooms} pièce${item.rooms > 1 ? 's' : ''}`);
  if (Number.isInteger(item.bedrooms) && item.bedrooms > 0) parts.push(`${item.bedrooms} chambre${item.bedrooms > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

function display(id, visible) {
  return $w(id)[visible ? 'expand' : 'collapse']();
}

function resetInputs() {
  for (const id of ['transactionFilter', 'typeFilter', 'cityFilter', 'maxPriceFilter']) $w(`#${id}`).value = '';
  $w('#sortFilter').value = 'newest';
}

function readCriteria() {
  const transaction = choice('transactionFilter');
  const propertyType = choice('typeFilter');
  const sort = choice('sortFilter');
  const city = String($w('#cityFilter').value ?? '').trim().replace(/\s+/g, ' ');
  if (city.length > 100) throw new Error('Saisissez une commune de moins de 100 caractères.');
  return { transaction, propertyType, sort, city, maxPrice: parseBudget($w('#maxPriceFilter').value) };
}

function choice(id) {
  const value = String($w(`#${id}`).value ?? '');
  if (!OPTIONS[id].some(([allowed]) => value === allowed)) throw new Error('Sélectionnez une option proposée dans les menus.');
  return value;
}

function parseBudget(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  // Accepte 285000, 285 000 et 285 000,50 (espaces français inclus).
  // Refuse exposants, hexadécimal, négatifs et séparateurs de milliers ambigus.
  if (!/^(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[,.]\d{1,2})?$/.test(raw)) {
    throw new Error('Saisissez un budget positif, par exemple 285 000 ou 950,50.');
  }
  const amount = Number(raw.replace(/[ \u00a0\u202f]/g, '').replace(',', '.'));
  if (!Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 100))) {
    throw new Error('Le budget saisi est trop élevé.');
  }
  return amount;
}

function makeFilter(criteria) {
  // setFilter remplace les filtres Studio : conserver cette règle à chaque appel,
  // y compris Réinitialiser. Cela ne modifie aucun statut CMS et ne publie rien.
  let filter = wixData.filter().eq('_publishStatus', 'PUBLISHED');
  // Un bien vendu arrive de l'import sans prix. Il n'apparaît que sous « Biens
  // vendus », comme la rubrique du même nom sur le site actuel de l'agence ;
  // les autres choix, « Tous les biens » compris, ne montrent que les biens disponibles.
  if (criteria.transaction === 'sold') filter = filter.isEmpty('price');
  else {
    filter = filter.isNotEmpty('price');
    if (criteria.transaction) filter = filter.eq('transaction', criteria.transaction);
  }
  if (criteria.propertyType) filter = filter.eq('propertyType', criteria.propertyType);
  if (criteria.city) filter = filter.contains('city', criteria.city);
  if (criteria.maxPrice !== undefined) filter = filter.le('price', criteria.maxPrice);
  return filter;
}

function makeSort(sort) {
  const order = sort === 'priceAsc' ? wixData.sort().ascending('price')
    : sort === 'priceDesc' ? wixData.sort().descending('price')
      : wixData.sort().descending('_createdDate');
  return order.ascending('_id');
}
