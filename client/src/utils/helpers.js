import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

export const formatDate = (date) => {
  const d = new Date(date);
  if (isToday(d)) {
    return `Today at ${format(d, 'h:mm a')}`;
  }
  if (isYesterday(d)) {
    return `Yesterday at ${format(d, 'h:mm a')}`;
  }
  return format(d, 'MMM d, yyyy h:mm a');
};

export const formatRelativeTime = (date) => {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

export const getRiskLevel = (score) => {
  if (score >= 80) return 'red';
  if (score >= 60) return 'orange';
  if (score >= 40) return 'elevated';
  return 'safe';
};

export const getRiskColor = (score) => {
  const level = getRiskLevel(score);
  const colors = {
    safe: '#10b981',
    elevated: '#f59e0b',
    orange: '#f97316',
    red: '#ef4444',
  };
  return colors[level];
};

export const getRiskLabel = (score) => {
  const level = getRiskLevel(score);
  const labels = {
    safe: 'Safe',
    elevated: 'Elevated',
    orange: 'Warning',
    red: 'Critical',
  };
  return labels[level];
};

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

export const isNightTime = () => {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 5;
};

export const classNames = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

export const truncate = (str, length = 50) => {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

/**
 * Check proximity to tagged locations
 * Returns context message like "At home" or "Near work"
 */
export const getProximityContext = (userLocation, taggedLocations = []) => {
  if (!userLocation || !taggedLocations.length) {
    return null;
  }

  const { latitude: userLat, longitude: userLon } = userLocation;

  // Check each tagged location
  for (const location of taggedLocations) {
    const distance = calculateDistance(userLat, userLon, location.latitude, location.longitude);

    // Exact location - within 50 meters
    if (distance <= 50) {
      return {
        type: 'at',
        label: `At ${location.label}`,
        distance,
        location,
      };
    }

    // Near location - within 200 meters
    if (distance <= 200) {
      return {
        type: 'near',
        label: `Near ${location.label}`,
        distance,
        location,
      };
    }
  }

  return null;
};
