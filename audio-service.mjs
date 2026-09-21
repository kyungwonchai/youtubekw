import { spawn } from 'child_process';
import path from 'path';

const audioUrlCache = new Map(); // videoId -> { url, expireAt }

/**
 * Extract direct YouTube audio stream URL using yt-dlp
 */
export async function getDirectAudioUrl(videoId) {
  if (!videoId) throw new Error('Video ID is required');

  const now = Date.now();
  if (audioUrlCache.has(videoId)) {
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
      '-f', 'ba[ext=m4a]/ba',
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
        // Cache URL for 4 hours (YouTube URLs typically expire in 6 hours)
        audioUrlCache.set(videoId, {
          url: directUrl,
          expireAt: now + 4 * 60 * 60 * 1000,
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
