document.addEventListener('DOMContentLoaded', function () {
    const db = firebase.firestore();
    const auth = firebase.auth();
    const formsAccordion = document.getElementById('forms-accordion');

    let user;
    const formListeners = {}; // To hold our Firestore listeners
    
    auth.onAuthStateChanged(firebaseUser => {
        if (firebaseUser) {
            user = firebaseUser;
            loadUserForms();
        } else {
            window.location.href = 'index.html';
        }
    });

    function loadUserForms() {
        db.collection('forms').where('createdBy', '==', user.uid).orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            // Unsubscribe from all old listeners
            Object.values(formListeners).forEach(unsubscribe => unsubscribe());

            if (snapshot.empty) {
                formsAccordion.innerHTML = '<div class="well">You have not created any forms yet. <a href="form-builder.html">Create one now</a>.</div>';
                return;
            }

            let html = '';
            snapshot.forEach(doc => {
                const form = doc.data();
                const formId = doc.id;
                html += `
                    <div class="panel panel-default">
                        <div class="panel-heading">
                            <h4 class="panel-title">
                                <a data-toggle="collapse" data-parent="#forms-accordion" href="#collapse-${formId}" data-form-id="${formId}">
                                    ${form.title}
                                </a>
                            </h4>
                        </div>
                        <div id="collapse-${formId}" class="panel-collapse collapse">
                            <div class="panel-body">
                                <div class="submissions-list" id="submissions-${formId}">
                                    <p class="text-center">Loading submissions...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            formsAccordion.innerHTML = html;
        });
    }

    // Use jQuery for Bootstrap's collapse events
    $('#forms-accordion').on('show.bs.collapse', function (e) {
        const formId = e.target.querySelector('.submissions-list').id.replace('submissions-', '');
        
        // If we don't already have a listener for this form, create one.
        if (!formListeners[formId]) {
            const submissionsListEl = document.getElementById(`submissions-${formId}`);

            formListeners[formId] = db.collection('submissions').where('formId', '==', formId).orderBy('submittedAt', 'desc')
                .onSnapshot(snapshot => {
                    if (snapshot.empty) {
                        submissionsListEl.innerHTML = '<div class="well well-sm">No submissions yet for this form.</div>';
                        return;
                    }
                    let submissionsHtml = '';
                    snapshot.forEach(subDoc => {
                        const submission = subDoc.data();
                        let detailsHtml = Object.entries(submission.data)
                            .map(([key, value]) => `<p><strong>${key}:</strong> ${Array.isArray(value) ? value.join(', ') : value}</p>`)
                            .join('');
                        
                        submissionsHtml += `<div class="panel panel-info"><div class="panel-heading">Submission from ${submission.submittedAt.toDate().toLocaleString()}</div><div class="panel-body">${detailsHtml}</div></div>`;
                    });
                    submissionsListEl.innerHTML = submissionsHtml;
                });
        }
    });
});