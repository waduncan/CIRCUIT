import type { CompositeNodeContent, CompositeNodeTemplate, LibraryItem } from "./types";

const fields = (...items: Array<[string, string]>): CompositeNodeContent["sections"][number] => ({
  id: "system-details",
  title: "System details",
  kind: "fields",
  fields: items.map(([label, value], index) => ({ id: `field-${index + 1}`, label, value })),
  endpoints: [],
});

const endpoints = (title = "Endpoints"): CompositeNodeContent["sections"][number] => ({
  id: "endpoints",
  title,
  kind: "endpoints",
  fields: [],
  endpoints: [
    { id: "endpoint-1", name: "Primary", address: "10.0.0.10", details: "Production" },
    { id: "endpoint-2", name: "Secondary", address: "10.0.0.11", details: "Standby" },
  ],
});

export const defaultCompositeTemplates: CompositeNodeTemplate[] = [
  { id: "gateway", name: "Integration Gateway", category: "gateway", kind: "interface", icon: "⇄", color: "#7c4dff", defaultWidth: 304, defaultHeight: 288, capabilities: ["HL7", "FHIR", "TCP"], content: { headerLabel: "GATEWAY", footer: "Integration services", logoText: "GW", sections: [fields(["Host name", "gateway01"], ["IP address", "10.0.0.20"], ["OS", "Windows Server"], ["Service ports", "2575, 443"]), endpoints("Interfaces")] } },
  { id: "server", name: "Application Server", category: "server", kind: "application", icon: "▣", color: "#00a78e", defaultWidth: 304, defaultHeight: 272, capabilities: ["HL7", "FHIR", "TCP"], content: { headerLabel: "SERVER", footer: "Application tier", logoText: "APP", sections: [fields(["Host name", "app01"], ["IP address", "10.0.1.20"], ["OS", "Windows Server"], ["Ports", "443, 8080"]), endpoints("Services")] } },
  { id: "modality-collection", name: "Modality Collection", category: "modality-collection", kind: "device", icon: "⌁", color: "#d14d72", defaultWidth: 320, defaultHeight: 304, capabilities: ["DICOM", "HL7", "General Data"], content: { headerLabel: "MODALITIES", footer: "Imaging equipment", logoText: "MOD", sections: [fields(["Department", "Radiology"], ["Location", "Main campus"]), endpoints("Equipment inventory")] } },
  { id: "database", name: "Database Cluster", category: "database", kind: "database", icon: "◉", color: "#e67e22", defaultWidth: 304, defaultHeight: 272, capabilities: ["TCP", "General Data"], content: { headerLabel: "DATABASE", footer: "Data tier", logoText: "DB", sections: [fields(["Cluster", "db-cluster01"], ["Listener", "10.0.2.30:1433"], ["Engine", "SQL Server"], ["Database", "ClinicalDB"]), endpoints("Instances")] } },
  { id: "storage", name: "Storage System", category: "storage", kind: "database", icon: "▤", color: "#1677a3", defaultWidth: 304, defaultHeight: 272, capabilities: ["DICOM", "TCP", "General Data"], content: { headerLabel: "STORAGE", footer: "Archive tier", logoText: "NAS", sections: [fields(["Array", "archive01"], ["Address", "10.0.3.40"], ["Capacity", "100 TB"], ["Protocol", "SMB / NFS"]), endpoints("Volumes")] } },
  { id: "browser-client", name: "Browser / Client Group", category: "browser-client", kind: "application", icon: "▱", color: "#2859d9", defaultWidth: 304, defaultHeight: 256, capabilities: ["FHIR", "TCP", "General Data"], content: { headerLabel: "CLIENTS", footer: "User access", logoText: "WEB", sections: [fields(["URL", "https://clinical.local"], ["Browser", "Microsoft Edge"], ["Authentication", "Local / domain"]), endpoints("Client groups")] } },
  { id: "external-system", name: "External System", category: "external-system", kind: "cloud", icon: "↗", color: "#5a7184", defaultWidth: 304, defaultHeight: 256, capabilities: ["HL7", "FHIR", "TCP", "General Data"], content: { headerLabel: "EXTERNAL", footer: "Outside system boundary", logoText: "EXT", sections: [fields(["Organization", "Partner"], ["Host", "partner.local"], ["Address", "192.0.2.10"], ["Transport", "VPN"]), endpoints("Remote endpoints")] } },
];

export function cloneCompositeContent(template: CompositeNodeTemplate): CompositeNodeContent {
  return {
    templateId: template.id,
    headerLabel: template.content.headerLabel,
    footer: template.content.footer,
    logoText: template.content.logoText,
    sections: template.content.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => ({ ...field })),
      endpoints: section.endpoints.map((endpoint) => ({ ...endpoint })),
    })),
  };
}

export function cloneCompositeTemplate(template: CompositeNodeTemplate): CompositeNodeTemplate {
  const content = cloneCompositeContent(template);
  return {
    ...template,
    capabilities: [...template.capabilities],
    content: {
      headerLabel: content.headerLabel,
      footer: content.footer,
      logoText: content.logoText,
      sections: content.sections,
    },
  };
}

export function compositeLibraryItems(templates: CompositeNodeTemplate[]): LibraryItem[] {
  return templates.map((template) => ({
    id: `composite-${template.id}`,
    name: template.name,
    kind: template.kind,
    description: `Structured ${template.category.replace("-", " ")} template`,
    color: template.color,
    capabilities: [...template.capabilities],
    templateId: template.id,
  }));
}
