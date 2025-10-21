/* tasks.js
    - Handles logic for the tasks page.
    - Switches between different tasks.
    - Toggles the visibility of solutions.
*/
document.addEventListener('DOMContentLoaded', () => {
    const taskNavButtons = document.querySelectorAll('.task-nav-btn');
    const taskContents = document.querySelectorAll('.task-content');
    const toggleSolutionButtons = document.querySelectorAll('.toggle-solution-btn');

    // Handle switching between tasks
    taskNavButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTaskId = button.dataset.taskId;

            // Update active state for buttons
            taskNavButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Update active state for content
            taskContents.forEach(content => {
                if (content.id === targetTaskId) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });

    // Handle showing/hiding solutions
    toggleSolutionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const solutionPanel = button.nextElementSibling;
            if (solutionPanel && solutionPanel.classList.contains('solution-panel')) {
                solutionPanel.classList.toggle('hidden');
                
                // Change button text
                if (solutionPanel.classList.contains('hidden')) {
                    button.textContent = 'Показати розв\'язання';
                } else {
                    button.textContent = 'Сховати розв\'язання';
                }
            }
        });
    });

    // Ensure theme is applied from localStorage
    const theme = localStorage.getItem('conics_theme') || 'dark';
    document.body.classList.toggle('theme-light', theme === 'light');
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = theme === 'light';
    }
});