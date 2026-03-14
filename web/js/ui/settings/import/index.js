/**
 * ImportManager - Thin popup shell for vault import
 *
 * Handles: popup lifecycle, file upload, format detection, routing to importer.
 * All import logic lives in the individual importers via runFlow(controller).
 */
const ImportManager = {
    popupApi: null,
    currentImporter: null,

    /**
     * Show the import popup
     */
    show() {
        this.createPopup();
    },

    /**
     * Create the import popup overlay
     */
    createPopup() {
        const self = this;

        Popup.open({
            title: 'Import Data',
            body: '<div id="importContent"></div>',
            compact: false,
            closeOnEscape: false,
            buttons: [],
            onOpen: (api) => {
                self.popupApi = api;

                const popupEl = api.getElement();
                popupEl.classList.add('import-overlay');
                popupEl.querySelector('.popup').classList.add('import-popup');
                popupEl.querySelector('.popup-body').classList.add('import-body');

                const footer = popupEl.querySelector('.popup-footer');
                if (footer) footer.style.display = 'none';

                self._escapeHandler = (e) => {
                    if (e.key === 'Escape' && !App.isLocked()) {
                        self.close();
                    }
                };
                document.addEventListener('keydown', self._escapeHandler);

                const closeBtn = popupEl.querySelector('.popup-close');
                if (closeBtn) {
                    closeBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        self.close();
                    };
                }

                self.showPhase('file-select');
            },
            onClose: () => {
                document.removeEventListener('keydown', self._escapeHandler);
                self.popupApi = null;
                self.currentImporter = null;
            }
        });
    },

    /**
     * Close the import popup
     */
    close() {
        if (App.isLocked()) {
            Toast.warning('Cannot close while import is in progress');
            return;
        }

        if (this.popupApi) {
            this.popupApi.close();
        }
    },

    /**
     * Show a specific phase (only file-select is managed here)
     */
    showPhase(phase) {
        const content = this.popupApi.querySelector('#importContent');

        if (phase === 'file-select') {
            content.innerHTML = this.renderFileSelectPhase();
            this.bindFileSelectEvents();
        }
    },

    // ===========================================
    // File Selection Phase
    // ===========================================

    renderFileSelectPhase() {
        return `
            <div class="import-phase import-file-select">
                <div class="import-dropzone" id="importDropzone">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="import-icon">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <p class="import-dropzone-text">Drag and drop your export file here</p>
                    <p class="import-dropzone-hint">or</p>
                    <button class="btn btn-primary" id="importBrowseBtn">
                        Browse Files
                    </button>
                    <input type="file" id="importFileInput" accept=".json,.csv,.1pux" style="display: none;">
                </div>
                <div class="import-formats">
                    <p class="import-formats-title">Supported formats:</p>
                    <ul class="import-formats-list">
                        <li>KeyHive Export (.json)</li>
                        <li>Nextcloud Passwords Export (.json)</li>
                    </ul>
                </div>
            </div>
        `;
    },

    bindFileSelectEvents() {
        const dropzone = this.popupApi.querySelector('#importDropzone');
        const fileInput = this.popupApi.querySelector('#importFileInput');
        const browseBtn = this.popupApi.querySelector('#importBrowseBtn');

        browseBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        });
    },

    /**
     * Handle selected/dropped file
     */
    async handleFile(file) {
        try {
            const content = await this.readFileAsText(file);

            const importer = this.detectFormat(file.name, content);
            if (!importer) {
                Toast.error('Unsupported file format');
                return;
            }

            this.currentImporter = importer;

            const parseResult = importer.parse(content);
            if (!parseResult.success) {
                Toast.error(parseResult.error || 'Failed to parse file');
                return;
            }

            importer.parsedData = parseResult.data;

            // Create controller and hand off to importer
            const controller = new ImportFlowController(this.popupApi);
            await importer.runFlow(controller);
        } catch (error) {
            console.error('Import file handling error:', error);
            Toast.error('Failed to read file');
        }
    },

    /**
     * Detect file format and return appropriate importer
     */
    detectFormat(filename, content) {
        if (filename.endsWith('.json')) {
            try {
                const json = JSON.parse(content);

                if (json.version && json.salt && json.kdf && json.data) {
                    return new KeyHiveV1Importer();
                }

                if (json.version && json.hasOwnProperty('passwords') && json.hasOwnProperty('encrypted')) {
                    return new NextcloudPasswordsImporter();
                }
            } catch (e) {
                console.error('JSON parse error:', e);
            }
        }

        return null;
    },

    /**
     * Read file as text
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
};
