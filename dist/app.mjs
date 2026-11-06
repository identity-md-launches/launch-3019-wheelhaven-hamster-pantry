import { SPECIES, IMPROVEMENTS, createGarden, season, expansionCost, needed, ready, plantSeed, waterPlant, harvest, harvestAll, expandPlot, buyImprovement, parseTelemetry, applyTelemetry, restoreGarden, canRescue } from './game.mjs';
import { icon, cropArt, wheelArt, buildingArt } from './art.mjs';
import { createPantryStore } from './store.mjs';

const COPY = {
  zh: {
    brandSub:'仓鼠粮仓 · 一小步，一篮好食材', howTo:'怎么玩', liveNotes:'真实数据', eyebrow:'小小脚步，满满收获',
    title:'把每一小步，<br>种成一篮<span>好食材。</span>', intro:'种下胡萝卜、西兰花和向日葵，等仓鼠跑过下一圈。照料食材田，收获它喜欢的食物，一点点建好你的仓鼠粮仓。', sceneCaption:'一只真实的仓鼠 · 一点点真实的生长',
    chapter:'你的小小食材田 · 01', gardenTitle:'今天，也给粮仓添一篮',
    liveNote:'作物随 Squeektoshi 的真实跑轮步数生长。它休息时，食材田也歇一歇。',
    dew:'露珠', harvests:'已收获', harvestAll:'收获成熟作物', gardenSign:'小小食材，慢慢长大',
    seedTray:'种子盘', chooseSeed:'先选一颗种子', seedHint:'再轻点一块空地，让故事开始。',
    carrot:'胡萝卜', broccoli:'西兰花', sunflower:'向日葵', carrotDesc:'橙色小萝卜，为仓鼠菜篮添一口脆甜。', broccoliDesc:'长成一小棵绿树，收下一朵朵菜花。', sunflowerDesc:'等花盘慢慢饱满，收获一篮葵花籽。',
    seedCost:'{n} 露珠', passages:'{n} 步', yield:'收获 {n}', selected:'已选', select:'选择', locked:'待解锁', libraryRequired:'建成种子屋后解锁',
    season:'本轮偏爱 · {name}', seasonBonus:'现在播种，收获额外 +2 露珠。', seasonUnknown:'等待结算回合，季节加成暂未启用。',
    growHint:'每一个新的有效跑轮步数，让所有已种作物一起生长。',
    saveGarden:'保存与迁移 ↗', rescue:'领一颗应急胡萝卜种子',
    nextChapter:'下一小步', restoreTitle:'让这片小天地，重新发光', goalSummary:'修复三处小建筑，点亮粮仓灯塔。', goalWon:'灯塔已经亮起。继续种植，为粮仓添上新的收获。',
    mill:'小水车', library:'种子屋', beacon:'粮仓灯塔', millDesc:'让每一次收获额外获得 1 露珠。', libraryDesc:'解锁向日葵，为菜篮添一把葵花籽。', beaconDesc:'把所有小小的努力，汇成远处的一束光。',
    build:'修复 · {n} 露珠', built:'已修复', requireHarvests:'需要收获 {n} 次', requireBuildings:'先修复水车和种子屋',
    fieldNotes:'收获笔记', journalTitle:'粮仓里的小事', journalEmpty:'第一颗种子，会是这个故事的开始。',
    journalPlanted:'种下了一颗{name}。', journalHarvested:'收获{name}，得到 {n} 露珠。', journalWatered:'给{name}浇了水。', journalBuilt:'修复了{name}。', journalExpanded:'又开出了一块新食材田。', journalReanchored:'跑轮计数重新定位，已保留植物进度。', journalRescued:'种下了一颗应急胡萝卜。',
    footer:'给仓鼠种食材的 Squeekchain 小游戏。', official:'认识 Squeektoshi ↗', about:'关于作品',
    connecting:'正在听听小轮子的动静…', resting:'Squeektoshi 正在休息', running:'小轮子正在转 · {n} RPM', offline:'暂时听不到小轮子的声音',
    emptyPlot:'空食材田 · 种下{name}', plotLabel:'第 {n} 块食材田', readyLabel:'{name}成熟了 · 点击收获', growingLabel:'{name}生长中 · 还需 {n} 步', expandLabel:'开垦食材田 · {n} 露珠',
    plantAction:'种下{name}', readyTag:'可以收获啦', growingTag:'正在慢慢长大', watered:'已浇水', water:'浇水 · 1 露珠', waterDesc:'一次浇水，所需步数减少 30%。',
    remaining:'还需要 {n} 个有效步数', progress:'已生长 {n} / {total} 步', harvest:'收获 · +{n} 露珠', expandTitle:'给食材田多一点空间', expandDesc:'开垦这块地后，就能同时照料更多作物。', expand:'开垦 · {n} 露珠', close:'关闭',
    planted:'已种下{name}，小小故事开始了。', harvested:'收获了 {count} 株，得到 {n} 露珠。', wateredToast:'水已浇好，需要的步数更少了。', builtToast:'{name}修复好了！', expanded:'新食材田已经准备好。', rescueToast:'应急种子已准备好，请轻点一块空地。',
    notEnoughDew:'露珠还不够，先收获几株作物吧。', plotUnavailable:'这块食材田暂时不能播种。', seedLocked:'先修复种子屋，才能种向日葵。', notReady:'再等几个小小脚步，就可以收获了。', waterUnavailable:'这株作物已经不需要浇水了。', improvementUnavailable:'这座建筑已经修复。', buildFirst:'先把水车和种子屋修好吧。', moreHarvests:'再多收获几次，就能修复它。', needFresh:'正在等待新的有效跑轮数据，作物进度已保留。', rescueUnavailable:'有作物或足够露珠时，无需应急种子。',
    helpTitle:'从一颗种子，到一束光', helpIntro:'这是一个温柔的资源策略小游戏。所有露珠、作物与建筑都属于游戏，没有代币或金钱奖励。',
    step1:'选种子，再点空地', step1Desc:'种胡萝卜、西兰花，或在种子屋修好后种向日葵、收葵花籽。各作物有不同的游戏成本、步数和收益，都写在种子卡上。',
    step2:'让真实脚步推动生长', step2Desc:'所有作物都跟随仓鼠新增的有效跑轮步数一起长大。它休息时，作物暂停生长，进度会保留。浇水可减少所需步数。',
    step3:'收获、修复、点亮灯塔', step3Desc:'用露珠修水车、种子屋和灯塔。水车增加收获，种子屋解锁新作物。灯塔亮起，就是通关。',
    helpSeason:'季节是游戏规则：结算回合号每轮轮换偏爱作物。播种时符合本轮偏爱的作物，收获固定多 2 露珠。它不代表真实天气。', play:'回到食材田',
    evidenceTitle:'每一小步，从哪里来？', evidenceIntro:'粮仓只读取 Squeekchain 官方公开 API，不需要钱包。生长依据是被系统接收的硬件传感器步数，结算回合来自已处理的链上经济状态；两者不是同一阶段。',
    feed:'传感器数据', fresh:'数据新鲜', unavailable:'暂不可用 · 生长已暂停', observed:'观测时间', acceptedWork:'累计有效步数', settledRound:'已处理回合', safeBlock:'确认区块', installation:'安装实例',
    evidenceRules:'接口断线、数据过期或来源无效时，不会增加植物进度。计数下降或设备实例改变时，只重新定位，不把跳变计作新的步数。下一份有效数据到来后继续。', sourceStatus:'打开传感器状态 ↗', sourceEconomy:'打开结算数据 ↗', noSample:'暂未收到有效数据',
    saveTitle:'带上你的粮仓', saveIntro:'进度自动保存在当前浏览器。换设备前可导出 JSON，再在新设备导入。', export:'导出当前粮仓', import:'导入粮仓存档', importHint:'导入将替换当前粮仓；可先导出备份。仅支持真实跑轮驱动的存档，文件只在本地读取，不会上传。', reset:'重新开始当前粮仓', resetTitle:'重新开始这座粮仓？', resetDesc:'这会清除当前粮仓的作物、露珠与建筑。建议先导出存档。', resetConfirm:'清空并重新开始', cancel:'取消',
    importTitle:'把这座粮仓带回来？', importDesc:'将替换当前粮仓。文件含 {n} 次收获、{dew} 露珠。导入后会重新定位跑轮计数，避免把过去的步数重复计算。', importConfirm:'导入并替换', imported:'粮仓已导入。', invalidSave:'存档不符合要求，请使用真实跑轮驱动的存档。原来的粮仓已保留。', resetDone:'新的一颗种子，新的开始。', saveUnavailable:'浏览器存储不可用，请导出存档以保存进度。',
    winTitle:'你把这片小天地点亮了。', winDesc:'灯塔的光来自一颗颗种子、一次次收获，还有一只仓鼠自在的小脚步。食材田会继续生长，慢慢来就很好。', keepGrowing:'继续照料食材田',
    aboutTitle:'一个小粮仓，跟着真实的小脚步', aboutDesc:'Wheelhaven · 仓鼠粮仓是为 Squeekchain 创作的独立种植策略游戏。胡萝卜、西兰花和葵花籽构成仓鼠食材主题；作物、资源、浇水、扩地和建筑形成完整的游戏循环。作物生长由官方传感器报告的真实跑轮步数驱动。', aboutCredit:'作品由 FLau1212 创作，使用 Codex 辅助开发。与 Squeekchain 官方没有隶属关系。源码使用 MIT 许可证。', sourceDownload:'下载完整源码 ↗', noWallet:'无需钱包 · 无下注 · 无金钱奖励', dataNote:'实时传感器进度不是已结算的链上奖励。', lastSaved:'进度自动保存在此浏览器',
  },
  en: {
    brandSub:'Hamster Pantry · Little laps, fresh harvests', howTo:'How to play', liveNotes:'Live evidence', eyebrow:'Little footsteps, fresh harvests',
    title:'Every little lap.<br>A basket of <span>goodness.</span>', intro:'Grow carrots, broccoli and sunflowers for their seeds. Let a real hamster’s little laps grow your crops, and build a pantry one harvest at a time.', sceneCaption:'One real hamster. A little real growth.',
    chapter:'Your little food patch · 01', gardenTitle:'A good day to fill the pantry',
    liveNote:'Crops grow with Squeektoshi’s real accepted wheel passages. When he rests, your crops take a little pause too.',
    dew:'Dew', harvests:'Harvests', harvestAll:'Harvest ready plants', gardenSign:'Good things grow slowly',
    seedTray:'Seed tray', chooseSeed:'Start with a little seed', seedHint:'Then tap an empty patch. Every story starts somewhere.',
    carrot:'Carrot', broccoli:'Broccoli', sunflower:'Sunflower', carrotDesc:'A little orange crunch for the hamster’s basket.', broccoliDesc:'Grow a little green tree. Gather a basket of florets.', sunflowerDesc:'Let the golden head ripen into sunflower seeds.',
    seedCost:'{n} dew', passages:'{n} passages', yield:'Yield {n}', selected:'Selected', select:'Choose', locked:'Locked', libraryRequired:'Restore the seed library to unlock',
    season:'This round loves {name}', seasonBonus:'Plant now for +2 dew at harvest.', seasonUnknown:'Waiting for the settled round. No seasonal bonus yet.',
    growHint:'Each new accepted wheel passage grows every planted crop together.',
    saveGarden:'Save & move pantry ↗', rescue:'Get an emergency carrot seed',
    nextChapter:'The next little chapter', restoreTitle:'Make this little place shine again', goalSummary:'Restore all three buildings. Light your pantry beacon.', goalWon:'The beacon is shining. Stay a little longer. Keep growing.',
    mill:'Little watermill', library:'Seed library', beacon:'Pantry beacon', millDesc:'One extra dew with every harvest. Little things add up.', libraryDesc:'Unlock sunflowers and gather their golden seeds.', beaconDesc:'Turn all those little efforts into a light on the horizon.',
    build:'Restore · {n} dew', built:'Restored', requireHarvests:'Requires {n} harvests', requireBuildings:'Restore the mill and library first',
    fieldNotes:'Harvest notes', journalTitle:'Little pantry stories', journalEmpty:'Your first seed will be the beginning of this story.',
    journalPlanted:'Planted a little {name}.', journalHarvested:'Harvested {name}. Collected {n} dew.', journalWatered:'Watered the {name}.', journalBuilt:'Restored the {name}.', journalExpanded:'Made room for one more patch of green.', journalReanchored:'The wheel counter restarted. Your plants kept their progress.', journalRescued:'Planted an emergency carrot seed.',
    footer:'A Squeekchain game about growing hamster food.', official:'Meet Squeektoshi ↗', about:'About the project',
    connecting:'Listening for the little wheel…', resting:'Squeektoshi is taking a nap', running:'The little wheel is turning · {n} RPM', offline:'Waiting to hear from the wheel',
    emptyPlot:'Empty patch · Plant {name}', plotLabel:'Food patch {n}', readyLabel:'{name} is ready · Harvest', growingLabel:'{name} is growing · {n} passages left', expandLabel:'Open a patch · {n} dew',
    plantAction:'Plant {name}', readyTag:'Ready to come home', growingTag:'A little more life, one lap at a time', watered:'Watered', water:'Water · 1 dew', waterDesc:'One watering reduces the passages needed by 30%.',
    remaining:'{n} accepted passages to go', progress:'Grown {n} / {total} passages', harvest:'Harvest · +{n} dew', expandTitle:'A little more room to grow', expandDesc:'Open this patch to tend a few more plants at once.', expand:'Open patch · {n} dew', close:'Close',
    planted:'A little {name} is planted. A new story begins.', harvested:'Harvested {count} plants. Collected {n} dew.', wateredToast:'All watered. A few fewer passages to grow.', builtToast:'The {name} is restored!', expanded:'Your new patch is ready.', rescueToast:'Emergency seed ready. Tap an empty patch.',
    notEnoughDew:'Not quite enough dew. Harvest a little more first.', plotUnavailable:'This patch is not ready for planting.', seedLocked:'Restore the seed library to plant sunflowers.', notReady:'Just a few more little footsteps.', waterUnavailable:'This plant does not need watering now.', improvementUnavailable:'This building is already restored.', buildFirst:'Restore the watermill and seed library first.', moreHarvests:'A few more harvests will make this possible.', needFresh:'Waiting for fresh wheel data. Your crop progress is safe.', rescueUnavailable:'You already have plants or enough dew for a seed.',
    helpTitle:'From one little seed to a light on the horizon', helpIntro:'A gentle resource strategy game. All dew, crops and buildings are game objects, with no tokens or monetary rewards.',
    step1:'Choose a seed. Tap an empty patch.', step1Desc:'Grow carrots and broccoli. Restore the library to grow sunflowers and harvest their seeds. Crops have different game costs, passage requirements and yields, shown on each seed card.',
    step2:'Let real footsteps grow your plants.', step2Desc:'All crops grow together with the hamster’s new accepted wheel passages. Growth pauses while he rests, and progress is saved. Water once to need fewer passages.',
    step3:'Harvest. Restore. Light your beacon.', step3Desc:'Spend dew on the watermill, seed library and beacon. The mill improves harvests. The library unlocks crops. Light the beacon to complete your pantry.',
    helpSeason:'Seasons are a game rule: the settled round number rotates the favoured crop. Matching seeds planted in that round keep a +2 dew harvest bonus. This is not real weather.', play:'Back to the food patch',
    evidenceTitle:'Where do the little footsteps come from?', evidenceIntro:'The pantry reads Squeekchain’s official public API. No wallet is needed. Growth uses hardware sensor passages accepted by the system; seasons use processed settlement rounds. These are different stages of the system.',
    feed:'Sensor feed', fresh:'Fresh data', unavailable:'Unavailable · growth paused', observed:'Observed at', acceptedWork:'Accepted lifetime passages', settledRound:'Processed round', safeBlock:'Confirmation-safe block', installation:'Installation',
    evidenceRules:'Disconnected, stale or invalid samples never add growth. A falling counter or new installation reanchors live progress without awarding a jump in work. Growth resumes with the next valid sample.', sourceStatus:'Open sensor status ↗', sourceEconomy:'Open settlement state ↗', noSample:'No valid sample received yet',
    saveTitle:'Take your little pantry with you', saveIntro:'Progress is saved automatically in this browser. Export a JSON save before changing devices, then import it in your new browser.', export:'Export current pantry', import:'Import a pantry save', importHint:'Import replaces your current pantry. Export a backup first. Only real-wheel saves are supported. Files are read locally and never uploaded.', reset:'Start this pantry again', resetTitle:'Start this little pantry again?', resetDesc:'This clears the crops, dew and buildings in your current pantry. Export a backup first if you would like to keep it.', resetConfirm:'Clear and start again', cancel:'Cancel',
    importTitle:'Bring this little pantry back?', importDesc:'This replaces your current pantry with {n} harvests and {dew} dew. Imported saves reanchor to avoid counting old passages twice.', importConfirm:'Import and replace', imported:'Your pantry has arrived.', invalidSave:'Please use a valid real-wheel save. Your existing pantry is safe.', resetDone:'A new little seed. A new little beginning.', saveUnavailable:'Browser storage is unavailable. Export a save to keep your progress.',
    winTitle:'You made this little place shine.', winDesc:'The beacon is lit by little seeds, patient harvests, and the unhurried footsteps of a real hamster. Your food patch can keep growing. There is no hurry.', keepGrowing:'Keep tending your food patch',
    aboutTitle:'A little pantry, moved by real little footsteps', aboutDesc:'Wheelhaven: Hamster Pantry is an independent crop strategy game created for Squeekchain. Grow carrots, broccoli and sunflower seeds in a hamster-food themed world. Crops, resources, watering, plot expansion and buildings form a complete play loop. Crop growth follows real accepted wheel passages reported by the official sensor feed.', aboutCredit:'Created by FLau1212 with development assistance from Codex. Not affiliated with Squeekchain. Original source is available under the MIT license.', sourceDownload:'Download complete source ↗', noWallet:'No wallet · No betting · No monetary rewards', dataNote:'Live sensor progress is not a settled on-chain reward.', lastSaved:'Automatically saved in this browser',
  },
};

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let language = readPreference('language', 'zh');
if (!COPY[language]) language = 'zh';
const store = createPantryStore(storageArea());
let selectedSeed = 'carrot', rescueQueued = false, activePlot = null, sample = null, lastGoodSample = null;
let busy = false, toastTimer, pendingImport = null, currentInfo = null;
const STATUS_URL = 'https://api.squeekchain.com/v1/status';
const ECONOMY_URL = 'https://api.squeekchain.com/v1/economy/state';

function t(key, values = {}) {
  let value = COPY[language][key] || COPY.en[key] || key;
  for (const [name, replacement] of Object.entries(values)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}
function readPreference(key, fallback) { try { return localStorage.getItem(`wheelhaven.${key}`) || fallback; } catch { return fallback; } }
function writePreference(key, value) { try { localStorage.setItem(`wheelhaven.${key}`, value); } catch {} }
function storageArea() {
  try { return window.localStorage; }
  catch { return { getItem: () => null, setItem: () => { throw new Error('storageUnavailable'); } }; }
}
function state() { return store.current(); }
// Another tab may have moved on since this tab last looked. Adopt the newest valid pantry first.
function adoptLatest() {
  if (store.sync().changed) afterAdopt();
  return state();
}
function afterAdopt() {
  const s = state();
  if (selectedSeed === 'sunflower' && !s.improvements.library) selectedSeed = 'carrot';
  if (rescueQueued && !canRescue(s)) rescueQueued = false;
  render();
}
// Every gameplay action runs on the newest stored pantry and is written back at once.
async function act(mutate, success, done) {
  const { result, saved, adopted } = await store.commit(mutate);
  if (adopted && !result.ok) afterAdopt();
  if (result.ok) { done?.(result); render(); if (saved === false) toast(t('saveUnavailable')); else if (success) toast(typeof success === 'function' ? success(result) : success); }
  else toast(t(result.reason));
  return result;
}
function liveReady() { return !!sample?.ok && Date.now() - Date.parse(sample.receivedAt) <= sample.staleMs; }
function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4200);
}

function render() {
  const focused = document.activeElement?.id;
  const s = state();
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.title = language === 'zh' ? 'Wheelhaven · 仓鼠粮仓' : 'Wheelhaven · Hamster Pantry powered by Squeektoshi';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
  $('#language-button').textContent = language === 'zh' ? 'EN' : '中文';
  $('#language-button').setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换到中文');
  $('#mode-note').textContent = t('liveNote');
  $('#dew-resource').innerHTML = `${icon('drop')}<strong>${s.dew.toLocaleString()}</strong><span>${t('dew')}</span>`;
  $('#harvest-resource').innerHTML = `${icon('leaf')}<strong>${s.harvests.toLocaleString()}</strong><span>${t('harvests')}</span>`;
  const readyCount = s.plots.filter(p => ready(p.plant)).length;
  $('#harvest-all').innerHTML = `${icon('leaf')}<span>${t('harvestAll')}${readyCount ? ` <b>${readyCount}</b>` : ''}</span>`;
  $('#harvest-all').disabled = readyCount === 0;
  $('#growth-explainer').textContent = t('growHint');
  $('#goal-summary').textContent = t(s.improvements.beacon ? 'goalWon' : 'goalSummary');
  renderPlots(); renderSeeds(); renderBuildings(); renderJournal(); renderFeed();
  if (activePlot !== null && $('#plot-dialog').open) renderPlotDialog();
  if (focused) document.getElementById(focused)?.focus({ preventScroll: true });
}

function renderPlots() {
  const s = state();
  $('#plots').innerHTML = s.plots.map((plot, id) => {
    const plant = plot.plant;
    if (!plot.unlocked) return `<button class="plot locked-plot" id="plot-${id}" data-plot="${id}" aria-label="${esc(t('expandLabel',{n:expansionCost(s)}))}"><span class="locked-art">${icon('plus')}</span><span class="plot-caption">${icon('drop')} ${expansionCost(s)}</span></button>`;
    if (!plant) return `<button class="plot empty-plot" id="plot-${id}" data-plot="${id}" aria-label="${esc(t('plotLabel',{n:id+1})+' · '+t('emptyPlot',{name:t(selectedSeed)}))}"><span class="empty-art"><i></i><i></i><i></i></span><span class="plot-caption">${icon('plus')} ${t('plantAction',{name:t(selectedSeed)})}</span></button>`;
    const done = ready(plant), ratio = Math.min(1, plant.grown / needed(plant));
    const stage = done ? 3 : ratio < .33 ? 0 : ratio < .67 ? 1 : 2;
    const label = done ? t('readyLabel',{name:t(plant.type)}) : t('growingLabel',{name:t(plant.type),n:Math.max(0,needed(plant)-plant.grown)});
    return `<button class="plot planted-plot ${done?'ready-plot':''}" id="plot-${id}" data-plot="${id}" aria-label="${esc(t('plotLabel',{n:id+1})+' · '+label)}">${cropArt(plant.type,stage,id)}<span class="plant-name">${t(plant.type)}</span>${done?`<span class="ready-bubble">${icon('check')}</span>`:`<span class="growth-bar"><i style="width:${Math.round(ratio*100)}%"></i></span>`}${plant.watered?`<span class="watered-mark" title="${t('watered')}">${icon('drop')}</span>`:''}</button>`;
  }).join('');
}

function renderSeeds() {
  const s = state();
  $('#seed-options').innerHTML = Object.entries(SPECIES).map(([key,spec]) => {
    const locked = key === 'sunflower' && !s.improvements.library;
    const active = selectedSeed === key;
    const bonus = s.round !== '0' && season(s.round).crop === key ? 2 : 0;
    return `<button class="seed-card ${active?'selected':''} ${locked?'seed-locked':''}" id="seed-${key}" data-seed="${key}" aria-pressed="${active}" ${locked?'disabled':''}><span class="seed-art">${cropArt(key,3)}</span><span class="seed-copy"><span class="seed-name">${t(key)}${active?`<span class="selected-tick">${icon('check')}</span>`:''}</span><span class="seed-desc">${t(key+'Desc')}</span><span class="seed-meta"><b>${icon('drop')}${t('seedCost',{n:spec.cost})}</b><span>${t('passages',{n:spec.work})}</span><span>${t('yield',{n:spec.yield})}${bonus?'<em> +2</em>':''}</span></span>${locked?`<span class="seed-lock-note">${icon('lock')}${t('libraryRequired')}</span>`:''}</span></button>`;
  }).join('');
  const hasSeason = s.round !== '0';
  $('#season-note').innerHTML = hasSeason ? `${icon('sun')}<div><strong>${t('season',{name:t(season(s.round).crop)})}</strong><span>${t('seasonBonus')}</span></div>` : `${icon('sun')}<span>${t('seasonUnknown')}</span>`;
  $('#rescue-button').hidden = !canRescue(s);
}

function renderBuildings() {
  const s = state();
  $('#buildings').innerHTML = Object.entries(IMPROVEMENTS).map(([key,spec],i) => {
    const built = s.improvements[key];
    const prereq = key === 'beacon' && (!s.improvements.mill || !s.improvements.library);
    const waiting = s.harvests < spec.harvests;
    const disabled = built || prereq || waiting || s.dew < spec.cost;
    let requirement = built ? t('built') : prereq ? t('requireBuildings') : t('requireHarvests',{n:spec.harvests});
    return `<article class="building-card ${built?'is-built':''}"><div class="building-top"><span class="building-index">0${i+1}</span><span class="building-status">${built?icon('check'):icon('leaf')}${requirement}</span></div><div class="building-content">${buildingArt(key,built)}<div><h3>${t(key)}</h3><p>${t(key+'Desc')}</p></div></div><button class="button building-button ${built?'completed':''}" id="build-${key}" data-build="${key}" ${disabled?'disabled':''}>${built?icon('check'):icon('drop')}<span>${built?t('built'):t('build',{n:spec.cost})}</span>${!built?icon('arrow'):''}</button></article>`;
  }).join('');
}

function renderJournal() {
  const entries = state().journal.slice(0,3);
  $('#journal-entries').innerHTML = entries.length ? entries.map(entry => {
    const [crop,gain] = entry.detail.split(':');
    const values = { name: t(crop), n: gain };
    const key = {planted:'journalPlanted',harvested:'journalHarvested',watered:'journalWatered',built:'journalBuilt',expanded:'journalExpanded',reanchored:'journalReanchored',rescued:'journalRescued'}[entry.kind];
    return key ? `<p>${icon(entry.kind==='harvested'?'leaf':entry.kind==='watered'?'drop':'seed')}<span>${esc(t(key,values))}</span></p>` : '';
  }).join('') : `<p class="journal-empty">${icon('seed')}<span>${t('journalEmpty')}</span></p>`;
}

function renderFeed() {
  const valid = liveReady();
  $('#hamster-art').innerHTML = wheelArt(valid && sample.running);
  $('#wheel-dot').className = `status-dot ${valid?'':'muted'} ${valid && sample.running?'running':''}`;
  $('#wheel-caption').textContent = !sample ? t('connecting') : !valid ? t('offline') : sample.running ? t('running',{n:sample.rpm.toFixed(1)}) : t('resting');
}

function usePlot(index) {
  const s = adoptLatest(), plot = s.plots[index];
  if (!plot) return;
  if (plot.unlocked && !plot.plant) {
    if (!liveReady()) { toast(t('needFresh')); return; }
    const seed = selectedSeed, rescue = rescueQueued;
    act(g => liveReady() ? plantSeed(g,index,seed,rescue) : {ok:false,reason:'needFresh'}, t('planted',{name:t(seed)}), () => { rescueQueued = false; });
    return;
  }
  activePlot = index; renderPlotDialog(); $('#plot-dialog').showModal();
}

function dialogHeader(title,id='info-title',close='info') {
  return `<div class="dialog-header"><span class="eyebrow">Wheelhaven</span><button id="${close}-dialog-close" class="icon-button" data-close="${close}" aria-label="${t('close')}">${icon('close')}</button></div><h2 id="${id}">${title}</h2>`;
}

function renderPlotDialog() {
  const s=state(), plot=s.plots[activePlot], p=plot?.plant;
  if (!plot) return;
  if (!plot.unlocked) {
    $('#plot-dialog-body').innerHTML = dialogHeader(t('expandTitle'),'plot-dialog-title','plot') + `<div class="dialog-crop">${buildingArt('library',false)}</div><p>${t('expandDesc')}</p><button class="button dark wide" data-action="expand" ${s.dew<expansionCost(s)?'disabled':''}>${t('expand',{n:expansionCost(s)})}</button>`;
    return;
  }
  if (!p) { $('#plot-dialog').close(); activePlot=null; return; }
  const done=ready(p), ratio=Math.min(1,p.grown/needed(p));
  $('#plot-dialog-body').innerHTML = dialogHeader(t(p.type),'plot-dialog-title','plot') + `<div class="dialog-crop">${cropArt(p.type,done?3:ratio<.33?0:ratio<.67?1:2)}</div><p class="dialog-caption">${t(done?'readyTag':'growingTag')}</p><div class="dialog-growth"><span style="width:${Math.round(ratio*100)}%"></span></div><p class="dialog-progress">${t('progress',{n:p.grown,total:needed(p)})}</p>${done?`<button class="button dark wide" data-action="harvest">${icon('leaf')}${t('harvest',{n:p.yield+(s.improvements.mill?1:0)})}</button>`:`<p>${t('remaining',{n:Math.max(0,needed(p)-p.grown)})}</p><button class="button dark wide" data-action="water" ${p.watered||s.dew<1?'disabled':''}>${icon('drop')}${t(p.watered?'watered':'water')}</button><p class="small-print">${t('waterDesc')}</p>`}`;
}

function openInfo(kind) {
  const focused=$('#info-dialog').open?document.activeElement?.id:null;
  currentInfo=kind;
  let html='';
  if (kind==='help') html=dialogHeader(t('helpTitle'))+`<p>${t('helpIntro')}</p><div class="help-steps">${[1,2,3].map(n=>`<div><span>0${n}</span><section><h3>${t('step'+n)}</h3><p>${t('step'+n+'Desc')}</p></section></div>`).join('')}</div><p class="small-print">${t('helpSeason')}</p><button class="button dark wide" data-close="info">${t('play')}${icon('arrow')}</button>`;
  if (kind==='evidence') {
    const g=lastGoodSample;
    html=dialogHeader(t('evidenceTitle'))+`<p>${t('evidenceIntro')}</p><dl class="evidence-list">${[[t('feed'),t(liveReady()?'fresh':'unavailable')],[t('observed'),g?new Date(g.observedAt).toLocaleString(language==='zh'?'zh-CN':'en-GB'):t('noSample')],[t('acceptedWork'),g?.work??'—'],[t('settledRound'),g?.settledRound??'—'],[t('safeBlock'),g?.safeBlock??'—'],[t('installation'),g?.epoch.split('/')[0]??'—']].map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="small-print">${t('evidenceRules')}</p><div class="dialog-links"><a href="${STATUS_URL}" target="_blank" rel="noopener">${t('sourceStatus')}</a><a href="${ECONOMY_URL}" target="_blank" rel="noopener">${t('sourceEconomy')}</a></div>`;
  }
  if (kind==='save') html=dialogHeader(t('saveTitle'))+`<p>${t('saveIntro')}</p><div class="save-actions"><button class="button dark wide" data-action="export">${icon('leaf')}${t('export')}</button><label class="button file-button wide" for="import-save">${t('import')}<input type="file" id="import-save" accept="application/json,.json"></label><p class="small-print">${t('importHint')}</p><button class="text-button reset-link" data-action="reset-dialog">${t('reset')}</button></div>`;
  if (kind==='reset') html=dialogHeader(t('resetTitle'))+`<p>${t('resetDesc')}</p><div class="dialog-actions"><button class="button" data-close="info">${t('cancel')}</button><button class="button danger" data-action="reset-confirm">${t('resetConfirm')}</button></div>`;
  if (kind==='importConfirm' && pendingImport) html=dialogHeader(t('importTitle'))+`<p>${t('importDesc',{n:pendingImport.harvests,dew:pendingImport.dew})}</p><div class="dialog-actions"><button class="button" data-close="info">${t('cancel')}</button><button class="button dark" data-action="import-confirm">${t('importConfirm')}</button></div>`;
  if (kind==='win') html=dialogHeader(t('winTitle'))+`<div class="win-art">${buildingArt('beacon',true)}</div><p>${t('winDesc')}</p><button class="button dark wide" data-close="info">${t('keepGrowing')}${icon('arrow')}</button>`;
  if (kind==='about') html=dialogHeader(t('aboutTitle'))+`<p>${t('aboutDesc')}</p><p>${t('aboutCredit')}</p><p class="about-promise">${icon('leaf')}${t('noWallet')}</p><a class="button dark wide" href="./wheelhaven-source.zip" download>${t('sourceDownload')}${icon('arrow')}</a><p class="small-print">${t('dataNote')}</p>`;
  $('#info-dialog-body').innerHTML=html;
  if (!$('#info-dialog').open) $('#info-dialog').showModal();
  if (focused) document.getElementById(focused)?.focus({preventScroll:true});
}

async function fetchJSON(url) {
  const response=await fetch(url,{signal:AbortSignal.timeout(9000),cache:'no-store',credentials:'omit'});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
async function refreshFeed() {
  if (busy) return;
  busy=true;
  let gardenChanged=false;
  try {
    const [statusResult,economyResult]=await Promise.allSettled([fetchJSON(STATUS_URL),fetchJSON(ECONOMY_URL)]);
    if (statusResult.status!=='fulfilled') throw new Error('sensorUnavailable');
    const next=parseTelemetry(statusResult.value,economyResult.status==='fulfilled'?economyResult.value:null);
    sample=next;
    if (next.ok) {
      lastGoodSample=next;
      // Apply the sample to the newest stored pantry so its anchor, not this tab's copy, decides the
      // passages that count. Only real changes are written; an idle tab writes nothing.
      let previousRound;
      const { result, adopted, saved }=await store.commit(g=>{ previousRound=g.round; return applyTelemetry(g,next); },
        (r,g)=>r.reanchored || r.delta!=='0' || previousRound!==g.round);
      gardenChanged=adopted || (result.ok && (result.reanchored || result.delta!=='0' || previousRound!==state().round));
      if(saved===false)toast(t('saveUnavailable'));
    }
  } catch { sample={ok:false,reason:'unavailable'}; }
  finally { busy=false; if(gardenChanged)render();else renderFeed(); if ($('#info-dialog').open && currentInfo==='evidence') openInfo('evidence'); }
}

$('#language-button').addEventListener('click',()=>{
  language=language==='zh'?'en':'zh'; writePreference('language',language); render();
  if ($('#info-dialog').open && currentInfo) openInfo(currentInfo);
});
$('#help-button').addEventListener('click',()=>openInfo('help'));
$('#evidence-button').addEventListener('click',()=>openInfo('evidence'));
$('#footer-evidence-button').addEventListener('click',()=>openInfo('evidence'));
$('#about-button').addEventListener('click',()=>openInfo('about'));
$('#save-button').addEventListener('click',()=>openInfo('save'));
$('#plots').addEventListener('click',event=>{ const b=event.target.closest('[data-plot]'); if (b) usePlot(Number(b.dataset.plot)); });
$('#seed-options').addEventListener('click',event=>{ const b=event.target.closest('[data-seed]'); if(b&&!b.disabled){selectedSeed=b.dataset.seed;rescueQueued=false;render();} });
$('#harvest-all').addEventListener('click',()=>{
  act(harvestAll,r=>t('harvested',{count:r.count,n:r.gain}));
});
$('#rescue-button').addEventListener('click',()=>{if(canRescue(adoptLatest())){selectedSeed='carrot';rescueQueued=true;render();toast(t('rescueToast'));}});
$('#buildings').addEventListener('click',async event=>{
  const b=event.target.closest('[data-build]');if(!b||b.disabled)return;
  const key=b.dataset.build,result=await act(g=>buyImprovement(g,key),t('builtToast',{name:t(key)}));
  if(result.ok&&key==='beacon')openInfo('win');
});
document.addEventListener('click',async event=>{
  if(!(event.target instanceof Element))return;
  const target=event.target;
  const close=target.closest('[data-close]');
  if(close){$(close.getAttribute('data-close')==='plot'?'#plot-dialog':'#info-dialog').close();return;}
  const action=target.closest('[data-action]')?.getAttribute('data-action');
  if(!action)return;
  if(action==='harvest'){
    const index=activePlot;$('#plot-dialog').close();activePlot=null;
    act(g=>harvest(g,index),r=>t('harvested',{count:1,n:r.gain}));
  }
  if(action==='water'){const index=activePlot;act(g=>waterPlant(g,index),t('wateredToast'));}
  if(action==='expand'){
    const index=activePlot;
    act(g=>expandPlot(g,index),t('expanded'),()=>{$('#plot-dialog').close();activePlot=null;});
  }
  if(action==='export'){
    const blob=new Blob([JSON.stringify(adoptLatest(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='wheelhaven-pantry.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  if(action==='reset-dialog')openInfo('reset');
  if(action==='reset-confirm'){
    target.closest('[data-action]').setAttribute('disabled','');
    const saved=await store.replace(createGarden('live'),sample);
    selectedSeed='carrot';rescueQueued=false;activePlot=null;$('#plot-dialog').close();$('#info-dialog').close();render();toast(t(saved?'resetDone':'saveUnavailable'));
  }
  if(action==='import-confirm'&&pendingImport){
    target.closest('[data-action]').setAttribute('disabled','');
    const imported=pendingImport;pendingImport=null;
    const saved=await store.replace(imported,sample);
    selectedSeed='carrot';rescueQueued=false;activePlot=null;$('#plot-dialog').close();
    $('#info-dialog').close();render();toast(t(saved?'imported':'saveUnavailable'));
  }
});
document.addEventListener('change',async event=>{
  if(!(event.target instanceof HTMLInputElement)||event.target.id!=='import-save')return;
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>50_000)throw new Error('tooLarge');
    const raw=JSON.parse(await file.text());pendingImport=restoreGarden(raw,'live');openInfo('importConfirm');
  }catch{pendingImport=null;toast(t('invalidSave'));}
});
for(const dialog of document.querySelectorAll('dialog')){
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{if(dialog.id==='plot-dialog')activePlot=null;else currentInfo=null;});
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){adoptLatest();refreshFeed();}});
window.addEventListener('online',refreshFeed);
window.addEventListener('focus',adoptLatest);
window.addEventListener('storage',event=>{if(store.handleStorageEvent(event).changed)afterAdopt();});
// pagehide never writes this tab's copy over newer progress; it only retries a write that failed.
window.addEventListener('pagehide',()=>store.flush());
render();refreshFeed();
setInterval(refreshFeed,15_000);
setInterval(()=>{if(sample?.ok&&!liveReady()){renderFeed();$('#mode-note').textContent=t('needFresh');}},5000);
