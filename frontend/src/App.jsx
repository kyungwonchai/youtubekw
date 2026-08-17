import React, { useState, useEffect, useMemo } from 'react';
import './App.css';

export const CHANNELS = [
  { id: 'all', label: '🌟 전체', shortLabel: '전체', icon: '🌟' },
  { id: 'opic_al', label: '🎯 오픽 1급(AL)', shortLabel: '오픽 AL', icon: '🎯' },
  { id: '20s_book', label: '📚 북리뷰', shortLabel: '북리뷰', icon: '📚' },
  { id: 'philosophy', label: '🧠 철학', shortLabel: '철학', icon: '🧠' },
  { id: '20s_shadowing', label: '🗣️ 쉐도잉', shortLabel: '쉐도잉', icon: '🗣️' },
  { id: '20s_algorithm', label: '💻 알고리즘', shortLabel: '알고리즘', icon: '💻' },
  { id: '30s_career', label: '💼 커리어', shortLabel: '커리어', icon: '💼' },
  { id: '20s_vlog', label: '🌸 라이프', shortLabel: '라이프', icon: '🌸' },
  { id: 'ai_lecture', label: '🤖 AI·IT', shortLabel: 'AI·IT', icon: '🤖' },
  { id: 'architect_cs', label: '🏛️ SW 아키텍처', shortLabel: 'SW 아키텍처', icon: '🏛️' },
];

const API_BASE = window.location.pathname.startsWith('/youtubekw') ? '/youtubekw/api' : '/api';

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [curating, setCurating] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('feed');
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [playingItem, setPlayingItem] = useState(null);
  const [toast, setToast] = useState(null);
  const [curationLimit, setCurationLimit] = useState(30);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/links`);
      if (!res.ok) throw new Error('데이터 불러오기 실패');
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

  const handleCurate = async (topics = ['opic_al']) => {
    setCurating(true);
    showToast(`🚀 [${topics.join(', ')}] 영상 수집을 시작합니다...`, 'info');
    try {
      const res = await fetch(`${API_BASE}/curate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelPresetIds: topics,
          limit: curationLimit,
          replaceExisting: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '수집 실패');
      showToast(`✅ ${data.addedCount}개 영상 수집 완료!`, 'success');
      await fetchLinks();
    } catch (err) {
      showToast(`❌ 수집 오류: ${err.message}`, 'error');
    } finally {
      setCurating(false);
    }
  };

  const handleToggleBookmark = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/links/${id}/bookmark`, { method: 'POST' });
      if (!res.ok) throw new Error('북마크 변경 실패');
      const updated = await res.json();
      setItems(prev => prev.map(item => item.id === id ? updated : item));
      showToast(updated.bookmarked ? '⭐ 다시보기에 저장되었습니다.' : '다시보기 해제됨', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
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
      if (activeSubTab === 'watch_later' && !item.bookmarked) return false;
      if (selectedChannel !== 'all') {
        const matchPreset = item.channelPresetId === selectedChannel || item.category === selectedChannel;
        if (!matchPreset) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchChannel = item.channelTitle?.toLowerCase().includes(q);
        return matchTitle || matchChannel;
      }
      return true;
    });
  }, [items, activeSubTab, selectedChannel, searchQuery]);

  const watchLaterCount = items.filter(i => i.bookmarked).length;

  return (
    <div className="yt-app">
      {toast && <div className={`yt-toast ${toast.type}`}>{toast.message}</div>}

      <header className="yt-header">
        <div className="yt-logo">
          <span className="yt-icon">🎬</span>
          <div>
            <h1>YouTubeKW</h1>
            <p>고품질 영상 큐레이션 & 원어민 쉐도잉 & 테크/인사이트</p>
          </div>
        </div>

        <div className="yt-header-actions">
          <select
            value={curationLimit}
            onChange={(e) => setCurationLimit(Number(e.target.value))}
            className="yt-select"
          >
            <option value={30}>30개</option>
            <option value={40}>40개</option>
            <option value={50}>50개</option>
          </select>
          <button
            className="btn-curate red"
            disabled={curating}
            onClick={() => handleCurate(['opic_al'])}
          >
            🎯 오픽 1급
          </button>
          <button
            className="btn-curate"
            disabled={curating}
            onClick={() => handleCurate(['20s_book'])}
          >
            📚 북리뷰
          </button>
          <button
            className="btn-curate purple"
            disabled={curating}
            onClick={() => handleCurate(['philosophy'])}
          >
            🧠 철학
          </button>
          <button
            className="btn-curate green"
            disabled={curating}
            onClick={() => handleCurate(['20s_shadowing'])}
          >
            🗣️ 쉐도잉
          </button>
          <button
            className="btn-curate orange"
            disabled={curating}
            onClick={() => handleCurate(['20s_algorithm'])}
          >
            💻 알고리즘
          </button>
        </div>
      </header>

      <div className="yt-nav-bar">
        <div className="yt-search-box">
          <input
            type="text"
            placeholder="제목, 채널명 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="yt-tabs">
          <button
            className={`tab-btn ${activeSubTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('feed')}
          >
            📺 피드 ({items.length})
          </button>
          <button
            className={`tab-btn ${activeSubTab === 'watch_later' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('watch_later')}
          >
            ⭐ 다시보기 ({watchLaterCount})
          </button>
        </div>
      </div>

      <div className="yt-category-pills">
        {CHANNELS.map(ch => (
          <button
            key={ch.id}
            className={`pill-btn ${selectedChannel === ch.id ? 'active' : ''}`}
            onClick={() => setSelectedChannel(ch.id)}
          >
            {ch.label}
          </button>
        ))}
      </div>

      <main className="yt-main">
        {loading ? (
          <div className="loading">로딩 중...</div>
        ) : filteredItems.length === 0 ? (
          <div className="empty">영상이 없습니다. 상단 수집 버튼을 눌러보세요!</div>
        ) : (
          <div className="yt-grid">
            {filteredItems.map(item => (
              <div key={item.id} className="video-card">
                <div className="thumb-wrap">
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    <img src={item.thumbnailUrl} alt={item.title} loading="lazy" />
                  </a>
                  <button
                    className={`star-btn ${item.bookmarked ? 'active' : ''}`}
                    onClick={(e) => handleToggleBookmark(item.id, e)}
                  >
                    {item.bookmarked ? '⭐' : '☆'}
                  </button>
                  <span className="duration-tag">{item.duration || '15분+'}</span>
                </div>
                <div className="card-body">
                  <h3 title={item.title}>
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      {item.title}
                    </a>
                  </h3>
                  <div className="meta">
                    <span>📺 {item.channelTitle}</span>
                  </div>
                  <div className="actions">
                    <button onClick={(e) => handleDelete(item.id, e)} className="btn-del">🗑️ 삭제</button>
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
