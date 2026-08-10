(function() {
  var t = localStorage.getItem('color-theme');
  if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  var tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.content = t === 'light' ? '#f5ead0' : '#0d0702';
})();
