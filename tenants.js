document.addEventListener('DOMContentLoaded', () => {
    const addTenantBtn = document.getElementById('add-tenant-btn');
    const tenantsList = document.getElementById('tenants-list');
    const detailPanel = document.getElementById('tenant-detail-panel');
    const closeDetailPanelBtn = document.getElementById('close-detail-panel');
    const tenantForm = document.getElementById('tenant-form');
    const deleteTenantBtn = document.getElementById('delete-tenant-btn');
    const tenantSearch = document.getElementById('tenant-search');

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

    if (tenantSearch) {
        tenantSearch.addEventListener('input', () => listenForTenants(currentUserId));
    }

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
        const propertyAddress = propertyId ? document.getElementById('tenant-property').options[document.getElementById('tenant-property').selectedIndex].text : '';
        const leaseEndDate = document.getElementById('tenant-lease-end').value;
        const originalPropertyId = document.getElementById('tenant-property-id').value;

        const tenantData = { name, email, propertyId, propertyAddress, leaseEndDate };

        if (currentTenantId) { // Updating existing tenant
            let updatePromise = db.collection('users').doc(currentUserId).collection('tenants').doc(currentTenantId).update(tenantData);

            if (originalPropertyId && originalPropertyId !== propertyId) {
                updatePromise = updatePromise.then(() => Promise.all([
                    db.collection('users').doc(currentUserId).collection('properties').doc(originalPropertyId).get(),
                    propertyId ? db.collection('users').doc(currentUserId).collection('properties').doc(propertyId).get() : Promise.resolve(null)
                ])).then(([oldPropSnap, newPropSnap]) => {
                    const batch = db.batch();

                    if (oldPropSnap && oldPropSnap.exists) {
                        const oldProperty = oldPropSnap.data();
                        const oldCount = Math.max(0, (Number(oldProperty.tenantCount) || 1) - 1);
                        batch.update(oldPropSnap.ref, {
                            tenantCount: oldCount,
                            status: computePropertyStatus({ ...oldProperty, tenantCount: oldCount })
                        });
                    }

                    if (newPropSnap && newPropSnap.exists) {
                        const newProperty = newPropSnap.data();
                        const newCount = (Number(newProperty.tenantCount) || 0) + 1;
                        batch.update(newPropSnap.ref, {
                            tenantCount: newCount,
                            status: computePropertyStatus({ ...newProperty, tenantCount: newCount })
                        });
                    }

                    return batch.commit();
                });
            } else if (!originalPropertyId && propertyId) {
                updatePromise = updatePromise.then(() => db.collection('users').doc(currentUserId).collection('properties').doc(propertyId).get())
                    .then(propertySnap => {
                        if (!propertySnap.exists) return;
                        const property = propertySnap.data();
                        const newCount = (Number(property.tenantCount) || 0) + 1;
                        return propertySnap.ref.update({
                            tenantCount: newCount,
                            status: computePropertyStatus({ ...property, tenantCount: newCount })
                        });
                    });
            }

            updatePromise
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
                .then(() => {
                    if (!propertyId) return null;
                    return db.collection('users').doc(currentUserId).collection('properties').doc(propertyId).get();
                })
                .then(propertySnap => {
                    if (!propertySnap || !propertySnap.exists) return null;
                    const property = propertySnap.data();
                    const updatedCount = (Number(property.tenantCount) || 0) + 1;
                    return propertySnap.ref.update({
                        tenantCount: updatedCount,
                        status: computePropertyStatus({ ...property, tenantCount: updatedCount })
                    });
                })
                .then(() => {
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
        if (confirm('Are you sure you want to remove this tenant? This will update the assigned property occupancy.')) {
            const tenantRef = db.collection('users').doc(currentUserId).collection('tenants').doc(currentTenantId);

            if (propertyId) {
                const propertyRef = db.collection('users').doc(currentUserId).collection('properties').doc(propertyId);
                propertyRef.get().then(propertySnap => {
                    const batch = db.batch();
                    batch.delete(tenantRef);

                    if (propertySnap.exists) {
                        const property = propertySnap.data();
                        const updatedCount = Math.max(0, (Number(property.tenantCount) || 1) - 1);
                        batch.update(propertyRef, {
                            tenantCount: updatedCount,
                            status: computePropertyStatus({ ...property, tenantCount: updatedCount })
                        });
                    }

                    return batch.commit();
                }).then(() => {
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
    db.collection('users').doc(userId).collection('properties').get().then(snapshot => {
        let optionsHtml = '<option value="">NOT CURRENTLY IN</option>';
        snapshot.forEach(doc => {
            const property = doc.data();
            const tenantCount = Number(property.tenantCount) || 0;
            const beds = Number(property.beds) || 1;
            const allowMultipleTenants = !!property.allowMultipleTenants;
            const available = doc.id === currentPropertyId || (tenantCount < beds && (allowMultipleTenants || tenantCount === 0));
            const status = available && tenantCount > 0 ? (allowMultipleTenants ? (tenantCount >= beds ? 'Occupied' : 'Partially Occupied') : 'Occupied') : 'Vacant';

            if (available) {
                const selected = doc.id === currentPropertyId ? 'selected' : '';
                optionsHtml += `<option value="${doc.id}" ${selected}>${property.address} (${tenantCount}/${beds} occupied, ${status})</option>`;
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

function computePropertyStatus(property) {
    const tenantCount = Number(property.tenantCount) || 0;
    const beds = Number(property.beds) || 1;
    const allowMultipleTenants = !!property.allowMultipleTenants;

    if (tenantCount === 0) return 'vacant';
    if (!allowMultipleTenants) return 'occupied';
    if (tenantCount >= beds) return 'occupied';
    return 'partially-occupied';
}

function listenForTenants(userId) {
    const tenantsList = document.getElementById('tenants-list');
    const emptyState = document.getElementById('empty-tenants-state');
    const searchTerm = document.getElementById('tenant-search')?.value.toLowerCase() || '';

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
            const matchesSearch = 
                t.name?.toLowerCase().includes(searchTerm) ||
                t.propertyAddress?.toLowerCase().includes(searchTerm);
            
            if (!matchesSearch) return;

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

        if (html === '' && searchTerm !== '') {
            tenantsList.innerHTML = '<tr><td colspan="3" class="text-center">No matching tenants found.</td></tr>';
        }
    }, error => {
        console.error("Error listening for tenants: ", error);
    });
}