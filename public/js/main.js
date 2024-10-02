document.addEventListener('DOMContentLoaded', function() {
    const templateGrid = document.getElementById('templateGrid');
    const generateBtn = document.getElementById('generateBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const previewContainer = document.getElementById('previewContainer');
    const templatePreview = document.getElementById('templatePreview');
    const depthImageInput = document.getElementById('depthImage');

    // Fixed values for separation and depthStrength
    const separation = 170;
    const depthStrength = 25;

    let selectedTemplateId = null;
    let templateOptions = [];
    let hoverTimeout;

    // Fetch and populate template options
    fetch('/api/templates')
    .then(response => response.json())
    .then(templates => {
        templateOptions = templates;
        templates.forEach(template => {
            const templateItem = document.createElement('div');
            templateItem.className = 'template-item';
            templateItem.innerHTML = `<img src="/uploads/${template.filename}" alt="${template.name}">`;
            templateItem.dataset.value = template.id;
            templateItem.dataset.filename = template.filename;
            templateItem.dataset.name = template.name;
            templateGrid.appendChild(templateItem);

            templateItem.addEventListener('click', function() {
                selectTemplate(this);
            });

            templateItem.addEventListener('mouseenter', function() {
                const item = this;
                hoverTimeout = setTimeout(() => {
                    item.classList.add('hovered');
                }, 500);
            });

            templateItem.addEventListener('mouseleave', function() {
                clearTimeout(hoverTimeout);
                this.classList.remove('hovered');
            });
        });

        // Select a random template as default
        selectRandomTemplate();
    });

    function selectRandomTemplate() {
        if (templateOptions.length > 0) {
            const randomIndex = Math.floor(Math.random() * templateOptions.length);
            const randomTemplate = templateGrid.children[randomIndex];
            selectTemplate(randomTemplate);
        }
    }

    function selectTemplate(templateItem) {
        document.querySelectorAll('.template-item.selected').forEach(item => item.classList.remove('selected'));
        templateItem.classList.add('selected');
        selectedTemplateId = templateItem.dataset.value;
        updateTemplatePreview(templateItem.dataset.filename);
    }

    function updateTemplatePreview(filename) {
        if (filename) {
            const templatePath = `/uploads/${filename}`;
            
            // Clear previous preview
            templatePreview.innerHTML = '';
            
            // Calculate the number of tiles needed to fill the preview area
            const previewWidth = previewContainer.clientWidth;
            const previewHeight = previewContainer.clientHeight;
            const tileSize = 50; // This should match the grid-auto-rows and minmax value in CSS
            const tilesX = Math.ceil(previewWidth / tileSize);
            const tilesY = Math.ceil(previewHeight / tileSize);
            
            // Create and append tiles
            for (let y = 0; y < tilesY; y++) {
                for (let x = 0; x < tilesX; x++) {
                    const img = document.createElement('img');
                    img.src = templatePath;
                    img.alt = 'Template preview tile';
                    templatePreview.appendChild(img);
                }
            }
            
            previewContainer.classList.remove('hidden');
        } else {
            previewContainer.classList.add('hidden');
        }
    }

    generateBtn.addEventListener('click', function() {
        const depthImage = depthImageInput.files[0];

        if (!depthImage || !selectedTemplateId) {
            alert('Please upload a depth image and select a template.');
            return;
        }

        const formData = new FormData();
        formData.append('separation', separation);
        formData.append('depthStrength', depthStrength);
        formData.append('depthImage', depthImage);
        formData.append('templateId', selectedTemplateId);

        fetch('/generate-stereogram', {
            method: 'POST',
            body: formData
        })
        .then(response => response.blob())
        .then(blob => {
            const url = URL.createObjectURL(blob);
            document.getElementById('stereogramPreview').src = url;
            document.getElementById('stereogramPreviewContainer').classList.remove('hidden');
            
            downloadBtn.onclick = function() {
                const a = document.createElement('a');
                a.href = url;
                a.download = 'stereogram.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };
            downloadBtn.classList.remove('hidden');
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while generating the stereogram.');
        });
    });

    // Add resize event listener to update preview when window is resized
    window.addEventListener('resize', () => {
        if (selectedTemplateId) {
            const selectedTemplate = document.querySelector(`.template-item[data-value="${selectedTemplateId}"]`);
            updateTemplatePreview(selectedTemplate.dataset.filename);
        }
    });
});