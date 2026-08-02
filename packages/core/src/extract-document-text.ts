import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"
import { PDFParse } from "pdf-parse"
import type { DocumentBytes } from "./types.ts"

export class ExtractTextError extends Error {}

/**
 * .docx / .pdf / .txt / .md 파일 버퍼에서 순수 텍스트를 추출한다.
 * 지원하지 않는 형식이거나 내용이 비어있으면 ExtractTextError를 던진다.
 */
export async function extractDocumentText(buffer: DocumentBytes, filename: string): Promise<string> {
  const filenameLower = filename.toLowerCase()

  if (buffer.length === 0) {
    throw new ExtractTextError("파일이 비어있습니다")
  }

  if (filenameLower.endsWith('.docx')) {
    try {
      const zip = new PizZip(buffer)
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      })

      const text = doc.getFullText()

      if (!text || text.trim().length === 0) {
        throw new ExtractTextError("Word 문서에서 텍스트를 추출할 수 없습니다")
      }
      return text
    } catch (docxError: any) {
      if (docxError instanceof ExtractTextError) throw docxError
      throw new ExtractTextError(`Word 파일이 손상되었거나 올바른 형식이 아닙니다: ${docxError.message}`)
    }
  }

  if (filenameLower.endsWith('.pdf')) {
    const parser = new PDFParse({ data: buffer })
    try {
      const result = await parser.getText()
      const text = result.text

      if (!text || text.trim().length === 0) {
        throw new ExtractTextError("PDF에서 텍스트를 추출할 수 없습니다")
      }
      return text
    } catch (pdfError: any) {
      if (pdfError instanceof ExtractTextError) throw pdfError
      throw new ExtractTextError(`PDF 파일에서 텍스트를 추출하지 못했습니다: ${pdfError.message}`)
    } finally {
      await parser.destroy()
    }
  }

  if (filenameLower.endsWith('.doc')) {
    throw new ExtractTextError(".doc 형식은 지원하지 않습니다. 파일을 .docx 형식으로 변환해주세요.")
  }

  if (filenameLower.endsWith('.txt') || filenameLower.endsWith('.md')) {
    const text = new TextDecoder().decode(buffer)
    if (!text || text.trim().length === 0) {
      throw new ExtractTextError("파일 내용이 비어있습니다")
    }
    return text
  }

  throw new ExtractTextError(`지원하지 않는 파일 형식입니다: ${filename}`)
}
