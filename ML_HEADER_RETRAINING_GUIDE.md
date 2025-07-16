# ML Header Detection - Retraining Guide

## Overview

This guide explains how to add new CV samples and retrain the ML header detection model in the AI Talent Finder project.

## Prerequisites

- Node.js installed
- All project dependencies installed (`npm install`)
- Access to the project's server directory

## Step-by-Step Retraining Process

### Step 1: Add New CV Samples

1. Navigate to the CV training directory:
   ```
   p:\AI Talent Finder\server\data\training\cvs\
   ```
2. Add your new CV PDF files to this directory
3. Ensure PDF files have descriptive names (e.g., `john_doe_cv.pdf`, `jane_smith_resume.pdf`)

### Step 2: Generate Updated Training Data

1. Open terminal/command prompt
2. Navigate to the server utils directory:
   ```bash
   cd "p:\AI Talent Finder\server\utils"
   ```
3. Run the training data generator:
   ```bash
   node trainingDataGenerator.js
   ```
4. This will:
   - Process all PDF files in the `cvs` directory
   - Extract text and generate labeled training examples
   - Update `server/data/training/header_training_data.json`

### Step 3: Retrain the ML Model

1. From the same utils directory, run the model training script:
   ```bash
   node trainHeaderClassifier.js
   ```
2. This will:
   - Load the updated training data
   - Train the SimpleHeaderClassifier
   - Save the new model to `server/models/header_classifier.json`

### Step 4: Verify the Updated Model

1. **Automatic Integration**: The main application will automatically use the new model file
2. **Performance Metrics**: The training process now includes automatic evaluation with:
   - **Accuracy**: Overall correctness of predictions
   - **Precision**: Accuracy of positive predictions (headers)
   - **Recall**: Coverage of actual headers
   - **F1 Score**: Balanced measure of precision and recall
3. **Manual Testing** (optional): You can test the new model by running:
   ```bash
   node -e "const { extractHeadersFromText } = require('./utils/aiHelpers'); const headers = extractHeadersFromText('EDUCATION\\nPhD Computer Science\\nWORK EXPERIENCE\\nSoftware Engineer'); console.log('Headers:', headers.map(h => h.text));"
   ```

### Step 5: Detailed Performance Analysis (Optional)

For comprehensive model evaluation, run the metrics evaluation script:

```bash
cd "p:\AI Talent Finder\server\utils"
node evaluateModelMetrics.js
```

This provides:

- **Cross-validation results** for robust performance estimates
- **Confusion matrix** showing prediction breakdown
- **Misclassification analysis** to identify problem areas
- **Performance comparison** with previous model versions

## File Structure

```
p:\AI Talent Finder\server\
├── data/
│   └── training/
│       ├── cvs/                    # Add new PDF files here
│       └── header_training_data.json # Updated automatically
├── models/
│   └── header_classifier.json      # Updated automatically
└── utils/
    ├── trainingDataGenerator.js    # Step 2 script
    ├── trainHeaderClassifier.js    # Step 3 script
    ├── simpleHeaderClassifier.js   # ML classifier implementation
    └── aiHelpers.js               # Main integration (uses ML automatically)
```

## Important Notes

### Training Performance

- The system processes a subset of training data (typically 500 examples) for optimal performance
- Training typically takes 10-30 seconds depending on data size
- The model is optimized for production use with fast inference

### Model Integration

- The ML model is automatically loaded when `aiHelpers.js` is imported
- If the model file is missing, the system falls back to regex-based detection
- No code changes are needed in your main application

### Git Considerations

- CV files in `data/training/cvs/` are ignored by git (see `.gitignore`)
- Training data and model files are tracked by git
- This ensures the model is available in production while keeping sensitive CV data private

## Quality Assurance

### Validation Checklist

- [ ] New CV files added to `data/training/cvs/`
- [ ] Training data generation completed successfully
- [ ] Model training completed without errors
- [ ] Model file updated with new timestamp
- [ ] **Performance metrics meet quality thresholds:**
  - [ ] Accuracy ≥ 75%
  - [ ] Precision ≥ 70%
  - [ ] Recall ≥ 70%
  - [ ] F1 Score ≥ 70%
- [ ] Main application loads and uses new model

### Expected Improvements

After retraining with more data, you should see:

- Better accuracy on diverse CV formats
- Improved detection of non-standard headers
- Reduced false positives/negatives
- Better handling of edge cases

## Troubleshooting

### Common Issues

1. **PDF parsing errors**: Ensure PDF files are text-based, not scanned images
2. **Memory issues**: If training data is very large, consider processing in smaller batches
3. **Model not loading**: Check file permissions and path correctness
4. **No improvement**: May need more diverse training examples or feature engineering

### Debug Commands

```bash
# Check model file
ls -la server/models/header_classifier.json

# Test model loading
node -e "const { SimpleHeaderClassifier } = require('./utils/simpleHeaderClassifier'); const c = new SimpleHeaderClassifier(); c.load('../models/header_classifier.json'); console.log('Model loaded successfully');"

# Verify training data
node -e "const data = require('../data/training/header_training_data.json'); console.log('Training examples:', data.length);"
```

## Automation Options

### Scheduled Retraining

You can set up automated retraining by:

1. Creating a scheduled task/cron job
2. Monitoring the `cvs` directory for new files
3. Automatically triggering retraining when new files are added

### CI/CD Integration

For production environments:

1. Include retraining scripts in your deployment pipeline
2. Run validation tests after retraining
3. Deploy only if model performance meets thresholds

## Performance Metrics

The ML system provides these benefits over regex-based detection:

- **Higher Recall**: Detects 3x more headers than regex patterns
- **Better Adaptability**: Learns from your specific CV formats
- **Reduced Maintenance**: No need to manually update regex patterns
- **Improved Accuracy**: 80%+ agreement with human judgment

### Current Performance Standards

- **Accuracy**: ≥75% (percentage of correct predictions)
- **Precision**: ≥70% (accuracy of header predictions)
- **Recall**: ≥70% (coverage of actual headers)
- **F1 Score**: ≥70% (balanced precision-recall measure)

### Monitoring Tools

1. **Quick Check**: `node evaluateModelMetrics.js --quick`
2. **Full Evaluation**: `node evaluateModelMetrics.js`
3. **Performance Monitoring**: `node modelPerformanceMonitor.js`

---

_Last updated: July 5, 2025_
