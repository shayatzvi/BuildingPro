document.addEventListener('DOMContentLoaded', () => {
    const formTitleEl = document.getElementById('form-title');
    // Initialize Firebase if it hasn't been already
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();
    const publicForm = document.getElementById('public-form');
    const successMessage = document.getElementById('success-message');

    // Get user and form IDs from URL
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user');
    const formId = urlParams.get('form');

    if (!userId || !formId) {
        formTitleEl.textContent = 'Error';
        publicForm.innerHTML = '<p class="text-danger">This form link is invalid or incomplete.</p>';
        return;
    }

    const formRef = db.collection('users').doc(userId).collection('forms').doc(formId);

    // Load form structure
    formRef.get().then(doc => {
        if (!doc.exists) {
            formTitleEl.textContent = 'Form Not Found';
            publicForm.innerHTML = '<p class="text-danger">The requested form does not exist.</p>';
            return;
        }

        const form = doc.data();
        formTitleEl.textContent = form.title;

        renderFormFields(form.fields, userId);
    }).catch(err => {
        console.error("Error loading form:", err);
        formTitleEl.textContent = 'Error';
        publicForm.innerHTML = '<p class="text-danger">Could not load the form.</p>';
    });

    async function renderFormFields(fields, ownerId) {
        let html = '';
        for (const field of fields) {
            const requiredAttr = field.required ? 'required' : '';
            const fieldId = `field-${field.label.replace(/\s+/g, '-')}`;
            html += '<div class="form-group">';
            html += `<label for="${fieldId}">${field.label} ${field.required ? '<span class="text-danger">*</span>' : ''}</label>`;

            switch (field.type) {
                case 'textarea':
                    html += `<textarea class="form-control" name="${field.label}" id="${fieldId}" ${requiredAttr}></textarea>`;
                    break;
                case 'select':
                    html += `<select class="form-control" name="${field.label}" id="${fieldId}" ${requiredAttr}>`;
                    html += '<option value="">-- Please Select --</option>';
                    field.options.forEach(opt => {
                        html += `<option value="${opt}">${opt}</option>`;
                    });
                    html += '</select>';
                    break;
                case 'radio':
                    field.options.forEach((opt, index) => {
                        const radioId = `${fieldId}-${index}`;
                        html += `<div class="radio"><label><input type="radio" name="${field.label}" id="${radioId}" value="${opt}" ${requiredAttr}> ${opt}</label></div>`;
                    });
                    break;
                case 'checkbox':
                    field.options.forEach((opt, index) => {
                        const checkId = `${fieldId}-${index}`;
                        // For multiple checkboxes, give them unique names to capture all selections
                        html += `<div class="checkbox"><label><input type="checkbox" name="${field.label}[]" id="${checkId}" value="${opt}"> ${opt}</label></div>`;
                    });
                    break;
                case 'select-units':
                case 'multiselect-units':
                    const properties = await getProperties(ownerId);
                    if (field.type === 'select-units') {
                        html += `<select class="form-control" name="${field.label}" id="${fieldId}" ${requiredAttr}>`;
                        html += '<option value="">-- Please Select a Unit --</option>';
                        properties.forEach(prop => {
                            html += `<option value="${prop.address}">${prop.address}</option>`;
                        });
                        html += '</select>';
                    } else { // multiselect-units
                        properties.forEach((prop, index) => {
                            const checkId = `${fieldId}-${index}`;
                            html += `<div class="checkbox"><label><input type="checkbox" name="${field.label}[]" id="${checkId}" value="${prop.address}"> ${prop.address}</label></div>`;
                        });
                    }
                    break;
                default: // text, email, tel, date, etc.
                    html += `<input type="${field.type}" class="form-control" name="${field.label}" id="${fieldId}" ${requiredAttr}>`;
                    break;
            }
            html += '</div>';
        }
        html += '<button type="submit" class="btn btn-primary">Submit</button>';
        publicForm.innerHTML = html;
    }

    async function getProperties(ownerId) {
        const properties = [];
        try {
            const snapshot = await db.collection('users').doc(ownerId).collection('properties').orderBy('address').get();
            snapshot.forEach(doc => {
                properties.push({ id: doc.id, ...doc.data() });
            });
        } catch (error) {
            console.error("Error fetching properties for form:", error);
        }
        return properties;
    }

    // Handle form submission
    publicForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const formData = new FormData(publicForm);
        const submissionData = {};
        // Use getAll for multi-select fields (like checkboxes)
        for (const key of formData.keys()) {
            const values = formData.getAll(key);
            submissionData[key.replace('[]', '')] = values.length > 1 ? values.join(', ') : values[0];
        }

        // Use a transaction to increment the submission count safely
        db.runTransaction(transaction => {
            return transaction.get(formRef).then(formDoc => {
                if (!formDoc.exists) {
                    throw "Form does not exist!";
                }

                // Increment submission count
                const newCount = (formDoc.data().submissionCount || 0) + 1;
                transaction.update(formRef, { submissionCount: newCount });

                // Create new submission document
                const submissionRef = formRef.collection('submissions').doc();
                transaction.set(submissionRef, {
                    data: submissionData,
                    submittedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
        }).then(() => {
            console.log("Submission successful!");
            publicForm.style.display = 'none';
            successMessage.style.display = 'block';
        }).catch(error => {
            console.error("Transaction failed: ", error);
            alert('There was an error submitting your form. Please try again.');
        });
    });
});