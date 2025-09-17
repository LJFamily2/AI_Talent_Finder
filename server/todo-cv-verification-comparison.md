# CV Verification Comparison Todo List

## Objective

Compare all CV verification approaches (Traditional, Gemini, Claude, ChatGPT, Grok) over a representative sample of CVs in the data folders to identify the most effective method.

## Metrics to Evaluate

### Performance Metrics

- **Speed/Time Efficiency**
  - Total processing time per CV
  - Time per publication verification
  - Time for name extraction
  - Time for publication extraction

### Accuracy Metrics

- **Publication Detection Accuracy**
  - Number of publications detected vs. ground truth (if available)
  - Precision/recall of publication extraction
- **Verification Accuracy**
  - Percentage of publications correctly verified as existing
  - Percentage of publications correctly verified with author match
  - False positive rate (incorrectly verified)
  - False negative rate (incorrectly rejected)

### Robustness Metrics

- **CV Format Handling**
  - Performance across different CV layouts/formats
  - Performance with non-standard publication sections
- **Resilience**
  - Error handling and recovery
  - Completion rate (percentage of CVs processed without errors)

### Output Quality Metrics

- **Data Enrichment**
  - Additional metadata provided (citations, links, co-authors)
  - Quality of extracted links
- **Consistency**
  - Variance in results across similar CVs
  - Internal consistency (similar publications handled similarly)

### Resource Usage Metrics

- **API Cost**
  - Number of API calls made
  - Estimated API cost per CV
  - Token usage

## Implementation Tasks

1. Create a test harness JavaScript file to:

   - Process a representative sample of CVs through each verification method
   - Collect and store timing and performance data
   - Handle rate limits and add appropriate waiting periods
   - Generate CSV/JSON outputs for visualization

2. Define ground truth for a subset of CVs (manually if necessary)

   - List of actual publications with verified status
   - Correct author information

3. Implement metrics collection in the test harness:

   - Add timing wrappers around key functions
   - Add counters for API calls
   - Add verification result storage

4. Add visualization export (for Excel/spreadsheet import)

   - Format data in CSV format
   - Generate summary statistics

5. Run comparison across all approaches
   - Ensure fair comparison (same CVs, same environment)
   - Document any limitations or special considerations

## Rate Limiting Considerations

- Add exponential backoff for API rate limits
- Consider running tests in batches over time
- Implement a queue system to manage API access
- Store intermediate results to avoid reprocessing on failure

## Timeline

- Setup test harness: [DATE]
- Define ground truth data: [DATE]
- Implement metrics collection: [DATE]
- Run tests: [DATE]
- Analyze results: [DATE]
- Present findings: [DATE]
