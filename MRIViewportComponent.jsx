import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MRIViewportManager } from './mriViewportManager';
import correlationData from './correlationTables.json';

// Styles for React Native (modify for web as needed)
const styles = {
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  viewportsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  viewport: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 15,
    margin: 10,
    alignItems: 'center',
    minWidth: 300,
  },
  viewportTitle: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  imageContainer: {
    position: 'relative',
    borderWidth: 2,
    borderColor: '#444',
    borderRadius: 4,
    overflow: 'hidden',
  },
  mriImage: {
    width: 300,
    height: 300,
    backgroundColor: '#333',
  },
  crosshair: {
    position: 'absolute',
    width: 2,
    height: 2,
    backgroundColor: '#00ff00',
    opacity: 0.8,
    pointerEvents: 'none',
  },
  crosshairH: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#00ff00',
    opacity: 0.8,
    pointerEvents: 'none',
  },
  crosshairV: {
    position: 'absolute',
    width: 1,
    backgroundColor: '#00ff00',
    opacity: 0.8,
    pointerEvents: 'none',
  },
  sliceInfo: {
    marginTop: 10,
    color: '#ccc',
    fontSize: 14,
  },
  currentSlice: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 4,
    marginHorizontal: 5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  status: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 10,
    borderRadius: 4,
    maxWidth: 300,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
  },
  coordinates: {
    color: '#ffeb3b',
    fontSize: 12,
    fontFamily: 'monospace',
  },
};

const MRIViewportComponent = () => {
  const [viewportManager, setViewportManager] = useState(null);
  const [currentSlices, setCurrentSlices] = useState({
    axial: 0,
    sagittal: 0,
    coronal: 0,
  });
  const [showCrosshairs, setShowCrosshairs] = useState(false);
  const [crosshairPositions, setCrosshairPositions] = useState({
    axial: { x: 0, y: 0 },
    sagittal: { x: 0, y: 0 },
    coronal: { x: 0, y: 0 },
  });
  const [statusText, setStatusText] = useState('Loading...');
  const [clickCoordinates, setClickCoordinates] = useState('');

  const imageRefs = useRef({
    axial: null,
    sagittal: null,
    coronal: null,
  });

  // Initialize viewport manager
  useEffect(() => {
    const initializeManager = async () => {
      try {
        const manager = new MRIViewportManager(correlationData);
        
        // Add listener for slice changes
        manager.addListener((changes, newSlices) => {
          console.log('Slice changes:', changes);
          setCurrentSlices({ ...newSlices });
        });

        // Initialize with center slices
        manager.setSlice('axial', 10);
        manager.setSlice('sagittal', 10);
        manager.setSlice('coronal', 15);

        setViewportManager(manager);
        setStatusText('Ready - Tap on any image');
        
      } catch (error) {
        console.error('Failed to initialize viewport manager:', error);
        setStatusText('Error loading viewer');
      }
    };

    initializeManager();
  }, []);

  // Handle image press/click
  const handleImagePress = useCallback((viewport, event) => {
    if (!viewportManager) return;

    // Get touch/click coordinates
    const { locationX, locationY, target } = event.nativeEvent || event;
    
    // For web, use different coordinate extraction
    let x, y, width, height;
    
    if (event.nativeEvent && event.nativeEvent.locationX !== undefined) {
      // React Native
      x = locationX;
      y = locationY;
      width = 300; // Fixed width from styles
      height = 300; // Fixed height from styles
    } else {
      // Web
      const rect = event.target.getBoundingClientRect();
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
      width = rect.width;
      height = rect.height;
    }

    // Update coordinates display with flipped Y-axis
    const xPercent = ((x / width) * 100).toFixed(1);
    const yPercentFlipped = (((height - y) / height) * 100).toFixed(1);
    setClickCoordinates(
      `Tap: ${viewport} (${x.toFixed(0)}, ${y.toFixed(0)}) = ${xPercent}%, ${yPercentFlipped}% (Y-flipped)`
    );

    // Handle viewport correlation
    viewportManager.handleViewportClick(viewport, x, y, width, height);

    // Update crosshair position
    if (showCrosshairs) {
      setCrosshairPositions(prev => ({
        ...prev,
        [viewport]: { x, y }
      }));
    }
  }, [viewportManager, showCrosshairs]);

  // Reset viewer to center
  const resetViewer = useCallback(() => {
    if (viewportManager) {
      viewportManager.setSlice('axial', 10);
      viewportManager.setSlice('sagittal', 10);
      viewportManager.setSlice('coronal', 15);
      setClickCoordinates('');
    }
  }, [viewportManager]);

  // Toggle crosshairs
  const toggleCrosshairs = useCallback(() => {
    setShowCrosshairs(prev => !prev);
  }, []);

  // Render viewport
  const renderViewport = (viewport) => {
    const crosshairPos = crosshairPositions[viewport];
    
    return (
      <div key={viewport} style={styles.viewport}>
        <h3 style={styles.viewportTitle}>
          {viewport.charAt(0).toUpperCase() + viewport.slice(1)} View
        </h3>
        
        <div style={styles.imageContainer}>
          <img
            ref={ref => imageRefs.current[viewport] = ref}
            style={styles.mriImage}
            src={`images/${viewport}/slice_${currentSlices[viewport].toString().padStart(3, '0')}.jpg`}
            alt={`${viewport} MRI slice ${currentSlices[viewport]}`}
            onClick={(e) => handleImagePress(viewport, e)}
            onError={(e) => {
              // Fallback for missing images
              e.target.style.backgroundColor = '#333';
              e.target.style.backgroundImage = `
                linear-gradient(45deg, #333 25%, transparent 25%), 
                linear-gradient(-45deg, #333 25%, transparent 25%), 
                linear-gradient(45deg, transparent 75%, #333 75%), 
                linear-gradient(-45deg, transparent 75%, #333 75%)
              `;
              e.target.style.backgroundSize = '20px 20px';
            }}
          />
          
          {showCrosshairs && (
            <>
              <div
                style={{
                  ...styles.crosshairH,
                  left: 0,
                  right: 0,
                  top: crosshairPos.y,
                }}
              />
              <div
                style={{
                  ...styles.crosshairV,
                  top: 0,
                  bottom: 0,
                  left: crosshairPos.x,
                }}
              />
            </>
          )}
        </div>
        
        <div style={styles.sliceInfo}>
          Slice: <span style={styles.currentSlice}>{currentSlices[viewport]}</span> / 20
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Correlated MRI Shoulder Viewer</h1>
      <p style={styles.subtitle}>Tap on any image to see correlated slices in other viewports</p>
      
      <div style={styles.controls}>
        <button style={styles.button} onClick={resetViewer}>
          <span style={styles.buttonText}>Reset to Center</span>
        </button>
        <button style={styles.button} onClick={toggleCrosshairs}>
          <span style={styles.buttonText}>Toggle Crosshairs</span>
        </button>
      </div>
      
      <div style={styles.viewportsContainer}>
        {renderViewport('axial')}
        {renderViewport('sagittal')}
        {renderViewport('coronal')}
      </div>
      
      <div style={styles.status}>
        <div style={styles.statusText}>Status: {statusText}</div>
        <div style={styles.coordinates}>{clickCoordinates}</div>
      </div>
    </div>
  );
};

export default MRIViewportComponent;

// React Native specific component (alternative version)
export const MRIViewportComponentRN = () => {
  // Similar implementation but using React Native components
  // TouchableOpacity, Image, View, Text, etc.
  // This would need to be adapted for React Native's touch handling
  
  return (
    // React Native implementation here
    null
  );
}; 