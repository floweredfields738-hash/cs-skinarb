import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setToken, setUser } from '../store/slices/authSlice';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const userId = searchParams.get('userId');
    const error = searchParams.get('error');

    if (error) {
      console.error('Auth error:', error);
      navigate('/login');
      return;
    }

    if (token && userId) {
      // Store token in Redux and localStorage
      dispatch(setToken(token));
      localStorage.setItem('authToken', token);

      // Fetch user details
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            dispatch(setUser(data.user));
            navigate('/');
          } else {
            navigate('/login');
          }
        })
        .catch(err => {
          console.error('Failed to fetch user:', err);
          navigate('/login');
        });
    } else {
      navigate('/login');
    }
  }, [searchParams, dispatch, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-300">Completing authentication...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
