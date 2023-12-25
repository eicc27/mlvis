import DataReader, { column, concat, groupByIndex } from "../data";
import * as d3 from "d3";

export type DecisionNode = {
    type: 'decision';
    data: string[][];
    idx: number[];
    desc: string;
    gain: number;
    children: DecisionTreeNode[];
};

export type LeafNode = {
    type: 'leaf';
    data: string; // label
};

export type DecisionTreeNode = DecisionNode | LeafNode;

export function informationLoss(data: number[]) {
    const m = new Map<number, number>();
    data.forEach(x => {
        if (!m.has(x))
            m.set(x, 0);
        m.set(x, m.get(x)! + 1);
    });
    let loss = 0;
    m.forEach((v, _) => {
        const p = v / data.length;
        loss -= p * Math.log2(p);
    });
    return loss;
}

export function informationGain(rel: number, pred: number[], label: number[]) {
    const data = concat(pred, label);
    const groups = groupByIndex(data, x => x[0]); // group by different data values
    let gain = rel;
    groups.forEach((v, _) => {
        const w = v.length / pred.length;
        const loss = informationLoss(column(data.filter((_, i) => v.includes(i)), -1)); // for each group, compute information loss
        gain -= w * loss;
    });
    return gain;
}

export default class DecisionTree {
    private root: DecisionTreeNode;
    public constructor(data: string[][], private labels: string[] = []) {
        if (!data.length) {
            this.root = {
                type: 'leaf',
                data: ''
            };
            return;
        }
        const { maps, res } = DataReader.classify(data);
        console.log(res);
        this.root = {
            type: 'decision',
            data,
            idx: d3.range(data.length),
            desc: 'root',
            gain: informationLoss(column(res, -1)),
            children: []
        };
    }

    public build() {
        this.buildNode(this.root);
    }

    private buildNode(root: DecisionTreeNode, skipCols: number[] = []) {
        // recursion end
        if (root.type == 'leaf')
            return;
        // current
        const { maps, res } = DataReader.classify(root.data);
        const labelCol = column(res, -1);
        if (labelCol.every(x => x == labelCol[0])) // the labels are all the same
        {
            const m = maps.get(res[0].length - 1)! as Map<string, number>;
            let data = '';
            m.forEach((v, k) => {
                if (v == labelCol[0])
                    data = k;
            })
            root.children.push({
                type: 'leaf',
                data,
            });
            return;
        }
        console.log(maps);
        // compute information gain
        let maxGain = -Infinity;
        let maxGainIndex = -1;
        for (let i = 0; i < res[0].length - 1; i++) { // compute information gain for each column
            const col = column(res, i);
            // skip column with only one value
            if (new Set(col).size == 1) {
                console.log(`Skip ${i}_th column because it has only one value`)
                continue;
            }
            // skip label column
            if (skipCols.includes(i)) {
                console.log(`Skip ${i}_th column because it has been used`);
                continue;
            }
            const gain = informationGain(root.gain, col, labelCol);
            console.log(`Information gain of ${i}_th column is ${gain}`);
            if (gain > maxGain) {
                maxGain = gain;
                maxGainIndex = i;
            }
        }
        // add maxGainIndex into skipCols
        if (!(maps.has(maxGainIndex) && typeof maps.get(maxGainIndex)! == "number")) {
            console.log(`Skip ${maxGainIndex}_th column because it is not a continuous value`);
            skipCols.push(maxGainIndex);
        }
        // group the data by the column with max information gain
        groupByIndex(res, x => x[maxGainIndex]).forEach((indexes, value) => {
            let desc = `${maxGainIndex}_th column = ${value}`;
            if (maps.has(maxGainIndex)) {
                const map = maps.get(maxGainIndex)!;
                const descLabel = this.labels.length ? this.labels[maxGainIndex] : `c${maxGainIndex}`;
                if (typeof map == "number") { // originally a continuous value
                    if (value == 0)
                        desc = `${descLabel} < ${map.toFixed(2)}`;
                    else
                        desc = `${descLabel} >= ${map.toFixed(2)}`;
                } else { // originally a named value
                    let colLabel = '';
                    map.forEach((v1, k1) => {
                        if (v1 == value)
                            colLabel = k1;
                    });
                    desc = `${descLabel} = ${colLabel}`;
                }
            }
            const data = root.data.filter((_, i) => indexes.includes(i));
            console.log(desc, data);
            root.children.push({
                type: 'decision',
                data,
                desc,
                idx: indexes,
                gain: maxGain,
                children: []
            });
        });
        // recursion
        root.children.forEach(child => this.buildNode(child, skipCols));
    }

    public get rootData() {
        return this.root;
    }

    public get Label() {
        return this.labels;
    }
}