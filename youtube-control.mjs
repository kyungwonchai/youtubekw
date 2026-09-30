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
export const BAD_VIDEO_IDS = new Set([
  '30ai5Pf1Z94',
  'rWP7OYwHCEk',
  'Jr5oLnADfaQ',
  'zHEEWvjSvRs',
  'HxfwkzsZtkg',
  'QRotNEuaCEs',
  'CcN4ByLBa60',
  '1zlNC2CJ-GA',
  'Y-cHbf-WGiI',
  '685K2BYA184',
  'zPayJHaosLg',
  'doDRobQA5Fk',
  '66cxG1XQjpI',
  '8Q1omTAxSPs',
  'm0xOa1XFE_w',
  'gvKL2-MW4Do',
  'N8Nzb-oc8XA',
  'TCsIrIFNBRI',
  '6PJBxWsEzUo',
  '5R1RGl4WQP8',
  'WX-f_pbo5jc',
  'xD27uAJUMIo',
  'skyk3T7Hu1g',
  'rF2Bn-qmM1s',
  'P8ZVtEDn0PM',
  'pmbcl0YN4lg',
  'Bwvmi-0SRQ8',
  'nYbcVK2jjXc',
  'pWgVRK_Ggww',
  'onlZQ0jKUZc',
  'ncmYqND278Q',
  '92tkZQB-Uj4',
  'WhoPPnDiY5c',
  'wTZ7A-h8yTs',
  '8C6xDjQ66wM',
  'P0iOz9xf0zY',
  'sRph0jV4mO4',
  '32d1bq-kG5c',
  'GkTWxDB21cA',
  'mjcX-5lKdeg',
  'BDHM8cyJQa8',
  'wMpqCRF7TKg',
  'osdoLjUNFnA',
  'BZ-rLBkUZf4',
  'viimfQi_pUw',
]);

export function isBlacklisted(title = '', desc = '', channelTitle = '', videoId = '') {
  if (videoId && BAD_VIDEO_IDS.has(videoId)) return true;
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
  'alex hormozi', 'lewis howes', 'rainn wilson', 'soul boom',
  'jensen huang', 'shashi tharoor', 'konstantin kisin', 'mehdi hasan', 'raj persaud',
  'bon iver', 'rauw alejandro', 'zzoilo', 'khalid', 'vincent podcast', 'rich roll', 'doug bopst', 'viall files'
];

const TRASH_KEYWORDS = [
  // 마인크래프트 / 게임 / 애니메이션 / 카툰 (엄격 영구 차단)
  'minecraft', '마인크래프트', 'gameplay', 'game', 'gaming', 'roblox', '로블록스', 'pixel art', '8-bit', '8bit',
  'ted-ed', 'psych2go', 'animation', 'animated', 'anime', 'cartoon', '만화', '애니', '애니메이션',

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
  'ai voice', 'ai generated', 'ai avatar', 'virtual', 'vtuber', 'synth', 'text to speech', 'tts', 'bot',
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
 * Require at least 5 minutes (300 seconds) for speech/talks, or 2 minutes (120 seconds) for songs/music - No Shorts!
 */
export function isGoodShadowingLength(durationStr, category = '') {
  if (!durationStr) return false;
  const secs = parseDurationInSeconds(durationStr);
  if (category === 'pop_music') {
    return secs >= 120 && secs <= 12600; // 노래는 2분(120초) 이상 허용!
  }
  return secs >= 300 && secs <= 12600; // 일반 영상은 5분(300초) 이상
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
    "videoId": "hlpEWErMjgY",
    "title": "NextEV's Padmasree Warrior on Studio 1.0",
    "channelTitle": "Bloomberg Originals",
    "description": "Bloomberg Originals • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (23:37)",
    "thumbnailUrl": "https://img.youtube.com/vi/hlpEWErMjgY/hqdefault.jpg",
    "duration": "23:37",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "UMzma1aATAU",
    "title": "Crypto Investor Katie Haun on Bloomberg Studio 1.0",
    "channelTitle": "Bloomberg Tech",
    "description": "Bloomberg Tech • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (24:07)",
    "thumbnailUrl": "https://img.youtube.com/vi/UMzma1aATAU/hqdefault.jpg",
    "duration": "24:07",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "AbzHJktYCa8",
    "title": "Sheryl Sandberg: Bloomberg Studio 1.0 (Full Show)",
    "channelTitle": "Bloomberg Television",
    "description": "Bloomberg Television • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (24:17)",
    "thumbnailUrl": "https://img.youtube.com/vi/AbzHJktYCa8/hqdefault.jpg",
    "duration": "24:17",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "6sS17Rto0fM",
    "title": "Katrina Lake on 'Bloomberg Studio 1.0'",
    "channelTitle": "Bloomberg Tech",
    "description": "Bloomberg Tech • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (24:06)",
    "thumbnailUrl": "https://img.youtube.com/vi/6sS17Rto0fM/hqdefault.jpg",
    "duration": "24:06",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "cs5RCLPoTW4",
    "title": "Bloomberg Studio 1.0: RealReal CEO Julie Wainwright",
    "channelTitle": "Bloomberg Tech",
    "description": "Bloomberg Tech • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (24:05)",
    "thumbnailUrl": "https://img.youtube.com/vi/cs5RCLPoTW4/hqdefault.jpg",
    "duration": "24:05",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "mLr893-MPHg",
    "title": "Emily Chang on the Importance of Gender Equality",
    "channelTitle": "HubSpot Live",
    "description": "HubSpot Live • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (26:39)",
    "thumbnailUrl": "https://img.youtube.com/vi/mLr893-MPHg/hqdefault.jpg",
    "duration": "26:39",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "7wd95YYEQ0E",
    "title": "Bloomberg Studio 1.0 - Zoox CEO Aicha Evans",
    "channelTitle": "Bloomberg Tech",
    "description": "Bloomberg Tech • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (23:56)",
    "thumbnailUrl": "https://img.youtube.com/vi/7wd95YYEQ0E/hqdefault.jpg",
    "duration": "23:56",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "ZCj2y95-Db8",
    "title": "Making Space with Hoda Kotb: Savannah Guthrie",
    "channelTitle": "TODAY",
    "description": "TODAY • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (48:41)",
    "thumbnailUrl": "https://img.youtube.com/vi/ZCj2y95-Db8/hqdefault.jpg",
    "duration": "48:41",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "YwywFKXWtsY",
    "title": "‘Making Space With Hoda Kotb’: Maria Shriver",
    "channelTitle": "TODAY",
    "description": "TODAY • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (25:12)",
    "thumbnailUrl": "https://img.youtube.com/vi/YwywFKXWtsY/hqdefault.jpg",
    "duration": "25:12",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "NV_ykigdjg8",
    "title": "‘Making Space With Hoda Kotb’: Delia Ephron",
    "channelTitle": "TODAY",
    "description": "TODAY • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (25:18)",
    "thumbnailUrl": "https://img.youtube.com/vi/NV_ykigdjg8/hqdefault.jpg",
    "duration": "25:18",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "LjM08J8o7JQ",
    "title": "‘Making Space With Hoda Kotb’: Oprah Winfrey & Maria Shriver On Friendship",
    "channelTitle": "TODAY",
    "description": "TODAY • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (49:07)",
    "thumbnailUrl": "https://img.youtube.com/vi/LjM08J8o7JQ/hqdefault.jpg",
    "duration": "49:07",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "C9HGSWDcgz4",
    "title": "Esther Perel on How to Reignite the Spark in Your Relationship | Making Space with Hoda Kotb",
    "channelTitle": "TODAY",
    "description": "TODAY • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (37:11)",
    "thumbnailUrl": "https://img.youtube.com/vi/C9HGSWDcgz4/hqdefault.jpg",
    "duration": "37:11",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "z-Dn416-MJM",
    "title": "‘Making Space With Hoda Kotb’: Wynonna Judd",
    "channelTitle": "TODAY",
    "description": "TODAY • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (25:06)",
    "thumbnailUrl": "https://img.youtube.com/vi/z-Dn416-MJM/hqdefault.jpg",
    "duration": "25:06",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "-gc5dgLw0Xk",
    "title": "‘Making Space With Hoda Kotb’: Shania Twain",
    "channelTitle": "TODAY",
    "description": "TODAY • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (25:13)",
    "thumbnailUrl": "https://img.youtube.com/vi/-gc5dgLw0Xk/hqdefault.jpg",
    "duration": "25:13",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "oHrKUSmoCdw",
    "title": "‘Making Space With Hoda Kotb’: Karen Swensen",
    "channelTitle": "TODAY",
    "description": "TODAY • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (25:14)",
    "thumbnailUrl": "https://img.youtube.com/vi/oHrKUSmoCdw/hqdefault.jpg",
    "duration": "25:14",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "oPKgOYRyDac",
    "title": "‘Making Space With Hoda Kotb’: Viola Davis",
    "channelTitle": "TODAY",
    "description": "TODAY • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (25:17)",
    "thumbnailUrl": "https://img.youtube.com/vi/oPKgOYRyDac/hqdefault.jpg",
    "duration": "25:17",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "u-4AZvLcWw4",
    "title": "‘Making Space With Hoda Kotb’: Bevy Smith",
    "channelTitle": "TODAY",
    "description": "TODAY • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (25:17)",
    "thumbnailUrl": "https://img.youtube.com/vi/u-4AZvLcWw4/hqdefault.jpg",
    "duration": "25:17",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "Oxy3s84cfZM",
    "title": "‘Making Space With Hoda Kotb’: CeCe Winans",
    "channelTitle": "TODAY",
    "description": "TODAY • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (24:49)",
    "thumbnailUrl": "https://img.youtube.com/vi/Oxy3s84cfZM/hqdefault.jpg",
    "duration": "24:49",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "_Hx-l8o9EtM",
    "title": "Making Space with Hoda Kotb: Suleika Jaouad",
    "channelTitle": "TODAY",
    "description": "TODAY • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (41:02)",
    "thumbnailUrl": "https://img.youtube.com/vi/_Hx-l8o9EtM/hqdefault.jpg",
    "duration": "41:02",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "RcFzYzPEYIc",
    "title": "Jamie Lynn Sigler On Hiding MS for 14 Years | Making Space with Hoda Kotb",
    "channelTitle": "TODAY",
    "description": "TODAY • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (44:23)",
    "thumbnailUrl": "https://img.youtube.com/vi/RcFzYzPEYIc/hqdefault.jpg",
    "duration": "44:23",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "hbgBqvalbYc",
    "title": "#63—Julia Boorstin: Why Women Leaders Excel, and What We Can Learn",
    "channelTitle": "Outthinker",
    "description": "Outthinker • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (24:34)",
    "thumbnailUrl": "https://img.youtube.com/vi/hbgBqvalbYc/hqdefault.jpg",
    "duration": "24:34",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "SLFsK0XFwF0",
    "title": "Media & Tech Insights with CNBC's Julia Boorstin on In Her Words Podcast",
    "channelTitle": "Women in Entertainment",
    "description": "Women in Entertainment • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (38:43)",
    "thumbnailUrl": "https://img.youtube.com/vi/SLFsK0XFwF0/hqdefault.jpg",
    "duration": "38:43",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "YZnb5baQd2M",
    "title": "When Women Lead: Julia Boorstin, CNBC's Senior Media & Tech Correspondent",
    "channelTitle": "Walker & Dunlop",
    "description": "Walker & Dunlop • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (57:17)",
    "thumbnailUrl": "https://img.youtube.com/vi/YZnb5baQd2M/hqdefault.jpg",
    "duration": "57:17",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "t6GIb5zOil4",
    "title": "Power Conversations w/ Julia Boorstin CNBC Media & Tech Correspondent & Author, \"When Women Lead\"",
    "channelTitle": "All Raise",
    "description": "All Raise • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (48:49)",
    "thumbnailUrl": "https://img.youtube.com/vi/t6GIb5zOil4/hqdefault.jpg",
    "duration": "48:49",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "nfYu_fHXMAI",
    "title": "Julia Boorstin, CNBC Senior Media & Tech Reporter,  CNBC’s #Disruptor50, Author \"When Women Lead\"",
    "channelTitle": "WECAN ",
    "description": "WECAN  • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (13:08)",
    "thumbnailUrl": "https://img.youtube.com/vi/nfYu_fHXMAI/hqdefault.jpg",
    "duration": "13:08",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "mc-p1MFci-Q",
    "title": "When Women Lead: Julia Boorstin",
    "channelTitle": "FranklinCovey",
    "description": "FranklinCovey • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (38:30)",
    "thumbnailUrl": "https://img.youtube.com/vi/mc-p1MFci-Q/hqdefault.jpg",
    "duration": "38:30",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "m5HO_XNWDdI",
    "title": "What Happens “When Women Lead”: with CNBC's Julia Boorstin",
    "channelTitle": "Question Everything Podcast",
    "description": "Question Everything Podcast • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (48:55)",
    "thumbnailUrl": "https://img.youtube.com/vi/m5HO_XNWDdI/hqdefault.jpg",
    "duration": "48:55",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "X2nfLCMyX9A",
    "title": "are you living for you?",
    "channelTitle": "anything goes with emma chamberlain",
    "description": "anything goes with emma chamberlain • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (58:38)",
    "thumbnailUrl": "https://img.youtube.com/vi/X2nfLCMyX9A/hqdefault.jpg",
    "duration": "58:38",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "I7InO0tYYDc",
    "title": "overthinking, advice session",
    "channelTitle": "anything goes with emma chamberlain",
    "description": "anything goes with emma chamberlain • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (41:10)",
    "thumbnailUrl": "https://img.youtube.com/vi/I7InO0tYYDc/hqdefault.jpg",
    "duration": "41:10",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "752o1YpwSz0",
    "title": "finding comfort in yourself, advice session",
    "channelTitle": "anything goes with emma chamberlain",
    "description": "anything goes with emma chamberlain • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (37:49)",
    "thumbnailUrl": "https://img.youtube.com/vi/752o1YpwSz0/hqdefault.jpg",
    "duration": "37:49",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "NiOoACQVPGQ",
    "title": "obsessed with your ex, advice session",
    "channelTitle": "anything goes with emma chamberlain",
    "description": "anything goes with emma chamberlain • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (40:17)",
    "thumbnailUrl": "https://img.youtube.com/vi/NiOoACQVPGQ/hqdefault.jpg",
    "duration": "40:17",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "SOyOnkgy1Ns",
    "title": "the mental health conversation on the internet",
    "channelTitle": "anything goes with emma chamberlain",
    "description": "anything goes with emma chamberlain • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (56:27)",
    "thumbnailUrl": "https://img.youtube.com/vi/SOyOnkgy1Ns/hqdefault.jpg",
    "duration": "56:27",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "nkghxBeWYUk",
    "title": "relationships change us",
    "channelTitle": "anything goes with emma chamberlain",
    "description": "anything goes with emma chamberlain • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (38:42)",
    "thumbnailUrl": "https://img.youtube.com/vi/nkghxBeWYUk/hqdefault.jpg",
    "duration": "38:42",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "0njScngRj6U",
    "title": "a talk with kendall jenner",
    "channelTitle": "anything goes with emma chamberlain",
    "description": "anything goes with emma chamberlain • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (49:24)",
    "thumbnailUrl": "https://img.youtube.com/vi/0njScngRj6U/hqdefault.jpg",
    "duration": "49:24",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "0UeQGWPscp8",
    "title": "chasing happiness is making you miserable, advice session",
    "channelTitle": "anything goes with emma chamberlain",
    "description": "anything goes with emma chamberlain • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (27:55)",
    "thumbnailUrl": "https://img.youtube.com/vi/0UeQGWPscp8/hqdefault.jpg",
    "duration": "27:55",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "U-MQKXcrG_w",
    "title": "what my meltdowns have shown me",
    "channelTitle": "anything goes with emma chamberlain",
    "description": "anything goes with emma chamberlain • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (41:10)",
    "thumbnailUrl": "https://img.youtube.com/vi/U-MQKXcrG_w/hqdefault.jpg",
    "duration": "41:10",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "QiJIYF25HAQ",
    "title": "is it time to move on? advice session",
    "channelTitle": "anything goes with emma chamberlain",
    "description": "anything goes with emma chamberlain • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (47:22)",
    "thumbnailUrl": "https://img.youtube.com/vi/QiJIYF25HAQ/hqdefault.jpg",
    "duration": "47:22",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "DDtectxpME4",
    "title": "the fear of missing out",
    "channelTitle": "anything goes with emma chamberlain",
    "description": "anything goes with emma chamberlain • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (42:38)",
    "thumbnailUrl": "https://img.youtube.com/vi/DDtectxpME4/hqdefault.jpg",
    "duration": "42:38",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "w5KHFU-jIJk",
    "title": "Emma Chamberlain On Building Chamberlain Coffee, Burnout & Walking Away From YouTube",
    "channelTitle": "Emma Grede",
    "description": "Emma Grede • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (1:12:14)",
    "thumbnailUrl": "https://img.youtube.com/vi/w5KHFU-jIJk/hqdefault.jpg",
    "duration": "1:12:14",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "Ov5HkYJXToM",
    "title": "becoming a better person, advice session",
    "channelTitle": "anything goes with emma chamberlain",
    "description": "anything goes with emma chamberlain • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (35:21)",
    "thumbnailUrl": "https://img.youtube.com/vi/Ov5HkYJXToM/hqdefault.jpg",
    "duration": "35:21",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "nNILpIjGNDg",
    "title": "bittersweet",
    "channelTitle": "anything goes with emma chamberlain",
    "description": "anything goes with emma chamberlain • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (17:16)",
    "thumbnailUrl": "https://img.youtube.com/vi/nNILpIjGNDg/hqdefault.jpg",
    "duration": "17:16",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "hPwA5qRrdpE",
    "title": "the struggle to find a hobby",
    "channelTitle": "anything goes with emma chamberlain",
    "description": "anything goes with emma chamberlain • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (54:12)",
    "thumbnailUrl": "https://img.youtube.com/vi/hPwA5qRrdpE/hqdefault.jpg",
    "duration": "54:12",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "QZT_D45nenc",
    "title": "Going Viral: 3,000,000 Views in Under 8 Months with Erika Kullberg",
    "channelTitle": "Think Media Podcast",
    "description": "Think Media Podcast • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (28:50)",
    "thumbnailUrl": "https://img.youtube.com/vi/QZT_D45nenc/hqdefault.jpg",
    "duration": "28:50",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "EgbIVOVwhDA",
    "title": "Why Erika Kullberg Turned Down A $100,000 Brand Deal To Build Trust With Her Audience",
    "channelTitle": "Forbes",
    "description": "Forbes • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (27:21)",
    "thumbnailUrl": "https://img.youtube.com/vi/EgbIVOVwhDA/hqdefault.jpg",
    "duration": "27:21",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "vehJDe4P2Pc",
    "title": "6 Ways To Succeed In Your Career and Get Paid More",
    "channelTitle": "Erika Kullberg",
    "description": "Erika Kullberg • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (1:10:03)",
    "thumbnailUrl": "https://img.youtube.com/vi/vehJDe4P2Pc/hqdefault.jpg",
    "duration": "1:10:03",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "iL4Pc5povO8",
    "title": "How Barbara Corcoran turned $1,000 into $66 million",
    "channelTitle": "Erika Kullberg",
    "description": "Erika Kullberg • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (40:10)",
    "thumbnailUrl": "https://img.youtube.com/vi/iL4Pc5povO8/hqdefault.jpg",
    "duration": "40:10",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "1pJlpgv6PkY",
    "title": "5 Millionaire Habits that Changed My Life",
    "channelTitle": "Erika Kullberg",
    "description": "Erika Kullberg • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (14:05)",
    "thumbnailUrl": "https://img.youtube.com/vi/1pJlpgv6PkY/hqdefault.jpg",
    "duration": "14:05",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "XwNLSnQCAYQ",
    "title": "What Financial Experts Won't Tell You About Money With Morgan Housel",
    "channelTitle": "Erika Taught Me with Erika Kullberg",
    "description": "Erika Taught Me with Erika Kullberg • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (1:33:56)",
    "thumbnailUrl": "https://img.youtube.com/vi/XwNLSnQCAYQ/hqdefault.jpg",
    "duration": "1:33:56",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "Ec9K6ZV3Ds4",
    "title": "$270,000,000 Worth of Business Advice From Noah Kagan",
    "channelTitle": "Erika Kullberg",
    "description": "Erika Kullberg • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (1:01:17)",
    "thumbnailUrl": "https://img.youtube.com/vi/Ec9K6ZV3Ds4/hqdefault.jpg",
    "duration": "1:01:17",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "iKQUgk41wJ4",
    "title": "Ace Your Job Interview With This Uncommon Sales Strategy",
    "channelTitle": "Erika Kullberg",
    "description": "Erika Kullberg • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (1:15:59)",
    "thumbnailUrl": "https://img.youtube.com/vi/iKQUgk41wJ4/hqdefault.jpg",
    "duration": "1:15:59",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "4TFr__qfOfw",
    "title": "Does Fame Make You Happy? Life With Over 60 Million Followers with Nas Daily",
    "channelTitle": "Erika Taught Me with Erika Kullberg",
    "description": "Erika Taught Me with Erika Kullberg • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (58:19)",
    "thumbnailUrl": "https://img.youtube.com/vi/4TFr__qfOfw/hqdefault.jpg",
    "duration": "58:19",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "nQy0Pif7I9c",
    "title": "Former Secret Service Agent Reveals Psychological Tricks You're Falling For",
    "channelTitle": "Erika Kullberg",
    "description": "Erika Kullberg • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (1:06:29)",
    "thumbnailUrl": "https://img.youtube.com/vi/nQy0Pif7I9c/hqdefault.jpg",
    "duration": "1:06:29",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  },
  {
    "videoId": "zglDZqfHPo4",
    "title": "Marketing Expert Reveals Secret For Building an Audience That Buys | Seth Godin",
    "channelTitle": "Erika Kullberg",
    "description": "Erika Kullberg • 최고 음질 & 또렷한 딕션의 여성 앵커/명사 1:1 심층 초대석 인터뷰 (55:19)",
    "thumbnailUrl": "https://img.youtube.com/vi/zglDZqfHPo4/hqdefault.jpg",
    "duration": "55:19",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "여성명사",
      "심층인터뷰",
      "고급딕션",
      "쉐도잉"
    ],
    "source": "curated_news"
  }
];

export const DEFAULT_MOVIE_DRAMA_TRACKS = [
  {
    "videoId": "nTnyGDPLeeU",
    "title": "SMITTEN | ROMANCE, COMEDY | Full Movie in English",
    "channelTitle": "Boxoffice | ROMANCE | Full Movies",
    "description": "Boxoffice | ROMANCE | Full Movies • 풀버전 고화질 로맨스/드라마 영화 (1:24:14)",
    "thumbnailUrl": "https://img.youtube.com/vi/nTnyGDPLeeU/hqdefault.jpg",
    "duration": "1:24:14",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "BPaDMRLl6X4",
    "title": "From Enemies to Lovers | ROMANCE | Full Movie in English",
    "channelTitle": "Boxoffice | ROMANCE | Full Movies",
    "description": "Boxoffice | ROMANCE | Full Movies • 풀버전 고화질 로맨스/드라마 영화 (1:30:29)",
    "thumbnailUrl": "https://img.youtube.com/vi/BPaDMRLl6X4/hqdefault.jpg",
    "duration": "1:30:29",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "uIOrX103_Gk",
    "title": "MISTRUST | ROMANCE | Full Movie in English",
    "channelTitle": "Boxoffice | NEW Full Movies in English",
    "description": "Boxoffice | NEW Full Movies in English • 풀버전 고화질 로맨스/드라마 영화 (1:23:45)",
    "thumbnailUrl": "https://img.youtube.com/vi/uIOrX103_Gk/hqdefault.jpg",
    "duration": "1:23:45",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "h82UZ6GFFpI",
    "title": "Christmas in the Pines | ROMANCE | Full Movie in English",
    "channelTitle": "Boxoffice | NEW Full Movies in English",
    "description": "Boxoffice | NEW Full Movies in English • 풀버전 고화질 로맨스/드라마 영화 (1:30:29)",
    "thumbnailUrl": "https://img.youtube.com/vi/h82UZ6GFFpI/hqdefault.jpg",
    "duration": "1:30:29",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "MfnSBLn8VMA",
    "title": "City Love | Full Movie in English | Romance, Drama, Comedy",
    "channelTitle": "Boxoffice | ROMANCE | Full Movies",
    "description": "Boxoffice | ROMANCE | Full Movies • 풀버전 고화질 로맨스/드라마 영화 (1:35:58)",
    "thumbnailUrl": "https://img.youtube.com/vi/MfnSBLn8VMA/hqdefault.jpg",
    "duration": "1:35:58",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "xs8UV9wdWlI",
    "title": "LOVE IN FOCUS | Full Romance Movie | Nicola Posener, Dan Fowlks, Colin Cunningham",
    "channelTitle": "The Cinematics Stories",
    "description": "The Cinematics Stories • 풀버전 고화질 로맨스/드라마 영화 (1:26:18)",
    "thumbnailUrl": "https://img.youtube.com/vi/xs8UV9wdWlI/hqdefault.jpg",
    "duration": "1:26:18",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "MaTIfXu_c-k",
    "title": "A Royal in Paradise | Full Romantic Comedy Movie",
    "channelTitle": "NicelyTV",
    "description": "NicelyTV • 풀버전 고화질 로맨스/드라마 영화 (1:30:25)",
    "thumbnailUrl": "https://img.youtube.com/vi/MaTIfXu_c-k/hqdefault.jpg",
    "duration": "1:30:25",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "AGyGGou17cQ",
    "title": "Tortoise in Love | A Charming British Romantic Comedy | Full Movie",
    "channelTitle": "FREE MOVIES",
    "description": "FREE MOVIES • 풀버전 고화질 로맨스/드라마 영화 (1:20:54)",
    "thumbnailUrl": "https://img.youtube.com/vi/AGyGGou17cQ/hqdefault.jpg",
    "duration": "1:20:54",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "SzNBxlb096A",
    "title": "Will He Like Me, Will He Not? | ROMANCE, COMEDY | Full Movie in English",
    "channelTitle": "MyMovies",
    "description": "MyMovies • 풀버전 고화질 로맨스/드라마 영화 (1:24:14)",
    "thumbnailUrl": "https://img.youtube.com/vi/SzNBxlb096A/hqdefault.jpg",
    "duration": "1:24:14",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "kZYTKfmoq3k",
    "title": "ALL WOMEN ARE IN LOVE WITH THIS MOVIE! Watch this romantic story in English for free",
    "channelTitle": "FILMDOMINION",
    "description": "FILMDOMINION • 풀버전 고화질 로맨스/드라마 영화 (1:24:21)",
    "thumbnailUrl": "https://img.youtube.com/vi/kZYTKfmoq3k/hqdefault.jpg",
    "duration": "1:24:21",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "rkGwLyxNzhQ",
    "title": "😂❤️ A Crazy Romantic Comedy for an Evening Full of Laughter! | Free Full Movie in English",
    "channelTitle": "Movie Marathon",
    "description": "Movie Marathon • 풀버전 고화질 로맨스/드라마 영화 (1:36:16)",
    "thumbnailUrl": "https://img.youtube.com/vi/rkGwLyxNzhQ/hqdefault.jpg",
    "duration": "1:36:16",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "EicNchNKnBI",
    "title": "Accidentally in Love | ROMANTIC COMEDY | Full Movie in English",
    "channelTitle": "Boxoffice | NEW Full Movies in English",
    "description": "Boxoffice | NEW Full Movies in English • 풀버전 고화질 로맨스/드라마 영화 (1:27:25)",
    "thumbnailUrl": "https://img.youtube.com/vi/EicNchNKnBI/hqdefault.jpg",
    "duration": "1:27:25",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "DsOijjb_yic",
    "title": "😍🍿 You’ll Want to Watch This HILARIOUS COMEDY Again and Again! Romantic Comedy | FREE Full Movie",
    "channelTitle": "Popcorn Movie Night",
    "description": "Popcorn Movie Night • 풀버전 고화질 로맨스/드라마 영화 (1:25:21)",
    "thumbnailUrl": "https://img.youtube.com/vi/DsOijjb_yic/hqdefault.jpg",
    "duration": "1:25:21",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "E10iY_eDe3A",
    "title": "A Life With You | ROMANCE, FAMILY | Full Movie in English",
    "channelTitle": "MyMovies",
    "description": "MyMovies • 풀버전 고화질 로맨스/드라마 영화 (1:37:32)",
    "thumbnailUrl": "https://img.youtube.com/vi/E10iY_eDe3A/hqdefault.jpg",
    "duration": "1:37:32",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "DgE9JOUcA1A",
    "title": "🌸 She Only Came Back For The Summer… But Found The Love Of Her Life | Full Movie",
    "channelTitle": "VISMAX PRO",
    "description": "VISMAX PRO • 풀버전 고화질 로맨스/드라마 영화 (1:21:11)",
    "thumbnailUrl": "https://img.youtube.com/vi/DgE9JOUcA1A/hqdefault.jpg",
    "duration": "1:21:11",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "9U9RBrFf94s",
    "title": "The Magic Of Ordinary Days | English Full Movie | Romance | Movie Dot (MD Channel)",
    "channelTitle": "Multi Movie Show",
    "description": "Multi Movie Show • 풀버전 고화질 로맨스/드라마 영화 (1:38:00)",
    "thumbnailUrl": "https://img.youtube.com/vi/9U9RBrFf94s/hqdefault.jpg",
    "duration": "1:38:00",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "yb8JJMML0Ms",
    "title": "Wild Child (2008) - Full Comedy |  Drama | Romance Movie",
    "channelTitle": "Tiktok Official Hindi",
    "description": "Tiktok Official Hindi • 풀버전 고화질 로맨스/드라마 영화 (1:38:25)",
    "thumbnailUrl": "https://img.youtube.com/vi/yb8JJMML0Ms/hqdefault.jpg",
    "duration": "1:38:25",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "p8egZga9Fqs",
    "title": "Love on Harbor Island FULL MOVIE | Romance Movies | Femme Fatales",
    "channelTitle": "Femme Fatales",
    "description": "Femme Fatales • 풀버전 고화질 로맨스/드라마 영화 (1:26:33)",
    "thumbnailUrl": "https://img.youtube.com/vi/p8egZga9Fqs/hqdefault.jpg",
    "duration": "1:26:33",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "CAecMQoPHQ4",
    "title": "A Forbidden Royal Love | ROMANCE, ADVENTURE | Full Movie in English 💎",
    "channelTitle": "Full Movies in English HD",
    "description": "Full Movies in English HD • 풀버전 고화질 로맨스/드라마 영화 (1:31:11)",
    "thumbnailUrl": "https://img.youtube.com/vi/CAecMQoPHQ4/hqdefault.jpg",
    "duration": "1:31:11",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "jBhRZ2KmaZ4",
    "title": "ROMEO AND JULIET GET MARRIED 🎬 Full Romance Drama Movie 🎬 English HD",
    "channelTitle": "WATCH DRAMA MOVIES NOW",
    "description": "WATCH DRAMA MOVIES NOW • 풀버전 고화질 로맨스/드라마 영화 (1:53:07)",
    "thumbnailUrl": "https://img.youtube.com/vi/jBhRZ2KmaZ4/hqdefault.jpg",
    "duration": "1:53:07",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "8OuTU256Rm8",
    "title": "She Started Life From Scratch... And Found The Love Of Her Life 😍 Full Romantic Movie",
    "channelTitle": "VISMAX PRO",
    "description": "VISMAX PRO • 풀버전 고화질 로맨스/드라마 영화 (1:28:17)",
    "thumbnailUrl": "https://img.youtube.com/vi/8OuTU256Rm8/hqdefault.jpg",
    "duration": "1:28:17",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "x10OgRa0kxk",
    "title": "Youthful Mistakes | Romance | Full Movie",
    "channelTitle": "Boxoffice | ROMANCE | Full Movies",
    "description": "Boxoffice | ROMANCE | Full Movies • 풀버전 고화질 로맨스/드라마 영화 (1:37:50)",
    "thumbnailUrl": "https://img.youtube.com/vi/x10OgRa0kxk/hqdefault.jpg",
    "duration": "1:37:50",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "HtnC2vxC1aA",
    "title": "My Teacher's Romance | COMEDY | Full Movie",
    "channelTitle": "Full Movies in English HD",
    "description": "Full Movies in English HD • 풀버전 고화질 로맨스/드라마 영화 (1:26:58)",
    "thumbnailUrl": "https://img.youtube.com/vi/HtnC2vxC1aA/hqdefault.jpg",
    "duration": "1:26:58",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "NDmLTRL_T0E",
    "title": "She Fell in Love Without Knowing His Secret | Full Romantic Movie",
    "channelTitle": "VISMAX PRO",
    "description": "VISMAX PRO • 풀버전 고화질 로맨스/드라마 영화 (1:31:29)",
    "thumbnailUrl": "https://img.youtube.com/vi/NDmLTRL_T0E/hqdefault.jpg",
    "duration": "1:31:29",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "r4efnA0Wazo",
    "title": "The Most Beautiful Love Story of This Year ❤️🎬 This Movie Will Melt Your Heart 🥺❤️",
    "channelTitle": "VISMAX PRO",
    "description": "VISMAX PRO • 풀버전 고화질 로맨스/드라마 영화 (1:28:09)",
    "thumbnailUrl": "https://img.youtube.com/vi/r4efnA0Wazo/hqdefault.jpg",
    "duration": "1:28:09",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "3oBq-U7iV6Q",
    "title": "Feel-Good Movie! He’s a secret billionaire who falls for a simple girl! Romantic Movies in English",
    "channelTitle": "in Bilmi",
    "description": "in Bilmi • 풀버전 고화질 로맨스/드라마 영화 (1:27:18)",
    "thumbnailUrl": "https://img.youtube.com/vi/3oBq-U7iV6Q/hqdefault.jpg",
    "duration": "1:27:18",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "7BY6S-YT4Cg",
    "title": "He Never Expected to Fall in Love ❤️ She Changed His Life Forever...",
    "channelTitle": "VISMAX PRO",
    "description": "VISMAX PRO • 풀버전 고화질 로맨스/드라마 영화 (1:20:34)",
    "thumbnailUrl": "https://img.youtube.com/vi/7BY6S-YT4Cg/hqdefault.jpg",
    "duration": "1:20:34",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "p3harwcAygI",
    "title": "This is a MOVIE you'll want to watch over and over again ✨ Romantic Movies",
    "channelTitle": "VISMAX PRO",
    "description": "VISMAX PRO • 풀버전 고화질 로맨스/드라마 영화 (1:21:21)",
    "thumbnailUrl": "https://img.youtube.com/vi/p3harwcAygI/hqdefault.jpg",
    "duration": "1:21:21",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "XMLBXXPX4QA",
    "title": "THIS IS A MOVIE YOU’LL WANT TO WATCH OVER AND OVER AGAIN! | Romantic Movies | Follow Your Heart",
    "channelTitle": "VISMAX PRO",
    "description": "VISMAX PRO • 풀버전 고화질 로맨스/드라마 영화 (1:38:29)",
    "thumbnailUrl": "https://img.youtube.com/vi/XMLBXXPX4QA/hqdefault.jpg",
    "duration": "1:38:29",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "lc9w6JzXGEI",
    "title": "This Love Story You’ll Want to Watch Again and Again! | FOLLOW YOUR HEART | Full Movie",
    "channelTitle": "FILMDOMINION",
    "description": "FILMDOMINION • 풀버전 고화질 로맨스/드라마 영화 (1:38:32)",
    "thumbnailUrl": "https://img.youtube.com/vi/lc9w6JzXGEI/hqdefault.jpg",
    "duration": "1:38:32",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "gscsCeQvfjI",
    "title": "A Perfectly Fake Marriage | ROMANTIC COMEDY | Full Movie in English 💎",
    "channelTitle": "Boxoffice | COMEDIES | Full Movies",
    "description": "Boxoffice | COMEDIES | Full Movies • 풀버전 고화질 로맨스/드라마 영화 (1:27:25)",
    "thumbnailUrl": "https://img.youtube.com/vi/gscsCeQvfjI/hqdefault.jpg",
    "duration": "1:27:25",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "XE_5j3F5PAg",
    "title": "WHATEVER MAKES YOU HAPPY | Full Length Romance Movie | English | FULL MOVIE FOR FREE",
    "channelTitle": "Film Zone",
    "description": "Film Zone • 풀버전 고화질 로맨스/드라마 영화 (1:56:49)",
    "thumbnailUrl": "https://img.youtube.com/vi/XE_5j3F5PAg/hqdefault.jpg",
    "duration": "1:56:49",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "-rmUmmhhffA",
    "title": "Love Finds a Way | Heartwarming Romance Movie | Full Movie HD",
    "channelTitle": "LoveLoom Films",
    "description": "LoveLoom Films • 풀버전 고화질 로맨스/드라마 영화 (1:14:07)",
    "thumbnailUrl": "https://img.youtube.com/vi/-rmUmmhhffA/hqdefault.jpg",
    "duration": "1:14:07",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "raG4zNtPH5Y",
    "title": "FULL] The Hidden Heir of the Vitiello Family Full Movie 2026 | the Vitiello Family Full Episode🔥",
    "channelTitle": "Mithilesh Ballia",
    "description": "Mithilesh Ballia • 풀버전 고화질 로맨스/드라마 영화 (1:30:08)",
    "thumbnailUrl": "https://img.youtube.com/vi/raG4zNtPH5Y/hqdefault.jpg",
    "duration": "1:30:08",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "9k11EVhfy5o",
    "title": "FULL] The Hidden Heir of the Vitiello Family Full Movie 2026 | the Vitiello Family Full Episode🔥",
    "channelTitle": "Akash rajbhar Rajbhar",
    "description": "Akash rajbhar Rajbhar • 풀버전 고화질 로맨스/드라마 영화 (1:40:02)",
    "thumbnailUrl": "https://img.youtube.com/vi/9k11EVhfy5o/hqdefault.jpg",
    "duration": "1:40:02",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "QnYgmRSsiaM",
    "title": "One Night with the CEO, 5 Years Later He Finds His Secret Twins & Marries Me!",
    "channelTitle": "Twisted FateSeries",
    "description": "Twisted FateSeries • 풀버전 고화질 로맨스/드라마 영화 (1:57:50)",
    "thumbnailUrl": "https://img.youtube.com/vi/QnYgmRSsiaM/hqdefault.jpg",
    "duration": "1:57:50",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "86mDpskfbtE",
    "title": "😄She thought her 30-min wedding was a joke! Flash Marriage: 2 Yrs Later, CEO Heir Moves In!⭐",
    "channelTitle": "Twisted FateSeries",
    "description": "Twisted FateSeries • 풀버전 고화질 로맨스/드라마 영화 (2:27:26)",
    "thumbnailUrl": "https://img.youtube.com/vi/86mDpskfbtE/hqdefault.jpg",
    "duration": "2:27:26",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "htknl4o1_nQ",
    "title": "Genius Kid Finds His Lost Mom on the Street—Billionaire CEO Marries Her on the Spot!",
    "channelTitle": "Twisted FateSeries",
    "description": "Twisted FateSeries • 풀버전 고화질 로맨스/드라마 영화 (2:13:03)",
    "thumbnailUrl": "https://img.youtube.com/vi/htknl4o1_nQ/hqdefault.jpg",
    "duration": "2:13:03",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "kys5fNH_LP0",
    "title": "😡They made me marry a dying man! Now he's awake and destroying all my bullies!",
    "channelTitle": "Billionaire's Sweetheart TV",
    "description": "Billionaire's Sweetheart TV • 풀버전 고화질 로맨스/드라마 영화 (2:07:30)",
    "thumbnailUrl": "https://img.youtube.com/vi/kys5fNH_LP0/hqdefault.jpg",
    "duration": "2:07:30",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "F0HM0fN91wM",
    "title": "🌪️I Rush-Married an Injured Tycoon. It Was Supposed to Be a Trap, Until He Woke Up❤️",
    "channelTitle": "Twisted FateSeries",
    "description": "Twisted FateSeries • 풀버전 고화질 로맨스/드라마 영화 (2:40:32)",
    "thumbnailUrl": "https://img.youtube.com/vi/F0HM0fN91wM/hqdefault.jpg",
    "duration": "2:40:32",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "gTWJHuEGWUo",
    "title": "Drugged One-Night Stand with the CEO: 5 Years Later His Silent Baby Calls a Car Wash Girl MOM!",
    "channelTitle": "Twisted FateSeries",
    "description": "Twisted FateSeries • 풀버전 고화질 로맨스/드라마 영화 (1:20:24)",
    "thumbnailUrl": "https://img.youtube.com/vi/gTWJHuEGWUo/hqdefault.jpg",
    "duration": "1:20:24",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "O26h9RRW-R0",
    "title": "Transference  A Love Story FULL HD MOVIE ▶️",
    "channelTitle": "Cinema Universe ",
    "description": "Cinema Universe  • 풀버전 고화질 로맨스/드라마 영화 (1:47:20)",
    "thumbnailUrl": "https://img.youtube.com/vi/O26h9RRW-R0/hqdefault.jpg",
    "duration": "1:47:20",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "RAIFwI4yoE4",
    "title": "tagalog romantic full movie - jennylyn mercado derek ramsay",
    "channelTitle": "SE VI LLA Tv.",
    "description": "SE VI LLA Tv. • 풀버전 고화질 로맨스/드라마 영화 (1:46:57)",
    "thumbnailUrl": "https://img.youtube.com/vi/RAIFwI4yoE4/hqdefault.jpg",
    "duration": "1:46:57",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "z2JpmAQE9Fk",
    "title": "The Day Love Rented the Empty House | Full Romantic Movie 2026",
    "channelTitle": "LoveLoom Films",
    "description": "LoveLoom Films • 풀버전 고화질 로맨스/드라마 영화 (1:29:02)",
    "thumbnailUrl": "https://img.youtube.com/vi/z2JpmAQE9Fk/hqdefault.jpg",
    "duration": "1:29:02",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "d-pMBOsr7Jo",
    "title": "Sabah: A Love Story",
    "channelTitle": "Turki Nasser Alomeer",
    "description": "Turki Nasser Alomeer • 풀버전 고화질 로맨스/드라마 영화 (1:29:38)",
    "thumbnailUrl": "https://img.youtube.com/vi/d-pMBOsr7Jo/hqdefault.jpg",
    "duration": "1:29:38",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "GG8EdIZ8zSI",
    "title": "Healing Hearts on Cedar Valley Ranch | Full Romantic Drama 2026",
    "channelTitle": "LoveLoom Films",
    "description": "LoveLoom Films • 풀버전 고화질 로맨스/드라마 영화 (1:25:30)",
    "thumbnailUrl": "https://img.youtube.com/vi/GG8EdIZ8zSI/hqdefault.jpg",
    "duration": "1:25:30",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "WPU0k2iqFm8",
    "title": "He Saved Her Ranch She Stole His Heart | Full Western Romance Movie",
    "channelTitle": "SilkSoul Films",
    "description": "SilkSoul Films • 풀버전 고화질 로맨스/드라마 영화 (1:24:29)",
    "thumbnailUrl": "https://img.youtube.com/vi/WPU0k2iqFm8/hqdefault.jpg",
    "duration": "1:24:29",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "FqHn2VBqTrg",
    "title": "South African Romantic Drama | Coming-of-Age Love Story ❤️ Full Movie 🎬 FAREWELL 4K",
    "channelTitle": "Greenlight Productions",
    "description": "Greenlight Productions • 풀버전 고화질 로맨스/드라마 영화 (1:07:46)",
    "thumbnailUrl": "https://img.youtube.com/vi/FqHn2VBqTrg/hqdefault.jpg",
    "duration": "1:07:46",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  },
  {
    "videoId": "udNCrXdLBNM",
    "title": "An Eternal Love - English Dubbed Full Movie | A School Love Story | Triangle Love Story | Subtitles",
    "channelTitle": "New Generation",
    "description": "New Generation • 풀버전 고화질 로맨스/드라마 영화 (2:01:39)",
    "thumbnailUrl": "https://img.youtube.com/vi/udNCrXdLBNM/hqdefault.jpg",
    "duration": "2:01:39",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "풀버전영화",
      "로맨스",
      "드라마",
      "장편쉐도잉"
    ],
    "source": "curated_movie_drama"
  }
];

export const DEFAULT_ENGLISH_CURATED_TRACKS = [
  {
    "videoId": "jDaZu_KEMCY",
    "title": "Natalie Portman Harvard Commencement Speech (Full Speech | 20m)",
    "channelTitle": "Harvard University",
    "description": "Natalie Portman (하버드대 졸업 / 아카데미 여우주연상) • 나만의 자신감을 찾고 두려움을 이겨내는 감동적인 명연설 (20분, 완벽한 하버드 딕션)",
    "thumbnailUrl": "https://img.youtube.com/vi/jDaZu_KEMCY/hqdefault.jpg",
    "duration": "20:16",
    "language": "en",
    "category": "ted_speech",
    "tags": [
      "영어스피치",
      "NataliePortman",
      "하버드졸업연설",
      "명품딕션",
      "자신감"
    ],
    "source": "curated_english"
  },
  {
    "videoId": "OBG50aoUwlI",
    "title": "Taylor Swift NYU Commencement Speech (Full Official Speech | 28m)",
    "channelTitle": "New York University",
    "description": "Taylor Swift • 뉴욕대 명예박사 학위 수락 연설, 유쾌하고 지혜로운 인생 조언 (28분 풀연설)",
    "thumbnailUrl": "https://img.youtube.com/vi/OBG50aoUwlI/hqdefault.jpg",
    "duration": "28:05",
    "language": "en",
    "category": "ted_speech",
    "tags": [
      "영어스피치",
      "TaylorSwift",
      "NYU졸업연설",
      "인생조언",
      "명품스피치"
    ],
    "source": "curated_english"
  },
  {
    "videoId": "R6mCwMbJDFs",
    "title": "7 Insane Life & Money Lessons | The Financial Diet (Chelsea Fagan)",
    "channelTitle": "The Financial Diet",
    "description": "Chelsea Fagan • 현실적인 2030 라이프스타일과 돈, 인간관계의 지혜 (21분)",
    "thumbnailUrl": "https://img.youtube.com/vi/R6mCwMbJDFs/hqdefault.jpg",
    "duration": "21:28",
    "language": "en",
    "category": "essay_deep",
    "tags": [
      "TheFinancialDiet",
      "ChelseaFagan",
      "라이프스타일",
      "명품딕션"
    ],
    "source": "curated_english"
  },
  {
    "videoId": "ehUqBLf8XI4",
    "title": "How To Stop Being Cheap & Upgrade Your Everyday Life | The Financial Diet",
    "channelTitle": "The Financial Diet",
    "description": "Chelsea Fagan • 삶의 품격을 높이고 나를 아끼는 태도에 관한 22분 심층 에세이",
    "thumbnailUrl": "https://img.youtube.com/vi/ehUqBLf8XI4/hqdefault.jpg",
    "duration": "21:59",
    "language": "en",
    "category": "essay_deep",
    "tags": [
      "TheFinancialDiet",
      "ChelseaFagan",
      "자기성장",
      "명품딕션"
    ],
    "source": "curated_english"
  },
  {
    "videoId": "_AclJGh1XcU",
    "title": "Coffee Talks | How I Build Self-Confidence & Overcome Doubt | Sanne Vloet",
    "channelTitle": "Sanne Vloet",
    "description": "Sanne Vloet • 따뜻한 커피 한 잔과 함께 나누는 자기 확신과 자존감 회복 이야기 (16분)",
    "thumbnailUrl": "https://img.youtube.com/vi/_AclJGh1XcU/hqdefault.jpg",
    "duration": "15:50",
    "language": "en",
    "category": "essay_deep",
    "tags": [
      "SanneVloet",
      "자존감",
      "자기확신",
      "차분한대화",
      "쉐도잉"
    ],
    "source": "curated_english"
  },
  {
    "videoId": "FmBRB2Wq8VU",
    "title": "7 Life Changing Mindset Habits to Soothe the Anxious Soul | Rowena Tsai",
    "channelTitle": "Rowena Tsai",
    "description": "Rowena Tsai • 불안한 마음을 다스리고 평온을 되찾는 7가지 마인드셋 습관 (16분)",
    "thumbnailUrl": "https://img.youtube.com/vi/FmBRB2Wq8VU/hqdefault.jpg",
    "duration": "16:17",
    "language": "en",
    "category": "essay_deep",
    "tags": [
      "RowenaTsai",
      "마음챙김",
      "습관형성",
      "차분한목소리"
    ],
    "source": "curated_english"
  },
  {
    "videoId": "_Yj8nHQeZjk",
    "title": "7 Mindset Habits That Helped Me Get My Life Together | Rowena Tsai",
    "channelTitle": "Rowena Tsai",
    "description": "Rowena Tsai • 내면을 정돈하고 삶의 방향을 바로잡는 실천적 마인드셋 (19분)",
    "thumbnailUrl": "https://img.youtube.com/vi/_Yj8nHQeZjk/hqdefault.jpg",
    "duration": "18:55",
    "language": "en",
    "category": "essay_deep",
    "tags": [
      "RowenaTsai",
      "자기계발",
      "마인드셋",
      "명품딕션"
    ],
    "source": "curated_english"
  },
  {
    "videoId": "nAK9UCjrdi4",
    "title": "Life Changing Soft Habits for a More Mindful Existence | Rowena Tsai",
    "channelTitle": "Rowena Tsai",
    "description": "Rowena Tsai • 부드럽지만 단단한 일상을 만드는 작은 습관들 (15분)",
    "thumbnailUrl": "https://img.youtube.com/vi/nAK9UCjrdi4/hqdefault.jpg",
    "duration": "14:38",
    "language": "en",
    "category": "essay_deep",
    "tags": [
      "RowenaTsai",
      "슬로우라이프",
      "마음챙김",
      "쉐도잉"
    ],
    "source": "curated_english"
  },
  {
    "videoId": "0gks6ceq4eQ",
    "title": "You aren't at the mercy of your emotions — your brain creates them | Dr. Lisa Feldman Barrett",
    "channelTitle": "TED",
    "description": "Dr. Lisa Feldman Barrett (세계적 뇌과학자) • 뇌가 감정을 만드는 과학적 원리와 감정 조절 비결 (18분 명강연)",
    "thumbnailUrl": "https://img.youtube.com/vi/0gks6ceq4eQ/hqdefault.jpg",
    "duration": "18:29",
    "language": "en",
    "category": "ted_speech",
    "tags": [
      "TED",
      "뇌과학",
      "감정조절",
      "명품강연",
      "LisaFeldmanBarrett"
    ],
    "source": "curated_english"
  },
  {
    "videoId": "LNHBMFCzznE",
    "title": "After watching this, your brain will not be the same | Dr. Lara Boyd | TEDx",
    "channelTitle": "TEDx Talks",
    "description": "Dr. Lara Boyd • 신경가소성과 뇌 훈련을 통한 놀라운 자기 변화 (14분)",
    "thumbnailUrl": "https://img.youtube.com/vi/LNHBMFCzznE/hqdefault.jpg",
    "duration": "14:24",
    "language": "en",
    "category": "ted_speech",
    "tags": [
      "TEDx",
      "신경과학",
      "뇌가소성",
      "스피치마스터"
    ],
    "source": "curated_english"
  },
  {
    "videoId": "NWH8N-BvhAw",
    "title": "The three secrets of resilient people | Lucy Hone | TEDx",
    "channelTitle": "TEDx Talks",
    "description": "Lucy Hone • 큰 상실과 슬픔 속에서도 다시 일어나는 3가지 회복 탄력성의 비밀 (16분)",
    "thumbnailUrl": "https://img.youtube.com/vi/NWH8N-BvhAw/hqdefault.jpg",
    "duration": "16:21",
    "language": "en",
    "category": "ted_speech",
    "tags": [
      "TEDx",
      "회복탄력성",
      "감동연설",
      "스피치훈련"
    ],
    "source": "curated_english"
  },
  {
    "videoId": "TFbv757kup4",
    "title": "The Secret of Becoming Mentally Strong | Amy Morin | TEDx",
    "channelTitle": "TEDx Talks",
    "description": "Amy Morin • 멘탈이 강한 사람들의 핵심 습관과 마인드셋 훈련 (15분)",
    "thumbnailUrl": "https://img.youtube.com/vi/TFbv757kup4/hqdefault.jpg",
    "duration": "15:02",
    "language": "en",
    "category": "ted_speech",
    "tags": [
      "TEDx",
      "멘탈관리",
      "자기통제",
      "동기부여"
    ],
    "source": "curated_english"
  },
  {
    "videoId": "L44p6oul8T4",
    "title": "How to Live Intentionally with Malama Life | The Lavendaire Lifestyle (55m)",
    "channelTitle": "The Lavendaire Lifestyle",
    "description": "Aileen Xu & Malama Life • 심플라이프와 마음 챙김, 나다운 삶을 설계하는 55분 차분한 롱폼 팟캐스트",
    "thumbnailUrl": "https://img.youtube.com/vi/L44p6oul8T4/hqdefault.jpg",
    "duration": "55:11",
    "language": "en",
    "category": "sleep_life",
    "tags": [
      "TheLavendaireLifestyle",
      "심플라이프",
      "55분팟캐스트",
      "수면오디오"
    ],
    "source": "curated_english"
  },
  {
    "videoId": "Nw8QF229UKU",
    "title": "Exit Your Lazy Era & Enter Productive Era | A Better You Podcast (43m)",
    "channelTitle": "Fernanda Ramirez (A Better You)",
    "description": "Fernanda Ramirez • 20대 여성의 현실적인 갓생 루틴과 자기 통제력 43분 딥토크",
    "thumbnailUrl": "https://img.youtube.com/vi/Nw8QF229UKU/hqdefault.jpg",
    "duration": "42:38",
    "language": "en",
    "category": "sleep_life",
    "tags": [
      "ABetterYou",
      "생산성",
      "20대성장",
      "43분토크"
    ],
    "source": "curated_english"
  },
  {
    "videoId": "ZCj2y95-Db8",
    "title": "Making Space with Hoda Kotb: Savannah Guthrie (49m Full Episode)",
    "channelTitle": "NBC TODAY",
    "description": "Hoda Kotb & Savannah Guthrie • 두 여성 탑 앵커의 49분 풀버전 인생 대담 & 진솔한 고백",
    "thumbnailUrl": "https://img.youtube.com/vi/ZCj2y95-Db8/hqdefault.jpg",
    "duration": "48:41",
    "language": "en",
    "category": "news_interview",
    "tags": [
      "뉴스초대석",
      "NBCTODAY",
      "HodaKotb",
      "SavannahGuthrie",
      "49분대담"
    ],
    "source": "curated_english"
  },
  {
    "videoId": "XH-FDfbRmuI",
    "title": "Campus Encounter | ROMANCE, COMEDY | Full Movie in English (1h 33m)",
    "channelTitle": "Boxoffice TV Movies",
    "description": "캠퍼스에서 시작되는 달콤하고 유쾌한 로맨스 코미디 & 드라마 풀무비 쉐도잉 (1시간 33분)",
    "thumbnailUrl": "https://img.youtube.com/vi/XH-FDfbRmuI/hqdefault.jpg",
    "duration": "1:32:52",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "로맨스영화",
      "풀버전영화",
      "영어듣기"
    ],
    "source": "curated_english"
  },
  {
    "videoId": "Q6WJE0A43ps",
    "title": "Hallmark Romantic Full Movie | She Had Given Up on Romance (1h 28m)",
    "channelTitle": "Romantic Movie Hub",
    "description": "상처를 딛고 새로운 사랑을 찾아가는 따뜻한 홀마크 스타일 로맨스 풀버전 영화 (1시간 28분)",
    "thumbnailUrl": "https://img.youtube.com/vi/Q6WJE0A43ps/hqdefault.jpg",
    "duration": "1:27:58",
    "language": "en",
    "category": "movie_drama",
    "tags": [
      "영화쉐도잉",
      "홀마크로맨스",
      "풀버전영화",
      "감성드라마"
    ],
    "source": "curated_english"
  }
];

export const DEFAULT_ENGLISH_POP_TRACKS = [
  {
    "videoId": "YQHsXMglC9A",
    "title": "Adele - Hello (Official Music Video)",
    "channelTitle": "Adele",
    "artist": "Adele",
    "description": "Adele - Hello (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (6:07)",
    "thumbnailUrl": "https://img.youtube.com/vi/YQHsXMglC9A/hqdefault.jpg",
    "duration": "6:07",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "Adele",
      "명품보컬",
      "감성팝",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "hLQl3WQQoQ0",
    "title": "Adele - Someone Like You (Official Music Video)",
    "channelTitle": "Adele",
    "artist": "Adele",
    "description": "Adele - Someone Like You (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (4:45)",
    "thumbnailUrl": "https://img.youtube.com/vi/hLQl3WQQoQ0/hqdefault.jpg",
    "duration": "4:45",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "Adele",
      "피아노발라드",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "RDRwqTNLGDs",
    "title": "Adele - Don't You Remember (Live at Largo)",
    "channelTitle": "Adele",
    "artist": "Adele",
    "description": "Adele - Don't You Remember (Live at Largo) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (4:16)",
    "thumbnailUrl": "https://img.youtube.com/vi/RDRwqTNLGDs/hqdefault.jpg",
    "duration": "4:16",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "Adele",
      "어쿠스틱라이브",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "TdrL3QxjyVw",
    "title": "Lana Del Rey - Summertime Sadness (Official Music Video)",
    "channelTitle": "Lana Del Rey",
    "artist": "Lana Del Rey",
    "description": "Lana Del Rey - Summertime Sadness (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (4:26)",
    "thumbnailUrl": "https://img.youtube.com/vi/TdrL3QxjyVw/hqdefault.jpg",
    "duration": "4:26",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "LanaDelRey",
      "감성팝",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "uxjhN_Donfw",
    "title": "Gracie Abrams - I Love You, I’m Sorry (Official Music Video)",
    "channelTitle": "Gracie Abrams",
    "artist": "Gracie Abrams",
    "description": "Gracie Abrams - I Love You, I’m Sorry (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:54)",
    "thumbnailUrl": "https://img.youtube.com/vi/uxjhN_Donfw/hqdefault.jpg",
    "duration": "3:54",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "GracieAbrams",
      "어쿠스틱",
      "감성팝",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "eVli-tstM5E",
    "title": "Sabrina Carpenter - Espresso (Official Music Video)",
    "channelTitle": "Sabrina Carpenter",
    "artist": "Sabrina Carpenter",
    "description": "Sabrina Carpenter - Espresso (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:19)",
    "thumbnailUrl": "https://img.youtube.com/vi/eVli-tstM5E/hqdefault.jpg",
    "duration": "3:19",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "SabrinaCarpenter",
      "Espresso",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "cF1Na4AIecM",
    "title": "Sabrina Carpenter - Please Please Please (Official Video)",
    "channelTitle": "Sabrina Carpenter",
    "artist": "Sabrina Carpenter",
    "description": "Sabrina Carpenter - Please Please Please (Official Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:30)",
    "thumbnailUrl": "https://img.youtube.com/vi/cF1Na4AIecM/hqdefault.jpg",
    "duration": "3:30",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "SabrinaCarpenter",
      "PleasePleasePlease",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "TUVcZfQe-Kw",
    "title": "Dua Lipa - Levitating (Official Music Video)",
    "channelTitle": "Dua Lipa",
    "artist": "Dua Lipa",
    "description": "Dua Lipa - Levitating (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:23)",
    "thumbnailUrl": "https://img.youtube.com/vi/TUVcZfQe-Kw/hqdefault.jpg",
    "duration": "3:23",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "DuaLipa",
      "Levitating",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "2Vv-BfVoq4g",
    "title": "Ed Sheeran - Perfect (Official Music Video)",
    "channelTitle": "Ed Sheeran",
    "artist": "Ed Sheeran",
    "description": "Ed Sheeran - Perfect (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (4:23)",
    "thumbnailUrl": "https://img.youtube.com/vi/2Vv-BfVoq4g/hqdefault.jpg",
    "duration": "4:23",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "EdSheeran",
      "Perfect",
      "어쿠스틱",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "lp-EO5I60KA",
    "title": "Ed Sheeran - Thinking Out Loud (Official Music Video)",
    "channelTitle": "Ed Sheeran",
    "artist": "Ed Sheeran",
    "description": "Ed Sheeran - Thinking Out Loud (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (4:41)",
    "thumbnailUrl": "https://img.youtube.com/vi/lp-EO5I60KA/hqdefault.jpg",
    "duration": "4:41",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "EdSheeran",
      "ThinkingOutLoud",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "Oa_RSwwpPaA",
    "title": "Benson Boone - Beautiful Things (Official Music Video)",
    "channelTitle": "Benson Boone",
    "artist": "Benson Boone",
    "description": "Benson Boone - Beautiful Things (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:00)",
    "thumbnailUrl": "https://img.youtube.com/vi/Oa_RSwwpPaA/hqdefault.jpg",
    "duration": "3:00",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "BensonBoone",
      "BeautifulThings",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "k4V3Mo61fJM",
    "title": "Coldplay - Fix You (Official Video)",
    "channelTitle": "Coldplay",
    "artist": "Coldplay",
    "description": "Coldplay - Fix You (Official Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (4:55)",
    "thumbnailUrl": "https://img.youtube.com/vi/k4V3Mo61fJM/hqdefault.jpg",
    "duration": "4:55",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "Coldplay",
      "FixYou",
      "위로발라드",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "yKNxeF4KMsY",
    "title": "Coldplay - Yellow (Official Video)",
    "channelTitle": "Coldplay",
    "artist": "Coldplay",
    "description": "Coldplay - Yellow (Official Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (4:29)",
    "thumbnailUrl": "https://img.youtube.com/vi/yKNxeF4KMsY/hqdefault.jpg",
    "duration": "4:29",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "Coldplay",
      "Yellow",
      "어쿠스틱",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "RB-RcX5DS5A",
    "title": "Coldplay - The Scientist (Official 4K Video)",
    "channelTitle": "Coldplay",
    "artist": "Coldplay",
    "description": "Coldplay - The Scientist (Official 4K Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (4:26)",
    "thumbnailUrl": "https://img.youtube.com/vi/RB-RcX5DS5A/hqdefault.jpg",
    "duration": "4:26",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "Coldplay",
      "TheScientist",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "5vheNbQlsyU",
    "title": "Lady Gaga - Always Remember Us This Way (From A Star Is Born)",
    "channelTitle": "Lady Gaga",
    "artist": "Lady Gaga",
    "description": "Lady Gaga - Always Remember Us This Way (From A Star Is Born) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:30)",
    "thumbnailUrl": "https://img.youtube.com/vi/5vheNbQlsyU/hqdefault.jpg",
    "duration": "3:30",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "LadyGaga",
      "스타이즈본",
      "피아노발라드",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "pB-5XG-DbAA",
    "title": "Sam Smith - Stay With Me (Official Music Video)",
    "channelTitle": "Sam Smith",
    "artist": "Sam Smith",
    "description": "Sam Smith - Stay With Me (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:00)",
    "thumbnailUrl": "https://img.youtube.com/vi/pB-5XG-DbAA/hqdefault.jpg",
    "duration": "3:00",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "SamSmith",
      "StayWithMe",
      "소울발라드",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "nCkpzqqog4k",
    "title": "Sam Smith - I'm Not The Only One (Official Music Video)",
    "channelTitle": "Sam Smith",
    "artist": "Sam Smith",
    "description": "Sam Smith - I'm Not The Only One (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:59)",
    "thumbnailUrl": "https://img.youtube.com/vi/nCkpzqqog4k/hqdefault.jpg",
    "duration": "3:59",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "SamSmith",
      "ImNotTheOnlyOne",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "zABLecsR5UE",
    "title": "Lewis Capaldi - Someone You Loved (Official Video)",
    "channelTitle": "Lewis Capaldi",
    "artist": "Lewis Capaldi",
    "description": "Lewis Capaldi - Someone You Loved (Official Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:02)",
    "thumbnailUrl": "https://img.youtube.com/vi/zABLecsR5UE/hqdefault.jpg",
    "duration": "3:02",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "LewisCapaldi",
      "SomeoneYouLoved",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "ZmDBbnmKpqQ",
    "title": "Olivia Rodrigo - drivers license (Official Video)",
    "channelTitle": "Olivia Rodrigo",
    "artist": "Olivia Rodrigo",
    "description": "Olivia Rodrigo - drivers license (Official Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (4:07)",
    "thumbnailUrl": "https://img.youtube.com/vi/ZmDBbnmKpqQ/hqdefault.jpg",
    "duration": "4:07",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "OliviaRodrigo",
      "driverslicense",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "cii6ruuycQA",
    "title": "Olivia Rodrigo - deja vu (Official Video)",
    "channelTitle": "Olivia Rodrigo",
    "artist": "Olivia Rodrigo",
    "description": "Olivia Rodrigo - deja vu (Official Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:51)",
    "thumbnailUrl": "https://img.youtube.com/vi/cii6ruuycQA/hqdefault.jpg",
    "duration": "3:51",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "OliviaRodrigo",
      "dejavu",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "CRrf3h9vhp8",
    "title": "Olivia Rodrigo - traitor (Official Video)",
    "channelTitle": "Olivia Rodrigo",
    "artist": "Olivia Rodrigo",
    "description": "Olivia Rodrigo - traitor (Official Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:58)",
    "thumbnailUrl": "https://img.youtube.com/vi/CRrf3h9vhp8/hqdefault.jpg",
    "duration": "3:58",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "OliviaRodrigo",
      "traitor",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "V1Pl8CzNzCw",
    "title": "Billie Eilish, Khalid - lovely",
    "channelTitle": "Billie Eilish & Khalid",
    "artist": "Billie Eilish & Khalid",
    "description": "Billie Eilish, Khalid - lovely • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:20)",
    "thumbnailUrl": "https://img.youtube.com/vi/V1Pl8CzNzCw/hqdefault.jpg",
    "duration": "3:20",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "BillieEilish",
      "Khalid",
      "lovely",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "-tn2S3kJlyU",
    "title": "Billie Eilish - idontwannabeyouanymore (Official Video)",
    "channelTitle": "Billie Eilish",
    "artist": "Billie Eilish",
    "description": "Billie Eilish - idontwannabeyouanymore (Official Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:24)",
    "thumbnailUrl": "https://img.youtube.com/vi/-tn2S3kJlyU/hqdefault.jpg",
    "duration": "3:24",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "BillieEilish",
      "idontwannabeyouanymore",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "b1kbLwvqugk",
    "title": "Taylor Swift - Anti-Hero (Official Music Video)",
    "channelTitle": "Taylor Swift",
    "artist": "Taylor Swift",
    "description": "Taylor Swift - Anti-Hero (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (5:09)",
    "thumbnailUrl": "https://img.youtube.com/vi/b1kbLwvqugk/hqdefault.jpg",
    "duration": "5:09",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "TaylorSwift",
      "AntiHero",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "RsEZmictANA",
    "title": "Taylor Swift - willow (Official Music Video)",
    "channelTitle": "Taylor Swift",
    "artist": "Taylor Swift",
    "description": "Taylor Swift - willow (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (4:13)",
    "thumbnailUrl": "https://img.youtube.com/vi/RsEZmictANA/hqdefault.jpg",
    "duration": "4:13",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "TaylorSwift",
      "willow",
      "포크팝",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "DDWKuo3gXMQ",
    "title": "Adele - When We Were Young (Live at The Church Studios)",
    "channelTitle": "Adele",
    "artist": "Adele",
    "description": "Adele - When We Were Young (Live at The Church Studios) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (5:43)",
    "thumbnailUrl": "https://img.youtube.com/vi/DDWKuo3gXMQ/hqdefault.jpg",
    "duration": "5:43",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "Adele",
      "WhenWeWereYoung",
      "라이브명곡",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "0put0_a--Ng",
    "title": "Adele - Make You Feel My Love (Official Video)",
    "channelTitle": "Adele",
    "artist": "Adele",
    "description": "Adele - Make You Feel My Love (Official Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:32)",
    "thumbnailUrl": "https://img.youtube.com/vi/0put0_a--Ng/hqdefault.jpg",
    "duration": "3:32",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "Adele",
      "MakeYouFeelMyLove",
      "피아노발라드",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "ekzHIouo8Q4",
    "title": "Bruno Mars - When I Was Your Man (Official Music Video)",
    "channelTitle": "Bruno Mars",
    "artist": "Bruno Mars",
    "description": "Bruno Mars - When I Was Your Man (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:55)",
    "thumbnailUrl": "https://img.youtube.com/vi/ekzHIouo8Q4/hqdefault.jpg",
    "duration": "3:55",
    "category": "pop_music",
    "tags": [
      "영어발라드",
      "BrunoMars",
      "WhenIWasYourMan",
      "피아노발라드",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "5GJWxDKyk3A",
    "title": "Billie Eilish - Happier Than Ever",
    "channelTitle": "Billie Eilish",
    "artist": "Billie Eilish",
    "description": "Billie Eilish - Happier Than Ever • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (5:16)",
    "thumbnailUrl": "https://img.youtube.com/vi/5GJWxDKyk3A/hqdefault.jpg",
    "duration": "5:16",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "BY_XwvKogC8",
    "title": "Billie Eilish - CHIHIRO",
    "channelTitle": "Billie Eilish",
    "artist": "Billie Eilish",
    "description": "Billie Eilish - CHIHIRO • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (5:24)",
    "thumbnailUrl": "https://img.youtube.com/vi/BY_XwvKogC8/hqdefault.jpg",
    "duration": "5:24",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "gNi_6U5Pm_o",
    "title": "Olivia Rodrigo - good 4 u",
    "channelTitle": "Olivia Rodrigo",
    "artist": "Olivia Rodrigo",
    "description": "Olivia Rodrigo - good 4 u • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:19)",
    "thumbnailUrl": "https://img.youtube.com/vi/gNi_6U5Pm_o/hqdefault.jpg",
    "duration": "3:19",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "Dj9qJsJTsjQ",
    "title": "Olivia Rodrigo - bad idea right?",
    "channelTitle": "Olivia Rodrigo",
    "artist": "Olivia Rodrigo",
    "description": "Olivia Rodrigo - bad idea right? • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:11)",
    "thumbnailUrl": "https://img.youtube.com/vi/Dj9qJsJTsjQ/hqdefault.jpg",
    "duration": "3:11",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "RlPNh_PBZb4",
    "title": "Olivia Rodrigo - vampire",
    "channelTitle": "Olivia Rodrigo",
    "artist": "Olivia Rodrigo",
    "description": "Olivia Rodrigo - vampire • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (4:05)",
    "thumbnailUrl": "https://img.youtube.com/vi/RlPNh_PBZb4/hqdefault.jpg",
    "duration": "4:05",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "ZsJ-BHohXRI",
    "title": "Olivia Rodrigo - get him back!",
    "channelTitle": "Olivia Rodrigo",
    "artist": "Olivia Rodrigo",
    "description": "Olivia Rodrigo - get him back! • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:30)",
    "thumbnailUrl": "https://img.youtube.com/vi/ZsJ-BHohXRI/hqdefault.jpg",
    "duration": "3:30",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "GlM6lcFbLSg",
    "title": "Olivia Rodrigo - Can't Catch Me Now",
    "channelTitle": "Olivia Rodrigo",
    "artist": "Olivia Rodrigo",
    "description": "Olivia Rodrigo - Can't Catch Me Now • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:37)",
    "thumbnailUrl": "https://img.youtube.com/vi/GlM6lcFbLSg/hqdefault.jpg",
    "duration": "3:37",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "OOgvDiXl6hA",
    "title": "Olivia Rodrigo - All I Want",
    "channelTitle": "Olivia Rodrigo",
    "artist": "Olivia Rodrigo",
    "description": "Olivia Rodrigo - All I Want • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:05)",
    "thumbnailUrl": "https://img.youtube.com/vi/OOgvDiXl6hA/hqdefault.jpg",
    "duration": "3:05",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "7yVpzzqA3q0",
    "title": "Olivia Rodrigo - The Rose Song",
    "channelTitle": "Olivia Rodrigo",
    "artist": "Olivia Rodrigo",
    "description": "Olivia Rodrigo - The Rose Song • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (2:58)",
    "thumbnailUrl": "https://img.youtube.com/vi/7yVpzzqA3q0/hqdefault.jpg",
    "duration": "2:58",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "ebb5AinKxWI",
    "title": "Billie Eilish - copycat",
    "channelTitle": "Billie Eilish",
    "artist": "Billie Eilish",
    "description": "Billie Eilish - copycat • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:18)",
    "thumbnailUrl": "https://img.youtube.com/vi/ebb5AinKxWI/hqdefault.jpg",
    "duration": "3:18",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "G_BhUxx-cwk",
    "title": "Billie Eilish - Male Fantasy",
    "channelTitle": "Billie Eilish",
    "artist": "Billie Eilish",
    "description": "Billie Eilish - Male Fantasy • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:39)",
    "thumbnailUrl": "https://img.youtube.com/vi/G_BhUxx-cwk/hqdefault.jpg",
    "duration": "3:39",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "o0YWOA-kkiU",
    "title": "아이유 - 금요일에 만나요",
    "channelTitle": "아이유",
    "artist": "아이유",
    "description": "아이유 - 금요일에 만나요 • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:50)",
    "thumbnailUrl": "https://img.youtube.com/vi/o0YWOA-kkiU/hqdefault.jpg",
    "duration": "3:50",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "nn1pbxe8bAI",
    "title": "아이유 - 아이와 나의 바다",
    "channelTitle": "아이유",
    "artist": "아이유",
    "description": "아이유 - 아이와 나의 바다 • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (6:44)",
    "thumbnailUrl": "https://img.youtube.com/vi/nn1pbxe8bAI/hqdefault.jpg",
    "duration": "6:44",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "jJKHTJy_eek",
    "title": "태연 - 만약에",
    "channelTitle": "태연",
    "artist": "태연",
    "description": "태연 - 만약에 • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (5:20)",
    "thumbnailUrl": "https://img.youtube.com/vi/jJKHTJy_eek/hqdefault.jpg",
    "duration": "5:20",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "59vVTPAARuM",
    "title": "태연 - 그대라는 시",
    "channelTitle": "태연",
    "artist": "태연",
    "description": "태연 - 그대라는 시 • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:29)",
    "thumbnailUrl": "https://img.youtube.com/vi/59vVTPAARuM/hqdefault.jpg",
    "duration": "3:29",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "zM8txXJSpQs",
    "title": "태연 - 악몽 (Nightmare)",
    "channelTitle": "태연",
    "artist": "태연",
    "description": "태연 - 악몽 (Nightmare) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:02)",
    "thumbnailUrl": "https://img.youtube.com/vi/zM8txXJSpQs/hqdefault.jpg",
    "duration": "3:02",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "YW0doOWokVU",
    "title": "양요섭 - 별",
    "channelTitle": "양요섭",
    "artist": "양요섭",
    "description": "양요섭 - 별 • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (4:06)",
    "thumbnailUrl": "https://img.youtube.com/vi/YW0doOWokVU/hqdefault.jpg",
    "duration": "4:06",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "SxsBRTzfOJw",
    "title": "양요섭 - 위로",
    "channelTitle": "양요섭",
    "artist": "양요섭",
    "description": "양요섭 - 위로 • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (5:00)",
    "thumbnailUrl": "https://img.youtube.com/vi/SxsBRTzfOJw/hqdefault.jpg",
    "duration": "5:00",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "JGwWNGJdvx8",
    "title": "Ed Sheeran - Shape of You",
    "channelTitle": "Ed Sheeran",
    "artist": "Ed Sheeran",
    "description": "Ed Sheeran - Shape of You • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (4:23)",
    "thumbnailUrl": "https://img.youtube.com/vi/JGwWNGJdvx8/hqdefault.jpg",
    "duration": "4:23",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "Ed Sheeran",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "3AtDnEC4zak",
    "title": "Charlie Puth - We Don't Talk Anymore (feat. Selena Gomez)",
    "channelTitle": "Charlie Puth",
    "artist": "Charlie Puth",
    "description": "Charlie Puth - We Don't Talk Anymore (feat. Selena Gomez) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:50)",
    "thumbnailUrl": "https://img.youtube.com/vi/3AtDnEC4zak/hqdefault.jpg",
    "duration": "3:50",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "Charlie Puth",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "lY2yjAdbvdQ",
    "title": "Shawn Mendes - Treat You Better",
    "channelTitle": "Shawn Mendes",
    "artist": "Shawn Mendes",
    "description": "Shawn Mendes - Treat You Better • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (4:16)",
    "thumbnailUrl": "https://img.youtube.com/vi/lY2yjAdbvdQ/hqdefault.jpg",
    "duration": "4:16",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "Shawn Mendes",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "HUHC9tYz8ik",
    "title": "Billie Eilish - bury a friend",
    "channelTitle": "Billie Eilish",
    "artist": "Billie Eilish",
    "description": "Billie Eilish - bury a friend • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:32)",
    "thumbnailUrl": "https://img.youtube.com/vi/HUHC9tYz8ik/hqdefault.jpg",
    "duration": "3:32",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "Billie Eilish",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "gl1aHhXnN1k",
    "title": "Ariana Grande - thank u, next",
    "channelTitle": "Ariana Grande",
    "artist": "Ariana Grande",
    "description": "Ariana Grande - thank u, next • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (5:30)",
    "thumbnailUrl": "https://img.youtube.com/vi/gl1aHhXnN1k/hqdefault.jpg",
    "duration": "5:30",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "Ariana Grande",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "vNoKguSdy4Y",
    "title": "Taylor Swift - I Can Do It With a Broken Heart (Official Lyric Video)",
    "channelTitle": "Taylor Swift",
    "artist": "Taylor Swift",
    "description": "Taylor Swift - I Can Do It With a Broken Heart (Official Lyric Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:38)",
    "thumbnailUrl": "https://img.youtube.com/vi/vNoKguSdy4Y/hqdefault.jpg",
    "duration": "3:38",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "Taylor Swift",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "PMivT7MJ41M",
    "title": "Bruno Mars - That’s What I Like (Official Music Video)",
    "channelTitle": "Bruno Mars",
    "artist": "Bruno Mars",
    "description": "Bruno Mars - That’s What I Like (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:30)",
    "thumbnailUrl": "https://img.youtube.com/vi/PMivT7MJ41M/hqdefault.jpg",
    "duration": "3:30",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "Bruno Mars",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "UqyT8IEBkvY",
    "title": "Bruno Mars - 24K Magic (Official Music Video)",
    "channelTitle": "Bruno Mars",
    "artist": "Bruno Mars",
    "description": "Bruno Mars - 24K Magic (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:46)",
    "thumbnailUrl": "https://img.youtube.com/vi/UqyT8IEBkvY/hqdefault.jpg",
    "duration": "3:46",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "Bruno Mars",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "d2smz_1L2_0",
    "title": "Bruno Mars, Anderson .Paak, Silk Sonic - Leave the Door Open",
    "channelTitle": "Bruno Mars",
    "artist": "Bruno Mars",
    "description": "Bruno Mars, Anderson .Paak, Silk Sonic - Leave the Door Open • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (4:08)",
    "thumbnailUrl": "https://img.youtube.com/vi/d2smz_1L2_0/hqdefault.jpg",
    "duration": "4:08",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "Bruno Mars",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "450p7goxZqg",
    "title": "John Legend - All of Me (Official Video)",
    "channelTitle": "John Legend",
    "artist": "John Legend",
    "description": "John Legend - All of Me (Official Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (5:07)",
    "thumbnailUrl": "https://img.youtube.com/vi/450p7goxZqg/hqdefault.jpg",
    "duration": "5:07",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "John Legend",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "kffacxfA7G4",
    "title": "Justin Bieber - Baby (Official Music Video)",
    "channelTitle": "Justin Bieber",
    "artist": "Justin Bieber",
    "description": "Justin Bieber - Baby (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:44)",
    "thumbnailUrl": "https://img.youtube.com/vi/kffacxfA7G4/hqdefault.jpg",
    "duration": "3:44",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "Justin Bieber",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "tQ0yjYUFKAE",
    "title": "Justin Bieber - Peaches ft. Daniel Caesar, Giveon",
    "channelTitle": "Justin Bieber",
    "artist": "Justin Bieber",
    "description": "Justin Bieber - Peaches ft. Daniel Caesar, Giveon • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:17)",
    "thumbnailUrl": "https://img.youtube.com/vi/tQ0yjYUFKAE/hqdefault.jpg",
    "duration": "3:17",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "Justin Bieber",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "W-TE_Ys4iwM",
    "title": "Maroon 5 - Girls Like You ft. Cardi B (Official Music Video)",
    "channelTitle": "Maroon 5",
    "artist": "Maroon 5",
    "description": "Maroon 5 - Girls Like You ft. Cardi B (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (4:30)",
    "thumbnailUrl": "https://img.youtube.com/vi/W-TE_Ys4iwM/hqdefault.jpg",
    "duration": "4:30",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "Maroon 5",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "a5uQMwRMHcs",
    "title": "Maroon 5 - Maps (Official Music Video)",
    "channelTitle": "Maroon 5",
    "artist": "Maroon 5",
    "description": "Maroon 5 - Maps (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:39)",
    "thumbnailUrl": "https://img.youtube.com/vi/a5uQMwRMHcs/hqdefault.jpg",
    "duration": "3:39",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "Maroon 5",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  },
  {
    "videoId": "wXhTHyIgQ_U",
    "title": "Post Malone - Circles (Official Music Video)",
    "channelTitle": "Post Malone",
    "artist": "Post Malone",
    "description": "Post Malone - Circles (Official Music Video) • 팝송 가사 싱크 쉐도잉 & 영어 딕션 훈련 (3:37)",
    "thumbnailUrl": "https://img.youtube.com/vi/wXhTHyIgQ_U/hqdefault.jpg",
    "duration": "3:37",
    "category": "pop_music",
    "tags": [
      "영어팝송",
      "Post Malone",
      "가사쉐도잉"
    ],
    "source": "curated_pop"
  }
];

/**
 * Load pop music tracks (Verified English and Korean Ballads with CC subtitles)
 */
export function loadPopMusicTracks() {
  const tracks = [];
  const seen = new Set();
  for (const t of DEFAULT_ENGLISH_POP_TRACKS) {
    if (!t.videoId || seen.has(t.videoId) || BAD_VIDEO_IDS.has(t.videoId)) continue;
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
  return tracks;
};

export const DEFAULT_SPANISH_TRACKS = [
  {
    "videoId": "KAcl8ekUz9Y",
    "title": "No parece ansiedad… pero lo es | Kassandra Quezada | TEDxTecdeMty",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (16:35)",
    "thumbnailUrl": "https://img.youtube.com/vi/KAcl8ekUz9Y/hqdefault.jpg",
    "duration": "16:35",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "eGyNufJ8-Cg",
    "title": "El poderío del liderazgo femenino | Patrycia Centeno | TEDxTarragona",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (13:25)",
    "thumbnailUrl": "https://img.youtube.com/vi/eGyNufJ8-Cg/hqdefault.jpg",
    "duration": "13:25",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "vKn_t5wcsn0",
    "title": "Sororidad: ¿Qué podemos lograr las mujeres si trabajamos juntas? | Marlene Molero | TEDxTukuyWomen",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (17:42)",
    "thumbnailUrl": "https://img.youtube.com/vi/vKn_t5wcsn0/hqdefault.jpg",
    "duration": "17:42",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "kuC1HC3HFZA",
    "title": "Liderazgo que inspira. | Marisa Lazo | TEDxUniversidadPanamericanaGuadalajara",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (18:17)",
    "thumbnailUrl": "https://img.youtube.com/vi/kuC1HC3HFZA/hqdefault.jpg",
    "duration": "18:17",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "acY31MrsTJw",
    "title": "EMPODERAMIENTO DE LA  MUJER, MÁS ALLÁ DEL GÉNERO. | Maricela Cervantes | TEDxBarriodelEncino",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (14:18)",
    "thumbnailUrl": "https://img.youtube.com/vi/acY31MrsTJw/hqdefault.jpg",
    "duration": "14:18",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "0IFBpLruSYM",
    "title": "La gorda que ya no quiere adelgazar | Priscila Arias | TEDxTecate Youth",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (17:02)",
    "thumbnailUrl": "https://img.youtube.com/vi/0IFBpLruSYM/hqdefault.jpg",
    "duration": "17:02",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "ECnT4yiCWso",
    "title": "El poder de la palabra  | Rebeca Schürenkämper | TEDxMorelia",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (13:12)",
    "thumbnailUrl": "https://img.youtube.com/vi/ECnT4yiCWso/hqdefault.jpg",
    "duration": "13:12",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "viHMKr5rJ24",
    "title": "Para lograr un amor bonito primero tuve que darme a mí ese amor bonito | Karen Ferrero | TEDxCondesa",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (15:47)",
    "thumbnailUrl": "https://img.youtube.com/vi/viHMKr5rJ24/hqdefault.jpg",
    "duration": "15:47",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "SXF-gtNsg6I",
    "title": "La mujer rural: fuente de inspiración de la agroecología | Natalia Escobar | TEDxUCundinamarca",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (17:36)",
    "thumbnailUrl": "https://img.youtube.com/vi/SXF-gtNsg6I/hqdefault.jpg",
    "duration": "17:36",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "uhZzB5hid6M",
    "title": "Cambia tu mente, cambia tu vida | Margarita Pasos | TEDxManagua",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (20:44)",
    "thumbnailUrl": "https://img.youtube.com/vi/uhZzB5hid6M/hqdefault.jpg",
    "duration": "20:44",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "QBMNtJx3NmE",
    "title": "¿Cómo usar las habilidades femeninas en los negocios? | María Carolina Rondón | TEDxAltamiraWomen",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (6:57)",
    "thumbnailUrl": "https://img.youtube.com/vi/QBMNtJx3NmE/hqdefault.jpg",
    "duration": "6:57",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "LZhXeDbyvMo",
    "title": "¿Cómo tener juntas efectivas? | Elvira Toba | TEDxCalzadaDeLosHéroes",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (19:18)",
    "thumbnailUrl": "https://img.youtube.com/vi/LZhXeDbyvMo/hqdefault.jpg",
    "duration": "19:18",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "7foLnilB7Lw",
    "title": "El poder de conocer tu propria identidad | Maysun Abu-Khdeir | TEDxZaragoza",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (17:58)",
    "thumbnailUrl": "https://img.youtube.com/vi/7foLnilB7Lw/hqdefault.jpg",
    "duration": "17:58",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "qbrNNudXCCw",
    "title": "Resiliencia, Poder y Liderazgo | Adriana Torres | TEDxComodoroRivadavia",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (20:02)",
    "thumbnailUrl": "https://img.youtube.com/vi/qbrNNudXCCw/hqdefault.jpg",
    "duration": "20:02",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "zleOf9qSSEY",
    "title": "Solo es amor si... | Ro García Platas | TEDxCondesa",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (17:55)",
    "thumbnailUrl": "https://img.youtube.com/vi/zleOf9qSSEY/hqdefault.jpg",
    "duration": "17:55",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "JzvtGcrnBi4",
    "title": "Tu autenticidad te puede llevar a ser tu mejor versión | Paula Folch | TEDxIgualada",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (18:21)",
    "thumbnailUrl": "https://img.youtube.com/vi/JzvtGcrnBi4/hqdefault.jpg",
    "duration": "18:21",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "Ff-R-IH80OQ",
    "title": "El poder de lo femenino | Mercè Brey | TEDxEixample",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (11:52)",
    "thumbnailUrl": "https://img.youtube.com/vi/Ff-R-IH80OQ/hqdefault.jpg",
    "duration": "11:52",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "5xsEMzui9c4",
    "title": "Kaizen: más allá de lo empresarial | Roxana Aveiga | TEDxGamboa",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (8:46)",
    "thumbnailUrl": "https://img.youtube.com/vi/5xsEMzui9c4/hqdefault.jpg",
    "duration": "8:46",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "tb0YspHHpAM",
    "title": "Cómo ser líder y femenina .. y  no  morir en el intento…Se puede!!! | Soledad Ovando | TEDxUAIWomen",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (16:59)",
    "thumbnailUrl": "https://img.youtube.com/vi/tb0YspHHpAM/hqdefault.jpg",
    "duration": "16:59",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "zt3uvhim96Q",
    "title": "Desbloquea la vida de tus sueños | Stephanie Rodriguez | TEDxTecdeMty",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (18:35)",
    "thumbnailUrl": "https://img.youtube.com/vi/zt3uvhim96Q/hqdefault.jpg",
    "duration": "18:35",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "OE8ehj_h2qA",
    "title": "Ser mujer en la universidad: Una carrera de supervivencia | Ljubica Fuentes | TEDxLaFloresta",
    "channelTitle": "TEDx Talks",
    "description": "TEDx Talks • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (15:36)",
    "thumbnailUrl": "https://img.youtube.com/vi/OE8ehj_h2qA/hqdefault.jpg",
    "duration": "15:36",
    "language": "es",
    "category": "ted_speech",
    "tags": [
      "스페인어",
      "TEDx",
      "여성리더십",
      "명품스피치",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "DUyQqjnsWoI",
    "title": "Aitana - Vas A Quedarte (Letra)",
    "channelTitle": "Marinosaurio",
    "description": "Marinosaurio • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (3:46)",
    "thumbnailUrl": "https://img.youtube.com/vi/DUyQqjnsWoI/hqdefault.jpg",
    "duration": "3:46",
    "language": "es",
    "category": "pop_music",
    "tags": [
      "스페인어",
      "감성발라드",
      "스페인노래",
      "가사쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "yxGhRK2Hth4",
    "title": "Aitana - CUANDO HABLES CON ÉL (Video Oficial)",
    "channelTitle": "Aitana",
    "description": "Aitana • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (3:24)",
    "thumbnailUrl": "https://img.youtube.com/vi/yxGhRK2Hth4/hqdefault.jpg",
    "duration": "3:24",
    "language": "es",
    "category": "pop_music",
    "tags": [
      "스페인어",
      "감성발라드",
      "스페인노래",
      "가사쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "SXEucvJoArk",
    "title": "Aitana - CUANDO HABLES CON ÉL (Letra)",
    "channelTitle": "jostland.",
    "description": "jostland. • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (3:04)",
    "thumbnailUrl": "https://img.youtube.com/vi/SXEucvJoArk/hqdefault.jpg",
    "duration": "3:04",
    "language": "es",
    "category": "pop_music",
    "tags": [
      "스페인어",
      "감성발라드",
      "스페인노래",
      "가사쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "7csX6CfgMoo",
    "title": "Aitana - 6 DE FEBRERO (Video Oficial)",
    "channelTitle": "Aitana",
    "description": "Aitana • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (3:11)",
    "thumbnailUrl": "https://img.youtube.com/vi/7csX6CfgMoo/hqdefault.jpg",
    "duration": "3:11",
    "language": "es",
    "category": "pop_music",
    "tags": [
      "스페인어",
      "감성발라드",
      "스페인노래",
      "가사쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "0yiHp6KW4oE",
    "title": "Por Qué Me Fui A Enamorar de Ti (En Vivo, Desde El Lunario del Auditorio Nacional)",
    "channelTitle": "Mon Laferte",
    "description": "Mon Laferte • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (4:41)",
    "thumbnailUrl": "https://img.youtube.com/vi/0yiHp6KW4oE/hqdefault.jpg",
    "duration": "4:41",
    "language": "es",
    "category": "pop_music",
    "tags": [
      "스페인어",
      "감성발라드",
      "스페인노래",
      "가사쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "fRJ3kh9cnQo",
    "title": "Mon Laferte - Antes De Ti",
    "channelTitle": "Mon Laferte",
    "description": "Mon Laferte • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (4:03)",
    "thumbnailUrl": "https://img.youtube.com/vi/fRJ3kh9cnQo/hqdefault.jpg",
    "duration": "4:03",
    "language": "es",
    "category": "pop_music",
    "tags": [
      "스페인어",
      "감성발라드",
      "스페인노래",
      "가사쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "13m9v78uNJk",
    "title": "Mon Laferte - Mi Buen Amor ft. Enrique Bunbury",
    "channelTitle": "Mon Laferte",
    "description": "Mon Laferte • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (3:50)",
    "thumbnailUrl": "https://img.youtube.com/vi/13m9v78uNJk/hqdefault.jpg",
    "duration": "3:50",
    "language": "es",
    "category": "pop_music",
    "tags": [
      "스페인어",
      "감성발라드",
      "스페인노래",
      "가사쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "PQlG1gznMBE",
    "title": "Mon Laferte - Amor Completo",
    "channelTitle": "Mon Laferte",
    "description": "Mon Laferte • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (4:09)",
    "thumbnailUrl": "https://img.youtube.com/vi/PQlG1gznMBE/hqdefault.jpg",
    "duration": "4:09",
    "language": "es",
    "category": "pop_music",
    "tags": [
      "스페인어",
      "감성발라드",
      "스페인노래",
      "가사쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "viELAGDXqH0",
    "title": "Mon Laferte - Invéntame",
    "channelTitle": "TodosSomosMASVEVO",
    "description": "TodosSomosMASVEVO • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (3:37)",
    "thumbnailUrl": "https://img.youtube.com/vi/viELAGDXqH0/hqdefault.jpg",
    "duration": "3:37",
    "language": "es",
    "category": "pop_music",
    "tags": [
      "스페인어",
      "감성발라드",
      "스페인노래",
      "가사쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "l_ZyDlTfndE",
    "title": "Mon Laferte - Amárrame ft. Juanes",
    "channelTitle": "Mon Laferte",
    "description": "Mon Laferte • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (3:26)",
    "thumbnailUrl": "https://img.youtube.com/vi/l_ZyDlTfndE/hqdefault.jpg",
    "duration": "3:26",
    "language": "es",
    "category": "pop_music",
    "tags": [
      "스페인어",
      "감성발라드",
      "스페인노래",
      "가사쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "BJpCypyvYtc",
    "title": "Shakira - Última (Official Video)",
    "channelTitle": "Shakira",
    "description": "Shakira • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (3:00)",
    "thumbnailUrl": "https://img.youtube.com/vi/BJpCypyvYtc/hqdefault.jpg",
    "duration": "3:00",
    "language": "es",
    "category": "pop_music",
    "tags": [
      "스페인어",
      "감성발라드",
      "스페인노래",
      "가사쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "d6BvXSPScI4",
    "title": "Shakira — Inevitable [Letra]",
    "channelTitle": "armxndo",
    "description": "armxndo • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (3:44)",
    "thumbnailUrl": "https://img.youtube.com/vi/d6BvXSPScI4/hqdefault.jpg",
    "duration": "3:44",
    "language": "es",
    "category": "pop_music",
    "tags": [
      "스페인어",
      "감성발라드",
      "스페인노래",
      "가사쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "ZuupMrAhGXw",
    "title": "Mi Verdad - Maná a dueto con Shakira (Video Oficial)",
    "channelTitle": "OficialMana",
    "description": "OficialMana • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (4:34)",
    "thumbnailUrl": "https://img.youtube.com/vi/ZuupMrAhGXw/hqdefault.jpg",
    "duration": "4:34",
    "language": "es",
    "category": "pop_music",
    "tags": [
      "스페인어",
      "감성발라드",
      "스페인노래",
      "가사쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "UjX10jO-p3c",
    "title": "Shakira - Nada (Official Video)",
    "channelTitle": "Shakira",
    "description": "Shakira • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (3:12)",
    "thumbnailUrl": "https://img.youtube.com/vi/UjX10jO-p3c/hqdefault.jpg",
    "duration": "3:12",
    "language": "es",
    "category": "pop_music",
    "tags": [
      "스페인어",
      "감성발라드",
      "스페인노래",
      "가사쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "2LrRw6AZEts",
    "title": "ROSALÍA, Carminho - Memória (Official Lyric Video)",
    "channelTitle": "ROSALÍA",
    "description": "ROSALÍA • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (3:56)",
    "thumbnailUrl": "https://img.youtube.com/vi/2LrRw6AZEts/hqdefault.jpg",
    "duration": "3:56",
    "language": "es",
    "category": "essay_deep",
    "tags": [
      "스페인어",
      "인생에세이",
      "마인드셋",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "cQib_iUmR6c",
    "title": "ROSALIA (AI) - SOLAMENTE TÚ",
    "channelTitle": "Voces AI",
    "description": "Voces AI • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (4:03)",
    "thumbnailUrl": "https://img.youtube.com/vi/cQib_iUmR6c/hqdefault.jpg",
    "duration": "4:03",
    "language": "es",
    "category": "pop_music",
    "tags": [
      "스페인어",
      "감성발라드",
      "스페인노래",
      "가사쉐도잉"
    ],
    "source": "curated_spanish"
  },
  {
    "videoId": "-YyeLtTIPSI",
    "title": "Rosalía - Si tú supieras compañero + Catalina (en directo en la Cadena SER) | La Ventana",
    "channelTitle": "La Ventana",
    "description": "La Ventana • 또렷한 카스티야 & 중남미 표준 스페인어 명품 쉐도잉 (6:30)",
    "thumbnailUrl": "https://img.youtube.com/vi/-YyeLtTIPSI/hqdefault.jpg",
    "duration": "6:30",
    "language": "es",
    "category": "essay_deep",
    "tags": [
      "스페인어",
      "인생에세이",
      "마인드셋",
      "쉐도잉"
    ],
    "source": "curated_spanish"
  }
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
    ...DEFAULT_ENGLISH_CURATED_TRACKS.map(t => ({
      id: `en_cur_${t.videoId}`,
      videoId: t.videoId,
      title: t.title,
      channelTitle: t.channelTitle,
      description: t.description,
      thumbnailUrl: t.thumbnailUrl,
      url: `https://www.youtube.com/watch?v=${t.videoId}`,
      duration: t.duration,
      language: 'en',
      category: t.category || 'ted_speech',
      tags: t.tags,
      source: 'curated_english',
      bookmarked: false,
      addedAt: Date.now() - 500,
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
      if (!existingVideoIds.has(popTrack.videoId) && parseDurationInSeconds(popTrack.duration) >= 120 && !BAD_VIDEO_IDS.has(popTrack.videoId)) {
        popTrack.language = 'en';
        store.items.push(popTrack);
        existingVideoIds.add(popTrack.videoId);
        modified = true;
      }
    }
  }

  if (multiTracks.length > 0) {
    for (const track of multiTracks) {
      if (!existingVideoIds.has(track.videoId) && parseDurationInSeconds(track.duration) >= 300 && !BAD_VIDEO_IDS.has(track.videoId)) {
        store.items.push(track);
        existingVideoIds.add(track.videoId);
        modified = true;
      }
    }
  }

  // Strictly filter out any bad IDs (no subtitles), blacklisted items, or shorts
  const beforeFilterLen = store.items.length;
  store.items = store.items.filter(item => {
    if (BAD_VIDEO_IDS.has(item.videoId)) return false;
    if (isBlacklisted(item.title, item.description, item.channelTitle, item.videoId)) return false;
    const s = parseDurationInSeconds(item.duration);
    if (item.category === 'pop_music' || item.source === 'curated_pop' || item.source === 'ytmusic_pop') {
      return s >= 120;
    }
    return s >= 300;
  });
  if (store.items.length !== beforeFilterLen) {
    modified = true;
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
  // Normalize language for all items and filter out shorts (노래는 2분+, 일반 영상은 5분+)
  let list = (store.items || []).filter(item => {
    const secs = parseDurationInSeconds(item.duration);
    if (item.category === 'pop_music' || item.source === 'curated_pop' || item.source === 'ytmusic_pop') {
      return secs >= 120;
    }
    return secs >= 300;
  });
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
    if (category === 'travel_nature') {
      list = list.filter(item => item.category === 'travel_nature' || item.tags?.includes('자연여행') || item.tags?.includes('대자연') || item.tags?.includes('솔로트래블'));
    } else if (category === 'sleep_life') {
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
