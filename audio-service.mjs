import { spawn } from 'child_process';
import https from 'https';
import http from 'http';

const audioUrlCache = new Map(); // videoId -> { url, expireAt }

/**
 * Extract direct YouTube audio stream URL using yt-dlp
 */
export async function getDirectAudioUrl(videoId, forceRefresh = false) {
  if (!videoId) throw new Error('Video ID is required');

  const now = Date.now();
  if (!forceRefresh && audioUrlCache.has(videoId)) {
    const cached = audioUrlCache.get(videoId);
    if (cached.expireAt > now) {
      return cached.url;
    }
  }

  return new Promise((resolve, reject) => {
    const ytdlpPath = '/home/kw/.local/bin/yt-dlp';
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Request best m4a / mp4 / opus audio format URL
    const proc = spawn(ytdlpPath, [
      '-g',
      '-f', 'ba[ext=m4a]/ba/bestaudio',
      '--no-warnings',
      ytUrl,
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => {
      stdout += data.toString();
    });

    proc.stderr.on('data', data => {
      stderr += data.toString();
    });

    proc.on('close', code => {
      if (code === 0 && stdout.trim()) {
        const directUrl = stdout.trim().split('\n')[0];
        // Cache URL for 3 hours (YouTube URLs typically expire in 6 hours)
        audioUrlCache.set(videoId, {
          url: directUrl,
          expireAt: now + 3 * 60 * 60 * 1000,
        });
        resolve(directUrl);
      } else {
        reject(new Error(stderr.trim() || '오디오 스트림 추출 실패'));
      }
    });

    proc.on('error', err => {
      reject(err);
    });
  });
}

/**
 * Proxy streaming directly with Range support & automatic 403 retry
 */
export async function streamDirectAudio(videoId, req, res) {
  let attempt = 0;

  while (attempt < 2) {
    try {
      const audioUrl = await getDirectAudioUrl(videoId, attempt > 0);
      const urlObj = new URL(audioUrl);
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
      };

      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }

      const client = urlObj.protocol === 'https:' ? https : http;
      
      const success = await new Promise((resolve) => {
        const proxyReq = client.get(audioUrl, { headers }, proxyRes => {
          if (proxyRes.statusCode === 403 || proxyRes.statusCode === 410) {
            audioUrlCache.delete(videoId);
            return resolve(false); // retry with refresh
          }

          const responseHeaders = {
            'Content-Type': proxyRes.headers['content-type'] || 'audio/mp4',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
          };

          if (proxyRes.headers['content-length']) {
            responseHeaders['Content-Length'] = proxyRes.headers['content-length'];
          }
          if (proxyRes.headers['content-range']) {
            responseHeaders['Content-Range'] = proxyRes.headers['content-range'];
          }

          res.writeHead(proxyRes.statusCode || 200, responseHeaders);

          proxyRes.pipe(res);
          proxyRes.on('end', () => resolve(true));
          proxyRes.on('error', () => resolve(false));
        });

        proxyReq.on('error', () => {
          audioUrlCache.delete(videoId);
          resolve(false);
        });
      });

      if (success) return;
    } catch (e) {
      audioUrlCache.delete(videoId);
    }
    attempt++;
  }

  if (!res.headersSent) {
    res.status(500).json({ ok: false, error: '오디오 스트림 연결 실패' });
  }
}

