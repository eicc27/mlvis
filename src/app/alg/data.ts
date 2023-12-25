export function classify(original: number[]): number;
export function classify(original: string[]): Map<string, number>;
export function classify(original: number[] | string[]) {
    const classifyString = (original: string[]) => {
        const m = new Map<string, number>();
        let i = 0;
        original.forEach(x => {
            if (!m.has(x))
                m.set(x, i++);
        });
        return m;
    };
    const classifyNumber = (original: number[]) => {
        const sorted = original.toSorted();
        const mid = (sorted.at(0)! + sorted.at(-1)!) / 2;
        return mid;
    }
    if (original.length === 0) {
        throw new Error('Empty array');
    }
    if (typeof original[0] == 'string')
        return classifyString(original as string[]);
    else
        return classifyNumber(original as number[]);
}

export function inferType(value: string) {
    if (value.match(/^-?\d+$/))
        return 'number';
    else if (value.match(/^-?\d+\.\d+$/))
        return 'float';
    else
        return 'string';
}

export function column<T>(matrix: T[][], at: number) {
    return matrix.map(row => row.at(at)!);
}

export function sizeof<T>(matrix: T[][]) {
    if (!matrix.length)
        return 0
    return [matrix.length, matrix[0].length]
}

export function transpose<T>(matrix: T[][]) {
    const m: T[][] = [];
    if (!sizeof(matrix))
        return m;
    matrix[0].forEach((_, i) => {
        m.push(column(matrix, i));
    });
    return m;
}

export function groupByIndex<T, V>(data: Iterable<T>, fn: (x: T) => V): Map<V, number[]> {
    const m = new Map<V, number[]>();
    let i = 0;
    for (const d of data) {
        const v = fn(d);
        if (!m.has(v))
            m.set(v, []);
        m.set(v, m.get(v)!.concat(i++));
    }
    return m;
}


export function concat<T>(a: T[], b: T[]): T[][];
export function concat<T>(a: T[][], b: T[]): T[][]; // when b is a 1d array, concat through columns
export function concat<T>(a: T[][], b: T[][]): T[][]; // when b is a 2d array, concat through rows
export function concat<T>(a: T[] | T[][], b: T[] | T[][]) {
    if (a.length == 0) {
        return b.map(x => [x]);
    }
    const res: T[][] = [];
    if (a[0] instanceof Array) { // a is a matrix
        if (b[0] instanceof Array) { // b is a matrix
            (a as T[][]).forEach(row => res.push(row));
            (b as T[][]).forEach(row => res.push(row));
            return res;
        } else { // b is a vector
            (a as T[][]).forEach((row, i) => res.push(row.concat(b[i] as T)));
            return res;
        }
    } else { // a is a vector
        // then b is a vector
        (a as T[]).forEach((x, i) => res.push([x, b[i] as T]));
        return res;
    }
}

export default class DataReader {
    private data: string[][] = [];
    public constructor(private path: string) { }
    public async read(hasHeader: boolean = false, excludeColumns: number[] = []): Promise<[string[][], string[]]> {
        let header: string[] = [];
        const resp = await fetch(this.path);
        if (!resp.ok) {
            throw new Error(`Failed to fetch data from ${this.path}`);
        }
        const data = (await resp.text()).split('\n');
        const result = data.filter(d => d.length).map(x => x.split(',')).filter(d => d.length);
        if (hasHeader) {
            header = result.shift()!.filter((_, i) => !excludeColumns.includes(i));
        }
        if (result.length === 0) {
            throw new Error('Empty data');
        }
        result[0].forEach((_, i) => {
            if (excludeColumns.includes(i))
                return;
            this.data.push(column(result, i));
        });
        this.data = transpose(this.data);
        console.log(this.data);
        return [this.data, header];
    }

    public static classify(data: string[][]) {
        const res: number[][] = [];
        const maps: Map<number, number | Map<string, number>> = new Map();
        data[0].map(inferType).forEach((type, i) => {
            const col = column(data, i);
            switch (type) {
                case 'number':
                    res.push(col.map(parseInt));
                    return;
                case "float":
                    const fcol = col.map(parseFloat);
                    const mid = classify(fcol);
                    res.push(fcol.map(x => x < mid ? 0 : 1));
                    maps.set(i, mid);
                    return;
                case "string":
                    const m = classify(col);
                    res.push(col.map(x => m.get(x)!));
                    maps.set(i, m);
                    return;
                default:
                    throw new Error("Unknown type");
            }
        });
        return { maps, res: transpose(res) };
    }
}