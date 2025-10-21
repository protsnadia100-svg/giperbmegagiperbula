/* graph.js
    - UI bindings (index.html)
    - uses Solver.* for math
    - draws implicit contour via Plotly (level 0)
    - draws foci, directrices, axes, asymptotes
    - Drag-n-Drop functionality
    - Equation library modal
    - Interactive Modes:
        - Focal Chord Explorer
        - Tangent Line Builder
        - 3D Surface Viewer
        - Locus Animation (НОВЕ)
*/

document.addEventListener('DOMContentLoaded', initUI);

// Спрощений доступ до елементів за ID
function $(id){ return document.getElementById(id); }

/**
 * Ініціалізує всі елементи керування та обробники подій.
 */
function initUI(){
    const eqInput = $('equationInput');
    // Глобальні змінні стану для інтерактивних режимів
    window.isChordExplorerActive = false;
    window.isTangentModeActive = false;
    window.is3DViewActive = false;
    window.isLocusAnimationActive = false; // ДОДАНО: Стан для режиму анімації

    // --- Прив'язка основних кнопок ---
    if ($('buildBtn')) $('buildBtn').addEventListener('click', analyzeAndPlot);
    if ($('analyzeBtn')) $('analyzeBtn').addEventListener('click', analyzeOnly);
    if ($('saveExampleBtn')) $('saveExampleBtn').addEventListener('click', () => {
        const txt = eqInput.value.trim();
        if (txt) { 
            Solver.addExample(txt); 
            renderExampleList(); 
        }
    });
    if ($('clearBtn')) $('clearBtn').addEventListener('click', () => {
        deactivateAllModes();
        Plotly.newPlot('graphCanvas', [], getLayout(8), {responsive: true});
        if ($('solveOutput')) $('solveOutput').innerHTML = 'Введіть рівняння для аналізу.';
        if ($('stepsOutput')) {
            $('stepsOutput').innerHTML = '';
            $('stepsOutput').classList.add('hidden');
        }
        if (eqInput) eqInput.value = '';
        localStorage.removeItem('conics_last_equation');
        window.lastAnalysis = null;
    });
    if ($('toggleExtrasBtn')) $('toggleExtrasBtn').addEventListener('click', () => {
        window.showExtras = !window.showExtras;
        if (window.lastAnalysis && !window.is3DViewActive) {
            plotAnalysis(window.lastAnalysis);
        }
    });
    if ($('toggleConjugateBtn')) $('toggleConjugateBtn').addEventListener('click', () => {
        window.showConjugate = !window.showConjugate;
        if (window.lastAnalysis && window.lastAnalysis.type === 'гіпербола' && !window.is3DViewActive) {
            plotAnalysis(window.lastAnalysis);
        }
    });
    if ($('shareBtn')) $('shareBtn').addEventListener('click', shareEquation);
    if ($('stepsBtn')) $('stepsBtn').addEventListener('click', () => { if ($('stepsOutput')) $('stepsOutput').classList.toggle('hidden'); });

    // --- Прив'язка інтерактивних режимів ---
    if ($('exploreChordsBtn')) $('exploreChordsBtn').addEventListener('click', toggleChordExplorer);
    if ($('tangentModeBtn')) $('tangentModeBtn').addEventListener('click', toggleTangentMode);
    if ($('toggle3DBtn')) $('toggle3DBtn').addEventListener('click', toggle3DView);
    if ($('locusAnimationBtn')) $('locusAnimationBtn').addEventListener('click', toggleLocusAnimation); // ДОДАНО: Обробник для кнопки анімації
    
    // --- Інші обробники ---
    if ($('libraryBtn')) {
        $('libraryBtn').addEventListener('click', openLibraryModal);
        $('closeModalBtn').addEventListener('click', closeLibraryModal);
        $('libraryModal').addEventListener('click', (e) => { if(e.target === $('libraryModal')) closeLibraryModal(); });
    }
    if (eqInput) eqInput.addEventListener('keydown', e => { if (e.key === 'Enter') analyzeAndPlot(); });
    
    // Ініціалізація теми
    const savedTheme = localStorage.getItem('conics_theme') || 'dark';
    document.body.classList.toggle('theme-light', savedTheme === 'light');
    const themeToggle = $('themeToggle');
    if (themeToggle) {
        themeToggle.checked = savedTheme === 'light';
        themeToggle.addEventListener('change', () => {
            const isLight = themeToggle.checked;
            document.body.classList.toggle('theme-light', isLight);
            localStorage.setItem('conics_theme', isLight ? 'light' : 'dark');
            if (window.lastAnalysis) {
                window.is3DViewActive ? plot3DView(window.lastAnalysis) : plotAnalysis(window.lastAnalysis);
            }
        });
    }

    // Початкове відображення
    if ($('exampleList')) { renderExampleList(); setupDragAndDrop(); }
    Plotly.newPlot('graphCanvas', [], getLayout(8), {responsive: true});
    window.showExtras = true;
    window.showConjugate = false;
    if ($('theoryShort')) $('theoryShort').innerHTML = '<b>Гіпербола:</b> Δ > 0. Клацни "Теорія" для деталей.';
    loadEquationFromURLOrStorage();
    setupGraphEventListeners();
}

// --- ЛОГІКА КЕРУВАННЯ ІНТЕРАКТИВНИМИ РЕЖИМАМИ ---

function setupGraphEventListeners() {
    const canvas = $('graphCanvas');
    canvas.on('plotly_hover', handleGraphHover);
    canvas.on('plotly_click', handleGraphClick);
    canvas.on('plotly_unhover', () => {
        if(window.isChordExplorerActive) {
            $('chordLengthDisplay').style.display = 'none';
        }
    });
}

function deactivateAllModes() {
    if (window.isLocusAnimationActive) { // ДОДАНО: Зупинка анімації при деактивації
        LocusAnimator.stop();
        // Забезпечуємо видимість кривої при вимкненні режиму анімації
        const graphDiv = $('graphCanvas');
        if (graphDiv.data && graphDiv.data.length > 0) {
            Plotly.restyle(graphDiv, { visible: true }, [0, 1]); // Показуємо і основну, і спряжену криві
        }
    }
    window.isChordExplorerActive = false;
    window.isTangentModeActive = false;
    window.is3DViewActive = false;
    window.isLocusAnimationActive = false; // ДОДАНО
    
    $('exploreChordsBtn')?.classList.remove('active');
    $('tangentModeBtn')?.classList.remove('active');
    $('toggle3DBtn')?.classList.remove('active');
    $('locusAnimationBtn')?.classList.remove('active'); // ДОДАНО

    $('chordLengthDisplay').style.display = 'none';
    $('tangentInfoDisplay').style.display = 'none';
    
    const currentLayout = $('graphCanvas').layout;
    if (currentLayout && currentLayout.shapes && currentLayout.shapes.length > 0) {
        Plotly.relayout('graphCanvas', { shapes: [] });
    }
}

function toggleChordExplorer() {
    const willBeActive = !window.isChordExplorerActive;
    if (window.is3DViewActive && window.lastAnalysis) {
        plotAnalysis(window.lastAnalysis); // Повертаємось до 2D
    }
    deactivateAllModes();
    window.isChordExplorerActive = willBeActive;
    $('exploreChordsBtn').classList.toggle('active', willBeActive);
}

function toggleTangentMode() {
    const willBeActive = !window.isTangentModeActive;
    if (window.is3DViewActive && window.lastAnalysis) {
        plotAnalysis(window.lastAnalysis);
    }
    deactivateAllModes();
    window.isTangentModeActive = willBeActive;
    $('tangentModeBtn').classList.toggle('active', willBeActive);
}

function toggle3DView() {
    const willBeActive = !window.is3DViewActive;
    deactivateAllModes();
    if (willBeActive) {
        if (window.lastAnalysis) {
            window.is3DViewActive = true;
            $('toggle3DBtn').classList.add('active');
            plot3DView(window.lastAnalysis);
        } else {
            alert("Спочатку побудуйте 2D-графік.");
        }
    } else {
        if (window.lastAnalysis) {
            plotAnalysis(window.lastAnalysis);
        }
    }
}

// ОНОВЛЕНО: Функція для керування режимом анімації
function toggleLocusAnimation() {
    const willBeActive = !window.isLocusAnimationActive;
    if (window.is3DViewActive && window.lastAnalysis) {
        plotAnalysis(window.lastAnalysis);
    }
    deactivateAllModes();
    window.isLocusAnimationActive = willBeActive;
    $('locusAnimationBtn').classList.toggle('active', willBeActive);

    const graphDiv = $('graphCanvas');

    if (willBeActive) {
        if (window.lastAnalysis) {
            // Ховаємо основну криву перед початком анімації
            if (graphDiv.data && graphDiv.data.length > 0) {
                // Ховаємо і основну, і можливу спряжену криві
                Plotly.restyle(graphDiv, { visible: false }, [0, 1]);
            }

            // Функція, яка буде викликана після завершення анімації
            const onAnimationComplete = () => {
                if (graphDiv.data && graphDiv.data.length > 0) {
                    Plotly.restyle(graphDiv, { visible: true }, [0, 1]);
                }
            };

            LocusAnimator.start(window.lastAnalysis, 'animationCanvas', 'graphCanvas', onAnimationComplete);
        } else {
            alert("Спочатку побудуйте криву, щоб побачити її анімацію.");
            deactivateAllModes();
        }
    } else {
        // Якщо режим вимкнено вручну, переконуємось, що крива видима
        if (graphDiv.data && graphDiv.data.length > 0) {
            Plotly.restyle(graphDiv, { visible: true }, [0, 1]);
        }
    }
}


// --- ОБРОБНИКИ ПОДІЙ НА ГРАФІКУ ---

function handleGraphHover(data) {
    if (!window.isChordExplorerActive || !window.lastAnalysis || !data.points[0]) return;
    const {extras, parsed} = window.lastAnalysis, foci=[];
    if (extras.f1 && extras.f2) foci.push(extras.f1, extras.f2);
    else if (extras.focus) foci.push([extras.focus.x, extras.focus.y]);
    if (foci.length === 0) return;

    const probePoint = [data.points[0].x, data.points[0].y];
    let closestFocus = foci[0];
    if (foci.length > 1) {
        const d1 = Math.hypot(probePoint[0] - foci[0][0], probePoint[1] - foci[0][1]);
        const d2 = Math.hypot(probePoint[0] - foci[1][0], probePoint[1] - foci[1][1]);
        if (d2 < d1) closestFocus = foci[1];
    }
    
    const intersections = Solver.getFocalChordIntersections(parsed, closestFocus, probePoint);
    if (intersections) {
        const [p1, p2] = intersections;
        const length = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
        Plotly.relayout('graphCanvas', { shapes: [{ type: 'line', x0: p1[0], y0: p1[1], x1: p2[0], y1: p2[1], line: { color: '#ffeb3b', width: 3 }}]});
        const d = $('chordLengthDisplay');
        d.textContent = `Довжина хорди: ${length.toFixed(3)}`;
        d.style.display = 'block';
    }
}

function handleGraphClick(data) {
    if (!window.isTangentModeActive || !window.lastAnalysis || !data.points[0]) return;
    const point = { x: data.points[0].x, y: data.points[0].y };
    const tangent = Solver.getTangentLineAtPoint(window.lastAnalysis.parsed, point);
    
    if (tangent) {
        const { Fx, Fy, c, eqStr } = tangent;
        const layout = $('graphCanvas').layout;
        const xRange = layout.xaxis.range;
        const yRange = layout.yaxis.range;

        let x0, y0, x1, y1;
        if (Math.abs(Fy) > Math.abs(Fx)) { // Більш горизонтальна лінія
            x0 = xRange[0]; y0 = (-Fx * x0 - c) / Fy;
            x1 = xRange[1]; y1 = (-Fx * x1 - c) / Fy;
        } else { // Більш вертикальна
            y0 = yRange[0]; x0 = (-Fy * y0 - c) / Fx;
            y1 = yRange[1]; x1 = (-Fy * y1 - c) / Fx;
        }

        Plotly.relayout('graphCanvas', { shapes: [{ type: 'line', x0, y0, x1, y1, line: { color: '#ff6b6b', width: 2.5, dash: 'longdash' } }] });
        const d = $('tangentInfoDisplay');
        d.innerHTML = `Дотична: <b>${eqStr}</b>`;
        d.style.display = 'block';
    }
}

// --- ОСНОВНІ ФУНКЦІЇ АНАЛІЗУ ТА ПОБУДОВИ ---

async function analyzeAndPlot() {
    // ДОДАНО: Зупинка анімації перед новою побудовою
    if(window.isLocusAnimationActive) {
        deactivateAllModes();
    }
    const raw = $('equationInput').value.trim();
    if (!raw) return;
    localStorage.setItem('conics_last_equation', raw);
    const parsed = Solver.parseGeneralEquation(raw);
    if (!parsed) { alert('Не вдалося розібрати рівняння.'); return; }
    const analysis = Solver.analyzeGeneral(parsed);
    window.lastAnalysis = analysis;
    displayAnalysis(analysis);
    if (window.is3DViewActive) await plot3DView(analysis);
    else await plotAnalysis(analysis);
}

function analyzeOnly() {
    const raw = $('equationInput').value.trim();
    if (!raw) return;
    localStorage.setItem('conics_last_equation', raw);
    const analysis = Solver.analyzeGeneral(Solver.parseGeneralEquation(raw));
    window.lastAnalysis = analysis;
    displayAnalysis(analysis);
}

async function plotAnalysis(analysis) {
    if (window.is3DViewActive) deactivateAllModes();
    
    const { extras, parsed, type } = analysis;
    const data = [];
    const viewRange = estimateRangeForPlot(parsed, extras);
    const dataRange = viewRange * 25;
    const N = 501;
    const grid = buildGrid(parsed.A, parsed.B, parsed.C, parsed.D, parsed.E, parsed.F, dataRange, N);
    
    data.push({
        x: grid.x, y: grid.y, z: grid.z, type: 'contour',
        contours: { start: 0, end: 0, size: 1, coloring: 'none' },
        line: { color: '#00ffff', width: 2.5, smoothing: 1.3 },
        showscale: false, hoverinfo: 'x+y'
    });

    if (type === 'гіпербола' && window.showConjugate && extras.Fp) {
        const conjugateLevel = -2 * extras.Fp;
        data.push({
            x: grid.x, y: grid.y, z: grid.z, type: 'contour',
            contours: { start: conjugateLevel, end: conjugateLevel, size: 1, coloring: 'none' },
            line: { color: '#ff69b4', width: 2, dash: 'dash' },
            showscale: false, hoverinfo: 'none'
        });
    }

    if (window.showExtras) data.push(...getExtrasTraces(analysis, dataRange));
    
    const layout = getLayout(viewRange);
    layout.shapes = [];
    await Plotly.react('graphCanvas', data, layout, {responsive: true});
}

async function plot3DView(analysis) {
    const { type, extras } = analysis;
    const data = [];
    const N = 80;
    let x_s = [], y_s = [], z_s = [];
    let rangeEstimate = 10;
    let title = `3D-модель: ${type}`;
    const { center, vecs } = extras;

    if (extras.isDegenerate) { 
        title = "3D-модель: Циліндр";
        const radius = 2; 
        const axisVec = extras.v_axis;
        const perpVec = [-axisVec[1], axisVec[0]];
        for (let i=0; i<N; i++) {
            let x_row = [], y_row = [], z_row = [];
            for (let j=0; j<N; j++) {
                const v = -Math.PI + 2*Math.PI*j/(N-1);
                const u = -rangeEstimate + 2*rangeEstimate*i/(N-1);
                const circle_x = radius * Math.cos(v);
                const circle_z = radius * Math.sin(v);
                const xt = extras.vertex.x + u*axisVec[0] + circle_x*perpVec[0];
                const yt = extras.vertex.y + u*axisVec[1] + circle_x*perpVec[1];
                x_row.push(xt); y_row.push(yt); z_row.push(circle_z);
            }
            x_s.push(x_row); y_s.push(y_row); z_s.push(z_row);
        }
    } else if (Math.abs(extras.Fp) < 1e-9 && type !== 'парабола') {
        const lambda = extras.lambda;
        if (lambda[0] * lambda[1] >= 0) {
            alert("3D-вигляд для цієї виродженої кривої (точка або уявний еліпс) не будується.");
            toggle3DView(); return;
        }
        title = "3D-модель: Подвійний конус";
        const slope = Math.sqrt(-lambda[0] / lambda[1]);
        for (let i=0; i<N; i++) {
            let x_row = [], y_row = [], z_row = [];
            for (let j=0; j<N; j++) {
                const v = -Math.PI + 2*Math.PI*j/(N-1);
                const u = -rangeEstimate + 2*rangeEstimate*i/(N-1);
                const xp = u;
                const yp = slope*u*Math.cos(v);
                const zp = slope*u*Math.sin(v);
                const xt = center.x + xp*vecs[0][0] + yp*vecs[1][0];
                const yt = center.y + xp*vecs[0][1] + yp*vecs[1][1];
                x_row.push(xt); y_row.push(yt); z_row.push(zp);
            }
            x_s.push(x_row); y_s.push(y_row); z_s.push(z_row);
        }
    } 
    else if ((extras.a && extras.b) || (type === 'парабола' && extras.focal_dist)) {
        let { a, b } = extras;
        for (let i = 0; i < N; i++) {
            let x_row = [], y_row = [], z_row = [];
            for (let j = 0; j < N; j++) {
                const v = -Math.PI + 2*Math.PI*j/(N-1);
                let u, xp, yp, zp;
                if (type==='гіпербола') { rangeEstimate=Math.max(a,b)*2; u=-1.5+3*i/(N-1); xp=a*Math.cosh(u)*Math.cos(v); yp=b*Math.cosh(u)*Math.sin(v); zp=a*Math.sinh(u); }
                else if (type==='еліпс'||type==='коло') { rangeEstimate=Math.max(a,b)*1.5; u=-Math.PI/2+Math.PI*i/(N-1); const c_z=(a+b)/2; xp=a*Math.cos(u)*Math.cos(v); yp=b*Math.cos(u)*Math.sin(v); zp=c_z*Math.sin(u); }
                else if (type==='парабола') { rangeEstimate=Math.abs(extras.focal_dist)*8; a=rangeEstimate; u=a*i/(N-1); xp=u*Math.cos(v); yp=u*Math.sin(v); zp=(u*u)/(4*extras.focal_dist); }
                else continue;
                const xt = center.x + xp*vecs[0][0] + yp*vecs[1][0];
                const yt = center.y + xp*vecs[0][1] + yp*vecs[1][1];
                x_row.push(xt); y_row.push(yt); z_row.push(zp);
            }
            x_s.push(x_row); y_s.push(y_row); z_s.push(z_row);
        }
    } else {
        alert("3D-вигляд неможливо побудувати для цього рівняння.");
        toggle3DView(); return;
    }
    
    data.push({
        x: x_s, y: y_s, z: z_s,
        type: 'surface', colorscale: 'Viridis', showscale: false, opacity: 0.95,
        lighting: { ambient: 0.8, diffuse: 0.8, specular: 0.2, roughness: 0.5, fresnel: 0.2 }
    });

    const isLight = document.body.classList.contains('theme-light');
    const range = Math.max(rangeEstimate, 5);
    const plotCenter = center || extras.vertex;

    const layout3D = {
        title: title,
        scene: {
            xaxis: { title: 'X', range: [-range + plotCenter.x, range + plotCenter.x], backgroundcolor: isLight ? "#f0f6ff" : "#0d1b2a", gridcolor: isLight ? "#ddd" : "#2a3a4a" },
            yaxis: { title: 'Y', range: [-range + plotCenter.y, range + plotCenter.y], backgroundcolor: isLight ? "#f0f6ff" : "#0d1b2a", gridcolor: isLight ? "#ddd" : "#2a3a4a" },
            zaxis: { title: 'Z', range: [-range, range], backgroundcolor: isLight ? "#f0f6ff" : "#0d1b2a", gridcolor: isLight ? "#ddd" : "#2a3a4a" },
            camera: { eye: {x: 1.5, y: 1.5, z: 1.2} }
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: 0, r: 0, t: 40, b: 0 }
    };

    await Plotly.react('graphCanvas', data, layout3D, {responsive: true});
}

// --- ДОПОМІЖНІ ФУНКЦІЇ ---

function displayAnalysis(analysis) {
    const { type, extras, parsed } = analysis;
    const f = n => (n === undefined || n === null) ? 'N/A' : n.toFixed(2);
    let html = `<div><strong>Тип:</strong> ${type.toUpperCase()}`;
    if(Math.abs(extras.Fp) < 1e-9 && type !== 'парабола' || extras.isDegenerate) {
        html += ` (вироджена)`;
    }
    html += `</div>`;
    if (extras.center) html += `<div><strong>Центр:</strong> (${f(extras.center.x)}, ${f(extras.center.y)})</div>`;
    if (extras.vertex) html += `<div><strong>Вершина:</strong> (${f(extras.vertex.x)}, ${f(extras.vertex.y)})</div>`;
    if (type === 'гіпербола' && extras.a) { html += `<div><strong>Дійсна піввісь (a):</strong> ${f(extras.a)}</div><div><strong>Уявна піввісь (b):</strong> ${f(extras.b)}</div>`; if (extras.latus_rectum) html += `<div><strong>Фокальний параметр (2p):</strong> ${f(extras.latus_rectum)}</div>`; } 
    else if (type === 'еліпс' && extras.a) { html += `<div><strong>Велика піввісь (a):</strong> ${f(extras.a)}</div><div><strong>Мала піввісь (b):</strong> ${f(extras.b)}</div>`; }
    if (extras.e !== undefined) html += `<div><strong>Ексцентриситет (e):</strong> ${f(extras.e)}</div>`;
    if (extras.f1 && extras.f2) html += `<div><strong>Фокуси:</strong><br>F1(${f(extras.f1[0])}, ${f(extras.f1[1])})<br>F2(${f(extras.f2[0])}, ${f(extras.f2[1])})</div>`;
    else if (extras.focus) html += `<div><strong>Фокус:</strong> F(${f(extras.focus.x)}, ${f(extras.focus.y)})</div>`;
    
    const f_canon = n => Number.isInteger(n) ? n : n.toFixed(3).replace(/\.?0+$/, "");
    let canonicalHtml = '';
    if (type !== 'парабола' && extras.a && extras.b) {
        const a_sq = f_canon(extras.a * extras.a), b_sq = f_canon(extras.b * extras.b);
        const sign = (extras.lambda[0] * extras.lambda[1] < 0) ? "-" : "+";
        canonicalHtml = `$$ \\frac{(x'')^2}{${a_sq}} ${sign} \\frac{(y'')^2}{${b_sq}} = 1 $$`;
    } else if (type === 'парабола' && extras.lambda !== undefined && extras.E_prime !== undefined) {
        const p = -extras.E_prime / extras.lambda;
        canonicalHtml = `$$ (x'')^2 = ${f_canon(p)}y'' $$`;
    }
    if (canonicalHtml) html += `<div><strong>Канонічне рівняння:</strong>${canonicalHtml}</div>`;

    if ($('solveOutput')) $('solveOutput').innerHTML = html;
    if ($('stepsOutput')) $('stepsOutput').innerHTML = Solver.getSteps(parsed, analysis);
    if (window.MathJax && MathJax.typeset) MathJax.typeset();
}

function getExtrasTraces(analysis, range) {
    const traces = [], { extras, type } = analysis;
    if (!extras) return [];
    const center = extras.center || extras.vertex;
    if (center) traces.push({ x: [center.x], y: [center.y], mode: 'markers+text', marker: { color: '#ff4d4d', size: 8 }, text: [extras.center ? 'Центр' : 'Вершина'], textposition: 'top right', hoverinfo: 'skip' });
    if (extras.f1 && extras.f2) { traces.push({ x: [extras.f1[0], extras.f2[0]], y: [extras.f1[1], extras.f2[1]], mode: 'markers', marker: { color: '#FFEB3B', size: 8 }, hoverinfo: 'skip' }); Solver.directrixSegments(extras.center, extras.vecs, extras.a, extras.c, range).forEach(s => traces.push({x: s.xs, y: s.ys, mode: 'lines', line: { color: '#80cbc4', dash: 'dash' }, hoverinfo: 'skip' })); }
    else if (extras.focus) { traces.push({ x: [extras.focus.x], y: [extras.focus.y], mode: 'markers', marker: { color: '#FFEB3B', size: 8 }, hoverinfo: 'skip' }); const seg = Solver.parabolaDirectrixSegment(extras.vertex, extras.v_axis, extras.focal_dist, range); traces.push({x: seg.xs, y: seg.ys, mode: 'lines', line: { color: '#80cbc4', dash: 'dash' }, hoverinfo: 'skip' }); }
    if (type === 'гіпербола' && extras.a && extras.b) { Solver.asymptoteSegments(extras.center, extras.vecs, extras.a, extras.b, range).forEach(s => traces.push({ x: s.xs, y: s.ys, mode: 'lines', line: { color: '#f44336', dash: 'longdashdot', width: 1.5 }, hoverinfo: 'skip'})); }
    if ((type === 'гіпербола' || type === 'еліпс' || type === 'коло') && extras.vecs) { const [mainVec, minorVec] = extras.vecs; traces.push({ x: [center.x - range * mainVec[0], center.x + range * mainVec[0]], y: [center.y - range * mainVec[1], center.y + range * mainVec[1]], mode: 'lines', line: { color: '#ff9800', width: 1 }, hoverinfo: 'skip' }); traces.push({ x: [center.x - range * minorVec[0], center.x + range * minorVec[0]], y: [center.y - range * minorVec[1], center.y + range * minorVec[1]], mode: 'lines', line: { color: '#ba68c8', dash: 'dot', width: 1.5 }, hoverinfo: 'skip' }); }
    else if (type === 'парабола' && extras.v_axis) { const axisVec = extras.v_axis; traces.push({ x: [center.x - range * axisVec[0], center.x + range * axisVec[0]], y: [center.y - range * axisVec[1], center.y + range * axisVec[1]], mode: 'lines', line: { color: '#ff9800', width: 1 }, hoverinfo: 'skip' }); }
    return traces;
}

function buildGrid(A,B,C,D,E,F, range, N){
    const x = Array.from({length: N}, (_, i) => -range + 2*range*i/(N-1));
    const y = [...x];
    const z = y.map(yi => x.map(xi => A*xi*xi + B*xi*yi + C*yi*yi + D*xi + E*yi + F));
    return {x, y, z};
}

function estimateRangeForPlot(parsed, extras){
    const maxCoef = Math.max(...Object.values(parsed).map(v => Math.abs(v)), 1);
    let r = Math.max(8, Math.min(100, Math.sqrt(maxCoef) * 3 + 5));
    if (extras.a) r = Math.max(r, extras.a * 2.2 + (extras.c || 0));
    if (extras.vertex) r = Math.max(r, Math.abs(extras.vertex.x)*2, Math.abs(extras.vertex.y)*2, 10);
    return r;
}

function getLayout(range){
    const isLight = document.body.classList.contains('theme-light');
    const axisColor = isLight ? '#333' : '#9aa4ad';
    const labelColor = isLight ? '#000' : '#fff';
    return {
        xaxis: { range: [-range, range], showgrid: true, zeroline: true, zerolinewidth: 1.5, zerolinecolor: axisColor, tickfont: { color: axisColor } },
        yaxis: { range: [-range, range], showgrid: true, zeroline: true, zerolinewidth: 1.5, zerolinecolor: axisColor, tickfont: { color: axisColor }, scaleanchor: 'x', scaleratio: 1 },
        plot_bgcolor: 'rgba(0,0,0,0)', 
        paper_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: 40, r: 20, t: 20, b: 40 },
        showlegend: false,
        clickmode: 'event+select', // ВИПРАВЛЕНО: Додано для роботи кліків
        hovermode: 'closest', // ВИПРАВЛЕНО: Додано для роботи наведення
        annotations: [
            { xref: 'paper', yref: 'yaxis', x: 1.02, y: 0, text: 'X', showarrow: false, font:{color: labelColor, size: 14}},
            { xref: 'xaxis', yref: 'paper', x: 0, y: 1.02, text: 'Y', showarrow: false, font:{color: labelColor, size: 14}}
        ]
    };
}

function loadEquationFromURLOrStorage() {
    const eqInput = $('equationInput');
    if (!eqInput) return;
    const urlParams = new URLSearchParams(window.location.search);
    const eqFromUrl = urlParams.get('eq');
    if (eqFromUrl) {
        eqInput.value = decodeURIComponent(eqFromUrl);
        analyzeAndPlot();
    } else {
        const lastEq = localStorage.getItem('conics_last_equation');
        if (lastEq) {
            eqInput.value = lastEq;
            analyzeAndPlot();
        }
    }
}

function shareEquation() {
    const eq = $('equationInput').value.trim();
    if (!eq) { alert("Введіть рівняння, щоб поділитися ним."); return; }
    const encodedEq = encodeURIComponent(eq);
    const url = `${window.location.origin}${window.location.pathname}?eq=${encodedEq}`;
    navigator.clipboard.writeText(url).then(() => { alert("Посилання скопійовано в буфер обміну!"); }, () => { alert("Не вдалося скопіювати посилання."); });
}

function setupDragAndDrop() {
    const trashCan = $('trashCan'), exampleList = $('exampleList');
    if (!trashCan || !exampleList) return;
    let draggedIndex = null;
    trashCan.addEventListener('dragover', (e) => { e.preventDefault(); trashCan.classList.add('over'); });
    trashCan.addEventListener('dragleave', () => { trashCan.classList.remove('over'); });
    trashCan.addEventListener('drop', (e) => { e.preventDefault(); trashCan.classList.remove('over'); const index = parseInt(e.dataTransfer.getData('text/plain'), 10); if (!isNaN(index)) { Solver.examples.splice(index, 1); Solver.persistExamples(); renderExampleList(); } });
    exampleList.addEventListener('dragstart', (e) => { if (e.target.matches('.btn')) { draggedIndex = parseInt(e.target.dataset.index, 10); e.dataTransfer.setData('text/plain', draggedIndex); } });
    exampleList.addEventListener('dragover', (e) => { e.preventDefault(); const target = e.target.closest('.btn'); if (target) { exampleList.querySelectorAll('.btn').forEach(btn => btn.classList.remove('drag-over')); target.classList.add('drag-over'); } });
    exampleList.addEventListener('dragleave', (e) => { const target = e.target.closest('.btn'); if (target) target.classList.remove('drag-over'); });
    exampleList.addEventListener('drop', (e) => { e.preventDefault(); const target = e.target.closest('.btn'); if (target) target.classList.remove('drag-over'); if (draggedIndex !== null) { const targetIndex = parseInt(target.dataset.index, 10); if (draggedIndex !== targetIndex) { const [item] = Solver.examples.splice(draggedIndex, 1); Solver.examples.splice(targetIndex, 0, item); Solver.persistExamples(); renderExampleList(); } } });
}

function renderExampleList() {
    const eqInput = $('equationInput');
    const node = $('exampleList');
    if (!node) return;
    node.innerHTML = '';
    (Solver.examples || []).forEach((eq, index) => {
        const btn = document.createElement('button');
        btn.className = 'btn subtle';
        btn.textContent = eq;
        btn.draggable = true;
        btn.dataset.index = index;
        btn.onclick = () => {
            eqInput.value = eq;
            analyzeAndPlot();
        };
        node.appendChild(btn);
    });
}

function openLibraryModal() {
    const eqInput = $('equationInput');
    const modal = $('libraryModal'), content = $('libraryContent');
    if (!modal || !content) return;
    content.innerHTML = '';
    Solver.equationLibrary.forEach(category => {
        const categoryTitle = document.createElement('h3');
        categoryTitle.textContent = category.category;
        content.appendChild(categoryTitle);
        const grid = document.createElement('div');
        grid.className = 'library-grid';
        category.equations.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.innerHTML = `<strong>${item.name}:</strong><br>${item.eq}`;
            btn.onclick = () => {
                eqInput.value = item.eq;
                closeLibraryModal();
                analyzeAndPlot();
            };
            grid.appendChild(btn);
        });
        content.appendChild(grid);
    });
    modal.classList.remove('hidden');
}

function closeLibraryModal() {
    const modal = $('libraryModal');
    if (modal) modal.classList.add('hidden');
}