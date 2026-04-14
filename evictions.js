document.addEventListener('DOMContentLoaded', () => {
    const addEvictionBtn = document.getElementById('add-eviction-btn');
    const evictionsList = document.getElementById('evictions-list');
    const detailPanel = document.getElementById('eviction-detail-panel');
    const closeDetailPanelBtn = document.getElementById('close-detail-panel');
    const evictionForm = document.getElementById('eviction-form');
    const deleteEvictionBtn = document.getElementById('delete-eviction-btn');
    const printNoticeBtn = document.getElementById('print-notice-btn');
    const evictionSearch = document.getElementById('eviction-search');

    let currentUserId;
    let currentEvictionId;

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            listenForEvictions(currentUserId);
            loadTenantsIntoSelect(currentUserId);
        }
    });

    // Initialize Select2 for tenant selection
    $('#eviction-tenant').select2({
        width: '100%'
    });

    addEvictionBtn.addEventListener('click', () => {
        currentEvictionId = null;
        evictionForm.reset();
        document.getElementById('detail-title').textContent = 'New Eviction Notice';
        printNoticeBtn.style.display = 'none';
        openPanel();
    });

    closeDetailPanelBtn.addEventListener('click', closePanel);
    evictionsList.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (row && row.dataset.id) {
            currentEvictionId = row.dataset.id;
            loadEvictionDetails(currentEvictionId);
            openPanel();
        }
    });

    evictionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const tenantSelect = document.getElementById('eviction-tenant');
        const selectedOption = tenantSelect.options[tenantSelect.selectedIndex];
        
        const data = {
            tenantId: tenantSelect.value,
            tenantName: selectedOption.text.split(' - ')[0],
            propertyAddress: selectedOption.dataset.propertyAddress,
            reason: document.getElementById('eviction-reason').value,
            noticeDate: document.getElementById('eviction-notice-date').value,
            terminationDate: document.getElementById('eviction-term-date').value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (currentEvictionId) {
            db.collection('users').doc(currentUserId).collection('evictions').doc(currentEvictionId).update(data)
                .then(() => console.log('Eviction updated'));
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            db.collection('users').doc(currentUserId).collection('evictions').add(data)
                .then(doc => {
                    currentEvictionId = doc.id;
                    printNoticeBtn.style.display = 'inline-block';
                });
        }
    });

    deleteEvictionBtn.addEventListener('click', () => {
        if (currentEvictionId && confirm('Remove this eviction record?')) {
            db.collection('users').doc(currentUserId).collection('evictions').doc(currentEvictionId).delete()
                .then(closePanel);
        }
    });

    printNoticeBtn.addEventListener('click', () => {
        if (currentEvictionId) {
            window.open(`eviction-print.html?id=${currentEvictionId}&company=${currentUserId}`, '_blank');
        }
    });

    if (evictionSearch) {
        evictionSearch.addEventListener('input', () => listenForEvictions(currentUserId));
    }

    function openPanel() {
        document.querySelector('.master-view').className = 'col-md-7 master-view';
        detailPanel.style.display = 'block';
    }

    function closePanel() {
        detailPanel.style.display = 'none';
        document.querySelector('.master-view').className = 'col-md-12 master-view';
    }

    function loadTenantsIntoSelect(userId) {
        db.collection('users').doc(userId).collection('tenants').orderBy('name').get().then(snapshot => {
            let html = '<option value="">Select tenant...</option>';
            snapshot.forEach(doc => {
                const t = doc.data();
                html += `<option value="${doc.id}" data-property-address="${t.propertyAddress}">${t.name} - ${t.propertyAddress}</option>`;
            });
            document.getElementById('eviction-tenant').innerHTML = html;
            $('#eviction-tenant').trigger('change'); // Notify Select2 of new options
        });
    }

    function loadEvictionDetails(id) {
        db.collection('users').doc(currentUserId).collection('evictions').doc(id).get().then(doc => {
            if (doc.exists) {
                const data = doc.data();
                document.getElementById('eviction-id').value = doc.id;
                document.getElementById('eviction-tenant').value = data.tenantId;
                $('#eviction-tenant').trigger('change'); // Update Select2 UI
                document.getElementById('eviction-reason').value = data.reason;
                document.getElementById('eviction-notice-date').value = data.noticeDate;
                document.getElementById('eviction-term-date').value = data.terminationDate;
                document.getElementById('detail-title').textContent = `Notice: ${data.tenantName}`;
                printNoticeBtn.style.display = 'inline-block';
            }
        });
    }

    function listenForEvictions(userId) {
        const searchTerm = evictionSearch?.value.toLowerCase() || '';
        db.collection('users').doc(userId).collection('evictions').orderBy('noticeDate', 'desc').onSnapshot(snapshot => {
            const emptyState = document.getElementById('empty-evictions-state');
            if (snapshot.empty) {
                evictionsList.innerHTML = '';
                emptyState.style.display = 'block';
                return;
            }
            emptyState.style.display = 'none';
            let html = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.tenantName.toLowerCase().includes(searchTerm) || data.propertyAddress.toLowerCase().includes(searchTerm)) {
                    html += `
                        <tr data-id="${doc.id}" style="cursor: pointer;">
                            <td>${data.tenantName}</td>
                            <td>${data.propertyAddress}</td>
                            <td>${new Date(data.noticeDate).toLocaleDateString()}</td>
                            <td>${new Date(data.terminationDate).toLocaleDateString()}</td>
                        </tr>
                    `;
                }
            });
            evictionsList.innerHTML = html;
            
            if (html === '' && searchTerm !== '') {
                evictionsList.innerHTML = '<tr><td colspan="4" class="text-center">No matching records.</td></tr>';
            }
        });
    }
});