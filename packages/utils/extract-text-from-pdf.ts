import { PDFExtract, PDFExtractOptions } from 'pdf.js-extract';

const pdfExtract = new PDFExtract();

const options: PDFExtractOptions = {
    lastPage: 1,
};

export async function extractTextFromPdf(pdf: string) {
    const text = await pdfExtract.extract(pdf, options);
    return text;
}