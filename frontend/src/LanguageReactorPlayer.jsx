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
  
  // Face & Lip Focus Cam Mode (얼굴 2배 원형 집중 모드)
  const [faceFocusMode, setFaceFocusMode] = useState(false);
  const [faceZoom, setFaceZoom] = useState(2.2);
  const [facePos, setFacePos] = useState({ x: 50, y: 35 }); // default focus on speaker face / upper center
  const [showFaceControls, setShowFaceControls] = useState(false);

  // Compact Video Mode (화면 상단 20%만 차지하여 자막 공간 극대화)
  const [compactVideo, setCompactVideo] = useState(true);

  // Background Audio Mode (화면 꺼짐 / 잠금화면 1~2시간 연속 재생 모드)
  const [bgAudioMode, setBgAudioMode] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(false);

  // Settings dropdown popup toggle
  const [showSettings, setShowSettings] = useState(false);

  // Subtitles state
  const [transcript, setTranscript] = useState([]);
  const [loadingTranscript, setLoadingTranscript] = useState(true);
  const [transcriptError, setTranscriptError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);

  // Language Reactor Modes
  const [displayMode, setDisplayMode] = useState('dual'); // 'dual', 'en_only', 'ko_only', 'blind'
  const [loopMode, setLoopMode] = useState('none'); // 'none', 'single_loop', 'pause_after_sentence'
  const [loopingIndex, setLoopingIndex] = useState(null);

  // Word Dictionary Popup
  const [dictWord, setDictWord] = useState(null);
  const [dictPos, setDictPos] = useState({ x: 0, y: 0 });

  const activeLineRef = useRef(null);
  const subtitleListRef = useRef(null);
  const timeUpdateInterval = useRef(null);
  const audioRef = useRef(null);

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

  // 7. Auto scroll active subtitle into center
  useEffect(() => {
    if (autoScroll && activeLineRef.current && subtitleListRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, autoScroll]);

  // 8. Jump to subtitle timestamp
  const handleSeekTo = (startTime, index = null) => {
    if (bgAudioMode && audioRef.current) {
      audioRef.current.currentTime = startTime;
      audioRef.current.play();
      setIsPlaying(true);
    } else if (player && typeof player.seekTo === 'function') {
      player.seekTo(startTime, true);
      player.playVideo();
    }
    if (index !== null) {
      setActiveIndex(index);
      if (loopMode === 'single_loop') setLoopingIndex(index);
    }
  };

  // 9. Sentence Loop Toggle
  const handleToggleLineLoop = (index, e) => {
    if (e) e.stopPropagation();
    if (loopMode === 'single_loop' && loopingIndex === index) {
      setLoopMode('none');
      setLoopingIndex(null);
    } else {
      setLoopMode('single_loop');
      setLoopingIndex(index);
      handleSeekTo(transcript[index].start, index);
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

  // 11. Word click dictionary popup
  const handleWordClick = async (word, e) => {
    if (e) e.stopPropagation();
    const cleanWord = word.replace(/[^a-zA-Z'-]/g, '').trim();
    if (!cleanWord) return;

    const rect = e.target.getBoundingClientRect();
    setDictPos({
      x: Math.min(window.innerWidth - 320, Math.max(20, rect.left - 40)),
      y: rect.bottom + 10,
    });

    setDictWord({ word: cleanWord, loading: true });

    try {
      const res = await fetch(`${API_BASE}/dictionary/lookup?word=${encodeURIComponent(cleanWord)}`);
      const data = await res.json();
      setDictWord({
        word: cleanWord,
        phonetic: data.phonetic || '',
        translation: data.koTranslation || data.translation || '뜻을 불러올 수 없습니다.',
        meanings: data.meanings || [],
        loading: false,
      });
    } catch (err) {
      setDictWord({
        word: cleanWord,
        translation: '조회 실패',
        meanings: [],
        loading: false,
      });
    }
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
        className={`lr-studio-container ${compactVideo ? 'compact-video-mode' : ''} ${bgAudioMode ? 'bg-audio-active' : ''}`}
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
            {/* FACE FOCUS 2X CIRCLE MODE TOGGLE */}
            {!bgAudioMode && (
              <button
                className={`lr-icon-btn ${faceFocusMode ? 'active face-active' : ''}`}
                onClick={() => setFaceFocusMode(!faceFocusMode)}
                title={faceFocusMode ? '얼굴 2배 원형 집중 모드 끄기 (전체 화면으로 복귀)' : '👤 강사 얼굴/입모양 2배 원형 집중 쉐도잉 켜기'}
              >
                {faceFocusMode ? '🎯 입모양 2x ON' : '👤 입모양 2x'}
              </button>
            )}

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

            {/* COMPACT VIDEO TOGGLE ICON (상단 20% 미니 영상 모드) */}
            {!bgAudioMode && (
              <button
                className={`lr-icon-btn ${compactVideo ? 'active' : ''}`}
                onClick={() => setCompactVideo(!compactVideo)}
                title={compactVideo ? '영상 기본 크기로 확대' : '영상 상단 20% 최소화 (자막 공간 극대화)'}
              >
                {compactVideo ? '🗖 영상확대' : '📱 20% 콤팩트'}
              </button>
            )}

            {/* SETTINGS GEAR ICON BUTTON */}
            <button
              className={`lr-icon-btn ${showSettings ? 'active' : ''}`}
              onClick={() => setShowSettings(!showSettings)}
              title="자막 모드, 글자크기 & 세밀배속 설정"
            >
              ⚙️ {getDisplayModeLabel()} ({playbackRate.toFixed(2)}x)
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

        {/* SETTINGS FLOATING DROPDOWN MENU */}
        {showSettings && (
          <div className="lr-settings-dropdown" onClick={e => e.stopPropagation()}>
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

            {/* FACE FOCUS CAM TOGGLE */}
            <div className="settings-section">
              <span className="section-title">👤 입모양·얼굴 2배 원형 집중 모드</span>
              <button
                className={`set-toggle-btn ${faceFocusMode ? 'active' : ''}`}
                onClick={() => setFaceFocusMode(!faceFocusMode)}
              >
                {faceFocusMode ? '🎯 입모양 2배 원형 집중 모드 켜짐' : '👤 입모양 2배 원형 집중 모드 켜기'}
              </button>
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
              <div className={`lr-video-wrapper ${faceFocusMode ? 'face-focus-active' : ''}`}>
                <div
                  className="lr-yt-scaler"
                  style={faceFocusMode ? {
                    transform: `scale(${faceZoom})`,
                    transformOrigin: `${facePos.x}% ${facePos.y}%`,
                  } : undefined}
                >
                  <div id="lr-yt-embed"></div>
                </div>

                {/* Face Focus Cam HUD & Adjuster */}
                {faceFocusMode && (
                  <div className="face-focus-hud">
                    <div className="face-focus-circle-ring"></div>
                    <div className="face-hud-pill">
                      <span>🎯 입모양 2x 집중</span>
                      <button
                        className="hud-cfg-btn"
                        onClick={() => setShowFaceControls(!showFaceControls)}
                        title="얼굴 위치 미세조정"
                      >
                        {showFaceControls ? '✕' : '⚙️ 위치'}
                      </button>
                    </div>

                    {showFaceControls && (
                      <div className="face-pos-popup" onClick={e => e.stopPropagation()}>
                        <span className="pos-title">얼굴 위치 미세조정</span>
                        <div className="pos-dpad">
                          <button className="dpad-btn up" onClick={() => setFacePos(p => ({ ...p, y: Math.max(10, p.y - 7) }))}>▲</button>
                          <div className="dpad-mid">
                            <button className="dpad-btn left" onClick={() => setFacePos(p => ({ ...p, x: Math.max(10, p.x - 7) }))}>◀</button>
                            <button className="dpad-btn center" onClick={() => setFacePos({ x: 50, y: 35 })}>🎯</button>
                            <button className="dpad-btn right" onClick={() => setFacePos(p => ({ ...p, x: Math.min(90, p.x + 7) }))}>▶</button>
                          </div>
                          <button className="dpad-btn down" onClick={() => setFacePos(p => ({ ...p, y: Math.min(90, p.y + 7) }))}>▼</button>
                        </div>
                        <div className="zoom-row">
                          <span>줌:</span>
                          <button className="zoom-btn" onClick={() => setFaceZoom(z => Math.max(1.5, Math.round((z - 0.2) * 10) / 10))}>➖</button>
                          <span>{faceZoom.toFixed(1)}x</span>
                          <button className="zoom-btn" onClick={() => setFaceZoom(z => Math.min(3.5, Math.round((z + 0.2) * 10) / 10))}>➕</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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

                    return (
                      <div
                        key={line.id || idx}
                        ref={isActive ? activeLineRef : null}
                        className={`lr-sub-line ${isActive ? 'active' : ''} ${isLooping ? 'looping' : ''}`}
                        onClick={() => handleSeekTo(line.start, idx)}
                      >
                        {/* TIMESTAMP & QUICK LOOP ICON */}
                        <div className="line-meta">
                          <span className="line-time">{formatTime(line.start)}</span>
                          <button
                            className={`line-loop-btn ${isLooping ? 'active' : ''}`}
                            onClick={(e) => handleToggleLineLoop(idx, e)}
                            title="이 문장 무한 반복"
                          >
                            🔁
                          </button>
                        </div>

                        {/* SUBTITLE TEXT */}
                        <div className="line-content">
                          {/* ENGLISH TEXT */}
                          {(displayMode === 'dual' || displayMode === 'en_only') && (
                            <div className="line-en">
                              {line.text.split(' ').map((word, wIdx) => (
                                <span
                                  key={wIdx}
                                  className="clickable-word"
                                  onClick={(e) => handleWordClick(word, e)}
                                  title="단어 사전"
                                >
                                  {word}{' '}
                                </span>
                              ))}
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
              <span className="dict-word-title">{dictWord.word}</span>
              {dictWord.phonetic && <span className="dict-phonetic">/{dictWord.phonetic}/</span>}
              <button className="dict-close" onClick={() => setDictWord(null)}>✕</button>
            </div>
            
            {dictWord.loading ? (
              <div className="dict-loading">사전 조회 중...</div>
            ) : (
              <div className="dict-body">
                <div className="dict-korean-meaning">
                  <strong>🇰🇷 뜻:</strong> {dictWord.translation}
                </div>
                {dictWord.meanings && dictWord.meanings.length > 0 && (
                  <div className="dict-en-meanings">
                    {dictWord.meanings.map((m, mIdx) => (
                      <div key={mIdx} className="meaning-item">
                        <span className="pos-badge">{m.partOfSpeech}</span>
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
