import { useState, useEffect, useCallback, useRef } from 'react';

export default function ServerBadge() {
  const [serverId, setServerId] = useState(localStorage.getItem('currentServerId') || 'Loading...');
  const [isChecking, setIsChecking] = useState(false);
  const intervalRef = useRef(null);

  // Extract short server ID (A, B, C, D, E) from full server ID
  const getShortServerId = (fullServerId) => {
    if (!fullServerId || fullServerId === 'Loading...') return '?';
    
    // Extract letter from patterns like:
    // "BE1-EC2-A-Shard-A" → "A"
    // "BE1-EC2-B-Shard-B" → "B"
    // "BE1-EC2-C-Shard-C" → "C"
    // "BE1-EC2-D" → "D" (Main Backend)
    // "FE-EC2-E" → "E" (Frontend)
    const match = fullServerId.match(/EC2-([ABCDE])/i);
    if (match) {
      return match[1].toUpperCase();
    }
    
    // Fallback: try to find any single letter A-E
    const letterMatch = fullServerId.match(/\b([ABCDE])\b/i);
    if (letterMatch) {
      return letterMatch[1].toUpperCase();
    }
    
    // If no match, return first 3 chars
    return fullServerId.substring(0, 3);
  };

  // Check backend health
  const checkBackendHealth = useCallback(async () => {
    if (isChecking) return; // Prevent multiple concurrent checks
    
    try {
      setIsChecking(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/health`, {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.server) {
          setServerId(data.server);
          localStorage.setItem('currentServerId', data.server);
        }
      }
    } catch (err) {
      console.error('Failed to fetch server ID:', err);
    } finally {
      setIsChecking(false);
    }
  }, [isChecking]);

  useEffect(() => {
    // Listen for server ID updates from API responses
    const handleServerIdUpdate = (event) => {
      setServerId(event.detail);
    };
    
    window.addEventListener('serverIdUpdate', handleServerIdUpdate);
    
    // Initial check on mount
    checkBackendHealth();
    
    // Set up periodic health check every 5 seconds (only for badge update)
    intervalRef.current = setInterval(() => {
      checkBackendHealth();
    }, 5000);
    
    return () => {
      window.removeEventListener('serverIdUpdate', handleServerIdUpdate);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkBackendHealth]);

  const shortServerId = getShortServerId(serverId);

  return (
    <span 
      className="text-xs font-bold text-white px-2 py-1 rounded-full min-w-[24px] text-center transition-all duration-300 cursor-pointer hover:scale-110"
      style={{
        backgroundColor: 
          shortServerId === 'A' ? '#3B82F6' : // Blue for A (Distributed Backend)
          shortServerId === 'B' ? '#10B981' : // Green for B (Distributed Backend)
          shortServerId === 'C' ? '#F59E0B' : // Orange for C (Distributed Backend)
          shortServerId === 'D' ? '#8B5CF6' : // Purple for D (Main Backend)
          shortServerId === 'E' ? '#EC4899' : // Pink for E (Frontend)
          '#6B7280', // Gray for unknown
        boxShadow: isChecking ? '0 0 10px rgba(255,255,255,0.5)' : 'none',
      }}
      title={`Backend: ${serverId}${isChecking ? ' (Checking...)' : ''}\nClick to refresh`}
      onClick={checkBackendHealth}
    >
      {shortServerId}
    </span>
  );
}
