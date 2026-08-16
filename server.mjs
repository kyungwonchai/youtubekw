import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getYouTubeLinks,
  addYouTubeLink,
  updateYouTubeLink,
  deleteYouTubeLink,
  toggleYouTubeBookmark,
  clearUnbookmarkedLinks,
  curateYouTubeLinks,
} from './youtube-control.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 10149;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Static files for both root / and /youtubekw/
app.use('/', express.static(path.join(__dirname, 'public')));
app.use('/youtubekw', express.static(path.join(__dirname, 'public')));

// API Handlers (supporting both /api/... and /youtubekw/api/...)
const handleGetLinks = (req, res) => {
  try {
    const filter = req.query.filter || 'all';
    const category = req.query.category || 'all';
    const channelPreset = req.query.channelPreset || 'all';
    const search = req.query.search || '';
    const result = getYouTubeLinks({ filter, category, channelPreset, search });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
app.get('/api/links', handleGetLinks);
app.get('/youtubekw/api/links', handleGetLinks);

const handleAddLink = (req, res) => {
  try {
    const newItem = addYouTubeLink(req.body);
    res.json(newItem);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
app.post('/api/links', handleAddLink);
app.post('/youtubekw/api/links', handleAddLink);

const handleUpdateLink = (req, res) => {
  try {
    const updated = updateYouTubeLink(req.params.id, req.body);
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
app.put('/api/links/:id', handleUpdateLink);
app.put('/youtubekw/api/links/:id', handleUpdateLink);

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

const handleCurate = async (req, res) => {
  try {
    const { channelPresetId, channelPresetIds, query, limit, replaceExisting } = req.body || {};
    const result = await curateYouTubeLinks({
      channelPresetId,
      channelPresetIds,
      query,
      limit: Number(limit) || 30,
      replaceExisting: replaceExisting !== false,
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
  console.log(`🎬 YouTubeKW 독립 앱 실행 중: http://127.0.0.1:${PORT}`);
});
