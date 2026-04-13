document.addEventListener('DOMContentLoaded', () => {
    let occupancyChart = null;
    let rentChart = null;

    auth.onAuthStateChanged(user => {
        if (user) {
            fetchDashboardData(user.uid, { occupancyChart, rentChart });
        }
    });
});

function fetchDashboardData(userId, charts) {
    const totalPropertiesEl = document.getElementById('total-properties');
    const totalTenantsEl = document.getElementById('total-tenants');
    const occupancyRateEl = document.getElementById('occupancy-rate');
    const openRequestsList = document.getElementById('open-requests-list');
    const emptyRequestsState = document.getElementById('empty-requests-state');
    const overdueInvoicesList = document.getElementById('overdue-invoices-list');

    const occupancyChartCtx = document.getElementById('occupancy-chart').getContext('2d');
    const rentChartCtx = document.getElementById('rent-chart').getContext('2d');
    let totalBeds = 0;
    let occupiedBeds = 0;

    function refreshOccupancy() {
        const occupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;
        occupancyRateEl.textContent = `${occupancyRate.toFixed(0)}%`;

        updateChart(charts, 'occupancyChart', occupancyChartCtx, {
            type: 'doughnut',
            data: {
                labels: ['Occupied Beds', 'Vacant Beds'],
                datasets: [{
                    data: [occupiedBeds, Math.max(0, totalBeds - occupiedBeds)],
                    backgroundColor: ['#10b981', '#374151'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { display: false } }
            }
        });
    }

    // Listen for properties
    db.collection('users').doc(userId).collection('properties').onSnapshot(snapshot => {
        totalBeds = 0;
        snapshot.forEach(doc => {
            const property = doc.data();
            totalBeds += Number(property.beds) || 0;
        });

        totalPropertiesEl.textContent = snapshot.size.toString();
        refreshOccupancy();
    });

    // Listen for paid invoices to calculate total collected rent
    db.collection('users').doc(userId).collection('invoices')
      .where('status', '==', 'paid')
      .onSnapshot(snapshot => {
          let totalCollected = 0;
          snapshot.forEach(doc => {
              totalCollected += doc.data().totalAmount;
          });
          document.getElementById('total-rent').textContent = `$${totalCollected.toLocaleString()}`;

          // Update rent chart with new collected amount
          if (charts.rentChart) {
            charts.rentChart.data.datasets[0].data[0] = totalCollected;
            // Note: Potential rent is not recalculated here, but this keeps the collected portion accurate.
            charts.rentChart.update();
          }
      });

        updateChart(charts, 'rentChart', rentChartCtx, {
            type: 'bar',
            data: {
                labels: ['Rent'],
                datasets: [
                    {
                        label: 'Collected',
                        data: [0], // Will be updated by invoice listener
                        backgroundColor: '#10b981',
                        borderRadius: 4,
                    },
                    {
                        label: 'Potential',
                        data: [0], // This chart is now less relevant, can be improved later
                        backgroundColor: '#374151',
                        borderRadius: 4,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: { display: false, stacked: true },
                    y: { display: false, stacked: true }
                },
                plugins: { legend: { display: false } }
            }
        });

    // Listen for total tenants
    db.collection('users').doc(userId).collection('tenants').onSnapshot(snapshot => {
        totalTenantsEl.textContent = snapshot.size.toString();
        occupiedBeds = 0;
        snapshot.docs.forEach(doc => {
            const tenant = doc.data();
            if (tenant.propertyId) {
                occupiedBeds += 1;
            }
        });
        refreshOccupancy();
    });

    // Listen for open maintenance requests
    db.collection('users').doc(userId).collection('maintenance')
      .where('status', '==', 'open')
      .onSnapshot(snapshot => {
        if (snapshot.empty) {
            openRequestsList.innerHTML = '';
            emptyRequestsState.style.display = 'block';
            return;
        }

        emptyRequestsState.style.display = 'none';
        let html = '';
        snapshot.forEach(doc => {
            const request = doc.data();
            const tr = `
                <tr>
                    <td>${request.propertyAddress}</td>
                    <td>${request.issue}</td>
                </tr>
            `;
            html += tr;
        });
        openRequestsList.innerHTML = html;

    }, error => {
        console.error("Error fetching open requests: ", error);
        emptyRequestsState.style.display = 'block';
        emptyRequestsState.querySelector('p').textContent = 'Error loading requests.';
    });

    // Listen for overdue invoices
    db.collection('users').doc(userId).collection('invoices')
      .where('status', '==', 'due')
      .onSnapshot(snapshot => {
          let html = '';
          let hasOverdue = false;
          snapshot.forEach(doc => {
              const invoice = doc.data();
              if (invoice.dueDate.toDate() < new Date()) {
                  hasOverdue = true;
                  html += `
                    <tr>
                        <td>${invoice.tenantName}</td>
                        <td>$${invoice.totalAmount.toLocaleString()}</td>
                        <td>${invoice.dueDate.toDate().toLocaleDateString()}</td>
                    </tr>
                  `;
              }
          });
          overdueInvoicesList.innerHTML = html;
          if (!hasOverdue) overdueInvoicesList.innerHTML = '<tr><td colspan="3">No overdue invoices.</td></tr>';
      });
}

function updateChart(charts, chartName, ctx, config) {
    if (charts[chartName]) {
        charts[chartName].data = config.data;
        charts[chartName].update();
    } else {
        charts[chartName] = new Chart(ctx, config);
    }
}