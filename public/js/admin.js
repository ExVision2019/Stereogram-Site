document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('uploadForm');
    const templateList = document.getElementById('templateList');

    function loadTemplates() {
        fetch('/api/templates')
            .then(response => response.json())
            .then(templates => {
                templateList.innerHTML = '';
                templates.forEach(template => {
                    const li = document.createElement('li');
                    li.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg';
                    li.innerHTML = `
                        <div class="flex items-center space-x-4">
                            <img src="/uploads/${template.filename}" alt="${template.name}" class="w-16 h-16 object-cover rounded">
                            <span class="font-medium">${template.name}</span>
                        </div>
                        <button class="deleteBtn bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition duration-200" data-id="${template.id}">Delete</button>
                    `;
                    templateList.appendChild(li);
                });

                // Add event listeners for delete buttons
                document.querySelectorAll('.deleteBtn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        deleteTemplate(this.dataset.id);
                    });
                });
            });
    }

    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData();
        formData.append('name', document.getElementById('templateName').value);
        formData.append('image', document.getElementById('templateImage').files[0]);

        fetch('/api/templates', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(result => {
            alert('Template uploaded successfully');
            loadTemplates();
            this.reset();
        })
        .catch(error => {
            alert('Error uploading template');
            console.error('Error:', error);
        });
    });

    function deleteTemplate(id) {
        if (confirm('Are you sure you want to delete this template?')) {
            fetch(`/api/templates/${id}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(result => {
                alert('Template deleted successfully');
                loadTemplates();
            })
            .catch(error => {
                alert('Error deleting template');
                console.error('Error:', error);
            });
        }
    }

    // Load templates when the page loads
    loadTemplates();
});
