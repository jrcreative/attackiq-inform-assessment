# PDF Layout Preview

Run:

```sh
npm run dev:pdf
```

Then open:

```text
http://localhost:3027
```

The preview renders the PDF report as HTML using mock dynamic assessment data. Edit `src/utils/pdfGenerator.js`; the browser reloads automatically when the file changes.

This avoids filling out the form or generating a PDF for layout work. Once the HTML pages look right, use the normal in-app PDF generation path to verify the final rendered PDF.
