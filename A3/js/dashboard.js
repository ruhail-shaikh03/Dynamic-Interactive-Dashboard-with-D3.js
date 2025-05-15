// js/dashboard.js

// Global variables
let fullData = [];
let dimensions = [];
let selectedDimensionValues = {}; // To store what user picked for each chart
let activeFilters = {}; // To store current filter state for brushing/linking
let colorScale = d3.scaleOrdinal(d3.schemeCategory10); // For consistent colors

// Chart instances (will be populated later by individual chart scripts)
// This allows dashboard.js to call update/highlight functions on them
const charts = {
    radialBar: null,
    chord: null,
    forceDirected: null,
    sunburst: null
};


document.addEventListener('DOMContentLoaded', () => {
    // Initialize event listeners
    document.getElementById('jsonFile').addEventListener('change', handleFileUpload);
    document.getElementById('loadDataButton').addEventListener('click', setupDimensionSelectors);
    document.getElementById('generateDashboardButton').addEventListener('click', generateDashboard);

    // Create a generic tooltip div (can be styled further in CSS)
    d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
});

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file && file.type === "application/json") {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                fullData = JSON.parse(e.target.result);
                if (!Array.isArray(fullData) || fullData.length === 0) {
                    alert("JSON must be an array of objects and not empty.");
                    return;
                }
                dimensions = Object.keys(fullData[0]); // Extract dimensions from the first object
                
                // Enable the next step button
                document.getElementById('loadDataButton').disabled = false;
                document.getElementById('dimension-selectors').style.display = 'none'; // Hide if previously shown
                document.getElementById('generateDashboardButton').disabled = true; // Disable generate until setup
                clearAllCharts(); // Clear any existing charts
                alert("File loaded successfully. Click 'Load Data & Setup Dimensions'.");
            } catch (error) {
                alert("Error parsing JSON file: " + error.message);
                console.error("JSON Parsing Error:", error);
                fullData = [];
                dimensions = [];
            }
        };
        reader.readAsText(file);
    } else {
        alert("Please upload a valid JSON file.");
        fullData = [];
        dimensions = [];
    }
}

function setupDimensionSelectors() {
    if (fullData.length === 0) {
        alert("Please load a JSON file first.");
        return;
    }

    const dimensionSelectorsDiv = document.getElementById('dimension-selectors');
    dimensionSelectorsDiv.style.display = 'block';
    document.getElementById('generateDashboardButton').disabled = false;

    // Populate dropdowns
    const allSelects = document.querySelectorAll('.chart-dimension-selector select');
    allSelects.forEach(select => {
        // Clear previous options
        select.innerHTML = '<option value="">-- Select --</option>'; 
        if (select.id === 'fdg-group' || select.id === 'sb-level3') { // Optional fields
             select.innerHTML += '<option value="">-- None (Optional) --</option>';
        }
        dimensions.forEach(dim => {
            const option = document.createElement('option');
            option.value = dim;
            option.textContent = dim;
            select.appendChild(option);
        });
    });

    // Pre-select based on dataset structure (heuristic, adjust as needed)
    // Example: for pakistani_companies.json
    if (dimensions.includes("Company") && dimensions.includes("Revenue")) {
        document.getElementById('rb-category').value = "Sector"; // Example, could be company
        document.getElementById('rb-value').value = "Revenue";
    }
    if (dimensions.includes("Sector") && dimensions.includes("Region")) {
        document.getElementById('cd-source').value = "Sector";
        document.getElementById('cd-target').value = "Region";
    }
    if (dimensions.includes("Company") && dimensions.includes("ConnectedTo") && dimensions.includes("Sector")) {
        document.getElementById('fdg-nodes').value = "Company";
        document.getElementById('fdg-links').value = "ConnectedTo";
        document.getElementById('fdg-group').value = "Sector";
    }
     if (dimensions.includes("Region") && dimensions.includes("Sector") && dimensions.includes("Category") && dimensions.includes("Revenue")) {
        document.getElementById('sb-level1').value = "Region";
        document.getElementById('sb-level2').value = "Sector";
        document.getElementById('sb-level3').value = "Category";
        document.getElementById('sb-value').value = "Revenue";
    }
    // Example: for music_artist_dataset.json
    if (dimensions.includes("Artist") && dimensions.includes("FollowersInMillions")) {
        document.getElementById('rb-category').value = "Genre";
        document.getElementById('rb-value').value = "FollowersInMillions";
    }
    if (dimensions.includes("Genre") && dimensions.includes("Region")) {
        document.getElementById('cd-source').value = "Genre";
        document.getElementById('cd-target').value = "Region";
    }
    if (dimensions.includes("Artist") && dimensions.includes("CollaboratedWith") && dimensions.includes("Genre")) {
        document.getElementById('fdg-nodes').value = "Artist";
        document.getElementById('fdg-links').value = "CollaboratedWith";
        document.getElementById('fdg-group').value = "Genre";
    }
     if (dimensions.includes("Region") && dimensions.includes("Genre") && dimensions.includes("FollowersInMillions")) {
        document.getElementById('sb-level1').value = "Region";
        document.getElementById('sb-level2').value = "Genre";
        // sb-level3 can be empty
        document.getElementById('sb-value').value = "FollowersInMillions";
    }
}


function generateDashboard() {
    // Store selected dimensions
    selectedDimensionValues = {
        radialBar: {
            category: document.getElementById('rb-category').value,
            value: document.getElementById('rb-value').value,
        },
        chord: {
            source: document.getElementById('cd-source').value,
            target: document.getElementById('cd-target').value,
        },
        forceDirected: {
            nodes: document.getElementById('fdg-nodes').value,
            links: document.getElementById('fdg-links').value,
            group: document.getElementById('fdg-group').value || null, // Handle optional
        },
        sunburst: {
            level1: document.getElementById('sb-level1').value,
            level2: document.getElementById('sb-level2').value,
            level3: document.getElementById('sb-level3').value || null, // Handle optional
            value: document.getElementById('sb-value').value,
        }
    };

    // Validate selections (basic)
    if (!selectedDimensionValues.radialBar.category || !selectedDimensionValues.radialBar.value ||
        !selectedDimensionValues.chord.source || !selectedDimensionValues.chord.target ||
        !selectedDimensionValues.forceDirected.nodes || !selectedDimensionValues.forceDirected.links ||
        !selectedDimensionValues.sunburst.level1 || !selectedDimensionValues.sunburst.level2 || !selectedDimensionValues.sunburst.value) {
        alert("Please select all required dimensions for the charts.");
        return;
    }
    if (selectedDimensionValues.chord.source === selectedDimensionValues.chord.target) {
        alert("Chord diagram source and target dimensions must be different.");
        return;
    }
    // Add more specific validations if needed (e.g., value field is numeric)

    console.log("Selected Dimensions:", selectedDimensionValues);
    console.log("Full Data:", fullData);

    // Clear previous charts before drawing new ones
    clearAllCharts();
    activeFilters = {}; // Reset filters

    // Initialize and draw charts
    // These functions will be defined in their respective .js files
    // They should store their update/highlight methods in the global `charts` object
    if (typeof drawRadialBarChart === "function") {
        charts.radialBar = drawRadialBarChart(fullData, selectedDimensionValues.radialBar, '#radial-bar-chart', handleInteraction);
    }
    if (typeof drawChordDiagram === "function") {
        charts.chord = drawChordDiagram(fullData, selectedDimensionValues.chord, '#chord-diagram', handleInteraction);
    }
    if (typeof drawForceDirectedGraph === "function") {
        charts.forceDirected = drawForceDirectedGraph(fullData, selectedDimensionValues.forceDirected, '#force-directed-graph', handleInteraction);
    }
    if (typeof drawSunburstChart === "function") {
        charts.sunburst = drawSunburstChart(fullData, selectedDimensionValues.sunburst, '#sunburst-chart', handleInteraction);
    }
    
    document.getElementById('dimension-selectors').style.display = 'none'; // Hide selectors after generation
}

function clearAllCharts() {
    d3.select('#radial-bar-chart').selectAll('*').remove();
    d3.select('#chord-diagram').selectAll('*').remove();
    d3.select('#force-directed-graph').selectAll('*').remove();
    d3.select('#sunburst-chart').selectAll('*').remove();
}

// --- Brushing and Linking Logic ---
// This is the core of the interactivity.
// `originChartKey` helps prevent infinite loops (don't update the chart that initiated the filter)
// `filterInfo` structure: { type: 'category', dimension: 'Sector', value: 'Technology' } or { type: 'node', value: 'CompanyName' }
function handleInteraction(originChartKey, filterInfo, event) {
    console.log("Interaction from:", originChartKey, "Filter:", filterInfo);

    // Ctrl/Shift multi-selection logic (simplified example for category filters)
    // This needs to be adapted based on how your charts identify selected items.
    const filterKey = `${filterInfo.dimension}-${filterInfo.value}`;

    if (event && event.ctrlKey) { // Ctrl key for multi-select
        if (activeFilters[filterKey]) {
            delete activeFilters[filterKey]; // Toggle off
        } else {
            activeFilters[filterKey] = filterInfo; // Toggle on
        }
    } else { // Single select (or first select)
        activeFilters = {}; // Clear previous single selections
        if (filterInfo.value !== null) { // If not clearing selection
             activeFilters[filterKey] = filterInfo;
        }
    }
    
    // Apply filters/highlights to all charts
    updateAllCharts(originChartKey);
}

function updateAllCharts(originChartKey) {
    // Create a combined filter function or pass activeFilters directly
    // For simplicity, we'll pass activeFilters and let each chart decide how to use them.
    // A more sophisticated approach might involve creating a master filter function.

    let filteredData = fullData; // Start with full data

    // Apply filters to the data if any activeFilters exist
    const currentFilters = Object.values(activeFilters);
    if (currentFilters.length > 0) {
        filteredData = fullData.filter(d => {
            return currentFilters.every(f => {
                // This is a simple 'AND' logic for multiple filters.
                // Adapt based on your specific filter needs.
                if (f.type === 'category') {
                    return d[f.dimension] === f.value;
                }
                if (f.type === 'node') { // Example for force directed graph node click
                    // This depends on how fdg-nodes dimension relates to other data
                    // Assuming the node value is directly present in the data items
                    const nodeDim = selectedDimensionValues.forceDirected.nodes;
                    return d[nodeDim] === f.value; 
                }
                // Add other filter types as needed
                return true; // If filter type not recognized, don't filter it out
            });
        });
    }
    
    console.log("Active Filters:", activeFilters);
    console.log("Filtered Data for re-render/highlight:", filteredData.length, "items");

    // Call update/highlight functions on each chart
    // Each chart's `update` function needs to handle `activeFilters` or `filteredData`
    if (charts.radialBar && charts.radialBar.update && originChartKey !== 'radialBar') {
        charts.radialBar.update(filteredData, activeFilters);
    }
    if (charts.chord && charts.chord.update && originChartKey !== 'chord') {
        charts.chord.update(filteredData, activeFilters);
    }
    if (charts.forceDirected && charts.forceDirected.update && originChartKey !== 'forceDirected') {
        charts.forceDirected.update(filteredData, activeFilters);
    }
    if (charts.sunburst && charts.sunburst.update && originChartKey !== 'sunburst') {
        charts.sunburst.update(filteredData, activeFilters);
    }

    // If no filters are active, tell charts to reset their highlighting
    if (Object.keys(activeFilters).length === 0) {
        if (charts.radialBar && charts.radialBar.clearHighlight) charts.radialBar.clearHighlight();
        if (charts.chord && charts.chord.clearHighlight) charts.chord.clearHighlight();
        if (charts.forceDirected && charts.forceDirected.clearHighlight) charts.forceDirected.clearHighlight();
        if (charts.sunburst && charts.sunburst.clearHighlight) charts.sunburst.clearHighlight();
    }
}

// Helper for tooltip
const tooltip = d3.select(".tooltip");

function showTooltip(event, content) {
    tooltip.transition().duration(200).style("opacity", .9);
    tooltip.html(content)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
}

function hideTooltip() {
    tooltip.transition().duration(500).style("opacity", 0);
}