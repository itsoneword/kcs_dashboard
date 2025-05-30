# Excel Parser Testing Guide

## Overview

Before implementing the full Excel import feature in the KCS Portal UI, we can test the parsing logic independently using the standalone test script. The parser now handles the specific KCS evaluation Excel format.

## Setup

1. **Install dependencies** (already done):
   ```bash
   cd kcs-portal/backend
   npm install xlsx
   ```

2. **Prepare your Excel file** with KCS evaluation data

## Testing the Parser

### Basic Usage
```bash
node test-excel-parser.js path/to/your/excel/file.xlsx
```

### Example Output
The parser will:
- 📊 Display file parsing progress
- ⏭️ Skip summary sheet (first) and empty "Engineer X" sheets  
- 👤 Process each engineer sheet
- 📋 Extract coach name and metadata
- 🗓️ Find quarter boundaries (Q1, Q2, Q3, Q4)
- 📎 Parse cases with all evaluation parameters
- 💾 Save detailed results to `parsing-results.json`

## Excel File Structure (Now Supported)

The parser now handles your specific format:

### File Organization
- **Sheet 1**: Summary (automatically skipped)
- **Other Sheets**: Engineer names (one engineer per sheet)
- **Empty Sheets**: "Engineer X" format (automatically skipped)

### Sheet Structure
```
Row 1: A1=Quarter, D1=Engineer Name (optional), H1=Coach Name (optional)
Row 2: Parameters in C2-I2 (KB Potential, Article Linked, etc.)
Row 3+: Case data organized by quarters

Column Layout:
A: Quarter markers (Q1, Q2, Q3, Q4)
B: Case numbers (only rows with numbers are processed)
C-I: Evaluation parameters (boolean values)
J: Month (Jan, Feb, Mar, etc.)
K: Notes from coach
```

### Supported Data Formats
- **Boolean values**: true/false, 1/0, yes/no, y/n
- **Months**: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec
- **Quarters**: Q1, Q2, Q3, Q4 (case insensitive)

## Example Test Output

```bash
📊 Parsing Excel file: evaluations.xlsx
📋 Found 5 sheets: Summary, John Smith, Jane Doe, Engineer 1, Sarah Johnson
   ⏭️  Skipping first sheet (summary): Summary
   ⏭️  Skipping empty engineer sheet: Engineer 1
👤 Processing 3 engineer sheets

👤 Processing engineer sheet: John Smith
   👨‍💼 Coach found in H1: Mike Wilson
   📋 Metadata: { coach_name: 'Mike Wilson', engineer_name: 'John Smith' }
   📊 Parameters: ['KB Potential', 'Article Linked', 'Article Improved', ...]
   🗓️  Quarters found: Q1 (rows 2-15), Q2 (rows 16-28), Q3 (rows 29-41)
   📋 Found 8 cases in Q1
   📋 Found 6 cases in Q2
     📎 Case 12345: Jan, 7 params
     📎 Case 12346: Jan, 7 params
     ...

📊 PARSING SUMMARY
==================================================
👥 Engineers found: 3
👨‍💼 Coach: Mike Wilson
📋 Total cases: 24
🗓️  Quarters: Q1, Q2, Q3
⚠️  Conflicts detected: 0
❌ Errors: 0
   👤 John Smith: 14 cases across 3 quarters
   👤 Jane Doe: 10 cases across 2 quarters
   👤 Sarah Johnson: 0 cases across 0 quarters

✅ Validation: PASSED
⚠️  Warnings: 2
   • Missing month for case 12350 (Jane Doe)
   • Missing month for case 12351 (Jane Doe)

💾 Results saved to: parsing-results.json
```

## Parsed Data Structure

The parser generates this JSON structure:
```json
{
  "engineers": [
    {
      "name": "John Smith",
      "coach_name": "Mike Wilson",
      "evaluations": [
        {
          "quarter": "Q1",
          "cases": [
            {
              "case_number": 12345,
              "quarter": "Q1",
              "month": "Jan",
              "notes": "Great improvement in documentation",
              "parameters": {
                "KB Potential": true,
                "Article Linked": false,
                "Article Improved": true,
                "Improvement Opportunity": false,
                "Article Created": true,
                "Create Opportunity": false,
                "Relevant Link": true
              }
            }
          ]
        }
      ]
    }
  ],
  "metadata": {
    "coach_name": "Mike Wilson",
    "total_cases": 24,
    "quarters_found": ["Q1", "Q2", "Q3"]
  },
  "conflicts": [],
  "errors": []
}
```

## Validation Features

- ✅ **File format** validation (.xlsx, .xls, .xlsm)
- ✅ **Sheet filtering** (skips summary and empty sheets)
- ✅ **Quarter detection** (finds Q1-Q4 markers)
- ✅ **Case number validation** (only processes rows with numeric case IDs)
- ✅ **Boolean parsing** (handles various true/false formats)
- ✅ **Missing data warnings** (reports missing months, case numbers)
- ✅ **Coach consistency** (extracts coach name globally)

## Testing Commands

```bash
# Test with your evaluation file
node test-excel-parser.js my-evaluations.xlsx

# Check detailed results
cat parsing-results.json | jq '.'

# Test error handling
node test-excel-parser.js nonexistent-file.xlsx

# Test with different formats
node test-excel-parser.js old-format.xls
node test-excel-parser.js macro-enabled.xlsm
```

## Next Steps for Implementation

1. ✅ **Parser Logic** - Complete and tested
2. ✅ **Data Validation** - Implemented with warnings
3. ✅ **Error Handling** - Graceful failure handling
4. ⏳ **API Integration** - Add to backend routes (/api/evaluations/import)
5. ⏳ **Conflict Detection** - Check against existing data
6. ⏳ **Role-based Import** - Coach vs Admin logic
7. ⏳ **UI Implementation** - Import button + preview modal

## Troubleshooting

**Common Issues:**
- **No cases found**: Check that column B contains numeric case numbers
- **Missing parameters**: Verify C2-I2 contains parameter headers
- **Quarter not detected**: Ensure column A has Q1, Q2, Q3, Q4 markers
- **Boolean parsing issues**: Check that values are true/false, 1/0, or yes/no

**Debug Tips:**
- Check `parsing-results.json` for detailed structure analysis
- Look for validation warnings about missing data
- Verify sheet names don't match "Engineer X" pattern

## Information Needed

To complete the parser implementation, please provide:

### 1. **File Structure Details**
- How are engineers identified? (sheet names, columns, sections?)
- How are quarters organized? (Q1, Q2, Q3, Q4 layout)
- How are months arranged within quarters?

### 2. **Data Mapping**
- Where are the 7 evaluation criteria stored?
  - KB Potential
  - Article Linked
  - Article Improved
  - Improvement Opportunity
  - Article Created
  - Create Opportunity
  - Relevant Link
- How are boolean values represented? (Y/N, 1/0, TRUE/FALSE, checkboxes?)
- Where are case IDs stored?
- Where are notes/comments stored?

### 3. **Sample Data**
Please provide either:
- **Option A**: A real Excel file (anonymized/dummy data)
- **Option B**: Screenshots of the Excel structure
- **Option C**: Detailed description like:
  ```
  Column A: Case ID
  Column B: KB Potential (Y/N)
  Column C: Article Linked (Y/N)
  ...
  Row 1: Headers
  Row 2-8: Cases for January
  Row 9-15: Cases for February
  ```

## Next Steps

Once we understand the Excel structure:

1. ✅ **Test Parser** - Update `parseEvaluationData()` method
2. ✅ **Validate Logic** - Run against sample files
3. ✅ **Handle Edge Cases** - Empty cells, mixed formats, etc.
4. ✅ **Conflict Detection** - Check for duplicate engineers/dates
5. ✅ **API Integration** - Add to backend routes
6. ✅ **UI Implementation** - Add import button to frontend

## Testing Commands

```bash
# Test with sample file
node test-excel-parser.js sample-evaluations.xlsx

# Check results
cat parsing-results.json

# Test error handling
node test-excel-parser.js nonexistent-file.xlsx
```

## Current Parser Features

- ✅ File format validation (.xlsx, .xls, .xlsm)
- ✅ Sheet detection and processing
- ✅ Data structure inspection
- ✅ Error handling and logging
- ✅ Results export to JSON
- ⏳ **Needs Implementation**: Actual data parsing logic
- ⏳ **Needs Implementation**: Validation rules
- ⏳ **Needs Implementation**: Conflict detection 