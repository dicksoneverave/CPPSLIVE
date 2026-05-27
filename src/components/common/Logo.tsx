import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 48, className = '' }) => {
  return (
    <div 
      className={`flex-shrink-0 relative ${className}`} 
      style={{ width: size, height: size }}
    >
      <img 
        src="https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png"
       // src="https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png"
				alt="Office of Workers Compensation Logo"
        className="w-full h-full object-contain"
      />
    </div>
  );
};

export default Logo;
