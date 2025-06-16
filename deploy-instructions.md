# Deploy MRI Cross-Sectional Viewer to GitHub Pages

## 🚀 Quick Deployment Steps

### 1. **Create GitHub Repository**
```bash
# Initialize git repository
git init

# Add all files
git add .

# Initial commit
git commit -m "Initial commit: MRI Cross-Sectional Viewer"

# Create repository on GitHub and add remote
git remote add origin https://github.com/YOUR_USERNAME/mri-cross-sectional-viewer.git

# Push to GitHub
git push -u origin main
```

### 2. **Enable GitHub Pages**
1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll down to **Pages** section
4. Under **Source**, select **Deploy from a branch**
5. Choose **main** branch and **/ (root)** folder
6. Click **Save**

### 3. **Access Your Deployed App**
Your MRI viewer will be available at:
```
https://YOUR_USERNAME.github.io/mri-cross-sectional-viewer/
```

## 📝 Files Needed for Deployment

✅ **Required files (already created):**
- `index.html` - Main application
- `style.css` - Styling
- `mri-viewer.js` - Core functionality
- `realMRIImages.json` - Image data
- `README.md` - Documentation
- `REQUIREMENTS.md` - Technical specs

❌ **Not needed for GitHub Pages:**
- `server.py` - Local development server
- `node_modules/` - Dependencies

## 🔧 Configuration Notes

### CORS Handling
The app is designed to handle CORS issues automatically:
- First tries loading images with CORS headers
- Falls back to no-CORS if needed
- Includes retry mechanism for failed loads

### Cache Busting
The app includes cache-busting for JSON data:
```javascript
fetch(`./realMRIImages.json?v=${Date.now()}`)
```

## 🌐 Custom Domain (Optional)

To use a custom domain:
1. Add `CNAME` file to repository root:
   ```
   your-domain.com
   ```
2. Configure DNS settings with your domain provider
3. Update GitHub Pages settings to use custom domain

## 🔄 Updates and Maintenance

To update the deployed version:
```bash
# Make changes to your files
git add .
git commit -m "Update: description of changes"
git push origin main
```

GitHub Pages will automatically rebuild and deploy within a few minutes.

## 🧪 Testing Before Deployment

Test locally first:
```bash
python3 server.py
# Open http://localhost:8000
```

## 📊 Performance Tips

- Images are cached automatically
- JSON data includes cache-busting
- Staggered image loading prevents server overload
- Automatic retry for failed images

## 🔍 Troubleshooting

### If images don't load:
1. Check browser console for CORS errors
2. Verify S3 URLs are accessible
3. Check GitHub Pages build status

### If app doesn't load:
1. Ensure `index.html` is in repository root
2. Check GitHub Pages is enabled
3. Verify branch settings in Pages configuration

## 🎯 Ready for Production

Your MRI viewer includes:
- ✅ Cross-sectional navigation with exact formula
- ✅ Manual scroll/keyboard navigation  
- ✅ Real-time image loading counters
- ✅ Error handling and retry mechanisms
- ✅ Responsive design for mobile devices
- ✅ Professional medical imaging interface 