import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def make_contract():
    os.makedirs('contracts', exist_ok=True)
    pdf_path = 'contracts/example.pdf'
    doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'ContractTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        alignment=1, # Center
        spaceAfter=20
    )
    
    body_style = ParagraphStyle(
        'ContractBody',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        spaceAfter=10
    )

    heading_style = ParagraphStyle(
        'ContractHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        spaceAfter=4,
        spaceBefore=10
    )
    
    story = []
    
    story.append(Paragraph("CONTRATO DE PRESTACIÓN DE SERVICIOS DE CONSULTORÍA TECNOLÓGICA", title_style))
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("Este Contrato de Prestación de Servicios de Consultoría (en adelante, el \"Contrato\") es celebrado el 18 de junio de 2026, por y entre las siguientes partes:", body_style))
    
    story.append(Paragraph("<b>CONTRATANTE:</b> ACME CORP SAS, sociedad comercial legalmente constituida, con domicilio principal en Bogotá D.C., Colombia.", body_style))
    story.append(Paragraph("<b>CONTRATISTA:</b> PROVEXPRESS SAS, sociedad comercial legalmente constituida, con domicilio principal en Medellín, Colombia.", body_style))
    
    story.append(Paragraph("Las partes acuerdan de mutuo acuerdo las siguientes cláusulas y disposiciones generales:", body_style))
    
    story.append(Paragraph("<b>CLÁUSULA PRIMERA - OBJETO:</b>", heading_style))
    story.append(Paragraph("El Contratista se compromete a prestar servicios profesionales de consultoría tecnológica, incluyendo el análisis de sistemas empresariales, la evaluación de riesgos comerciales y el diseño de dashboards interactivos para el Contratante.", body_style))
    
    story.append(Paragraph("<b>CLÁUSULA SEGUNDA - VALOR Y MONEDA:</b>", heading_style))
    story.append(Paragraph("El valor total de los servicios objeto de este contrato se fija de común acuerdo en la suma de ciento cincuenta millones de pesos colombianos (COP 150,000,000) de ejecución total.", body_style))
    
    story.append(Paragraph("<b>CLÁUSULA TERCERA - DURACIÓN:</b>", heading_style))
    story.append(Paragraph("La duración del presente contrato será de doce (12) meses contados a partir del acta de inicio firmada por las partes.", body_style))
    
    story.append(Paragraph("<b>CLÁUSULA CUARTA - FORMA DE PAGO:</b>", heading_style))
    story.append(Paragraph("El Contratante pagará al Contratista el valor del contrato en cuotas mensuales vencidas contra factura. Sin embargo, todo pago estará sujeto a la previa aprobación y visto bueno de las facturas por parte del supervisor designado por el Contratante (ACME CORP SAS). Adicionalmente, el plazo máximo para la realización del pago será de sesenta (60) días calendario contados a partir de la aprobación final de la respectiva factura.", body_style))
    
    story.append(Paragraph("<b>CLÁUSULA QUINTA - PÓLIZAS Y GARANTÍAS:</b>", heading_style))
    story.append(Paragraph("El Contratista deberá contratar, a su entero cargo y costo, una póliza de cumplimiento del contrato ante una compañía de seguros autorizada en Colombia, así como una póliza de responsabilidad civil extracontractual por valor equivalente a doscientos millones de pesos colombianos (COP 200,000,000).", body_style))
    
    story.append(Paragraph("<b>CLÁUSULA SEXTA - MULTAS Y PENALIDADES:</b>", heading_style))
    story.append(Paragraph("En caso de retraso injustificado en la entrega de los entregables mensuales acordados, el Contratante podrá imponer al Contratista multas de mora equivalentes al 2% del valor de la cuota mensual correspondiente por cada día de retraso, hasta un tope máximo acumulado del 10% del valor total del contrato.", body_style))
    
    story.append(Paragraph("<b>CLÁUSULA SÉPTIMA - TERMINACIÓN UNILATERAL:</b>", heading_style))
    story.append(Paragraph("El Contratante (ACME CORP SAS) podrá terminar de forma anticipada el presente contrato de manera unilateral y a su entera discreción en cualquier momento y sin necesidad de justa causa, mediante aviso previo por escrito enviado al Contratista con quince (15) días calendario de antelación, sin que ello genere obligación de pagar indemnización, penalidad o resarcimiento de ningún tipo a favor del Contratista.", body_style))
    
    story.append(Spacer(1, 15))
    story.append(Paragraph("En constancia de lo anterior, las partes firman el presente documento el 18 de junio de 2026.", body_style))
    
    doc.build(story)
    print("Contract PDF successfully generated at: " + pdf_path)

if __name__ == '__main__':
    make_contract()
