import React, { useState, useEffect, useMemo } from 'react';
import './App.css';

const API_BASE = window.location.pathname.startsWith('/youtubekw') ? '/youtubekw/api' : '/api';

export default function App() {
  const [items, setItems] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [weeklyData, setWeeklyData] = useState({ sessions: [] });
  const [loading, setLoading] = useState(false);
  const [runningWeekly, setRunningWeekly] = useState(false);
  const [activeTab, setActiveTab] = useState('feed'); // 'feed', 'bookmarked', 'weekly', 'speakers'
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all', 'ted_speech', 'essay_deep'
  const [searchQuery, setSearchQuery] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);
  const [toast, setToast] = useState(null);
  const [blockTarget, setBlockTarget] = useState(null); // { item, showModal: boolean }
  const [blocking, setBlocking] = useState(false);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/links`);
      if (!res.ok) throw new Error('데이터를 불러오지 못했습니다.');
      const data = await res.json();
      setItems(data.items || []);
      if (data.speakers) setSpeakers(data.speakers);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklySessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/weekly-sessions`);
      if (res.ok) {
        const data = await res.json();
        setWeeklyData(data);
      }
    } catch (err) {}
  };

  const fetchSpeakers = async () => {
    try {
      const res = await fetch(`${API_BASE}/speakers`);
      if (res.ok) {
        const data = await res.json();
        setSpeakers(data.speakers || []);
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchLinks();
    fetchWeeklySessions();
    fetchSpeakers();
  }, []);

  const handleAddCustomUrl = async (e) => {
    if (e) e.preventDefault();
    if (!customUrl.trim() || addingCustom) return;

    setAddingCustom(true);
    try {
      const res = await fetch(`${API_BASE}/links/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: customUrl.trim(), autoBookmark: true }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '영상 추가에 실패했습니다.');
      }

      showToast(`⭐ "${data.item.title}" 영상이 목록 및 찜에 추가되었습니다!`, 'success');
      setCustomUrl('');
      
      // Update local items state
      setItems(prev => {
        const filtered = prev.filter(i => i.id !== data.item.id && i.videoId !== data.item.videoId);
        return [data.item, ...filtered];
      });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAddingCustom(false);
    }
  };

  const handleToggleBookmark = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/links/${id}/bookmark`, { method: 'POST' });
      if (!res.ok) throw new Error('북마크 업데이트 실패');
      const updated = await res.json();
      setItems(prev => prev.map(item => item.id === id ? updated : item));
      showToast(updated.bookmarked ? '⭐ 보관함(다시보기)에 저장되었습니다.' : '보관함에서 해제되었습니다.', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/links/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('삭제 실패');
      setItems(prev => prev.filter(item => item.id !== id));
      showToast('🗑️ 삭제 완료', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Permanent Blacklist / Dislike (영상 절대안봄 영구 등록)
  const handleConfirmBlock = async () => {
    if (!blockTarget || blocking) return;
    setBlocking(true);
    try {
      const res = await fetch(`${API_BASE}/blacklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: blockTarget.videoId,
          title: blockTarget.title,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '차단 실패');

      // Purge only this specific video from local items
      setItems(prev => prev.filter(i => i.videoId !== blockTarget.videoId && i.id !== blockTarget.id));
      showToast(`🚫 "${blockTarget.title}" 영상이 [절대안봄]으로 영구 등록되었습니다.`, 'error');
      setBlockTarget(null);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBlocking(false);
    }
  };

  // Run Wednesday AI Council manually
  const handleRunWeeklyMeetingNow = async () => {
    if (runningWeekly) return;
    setRunningWeekly(true);
    showToast('🤖 주간 AI 추천 회의 진행 중 (명강사 최근 강연 분석)...', 'info');
    try {
      const res = await fetch(`${API_BASE}/weekly-sessions/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '주간 회의 생성 실패');
      await fetchWeeklySessions();
      showToast('🎉 주간 AI 추천 회의록이 성공적으로 등록되었습니다!', 'success');
      setActiveTab('weekly');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRunningWeekly(false);
    }
  };

  const categories = [
    { id: 'all', label: '✨ 전체 추천 영상' },
    { id: 'ted_speech', label: '🎤 TED & 명품 강연' },
    { id: 'essay_deep', label: '📚 에세이 & 마인드셋' },
    { id: 'long_deep', label: '⏳ 긴 영상 (15분~2시간)' },
  ];

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (activeTab === 'bookmarked' && !item.bookmarked) return false;
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'long_deep') {
          const parts = (item.duration || '').split(':').map(Number);
          let secs = 0;
          if (parts.length === 3) secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
          else if (parts.length === 2) secs = parts[0] * 60 + parts[1];
          if (item.category !== 'long_deep' && secs < 900) return false;
        } else if (item.category !== selectedCategory) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchChannel = item.channelTitle?.toLowerCase().includes(q);
        return matchTitle || matchChannel;
      }
      return true;
    });
  }, [items, activeTab, selectedCategory, searchQuery]);

  const bookmarkedCount = items.filter(i => i.bookmarked).length;

  return (
    <div className="yt-app">
      {toast && <div className={`yt-toast ${toast.type}`}>{toast.message}</div>}

      {/* Confirmation Modal for Permanent Dislike / Video Blacklist */}
      {blockTarget && (
        <div className="modal-backdrop" onClick={() => !blocking && setBlockTarget(null)}>
          <div className="block-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🚫</div>
            <h3>영상 절대안봄 (비추천) 등록</h3>
            <p className="modal-desc">
              <strong>"{blockTarget.title}"</strong><br />
              <span className="channel-highlight">채널: {blockTarget.channelTitle}</span>
            </p>
            <div className="modal-warning-box">
              ⚠️ 이 영상은 <strong>절대안봄 목록</strong>에 등록되어 피드에서 즉시 제거되며, 향후 추천 및 목록에서 <strong>영원히 제외</strong>됩니다.
            </div>
            <div className="modal-actions">
              <button
                className="btn-modal-cancel"
                disabled={blocking}
                onClick={() => setBlockTarget(null)}
              >
                취소
              </button>
              <button
                className="btn-modal-confirm"
                disabled={blocking}
                onClick={handleConfirmBlock}
              >
                {blocking ? '처리 중...' : '🔥 확인 (영상 절대안봄)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom URL Quick Add Bar (Instant Bookmark) */}
      <div className="yt-custom-add-card">
        <form className="yt-custom-add-form" onSubmit={handleAddCustomUrl}>
          <div className="yt-custom-input-wrap">
            <span className="input-icon">🔗</span>
            <input
              type="text"
              className="yt-custom-input"
              placeholder="추가하고 싶은 유튜브 영상 주소 복붙 (예: https://youtu.be/... 또는 watch?v=...)"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              disabled={addingCustom}
            />
            {customUrl && (
              <button
                type="button"
                className="clear-input-btn"
                onClick={() => setCustomUrl('')}
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            className="btn-custom-add"
            disabled={!customUrl.trim() || addingCustom}
          >
            {addingCustom ? (
              <>
                <span className="spinner small"></span>
                <span>불러오는 중...</span>
              </>
            ) : (
              <>
                <span>⭐ 바로 찜 추가</span>
              </>
            )}
          </button>
        </form>
        <div className="custom-add-hint">
          <span>💡 <strong>데이터 보존 원칙:</strong> 내가 찜(⭐)한 영상과 직접 등록한 영상은 <strong>영구 보존</strong>됩니다.</span>
        </div>
      </div>

      {/* 2 Main Categories Focus Pills */}
      {(activeTab === 'feed' || activeTab === 'bookmarked') && (
        <div className="yt-cat-bar">
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`cat-pill ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Clean Navigation & Search Bar */}
      <div className="yt-nav-bar">
        <div className="yt-tabs">
          <button
            className={`tab-btn ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            🔥 추천 쉐도잉 피드 ({items.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'bookmarked' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookmarked')}
          >
            ⭐ 찜한 영상 ({bookmarkedCount})
          </button>
          <button
            className={`tab-btn ${activeTab === 'weekly' ? 'active' : ''}`}
            onClick={() => setActiveTab('weekly')}
          >
            📅 주간 AI 추천 회의록 ({weeklyData.sessions?.length || 0})
          </button>
          <button
            className={`tab-btn ${activeTab === 'speakers' ? 'active' : ''}`}
            onClick={() => setActiveTab('speakers')}
          >
            👥 롤모델 멘토 인재풀 ({speakers.length})
          </button>
        </div>

        {(activeTab === 'feed' || activeTab === 'bookmarked') && (
          <div className="yt-search-box">
            <input
              type="text"
              placeholder="스피커, 강연 주제, 가치관 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search-btn" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main className="yt-main">
        {/* TAB 1 & 2: Video Grid (Feed / Bookmarked) */}
        {(activeTab === 'feed' || activeTab === 'bookmarked') && (
          loading ? (
            <div className="loading-state">
              <div className="spinner large"></div>
              <p>영상을 불러오는 중입니다...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎧</div>
              <h2>준비된 영상이 없습니다.</h2>
              <p>상단의 주소 입력창으로 쉐도잉할 유튜브 영상을 추가하거나, 주간 AI 회의록에서 영상을 확인해보세요.</p>
            </div>
          ) : (
            <div className="yt-grid">
              {filteredItems.map((item, index) => (
                <div key={item.id} className="video-card">
                  <div className="thumb-wrap">
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      <img src={item.thumbnailUrl} alt={item.title} loading="lazy" />
                    </a>
                    <button
                      className={`star-btn ${item.bookmarked ? 'active' : ''}`}
                      onClick={(e) => handleToggleBookmark(item.id, e)}
                      title={item.bookmarked ? "보관 취소" : "다시보기 보관"}
                    >
                      {item.bookmarked ? '⭐' : '☆'}
                    </button>
                    <span className="duration-tag">{item.duration || '10분+'}</span>
                    <span className="cat-badge">
                      {item.category === 'ted_speech' ? '🎤 TED 강연' : item.category === 'long_deep' ? '⏳ 긴 영상' : '📚 에세이·마인드'}
                    </span>
                    <span className="index-tag">#{index + 1}</span>
                  </div>
                  <div className="card-body">
                    <h3 title={item.title}>
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        {item.title}
                      </a>
                    </h3>
                    <div className="channel-meta">
                      <span className="channel-title">🎙️ {item.channelTitle}</span>
                      {item.publishedText && <span className="pub-text">📅 {item.publishedText}</span>}
                    </div>
                    <div className="card-actions">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-play"
                      >
                        ▶ 쉐도잉 시작
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBlockTarget(item);
                        }}
                        className="btn-block"
                        title="해당 영상 비추 (절대안봄 목록에 영구 등록)"
                      >
                        🚫 절대안봄
                      </button>
                      <button
                        onClick={(e) => handleDelete(item.id, e)}
                        className="btn-del"
                        title="목록에서 삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* TAB 3: Weekly Wednesday AI Council Archive */}
        {activeTab === 'weekly' && (
          <div className="weekly-archive-section">
            <div className="weekly-header-bar">
              <div>
                <h2>📅 주간 AI 추천 회의 아카이브</h2>
                <p>매주 수요일 오전 11:00, 롤모델 명강사들의 최근 2년 내 강연 & 에세이를 심층 분석하여 추천 목록을 자동 편찬합니다.</p>
              </div>
              <button
                className="btn-run-weekly"
                disabled={runningWeekly}
                onClick={handleRunWeeklyMeetingNow}
              >
                {runningWeekly ? '🔄 분석 및 회의 진행 중...' : '⚡ 지금 주간 회의 실행'}
              </button>
            </div>

            {(!weeklyData.sessions || weeklyData.sessions.length === 0) ? (
              <div className="empty-state">
                <div className="empty-icon">📅</div>
                <h2>주간 회의 기록이 아직 없습니다.</h2>
                <p>우측 상단의 <strong>[⚡ 지금 주간 회의 실행]</strong> 버튼을 눌러 첫 번째 주간 추천 회의를 시작해보세요!</p>
              </div>
            ) : (
              <div className="weekly-session-list">
                {weeklyData.sessions.map((session, idx) => (
                  <div key={session.id || idx} className="weekly-card">
                    <div className="weekly-card-head">
                      <div className="weekly-badge-group">
                        <span className="weekly-week-badge">{session.weekLabel || session.date}</span>
                        <span className="weekly-date-badge">🕒 매주 수요일 11:00 회의록</span>
                      </div>
                      <h3>{session.meetingTitle}</h3>
                      <p className="weekly-agenda"><strong>📌 회의 안건:</strong> {session.agenda}</p>
                    </div>

                    {session.speakerHighlights && session.speakerHighlights.length > 0 && (
                      <div className="weekly-speakers-box">
                        <h4>🎙️ 금주 집중 분석 멘토 & 딕션 포인트</h4>
                        <div className="highlight-grid">
                          {session.speakerHighlights.map((sp, sIdx) => (
                            <div key={sIdx} className="highlight-pill">
                              <span className="sp-name">✨ {sp.name}</span>
                              <span className="sp-point">{sp.point}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="weekly-summary">📝 {session.summary}</p>

                    <div className="weekly-videos-grid">
                      {session.videos?.map((v, vIdx) => (
                        <div key={v.id || vIdx} className="weekly-vid-card">
                          <img src={v.thumbnailUrl} alt={v.title} />
                          <div className="weekly-vid-content">
                            <h4>{v.title}</h4>
                            <span className="w-chan">{v.channelTitle} • {v.duration}</span>
                            {v.shadowingTip && (
                              <div className="w-tip">
                                <strong>💡 쉐도잉 팁:</strong> {v.shadowingTip}
                              </div>
                            )}
                            <div className="w-actions">
                              <a href={v.url} target="_blank" rel="noopener noreferrer" className="btn-play-sm">
                                ▶ 쉐도잉 시작
                              </a>
                              <button
                                className="btn-add-w"
                                onClick={async () => {
                                  try {
                                    await fetch(`${API_BASE}/links/custom`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ url: v.url, autoBookmark: true }),
                                    });
                                    showToast(`⭐ "${v.title}" 영상이 내 찜 목록에 저장되었습니다!`, 'success');
                                    await fetchLinks();
                                  } catch (e) {
                                    showToast('찜 저장 실패', 'error');
                                  }
                                }}
                              >
                                ⭐ 찜 보관함에 담기
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Role Model Mentors Pool */}
        {activeTab === 'speakers' && (
          <div className="speakers-section">
            <div className="speakers-intro">
              <h2>👥 롤모델 명강사 & CEO 인재풀</h2>
              <p>스피치 훈련과 영어 실력 향상, 인생 마인드셋 정립을 위해 지속적으로 최신 강연을 추적하는 핵심 멘토진입니다.</p>
            </div>

            <div className="speakers-grid">
              {speakers.map(sp => (
                <div key={sp.id} className="speaker-card">
                  <div className="speaker-head">
                    <span className="speaker-avatar">{sp.avatar || '✨'}</span>
                    <div className="speaker-head-text">
                      <div className="speaker-title-row">
                        <h3>{sp.name}</h3>
                        {sp.badge && <span className="speaker-badge-pill">{sp.badge}</span>}
                      </div>
                      <span className="speaker-role">{sp.role}</span>
                    </div>
                  </div>
                  <div className="speaker-body">
                    <div className="speaker-info-row">
                      <span className="label">🎯 핵심 주제:</span>
                      <span className="val">{sp.coreTopics}</span>
                    </div>
                    <div className="speaker-info-row">
                      <span className="label">🗣️ 딕션 특징:</span>
                      <span className="val">{sp.dictionStyle}</span>
                    </div>
                  </div>
                  <button
                    className="btn-filter-speaker"
                    onClick={() => {
                      setSearchQuery(sp.name);
                      setActiveTab('feed');
                      showToast(`🔍 '${sp.name}' 멘토의 영상 검색 결과를 표시합니다.`, 'info');
                    }}
                  >
                    🔍 이 멘토의 영상 보기
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
