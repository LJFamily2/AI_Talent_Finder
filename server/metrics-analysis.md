# CV Verification Metrics Analysis

This document outlines the key metrics we should focus on when comparing different CV verification approaches.

## Primary Metrics for Comparison

### 1. Speed/Performance

- **Total Processing Time**: How long it takes to process a complete CV

  - Measured in seconds
  - Lower is better
  - Important for user experience and throughput

- **Time per Publication**: Average time to verify each publication

  - Derived by dividing total time by number of publications
  - Normalizes for CVs with different numbers of publications

- **Scalability**: How performance scales with CV size/complexity
  - Measured by plotting processing time against CV size or publication count
  - Important for handling large academic CVs

### 2. Accuracy

- **Verification Rate**: Percentage of publications successfully verified

  - Higher may be better, but must be validated against ground truth
  - Different methods may have different thresholds for verification

- **Precision**: Of publications marked as verified, what percentage are actually verifiable

  - Requires ground truth data
  - False positives are problematic (incorrectly saying a publication exists)

- **Recall**: Of all verifiable publications, what percentage were correctly verified

  - Requires ground truth data
  - False negatives are problematic (missing real publications)

- **F1 Score**: Combined metric of precision and recall
  - Best overall accuracy metric when we have ground truth

### 3. Quality of Results

- **Link Provision Rate**: Percentage of publications with valid links

  - Higher is better
  - Links are valuable for manual verification

- **Citation Count Availability**: Percentage of publications with citation counts

  - Higher is better
  - Important for academic evaluation

- **Metadata Richness**: Availability of year, venue, DOI, etc.
  - Measured by counting available metadata fields
  - Richer metadata is more useful

### 4. Robustness

- **Error Rate**: Percentage of CVs that cause errors or failures

  - Lower is better
  - Important for production reliability

- **Format Handling**: Performance across different CV formats and structures
  - Measured by variance in metrics across different CV styles
  - Lower variance indicates better robustness

### 5. Cost and Resource Usage

- **API Calls**: Number of API calls made per CV

  - Lower is better
  - Direct impact on operating costs

- **Token Usage**: For LLM-based methods, tokens consumed
  - Lower is better
  - Direct impact on API costs

## Visualization Approaches

For effective comparison in Excel or other visualization tools:

1. **Bar Charts**:

   - Compare primary metrics across methods
   - Good for speed, accuracy, and quality metrics

2. **Spider/Radar Charts**:

   - Compare multiple metrics in a single visualization
   - Good for seeing overall strengths/weaknesses

3. **Scatter Plots**:

   - Plot speed vs. accuracy
   - Identify optimal methods based on both criteria

4. **Box Plots**:

   - Show variance in performance across CVs
   - Identify methods with consistent performance

5. **Stacked Bar Charts**:
   - Show verification outcomes (verified, not verified, etc.)
   - Compare distribution of outcomes across methods

## Recommended Focus

When presenting results, we recommend focusing on:

1. **Speed vs. Accuracy Tradeoff**:

   - Plot processing time against F1 score
   - Identify methods with best balance

2. **Cost-Effectiveness**:

   - Calculate cost per CV based on API usage
   - Compare with accuracy to find most cost-effective method

3. **Robustness Across CV Types**:

   - Group CVs by size/complexity
   - Compare method performance across groups

4. **Quality of Metadata**:
   - Compare methods on link provision and metadata richness
   - Important for practical usability

## Setting Up a Good Baseline

To ensure fair comparison:

1. **Representative CV Sample**:

   - Include different sizes (small, medium, large)
   - Include different academic fields
   - Include different formatting styles

2. **Controlled Testing Environment**:

   - Run tests on same hardware
   - Use same timeout settings
   - Test during similar API load conditions

3. **Manual Ground Truth Verification**:
   - Have human experts verify a subset of publications
   - Essential for meaningful accuracy metrics
