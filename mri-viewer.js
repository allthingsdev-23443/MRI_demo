/**
 * MRI Cross-Sectional Viewer
 * Implements exact formula: Slice number = a * y + b * x - c
 * Follows the correlation table for shoulder anatomy
 */

class MRIViewer {
    constructor() {
        // Viewport mapping as specified
        this.VIEWPORTS = {
            1: 'sagittal',  // Left - vp1
            2: 'axial',     // Middle - vp2  
            3: 'coronal'    // Right - vp3
        };

        // Viewport JSON keys mapping
        this.VIEWPORT_KEYS = {
            'sagittal': 'vp1',  // Left
            'axial': 'vp2',     // Middle  
            'coronal': 'vp3'    // Right
        };

        // Exact correlation coefficients from the table
        this.SHOULDER_COEFFICIENTS = {
            'axial_to_sagittal': { a: -11.68, b: 19.22, c: -4.08 },     // Ssag(Ax)
            'coronal_to_sagittal': { a: -1.26, b: 25.88, c: 3.01 },     // Ssag(Cor)
            'sagittal_to_axial': { a: -30.71, b: -0.67, c: -26.41 },    // Sax(Sag)
            'coronal_to_axial': { a: -34.74, b: 0.00, c: -29.48 },      // Sax(Cor)
            'sagittal_to_coronal': { a: 0.00, b: 24.29, c: 1.71 },      // Scor(Sag)
            'axial_to_coronal': { a: -25.50, b: -13.81, c: -30.49 }     // Scor(Ax)
        };

        // Current slice numbers (starting from 0)
        this.currentSlices = {
            sagittal: 0,
            axial: 0,
            coronal: 0
        };

        // Image cache
        this.imageCache = {
            sagittal: [],
            axial: [],
            coronal: []
        };

        // Image loading counters
        this.imageCounters = {
            sagittal: { total: 0, loaded: 0 },
            axial: { total: 0, loaded: 0 },
            coronal: { total: 0, loaded: 0 }
        };

        // Canvas contexts
        this.contexts = {};

        // Load real MRI data
        this.loadMRIData();
    }

    async loadMRIData() {
        try {
            // Load MRI data (cache-busting removed for production)
            const response = await fetch('./realMRIImages.json');
            this.mriData = await response.json();
            
            console.log('MRI data loaded successfully');
            console.log('Available keys:', Object.keys(this.mriData));
            console.log('vp1 length:', this.mriData.vp1?.length);
            console.log('vp2 length:', this.mriData.vp2?.length);
            console.log('vp3 length:', this.mriData.vp3?.length);
            
            // Initialize image counters
            this.initializeImageCounters();
            
            // Initialize the viewer
            this.initializeViewer();
        } catch (error) {
            console.error('Error loading MRI data:', error);
        }
    }

    initializeImageCounters() {
        // Set total image counts from the loaded data
        if (this.mriData.vp1) {
            this.imageCounters.sagittal.total = this.mriData.vp1.length;
        }
        if (this.mriData.vp2) {
            this.imageCounters.axial.total = this.mriData.vp2.length;
        }
        if (this.mriData.vp3) {
            this.imageCounters.coronal.total = this.mriData.vp3.length;
        }

        // Update the UI with initial counts
        this.updateImageCountDisplay();
        
        console.log('Image counters initialized:', this.imageCounters);
        
        // Validate JSON data integrity
        this.validateJsonData();
    }

    validateJsonData() {
        console.log('\n🔍 JSON DATA VALIDATION:');
        
        ['vp1', 'vp2', 'vp3'].forEach((key, index) => {
            const viewport = ['sagittal', 'axial', 'coronal'][index];
            const data = this.mriData[key];
            
            if (!data) {
                console.error(`❌ ${key} (${viewport}): Missing data`);
                return;
            }
            
            console.log(`✅ ${key} (${viewport}): ${data.length} entries`);
            
            // Check for missing/invalid entries
            const invalidEntries = [];
            data.forEach((item, i) => {
                if (!item || !item.image || !item.image.startsWith('http')) {
                    invalidEntries.push(i);
                }
            });
            
            if (invalidEntries.length > 0) {
                console.warn(`⚠️ ${key}: Invalid entries at indices: ${invalidEntries.join(', ')}`);
                invalidEntries.forEach(i => {
                    console.log(`   Index ${i}:`, data[i]);
                });
            }
        });
    }

    updateImageCountDisplay() {
        // Update all viewport counts in the UI
        document.getElementById('count-sagittal').textContent = 
            `${this.imageCounters.sagittal.loaded}/${this.imageCounters.sagittal.total}`;
        document.getElementById('count-axial').textContent = 
            `${this.imageCounters.axial.loaded}/${this.imageCounters.axial.total}`;
        document.getElementById('count-coronal').textContent = 
            `${this.imageCounters.coronal.loaded}/${this.imageCounters.coronal.total}`;
    }

    initializeViewer() {
        // Get canvas contexts
        this.contexts = {
            sagittal: document.getElementById('canvas-sagittal').getContext('2d'),
            axial: document.getElementById('canvas-axial').getContext('2d'),
            coronal: document.getElementById('canvas-coronal').getContext('2d')
        };

        // Add click event listeners to all canvases
        this.setupEventListeners();

        // Add keyboard navigation
        this.setupKeyboardNavigation();

        // Load initial images
        this.loadInitialImages();
    }

    setupEventListeners() {
        // Sagittal canvas (viewport 1)
        const sagittalCanvas = document.getElementById('canvas-sagittal');
        sagittalCanvas.addEventListener('click', (e) => {
            this.handleCanvasClick(e, 'sagittal');
        });
        sagittalCanvas.addEventListener('wheel', (e) => {
            this.handleCanvasScroll(e, 'sagittal');
        });

        // Axial canvas (viewport 2)
        const axialCanvas = document.getElementById('canvas-axial');
        axialCanvas.addEventListener('click', (e) => {
            this.handleCanvasClick(e, 'axial');
        });
        axialCanvas.addEventListener('wheel', (e) => {
            this.handleCanvasScroll(e, 'axial');
        });

        // Coronal canvas (viewport 3)
        const coronalCanvas = document.getElementById('canvas-coronal');
        coronalCanvas.addEventListener('click', (e) => {
            this.handleCanvasClick(e, 'coronal');
        });
        coronalCanvas.addEventListener('wheel', (e) => {
            this.handleCanvasScroll(e, 'coronal');
        });
    }

    setupKeyboardNavigation() {
        // Track which viewport is focused
        this.focusedViewport = null;

        // Add focus/blur events to track active viewport
        ['sagittal', 'axial', 'coronal'].forEach(viewport => {
            const canvas = document.getElementById(`canvas-${viewport}`);
            canvas.tabIndex = 0; // Make canvas focusable
            
            canvas.addEventListener('focus', () => {
                this.focusedViewport = viewport;
                this.highlightActiveViewport(viewport);
            });
            
            canvas.addEventListener('blur', () => {
                this.focusedViewport = null;
            });
        });

        // Add keyboard event listener
        document.addEventListener('keydown', (e) => {
            this.handleKeyNavigation(e);
        });
    }

    handleCanvasClick(event, sourceViewport) {
        const canvas = event.target;
        const rect = canvas.getBoundingClientRect();
        
        // Get raw coordinates
        const rawX = event.clientX - rect.left;
        const rawY = event.clientY - rect.top;

        // Normalize coordinates to 0-1 range (divide by canvas dimensions)
        const normalizedX = rawX / canvas.width;
        const normalizedY = rawY / canvas.height;

        // Update coordinates display
        this.updateCoordinatesDisplay(rawX, rawY, normalizedX, normalizedY);

        // Highlight active viewport
        this.highlightActiveViewport(sourceViewport);

        // Calculate and update cross-sectional slices
        this.calculateCrossSectionalSlices(normalizedX, normalizedY, sourceViewport);
    }

    handleCanvasScroll(event, viewport) {
        // Prevent page scrolling
        event.preventDefault();
        
        // Get current slice
        let currentSlice = this.currentSlices[viewport];
        
        // Determine scroll direction
        const scrollDirection = event.deltaY > 0 ? 1 : -1;
        
        // Calculate new slice number
        let newSlice = currentSlice + scrollDirection;
        
        // Clamp to valid range (0-20)
        newSlice = Math.max(0, Math.min(20, newSlice));
        
        console.log(`Scroll: ${viewport} from ${currentSlice} to ${newSlice}`);
        
        // Update slice if it changed
        if (newSlice !== currentSlice) {
            this.updateSliceOnly(viewport, newSlice);
            
            // Highlight viewport to show it's being scrolled
            this.highlightActiveViewport(viewport);
            
            // Update debug info
            this.updateScrollDebugInfo(viewport, newSlice, scrollDirection);
        }
    }

    handleKeyNavigation(event) {
        if (!this.focusedViewport) return;

        let direction = 0;
        
        switch(event.key) {
            case 'ArrowUp':
            case 'ArrowLeft':
                direction = -1;
                break;
            case 'ArrowDown':
            case 'ArrowRight':
                direction = 1;
                break;
            default:
                return; // Ignore other keys
        }

        event.preventDefault();
        
        // Get current slice for focused viewport
        let currentSlice = this.currentSlices[this.focusedViewport];
        let newSlice = Math.max(0, Math.min(20, currentSlice + direction));
        
        if (newSlice !== currentSlice) {
            this.updateSliceOnly(this.focusedViewport, newSlice);
            this.updateScrollDebugInfo(this.focusedViewport, newSlice, direction);
        }
    }

    calculateCrossSectionalSlices(x, y, sourceViewport) {
        let calculations = [];

        // Based on source viewport, calculate the other two viewports
        switch (sourceViewport) {
            case 'sagittal':
                // Sax(Sag): Calculate axial slice
                const axialSlice = this.calculateSlice(x, y, this.SHOULDER_COEFFICIENTS.sagittal_to_axial);
                this.updateSlice('axial', axialSlice);
                calculations.push(`Sax(Sag): ${axialSlice}`);

                // Scor(Sag): Calculate coronal slice  
                const coronalSlice = this.calculateSlice(x, y, this.SHOULDER_COEFFICIENTS.sagittal_to_coronal);
                this.updateSlice('coronal', coronalSlice);
                calculations.push(`Scor(Sag): ${coronalSlice}`);
                break;

            case 'axial':
                // Ssag(Ax): Calculate sagittal slice
                const sagittalSlice = this.calculateSlice(x, y, this.SHOULDER_COEFFICIENTS.axial_to_sagittal);
                this.updateSlice('sagittal', sagittalSlice);
                calculations.push(`Ssag(Ax): ${sagittalSlice}`);

                // Scor(Ax): Calculate coronal slice
                const coronalSlice2 = this.calculateSlice(x, y, this.SHOULDER_COEFFICIENTS.axial_to_coronal);
                this.updateSlice('coronal', coronalSlice2);
                calculations.push(`Scor(Ax): ${coronalSlice2}`);
                break;

            case 'coronal':
                // Ssag(Cor): Calculate sagittal slice
                const sagittalSlice2 = this.calculateSlice(x, y, this.SHOULDER_COEFFICIENTS.coronal_to_sagittal);
                this.updateSlice('sagittal', sagittalSlice2);
                calculations.push(`Ssag(Cor): ${sagittalSlice2}`);

                // Sax(Cor): Calculate axial slice
                const axialSlice2 = this.calculateSlice(x, y, this.SHOULDER_COEFFICIENTS.coronal_to_axial);
                this.updateSlice('axial', axialSlice2);
                calculations.push(`Sax(Cor): ${axialSlice2}`);
                break;
        }

        // Update debug information
        this.updateDebugInfo(calculations, x, y);
    }

    /**
     * Core calculation function following exact formula: Slice number = a * y + b * x - c
     * @param {number} x - Normalized x coordinate (0-1)
     * @param {number} y - Normalized y coordinate (0-1)  
     * @param {object} coefficients - Object with a, b, c values
     * @returns {number} - Calculated slice number (0-20)
     */
    calculateSlice(x, y, coefficients) {
        // Apply exact formula: Slice number = a * y + b * x - c
        const slice = coefficients.a * y + coefficients.b * x - coefficients.c;
        
        // Round to nearest integer and clamp to valid range (0-20)
        return Math.round(Math.max(0, Math.min(20, slice)));
    }

    updateSlice(viewport, sliceNumber) {
        // Update current slice
        this.currentSlices[viewport] = sliceNumber;
        
        // Update UI
        document.getElementById(`slice-${viewport}`).textContent = sliceNumber;
        
        // Load and display the new image
        this.loadAndDisplaySlice(viewport, sliceNumber);
    }

    updateSliceOnly(viewport, sliceNumber) {
        // Update only the specified viewport (used for scroll navigation)
        this.currentSlices[viewport] = sliceNumber;
        
        // Update UI
        document.getElementById(`slice-${viewport}`).textContent = sliceNumber;
        
        // Load and display the new image
        this.loadAndDisplaySlice(viewport, sliceNumber);
    }

    async loadAndDisplaySlice(viewport, sliceNumber) {
        try {
            // Get the viewport key (vp1, vp2, vp3)
            const viewportKey = this.VIEWPORT_KEYS[viewport];
            
            // Debug logging
            console.log(`Loading ${viewport} (${viewportKey}) slice ${sliceNumber}`);
            console.log('MRI Data keys:', Object.keys(this.mriData));
            console.log(`Viewport data length:`, this.mriData[viewportKey]?.length);
            
            // Check if viewport data exists
            if (!this.mriData[viewportKey]) {
                console.error(`Viewport data not found for ${viewportKey}`);
                return;
            }
            
            // Get the image object for this slice
            const imageObj = this.mriData[viewportKey][sliceNumber];
            
            if (!imageObj || !imageObj.image) {
                console.error(`No image found for ${viewport} (${viewportKey}) slice ${sliceNumber}`);
                console.error(`Available slices: 0-${this.mriData[viewportKey].length - 1}`);
                return;
            }
            
            const imageUrl = imageObj.image;

            // Load image if not cached
            if (!this.imageCache[viewport][sliceNumber]) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                await new Promise((resolve, reject) => {
                    img.onload = () => {
                        this.imageCache[viewport][sliceNumber] = img;
                        
                        // Increment loaded counter if not already counted
                        if (this.imageCounters[viewport].loaded < this.imageCounters[viewport].total) {
                            this.imageCounters[viewport].loaded++;
                            this.updateImageCountDisplay();
                        }
                        
                        console.log(`✅ Loaded ${viewport} slice ${sliceNumber} - Progress: ${this.imageCounters[viewport].loaded}/${this.imageCounters[viewport].total}`);
                        resolve();
                    };
                    img.onerror = (error) => {
                        console.warn(`⚠️ CORS failed for ${viewport} slice ${sliceNumber}, trying without CORS: ${imageUrl}`);
                        
                        // Try again without CORS
                        const img2 = new Image();
                        img2.onload = () => {
                            this.imageCache[viewport][sliceNumber] = img2;
                            
                            if (this.imageCounters[viewport].loaded < this.imageCounters[viewport].total) {
                                this.imageCounters[viewport].loaded++;
                                this.updateImageCountDisplay();
                            }
                            
                            console.log(`✅ Loaded ${viewport} slice ${sliceNumber} without CORS - Progress: ${this.imageCounters[viewport].loaded}/${this.imageCounters[viewport].total}`);
                            resolve();
                        };
                        img2.onerror = (error2) => {
                            console.error(`❌ Complete failure for ${viewport} slice ${sliceNumber}: ${imageUrl}`, error2);
                            reject(error2);
                        };
                        img2.src = imageUrl;
                    };
                    img.src = imageUrl;
                });
            }

            // Draw the image
            const canvas = document.getElementById(`canvas-${viewport}`);
            const ctx = this.contexts[viewport];
            const img = this.imageCache[viewport][sliceNumber];

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw image to fill canvas
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Add slice transition animation
            canvas.classList.add('slice-transition');
            setTimeout(() => canvas.classList.remove('slice-transition'), 300);

        } catch (error) {
            console.error(`Error loading ${viewport} slice ${sliceNumber}:`, error);
        }
    }

    async loadInitialImages() {
        // Load slice 0 for all viewports
        for (const viewport of ['sagittal', 'axial', 'coronal']) {
            await this.loadAndDisplaySlice(viewport, 0);
            document.getElementById(`loading-${viewport}`).classList.add('hidden');
        }
        
        // Start preloading all images in the background
        this.preloadAllImages();
    }

    async preloadAllImages() {
        console.log('🔄 Starting background preload of all images...');
        
        const viewports = ['sagittal', 'axial', 'coronal'];
        const promises = [];
        const failedImages = [];

        viewports.forEach(viewport => {
            const viewportKey = this.VIEWPORT_KEYS[viewport];
            const imageArray = this.mriData[viewportKey];
            
            if (imageArray) {
                console.log(`📊 ${viewport} (${viewportKey}): Expected ${imageArray.length} images`);
                // Preload all slices for this viewport with staggered loading
                for (let i = 1; i < imageArray.length; i++) { // Skip slice 0 as it's already loaded
                    // Add small delay between requests to avoid overwhelming the server
                    const delay = Math.floor(i / 5) * 100; // 100ms delay every 5 images
                    
                    promises.push(
                        new Promise(resolve => setTimeout(resolve, delay))
                            .then(() => this.preloadSingleImage(viewport, i))
                            .catch(error => {
                                failedImages.push({viewport, slice: i, error});
                                return Promise.resolve(); // Don't fail the whole batch
                            })
                    );
                }
            }
        });

        try {
            await Promise.allSettled(promises);
            console.log('✅ Preload completed');
            console.log('📊 Final counters:', this.imageCounters);
            
            if (failedImages.length > 0) {
                console.error('❌ Failed to load images:', failedImages);
                this.analyzeFailedImages(failedImages);
                
                // Retry failed images after a delay
                setTimeout(() => this.retryFailedImages(failedImages), 2000);
            }
        } catch (error) {
            console.error('❌ Error during preload:', error);
        }
    }

    async retryFailedImages(failedImages) {
        console.log('🔄 Retrying failed images...');
        
        const retryPromises = failedImages.map(async ({viewport, slice}) => {
            try {
                await this.preloadSingleImage(viewport, slice);
                console.log(`✅ Retry successful: ${viewport} slice ${slice}`);
                return true;
            } catch (error) {
                console.log(`❌ Retry failed: ${viewport} slice ${slice}`);
                return false;
            }
        });

        const results = await Promise.allSettled(retryPromises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
        
        console.log(`🔄 Retry completed: ${successful}/${failedImages.length} images recovered`);
        console.log('📊 Updated counters:', this.imageCounters);
    }

    analyzeFailedImages(failedImages) {
        console.log('\n🔍 MISSING IMAGES ANALYSIS:');
        
        const byViewport = {};
        failedImages.forEach(({viewport, slice, error}) => {
            if (!byViewport[viewport]) byViewport[viewport] = [];
            byViewport[viewport].push(slice);
        });

        Object.keys(byViewport).forEach(viewport => {
            const missing = byViewport[viewport];
            console.log(`❌ ${viewport.toUpperCase()}: Missing slices ${missing.join(', ')}`);
            
            // Check if these images exist in the JSON
            const viewportKey = this.VIEWPORT_KEYS[viewport];
            missing.forEach(slice => {
                const imageObj = this.mriData[viewportKey][slice];
                if (imageObj && imageObj.image) {
                    console.log(`   Slice ${slice}: URL exists but failed to load - ${imageObj.image}`);
                } else {
                    console.log(`   Slice ${slice}: Missing from JSON data`);
                }
            });
        });
        
        // Test a few URLs directly
        this.testImageUrls(failedImages.slice(0, 3));
    }

    async testImageUrls(failedImages) {
        console.log('\n🧪 Testing failed URLs directly:');
        
        for (const {viewport, slice} of failedImages) {
            const viewportKey = this.VIEWPORT_KEYS[viewport];
            const imageObj = this.mriData[viewportKey][slice];
            
            if (imageObj && imageObj.image) {
                try {
                    const response = await fetch(imageObj.image, {method: 'HEAD'});
                    console.log(`🌐 ${viewport} slice ${slice}: HTTP ${response.status} - ${imageObj.image}`);
                } catch (error) {
                    console.log(`🌐 ${viewport} slice ${slice}: Network error - ${error.message}`);
                }
            }
        }
    }

    async preloadSingleImage(viewport, sliceNumber) {
        try {
            const viewportKey = this.VIEWPORT_KEYS[viewport];
            const imageObj = this.mriData[viewportKey][sliceNumber];
            
            if (!imageObj || !imageObj.image) {
                return Promise.reject(`No image data for ${viewport} slice ${sliceNumber}`);
            }

            // Skip if already cached
            if (this.imageCache[viewport][sliceNumber]) {
                return Promise.resolve();
            }

            const imageUrl = imageObj.image;
            const img = new Image();
            
            // Try different CORS settings
            img.crossOrigin = 'anonymous';

            return new Promise((resolve, reject) => {
                img.onload = () => {
                    this.imageCache[viewport][sliceNumber] = img;
                    this.imageCounters[viewport].loaded++;
                    this.updateImageCountDisplay();
                    resolve();
                };
                img.onerror = (error) => {
                    console.warn(`⚠️ Failed to preload ${viewport} slice ${sliceNumber}: ${imageUrl}`);
                    
                    // Try again without CORS
                    const img2 = new Image();
                    img2.onload = () => {
                        console.log(`✅ Loaded ${viewport} slice ${sliceNumber} without CORS`);
                        this.imageCache[viewport][sliceNumber] = img2;
                        this.imageCounters[viewport].loaded++;
                        this.updateImageCountDisplay();
                        resolve();
                    };
                    img2.onerror = (error2) => {
                        console.error(`❌ Complete failure for ${viewport} slice ${sliceNumber}: ${imageUrl}`);
                        reject(`Both CORS and non-CORS attempts failed`);
                    };
                    img2.src = imageUrl;
                };
                img.src = imageUrl;
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    updateCoordinatesDisplay(rawX, rawY, normalizedX, normalizedY) {
        const coordsElement = document.getElementById('coordinates');
        coordsElement.textContent = 
            `Click coordinates: Raw(${Math.round(rawX)}, ${Math.round(rawY)}) | Normalized(${normalizedX.toFixed(3)}, ${normalizedY.toFixed(3)})`;
    }

    highlightActiveViewport(activeViewport) {
        // Remove active class from all viewports
        document.querySelectorAll('.viewport').forEach(vp => vp.classList.remove('active'));
        
        // Add active class to clicked viewport
        const viewportMap = { sagittal: 1, axial: 2, coronal: 3 };
        const viewportId = viewportMap[activeViewport];
        document.getElementById(`viewport-${viewportId}`).classList.add('active');
        
        // Remove active class after 2 seconds
        setTimeout(() => {
            document.getElementById(`viewport-${viewportId}`).classList.remove('active');
        }, 2000);
    }

    updateDebugInfo(calculations, x, y) {
        const debugElement = document.getElementById('last-calculation');
        const calculationText = `x=${x.toFixed(3)}, y=${y.toFixed(3)} | ${calculations.join(', ')}`;
        debugElement.textContent = calculationText;
    }

    updateScrollDebugInfo(viewport, sliceNumber, direction) {
        const debugElement = document.getElementById('last-calculation');
        const scrollText = `Scrolled ${viewport} ${direction > 0 ? 'forward' : 'backward'} to slice ${sliceNumber}`;
        debugElement.textContent = scrollText;
        
        // Update coordinates display to show scroll action
        const coordsElement = document.getElementById('coordinates');
        coordsElement.textContent = `Manual scroll in ${viewport} viewport`;
    }
}

// Initialize the MRI viewer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.mriViewer = new MRIViewer();
}); 