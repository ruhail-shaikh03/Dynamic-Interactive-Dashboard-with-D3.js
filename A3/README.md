# A3: Interactive D3.js Dashboard

This project implements a fully interactive, data-driven dashboard using D3.js. Users can upload a flat JSON file, select dimensions, and explore the data through multiple linked visualizations.

## Features

*   **User Data Upload:** Accepts flat JSON files.
*   **Dynamic Dimension Selection:** Users choose dimensions for each chart.
*   **Four Advanced Visualizations (Pure D3.js):**
    *   Radial Bar Chart
    *   Chord Diagram
    *   Force-Directed Graph
    *   Sunburst Chart
*   **Dashboard Integration:** All charts on a single page.
*   **Brushing & Linking:** Selecting data in one chart highlights/filters related data in others.
    *   Click to select/filter.
    *   Ctrl+Click for multi-selection (basic implementation).
*   **Interactivity:** Tooltips, transitions, zoom/pan (for Force Graph), drill-down (for Sunburst planned).
*   **Color Consistency:** Aims for consistent colors for categories across charts using `d3.schemeCategory10`.

## Folder Structure