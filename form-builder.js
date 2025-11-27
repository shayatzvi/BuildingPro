document.addEventListener('DOMContentLoaded', function() {
    const db = firebase.firestore();
    const addFieldBtn = document.getElementById('add-field-btn');
    const fieldsContainer = document.getElementById('fields-container');
    const formCreator = document.getElementById('form-creator');
    const formLinkSection = document.getElementById('form-link-section');
    const publicFormLink = document.getElementById('public-form-link');
    const copyLinkBtn = document.getElementById('copy-link-btn');

    let fieldCount = 0;

    // Function to add a new field to the builder UI
    const addField = () => {
        fieldCount++;
        const fieldId = `field-${fieldCount}`;
        const fieldHtml = `
            <div class="field-row" id="${fieldId}">
                <div class="form-group">
                    <label>Field Label</label>
                    <input type="text" class="form-control field-label" placeholder="e.g., Full Name" required>
                </div>
                <div class="field-options">
                    <div class="checkbox">
                        <label><input type="checkbox" class="field-required"> Required</label>
                    </div>
                    <div class="checkbox">
                        <label><input type="checkbox" class="field-public"> Display on public portal</label>
                    </div>
                    <button type="button" class="btn btn-danger btn-xs remove-field-btn" data-target="${fieldId}">Remove</button>
                </div>
            </div>
        `;
        fieldsContainer.insertAdjacentHTML('beforeend', fieldHtml);
    };

    // Add first field automatically
    addField();

    // Event listener for adding new fields
    addFieldBtn.addEventListener('click', addField);

    // Event listener for removing a field
    fieldsContainer.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('remove-field-btn')) {
            const targetId = e.target.getAttribute('data-target');
            document.getElementById(targetId).remove();
        }
    });

    // Handle form submission
    formCreator.addEventListener('submit', function(e) {
        e.preventDefault();

        const formTitle = document.getElementById('form-title').value;
        const formDescription = document.getElementById('form-description').value;
        const fields = [];

        document.querySelectorAll('.field-row').forEach(row => {
            const label = row.querySelector('.field-label').value;
            const isRequired = row.querySelector('.field-required').checked;
            const isPublic = row.querySelector('.field-public').checked;

            if (label) {
                fields.push({
                    label: label,
                    required: isRequired,
                    public: isPublic,
                    type: 'text' // For now, all fields are text
                });
            }
        });

        if (fields.length === 0) {
            alert('Please add at least one field to the form.');
            return;
        }

        // Save to Firestore
        db.collection('forms').add({
            title: formTitle,
            description: formDescription,
            fields: fields,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(docRef => {
            console.log("Form saved with ID: ", docRef.id);
            const link = `${window.location.origin}/public-form.html?id=${docRef.id}`;
            publicFormLink.href = link;
            publicFormLink.textContent = link;
            formLinkSection.style.display = 'block';
            window.scrollTo(0, 0); // Scroll to top to see the link
        }).catch(error => {
            console.error("Error adding document: ", error);
            alert('There was an error saving your form. Please try again.');
        });
    });

    // Copy link functionality
    copyLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(publicFormLink.href).then(() => alert('Link copied to clipboard!'));
    });
});
```

### 4. Create the Public Form Page

Finally, this `public-form.html` page is what your users will see. It will read a form ID from the URL, fetch the data from Firestore, and render the form accordingly.

```diff