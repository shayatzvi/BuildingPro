document.addEventListener('DOMContentLoaded', () => {
    const addInvoiceBtn = document.getElementById('add-invoice-btn');
    const invoicesList = document.getElementById('invoices-list');
    const invoiceTenantSelect = document.getElementById('invoice-tenant');
    const invoiceSearch = document.getElementById('invoice-search');

    // Modal elements
    const invoiceForm = document.getElementById('invoice-form');
    const addLineItemBtn = document.getElementById('add-line-item-btn');
    const lineItemsTable = document.getElementById('line-items-table');
    const invoiceTotalDisplay = document.getElementById('invoice-total');

    // This needs to be global so other functions can access it.
    window.currentUserId = null;

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            listenForInvoices(currentUserId);
        }
    });

    if (invoiceSearch) {
        invoiceSearch.addEventListener('input', () => listenForInvoices(currentUserId));
    }

    addInvoiceBtn.addEventListener('click', openInvoiceModal);
    invoiceForm.addEventListener('submit', handleCreateInvoice);
    addLineItemBtn.addEventListener('click', addLineItemRow);
    invoicesList.addEventListener('click', handleInvoiceActions);

    document.getElementById('use-alternate-address').addEventListener('change', (e) => {
        document.getElementById('alternate-address-field').style.display = e.target.checked ? 'block' : 'none';
    });

    // Initialize Select2 for tenant selection
    $('#invoice-tenant').select2({
        dropdownParent: $('#invoice-modal'),
        width: '100%'
    });

    $('#invoice-tenant').on('change', function() {
        const val = $(this).val();
        const customFields = document.getElementById('custom-client-fields');
        const alternateAddressGroup = document.getElementById('alternate-address-group');

        if (val === 'custom') {
            customFields.style.display = 'block';
            alternateAddressGroup.style.display = 'none';
        } else if (val) {
            customFields.style.display = 'none';
            alternateAddressGroup.style.display = 'block';
        } else {
            customFields.style.display = 'none';
            alternateAddressGroup.style.display = 'none';
        }
        // Reset alternate address fields when selection changes
        document.getElementById('use-alternate-address').checked = false;
        document.getElementById('alternate-address-field').style.display = 'none';
    });

    lineItemsTable.addEventListener('click', (e) => {
        if (e.target.classList.contains('button-icon')) { // Target the button itself
            e.target.closest('tr').remove();
            updateInvoiceTotal();
        }
    });

    lineItemsTable.addEventListener('input', (e) => {
        if (e.target.classList.contains('line-item-amount')) {
            updateInvoiceTotal();
        }
    });
});

function listenForInvoices(userId) {
    const invoicesList = document.getElementById('invoices-list');
    const emptyState = document.getElementById('empty-invoices-state');
    const searchTerm = document.getElementById('invoice-search')?.value.toLowerCase() || '';

    db.collection('users').doc(userId).collection('invoices')
      .orderBy('dueDate', 'desc')
      .onSnapshot(snapshot => {
        if (snapshot.empty) {
            invoicesList.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        let html = '';
        snapshot.forEach(doc => {
            const invoice = doc.data();
            const dueDate = invoice.dueDate.toDate();
            const isOverdue = invoice.status === 'due' && dueDate < new Date();
            const status = isOverdue ? 'overdue' : invoice.status;

            const matchesSearch = 
                invoice.tenantName?.toLowerCase().includes(searchTerm) ||
                invoice.propertyAddress?.toLowerCase().includes(searchTerm) ||
                status.toLowerCase().includes(searchTerm);

            if (!matchesSearch) return;

            html += `
                <tr data-id="${doc.id}">
                    <td>${invoice.tenantName}</td>
                    <td>${invoice.propertyAddress}</td>
                    <td>$${(invoice.totalAmount || 0).toLocaleString()}</td>
                    <td>${dueDate.toLocaleDateString()}</td>
                    <td><span class="status-tag" data-status="${status}">${status}</span></td>
                    <td style="white-space: nowrap;">
                        <button class="btn btn-sm btn-info view-btn">View</button>
                        ${status !== 'paid' ? `<button class="btn btn-sm btn-default edit-btn">Edit</button>` : ''}
                        ${status !== 'paid' ? `<button class="btn btn-sm btn-success mark-paid-btn">Mark Paid</button>` : '<button class="btn btn-sm btn-warning revert-unpaid-btn">Revert to Unpaid</button>'}
                        <button class="btn btn-sm btn-danger delete-invoice-btn">Delete</button>
                    </td>
                </tr>
            `;
        });
        invoicesList.innerHTML = html;

        if (html === '' && searchTerm !== '') {
            invoicesList.innerHTML = '<tr><td colspan="6" class="text-center">No matching invoices found.</td></tr>';
        } else if (html === '' && !snapshot.empty) {
             emptyState.style.display = 'block';
        }
      });
}

function handleInvoiceActions(e) {
    const row = e.target.closest('tr');
    // If a click happens but not on a row with an ID, do nothing.
    if (!row || !row.dataset.id) {
        return;
    }
    const invoiceId = row.dataset.id; // Correctly get the ID from the row.

    if (e.target.closest('.mark-paid-btn')) {
        if (confirm('Mark this invoice as paid?')) {
            db.collection('users').doc(auth.currentUser.uid).collection('invoices').doc(invoiceId).update({
                status: 'paid',
                paidAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                console.log('Invoice marked as paid.');
            }).catch(err => console.error('Error updating invoice:', err));
        }
    } else if (e.target.closest('.delete-invoice-btn')) {
        if (confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
            db.collection('users').doc(auth.currentUser.uid).collection('invoices').doc(invoiceId).delete()
                .then(() => {
                    console.log('Invoice deleted successfully.');
                })
                .catch(err => console.error('Error deleting invoice:', err));
        }
    } else if (e.target.closest('.revert-unpaid-btn')) {
        if (confirm('Are you sure you want to revert this invoice to UNPAID?')) {
            db.collection('users').doc(auth.currentUser.uid).collection('invoices').doc(invoiceId).update({
                status: 'due',
                paidAt: firebase.firestore.FieldValue.delete() // Remove the paidAt field
            }).then(() => {
                console.log('Invoice reverted to unpaid.');
            }).catch(err => console.error('Error reverting invoice:', err));
        }
    } else if (e.target.closest('.edit-btn')) {
        handleEditInvoice(invoiceId);
    } else if (e.target.closest('.view-btn')) {
        // Open the new printable invoice page in a new tab
        const url = `invoice-print.html?id=${invoiceId}&company=${currentUserId}`;
        window.open(url, '_blank');
    }
}

function openInvoiceModal() {
    document.getElementById('invoice-form').reset();
    document.getElementById('invoice-id').value = '';
    document.getElementById('line-items-table').innerHTML = ''; // Clear previous line items
    updateInvoiceTotal();
    document.getElementById('custom-client-fields').style.display = 'none';
    document.getElementById('alternate-address-group').style.display = 'none';

    $('#invoice-modal .modal-title').text('New Invoice');
    $('#invoice-modal button[type="submit"]').text('Create Invoice');

    loadTenantsIntoSelect(auth.currentUser.uid); // Load tenants for new invoice
    $('#invoice-modal').modal('show');
}

function closeInvoiceModal() {
    $('#invoice-modal').modal('hide');
}

function loadTenantsIntoSelect(userId) {
    return new Promise((resolve) => {
        const select = document.getElementById('invoice-tenant');
        db.collection('users').doc(userId).collection('tenants').orderBy('name').get().then(snapshot => {
            let html = '<option value="">Select a tenant...</option><option value="custom">--- Invoice a Custom Client ---</option>';
            snapshot.forEach(doc => {
                const tenant = doc.data();
                html += `<option value="${doc.id}" data-property-id="${tenant.propertyId}" data-property-address="${tenant.propertyAddress}">${tenant.name} - ${tenant.propertyAddress}</option>`;
            });
            select.innerHTML = html;
            $(select).trigger('change'); // Notify Select2 of new options
            resolve();
        });
    });
}

function handleCreateInvoice(e) {
    e.preventDefault();
    const editingId = document.getElementById('invoice-id').value;
    const tenantSelect = document.getElementById('invoice-tenant');
    const selectedOption = tenantSelect.options[tenantSelect.selectedIndex];

    let tenantId, tenantName, propertyId, propertyAddress;

    if (selectedOption.value === 'custom') {
        tenantId = 'custom';
        tenantName = document.getElementById('custom-client-name').value;
        propertyAddress = document.getElementById('custom-client-address').value.replace(/\n/g, '<br>'); // Store with line breaks
        propertyId = null;
    } else {
        tenantId = selectedOption.value;
        tenantName = selectedOption.text.split(' - ')[0];
        propertyId = selectedOption.dataset.propertyId; // Still link to the property for reporting

        const useAlternateAddress = document.getElementById('use-alternate-address').checked;
        if (useAlternateAddress) {
            propertyAddress = document.getElementById('alternate-address').value.replace(/\n/g, '<br>');
        } else {
            propertyAddress = selectedOption.dataset.propertyAddress;
        }
    }

    const dueDate = document.getElementById('invoice-due-date').value;

    const lineItems = [];
    let totalAmount = 0;
    const lineItemRows = document.querySelectorAll('#line-items-table tr');
    lineItemRows.forEach(row => {
        const description = row.querySelector('.line-item-description').value;
        const amount = parseFloat(row.querySelector('.line-item-amount').value);
        if (description && amount > 0) {
            lineItems.push({ description, amount });
            totalAmount += amount;
        }
    });

    if (lineItems.length === 0 || !tenantName) {
        alert('Please add at least one line item.');
        return;
    }

    const invoiceData = {
        tenantId,
        tenantName,
        propertyId,
        propertyAddress,
        totalAmount,
        lineItems,
        dueDate: firebase.firestore.Timestamp.fromDate(new Date(dueDate)),
        status: 'due'
    };

    if (editingId) {
        // Update existing invoice
        db.collection('users').doc(auth.currentUser.uid).collection('invoices').doc(editingId).update(invoiceData)
            .then(() => {
                console.log('Invoice updated.');
                closeInvoiceModal();
            })
            .catch(err => console.error('Error updating invoice:', err));
    } else {
        // Create new invoice
        invoiceData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        db.collection('users').doc(auth.currentUser.uid).collection('invoices').add(invoiceData)
            .then(() => {
                console.log('Invoice created.');
                closeInvoiceModal();
            })
            .catch(err => console.error('Error creating invoice:', err));
    }
}

function addLineItemRow() {
    const table = document.getElementById('line-items-table');
    const row = table.insertRow();
    row.innerHTML = `
        <td><input type="text" placeholder="Item description" class="line-item-description"></td>
        <td style="width: 120px;"><input type="number" value="0.00" step="0.01" class="line-item-amount form-control"></td>
        <td style="width: 50px; text-align: center;"><button type="button" class="btn btn-xs btn-danger button-icon" title="Remove Item">&times;</button></td>
    `;
    updateInvoiceTotal();
}

function updateInvoiceTotal() {
    const invoiceTotalDisplay = document.getElementById('invoice-total');
    let total = 0;
    const lineItemRows = document.querySelectorAll('#line-items-table tr');
    lineItemRows.forEach(row => {
        const amountInput = row.querySelector('.line-item-amount');
        if (amountInput) {
            const amount = parseFloat(amountInput.value) || 0;
            total += amount;
        }
    });

    invoiceTotalDisplay.textContent = `$${total.toFixed(2)}`;
}

function handleEditInvoice(invoiceId) {
    if (!invoiceId) return;

    db.collection('users').doc(currentUserId).collection('invoices').doc(invoiceId).get().then(doc => {
        if (doc.exists) {
            const invoice = doc.data();
            document.getElementById('invoice-form').reset();
            $('#invoice-modal .modal-title').text('Edit Invoice');
            $('#invoice-modal button[type="submit"]').text('Save Changes');

            // Populate form fields
            document.getElementById('invoice-id').value = doc.id;
            
            // Set date correctly for the date input using local date parts to avoid timezone shifts
            const dateObj = invoice.dueDate.toDate();
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            document.getElementById('invoice-due-date').value = `${year}-${month}-${day}`;
            
            loadTenantsIntoSelect(currentUserId).then(() => {
                const tenantSelect = document.getElementById('invoice-tenant');
                tenantSelect.value = invoice.tenantId;
                $(tenantSelect).trigger('change'); // Update Select2 UI

                // Restore UI state for custom/alternate address
                if (invoice.tenantId === 'custom') {
                    document.getElementById('custom-client-fields').style.display = 'block';
                    document.getElementById('custom-client-name').value = invoice.tenantName || '';
                    document.getElementById('custom-client-address').value = (invoice.propertyAddress || '').replace(/<br>/g, '\n');
                } else {
                    document.getElementById('alternate-address-group').style.display = 'block';
                    
                    // Check if it was an alternate address by comparing with the default property address stored in the dataset
                    const selectedOption = tenantSelect.options[tenantSelect.selectedIndex];
                    if (selectedOption && invoice.propertyAddress !== selectedOption.dataset.propertyAddress) {
                        document.getElementById('use-alternate-address').checked = true;
                        document.getElementById('alternate-address-field').style.display = 'block';
                        document.getElementById('alternate-address').value = (invoice.propertyAddress || '').replace(/<br>/g, '\n');
                    }
                }
            });

            // Populate line items
            const table = document.getElementById('line-items-table');
            table.innerHTML = ''; // Clear existing
            invoice.lineItems.forEach(item => {
                const row = table.insertRow();
                row.innerHTML = `
                    <td><input type="text" placeholder="Item description" class="line-item-description" value="${item.description}"></td>
                    <td style="width: 120px;"><input type="number" value="${item.amount.toFixed(2)}" step="0.01" class="line-item-amount form-control"></td>
                    <td style="width: 50px; text-align: center;"><button type="button" class="btn btn-xs btn-danger button-icon" title="Remove Item">&times;</button></td>
                `;
            });
            updateInvoiceTotal();

            $('#invoice-modal').modal('show');
        }
    });
}