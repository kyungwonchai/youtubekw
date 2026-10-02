import { YoutubeTranscript } from 'youtube-transcript';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const LINKS_FILE = '/home/kw/.kwsoft-youtube-links.json';
const BLACKLIST_FILE = '/home/kw/.kwsoft-youtube-blacklist.json';

const QUERIES = [
  // 1. Dr. Barbara Oakley (Learning How to Learn, Mindshift, Adult Neuroplasticity)
  { q: 'Barbara Oakley Learning How to Learn TEDx', category: 'ted_speech', mentor: 'Barbara Oakley', tags: ['뇌과학학습법', '성인학습', '박사강연', 'BarbaraOakley'] },
  { q: 'Barbara Oakley Mindshift adult learning speech', category: 'essay_deep', mentor: 'Barbara Oakley', tags: ['커리어전환', '뇌가소성', '공부법', '성인공부'] },
  { q: 'Barbara Oakley How to learn anything faster speech', category: 'essay_deep', mentor: 'Barbara Oakley', tags: ['기억법', '공부동기부여', '집중력', 'BarbaraOakley'] },

  // 2. Dr. Andrew Huberman (Neurobiology, Focus, Dopamine, Adult Brain Plasticity)
  { q: 'Andrew Huberman how to focus neuroplasticity speech', category: 'essay_deep', mentor: 'Andrew Huberman', tags: ['스탠퍼드교수', '뇌가소성', '집중력최적화', 'Huberman'] },
  { q: 'Andrew Huberman habits to learn faster and retain information', category: 'essay_deep', mentor: 'Andrew Huberman', tags: ['학습메커니즘', '기억력', '과학적공부법', 'Huberman'] },
  { q: 'Andrew Huberman neuroplasticity in adulthood protocol', category: 'sleep_life', mentor: 'Andrew Huberman', tags: ['성인뇌가소성', '심층대담', '뇌과학', 'HubermanLab'] },

  // 3. Cal Newport (MIT PhD / Georgetown Prof - Deep Work & Career Capital for 30s-50s)
  { q: 'Cal Newport Deep Work advice for career mastery speech', category: 'essay_deep', mentor: 'Cal Newport', tags: ['딥워크', '몰입의힘', 'MIT박사', 'CalNewport'] },
  { q: 'Cal Newport Why you should quit social media TEDx', category: 'ted_speech', mentor: 'Cal Newport', tags: ['TEDx', '디지털미니멀리즘', 'CalNewport', '집중력'] },
  { q: 'Cal Newport How to master hard skills fast interview', category: 'news_interview', mentor: 'Cal Newport', tags: ['심층인터뷰', '전문성구축', '커리어자본', 'CalNewport'] },

  // 4. Dr. Carol Dweck (Stanford Psychology - Growth Mindset & Lifelong Learning)
  { q: 'Carol Dweck Developing a Growth Mindset TED talk', category: 'ted_speech', mentor: 'Carol Dweck', tags: ['스탠퍼드심리학', '그로스마인드셋', '평생학습', 'CarolDweck'] },
  { q: 'Carol Dweck The power of believing that you can improve TED', category: 'ted_speech', mentor: 'Carol Dweck', tags: ['TED명강연', '성장마인드셋', '학습동기부여', 'CarolDweck'] },

  // 5. Dr. Maya Shankar (Oxford PhD - Cognitive Science, Identity & Navigating 40+ Transition)
  { q: 'Dr Maya Shankar Why Change Is So Scary TED talk', category: 'ted_speech', mentor: 'Maya Shankar', tags: ['옥스퍼드박사', '인지과학', '인생전환', 'MayaShankar'] },
  { q: 'Dr Maya Shankar How to Handle Change and Reinvent Yourself', category: 'essay_deep', mentor: 'Maya Shankar', tags: ['자기재발견', '인생2막', '회복탄력성', 'MayaShankar'] },
  { q: 'Maya Shankar A Slight Change of Plans science of change', category: 'sleep_life', mentor: 'Maya Shankar', tags: ['심층대담', '과학적마인드셋', '1시간토크', 'MayaShankar'] },

  // 6. Dr. Tara Swart (Neuroscientist, MIT Sloan Lecturer, MD)
  { q: 'Dr Tara Swart How to Rewire Your Brain in Adulthood speech', category: 'essay_deep', mentor: 'Tara Swart', tags: ['MIT신경과학', '40대뇌재설계', '신경가소성', 'TaraSwart'] },
  { q: 'Dr Tara Swart Neuroscientist explains brain health and memory', category: 'essay_deep', mentor: 'Tara Swart', tags: ['뇌건강', '인지력강화', '의학박사', 'TaraSwart'] },

  // 7. Dr. Wendy Suzuki (NYU Neural Science Dean & Professor)
  { q: 'Wendy Suzuki The brain changing benefits of exercise TED', category: 'ted_speech', mentor: 'Wendy Suzuki', tags: ['NYU신경과학', 'TED명강연', '두뇌회춘', 'WendySuzuki'] },
  { q: 'Wendy Suzuki How to transform your anxiety into focus speech', category: 'essay_deep', mentor: 'Wendy Suzuki', tags: ['불안극복', '집중력전환', '뇌과학', 'WendySuzuki'] },

  // 8. Mel Robbins (Reinventing Life at 40+, Breaking Procrastination)
  { q: 'Mel Robbins How to stop screwing yourself over TEDx talk', category: 'ted_speech', mentor: 'Mel Robbins', tags: ['TEDx전설', '40대인생역전', '5초의법칙', 'MelRobbins'] },
  { q: 'Mel Robbins Reinventing your career after 40 speech advice', category: 'essay_deep', mentor: 'Mel Robbins', tags: ['40대커리어', '실행력강화', '인생리셋', 'MelRobbins'] },
  { q: 'Mel Robbins Stop wasting time and start studying full talk', category: 'essay_deep', mentor: 'Mel Robbins', tags: ['시간관리', '공부의길', '자기통제', 'MelRobbins'] },

  // 9. Dr. Ali Abdaal & Scientific Learning Techniques
  { q: 'Ali Abdaal How to Study for Exams Evidence-Based Revision', category: 'essay_deep', mentor: 'Ali Abdaal', tags: ['의대출신공부법', '능동적회상', '간격반복', 'AliAbdaal'] },
  { q: 'Ali Abdaal How to Learn Anything Fast Feynman Technique', category: 'essay_deep', mentor: 'Ali Abdaal', tags: ['파인만테크닉', '학습효율화', '초고속습득', 'AliAbdaal'] },

  // 10. Naval Ravikant & Tim Ferriss (Wisdom, Mental Models & Meta-learning for 40+)
  { q: 'Naval Ravikant How to Build Judgment and Leverage speech', category: 'essay_deep', mentor: 'Naval Ravikant', tags: ['판단력과지혜', '지적레버리지', '현대철학', 'Naval'] },
  { q: 'Tim Ferriss How to Learn Any Skill in Record Time speech', category: 'essay_deep', mentor: 'Tim Ferriss', tags: ['메타러닝', '학습가속화', '스킬획득', 'TimFerriss'] },

  // 11. Dr. Brené Brown & Dr. Susan David (Harvard/Research Professors - Emotional & Intellectual Grit)
  { q: 'Brene Brown The Power of Vulnerability TED talk speech', category: 'ted_speech', mentor: 'Brene Brown', tags: ['TED레전드', '연구교수', '용기와진정성', 'BreneBrown'] },
  { q: 'Susan David The gift and power of emotional courage TED', category: 'ted_speech', mentor: 'Susan David', tags: ['하버드의대', '정서적민첩성', '내면단련', 'SusanDavid'] },

  // 12. Adult Late-Bloomers & Reinvention at 35~50
  { q: 'Why late bloomers succeed late in life Rich Karlgaard speech', category: 'ted_speech', mentor: 'Rich Karlgaard', tags: ['포브스발행인', '대기만성', '35세이후성공', 'LateBloomer'] },
  { q: 'It is never too late to reinvent yourself adult career talk', category: 'essay_deep', mentor: 'Career Reinvention', tags: ['늦깎이공부', '인생2막', '성인동기부여', 'Reinvention'] }
];

async function checkSubtitles(videoId) {
  try {
    const list = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
    return Array.isArray(list) && list.length >= 10;
  } catch (e) {
    try {
      const listAuto = await YoutubeTranscript.fetchTranscript(videoId);
      return Array.isArray(listAuto) && listAuto.length >= 10;
    } catch (e2) {
      return false;
    }
  }
}

function searchYouTubeYtDlp(query, maxResults = 3) {
  try {
    const cmd = `/home/kw/.local/bin/yt-dlp "ytsearch${maxResults}:${query.replace(/"/g, '')}" --dump-single-json --flat-playlist --no-warnings --ignore-errors`;
    const res = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 25000 });
    const data = JSON.parse(res);
    const entries = data.entries || [];
    return entries.map(e => ({
      videoId: e.id,
      title: e.title,
      channelTitle: e.uploader || e.channel || 'YouTube Creator',
      durationSeconds: e.duration || 0,
      url: `https://www.youtube.com/watch?v=${e.id}`,
      thumbnailUrl: `https://img.youtube.com/vi/${e.id}/hqdefault.jpg`
    }));
  } catch (err) {
    console.error('Search error for:', query, err.message);
    return [];
  }
}

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '15:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function run() {
  console.log('🚀 Starting Top-Tier Adult Study & PhD Motivation Curation...');
  const store = JSON.parse(readFileSync(LINKS_FILE, 'utf8'));
  let items = store.items || store;
  const existingIds = new Set(items.map(it => it.videoId));

  let addedCount = 0;

  for (const cfg of QUERIES) {
    console.log(`\n🔍 Searching: ${cfg.q}`);
    const results = searchYouTubeYtDlp(cfg.q, 4);
    for (const r of results) {
      if (!r.videoId || existingIds.has(r.videoId)) {
        continue;
      }

      // Check duration: avoid shorts (< 90 sec)
      if (r.durationSeconds && r.durationSeconds < 90) {
        continue;
      }

      // Verify English transcripts
      const hasSub = await checkSubtitles(r.videoId);
      if (!hasSub) {
        console.log(`  ❌ No English transcript: [${r.videoId}] ${r.title.substring(0, 40)}`);
        continue;
      }

      const durStr = formatDuration(r.durationSeconds);
      const newItem = {
        id: `study_${r.videoId}`,
        videoId: r.videoId,
        title: r.title,
        channelTitle: r.channelTitle,
        description: `${r.title} • ${cfg.mentor} • 35~45+ 지적 성장 & 박사·전문직 공부 동기부여 (${durStr})`,
        thumbnailUrl: r.thumbnailUrl,
        url: r.url,
        duration: durStr,
        category: cfg.category,
        mentor: cfg.mentor,
        language: 'en',
        tags: ['공부동기부여', '성인학습', '지적마인드셋', '3545인생2막', ...cfg.tags],
        source: 'curated_adult_study',
        bookmarked: false,
        addedAt: Date.now()
      };

      items.unshift(newItem);
      existingIds.add(r.videoId);
      addedCount++;
      console.log(`  ✅ Added [${cfg.category}] ${cfg.mentor}: ${r.title.substring(0, 50)} (${durStr})`);
    }
  }

  store.items = items;
  writeFileSync(LINKS_FILE, JSON.stringify(store, null, 2), 'utf8');
  console.log(`\n✨ Successfully added ${addedCount} top-tier adult study motivation videos!`);
  console.log(`📊 Total collection size: ${items.length}`);
}

run();
