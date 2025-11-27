document.addEventListener('DOMContentLoaded', function() {
    const db = firebase.firestore();
    const auth = firebase.auth();
    const formsList = document.getElementById('forms-list');
    const emptyState = document.getElementById('empty-forms-state');

    let user;

    auth.onAuthStateChanged(firebaseUser => {
        if (firebaseUser) {
            user = firebaseUser;
            loadForms();
        } else {
            window.location.href = 'index.html';
        }
    });

    function loadForms() {
        db.collection('forms').where('createdBy', '==', user.uid).orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            if (snapshot.empty) {
                emptyState.style.display = 'block';
                formsList.innerHTML = '';
                return;
            }
            emptyState.style.display = 'none';
            let html = '';
            snapshot.forEach(doc => {
                const form = doc.data();
                const formId = doc.id;
                html += `
                    <tr data-id="${formId}">
                        <td>${form.title}</td>
                        <td>${form.description || 'No description'}</td>
                        <td>${form.createdAt.toDate().toLocaleDateString()}</td>
                        <td class="form-actions">
                            <a href="form-submissions.html?id=${formId}" class="btn btn-sm btn-info">Submissions</a>
                            <a href="form-builder.html?id=${formId}" class="btn btn-sm btn-default">Edit</a>
                            <a href="public-form.html?id=${formId}" target="_blank" class="btn btn-sm btn-default">View Public</a>
                            <button class="btn btn-sm btn-danger delete-btn">Delete</button>
                        </td>
                    </tr>
                `;
            });
            formsList.innerHTML = html;
        });
    }

    formsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const row = e.target.closest('tr');
            const formId = row.dataset.id;
            const formTitle = row.cells[0].textContent;

            if (confirm(`Are you sure you want to delete the form "${formTitle}"? This cannot be undone.`)) {
                db.collection('forms').doc(formId).delete()
                    .then(() => {
                        console.log('Form deleted successfully');
                    })
                    .catch(err => {
                        console.error('Error deleting form:', err);
                        alert('Error deleting form.');
                    });
            }
        }
    });
});