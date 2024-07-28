/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import { BaseType, select as d3Select, Selection as d3Selection } from "d3-selection";
import { scaleLinear, interpolateLab, ScaleLinear } from "d3";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

type Selection<T extends BaseType> = d3Selection<T, any, any, any>;

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import PrimativeValue = powerbi.PrimitiveValue;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;

import { ShapeChartSettingsModel } from "./settings";

/**
 * Interface for each category shown in the chart
 *
 * @interface
 * @property {string} name              - Name of the category
 * @property {string} color             - Color of the fill for this category
 * @property {ISelectionId} selectionId - The selectionId for the category (e.g. if you wanted to filter by this)
 */
export interface ShapeChartCategory {
    name: string;
    color: string;
    selectionId: ISelectionId;
}

/**
 * Interface for each polygon drawn to the chart
 *
 * @interface
 * @property {PrimitiveValue} value     - Data value for shape
 * @property {string} category          - Corresponding category of data value.
 * @property {string} color             - Color of the fill
 * @property {number} opacity           - Opacity of the fill
 * @property {string} strokeColor       - Stroke color
 * @property {number} strokeWidth       - Stroke width
 * @property {number} strokeOpacity     - Opacity of the outline
 * @property {string} wkt               - the raw wkt of the shape (only polygon supported for now)
 * @property {ISelectionId} selectionId - Id assigned to data point for cross filtering
 *                                        and visual interaction.
 */
export interface ShapeChartShape {
    value: PrimativeValue;
    category: string;
    color: string;
    opacity: number;
    wkt: string;
    //selectionId: ISelectionId;
}

/**
 * Interface to capture all the data needed to draw the chart
 *
 * @interface
 * @property {ShapeChartShape[]} dataPoints         - Set of all Shapes to draw
 * @property {number} dataMax                       - Maximum value in the dataset
 * @property {number} dataMin                       - Minimum value in the dataset
 * @property {[name: string]: ShapeChartCategory}   - List of all the categories
 */
export interface ShapeChartViewModel {
    dataPoints: ShapeChartShape[];
    dataMax: number;
    dataMin: number;
    categories: { [name: string]: ShapeChartCategory };
}

/**
 * Function that converts wkt to an svg polygon
 * 
 * This is only a demo: Only POLYGONs are supported, without any extra spaces
 * e.g. POLYGON((10 10, 20 10, 20 20, 10 20, 10 10))
 *
 * @function
 * @param {string} dataView                             - the wkt to convert
 * @param {ScaleLinear<number, number, never>} scaleX   - Contains references to the visual host.
 * @param {ScaleLinear<number, number, never>} scaleY   - Reference to the settings for the visual (to update categories)
 */
function points_from_wkt(wkt: string, scaleX: ScaleLinear<number, number, never>, scaleY: ScaleLinear<number, number, never>): string {
    // We blindly try to convert and return empty string if anything fails
    try {
        const output = [];
        // Strip off the POLYGON(...)
        const [, inner] = wkt.match(/^POLYGON\((.+)\)$/i);
        // Separate out each linearRing
        const rings = [...inner.matchAll(/\(([^)]+)\)/gi)];
        rings.forEach(ringMatch => {
            // pull out each pair of co-ordinates
            const pairs = ringMatch[1].split(", ");
            pairs.forEach(pair => {
                // scale each pair of x,y
                const [x, y] = pair.split(" ");
                const xOut = scaleX(Number(x));
                const yOut = scaleY(Number(y));
                output.push([xOut, yOut].join(","));
            })
        })
        // then finally, join our points with spaces
        return output.join(" ")
    } catch (e) {
        return ""
    }
}

/**
 * Function that converts queried data into a view model that will be used by the visual.
 *
 * @function
 * @param {DataView} dataView                   - Contains all the data the visual had queried.
 * @param {IVisualHost} host                    - Contains references to the visual host.
 * @param {ShapeChartSettingsModel} settings    - Reference to the settings for the visual (to update categories)
 */
function visualTransform(dataView: DataView, host: IVisualHost, settings: ShapeChartSettingsModel): ShapeChartViewModel {
    const viewModel: ShapeChartViewModel = {
        dataPoints: [],
        dataMax: 1,
        dataMin: 0,
        categories: {},
    }

    // return our empty model if the data is missing
    if (!dataView
        || !dataView.categorical
        || !dataView.categorical.categories
        || !dataView.categorical.categories[0].source
        || !dataView.categorical.values
    ) {
        return viewModel;
    }

    const categories = viewModel.categories;
    const grouped = dataView.categorical.values.grouped();
    const colorPalette = host.colorPalette;

    // load the categories
    if (grouped.length == 1 && grouped[0].name == undefined) {
        viewModel.dataMin = Number(dataView.categorical.values[0].minLocal);
        viewModel.dataMax = Number(dataView.categorical.values[0].maxLocal);
    } else {
        grouped.forEach((group, index) => {
            const name = group.name.toString();
            let color: string;
            const selectionId = host.createSelectionIdBuilder()
                .withSeries(dataView.categorical.values, dataView.categorical.values[index])
                .createSelectionId();
            if (group.objects && group.objects.categoricalColor) {
                color = (group.objects.categoricalColor.fill as any).solid.color;
            } else {
                color = colorPalette.getColor(name).value;
            }
            categories[name] = {
                name,
                color,
                selectionId,
            };
        });
    }
    // Update the settings with our new categorical colours
    settings.populateColorSelector(categories)

    // Set the color scale in case we have no category colours
    const scaleColor = scaleLinear([viewModel.dataMin, viewModel.dataMax],
        [settings.colorRampCard.minColor.value.value, settings.colorRampCard.maxColor.value.value])
        .interpolate(interpolateLab); // Why would you ever interpolate in RGB, you monster!

    // Load the shapes
    const data = [{
        polygon: "POLYGON((10 10, 20 10, 20 20, 10 20, 10 10))",
        category: null,
        value: 0.1,
    }];

    data.forEach(element => {
        let color: string;
        if (element.category == null) {
            color = scaleColor(element.value);
        } else {
            color = categories[element.category].color;
        }
        viewModel.dataPoints.push({
            value: element.value,
            category: element.category,
            color: color,
            opacity: 1.0,
            wkt: element.polygon,
            //selectionId: ISelectionId,
        })
    });

    // Finally return the 
    return viewModel
}

export class ShapeVisual implements IVisual {
    private host: IVisualHost;
    private svg: Selection<SVGSVGElement>;
    private formattingSettings: ShapeChartSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private dataView: ShapeChartViewModel;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.formattingSettingsService = new FormattingSettingsService();

        this.svg = d3Select(options.element)
            .append('svg')
            .classed('shapevisual', true);
    }

    public update(options: VisualUpdateOptions) {
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(ShapeChartSettingsModel, options.dataViews[0]);
        this.dataView = visualTransform(options.dataViews[0], this.host, this.formattingSettings);

        const width = options.viewport.width;
        const height = options.viewport.height;

        this.svg
            .attr("width", width)
            .attr("height", height);

        const scaleX = scaleLinear()
            .range([0, width])
            .domain([0, 100])   // Fixed domain for demo purposes - should probably scale to input or add settings

        const scaleY = scaleLinear()
            .range([height, 0]) // svgs have 0 in top left not bottom left
            .domain([0, 50])    // Fixed domain for demo purposes - should probably scale to input or add settings

        this.svg.selectAll("polygon")
            .data(this.dataView.dataPoints)
            .join("polygon")
            .attr("stroke", this.formattingSettings.shapeCard.borderColor.value.value)
            .attr("stroke-width", this.formattingSettings.shapeCard.borderWidth.value)
            .attr("stroke-opacity", this.formattingSettings.shapeCard.borderOpacity.value * 0.01)
            .attr("points", function (d) {
                return points_from_wkt(d.wkt, scaleX, scaleY);
            })
            .attr("fill", function (d) {
                return d.color;
            })
    }

    /**
     * Returns properties pane formatting model content hierarchies, properties and latest formatting values, Then populate properties pane.
     * This method is called once every time we open properties pane or when the user edit any format property. 
     */
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}