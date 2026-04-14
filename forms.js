document.addEventListener('DOMContentLoaded', () => {
    const addFormBtn = document.getElementById('add-form-btn');
    const formsList = document.getElementById('forms-list');
    const detailPanel = document.getElementById('form-detail-panel');
    const closeDetailPanelBtn = document.getElementById('close-detail-panel');
    const formEditor = document.getElementById('form-editor');
    const deleteFormBtn = document.getElementById('delete-form-btn');
    const addFieldBtn = document.getElementById('add-field-btn');
    const fieldsContainer = document.getElementById('form-fields-container');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const formSearch = document.getElementById('form-search');

    let currentUserId;
    let currentFormId;

    auth.onAuthStateChanged(user => {
        // Initialize Firebase if it hasn't been already
        if (user) {
            currentUserId = user.uid;
            listenForForms(currentUserId);
        }
    });

    addFormBtn.addEventListener('click', handleAddNew);
    closeDetailPanelBtn.addEventListener('click', closePanel);
    formsList.addEventListener('click', handleRowClick);
    formEditor.addEventListener('submit', handleFormSubmit);
    deleteFormBtn.addEventListener('click', handleDelete);
    addFieldBtn.addEventListener('click', () => addFieldRow());
    fieldsContainer.addEventListener('click', handleFieldDelete);
    fieldsContainer.addEventListener('change', handleFieldTypeChange);
    copyLinkBtn.addEventListener('click', handleCopyLink);

    if (formSearch) {
        formSearch.addEventListener('input', () => listenForForms(currentUserId));
    }

    function handleAddNew() {
        currentFormId = null;
        formEditor.reset();
        fieldsContainer.innerHTML = '';
        document.getElementById('detail-form-title').textContent = 'New Form';
        document.getElementById('form-link-container').style.display = 'none';
        document.getElementById('submissions-container').innerHTML = '';
        // Switch to editor tab
        $('.nav-tabs a[href="#editor"]').tab('show');
        addFieldRow(); // Start with one empty field
        openPanel();
    }

    function handleRowClick(e) {
        const row = e.target.closest('tr');
        if (row && row.dataset.id) {
            currentFormId = row.dataset.id;
            loadFormDetails(currentFormId);
            loadFormSubmissions(currentFormId);
            openPanel();
        }
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        const title = document.getElementById('form-title').value;
        const fields = [];
        document.querySelectorAll('.form-field-row').forEach(row => {
            const label = row.querySelector('.field-label').value;
            const type = row.querySelector('.field-type').value;
            const optionsInput = row.querySelector('.field-options');
            const required = row.querySelector('.field-required').checked;
            if (label) { // Only save fields that have a label
                const fieldData = { label, type, required };
                if (optionsInput && optionsInput.value) {
                    // Store options as an array
                    fieldData.options = optionsInput.value.split(',').map(opt => opt.trim());
                }
                fields.push(fieldData);
            }
        });

        if (!title || fields.length === 0) {
            alert('Please provide a form title and at least one field.');
            return;
        }

        const formData = { title, fields };

        if (currentFormId) {
            db.collection('users').doc(currentUserId).collection('forms').doc(currentFormId).update(formData)
                .then(() => {
                    console.log('Form Updated');
                    alert('Form saved successfully!');
                })
                .catch(err => console.error(err));
        } else {
            formData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            formData.submissionCount = 0;
            db.collection('users').doc(currentUserId).collection('forms').add(formData)
                .then(docRef => {
                    currentFormId = docRef.id;
                    console.log('Form Added');
                    alert('Form created successfully!');
                    loadFormDetails(currentFormId); // Reload to show link
                })
                .catch(err => console.error(err));
        }
    }

    function handleDelete() {
        if (!currentFormId) return;
        if (confirm('Are you sure you want to delete this form and all its submissions? This cannot be undone.')) {
            db.collection('users').doc(currentUserId).collection('forms').doc(currentFormId).delete()
                .then(() => {
                    console.log('Form deleted.');
                    closePanel();
                })
                .catch(err => console.error(err));
        }
    }

    // Add a listener to the submissions container for delete buttons
    document.getElementById('submissions-container').addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-submission-btn');
        if (deleteBtn && currentFormId) {
            const submissionId = deleteBtn.dataset.submissionId;
            if (confirm('Are you sure you want to delete this submission?')) {
                const formRef = db.collection('users').doc(currentUserId).collection('forms').doc(currentFormId);
                const submissionRef = formRef.collection('submissions').doc(submissionId);

                // Use a transaction to delete the submission and decrement the count
                db.runTransaction(transaction => {
                    return transaction.get(formRef).then(formDoc => {
                        const newCount = (formDoc.data().submissionCount || 1) - 1;
                        transaction.update(formRef, { submissionCount: newCount < 0 ? 0 : newCount });
                        transaction.delete(submissionRef);
                    });
                }).then(() => {
                    console.log('Submission deleted successfully.');
                }).catch(err => console.error('Error deleting submission:', err));
            }
        }
    });

    function handleFieldDelete(e) {
        if (e.target.classList.contains('delete-field-btn')) {
            e.target.closest('.form-field-row').remove();
        }
    }

    function handleFieldTypeChange(e) {
        if (e.target.classList.contains('field-type')) {
            const row = e.target.closest('.form-field-row');
            const optionsContainer = row.querySelector('.field-options-container');
            const needsOptions = ['radio', 'checkbox', 'select'].includes(e.target.value);
            optionsContainer.style.display = needsOptions ? 'block' : 'none';
        }
    }

    function handleCopyLink() {
        const linkInput = document.getElementById('form-public-link');
        linkInput.select();
        document.execCommand('copy');
        alert('Link copied to clipboard!');
    }

    function openPanel() {
        document.querySelector('.master-view').className = 'col-md-7 master-view';
        detailPanel.style.display = 'block';
    }

    function closePanel() {
        detailPanel.style.display = 'none';
        currentFormId = null;
        document.querySelector('.master-view').className = 'col-md-12 master-view';
    }

    function loadFormDetails(id) {
        db.collection('users').doc(currentUserId).collection('forms').doc(id).onSnapshot(doc => {
            if (doc.exists) {
                const form = doc.data();
                document.getElementById('detail-form-title').textContent = form.title;
                document.getElementById('form-id').value = doc.id;
                document.getElementById('form-title').value = form.title;

                fieldsContainer.innerHTML = '';
                if (form.fields && form.fields.length > 0) {
                    form.fields.forEach(field => addFieldRow(field));
                } else {
                    addFieldRow();
                }

                // Show public link
                const link = `${window.location.origin}/form-viewer.html?user=${currentUserId}&form=${doc.id}`;
                document.getElementById('form-public-link').value = link;
                document.getElementById('form-link-container').style.display = 'block';
            }
        });
    }

    function addFieldRow(field = {}) {
        const { label = '', type = 'text', required = false, options = [] } = field;
        const checked = required ? 'checked' : '';
        const optionsString = options.join(', ');
        const needsOptions = ['radio', 'checkbox', 'select'].includes(type);

        const fieldHtml = `
            <div class="well well-sm" style="margin-bottom: 10px;">
                <div class="form-field-row">
                    <input type="text" class="form-control field-label" placeholder="Field Label" value="${label}">
                    <select class="form-control field-type" style="width: 150px;">
                        <option value="text" ${type === 'text' ? 'selected' : ''}>Text</option>
                        <option value="textarea" ${type === 'textarea' ? 'selected' : ''}>Paragraph</option>
                        <option value="email" ${type === 'email' ? 'selected' : ''}>Email</option>
                        <option value="tel" ${type === 'tel' ? 'selected' : ''}>Phone</option>
                        <option value="date" ${type === 'date' ? 'selected' : ''}>Date</option>
                        <option value="select" ${type === 'select' ? 'selected' : ''}>Dropdown</option>
                        <option value="checkbox" ${type === 'checkbox' ? 'selected' : ''}>Checkboxes</option>
                        <option value="radio" ${type === 'radio' ? 'selected' : ''}>Radio Buttons</option>
                        <option value="select-units" ${type === 'select-units' ? 'selected' : ''}>Units Dropdown</option>
                        <option value="multiselect-units" ${type === 'multiselect-units' ? 'selected' : ''}>Units Checkboxes</option>
                    </select>
                    <div class="checkbox" style="margin-left: 10px; white-space: nowrap;">
                        <label><input type="checkbox" class="field-required" ${checked}> Required</label>
                    </div>
                    <button type="button" class="btn btn-danger btn-xs delete-field-btn" style="margin-left: 10px;">&times;</button>
                </div>
                <div class="field-options-container" style="margin-top: 10px; display: ${needsOptions ? 'block' : 'none'};">
                    <input type="text" class="form-control field-options" placeholder="Comma-separated options, e.g. Option 1, Option 2" value="${optionsString}">
                </div>
            </div>
        `;
        fieldsContainer.insertAdjacentHTML('beforeend', fieldHtml);
    }

    function listenForForms(userId) {
        const emptyState = document.getElementById('empty-forms-state');
    const searchTerm = document.getElementById('form-search')?.value.toLowerCase() || '';

        db.collection('users').doc(userId).collection('forms').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            if (snapshot.empty) {
                formsList.innerHTML = '';
                emptyState.style.display = 'block';
                return;
            }
            emptyState.style.display = 'none';
            let html = '';
            snapshot.forEach(doc => {
                const form = doc.data();
            const matchesSearch = form.title?.toLowerCase().includes(searchTerm);
            
            if (!matchesSearch) return;

                html += `
                    <tr data-id="${doc.id}" style="cursor: pointer;">
                        <td>${form.title}</td>
                        <td>${form.submissionCount || 0}</td>
                        <td>${form.createdAt ? form.createdAt.toDate().toLocaleDateString() : 'N/A'}</td>
                    </tr>
                `;
            });
            formsList.innerHTML = html;

        if (html === '' && searchTerm !== '') {
            formsList.innerHTML = '<tr><td colspan="3" class="text-center">No matching forms found.</td></tr>';
        }
        });
    }

    function loadFormSubmissions(formId) {
        const container = document.getElementById('submissions-container');
        container.innerHTML = '<p>Loading submissions...</p>';

        // Listen for changes to the form itself (for headers)
        db.collection('users').doc(currentUserId).collection('forms').doc(formId).onSnapshot(formDoc => {
            if (!formDoc.exists) {
                container.innerHTML = '<p>Could not find form definition.</p>';
                return;
            }
            const form = formDoc.data();
            const headers = form.fields ? form.fields.map(f => f.label) : [];

            // Now, listen for submissions and build the table using the latest headers
            db.collection('users').doc(currentUserId).collection('forms').doc(formId).collection('submissions')
              .orderBy('submittedAt', 'desc').onSnapshot(submissionsSnapshot => {
                if (submissionsSnapshot.empty) {
                    container.innerHTML = '<div class="text-center" style="padding: 2rem;"><p>No submissions yet.</p></div>';
                    return;
                }

                let tableHtml = '<div class="table-responsive"><table class="table table-striped">';
                // Table Head
                tableHtml += '<thead><tr><th>Submitted At</th>';
                headers.forEach(header => {
                    tableHtml += `<th>${header}</th>`;
                });
                tableHtml += '<th>Actions</th></tr></thead>';

                // Table Body
                tableHtml += '<tbody>';
                submissionsSnapshot.forEach(subDoc => {
                    const submission = subDoc.data();
                    tableHtml += '<tr>';
                    tableHtml += `<td>${submission.submittedAt.toDate().toLocaleString()}</td>`;
                    headers.forEach(header => {
                        // Use submission.data[header] to get the value for each column
                        const rawValue = submission.data[header] || '';
                        // Basic sanitization to prevent HTML injection from submission data
                        const sanitizedValue = String(rawValue).replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        tableHtml += `<td>${sanitizedValue}</td>`;
                    });
                    // Add actions cell with delete button
                    tableHtml += `<td><button class="btn btn-xs btn-danger delete-submission-btn" data-submission-id="${subDoc.id}">&times;</button></td>`;
                    tableHtml += '</tr>';
                });
                tableHtml += '</tbody></table></div>';
                container.innerHTML = tableHtml;
            });
        }, err => {
            console.error("Error loading form definition:", err);
            container.innerHTML = '<p class="text-danger">Could not load submissions.</p>';
        });
    }
});