document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signup-form');
    const signupError = document.getElementById('signup-error');

    // Redirect if already logged in
    auth.onAuthStateChanged(user => {
        if (user) {
            window.location.href = 'dashboard.html';
        }
    });

    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;

            auth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    // Signed up and signed in
                    window.location.href = 'dashboard.html';
                })
                .catch((error) => {
                    signupError.textContent = error.message;
                    console.error("Signup Error:", error);
                });
        });
    }
});