# MRI Cross-Sectional Viewer Requirements

## Overview
A web-based MRI viewer that displays three orthogonal views (sagittal, axial, coronal) with cross-sectional navigation functionality. When a user clicks on any viewport, the corresponding slices in the other two viewports are automatically calculated and updated.

## Core Formula
The slice calculation follows this exact formula:
```
Slice number = a * y + b * x - c
```

Where:
- `x` = horizontal coordinate (0 to 1)
- `y` = vertical coordinate (0 to 1)
- `a`, `b`, `c` = correlation coefficients specific to each viewport interaction

## Coordinate System
- **Input coordinates**: Raw click coordinates (0 to 300 range)
- **Normalized coordinates**: Divide raw coordinates by 300 to get 0-1 range
- **Slice numbers**: Start from 0 and round to nearest integer

## Viewport Layout
- **Left viewport (1)**: Sagittal images
- **Middle viewport (2)**: Axial images  
- **Right viewport (3)**: Coronal images

## Cross-Sectional Correlation Table (Shoulder)
| Interaction | Description | a | b | c |
|-------------|-------------|---|---|---|
| Ssag(Ax) | Click in Axial → Calculate Sagittal slice | -11.68 | 19.22 | -4.08 |
| Ssag(Cor) | Click in Coronal → Calculate Sagittal slice | -1.26 | 25.88 | 3.01 |
| Sax(Sag) | Click in Sagittal → Calculate Axial slice | -30.71 | -0.67 | -26.41 |
| Sax(Cor) | Click in Coronal → Calculate Axial slice | -34.74 | 0.00 | -29.48 |
| Scor(Sag) | Click in Sagittal → Calculate Coronal slice | 0.00 | 24.29 | 1.71 |
| Scor(Ax) | Click in Axial → Calculate Coronal slice | -25.50 | -13.81 | -30.49 |

## Image Data
- **Source**: Real MRI images from S3 bucket (realMRIImages.json)
- **JSON Structure**: `vp1`, `vp2`, `vp3` with image objects containing `viewport`, `image`, `order` properties
- **Total slices per view**: 21 slices (indexed 0-20)
- **Format**: JPEG images
- **Viewport mapping**: vp1=Sagittal(Left), vp2=Axial(Middle), vp3=Coronal(Right)

## Functional Requirements

### F1: Multi-Viewport Display
- Display three viewports side by side
- Each viewport shows one MRI slice
- Initial display shows slice 0 for all viewports

### F2: Cross-Sectional Navigation
- Click on any viewport triggers slice calculation for other two viewports
- Use correlation table to determine which formula to apply
- Update corresponding viewports with calculated slice numbers

### F3: Coordinate Processing
- Capture mouse click coordinates within viewport
- Normalize coordinates to 0-1 range (divide by viewport dimensions)
- Apply exact formula: `Slice number = a * y + b * x - c`
- Round result to nearest integer

### F4: Slice Bounds Validation
- Ensure calculated slice numbers are within valid range (0-20)
- Clamp values if they exceed bounds

### F5: Visual Feedback
- Show current slice number for each viewport
- Display click coordinates (for debugging)
- Highlight active viewport during interaction

## Technical Requirements

### T1: Framework
- HTML5 Canvas or modern web technologies
- Responsive design for different screen sizes

### T2: Image Loading
- Efficient loading of MRI images from URLs
- Caching mechanism for performance
- Error handling for failed image loads

### T3: Performance
- Smooth navigation between slices
- Minimal delay when switching views
- Efficient memory usage

### T4: Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile device support

## Implementation Notes

### Viewport Mapping
```javascript
const VIEWPORTS = {
  1: 'sagittal',  // Left
  2: 'axial',     // Middle  
  3: 'coronal'    // Right
};
```

### Correlation Coefficients
```javascript
const SHOULDER_COEFFICIENTS = {
  'axial_to_sagittal': { a: -11.68, b: 19.22, c: -4.08 },
  'coronal_to_sagittal': { a: -1.26, b: 25.88, c: 3.01 },
  'sagittal_to_axial': { a: -30.71, b: -0.67, c: -26.41 },
  'coronal_to_axial': { a: -34.74, b: 0.00, c: -29.48 },
  'sagittal_to_coronal': { a: 0.00, b: 24.29, c: 1.71 },
  'axial_to_coronal': { a: -25.50, b: -13.81, c: -30.49 }
};
```

### Slice Calculation Function
```javascript
function calculateSlice(x, y, coefficients) {
  const normalizedX = x / 300; // or viewport width
  const normalizedY = y / 300; // or viewport height
  const slice = coefficients.a * normalizedY + coefficients.b * normalizedX - coefficients.c;
  return Math.round(Math.max(0, Math.min(20, slice)));
}
```

## Validation Criteria
1. ✅ Formula implementation matches exactly: `a * y + b * x - c`
2. ✅ Coordinates normalized to 0-1 range
3. ✅ Correlation table values used precisely as specified
4. ✅ Viewport layout: sagittal (left), axial (middle), coronal (right)
5. ✅ Real MRI images loaded from provided URLs
6. ✅ Slice numbers start from 0 and are rounded to integers
7. ✅ Cross-sectional navigation works bidirectionally between all viewports 