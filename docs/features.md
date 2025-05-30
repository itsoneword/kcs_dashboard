Technical Task: Engineer Reporting Web Application

**Project Goal:**  
The primary objective is to provide an intuitive and efficient reporting interface for leads, focusing on comfort and actionable insights with simplifying usability for coaches as well.

---

## Phase 1: Data Import & Parsing

- Implement a simple import mechanism to parse provided Excel files (sample format attached).
- Validate and map imported data to the application's data model.
- Handle errors and provide user feedback for invalid or incomplete imports.

---

## Phase 2: Reporting Features

### 2.1 Report Generation

- Generate reports for both leads and coaches.
- Each report should:
  - Display assigned engineers.
  - Separate data per engineer.

### 2.2 Dashboards

- Create a general dashboard for leads.
- Create individual dashboards for each engineer.
- Each dashboard should include:
  - Charts visualizing key metrics.
  - A table showing per-month data.
  - Charts should support aggregation by quarter (from monthly data).

### 2.3 Global Chart Functionality

- Implement a global chart with the following features:
  - Filters to select and display one of three key metrics per engineer.
  - Dynamic chart updates based on selected filters.
  - Interactive points: clicking a data point shows the evaluation list for that point.

---

## Phase 3: Future Enhancements

- Develop a global KPI generation UI.
  - Integrate AI-driven suggestions for improvement (e.g., global goals, replacing PowerPoint-based reporting).
  - Provide a 1-on-1 help tool for personalized recommendations.

---


Bugs\FRs:

[fixed] 1. Deleting engineer returns error (but seems working though?). 
2. Charts in reports should only show existing data with possibility to open related PAR
3. Importing should explain that engineers will be added under current coach (warning about mismatch with the file.)
3.1 Importing now uses creation form with 7 empty cases and added those from excel as new. instead these 7 should be utilized
