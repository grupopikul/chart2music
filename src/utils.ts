import type {
    AlternateAxisDataPoint,
    OHLCDataPoint,
    SimpleDataPoint,
    SupportedDataPointType
} from "./dataPoint";
import {
    isOHLCDataPoint,
    isAlternateAxisDataPoint,
    isHighLowDataPoint,
    isSimpleDataPoint,
    isBoxDataPoint
} from "./dataPoint";
import type {
    AxisData,
    StatBundle,
    validAxes,
    detectableDataPoint,
    groupedMetadata,
    SonifyTypes,
    dataSet,
    AxisScale
} from "./types";

export const interpolateBin = (
    point: number,
    min: number,
    max: number,
    bins: number,
    scale: AxisScale
) => {
    return scale === "linear"
        ? interpolateBinLinear(point, min, max, bins)
        : interpolateBinLog(point, min, max, bins);
};

const interpolateBinLinear = (
    point: number,
    min: number,
    max: number,
    bins: number
) => {
    const pct = (point - min) / (max - min);
    return Math.floor(bins * pct);
};

const interpolateBinLog = (
    pointRaw: number,
    minRaw: number,
    maxRaw: number,
    bins: number
) => {
    const point = Math.log10(pointRaw);
    const min = Math.log10(minRaw);
    const max = Math.log10(maxRaw);
    const pct = (point - min) / (max - min);
    return Math.floor(bins * pct);
};

export const calcPan = (pct: number) => (isNaN(pct) ? 0 : (pct * 2 - 1) * 0.98);

const isNotNull = (tmp: unknown) => tmp !== null;

export const calculateAxisMinimum = (
    data: SupportedDataPointType[][],
    prop: "x" | "y" | "y2",
    filterGroupIndex?: number
) => {
    let dataToProcess: SupportedDataPointType[] = data.flat().filter(isNotNull);

    if (filterGroupIndex >= 0 && filterGroupIndex < data.length) {
        dataToProcess = data[filterGroupIndex];
    }

    const values: number[] = dataToProcess
        .map((point: SupportedDataPointType): number => {
            if (isSimpleDataPoint(point)) {
                if (prop === "x" || prop === "y") {
                    return point[prop];
                }
            } else if (isAlternateAxisDataPoint(point)) {
                if (prop === "x" || prop === "y2") {
                    return point[prop];
                }
            } else if (isOHLCDataPoint(point)) {
                if (prop === "x") {
                    return point.x;
                }
                if (prop === "y") {
                    return Math.min(
                        point.high,
                        point.low,
                        point.open,
                        point.close
                    );
                }
            } else if (isHighLowDataPoint(point)) {
                if (prop === "x") {
                    return point.x;
                }
                if (prop === "y") {
                    return Math.min(point.high, point.low);
                }
            }
            return NaN;
        })
        .filter((num) => !isNaN(num));
    if (values.length === 0) {
        return NaN;
    }
    return Math.min(...values);
};
export const calculateAxisMaximum = (
    data: SupportedDataPointType[][],
    prop: "x" | "y" | "y2",
    filterGroupIndex?: number
) => {
    let dataToProcess: SupportedDataPointType[] = data.flat().filter(isNotNull);

    if (filterGroupIndex >= 0 && filterGroupIndex < data.length) {
        dataToProcess = data[filterGroupIndex];
    }

    const values: number[] = dataToProcess
        .map((point: SupportedDataPointType): number => {
            if (isSimpleDataPoint(point)) {
                if (prop === "x" || prop === "y") {
                    return point[prop];
                }
            } else if (isAlternateAxisDataPoint(point)) {
                if (prop === "x" || prop === "y2") {
                    return point[prop];
                }
            } else if (isOHLCDataPoint(point)) {
                if (prop === "x") {
                    return point.x;
                }
                if (prop === "y") {
                    return Math.max(
                        point.high,
                        point.low,
                        point.open,
                        point.close
                    );
                }
            } else if (isHighLowDataPoint(point)) {
                if (prop === "x") {
                    return point.x;
                }
                if (prop === "y") {
                    return Math.max(point.high, point.low);
                }
            }
            return NaN;
        })
        .filter((num) => !isNaN(num));
    if (values.length === 0) {
        return NaN;
    }
    return Math.max(...values);
};

export const defaultFormat = (value: number) => `${value}`;

export const sentenceCase = (str: string) =>
    `${str.substring(0, 1).toUpperCase()}${str.substring(1).toLowerCase()}`;

export const generatePointDescription = (
    point: SupportedDataPointType,
    xFormat: AxisData["format"],
    yFormat: AxisData["format"],
    stat?: keyof StatBundle,
    outlierIndex: number | null = null,
    announcePointLabelFirst = false
) => {
    if (isOHLCDataPoint(point)) {
        if (typeof stat !== "undefined") {
            return `${xFormat(point.x)}, ${yFormat(
                point[stat as keyof OHLCDataPoint] as number
            )}`;
        }
        return [
            `${xFormat(point.x)}, ${yFormat(point.open)}`,
            yFormat(point.high),
            yFormat(point.low),
            yFormat(point.close)
        ].join(" - ");
    }

    if (isBoxDataPoint(point) && outlierIndex !== null) {
        return `${xFormat(point.x)}, ${yFormat(point.outlier[outlierIndex])}, ${
            outlierIndex + 1
        } of ${point.outlier.length}`;
    }

    if (isBoxDataPoint(point) || isHighLowDataPoint(point)) {
        if (typeof stat !== "undefined") {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return `${xFormat(point.x)}, ${yFormat(point[stat])}`;
        }
        const outlierNote =
            "outlier" in point && point.outlier?.length > 0
                ? `, with ${point.outlier.length} outliers`
                : "";
        return `${xFormat(point.x)}, ${yFormat(point.high)} - ${yFormat(
            point.low
        )}${outlierNote}`;
    }

    if (isSimpleDataPoint(point)) {
        const details = [xFormat(point.x), yFormat(point.y)];
        if (point.label) {
            if (announcePointLabelFirst) {
                details.unshift(point.label);
            } else {
                details.push(point.label);
            }
        }
        return details.join(", ");
    }

    if (isAlternateAxisDataPoint(point)) {
        return `${xFormat(point.x)}, ${yFormat(point.y2)}`;
    }

    return "";
};

export const usesAxis = (
    data: SupportedDataPointType[][],
    axisName: "x" | "y" | "y2"
) => {
    const firstUseOfAxis = data.filter(isNotNull).find((row) => {
        return row.find((point) => axisName in point);
    });
    return typeof firstUseOfAxis !== "undefined";
};

/**
 * Determine metadata about data sets, to help users navigate more effectively
 * @param data - the X/Y values
 */
export const calculateMetadataByGroup = (
    data: (SupportedDataPointType[] | null)[]
): groupedMetadata[] => {
    return data.map((row, index) => {
        if (row === null) {
            return {
                index,
                minimumPointIndex: null,
                maximumPointIndex: null,
                minimumValue: NaN,
                maximumValue: NaN,
                tenths: NaN,
                availableStats: [],
                statIndex: -1,
                inputType: null,
                size: 0
            };
        }

        let yValues: number[] = [];
        let availableStats = [];
        if (isSimpleDataPoint(row[0])) {
            yValues = (row as SimpleDataPoint[]).map(({ y }) => y);
        } else if (isAlternateAxisDataPoint(row[0])) {
            yValues = (row as AlternateAxisDataPoint[]).map(({ y2 }) => y2);
        } else if (isOHLCDataPoint(row[0])) {
            // Don't calculate min/max for high/low
            availableStats = ["open", "high", "low", "close"];
        } else if (isBoxDataPoint(row[0])) {
            availableStats = ["high", "q3", "median", "q1", "low", "outlier"];
        } else if (isHighLowDataPoint(row[0])) {
            // Don't calculate min/max for high/low
            availableStats = ["high", "low"];
        }

        const filteredYValues = yValues.filter((num) => !isNaN(num));

        // Calculate min/max
        // (set to -1 if there are no values to calculate, such as in the case of OHLC data)
        const [min, max] =
            filteredYValues.length > 0
                ? [Math.min(...filteredYValues), Math.max(...filteredYValues)]
                : [-1, -1];

        // Calculate tenths
        const tenths = Math.round(row.length / 10);

        return {
            index,
            minimumPointIndex: yValues.indexOf(min),
            maximumPointIndex: yValues.indexOf(max),
            minimumValue: min,
            maximumValue: max,
            tenths,
            availableStats,
            statIndex: -1,
            inputType: detectDataPointType(row[0]),
            size: row.length
        };
    });
};

/**
 * Initialize internal representation of axis metadata. Providing metadata is optional, so we
 * need to generate metadata that hasn't been provided.
 * @param data - the X/Y values
 * @param axisName - which axis is this? "x" or "y"
 * @param userAxis - metadata provided by the invocation
 * @param filterGroupIndex -
 */
export const initializeAxis = (
    data: SupportedDataPointType[][],
    axisName: validAxes,
    userAxis?: AxisData,
    filterGroupIndex?: number
): AxisData => {
    const format =
        userAxis?.format ??
        ("valueLabels" in userAxis
            ? (index) => userAxis.valueLabels[index]
            : defaultFormat);

    return {
        minimum:
            userAxis?.minimum ??
            calculateAxisMinimum(data, axisName, filterGroupIndex),
        maximum:
            userAxis?.maximum ??
            calculateAxisMaximum(data, axisName, filterGroupIndex),
        label: userAxis?.label ?? "",
        type: userAxis?.type ?? "linear",
        format,
        continuous: userAxis.continuous ?? false
    };
};

export const detectDataPointType = (query: unknown): detectableDataPoint => {
    if (typeof query === "number") {
        return "number";
    }
    if (typeof query !== "object") {
        return "unknown";
    }

    if (isSimpleDataPoint(query)) {
        return "SimpleDataPoint";
    }

    if (isAlternateAxisDataPoint(query)) {
        return "AlternativeAxisDataPoint";
    }

    if (isOHLCDataPoint(query)) {
        return "OHLCDataPoint";
    }

    if (isBoxDataPoint(query)) {
        return "BoxDataPoint";
    }

    if (isHighLowDataPoint(query)) {
        return "HighLowDataPoint";
    }

    return "unknown";
};

export const convertDataRow = (
    row: (SupportedDataPointType | number)[] | null
) => {
    if (row === null) {
        return null;
    }

    return row.map((point: number | SupportedDataPointType, index: number) => {
        if (typeof point === "number") {
            return {
                x: index,
                y: point
            } as SupportedDataPointType;
        }
        return point;
    });
};

export const formatWrapper = (axis: AxisData) => {
    const format = (num: number) => {
        if (isNaN(num)) {
            return "missing";
        }
        if (axis.minimum && num < axis.minimum) {
            return "too low";
        }
        if (axis.maximum && num > axis.maximum) {
            return "too high";
        }
        return axis.format(num);
    };

    return format;
};

/**
 *
 */
type ChartSummaryType = {
    groupCount: number;
    title: string;
    live?: boolean;
    hierarchy?: boolean;
};
export const generateChartSummary = ({
    title,
    groupCount,
    live = false,
    hierarchy = false
}: ChartSummaryType) => {
    const text = ["Sonified"];

    if (live) {
        text.push("live");
    }

    if (hierarchy) {
        text.push("hierarchical");
    }

    text.push("chart");

    if (groupCount > 1) {
        text.push(`with ${groupCount} groups`);
    }

    if (title.length > 0) {
        text.push(`titled "${title}"`);
    }

    return text.join(" ") + ".";
};

const axisDescriptions = {
    x: "X",
    y: "Y",
    y2: "Alternate Y"
};
export const generateAxisSummary = (
    axisLetter: "x" | "y" | "y2",
    axis: AxisData
) =>
    `${axisDescriptions[axisLetter]} is "${
        axis.label ?? ""
    }" from ${axis.format(axis.minimum)} to ${axis.format(axis.maximum)}${
        axis.type === "log10" ? " logarithmic" : ""
    }${axisLetter === "x" && axis.continuous ? " continuously" : ""}.`;

/**
 *
 */
type InstructionsType = {
    hierarchy: boolean;
    live: boolean;
    hasNotes: boolean;
};
export const generateInstructions = ({
    hierarchy,
    live,
    hasNotes
}: InstructionsType) => {
    const keyboardMessage = filteredJoin(
        [
            `Use arrow keys to navigate.`,
            hierarchy && "Use Alt + Up and Down to navigate between levels.",
            live && "Press M to toggle monitor mode.",
            "Press H for more hotkeys."
        ],
        " "
    );

    const info = [keyboardMessage];

    if (hasNotes) {
        info.unshift("Has notes.");
    }
    return info.join(" ");
};

export const isUnplayable = (yValue: number, yAxis: AxisData) => {
    return isNaN(yValue) || yValue < yAxis.minimum || yValue > yAxis.maximum;
};

export const prepChartElement = (elem: HTMLElement, title: string) => {
    if (!elem.hasAttribute("alt") && !elem.hasAttribute("aria-label")) {
        elem.setAttribute("aria-label", `${title}, Sonified chart`);
    }

    if (!elem.hasAttribute("role")) {
        elem.setAttribute("role", "application");
    }
};

export const checkForNumberInput = (
    metadataByGroup: groupedMetadata[],
    data: SonifyTypes["data"]
) => {
    if (Array.isArray(data) && typeof data[0] === "number") {
        metadataByGroup[0].inputType = "number";
    } else {
        let index = 0;
        for (const group in data) {
            if (
                data[group] !== null &&
                detectDataPointType((data as dataSet)[group][0]) === "number"
            ) {
                metadataByGroup[index].inputType = "number";
            }
            index++;
        }
    }

    return metadataByGroup;
};

// https://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
export const detectIfMobile = () => {
    const toMatch = [
        /Android/i,
        /webOS/i,
        /iPhone/i,
        /iPad/i,
        /iPod/i,
        /BlackBerry/i,
        /Windows Phone/i
    ];

    return toMatch.some((toMatchItem) => {
        return navigator.userAgent.match(toMatchItem);
    });
};

export const filteredJoin = (arr: string[], joiner: string) =>
    arr.filter((item) => Boolean(item)).join(joiner);
