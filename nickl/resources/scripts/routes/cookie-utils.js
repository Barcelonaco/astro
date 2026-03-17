export const hasJsCookie = typeof window !== "undefined" && typeof window.Cookies !== "undefined";

export const setCookie = (name, value, opts = {}) => {
  if (hasJsCookie) return window.Cookies.set(name, value, opts);
  const days = opts.expires || 182;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; path=${opts.path || "/"}`;
};

export const getCookie = (name) => {
  if (hasJsCookie) return window.Cookies.get(name);
  return document.cookie.split("; ").find(r => r.startsWith(name + "="))?.split("=")[1];
};

export const removeCookie = (name, opts = {}) => {
  if (hasJsCookie) return window.Cookies.remove(name, opts);
  document.cookie = `${name}=; Max-Age=0; path=${opts.path || "/"}`;
};