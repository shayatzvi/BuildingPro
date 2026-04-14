document.addEventListener('DOMContentLoaded', () => {
    const portalLinkInput = document.getElementById('tenant-portal-link');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const announcementForm = document.getElementById('announcement-form');
    const announcementsList = document.getElementById('announcements-list');
    const clearAnnouncementFormBtn = document.getElementById('clear-announcement-form');
    const companyProfileForm = document.getElementById('company-profile-form');
    const announcementSearch = document.getElementById('announcement-search');

    let currentUserId;
    let quill;

    // Initialize Quill editor
    quill = new Quill('#announcement-content', {
        theme: 'snow',
        modules: { toolbar: [['bold', 'italic'], [{ 'header': 2 }, { 'header': 3 }], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['link']] }
    });

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            const portalUrl = `${window.location.origin}/site.html?company=${user.uid}`;
            portalLinkInput.value = portalUrl;
            listenForAnnouncements(currentUserId);
            loadCompanyProfile(currentUserId);
        }
    });

    if (announcementSearch) {
        announcementSearch.addEventListener('input', () => listenForAnnouncements(currentUserId));
    }

    copyLinkBtn.addEventListener('click', () => {
        portalLinkInput.select();
        portalLinkInput.setSelectionRange(0, 99999); // For mobile devices

        try {
            document.execCommand('copy');
            copyLinkBtn.innerHTML = '<span class="glyphicon glyphicon-ok"></span> Copied!';
            setTimeout(() => {
                copyLinkBtn.innerHTML = '<span class="glyphicon glyphicon-copy"></span> Copy';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    });

    announcementForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('announcement-title').value;
        const content = quill.root.innerHTML;
        const id = document.getElementById('announcement-id').value;

        const data = {
            title,
            content,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (id) {
            // Update existing
            db.collection('users').doc(currentUserId).collection('announcements').doc(id).update(data)
                .then(() => resetAnnouncementForm())
                .catch(err => console.error("Error updating announcement:", err));
        } else {
            // Create new
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            db.collection('users').doc(currentUserId).collection('announcements').add(data)
                .then(() => resetAnnouncementForm())
                .catch(err => console.error("Error adding announcement:", err));
        }
    });

    announcementsList.addEventListener('click', (e) => {
        const target = e.target;
        const announcementId = target.closest('.list-group-item')?.dataset.id;

        if (target.classList.contains('edit-btn')) {
            db.collection('users').doc(currentUserId).collection('announcements').doc(announcementId).get().then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    document.getElementById('announcement-id').value = doc.id;
                    document.getElementById('announcement-title').value = data.title;
                    quill.root.innerHTML = data.content;
                    clearAnnouncementFormBtn.style.display = 'inline-block';
                }
            });
        }

        if (target.classList.contains('delete-btn')) {
            if (confirm('Are you sure you want to delete this announcement?')) {
                db.collection('users').doc(currentUserId).collection('announcements').doc(announcementId).delete();
            }
        }
    });
    
    clearAnnouncementFormBtn.addEventListener('click', resetAnnouncementForm);

    companyProfileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const companyName = document.getElementById('company-name').value;
        const companyAddress = document.getElementById('company-address').value;

        db.collection('users').doc(currentUserId).collection('profile').doc('info').set({
            companyName,
            companyAddress
        }, { merge: true }).then(() => {
            alert('Company profile saved!');
        }).catch(err => console.error("Error saving profile:", err));
    });

    function resetAnnouncementForm() {
        announcementForm.reset();
        quill.setText('');
        document.getElementById('announcement-id').value = '';
        clearAnnouncementFormBtn.style.display = 'none';
    }

    function listenForAnnouncements(userId) {
        const searchTerm = document.getElementById('announcement-search')?.value.toLowerCase() || '';
        db.collection('users').doc(userId).collection('announcements').orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                let html = '';
                if (snapshot.empty) {
                    announcementsList.innerHTML = '<div class="list-group-item"><p class="list-group-item-text">No announcements posted yet.</p></div>';
                    return;
                }
                snapshot.forEach(doc => {
                    const announcement = doc.data();
                    const matchesSearch = 
                        announcement.title?.toLowerCase().includes(searchTerm) ||
                        announcement.content?.toLowerCase().includes(searchTerm);
                    
                    if (!matchesSearch) return;

                    html += `
                        <div class="list-group-item" data-id="${doc.id}">
                            <div class="pull-right">
                                <button class="btn btn-xs btn-default edit-btn">Edit</button>
                                <button class="btn btn-xs btn-danger delete-btn">Delete</button>
                            </div>
                            <h4 class="list-group-item-heading">${announcement.title}</h4>
                            <div class="list-group-item-text">${announcement.content}</div>
                        </div>
                    `;
                });
                announcementsList.innerHTML = html;

                if (html === '' && searchTerm !== '') {
                    announcementsList.innerHTML = '<div class="list-group-item"><p class="list-group-item-text">No matching announcements found.</p></div>';
                }
            });
    }

    function loadCompanyProfile(userId) {
        db.collection('users').doc(userId).collection('profile').doc('info').get().then(doc => {
            if (doc.exists) {
                const profile = doc.data();
                document.getElementById('company-name').value = profile.companyName || '';
                document.getElementById('company-address').value = profile.companyAddress || '';
            }
        });
    }
});