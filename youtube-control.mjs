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
 * Major Language Categories (대카테고리: 언어별 선택)
 */
export const LANGUAGES = [
  { id: 'all', code: 'all', name: '전체 언어', flag: '🌐', label: '🌐 전체 언어', desc: '모든 언어 쉐도잉 콘텐츠' },
  { id: 'en', code: 'en', name: '영어', flag: '🇺🇸', label: '🇺🇸 영어 (English)', ttsLang: 'en-US', desc: '미국/영국 명사 TED 강연, 비즈니스 에세이, 팟캐스트 & 팝송' },
  { id: 'es', code: 'es', name: '스페인어', flag: '🇪🇸', label: '🇪🇸 스페인어 (Español)', ttsLang: 'es-ES', desc: 'TED en Español, 카스티야 딕션 1타 Linguriosa, 실전 회화' },
  { id: 'ja', code: 'ja', name: '일본어', flag: '🇯🇵', label: '🇯🇵 일본어 (日本語)', ttsLang: 'ja-JP', desc: 'TEDx 일본어 명강연, 아카네/YUYU 실전 회화 팟캐스트, 비즈니스 쉐도잉' },
  { id: 'zh', code: 'zh', name: '중국어', flag: '🇨🇳', label: '🇨🇳 중국어 (中文)', ttsLang: 'zh-CN', desc: 'TEDx 표준 중국어 명강연, 감정 조절/뇌과학 에세이, 실전 회화' },
  { id: 'fr', code: 'fr', name: '프랑스어', flag: '🇫🇷', label: '🇫🇷 프랑스어 (Français)', ttsLang: 'fr-FR', desc: 'TEDx 프랑스어 명연설, 파리 표준 딕션, Easy French 쉐도잉' },
  { id: 'de', code: 'de', name: '독일어', flag: '🇩🇪', label: '🇩🇪 독일어 (Deutsch)', ttsLang: 'de-DE', desc: 'TEDx 독일어 명강연, 스토리텔링 스피치, Easy German 쉐도잉' },
];

/**
 * Format / Topic Subcategories (소카테고리: 주제 및 포맷별 선택)
 */
export const SUB_CATEGORIES = [
  { id: 'all', label: '✨ 전체 주제', icon: '✨', desc: '선택한 언어의 모든 주제' },
  { id: 'ted_speech', label: '🎤 TED & 명품 강연', icon: '🎤', desc: '대중 스피치, TED/TEDx 명강연 및 프레젠테이션' },
  { id: 'essay_deep', label: '📚 에세이 & 마인드셋', icon: '📚', desc: '기업가정신, 인생 가치관, 심층 대담 및 마인드셋' },
  { id: 'sleep_life', label: '🌙 수면 & 롱폼 딥토크 (1h+)', icon: '🌙', desc: '취침·휴식 시 듣기 좋은 60분+ 차분한 롱폼 스토리텔링' },
  { id: 'conversation', label: '🗣️ 실전 회화 & 팟캐스트', icon: '🗣️', desc: '원어민 일상 대화, 딕션 훈련 및 실전 회화 팟캐스트' },
  { id: 'pop_music', label: '🎵 노래 & 가사 쉐도잉', icon: '🎵', desc: '음악 가사 싱크 쉐도잉 & 팝송 학습' },
  { id: 'top_trained', label: '🔥 최다 훈련순', icon: '🔥', desc: '내가 가장 많이 집중 훈련한 영상 순서' },
];

export const CURATION_CHANNELS = [
  {
    id: 'all',
    label: '✨ 전체 추천 영상',
    shortLabel: '전체 추천',
    target: '글로벌 명사들의 명품 TED 강연, 인생 가치관 및 실전 쉐도잉',
    icon: '✨',
    desc: '다국어 스피치 훈련 & 쉐도잉에 최적화된 유창하고 또렷한 딕션의 명사 강연, 에세이 및 취침용 롱폼 토크',
    category: 'all',
    defaultTags: ['명품딕션', '롤모델스피치', '기업가정신', '쉐도잉최적'],
  },
];

/**
 * Inspiring Role Model Mentor Speakers Pool (존경받는 젊은 여성 명사 & CEO 인재풀)
 */
export const MENTOR_SPEAKER_POOL = [
  {
    id: 'emma_chamberlain',
    name: 'Emma Chamberlain',
    role: 'Anything Goes 호스트 & 글로벌 크리에이터 (포브스 30 Under 30)',
    category: 'sleep_life',
    avatar: '☕',
    badge: '🌙 심야 감성 딥토크',
    dictionStyle: '차분하고 나지막하면서도 명료한 톤, 밤에 듣기 편안한 솔직한 독백 & 대화',
    coreTopics: '인생의 고난과 성장, 외로움 극복, 20대의 진솔한 생각과 인간관계',
    keywords: ['Emma Chamberlain Anything Goes podcast life lessons full episode', 'Emma Chamberlain deep talk life philosophy 1 hour', 'Emma Chamberlain advice interview full'],
  },
  {
    id: 'maya_shankar',
    name: 'Dr. Maya Shankar',
    role: '인지과학자 (옥스퍼드/스탠퍼드) & A Slight Change of Plans 진행자',
    category: 'sleep_life',
    avatar: '✨',
    badge: '🧠 뇌과학 & 감동 딥토크',
    dictionStyle: '지적이고 정돈된 표준 미국식 발음, 차분하면서도 깊은 울림의 딕션',
    coreTopics: '삶의 극적인 변화, 상실과 회복, 인간의 정체성과 가치관 심층 탐구',
    keywords: ['Dr Maya Shankar deep conversation podcast full episode', 'Maya Shankar podcast change mind life story', 'Dr Maya Shankar interview values full talk'],
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
    keywords: ['Liv Boeree TED talk speech', 'Liv Boeree decision making game theory', 'Liv Boeree podcast full length deep talk'],
  },
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
    keywords: ['Grace Beverley productivity speech', 'Grace Beverley founder interview talk 1 hour', 'Grace Beverley Oxford talk'],
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
    id: 'alex_cooper',
    name: 'Alex Cooper',
    role: 'Unwell Network 대표 & 20대 미디어 기업가',
    category: 'sleep_life',
    avatar: '🎙️',
    badge: '🔥 20대 미디어 제국',
    dictionStyle: '진솔하고 몰입감 넘치는 대화, 편안하면서도 깊은 인생 스토리텔링',
    coreTopics: '자기 확신, 협상력, 20대 거대 미디어 비즈니스 구축 및 인생 인터뷰',
    keywords: ['Alex Cooper business interview speech 1 hour', 'Alex Cooper podcast deep conversation full', 'Alex Cooper Forbes talk'],
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
    id: 'linguriosa_elena',
    name: 'Elena Herraiz (Linguriosa)',
    role: '언어학자 & 스페인어 발음·어원 1타 크리에이터 (마드리드)',
    category: 'spanish',
    avatar: '🇪🇸',
    badge: '🇪🇸 스페인어 딕션 1타',
    dictionStyle: '스페인 마드리드 표준 카스티야 딕션, 또렷하고 경쾌한 전달력과 어원 스토리텔링',
    coreTopics: '스페인어 발음 마스터, 단어의 역사와 어원, 스페인 vs 중남미 억양',
    keywords: ['Linguriosa espanol pronunciacion explicacion', 'Elena Herraiz Linguriosa espanol gramatica', 'Linguriosa acentos espanol'],
  },
  {
    id: 'wendy_ramos',
    name: 'Wendy Ramos',
    role: '배우, 작가 & TEDx 전설의 대중 연설가 (페루/스페인권)',
    category: 'spanish',
    avatar: '🌟',
    badge: '🎤 TEDx 전설의 스피치',
    dictionStyle: '유쾌하면서도 가슴을 울리는 독보적인 스토리텔링과 완벽한 스페인어 억양',
    coreTopics: '인생의 주인공이 되는 법, 나만의 길을 찾는 용기, 대중 스피치 마스터',
    keywords: ['Wendy Ramos TEDx charla completa espanol', 'Wendy Ramos aprender a volar TED speech', 'Wendy Ramos charla inspiradora'],
  },
  {
    id: 'patrycia_centeno',
    name: 'Patrycia Centeno',
    role: '정치 비언어 커뮤니케이션 전문가 & 리더십 연설가 (바르셀로나)',
    category: 'spanish',
    avatar: '👑',
    badge: '👑 리더십 커뮤니케이션',
    dictionStyle: '명확하고 지적인 스페인식 전달력, 자신감 있는 템포와 설득력',
    coreTopics: '여성 리더십, 비언어 커뮤니케이션, 설득의 심리학',
    keywords: ['Patrycia Centeno TEDx liderazgo femenino', 'Patrycia Centeno comunicacion no verbal charla'],
  },
  {
    id: 'margarita_pasos',
    name: 'Margarita Pasos',
    role: '포춘 500 기업 리더십 코치 & 세계적 스페인어 동기부여 연설가',
    category: 'spanish',
    avatar: '⚡',
    badge: '🔥 멘탈 & 동기부여 코치',
    dictionStyle: '압도적인 에너지와 명쾌한 발음, 긍정 심리학 기반의 스페인어 스피치',
    coreTopics: '멘탈 혁신, 두려움 극복, 감정 조절 및 인생 목표 달성',
    keywords: ['Margarita Pasos TEDx charla espanol mente', 'Margarita Pasos motivacion liderazgo charla completa'],
  },
  {
    id: 'emma_rodero',
    name: 'Dr. Emma Rodero',
    role: '음성 심리학자 & 바르셀로나 폼페우 파브라 대학교 교수',
    category: 'spanish',
    avatar: '🎙️',
    badge: '🎙️ 목소리 & 신뢰감 스피치',
    dictionStyle: '과학적으로 완벽한 목소리 톤과 발성, 최고 수준의 스페인어 딕션',
    coreTopics: '목소리로 신뢰를 얻는 법, 말의 전달력과 설득의 음성학',
    keywords: ['Emma Rodero TEDx persuade con tu voz charla', 'Emma Rodero hablar en publico voz espanol'],
  },
];

// Targeted queries focused strictly on bright, young, inspiring female speakers, diverse TED topics, elite diction essays, and 1-hour+ sleep & life stories
const SEARCH_QUERIES = [
  // 1. Core TED & TEDx Talks by Inspiring, Articulate Young Women
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

  // 4. [New] 1 Hour+ Sleep, Life Stories & Deep Intimate Conversations (잘 때 듣는 1시간+ 인생 이야기 & 팟캐스트 - 미녀 엄선)
  'Emma Chamberlain Anything Goes life story full podcast 1 hour',
  'Dr Maya Shankar deep conversation podcast full episode 1 hour',
  'inspiring young woman life story full podcast 1 hour calm voice',
  'calm articulate young woman storytelling 1 hour sleep english',
  'deep life conversation podcast young female founder 1 hour clear diction',
  'Diary of a CEO female founder inspiring life story 1 hour calm english',
  'soothing deep talk interview articulate woman life philosophy 1 hour',
  'Liv Boeree full length podcast deep conversation life 1 hour',
  'Alex Cooper podcast deep intimate life interview full 1 hour',
  '1 hour podcast young woman life lessons advice calm clear voice',
  'young articulate woman deep talk life journey podcast full episode 1 hour',
  'calm clear english podcast woman mindset life philosophy sleep bedtime',

  // 5. Spanish Shadowing & Speeches (스페인어 쉐도잉 & TED en Español & 회화)
  'TED en espanol charla inspiradora mujer diccion clara',
  'TEDx charla mujer espanol diccion pronunciacion',
  'Linguriosa espanol pronunciacion explicacion',
  'aprender espanol shadowing podcast conversacion clara',
  'TED en espanol psicologia liderazgo mujer charla',
  'charla motivacional espanol mujer inspiradora',
  'TEDx speech spanish clear pronunciation storytelling',
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

  // 1. Check Korean noise in non-Korean curation (reject generic domestic vlogs)
  if (cTitle.includes('브이로그') || cTitle.includes('취준생') || cTitle.includes('먹방') || cTitle.includes('청소')) return true;
  const koreanCount = (title.match(/[가-힣]/g) || []).length;
  if (koreanCount > 10) return true;

  // 2. Trash keywords
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
 * Require at least 3 minutes (180 seconds) up to 3.5 hours (12600 seconds)
 */
export function isGoodShadowingLength(durationStr) {
  if (!durationStr) return true;
  const secs = parseDurationInSeconds(durationStr);
  return secs >= 180 && secs <= 12600; // 3 min <= duration <= 210 min (3.5 hours)
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

const MUSIC_FILE = '/home/kw/kwsoft/ytmusic/data/music.json';

/**
 * Load pop music tracks (Olivia Rodrigo 31곡 & English Pop tracks) from ytmusic
 */
export function loadPopMusicTracks() {
  if (!existsSync(MUSIC_FILE)) return [];
  try {
    const raw = readFileSync(MUSIC_FILE, 'utf8');
    const data = JSON.parse(raw);
    const playlists = data.playlists || [];
    const tracks = [];
    const seen = new Set();

    // Prioritize Olivia Rodrigo (31 tracks), then Billie Eilish (54 tracks)
    const popPlaylists = [
      ...playlists.filter(p => p.id === 'artist_olivia_rodrigo'),
      ...playlists.filter(p => p.id === 'artist_billie_eilish'),
      ...playlists.filter(p => p.id && p.id.startsWith('artist_') && !['artist_olivia_rodrigo', 'artist_billie_eilish', 'artist_iu', 'artist_taeyeon', 'yang_yoseob_cat'].includes(p.id))
    ];

    for (const pl of popPlaylists) {
      for (const t of (pl.tracks || [])) {
        if (!t.videoId || seen.has(t.videoId)) continue;
        seen.add(t.videoId);
        const artist = t.artist || (pl.id === 'artist_olivia_rodrigo' ? 'Olivia Rodrigo' : 'Billie Eilish');
        tracks.push({
          id: `pop_${t.id || t.videoId}`,
          videoId: t.videoId,
          title: `${artist} - ${t.title || 'Track'}`,
          channelTitle: artist,
          description: `${t.album || 'Pop Album'} | 가사 한줄 싱크 쉐도잉 & 팝송 영어 학습`,
          thumbnailUrl: t.thumbnailUrl || `https://i.ytimg.com/vi/${t.videoId}/hqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${t.videoId}`,
          duration: t.duration || '3:30',
          category: 'pop_music',
          artist: artist,
          album: t.album || '',
          source: 'ytmusic_pop',
          bookmarked: false,
          addedAt: Date.now() - 50000,
        });
      }
    }
    return tracks;
  } catch (e) {
    console.error('[YouTube Control] Error loading music.json pop tracks:', e.message);
    return [];
  }
}

export const DEFAULT_SPANISH_TRACKS = [
  {
    videoId: 'YlI-e4QJWG0',
    title: 'Persuade con tu voz. Estrategias para sonar creíble. | Emma Rodero | TEDxMalagueta',
    channelTitle: 'TEDx Talks',
    description: 'Dr. Emma Rodero • 음성 심리학자가 알려주는 신뢰를 얻는 목소리와 스페인어 대중 스피치 마스터클래스',
    thumbnailUrl: 'https://img.youtube.com/vi/YlI-e4QJWG0/hqdefault.jpg',
    duration: '16:43',
    category: 'spanish',
    tags: ['스페인어', 'TEDx', '목소리훈련', '신뢰스피치', '쉐도잉'],
    source: 'curated_spanish',
  },
  {
    videoId: 'CX9IN4fAx6I',
    title: '¿Por qué seguimos escribiendo una letra que no se pronuncia? | Linguriosa',
    channelTitle: 'Linguriosa',
    description: 'Elena Herraiz (Linguriosa) • 마드리드 표준 카스티야 딕션으로 배우는 스페인어 철자와 발음의 비밀',
    thumbnailUrl: 'https://img.youtube.com/vi/CX9IN4fAx6I/hqdefault.jpg',
    duration: '18:03',
    category: 'spanish',
    tags: ['스페인어', 'Linguriosa', '발음마스터', '카스티야딕션', '쉐도잉'],
    source: 'curated_spanish',
  },
  {
    videoId: 'KAcl8ekUz9Y',
    title: 'No parece ansiedad… pero lo es | Kassandra Quezada | TEDxTecdeMty',
    channelTitle: 'TEDx Talks',
    description: 'Kassandra Quezada • 감정 조절과 불안 극복을 위한 또렷하고 공감 넘치는 스페인어 TEDx 강연',
    thumbnailUrl: 'https://img.youtube.com/vi/KAcl8ekUz9Y/hqdefault.jpg',
    duration: '16:35',
    category: 'spanish',
    tags: ['스페인어', 'TEDx', '심리학', '감동스피치', '쉐도잉'],
    source: 'curated_spanish',
  },
  {
    videoId: 'eGyNufJ8-Cg',
    title: 'El poderío del liderazgo femenino | Patrycia Centeno | TEDxTarragona',
    channelTitle: 'TEDx Talks',
    description: 'Patrycia Centeno • 비언어 커뮤니케이션 전문가가 전하는 여성 리더십과 카리스마 스페인어 스피치',
    thumbnailUrl: 'https://img.youtube.com/vi/eGyNufJ8-Cg/hqdefault.jpg',
    duration: '13:25',
    category: 'spanish',
    tags: ['스페인어', 'TEDx', '여성리더십', '스피치기법', '쉐도잉'],
    source: 'curated_spanish',
  },
  {
    videoId: 'nExwGbuz8gE',
    title: '¿Qué historia te cuentas? | Lety Sahagún | TEDxUANL',
    channelTitle: 'TEDx Talks',
    description: 'Lety Sahagún • 인생을 바꾸는 내면의 대화와 생각의 힘을 전하는 감동적인 스페인어 연설',
    thumbnailUrl: 'https://img.youtube.com/vi/nExwGbuz8gE/hqdefault.jpg',
    duration: '11:30',
    category: 'spanish',
    tags: ['스페인어', 'TEDx', '마인드셋', '동기부여', '쉐도잉'],
    source: 'curated_spanish',
  },
  {
    videoId: 'uhZzB5hid6M',
    title: 'Cambia tu mente, cambia tu vida | Margarita Pasos | TEDxManagua',
    channelTitle: 'TEDx Talks',
    description: 'Margarita Pasos • 글로벌 리더십 코치가 전하는 뇌 가소성과 마인드셋 혁신 스페인어 명강연',
    thumbnailUrl: 'https://img.youtube.com/vi/uhZzB5hid6M/hqdefault.jpg',
    duration: '20:44',
    category: 'spanish',
    tags: ['스페인어', 'TEDx', '멘탈코칭', '인생가치관', '쉐도잉'],
    source: 'curated_spanish',
  },
  {
    videoId: '4cX3k1NVOHo',
    title: 'Speak Spanish Fluently with Shadowing (A2) | Learn Spanish with Podcast',
    channelTitle: 'Easy Spanish Podcast',
    description: 'Easy Spanish Podcast • 초중급자를 위한 한 문장씩 따라 말하는 실전 스페인어 쉐도잉 팟캐스트',
    thumbnailUrl: 'https://img.youtube.com/vi/4cX3k1NVOHo/hqdefault.jpg',
    duration: '10:27',
    category: 'spanish',
    tags: ['스페인어', '쉐도잉훈련', '실전회화', '팟캐스트'],
    source: 'curated_spanish',
  },
  {
    videoId: 'w6jmZk-o6wU',
    title: 'Cómo mejorar tu FLUIDEZ EN ESPAÑOL con ejercicios de SHADOWING 🗣️',
    channelTitle: 'Español con Juan',
    description: '스페인어 유창성을 극대화하는 쉐도잉 훈련법과 자연스러운 억양 형성 비결',
    thumbnailUrl: 'https://img.youtube.com/vi/w6jmZk-o6wU/hqdefault.jpg',
    duration: '22:38',
    category: 'spanish',
    tags: ['스페인어', '유창성', '발음훈련', '쉐도잉'],
    source: 'curated_spanish',
  },
  {
    videoId: '5GEr6PaMc-g',
    title: 'Esto es SÚPER IMPORTANTE ⚠️ [Reglas de Acentuación] 📏 | Linguriosa',
    channelTitle: 'Linguriosa',
    description: 'Elena Herraiz (Linguriosa) • 스페인어 강세 규칙과 정확한 억양 완벽 마스터',
    thumbnailUrl: 'https://img.youtube.com/vi/5GEr6PaMc-g/hqdefault.jpg',
    duration: '12:47',
    category: 'spanish',
    tags: ['스페인어', 'Linguriosa', '강세규칙', '억양훈련', '쉐도잉'],
    source: 'curated_spanish',
  },
  {
    videoId: 'eTtpy4XotIg',
    title: 'Spanish Shadowing Practice | Real Conversations for Daily Use | Spanish Podcast',
    channelTitle: 'Easy Español',
    description: 'Easy Español • 원어민 실전 일상 대화 38분 집중 스페인어 리스닝 & 쉐도잉 훈련',
    thumbnailUrl: 'https://img.youtube.com/vi/eTtpy4XotIg/hqdefault.jpg',
    duration: '38:42',
    category: 'spanish',
    tags: ['스페인어', '일상회화', '집중훈련', '팟캐스트', '쉐도잉'],
    source: 'curated_spanish',
  },
];

export const DEFAULT_JAPANESE_TRACKS = [
  {
    videoId: 'iIkEj1rZWa0',
    title: '日本語の会話が上手になる3つのポイント (일본어 회화 실력이 빠르게 느는 3가지 비결)',
    channelTitle: 'あかね的日本語教室 (Akane Japanese)',
    description: '원어민 아카네 선생님의 또렷한 도쿄 표준 발음으로 익히는 실전 일본어 회화 및 스피치 팁',
    thumbnailUrl: 'https://img.youtube.com/vi/iIkEj1rZWa0/hqdefault.jpg',
    duration: '14:57',
    language: 'ja',
    category: 'conversation',
    tags: ['일본어', '회화훈련', '아카네', '표준발음', '쉐도잉'],
    source: 'curated_japanese',
  },
  {
    videoId: 'C9VabhxOPbA',
    title: '会話のアドバイス / Get better slowly (일본어 리스닝 & 쉐도잉 팟캐스트)',
    channelTitle: 'YUYUの日本語Podcast',
    description: '자연스러운 일본어 구어체와 명확한 억양을 한 문장씩 따라하는 팟캐스트 쉐도잉',
    thumbnailUrl: 'https://img.youtube.com/vi/C9VabhxOPbA/hqdefault.jpg',
    duration: '17:13',
    language: 'ja',
    category: 'conversation',
    tags: ['일본어', '팟캐스트', '일상회화', '리스닝', '쉐도잉'],
    source: 'curated_japanese',
  },
  {
    videoId: 'JMKetIc6hSg',
    title: 'Shadowing Practice : Online Conversation (일본어 실전 대화 쉐도잉)',
    channelTitle: 'Speak Japanese Naturally',
    description: '일상 및 온라인에서 자연스럽게 반응하고 말하는 실전 일본어 쉐도잉 훈련',
    thumbnailUrl: 'https://img.youtube.com/vi/JMKetIc6hSg/hqdefault.jpg',
    duration: '11:56',
    language: 'ja',
    category: 'conversation',
    tags: ['일본어', '실전회화', '자연스러운억양', '쉐도잉'],
    source: 'curated_japanese',
  },
  {
    videoId: 'PPQrkjxlpxs',
    title: '実用ビジネス日本語 Jitsuyou Bijinesu (실용 비즈니스 일본어 집중 쉐도잉)',
    channelTitle: '千一',
    description: '비즈니스 실전 경어, 프레젠테이션 및 직장 내 명료한 일본어 스피치 마스터클래스',
    thumbnailUrl: 'https://img.youtube.com/vi/PPQrkjxlpxs/hqdefault.jpg',
    duration: '1:38:01',
    language: 'ja',
    category: 'essay_deep',
    tags: ['일본어', '비즈니스', '고급일본어', '롱폼쉐도잉'],
    source: 'curated_japanese',
  },
];

export const DEFAULT_CHINESE_TRACKS = [
  {
    videoId: 'snZ811wvjjw',
    title: '如何不讓人生留下遺憾? (인생에 후회를 남기지 않는 법) | 陳永儀 May Chen | TEDxTaipei',
    channelTitle: 'TEDx Talks',
    description: '임상심리학자 May Chen 교수가 전하는 완벽한 표준 중국어 발음과 죄책감 극복 인생 명강연',
    thumbnailUrl: 'https://img.youtube.com/vi/snZ811wvjjw/hqdefault.jpg',
    duration: '14:28',
    language: 'zh',
    category: 'ted_speech',
    tags: ['중국어', 'TEDx', '심리학', '인생가치관', '명연설'],
    source: 'curated_chinese',
  },
  {
    videoId: 'uiJ4zibW8_M',
    title: '沒有「負面能量」是好事嗎？需要重新認識的「情緒反應」| 陳永儀 May Chen | TEDxTaipei',
    channelTitle: 'TEDx Talks',
    description: '부정적 감정을 온전히 수용하고 다루는 법, 또렷하고 정확한 중국어 딕션 마스터',
    thumbnailUrl: 'https://img.youtube.com/vi/uiJ4zibW8_M/hqdefault.jpg',
    duration: '15:23',
    language: 'zh',
    category: 'ted_speech',
    tags: ['중국어', 'TEDx', '감정조절', '명품딕션', '쉐도잉'],
    source: 'curated_chinese',
  },
  {
    videoId: 'wWnUczsfGv0',
    title: '腦科學揭露女人思考的秘密 (뇌과학이 밝히는 사고의 비밀)：洪蘭 Daisy L. Hung | TEDxTaipei',
    channelTitle: 'TEDxTaipei',
    description: '뇌인지과학자 Daisy Hung 교수의 흥미진진한 뇌과학과 소통의 비결 스피치',
    thumbnailUrl: 'https://img.youtube.com/vi/wWnUczsfGv0/hqdefault.jpg',
    duration: '19:27',
    language: 'zh',
    category: 'essay_deep',
    tags: ['중국어', 'TEDx', '뇌과학', '스피치훈련', '쉐도잉'],
    source: 'curated_chinese',
  },
  {
    videoId: '4BOzM0lYjMw',
    title: '充滿鼓舞性的自由教育 (자유로운 교육의 힘)：黑嘉嘉 (Joanne Missingham) | TEDxTaipei',
    channelTitle: 'TEDxTaipei',
    description: '프로 바둑 기사이자 배우 Joanne Missingham의 열정과 끈기, 자기주도적 성장 연설',
    thumbnailUrl: 'https://img.youtube.com/vi/4BOzM0lYjMw/hqdefault.jpg',
    duration: '10:46',
    language: 'zh',
    category: 'ted_speech',
    tags: ['중국어', 'TEDx', '자기계발', '마인드셋', '쉐도잉'],
    source: 'curated_chinese',
  },
];

export const DEFAULT_FRENCH_TRACKS = [
  {
    videoId: '8S8mie3bwtw',
    title: 'Rien ne nous arrive par hasard (우연은 없다) | Nadalette La Fonta Six | TEDxChampsElyseesWomen',
    channelTitle: 'TEDx Talks',
    description: '파리 샹젤리제 TEDx 무대에서 전하는 삶의 역경과 회복 탄력성 프랑스어 명연설',
    thumbnailUrl: 'https://img.youtube.com/vi/8S8mie3bwtw/hqdefault.jpg',
    duration: '18:55',
    language: 'fr',
    category: 'ted_speech',
    tags: ['프랑스어', 'TEDx', '파리딕션', '인생철학', '쉐도잉'],
    source: 'curated_french',
  },
  {
    videoId: '0qeD3P0_o08',
    title: 'Femmes, osez être un modèle inspirant ! (영감을 주는 롤모델이 되라) | Madeline Da Silva',
    channelTitle: 'TEDx Talks',
    description: '자신만의 목소리로 세상을 바꾸는 여성 리더십과 카리스마 프랑스어 대중 스피치',
    thumbnailUrl: 'https://img.youtube.com/vi/0qeD3P0_o08/hqdefault.jpg',
    duration: '15:00',
    language: 'fr',
    category: 'ted_speech',
    tags: ['프랑스어', 'TEDx', '여성리더십', '스피치마스터', '쉐도잉'],
    source: 'curated_french',
  },
  {
    videoId: '2E_Kx-MBlEA',
    title: 'Les 6 règles pour avoir confiance en soi (자신감을 얻는 6가지 법칙) | Sally | TEDxBrussels',
    channelTitle: 'TEDx Talks',
    description: '자신감을 구축하고 두려움을 이겨내는 6가지 실행 전략 프랑스어 강연',
    thumbnailUrl: 'https://img.youtube.com/vi/2E_Kx-MBlEA/hqdefault.jpg',
    duration: '15:05',
    language: 'fr',
    category: 'ted_speech',
    tags: ['프랑스어', 'TEDx', '자신감', '동기부여', '쉐도잉'],
    source: 'curated_french',
  },
  {
    videoId: 'XU2R4CjH0o4',
    title: 'Shadowing French Speaking Practice (A2) | Simply French Podcast',
    channelTitle: 'Simply French Podcast',
    description: '원어민 일상 프랑스어를 한 문장씩 따라 말하며 억양과 연음을 다듬는 실전 쉐도잉',
    thumbnailUrl: 'https://img.youtube.com/vi/XU2R4CjH0o4/hqdefault.jpg',
    duration: '15:40',
    language: 'fr',
    category: 'conversation',
    tags: ['프랑스어', '팟캐스트', '실전회화', '연음훈련', '쉐도잉'],
    source: 'curated_french',
  },
];

export const DEFAULT_GERMAN_TRACKS = [
  {
    videoId: '_ACbNYfOmB0',
    title: 'Transformiere deine Rede: Storytelling für persönliches Wachstum | Tatjana Lackner | TEDx',
    channelTitle: 'TEDx Talks',
    description: '오스트리아 잘츠부르크 TEDx • 스피치 트레이너가 전하는 스토리텔링과 완벽한 독일어 딕션',
    thumbnailUrl: 'https://img.youtube.com/vi/_ACbNYfOmB0/hqdefault.jpg',
    duration: '18:06',
    language: 'de',
    category: 'ted_speech',
    tags: ['독일어', 'TEDx', '스토리텔링', '스피치훈련', '쉐도잉'],
    source: 'curated_german',
  },
  {
    videoId: 'VJeXOTN73xk',
    title: 'Auf der Suche nach echter Freundschaft (진정한 우정을 찾아서) | Lisa-Marie Schiffner | TEDx',
    channelTitle: 'TEDx Talks',
    description: '젊은 크리에이터가 전하는 진솔한 인간관계와 자기 가치관 독일어 스피치',
    thumbnailUrl: 'https://img.youtube.com/vi/VJeXOTN73xk/hqdefault.jpg',
    duration: '12:55',
    language: 'de',
    category: 'ted_speech',
    tags: ['독일어', 'TEDx', '인간관계', '감동토크', '쉐도잉'],
    source: 'curated_german',
  },
  {
    videoId: '0G_VatoYxps',
    title: 'Talking about my Daily Routine (B1) | Learn German with Podcast | Easy German',
    channelTitle: 'Easy German',
    description: 'Easy German • 하루 일과를 나누며 자연스러운 표준 독일어 회화와 억양을 익히는 팟캐스트',
    thumbnailUrl: 'https://img.youtube.com/vi/0G_VatoYxps/hqdefault.jpg',
    duration: '12:13',
    language: 'de',
    category: 'conversation',
    tags: ['독일어', 'EasyGerman', '일상회화', '표준독일어', '쉐도잉'],
    source: 'curated_german',
  },
  {
    videoId: 'Oev31FCvm6I',
    title: 'Learn to Speak German Without Thinking | Shadowing German Speaking Practice',
    channelTitle: 'German Shadowing',
    description: '생각하지 않고 바로 입에서 나오는 독일어 패턴 쉐도잉 집중 스피킹 훈련',
    thumbnailUrl: 'https://img.youtube.com/vi/Oev31FCvm6I/hqdefault.jpg',
    duration: '19:42',
    language: 'de',
    category: 'conversation',
    tags: ['독일어', '회화훈련', '패턴쉐도잉', '스피킹마스터'],
    source: 'curated_german',
  },
];

export function detectItemLanguage(item) {
  if (!item) return 'en';
  if (item.language && item.language !== 'unknown' && item.language !== 'all') return item.language;
  if (item.category === 'spanish' || item.source === 'curated_spanish' || item.id?.startsWith('es_')) return 'es';
  if (item.source === 'curated_japanese' || item.id?.startsWith('ja_')) return 'ja';
  if (item.source === 'curated_chinese' || item.id?.startsWith('zh_')) return 'zh';
  if (item.source === 'curated_french' || item.id?.startsWith('fr_')) return 'fr';
  if (item.source === 'curated_german' || item.id?.startsWith('de_')) return 'de';

  const text = `${item.title || ''} ${item.channelTitle || ''} ${item.description || ''}`.toLowerCase();
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja';
  if (/[\u4e00-\u9fa5]/.test(text)) return 'zh';
  if (text.includes('espanol') || text.includes('español') || text.includes('spanish') || text.includes('linguriosa') || text.includes('charla') || text.includes('hablar')) return 'es';
  if (text.includes('français') || text.includes('francais') || text.includes('french') || text.includes('champselysees') || text.includes('discours')) return 'fr';
  if (text.includes('deutsch') || text.includes('german') || text.includes('salzburg') || text.includes('stuttgart') || text.includes('rede')) return 'de';

  return 'en';
}

export function loadMultiLangTracks() {
  const all = [
    ...DEFAULT_SPANISH_TRACKS.map(t => ({
      id: `es_${t.videoId}`,
      videoId: t.videoId,
      title: t.title,
      channelTitle: t.channelTitle,
      description: t.description,
      thumbnailUrl: t.thumbnailUrl,
      url: `https://www.youtube.com/watch?v=${t.videoId}`,
      duration: t.duration,
      language: 'es',
      category: t.category || 'ted_speech',
      tags: t.tags,
      source: 'curated_spanish',
      bookmarked: false,
      addedAt: Date.now() - 40000,
    })),
    ...DEFAULT_JAPANESE_TRACKS.map(t => ({
      id: `ja_${t.videoId}`,
      videoId: t.videoId,
      title: t.title,
      channelTitle: t.channelTitle,
      description: t.description,
      thumbnailUrl: t.thumbnailUrl,
      url: `https://www.youtube.com/watch?v=${t.videoId}`,
      duration: t.duration,
      language: 'ja',
      category: t.category || 'conversation',
      tags: t.tags,
      source: 'curated_japanese',
      bookmarked: false,
      addedAt: Date.now() - 35000,
    })),
    ...DEFAULT_CHINESE_TRACKS.map(t => ({
      id: `zh_${t.videoId}`,
      videoId: t.videoId,
      title: t.title,
      channelTitle: t.channelTitle,
      description: t.description,
      thumbnailUrl: t.thumbnailUrl,
      url: `https://www.youtube.com/watch?v=${t.videoId}`,
      duration: t.duration,
      language: 'zh',
      category: t.category || 'ted_speech',
      tags: t.tags,
      source: 'curated_chinese',
      bookmarked: false,
      addedAt: Date.now() - 30000,
    })),
    ...DEFAULT_FRENCH_TRACKS.map(t => ({
      id: `fr_${t.videoId}`,
      videoId: t.videoId,
      title: t.title,
      channelTitle: t.channelTitle,
      description: t.description,
      thumbnailUrl: t.thumbnailUrl,
      url: `https://www.youtube.com/watch?v=${t.videoId}`,
      duration: t.duration,
      language: 'fr',
      category: t.category || 'ted_speech',
      tags: t.tags,
      source: 'curated_french',
      bookmarked: false,
      addedAt: Date.now() - 25000,
    })),
    ...DEFAULT_GERMAN_TRACKS.map(t => ({
      id: `de_${t.videoId}`,
      videoId: t.videoId,
      title: t.title,
      channelTitle: t.channelTitle,
      description: t.description,
      thumbnailUrl: t.thumbnailUrl,
      url: `https://www.youtube.com/watch?v=${t.videoId}`,
      duration: t.duration,
      language: 'de',
      category: t.category || 'ted_speech',
      tags: t.tags,
      source: 'curated_german',
      bookmarked: false,
      addedAt: Date.now() - 20000,
    })),
  ];
  return all;
}

export const loadSpanishTracks = () => loadMultiLangTracks().filter(t => t.language === 'es');

/**
 * Load YouTube links data from local JSON database
 */
export function loadYouTubeData() {
  let store;
  if (!existsSync(YOUTUBE_FILE)) {
    store = { lastCuratedAt: Date.now(), lastQuery: '', items: [] };
  } else {
    try {
      const raw = readFileSync(YOUTUBE_FILE, 'utf8');
      store = JSON.parse(raw);
      if (!store || !Array.isArray(store.items)) {
        store = { lastCuratedAt: Date.now(), lastQuery: '', items: [] };
      }
    } catch (e) {
      console.error('[YouTube Control] Error reading file:', e.message);
      store = { lastCuratedAt: Date.now(), lastQuery: '', items: [] };
    }
  }

  // Ensure items have normalized language field
  store.items.forEach(item => {
    item.language = detectItemLanguage(item);
    if (item.category === 'spanish') item.category = 'ted_speech';
  });

  // Ensure Pop Music tracks & Multi-lingual tracks are merged
  const popTracks = loadPopMusicTracks();
  const multiTracks = loadMultiLangTracks();
  const existingVideoIds = new Set(store.items.map(i => i.videoId));
  let modified = false;

  if (popTracks.length > 0) {
    for (const popTrack of popTracks) {
      if (!existingVideoIds.has(popTrack.videoId)) {
        popTrack.language = 'en';
        store.items.push(popTrack);
        existingVideoIds.add(popTrack.videoId);
        modified = true;
      }
    }
  }

  if (multiTracks.length > 0) {
    for (const track of multiTracks) {
      if (!existingVideoIds.has(track.videoId)) {
        store.items.push(track);
        existingVideoIds.add(track.videoId);
        modified = true;
      }
    }
  }

  if (modified) {
    saveYouTubeData(store);
  }

  return store;
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
export function getYouTubeLinks({ filter = 'all', language = 'all', category = 'all', search = '' } = {}) {
  const store = loadYouTubeData();
  let list = store.items || [];

  // Normalize language for all items
  list.forEach(item => {
    item.language = detectItemLanguage(item);
    if (item.category === 'education_sci' || item.category === 'career_mind' || item.category === 'diction_essay') {
      item.category = 'essay_deep';
    }
  });

  if (filter === 'bookmarked') {
    list = list.filter(item => item.bookmarked);
  } else if (filter === 'unbookmarked') {
    list = list.filter(item => !item.bookmarked);
  }

  if (language && language !== 'all') {
    list = list.filter(item => item.language === language);
  }

  if (category && category !== 'all') {
    if (category === 'sleep_life') {
      list = list.filter(item => {
        const secs = parseDurationInSeconds(item.duration);
        return item.category === 'sleep_life' || secs >= 3600;
      });
    } else if (category === 'pop_music') {
      list = list.filter(item => item.category === 'pop_music' || item.source === 'ytmusic_pop');
    } else if (category === 'conversation') {
      list = list.filter(item => item.category === 'conversation' || item.tags?.includes('회화') || item.tags?.includes('팟캐스트'));
    } else {
      list = list.filter(item => item.category === category);
    }
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

  // Calculate language counts
  const langCounts = { all: store.items.length };
  LANGUAGES.forEach(l => {
    if (l.id !== 'all') {
      langCounts[l.id] = store.items.filter(i => (i.language || detectItemLanguage(i)) === l.id).length;
    }
  });

  return {
    items: list,
    total: store.items.length,
    filteredCount: list.length,
    watchLaterCount: store.items.filter(i => i.bookmarked).length,
    lastCuratedAt: store.lastCuratedAt || null,
    lastQuery: store.lastQuery || '',
    languages: LANGUAGES,
    langCounts,
    subCategories: SUB_CATEGORIES,
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
  const preservedItems = store.items.filter(i => i.bookmarked || i.category === 'pop_music' || i.source === 'user_direct_add' || i.source === 'ytmusic_pop');
  const removedCount = store.items.length - preservedItems.length;
  store.items = preservedItems;
  saveYouTubeData(store);
  return { removedCount, preservedBookmarkedCount: store.items.filter(i => i.bookmarked).length };
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
 * Determine category between categories: 'ted_speech' vs 'essay_deep' vs 'sleep_life'
 */
export function determineCategory(title = '', query = '', durationStr = '') {
  const text = `${title} ${query}`.toLowerCase();
  const secs = parseDurationInSeconds(durationStr);

  // 1. Spanish Shadowing (TED en Español, Spanish speeches, Linguriosa, Spanish podcasts)
  if (
    text.includes('espanol') ||
    text.includes('español') ||
    text.includes('spanish') ||
    text.includes('linguriosa') ||
    text.includes('charla') ||
    text.includes('aprender espanol') ||
    text.includes('conversacion') ||
    text.includes('hablar') ||
    text.includes('pronunciacion') ||
    text.includes('liderazgo')
  ) {
    return 'spanish';
  }

  // 2. Sleep & Long-form Life Stories / Deep Talks (>= 60 minutes, or sleep/intimate podcast >= 40 minutes)
  if (
    secs >= 3600 ||
    ((text.includes('sleep') || text.includes('bedtime') || text.includes('life story') || text.includes('anything goes') || text.includes('slight change of plans') || text.includes('call her daddy') || text.includes('full episode') || text.includes('podcast')) && secs >= 2400)
  ) {
    return 'sleep_life';
  }

  // 3. TED & speech
  if (
    text.includes('ted') ||
    text.includes('speech') ||
    text.includes('commencement') ||
    text.includes('keynote') ||
    text.includes('address') ||
    text.includes('stage') ||
    text.includes('presentation') ||
    text.includes('oxford union')
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
        item.detectedCategory = determineCategory(item.title, q, item.duration);
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

  const preservedItems = store.items.filter(item => item.bookmarked || item.source === 'user_direct_add' || item.category === 'pop_music' || item.source === 'ytmusic_pop');
  // Normalize preserved bookmarks categories as well (excluding pop_music and sleep_life)
  preservedItems.forEach(item => {
    if (item.category !== 'ted_speech' && item.category !== 'essay_deep' && item.category !== 'sleep_life' && item.category !== 'pop_music') {
      item.category = determineCategory(item.title, '');
    }
  });

  let finalItems = replaceExisting 
    ? [...preservedItems, ...curatedItems]
    : [...preservedItems, ...curatedItems, ...store.items.filter(i => !i.bookmarked && i.category !== 'pop_music' && i.source !== 'user_direct_add' && i.source !== 'ytmusic_pop')];

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
