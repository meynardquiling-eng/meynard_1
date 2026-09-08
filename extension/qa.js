// QA Score Charts — concept view copied from the "QA Score Charts Concept"
// artifact. Static demo data for now; not wired to a live source.
(function () {
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function statusClass(pct) {
    if (pct == null) return 'nodata';
    if (pct >= 60) return 'good';
    if (pct >= 25) return 'warn';
    return 'critical';
  }

  // Example trainee-level scores for the one class with a full drill-down demo
  // — sums to a 41% class average, matching the row it belongs to.
  var JAMES_TRAINEES = [
    { name: 'Morgan P.', pct: 63 }, { name: 'Priya S.', pct: 56 }, { name: 'Devon K.', pct: 51 },
    { name: 'Aiden K.', pct: 46 }, { name: 'Jordan L.', pct: 43 }, { name: 'Casey R.', pct: 39 },
    { name: 'Maria T.', pct: 36 }, { name: 'Skyler B.', pct: 31 }, { name: 'Reese N.', pct: 26 },
    { name: 'James O.', pct: 19 }
  ];

  var CLASSES = [
    { name: 'Team James — Retention Trans…', status: 'Completed', pct: 41, trainees: 10, drilldown: JAMES_TRAINEES },
    { name: 'Team Carla/Noimyr — (7/27/20…)', status: 'Completed', pct: 38, trainees: 9, drilldown: null },
    { name: 'Team Kevin & Team Mary — Re…', status: 'Completed', pct: null, trainees: null, note: 'File couldn’t be read — check it’s shared with the Drive account.' },
    { name: 'NH Cohort 08/17/2026', status: 'Nesting', pct: null, trainees: null, note: 'No QA file attached yet.' },
    { name: 'NH Cohort 09/07/2026', status: 'Classroom Training', pct: null, trainees: null, note: 'No QA file attached yet.' }
  ];

  var classRowsEl = document.getElementById('classRows');

  function traineePanelHtml(trainees) {
    return trainees.map(function (t) {
      return (
        '<div class="trainee-bar-row">' +
          '<span class="trainee-name">' + escapeHtml(t.name) + '</span>' +
          '<div class="trainee-track"><div class="trainee-fill" style="width:' + Math.max(2, t.pct) + '%;"></div></div>' +
          '<span class="trainee-pct mono">' + t.pct + '%</span>' +
        '</div>'
      );
    }).join('');
  }

  CLASSES.forEach(function (c, idx) {
    var row = document.createElement('div');
    row.className = 'class-row';
    var hasData = c.pct != null;
    var sc = statusClass(c.pct);
    var panelId = 'traineePanel' + idx;

    row.innerHTML =
      '<div class="class-row-top">' +
        '<div class="class-name-wrap">' +
          '<div class="class-name">' + escapeHtml(c.name) + '</div>' +
          '<div class="class-meta">' + escapeHtml(c.status) + (hasData ? ' &middot; ' + c.trainees + ' trainees' : '') + '</div>' +
        '</div>' +
        '<div class="bar-wrap">' +
          '<div class="bar-track' + (hasData ? '' : ' nodata') + '">' +
            (hasData ? '<div class="bar-fill ' + sc + '" style="width:' + Math.max(2, c.pct) + '%;"></div>' : '') +
          '</div>' +
          '<span class="bar-value' + (hasData ? '' : ' nodata') + ' mono">' + (hasData ? c.pct + '%' : 'no data') + '</span>' +
        '</div>' +
        (c.drilldown ? '<button type="button" class="expand-btn" id="expandBtn' + idx + '" aria-expanded="false" aria-controls="' + panelId + '" title="View trainee breakdown" aria-label="View trainee breakdown">+</button>' : '') +
      '</div>' +
      (c.drilldown
        ? '<div class="trainee-panel" id="' + panelId + '" hidden><div class="panel-caption">Per-trainee QA score, this class</div>' + traineePanelHtml(c.drilldown) + '</div>'
        : (!hasData ? '<div class="class-meta" style="margin-top:6px;">' + escapeHtml(c.note) + '</div>' : ''));

    classRowsEl.appendChild(row);

    if (c.drilldown) {
      var btn = row.querySelector('#expandBtn' + idx);
      var panel = row.querySelector('#' + panelId);
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        panel.hidden = open;
      });
    }
  });

  // ---- Trend chart hover tooltip ----
  var tooltip = document.getElementById('trendTooltip');
  var trendWrap = document.getElementById('trendWrap');
  Array.prototype.forEach.call(document.querySelectorAll('.trend-point'), function (pt) {
    function show() {
      var week = pt.getAttribute('data-week');
      var value = pt.getAttribute('data-value');
      var count = pt.getAttribute('data-count');
      tooltip.innerHTML = '<strong>Week ' + week + '</strong><br>' + value + '% avg &middot; ' + count + ' trainees scored';
      var cx = parseFloat(pt.getAttribute('cx'));
      var cy = parseFloat(pt.getAttribute('cy'));
      var svgRect = pt.ownerSVGElement.getBoundingClientRect();
      var wrapRect = trendWrap.getBoundingClientRect();
      var scale = svgRect.width / 640;
      tooltip.style.left = (svgRect.left - wrapRect.left + cx * scale) + 'px';
      tooltip.style.top = (svgRect.top - wrapRect.top + cy * scale - 10) + 'px';
      tooltip.classList.add('show');
    }
    function hide() { tooltip.classList.remove('show'); }
    pt.addEventListener('mouseenter', show);
    pt.addEventListener('mouseleave', hide);
    pt.addEventListener('focus', show);
    pt.addEventListener('blur', hide);
  });

  // ---- Chart / table toggle ----
  var toggleBtn = document.getElementById('viewToggleAll');
  var chartsView = document.getElementById('chartsView');
  var tableView = document.getElementById('tableView');
  toggleBtn.addEventListener('click', function () {
    var showingCharts = !chartsView.hidden;
    chartsView.hidden = showingCharts;
    tableView.hidden = !showingCharts;
    toggleBtn.textContent = showingCharts ? 'View as charts' : 'View as table';
  });
})();
