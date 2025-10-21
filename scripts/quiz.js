/* quiz.js
    - Logic for the quiz page
    - Handles question generation, answer checking, and scoring
*/
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const introOverlay = document.getElementById('intro-overlay');
    const quizMain = document.getElementById('quiz-main');
    const resultsOverlay = document.getElementById('results-overlay');
    
    const equationDisplay = document.getElementById('equation-display');
    const answerButtonsContainer = document.getElementById('answer-buttons');
    const answerButtons = answerButtonsContainer.querySelectorAll('.btn');
    const feedbackDisplay = document.getElementById('feedback-display');
    const nextQuestionBtn = document.getElementById('next-question-btn');
    const scoreDisplay = document.getElementById('score-display');
    
    // Results screen elements
    const finalScoreDisplay = document.getElementById('final-score');
    const playAgainBtn = document.getElementById('play-again-btn');

    // Question bank
    const questions = [
        { equation: `x^2/9 + y^2/4 = 1`, answer: 'ellipse' },
        { equation: `x^2 - y^2 = 4`, answer: 'hyperbola' },
        { equation: `y^2 = 16x`, answer: 'parabola' },
        { equation: `x^2 + y^2 = 25`, answer: 'ellipse' },
        { equation: `y^2/9 - x^2/16 = 1`, answer: 'hyperbola' },
        { equation: `x = -2y^2 + 3y - 5`, answer: 'parabola' },
        { equation: `2x^2 + 5y^2 - 10 = 0`, answer: 'ellipse' },
        { equation: `3x^2 - 4y^2 - 12 = 0`, answer: 'hyperbola' },
        { equation: `4x^2 - 8x + y + 5 = 0`, answer: 'parabola' },
        { equation: `(x-1)^2 + (y+2)^2 = 9`, answer: 'ellipse' },
        { equation: `xy = 4`, answer: 'hyperbola' },
        { equation: `y = x^2`, answer: 'parabola' },
    ];
    const TOTAL_QUESTIONS = questions.length;

    let currentQuestionIndex = 0;
    let score = 0;
    let answered = false;

    // --- Lottery Logic ---
    const lotteryNumbersContainer = document.getElementById('lottery-numbers');
    const selectedNumberDisplay = document.getElementById('selected-number-display');
    const winningNumberEl = document.getElementById('winning-number');
    const totalNumbers = 24;

    for (let i = 1; i <= totalNumbers; i++) {
        const numberEl = document.createElement('div');
        numberEl.classList.add('lottery-number');
        numberEl.textContent = i;
        lotteryNumbersContainer.appendChild(numberEl);
    }
    
    function runLottery() {
        const numbers = Array.from(lotteryNumbersContainer.children);
        const shuffleInterval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * numbers.length);
            numbers.forEach(n => n.classList.remove('active'));
            numbers[randomIndex].classList.add('active');
        }, 100);

        setTimeout(() => {
            clearInterval(shuffleInterval);
            const winningNumber = Math.floor(Math.random() * totalNumbers) + 1;
            numbers.forEach(n => {
                n.classList.remove('active');
                if (parseInt(n.textContent) === winningNumber) {
                    n.classList.add('winner');
                }
            });
            lotteryNumbersContainer.style.opacity = '0.5';
            winningNumberEl.textContent = winningNumber;
            selectedNumberDisplay.classList.remove('hidden');

            setTimeout(startQuiz, 2000);
        }, 3000);
    }

    // --- Main Quiz Logic ---
    function startQuiz() {
        introOverlay.classList.add('hidden');
        quizMain.classList.remove('hidden');
        resultsOverlay.classList.add('hidden');
        
        currentQuestionIndex = 0;
        score = 0;
        answered = false;
        displayQuestion();
    }

    function displayQuestion() {
        answered = false;
        const question = questions[currentQuestionIndex];
        
        equationDisplay.textContent = `\\( ${question.equation} \\)`;
        if (window.MathJax) {
            MathJax.typesetPromise([equationDisplay]).catch(err => console.error(err));
        }
        
        feedbackDisplay.textContent = '';
        feedbackDisplay.className = 'feedback';
        nextQuestionBtn.classList.add('hidden');
        answerButtons.forEach(btn => {
            btn.className = 'btn';
            btn.disabled = false;
        });
        
        scoreDisplay.textContent = `Рахунок: ${score} / ${currentQuestionIndex} | Запитання: ${currentQuestionIndex + 1} / ${TOTAL_QUESTIONS}`;
    }

    function handleAnswerClick(e) {
        if (answered || !e.target.matches('[data-answer]')) {
            return;
        }
        answered = true;

        const selectedAnswer = e.target.dataset.answer;
        const correctAnswer = questions[currentQuestionIndex].answer;

        answerButtons.forEach(btn => btn.disabled = true);
        
        if (selectedAnswer === correctAnswer) {
            score++;
            e.target.classList.add('correct');
            feedbackDisplay.textContent = 'Правильно!';
            feedbackDisplay.classList.add('correct');
        } else {
            e.target.classList.add('incorrect');
            const correctType = correctAnswer.charAt(0).toUpperCase() + correctAnswer.slice(1);
            feedbackDisplay.innerHTML = `Неправильно! Це <strong>${correctType}</strong>.`;
            feedbackDisplay.classList.add('incorrect');
            
            const correctButton = answerButtonsContainer.querySelector(`[data-answer="${correctAnswer}"]`);
            correctButton.classList.add('correct');
        }
        
        scoreDisplay.textContent = `Рахунок: ${score} / ${currentQuestionIndex + 1} | Запитання: ${currentQuestionIndex + 1} / ${TOTAL_QUESTIONS}`;
        
        if (currentQuestionIndex < TOTAL_QUESTIONS - 1) {
            nextQuestionBtn.textContent = 'Наступне питання →';
        } else {
            nextQuestionBtn.textContent = 'Завершити вікторину';
        }
        nextQuestionBtn.classList.remove('hidden');
    }

    function handleNextQuestion() {
        currentQuestionIndex++;
        if (currentQuestionIndex < TOTAL_QUESTIONS) {
            displayQuestion();
        } else {
            showResults();
        }
    }
    
    function showResults() {
        quizMain.classList.add('hidden');
        resultsOverlay.classList.remove('hidden');
        finalScoreDisplay.textContent = `${score} / ${TOTAL_QUESTIONS}`;

        const checkmark = resultsOverlay.querySelector('.checkmark');
        const dislikeContainer = document.getElementById('dislike-container');
        dislikeContainer.innerHTML = ''; 

        if (score >= TOTAL_QUESTIONS / 2) {
            resultsOverlay.className = 'quiz-overlay correct-final';
            checkmark.textContent = '✓';
            if (window.confetti) {
                confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
            }
        } else {
            resultsOverlay.className = 'quiz-overlay incorrect-final';
            checkmark.textContent = '✗';
            for (let i = 0; i < 30; i++) {
                createDislike();
            }
        }
    }

    function createDislike() {
        const dislike = document.createElement('div');
        dislike.classList.add('dislike');
        dislike.textContent = '👎';
        dislike.style.left = `${Math.random() * 100}%`;
        dislike.style.animationDuration = `${Math.random() * 3 + 2}s`;
        document.getElementById('dislike-container').appendChild(dislike);
    }
    
    // Event Listeners
    answerButtonsContainer.addEventListener('click', handleAnswerClick);
    nextQuestionBtn.addEventListener('click', handleNextQuestion);
    playAgainBtn.addEventListener('click', () => location.reload()); 

    // Start
    runLottery();

    // Ensure theme is applied from localStorage
    // This is a simple theme handler that might be in a separate file in a real project
    const theme = localStorage.getItem('conics_theme') || 'dark';
    document.body.classList.toggle('theme-light', theme === 'light');
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = theme === 'light';
        themeToggle.addEventListener('change', () => {
            const newTheme = themeToggle.checked ? 'light' : 'dark';
            document.body.classList.toggle('theme-light', newTheme === 'light');
            localStorage.setItem('conics_theme', newTheme);
        });
    }
});