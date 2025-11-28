document.addEventListener('DOMContentLoaded', () => {
    const addTenantBtn = document.getElementById('add-tenant-btn');
    const tenantsList = document.getElementById('tenants-list');
    const detailPanel = document.getElementById('tenant-detail-panel');
    const closeDetailPanelBtn = document.getElementById('close-detail-panel');
    const tenantForm = document.getElementById('tenant-form');
    const deleteTenantBtn = document.getElementById('delete-tenant-btn');

    let currentUserId;
    let currentTenantId;

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            listenForTenants(currentUserId);
        }
    });

    addTenantBtn.addEventListener('click', handleAddNew);
    closeDetailPanelBtn.addEventListener('click', closePanel);
    tenantsList.addEventListener('click', handleRowClick);
    tenantForm.addEventListener('submit', handleFormSubmit);
    deleteTenantBtn.addEventListener('click', handleDelete);

    function handleAddNew() {
        currentTenantId = null;
        tenantForm.reset();
        document.getElementById('detail-tenant-name').textContent = 'New Tenant';
        document.getElementById('billing-id-group').style.display = 'block';
        document.getElementById('tenant-billing-id').textContent = '(Will be generated upon saving)';
        loadVacantProperties(currentUserId, null); // Load only vacant properties for new tenant
        openPanel();
    }

    function handleRowClick(e) {
        const row = e.target.closest('tr');
        if (row && row.dataset.id) {
            currentTenantId = row.dataset.id;
            loadTenantDetails(currentTenantId);
            openPanel();
        }
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('tenant-name').value;
        const email = document.getElementById('tenant-email').value;
        const propertyId = document.getElementById('tenant-property').value;
        const propertyAddress = document.getElementById('tenant-property').options[document.getElementById('tenant-property').selectedIndex].text;
        const leaseEndDate = document.getElementById('tenant-lease-end').value;
        const originalPropertyId = document.getElementById('tenant-property-id').value;

        const tenantData = { name, email, propertyId, propertyAddress, leaseEndDate };

        if (currentTenantId) { // Updating existing tenant
            const tenantUpdate = db.collection('users').doc(currentUserId).collection('tenants').doc(currentTenantId).update(tenantData)
                .then(() => {
                    // If property changed, update statuses
                    if (originalPropertyId && originalPropertyId !== propertyId) {
                        const batch = db.batch();
                        const oldPropRef = db.collection('users').doc(currentUserId).collection('properties').doc(originalPropertyId);
                        batch.update(oldPropRef, { status: 'vacant' });
                        const newPropRef = db.collection('users').doc(currentUserId).collection('properties').doc(propertyId);
                        batch.update(newPropRef, { status: 'occupied' });
                        return batch.commit();
                    }
                })
                .then(() => {
                    console.log('Tenant Updated');
                    closePanel();
                })
                .catch(err => console.error(err));
        } else { // Creating new tenant
            tenantData.createdAt = firebase.firestore.FieldValue.serverTimestamp();

            // Generate a random 7-digit numeric ID
            const newBillingId = Math.floor(1000000 + Math.random() * 9000000).toString();

            db.collection('users').doc(currentUserId).collection('tenants').doc(newBillingId).set(tenantData)
                .then(docRef => {
                    // Update the property to be occupied
                    db.collection('users').doc(currentUserId).collection('properties').doc(propertyId).update({ status: 'occupied' });
                    
                    console.log('Tenant Added with ID:', newBillingId);
                    alert(`Tenant "${name}" created.\nTheir Billing ID is: ${newBillingId}`);
                    closePanel();
                })
                .catch(err => console.error(err));
        }
    }

    function handleDelete() {
        if (!currentTenantId) return;
        const propertyId = document.getElementById('tenant-property-id').value;
        if (confirm('Are you sure you want to remove this tenant? This will set their assigned property to "vacant".')) {
            const tenantRef = db.collection('users').doc(currentUserId).collection('tenants').doc(currentTenantId);

            if (propertyId) {
                // Tenant is assigned to a property, update property status in a batch
                const propertyRef = db.collection('users').doc(currentUserId).collection('properties').doc(propertyId);
                const batch = db.batch();
                batch.delete(tenantRef);
                batch.update(propertyRef, { status: 'vacant' });
                batch.commit().then(() => {
                    console.log('Tenant removed and property updated.');
                    closePanel();
                }).catch(err => console.error('Error removing tenant and updating property:', err));
            } else {
                // Tenant is not assigned to a property, just delete the tenant
                tenantRef.delete().then(() => {
                    console.log('Tenant removed.');
                    closePanel();
                }).catch(err => console.error('Error removing tenant:', err));
            }
        }
    }

    function openPanel() {
        document.querySelector('.master-view').className = 'col-md-7 master-view';
        detailPanel.style.display = 'block';
    }

    function closePanel() {
        detailPanel.style.display = 'none';
        currentTenantId = null;
        document.querySelector('.master-view').className = 'col-md-12 master-view';
    }

    function loadTenantDetails(id) {
        db.collection('users').doc(currentUserId).collection('tenants').doc(id).onSnapshot(doc => {
            if (doc.exists) {
                const tenant = doc.data();
                document.getElementById('detail-tenant-name').textContent = tenant.name;
                document.getElementById('tenant-id').value = doc.id;
                document.getElementById('tenant-property-id').value = tenant.propertyId;
                document.getElementById('tenant-name').value = tenant.name;
                document.getElementById('tenant-email').value = tenant.email;
                document.getElementById('tenant-lease-end').value = tenant.leaseEndDate || '';
                document.getElementById('billing-id-group').style.display = 'block';
                document.getElementById('tenant-billing-id').textContent = doc.id;
                // Load properties, including the currently assigned one
                loadVacantProperties(currentUserId, tenant.propertyId);
                loadTenantMaintenanceHistory(currentUserId, tenant.propertyId);
            }
        });
    }
});

function loadVacantProperties(userId, currentPropertyId) {
    const propertySelect = document.getElementById('tenant-property');
    // Get all properties to populate dropdown
    db.collection('users').doc(userId).collection('properties').get().then(snapshot => {
        let optionsHtml = '<option value="">NOT CURRENTLY IN</option>';
        snapshot.forEach(doc => {
            const property = doc.data();
            // A property is available if it's vacant OR it's the one currently assigned to this tenant
            if (property.status === 'vacant' || doc.id === currentPropertyId) {
                const selected = doc.id === currentPropertyId ? 'selected' : '';
                optionsHtml += `<option value="${doc.id}" ${selected}>${property.address}</option>`;
            }
        });
        propertySelect.innerHTML = optionsHtml;
    });
}

function loadTenantMaintenanceHistory(userId, propertyId) {
    const historyEl = document.getElementById('tenant-maintenance-history');
    historyEl.innerHTML = '';
    if (!propertyId) return;

    db.collection('users').doc(userId).collection('maintenance')
      .where('propertyId', '==', propertyId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .onSnapshot(snapshot => {
          let html = '<h4>Recent Maintenance History</h4>';
          if (snapshot.empty) {
              html += '<p>No requests found for this property.</p>';
          } else {
              html += '<ul class="list-group">';
              snapshot.forEach(doc => {
                  const request = doc.data();
                  html += `<li class="list-group-item">${request.issue} - <span class="text-capitalize status-tag" data-status="${request.status}">${request.status}</span></li>`;
              });
              html += '</ul>';
          }
          historyEl.innerHTML = html;
      });
}

function listenForTenants(userId) {
    const tenantsList = document.getElementById('tenants-list');
    const emptyState = document.getElementById('empty-tenants-state');

    db.collection('users').doc(userId).collection('tenants')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        if (snapshot.empty) {
            tenantsList.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        let html = '';
        snapshot.forEach(doc => {
            const t = doc.data();
            const tr = `
                <tr data-id="${doc.id}" style="cursor: pointer;">
                    <td>${t.name}</td>
                    <td>${t.propertyAddress}</td>
                    <td class="text-capitalize">${t.leaseEndDate ? new Date(t.leaseEndDate).toLocaleDateString() : 'N/A'}</td>
                </tr>
            `;
            html += tr;
        });
        tenantsList.innerHTML = html;
    }, error => {
        console.error("Error listening for tenants: ", error);
    });
}