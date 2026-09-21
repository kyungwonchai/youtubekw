import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const YOUTUBE_FILE = '/home/kw/.kwsoft-youtube-links.json';

/**
 * High-Quality TED, Educational & Native English Speaking Female Categories
 */
export const CURATION_CHANNELS = [
  {
    id: 'all',
    label: '✨ 100개 초집중 수집 (TED·교육·고급 딕션 쉐도잉)',
    shortLabel: '100개 TED·교육',
    target: '최근 3년 이내 TED, 강연, 교육, 명확한 딕션의 여성 원어민 스피킹 쉐도잉 100선',
    icon: '✨',
    desc: '최근 3년 이내 업로드된 TED 강연, 명문대 강의, 교양·교육 및 또렷한 발음(고급 딕션)의 여성 스피커 영상',
    category: 'all',
    defaultTags: ['TED강연', '고급딕션', '교육쉐도잉', '최근3년'],
  },
  {
    id: 'ted_speech',
    label: '🎤 TED & 명사 강연 (TED & Speeches)',
    shortLabel: 'TED & 명연설',
    target: 'TED, TEDx, 기념사, 대중 연설 스피커',
    icon: '🎤',
    desc: '전달력과 발음이 뛰어난 여성 명사들의 감동적이고 지적인 TED/TEDx 강연',
    category: 'ted_speech',
    defaultTags: ['TED', 'TEDx', '명연설', '스피치쉐도잉'],
  },
  {
    id: 'education_sci',
    label: '🧠 교양·과학·지식 (Education & Science)',
    shortLabel: '교양 & 지식',
    target: 'BBC Ideas, Big Think, 교수진, 연구원, 교양 해설가',
    icon: '🧠',
    desc: '심리학, 뇌과학, 인문학, 테크 등 명확한 딕션과 정돈된 문장의 지식 콘텐츠',
    category: 'education_sci',
    defaultTags: ['지식교양', 'BBC_Ideas', 'BigThink', '학술영어'],
  },
  {
    id: 'career_mind',
    label: '💼 커리어 & 마인드셋 (Career & Mindset)',
    shortLabel: '커리어 & 마인드',
    target: '커리어 코치, 리더십, 소통 전문가, 자기계발 스피커',
    icon: '💼',
    desc: '비즈니스 영어, 인터뷰 및 소통 스킬, 생산성 향상을 위한 프로페셔널 스피킹',
    category: 'career_mind',
    defaultTags: ['비즈니스영어', '리더십', '커리어', '동기부여'],
  },
  {
    id: 'diction_essay',
    label: '📚 에세이 & 낭독 & 북토크 (Diction & Essay)',
    shortLabel: '에세이 & 북토크',
    target: '에세이스트, 북튜버, 발음/딕션 코치, 인터뷰어',
    icon: '📚',
    desc: '표준 발음과 풍부한 어휘력이 돋보이는 생각 정리, 에세이 및 심층 도서 리뷰',
    category: 'diction_essay',
    defaultTags: ['명품발음', '북리뷰', '에세이', '원어민딕션'],
  }
];

// Rich queries focused on TED talks, education, public speeches, clear English diction
const SEARCH_QUERIES = [
  // 1. TED & TEDx Talks by Inspiring Women
  'TED talk female english diction speech',
  'TEDx talks female clear English diction',
  'TED talk female education communication speech',
  'TED talk inspiring female psychology mindset',
  'TED talk female science technology presentation',
  'TED talk female leadership productivity career',
  'TEDx talk woman confidence public speaking',
  'TED talk woman brain science learning languages',

  // 2. High-Diction Speeches, Lectures & Educational Channels
  'best female speech clear english pronunciation',
  'female public speaking presentation skills English',
  'informative speech female presentation english diction',
  'commencement speech female english clear pronunciation',
  'great speeches by women clear diction english',
  'educational lecture female english professor clear diction',
  'science communication female english talk',
  'BBC Ideas female explanation video english',
  'Big Think female speaker english lecture',
  'Oxford Union female address clear speech',
  'Harvard talk female clear english pronunciation',
  'masterclass female english presentation skills',

  // 3. Thoughtful Essay, Mindset & Intellect
  'female philosophy essay discussion english',
  'female psychology explanation talk english',
  'female career advice presentation english diction',
  'female intellect discussion deep talk english',
  'female booktube wrap up analysis clear english',
  'clear diction British RP female speech talk',
  'clear American accent female presentation talk'
];

/**
 * Filter keywords
 */
const MALE_KEYWORDS = [
  '남자', '남성', 'man', 'men', 'male', 'guy', 'guys', 'husband', 'boyfriend', 'boy', 'boys', 'bro', 'bros',
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
  'pewdiepie', 'clint', 'steve', 'mike', 'dave', 'tom', 'chris', 'dan', 'matt', 'alex', 'sam', 'ian',
  'shetty', 'abdaal', 'charles'
];

const TRASH_KEYWORDS = [
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
 * Check upload date within 3 years
 */
export function isWithin3Years(publishedText = '') {
  if (!publishedText) return true;
  const p = publishedText.toLowerCase().trim();
  if (p === 'recently' || p.includes('hour') || p.includes('minute') || p.includes('second') || p.includes('day') || p.includes('week') || p.includes('month') || p.includes('방금') || p.includes('시간') || p.includes('분') || p.includes('일') || p.includes('주') || p.includes('개월') || p.includes('달')) {
    if (!p.includes('year') && !p.includes('년')) {
      return true;
    }
  }
  const yearMatch = p.match(/(\d+)\s*(?:year|년)/);
  if (yearMatch) {
    const years = parseInt(yearMatch[1], 10);
    return years <= 3;
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
 * Dynamically add a YouTube link with automatic metadata fetching & instant bookmark
 */
export async function addYouTubeLink({ url, autoBookmark = true, category = 'ted_speech' } = {}) {
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
    category: detectedCategory || category || 'ted_speech',
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

          // 1. Strict Trash / Foreign language filter
          if (isTrashContent(title, descSnippet, channelTitle)) {
            continue;
          }

          // 2. Duration filter (must be >= 3 min for speech/shadowing)
          if (duration && !isGoodShadowingLength(duration)) {
            continue;
          }

          // 3. Strict 3-year upload filter
          if (!isWithin3Years(publishedText)) {
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
 * Determine category by query or title keywords
 */
function determineCategory(title = '', query = '') {
  const text = `${title} ${query}`.toLowerCase();
  if (text.includes('ted') || text.includes('speech') || text.includes('commencement') || text.includes('presentation')) {
    return 'ted_speech';
  }
  if (text.includes('science') || text.includes('bbc') || text.includes('big think') || text.includes('lecture') || text.includes('harvard') || text.includes('oxford')) {
    return 'education_sci';
  }
  if (text.includes('career') || text.includes('leader') || text.includes('productivity') || text.includes('confidence') || text.includes('mindset')) {
    return 'career_mind';
  }
  return 'diction_essay';
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

  if (onProgress) onProgress({ percent: 5, message: `🚀 최근 3년 이내 TED & 명품 딕션 여성 교육 쉐도잉 영상 수집 시작... (목표: ${targetTotal}개)` });

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
        message: `🔍 TED/교육자료 탐색 중 (${i + 1}/${totalQueries}): "${q}" (현재 수집: ${collectedVideos.length}/${targetTotal}개)`
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
    await new Promise(r => setTimeout(r, 120));
  }

  if (onProgress) {
    onProgress({
      percent: 95,
      message: `✨ TED 및 고품질 딕션 쉐도잉 데이터 100선 정리 중 (${collectedVideos.length}개)...`
    });
  }

  // Final mapping
  const selected = collectedVideos.slice(0, targetTotal);
  const curatedItems = selected.map((v, idx) => {
    const durBadge = v.duration ? `⏱️ ${v.duration}` : '⏱️ 10분+';
    const pubBadge = v.publishedText ? `📅 ${v.publishedText}` : '📅 최근 3년';
    return {
      id: 'yt_sh_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2, 6),
      videoId: v.videoId,
      title: v.title,
      url: v.url,
      channelTitle: v.channelTitle || 'TED / Expert Speaker',
      duration: v.duration || '10분+',
      publishedText: v.publishedText || '최근 3년 이내',
      description: v.description,
      thumbnailUrl: v.thumbnailUrl,
      publishedAt: new Date(Date.now() - (idx + 1) * 3600 * 1000).toISOString(),
      category: v.detectedCategory || 'ted_speech',
      channelPresetId: 'all',
      tags: ['TED강연', '고급딕션', '원어민스피킹', pubBadge, durBadge],
      bookmarked: false,
      bookmarkedAt: null,
      watched: false,
      rating: 0,
      memo: '',
      source: 'ted_education_diction_100',
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
  store.lastQuery = `최근 3년 TED·교육·명품 딕션 여성 쉐도잉 영상 100선`;
  saveYouTubeData(store);

  if (onProgress) {
    onProgress({
      percent: 100,
      message: `🎉 수집 완료! 총 ${curatedItems.length}개의 TED 및 교육 쉐도잉 영상이 준비되었습니다.`
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
