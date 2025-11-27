document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('tenant-login-form');
    const tenantDashboardContent = document.querySelector('.container'); // For dashboard page
    const loginError = document.getElementById('tenant-login-error');
    const companyIdField = document.getElementById('company-id');

    // Get company ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const companyId = urlParams.get('company');

    // --- Logic for Tenant Login Page (site.html) ---
    if (loginForm) {
        if (!companyId) {
            document.getElementById('public-announcements-list').innerHTML = '<div class="alert alert-danger">Configuration error: Company ID is missing from URL.</div>';
            loginForm.style.display = 'none';
            return;
        }
        companyIdField.value = companyId;
        loadPublicAnnouncements(companyId);

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            loginError.style.display = 'none';
            const email = document.getElementById('tenant-login-email').value;
            const billingId = document.getElementById('tenant-login-billing-id').value;

            if (!email || !billingId) {
                loginError.textContent = 'Please enter both your email and Billing ID.';
                loginError.style.display = 'block';
                return;
            }

            // Validate credentials against Firestore
            db.collection('users').doc(companyId).collection('tenants').doc(billingId).get()
                .then(doc => {
                    if (doc.exists && doc.data().email.toLowerCase() === email.toLowerCase()) {
                        // Credentials are valid. Store session info and redirect.
                        sessionStorage.setItem('tenantId', doc.id);
                        sessionStorage.setItem('companyId', companyId);
                        window.location.href = 'tenant-dashboard.html';
                    } else {
                        // Invalid credentials
                        loginError.textContent = 'Error: Invalid email or Billing ID.';
                        loginError.style.display = 'block';
                    }
                })
                .catch(err => {
                    console.error("Tenant Login Error:", err);
                    loginError.textContent = 'An unexpected error occurred. Please try again.';
                    loginError.style.display = 'block';
                });
        });
    }

    // --- Logic for Tenant Dashboard Page (tenant-dashboard.html) ---
    if (tenantDashboardContent && !loginForm) {
        const tenantId = sessionStorage.getItem('tenantId');
        const storedCompanyId = sessionStorage.getItem('companyId');

        if (!tenantId || !storedCompanyId) {
            // Not logged in, redirect to site selection or an error page
            alert('Your session has expired. Please log in again.');
            window.location.href = 'site.html'; // Redirect to a generic page
            return;
        }

        // Load tenant data
        db.collection('users').doc(storedCompanyId).collection('tenants').doc(tenantId).get().then(doc => {
            const maintenanceForm = document.getElementById('portal-maintenance-form');
            if (doc.exists) {
                const tenant = doc.data();
                document.getElementById('tenant-name').textContent = tenant.name;
                document.getElementById('tenant-email').textContent = tenant.email;
                document.getElementById('tenant-property-address').textContent = tenant.propertyAddress;
                document.getElementById('tenant-lease-end').textContent = tenant.leaseEndDate ? new Date(tenant.leaseEndDate).toLocaleDateString() : 'N/A';

                // Load related data
                loadTenantInvoices(storedCompanyId, tenantId);
                loadTenantMaintenance(storedCompanyId, tenant.propertyId);

                // Handle maintenance submission
                if (maintenanceForm) {
                    maintenanceForm.addEventListener('submit', (e) => {
                        e.preventDefault();
                        const issue = document.getElementById('portal-issue-description').value;
                        const priority = document.getElementById('portal-issue-priority').value;

                        const requestData = {
                            propertyId: tenant.propertyId,
                            propertyAddress: tenant.propertyAddress,
                            issue,
                            priority,
                            status: 'open',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        };

                        db.collection('users').doc(storedCompanyId).collection('maintenance').add(requestData)
                            .then(() => {
                                alert('Your maintenance request has been submitted successfully!');
                                maintenanceForm.reset();
                            }).catch(err => alert('Error submitting request: ' + err.message));
                    });
                }
            }
        });

        // Handle logout
        document.getElementById('tenant-logout-button').addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem('tenantId');
            sessionStorage.removeItem('companyId');
            window.location.href = `site.html?company=${storedCompanyId}`;
        });
    }
});

function loadPublicAnnouncements(companyId) {
    const listEl = document.getElementById('public-announcements-list');
    db.collection('users').doc(companyId).collection('announcements')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                listEl.innerHTML = '<div class="list-group-item"><p class="list-group-item-text">No announcements at this time.</p></div>';
                return;
            }
            let html = '';
            snapshot.forEach(doc => {
                const announcement = doc.data();
                html += `
                    <div class="list-group-item">
                        <h4 class="list-group-item-heading">${announcement.title}</h4>
                        <p class="list-group-item-text">${announcement.content}</p>
                    </div>`;
            });
            listEl.innerHTML = html;
        });
}

function loadTenantInvoices(companyId, tenantId) {
    const listEl = document.getElementById('tenant-invoices-list');
    db.collection('users').doc(companyId).collection('invoices')
        .where('tenantId', '==', tenantId)
        .orderBy('dueDate', 'desc')
        .limit(10)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                listEl.innerHTML = '<li class="list-group-item">No invoices found.</li>';
                return;
            }
            let html = '';
            snapshot.forEach(doc => {
                const invoice = doc.data();
                const isOverdue = invoice.status === 'due' && invoice.dueDate.toDate() < new Date();
                const status = isOverdue ? 'overdue' : invoice.status;
                html += `
                    <li class="list-group-item">
                        <span class="status-tag pull-right" data-status="${status}">${status}</span>
                        Due ${invoice.dueDate.toDate().toLocaleDateString()} - <strong>$${invoice.totalAmount.toFixed(2)}</strong>
                    </li>
                `;
            });
            listEl.innerHTML = html;
        });
}

function loadTenantMaintenance(companyId, propertyId) {
    const listEl = document.getElementById('tenant-maintenance-list');
    if (!propertyId) {
        listEl.innerHTML = '<li class="list-group-item">Not assigned to a property.</li>';
        return;
    }
    db.collection('users').doc(companyId).collection('maintenance')
        .where('propertyId', '==', propertyId)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                listEl.innerHTML = '<li class="list-group-item">No maintenance history found.</li>';
                return;
            }
            let html = '';
            snapshot.forEach(doc => {
                const request = doc.data();
                html += `
                    <li class="list-group-item">
                        <span class="status-tag pull-right" data-status="${request.status}">${request.status}</span>
                        ${request.issue} <small class="text-muted">- Submitted on ${request.createdAt.toDate().toLocaleDateString()}</small>
                    </li>
                `;
            });
            listEl.innerHTML = html;
        });
}