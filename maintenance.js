document.addEventListener('DOMContentLoaded', () => {
    const addRequestBtn = document.getElementById('add-request-btn');
    const requestsList = document.getElementById('requests-list');
    const detailPanel = document.getElementById('request-detail-panel');
    const closeDetailPanelBtn = document.getElementById('close-detail-panel');
    const requestForm = document.getElementById('request-form');
    const deleteRequestBtn = document.getElementById('delete-request-btn');
    const addNoteForm = document.getElementById('add-note-form');
    const addCostForm = document.getElementById('add-cost-form');

    let currentUserId;
    let currentRequestId;

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            listenForRequests(currentUserId);
        }
    });

    addRequestBtn.addEventListener('click', handleAddNew);
    closeDetailPanelBtn.addEventListener('click', closePanel);
    requestsList.addEventListener('click', handleRowClick);
    requestForm.addEventListener('submit', handleFormSubmit);
    deleteRequestBtn.addEventListener('click', handleDelete);
    addNoteForm.addEventListener('submit', handleAddNote);
    addCostForm.addEventListener('submit', handleAddCost);

    function handleAddNew() {
        currentRequestId = null;
        requestForm.reset();
        document.getElementById('detail-request-issue').textContent = 'New Request';
        loadAllProperties(currentUserId);
        openPanel();
        document.getElementById('notes-section').style.display = 'none';
        document.getElementById('costs-section').style.display = 'none';

    }

    function handleRowClick(e) {
        const row = e.target.closest('tr');
        if (row && row.dataset.id) {
            currentRequestId = row.dataset.id;
            loadRequestDetails(currentRequestId);
            openPanel();
            document.getElementById('notes-section').style.display = 'block';
            document.getElementById('costs-section').style.display = 'block';
        }
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        const propertyId = document.getElementById('request-property').value;
        const propertyAddress = document.getElementById('request-property').options[document.getElementById('request-property').selectedIndex].text;
        const issue = document.getElementById('request-issue').value;
        const priority = document.getElementById('request-priority').value;
        const status = document.getElementById('request-status').value;

        const requestData = { propertyId, propertyAddress, issue, priority, status };

        if (currentRequestId) {
            db.collection('users').doc(currentUserId).collection('maintenance').doc(currentRequestId).update(requestData)
                .then(() => console.log('Request Updated'))
                .catch(err => console.error(err));
        } else {
            requestData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            db.collection('users').doc(currentUserId).collection('maintenance').add(requestData)
                .then(docRef => {
                    currentRequestId = docRef.id;
                    console.log('Request Added');
                })
                .catch(err => console.error(err));
        }
    }

    function handleDelete() {
        if (!currentRequestId) return;
        if (confirm('Are you sure you want to delete this maintenance request?')) {
            db.collection('users').doc(currentUserId).collection('maintenance').doc(currentRequestId).delete()
                .then(() => {
                    console.log('Request deleted.');
                    closePanel();
                })
                .catch(err => console.error(err));
        }
    }

    function handleAddNote(e) {
        e.preventDefault();
        if (!currentRequestId) return;

        const noteText = document.getElementById('note-text').value;
        if (!noteText) return;

        const newNote = {
            text: noteText,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        db.collection('users').doc(currentUserId).collection('maintenance').doc(currentRequestId).update({
            notes: firebase.firestore.FieldValue.arrayUnion(newNote)
        }).then(() => {
            console.log('Note added.');
            document.getElementById('add-note-form').reset();
        }).catch(err => console.error('Error adding note:', err));

    }

    function handleAddCost(e) {
        e.preventDefault();
        if (!currentRequestId) return;

        const description = document.getElementById('cost-description').value;
        const amount = parseFloat(document.getElementById('cost-amount').value);

        if (!description || !amount) return;

        const newCost = {
            description,
            amount,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        db.collection('users').doc(currentUserId).collection('maintenance').doc(currentRequestId).update({
            costs: firebase.firestore.FieldValue.arrayUnion(newCost)
        }).then(() => {
            addCostForm.reset();
        }).catch(err => console.error('Error adding cost:', err));
    }

    function openPanel() {
        document.querySelector('.master-view').className = 'col-md-7 master-view';
        detailPanel.style.display = 'block';
    }

    function closePanel() {
        detailPanel.style.display = 'none';
        currentRequestId = null;
        document.querySelector('.master-view').className = 'col-md-12 master-view';
    }

    function loadRequestDetails(id) {
        db.collection('users').doc(currentUserId).collection('maintenance').doc(id).onSnapshot(doc => {
            if (doc.exists) {
                const request = doc.data();
                document.getElementById('detail-request-issue').textContent = request.issue;
                document.getElementById('request-id').value = doc.id;
                document.getElementById('request-issue').value = request.issue;
                document.getElementById('request-priority').value = request.priority;
                document.getElementById('request-status').value = request.status;
                loadAllProperties(currentUserId, request.propertyId);
                loadNotes(request.notes);
                loadCosts(request.costs);
            }
        });
    }
});

function loadAllProperties(userId, currentPropertyId) {
    const propertySelect = document.getElementById('request-property');
    
    db.collection('users').doc(userId).collection('properties').orderBy('address', 'asc').get().then(snapshot => {
        let optionsHtml = '<option value="">Select a property...</option>';
        snapshot.forEach(doc => {
            const property = doc.data();
            const selected = doc.id === currentPropertyId ? 'selected' : '';
            optionsHtml += `<option value="${doc.id}" ${selected}>${property.address}</option>`;
        });
        propertySelect.innerHTML = optionsHtml;
    });
}

function loadNotes(notes) {
    const notesList = document.getElementById('notes-list');
    notesList.innerHTML = '';
    if (notes && notes.length > 0) {
        // Sort notes by date, newest first
        const sortedNotes = notes.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);

        sortedNotes.forEach(note => {
            const date = note.createdAt.toDate().toLocaleString();
            notesList.insertAdjacentHTML('afterbegin', `
                <div class="panel panel-default panel-body" style="margin-bottom: 10px;">
                    ${note.text}
                    <small class="text-muted pull-right">${date}</small>
                </div>
            `);
        });
    }
}

function loadCosts(costs) {
    const costsList = document.getElementById('costs-list');
    if (!costs || costs.length === 0) {
        costsList.innerHTML = '<tbody><tr><td colspan="2">No costs added yet.</td></tr></tbody>';
        return;
    }

    let totalCost = 0;
    let tableHtml = '<tbody>';
    costs.forEach(cost => {
        totalCost += cost.amount;
        tableHtml += `
            <tr>
                <td>${cost.description}</td>
                <td style="text-align: right;">$${cost.amount.toFixed(2)}</td>
            </tr>
        `;
    });

    tableHtml += `
        </tbody>
        <tfoot>
            <tr>
                <td style="text-align: right; font-weight: bold;">Total Cost</td>
                <td style="text-align: right; font-weight: bold;">$${totalCost.toFixed(2)}</td>
            </tr>
        </tfoot>
    `;
    costsList.innerHTML = tableHtml;
}

function listenForRequests(userId) {
    const requestsList = document.getElementById('requests-list');
    const emptyState = document.getElementById('empty-requests-state');

    db.collection('users').doc(userId).collection('maintenance').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            if (snapshot.empty) {
                requestsList.innerHTML = '';
                emptyState.style.display = 'block';
                return;
            }
            emptyState.style.display = 'none';
            let html = '';
            snapshot.forEach(doc => {
                const r = doc.data();
                html += `
                    <tr data-id="${doc.id}" style="cursor: pointer;">
                        <td>${r.propertyAddress}</td>
                        <td>${r.issue}</td>
                        <td><span class="status-tag text-capitalize" data-priority="${r.priority}">${r.priority}</span></td>
                        <td><span class="status-tag text-capitalize" data-status="${r.status}">${r.status}</span></td>
                    </tr>
                `;
            });
            requestsList.innerHTML = html;
      });
}