import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getSessionToken, clearSessionToken } from '../lib/api';

interface RequireAuthProps {
  children: React.ReactElement;
}

function isTokenStructurallyValid(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);
    if (!payload || (payload.role !== 'master' && payload.role !== 'operator')) return false;
    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const location = useLocation();
  const token = getSessionToken();

  if (!token || !isTokenStructurallyValid(token)) {
    if (token) clearSessionToken();
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};
