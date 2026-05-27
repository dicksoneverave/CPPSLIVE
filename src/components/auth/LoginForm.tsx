import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Login from './pages/Login';
import Logo from '../../components/common/Logo'; // Import the Logo component


const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      
      const { data, error } = await signIn(email, password);
      
      if (error) {
        console.error('Sign in error:', error);
        
        // Handle specific error cases
        switch (error.message) {
          case 'Invalid login credentials':
          case 'Invalid password':
            setError('The email or password you entered is incorrect');
            break;
          case 'Email not confirmed':
            setError('Please verify your email address before logging in');
            break;
          case 'User not found':
            setError('No account found with this email address');
            break;
          case 'Database error while fetching user':
            setError('System error. Please try again later');
            break;
          default:
            setError('An unexpected error occurred. Please try again');
        }
        return;
      }

      if (!data?.session) {
        setError('Failed to create session. Please try again');
        return;
      }
      
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  return (
	
		
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#8B2500]">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">

	 <div className="flex flex-col items-center justify-center ">
        {/* Logo */}
        <Logo size={150}/>
	 </div>
				
        <div className="flex flex-col items-center  mb-6">
          <h1 className="text-2xl font-bold mt-4 text-center">
            OFFICE OF WORKERS COMPENSATION
          </h1>
          <p className="text-gray-600 mt-1 text-center">
            CLAIMS PROCESSING AND PAYMENT SYSTEM
          </p>
        </div>
 
				
        <h2 className="text-xl font-semibold mb-2 text-center">Login</h2>
        <p className="text-gray-500 text-sm mb-6 text-center">
          Enter your credentials to access the system
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md flex items-center">
            <AlertCircle size={16} className="mr-2 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
              <input
                id="email"
                type="email"
                className="input pl-10"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
              <input
                id="password"
                type="password"
                className="input pl-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <button
            type="submit"
            className={`btn btn-primary w-full ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>

          <div className="mt-4 text-center text-sm text-gray-600">
            <p>
              Having trouble logging in? Please contact system administration.
            </p>
            <p className="text-xs mt-2 text-gray-500">
              After login, you'll be directed to your role-specific dashboard based on your user group.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;
