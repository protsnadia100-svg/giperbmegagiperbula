/* locus_animation.js
    - Handles the logic for the "Locus Animation" mode.
    - Draws the geometric definition of a conic section on an overlay canvas.
    - Shows the moving point and its relationship to foci/directrix.
    - ОНОВЛЕНО: Додано візуальні ефекти: "слід комети", пульсуюча точка та "живі" лінії.
    - ОНОВЛЕНО: Гіпербола тепер малює обидві гілки.
    - ОНОВЛЕНО: Покращено візуальний стиль інформаційного блоку.
*/

const LocusAnimator = (() => {
    let animationFrameId = null;
    let ctx, canvas, plotCanvas, analysis, pointParam, time;
    let onCompleteCallback = null; // Для повідомлення про завершення
    let pathPoints = []; // Масив для зберігання точок шляху
    let speed = 0.035; // Зменшена швидкість для кращої візуалізації

    // Параметри для керування анімацією
    let startParam, endParam, loop;
    let hyperbolaBranch = 1; // 1 для першої гілки, -1 для другої

    /**
     * Запускає анімацію для поточної кривої
     */
    function start(currentAnalysis, canvasId, plotCanvasId, callback) {
        stop(); 
        
        analysis = currentAnalysis;
        canvas = document.getElementById(canvasId);
        plotCanvas = document.getElementById(plotCanvasId);
        if (!analysis || !canvas || !plotCanvas || !plotCanvas.layout) {
            console.error("Animator failed: Missing analysis data or canvas elements.");
            return;
        }
        ctx = canvas.getContext('2d');
        onCompleteCallback = callback; // Зберігаємо функцію зворотного виклику
        
        canvas.width = plotCanvas.clientWidth;
        canvas.height = plotCanvas.clientHeight;

        pathPoints = []; 
        time = 0;
        hyperbolaBranch = 1;

        // Налаштування параметрів залежно від типу кривої
        switch(analysis.type) {
            case 'еліпс':
            case 'коло':
                startParam = 0;
                endParam = 2 * Math.PI;
                loop = true;
                break;
            case 'гіпербола':
                startParam = -2.0;
                endParam = 2.0;
                loop = false; // Не зациклюємо гіперболу, а малюємо обидві гілки
                break;
            case 'парабола':
                const range = Math.max(Math.abs(plotCanvas.layout.xaxis.range[0]), plotCanvas.layout.xaxis.range[1]);
                startParam = -range * 1.2;
                endParam = range * 1.2;
                loop = false;
                break;
        }
        pointParam = startParam;
        
        animationFrameId = requestAnimationFrame(draw);
    }

    /**
     * Зупиняє анімацію та очищує полотно
     */
    function stop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        onCompleteCallback = null; // Очищуємо callback при зупинці
    }

    /**
     * Функція для перетворення координат з системи графіка Plotly у координати полотна canvas
     */
    function mapCoords(x, y) {
        const layout = plotCanvas.layout;
        const xRange = layout.xaxis.range;
        const yRange = layout.yaxis.range;
        const canvasX = ((x - xRange[0]) / (xRange[1] - xRange[0])) * canvas.width;
        const canvasY = ((yRange[1] - y) / (yRange[1] - yRange[0])) * canvas.height;
        return { x: canvasX, y: canvasY };
    }

    /**
     * Головний цикл малювання анімації
     */
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        time += 1;

        // 1. Малюємо "слід комети"
        drawPathTrail();
        
        // 2. Оновлюємо параметр точки для наступного кадру
        pointParam += speed;

        let continueAnimation = true;

        // Логіка для гіперболи та зациклювання
        if (pointParam > endParam) {
            if (analysis.type === 'гіпербола' && hyperbolaBranch === 1) {
                pointParam = startParam;
                hyperbolaBranch = -1;
                pathPoints = [];
            } else if (loop) {
                pointParam = startParam;
                pathPoints = [];
            } else {
                continueAnimation = false; // Анімація завершена
            }
        }


        const { type, extras } = analysis;
        if (!extras) return;

        let worldCoords, textLines = [];

        // 3. Розрахунок координат точки та відстаней
        if ((type === 'еліпс' || type === 'коло') && extras.f1) {
            const u = extras.a * Math.cos(pointParam);
            const v = extras.b * Math.sin(pointParam);
            worldCoords = Solver.canonicalToXY(extras.center, extras.vecs, u, v);
            const d1 = Math.hypot(worldCoords[0] - extras.f1[0], worldCoords[1] - extras.f1[1]);
            const d2 = Math.hypot(worldCoords[0] - extras.f2[0], worldCoords[1] - extras.f2[1]);
            textLines = [`|PF₁| + |PF₂| = ${d1.toFixed(2)} + ${d2.toFixed(2)} = ${(d1+d2).toFixed(2)}`, `(константа 2a ≈ ${(2 * extras.a).toFixed(2)})`];
        } 
        else if (type === 'гіпербола' && extras.f1) {
            const u = hyperbolaBranch * extras.a * Math.cosh(pointParam); // Використовуємо hyperbolaBranch
            const v = extras.b * Math.sinh(pointParam);
            worldCoords = Solver.canonicalToXY(extras.center, extras.vecs, u, v);
            const d1 = Math.hypot(worldCoords[0] - extras.f1[0], worldCoords[1] - extras.f1[1]);
            const d2 = Math.hypot(worldCoords[0] - extras.f2[0], worldCoords[1] - extras.f2[1]);
            textLines = [`||PF₁| - |PF₂|| = |${d1.toFixed(2)} - ${d2.toFixed(2)}| = ${Math.abs(d1-d2).toFixed(2)}`, `(константа 2a ≈ ${(2 * extras.a).toFixed(2)})`];
        }
        else if (type === 'парабола' && extras.focus) {
            const p = -extras.E_prime / extras.lambda;
            const u = pointParam;
            const v = (u*u) / p;
            worldCoords = Solver.canonicalToXY(extras.vertex, [extras.vecs[1], extras.vecs[0]], u, v);
            const d_focus = Math.hypot(worldCoords[0] - extras.focus.x, worldCoords[1] - extras.focus.y);
            const range = Math.max(Math.abs(plotCanvas.layout.xaxis.range[0]), plotCanvas.layout.xaxis.range[1]);
            const dir_seg = Solver.parabolaDirectrixSegment(extras.vertex, extras.v_axis, extras.focal_dist, range*2);
            const d_directrix = distToLine(worldCoords[0], worldCoords[1], dir_seg.xs[0], dir_seg.ys[0], dir_seg.xs[1], dir_seg.ys[1]);
            textLines = [`|PF| (до фокуса) ≈ ${d_focus.toFixed(2)}`, `|PD| (до директриси) ≈ ${d_directrix.toFixed(2)}`];
        }

        if (!worldCoords) { stop(); return; }
        
        const newCanvasPoint = mapCoords(worldCoords[0], worldCoords[1]);
        if (pointParam <= endParam) { 
            pathPoints.push(newCanvasPoint);
        }
        if (pathPoints.length > 150) pathPoints.shift();

        // 4. Малювання динамічних елементів
        drawInteractiveElements(newCanvasPoint, textLines);

        // 5. Умова продовження анімації
        if (continueAnimation) {
            animationFrameId = requestAnimationFrame(draw);
        } else {
            // Викликаємо callback, якщо він є, і очищуємо його
            if (onCompleteCallback) {
                onCompleteCallback();
                onCompleteCallback = null;
            }
        }
    }
    
    function drawInteractiveElements(point, textLines) {
        const { type, extras } = analysis;

        if ((type === 'еліпс' || type === 'коло' || type === 'гіпербола') && extras.f1) {
            const f1 = mapCoords(extras.f1[0], extras.f1[1]);
            const f2 = mapCoords(extras.f2[0], extras.f2[1]);
            drawLine(point, f1, '#a777e3', true);
            drawLine(point, f2, '#a777e3', true);
            drawPoint(f1, '#FFEB3B', 5); drawLabel('F₁', f1);
            drawPoint(f2, '#FFEB3B', 5); drawLabel('F₂', f2);
        }
        else if (type === 'парабола' && extras.focus) {
            const focus = mapCoords(extras.focus.x, extras.focus.y);
            const range = Math.max(Math.abs(plotCanvas.layout.xaxis.range[0]), plotCanvas.layout.xaxis.range[1]);
            const dir_seg = Solver.parabolaDirectrixSegment(extras.vertex, extras.v_axis, extras.focal_dist, range*2);
            const d1 = mapCoords(dir_seg.xs[0], dir_seg.ys[0]);
            const d2 = mapCoords(dir_seg.xs[1], dir_seg.ys[1]);
            drawLine(d1, d2, '#80cbc4');
            const p_on_dir = closestPointOnLine(point, d1, d2);
            drawLine(point, p_on_dir, '#80cbc4', true);
            drawLine(point, focus, '#a777e3', true);
            drawPoint(focus, '#FFEB3B', 5); drawLabel('F', focus);
        }

        drawPoint(point, 'white', 6, true); // Малюємо головну точку з пульсацією
        drawLabel('P', point);
        drawInfoText(textLines);
    }
    
    // --- ОНОВЛЕНІ ФУНКЦІЇ МАЛЮВАННЯ ---
    
    function drawPathTrail() {
        if (pathPoints.length < 2) return;
        for (let i = 0; i < pathPoints.length - 1; i++) {
            const p1 = pathPoints[i];
            const p2 = pathPoints[i+1];
            const ratio = i / pathPoints.length;
            
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineWidth = ratio * 3; // Ширина сліду
            ctx.strokeStyle = `rgba(0, 255, 255, ${ratio * 0.8})`; // Прозорість сліду
            ctx.stroke();
        }
    }

    function drawLine(from, to, color, marching = false) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        if (marching) {
            ctx.setLineDash([6, 6]);
            ctx.lineDashOffset = -time;
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    function drawPoint(pos, color, size, pulse = false) {
        if (pulse) {
            const glowRadius = size + 4 + Math.sin(time * 0.1) * 2;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, glowRadius, 0, 2 * Math.PI);
            ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#0d1b2a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    
    function drawLabel(text, pos) {
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillStyle = document.body.classList.contains('theme-light') ? '#000' : '#fff';
        ctx.fillText(text, pos.x + 12, pos.y - 12);
    }
    
    function drawInfoText(lines) {
        const isLight = document.body.classList.contains('theme-light');
        const x = 15, y = 25, lineHeight = 22, padding = 12;
        const width = 310;
        const height = lines.length * lineHeight + padding;

        ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(13, 27, 42, 0.8)';
        ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x - padding, y - padding, width, height, [10]);
        ctx.fill();
        ctx.stroke();
        
        ctx.font = '14px "Roboto Mono", monospace';
        ctx.fillStyle = isLight ? '#0d1b2a' : '#e6eef3';
        lines.forEach((line, index) => {
            ctx.fillText(line, x, y + index * lineHeight);
        });
    }

    // --- ДОПОМІЖНІ МАТЕМАТИЧНІ ФУНКЦІЇ ---
    
    function distToLine(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        const numerator = Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1);
        const denominator = Math.sqrt(dx * dx + dy * dy);
        return denominator === 0 ? 0 : numerator / denominator;
    }
    
    function closestPointOnLine(p, a, b) {
        const ap = { x: p.x - a.x, y: p.y - a.y };
        const ab = { x: b.x - a.x, y: b.y - a.y };
        const ab2 = ab.x * ab.x + ab.y * ab.y;
        if (ab2 === 0) return a;
        const ap_ab = ap.x * ab.x + ap.y * ab.y;
        const t = ap_ab / ab2;
        return { x: a.x + ab.x * t, y: a.y + ab.y * t };
    }

    return { start, stop };
})();