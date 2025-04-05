import { useState, useEffect } from 'react';

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

export const useSession = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  // Check for session timeout
  useEffect(() => {
    const checkSessionTimeout = () => {
      const now = Date.now();
      if (isLoggedIn && (now - lastActivity > SESSION_TIMEOUT)) {
        handleLogout();
      }
    };

    const interval = setInterval(checkSessionTimeout, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [isLoggedIn, lastActivity]);

  // Update last activity on user interaction
  useEffect(() => {
    const updateActivity = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keypress', updateActivity);
    window.addEventListener('click', updateActivity);
    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keypress', updateActivity);
      window.removeEventListener('click', updateActivity);
    };
  }, []);

  // Check for stored login state on mount
  useEffect(() => {
    const storedLoginState = localStorage.getItem('isLoggedIn');
    const storedTeamName = localStorage.getItem('teamName');
    const storedLastActivity = localStorage.getItem('lastActivity');
    
    if (storedLoginState === 'true' && storedTeamName) {
      const lastActivityTime = storedLastActivity ? parseInt(storedLastActivity) : Date.now();
      if (Date.now() - lastActivityTime <= SESSION_TIMEOUT) {
        setIsLoggedIn(true);
        setTeamName(storedTeamName);
        setLastActivity(lastActivityTime);
      } else {
        handleLogout();
      }
    }
  }, []);

  const handleLogin = (teamName: string) => {
    setIsLoggedIn(true);
    setTeamName(teamName);
    setLastActivity(Date.now());
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('teamName', teamName);
    localStorage.setItem('lastActivity', Date.now().toString());
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setTeamName('');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('teamName');
    localStorage.removeItem('lastActivity');
  };

  return {
    isLoggedIn,
    teamName,
    handleLogin,
    handleLogout,
  };
}; 