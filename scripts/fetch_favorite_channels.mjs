import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { loadYouTubeData, saveYouTubeData, isTrashContent, isMaleContent, loadAllSpeakers, saveCustomSpeakers } from '../youtube-control.mjs';

const TARGET_CHANNELS = [
  {
    name: 'Easy English With Cat',
    handle: '@EasyEnglishWithCat',
    url: 'https://www.youtube.com/@EasyEnglishWithCat/videos',
    language: 'en',
    category: 'conversation',
    tags: ['실전회화', '영어딕션', '자연스러운영어', '회화훈련', 'EasyEnglish'],
    mentorId: 'easy_english_cat',
    avatar: '🐱',
    badge: '🗣️ 자연스러운 실전 영어회화',
    role: '실전 영어회화 & 자연스러운 딕션 코치',
    coreTopics: '자연스러운 대화 습관, 실전 회화 표현, 유창성 훈련, 뉘앙스 차이',
    dictionStyle: '따뜻하고 또렷하며 친근한 원어민 표준 딕션'
  },
  {
    name: "Kay's Library",
    handle: '@KaysLibrary',
    url: 'https://www.youtube.com/@KaysLibrary/videos',
    language: 'en',
    category: 'sleep_life',
    tags: ['북튜브', '롱폼토크', '차분한영어', '책리뷰', 'KaysLibrary'],
    mentorId: 'kays_library',
    avatar: '📖',
    badge: '📚 북튜브 & 지적 라이프',
    role: '북 크리에이터 & 에세이스트',
    coreTopics: '책 추천, 심층 독서 토론, 일상 에세이, 차분한 라이프스타일',
    dictionStyle: '차분하고 편안하며 듣기 편한 북튜버 딕션'
  },
  {
    name: 'Pick Up Limes',
    handle: '@PickUpLimes',
    url: 'https://www.youtube.com/@PickUpLimes/videos',
    language: 'en',
    category: 'sleep_life',
    tags: ['웰니스', '마인드셋', '차분한영어', '식단에세이', 'PickUpLimes'],
    mentorId: 'pick_up_limes',
    avatar: '🍋',
    badge: '🌿 영양학 & 웰빙 라이프',
    role: '영양사(BSc Dietetics) & 웰빙 라이프스타일 크리에이터',
    coreTopics: '마음챙김, 건강한 라이프스타일, 영양과 멘탈 관리, 심신 안정 에세이',
    dictionStyle: '부드럽고 맑으며 힐링되는 옥스퍼드/캐나다 표준 딕션'
  },
  {
    name: 'Professor Lao',
    handle: '@profe_lao',
    url: 'https://www.youtube.com/@profe_lao/videos',
    language: 'es',
    category: 'conversation',
    tags: ['스페인어', '기초스페인어', '스페인어회화', 'Spanish', 'ProfessorLao'],
    mentorId: 'professor_lao',
    avatar: '🇪🇸',
    badge: '🇪🇸 스페인어 실전 회화',
    role: '스페인어 교육 전문가 & 크리에이터',
    coreTopics: '실전 스페인어 회화, 발음 교정, 기초 문법 마스터, 일상 표현',
    dictionStyle: '또렷하고 반복 훈련에 최적화된 스페인어 발음'
  },
  {
    name: 'Ruby Granger',
    handle: '@RubyGranger8',
    url: 'https://www.youtube.com/@RubyGranger8/videos',
    language: 'en',
    category: 'sleep_life',
    tags: ['공부로그', '영국식영어', '스터디위드미', '학업마인드셋', 'RubyGranger'],
    mentorId: 'ruby_granger',
    avatar: '🕯️',
    badge: '🇬🇧 옥스퍼드 감성 & 영국식 딕션',
    role: '학업/독서 크리에이터 & 옥스퍼드/에든버러 영문학',
    coreTopics: '딥 스터디 루틴, 고전문학 독서, 영국식 라이프스타일, 학구적 마인드셋',
    dictionStyle: '우아하고 정갈한 전형적인 영국 표준 RP 딕션'
  },
  {
    name: 'Sara Carrolli',
    handle: '@SaraCarrolli',
    url: 'https://www.youtube.com/@SaraCarrolli/videos',
    language: 'en',
    category: 'sleep_life',
    tags: ['북브이로그', '미국일상', '책추천', '롱폼토크', 'SaraCarrolli'],
    mentorId: 'sara_carrolli',
    avatar: '🧸',
    badge: '📖 북 브이로그 & 롱폼 딥토크',
    role: '인기 북튜버 & 라이프스타일 크리에이터',
    coreTopics: '독서 브이로그, 책 심층 감상, 롱폼 수다/일상 이야기, 취침용 토크',
    dictionStyle: '생생하고 자연스러운 현대 미국식 일상 딕션'
  },
  {
    name: 'Steph Bohrer',
    handle: '@StephBohrer',
    url: 'https://www.youtube.com/@StephBohrer/videos',
    language: 'en',
    category: 'sleep_life',
    tags: ['북튜브', '롱폼토크', '미국영어', '라이프스타일', 'StephBohrer'],
    mentorId: 'steph_bohrer',
    avatar: '🌷',
    badge: '🌷 북튜브 & 감성 라이프',
    role: '북튜버 & 스토리텔러',
    coreTopics: '소설 및 문학 감상, 롱폼 라이프 에세이, 일상 대화, 힐링 토크',
    dictionStyle: '통통 튀면서도 또렷하고 유쾌한 표준 미국식 딕션'
  }
];

function formatDuration(seconds) {
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

async function run() {
  console.log('🚀 [Curation] Starting targeted channel curation (10m+ duration, last 3 years)...');

  const store = loadYouTubeData();
  const existingVideoIds = new Set(store.items.map(i => i.videoId));
  const newItems = [];
  const customSpeakers = loadAllSpeakers();
  const speakerMap = new Map();
  customSpeakers.forEach(s => speakerMap.set(s.id, s));

  for (const ch of TARGET_CHANNELS) {
    console.log(`\n📺 Fetching channel: ${ch.name} (${ch.handle})...`);

    // Register Speaker
    speakerMap.set(ch.mentorId, {
      id: ch.mentorId,
      name: ch.name,
      role: ch.role,
      category: ch.category,
      avatar: ch.avatar,
      badge: ch.badge,
      dictionStyle: ch.dictionStyle,
      coreTopics: ch.coreTopics,
      keywords: [ch.name, ch.handle],
    });

    try {
      const cmd = `/home/kw/.local/bin/yt-dlp --flat-playlist --dump-single-json "${ch.url}"`;
      const raw = execSync(cmd, { maxBuffer: 50 * 1024 * 1024, encoding: 'utf8' });
      const json = JSON.parse(raw);
      const entries = json.entries || [];
      console.log(`   Found ${entries.length} raw videos on channel.`);

      let channelAdded = 0;
      for (const entry of entries) {
        if (!entry.id || !entry.title) continue;
        const durationSec = entry.duration || 0;

        // Condition 1: Minimum 10 minutes (600 seconds)
        if (durationSec < 600) continue;

        // Check if already in store
        if (existingVideoIds.has(entry.id)) continue;

        // Skip any trash or male hits
        if (isTrashContent(entry.title, '', ch.name)) continue;
        if (isMaleContent(entry.title, '', ch.name)) continue;

        const durationStr = formatDuration(durationSec);

        const item = {
          id: `sub_${ch.mentorId}_${entry.id}`,
          videoId: entry.id,
          title: entry.title,
          channelTitle: ch.name,
          description: `${entry.title} • ${ch.name} • ${ch.badge} (${durationStr})`,
          thumbnailUrl: `https://img.youtube.com/vi/${entry.id}/hqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${entry.id}`,
          duration: durationStr,
          category: ch.category,
          mentor: ch.name,
          language: ch.language,
          tags: [...ch.tags, durationSec >= 3600 ? '1시간+' : '10분+'],
          source: 'subscribed_creator',
          bookmarked: false,
          addedAt: Date.now(),
          durationSec: durationSec
        };

        newItems.push(item);
        existingVideoIds.add(entry.id);
        channelAdded++;
      }

      console.log(`   ✅ Added ${channelAdded} high-quality long-form videos (>= 10min) from ${ch.name}`);
    } catch (err) {
      console.error(`   ❌ Failed to fetch ${ch.name}:`, err.message);
    }
  }

  // Sort new items by duration descending (longest first)
  newItems.sort((a, b) => (b.durationSec || 0) - (a.durationSec || 0));

  // Insert to the top of store
  store.items = [...newItems, ...store.items];
  saveYouTubeData(store);

  // Save updated speakers
  saveCustomSpeakers(Array.from(speakerMap.values()));

  console.log(`\n🎉 Successfully integrated ${newItems.length} long-form videos into database!`);
  console.log(`📊 Total library videos now: ${store.items.length}`);
}

run();
