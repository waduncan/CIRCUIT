import type { Capability, LibraryItem, PrimitiveKind } from "./types";

export const capabilityConfig: Record<Capability, { color: string; subtypes: string[] }> = {
  HL7: { color: "#2f6df6", subtypes: ["ADT", "SIU", "ORM", "ORU"] },
  FHIR: { color: "#7c4dff", subtypes: ["REST", "Subscription", "Bundle", "Messaging"] },
  DICOM: { color: "#00a78e", subtypes: ["MWL", "C-STORE SCU", "C-STORE SCP", "MPPS"] },
  TCP: { color: "#e67e22", subtypes: ["Client", "Server", "MLLP"] },
  "General Data": { color: "#64748b", subtypes: ["File", "API", "Message", "Manual"] },
};

export const primitiveLibrary: LibraryItem[] = [
  { id: "emr", name: "Electronic Medical Record", kind: "emr", description: "Clinical system of record", color: "#2859d9", capabilities: ["HL7", "FHIR"] },
  { id: "interface", name: "Interface Engine", kind: "interface", description: "Routes and transforms messages", color: "#7c4dff", capabilities: ["HL7", "FHIR", "TCP"] },
  { id: "application", name: "Application Server", kind: "application", description: "Hosts healthcare application services", color: "#00a78e", capabilities: ["HL7", "FHIR", "DICOM", "TCP"] },
  { id: "database", name: "Database Server", kind: "database", description: "Stores application and clinical data", color: "#e67e22", capabilities: ["TCP", "General Data"] },
  { id: "device", name: "Clinical Device", kind: "device", description: "Modality, cart, or bedside device", color: "#d14d72", capabilities: ["DICOM", "HL7", "General Data"] },
  { id: "cloud", name: "External Service", kind: "cloud", description: "Cloud or third-party endpoint", color: "#5a7184", capabilities: ["FHIR", "TCP", "General Data"] },
];

export const icons: Record<PrimitiveKind, string> = {
  emr: "✚",
  interface: "⇄",
  application: "▣",
  database: "◉",
  device: "⌁",
  cloud: "☁",
};
