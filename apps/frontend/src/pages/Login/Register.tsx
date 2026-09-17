// ============================================================
// Registration Page (Square Terminal Aesthetics)
// ============================================================
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function Register() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Registration failed');
      }

      setAuth(json.data.accessToken, json.data.refreshToken, json.data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      <Card
        title="Terminal Access // Register"
        style={{ width: '380px', maxWidth: '90vw' }}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--short-bg)',
                border: '1px solid var(--short)',
                color: 'var(--short)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {error}
            </div>
          )}

          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="trader@domain.com"
          />

          <Input
            label="Password (min 8 characters)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />

          <Button type="submit" variant="primary" disabled={loading} style={{ marginTop: '8px' }}>
            {loading ? 'CREATING ACCOUNT...' : 'REGISTER ACCOUNT'}
          </Button>

          <div
            style={{
              fontSize: '11px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent)' }}>
              Login here
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
