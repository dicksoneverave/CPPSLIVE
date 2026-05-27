import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-surface to-background flex flex-col">
      {/* Header */}
      <header className="bg-surface-dark border-b border-border py-4 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <img src="/logocrest.png" alt="Logo Crest" className="h-24 w-auto object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-primary">Workers Compensation Claims</h1>
            <p className="text-textSecondary text-sm">Processing and Payment System</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Link to="/login" className="text-textSecondary hover:text-primary transition-colors">
            Login
          </Link>
          <Link to="/register" className="bg-primary text-white px-4 py-2 rounded-md hover:bg-accent transition-colors">
            Register
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-4xl w-full mx-auto">
          <div className="bg-surface-dark rounded-lg shadow-md overflow-hidden">
            <div className="p-8">
              <h2 className="text-3xl font-bold text-primary mb-6">Welcome to the Workers Compensation Claims System</h2>
              <p className="text-textSecondary mb-6">
                This system provides a comprehensive solution for processing and managing workers compensation claims. 
                Whether you're an employer, claims officer, or medical professional, our platform streamlines the entire 
                claims process while maintaining strict compliance with regulatory requirements.
              </p>
              
              <div className="bg-surface p-6 rounded-md mb-8">
                <h3 className="text-xl font-semibold text-textSecondary mb-4">Key Features</h3>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    <span className="text-textSecondary">Digital submission and processing of Form 1112</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    <span className="text-textSecondary">Automated compensation calculation based on incident type</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    <span className="text-textSecondary">Secure document management and attachment system</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    <span className="text-textSecondary">Real-time status tracking for all claims</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    <span className="text-textSecondary">Role-based access for employers, medical professionals, and claims officers</span>
                  </li>
                </ul>
              </div>

              <div className="bg-surface p-6 rounded-md">
                <div className="flex items-start">
                  <AlertCircle className="text-warning h-6 w-6 mr-3 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-medium text-warning mb-2">System Requirements</h3>
                    <p className="text-textSecondary text-sm">
                      Please ensure you have the necessary credentials to access the system. 
                      For technical support or account issues, contact the help desk at helpdesk@compensation.gov.in
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface-dark border-t border-border py-4 px-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="text-textSecondary text-sm mb-4 md:mb-0">
            © {new Date().getFullYear()} Workers Compensation Authority. All rights reserved.
          </div>
          <div className="flex space-x-6">
            <Link to="/privacy" className="text-textSecondary hover:text-primary text-sm">Privacy Policy</Link>
            <Link to="/terms" className="text-textSecondary hover:text-primary text-sm">Terms of Service</Link>
            <Link to="/contact" className="text-textSecondary hover:text-primary text-sm">Contact Us</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
