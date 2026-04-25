import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
import logging

logger = logging.getLogger(__name__)

def create_appeal_pdf(appeal_text: str, output_path: str) -> str:
    """
    Generates a legally structured PDF document with IRDAI citations.
    """
    try:
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        doc = SimpleDocTemplate(output_path, pagesize=letter,
                                rightMargin=72, leftMargin=72,
                                topMargin=72, bottomMargin=18)
                                
        styles = getSampleStyleSheet()
        
        # Add custom styles
        styles.add(ParagraphStyle(name='Justify', alignment=4))
        styles.add(ParagraphStyle(name='Heading', fontSize=14, spaceAfter=14, fontName='Helvetica-Bold'))
        styles.add(ParagraphStyle(name='Citation', fontSize=10, spaceAfter=10, fontName='Helvetica-Oblique', textColor='darkblue'))
        
        Story = []
        
        # Add a title
        Story.append(Paragraph("INSURANCE DENIAL APPEAL", styles['Heading']))
        Story.append(Spacer(1, 0.2 * inch))
        
        # Split text into paragraphs
        paragraphs = appeal_text.split('\n\n')
        for p in paragraphs:
            if not p.strip():
                continue
                
            # If paragraph looks like a citation/clause, style it differently
            if "IRDAI" in p or "Clause" in p or "Guidelines" in p:
                Story.append(Paragraph(p.strip(), styles['Citation']))
            else:
                # Basic formatting: replace single newlines with spaces within a paragraph
                formatted_p = p.strip().replace('\n', '<br />')
                Story.append(Paragraph(formatted_p, styles['Justify']))
                
            Story.append(Spacer(1, 0.1 * inch))
            
        doc.build(Story)
        logger.info(f"Appeal PDF successfully generated at {output_path}")
        return output_path
        
    except Exception as e:
        logger.error(f"Failed to generate appeal PDF: {e}")
        # Fallback: Just write a text file if PDF generation fails completely
        txt_path = output_path.replace(".pdf", ".txt")
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(appeal_text)
        return txt_path
