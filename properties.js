document.addEventListener('DOMContentLoaded', () => {
    // Page elements
    const addPropertyBtn = document.getElementById('add-property-btn');
    const propertiesList = document.getElementById('properties-list');
    const detailPanel = document.getElementById('property-detail-panel');
    const closeDetailPanelBtn = document.getElementById('close-detail-panel');
    const propertyForm = document.getElementById('property-form');
    const deletePropertyBtn = document.getElementById('delete-property-btn');

    let currentUserId;
    let currentPropertyId;
    
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            listenForProperties(currentUserId);
        }
    });

    // --- Event Listeners ---
    addPropertyBtn.addEventListener('click', handleAddNew);
    closeDetailPanelBtn.addEventListener('click', closePanel);
    propertiesList.addEventListener('click', handleRowClick);
    propertyForm.addEventListener('submit', handleFormSubmit);
    deletePropertyBtn.addEventListener('click', handleDelete);

    // --- Handlers ---
    function handleAddNew() {
        currentPropertyId = null;
        propertyForm.reset();
        document.getElementById('detail-property-address').textContent = 'New Property';
        clearRelatedData();
        openPanel();
    }

    function handleRowClick(e) {
        const row = e.target.closest('tr');
        if (row && row.dataset.id) {
            currentPropertyId = row.dataset.id;
            loadPropertyDetails(currentPropertyId);
            openPanel();
        }
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        const address = document.getElementById('property-address').value;
        const notes = document.getElementById('property-notes').value;
        const rent = document.getElementById('property-rent').value;
        const beds = document.getElementById('property-beds').value;
        const baths = document.getElementById('property-baths').value;

        const propertyData = { address, notes, rent, beds, baths };
        
        if (currentPropertyId) {
            // Update
            db.collection('users').doc(currentUserId).collection('properties').doc(currentPropertyId).update(propertyData)
                .then(() => console.log('Property Updated'))
                .catch(err => console.error(err));
        } else {
            // Create
            propertyData.status = 'vacant';
            propertyData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            db.collection('users').doc(currentUserId).collection('properties').add(propertyData)
                .then(docRef => {
                    currentPropertyId = docRef.id;
                    console.log('Property Added');
                    closePanel();
                })
                .catch(err => console.error(err));
        }
    }

    function handleDelete() {
        if (!currentPropertyId) return;
        if (confirm('Are you sure you want to delete this property? This action cannot be undone.')) {
            db.collection('users').doc(currentUserId).collection('properties').doc(currentPropertyId).delete()
                .then(() => {
                    console.log('Property deleted');
                    closePanel();
                })
                .catch(err => console.error(err));
        }
    }

    // --- UI Functions ---
    function openPanel() {
        document.querySelector('.master-view').className = 'col-md-7 master-view';
        detailPanel.style.display = 'block';
    }

    function closePanel() {
        detailPanel.style.display = 'none';
        currentPropertyId = null;
        document.querySelector('.master-view').className = 'col-md-12 master-view';
    }

    function clearRelatedData() {
        document.getElementById('property-tenant-info').innerHTML = '';
        document.getElementById('property-maintenance-requests').innerHTML = '';
        document.getElementById('property-financials').innerHTML = '';
        deletePropertyBtn.disabled = false;
    }

    function loadPropertyDetails(id) {
        db.collection('users').doc(currentUserId).collection('properties').doc(id).onSnapshot(doc => {
            if (doc.exists) {
                const property = doc.data();
                // Populate form
                document.getElementById('detail-property-address').textContent = property.address;
                document.getElementById('property-address').value = property.address;
                document.getElementById('property-notes').value = property.notes || '';
                document.getElementById('property-rent').value = property.rent || '';
                document.getElementById('property-beds').value = property.beds || '';
                document.getElementById('property-baths').value = property.baths || '';

                // Disable delete if occupied
                deletePropertyBtn.disabled = property.status === 'occupied';

                // Load related data
                loadRelatedTenant(id, property.status);
                loadRelatedMaintenance(id);
                loadPropertyFinancials(id);
            }
        });
    }
});

function loadRelatedTenant(propertyId, status) {
    const tenantInfoEl = document.getElementById('property-tenant-info');
    if (status === 'occupied') {
        db.collection('users').doc(auth.currentUser.uid).collection('tenants')
          .where('propertyId', '==', propertyId).limit(1).get()
          .then(snapshot => {
              if (!snapshot.empty) {
                  const tenant = snapshot.docs[0].data();
                  tenantInfoEl.innerHTML = `
                    <h4>Current Tenant</h4>
                    <p>${tenant.name}</p>
                  `;
              } else {
                tenantInfoEl.innerHTML = '';
              }
          });
    } else {
        tenantInfoEl.innerHTML = '<h4>Tenant</h4><p class="text-muted">This property is vacant.</p>';
    }
}

function loadRelatedMaintenance(propertyId) {
    const maintenanceListEl = document.getElementById('property-maintenance-requests');
    db.collection('users').doc(auth.currentUser.uid).collection('maintenance')
      .where('propertyId', '==', propertyId)
      .where('status', '!=', 'closed')
      .onSnapshot(snapshot => {
          let html = '<h4>Open Maintenance Requests</h4>';
          if (snapshot.empty) {
              html += '<p>None</p>';
          } else {
              html += '<ul class="list-group">';
              snapshot.forEach(doc => {
                  const request = doc.data();
                  html += `<li class="list-group-item">${request.issue} (<span class="text-capitalize">${request.priority}</span>)</li>`;
              });
              html += '</ul>';
          }
          maintenanceListEl.innerHTML = html;
      });
}

function loadPropertyFinancials(propertyId) {
    const financialsEl = document.getElementById('property-financials');
    financialsEl.innerHTML = '<h4>Financial Summary</h4><p>Calculating...</p>';

    db.collection('users').doc(auth.currentUser.uid).collection('invoices')
      .where('propertyId', '==', propertyId)
      .get()
      .then(snapshot => {
          let totalInvoiced = 0;
          let totalCollected = 0;

          snapshot.forEach(doc => {
              const invoice = doc.data();
              totalInvoiced += invoice.totalAmount;
              if (invoice.status === 'paid') {
                  totalCollected += invoice.totalAmount;
              }
          });

          financialsEl.innerHTML = `
            <h4>Financial Summary</h4>
            <div class="row">
                <div class="col-xs-6"><p><strong>Total Invoiced:</strong> $${totalInvoiced.toLocaleString()}</p></div>
                <div class="col-xs-6"><p><strong>Total Collected:</strong> $${totalCollected.toLocaleString()}</p></div>
            </div>
          `;
      });
}

function listenForProperties(userId) {
    const propertiesList = document.getElementById('properties-list');
    const emptyState = document.getElementById('empty-properties-state');

    db.collection('users').doc(userId).collection('properties')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
            if (snapshot.empty) {
                propertiesList.innerHTML = '';
                emptyState.style.display = 'block';
                return;
            }
            emptyState.style.display = 'none';
            let html = '';
            snapshot.forEach(doc => {
                const p = doc.data();
                html += `
                    <tr data-id="${doc.id}" style="cursor: pointer;">
                        <td>${p.address}</td>
                        <td>${p.beds || 'N/A'} beds / ${p.baths || 'N/A'} baths</td>
                        <td>$${p.rent ? Number(p.rent).toLocaleString() : '0.00'}</td>
                        <td><span class="status-tag" data-status="${p.status}">${p.status}</span></td>
                    </tr>
                `;
            });
            propertiesList.innerHTML = html;
      });
}