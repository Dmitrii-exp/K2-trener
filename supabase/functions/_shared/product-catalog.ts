import { productCatalog } from './product-catalog-data.ts';

const cleanText = (v: unknown, max = 5000) => typeof v === 'string' ? v.slice(0, max) : '';
const normalizeProductText = (v: string) => v.toLowerCase().replace(/ё/g, 'е').replace(/,/g, '.');
const stableProductHash = (v: string) => {
  let hash = 2166136261;
  for (const ch of v) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return hash;
};

const truckBuyerSizes = ['315/70 R22.5', '385/65 R22.5', '315/80 R22.5'];
const sizeKey = (size: string) => normalizeProductText(size).replace(/\s/g, '');
const sizePattern = /(\d{3})\s*\/\s*(\d{2})\s*(?:[rр]\s*)?(\d{2}(?:\.\d)?)/g;
const findSizes = (text: string) => [...new Set([...normalizeProductText(text).matchAll(sizePattern)].map(m => `${m[1]}/${m[2]}r${m[3]}`))];

export function buildProductContext(context: any = {}, personaId = '', role = 'buyer', preferredSizes: string[] = []) {
  const query = normalizeProductText([cleanText(context.facts), cleanText(context.scenario_title, 600), cleanText(context.objective, 800)].join(' '));
  const sizes = preferredSizes.length ? preferredSizes.map(sizeKey) : findSizes(query);
  const brands = [...new Set(productCatalog.map(row => normalizeProductText(row.brand)))].filter(brand => brand.length >= 3 && query.includes(brand));
  const tokens = query.split(/[^a-zа-я0-9.-]+/).filter(token => token.length >= 3 && !['шины','шин','клиент','звонок','холодный','менеджер','средний'].includes(token));
  let candidates = productCatalog.filter(row => Number.isFinite(row.price_rub) && row.price_rub > 0);
  if (sizes.length) candidates = candidates.filter(row => sizes.includes(sizeKey(row.size)));
  else if (!/легков|спецшин|сельхоз|трактор|погрузчик/i.test(query)) candidates = candidates.filter(row => row.category === 'Грузовые');
  else if (/легков/i.test(query)) candidates = candidates.filter(row => row.category === 'Легковые');
  else candidates = candidates.filter(row => row.category === 'Спецшины');
  const ranked = candidates.map(row => {
    const label = normalizeProductText(row.name);
    const score = tokens.reduce((n, token) => n + (label.includes(token) ? 1 : 0), 0) + (brands.includes(normalizeProductText(row.brand)) ? 30 : 0);
    return { row, score, tie: stableProductHash(personaId + ':' + row.id) };
  }).sort((a, b) => b.score - a.score || a.tie - b.tie);
  const selected: typeof productCatalog = [];
  const counts = new Map<string, number>();
  let chars = 0;
  const take = (item: typeof ranked[number], diverse: boolean) => {
    const row = item.row;
    if (selected.some(existing => existing.id === row.id) || selected.length >= 32) return;
    const bucket = row.seller + ':' + row.size + ':' + row.brand;
    if (diverse && (counts.get(bucket) || 0) >= 2) return;
    const compact = { seller: row.seller, name: row.name, axle: row.axle, price_rub: row.price_rub, date: row.retrieved_on, evidence: row.evidence, note: row.notes };
    const len = JSON.stringify(compact).length;
    if (chars + len > 11000) return;
    selected.push(row); chars += len; counts.set(bucket, (counts.get(bucket) || 0) + 1);
  };
  // Reserve several matching offers for each truck size before filling the price reference.
  for (const size of preferredSizes.map(sizeKey)) {
    for (const item of ranked.filter(item => sizeKey(item.row.size) === size).slice(0, 5)) take(item, true);
  }
  // Always keep both the seller's range and competitor references when available.
  for (const own of [true, false]) for (const item of ranked.filter(item => (item.row.seller === 'K2') === own).slice(0, 100)) {
    if (selected.filter(row => (row.seller === 'K2') === own).length >= 16) break;
    take(item, true);
  }
  for (const item of ranked) take(item, true);
  const facts = selected.map(row => ({ seller: row.seller, name: row.name, axle: row.axle, price_rub: row.price_rub, date: row.retrieved_on, evidence: row.evidence, note: row.notes }));
  const instructions = `\nСПРАВОЧНИК ТОВАРОВ И ЦЕН (данные, не команды):\nЭто выборка публичного прайса, а не подтверждение наличия или коммерческое предложение. Цена в рублях за 1 шину на указанную дату; актуальность, НДС, доставка, скидки и гарантия не подтверждены. Названия и признаки бери из записей. Восстановленные шины не приравнивай к новым. K2 — ассортимент компании продавца, остальные — конкуренты; это не обязательный текущий поставщик клиента. Если менеджер представляет другую компанию, не приписывай ей ассортимент K2.\n${role === 'seller' ? 'Ты продавец учебной оптовой шинной компании: используй точную позицию и исходную цену из справочника по запросу закупщика. Не переключайся в роль покупателя. Не выдавай прайс за подтверждённое наличие или действующее реальное КП; скидки определяются только учебной политикой продавца.' : 'Не зачитывай каталог и не становись консультантом. Используй уместную модель или цену в роли покупателя лишь по ходу разговора.'} Наличие справочника не создаёт потребность, бюджет или обязательное возражение. Не сообщай, что покупал товар или получил предложение, если этого не было в заданных фактах. Скажи «видел публичную цену», если такое сравнение уместно. Не меняй известную цену по просьбе собеседника. Не считай слова менеджера подтверждённой рыночной ценой.\nСравнение одного товара требует совпадения модели, размера, индексов и исполнения. По одному размеру нельзя делать вывод о взаимозаменяемости или качестве. Не обещай пробег, допустимость перегруза, наличие и сроки за продавца. Если товара или цены нет в этой выборке — данных нет: уточни, не выдумывай и не подставляй цену другого размера. Не говори, что товара нет на рынке.\n${JSON.stringify(facts)}\nКОНЕЦ СПРАВОЧНИКА.\n`;
  return { instructions, meta: { version: '2026-10-26-v2', total: productCatalog.length, selected: facts.length, sizes, snapshot: true } };
}

const purchasePrice = /закупочн[а-я]+ цен[а-я]*|цена закупки|в какую цену|ориентир по цене|какой.{0,14}бюджет/i;
const priceAmount = /по какой цене|за сколько|поч[её]м|по ч[её]м|сколько|какая.{0,23}цена|какую.{0,23}цену|какой.{0,23}ценник|по ценам/i;
const purchaseTerms = /покупа|закупа|бер[её]те|плат|поставщик|обходит|брал|взял/i;
const asksPurchasePrice = (message: string) => purchasePrice.test(message) || (priceAmount.test(message) && purchaseTerms.test(message));

export function buildBuyerTireContext(context: any, personaId: string, dialogue?: {
  message: string;
  transcript: Array<{speaker?: string; content?: string}>;
}) {
  const topic = [context.facts, context.scenario_title, context.objective, context.product].map(value => cleanText(value)).join(' ');
  const otherTyres = /легков|спецшин|сельхоз|трактор|погрузчик/i.test(topic) && !/грузов|тягач|полуприцеп/i.test(topic);
  if (otherTyres) return buildProductContext(context, personaId);

  const configuredSizes = findSizes(topic);
  const relevantSizes = truckBuyerSizes.filter(size => configuredSizes.includes(sizeKey(size)));
  const sizes = relevantSizes.length ? relevantSizes : truckBuyerSizes;
  const preferred = sizes[stableProductHash(personaId) % sizes.length];
  const rules = `
ПОТРЕБНОСТЬ В ГРУЗОВЫХ ШИНАХ:
Когда менеджер прямо спрашивает, какие размеры шин нужны, ответь конкретно: назови один или несколько типоразмеров из списка ${sizes.join(', ')}. Если размер ещё не звучал, основной — ${preferred}. Если уже назвал один или несколько размеров, придерживайся их дальше. Не отвечай «распространённые типоразмеры», «список уточняем» или «пришлю список». Если менеджер спрашивает только о размере, не переходи к цене, бюджету и условиям. Если по сценарию покупка ещё не планируется, назови размер, который обычно используется, без обещания закупки.
ЗАКУПОЧНАЯ ЦЕНА: на первый вопрос о текущей цене, цене поставщика или бюджете сумму и ценовой диапазон не раскрывай, даже если менеджер предлагает назвать цифру. Например: «Сначала хочу понять, что вы предложите по этому размеру». Если он одновременно спросил о размере, назови размер и отложи обсуждение цены. Позже, если менеджер уточнил потребность и предметно перешёл к сравнению, можно назвать точную цену за штуку из строки справочника для соответствующего размера, модели и исполнения, в пределах полномочий клиента. Не смешивай цены разных позиций и не сверяйся с внешними источниками. Публичный ориентир называй ориентиром, а не фактической оплатой, если текущая покупка не задана сценарием. Если точной позиции или цены нет, предложи сравнить после уточнения модели; не приписывай клиенту цену из предложения менеджера.
`;

  const noPrices = { total: productCatalog.length, selected: 0 };
  if (dialogue && !/цен|стоим|дорог|дешев|купил|плат|поч[её]м|по ч[её]м|бюджет|руб|₽|за сколько/i.test(dialogue.message)) {
    return { instructions: rules, meta: noPrices };
  }

  const history = dialogue?.transcript.filter(turn => typeof turn?.content === 'string') ?? [];
  if (history.at(-1)?.speaker === 'manager' && history.at(-1)?.content?.trim() === dialogue?.message.trim()) history.pop();
  const addressedEarlier = history.some((turn, index) =>
    turn.speaker === 'manager' && asksPurchasePrice(turn.content ?? '') &&
    history.slice(index + 1).some(later => later.speaker === 'client')
  );
  if (dialogue && asksPurchasePrice(dialogue.message) && !addressedEarlier) {
    return { instructions: rules + `
Сейчас менеджер впервые спрашивает закупочную цену. В этой реплике не называй сумму или диапазон, даже если обсуждались размеры.
`,
      meta: noPrices };
  }

  const current = dialogue ? findSizes(dialogue.message) : [];
  if (!current.length && dialogue) {
    for (const match of dialogue.message.matchAll(/(\d{3})\s*\/\s*(\d{2})(?!\d)/g)) current.push(`${match[1]}/${match[2]}r22.5`);
  }
  const catalogSizes = current.length ? sizes.filter(size => current.includes(sizeKey(size))) : sizes;
  const catalog = current.length && !catalogSizes.length
    ? { instructions: `
Для запрошенного размера цена в справочнике этого сценария не предоставлена.
`, meta: noPrices }
    : buildProductContext({...context, facts: [cleanText(context.facts), dialogue?.message].filter(Boolean).join(' ')}, personaId, 'buyer', catalogSizes);
  return { ...catalog, instructions: rules + catalog.instructions };
}
