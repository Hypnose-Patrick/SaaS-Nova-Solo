// Minimal Claude Design runtime — provides DCLogic + boots Component
class DCLogic {
  constructor(props) {
    this.props = props || {};
    this.state = {};
  }
}

// x-dc renders as a transparent wrapper
(function () {
  var s = document.createElement('style');
  s.textContent = 'x-dc{display:contents}helmet{display:none}';
  document.head.appendChild(s);
})();

document.addEventListener('DOMContentLoaded', function () {
  // Extract default props from data-props schema
  var dcScript = document.querySelector('script[type="text/x-dc"][data-dc-script]');
  if (!dcScript) return;

  var props = {};
  try {
    var schema = JSON.parse(dcScript.getAttribute('data-props') || '{}');
    Object.keys(schema).forEach(function (k) {
      var v = schema[k];
      if (v && typeof v === 'object' && 'default' in v) props[k] = v.default;
    });
  } catch (e) {}

  // Inject Component class into page scope
  var script = document.createElement('script');
  script.textContent = dcScript.textContent;
  document.head.appendChild(script);

  // Instantiate and mount (next tick — lets the injected script settle)
  setTimeout(function () {
    try {
      if (typeof Component !== 'undefined') {
        var c = new Component(props);
        if (typeof c.componentDidMount === 'function') c.componentDidMount();
      }
    } catch (e) {
      console.warn('[dc] mount error:', e);
    }
  }, 0);
});
