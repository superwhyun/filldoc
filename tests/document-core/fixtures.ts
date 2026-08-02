import { Document, Packer, Paragraph } from "docx"

export async function createDocx(paragraphs: string[]): Promise<Buffer> {
  const document = new Document({
    sections: [{
      children: paragraphs.map((text) => new Paragraph(text)),
    }],
  })

  return Packer.toBuffer(document)
}
