/*
 *  Power BI Visualizations
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

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { ShapeChartCategory } from "./visual";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

/**
 * Shape Formatting Card
 */
class ShapeCardSettings extends FormattingSettingsCard {
    name: string = "shapes";
    displayName: string = "Shapes";

    borderColor = new formattingSettings.ColorPicker({
        name: "borderColor",
        displayName: "Border Colour",
        value: { value: "#000000" }
    });

    borderOpacity = new formattingSettings.Slider({
        name: "maxColor",
        displayName: "Border Opacity",
        value: 100,
        options: {
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0,
            },
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 100,
            },
        }
    });

    borderWidth = new formattingSettings.NumUpDown({
        name: "borderWidth",
        displayName: "Border Width",
        description: "The width of the border in pixels",
        value: 2,
        options: {
            unitSymbol: "px",
            unitSymbolAfterInput: false,
        }
    });

    slices: Array<FormattingSettingsSlice> = [this.borderColor, this.borderOpacity, this.borderWidth];
}

/**
 * ColorRamp Formatting Card
 */
class ColorRampCardSettings extends FormattingSettingsCard {
    name: string = "colorRamp";
    displayName: string = "Colour Ramp";

    minColor = new formattingSettings.ColorPicker({
        name: "minColor",
        displayName: "Min Colour",
        value: { value: "#deefff" }
    });

    maxColor = new formattingSettings.ColorPicker({
        name: "maxColor",
        displayName: "Max Colour",
        value: { value: "#118dff" }
    });

    slices: Array<FormattingSettingsSlice> = [this.minColor, this.maxColor];
}

/**
 * Legend Color Formatting Card
 */
class LegendColorCardSettings extends FormattingSettingsCard {
    name: string = "legendColor";
    displayName: string = "Category Colours";

    // slices will be populated in `populateColorSelector` method
    slices: Array<FormattingSettingsSlice> = [];
}

/**
* visual settings model class
*
*/
export class ShapeChartSettingsModel extends FormattingSettingsModel {
    // Create formatting settings model formatting cards
    shapeCard = new ShapeCardSettings();
    colorRampCard = new ColorRampCardSettings();
    legendColorCard = new LegendColorCardSettings();

    cards = [this.shapeCard, this.colorRampCard, this.legendColorCard];

    /**
     * populate colorSelector object categories formatting properties
     * @param categories 
     */
    populateColorSelector(categories: {[name: string]: ShapeChartCategory}) {
        const slices: FormattingSettingsSlice[] = this.legendColorCard.slices;
        if (categories && Object.keys(categories).length > 0) {
            Object.values(categories).forEach(category => {
                slices.push(new formattingSettings.ColorPicker({
                    name: "fill",
                    displayName: category.name,
                    value: { value: category.color },
                }));
            });
            this.legendColorCard.visible = true;
        } else {
            this.legendColorCard.visible = false;
        }
    }
}
