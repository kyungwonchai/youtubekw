import fs from 'fs';
import path from 'path';

const YOUTUBE_FILE = '/home/kw/.kwsoft-youtube-links.json';
const VIP_FILE = '/home/kw/.kwsoft-youtube-secret-vip.json';

const INNERTUBE_API_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const INNERTUBE_CLIENT_VERSION = '20.10.38';
const INNERTUBE_CONTEXT = { client: { clientName: 'ANDROID', clientVersion: INNERTUBE_CLIENT_VERSION } };
const INNERTUBE_USER_AGENT = 'com.google.android.youtube/' + INNERTUBE_CLIENT_VERSION + ' (Linux; U; Android 14)';

function parseSecs(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  const parts = durationStr.trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

async function hasSubtitles(videoId) {
  try {
    const resp = await fetch(INNERTUBE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': INNERTUBE_USER_AGENT },
      body: JSON.stringify({ context: INNERTUBE_CONTEXT, videoId }),
      signal: AbortSignal.timeout(3500)
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    return Array.isArray(tracks) && tracks.length > 0;
  } catch (e) {
    return false;
  }
}

async function searchYouTubeQuery(query) {
  try {
    const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
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
          const title = v.title?.runs?.[0]?.text || '';
          const channelTitle = v.ownerText?.runs?.[0]?.text || '';
          const duration = v.lengthText?.simpleText || '';
          const descSnippet = v.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map(r => r.text).join('') || '';
          const secs = parseSecs(duration);
          if (secs >= 300) {
            results.push({ videoId: v.videoId, title, channelTitle, duration, description: descSnippet });
          }
        }
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}

async function run() {
  console.log('🚀 Step 1: Processing Golf -> Game Corner (VIP) and Purging Male/Anime/AI Avatars...');

  const mainData = JSON.parse(fs.readFileSync(YOUTUBE_FILE, 'utf8'));
  let mainItems = mainData.items || [];
  const vipItems = JSON.parse(fs.readFileSync(VIP_FILE, 'utf8'));

  const initialMainCount = mainItems.length;
  const initialVipCount = vipItems.length;

  // 1. Male / Anime / AI Avatar blacklists
  const BANNED_CHANNELS = [
    'español con juan', 'yuyuの日本語podcast', '文森說書', 'the plain bagel', 'takomo golf',
    'seb on golf', 'mark crossfield', 'fabian bünker', 'the rick shiels golf show', 'nightcore & amv',
    'twisted fateseries', "billionaire's sweetheart tv", 'in bilmi'
  ];

  const BANNED_VIDEO_IDS = new Set([
    'rWP7OYwHCEk', // Anime love story
    'q-XJtpbDxFg', // Edward Cruz
    'zglDZqfHPo4', // Seth Godin
    'xs8UV9wdWlI', // Dan Fowlks, Colin Cunningham
    'htknl4o1_nQ', // Twisted FateSeries
    'kys5fNH_LP0', // Billionaire's Sweetheart TV
    '3oBq-U7iV6Q', // in Bilmi
  ]);

  const BANNED_KEYWORDS = [
    'anime', 'animation', 'animated', 'amv', 'cartoon', 'vtuber', 'ai character', 'ai avatar', 'virtual human'
  ];

  const femaleGolfChannels = [
    'paige spiranac', 'hailey ostrom', 'grace charis', 'tisha alyn', 'mia baker',
    'golf girl games', 'golfholics', 'stephanie gibri', 'sara winter golf',
    'shee golfs', 'sabrina andolpho', 'chili dippa golf', 'namesjoyee', 'karol priscilla'
  ];

  const golfToTransfer = [];
  const purgedItems = [];
  const keptMainItems = [];

  for (const item of mainItems) {
    const cLower = (item.channelTitle || '').toLowerCase();
    const tLower = (item.title || '').toLowerCase();
    const allLower = `${tLower} ${cLower} ${(item.tags || []).join(' ')}`.toLowerCase();

    // Check banned video ID
    if (BANNED_VIDEO_IDS.has(item.videoId)) {
      purgedItems.push({ item, reason: 'Banned Video ID' });
      continue;
    }

    // Check banned channels (male / anime / fake drama)
    if (BANNED_CHANNELS.some(b => cLower.includes(b))) {
      purgedItems.push({ item, reason: `Banned Channel (${item.channelTitle})` });
      continue;
    }

    // Check banned keywords (anime, cartoon, vtuber)
    if (BANNED_KEYWORDS.some(kw => tLower.includes(kw))) {
      purgedItems.push({ item, reason: `Banned Keyword (${tLower})` });
      continue;
    }

    // Check if it is a golf video
    const isGolf = femaleGolfChannels.some(g => cLower.includes(g) || allLower.includes(g)) ||
                   allLower.includes('golf') || allLower.includes('골프');

    if (isGolf) {
      // Transfer to VIP / Game Corner
      golfToTransfer.push(item);
    } else {
      keptMainItems.push(item);
    }
  }

  console.log(`\nMain Feed Inspection:`);
  console.log(` - Initial Items: ${initialMainCount}`);
  console.log(` - Purged (Male / Anime / AI Drama): ${purgedItems.length}`);
  purgedItems.forEach(p => console.log(`   ❌ [${p.reason}] ${p.item.title} (${p.item.channelTitle})`));
  console.log(` - Golf Videos Identified to Transfer to Game Corner: ${golfToTransfer.length}`);
  console.log(` - Clean Main Feed Remaining: ${keptMainItems.length}`);

  // Transfer Golf to VIP
  const existingVipIds = new Set(vipItems.map(v => v.videoId));
  let addedGolfCount = 0;
  for (const g of golfToTransfer) {
    if (!existingVipIds.has(g.videoId)) {
      existingVipIds.add(g.videoId);
      vipItems.push({
        id: g.id || `yt_golf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        videoId: g.videoId,
        title: g.title,
        url: g.url || `https://www.youtube.com/watch?v=${g.videoId}`,
        channelTitle: g.channelTitle,
        duration: g.duration,
        publishedText: g.publishedText || '최근',
        description: g.description || `${g.channelTitle} • 골프 코스 브이로그 & 쉐도잉 훈련`,
        thumbnailUrl: g.thumbnailUrl,
        category: 'fitness',
        subType: '골프',
        tags: ['VIP특별편', '골프', '골프피트니스', '미녀골퍼', '쉐도잉']
      });
      addedGolfCount++;
    }
  }

  console.log(`\nGame Lounge (VIP):`);
  console.log(` - Initial Items: ${initialVipCount}`);
  console.log(` - Added Golf Videos: ${addedGolfCount}`);
  console.log(` - Total Game Lounge Items: ${vipItems.length}`);
  fs.writeFileSync(VIP_FILE, JSON.stringify(vipItems, null, 2), 'utf8');
  console.log(`✅ Saved updated .kwsoft-youtube-secret-vip.json!`);

  // Step 2: Collect Nature & Travel Videos
  console.log(`\n========================================`);
  console.log(`🚀 Step 2: Collecting Nature & Travel Videos by Top Articulate Female Vloggers...`);
  console.log(`========================================`);

  const TRAVEL_QUERIES = [
    'Allison Anderson solo travel nature',
    'Allison Anderson road trip national park',
    'Eva zu Beck solo hiking wild nature',
    'Eva zu Beck mountains solo travel',
    'Jonna Jinton nature northern Sweden forest',
    'Jonna Jinton winter life Sweden',
    'Isabel Paige solo cabin mountains nature',
    'Isabel Paige off grid living wilderness',
    'Hey Nadine solo travel guide nature destination',
    'Sanne Vloet travel nature Switzerland Kyoto',
    'Eileen Aldis solo travel nature slow living',
    'Alina Mcleod solo travel Canada nature mountains',
    'Lexie Limitless solo travel adventure culture',
    'Tanya Khanow solo camping forest nature'
  ];

  const existingMainIds = new Set(keptMainItems.map(i => i.videoId));
  const newTravelItems = [];

  for (let qIdx = 0; qIdx < TRAVEL_QUERIES.length; qIdx++) {
    const q = TRAVEL_QUERIES[qIdx];
    console.log(`[${qIdx + 1}/${TRAVEL_QUERIES.length}] Searching: "${q}"...`);
    const results = await searchYouTubeQuery(q);

    for (const r of results) {
      if (existingMainIds.has(r.videoId)) continue;

      // Verify subtitles
      const hasSub = await hasSubtitles(r.videoId);
      if (!hasSub) continue;

      existingMainIds.add(r.videoId);
      newTravelItems.push({
        id: `yt_travel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        videoId: r.videoId,
        title: r.title,
        url: `https://www.youtube.com/watch?v=${r.videoId}`,
        channelTitle: r.channelTitle,
        duration: r.duration,
        publishedText: '최근 1~2년 이내',
        description: `${r.channelTitle} • 아름다운 대자연 풍경과 또렷한 힐링 보이스의 솔로 여행 쉐도잉 (${r.duration})`,
        thumbnailUrl: `https://img.youtube.com/vi/${r.videoId}/hqdefault.jpg`,
        category: 'travel_nature',
        language: 'en',
        tags: ['자연여행', '미녀유튜버', '솔로트래블', '대자연', '힐링보이스', '명품딕션', '쉐도잉']
      });

      console.log(`   ✨ Added: [${r.duration}] ${r.title} (${r.channelTitle})`);
      if (newTravelItems.length >= 80) break;
    }

    if (newTravelItems.length >= 80) break;
    await new Promise(res => setTimeout(res, 200));
  }

  console.log(`\nSuccessfully gathered ${newTravelItems.length} fresh nature & travel videos with verified subtitles!`);

  // Merge travel items into main items (place them near top of the feed)
  const finalMainItems = [...newTravelItems, ...keptMainItems];

  mainData.items = finalMainItems;
  fs.writeFileSync(YOUTUBE_FILE, JSON.stringify(mainData, null, 2), 'utf8');
  console.log(`✅ Saved updated .kwsoft-youtube-links.json (Total items: ${finalMainItems.length})!`);
  console.log(`\n🎉 ALL TASKS FINISHED!`);
}

run().catch(console.error);
