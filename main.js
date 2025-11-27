document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logout-button');
    const userEmailSpan = document.getElementById('user-email');

    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in.
            if (userEmailSpan) {
                userEmailSpan.textContent = user.email;
            }
            // Set active navigation link
            setActiveNav();
        } else {
            // No user is signed in. Redirect to login page.
            window.location.href = 'index.html';
        }
    });

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            auth.signOut().then(() => {
                // Sign-out successful.
                console.log('User signed out');
                window.location.href = 'index.html';
            }).catch((error) => {
                console.error('Sign out error', error);
            });
        });
    }
});

function setActiveNav() {
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href');
        if (linkPage === currentPage) {
            link.parentElement.classList.add('active');
        } else {
            link.parentElement.classList.remove('active');
        }
    });
}