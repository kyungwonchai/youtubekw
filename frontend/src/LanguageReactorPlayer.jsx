import React, { useState, useEffect, useRef, useMemo } from 'react';
import './LanguageReactorPlayer.css';

const API_BASE = window.location.pathname.startsWith('/youtubekw') ? '/youtubekw/api' : '/api';

export default function LanguageReactorPlayer({ video, onClose, onToggleBookmark }) {
  const [player, setPlayer] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  
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
  const [dictWord, setDictWord] = useState(null); // { word, phonetic, translation, meanings, loading }
  const [dictPos, setDictPos] = useState({ x: 0, y: 0 });

  const activeLineRef = useRef(null);
  const subtitleListRef = useRef(null);
  const timeUpdateInterval = useRef(null);

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

  // 2. Initialize YouTube IFrame API
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
            event.target.playVideo();
          },
          onStateChange: (event) => {
            // YT.PlayerState.PLAYING = 1, PAUSED = 2, ENDED = 0
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

  // 3. Time polling loop (100ms) for high-precision subtitle sync & loop handling
  useEffect(() => {
    if (!playerReady || !player) return;

    timeUpdateInterval.current = setInterval(() => {
      try {
        const t = player.getCurrentTime();
        if (typeof t === 'number') {
          setCurrentTime(t);

          // Find current active subtitle
          if (transcript.length > 0) {
            const idx = transcript.findIndex(line => t >= line.start && t < line.end + 0.3);
            if (idx !== -1 && idx !== activeIndex) {
              setActiveIndex(idx);

              // Pause after sentence mode
              if (loopMode === 'pause_after_sentence' && loopingIndex !== null && idx > loopingIndex) {
                player.pauseVideo();
                setLoopingIndex(null);
              }
            }

            // Single line loop check
            if (loopMode === 'single_loop' && loopingIndex !== null) {
              const curLine = transcript[loopingIndex];
              if (curLine && t >= curLine.end) {
                player.seekTo(curLine.start, true);
              }
            }
          }
        }
      } catch (e) {}
    }, 100);

    return () => {
      if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
    };
  }, [playerReady, player, transcript, activeIndex, loopMode, loopingIndex]);

  // 4. Auto scroll active subtitle into center
  useEffect(() => {
    if (autoScroll && activeLineRef.current && subtitleListRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, autoScroll]);

  // 5. Jump to subtitle timestamp
  const handleSeekTo = (startTime, index = null) => {
    if (player && typeof player.seekTo === 'function') {
      player.seekTo(startTime, true);
      player.playVideo();
      if (index !== null) {
        setActiveIndex(index);
        if (loopMode === 'single_loop') setLoopingIndex(index);
      }
    }
  };

  // 6. Sentence Loop Toggle
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

  // 7. Change Playback Speed
  const handleRateChange = (rate) => {
    if (player && typeof player.setPlaybackRate === 'function') {
      player.setPlaybackRate(rate);
      setPlaybackRate(rate);
    }
  };

  // 8. Word click dictionary popup
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

  // 9. Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (player) {
          if (isPlaying) player.pauseVideo();
          else player.playVideo();
        }
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        // Previous sentence
        e.preventDefault();
        const prevIdx = Math.max(0, (activeIndex === -1 ? 0 : activeIndex) - 1);
        if (transcript[prevIdx]) handleSeekTo(transcript[prevIdx].start, prevIdx);
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        // Next sentence
        e.preventDefault();
        const nextIdx = Math.min(transcript.length - 1, (activeIndex === -1 ? 0 : activeIndex) + 1);
        if (transcript[nextIdx]) handleSeekTo(transcript[nextIdx].start, nextIdx);
      } else if (e.key === 's' || e.key === 'S' || e.key === 'r' || e.key === 'R') {
        // Replay current sentence
        e.preventDefault();
        if (activeIndex !== -1 && transcript[activeIndex]) {
          handleSeekTo(transcript[activeIndex].start, activeIndex);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [player, isPlaying, activeIndex, transcript, onClose]);

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="lr-modal-backdrop" onClick={onClose}>
      <div className="lr-studio-container" onClick={e => e.stopPropagation()}>
        
        {/* TOP HEADER */}
        <div className="lr-header">
          <div className="lr-title-info">
            <span className="lr-badge">⚡ Language Reactor Mode</span>
            <h2>{video.title}</h2>
            <span className="lr-channel">🎙️ {video.channelTitle}</span>
          </div>

          <div className="lr-header-actions">
            <button
              className={`lr-star-btn ${video.bookmarked ? 'active' : ''}`}
              onClick={() => onToggleBookmark && onToggleBookmark(video.id)}
              title={video.bookmarked ? '찜 해제' : '다시보기 찜'}
            >
              {video.bookmarked ? '⭐ 찜됨' : '☆ 찜하기'}
            </button>
            <button className="lr-close-btn" onClick={onClose} title="닫기 (ESC)">
              ✕
            </button>
          </div>
        </div>

        {/* MAIN BODY: VIDEO (LEFT) + SUBTITLES STREAM (RIGHT) */}
        <div className="lr-main-grid">
          
          {/* LEFT: VIDEO PLAYER & CONTROL DECK */}
          <div className="lr-player-panel">
            <div className="lr-video-wrapper">
              <div id="lr-yt-embed"></div>
            </div>

            {/* QUICK CONTROL BAR */}
            <div className="lr-control-deck">
              <div className="lr-playback-controls">
                <button
                  className="lr-deck-btn"
                  onClick={() => {
                    const prev = Math.max(0, activeIndex - 1);
                    if (transcript[prev]) handleSeekTo(transcript[prev].start, prev);
                  }}
                  title="이전 문장 (A)"
                >
                  ⏮️ 이전 문장
                </button>
                <button
                  className="lr-deck-btn active-highlight"
                  onClick={() => {
                    if (activeIndex !== -1 && transcript[activeIndex]) {
                      handleSeekTo(transcript[activeIndex].start, activeIndex);
                    }
                  }}
                  title="현재 문장 다시듣기 (S)"
                >
                  🔄 현재 문장 반복
                </button>
                <button
                  className="lr-deck-btn"
                  onClick={() => {
                    const next = Math.min(transcript.length - 1, activeIndex + 1);
                    if (transcript[next]) handleSeekTo(transcript[next].start, next);
                  }}
                  title="다음 문장 (D)"
                >
                  다음 문장 ⏭️
                </button>
              </div>

              {/* SPEED & LOOP MODES */}
              <div className="lr-deck-settings">
                <div className="lr-setting-group">
                  <span className="setting-label">⚡ 속도:</span>
                  {[0.75, 0.9, 1.0, 1.25].map(rate => (
                    <button
                      key={rate}
                      className={`rate-btn ${playbackRate === rate ? 'active' : ''}`}
                      onClick={() => handleRateChange(rate)}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>

                <div className="lr-setting-group">
                  <button
                    className={`loop-mode-btn ${loopMode === 'single_loop' ? 'active' : ''}`}
                    onClick={() => {
                      if (loopMode === 'single_loop') {
                        setLoopMode('none');
                        setLoopingIndex(null);
                      } else {
                        setLoopMode('single_loop');
                        setLoopingIndex(activeIndex !== -1 ? activeIndex : 0);
                      }
                    }}
                    title="한 문장 무한 반복 쉐도잉 모드"
                  >
                    🔁 문장 무한반복 {loopMode === 'single_loop' ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* SHORTCUTS GUIDE */}
              <div className="lr-shortcuts-hint">
                <span>⌨️ <strong>단축키:</strong> [Space] 일시정지/재생 | [A/D] 이전/다음 문장 | [S] 현재 문장 반복 | [ESC] 닫기</span>
              </div>
            </div>
          </div>

          {/* RIGHT: REAL-TIME SUBTITLES STREAM (LANGUAGE REACTOR VIEW) */}
          <div className="lr-subtitles-panel">
            
            {/* SUBTITLE DISPLAY MODE SELECTOR */}
            <div className="lr-sub-toolbar">
              <div className="lr-mode-selector">
                <button
                  className={`sub-mode-btn ${displayMode === 'dual' ? 'active' : ''}`}
                  onClick={() => setDisplayMode('dual')}
                >
                  🔤 영문 + 한글 (듀얼)
                </button>
                <button
                  className={`sub-mode-btn ${displayMode === 'en_only' ? 'active' : ''}`}
                  onClick={() => setDisplayMode('en_only')}
                >
                  🇺🇸 영문만
                </button>
                <button
                  className={`sub-mode-btn ${displayMode === 'ko_only' ? 'active' : ''}`}
                  onClick={() => setDisplayMode('ko_only')}
                >
                  🇰🇷 한글만
                </button>
                <button
                  className={`sub-mode-btn ${displayMode === 'blind' ? 'active' : ''}`}
                  onClick={() => setDisplayMode('blind')}
                  title="자막 가리기 (리스닝 훈련)"
                >
                  🙈 블라인드
                </button>
              </div>

              <button
                className={`autoscroll-btn ${autoScroll ? 'active' : ''}`}
                onClick={() => setAutoScroll(!autoScroll)}
                title="자동 스크롤 켜기/끄기"
              >
                📜 자동스크롤 {autoScroll ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* SUBTITLES LIST */}
            <div className="lr-sub-list-container" ref={subtitleListRef}>
              {loadingTranscript ? (
                <div className="lr-sub-loading">
                  <div className="spinner large"></div>
                  <p>실시간 전문 자막 및 한글 번역 로딩 중...</p>
                </div>
              ) : transcriptError ? (
                <div className="lr-sub-error">
                  <div className="error-icon">⚠️</div>
                  <p>{transcriptError}</p>
                  <span>유튜브 플레이어 자체 자막(CC)을 켜고 시청하실 수 있습니다.</span>
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
                        {/* TIMESTAMP & ACTIONS */}
                        <div className="line-meta">
                          <span className="line-time">⏱️ {formatTime(line.start)}</span>
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
                          {/* ENGLISH TEXT (Interactive Words) */}
                          {(displayMode === 'dual' || displayMode === 'en_only') && (
                            <div className="line-en">
                              {line.text.split(' ').map((word, wIdx) => (
                                <span
                                  key={wIdx}
                                  className="clickable-word"
                                  onClick={(e) => handleWordClick(word, e)}
                                  title="클릭하여 단어 사전 보기"
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

                          {/* BLIND MODE PLACEHOLDER */}
                          {displayMode === 'blind' && (
                            <div className="line-blind-placeholder">
                              🔒 [자막 숨김 모드 - 귀로 집중하여 들어보세요]
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
