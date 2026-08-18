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
} from './youtube-control.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 10149;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Static files for both root / and /youtubekw/
app.use('/', express.static(path.join(__dirname, 'public')));
app.use('/youtubekw', express.static(path.join(__dirname, 'public')));

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
});
