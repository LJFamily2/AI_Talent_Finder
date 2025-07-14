# ML Header Detection Model Update Guide

This guide explains how to add new CV samples and retrain the machine learning (ML) header detection model for the AI Talent Finder project.

---

## 1. Add New CV Samples

- Place new CV PDF files in:
  ```
  server/data/training/cvs
  ```
- Create the `cvs` folder if it does not exist.

---

## 2. Generate Updated Training Data

- Run the training data generator script:
  ```bash
  cd server/utils
  node trainingDataGenerator.js
  ```
- This will process all CVs in the `cvs` folder and update:
  - `server/data/training/header_training_data.json`

---

## 3. Retrain the ML Model

- Run the model training script:
  ```bash
  cd server/utils
  node trainHeaderClassifier.js
  ```
- This will retrain the model and save it to:
  - `server/models/header_classifier.json`

---

## 4. (Optional) Test the New Model

- You can test the new model by running your main application or any test scripts you have.
- The application will automatically use the updated model file.

---

## 5. Use the Updated Model

- No code changes are needed.
- The ML header detection will use the new model automatically.

---

## Best Practices

- **Diversity:** Use a variety of CV formats for better model generalization.
- **Quality:** Ensure PDFs are readable and well-formatted.
- **Backup:** Keep a backup of previous model and training data before retraining.
- **Validation:** Test the new model on real CVs to confirm improved or stable performance.

---

## Quick Checklist

- [ ] Add new CV PDFs to `server/data/training/cvs`
- [ ] Run `node trainingDataGenerator.js`
- [ ] Run `node trainHeaderClassifier.js`
- [ ] (Optional) Test the new model
- [ ] Use your application as normal

---

For more details, see:

- `docs/ML_HEADER_DETECTION.md` (system overview)
- `server/utils/trainingDataGenerator.js` (training data script)
- `server/utils/trainHeaderClassifier.js` (model training script)
