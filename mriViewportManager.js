/**
 * Manages multiple MRI viewports, handling slice synchronization and correlation.
 */
class MRIViewportManager {
  /**
   * @param {Object} viewports - An object containing the DOM elements for the viewports.
   * @param {HTMLElement} viewports.axial - The axial viewport element.
   * @param {HTMLElement} viewports.sagittal - The sagittal viewport element.
   * @param {HTMLElement} viewports.coronal - The coronal viewport element.
   * @param {Object} totalSlices - The total number of slices for each viewport.
   * @param {number} totalSlices.axial
   * @param {number} totalSlices.sagittal
   * @param {number} totalSlices.coronal
   */
  constructor(viewports, totalSlices) {
    this.viewports = viewports;
    this.totalSlices = totalSlices;
    this.correlationData = null;
    this.lookupTables = null;

    this.currentSlices = {
      axial: Math.floor(totalSlices.axial / 2),
      sagittal: Math.floor(totalSlices.sagittal / 2),
      coronal: Math.floor(totalSlices.coronal / 2),
    };

    console.log("MRIViewportManager initialized with slices:", this.currentSlices);
  }

  /**
   * Loads correlation data from external JSON files.
   * @param {string} tablesPath - Path to the correlation tables JSON.
   * @param {string} lookupPath - Path to the lookup tables JSON (can be same as tablesPath).
   */
  async loadCorrelationData(tablesPath, lookupPath) {
    try {
      const tablesResponse = await fetch(tablesPath);
      if (!tablesResponse.ok) {
        throw new Error('Network response was not ok.');
      }
      this.correlationData = await tablesResponse.json();
      
      // For backward compatibility, also load lookup tables if different path provided
      if (lookupPath && lookupPath !== tablesPath) {
        try {
          const lookupResponse = await fetch(lookupPath);
          if (lookupResponse.ok) {
            this.lookupTables = await lookupResponse.json();
          }
        } catch (lookupError) {
          console.warn("Could not load lookup tables:", lookupError);
          this.lookupTables = {};
        }
      } else {
        this.lookupTables = {};
      }
      
      console.log("Successfully loaded correlation data with formula-based coefficients.");
      console.log("Available correlations:", Object.keys(this.correlationData));
    } catch (error) {
      console.error("Failed to load correlation data:", error);
      // Fallback to empty objects to prevent runtime errors
      this.correlationData = {};
      this.lookupTables = {};
    }
  }

  /**
   * Gets the current slice number for a given viewport.
   * @param {string} viewport - 'axial', 'sagittal', or 'coronal'.
   * @returns {number} The current slice number.
   */
  getCurrentSlice(viewport) {
    return this.currentSlices[viewport];
  }

  /**
   * Sets the current slice for a viewport and triggers an update.
   * @param {string} viewport - 'axial', 'sagittal', or 'coronal'.
   * @param {number} sliceNumber - The new slice number.
   * @param {boolean} [suppressEvent=false] - If true, do not dispatch update event.
   */
  setCurrentSlice(viewport, sliceNumber, suppressEvent = false) {
    const maxSlice = this.totalSlices[viewport] - 1;
    // Clamp the slice number to be within the valid range (0 to maxSlice)
    const clampedSliceNumber = Math.max(0, Math.min(sliceNumber, maxSlice));

    if (this.currentSlices[viewport] !== clampedSliceNumber) {
      this.currentSlices[viewport] = clampedSliceNumber;
      console.log(`Set ${viewport} slice to: ${clampedSliceNumber}`);
      if (!suppressEvent) {
        this.dispatchUpdateEvent(viewport, clampedSliceNumber);
      }
    }
  }
  
  /**
   * Finds the corresponding slice from a lookup table based on a percentage value.
   * @param {Object} table - The lookup table (e.g., this.lookupTables.shoulder_lookup_tables.axial_to_sagittal).
   * @param {number} percent - The percentage value (0-100).
   * @returns {number} The corresponding slice number.
   */
  getSliceFromLookup(table, percent) {
    if (!table) {
        console.error("Lookup table is not loaded or does not exist.");
        return 0;
    }
    const key = Math.round(percent).toString();
    return table[key] !== undefined ? table[key] : (table["100"] || 0);
  }


  /**
   * Handle click on a viewport and update correlated slices using formula-based correlations.
   * Formula: S(x,y) = ax + by + c (rounded to integer, clamped to valid range)
   * @param {string} sourceViewport - 'axial', 'sagittal', or 'coronal'.
   * @param {number} x - X coordinate of the click relative to the rendered image.
   * @param {number} y - Y coordinate of the click relative to the rendered image.
   * @param {number} renderedWidth - Width of the rendered image.
   * @param {number} renderedHeight - Height of the rendered image.
   * @param {number} naturalWidth - Natural width of the image.
   * @param {number} naturalHeight - Natural height of the image.
   */
  async handleViewportClick(sourceViewport, x, y, renderedWidth, renderedHeight, naturalWidth, naturalHeight) {
    console.log(`=== VIEWPORT CLICK: ${sourceViewport} (${x}, ${y}) ===`);
    console.log(`Rendered image dimensions: ${renderedWidth}x${renderedHeight}`);
    console.log(`Natural image dimensions: ${naturalWidth}x${naturalHeight}`);
    
    if (!this.correlationData) {
        console.error("Correlation data is not loaded. Cannot process click.");
        return;
    }
    
    if (!this.correlationData.shoulder_correlations) {
        console.error("Shoulder correlations not found in data.");
        return;
    }

    // The coordinates are already relative to the rendered image
    // Convert to 0-1 coordinate system as specified
    let xNormalized = x / renderedWidth;
    // Flip Y-axis: user expects y=0 at bottom, y=1 at top
    let yNormalized = (renderedHeight - y) / renderedHeight;

    console.log(`Click coordinates in rendered image: (${x.toFixed(1)}, ${y.toFixed(1)})`);
    console.log(`Normalized coordinates: X=${xNormalized.toFixed(3)}, Y=${yNormalized.toFixed(3)} (Y-flipped)`);

    // TODO: Add side selection logic
    // For now, assuming "right" side. When "left" is selected:
    // - For viewports 2 and 3, use (1-x) instead of x
    const sideSelection = "right"; // This should come from UI selection
    
    const coefficients = this.correlationData.shoulder_correlations.coefficients;
    console.log("Using coefficients:", coefficients);

    // Define slice ranges (0-based indexing, 0 to 20)
    const minSlice = 0;
    const maxSlice = 20;

    /**
     * Calculate slice using formula: S(x,y) = ax + by + c
     * @param {Object} coeff - Coefficients {a, b, c}
     * @param {number} x - X coordinate (0-1)
     * @param {number} y - Y coordinate (0-1)
     * @returns {number} - Clamped slice number
     */
    const calculateSlice = (coeff, x, y) => {
      const rawResult = coeff.a * x + coeff.b * y + coeff.c;
      const roundedResult = Math.round(rawResult);
      const clampedResult = Math.max(minSlice, Math.min(maxSlice, roundedResult));
      
      console.log(`  Formula: ${coeff.a} * ${x.toFixed(3)} + ${coeff.b} * ${y.toFixed(3)} + ${coeff.c} = ${rawResult.toFixed(2)} → rounded: ${roundedResult} → clamped: ${clampedResult}`);
      
      return clampedResult;
    };

    // Apply side selection logic for x coordinate
    const getXCoordinate = (viewportNumber) => {
      if (sideSelection === "left" && (viewportNumber === 2 || viewportNumber === 3)) {
        return 1 - xNormalized;
      }
      return xNormalized;
    };

    // Calculate correlations based on source viewport
    switch (sourceViewport) {
      case 'axial':
        console.log("Axial click - calculating sagittal and coronal slices:");
        
        // Sagittal (viewport 2) - apply side selection
        const xForSagittal = getXCoordinate(2);
        const newSagittalSlice = calculateSlice(coefficients.axial_to_sagittal, xForSagittal, yNormalized);
        
        // Coronal (viewport 3) - apply side selection  
        const xForCoronal = getXCoordinate(3);
        const newCoronalSlice = calculateSlice(coefficients.axial_to_coronal, xForCoronal, yNormalized);
        
        this.setCurrentSlice('sagittal', newSagittalSlice);
        this.setCurrentSlice('coronal', newCoronalSlice);
        
        console.log(`Axial click result: Sagittal=${newSagittalSlice}, Coronal=${newCoronalSlice}`);
        break;

      case 'sagittal':
        console.log("Sagittal click - calculating axial and coronal slices:");
        
        // Axial (viewport 1) - no side selection needed
        const newAxialSlice1 = calculateSlice(coefficients.sagittal_to_axial, xNormalized, yNormalized);
        
        // Coronal (viewport 3) - apply side selection
        const xForCoronalFromSag = getXCoordinate(3);
        const newCoronalSlice1 = calculateSlice(coefficients.sagittal_to_coronal, xForCoronalFromSag, yNormalized);
        
        this.setCurrentSlice('axial', newAxialSlice1);
        this.setCurrentSlice('coronal', newCoronalSlice1);
        
        console.log(`Sagittal click result: Axial=${newAxialSlice1}, Coronal=${newCoronalSlice1}`);
        break;

      case 'coronal':
        console.log("Coronal click - calculating axial and sagittal slices:");
        
        // Axial (viewport 1) - no side selection needed
        const newAxialSlice2 = calculateSlice(coefficients.coronal_to_axial, xNormalized, yNormalized);
        
        // Sagittal (viewport 2) - apply side selection
        const xForSagittalFromCor = getXCoordinate(2);
        const newSagittalSlice2 = calculateSlice(coefficients.coronal_to_sagittal, xForSagittalFromCor, yNormalized);
        
        this.setCurrentSlice('axial', newAxialSlice2);
        this.setCurrentSlice('sagittal', newSagittalSlice2);
        
        console.log(`Coronal click result: Axial=${newAxialSlice2}, Sagittal=${newSagittalSlice2}`);
        break;
        
      default:
        console.error("Unknown source viewport:", sourceViewport);
        return;
    }
  }

  /**
   * Dispatches a custom event to notify listeners of a slice update.
   * @param {string} viewport - The viewport that was updated.
   * @param {number} sliceNumber - The new slice number.
   */
  dispatchUpdateEvent(viewport, sliceNumber) {
    const event = new CustomEvent('sliceupdate', {
      detail: {
        viewport,
        sliceNumber,
        currentSlices: { ...this.currentSlices }
      }
    });
    document.dispatchEvent(event);
  }

  /**
   * Handles scroll wheel events for slice navigation.
   * @param {string} viewport - The viewport being scrolled.
   * @param {object} event - The wheel event.
   */
  handleScroll(viewport, event) {
    event.preventDefault();
    const delta = Math.sign(event.deltaY); // -1 for up, 1 for down
    const currentSlice = this.getCurrentSlice(viewport);
    const newSlice = currentSlice + delta;
    this.setCurrentSlice(viewport, newSlice);
  }
}

// Advanced Image Caching System
class MRIImageCache {
  constructor() {
    this.cache = new Map();
    this.loadingPromises = new Map();
    this.preloadQueue = [];
    this.isPreloading = false;
    this.maxConcurrentLoads = 3; // Reduced from 6 to prevent overwhelming the server
    this.loadingCount = 0;
    this.cacheStats = {
      hits: 0,
      misses: 0,
      preloaded: 0,
      failed: 0
    };
    this.failedUrls = new Set(); // Track permanently failed URLs
    this.retryDelays = new Map(); // Track retry delays for exponential backoff
  }

  /**
   * Get cached image or load it - optimized version
   */
  async getImage(viewport, sliceNumber, imageUrl) {
    const cacheKey = `${viewport}-${sliceNumber}`;
    
    // Return cached image immediately
    if (this.cache.has(cacheKey)) {
      this.cacheStats.hits++;
      return this.cache.get(cacheKey);
    }

    // Return existing loading promise if already loading
    if (this.loadingPromises.has(cacheKey)) {
      try {
        return await this.loadingPromises.get(cacheKey);
      } catch (error) {
        console.error(`Failed to wait for loading promise: ${cacheKey}`, error);
        // Remove the failed promise and try again
        this.loadingPromises.delete(cacheKey);
      }
    }

    // Start loading the image with improved error handling
    this.cacheStats.misses++;
    const loadPromise = this.loadImage(imageUrl, cacheKey, 2); // Reduced retries for faster failure
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const imageBlob = await loadPromise;
      this.cache.set(cacheKey, imageBlob);
      console.log(`Successfully cached: ${cacheKey}`);
      return imageBlob;
    } catch (error) {
      console.error(`Failed to load image: ${cacheKey}`, error);
      this.cacheStats.failed++;
      throw error;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  /**
   * Load image with improved retry logic, timeout handling, and failure tracking
   */
  async loadImage(url, cacheKey, retries = 2) {
    this.loadingCount++;
    
    // Check if this URL has permanently failed before
    if (this.failedUrls.has(url)) {
      this.loadingCount--;
      throw new Error(`URL permanently failed: ${url}`);
    }
    
    try {
      // Implement progressive timeout (shorter for retries)
      const timeoutDuration = retries === 2 ? 15000 : (retries === 1 ? 10000 : 5000);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutDuration);
      });
      
      // Add delay before retry if this URL has failed before
      const retryKey = `${url}-retry`;
      if (this.retryDelays.has(retryKey)) {
        const delay = this.retryDelays.get(retryKey);
        console.log(`Waiting ${delay}ms before retry for ${cacheKey}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // Use simple fetch without custom headers to avoid CORS preflight
      const fetchPromise = fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit'
      });
      
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Validate that we actually got an image
      if (!blob.type.startsWith('image/')) {
        throw new Error(`Invalid content type: ${blob.type}`);
      }
      
      const objectUrl = URL.createObjectURL(blob);
      
      // Clear retry delay on success
      this.retryDelays.delete(retryKey);
      
      console.log(`✓ Cached: ${cacheKey} (${(blob.size / 1024).toFixed(1)}KB)`);
      return objectUrl;
      
    } catch (error) {
      console.warn(`Failed to load ${cacheKey}:`, error.message);
      
      if (retries > 0) {
        // Exponential backoff with jitter
        const baseDelay = Math.pow(2, 3 - retries) * 1000; // 1s, 2s, 4s
        const jitter = Math.random() * 1000; // Add up to 1s random delay
        const delay = Math.min(baseDelay + jitter, 8000); // Max 8s delay
        
        // Store retry delay for this URL
        const retryKey = `${url}-retry`;
        this.retryDelays.set(retryKey, delay);
        
        console.log(`Retrying ${cacheKey} in ${delay.toFixed(0)}ms (${retries} attempts left)...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.loadImage(url, cacheKey, retries - 1);
      }
      
      // Mark URL as permanently failed after all retries
      this.failedUrls.add(url);
      this.cacheStats.failed++;
      console.error(`Permanently failed: ${cacheKey} - ${error.message}`);
      throw error;
    } finally {
      this.loadingCount--;
    }
  }

  /**
   * Preload images in batches with priority and recovery mechanisms
   */
  async preloadImages(realMRIImages, prioritySlices = [10, 9, 11, 8, 12]) {
    if (this.isPreloading) {
      console.log('Preloading already in progress, skipping...');
      return;
    }
    this.isPreloading = true;

    console.log('🚀 Starting intelligent image preloading...');
    const startTime = performance.now();
    
    try {
      // Phase 1: Preload priority slices (center slices first)
      console.log('Phase 1: Loading priority slices...');
      const priorityResult = await this.preloadPrioritySlices(realMRIImages, prioritySlices);
      
      // Phase 2: Preload remaining slices in background
      console.log('Phase 2: Loading remaining slices...');
      const remainingResult = await this.preloadRemainingSlices(realMRIImages, prioritySlices);
      
      const endTime = performance.now();
      const totalTime = (endTime - startTime) / 1000;
      
      console.log('✅ Preloading complete!');
      console.log(`Total time: ${totalTime.toFixed(2)}s`);
      console.log(`Priority: ${priorityResult.completed} loaded, ${priorityResult.failed} failed`);
      console.log(`Background: ${remainingResult.completed} loaded, ${remainingResult.failed} failed`);
      console.log('Final cache stats:', this.getStats());
      
    } catch (error) {
      console.error('Preloading failed:', error);
      // Try to recover by clearing failed promises
      this.loadingPromises.clear();
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Force restart preloading if it gets stuck
   */
  async restartPreloading(realMRIImages) {
    console.log('🔄 Restarting preloading process...');
    this.isPreloading = false;
    this.loadingPromises.clear();
    
    // Wait a moment then restart
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.preloadImages(realMRIImages);
  }

  /**
   * Preload priority slices first (center slices for immediate use)
   */
  async preloadPrioritySlices(realMRIImages, prioritySlices) {
    const priorityTasks = [];
    
    for (const viewport of ['axial', 'sagittal', 'coronal']) {
      for (const slice of prioritySlices) {
        if (slice < realMRIImages[viewport].length) {
          priorityTasks.push({
            viewport,
            slice,
            url: realMRIImages[viewport][slice],
            priority: 'high'
          });
        }
      }
    }

    console.log(`Loading ${priorityTasks.length} priority images...`);
    return await this.processBatch(priorityTasks, 'Priority');
  }

  /**
   * Preload remaining slices in background
   */
  async preloadRemainingSlices(realMRIImages, prioritySlices) {
    const remainingTasks = [];
    
    for (const viewport of ['axial', 'sagittal', 'coronal']) {
      for (let slice = 0; slice < realMRIImages[viewport].length; slice++) {
        if (!prioritySlices.includes(slice)) {
          remainingTasks.push({
            viewport,
            slice,
            url: realMRIImages[viewport][slice],
            priority: 'normal'
          });
        }
      }
    }

    console.log(`Loading ${remainingTasks.length} remaining images...`);
    return await this.processBatch(remainingTasks, 'Background');
  }

  /**
   * Process batch of images with improved concurrency control and error recovery
   */
  async processBatch(tasks, batchName) {
    const batchSize = this.maxConcurrentLoads;
    let completed = 0;
    let failed = 0;
    let skipped = 0;
    
    console.log(`Starting ${batchName} batch: ${tasks.length} images`);
    
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchPromises = batch.map(async (task) => {
        const cacheKey = `${task.viewport}-${task.slice}`;
        
        try {
          // Skip if already cached
          if (this.cache.has(cacheKey)) {
            skipped++;
            return;
          }
          
          // Skip if URL is permanently failed
          if (this.failedUrls.has(task.url)) {
            console.log(`Skipping permanently failed URL: ${cacheKey}`);
            skipped++;
            return;
          }
          
          await this.getImage(task.viewport, task.slice, task.url);
          this.cacheStats.preloaded++;
          completed++;
          
        } catch (error) {
          console.error(`Batch item failed: ${cacheKey}`, error.message);
          failed++;
        }
      });

      // Use Promise.allSettled to continue even if some images fail
      const results = await Promise.allSettled(batchPromises);
      
      // Log progress every few batches
      if (i % (batchSize * 3) === 0 || i + batchSize >= tasks.length) {
        const progress = ((i + batchSize) / tasks.length * 100).toFixed(1);
        console.log(`${batchName} progress: ${progress}% (${completed} loaded, ${failed} failed, ${skipped} skipped)`);
      }
      
      // Adaptive delay between batches based on failure rate
      if (i + batchSize < tasks.length) {
        const failureRate = failed / (completed + failed + skipped);
        const delay = failureRate > 0.3 ? 500 : (failureRate > 0.1 ? 200 : 100); // Longer delay if many failures
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.log(`${batchName} batch complete: ${completed} loaded, ${failed} failed, ${skipped} skipped`);
    return { completed, failed, skipped };
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.cacheStats,
      cacheSize: this.cache.size,
      loadingCount: this.loadingCount,
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100
    };
  }

  /**
   * Clear cache and free memory with improved cleanup
   */
  clearCache() {
    // Revoke object URLs to free memory
    for (const objectUrl of this.cache.values()) {
      if (typeof objectUrl === 'string' && objectUrl.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrl);
      }
    }
    
    this.cache.clear();
    this.loadingPromises.clear();
    this.failedUrls.clear(); // Clear failed URLs to allow retry
    this.retryDelays.clear(); // Clear retry delays
    
    // Reset stats
    this.cacheStats = {
      hits: 0,
      misses: 0,
      preloaded: 0,
      failed: 0
    };
    
    console.log('Cache cleared completely (including failed URLs)');
  }

  /**
   * Clear only failed URLs to allow retry without clearing successful cache
   */
  clearFailedUrls() {
    const failedCount = this.failedUrls.size;
    this.failedUrls.clear();
    this.retryDelays.clear();
    console.log(`Cleared ${failedCount} failed URLs - they can now be retried`);
    return failedCount;
  }

  /**
   * Get detailed cache statistics including failure information
   */
  getDetailedStats() {
    const basicStats = this.getStats();
    return {
      ...basicStats,
      failedUrls: this.failedUrls.size,
      retryDelays: this.retryDelays.size,
      loadingPromises: this.loadingPromises.size,
      isPreloading: this.isPreloading
    };
  }
}

// Global cache instance
const imageCache = new MRIImageCache();

// Real MRI images loaded from server
let realMRIImages = null;

/**
 * Load real MRI images from JSON file
 */
async function loadRealMRIImages() {
  if (!realMRIImages) {
    try {
      const response = await fetch('realMRIImages.json');
      const data = await response.json();
      realMRIImages = data.mri_images;
      console.log('Real MRI images loaded successfully');
      console.log(`Total images: Axial=${realMRIImages.axial.length}, Sagittal=${realMRIImages.sagittal.length}, Coronal=${realMRIImages.coronal.length}`);
      
      // Start preloading images in background
      setTimeout(() => {
        console.log('🚀 Starting background preloading...');
        imageCache.preloadImages(realMRIImages);
      }, 1000); // Start after 1 second to not block initial UI
      
    } catch (error) {
      console.error('Failed to load real MRI images:', error);
      throw error;
    }
  }
  return realMRIImages;
}

/**
 * Update viewport image using cached real MRI images with improved performance monitoring
 */
async function updateViewportImage(viewport, sliceNumber) {
  const startTime = performance.now();
  console.log(`Updating ${viewport} viewport to slice ${sliceNumber}`);
  
  const imageElement = document.getElementById(`${viewport}-image`);
  if (!imageElement) {
    console.warn(`Image element not found for ${viewport}`);
    return;
  }
  
  try {
    // Load real MRI images if not already loaded
    if (!realMRIImages) {
      console.log('Loading real MRI images...');
      await loadRealMRIImages();
    }
    
    // Use cached images for instant loading
    if (realMRIImages && realMRIImages[viewport] && realMRIImages[viewport][sliceNumber]) {
      const imageUrl = realMRIImages[viewport][sliceNumber];
      const cachedImageUrl = await imageCache.getImage(viewport, sliceNumber, imageUrl);
      
      imageElement.src = cachedImageUrl;
      imageElement.alt = `${viewport} view - slice ${sliceNumber + 1} of 21`;
      
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      // Log performance for slow loads
      if (loadTime > 100) {
        console.warn(`Slow image load: ${viewport} slice ${sliceNumber} took ${loadTime.toFixed(2)}ms`);
      }
      
      // Log cache performance periodically
      if (Math.random() < 0.05) { // 5% of the time
        const stats = imageCache.getStats();
        console.log(`Cache performance: ${stats.hitRate.toFixed(1)}% hit rate, ${stats.cacheSize}/63 images cached, ${loadTime.toFixed(2)}ms load time`);
      }
    } else {
      console.warn(`No image found for ${viewport} slice ${sliceNumber}`);
      // Set a placeholder or error image
      imageElement.alt = `${viewport} view - slice ${sliceNumber + 1} (not available)`;
    }
  } catch (error) {
    console.error('Error updating viewport image:', error);
    // Fallback to dummy images if available
    if (window.dummyImages && window.dummyImages[viewport]) {
      imageElement.src = window.dummyImages[viewport][sliceNumber];
      imageElement.alt = `${viewport} view - slice ${sliceNumber + 1} (fallback)`;
    } else {
      imageElement.alt = `${viewport} view - slice ${sliceNumber + 1} (error)`;
    }
  }
}

// Example usage and initialization
async function initializeMRIViewer() {
  try {
    // Load correlation data (both mathematical coefficients and lookup tables)
    const [coeffResponse, lookupResponse] = await Promise.all([
      fetch('correlationTables.json'),
      fetch('correlationLookupTables.json')
    ]);
    
    const correlationData = await coeffResponse.json();
    const lookupData = await lookupResponse.json();
    
    // Merge the data
    const combinedData = {
      ...correlationData,
      ...lookupData
    };
    
    // Create viewport manager
    const viewportManager = new MRIViewportManager(combinedData);
    
    // Add listener for viewport updates
    viewportManager.addListener(async (changes, currentSlices) => {
      console.log('Slice changes:', changes);
      console.log('Current slices:', currentSlices);
      
      // Update UI for each changed viewport
      for (const viewport of Object.keys(changes)) {
        if (typeof updateViewportDisplay === 'function') {
          await updateViewportDisplay(viewport, currentSlices[viewport]);
        } else {
          await updateViewportImage(viewport, currentSlices[viewport]);
        }
      }
    });

    return viewportManager;
  } catch (error) {
    console.error('Failed to initialize MRI viewer:', error);
    throw error;
  }
}

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MRIViewportManager, initializeMRIViewer, loadRealMRIImages, updateViewportImage, MRIImageCache };
} else {
  window.MRIViewportManager = MRIViewportManager;
  window.initializeMRIViewer = initializeMRIViewer;
  window.loadRealMRIImages = loadRealMRIImages;
  window.updateViewportImage = updateViewportImage;
  window.MRIImageCache = MRIImageCache;
  window.imageCache = imageCache;
  
  // Expose realMRIImages globally for debugging
  window.getRealMRIImages = () => realMRIImages;
  Object.defineProperty(window, 'realMRIImages', {
    get: () => realMRIImages,
    set: (value) => { realMRIImages = value; }
  });
} 