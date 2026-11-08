import * as THREE from 'three';
import { SunSystem } from './sun';
import { BridgeSystem } from './bridges';
import { WaterSystem } from './water';
import { WeatherSystem } from './weather';
import { FlightSimulator } from './flight';
import { CameraController } from './camera';
import { LandmarksSystem } from './landmarks';
import { metersToLatLon } from './geo';

export interface LandmarkInfo {
  id: string;
  name: string;
  style: string;
  architect: string;
  years: string;
  coords: { x: number; y: number; z: number };
  zoom: number;
  description: string;
}

export const LANDMARK_DATA: LandmarkInfo[] = [
  {
    id: 'hermitage',
    name: 'Зимний дворец (Эрмитаж)',
    style: 'Елизаветинское пышное барокко',
    architect: 'Бартоломео Франческо Растрелли',
    years: '1754—1762',
    coords: { x: -44.6, y: 28, z: -66.8 },
    zoom: 160,
    description: 'Главная резиденция российских императоров. Бирюзово-изумрудный фасад с белоснежными колоннами, золоченой лепниной и 176 скульптурами на кровле. 1084 зала и всемирно известная коллекция шедевров живописи.'
  },
  {
    id: 'general_staff',
    name: 'Главный штаб и Триумфальная арка',
    style: 'Русский ампир (Классицизм)',
    architect: 'Карло Росси',
    years: '1819—1829',
    coords: { x: 67.9, y: 32, z: 87.7 },
    zoom: 160,
    description: 'Грандиозный дугообразный охристый фасад протяженностью 580 метров, охватывающий Дворцовую площадь. Триумфальная арка увенчана бронзовой Колесницей Славы с крылатой богиней Победы.'
  },
  {
    id: 'admiralty',
    name: 'Главное Адмиралтейство',
    style: 'Русский высокий ампир',
    architect: 'Андреян Захаров',
    years: '1806—1823',
    coords: { x: -331.7, y: 48, z: 259.6 },
    zoom: 160,
    description: 'Центр трехлучевой композиции Петербурга (Невский, Гороховая, Вознесенский). 72.5-метровый золоченый шпиль венчает кораблик-флюгер весом 65 кг, покрытый двумя килограммами червонного золота.'
  },
  {
    id: 'isaac',
    name: 'Исаакиевский собор',
    style: 'Поздний монументальный классицизм',
    architect: 'Огюст Монферран',
    years: '1818—1858',
    coords: { x: -472.7, y: 65, z: 636.4 },
    zoom: 150,
    description: 'Крупнейший православный храм Петербурга высотой 101.5 м. По периметру установлены 112 монолитных колонн из красного карельского гранита. Купол покрыт 100 кг сусального золота по методу огневого золочения.'
  },
  {
    id: 'exchange',
    name: 'Стрелка В.О. и Здание Биржи',
    style: 'Строгий эллинский классицизм',
    architect: 'Тома де Томон',
    years: '1805—1816',
    coords: { x: -480, y: 26, z: -430 },
    zoom: 180,
    description: 'Античный периптер по образцу храма в Пестуме с 44 белыми дорическими колоннами на высоком гранитном стилобате. Фронтон украшен скульптурной группой «Нептун с реками Невой и Волховом».'
  },
  {
    id: 'spas',
    name: 'Спас на Крови',
    style: 'Русский стиль (Неорусское узорочье)',
    architect: 'Альфред Парланд, архимандрит Игнатий',
    years: '1883—1907',
    coords: { x: 797.9, y: 55, z: -28.3 },
    zoom: 150,
    description: 'Храм Воскресения Христова на месте смертельного ранения императора Александра II. Центральный шатер высотой 81 метр окружен 5 ювелирно эмалированными куполами-луковицами и 7500 кв. м мозаик.'
  },
  {
    id: 'kazan',
    name: 'Казанский кафедральный собор',
    style: 'Русский классицизм',
    architect: 'Андрей Воронихин',
    years: '1801—1811',
    coords: { x: 565.6, y: 45, z: 597.2 },
    zoom: 160,
    description: 'Грандиозная полукруглая колоннада из 96 коринфских колонн из пудожского известняка, обращенная к Невскому проспекту. Памятник воинской славы 1812 года и место упокоения фельдмаршала М. И. Кутузова.'
  },
  {
    id: 'peter_paul',
    name: 'Петропавловская крепость и собор',
    style: 'Петровское барокко и фортификация',
    architect: 'Доменико Трезини, Бурхард Миних',
    years: '1703—1733',
    coords: { x: 145, y: 35, z: -1020 },
    zoom: 160,
    description: 'Историческое ядро Санкт-Петербурга на Заячьем острове, заложенное 27 мая 1703 года. Гранитные бастионы Нарышкина и Государева, Флагшточная башня с ежедневным полуденным выстрелом сигнальной пушки в 12:00, Комендантская пристань и золоченый 122.5-метровый шпиль собора с парящим ангелом.'
  },
  {
    id: 'new_holland',
    name: 'Новая Голландия и Арка Валлен-Деламота',
    style: 'Ранний русский классицизм',
    architect: 'Жан-Батист Валлен-Деламот, Савва Чевакинский',
    years: '1765—1788',
    coords: { x: -1334, y: 25, z: 1220 },
    zoom: 140,
    description: 'Шедевр промышленной архитектуры XVIII века на рукотворном треугольном острове. Монументальная кирпично-гранитная триумфальная арка над каналом, знаменитый кольцевой замок «Бутылка», внутренний водный ковш и парк культуры.'
  },
  {
    id: 'smolny',
    name: 'Смольный собор',
    style: 'Елизаветинское барокко',
    architect: 'Бартоломео Франческо Растрелли',
    years: '1748—1764',
    coords: { x: 4475, y: 80, z: -1007 },
    zoom: 170,
    description: 'Вершина русского барокко на излучине Невы. Изумительный небесно-голубой пятиглавый собор высотой 93.7 метра с ажурными белокаменными лепными гирляндами и золочеными куполами.'
  },
  {
    id: 'tauride',
    name: 'Таврический дворец и сад',
    style: 'Строгий русский классицизм',
    architect: 'Иван Старов',
    years: '1783—1789',
    coords: { x: 3430, y: 35, z: -877 },
    zoom: 170,
    description: 'Резиденция князя Потёмкина-Таврического с великолепным пейзажным Таврическим садом. Шестиколонный портик, купольная ротонда и грандиозный Белоколонный Екатерининский зал.'
  },
  {
    id: 'moscow_station',
    name: 'Московский вокзал и пл. Восстания',
    style: 'Неоренессанс',
    architect: 'Константин Тон',
    years: '1844—1851',
    coords: { x: 2613, y: 40, z: 1078 },
    zoom: 160,
    description: 'Главные железнодорожные ворота Санкт-Петербурга на площади Восстания. Кружевной двухъярусный фасад с венецианскими арочными окнами и высокой часовой башней со шпилем.'
  },
  {
    id: 'lavra',
    name: 'Александро-Невская лавра',
    style: 'Русский классицизм и барокко',
    architect: 'Доменико Трезини, Иван Старов',
    years: '1713—1790',
    coords: { x: 4135, y: 55, z: 2083 },
    zoom: 160,
    description: 'Старейший монастырь Санкт-Петербурга, основанный Петром I в честь победы князя Александра Невского. Троицкий собор с двухъярусными колокольнями, монументальным куполом и некрополями мастеров искусств.'
  },
  {
    id: 'sphinxes_quay',
    name: 'Пристань со Сфинксами',
    style: 'Древнеегипетский стиль и классицизм',
    architect: 'Константин Тон (пристань), зодчие Аменхотепа III',
    years: '1832—1834 (Сфинксы: XIV в. до н.э.)',
    coords: { x: -1350, y: 8, z: 325 },
    zoom: 65,
    description: 'Легендарная гранитная пристань на Университетской набережной напротив Академии художеств. Два подлинных древнеегипетских сфинкса из розового асуанского сиенита возрастом более 3400 лет с ликами фараона Аменхотепа III и бронзовые крылатые грифоны у невской воды.'
  },
  {
    id: 'palace_lions_pier',
    name: 'Дворцовая пристань со львами',
    style: 'Русский ампир и классицизм',
    architect: 'Карл Росси, Людвиг Шарлемань, скульптор Иван Прокофьев',
    years: '1820—1832',
    coords: { x: -288, y: 6, z: -20 },
    zoom: 60,
    description: 'Парадный гранитный спуск к Неве у южного устоя Дворцового моста. Два знаменитых сторожевых медных льва с грозным оскалом, опирающихся лапой на шар, охраняют гранитную набережную и причал для катеров.'
  },
  {
    id: 'spit_ramp_and_lions',
    name: 'Гранитный спуск Стрелки Васильевского острова',
    style: 'Монументальный классицизм',
    architect: 'Тома де Томон',
    years: '1805—1810',
    coords: { x: -392, y: 5, z: -446 },
    zoom: 85,
    description: 'Величественный полукруглый гранитный пандус-спуск в воды Невы на Стрелке Васильевского острова между Ростральными колоннами. Колоссальные полированные гранитные шары на тумбах и бронзовые львиные маскароны с массивными чугунными причальными кольцами.'
  },
  {
    id: 'anichkov_horses',
    name: 'Кони Клодта на Аничковом мосту',
    style: 'Русский романтический классицизм',
    architect: 'Петр Клодт (скульптор), Александр Брюллов (мост)',
    years: '1841—1850',
    coords: { x: 1605, y: 10, z: 730 },
    zoom: 70,
    description: 'Всемирно известный скульптурный ансамбль из четырех бронзовых групп «Укрощение коня человеком» на розовых гранитных устоях Аничкова моста через Фонтанку. Ажурная ограда моста Карла Шинкеля с морскими коньками и русалками.'
  },
  {
    id: 'palace_bridge',
    name: 'Дворцовый мост',
    style: 'Инженерный классицизм и модерн',
    architect: 'Анджей Пшеницкий, Роберт-Фридрих Мельцер',
    years: '1912—1916',
    coords: { x: -352, y: 15, z: -139 },
    zoom: 120,
    description: 'Главный символ Санкт-Петербурга. Пятипролетный металлический мост через Большую Неву со знаменитым двукрылым разводным центральным пролетом, гранитными ледорезами-быками, клепаными арочными фермами и чугунными перилами с морскими коньками.'
  },
  {
    id: 'trinity_bridge',
    name: 'Троицкий мост',
    style: 'Французский модерн (Ар-нуво)',
    architect: 'Строительное общество «Батиньоль» (Франция)',
    years: '1897—1903',
    coords: { x: 730, y: 15, z: -1035 },
    zoom: 140,
    description: 'Шедевр мостостроения эпохи модерна, возведенный французскими инженерами к 200-летию Санкт-Петербурга. Пять ажурных серповидных арочных пролетов, трехрожковые торшеры-фонари с имперскими орлами и однокрылый разводной пролет.'
  },
  {
    id: 'bank_bridge',
    name: 'Банковский мост',
    style: 'Русский ампир',
    architect: 'Вильгельм фон Треттер, скульптор Павел Соколов',
    years: '1825—1826',
    coords: { x: 582, y: 10, z: 838 },
    zoom: 65,
    description: 'Один из самых поэтичных пешеходных цепных мостов через канал Грибоедова. Четыре крылатых грифона с сияющими золотыми крыльями удерживают в пастях массивные чугунные цепи, поддерживающие мостовое полотно.'
  }
];

export class UIManager {
  private container: HTMLElement;
  private onlineBadgeEl!: HTMLElement;
  private districtPlateEl!: HTMLElement;
  private topToolbarEl!: HTMLElement;
  private navControlsEl!: HTMLElement;
  private statusBarEl!: HTMLElement;
  private landmarkCardEl!: HTMLElement;
  private timeModal!: HTMLElement;
  private aboutModal!: HTMLElement;
  private quickJumpModal!: HTMLElement;
  private flightHudEl!: HTMLElement;

  private poiMarkers: { el: HTMLElement; lm: LandmarkInfo }[] = [];
  private activeLandmarkId: string | null = null;
  private isTimeModalOpen: boolean = false;
  private isQuickJumpOpen: boolean = false;

  constructor(
    private sun: SunSystem,
    private bridges: BridgeSystem,
    private water: WaterSystem,
    private weather: WeatherSystem,
    private flight: FlightSimulator,
    private camera: CameraController,
    private landmarks: LandmarksSystem
  ) {
    this.container = document.createElement('div');
    this.container.id = 'warsaw-ui-root';
    document.body.appendChild(this.container);

    this.createOnlineBadge();
    this.createDistrictPlate();
    this.createTopToolbar();
    this.createFlightHud();
    this.createNavControls();
    this.createStatusBar();
    this.createPoiMarkers();
    this.createLandmarkCard();
    this.createTimeModal();
    this.createAboutModal();
    this.createQuickJumpModal();
    this.createCinematicOverlay();
    this.createMinimalHudRestoreButton();
    this.setupKeyboardShortcuts();

    this.camera.onCinematicTitleChange = (name, sub) => {
      const banner = document.getElementById('w-cinema-banner');
      const titleEl = document.getElementById('w-cinema-title');
      const subEl = document.getElementById('w-cinema-sub');
      const cinemaBtn = document.getElementById('w-btn-cinema');
      if (name) {
        if (banner) banner.style.display = 'flex';
        if (titleEl) titleEl.textContent = name;
        if (subEl) subEl.textContent = sub;
        if (cinemaBtn) cinemaBtn.classList.add('active');
      } else {
        if (banner) banner.style.display = 'none';
        if (cinemaBtn) cinemaBtn.classList.remove('active');
      }
    };
  }

  /**
   * Top-Left: Online Counter Badge (Warsaw-Izo style)
   */
  private createOnlineBadge() {
    this.onlineBadgeEl = document.createElement('div');
    this.onlineBadgeEl.className = 'w-online-badge';
    this.onlineBadgeEl.innerHTML = `
      <span class="w-online-dot"></span>
      <span class="w-online-text">5 онлайн</span>
    `;
    this.container.appendChild(this.onlineBadgeEl);
  }

  /**
   * Top-Center: Floating District Name Plate (Warsaw-Izo style)
   */
  private createDistrictPlate() {
    this.districtPlateEl = document.createElement('div');
    this.districtPlateEl.className = 'w-district-plate';
    this.districtPlateEl.innerHTML = `
      <div class="w-district-title" id="w-district-title">Дворцовый округ</div>
      <div class="w-district-sub" id="w-district-sub">Центральный район • Санкт-Петербург</div>
    `;
    this.container.appendChild(this.districtPlateEl);
  }

  /**
   * Top-Right: 5 Minimalist Square Icon Buttons (Warsaw-Izo style)
   */
  private createTopToolbar() {
    this.topToolbarEl = document.createElement('nav');
    this.topToolbarEl.className = 'w-top-toolbar';
    this.topToolbarEl.innerHTML = `
      <button class="w-icon-btn" id="w-btn-cinema" title="Кинематографичный кино-тур по городу (C)">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
      </button>
      <button class="w-icon-btn" id="w-btn-minimal" title="Чистая эстетика без интерфейса (H)">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <button class="w-icon-btn" id="w-btn-postcard" title="Создать открытку «Привет из Петербурга» (P)">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      </button>
      <button class="w-icon-btn" id="w-btn-night" title="Белые ночи и подсветка города (N)">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
      <button class="w-icon-btn" id="w-btn-flight" title="Симулятор полёта над городом (F)">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
      </button>
      <button class="w-icon-btn" id="w-btn-sun" title="Освещение, погода и Нева (T)">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      </button>
      <button class="w-icon-btn" id="w-btn-cannon" title="Полуденный выстрел пушки Нарышкина бастиона (K)">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="6" cy="18" r="3"/><line x1="6" y1="18" x2="19" y2="7"/><path d="M14 6l6-2-2 6"/></svg>
      </button>
      <button class="w-icon-btn" id="w-btn-fullscreen" title="Полноэкранный режим">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
      </button>
      <button class="w-icon-btn" id="w-btn-landmarks" title="Список достопримечательностей (Телепорт)">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
      </button>
      <button class="w-icon-btn" id="w-btn-info" title="О проекте">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      </button>
    `;
    this.container.appendChild(this.topToolbarEl);

    this.topToolbarEl.querySelector('#w-btn-cinema')!.addEventListener('click', () => {
      this.toggleCinematicMode();
    });

    this.topToolbarEl.querySelector('#w-btn-minimal')!.addEventListener('click', () => {
      this.toggleMinimalHud();
    });

    this.topToolbarEl.querySelector('#w-btn-postcard')!.addEventListener('click', () => {
      this.createPostcard();
    });

    this.topToolbarEl.querySelector('#w-btn-night')!.addEventListener('click', () => {
      this.toggleWhiteNightMode();
    });

    this.topToolbarEl.querySelector('#w-btn-flight')!.addEventListener('click', () => {
      this.toggleFlightMode();
    });

    this.topToolbarEl.querySelector('#w-btn-fullscreen')!.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    this.topToolbarEl.querySelector('#w-btn-cannon')!.addEventListener('click', () => {
      this.fireNoonCannon();
    });

    this.topToolbarEl.querySelector('#w-btn-sun')!.addEventListener('click', () => {
      this.toggleTimeModal();
    });

    this.topToolbarEl.querySelector('#w-btn-landmarks')!.addEventListener('click', () => {
      this.toggleQuickJump();
    });

    this.topToolbarEl.querySelector('#w-btn-info')!.addEventListener('click', () => {
      this.toggleAboutModal();
    });
  }

  /**
   * Flight Simulator HUD (Warsaw-Izo clean dark panel with live telemetry and controls)
   */
  private createFlightHud() {
    this.flightHudEl = document.createElement('div');
    this.flightHudEl.className = 'w-flight-hud';
    this.flightHudEl.id = 'w-flight-hud';
    this.flightHudEl.style.display = 'none';
    this.flightHudEl.innerHTML = `
      <div class="w-flight-hud-main">
        <div class="w-flight-stat">
          <span class="w-stat-lbl">СКОРОСТЬ</span>
          <span class="w-stat-val" id="w-flight-speed">158 км/ч</span>
        </div>
        <div class="w-flight-sep"></div>
        <div class="w-flight-stat">
          <span class="w-stat-lbl">ВЫСОТА</span>
          <span class="w-stat-val" id="w-flight-alt">85 м</span>
        </div>
        <div class="w-flight-sep"></div>
        <div class="w-flight-stat">
          <span class="w-stat-lbl">ТЯГА</span>
          <span class="w-stat-val" id="w-flight-throttle">65%</span>
        </div>
        <div class="w-flight-sep"></div>
        <div class="w-flight-stat">
          <span class="w-stat-lbl">ВЕРТ. СКОР.</span>
          <span class="w-stat-val" id="w-flight-vspeed">+0.0 м/с</span>
        </div>

        <div class="w-flight-sep"></div>

        <!-- Zoom Controls -->
        <div class="w-flight-zoom-ctrl">
          <span class="w-stat-lbl">ЗУМ</span>
          <div class="w-flight-btn-group">
            <button class="w-flight-btn" id="w-flight-zoom-out" title="Отдалить (-)">-</button>
            <span class="w-flight-val" id="w-flight-zoom-val">100%</span>
            <button class="w-flight-btn" id="w-flight-zoom-in" title="Приблизить (+)">+</button>
          </div>
        </div>

        <div class="w-flight-sep"></div>

        <!-- Camera Mode, Invert & Mouse Toggles -->
        <button class="w-flight-btn w-flight-action-btn" id="w-flight-cam" title="Переключить ракурс (V)">
          Ракурс: <span id="w-flight-cam-val">Хвост</span>
        </button>

        <button class="w-flight-btn w-flight-action-btn" id="w-flight-invert" title="Инверсия тангажа (I)">
          Тангаж: <span id="w-flight-invert-val">Прямой</span>
        </button>

        <button class="w-flight-btn w-flight-action-btn" id="w-flight-mouse" title="Управление мышью (M)">
          Мышь: <span id="w-flight-mouse-val">Выкл</span>
        </button>

        <button class="w-flight-exit-btn" id="w-flight-exit" title="Завершить полёт (F)">Выход (F)</button>
      </div>
      <div class="w-flight-tips">
        W/S: высота • A/D: поворот • Пробел: форсаж • Колесо: зум • V: ракурс • I: инверсия • M: мышь
      </div>
    `;
    this.container.appendChild(this.flightHudEl);

    // Event listeners for flight HUD controls
    this.flightHudEl.querySelector('#w-flight-exit')!.addEventListener('click', () => {
      this.toggleFlightMode(false);
    });

    this.flightHudEl.querySelector('#w-flight-zoom-in')!.addEventListener('click', () => {
      this.camera.zoomFlightIn();
    });

    this.flightHudEl.querySelector('#w-flight-zoom-out')!.addEventListener('click', () => {
      this.camera.zoomFlightOut();
    });

    this.flightHudEl.querySelector('#w-flight-cam')!.addEventListener('click', () => {
      const modeName = this.camera.cycleFlightCamera();
      const el = document.getElementById('w-flight-cam-val');
      if (el) el.textContent = modeName;
      this.showToast(`Ракурс камеры: ${modeName}`);
    });

    this.flightHudEl.querySelector('#w-flight-invert')!.addEventListener('click', () => {
      const isInverted = this.flight.toggleInvertPitch();
      const el = document.getElementById('w-flight-invert-val');
      if (el) el.textContent = isInverted ? 'Авиа' : 'Прямой';
      this.showToast(isInverted ? 'Режим тангажа: Авиационный (W = пикирование)' : 'Режим тангажа: Прямой (W = набор высоты)');
    });

    this.flightHudEl.querySelector('#w-flight-mouse')!.addEventListener('click', () => {
      const isMouse = this.flight.toggleMouseControl();
      const el = document.getElementById('w-flight-mouse-val');
      if (el) el.textContent = isMouse ? 'Вкл' : 'Выкл';
      this.showToast(isMouse ? 'Управление мышью включено' : 'Управление мышью выключено');
    });
  }

  public toggleFlightMode(force?: boolean) {
    const shouldActive = force !== undefined ? force : !this.flight.isActive;
    const flightBtn = document.getElementById('w-btn-flight');

    if (shouldActive) {
      this.flight.activate();
      this.flightHudEl.style.display = 'flex';
      if (flightBtn) flightBtn.classList.add('active');
    } else {
      this.flight.deactivate();
      this.flightHudEl.style.display = 'none';
      if (flightBtn) flightBtn.classList.remove('active');
    }
  }

  /**
   * Bottom-Right: Vertical Zoom & Rotation Pill (Warsaw-Izo style)
   */
  private createNavControls() {
    this.navControlsEl = document.createElement('nav');
    this.navControlsEl.className = 'w-nav-pill';
    this.navControlsEl.innerHTML = `
      <button class="w-pill-btn" id="w-zoom-in" title="Приблизить (+)">+</button>
      <button class="w-pill-btn" id="w-zoom-out" title="Отдалить (−)">−</button>
      <div class="w-pill-sep"></div>
      <button class="w-pill-btn" id="w-rot-l" title="Повернуть против часовой стрелки (Q)">↺</button>
      <button class="w-pill-btn" id="w-rot-r" title="Повернуть по часовой стрелке (E)">↻</button>
    `;
    this.container.appendChild(this.navControlsEl);

    this.navControlsEl.querySelector('#w-zoom-in')!.addEventListener('click', () => this.camera.zoomIn());
    this.navControlsEl.querySelector('#w-zoom-out')!.addEventListener('click', () => this.camera.zoomOut());
    this.navControlsEl.querySelector('#w-rot-l')!.addEventListener('click', () => this.camera.rotateLeft());
    this.navControlsEl.querySelector('#w-rot-r')!.addEventListener('click', () => this.camera.rotateRight());
  }

  /**
   * Bottom-Right Status Bar: Scale line & Coordinates (Warsaw-Izo style)
   */
  private createStatusBar() {
    this.statusBarEl = document.createElement('div');
    this.statusBarEl.className = 'w-status-bar';
    this.statusBarEl.innerHTML = `
      <div class="w-scale-box">
        <span class="w-scale-bar"></span>
        <span class="w-scale-text" id="w-scale-text">100 м</span>
      </div>
      <div class="w-status-line" id="w-status-line">
        WASD: панорама • Q/E: поворот • 59.9398, 30.3146 • zoom 2
      </div>
    `;
    this.container.appendChild(this.statusBarEl);
  }

  /**
   * 3D Projected Yellow [i] Markers Floating Over Landmarks (Warsaw-Izo style)
   */
  private createPoiMarkers() {
    const poiContainer = document.createElement('div');
    poiContainer.className = 'w-poi-container';
    this.container.appendChild(poiContainer);

    for (const lm of LANDMARK_DATA) {
      const pin = document.createElement('button');
      pin.className = 'w-poi-marker';
      pin.setAttribute('data-id', lm.id);
      pin.setAttribute('title', lm.name);
      pin.innerHTML = `
        <span class="w-poi-box">i</span>
        <span class="w-poi-tooltip">${lm.name.split(' (')[0]}</span>
      `;

      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectLandmark(lm.id);
      });

      poiContainer.appendChild(pin);
      this.poiMarkers.push({ el: pin, lm });
    }
  }

  /**
   * Quick Jump / Teleport Drawer (List of all landmarks)
   */
  private createQuickJumpModal() {
    this.quickJumpModal = document.createElement('div');
    this.quickJumpModal.className = 'w-dialog w-quickjump-dialog';
    
    let html = `
      <div class="w-dialog-header">
        <div class="w-dialog-title">Достопримечательности Санкт-Петербурга</div>
        <button class="w-dialog-close" id="w-quickjump-close">✕</button>
      </div>
      <div class="w-quickjump-search-wrap">
        <input type="text" id="w-jump-search" class="w-jump-search" placeholder="Быстрый поиск (Лавра, Зимний, Спас...)" autocomplete="off" />
      </div>
      <div class="w-dialog-body w-quickjump-list" id="w-quickjump-items">
    `;

    for (const lm of LANDMARK_DATA) {
      html += `
        <button class="w-jump-item" data-id="${lm.id}">
          <div class="jump-title">${lm.name}</div>
          <div class="jump-sub">${lm.style} • ${lm.architect}</div>
        </button>
      `;
    }

    html += `</div>`;
    this.quickJumpModal.innerHTML = html;
    this.container.appendChild(this.quickJumpModal);

    const searchInput = this.quickJumpModal.querySelector('#w-jump-search') as HTMLInputElement;
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      const items = this.quickJumpModal.querySelectorAll('.w-jump-item');
      items.forEach((el) => {
        const text = el.textContent?.toLowerCase() || '';
        (el as HTMLElement).style.display = text.includes(q) ? 'flex' : 'none';
      });
    });

    this.quickJumpModal.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.w-jump-item') as HTMLElement | null;
      if (!item) return;
      const id = item.getAttribute('data-id')!;
      this.selectLandmark(id);
      this.toggleQuickJump(false);
    });

    this.quickJumpModal.querySelector('#w-quickjump-close')!.addEventListener('click', () => {
      this.toggleQuickJump(false);
    });
  }

  /**
   * Architectural Landmark Card (Upper-Right)
   */
  private createLandmarkCard() {
    this.landmarkCardEl = document.createElement('article');
    this.landmarkCardEl.className = 'w-card';
    this.landmarkCardEl.style.display = 'none';
    this.container.appendChild(this.landmarkCardEl);
  }

  /**
   * Time of Day, Weather & Hydrology Modal (Warsaw-Izo clean dark palette)
   */
  private createTimeModal() {
    this.timeModal = document.createElement('div');
    this.timeModal.className = 'w-dialog w-time-dialog';
    this.timeModal.innerHTML = `
      <div class="w-dialog-header">
        <div class="w-dialog-title">Освещение, погода и Нева</div>
        <button class="w-dialog-close" id="w-time-close">✕</button>
      </div>
      <div class="w-dialog-body">
        <div class="w-dialog-section-title">ВРЕМЯ СУТОК</div>
        <div class="w-time-clock" id="w-time-clock">13:30</div>
        
        <div class="w-slider-wrap">
          <input type="range" id="w-hour-slider" min="0" max="24" step="0.25" value="13.5" class="w-slider">
          <div class="w-slider-marks">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </div>

        <div class="w-preset-grid">
          <button class="w-preset-btn" data-time="5.5">Рассвет (05:30)</button>
          <button class="w-preset-btn active" data-time="13.5">Полдень (13:30)</button>
          <button class="w-preset-btn" data-time="20.75">Закат (20:45)</button>
          <button class="w-preset-btn" data-time="23.5">Белые ночи (23:30)</button>
          <button class="w-preset-btn" data-time="1.5">Полночь (01:30)</button>
          <button class="w-preset-btn" data-time="real">Онлайн время</button>
        </div>

        <div class="w-whitenight-box">
          <label class="w-checkbox-label">
            <input type="checkbox" id="w-whitenight-chk">
            <span>Белые ночи (июньский полуночный зенит)</span>
          </label>
        </div>

        <div class="w-dialog-section-title" style="margin-top: 14px;">ПОГОДА НАД ГОРОДОМ</div>
        <div class="w-preset-grid">
          <button class="w-weather-btn active" data-weather="clear">Ясно</button>
          <button class="w-weather-btn" data-weather="rain">Питерский дождь</button>
          <button class="w-weather-btn" data-weather="snow">Снегопад</button>
          <button class="w-weather-btn" data-weather="fog">Туман над Невой</button>
          <button class="w-weather-btn" data-weather="storm">Гроза</button>
          <button class="w-weather-btn" data-weather="live">Онлайн погода</button>
        </div>

        <div class="w-dialog-section-title" style="margin-top: 14px;">ГИДРОЛОГИЯ И МОСТЫ НЕВЫ</div>
        <div class="w-preset-grid">
          <button class="w-hydro-btn active" data-level="0">Ординар (0 см)</button>
          <button class="w-hydro-btn" data-level="60">Подъем (+60 см)</button>
          <button class="w-hydro-btn" data-level="160">Наводнение (+160 см)</button>
        </div>

        <div class="w-bridge-row" style="margin-top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <button class="w-btn-action" id="w-bridge-toggle" style="flex: 1;">Развести Дворцовый мост (B)</button>
          <span class="w-bridge-status" id="w-bridge-status" style="font-size: 11px; padding: 5px 8px; border-radius: 4px; background: rgba(255,255,255,0.06); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.12);">Мосты сведены</span>
        </div>
      </div>
    `;
    this.container.appendChild(this.timeModal);

    const slider = this.timeModal.querySelector('#w-hour-slider') as HTMLInputElement;
    const clock = this.timeModal.querySelector('#w-time-clock') as HTMLElement;
    const chkWhite = this.timeModal.querySelector('#w-whitenight-chk') as HTMLInputElement;

    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value);
      this.sun.setTime(val);
      const h = Math.floor(val);
      const m = Math.floor((val - h) * 60);
      clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      this.timeModal.querySelectorAll('.w-preset-btn').forEach(b => b.classList.remove('active'));
    });

    chkWhite.addEventListener('change', () => {
      this.sun.forceWhiteNight = chkWhite.checked;
      this.sun.update();
    });

    // Time presets
    this.timeModal.querySelectorAll('.w-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.timeModal.querySelectorAll('.w-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tVal = btn.getAttribute('data-time')!;
        if (tVal === 'real') {
          this.sun.setRealtime();
          const d = new Date();
          const curH = d.getHours() + d.getMinutes() / 60;
          slider.value = curH.toFixed(2);
          clock.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        } else {
          const num = parseFloat(tVal);
          slider.value = num.toString();
          this.sun.setTime(num);
          const h = Math.floor(num);
          const m = Math.floor((num - h) * 60);
          clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
      });
    });

    // Weather presets
    this.timeModal.querySelectorAll('.w-weather-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.timeModal.querySelectorAll('.w-weather-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const wType = btn.getAttribute('data-weather') as any;
        this.weather.setManualWeather(wType);
      });
    });

    // Hydrology presets
    this.timeModal.querySelectorAll('.w-hydro-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.timeModal.querySelectorAll('.w-hydro-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const lvl = parseInt(btn.getAttribute('data-level')!, 10);
        this.water.setWaterLevel(lvl);
      });
    });

    // Bridge toggle
    const bridgeBtn = this.timeModal.querySelector('#w-bridge-toggle') as HTMLButtonElement;
    bridgeBtn.addEventListener('click', () => {
      this.bridges.toggleBridge();
    });

    this.timeModal.querySelector('#w-time-close')!.addEventListener('click', () => {
      this.toggleTimeModal(false);
    });
  }

  /**
   * About Project Dialog (Matching Warsaw-Izo Open Data Credits & Documentation)
   */
  private createAboutModal() {
    this.aboutModal = document.createElement('div');
    this.aboutModal.className = 'w-dialog w-about-dialog';
    this.aboutModal.innerHTML = `
      <div class="w-dialog-header">
        <div class="w-dialog-title">Санкт-Петербург Изометрический</div>
        <button class="w-dialog-close" id="w-about-close">✕</button>
      </div>
      <div class="w-dialog-body w-about-content">
        <p>Интерактивная изометрическая 3D пиксель-арт модель исторического центра Санкт-Петербурга, созданная по образцу <em>Warsaw-Izo</em> (Bedirhan Yıldırım) на основе открытых пространственных данных.</p>
        
        <h4>Данные карты (Map data)</h4>
        <p><strong>Улицы, здания, вода и места:</strong> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors (ODbL), <a href="https://data.gov.spb.ru/" target="_blank" rel="noopener">Портал открытых данных Санкт-Петербурга</a>.</p>
        <p><strong>3D-здания, деревья, рельеф и ортофото:</strong> <a href="https://rgis.spb.ru/" target="_blank" rel="noopener">РГИС Санкт-Петербурга</a> (Комитет по градостроительству и архитектуре СПб), Реестр ЗНОП Комитета по благоустройству, <a href="https://pkk.rosreestr.ru/" target="_blank" rel="noopener">Публичная кадастровая карта Росреестра</a>.</p>
        <p><strong>Аэропорт Пулково (LED / ULLI):</strong> Взлётно-посадочные полосы 10L/28R и 10R/28L, рулёжные дорожки и перроны по данным <a href="https://wiki.openstreetmap.org/wiki/Key:aeroway" target="_blank" rel="noopener">OpenStreetMap aeroway</a>; воздушное движение смоделировано процедурно.</p>

        <h4>Расписания транспорта (Timetables)</h4>
        <p><strong>Общественный транспорт:</strong> <a href="https://orgp.spb.ru/" target="_blank" rel="noopener">СПб ГКУ «Организатор перевозок»</a> и <a href="https://transport.orgp.spb.ru/" target="_blank" rel="noopener">Портал общественного транспорта СПб</a> (автобусы «Пассажиравтотранс», трамваи и троллейбусы «Горэлектротранс» через выгрузки GTFS).</p>
        <p><strong>Железнодорожные расписания:</strong> <a href="https://ppk-piter.ru/" target="_blank" rel="noopener">АО «СЗППК»</a> и <a href="https://rzd.ru/" target="_blank" rel="noopener">ОАО «РЖД»</a> (пригородные электропоезда и «Ласточки» с 5 вокзалов СПб); грузовые составы на соединительных путях смоделированы процедурно.</p>
        <p><strong>Разводка мостов и водные пути:</strong> <a href="https://mostotrest-spb.ru/" target="_blank" rel="noopener">СПб ГБУ «Мостотрест»</a> (официальный график навигационной разводки мостов через Неву), <a href="https://volgo-balt.ru/" target="_blank" rel="noopener">ФБУ «Администрация «Волго-Балт»</a> (судовой фарватер и скоростные СПК «Метеор»).</p>

        <h4>Погода и гидрология (Weather & Hydrology)</h4>
        <p><strong>Погода над Санкт-Петербургом:</strong> <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0; координаты Дворцовой площади 59.9398° N, 30.3146° E); другие даты используют симуляцию.</p>
        <p><strong>Уровень Невы и наводнения:</strong> Гидропост «Санкт-Петербург — Горный институт» <a href="https://meteo.nw.ru/" target="_blank" rel="noopener">ФГБУ «Северо-Западное УГМС»</a> (ординар нуля Кронштадтского футштока / Балтийской системы высот), штормовые пороги <a href="https://dambaspb.ru/" target="_blank" rel="noopener">Дамбы СПб (КЗС)</a>.</p>

        <h4>Программное обеспечение (Software)</h4>
        <p>Рендеринг на чистом <strong><a href="https://threejs.org/" target="_blank" rel="noopener">three.js</a></strong> (WebGL 3D-геометрия, шейдеры воды, карты теней 4096×4096). Модели архитектурных доминант — авторские цифровые интерпретации шедевров Растрелли, Росси, Монферрана, Трезини, Захарова, Тома де Томона, Парланда, а не официальные копии.</p>

        <h4>Управление</h4>
        <div class="w-shortcuts-grid">
          <div><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> / Мышь</div>
          <div>Перемещение по городу</div>
          <div><kbd>+</kbd> / <kbd>−</kbd> / Колесико</div>
          <div>Плавный зум</div>
          <div><kbd>Q</kbd> / <kbd>E</kbd></div>
          <div>Поворот изометрического ракурса на 45°</div>
          <div><kbd>F</kbd></div>
          <div>Симулятор полёта над городом</div>
          <div><kbd>T</kbd></div>
          <div>Освещение, погода и Нева</div>
          <div><kbd>B</kbd></div>
          <div>Разводка Дворцового моста</div>
          <div><kbd>Пробел</kbd> / <kbd>0</kbd></div>
          <div>Возврат к Дворцовой площади</div>
        </div>
      </div>
    `;
    this.container.appendChild(this.aboutModal);

    this.aboutModal.querySelector('#w-about-close')!.addEventListener('click', () => {
      this.toggleAboutModal(false);
    });
  }

  private createCinematicOverlay() {
    const cinemaBanner = document.createElement('div');
    cinemaBanner.className = 'w-cinema-banner';
    cinemaBanner.id = 'w-cinema-banner';
    cinemaBanner.style.display = 'none';
    cinemaBanner.innerHTML = `
      <div class="w-cinema-badge">КИНО-ТУР ПО ПЕТЕРБУРГУ</div>
      <div class="w-cinema-title" id="w-cinema-title">Дворцовая площадь</div>
      <div class="w-cinema-sub" id="w-cinema-sub">Александровская колонна и Зимний дворец</div>
      <button class="w-cinema-exit" id="w-cinema-exit">Выйти из тура (C)</button>
    `;
    this.container.appendChild(cinemaBanner);

    cinemaBanner.querySelector('#w-cinema-exit')!.addEventListener('click', () => {
      this.toggleCinematicMode(false);
    });
  }

  private createMinimalHudRestoreButton() {
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'w-restore-hud-btn';
    restoreBtn.id = 'w-restore-hud-btn';
    restoreBtn.style.display = 'none';
    restoreBtn.textContent = 'Показать интерфейс (H)';
    restoreBtn.addEventListener('click', () => {
      this.toggleMinimalHud(false);
    });
    this.container.appendChild(restoreBtn);
  }

  public toggleCinematicMode(force?: boolean) {
    const shouldActive = force !== undefined ? force : !this.camera.isCinematic;
    if (shouldActive) {
      this.camera.startCinematic();
    } else {
      this.camera.stopCinematic();
    }
  }

  public toggleMinimalHud(force?: boolean) {
    const isMin = force !== undefined ? force : !document.body.classList.contains('w-minimal-hud');
    document.body.classList.toggle('w-minimal-hud', isMin);
    const restoreBtn = document.getElementById('w-restore-hud-btn');
    if (restoreBtn) {
      restoreBtn.style.display = isMin ? 'block' : 'none';
    }
    const minBtn = document.getElementById('w-btn-minimal');
    if (minBtn) {
      minBtn.classList.toggle('active', isMin);
    }
  }

  public createPostcard() {
    const glCanvas = document.querySelector('canvas');
    if (!glCanvas) return;

    const postCanvas = document.createElement('canvas');
    postCanvas.width = 1920;
    postCanvas.height = 1080;
    const ctx = postCanvas.getContext('2d');
    if (!ctx) return;

    // Vintage warm linen passe-partout background
    ctx.fillStyle = '#f8f5ee';
    ctx.fillRect(0, 0, postCanvas.width, postCanvas.height);

    // Inner photo margin
    const margin = 44;
    const bottomBand = 90;
    const photoW = postCanvas.width - margin * 2;
    const photoH = postCanvas.height - margin * 2 - bottomBand;

    // Draw 3D scene
    ctx.drawImage(glCanvas, 0, 0, glCanvas.width, glCanvas.height, margin, margin, photoW, photoH);

    // Dual imperial frames (Brass/Gold and Charcoal)
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#c5a059';
    ctx.strokeRect(margin, margin, photoW, photoH);

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(25, 27, 32, 0.4)';
    ctx.strokeRect(margin - 6, margin - 6, photoW + 12, photoH + 12);

    // Vintage St. Petersburg Lettering
    ctx.fillStyle = '#1c1e22';
    ctx.font = 'bold 34px "Cinzel", "Playfair Display", "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('САНКТ-ПЕТЕРБУРГ', postCanvas.width / 2, postCanvas.height - 68);

    ctx.fillStyle = '#7a6b57';
    ctx.font = '500 16px "Georgia", serif';
    const distTitle = document.getElementById('w-district-title')?.textContent || 'ДВОРЦОВЫЙ ОКРУГ';
    ctx.fillText(`С ПРИВЕТОМ ИЗ СЕВЕРНОЙ СТОЛИЦЫ • ${distTitle.toUpperCase()} • ЛЕТО`, postCanvas.width / 2, postCanvas.height - 34);

    // Stylized postal cancellation stamp in bottom right
    const stampX = postCanvas.width - 160;
    const stampY = postCanvas.height - 52;
    ctx.strokeStyle = '#8c3a32';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(stampX, stampY, 32, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(stampX, stampY, 28, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#8c3a32';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('САНКТ-ПЕТЕРБУРГ', stampX, stampY - 14);
    ctx.fillText('ПОЧТА РОССИИ', stampX, stampY);
    ctx.fillText('190000', stampX, stampY + 14);

    // Wavy postmark lines
    for (let w = -2; w <= 2; w++) {
      ctx.beginPath();
      ctx.moveTo(stampX - 80, stampY + w * 6);
      ctx.bezierCurveTo(
        stampX - 60, stampY + w * 6 - 4,
        stampX - 50, stampY + w * 6 + 4,
        stampX - 35, stampY + w * 6
      );
      ctx.stroke();
    }

    // Trigger instant download
    const link = document.createElement('a');
    link.download = `saint-petersburg-postcard-${Date.now()}.png`;
    link.href = postCanvas.toDataURL('image/png');
    link.click();

    this.showToast('Открытка сохранена на устройство!');
  }

  public showToast(msg: string) {
    const toast = document.createElement('div');
    toast.className = 'w-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('w-toast-fade');
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }

  public toggleWhiteNightMode() {
    const isCurrentlyDay = (this.sun.manualTime ?? 12) >= 6 && (this.sun.manualTime ?? 12) <= 20;
    const nightBtn = document.getElementById('w-btn-night');
    if (isCurrentlyDay) {
      this.sun.forceWhiteNight = true;
      this.sun.setTime(23.5);
      if (nightBtn) nightBtn.classList.add('active');
      this.showToast('Режим «Белые ночи»: зажжена вечерняя иллюминация');
    } else {
      this.sun.forceWhiteNight = false;
      this.sun.setTime(13.75);
      if (nightBtn) nightBtn.classList.remove('active');
      this.showToast('Режим «Солнечный день»');
    }
  }

  public fireNoonCannon() {
    this.landmarks.fireNoonCannon();
    this.showToast('12:00 — Традиционный полуденный выстрел со стены Нарышкина бастиона!');
  }

  private setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      const key = e.key.toLowerCase();

      // Special hotkeys when flight simulator is active
      if (this.flight.isActive) {
        if (key === 'f' || key === 'escape') {
          this.toggleFlightMode(false);
          return;
        } else if (key === 'v') {
          const modeName = this.camera.cycleFlightCamera();
          const el = document.getElementById('w-flight-cam-val');
          if (el) el.textContent = modeName;
          this.showToast(`Ракурс камеры: ${modeName}`);
          return;
        } else if (key === 'i') {
          const isInverted = this.flight.toggleInvertPitch();
          const el = document.getElementById('w-flight-invert-val');
          if (el) el.textContent = isInverted ? 'Авиа' : 'Прямой';
          this.showToast(isInverted ? 'Режим тангажа: Авиационный (W = пикирование)' : 'Режим тангажа: Прямой (W = набор высоты)');
          return;
        } else if (key === 'm') {
          const isMouse = this.flight.toggleMouseControl();
          const el = document.getElementById('w-flight-mouse-val');
          if (el) el.textContent = isMouse ? 'Вкл' : 'Выкл';
          this.showToast(isMouse ? 'Управление мышью включено' : 'Управление мышью выключено');
          return;
        } else if (key === '+' || key === '=') {
          this.camera.zoomFlightIn();
          return;
        } else if (key === '-' || key === '_') {
          this.camera.zoomFlightOut();
          return;
        } else if (key === 'q' || key === 'e' || key === ' ' || key === 'w' || key === 's' || key === 'a' || key === 'd') {
          // Flight physics keys (boost, airbrake, steering) - do not trigger camera rotation or map zoom reset
          return;
        }
      }

      if (key === 'n') {
        this.toggleWhiteNightMode();
      } else if (key === 'c') {
        this.toggleCinematicMode();
      } else if (key === 'h') {
        this.toggleMinimalHud();
      } else if (key === 'p') {
        this.createPostcard();
      } else if (key === 'f') {
        this.toggleFlightMode();
      } else if (key === 't') {
        this.toggleTimeModal();
      } else if (key === 'b') {
        this.bridges.toggleBridge();
      } else if (key === 'k') {
        this.fireNoonCannon();
      } else if (key === 'q') {
        this.camera.rotateLeft();
      } else if (key === 'e') {
        this.camera.rotateRight();
      } else if (key === '+' || key === '=') {
        this.camera.zoomIn();
      } else if (key === '-' || key === '_') {
        this.camera.zoomOut();
      } else if (key === ' ' || key === '0') {
        this.camera.resetZoom();
      } else if (key === 'escape') {
        this.camera.stopCinematic();
        this.toggleMinimalHud(false);
        this.toggleTimeModal(false);
        this.toggleAboutModal(false);
        this.toggleQuickJump(false);
        this.closeLandmarkCard();
      }
    });
  }

  public selectLandmark(id: string, instant: boolean = false) {
    const lm = LANDMARK_DATA.find(x => x.id === id);
    if (!lm) return;

    this.activeLandmarkId = id;

    // Fly camera smoothly to landmark
    this.camera.flyTo(lm.coords.x, lm.coords.z, lm.zoom, instant);

    // Show Architectural Card
    this.showLandmarkCard(lm);
  }

  private showLandmarkCard(lm: LandmarkInfo) {
    this.landmarkCardEl.innerHTML = `
      <div class="w-card-header">
        <div class="w-card-badge">ПАМЯТНИК АРХИТЕКТУРЫ</div>
        <button class="w-card-close" id="w-card-close">✕</button>
      </div>
      <h3 class="w-card-title">${lm.name}</h3>
      <div class="w-card-meta">
        <div class="w-meta-row"><span class="w-meta-lbl">Стиль:</span> <span class="w-meta-val">${lm.style}</span></div>
        <div class="w-meta-row"><span class="w-meta-lbl">Зодчий:</span> <span class="w-meta-val">${lm.architect}</span></div>
        <div class="w-meta-row"><span class="w-meta-lbl">Постройка:</span> <span class="w-meta-val">${lm.years}</span></div>
      </div>
      <p class="w-card-desc">${lm.description}</p>
      <div class="w-card-actions">
        <button class="w-btn-action" id="w-card-focus">Приблизить фасад</button>
      </div>
    `;
    this.landmarkCardEl.style.display = 'block';

    this.landmarkCardEl.querySelector('#w-card-close')!.addEventListener('click', () => {
      this.closeLandmarkCard();
    });

    this.landmarkCardEl.querySelector('#w-card-focus')!.addEventListener('click', () => {
      this.camera.flyTo(lm.coords.x, lm.coords.z, 65);
    });
  }

  public closeLandmarkCard() {
    this.landmarkCardEl.style.display = 'none';
    this.activeLandmarkId = null;
  }

  public toggleTimeModal(force?: boolean) {
    this.isTimeModalOpen = force !== undefined ? force : !this.isTimeModalOpen;
    this.timeModal.classList.toggle('open', this.isTimeModalOpen);
  }

  public toggleAboutModal(force?: boolean) {
    const isOpen = this.aboutModal.classList.contains('open');
    this.aboutModal.classList.toggle('open', force !== undefined ? force : !isOpen);
  }

  public toggleQuickJump(force?: boolean) {
    this.isQuickJumpOpen = force !== undefined ? force : !this.isQuickJumpOpen;
    this.quickJumpModal.classList.toggle('open', this.isQuickJumpOpen);
  }

  /**
   * Called every frame in main render loop:
   * 1. Updates 3D POI marker positions projected to 2D screen space
   * 2. Updates current district plate
   * 3. Updates status bar coordinates & scale
   */
  public update() {
    const cam = this.camera.camera;
    const widthHalf = window.innerWidth / 2;
    const heightHalf = window.innerHeight / 2;

    // 1. Update 3D screen-projected yellow [i] markers
    const tempVec = new THREE.Vector3();
    for (const item of this.poiMarkers) {
      tempVec.set(item.lm.coords.x, item.lm.coords.y, item.lm.coords.z);
      tempVec.project(cam);

      // Check if marker is in front of camera
      const isVisible = tempVec.z < 1.0 && tempVec.x >= -1.1 && tempVec.x <= 1.1 && tempVec.y >= -1.1 && tempVec.y <= 1.1;

      if (isVisible) {
        const sx = (tempVec.x * widthHalf) + widthHalf;
        const sy = -(tempVec.y * heightHalf) + heightHalf;
        item.el.style.display = 'flex';
        item.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`;
      } else {
        item.el.style.display = 'none';
      }
    }

    // 2. Update dynamic district title plate based on camera position
    const tx = this.camera.currentTarget.x;
    const tz = this.camera.currentTarget.z;
    const distTitle = document.getElementById('w-district-title');
    const distSub = document.getElementById('w-district-sub');

    if (distTitle && distSub) {
      if (tx > 3600 && tz > 1500) {
        distTitle.textContent = 'Александро-Невский округ';
        distSub.textContent = 'Александро-Невская лавра • Монастырский остров';
      } else if (tx > 3000 && tz < 0) {
        distTitle.textContent = 'Смольнинский округ';
        distSub.textContent = 'Смольный собор • Таврический сад';
      } else if (tx > 1800 && tz > 500) {
        distTitle.textContent = 'Лиговский округ';
        distSub.textContent = 'Площадь Восстания • Московский вокзал';
      } else if (tx > 800 && tz > 300) {
        distTitle.textContent = 'Владимирский округ';
        distSub.textContent = 'Владимирский собор • Литейный проспект';
      } else if (tz < -600) {
        distTitle.textContent = 'Петроградская сторона';
        distSub.textContent = 'Петропавловская крепость • Санкт-Петербург';
      } else if (tx < -350 && tz < 0) {
        distTitle.textContent = 'Стрелка Васильевского острова';
        distSub.textContent = 'Василеостровский район • Санкт-Петербург';
      } else if (tx < -250 && tz > 200) {
        distTitle.textContent = 'Адмиралтейский округ';
        distSub.textContent = 'Исаакиевская площадь • Адмиралтейство';
      } else if (tx > 200 && tz > 250) {
        distTitle.textContent = 'Казанский округ';
        distSub.textContent = 'Невский проспект • Казанский собор';
      } else if (tx > 400 && tz < 200) {
        distTitle.textContent = 'Марсово поле и Летний сад';
        distSub.textContent = 'Спас на Крови • Центральный район';
      } else {
        distTitle.textContent = 'Дворцовый округ';
        distSub.textContent = 'Дворцовая площадь • Эрмитаж';
      }
    }

    // 3. Update Status Bar
    const statusLine = document.getElementById('w-status-line');
    const scaleText = document.getElementById('w-scale-text');
    if (statusLine) {
      const geo = metersToLatLon(tx, tz);
      const zoomIdx = Math.max(1, Math.min(5, Math.round(500 / this.camera.zoomLevel)));
      statusLine.textContent = `WASD: панорама • Q/E: поворот • ${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)} • zoom ${zoomIdx}`;
    }
    if (scaleText) {
      const metersPerPixel = (this.camera.zoomLevel * 2) / window.innerHeight;
      const scaleM = Math.round(metersPerPixel * 80);
      scaleText.textContent = `${scaleM} м`;
    }

    // 4. Update Flight HUD Telemetry and controls if flight mode is active
    if (this.flight.isActive) {
      const stats = this.flight.getFlightStats();
      const spdEl = document.getElementById('w-flight-speed');
      const altEl = document.getElementById('w-flight-alt');
      const thrEl = document.getElementById('w-flight-throttle');
      const vspeedEl = document.getElementById('w-flight-vspeed');
      const zoomValEl = document.getElementById('w-flight-zoom-val');
      const camEl = document.getElementById('w-flight-cam-val');
      const invEl = document.getElementById('w-flight-invert-val');
      const msEl = document.getElementById('w-flight-mouse-val');

      if (spdEl) spdEl.textContent = `${stats.speedKmh} км/ч`;
      if (altEl) altEl.textContent = `${stats.altitudeMeters} м`;
      if (thrEl) thrEl.textContent = `${stats.throttlePct}%`;
      if (vspeedEl) {
        const sign = stats.vSpeedMs > 0 ? '+' : '';
        vspeedEl.textContent = `${sign}${stats.vSpeedMs.toFixed(1)} м/с`;
      }
      if (zoomValEl) zoomValEl.textContent = `${this.camera.getFlightZoomPercent()}%`;
      if (camEl) camEl.textContent = this.camera.getFlightCameraModeName();
      if (invEl) invEl.textContent = stats.invertPitch ? 'Авиа' : 'Прямой';
      if (msEl) msEl.textContent = stats.mouseControl ? 'Вкл' : 'Выкл';
    }

    // 5. Update Bridge Status Badge in Modal if visible
    const bridgeStatusEl = document.getElementById('w-bridge-status');
    const bridgeToggleBtn = document.getElementById('w-bridge-toggle');
    if (bridgeStatusEl && bridgeToggleBtn) {
      if (this.bridges.areOpen) {
        bridgeStatusEl.textContent = 'Мосты разведены';
        bridgeStatusEl.style.color = '#e5a93b';
        bridgeStatusEl.style.borderColor = '#e5a93b';
        bridgeToggleBtn.textContent = 'Свести Дворцовый мост (B)';
      } else {
        bridgeStatusEl.textContent = 'Мосты сведены';
        bridgeStatusEl.style.color = '#94a3b8';
        bridgeStatusEl.style.borderColor = 'rgba(255,255,255,0.12)';
        bridgeToggleBtn.textContent = 'Развести Дворцовый мост (B)';
      }
    }
  }
}
