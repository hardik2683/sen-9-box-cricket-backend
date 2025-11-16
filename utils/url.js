// utils/url.js
function toAbsUploadUrl(req, val) {
  if (!val) return null;
  if (/^https?:\/\//i.test(val)) return val; // already absolute
  const base = `${req.protocol}://${req.get('host')}`;
  if (val.startsWith('/upload/')) return base + val;
  if (val.startsWith('upload/')) return `${base}/${val}`;
  return `${base}/upload/${val}`;
}

module.exports = { toAbsUploadUrl };
