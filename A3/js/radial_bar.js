// Example: js/radial_bar.js

// Make sure to use the global colorScale from dashboard.js
// extern D3, colorScale, showTooltip, hideTooltip

function drawRadialBarChart(data, dimensionsConfig, svgSelector, interactionCallback) {
    const { category: categoryDim, value: valueDim } = dimensionsConfig;

    // 0. Initial Setup
    const svg = d3.select(svgSelector);
    svg.selectAll("*").remove(); // Clear previous
    
    const margin = {top: 60, right: 20, bottom: 40, left: 20}; // Adjusted for labels/title
    const containerWidth = svg.node().parentNode.clientWidth || 600; // Get width from parent
    const containerHeight = Math.min(containerWidth, 500); // Keep it somewhat square or fixed height

    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;
    const innerRadius = Math.min(width, height) * 0.2; // Example: 20% of smallest dimension
    const outerRadius = Math.min(width, height) * 0.45; // Example: 45%

    const chart = svg
        .attr("width", containerWidth)
        .attr("height", containerHeight)
      .append("g")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`); // Center the chart

    // 1. Data Processing
    // Group data by the selected category and sum/average the value
    // Example: using d3.rollup
    const processedData = Array.from(
        d3.rollup(data, 
                 v => d3.sum(v, d => +d[valueDim]), // Summing the value, ensure it's a number
                 d => d[categoryDim]),
        ([key, value]) => ({ category: key, value: value })
    ).sort((a,b) => b.value - a.value); // Sort for better viz

    if (processedData.length === 0) {
        chart.append("text").text("No data for selected dimensions.").attr("text-anchor", "middle");
        return { update: () => {}, clearHighlight: () => {} };
    }
    
    // 2. Scales
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, 2 * Math.PI]) // Full circle
        .align(0);

    const yScale = d3.scaleRadial() // Use scaleRadial for radial charts
        .domain([0, d3.max(processedData, d => d.value)])
        .range([innerRadius, outerRadius]);

    // Global colorScale from dashboard.js is used here
    // Ensure its domain is updated if necessary, or let it assign colors dynamically
    // For this chart, we color by category
    colorScale.domain(processedData.map(d => d.category));


    // 3. Draw Bars (Arcs)
    const bars = chart.append("g")
      .selectAll("path")
      .data(processedData)
      .join("path")
        .attr("fill", d => colorScale(d.category))
        .attr("class", "bar-segment") // For styling and selection
        .attr("d", d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(innerRadius) // Start at innerRadius for transition
            .startAngle(d => xScale(d.category))
            .endAngle(d => xScale(d.category) + xScale.bandwidth())
            .padAngle(0.01)
            .padRadius(innerRadius))
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.7);
            showTooltip(event, `<strong>${d.category}</strong><br/>Value: ${d3.format(",.0f")(d.value)}`);
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            hideTooltip();
        })
        .on("click", function(event, d) {
            // Send filter information back to dashboard.js
            interactionCallback('radialBar', { type: 'category', dimension: categoryDim, value: d.category }, event);
            // Highlight this bar
            bars.classed("highlighted", false).classed("dimmed", true);
            d3.select(this).classed("highlighted", true).classed("dimmed", false);
        });

    // Transition for bars
    bars.transition()
        .duration(1000)
        .attrTween("d", function(d) {
            const i = d3.interpolate(innerRadius, yScale(d.value));
            return function(t) {
                return d3.arc()
                    .innerRadius(innerRadius)
                    .outerRadius(i(t))
                    .startAngle(xScale(d.category))
                    .endAngle(xScale(d.category) + xScale.bandwidth())
                    .padAngle(0.01)
                    .padRadius(innerRadius)();
            };
        });

    // 4. Add Labels (Optional, can get cluttered)
    chart.append("g")
      .selectAll("g")
      .data(processedData)
      .join("g")
        .attr("text-anchor", function(d) { return (xScale(d.category) + xScale.bandwidth() / 2 + Math.PI) % (2 * Math.PI) < Math.PI ? "end" : "start"; })
        .attr("transform", function(d) {
            return "rotate(" + ((xScale(d.category) + xScale.bandwidth() / 2) * 180 / Math.PI - 90) + ")"
                + "translate(" + (yScale(d.value) + 10) + ",0)"; // Position labels outside bars
        })
      .append("text")
        .text(d => d.category)
        .attr("transform", function(d) { return (xScale(d.category) + xScale.bandwidth() / 2 + Math.PI) % (2 * Math.PI) < Math.PI ? "rotate(180)" : "rotate(0)"; })
        .style("font-size", "10px")
        .attr("alignment-baseline", "middle");
    
    // Function to update chart based on external filters/data
    function update(filteredExtData, activeExtFilters) {
        // Check if this chart's driving dimension is part of the active filters
        let relevantFilterValue = null;
        Object.values(activeExtFilters).forEach(f => {
            if (f.dimension === categoryDim) {
                relevantFilterValue = f.value;
            }
        });

        bars.each(function(d_bar) {
            const isDimmed = Object.keys(activeExtFilters).length > 0 && // Are there any filters?
                             (!relevantFilterValue || d_bar.category !== relevantFilterValue) && // Is this bar NOT the one directly filtered?
                             !filteredExtData.some(fd => fd[categoryDim] === d_bar.category); // Is this bar's category not in the filtered data?

            const isHighlighted = relevantFilterValue && d_bar.category === relevantFilterValue;
            
            d3.select(this)
              .classed("highlighted", isHighlighted)
              .classed("dimmed", isDimmed && !isHighlighted); // Dim if filtered out and not explicitly highlighted
        });
    }
    
    function clearHighlight() {
        bars.classed("highlighted", false).classed("dimmed", false);
    }

    // Return methods for dashboard interaction
    return {
        update: update,
        clearHighlight: clearHighlight
    };
}