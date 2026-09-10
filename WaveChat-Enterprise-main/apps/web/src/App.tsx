import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { ChatPage } from './pages/ChatPage';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-center"><div className="loader" /></div>;
  return user ? <ChatPage /> : <Navigate to="/auth" replace />;
}
export default function App() {
  const { user } = useAuth();
  return <Routes>
    <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
    <Route path="/" element={<Protected />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
