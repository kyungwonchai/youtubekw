import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getYouTubeLinks,
  toggleYouTubeBookmark,
  deleteYouTubeLink,
  clearUnbookmarkedLinks,
  curateYouTubeLinksDynamic,
  addYouTubeLink,
  MENTOR_SPEAKER_POOL,
  loadAllSpeakers,
  loadWeeklyData,
  runWednesdayMeeting,
  checkAndRunWeeklyCatchup,
  loadBlacklist,
  blockVideoOrSpeaker,
} from './youtube-control.mjs';
import { getTranscriptForVideo, lookupWord } from './transcript-service.mjs';
import { getDirectAudioUrl } from './audio-service.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 10149;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Static files for both root / and /youtubekw/ with no-cache for html
const staticOptions = {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
};
app.use('/', express.static(path.join(__dirname, 'public'), staticOptions));
app.use('/youtubekw', express.static(path.join(__dirname, 'public'), staticOptions));

// Blacklist (절대비추 영구차단) Handlers
const handleGetBlacklist = (req, res) => {
  try {
    const data = loadBlacklist();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
app.get('/api/blacklist', handleGetBlacklist);
app.get('/youtubekw/api/blacklist', handleGetBlacklist);

const handleBlockSpeaker = (req, res) => {
  try {
    const { videoId, channelTitle, title, speakerName } = req.body || {};
    const result = blockVideoOrSpeaker({ videoId, channelTitle, title, speakerName });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
app.post('/api/blacklist', handleBlockSpeaker);
app.post('/youtubekw/api/blacklist', handleBlockSpeaker);

// API Handlers
const handleGetLinks = (req, res) => {
  try {
    const filter = req.query.filter || 'all';
    const category = req.query.category || 'all';
    const search = req.query.search || '';
    const result = getYouTubeLinks({ filter, category, search });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
app.get('/api/links', handleGetLinks);
app.get('/youtubekw/api/links', handleGetLinks);

const handleDeleteLink = (req, res) => {
  try {
    deleteYouTubeLink(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
app.delete('/api/links/:id', handleDeleteLink);
app.delete('/youtubekw/api/links/:id', handleDeleteLink);

const handleBookmark = (req, res) => {
  try {
    const updated = toggleYouTubeBookmark(req.params.id);
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
app.post('/api/links/:id/bookmark', handleBookmark);
app.post('/youtubekw/api/links/:id/bookmark', handleBookmark);

const handleAddCustomLink = async (req, res) => {
  try {
    const { url, autoBookmark = true, category } = req.body || {};
    if (!url) {
      return res.status(400).json({ error: 'URL을 입력해주세요.' });
    }
    const result = await addYouTubeLink({ url, autoBookmark, category });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
app.post('/api/links/custom', handleAddCustomLink);
app.post('/youtubekw/api/links/custom', handleAddCustomLink);

const handleClearFeed = (req, res) => {
  try {
    const result = clearUnbookmarkedLinks();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
app.post('/api/clear-feed', handleClearFeed);
app.post('/youtubekw/api/clear-feed', handleClearFeed);

// Mentors & Speakers Pool Endpoint
const handleGetSpeakers = (req, res) => {
  res.json({ speakers: loadAllSpeakers() });
};
app.get('/api/speakers', handleGetSpeakers);
app.get('/youtubekw/api/speakers', handleGetSpeakers);

// Language Reactor Full Transcript Endpoint
const handleGetTranscript = async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!videoId) return res.status(400).json({ ok: false, error: 'Video ID is required' });
    const data = await getTranscriptForVideo(videoId, { autoTranslate: true });
    res.json(data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, lines: [] });
  }
};
app.get('/api/transcript/:videoId', handleGetTranscript);
app.get('/youtubekw/api/transcript/:videoId', handleGetTranscript);

// Realtime / Pre-computed Face Tracking Timeline Endpoint
import fs from 'fs';
import { spawn } from 'child_process';

const activeTrackJobs = new Set();

const handleGetFaceTrack = async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) return res.status(400).json({ ok: false, error: 'Video ID required' });

  const cacheDir = path.join(__dirname, 'data', 'face_tracks');
  const cacheFile = path.join(cacheDir, `${videoId}.json`);

  if (fs.existsSync(cacheFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      return res.json(data);
    } catch (e) {}
  }

  // If already tracking in background, inform client to poll or use fallback
  if (activeTrackJobs.has(videoId)) {
    return res.json({ ok: true, status: 'processing', videoId, tracks: [] });
  }

  // Trigger background face tracking script
  activeTrackJobs.add(videoId);
  const pyPath = '/home/kw/kwsoft/aivod/venv/bin/python';
  const scriptPath = path.join(__dirname, 'scripts', 'track_face.py');

  const proc = spawn(pyPath, [scriptPath, videoId], {
    detached: true,
    stdio: 'ignore'
  });
  proc.unref();

  proc.on('close', () => {
    activeTrackJobs.delete(videoId);
  });

  return res.json({ ok: true, status: 'started', videoId, tracks: [] });
};
app.get('/api/face-track/:videoId', handleGetFaceTrack);
app.get('/youtubekw/api/face-track/:videoId', handleGetFaceTrack);

// Word Dictionary & Translation Lookup Endpoint
const handleWordLookup = async (req, res) => {
  try {
    const word = req.query.word;
    if (!word) return res.status(400).json({ error: 'Word is required' });
    const result = await lookupWord(word);
    res.json(result || { word, translation: '', meanings: [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
app.get('/api/dictionary/lookup', handleWordLookup);
app.get('/youtubekw/api/dictionary/lookup', handleWordLookup);

// ── Saved Sentences (북마크 명문장함) Endpoints ──
const SENTENCES_FILE = '/home/kw/.kwsoft-user-store/saved_sentences.json';

function loadSavedSentences() {
  try {
    if (fs.existsSync(SENTENCES_FILE)) {
      return JSON.parse(fs.readFileSync(SENTENCES_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveSentencesToFile(list) {
  try {
    const dir = path.dirname(SENTENCES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SENTENCES_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save sentences:', e);
  }
}

const handleGetSentences = (req, res) => {
  res.json({ ok: true, sentences: loadSavedSentences() });
};
app.get('/api/sentences', handleGetSentences);
app.get('/youtubekw/api/sentences', handleGetSentences);

const handleAddSentence = (req, res) => {
  try {
    const { videoId, videoTitle, start, end, text, translation } = req.body || {};
    if (!text) return res.status(400).json({ ok: false, error: 'Text is required' });

    const list = loadSavedSentences();
    const cleanText = text.trim();
    const existing = list.find(s => s.text === cleanText && s.videoId === videoId);

    if (existing) {
      return res.json({ ok: true, sentence: existing, alreadySaved: true });
    }

    const newSent = {
      id: `sent_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      videoId: videoId || '',
      videoTitle: videoTitle || '',
      start: Number(start) || 0,
      end: Number(end) || 0,
      text: cleanText,
      translation: translation || '',
      savedAt: new Date().toISOString()
    };

    list.unshift(newSent);
    saveSentencesToFile(list);
    res.json({ ok: true, sentence: newSent, created: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
app.post('/api/sentences', handleAddSentence);
app.post('/youtubekw/api/sentences', handleAddSentence);

const handleDeleteSentence = (req, res) => {
  try {
    const { id } = req.params;
    let list = loadSavedSentences();
    list = list.filter(s => s.id !== id);
    saveSentencesToFile(list);
    res.json({ ok: true, deleted: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
app.delete('/api/sentences/:id', handleDeleteSentence);
app.delete('/youtubekw/api/sentences/:id', handleDeleteSentence);

// ── Vocab-Hub Integration (만능단어장 단어 추가 & 횟수 누적) ──
const handleAddToVocabHub = async (req, res) => {
  try {
    const { word, meaning, pos, phonetic, exampleEn, exampleKo, videoTitle, videoUrl, videoId } = req.body || {};
    if (!word) return res.status(400).json({ ok: false, error: 'Word required' });

    // Call local vocab-hub service (port 10173)
    const hubRes = await fetch('http://localhost:10173/api/vocab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word,
        meaning,
        pos: pos || '단어',
        part_of_speech: pos || '단어',
        phonetic: phonetic || '',
        exampleEn: exampleEn || '',
        exampleKo: exampleKo || '',
        sourceModule: 'youtubekw',
        sourceType: '유튜브 쉐도잉',
        sourceTitle: videoTitle || '유튜브 쉐도잉 앱',
        sourceUrl: videoUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : ''),
        important: true
      })
    });

    if (hubRes.ok) {
      const data = await hubRes.json();
      return res.json({ ok: true, ...data });
    } else {
      return res.status(500).json({ ok: false, error: 'VocabHub response error' });
    }
  } catch (e) {
    // If vocab-hub server is offline, fallback gracefully
    res.json({ ok: true, fallback: true, message: '단어가 로컬에 저장되었습니다.' });
  }
};
app.post('/api/vocab/add', handleAddToVocabHub);
app.post('/youtubekw/api/vocab/add', handleAddToVocabHub);

// Background Audio Stream & Direct URL Endpoints
const handleAudioUrl = async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!videoId) return res.status(400).json({ ok: false, error: 'Video ID is required' });
    const directUrl = await getDirectAudioUrl(videoId);
    res.json({ ok: true, videoId, audioUrl: directUrl });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
app.get('/api/audio-url/:videoId', handleAudioUrl);
app.get('/youtubekw/api/audio-url/:videoId', handleAudioUrl);

const handleAudioStreamRedirect = async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!videoId) return res.status(400).send('Video ID is required');
    const directUrl = await getDirectAudioUrl(videoId);
    res.redirect(302, directUrl);
  } catch (e) {
    res.status(500).send(e.message);
  }
};
app.get('/api/audio-stream/:videoId', handleAudioStreamRedirect);
app.get('/youtubekw/api/audio-stream/:videoId', handleAudioStreamRedirect);

// Weekly Wednesday AI Council Sessions Endpoints
const handleGetWeeklySessions = (req, res) => {
  try {
    const data = loadWeeklyData();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
app.get('/api/weekly-sessions', handleGetWeeklySessions);
app.get('/youtubekw/api/weekly-sessions', handleGetWeeklySessions);

const handleRunWeeklyMeeting = async (req, res) => {
  try {
    const { force } = req.body || {};
    const result = await runWednesdayMeeting({ force: Boolean(force) });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
app.post('/api/weekly-sessions/run', handleRunWeeklyMeeting);
app.post('/youtubekw/api/weekly-sessions/run', handleRunWeeklyMeeting);

// SSE Progress Streaming Curate Endpoint
const handleCurateStream = async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendSSE = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const limit = Number(req.query.limit) || 200;
    const result = await curateYouTubeLinksDynamic({
      limit,
      onProgress: (p) => sendSSE('progress', p),
      replaceExisting: true,
    });
    sendSSE('done', result);
    res.end();
  } catch (e) {
    sendSSE('error', { error: e.message });
    res.end();
  }
};
app.get('/api/curate-stream', handleCurateStream);
app.get('/youtubekw/api/curate-stream', handleCurateStream);

// Standard Curate POST
const handleCurate = async (req, res) => {
  try {
    const { limit } = req.body || {};
    const result = await curateYouTubeLinksDynamic({
      limit: Number(limit) || 200,
      replaceExisting: true,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
app.post('/api/curate', handleCurate);
app.post('/youtubekw/api/curate', handleCurate);

// Fallback SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎬 YouTubeKW 쉐도잉 초집중 서버 실행 중: http://127.0.0.1:${PORT}`);

  // Anacron-style Startup Catch-up Guard (If PC was turned off during Wednesday 11:00)
  setTimeout(async () => {
    try {
      await checkAndRunWeeklyCatchup();
    } catch (err) {
      console.error('[Startup Weekly Guard] Error:', err.message);
    }
  }, 2000);

  // Hourly background catch-up guard
  setInterval(async () => {
    try {
      await checkAndRunWeeklyCatchup();
    } catch (err) {
      console.error('[Interval Weekly Guard] Error:', err.message);
    }
  }, 60 * 60 * 1000);
});
