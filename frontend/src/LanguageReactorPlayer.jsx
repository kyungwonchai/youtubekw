import React, { useState, useEffect, useRef, useMemo } from 'react';
import './LanguageReactorPlayer.css';

const API_BASE = window.location.pathname.startsWith('/youtubekw') ? '/youtubekw/api' : '/api';

export default function LanguageReactorPlayer({ video, onClose, onToggleBookmark }) {
  const [player, setPlayer] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Font scale mode (1.0x ~ 2.0x in 0.1 steps)
  const [fontScale, setFontScale] = useState(() => {
    try {
      const saved = localStorage.getItem('ytkw_font_scale');
      return saved ? Math.min(2.0, Math.max(1.0, Math.round(parseFloat(saved) * 10) / 10)) : 1.0;
    } catch (e) {
      return 1.0;
    }
  });

  // Playback rate (0.60x ~ 2.0x with 0.05 increments)
  const [playbackRate, setPlaybackRate] = useState(() => {
    try {
      const saved = localStorage.getItem('ytkw_playback_rate');
      return saved ? Math.min(2.0, Math.max(0.6, parseFloat(saved))) : 1.0;
    } catch (e) {
      return 1.0;
    }
  });

  const handleFontScaleChange = (scale) => {
    const clamped = Math.min(2.0, Math.max(1.0, Math.round(scale * 10) / 10));
    setFontScale(clamped);
    try {
      localStorage.setItem('ytkw_font_scale', clamped.toString());
    } catch (e) {}
  };

  const handleFontScaleCycle = () => {
    const scales = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0];
    const nextIdx = (scales.findIndex(s => Math.abs(s - fontScale) < 0.05) + 1) % scales.length;
    handleFontScaleChange(scales[nextIdx]);
  };

  const handleFontWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleFontScaleChange(fontScale + 0.1);
    } else if (e.deltaY > 0) {
      handleFontScaleChange(fontScale - 0.1);
    }
  };
  
  // Video Layout Mode: 'compact' (콤팩트 20%), 'expanded' (영상확대 50%), 'text_only' (영상없이 100% 텍스트만)
  const [videoLayout, setVideoLayout] = useState(() => {
    try {
      const saved = localStorage.getItem('ytkw_video_layout');
      return saved || 'compact'; // 'compact', 'expanded', 'text_only'
    } catch (e) {
      return 'compact';
    }
  });

  const handleVideoLayoutChange = (mode) => {
    setVideoLayout(mode);
    try {
      localStorage.setItem('ytkw_video_layout', mode);
    } catch (e) {}
  };

  const handleCycleVideoLayout = () => {
    if (videoLayout === 'compact') handleVideoLayoutChange('text_only');
    else if (videoLayout === 'text_only') handleVideoLayoutChange('expanded');
    else handleVideoLayoutChange('compact');
  };

  // Background Audio Mode (화면 꺼짐 / 잠금화면 1~2시간 연속 재생 모드)
  const [bgAudioMode, setBgAudioMode] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(false);

  // Settings dropdown popup toggle
  const [showSettings, setShowSettings] = useState(false);

  // Language Reactor POS (품사별) Color Highlight Mode
  const [posHighlight, setPosHighlight] = useState(() => {
    try {
      const saved = localStorage.getItem('ytkw_pos_highlight');
      return saved !== null ? saved === 'true' : true;
    } catch (e) {
      return true;
    }
  });

  // Active Subtitle Line Border Theme Color ('sky', 'green', 'purple', 'gold', 'coral', 'pink')
  const [activeBorderColor, setActiveBorderColor] = useState(() => {
    try {
      const saved = localStorage.getItem('ytkw_active_border_color');
      return saved || 'sky';
    } catch (e) {
      return 'sky';
    }
  });

  const handleBorderColorChange = (colorKey) => {
    setActiveBorderColor(colorKey);
    try {
      localStorage.setItem('ytkw_active_border_color', colorKey);
    } catch (e) {}
  };

  // Saved Sentences Drawer State (좋은 명문장 별도 저장함)
  const [savedSentences, setSavedSentences] = useState([]);
  const [showSentencesDrawer, setShowSentencesDrawer] = useState(false);
  const [savingSentence, setSavingSentence] = useState(false);

  // Word Frequencies in Vocab-Hub Map
  const [wordFrequencies, setWordFrequencies] = useState(() => {
    try {
      const saved = localStorage.getItem('ytkw_word_freq');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [addingToVocab, setAddingToVocab] = useState(false);
  const [vocabToast, setVocabToast] = useState(null);

  // Subtitles state
  const [transcript, setTranscript] = useState([]);
  const [loadingTranscript, setLoadingTranscript] = useState(true);
  const [transcriptError, setTranscriptError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);

  // Language Reactor Modes (자막 표시 모드: 듀얼, 영문만, 한글만, 블라인드)
  const [displayMode, setDisplayMode] = useState(() => {
    try {
      const saved = localStorage.getItem('ytkw_display_mode');
      return saved || 'dual';
    } catch (e) {
      return 'dual';
    }
  });

  const handleDisplayModeChange = (mode) => {
    setDisplayMode(mode);
    try {
      localStorage.setItem('ytkw_display_mode', mode);
    } catch (e) {}
  };

  const handleCycleDisplayMode = () => {
    const modes = ['dual', 'en_only', 'ko_only', 'blind'];
    const nextIdx = (modes.indexOf(displayMode) + 1) % modes.length;
    handleDisplayModeChange(modes[nextIdx]);
  };

  const [loopMode, setLoopMode] = useState('none'); // 'none', 'single_loop', 'pause_after_sentence'
  const [loopingIndex, setLoopingIndex] = useState(null);

  // Word Dictionary Popup
  const [dictWord, setDictWord] = useState(null);
  const [dictPos, setDictPos] = useState({ x: 0, y: 0 });

  const activeLineRef = useRef(null);
  const subtitleListRef = useRef(null);
  const timeUpdateInterval = useRef(null);
  const audioRef = useRef(null);

  const showVocabToast = (msg, type = 'info') => {
    setVocabToast({ msg, type });
    setTimeout(() => setVocabToast(null), 3000);
  };

  // Fetch saved sentences on mount
  useEffect(() => {
    fetch(`${API_BASE}/sentences`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && Array.isArray(data.sentences)) {
          setSavedSentences(data.sentences);
        }
      })
      .catch(() => {});
  }, []);

  const handleTogglePosHighlight = () => {
    const next = !posHighlight;
    setPosHighlight(next);
    try {
      localStorage.setItem('ytkw_pos_highlight', String(next));
    } catch (e) {}
  };

  // 1. Fetch transcript from backend
  useEffect(() => {
    let isMounted = true;
    setLoadingTranscript(true);
    setTranscriptError(null);

    fetch(`${API_BASE}/transcript/${video.videoId}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data.ok && Array.isArray(data.lines) && data.lines.length > 0) {
          setTranscript(data.lines);
        } else {
          setTranscriptError(data.error || '이 영상은 자막 데이터를 지원하지 않습니다.');
        }
      })
      .catch(err => {
        if (isMounted) setTranscriptError(err.message || '자막을 불러오는데 실패했습니다.');
      })
      .finally(() => {
        if (isMounted) setLoadingTranscript(false);
      });

    return () => { isMounted = false; };
  }, [video.videoId]);

  // 2. Fetch direct audio URL for background playback
  const fetchAudioUrl = async () => {
    if (audioUrl) return audioUrl;
    setLoadingAudio(true);
    try {
      const res = await fetch(`${API_BASE}/audio-url/${video.videoId}`);
      const data = await res.json();
      if (data.ok && data.audioUrl) {
        setAudioUrl(data.audioUrl);
        return data.audioUrl;
      }
    } catch (e) {
      console.error('[Audio] Fetch audio url error:', e);
    } finally {
      setLoadingAudio(false);
    }
    return null;
  };

  // 3. Initialize YouTube IFrame API
  useEffect(() => {
    let ytPlayer = null;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return;
      ytPlayer = new window.YT.Player('lr-yt-embed', {
        videoId: video.videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            setPlayer(event.target);
            setPlayerReady(true);
            setDuration(event.target.getDuration() || 0);
            if (playbackRate !== 1) {
              try { event.target.setPlaybackRate(playbackRate); } catch (e) {}
            }
            if (!bgAudioMode) event.target.playVideo();
          },
          onStateChange: (event) => {
            if (event.data === 1) {
              setIsPlaying(true);
            } else {
              setIsPlaying(false);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      window.onYouTubeIframeAPIReady = () => initPlayer();
      document.body.appendChild(tag);
    }

    return () => {
      if (ytPlayer && ytPlayer.destroy) {
        try { ytPlayer.destroy(); } catch (e) {}
      }
    };
  }, [video.videoId]);

  // 4. Time polling loop (100ms) for high-precision subtitle sync & loop handling
  useEffect(() => {
    timeUpdateInterval.current = setInterval(() => {
      try {
        let t = 0;
        if (bgAudioMode && audioRef.current) {
          t = audioRef.current.currentTime || 0;
        } else if (playerReady && player && typeof player.getCurrentTime === 'function') {
          t = player.getCurrentTime() || 0;
        }

        if (typeof t === 'number') {
          setCurrentTime(t);

          if (transcript.length > 0) {
            const idx = transcript.findIndex(line => t >= line.start && t < line.end + 0.3);
            if (idx !== -1 && idx !== activeIndex) {
              setActiveIndex(idx);

              if (loopMode === 'pause_after_sentence' && loopingIndex !== null && idx > loopingIndex) {
                if (bgAudioMode && audioRef.current) audioRef.current.pause();
                else if (player) player.pauseVideo();
                setLoopingIndex(null);
              }
            }

            if (loopMode === 'single_loop' && loopingIndex !== null) {
              const curLine = transcript[loopingIndex];
              if (curLine && t >= curLine.end) {
                handleSeekTo(curLine.start, loopingIndex);
              }
            }
          }
        }
      } catch (e) {}
    }, 100);

    return () => {
      if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
    };
  }, [playerReady, player, bgAudioMode, transcript, activeIndex, loopMode, loopingIndex]);

  // 5. MediaSession API integration (Galaxy Lockscreen & AOD & Notifications Control)
  useEffect(() => {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: video.title || 'YouTube Shadowing',
          artist: video.channelTitle || 'KW Shadowing Studio',
          album: 'Language Reactor 백그라운드 쉐도잉',
          artwork: [
            { src: video.thumbnailUrl || 'https://img.youtube.com/vi/' + video.videoId + '/hqdefault.jpg', sizes: '512x512', type: 'image/jpeg' }
          ]
        });

        navigator.mediaSession.setActionHandler('play', () => {
          if (bgAudioMode && audioRef.current) {
            audioRef.current.play();
            setIsPlaying(true);
          } else if (player) {
            player.playVideo();
          }
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          if (bgAudioMode && audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
          } else if (player) {
            player.pauseVideo();
          }
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
          const prev = Math.max(0, activeIndex - 1);
          if (transcript[prev]) handleSeekTo(transcript[prev].start, prev);
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
          const next = Math.min(transcript.length - 1, activeIndex + 1);
          if (transcript[next]) handleSeekTo(transcript[next].start, next);
        });

        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const skipTime = details.seekOffset || 10;
          handleSeekTo(Math.max(0, currentTime - skipTime));
        });

        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const skipTime = details.seekOffset || 10;
          handleSeekTo(Math.min(duration || 99999, currentTime + skipTime));
        });

        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined) {
            handleSeekTo(details.seekTime);
          }
        });
      } catch (e) {}
    }
  }, [video, bgAudioMode, player, activeIndex, transcript, currentTime, duration]);

  // 6. Toggle Background Audio Mode
  const handleToggleBgAudio = async () => {
    if (!bgAudioMode) {
      // Switch to background audio mode
      const curTime = player && typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : currentTime;
      if (player && typeof player.pauseVideo === 'function') {
        player.pauseVideo();
      }

      let url = audioUrl;
      if (!url) {
        url = await fetchAudioUrl();
      }

      if (url && audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.currentTime = curTime;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.play().then(() => {
          setIsPlaying(true);
          setBgAudioMode(true);
        }).catch(err => {
          console.warn('Audio play error:', err);
          setBgAudioMode(true);
        });
      } else {
        setBgAudioMode(true);
      }
    } else {
      // Switch back to video mode
      const curTime = audioRef.current ? audioRef.current.currentTime : currentTime;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setBgAudioMode(false);
      if (player && typeof player.seekTo === 'function') {
        player.seekTo(curTime, true);
        player.setPlaybackRate(playbackRate);
        player.playVideo();
      }
    }
  };

  // 7. Auto scroll active subtitle into center stably
  const lastScrolledIndex = useRef(-1);

  useEffect(() => {
    if (!autoScroll || activeIndex === -1) return;
    if (lastScrolledIndex.current === activeIndex) return;

    if (activeLineRef.current && subtitleListRef.current) {
      lastScrolledIndex.current = activeIndex;
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  }, [activeIndex, autoScroll]);

  // 8. Jump to subtitle timestamp & play
  const handleSeekTo = (startTime, index = null, shouldPlay = true) => {
    if (index !== null) {
      setActiveIndex(index);
      lastScrolledIndex.current = -1; // Force immediate scroll centering on click
      if (loopMode === 'single_loop' && loopingIndex !== index) {
        setLoopingIndex(index);
      }
    }
    if (bgAudioMode && audioRef.current) {
      audioRef.current.currentTime = startTime;
      if (shouldPlay) {
        audioRef.current.play();
        setIsPlaying(true);
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    } else if (player && typeof player.seekTo === 'function') {
      player.seekTo(startTime, true);
      if (shouldPlay) {
        player.playVideo();
        setIsPlaying(true);
      } else {
        player.pauseVideo();
        setIsPlaying(false);
      }
    }
  };

  // 8-1. Toggle Play/Pause on specific sentence (재생 중이면 일시정지, 멈춰있으면 해당 문장 재생)
  const handleLinePlayPause = (line, index, e) => {
    if (e) e.stopPropagation();
    if (activeIndex === index && isPlaying) {
      // Pause
      if (bgAudioMode && audioRef.current) audioRef.current.pause();
      else if (player && typeof player.pauseVideo === 'function') player.pauseVideo();
      setIsPlaying(false);
    } else {
      // Play
      handleSeekTo(line.start, index, true);
    }
  };

  // 9. Sentence Loop Toggle (그 문장만 무한 반복하거나 풀기)
  const handleToggleLineLoop = (index, e) => {
    if (e) e.stopPropagation();
    if (loopMode === 'single_loop' && loopingIndex === index) {
      // Loop OFF: 해제하고 일반 연속 재생 모드로 복귀
      setLoopMode('none');
      setLoopingIndex(null);
      showVocabToast('반복 재생이 해제되었습니다 (연속 재생)', 'info');
    } else {
      // Loop ON: 해당 문장만 무한 반복
      setLoopMode('single_loop');
      setLoopingIndex(index);
      handleSeekTo(transcript[index].start, index, true);
      showVocabToast('🔁 이 문장 무한반복 재생 켜짐', 'success');
    }
  };

  // 10. Change Playback Speed (Min 0.60x, 0.05 step)
  const handleRateChange = (rate) => {
    const clampedRate = Math.min(2.0, Math.max(0.6, Math.round(rate * 100) / 100));
    if (bgAudioMode && audioRef.current) {
      audioRef.current.playbackRate = clampedRate;
    } else if (player && typeof player.setPlaybackRate === 'function') {
      try {
        player.setPlaybackRate(clampedRate);
      } catch (e) {}
    }
    setPlaybackRate(clampedRate);
    try {
      localStorage.setItem('ytkw_playback_rate', clampedRate.toString());
    } catch (e) {}
  };

  const handleStepRate = (delta) => {
    const nextRate = Math.round((playbackRate + delta) * 100) / 100;
    handleRateChange(nextRate);
  };

  // ── POS Classifier (Language Reactor Style) ──
  const POS_PRONOUNS = useMemo(() => new Set([
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
    'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'themselves',
    'this', 'that', 'these', 'those', 'who', 'whom', 'whose', 'which', 'what', 'whatever', 'whoever'
  ]), []);

  const POS_PREPOSITIONS = useMemo(() => new Set([
    'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'of', 'off',
    'over', 'under', 'and', 'but', 'or', 'nor', 'so', 'yet', 'because', 'although', 'since',
    'unless', 'while', 'where', 'when', 'if', 'than', 'as', 'out', 'into'
  ]), []);

  const POS_ADJECTIVES = useMemo(() => new Set([
    'good', 'great', 'new', 'first', 'last', 'long', 'great', 'little', 'own', 'other',
    'old', 'right', 'big', 'high', 'different', 'small', 'large', 'next', 'early', 'young',
    'important', 'few', 'public', 'bad', 'same', 'able', 'best', 'better', 'hard', 'real',
    'simple', 'true', 'strong', 'free', 'special', 'clear', 'full', 'easy', 'deep', 'sure',
    'human', 'local', 'general', 'specific', 'major', 'economic', 'happy', 'ready', 'open'
  ]), []);

  const POS_VERBS = useMemo(() => new Set([
    'be', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'having',
    'do', 'does', 'did', 'done', 'doing', 'can', 'could', 'will', 'would', 'shall', 'should',
    'may', 'might', 'must', 'make', 'makes', 'made', 'take', 'takes', 'took', 'taken',
    'get', 'gets', 'got', 'gotten', 'go', 'goes', 'went', 'gone', 'come', 'comes', 'came',
    'know', 'knows', 'knew', 'known', 'see', 'sees', 'saw', 'seen', 'think', 'thinks', 'thought',
    'say', 'says', 'said', 'tell', 'tells', 'told', 'look', 'looks', 'looked', 'find', 'finds', 'found',
    'give', 'gives', 'gave', 'given', 'work', 'works', 'worked', 'call', 'calls', 'called',
    'try', 'tries', 'tried', 'ask', 'asks', 'asked', 'feel', 'feels', 'felt', 'become', 'becomes', 'became',
    'leave', 'leaves', 'left', 'put', 'puts', 'mean', 'means', 'meant', 'keep', 'keeps', 'kept',
    'let', 'lets', 'begin', 'begins', 'began', 'begun', 'seem', 'seems', 'seemed', 'help', 'helps', 'helped',
    'talk', 'talks', 'talked', 'turn', 'turns', 'turned', 'start', 'starts', 'started', 'show', 'shows', 'showed', 'shown',
    'hear', 'hears', 'heard', 'play', 'plays', 'played', 'run', 'runs', 'ran', 'move', 'moves', 'moved',
    'like', 'likes', 'liked', 'live', 'lives', 'lived', 'believe', 'believes', 'believed', 'hold', 'holds', 'held',
    'bring', 'brings', 'brought', 'happen', 'happens', 'happened', 'write', 'writes', 'wrote', 'written',
    'provide', 'provides', 'provided', 'sit', 'sits', 'sat', 'stand', 'stands', 'stood', 'lose', 'loses', 'lost',
    'pay', 'pays', 'paid', 'meet', 'meets', 'met', 'include', 'includes', 'included', 'continue', 'continues',
    'set', 'sets', 'learn', 'learns', 'learned', 'change', 'changes', 'changed', 'lead', 'leads', 'led',
    'understand', 'understands', 'understood', 'watch', 'watches', 'watched', 'follow', 'follows', 'followed',
    'stop', 'stops', 'stopped', 'create', 'creates', 'created', 'speak', 'speaks', 'spoke', 'spoken',
    'read', 'reads', 'allow', 'allows', 'allowed', 'add', 'adds', 'added', 'spend', 'spends', 'spent',
    'grow', 'grows', 'grew', 'grown', 'open', 'opens', 'opened', 'walk', 'walks', 'walked', 'win', 'wins', 'won',
    'offer', 'offers', 'offered', 'remember', 'remembers', 'remembered', 'love', 'loves', 'loved',
    'consider', 'considers', 'considered', 'appear', 'appears', 'appeared', 'buy', 'buys', 'bought',
    'wait', 'waits', 'waited', 'serve', 'serves', 'served', 'die', 'dies', 'died', 'send', 'sends', 'sent',
    'expect', 'expects', 'expected', 'build', 'builds', 'built', 'stay', 'stays', 'stayed', 'fall', 'falls', 'fell',
    'cut', 'cuts', 'reach', 'reaches', 'reached', 'kill', 'kills', 'killed', 'remain', 'remains', 'remained'
  ]), []);

  const POS_ADVERBS = useMemo(() => new Set([
    'very', 'really', 'always', 'never', 'often', 'sometimes', 'usually', 'quite', 'too',
    'also', 'just', 'even', 'already', 'still', 'again', 'actually', 'especially', 'well',
    'almost', 'enough', 'now', 'then', 'here', 'there', 'today', 'tonight', 'tomorrow', 'yesterday'
  ]), []);

  const getWordPosClass = (rawWord) => {
    if (!posHighlight) return '';
    const w = (rawWord || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return '';
    if (POS_PRONOUNS.has(w)) return 'pos-pron';
    if (POS_PREPOSITIONS.has(w)) return 'pos-prep';
    if (POS_VERBS.has(w)) return 'pos-verb';
    if (POS_ADJECTIVES.has(w)) return 'pos-adj';
    if (POS_ADVERBS.has(w) || (w.endsWith('ly') && w.length > 3)) return 'pos-adv';
    if (w.endsWith('ful') || w.endsWith('less') || w.endsWith('ous') || w.endsWith('able') ||
        w.endsWith('ible') || w.endsWith('ive') || w.endsWith('ic') || w.endsWith('al') ||
        w.endsWith('ish') || w.endsWith('ent') || w.endsWith('ant')) return 'pos-adj';
    if (w.endsWith('ing') || w.endsWith('ed') || w.endsWith('ize') || w.endsWith('ise') || w.endsWith('ate')) return 'pos-verb';
    if (w.endsWith('tion') || w.endsWith('sion') || w.endsWith('ment') || w.endsWith('ness') ||
        w.endsWith('ity') || w.endsWith('ship') || w.endsWith('er') || w.endsWith('or') || w.endsWith('ist')) return 'pos-noun';
    return 'pos-noun';
  };

  // 11. Word click dictionary popup (Instant & Rich)
  const handleWordClick = async (word, e) => {
    if (e) e.stopPropagation();
    const cleanWord = word.replace(/[^a-zA-Z'-]/g, '').trim();
    if (!cleanWord) return;

    const rect = e.target.getBoundingClientRect();
    setDictPos({
      x: Math.min(window.innerWidth - 340, Math.max(16, rect.left - 40)),
      y: Math.min(window.innerHeight - 280, rect.bottom + 10),
    });

    const existingFreq = wordFrequencies[cleanWord.toLowerCase()] || 0;
    setDictWord({ word: cleanWord, loading: true, saveCount: existingFreq });

    try {
      const res = await fetch(`${API_BASE}/dictionary/lookup?word=${encodeURIComponent(cleanWord)}`);
      const data = await res.json();
      setDictWord({
        word: cleanWord,
        phonetic: data.phonetic || '',
        translation: data.koTranslation || data.translation || '뜻을 불러올 수 없습니다.',
        pos: data.pos || '단어',
        exampleEn: data.exampleEn || '',
        exampleKo: data.exampleKo || '',
        meanings: data.meanings || [],
        saveCount: existingFreq,
        loading: false,
      });
    } catch (err) {
      setDictWord({
        word: cleanWord,
        translation: '조회 실패',
        meanings: [],
        saveCount: existingFreq,
        loading: false,
      });
    }
  };

  // 11-1. Native TTS Pronunciation Audio Playback
  const handleSpeakWord = (text, e) => {
    if (e) e.stopPropagation();
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  // 11-2. Add Word to Vocab-Hub (만능단어장 연동 및 횟수 누적)
  const handleAddToVocabHub = async (item) => {
    if (!item || !item.word || addingToVocab) return;
    setAddingToVocab(true);
    try {
      const res = await fetch(`${API_BASE}/vocab/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: item.word,
          meaning: item.translation || item.koTranslation || '',
          pos: item.pos || '단어',
          phonetic: item.phonetic || '',
          exampleEn: item.exampleEn || '',
          exampleKo: item.exampleKo || '',
          videoTitle: video.title || ''
        })
      });

      const data = await res.json();
      const cleanKey = item.word.toLowerCase();
      const newCount = (wordFrequencies[cleanKey] || 0) + 1;
      const updatedFreqs = { ...wordFrequencies, [cleanKey]: newCount };
      setWordFrequencies(updatedFreqs);
      try {
        localStorage.setItem('ytkw_word_freq', JSON.stringify(updatedFreqs));
      } catch (e) {}

      if (dictWord && dictWord.word.toLowerCase() === cleanKey) {
        setDictWord(prev => ({ ...prev, saveCount: newCount }));
      }

      showVocabToast(`⭐ "${item.word}" 단어가 만능단어장에 저장되었습니다! (누적 ${newCount}회)`, 'success');
    } catch (e) {
      showVocabToast('단어장 저장에 실패했습니다.', 'error');
    } finally {
      setAddingToVocab(false);
    }
  };

  // 11-3. Bookmark Sentence (좋은 문장 별도 저장)
  const handleToggleSaveSentence = async (line, e) => {
    if (e) e.stopPropagation();
    const existing = savedSentences.find(s => s.text === line.text && s.videoId === video.videoId);

    if (existing) {
      // Remove sentence
      handleDeleteSavedSentence(existing.id);
    } else {
      // Add sentence
      setSavingSentence(true);
      try {
        const res = await fetch(`${API_BASE}/sentences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId: video.videoId,
            videoTitle: video.title,
            start: line.start,
            end: line.end,
            text: line.text,
            translation: line.translation
          })
        });
        const data = await res.json();
        if (data.ok && data.sentence) {
          setSavedSentences(prev => [data.sentence, ...prev]);
          showVocabToast('🔖 명문장이 [저장한 문장함]에 추가되었습니다!', 'success');
        }
      } catch (err) {
        showVocabToast('문장 저장에 실패했습니다.', 'error');
      } finally {
        setSavingSentence(false);
      }
    }
  };

  const handleDeleteSavedSentence = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await fetch(`${API_BASE}/sentences/${id}`, { method: 'DELETE' });
      setSavedSentences(prev => prev.filter(s => s.id !== id));
      showVocabToast('🗑️ 저장된 문장이 삭제되었습니다.', 'info');
    } catch (err) {}
  };

  // 12. Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (bgAudioMode && audioRef.current) {
          if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
          } else {
            audioRef.current.play();
            setIsPlaying(true);
          }
        } else if (player) {
          if (isPlaying) player.pauseVideo();
          else player.playVideo();
        }
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIdx = Math.max(0, (activeIndex === -1 ? 0 : activeIndex) - 1);
        if (transcript[prevIdx]) handleSeekTo(transcript[prevIdx].start, prevIdx);
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIdx = Math.min(transcript.length - 1, (activeIndex === -1 ? 0 : activeIndex) + 1);
        if (transcript[nextIdx]) handleSeekTo(transcript[nextIdx].start, nextIdx);
      } else if (e.key === 's' || e.key === 'S' || e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (activeIndex !== -1 && transcript[activeIndex]) {
          handleSeekTo(transcript[activeIndex].start, activeIndex);
        }
      } else if (e.key === 'Escape') {
        if (showSettings) setShowSettings(false);
        else onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [player, isPlaying, bgAudioMode, activeIndex, transcript, showSettings, onClose]);

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getDisplayModeLabel = () => {
    if (displayMode === 'dual') return '🔤 듀얼';
    if (displayMode === 'en_only') return '🇺🇸 영문';
    if (displayMode === 'ko_only') return '🇰🇷 한글';
    return '🙈 블라인드';
  };

  return (
    <div className="lr-modal-backdrop" onClick={onClose}>
      <div
        className={`lr-studio-container layout-${videoLayout} ${bgAudioMode ? 'bg-audio-active' : ''} ${posHighlight ? 'pos-highlight-enabled' : ''} border-theme-${activeBorderColor}`}
        style={{ '--sub-font-scale': fontScale }}
        onClick={e => e.stopPropagation()}
      >
        
        {/* Hidden HTML5 Audio Element for Background Lockscreen Playback */}
        <audio
          ref={audioRef}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          playsInline
        />

        {/* COMPACT TOP HEADER */}
        <div className="lr-header">
          <div className="lr-title-info">
            <span className="lr-badge">⚡ 쉐도잉</span>
            <h2 title={video.title}>{video.title}</h2>
          </div>

          <div className="lr-header-actions">
            {/* POS COLOR HIGHLIGHT TOGGLE */}
            <button
              className={`lr-icon-btn ${posHighlight ? 'active pos-active' : ''}`}
              onClick={handleTogglePosHighlight}
              title={posHighlight ? '품사별 색상 하이라이트 끄기' : '🎨 품사별 색상 하이라이트 켜기 (동사/명사/형용사/부사)'}
            >
              {posHighlight ? '🎨 품사색 ON' : '🎨 품사색 OFF'}
            </button>

            {/* SAVED SENTENCES DRAWER BUTTON */}
            <button
              className={`lr-icon-btn ${savedSentences.length > 0 ? 'active' : ''}`}
              onClick={() => setShowSentencesDrawer(true)}
              title="좋은 명문장 보관함 열기"
            >
              🔖 문장함 ({savedSentences.length})
            </button>

            {/* FONT SCALE QUICK BUTTON (1.0x ~ 2.0x, Click to cycle or Mouse Wheel to adjust in 0.1 steps) */}
            <button
              className={`lr-icon-btn lr-font-btn ${fontScale > 1.0 ? 'active' : ''}`}
              onClick={handleFontScaleCycle}
              onWheel={handleFontWheel}
              title={`글자 크기 조절 (현재: ${fontScale.toFixed(1)}x / 최대 2.0배)\n• 클릭: 0.2x씩 순환\n• 마우스 휠: 0.1x씩 미세조절`}
            >
              🔠 {fontScale.toFixed(1)}x
            </button>

            {/* BACKGROUND AUDIO LOCKSCREEN PLAYBACK TOGGLE BUTTON */}
            <button
              className={`lr-icon-btn ${bgAudioMode ? 'bg-active' : ''}`}
              onClick={handleToggleBgAudio}
              title={bgAudioMode ? '백그라운드 모드 끄기 (비디오로 복귀)' : '🎧 백그라운드 취침 모드 (화면 꺼짐 재생)'}
            >
              {loadingAudio ? '⏳ 오디오 준비...' : bgAudioMode ? '🌙 취침모드 ON' : '🎧 백그라운드'}
            </button>

            {/* SUBTITLE DISPLAY MODE QUICK TOGGLE (설정 안 들어가고 1클릭 즉시 전환: 듀얼 -> 영문 -> 한글 -> 블라인드) */}
            <button
              className={`lr-icon-btn lr-submode-btn ${displayMode !== 'dual' ? 'active' : ''}`}
              onClick={handleCycleDisplayMode}
              title={`자막 표시 모드 즉시 변경 (현재: ${getDisplayModeLabel()})\n• 클릭 시: 🔤듀얼 ➔ 🇺🇸영문만 ➔ 🇰🇷한글만 ➔ 🙈블라인드 순환`}
            >
              {getDisplayModeLabel()}
            </button>

            {/* VIDEO LAYOUT MODE (설정 안 들어가고 1클릭 즉시 전환: 20% 콤팩트 -> 100% 텍스트전용 -> 50% 영상확대) */}
            {!bgAudioMode && (
              <button
                className={`lr-icon-btn ${videoLayout === 'text_only' ? 'active text-only-active' : ''}`}
                onClick={handleCycleVideoLayout}
                title={`화면 레이아웃 즉시 변경\n• 클릭 시: 📱20%콤팩트 ➔ 📖100%텍스트전용 ➔ 🗖50%영상확대 순환`}
              >
                {videoLayout === 'text_only' ? '📖 텍스트전용' : videoLayout === 'compact' ? '📱 20% 콤팩트' : '🗖 영상확대'}
              </button>
            )}

            {/* SETTINGS GEAR ICON BUTTON */}
            <button
              className={`lr-icon-btn ${showSettings ? 'active' : ''}`}
              onClick={() => setShowSettings(!showSettings)}
              title="테두리 색상, 글자크기 & 세밀배속 상세설정"
            >
              ⚙️ {playbackRate.toFixed(2)}x
            </button>

            <button
              className={`lr-star-btn ${video.bookmarked ? 'active' : ''}`}
              onClick={() => onToggleBookmark && onToggleBookmark(video.id)}
              title={video.bookmarked ? '찜 해제' : '다시보기 찜'}
            >
              {video.bookmarked ? '⭐' : '☆'}
            </button>
            <button className="lr-close-btn" onClick={onClose} title="닫기 (ESC)">
              ✕
            </button>
          </div>
        </div>

        {/* TOAST FEEDBACK NOTIFICATION */}
        {vocabToast && (
          <div className={`lr-floating-toast ${vocabToast.type}`}>
            {vocabToast.msg}
          </div>
        )}

        {/* SETTINGS FLOATING DROPDOWN MENU */}
        {showSettings && (
          <div className="lr-settings-dropdown" onClick={e => e.stopPropagation()}>
            {/* ACTIVE LINE BORDER COLOR THEME (하늘색 테두리 색상 커스텀) */}
            <div className="settings-section">
              <div className="section-title-row">
                <span className="section-title">✨ 재생중 자막 테두리 색상</span>
              </div>
              <div className="border-color-palette">
                {[
                  { key: 'sky', label: '하늘', hex: '#00f2fe' },
                  { key: 'green', label: '라임초록', hex: '#10b981' },
                  { key: 'purple', label: '네온보라', hex: '#a855f7' },
                  { key: 'gold', label: '골드노랑', hex: '#fbbf24' },
                  { key: 'coral', label: '코랄레드', hex: '#f87171' },
                  { key: 'pink', label: '로즈핑크', hex: '#f472b6' }
                ].map(c => (
                  <button
                    key={c.key}
                    className={`border-theme-chip ${activeBorderColor === c.key ? 'active' : ''}`}
                    style={{ '--chip-color': c.hex }}
                    onClick={() => handleBorderColorChange(c.key)}
                    title={`${c.label} 테두리 선택`}
                  >
                    <span className="chip-dot" style={{ backgroundColor: c.hex }}></span>
                    <span className="chip-label">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* VIDEO & SCREEN LAYOUT (화면 레이아웃 모드) */}
            <div className="settings-section">
              <span className="section-title">🖥️ 화면 구성 및 영상 모드</span>
              <div className="settings-btn-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <button
                  className={`set-choice-btn ${videoLayout === 'compact' ? 'active' : ''}`}
                  onClick={() => handleVideoLayoutChange('compact')}
                >
                  📱 20% 콤팩트
                </button>
                <button
                  className={`set-choice-btn ${videoLayout === 'expanded' ? 'active' : ''}`}
                  onClick={() => handleVideoLayoutChange('expanded')}
                >
                  🗖 50% 영상확대
                </button>
                <button
                  className={`set-choice-btn ${videoLayout === 'text_only' ? 'active' : ''}`}
                  onClick={() => handleVideoLayoutChange('text_only')}
                >
                  📖 100% 텍스트전용
                </button>
              </div>
            </div>

            <div className="settings-section">
              <span className="section-title">🔤 자막 표시 모드</span>
              <div className="settings-btn-grid">
                <button
                  className={`set-choice-btn ${displayMode === 'dual' ? 'active' : ''}`}
                  onClick={() => { setDisplayMode('dual'); }}
                >
                  🔤 영문 + 한글 듀얼
                </button>
                <button
                  className={`set-choice-btn ${displayMode === 'en_only' ? 'active' : ''}`}
                  onClick={() => { setDisplayMode('en_only'); }}
                >
                  🇺🇸 영문 자막만
                </button>
                <button
                  className={`set-choice-btn ${displayMode === 'ko_only' ? 'active' : ''}`}
                  onClick={() => { setDisplayMode('ko_only'); }}
                >
                  🇰🇷 한글 번역만
                </button>
                <button
                  className={`set-choice-btn ${displayMode === 'blind' ? 'active' : ''}`}
                  onClick={() => { setDisplayMode('blind'); }}
                >
                  🙈 블라인드 (가리기)
                </button>
              </div>
            </div>

            {/* POS COLOR HIGHLIGHT SETTING */}
            <div className="settings-section">
              <span className="section-title">🎨 품사별 색상 하이라이트 (동사/명사/형용사/부사)</span>
              <button
                className={`set-toggle-btn ${posHighlight ? 'active' : ''}`}
                onClick={handleTogglePosHighlight}
              >
                {posHighlight ? '✅ 품사별 단어 컬러링 ON (동사/명사/형용사/부사)' : '❌ 일반 단어 색상 OFF'}
              </button>
              <div className="pos-color-legend">
                <span className="pos-legend-pill pos-verb">동사(초록)</span>
                <span className="pos-legend-pill pos-noun">명사(하늘)</span>
                <span className="pos-legend-pill pos-adj">형용사(노랑)</span>
                <span className="pos-legend-pill pos-adv">부사(보라)</span>
                <span className="pos-legend-pill pos-pron">대명사(핑크)</span>
              </div>
            </div>

            {/* FONT SCALE CONTROL (1.0x ~ 2.0x, 0.1단위 제어) */}
            <div className="settings-section">
              <div className="section-title-row">
                <span className="section-title">🔠 글자 크기 (1.0x ~ 2.0x, 0.1단위)</span>
                <span className="section-val-badge">{fontScale.toFixed(1)}x</span>
              </div>
              <div className="font-scale-controls">
                <button
                  className="step-btn"
                  onClick={() => handleFontScaleChange(fontScale - 0.1)}
                  disabled={fontScale <= 1.0}
                  title="글자 크기 축소 (-0.1x)"
                >
                  ➖ 0.1
                </button>
                <input
                  type="range"
                  className="settings-slider"
                  min="1.0"
                  max="2.0"
                  step="0.1"
                  value={fontScale}
                  onChange={(e) => handleFontScaleChange(parseFloat(e.target.value))}
                />
                <button
                  className="step-btn"
                  onClick={() => handleFontScaleChange(fontScale + 0.1)}
                  disabled={fontScale >= 2.0}
                  title="글자 크기 확대 (+0.1x)"
                >
                  ➕ 0.1
                </button>
              </div>
              <div className="settings-preset-row">
                {[1.0, 1.2, 1.4, 1.6, 1.8, 2.0].map(scale => (
                  <button
                    key={scale}
                    className={`rate-pill ${Math.abs(fontScale - scale) < 0.05 ? 'active' : ''}`}
                    onClick={() => handleFontScaleChange(scale)}
                  >
                    {scale.toFixed(1)}x
                  </button>
                ))}
              </div>
              <span className="font-phone-hint">📱 폰(모바일)은 화면에 최적화되어 최대 1.5배(+50%)까지만 자동 제한됩니다.</span>
            </div>

            {/* PLAYBACK SPEED (최저 0.60x ~ 0.05단위) */}
            <div className="settings-section">
              <div className="section-title-row">
                <span className="section-title">⚡ 재생/읽기 속도 (최저 0.60x ~ 0.05 단위)</span>
                <span className="section-val-badge">{playbackRate.toFixed(2)}x</span>
              </div>
              <div className="rate-fine-controls">
                <button
                  className="step-btn"
                  onClick={() => handleStepRate(-0.05)}
                  disabled={playbackRate <= 0.60}
                  title="속도 -0.05x 느리게"
                >
                  ➖ 0.05
                </button>
                <input
                  type="range"
                  className="settings-slider"
                  min="0.60"
                  max="1.50"
                  step="0.05"
                  value={playbackRate}
                  onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                />
                <button
                  className="step-btn"
                  onClick={() => handleStepRate(0.05)}
                  disabled={playbackRate >= 2.0}
                  title="속도 +0.05x 빠르게"
                >
                  ➕ 0.05
                </button>
              </div>
              <div className="settings-preset-row">
                {[0.60, 0.70, 0.80, 0.90, 1.00, 1.10, 1.25].map(rate => (
                  <button
                    key={rate}
                    className={`rate-pill ${Math.abs(playbackRate - rate) < 0.02 ? 'active' : ''}`}
                    onClick={() => handleRateChange(rate)}
                  >
                    {rate.toFixed(rate === 0.6 || rate === 0.7 || rate === 0.8 || rate === 0.9 || rate === 1.0 || rate === 1.1 ? 1 : 2)}x
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <span className="section-title">🎧 백그라운드 / 취침 모드</span>
              <button
                className={`set-toggle-btn ${bgAudioMode ? 'active' : ''}`}
                onClick={() => { handleToggleBgAudio(); }}
              >
                {bgAudioMode ? '🌙 백그라운드 취침 모드 활성화됨 (화면꺼짐 재생)' : '🎧 백그라운드 모드 켜기 (화면꺼짐 재생)'}
              </button>
            </div>

            <div className="settings-section">
              <span className="section-title">📜 자막 제어</span>
              <button
                className={`set-toggle-btn ${autoScroll ? 'active' : ''}`}
                onClick={() => setAutoScroll(!autoScroll)}
              >
                {autoScroll ? '✅ 실시간 자동 스크롤 ON' : '❌ 자동 스크롤 OFF'}
              </button>
            </div>
          </div>
        )}

        {/* SAVED SENTENCES DRAWER / MODAL */}
        {showSentencesDrawer && (
          <div className="lr-drawer-backdrop" onClick={() => setShowSentencesDrawer(false)}>
            <div className="lr-sentences-drawer" onClick={e => e.stopPropagation()}>
              <div className="drawer-header">
                <div className="drawer-title-row">
                  <h3>🔖 저장한 명문장 보관함 ({savedSentences.length})</h3>
                  <button className="drawer-close-btn" onClick={() => setShowSentencesDrawer(false)}>✕</button>
                </div>
                <p className="drawer-desc">좋은 표현을 언제든 다시 듣고 쉐도잉하며 복습하세요.</p>
              </div>

              <div className="drawer-body">
                {savedSentences.length === 0 ? (
                  <div className="drawer-empty">
                    <span className="empty-icon">🔖</span>
                    <p>아직 저장된 문장이 없습니다.<br />자막 옆의 🔖 버튼을 눌러 명문장을 보관해보세요!</p>
                  </div>
                ) : (
                  <div className="saved-sent-list">
                    {savedSentences.map(sent => (
                      <div key={sent.id} className="saved-sent-card">
                        <div className="sent-head">
                          <span className="sent-vid-title">🎬 {sent.videoTitle || '쉐도잉 명문장'}</span>
                          <span className="sent-time">{formatTime(sent.start)}</span>
                        </div>
                        <p className="sent-en-text">{sent.text}</p>
                        {sent.translation && <p className="sent-ko-text">{sent.translation}</p>}
                        <div className="sent-actions">
                          {sent.videoId === video.videoId ? (
                            <button
                              className="btn-sent-play"
                              onClick={() => {
                                handleSeekTo(sent.start);
                                setShowSentencesDrawer(false);
                              }}
                            >
                              ⚡ 이 구간 재생
                            </button>
                          ) : (
                            <span className="sent-other-vid-tag">다른 영상 문장</span>
                          )}
                          <button
                            className="btn-sent-tts"
                            onClick={(e) => handleSpeakWord(sent.text, e)}
                            title="음성 듣기"
                          >
                            🔊 음성 듣기
                          </button>
                          <button
                            className="btn-sent-del"
                            onClick={(e) => handleDeleteSavedSentence(sent.id, e)}
                            title="삭제"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MAIN BODY: VIDEO / AUDIO VISUALIZER + SUBTITLES STREAM */}
        <div className="lr-main-grid">
          
          {/* VIDEO PLAYER / BG AUDIO STATUS PANEL */}
          <div className="lr-player-panel">
            {bgAudioMode ? (
              <div className="lr-bg-audio-banner">
                <div className="bg-banner-icon">🌙</div>
                <div className="bg-banner-text">
                  <h3>백그라운드 취침 모드 재생 중</h3>
                  <p>화면을 끄거나 다른 앱을 켜도 끊김 없이 재생됩니다.<br />갤럭시 잠금화면 및 알림창에서 컨트롤하세요.</p>
                </div>
              </div>
            ) : (
              <div className="lr-video-wrapper">
                <div id="lr-yt-embed"></div>
              </div>
            )}

            {/* SLIM ICON-ONLY CONTROL DECK */}
            <div className="lr-control-deck">
              <div className="lr-icon-controls">
                {/* PREVIOUS SENTENCE */}
                <button
                  className="lr-icon-action-btn"
                  onClick={() => {
                    const prev = Math.max(0, activeIndex - 1);
                    if (transcript[prev]) handleSeekTo(transcript[prev].start, prev);
                  }}
                  title="이전 문장 (A)"
                >
                  ⏮️
                </button>

                {/* PLAY / PAUSE TOGGLE */}
                <button
                  className="lr-icon-action-btn play-pause-btn"
                  onClick={() => {
                    if (bgAudioMode && audioRef.current) {
                      if (isPlaying) {
                        audioRef.current.pause();
                        setIsPlaying(false);
                      } else {
                        audioRef.current.play();
                        setIsPlaying(true);
                      }
                    } else if (player) {
                      if (isPlaying) player.pauseVideo();
                      else player.playVideo();
                    }
                  }}
                  title="재생 / 일시정지 (Space)"
                >
                  {isPlaying ? '⏸️' : '▶️'}
                </button>

                {/* REPLAY CURRENT SENTENCE */}
                <button
                  className="lr-icon-action-btn active-highlight"
                  onClick={() => {
                    if (activeIndex !== -1 && transcript[activeIndex]) {
                      handleSeekTo(transcript[activeIndex].start, activeIndex);
                    }
                  }}
                  title="현재 문장 다시듣기 (S)"
                >
                  🔄
                </button>

                {/* NEXT SENTENCE */}
                <button
                  className="lr-icon-action-btn"
                  onClick={() => {
                    const next = Math.min(transcript.length - 1, activeIndex + 1);
                    if (transcript[next]) handleSeekTo(transcript[next].start, next);
                  }}
                  title="다음 문장 (D)"
                >
                  ⏭️
                </button>

                {/* SINGLE SENTENCE LOOP */}
                <button
                  className={`lr-icon-action-btn ${loopMode === 'single_loop' ? 'loop-active' : ''}`}
                  onClick={() => {
                    if (loopMode === 'single_loop') {
                      setLoopMode('none');
                      setLoopingIndex(null);
                    } else {
                      setLoopMode('single_loop');
                      setLoopingIndex(activeIndex !== -1 ? activeIndex : 0);
                    }
                  }}
                  title="현재 문장 무한반복 토글"
                >
                  🔁
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT / BOTTOM: MAXIMIZED REAL-TIME SUBTITLES STREAM */}
          <div className="lr-subtitles-panel">
            <div
              className="lr-sub-list-container"
              ref={subtitleListRef}
              onWheel={(e) => {
                if (e.ctrlKey) {
                  e.preventDefault();
                  if (e.deltaY < 0) handleFontScaleChange(fontScale + 0.1);
                  else if (e.deltaY > 0) handleFontScaleChange(fontScale - 0.1);
                }
              }}
            >
              {loadingTranscript ? (
                <div className="lr-sub-loading">
                  <div className="spinner large"></div>
                  <p>실시간 자막 & 번역 불러오는 중...</p>
                </div>
              ) : transcriptError ? (
                <div className="lr-sub-error">
                  <div className="error-icon">⚠️</div>
                  <p>{transcriptError}</p>
                </div>
              ) : transcript.length === 0 ? (
                <div className="lr-sub-empty">
                  <p>자막이 없는 영상입니다.</p>
                </div>
              ) : (
                <div className="lr-sub-lines">
                  {transcript.map((line, idx) => {
                    const isActive = activeIndex === idx;
                    const isLooping = loopMode === 'single_loop' && loopingIndex === idx;
                    const isSaved = savedSentences.some(s => s.text === line.text && s.videoId === video.videoId);

                    return (
                      <div
                        key={line.id || idx}
                        ref={isActive ? activeLineRef : null}
                        className={`lr-sub-line ${isActive ? 'active' : ''} ${isLooping ? 'looping' : ''}`}
                        onClick={() => handleSeekTo(line.start, idx)}
                      >
                        {/* TIMESTAMP, PLAY/PAUSE, QUICK LOOP & SENTENCE BOOKMARK ICONS */}
                        <div className="line-meta">
                          <span className="line-time">{formatTime(line.start)}</span>
                          <div className="line-btn-group">
                            {/* INSTANT PLAY / PAUSE THIS SENTENCE */}
                            <button
                              className={`line-play-btn ${isActive && isPlaying ? 'playing' : ''}`}
                              onClick={(e) => handleLinePlayPause(line, idx, e)}
                              title={isActive && isPlaying ? "이 문장 일시정지" : "이 문장 재생"}
                            >
                              {isActive && isPlaying ? '⏸️' : '▶️'}
                            </button>
                            {/* SINGLE SENTENCE LOOP / RELEASE */}
                            <button
                              className={`line-loop-btn ${isLooping ? 'active' : ''}`}
                              onClick={(e) => handleToggleLineLoop(idx, e)}
                              title={isLooping ? "이 문장 무한반복 해제 (풀기)" : "이 문장만 무한반복"}
                            >
                              🔁
                            </button>
                            {/* BOOKMARK */}
                            <button
                              className={`line-save-btn ${isSaved ? 'active' : ''}`}
                              onClick={(e) => handleToggleSaveSentence(line, e)}
                              title={isSaved ? "문장 저장 해제" : "명문장 보관함에 저장"}
                            >
                              {isSaved ? '🔖' : '☆'}
                            </button>
                          </div>
                        </div>

                        {/* SUBTITLE TEXT */}
                        <div className="line-content">
                          {/* ENGLISH TEXT WITH POS HIGHLIGHTING */}
                          {(displayMode === 'dual' || displayMode === 'en_only') && (
                            <div className="line-en">
                              {line.text.split(' ').map((word, wIdx) => {
                                const posClass = getWordPosClass(word);
                                return (
                                  <span
                                    key={wIdx}
                                    className={`clickable-word ${posClass}`}
                                    onClick={(e) => handleWordClick(word, e)}
                                    title="단어 사전 & 발음 듣기"
                                  >
                                    {word}{' '}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* KOREAN TRANSLATION */}
                          {(displayMode === 'dual' || displayMode === 'ko_only') && line.translation && (
                            <div className="line-ko">
                              {line.translation}
                            </div>
                          )}

                          {/* BLIND MODE */}
                          {displayMode === 'blind' && (
                            <div className="line-blind-placeholder">
                              🔒 [자막 숨김 - 듣기 집중]
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DICTIONARY POPUP MODAL / TOOLTIP */}
        {dictWord && (
          <div
            className="lr-dict-popup"
            style={{ left: `${dictPos.x}px`, top: `${dictPos.y}px` }}
            onClick={e => e.stopPropagation()}
          >
            <div className="dict-header">
              <div className="dict-word-group">
                <span className="dict-word-title">{dictWord.word}</span>
                {dictWord.phonetic && <span className="dict-phonetic">/{dictWord.phonetic}/</span>}
                <button
                  className="dict-tts-btn"
                  onClick={(e) => handleSpeakWord(dictWord.word, e)}
                  title="원어민 발음 듣기 (TTS)"
                >
                  🔊 발음 듣기
                </button>
              </div>
              <button className="dict-close" onClick={() => setDictWord(null)}>✕</button>
            </div>
            
            {dictWord.loading ? (
              <div className="dict-loading">사전 조회 중...</div>
            ) : (
              <div className="dict-body">
                <div className="dict-korean-meaning">
                  <span className="dict-pos-tag">{dictWord.pos || '단어'}</span>
                  <strong>{dictWord.translation}</strong>
                </div>

                {/* VOCAB-HUB INTEGRATION & FREQUENCY BADGE */}
                <div className="dict-action-row">
                  <button
                    className="btn-add-vocab-hub"
                    disabled={addingToVocab}
                    onClick={() => handleAddToVocabHub(dictWord)}
                  >
                    {addingToVocab ? '저장 중...' : '⭐ 만능단어장에 추가'}
                  </button>
                  {dictWord.saveCount > 0 && (
                    <span className="dict-freq-badge" title="내가 단어장에 추가한 누적 횟수">
                      🔥 {dictWord.saveCount}회 저장됨
                    </span>
                  )}
                </div>

                {dictWord.exampleEn && (
                  <div className="dict-example-box">
                    <p className="dict-ex-en">"{dictWord.exampleEn}"</p>
                    {dictWord.exampleKo && <p className="dict-ex-ko">{dictWord.exampleKo}</p>}
                  </div>
                )}

                {dictWord.meanings && dictWord.meanings.length > 0 && (
                  <div className="dict-en-meanings">
                    {dictWord.meanings.map((m, mIdx) => (
                      <div key={mIdx} className="meaning-item">
                        {m.partOfSpeech && <span className="pos-badge">{m.partOfSpeech}</span>}
                        <p className="def-text">{m.definition}</p>
                        {m.example && <p className="eg-text"><em>"{m.example}"</em></p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
