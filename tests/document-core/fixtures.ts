import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from "docx"

export async function createDocx(paragraphs: string[]): Promise<Buffer> {
  const document = new Document({
    sections: [{
      children: paragraphs.map((text) => new Paragraph(text)),
    }],
  })

  return Packer.toBuffer(document)
}

/**
 * header + dot-notation placeholder row을 가진 표 하나짜리 docx를 만든다.
 * 셀 값을 문자열 배열로 주면 각 조각을 별도 run으로 넣어 Word가 저장한 것처럼 placeholder를 쪼갠다.
 */
export async function createDocxTable(header: string[], rowCells: Array<string | string[]>): Promise<Buffer> {
  const cell = (text: string | string[]) => new TableCell({
    children: [typeof text === "string"
      ? new Paragraph(text)
      : new Paragraph({ children: text.map((piece) => new TextRun(piece)) })],
  })

  const document = new Document({
    sections: [{
      children: [
        new Table({
          rows: [
            new TableRow({ children: header.map(cell) }),
            new TableRow({ children: rowCells.map(cell) }),
          ],
        }),
      ],
    }],
  })

  return Packer.toBuffer(document)
}

/** pdf-parse(pdfjs-dist)가 읽을 수 있는 최소 유효 단일 페이지 PDF를 바이트 오프셋을 계산해 만든다. */
export function createPdf(text: string): Buffer {
  const content = `BT /F1 18 Tf 20 250 Td (${text}) Tj ET`
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 300 300] /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
  ]

  let body = "%PDF-1.4\n"
  const offsets: number[] = []
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, "latin1"))
    body += object
  }

  const xrefStart = Buffer.byteLength(body, "latin1")
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

  return Buffer.from(body + xref + trailer, "latin1")
}
