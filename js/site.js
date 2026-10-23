/* SecureCase public website: navigation, scroll reveals, counters and animated town-centre scenes. No external libraries. */
(function () {
    'use strict';
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.secureCaseSite = { frames: 0, phases: [], ready: false };

    /* Navigation */
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('primary-nav');
    if (toggle && nav) {
        toggle.addEventListener('click', function () {
            var open = nav.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }
    var year = document.getElementById('year');
    if (year) { year.textContent = String(new Date().getFullYear()); }

    /* Scroll reveal */
    var revealTargets = document.querySelectorAll('.reveal, .ladder, .trend-wrap, .gauge-wrap');
    if ('IntersectionObserver' in window && !reduceMotion) {
        var revealObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.18 });
        revealTargets.forEach(function (el) { revealObserver.observe(el); });
    } else {
        revealTargets.forEach(function (el) { el.classList.add('in'); });
    }

    /* Counters */
    function animateCounter(el) {
        var target = parseFloat(el.getAttribute('data-count'));
        var suffix = el.getAttribute('data-suffix') || '';
        var prefix = el.getAttribute('data-prefix') || '';
        if (reduceMotion || isNaN(target)) {
            el.textContent = prefix + el.getAttribute('data-count') + suffix;
            return;
        }
        var start = null;
        var duration = 1400;
        function step(ts) {
            if (start === null) { start = ts; }
            var progress = Math.min(1, (ts - start) / duration);
            var eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = prefix + Math.round(target * eased) + suffix;
            if (progress < 1) { requestAnimationFrame(step); }
        }
        requestAnimationFrame(step);
    }
    var counters = document.querySelectorAll('[data-count]');
    if ('IntersectionObserver' in window) {
        var counterObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    counterObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        counters.forEach(function (el) { counterObserver.observe(el); });
    } else {
        counters.forEach(animateCounter);
    }

    /* Weekly trend bars turn calm after the intervention marker */
    document.querySelectorAll('.trend').forEach(function (trend) {
        var marker = parseInt(trend.getAttribute('data-intervention') || '0', 10);
        Array.prototype.forEach.call(trend.children, function (bar, index) {
            var height = parseInt(bar.getAttribute('data-value') || '0', 10);
            bar.style.height = height + '%';
            bar.style.transitionDelay = (index * 0.05) + 's';
            if (index >= marker) { bar.classList.add('calm'); }
            bar.setAttribute('title', 'Week ' + (index + 1) + ': ' + height);
        });
    });

    /* Town-centre scene: incidents cluster into a hotspot, are linked to one person, intervention happens, the area calms. */
    function townScene(canvas) {
        var ctx = canvas.getContext('2d');
        if (!ctx) { return; }
        var mode = canvas.getAttribute('data-mode') || 'full';
        var captionSelector = canvas.getAttribute('data-caption');
        var caption = captionSelector ? document.querySelector(captionSelector) : null;
        var phaseNames = mode === 'problem'
            ? ['Reports keep coming in', 'The same streets, the same people', 'Confidence drains away']
            : ['Incidents reported across the town centre', 'Linked to one person, one place', 'Early intervention offered', 'Respect Order applied for, court-ready', 'Demand falls and confidence returns'];
        var phaseLength = 4200;
        var pings = [];
        var heroLayout = canvas.closest('.hero-media, .page-hero') !== null;
        var hotspot = { x: 0.5, y: 0.5 };
        var person = { x: 0.3, y: 0.3 };
        var width = 0;
        var height = 0;
        var startTime = null;
        var lastPhase = -1;
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        var mapLayer = document.createElement('canvas');

        /* Fictional market-town centre, loosely modelled on a Derbyshire market town: a market place, a crooked-spire
           parish church to the east, an inner ring road and shopping streets radiating from the square. Seeded so the
           map is identical on every load. Coordinates are relative to the town centre in units of min(width, height). */
        var town = { centre: { x: 0.5, y: 0.5 }, scale: 1 };
        var seed = 20261026;
        function rand() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
        var square = { x: -0.04, y: 0.03, w: 0.26, h: 0.15 };
        var church = { x: 0.36, y: -0.1 };
        var streets = [
            [[-0.17, -0.045], [-0.5, -0.33]], [[0.09, -0.045], [0.12, -0.48]], [[-0.17, 0.105], [-0.42, 0.4]], [[0.09, 0.105], [0.3, 0.46]],
            [[0.09, 0.03], [0.6, -0.02]], [[-0.17, 0.03], [-0.62, 0.08]], [[0.09, -0.045], [0.3, -0.14]], [[-0.48, -0.2], [0.5, -0.24]],
            [[-0.45, 0.24], [0.52, 0.22]], [[-0.3, -0.42], [-0.28, 0.44]], [[0.26, -0.45], [0.24, 0.42]], [[0.4, -0.02], [0.56, 0.3]],
            [[-0.05, -0.2], [-0.03, -0.045]], [[0.0, 0.105], [0.02, 0.24]]
        ];
        var ring = [];
        for (var a = 0; a < 28; a++) {
            var angle = (a / 28) * Math.PI * 2;
            var r = 1 + (rand() - 0.5) * 0.12;
            ring.push([Math.cos(angle) * 0.66 * r, Math.sin(angle) * 0.52 * r]);
        }
        var buildings = [];
        function insideSquare(x, y, margin) { return x > square.x - margin && x < square.x + square.w + margin && y > square.y - margin && y < square.y + square.h + margin; }
        function insideRing(x, y) { return (x / 0.62) * (x / 0.62) + (y / 0.48) * (y / 0.48) < 1; }
        streets.forEach(function (s) {
            var dx = s[1][0] - s[0][0];
            var dy = s[1][1] - s[0][1];
            var len = Math.sqrt(dx * dx + dy * dy);
            var ux = dx / len;
            var uy = dy / len;
            var t = 0.02;
            while (t < len - 0.02) {
                var w = 0.018 + rand() * 0.03;
                [1, -1].forEach(function (side) {
                    var depth = 0.025 + rand() * 0.035;
                    var offset = 0.022 + depth / 2;
                    var cx = s[0][0] + ux * (t + w / 2) - uy * offset * side;
                    var cy = s[0][1] + uy * (t + w / 2) + ux * offset * side;
                    var nearChurch = Math.abs(cx - church.x) < 0.09 && Math.abs(cy - church.y) < 0.1;
                    if (!insideSquare(cx, cy, 0.02) && !nearChurch && insideRing(cx, cy) && rand() > 0.12) {
                        buildings.push({ x: cx, y: cy, w: w, d: depth, angle: Math.atan2(dy, dx) });
                    }
                });
                t += w + 0.006 + rand() * 0.012;
            }
        });

        function unit() { return Math.min(width, height) * town.scale; }

        function buildMapLayer() {
            mapLayer.width = width * dpr;
            mapLayer.height = height * dpr;
            var m = mapLayer.getContext('2d');
            m.setTransform(dpr, 0, 0, dpr, 0, 0);
            var u = unit();
            var ox = town.centre.x * width;
            var oy = town.centre.y * height;
            function X(x) { return ox + x * u; }
            function Y(y) { return oy + y * u; }
            var glow = m.createRadialGradient(ox, oy, u * 0.05, ox, oy, u * 0.8);
            glow.addColorStop(0, 'rgba(59,130,246,0.16)');
            glow.addColorStop(1, 'rgba(59,130,246,0)');
            m.fillStyle = glow;
            m.fillRect(0, 0, width, height);
            m.lineJoin = 'round';
            m.lineCap = 'round';
            m.beginPath();
            ring.forEach(function (p, i) { if (i === 0) { m.moveTo(X(p[0]), Y(p[1])); } else { m.lineTo(X(p[0]), Y(p[1])); } });
            m.closePath();
            m.strokeStyle = 'rgba(125,170,235,0.16)';
            m.lineWidth = u * 0.03;
            m.stroke();
            m.strokeStyle = 'rgba(125,170,235,0.07)';
            m.lineWidth = u * 0.006;
            m.setLineDash([u * 0.02, u * 0.02]);
            m.stroke();
            m.setLineDash([]);
            streets.forEach(function (s) {
                m.beginPath();
                m.moveTo(X(s[0][0]), Y(s[0][1]));
                m.lineTo(X(s[1][0]), Y(s[1][1]));
                m.strokeStyle = 'rgba(125,170,235,0.13)';
                m.lineWidth = u * 0.02;
                m.stroke();
            });
            buildings.forEach(function (b) {
                m.save();
                m.translate(X(b.x), Y(b.y));
                m.rotate(b.angle);
                m.fillStyle = 'rgba(110,160,230,0.11)';
                m.strokeStyle = 'rgba(150,195,255,0.22)';
                m.lineWidth = 1;
                m.fillRect(-b.w * u / 2, -b.d * u / 2, b.w * u, b.d * u);
                m.strokeRect(-b.w * u / 2, -b.d * u / 2, b.w * u, b.d * u);
                m.restore();
            });
            m.fillStyle = 'rgba(140,190,255,0.08)';
            m.fillRect(X(square.x), Y(square.y), square.w * u, square.h * u);
            m.strokeStyle = 'rgba(150,195,255,0.25)';
            m.strokeRect(X(square.x), Y(square.y), square.w * u, square.h * u);
            m.fillStyle = 'rgba(150,195,255,0.22)';
            for (var r = 0; r < 4; r++) {
                for (var c = 0; c < 8; c++) {
                    m.fillRect(X(square.x + 0.02 + c * 0.028), Y(square.y + 0.025 + r * 0.03), u * 0.014, u * 0.012);
                }
            }
            m.fillStyle = 'rgba(120,170,240,0.14)';
            m.strokeStyle = 'rgba(150,195,255,0.3)';
            m.fillRect(X(square.x + 0.07), Y(square.y - 0.07), u * 0.12, u * 0.05);
            m.strokeRect(X(square.x + 0.07), Y(square.y - 0.07), u * 0.12, u * 0.05);
            m.save();
            m.translate(X(church.x), Y(church.y));
            m.fillStyle = 'rgba(140,190,255,0.16)';
            m.strokeStyle = 'rgba(160,205,255,0.35)';
            m.fillRect(-u * 0.065, -u * 0.022, u * 0.13, u * 0.044);
            m.strokeRect(-u * 0.065, -u * 0.022, u * 0.13, u * 0.044);
            m.fillRect(-u * 0.02, -u * 0.06, u * 0.04, u * 0.12);
            m.strokeRect(-u * 0.02, -u * 0.06, u * 0.04, u * 0.12);
            m.translate(-u * 0.045, 0);
            m.rotate(0.18);
            m.beginPath();
            for (var k = 0; k < 8; k++) {
                var ang = (k / 8) * Math.PI * 2;
                var rad = u * (0.018 + (k % 2) * 0.004);
                m[k === 0 ? 'moveTo' : 'lineTo'](Math.cos(ang) * rad, Math.sin(ang) * rad);
            }
            m.closePath();
            m.fillStyle = 'rgba(190,220,255,0.45)';
            m.fill();
            m.restore();
            m.fillStyle = 'rgba(190,220,255,0.5)';
            m.font = '600 ' + Math.max(9, u * 0.022) + 'px ' + getComputedStyle(document.body).fontFamily;
            m.textAlign = 'center';
            m.fillText('MARKET PLACE', X(square.x + square.w / 2), Y(square.y + square.h + 0.035));
            m.fillText('CROOKED SPIRE', X(church.x), Y(church.y + 0.095));
            m.fillText('INNER RING ROAD', X(0), Y(-0.56));
        }

        function resize() {
            var rect = canvas.getBoundingClientRect();
            width = Math.max(1, rect.width);
            height = Math.max(1, rect.height);
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            var narrow = width < 720;
            town.centre = heroLayout ? (narrow ? { x: 0.55, y: 0.78 } : { x: 0.72, y: 0.5 }) : { x: 0.5, y: 0.5 };
            town.scale = heroLayout ? (narrow ? 0.75 : 0.85) : 0.9;
            var u = unit();
            hotspot = { x: town.centre.x + (square.x + square.w / 2) * u / width, y: town.centre.y + (square.y + square.h / 2) * u / height };
            person = { x: town.centre.x - 0.3 * u / width, y: town.centre.y - 0.36 * u / height };
            buildMapLayer();
        }
        resize();
        window.addEventListener('resize', resize);

        function setCaption(phase) {
            if (phase === lastPhase) { return; }
            lastPhase = phase;
            window.secureCaseSite.phases.push(phase);
            if (!caption) { return; }
            var span = caption.querySelector('span');
            if (!span) { return; }
            caption.classList.add('flip');
            setTimeout(function () { span.textContent = phaseNames[phase]; caption.classList.remove('flip'); }, 250);
        }

        /* Where incidents happen in the town (town units): market place edges, the churchyard corner, the shopping
           streets, the bus stands to the north and the car park to the west. Weighted so the market place dominates
           without every report landing on the market hall. */
        var spots = [
            { x: square.x - 0.03, y: square.y + square.h / 2, w: 3 }, { x: square.x + square.w + 0.03, y: square.y + 0.02, w: 3 },
            { x: square.x + square.w / 2, y: square.y + square.h + 0.04, w: 3 }, { x: church.x - 0.08, y: church.y + 0.06, w: 2 },
            { x: 0.1, y: -0.33, w: 2 }, { x: -0.3, y: 0.3, w: 2 }, { x: -0.45, y: -0.05, w: 1.5 }, { x: 0.3, y: 0.33, w: 1.5 },
            { x: -0.05, y: -0.17, w: 1.5 }, { x: 0.45, y: 0.12, w: 1 }
        ];
        function toCanvas(tx, ty) {
            var u = unit();
            return { x: town.centre.x + tx * u / width, y: town.centre.y + ty * u / height };
        }
        function pickSpot(phase) {
            var pool = phase >= 1 && mode !== 'problem' ? spots.slice(0, 4) : spots;
            var total = pool.reduce(function (sum, s) { return sum + s.w; }, 0);
            var roll = Math.random() * total;
            for (var i = 0; i < pool.length; i++) {
                roll -= pool[i].w;
                if (roll <= 0) { return pool[i]; }
            }
            return pool[0];
        }

        function spawnPing(phase) {
            var spot = pickSpot(phase);
            var point = toCanvas(spot.x + (Math.random() - 0.5) * 0.08, spot.y + (Math.random() - 0.5) * 0.08);
            pings.push({ x: point.x, y: point.y, born: performance.now(), calm: phase >= 4 });
            if (pings.length > 40) { pings.shift(); }
        }

        function drawTown() {
            ctx.drawImage(mapLayer, 0, 0, width, height);
        }

        function drawHotspot(phase, t) {
            var intensity = mode === 'problem' ? 0.7 + 0.12 * Math.sin(t / 400) : (phase >= 4 ? 0.22 : phase >= 2 ? 0.5 : 0.8);
            var gradient = ctx.createRadialGradient(hotspot.x * width, hotspot.y * height, 10, hotspot.x * width, hotspot.y * height, Math.min(width, height) * 0.32);
            var color = phase >= 4 && mode !== 'problem' ? '20,184,166' : '239,68,68';
            gradient.addColorStop(0, 'rgba(' + color + ',' + intensity + ')');
            gradient.addColorStop(1, 'rgba(' + color + ',0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
        }

        function drawPings(now) {
            pings.forEach(function (p) {
                var age = Math.max(0, (now - p.born) / 1800);
                if (age > 1) { return; }
                var radius = 6 + age * 34;
                ctx.beginPath();
                ctx.arc(p.x * width, p.y * height, radius, 0, Math.PI * 2);
                ctx.strokeStyle = p.calm ? 'rgba(45,212,191,' + (1 - age) * 0.8 + ')' : 'rgba(255,99,99,' + (1 - age) * 0.9 + ')';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(p.x * width, p.y * height, 4, 0, Math.PI * 2);
                ctx.fillStyle = p.calm ? '#2dd4bf' : '#ff6b6b';
                ctx.fill();
            });
        }

        function drawLinks(phase, progress) {
            if (mode === 'problem' || phase < 1) { return; }
            ctx.strokeStyle = 'rgba(124,196,255,0.55)';
            ctx.lineWidth = 1.5;
            pings.slice(-12).forEach(function (p, idx) {
                var reach = Math.min(1, progress * 3 - idx * 0.08);
                if (reach <= 0) { return; }
                ctx.beginPath();
                ctx.moveTo(p.x * width, p.y * height);
                ctx.lineTo(p.x * width + (person.x * width - p.x * width) * reach, p.y * height + (person.y * height - p.y * height) * reach);
                ctx.stroke();
            });
            ctx.beginPath();
            ctx.arc(person.x * width, person.y * height, 16, 0, Math.PI * 2);
            ctx.fillStyle = '#0f6ec9';
            ctx.fill();
            ctx.strokeStyle = '#7cc4ff';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = '700 11px ' + getComputedStyle(document.body).fontFamily;
            ctx.textAlign = 'center';
            ctx.fillText('PROFILE', person.x * width, person.y * height - 24);
            if (phase >= 2) {
                var steps = ['LETTER', 'CPW', 'CPN', 'RO'];
                var shown = phase >= 3 ? 4 : Math.min(4, Math.floor(progress * 4) + 1);
                for (var s = 0; s < shown; s++) {
                    var bx = person.x * width + 40 + s * 58;
                    var by = person.y * height - 14;
                    ctx.fillStyle = s < 2 ? 'rgba(15,110,201,0.9)' : 'rgba(239,68,68,0.9)';
                    ctx.beginPath();
                    ctx.roundRect ? ctx.roundRect(bx, by, 50, 28, 8) : ctx.rect(bx, by, 50, 28);
                    ctx.fill();
                    ctx.fillStyle = '#fff';
                    ctx.fillText(steps[s], bx + 25, by + 18);
                }
            }
        }

        var lastSpawn = 0;
        function frame() {
            var now = performance.now();
            if (startTime === null) { startTime = now; }
            var elapsed = (now - startTime) % (phaseLength * phaseNames.length);
            var phase = Math.floor(elapsed / phaseLength);
            var progress = (elapsed % phaseLength) / phaseLength;
            setCaption(phase);
            var spawnEvery = mode === 'problem' ? 260 : (phase >= 4 ? 1400 : phase >= 3 ? 700 : 320);
            if (now - lastSpawn > spawnEvery) { spawnPing(phase); lastSpawn = now; }
            ctx.clearRect(0, 0, width, height);
            drawTown();
            drawHotspot(phase, now);
            drawPings(now);
            drawLinks(phase, progress);
            window.secureCaseSite.frames++;
            if (!reduceMotion) { requestAnimationFrame(frame); }
        }
        if (reduceMotion) {
            for (var k = 0; k < 14; k++) { spawnPing(0); }
            setCaption(mode === 'problem' ? 0 : 4);
            frame();
            return;
        }
        requestAnimationFrame(frame);
    }
    document.querySelectorAll('canvas[data-scene="town"]').forEach(townScene);

    /* Progressive video: if licensed footage has been dropped into media/, use it; otherwise the animated scene stays. */
    document.querySelectorAll('.hero-media[data-video]').forEach(function (holder) {
        var src = holder.getAttribute('data-video');
        if (!src || reduceMotion || window.location.protocol === 'file:') { return; }
        fetch(src, { method: 'HEAD' }).then(function (response) {
            if (!response.ok) { return; }
            var video = document.createElement('video');
            video.muted = true;
            video.loop = true;
            video.autoplay = true;
            video.playsInline = true;
            video.setAttribute('aria-hidden', 'true');
            video.src = src;
            holder.appendChild(video);
            video.addEventListener('canplay', function () { holder.classList.add('has-video'); });
        }).catch(function () { /* animated scene remains */ });
    });

    window.secureCaseSite.ready = true;
})();
