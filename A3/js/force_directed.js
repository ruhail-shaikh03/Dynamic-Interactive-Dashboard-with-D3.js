// js/force_directed.js
// extern D3, colorScale, showTooltip, hideTooltip (from dashboard.js)

function drawForceDirectedGraph(data, dimensionsConfig, svgSelector, interactionCallback) {
    const { nodes: nodesDim, links: linksDim, group: groupDim } = dimensionsConfig;

    // 0. Initial Setup
    const svg = d3.select(svgSelector);
    svg.selectAll("*").remove(); // Clear previous

    const containerWidth = svg.node().parentNode.clientWidth || 600;
    const containerHeight = Math.min(containerWidth, 500); // Or a fixed height like 500
    
    const width = containerWidth;
    const height = containerHeight;

    const chart = svg
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [-width / 2, -height / 2, width, height]) // Center the viewbox
        .style("max-width", "100%")
        .style("height", "auto");

    // 1. Data Processing
    // Create nodes: unique items from the nodesDim
    // Create links: based on the linksDim (which should be an array in the data)

    let graphNodes = [];
    let graphLinks = [];
    const nodeSet = new Set(); // To keep track of unique nodes and their original data

    data.forEach(item => {
        const nodeId = item[nodesDim];
        if (!nodeId) return; // Skip if node identifier is missing

        if (!nodeSet.has(nodeId)) {
            nodeSet.add(nodeId);
            graphNodes.push({ 
                id: nodeId, 
                group: groupDim ? item[groupDim] : "default", // Use groupDim for color if provided
                originalData: item // Store original item for tooltip or rich interaction
            });
        }

        // Create links
        const targets = item[linksDim]; // This should be an array of target node IDs
        if (Array.isArray(targets)) {
            targets.forEach(targetId => {
                if (targetId && nodeId !== targetId) { // Ensure target exists and not self-loop (can be allowed if desired)
                     // Check if target node also exists in our dataset or add it
                    if (!nodeSet.has(targetId)) {
                        // Optionally, find the target item in fullData or add a placeholder node
                        const targetDataItem = data.find(d => d[nodesDim] === targetId);
                        if (targetDataItem) {
                            nodeSet.add(targetId);
                            graphNodes.push({
                                id: targetId,
                                group: groupDim ? targetDataItem[groupDim] : "default",
                                originalData: targetDataItem
                            });
                        } else {
                            // If target is not a primary node, add a minimal representation
                            // This depends on how you want to handle external/unlisted nodes
                            // For now, we only link between nodes explicitly defined by nodesDim
                            // A better approach might be to add all unique targetIds to nodeSet first
                        }
                    }
                    // Only add link if both source and target are in our nodeSet
                    if (nodeSet.has(targetId)) {
                         graphLinks.push({ source: nodeId, target: targetId, originalDataSource: item });
                    }
                }
            });
        }
    });
    
    // Filter graphNodes to only include those that are actually part of nodeSet after processing links
    // This ensures all nodes in graphNodes are valid.
    const finalNodeIds = new Set(graphNodes.map(n => n.id));
    graphLinks = graphLinks.filter(l => finalNodeIds.has(l.source) && finalNodeIds.has(l.target));


    if (graphNodes.length === 0) {
        chart.append("text").text("No data for force graph dimensions.").attr("text-anchor", "middle").attr("alignment-baseline", "middle");
        return { update: () => {}, clearHighlight: () => {} };
    }
    
    // Update color scale domain if groupDim is used
    if (groupDim) {
        const groups = [...new Set(graphNodes.map(n => n.group))];
        colorScale.domain(groups); // Use the global colorScale from dashboard.js
    } else {
        colorScale.domain(["default"]); // Single color if no grouping
    }


    // 2. Simulation
    const simulation = d3.forceSimulation(graphNodes)
        .force("link", d3.forceLink(graphLinks).id(d => d.id).distance(50).strength(0.5))
        .force("charge", d3.forceManyBody().strength(-150)) // More negative for more repulsion
        .force("center", d3.forceCenter(0, 0)) // Centered in the viewbox
        .force("x", d3.forceX().strength(0.05)) // Gentle pull to center horizontally
        .force("y", d3.forceY().strength(0.05)); // Gentle pull to center vertically


    // 3. Draw Elements
    const link = chart.append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(graphLinks)
      .join("line")
        .attr("stroke-width", d => Math.sqrt(d.value || 1)); // Example: if links have values

    const node = chart.append("g")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(graphNodes)
      .join("circle")
        .attr("r", 8) // Node radius
        .attr("fill", d => colorScale(d.group))
        .attr("class", "node-circle") // For styling and selection
        .on("mouseover", function(event, d) {
            d3.select(this).attr("r", 10); // Enlarge on hover
            showTooltip(event, `<strong>${d.id}</strong><br/>Group: ${d.group}`);
            // Optionally highlight connected links/nodes
            link.style('stroke-opacity', l => (l.source === d || l.target === d) ? 1 : 0.1)
                .style('stroke', l => (l.source === d || l.target === d) ? 'red' : '#999');
            node.style('opacity', n => (isConnected(d,n) || n === d) ? 1 : 0.3);

        })
        .on("mouseout", function() {
            d3.select(this).attr("r", 8);
            hideTooltip();
            // Reset opacities unless a filter is active
            if (Object.keys(activeFilters).length === 0) { // Check global activeFilters from dashboard.js
                 link.style('stroke-opacity', 0.6).style('stroke', '#999');
                 node.style('opacity', 1);
            } else {
                // If filters are active, re-apply the filtered state.
                // This part needs to be handled by the update function,
                // but mouseout should revert to the current filtered state, not fully reset.
                // For simplicity, the update function will handle the definitive state.
                // Here, just revert the immediate hover effect.
                // A better way: store current highlight state and revert to it.
                applyCurrentFiltersHighlighting();
            }
        })
        .on("click", function(event, d) {
            // Send filter information back to dashboard.js
            interactionCallback('forceDirected', { type: 'node', dimension: nodesDim, value: d.id }, event);
            // No immediate highlighting here; let the dashboard.js -> update call handle it
        });

    // Helper to check connectivity for hover effect
    let linkedByIndex = {};
    graphLinks.forEach(function(d) {
        linkedByIndex[d.source.id + "," + d.target.id] = 1;
    });
    function isConnected(a, b) {
        return linkedByIndex[a.id + "," + b.id] || linkedByIndex[b.id + "," + a.id] || a.id === b.id;
    }


    // Add node labels (optional, can be performance intensive for many nodes)
    const labels = chart.append("g")
        .attr("class", "labels")
      .selectAll("text")
      .data(graphNodes)
      .join("text")
        .text(d => d.id)
        .attr("x", 12) // Offset from node center
        .attr("y", 4)  // Offset from node center
        .style("font-size", "10px")
        .style("pointer-events", "none"); // So labels don't interfere with node mouse events

    // Tick function for simulation
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
        
        labels
            .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Drag functionality
    function drag(simulation) {
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            // d.fx = null; // Keep node where dragged, or set to null to let simulation reposition
            // d.fy = null;
        }
        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }
    node.call(drag(simulation));

    // Zoom functionality
    const zoom = d3.zoom()
        .scaleExtent([0.1, 8]) // Min/max zoom
        .on("zoom", (event) => {
            chart.selectAll('g').attr("transform", event.transform); // Apply to all 'g' elements within the main chart group
        });
    svg.call(zoom); // Call zoom on the main SVG element

    // Centralize the graph initially
    // svg.call(zoom.transform, d3.zoomIdentity); // This might be needed if viewBox alone isn't enough

    let currentActiveFilters = {}; // Local cache of active filters for mouseout revert

    function applyCurrentFiltersHighlighting() {
        const hasActiveFilters = Object.keys(currentActiveFilters).length > 0;
        let highlightedNodeIds = new Set();
        
        if (hasActiveFilters) {
            Object.values(currentActiveFilters).forEach(f => {
                if (f.type === 'node' && f.dimension === nodesDim) {
                    highlightedNodeIds.add(f.value);
                }
                // If filtering by category (e.g. from radial bar), highlight nodes in that category
                if (f.type === 'category' && f.dimension === groupDim) {
                    graphNodes.forEach(n => {
                        if (n.group === f.value) highlightedNodeIds.add(n.id);
                    });
                }
            });
        }

        node.style("opacity", d => {
            if (!hasActiveFilters) return 1;
            return highlightedNodeIds.has(d.id) ? 1 : 0.1;
        });

        link.style("stroke-opacity", l => {
            if (!hasActiveFilters) return 0.6;
            // Highlight link if both source and target are highlighted, or if directly related to a single highlighted node
            const sourceHighlighted = highlightedNodeIds.has(l.source.id);
            const targetHighlighted = highlightedNodeIds.has(l.target.id);
            return (sourceHighlighted && targetHighlighted) ? 1 : (sourceHighlighted || targetHighlighted ? 0.5 : 0.05);
        })
        .style("stroke", l => {
             if (!hasActiveFilters) return "#999";
             const sourceHighlighted = highlightedNodeIds.has(l.source.id);
             const targetHighlighted = highlightedNodeIds.has(l.target.id);
             return (sourceHighlighted && targetHighlighted) ? "red" : "#999";
        });
    }


    // Function to update chart based on external filters
    function update(filteredExtData, activeExtFilters) {
        currentActiveFilters = activeExtFilters; // Cache for mouseout
        applyCurrentFiltersHighlighting();

        // More advanced: Re-filter nodes/links if filteredExtData is significantly different
        // This could mean re-calculating graphNodes and graphLinks and re-running simulation.
        // For now, we just highlight/dim based on activeExtFilters.

        // Example: If a category from another chart is selected, highlight nodes of that category
        let nodesToHighlight = new Set();
        let linksToHighlight = new Set();

        const filtersArray = Object.values(activeExtFilters);

        if (filtersArray.length === 0) {
            clearHighlight();
            return;
        }
        
        // Determine which nodes should be visible/highlighted based on all active filters
        const relevantNodes = new Set();
        if(filteredExtData.length < data.length || filtersArray.length > 0) { // If there's any filtering
            filteredExtData.forEach(item => {
                relevantNodes.add(item[nodesDim]); // Add nodes from the filtered data
            });

            // Also, if a specific node was clicked in *this* graph, ensure it's highlighted
            filtersArray.forEach(filter => {
                if (filter.type === 'node' && filter.dimension === nodesDim) {
                    relevantNodes.add(filter.value);
                }
            });
        }


        node.classed("dimmed", true) // Dim all first
            .classed("highlighted", false)
            .filter(d => {
                if (filtersArray.length === 0) return true; // No filters, show all
                if (relevantNodes.has(d.id)) return true; // Node is in filtered data or directly selected

                // If a category is selected (e.g., from radial bar) and this node belongs to it
                return filtersArray.some(f => f.type === 'category' && d.group === f.value && f.dimension === groupDim);
            })
            .classed("dimmed", false)
            .classed("highlighted", true);
            
        link.classed("dimmed", true)
            .classed("highlighted", false)
            .filter(l => {
                if (filtersArray.length === 0) return true;
                const sourceNode = node.filter(n => n.id === l.source.id);
                const targetNode = node.filter(n => n.id === l.target.id);
                // Link is highlighted if both its nodes are highlighted
                return sourceNode.classed("highlighted") && targetNode.classed("highlighted");
            })
            .classed("dimmed", false)
            .classed("highlighted", true);


        // For the mouseout reset to work with the current filter state:
        // The mouseout should call applyCurrentFiltersHighlighting rather than a full reset
        // if (Object.keys(activeExtFilters).length > 0) {
        //      applyCurrentFiltersHighlighting(); // re-apply based on the global filter state
        // }
    }

    function clearHighlight() {
        currentActiveFilters = {}; // Clear local cache
        node.classed("highlighted", false).classed("dimmed", false).style("opacity", 1).attr("r", 8);
        link.classed("highlighted", false).classed("dimmed", false).style("stroke-opacity", 0.6).style('stroke', '#999');
        // labels.style("opacity", 1);
    }

    // Return methods for dashboard interaction
    return {
        update: update,
        clearHighlight: clearHighlight
    };
}