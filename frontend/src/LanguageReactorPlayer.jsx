import React, { useState, useEffect, useRef, useMemo } from 'react';
import './LanguageReactorPlayer.css';

const API_BASE = window.location.pathname.startsWith('/youtubekw') ? '/youtubekw/api' : '/api';

export default function LanguageReactorPlayer({
  video,
  playlist = [],
  initialIndex = 0,
  onClose,
  onToggleBookmark
}) {
  const effectivePlaylist = useMemo(() => {
    if (Array.isArray(playlist) && playlist.length > 0) return playlist;
    if (video) return [video];
    return [];
  }, [playlist, video]);

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (typeof initialIndex === 'number' && initialIndex >= 0 && initialIndex < (playlist?.length || 1)) {
      return initialIndex;
    }
    return 0;
  });

  // Keep index within bounds if playlist changes
  useEffect(() => {
    if (currentIndex >= effectivePlaylist.length) {
      setCurrentIndex(Math.max(0, effectivePlaylist.length - 1));
    }
  }, [effectivePlaylist.length, currentIndex]);

  const currentVideo = effectivePlaylist[currentIndex] || video || {};

  const [player, setPlayer] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Playlist drawer toggle
  const [showPlaylistDrawer, setShowPlaylistDrawer] = useState(false);

  // Repeat Modes: 'playlist' (전체 순차 무한반복), 'single' (영상 1개 무한반복), 'off' (1회 순차재생 후 멈춤)
  const [repeatMode, setRepeatMode] = useState(() => {
    try {
      const saved = localStorage.getItem('ytkw_repeat_mode');
      return saved || 'playlist';
    } catch (e) {
      return 'playlist';
    }
  });
  const repeatModeRef = useRef(repeatMode);
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  const handleCycleRepeatMode = (e) => {
    if (e) e.stopPropagation();
    const modes = ['playlist', 'single', 'off'];
    const curIdx = modes.indexOf(repeatMode);
    const nextMode = modes[(curIdx + 1) % modes.length];
    setRepeatMode(nextMode);
    repeatModeRef.current = nextMode;
    try {
      localStorage.setItem('ytkw_repeat_mode', nextMode);
    } catch (err) {}

    if (nextMode === 'playlist') {
      showVocabToast('🔁 전체 목록 순차 무한반복 재생', 'info');
    } else if (nextMode === 'single') {
      showVocabToast('🔂 현재 영상 1개 무한반복 재생', 'info');
    } else {
      showVocabToast('➡️ 1회 순차재생 (끝나면 정지)', 'info');
    }
  };

  const handleNextVideo = () => {
    if (effectivePlaylist.length <= 1) {
      handleSeekTo(0, 0, true);
      return;
    }
    const nextIdx = (currentIndex + 1) % effectivePlaylist.length;
    setCurrentIndex(nextIdx);
    showVocabToast(`⏭ 다음 영상 (${nextIdx + 1}/${effectivePlaylist.length}): ${effectivePlaylist[nextIdx].title}`, 'info');
  };

  const handlePrevVideo = () => {
    if (effectivePlaylist.length <= 1) {
      handleSeekTo(0, 0, true);
      return;
    }
    const prevIdx = (currentIndex - 1 + effectivePlaylist.length) % effectivePlaylist.length;
    setCurrentIndex(prevIdx);
    showVocabToast(`⏮ 이전 영상 (${prevIdx + 1}/${effectivePlaylist.length}): ${effectivePlaylist[prevIdx].title}`, 'info');
  };

  const handleVideoEnded = (targetPlayer = null) => {
    const curMode = repeatModeRef.current;
    if (curMode === 'single') {
      if (targetPlayer && typeof targetPlayer.seekTo === 'function') {
        targetPlayer.seekTo(0, true);
        targetPlayer.playVideo();
      } else if (bgAudioMode && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      setActiveIndex(0);
      setIsPlaying(true);
      showVocabToast('🔂 영상 반복: 처음부터 다시 시작합니다', 'info');
    } else if (curMode === 'playlist') {
      if (effectivePlaylist.length > 1) {
        const nextIdx = (currentIndex + 1) % effectivePlaylist.length;
        setCurrentIndex(nextIdx);
        showVocabToast(`🔀 순차 재생 다음 영상 (${nextIdx + 1}/${effectivePlaylist.length}): ${effectivePlaylist[nextIdx].title}`, 'info');
      } else {
        if (targetPlayer && typeof targetPlayer.seekTo === 'function') {
          targetPlayer.seekTo(0, true);
          targetPlayer.playVideo();
        } else if (bgAudioMode && audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
        setActiveIndex(0);
        setIsPlaying(true);
      }
    } else {
      if (currentIndex + 1 < effectivePlaylist.length) {
        const nextIdx = currentIndex + 1;
        setCurrentIndex(nextIdx);
        showVocabToast(`⏭ 다음 영상 (${nextIdx + 1}/${effectivePlaylist.length}): ${effectivePlaylist[nextIdx].title}`, 'info');
      } else {
        setIsPlaying(false);
      }
    }
  };
  
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
  
  // Video Layout Mode: 'half' (50% 나란히 분할) | 'compact' (20% 축소) | 'theater' (영상 전체보기)
  const [videoLayout, setVideoLayout] = useState(() => {
    try {
      const saved = localStorage.getItem('ytkw_video_layout');
      if (saved && ['half', 'compact', 'theater'].includes(saved)) return saved;
      return 'half';
    } catch (e) {
      return 'half';
    }
  });

  const handleSetVideoLayout = (mode) => {
    setVideoLayout(mode);
    try {
      localStorage.setItem('ytkw_video_layout', mode);
      localStorage.setItem('ytkw_compact_video', String(mode === 'compact'));
    } catch (e) {}
  };

  // Legacy compactVideo getter for compatibility
  const compactVideo = videoLayout === 'compact';
  const handleToggleCompactVideo = () => {
    handleSetVideoLayout(videoLayout === 'compact' ? 'half' : 'compact');
  };

  // Video Hide Mode: 영상 숨기고 글자만 화면 전체 점유 (체크박스/토글)
  const [hideVideo, setHideVideo] = useState(() => {
    try {
      const saved = localStorage.getItem('ytkw_hide_video');
      return saved === 'true';
    } catch (e) {
      return false;
    }
  });

  const handleToggleHideVideo = () => {
    const next = !hideVideo;
    setHideVideo(next);
    try {
      localStorage.setItem('ytkw_hide_video', String(next));
    } catch (e) {}
  };

  // HTML5 Fullscreen Mode state & ref
  const videoWrapperRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = () => {
    const target = videoWrapperRef.current;
    if (!target) return;
    if (!document.fullscreenElement) {
      if (target.requestFullscreen) {
        target.requestFullscreen().catch(() => {
          document.querySelector('.lr-studio-container')?.requestFullscreen().catch(() => {});
        });
      } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
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

  // Subtitle Scroll Mode ('smooth': 부드러운 슬라이딩, 'instant': 초고속 즉시, 'smart_page': 스마트 넘김, 'replace_focus': 고정 센터링 내용교체, 'off': 끔)
  const [scrollMode, setScrollMode] = useState(() => {
    try {
      const saved = localStorage.getItem('ytkw_scroll_mode');
      return saved || 'smooth'; // Default to clean smooth auto-scrolling list
    } catch (e) {
      return 'smooth';
    }
  });

  const handleScrollModeChange = (mode) => {
    setScrollMode(mode);
    try {
      localStorage.setItem('ytkw_scroll_mode', mode);
    } catch (e) {}
    if (mode === 'replace_focus') showVocabToast('🎯 고정 센터링 내용 교체 모드 (스크롤 0%)', 'info');
    else if (mode === 'instant') showVocabToast('⚡ 초고속 즉시 리스트 이동 (어지러움 방지)', 'info');
    else if (mode === 'smart_page') showVocabToast('📖 스마트 넘김 (화면 벗어날 때만)', 'info');
    else if (mode === 'smooth') showVocabToast('🌊 부드러운 슬라이딩 (기존)', 'info');
    else showVocabToast('⏹️ 자막 자동 스크롤 꺼짐', 'info');
  };

  // Subtitle Highlight Style ('minimal_bar': 좌측 포인트 바, 'full_box': 사각 전체 테두리, 'text_only': 글자만 강조)
  const [highlightStyle, setHighlightStyle] = useState(() => {
    try {
      const saved = localStorage.getItem('ytkw_highlight_style');
      return saved || 'minimal_bar';
    } catch (e) {
      return 'minimal_bar';
    }
  });

  const handleHighlightStyleChange = (style) => {
    setHighlightStyle(style);
    try {
      localStorage.setItem('ytkw_highlight_style', style);
    } catch (e) {}
    if (style === 'minimal_bar') showVocabToast('✨ 강조 스타일: 좌측 포인트 바 (눈 피로 최소)', 'info');
    else if (style === 'full_box') showVocabToast('🔲 강조 스타일: 사각형 전체 테두리', 'info');
    else showVocabToast('🔤 강조 스타일: 글자만 밝게 (테두리 제거)', 'info');
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

  // ── Sentence & Video Listening Counter Stats (0ms 반응 & 백그라운드 동기화) ──
  const [listenStats, setListenStats] = useState(() => {
    try {
      const saved = localStorage.getItem('ytkw_sentence_stats');
      return saved ? JSON.parse(saved) : { videoStats: {}, totalListensAll: 0 };
    } catch (e) {
      return { videoStats: {}, totalListensAll: 0 };
    }
  });

  const syncStatsTimerRef = useRef(null);

  // Sync with backend stats on mount
  useEffect(() => {
    fetch(`${API_BASE}/stats/listen`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.stats) {
          setListenStats(prev => {
            const merged = { ...prev };
            const backendVideos = data.stats.videoStats || {};
            merged.videoStats = merged.videoStats || {};
            for (const [vid, bData] of Object.entries(backendVideos)) {
              if (!merged.videoStats[vid]) {
                merged.videoStats[vid] = bData;
              } else {
                const cur = merged.videoStats[vid];
                cur.lastTrainedAt = Math.max(cur.lastTrainedAt || 0, bData.lastTrainedAt || 0);
                cur.sentenceCounts = cur.sentenceCounts || {};
                for (const [sIdx, c] of Object.entries(bData.sentenceCounts || {})) {
                  cur.sentenceCounts[sIdx] = Math.max(cur.sentenceCounts[sIdx] || 0, c || 0);
                }
                const counts = Object.values(cur.sentenceCounts);
                cur.totalListens = counts.reduce((sum, v) => sum + v, 0);
                cur.masteredCount = counts.filter(v => v >= 3).length;
              }
            }
            merged.totalListensAll = Object.values(merged.videoStats).reduce((sum, v) => sum + (v.totalListens || 0), 0);
            try {
              localStorage.setItem('ytkw_sentence_stats', JSON.stringify(merged));
            } catch (err) {}
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  const saveStatsToBackend = (latestStats) => {
    if (syncStatsTimerRef.current) clearTimeout(syncStatsTimerRef.current);
    syncStatsTimerRef.current = setTimeout(() => {
      fetch(`${API_BASE}/stats/listen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(latestStats)
      }).catch(() => {});
    }, 2500);
  };

  const recordSentenceListen = (sIdx) => {
    if (!currentVideo?.videoId || sIdx === null || sIdx === undefined || sIdx < 0) return;
    const vid = currentVideo.videoId;
    setListenStats(prev => {
      const copy = { ...prev, videoStats: { ...prev.videoStats } };
      const curVid = copy.videoStats[vid]
        ? { ...copy.videoStats[vid], sentenceCounts: { ...copy.videoStats[vid].sentenceCounts } }
        : { totalListens: 0, sentenceCounts: {}, masteredCount: 0, lastTrainedAt: Date.now() };

      const prevCount = curVid.sentenceCounts[sIdx] || 0;
      const nextCount = prevCount + 1;
      curVid.sentenceCounts[sIdx] = nextCount;

      const counts = Object.values(curVid.sentenceCounts);
      curVid.totalListens = counts.reduce((sum, v) => sum + v, 0);
      curVid.masteredCount = counts.filter(v => v >= 3).length;
      curVid.lastTrainedAt = Date.now();
      copy.videoStats[vid] = curVid;
      copy.totalListensAll = Object.values(copy.videoStats).reduce((sum, v) => sum + (v.totalListens || 0), 0);

      try {
        localStorage.setItem('ytkw_sentence_stats', JSON.stringify(copy));
      } catch (e) {}

      saveStatsToBackend(copy);
      return copy;
    });
  };

  const lastCountedRef = useRef({ idx: -1, timestamp: 0 });

  // Subtitles state
  const [transcript, setTranscript] = useState([]);
  const [loadingTranscript, setLoadingTranscript] = useState(true);
  const [transcriptError, setTranscriptError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);

  // Record sentence listening count automatically when active sentence is played
  useEffect(() => {
    if (activeIndex >= 0 && isPlaying && transcript[activeIndex]) {
      const now = Date.now();
      if (lastCountedRef.current.idx !== activeIndex || (now - lastCountedRef.current.timestamp > 3500)) {
        lastCountedRef.current = { idx: activeIndex, timestamp: now };
        recordSentenceListen(activeIndex);
      }
    }
  }, [activeIndex, isPlaying]);

  // Language Reactor Modes (자막 표시 모드: 듀얼, 영문만, 한글만)
  const [displayMode, setDisplayMode] = useState(() => {
    try {
      const saved = localStorage.getItem('ytkw_display_mode');
      return (saved && saved !== 'blind') ? saved : 'dual';
    } catch (e) {
      return 'dual';
    }
  });

  const handleDisplayModeChange = (mode) => {
    const cleanMode = mode === 'blind' ? 'dual' : mode;
    setDisplayMode(cleanMode);
    try {
      localStorage.setItem('ytkw_display_mode', cleanMode);
    } catch (e) {}
  };

  const handleCycleDisplayMode = () => {
    const modes = ['dual', 'en_only', 'ko_only'];
    const curIdx = modes.indexOf(displayMode);
    const nextIdx = (curIdx === -1 ? 0 : (curIdx + 1) % modes.length);
    handleDisplayModeChange(modes[nextIdx]);
  };

  // Auto-Skip Intro State (TED 및 영상 오프닝/인트로 자동 건너뛰고 첫 대사부터 시작)
  const [autoSkipIntro, setAutoSkipIntro] = useState(() => {
    try {
      const saved = localStorage.getItem('ytkw_skip_intro');
      return saved !== null ? saved === 'true' : true; // Default ON
    } catch (e) {
      return true;
    }
  });
  const introSkippedRef = useRef('');

  const handleToggleAutoSkipIntro = () => {
    const next = !autoSkipIntro;
    setAutoSkipIntro(next);
    try {
      localStorage.setItem('ytkw_skip_intro', String(next));
    } catch (e) {}
    showVocabToast(next ? '⚡ 첫 자막(인트로 건너뛰기) 자동 시작 ON' : '⏸️ 인트로 건너뛰기 OFF (0초부터 시작)', 'info');
  };

  // Smart Gap Skip (대화 사이의 긴 포즈/무음 자동 건너뛰기 - 딕션 훈련 최적화)
  const [smartGapSkip, setSmartGapSkip] = useState(() => {
    try {
      const saved = localStorage.getItem('ytkw_smart_gap_skip');
      return saved !== null ? saved === 'true' : true; // Default ON
    } catch (e) {
      return true;
    }
  });
  const smartGapSkipRef = useRef(smartGapSkip);
  const lastGapSkipRef = useRef(0);
  useEffect(() => {
    smartGapSkipRef.current = smartGapSkip;
  }, [smartGapSkip]);

  const handleToggleSmartGapSkip = () => {
    const next = !smartGapSkip;
    setSmartGapSkip(next);
    smartGapSkipRef.current = next;
    try {
      localStorage.setItem('ytkw_smart_gap_skip', String(next));
    } catch (e) {}
    showVocabToast(next ? '⚡ 긴 포즈/무음 자동 건너뛰기 ON (대화 연속 재생)' : '⏸️ 포즈 자동 건너뛰기 OFF', 'info');
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

  // 1. Fetch transcript from backend when currentVideo changes
  useEffect(() => {
    if (!currentVideo?.videoId) return;
    let isMounted = true;
    setLoadingTranscript(true);
    setTranscriptError(null);
    setTranscript([]);
    setActiveIndex(-1);
    setCurrentTime(0);

    const langParam = currentVideo.language ? `?lang=${encodeURIComponent(currentVideo.language)}` : '';
    fetch(`${API_BASE}/transcript/${currentVideo.videoId}${langParam}`)
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
  }, [currentVideo?.videoId, currentVideo?.language]);

  // 1-1. Auto-skip intro to first spoken sentence (TED & 영상 오프닝 음악/로고 자동 건너뛰기)
  useEffect(() => {
    if (!autoSkipIntro || !currentVideo?.videoId) return;
    if (transcript.length === 0) return;
    if (introSkippedRef.current === currentVideo.videoId) return;

    const firstLine = transcript[0];
    if (firstLine && typeof firstLine.start === 'number' && firstLine.start >= 1.0) {
      if (bgAudioMode && audioRef.current) {
        introSkippedRef.current = currentVideo.videoId;
        const targetTime = Math.max(0, firstLine.start - 0.1);
        audioRef.current.currentTime = targetTime;
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
        setActiveIndex(0);
        showVocabToast(`⚡ 인트로 건너뛰기: 첫 문장(${firstLine.start.toFixed(1)}초)부터 시작`, 'info');
      } else if (playerReady && player && typeof player.seekTo === 'function') {
        introSkippedRef.current = currentVideo.videoId;
        const targetTime = Math.max(0, firstLine.start - 0.1);
        player.seekTo(targetTime, true);
        player.playVideo();
        setIsPlaying(true);
        setActiveIndex(0);
        showVocabToast(`⚡ 인트로 건너뛰기: 첫 문장(${firstLine.start.toFixed(1)}초)부터 시작`, 'info');
      }
    } else if (firstLine && typeof firstLine.start === 'number' && firstLine.start < 1.0) {
      introSkippedRef.current = currentVideo.videoId;
    }
  }, [currentVideo?.videoId, transcript, playerReady, player, bgAudioMode, autoSkipIntro]);

  // 2. Direct audio stream endpoint for robust background playback
  const getAudioStreamUrl = (videoId) => {
    return `${API_BASE}/audio-stream/${videoId}`;
  };

  // 2-1. Background Audio Auto-play on Video Change
  useEffect(() => {
    if (bgAudioMode && currentVideo?.videoId && audioRef.current) {
      setLoadingAudio(true);
      const streamSrc = getAudioStreamUrl(currentVideo.videoId);
      audioRef.current.src = streamSrc;

      let startT = 0;
      if (autoSkipIntro && transcript.length > 0 && transcript[0]?.start >= 1.0 && introSkippedRef.current !== currentVideo?.videoId) {
        introSkippedRef.current = currentVideo?.videoId;
        startT = Math.max(0, transcript[0].start - 0.1);
        showVocabToast(`⚡ 인트로 건너뛰기: 첫 문장(${transcript[0].start.toFixed(1)}초)부터 시작`, 'info');
      }
      audioRef.current.currentTime = startT;
      audioRef.current.playbackRate = playbackRate;
      
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setLoadingAudio(false);
        if (startT > 0) setActiveIndex(0);
      }).catch(() => {
        setLoadingAudio(false);
      });
    }
  }, [currentVideo?.videoId, bgAudioMode, autoSkipIntro, transcript]);

  // 3. Initialize YouTube IFrame API
  useEffect(() => {
    if (!currentVideo?.videoId) return;
    let ytPlayer = null;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return;
      ytPlayer = new window.YT.Player('lr-yt-embed', {
        videoId: currentVideo.videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          fs: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            try {
              const iframe = event.target.getIframe();
              if (iframe) {
                iframe.setAttribute('allowfullscreen', 'true');
                iframe.setAttribute('webkitallowfullscreen', 'true');
                iframe.setAttribute('mozallowfullscreen', 'true');
                iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen');
              }
            } catch (e) {}
            setPlayer(event.target);
            setPlayerReady(true);
            setDuration(event.target.getDuration() || 0);
            if (playbackRate !== 1) {
              try { event.target.setPlaybackRate(playbackRate); } catch (e) {}
            }
            if (!bgAudioMode) {
              if (autoSkipIntro && transcript.length > 0 && transcript[0]?.start >= 1.0 && introSkippedRef.current !== currentVideo?.videoId) {
                introSkippedRef.current = currentVideo?.videoId;
                const targetTime = Math.max(0, transcript[0].start - 0.1);
                event.target.seekTo(targetTime, true);
                event.target.playVideo();
                setIsPlaying(true);
                setActiveIndex(0);
                showVocabToast(`⚡ 인트로 건너뛰기: 첫 문장(${transcript[0].start.toFixed(1)}초)부터 시작`, 'info');
              } else {
                event.target.playVideo();
              }
            }
          },
          onStateChange: (event) => {
            if (event.data === 1) {
              setIsPlaying(true);
            } else if (event.data === 0) {
              // Video Ended -> Sequential Loop / Repeat handling
              handleVideoEnded(event.target);
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
  }, [currentVideo?.videoId]);

  const seekLockRef = useRef(null);

  // Helper: Find subtitle index accurately without false positive overlap to previous subtitle
  const findSubtitleIndex = (subtitles, time) => {
    if (!subtitles || subtitles.length === 0) return -1;
    // 1. Direct hit inside subtitle start/end boundary
    for (let i = 0; i < subtitles.length; i++) {
      const cur = subtitles[i];
      const next = subtitles[i + 1];
      const endLimit = next ? Math.min(cur.end + 0.05, next.start) : cur.end + 0.2;
      if (time >= cur.start && time < endLimit) {
        return i;
      }
    }
    // 2. Nearest prior subtitle
    for (let i = subtitles.length - 1; i >= 0; i--) {
      if (time >= subtitles[i].start) {
        return i;
      }
    }
    return 0;
  };

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
            // SINGLE SENTENCE LOOP MODE: Lock activeIndex strictly to loopingIndex to prevent jitter/dizziness
            if (loopMode === 'single_loop' && loopingIndex !== null) {
              if (activeIndex !== loopingIndex) {
                setActiveIndex(loopingIndex);
              }
              const curLine = transcript[loopingIndex];
              if (curLine) {
                const nextLine = transcript[loopingIndex + 1];
                const loopEndTime = nextLine ? Math.min(curLine.end, nextLine.start) : curLine.end;
                if (t >= loopEndTime || t > curLine.end + 0.3) {
                  handleSeekTo(curLine.start, loopingIndex, true);
                }
              }
            } else {
              // Grace period during explicit seekTo so keyframe offsets don't flash previous line
              if (seekLockRef.current && Date.now() < seekLockRef.current.until) {
                if (activeIndex !== seekLockRef.current.index) {
                  setActiveIndex(seekLockRef.current.index);
                }
              } else {
                const idx = findSubtitleIndex(transcript, t);
                if (idx !== -1 && idx !== activeIndex) {
                  setActiveIndex(idx);

                  if (loopMode === 'pause_after_sentence' && loopingIndex !== null && idx > loopingIndex) {
                    if (bgAudioMode && audioRef.current) audioRef.current.pause();
                    else if (player) player.pauseVideo();
                    setLoopingIndex(null);
                  }
                }

                // ⚡ Smart Gap Skip: 대사 종료 후 다음 대사까지 0.8초 이상 긴 무음/포즈 시 자동으로 다음 대사로 즉시 점프
                if (smartGapSkipRef.current && loopMode === 'none' && activeIndex >= 0 && transcript[activeIndex] && transcript[activeIndex + 1]) {
                  const curLine = transcript[activeIndex];
                  const nextLine = transcript[activeIndex + 1];
                  const now = Date.now();
                  if (t >= curLine.end + 0.1 && (nextLine.start - t) >= 0.8 && (now - lastGapSkipRef.current > 700)) {
                    lastGapSkipRef.current = now;
                    handleSeekTo(Math.max(0, nextLine.start - 0.05), activeIndex + 1, true);
                    return;
                  }
                }
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

      if (currentVideo?.videoId && audioRef.current) {
        const streamUrl = getAudioStreamUrl(currentVideo.videoId);
        audioRef.current.src = streamUrl;
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

  // 7. Auto scroll active subtitle stably without dizziness
  const lastScrolledIndex = useRef(-1);

  useEffect(() => {
    if (scrollMode === 'off' || activeIndex === -1) return;
    if (lastScrolledIndex.current === activeIndex) return;

    if (activeLineRef.current && subtitleListRef.current) {
      lastScrolledIndex.current = activeIndex;

      if (scrollMode === 'smart_page') {
        const container = subtitleListRef.current;
        const line = activeLineRef.current;
        const containerRect = container.getBoundingClientRect();
        const lineRect = line.getBoundingClientRect();

        // Check if active line is getting close to top (15%) or bottom (25%) of container
        const isOutOfView = (lineRect.top < containerRect.top + containerRect.height * 0.15) ||
                            (lineRect.bottom > containerRect.bottom - containerRect.height * 0.25);
        if (isOutOfView) {
          line.scrollIntoView({
            behavior: 'auto',
            block: 'center',
            inline: 'nearest'
          });
        }
      } else if (scrollMode === 'instant') {
        activeLineRef.current.scrollIntoView({
          behavior: 'auto',
          block: 'center',
          inline: 'nearest'
        });
      } else if (scrollMode === 'smooth') {
        activeLineRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    }
  }, [activeIndex, scrollMode]);

  // 8. Jump to subtitle timestamp & play
  const handleSeekTo = (startTime, index = null, shouldPlay = true) => {
    if (index !== null) {
      setActiveIndex(index);
      seekLockRef.current = { index, until: Date.now() + 600 };
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
  const handleWordClick = async (word, e, lineContext = null) => {
    if (e) e.stopPropagation();
    const cleanWord = word.replace(/[^\p{L}'-]/gu, '').trim();
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
        exampleEn: lineContext?.text || data.exampleEn || '',
        exampleKo: lineContext?.translation || data.exampleKo || '',
        meanings: data.meanings || [],
        saveCount: existingFreq,
        loading: false,
      });
    } catch (err) {
      setDictWord({
        word: cleanWord,
        translation: '조회 실패',
        exampleEn: lineContext?.text || '',
        exampleKo: lineContext?.translation || '',
        meanings: [],
        saveCount: existingFreq,
        loading: false,
      });
    }
  };

  // Helper to select clear, natural female voice for TTS
  const getFemaleVoice = (langCode = 'en-US') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (voices.length === 0) return null;

    const prefix = langCode.split('-')[0].toLowerCase();
    const langVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(prefix));
    if (langVoices.length === 0) return null;

    const femaleKeywords = [
      'female', 'woman', 'girl',
      'samantha', 'jenny', 'aria', 'victoria', 'zira', 'karen', 'moira', 'fiona', 'tessa', 'ava', 'allison', 'susan',
      'monica', 'paulina', 'helena', 'laura', 'sofia', 'lucia', 'dalia',
      'tingting', 'xiaoxiao', 'xiaoyi', 'meijia', 'yaoyao', 'huihui',
      'hoaimy', 'gadis', 'siti', 'swara', 'kavya', 'yuna', 'heami', 'sunhi', 'kyoko', 'nanami', 'ayumi'
    ];

    const maleKeywords = [
      'male', 'man', 'boy', 'david', 'mark', 'guy', 'george', 'james', 'daniel', 'tom', 'oliver', 'stefan', 'martin', 'otoya', 'namminh', 'madhur'
    ];

    // 1. Explicit female match
    const bestFemale = langVoices.find(v => {
      const name = v.name.toLowerCase();
      return femaleKeywords.some(kw => name.includes(kw)) && !maleKeywords.some(kw => name.includes(kw));
    });
    if (bestFemale) return bestFemale;

    // 2. Google / Natural / Premium voice (excluding male)
    const naturalVoice = langVoices.find(v => {
      const name = v.name.toLowerCase();
      return !maleKeywords.some(kw => name.includes(kw)) && (name.includes('google') || name.includes('natural') || name.includes('online') || name.includes('neural'));
    });
    if (naturalVoice) return naturalVoice;

    // 3. Fallback non-male voice
    const nonMale = langVoices.find(v => {
      const name = v.name.toLowerCase();
      return !maleKeywords.some(kw => name.includes(kw));
    });

    return nonMale || langVoices[0];
  };

  // 11-1. Native TTS Pronunciation Audio Playback (Multi-lingual support with Female Voice)
  const handleSpeakWord = (text, e) => {
    if (e) e.stopPropagation();
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = currentVideo?.language || (currentVideo?.category === 'spanish' ? 'es' : 'en');
    
    let targetLang = 'en-US';
    if (lang === 'ja' || /[\u3040-\u309F\u30A0-\u30FF]/.test(text || '')) {
      targetLang = 'ja-JP';
    } else if (lang === 'zh' || /[\u4e00-\u9fa5]/.test(text || '')) {
      targetLang = 'zh-CN';
    } else if (lang === 'es' || /[\u00C0-\u00FFñÑáéíóúÁÉÍÓÚ¿¡]/.test(text || '')) {
      targetLang = 'es-ES';
    } else if (lang === 'vi') {
      targetLang = 'vi-VN';
    } else if (lang === 'id') {
      targetLang = 'id-ID';
    } else if (lang === 'hi' || /[\u0900-\u097F]/.test(text || '')) {
      targetLang = 'hi-IN';
    } else if (lang === 'fr') {
      targetLang = 'fr-FR';
    } else if (lang === 'de') {
      targetLang = 'de-DE';
    }

    utterance.lang = targetLang;
    const femaleVoice = getFemaleVoice(targetLang);
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    utterance.rate = 0.9;
    utterance.pitch = 1.06; // 밝고 또렷한 여성 톤
    window.speechSynthesis.speak(utterance);
  };

  // 11-2. Add Word to Vocab-Hub (만능단어장 연동 및 횟수 누적)
  const handleAddToVocabHub = async (item) => {
    if (!item || !item.word || addingToVocab) return;
    setAddingToVocab(true);
    try {
      const vUrl = currentVideo.url || (currentVideo.videoId ? `https://www.youtube.com/watch?v=${currentVideo.videoId}` : '');
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
          videoTitle: currentVideo.title || '',
          videoUrl: vUrl,
          videoId: currentVideo.videoId || ''
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
    const existing = savedSentences.find(s => s.text === line.text && s.videoId === currentVideo.videoId);

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
            videoId: currentVideo.videoId,
            videoTitle: currentVideo.title,
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
      } else if (e.key === '[' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevVideo();
      } else if (e.key === ']' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextVideo();
      } else if (e.key === 's' || e.key === 'S' || e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (activeIndex !== -1 && transcript[activeIndex]) {
          handleSeekTo(transcript[activeIndex].start, activeIndex);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleToggleFullscreen();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        handleSetVideoLayout(videoLayout === 'theater' ? 'half' : 'theater');
      } else if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        } else if (showPlaylistDrawer) {
          setShowPlaylistDrawer(false);
        } else if (showSettings) {
          setShowSettings(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [player, isPlaying, bgAudioMode, activeIndex, transcript, showSettings, showPlaylistDrawer, onClose, currentIndex, effectivePlaylist, videoLayout]);

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getDisplayModeLabel = () => {
    if (displayMode === 'en_only') return '🇺🇸 영문만';
    if (displayMode === 'ko_only') return '🇰🇷 한글만';
    return '🔤 듀얼(영한)';
  };

  // ── Statistics calculation for current video ──
  const curVideoStats = listenStats.videoStats?.[currentVideo.videoId] || { totalListens: 0, sentenceCounts: {}, masteredCount: 0 };
  const totalVideoListens = curVideoStats.totalListens || 0;
  const masteredSentencesCount = curVideoStats.masteredCount || 0;
  const totalTranscriptCount = transcript.length;
  const videoMasteryPct = totalTranscriptCount > 0 ? Math.min(100, Math.round((masteredSentencesCount / totalTranscriptCount) * 100)) : 0;

  const getSentenceCountBadge = (sIdx) => {
    const count = curVideoStats.sentenceCounts?.[sIdx] || 0;
    if (count <= 0) return null;
    let badgeClass = 'sent-count-low';
    let icon = '👁️';
    if (count >= 5) {
      badgeClass = 'sent-count-gold';
      icon = '👑';
    } else if (count >= 3) {
      badgeClass = 'sent-count-emerald';
      icon = '🔥';
    }
    return (
      <span className={`sentence-count-pill ${badgeClass}`} title={`이 문장 총 ${count}회 청취 (반복 훈련됨)`}>
        {icon} {count}회
      </span>
    );
  };

  return (
    <div className="lr-modal-backdrop" onClick={onClose}>
      <div
        className={`lr-studio-container ${hideVideo ? 'layout-text_only' : videoLayout === 'theater' ? 'layout-video_full' : videoLayout === 'compact' ? 'compact-video-mode layout-compact' : 'layout-expanded'} ${bgAudioMode ? 'bg-audio-active' : ''} ${posHighlight ? 'pos-highlight-enabled' : ''} border-theme-${activeBorderColor} highlight-style-${highlightStyle} ${isFullscreen ? 'is-fullscreen' : ''}`}
        style={{ '--sub-font-scale': fontScale }}
        onClick={e => e.stopPropagation()}
      >
        
        {/* Hidden HTML5 Audio Element for Background Lockscreen Playback */}
        <audio
          ref={audioRef}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => handleVideoEnded(null)}
          onError={(e) => {
            console.warn('[Audio] Stream playback error, auto-recovering...', e);
            if (bgAudioMode && currentVideo?.videoId && audioRef.current) {
              const curT = audioRef.current.currentTime || 0;
              showVocabToast('🔄 오디오 스트림 자동 재연결 중...', 'info');
              setTimeout(() => {
                if (audioRef.current && currentVideo?.videoId) {
                  audioRef.current.src = `${getAudioStreamUrl(currentVideo.videoId)}?t=${Date.now()}`;
                  audioRef.current.currentTime = curT;
                  audioRef.current.play().catch(() => {});
                }
              }, 1200);
            }
          }}
          playsInline
          preload="auto"
        />

        {/* COMPACT CLEAN TOP HEADER */}
        <div className="lr-header">
          <div className="lr-title-info">
            <span className="lr-badge">⚡ 쉐도잉</span>
            <h2 title={currentVideo.title}>{currentVideo.title}</h2>
            {/* 🎧 Live Video Listening Stats Badge */}
            {totalVideoListens > 0 && (
              <div
                className={`lr-stats-header-pill ${totalVideoListens >= 50 ? 'pill-gold' : totalVideoListens >= 10 ? 'pill-emerald' : 'pill-sky'}`}
                title={`이 영상 총 청취: ${totalVideoListens}회\n3회 이상 숙달: ${masteredSentencesCount}/${totalTranscriptCount}문장 (${videoMasteryPct}%)`}
              >
                <span className="lsh-icon">{totalVideoListens >= 50 ? '👑' : totalVideoListens >= 10 ? '🌟' : '🎧'}</span>
                <span className="lsh-text"><strong>{totalVideoListens}회</strong></span>
              </div>
            )}
          </div>

          <div className="lr-header-actions">
            {/* 1. 화면 분할 세그먼트 (50:50 / 축소 / 시어터 / 글자만) */}
            {!bgAudioMode && (
              <div className="lr-layout-seg-group">
                <button
                  className={`lr-seg-btn ${!hideVideo && videoLayout === 'half' ? 'active' : ''}`}
                  onClick={() => { if (hideVideo) setHideVideo(false); handleSetVideoLayout('half'); }}
                  title="🗖 50:50 나란히 분할 (영상+자막 균형)"
                >
                  🗖 50:50
                </button>
                <button
                  className={`lr-seg-btn ${!hideVideo && videoLayout === 'compact' ? 'active' : ''}`}
                  onClick={() => { if (hideVideo) setHideVideo(false); handleSetVideoLayout('compact'); }}
                  title="📱 영상 20% 축소 (자막 극대화)"
                >
                  📱 축소
                </button>
                <button
                  className={`lr-seg-btn ${!hideVideo && videoLayout === 'theater' ? 'active' : ''}`}
                  onClick={() => { if (hideVideo) setHideVideo(false); handleSetVideoLayout('theater'); }}
                  title="🖥️ 영상 전체보기 (시어터 모드)"
                >
                  🖥️ 시어터
                </button>
                <button
                  className={`lr-seg-btn ${hideVideo ? 'active text-only-active' : ''}`}
                  onClick={handleToggleHideVideo}
                  title={hideVideo ? "영상 다시 보기" : "영상 숨기고 글자(자막)만 전체 화면 점유"}
                >
                  🔤 글자만
                </button>
              </div>
            )}

            {/* 2. 자막 표시 모드 (듀얼 -> 영문만 -> 한글만) */}
            <button
              className={`lr-icon-btn lr-submode-btn ${displayMode !== 'dual' ? 'active' : ''}`}
              onClick={handleCycleDisplayMode}
              title={`자막 표시 모드 (현재: ${getDisplayModeLabel()})\n• 클릭 시: 🔤 듀얼 ➔ 🇺🇸 영문만 ➔ 🇰🇷 한글만 순환`}
            >
              {getDisplayModeLabel()}
            </button>

            {/* 3. 글자 크기 */}
            <button
              className={`lr-icon-btn lr-font-btn ${fontScale > 1.0 ? 'active' : ''}`}
              onClick={handleFontScaleCycle}
              onWheel={handleFontWheel}
              title={`글자 크기 (현재: ${fontScale.toFixed(1)}x / 최대 2.0배)\n• 클릭: 0.2x씩 순환\n• 마우스 휠: 0.1x씩 미세조절`}
            >
              🔠 {fontScale.toFixed(1)}x
            </button>

            {/* 4. 순차 재생목록 (목록이 1개 초과거나 재생목록 열기) */}
            <button
              className={`lr-icon-btn lr-playlist-btn ${showPlaylistDrawer ? 'active' : ''}`}
              onClick={() => setShowPlaylistDrawer(!showPlaylistDrawer)}
              title="순차 재생목록 열기/닫기"
            >
              📜 목록 ({currentIndex + 1}/{effectivePlaylist.length})
            </button>

            {/* 5. 재생 반복 모드 (전체 순차 무한반복 / 1개 반복 / 1회 순차재생) */}
            <button
              className={`lr-icon-btn lr-repeat-mode-btn ${repeatMode !== 'off' ? 'active' : ''}`}
              onClick={handleCycleRepeatMode}
              title={`재생 반복 모드 (현재: ${repeatMode === 'playlist' ? '전체 순차 무한반복' : repeatMode === 'single' ? '현재 영상 1개 무한반복' : '1회 순차재생'})`}
            >
              {repeatMode === 'playlist' ? '🔁 순차반복' : repeatMode === 'single' ? '🔂 1개반복' : '➡️ 1회'}
            </button>

            {/* 6. 문장 보관함 */}
            <button
              className={`lr-icon-btn ${savedSentences.length > 0 ? 'active' : ''}`}
              onClick={() => setShowSentencesDrawer(true)}
              title="저장한 명문장 보관함 열기"
            >
              🔖 문장함 ({savedSentences.length})
            </button>

            {/* 7. 백그라운드 / 취침 모드 */}
            <button
              className={`lr-icon-btn ${bgAudioMode ? 'bg-active' : ''}`}
              onClick={handleToggleBgAudio}
              title={bgAudioMode ? '백그라운드 모드 끄기 (비디오로 복귀)' : '🎧 백그라운드 취침 모드 (화면 꺼짐 재생)'}
            >
              {loadingAudio ? '⏳ 준비...' : bgAudioMode ? '🌙 취침ON' : '🎧 취침모드'}
            </button>

            {/* 8. 브라우저 전체화면 (HTML5 Fullscreen [F]) */}
            {!bgAudioMode && !hideVideo && (
              <button
                className={`lr-icon-btn ${isFullscreen ? 'active fs-active' : ''}`}
                onClick={handleToggleFullscreen}
                title="⛶ 모니터 100% 전체화면 (단축키: F)"
              >
                {isFullscreen ? '✕ 복귀' : '⛶ 전체'}
              </button>
            )}

            {/* 9. 설정창 (배속, 테두리색, 포즈스킵, 오프닝스킵 등) */}
            <button
              className={`lr-icon-btn ${showSettings ? 'active' : ''}`}
              onClick={() => setShowSettings(!showSettings)}
              title="상세 설정 (재생배속, 품사색상, 테두리색, 포즈스킵, 스크롤방식 등)"
            >
              ⚙️ {playbackRate.toFixed(2)}x
            </button>
          </div>

          <div className="lr-header-fixed-actions">
            <button
              className={`lr-star-btn ${currentVideo.bookmarked ? 'active' : ''}`}
              onClick={() => onToggleBookmark && onToggleBookmark(currentVideo.id)}
              title={currentVideo.bookmarked ? '찜 해제' : '다시보기 찜'}
            >
              {currentVideo.bookmarked ? '⭐' : '☆'}
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

        {/* SETTINGS FLOATING MODAL & BACKDROP */}
        {showSettings && (
          <div className="lr-drawer-backdrop lr-settings-backdrop" onClick={() => setShowSettings(false)}>
            <div className="lr-settings-modal" onClick={e => e.stopPropagation()}>
              <div className="settings-header">
                <div className="settings-header-title">
                  <span className="settings-header-icon">⚙️</span>
                  <h3>쉐도잉 맞춤 상세 설정</h3>
                </div>
                <button
                  className="settings-close-btn"
                  onClick={() => setShowSettings(false)}
                  title="설정창 닫기 (ESC)"
                >
                  ✕
                </button>
              </div>

              <div className="settings-body">
                {/* PLAYLIST REPEAT MODE SETTING */}
                <div className="settings-section">
                  <span className="section-title">🔁 영상 순차 & 반복 재생 모드</span>
                  <div className="settings-btn-grid">
                    <button
                      className={`set-choice-btn ${repeatMode === 'playlist' ? 'active' : ''}`}
                      onClick={() => {
                        setRepeatMode('playlist');
                        repeatModeRef.current = 'playlist';
                        try { localStorage.setItem('ytkw_repeat_mode', 'playlist'); } catch(e) {}
                        showVocabToast('🔁 전체 목록 순차 무한반복 재생 설정', 'info');
                      }}
                    >
                      🔁 전체 순차 무한반복
                    </button>
                    <button
                      className={`set-choice-btn ${repeatMode === 'single' ? 'active' : ''}`}
                      onClick={() => {
                        setRepeatMode('single');
                        repeatModeRef.current = 'single';
                        try { localStorage.setItem('ytkw_repeat_mode', 'single'); } catch(e) {}
                        showVocabToast('🔂 현재 영상 1개 무한반복 재생 설정', 'info');
                      }}
                    >
                      🔂 영상 1개 무한반복
                    </button>
                    <button
                      className={`set-choice-btn ${repeatMode === 'off' ? 'active' : ''}`}
                      onClick={() => {
                        setRepeatMode('off');
                        repeatModeRef.current = 'off';
                        try { localStorage.setItem('ytkw_repeat_mode', 'off'); } catch(e) {}
                        showVocabToast('➡️ 1회 순차재생 (끝나면 정지) 설정', 'info');
                      }}
                    >
                      ➡️ 1회 순차재생
                    </button>
                  </div>
                </div>

                {/* SCROLL TRANSITION MODE (어지러움 방지 스크롤 제어) */}
                <div className="settings-section">
                  <span className="section-title">📜 자막 표시 & 스크롤 이동 방식 (어지러움 방지)</span>
                  <div className="settings-btn-grid">
                    <button
                      className={`set-choice-btn ${scrollMode === 'replace_focus' ? 'active' : ''}`}
                      onClick={() => handleScrollModeChange('replace_focus')}
                      title="화면 스크롤이 전혀 없이(0%), 정중앙 고정 슬롯에서 텍스트 내용만 즉시 교체되는 집중 텔레프롬프터 뷰입니다."
                    >
                      🎯 고정 센터링 내용교체 (스크롤 0%)
                    </button>
                    <button
                      className={`set-choice-btn ${scrollMode === 'instant' ? 'active' : ''}`}
                      onClick={() => handleScrollModeChange('instant')}
                      title="올라가는 미끄럼 효과 없이 눈 깜빡임처럼 즉시 전환되어 어지러움이 없습니다."
                    >
                      ⚡ 초고속 즉시 리스트
                    </button>
                    <button
                      className={`set-choice-btn ${scrollMode === 'smart_page' ? 'active' : ''}`}
                      onClick={() => handleScrollModeChange('smart_page')}
                      title="문장이 화면 아래로 벗어날 때만 한 번에 전환합니다."
                    >
                      📖 스마트 넘김 (벗어날 때만)
                    </button>
                    <button
                      className={`set-choice-btn ${scrollMode === 'smooth' ? 'active' : ''}`}
                      onClick={() => handleScrollModeChange('smooth')}
                      title="기존의 부드러운 스크롤 애니메이션"
                    >
                      🌊 부드러운 슬라이딩
                    </button>
                    <button
                      className={`set-choice-btn ${scrollMode === 'off' ? 'active' : ''}`}
                      onClick={() => handleScrollModeChange('off')}
                      title="자동 스크롤을 끄고 수동으로만 봅니다."
                    >
                      ⏹️ 자동스크롤 끔
                    </button>
                  </div>
                </div>

                {/* HIGHLIGHT STYLE (현재 문장 강조 스타일) */}
                <div className="settings-section">
                  <span className="section-title">✨ 현재 문장 강조 스타일</span>
                  <div className="settings-btn-grid">
                    <button
                      className={`set-choice-btn ${highlightStyle === 'minimal_bar' ? 'active' : ''}`}
                      onClick={() => handleHighlightStyleChange('minimal_bar')}
                      title="눈부신 4면 테두리 대신 좌측 포인트 바로 깔끔하게 표시합니다."
                    >
                      ✨ 좌측 포인트 바 (눈 피로 최소)
                    </button>
                    <button
                      className={`set-choice-btn ${highlightStyle === 'full_box' ? 'active' : ''}`}
                      onClick={() => handleHighlightStyleChange('full_box')}
                      title="사각형 전체를 테두리로 감싸는 스타일"
                    >
                      🔲 사각형 전체 테두리
                    </button>
                    <button
                      className={`set-choice-btn ${highlightStyle === 'text_only' ? 'active' : ''}`}
                      onClick={() => handleHighlightStyleChange('text_only')}
                      title="테두리 없이 글자만 선명하고 밝게 강조합니다."
                    >
                      🔤 글자만 밝게 (테두리 제거)
                    </button>
                  </div>
                </div>

                {/* ACTIVE LINE BORDER COLOR THEME (하늘색 테두리 색상 커스텀) */}
                <div className="settings-section">
                  <div className="section-title-row">
                    <span className="section-title">🎨 강조 테두리 / 포인트 바 색상</span>
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
                  <span className="section-title">🖥️ 화면 구성 및 영상 크기</span>
                  <button
                    className={`set-toggle-btn ${hideVideo ? 'active' : ''}`}
                    onClick={handleToggleHideVideo}
                  >
                    {hideVideo ? '✅ 영상 숨김 ON (100% 자막 텍스트만 전체 점유)' : '❌ 영상 표시 중 (클릭 시 영상 숨기기)'}
                  </button>
                  {!hideVideo && (
                    <div className="settings-btn-grid" style={{ marginTop: '4px' }}>
                      <button
                        className={`set-choice-btn ${videoLayout === 'theater' ? 'active' : ''}`}
                        onClick={() => handleSetVideoLayout('theater')}
                      >
                        🖥️ 100% 영상 전체보기
                      </button>
                      <button
                        className={`set-choice-btn ${videoLayout === 'half' ? 'active' : ''}`}
                        onClick={() => handleSetVideoLayout('half')}
                      >
                        🗖 50% 반반 분할
                      </button>
                      <button
                        className={`set-choice-btn ${videoLayout === 'compact' ? 'active' : ''}`}
                        onClick={() => handleSetVideoLayout('compact')}
                      >
                        📱 20% 콤팩트 축소
                      </button>
                      <button
                        className={`set-choice-btn ${isFullscreen ? 'active' : ''}`}
                        onClick={handleToggleFullscreen}
                      >
                        ⛶ 전체화면 [F]
                      </button>
                    </div>
                  )}
                </div>

                <div className="settings-section">
                  <span className="section-title">⚡ 오프닝 / 인트로 자동 건너뛰기</span>
                  <button
                    className={`set-toggle-btn ${autoSkipIntro ? 'active' : ''}`}
                    onClick={handleToggleAutoSkipIntro}
                  >
                    {autoSkipIntro ? '✅ 오프닝/음악 건너뛰고 첫 대사부터 자동 시작 ON' : '❌ 영상 맨 앞(0초)부터 시작 OFF'}
                  </button>
                </div>

                <div className="settings-section">
                  <span className="section-title">🔤 자막 표시 모드</span>
                  <div className="settings-btn-grid">
                    <button
                      className={`set-choice-btn ${displayMode === 'dual' ? 'active' : ''}`}
                      onClick={() => { handleDisplayModeChange('dual'); }}
                    >
                      🔤 영문 + 한글 듀얼
                    </button>
                    <button
                      className={`set-choice-btn ${displayMode === 'en_only' ? 'active' : ''}`}
                      onClick={() => { handleDisplayModeChange('en_only'); }}
                    >
                      🇺🇸 영문 자막만
                    </button>
                    <button
                      className={`set-choice-btn ${displayMode === 'ko_only' ? 'active' : ''}`}
                      onClick={() => { handleDisplayModeChange('ko_only'); }}
                    >
                      🇰🇷 한글 번역만
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
              </div>

              <div className="settings-footer">
                <button
                  className="settings-confirm-btn"
                  onClick={() => setShowSettings(false)}
                >
                  ✓ 설정 완료 및 닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PLAYLIST QUEUE DRAWER / MODAL */}
        {showPlaylistDrawer && (
          <div className="lr-drawer-backdrop" onClick={() => setShowPlaylistDrawer(false)}>
            <div className="lr-playlist-drawer" onClick={e => e.stopPropagation()}>
              <div className="drawer-header">
                <div className="drawer-title-row">
                  <h3>📜 순차 재생목록 ({currentIndex + 1} / {effectivePlaylist.length})</h3>
                  <button className="drawer-close-btn" onClick={() => setShowPlaylistDrawer(false)}>✕</button>
                </div>
                <div className="playlist-mode-bar">
                  <span className="queue-status">반복 설정:</span>
                  <button
                    className={`btn-mode-pill ${repeatMode === 'playlist' ? 'active' : ''}`}
                    onClick={handleCycleRepeatMode}
                  >
                    {repeatMode === 'playlist' ? '🔁 전체 순차 무한반복' : repeatMode === 'single' ? '🔂 영상 1개 무한반복' : '➡️ 1회 순차재생'}
                  </button>
                </div>
              </div>

              <div className="drawer-body">
                <div className="playlist-queue-list">
                  {effectivePlaylist.map((item, idx) => {
                    const isCurrent = idx === currentIndex;
                    return (
                      <div
                        key={item.id || idx}
                        className={`playlist-item-card ${isCurrent ? 'playing-now' : ''}`}
                        onClick={() => {
                          setCurrentIndex(idx);
                          setShowPlaylistDrawer(false);
                        }}
                      >
                        <span className="queue-num">{idx + 1}</span>
                        <div className="queue-thumb-wrap">
                          <img src={item.thumbnailUrl} alt={item.title} />
                          {isCurrent && <span className="playing-badge">▶️ 재생 중</span>}
                        </div>
                        <div className="queue-info">
                          <h4 title={item.title}>{item.title}</h4>
                          <span className="queue-channel">🎙️ {item.channelTitle || 'YouTube'}</span>
                        </div>
                        <span className="queue-duration">{item.duration || ''}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
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
                          {sent.videoId === currentVideo.videoId ? (
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
              <div className="lr-video-wrapper" ref={videoWrapperRef}>
                <div id="lr-yt-embed"></div>
                {/* Fullscreen Overlay HUD (Exit button & Floating subtitle) */}
                {isFullscreen && (
                  <div className="lr-fullscreen-hud">
                    <button
                      className="lr-fs-exit-btn"
                      onClick={handleToggleFullscreen}
                      title="전체화면 종료 (Esc / F)"
                    >
                      ✕ 전체화면 종료 (Esc/F)
                    </button>
                    {activeIndex >= 0 && transcript[activeIndex] && (
                      <div className="lr-fs-sub-overlay">
                        {(displayMode === 'dual' || displayMode === 'en_only') && (
                          <div className="fs-sub-en">{transcript[activeIndex].text}</div>
                        )}
                        {(displayMode === 'dual' || displayMode === 'ko_only') && transcript[activeIndex].translation && (
                          <div className="fs-sub-ko">{transcript[activeIndex].translation}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SLIM ICON-ONLY CONTROL DECK */}
            <div className="lr-control-deck">
              <div className="lr-icon-controls">
                {/* PREVIOUS VIDEO (영상 단위) */}
                {effectivePlaylist.length > 1 && (
                  <button
                    className="lr-icon-action-btn"
                    onClick={handlePrevVideo}
                    title="이전 영상 ([)"
                  >
                    ⏮️⏮️
                  </button>
                )}

                {/* PREVIOUS SENTENCE (문장 단위) */}
                <button
                  className="lr-icon-action-btn"
                  onClick={() => {
                    const prev = Math.max(0, activeIndex - 1);
                    if (transcript[prev]) handleSeekTo(transcript[prev].start, prev);
                  }}
                  title="이전 문장 (A / ←)"
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
                  title="현재 문장 다시듣기 (S / R)"
                >
                  🔄
                </button>

                {/* NEXT SENTENCE (문장 단위) */}
                <button
                  className="lr-icon-action-btn"
                  onClick={() => {
                    const next = Math.min(transcript.length - 1, activeIndex + 1);
                    if (transcript[next]) handleSeekTo(transcript[next].start, next);
                  }}
                  title="다음 문장 (D / →)"
                >
                  ⏭️
                </button>

                {/* NEXT VIDEO (영상 단위) */}
                {effectivePlaylist.length > 1 && (
                  <button
                    className="lr-icon-action-btn"
                    onClick={handleNextVideo}
                    title="다음 영상 (])"
                  >
                    ⏭️⏭️
                  </button>
                )}

                {/* SINGLE SENTENCE LOOP */}
                <button
                  className={`lr-icon-action-btn ${loopMode === 'single_loop' ? 'loop-active' : ''}`}
                  onClick={(e) => {
                    const targetIdx = (loopingIndex !== null) ? loopingIndex : (activeIndex !== -1 ? activeIndex : 0);
                    handleToggleLineLoop(targetIdx, e);
                  }}
                  title={loopMode === 'single_loop' ? "🔁 현재 문장 무한반복 켜짐 (클릭 시 해제)" : "🔂 현재 문장 1개 무한반복 켜기"}
                >
                  {loopMode === 'single_loop' ? '🔁' : '🔂'}
                </button>

                {/* PLAYLIST REPEAT MODE TOGGLE */}
                <button
                  className={`lr-icon-action-btn ${repeatMode !== 'off' ? 'loop-active' : ''}`}
                  onClick={handleCycleRepeatMode}
                  title={`재생 반복 모드 토글 (현재: ${repeatMode === 'playlist' ? '전체 순차 무한반복' : repeatMode === 'single' ? '영상 1개 무한반복' : '1회 순차재생'})`}
                >
                  🔁
                </button>

                {/* THEATER & FULLSCREEN BUTTONS IN CONTROL DECK */}
                <button
                  className={`lr-icon-action-btn ${videoLayout === 'theater' ? 'loop-active' : ''}`}
                  onClick={() => handleSetVideoLayout(videoLayout === 'theater' ? 'half' : 'theater')}
                  title="영상 전체보기 시어터 모드 [T]"
                >
                  🖥️
                </button>
                <button
                  className={`lr-icon-action-btn ${isFullscreen ? 'loop-active' : ''}`}
                  onClick={handleToggleFullscreen}
                  title="전체화면 [F]"
                >
                  ⛶
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
              ) : scrollMode === 'replace_focus' ? (
                /* 🎯 FIXED CENTER TELEPROMPTER VIEW (CONTENT REPLACEMENT ONLY, ZERO SCROLL) */
                <div className="lr-focus-replace-view">
                  {/* PREVIOUS SENTENCE (UP) */}
                  {activeIndex > 0 && transcript[activeIndex - 1] ? (
                    <div
                      className="focus-sub-card prev-card"
                      onClick={() => handleSeekTo(transcript[activeIndex - 1].start, activeIndex - 1)}
                      title="이전 문장으로 이동 (클릭)"
                    >
                      <div className="focus-card-meta">
                        <span className="focus-tag focus-tag-prev">⬆️ 이전 문장 #{activeIndex}</span>
                        <span className="focus-time">{formatTime(transcript[activeIndex - 1].start)}</span>
                        {getSentenceCountBadge(activeIndex - 1)}
                      </div>
                      <div className="focus-card-text">
                        {(displayMode === 'dual' || displayMode === 'en_only') && (
                          <div className="focus-en-sub">
                            {transcript[activeIndex - 1].text.split(/\s+/).map((word, wIdx) => {
                              if (!word) return null;
                              const posClass = getWordPosClass(word);
                              return (
                                <span
                                  key={wIdx}
                                  className={`clickable-word ${posClass}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleWordClick(word, e, transcript[activeIndex - 1]);
                                  }}
                                  title="단어 사전 & 발음 듣기"
                                >
                                  {word}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {(displayMode === 'dual' || displayMode === 'ko_only') && transcript[activeIndex - 1].translation && (
                          <p className="focus-ko-sub">{transcript[activeIndex - 1].translation}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="focus-sub-card prev-card placeholder">
                      <span className="focus-tag">🎬 영상의 첫 번째 문장입니다</span>
                    </div>
                  )}

                  {/* CURRENT MAIN CENTER SENTENCE (FIXED STATIONARY SLOT) */}
                  {(() => {
                    const curIdx = activeIndex >= 0 ? activeIndex : 0;
                    const line = transcript[curIdx] || transcript[0];
                    if (!line) return null;
                    const isLooping = loopMode === 'single_loop' && loopingIndex === curIdx;
                    const isSaved = savedSentences.some(s => s.text === line.text && s.videoId === currentVideo.videoId);

                    return (
                      <div className={`focus-sub-card current-main-card ${isLooping ? 'looping' : ''}`}>
                        <div className="focus-main-header">
                          <div className="focus-badge-group">
                            <span className="focus-main-badge">🎯 #{curIdx + 1} / {transcript.length}</span>
                            <span className="focus-time-badge">{formatTime(line.start)}</span>
                            {getSentenceCountBadge(curIdx)}
                            {isLooping && (
                              <span className="focus-looping-badge">🔁 문장 반복 중</span>
                            )}
                          </div>
                          <div className="focus-btn-group">
                            <button
                              className={`line-play-btn ${isPlaying ? 'playing' : ''}`}
                              onClick={(e) => handleLinePlayPause(line, curIdx, e)}
                              title={isPlaying ? "이 문장 일시정지 (Space)" : "이 문장 재생 (Space)"}
                            >
                              {isPlaying ? '⏸️' : '▶️'}
                            </button>
                            <button
                              className={`line-loop-btn ${isLooping ? 'active' : ''}`}
                              onClick={(e) => handleToggleLineLoop(curIdx, e)}
                              title={isLooping ? "이 문장 무한반복 해제 (클릭 시 풀림)" : "이 문장만 무한반복 재생"}
                            >
                              🔁
                            </button>
                            <button
                              className={`line-save-btn ${isSaved ? 'active' : ''}`}
                              onClick={(e) => handleToggleSaveSentence(line, e)}
                              title={isSaved ? "문장 저장 해제" : "명문장 보관함에 저장"}
                            >
                              {isSaved ? '🔖' : '☆'}
                            </button>
                          </div>
                        </div>

                        <div className="focus-main-content">
                          {(displayMode === 'dual' || displayMode === 'en_only') && (
                            <div className="focus-main-en">
                              {line.text.split(/\s+/).map((word, wIdx) => {
                                if (!word) return null;
                                const posClass = getWordPosClass(word);
                                return (
                                  <span
                                    key={wIdx}
                                    className={`clickable-word ${posClass}`}
                                    onClick={(e) => handleWordClick(word, e, line)}
                                    title="단어 사전 & 발음 듣기"
                                  >
                                    {word}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {(displayMode === 'dual' || displayMode === 'ko_only') && line.translation && (
                            <div className="focus-main-ko">
                              {line.translation}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* NEXT SENTENCE (DOWN) */}
                  {activeIndex + 1 < transcript.length && transcript[activeIndex + 1] ? (
                    <div
                      className="focus-sub-card next-card"
                      onClick={() => handleSeekTo(transcript[activeIndex + 1].start, activeIndex + 1)}
                      title="다음 문장으로 이동 (클릭)"
                    >
                      <div className="focus-card-meta">
                        <span className="focus-tag focus-tag-next">⬇️ 다음 문장 #{activeIndex + 2}</span>
                        <span className="focus-time">{formatTime(transcript[activeIndex + 1].start)}</span>
                        {getSentenceCountBadge(activeIndex + 1)}
                      </div>
                      <div className="focus-card-text">
                        {(displayMode === 'dual' || displayMode === 'en_only') && (
                          <div className="focus-en-sub">
                            {transcript[activeIndex + 1].text.split(/\s+/).map((word, wIdx) => {
                              if (!word) return null;
                              const posClass = getWordPosClass(word);
                              return (
                                <span
                                  key={wIdx}
                                  className={`clickable-word ${posClass}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleWordClick(word, e, transcript[activeIndex + 1]);
                                  }}
                                  title="단어 사전 & 발음 듣기"
                                >
                                  {word}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {(displayMode === 'dual' || displayMode === 'ko_only') && transcript[activeIndex + 1].translation && (
                          <p className="focus-ko-sub">{transcript[activeIndex + 1].translation}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="focus-sub-card next-card placeholder">
                      <span className="focus-tag">🏁 영상의 마지막 문장입니다</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="lr-sub-lines">
                  {transcript.map((line, idx) => {
                    const isActive = activeIndex === idx;
                    const isLooping = loopMode === 'single_loop' && loopingIndex === idx;
                    const isSaved = savedSentences.some(s => s.text === line.text && s.videoId === currentVideo.videoId);

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
                          {getSentenceCountBadge(idx)}
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
                              {line.text.split(/\s+/).map((word, wIdx) => {
                                if (!word) return null;
                                const posClass = getWordPosClass(word);
                                return (
                                  <span
                                    key={wIdx}
                                    className={`clickable-word ${posClass}`}
                                    onClick={(e) => handleWordClick(word, e, line)}
                                    title="단어 사전 & 발음 듣기"
                                  >
                                    {word}
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
