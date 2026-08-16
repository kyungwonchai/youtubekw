import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const YOUTUBE_FILE = '/home/kw/.kwsoft-youtube-links.json';

/**
 * 7 Dedicated High-Quality Curation Channels (15+ Min, Trash-Filtered, Shadowing & Listening Optimized)
 */
export const CURATION_CHANNELS = [
  {
    id: 'opic_al',
    label: '🎯 오픽 1급 (AL 취득 목표)',
    shortLabel: '오픽 AL',
    target: '오픽 AL 취득 목표 (오픽노잼 전략, 롤플레이, 돌발질문, 만능패턴, 원어민 스피킹)',
    icon: '🎯',
    desc: 'OPIc 1급(AL) 달성을 위한 오픽노잼 핵심 전략, 롤플레이/돌발 대처, 고득점 필러 및 만능 답변 패턴, 15분+ 원어민 쉐도잉 영상',
    queries: [
      '오픽 AL 노하우',
      '오픽 1급 AL 꿀팁',
      '오픽노잼 AL',
      '오픽 AL 롤플레이 만능 패턴',
      '오픽 돌발질문 AL 답변 전략',
      'opic al speaking test sample answer english',
      'opic 1급 al 스크립트 모의고사',
      '오픽 AL 실제 시험 영상',
    ],
    category: 'opic_al',
    defaultTags: ['오픽1급', '오픽AL', 'OPIc', '오픽노잼', '롤플레이', '돌발질문', '만능패턴', '쉐도잉'],
    weight: 1.0,
  },
  {
    id: '20s_book',
    label: '📚 20~30대 여성 북리뷰 (메인 80%)',
    shortLabel: '20-30대 북리뷰 (80%)',
    target: '20~30대 영어 구사 여성 북튜버',
    icon: '📚',
    desc: '20~30대 원어민 여성 크리에이터의 도서 추천, 북리뷰, 독서 수다 (최근 24시간 이내 최신 영상)',
    queries: [
      'pretty female booktube reading vlog english long',
      'woman booktuber book review chat vlog english 2026',
      'girl booktube recommendations female english long',
      'female booktuber reading wrap up sit down talk english',
      'female reading vlog favorite books discussion english',
    ],
    category: 'vlog_20s',
    defaultTags: ['북리뷰', '영어도서', '쉐도잉'],
    weight: 0.8,
  },
  {
    id: '20s_vlog',
    label: '🌸 라이프 & 수다 (서브 20%)',
    shortLabel: '라이프 & 수다',
    target: '원어민 크리에이터 브이로그',
    icon: '🌸',
    desc: '원어민 유튜버의 라이프스타일, 대화형 수다 브이로그',
    queries: [
      'pretty girl talkative vlog english chat 20 min',
      'woman day in my life female speaking english vlog',
      'aesthetic girl english chat vlog storytime long',
      'female sit down chat vlog speaking english 2026',
    ],
    category: 'vlog_20s',
    defaultTags: ['브이로그', '영어수다', '쉐도잉'],
    weight: 0.2,
  },
  {
    id: '30s_career',
    label: '💼 30대 커리어·생산성',
    shortLabel: '30대 커리어',
    icon: '💼',
    target: '30대 커리어·자기계발 여성',
    icon: '💼',
    desc: '30대 원어민 여성의 커리어, 생산성 루틴, 서평 (또렷하고 깔끔한 발음)',
    queries: [
      '30s female career productivity book review english vlog',
      '30s female work routine book recommendations english',
    ],
    category: 'vlog_20s',
    defaultTags: ['30대여성', '커리어', '클리어발음'],
    weight: 0.2,
  },
  {
    id: '40s_insight',
    label: '🌿 40대 인사이트·라이프',
    shortLabel: '40대 인사이트',
    target: '40대 인사이트 여성',
    icon: '🌿',
    desc: '40대 여성의 삶의 통찰, 독서, 웰니스 이야기',
    queries: [
      '40s female reading vlog book discussion english',
    ],
    category: 'vlog_20s',
    defaultTags: ['40대여성', '인사이트'],
    weight: 0.2,
  },
  {
    id: 'ai_lecture',
    label: '🤖 AI·IT 개발 강좌',
    shortLabel: 'AI·IT 트렌드',
    target: '여성 AI 엔지니어',
    icon: '🤖',
    desc: '생성형 AI, 개발 트렌드 해설',
    queries: [
      'female ai engineer tech vlog software english',
    ],
    category: 'ai_lecture',
    defaultTags: ['AI강좌', '테크영어'],
    weight: 0.2,
  },
  {
    id: 'architect_cs',
    label: '🏛️ SW 아키텍처·설계',
    shortLabel: 'SW 아키텍처',
    target: '여성 소프트웨어 아키텍트',
    icon: '🏛️',
    desc: '소프트웨어 아키텍처, 시스템 디자인 강의',
    queries: [
      'female software engineer system design architecture english',
    ],
    category: 'architect_cs',
    defaultTags: ['SW아키텍처', '테크강의'],
    weight: 0.2,
  },
  {
    id: 'philosophy',
    label: '🧠 철학 (심리·교육학)',
    shortLabel: '철학',
    target: '20~40대 원어민 여성 크리에이터의 철학, 심리학, 교육학 명확한 해설 및 수다',
    icon: '🧠',
    desc: '철학, 심리학, 교육학 20~40대 원어민 여성 스피킹 큐레이션',
    queries: [
      'female philosophy essay book review discussion english',
      'woman psychology explanation book discussion english',
      'female education psychology talk essay english',
      'woman philosopher psychology book recommendations talk',
      'female philosophy podcast essay discussion english',
    ],
    category: 'philosophy',
    defaultTags: ['철학', '심리학', '교육학', '여성스피커'],
    weight: 1.0,
  },
  {
    id: '20s_shadowing',
    label: '🗣️ 30대 이하 완벽한 쉐도잉 (모든 장르)',
    shortLabel: '완벽한 쉐도잉',
    target: '30대 이하 원어민 여성 크리에이터의 아나운서급 명확한 발음 (오픽 AL / 아이엘츠 9 등급 수준)',
    icon: '🗣️',
    desc: '다양한 장르(라이프스타일, 인터뷰, 토크 등)에서 완벽한 발음과 속도로 말하는 20~30대 여성 유튜버 쉐도잉 최적화 영상',
    queries: [
      'young female english speaker clear pronunciation interview talk show vlog',
      '20s female fluent english native speaker lifestyle talk fast speech',
      'young woman clear speaking english native pronunciation vlog',
      'female native english speaker clear articulation fast talk vlog',
      'young female english advanced speaking clear voice lifestyle',
    ],
    category: 'vlog_20s',
    defaultTags: ['완벽한쉐도잉', '오픽AL', '아나운서급발음', '30대이하', '다양한장르'],
    weight: 1.0,
  },
  {
    id: '20s_algorithm',
    label: '💻 30대 이하 알고리즘·데이터 (완벽 쉐도잉)',
    shortLabel: '알고리즘',
    target: '30대 이하 백인 여성 크리에이터의 아나운서급 영어 (알고리즘/데이터사이언스 강의)',
    icon: '💻',
    desc: '컴퓨터 알고리즘, 데이터 사이언스 등을 설명하는 20~30대 유러피안/미국 여성 유튜버의 명확한 영어 강의',
    queries: [
      'young white female software engineer data science algorithm english tutorial',
      '20s blonde female computer science algorithm explanation english vlog',
      'young white woman data science lecture coding interview english',
    ],
    category: 'ai_lecture',
    defaultTags: ['알고리즘', '데이터사이언스', '테크강의', '완벽한쉐도잉'],
    weight: 1.0,
  },
  {
    id: 'track_fancam',
    label: '🏃‍♀️ 육상 직캠 (K-Track & Field Fancam)',
    shortLabel: '육상 직캠',
    target: '국내외 육상 선수 직캠, 100m, 400m 릴레이, 허들, 멀리뛰기 고화질 직캠',
    icon: '🏃‍♀️',
    desc: '국내외 육상 대회 선수 직캠, 4K/60fps 고화질 트랙 & 필드 경기 직캠 모음',
    queries: [
      '육상 직캠 4k',
      '여자 육상 직캠',
      '육상 선수 직캠',
      'track and field fancam 4k',
      '육상 대회 직캠 60fps',
      '여자 허들 직캠',
      '여성 육상 경기 직캠',
    ],
    category: 'track_fancam',
    defaultTags: ['육상직캠', '직캠', '트랙앤필드', '4K직캠', '스포츠'],
    weight: 1.0,
  },
];

/**
 * Strict Blacklist (Trash & Male filter: strictly ban male creators, male names, house cleaning, dishwashing, chores, silent videos, tech/code videos)
 */
const MALE_KEYWORDS = [
  // 남성 지칭 및 명사
  '남자', '남성', 'man', 'men', 'male', 'guy', 'guys', 'husband', 'boyfriend', 'boy', 'boys', 'bro', 'bros',
  'father', 'dad', 'brother', 'son', 'gentleman', 'gentlemen', 'he', 'his', 'him', 'mr.', 'mr ', 'sir', 'himself', 'his',

  // BTS 멤버 및 남성 아티스트/셀럽
  'rm', 'namjoon', 'bts', 'jungkook', 'jimin', 'v', 'taehyung', 'suga', 'yoongi', 'jin', 'j-hope', 'hoseok',

  // 흔한 남성 이름 (북튜브/유튜브 채널 및 크리에이터)
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
  'theodore', 'wyatt', 'jayden', 'matteo', 'julian', 'leo', 'ezra', 'harrison', 'merlin', 'pewds',
  'pewdiepie', 'clint', 'steve', 'mike', 'dave', 'tom', 'chris', 'dan', 'matt', 'alex', 'sam', 'ian', 'gubeli', 'jay', 'shetty', 'mcevoy', 'ali', 'abdaal', 'charles', 'edwards',
];

const TRASH_KEYWORDS = [
  ...MALE_KEYWORDS,

  // 청소 / 설거지 / 집안일 관련 키워드
  '집청소', '청소업체', '쓰레기집', '특수청소', '청소', '극혐', 'hoarder', 'cleaning extreme',
  'dirty room', 'cleaning dirty', 'cleaning motivation', 'deep clean dirty', 'filthy',
  '설거지', '설겆이', 'dishwashing', 'dishes', 'wash dishes', 'housework', 'chores', 'room tour clean',
  'tidy up', 'organization', 'declutter', 'house cleaning', 'cleaning routine', 'clean with me',
  'speed clean', 'clean my room', 'kitchen clean', 'bathroom clean', 'laundry', '빨래',

  // AI 보이스 / 가상 캐릭터 / 애니메이션 / VTuber 금지
  'ai voice', 'ai generated', 'ai avatar', 'virtual', 'vtuber', 'animation', 'anime', 'cartoon', 'synth', 'text to speech', 'tts', 'bot',
  'manga', 'manhwa', 'comic', 'webtoon', 'faceless', 'no face',

  // 흑인 쉐도잉에서 배제 (사용자 요청)
  'black', 'african', 'african american', 'blm', 'ebony', 'dark skin', 'melanin', 'black woman', 'black girl',
  'speak english with tiffani', 'tiffani',

  // 중국어 및 중화권 크리에이터 배제 (영어 중심)
  'chinese', 'mandarin', 'taiwanese', 'china', 'taiwan', 'hong kong',
  '中文', '汉语', '普通话', '台灣', '中国', '香港', '중국어', '대만',

  // 조용한 영상 / 대화 없음 / 무음
  '요가', 'yoga', 'pilates', '필라테스', 'stretching', '스트레칭', 'workout', 'exercise', 'fitness routine', 'home workout',
  '50s', '60s', 'middle aged', 'mom', 'mother', '아줌마', '중년',
  'mukbang', '먹방', 'asmr no talking', 'no talking', 'silent vlog', 'silent reading', 'study with me', 'no voice',
  'shorts', '#shorts', 'clickbait', 'nsfw', '18+', 'gossip', 'drama', 'exposed',
  'crime scene', 'infestation', 'cockroach', 'maggot', 'bugs', 'brawl', 'fight',
];

/**
 * Check if video title, channel title, or description contains trash/male/banned keywords
 */
export function isTrashContent(title = '', desc = '', channelTitle = '', allowEducational = false, isSports = false) {
  const text = `${title} ${desc} ${channelTitle}`.toLowerCase();
  const cTitle = (channelTitle || '').toLowerCase();
  
  if (!allowEducational && !isSports) {
    // 1. Direct substring check on channelTitle for male names/words
    for (const kw of MALE_KEYWORDS) {
      const lowerKw = kw.trim().toLowerCase();
      if (!lowerKw) continue;
      if (cTitle.includes(lowerKw)) return true;
    }

    // 2. Check channel title, video title, description against MALE_KEYWORDS with regex word boundaries
    for (const kw of MALE_KEYWORDS) {
      const lowerKw = kw.trim().toLowerCase();
      if (!lowerKw) continue;
      const escaped = lowerKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
      if (regex.test(text)) return true;
    }
  }

  // 2. Trash keyword check across all metadata
  for (const kw of TRASH_KEYWORDS) {
    const lowerKw = kw.trim().toLowerCase();
    if (!lowerKw) continue;
    if ((allowEducational || isSports) && MALE_KEYWORDS.includes(lowerKw)) continue;
    if (isSports && (kw === 'workout' || kw === 'exercise' || kw === 'fitness routine' || kw === 'stretching')) continue;
    if (/^[a-z0-9. ]+$/.test(lowerKw) && lowerKw.length <= 15) {
      const escaped = lowerKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
      if (regex.test(text)) return true;
    } else {
      if (text.includes(lowerKw)) return true;
    }
  }

  // 3. Regex check for Chinese characters (CJK Unified Ideographs) to strictly block Chinese/Japanese content
  if (/[\u4e00-\u9fa5]/.test(text)) {
    return true;
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
 * Check if duration meets 5+ minutes criteria (>= 300 seconds)
 */
export function isAtLeast5Min(durationStr) {
  if (!durationStr) return true; // If YouTube metadata doesn't include duration text, rely on search query filter
  const secs = parseDurationInSeconds(durationStr);
  return secs >= 300; // 5 minutes
}

/**
 * Seed data with initial high quality examples
 */
const DEFAULT_STORE = {
  lastCuratedAt: Date.now(),
  lastQuery: '7대 프리미엄 채널 (20대/30대/40대/AI/아키텍처/로봇/여행스포츠 15분+ 쉐도잉)',
  items: [
    {
      id: 'yt_seed_arch_1',
      videoId: 'UzLMhqg3_bE',
      title: 'How I Design Scalable Microservices Architecture (Real-World System Design Explained)',
      url: 'https://www.youtube.com/watch?v=UzLMhqg3_bE',
      channelTitle: 'Tech Lead Grace',
      duration: '26:40',
      description: 'Step-by-step walkthrough of software architecture, domain-driven design, and API gateway patterns. Clear English explanation.',
      thumbnailUrl: 'https://img.youtube.com/vi/UzLMhqg3_bE/hqdefault.jpg',
      publishedAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
      category: 'architect_cs',
      channelPresetId: 'architect_cs',
      tags: ['아키텍처', '시스템설계', '15분+', '테크영어', '클리어발음'],
      bookmarked: true,
      bookmarkedAt: Date.now() - 3600 * 1000,
      watched: false,
      rating: 5,
      memo: '마이크로서비스 도메인 분리 설명 아주 깔끔함. 쉐도잉 연습 추천.',
      source: 'ai_curated',
      addedAt: Date.now() - 3600 * 1000,
      updatedAt: Date.now(),
    },
    {
      id: 'yt_seed_20s_1',
      videoId: 'e9awftT53Ms',
      title: 'I Read 11 Books in One Week... Honest Thoughts & Book Review Vlog',
      url: 'https://www.youtube.com/watch?v=e9awftT53Ms',
      channelTitle: 'BookswithEmilyFox',
      duration: '22:15',
      description: 'Conversational 20s reading vlog, thoughtful book recommendations, and everyday routine.',
      thumbnailUrl: 'https://img.youtube.com/vi/e9awftT53Ms/hqdefault.jpg',
      publishedAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
      category: 'vlog_20s',
      channelPresetId: '20s_vlog',
      tags: ['20대', '순수일상', '북리뷰', '15분+', '쉐도잉최적'],
      bookmarked: true,
      bookmarkedAt: Date.now() - 3600 * 1000,
      watched: false,
      rating: 5,
      memo: '발음이 매우 또렷하고 일상 표현이 풍부하여 리스닝 연습에 매우 좋음.',
      source: 'ai_curated',
      addedAt: Date.now() - 3600 * 1000,
      updatedAt: Date.now(),
    },
  ],
};

/**
 * Load YouTube links data from local JSON database
 */
export function loadYouTubeData() {
  if (!existsSync(YOUTUBE_FILE)) {
    saveYouTubeData(DEFAULT_STORE);
    return DEFAULT_STORE;
  }
  try {
    const raw = readFileSync(YOUTUBE_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items)) {
      return DEFAULT_STORE;
    }
    return data;
  } catch (e) {
    console.error('[YouTube Control] Error reading youtube links file:', e.message);
    return DEFAULT_STORE;
  }
}

/**
 * Save YouTube links data to local JSON database
 */
export function saveYouTubeData(data) {
  try {
    writeFileSync(YOUTUBE_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[YouTube Control] Error writing youtube links file:', e.message);
    return false;
  }
}

/**
 * Extract 11-char YouTube Video ID from various URL formats
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  const str = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  
  const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

/**
 * Get YouTube links with filter, category, and search support
 */
export function getYouTubeLinks({ filter = 'all', category = 'all', channelPreset = 'all', search = '' } = {}) {
  const store = loadYouTubeData();
  let list = store.items || [];

  // Filter by bookmark status
  if (filter === 'bookmarked') {
    list = list.filter(item => item.bookmarked);
  } else if (filter === 'unbookmarked') {
    list = list.filter(item => !item.bookmarked);
  }

  // Filter by category or channel preset
  if (category && category !== 'all') {
    list = list.filter(item => item.category === category || item.channelPresetId === category);
  }
  if (channelPreset && channelPreset !== 'all') {
    list = list.filter(item => item.channelPresetId === channelPreset || item.category === channelPreset);
  }

  // Search filter
  if (search && search.trim()) {
    const q = search.toLowerCase().trim();
    list = list.filter(item => {
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchChannel = item.channelTitle?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchMemo = item.memo?.toLowerCase().includes(q);
      const matchTags = Array.isArray(item.tags) && item.tags.some(t => t.toLowerCase().includes(q));
      return matchTitle || matchChannel || matchDesc || matchMemo || matchTags;
    });
  }

  // Sort: Bookmarked first, then newer addedAt
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
  };
}

/**
 * Add a new YouTube link manually
 */
export function addYouTubeLink({
  url,
  title,
  channelTitle = '',
  description = '',
  category = 'vlog_20s',
  channelPresetId = '',
  tags = [],
  bookmarked = false,
  memo = '',
}) {
  if (!url || !url.trim()) throw new Error('YouTube URL은 필수입니다.');

  const videoId = extractYouTubeId(url);
  const canonicalUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url.trim();
  const thumbnailUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&auto=format&fit=crop&q=60';

  const store = loadYouTubeData();

  const existing = store.items.find(i => (videoId && i.videoId === videoId) || i.url === canonicalUrl);
  if (existing) {
    if (bookmarked && !existing.bookmarked) {
      existing.bookmarked = true;
      existing.bookmarkedAt = Date.now();
      saveYouTubeData(store);
    }
    return existing;
  }

  const now = Date.now();
  const parsedTags = Array.isArray(tags)
    ? tags
    : typeof tags === 'string'
      ? tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

  const newItem = {
    id: 'yt_' + now + '_' + Math.random().toString(36).slice(2, 7),
    videoId: videoId || undefined,
    title: title?.trim() || (videoId ? `YouTube Video (${videoId})` : '새 유튜브 영상'),
    url: canonicalUrl,
    channelTitle: channelTitle?.trim() || 'Custom Channel',
    description: description?.trim() || '',
    thumbnailUrl,
    publishedAt: new Date().toISOString(),
    duration: '15:00+',
    category,
    channelPresetId: channelPresetId || category,
    tags: parsedTags.length > 0 ? parsedTags : ['수동등록', '15분+'],
    bookmarked: Boolean(bookmarked),
    bookmarkedAt: bookmarked ? now : null,
    watched: false,
    rating: 0,
    memo: memo?.trim() || '',
    source: 'manual',
    addedAt: now,
    updatedAt: now,
  };

  store.items.unshift(newItem);
  saveYouTubeData(store);
  return newItem;
}

/**
 * Update an existing YouTube item
 */
export function updateYouTubeLink(id, patch) {
  const store = loadYouTubeData();
  const item = store.items.find(i => i.id === id);
  if (!item) throw new Error('해당 영상 항목을 찾을 수 없습니다.');

  if (patch.title !== undefined) item.title = patch.title.trim();
  if (patch.channelTitle !== undefined) item.channelTitle = patch.channelTitle.trim();
  if (patch.description !== undefined) item.description = patch.description.trim();
  if (patch.category !== undefined) item.category = patch.category;
  if (patch.channelPresetId !== undefined) item.channelPresetId = patch.channelPresetId;
  if (patch.duration !== undefined) item.duration = patch.duration;
  if (patch.memo !== undefined) item.memo = patch.memo.trim();
  if (patch.watched !== undefined) item.watched = Boolean(patch.watched);
  if (patch.rating !== undefined) item.rating = Number(patch.rating) || 0;

  if (patch.tags !== undefined) {
    item.tags = Array.isArray(patch.tags)
      ? patch.tags
      : typeof patch.tags === 'string'
        ? patch.tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];
  }

  if (patch.bookmarked !== undefined) {
    const nextBookmarked = Boolean(patch.bookmarked);
    if (nextBookmarked && !item.bookmarked) item.bookmarkedAt = Date.now();
    if (!nextBookmarked) item.bookmarkedAt = null;
    item.bookmarked = nextBookmarked;
  }

  if (patch.url && patch.url !== item.url) {
    const videoId = extractYouTubeId(patch.url);
    item.url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : patch.url.trim();
    item.videoId = videoId || undefined;
    if (videoId) item.thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }

  item.updatedAt = Date.now();
  saveYouTubeData(store);
  return item;
}

/**
 * Toggle bookmark ("다시보기") status
 */
export function toggleYouTubeBookmark(id) {
  const store = loadYouTubeData();
  const item = store.items.find(i => i.id === id);
  if (!item) throw new Error('해당 영상 항목을 찾을 수 없습니다.');

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
  if (store.items.length === beforeLen) throw new Error('삭제할 항목을 찾을 수 없습니다.');
  saveYouTubeData(store);
  return true;
}

/**
 * Clear only unbookmarked feed items (keeps all "다시보기" items safe!)
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
 * Search YouTube HTML and parse video results with duration and trash filtering
 */
async function searchYouTubeQuery(query, filterLong = true, allowEducational = false, isSports = false) {
  try {
    // sp=EgIIBA%253D%253D filters for 'This Month'.
    const recentParam = (filterLong && !isSports) ? '&sp=EgIIBA%253D%253D' : '';
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}${recentParam}`;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
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
          const publishedText = v.publishedTimeText?.simpleText || 'Recently';
          const duration = v.lengthText?.simpleText || '';
          const views = v.viewCountText?.simpleText || '';
          const descSnippet = v.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map(r => r.text).join('') || '';

          // 1. Strict Trash / Blacklist / Male Creator Keyword Filtering
          if (isTrashContent(title, descSnippet, channelTitle, allowEducational, isSports)) {
            continue;
          }

          // 2. Strict Duration Filtering (skip under 30s if not specified)
          if (!isSports && duration && !isAtLeast5Min(duration)) {
            continue;
          }

          // 3. Upload Date Filtering
          const pt = publishedText.toLowerCase();
          if (pt !== 'recently' && pt) {
            if (!allowEducational && !isSports && /year|년\s*전/.test(pt)) {
              continue;
            }
            if (!allowEducational && !isSports) {
              const monthMatch = pt.match(/(\d+)\s*(month|개월|달)/);
              if (monthMatch) {
                const months = parseInt(monthMatch[1], 10);
                if (months > 1) {
                  continue;
                }
              }
            }
          }

          results.push({
            videoId,
            title,
            channelTitle,
            publishedText,
            duration: duration || (isSports ? '직캠' : '15:00+'),
            views,
            description: descSnippet || `${publishedText} • ${views} • Duration: ${duration || '직캠'}`,
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            url: `https://www.youtube.com/watch?v=${videoId}`,
          });
        }
      }
    }
    return results;
  } catch (e) {
    console.error(`[YouTube Control] Search failed for query "${query}":`, e.message);
    return [];
  }
}

/**
 * Execute Full AI Curation & Web Discovery across the Dedicated Channels
 */
export async function curateYouTubeLinks({
  channelPresetId = 'all',
  channelPresetIds = [],
  query = '',
  limit = 30,
  replaceExisting = true,
} = {}) {
  const store = loadYouTubeData();

  const selectedIds = Array.isArray(channelPresetIds) && channelPresetIds.length > 0
    ? channelPresetIds
    : channelPresetId !== 'all' ? [channelPresetId] : [];

  console.log(`[YouTube Control] 🚀 Starting YouTube Curation (Target Channels: ${selectedIds.length > 0 ? selectedIds.join(', ') : 'all'})...`);

  // Target channels to scrape
  const targetChannels = selectedIds.length > 0
    ? CURATION_CHANNELS.filter(c => selectedIds.includes(c.id))
    : CURATION_CHANNELS;

  const finalChannels = targetChannels.length > 0 ? targetChannels : CURATION_CHANNELS;

  let allFound = [];
  const seenIds = new Set();

  // Keep existing bookmarked video IDs
  store.items.filter(i => i.bookmarked).forEach(i => {
    if (i.videoId) seenIds.add(i.videoId);
  });

  for (const chan of finalChannels) {
    let chanCount = 0;
    const isEducational = chan.id === 'opic_al';
    const isSports = chan.id === 'track_fancam';
    const targetQuota = targetChannels.length === 1 ? limit : Math.round(limit * (chan.weight || 0.5));
    const queries = query && channelPresetId === chan.id
      ? [query, ...chan.queries]
      : chan.queries;

    for (const q of queries) {
      const list = await searchYouTubeQuery(q, !isSports, isEducational, isSports);
      for (const item of list) {
        if (!seenIds.has(item.videoId) && !isTrashContent(item.title, item.description, item.channelTitle, isEducational, isSports)) {
          seenIds.add(item.videoId);
          allFound.push({
            ...item,
            channelPresetId: chan.id,
            category: chan.category,
            channelTags: chan.defaultTags,
          });
          chanCount++;
          if (chanCount >= targetQuota) break;
        }
      }
      if (chanCount >= targetQuota) break;
    }
  }

  // Fallback if needed
  if (allFound.length < limit) {
    for (const chan of finalChannels) {
      const isEducational = chan.id === 'opic_al';
      const isSports = chan.id === 'track_fancam';
      const fallbackList = await searchYouTubeQuery(chan.queries[0], false, isEducational, isSports);
      for (const item of fallbackList) {
        if (!seenIds.has(item.videoId) && !isTrashContent(item.title, item.description, item.channelTitle, isEducational, isSports)) {
          seenIds.add(item.videoId);
          allFound.push({
            ...item,
            channelPresetId: chan.id,
            category: chan.category,
            channelTags: chan.defaultTags,
          });
        }
        if (allFound.length >= limit) break;
      }
      if (allFound.length >= limit) break;
    }
  }

  const selectedVideos = allFound.slice(0, limit);

  const curatedItems = selectedVideos.map((v, idx) => {
    const durationBadge = v.duration && v.duration !== '15:00+' ? `⏱️ ${v.duration}` : '⏱️ 15분+';
    return {
      id: 'yt_curated_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2, 6),
      videoId: v.videoId,
      title: v.title,
      url: v.url,
      channelTitle: v.channelTitle || 'YouTube Creator',
      duration: v.duration || '15:00+',
      description: v.description,
      thumbnailUrl: v.thumbnailUrl,
      publishedAt: new Date(Date.now() - (idx + 1) * 3600 * 1000).toISOString(),
      category: v.category || 'vlog_20s',
      channelPresetId: v.channelPresetId || '20s_vlog',
      tags: [...(v.channelTags || []), durationBadge],
      bookmarked: false,
      bookmarkedAt: null,
      watched: false,
      rating: 0,
      memo: '',
      source: 'ai_curated',
      addedAt: Date.now() - idx * 1000,
      updatedAt: Date.now(),
    };
  });

  // Preserve all bookmarked ("다시보기") items
  const preservedBookmarked = store.items.filter(item => item.bookmarked);

  let finalItems;
  if (replaceExisting) {
    finalItems = [...preservedBookmarked, ...curatedItems];
  } else {
    finalItems = [...preservedBookmarked, ...curatedItems, ...store.items.filter(i => !i.bookmarked)];
  }

  store.items = finalItems;
  store.lastCuratedAt = Date.now();
  store.lastQuery = query || `7개 맞춤 채널 큐레이션 (${finalChannels.map(c => c.shortLabel).join(', ')})`;

  saveYouTubeData(store);

  console.log(`[YouTube Control] ✅ 7-Channel Curation finished. Added ${curatedItems.length} videos. Preserved ${preservedBookmarked.length} bookmarked items.`);

  return {
    ok: true,
    addedCount: curatedItems.length,
    preservedBookmarkedCount: preservedBookmarked.length,
    totalItems: finalItems.length,
    lastCuratedAt: store.lastCuratedAt,
    lastQuery: store.lastQuery,
  };
}
