import fs from 'fs';
import { loadYouTubeData, saveYouTubeData } from '../youtube-control.mjs';

const INNERTUBE_API_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const INNERTUBE_CLIENT_VERSION = '20.10.38';
const INNERTUBE_CONTEXT = { client: { clientName: 'ANDROID', clientVersion: INNERTUBE_CLIENT_VERSION } };
const INNERTUBE_USER_AGENT = 'com.google.android.youtube/' + INNERTUBE_CLIENT_VERSION + ' (Linux; U; Android 14)';

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

function parseSecs(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  const parts = durationStr.trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

async function main() {
  console.log('🔄 Synchronizing YouTube links and pop songs...');
  const store = loadYouTubeData();
  const initialCount = store.items.length;
  console.log(`Initial items in store: ${initialCount}`);

  // 1. Separate pop songs vs non-pop items
  const nonPopItems = store.items.filter(item => item.category !== 'pop_music' && item.source !== 'curated_pop' && item.source !== 'ytmusic_pop');
  const popItems = store.items.filter(item => item.category === 'pop_music' || item.source === 'curated_pop' || item.source === 'ytmusic_pop');

  console.log(`Non-pop items: ${nonPopItems.length}`);
  console.log(`Pop music items to verify: ${popItems.length}`);

  // 2. Filter pop items >= 120s
  const validDurationPop = popItems.filter(item => parseSecs(item.duration) >= 120);
  console.log(`Pop items with duration >= 2 min (120s): ${validDurationPop.length}`);

  // 3. Verify subtitles for pop items
  const verifiedPop = [];
  const BATCH = 25;
  for (let i = 0; i < validDurationPop.length; i += BATCH) {
    const chunk = validDurationPop.slice(i, i + BATCH);
    const results = await Promise.all(chunk.map(async item => {
      const ok = await hasSubtitles(item.videoId);
      return { item, ok };
    }));
    for (const r of results) {
      if (r.ok) {
        verifiedPop.push(r.item);
      }
    }
  }

  console.log(`Verified pop songs with subtitles (>= 2 min): ${verifiedPop.length}`);

  // 4. Combine nonPopItems + verifiedPop
  const finalItems = [...nonPopItems, ...verifiedPop];
  store.items = finalItems;
  saveYouTubeData(store);

  console.log(`\n🎉 Sync complete! Total items saved to .kwsoft-youtube-links.json: ${finalItems.length}`);
  console.log(`   - 일반 영상 (5분 이상): ${nonPopItems.length}개`);
  console.log(`   - 🎵 감성 발라드 & 노래 (2분 이상, 자막 완벽 검증): ${verifiedPop.length}개`);
}

main();
