document.addEventListener('DOMContentLoaded', function () {
    const db = firebase.firestore();
    const auth = firebase.auth();

    const formCreator = document.getElementById('form-creator');
    const fieldsContainer = document.getElementById('fields-container');
    const addFieldBtn = document.getElementById('add-field-btn');

    let user;
    let formId = new URLSearchParams(window.location.search).get('id');

    auth.onAuthStateChanged(firebaseUser => {
        if (firebaseUser) {
            user = firebaseUser;
            if (formId) {
                loadFormForEditing();
            } else {
                document.getElementById('builder-title').textContent = 'Create Form';
                createFieldElement(); // Start with one field
            }
        } else {
            window.location.href = 'index.html';
        }
    });

    function loadFormForEditing() {
        document.getElementById('builder-title').textContent = 'Edit Form';
        db.collection('forms').doc(formId).get().then(doc => {
            if (doc.exists && doc.data().createdBy === user.uid) {
                const form = doc.data();
                document.getElementById('form-title').value = form.title;
                document.getElementById('form-description').value = form.description;
                fieldsContainer.innerHTML = ''; // Clear default field
                form.fields.forEach(createFieldElement);
            } else {
                alert("Form not found or you don't have permission to edit it.");
                window.location.href = 'forms-list.html';
            }
        });
    }

    function createFieldElement(fieldData = {}) {
        const fieldRow = document.createElement('div');
        fieldRow.classList.add('field-row');

        fieldRow.innerHTML = `
            <button type="button" class="btn btn-xs btn-danger remove-field-btn">&times;</button>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label>Field Name</label>
                        <input type="text" class="form-control field-label" placeholder="e.g., Full Name" value="${fieldData.label || ''}" required>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="form-group">
                        <label>Field Type</label>
                        <select class="form-control field-type">
                            <option value="text" ${fieldData.type === 'text' ? 'selected' : ''}>Text</option>
                            <option value="email" ${fieldData.type === 'email' ? 'selected' : ''}>Email</option>
                            <option value="tel" ${fieldData.type === 'tel' ? 'selected' : ''}>Phone</option>
                            <option value="date" ${fieldData.type === 'date' ? 'selected' : ''}>Date</option>
                            <option value="textarea" ${fieldData.type === 'textarea' ? 'selected' : ''}>Text Area</option>
                        </select>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="form-group">
                        <label>&nbsp;</label>
                        <div class="checkbox"><label><input type="checkbox" class="field-required" ${fieldData.required ? 'checked' : ''}> Required</label></div>
                    </div>
                </div>
            </div>
        `;
        fieldsContainer.appendChild(fieldRow);
    }

    addFieldBtn.addEventListener('click', createFieldElement);

    fieldsContainer.addEventListener('click', (e) => {
        if (e.target.closest('.remove-field-btn')) {
            e.target.closest('.field-row').remove();
        }
    });

    formCreator.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formTitle = document.getElementById('form-title').value;
        const formDescription = document.getElementById('form-description').value;
        const fields = [];
        const fieldRows = fieldsContainer.querySelectorAll('.field-row');

        fieldRows.forEach(row => {
            const label = row.querySelector('.field-label').value;
            if (label) {
                fields.push({
                    label: label,
                    type: row.querySelector('.field-type').value,
                    required: row.querySelector('.field-required').checked
                });
            }
        });

        const formData = {
            title: formTitle,
            description: formDescription,
            fields: fields,
            createdBy: user.uid,
        };

        try {
            if (formId) {
                formData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('forms').doc(formId).update(formData);
                alert('Form updated successfully!');
            } else {
                formData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('forms').add(formData);
                alert('Form created successfully!');
            }
            window.location.href = 'forms-list.html';
        } catch (error) {
            console.error("Error saving form: ", error);
            alert("There was an error saving the form. Please try again.");
        }
    });
});