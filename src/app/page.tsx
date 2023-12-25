'use client';
import React, { useEffect, useState } from "react";
import * as d3 from "d3";
import DataReader from "./alg/data";
import DecisionTree, { DecisionNode, DecisionTreeNode } from "./alg/dtree/dtree";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, getKeyValue } from "@nextui-org/react";

export default function Page() {
  const [dtree, setDtree] = useState(new DecisionTree([]));
  const [rootData, setRootData] = useState<DecisionTreeNode>(dtree.rootData);
  const [idx, setIdx] = useState<number[]>([]);
  const animations: NodeJS.Timeout[] = [];
  return <div>
    <DTree dtree={dtree} setDtree={setDtree} setRootData={setRootData} setIdx={setIdx} animations={animations} />;
    <DataTable dtree={dtree} rootData={rootData} idx={idx} />
  </div>
}

export function DTree({
  dtree,
  setDtree,
  setRootData,
  setIdx,
  animations
}:
  {
    dtree: DecisionTree,
    setDtree: React.Dispatch<React.SetStateAction<DecisionTree>>,
    setRootData: React.Dispatch<React.SetStateAction<DecisionTreeNode>>,
    setIdx: React.Dispatch<React.SetStateAction<number[]>>
    animations: NodeJS.Timeout[]
  }) {
  useEffect(() => {
    const reader = new DataReader('watermelon/watermelon.02');
    reader.read(true, [0]).then(data => {
      const newtree = new DecisionTree(data[0], data[1]);
      setDtree(newtree);
      newtree.build();
      console.log(newtree.rootData);
    });
  }, []);
  // update the tree graph
  useEffect(() => {
    const width = 1280;
    const root = d3.hierarchy(dtree.rootData);
    const dx = 20;
    const dy = width / (root.height + 1);
    const tree = d3.tree<DecisionTreeNode>().nodeSize([dx, dy]);
    tree(root);
    let x0 = Infinity;
    let x1 = -x0;
    root.each((d: any) => {
      if (d.x > x1) x1 = d.x;
      if (d.x < x0) x0 = d.x;
    });
    const height = x1 - x0 + dx * 2;
    // first clear the svg
    d3.select("#tree-container").selectAll("*").remove();
    const svg = d3.select("#tree-container").append("svg")
      .attr("witdh", width)
      .attr("height", height)
      .attr("viewBox", [-dy / 3, x0 - dx, width, height])
      .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

    svg.append('g')
      .attr('fill', 'none')
      .attr('stroke', '#555')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 3)
      .selectAll()
      .data(root.links())
      .join("path")
      .attr("d", d3.linkHorizontal().x((d: any) => d.y).y((d: any) => d.x) as any)
      .on("mouseenter", function () {
        d3.select(this).transition().duration(300).attr("stroke-width", 10).attr("stroke", "royalblue");
        const d: any = d3.select(this).datum() as d3.HierarchyLink<DecisionTreeNode>;
        setRootData(d.source.data);
        setIdx(d.target.data.type == 'decision' ? d.target.data.idx : []);
        // append some text on the path
        if (d.target.data.type == 'decision')
          svg.append('text')
            .classed('path-text', true)
            .attr('pointer-events', 'none')
            .attr('x', (d.source.y + d.target.y) / 2)
            .attr('y', (d.source.x + d.target.x) / 2)
            .attr('text-anchor', 'middle')
            .attr('fill', 'black')
            .attr('font-size', '1.2em')
            .text(`ID3 Gain: ${d.target.data.gain.toFixed(3)}`);
      })
      .on("mouseleave", function () {
        d3.select(this).transition().duration(300).attr("stroke-width", 3).attr("stroke", "#555");
        setRootData(undefined as any);
        setIdx([]);
        svg.selectAll('.path-text').remove();
      });

    const node = svg.append('g')
      .attr('stroke-linejoin', 'round')
      .attr('stroke-width', 3)
      .selectAll()
      .data(root.descendants())
      .join('g')
      .attr('transform', (d: any) => `translate(${d.y}, ${d.x})`);

    node.append('circle')
      .classed('node', true)
      .attr('fill', d => d.children ? '#555' : '#999')
      .attr('r', 5);
    node.append('circle')
      .attr('fill', 'transparent')
      .attr('r', 20)
      .on('mouseenter', function () {
        const el = d3.select(this.parentElement)
          .select('.node');
        setRootData((el.datum() as any).data);
        el.transition()
          .duration(300)
          .attr('r', 10)
          .attr('fill', 'royalblue');
        const s = setTimeout(() => el.clone(true)
          .attr('r', 10)
          .attr('fill', 'royalblue')
          .classed('node-clone', true).classed('animate-ping', true), 300);
        animations.push(s);
      })
      .on('mouseleave', function () {
        animations.forEach(clearTimeout);
        d3.select(this.parentElement).selectAll('.node-clone').remove();
        setRootData(undefined as any);
        const el = d3.select(this.parentElement)
          .select('.node')
        el.transition()
          .duration(300)
          .attr('r', 5)
          .attr('fill', (d: any) => d.children ? '#555' : '#999');
      });

    node.append('text')
      .attr('dy', '0.4em')
      .attr('x', d => d.children ? -6 : 6)
      .attr('y', 10)
      .attr('text-anchor', d => d.children ? 'end' : 'start')
      .attr('fill', d => d.children ? 'black' : 'red')
      .text(d => d.data.type == 'decision' ? d.data.desc : d.data.data)
      .clone(true).lower()
      .attr('stroke', 'white');
  }, [dtree]);
  return <div id="tree-container"></div>;
}

export function DataTable({ dtree, rootData, idx }: { dtree: DecisionTree, rootData?: DecisionTreeNode, idx: number[] }) {
  console.log(rootData);
  if (rootData == undefined) return <></>
  if (rootData.type == 'leaf')
    return <div>{rootData.data}</div>
  return <Table>
    <TableHeader>
      {dtree.Label.map(label => <TableColumn key={label}>{label}</TableColumn>)}
    </TableHeader>
    <TableBody>
      {
        (rootData as DecisionNode).data.map((row, i) => <TableRow key={i} className={idx.length ? (
          idx.includes(i) ? 'bg-blue-300' : ''
        ) : ''}>
          {
            row.map((col, j) => <TableCell key={j}>{col}</TableCell>)
          }
        </TableRow>)
      }
    </TableBody>
  </Table>
}

