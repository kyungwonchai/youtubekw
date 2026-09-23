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

// ── Instant Local Master Vocab DB Index (99,364 words with IPA & Korean) ──
let localVocabMap = null;

function getLocalVocabMap() {
  if (localVocabMap) return localVocabMap;
  localVocabMap = new Map();
  const dbPaths = [
    '/home/kw/.kwsoft-user-store/vocab-master.json',
    '/home/kw/kwsoft/vocab-hub/data/vocab.json'
  ];

  for (const p of dbPaths) {
    if (existsSync(p)) {
      try {
        const raw = JSON.parse(readFileSync(p, 'utf8'));
        const words = Array.isArray(raw) ? raw : (raw.words || []);
        for (const item of words) {
          const w = (item.word || item.eng || '').toLowerCase().trim();
          if (w && !localVocabMap.has(w)) {
            localVocabMap.set(w, {
              word: item.word || item.eng,
              phonetic: item.phonetic || item.ipa || '',
              koTranslation: item.meaning || item.kor || '',
              pos: item.pos || item.part_of_speech || '',
              exampleEn: item.exampleEn || item.example || '',
              exampleKo: item.exampleKo || '',
              source: 'master_db'
            });
          }
        }
        break;
      } catch (e) {
        console.warn('Failed to parse vocab db:', p, e.message);
      }
    }
  }
  return localVocabMap;
}

const wordCache = new Map();

/**
 * Word dictionary lookup (definition, IPA phonetic, translation, POS) - 0ms instant local DB + Fallback
 */
export async function lookupWord(word) {
  if (!word || !word.trim()) return null;
  const cleanWord = word.toLowerCase().replace(/[^a-z'-]/g, '').trim();
  if (!cleanWord) return null;

  if (wordCache.has(cleanWord)) {
    return wordCache.get(cleanWord);
  }

  // 1. Check instant local master DB (0ms response with full IPA)
  const map = getLocalVocabMap();
  const localMatch = map.get(cleanWord);

  let phonetic = localMatch?.phonetic || '';
  let koTranslation = localMatch?.koTranslation || '';
  let meanings = [];
  let pos = localMatch?.pos || '';

  if (localMatch && koTranslation && phonetic) {
    const result = {
      word: cleanWord,
      phonetic,
      koTranslation,
      pos,
      exampleEn: localMatch.exampleEn || '',
      exampleKo: localMatch.exampleKo || '',
      meanings: [{
        partOfSpeech: pos,
        definition: koTranslation,
        example: localMatch.exampleEn || ''
      }]
    };
    wordCache.set(cleanWord, result);
    return result;
  }

  // 2. Fallback: Parallel fetch Free Dictionary API + Google Translate
  const [dictRes, transKo] = await Promise.allSettled([
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`, { signal: AbortSignal.timeout(2500) })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null),
    koTranslation ? Promise.resolve(koTranslation) : translateEnToKo(cleanWord).catch(() => '')
  ]);

  if (transKo.status === 'fulfilled' && transKo.value) {
    koTranslation = transKo.value;
  }

  if (dictRes.status === 'fulfilled' && dictRes.value && Array.isArray(dictRes.value) && dictRes.value[0]) {
    const entry = dictRes.value[0];
    if (!phonetic) {
      phonetic = entry.phonetic || entry.phonetics?.find(p => p.text)?.text || '';
    }
    meanings = (entry.meanings || []).slice(0, 3).map(m => ({
      partOfSpeech: m.partOfSpeech || '',
      definition: m.definitions?.[0]?.definition || '',
      example: m.definitions?.[0]?.example || '',
    }));
    if (!pos && meanings[0]?.partOfSpeech) {
      pos = meanings[0].partOfSpeech;
    }
  }

  const finalResult = {
    word: cleanWord,
    phonetic,
    koTranslation: koTranslation || '뜻을 찾을 수 없습니다.',
    pos: pos || '단어',
    exampleEn: localMatch?.exampleEn || meanings[0]?.example || '',
    exampleKo: localMatch?.exampleKo || '',
    meanings: meanings.length > 0 ? meanings : [{
      partOfSpeech: pos || '단어',
      definition: koTranslation,
      example: ''
    }]
  };

  wordCache.set(cleanWord, finalResult);
  return finalResult;
}
