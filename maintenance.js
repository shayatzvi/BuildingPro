document.addEventListener('DOMContentLoaded', () => {
    const addRequestBtn = document.getElementById('add-request-btn');
    const requestsList = document.getElementById('requests-list');
    const detailPanel = document.getElementById('request-detail-panel');
    const closeDetailPanelBtn = document.getElementById('close-detail-panel');
    const requestForm = document.getElementById('request-form');
    const deleteRequestBtn = document.getElementById('delete-request-btn');

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

    function handleAddNew() {
        currentRequestId = null;
        requestForm.reset();
        document.getElementById('detail-request-issue').textContent = 'New Request';
        loadAllProperties(currentUserId);
        openPanel();

    }

    function handleRowClick(e) {
        const row = e.target.closest('tr');
        if (row && row.dataset.id) {
            currentRequestId = row.dataset.id;
            loadRequestDetails(currentRequestId);
            openPanel();
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