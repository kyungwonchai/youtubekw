import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const YOUTUBE_FILE = '/home/kw/.kwsoft-youtube-links.json';
const WEEKLY_FILE = '/home/kw/.kwsoft-youtube-weekly.json';
const SPEAKERS_FILE = '/home/kw/.kwsoft-youtube-speakers.json';
const BLACKLIST_FILE = '/home/kw/.kwsoft-youtube-blacklist.json';

/**
 * Permanent Blacklist Management (절대비추 / 영구 차단 목록)
 */
export function loadBlacklist() {
  if (!existsSync(BLACKLIST_FILE)) {
    return { channels: [], speakers: [], videoIds: [], keywords: [] };
  }
  try {
    const raw = readFileSync(BLACKLIST_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      channels: Array.isArray(data.channels) ? data.channels : [],
      speakers: Array.isArray(data.speakers) ? data.speakers : [],
      videoIds: Array.isArray(data.videoIds) ? data.videoIds : [],
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
    };
  } catch (e) {
    return { channels: [], speakers: [], videoIds: [], keywords: [] };
  }
}

export function saveBlacklist(data) {
  try {
    writeFileSync(BLACKLIST_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[Blacklist] Save error:', e.message);
    return false;
  }
}

/**
 * Block a video permanently (절대안봄 / 해당 영상 비추천 영구 등록)
 */
export function blockVideoOrSpeaker({ videoId, channelTitle, title, speakerName } = {}) {
  const bl = loadBlacklist();
  let modified = false;

  if (videoId && !bl.videoIds.includes(videoId)) {
    bl.videoIds.push(videoId);
    modified = true;
  }

  // Only block speaker if explicitly provided (not automatic from title)
  if (speakerName && typeof speakerName === 'string' && speakerName.trim()) {
    const cleanSp = speakerName.trim();
    if (!bl.speakers.includes(cleanSp)) {
      bl.speakers.push(cleanSp);
      modified = true;
    }
  }

  if (modified) {
    saveBlacklist(bl);
  }

  // Purge the blocked video from current youtube links
  const store = loadYouTubeData();
  const beforeLen = store.items.length;
  store.items = store.items.filter(item => !isBlacklisted(item.title, item.description, item.channelTitle, item.videoId));
  if (store.items.length !== beforeLen) {
    saveYouTubeData(store);
  }

  return { ok: true, blacklist: bl, purgedCount: beforeLen - store.items.length };
}

/**
 * Check if an item matches the permanent blacklist (영상 ID 기반 절대안봄 + 수동 지정 키워드)
 */
export function isBlacklisted(title = '', desc = '', channelTitle = '', videoId = '') {
  const bl = loadBlacklist();
  if (videoId && bl.videoIds.includes(videoId)) return true;

  const combined = `${title} ${desc} ${channelTitle}`.toLowerCase();
  
  for (const chan of bl.channels) {
    if (chan && channelTitle.toLowerCase().includes(chan.toLowerCase())) return true;
  }

  for (const sp of bl.speakers) {
    if (!sp || sp.length < 2) continue;
    const lower = sp.toLowerCase();
    const regex = new RegExp(`(?:^|[^a-z0-9])${lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9])`, 'i');
    if (regex.test(combined)) return true;
  }

  for (const kw of bl.keywords) {
    if (kw && combined.includes(kw.toLowerCase())) return true;
  }

  return false;
}

/**
 * Load all speakers (base pool + dynamically discovered ace speakers)
 */
export function loadAllSpeakers() {
  let customSpeakers = [];
  if (existsSync(SPEAKERS_FILE)) {
    try {
      const raw = readFileSync(SPEAKERS_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) customSpeakers = data;
    } catch (e) {}
  }
  const map = new Map();
  MENTOR_SPEAKER_POOL.forEach(s => map.set(s.id, s));
  customSpeakers.forEach(s => map.set(s.id, s));
  return Array.from(map.values());
}

export function saveCustomSpeakers(speakers) {
  try {
    writeFileSync(SPEAKERS_FILE, JSON.stringify(speakers, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 2 Main Categories Focus: TED 강연 vs 에세이 & 마인드셋
 */
export const CURATION_CHANNELS = [
  {
    id: 'all',
    label: '✨ 전체 추천 영상',
    shortLabel: '전체 추천',
    target: '최근 2~3년 이내 밝고 지적인 여성 리더·명사들의 명품 TED 강연 및 인생 가치관·마인드셋 쉐도잉',
    icon: '✨',
    desc: '스피치 훈련 & 영어 쉐도잉에 최적화된 유창하고 또렷한 딕션의 명사 강연 및 에세이',
    category: 'all',
    defaultTags: ['명품딕션', '롤모델스피치', '기업가정신', '쉐도잉최적'],
  },
  {
    id: 'ted_speech',
    label: '🎤 TED & 명품 강연',
    shortLabel: 'TED & 명연설',
    target: 'TED, TEDx, 명문대 졸업사, 기조연설 등 대중 스피치 마스터클래스',
    icon: '🎤',
    desc: '전달력과 발음이 탁월한 젊은 여성 리더 및 명사들의 압도적인 TED/TEDx 및 대중 강연',
    category: 'ted_speech',
    defaultTags: ['TED강연', 'TEDx', '명연설', '스피치훈련'],
  },
  {
    id: 'essay_deep',
    label: '📚 에세이 & 마인드셋',
    shortLabel: '에세이 & 마인드',
    target: '기업가정신, 인생 가치관, 삶의 태도, 성공 경험담 및 심층 대담',
    icon: '📚',
    desc: '성공한 젊은 여성 CEO/투자자/학자들의 비즈니스 마인드셋, 3-2-1 스피치 기법, 삶을 살아가는 법',
    category: 'essay_deep',
    defaultTags: ['기업가정신', '인생가치관', '경험담', '고급에세이'],
  },
];

/**
 * Inspiring Role Model Mentor Speakers Pool (존경받는 젊은 여성 명사 & CEO 인재풀)
 */
export const MENTOR_SPEAKER_POOL = [
  {
    id: 'lucy_guo',
    name: 'Lucy Guo',
    role: 'Passes & Scale AI 창업가 (포브스 30대 이하 최연소 억만장자)',
    category: 'essay_deep',
    avatar: '⚡',
    badge: '🔥 20대 테크 에이스',
    dictionStyle: '극도로 빠른 템포와 거침없는 비즈니스 결단력, 실리콘밸리 CEO 딕션',
    coreTopics: '창업 실행력, 20대 자수성가, 실패를 두려워하지 않는 공격적 마인드',
    keywords: ['Lucy Guo interview tech founder', 'Lucy Guo Scale AI Passes speech', 'Lucy Guo founder mindset advice'],
  },
  {
    id: 'whitney_wolfe_herd',
    name: 'Whitney Wolfe Herd',
    role: 'Bumble 최연소 여성 억만장자 창업가 & CEO',
    category: 'essay_deep',
    avatar: '🐝',
    badge: '🌟 유니콘 신화',
    dictionStyle: '우아하면서도 단단한 카리스마, 설득력 높은 비즈니스 피칭',
    coreTopics: '거절 극복, 여성 주도적 플랫폼 창업, 20대 리더십',
    keywords: ['Whitney Wolfe Herd keynote speech', 'Whitney Wolfe Herd interview advice', 'Whitney Wolfe Herd commencement speech'],
  },
  {
    id: 'liv_boeree',
    name: 'Liv Boeree',
    role: '케임브리지 물리학 & 세계 챔피언 포커 플레이어·게임이론가',
    category: 'ted_speech',
    avatar: '🎯',
    badge: '🧠 게임이론/의사결정',
    dictionStyle: '날카롭고 지적인 영국식 고급 딕션, 빈틈없는 논리 전개',
    coreTopics: '게임이론, 확률적 사고, 불확실성 속 최고의 의사결정',
    keywords: ['Liv Boeree TED talk speech', 'Liv Boeree decision making game theory', 'Liv Boeree podcast talk'],
  },
  {
    id: 'codie_sanchez',
    name: 'Codie Sanchez',
    role: '성공 투자자 & Contrarian Thinking 창업가',
    category: 'essay_deep',
    avatar: '💼',
    badge: '💎 3-2-1 스피치 마스터',
    dictionStyle: '직설적이고 빠른 템포의 CEO급 비즈니스 딕션, 3-2-1 스피치 기법',
    coreTopics: '자본주의 마인드셋, 기업가정신, 실행력, 스피치 구조화',
    keywords: ['Codie Sanchez speech', 'Codie Sanchez speaking trick', 'Codie Sanchez mindset advice', 'BigDeal Codie Sanchez'],
  },
  {
    id: 'leila_hormozi',
    name: 'Leila Hormozi',
    role: 'Acquisition.com CEO & 경영 리더',
    category: 'essay_deep',
    avatar: '👑',
    badge: '👑 고성과 리더십',
    dictionStyle: '당당하고 확신에 찬 에너지, 또렷하고 단호한 발음',
    coreTopics: '사업 확장, 리더십, 극복의 경험담, 여성 CEO 마인드셋',
    keywords: ['Leila Hormozi speech', 'Leila Hormozi interview advice', 'Leila Hormozi leadership talk'],
  },
  {
    id: 'melanie_perkins',
    name: 'Melanie Perkins',
    role: 'Canva 공동창업자 & 글로벌 CEO',
    category: 'essay_deep',
    avatar: '🎨',
    badge: '🚀 글로벌 유니콘 CEO',
    dictionStyle: '또렷하고 명확한 호주식 고급 딕션, 열정과 비전이 담긴 스피치',
    coreTopics: '100번의 거절을 딛고 일어선 끈기, 글로벌 제품 빌딩, 창업가 마인드',
    keywords: ['Melanie Perkins Canva speech interview', 'Melanie Perkins founder story mindset', 'Melanie Perkins keynote talk'],
  },
  {
    id: 'grace_beverley',
    name: 'Grace Beverley',
    role: 'TALA & Shreddy 20대 창업가 / 옥스퍼드 출신 비즈니스 리더',
    category: 'essay_deep',
    avatar: '🏆',
    badge: '🇬🇧 20대 생산성 에이스',
    dictionStyle: '유려하고 빠른 영국식 RP 딕션, 체계적인 논리와 에너지',
    coreTopics: '20대 사업 성공, 워크-라이프 생산성, 소셜미디어 제국 구축',
    keywords: ['Grace Beverley productivity speech', 'Grace Beverley founder interview talk', 'Grace Beverley Oxford talk'],
  },
  {
    id: 'erika_kullberg',
    name: 'Erika Kullberg',
    role: '변호사 & Plug 창업가',
    category: 'essay_deep',
    avatar: '⚖️',
    badge: '⚖️ 스마트 협상가',
    dictionStyle: '깔끔하고 명료한 논리 전개, 한 음절 한 음절 정확한 딕션',
    coreTopics: '협상 스킬, 스마트한 마인드셋, 20대 커리어 성장',
    keywords: ['Erika Kullberg interview speech', 'Erika Kullberg talk mindset', 'Erika Kullberg speech career'],
  },
  {
    id: 'maya_shankar',
    name: 'Dr. Maya Shankar',
    role: '인지과학자 (옥스퍼드/스탠퍼드) & 전 백악관 선임고문',
    category: 'essay_deep',
    avatar: '✨',
    badge: '🧠 뇌과학 & 딥토크',
    dictionStyle: '지적이고 정돈된 표준 미국식 발음, 차분하면서도 깊은 울림의 딕션',
    coreTopics: '삶의 변화, 정체성 재정의, 가치관, 딥 인터뷰',
    keywords: ['Maya Shankar podcast talk', 'Maya Shankar change mind speech', 'Maya Shankar interview values'],
  },
  {
    id: 'jess_ekstrom',
    name: 'Jess Ekstrom',
    role: 'Headbands of Hope 창업자 & TEDx 명연설가',
    category: 'ted_speech',
    avatar: '🎤',
    badge: '🎤 스토리텔링 정수',
    dictionStyle: '감정을 울리는 스토리텔링과 완벽한 호흡 조절',
    coreTopics: '스토리텔링, 대중 연설, 소셜 벤처 기업가정신',
    keywords: ['Jess Ekstrom TEDx talk', 'Jess Ekstrom public speaking speech', 'Jess Ekstrom presentation'],
  },
  {
    id: 'mira_murati',
    name: 'Mira Murati',
    role: '전 OpenAI CTO & 테크 엔지니어링 리더',
    category: 'essay_deep',
    avatar: '🤖',
    badge: '🚀 차세대 AI 리더',
    dictionStyle: '차분하고 정밀한 테크 리더십 스피치, 미래 비전 전달',
    coreTopics: '기술의 미래, AI 리더십, 혁신을 이끄는 마인드셋',
    keywords: ['Mira Murati interview keynote talk', 'Mira Murati AI speech leadership', 'Mira Murati keynote speech'],
  },
  {
    id: 'alex_cooper',
    name: 'Alex Cooper',
    role: 'Unwell Network 대표 & 20대 미디어 기업가',
    category: 'essay_deep',
    avatar: '🎙️',
    badge: '🔥 20대 미디어 제국',
    dictionStyle: '파격적인 자신감과 에너지, 상대를 무장해제시키는 스피치',
    coreTopics: '자기 확신, 협상력, 20대 거대 미디어 비즈니스 구축',
    keywords: ['Alex Cooper business interview speech', 'Alex Cooper media network talk', 'Alex Cooper Forbes talk'],
  },
];

// Targeted queries focused strictly on bright, young, inspiring female speakers, diverse TED topics, and elite diction essays
const SEARCH_QUERIES = [
  // 1. Core TED & TEDx Talks by Inspiring, Articulate Young Women (Life, Travel, Climate, Family, Hobbies, Film, Music, Culture, Speech, Confidence, Ambition)
  'TED talk young woman travel life adventure clear english speech',
  'TED talk young female climate change nature future speech',
  'TED talk woman life philosophy family relationships clear speech',
  'TEDx talk young woman hobbies creativity passion storytelling',
  'TED talk female film cinema art culture english diction speech',
  'TED talk young woman music psychology sound emotion speech',
  'TED talk female public speaking confidence stage presence',
  'TEDx talk young woman ambition desire success mindset speech',
  'TED talk inspiring young woman clear english diction speech',
  'TED talk female psychology mindset clear english pronunciation',
  'TED talk female leadership resilience storytelling speech',
  'TEDx talk young woman confidence public speaking storytelling',
  'TED talk woman brain science communication speech',
  'TED talk inspiring female founder mindset lesson',
  'TED talk female productivity habits clear speech english',
  'TEDx talk young woman overcoming obstacles resilience speech',
  'TED talk female storytelling public speaking masterclass',
  
  // 2. High-Diction Speeches, University Commencements & Presentations
  'commencement speech inspiring young female clear english',
  'inspiring speech young woman life advice clear pronunciation',
  'best speeches by women clear english diction presentation',
  'Oxford Union speech articulate inspiring young woman',
  'female university student commencement speech inspiring',
  'inspiring keynote speech young female founder mindset',
  'great speeches by young women clear diction english',
  
  // 3. Top-Tier Young Ace Mentors & Role Models
  'Liv Boeree TED talk decision making game theory speech',
  'Whitney Wolfe Herd Bumble founder commencement speech',
  'Melanie Perkins Canva founder speech keynote lesson',
  'Grace Beverley productivity business speech Oxford talk',
  'Codie Sanchez speaking trick CEO communication',
  'Codie Sanchez mindset business advice speech',
  'Leila Hormozi leadership talk clear diction advice',
  'Erika Kullberg speech career negotiation mindset',
  'Dr Maya Shankar change mind deep talk values',
  'Jess Ekstrom TEDx talk public speaking story',
  'Kat Cole TED talk leadership hot shot rule speech',
  'Sarah Crawford-Bohl TED talk speaking up'
];

/**
 * Filter keywords
 */
const MALE_KEYWORDS = [
  '남자', '남성', 'male', 'guy', 'guys', 'husband', 'boyfriend', 'boy', 'boys', 'bro', 'bros',
  'father', 'dad', 'brother', 'son', 'gentleman', 'gentlemen', 'he', 'his', 'him', 'mr.', 'mr ', 'sir', 'himself',
  'jack', 'john', 'david', 'michael', 'james', 'robert', 'william', 'thomas', 'daniel', 'matthew',
  'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua', 'kenneth', 'kevin', 'brian',
  'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas',
  'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon', 'benjamin', 'samuel', 'gregory',
  'alexander', 'patrick', 'frank', 'raymond', 'dennis', 'jerry', 'tyler', 'aaron', 'jose',
  'adam', 'nathan', 'henry', 'douglas', 'zachary', 'peter', 'kyle', 'walter', 'ethan', 'jeremy',
  'harold', 'keith', 'christian', 'roger', 'noah', 'gerald', 'carl', 'terry', 'sean', 'austin',
  'arthur', 'lawrence', 'jesse', 'dylan', 'bryan', 'joe', 'jordan', 'billy', 'bruce', 'albert',
  'willie', 'gabriel', 'logan', 'alan', 'juan', 'wayne', 'roy', 'ralph', 'randy', 'eugene',
  'vincent', 'russell', 'louis', 'philip', 'bobby', 'johnny', 'bradley', 'martin', 'neil', 'luke',
  'elliott', 'elliot', 'liam', 'oliver', 'lucas', 'mason', 'sebastian', 'owen',
  'theodore', 'wyatt', 'jayden', 'matteo', 'julian', 'leo', 'ezra', 'harrison',
  'pewdiepie', 'clint', 'steve', 'mike', 'dave', 'tom', 'chris', 'dan', 'matt', 'sam', 'ian',
  'shetty', 'abdaal', 'charles', 'moseley', 'roland frasier', 'simon sinek', 'huberman', 'peterson',
  'jensen huang', 'shashi tharoor', 'konstantin kisin', 'mehdi hasan', 'raj persaud'
];

const TRASH_KEYWORDS = [
  // Banned or low-quality speakers / filters
  'mel robbins', 'cleo abram', 'vanessa van edwards', 'dr. justin moseley', 'moseley',
  'black woman', 'black female', 'african', 'olamide olowe', 'chidera eggerue', 'kamala harris',
  'grandma', 'elderly', 'wrinkle', 'senior citizen', 'old woman', 'old lady', '70-year', '80-year', '90-year',
  'wrinkles', 'aging skin', 'grandparent', 'retiree',

  // 집안일 / 청소 / 잡담 단순노동
  '집청소', '청소업체', '쓰레기집', '특수청소', '청소', '극혐', 'hoarder', 'cleaning extreme',
  'dirty room', 'cleaning dirty', 'cleaning motivation', 'deep clean dirty', 'filthy',
  '설거지', '설겆이', 'dishwashing', 'dishes', 'wash dishes', 'housework', 'chores', 'room tour clean',
  'tidy up', 'declutter', 'house cleaning', 'cleaning routine', 'clean with me',
  'speed clean', 'clean my room', 'kitchen clean', 'bathroom clean', 'laundry', '빨래',

  // AI 보이스 / 버추얼
  'ai voice', 'ai generated', 'ai avatar', 'virtual', 'vtuber', 'animation', 'anime', 'cartoon', 'synth', 'text to speech', 'tts', 'bot',
  'manga', 'manhwa', 'comic', 'webtoon', 'faceless', 'no face',

  // 한국어/동양어권 (영어 학습용이므로 제외)
  'korean', 'vlog in korea', 'korea vlog', 'seoul vlog', '한국', '브이로그', '일상', '취준생',
  'k-pop', 'kpop', 'kdrama', 'chinese', 'mandarin', 'taiwanese', 'china', 'taiwan', 'hong kong',
  '中文', '汉语', '普通话', '台灣', '中国', '香港', '중국어', '대만', 'japanese', 'japan vlog', 'tokyo vlog',

  // 무음 / 비언어 콘텐츠
  '요가', 'yoga', 'pilates', '필라테스', 'stretching', '스트레칭', 'workout', 'exercise', 'fitness routine', 'home workout',
  'mukbang', '먹방', 'asmr no talking', 'no talking', 'silent vlog', 'silent reading', 'study with me', 'no voice',
  'shorts', '#shorts', 'clickbait', 'nsfw', '18+', 'gossip', 'drama', 'exposed', 'ambient sound', 'white noise',
  'crime scene', 'infestation', 'cockroach', 'maggot', 'bugs', 'brawl', 'fight'
];

/**
 * Check if content contains any trash/banned keywords
 */
export function isTrashContent(title = '', desc = '', channelTitle = '') {
  const text = `${title} ${desc} ${channelTitle}`.toLowerCase();
  const cTitle = (channelTitle || '').toLowerCase();

  // 1. Check Korean Characters in Channel or Title
  if (/[가-힣]/.test(cTitle)) return true;
  const koreanCount = (title.match(/[가-힣]/g) || []).length;
  if (koreanCount > 3) return true;

  // 2. Check Chinese & Japanese
  if (/[\u4e00-\u9fa5]/.test(text) || /[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
    return true;
  }

  // 3. Trash keywords
  for (const kw of TRASH_KEYWORDS) {
    const lowerKw = kw.trim().toLowerCase();
    if (!lowerKw) continue;
    if (/^[a-z0-9. ]+$/.test(lowerKw) && lowerKw.length <= 15) {
      const escaped = lowerKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
      if (regex.test(text)) return true;
    } else {
      if (text.includes(lowerKw)) return true;
    }
  }

  return false;
}

/**
 * Parse duration string ("14:20", "1:02:15") to total seconds
 */
export function parseDurationInSeconds(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  const parts = durationStr.trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * Require at least 3 minutes (180 seconds) for shadowing / speech
 */
export function isGoodShadowingLength(durationStr) {
  if (!durationStr) return true;
  const secs = parseDurationInSeconds(durationStr);
  return secs >= 180; // >= 3 min
}

/**
 * Check upload date strictly within 5 years (reject anything > 5 years)
 */
export function isWithin5Years(publishedText = '') {
  if (!publishedText) return true;
  const p = publishedText.toLowerCase().trim();
  
  // Shorthand formats: "13y ago", "6mo ago", "3d ago", "2w ago"
  const shortYearMatch = p.match(/(\d+)\s*y(?:ear)?s?(?:\s*ago)?/);
  if (shortYearMatch) {
    const years = parseInt(shortYearMatch[1], 10);
    return years <= 5;
  }

  // Korean year match: "13년 전"
  const krYearMatch = p.match(/(\d+)\s*년/);
  if (krYearMatch) {
    const years = parseInt(krYearMatch[1], 10);
    return years <= 5;
  }

  // If text has hours, minutes, seconds, days, weeks, months without 'year' or 'y ago', it's recent
  if (
    p === 'recently' ||
    p.includes('hour') || p.includes('minute') || p.includes('second') ||
    p.includes('day') || p.includes('week') || p.includes('month') || p.includes('mo ago') ||
    p.includes('방금') || p.includes('시간') || p.includes('분') || p.includes('일') || p.includes('주') || p.includes('개월') || p.includes('달')
  ) {
    return true;
  }

  return true;
}

export const isWithin3Years = isWithin5Years;

/**
 * Load YouTube links data from local JSON database
 */
export function loadYouTubeData() {
  if (!existsSync(YOUTUBE_FILE)) {
    saveYouTubeData({ lastCuratedAt: Date.now(), lastQuery: '', items: [] });
    return { lastCuratedAt: Date.now(), lastQuery: '', items: [] };
  }
  try {
    const raw = readFileSync(YOUTUBE_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items)) {
      return { lastCuratedAt: Date.now(), lastQuery: '', items: [] };
    }
    return data;
  } catch (e) {
    console.error('[YouTube Control] Error reading file:', e.message);
    return { lastCuratedAt: Date.now(), lastQuery: '', items: [] };
  }
}

/**
 * Save YouTube links data
 */
export function saveYouTubeData(data) {
  try {
    writeFileSync(YOUTUBE_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[YouTube Control] Error writing file:', e.message);
    return false;
  }
}

/**
 * Weekly Wednesday Archive Data Loader
 */
export function loadWeeklyData() {
  if (!existsSync(WEEKLY_FILE)) {
    const initial = {
      lastMeetingAt: null,
      sessions: [
        {
          id: 'session_2026_w38',
          date: '2026-09-23',
          weekLabel: '2026년 9월 4주차',
          meetingTitle: '🎙️ 젊은 여성 CEO 스피치 기법 & 인생 가치관 멘토링 회의',
          agenda: 'Codie Sanchez의 3-2-1 스피치 구조화, Leila Hormozi의 실행력 마인드셋 및 TEDx 스토리텔링 훈련',
          speakerHighlights: [
            { name: 'Codie Sanchez', point: 'CEO처럼 명확하게 말하는 3-2-1 스피치 공식 (불필요한 군더더기 제거)' },
            { name: 'Whitney Wolfe Herd', point: '최연소 여성 유니콘 창업가의 우아하고 단단한 카리스마 스피치' },
            { name: 'Maya Shankar', point: '인생의 급격한 전환점에서 가치관을 정립하고 단단해지는 법' },
          ],
          summary: '금주 회의에서는 청중을 단숨에 사로잡는 빠른 템포의 비즈니스 딕션과 깊이 있는 인생 에세이를 엄선하여 추천 목록을 확정하였습니다.',
          videos: [
            {
              id: 'w_vid_1',
              title: 'Stop Rambling: The 3-2-1 Speaking Trick That Makes You Sound Like A CEO',
              channelTitle: 'BigDeal by Codie Sanchez',
              url: 'https://www.youtube.com/watch?v=t260757b_vU',
              thumbnailUrl: 'https://i.ytimg.com/vi/t260757b_vU/hqdefault.jpg',
              duration: '12:45',
              shadowingTip: '말의 서두에 핵심 결론을 3가지로 압축해 던지는 훈련에 집중하세요.',
              category: 'essay_deep',
            },
            {
              id: 'w_vid_2',
              title: 'The Secret to Great Public Speaking (No, It\'s Not Confidence) | Jess Ekstrom | TEDx',
              channelTitle: 'TEDx Talks',
              url: 'https://www.youtube.com/watch?v=MT2q1YKZQPE',
              thumbnailUrl: 'https://img.youtube.com/vi/MT2q1YKZQPE/hqdefault.jpg',
              duration: '8:19',
              shadowingTip: '자신감이 아닌 호기심과 스토리텔링으로 청중의 주의를 집중시키는 억양을 모방하세요.',
              category: 'ted_speech',
            },
            {
              id: 'w_vid_3',
              title: 'How to talk to the worst parts of yourself | Karen Faith | TEDxKC',
              channelTitle: 'TEDx Talks',
              url: 'https://www.youtube.com/watch?v=gUV5DJb6KGs',
              thumbnailUrl: 'https://img.youtube.com/vi/gUV5DJb6KGs/hqdefault.jpg',
              duration: '14:32',
              shadowingTip: '자기 수용과 내면 대화에 대한 명확한 포즈(pause)와 강세 훈련에 최적입니다.',
              category: 'ted_speech',
            },
          ]
        }
      ]
    };
    saveWeeklyData(initial);
    return initial;
  }
  try {
    const raw = readFileSync(WEEKLY_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { lastMeetingAt: null, sessions: [] };
  }
}

export function saveWeeklyData(data) {
  try {
    writeFileSync(WEEKLY_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Extract 11-char YouTube Video ID
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  const str = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

/**
 * Get YouTube links with filtering and sorting
 */
export function getYouTubeLinks({ filter = 'all', category = 'all', search = '' } = {}) {
  const store = loadYouTubeData();
  let list = store.items || [];

  // Normalize existing legacy categories to the 2 main categories
  list.forEach(item => {
    if (item.category === 'education_sci' || item.category === 'career_mind' || item.category === 'diction_essay') {
      item.category = 'essay_deep';
    }
  });

  if (filter === 'bookmarked') {
    list = list.filter(item => item.bookmarked);
  } else if (filter === 'unbookmarked') {
    list = list.filter(item => !item.bookmarked);
  }

  if (category && category !== 'all') {
    list = list.filter(item => item.category === category);
  }

  if (search && search.trim()) {
    const q = search.toLowerCase().trim();
    list = list.filter(item => {
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchChannel = item.channelTitle?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      return matchTitle || matchChannel || matchDesc;
    });
  }

  list.sort((a, b) => {
    if (a.bookmarked && !b.bookmarked) return -1;
    if (!a.bookmarked && b.bookmarked) return 1;
    return (b.addedAt || 0) - (a.addedAt || 0);
  });

  return {
    items: list,
    total: store.items.length,
    filteredCount: list.length,
    watchLaterCount: store.items.filter(i => i.bookmarked).length,
    lastCuratedAt: store.lastCuratedAt || null,
    lastQuery: store.lastQuery || '',
    channels: CURATION_CHANNELS,
    speakers: loadAllSpeakers(),
  };
}

/**
 * Toggle bookmark
 */
export function toggleYouTubeBookmark(id) {
  const store = loadYouTubeData();
  const item = store.items.find(i => i.id === id);
  if (!item) throw new Error('항목을 찾을 수 없습니다.');
  item.bookmarked = !item.bookmarked;
  item.bookmarkedAt = item.bookmarked ? Date.now() : null;
  item.updatedAt = Date.now();
  saveYouTubeData(store);
  return item;
}

/**
 * Delete a YouTube link
 */
export function deleteYouTubeLink(id) {
  const store = loadYouTubeData();
  const beforeLen = store.items.length;
  store.items = store.items.filter(i => i.id !== id);
  if (store.items.length === beforeLen) throw new Error('삭제할 항목이 없습니다.');
  saveYouTubeData(store);
  return true;
}

/**
 * Clear unbookmarked links
 */
export function clearUnbookmarkedLinks() {
  const store = loadYouTubeData();
  const bookmarkedItems = store.items.filter(i => i.bookmarked);
  const removedCount = store.items.length - bookmarkedItems.length;
  store.items = bookmarkedItems;
  saveYouTubeData(store);
  return { removedCount, preservedBookmarkedCount: bookmarkedItems.length };
}

/**
 * Dynamically add a YouTube link with automatic metadata fetching & instant bookmark
 */
export async function addYouTubeLink({ url, autoBookmark = true, category = 'essay_deep' } = {}) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error('유효한 유튜브 주소(URL)를 입력해주세요.');
  }

  const videoId = extractYouTubeId(url.trim());
  if (!videoId) {
    throw new Error('올바른 유튜브 영상 URL이나 비디오 ID 형식이 아닙니다.');
  }

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const store = loadYouTubeData();

  // Check if item already exists
  const existingIndex = store.items.findIndex(i => i.videoId === videoId || i.url === canonicalUrl);
  if (existingIndex >= 0) {
    const existing = store.items[existingIndex];
    if (autoBookmark) {
      existing.bookmarked = true;
      existing.bookmarkedAt = Date.now();
    }
    existing.updatedAt = Date.now();
    // Bring to top
    store.items.splice(existingIndex, 1);
    store.items.unshift(existing);
    saveYouTubeData(store);
    return { item: existing, isNew: false };
  }

  // Fetch title & channel name via YouTube oEmbed API
  let title = `유튜브 영상 (${videoId})`;
  let channelTitle = 'YouTube / 직접추가';
  let thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
    const res = await fetch(oembedUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.title) title = data.title;
      if (data.author_name) channelTitle = data.author_name;
      if (data.thumbnail_url) thumbnailUrl = data.thumbnail_url;
    }
  } catch (err) {
    console.warn('[AddYouTubeLink] oEmbed fetch failed, using fallback metadata:', err.message);
  }

  const detectedCategory = determineCategory(title, '');
  const now = Date.now();

  const newItem = {
    id: 'yt_user_' + now + '_' + Math.random().toString(36).slice(2, 6),
    videoId,
    title,
    url: canonicalUrl,
    channelTitle,
    duration: '직접추가',
    publishedText: '직접 등록한 영상',
    description: `${channelTitle} • 사용자 직접 추가 쉐도잉 영상`,
    thumbnailUrl,
    publishedAt: new Date().toISOString(),
    category: detectedCategory || category || 'essay_deep',
    channelPresetId: 'custom',
    tags: ['직접등록', '⭐찜추가', '쉐도잉', '고급딕션'],
    bookmarked: Boolean(autoBookmark),
    bookmarkedAt: autoBookmark ? now : null,
    watched: false,
    rating: 5,
    memo: '사용자 직접 추가 쉐도잉 영상',
    source: 'user_direct_add',
    addedAt: now,
    updatedAt: now,
  };

  store.items.unshift(newItem);
  saveYouTubeData(store);

  return { item: newItem, isNew: true };
}

/**
 * Search YouTube HTML for high-quality speech & educational videos
 */
async function searchYouTubeQuery(query) {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });

    const html = await res.text();
    const match = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/ytInitialData\s*=\s*({.+?});/);
    if (!match) return [];

    const data = JSON.parse(match[1]);
    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
    if (!contents) return [];

    const results = [];
    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const v = item?.videoRenderer;
        if (v && v.videoId) {
          const videoId = v.videoId;
          const title = v.title?.runs?.[0]?.text || '';
          const channelTitle = v.ownerText?.runs?.[0]?.text || '';
          const channelHandle = v.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || '';
          const publishedText = v.publishedTimeText?.simpleText || 'Recently';
          const duration = v.lengthText?.simpleText || '';
          const views = v.viewCountText?.simpleText || '';
          const descSnippet = v.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map(r => r.text).join('') || '';

          // 1. Strict Trash / Foreign language / Permanent Blacklist filter
          if (isTrashContent(title, descSnippet, channelTitle) || isBlacklisted(title, descSnippet, channelTitle, videoId)) {
            continue;
          }

          // 1-1. Male speaker filter
          const combinedLower = `${title} ${channelTitle} ${descSnippet}`.toLowerCase();
          const isMale = MALE_KEYWORDS.some(kw => {
            const lowerKw = kw.trim().toLowerCase();
            if (!lowerKw) return false;
            const regex = new RegExp(`(?:^|[^a-z0-9])${lowerKw}(?:$|[^a-z0-9])`, 'i');
            return regex.test(combinedLower);
          });
          if (isMale) {
            continue;
          }

          // 2. Duration filter (must be >= 3 min for speech/shadowing)
          if (duration && !isGoodShadowingLength(duration)) {
            continue;
          }

          // 3. Strict 5-year upload filter
          if (!isWithin5Years(publishedText)) {
            continue;
          }

          results.push({
            videoId,
            title,
            channelTitle,
            channelHandle,
            publishedText,
            duration: duration || '10분+',
            views,
            description: descSnippet || `${publishedText} • ${views}`,
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            url: `https://www.youtube.com/watch?v=${videoId}`,
          });
        }
      }
    }
    return results;
  } catch (e) {
    console.error(`[YouTube Search] Error querying "${query}":`, e.message);
    return [];
  }
}

/**
 * Determine category between 2 main categories: 'ted_speech' vs 'essay_deep'
 */
export function determineCategory(title = '', query = '') {
  const text = `${title} ${query}`.toLowerCase();
  if (
    text.includes('ted') ||
    text.includes('speech') ||
    text.includes('commencement') ||
    text.includes('keynote') ||
    text.includes('address') ||
    text.includes('stage') ||
    text.includes('presentation')
  ) {
    return 'ted_speech';
  }
  return 'essay_deep';
}

/**
 * Curate dynamically up to 100 TED & High-Diction Shadowing Videos with SSE Progress Reporting
 */
export async function curateYouTubeLinksDynamic({
  limit = 100,
  onProgress = null,
  replaceExisting = true,
} = {}) {
  const store = loadYouTubeData();
  const targetTotal = Number(limit) || 100;

  if (onProgress) onProgress({ percent: 5, message: `🚀 젊은 여성 리더 & 명사들의 명품 TED 강연 및 에세이 쉐도잉 수집 시작...` });

  const seenIds = new Set();
  // Preserve bookmarked video IDs
  store.items.filter(i => i.bookmarked).forEach(i => {
    if (i.videoId) seenIds.add(i.videoId);
  });

  const collectedVideos = [];
  const totalQueries = SEARCH_QUERIES.length;

  for (let i = 0; i < totalQueries; i++) {
    const q = SEARCH_QUERIES[i];
    const progressPercent = Math.min(90, Math.round(5 + ((i + 1) / totalQueries) * 80));
    
    if (onProgress) {
      onProgress({
        percent: progressPercent,
        message: `🔍 멘토/강연 탐색 중 (${i + 1}/${totalQueries}): "${q}" (수집: ${collectedVideos.length}/${targetTotal}개)`
      });
    }

    const results = await searchYouTubeQuery(q);

    for (const item of results) {
      if (!seenIds.has(item.videoId)) {
        seenIds.add(item.videoId);
        item.detectedCategory = determineCategory(item.title, q);
        collectedVideos.push(item);
      }
      if (collectedVideos.length >= targetTotal) break;
    }

    if (collectedVideos.length >= targetTotal) break;
    await new Promise(r => setTimeout(r, 100));
  }

  if (onProgress) {
    onProgress({
      percent: 95,
      message: `✨ TED 및 에세이·마인드셋 쉐도잉 데이터 정리 중 (${collectedVideos.length}개)...`
    });
  }

  // Final mapping
  const selected = collectedVideos.slice(0, targetTotal);
  const curatedItems = selected.map((v, idx) => {
    const durBadge = v.duration ? `⏱️ ${v.duration}` : '⏱️ 10분+';
    const pubBadge = v.publishedText ? `📅 ${v.publishedText}` : '📅 최근 2~3년';
    return {
      id: 'yt_sh_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2, 6),
      videoId: v.videoId,
      title: v.title,
      url: v.url,
      channelTitle: v.channelTitle || 'Inspiring Speaker / TED',
      duration: v.duration || '10분+',
      publishedText: v.publishedText || '최근 2~3년 이내',
      description: v.description,
      thumbnailUrl: v.thumbnailUrl,
      publishedAt: new Date(Date.now() - (idx + 1) * 3600 * 1000).toISOString(),
      category: v.detectedCategory || 'essay_deep',
      channelPresetId: 'all',
      tags: ['명품딕션', '롤모델스피치', '기업가정신', pubBadge, durBadge],
      bookmarked: false,
      bookmarkedAt: null,
      watched: false,
      rating: 0,
      memo: '',
      source: 'ted_essay_shadowing',
      addedAt: Date.now() - idx * 1000,
      updatedAt: Date.now(),
    };
  });

  const preservedBookmarked = store.items.filter(item => item.bookmarked);
  // Normalize preserved bookmarks categories as well
  preservedBookmarked.forEach(item => {
    if (item.category !== 'ted_speech' && item.category !== 'essay_deep') {
      item.category = determineCategory(item.title, '');
    }
  });

  let finalItems = replaceExisting 
    ? [...preservedBookmarked, ...curatedItems]
    : [...preservedBookmarked, ...curatedItems, ...store.items.filter(i => !i.bookmarked)];

  store.items = finalItems;
  store.lastCuratedAt = Date.now();
  store.lastQuery = `최근 TED & 명품 여성 리더 에세이·마인드셋 쉐도잉`;
  saveYouTubeData(store);

  if (onProgress) {
    onProgress({
      percent: 100,
      message: `🎉 수집 완료! 총 ${curatedItems.length}개의 TED 및 에세이 영상이 준비되었습니다.`
    });
  }

  return {
    ok: true,
    addedCount: curatedItems.length,
    preservedBookmarkedCount: preservedBookmarked.length,
    totalItems: finalItems.length,
    lastCuratedAt: store.lastCuratedAt,
    lastQuery: store.lastQuery,
  };
}

export const curateYouTubeLinks = curateYouTubeLinksDynamic;

/**
 * Check if the weekly meeting has already been executed for the current week
 */
export function isWeeklyMeetingDue() {
  const weeklyData = loadWeeklyData();
  if (!weeklyData.sessions || weeklyData.sessions.length === 0) return true;

  const now = new Date();
  // Calculate Monday 00:00:00 of the current week
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday...
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  // Check if any session exists created in or after Monday of this week
  const hasSessionThisWeek = weeklyData.sessions.some(s => {
    const sDate = new Date(s.date || s.createdAt || 0);
    return sDate >= monday;
  });

  return !hasSessionThisWeek;
}

/**
 * Run Wednesday 11:00 AI Council Meeting & Recommendation Generation
 */
export async function runWednesdayMeeting({ force = false, isCatchup = false } = {}) {
  const weeklyData = loadWeeklyData();
  const todayStr = new Date().toISOString().split('T')[0];

  // Pick top mentor speakers to feature this week
  const shuffledMentors = [...MENTOR_SPEAKER_POOL].sort(() => 0.5 - Math.random());
  const featuredMentors = shuffledMentors.slice(0, 4);

  const meetingVideos = [];
  for (const mentor of featuredMentors) {
    const q = mentor.keywords[0] || `${mentor.name} speech`;
    const results = await searchYouTubeQuery(q);
    if (results.length > 0) {
      const topV = results[0];
      meetingVideos.push({
        id: 'w_vid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        title: topV.title,
        channelTitle: topV.channelTitle || mentor.name,
        url: topV.url,
        thumbnailUrl: topV.thumbnailUrl,
        duration: topV.duration || '12:00',
        mentorName: mentor.name,
        shadowingTip: `${mentor.name} 특유의 ${mentor.dictionStyle}을 집중 쉐도잉하세요.`,
        category: mentor.category,
      });
    }
  }

  // Calculate week number
  const now = new Date();
  const weekNumber = Math.ceil((((now - new Date(now.getFullYear(), 0, 1)) / 86400000) + 1) / 7);

  const catchupNotice = isCatchup ? ' [PC 재부팅 주간 자동 보충 실행]' : '';

  const newSession = {
    id: `session_${now.getFullYear()}_w${weekNumber}_${Date.now()}`,
    date: todayStr,
    createdAt: Date.now(),
    isCatchup: Boolean(isCatchup),
    weekLabel: `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${Math.ceil(now.getDate() / 7)}주차${catchupNotice}`,
    meetingTitle: `🎙️ ${featuredMentors.map(m => m.name).join(', ')} 스피치 & 인생 마인드셋 추천 회의`,
    agenda: `${featuredMentors.map(m => m.coreTopics).join(' | ')} 중심의 최근 강연 분석 및 쉐도잉 추천`,
    speakerHighlights: featuredMentors.map(m => ({
      name: m.name,
      point: `${m.role} - ${m.coreTopics} (${m.dictionStyle})`,
    })),
    summary: `금주 회의에서는 ${featuredMentors.map(m => m.name).join(', ')}의 최신 강연 중 발음의 명확성과 메시지 전달력이 가장 뛰어난 영상을 선별하여 추천 목록에 등록하였습니다.${isCatchup ? ' (수요일 PC 오프라인으로 인한 부팅 즉시 자동 보충 회의)' : ''}`,
    videos: meetingVideos,
  };

  weeklyData.sessions.unshift(newSession);
  weeklyData.lastMeetingAt = Date.now();
  saveWeeklyData(weeklyData);

  return { ok: true, session: newSession };
}

/**
 * Anacron-style Weekly Catchup Guard: Guarantees at least 1 meeting per week regardless of PC shutdown
 */
export async function checkAndRunWeeklyCatchup() {
  if (isWeeklyMeetingDue()) {
    console.log(`[Weekly Meeting Guard] 🛡️ 금주 정기 회의 미실행 감지(PC 오프라인 등). 즉시 주 1회 보충 회의를 자동 실행합니다...`);
    return await runWednesdayMeeting({ force: true, isCatchup: true });
  }
  return { ok: true, skipped: true, reason: 'Already executed for this week' };
}
