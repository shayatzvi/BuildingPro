document.addEventListener('DOMContentLoaded', () => {
    const tenantEmailSpan = document.getElementById('tenant-email');
    const tenantNameSpan = document.getElementById('tenant-name');
    const logoutButton = document.getElementById('tenant-logout-button');
    const maintenanceForm = document.getElementById('portal-maintenance-form');

    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in.
            tenantEmailSpan.textContent = user.email;
            fetchTenantData(user);
        } else {
            // No user is signed in. Redirect to login page.
            // Clear companyId so they have to re-enter via the proper link
            localStorage.removeItem('companyId');
            window.location.href = 'site.html';
        }
    });

    logoutButton.addEventListener('click', () => {
        auth.signOut().then(() => {
            localStorage.removeItem('companyId');
            console.log('Tenant signed out');
            window.location.href = 'site.html';
        }).catch((error) => {
            console.error('Sign out error', error);
        });
    });

    maintenanceForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const companyId = localStorage.getItem('companyId');
        const issue = document.getElementById('portal-issue-description').value;
        const priority = document.getElementById('portal-issue-priority').value;

        // We need property info, which we can get from the tenant document
        db.collection('users').doc(companyId).collection('tenants')
          .where('email', '==', auth.currentUser.email).limit(1).get()
          .then(snapshot => {
              if (snapshot.empty) {
                  throw new Error('Could not find tenant data to submit request.');
              }
              const tenant = snapshot.docs[0].data();
              const requestData = {
                  propertyId: tenant.propertyId,
                  propertyAddress: tenant.propertyAddress,
                  issue: `(Submitted by tenant) ${issue}`,
                  priority,
                  status: 'open',
                  createdAt: firebase.firestore.FieldValue.serverTimestamp()
              };

              return db.collection('users').doc(companyId).collection('maintenance').add(requestData);
          })
          .then(() => {
              alert('Your maintenance request has been submitted!');
              maintenanceForm.reset();
          })
          .catch(err => console.error('Error submitting maintenance request:', err));
    });
});

function fetchTenantData(tenantUser) {
    const companyId = localStorage.getItem('companyId');
    if (!companyId) {
        console.error('No company ID found!');
        auth.signOut();
        return;
    }

    // Find the tenant document using their email, under the company's data
    db.collection('users').doc(companyId).collection('tenants')
      .where('email', '==', tenantUser.email).limit(1).get()
      .then(snapshot => {
          if (snapshot.empty) {
              console.error('Tenant data not found for this user.');
              return;
          }
          const tenantDoc = snapshot.docs[0];
          const tenant = tenantDoc.data();

          document.getElementById('tenant-name').textContent = tenant.name;
          document.getElementById('tenant-property-address').textContent = tenant.propertyAddress;
          document.getElementById('tenant-lease-end').textContent = new Date(tenant.leaseEndDate).toLocaleDateString();

          // Load invoices
          loadTenantInvoices(companyId, tenantDoc.id);
      });
}

function loadTenantInvoices(companyId, tenantId) {
    const invoicesList = document.getElementById('tenant-invoices-list');
    const emptyState = document.getElementById('empty-tenant-invoices-state');

    db.collection('users').doc(companyId).collection('invoices')
      .where('tenantId', '==', tenantId)
      .orderBy('dueDate', 'desc')
      .onSnapshot(snapshot => {
          if (snapshot.empty) {
              emptyState.style.display = 'block';
              return;
          }
          emptyState.style.display = 'none';
          let html = '';
          snapshot.forEach(doc => {
              const invoice = doc.data();
              html += `<tr data-id="${doc.id}">
                  <td>$${invoice.amount.toLocaleString()}</td>
                  <td>${invoice.dueDate.toDate().toLocaleDateString()}</td>
                  <td><span class="status-tag" data-status="${invoice.status}">${invoice.status}</span></td>
              </tr>`;
          });
          invoicesList.innerHTML = html;
      });
}