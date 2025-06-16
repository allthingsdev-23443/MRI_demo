# MRI Cross-Sectional Viewer

A web-based MRI viewer that implements precise cross-sectional navigation using the exact formula and correlation coefficients for shoulder anatomy.

## 🎯 Key Features

- **Exact Formula Implementation**: `Slice number = a * y + b * x - c`
- **Real MRI Images**: Uses actual MRI anatomy images from S3 bucket
- **Cross-Sectional Navigation**: Click any viewport to update other two viewports
- **Manual Slice Navigation**: Scroll mouse wheel or use arrow keys to navigate through slices
- **Precise Coordinate Mapping**: Normalizes click coordinates to 0-1 range
- **Responsive Design**: Works on desktop and mobile devices

## 📊 Viewport Layout

- **Left (Viewport 1)**: Sagittal view
- **Middle (Viewport 2)**: Axial view  
- **Right (Viewport 3)**: Coronal view

## 🧮 Correlation Table (Shoulder)

| Click in → Calculate | Abbreviation | a | b | c |
|---------------------|--------------|---|---|---|
| Axial → Sagittal | Ssag(Ax) | -11.68 | 19.22 | -4.08 |
| Coronal → Sagittal | Ssag(Cor) | -1.26 | 25.88 | 3.01 |
| Sagittal → Axial | Sax(Sag) | -30.71 | -0.67 | -26.41 |
| Coronal → Axial | Sax(Cor) | -34.74 | 0.00 | -29.48 |
| Sagittal → Coronal | Scor(Sag) | 0.00 | 24.29 | 1.71 |
| Axial → Coronal | Scor(Ax) | -25.50 | -13.81 | -30.49 |

## 🚀 Quick Start

1. **Start the server**:
   ```bash
   python3 server.py
   ```

2. **Open your browser**:
   ```
   http://localhost:8000
   ```

3. **Test navigation methods**:
   - **Cross-sectional**: Click anywhere on any viewport to update other two viewports
   - **Manual scroll**: Hover over a viewport and scroll mouse wheel to navigate slices
   - **Keyboard**: Click a viewport to focus it, then use arrow keys to navigate
   - Observe the debug information showing exact calculations

## 📐 Formula Implementation

The core calculation follows this exact pattern:

```javascript
function calculateSlice(x, y, coefficients) {
    // x, y are normalized coordinates (0-1)
    const slice = coefficients.a * y + coefficients.b * x - coefficients.c;
    return Math.round(Math.max(0, Math.min(20, slice)));
}
```

## 🎮 Navigation Methods

### Cross-Sectional Navigation
- **Purpose**: Anatomically correlated slice selection
- **Method**: Click anywhere on any viewport
- **Result**: Other two viewports update using correlation coefficients
- **Formula**: `Slice number = a * y + b * x - c`

### Manual Slice Navigation
- **Mouse Wheel**: Hover over any viewport and scroll to navigate slices
- **Keyboard**: Click viewport to focus → Use arrow keys (↑↓ or ←→)
- **Range**: All slices 0-20 available independently
- **Visual Feedback**: Active viewport highlighting and debug info

## 🔍 Coordinate System

- **Raw coordinates**: Click position in pixels
- **Normalized coordinates**: Divided by canvas dimensions (0-1 range)
- **Slice calculation**: Applied to exact formula with correlation coefficients
- **Result**: Rounded to nearest integer, clamped to 0-20 range

## 📁 File Structure

```
├── index.html          # Main HTML structure
├── style.css           # Styling and responsive design
├── mri-viewer.js       # Core JavaScript implementation
├── realMRIImages.json  # Real MRI image data (vp1, vp2, vp3 structure)
├── server.py           # Development server
├── REQUIREMENTS.md     # Detailed requirements document
└── README.md           # This file
```

## 🎛️ Debug Information

The viewer displays:
- Real-time click coordinates (raw and normalized)
- Last calculation details with exact values
- Current slice numbers for all viewports
- Active viewport highlighting

## 🔧 Technical Details

### Image Loading
- Real MRI images loaded from S3 URLs
- Image caching for performance
- Error handling for failed loads
- Smooth transitions between slices

### Cross-Sectional Logic
- Precise implementation of correlation table
- Bidirectional navigation between all viewports
- Real-time coordinate processing
- Exact formula validation

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile device support
- CORS-enabled for development

## 📝 Validation Checklist

- ✅ Formula: `Slice number = a * y + b * x - c`
- ✅ Coordinates normalized to 0-1 range
- ✅ Exact correlation coefficients used
- ✅ Viewport layout: Sagittal (left), Axial (middle), Coronal (right)
- ✅ Real MRI images from provided JSON
- ✅ Slice numbers start from 0, rounded to integers
- ✅ Cross-sectional navigation works bidirectionally

## 🧪 Testing

1. **Click different positions**: Verify different coordinates produce different slice calculations
2. **Test all viewports**: Ensure clicking each viewport updates the other two correctly
3. **Check edge cases**: Click corners and edges to test boundary conditions
4. **Verify calculations**: Compare debug output with manual calculations

## 📊 Example Calculation

For a click at normalized coordinates (0.5, 0.3) in the axial viewport:

**Ssag(Ax)**: `-11.68 * 0.3 + 19.22 * 0.5 - (-4.08) = 13.594` → **Slice 14**

**Scor(Ax)**: `-25.50 * 0.3 + (-13.81) * 0.5 - (-30.49) = 15.935` → **Slice 16**

This demonstrates the precise mathematical relationship between viewport coordinates and slice selection.




