import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import LoginView from './pages/login/LoginView';
import PageBuilderPage from './pages/page-builder/PageBuilderPage';
import apiService from './services/apiService';
import './styles.css';

function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    apiService.backendCall<{ username: string }>('GET', '/Auth/Me')
      .then(result => { if (result.ok) setUser(result.data!.username); })
      .catch(() => setError('Cannot reach the backend. Check that it is running.'))
      .finally(() => setReady(true));
    const expired = () => { setUser(null); setError('Your session expired. Please sign in again.'); };
    window.addEventListener('pagebuilder:session-expired', expired);
    return () => window.removeEventListener('pagebuilder:session-expired', expired);
  }, []);
  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await apiService.backendCall<{ username: string; message?: string }>('POST', '/Auth/Login', { username, password });
      if (!result.ok) throw new Error(result.status === 429 ? 'Too many sign-in attempts. Try again in a minute.' : result.data?.message || 'Unable to sign in.');
      setUser(result.data!.username); setPassword(''); navigate('/page-builder');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try {
      const result = await apiService.backendCall('POST', '/Auth/Logout');
      if (!result.ok && result.status !== 401) throw new Error('Unable to sign out. Try again.');
      setUser(null); setPassword(''); navigate('/login');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign out.'); }
    finally { setBusy(false); }
  }
  if (!ready) return <p className="loading" role="status">Loading PageBuilder…</p>;
  if (!user) return <LoginView username={username} password={password} onUsernameChange={e => setUsername(e.target.value)} onPasswordChange={e => setPassword(e.target.value)} onSubmit={login} loading={busy} error={error} />;
  return <>
    <header className="app-header"><a href="/page-builder">HedgeTek · PageBuilder</a><span>SQLite workspace</span><span className="app-user">{user}</span><button onClick={logout} disabled={busy}>Logout</button></header>
    <main className="app-main">
      {error && <p role="alert">{error}</p>}
      <Routes>
        <Route path="/page-builder" element={<PageBuilderPage />} />
        <Route path="/pages/:screenCode" element={<PageBuilderPage savedPreview />} />
        <Route path="*" element={<Navigate to="/page-builder" replace />} />
      </Routes>
    </main>
  </>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
