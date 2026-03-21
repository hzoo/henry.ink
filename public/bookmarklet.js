// Henry.ink Trail Bookmarklet
// Drag this to your bookmark bar to quickly add any page to your trails

javascript:(function(){
  // Get current page info
  const url = encodeURIComponent(window.location.href);
  const title = encodeURIComponent(document.title);
  const selectedText = encodeURIComponent(window.getSelection().toString().trim());
  
  // Build popup URL with page data
  const popupUrl = 'https://henry.ink/tools/quick-mark' +
    '?url=' + url +
    '&title=' + title +
    (selectedText ? '&text=' + selectedText : '');
  
  // Open popup window
  const popup = window.open(
    popupUrl,
    'henry-ink-quick-mark',
    'width=450,height=600,resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no'
  );
  
  // Focus popup window
  if (popup) {
    popup.focus();
  }
})();