/* canonical.js
    - Handles UI for the canonical builder page
    - Converts canonical parameters to general form coefficients {A,B,C,D,E,F}
    - Uses solver.js and graph.js to perform analysis and plotting
*/

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    // Tab switching logic
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.type}-form`).classList.add('active');
        });
    });

    // Build button event listener
    $('buildBtnCanonical').addEventListener('click', buildFromCanonical);

    // Initial build on page load
    buildFromCanonical();
});

/**
 * Reads parameters from the active tab, converts to general form, and plots.
 */
function buildFromCanonical() {
    const activeTab = document.querySelector('.tab-btn.active').dataset.type;
    let coeffs = {};

    try {
        if (activeTab === 'ellipse') {
            const a = parseFloat($('ellipse-a').value) || 0;
            const b = parseFloat($('ellipse-b').value) || 0;
            const h = parseFloat($('ellipse-h').value) || 0;
            const k = parseFloat($('ellipse-k').value) || 0;
            if (a === 0 || b === 0) throw new Error("Півосі не можуть дорівнювати нулю.");
            
            // (x-h)²/a² + (y-k)²/b² = 1  => b²(x-h)² + a²(y-k)² - a²b² = 0
            const a2 = a * a;
            const b2 = b * b;
            coeffs.A = b2;
            coeffs.B = 0;
            coeffs.C = a2;
            coeffs.D = -2 * h * b2;
            coeffs.E = -2 * k * a2;
            coeffs.F = h * h * b2 + k * k * a2 - a2 * b2;
        } 
        else if (activeTab === 'hyperbola') {
            const a = parseFloat($('hyperbola-a').value) || 0;
            const b = parseFloat($('hyperbola-b').value) || 0;
            const h = parseFloat($('hyperbola-h').value) || 0;
            const k = parseFloat($('hyperbola-k').value) || 0;
            const orientation = $('hyperbola-orientation').value;
            if (a === 0 || b === 0) throw new Error("Півосі не можуть дорівнювати нулю.");

            const a2 = a * a;
            const b2 = b * b;
            
            if (orientation === 'horizontal') {
                // (x-h)²/a² - (y-k)²/b² = 1 => b²(x-h)² - a²(y-k)² - a²b² = 0
                coeffs.A = b2;
                coeffs.B = 0;
                coeffs.C = -a2;
                coeffs.D = -2 * h * b2;
                coeffs.E = 2 * k * a2;
                coeffs.F = h * h * b2 - k * k * a2 - a2 * b2;
            } else { // vertical
                // (y-k)²/a² - (x-h)²/b² = 1 => b²(y-k)² - a²(x-h)² - a²b² = 0
                coeffs.A = -a2;
                coeffs.B = 0;
                coeffs.C = b2;
                coeffs.D = 2 * h * a2;
                coeffs.E = -2 * k * b2;
                coeffs.F = -h * h * a2 + k * k * b2 - a2 * b2;
            }
        }
        else if (activeTab === 'parabola') {
            const p = parseFloat($('parabola-p').value) || 0;
            const h = parseFloat($('parabola-h').value) || 0;
            const k = parseFloat($('parabola-k').value) || 0;
            const orientation = $('parabola-orientation').value;
            if (p === 0) throw new Error("Параметр 'p' не може дорівнювати нулю.");

            const four_p = 4 * p;
            
            coeffs.B = 0;
            if (orientation.startsWith('horizontal')) {
                // (y-k)² = ±4p(x-h) => y² - 2ky + k² ∓ 4px ± 4ph = 0
                coeffs.A = 0;
                coeffs.C = 1;
                coeffs.D = orientation === 'horizontal-right' ? -four_p : four_p;
                coeffs.E = -2 * k;
                coeffs.F = k * k + (orientation === 'horizontal-right' ? four_p * h : -four_p * h);
            } else { // vertical
                // (x-h)² = ±4p(y-k) => x² - 2hx + h² ∓ 4py ± 4pk = 0
                coeffs.A = 1;
                coeffs.C = 0;
                coeffs.D = -2 * h;
                coeffs.E = orientation === 'vertical-up' ? -four_p : four_p;
                coeffs.F = h * h + (orientation === 'vertical-up' ? four_p * k : -four_p * k);
            }
        }

        const analysis = Solver.analyzeGeneral(coeffs);
        window.lastAnalysis = analysis; // Save for redraws
        
        // Use global functions from graph.js
        displayAnalysis(analysis);
        plotAnalysis(analysis);

    } catch (e) {
        alert("Помилка: " + e.message);
    }
}