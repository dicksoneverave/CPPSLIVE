import React from 'react';
import LoginForm from '../components/auth/LoginForm';

const LoginPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-4">
      <LoginForm />
    </div>
  );
};

export default LoginPage;
