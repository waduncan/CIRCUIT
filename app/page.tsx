import type { Metadata } from "next";
import DiagramApp from "./DiagramApp";

export const metadata: Metadata = {
  title: "CareFlow Studio",
  description: "Purpose-built logical connectivity diagrams for healthcare systems.",
};

export default function Home() {
  return <DiagramApp />;
}
