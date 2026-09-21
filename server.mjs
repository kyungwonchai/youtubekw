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

// Static files for both root / and /youtubekw/
app.use('/', express.static(path.join(__dirname, 'public')));
app.use('/youtubekw', express.static(path.join(__dirname, 'public')));

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
