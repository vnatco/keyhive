/** Theme preload — must run synchronously before first paint to prevent flash */
var t = localStorage.getItem('keyhive_theme') || 'system';
document.documentElement.setAttribute('data-theme', t === 'system' ? 'light' : t);
