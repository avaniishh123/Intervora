import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { authAPI } from '../services/api';
import '../styles/AuthPages.css';

interface LoginFormData {
  email: string;
  password: string;
}

interface ForgotPasswordFormData {
  email: string;
  newPassword: string;
  confirmPassword: string;
}

const LoginPage = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState<string>('');
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState<string>('');
  const [isForgotPasswordLoading, setIsForgotPasswordLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();

  const {
    register: registerForgot,
    handleSubmit: handleSubmitForgot,
    formState: { errors: forgotErrors },
    watch: watchForgot,
    reset: resetForgot
  } = useForm<ForgotPasswordFormData>();

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Login error:', error);

      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
      const isNetwork = error.code === 'ERR_NETWORK' || error.message === 'Network Error';

      if (isTimeout) {
        setErrorMessage(
          'The server is taking longer than expected to respond. Please try again — it may be waking up after inactivity.'
        );
      } else if (isNetwork) {
        setErrorMessage(
          'Cannot connect to server. Please check your internet connection or try again later.'
        );
      } else if (error.response) {
        setErrorMessage(
          error.response.data?.message ||
          'Login failed. Please check your credentials.'
        );
      } else {
        setErrorMessage('Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onForgotPasswordSubmit = async (data: ForgotPasswordFormData) => {
    setIsForgotPasswordLoading(true);
    setForgotPasswordError('');
    setForgotPasswordSuccess('');

    try {
      const response = await authAPI.forgotPassword(
        data.email,
        data.newPassword,
        data.confirmPassword
      );
      
      setForgotPasswordSuccess(response.message || 'Password updated successfully, please sign in');
      resetForgot();
      
      // Auto-close forgot password form after 2 seconds
      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotPasswordSuccess('');
      }, 2000);
    } catch (error: any) {
      console.error('Forgot password error:', error);

      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
      const isNetwork = error.code === 'ERR_NETWORK' || error.message === 'Network Error';

      if (isTimeout) {
        setForgotPasswordError(
          'The server is taking longer than expected. Please try again.'
        );
      } else if (isNetwork) {
        setForgotPasswordError(
          'Cannot connect to server. Please ensure the backend is running.'
        );
      } else if (error.response) {
        setForgotPasswordError(
          error.response.data?.message ||
          'Failed to reset password. Please try again.'
        );
      } else {
        setForgotPasswordError('Failed to reset password. Please try again.');
      }
    } finally {
      setIsForgotPasswordLoading(false);
    }
  };

  const handleForgotPasswordClick = () => {
    setShowForgotPassword(true);
    setErrorMessage('');
    setForgotPasswordError('');
    setForgotPasswordSuccess('');
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
    setForgotPasswordError('');
    setForgotPasswordSuccess('');
    resetForgot();
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>{showForgotPassword ? 'Reset Password' : 'Welcome Back'}</h1>
          <p>
            {showForgotPassword
              ? 'Enter your email and new password'
              : 'Sign in to continue your interview preparation'}
          </p>
        </div>

        {!showForgotPassword ? (
          <>
            <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
              {errorMessage && (
                <div className="error-message" role="alert">
                  {errorMessage}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                  className={errors.email ? 'input-error' : ''}
                  placeholder="Enter your email"
                  disabled={isLoading}
                />
                {errors.email && (
                  <span className="field-error">{errors.email.message}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters',
                    },
                  })}
                  className={errors.password ? 'input-error' : ''}
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                {errors.password && (
                  <span className="field-error">{errors.password.message}</span>
                )}
              </div>

              <div className="forgot-password-link-container">
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={handleForgotPasswordClick}
                  disabled={isLoading}
                >
                  Forgot Password?
                </button>
              </div>

              <button 
                type="submit" 
                className="auth-button"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                Don't have an account?{' '}
                <Link to="/signup" className="auth-link">
                  Sign up
                </Link>
              </p>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={handleSubmitForgot(onForgotPasswordSubmit)} className="auth-form">
              {forgotPasswordError && (
                <div className="error-message" role="alert">
                  {forgotPasswordError}
                </div>
              )}

              {forgotPasswordSuccess && (
                <div className="success-message" role="alert">
                  {forgotPasswordSuccess}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  {...registerForgot('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                  className={forgotErrors.email ? 'input-error' : ''}
                  placeholder="Enter your registered email"
                  disabled={isForgotPasswordLoading}
                />
                {forgotErrors.email && (
                  <span className="field-error">{forgotErrors.email.message}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  {...registerForgot('newPassword', {
                    required: 'New password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters',
                    },
                    pattern: {
                      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                      message: 'Password must contain uppercase, lowercase, and number',
                    },
                  })}
                  className={forgotErrors.newPassword ? 'input-error' : ''}
                  placeholder="Enter new password"
                  disabled={isForgotPasswordLoading}
                />
                {forgotErrors.newPassword && (
                  <span className="field-error">{forgotErrors.newPassword.message}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="confirm-password">Confirm Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  {...registerForgot('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (value) =>
                      value === watchForgot('newPassword') || 'Passwords do not match',
                  })}
                  className={forgotErrors.confirmPassword ? 'input-error' : ''}
                  placeholder="Confirm new password"
                  disabled={isForgotPasswordLoading}
                />
                {forgotErrors.confirmPassword && (
                  <span className="field-error">{forgotErrors.confirmPassword.message}</span>
                )}
              </div>

              <button 
                type="submit" 
                className="auth-button"
                disabled={isForgotPasswordLoading}
              >
                {isForgotPasswordLoading ? 'Resetting...' : 'Reset Password'}
              </button>

              <button
                type="button"
                className="back-to-login-button"
                onClick={handleBackToLogin}
                disabled={isForgotPasswordLoading}
              >
                Back to Login
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
