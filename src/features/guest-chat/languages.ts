// ISO 639-1 languages. Flags indicate a representative place where a language
// is spoken; a neutral flag is used for languages without a single home country.
const codes = `aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu`.split(' ');

const countries: Record<string, string> = {
  aa: 'ET', ab: 'GE', ae: 'IR', af: 'ZA', ak: 'GH', am: 'ET', an: 'ES', ar: 'SA', as: 'IN', av: 'RU', ay: 'BO', az: 'AZ',
  ba: 'RU', be: 'BY', bg: 'BG', bh: 'IN', bi: 'VU', bm: 'ML', bn: 'BD', bo: 'CN', br: 'FR', bs: 'BA', ca: 'ES', ce: 'RU',
  ch: 'GU', co: 'FR', cr: 'CA', cs: 'CZ', cu: 'BG', cv: 'RU', cy: 'GB', da: 'DK', de: 'DE', dv: 'MV', dz: 'BT', ee: 'GH',
  el: 'GR', en: 'GB', es: 'ES', et: 'EE', eu: 'ES', fa: 'IR', ff: 'SN', fi: 'FI', fj: 'FJ', fo: 'FO', fr: 'FR', fy: 'NL',
  ga: 'IE', gd: 'GB', gl: 'ES', gn: 'PY', gu: 'IN', gv: 'IM', ha: 'NG', he: 'IL', hi: 'IN', ho: 'PG', hr: 'HR', ht: 'HT',
  hu: 'HU', hy: 'AM', hz: 'NA', id: 'ID', ig: 'NG', ii: 'CN', ik: 'US', is: 'IS', it: 'IT', iu: 'CA', ja: 'JP', jv: 'ID',
  ka: 'GE', kg: 'CD', ki: 'KE', kj: 'AO', kk: 'KZ', kl: 'GL', km: 'KH', kn: 'IN', ko: 'KR', kr: 'NG', ks: 'IN', ku: 'IQ',
  kv: 'RU', kw: 'GB', ky: 'KG', la: 'VA', lb: 'LU', lg: 'UG', li: 'NL', ln: 'CD', lo: 'LA', lt: 'LT', lu: 'CD', lv: 'LV',
  mg: 'MG', mh: 'MH', mi: 'NZ', mk: 'MK', ml: 'IN', mn: 'MN', mr: 'IN', ms: 'MY', mt: 'MT', my: 'MM', na: 'NR',
  nb: 'NO', nd: 'ZW', ne: 'NP', ng: 'NA', nl: 'NL', nn: 'NO', no: 'NO', nr: 'ZA', nv: 'US', ny: 'MW', oc: 'FR',
  oj: 'CA', om: 'ET', or: 'IN', os: 'GE', pa: 'IN', pi: 'IN', pl: 'PL', ps: 'AF', pt: 'PT', qu: 'PE', rm: 'CH',
  rn: 'BI', ro: 'RO', ru: 'RU', rw: 'RW', sa: 'IN', sc: 'IT', sd: 'PK', se: 'NO', sg: 'CF', si: 'LK', sk: 'SK',
  sl: 'SI', sm: 'WS', sn: 'ZW', so: 'SO', sq: 'AL', sr: 'RS', ss: 'SZ', st: 'LS', su: 'ID', sv: 'SE', sw: 'TZ',
  ta: 'IN', te: 'IN', tg: 'TJ', th: 'TH', ti: 'ER', tk: 'TM', tl: 'PH', tn: 'BW', to: 'TO', tr: 'TR', ts: 'ZA',
  tt: 'RU', tw: 'GH', ty: 'PF', ug: 'CN', uk: 'UA', ur: 'PK', uz: 'UZ', ve: 'ZA', vi: 'VN', vo: 'DE', wa: 'BE',
  wo: 'SN', xh: 'ZA', yi: 'IL', yo: 'NG', za: 'CN', zh: 'CN', zu: 'ZA',
};

const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });

export function guestLanguageLabel(code: string): string {
  const country = countries[code];
  const flag = country
    ? [...country].map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('')
    : '🏳️';
  const englishName = displayNames.of(code) ?? code;
  const nativeName = new Intl.DisplayNames([code], { type: 'language' }).of(code);
  return `${flag} ${englishName}${nativeName && nativeName.toLocaleLowerCase() !== englishName.toLocaleLowerCase() ? ` · ${nativeName}` : ''}`;
}

export const guestLanguageOptions = codes
  .map((code) => ({ value: code, label: guestLanguageLabel(code) }))
  .sort((left, right) =>
    (displayNames.of(left.value) ?? left.value).localeCompare(displayNames.of(right.value) ?? right.value));
