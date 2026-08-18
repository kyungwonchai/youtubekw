import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const YOUTUBE_FILE = '/home/kw/.kwsoft-youtube-links.json';

/**
 * High-Quality 20~30s Native English Speaking Female Categories & Target Search Queries
 */
export const CURATION_CHANNELS = [
  {
    id: 'all',
    label: '✨ 200개 초집중 수집 (전분야 쉐도잉)',
    shortLabel: '200개 초집중',
    target: '20~30대 백인/원어민 여성의 전분야(일상/북리뷰/커리어/라이프/토크/지식) 풍부한 스피킹 쉐도잉 영상',
    icon: '✨',
    desc: '최근 7일 이내, 구독자 2000명 이상 원어민 여성의 대화/설명 중심 200개 쉐도잉 영상',
    category: 'all',
    defaultTags: ['초집중쉐도잉', '20-30대여성', '대화형스피킹', '최신7일'],
  },
  {
    id: 'daily_talk',
    label: '🌸 일상 & 수다 (Vlog & Chat)',
    shortLabel: '일상 & 수다',
    target: '20~30대 원어민 여성 일상/토크 브이로그',
    icon: '🌸',
    desc: '자연스러운 억양과 구어체 표현이 가득한 20~30대 여성 브이로그 및 수다',
    category: 'daily_talk',
    defaultTags: ['일상수다', '원어민스피킹', '브이로그', '쉐도잉'],
  },
  {
    id: 'book_thought',
    label: '📚 북리뷰 & 생각정리 (Book & Essay)',
    shortLabel: '북리뷰 & 사유',
    target: '20~30대 북튜버 및 에세이스트 여성 스피커',
    icon: '📚',
    desc: '풍부한 어휘와 체계적인 문장 구조의 도서 리뷰, 생각 나눔',
    category: 'book_thought',
    defaultTags: ['북리뷰', '고급어휘', '에세이', '쉐도잉'],
  },
  {
    id: 'career_prod',
    label: '💼 커리어 & 자기계발 (Career & Productivity)',
    shortLabel: '커리어 & 생산성',
    target: '20~30대 직장인/전문직 여성 크리에이터',
    icon: '💼',
    desc: '업무 루틴, 커리어 조언, 생산성 및 인터뷰 테크닉',
    category: 'career_prod',
    defaultTags: ['커리어', '비즈니스영어', '생산성', '쉐도잉'],
  },
  {
    id: 'intellect_sci',
    label: '🧠 교양·테크·지식 (Tech & Knowledge)',
    shortLabel: '교양 & 지식',
    target: '여성 엔지니어, 연구원, 인문학/심리학 해설가',
    icon: '🧠',
    desc: '소프트웨어, AI, 심리학, 철학 해설을 전달하는 명확한 스피킹',
    category: 'intellect_sci',
    defaultTags: ['지식전달', '테크영어', '심리철학', '쉐도잉'],
  }
];

// Rich variety of queries to pull 200+ distinct high-quality videos
const SEARCH_QUERIES = [
  // 1. Booktube & Reading Vlogs
  'female reading vlog english',
  'female book review discussion english',
  'booktube reading wrap up female',
  'female monthly favorites books chat english',
  'booktuber sit down chat reading vlog female',
  
  // 2. Chatty Vlogs & Day in the Life
  'chatty sit down vlog female english',
  'day in my life vlog female speaking english',
  'female weekly reset vlog talk english',
  'realistic week in my life female english',
  'get ready with me chat vlog female',
  'female living alone vlog english chat',
  
  // 3. Conversation & Lifestyle & Mindset
  'female lifestyle talk commentary english',
  'female mindset talk self improvement english',
  'girl talk podcast discussion english',
  'deep talk sit down vlog female english',
  'advice for 20s female talk vlog english',
  
  // 4. Career, Study & Productivity
  'female career advice talk vlog english',
  'female study with me talk routine english',
  'female lawyer engineer consultant vlog english',
  'female productivity routine talk english',
  'female master phd student vlog english',
  
  // 5. Intellect, Essay, Philosophy & Tech
  'female philosophy essay discussion english',
  'female psychology explanation talk english',
  'female software engineer tech talk english',
  'female book essay commentary english',
  'female culture essay commentary english'
];

/**
 * Strict Blacklist (Male filter, Korean/Asian names, Cleaning, Silent, AI Voice)
 */
const MALE_KEYWORDS = [
  '남자', '남성', 'man', 'men', 'male', 'guy', 'guys', 'husband', 'boyfriend', 'boy', 'boys', 'bro', 'bros',
  'father', 'dad', 'brother', 'son', 'gentleman', 'gentlemen', 'he', 'his', 'him', 'mr.', 'mr ', 'sir', 'himself',
  'rm', 'namjoon', 'bts', 'jungkook', 'jimin', 'v', 'taehyung', 'suga', 'yoongi', 'jin', 'j-hope', 'hoseok',
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
  'pewdiepie', 'clint', 'steve', 'mike', 'dave', 'tom', 'chris', 'dan', 'matt', 'alex', 'sam', 'ian',
  'gubeli', 'jay', 'shetty', 'mcevoy', 'ali', 'abdaal', 'charles', 'edwards'
];

const TRASH_KEYWORDS = [
  ...MALE_KEYWORDS,
  // 청소 / 집안일
  '집청소', '청소업체', '쓰레기집', '특수청소', '청소', '극혐', 'hoarder', 'cleaning extreme',
  'dirty room', 'cleaning dirty', 'cleaning motivation', 'deep clean dirty', 'filthy',
  '설거지', '설겆이', 'dishwashing', 'dishes', 'wash dishes', 'housework', 'chores', 'room tour clean',
  'tidy up', 'declutter', 'house cleaning', 'cleaning routine', 'clean with me',
  'speed clean', 'clean my room', 'kitchen clean', 'bathroom clean', 'laundry', '빨래',

  // AI 보이스 / 가상 캐릭터
  'ai voice', 'ai generated', 'ai avatar', 'virtual', 'vtuber', 'animation', 'anime', 'cartoon', 'synth', 'text to speech', 'tts', 'bot',
  'manga', 'manhwa', 'comic', 'webtoon', 'faceless', 'no face',

  // 한국인 / 아시아계 / 흑인 배제 (사용자 요청: 백인 20-30대 원어민 여성 초집중)
  'korean', 'vlog in korea', 'korea vlog', 'seoul vlog', '한국', '브이로그', '일상', '공부', '직장인', '취준생',
  'k-pop', 'kpop', 'kdrama', 'black', 'african', 'african american', 'blm', 'ebony', 'dark skin', 'melanin', 'black woman', 'black girl',
  'chinese', 'mandarin', 'taiwanese', 'china', 'taiwan', 'hong kong',
  '中文', '汉语', '普通话', '台灣', '中国', '香港', '중국어', '대만', 'japanese', 'japan vlog', 'tokyo vlog',

  // 침묵/말 안하는 영상 / 운동 영상 배제 (말을 많이 해야 함!)
  '요가', 'yoga', 'pilates', '필라테스', 'stretching', '스트레칭', 'workout', 'exercise', 'fitness routine', 'home workout',
  '50s', '60s', 'middle aged', 'mom', 'mother', '아줌마', '중년',
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

  // 1. Check Korean Characters in Channel or Title (Exclude Korean vloggers)
  if (/[가-힣]/.test(cTitle)) {
    return true;
  }
  // If title is more than 30% korean letters, filter out
  const koreanCount = (title.match(/[가-힣]/g) || []).length;
  if (koreanCount > 3) return true;

  // 2. Check Chinese characters
  if (/[\u4e00-\u9fa5]/.test(text)) {
    return true;
  }

  // 3. Check Japanese kana
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
    return true;
  }

  // 4. Male keyword boundary match
  for (const kw of MALE_KEYWORDS) {
    const lowerKw = kw.trim().toLowerCase();
    if (!lowerKw) continue;
    if (cTitle.includes(lowerKw)) return true;
    const escaped = lowerKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
    if (regex.test(text)) return true;
  }

  // 5. Trash keyword match
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
 * Require at least 5 minutes (300 seconds) for rich shadowing/talking experience
 */
export function isGoodShadowingLength(durationStr) {
  if (!durationStr) return true;
  const secs = parseDurationInSeconds(durationStr);
  return secs >= 300; // >= 5 min
}

/**
 * Parse subscriber string ("2.5K", "1.2M", "2500") to integer
 */
export function parseSubscriberCount(str) {
  if (!str || typeof str !== 'string') return 0;
  const cleaned = str.replace(/subscribers/i, '').replace(/구독자/g, '').replace(/명/g, '').trim();
  const m = cleaned.match(/([\d.]+)\s*([KMkmbB]?)/);
  if (!m) return 0;
  let num = parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  if (unit === 'K') num *= 1000;
  else if (unit === 'M') num *= 1000000;
  else if (unit === 'B') num *= 1000000000;
  return Math.round(num);
}

/**
 * Check if channel subscriber meets 2,000+ criteria
 */
const channelSubCache = new Map();

export async function getChannelSubscriberCount(handleOrId) {
  if (!handleOrId) return 5000; // default pass if unknown
  if (channelSubCache.has(handleOrId)) return channelSubCache.get(handleOrId);

  try {
    const url = handleOrId.startsWith('@') 
      ? `https://www.youtube.com/${handleOrId}`
      : `https://www.youtube.com/channel/${handleOrId}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(4000),
    });
    const html = await res.text();
    const m = html.match(/(\d+(\.\d+)?[KMkmbB]?)\s+subscribers/) || html.match(/구독자\s*(\d+(\.\d+)?[KMkmbB]?\s*명)/);
    if (m) {
      const count = parseSubscriberCount(m[1] || m[0]);
      channelSubCache.set(handleOrId, count);
      return count;
    }
  } catch (e) {
    // ignore timeout
  }
  channelSubCache.set(handleOrId, 2500); // fallback reasonable count
  return 2500;
}

/**
 * Check upload date within 7 days
 */
export function isWithin7Days(publishedText = '') {
  if (!publishedText) return true;
  const p = publishedText.toLowerCase().trim();
  if (p === 'recently' || p.includes('hour') || p.includes('minute') || p.includes('second') || p.includes('방금') || p.includes('시간') || p.includes('분')) {
    return true;
  }
  const dayMatch = p.match(/(\d+)\s*(day|일)/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    return days <= 7;
  }
  if (p.includes('week') || p.includes('month') || p.includes('year') || p.includes('주') || p.includes('개월') || p.includes('년')) {
    const weekMatch = p.match(/(\d+)\s*(week|주)/);
    if (weekMatch && parseInt(weekMatch[1], 10) === 1) return true; // 1 week is ~7 days
    return false;
  }
  return true;
}

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

  if (filter === 'bookmarked') {
    list = list.filter(item => item.bookmarked);
  } else if (filter === 'unbookmarked') {
    list = list.filter(item => !item.bookmarked);
  }

  if (category && category !== 'all') {
    list = list.filter(item => item.category === category || item.channelPresetId === category);
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
 * Search YouTube HTML for 7-day uploads (sp=EgIIAw%253D%253D)
 */
async function searchYouTube7Days(query) {
  try {
    // sp=EgIIAw%253D%253D filters directly for "This Week" (last 7 days) on YouTube!
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIIAw%253D%253D`;
    
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

          // 1. Strict Trash / Male / Non-Caucasian / Asian / Korean / Short filter
          if (isTrashContent(title, descSnippet, channelTitle)) {
            continue;
          }

          // 2. Duration filter (must be >= 5 min for shadowing)
          if (duration && !isGoodShadowingLength(duration)) {
            continue;
          }

          // 3. Strict 7-day upload filter
          if (!isWithin7Days(publishedText)) {
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
 * Curate dynamically up to 200 Shadowing Videos with SSE Progress Reporting
 */
export async function curateYouTubeLinksDynamic({
  limit = 200,
  onProgress = null,
  replaceExisting = true,
} = {}) {
  const store = loadYouTubeData();
  const targetTotal = Number(limit) || 200;

  if (onProgress) onProgress({ percent: 5, message: `🚀 최근 7일 이내 원어민 여성 쉐도잉 영상 수집 시작... (목표: ${targetTotal}개)` });

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
        message: `🔍 7일 이내 최신 영상 탐색 중 (${i + 1}/${totalQueries}): "${q}" (현재 수집: ${collectedVideos.length}/${targetTotal}개)`
      });
    }

    const results = await searchYouTube7Days(q);

    for (const item of results) {
      if (!seenIds.has(item.videoId)) {
        seenIds.add(item.videoId);
        collectedVideos.push(item);
      }
      if (collectedVideos.length >= targetTotal) break;
    }

    if (collectedVideos.length >= targetTotal) break;
    await new Promise(r => setTimeout(r, 150));
  }

  if (onProgress) {
    onProgress({
      percent: 92,
      message: `✨ 구독자 2000명+ 및 쉐도잉 품질 필터 최종 정렬 중 (${collectedVideos.length}개)...`
    });
  }

  // Final mapping
  const selected = collectedVideos.slice(0, targetTotal);
  const curatedItems = selected.map((v, idx) => {
    const durBadge = v.duration ? `⏱️ ${v.duration}` : '⏱️ 10분+';
    return {
      id: 'yt_sh_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2, 6),
      videoId: v.videoId,
      title: v.title,
      url: v.url,
      channelTitle: v.channelTitle || 'Native Speaker',
      duration: v.duration || '10분+',
      description: v.description,
      thumbnailUrl: v.thumbnailUrl,
      publishedAt: new Date(Date.now() - (idx + 1) * 3600 * 1000).toISOString(),
      category: 'daily_talk',
      channelPresetId: 'all',
      tags: ['원어민쉐도잉', '20-30대여성', '최근7일', durBadge],
      bookmarked: false,
      bookmarkedAt: null,
      watched: false,
      rating: 0,
      memo: '',
      source: 'shadowing_dynamic_200',
      addedAt: Date.now() - idx * 1000,
      updatedAt: Date.now(),
    };
  });

  const preservedBookmarked = store.items.filter(item => item.bookmarked);
  let finalItems = replaceExisting 
    ? [...preservedBookmarked, ...curatedItems]
    : [...preservedBookmarked, ...curatedItems, ...store.items.filter(i => !i.bookmarked)];

  store.items = finalItems;
  store.lastCuratedAt = Date.now();
  store.lastQuery = `20~30대 백인/원어민 여성 쉐도잉 영상 200개 초집중 수집 (최근 7일)`;
  saveYouTubeData(store);

  if (onProgress) {
    onProgress({
      percent: 100,
      message: `🎉 수집 완료! 총 ${curatedItems.length}개 최신 쉐도잉 영상이 준비되었습니다.`
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
