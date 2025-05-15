# A3: Interactive D3.js Dashboard

## Overview

This project implements a fully interactive, data-driven dashboard using D3.js. The primary goal is to allow users to explore datasets by uploading their own flat JSON files and visualizing them through multiple, linked advanced charts. The dashboard emphasizes dynamic interaction and data exploration rather than narrative storytelling.

**Dimension Selection Flow:**

1.  **Upload JSON:** The user begins by clicking "Choose File" and selecting a local JSON data file.
2.  **Load & Setup:** After a file is chosen, the "Load Data & Setup Dimensions" button becomes active. Clicking this parses the JSON, extracts all column headers (dimensions), and populates dropdown menus for each of the four chart types.
3.  **Configure Charts:** The user then selects the appropriate dimensions from their dataset for each chart:
    *   **Radial Bar Chart:** Requires one categorical dimension (for bars) and one numerical dimension (for bar length/value).
    *   **Chord Diagram:** Requires two categorical dimensions to show relationships (flows or co-occurrences) between their unique values.
    *   **Force-Directed Graph:** Requires a dimension for nodes (e.g., company names, artist names), a dimension containing an *array* of connections/links for each node (e.g., "CollaboratedWith", "ConnectedTo"), and an optional categorical dimension for grouping/coloring nodes.
    *   **Sunburst Chart:** Requires at least one (up to three) categorical dimensions to define the hierarchy levels, and one numerical dimension for segment sizes (values).
4.  **Generate Dashboard:** Once dimensions are selected, clicking "Generate Dashboard" renders all four visualizations on a single page.
5.  **Interact & Explore:** Users can then interact with the charts. Clicking an element in one chart (e.g., a bar, a node, a chord group, a sunburst segment) will trigger a filter or highlight action. This selection is propagated to all other charts, which will update to reflect the selection (e.g., by dimming non-related items and highlighting related ones). Tooltips provide detailed information on hover.

## Preprocessing & Assumptions

*   **Input Data Format:**
    *   The system expects a **flat JSON array of objects**. Each object in the array represents a row, and its keys represent columns/dimensions.
    *   For the **Force-Directed Graph**, the dimension selected for "Links" (e.g., "CollaboratedWith", "ConnectedTo") *must* contain an array of strings, where each string is an ID of another node present in the "Nodes" dimension.
    *   Values for dimensions intended for numerical aggregation (e.g., "Value" in Radial Bar, "Value" in Sunburst) should be numbers or strings coercible to numbers. The code attempts `+d[valueDim]` coercion.
*   **Data Integrity:**
    *   It's assumed that the data within the selected dimensions is relatively clean. For example, categorical dimensions for hierarchies or relationships should have consistent naming.
    *   Null or empty string values in key categorical dimensions (especially for hierarchy levels in Sunburst or entity names in Chord/Force Graph) are generally filtered out or handled to prevent errors, but might lead to incomplete visualizations.
*   **Color Consistency:** A global D3 categorical color scale (`d3.schemeCategory10`) is used. Its domain is dynamically updated based on the entities appearing in the charts (primarily driven by Chord Diagram names, Force Graph groups, and Sunburst first-level children). This aims for consistent color representation of the same category across different charts where applicable, but perfect consistency is challenging if categories are defined differently per chart.
*   **Chord Diagram Matrix:** The chord diagram constructs a square matrix based on the unique values found in *both* the selected "Source" and "Target" dimensions. The value `matrix[i][j]` represents the number of times entity `i` (source) is linked to entity `j` (target) in the dataset.
*   **Sunburst Hierarchy:** The sunburst chart builds its hierarchy based on the order of "Level 1", "Level 2", and "Level 3" dimensions. Data items are grouped sequentially. If an intermediate level is missing for a data point, that path might terminate earlier or be handled by the `buildHierarchyRecursive` logic.

## How to Run Locally

1.  **Prerequisites:**
    *   A modern web browser (e.g., Chrome, Firefox, Edge).
    *   (Optional but Recommended) Visual Studio Code with the "Live Server" extension by Ritwick Dey.

2.  **Steps:**
    *   **Download/Clone:** Get all the project files (`A3` folder and its contents) onto your local machine.
    *   **Using VS Code Live Server (Recommended):**
        1.  Open the `A3` folder in Visual Studio Code.
        2.  If not already installed, install the "Live Server" extension from the VS Code marketplace.
        3.  In the VS Code explorer, right-click on the `index.html` file.
        4.  Select "Open with Live Server".
        5.  Your default web browser will open, displaying the dashboard (e.g., at `http://127.0.0.1:5500/index.html`).
    *   **Without Live Server (Directly opening `index.html`):**
        1.  Navigate to the `A3` folder in your computer's file explorer.
        2.  Double-click the `index.html` file.
        3.  **Note:** While this may work for some browsers, loading local JSON files via the `file://` protocol can sometimes be restricted due to browser security policies (Cross-Origin Resource Sharing - CORS). If the data doesn't load or you see errors, using a local server (like Live Server) is the preferred solution.

## Technical Challenges & Decisions

1.  **Brushing & Linking Complexity:**
    *   **Challenge:** Implementing robust brushing and linking across four distinct and complex D3 visualizations, each with its own data structure and interaction model, was the most significant challenge. Ensuring that a selection in one chart meaningfully filters/highlights others required careful management of a global filter state (`activeFilters` in `dashboard.js`) and dedicated `update` functions in each chart module.
    *   **Decision:** A centralized `handleInteraction` function in `dashboard.js` was chosen to manage filter state. Each chart, upon user interaction, calls this function. `dashboard.js` then calls the `update` method of all *other* charts. This prevents infinite update loops and centralizes filter logic. Ctrl+Click was implemented for basic multi-selection.

2.  **Data Transformation for Specific Charts:**
    *   **Challenge:** Chord diagrams and Sunburst charts require very specific input data structures (a square matrix for Chord, a nested hierarchical object for Sunburst). Dynamically transforming user-uploaded flat JSON into these structures based on arbitrary dimension selections is non-trivial.
    *   **Decision:**
        *   For the **Chord Diagram**, unique entities from both selected source and target dimensions are combined to form the rows/columns of the matrix. This provides flexibility but assumes relationships are meaningful between these combined entities.
        *   For the **Sunburst Chart**, a recursive function (`buildHierarchyRecursive`) was implemented to create the nested structure. It handles cases where data for deeper levels might be sparse. Using `Math.sqrt()` for radii in the arc generator was chosen for better area-proportional visual representation.

3.  **Force-Directed Graph Link Generation:**
    *   **Challenge:** The "links" dimension in the input data needed to be an array of target node IDs. Ensuring that these target IDs also exist as nodes (or are appropriately handled if they are external) required careful data processing.
    *   **Decision:** The code primarily creates links between nodes that are explicitly defined through the `nodesDim`. If a target in the `linksDim` array is not found as a primary node, the link might be omitted unless the target node is also present in the dataset under `nodesDim`. This simplifies the graph but could be extended to represent external links differently.

4.  **Consistent Coloring:**
    *   **Challenge:** Maintaining color consistency for the same categorical entity across different charts.
    *   **Decision:** A global `d3.scaleOrdinal(d3.schemeCategory10)` is used. Its domain is primarily populated by categories from the Chord diagram, Force-Directed graph (groups), and Sunburst (first-level children). While this helps, if a category in the Radial Bar chart doesn't appear as a primary entity in these other charts, it might get a new color from the scale.

5.  **Interactivity within Charts vs. Cross-Chart Linking:**
    *   **Challenge:** Balancing rich interactivity within each chart (e.g., tooltips, hover effects, zoom/drag for Force Graph) with the cross-chart brushing and linking behavior. Mouseout events, for instance, need to correctly revert to the current filtered state, not just the default un-hovered state.
    *   **Decision:** Each chart handles its own internal hover effects. The `update` functions are responsible for applying the global filter state (highlight/dim). Mouseout events were designed to revert immediate hover effects but rely on the `update` function (triggered by `dashboard.js`) to establish the correct appearance based on active global filters.

6.  **Performance with Large Datasets:**
    *   **Challenge:** D3.js can handle large datasets, but complex data transformations and rendering many SVG elements (especially in the Force Graph or highly granular Sunburst) can impact performance.
    *   **Decision:** The focus was on functional correctness for moderately sized datasets as per typical assignment scopes. Optimizations like canvas rendering for the Force Graph or more aggressive data aggregation for very large datasets were considered out of scope for this implementation but would be next steps for production systems. Basic filtering of labels in the Sunburst chart was done to improve clarity and performance.

7.  **User Experience for Dimension Selection:**
    *   **Challenge:** Guiding the user to select appropriate dimensions for each chart type without overwhelming them.
    *   **Decision:** Provided clear labels for each dimension selector and brief instructions in the UI. Pre-filling selectors with plausible defaults based on common column names in the example datasets (`music_artist_dataset.json`, `pakistani_companies.json`) was implemented to speed up testing and demonstrate functionality.

## Folder Structure