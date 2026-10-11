(function () {
    var root = document.documentElement;
    root.classList.add('lx-js');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var hasIO = 'IntersectionObserver' in window;

    /* Scroll reveals */
    var reveals = document.querySelectorAll('[data-reveal]');
    if (reduce || !hasIO) {
        reveals.forEach(function (el) { el.classList.add('is-visible'); });
    } else {
        var revealIO = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                revealIO.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
        reveals.forEach(function (el) { revealIO.observe(el); });
    }

    /* Header state and hero tilt */
    var header = document.querySelector('.canvas-topbar');
    var stage = document.querySelector('[data-tilt]');
    var ticking = false;

    function onScroll() {
        ticking = false;
        if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
        if (!stage || reduce) return;
        var vh = window.innerHeight;
        var top = stage.getBoundingClientRect().top;
        var start = vh * 0.9;
        var end = vh * 0.2;
        var p = Math.min(1, Math.max(0, (start - top) / (start - end)));
        stage.style.setProperty('--tilt', (22 * (1 - p)).toFixed(2) + 'deg');
        stage.style.setProperty('--scale', (0.92 + 0.08 * p).toFixed(3));
    }
    window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();

    /* Pointer spotlight */
    var current = null;
    document.addEventListener('pointermove', function (e) {
        var el = e.target && e.target.closest ? e.target.closest('.lx-card, .lx-spot') : null;
        if (current && el !== current) {
            current.style.removeProperty('--mx');
            current.style.removeProperty('--my');
        }
        current = el;
        if (!el) return;
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });

    /* Hero demo loop */
    var demo = document.querySelector('[data-demo]');
    if (!demo || reduce) return;

    var typed = demo.querySelector('[data-typed]');
    var think = demo.querySelector('[data-think]');
    var title = demo.querySelector('[data-title]');
    var cite = demo.querySelector('[data-cite]');
    var metas = demo.querySelectorAll('[data-meta]');
    var objs = demo.querySelectorAll('[data-obj]');

    var scenes = [
        {
            prompt: 'Year 8 science lesson on photosynthesis for mixed ability',
            title: 'Photosynthesis: how plants make food',
            meta: ['Year 8', 'Science', '60 min'],
            objs: ['Describe how plants use light energy to make glucose', 'Write the word equation for photosynthesis', 'Explain how leaves are adapted for photosynthesis'],
            cite: 'KS3 Science scheme.pdf'
        },
        {
            prompt: 'Year 4 maths lesson on equivalent fractions with EAL support',
            title: 'Equivalent fractions with fraction walls',
            meta: ['Year 4', 'Maths', '45 min'],
            objs: ['Recognise equivalent fractions using diagrams', 'Find equivalent fractions by multiplying', 'Use key vocabulary: numerator, denominator'],
            cite: 'Maths calculation policy.pdf'
        },
        {
            prompt: "Year 10 English lesson on ambition in Macbeth",
            title: "Macbeth: the cost of ambition",
            meta: ['Year 10', 'English', '60 min'],
            objs: ['Analyse how Shakespeare presents ambition in Act 1', 'Explore language in the "dagger" soliloquy', 'Link context to the playwright\'s intentions'],
            cite: 'GCSE English marking rubric.docx'
        }
    ];
    var thinking = ['Reading your Notebook documents…', 'Aligning to the national curriculum…', 'Adapting for SEN and EAL…'];

    var index = 1;
    var timers = [];
    var running = false;

    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function stop() {
        timers.forEach(clearTimeout);
        timers = [];
        running = false;
    }

    function fill(scene) {
        title.textContent = scene.title;
        cite.textContent = scene.cite;
        metas.forEach(function (el, i) { el.textContent = scene.meta[i] || ''; });
        objs.forEach(function (el, i) { el.textContent = scene.objs[i] || ''; });
    }

    function play() {
        running = true;
        var scene = scenes[index % scenes.length];
        demo.setAttribute('data-state', 'typing');
        typed.textContent = '';
        later(function () { fill(scene); }, 400);

        var n = 0;
        (function type() {
            if (n <= scene.prompt.length) {
                typed.textContent = scene.prompt.slice(0, n);
                n += 1;
                later(type, 24 + Math.random() * 38);
            } else {
                later(startThinking, 450);
            }
        })();

        function startThinking() {
            demo.setAttribute('data-state', 'thinking');
            thinking.forEach(function (msg, i) {
                later(function () { think.textContent = msg; }, i * 850);
            });
            later(finish, thinking.length * 850);
        }

        function finish() {
            demo.setAttribute('data-state', 'done');
            index += 1;
            later(play, 5600);
        }
    }

    if (hasIO) {
        new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting && !running) {
                    later(play, 2200);
                    running = true;
                } else if (!entry.isIntersecting && running) {
                    stop();
                    var scene = scenes[index % scenes.length];
                    fill(scene);
                    typed.textContent = scene.prompt;
                    demo.setAttribute('data-state', 'done');
                }
            });
        }, { threshold: 0.3 }).observe(demo);
    } else {
        later(play, 2200);
    }
})();
