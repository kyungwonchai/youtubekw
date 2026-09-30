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

async function cleanFile(filePath, isArray = false) {
  if (!fs.existsSync(filePath)) {
    console.log(`[Skip] File not found: ${filePath}`);
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let data = JSON.parse(raw);
  let items = isArray ? data : (data.items || []);
  const initialCount = items.length;

  console.log(`\n========================================`);
  console.log(`Processing ${path.basename(filePath)} (Initial: ${initialCount})`);
  console.log(`========================================`);

  // Step 1: Filter out shorts / under 5 min (< 300s)
  const filteredDuration = items.filter(item => {
    const secs = parseSecs(item.duration);
    return secs >= 300;
  });
  const removedShortCount = initialCount - filteredDuration.length;
  console.log(`1. Removed under 5min / Shorts (< 300s): ${removedShortCount} items`);
  console.log(`   Remaining to test for subtitles: ${filteredDuration.length} items`);

  // Step 2: Test for subtitles in parallel batches
  console.log(`2. Verifying subtitles via InnerTube API...`);
  const finalItems = [];
  let noSubCount = 0;
  const BATCH_SIZE = 25;

  for (let i = 0; i < filteredDuration.length; i += BATCH_SIZE) {
    const chunk = filteredDuration.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(chunk.map(async item => {
      const ok = await hasSubtitles(item.videoId);
      return { item, ok };
    }));

    for (const r of results) {
      if (r.ok) {
        finalItems.push(r.item);
      } else {
        noSubCount++;
      }
    }
    process.stdout.write(`   Checked ${Math.min(i + BATCH_SIZE, filteredDuration.length)} / ${filteredDuration.length} (Valid: ${finalItems.length}, NoSub: ${noSubCount})\r`);
  }

  console.log(`\n   Verified: ${finalItems.length} videos have valid subtitles! (Removed ${noSubCount} without subtitles)`);
  console.log(`   Total removed: ${removedShortCount + noSubCount} items`);
  console.log(`   Final preserved: ${finalItems.length} items`);

  // Save cleaned data
  if (isArray) {
    fs.writeFileSync(filePath, JSON.stringify(finalItems, null, 2), 'utf8');
  } else {
    data.items = finalItems;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
  console.log(`✅ Successfully updated ${path.basename(filePath)}!`);
}

async function main() {
  console.log('🚀 Starting Deep Clean: Removing Shorts (< 5min) and Videos without Subtitles...');
  await cleanFile(VIP_FILE, true);
  await cleanFile(YOUTUBE_FILE, false);
  console.log('\n🎉 ALL CLEANUP COMPLETED SUCCESSFULLY!');
}

main().catch(console.error);
