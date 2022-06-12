import { interpolateBin, calcPan, generateSummary } from "./utils.js";
import { HERTZ, SPEEDS } from "./constants.js";
import { SonifyTypes, AxisData, dataPoint, dataSet } from "./types";
import {ScreenReaderBridge} from "./ScreenReaderBridge.js";

let context = null;

const NOTE_LENGTH = .25;

const calculateAxisMinimum = (data: any[][], prop: "x" | "y") => {
    const values = data.flat().map((point) => point[prop]);
    return Math.min(...values);
}
const calculateAxisMaximum = (data: any[][], prop: "x" | "y") => {
    const values = data.flat().map((point) => point[prop]);
    return Math.max(...values);
}

const defaultFormat = (value: number) => `${value}`;


// {label: [{}, {}]}

export class Sonify {
    private _chartElement: HTMLElement;
    private _ccElement: HTMLElement;
    private _summary: string;
    private _groups: string[];
    private _data: dataPoint[][];
    private _groupIndex = 0;
    private _pointIndex = 0;
    private _sr: ScreenReaderBridge;
    private _xAxis: AxisData;
    private _yAxis: AxisData;
    private _title: string;
    private _playListInterval: number | null = null;
    private _speedRateIndex = 1;
    private _flagNewGroup = false;

    constructor(input: SonifyTypes) {
        this._chartElement = input.element;
        this._ccElement = input.cc ?? this._chartElement;
        this._title = input.title ?? "";

        this._initializeData(input.data);

        this._xAxis = this._initializeAxis("x", input.axes?.x);
        this._yAxis = this._initializeAxis("y", input.axes?.y);

        // Generate summary
        this._summary = generateSummary(this._title, this._xAxis, this._yAxis);

        // Initialize SRB
        ScreenReaderBridge.addAriaAttributes(this._ccElement);
        this._sr = new ScreenReaderBridge(this._ccElement);

        this._startListening();
    }

    private _initializeData(userData: number[] | dataPoint[] | dataSet){
        if(!Array.isArray(userData)){
            // Data is presumably of type dataSet. No other effort necessary.
            this._groups = Object.keys(userData);
            this._data = Object.values(userData);
            return;
        }

        const massagedData: dataPoint[] = userData.map((point: number | dataPoint, index: number) => {
            if(typeof point === "number"){
                return {
                    x: index,
                    y: point
                };
            }
            return point;
        });

        this._groups = [""];
        this._data = [massagedData];
    }

    private _initializeAxis(axisName: "x" | "y", userAxis?: AxisData): AxisData {
        return {
            minimum: userAxis?.minimum ?? calculateAxisMinimum(this._data, axisName),
            maximum: userAxis?.maximum ?? calculateAxisMaximum(this._data, axisName),
            label: userAxis?.label ?? "",
            format: userAxis?.format ?? defaultFormat
        };
    }

    private _startListening(){
        this._chartElement.addEventListener("focus", () => {
            if(context === null){
                context = new AudioContext();
            }
            this._sr.render(this._summary);
        });

        this._chartElement.addEventListener("keydown", (e) => {
            clearInterval(this._playListInterval);

            switch(e.key){
                case "ArrowRight": {
                    if(e.shiftKey){
                        this._playAllRight();
                        e.preventDefault();
                        return;
                    }else{
                        this._moveRight();
                    }
                    break;
                }
                case "ArrowLeft": {
                    if(e.shiftKey){
                        this._playAllLeft();
                        e.preventDefault();
                        return;
                    }else{
                        this._moveLeft();
                    }
                    break;
                }
                case "PageUp": {
                    if(this._groupIndex === 0){
                        e.preventDefault();
                        return;
                    }
                    this._groupIndex--;
                    this._flagNewGroup = true;
                    break;
                }
                case "PageDown": {
                    if(this._groupIndex === this._data.length - 1){
                        e.preventDefault();
                        return;
                    }
                    this._groupIndex++;
                    this._flagNewGroup = true;
                    break;
                }
                case "Home": {
                    this._pointIndex = 0;
                    break;
                }
                case "End": {
                    this._pointIndex = this._data[this._groupIndex].length - 1;
                    break;
                }
                case " ": {
                    this._flagNewGroup = true;
                    break;
                }
                case "q": {
                    if(this._speedRateIndex > 0){
                        this._speedRateIndex--;
                    }
                    this._sr.render(`Speed, ${SPEEDS[this._speedRateIndex]}`);
                    return;
                }
                case "e": {
                    if(this._speedRateIndex < SPEEDS.length - 1){
                        this._speedRateIndex++;
                    }
                    this._sr.render(`Speed, ${SPEEDS[this._speedRateIndex]}`);
                    return;
                }
                default: {
                    return;
                }
            }
            e.preventDefault();


            this._playCurrent();
            setTimeout(() => {
                this._speakCurrent();
            }, (NOTE_LENGTH * 1000));
        });
    }

    private _moveRight() {
        const max = this._data[this._groupIndex].length - 1;
        if(this._pointIndex >= max){
            this._pointIndex = max;
            return;
        }
        this._pointIndex++;
    }

    private _moveLeft() {
        if(this._pointIndex <= 0){
            this._pointIndex = 0;
            return;
        }
        this._pointIndex--;
    }
    
    private _playAllLeft() {
        const min = 0;
        this._playListInterval= setInterval(() => {
            if(this._pointIndex <= min){
                this._pointIndex = min;
                clearInterval(this._playListInterval);
            }else{
                this._pointIndex--;
                this._playCurrent();
            }
        }, SPEEDS[this._speedRateIndex]);
        this._playCurrent();
    }
    
    private _playAllRight() {
        const max = this._data[this._groupIndex].length - 1;
        this._playListInterval= setInterval(() => {
            if(this._pointIndex >= max){
                this._pointIndex = max;
                clearInterval(this._playListInterval);
            }else{
                this._pointIndex++;
                this._playCurrent();
            }
        }, SPEEDS[this._speedRateIndex]);
        this._playCurrent();
    }

    private _playCurrent() {
        const current = this._data[this._groupIndex][this._pointIndex];

        const yBin = interpolateBin(current.y, this._yAxis.minimum, this._yAxis.maximum, HERTZ.length-1);
        const xPan = calcPan( (current.x - this._xAxis.minimum) / (this._xAxis.maximum - this._xAxis.minimum) );
        
        pianist(yBin, xPan);

        current.callback?.();
    }

    private _speakCurrent() {
        // If we're glagged to announce a new group, but the group name is empty, ignore the flag
        if(this._flagNewGroup && this._groups[this._groupIndex] === ""){
            this._flagNewGroup = false;
        }

        const current = this._data[this._groupIndex][this._pointIndex];
        const point = `${this._xAxis.format(current.x)}, ${this._yAxis.format(current.y)}`;
        const text = (this._flagNewGroup ? `${this._groups[this._groupIndex]}, ` : "") + point;

        this._sr.render(text);

        this._flagNewGroup = false;
    }

}

const pianist = (noteIndex: number, positionX: number) => {
    // Pan note
    const panner = new PannerNode(context, {positionX});
    panner.connect(context.destination);

    // Gain (so that you don't hear clipping)
    const gain = new GainNode(context);
    gain.gain.setValueAtTime(1, context.currentTime);
    gain.connect(panner);

    // Oscillator
    const osc = new OscillatorNode(context);
    osc.frequency.setValueAtTime(HERTZ[noteIndex], context.currentTime);
    osc.connect(gain);

    osc.start();
    gain.gain.setValueAtTime(0.01, context.currentTime + NOTE_LENGTH);
    osc.stop(context.currentTime + NOTE_LENGTH + .1);
}
