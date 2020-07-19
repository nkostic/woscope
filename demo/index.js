'use strict';

let woscope = require('../');

let libraryInfo = [
    {
        file: 'BEAMS-JCNK-NOV092019-BLOCK1 INTRO.ogg',
        mpeg: 'BEAMS-JCNK-NOV092019-BLOCK1 INTRO.mp3',
        author: 'JCNK',
        title: 'B1',
        link: 'https://jcnk.space',
        swap: true,
    },
    {
        file: 'BEAMS-JCNK-NOV092019-HALFBLOK1.ogg',
        mpeg: 'BEAMS-JCNK-NOV092019-HALFBLOK1.mp3',
        author: 'JCNK',
        title: 'B2',
        link: 'https://jcnk.space',
        invert: true,
    }
];

let libraryDict = {};
libraryInfo.forEach(function (e) {
    libraryDict[e.file] = e;
});

let query = parseq(location.search);
if (!query.file) {
    query = libraryInfo[0];
}

let file = query.file;

window.onload = function() {
    let htmlAudio = $('htmlAudio');

    updatePageInfo();

    htmlAudio.src = './jcnk-music/' + (htmlAudio.canPlayType('audio/ogg') ? file : libraryDict[file].mpeg);
    htmlAudio.load();

    window.onresize();

    initWoscope();
};

function initWoscope(config) {
    let canvas = $('c'),
        htmlAudio = $('htmlAudio'),
        htmlError = $('htmlError');

    config = Object.assign({
      canvas: canvas,
      audio: htmlAudio,
      callback: function () { htmlAudio.play(); },
      error: function (msg) {
          htmlError.innerHTML = '';
          htmlError.appendChild(renderDom(msg.toString()));
      },
      color: [1/32, 1, 1/32, 1],
      color2: [1, 0, 1, 1],
      background: [0, 0, 0, 1],
      swap: query.swap,
      invert: query.invert,
      sweep: query.sweep,
      bloom: query.bloom,
      live: query.live,
    }, config);

    let myWoscope = woscope(config);

    setupOptionsUI(
        function (options) { return Object.assign(myWoscope, options); },
        {
            swap: 'swap channels',
            invert: 'invert coordinates',
            sweep: 'traditional oscilloscope display',
            bloom: 'add glow',
            live: 'analyze audio in real time\n\n' +
                '- no display while paused/scrubbing\n' +
                '- volume affects the display size\n' +
                '- does not work in Mobile Safari',
        }
    );
}

let mySourceNode;

function resetWoscope(woscopeInstance) {
    // Chrome has limit of one sourceNode per audio element, so keep a reference
    mySourceNode = woscopeInstance.sourceNode || mySourceNode;

    woscopeInstance.destroy();

    // replace canvas. more compatible than restoring gl context on old canvas
    let canvas = $('c');
    let copy = canvas.cloneNode(true);
    canvas.parentNode.replaceChild(copy, canvas);

    // prevent doubled audio
    if (query.live && mySourceNode) {
        mySourceNode.disconnect();
    }

    initWoscope({sourceNode: mySourceNode});
}

window.onresize = function () {
    let canvas = $('c'),
        length = Math.min(window.innerHeight, canvas.parentNode.offsetWidth);
    canvas.width = length;
    canvas.height = length;
};

function $(id) { return document.getElementById(id); }

function renderDom(obj) {
  let dom, idx, attrs;
  if (typeof obj === 'string') {
      return document.createTextNode(obj);
  } else if (Array.isArray(obj)) {
      if (obj[0] === '!comment') {
          return document.createComment(obj[1]);
      }
      dom = document.createElement(obj[0]);
      idx = 1;
      attrs = obj[1];
      if (attrs && Object.getPrototypeOf(attrs) === Object.prototype) {
          idx += 1;
          Object.keys(attrs).forEach(function (key) {
              if (key === 'style') {
                  Object.assign(dom.style, attrs[key]);
              } else if (/^on/.test(key)) {
                  dom[key] = attrs[key];
              } else {
                  dom.setAttribute(key, attrs[key]);
              }
          });
      }
      obj.slice(idx).forEach(function (child) {
          dom.appendChild(renderDom(child));
      });
      return dom;
  } else {
      throw 'Cannot make dom of: ' + obj;
  }
}

function parseq(search) {
    search = search.replace(/^\?/, '');
    let obj = {};
    search.split('&').forEach(function (pair) {
        pair = pair.split('=');
        obj[decodeURIComponent(pair[0])] =
            pair.length > 1 ? decodeURIComponent(pair[1]) : true;
    });
    return obj;
}

function dumpq(obj) {
    return Object.keys(obj).map(function(key) {
        if (obj[key] === true) {
            return encodeURIComponent(key);
        } else {
            return encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]);
        }
    }).join('&');
}

function updatePageInfo() {
    let songInfo = $('songInfo');
    songInfo.innerHTML = '';
    if (file in libraryDict) {
        let info = libraryDict[file];
        songInfo.appendChild(renderDom(
           ['span',
               info.author + ' — ' + info.title + ' ',
               ['a', {href: info.link}, '[link]']]
        ));
    }

    let ul = $('playList');
    ul.innerHTML = '';
    libraryInfo.forEach(function (song) {
        ul.appendChild(renderDom(
           ['li',
               ['a', {href: '?' + dumpq(makeQuery(song))},
                  song.title]]
        ));
    });
}

function makeQuery(song) {
    let q = {file: song.file};
    if (song.swap) { q.swap = true; }
    if (song.invert) { q.invert = true; }
    if (query.live) { q.live = true; }
    return q;
}

function setupOptionsUI(updater, options) {
    let addChecked = function(obj, checked) {
        if (checked) {
            obj.checked = true;
        }
        return obj;
    };

    let ul = $('options');
    ul.innerHTML = '';
    Object.keys(options).forEach(function (param) {
        ul.appendChild(renderDom(
            ['li',
                ['label', {title: options[param]},
                    ['input',
                        addChecked({
                            type: 'checkbox',
                            id: param,
                            onchange: (param === 'live') ? getLiveToggle() : toggle,
                        }, query[param])],
                    ' ' + param]]
        ));
    });

    function getLiveToggle() {
        // prefer to reset woscope when toggling live mode, but Safari viz loses
        // sync when live = false and a MediaElementSourceNode is attached to
        // the audio element, so reload page instead.
        // this depends on Safari using webkitAudioContext and may be fragile
        return (window.AudioContext) ? toggleAndReset : toggleAndReload;
    }
    function toggle(e) {
        updateUrl(e);
        let result = {};
        result[e.target.id] = e.target.checked;
        updater(result);
    }
    function toggleAndReset(e) {
        updateUrl(e);
        updatePageInfo();
        resetWoscope(updater());
    }
    function toggleAndReload(e) {
        location.href = makeUrl(e);
    }
    function updateUrl(e) {
        history.replaceState(null, '', makeUrl(e));
        query = parseq(location.search);
    }
    function makeUrl(e) {
        let q = parseq(location.search);
        if (!q.file) {
            q = makeQuery(libraryInfo[0]);
        }
        if (e.target.checked) {
            q[e.target.id] = true;
        } else {
            delete q[e.target.id];
        }
        return '?' + dumpq(q);
    }
}
