import React, { useState, useEffect, useMemo } from 'react';
import './App.css';

const API_BASE = window.location.pathname.startsWith('/youtubekw') ? '/youtubekw/api' : '/api';

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [curating, setCurating] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' or 'bookmarked'
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);

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
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  // Realtime 200 Shadowing Videos Curation with SSE Progress Bar
  const handleStartCuration = () => {
    if (curating) return;
    setCurating(true);
    setProgress({ percent: 5, message: '🚀 최근 7일 이내 원어민(20-30대 백인 여성) 200개 쉐도잉 영상 수집 시작...' });

    const eventSource = new EventSource(`${API_BASE}/curate-stream?limit=200`);

    eventSource.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        setProgress({ percent: data.percent || 10, message: data.message || '수집 중...' });
      } catch (err) {}
    });

    eventSource.addEventListener('done', async (e) => {
      try {
        const data = JSON.parse(e.data);
        setProgress({ percent: 100, message: `🎉 수집 완료! 총 ${data.addedCount}개 최신 영상 확보.` });
        showToast(`✅ ${data.addedCount}개의 7일 이내 쉐도잉 영상이 완벽히 수집되었습니다!`, 'success');
        eventSource.close();
        await fetchLinks();
      } catch (err) {}
      setTimeout(() => {
        setCurating(false);
      }, 1500);
    });

    eventSource.addEventListener('error', (e) => {
      eventSource.close();
      setCurating(false);
      showToast('수집 중 연결 오류가 발생했습니다. 다시 시도해주세요.', 'error');
    });
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

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (activeTab === 'bookmarked' && !item.bookmarked) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchChannel = item.channelTitle?.toLowerCase().includes(q);
        return matchTitle || matchChannel;
      }
      return true;
    });
  }, [items, activeTab, searchQuery]);

  const bookmarkedCount = items.filter(i => i.bookmarked).length;

  return (
    <div className="yt-app">
      {toast && <div className={`yt-toast ${toast.type}`}>{toast.message}</div>}

      {/* Main Single-Focus Action Header */}
      <header className="yt-hero-header">
        <div className="yt-hero-title">
          <span className="hero-emoji">🎯</span>
          <div>
            <h1>20-30대 원어민 여성 쉐도잉 초집중</h1>
            <p>최근 7일 이내 업로드 | 구독자 2000명+ | 전분야 200개 스피킹 영상 동적 최신화</p>
          </div>
        </div>

        <div className="yt-hero-action">
          <button
            className={`btn-main-collect ${curating ? 'is-loading' : ''}`}
            disabled={curating}
            onClick={handleStartCuration}
          >
            {curating ? (
              <>
                <span className="spinner"></span>
                <span>200개 수집 중 ({progress.percent}%)</span>
              </>
            ) : (
              <>
                <span className="btn-icon">⚡</span>
                <span>200개 실시간 수집하기</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Realtime Progress Bar */}
      {curating && (
        <div className="yt-progress-container">
          <div className="progress-info">
            <span className="progress-msg">{progress.message}</span>
            <span className="progress-num">{progress.percent}%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progress.percent}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Clean Navigation & Search Bar */}
      <div className="yt-nav-bar">
        <div className="yt-tabs">
          <button
            className={`tab-btn ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            🔥 최신 쉐도잉 피드 ({items.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'bookmarked' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookmarked')}
          >
            ⭐ 찜한 영상 ({bookmarkedCount})
          </button>
        </div>

        <div className="yt-search-box">
          <input
            type="text"
            placeholder="제목, 채널명 즉시 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <main className="yt-main">
        {loading ? (
          <div className="loading-state">
            <div className="spinner large"></div>
            <p>영상을 불러오는 중입니다...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎧</div>
            <h2>준비된 영상이 없습니다.</h2>
            <p>상단의 <strong>[⚡ 200개 실시간 수집하기]</strong> 버튼을 눌러 최근 7일 이내 원어민 쉐도잉 영상을 즉시 채워보세요!</p>
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
        )}
      </main>
    </div>
  );
}
