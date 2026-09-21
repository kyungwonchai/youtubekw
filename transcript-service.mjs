import { YoutubeTranscript } from 'youtube-transcript';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const CACHE_DIR = '/home/kw/.kwsoft-subtitles-cache';
if (!existsSync(CACHE_DIR)) {
  try { mkdirSync(CACHE_DIR, { recursive: true }); } catch (e) {}
}

const memoryCache = new Map();

/**
 * Translate English text to Korean using Google Translate API
 */
export async function translateEnToKo(text) {
  if (!text || !text.trim()) return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(text.trim())}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return '';
    const data = await res.json();
    return data[0]?.map(x => x[0]).join('') || '';
  } catch (e) {
    return '';
  }
}

/**
 * Batch translate transcript lines quickly (chunks of 40 lines)
 */
export async function batchTranslateLines(lines) {
  const BATCH_SIZE = 40;
  for (let i = 0; i < lines.length; i += BATCH_SIZE) {
    const slice = lines.slice(i, i + BATCH_SIZE);
    const combined = slice.map(l => l.text.replace(/[\r\n]+/g, ' ')).join('\n === \n');
    try {
      const translated = await translateEnToKo(combined);
      if (translated) {
        const transParts = translated.split(/\s*===\s*/);
        slice.forEach((line, idx) => {
          line.translation = (transParts[idx] || '').trim();
        });
      }
    } catch (e) {
      // Fallback
    }
  }
  return lines;
}

/**
 * Fetch and parse YouTube transcript with Korean translations
 */
export async function getTranscriptForVideo(videoId, { autoTranslate = true } = {}) {
  if (!videoId) throw new Error('Video ID is required');

  // Check memory cache
  if (memoryCache.has(videoId)) {
    return memoryCache.get(videoId);
  }

  // Check disk cache
  const cacheFile = path.join(CACHE_DIR, `${videoId}.json`);
  if (existsSync(cacheFile)) {
    try {
      const data = JSON.parse(readFileSync(cacheFile, 'utf8'));
      memoryCache.set(videoId, data);
      return data;
    } catch (e) {}
  }

  let rawList = [];
  try {
    rawList = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
  } catch (errEn) {
    try {
      rawList = await YoutubeTranscript.fetchTranscript(videoId);
    } catch (errFallback) {
      return {
        ok: false,
        videoId,
        error: '자막 데이터를 가져올 수 없거나 자막이 제공되지 않는 영상입니다.',
        lines: []
      };
    }
  }

  if (!rawList || rawList.length === 0) {
    return {
      ok: false,
      videoId,
      error: '제공된 자막 텍스트가 없습니다.',
      lines: []
    };
  }

  const lines = rawList
    .map((item, idx) => {
      const start = item.offset / 1000;
      const dur = item.duration / 1000;
      let text = (item.text || '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        id: `sub_${idx}`,
        index: idx,
        start: Number(start.toFixed(2)),
        end: Number((start + dur).toFixed(2)),
        duration: Number(dur.toFixed(2)),
        text,
        translation: '',
      };
    })
    .filter(l => l.text.length > 0 && !l.text.startsWith('(') && !l.text.startsWith('['));

  // Batch translate to Korean
  if (autoTranslate && lines.length > 0) {
    await batchTranslateLines(lines);
  }

  const result = {
    ok: true,
    videoId,
    totalLines: lines.length,
    lines,
    cachedAt: Date.now(),
  };

  // Save cache
  try {
    writeFileSync(cacheFile, JSON.stringify(result, null, 2), 'utf8');
    memoryCache.set(videoId, result);
  } catch (e) {}

  return result;
}

/**
 * Word dictionary lookup (definition, IPA phonetic, translation)
 */
export async function lookupWord(word) {
  if (!word || !word.trim()) return null;
  const cleanWord = word.toLowerCase().replace(/[^a-z'-]/g, '').trim();
  if (!cleanWord) return null;

  let phonetic = '';
  let meanings = [];
  let koTranslation = '';

  // 1. Google Translate Korean definition
  try {
    koTranslation = await translateEnToKo(cleanWord);
  } catch (e) {}

  // 2. Free Dictionary API for English definition & Phonetics
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        const entry = data[0];
        phonetic = entry.phonetic || entry.phonetics?.find(p => p.text)?.text || '';
        meanings = (entry.meanings || []).slice(0, 3).map(m => ({
          partOfSpeech: m.partOfSpeech,
          definition: m.definitions?.[0]?.definition || '',
          example: m.definitions?.[0]?.example || '',
        }));
      }
    }
  } catch (e) {}

  return {
    word: cleanWord,
    phonetic,
    koTranslation,
    meanings,
  };
}
