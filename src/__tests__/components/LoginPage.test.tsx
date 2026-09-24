import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from '../../pages/auth/LoginPage';
import * as AuthContextModule from '../../contexts/AuthContext';

describe('LoginPage Component', () => {
  it('should render email, password inputs and sign-in button', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      currentUser: null,
      userProfile: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      resetPassword: vi.fn(),
      refreshProfile: vi.fn(),
    });

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    expect(screen.getByPlaceholderText('accounts@yourbusiness.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText('CollectFlow')).toBeInTheDocument();
  });
});
