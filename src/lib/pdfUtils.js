import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

const COLORS = {
  ink: [33, 15, 55],
  plum: [79, 28, 81],
  orange: [165, 91, 75],
  gold: [220, 160, 109],
  lightGold: [241, 189, 140],
  muted: [118, 106, 122],
  border: [232, 224, 232],
  surface: [250, 248, 250],
};

function clean(value) {
  return Array.from(String(value ?? ""))
    .map(character => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("")
    .trim();
}

function safeFilename(value) {
  return clean(value).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "export";
}

function createDocument(orientation = "portrait") {
  return new jsPDF({ orientation, unit: "mm", format: "a4" });
}

function drawHeader(doc, title, eyebrow) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLORS.ink);
  doc.rect(0, 0, width, 34, "F");
  doc.setFillColor(...COLORS.orange);
  doc.rect(0, 34, width, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...COLORS.lightGold);
  doc.text("NET", 14, 15);
  doc.setTextColor(...COLORS.gold);
  doc.text(" TERM", 27, 15);
  doc.setFontSize(7);
  doc.setCharSpace(1.8);
  doc.text("SOLUTIONS", 14, 22);
  doc.setCharSpace(0);
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.lightGold);
  doc.text(clean(eyebrow).toUpperCase(), width - 14, 12, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(clean(title), width - 14, 22, { align: "right", maxWidth: width * 0.62 });
}

function drawMetadata(doc, generatedAt = new Date()) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(247, 243, 247);
  doc.rect(0, 36, width, 11, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(`Generated ${generatedAt.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}`, 14, 43);
  doc.text("Confidential business document", width - 14, 43, { align: "right" });
}

function drawSummary(doc, summary, startY) {
  if (!summary.length) return startY;
  const width = doc.internal.pageSize.getWidth();
  const gap = 4;
  const cardWidth = (width - 28 - gap * (summary.length - 1)) / summary.length;
  summary.forEach((item, index) => {
    const x = 14 + index * (cardWidth + gap);
    doc.setFillColor(...COLORS.surface);
    doc.setDrawColor(...COLORS.border);
    doc.rect(x, startY, cardWidth, 18, "FD");
    doc.setFillColor(...COLORS.gold);
    doc.rect(x, startY, cardWidth, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(clean(item.label).toUpperCase(), x + 3, startY + 7, { maxWidth: cardWidth - 6 });
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.ink);
    doc.text(clean(item.value), x + 3, startY + 14, { maxWidth: cardWidth - 6 });
  });
  return startY + 24;
}

function addFooters(doc) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...COLORS.border);
    doc.line(14, height - 13, width - 14, height - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text("Net Term Solutions | Structured workspace export", 14, height - 8);
    doc.text(`Page ${page} of ${pageCount}`, width - 14, height - 8, { align: "right" });
  }
}

function tableOptions(doc, title, startY, headers, rows) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.plum);
  doc.text(clean(title).toUpperCase(), 14, startY);
  autoTable(doc, {
    startY: startY + 3,
    head: [headers.map(clean)],
    body: rows.length ? rows.map(row => row.map(clean)) : [["No records available.", ...headers.slice(1).map(() => "")]],
    theme: "grid",
    margin: { left: 14, right: 14, top: 51, bottom: 18 },
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2.5, textColor: COLORS.ink, lineColor: COLORS.border, lineWidth: 0.2, overflow: "linebreak" },
    headStyles: { fillColor: COLORS.plum, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7, cellPadding: 3 },
    alternateRowStyles: { fillColor: COLORS.surface },
    showHead: "everyPage",
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) {
        drawHeader(doc, title, "Workspace report");
        drawMetadata(doc);
      }
    },
  });
  return doc.lastAutoTable.finalY;
}

function downloadDocument(doc, filename) {
  doc.save(`${safeFilename(filename)}.pdf`);
}

function printDocument(doc) {
  const url = URL.createObjectURL(doc.output("blob"));
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  frame.src = url;
  document.body.appendChild(frame);

  const cleanup = () => {
    URL.revokeObjectURL(url);
    frame.remove();
  };
  frame.onload = () => {
    frame.contentWindow?.addEventListener("afterprint", cleanup, { once: true });
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(cleanup, 60000);
  };
}

function buildReportPDF(title, headers, rows, summary = []) {
  const doc = createDocument(headers.length > 6 ? "landscape" : "portrait");
  drawHeader(doc, title, "Workspace report");
  drawMetadata(doc);
  const tableY = drawSummary(doc, summary, 53);
  tableOptions(doc, "Detailed records", tableY, headers, rows);
  addFooters(doc);
  return doc;
}

function currencyFormatter(currency) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" });
}

function buildInvoicePDF(invoice) {
  const doc = createDocument();
  const invoiceNumber = invoice.invoice_number || "Draft";
  const money = currencyFormatter(invoice.currency);
  const subtotal = Number(invoice.amount) || 0;
  const taxRate = Number(invoice.tax_rate) || 0;
  const tax = subtotal * taxRate / 100;
  const total = Number(invoice.total_amount) || subtotal + tax;
  drawHeader(doc, `Invoice ${invoiceNumber}`, "Billing invoice");
  drawMetadata(doc);

  autoTable(doc, {
    startY: 53,
    body: [
      ["BILL TO", "INVOICE DETAILS"],
      [invoice.client_name || "Client", `Project: ${invoice.project_name || "Not assigned"}`],
      [invoice.client_email || "No email provided", `Due date: ${invoice.due_date || "Upon receipt"}`],
      ["", `Status: ${clean(invoice.status || "draft").replaceAll("_", " ")}`],
    ],
    theme: "grid",
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 3, lineColor: COLORS.border, textColor: COLORS.ink },
    didParseCell: ({ row, cell }) => {
      if (row.index === 0) {
        cell.styles.fillColor = COLORS.surface;
        cell.styles.textColor = COLORS.muted;
        cell.styles.fontStyle = "bold";
        cell.styles.fontSize = 7;
      }
    },
  });

  const chargesY = doc.lastAutoTable.finalY + 10;
  tableOptions(doc, "Charges", chargesY, ["Description", "Project", "Amount"], [["Professional services", invoice.project_name || "General", money.format(subtotal)]]);
  let y = doc.lastAutoTable.finalY + 7;
  const width = doc.internal.pageSize.getWidth();
  const left = width - 84;
  [["Subtotal", money.format(subtotal)], [`Tax (${taxRate}%)`, money.format(tax)], ["Total due", money.format(total)]].forEach(([label, value], index) => {
    if (index === 2) doc.setFillColor(...COLORS.surface);
    if (index === 2) doc.rect(left, y - 4, 70, 9, "F");
    doc.setFont("helvetica", index === 2 ? "bold" : "normal");
    doc.setFontSize(index === 2 ? 10 : 8);
    doc.setTextColor(...(index === 2 ? COLORS.plum : COLORS.ink));
    doc.text(label, left + 2, y);
    doc.text(value, width - 16, y, { align: "right" });
    y += 9;
  });

  const notes = [invoice.notes ? `Notes: ${clean(invoice.notes)}` : "", `Payment is due by ${invoice.due_date || "the agreed payment date"}. Reference invoice ${invoiceNumber} with payment.`].filter(Boolean);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(doc.splitTextToSize(notes.join("\n\n"), width - 28), 14, y + 5);
  addFooters(doc);
  return doc;
}

function addProjectSection(doc, title, headers, rows, startY) {
  let y = startY;
  if (y > doc.internal.pageSize.getHeight() - 55) {
    doc.addPage();
    drawHeader(doc, "Project Finance Invoice", "Itemized details");
    drawMetadata(doc);
    y = 54;
  }
  tableOptions(doc, title, y, headers, rows);
  return doc.lastAutoTable.finalY + 8;
}

function buildProjectInvoicePDF(data) {
  const doc = createDocument();
  const project = data.project;
  const money = currencyFormatter(project.currency || "USD");
  drawHeader(doc, `Invoice ${data.invoiceNumber}`, "Project finance invoice");
  drawMetadata(doc);
  autoTable(doc, {
    startY: 53,
    body: [
      ["BILL TO", project.client_name || "Client", "PROJECT", project.name || "Not set"],
      ["EMAIL", project.client_email || "Not provided", "PERIOD", `${project.start_date || "Not set"} - ${project.end_date || "Not set"}`],
      ["LOCATION", project.location || "Not provided", "STATUS", project.status || "Not set"],
    ],
    theme: "grid",
    margin: { left: 14, right: 14 },
    styles: { fontSize: 7.5, cellPadding: 3, lineColor: COLORS.border, textColor: COLORS.ink },
    columnStyles: { 0: { fontStyle: "bold", textColor: COLORS.muted, fillColor: COLORS.surface }, 2: { fontStyle: "bold", textColor: COLORS.muted, fillColor: COLORS.surface } },
  });
  let y = drawSummary(doc, [
    { label: "Labour", value: money.format(data.labourTotal) },
    { label: "Expenses", value: money.format(data.expenseTotal) },
    { label: "Procurement", value: money.format(data.procurementTotal) },
  ], doc.lastAutoTable.finalY + 9);
  y = addProjectSection(doc, "Invoice totals", ["Category", "Amount"], [
    ["Total cost", money.format(data.totalCost)],
    ["Contract / budget", money.format(data.revenue)],
    ["Net profit / loss", `${money.format(data.profit)} (${Number(data.margin || 0).toFixed(1)}%)`],
  ], y);
  y = addProjectSection(doc, "Labour details", ["Employee", "Date", "Hours", "Rate", "Amount"], data.labourRows.map(row => [row.name, row.date, `${row.hours}h`, money.format(row.rate), money.format(row.amount)]), y);
  y = addProjectSection(doc, "Expense details", ["Title", "Category", "Date", "Amount"], data.expenseRows.map(row => [row.name, row.category, row.date, money.format(row.amount)]), y);
  addProjectSection(doc, "Procurement details", ["Item", "Vendor", "Quantity", "Unit price", "Date", "Total"], data.procurementRows.map(row => [row.name, row.vendor, `${row.qty} ${row.unit}`, money.format(row.unitPrice), row.date, money.format(row.amount)]), y);
  addFooters(doc);
  return doc;
}

export function exportPDF(title, headers, rows, summary = []) {
  downloadDocument(buildReportPDF(title, headers, rows, summary), title);
}

export function printPDF(title, headers, rows, summary = []) {
  printDocument(buildReportPDF(title, headers, rows, summary));
}

export function exportInvoicePDF(invoice) {
  downloadDocument(buildInvoicePDF(invoice), invoice.invoice_number || "invoice");
}

export function printInvoicePDF(invoice) {
  printDocument(buildInvoicePDF(invoice));
}

export function exportProjectInvoicePDF(data) {
  downloadDocument(buildProjectInvoicePDF(data), data.invoiceNumber || "project-invoice");
}

export function printProjectInvoicePDF(data) {
  printDocument(buildProjectInvoicePDF(data));
}