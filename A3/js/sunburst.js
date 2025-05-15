// js/sunburst.js
// extern D3, colorScale, showTooltip, hideTooltip (from dashboard.js)

function drawSunburstChart(data, dimensionsConfig, svgSelector, interactionCallback) {
    const { level1, level2, level3, value: valueDim } = dimensionsConfig;
    const hierarchyLevels = [level1, level2, level3].filter(Boolean); // Remove null/undefined levels

    // 0. Initial Setup
    const svg = d3.select(svgSelector);
    svg.selectAll("*").remove(); // Clear previous

    const containerWidth = svg.node().parentNode.clientWidth || 600;
    const containerHeight = Math.min(containerWidth, 500);
    const margin = {top: 10, right: 10, bottom: 10, left: 10}; // Small margin

    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;
    const radius = Math.min(width, height) / 2 - 10; // Adjust radius for labels if needed

    const chart = svg
        .attr("width", containerWidth)
        .attr("height", containerHeight)
      .append("g")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`);

    // 1. Data Processing: Create hierarchical structure
    if (hierarchyLevels.length === 0 || !valueDim) {
        chart.append("text").text("Please select at least one hierarchy level and a value dimension.")
            .attr("text-anchor", "middle").attr("alignment-baseline", "middle");
        return { update: () => {}, clearHighlight: () => {} };
    }

    function buildHierarchyRecursive(dataSubset, levelIndex) {
        if (levelIndex >= hierarchyLevels.length) { // Base case: leaf node level
            return dataSubset.map(d => ({
                name: "leaf", // Leaf nodes might not have a 'name' from dimensions
                value: +d[valueDim] || 0, // Ensure numeric value
                originalData: d // Keep original data for tooltips/interaction
            }));
        }

        const currentLevelDim = hierarchyLevels[levelIndex];
        const grouped = d3.group(dataSubset, d => d[currentLevelDim]);

        const children = [];
        for (const [key, values] of grouped) {
            if (key == null || key === "") continue; // Skip null or empty keys

            const node = {
                name: key,
                originalDataItems: values // Store all items belonging to this node at this level
            };
            const deeperChildren = buildHierarchyRecursive(values, levelIndex + 1);
            if (deeperChildren && deeperChildren.length > 0) {
                node.children = deeperChildren;
            } else {
                // If no deeper children but this is not the last defined hierarchy level,
                // it means data ends here. Sum values if it's a pre-leaf.
                node.value = d3.sum(values, d => +d[valueDim] || 0);
            }
            children.push(node);
        }
        return children;
    }
    
    const hierarchicalData = {
        name: "root",
        children: buildHierarchyRecursive(data, 0)
    };
    
    const root = d3.hierarchy(hierarchicalData)
        .sum(d => d.value) // Sum values up the hierarchy. Leaf nodes should have 'value' property.
        .sort((a, b) => b.value - a.value); // Sort siblings by value

    if (!root.children || root.children.length === 0 || root.value === 0) {
        chart.append("text").text("No data to display for Sunburst with selected dimensions or zero total value.")
             .attr("text-anchor", "middle").attr("alignment-baseline", "middle");
        return { update: () => {}, clearHighlight: () => {} };
    }

    // Update color scale domain (e.g., by top-level children names or depth)
    // For sunburst, often color by d.depth or by name of first-level children
    // Let's use the names of the first level children if they exist
    const firstLevelNames = root.children ? root.children.map(d => d.data.name) : ["root"];
    colorScale.domain(firstLevelNames);


    // 2. D3 Partition Layout
    const partitionLayout = d3.partition()
        .size([2 * Math.PI, radius * radius]); // angle range, radius range (squared for area perception)

    partitionLayout(root); // Apply layout to the hierarchy

    // 3. Draw Arcs
    const arcGenerator = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005)) // Padding between segments
        .padRadius(radius / 2)
        .innerRadius(d => Math.sqrt(d.y0))
        .outerRadius(d => Math.sqrt(d.y1) - 1); // -1 for slight separation

    const paths = chart.append("g")
        .attr("class", "sunburst-paths")
      .selectAll("path")
      .data(root.descendants().filter(d => d.depth > 0)) // Don't draw the root node itself as a segment
      .join("path")
        .attr("class", "sunburst-segment")
        .attr("d", arcGenerator)
        .style("fill", d => {
            // Color by first-level ancestor, or by depth, or by name
            let ancestor = d;
            while (ancestor.depth > 1) ancestor = ancestor.parent;
            return colorScale(ancestor.data.name);
        })
        .style("stroke", "#fff")
        .style("stroke-width", "0.5px")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.7);
            const percentage = (100 * d.value / root.value).toPrecision(3);
            let pathString = getPathString(d);
            showTooltip(event, `<strong>${pathString}</strong><br/>Value: ${d3.format(",.2f")(d.value)} (${percentage}%)`);
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            hideTooltip();
        })
        .on("click", (event, d) => {
            // On click, zoom into the clicked segment (or pass filter info)
            // For this assignment, let's pass filter info based on the clicked segment's path
            // The filter needs to represent the hierarchical selection.
            // Example: { type: 'hierarchy', path: [{dim: level1, val: 'A'}, {dim: level2, val: 'B'}]}
            const currentPath = d.ancestors().reverse().slice(1) // Exclude root
                               .map((node, i) => ({
                                   dimension: hierarchyLevels[i],
                                   value: node.data.name
                               }));
            
            interactionCallback('sunburst', { type: 'hierarchy', path: currentPath }, event);
            // Visual feedback for click (handled by update function)
        });
    
    // Helper to get path string for tooltip
    function getPathString(node) {
        return node.ancestors().reverse().slice(1).map(d => d.data.name).join(" / ");
    }

    // Add labels (can be tricky for sunburst due to space)
    // This is a simplified labeling approach. More advanced labeling would check for space.
    chart.append("g")
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .style("user-select", "none")
      .selectAll("text")
      .data(root.descendants().filter(d => d.depth && (d.y0 + d.y1) / 2 * (d.x1 - d.x0) > 10 && d.value / root.value > 0.005)) // Filter for visibility
      .join("text")
        .attr("transform", function(d) {
          const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
          const y = Math.sqrt((d.y0 + d.y1) / 2);
          return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
        })
        .attr("dy", "0.35em")
        .style("font-size", "9px")
        .text(d => d.data.name.length > 15 ? d.data.name.substring(0,12)+"..." : d.data.name);


    // Function to update chart based on external filters
    function update(filteredExtData, activeExtFilters) {
        // Sunburst highlighting is typically path-based.
        // If a filter matches a path in the sunburst, highlight that path.
        
        paths.classed("dimmed", true).classed("highlighted", false); // Dim all first

        const filtersArray = Object.values(activeExtFilters);
        if (filtersArray.length === 0) {
            paths.classed("dimmed", false);
            return;
        }

        paths.filter(d_path => {
            // Check if the current path (d_path) matches any of the active filters
            return filtersArray.some(filter => {
                if (filter.type === 'hierarchy' && filter.path) {
                    // Filter path: [{dimension: 'Reg', value: 'Asia'}, {dimension: 'Gen', value: 'Jazz'}]
                    // Current d_path: an object from root.descendants()
                    // We need to see if the filter.path is an ancestor-or-self of d_path
                    let currentPathAncestors = d_path.ancestors().reverse().slice(1); // Path from root to d_path
                    if (filter.path.length > currentPathAncestors.length) return false; // Filter is more specific

                    return filter.path.every((filterLevel, i) => {
                        return currentPathAncestors[i] && 
                               hierarchyLevels[i] === filterLevel.dimension && // Match dimension name
                               currentPathAncestors[i].data.name === filterLevel.value; // Match value
                    });
                }
                // Handle 'category' or 'node' filters if they can map to sunburst segments
                // This requires knowing how categories/nodes relate to sunburst hierarchy levels
                if ((filter.type === 'category' || filter.type === 'node')) {
                    // Check if any ancestor (or self) of d_path has a name that matches the filter value,
                    // AND if the dimension of that ancestor matches the filter's dimension.
                    return d_path.ancestors().reverse().slice(1).some((ancestorNode, i) => {
                        return hierarchyLevels[i] === filter.dimension && ancestorNode.data.name === filter.value;
                    });
                }
                return false;
            });
        })
        .classed("dimmed", false)
        .classed("highlighted", true);
    }
    
    function clearHighlight() {
        paths.classed("highlighted", false).classed("dimmed", false);
    }

    // Return methods for dashboard interaction
    return {
        update: update,
        clearHighlight: clearHighlight
    };
}