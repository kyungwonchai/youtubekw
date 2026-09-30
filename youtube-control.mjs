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
  { id: 'es', code: 'es', name: '스페인어', flag: '🇪🇸', label: '🇪🇸 스페인어 (Español)', ttsLang: 'es-ES', desc: 'TED en Español, 카스티야 딕션 1타 Linguriosa, 감동 에세이 & 실전 회화' },
  { id: 'zh', code: 'zh', name: '중국어', flag: '🇨🇳', label: '🇨🇳 중국어 (中文)', ttsLang: 'zh-CN', desc: 'TEDx 표준 중국어 명강연, 감정 조절/뇌과학 에세이, 북리뷰' },
  { id: 'vi', code: 'vi', name: '베트남어', flag: '🇻🇳', label: '🇻🇳 베트남어 (Tiếng Việt)', ttsLang: 'vi-VN', desc: 'Sunhuyn/Giang Ơi 하노이 표준 명품 딕션, 인생 철학 에세이 & 슬로우 라이프' },
  { id: 'id', code: 'id', name: '인니어', flag: '🇮🇩', label: '🇮🇩 인니어 (Bahasa Indonesia)', ttsLang: 'id-ID', desc: 'Gita Savitri Devi/Menjadi Manusia 명품 에세이, 인생 이야기 & 힐링 팟캐스트' },
  { id: 'hi', code: 'hi', name: '힌디어', flag: '🇮🇳', label: '🇮🇳 힌디어 (हिन्दी)', ttsLang: 'hi-IN', desc: 'Josh Talks 여성 명사 감동 실화, 인생 극복 스토리텔링 & 북리뷰' },
];

/**
 * Format / Topic Subcategories (소카테고리: 주제 및 포맷별 선택)
 */
export const SUB_CATEGORIES = [
  { id: 'all', label: '✨ 전체 주제', icon: '✨', desc: '선택한 언어의 모든 주제' },
  { id: 'news_interview', label: '📰 뉴스 & 명사 초대석 (여성 100%)', icon: '📰', desc: '초미녀 아나운서의 브리핑 & 지적인 여성 리더 1:1 심층 초대석' },
  { id: 'movie_drama', label: '🎬 드라마 & 영화 (1h+)', icon: '🎬', desc: '풀버전 로맨스/드라마 영화 & 1시간 감성 스토리 쉐도잉' },
  { id: 'pop_music', label: '🎵 감성 발라드 & 노래', icon: '🎵', desc: '댄스 제외! 서정적인 명품 발라드 & 어쿠스틱 팝 가사 싱크 쉐도잉' },
  { id: 'sleep_life', label: '🌙 수면 & 롱폼 딥토크 (1h+)', icon: '🌙', desc: '취침·휴식 시 듣기 좋은 60분+ 차분한 롱폼 스토리텔링' },
  { id: 'ted_speech', label: '🎤 TED & 명품 강연', icon: '🎤', desc: '대중 스피치, TED/TEDx 명강연 및 프레젠테이션' },
  { id: 'essay_deep', label: '📚 에세이 & 마인드셋', icon: '📚', desc: '기업가정신, 인생 가치관, 심층 대담 및 마인드셋' },
  { id: 'conversation', label: '🗣️ 실전 회화 & 팟캐스트', icon: '🗣️', desc: '원어민 일상 대화, 딕션 훈련 및 실전 회화 팟캐스트' },
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
  'father', 'dad', 'brother', 'son', 'gentleman', 'gentlemen', ' mr ', 'mr.', 'sir',
  'jack', 'john', 'david', 'michael', 'james', 'robert', 'william', 'thomas', 'daniel', 'matthew',
  'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua', 'kenneth', 'kevin', 'brian',
  'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas',
  'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon', 'benjamin', 'samuel', 'gregory',
  'alexander', 'patrick', 'frank', 'raymond', 'dennis', 'jerry', 'tyler', 'aaron', 'jose',
  'adam', 'nathan', 'henry', 'douglas', 'zachary', 'peter', 'kyle', 'walter', 'ethan', 'jeremy',
  'harold', 'keith', 'roger', 'noah', 'gerald', 'carl', 'terry', 'sean', 'austin',
  'arthur', 'lawrence', 'jesse', 'dylan', 'bryan', 'joe', 'jordan', 'billy', 'bruce', 'albert',
  'willie', 'gabriel', 'logan', 'alan', 'juan', 'wayne', 'roy', 'ralph', 'randy', 'eugene',
  'vincent', 'russell', 'louis', 'philip', 'bobby', 'johnny', 'bradley', 'martin', 'neil', 'luke',
  'elliott', 'elliot', 'liam', 'oliver', 'lucas', 'mason', 'sebastian', 'owen',
  'theodore', 'wyatt', 'jayden', 'matteo', 'julian', 'leo', 'ezra', 'harrison',
  'pewdiepie', 'clint', 'steve', 'mike', 'dave', 'tom', 'chris', 'dan', 'matt', 'sam', 'ian',
  'shetty', 'abdaal', 'charles', 'moseley', 'roland frasier', 'simon sinek', 'huberman', 'peterson',
  'jensen huang', 'shashi tharoor', 'konstantin kisin', 'mehdi hasan', 'raj persaud',
  'bon iver', 'rauw alejandro', 'zzoilo', 'khalid', 'vincent podcast', 'rich roll', 'doug bopst', 'viall files'
];

const TRASH_KEYWORDS = [
  // 종교 / 교회 / 천주교 / 찬송가 / 찬양 (엄격 영구 차단)
  'church', 'jesus', 'christ', 'gospel', 'worship', 'pastor', 'christian', 'catholic', 'bible', 'pray',
  '찬송', '찬양', '교회', '예수', '성경', '목사', '천주교', '성당', '신부', 'hymn', 'iglesia', 'dios', 'catolica',

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

  // 불필요한 국내 취준/먹방 잡담 브이로그
  'vlog in korea', 'korea vlog', 'seoul vlog', '취준생 브이로그', '자취생 브이로그', '먹방 브이로그',

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

export const DEFAULT_NEWS_INTERVIEW_TRACKS = [
  {
    videoId: 'zxTMjX1U2HI',
    title: 'Melinda French Gates on Tech, Wealth & Purpose | Bloomberg Originals (Emily Chang)',
    channelTitle: 'Bloomberg Originals',
    description: 'Emily Chang (블룸버그 간판 여성 앵커) & Melinda French Gates • 기술의 미래, 자선사업, 진정한 가치관에 대한 1:1 심층 초대석 인터뷰 (24분, 완벽한 표준 미국식 딕션)',
    thumbnailUrl: 'https://img.youtube.com/vi/zxTMjX1U2HI/hqdefault.jpg',
    duration: '23:53',
    language: 'en',
    category: 'news_interview',
    tags: ['뉴스초대석', 'Bloomberg', 'EmilyChang', 'MelindaGates', '명품인터뷰'],
    source: 'curated_news',
  },
  {
    videoId: 'AbzHJktYCa8',
    title: 'Sheryl Sandberg: Bloomberg Studio 1.0 with Emily Chang (Full Interview)',
    channelTitle: 'Bloomberg Television',
    description: 'Emily Chang & Sheryl Sandberg (전 메타 COO) • 여성 리더십, 린인(Lean In), 위기 극복에 관한 24분 심층 대담',
    thumbnailUrl: 'https://img.youtube.com/vi/AbzHJktYCa8/hqdefault.jpg',
    duration: '24:17',
    language: 'en',
    category: 'news_interview',
    tags: ['뉴스초대석', 'Bloomberg', 'SherylSandberg', '여성리더십', '고급영어'],
    source: 'curated_news',
  },
  {
    videoId: 'UMzma1aATAU',
    title: 'Crypto Investor Katie Haun on Bloomberg Studio 1.0 with Emily Chang',
    channelTitle: 'Bloomberg Tech',
    description: 'Emily Chang & Katie Haun (전 미 연방검사 / 실리콘밸리 톱 투자자) • 명쾌한 논리와 빠른 템포의 비즈니스 딕션 인터뷰 (24분)',
    thumbnailUrl: 'https://img.youtube.com/vi/UMzma1aATAU/hqdefault.jpg',
    duration: '24:07',
    language: 'en',
    category: 'news_interview',
    tags: ['뉴스초대석', 'Bloomberg', 'KatieHaun', '투자자인터뷰', '실전비즈니스'],
    source: 'curated_news',
  },
  {
    videoId: '1PGi5QDAob4',
    title: "Savannah Guthrie's In-Depth Conversation With Hoda Kotb (TODAY Extended Cut)",
    channelTitle: 'NBC TODAY',
    description: 'Savannah Guthrie (NBC 대표 앵커) & Hoda Kotb • 두 여성 메인 앵커가 나누는 진솔한 인생, 뉴스 비하인드, 삶의 지혜 (35분 대화)',
    thumbnailUrl: 'https://img.youtube.com/vi/1PGi5QDAob4/hqdefault.jpg',
    duration: '35:28',
    language: 'en',
    category: 'news_interview',
    tags: ['뉴스초대석', 'NBCTODAY', 'SavannahGuthrie', 'HodaKotb', '진솔한대화'],
    source: 'curated_news',
  },
  {
    videoId: '5fTFGGycba8',
    title: "CNBC's Full Interview with Accenture CEO Julie Sweet (Global Business Leader)",
    channelTitle: 'CNBC International Live',
    description: 'CNBC 대표 여성 앵커 & Julie Sweet (액센츄어 글로벌 CEO) • 세계 경제와 AI 혁신, 기업가정신을 다룬 12분 심층 인터뷰',
    thumbnailUrl: 'https://img.youtube.com/vi/5fTFGGycba8/hqdefault.jpg',
    duration: '11:58',
    language: 'en',
    category: 'news_interview',
    tags: ['뉴스초대석', 'CNBC', 'JulieSweet', 'CEO인터뷰', '비즈니스영어'],
    source: 'curated_news',
  },
];

export const DEFAULT_MOVIE_DRAMA_TRACKS = [
  {
    videoId: 'z78cxeY6acE',
    title: 'IT HAD TO BE YOU | Full Romance Comedy & Drama Movie (1h 35m)',
    channelTitle: 'The Cinematics Stories',
    description: 'Natasha Henstridge, Michael Vartan • 뉴욕 배경 로맨틱 코미디 & 드라마 풀버전 영화 쉐도잉 (1시간 35분, 또렷한 영어 대사)',
    thumbnailUrl: 'https://img.youtube.com/vi/z78cxeY6acE/hqdefault.jpg',
    duration: '1:35:56',
    language: 'en',
    category: 'movie_drama',
    tags: ['영화쉐도잉', '로맨스영화', '풀버전영화', '영어회화', '롱폼쉐도잉'],
    source: 'curated_movie',
  },
  {
    videoId: 'PMeHdc25BGE',
    title: 'LOST IN LOVE | Stranded Together in Turkey | Full Romance Movie (1h 26m)',
    channelTitle: 'SparkTV Romance',
    description: '낭만적인 여행지에서 펼쳐지는 로맨스 드라마 풀버전 영화 & 일상 영어 대화 쉐도잉 (1시간 26분)',
    thumbnailUrl: 'https://img.youtube.com/vi/PMeHdc25BGE/hqdefault.jpg',
    duration: '1:26:47',
    language: 'en',
    category: 'movie_drama',
    tags: ['영화쉐도잉', '로맨스드라마', '풀버전영화', '실전회화'],
    source: 'curated_movie',
  },
  {
    videoId: '9GW7F08B5U4',
    title: 'The Mystery of Love | ROMANCE, DRAMA | Full Movie in English (1h 28m)',
    channelTitle: 'Boxoffice Romance',
    description: '감성적인 사랑과 삶의 갈등을 그린 정통 로맨스 드라마 풀무비 (1시간 28분)',
    thumbnailUrl: 'https://img.youtube.com/vi/9GW7F08B5U4/hqdefault.jpg',
    duration: '1:28:58',
    language: 'en',
    category: 'movie_drama',
    tags: ['영화쉐도잉', '감성드라마', '풀버전영화', '영어듣기'],
    source: 'curated_movie',
  },
  {
    videoId: '76PzE22igls',
    title: '1 hour of advice that will change your life | Solace (Deep Life Reflection)',
    channelTitle: 'solace',
    description: 'Solace • 20대 여성 크리에이터의 감성적이고 차분한 1시간 33분 인생 성찰 & 힐링 롱폼 에세이',
    thumbnailUrl: 'https://img.youtube.com/vi/76PzE22igls/hqdefault.jpg',
    duration: '1:33:32',
    language: 'en',
    category: 'movie_drama',
    tags: ['인생이야기', '감성에세이', '수면롱폼', '차분한목소리', '1시간'],
    source: 'curated_movie',
  },
  {
    videoId: '-e5dh1qHTs4',
    title: '1 hour of dating & relationship advice that will change your life | Solace',
    channelTitle: 'solace',
    description: 'Solace • 사랑과 인간관계, 내면의 성장에 대한 솔직하고 진솔한 1시간 6분 딥토크',
    thumbnailUrl: 'https://img.youtube.com/vi/-e5dh1qHTs4/hqdefault.jpg',
    duration: '1:06:23',
    language: 'en',
    category: 'movie_drama',
    tags: ['인간관계', '감성토크', '힐링오디오', '1시간대담'],
    source: 'curated_movie',
  },
  {
    videoId: 'v1KWZ-SsrLk',
    title: '9 Lifestyle Changes That Let You Feel Rich At Any Income | The Financial Diet',
    channelTitle: 'The Financial Diet (Chelsea Fagan)',
    description: 'Chelsea Fagan • 또렷하고 우아한 미국식 딕션, 삶의 질을 높이는 라이프스타일 지혜 (20분 에세이)',
    thumbnailUrl: 'https://img.youtube.com/vi/v1KWZ-SsrLk/hqdefault.jpg',
    duration: '20:16',
    language: 'en',
    category: 'essay_deep',
    tags: ['TheFinancialDiet', 'ChelseaFagan', '라이프스타일', '명품딕션', '에세이'],
    source: 'curated_movie',
  },
  {
    videoId: '-f6Io1jUO4s',
    title: 'Day In the Life on a lazy Sunday | Overthinking and am I Happy?... | Sanne Vloet',
    channelTitle: 'Sanne Vloet',
    description: 'Sanne Vloet • 네덜란드 출신 모델 & 웰니스 크리에이터의 평온한 일상과 행복에 관한 진솔한 생각 (17분)',
    thumbnailUrl: 'https://img.youtube.com/vi/-f6Io1jUO4s/hqdefault.jpg',
    duration: '16:53',
    language: 'en',
    category: 'essay_deep',
    tags: ['SanneVloet', '웰니스', '마음챙김', '차분한일상', '쉐도잉'],
    source: 'curated_movie',
  },
];

export const DEFAULT_ENGLISH_POP_TRACKS = [
  // Adele (Emotional Ballads)
  {
    videoId: 'YQHsXMglC9A',
    title: 'Adele - Hello (Official Music Video)',
    channelTitle: 'Adele',
    artist: 'Adele',
    album: '25',
    description: 'Adele • 깊은 감정선과 완벽한 영국식 발음의 불후의 명품 발라드 & 가사 싱크 쉐도잉',
    thumbnailUrl: 'https://img.youtube.com/vi/YQHsXMglC9A/hqdefault.jpg',
    duration: '6:07',
    category: 'pop_music',
    tags: ['영어발라드', 'Adele', '명품보컬', '감성팝', '가사쉐도잉'],
    source: 'curated_pop',
  },
  {
    videoId: 'hLQl3WQQoQ0',
    title: 'Adele - Someone Like You (Official Music Video)',
    channelTitle: 'Adele',
    artist: 'Adele',
    album: '21',
    description: 'Adele • 피아노 선율과 호소력 짙은 보컬, 전 세계를 울린 감성 발라드',
    thumbnailUrl: 'https://img.youtube.com/vi/hLQl3WQQoQ0/hqdefault.jpg',
    duration: '4:45',
    category: 'pop_music',
    tags: ['영어발라드', 'Adele', '피아노발라드', '가사쉐도잉'],
    source: 'curated_pop',
  },
  {
    videoId: 'ffcitRgiNDs',
    title: 'Adele - Easy On Me (Live NRJ Awards)',
    channelTitle: 'Adele',
    artist: 'Adele',
    album: '30',
    description: 'Adele • 부드럽고 차분한 라이브 어쿠스틱 발라드 & 섬세한 딕션 훈련',
    thumbnailUrl: 'https://img.youtube.com/vi/ffcitRgiNDs/hqdefault.jpg',
    duration: '3:48',
    category: 'pop_music',
    tags: ['영어발라드', 'Adele', 'EasyOnMe', '어쿠스틱'],
    source: 'curated_pop',
  },
  {
    videoId: 'RDRwqTNLGDs',
    title: "Adele - Don't You Remember (Live at Largo)",
    channelTitle: 'Adele',
    artist: 'Adele',
    album: '21',
    description: 'Adele • 어쿠스틱 기타와 애절한 음색이 돋보이는 라이브 발라드 명곡',
    thumbnailUrl: 'https://img.youtube.com/vi/RDRwqTNLGDs/hqdefault.jpg',
    duration: '4:16',
    category: 'pop_music',
    tags: ['영어발라드', 'Adele', '어쿠스틱라이브', '가사쉐도잉'],
    source: 'curated_pop',
  },

  // Lana Del Rey (Cinematic & Melancholic Ballads)
  {
    videoId: 'mjcX-5lKdeg',
    title: 'Lana Del Rey - Young and Beautiful (The Great Gatsby Soundtrack)',
    channelTitle: 'Lana Del Rey',
    artist: 'Lana Del Rey',
    album: 'The Great Gatsby',
    description: 'Lana Del Rey • 영화 위대한 개츠비 OST & 몽환적이고 아름다운 시네마틱 발라드',
    thumbnailUrl: 'https://img.youtube.com/vi/mjcX-5lKdeg/hqdefault.jpg',
    duration: '3:57',
    category: 'pop_music',
    tags: ['영어발라드', 'LanaDelRey', '영화OST', '몽환적발라드', '가사쉐도잉'],
    source: 'curated_pop',
  },
  {
    videoId: 'TdrL3QxjyVw',
    title: 'Lana Del Rey - Summertime Sadness (Official Music Video)',
    channelTitle: 'Lana Del Rey',
    artist: 'Lana Del Rey',
    album: 'Born to Die',
    description: 'Lana Del Rey • 서정적인 멜로디와 독보적인 빈티지 감성의 명곡',
    thumbnailUrl: 'https://img.youtube.com/vi/TdrL3QxjyVw/hqdefault.jpg',
    duration: '4:26',
    category: 'pop_music',
    tags: ['영어발라드', 'LanaDelRey', '감성팝', '가사쉐도잉'],
    source: 'curated_pop',
  },
  {
    videoId: 'cE6wxDqdOV0',
    title: 'Lana Del Rey - Video Games (Official Music Video)',
    channelTitle: 'Lana Del Rey',
    artist: 'Lana Del Rey',
    album: 'Born to Die',
    description: 'Lana Del Rey • 라나 델 레이를 세상에 알린 서정적인 클래식 발라드',
    thumbnailUrl: 'https://img.youtube.com/vi/cE6wxDqdOV0/hqdefault.jpg',
    duration: '4:47',
    category: 'pop_music',
    tags: ['영어발라드', 'LanaDelRey', '클래식발라드', '가사쉐도잉'],
    source: 'curated_pop',
  },

  // Gracie Abrams (Heartfelt Acoustic Ballads)
  {
    videoId: 'uxjhN_Donfw',
    title: 'Gracie Abrams - I Love You, I’m Sorry (Official Music Video)',
    channelTitle: 'Gracie Abrams',
    artist: 'Gracie Abrams',
    album: 'The Secret of Us',
    description: 'Gracie Abrams • 감미롭고 속삭이듯 부르는 어쿠스틱 감성 발라드 & 선명한 영어 발음',
    thumbnailUrl: 'https://img.youtube.com/vi/uxjhN_Donfw/hqdefault.jpg',
    duration: '3:54',
    category: 'pop_music',
    tags: ['영어발라드', 'GracieAbrams', '어쿠스틱', '감성팝', '가사쉐도잉'],
    source: 'curated_pop',
  },
  {
    videoId: 'BDHM8cyJQa8',
    title: 'Gracie Abrams - That’s So True (Official Lyric Video)',
    channelTitle: 'Gracie Abrams',
    artist: 'Gracie Abrams',
    album: 'The Secret of Us',
    description: 'Gracie Abrams • 진솔하고 서정적인 가사 & 따뜻한 어쿠스틱 사운드',
    thumbnailUrl: 'https://img.youtube.com/vi/BDHM8cyJQa8/hqdefault.jpg',
    duration: '2:47',
    category: 'pop_music',
    tags: ['영어발라드', 'GracieAbrams', '가사쉐도잉', '어쿠스틱'],
    source: 'curated_pop',
  },

  // Taylor Swift (Ballads & Folk Masterpieces)
  {
    videoId: 'wMpqCRF7TKg',
    title: 'Taylor Swift - champagne problems (Official Lyric Video)',
    channelTitle: 'Taylor Swift',
    artist: 'Taylor Swift',
    album: 'evermore',
    description: 'Taylor Swift • 피아노 선율과 시적인 스토리텔링이 어우러진 최고 명품 발라드',
    thumbnailUrl: 'https://img.youtube.com/vi/wMpqCRF7TKg/hqdefault.jpg',
    duration: '4:08',
    category: 'pop_music',
    tags: ['영어발라드', 'TaylorSwift', 'champagneproblems', '피아노발라드', '가사쉐도잉'],
    source: 'curated_pop',
  },
  {
    videoId: 'osdoLjUNFnA',
    title: 'Taylor Swift – exile (feat. Bon Iver) (Official Lyric Video)',
    channelTitle: 'Taylor Swift',
    artist: 'Taylor Swift',
    album: 'folklore',
    description: 'Taylor Swift & Bon Iver • 깊은 감정의 대화를 담은 서정적인 듀엣 발라드',
    thumbnailUrl: 'https://img.youtube.com/vi/osdoLjUNFnA/hqdefault.jpg',
    duration: '4:47',
    category: 'pop_music',
    tags: ['영어발라드', 'TaylorSwift', 'BonIver', '포크발라드', '가사쉐도잉'],
    source: 'curated_pop',
  },
  {
    videoId: 'BZ-rLBkUZf4',
    title: "Taylor Swift - All Too Well (10 Minute Version) (Taylor's Version) Lyric Video",
    channelTitle: 'Taylor Swift',
    artist: 'Taylor Swift',
    album: 'Red (Taylor Version)',
    description: 'Taylor Swift • 10분간 이어지는 문학적인 가사와 서사적인 빌드업 마스터피스',
    thumbnailUrl: 'https://img.youtube.com/vi/BZ-rLBkUZf4/hqdefault.jpg',
    duration: '10:13',
    category: 'pop_music',
    tags: ['영어발라드', 'TaylorSwift', 'AllTooWell', '10분발라드', '가사쉐도잉'],
    source: 'curated_pop',
  },
  {
    videoId: 'Kwlb3orsJYU',
    title: 'Taylor Swift - Lover (Official Music Video)',
    channelTitle: 'Taylor Swift',
    artist: 'Taylor Swift',
    album: 'Lover',
    description: 'Taylor Swift • 따뜻하고 로맨틱한 멜로디 & 차분하고 부드러운 어쿠스틱 보컬 쉐도잉',
    thumbnailUrl: 'https://img.youtube.com/vi/Kwlb3orsJYU/hqdefault.jpg',
    duration: '3:58',
    category: 'pop_music',
    tags: ['영어발라드', 'TaylorSwift', 'Lover', '감성팝'],
    source: 'curated_pop',
  },
  {
    videoId: 'K-a8s8OLBSE',
    title: 'Taylor Swift - cardigan (Official Music Video)',
    channelTitle: 'Taylor Swift',
    artist: 'Taylor Swift',
    album: 'folklore',
    description: 'Taylor Swift • 그래미 올해의 앨범상 수상작 & 깊은 서정성과 시적인 영어 가사',
    thumbnailUrl: 'https://img.youtube.com/vi/K-a8s8OLBSE/hqdefault.jpg',
    duration: '4:35',
    category: 'pop_music',
    tags: ['영어발라드', 'TaylorSwift', 'Cardigan', '포크팝', '감성에세이'],
    source: 'curated_pop',
  },

  // Billie Eilish (Slow & Acoustic Ballads)
  {
    videoId: 'cW8VLC9nnTo',
    title: 'Billie Eilish - What Was I Made For? (From Barbie The Album)',
    channelTitle: 'Billie Eilish',
    artist: 'Billie Eilish',
    album: 'Barbie The Album',
    description: 'Billie Eilish • 오스카 & 그래미 올해의 노래상 수상 & 속삭이는 듯 맑고 섬세한 피아노 발라드',
    thumbnailUrl: 'https://img.youtube.com/vi/cW8VLC9nnTo/hqdefault.jpg',
    duration: '4:09',
    category: 'pop_music',
    tags: ['영어발라드', 'BillieEilish', 'WhatWasIMadeFor', '오스카수상', '피아노발라드'],
    source: 'curated_pop',
  },
  {
    videoId: 'viimfQi_pUw',
    title: 'Billie Eilish - ocean eyes (Official Music Video)',
    channelTitle: 'Billie Eilish',
    artist: 'Billie Eilish',
    album: 'dont smile at me',
    description: 'Billie Eilish • 맑고 서정적인 음색과 꿈결 같은 보컬 쉐도잉',
    thumbnailUrl: 'https://img.youtube.com/vi/viimfQi_pUw/hqdefault.jpg',
    duration: '3:21',
    category: 'pop_music',
    tags: ['영어발라드', 'BillieEilish', 'oceaneyes', '서정적발라드'],
    source: 'curated_pop',
  },
  {
    videoId: 'pbMwTqkKSps',
    title: "Billie Eilish - when the party's over (Official Music Video)",
    channelTitle: 'Billie Eilish',
    artist: 'Billie Eilish',
    album: 'WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?',
    description: 'Billie Eilish • 피아노와 화음만으로 공간을 채우는 압도적 감성의 발라드',
    thumbnailUrl: 'https://img.youtube.com/vi/pbMwTqkKSps/hqdefault.jpg',
    duration: '3:14',
    category: 'pop_music',
    tags: ['영어발라드', 'BillieEilish', 'whenthepartysover', '피아노발라드'],
    source: 'curated_pop',
  },
];

/**
 * Load pop music tracks (Olivia Rodrigo, Billie Eilish, Dua Lipa, Sabrina Carpenter, Taylor Swift)
 */
export function loadPopMusicTracks() {
  const tracks = [];
  const seen = new Set();

  // 1. Curated English Pop Queens (Dua Lipa, Sabrina Carpenter, Taylor Swift)
  for (const t of DEFAULT_ENGLISH_POP_TRACKS) {
    if (!t.videoId || seen.has(t.videoId)) continue;
    seen.add(t.videoId);
    tracks.push({
      id: `pop_${t.videoId}`,
      videoId: t.videoId,
      title: t.title,
      channelTitle: t.channelTitle || t.artist,
      description: t.description,
      thumbnailUrl: t.thumbnailUrl || `https://i.ytimg.com/vi/${t.videoId}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${t.videoId}`,
      duration: t.duration || '3:30',
      category: 'pop_music',
      artist: t.artist,
      album: t.album || '',
      language: 'en',
      tags: t.tags || ['영어팝송', '가사쉐도잉'],
      source: 'curated_pop',
      bookmarked: false,
      addedAt: Date.now() - 50000,
    });
  }

  // 2. Load Olivia Rodrigo & Billie Eilish from ytmusic
  if (existsSync(MUSIC_FILE)) {
    try {
      const raw = readFileSync(MUSIC_FILE, 'utf8');
      const data = JSON.parse(raw);
      const playlists = data.playlists || [];

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
            language: 'en',
            source: 'ytmusic_pop',
            bookmarked: false,
            addedAt: Date.now() - 48000,
          });
        }
      }
    } catch (e) {
      console.error('[YouTube Control] Error loading music.json pop tracks:', e.message);
    }
  }

  return tracks;
}

export const DEFAULT_SPANISH_TRACKS = [
  // Spanish Pop Music (ROSALÍA, Aitana, Becky G)
  {
    videoId: 'Mq7gC2gLPLI',
    title: 'ROSALÍA - DESPECHÁ (Official Video)',
    channelTitle: 'ROSALÍA',
    artist: 'ROSALÍA',
    description: 'ROSALÍA • 전 세계를 강타한 스페인어 라틴 팝 메가히트곡 & 경쾌한 가사 쉐도잉',
    thumbnailUrl: 'https://img.youtube.com/vi/Mq7gC2gLPLI/hqdefault.jpg',
    duration: '2:40',
    category: 'pop_music',
    tags: ['스페인어', 'ROSALÍA', '라틴팝', '가사쉐도잉', '스페인어노래'],
    source: 'curated_spanish',
  },
  {
    videoId: '3d3eXWowX1Y',
    title: 'ROSALÍA, Rauw Alejandro - BESO (Official Video)',
    channelTitle: 'ROSALÍA',
    artist: 'ROSALÍA',
    description: 'ROSALÍA & Rauw Alejandro • 감미롭고 로맨틱한 스페인어 듀엣 & 딕션 싱크 쉐도잉',
    thumbnailUrl: 'https://img.youtube.com/vi/3d3eXWowX1Y/hqdefault.jpg',
    duration: '3:20',
    category: 'pop_music',
    tags: ['스페인어', 'ROSALÍA', '스페인어노래', '가사쉐도잉'],
    source: 'curated_spanish',
  },
  {
    videoId: 'x4WX5IP5Ju0',
    title: 'Aitana, Nicki Nicole - Formentera (Official Video)',
    channelTitle: 'Aitana',
    artist: 'Aitana',
    description: 'Aitana • 스페인 대표 팝스타 Aitana의 세련된 일렉트로 팝 & 또렷한 카스티야 딕션',
    thumbnailUrl: 'https://img.youtube.com/vi/x4WX5IP5Ju0/hqdefault.jpg',
    duration: '3:26',
    category: 'pop_music',
    tags: ['스페인어', 'Aitana', '스페인어노래', '가사쉐도잉', '스페인팝'],
    source: 'curated_spanish',
  },
  {
    videoId: 'o2tdLOK7-PE',
    title: 'zzoilo, Aitana - Mon Amour (Remix)',
    channelTitle: 'zzoilo & Aitana',
    artist: 'Aitana',
    description: 'Aitana & zzoilo • 유럽 전역을 사로잡은 밝고 청량한 팝송 & 쉬운 스페인어 가사 훈련',
    thumbnailUrl: 'https://img.youtube.com/vi/o2tdLOK7-PE/hqdefault.jpg',
    duration: '3:00',
    category: 'pop_music',
    tags: ['스페인어', 'Aitana', 'MonAmour', '스페인어노래', '가사쉐도잉'],
    source: 'curated_spanish',
  },
  {
    videoId: 'XUctUGKs1Sc',
    title: 'Aitana - Los Ángeles (Official Video)',
    channelTitle: 'Aitana',
    artist: 'Aitana',
    description: 'Aitana • 트렌디한 클럽 하우스 비트 & 속도감 있는 스페인어 리듬 트레이닝',
    thumbnailUrl: 'https://img.youtube.com/vi/XUctUGKs1Sc/hqdefault.jpg',
    duration: '2:40',
    category: 'pop_music',
    tags: ['스페인어', 'Aitana', 'LosAngeles', '스페인어노래'],
    source: 'curated_spanish',
  },
  {
    videoId: 'XK06sajscPg',
    title: 'Becky G, KAROL G - MAMIII (Audio)',
    channelTitle: 'Becky G',
    artist: 'Becky G',
    description: 'Becky G & KAROL G • 당당하고 에너지 넘치는 라틴 어반 팝 가사 쉐도잉',
    thumbnailUrl: 'https://img.youtube.com/vi/XK06sajscPg/hqdefault.jpg',
    duration: '3:50',
    category: 'pop_music',
    tags: ['스페인어', 'BeckyG', '라틴팝', '스페인어노래'],
    source: 'curated_spanish',
  },

  {
    videoId: 'e8vI0pYLcYU',
    title: 'Aitana - Vas A Quedarte (Official Music Video)',
    channelTitle: 'Aitana',
    artist: 'Aitana',
    description: 'Aitana • 스페인을 눈물짓게 한 정통 감성 피아노 발라드 & 맑고 청아한 카스티야 보컬 쉐도잉',
    thumbnailUrl: 'https://img.youtube.com/vi/e8vI0pYLcYU/hqdefault.jpg',
    duration: '4:05',
    category: 'pop_music',
    tags: ['스페인어', 'Aitana', 'VasAQuedarte', '감성발라드', '가사쉐도잉'],
    source: 'curated_spanish',
  },
  {
    videoId: 'WT-VE9OyAJk',
    title: 'Mon Laferte - Tu Falta De Querer (Official Video)',
    channelTitle: 'Mon Laferte',
    artist: 'Mon Laferte',
    description: 'Mon Laferte • 호소력 짙은 감성과 폭발적인 가창력의 전설적인 라틴 발라드',
    thumbnailUrl: 'https://img.youtube.com/vi/WT-VE9OyAJk/hqdefault.jpg',
    duration: '4:39',
    category: 'pop_music',
    tags: ['스페인어', 'MonLaferte', '라틴발라드', '가사쉐도잉'],
    source: 'curated_spanish',
  },
  {
    videoId: 'MCH1tA-6JWs',
    title: 'Shakira - Antología (Audio Oficial Con Letra)',
    channelTitle: 'Shakira',
    artist: 'Shakira',
    description: 'Shakira • 시적이고 아름다운 스페인어 가사가 돋보이는 불후의 명품 어쿠스틱 발라드',
    thumbnailUrl: 'https://img.youtube.com/vi/MCH1tA-6JWs/hqdefault.jpg',
    duration: '4:18',
    category: 'pop_music',
    tags: ['스페인어', 'Shakira', 'Antologia', '어쿠스틱발라드', '가사쉐도잉'],
    source: 'curated_spanish',
  },

  // Spanish Speeches / Talks / Essays / Podcasts
  {
    videoId: 'kuC1HC3HFZA',
    title: 'Liderazgo que inspira y transforma vidas | Marisa Lazo | TEDx',
    channelTitle: 'TEDx Talks',
    description: 'Marisa Lazo • 진정한 리더십과 내면의 열정을 일깨우는 감동적인 스페인어 TED 강연',
    thumbnailUrl: 'https://img.youtube.com/vi/kuC1HC3HFZA/hqdefault.jpg',
    duration: '16:15',
    category: 'ted_speech',
    tags: ['스페인어', 'TEDx', '리더십', '동기부여', '명품스피치'],
    source: 'curated_spanish',
  },
  {
    videoId: 'dd_uI8-vdwM',
    title: '20 Hábitos para Transformar tu Vida y Mente | Patri Psicóloga (Full Talk)',
    channelTitle: 'Patri Psicóloga',
    description: 'Patri Psicóloga • 삶을 변화시키는 20가지 심리학 습관, 취침 전 듣기 좋은 1시간 22분 차분한 스페인어 롱폼 대담',
    thumbnailUrl: 'https://img.youtube.com/vi/dd_uI8-vdwM/hqdefault.jpg',
    duration: '1:22:15',
    category: 'sleep_life',
    tags: ['스페인어', '심리학', '수면토크', '습관형성', '롱폼에세이'],
    source: 'curated_spanish',
  },
  {
    videoId: '-iYL9ZlQtes',
    title: 'DESARROLLO PERSONAL: 4 pasos para cambiar tu mentalidad | Sara Linares',
    channelTitle: 'Sara Linares',
    description: 'Sara Linares • 마인드셋 혁신과 자기 성장을 위한 4가지 실행 로드맵 스페인어 에세이',
    thumbnailUrl: 'https://img.youtube.com/vi/-iYL9ZlQtes/hqdefault.jpg',
    duration: '14:40',
    category: 'essay_deep',
    tags: ['스페인어', '자기계발', '마인드셋', '에세이', '쉐도잉'],
    source: 'curated_spanish',
  },
  {
    videoId: 'zFiDudVClRU',
    title: '¿Dónde nació el CASTELLANO realmente? | Linguriosa',
    channelTitle: 'Linguriosa',
    description: 'Elena Herraiz (Linguriosa) • 카스티야 스페인어의 역사와 어원, 가장 아름답고 명료한 마드리드 딕션',
    thumbnailUrl: 'https://img.youtube.com/vi/zFiDudVClRU/hqdefault.jpg',
    duration: '15:20',
    category: 'conversation',
    tags: ['스페인어', 'Linguriosa', '카스티야딕션', '어원이야기', '명품발음'],
    source: 'curated_spanish',
  },
  {
    videoId: '2RiadhCBhiY',
    title: 'El idioma ESPAÑOL NO es LÓGICO... o sí? | Linguriosa',
    channelTitle: 'Linguriosa',
    description: 'Elena Herraiz (Linguriosa) • 스페인어 문법의 재미있는 비밀과 발음 뉘앙스 완벽 분석',
    thumbnailUrl: 'https://img.youtube.com/vi/2RiadhCBhiY/hqdefault.jpg',
    duration: '16:05',
    category: 'conversation',
    tags: ['스페인어', 'Linguriosa', '스페인어문법', '발음훈련', '쉐도잉'],
    source: 'curated_spanish',
  },
  {
    videoId: 'YlI-e4QJWG0',
    title: 'Persuade con tu voz. Estrategias para sonar creíble. | Emma Rodero | TEDxMalagueta',
    channelTitle: 'TEDx Talks',
    description: 'Dr. Emma Rodero • 음성 심리학자가 알려주는 신뢰를 얻는 목소리와 스페인어 대중 스피치 마스터클래스',
    thumbnailUrl: 'https://img.youtube.com/vi/YlI-e4QJWG0/hqdefault.jpg',
    duration: '16:43',
    category: 'ted_speech',
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
    category: 'conversation',
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
    category: 'ted_speech',
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
    category: 'ted_speech',
    tags: ['스페인어', 'TEDx', '여성리더십', '스피치기법', '쉐도잉'],
    source: 'curated_spanish',
  },
  {
    videoId: 'uhZzB5hid6M',
    title: 'Cambia tu mente, cambia tu vida | Margarita Pasos | TEDxManagua',
    channelTitle: 'TEDx Talks',
    description: 'Margarita Pasos • 글로벌 리더십 코치가 전하는 뇌 가소성과 마인드셋 혁신 스페인어 명강연',
    thumbnailUrl: 'https://img.youtube.com/vi/uhZzB5hid6M/hqdefault.jpg',
    duration: '20:44',
    category: 'ted_speech',
    tags: ['스페인어', 'TEDx', '멘탈코칭', '인생가치관', '쉐도잉'],
    source: 'curated_spanish',
  },
  {
    videoId: 'eTtpy4XotIg',
    title: 'Spanish Shadowing Practice | Real Conversations for Daily Use | Spanish Podcast',
    channelTitle: 'Easy Español',
    description: 'Easy Español • 원어민 실전 일상 대화 38분 집중 스페인어 리스닝 & 쉐도잉 훈련',
    thumbnailUrl: 'https://img.youtube.com/vi/eTtpy4XotIg/hqdefault.jpg',
    duration: '38:42',
    category: 'conversation',
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
  // Chinese Pop Music (G.E.M. 鄧紫棋, Lexie Liu 刘柏辛)
  {
    videoId: 'Xak4xeMRI2k',
    title: 'G.E.M. 鄧紫棋【光年之外 LIGHT YEARS AWAY】(Official MV)',
    channelTitle: 'GEM鄧紫棋',
    artist: 'G.E.M. 鄧紫棋',
    description: 'G.E.M. 鄧紫棋 • 중화권 최고 보컬리스트의 3억뷰 글로벌 명곡 & 또렷한 표준 중국어 가사 쉐도잉',
    thumbnailUrl: 'https://img.youtube.com/vi/Xak4xeMRI2k/hqdefault.jpg',
    duration: '4:06',
    language: 'zh',
    category: 'pop_music',
    tags: ['중국어', 'GEM鄧紫棋', '중국노래', '가사쉐도잉', '명품보컬'],
    source: 'curated_chinese',
  },
  {
    videoId: '7XlqcS6B7WA',
    title: 'G.E.M. 鄧紫棋【句號 Full Stop】(Official MV)',
    channelTitle: 'GEM鄧紫棋',
    artist: 'G.E.M. 鄧紫棋',
    description: 'G.E.M. 鄧紫棋 • 지나간 아픔을 마침표 짓고 새로 시작하는 자전적 가사 & 편안한 멜로디',
    thumbnailUrl: 'https://img.youtube.com/vi/7XlqcS6B7WA/hqdefault.jpg',
    duration: '4:10',
    language: 'zh',
    category: 'pop_music',
    tags: ['중국어', 'GEM鄧紫棋', '句號', '중국노래', '가사쉐도잉'],
    source: 'curated_chinese',
  },
  {
    videoId: 'mGeiABBB5f8',
    title: 'G.E.M. 鄧紫棋【泡沫 Bubble】(Official MV)',
    channelTitle: 'GEM鄧紫棋',
    artist: 'G.E.M. 鄧紫棋',
    description: 'G.E.M. 鄧紫棋 • 아련한 멜로디와 서정적인 중국어 표현이 돋보이는 대표 발라드',
    thumbnailUrl: 'https://img.youtube.com/vi/mGeiABBB5f8/hqdefault.jpg',
    duration: '4:23',
    language: 'zh',
    category: 'pop_music',
    tags: ['중국어', 'GEM鄧紫棋', '泡沫', '중국발라드', '가사쉐도잉'],
    source: 'curated_chinese',
  },
  {
    videoId: '5bx4dwj8RXw',
    title: 'G.E.M. 鄧紫棋【再見 GOODBYE】(Official MV)',
    channelTitle: 'GEM鄧紫棋',
    artist: 'G.E.M. 鄧紫棋',
    description: 'G.E.M. 鄧紫棋 • 경쾌한 록 비트와 정확하고 파워풀한 표준 중국어 발음 훈련',
    thumbnailUrl: 'https://img.youtube.com/vi/5bx4dwj8RXw/hqdefault.jpg',
    duration: '3:45',
    language: 'zh',
    category: 'pop_music',
    tags: ['중국어', 'GEM鄧紫棋', '再見', '중국노래'],
    source: 'curated_chinese',
  },
  {
    videoId: 'Uy0_XT2OkHs',
    title: 'Lexie Liu (刘柏辛) - 佳人 (Delilah) [Official Audio]',
    channelTitle: 'Lexie Liu',
    artist: 'Lexie Liu',
    description: 'Lexie Liu (刘柏辛) • 동양적 선율과 세련된 트랩 비트의 조화, 트렌디한 중국어 팝 쉐도잉',
    thumbnailUrl: 'https://img.youtube.com/vi/Uy0_XT2OkHs/hqdefault.jpg',
    duration: '3:10',
    language: 'zh',
    category: 'pop_music',
    tags: ['중국어', 'LexieLiu', '刘柏辛', '중국노래', '트렌디팝'],
    source: 'curated_chinese',
  },

  // Chinese Talks, Essays & Podcasts
  {
    videoId: 'jVQgo8ZWzxQ',
    title: '閱讀能帶給我們什麼？(독서가 우리에게 주는 것) | Michelle Kuo | TEDxTaipei',
    channelTitle: 'TEDxTaipei',
    description: 'Michelle Kuo • 책을 통해 마음을 치유하고 삶의 방향을 찾는 감동적인 표준 중국어 TEDx 연설',
    thumbnailUrl: 'https://img.youtube.com/vi/jVQgo8ZWzxQ/hqdefault.jpg',
    duration: '15:10',
    language: 'zh',
    category: 'ted_speech',
    tags: ['중국어', 'TEDx', '독서', '인생철학', '명품스피치'],
    source: 'curated_chinese',
  },
  {
    videoId: 'vJeJotLB9IQ',
    title: '文字的力量與人生的改變 (글의 힘과 삶의 변화) | Michelle Kuo | TEDxTaipei',
    channelTitle: 'TEDxTaipei',
    description: 'Michelle Kuo • 타인과의 진솔한 소통과 내면 성장을 이끄는 명료하고 차분한 중국어 스피치',
    thumbnailUrl: 'https://img.youtube.com/vi/vJeJotLB9IQ/hqdefault.jpg',
    duration: '16:05',
    language: 'zh',
    category: 'ted_speech',
    tags: ['중국어', 'TEDx', '북리뷰', '마음챙김', '쉐도잉'],
    source: 'curated_chinese',
  },
  {
    videoId: 'NOyVTy33glE',
    title: '正向思考帶來的效果與心理調適｜蘇予昕 諮商心理師｜文森Podcast',
    channelTitle: '文森說書 / Vincent Podcast',
    description: '심리상담사 蘇予昕 • 긍정적인 사고와 감정 조율법, 편안하고 차분하게 듣는 59분 롱폼 심리 팟캐스트',
    thumbnailUrl: 'https://img.youtube.com/vi/NOyVTy33glE/hqdefault.jpg',
    duration: '59:20',
    language: 'zh',
    category: 'sleep_life',
    tags: ['중국어', '심리학', '수면팟캐스트', '마음챙김', '롱폼토크'],
    source: 'curated_chinese',
  },
  {
    videoId: 'ytgHU7EH9Xc',
    title: '難拒絕別人、不敢說出內心感受？學會溫柔而堅定｜海蒂 Heidi｜文森Podcast',
    channelTitle: '文森說書 / Vincent Podcast',
    description: 'Heidi • 부드럽지만 단호하게 나의 마음을 표현하는 대화법, 마음을 안정시키는 1시간 심야 딥토크',
    thumbnailUrl: 'https://img.youtube.com/vi/ytgHU7EH9Xc/hqdefault.jpg',
    duration: '1:01:15',
    language: 'zh',
    category: 'sleep_life',
    tags: ['중국어', '심리대담', '인간관계', '수면토크', '차분한목소리'],
    source: 'curated_chinese',
  },
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

export const DEFAULT_VIETNAMESE_TRACKS = [
  {
    videoId: 'mC-Qs6BDQBo',
    title: '9 Thói quen thay đổi cuộc sống và tư duy của bạn | Sunhuyn Podcast',
    channelTitle: 'Sunhuyn Podcast',
    description: 'Sunhuyn • 인생과 사고방식을 긍정적으로 변화시키는 9가지 일상 습관, 명품 하노이 딕션 쉐도잉',
    thumbnailUrl: 'https://img.youtube.com/vi/mC-Qs6BDQBo/hqdefault.jpg',
    duration: '29:40',
    language: 'vi',
    category: 'essay_deep',
    tags: ['베트남어', 'Sunhuyn', '습관형성', '인생에세이', '명품딕션'],
    source: 'curated_vietnamese',
  },
  {
    videoId: 'YVL13_UqHqg',
    title: '6 tư duy giúp bạn có động lực mỗi ngày và không bỏ cuộc | Sunhuyn Podcast',
    channelTitle: 'Sunhuyn Podcast',
    description: 'Sunhuyn • 매일 흔들리지 않는 동기부여를 유지하는 6가지 마인드셋, 차분하고 단아한 베트남어 오디오',
    thumbnailUrl: 'https://img.youtube.com/vi/YVL13_UqHqg/hqdefault.jpg',
    duration: '30:15',
    language: 'vi',
    category: 'essay_deep',
    tags: ['베트남어', 'Sunhuyn', '동기부여', '마인드셋', '쉐도잉'],
    source: 'curated_vietnamese',
  },
  {
    videoId: 'hpWgzIAS7kU',
    title: 'Thành thật trả lời các câu hỏi về cuộc sống, tình cảm & công việc | Giang Ơi',
    channelTitle: 'Giang Ơi',
    description: 'Giang Ơi • 삶과 사랑, 일에 대한 솔직하고 진솔한 Q&A 대담, 자연스러운 원어민 일상 회화',
    thumbnailUrl: 'https://img.youtube.com/vi/hpWgzIAS7kU/hqdefault.jpg',
    duration: '33:20',
    language: 'vi',
    category: 'conversation',
    tags: ['베트남어', 'GiangOi', '일상회화', '진솔한대화', '쉐도잉'],
    source: 'curated_vietnamese',
  },
  {
    videoId: 'UruupqUGyJs',
    title: 'Lý do thực sự khiến bạn không có kỷ luật và cách khắc phục | Giang Ơi',
    channelTitle: 'Giang Ơi',
    description: 'Giang Ơi • 자기 통제력과 꾸준한 실행력을 만드는 구체적인 방법론 에세이',
    thumbnailUrl: 'https://img.youtube.com/vi/UruupqUGyJs/hqdefault.jpg',
    duration: '17:45',
    language: 'vi',
    category: 'essay_deep',
    tags: ['베트남어', 'GiangOi', '자기규율', '실행력', '명품딕션'],
    source: 'curated_vietnamese',
  },
  {
    videoId: 'dPjTSeNk2R0',
    title: 'Ích kỷ và yêu bản thân khác nhau thế nào? | The Present Writer',
    channelTitle: 'The Present Writer (Chi Nguyễn)',
    description: 'Chi Nguyễn (PhD, 미국 대학 교수) • 이기심과 진정한 자기 사랑의 차이, 우아하고 지적인 베트남어 에세이',
    thumbnailUrl: 'https://img.youtube.com/vi/dPjTSeNk2R0/hqdefault.jpg',
    duration: '14:30',
    language: 'vi',
    category: 'essay_deep',
    tags: ['베트남어', 'ThePresentWriter', '자기사랑', '마음챙김', '지적인스피치'],
    source: 'curated_vietnamese',
  },
  {
    videoId: '2V6h7qtE_MU',
    title: 'Thay đổi tư duy học và làm việc hiệu quả | The Present Writer',
    channelTitle: 'The Present Writer (Chi Nguyễn)',
    description: 'Chi Nguyễn • 학습과 업무 생산성을 극대화하는 사고방식의 전환, 또렷하고 단정한 발음',
    thumbnailUrl: 'https://img.youtube.com/vi/2V6h7qtE_MU/hqdefault.jpg',
    duration: '23:10',
    language: 'vi',
    category: 'essay_deep',
    tags: ['베트남어', 'ThePresentWriter', '생산성', '학습법', '쉐도잉'],
    source: 'curated_vietnamese',
  },
  {
    videoId: 'O25rA7z9gaI',
    title: 'Cách để không bị cuốn vào những kỳ vọng của người khác | Sunhuyn Podcast',
    channelTitle: 'Sunhuyn Podcast',
    description: 'Sunhuyn • 타인의 기대에서 벗어나 온전히 나답게 살아가는 법, 차분하고 명료한 베트남어 인생 에세이 & 팟캐스트',
    thumbnailUrl: 'https://img.youtube.com/vi/O25rA7z9gaI/hqdefault.jpg',
    duration: '23:18',
    language: 'vi',
    category: 'essay_deep',
    tags: ['베트남어', 'Sunhuyn', '인생에세이', '마인드셋', '차분한목소리'],
    source: 'curated_vietnamese',
  },
  {
    videoId: '8YonZHuguBE',
    title: 'Đừng để sự bận rộn đánh lừa bạn | Tự học cách sống chậm lại | Sunhuyn Podcast',
    channelTitle: 'Sunhuyn Podcast',
    description: 'Sunhuyn • 분주함 속에서 마음의 여유를 찾고 천천히 걷는 삶의 지혜, 또렷한 하노이 표준 발음 쉐도잉',
    thumbnailUrl: 'https://img.youtube.com/vi/8YonZHuguBE/hqdefault.jpg',
    duration: '21:45',
    language: 'vi',
    category: 'essay_deep',
    tags: ['베트남어', 'Sunhuyn', '슬로우라이프', '마음챙김', '쉐도잉'],
    source: 'curated_vietnamese',
  },
  {
    videoId: 'noxzzmyRvSw',
    title: 'Học cách trân trọng chính mình và buông bỏ những điều không phù hợp | Sunhuyn Podcast',
    channelTitle: 'Sunhuyn Podcast',
    description: 'Sunhuyn • 나 자신을 진정으로 아끼고 불필요한 감정을 내려놓는 법, 밤에 듣기 좋은 따뜻한 목소리',
    thumbnailUrl: 'https://img.youtube.com/vi/noxzzmyRvSw/hqdefault.jpg',
    duration: '27:12',
    language: 'vi',
    category: 'sleep_life',
    tags: ['베트남어', 'Sunhuyn', '자기수용', '감동에세이', '심야토크'],
    source: 'curated_vietnamese',
  },
  {
    videoId: 'JedTFseze7o',
    title: 'Làm thế nào để vượt qua cảm giác chông chênh tuổi 20? | Giang Ơi',
    channelTitle: 'Giang Ơi',
    description: 'Giang Ơi • 20대의 방황과 불확실성을 단단하게 헤쳐나가는 실행력과 솔직한 인생 조언',
    thumbnailUrl: 'https://img.youtube.com/vi/JedTFseze7o/hqdefault.jpg',
    duration: '18:05',
    language: 'vi',
    category: 'essay_deep',
    tags: ['베트남어', 'GiangOi', '20대성장', '명품딕션', '쉐도잉'],
    source: 'curated_vietnamese',
  },
];

export const DEFAULT_INDONESIAN_TRACKS = [
  {
    videoId: 'BIV9ZlEqd-k',
    title: 'Gimana Caranya Berpikir Kritis dan Gak Gampang Kemakan Hoax? | Gita Savitri Devi',
    channelTitle: 'Gita Savitri Devi',
    description: 'Gita Savitri Devi • 비판적 사고와 가치관을 정립하는 지적인 인니어 에세이 & 명확한 표준 딕션',
    thumbnailUrl: 'https://img.youtube.com/vi/BIV9ZlEqd-k/hqdefault.jpg',
    duration: '18:35',
    language: 'id',
    category: 'essay_deep',
    tags: ['인니어', 'GitaSavitri', '비판적사고', '명품딕션', '쉐도잉'],
    source: 'curated_indonesian',
  },
  {
    videoId: '0j6D33p9jzA',
    title: 'Jadi Kaum Open Minded: Realitas dan Batasannya | Gita Savitri Devi',
    channelTitle: 'Gita Savitri Devi',
    description: 'Gita Savitri Devi • 열린 마음과 주관 있는 삶의 태도에 대한 심도 있는 성찰',
    thumbnailUrl: 'https://img.youtube.com/vi/0j6D33p9jzA/hqdefault.jpg',
    duration: '17:20',
    language: 'id',
    category: 'essay_deep',
    tags: ['인니어', 'GitaSavitri', '마인드셋', '인생에세이', '쉐도잉'],
    source: 'curated_indonesian',
  },
  {
    videoId: '31FaoNvteA0',
    title: 'Menjadi Manusia Seutuhnya dengan Self Love | Najwa Shihab | Narasi',
    channelTitle: 'Najwa Shihab / Narasi',
    description: 'Najwa Shihab • 인도네시아 최고 여성 앵커/언론인이 전하는 당당한 자기 사랑과 스피치',
    thumbnailUrl: 'https://img.youtube.com/vi/31FaoNvteA0/hqdefault.jpg',
    duration: '15:40',
    language: 'id',
    category: 'ted_speech',
    tags: ['인니어', 'NajwaShihab', '여성리더십', '자기사랑', '명품스피치'],
    source: 'curated_indonesian',
  },
  {
    videoId: 'dTZhACO5w-U',
    title: 'Apakah Self Love Benar-benar Membuat Kita Bahagia? | Nikita Willy & Maya Septha',
    channelTitle: 'Nikita Willy Official',
    description: 'Nikita Willy & Maya Septha • 진정한 행복과 마음의 평온을 찾는 따뜻한 35분 대화',
    thumbnailUrl: 'https://img.youtube.com/vi/dTZhACO5w-U/hqdefault.jpg',
    duration: '35:10',
    language: 'id',
    category: 'conversation',
    tags: ['인니어', 'NikitaWilly', '일상회화', '행복론', '편안한대화'],
    source: 'curated_indonesian',
  },
  {
    videoId: 'Yjvmas_2u18',
    title: 'Cara Mencintai Diri Sendiri dengan Benar (Self Compassion) | Satu Persen',
    channelTitle: 'Satu Persen - Indonesian Life School',
    description: 'Satu Persen • 나 자신에게 친절해지는 심리학 실천법, 부드럽고 친절한 인니어 내레이션',
    thumbnailUrl: 'https://img.youtube.com/vi/Yjvmas_2u18/hqdefault.jpg',
    duration: '16:50',
    language: 'id',
    category: 'essay_deep',
    tags: ['인니어', 'SatuPersen', '심리학', '셀프컴패션', '쉐도잉'],
    source: 'curated_indonesian',
  },
  {
    videoId: '1hh2O4nXdcA',
    title: 'Metode Mindfulness Buat Menjalani Hidup yang Tenang | Satu Persen (Full Talk)',
    channelTitle: 'Satu Persen - Indonesian Life School',
    description: 'Satu Persen • 복잡한 마음을 비우는 마인드풀니스와 평온한 수면 가이드 오디오',
    thumbnailUrl: 'https://img.youtube.com/vi/1hh2O4nXdcA/hqdefault.jpg',
    duration: '42:15',
    language: 'id',
    category: 'sleep_life',
    tags: ['인니어', 'SatuPersen', '마인드풀니스', '수면오디오', '마음챙김'],
    source: 'curated_indonesian',
  },
  {
    videoId: 'SKAtEIcwwIE',
    title: 'Belajar Menerima Diri dan Berhenti Membandingkan Hidup | Gita Savitri Devi',
    channelTitle: 'Gita Savitri Devi',
    description: 'Gita Savitri Devi • 남과의 비교를 멈추고 온전한 나를 인정하는 법, 지적이고 명확한 인니어 에세이',
    thumbnailUrl: 'https://img.youtube.com/vi/SKAtEIcwwIE/hqdefault.jpg',
    duration: '22:40',
    language: 'id',
    category: 'essay_deep',
    tags: ['인니어', 'GitaSavitri', '자기수용', '인생에세이', '명품딕션'],
    source: 'curated_indonesian',
  },
  {
    videoId: 'Zhcy2NNQ4m0',
    title: 'Bicara tentang Quarter Life Crisis dan Menemukan Diri Sendiri | Gita Savitri Devi',
    channelTitle: 'Gita Savitri Devi',
    description: 'Gita Savitri Devi • 20대 청춘의 위기와 방황 속에서 나만의 길을 찾는 솔직한 고백',
    thumbnailUrl: 'https://img.youtube.com/vi/Zhcy2NNQ4m0/hqdefault.jpg',
    duration: '19:15',
    language: 'id',
    category: 'essay_deep',
    tags: ['인니어', 'GitaSavitri', '청춘위기', '마인드셋', '쉐도잉'],
    source: 'curated_indonesian',
  },
  {
    videoId: 'Fum1B2O_a8o',
    title: 'Mengenal Diri Sendiri dan Seni Menerima Kegagalan | Menjadi Manusia',
    channelTitle: 'Menjadi Manusia',
    description: 'Menjadi Manusia • 실패를 딛고 내면을 단단하게 키우는 감동적인 인니어 심층 대담',
    thumbnailUrl: 'https://img.youtube.com/vi/Fum1B2O_a8o/hqdefault.jpg',
    duration: '25:30',
    language: 'id',
    category: 'essay_deep',
    tags: ['인니어', 'MenjadiManusia', '실패극복', '감동인터뷰', '쉐도잉'],
    source: 'curated_indonesian',
  },
  {
    videoId: 'iuGNLLeSrXY',
    title: 'Pentingnya Menjaga Kesehatan Mental di Usia 20-an | Menjadi Manusia',
    channelTitle: 'Menjadi Manusia',
    description: 'Menjadi Manusia • 20대 멘탈 관리와 따뜻한 마음 챙김, 부드럽고 차분한 대화체 인니어',
    thumbnailUrl: 'https://img.youtube.com/vi/iuGNLLeSrXY/hqdefault.jpg',
    duration: '24:10',
    language: 'id',
    category: 'sleep_life',
    tags: ['인니어', 'MenjadiManusia', '멘탈케어', '차분한대화', '쉐도잉'],
    source: 'curated_indonesian',
  },
  {
    videoId: 'touMHgaKRZI',
    title: 'Cara Menata Pikiran dan Hidup yang Tenang | Gita Savitri Devi Book Talk',
    channelTitle: 'Gita Savitri Devi',
    description: 'Gita Savitri Devi • 북토크 & 복잡한 생각을 정리하고 평온한 일상을 가꾸는 책 이야기',
    thumbnailUrl: 'https://img.youtube.com/vi/touMHgaKRZI/hqdefault.jpg',
    duration: '20:18',
    language: 'id',
    category: 'essay_deep',
    tags: ['인니어', 'GitaSavitri', '북토크', '책읽기', '마인드셋'],
    source: 'curated_indonesian',
  },
];

export const DEFAULT_HINDI_TRACKS = [
  {
    videoId: 'fgiCQq0IyN0',
    title: 'जब ₹1 तक बचा नहीं था... गरीबी से करोड़ों का सफर | Aakanksha | Josh Talks Hindi',
    channelTitle: 'जोश Talks',
    description: 'Aakanksha • 극심한 가난을 딛고 자수성가한 20대 여성 창업가의 감동 실화, 힘차고 명확한 힌디어 스피치',
    thumbnailUrl: 'https://img.youtube.com/vi/fgiCQq0IyN0/hqdefault.jpg',
    duration: '30:20',
    language: 'hi',
    category: 'essay_deep',
    tags: ['힌디어', 'JoshTalks', '감동실화', '자수성가', '명품딕션'],
    source: 'curated_hindi',
  },
  {
    videoId: '1ek5RMLhG5k',
    title: 'वो जिंदगी का सबसे बुरा पल था... फिर कैसे बदली किस्मत? | Nidhi Saini | Josh Talks',
    channelTitle: 'जोश Talks',
    description: 'Nidhi Saini • 인생 최악의 순간을 딛고 다시 일어선 용기와 회복 탄력성 힌디어 스토리텔링',
    thumbnailUrl: 'https://img.youtube.com/vi/1ek5RMLhG5k/hqdefault.jpg',
    duration: '19:40',
    language: 'hi',
    category: 'essay_deep',
    tags: ['힌디어', 'JoshTalks', '역경극복', '회복탄력성', '쉐도잉'],
    source: 'curated_hindi',
  },
  {
    videoId: 'sKvMxZ284AA',
    title: 'How SHE became an IAS officer against all odds | Surabhi Gautam | TEDxRGPV',
    channelTitle: 'TEDx Talks',
    description: 'Surabhi Gautam • 수많은 편견을 깨고 인도 최고 공직(IAS)에 합격한 명쾌하고 지적인 스피치',
    thumbnailUrl: 'https://img.youtube.com/vi/sKvMxZ284AA/hqdefault.jpg',
    duration: '22:15',
    language: 'hi',
    category: 'ted_speech',
    tags: ['힌디어', 'TEDx', '동기부여', '성공신화', '명품스피치'],
    source: 'curated_hindi',
  },
  {
    videoId: 'rmeGVhhbGrM',
    title: 'It is okay not to have a plan: Life Journey | Mithila Palkar | TEDxNITTrichy',
    channelTitle: 'TEDx Talks',
    description: 'Mithila Palkar • 20대 젊은 배우가 전하는 완벽한 계획이 없어도 나아가는 용기',
    thumbnailUrl: 'https://img.youtube.com/vi/rmeGVhhbGrM/hqdefault.jpg',
    duration: '17:50',
    language: 'hi',
    category: 'ted_speech',
    tags: ['힌디어', 'TEDx', '청춘조언', '마인드셋', '자연스러운스피치'],
    source: 'curated_hindi',
  },
  {
    videoId: 'AvxFqh2IzQo',
    title: '7 Life Changing Habits in 30 Days (Hindi Book Review) | Book Brisk',
    channelTitle: 'Book Brisk Hindi',
    description: 'Book Brisk • 30일 만에 삶을 바꾸는 7가지 핵심 습관 북리뷰 & 또렷한 힌디어 오디오',
    thumbnailUrl: 'https://img.youtube.com/vi/AvxFqh2IzQo/hqdefault.jpg',
    duration: '23:30',
    language: 'hi',
    category: 'essay_deep',
    tags: ['힌디어', '북리뷰', '습관형성', '자기계발', '쉐도잉'],
    source: 'curated_hindi',
  },
  {
    videoId: 'WR3IWiqcjvg',
    title: 'The Art of Self-Discipline (Full Hindi Audiobook Summary - 1 Hour)',
    channelTitle: 'Audio Books Arc Hindi',
    description: 'Audio Books Arc • 자기 훈련과 의지력의 비밀을 다룬 1시간 4분 완독 북서머리 & 차분한 수면 오디오',
    thumbnailUrl: 'https://img.youtube.com/vi/WR3IWiqcjvg/hqdefault.jpg',
    duration: '1:04:20',
    language: 'hi',
    category: 'sleep_life',
    tags: ['힌디어', '오디오북', '수면오디오', '자기규율', '롱폼에세이'],
    source: 'curated_hindi',
  },
  {
    videoId: 'A9eQHm7Y7EU',
    title: '107 KG से 62 KG... एक बेहद भावुक Weight Loss कहानी | Anamika Salian | Josh Talks',
    channelTitle: 'जोश Talks',
    description: 'Anamika Salian • 아픔을 딛고 스스로를 변화시킨 감동적인 성장 드라마, 또렷하고 감동적인 힌디어 스피치',
    thumbnailUrl: 'https://img.youtube.com/vi/A9eQHm7Y7EU/hqdefault.jpg',
    duration: '15:20',
    language: 'hi',
    category: 'essay_deep',
    tags: ['힌디어', 'JoshTalks', '감동실화', '자기변화', '명품딕션'],
    source: 'curated_hindi',
  },
  {
    videoId: 'oH3y_ibwRq8',
    title: 'एक डरी हुई लड़की जो बनी Indian Army की Major | Major Khushboo Patani | Josh Talks',
    channelTitle: 'जोश Talks',
    description: 'Major Khushboo Patani • 두려움을 이겨내고 인도 육군 소령이 된 여성 리더의 당당한 힌디어 강연',
    thumbnailUrl: 'https://img.youtube.com/vi/oH3y_ibwRq8/hqdefault.jpg',
    duration: '18:45',
    language: 'hi',
    category: 'ted_speech',
    tags: ['힌디어', 'JoshTalks', '여성리더십', '도전정신', '당당한스피치'],
    source: 'curated_hindi',
  },
  {
    videoId: 'k3GOGZK3UDQ',
    title: 'Married at 16, Divorced After 8 Years… Then She Rebuilt Her Life | Rinki Rathore | Josh Talks',
    channelTitle: 'Josh Talks',
    description: 'Rinki Rathore • 역경을 극복하고 다시 일어선 인생 이야기, 명확하고 힘찬 힌디어 전달력',
    thumbnailUrl: 'https://img.youtube.com/vi/k3GOGZK3UDQ/hqdefault.jpg',
    duration: '17:30',
    language: 'hi',
    category: 'essay_deep',
    tags: ['힌디어', 'JoshTalks', '역경극복', '인생스토리', '쉐도잉'],
    source: 'curated_hindi',
  },
  {
    videoId: 'MSbJDdjStwE',
    title: 'जीवन बदलने वाली किताबें और विचार (인생을 바꾸는 책과 생각) | A Cup of Life',
    channelTitle: 'A Cup of Life Hindi',
    description: 'A Cup of Life • 따뜻한 북리뷰와 삶의 철학 에세이, 마음을 편안하게 해주는 힌디어 오디오',
    thumbnailUrl: 'https://img.youtube.com/vi/MSbJDdjStwE/hqdefault.jpg',
    duration: '20:15',
    language: 'hi',
    category: 'essay_deep',
    tags: ['힌디어', '북리뷰', '인생철학', '차분한오디오', '쉐도잉'],
    source: 'curated_hindi',
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
  if (item.source === 'curated_chinese' || item.id?.startsWith('zh_')) return 'zh';
  if (item.source === 'curated_vietnamese' || item.id?.startsWith('vi_')) return 'vi';
  if (item.source === 'curated_indonesian' || item.id?.startsWith('id_')) return 'id';
  if (item.source === 'curated_hindi' || item.id?.startsWith('hi_')) return 'hi';
  if (item.source === 'curated_japanese' || item.id?.startsWith('ja_')) return 'ja';
  if (item.source === 'curated_french' || item.id?.startsWith('fr_')) return 'fr';
  if (item.source === 'curated_german' || item.id?.startsWith('de_')) return 'de';

  const text = `${item.title || ''} ${item.channelTitle || ''} ${item.description || ''}`.toLowerCase();
  if (/[\u0900-\u097F]/.test(text) || text.includes('josh talks') || text.includes('hindi') || text.includes('kahani')) return 'hi';
  if (text.includes('sunhuyn') || text.includes('giang ơi') || text.includes('tiếng việt') || text.includes('vietnam') || text.includes('người')) return 'vi';
  if (text.includes('gita savitri') || text.includes('menjadi manusia') || text.includes('bahasa') || text.includes('indonesia') || text.includes('tentang')) return 'id';
  if (/[\u4e00-\u9fa5]/.test(text)) return 'zh';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja';
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
      artist: t.artist || '',
      tags: t.tags,
      source: 'curated_spanish',
      bookmarked: false,
      addedAt: Date.now() - 40000,
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
      artist: t.artist || '',
      tags: t.tags,
      source: 'curated_chinese',
      bookmarked: false,
      addedAt: Date.now() - 35000,
    })),
    ...DEFAULT_VIETNAMESE_TRACKS.map(t => ({
      id: `vi_${t.videoId}`,
      videoId: t.videoId,
      title: t.title,
      channelTitle: t.channelTitle,
      description: t.description,
      thumbnailUrl: t.thumbnailUrl,
      url: `https://www.youtube.com/watch?v=${t.videoId}`,
      duration: t.duration,
      language: 'vi',
      category: t.category || 'essay_deep',
      tags: t.tags,
      source: 'curated_vietnamese',
      bookmarked: false,
      addedAt: Date.now() - 30000,
    })),
    ...DEFAULT_INDONESIAN_TRACKS.map(t => ({
      id: `id_${t.videoId}`,
      videoId: t.videoId,
      title: t.title,
      channelTitle: t.channelTitle,
      description: t.description,
      thumbnailUrl: t.thumbnailUrl,
      url: `https://www.youtube.com/watch?v=${t.videoId}`,
      duration: t.duration,
      language: 'id',
      category: t.category || 'essay_deep',
      tags: t.tags,
      source: 'curated_indonesian',
      bookmarked: false,
      addedAt: Date.now() - 25000,
    })),
    ...DEFAULT_HINDI_TRACKS.map(t => ({
      id: `hi_${t.videoId}`,
      videoId: t.videoId,
      title: t.title,
      channelTitle: t.channelTitle,
      description: t.description,
      thumbnailUrl: t.thumbnailUrl,
      url: `https://www.youtube.com/watch?v=${t.videoId}`,
      duration: t.duration,
      language: 'hi',
      category: t.category || 'essay_deep',
      tags: t.tags,
      source: 'curated_hindi',
      bookmarked: false,
      addedAt: Date.now() - 20000,
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
      addedAt: Date.now() - 15000,
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
      addedAt: Date.now() - 10000,
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
      addedAt: Date.now() - 5000,
    })),
    ...DEFAULT_MOVIE_DRAMA_TRACKS.map(t => ({
      id: `movie_${t.videoId}`,
      videoId: t.videoId,
      title: t.title,
      channelTitle: t.channelTitle,
      description: t.description,
      thumbnailUrl: t.thumbnailUrl,
      url: `https://www.youtube.com/watch?v=${t.videoId}`,
      duration: t.duration,
      language: t.language || 'en',
      category: t.category || 'movie_drama',
      tags: t.tags,
      source: 'curated_movie',
      bookmarked: false,
      addedAt: Date.now() - 2000,
    })),
    ...DEFAULT_NEWS_INTERVIEW_TRACKS.map(t => ({
      id: `news_${t.videoId}`,
      videoId: t.videoId,
      title: t.title,
      channelTitle: t.channelTitle,
      description: t.description,
      thumbnailUrl: t.thumbnailUrl,
      url: `https://www.youtube.com/watch?v=${t.videoId}`,
      duration: t.duration,
      language: t.language || 'en',
      category: t.category || 'news_interview',
      tags: t.tags,
      source: 'curated_news',
      bookmarked: false,
      addedAt: Date.now() - 1000,
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
