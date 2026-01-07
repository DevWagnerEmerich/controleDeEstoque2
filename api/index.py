from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import io
import re
import os
from datetime import datetime
from lxml import etree

app = FastAPI()

API_KEY = os.environ.get("API_KEY", "secret")
api_key_header = APIKeyHeader(name="Authorization")

async def get_api_key(api_key: str = Depends(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Could not validate credentials")
    return api_key

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- FUNÇÕES AUXILIARES ROBUSTAS ---

def get_text(element, path, ns, default=''):
    """Busca um texto em um elemento, tratando ausência e elemento nulo."""
    if element is None:
        return default
    node = element.find(path, ns)
    return node.text.strip() if node is not None and node.text else default

def get_value(element, path, ns, default=0.0):
    """Busca um valor numérico em um elemento, tratando ausência e erros."""
    text = get_text(element, path, ns)
    try:
        return float(text.replace(',', '.'))
    except (ValueError, TypeError):
        return default

def calculate_audited_weight(description: str, qCom: float):
    """
    Tenta calcular o peso de um item auditando sua descrição.
    Retorna uma tupla (peso_em_kg, unidade_encontrada) ou (None, None).
    """
    if not description or qCom == 0:
        return (None, None)

    desc_lower = description.lower()

    # ETAPA 1: Tenta encontrar o padrão de "pacote" (ex: 20x500g)
    package_match = re.search(r'(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*(g|gr|kg|l)(?![a-z])', desc_lower)
    if package_match:
        try:
            qty_in_com_unit = float(package_match.group(1).replace(',', '.'))
            value_per_sub_unit = float(package_match.group(2).replace(',', '.'))
            unit = package_match.group(3)

            weight_of_com_unit = qty_in_com_unit * value_per_sub_unit
            total_weight = qCom * weight_of_com_unit

            if unit in ['g', 'gr']:
                return (total_weight / 1000.0, 'G')
            elif unit == 'kg':
                return (total_weight, 'KG')
            elif unit == 'l':
                return (total_weight * 1.03, 'L')
        except (ValueError, IndexError):
            return (None, None)

    # ETAPA 2: Se não for pacote, tenta encontrar o padrão de "item único" (ex: 0.400kg)
    single_item_match = re.search(r'(\d+(?:[.,]\d+)?)\s*(g|gr|kg|l)\b', desc_lower)
    if single_item_match:
        try:
            weight_per_item = float(single_item_match.group(1).replace(',', '.'))
            unit = single_item_match.group(2)

            total_weight = qCom * weight_per_item

            if unit in ['g', 'gr']:
                return (total_weight / 1000.0, 'G')
            elif unit == 'kg':
                return (total_weight, 'KG')
            elif unit == 'l':
                return (total_weight * 1.03, 'L')
        except (ValueError, IndexError):
            return (None, None)

    return (None, None)

def get_qty_kg(prod, ns):
    """
    Lógica Crítica: Extrai a quantidade em KG de um item.
    Plano A: Usa dados tributários (uTrib/qTrib).
    Plano B: Usa dados comerciais (uCom/qCom) como fallback.
    Plano C: Retorna 0 se nenhuma unidade de peso for encontrada.
    """
    # Plano A: Leitura Fiscal/Tributável
    uTrib = get_text(prod, 'nfe:uTrib', ns).upper()
    if uTrib in ["KG", "G", "GR", "T", "L"]:
        qTrib = get_value(prod, 'nfe:qTrib', ns)
        if uTrib == "KG":
            return qTrib
        if uTrib in ["G", "GR"]:
            return qTrib / 1000.0
        if uTrib == "T":
            return qTrib * 1000.0
        if uTrib == "L": # NEW: Handle Liters
            return qTrib * 1.03 # 1L = 1.03kg for milk

    # Plano B: Fallback Comercial
    uCom = get_text(prod, 'nfe:uCom', ns).upper()
    if uCom in ["KG", "G", "GR", "T", "L"]:
        qCom = get_value(prod, 'nfe:qCom', ns)
        if uCom == "KG":
            return qCom
        if uCom in ["G", "GR"]:
            return qCom / 1000.0
        if uCom == "T":
            return qCom * 1000.0
        if uCom == "L": # NEW: Handle Liters
            return qCom * 1.03 # 1L = 1.03kg for milk

    # Plano C: Falha Segura
    return 0.0

def get_peso_liquido(infNFe, ns, all_products_data):
    """
    Extrai o Peso Líquido Total.
    Prioriza a soma dos pesos calculados de cada item, com fallback inteligente para a soma dos volumes.
    """
    soma_pesos_itens = sum(p.get('calculated_qty_kg', 0.0) for p in all_products_data)

    total_peso_l_volumes = 0.0
    transp = infNFe.find('nfe:transp', ns)
    if transp is not None:
        for vol in transp.findall('nfe:vol', ns):
            peso_l_volume = get_value(vol, 'nfe:pesoL', ns)
            total_peso_l_volumes += peso_l_volume
    
    # Lógica inteligente: se a soma dos itens for próxima da soma dos volumes e a soma dos volumes for maior, usa a soma dos volumes.
    if soma_pesos_itens > 0 and total_peso_l_volumes > 0:
        diff = abs(soma_pesos_itens - total_peso_l_volumes)
        percentage_diff = (diff / soma_pesos_itens) * 100 if soma_pesos_itens > 0 else 0

        if percentage_diff <= 5 and total_peso_l_volumes > soma_pesos_itens: # Diferença até 5% e valor do XML é maior
            return total_peso_l_volumes
        else:
            return soma_pesos_itens # Caso contrário, mantém a soma dos itens
    elif soma_pesos_itens > 0:
        return soma_pesos_itens
    elif total_peso_l_volumes > 0:
        return total_peso_l_volumes
    
    return 0.0

def get_peso_bruto(infNFe, ns, peso_liquido_final):
    """
    Extrai o Peso Bruto Total.
    Prioriza a soma dos pesos brutos de todos os volumes na secção <transp>.
    Plano B: Usa o Peso Líquido final (soma dos itens auditados) como base.
    Plano C: Retorna 0.
    """
    # Priorizar a soma dos pesos brutos de todos os volumes na secção <transp>
    total_peso_b_volumes = 0.0
    transp = infNFe.find('nfe:transp', ns)
    if transp is not None:
        for vol in transp.findall('nfe:vol', ns):
            peso_b_volume = get_value(vol, 'nfe:pesoB', ns)
            total_peso_b_volumes += peso_b_volume
    
    if total_peso_b_volumes > 0:
        return total_peso_b_volumes

    # Fallback para Peso Líquido * 1.035
    if peso_liquido_final > 0:
        return peso_liquido_final * 1.035

    # Fallback para 0
    return 0.0

# --- PARSER PRINCIPAL ROBUSTO ---
def parse_nfe_xml(xml_content: bytes):
    print("DEBUG: Iniciando parse_nfe_xml.")
    try:
        # Remove declaração de XML se presente para evitar erros de parsing
        # Corrigido o SyntaxWarning usando raw string (r'')
        xml_content = re.sub(rb'^[ \t\n\r]*<\?xml.*\?>', b'', xml_content, count=1)
        root = etree.fromstring(xml_content)
        print("DEBUG: XML parsed com sucesso pela lxml.")
        
        # Detecta o namespace automaticamente da tag raiz
        ns = {'nfe': root.nsmap.get(None, 'http://www.portalfiscal.inf.br/nfe')}

        infNFe = root.find('.//nfe:infNFe', ns)
        if infNFe is None:
            print("DEBUG: <infNFe> não encontrado com namespace. Tentando sem namespace.")
            # Fallback para XML sem namespace
            ns = {}
            infNFe = root.find('.//infNFe', ns)
            if infNFe is None:
                print("ERRO: Elemento <infNFe> não encontrado mesmo sem namespace.")
                raise ValueError("Elemento <infNFe> não encontrado.")

        ide = infNFe.find('nfe:ide', ns)
        emit = infNFe.find('nfe:emit', ns)

        # Dados da Nota Fiscal
        nfe_number = ''
        nfe_serie = ''
        dh_emi_str = ''
        data_emissao = ''

        nfe_number = get_text(ide, 'nfe:nNF', ns, 'NFe_UNKNOWN') # Simplificado para depuração
        nfe_serie = get_text(ide, 'nfe:serie', ns, '1')
        dh_emi_str = get_text(ide, 'nfe:dhEmi', ns)
        data_emissao = dh_emi_str.split('T')[0] if 'T' in dh_emi_str else dh_emi_str
        print(f"DEBUG: NF-e: {nfe_number}-{nfe_serie}")

        # --- EXTRAÇÃO DOS PRODUTOS (PRECISA SER FEITA PRIMEIRO PARA O CÁLCULO DE PESO) ---
        all_products = []
        print("DEBUG: Iniciando extração de produtos...")
        for det in infNFe.findall('nfe:det', ns):
            prod = det.find('nfe:prod', ns)
            if prod is None: continue

            # 4.1. QNT / QTY UNIT (Quantidade Comercial)
            qCom = get_value(prod, 'nfe:qCom', ns)
            if qCom == 0:
                qCom = get_value(prod, 'nfe:qTrib', ns)

            # 4.2. U/M (Unidade de Medida Comercial)
            uCom = get_text(prod, 'nfe:uCom', ns)
            if not uCom:
                uCom = get_text(prod, 'nfe:uTrib', ns, 'N/A')

            # 4.5. UNIT $ (BRL) (Valor Unitário Comercial)
            vUnCom = get_value(prod, 'nfe:vUnCom', ns)
            if vUnCom == 0:
                vProd = get_value(prod, 'nfe:vProd', ns)
                if vProd > 0 and qCom > 0:
                    vUnCom = vProd / qCom
            
            # 4.6. $ BRL (Total) (Valor Total do Item em BRL)
            vProd = get_value(prod, 'nfe:vProd', ns)
            if vProd == 0 and vUnCom > 0 and qCom > 0:
                vProd = vUnCom * qCom

            # Cria o dicionário de dados preliminar
            product_data = {
                "code": get_text(prod, 'nfe:cProd', ns),
                "name": get_text(prod, 'nfe:xProd', ns, 'N/A'),
                "ncm": get_text(prod, 'nfe:NCM', ns, 'N/A'),
                "quantity": qCom,
                "costPrice": vUnCom,
                "totalPriceBRL": vProd,
                "dadosCompletos": {
                    "unidade": uCom
                },
                "calculated_qty_kg": get_qty_kg(prod, ns)
            }

            # Auditoria de Peso
            official_kg = product_data['calculated_qty_kg']
            audited_kg, audited_unit = calculate_audited_weight(product_data['name'], qCom)
            # print(f"--- Auditoria de Peso para: {product_data['name']}")
            # print(f"  -> Peso Declarado (qTrib): {official_kg:.4f} kg")
            if audited_kg is not None:
                # print(f"  -> Peso Auditado (descrição): {audited_kg:.4f} kg")
                if abs(official_kg - audited_kg) > 0.01: # Compara com uma pequena tolerância
                    # print("  ** ALERTA: Discrepância encontrada! SUBSTITUINDO o peso declarado pelo auditado. **")
                    product_data['calculated_qty_kg'] = audited_kg # Substitui o valor
                    if audited_unit:
                        product_data['dadosCompletos']['unidade'] = audited_unit
            # else:
                # print("  -> Peso Auditado (descrição): Não foi possível calcular.")



            all_products.append(product_data)
        
        print(f"DEBUG: {len(all_products)} produtos extraídos.")

        # --- EXTRAÇÃO DOS DADOS GERAIS (AGORA COM FALLBACKS) ---
        peso_liquido_final = get_peso_liquido(infNFe, ns, all_products)
        peso_bruto_final = get_peso_bruto(infNFe, ns, peso_liquido_final)

        # Dados do Fornecedor
        supplier_name = get_text(emit, 'nfe:xNome', ns, 'N/A')
        cnpj = get_text(emit, 'nfe:CNPJ', ns)
        print(f"DEBUG: Fornecedor: {supplier_name} ({cnpj})")
        
        # Extrair endereço do fornecedor
        enderEmit = emit.find('nfe:enderEmit', ns)
        address_parts = []
        if enderEmit is not None:
            xLgr = get_text(enderEmit, 'nfe:xLgr', ns)
            nro = get_text(enderEmit, 'nfe:nro', ns)
            xCpl = get_text(enderEmit, 'nfe:xCpl', ns)
            xBairro = get_text(enderEmit, 'nfe:xBairro', ns)
            xMun = get_text(enderEmit, 'nfe:xMun', ns)
            UF = get_text(enderEmit, 'nfe:UF', ns)
            CEP = get_text(enderEmit, 'nfe:CEP', ns)

            if xLgr: address_parts.append(xLgr)
            if nro: address_parts.append(nro)
            if xCpl: address_parts.append(xCpl)
            if xBairro: address_parts.append(xBairro)
            if xMun: address_parts.append(xMun)
            if UF: address_parts.append(UF)
            if CEP: address_parts.append(CEP)
        
        address = ", ".join(address_parts) if address_parts else ""

        print("DEBUG: parse_nfe_xml concluído com sucesso.")
        return {
            "fornecedor": {"nome": supplier_name, "cnpj": cnpj, "address": address},
            "produtos": all_products,
            "notaFiscal": {
                "numero": nfe_number,
                "serie": nfe_serie,
                "dataEmissao": data_emissao,
                "pesoBruto": peso_bruto_final,
                "pesoLiquido": peso_liquido_final
            }
        }
    except etree.XMLSyntaxError as e:
        print(f"ERRO: Erro de sintaxe no XML: {e}")
        raise HTTPException(status_code=400, detail=f"Erro de sintaxe no XML: {e}")
    except Exception as e:
        import traceback
        trace = traceback.format_exc()
        print(f"ERRO: Erro inesperado em parse_nfe_xml: {e}\nTraceback: {trace}")
        raise HTTPException(status_code=500, detail=f"Erro inesperado ao processar o XML: {e}\nTraceback: {trace}")


@app.post("/api/upload/")
async def upload_file_data(file: UploadFile = File(...)):
    print("DEBUG: Endpoint /api/upload/ atingido.")
    
    if not file.filename.endswith('.xml'):
        print(f"ERRO: Arquivo não XML recebido: {file.filename}")
        raise HTTPException(status_code=400, detail="Apenas ficheiros XML são permitidos.")

    try:
        print(f"DEBUG: Recebido arquivo '{file.filename}' com content-type '{file.content_type}'.")
        xml_content = await file.read()
        print(f"DEBUG: Arquivo lido, {len(xml_content)} bytes.")
        
        parsed_data = parse_nfe_xml(xml_content)
        print("DEBUG: Dados do XML parseados com sucesso.")

        if not parsed_data or not parsed_data.get("produtos"):
            print("AVISO: Nenhum produto encontrado no XML após o parse.")
            raise HTTPException(status_code=404, detail="Nenhum produto encontrado no XML. O formato pode não ser suportado.")

        print("DEBUG: Retornando JSONResponse com os dados dos produtos.")
        return JSONResponse(content=parsed_data)

    except Exception as e:
        import traceback
        trace = traceback.format_exc()
        print(f"ERRO: Exceção não capturada no endpoint /api/upload/: {e}\nTraceback: {trace}")
        # Retorna um erro 500 genérico para o cliente
        raise HTTPException(status_code=500, detail=f"Ocorreu um erro interno no servidor: {e}")