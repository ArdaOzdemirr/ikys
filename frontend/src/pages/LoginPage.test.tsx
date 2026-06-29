import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthProvider } from '../contexts/AuthContext';

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('e-posta, şifre alanlarını ve giriş butonunu gösterir', () => {
    renderLoginPage();

    expect(screen.getByPlaceholderText('ornek@firma.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Giriş Yap' })).toBeInTheDocument();
  });

  it('2FA alanı başlangıçta gizlidir', () => {
    renderLoginPage();
    expect(screen.queryByPlaceholderText('6 haneli kod')).not.toBeInTheDocument();
  });

  it('alanlara yazı yazılabilir', () => {
    renderLoginPage();
    const email = screen.getByPlaceholderText('ornek@firma.com') as HTMLInputElement;
    fireEvent.change(email, { target: { value: 'test@firma.com' } });
    expect(email.value).toBe('test@firma.com');
  });
});
