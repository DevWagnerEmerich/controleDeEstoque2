from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pypdf import PdfReader
import pytesseract
from PIL import Image
import io
import re
import camelot
import os

# Configure Tesseract path if not in PATH
pytesseract.pytesseract.tesseract_cmd = os.environ.get('TESSERACT_CMD', r'C:\Program Files\Tesseract-OCR\tesseract.exe') # Adjust path as needed

app = FastAPI()

API_KEY = os.environ.get("API_KEY", "secret")
api_key_header = APIKeyHeader(name="Authorization")

async def get_api_key(api_key: str = Depends(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Could not validate credentials")
    return api_key

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

def extract_text_from_pdf(pdf_file: bytes) -> str:
    """Extracts text from PDF, attempting OCR if direct extraction is poor."""
    reader = PdfReader(io.BytesIO(pdf_file))
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""

    # Basic check for text quality - if too little text, try OCR
    if len(text.strip()) < 100 and reader.pages: # Arbitrary threshold
        print("Low text density, attempting OCR...")
        pass # Placeholder for full OCR implementation

    return text

def parse_nfe_text(text: str):
    """Parses NFe-like text to extract supplier, invoice, and product data."""
    clean_text = lambda s: re.sub(r'\s+', ' ', s.strip())

    supplier_name = 'Não identificado'
    supplier_match = re.search(r'(.*?)\nDANFE', text)
    if supplier_match and clean_text(supplier_match.group(1)):
        lines_before_danfe = [line.strip() for line in supplier_match.group(1).split('\n') if line.strip()]
        if lines_before_danfe:
            supplier_name = clean_text(lines_before_danfe[0])

    nfe_number = f"NFe_{os.urandom(4).hex()}"
    nfe_number_match = re.search(r'N°[:.]?\s*(\d{3}\.\d{3}\.\d{3}|\d+)', text)
    if nfe_number_match:
        nfe_number = nfe_number_match.group(1).replace('.', '')

    products = []
    product_section_match = re.search(r'DADOS DOS PRODUTOS(?: \/ SERVIÇOS)?([\s\S]*?)(?:CÁLCULO DO ISSQN|DADOS ADICIONAIS|VALOR TOTAL DA NOTA|INFORMAÇÕES COMPLEMENTARES)', text)
    
    if product_section_match:
        product_lines = product_section_match.group(1).split('\n')
        product_regex = re.compile(r'^(?:(\S+)\s+)?(.+?)\s+(\d{8})\s+(?:UN|KG|PC|CX|FD|M3|M2|LT|G|ML)?\s*([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$', re.IGNORECASE)

        for line in product_lines:
            cleaned_line = line.replace('\n', ' ').strip()
            if not cleaned_line:
                continue

            match = product_regex.match(cleaned_line)
            if match:
                code, description, ncm, quantity, unit_price, total_price = match.groups()
                
                parse_value = lambda s: float(s.replace('.', '').replace(',', '.'))

                try:
                    qty = parse_value(quantity)
                    products.append({
                        "code": clean_text(code or ''),
                        "name": clean_text(description),
                        "ncm": clean_text(ncm),
                        "quantity": qty,
                        "costPrice": parse_value(unit_price),
                        "totalPriceBRL": parse_value(total_price),
                        "qtyKg": qty, # As a default, will be recalculated in frontend
                        "unitMeasureValue": 1,
                        "unitMeasureType": 'un',
                        "unitsPerPackage": 1
                    })
                except (ValueError, IndexError) as e:
                    print(f"Error parsing product line: {line} - {e}")
            else:
                print(f"Product line did not match regex: {line}")
    else:
        print("Products section not found in PDF.")

    return {
        "fornecedor": {
            "nome": supplier_name,
            "cnpj": ""
        },
        "produtos": products,
        "notaFiscal": {
            "numero": nfe_number,
            "serie": "1",
            "dataEmissao": ""
        }
    }


@app.post("/extract-pdf-data/")
async def extract_pdf_data(file: UploadFile = File(...), api_key: str = Depends(get_api_key)):
    if not file.content_type == "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    pdf_content = await file.read()
    
    extracted_text = extract_text_from_pdf(pdf_content)
    
    tables = []
    try:
        extracted_tables = camelot.read_pdf(io.BytesIO(pdf_content), pages='all', flavor='lattice')
        for table in extracted_tables:
            tables.append(table.df.to_numpy().tolist())
    except Exception as e:
        print(f"Erro ao extrair tabelas com Camelot: {e}")

    parsed_data = parse_nfe_text(extracted_text)

    if tables and not parsed_data['produtos']:
        products = []
        for table_df in tables:
            for row in table_df:
                if len(row) >= 8:
                    try:
                        products.append({
                            "code": str(row[0]),
                            "name": str(row[1]),
                            "ncm": str(row[2]),
                            "quantity": float(str(row[6]).replace('.', '').replace(',', '.')), 
                            "costPrice": float(str(row[7]).replace('.', '').replace(',', '.')), 
                            "totalPriceBRL": float(str(row[8]).replace('.', '').replace(',', '.')), 
                            "qtyKg": float(str(row[6]).replace('.', '').replace(',', '.')), # Default
                            "unitMeasureValue": 1,
                            "unitMeasureType": 'un',
                            "unitsPerPackage": 1
                        })
                    except (ValueError, IndexError):
                        print(f"Could not parse row from table: {row}")
        parsed_data['produtos'] = products

    if not parsed_data['produtos']:
        raise HTTPException(status_code=404, detail="Nenhum produto encontrado no PDF. Verifique o formato do arquivo.")

    return JSONResponse(content=parsed_data)