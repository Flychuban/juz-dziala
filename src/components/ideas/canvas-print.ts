/** Print setup shared by the filled and the blank canvas: one A4 landscape sheet per canvas sheet. */
export const CANVAS_PRINT_CSS =
  "@media print { @page { size: A4 landscape; margin: 10mm; } .canvas-print-sheet { break-after: page; } .canvas-print-sheet:last-child { break-after: auto; } }";
