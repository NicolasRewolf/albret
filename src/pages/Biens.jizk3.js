// Fiche d'un bien (page dynamique « Biens »). Ce fichier est la source : il n'est plus généré.
// Pure CMS -> native Wix presentation model. No $w, CMS writes or network calls.
// Each call returns fresh data. Use native Text.text, or escape source strings before HTML.
const text = value => typeof value === 'string' ? value.trim() : '';
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const number = value => finite(value) ? value.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '';
const moneyNumber = value => finite(value) ? value.toLocaleString('fr-FR', {
  minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  maximumFractionDigits: 2,
}) : '';
const integer = value => Number.isSafeInteger(value) && value >= 0 ? number(value) : '';
const positiveInteger = value => Number.isSafeInteger(value) && value > 0 ? number(value) : '';
const area = value => finite(value) ? `${number(value)} m²` : '';
const positiveArea = value => finite(value) && value > 0 ? area(value) : '';
const money = value => finite(value) ? `${moneyNumber(value)} €` : '';
const legalMoney = value => finite(value) ? `${number(value)} €` : '';
const boolean = value => value === true ? 'Oui' : value === false ? 'Non' : '';
const floor = value => value === 0 ? 'RDC / RDJ' : integer(value);
const year = value => Number.isSafeInteger(value) && value > 0 && value <= 9999 ? String(value) : '';
const enumValue = labels => value => typeof value === 'string' && Object.hasOwn(labels, value) ? labels[value] : '';

function date(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    value = value.toISOString().slice(0, 10);
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) value = trimmed.slice(0, 10);
    else if (/^\d{4}$/.test(trimmed)) return trimmed;
    else value = trimmed;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return '';
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

function url(value, protocols = ['https:']) {
  try {
    const parsed = new URL(text(value));
    return protocols.includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : '';
  } catch { return ''; }
}

function imageSource(value) {
  const source = text(value);
  const wix = /^wix:image:\/\/v1\/([A-Za-z0-9_~.\-]+)\/[^\s?#]+(#[^\s]*)?$/.exec(source);
  if (wix) {
    return (wix[2] || '').includes('#originWidth=') ? source : `https://static.wixstatic.com/media/${wix[1]}`;
  }
  return url(source);
}

function imageIdentity(source) {
  const wix = /^wix:image:\/\/v1\/([^/]+)\//.exec(source);
  if (wix) return `wix:${wix[1]}`;
  const parsed = new URL(source);
  const media = parsed.hostname === 'static.wixstatic.com' && /^\/media\/([^/]+)/.exec(parsed.pathname);
  if (media) return `wix:${media[1]}`;
  parsed.hash = '';
  return parsed.href;
}

function galleryFor(item) {
  const entries = (Array.isArray(item.gallery) ? item.gallery : []).flatMap(entry => {
    const candidate = object(entry);
    const source = imageSource(candidate.src);
    return text(candidate.type).toLowerCase() === 'image' && source ? [{
      type: 'image', src: source, title: text(candidate.title) || text(item.title),
      description: text(candidate.description),
    }] : [];
  });
  const cover = imageSource(item.cover);
  if (cover) {
    const original = entries.find(entry => imageIdentity(entry.src) === imageIdentity(cover));
    const source = original?.src.startsWith('wix:image://') ? original.src : cover;
    entries.unshift({ type: 'image', src: source, title: original?.title || text(item.title),
      description: original?.description || '' });
  }
  const seen = new Set();
  return entries.filter(entry => {
    const identity = imageIdentity(entry.src);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

const TYPE_LABELS = { maison: 'Maison', appartement: 'Appartement', bureau: 'Bureau',
  local: 'Local', terrain: 'Terrain', autre: 'Autre bien' };
const FEES_PAYER = { buyer: 'l’acquéreur', seller: 'le vendeur', both: 'l’acquéreur et le vendeur' };
const CHARGE_TERMS = { monthly_flat: 'Forfaitaires mensuelles',
  monthly_provision_annual_adjustment: 'Provisions mensuelles avec régularisation annuelle',
  annual_reimbursement: 'Remboursement annuel par le locataire' };

function cityLabel(item) {
  const city = text(item.city);
  const postalCode = text(item.postalCode);
  if (!postalCode || city.includes(postalCode)) return city;
  return [city, postalCode].filter(Boolean).join(' · ');
}

function variantFor(item, details) {
  if (['maison', 'appartement'].includes(item.propertyType)) return item.propertyType;
  const labels = `${text(item.propertyTypeLabel)} ${text(details.propertySubtype)}`.toLowerCase();
  return item.propertyType === 'autre' && /\b(?:garage|garages|parking|parkings|box)\b/.test(labels) ? 'garage' : 'autre';
}

function rows(source, definitions, prefix = 'fact') {
  return definitions.flatMap(([key, label, format = text]) => {
    const value = format(source[key]);
    return value === '' ? [] : [{ _id: `${prefix}-${key}`, label, value }];
  });
}

const SURFACES = [
  ['area', 'Surface', positiveArea], ['boutinArea', 'Surface loi Boutin', positiveArea],
  ['carrezArea', 'Surface loi Carrez', positiveArea], ['landArea', 'Surface du terrain', area],
  ['livingRoomArea', 'Surface du séjour', area], ['diningRoomArea', 'Surface de la salle à manger', area],
  ['balconyArea', 'Surface du balcon', area], ['terraceArea', 'Surface de la terrasse', area],
  ['cellarArea', 'Surface de la cave', area],
];
const LAYOUT = [
  ['propertyTypeLabel', 'Type de bien'], ['propertySubtype', 'Type de bien précisé'],
  ['neighborhood', 'Quartier'], ['rooms', 'Pièces', integer], ['bedrooms', 'Chambres', integer],
  ['floor', 'Étage', floor], ['totalFloors', 'Étages de l’immeuble', integer],
  ['levels', 'Niveaux', positiveInteger], ['sharedWalls', 'Murs mitoyens'],
  ['constructionYear', 'Année de construction', year], ['bathrooms', 'Salles de bains', integer],
  ['showerRooms', 'Salles d’eau', integer], ['toilets', 'WC', integer], ['balconies', 'Balcons', integer],
  ['terraces', 'Terrasses', integer], ['parkingSpaces', 'Places de parking', integer],
  ['garageSpaces', 'Places de garage', integer], ['kitchenLabel', 'Cuisine'],
  ['availableFrom', 'Disponible à partir du', date], ['duplex', 'Duplex', boolean],
  ['entrance', 'Entrée', boolean], ['parquet', 'Parquet', boolean],
  ['diningRoom', 'Salle à manger', boolean], ['livingRoom', 'Séjour', boolean],
  ['builtInStorage', 'Rangements', boolean],
];
const COMFORT = [
  ['heatingLabel', 'Chauffage'], ['furnished', 'Meublé', boolean],
  ['renovated', 'Refait à neuf', boolean], ['recent', 'Construction récente', boolean],
  ['needsRenovation', 'Travaux à prévoir', boolean], ['separateToilets', 'WC séparés', boolean],
  ['elevator', 'Ascenseur', boolean], ['cellar', 'Cave', boolean], ['terrace', 'Terrasse', boolean],
  ['digicode', 'Digicode', boolean], ['intercom', 'Interphone', boolean], ['caretaker', 'Gardien', boolean],
  ['alarm', 'Alarme', boolean], ['quiet', 'Calme', boolean], ['airConditioning', 'Climatisation', boolean],
  ['swimmingPool', 'Piscine', boolean], ['accessible', 'Aménagement pour handicapés', boolean],
  ['fireplace', 'Cheminée', boolean], ['view', 'Vue'], ['clearView', 'Vue dégagée', boolean],
  ['overlooked', 'Vis-à-vis', boolean], ['exclusive', 'Exclusivité', boolean], ['featured', 'Coup de cœur', boolean],
  ['southFacing', 'Exposition sud', boolean], ['eastFacing', 'Exposition est', boolean],
  ['westFacing', 'Exposition ouest', boolean], ['northFacing', 'Exposition nord', boolean],
  ['agriculturalLand', 'Terrain agricole', boolean], ['buildableLand', 'Terrain constructible', boolean],
  ['slopingLand', 'Terrain en pente', boolean], ['waterFeature', 'Plan d’eau', boolean],
  ['servicedLand', 'Terrain viabilisé', boolean],
];
const GARAGE_KEYS = new Set(['area', 'landArea', 'propertyTypeLabel', 'propertySubtype', 'neighborhood',
  'floor', 'totalFloors', 'constructionYear', 'parkingSpaces', 'garageSpaces', 'availableFrom',
  'heatingLabel', 'renovated', 'recent', 'needsRenovation', 'elevator', 'digicode', 'intercom',
  'caretaker', 'alarm', 'accessible', 'exclusive', 'featured']);

function metricsFor(source, garage) {
  const definitions = garage ? [
    ['area', 'Surface', positiveArea], ['garageSpaces', 'Places de garage', positiveInteger],
    ['parkingSpaces', 'Places de parking', positiveInteger], ['floor', 'Étage', floor],
  ] : [
    ['area', 'Surface', positiveArea], ['rooms', 'Pièces', positiveInteger],
    ['bedrooms', 'Chambres', positiveInteger], ['terraceArea', 'Terrasse', positiveArea],
    ['bathrooms', source.bathrooms === 1 ? 'Salle de bains' : 'Salles de bains', positiveInteger],
    ['showerRooms', source.showerRooms === 1 ? 'Salle d’eau' : 'Salles d’eau', positiveInteger],
    ['floor', 'Étage', floor],
  ];
  const heroKeys = new Set(garage ? ['area', 'garageSpaces', 'parkingSpaces'] : ['area', 'rooms', 'bedrooms']);
  const countUnits = { rooms: ['pièce', 'pièces'], bedrooms: ['chambre', 'chambres'],
    garageSpaces: ['place de garage', 'places de garage'], parkingSpaces: ['place de parking', 'places de parking'] };
  const heroDefinitions = definitions.filter(([key]) => heroKeys.has(key)).map(([key, label, format]) => [
    key, label, Object.hasOwn(countUnits, key) ? value => positiveInteger(value)
      ? `${positiveInteger(value)} ${countUnits[key][value === 1 ? 0 : 1]}` : '' : format,
  ]);
  return {
    heroMetrics: rows(source, heroDefinitions, 'hero'),
    quickFacts: rows(source, definitions, 'metric'),
  };
}

function rating(codeValue, consumption, unit) {
  const input = text(codeValue).toUpperCase();
  const code = /^[A-G]$/.test(input) || ['NS', 'VI'].includes(input) ? input : '';
  const label = code === 'NS' ? 'Non soumis' : code === 'VI' ? 'Vierge' : code;
  const value = !['NS', 'VI'].includes(code) && finite(consumption) ? `${number(consumption)} ${unit}` : '';
  return { code, label, consumption: value, showScale: /^[A-G]$/.test(code), visible: Boolean(label || value) };
}

function energyFor(item, details) {
  const dpe = rating(item.energyLabel, details.energyConsumption, 'kWhEP/m²/an');
  const ges = rating(item.gesLabel, details.gesEmission, 'kg éqCO₂/m²/an');
  dpe.finalConsumption = !['NS', 'VI'].includes(dpe.code) && finite(details.energyFinalConsumption)
    ? `${number(details.energyFinalConsumption)} kWh/m²/an` : '';
  dpe.visible ||= Boolean(dpe.finalConsumption);
  const hasRange = finite(details.energyCostMin) && finite(details.energyCostMax) && details.energyCostMin <= details.energyCostMax;
  const annualRange = hasRange ? `${money(details.energyCostMin)} à ${money(details.energyCostMax)} / an, abonnement inclus`
    : finite(details.energyCostAnnual) ? `${money(details.energyCostAnnual)} / an, abonnement inclus` : '';
  const costDefinitions = hasRange ? [
    ['energyCostAnnual', 'Estimation annuelle, abonnement inclus', money],
  ] : [
    ['energyCostMin', 'Estimation basse annuelle, abonnement inclus', money],
    ['energyCostMax', 'Estimation haute annuelle, abonnement inclus', money],
  ];
  const energyRows = rows(details, [
    ['dpeVersion', 'Version du DPE', enumValue({ 'DPE_v01-2011': 'Janvier 2011', 'DPE_v07-2021': 'Juillet 2021' })],
    ...costDefinitions,
  ], 'energy');
  const energy = { dpe, ges, annualRange, date: date(details.dpeDate),
    reference: date(details.energyCostReferenceDate), rows: energyRows };
  energy.visible = Boolean(dpe.visible || ges.visible || annualRange || energy.date || energy.reference || energyRows.length);
  return energy;
}

const SALE_FINANCIAL = [
  ['feesPayer', 'Honoraires à la charge de', enumValue(FEES_PAYER)],
  ['feesBuyerPercent', 'Honoraires TTC acquéreur, en pourcentage du prix hors honoraires', value =>
    finite(value) && value <= 100 ? `${number(value)} %` : ''],
  ['priceExcludingBuyerFees', 'Prix hors honoraires acquéreur', money],
  ['priceExcludingTax', 'Prix hors taxes', boolean],
  ['propertyTax', 'Taxe foncière annuelle', money],
];
const RENT_FINANCIAL = [
  ['baseRent', 'Loyer de base hors charges', money], ['rentCharges', 'Charges locataire transmises', money],
  ['chargeTerms', 'Modalités des charges', enumValue(CHARGE_TERMS)],
  ['rentChargesIncluded', 'Loyer charges comprises', boolean], ['rentExcludingTax', 'Loyer hors taxes', boolean],
  ['deposit', 'Dépôt de garantie', money], ['rentalFees', 'Honoraires TTC à la charge du locataire', money],
  ['inventoryFees', 'Dont honoraires TTC pour l’état des lieux', money],
  ['rentControlled', 'Soumis à l’encadrement des loyers', boolean],
  ['referenceRent', 'Loyer de référence majoré', money], ['rentSupplement', 'Complément de loyer', money],
  ['annualRent', 'Loyer annuel global', money], ['annualCharges', 'Charges annuelles globales', money],
  ['annualRentPerSquareMeter', 'Loyer annuel au m²', money],
  ['annualChargesPerSquareMeter', 'Charges annuelles au m²', money],
  ['monthlyChargesExcludingTax', 'Charges mensuelles hors taxes', boolean],
  ['annualRentChargesIncluded', 'Loyer annuel charges comprises', boolean],
  ['annualRentExcludingTax', 'Loyer annuel hors taxes', boolean],
  ['annualChargesExcludingTax', 'Charges annuelles hors taxes', boolean],
  ['annualRentPerSquareMeterChargesIncluded', 'Loyer annuel au m² charges comprises', boolean],
  ['annualRentPerSquareMeterExcludingTax', 'Loyer annuel au m² hors taxes', boolean],
  ['annualChargesPerSquareMeterExcludingTax', 'Charges annuelles au m² hors taxes', boolean],
];
const CO_OWNERSHIP = [
  ['coOwnership', 'Bien en copropriété', boolean], ['coOwnershipLots', 'Nombre de lots de copropriété', integer],
  ['coOwnershipAnnualCharges', 'Quote-part annuelle du budget prévisionnel de copropriété', money],
  ['coOwnershipProcedure', 'Syndicat des copropriétaires en procédure', boolean],
  ['coOwnershipProcedureDetails', 'Détails de la procédure'],
];

function financialFor(details, transaction, garage, soldListing) {
  if (soldListing) {
    return { financialRows: [], financialNotes: [], feesShort: '', feeScheduleUrl: '',
      financialHeading: 'Informations financières' };
  }
  const definitions = transaction === 'sale' ? SALE_FINANCIAL : transaction === 'rent' ? RENT_FINANCIAL : [];
  const excluded = new Set();
  if (garage || details.rentControlled === false) {
    excluded.add('referenceRent'); excluded.add('rentSupplement');
  }
  if (garage) excluded.add('rentControlled');
  const coOwnership = CO_OWNERSHIP.filter(([key]) =>
    (details.coOwnership !== false || key === 'coOwnership') &&
    (details.coOwnershipProcedure !== false || key === 'coOwnershipProcedureDetails'));
  const financialRows = rows(details, [...definitions.filter(([key]) => !excluded.has(key)), ...coOwnership], 'financial');
  const financialNotes = [text(details.financialConditions)].filter(Boolean);
  const feeScheduleUrl = url(details.feeScheduleUrl, ['http:', 'https:']);
  let feesShort = '';
  if (transaction === 'sale') {
    feesShort = enumValue({ buyer: 'Honoraires à la charge de l’acquéreur',
      seller: 'Honoraires à la charge du vendeur', both: 'Honoraires à la charge de l’acquéreur et du vendeur' })(details.feesPayer);
  } else if (transaction === 'rent' && finite(details.rentalFees)) {
    feesShort = `${money(details.rentalFees)} d’honoraires TTC à la charge du locataire`;
  }
  return { financialRows, financialNotes, feesShort, feeScheduleUrl,
    financialHeading: transaction === 'rent' ? 'Loyer et conditions' : transaction === 'sale' ? 'Prix et copropriété' : 'Informations financières' };
}

function rentalFor(item, details, transaction, financialRows) {
  if (transaction !== 'rent') return { rentalRows: [], rentalNotes: [] };
  const monthly = value => finite(value) ? `${money(value)} / mois` : '';
  const annual = value => finite(value) ? `${money(value)} / an` : '';
  const annualArea = value => finite(value) ? `${money(value)} / m² / an` : '';
  const knownRows = new Map(financialRows.map(row => [row._id.replace(/^financial-/, ''), row]));
  const rentalRows = [];
  const add = (key, label, value) => {
    if (value !== '') rentalRows.push({ _id: `rental-${key}`, label, value });
  };
  const detail = (key, label, format = money) => {
    if (knownRows.has(key)) add(key, label, format(details[key]));
  };

  // 1. Loyer principal, loyer hors charges et charges en tête
  const chargesIncluded = details.rentChargesIncluded === true;
  const monthlyCharges = ['monthly_flat', 'monthly_provision_annual_adjustment'].includes(details.chargeTerms);
  let excludingCharges = undefined;
  if (chargesIncluded && finite(item.price) && finite(details.rentCharges) && monthlyCharges
      && item.price >= details.rentCharges) {
    excludingCharges = Math.round((item.price - details.rentCharges) * 100) / 100;
  } else if (!chargesIncluded && finite(item.price)) {
    excludingCharges = Math.round(item.price * 100) / 100;
  }
  if (finite(item.price)) {
    add('totalRent', chargesIncluded ? 'Loyer charges comprises' : details.rentChargesIncluded === false
      ? 'Loyer hors charges' : 'Loyer', monthly(item.price));
  } else if (text(item.priceLabel)) {
    add('totalRent', 'Loyer affiché', text(item.priceLabel));
  }
  if (chargesIncluded && finite(excludingCharges)) {
    const coherentBase = !finite(details.baseRent) || details.baseRent <= excludingCharges;
    const coherentSupplement = !finite(details.baseRent) || !finite(details.rentSupplement)
      || Math.abs(details.baseRent + details.rentSupplement - excludingCharges) < 0.005;
    if (coherentBase && coherentSupplement) add('rentExcludingCharges', 'Loyer hors charges', monthly(excludingCharges));
  }
  const chargeLabels = {
    monthly_flat: 'Forfait de charges',
    monthly_provision_annual_adjustment: 'Provision sur charges',
    annual_reimbursement: 'Charges remboursées annuellement',
  };
  detail('rentCharges', chargeLabels[details.chargeTerms] || 'Charges locataire', monthlyCharges ? monthly : money);

  // 2. Dépôt de garantie et honoraires locataire
  detail('deposit', 'Dépôt de garantie');
  detail('rentalFees', 'Honoraires TTC à la charge du locataire');
  detail('inventoryFees', 'Dont honoraires TTC pour l’état des lieux');

  // 3. Encadrement des loyers regroupé (avec calcul auto du complément de loyer si dépassé)
  detail('rentControlled', 'Encadrement des loyers', boolean);
  detail('baseRent', 'Loyer de base hors charges', monthly);
  detail('referenceRent', 'Loyer de référence majoré', monthly);
  let rentSupplement = finite(details.rentSupplement) && details.rentSupplement > 0 ? details.rentSupplement : undefined;
  if (!finite(rentSupplement) && details.rentControlled === true
      && finite(details.referenceRent) && details.referenceRent > 0
      && finite(excludingCharges) && excludingCharges > details.referenceRent) {
    rentSupplement = Math.round((excludingCharges - details.referenceRent) * 100) / 100;
  }
  if (finite(rentSupplement) && rentSupplement > 0) {
    add('rentSupplement', 'Complément de loyer', monthly(rentSupplement));
  }

  const handled = new Set(['baseRent', 'referenceRent', 'rentSupplement', 'rentCharges', 'chargeTerms',
    'deposit', 'rentalFees', 'inventoryFees', 'rentControlled']);
  if (chargesIncluded && finite(item.price)) handled.add('rentChargesIncluded');
  const annualFormats = { annualRent: annual, annualCharges: annual,
    annualRentPerSquareMeter: annualArea, annualChargesPerSquareMeter: annualArea,
    coOwnershipAnnualCharges: annual };
  for (const [key, row] of knownRows) {
    if (!handled.has(key)) add(key, row.label, annualFormats[key] ? annualFormats[key](details[key]) : row.value);
  }
  const rentalNotes = [];
  const chargeTerms = enumValue(CHARGE_TERMS)(details.chargeTerms);
  if (chargeTerms) rentalNotes.push(`Charges : ${chargeTerms}.`);
  if (finite(details.inventoryFees) && finite(details.rentalFees) && details.inventoryFees <= details.rentalFees) {
    rentalNotes.push('La part état des lieux est comprise dans les honoraires locataire.');
  }
  if (text(details.financialConditions)) rentalNotes.push(text(details.financialConditions));
  return { rentalRows, rentalNotes };
}

const ENERGY_LEGAL_PATTERNS = [
  /^Classe énergie\s*:/,
  /^Classe GES\s*:/,
  /^Consommation d’énergie primaire\s*:/,
  /^Émissions de gaz à effet de serre\s*:/,
  /^Date de réalisation du DPE\s*:/,
  /^Version du DPE\s*:/,
  /^Estimation (?:basse|haute|annuelle) des dépenses énergétiques annuelles/,
  /^Date de référence des prix de l’énergie\s*:/,
];

function stripRedundantLegalLines(rawText, view) {
  return text(rawText).split('\n').filter(rawLine => {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1).trim() : rawLine.trim();
    if (!line || line.includes('0000-00-00')) return false;
    if (view.energy.visible && ENERGY_LEGAL_PATTERNS.some(pattern => pattern.test(line))) return false;
    return true;
  }).join('\n');
}

function rentalLegalTextFor(item, details, view) {
  const baseText = stripRedundantLegalLines(view.legalText, view);
  if (item.source !== 'hektor' || view.transaction !== 'rent') return baseText;
  const yesNo = value => value === true ? 'oui' : value === false ? 'non' : '';
  const count = value => Number.isSafeInteger(value) && value >= 0 ? String(value) : '';
  const definitions = [
    ['rentalFees', 'Honoraires TTC à la charge du locataire', legalMoney],
    ['inventoryFees', 'Dont honoraires TTC pour l’état des lieux', legalMoney],
    ['rentCharges', 'Montant des charges locataire transmis', legalMoney],
    ['rentChargesIncluded', 'Loyer charges comprises', yesNo],
    ['rentExcludingTax', 'Loyer hors taxes', yesNo],
    ['baseRent', 'Loyer de base hors charges', legalMoney],
    ['referenceRent', 'Loyer de référence majoré', legalMoney],
    ['rentSupplement', 'Complément de loyer', legalMoney],
    ['rentControlled', 'Soumis à l’encadrement des loyers', yesNo],
    ['deposit', 'Dépôt de garantie', legalMoney],
    ['annualRent', 'Loyer annuel global', legalMoney],
    ['annualCharges', 'Charges annuelles globales', legalMoney],
    ['annualRentPerSquareMeter', 'Loyer annuel au m²', legalMoney],
    ['annualChargesPerSquareMeter', 'Charges annuelles au m²', legalMoney],
    ['monthlyChargesExcludingTax', 'Charges mensuelles hors taxes', yesNo],
    ['annualRentChargesIncluded', 'Loyer annuel charges comprises', yesNo],
    ['annualRentExcludingTax', 'Loyer annuel hors taxes', yesNo],
    ['annualChargesExcludingTax', 'Charges annuelles hors taxes', yesNo],
    ['annualRentPerSquareMeterChargesIncluded', 'Loyer annuel au m² charges comprises', yesNo],
    ['annualRentPerSquareMeterExcludingTax', 'Loyer annuel au m² hors taxes', yesNo],
    ['annualChargesPerSquareMeterExcludingTax', 'Charges annuelles au m² hors taxes', yesNo],
    ['coOwnership', 'Bien en copropriété', yesNo],
    ['coOwnershipLots', 'Nombre de lots de copropriété', count],
    ['coOwnershipAnnualCharges', 'Quote-part annuelle du budget prévisionnel de copropriété', legalMoney],
    ['coOwnershipProcedure', 'Syndicat des copropriétaires en procédure', yesNo],
    ['coOwnershipProcedureDetails', 'Détails de la procédure', text],
  ];
  const shown = new Set(view.rentalRows.map(row => row._id.replace(/^rental-/, '')));
  if (details.rentChargesIncluded === true && view.rentalRows.some(row =>
    row._id === 'rental-totalRent' && row.label === 'Loyer charges comprises')) shown.add('rentChargesIncluded');
  const repeated = new Set();
  const remember = (label, value) => { if (value !== '') repeated.add(`${label} : ${value}.`); };
  for (const [key, label, format] of definitions) {
    if (shown.has(key)) remember(label, format(details[key]));
  }
  const chargeTerms = enumValue(CHARGE_TERMS)(details.chargeTerms);
  if (chargeTerms && view.rentalNotes.includes(`Charges : ${chargeTerms}.`)) {
    remember('Modalités des charges locataire', chargeTerms.charAt(0).toLowerCase() + chargeTerms.slice(1));
  }
  if (view.comfort.some(row => row._id === 'fact-furnished' && row.value === boolean(details.furnished))) {
    remember('Meublé', yesNo(details.furnished));
  }
  if (view.feeScheduleUrl && url(details.feeScheduleUrl, ['http:', 'https:']) === view.feeScheduleUrl) {
    remember('Barème des honoraires', details.feeScheduleUrl);
  }
  if (text(details.financialConditions) && view.rentalNotes.includes(text(details.financialConditions))) {
    remember('Conditions financières', details.financialConditions);
  }
  return baseText.split('\n').filter(line => !repeated.has(line.trim())).join('\n');
}

function buildListingView(input) {
  const item = object(input);
  const details = object(item.publicDetails);
  const variant = variantFor(item, details);
  const garage = variant === 'garage';
  const transaction = ['sale', 'rent'].includes(item.transaction) ? item.transaction : '';
  const soldListing = ['site-public', 'hektor'].includes(item.source) && details.commercialStatus === 'sold' && transaction === 'sale';
  const propertyTypeLabel = text(item.propertyTypeLabel) || (garage ? 'Garage / parking' : enumValue(TYPE_LABELS)(item.propertyType));
  const isResidentialRental = transaction === 'rent' && !garage && ['maison', 'appartement'].includes(item.propertyType);
  const boutinArea = finite(details.boutinArea) && details.boutinArea > 0
    ? details.boutinArea : (isResidentialRental && finite(item.area) && item.area > 0 ? item.area : undefined);
  // La vue écrite par l'agence (« Sur jardins ») remplace la ligne oui/non « Vue dégagée ».
  const source = { ...details, area: item.area, boutinArea, rooms: item.rooms, bedrooms: item.bedrooms, propertyTypeLabel,
    ...(text(details.view) ? { clearView: undefined } : {}) };
  const applicable = definitions => garage ? definitions.filter(([key]) => GARAGE_KEYS.has(key)) : definitions;
  const surfaces = rows(source, applicable(SURFACES));
  const layout = rows(source, applicable(LAYOUT));
  const comfort = rows(source, applicable(COMFORT));
  const energy = energyFor(item, details);
  const financial = financialFor(details, transaction, garage, soldListing);
  const view = {
    title: text(item.title), city: cityLabel(item),
    priceLabel: soldListing ? 'Vendu' : text(item.priceLabel),
    description: text(item.description), reference: text(item.reference),
    legalText: text(item.legalText),
    variant, transaction, propertyTypeLabel,
    transactionTypeLabel: soldListing ? ['Vendu', propertyTypeLabel].filter(Boolean).join(' — ')
      : [transaction === 'sale' ? 'À vendre' : transaction === 'rent' ? 'À louer' : '', propertyTypeLabel].filter(Boolean).join(' · '),
    gallery: galleryFor(item), ...metricsFor(source, garage), surfaces, layout, comfort,
    energy, ...financial,
    ...rentalFor(item, details, transaction, financial.financialRows),
  };
  view.cleanSaleLegalText = stripRedundantLegalLines(view.legalText, view);
  view.rentalLegalText = rentalLegalTextFor(item, details, view);
  view.visibility = Object.fromEntries(['title', 'city', 'priceLabel', 'transactionTypeLabel', 'description',
    'reference', 'legalText', 'gallery', 'heroMetrics', 'quickFacts', 'surfaces', 'layout', 'comfort',
    'financialRows', 'financialNotes', 'rentalRows', 'rentalNotes', 'feesShort', 'feeScheduleUrl']
    .map(key => [key, Boolean(view[key].length)]));
  Object.assign(view.visibility, {
    details: Boolean(surfaces.length || layout.length || comfort.length), energy: view.energy.visible,
    dpe: view.energy.dpe.visible, ges: view.energy.ges.visible, energyScale: view.energy.dpe.showScale,
    gesScale: view.energy.ges.showScale, energyEstimate: Boolean(view.energy.annualRange),
    energyDate: Boolean(view.energy.date), energyReference: Boolean(view.energy.reference),
    financial: !soldListing && Boolean(view.financialRows.length || view.financialNotes.length || view.feeScheduleUrl || view.feesShort),
    rental: transaction === 'rent' && Boolean(view.rentalRows.length || view.rentalNotes.length || view.feeScheduleUrl),
    // Un bien vendu n'est plus à proposer : pas de bouton « Appeler l'agence ».
    callButton: !soldListing,
  });
  view.visibility.energyFinance = view.visibility.energy || view.visibility.financial || view.visibility.rental;
  view.familySection = familySectionFor(item, view.feeScheduleUrl);
  return view;
}

// Sections par famille de bien. L'import écrit dans le CMS des textes « Fiche · » prêts à afficher ; la page les
// pose tels quels dans les calques que Nicolas nomme type + Famille + Information (#textLogementMentions…).
const RENTAL_LINES = [
  ['loyer', 'Loyer', 'ficheLoyer'],
  ['charges', 'Charges', 'ficheCharges'],
  ['depot', 'Dépôt de garantie', 'ficheDepot'],
  ['honoraires', 'Honoraires', 'ficheHonorairesLocataire'],
  ['encadrement', 'Encadrement des loyers', 'ficheEncadrement'],
  ['copropriete', 'Copropriété', 'ficheCopropriete'],
];
const SALE_LINES = [
  ['honoraires', 'Honoraires', 'ficheHonorairesVente'],
  ['taxeFonciere', 'Taxe foncière', 'ficheTaxeFonciere'],
  ['copropriete', 'Copropriété', 'ficheCopropriete'],
];
// Ce que chaque section contient dans l'éditeur (calques nommés par Nicolas) :
// diagnostic : les textes du DPE ; 'repliable' quand ses boîtes sont nommées pour se replier (biens sans DPE, sans GES, sans dépense) ;
// lines : les lignes du répéteur ; lineLabel : la ligne modèle a un texte de libellé ; card : carte nommée, repliée sans ligne ;
// mentions, bareme : la section a le texte des mentions et le bouton du barème.
const FAMILY_SECTIONS = {
  logement: { name: 'Logement', diagnostic: 'fixe', lines: RENTAL_LINES, lineLabel: true, mentions: true, bareme: true },
  stationnement: { name: 'Stationnement', lines: RENTAL_LINES, lineLabel: true },
  professionnel: { name: 'Professionnel', lines: RENTAL_LINES, lineLabel: true },
  vendu: { name: 'Vendu', diagnostic: 'repliable', lines: [SALE_LINES[2]], lineLabel: false, card: 'Copropriete' },
  vente: { name: 'Vente', diagnostic: 'repliable', lines: SALE_LINES, lineLabel: true, mentions: true, bareme: true },
};
const familyLayer = (name, type, information) => `#${type}${name}${information}`;
const familyRepeater = ({ name, lineLabel }) => ({ id: `#repeater${name}Lignes`,
  label: lineLabel ? familyLayer(name, 'text', 'LigneLibelle') : '', value: familyLayer(name, 'text', 'LigneValeur') });

function familySectionFor(item, feeScheduleUrl) {
  const config = FAMILY_SECTIONS[text(item.ficheFamille)];
  if (!config) return null;
  const { name } = config;
  const field = key => text(item[key]);
  const layer = (type, information) => familyLayer(name, type, information);
  // texts : un texte dynamique reçoit sa valeur et se replie quand elle est vide.
  // shown : une boîte nommée se replie avec la valeur qu'elle porte.
  const texts = config.mentions ? [[layer('text', 'Mentions'), field('ficheMentions')]] : [];
  const shown = [];
  if (config.diagnostic) {
    texts.push([layer('text', 'ClasseEnergie'), field('ficheClasseEnergie')], [layer('text', 'Consommation'), field('ficheConsommation')],
      [layer('text', 'ClasseGes'), field('ficheClasseGes')], [layer('text', 'Emissions'), field('ficheEmissions')],
      [layer('text', 'DepenseEnergie'), field('ficheDepenseEnergie')]);
  }
  if (config.diagnostic === 'repliable') {
    shown.push([layer('box', 'Diagnostic'), Boolean(field('ficheClasseEnergie'))], [layer('box', 'ClasseGes'), Boolean(field('ficheClasseGes'))],
      [layer('box', 'DepenseEnergie'), Boolean(field('ficheDepenseEnergie'))]);
  }
  const rows = config.lines.map(([key, label, source]) => ({ _id: `ligne-${key}`, label, value: field(source) }))
    .filter(row => row.value);
  if (config.card) shown.push([layer('box', config.card), rows.length > 0]);
  const feeUrl = config.bareme ? safeWebUrl(feeScheduleUrl) : '';
  return { config, texts, shown, rows, feeUrl, filled: Boolean(texts.some(([, value]) => value) || rows.length || feeUrl) };
}

const BATHROOM_ICON = "\r\n<svg preserveAspectRatio=\"xMidYMid meet\" data-bbox=\"100 -860 760 760\" width=\"24\" viewBox=\"100 -860 760 760\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\" data-type=\"color\" role=\"presentation\" aria-hidden=\"true\" aria-label=\"\">\n    <g>\n        <path d=\"M385.23-254.77q10.15-10.15 10.15-25.23t-10.15-25.23T360-315.38t-25.23 10.15T324.62-280t10.15 25.23T360-244.62t25.23-10.15m120 0q10.15-10.15 10.15-25.23t-10.15-25.23T480-315.38t-25.23 10.15T444.62-280t10.15 25.23T480-244.62t25.23-10.15m120 0q10.15-10.15 10.15-25.23t-10.15-25.23T600-315.38t-25.23 10.15T564.62-280t10.15 25.23T600-244.62t25.23-10.15m-240-120q10.15-10.15 10.15-25.23t-10.15-25.23T360-435.38t-25.23 10.15T324.62-400t10.15 25.23T360-364.62t25.23-10.15m120 0q10.15-10.15 10.15-25.23t-10.15-25.23T480-435.38t-25.23 10.15T444.62-400t10.15 25.23T480-364.62t25.23-10.15m120 0q10.15-10.15 10.15-25.23t-10.15-25.23T600-435.38t-25.23 10.15T564.62-400t10.15 25.23T600-364.62t25.23-10.15M292.31-492.31h375.38V-520q0-77.61-55.04-132.65T480-707.69t-132.65 55.04T292.31-520zM342-540q8-51 46.5-85.5T480-660t91.5 34.5T618-540zM172.31-100Q142-100 121-121t-21-51.31v-615.38Q100-818 121-839t51.31-21h615.38Q818-860 839-839t21 51.31v615.38Q860-142 839-121t-51.31 21zm0-60h615.38q4.62 0 8.46-3.85 3.85-3.84 3.85-8.46v-615.38q0-4.62-3.85-8.46-3.84-3.85-8.46-3.85H172.31q-4.62 0-8.46 3.85-3.85 3.84-3.85 8.46v615.38q0 4.62 3.85 8.46 3.84 3.85 8.46 3.85M160-160v-640z\" fill=\"#B4361A\" data-color=\"1\"></path>\n    </g>\n</svg>\n";

const DESIGN_METRIC_ICONS = Object.freeze({
  "area": "\r\n<svg preserveAspectRatio=\"xMidYMid meet\" data-bbox=\"220 -740 520 520\" width=\"24\" viewBox=\"220 -740 520 520\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\" data-type=\"color\" role=\"presentation\" aria-hidden=\"true\" aria-label=\"\">\n    <g>\n        <path d=\"M220-220v-220h60v160h160v60zm460-300v-160H520v-60h220v220z\" fill=\"#B4361A\" data-color=\"1\"></path>\n    </g>\n</svg>\n",
  "rooms": "\r\n<svg preserveAspectRatio=\"xMidYMid meet\" data-bbox=\"140 -820 680 680\" width=\"24\" viewBox=\"140 -820 680 680\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\" data-type=\"color\" role=\"presentation\" aria-hidden=\"true\" aria-label=\"\">\n    <g>\n        <path d=\"M530-600v-220h290v220zM140-460v-360h290v360zm390 320v-360h290v360zm-390 0v-220h290v220zm60-380h170v-240H200zm390 320h170v-240H590zm0-460h170v-100H590zM200-200h170v-100H200zm170-100\" fill=\"#B4361A\" data-color=\"1\"></path>\n    </g>\n</svg>\n",
  "bedrooms": "\r\n<svg preserveAspectRatio=\"xMidYMid meet\" data-bbox=\"100 -720 760 500\" width=\"24\" viewBox=\"100 -720 760 500\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\" data-type=\"color\" role=\"presentation\" aria-hidden=\"true\" aria-label=\"\">\n    <g>\n        <path d=\"M100-220v-220q0-22.38 10.62-43.42Q121.23-504.46 140-518v-102q0-41.92 29.04-70.96T240-720h170q21.85 0 39.15 8.5Q466.46-703 480-688q13.54-15 30.85-23.5 17.3-8.5 39.15-8.5h170q41.92 0 70.96 29.04T820-620v102q18.77 13.54 29.38 34.58Q860-462.38 860-440v220h-60v-80H160v80zm410-320h250v-80q0-17-11.5-28.5T720-660H550q-17 0-28.5 11.5T510-620zm-310 0h250v-80q0-17-11.5-28.5T410-660H240q-17 0-28.5 11.5T200-620zm-40 180h640v-80q0-17-11.5-28.5T760-480H200q-17 0-28.5 11.5T160-440zm640 0H160z\" fill=\"#B4361A\" data-color=\"1\"></path>\n    </g>\n</svg>\n",
  "terraceArea": "\r\n<svg preserveAspectRatio=\"xMidYMid meet\" data-bbox=\"140 -860 680 760\" width=\"24\" viewBox=\"140 -860 680 760\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\" data-type=\"color\" role=\"presentation\" aria-hidden=\"true\" aria-label=\"\">\n    <g>\n        <path d=\"M324.62-484.62v-70.76h70.76v70.76zm240 0v-70.76h70.76v70.76zM140-100v-291.54h40V-560q0-62.15 23.46-116.81 23.46-54.65 64.28-95.46 40.81-40.82 95.69-64.27Q418.31-860 480.23-860t116.58 23.46q54.65 23.46 95.46 64.27t64.27 95.46Q780-622.15 780-560v168.46h40V-100zm60-60h90v-171.54h-90zm150 0h100v-171.54H350zM240-391.54h210v-406.23q-85.61 9.38-147.81 75.88Q240-655.39 240-560zm270 0h210V-560q0-95.39-62.19-161.89-62.2-66.5-147.81-75.88zM510-160h100v-171.54H510zm160 0h90v-171.54h-90z\" fill=\"#B4361A\" data-color=\"1\"></path>\n    </g>\n</svg>\n",
  "bathrooms": BATHROOM_ICON,
  "showerRooms": BATHROOM_ICON,
  "floor": "<svg fill=\"#B4361A\" xmlns=\"http://www.w3.org/2000/svg\" height=\"24\" viewBox=\"0 -960 960 960\" width=\"24\"><path d=\"M250-250h157v-133h103v-133h103v-134h97v-60H553v133H450v133H347v134h-97v60Zm-37.69 110Q182-140 161-161q-21-21-21-51.31v-535.38Q140-778 161-799q21-21 51.31-21h535.38Q778-820 799-799q21 21 21 51.31v535.38Q820-182 799-161q-21 21-51.31 21H212.31Zm0-60h535.38q4.62 0 8.46-3.85 3.85-3.84 3.85-8.46v-535.38q0-4.62-3.85-8.46-3.84-3.85-8.46-3.85H212.31q-4.62 0-8.46 3.85-3.85 3.84-3.85 8.46v535.38q0 4.62 3.85 8.46 3.84 3.85 8.46 3.85ZM200-760v560-560Z\"/></svg>"
});

const REPEATERS = [
  { id: '#repeater1', key: 'heroMetrics', value: '#text15', icon: '#vectorImage2' },
  { id: '#repeater2', key: 'quickFacts', label: '#text28', value: '#text20', icon: '#vectorImage3' },
  { id: '#repeater3', key: 'surfaces', label: '#text29', value: '#text30', heading: '#text31' },
  { id: '#repeater4', key: 'layout', label: '#text34', value: '#text33', heading: '#text32' },
  { id: '#repeater5', key: 'comfort', label: '#text37', value: '#text36', heading: '#text35' },
];

$w.onReady(() => {
  for (const config of [...REPEATERS, ...Object.values(FAMILY_SECTIONS).map(familyRepeater)]) {
    const rep = $w(config.id);
    if (rep && typeof rep.onItemReady === 'function') {
      rep.onItemReady(($item, row) => renderRepeaterRow($item, row, config));
    }
  }
  const moreLink = $w('#text17');
  if (moreLink && 'html' in moreLink) {
    moreLink.html = '<p>Voir toutes les caractéristiques ↓</p>';
    if (typeof moreLink.onClick === 'function') {
      moreLink.onClick(() => {
        const target = $w('#section7');
        if (target && typeof target.scrollTo === 'function') target.scrollTo();
      });
    }
  }
  const dataset = $w('#dynamicDataset');
  let sequence = Promise.resolve();
  const queue = item => {
    sequence = sequence.then(() => renderListingView(buildListingView(item))).catch(error => {
      console.error('[Albret/Biens] Rendu de la fiche impossible :', error?.message || String(error));
    });
    return sequence;
  };
  queue({});
  dataset.onReady(() => queue(dataset.getCurrentItem() || {}));
  dataset.onCurrentIndexChanged(() => queue(dataset.getCurrentItem() || {}));
  dataset.onError(() => queue({}));
});

function renderRepeaterRow($item, row, config) {
  if (!row || typeof row.value !== 'string') return;
  if (config.label) {
    const labelEl = $item(config.label);
    if (labelEl) labelEl.text = typeof row.label === 'string' ? row.label : '';
  }
  const valEl = $item(config.value);
  if (valEl) valEl.text = row.value;
  if (config.icon) {
    const icon = $item(config.icon);
    const source = DESIGN_METRIC_ICONS[String(row._id || '').replace(/^(?:hero|metric)-/, '')];
    if (icon && source) {
      icon.src = source;
      if (typeof icon.expand === 'function') icon.expand();
    } else if (icon && typeof icon.collapse === 'function') {
      icon.collapse();
    }
  }
}

async function renderListingView(view) {
  const changes = [];
  const visible = (id, show) => changes.push(setDisplayed(id, Boolean(show)));
  const setText = (id, value) => {
    const el = $w(id);
    if (el) el.text = typeof value === 'string' ? value : '';
    visible(id, Boolean(value));
  };
  setText('#text10', view.title);
  setText('#text12', view.city);
  setText('#text84', view.reference ? `Réf : ${view.reference}` : '');
  setText('#text13', view.priceLabel);
  setText('#text11', view.transactionTypeLabel);
  setText('#text14', view.feesShort);
  visible('#button5', view.visibility.callButton);
  setText('#text16', view.description);
  const gallery = $w('#gallery2');
  if (gallery) gallery.items = view.gallery;
  visible('#gallery2', view.gallery.length > 0);
  visible('#line1', view.gallery.length > 0);

  const fillRepeater = (config, rows) => {
    const byId = new Map(rows.map(row => [row._id, row]));
    const rep = $w(config.id);
    if (rep) {
      rep.data = rows;
      if (typeof rep.forEachItem === 'function') {
        rep.forEachItem(($item, row) => {
          const fresh = byId.get(row?._id);
          if (fresh) renderRepeaterRow($item, fresh, config);
        });
      }
    }
    visible(config.id, rows.length > 0);
    if (config.heading) visible(config.heading, rows.length > 0);
  };
  for (const config of REPEATERS) fillRepeater(config, view[config.key]);
  const hasCharacteristics = ['quickFacts', 'surfaces', 'layout', 'comfort']
    .some(key => view[key].length > 0);
  visible('#box24', hasCharacteristics);
  visible('#section7', hasCharacteristics);
  visible('#text17', hasCharacteristics);
  visible('#box19', Boolean(view.title || view.description || view.gallery.length || view.priceLabel));
  visible('#section6', Boolean(view.title || view.description || view.gallery.length || view.priceLabel));

  // Sections par famille : celle du bien se remplit puis se déplie en dernier ; les autres restent repliées.
  const family = view.familySection;
  for (const config of Object.values(FAMILY_SECTIONS)) {
    const current = family && family.config === config ? family : null;
    if (current) {
      for (const [id, value] of current.texts) setText(id, value);
      for (const [id, show] of current.shown) visible(id, show);
      fillRepeater(familyRepeater(config), current.rows);
      if (config.bareme) {
        const feeButton = familyLayer(config.name, 'button', 'Bareme');
        const button = $w(feeButton);
        if (button && current.feeUrl) {
          button.link = current.feeUrl;
          button.target = '_blank';
        }
        visible(feeButton, Boolean(current.feeUrl));
      }
    }
    visible(`#section${config.name}`, Boolean(current && current.filled));
  }
  await Promise.all(changes);
}

function setDisplayed(id, displayed) {
  const el = $w(id);
  if (!el) return Promise.resolve();
  if (displayed && typeof el.expand === 'function') return el.expand();
  if (!displayed && typeof el.collapse === 'function') return el.collapse();
  if (displayed && typeof el.show === 'function') return el.show();
  if (!displayed && typeof el.hide === 'function') return el.hide();
  return Promise.resolve();
}

function safeWebUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
