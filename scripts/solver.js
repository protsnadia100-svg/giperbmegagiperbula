/* solver.js
    - parseGeneralEquation(input) -> {A,B,C,D,E,F}
    - analyzeGeneral(parsed) -> { parsed, extras, type, disc }
    - canonicalToXY(center, vecs, u, v)
    - directrixSegments(center, vecs, a, c, range)
    - asymptoteSegments(center, vecs, a, b, range) -> NEW
    - parabolaDirectrixSegment(vertex, axisVec, focal_dist, range)
    - getSteps(parsed, analysis) -> string
    - examples (localStorage)
*/

(function() {
    const EXAMPLES_KEY = 'conics_pro_examples_v1';

    // Завантаження прикладів з localStorage або використання стандартних
    function loadExamples() {
        try {
            const raw = localStorage.getItem(EXAMPLES_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { console.error("Failed to load examples from localStorage", e); }
        return [ "x^2/9 - y^2/4 = 1", "y^2/16 - x^2/25 = 1", "5x^2 - 6xy + 5y^2 - 32 = 0", "x^2 + y^2 = 25", "x^2/16 + y^2/9 = 1", "y^2 = 4x" ];
    }
    const examples = loadExamples();
    function persistExamples() { try { localStorage.setItem(EXAMPLES_KEY, JSON.stringify(examples)); } catch (e) {} }

    /*
     * ОНОВЛЕНИЙ НАДІЙНИЙ ПАРСЕР РІВНЯННЯ
     */
    function parseGeneralEquation(input) {
        if (!input || typeof input !== 'string') return null;
        
        let s = input.replace(/\s+/g, '').replace(/–|−/g, '-');
        
        if (s.includes('=')) {
            const [lhs, rhs] = s.split('=');
            s = `(${lhs})-(${rhs})`;
        }

        // Перетворюємо дроби типу x^2/9 на (1/9)*x^2, що легше для парсингу
        s = s.replace(/([+-])?(x\^2|y\^2)\/(\d+\.?\d*)/g, (match, sign, variable, den) => {
             sign = sign || '+';
             return `${sign}(1/${den})*${variable}`;
        });
        
        // Регулярний вираз для знаходження всіх доданків, включаючи коефіцієнти в дужках
        const termRegex = /([+-]?(?:\([^)]+\)|(?:\d*\.\d+|\d+)))?\*?(x\^2|y\^2|xy|x|y)/g;
        
        if (!s.startsWith('+') && !s.startsWith('-')) {
            s = '+' + s;
        }

        let A = 0, B = 0, C = 0, D = 0, E = 0, F = 0;
        let match;
        
        let remainingStr = s;

        while ((match = termRegex.exec(s)) !== null) {
            remainingStr = remainingStr.replace(match[0], '');

            let coeffStr = match[1];
            let variable = match[2];
            let coeff;

            if (coeffStr === undefined || coeffStr === '+') {
                coeff = 1.0;
            } else if (coeffStr === '-') {
                coeff = -1.0;
            } else {
                coeff = parseNumberExpression(coeffStr);
            }

            if (variable === 'x^2') A += coeff;
            else if (variable === 'y^2') C += coeff;
            else if (variable === 'xy') B += coeff;
            else if (variable === 'x') D += coeff;
            else if (variable === 'y') E += coeff;
        }
        
        if (remainingStr) {
            const constantMatches = remainingStr.match(/[+-]?\d+\.?\d*/g);
            if (constantMatches) {
                constantMatches.forEach(c => F += parseFloat(c));
            }
        }

        return { A, B, C, D, E, F };
    }


    // Допоміжна функція для обчислення значення коефіцієнта
    function parseNumberExpression(str) {
        str = (str || '').trim();
        if (str === '' || str === '+') return 1;
        if (str === '-') return -1;
        if (str.startsWith('(') && str.endsWith(')')) {
            str = str.slice(1, -1);
        }
        if (str.includes('/')) {
            const [a, b] = str.split('/');
            return (parseFloat(a) || 0) / (parseFloat(b) || 1);
        }
        const v = parseFloat(str);
        return Number.isFinite(v) ? v : 0;
    }

    /* --- Лінійна алгебра --- */
    function det2(a, b, c, d) { return a * d - b * c; }
    function normalize2(v) { const s = Math.hypot(v[0], v[1]) || 1; return [v[0] / s, v[1] / s]; }
    function eigen2(a, b, c) {
        const tr = a + c, det = a * c - b * b, disc = Math.sqrt(Math.max(0, tr * tr - 4 * det));
        const l1 = (tr + disc) / 2, l2 = (tr - disc) / 2;
        let v1 = Math.abs(b) > 1e-9 ? [l1 - c, b] : (Math.abs(a-l1) > 1e-9 ? [0,1] : [1, 0]);
        let v2 = Math.abs(b) > 1e-9 ? [l2 - c, b] : (Math.abs(a-l2) > 1e-9 ? [0,1] : [1, 0]);
        return { vals: [l1, l2], vecs: [normalize2(v1), normalize2(v2)] };
    }

    /*
     * Головна функція аналізу
     */
    function analyzeGeneral(parsed) {
        const { A, B, C, D, E, F } = parsed;
        const disc = B * B - 4 * A * C;
        let type = 'невідомо';
        const extras = {};
        if (Math.abs(disc) < 1e-9) type = 'парабола';
        else if (disc > 0) type = 'гіпербола';
        else type = (Math.abs(A - C) < 1e-9 && Math.abs(B) < 1e-9) ? 'коло' : 'еліпс';
        if (type !== 'парабола') {
            const M_det = det2(2 * A, B, B, 2 * C);
            const center = Math.abs(M_det) < 1e-9 ? { x: 0, y: 0 } : { x: det2(-D, B, -E, 2 * C) / M_det, y: det2(2 * A, -D, B, -E) / M_det };
            const Fp = A*center.x*center.x + B*center.x*center.y + C*center.y*center.y + D*center.x + E*center.y + F;
            const RHS = -Fp;
            const eig = eigen2(A, B / 2, C);
            let eigenPairs = [{ val: eig.vals[0], vec: eig.vecs[0] }, { val: eig.vals[1], vec: eig.vecs[1] }];
            if (type === 'гіпербола') { if ((eigenPairs[0].val / RHS) < 0) [eigenPairs[0], eigenPairs[1]] = [eigenPairs[1], eigenPairs[0]]; } 
            else if (type === 'еліпс') { if (Math.abs(eigenPairs[0].val) > Math.abs(eigenPairs[1].val)) [eigenPairs[0], eigenPairs[1]] = [eigenPairs[1], eigenPairs[0]]; }
            eig.vals = [eigenPairs[0].val, eigenPairs[1].val];
            eig.vecs = [eigenPairs[0].vec, eigenPairs[1].vec];
            let a2 = Math.abs(eig.vals[0]) > 1e-12 ? RHS / eig.vals[0] : null;
            let b2 = Math.abs(eig.vals[1]) > 1e-12 ? RHS / eig.vals[1] : null;
            const angle = Math.atan2(eig.vecs[0][1], eig.vecs[0][0]) * 180 / Math.PI;
            Object.assign(extras, { center, Fp, lambda: eig.vals, vecs: eig.vecs, a2, b2, disc, angle });
            if (a2 !== null && b2 !== null) {
                extras.a = Math.sqrt(Math.abs(a2));
                extras.b = Math.sqrt(Math.abs(b2));
                if (type === 'гіпербола') {
                    extras.c = Math.sqrt(extras.a * extras.a + extras.b * extras.b);
                    if (extras.a > 1e-9) {
                        extras.latus_rectum = 2 * extras.b * extras.b / extras.a;
                    }
                }
                else if (type === 'еліпс' || type === 'коло') extras.c = Math.sqrt(Math.abs(extras.a * extras.a - extras.b * extras.b));
                
                if (extras.a > 1e-9) extras.e = extras.c / extras.a;
                if (extras.c) {
                    extras.f1 = canonicalToXY(extras.center, extras.vecs, extras.c, 0);
                    extras.f2 = canonicalToXY(extras.center, extras.vecs, -extras.c, 0);
                }
            }
        } else {
            const eig = eigen2(A, B/2, C);
            const main_idx = Math.abs(eig.vals[0]) > 1e-9 ? 0 : 1, axis_idx = 1 - main_idx;
            const lambda = eig.vals[main_idx], v_main = eig.vecs[main_idx], v_axis = eig.vecs[axis_idx];
            const D_prime = D * v_main[0] + E * v_main[1], E_prime = D * v_axis[0] + E * v_axis[1];
            if (Math.abs(E_prime) < 1e-9) { Object.assign(extras, { vecs: eig.vecs, isDegenerate: true }); } 
            else {
                const x_v_prime = -D_prime / (2 * lambda), y_v_prime = (D_prime**2 - 4 * lambda * F) / (4 * lambda * E_prime);
                const focal_dist = -E_prime / (2 * lambda) / 2;
                const vertex = { x: x_v_prime * v_main[0] + y_v_prime * v_axis[0], y: x_v_prime * v_main[1] + y_v_prime * v_axis[1] };
                const focus = { x: vertex.x + focal_dist * v_axis[0], y: vertex.y + focal_dist * v_axis[1] };
                const angle = Math.atan2(v_axis[1], v_axis[0]) * 180 / Math.PI;
                Object.assign(extras, { vertex, focus, focal_dist, v_axis, vecs: eig.vecs, angle, lambda, E_prime, e: 1 });
            }
        }
        return { parsed, extras, type, disc };
    }

    /*
     * Формує текстовий опис кроків розв'язання
     */
    function getSteps(parsed, analysis) {
        const { A, B, C, D, E, F } = parsed;
        const { type, disc, extras } = analysis;
        const steps = [];
        const f = n => Number.isInteger(n) ? n : n.toFixed(3).replace(/\.?0+$/, "");
        steps.push(`<b>1. Початкове рівняння:</b><br>$$ ${f(A)}x^2 + ${f(B)}xy + ${f(C)}y^2 + ${f(D)}x + ${f(E)}y + ${f(F)} = 0 $$`);
        steps.push(`<b>2. Визначення типу кривої:</b><br>Інваріант $$ \\Delta = B^2 - 4AC = ${f(disc)} $$. Оскільки $$ \\Delta ${disc > 1e-9 ? "> 0" : (disc < -1e-9 ? "< 0" : "\\approx 0")}$$, крива є <b>${type}</b>.`);
        if (type !== 'парабола') {
            const { center, Fp, angle, lambda, a, b } = extras;
            steps.push(`<b>3. Паралельний перенос:</b><br>Центр: <b>$$ (x_0, y_0) = (${f(center.x)}, ${f(center.y)}) $$</b>.`);
            steps.push(`Після переносу рівняння набуває вигляду:<br>$$ ${f(A)}x'^2 + ${f(B)}x'y' + ${f(C)}y'^2 + ${f(Fp)} = 0 $$`);
            steps.push(`<b>4. Поворот осей:</b><br>Повертаємо осі на кут <b>$$ \\alpha \\approx ${f(angle)}^\\circ $$</b>. Рівняння у новій системі x''y'':<br>$$ ${f(lambda[0])}(x'')^2 + ${f(lambda[1])}(y'')^2 + ${f(Fp)} = 0 $$`);
            if (a && b) steps.push(`<b>5. Канонічне рівняння:</b><br>$$ \\frac{(x'')^2}{${f(a*a)}} ${lambda[0] * lambda[1] < 0 ? "-" : "+"} \\frac{(y'')^2}{${f(b*b)}} = 1 $$`);
        } else {
            if (extras.angle !== undefined) {
                const { angle, lambda, E_prime, vertex } = extras;
                const p = -E_prime / lambda;
                steps.push(`<b>3. Поворот осей:</b><br>Повертаємо осі на кут <b>$$ \\alpha \\approx ${f(angle)}^\\circ $$</b>.`);
                steps.push(`Рівняння у новій системі x'y':<br>$$ ${f(lambda)}(x')^2 + ... + ${f(E_prime)}y' + ... = 0 $$`);
                steps.push(`<b>4. Паралельний перенос:</b><br>Вершина параболи: <b>$$ (${f(vertex.x)}, ${f(vertex.y)}) $$</b>`);
                if (p) steps.push(`<b>5. Канонічне рівняння:</b><br>$$ (x'')^2 = ${f(p)}y'' $$`);
            } else { steps.push("Це вироджений випадок параболи (пара паралельних прямих)."); }
        }
        return steps.join('<hr style="border-top: 1px solid rgba(128,128,128,0.2); margin: 8px 0;">');
    }

    // Перетворення з локальних координат (u, v) у глобальні (x, y)
    function canonicalToXY(center, vecs, u, v) {
        const x = center.x + u * vecs[0][0] + v * vecs[1][0];
        const y = center.y + u * vecs[0][1] + v * vecs[1][1];
        return [x, y];
    }
    
    // Генерує відрізки для директрис
    function directrixSegments(center, vecs, a, c, range = 100) {
        if (!a || !c || c < 1e-9) return [];
        const u_dist = a * a / c, segs = [];
        [-u_dist, u_dist].forEach(u_val => {
            const xs = [], ys = [];
            for (let v = -range; v <= range; v += range / 50) {
                const p = canonicalToXY(center, vecs, u_val, v); xs.push(p[0]); ys.push(p[1]);
            }
            segs.push({ xs, ys });
        });
        return segs;
    }
    
    // Генерує відрізки для асимптот
    function asymptoteSegments(center, vecs, a, b, range = 100) {
        if (!a || !b) return [];
        const slope = b / a;
        const segs = [];
        [-slope, slope].forEach(s => {
            const p1 = canonicalToXY(center, vecs, -range, s * -range);
            const p2 = canonicalToXY(center, vecs, range, s * range);
            segs.push({ xs: [p1[0], p2[0]], ys: [p1[1], p2[1]] });
        });
        return segs;
    }

    // Генерує відрізок для директриси параболи
    function parabolaDirectrixSegment(vertex, axisVec, focal_dist, range) {
        const dx = vertex.x - focal_dist * axisVec[0], dy = vertex.y - focal_dist * axisVec[1];
        const dirVec = [-axisVec[1], axisVec[0]];
        const x1 = dx - range * dirVec[0], y1 = dy - range * dirVec[1];
        const x2 = dx + range * dirVec[0], y2 = dy + range * dirVec[1];
        return { xs: [x1, x2], ys: [y1, y2] };
    }
    
    // ОНОВЛЕНА БІБЛІОТЕКА: Додано більше прикладів загального вигляду
    const equationLibrary = [
        {
            category: 'Гіпербола',
            equations: [
                { name: 'Спряжена (повернута)', eq: 'xy = 8' },
                { name: 'Загального вигляду (повернута)', eq: 'x^2 - 4xy + y^2 + 8x - 4y + 4 = 0' },
                { name: 'Загального вигляду (зі зміщенням)', eq: '9x^2 - 16y^2 - 18x - 64y - 199 = 0' },
                { name: 'Загального вигляду (складний)', eq: '2x^2 + 7xy + 3y^2 + 8x + 14y - 6 = 0' }
            ]
        },
        {
            category: 'Еліпс',
            equations: [
                { name: 'Загального вигляду (повернутий)', eq: '5x^2 - 6xy + 5y^2 - 32 = 0' },
                { name: 'Загального вигляду (зі зміщенням)', eq: '4x^2 + 9y^2 - 16x + 18y - 11 = 0' },
                { name: 'Загального вигляду (повернутий, інший)', eq: '13x^2 - 10xy + 13y^2 - 72 = 0' }
            ]
        },
        {
            category: 'Парабола',
            equations: [
                { name: 'Загального вигляду (повернута)', eq: 'x^2 - 2xy + y^2 - 8x - 8y = 0' },
                { name: 'Загального вигляду (зі зміщенням)', eq: 'y^2 - 8x - 6y + 17 = 0' },
                { name: 'Загального вигляду (складна)', eq: '4x^2 - 4xy + y^2 - 8x - 6y + 5 = 0' }
            ]
        },
        {
            category: 'Коло',
            equations: [
                { name: 'Загального вигляду (зі зміщенням)', eq: 'x^2 + y^2 - 6x + 4y - 12 = 0' },
                { name: 'Загального вигляду (інше зміщення)', eq: 'x^2 + y^2 + 8x - 10y - 8 = 0' }
            ]
        }
    ];

    // Експортуємо API модуля в глобальний об'єкт window
    window.Solver = { parseGeneralEquation, analyzeGeneral, getSteps, canonicalToXY, directrixSegments, asymptoteSegments, parabolaDirectrixSegment, examples, addExample: (eq) => { if (eq && eq.trim()) { examples.unshift(eq.trim()); persistExamples(); } }, persistExamples, equationLibrary };
})();